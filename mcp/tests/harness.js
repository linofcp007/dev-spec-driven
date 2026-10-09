"use strict";

/**
 * The MCP suite's harness. mcp/test.js (the runner — scripts/test-runner.js) starts one child process per CHAIN of test
 * files; the child requires this module, which spawns ONE server (mcp/server.js over stdio, its default project a throwaway
 * temp dir) for the whole chain, runs the handshake, and hands every file of the chain the same context:
 *
 *   ok(cond, label)          one assertion — "  ok   - <label>" / "  FAIL - <label>"
 *   all(label, conds)        one assertion over many conditions ({ name: cond } or [() => cond, …]): a FAIL names the false
 *                            ones · eq(actual, expected, label): JSON deep equality, a FAIL shows the first difference
 *                            (scripts/test-runner.js assertHelpers — prefer all() beyond ~4 conditions) · remeasure(measure,
 *                            holds): a timing-bound check's sample, measured once more on a miss (no assertion)
 *   rpc(method, params)      one JSON-RPC request → its reply (no reply within 15 s fails the run, never drains to exit 0)
 *   rawOnce(line)            a raw line → the first id-null (or batch) reply — malformed-input tests
 *   notify(method, params)   a notification (no reply)
 *   payload(res)             a tools/call reply's JSON payload
 *   S · root · tmp · SERVER  the engine (mcp/lib/spec.js) · the repo · this process's temp dir (the server's default
 *                            project — a file makes its own projects UNDER it: path.join(tmp, "proj-…")) · mcp/server.js
 *   init · list              the handshake's initialize / tools/list replies (ctDesc · ntvSentence: spec_complete_task's
 *                            description and its nothingToVerify sentence)
 *   libSources() · maintainerNotes() · GATE_ORDER · approveBefore() · shipFeature()     shared helpers (below)
 *   child · abort(reason)    the server process · fail the run now (a private server that stops answering)
 *   require · __dirname · __filename   mcp/test.js's, so the test code reads paths from mcp/ — require("./lib/i18n.js"),
 *                            path.join(__dirname, "server.js") — whichever file of mcp/tests/ it lives in
 *
 * A file destructures what it uses in its signature — exports.run = async ({ ok, rpc, S, tmp }) => { … } — and may leave
 * values for the files that list it in `deps`: `return { name: value }` joins the context they receive.
 * The handshake's own assertions are counted by the chain holding the file that exports `handshake: true`; every other
 * process runs the handshake muted. Temp dir removal waits for the server to exit (Windows refuses to remove a folder
 * a running process holds a file in), and the process exits only once stdout has flushed.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRequire } = require("module");
const { exitFlushed, rmTmpDir, isolate, assertHelpers } = require("../../scripts/test-runner.js");

// Hermetic (1.26), before the engine loads: no SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / DEV_SPEC_* … of the shell, and a fresh
// empty temp folder as the working folder — what the runner already gave this chain (then a no-op), and the same when this
// harness is loaded any other way. The suites run on the engine's MODULES (1.20): a DEV_SPEC_BUNDLE the user set goes with them
// — the bundle's own tests set it for the processes they start.
isolate("spec-test-");
const MCP_DIR = path.join(__dirname, ".."); // mcp/ — where mcp/test.js lives: the tests' __dirname
const MCP_TEST = path.join(MCP_DIR, "test.js");
const S = require("../lib/spec.js");
const root = path.join(MCP_DIR, "..");
// Every engine source file (1.18): the facades (mcp/lib/spec.js, i18n.js, prompts-resources.js) and their modules under
// mcp/lib/engine/ and mcp/lib/i18n/ — the source guards scan them all, never a facade alone. i18n: false leaves the
// localized text out (i18n.js and mcp/lib/i18n/). Not the GENERATED spec.bundle.js (1.20, npm run build): it is those very
// sources verbatim plus the registry scripts/build.js emits — the guards scan scripts/build.js, and a test holds the bundle
// equal to a fresh build (scanning its copy would only report every finding twice).
function libSources({ i18n = true } = {}) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (i18n || e.name !== "i18n") walk(p); }
      else if (e.name.endsWith(".js") && e.name !== "spec.bundle.js" && (i18n || e.name !== "i18n.js")) out.push(p);
    }
  };
  walk(path.join(MCP_DIR, "lib"));
  return out;
}
// The maintainer notes (1.20): CLAUDE.md — the index, loaded into every session — and the topic files under
// docs/maintainers/ it maps. A prose guard about "the notes" reads them all, never the index alone.
function maintainerNotes() {
  const dir = path.join(root, "docs", "maintainers");
  const files = ["CLAUDE.md"].concat(fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => path.join("docs", "maintainers", f)));
  return files.map((f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n")).join("\n");
}
// Phase by phase (1.13): a phase is approved only after every earlier pending one. A test exercising ONE phase's gate
// first records the earlier ones (with force — they may still be templates; doctor keeps them flagged as forced).
const GATE_ORDER = ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"];
function approveBefore(dir, slug, phase) {
  for (const ph of S.specDoctor(dir, slug).pendingGates || []) if (GATE_ORDER.indexOf(ph) < GATE_ORDER.indexOf(phase)) S.approvePhase(dir, slug, ph, "t", { force: true });
}

const SERVER = path.join(MCP_DIR, "server.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec-test-"));

let pass = 0,
  fail = 0;
let muted = true; // the handshake runs muted unless this chain counts it (setup)
function ok(cond, label) {
  if (muted) return;
  if (cond) {
    pass++;
    console.log("  ok   - " + label);
  } else {
    fail++;
    console.log("  FAIL - " + label);
  }
}
// 1.15: only a SHIPPED feature's _Supersedes:_ retires an AC in the catalog / export / matrix (a draft's is "to be
// superseded"). The tests exercising the marker's reading mark the declaring feature shipped: an execution sign-off.
function shipFeature(dir, slug, at) {
  const sp = path.join(dir, ".specs", slug, ".state.json");
  const st = JSON.parse(fs.readFileSync(sp, "utf8"));
  st.approvals = { ...(st.approvals || {}), execution: { at: at || "2026-09-01T00:00:00.000Z", by: "test" } };
  fs.writeFileSync(sp, JSON.stringify(st, null, 2));
}

const child = spawn(process.execPath, [SERVER], {
  env: { ...process.env, SPEC_PROJECT_DIR: tmp },
  stdio: ["pipe", "pipe", "inherit"],
});

const pending = new Map();
let buf = "";
child.stdout.on("data", (d) => {
  buf += d.toString();
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb(msg);
    } else if ((msg.id === null || Array.isArray(msg)) && rawWaiters.length) {
      rawWaiters.shift()(msg);
    }
  }
});

// A server that dies or stops answering must FAIL the suite — never let the event loop drain and exit 0.
function abort(reason) {
  if (aborting) return; // a second timer, or the server's exit after the first abort
  aborting = true;
  finished = true;
  console.log("  FAIL - " + reason);
  console.log(`\n${pass} passed, ${fail + 1} failed`);
  try { child.kill(); } catch {}
  closeRun(1, 2000);
}
let finished = false;
let aborting = false;
// Remove the temp dir only once the server has exited — while it runs it may hold a file under it, and Windows then
// refuses the removal (the folder stayed behind, run after run) — with a fallback timer; then exit once stdout flushed.
function closeRun(code, waitMs) {
  const done = () => { rmTmpDir(tmp); exitFlushed(code); };
  if (child.exitCode !== null || child.signalCode !== null) return done();
  const t = setTimeout(() => { try { child.kill(); } catch {} done(); }, waitMs);
  child.once("exit", () => { clearTimeout(t); done(); });
}
child.on("exit", (code) => { if (!finished) abort("MCP server exited early (code " + code + ") with " + pending.size + " request(s) pending"); });

let idc = 1;
function rpc(method, params) {
  const id = idc++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => abort(`no reply to ${method} (id ${id}) within 15s`), 15000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
// Raw line → first reply (for malformed-input tests, where the reply id is null).
function rawOnce(line) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => abort("no reply to raw line " + JSON.stringify(line)), 15000);
    rawWaiters.push((msg) => { clearTimeout(timer); resolve(msg); });
    child.stdin.write(line + "\n");
  });
}
const rawWaiters = [];
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}
function payload(res) {
  return JSON.parse(res.result.content[0].text);
}
// The end of a run: stop the server, print the total, clean up.
function endRun() {
  finished = true;
  child.stdin.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  closeRun(fail ? 1 : 0, 5000);
}

// One chain (scripts/test-runner.js): the handshake — muted unless a file of the chain counts it — then the context.
async function setup(chain) {
  muted = !chain.some((f) => f.handshake);
  const init = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
  ok(init.result && init.result.serverInfo.name === "dev-spec-driven", "initialize returns serverInfo");
  notify("notifications/initialized", {});

  const list = await rpc("tools/list", {});
  ok(list.result.tools.length === 32, "tools/list returns 32 tools (got " + list.result.tools.length + ")");
  // The advertised contract matches taskVerification(): a nothingToVerify task is verified — doctor / finish / ROADMAP.md
  // never list it (the description said they "keep listing such a task", a clause left over from the unverified sentence).
  const ctDesc = (list.result.tools.find((t) => t.name === "spec_complete_task") || {}).description || "";
  const ntvSentence = (ctDesc.match(/A task with no runnable _Verify:_ and nothing recorded.*?\)\./) || [""])[0];
  ok(/nothingToVerify: true/.test(ntvSentence) && /pass it too/.test(ntvSentence) && !/keep listing|counts it/.test(ntvSentence) &&
    /plus a localized note; doctor, spec_finish and ROADMAP\.md list such an unverified task with its localized reason\./.test(ctDesc),
    "spec_complete_task's description: a nothingToVerify task passes doctor / finish / ROADMAP.md; only an unverified task is listed with its reason");
  muted = false;
  const ctx = {
    ok, ...assertHelpers(ok), rpc, rawOnce, notify, payload, S, root, tmp, SERVER, libSources, maintainerNotes, GATE_ORDER, approveBefore, shipFeature,
    child, abort, init, list, ctDesc, ntvSentence,
    require: createRequire(MCP_TEST), __dirname: MCP_DIR, __filename: MCP_TEST,
  };
  return { ctx, counts: () => ({ pass, fail }), fail: (label) => ok(false, label), end: endRun };
}

module.exports = { setup };

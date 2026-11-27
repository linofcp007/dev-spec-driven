"use strict";
// Lifecycle — the read gate's scope (1.41.1): every entry the surfaces call — the operations table, the MCP server's own helpers, the resources / prompts / completions, the CLI's commands, the hooks — reads with its project recorded, so the gate stands on the project's own .specs/ (a project below a folder named .specs whose .specs/ is a junction: an unscoped read stands on the outer folder and lstats the junction); the B-1 twin of that layout answers as the same project elsewhere.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

exports.run = async ({ ok, skip, all, S, tmp, hookIn, cliIn, require, __dirname }) => {
  const js = JSON.stringify;
  const { OPERATIONS } = require("./lib/operations.js");
  const R = require("./lib/prompts-resources.js");
  const HOOKS = path.join(__dirname, "..", "hooks");
  const link = (target, at) => { try { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.symlinkSync(target, at, "junction"); return true; } catch { return false; } };
  const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const REQ = "# Feature: alpha\n\n## Summary\nSave items.\n\n## User Stories\n\n### US-1: Save (P1)\nAs a user I want to save so that I keep it.\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a user saves an item THE SYSTEM SHALL store it\n";
  const TASKS = "# Tasks\n\n- [ ] 1. [US1] Store it for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/shared/a.js_\n  - _Verify: node -v_\n";
  // A project (approval guard ask) whose .specs/ lives elsewhere and is linked in (a supported layout), an in-project package junction
  // (packages/web -> shared/web), an in-project code junction (src/shared -> lib/shared), a legacy feature folder named templates/.
  const build = (p, store) => {
    fs.mkdirSync(p, { recursive: true });
    S.initProject(p, ["tdd"], "en", { approvalGuard: "ask", evidence: "reported" });
    const f = S.createFeature(p, { name: "alpha", tracks: ["tdd"] });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS);
    put(path.join(p, ".specs", "templates", ".state.json"), js({ lang: "en", tracks: ["core"] }));
    put(path.join(p, ".specs", "templates", "requirements.md"), "# Feature: templates\n");
    put(path.join(p, "shared", "web", "package.json"), js({ name: "web", dependencies: { react: "18" } }));
    put(path.join(p, "shared", "web", "src", "app.js"), "module.exports = 1;\n");
    put(path.join(p, "lib", "shared", "a.js"), "module.exports = 2; // US-1.AC-1\n");
    put(path.join(p, "tests", "a.test.js"), "// T-01 US-1.AC-1\ntest('x', () => {});\n");
    const okLinks = link(path.join(p, "shared", "web"), path.join(p, "packages", "web")) && link(path.join(p, "lib", "shared"), path.join(p, "src", "shared"));
    fs.mkdirSync(path.dirname(store), { recursive: true });
    fs.cpSync(path.join(p, ".specs"), store, { recursive: true });
    fs.rmSync(path.join(p, ".specs"), { recursive: true, force: true });
    return okLinks && link(store, path.join(p, ".specs"));
  };
  const base = path.join(tmp, "rgs");
  const outer = path.join(base, "u", ".specs"); // a folder merely NAMED .specs …
  const P = path.join(outer, "app"), PT = path.join(base, "t", "plain", "app"); // … the project below it, and its twin elsewhere
  if (!build(P, path.join(base, "u", "store", "specs")) || !build(PT, path.join(base, "t", "store", "specs"))) { skip("1.41.1 read gate scope", "links not creatable here"); return; }

  // THE detector: a read-gate call (partKind / realDirOf / realSpecsRoot / specsWriteBlock — their lstat / realpath) on a path inside
  // the outer folder but not at or below the project's own .specs/ is a gate standing on the OUTER folder: a read whose scope recorded
  // no project (the junction itself lstat'ed — a link: read as absent). One file, required in this process or preloaded by a child.
  const spyFile = path.join(base, "gate-spy.js"), log = path.join(base, "gate-spy.log");
  fs.writeFileSync(spyFile, [
    "\"use strict\";",
    "const fs = require(\"fs\"), path = require(\"path\");",
    "const fold = (s) => (process.platform === \"win32\" || process.platform === \"darwin\" ? s.toLowerCase() : s);",
    "// the caller of the fs call: a part's lstat / a folder's realpath (partKind, realDirOf, specsWriteBlock) lies strictly below the root;",
    "// the root's own realpath (realSpecsRoot) IS the root — anything else inside the outer folder is a gate on the wrong root",
    "const PART = /^\\s*at (?:Object\\.)?(partKind|realDirOf|specsWriteBlock) /, ROOT = /^\\s*at (?:Object\\.)?realSpecsRoot /;",
    "function install(cfg) {",
    "  const outer = fold(path.resolve(cfg.outer)), own = fold(path.resolve(cfg.own));",
    "  const saved = [];",
    "  const wrap = (obj, key, label) => {",
    "    const orig = obj[key];",
    "    const w = function (q, ...rest) {",
    "      if (typeof q === \"string\") {",
    "        const a = fold(path.resolve(q));",
    "        if ((a === outer || a.startsWith(outer + path.sep)) && !a.startsWith(own + path.sep)) {",
    "          const st = new Error().stack, caller = st.split(\"\\n\")[2] || \"\";",
    "          if (PART.test(caller) || (ROOT.test(caller) && a !== own)) fs.appendFileSync(cfg.log, JSON.stringify({ fn: label, p: q, at: st.split(\"\\n\").slice(2, 16).map((l) => l.trim()).join(\" < \") }) + \"\\n\");",
    "        }",
    "      }",
    "      return orig.call(this, q, ...rest);",
    "    };",
    "    if (orig.native) w.native = orig.native;",
    "    saved.push([obj, key, orig]);",
    "    obj[key] = w;",
    "  };",
    "  wrap(fs, \"lstatSync\", \"lstat\");",
    "  const rp = fs.realpathSync.native;",
    "  const wrapRp = { native: rp };",
    "  wrap(wrapRp, \"native\", \"realpath\");",
    "  fs.realpathSync.native = wrapRp.native;",
    "  return () => { for (const [o, k, f] of saved) o[k] = f; fs.realpathSync.native = rp; };",
    "}",
    "module.exports = { install };",
    "if (process.env.DSD_TEST_GATE_SPY) install(JSON.parse(process.env.DSD_TEST_GATE_SPY));",
    "",
  ].join("\n"));
  const cfg = { outer, own: path.join(P, ".specs"), log };
  const logged = () => { try { return fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  fs.writeFileSync(log, "");
  const restore = require(spyFile).install(cfg);
  const driven = new Set();
  const env = { ...process.env, CLAUDE_PROJECT_DIR: P };
  delete env.SPEC_PROJECT_DIR;
  try {
    // (a) every operation of the table, a read pass then a write pass, the plain feature and a name no feature holds
    const EV = { command: "node -v", exitCode: 0, summary: "ok" };
    const GENERIC = (w, nm) => ({ name: nm, number: 1, write: w, includeBody: true, includeBrief: true, code: true, matrix: true, batch: true, waves: true,
      max: 3, evidence: w ? EV : undefined, reason: "r", phase: "requirements", by: "t", force: w, lang: "en", explain: true,
      text: "WHEN a user saves an item THE SYSTEM SHALL store it", description: "users save items", track: "sec", dependsOn: ["alpha"],
      tasks: [{ text: "More", requirements: ["US-1.AC-1"] }], gitLog: "", since: "all", apply: w, reopen: w, cap: 100,
      minLines: 8, tests: true, title: "t", decision: "d", message: "All tasks are done and verified.", agent: "" });
    const OWN = {
      init: () => [{ tracks: ["tdd"], lang: "en" }], classify: () => [{}], create: (w) => (w ? [{ name: "fresh-one", tracks: ["tdd"] }, {}] : [{}]),
      steering: () => [{ file: "custom-one.md" }], backlog: () => [{ action: "list" }, { action: "add", name: "later", note: "n" }], milestone: () => [{ action: "list" }],
      feature: (w) => (w ? [{ action: "flow", flow: "design-first" }, { action: "protect" }, { action: "archive" }, { action: "restore" }] : [{ action: "remove" }]),
      import: (w) => [{ tool: "plan", text: "# Plan: OK\n\n## Steps\n1. do `src/a.js`\n", dryRun: !w }],
      scan: () => [{}, { path: path.join(P, "packages", "web") }], // a linked package of the project: scanned as ever
      templates: () => [{ action: "list" }], tracks: () => [{ action: "list" }], signals: () => [{ op: "list" }],
      export: () => [{ format: "md" }, { format: "csv" }], changelog: () => [{ since: "all" }],
      "stop-check": () => [{}, { agent: "dev-spec-driven:spec-implementer", message: "**Status:** DONE\nReport: .specs/alpha/.execution/task-1-report.md" }],
      approve: (w) => [{ phase: "requirements" }, ...(w ? [{ through: "tasks", reason: "r" }] : [])],
    };
    const order = OPERATIONS.filter((o) => o.id !== "feature").concat(OPERATIONS.filter((o) => o.id === "feature"));
    for (const w of [false, true]) for (const op of order) {
      const keys = Object.keys(op.args || {});
      for (const nm of keys.includes("name") ? ["alpha", "nosuch"] : [undefined]) {
        for (const extra of OWN[op.id] ? OWN[op.id](w, nm) : [{}]) {
          const o = {};
          const g = GENERIC(w, nm);
          for (const k of keys) if (g[k] !== undefined) o[k] = g[k];
          Object.assign(o, extra);
          try { op.call(S, P, o); } catch { /* a refusal thrown: not the point */ }
          driven.add("op:" + op.id);
        }
      }
    }
    // (b) the resources, prompts and completions the MCP server serves (in-process: the server's own calls are (d))
    const lr = R.listResources(P);
    for (const r of (lr.resources || []).slice(0, 40)) R.readResource(P, r.uri);
    R.readResource(P, "specs://feature/alpha/requirements.md");
    R.readResource(P, "specs://feature/templates/requirements.md");
    R.complete(P, { ref: { type: "ref/resource", uri: "specs://feature/{slug}/{artifact}" }, argument: { name: "slug", value: "" } });
    R.complete(P, { ref: { type: "ref/prompt", name: "spec-status" }, argument: { name: "feature", value: "" } });
    R.listPrompts({});
    driven.add("resources");
    // (c) every CLI command (in this process, as the CLI suite runs them), a feature name where it takes one — the CLI-only paths too:
    // `ears <file>`, `scan <a linked package>`, the status line
    const CMD = require(path.join(__dirname, "..", "cli", "commands.js"));
    const names = CMD.COMMANDS.map((c) => c.name || c.cmd).filter((n) => !["evals", "bundle", "merge-state", "mcp-config", "rules", "completion", "help", "version", "import"].includes(n));
    const cli = (args) => { try { cliIn(args.concat(["--project", P]), { env, cwd: P }); } catch { /* a command that waits */ } };
    for (const n of names) { cli([n]); cli([n, "alpha"]); driven.add("cli:" + n); }
    cli(["ears", path.join(P, ".specs", "alpha", "requirements.md")]);
    cli(["scan", path.join(P, "packages", "web")]);
    cli(["statusline"]);
    // (d) the hooks — their engine calls, in this process (hooks' own decide)
    const hook = (file, payload) => { hookIn(path.join(HOOKS, file), { input: js({ ...payload, cwd: P }), cwd: P, env }); driven.add("hook:" + file); };
    hook("spec-hook.js", { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: path.join(P, ".specs", "alpha", "requirements.md") } });
    hook("spec-hook.js", { hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: path.join(P, ".specs", "alpha", "tasks.md") } });
    hook("spec-hook.js", { hook_event_name: "SessionStart" });
    hook("observe-hook.js", { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "node -v" }, tool_response: { stdout: "v1", exit_code: 0 } });
    hook("stop-hook.js", { hook_event_name: "Stop", last_assistant_message: "All tasks are done and verified." });
    hook("guard-hook.js", { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(P, "src", "shared", "a.js") } });
    hook("approval-hook.js", { hook_event_name: "PreToolUse", tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_approve", tool_input: { name: "alpha", phase: "requirements" } });
    hook("approval-hook.js", { hook_event_name: "PreToolUse", tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_init", tool_input: { evidence: "reported" } });
  } finally { restore(); }
  // (e) the MCP server itself (a child, the detector preloaded): its approval policy (approval meta on an unchanged spec_init), a tool
  // call, the resources and a completion
  const kid = spawn(process.execPath, [path.join(__dirname, "server.js")], { env: { ...env, SPEC_MCP_APPROVAL_HOOK: "", DEV_SPEC_ELICIT_TIMEOUT_MS: "2500",
    NODE_OPTIONS: "--require \"" + spyFile.split(path.sep).join("/") + "\"", DSD_TEST_GATE_SPY: js(cfg) }, stdio: ["pipe", "pipe", "pipe"] });
  const waiting = new Map(), asked = [];
  let buf = "", n = 0, stderr = "", exited = false;
  const gone = new Promise((resolve) => kid.on("exit", () => { exited = true; resolve(); }));
  kid.stderr.on("data", (d) => { stderr += d.toString(); });
  const write = (m) => kid.stdin.write(js(m) + "\n");
  kid.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let m;
      try { m = JSON.parse(line); } catch { continue; }
      if (m.method === "elicitation/create") { asked.push(m); setTimeout(() => write({ jsonrpc: "2.0", id: m.id, result: { action: "decline" } }), 20); continue; }
      if (m.method) continue;
      if (waiting.has(m.id)) { const cb = waiting.get(m.id); waiting.delete(m.id); cb(m); }
    }
  });
  const req = (method, params) => new Promise((resolve) => {
    if (exited) return resolve({ exited: true });
    const id = "rgs-" + ++n;
    const t = setTimeout(() => resolve({ timeout: true }), 15000);
    waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
    write({ jsonrpc: "2.0", id, method, params });
  });
  await req("initialize", { protocolVersion: "2025-06-18", capabilities: { elicitation: {} }, clientInfo: { name: "rgs", version: "1" } });
  const init = await req("tools/call", { name: "spec_init", arguments: { projectDir: P, evidence: "reported" } }); // unchanged: no question
  await req("tools/call", { name: "spec_status", arguments: { projectDir: P, name: "alpha" } });
  await req("resources/list", {});
  await req("resources/read", { uri: "specs://feature/alpha/requirements.md" });
  await req("completion/complete", { ref: { type: "ref/resource", uri: "specs://feature/{slug}/{artifact}" }, argument: { name: "slug", value: "" } });
  if (!exited) kid.stdin.end();
  await gone;
  if (init.result) driven.add("server");
  // (f) the approval hook as Claude Code runs it — a process, its engine part in a worker thread (the preload reaches the worker too)
  for (const ti of [{ tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_init", tool_input: { evidence: "reported" } },
    { tool_name: "Bash", tool_input: { command: "node cli/dev-spec.js approve alpha requirements" } }]) {
    const r = require("child_process").spawnSync(process.execPath, [path.join(HOOKS, "approval-hook.js")], { input: js({ hook_event_name: "PreToolUse", ...ti, cwd: P }), cwd: P,
      env: { ...env, NODE_OPTIONS: "--require \"" + spyFile.split(path.sep).join("/") + "\"", DSD_TEST_GATE_SPY: js(cfg) }, encoding: "utf8", timeout: 30000 });
    if (r.status === 0) driven.add("hook-process:" + ti.tool_name);
  }
  const bad = logged();
  const where = [...new Set(bad.map((b) => b.at.split(" < ").find((f) => !/gate-spy|partKind|realDirOf|realSpecsRoot|specsReadGate|specsWriteBlock|gateNothing|readRaw|existsRaw|isDirSafe|readDirDisk|safeReaddir|Object\.|wrapped|<anonymous>/.test(f)) || b.at.slice(0, 120)))];
  all("1.41.1 fix round 2 (R2-R-1) — THE property: every entry the surfaces call (the operations table — read and write passes —, the resources / prompts / completions, every CLI command and its CLI-only paths, the hooks, the MCP server's own approval policy) reads with its project recorded: on a project below a folder named .specs whose .specs/ is a junction, no read-gate call stands on the outer folder (got " + js({ n: bad.length, where: where.slice(0, 12), first: bad.slice(0, 3), server: init.result ? "ok" : stderr.slice(0, 400) }) + ")", {
    noUnscoped: () => !bad.length,
    driven: () => driven.size > 80 && driven.has("server") && driven.has("resources") && driven.has("op:scan") && driven.has("cli:ears") && driven.has("hook:approval-hook.js") &&
      driven.has("hook-process:Bash"),
    serverAsksNothing: () => !asked.length && !!init.result, // the unchanged spec_init: the server's meta read through the gate, no question
  });

  // the B-1 twin of that layout (its .specs/ a junction too): the four entries' arguments the sweep missed answer as the same project
  // elsewhere — a scan of a linked package, the resources' legacy templates/ feature, `ears <file>`, the server's unchanged setting
  const view = (p) => {
    const sc = OPERATIONS.find((o) => o.id === "scan").call(S, p, { path: path.join(p, "packages", "web") });
    const lr = R.listResources(p);
    const e = cliIn(["ears", path.join(p, ".specs", "alpha", "requirements.md"), "--project", p], { env: { ...env, CLAUDE_PROJECT_DIR: p }, cwd: p });
    return js([sc.ok, sc.filesScanned, (lr.resources || []).some((x) => /feature\/templates\//.test(x.uri)), e.status, e.stdout.split(p).join("<P>").slice(0, 200)]);
  };
  const vu = view(P), vt = view(PT);
  all("1.41.1 fix round 2 (R2-R-1): the B-1 twin whose .specs/ is a junction — a scan of the project's linked package, the resources' legacy feature folder named templates/ and `ears <file>` answer as the same project elsewhere (got " + js({ vu, vt }) + ")", {
    same: () => vu === vt, scanned: () => JSON.parse(vu)[0] === true, listed: () => JSON.parse(vu)[2] === true, linted: () => JSON.parse(vu)[3] === 0,
  });
};

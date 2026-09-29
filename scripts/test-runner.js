"use strict";

/**
 * The runner both test suites share — `node mcp/test.js` (the MCP server) and `node cli/test-cli.js` (the CLI). Zero
 * dependencies: Node core only, like the rest of the plugin.
 *
 * A suite is a folder of test files named NN-<area>[-<topic>].js (mcp/tests/, cli/tests/): NN numbers the AREA (the same
 * number in both suites — 06 is gates, 09 evidence…), so `--only 06` runs an area and the listing reads area by area.
 * Each file exports `run(ctx)` — `exports.run = async ({ ok, rpc, … }) => { … }`, the context its folder's harness.js
 * builds, destructured in the signature — and, optionally:
 *   deps       the files it needs to have run first IN THE SAME PROCESS — it reads a project folder they built, or a value
 *              one of them returned (run() may return an object: its keys join the context of the files that run after
 *              it). `--only` pulls them in; a file and the files it needs form a CHAIN.
 *   handshake  (MCP) this file counts the assertions of the handshake every process runs (initialize, tools/list).
 * The longest chains start first (the previous run's times, kept in the OS temp dir).
 * Every chain runs in its own child process (its own temp dir and, for the MCP suite, its own server), at most one per
 * CPU at a time; the output is printed file by file in file order, then ONE total. The LAST line is always
 * `N passed, M failed` — scripts/test-docker.js reads it — and a chain that dies without its total fails the suite (the
 * run never drains to exit 0).
 *
 *   node <suite> [--only <file|area|NN>[,…]]... [--list] [--times] [--jobs <n>] [--help]
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHAIN_ENV = "DEV_SPEC_TEST_CHAIN"; // set in a child: the comma-separated file stems it runs, in order
const RE_TEST_FILE = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.js$/;
const RE_TOTAL = /\n(\d+) passed, (\d+) failed\s*$/;
const RE_FILE_STATS = /^#file (\S+) (\d+) (\d+) (\d+)\r?\n/gm; // a child's report of one file: stem, passed, failed, ms

// Exit only once stdout has flushed. On Linux a pipe (docker, `| tee`, `| less`, this runner's own parent) takes writes
// asynchronously once its 64 KB buffer is full, and process.exit() drops whatever is still queued — the tail of the
// output, FAIL lines and the total line included (Windows makes stdio pipes blocking, so it never showed there).
function exitFlushed(code) {
  process.stdout.write("", () => process.exit(code));
}
// Temp dirs: a crashed, killed or timed-out run — or, on Windows, a file a just-exited child or a virus scanner still
// held (rmSync threw EBUSY / EPERM; `force` only silences ENOENT) — left its temp folder behind, run after run. Every
// removal retries (maxRetries), and the parent sweeps its suite's OWN leftovers first: exactly the mkdtemp shape, a real
// directory, untouched for 2 h.
function rmTmpDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 15, retryDelay: 100 }); } catch {}
}
function sweepStaleTmp(prefix) {
  let names = [];
  try { names = fs.readdirSync(os.tmpdir()); } catch { return; }
  const cutoff = Date.now() - 2 * 3600 * 1000;
  const shape = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[A-Za-z0-9]{6}$");
  for (const n of names) {
    if (!shape.test(n)) continue;
    const p = path.join(os.tmpdir(), n);
    try { const st = fs.lstatSync(p); if (st.isDirectory() && !st.isSymbolicLink() && st.mtimeMs < cutoff) rmTmpDir(p); } catch {}
  }
}

// Start order: the longest chains first — by the files' times in the previous run (<tmp>/dev-spec-test-times-<key>.json;
// a file never timed counts as the longest) — so the critical path starts at once. The output still comes in file order.
// Best effort: an unreadable or unwritable times file only changes the order.
const timesFile = (key) => path.join(os.tmpdir(), `dev-spec-test-times-${key}.json`);
function readTimes(key) {
  try {
    const t = JSON.parse(fs.readFileSync(timesFile(key), "utf8"));
    return t && typeof t === "object" && !Array.isArray(t) ? t : {};
  } catch { return {}; }
}
function writeTimes(key, stats) {
  try {
    const t = readTimes(key);
    for (const s of stats) t[s.stem] = s.ms;
    const f = timesFile(key), part = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(part, JSON.stringify(t, null, 1));
    fs.renameSync(part, f);
  } catch {}
}

// The suite's files, in name order: { stem, nn, name, file, deps, handshake, head }. A malformed deps list, a dependency
// naming no file or a dependency cycle is an error — the suite can't be scheduled.
function loadFiles(dir) {
  const stemOrder = (a, b) => (a.slice(0, -3) < b.slice(0, -3) ? -1 : 1); // by stem: 04-tracks before 04-tracks-builtin
  const files = fs.readdirSync(dir).filter((f) => RE_TEST_FILE.test(f)).sort(stemOrder).map((f) => {
    const [, nn, name] = f.match(RE_TEST_FILE);
    const file = path.join(dir, f);
    const mod = require(file);
    if (typeof mod.run !== "function") throw new Error(`${f}: exports no run(ctx) function`);
    const deps = mod.deps == null ? [] : mod.deps;
    if (!Array.isArray(deps) || deps.some((d) => typeof d !== "string")) throw new Error(`${f}: deps must be a list of file names`);
    const head = ((fs.readFileSync(file, "utf8").match(/^\/\/ (.+)$/m) || [])[1] || "").trim();
    return { stem: f.slice(0, -3), nn, name, file, deps, handshake: mod.handshake === true, head };
  });
  const byStem = new Map(files.map((f) => [f.stem, f]));
  for (const f of files) {
    for (const d of f.deps) if (!byStem.has(d)) throw new Error(`${f.stem}: needs '${d}', which is no file of ${dir}`);
  }
  const state = new Map();
  const visit = (f, trail) => {
    if (state.get(f.stem) === "done") return;
    if (state.get(f.stem) === "open") throw new Error(`dependency cycle: ${trail.concat(f.stem).join(" → ")}`);
    state.set(f.stem, "open");
    for (const d of f.deps) visit(byStem.get(d), trail.concat(f.stem));
    state.set(f.stem, "done");
  };
  files.forEach((f) => visit(f, []));
  return files;
}

// A token names: a FILE by its full stem (17-docs — that file only; with no file of that exact stem, the files it
// prefixes: 06-gates → 06-gates-approve, 06-gates-planning…), an AREA by its number (04) or by a name or name prefix
// (tracks → 04-tracks and 04-tracks-builtin; docs → 17-docs and 17-docs-evals). A path or a .js suffix is accepted.
function matchesToken(f, token, files) {
  const t = path.basename(token.trim()).replace(/\.js$/, "").toLowerCase();
  if (!t) return false;
  if (/^\d\d$/.test(t)) return f.nn === t;
  if (/^\d\d-/.test(t)) return files.some((g) => g.stem === t) ? f.stem === t : f.stem.startsWith(t + "-");
  return f.name === t || f.name.startsWith(t + "-");
}

// The files to run: the selection plus, transitively, the files each needs. → { run: [files], pulled: [{stem, by}] }
function selectFiles(files, tokens) {
  if (!tokens.length) return { run: files, pulled: [], unknown: [] };
  const byStem = new Map(files.map((f) => [f.stem, f]));
  const unknown = tokens.filter((t) => !files.some((f) => matchesToken(f, t, files)));
  const chosen = new Set(files.filter((f) => tokens.some((t) => matchesToken(f, t, files))).map((f) => f.stem));
  const pulled = [];
  const add = (f) => {
    for (const d of f.deps) {
      if (!chosen.has(d)) { chosen.add(d); pulled.push({ stem: d, by: f.stem }); }
      add(byStem.get(d));
    }
  };
  files.filter((f) => chosen.has(f.stem)).forEach(add);
  return { run: files.filter((f) => chosen.has(f.stem)), pulled, unknown };
}

// Chains: a file and every file it needs (either way) run in one process, the needed ones first (then name order).
// Chains are listed in the order of their first file.
function buildChains(files) {
  const idx = new Map(files.map((f, i) => [f.stem, i]));
  const parent = files.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  files.forEach((f, i) => f.deps.forEach((d) => { if (idx.has(d)) parent[find(i)] = find(idx.get(d)); }));
  const groups = new Map();
  files.forEach((f, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(f); });
  return [...groups.values()].map((group) => {
    const order = [];
    const seen = new Set();
    const byStem = new Map(group.map((f) => [f.stem, f]));
    const visit = (f) => { if (seen.has(f.stem)) return; seen.add(f.stem); f.deps.forEach((d) => byStem.has(d) && visit(byStem.get(d))); order.push(f); };
    group.forEach(visit);
    return order;
  }).sort((a, b) => Math.min(...a.map((f) => idx.get(f.stem))) - Math.min(...b.map((f) => idx.get(f.stem))));
}

function parseArgs(argv, usage) {
  const o = { only: [], list: false, times: false, jobs: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i];
      if (v == null || v === "" || v.startsWith("--")) usageError(`${a.split("=")[0]} needs a value`, usage);
      return v;
    };
    if (a === "--help" || a === "-h") { console.log(usage); exitFlushed(0); return null; }
    else if (a === "--only" || a.startsWith("--only=")) o.only.push(...val().split(",").map((t) => t.trim()).filter(Boolean));
    else if (a === "--list") o.list = true;
    else if (a === "--times") o.times = true;
    else if (a === "--jobs" || a.startsWith("--jobs=")) {
      const n = val();
      if (!/^[1-9]\d*$/.test(n)) usageError(`--jobs needs a whole number >= 1 (got '${n}')`, usage);
      o.jobs = +n;
    } else usageError(`unknown argument '${a}'`, usage);
  }
  return o;
}
function usageError(msg, usage) {
  console.error(`${msg}\n\n${usage}`);
  process.exit(2);
}

const secs = (ms) => (ms / 1000).toFixed(1) + " s";

// The parent: select, schedule, print. `opts`: { suite, dir, entry, tmpPrefix }.
function runParent(opts) {
  const repoPath = (p) => path.relative(opts.root, p).split(path.sep).join("/");
  const rel = repoPath(opts.entry);
  const usage = `usage: node ${rel} [--only <file|area|NN>[,…]]... [--list] [--times] [--jobs <n>]

Runs the ${opts.suite} test files (${repoPath(opts.dir)}/NN-<area>[-<topic>].js).
  --only <x>   only these files: a file by its full name (17-docs), an area by its number (06) or name (gates, tracks)
               — plus the files they need (comma-separated or repeated)
  --list       the files, their areas and what each needs; runs nothing
  --times      print every file's time and assertion count at the end
  --jobs <n>   at most n processes at once (default: one per CPU)
Exit: 0 all passed · 1 an assertion failed or a process died · 2 a usage error.`;
  const o = parseArgs(process.argv.slice(2), usage);
  if (!o) return;
  let files;
  try { files = loadFiles(opts.dir); } catch (e) { console.error(`${opts.suite} tests: ${e.message}`); process.exit(2); }

  if (o.list) {
    const w = Math.max(...files.map((f) => f.stem.length));
    console.log(`${files.length} files in ${repoPath(opts.dir)}/ (run some: node ${rel} --only <file|area|NN>):`);
    for (const f of files) {
      console.log(`  ${f.stem.padEnd(w)}  ${f.head}${f.deps.length ? `  [needs ${f.deps.join(", ")}]` : ""}${f.handshake ? "  [counts the handshake]" : ""}`);
    }
    return exitFlushed(0);
  }

  const sel = selectFiles(files, o.only);
  if (sel.unknown.length) usageError(`no test file or area matches ${sel.unknown.map((t) => `'${t}'`).join(", ")} — see --list`, usage);
  const chains = buildChains(sel.run);
  if (o.only.length) {
    console.log(`# ${sel.run.length} of ${files.length} files: ${sel.run.map((f) => f.stem).join(", ")}` +
      (sel.pulled.length ? ` (${sel.pulled.map((p) => `${p.stem}, needed by ${p.by}`).join("; ")})` : ""));
  }
  sweepStaleTmp(opts.tmpPrefix);

  const t0 = Date.now();
  const runChain = (chain) => new Promise((resolve) => {
    let out = "";
    const started = Date.now();
    const kid = spawn(process.execPath, [opts.entry], { env: { ...process.env, [CHAIN_ENV]: chain.map((f) => f.stem).join(",") }, stdio: ["ignore", "pipe", "pipe"] });
    kid.stdout.on("data", (d) => (out += d));
    kid.stderr.on("data", (d) => (out += d));
    kid.on("error", (e) => resolve({ chain, out: out + "\n" + e.message, code: 1, ms: Date.now() - started }));
    kid.on("close", (code) => resolve({ chain, out, code, ms: Date.now() - started }));
  });
  // At most one process per CPU at a time (each MCP chain also runs its own server), the longest chains first; results
  // keep the chain order.
  const all = new Array(chains.length);
  const times = readTimes(opts.key);
  const weight = (chain) => chain.reduce((s, f) => s + (typeof times[f.stem] === "number" ? times[f.stem] : Infinity), 0);
  const order = chains.map((c, i) => [weight(c), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
  let nextIdx = 0;
  const jobs = o.jobs || Math.max(2, Math.min(chains.length, os.cpus().length || 2));
  const worker = () => (nextIdx >= order.length ? Promise.resolve() : ((i) => runChain(chains[i]).then((r) => { all[i] = r; return worker(); }))(order[nextIdx++]));
  Promise.all(Array.from({ length: Math.min(jobs, chains.length) }, worker)).then(() => {
    let passed = 0, failed = 0;
    const stats = [];
    for (const r of all) {
      const m = r.out.match(RE_TOTAL);
      for (const s of r.out.matchAll(RE_FILE_STATS)) stats.push({ stem: s[1], passed: +s[2], failed: +s[3], ms: +s[4] });
      process.stdout.write(r.out.replace(RE_FILE_STATS, "").replace(RE_TOTAL, "\n"));
      if (m) { passed += +m[1]; failed += +m[2]; }
      // A chain that died (or never printed its total) fails the suite — never let it drain to exit 0.
      if (!m || (r.code !== 0 && +m[2] === 0)) {
        failed++;
        console.log(`  FAIL - ${r.chain.map((f) => f.stem).join(" + ")} exited with code ${r.code} without a clean total`);
      }
    }
    const slow = all.slice().sort((a, b) => b.ms - a.ms)[0];
    console.log(`\n# ${sel.run.length} file(s) in ${chains.length} process(es), ${secs(Date.now() - t0)}` +
      (slow ? ` — slowest: ${slow.chain.map((f) => f.stem).join(" + ")} ${secs(slow.ms)}` : ""));
    if (o.times) {
      const w = Math.max(...stats.map((s) => s.stem.length), 4);
      for (const s of stats.sort((a, b) => b.ms - a.ms)) console.log(`#   ${s.stem.padEnd(w)}  ${String(s.passed).padStart(4)} passed  ${String(s.failed).padStart(3)} failed  ${secs(s.ms).padStart(7)}`);
    }
    writeTimes(opts.key, stats);
    console.log(`\n${passed} passed, ${failed} failed`);
    exitFlushed(failed ? 1 : 0);
  });
}

// A child: run the files of one chain, in order, in this process. `setup(files)` → { ctx, counts(), fail(label), end() } —
// the suite's harness (its server, its temp dir, its helpers); the runner reports each file, then hands over to end(),
// which prints the total line and exits.
async function runChildChain(opts) {
  const stems = String(process.env[CHAIN_ENV]).split(",").filter(Boolean);
  const files = loadFiles(opts.dir);
  const chain = stems.map((s) => files.find((f) => f.stem === s));
  if (chain.some((f) => !f)) {
    console.log(`unknown test file in ${CHAIN_ENV}='${process.env[CHAIN_ENV]}'\n\n0 passed, 1 failed`);
    return exitFlushed(1);
  }
  const h = await opts.setup(chain);
  for (const f of chain) {
    console.log(`# ${f.stem}`);
    const before = h.counts();
    const t0 = Date.now();
    try {
      const left = await require(f.file).run(h.ctx);
      if (left && typeof left === "object") Object.assign(h.ctx, left); // values for the files that need this one
    } catch (e) {
      h.fail(`${f.stem} threw: ${(e && e.stack) || e}`);
    }
    const after = h.counts();
    console.log(`#file ${f.stem} ${after.pass - before.pass} ${after.fail - before.fail} ${Date.now() - t0}`);
  }
  h.end();
}

// The suite entry (mcp/test.js, cli/test-cli.js) calls main(); it is the parent, or — with CHAIN_ENV set — one chain.
function main(opts) {
  if (process.env[CHAIN_ENV]) return runChildChain(opts);
  return runParent(opts);
}

module.exports = { main, exitFlushed, rmTmpDir, sweepStaleTmp, loadFiles, selectFiles, buildChains, matchesToken, CHAIN_ENV, RE_TEST_FILE };

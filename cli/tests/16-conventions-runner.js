"use strict";
// The test runner both suites share (scripts/test-runner.js), on a small fake suite: late assertions, --only's usage error, the times file, stderr after the total.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, tmp, __dirname }) => {
  const js = JSON.stringify;
  const RUNNER = path.join(__dirname, "..", "scripts", "test-runner.js");
  // A fake suite built under tmp: its entry, a harness shaped like the real ones (ok, counts, fail, end → the total line and
  // an exit once stdout has flushed) and its files. Its own temp dir (TMPDIR / TEMP / TMP) holds the times file and nothing else.
  const root = path.join(tmp, "runner-fake");
  const own = path.join(root, "tmpdir");
  const w = (rel, text) => { const p = path.join(root, ...rel.split("/")); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  fs.mkdirSync(own, { recursive: true });
  w("suite.js", `"use strict";
const path = require("path");
require(${js(RUNNER)}).main({ suite: "fake", key: "fake", root: __dirname, dir: path.join(__dirname, "tests"), entry: __filename,
  tmpPrefix: "fake-runner-", setup: () => require("./harness.js").setup() });
`);
  w("harness.js", `"use strict";
const { exitFlushed, isolate } = require(${js(RUNNER)});
isolate("fake-runner-"); // as the real harnesses do, first thing
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const end = () => { console.log("\\n" + pass + " passed, " + fail + " failed"); exitFlushed(fail ? 1 : 0); };
exports.setup = () => ({ ctx: { ok }, counts: () => ({ pass, fail }), fail: (label) => ok(false, label), end });
`);
  w("tests/01-clean.js", `// clean
exports.run = async ({ ok }) => { ok(true, "clean one"); };
`);
  // A forgotten await in the LAST file of its chain: its assertion fires 50 ms after run() resolved (the CLI harness exited first).
  w("tests/02-late.js", `// a late assertion that ends its chain
exports.run = async ({ ok }) => { ok(true, "on time"); setTimeout(() => ok(true, "fired by a timer after run() resolved"), 50); };
`);
  // …and one that fires while the NEXT file of its chain runs (it counted as that file's pass).
  w("tests/03-pair-a.js", `// a late assertion that fires during the next file
exports.run = async ({ ok }) => { ok(true, "a on time"); setTimeout(() => ok(true, "a's late one"), 30); };
`);
  w("tests/04-pair-b.js", `// needs 03-pair-a
exports.deps = ["03-pair-a"];
exports.run = async ({ ok }) => { await new Promise((r) => setTimeout(r, 400)); ok(true, "b on time"); };
`);
  // A Node warning, and a line written to stderr at exit — after the total line.
  w("tests/05-stderr.js", `// stderr after the total
exports.run = async ({ ok }) => { ok(true, "w on time"); process.emitWarning("a warning"); process.on("exit", () => process.stderr.write("STDERR-AFTER-TOTAL\\n")); };
`);
  const env = { ...process.env, TMPDIR: own, TEMP: own, TMP: own };
  delete env.DEV_SPEC_TEST_CHAIN; // this process is itself a chain of the CLI suite: the fake one starts as a parent
  delete env.DEV_SPEC_TEST_CWD; // …in a working folder of its own
  const fake = (...args) => { const r = spawnSync(process.execPath, [path.join(root, "suite.js"), ...args], { encoding: "utf8", env, timeout: 60000 }); return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status }; };
  const lastLine = (s) => s.trimEnd().split(/\r?\n/).pop();

  const all = fake();
  ok(all.code === 1 && lastLine(all.stdout) === "5 passed, 2 failed" &&
    /FAIL - late assertion from 02-late — it ran after the file's run\(\) had resolved \(a missing await\?\): fired by a timer after run\(\) resolved/.test(all.out) &&
    /FAIL - late assertion from 03-pair-a — [^\n]*: a's late one/.test(all.out) && !/ok {3}- (?:fired by a timer|a's late one)/.test(all.out) &&
    !/without a clean total/.test(all.out) && /STDERR-AFTER-TOTAL/.test(all.out),
    "1.20 review: the runner fails a late assertion — an ok() a file makes after its run() resolved (a forgotten await), whether it fires during the next file of its chain or after the last one — labelled with its file, counted before the total; stderr written after a chain's total line (a Node warning, an exit handler) is shown and never voids its count (got " +
    js([all.code, lastLine(all.stdout), all.out.split(/\r?\n/).filter((l) => /FAIL|clean total/.test(l))]) + ")");
  const st = fake("--only", "05");
  ok(st.code === 0 && lastLine(st.stdout) === "1 passed, 0 failed" && /STDERR-AFTER-TOTAL/.test(st.out) && /a warning/.test(st.out),
    "1.20 review: a chain whose stderr carries a Node warning and a line written after its total line still counts (got " + js([st.code, lastLine(st.stdout)]) + ")");

  // --only with no token (`--only ,`, `--only=,`) is a usage error — it ran the whole suite.
  const only = [fake("--only", ","), fake("--only=, ,")];
  ok(only.every((r) => r.code === 2 && /--only needs a file, an area or NN/.test(r.out) && !/passed, \d+ failed/.test(r.out)),
    "1.20 review: --only with an empty token list is a usage error (exit 2), never the whole suite (got " + js(only.map((r) => [r.code, r.out.split(/\r?\n/)[0]])) + ")");

  // The times file can't be replaced (a folder of that name — as a held file refuses a rename on Windows): no .tmp is left.
  fs.rmSync(own, { recursive: true, force: true });
  fs.mkdirSync(path.join(own, "dev-spec-test-times-fake.json"), { recursive: true });
  const held = fake("--only", "01");
  const left = fs.readdirSync(own).filter((f) => /\.tmp$/.test(f));
  ok(held.code === 0 && lastLine(held.stdout) === "1 passed, 0 failed" && left.length === 0,
    "1.20 review: a times file the runner can't replace leaves no dev-spec-test-times-<key>.json.<pid>.tmp behind (got " + js([held.code, left]) + ")");

  // 1.26 — the assertion helpers every file receives beside ok: all(label, conds) and eq(actual, expected, label), one assertion
  // each (the totals stay comparable), built on the file's own ok (a late one is a late assertion). A FAIL says WHAT failed: the
  // names of the false conditions (an object's keys, a thunk's source; a throw or a promise is false, with why) — every condition
  // evaluated, no short circuit — and eq's first difference (its path, what was found, what was expected).
  {
    w("tests/08-helpers.js", `// all() and eq(): one assertion each, a FAIL that says what failed
exports.run = async ({ all, eq }) => {
  const r = { ok: true, items: [1, 2, 3] }, none = undefined;
  all("all passes", [() => r.ok, () => r.items.length === 3]);
  all("all fails", { "r is ok": r.ok, "three items": r.items.length === 4, "none has a name": () => none.name === "x", "a promise": () => Promise.resolve(true) });
  all("thunks fail", [() => r.items.includes(9), () => true, () => r.items.length > 5]);
  eq({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] }, "eq passes");
  eq({ a: [1, { b: "xyz" }] }, { a: [1, { b: "xYz" }] }, "eq string");
  eq([1, 2], [1, 2, 3], "eq length");
  eq({ a: 1, b: 2 }, { b: 2, a: 1 }, "eq order");
  setTimeout(() => all("late all", [() => true]), 30);
};
`);
    const h = fake("--only", "08");
    const block = (label) => { const at = h.out.indexOf("  FAIL - " + label + "\n"); return at < 0 ? null : h.out.slice(at).split(/\r?\n/).slice(1).filter((l, i, xs) => xs.slice(0, i + 1).every((x) => /^ {6}\S/.test(x))); };
    const want = {
      allPasses: /\n {2}ok {3}- all passes\r?\n/.test(h.out) && /\n {2}ok {3}- eq passes\r?\n/.test(h.out),
      allFails: ((b) => !!b && b.length === 3 && b[0] === "      false: three items" && /^ {6}false: none has a name \(threw: .+\)$/.test(b[1]) &&
        b[2] === "      false: a promise (a promise — await it first)")(block("all fails")),
      thunks: js(block("thunks fail")) === js(["      false: r.items.includes(9)", "      false: r.items.length > 5"]),
      eqString: js(block("eq string")) === js(["      at $.a[1].b (character 1): got \"xyz\" — expected \"xYz\""]),
      eqLength: js(block("eq length")) === js(["      at $[2]: missing (got 2 item(s), expected 3) — expected 3"]),
      eqOrder: js(block("eq order")) === js(["      at $: the same keys in another order — got [\"a\",\"b\"], expected [\"b\",\"a\"]"]),
      late: /FAIL - late assertion from 08-helpers — [^\n]*: late all/.test(h.out),
      total: h.code === 1 && lastLine(h.stdout) === "2 passed, 6 failed",
    };
    ok(Object.values(want).every(Boolean),
      "1.26: all() and eq() are one assertion each, on the file's own ok (a late one is a late assertion) — a FAIL lists every false condition by name (an object's key, a thunk's source; a throw or a promise counts as false, saying so) and eq's first difference with its path (got " +
      js({ want, out: h.out.split(/\r?\n/).filter((l) => /FAIL|^ {6}|passed/.test(l)) }) + ")");
  }

  // 1.26 — hermetic chains: a suite started from a folder holding a .specs/ (the maintainer's dogfood one at the repo root: lang
  // pt) with SPEC_PROJECT_DIR, CLAUDE_PROJECT_DIR, DEV_SPEC_DEFAULT_LANG… exported runs every chain in a fresh, empty temp folder
  // of its own (removed afterwards) with none of those variables — the suites' own DEV_SPEC_TEST_* and any other variable kept.
  // The same when a chain is started by hand (DEV_SPEC_TEST_CHAIN set, no parent): the child isolates itself.
  {
    fs.rmSync(own, { recursive: true, force: true });
    fs.mkdirSync(own, { recursive: true });
    const KEYS = ["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_ROOT", "DEV_SPEC_DEFAULT_LANG", "DEV_SPEC_BUNDLE", "SPEC_MCP_PROMPTS", "COLUMNS",
      "DEV_SPEC_TEST_BASH", "FAKE_KEEP"];
    const envFile = `// what a chain sees: its working folder, what it holds, the host's variables
exports.run = async ({ ok }) => {
  const fs = require("fs");
  const env = Object.fromEntries(${js(KEYS)}.map((k) => [k, process.env[k] === undefined ? null : process.env[k]]));
  console.log("ENV " + JSON.stringify({ cwd: process.cwd(), files: fs.readdirSync(process.cwd()), env }));
  ok(true, "env seen");
};
`;
    w("tests/06-env.js", envFile);
    w("tests/07-env.js", envFile);
    w(".specs/roadmap.json", js({ features: {}, meta: { lang: "pt" } }));
    w(".specs/decoy/requirements.md", "# Requisitos\n");
    const host = { ...env, SPEC_PROJECT_DIR: root, CLAUDE_PROJECT_DIR: root, CLAUDE_PLUGIN_ROOT: root, DEV_SPEC_DEFAULT_LANG: "es", DEV_SPEC_BUNDLE: "1",
      SPEC_MCP_PROMPTS: "off", COLUMNS: "20", DEV_SPEC_TEST_BASH: "keep-me", FAKE_KEEP: "kept" };
    const seen = (out) => out.split(/\r?\n/).filter((l) => l.startsWith("ENV ")).map((l) => { try { return JSON.parse(l.slice(4)); } catch { return null; } });
    const fold = (p) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));
    const shape = (s) => !!s && /^fake-runner-[A-Za-z0-9]{6}$/.test(path.basename(s.cwd)) && fold(path.dirname(s.cwd)) === fold(own) &&
      s.files.length === 0 && !fs.existsSync(s.cwd);
    const clean = (s) => !!s && KEYS.slice(0, 7).every((k) => s.env[k] === null) && s.env.DEV_SPEC_TEST_BASH === "keep-me" && s.env.FAKE_KEEP === "kept";
    const r = spawnSync(process.execPath, [path.join(root, "suite.js"), "--only", "06,07"], { cwd: root, encoding: "utf8", env: host, timeout: 60000 });
    const two = seen(r.stdout || "");
    ok(r.status === 0 && lastLine(r.stdout || "") === "2 passed, 0 failed" && two.length === 2 && two.every(shape) && two.every(clean) && two[0].cwd !== two[1].cwd,
      "1.26: every chain runs hermetic — a fresh, empty temp folder of its own as its working folder (never the folder the suite was started from, with its .specs/; removed afterwards) and none of SPEC_PROJECT_DIR, CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_*, SPEC_MCP_*, DEV_SPEC_* (but DEV_SPEC_TEST_*), COLUMNS (got " +
      js([r.status, lastLine(r.stdout || ""), two]) + ")");
    const byHand = spawnSync(process.execPath, [path.join(root, "suite.js")], { cwd: root, encoding: "utf8", env: { ...host, DEV_SPEC_TEST_CHAIN: "06-env" }, timeout: 60000 });
    const one = seen(byHand.stdout || "");
    const harnesses = ["mcp", "cli"].map((s) => fs.readFileSync(path.join(__dirname, "..", s, "tests", "harness.js"), "utf8"));
    const first = (src, call) => { const at = src.indexOf(call); return at > 0 && [/\nconst S = require\(/, /\nconst tmp = /].every((re) => { const m = src.match(re); return !m || at < m.index; }); };
    ok(byHand.status === 0 && lastLine(byHand.stdout || "") === "1 passed, 0 failed" && one.length === 1 && shape(one[0]) && clean(one[0]) &&
      first(harnesses[0], "isolate(\"spec-test-\")") && first(harnesses[1], "isolate(\"cli-test-\")"),
      "1.26: a chain started by hand (DEV_SPEC_TEST_CHAIN set, no runner parent) isolates itself the same way; mcp/tests/harness.js and cli/tests/harness.js call isolate() before the engine loads and their temp dir is made (got " +
      js([byHand.status, lastLine(byHand.stdout || ""), one]) + ")");
  }
};

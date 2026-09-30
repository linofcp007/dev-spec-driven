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
const { exitFlushed } = require(${js(RUNNER)});
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
};

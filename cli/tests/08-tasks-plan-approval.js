"use strict";
// The plan's approval on the CLI (1.42 UX-02) — next / brief / status / done print the planNote on its own ⚠ line while the plan is not approved; nothing once it is.

const fs = require("fs");
const path = require("path");

// The engine's planNote (mcp/tests/08-tasks-plan-approval.js) reaches the CLI user: `next`, `status <f>` and `done` print it on its
// own "  ⚠ " line, `brief` on stderr (stdout stays the brief a pipe takes); --json is the MCP result. An approved plan prints none.
// Mutations listed before the fixtures: C1 next's line dropped · C2 brief's line dropped · C3 brief's line on stdout · C4 status's
// line dropped · C5 done's line dropped.
exports.run = async ({ all, runIn, spawnIn, runAsync, tmp, require, __dirname }) => {
  const js = JSON.stringify;
  const SD = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const PG = SD.msg("en").planGate;
  // the research probe's project: a 3-file Node repo (greet() and one node --test) and an xs change written for real
  const p = path.join(tmp, "plan-greet");
  SD.initProject(p, ["core"], "en");
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
  put("package.json", js({ name: "greet", private: true, scripts: { test: "node --test test/" } }, null, 2) + "\n");
  put("src/greet.js", "exports.greet = (name) => (name ? \"Hello, \" + name : \"Hello, stranger\");\n");
  put("test/greet.test.js", "const test = require(\"node:test\");\nconst assert = require(\"node:assert\");\nconst { greet } = require(\"../src/greet.js\");\n" +
    "test(\"greets by name\", () => assert.strictEqual(greet(\"Ann\"), \"Hello, Ann\"));\ntest(\"greets a stranger\", () => assert.strictEqual(greet(\"\"), \"Hello, stranger\"));\n");
  const f = SD.createFeature(p, "greet-empty-name", ["core"], "greet('') says Hello, stranger", undefined, "en", undefined, { size: "xs" });
  put(".specs/" + f.slug + "/change.md", "# Change: greet-empty-name\n\n## Summary\ngreet('') printed \"Hello, \" — it should greet a stranger.\n\n## Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN greet is called with an empty name THE SYSTEM SHALL return \"Hello, stranger\"\n\n## Approach\nOne guard in src/greet.js; nothing else reads the name.\n\n" +
    "## Tasks\n- [ ] 1. [US1] Return \"Hello, stranger\" for an empty name\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/greet.js_\n  - _Verify: node --test test/_\n");
  const note = PG.notApproved(f.slug, "change.md");
  const P = ["--project", p];
  const nx = runIn(["next", f.slug, ...P]), nj = runIn(["next", f.slug, "--json", ...P]);
  const br = spawnIn(["brief", f.slug, "1", ...P]);
  const st = runIn(["status", f.slug, ...P]);
  const dn = await runAsync(["done", f.slug, "1", "--run", ...P]);
  let njr = null;
  try { njr = JSON.parse(nj.out); } catch { /* not JSON */ }
  all("1.42 UX-02 (CLI): the plan not approved — next, status and done --run print the planNote on its own ⚠ line, brief on stderr (stdout stays the brief); --json is the MCP result (got " +
    js([nx.out, st.out, br.stderr, dn.code, dn.out]) + ")", {
    "next: the ⚠ line (C1)": nx.code === 0 && nx.out.split("\n").includes("  ⚠ " + note),
    "next --json = spec_next_task": !!njr && njr.planApproved === false && njr.planNote === note,
    "brief: the ⚠ line on stderr (C2)": br.status === 0 && br.stderr.split("\n").includes("⚠ " + note),
    "brief: stdout is the brief alone (C3)": /^# Task 1 —|^# /.test(br.stdout) && !br.stdout.includes(note),
    "status: the ⚠ line after the tasks line (C4)": st.code === 0 && /\n {2}⚠ /.test(st.out) && st.out.split("\n").includes("  ⚠ " + note),
    "done --run: ticked, the tick's ⚠ line (C5)": dn.code === 0 && dn.out.split("\n").includes("  ⚠ " + PG.tickedEarly(1, f.slug)) &&
      /- \[x\] 1\./.test(fs.readFileSync(path.join(p, ".specs", f.slug, "change.md"), "utf8")),
  });
  // the plan approved: the same commands print no plan line
  const ap = runIn(["approve", f.slug, "tasks", ...P]);
  const un = runIn(["undone", f.slug, "1", ...P]);
  const nx2 = runIn(["next", f.slug, ...P]), br2 = spawnIn(["brief", f.slug, "1", ...P]), st2 = runIn(["status", f.slug, ...P]);
  const dn2 = await runAsync(["done", f.slug, "1", "--run", ...P]);
  const planLine = (s) => /not approved yet|ticked before the plan/.test(s);
  all("1.42 UX-02 (CLI): once the plan is approved, next / brief / status / done --run print no plan line (got " + js([ap.code, un.code, nx2.out, st2.out, br2.stderr, dn2.out]) + ")", {
    "approved": ap.code === 0, "unticked": un.code === 0, "next": nx2.code === 0 && !planLine(nx2.out), "brief": br2.status === 0 && !planLine(br2.stdout + br2.stderr),
    "status": st2.code === 0 && !planLine(st2.out), "done --run": dn2.code === 0 && !planLine(dn2.out),
  });
};

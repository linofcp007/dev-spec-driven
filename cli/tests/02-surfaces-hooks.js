"use strict";
// CLI surfaces and hooks — the full review's findings on the CLI and the hooks.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// 1.14 full review (S) — CLI surfaces and hooks.
exports.run = ({ ok, run, runIn, tmp, require, __dirname }) => {
  const SF = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const pf = path.join(tmp, "frs-proj");
  runIn(["init", "core", "--project", pf]);
  runIn(["create", "Big", "core", "--project", pf]);
  fs.writeFileSync(path.join(pf, ".specs", "big", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] one\n- [ ] 2. [US1] two\n");
  const tasksOf = () => fs.readFileSync(path.join(pf, ".specs", "big", "tasks.md"), "utf8");

  // S4 — an explicit --include-body=false / --include-brief=false reaches the engine (= spec_finish / spec_task_brief {…: false}).
  const fin0 = jsonOf(runIn(["finish", "big", "--include-body=false", "--json", "--project", pf]));
  const fin1 = jsonOf(runIn(["finish", "big", "--json", "--project", pf]));
  const fin2 = jsonOf(runIn(["finish", "big", "--include-body", "--write", "--json", "--project", pf]));
  const br0 = jsonOf(runIn(["brief", "big", "1", "--include-brief=false", "--json", "--project", pf]));
  const br1 = jsonOf(runIn(["brief", "big", "1", "--json", "--project", pf]));
  ok(fin0 && !("mergeSummary" in fin0) && fin1 && typeof fin1.mergeSummary === "string" && fin2 && typeof fin2.mergeSummary === "string" &&
    br0 && br0.ok && !("brief" in br0) && br1 && typeof br1.brief === "string",
    "full review S4: finish --include-body=false omits mergeSummary and brief --include-brief=false omits the brief, as the MCP tools do with false; absent keeps the default (got " +
    JSON.stringify([fin0 && "mergeSummary" in fin0, fin1 && typeof fin1.mergeSummary, br0 && "brief" in br0]) + ")");

  // S5 — an unknown --flag is a usage error before anything runs (with a did-you-mean); `--` ends the options.
  const typo = runIn(["done", "big", "1", "--rnu", "--project", pf]);
  const typoEq = runIn(["done", "big", "1", "--evidnce=ok", "--project", pf]);
  ok(typo.code === 1 && /unknown option --rnu — did you mean --run\?/.test(typo.out) && typoEq.code === 1 && /unknown option --evidnce — did you mean --evidence\?/.test(typoEq.out) &&
    /^- \[ \] 1\./m.test(tasksOf()),
    "full review S5: done big 1 --rnu (and --evidnce=…) exits 1 with a did-you-mean and ticks nothing — an unknown flag was a silent switch (got " + JSON.stringify([typo.code, typo.out.trim().slice(0, 90)]) + ")");
  runIn(["init", "core", "--lang", "pt", "--project", path.join(tmp, "frs-pt")]);
  const ptTypo2 = runIn(["list", "--jsno", "--project", path.join(tmp, "frs-pt")]);
  ok(ptTypo2.code === 1 && /opção desconhecida --jsno — será --json\?/.test(ptTypo2.out),
    "full review S5: the unknown-option error is localized in the project language (PT) (got " + ptTypo2.out.trim() + ")");
  const dd = runIn(["backlog", "add", "--project", pf, "--", "--later", "plan"]);
  const bl5 = SF.backlog(pf).backlog.map((b) => b.name + "|" + b.note).join();
  ok(dd.code === 0 && bl5 === "--later|plan",
    "full review S5: `--` ends the options — the tokens after it are positional (backlog add -- --later plan) (got " + JSON.stringify([dd.code, bl5, dd.out.trim().slice(0, 80)]) + ")");
  // Every flag the help documents is known (the evals harness's and git log's own flags excepted); --help anywhere prints help.
  // (--json too — but the help itself is text only: `help --json` is a usage error since the 1.22 review, 16-conventions-flags.)
  const helpFlags = [...new Set((runIn(["help"]).out.match(/--[a-z][a-z-]*/g) || []).map((f) => f.slice(2)))]
    .filter((f) => !["flag", "dry-run", "set-baseline", "require-live", "model", "prompt", "max-items", "name-only", "relative", "json"].includes(f)); // (1.23 review: the help names every harness flag)
  const allFlags = runIn(["help", ...helpFlags.map((f) => (f === "lang" ? "--lang=en" : f === "project" ? "--project=" + pf : "--" + f + "=1"))]);
  const helpAnywhere = runIn(["done", "big", "2", "--help", "--project", pf]);
  // (1.24 r6 B-I3: `<command> --help` prints that command's part of the help — done's here — not the whole help)
  ok(helpFlags.length > 50 && allFlags.code === 0 && /universal spec-driven CLI/.test(allFlags.out) && helpAnywhere.code === 0 && /^ {2}done <feature> <n>/m.test(helpAnywhere.out) &&
    /^- \[ \] 2\./m.test(tasksOf()),
    "full review S5: every --flag the help documents (" + helpFlags.length + ") is accepted; done … --help prints done's help and ticks nothing (got " + JSON.stringify([allFlags.code, allFlags.out.trim().split("\n")[0].slice(0, 100)]) + ")");

  // S7 — backlog remove (rm's alias) prints the removal like rm.
  runIn(["backlog", "add", "Zeta Seven", "--project", pf]);
  const rm7 = runIn(["backlog", "remove", "zeta seven", "--project", pf]);
  ok(rm7.code === 0 && /'zeta seven' removed from the backlog/.test(rm7.out) && !/Zeta Seven/.test(runIn(["backlog", "--project", pf]).out),
    "full review S7: backlog remove is rm's alias on the CLI too (removed, same message) (got " + rm7.out.trim().split(/\r?\n/)[0] + ")");

  // S8 — SessionStart lists at most 20 features (the most relevant), then ONE '+N more' line.
  const p8 = path.join(tmp, "frs-many");
  SF.initProject(p8, ["core"], "en");
  for (let i = 1; i <= 22; i++) SF.createFeature(p8, "Feat " + String(i).padStart(2, "0"), ["core"], "", undefined, "en");
  const zz = SF.createFeature(p8, "Zz Active", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(zz.dir, "tasks.md"), "# Tasks\n\n- [x] 1. [US1] one\n- [ ] 2. [US1] two\n");
  const hk = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: p8 }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: p8, SPEC_PROJECT_DIR: p8 } });
  let ctx = "";
  try { ctx = JSON.parse(hk.stdout).hookSpecificOutput.additionalContext; } catch { /* no output */ }
  const bullets = ctx.split("\n").filter((l) => /^ {2}• /.test(l));
  ok(hk.status === 0 && bullets.length === 20 && /• zz-active \[core\] — executing \(1\/2 tasks\)/.test(ctx) && /\+3 more feature\(s\) — \/spec-status/.test(ctx),
    "full review S8: SessionStart with 23 features prints 20 feature lines — the executing one included, though last by name — and '+3 more … /spec-status' (got " + bullets.length + " lines, " + JSON.stringify(ctx.split("\n").slice(-2)) + ")");
};

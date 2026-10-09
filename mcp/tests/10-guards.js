"use strict";
// Guards and hooks — guard mode and the scope guard, the stop gate, the human approval guard.
// The PreToolUse / Stop / SubagentStop hooks, scoped steering, the design.md save check, the approval guard's shell lexer.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, tmp, list, require, __dirname }) => {

  // --- 1.13 WP11: guard mode (PreToolUse hook), scoped steering (front matter, custom files, brief, doctor), design.md save check ---
  {
    const call11 = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); let p; try { p = payload(r); } catch { p = { error: r.result.content[0].text }; } return { isError: r.result.isError === true, p }; };
    const guardJs = path.join(__dirname, "..", "hooks", "guard-hook.js");
    const specHookJs = path.join(__dirname, "..", "hooks", "spec-hook.js");
    // The test runner may itself run inside Claude Code: never let its CLAUDE_PROJECT_DIR leak into the hook.
    const runGuard = (input, env) => spawnSync(process.execPath, [guardJs], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) } });
    const pre = (cwd, tool, input) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: input });
    const asked = (r) => { try { const j = JSON.parse(r.stdout); return j.hookSpecificOutput && j.hookSpecificOutput.hookEventName === "PreToolUse" && j.hookSpecificOutput.permissionDecision === "ask" ? j.hookSpecificOutput.permissionDecisionReason : null; } catch { return null; } };
    const silent = (r) => r.status === 0 && r.stdout === "";
    const writeState = (dir, st) => fs.writeFileSync(path.join(dir, ".state.json"), JSON.stringify(st, null, 2));

    // (F1) spec_init {guard}: with or without tracks, idempotent, always reports the current state; the CLI's value.
    const g = path.join(tmp, "proj-wp11-guard");
    const gi1 = await call11("spec_init", { guard: true, projectDir: g });
    const rmFile = path.join(g, ".specs", "roadmap.json");
    const rm1 = fs.readFileSync(rmFile, "utf8");
    const gi2 = await call11("spec_init", { tracks: ["tdd"], guard: true, projectDir: g });
    const gi3 = await call11("spec_init", { tracks: ["tdd"], projectDir: g });
    ok(!gi1.isError && gi1.p.guard === true && /Guard mode ON/.test(gi1.p.guardNote) && JSON.parse(rm1).meta.guard === true &&
      gi2.p.guard === true && fs.readFileSync(rmFile, "utf8") === rm1 && gi2.p.created.includes("testing-standards.md") && gi3.p.guard === true && gi3.p.guardNote === undefined,
      "spec_init {guard: true} sets roadmap.json meta.guard (no tracks needed); again with tracks → unchanged file; without guard → reports the current state, no note");
    const gBad = await call11("spec_init", { guard: "yes", projectDir: g });
    const gOff = await call11("spec_init", { guard: false, projectDir: g });
    ok(gBad.isError && /guard must be one of: on, off, scope/.test(gBad.p.error) && gOff.p.guard === false && /Guard mode OFF/.test(gOff.p.guardNote) && S.readRoadmap(g).meta.guard === false,
      "spec_init {guard: 'yes'} is an argument error (on | off | scope; the booleans read as on / off); {guard: false} turns it off");
    const gBroken = path.join(tmp, "proj-wp11-broken");
    fs.mkdirSync(path.join(gBroken, ".specs"), { recursive: true });
    fs.writeFileSync(path.join(gBroken, ".specs", "roadmap.json"), "{ nope");
    const gBr = S.initProject(gBroken, ["core"], undefined, { guard: true });
    ok(gBr.ok === false && /not valid JSON/.test(gBr.error) && !fs.existsSync(path.join(gBroken, ".specs", "steering")) && fs.readFileSync(path.join(gBroken, ".specs", "roadmap.json"), "utf8") === "{ nope",
      "spec_init {guard} on a broken roadmap.json refuses before creating anything (the file is left as it was)");

    // (F2) the PreToolUse hook with realistic payloads.
    const gFeat = S.createFeature(g, "Billing", ["tdd"]);
    const code = path.join(g, "src", "billing.ts");
    ok(silent(runGuard(pre(g, "Write", { file_path: code, content: "x" }))), "guard OFF (meta.guard false) → the hook prints nothing and exits 0");
    S.initProject(g, ["core"], undefined, { guard: true });
    const askW = runGuard(pre(g, "Write", { file_path: code, content: "export const x = 1;" }));
    const askReason = asked(askW);
    let oneJson = false;
    try { oneJson = typeof JSON.parse(askW.stdout) === "object" && !/\n./.test(askW.stdout.trim()); } catch { /* not one JSON object */ }
    ok(askW.status === 0 && oneJson && /no approved tasks cover code changes right now/.test(askReason) && /spec_approve/.test(askReason) && /billing/.test(askReason),
      "guard ON + no approved tasks + a code file → exactly one JSON object: permissionDecision 'ask' with the localized reason (names the feature awaiting approval)");
    ok(asked(runGuard(pre(g, "Edit", { file_path: "src/billing.ts", old_string: "a", new_string: "b" }))) &&
      asked(runGuard(pre(g, "NotebookEdit", { notebook_path: path.join(g, "nb", "explore.ipynb"), new_source: "x" }))) && S.guardCheck(g, "lib/x.py", g).decision === "ask",
      "Edit with a path relative to cwd and NotebookEdit (notebook_path) are guarded too");
    ok(silent(runGuard(pre(g, "Write", { file_path: path.join(gFeat.dir, "design.md") }))) && silent(runGuard(pre(g, "Write", { file_path: path.join(g, "README.md") }))) &&
      S.guardCheck(g, path.join(g, "config", "app.json")).why === "not-code" && S.guardCheck(g, path.join(tmp, "elsewhere", "x.ts")).why === "outside" &&
      S.guardCheck(g, path.join(g, "src", ".specs", "x.ts")).why === "specs",
      "guard ON: files inside .specs/, non-code files and files outside the project pass silently");
    // Where the filesystem folds case, `.SPECS/x.ts` IS the spec folder (the engine's isInsideDir reading).
    const foldFs = process.platform === "win32" || process.platform === "darwin";
    const upper = runGuard(pre(g, "Write", { file_path: path.join(g, ".SPECS", "foo", "x.ts") }));
    ok(foldFs ? silent(upper) && S.guardCheck(g, path.join(g, ".SPECS", "foo", "x.ts")).why === "specs" : !!asked(upper),
      "guard: the .specs segment is matched case-insensitively where the filesystem folds case (Windows/macOS), exactly elsewhere");
    const hookEnv = runGuard({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: code } }, { CLAUDE_PROJECT_DIR: g });
    ok(!!asked(hookEnv), "without a payload cwd the project comes from CLAUDE_PROJECT_DIR");
    // Approved + unfinished tasks cover code changes; a forced approval covers them too, but says so.
    writeState(gFeat.dir, { ...S.readState(g, "billing"), approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } });
    ok(silent(runGuard(pre(g, "Write", { file_path: code }))), "guard ON + a feature with approved, unfinished tasks → silent (allowed)");
    writeState(gFeat.dir, { ...S.readState(g, "billing"), approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t", forced: true, failing: ["placeholders"] } } });
    // (1.24 r6 C-I8 shows the note once a session — a marker in the OS temp folder keyed by session_id "s": a previous run of the
    // suite left it, and the note read as already shown. Removed first, so every run starts a fresh session.)
    try { fs.unlinkSync(require("../hooks/hook-utils.js").sessionFlagFile("forced-note", "s")); } catch { /* none */ }
    const forcedOut = runGuard(pre(g, "Write", { file_path: code }));
    let forcedJ = {};
    try { forcedJ = JSON.parse(forcedOut.stdout); } catch { /* none */ }
    ok(forcedOut.status === 0 && !asked(forcedOut) && !forcedJ.hookSpecificOutput && /FORCED tasks approval \(billing\)/.test(forcedJ.systemMessage || ""),
      "a FORCED tasks approval still counts (no ask) — the hook mentions it in a systemMessage, never a permission decision");
    fs.writeFileSync(path.join(gFeat.dir, "tasks.md"), fs.readFileSync(path.join(gFeat.dir, "tasks.md"), "utf8").replace(/- \[ \]/g, "- [x]"));
    writeState(gFeat.dir, { ...S.readState(g, "billing"), approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } });
    const gc1 = S.guardCheck(g, code);
    ok(gc1.decision === "ask" && gc1.why === "no-approved-tasks" && gc1.pending.length === 0 && /no approved tasks cover/.test(gc1.reason) && !/awaiting approval/.test(gc1.reason),
      "approved tasks that are all done no longer cover code changes → ask");
    // A STALE tasks approval covers nothing: tasks appended (spec_append_tasks) or edited after it — the approval's
    // fingerprint no longer matches tasks.md — keep the guard asking until the tasks phase is re-approved. Ticking a
    // box is progress, not an edit (the fingerprint normalizes checkboxes).
    const tasksFp = (file) => require("crypto").createHash("sha1").update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^(\s*-\s*\[)[xX](\])/gm, "$1 $2")).digest("hex");
    const gTasks = path.join(gFeat.dir, "tasks.md");
    writeState(gFeat.dir, { ...S.readState(g, "billing"), approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t", fingerprint: tasksFp(gTasks) } } });
    const gApp = S.appendTasks(g, "billing", [{ text: "Anything" }]);
    const gStale = S.guardCheck(g, code);
    const staleHook = asked(runGuard(pre(g, "Edit", { file_path: code, old_string: "a", new_string: "b" })));
    writeState(gFeat.dir, { ...S.readState(g, "billing"), approvals: { tasks: { at: "2026-01-02T00:00:00Z", by: "t", fingerprint: tasksFp(gTasks) } } });
    const gReapproved = S.guardCheck(g, code);
    const gOpenNum = S.taskBlocks(fs.readFileSync(gTasks, "utf8")).find((b) => !b.done).number;
    S.completeTask(g, "billing", gOpenNum, { summary: "checked by hand" });
    fs.appendFileSync(gTasks, "\n- [ ] 99. Rewrite everything\n"); // a hand-added open task on an approved list
    const gHand = S.guardCheck(g, code);
    ok(gApp.ok && gApp.needsReapproval === true && gStale.decision === "ask" && gStale.stale.join() === "billing" && gStale.pending.length === 0 &&
      /Tasks changed after their approval/.test(gStale.reason) && /billing/.test(staleHook || "") &&
      gReapproved.decision === "allow" && gReapproved.why === "approved" && gHand.decision === "ask" && gHand.stale.join() === "billing",
      "guard: tasks appended or hand-added after the tasks approval → the stale approval doesn't cover code changes (ask, names it); re-approved → allowed");
    const gArch = S.createFeature(g, "Old Work", ["core"]);
    writeState(gArch.dir, { ...S.readState(g, "old-work"), approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } });
    const gc2 = S.guardCheck(g, code);
    S.manageFeature(g, "archive", "old-work");
    ok(gc2.decision === "allow" && gc2.covering.join() === "old-work" && S.guardCheck(g, code).decision === "ask",
      "an archived feature's approved tasks don't cover code changes (only non-archived features count)");
    ok(silent(runGuard("not json at all")) && silent(runGuard({ hook_event_name: "PreToolUse", cwd: g, tool_input: { file_path: 42 } })), "a non-JSON payload or a non-string path → silent exit 0");
    fs.writeFileSync(rmFile, "{ broken json");
    ok(silent(runGuard(pre(g, "Write", { file_path: code }))) && S.guardCheck(g, code).decision === "allow" && S.guardEnabled(g) === false,
      "a broken roadmap.json → silent exit 0 (the guard never blocks on its own errors)");
    const gPt = path.join(tmp, "proj-wp11-guard-pt");
    S.initProject(gPt, ["core"], "pt", { guard: true });
    S.createFeature(gPt, "Pagamentos", ["core"]);
    ok(/nenhuma tarefa aprovada cobre alterações de código/.test(asked(runGuard(pre(gPt, "Write", { file_path: path.join(gPt, "app.py") }))) || ""),
      "the ask reason is in the PROJECT language (PT)");
    const hooksCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8")).hooks;
    const preCfg = (hooksCfg.PreToolUse || [])[0] || {};
    // (1.23 review 5: MultiEdit is no Claude Code tool any more — a dead entry; the engine still reads a MultiEdit payload)
    // (1.25.1: every hook in exec form — `node` + the script as its one argument, no shell per spawn: hookScript reads it)
    // (1.25.1 review 7: + the shell tools — the files a Bash / PowerShell / Monitor command writes)
    const hookScript = (h) => (h && h.command === "node" && Array.isArray(h.args) && h.args.length === 1 ? h.args[0] : "");
    ok(preCfg.matcher === "Write|Edit|NotebookEdit|Bash|PowerShell|Monitor" && hookScript(preCfg.hooks[0]) === "${CLAUDE_PLUGIN_ROOT}/hooks/guard-hook.js" && preCfg.hooks[0].timeout === 10 &&
      hooksCfg.PostToolUse && hooksCfg.SessionStart && !fs.readFileSync(guardJs, "utf8").includes(String.fromCharCode(0xfeff)),
      "hooks.json wires the guard as PreToolUse (Write|Edit|NotebookEdit|Bash|PowerShell|Monitor, timeout 10) beside the existing hooks; no literal BOM in guard-hook.js");

    // (H3) zero-dep glob + Kiro-compatible front matter.
    const globCases = [["src/api/**", "src/api/users.ts", true], ["src/api/**", "src/apix/users.ts", false], ["src/api/**", "src/lib/x.ts", false],
      ["**/*.ts", "a.ts", true], ["**/*.ts", "a/b/c.ts", true], ["**/*.ts", "a/b/c.tsx", false], ["src/*.js", "src/a.js", true], ["src/*.js", "src/a/b.js", false],
      ["src/?.js", "src/a.js", true], ["src/?.js", "src/ab.js", false], ["src/**/*.{ts,tsx}", "src/a/b.tsx", true], ["src/**/*.{ts,tsx}", "src/a/b.js", false],
      ["{src,lib}/**", "lib/x/y.js", true], ["src/{a,b/{c,d}}/*.js", "src/b/d/x.js", true], ["src/{a,b/{c,d}}/*.js", "src/b/e/x.js", false],
      ["src/{a/x.js", "src/{a/x.js", true], ["./src/**", "src/x.js", true], ["src\\api\\**", "src/api/x.js", true], ["src/**/test.js", "src/test.js", true],
      ["src/a.js", "src/a.js", true], ["src/a.js", "src/aXjs", false], ["", "src/a.js", false]];
    const globBad = globCases.filter(([gp, fp, want]) => S.steeringGlobMatch(gp, fp) !== want).map(([gp, fp]) => gp + " ~ " + fp);
    ok(globBad.length === 0, "steeringGlobMatch: ** · * · ? · {a,b} (nested, unbalanced = literal) · ./ and backslashes normalized (wrong: " + globBad.join(" | ") + ")");
    const fmA = S.steeringFrontMatter("\uFEFF---\r\ninclusion: fileMatch\r\nfileMatchPattern: [\"src/api/**\", 'lib/{a,b}/**'] # two\r\n---\r\n# Body\r\ntext");
    const fmB = S.steeringFrontMatter("---\n# a comment\ninclusion: \"manual\" # why\nfileMatchPattern:\n  - \"a/**\"\n  - b/**\n---\n\nbody");
    const fmC = S.steeringFrontMatter("---\ntitle: x\n---\nb");
    const fmD = S.steeringFrontMatter("# Plain\n---\ninclusion: manual\n---\n");
    const fmE = S.steeringFrontMatter("---\nSome intro prose under a rule.\n\n---\n# Title\n");
    ok(fmA.frontMatter && fmA.inclusion === "fileMatch" && fmA.patterns.join("|") === "src/api/**|lib/{a,b}/**" && fmA.body === "# Body\ntext" &&
      fmB.inclusion === "manual" && fmB.patterns.join("|") === "a/**|b/**" && fmB.body === "body" && fmC.inclusion === "always" &&
      S.steeringFrontMatter("---\ninclusion: auto\n---\nx").inclusion === "manual" && !fmD.frontMatter && fmD.inclusion === null && fmD.body.startsWith("# Plain") &&
      !fmE.frontMatter && fmE.body.startsWith("---\nSome intro") && !S.steeringFrontMatter("---\n# Heading\n---\ntext").frontMatter,
      "steeringFrontMatter: CRLF + BOM + quoted list (a comma inside {…} doesn't split), YAML '- item' lists, comments; no inclusion → always; unknown (auto) → manual; front matter only at the top, and only YAML-looking (a '---' rule over prose is not)");
    // Block scalars / nested maps are valid YAML front matter: their indented lines are continuations, never keys.
    const fmF = S.steeringFrontMatter("---\ninclusion: manual\ndescription: |\n  API conventions. Use when\n  inclusion: always\nmeta:\n  owner: api-team\nfileMatchPattern:\n  - src/api/**\n---\n# Rules\n- Real rule.\n");
    ok(fmF.frontMatter && fmF.inclusion === "manual" && fmF.patterns.join() === "src/api/**" && fmF.body === "# Rules\n- Real rule.\n" &&
      !S.steeringFrontMatter("---\n  indented prose first\nkey: v\n---\nx").frontMatter,
      "steeringFrontMatter: a 'description: |' block scalar and a nested map are continuation lines (an indented 'inclusion: always' inside one is ignored); the first line must still be a key");
    // The glob is a linear DP (no backtracking regex): pathological user patterns answer at once.
    const tGlob = Date.now();
    const globFast = S.steeringGlobMatch("**/".repeat(12) + "x.ts", "a/".repeat(25) + "y.ts") === false && S.steeringGlobMatch("**/".repeat(12) + "x.ts", "a/".repeat(25) + "x.ts") === true &&
      S.steeringGlobMatch("*a*a*a*a*a*a*a*b", "a".repeat(40)) === false && S.steeringGlobMatch("*a*a*a*a*a*a*a*b", "a".repeat(40) + "b") === true &&
      S.steeringGlobMatch("a/**/**/b.ts", "a/b.ts") === true && S.steeringGlobMatch("{a,b}".repeat(9), "ab".repeat(4) + "a") === false;
    ok(globFast && Date.now() - tGlob < 1000, "steeringGlobMatch: repeated '**/' and '*a*a*…' patterns against deep paths answer in well under a second (was minutes); > 256 brace alternatives → no match");

    // (H3) spec_task_brief: default files, always, fileMatch on _Implements:_ (quoted, front matter stripped), manual listed.
    const b11 = path.join(tmp, "proj-wp11-brief");
    S.initProject(b11, ["core"], "en");
    const bf = S.createFeature(b11, "Api", ["core"]);
    const stDir = path.join(b11, ".specs", "steering");
    fs.writeFileSync(path.join(stDir, "api-rules.md"), "\uFEFF---\r\ninclusion: fileMatch\r\nfileMatchPattern: [\"src/api/**\", 'src/routes/*.{ts,js}']\r\n---\r\n# API rules\r\n\r\n- Every handler validates its input with zod.\r\n");
    fs.writeFileSync(path.join(stDir, "ui-rules.md"), "---\ninclusion: fileMatch\nfileMatchPattern: \"src/ui/**\"\n---\n# UI\n- Use the design tokens.\n");
    fs.writeFileSync(path.join(stDir, "security.md"), "---\ninclusion: always\n---\n# Security\n- No secrets in logs.\n");
    fs.writeFileSync(path.join(stDir, "release.md"), "---\ninclusion: manual\n---\n# Release\n- Tag every release.\n");
    fs.writeFileSync(path.join(stDir, "notes.md"), "# Notes (no front matter, not a default file)\n- stays out\n");
    fs.writeFileSync(path.join(stDir, "tech.md"), "---\ninclusion: manual\n---\n# Tech\n- Node 20\n");
    S.scaffoldSteeringFile(b11, "api-todo.md"); // the custom stub: fileMatch src/api/** but still placeholders
    fs.writeFileSync(path.join(bf.dir, "tasks.md"), "- [ ] 1. [US1] Add the users endpoint\n  - _Implements: src/api/users.ts, ./src/routes/index.js_\n- [ ] 2. [US1] Docs\n  - _Implements: docs/guide.md_\n");
    const br1 = (await call11("spec_task_brief", { name: "api", number: 1, projectDir: b11 })).p;
    const inc = (b) => b.steering.included.map((s) => s.file.replace(".specs/steering/", "") + ":" + s.inclusion).join(",");
    const apiRow = br1.steering.included.find((s) => /api-rules/.test(s.file)) || {};
    const todoRow = br1.steering.included.find((s) => /api-todo/.test(s.file)) || {};
    ok(inc(br1) === "constitution.md:always,structure.md:always,api-rules.md:fileMatch,api-todo.md:fileMatch,security.md:always" &&
      br1.steering.manual.join() === ".specs/steering/tech.md,.specs/steering/release.md" &&
      apiRow.matched.join() === "src/api/users.ts,src/routes/index.js" && apiRow.quoted === true && todoRow.quoted === false,
      "task brief steering: defaults without front matter = always, tech.md with 'manual' drops out, fileMatch included only when an _Implements:_ path matches, always included, manual listed; no-front-matter extras stay out (got " + inc(br1) + ")");
    const brText = br1.brief.split("## Global constraints")[1] || "";
    ok(/Read before coding: .*`\.specs\/steering\/api-rules\.md`.*`\.specs\/steering\/security\.md`/.test(brText) &&
      /Scoped steering \(fileMatch — matches this task's files\):/.test(brText) && /> - Every handler validates its input with zod\./.test(brText) &&
      !/inclusion:|fileMatchPattern:/.test(br1.brief) && !/A rule every file matching/.test(br1.brief) && /Available on request \(manual steering\): `\.specs\/steering\/tech\.md`, `\.specs\/steering\/release\.md`/.test(brText),
      "the brief quotes the matching fileMatch file with its front matter stripped (a placeholder-only stub is listed, never quoted) and lists manual files as available on request");
    const br2 = S.taskBrief(b11, "api", 2);
    ok(inc(br2) === "constitution.md:always,structure.md:always,security.md:always" && !/Scoped steering/.test(br2.brief),
      "a task whose files match no pattern gets no fileMatch steering");
    // _Implements:_ read like trace_check / coverage: backticks dropped, an absolute in-project path made relative
    // (outside the project → nothing). A filled custom stub is quoted WITHOUT its guidance comment. A block-scalar
    // front matter saying manual keeps tech.md out.
    fs.unlinkSync(path.join(stDir, "api-todo.md"));
    const filled = S.scaffoldSteeringFile(b11, "api-filled.md");
    fs.writeFileSync(filled.file, fs.readFileSync(filled.file, "utf8").replace(/^- \[[^\]\n]*\]$/gm, "- Handlers return RFC 7807 errors."));
    fs.writeFileSync(path.join(stDir, "tech.md"), "---\ninclusion: manual\ndescription: |\n  Stack notes. Read when\n  touching the build.\n---\n# Tech\n- Node 20\n");
    fs.writeFileSync(path.join(bf.dir, "tasks.md"), "- [ ] 1. [US1] Add the users endpoint\n  - _Implements: `src/api/users.ts`_\n- [ ] 2. [US1] UI\n  - _Implements: " +
      path.join(b11, "src", "ui", "list.tsx") + ", " + path.join(tmp, "elsewhere", "src", "api", "x.ts") + "_\n");
    const br3 = S.taskBrief(b11, "api", 1);
    const br4 = S.taskBrief(b11, "api", 2);
    const filledRow = br3.steering.included.find((s) => /api-filled/.test(s.file)) || {};
    ok(inc(br3) === "constitution.md:always,structure.md:always,api-filled.md:fileMatch,api-rules.md:fileMatch,security.md:always" && filledRow.quoted === true &&
      br3.steering.manual.join() === ".specs/steering/tech.md,.specs/steering/release.md" &&
      inc(br4) === "constitution.md:always,structure.md:always,security.md:always,ui-rules.md:fileMatch" && (br4.steering.included.find((s) => /ui-rules/.test(s.file)) || {}).matched.join() === "src/ui/list.tsx",
      "brief steering: a backticked _Implements:_ path matches, an absolute in-project path matches as its relative path, an outside one matches nothing; block-scalar 'manual' stays manual (got " + inc(br3) + " / " + inc(br4) + ")");
    ok(/> - Handlers return RFC 7807 errors\./.test(br3.brief) && !/<!--|-->|Replace the example pattern/.test(br3.brief) && !/>\s*\n>\s*\n>/.test(br3.brief),
      "a filled custom stub is quoted without its HTML guidance comment (no '<!--', no 'Replace the example pattern', no run of empty quote lines)");
    // The quote is read as a markdown reader sees it: a comment inside fenced code or an `inline code span` is
    // CONTENT and survives (a regex strip turned "never write `<!-- -->`" into "never write ``"); the stub's
    // guidance comment still goes, in every language.
    const q11 = path.join(tmp, "proj-wp11-quote");
    S.initProject(q11, ["core"], "en");
    const qf = S.createFeature(q11, "Ui", ["core"]);
    const qDir = path.join(q11, ".specs", "steering");
    fs.writeFileSync(path.join(qDir, "ui-jsx.md"), "---\ninclusion: fileMatch\nfileMatchPattern: \"src/ui/**\"\n---\n# JSX rules\n- Never write `<!-- -->` comments in JSX; use `{/* */}` instead.\n- A doc comment starts with `<!--` on its own line.\n");
    fs.writeFileSync(path.join(qDir, "ui-partials.md"), "---\r\ninclusion: fileMatch\r\nfileMatchPattern: \"src/ui/**\"\r\n---\r\n# Template rules\r\n- Every partial starts with a marker comment naming it:\r\n\r\n```html\r\n<!-- partial: header -->\r\n<header></header>\r\n```\r\n- Keep partials short. <!-- a note for maintainers -->\r\n");
    for (const [lang, nm] of [["en", "ui-en.md"], ["pt", "ui-pt.md"], ["es", "ui-es.md"]]) {
      const st = S.scaffoldSteeringFile(q11, nm, lang);
      fs.writeFileSync(st.file, fs.readFileSync(st.file, "utf8").replace(/src\/api\/\*\*/, "src/ui/**").replace(/^- \[[^\]\n]*\]$/gm, "- Rule " + lang + "."));
    }
    fs.writeFileSync(path.join(qf.dir, "tasks.md"), "- [ ] 1. [US1] t\n  - _Implements: src/ui/a.tsx_\n");
    const qb = S.taskBrief(q11, "ui", 1);
    const qRows = qb.steering.included.filter((s) => /ui-/.test(s.file));
    const qText = qb.brief.split("## Global constraints")[1] || "";
    ok(qRows.length === 5 && qRows.every((s) => s.quoted === true) &&
      qText.includes("> - Never write `<!-- -->` comments in JSX; use `{/* */}` instead.") && qText.includes("> - A doc comment starts with `<!--` on its own line.") &&
      /> ```html\n> <!-- partial: header -->\n> <header><\/header>\n> ```/.test(qText) && qText.includes("> - Keep partials short.") && !/maintainers/.test(qText) &&
      ["en", "pt", "es"].every((l) => qText.includes("> - Rule " + l + ".")) && !/Replace the example pattern|Substitui o padrão|Sustituye el patrón|inclusion: always/.test(qText),
      "brief steering quotes keep a '<!--' inside fenced code or an inline code span (and an unclosed one in backticks); an inline trailing comment and the EN/PT/ES stub guidance comment are removed (got " + qRows.map((s) => s.file + ":" + s.quoted).join(",") + ")");

    // (H4) steering_scaffold custom names: localized stub with front matter; known names keep their templates; rejections.
    const c11 = path.join(tmp, "proj-wp11-custom");
    fs.mkdirSync(c11, { recursive: true }); // a projectDir names an existing folder (1.24 r6 A3 — only spec_init creates one)
    const cs1 = (await call11("steering_scaffold", { file: "api-conventions.md", projectDir: c11 })).p;
    const csText = fs.readFileSync(path.join(c11, ".specs", "steering", "api-conventions.md"), "utf8");
    const csFm = S.steeringFrontMatter(csText);
    const cs2 = (await call11("steering_scaffold", { file: "api-conventions.md", projectDir: c11 })).p;
    const csPt = (await call11("steering_scaffold", { file: "regras-ui.md", lang: "pt", projectDir: c11 })).p;
    const csPtText = fs.readFileSync(path.join(c11, ".specs", "steering", "regras-ui.md"), "utf8");
    const csKnown = (await call11("steering_scaffold", { file: "scale.md", projectDir: c11 })).p;
    ok(cs1.ok && cs1.created && cs1.custom === true && csFm.inclusion === "fileMatch" && csFm.patterns.join() === "src/api/**" && /^# Api Conventions$/m.test(csText) &&
      S.artifactState({ text: csFm.body }) === "placeholder" && cs2.ok && cs2.created === false && fs.readFileSync(path.join(c11, ".specs", "steering", "api-conventions.md"), "utf8") === csText &&
      csPt.custom && /^## Regras$/m.test(csPtText) && /Steering com âmbito/.test(csPtText) && csKnown.custom === undefined && /# Scale Targets/.test(fs.readFileSync(csKnown.file, "utf8")),
      "steering_scaffold: a custom name → a localized stub with front matter (inclusion: fileMatch + example pattern), never overwritten; known names keep their templates");
    const rejects = [];
    for (const nm of ["nul.md", "com1.md", "constructor.md", "../evil.md", "a/b.md", "a\\b.md", "Api.md", "-lead.md", "notes.txt", "x".repeat(64) + ".md", "__proto__", "toString"]) {
      const r = await call11("steering_scaffold", { file: nm, projectDir: c11 });
      if (!(r.isError && r.p.ok === false)) rejects.push(nm);
    }
    const nulErr = (await call11("steering_scaffold", { file: "nul.md", projectDir: c11 })).p.error;
    const badErr = (await call11("steering_scaffold", { file: "Api.md", projectDir: c11 })).p.error;
    const longOk = (await call11("steering_scaffold", { file: "x".repeat(63) + ".md", projectDir: c11 })).p;
    ok(rejects.length === 0 && /reserved name/.test(nulErr) && /Unknown steering file 'Api\.md'/.test(badErr) && /custom scoped steering file/.test(badErr) && longOk.ok && longOk.custom &&
      !fs.readdirSync(path.join(c11, ".specs", "steering")).some((n) => ["nul.md", "com1.md", "constructor.md", "Api.md", "-lead.md", "notes.txt"].includes(n)) && !fs.existsSync(path.join(c11, ".specs", "evil.md")),
      "custom steering names are refused when unsafe: device names (nul/com1), prototype keys, separators/'..', uppercase, a leading '-', non-.md, > 63 chars (rejected: " + rejects.join(", ") + ")");

    // (H5) doctor: the steering check warns about steering files still holding template placeholders.
    const docSt = (dir, name) => S.specDoctor(dir, name).checks.find((c) => c.id === "steering");
    const d11 = path.join(tmp, "proj-wp11-doctor");
    S.initProject(d11, ["saas"], "en");
    S.createFeature(d11, "Dash", ["saas"]);
    const ds1 = docSt(d11, "dash");
    ok(ds1.status === "warn" && /still template placeholders: /.test(ds1.detail) && /constitution\.md \(\d+\)/.test(ds1.detail) && /observability\.md(?! \()/.test(ds1.detail),
      "doctor steering: fresh stubs → warn naming each placeholder-only file (count; a verbatim template without brackets is named too)");
    const dSt = path.join(d11, ".specs", "steering");
    for (const n of fs.readdirSync(dSt)) fs.writeFileSync(path.join(dSt, n), "# " + n + "\n\n- A real, project-specific rule.\n");
    const ds2 = docSt(d11, "dash");
    S.scaffoldSteeringFile(d11, "api-rules.md");
    fs.unlinkSync(path.join(dSt, "tech.md"));
    const ds3 = docSt(d11, "dash");
    ok(ds2.status === "pass" && ds2.detail === "core steering present (incl. constitution)" && ds3.status === "warn" && ds3.detail === "missing: tech.md; still template placeholders: api-rules.md (2)",
      "filled steering → pass; a custom stub still holding placeholders (front matter set aside) and a missing core file are both reported");
    const d11pt = path.join(tmp, "proj-wp11-doctor-pt");
    S.initProject(d11pt, ["core"], "pt");
    S.createFeature(d11pt, "Painel", ["core"]);
    ok(/ainda com placeholders do template: .*constitution\.md/.test(docSt(d11pt, "painel").detail), "the doctor steering detail is localized (PT)");

    // (D4) PostToolUse: saving design.md runs its mandatory checks for the ACTIVE tracks (EN + PT).
    const runPost = (file) => { const r = spawnSync(process.execPath, [specHookJs], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: file } }), encoding: "utf8" });
      try { return JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch { return ""; } };
    const e11 = path.join(tmp, "proj-wp11-design");
    S.initProject(e11, ["saas"], "en");
    const ef = S.createFeature(e11, "Metrics", ["saas"]);
    const dz1 = runPost(path.join(ef.dir, "design.md"));
    ok(/^Design check on design\.md \(metrics \[core \+saas\]\):/.test(dz1) && /\[SaaS\] sections: Performance Budget:unfilled; Scale Design:unfilled/.test(dz1) &&
      /Constitution Check: not filled in/.test(dz1) && /\d+ template placeholder\(s\) left: L\d+ /.test(dz1) && /\/spec-doctor metrics/.test(dz1) && !/Roadmap updated/.test(dz1),
      "hook on design.md (EN template): unfilled [SaaS] sections, the Constitution Check and the placeholders, with a doctor hint");
    // 1.17 A1: a filled design weighs its choices too — without these two sections the save check adds a ▲ note each (1.19 R1: and it
    // names what it reuses — Reuse & Integration).
    const cleanDesign = "# Design: Metrics\n\n## Overview\nPush counters to Prometheus.\n\n```mermaid\nflowchart LR\n  A-->B\n```\n\n" +
      "## Reuse & Integration\n- Reuse the existing metrics client (src/lib/metrics.ts).\n\n" +
      "## Alternatives & Trade-offs\n- Push to a gateway — simple, but a single point of failure.\n- Scrape an endpoint — chosen: no extra hop.\n\n## Risks\n- Cardinality blow-up — medium — label allow-list.\n\n" +
      "## Constitution Check\n- Principle 1: idempotent writes — respected.\n\n" +
      ["Performance Budget", "Scale Design", "Multi-tenancy", "Observability", "Cost Envelope"].map((s) => `## [SaaS] ${s}\nConcrete content for ${s}.\n`).join("\n");
    fs.writeFileSync(path.join(ef.dir, "design.md"), cleanDesign);
    const dz2 = runPost(path.join(ef.dir, "design.md"));
    fs.writeFileSync(path.join(ef.dir, "design.md"), cleanDesign.replace(/## Constitution Check\n[^\n]*\n/, ""));
    const dz3 = runPost(path.join(ef.dir, "design.md"));
    ok(dz2 === "Design check [core +saas]: mandatory sections and the Constitution Check filled, no template placeholders ✓" &&
      /Constitution Check: missing/.test(dz3) && !/\[SaaS\] sections/.test(dz3), "a filled design → one clean line; without the Constitution Check section → 'missing'");
    fs.writeFileSync(path.join(ef.dir, "design.md"), cleanDesign.replace("Concrete content for Observability.", "> **TODO** fill me"));
    const dzTodo = S.designSaveCheck(e11, "metrics");
    S.addTrack(e11, "metrics", "saas", { remove: true });
    const dzOff = S.designSaveCheck(e11, "metrics");
    ok(dzTodo.sections.length === 1 && dzTodo.sections[0].sections.map((s) => s.section + ":" + s.status).join() === "Observability:unfilled" && dzOff.ok && dzOff.sections.length === 0 && dzOff.clean,
      "designSaveCheck follows the ACTIVE tracks: a TODO sentinel marks [SaaS] Observability unfilled; once +saas is removed its sections (and TODO) are not required");
    const ptF = S.createFeature(e11, "Faturação", ["saas"], undefined, undefined, "pt");
    const dzPt = runPost(path.join(ptF.dir, "design.md"));
    ok(/^Verificação do design em design\.md \(faturacao \[core \+saas\]\):/.test(dzPt) && /secções \[SaaS\]: Orçamento de Desempenho:por preencher/.test(dzPt) &&
      /Verificação da Constituição: por preencher/.test(dzPt) && /placeholder\(s\) do template por substituir/.test(dzPt) && /Preenche-os antes de aprovar o design/.test(dzPt),
      "hook on design.md is localized in the feature's language (PT)");
    const bugF = S.createFeature(e11, "Crash On Save", ["tdd"], undefined, undefined, undefined, "bugfix");
    fs.writeFileSync(path.join(bugF.dir, "design.md"), "# Design: Crash On Save\n\n## Notes\nThe fix stays inside the save handler.\n");
    const dzBug = S.designSaveCheck(e11, "crash-on-save");
    ok(dzBug.ok && dzBug.kind === "bugfix" && dzBug.constitution === null && dzBug.clean && dzBug.text === "Design check [core +tdd]: mandatory sections filled, no template placeholders ✓",
      "a bugfix's design.md is not asked for a Constitution Check (bug.md's Root Cause replaces the design)");
    // A design.md that is not an active feature's (archived, steering/) gets no design check. 1.24 r6 I-I1: it reported the roadmap
    // refresh; the save now only marks the roadmap stale (refreshed at the end of the turn) — nothing to say.
    S.createFeature(e11, "Old Design", ["core"]);
    S.manageFeature(e11, "archive", "old-design");
    const dzArch = runPost(path.join(e11, ".specs", "_archive", "old-design", "design.md"));
    ok(dzArch === "" && S.roadmapStale(e11) === true, "hook on an ARCHIVED feature's design.md → no design check, silent; the roadmap is marked stale (got " + JSON.stringify(dzArch.slice(0, 80)) + ")");
  }

  { // 1.14 C1 — the end-of-turn evidence gate (stopCheck, hooks/stop-hook.js on Stop / SubagentStop) and the scope guard (meta.guard "scope")
    const c1Call = async (tool, args) => { const r = await rpc("tools/call", { name: tool, arguments: args }); let p; try { p = payload(r); } catch { p = { error: r.result.content[0].text }; } return { isError: r.result.isError === true, p }; };
    const c1Dir = (n) => path.join(tmp, "c1-" + n);
    const c1State = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
    const c1SetState = (f, patch) => fs.writeFileSync(path.join(f.dir, ".state.json"), JSON.stringify({ ...c1State(f), ...patch }, null, 2));
    const c1Tasks = (f, text) => fs.writeFileSync(path.join(f.dir, "tasks.md"), text);
    const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    const ageTasks = (f, h) => { const t = (Date.now() - h * 3600 * 1000) / 1000; fs.utimesSync(path.join(f.dir, "tasks.md"), t, t); };
    const stopJs = path.join(__dirname, "..", "hooks", "stop-hook.js");
    const guardJs = path.join(__dirname, "..", "hooks", "guard-hook.js");
    // The runner may itself run inside Claude Code: its CLAUDE_PROJECT_DIR must never leak into the hooks.
    const runHook = (js, input) => spawnSync(process.execPath, [js], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
    const stopPayload = (cwd, message, extra) => ({ session_id: "s1", prompt_id: "550e8400-e29b-41d4-a716-446655440000", transcript_path: path.join(cwd, "no-transcript.jsonl"),
      cwd, permission_mode: "default", hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: message, effort: { level: "medium" }, ...(extra || {}) });
    const blocked = (r) => { try { const j = JSON.parse(r.stdout); return r.status === 0 && j.decision === "block" && typeof j.reason === "string" && Object.keys(j).length === 2 ? j.reason : null; } catch { return null; } };
    const silent = (r) => r.status === 0 && r.stdout === "";

    // --- C1.1 claims: EN / PT / ES, conservative (negations, conditions, questions, code and quotes claim nothing; an admission is honest).
    const claimYes = ["Done — all tests pass.", "Task 3 is done.", "I've implemented the parser; 14/14 passing.", "**Status:** DONE\nCommits: abc1234 feat", "Everything works now.",
      "It's complete.", "Feito. Todos os testes passam.", "A tarefa 2 está concluída.", "Terminei a tarefa 2.", "Listo, todas las pruebas pasan.", "La tarea 2 está terminada.", "Hecho.", "Todo listo."];
    const claimNo = ["I renamed the variable.", "The tests are not passing yet.", "Should I mark task 3 done?", "Once the tests pass, I'll mark it complete.", "Nothing is done yet.",
      "I'll verify it next.", "```\nall tests pass\n```\nI ran it.", "> Done — all tests pass (the user's words)", "Let me know when you're done.", "Não está feito ainda.",
      "Os testes ainda não passam.", "El hecho de que falle es raro.", "Todavía no está terminado.", "The unfinished work is in src/x.js."];
    const cYes = claimYes.filter((m) => !(S.stopClaims(m).claim && !S.stopClaims(m).admitted));
    const cNo = claimNo.filter((m) => S.stopClaims(m).claim);
    const adm = ["Tests pass locally; task 3 is not verified.", "Done. 12 passing, 2 failing.", "Feito, mas a tarefa 2 está por verificar.", "Listo, pero la tarea 2 sigue sin verificar."].filter((m) => !S.stopClaims(m).admitted);
    ok(!cYes.length && !cNo.length && !adm.length,
      "C1 stopClaims: EN/PT/ES completion and verification claims are found; negated / conditional / question / fenced / quoted ones are not; 'not verified' / 'N failing' / 'por verificar' / 'sin verificar' are admissions (missed: " +
      JSON.stringify(cYes) + ", false: " + JSON.stringify(cNo) + ", not admitted: " + JSON.stringify(adm) + ")");

    // --- C1.1 stopCheck matrix.
    const pEn = c1Dir("en");
    S.initProject(pEn, ["core"], "en");
    const fEn = S.createFeature(pEn, "Billing", ["core"], "", undefined, "en");
    c1Tasks(fEn, "- [ ] 1. [US1] Charge the card\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Refund\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. [US1] Receipt\n");
    S.completeTask(pEn, "billing", 1); // ticked with no evidence — its _Verify:_ holds a runnable command
    S.completeTask(pEn, "billing", 3, { summary: "checked the PDF by hand" });
    const claimMsg = "Done — all tests pass and everything is verified.";
    const sBlock = S.stopCheck(pEn, { message: claimMsg });
    const sNoClaim = S.stopCheck(pEn, { message: "I renamed the variable in src/billing.js." });
    const sActive = S.stopCheck(pEn, { message: claimMsg, stopHookActive: true });
    const sAdmit = S.stopCheck(pEn, { message: "Done, but task 1 is not verified yet." });
    ok(sBlock.ok && sBlock.block === true && sBlock.why === "unverified" && sBlock.features.length === 1 && sBlock.features[0].feature === "billing" &&
      JSON.stringify(sBlock.features[0].unverified) === JSON.stringify([{ number: 1, reason: "no-evidence" }]) &&
      /^dev-spec evidence gate: your last message says the work is done or verified, but tasks are ticked without verification evidence:\n {2}- billing: #1 \(no evidence\)\n/.test(sBlock.reason) &&
      // (1.22 review 2: a task with several _Verify:_ commands is recorded as ONE run of all of them — the rule accepts nothing less)
      /read each listed task's _Verify:_ command in \.specs\/billing\/tasks\.md \(task 1 first\) — a task with several: all of them, in ONE run joined with ` && ` —, run it on the final code only if it is safe to run/.test(sBlock.reason) && !/--run/.test(sBlock.reason) &&
      /spec_complete_task \{name, number, evidence: \{command, exitCode, summary\}\}/.test(sBlock.reason) && /say plainly/.test(sBlock.reason) &&
      sNoClaim.block === false && sNoClaim.why === "no-claim" && sActive.block === false && sActive.why === "stop-hook-active" && sAdmit.block === false && sAdmit.why === "admitted",
      "C1 stopCheck: a claim + a recently ticked task without evidence → block, naming the feature, the task and its reason and what to do (read the _Verify:_ in tasks.md, run it if safe, record it with spec_complete_task / say it plainly); no claim, stop_hook_active or an honest admission → allowed; the reason never hands over a `--run` command (got " +
      JSON.stringify([sBlock.why, sBlock.features, sNoClaim.why, sActive.why, sAdmit.why]) + ")");
    // Every reason verificationStatus reports: a failed run, a note on a runnable _Verify:_, an unexpected pass (_Expect: fail_), stale evidence.
    c1Tasks(fEn, "- [x] 1. [US1] Charge the card\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Refund\n  - _Verify: node -e \"process.exit(0)\"_\n- [x] 3. [US1] Receipt\n" +
      "- [ ] 4. [US1] Write T-01 red\n  - _Verify: node t.js_\n  - _Expect: fail_\n- [ ] 5. [US1] Export\n  - _Verify: node e.js_\n");
    S.completeTask(pEn, "billing", 1, { command: "node -e \"process.exit(0)\"", exitCode: 1, summary: "1 failing" }); // a failed re-check of a ticked task
    S.completeTask(pEn, "billing", 2, { summary: "looked fine" }); // a note on a runnable _Verify:_
    S.completeTask(pEn, "billing", 4, { command: "node t.js", exitCode: 0 }); // refused (unexpected pass), recorded
    c1Tasks(fEn, fs.readFileSync(path.join(fEn.dir, "tasks.md"), "utf8").replace("- [ ] 4.", "- [x] 4.")); // …then ticked by hand
    S.completeTask(pEn, "billing", 5, { command: "node e.js", exitCode: 0 });
    c1SetState(fEn, { evidence: { ...c1State(fEn).evidence, 5: { ...c1State(fEn).evidence["5"], stale: true } } }); // spec_impact --reopen marked it
    const sMany = S.stopCheck(pEn, { message: "All done!" });
    const byN = (n) => (sMany.features[0].unverified.find((d) => d.number === n) || {}).reason;
    ok(sMany.block && byN(1) === "failed-run" && byN(2) === "manual-note-on-runnable-verify" && byN(4) === "unexpected-pass" && byN(5) === "stale-evidence" && !byN(3) &&
      /#1 \(latest run failed\), #2 \(note only, _Verify:_ command not run\), #4 \(run passed, but _Expect: fail_ needs a red run\), #5 \(the spec changed since this evidence; spec_impact reopened the task\)/.test(sMany.reason),
      "C1 stopCheck lists every unverified reason: failed run, note on a runnable _Verify:_, unexpected pass, stale evidence (a noted task without _Verify:_ is verified) (got " + JSON.stringify(sMany.features) + ")");
    // Verified → allowed; old activity → allowed; a tasks.md file date is NO activity (a fresh clone stamps it "now" — the gate
    // would fire on unrelated work in a repo someone else wrote): only what the engine recorded counts.
    const pOk = c1Dir("ok");
    S.initProject(pOk, ["core"], "en");
    const fOk = S.createFeature(pOk, "Search", ["core"], "", undefined, "en");
    c1Tasks(fOk, "- [ ] 1. [US1] Index\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 2. [US1] Query\n");
    S.completeTask(pOk, "search", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0, summary: "3 passing" });
    const sVer = S.stopCheck(pOk, { message: claimMsg });
    const pOld = c1Dir("old");
    S.initProject(pOld, ["core"], "en");
    const fOld = S.createFeature(pOld, "Legacy", ["core"], "", undefined, "en");
    c1Tasks(fOld, "- [x] 1. [US1] Old work\n  - _Verify: npm test_\n- [ ] 2. [US1] Next\n");
    c1SetState(fOld, { lastTickAt: hoursAgo(10), ticks: { 1: hoursAgo(10) } });
    ageTasks(fOld, 10);
    const sOld = S.stopCheck(pOld, { message: claimMsg });
    ageTasks(fOld, 0.1); // tasks.md edited a few minutes ago — a file date, not an engine stamp
    const sHand = S.stopCheck(pOld, { message: claimMsg });
    ok(sVer.block === false && sVer.why === "verified" && JSON.stringify(sVer.verifiedFeatures) === JSON.stringify(["search"]) &&
      sOld.block === false && sOld.why === "no-recent" && sHand.block === false && sHand.why === "no-recent",
      "C1 stopCheck: every ticked task verified → allowed ('verified'); activity older than the window → allowed ('no-recent'); a tasks.md edited just now is no recorded activity → still 'no-recent' (got " +
      JSON.stringify([sVer.why, sOld.why, sHand.why]) + ")");
    // Suite evidence: every task done, meta.checks without a passing run since the last task activity → block (read the checks, run if safe, record).
    const pSu = c1Dir("suite");
    S.initProject(pSu, ["core"], "en", { checks: { test: "npm test" } });
    const fSu = S.createFeature(pSu, "Export", ["core"], "", undefined, "en");
    c1Tasks(fSu, "- [ ] 1. [US1] Export CSV\n");
    S.completeTask(pSu, "export", 1, { summary: "downloaded a CSV" });
    const sSuite = S.stopCheck(pSu, { message: "Finished — the feature is complete." });
    ok(sSuite.block && JSON.stringify(sSuite.features[0].suite) === JSON.stringify([{ name: "test", status: "no-run" }]) && !sSuite.features[0].unverified.length &&
      /- export: project checks without a passing run since the last task activity: test \(no run recorded\)/.test(sSuite.reason) && /Project checks for export have no passing run: read them in \.specs\/roadmap\.json \(meta\.checks\)/.test(sSuite.reason) && !/--run|dev-spec done/.test(sSuite.reason),
      "C1 stopCheck: a complete feature whose project checks (meta.checks) have no passing run since the last task activity → block naming meta.checks to read, run if safe and record — never a `--run` command (got " + JSON.stringify(sSuite.features) + ")");
    // meta.stopCheck: spec_init {stopCheck} over MCP (the result always reports it; a note when set); off → allowed; no .specs/; a broken .state.json is skipped.
    const i1 = await c1Call("spec_init", { projectDir: pEn });
    const i2 = await c1Call("spec_init", { projectDir: pEn, stopCheck: false });
    const sOff = S.stopCheck(pEn, { message: claimMsg });
    const iBad = await c1Call("spec_init", { projectDir: pEn, stopCheck: "no" });
    const i3 = await c1Call("spec_init", { projectDir: pEn, stopCheck: true });
    const rmMeta = JSON.parse(fs.readFileSync(path.join(pEn, ".specs", "roadmap.json"), "utf8")).meta;
    const pNo = c1Dir("none");
    fs.mkdirSync(pNo, { recursive: true });
    const pBr = c1Dir("broken");
    S.initProject(pBr, ["core"], "en");
    const fBr = S.createFeature(pBr, "Broken", ["core"], "", undefined, "en");
    c1Tasks(fBr, "- [x] 1. [US1] A\n  - _Verify: npm test_\n");
    fs.writeFileSync(path.join(fBr.dir, ".state.json"), "{ not json");
    ok(i1.p.stopCheck === true && i1.p.stopCheckNote === undefined && i2.p.stopCheck === false && /Evidence gate OFF/.test(i2.p.stopCheckNote) && sOff.block === false && sOff.why === "off" &&
      iBad.isError && /stopCheck must be a boolean/.test(iBad.p.error) && i3.p.stopCheck === true && /Evidence gate ON/.test(i3.p.stopCheckNote) && rmMeta.stopCheck === true &&
      S.stopCheck(pEn, { message: claimMsg }).block === true && S.stopCheck(pNo, { message: claimMsg }).why === "no-specs" && S.stopCheck(pBr, { message: claimMsg }).block === false,
      "C1 spec_init {stopCheck}: on by default (reported, no note), false turns the gate off (roadmap.json meta.stopCheck, allowed 'off'), a non-boolean is refused, true turns it back on; no .specs/ → 'no-specs'; an unreadable .state.json is skipped, never a block");
    // PT / ES: the claim in the project language, the reason in the project language.
    const pPt = c1Dir("pt");
    S.initProject(pPt, ["core"], "pt");
    const fPt = S.createFeature(pPt, "Pagamentos", ["core"], "", undefined, "pt");
    c1Tasks(fPt, "- [ ] 1. [US1] Cobrar\n  - _Verify: npm test_\n");
    S.completeTask(pPt, "pagamentos", 1);
    const sPt = S.stopCheck(pPt, { message: "Feito. Todos os testes passam." });
    const pEs = c1Dir("es");
    S.initProject(pEs, ["core"], "es");
    const fEs = S.createFeature(pEs, "Pagos", ["core"], "", undefined, "es");
    c1Tasks(fEs, "- [ ] 1. [US1] Cobrar\n  - _Verify: npm test_\n");
    S.completeTask(pEs, "pagos", 1, { command: "npm test", exitCode: 2, summary: "2 failing" });
    c1Tasks(fEs, "- [x] 1. [US1] Cobrar\n  - _Verify: npm test_\n"); // ticked by hand after the failed run
    const sEs = S.stopCheck(pEs, { message: "Listo: todas las pruebas pasan." });
    ok(sPt.block && sPt.lang === "pt" && /^dev-spec — gate de evidência: a tua última mensagem diz que o trabalho está feito ou verificado, mas há tarefas marcadas sem evidência de verificação:\n {2}- pagamentos: #1 \(sem evidência\)/.test(sPt.reason) &&
      /Regista a evidência antes de o afirmar/.test(sPt.reason) && /em \.specs\/pagamentos\/tasks\.md \(primeiro a tarefa 1\) — uma tarefa com vários: todos eles, numa SÓ execução unidos com ` && ` —; corre esse comando no código final só se for seguro/.test(sPt.reason) && !/--run/.test(sPt.reason) && /Ou diz claramente/.test(sPt.reason) &&
      sEs.block && /^dev-spec — gate de evidencia: tu último mensaje dice que el trabajo está hecho o verificado, pero hay tareas marcadas sin evidencia de verificación:\n {2}- pagos: #1 \(la última ejecución falló\)/.test(sEs.reason) &&
      /O di claramente/.test(sEs.reason) && S.stopCheck(pPt, { message: "Os testes ainda não passam; a tarefa 1 não está verificada." }).block === false,
      "C1 stopCheck PT / ES: the claim is read in either language and the reason is in the project language (PT: no evidence; ES: failed run); an honest PT answer is allowed (got " +
      JSON.stringify([sPt.reason, sEs.reason]).slice(0, 400) + ")");

    // --- C1.1 hooks/stop-hook.js with realistic payloads.
    const hEn = runHook(stopJs, stopPayload(pEn, claimMsg));
    const hEnReason = blocked(hEn);
    let hOneJson = false;
    try { hOneJson = typeof JSON.parse(hEn.stdout) === "object" && !hEn.stdout.includes("\n"); } catch { /* not one JSON object */ }
    const hPt = blocked(runHook(stopJs, stopPayload(pPt, "Feito — todos os testes passam.")));
    ok(!!hEnReason && hOneJson && hEnReason === S.stopCheck(pEn, { message: claimMsg }).reason && /billing: #1 \(latest run failed\)/.test(hEnReason) &&
      !!hPt && /gate de evidência/.test(hPt) && /pagamentos: #1 \(sem evidência\)/.test(hPt),
      "C1 Stop hook: a claim + unverified ticked tasks → exactly one JSON object {decision: 'block', reason} — the engine's reason, localized (EN, PT)");
    ok(silent(runHook(stopJs, stopPayload(pEn, claimMsg, { stop_hook_active: true }))) && silent(runHook(stopJs, stopPayload(pEn, "I renamed the variable."))) &&
      silent(runHook(stopJs, stopPayload(pOk, claimMsg))) && silent(runHook(stopJs, stopPayload(pNo, claimMsg))) && silent(runHook(stopJs, "not json")) &&
      silent(runHook(stopJs, "null")) && silent(runHook(stopJs, { ...stopPayload(pEn, claimMsg), hook_event_name: "PostToolUse" })) &&
      silent(runHook(stopJs, stopPayload(pEn, claimMsg, { last_assistant_message: 42 }))),
      "C1 Stop hook: stop_hook_active (never twice in a row), no claim, everything verified, no .specs/, a malformed payload, another event or no message → silent exit 0");
    await c1Call("spec_init", { projectDir: pEn, stopCheck: false });
    const hOff = runHook(stopJs, stopPayload(pEn, claimMsg));
    await c1Call("spec_init", { projectDir: pEn, stopCheck: true });
    // Older Claude Code: no last_assistant_message — the last assistant text of the transcript (JSONL tail).
    const tr = path.join(pEn, "transcript.jsonl");
    fs.writeFileSync(tr, [JSON.stringify({ type: "user", message: { role: "user", content: "finish billing" } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }] } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Done — all tests pass." }] } })].join("\n") + "\n");
    const hTr = blocked(runHook(stopJs, { hook_event_name: "Stop", cwd: pEn, stop_hook_active: false, transcript_path: tr }));
    ok(silent(hOff) && !!hTr && /billing: #1/.test(hTr) && !fs.readFileSync(stopJs, "utf8").includes(String.fromCharCode(0xfeff)),
      "C1 Stop hook: meta.stopCheck false → silent; without last_assistant_message it reads the transcript's last assistant text; no literal BOM in stop-hook.js");

    // --- C1.1 SubagentStop: the spec-implementer is checked on its REPORT (it never ticks tasks).
    const pIm = c1Dir("impl");
    S.initProject(pIm, ["core"], "en");
    const fIm = S.createFeature(pIm, "Auth", ["core"], "", undefined, "en");
    c1Tasks(fIm, "- [ ] 1. [US1] Login\n  - _Verify: node --test tests/login.test.js_\n- [ ] 2. [US1] Docs\n");
    const exDir = path.join(fIm.dir, ".execution");
    fs.mkdirSync(exDir, { recursive: true });
    const rep = path.join(exDir, "task-1-report.md");
    const subPayload = (message, agent) => ({ session_id: "s1", transcript_path: path.join(pIm, "t.jsonl"), cwd: pIm, permission_mode: "default", hook_event_name: "SubagentStop",
      agent_id: "subagent_xyz", agent_type: agent || "dev-spec-driven:spec-implementer", stop_hook_active: false, last_assistant_message: message, agent_transcript_path: path.join(pIm, "sub.jsonl") });
    const doneReply = "**Status:** DONE\nCommits: abc1234 feat(auth): login\n14/14 passing\nReport: .specs/auth/.execution/task-1-report.md";
    const hNoRep = blocked(runHook(stopJs, subPayload(doneReply)));
    fs.writeFileSync(rep, "# Task 1\nImplemented US-1.AC-1.\nTests: all green.\n");
    const hNoRun = blocked(runHook(stopJs, subPayload(doneReply)));
    const hNoType = blocked(runHook(stopJs, { ...subPayload(doneReply), agent_type: undefined })); // older payloads: the registered agent
    const sNoRun = S.stopCheck(pIm, { message: doneReply, agent: "dev-spec-driven:spec-implementer" });
    fs.writeFileSync(rep, "# Task 1\n## Verification evidence\n- `node --test tests/login.test.js` → exit code 0\n  ℹ pass 14\n  ℹ fail 0\n");
    const hOk = runHook(stopJs, subPayload(doneReply));
    const sOk = S.stopCheck(pIm, { message: doneReply, agent: "spec-implementer" });
    fs.writeFileSync(rep, "# Task 1\nRan node --test tests/login.test.js on the final code: it exited with code 0 (14 passing).\n");
    const sExited = S.stopCheck(pIm, { message: doneReply, agent: "spec-implementer" });
    ok(!!hNoRep && /^dev-spec evidence gate: you report task 1 of 'auth' as DONE, but its report \(\.specs\/auth\/\.execution\/task-1-report\.md\) does not exist\./.test(hNoRep) &&
      !!hNoRun && /doesn't show the _Verify:_ run — the exact command and its exit code: `node --test tests\/login\.test\.js`/.test(hNoRun) && /report BLOCKED \/ NEEDS_CONTEXT/.test(hNoRun) && hNoType === hNoRun &&
      sNoRun.block && sNoRun.why === "implementer-evidence" && sNoRun.task === 1 && sNoRun.feature === "auth" && silent(hOk) && sOk.block === false && sOk.why === "report-ok" &&
      sExited.why === "report-ok",
      "C1 SubagentStop (spec-implementer): DONE with no report, or a report without the _Verify:_ command + exit code → block naming the task and the report; a report with both ('exit code 0', 'exited with code 0') → silent (got " +
      JSON.stringify([sNoRun.why, sOk.why, sExited.why]) + ")");
    const sBlockedIm = S.stopCheck(pIm, { message: "**Status:** BLOCKED\nThe login API is missing.", agent: "spec-implementer" });
    const sNoPath = S.stopCheck(pIm, { message: "**Status:** DONE\n14/14 passing", agent: "spec-implementer" });
    const sNoVerify = S.stopCheck(pIm, { message: "**Status:** DONE\nReport: .specs/auth/.execution/task-2-report.md", agent: "spec-implementer" });
    const sActiveIm = runHook(stopJs, { ...subPayload(doneReply), stop_hook_active: true });
    fs.rmSync(rep);
    const sActiveIm2 = S.stopCheck(pIm, { message: doneReply, agent: "spec-implementer", stopHookActive: true });
    ok(sBlockedIm.why === "not-done" && sNoPath.why === "no-task" && sNoVerify.why === "nothing-to-verify" && silent(sActiveIm) && sActiveIm2.block === false &&
      [sBlockedIm, sNoPath, sNoVerify].every((r) => r.block === false),
      "C1 SubagentStop (spec-implementer): BLOCKED / NEEDS_CONTEXT, a reply naming no task report, a task with no runnable _Verify:_ and stop_hook_active are never sent back");

    // --- 1.22 SubagentStop: the spec-simplifier rewrites verified code — its DONE needs its report to END with the proof: a
    // "## Final runs" section in which every run exits 0 (and, with project checks, each check is one of the runs).
    const pSi = c1Dir("simplify");
    S.initProject(pSi, ["core"], "en");
    const fSi = S.createFeature(pSi, "Checkout", ["core"], "", undefined, "en");
    const siEx = path.join(fSi.dir, ".execution");
    fs.mkdirSync(siEx, { recursive: true });
    const siRep = path.join(siEx, "simplify-report.md");
    const siReply = "**Status:** DONE\nCommits: a1b2c3d refactor(checkout): guard clauses — no behaviour change\n212/212 passing\nReport: .specs/checkout/.execution/simplify-report.md";
    const siAgent = "dev-spec-driven:spec-simplifier";
    const si = (message, agent) => S.stopCheck(pSi, { message: message || siReply, agent: agent || siAgent });
    const siW = (text, message) => { fs.writeFileSync(siRep, text); return si(message); };
    const siPayload = () => ({ ...subPayload(siReply, siAgent), cwd: pSi, transcript_path: path.join(pSi, "t.jsonl"), agent_transcript_path: path.join(pSi, "sub.jsonl") });
    const siNoRep = si();
    const hSiNoRep = blocked(runHook(stopJs, siPayload()));
    const siRed = siW("## Baseline\n- `npm test` → exit 0 (212 passing)\n## Changes\n- a1b2c3d src/cart.js:12 Deep nesting → guard clauses\n## Final runs\n- `npm test` → exit code 1 (1 failing)\n");
    const siOk = siW("## Baseline\n- `npm test` → exit 0\n## Final runs\n- `npm test` → exit 0 (212 passing)\n  ℹ pass 212\n");
    const siBare = si(undefined, "spec-simplifier");
    const hSiOk = runHook(stopJs, siPayload());
    ok(siNoRep.block && siNoRep.why === "simplifier-evidence" && siNoRep.feature === "checkout" && siNoRep.report === ".specs/checkout/.execution/simplify-report.md" &&
      /^dev-spec evidence gate: you report the simplification pass of 'checkout' as DONE, but its report \(\.specs\/checkout\/\.execution\/simplify-report\.md\) does not exist\./.test(siNoRep.reason) &&
      hSiNoRep === siNoRep.reason && siRed.block && /the final runs in its report \(\.specs\/checkout\/\.execution\/simplify-report\.md\) fail: `npm test` — a simplification must leave every run green/.test(siRed.reason) &&
      /revert the change that made a run fail/.test(siRed.reason) && siOk.block === false && siOk.why === "simplify-ok" && siBare.why === "simplify-ok" && silent(hSiOk),
      "1.22 SubagentStop (spec-simplifier): DONE with no report, or a red run in its '## Final runs' → block naming the report; a section whose runs all exit 0 → allowed (namespaced or not; the hook prints the engine's reason) (got " +
      JSON.stringify([siNoRep.why, siRed.why, siOk.why, siBare.why]) + ")");
    // review 1 (engine): only the LAST "## Final runs" section's run lines count — never a baseline, an output line, a fenced
    // block or a later passing run hiding a failed one; a run line without its exit code is no proof.
    const siBaseOnly = siW("## Baseline\n- `npm test` → exit 0\n## Changes\n- a1b2c3d src/x.js:3 Rename\n");
    const siHidden = siW("## Final runs\n- `npm test` → exit code 1 (3 failing)\n- `node --test test/cart.test.js` → exit 0\n");
    const siOutput = siW("## Final runs\n- `npm test` → exit code 1\n  [0] npm run test:unit exited with code 0\n");
    const siNoCode = siW("## Final runs\n- `npm test` → FAILED (3 failing)\n");
    const siQuoted = siW("## Final runs\n- `npm test` → exit 0 (212 passing)\n  ✓ returns exit code 2 on bad args\n");
    const siRevert = siW("## Final runs\n- `npm test` → exit code 1\n## Revert round\n- reverted b2c3d4e (it changed an error text)\n## Final runs\n- `npm test` → exit 0\n");
    const siFenced = siW("## Final runs\n- `npm test` → exit 0\n```\n# a comment the output printed\n`npm test` → exit code 1\n```\n");
    const siPt = siW("## Execuções finais\n1. `npm test` → código de saída 0\n");
    const siTick = siW("## Final runs\n- `npm test` → exit code 1\n", "**Status:** `DONE`\nReport: .specs/checkout/.execution/simplify-report.md");
    fs.writeFileSync(siRep, "## Baseline\n- `npm test` → exit code 1\n## Changes\n" + "- a1b2c3d src/cart.js:12 Deep nesting → guard clauses\n".repeat(6000) + "## Final runs\n- `npm test` → exit 0\n");
    const siBig = si();
    ok(siBaseOnly.block && /has no "## Final runs" section with a run in it/.test(siBaseOnly.reason) &&
      siHidden.block && /fail: `npm test` — /.test(siHidden.reason) && !/cart\.test/.test(siHidden.reason) && siOutput.block && /fail: `npm test`/.test(siOutput.reason) &&
      siNoCode.block && /doesn't show these runs with their exit code: `npm test`/.test(siNoCode.reason) &&
      siQuoted.why === "simplify-ok" && siRevert.why === "simplify-ok" && siFenced.why === "simplify-ok" && siPt.why === "simplify-ok" &&
      siTick.block && siTick.why === "simplifier-evidence" && siBig.why === "simplify-ok" && fs.statSync(siRep).size > 256 * 1024,
      "1.22 review 1: a baseline-only report, a failed run hidden by a later passing one, a code quoted in output, a run line without its code → block; a code in a passing run's output, a revert round's later '## Final runs', a fenced block, PT headings, a status in backticks (a claim), a report past the 256 KB cap (read from its end) are read right (got " +
      JSON.stringify([siBaseOnly.why, siHidden.why, siOutput.why, siNoCode.why, siQuoted.why, siRevert.why, siFenced.why, siPt.why, siTick.why, siBig.why]) + ")");
    // with project checks: each must be one of the final runs, as a WHOLE command — a longer command that starts with it (a
    // re-run _Verify:_ `npm test -- t/x`, `npm run lint:css`) is another run, never its stand-in; one listed twice is named once.
    const pSim = c1Dir("simplify-checks");
    S.initProject(pSim, ["core"], "en", { checks: { test: "npm test", lint: "npm run lint", probe: "node -e \"process.exit(0)\"", again: "npm  test" } });
    const fSim = S.createFeature(pSim, "Checkout", ["core"], "", undefined, "en");
    fs.mkdirSync(path.join(fSim.dir, ".execution"), { recursive: true });
    const si2 = (text) => { fs.writeFileSync(path.join(fSim.dir, ".execution", "simplify-report.md"), text); return S.stopCheck(pSim, { message: siReply, agent: siAgent }); };
    const probe = "- `node -e \"process.exit(0)\"` → exit 0\n";
    const siFail = si2("## Final runs\n- `npm test` → exit code 1\n- `npm run lint` → exit 0\n- `node -e \"process.exit(0)\"` → exit code 3\n");
    const siUnrun = si2("## Final runs\n- `npm test` → exit 0\n" + probe);
    const siPrefix = si2("## Final runs\n- `npm test` → exit code 1\n- `npm run lint` → exit 0\n" + probe + "- `npm test -- t/cart.test.js` → exit 0\n- `npm run lint:css` → exit 0\n");
    const siLintNoCode = si2("## Final runs\n- `npm run lint` → FAILED (3 problems)\n- `npm test` → exit 0\n" + probe);
    const siOk2 = si2("## Baseline\n- `npm test` → exit code 1\n## Final runs\n- `npm test` → exit 0 (212 passing)\n- `npm run lint` → exit 0\n" + probe + "- `npm test -- t/cart.test.js` → exit 0\n");
    ok(siFail.block && /fail: `npm test`, `node -e "process\.exit\(0\)"` — a simplification must leave every run green/.test(siFail.reason) && !/npm run lint/.test(siFail.reason) &&
      siUnrun.block && /doesn't show these runs with their exit code: `npm run lint` — every project check must be there/.test(siUnrun.reason) &&
      siPrefix.block && /fail: `npm test` — /.test(siPrefix.reason) && siLintNoCode.block && /exit code: `npm run lint` — /.test(siLintNoCode.reason) &&
      siOk2.block === false && siOk2.why === "simplify-ok" && ![siFail, siUnrun, siPrefix, siLintNoCode].some((r) => /`npm test`, `npm test`/.test(r.reason || "")),
      "1.22 SubagentStop (spec-simplifier) with project checks: a red check (also one whose command holds 'exit(0)'), a check missing or without its code → block naming exactly those; a longer command starting with a check's never stands in; all green → allowed (got " +
      JSON.stringify([siFail.why, siUnrun.why, siPrefix.why, siLintNoCode.why, siOk2.why]) + ")");
    // review 2: the section runs from the last heading to the END — an output "# pass 212" line (indented or not) never cuts
    // it short, a revert round written under it without a new heading still counts; runs start at the margin (an indented
    // "`foo` is deprecated" is output); fences are counted from the heading (the 256 KB window may start inside one); a
    // ``double-backtick`` span holds a command with a backtick.
    const siTap = siW("## Final runs\n- `npm test` → exit 0\n  # pass 212\n  # fail 0\n- `node --test test/cart.test.js` → exit code 1\n");
    const siTap0 = siW("## Final runs\n- `npm test` → exit 0\n# pass 212\n- `node --test test/cart.test.js` → exit code 1\n");
    const siRevertNoHead = siW("## Final runs\n- `npm test` → exit 0\n## Revert round\n- reverted b2c3d4e\n- `npm test` → exit code 1\n");
    const siIndented = siW("## Final runs\n- `npm test` → exit 0\n  `foo` is deprecated\n");
    fs.writeFileSync(siRep, "## Baseline\n```\n" + "  ok 1 - cart totals\n".repeat(16000) + "```\n## Final runs\n- `npm test` → exit 0\n");
    const siFenceWindow = si(), siFenceSize = fs.statSync(siRep).size;
    const pTick = c1Dir("simplify-backtick");
    S.initProject(pTick, ["core"], "en", { checks: { stamp: "echo `date`" } });
    const fTick = S.createFeature(pTick, "Checkout", ["core"], "", undefined, "en");
    fs.mkdirSync(path.join(fTick.dir, ".execution"), { recursive: true });
    fs.writeFileSync(path.join(fTick.dir, ".execution", "simplify-report.md"), "## Final runs\n- `` echo `date` `` → exit 0\n");
    const siTickCmd = S.stopCheck(pTick, { message: siReply, agent: siAgent });
    // a code span that merely holds the word "blocked" is no status — the claim stands and the report is read
    const siCodeStatus = siW("## Final runs\n- `npm test` → exit code 1\n", "**Status:** DONE\nCommits: a1b2c3d refactor: reject when `order.status === \"blocked\"`\nReport: .specs/checkout/.execution/simplify-report.md");
    const sImCode = S.stopCheck(pIm, { message: "**Status:** DONE\nCommits: abc1234 feat(auth): reject when `order.status === \"blocked\"`\nReport: .specs/auth/.execution/task-1-report.md", agent: "spec-implementer" });
    ok(siTap.block && /fail: `node --test test\/cart\.test\.js`/.test(siTap.reason) && siTap0.block && siRevertNoHead.block && /fail: `npm test`/.test(siRevertNoHead.reason) &&
      siIndented.why === "simplify-ok" && siFenceWindow.why === "simplify-ok" && siFenceSize > 256 * 1024 && siTickCmd.why === "simplify-ok" &&
      siCodeStatus.block && siCodeStatus.why === "simplifier-evidence" && sImCode.block && sImCode.why === "implementer-evidence",
      "1.22 review 2: '# pass 212' output (indented or not) never ends '## Final runs', a revert round under it without a new heading counts, an indented backticked word is output, fences count from the heading, a ``double-backtick`` command matches its check, a code span holding 'blocked' is no status (got " +
      JSON.stringify([siTap.why, siTap0.why, siRevertNoHead.why, siIndented.why, siFenceWindow.why, siTickCmd.why, siCodeStatus.why, sImCode.why]) + ")");
    // review 3: a run nested under a group bullet (indented: a bullet, a command, its exit code) counts — a failing one was
    // skipped as output; a status token in backticks is a status only on a line that starts with "Status"
    const siNested = siW("## Final runs\n- Project checks:\n  - `npm test` → exit code 1 (2 failing)\n- `node --test test/cart.test.js` → exit 0\n");
    const siNestedOk = siW("## Final runs\n- Project checks:\n  - `npm test` → exit 0 (212 passing)\n    ℹ pass 212\n");
    const siNested2 = si2("## Final runs\n- `npm test` → exit 0\n- `npm run lint` → exit 0\n" + probe + "- Re-run _Verify:_:\n  - `node --test test/cart.test.js` → exit code 1\n");
    const siMidStatus = siW("## Final runs\n- `npm test` → exit code 1\n", "**Status:** DONE\nCommits: a1b2c3d fix: lock out with status `blocked`\nReport: .specs/checkout/.execution/simplify-report.md");
    ok(siNested.block && /fail: `npm test` — /.test(siNested.reason) && siNestedOk.why === "simplify-ok" && siNested2.block && /fail: `node --test test\/cart\.test\.js`/.test(siNested2.reason) &&
      siMidStatus.block && siMidStatus.why === "simplifier-evidence",
      "1.22 review 3: a failing run nested under a group bullet blocks (with and without project checks), a passing nested run with indented output is allowed; 'with status `blocked`' inside a commit line is no status (got " +
      JSON.stringify([siNested.why, siNestedOk.why, siNested2.why, siMidStatus.why]) + ")");
    const siNoChange = si("**Status:** NO_CHANGES\nNothing on the list was worth a change.\nReport: .specs/checkout/.execution/simplify-report.md");
    const siNoChangeBt = si("**Status:** `NO_CHANGES`\nReport: .specs/checkout/.execution/simplify-report.md");
    const siBlocked = si("**Status:** BLOCKED\nThe baseline is red: 2 failing.");
    const siNoPath = si("**Status:** DONE\n212/212 passing");
    const siOther = si("**Status:** DONE\nReport: .specs/nope/.execution/simplify-report.md");
    const siTaskRep = si("**Status:** DONE\nReport: .specs/checkout/.execution/task-1-report.md");
    ok(siNoChange.why === "no-changes" && siNoChangeBt.why === "no-changes" && siBlocked.why === "not-done" && siNoPath.why === "no-report" && siOther.why === "no-report" && siTaskRep.why === "no-report" &&
      [siNoChange, siNoChangeBt, siBlocked, siNoPath, siOther, siTaskRep].every((r) => r.block === false) &&
      S.msg("en").stopGate.allow["no-changes"]() && S.msg("pt").stopGate.allow["simplify-ok"]({ slug: "x" }).includes("'x'") && S.msg("es").stopGate.simplifier.head("x").includes("'x'") &&
      ["en", "pt", "pt-BR", "es"].every((l) => Object.keys(S.msg(l).stopGate.simplifier).join() === "head,noReport,noFinal,noRun,notPassing,todo"),
      "1.22 SubagentStop (spec-simplifier): NO_CHANGES (also in backticks), BLOCKED, a reply naming no simplification report (or an unknown feature, or a task report) are never sent back; the strings exist in EN / PT / pt-BR / ES");
    // review 1: the implementer's status in backticks is a status too — "**Status:** `DONE`" used to read as no claim
    const sImTick = S.stopCheck(pIm, { message: "**Status:** `DONE`\nReport: .specs/auth/.execution/task-1-report.md", agent: "spec-implementer" });
    ok(sImTick.block && sImTick.why === "implementer-evidence", "1.22 review 1: an implementer's '**Status:** `DONE`' is a claim — its report is read (got " + sImTick.why + ")");
    const hooksCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8")).hooks;
    const stopCfg = ((hooksCfg.Stop || [])[0] || {});
    const subCfg = ((hooksCfg.SubagentStop || [])[0] || {});
    const cmd = (h) => h.command === "node" && JSON.stringify(h.args) === JSON.stringify(["${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.js"]); // 1.25.1: exec form
    const re = new RegExp(subCfg.matcher || "^$");
    ok(stopCfg.matcher === undefined && cmd(stopCfg.hooks[0]) && stopCfg.hooks[0].timeout === 10 && cmd(subCfg.hooks[0]) && subCfg.hooks[0].timeout === 10 &&
      re.test("dev-spec-driven:spec-implementer") && re.test("spec-implementer") && re.test("dev-spec-driven:spec-simplifier") && re.test("spec-simplifier") &&
      !re.test("dev-spec-driven:spec-reviewer") && !re.test("dev-spec-driven:spec-critic") && !re.test("spec-simplifier-x") && !re.test("Explore") && !re.test("general-purpose") &&
      hooksCfg.PreToolUse && hooksCfg.PostToolUse && hooksCfg.SessionStart,
      "C1 hooks.json: Stop (no matcher — it fires on every stop) and SubagentStop matching only the spec-implementer and the spec-simplifier (plugin-scoped or copied) run hooks/stop-hook.js (timeout 10), beside the existing hooks");

    // --- C1.2 the scope guard (meta.guard = "scope").
    const pSc = c1Dir("scope");
    const gi = await c1Call("spec_init", { projectDir: pSc, guard: "Scope" });
    const fSc = S.createFeature(pSc, "Checkout", ["core"], "", undefined, "en");
    c1Tasks(fSc, "- [x] 1. [US1] Cart\n  - _Implements: src/cart/cart.js_\n- [ ] 2. [US1] Pay\n  - _Implements: `src/pay/pay.js:12`, src/pay/providers/_\n" +
      "- [ ] 3. [US1] API\n  - _Implements: src/api/**/*.ts, [path/to/file]_\n");
    c1SetState(fSc, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } });
    const pre = (file) => ({ session_id: "s1", hook_event_name: "PreToolUse", cwd: pSc, tool_name: "Edit", tool_input: { file_path: file, old_string: "a", new_string: "b" } });
    const asked = (r) => { try { const j = JSON.parse(r.stdout); return j.hookSpecificOutput && j.hookSpecificOutput.permissionDecision === "ask" ? j.hookSpecificOutput.permissionDecisionReason : null; } catch { return null; } };
    const gIn = S.guardCheck(pSc, "src/pay/pay.js", pSc);
    const gFolder = S.guardCheck(pSc, path.join(pSc, "src", "pay", "providers", "stripe.js"));
    const gGlob = S.guardCheck(pSc, "src/api/v1/users.ts", pSc);
    const gTest = S.guardCheck(pSc, "tests/pay.test.js", pSc);
    ok(gi.p.guard === "scope" && /Guard mode SCOPE/.test(gi.p.guardNote) && S.readRoadmap(pSc).meta.guard === "scope" && S.guardEnabled(pSc) === true &&
      gIn.decision === "allow" && gIn.why === "in-scope" && gIn.task.number === 2 && gFolder.why === "in-scope" && gFolder.task.number === 2 && gGlob.why === "in-scope" && gGlob.task.number === 3 &&
      gTest.decision === "allow" && gTest.why === "test-file" && silent(runHook(guardJs, pre(path.join(pSc, "src", "pay", "pay.js")))) && silent(runHook(guardJs, pre(path.join(pSc, "src", "api", "x.ts")))),
      "C1 scope guard: spec_init {guard: 'Scope'} stores meta.guard 'scope'; a file an open task names (anchored path, a folder above it, a glob) or a test file → allowed, the hook silent (got " +
      JSON.stringify([gi.p.guard, gIn.why, gFolder.why, gGlob.why, gTest.why]) + ")");
    const gSame = S.guardCheck(pSc, "src/pay/refund.js", pSc);
    const hSame = asked(runHook(guardJs, pre(path.join(pSc, "src", "pay", "refund.js"))));
    const gDone = S.guardCheck(pSc, "src/cart/cart.js", pSc); // planned by a DONE task only
    const gFar = S.guardCheck(pSc, "lib/util.py", pSc);
    const gApiJs = S.guardCheck(pSc, "src/api/legacy.js", pSc);
    ok(gSame.decision === "ask" && gSame.why === "out-of-scope" && JSON.stringify(gSame.likely) === JSON.stringify({ feature: "checkout", number: 2, via: "same-folder" }) &&
      hSame === gSame.reason && /^dev-spec guard \(scope\): src\/pay\/refund\.js is not in the plan — no open task of checkout names it in _Implements:_\. Add it to task 2's _Implements:_ \(checkout — same folder as src\/pay\/pay\.js\) and re-approve the tasks phase, or plan the change with \/spec-review checkout converge \(spec_append_tasks\)\./.test(hSame || "") &&
      gDone.decision === "ask" && gFar.decision === "ask" && gFar.likely.via === "next" && gFar.likely.number === 2 && /task 2 \(checkout, the next open task\)/.test(gFar.reason) &&
      gApiJs.decision === "ask" && gApiJs.likely.number === 3 && gApiJs.likely.via === "same-folder",
      "C1 scope guard: a code file no open task names → ask naming the likely task (same folder — a glob's literal folder too — else the next open task); a file only a done task planned asks too (got " +
      JSON.stringify([gSame.likely, gFar.likely, gApiJs.likely]) + ")");
    // The advertised schema is one plain string enum (portable: some MCP clients reject a list-valued `type`); true / false still work.
    const initTool = list.result.tools.find((t) => t.name === "spec_init");
    const gOnStr = await c1Call("spec_init", { projectDir: c1Dir("guard-str"), guard: "ON" });
    const gOffStr = await c1Call("spec_init", { projectDir: c1Dir("guard-str"), guard: "off" });
    const gBool = await c1Call("spec_init", { projectDir: c1Dir("guard-str"), guard: true });
    ok(initTool.inputSchema.properties.guard.type === "string" && initTool.inputSchema.properties.guard.enum.join() === "on,off,scope" && initTool.inputSchema.properties.stopCheck.type === "boolean" &&
      gOnStr.p.guard === true && /Guard mode ON/.test(gOnStr.p.guardNote) && gOffStr.p.guard === false && gBool.p.guard === true &&
      list.result.tools.every((t) => Object.values(t.inputSchema.properties || {}).every((s) => !Array.isArray(s.type))),
      "C1 spec_init advertises guard as a string enum on | off | scope (any case; the booleans true / false read as on / off) and stopCheck as a boolean; no tool property has a list-valued type");
    // guard true keeps today's behavior; scope with nothing approved asks like true; a forced approval's note rides along; PT; the CLI's value.
    await c1Call("spec_init", { projectDir: pSc, guard: true });
    const gTrue = S.guardCheck(pSc, "lib/util.py", pSc);
    const hTrue = runHook(guardJs, pre(path.join(pSc, "lib", "util.py")));
    await c1Call("spec_init", { projectDir: pSc, guard: "scope" });
    c1SetState(fSc, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t", forced: true, failing: ["placeholders"] } } });
    const gForcedIn = S.guardCheck(pSc, "src/pay/pay.js", pSc);
    const gForcedOut = S.guardCheck(pSc, "lib/util.py", pSc);
    // Several approved features: the plan is all their open tasks — a forced one's included (no note while a regular approval covers).
    const fSc2 = S.createFeature(pSc, "Invoices", ["core"], "", undefined, "en");
    c1Tasks(fSc2, "- [ ] 1. [US1] PDF\n  - _Implements: src/invoices/pdf.js_\n");
    c1SetState(fSc, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } });
    c1SetState(fSc2, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t", forced: true } } });
    const gMixed = S.guardCheck(pSc, "src/invoices/pdf.js", pSc);
    const gMixedOut = S.guardCheck(pSc, "src/other.js", pSc);
    S.manageFeature(pSc, "archive", "invoices");
    ok(gMixed.decision === "allow" && gMixed.why === "in-scope" && gMixed.task.feature === "invoices" && !gMixed.note &&
      gMixedOut.decision === "ask" && /no open task of checkout, invoices names it/.test(gMixedOut.reason),
      "C1 scope guard with several approved features: any of their open tasks puts a file in the plan (a forced approval's too); the ask names them all");
    c1SetState(fSc, { approvals: {} });
    const gNone = S.guardCheck(pSc, "src/pay/pay.js", pSc);
    const pScPt = c1Dir("scope-pt");
    S.initProject(pScPt, ["core"], "pt", { guard: "scope" });
    const fScPt = S.createFeature(pScPt, "Carrinho", ["core"], "", undefined, "pt");
    c1Tasks(fScPt, "- [ ] 1. [US1] Carrinho\n  - _Implements: src/carrinho.js_\n");
    c1SetState(fScPt, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } });
    ok(gTrue.decision === "allow" && gTrue.why === "approved" && silent(hTrue) && gForcedIn.decision === "allow" && /FORCED tasks approval/.test(gForcedIn.note) &&
      gForcedOut.decision === "ask" && /FORCED tasks approval/.test(gForcedOut.reason) && gNone.decision === "ask" && gNone.why === "no-approved-tasks" &&
      /^dev-spec guard \(scope\): src\/outro\.js não está no plano — nenhuma tarefa por concluir de carrinho o nomeia em _Implements:_\. Acrescenta-o ao _Implements:_ da tarefa 1 \(carrinho — mesma pasta que src\/carrinho\.js\)/.test(S.guardCheck(pScPt, "src/outro.js", pScPt).reason || ""),
      "C1 guard true is unchanged (every code file allowed while tasks are approved); scope: a forced approval's note rides along (allowed or asked), nothing approved asks as before; the reason is in the project language (PT)");
  }

  // 1.14 full review (Gb) — next_action, doctor, stop gate, guard.
  {
    const gbDir = (n) => path.join(tmp, "gb-" + n);
    const gbW = (dir, rel, txt) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
    const gbR = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
    const gbRun = 'node -e "process.exit(0)"';
    const gbTasks = (verify) => "# Tasks: login\n\n## Global Constraints\n- Node >= 18\n\n## Story US-1 (P1 — MVP)\n" +
      "- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + verify + "_\n" +
      "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + verify + "_\n**Checkpoint:** US-1 works.\n";
    // A core feature whose whole planning chain is filled (the fast-forward through tasks passes every gate).
    const gbFeature = (p, name, tasks) => {
      const r = S.createFeature(p, name, ["core"], "", null, "en");
      gbW(r.dir, "classification.md", `# Classification: ${name}\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n`);
      gbW(r.dir, "requirements.md", `# Feature: ${name}\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n` +
        "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
        "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
        "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
        "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
      gbW(r.dir, "design.md", `# Design: ${name}\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n` +
        "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
        "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
      gbW(r.dir, "tasks.md", tasks || gbTasks(gbRun));
      return r;
    };

    // Gb1: a re-review whose approve gate would refuse (a [NEEDS CLARIFICATION] added after the approval) names the failing checks.
    const p1 = gbDir("rereview");
    S.initProject(p1, ["core"], "en");
    const f1 = gbFeature(p1, "login");
    const ff1 = S.approvePhase(p1, "login", null, "u", { through: "tasks" });
    gbW(f1.dir, "requirements.md", gbR(f1.dir, "requirements.md").replace("- Social login", "- Social login [NEEDS CLARIFICATION: which providers?]"));
    const na1 = S.nextAction(p1, "login");
    const ap1 = S.approvePhase(p1, "login", "requirements", "u");
    ok(ff1.ok && na1.step === "re-review" && na1.refusedGate && na1.refusedGate.phase === "requirements" && na1.refusedGate.failing.includes("clarifications") &&
      /fix what the approve gate would refuse: clarifications/.test(na1.recommendation) && ap1.ok === false && ap1.failing.includes("clarifications"),
      "full review Gb1: re-review of a phase whose approve gate refuses names the failing checks (refusedGate + ids) — never a bare 're-approve' that loops (got " + JSON.stringify([na1.step, na1.refusedGate, na1.recommendation]) + ")");

    // Gb2: the execution sign-off with roles (meta.approvalRoles.execution): next_action names the role, doctor lists the pending sign-off.
    const p2 = gbDir("exec-roles");
    S.initProject(p2, ["core"], "en", { approvalRoles: { execution: ["qa", "product"] } });
    gbFeature(p2, "login");
    S.approvePhase(p2, "login", null, "u", { through: "tasks" });
    S.completeTask(p2, "login", 1, { command: gbRun, exitCode: 0 });
    S.completeTask(p2, "login", 2, { command: gbRun, exitCode: 0 });
    const fin2 = S.finishFeature(p2, "login", { write: true });
    const na2a = S.nextAction(p2, "login");
    const doc2a = S.specDoctor(p2, "login");
    const qa2 = S.approvePhase(p2, "login", "execution", "u", { role: "qa" });
    const na2b = S.nextAction(p2, "login");
    const doc2b = S.specDoctor(p2, "login");
    const fin2b = S.finishFeature(p2, "login", {});
    const po2 = S.approvePhase(p2, "login", "execution", "u", { role: "product" });
    const na2c = S.nextAction(p2, "login");
    const gates2 = (d) => d.checks.find((c) => c.id === "approval-gates");
    ok(fin2.readyToFinish && na2a.step === "finished" && /Sign it off — missing roles: qa, product: \/approve login execution --role qa\./.test(na2a.recommendation) && JSON.stringify(na2a.missingRoles) === '["qa","product"]' &&
      doc2a.pendingRoles.execution && JSON.stringify(doc2a.pendingRoles.execution.missing) === '["qa","product"]' && gates2(doc2a).status === "warn" &&
      qa2.ok && qa2.complete === false && /--role product\./.test(na2b.recommendation) && /\(signed: qa\)/.test(na2b.recommendation) && JSON.stringify(na2b.missingRoles) === '["product"]' &&
      /awaiting human approval: execution \(missing role: product\)/.test(gates2(doc2b).detail) && fin2b.readyToFinish === true && doc2b.gatesOk === true &&
      po2.ok && po2.complete === true && na2c.step === "finished" && /Nothing left to do here/.test(na2c.recommendation) && na2c.missingRoles === undefined,
      "full review Gb2: with execution roles, next_action names the role to sign as (--role qa, then --role product), doctor lists the pending execution sign-off (pendingRoles, approval-gates) once a finish is recorded — never a blocker of the finish itself (got " +
      JSON.stringify([na2a.recommendation, na2b.recommendation, gates2(doc2b).detail, na2c.step]) + ")");

    // Gb3: finished, then a task re-run after the project checks' run → next_action asks for the checks (verify), not "nothing left to do".
    const p3 = gbDir("finished-suite");
    S.initProject(p3, ["core"], "en", { checks: { test: "npm test" } });
    gbFeature(p3, "login");
    S.approvePhase(p3, "login", null, "u", { through: "tasks" });
    S.completeTask(p3, "login", 1, { command: gbRun, exitCode: 0 });
    S.completeTask(p3, "login", 2, { command: gbRun, exitCode: 0 });
    const fin3 = S.finishFeature(p3, "login", { evidence: [{ name: "test", command: "npm test", exitCode: 0 }], write: true });
    S.approvePhase(p3, "login", "execution", "u");
    const na3a = S.nextAction(p3, "login");
    S.completeTask(p3, "login", 1, { command: gbRun, exitCode: 0 }); // a re-check after the finish: the checks ran before it
    const na3b = S.nextAction(p3, "login");
    const fin3b = S.finishFeature(p3, "login", {});
    S.finishFeature(p3, "login", { evidence: [{ name: "test", command: "npm test", exitCode: 0 }] });
    const na3c = S.nextAction(p3, "login");
    ok(fin3.readyToFinish && na3a.step === "finished" && na3b.step === "verify" && JSON.stringify(na3b.suite) === '[{"name":"test","status":"before-last-tick"}]' &&
      /project checks have no passing run since the last task activity: test \(ran before the last task activity\)/.test(na3b.recommendation) && /node "[^"]*dev-spec\.js" finish login --run/.test(na3b.recommendation) &&
      !/Nothing left to do/.test(na3b.recommendation) && fin3b.readyToFinish === false && na3c.step === "finished" && na3c.suite === undefined,
      "full review Gb3: a finished feature whose project checks have no passing run since the last task activity → step verify naming the checks (suite: [{name, status}]) — never 'finished, nothing left to do' while spec_finish refuses (got " +
      JSON.stringify([na3a.step, na3b.step, na3b.suite, na3c.step]) + ")");

    // Gb4: the stop gate never applies project checks to a spike; a checks-only reason has its own head (EN / PT / ES).
    const p4 = gbDir("spike-stop");
    S.initProject(p4, ["core"], "en", { checks: { test: gbRun } });
    const sp4 = S.createFeature(p4, "cache spike", null, "", null, null, "spike", { question: "Should we use Redis for the session cache?", timebox: "3d" });
    gbW(sp4.dir, "spike.md", gbR(sp4.dir, "spike.md").replace("> **TODO** — go / no-go / pivot, and why: the evidence that decided it.", "Go: Redis cut p95 latency by 40% in the prototype.").replace("_Outcome: [go | no-go | pivot]_", "_Outcome: go_"));
    for (const n of [1, 2, 3, 4]) S.completeTask(p4, "cache-spike", n);
    const fin4 = S.finishFeature(p4, "cache-spike", {});
    const st4 = S.stopCheck(p4, { message: "The spike is done: the decision is go." });
    const p4b = gbDir("suite-head");
    S.initProject(p4b, ["core"], "en", { checks: { test: "npm test" } });
    const f4b = S.createFeature(p4b, "Export", ["core"], "", undefined, "en");
    gbW(f4b.dir, "tasks.md", "- [ ] 1. [US1] Export CSV\n");
    S.completeTask(p4b, "export", 1, { summary: "downloaded a CSV" });
    const st4b = S.stopCheck(p4b, { message: "Finished — the feature is complete." });
    ok(fin4.readyToFinish && st4.block === false && !st4.features.length && st4b.block === true && st4b.features[0].suite.length === 1 &&
      /^dev-spec evidence gate: your last message says the work is done or verified, but the project checks have no passing run since the last task activity:\n {2}- export: /.test(st4b.reason) &&
      !/tasks are ticked without verification evidence/.test(st4b.reason) && ["en", "pt", "es", "pt-BR"].every((l) => typeof S.msg(l).stopGate.headSuite === "string" && S.msg(l).stopGate.headSuite !== S.msg(l).stopGate.head),
      "full review Gb4: a decided spike with every task ticked is never sent back over project checks (it has none); a checks-only reason heads with the checks, not 'tasks are ticked without verification evidence' (got " +
      JSON.stringify([st4.block, st4.why, st4.features, st4b.reason.split("\n")[0]]) + ")");

    // Gb5: stop claims read "no" / "se" by language — PT "no" (em + o) and ES reflexive "se" never cancel a real claim; real negations still do.
    const claimed = (m) => { const r = S.stopClaims(m); return r.claim && !r.admitted; };
    const gb5Yes = ["A correção no módulo está concluída.", "O login no servidor foi implementado.", "La tarea 3 se ha completado.", "Se han implementado todos los cambios.", "Todo se ha verificado."];
    const gb5No = ["Todavía no está terminado.", "Aún no está terminado.", "No está hecho.", "La tarea no se ha completado.", "No todo está hecho.", "Não está feito ainda.", "Se os testes passarem, fica feito?"];
    const p5 = gbDir("stop-lang");
    S.initProject(p5, ["core"], "en");
    const f5 = S.createFeature(p5, "Login", ["core"], "", undefined, "en");
    gbW(f5.dir, "tasks.md", "- [ ] 1. [US1] Handler\n  - _Verify: " + gbRun + "_\n- [ ] 2. [US1] Error\n");
    S.completeTask(p5, "login", 1);
    const st5 = ["A correção no módulo está concluída.", "La tarea 1 se ha completado."].map((m) => S.stopCheck(p5, { message: m }));
    ok(gb5Yes.every(claimed) && !gb5No.some(claimed) && st5.every((r) => r.block === true && r.why === "unverified"),
      "full review Gb5: PT 'no' (em + o) and ES reflexive 'se' no longer cancel a claim (the claim is sent back while a task is unverified); 'no está', 'no se ha', 'não está', PT 'se' (if) still negate (missed: " +
      JSON.stringify(gb5Yes.filter((m) => !claimed(m))) + ", false: " + JSON.stringify(gb5No.filter(claimed)) + ", stop: " + JSON.stringify(st5.map((r) => r.why)) + ")");

    // Gb6: a failure already fixed is no admission; "2 are failing" is one; the claims the gate missed.
    const gb6Fixed = ["Done! I fixed the 2 failing tests and everything works now.", "Implemented and verified. Previously 4 tests failed; now all 12 pass.",
      "All tasks are complete. The 3 failures from yesterday are fixed.", "Feito. Corrigi os 2 testes a falhar.", "Listo. Corregí las 2 pruebas fallando."];
    const gb6Admit = ["The tests passed before my change; after it, 2 are failing.", "I haven't fixed the 2 failing tests, but task 1 is done.", "Task 1 is done, but 2 failing tests are not fixed yet.",
      "Done. 12 passing, 2 failing.", "Tests pass locally; task 3 is not verified."];
    const gb6Claims = ["All tasks done.", "All tasks done ✓", "All 5 tasks done.", "All green.", "✅ Done", "Done ✅", "Tasks 1-3 done.", "Feature complete.", "No problem — task 2 is done.",
      "Todas as tarefas feitas.", "Todas las tareas hechas.", "Tarefas 1-3 feitas.", "Tareas 1 a 3 hechas.", "✅ Feito", "✅ Hecho"];
    const st6 = S.stopCheck(p5, { message: gb6Fixed[0] });
    ok(gb6Fixed.every(claimed) && gb6Admit.every((m) => S.stopClaims(m).admitted) && gb6Claims.every(claimed) && st6.block === true && st6.why === "unverified" &&
      !claimed("Should I mark tasks 1-3 done?") && !claimed("Not done yet: the feature is incomplete."),
      "full review Gb6: 'I fixed the 2 failing tests' / 'Previously 4 tests failed' / 'failures … are fixed' are no admission (the false done is sent back); '2 are failing' / 'haven't fixed' / 'not fixed yet' still are; 'All tasks done', 'All green', '✅ Done', 'Tasks 1-3 done', 'Feature complete', 'No problem — task 2 is done', PT/ES 'Todas as/las tarefas/tareas feitas/hechas' are claims (fixed-not-claimed: " +
      JSON.stringify(gb6Fixed.filter((m) => !claimed(m))) + ", not admitted: " + JSON.stringify(gb6Admit.filter((m) => !S.stopClaims(m).admitted)) + ", missed: " + JSON.stringify(gb6Claims.filter((m) => !claimed(m))) + ")");

    // Gb7: two tasks share a number → the verify step asks to renumber (a re-run can never reach the second one); renumbered, it ends.
    const p7 = gbDir("dup-number");
    S.initProject(p7, ["core"], "en");
    const f7 = gbFeature(p7, "login", gbTasks(gbRun).replace("- [ ] 2. [US1] Show", "- [ ] 1. [US1] Show"));
    S.approvePhase(p7, "login", null, "u", { through: "tasks" });
    S.completeTask(p7, "login", 1, { command: gbRun, exitCode: 0 });
    S.completeTask(p7, "login", 1);
    const na7a = S.nextAction(p7, "login");
    const rerun7 = S.completeTask(p7, "login", 1, { command: gbRun, exitCode: 0 });
    const na7b = S.nextAction(p7, "login");
    gbW(f7.dir, "tasks.md", gbR(f7.dir, "tasks.md").replace("- [x] 1. [US1] Show", "- [x] 2. [US1] Show"));
    S.approvePhase(p7, "login", "tasks", "u");
    S.completeTask(p7, "login", 2, { command: gbRun, exitCode: 0 });
    const na7c = S.nextAction(p7, "login");
    ok(na7a.step === "verify" && /two tasks are numbered 1/.test(na7a.recommendation) && /Renumber the tasks in \.specs\/login\/tasks\.md/.test(na7a.recommendation) && /duplicate-tasks/.test(na7a.recommendation) &&
      !/--run/.test(na7a.recommendation) && rerun7.alreadyDone === true && na7b.recommendation === na7a.recommendation && na7c.step === "finish",
      "full review Gb7: an unverified task whose number another task shares → the verify step asks to renumber (duplicate-tasks), never 're-run task N --run' (which answers alreadyDone forever); once renumbered and run, the feature moves on to finish (got " +
      JSON.stringify([na7a.recommendation, rerun7.alreadyDone, na7c.step]) + ")");

    // Gb8: guard on / scope during Phase 4 (+tdd, test plan approved, tasks not yet approvable) — test files are covered, code still asks.
    for (const level of ["on", "scope"]) {
      const p8 = gbDir("guard-tests-" + level);
      S.initProject(p8, ["tdd"], "en", { guard: level });
      const f8 = S.createFeature(p8, "Shortener", ["tdd"], "", undefined, "en");
      const s8 = JSON.parse(gbR(f8.dir, ".state.json"));
      s8.approvals = { classification: { at: "2026-09-01T00:00:00.000Z", by: "u" }, requirements: { at: "2026-09-01T00:00:00.000Z", by: "u" }, design: { at: "2026-09-01T00:00:00.000Z", by: "u" }, "test-plan": { at: "2026-09-01T00:00:00.000Z", by: "u" } };
      gbW(f8.dir, ".state.json", JSON.stringify(s8, null, 2));
      const t8 = S.guardCheck(p8, "test/shortener.test.js");
      const c8 = S.guardCheck(p8, "src/shortener.js");
      ok(t8.decision === "allow" && t8.why === "tests-phase" && JSON.stringify(t8.covering) === '["shortener"]' && c8.decision === "ask" && c8.why === "no-approved-tasks",
        "full review Gb8 (" + level + "): with an approved test plan and unfinished tasks (Phase 4), a test file is allowed ('tests-phase') — the failing tests come before the tasks gate; a code file still asks (got " +
        JSON.stringify([t8.decision, t8.why, c8.decision, c8.why]) + ")");
    }

    // Gb9: guard during a spike — its prototype edits are covered (no tasks gate to approve), never "awaiting approval"; a decided, done spike covers nothing.
    for (const level of ["on", "scope"]) {
      const p9 = gbDir("guard-spike-" + level);
      S.initProject(p9, ["core"], "en", { guard: level });
      const sp9 = S.createFeature(p9, "cache spike", null, "", null, "en", "spike", { question: "Should we use Redis?", timebox: "3d" });
      const g9a = S.guardCheck(p9, "proto/redis.js");
      gbW(sp9.dir, "spike.md", gbR(sp9.dir, "spike.md").replace("> **TODO** — go / no-go / pivot, and why: the evidence that decided it.", "Go: Redis cut p95 latency by 40%.").replace("_Outcome: [go | no-go | pivot]_", "_Outcome: go_"));
      for (const n of [1, 2, 3, 4]) S.completeTask(p9, "cache-spike", n);
      const g9b = S.guardCheck(p9, "proto/redis.js");
      ok(g9a.decision === "allow" && g9a.why === "spike" && JSON.stringify(g9a.spikes) === '["cache-spike"]' &&
        g9b.decision === "ask" && !g9b.pending.includes("cache-spike") && !/cache-spike/.test(g9b.reason),
        "full review Gb9 (" + level + "): an active spike (undecided or with open tasks) covers prototype code edits ('spike'); a decided spike with every task done covers nothing — and a spike is never listed as awaiting a tasks approval it can't have (got " +
        JSON.stringify([g9a.decision, g9a.why, g9b.decision, g9b.pending, g9b.reason]) + ")");
    }

    // Gb10: a dependency (either way) exempts a pair with a FINISHED feature from the overlap warning, like an active pair.
    const p10 = gbDir("overlap");
    S.initProject(p10, ["core"], "en");
    const a10 = S.createFeature(p10, "Url shortener", ["core"], "", undefined, "en");
    gbW(a10.dir, "tasks.md", "- [x] 1. [US1] Shorten\n  - _Implements: src/shortener.js_\n");
    const sa10 = JSON.parse(gbR(a10.dir, ".state.json"));
    sa10.finished = { at: "2026-09-20T10:00:00.000Z", files: { "src/shortener.js": null } };
    gbW(a10.dir, ".state.json", JSON.stringify(sa10, null, 2));
    S.createFeature(p10, "Custom aliases", ["core"], "", undefined, "en");
    gbW(path.join(p10, ".specs", "custom-aliases"), "tasks.md", "- [ ] 1. [US1] Aliases\n  - _Implements: src/shortener.js_\n");
    const ov10a = S.featureOverlaps(p10).pairs;
    S.setDependency(p10, "custom-aliases", undefined, undefined, { add: "url-shortener" });
    const ov10b = S.featureOverlaps(p10).pairs;
    const doc10 = S.specDoctor(p10, "custom-aliases").checks.find((c) => c.id === "cross-feature-overlap");
    S.setDependency(p10, "custom-aliases", []);
    S.setDependency(p10, "url-shortener", ["custom-aliases"]);
    const ov10c = S.featureOverlaps(p10).pairs;
    ok(ov10a.length === 1 && ov10a[0].kind === "finished" && /spec_roadmap_edit {kind: "depend"/.test(S.msg("en").forecast.overlap.doctorFinished("x", "y")) && ov10b.length === 0 && doc10 === undefined && ov10c.length === 0,
      "full review Gb10: an active feature planning a finished feature's baseline files is no overlap once either depends on the other (the advice /depend works); undepended it is (got " +
      JSON.stringify([ov10a.map((x) => x.kind), ov10b.length, doc10 && doc10.status, ov10c.length]) + ")");

    // Gb11: impact names the role to re-approve as (meta.approvalRoles), in the result (missingRoles) and the printed lines / notes.
    const p11 = gbDir("impact-roles");
    S.initProject(p11, ["core"], "en", { approvalRoles: { requirements: ["product"] } });
    const f11 = gbFeature(p11, "login");
    const ff11 = S.approvePhase(p11, "login", null, "u", { through: "tasks", role: "product" });
    S.completeTask(p11, "login", 1, { command: gbRun, exitCode: 0 });
    gbW(f11.dir, "requirements.md", gbR(f11.dir, "requirements.md").replace("THE SYSTEM SHALL open a session", "THE SYSTEM SHALL open a session within 2 seconds"));
    const im11 = S.impactReport(p11, "login", { phase: "requirements" });
    const lines11 = S.impactLines(im11).join("\n");
    const re11 = S.impactReport(p11, "login", { phase: "requirements", reopen: true });
    ok(ff11.ok && im11.changed === true && JSON.stringify(im11.missingRoles) === '["product"]' && /→ review the change, then re-approve: \/approve login requirements --role product/.test(lines11) &&
      re11.ok && re11.reopened.includes(1) && /\/approve login requirements --role product\./.test(re11.note),
      "full review Gb11: spec_impact on a phase signed off per role names the role (missingRoles; '→ … /approve <f> <phase> --role <role>'; the --reopen note too) — the role-less command is refused (got " +
      JSON.stringify([im11.missingRoles, lines11.split("\n").pop(), re11.note]) + ")");

    // Gb12: a fast-forward stopped by a role error after approving earlier phases says what was recorded — never "Nothing recorded."
    const p12 = gbDir("ff-roles");
    S.initProject(p12, ["core"], "en", { approvalRoles: { requirements: ["product"], design: ["tech"] } });
    gbFeature(p12, "login");
    const ff12a = S.approvePhase(p12, "login", null, "u", { through: "tasks" });
    const ff12b = S.approvePhase(p12, "login", null, "u", { through: "tasks", role: "product" });
    ok(ff12a.ok === false && ff12a.stopReason === "role" && ff12a.stoppedAt === "requirements" && JSON.stringify(ff12a.approved) === '["classification"]' &&
      !/Nothing recorded/.test(ff12a.error) && /\(approved before it: classification\)/.test(ff12a.error) && /nothing was recorded for 'requirements'/.test(ff12a.error) && /--through tasks --role <role>/.test(ff12a.error) &&
      ff12b.ok === false && ff12b.stoppedAt === "design" && /'product' is not a role that signs off 'design' \(roles: tech\) — nothing was recorded for 'design'/.test(ff12b.error) && !/Nothing recorded/.test(ff12b.error),
      "full review Gb12: a fast-forward stopped by a role refusal names what it approved before and that nothing was recorded for the stopping phase — the approve refusal's 'Nothing recorded.' contradicted it (got " +
      JSON.stringify([ff12a.error, ff12b.error]) + ")");
  }

  // 1.14 feature (F2) — human approval guard.

  {
    const CLI_PATH = "/clone/cli/dev-spec.js";
    const D = (tool, input, level, lang) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: input }, level, { lang, cli: CLI_PATH });
    const kinds = (r) => (r.actions || []).map((a) => [a.kind, a.feature, a.phase || a.through || a.to, a.force ? "force" : ""].join(":")).join(",");
    // The helper: spec_approve under every MCP server prefix (Claude Code's plugin form, a project server, any name) or bare.
    const names = ["mcp__plugin_dev-spec-driven_spec-driven__spec_approve", "mcp__spec-driven__spec_approve", "mcp__spec_driven__spec_approve",
      "mcp__my-spec-driven-copy__spec_approve", "mcp__dev-spec__spec_approve", "spec_approve"];
    const notNames = ["mcp__spec-driven__spec_status", "mcp__spec-driven__spec_approve_all", "mcp__spec-driven__xspec_approve", "mcp____spec_approve_", "Write", "Edit", "Task"];
    const inp = { name: "checkout", phase: "design" };
    ok(names.every((n) => D(n, inp, "ask").decision === "ask" && D(n, inp, "deny").decision === "deny" && D(n, inp, "off").decision === "allow") &&
      notNames.every((n) => D(n, inp, "deny").decision === "allow") && D(names[0], inp, "deny").why === "approval" && D(names[0], inp, "off").why === "off" &&
      D(names[0], inp, "maybe").why === "off" && D("Write", { file_path: "x.js" }, "deny").why === "not-an-approval",
      "feature F2: spec_approve is caught under every MCP server prefix (mcp__plugin_<plugin>_<server>__, mcp__spec-driven__, any name) and bare; other tools, look-alike names and level off pass (got " +
      JSON.stringify(names.map((n) => D(n, inp, "ask").decision).concat(notNames.map((n) => D(n, inp, "deny").decision))) + ")");
    // ask names the feature, phase, role, approver and — loudly — force; deny tells the agent to stop and gives the human's command.
    const aF = D(names[0], { name: "checkout", phase: "design", role: "tech", by: "Ana", force: true }, "ask");
    const dF = D(names[1], { name: "checkout", phase: "design", role: "tech", force: true }, "deny");
    const dT = D(names[1], { name: "my feature", through: "tasks" }, "deny");
    ok(/the agent wants to approve the design phase of 'checkout' as tech in the name of 'Ana' — FORCED \(--force\)/.test(aF.reason) && /⚠ FORCE: /.test(aF.reason) && aF.force === true && aF.userNote === undefined &&
      /refused — approvals are the human's/.test(dF.reason) && /Stop and ask the user to run it themselves/.test(dF.reason) && /Do not retry it by another route/.test(dF.reason) &&
      dF.command === '! node "/clone/cli/dev-spec.js" approve checkout design --role tech --force' && dF.reason.includes(dF.command) && dF.userNote.includes(dF.command) &&
      /approve every phase of 'my feature' through tasks/.test(dT.reason) && dT.command === '! node "/clone/cli/dev-spec.js" approve "my feature" --through tasks' &&
      !/FORCE/.test(D(names[1], inp, "ask").reason),
      "feature F2: ask names feature, phase, role, approver and FORCE loudly; deny sends the agent back with the human's `! node <clone>/cli/dev-spec.js approve …` command (also in userNote); --through for a fast-forward (got " +
      JSON.stringify([aF.reason.slice(0, 160), dF.command, dT.command]) + ")");
    // spec_feature remove (confirm: true — a preview deletes nothing) and LOWERING the guard (spec_init) are approvals too.
    ok(D("mcp__spec-driven__spec_feature", { action: "remove", name: "checkout", confirm: true }, "ask").decision === "ask" &&
      D("mcp__spec-driven__spec_feature", { action: "Remove", name: "checkout", confirm: true }, "deny").command === '! node "/clone/cli/dev-spec.js" feature remove checkout --yes' &&
      D("mcp__spec-driven__spec_feature", { action: "remove", name: "checkout" }, "deny").decision === "allow" &&
      D("mcp__spec-driven__spec_feature", { action: "archive", name: "checkout" }, "deny").decision === "allow" &&
      kinds(D("mcp__spec-driven__spec_init", { approvalGuard: "OFF" }, "deny")) === "guard-down::off:" && D("mcp__spec-driven__spec_init", { approvalGuard: "ask" }, "deny").decision === "deny" &&
      D("mcp__spec-driven__spec_init", { approvalGuard: "deny" }, "ask").decision === "allow" && D("mcp__spec-driven__spec_init", { approvalGuard: "ask" }, "ask").decision === "allow" &&
      D("mcp__spec-driven__spec_init", { tracks: ["tdd"] }, "deny").decision === "allow" && /lower the approval guard from deny to off/.test(D("mcp__spec-driven__spec_init", { approvalGuard: "off" }, "deny").reason),
      "feature F2: spec_feature remove with confirm is guarded (a preview, archive are not); spec_init lowering the guard is guarded, raising it or leaving it is not");
    // Bash / PowerShell: the CLI's approve in every shape — and never the word "approve" in unrelated text.
    const bashYes = {
      "dev-spec approve checkout requirements": "approve:checkout:requirements:",
      "node cli/dev-spec.js approve checkout design": "approve:checkout:design:",
      'node "C:/Users/x/CLAUDE SKILLS/dev-spec-driven/cli/dev-spec.js" approve checkout tasks --force': "approve:checkout:tasks:force",
      "cd /repo && node ./cli/dev-spec.js --json approve 'my feature' requirements": "approve:my feature:requirements:",
      [String.raw`npm test; node cli\dev-spec.js approve checkout requirements`]: "approve:checkout:requirements:",
      'bash -c "node cli/dev-spec.js approve checkout requirements"': "approve:checkout:requirements:",
      [String.raw`cmd /c "node C:\x\cli\dev-spec.js approve checkout design --force=yes"`]: "approve:checkout:design:force",
      'pwsh -Command "& node cli/dev-spec.js approve a b"': "approve:a:b:",
      "node cli/dev-spec.js --project /p approve checkout --through tasks": "approve:checkout:tasks:",
      "echo ok && node cli/dev-spec.js approve checkout requirements --role=product": "approve:checkout:requirements:",
      "SPEC_PROJECT_DIR=/p timeout 30 node cli/dev-spec.js approve checkout requirements": "approve:checkout:requirements:",
      "x=$(node cli/dev-spec.js approve a b --force=false)": "approve:a:b:",
      '! node "/clone/cli/dev-spec.js" approve checkout design --force': "approve:checkout:design:force",
      "node cli/dev-spec.js feature remove checkout --yes": "remove:checkout::",
      "node cli/dev-spec.js approve a b\nnode cli/dev-spec.js approve a c --force": "approve:a:b:,approve:a:c:force",
    };
    const bashNo = ['git commit -m "dev-spec approve the design"', 'echo "dev-spec approve checkout requirements"', "echo dev-spec approve x y",
      'grep -rn "dev-spec approve" .', "node cli/dev-spec.js help approve", "node cli/dev-spec.js approve checkout design --help",
      "node cli/dev-spec.js create approve", "node cli/dev-spec.js status checkout", "node cli/dev-spec.js feature remove checkout",
      "node cli/dev-spec.js init --approval-guard deny", "npm run approve", "ls dev-spec-approve/"];
    const yesGot = Object.keys(bashYes).map((c) => [D("Bash", { command: c }, "ask").decision, kinds(D("Bash", { command: c }, "ask"))]);
    const noGot = bashNo.map((c) => D("Bash", { command: c }, "deny").decision);
    ok(Object.values(bashYes).every((k, i) => yesGot[i][0] === "ask" && yesGot[i][1] === k) && noGot.every((d) => d === "allow") &&
      D("PowerShell", { command: String.raw`& node "C:\x\cli\dev-spec.js" approve checkout requirements` }, "deny").decision === "deny" &&
      kinds(D("Bash", { command: "node cli/dev-spec.js init --approval-guard=off" }, "deny")) === "guard-down::off:",
      "feature F2: Bash / PowerShell running the CLI's approve (quotes, && / ; / newline chains, bash -c, cmd /c, pwsh -Command, $( ), env / timeout / ! prefixes, --force[=yes|false]) is caught; the word in a commit message, echo, grep, help, a preview is not (got " +
      JSON.stringify([yesGot.filter((g, i) => g[0] !== "ask" || g[1] !== Object.values(bashYes)[i]), noGot]) + ")");
    // Localized (the project's language) — EN / PT / pt-BR / ES; values from the agent's call never reach the command unquoted.
    const loc = (lang, lvl) => D(names[1], { name: "checkout", phase: "design", force: true }, lvl, lang).reason;
    const inj = D(names[1], { name: 'x"; rm -rf ~', phase: "$(evil)", role: "a`b`", projectDir: String.raw`C:\My Proj\p` }, "deny");
    ok(/the agent wants to approve the design phase of 'checkout'/.test(loc("en", "ask")) && /o agente quer aprovar a fase design de 'checkout' — FORÇADA/.test(loc("pt", "ask")) &&
      /confirma só se aprovares/.test(loc("pt", "ask")) && /confirme só se você aprovar/.test(loc("pt-BR", "ask")) && /Peça ao usuário/.test(loc("pt-BR", "deny")) &&
      /el agente quiere aprobar la fase design de 'checkout' — FORZADA/.test(loc("es", "ask")) && /rechazado — las aprobaciones son de la persona/.test(loc("es", "deny")) &&
      /recusado — as aprovações são da pessoa/.test(loc("pt", "deny")) &&
      inj.command === '! node "/clone/cli/dev-spec.js" approve <feature> <phase> --role <role> --project "C:/My Proj/p"',
      "feature F2: the reasons are localized (EN / PT / pt-BR / ES); an unsafe value from the call becomes a <placeholder> in the suggested command (got " + JSON.stringify(inj.command) + ")");

    // The hook process (hooks/approval-hook.js): silent unless the project's meta.approvalGuard is ask / deny.
    const hookJs = path.join(__dirname, "..", "hooks", "approval-hook.js");
    const runHook = (input, env) => spawnSync(process.execPath, [hookJs], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", ...(env || {}) }, timeout: 15000 });
    const pre = (cwd, tool, input) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: input });
    const decided = (r) => { try { const h = JSON.parse(r.stdout).hookSpecificOutput; return h.hookEventName === "PreToolUse" && r.status === 0 ? h.permissionDecision + "|" + h.permissionDecisionReason : null; } catch { return null; } };
    const silent = (r) => r.status === 0 && r.stdout === "" && !r.error;
    const pAsk = path.join(tmp, "proj-f2-ask"), pDenyPt = path.join(tmp, "proj-f2-deny-pt"), pDenyEs = path.join(tmp, "proj-f2-deny-es"), pOff = path.join(tmp, "proj-f2-off"), pNone = path.join(tmp, "proj-f2-none");
    const iAsk = S.initProject(pAsk, ["core"], "en", { approvalGuard: "ask" });
    S.initProject(pDenyPt, ["core"], "pt", { approvalGuard: "deny" });
    S.initProject(pDenyEs, ["core"], "es", { approvalGuard: "DENY" });
    const iOff = S.initProject(pOff, ["core"], "en");
    fs.mkdirSync(pNone, { recursive: true });
    const approveCall = (cwd, input) => pre(cwd, "mcp__plugin_dev-spec-driven_spec-driven__spec_approve", input || { name: "checkout", phase: "requirements", force: true });
    const hAsk = runHook(approveCall(pAsk));
    const hPt = runHook(approveCall(pDenyPt));
    const hEs = runHook(pre(pDenyEs, "Bash", { command: "node cli/dev-spec.js approve pagos design" }));
    let ptJson = {};
    try { ptJson = JSON.parse(hPt.stdout); } catch { /* checked below */ }
    ok(iAsk.approvalGuard === "ask" && iOff.approvalGuard === "off" && /^ask\|dev-spec approval guard: the agent wants to approve the requirements phase of 'checkout' — FORCED/.test(decided(hAsk) || "") &&
      /^deny\|dev-spec approval guard: recusado — as aprovações são da pessoa/.test(decided(hPt) || "") && /cli\/dev-spec\.js" approve checkout requirements --force/.test(decided(hPt) || "") &&
      /recusou o pedido de um agente/.test(ptJson.systemMessage || "") && /^deny\|dev-spec approval guard: rechazado/.test(decided(hEs) || "") &&
      silent(runHook(approveCall(pOff))) && silent(runHook(approveCall(pNone))),
      "feature F2: the hook answers ask (EN) / deny (PT, + a systemMessage with the command for the user) / deny (ES, a Bash `dev-spec approve`) as valid JSON; a project with the guard off or no .specs/ gets nothing (got " +
      JSON.stringify([decided(hAsk), (decided(hPt) || "").slice(0, 60), (decided(hEs) || "").slice(0, 60), hAsk.stderr]) + ")");
    // Which project: the one the call names (MCP projectDir / CLI --project), the session cwd, CLAUDE_PROJECT_DIR — the strictest wins.
    const hNamed = runHook(pre(pOff, "mcp__spec-driven__spec_approve", { name: "x", phase: "design", projectDir: pDenyPt }));
    const hFlag = runHook(pre(pOff, "Bash", { command: 'node cli/dev-spec.js approve x design --project "' + pAsk + '"' }));
    const hEnv = runHook({ hook_event_name: "PreToolUse", tool_name: "spec_approve", tool_input: { name: "x", phase: "design" } }, { CLAUDE_PROJECT_DIR: pAsk });
    const t0 = Date.now();
    const hNet = runHook(pre(pOff, "mcp__spec-driven__spec_approve", { name: "x", phase: "design", projectDir: "//unreachable-host-f2.invalid/share/p" }));
    ok(/^deny\|/.test(decided(hNamed) || "") && /^ask\|/.test(decided(hFlag) || "") && /^ask\|/.test(decided(hEnv) || "") && silent(hNet) && Date.now() - t0 < 10000,
      "feature F2: the hook checks the project the call names (projectDir, --project) and the session's (cwd, CLAUDE_PROJECT_DIR) — the strictest level wins; a network projectDir is never read (got " +
      JSON.stringify([decided(hNamed), decided(hFlag), decided(hEnv), hNet.stdout]) + ")");
    // Never blocks on its own trouble: malformed / empty / huge stdin, a wrong shape, another event, a broken roadmap.json that names
    // no guard level → exit 0, silent. (A broken one that still names "approvalGuard": "deny" fails CLOSED — review R1 below.)
    const pBroken = path.join(tmp, "proj-f2-broken");
    fs.mkdirSync(path.join(pBroken, ".specs"), { recursive: true });
    fs.writeFileSync(path.join(pBroken, ".specs", "roadmap.json"), '{"meta": {"lang": "en"');
    const odd = ["{not json", "", "[1,2]", "null", "42", JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: "node cli/dev-spec.js approve a b", cwd: pAsk }),
      JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "spec_approve", tool_input: { name: "a", phase: "design" }, cwd: pAsk }),
      JSON.stringify(pre(pAsk, "Bash", { command: "npm test && git status" })), JSON.stringify(pre(pAsk, "Bash", { command: 12 })),
      JSON.stringify(approveCall(pBroken)), "x".repeat(3 * 1024 * 1024), JSON.stringify(pre(pAsk, "Bash", { command: "echo dev-spec " + "a ".repeat(400000) }))];
    const oddGot = odd.map((s) => runHook(s));
    ok(oddGot.every(silent) && !fs.readFileSync(hookJs, "utf8").includes(String.fromCharCode(0xfeff)),
      "feature F2: malformed / empty / 3 MB stdin, a non-object payload or tool_input, another event, a command that runs no approval and a broken roadmap.json → exit 0, no output (got " +
      JSON.stringify(oddGot.map((r) => [r.status, r.stdout.slice(0, 40)])) + ")");
    // hooks.json: the guard stays first; the approval hook is a PreToolUse entry whose matcher (an anchored regex) covers the shell
    // tools and the approve-shaped MCP tools only; every hook command names a script that exists.
    const hooksCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8")).hooks;
    // (1.25.1: exec form — `node` + the script as its one argument; hookLine reads both forms' words)
    const hookLine = (h) => [h.command, ...(Array.isArray(h.args) ? h.args : [])].join(" ");
    const apCfg = (hooksCfg.PreToolUse || []).find((e) => e.hooks && e.hooks.some((h) => /approval-hook\.js/.test(hookLine(h)))) || {};
    let mre = null;
    try { mre = new RegExp(apCfg.matcher); } catch { /* checked below */ }
    const scripts = Object.values(hooksCfg).flat().flatMap((e) => e.hooks.map((h) => (/\$\{CLAUDE_PLUGIN_ROOT\}\/(hooks\/[\w.-]+\.js)/.exec(hookLine(h)) || [])[1]));
    ok(mre && hookLine(hooksCfg.PreToolUse[0].hooks[0]).includes("guard-hook.js") && hookLine(apCfg.hooks[0]) === "node ${CLAUDE_PLUGIN_ROOT}/hooks/approval-hook.js" && apCfg.hooks[0].timeout === 10 &&
      names.concat(["Bash", "PowerShell", "Monitor", "Write", "Edit", "mcp__spec-driven__spec_feature", "mcp__plugin_dev-spec-driven_spec-driven__spec_init",
        // 1.25.1 (review 7): NotebookEdit and another MCP server's file tools (by the verb in the name — never dev-spec's own tools)
        "NotebookEdit", "mcp__filesystem__write_file", "mcp__desktop-commander__edit_block", "mcp__filesystem__move_file", "mcp__x__str-replace"]).every((n) => mre.test(n)) &&
      ["BashOutput", "mcp__spec-driven__spec_status", "mcp__spec-driven__spec_approve_all", "WebFetch", "xBash", "MonitorX", "Read", "mcp__spec-driven__spec_create",
        "mcp__plugin_dev-spec-driven_spec-driven__spec_append_tasks", "mcp__linear__get_issue"].every((n) => !mre.test(n)) &&
      scripts.length >= 6 && scripts.every((s) => s && fs.existsSync(path.join(__dirname, "..", s))),
      "feature F2: hooks.json wires hooks/approval-hook.js as PreToolUse (timeout 10) after the guard, its anchored matcher covering Bash, PowerShell, Monitor (1.23), Write / Edit (1.23: .specs/roadmap.json, .state.json) and spec_approve / spec_feature / spec_init under any MCP prefix only; every hook command names an existing script (got " +
      JSON.stringify([apCfg.matcher, scripts]) + ")");

    // spec_init over MCP: approvalGuard is a plain string enum (folded), always reported, refused when it is anything else.
    const pMcp = path.join(tmp, "proj-f2-mcp");
    const initSchema = ((await rpc("tools/list", {})).result.tools.find((t) => t.name === "spec_init") || {}).inputSchema || {};
    const ag = (initSchema.properties || {}).approvalGuard || {};
    const m1 = await rpc("tools/call", { name: "spec_init", arguments: { approvalGuard: "DENY", projectDir: pMcp } });
    const rmAfter1 = JSON.parse(fs.readFileSync(path.join(pMcp, ".specs", "roadmap.json"), "utf8")).meta.approvalGuard;
    const m2 = await rpc("tools/call", { name: "spec_init", arguments: { projectDir: pMcp } });
    const m3 = await rpc("tools/call", { name: "spec_init", arguments: { approvalGuard: "maybe", projectDir: pMcp } });
    const m4 = await rpc("tools/call", { name: "spec_init", arguments: { approvalGuard: true, projectDir: pMcp } });
    // 1.21 F1b: at deny, an MCP client that can't ask its user (this harness declares no elicitation) can't lower the guard — the
    // server refuses it (humanRequired + the command); the human lowers it to ask (their CLI), then lowering to off runs as before.
    const m5d = await rpc("tools/call", { name: "spec_init", arguments: { approvalGuard: "off", projectDir: pMcp, lang: "es" } });
    const r5d = payload(m5d);
    const stillDeny = JSON.parse(fs.readFileSync(path.join(pMcp, ".specs", "roadmap.json"), "utf8")).meta.approvalGuard;
    S.initProject(pMcp, [], undefined, { approvalGuard: "ask" });
    const m5 = await rpc("tools/call", { name: "spec_init", arguments: { approvalGuard: "off", projectDir: pMcp, lang: "es" } });
    const r1 = payload(m1), r2 = payload(m2), r5 = payload(m5);
    ok(ag.type === "string" && JSON.stringify(ag.enum) === '["off","ask","deny"]' && r1.approvalGuard === "deny" && /^Approval guard DENY/.test(r1.approvalGuardNote) &&
      rmAfter1 === "deny" && r2.approvalGuard === "deny" && r2.approvalGuardNote === undefined &&
      m3.result.isError === true && m4.result.isError === true && r5.approvalGuard === "off" && /^Guardia de aprobaciones DESACTIVADA/.test(r5.approvalGuardNote) &&
      m5d.result.isError === true && r5d.humanRequired === true && r5d.approvalGuard === "deny" && stillDeny === "deny" && /init --approval-guard off/.test(r5d.command || ""),
      "feature F2: spec_init {approvalGuard} — a string enum off | ask | deny (case-folded), stored in roadmap.json meta.approvalGuard, always reported (+ a localized note when set); another value or a boolean is refused; 1.21 F1b: lowering deny over MCP without elicitation is refused (got " +
      JSON.stringify([ag, r1.approvalGuard, r2.approvalGuard, m3.result.isError, m4.result.isError, r5.approvalGuardNote, r5d.humanRequired, stillDeny]) + ")");
  }

  // 1.14 feature (F2) — review fixes: the shell lexer reads the tool's shell (R3), heredoc bodies are data (R9), guard-down actions
  // (R10), fail closed on a broken roadmap.json and on a shell write of it (R1).
  {
    const CLI_PATH = "/clone/cli/dev-spec.js";
    const D = (tool, input, level, opts) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: input }, level || "deny", Object.assign({ cli: CLI_PATH }, opts));
    const sh = (command, tool, opts) => D(tool || "Bash", { command }, "deny", opts);
    const kinds = (r) => (r.actions || []).map((a) => [a.kind, a.setting || "", a.feature || "", a.phase || a.through || (typeof a.to === "string" ? a.to : a.to === null ? "-" : ""), a.force ? "force" : ""].join(":")).join(",");
    const BS = "\\", NL = "\n", CRLF = "\r\n";
    const OK_APPROVE = "approve::login:requirements:";

    // R3: Bash escapes / line continuations / ANSI-C quoting, PowerShell's backtick, cmd's caret; launchers with value options and
    // bin runners; a substitution or a redirection before the program.
    const r3Yes = {
      Bash: ["node cli/dev-spec.js " + BS + NL + "  approve login requirements", "node cli/dev-spec.js " + BS + CRLF + "  approve login requirements",
        "node cli/dev-spec.js a" + BS + "pprove login requirements", "node cli/dev-spec.js $'approve' login requirements",
        "node cli/dev-spec.js $'" + BS + "x61pprove' login requirements", "node cli/dev" + BS + "-spec.js approve login requirements",
        "node cli/d'e'v-spec.js approve login requirements", "sudo -u bob node cli/dev-spec.js approve login requirements",
        "sudo --user=bob -- node cli/dev-spec.js approve login requirements", "doas -u bob node cli/dev-spec.js approve login requirements",
        "exec -a x node cli/dev-spec.js approve login requirements", "node -r ./x.js cli/dev-spec.js approve login requirements",
        "node --require ./x.js cli/dev-spec.js approve login requirements", "timeout -s KILL 30 node cli/dev-spec.js approve login requirements",
        "npm exec -- dev-spec approve login requirements", "npm x dev-spec approve login requirements", "pnpm dlx dev-spec approve login requirements",
        "yarn dlx dev-spec approve login requirements", "bunx dev-spec approve login requirements", "bun x dev-spec approve login requirements",
        "deno run -A cli/dev-spec.js approve login requirements", "env -S 'node cli/dev-spec.js approve login requirements'",
        "npx -c 'dev-spec approve login requirements'", 'echo "$(node cli/dev-spec.js approve login requirements)"',
        "$(command -v node) cli/dev-spec.js approve login requirements", "$NODE cli/dev-spec.js approve login requirements",
        ">log.txt node cli/dev-spec.js approve login requirements", 'cmd /c "node cli' + BS + 'dev-spec.js ap^prove login requirements"',
        "node C:" + BS + "repo" + BS + "cli" + BS + "dev-spec.js approve login requirements", "n=${#x}; node cli/dev-spec.js approve login requirements"],
      PowerShell: ["node cli/dev-spec.js ap`prove login requirements", "node cli/dev-spec.js `" + NL + "  approve login requirements",
        "node cli/dev-spec.js `" + CRLF + "  approve login requirements", '& node "C:' + BS + "repo" + BS + "cli" + BS + 'dev-spec.js" approve login requirements',
        '$m = @"' + NL + "$(node cli/dev-spec.js approve login requirements)" + NL + '"@', "Start-Process node -ArgumentList 'cli/dev-spec.js approve login requirements'"],
    };
    const r3No = {
      Bash: ["npm install dev-spec", "npm run approve", "yarn add dev-spec", "pnpm add dev-spec", "echo $'dev-spec approve login requirements'",
        "# node cli/dev-spec.js approve login requirements" + NL + "echo hi", "echo x # ; node cli/dev-spec.js approve login requirements",
        "git commit -m 'feat: `dev-spec approve x y` now asks'", "printf '%s" + BS + "n' 'dev-spec approve x y'", "sudo -u bob echo dev-spec approve x y"],
      PowerShell: ["<# node cli/dev-spec.js approve login requirements #> echo hi", 'echo `"dev-spec approve x y`"', "git commit -m 'dev-spec approve x y'",
        "# node cli/dev-spec.js approve login requirements", "git commit -m @'" + NL + "fix: it's `dev-spec approve x y` now" + NL + "'@"],
    };
    const r3Bad = Object.entries(r3Yes).flatMap(([tool, list]) => list.map((c) => [tool, c, kinds(sh(c, tool))])).filter(([, , k]) => k !== OK_APPROVE);
    const r3NoBad = Object.entries(r3No).flatMap(([tool, list]) => list.filter((c) => sh(c, tool).decision !== "allow").map((c) => [tool, c]));
    ok(r3Bad.length === 0 && r3NoBad.length === 0,
      "feature F2 review R3: the lexer reads the tool's shell — Bash \\⏎ continuation, \\x escapes, $'…' (ANSI-C), PowerShell's backtick (escape and `⏎), cmd's ^; launchers with value options (sudo -u, doas -u, exec -a, node -r / --require, timeout -s) and bin runners (npm exec / x, pnpm dlx, yarn dlx, bunx, bun x, deno run, env -S, npx -c), \"$( )\", a substitution / variable / redirection before the program → caught; npm install / run, yarn add, echo $'…', # and <# #> comments, a quoted commit message, a PowerShell here-string → not (got " +
      JSON.stringify([r3Bad, r3NoBad]) + ")");
    const n64 = 64 * 1024;
    const r3Times = ["$(".repeat(n64 / 2), BS.repeat(n64), "`".repeat(n64), "<<EOF" + NL.repeat(n64 / 2), "$'" + BS.repeat(n64), '"$('.repeat(n64 / 3), "${".repeat(n64 / 2),
      "${$(".repeat(n64 / 4), "a<<b ".repeat(n64 / 5) + NL + "x", '@"' + NL + "$(".repeat(n64 / 2), "`$(".repeat(n64 / 3), ("x" + NL).repeat(n64 / 2)]
      .map((c) => { const t0 = Date.now(); sh("dev-spec " + c); sh("dev-spec " + c, "PowerShell"); sh("cmd /c \"dev-spec " + c + "\""); return Date.now() - t0; });
    ok(r3Times.every((t) => t < 2000), "feature F2 review R3: the lexer stays linear on 64 KB of $( / \\ / ` / heredocs / $' / \"$( / ${ / here-strings (each < 2 s, got " + JSON.stringify(r3Times) + " ms)");

    // R9: a heredoc body is data — skipped (<<'EOF', <<"EOF", <<\EOF, <<-EOF), read only for $( ) / `…` when unquoted, or as the
    // script when fed to a shell (bash <<EOF, sh <<<); what follows the terminator is a command again.
    const r9No = ["cat > docs.md <<'EOF'" + NL + "Run:" + NL + "dev-spec approve login requirements" + NL + "EOF",
      "cat > docs.md <<'EOF'" + NL + "Run `dev-spec approve login requirements` to approve." + NL + "EOF",
      "git commit -F - <<'EOF'" + NL + "feat: gate the approval" + NL + NL + "`dev-spec approve login requirements` asks" + NL + "EOF",
      'git commit -F - <<"EOF"' + NL + "`dev-spec approve login requirements` asks" + NL + "EOF",
      "cat <<" + BS + "EOF" + NL + "$(node cli/dev-spec.js approve login requirements)" + NL + "EOF",
      "cat <<-'EOF' > x.md" + NL + "\tnode cli/dev-spec.js approve login requirements" + NL + "\tEOF",
      "cat <<'EOF' > x.md" + CRLF + "node cli/dev-spec.js approve login requirements" + CRLF + "EOF" + CRLF,
      'git commit -m "$(cat <<\'EOF\'' + NL + "feat: dev-spec approve x y now asks" + NL + "`dev-spec approve login requirements`" + NL + "EOF" + NL + ')"',
      "cat <<EOF > notes.md" + NL + "dev-spec approve login requirements" + NL + "EOF"];
    const r9Yes = ["cat > docs.md <<'EOF'" + NL + "dev-spec approve a b" + NL + "EOF" + NL + "node cli/dev-spec.js approve login requirements",
      "cat <<'A' <<'B'" + NL + "x" + NL + "A" + NL + "dev-spec approve a b" + NL + "B" + NL + "node cli/dev-spec.js approve login requirements",
      "cat <<EOF" + NL + "$(node cli/dev-spec.js approve login requirements)" + NL + "EOF",
      "cat <<EOF" + NL + "`node cli/dev-spec.js approve login requirements`" + NL + "EOF",
      "bash <<'EOF'" + NL + "node cli/dev-spec.js approve login requirements" + NL + "EOF",
      "sudo sh <<'EOF'" + NL + "cd /repo" + NL + "node cli/dev-spec.js approve login requirements" + NL + "EOF",
      "sh <<< 'node cli/dev-spec.js approve login requirements'",
      "((x = 1 << 2))" + NL + "node cli/dev-spec.js approve login requirements", "echo $((1 << 2))" + NL + "node cli/dev-spec.js approve login requirements",
      'git commit -m "feat: `node cli/dev-spec.js approve login requirements`"'];
    const r9NoBad = r9No.filter((c) => sh(c).decision !== "allow");
    const r9Bad = r9Yes.map((c) => [c, kinds(sh(c))]).filter(([, k]) => k !== OK_APPROVE);
    ok(r9NoBad.length === 0 && r9Bad.length === 0,
      "feature F2 review R9: heredoc bodies are data (cat > docs.md <<'EOF', git commit -F - <<'EOF' with `dev-spec approve …` in backticks, <<\"EOF\", <<\\EOF, <<-EOF, CRLF, the -m \"$(cat <<'EOF' … EOF)\" form); an unquoted body's $( ) / `…`, a body fed to a shell (bash / sudo sh <<EOF, sh <<<), the command after the terminator and `…` inside \"…\" still run (got " +
      JSON.stringify([r9NoBad, r9Bad]) + ")");

    // R10: guard-down actions — weakening what the guard stands for, through spec_init and `dev-spec init` alike, compared with the
    // project's meta (opts.meta — the hook passes roadmap.json's); raising or adding stays allowed; unknown meta → fail closed.
    const meta = { evidence: "observed", approvalRoles: { design: ["tech", "security"], requirements: ["product"] }, checks: { test: "npm test" }, stopCheck: true, guard: "scope" };
    const init = (input, m, lang) => D("mcp__plugin_dev-spec-driven_spec-driven__spec_init", input, "deny", { meta: m === undefined ? meta : m, lang });
    const cliInit = (args, m, lang) => sh("node cli/dev-spec.js init " + args, "Bash", { meta: m === undefined ? meta : m, lang });
    const r10Yes = [[init({ evidence: "reported" }), "guard-down:evidence::reported:"], [init({ evidence: " REPORTED " }), "guard-down:evidence::reported:"],
      [init({ approvalRoles: {} }), "guard-down:roles:::"], [init({ approvalRoles: { design: ["tech"], requirements: ["product"] } }), "guard-down:roles:::"],
      [init({ checks: { test: "" } }), "guard-down:check::-:"], [init({ checks: { test: null } }), "guard-down:check::-:"], [init({ checks: { test: "exit 0" } }), "guard-down:check::exit 0:"],
      [init({ stopCheck: false }), "guard-down:stopCheck::off:"], [init({ guard: "off" }), "guard-down:guard::off:"], [init({ guard: true }), "guard-down:guard::on:"],
      [init({ guard: false }), "guard-down:guard::off:"], [init({ evidence: "reported" }, null), "guard-down:evidence::reported:"],
      [cliInit("--evidence reported"), "guard-down:evidence::reported:"], [cliInit("--evidence=reported"), "guard-down:evidence::reported:"],
      [cliInit("--roles none"), "guard-down:roles:::"], [cliInit("--roles requirements=product"), "guard-down:roles:::"],
      [cliInit("--check test="), "guard-down:check::-:"], [cliInit("--check=test="), "guard-down:check::-:"], [cliInit("--check 'test=exit 0'"), "guard-down:check::exit 0:"],
      [cliInit("--stop-check off"), "guard-down:stopCheck::off:"], [cliInit("--guard off"), "guard-down:guard::off:"], [cliInit("--stop-check=no", null), "guard-down:stopCheck::off:"],
      [cliInit("--approval-guard ask --evidence reported"), "guard-down:approvalGuard::ask:,guard-down:evidence::reported:"]];
    const r10No = [init({ evidence: "observed" }), init({ evidence: "reported" }, {}), init({ approvalRoles: { design: ["tech", "security", "legal"], requirements: ["product"], tasks: ["lead"] } }),
      init({ checks: { lint: "eslint ." } }), init({ checks: { test: "npm test" } }), init({ checks: { lint: "" } }), init({ stopCheck: true }), init({ stopCheck: false }, { stopCheck: false }),
      init({ guard: "scope" }), init({ tracks: ["tdd"] }), init({ approvalRoles: { bogus: ["x"] } }), init({ checks: { "bad name": "" } }),
      cliInit("--evidence observed"), cliInit("--check lint=eslint"), cliInit("--stop-check on"), cliInit("--guard scope"), cliInit("--check test"),
      cliInit('--roles "design=tech+security+legal,requirements=product"'), cliInit("--roles none", {}), cliInit("--evidence reported --help")];
    const r10Bad = r10Yes.map(([r, want], i) => [i, kinds(r), want]).filter(([, got, want]) => got !== want);
    const r10NoBad = r10No.map((r, i) => [i, r.decision, kinds(r)]).filter(([, d]) => d !== "allow");
    ok(r10Bad.length === 0 && r10NoBad.length === 0,
      "feature F2 review R10: guard-down actions (MCP spec_init and CLI init alike) — evidence observed → reported, roles cleared or a required role dropped, a project check removed or its command changed, the stop gate off, the edit guard lowered; unknown meta fails closed; raising / adding / a no-op / a refused value / --help → allowed (got " +
      JSON.stringify([r10Bad, r10NoBad]) + ")");
    const dEv = init({ evidence: "reported" });
    const dRoles = init({ approvalRoles: { design: ["tech"], requirements: ["product"] } });
    const dClear = cliInit("--roles none");
    const dCheck = init({ checks: { test: "" } });
    const dCheckCmd = init({ checks: { test: "rm -rf $HOME" } });
    const dMulti = cliInit("--approval-guard off --evidence reported --stop-check off");
    ok(dEv.command === '! node "/clone/cli/dev-spec.js" init --evidence reported' && /may not switch the evidence mode \(meta\.evidence\) back to reported/.test(dEv.reason) &&
      /drop required approval roles \(design=security\) from meta\.approvalRoles/.test(dRoles.reason) && dRoles.command === '! node "/clone/cli/dev-spec.js" init --roles "requirements=product,design=tech"' &&
      /clear the approval roles/.test(dClear.reason) && dClear.command === '! node "/clone/cli/dev-spec.js" init --roles none' &&
      /remove the project check 'test' \(meta\.checks\)/.test(dCheck.reason) && dCheck.command === '! node "/clone/cli/dev-spec.js" init --check "test="' &&
      /change the command of the project check 'test'/.test(dCheckCmd.reason) && dCheckCmd.command === '! node "/clone/cli/dev-spec.js" init --check "test=<command>"' &&
      dMulti.command === '! node "/clone/cli/dev-spec.js" init --approval-guard off && node "/clone/cli/dev-spec.js" init --evidence reported && node "/clone/cli/dev-spec.js" init --stop-check off' &&
      /lower the approval guard from deny to off; switch the evidence mode .*; turn off the end-of-turn evidence gate/.test(dMulti.reason) &&
      /voltar a pôr o modo de evidência \(meta\.evidence\) em reported/.test(init({ evidence: "reported" }, meta, "pt").reason) &&
      /retirar papéis de aprovação exigidos \(design=security\)/.test(init({ approvalRoles: { design: ["tech"], requirements: ["product"] } }, meta, "pt-BR").reason) &&
      /Peça ao usuário/.test(init({ stopCheck: false }, meta, "pt-BR").reason) && /volver a poner el modo de evidencia/.test(init({ evidence: "reported" }, meta, "es").reason) &&
      /eliminar la verificación del proyecto 'test'/.test(cliInit("--check test=", meta, "es").reason) && /desligar o gate de evidência/.test(cliInit("--stop-check off", meta, "pt").reason),
      "feature F2 review R10: a guard-down reason names what weakens (EN / PT / pt-BR / ES) and the human's command is the same init change (an unsafe check command → <command>); several at once are listed and chained (got " +
      JSON.stringify([dEv.command, dRoles.command, dCheckCmd.command, dMulti.command]) + ")");

    // R1: fail closed — a roadmap.json that exists but doesn't parse keeps the strictest level its text names; a shell command that
    // writes, moves or deletes .specs/roadmap.json (or .specs/ itself) is a guard-down action (no command to hand over).
    const r1Yes = [["Bash", "echo x >> .specs/roadmap.json"], ["Bash", "echo '{}' > ./.specs/roadmap.json"], ["Bash", "echo x > .specs" + BS + "roadmap.json"],
      ["Bash", "echo x 1>>.specs/roadmap.json"], ["Bash", "echo x &> .specs/roadmap.json"], ["Bash", "sed -i 's/deny/off/' .specs/roadmap.json"],
      ["Bash", "perl -pi -e 's/deny/off/' .specs/roadmap.json"], ["Bash", "echo '{}' | tee .specs/roadmap.json"],
      ["Bash", "jq '.meta.approvalGuard=\"off\"' .specs/roadmap.json > t && mv t .specs/roadmap.json"], ["Bash", "cp /tmp/r.json .specs/roadmap.json"],
      ["Bash", "cp /tmp/roadmap.json .specs/"], ["Bash", "rm .specs/roadmap.json"], ["Bash", "rm -rf .specs"], ["Bash", "mv .specs .specs-old"],
      ["Bash", "truncate -s 0 .specs/roadmap.json"], ["Bash", "dd if=/dev/null of=.specs/roadmap.json"], ["Bash", 'cmd /c "echo x > .specs' + BS + 'roadmap.json"'],
      ["Bash", "bash -c 'echo {} > .specs/roadmap.json'"], ["PowerShell", "Set-Content .specs/roadmap.json '{}'"],
      ["PowerShell", "'{}' | Out-File -FilePath .specs" + BS + "roadmap.json"], ["PowerShell", "Add-Content -Path .specs/roadmap.json -Value x"],
      ["PowerShell", "Copy-Item -Path x.json -Destination .specs/roadmap.json"], ["PowerShell", "Remove-Item -Recurse .specs"], ["PowerShell", "echo x > .specs/roadmap.json"]];
    const r1No = [["Bash", "cat .specs/roadmap.json"], ["Bash", "jq . .specs/roadmap.json > /tmp/x"], ["Bash", "cp .specs/roadmap.json /tmp/backup.json"],
      ["Bash", "git add .specs/roadmap.json"], ["Bash", "sed 's/a/b/' .specs/roadmap.json"], ["Bash", "mv notes.md .specs/"], ["Bash", "rm -rf .specs/checkout/.execution"],
      ["Bash", "node cli/dev-spec.js status > .specs/status.txt"], ["Bash", "ls .specs"], ["Bash", "grep -n approvalGuard .specs/roadmap.json"],
      ["PowerShell", "Get-Content .specs/roadmap.json"], ["PowerShell", "Copy-Item .specs/roadmap.json backup.json"]];
    const r1Bad = r1Yes.map(([t, c]) => [t, c, kinds(sh(c, t))]).filter(([, , k]) => k !== "guard-down:roadmap:::");
    const r1NoBad = r1No.filter(([t, c]) => sh(c, t).decision !== "allow");
    const dW = sh("echo x >> .specs/roadmap.json"), dWpt = sh("rm .specs/roadmap.json", "Bash", { lang: "pt" }), aW = D("Bash", { command: "rm -rf .specs" }, "ask");
    ok(r1Bad.length === 0 && r1NoBad.length === 0 && dW.command === null && /may not change \.specs\/roadmap\.json from the shell — write, move or delete it/.test(dW.reason) &&
      /Stop and ask the user to make that change themselves/.test(dW.reason) && !/null/.test(dW.reason + dW.userNote) && /Make that change yourself/.test(dW.userNote) &&
      /alterar \.specs\/roadmap\.json a partir da shell/.test(dWpt.reason) && /faça ele próprio essa alteração/.test(dWpt.reason) && aW.decision === "ask" && aW.command === null,
      "feature F2 review R1: a shell write of .specs/roadmap.json (> >> &> 1>>, tee, sed / perl -i, cp / mv / Copy-Item onto it, rm / truncate / dd / Set-Content / Add-Content / Out-File, deleting or moving .specs/ away, inside cmd /c or bash -c) is a guard-down action with no command to hand over (the user makes the change); reading it (cat, jq, grep, cp FROM it, git add) is not (got " +
      JSON.stringify([r1Bad, r1NoBad, dW.reason.slice(0, 120)]) + ")");
    // The level: engine and hook read a broken roadmap.json's raw text (the strictest level it names); no level named → off.
    const hookJs = path.join(__dirname, "..", "hooks", "approval-hook.js");
    const runHook = (input) => spawnSync(process.execPath, [hookJs], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" }, timeout: 15000 });
    const pre = (cwd, tool, input) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd, tool_name: tool, tool_input: input });
    const decision = (r) => { try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision; } catch { return r.status === 0 && r.stdout === "" ? "silent" : "?"; } };
    const pB = path.join(tmp, "proj-f2-r1-broken"), pB2 = path.join(tmp, "proj-f2-r1-noguard"), pB3 = path.join(tmp, "proj-f2-r1-two"), pOffW = path.join(tmp, "proj-f2-r1-off");
    S.initProject(pB, ["core"], "en", { approvalGuard: "deny" });
    fs.appendFileSync(path.join(pB, ".specs", "roadmap.json"), "x"); // what `echo x >> .specs/roadmap.json` does
    fs.mkdirSync(path.join(pB2, ".specs"), { recursive: true });
    fs.writeFileSync(path.join(pB2, ".specs", "roadmap.json"), '{"meta": {"lang": "en"}');
    fs.mkdirSync(path.join(pB3, ".specs"), { recursive: true });
    fs.writeFileSync(path.join(pB3, ".specs", "roadmap.json"), '{"meta": {"approvalGuard": "ask"}}\n{"meta": {"approvalGuard" : " DENY "}}');
    S.initProject(pOffW, ["core"], "en");
    const hB = runHook(pre(pB, "mcp__spec-driven__spec_approve", { name: "x", phase: "design" }));
    const hBinit = runHook(pre(pB, "mcp__spec-driven__spec_init", { evidence: "reported" })); // broken → meta unknown → fail closed
    const hB2 = runHook(pre(pB2, "mcp__spec-driven__spec_approve", { name: "x", phase: "design" }));
    const hB3 = runHook(pre(pB3, "Bash", { command: "node cli/dev-spec.js approve x design" }));
    const hOffW = runHook(pre(pOffW, "Bash", { command: "echo x >> .specs/roadmap.json" }));
    ok(S.approvalGuardLevel(pB) === "deny" && S.approvalGuardLevel(pB2) === "off" && S.approvalGuardLevel(pB3) === "deny" &&
      decision(hB) === "deny" && decision(hBinit) === "deny" && decision(hB2) === "silent" && decision(hB3) === "deny" && decision(hOffW) === "silent",
      "feature F2 review R1: fail closed — a roadmap.json broken by an appended byte keeps its approvalGuard deny (engine approvalGuardLevel and the hook; a spec_init there is judged with unknown meta); the strictest level a broken file names wins; a broken file naming none, or a guard-off project, stays silent (got " +
      JSON.stringify([S.approvalGuardLevel(pB), S.approvalGuardLevel(pB2), S.approvalGuardLevel(pB3), decision(hB), decision(hBinit), decision(hB2), decision(hB3), decision(hOffW)]) + ")");
    // The hook end to end: the project's meta decides a spec_init / init change (lowering → deny, raising → silent); a shell write of
    // roadmap.json is denied with the user's line naming no command.
    const pM = path.join(tmp, "proj-f2-r10-hook");
    S.initProject(pM, ["core"], "en", { approvalGuard: "deny", evidence: "observed", checks: { test: "npm test" }, approvalRoles: { design: ["tech"] } });
    const hM = [runHook(pre(pM, "mcp__spec-driven__spec_init", { evidence: "reported" })), runHook(pre(pM, "mcp__spec-driven__spec_init", { evidence: "observed" })),
      runHook(pre(pM, "Bash", { command: 'node cli/dev-spec.js init --check "test="' })), runHook(pre(pM, "Bash", { command: "node cli/dev-spec.js init --check lint=eslint" })),
      runHook(pre(pM, "PowerShell", { command: "node cli/dev-spec.js init --roles none" })), runHook(pre(pM, "Bash", { command: "node cli/dev-spec.js init --roles design=tech+security" })),
      runHook(pre(pM, "Bash", { command: "echo x >> .specs/roadmap.json" })), runHook(pre(pM, "Bash", { command: "node cli/dev-spec.js " + BS + NL + " approve x design" }))];
    let wOut = {};
    try { wOut = JSON.parse(hM[6].stdout); } catch { /* checked below */ }
    ok(JSON.stringify(hM.map(decision)) === '["deny","silent","deny","silent","deny","silent","deny","deny"]' && /refused an agent's request to change \.specs\/roadmap\.json/.test(wOut.systemMessage || "") &&
      !/To approve it yourself/.test(wOut.systemMessage || ""),
      "feature F2 review R10/R1: the hook passes the project's meta — spec_init {evidence: reported}, init --check test=, init --roles none are denied where they lower it, their raising twins pass; a Bash write of roadmap.json and a \\⏎-continued approve are denied (got " +
      JSON.stringify([hM.map(decision), wOut.systemMessage]) + ")");
  }

  // 1.21.1 languages — guard mode reads the same notion of code as the scan (isCodeFile): a PowerShell script / module is code, its
  // .psd1 manifest is data; a Bats suite and Perl's t/*.t are tests (a .t elsewhere is nothing); Pester's *.Tests.ps1 is a test
  // file for the tests-phase and scope levels, beside the module too.
  {
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const guardJs = path.join(__dirname, "..", "hooks", "guard-hook.js");
    const hook = (cwd, file) => spawnSync(process.execPath, [guardJs], { input: JSON.stringify({ session_id: "s", hook_event_name: "PreToolUse", cwd, tool_name: "Write", tool_input: { file_path: file, content: "x" } }),
      encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
    const asks = (r) => { try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision === "ask"; } catch { return false; } };
    const g = (p, f) => { const r = S.guardCheck(p, f, p); return r.decision + ":" + r.why; };
    const pg = path.join(tmp, "proj-121-guard");
    S.initProject(pg, ["tdd"], "en", { guard: true });
    const fg = S.createFeature(pg, "Greeter", ["tdd"], "", undefined, "en");
    const before = ["src/Greeter/Greeter.psm1", "scripts/deploy.ps1", "src/Greeter/Greeter.psd1", "test/deploy.bats", "t/basic.t", "notes.t", "tests/Greeter.Tests.ps1"].map((f) => g(pg, f));
    const hookPs1 = hook(pg, path.join(pg, "scripts", "deploy.ps1")), hookPsd1 = hook(pg, path.join(pg, "src", "Greeter", "Greeter.psd1"));
    // Phase 4: the test plan approved, tasks not yet — test files are covered, code still asks.
    const st = JSON.parse(fs.readFileSync(path.join(fg.dir, ".state.json"), "utf8"));
    st.approvals = { classification: { at: "2026-09-01T00:00:00.000Z", by: "u" }, requirements: { at: "2026-09-01T00:00:00.000Z", by: "u" }, design: { at: "2026-09-01T00:00:00.000Z", by: "u" }, "test-plan": { at: "2026-09-01T00:00:00.000Z", by: "u" } };
    fs.writeFileSync(path.join(fg.dir, ".state.json"), JSON.stringify(st, null, 2));
    const phase4 = ["tests/Greeter.Tests.ps1", "src/Greeter/Greeter.Tests.ps1", "test/deploy.bats", "t/basic.t", "src/Greeter/Greeter.psm1"].map((f) => g(pg, f));
    // scope: tasks approved — the plan's .psm1 is in scope, another script is not, a Pester file is a test file.
    put(fg.dir, "tasks.md", "- [ ] 1. [US1] Greet\n  - _Implements: src/Greeter/Greeter.psm1_\n  - _Verify: pwsh -NoProfile -Command \"Invoke-Pester -Path tests -CI\"_\n");
    st.approvals.tasks = { at: "2026-09-02T00:00:00.000Z", by: "u" };
    fs.writeFileSync(path.join(fg.dir, ".state.json"), JSON.stringify(st, null, 2));
    S.initProject(pg, ["tdd"], "en", { guard: "scope" });
    const scope = ["src/Greeter/Greeter.psm1", "scripts/deploy.ps1", "src/Greeter/Greeter.Tests.ps1", "src/Greeter/Greeter.psd1"].map((f) => g(pg, f));
    const scopeHook = hook(pg, path.join(pg, "scripts", "deploy.ps1"));
    ok(js(before) === js(["ask:no-approved-tasks", "ask:no-approved-tasks", "allow:not-code", "ask:no-approved-tasks", "ask:no-approved-tasks", "allow:not-code", "ask:no-approved-tasks"]) &&
      asks(hookPs1) && hookPsd1.status === 0 && hookPsd1.stdout === "" &&
      js(phase4) === js(["allow:tests-phase", "allow:tests-phase", "allow:tests-phase", "allow:tests-phase", "ask:no-approved-tasks"]) &&
      js(scope) === js(["allow:in-scope", "ask:out-of-scope", "allow:test-file", "allow:not-code"]) && asks(scopeHook) && /scripts\/deploy\.ps1 is not in the plan/.test(JSON.parse(scopeHook.stdout || "{}").hookSpecificOutput.permissionDecisionReason || ""),
      "1.21.1 languages: guard mode — a .ps1 / .psm1 edit asks (the hook too), the .psd1 manifest is not code, a .bats suite and t/basic.t are code, notes.t is not; in Phase 4 the Pester files (tests/ and beside the module), the .bats and t/*.t are test files; at the scope level the planned .psm1 is in scope, another .ps1 asks naming it, a *.Tests.ps1 is a test file (got " +
      js([before, phase4, scope, hookPs1.stdout.slice(0, 120)]) + ")");
  }
};

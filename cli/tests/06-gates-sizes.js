"use strict";
// Right-sized rigor (1.21 F5) on the CLI — create --size (= spec_create {size}), a change (--kind change / --size xs), classify's
// suggested size, status marks for a sized feature, approve --through tasks on a change, the refusals — MCP ↔ CLI parity.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp, require, __dirname }) => {
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const p = path.join(tmp, "p121-sizes");
  S.initProject(p, ["core"], "en");
  const rd = (slug, f) => fs.readFileSync(path.join(p, ".specs", slug, f), "utf8");
  const has = (slug, f) => fs.existsSync(path.join(p, ".specs", slug, f));

  // create --size s: the same scaffold spec_create {size: "s"} writes (engine), --json carries size
  const cli = runIn(["create", "Cli small", "tdd", "sec", "--size", "S", "--json", "--project", p]);
  const eng = S.createFeature(p, "Engine small", ["core", "tdd", "sec"], undefined, undefined, undefined, undefined, { size: "s" });
  const j = JSON.parse(cli.out);
  const same = ["requirements.md", "design.md", "tasks.md", "test-plan.md", "checklist.md"].every((f) => rd("cli-small", f).replace(/Cli small|cli-small/g, "X") === rd(eng.slug, f).replace(/Engine small|engine-small/g, "X"));
  ok(cli.code === 0 && j.ok && j.size === "s" && same && !has("cli-small", "classification.md") && JSON.parse(rd("cli-small", ".state.json")).size === "s",
    "1.21 F5 (CLI): create --size S (case-folded) scaffolds exactly what spec_create {size: 's'} does — no classification.md, size s in .state.json, --json carries size (got " +
    JSON.stringify({ code: cli.code, size: j.size, same }) + ")");

  // a change: --size xs (and --kind change) → ONE change.md; the plan approved with --through tasks; the refusals exit 1
  const ch = runIn(["create", "Footer typo", "--size", "xs", "--summary", "fix a typo in the footer", "--project", p]);
  const kindCh = runIn(["create", "Header typo", "--kind", "change", "--json", "--project", p]);
  const txt = "# Change: footer\n\n## Summary\nFix the footer string.\n\n## Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show \"Copyright 2026 Acme\".\n\n" +
    "## Approach\nOne string in footer.html.\n\n## Tasks\n- [ ] 1. [US1] Fix the footer string\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n";
  fs.writeFileSync(path.join(p, ".specs", "footer-typo", "change.md"), txt);
  const ap = runIn(["approve", "footer-typo", "--through", "tasks", "--project", p]);
  const reqAp = runIn(["approve", "footer-typo", "requirements", "--project", p]);
  const done = run(["done", "footer-typo", "1", "--run", "--project", p]);
  const fin = runIn(["finish", "footer-typo", "--project", p]);
  const bad = runIn(["create", "Bad", "--size", "xl", "--project", p]);
  const tracked = runIn(["create", "Tracked", "sec", "--kind", "change", "--project", p]);
  ok(ch.code === 0 && /is a change \(size xs\): ONE file/.test(ch.out) && fs.readdirSync(path.join(p, ".specs", "footer-typo")).filter((n) => n.endsWith(".md")).join() === "change.md" &&
    JSON.parse(kindCh.out).kind === "change" && ap.code === 0 && reqAp.code === 1 && /there is no requirements phase/.test(reqAp.out) && done.code === 0 &&
    /^- \[x\] 1\. /m.test(rd("footer-typo", "change.md")) && fin.code === 0 && bad.code === 1 && /size must be one of: xs, s, m, l/.test(bad.out) && tracked.code === 1 && /\+sec/.test(tracked.out),
    "1.21 F5 (CLI): create --size xs / --kind change → ONE change.md; approve --through tasks approves its plan, a requirements approval is refused (exit 1); done --run ticks the task IN change.md; finish is ready; --size xl and a change with a track exit 1 (got " +
    JSON.stringify({ ch: ch.code, ap: ap.code, req: reqAp.code, done: [done.code, done.out.slice(0, 200)], fin: fin.code, bad: bad.code, tracked: tracked.code }) + ")");

  // the hooks know a change: saving change.md lints its criteria AND traces its tasks; the observe hook logs a run of its _Verify:_
  const { spawnSync } = require("child_process");
  const hookDir = path.join(__dirname, "..", "hooks");
  const hook = (name, payload) => spawnSync(process.execPath, [path.join(hookDir, name)], { input: JSON.stringify(payload), encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: p, SPEC_PROJECT_DIR: p } });
  const saved = hook("spec-hook.js", { hook_event_name: "PostToolUse", tool_name: "Write", cwd: p, tool_input: { file_path: path.join(p, ".specs", "footer-typo", "change.md") } });
  const savedCtx = (() => { try { return JSON.parse(saved.stdout).hookSpecificOutput.additionalContext; } catch { return saved.stdout; } })();
  const cmd = 'node -e "process.exit(0)"';
  hook("observe-hook.js", { hook_event_name: "PostToolUse", tool_name: "Bash", cwd: p, session_id: "s1", tool_input: { command: cmd }, tool_response: { exit_code: 0, stdout: "" } });
  const obsLog = path.join(p, ".specs", "footer-typo", ".execution", "observed.jsonl");
  ok(saved.status === 0 && /EARS check: 1 criteria, all clean/.test(savedCtx) && /Traceability: all 1 ACs covered by tasks/.test(savedCtx) &&
    fs.existsSync(obsLog) && fs.readFileSync(obsLog, "utf8").includes('"command":"node -e \\"process.exit(0)\\""'),
    "1.21 F5 (hooks): saving a change's change.md reports its EARS check AND its traceability (one file holds both); the observe hook logs a run of the change's _Verify:_ command for that feature (got " +
    JSON.stringify({ saved: savedCtx, obs: fs.existsSync(obsLog) }).slice(0, 600) + ")");

  // classify prints the suggested size (the same sizeNote spec_classify returns); status marks an optional section ○ at size s
  const cls = runIn(["classify", "add a CSV export button to the orders page", "--project", p]);
  const clsJ = JSON.parse(runIn(["classify", "add a CSV export button to the orders page", "--json", "--project", p]).out);
  const st = runIn(["status", "cli-small", "--project", p]);
  ok(cls.code === 0 && /^Suggested size s — one unit of work/m.test(cls.out) && clsJ.suggestedSize === "s" && clsJ.sizeReason === "single-unit" &&
    st.code === 0 && /○ Security Requirements \(optional at this size\)/.test(st.out) && /◐ Threat Model \(unfilled\)/.test(st.out),
    "1.21 F5 (CLI): classify prints the suggested size (--json: suggestedSize / sizeReason, as spec_classify); status marks a size s feature's optional extended section ○ and its core one ◐ while unfilled (got " +
    JSON.stringify({ cls: cls.out.split("\n").filter((l) => /size/i.test(l)), st: st.out.split("\n").filter((l) => /SEC|Threat|Security/.test(l)) }) + ")");

  // --- 1.21 review C — the F5 review's findings on the CLI (the same engine calls as MCP) ---
  const q = path.join(tmp, "p121-review");
  S.initProject(q, ["core"], "en");
  const qrd = (slug, f) => fs.readFileSync(path.join(q, ".specs", slug, f), "utf8");
  const qwr = (slug, f, t) => fs.writeFileSync(path.join(q, ".specs", slug, f), t);
  const HEAD = "# Change: footer\n\n## Summary\nFix the footer text and its year.\n\n## Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer text \"Copyright\".\n" +
    "2. **US-1.AC-2** — WHEN the footer renders THE SYSTEM SHALL show the year 2026.\n\n## Approach\nTwo strings in templates/footer.html.\n\n## Tasks\n";
  const task = (n, reqs) => `- [ ] ${n}. [US1] Fix string ${n}\n  - _Requirements: ${reqs}_\n  - _Verify: node -e "process.exit(0)"_\n`;
  runIn(["create", "Footer", "--kind", "change", "--project", q]);

  // C1: the save hook traces a change's task blocks against its criteria alone — a phantom is named, never "all covered"
  qwr("footer", "change.md", HEAD.replace(/2\. \*\*US-1\.AC-2\*\*[^\n]*\n/, "") + task(1, "US-1.AC-1, US-1.AC-7"));
  const qHook = spawnSync(process.execPath, [path.join(hookDir, "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", cwd: q,
    tool_input: { file_path: path.join(q, ".specs", "footer", "change.md") } }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: q, SPEC_PROJECT_DIR: q } });
  const qCtx = (() => { try { return JSON.parse(qHook.stdout).hookSpecificOutput.additionalContext; } catch { return qHook.stdout; } })();
  const qTrace = runIn(["trace", "footer", "--project", q]);
  ok(qHook.status === 0 && /US-1\.AC-7/.test(qCtx) && !/all 1 ACs covered/.test(qCtx) && qTrace.code === 1 && /US-1\.AC-7/.test(qTrace.out),
    "1.21 review C1 (CLI, hooks): saving a change.md whose task cites a phantom AC names it (the save hook's trace), and `trace` exits 1 (got " + JSON.stringify({ ctx: String(qCtx).slice(0, 300), trace: qTrace.code }) + ")");
  // … and its EARS line lints the criteria alone: a task line with a modal verb is no criterion (it read "2 criteria" + a vague warning)
  qwr("footer", "change.md", HEAD.replace(/2\. \*\*US-1\.AC-2\*\*[^\n]*\n/, "") + "- [ ] 1. [US1] The system shall be fast\n  - _Requirements: US-1.AC-1_\n");
  const qEars = spawnSync(process.execPath, [path.join(hookDir, "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", cwd: q,
    tool_input: { file_path: path.join(q, ".specs", "footer", "change.md") } }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: q, SPEC_PROJECT_DIR: q } });
  const qEarsCtx = (() => { try { return JSON.parse(qEars.stdout).hookSpecificOutput.additionalContext; } catch { return qEars.stdout; } })();
  ok(qEars.status === 0 && /EARS check: 1 criteria, all clean/.test(qEarsCtx) && !/vague/i.test(qEarsCtx),
    "1.21 review C1 (CLI, hooks): the save hook's EARS line on a change.md lints its criteria only — a task line holding 'shall' is no criterion (got " + JSON.stringify(String(qEarsCtx).slice(0, 300)) + ")");

  // C4 / C5: impact without a phase diffs the change's plan; the matrix and the export read it as a change
  qwr("footer", "change.md", HEAD + task(1, "US-1.AC-1") + task(2, "US-1.AC-2"));
  const qAp = runIn(["approve", "footer", "--through", "tasks", "--project", q]);
  run(["done", "footer", "1", "--run", "--project", q]);
  qwr("footer", "change.md", qrd("footer", "change.md").replace("the footer text \"Copyright\"", "the footer text \"Copyright 2026 Acme\""));
  const qImp = runIn(["impact", "footer", "--project", q]);
  const qImpReq = runIn(["impact", "footer", "--phase", "requirements", "--project", q]);
  const qMx = runIn(["trace", "footer", "--matrix", "--project", q]);
  const qExp = runIn(["export", "footer", "--md", "--project", q]);
  const qRe = runIn(["impact", "footer", "--reopen", "--project", q]);
  ok(qAp.code === 0 && qImp.code === 0 && /Impact: footer · tasks/.test(qImp.out) && /~ US-1\.AC-1/.test(qImp.out) && /--phase tasks --reopen/.test(qImp.out) &&
    qImpReq.code === 1 && /one file, change\.md/.test(qImpReq.out) && /plan \(change\.md\) approved/.test(qMx.out) &&
    /\*\*Kind:\*\* change \(size xs\)/.test(qExp.out) && !/^## Design/m.test(qExp.out) && /Plan \(change\.md\)/.test(qExp.out) &&
    qRe.code === 0 && /Reopened #1/.test(qRe.out) && /^- \[ \] 1\. /m.test(qrd("footer", "change.md")),
    "1.21 review C4 / C5 (CLI): `impact <change>` (no phase) diffs its plan — criteria by ID, the --phase tasks --reopen hint; --phase requirements exits 1; --reopen unticks the task in change.md; `trace --matrix` reads the plan approval; `export --md` renders a change (got " +
    JSON.stringify({ imp: qImp.out.slice(0, 300), req: qImpReq.out.slice(0, 200), mx: qMx.out.split("\n")[1], re: qRe.out.slice(0, 200) }) + ")");

  // C3 / C9 / C10: next-action names the call through test-plan; create on an existing change with a track says so; messages name
  // change.md; the usage lists --kind change / --size; status says what doctor says on an unsized feature
  runIn(["create", "Export csv", "tdd", "--size", "s", "--project", q]);
  const qNa = runIn(["next-action", "export-csv", "--project", q]);
  const qAgain = runIn(["create", "Footer", "saas", "--project", q]);
  const qApp = runIn(["append-tasks", "footer", "--task", "Third string", "--req", "US-1.AC-1", "--project", q]);
  const qNf = runIn(["undone", "footer", "9", "--project", q]);
  const qHelp = runIn(["help"]);
  runIn(["create", "Login", "sec", "--project", q]);
  qwr("login", "design.md", qrd("login", "design.md").split("\n").filter((l) => !/^> \*\*TODO\*\*/.test(l)).join("\n"));
  const qSt = runIn(["status", "login", "--project", q]);
  const qDoc = runIn(["doctor", "login", "--project", q]);
  ok(qNa.code === 0 && /--through test-plan/.test(qNa.out) && /\/spec export-csv tests/.test(qNa.out) && qAgain.code === 0 && /Tracks not added — \+saas/.test(qAgain.out) &&
    /Appended to change\.md/.test(qApp.out) && /change\.md changed after its approval/.test(qApp.out) && qNf.code === 1 && /not found in change\.md/.test(qNf.out) &&
    /--kind feature\|bugfix\|spike\|change, --size xs\|s\|m\|l/.test(qHelp.out) && /◐ Threat Model \(only the template's guidance\)/.test(qSt.out) &&
    /Threat Model:only the template's guidance/.test(qDoc.out),
    "1.21 review C3 / C9 / C10 (CLI): next-action on size s +tdd names --through test-plan then /spec <f> tests; create on an existing change with a track prints 'Tracks not added'; append-tasks / undone name change.md; help lists --kind …|change and --size; status on an unsized feature says 'only the template's guidance', as doctor (got " +
    JSON.stringify({ na: qNa.out.slice(0, 300), again: qAgain.out.slice(0, 200), app: qApp.out.slice(0, 200), nf: qNf.out, st: qSt.out.split("\n").filter((l) => /Threat/.test(l)) }) + ")");

  // --- 1.21 verify (CLI) — the change kind at the seams ---
  const v = path.join(tmp, "p121-verify");
  const vInit = runIn(["init", "--roles", "tasks=tech+qa", "--project", v]);
  const ONE = "# Change: footer\n\n## Summary\nFix the footer text.\n\n## Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer text \"Copyright\".\n\n## Approach\nOne string in templates/footer.html.\n\n## Tasks\n" +
    "- [ ] 1. [US1] Fix the footer string\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -e \"process.exit(0)\"_\n";
  runIn(["create", "Footer", "--kind", "change", "--project", v]);
  fs.writeFileSync(path.join(v, ".specs", "footer", "change.md"), ONE);
  // V4: tech's sign-off of change.md counts — next-action asks for qa only, doctor calls nothing stale
  const vTech = runIn(["approve", "footer", "tasks", "--role", "tech", "--project", v]);
  const vNa = runIn(["next-action", "footer", "--project", v]);
  const vDoc = runIn(["doctor", "footer", "--project", v]);
  ok(vInit.code === 0 && vTech.code === 0 && /missing role: qa \(signed: tech\)/.test(vNa.out) && !/tech, qa/.test(vNa.out) && !/no longer count/.test(vDoc.out),
    "1.21 verify V4 (CLI): init --roles tasks=tech+qa, a change signed by tech — next-action asks for qa alone, doctor calls no sign-off stale (got " +
    JSON.stringify({ tech: vTech.code, na: vNa.out.slice(0, 300), doc: vDoc.out.split("\n").filter((l) => /role|sign/i.test(l)) }) + ")");

  // V6: `clarify` on a change = spec_clarify — clear once written; the template's slots named change.md:<line>
  const vClear = runIn(["clarify", "footer", "--json", "--project", v]);
  runIn(["create", "Header", "--kind", "change", "--project", v]);
  const vTmpl = runIn(["clarify", "header", "--project", v]);
  ok(JSON.stringify(JSON.parse(vClear.out)) === JSON.stringify(S.clarify(v, "footer")) && JSON.parse(vClear.out).verdict === "clear" &&
    /change\.md:13 \[the change\]/.test(vTmpl.out) && !/requirements\.md|Success Criteria|edge cases|non-functional/i.test(vTmpl.out),
    "1.21 verify V6 (CLI): clarify on a change prints what spec_clarify returns — clear once written; a template's slots named change.md:<line>, no feature-only question (got " +
    JSON.stringify({ clear: vClear.out.slice(0, 200), tmpl: vTmpl.out }).slice(0, 900) + ")");

  // V7: the save hook on change.md names change.md and the plan, never requirements.md or the design
  fs.writeFileSync(path.join(v, ".specs", "header", "change.md"), ONE.replace("THE SYSTEM SHALL show", "the footer shows").replace("Fix the footer text.", "[one line: what changes and why]"));
  const vHook = spawnSync(process.execPath, [path.join(hookDir, "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", cwd: v,
    tool_input: { file_path: path.join(v, ".specs", "header", "change.md") } }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: v, SPEC_PROJECT_DIR: v } });
  const vCtx = (() => { try { return JSON.parse(vHook.stdout).hookSpecificOutput.additionalContext; } catch { return vHook.stdout; } })();
  ok(vHook.status === 0 && /EARS check on change\.md — 1 error/.test(vCtx) && /Fix the errors before approving the plan\./.test(vCtx) &&
    /left in change\.md \([^)]*\) — replace them before approving the plan\./.test(vCtx) && !/requirements\.md|design/.test(vCtx),
    "1.21 verify V7 (CLI, save hook): saving a change.md with an EARS error and a slot says 'EARS check on change.md … before approving the plan' and 'left in change.md … approving the plan' — never requirements.md or the design (got " +
    JSON.stringify(String(vCtx).slice(0, 600)) + ")");
};

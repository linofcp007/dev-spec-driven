"use strict";
// Docs and prose — the skill, commands, agents, README and rule files agree with the engine; release hygiene.
// The maintainer notes, no PR / CI steering, the docs' worked examples, the test counts, the three version fields.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Runs after 01-core, in the same process: it reads ctx.vDir — the v1.12 project whose login-loop feature 01-core took to its finish (the prose guard reads its merge summary).
exports.deps = ["01-core"];
exports.run = async ({
  ok, all, S, root, tmp, libSources, maintainerNotes, approveBefore, init, list, require, __dirname, vDir,
}) => {

  { // --- 1.13 batch 6: the docs' worked examples pass the engine's own gates; no stale test counts ---
    const refText = (f) => fs.readFileSync(path.join(root, "skills", "dev-spec-driven", "references", f), "utf8");
    const p15 = path.join(tmp, "proj-wp15");
    S.initProject(p15, ["core"], "en");

    // 1. "This is what a complete design.md looks like" (SKILL Phase 2, commands/design.md): copied from its `# Design:`
    // heading, each worked design passes the design approval gate — Constitution Check included (1.13 refuses it unfilled).
    const worked15 = [["scale-design-template.md", "Upload", ["saas"]], ["mandatory-ai-design-sections.md", "Rag Search", ["ai"]]].map(([file, name, tracks]) => {
      const f = S.createFeature(p15, name, tracks);
      const text = refText(file);
      fs.writeFileSync(path.join(f.dir, "design.md"), text.slice(text.indexOf("# Design:")));
      approveBefore(p15, f.slug, "design");
      const ap = S.approvePhase(p15, f.slug, "design", "t");
      const cc = (S.specDoctor(p15, f.slug).checks.find((c) => c.id === "constitution-check") || {}).status;
      return { file, ok: ap.ok === true && cc === "pass", detail: ap.ok ? cc : ap.error };
    });
    const comb15 = refText("example-spec-combined.md");
    ok(worked15.every((w) => w.ok) && /^- Base: [^\n]*Constitution Check[^\n]*Complexity Tracking/m.test(comb15),
      "the worked designs (scale-design-template, mandatory-ai-design-sections) pass the design gate with a filled Constitution Check; example-spec-combined lists it among the base sections (got " +
      JSON.stringify(worked15.map((w) => [w.file, w.detail])) + ")");

    // 2. The improvement-spec example (SKILL routes internal-improvement work to it) uses the stable US-n.AC-m IDs the engine
    // traces: no "no stable ID" warning, and a feature written like it traces all its criteria (a bare `AC-1` traced 0).
    const imp15 = (refText("improvement-specs.md").match(/```markdown\r?\n([\s\S]*?)```/) || [])[1] || "";
    const impEars15 = S.earsValidate(imp15, "en");
    const impF15 = S.createFeature(p15, "Refactor checkout", ["tdd"]);
    fs.writeFileSync(path.join(impF15.dir, "requirements.md"), imp15);
    const impTr15 = S.traceCheck(p15, impF15.slug);
    ok(imp15.length > 200 && !impEars15.issues.some((i) => i.code === "no-id" || i.severity === "error") && impTr15.totalAcs === 7 && !/^#{2,4} AC-?\d* /m.test(imp15),
      "improvement-specs.md's example criteria carry US-1.AC-n IDs: ears reports no missing ID and trace sees all 7 ACs (got " + impTr15.totalAcs + ", issues " +
      JSON.stringify(impEars15.issues.map((i) => i.code)) + ")");

    // 3. Test counts: the user-facing docs state none (every added assertion made them stale — INSTALL said 617 / 198 at
    // 644 / 201); the maintainer's two records of the exact figures (CLAUDE.md, the current CHANGELOG entry) agree.
    const docText = (f) => fs.readFileSync(path.join(root, f), "utf8");
    const RE_COUNT15 = /\b\d{2,} (?:passed|passing|assertions|asserções|aserciones)\b|badge\/tests-\d/i;
    const stale15 = ["README.md", "INSTALL.md", "llms-install.md", "CONTRIBUTING.md"].filter((f) => RE_COUNT15.test(docText(f)));
    // 1.30 (review 8, ds-maint 7): the sentences are read by scripts/release-counts.js's own patterns (npm run release:counts writes
    // them from a RUN's totals — the release step; this only holds the two records to each other between releases).
    const RC = require(path.join(root, "scripts", "release-counts.js"));
    const counts15 = RC.readCounts(root).map((c) => c.value); // CLAUDE.md mcp, cli · CHANGELOG mcp, cli
    // Under release:counts' own run the two records are about to be rewritten from it: only their presence is held then.
    const releasing15 = process.env.DEV_SPEC_TEST_RELEASE_COUNTS === "1";
    ok(stale15.length === 0 && counts15.every((n) => n !== null) && (releasing15 || (counts15[0] === counts15[2] && counts15[1] === counts15[3])),
      "README / INSTALL / llms-install / CONTRIBUTING hard-code no test count; CLAUDE.md and the current CHANGELOG entry state the same mcp / cli totals (stale: " +
      stale15.join(", ") + "; CLAUDE.md " + counts15.slice(0, 2).join("/") + " vs CHANGELOG " + counts15.slice(2).join("/") + ")");

    // …and scripts/release-counts.js on a copy: it writes a run's totals into both records (the CHANGELOG's CURRENT entry only — an
    // older one keeps its own), --check exits 1 on a difference and writes nothing, a suite with a failure records nothing, an entry
    // without its tests line gets the line to paste (with the previous entry's totals as "was"). Its suites here are fakes printing a total.
    const rcRoot = path.join(tmp, "release-counts");
    const rcW = (rel, text) => { const p = path.join(rcRoot, ...rel.split("/")); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
    const rcClaude = "## Tests\n`node mcp/test.js` drives it\n(100 assertions, incl. a PT scaffold);\n`node cli/test-cli.js` adds 20 for the CLI.\n";
    const rcLog = (cur) => "# Changelog\n\n## [2.0.0] — 2026-10-13\n\n### Tests\n" + cur + "\n\n## [1.9.0] — 2026-10-01\n\n### Tests\n- `node mcp/test.js` 100 assertions, `node cli/test-cli.js` 20.\n";
    const fakeSuite = (line) => `"use strict";\nprocess.stdout.write(${JSON.stringify("# a fake suite\n\n" + line + "\n")});\nprocess.exitCode = /, 0 failed$/.test(${JSON.stringify(line)}) ? 0 : 1;\n`;
    rcW("CLAUDE.md", rcClaude);
    rcW("CHANGELOG.md", rcLog("- `node mcp/test.js` 100 assertions, `node cli/test-cli.js` 20."));
    rcW("mcp/test.js", fakeSuite("130 passed, 0 failed"));
    rcW("cli/test-cli.js", fakeSuite("25 passed, 0 failed"));
    const rcScript = path.join(root, "scripts", "release-counts.js");
    const rc = (...a) => { const r = spawnSync(process.execPath, [rcScript, "--root", rcRoot, ...a], { encoding: "utf8" }); return { code: r.status, out: (r.stdout || "") + (r.stderr || "") }; };
    const rcRead = (f) => fs.readFileSync(path.join(rcRoot, f), "utf8");
    const checked = rc("--check");
    const unchanged = rcRead("CLAUDE.md") === rcClaude;
    const wrote = rc();
    const after = RC.readCounts(rcRoot).map((c) => c.value);
    const claudeAfter = rcRead("CLAUDE.md");
    const olderKept = /## \[1\.9\.0\][\s\S]*`node mcp\/test\.js` 100 assertions, `node cli\/test-cli\.js` 20\./.test(rcRead("CHANGELOG.md"));
    const again = rc("--check");
    rcW("cli/test-cli.js", fakeSuite("24 passed, 1 failed"));
    const red = rc();
    rcW("CHANGELOG.md", rcLog("- (the tests line is still to write)"));
    const noLine = rc("--mcp", "140", "--cli", "25");
    all("1.30 review 8 (ds-maint 7): npm run release:counts writes the totals a RUN of both suites printed into CLAUDE.md and the current CHANGELOG entry — --check writes nothing and exits 1 on a difference, a failed suite records nothing, a missing tests line is given to paste (got " +
      JSON.stringify({ checked, wrote, after, again, red, noLine }) + ")", {
      checkDiffers: () => checked.code === 1 && /differs: CLAUDE\.md \(mcp\) 100 → 130/.test(checked.out) && unchanged,
      writes: () => wrote.code === 0 && JSON.stringify(after) === JSON.stringify([130, 25, 130, 25]) && olderKept && /^\(130 assertions, incl\. a PT scaffold\);$/m.test(claudeAfter),
      thenAgrees: () => again.code === 0 && /state the run's totals: mcp 130, cli 25/.test(again.out),
      failedSuite: () => red.code === 1 && /24 passed, 1 failed — the suites must pass/.test(red.out) && RC.readCounts(rcRoot)[1].value === 25,
      pasteLine: () => noLine.code === 1 && noLine.out.includes("- `node mcp/test.js` 140 assertions (was 100), `node cli/test-cli.js` 25 (was 20)."),
      npmScript: () => require(path.join(root, "package.json")).scripts["release:counts"] === "node scripts/release-counts.js",
    });
  }

  // Prose regressions: the skill must describe the engine honestly (loops tick with evidence, examples
  // pass its own linter), stay compact, and every user-facing surface must agree with it.
  const docsRead = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
  const docsRef = (f) => docsRead("skills", "dev-spec-driven", "references", f);
  const docsSkill = docsRead("skills", "dev-spec-driven", "SKILL.md");
  const docsDesc = ((docsSkill.match(/^description: >\r?\n([\s\S]*?)\r?\n---/m) || [])[1] || "").split(/\r?\n/).map((l) => l.trim()).join(" ").trim();
  // 1.26: the description is intent-based — what the user wants (plan before coding, fix a bug properly, adopt specs, a
  // roadmap, update the specs after a plugin update) — and SAYS it works in Portuguese and Spanish instead of listing their
  // trigger phrases (280 of its 1,011 characters); ≤ ~600 characters, the near-miss exclusions kept. 1.29.1: it names closing a
  // finished feature too ("fecha a feature" reached spec_finish through the tools, the skill only sometimes) — its checks,
  // dev-guardian's gate included, then a local merge (evals/trigger-finish-pt / -es). 1.30 review 8: resuming a feature (where it
  // stands, what's left, the next task — Phase 6, where the evidence rules apply most), changing its approved spec and a spike
  // never reached the skill — the cap goes 620 → 660 (the model-visible listing stays ≤ 1,500: 10-guards-guard-downs.js) and
  // evals/trigger-resume-en, -execute-es, -change-pt, -roadmap-en, -adopt-es, -spike-pt check each intent.
  ok(docsDesc.length > 200 && docsDesc.length <= 660 && /Not for trivial edits, requirements\.txt/.test(docsDesc) && /eval\(\) or an LLM/.test(docsDesc) &&
    /Works in English, Portuguese and Spanish/.test(docsDesc) && !/antes de|especificar|corrige|arregla|atualizar|actualizar/.test(docsDesc) &&
    /before coding/.test(docsDesc) && /fix a reported bug/.test(docsDesc) && /existing codebase/.test(docsDesc) && /roadmap/.test(docsDesc) &&
    /resume one \(where it stands, what's left, the next task\)/.test(docsDesc) && /change its approved spec/.test(docsDesc) && /run a spike/.test(docsDesc) &&
    /close a finished feature/.test(docsDesc) && /dev-guardian's gate/.test(docsDesc) && /local merge/.test(docsDesc) &&
    /update the specs/.test(docsDesc) && /after a dev-spec-driven update/.test(docsDesc) && !/^## When to use this skill/m.test(docsSkill) && !/\| Replaces \|/.test(docsSkill) && !/^\*\*One sentence:\*\*/m.test(docsSkill),
    `SKILL.md description is intent-based, says it works in EN / PT / ES (no literal PT / ES trigger list), scoped ("Not for …"), names resume / change / spike, ≤ 660 chars (${docsDesc.length}); no in-body trigger list, Replaces column or closing summary`);
  const docsLoops = (docsSkill.split("## Phase 6")[1] || "").split("Track-gated")[0];
  ok(["**core task", "**+tdd task", "**+ai generation/prompt task"].every((k) => /spec_complete_task \{evidence\}/.test(((docsLoops.split(k)[1] || "").split("\n- **")[0]))),
    "every Phase 6 execution loop (core, +tdd, +ai) ends in spec_complete_task {evidence}");
  // 1.26: the EARS quick reference moved from SKILL.md to the top of ears-guide.md (Phase 1 reads it there).
  const docsUnwanted = (docsRef("ears-guide.md").match(/^\| Unwanted \| IF…THEN \| (.+) \|\r?$/m) || [])[1] || "";
  ok(/ shall /.test(docsUnwanted) && S.earsValidate("1. **US-1.AC-1** — " + docsUnwanted).issues.length === 0 && !/user-friendly error message/.test(docsRef("ears-guide.md")) &&
    /references\/ears-guide\.md/.test(docsSkill),
    "the EARS quick reference's IF…THEN example (ears-guide.md, which SKILL.md routes Phase 1 to) passes the plugin's own linter; ears-guide's canonical example is measurable");
  ok(/real defect[^\n]*\/spec-bugfix/.test(docsSkill) && /Bounded/.test(docsRef("classification-matrix.md")) && /\/spec-bugfix/.test(docsRef("classification-matrix.md")) &&
    /Bounded/.test(docsRef("bugfix.md")) && /\*\*After Phase 0 approval:\*\* `spec_init \{tracks, lang\}` if steering is missing, then\s+`spec_create \{name, tracks, size, lang\}` \*\*once\*\*/.test(docsSkill),
    "mode routing sends a real defect to /spec-bugfix and knows Bounded (SKILL, matrix, bugfix.md); spec_init → spec_create (with the size, 1.24 r6 H2) once, after Phase 0 approval");
  ok(/`spec_doctor` only checks that the section is there/.test(docsSkill) && /always scaffolds `quickstart\.md`/.test(docsSkill) && !/^\| Tool \|/m.test(docsSkill) &&
    (docsRef("tooling-reference.md").match(/^\| `(?:spec_|ears_|trace_|steering_)/gm) || []).length >= 22,
    "SKILL.md claims are honest (constitution check = section presence; quickstart/checklist always scaffolded); the tool table lives in tooling-reference.md");
  // The expected set IS the live tools/list — a hand-kept list went stale (it stopped at 23 tools while the server had 29).
  const docsTools = list.result.tools.map((t) => t.name);
  // 1.26: the README is one file per language — README.md (EN, the reference), README.pt.md (PT-PT), README.es.md (ES) — with
  // the same sections and tables; every guard that read a language block of the one README reads that language's file.
  const docsReadmes = [["en", "README.md"], ["pt", "README.pt.md"], ["es", "README.es.md"]].map(([lang, f]) => [lang, f, docsRead(f)]);
  const docsTables = docsReadmes.map(([, , t]) => new Set([...t.matchAll(/^\| (`[a-z_]+`(?: \/ `[a-z_]+`)*) \|/gm)].flatMap((m) => m[1].match(/[a-z_]+/g))));
  ok(docsTables.every((s) => docsTools.every((t) => s.has(t)) && [...s].every((t) => list.result.tools.some((x) => x.name === t))) &&
    docsReadmes.every(([, , t]) => !/path-filled/.test(t) && /\/plugin marketplace add/.test(t) && /node cli\/test-cli\.js/.test(t) && /--subagents/.test(t) && /_Verify:/.test(t)),
    `README: the EN/PT/ES tool tables (README.md, README.pt.md, README.es.md) list all ${docsTools.length} tools of the live tools/list (no phantom; missing: ` +
    docsTables.map((s) => docsTools.filter((t) => !s.has(t)).join("+") || "none").join(" / ") + "); each language carries subagents, evidence, marketplace install and the CLI test line");
  const docsRules = [[path.join(".cursor", "rules", "dev-spec-driven.mdc"), "cursor"], [path.join(".windsurf", "rules", "dev-spec-driven.md"), "windsurf"],
    [path.join(".github", "copilot-instructions.md"), "copilot"], ["GEMINI.md", "gemini"], ["AGENTS.md", "agents"]];
  const docsAgents = docsRead("AGENTS.md");
  // `rules <tool>` copies these files verbatim and makes only a BARE `cli/dev-spec.js` absolute, so the note must
  // stay true in the generated copy (no "relative to the clone") and no path may carry a prefix like `<clone>/`.
  ok(docsRules.every(([f, tool]) => { const t = docsRead(f); return /^> Paths in this file point into the dev-spec-driven clone\. `node cli\/dev-spec\.js rules /m.test(t) &&
    !/relative to the dev-spec-driven clone/.test(t) && !/[\w./<>-]cli\/dev-spec\.js/.test(t) && t.includes("cli/dev-spec.js rules " + tool) && /no pull requests/i.test(t) &&
    !/\b(?:[Tt]he|[Tt]his|[Oo]ur) repo(?:sitory)?\b/.test(t); }) &&
    !/(?<!skills\/dev-spec-driven\/)references\//.test(docsAgents) && ["next-action", "add-track", "feature", "backlog", "rules"].every((c) => new RegExp("^dev-spec " + c + " ", "m").test(docsAgents)) &&
    /rules <tool>/.test(docsRead("INTEGRATIONS.md")) && /ABSOLUTE\/PATH\/TO/.test(docsRead("INTEGRATIONS.md")) && !/Pre-filled config files/.test(docsRead("INTEGRATIONS.md")),
    "rule files + AGENTS.md: a note that survives `rules <tool>`, bare CLI paths, no pull requests, no text about 'the repo' (false in the copy); AGENTS.md paths prefixed + CLI list complete; INTEGRATIONS admits the placeholder");
  const docsIntegr = docsRead("INTEGRATIONS.md");
  ok(["mkdir -p .cursor/rules && node", "mkdir -p .windsurf/rules && node", "mkdir -p .github && node", "New-Item -ItemType Directory -Force .cursor\\rules",
    "cmd /c 'node \"<PLUGIN>\\cli\\dev-spec.js\" rules cursor > .cursor\\rules\\dev-spec-driven.mdc'"].every((s) => docsIntegr.includes(s)) &&
    /PowerShell 5\.1[^\n]*\n?[^\n]*UTF-16/.test(docsIntegr) && /INTEGRATIONS\.md[^\n]*\n?[^\n]*UTF-16/.test(docsRead("INSTALL.md")),
    "INTEGRATIONS: `rules <tool>` redirects create the folder first; PowerShell goes through `cmd /c` (a bare `>` in 5.1 writes UTF-16)");
  // a step of AGENTS.md's pipeline, its sub-bullets included (1.24 r6 H-I6 split step 6 into them), whitespace-normalized
  const docsStep = (n) => (docsAgents.split("\n" + n + ". **")[1] || "").split(/\n(?:\d+\. \*\*|\n)/)[0].replace(/\s+/g, " ");
  ok(/for a task whose `_Verify:_` names a runnable command, a text note alone/.test(docsStep(6)) && /`_Verify: <command>_` always/.test(docsStep(5)) &&
    /`_Verify: <command>_` always/.test(docsRead("commands", "spec.md")) && /target tests/.test(docsRead("commands", "spec.md")) &&
    ((docsRef("example-spec-combined.md").split("## tasks.md")[1] || "").split("\n---")[0].match(/_Verify: /g) || []).length === 7 &&
    /\*\*Constitution\*\*[^\n]*constitution\.md/.test(docsRead("commands", "spec-review.md")) && /`\/spec-review branch` \| [^|\n]*constitution/.test(docsRef("workflows.md")),
    "_Verify:_ is an always-marker in AGENTS.md step 5, /spec's tasks phase (/createTask until 1.26) and the combined example; a note verifies only a non-runnable task; /spec-review branch checks the constitution (its row: references/workflows.md since 1.21 F3)");
  // Prose that lagged behind 1.13 behaviour. (a) The ROADMAP.md "needs attention" line NAMES each unverified task with its
  // reason — README/AGENTS said it "shows how many each feature has". (b) reopen never unticks a REMOVED criterion's tasks
  // (`retire` lists them) — every surface that says "reopen unticks the affected tasks" must carry that exception in the
  // same sentence. (c) A test-plan row citing an undefined AC is the TEST-PLAN gate's traceability (approvalChecks), not
  // the tasks gate's. (d) The maintainer notes ('When extending' — docs/maintainers/extending.md since 1.20): the README
  // tool-table test requires every live tool, not "the 23 v1.12 tools".
  const docsWs = (t) => t.replace(/\s+/g, " ");
  const docsSec = (lang) => docsWs((docsReadmes.find(([l]) => l === lang) || [])[2] || "");
  const docsSpecSrc = libSources({ i18n: false }).map((f) => fs.readFileSync(f, "utf8")).join("\n"); // the engine's sources (1.18: spec.js + engine/)
  const docsAttn = [["en", 'the `ROADMAP.md` "Needs attention" line list each unverified task with a localized reason', "Needs attention"],
    ["pt", 'a linha "Precisa de atenção" do `ROADMAP.md` listam cada tarefa por verificar com o motivo', "Precisa de atenção"],
    ["es", 'la línea "Necesita atención" del `ROADMAP.md` listan cada tarea sin verificar con su motivo', "Necesita atención"]];
  ok(docsAttn.every(([lang, s, needs]) => docsSec(lang).includes(s) && docsSpecSrc.includes('needs: "' + needs + '"')) &&
    docsWs(docsAgents).includes('the `ROADMAP.md` "Needs attention" line list each unverified task with a localized reason') &&
    !docsReadmes.map(([, , t]) => t).concat([docsAgents]).some((t) => /shows how many each feature has|mostra quantas há|muestra cuántas tiene/.test(docsWs(t))),
    "README (README.md / .pt.md / .es.md) + AGENTS.md: the ROADMAP.md needs-attention line lists each unverified task with its reason (the heading as the roadmap prints it), never 'shows how many'");
  const docsReopen = (t) => [...docsWs(t).matchAll(/reopen(?:: true)?`? (?:unticks|desmarca)/g)].map((m) => docsWs(t).slice(m.index).split(/\.\s|\|/)[0]);
  const docsReopenSurfaces = docsReadmes.map(([, f, t]) => [f, t, 1]).concat([["AGENTS.md", docsAgents, 2], ["tooling-reference.md", docsRef("tooling-reference.md"), 1],
    ["SKILL.md", docsSkill, 1], ["workflows.md", docsRef("workflows.md"), 1]]); // 1.21 F3: the after-approval detail moved there
  const docsReopenBad = docsReopenSurfaces.flatMap(([f, t, n]) => { const s = docsReopen(t); return s.length < n ? [f + " (" + s.length + " < " + n + ")"] : s.filter((x) => !/\bretire\b/.test(x)).map((x) => f + ": " + x); });
  ok(!docsReopenBad.length, "README.md / .pt.md / .es.md, AGENTS.md, tooling-reference and SKILL.md: every 'reopen unticks' sentence says a removed criterion's tasks are never unticked (retire) (bad: " + docsReopenBad.join(" | ") + ")");
  const docsApprove = docsWs(docsRead("commands", "approve.md"));
  const apDesc = (list.result.tools.find((t) => t.name === "spec_approve") || {}).description || "";
  // 1.26: the per-phase check lists left spec_approve's description AND /approve — a refusal names its failing check ids (the
  // engine's approvalChecks is the one list); neither may put a test-plan row under the tasks gate should one come back.
  ok(!/; tasks: [^;]*(?:test-plan|doesn't define|row citing)/.test(docsApprove) && /refusal names its failing check ids/.test(docsApprove) &&
    !/tasks: [^;]*row citing/.test(apDesc),
    "/approve + spec_approve: a test-plan row citing an undefined AC fails the TEST-PLAN gate's traceability (approvalChecks) — never listed under the tasks gate; /approve shows the refusal's failing check ids");
  // 1.20: the notes are CLAUDE.md (the index) + docs/maintainers/*.md — a moved section is read from its topic file, and
  // what no note may say is checked across all of them.
  const docsNotes = docsWs(maintainerNotes());
  const docsExtending = docsWs(docsRead("docs", "maintainers", "extending.md"));
  const docsConventions = docsWs(docsRead("docs", "maintainers", "conventions.md"));
  ok(!/23 v1\.12 tools|does not yet require newer ones/.test(docsNotes) &&
    /README tool tables \(EN\/PT\/ES — `mcp\/test\.js` builds the expected set from the live `tools\/list`: a missing or phantom row in any language fails the suite\)/.test(docsExtending),
    "docs/maintainers/extending.md 'When extending': the README tool-table test requires every live tool (built from tools/list); no maintainer note says the 23 v1.12 tools");
  // tooling-reference said "`drift` (drift) exit 1" — the CLI's drift also exits 1 on a stale baseline (the feature changed
  // since its finish: finish it again, nothing drifted) and on an unreadable .state.json. Every surface documenting drift's
  // exit code names the stale baseline; none says drift alone.
  const docsDriftExit = [["tooling-reference.md", docsRef("tooling-reference.md"), /`drift` \(drift, a stale baseline or an unreadable state\) exit 1/],
    ["AGENTS.md", docsAgents, /\(exit 1 on drift or a stale baseline\)/], ["commands/spec-report.md", docsRead("commands", "spec-report.md"), /exit 1 on drift or a stale baseline/],
    ["change-management.md", docsRef("change-management.md"), /exit 1 on drift or a stale baseline/], ["cli/commands.js (the CLI help)", docsRead("cli", "commands.js"), /\(exit 1 on drift or a stale baseline\)/],
    ["docs/maintainers/conventions.md", docsConventions, /`drift` \(drift, a stale baseline or an error\)/]];
  const docsDriftBad = docsDriftExit.filter(([, t, re]) => !re.test(docsWs(t)) || /`drift` \(drift\)/.test(docsWs(t))).map(([f]) => f)
    .concat(/`drift` \(drift\)/.test(docsNotes) ? ["the maintainer notes (CLAUDE.md + docs/maintainers/)"] : []);
  ok(!docsDriftBad.length, "every surface documenting drift's exit code (tooling-reference, AGENTS.md, /spec-report drift, change-management, CLI help, the maintainer notes' CLI exit codes) says a stale baseline exits 1 too, never 'drift (drift)' alone (bad: " + docsDriftBad.join(", ") + ")");
  { // 1.20 docs: CLAUDE.md is loaded into EVERY Claude Code session in this repository, so it is a short index — the hard
    // constraints, the layout in brief and a topic map — over docs/maintainers/, whose files are read on demand. An
    // `@docs/…` import would inline them all again. The map and the folder agree both ways, and the hard constraints
    // stay in the index itself.
    const idx = docsRead("CLAUDE.md").replace(/\r\n/g, "\n"), idxWs = docsWs(idx);
    const idxLines = idx.split("\n").length - (idx.endsWith("\n") ? 1 : 0);
    const idxImports = idx.split("\n").filter((l) => /(?:^|\s)@(?:\.\/)?docs\//.test(l));
    ok(idxLines <= 250 && idxImports.length === 0,
      "1.20 docs: CLAUDE.md is a short index (≤ 250 lines) that @-imports no topic file (got " + idxLines + " lines, imports " + JSON.stringify(idxImports) + ")");
    const mDir = path.join(root, "docs", "maintainers");
    const onDisk = fs.readdirSync(mDir).filter((f) => f.endsWith(".md")).sort();
    const mapText = (idx.split(/\n## Topic map\n/)[1] || "").split(/\n## /)[0];
    const topicRe = /docs\/maintainers\/([A-Za-z0-9._-]+\.md)/g;
    const mapped = [...new Set([...mapText.matchAll(topicRe)].map((m) => m[1]))].sort();
    const named = [...new Set([...idx.matchAll(topicRe)].map((m) => m[1]))].sort();
    const unmapped = onDisk.filter((f) => !mapped.includes(f)), phantom = named.filter((f) => !onDisk.includes(f));
    ok(onDisk.length >= 10 && !unmapped.length && !phantom.length && mapped.length === onDisk.length,
      "1.20 docs: every docs/maintainers/*.md is in CLAUDE.md's topic map and every topic file CLAUDE.md names exists (got on disk " +
      onDisk.join(", ") + "; mapped " + mapped.join(", ") + "; unmapped " + unmapped.join(", ") + "; phantom " + phantom.join(", ") + ")");
    const hard = [["no Actions / CI / PRs", /No GitHub Actions \/ no paid CI \/ no pull requests\.\*\* All automation is local/],
      ["no PR / CI steering", /No user-facing text may steer users toward PRs or CI/], ["zero runtime dependencies", /\*\*Zero runtime dependencies\.\*\* The MCP server and all scripts use only Node core/],
      ["specs in .specs/", /Specs always live in `\.specs\/`/], ["never a top-level bin/", /## Never ship a top-level `bin\/` .*rejects\*\* any plugin shipping a top-level `bin\/`/],
      ["hooks.json never in plugin.json", /\*\*Hooks: never reference `hooks\/hooks\.json` in `plugin\.json`\.\*\*/],
      ["engine first, then the operations table, tool AND subcommand AND test", /add it to the engine module of its concern first .* then give it ONE entry in the operations table, `mcp\/lib\/operations\.js` .* and wire it into server\.js .* AND cli\/commands\.js .*`c\.call\(\)`\) AND a test in the area's mcp\/tests file\. Both surfaces make the table's call, so the CLI and MCP behavior stay identical/],
      ["i18n in mcp/lib/i18n/, pt-BR derived", /every user-facing string lives in `mcp\/lib\/i18n\/\*` — `en\.js` · `pt\.js` · `es\.js` .* pt-BR is DERIVED from pt/],
      ["the heredoc backslash gotcha", /\*\*Shell heredocs eat backslashes\.\*\*/], ["the U+FEFF gotcha", /\*\*Never write a literal U\+FEFF into source\.\*\*/],
      ["the module rule", /\*\*The module rule \(1\.18\), in short:\*\* .*`\/\/ load time`.*`__link\(E\)`/],
      ["read the topic file first", /\*\*Before changing an area, read its topic file — the index is not enough\.\*\*/]];
    const hardMissing = hard.filter(([, re]) => !re.test(idxWs)).map(([n]) => n);
    ok(!hardMissing.length, "1.20 docs: CLAUDE.md itself states every hard constraint — no Actions / CI / PRs, zero dependencies, .specs/, no top-level bin/, hooks.json, engine-first + parity, i18n, the heredoc and U+FEFF gotchas, the module rule — and the read-the-topic-file rule (got missing: " + (hardMissing.join(", ") || "none") + ")");
  }
  const docsInstall =docsRead("INSTALL.md"), docsContrib = docsRead("CONTRIBUTING.md");
  ok(!/Copy-Item -Recurse/.test(docsInstall) && /\/plugin marketplace add <path-to-your-clone>/.test(docsInstall) && /dev-spec-driven@dev-spec-driven-marketplace/.test(docsInstall) &&
    [docsInstall, docsContrib].every((t) => /claude plugin validate [^\n]*plugin\.json/.test(t) && /claude plugin validate (?:\.|"\$plugin")[\s`]/.test(t)) &&
    !/^## Pull requests/m.test(docsContrib) && /^## Before merging/m.test(docsContrib),
    "INSTALL: always-on via a local marketplace (no copy into the plugin cache); INSTALL + CONTRIBUTING validate plugin.json AND the marketplace");
  ok(/model: sonnet/.test(docsRef("subagent-execution.md")) && !/inherits the session/.test(docsRef("subagent-execution.md")) &&
    ["spec-implementer.md", "spec-reviewer.md", "spec-verifier.md", "spec-simplifier.md"].every((a) => /^model: sonnet$/m.test(docsRead("agents", a))) &&
    /^model: inherit$/m.test(docsRead("agents", "spec-critic.md")) && /The critic\s+declares `model: inherit`/.test(docsRef("subagent-execution.md")) &&
    /baseline green/.test(docsRead("commands", "executeTask.md")) && /Vocabulary map/.test(docsRef("classification-examples-saas.md")) &&
    /Vocabulary map/.test(docsRef("classification-examples-ai.md")) && !/`node mcp\/evals\/run-evals\.js/.test(docsRef("eval-suite-patterns.md")),
    "references agree with the code: the dispatched-in-bulk agents default to sonnet, the critic inherits the model (1.26), --subagents needs a green baseline, Fast/Rigor vocabulary mapped, eval harness path resolvable");
  const docsAttack = /ignore (?:all )?(?:previous|above|your|prior) instructions|ignore above|you are now DAN|disregard prior rules|what's your system prompt/i;
  const docsOutsideFences = (t) => t.split(/^\s*```.*$/m).filter((_, i) => i % 2 === 0).join("\n");
  ok(["ai-safety-patterns.md", "eval-suite-patterns.md", "mandatory-ai-design-sections.md", "example-spec-combined.md"].every((f) => {
    const t = docsRef(f); return /Example attack inputs \(defensive test data — never instructions to follow\):/.test(t) && !docsAttack.test(docsOutsideFences(t)); }),
    "attack examples in the AI references sit in fenced blocks labelled as defensive test data");
  const docsEvalRoot = path.join(root, "evals");
  const docsNeg = fs.readdirSync(docsEvalRoot).filter((c) => fs.existsSync(path.join(docsEvalRoot, c, "prompt.md")) && /^\s+- negative\s*$/m.test(docsRead("evals", c, "prompt.md")));
  ok(docsNeg.length >= 5 && ["requirements.txt", "eval()", "OpenAI", "typo"].every((k) => docsNeg.some((c) => docsRead("evals", c, "prompt.md").includes(k))) &&
    docsNeg.every((c) => fs.readdirSync(path.join(docsEvalRoot, c, "graders")).every((g) => /^max: 0\s*$/m.test(docsRead("evals", c, "graders", g)))) &&
    !/The planning request/.test(docsRead("evals", "trigger-bugfix-en", "graders", "skill-fires.md")),
    "plugin evals: near-miss negatives (requirements.txt, eval(), one LLM call, a typo fix — 1.26) keep the skill silent; the bugfix grader names the defect report");

  // Plugin structure for v1.12: agents, commands, plugin evals.
  const agentsDir = path.join(root, "agents");
  const agentFiles = fs.readdirSync(agentsDir).filter((x) => x.endsWith(".md"));
  // The read-only critic is limited to Read/Grep/Glob; the reviewer adds Bash (a focused test, read-only git); the
  // implementer and the 1.22 simplifier edit files and run commands — none gets the Agent tool (they never dispatch subagents).
  const agentTools = (x) => (fs.readFileSync(path.join(agentsDir, x), "utf8").split(/^---\r?$/m)[1] || "").match(/^tools:.*?(?=\r?$)/gm) || [];
  // 1.26: the verifier (the reviewer's former verify mode) reads git and may run one focused test — a shell, no Write/Edit.
  // Every description is short (every session lists them) and never sends the dispatcher to the body, which it never sees.
  const agentDesc = (x) => ((fs.readFileSync(path.join(agentsDir, x), "utf8").split(/^---\r?$/m)[1] || "").match(/^description: (.*?)\r?$/m) || [])[1] || "";
  ok(agentFiles.sort().join() === "spec-critic.md,spec-implementer.md,spec-reviewer.md,spec-simplifier.md,spec-ui-reviewer.md,spec-verifier.md" &&
    agentTools("spec-critic.md").join() === "tools: Read, Grep, Glob" && agentTools("spec-ui-reviewer.md").join() === "tools: Read, Glob" &&
    /never edits code/i.test(agentDesc("spec-ui-reviewer.md")) &&
    agentTools("spec-reviewer.md").join() === "tools: Read, Grep, Glob, Bash, PowerShell" &&
    agentTools("spec-verifier.md").join() === "tools: Read, Grep, Glob, Bash, PowerShell" &&
    agentTools("spec-implementer.md").join() === "tools: Read, Write, Edit, Glob, Grep, Bash, PowerShell" &&
    agentTools("spec-simplifier.md").join() === "tools: Read, Write, Edit, Glob, Grep, Bash, PowerShell" &&
    agentFiles.every((a) => agentDesc(a).length > 80 && agentDesc(a).length <= 250 && !/When to invoke|agent body/.test(agentDesc(a))) &&
    !/read-only/i.test(agentDesc("spec-reviewer.md")) && /never edits code/i.test(agentDesc("spec-reviewer.md")) && /never edits code/i.test(agentDesc("spec-verifier.md")) &&
    Buffer.byteLength(fs.readFileSync(path.join(agentsDir, "spec-verifier.md"), "utf8")) <= 4000 && !/^## Verify mode$/m.test(fs.readFileSync(path.join(agentsDir, "spec-reviewer.md"), "utf8")),
    "6 plugin agents: the critic is read-only (Read, Grep, Glob), the 1.32 UI reviewer reads images only (Read, Glob), the reviewer and the verifier add a shell, the implementer and the simplifier Write/Edit and a shell — Bash and (1.23 review 5) PowerShell: Claude Code on Windows without Git Bash has only the PowerShell tool, and a tools list with an unresolved entry still launches — none gets the Agent tool; every description ≤ 250 characters with no pointer to the body, the reviewer's says 'never edits code' (it has a shell), the verifier ≤ 4 KB and the reviewer has no verify mode left (1.26; got " +
    JSON.stringify(agentFiles.map((a) => a + " " + agentDesc(a).length)) + ")");
  // 1.31 (from google/elephant-goldfish-model): the reviewers that judge an artifact or a finding start without CLAUDE.md
  // (`omitClaudeMd: true`, Claude Code 2.1.271+; older versions ignore the key); the ones that write or review code keep
  // the project's instructions. The critic has three modes — gate, a cold read (naive), a task brief's pre-flight (brief).
  {
    const front = (x) => fs.readFileSync(path.join(agentsDir, x), "utf8").split(/^---\r?$/m)[1] || "";
    const critic = docsWs(docsRead("agents", "spec-critic.md")), review = docsWs(docsRef("critic-review.md"));
    const subW = docsWs(docsRef("subagent-execution.md")), doctorCmd = docsWs(docsRead("commands", "spec-doctor.md"));
    const skillW = docsWs(docsRead("skills", "dev-spec-driven", "SKILL.md")), execCmd = docsWs(docsRead("commands", "executeTask.md"));
    all("1.31: the critic and the verifier start fresh (omitClaudeMd), the others keep CLAUDE.md; the critic's gate / naive / brief modes; the deep review by size with its triage and one re-audit (references/critic-review.md); the brief's pre-flight on `preflight: true` (subagent-execution.md, /executeTask, SKILL.md)", {
      fresh: () => ["spec-critic.md", "spec-verifier.md", "spec-ui-reviewer.md"].every((a) => /^omitClaudeMd: true$/m.test(front(a))),
      keep: () => ["spec-implementer.md", "spec-reviewer.md", "spec-simplifier.md"].every((a) => !/omitClaudeMd/.test(front(a))),
      verifierRules: () => /no `CLAUDE\.md` is in your context — a rule the finding cites, you read from its file/.test(docsWs(docsRead("agents", "spec-verifier.md"))),
      modes: () => ["- **gate** —", "- **naive** —", "- **brief** —", "## Naive mode — the cold read", "## Brief mode — the pre-flight",
        "### Understood as", "### Pre-flight: Ready | Decisions needed", "| **Readiness** |", "google/elephant-goldfish-model (Apache-2.0)"].every((s) => critic.includes(s)),
      naiveCold: () => /Do not read the steering, `decisions\.md`, the other artifacts or anything else first/.test(critic) && /Check before flagging\./.test(critic),
      reuseSearch: () => /Each `New` row of the design's Reuse & Integration: search the code for it/.test(critic),
      bySize: () => ["| s | the critic (gate) |", "| m, or no size | the critic (gate) + a cold read (naive) |",
        "| l | two independent critics (gate, A and B) + a cold read (naive) |", "The size is `spec_doctor`'s `size` (no key: no size)."].every((s) => review.includes(s)) &&
        /by this result's `size` \(none: no size\)/.test(doctorCmd),
      // review 13 (M2, L1, L9): never offered at the classification gate; the cold read only for requirements / design /
      // bug.md; the mode is a line of the dispatch prompt, never a tool parameter (the Agent tool may own a `mode`).
      // review 14: SKILL.md states the design-first offer too, a bugfix's requirements gate takes bug.md with it, and an
      // explicit --deep at classification says there is nothing to review yet.
      notClassification: () => /never at the classification gate/.test(review) && /never at the classification gate/.test(docsWs(docsRef("phase-guide.md"))) &&
        /\(design-first: the design's; never at classification\)/.test(skillW) && /a bugfix: its requirements approval, with bug\.md; a design-first feature: the design's/.test(review) &&
        /a bugfix's requirements: bug\.md with it; the classification gate: nothing yet/.test(doctorCmd),
      coldReadScope: () => /The cold read is only for the artifacts a newcomer must understand — `requirements\.md`, `design\.md`, `bug\.md`/.test(review) &&
        /of requirements\.md, design\.md or bug\.md only/.test(doctorCmd),
      modeLine: () => /The dispatch prompt's first line names the mode \(`Mode: gate`, `Mode: naive` or `Mode: brief`\)/.test(critic) &&
        /a line of the prompt, never a tool parameter/.test(review) && /a line of the prompt, never a tool parameter/.test(subW) &&
        ![review, subW, doctorCmd, execCmd, skillW, docsRef("phase-guide.md"), docsRef("tooling-reference.md"), docsRef("workflows.md")].some((t) => /`mode: (?:gate|naive|brief)`/.test(t)),
      triage: () => ["| **Fix** |", "| **Contest** |", "| **Ask** |", "a contest without evidence is a fix", "**One re-audit:**", "Never a second one."].every((s) => review.includes(s)),
      noReasoning: () => /Never in a dispatch: your reasoning, the conversation, why the artifact is right/.test(review) && /never with your own reasoning/.test(doctorCmd),
      indexed: () => /`references\/critic-review\.md` — the deep review before a gate/.test(docsRef("index.md")) && /references\/critic-review\.md/.test(doctorCmd) && /`references\/critic-review\.md`/.test(skillW),
      preflight: () => /#### Pre-flight the brief \(`preflight: true` — size m \/ l, or no size\)/.test(docsRef("subagent-execution.md")) &&
        /Dispatch \*\*`dev-spec-driven:spec-critic`\*\* with `Mode: brief` on the prompt's first line/.test(subW) && /the brief path \(`paths\.brief`\)/.test(subW) &&
        /\| Pre-flight \(the critic, brief mode\) \|/.test(subW) && /`preflight: false` \(sizes xs \/ s, a spike,/.test(subW) &&
        /on `preflight: true` its pre-flight \(`dev-spec-driven:spec-critic`, `Mode: brief`/.test(execCmd) && /its pre-flight \(the critic, brief mode/.test(skillW),
      // review 13 (L4, L5, L8): a ruling later tasks build on cites THEIR IDs; a pre-flight [Gap] is checked first and is a stop;
      // after a drift a converge ❌ is a regression (/spec-bugfix), never a task appended to the finished feature.
      rulings: () => /`spec_decide \{affects\}` naming the AC \/ T-IDs of every task that builds on it/.test(subW) &&
        /check the claim yourself first/.test(subW) && /5\. \*\*A `_Verify:_` that can't run as written\*\*/.test(subW),
      // review 14: … one the change didn't intend; an intended one is a spec change (the drift message's three outcomes hold).
      driftRegression: () => /\*\*After a drift\*\* \(a finished feature\), ask what the change meant: an ❌ it didn't intend is a regression of an AC that shipped — `\/spec-bugfix`/.test(subW) &&
        /one it intended is a spec change \(`\/spec-change <feature> impact`, or a new feature with `_Supersedes:_`\)/.test(subW) &&
        /After a drift, an ❌ the change didn't intend is a regression of a shipped AC \(`\/spec-bugfix`, not a task\); one it intended is a spec change\./.test(docsWs(docsRead("commands", "spec-review.md"))),
      briefInstructions: () => /the root `CLAUDE\.md` and the files it imports \(`@path`\), `\.claude\/CLAUDE\.md` and `CLAUDE\.local\.md` when present, and a `CLAUDE\.md` in the folders of the files the brief names/.test(critic) &&
        !/`AGENTS\.md`/.test(critic),
    });
    // 1.32 (from Shopify's Helix): the visual review of a +ui task — an image-only reviewer, INVALID on different states,
    // never "passed" without a reference or a capture; it re-runs after a fix that changes a view; more autonomy only on
    // the user's word; a checkpoint's general feedback becomes a steering amendment; the skeleton first.
    const uiAgent = docsWs(docsRead("agents", "spec-ui-reviewer.md")), uiRef = docsWs(docsRef("ui-review.md"));
    all("1.32: the visual review (agents/spec-ui-reviewer.md, references/ui-review.md) wired into the task loop, /executeTask and SKILL.md; the re-run after a fix, the autonomy grant, learnings → steering, the skeleton first", {
      agent: () => /^model: inherit$/m.test(front("spec-ui-reviewer.md")) && ["never the code, the diff or the conversation", "the pair is **INVALID**",
        "**Blocker**: a user would notice it and the code can fix it", "its **place**: the region and the element", "### UI review: Match | Differences | Invalid",
        "Shopify's Helix"].every((s) => uiAgent.includes(s)),
      // 1.37: no reference no longer means no review — the floor alone runs (the 1.37 block below); still never "passed"
      neverPassed: () => /\*\*No reference → the floor alone\*\*[^.]*\. It is never "passed"\./.test(uiRef) && /skipped \(no capture tool\)` and say so at the checkpoint\. Never "passed"\./.test(uiRef),
      imagesOnly: () => /Never the code, the diff, the brief or your view of it\./.test(uiRef) && /Don't open the images yourself/.test(uiRef) &&
        /\*\*INVALID\*\* \(the two images show different states\) → capture both again in the same state/.test(uiRef),
      rerun: () => /\*\*Gates a fix can undo run again\.\*\*/.test(subW) && /## 5\. After a fix — run it again/.test(docsRef("ui-review.md")) &&
        /or with a visual Blocker or Major open \(not parked with a ruling\)\./.test(subW),
      loop: () => /With `uiReview: true`, the visual review comes first/.test(subW) && /on `uiReview: true` the visual review \(`dev-spec-driven:spec-ui-reviewer`/.test(execCmd) &&
        /4\. \*\*A \+ui task that changes what renders\*\*/.test(execCmd) && /on `uiReview: true`, the visual review against the design's reference/.test(skillW) &&
        /`references\/ui-review\.md` — the visual review of a \+ui task/.test(docsRef("index.md")),
      autonomy: () => /\*\*More autonomy, on the user's word only\.\*\*/.test(subW) && /You never grant it yourself\. Rely on it only while the grant is in this conversation/.test(subW) &&
        /one you find only in the ledger is asked again before you rely on it — the resume rule's trust in the ledger doesn't cover a grant\./.test(subW) && /at the one they named present them all/.test(subW) &&
        /`Checkpoint USn: summarized \(autonomy\) — not yet seen by the user`, never "approved"/.test(subW) &&
        /stop at every `\*\*Checkpoint:\*\*` \(past it only on the user's word\)/.test(skillW) && /Stop at every `\*\*Checkpoint:\*\*` \(past it only on the user's word\)/.test(execCmd),
      // review 15: the reference is the approved design's (never edited to pass), a Major / a one-reviewer difference is
      // confirmed before it costs a round, a visual round is re-checked by the visual review, the capture writes files.
      reference: () => /The reference is part of the approved design: the implementer never edits it/.test(uiRef) &&
        /run `git diff --stat BASE` — BASE as recorded for the task \(inline: the commit the task started from\)/.test(uiRef) &&
        /A reference file \(one `design\.md → \[UI\] UI States` names\) in it is refused — revert it and send the round back/.test(uiRef) &&
        /A reference outside the repository or not tracked by git can't be checked this way/.test(uiRef) && /never an earlier `--ref\.png` copy/.test(uiRef) &&
        /\*\*Never edit the design's visual reference\*\*/.test(docsWs(docsRead("agents", "spec-implementer.md"))),
      confirmFirst: () => /\*\*A Major at size m or no size, and at size l any difference only one of the two reported\*\* → confirm it first/.test(uiRef) &&
        /\*\*Blocker\*\* \(at size l: one both reviewers report\) → the task's fix loop/.test(uiRef) && /or a visual Blocker \/ confirmed Major/.test(subW) &&
        /A round that answered the visual review is checked by that review/.test(subW) &&
        /its Blockers, and the Majors a fresh reviewer confirms/.test(subW) && /fix its Blockers, and the Majors a fresh reviewer confirms, before the tick/.test(execCmd) &&
        /its Blockers, and the Majors a fresh reviewer confirms, are fixed first/.test(execCmd) &&
        /a visual one on a fresh `spec-ui-reviewer`'s verdict, never yours/.test(subW),
      // review 16: SKILL.md runs the visual review after the implementer (the old text put it before the dispatch)
      skillOrder: () => /with its path, then, on `uiReview: true`, the visual review against the design's reference/.test(skillW),
      captureFiles: () => /A browser tool that only shows you the screen doesn't do/.test(uiRef) && /--screenshot=<file>/.test(uiRef),
      feedbackRule: () => /a rule for every later task → fix it here, then propose it as a steering amendment/.test(docsWs(docsRead("commands", "spec-review.md"))),
      learnings: () => /is a \*\*learning\*\* — propose it as a steering amendment/.test(subW) && /\| \*\*Project rule\*\* \|/.test(docsRef("review-feedback.md")),
      skeleton: () => /Within a story, the skeleton first/.test(docsWs(docsRef("phase-guide.md"))) && /within a story the first task builds the skeleton/.test(critic),
      uiReference: () => /and a reference the visual review compares the build with/.test(critic) && /13\. \*\*References\*\*/.test(docsRef("ui-design-patterns.md")),
    });
  }
  // 1.26: the 55 commands folded into 22 — the phase commands into /spec, the rest into umbrella commands with subcommands
  // (docs/maintainers/extending.md → The 1.26 command set has the old → new table); the exact set, nothing else.
  const cmdFiles = fs.readdirSync(path.join(root, "commands")).filter((x) => x.endsWith(".md")).sort();
  const cmdSet = ["approve", "clarify", "ds", "dss", "dsx", "eval", "executeTask", "feature", "roadmap", "spec", "spec-adopt", "spec-bugfix", "spec-change",
    "spec-doctor", "spec-finish", "spec-report", "spec-review", "spec-setup", "spec-spike", "spec-status", "spec-tour", "spec-upgrade"].map((x) => x + ".md").sort();
  ok(cmdFiles.length === 22 && cmdFiles.join() === cmdSet.join(),
    "22 commands: /spec (+ /ds), /spec-bugfix, /clarify, /approve, /spec-doctor, /executeTask (+ /dsx), /spec-status (+ /dss), /roadmap, /spec-review, /spec-finish, /spec-spike, /spec-change, /feature, /spec-report, /spec-adopt, /spec-setup, /eval, /spec-upgrade, /spec-tour (got " + cmdFiles.join(", ") + ")");
  const evalRoot = path.join(root, "evals");
  // `fixtures/` holds the behavioural cases' shared scaffold (lib.sh + project trees) — not a case. Behavioural cases
  // (tag `behavior`) grade what the agent DOES, not whether the skill fires; they are checked in the A3 block below.
  const evalCases = fs.readdirSync(evalRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && !["results", "fixtures"].includes(e.name)).map((e) => e.name);
  const evalBehavior = (c) => /^\s+- behavior\s*$/m.test(fs.readFileSync(path.join(evalRoot, c, "prompt.md"), "utf8"));
  ok(evalCases.length >= 5 && evalCases.every((c) => fs.existsSync(path.join(evalRoot, c, "prompt.md")) && (evalBehavior(c) ||
    fs.readdirSync(path.join(evalRoot, c, "graders")).some((g) => /input_match: '"skill":\\s\*"dev-spec-driven:\[\\w-\]\+"'/.test(fs.readFileSync(path.join(evalRoot, c, "graders", g), "utf8"))))),
    "plugin evals: every case has prompt.md; every triggering case a grader with an intact regex");

  // Owner's cost rule: the plugin never steers users toward pull requests or CI.
  // Scans every prose surface a user or agent reads (not CHANGELOG.md — that is history).
  const walkFiles = (p) => fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((x) => walkFiles(path.join(p, x))) : [p];
  const proseFiles = ["commands", path.join("skills", "dev-spec-driven"), "agents", "evals", "integrations"]
    .flatMap((d) => walkFiles(path.join(root, d)).filter((p) => p.endsWith(".md")))
    .concat([path.join(".cursor", "rules"), path.join(".windsurf", "rules")].flatMap((d) => walkFiles(path.join(root, d))))
    .concat(["README.md", "README.pt.md", "README.es.md", "AGENTS.md", "CONTRIBUTING.md", "INSTALL.md", "INTEGRATIONS.md", "GEMINI.md",
      path.join(".github", "copilot-instructions.md")].map((f) => path.join(root, f)));
  // Negations are dropped before matching. `no` is ambiguous: the English/Spanish negator ("no PRs", "(no CI)")
  // or the European-Portuguese contraction em+o ("o delta de eval no PR" = IN the PR). So a plural is always a
  // negation, but a singular `no PR`/`no CI` only after punctuation or at a line start; right after a word it
  // reads as PT and is flagged (write "…, no CI" or use never/without). never/not/without/sem/sin/nunca/nem/
  // ni/não may sit up to 3 words before the noun ("never run in CI", "not in the PR", "never open a PR") — but
  // no window word may invert it ("never skip opening a PR", "never bypass the CI gate" steer), and a window
  // never swallows "CI gate" ("merge without the CI gate" steers too).
  const negWord = String.raw`(?:\s+(?!(?:skip|bypass|forg[eo]t|ignor|omit|avoid|disabl|remov|circumvent|unless|until|before|without|salt[aeo]|esquec|olvid|evit|desativ|desactiv|contorn|antes))[A-Za-zÀ-ÿ0-9'’-]+)`;
  const negWindow = String.raw`\b(?:not|never|without|sem|sin|nunca|nem|ni|não|neither|nor)${negWord}{0,3}?\s+(?:PRs?|pull requests?|CI(?!\s+gate))\b`;
  const negTail = (no) => String.raw`(?:\s*(?:,|or|and|nor|ou|o|e|y)\s*${no ? String.raw`(?:no\s+)?` : ""}(?:paid\s+)?CI\b)?`;
  const negations = [String.raw`\bno\s+(?:PRs|pull requests)\b`, String.raw`(?<![A-Za-zÀ-ÿ0-9_]\s*)\bno\s+(?:paid\s+)?(?:PR|pull request|CI)\b`, negWindow]
    .map((r) => new RegExp(r + negTail(true), "gi"));
  const dropNegations = (t) => negations.reduce((s, re) => s.replace(re, ""), t);
  // PT prose (README.pt.md, whole — the README's `## Português` block until 1.26) is read as PT: there `no` is always em+o,
  // so only the window negates (PT negates with não/sem/nem) and a sentence-initial "No PR, inclui…" / "Depois, no CI, …" steers.
  const ptNegation = new RegExp(negWindow + negTail(false), "gi");
  const ptNoRe = /(?<![\p{L}\p{N}_])[Nn]os?\s+(?:PRs?|[Pp]ull [Rr]equests?|CI)\b/u;
  const PR = "(?:PR|[Pp]ull [Rr]equest)";
  const steersRe = new RegExp([
    String.raw`\b(?:[Oo]pen|[Cc]reate|[Ss]ubmit|[Rr]aise|[Ff]ile)(?:s|ed|ing)?\b[^.\n]{0,20}?\b${PR}s?\b`,
    String.raw`\b(?:abr(?:e|ir|a|as|es)|cri(?:a|ar|e)|crea|crear)\b[^.\n]{0,15}?\b${PR}s?\b`, // PT/ES open/create
    String.raw`\b(?:[Ee]very|[Ee]ach|[Cc]ada) (?:prompt )?${PR}\b`, String.raw`\bPR comment`, String.raw`\bPR #\d`,
    String.raw`\bPRs? (?:is|are) blocked`, String.raw`\bPR-friendly`, String.raw`\b[Ii]n (?:the |a |your |each |every )?${PR}\b`,
    String.raw`\b[Ee]n (?:el |un |cada )?${PR}\b`, String.raw`[A-Za-zÀ-ÿ]\s+nos?\s+(?:${PR}s?|CI)\b`, // ES "en el PR", PT "no PR"/"nos PRs"
    String.raw`\b[Pp]ush(?:es|ing)? and open`, String.raw`\bCI gate`, String.raw`\b[Ii]n (?:the |your |a |our )?CI\b`, String.raw`\b[Oo]n CI\b`,
    String.raw`\b[Ee]n (?:el |la )?CI\b`,
  ].join("|"));
  const steers = (t, pt) => { const u = pt ? t.replace(ptNegation, "") : dropNegations(t); return steersRe.test(u) || (!!pt && ptNoRe.test(u)); };
  const readmePtPath = path.join(root, "README.pt.md");
  const proseParts = proseFiles.map((p) => { const t = fs.readFileSync(p, "utf8"); return p === readmePtPath ? [p, "", t] : [p, t, ""]; });
  const readmePt = (proseParts.find(([p]) => p === readmePtPath) || [])[2] || "";
  const steersToPr = proseParts.filter(([, t, pt]) => steers(t) || steers(pt, true)).map(([p]) => p);
  const guardMissed = ["in the PR", "Prompt PRs are blocked", "git/PR-friendly", "Open a pull request", "push and open one", "on every PR", "a CI gate", "runs in CI",
    "Põe o delta de eval no PR.", "Os testes de carga correm no CI.", "Incluye el delta de evals en el PR.", "Depois, abrir o PR com o resumo.", "comenta nos PRs",
    "Then create a pull request with the summary.", "Push the branch and open a new PR.", "Run the load test in your CI pipeline.", "Every pull request must include evals.",
    "Fix: PR #1234 adds index.", "Never skip the CI gate.", "Do not skip the CI gate before merging.", "Never bypass the CI gate.", "Never skip opening a PR.",
    "Never forget to open a PR.", "Never merge without the CI gate.", "Never merge before opening a PR."].filter((s) => !steers(s))
    .concat(["No PR, inclui o delta de evals.", "Depois, no PR, inclui o delta de evals.", "No CI corre a suite completa.", "Quando terminares: no PR, cola o resumo.",
      "Nos PRs, cola o resumo."].filter((s) => !steers(s, true)));
  const guardFlagged = ["no PR or CI needed", "no pull requests, no CI", "never open a PR", "without a PR", "sem PR", "sin PR", "no PRs or CI", "locally, not in CI",
    "/prReview", "comments on PRs", "Evals are never run in CI.", "Keep the summary local, not in the PR.", "Do not create a pull request.", "(no CI, no extra service)",
    "Automatización local, no CI", "Automação local, não CI", "sem pull requests, sem CI", "No PR needed.", "merge locally; no PRs",
    "**No GitHub Actions / no paid CI / no pull requests**", "a PRD", "the CIA"].filter((s) => steers(s))
    .concat(["sem pull requests, sem CI", "Automação local, não CI", "Nunca abras um PR.", "sem PR nem CI", "Tudo local: sem GitHub Actions, sem CI pago, sem pull requests.",
      "Nota: o PRD e a CIA."].filter((s) => steers(s, true)));
  ok(guardMissed.length === 0 && guardFlagged.length === 0,
    "the PR/CI guard catches EN/PT/ES steering and allows negations (missed: " + guardMissed.join(" | ") + "; wrongly flagged: " + guardFlagged.join(" | ") + ")");
  ok(steersToPr.length === 0 && readmePt.length > 1000 && S.finishFeature(vDir, "login-loop").message.indexOf("PR") === -1,
    "no command/skill/agent text steers toward PRs or CI; README.pt.md is read as PT, README.es.md as ES (found: " + steersToPr.map((p) => path.relative(root, p)).join(", ") + ")");

  // 1.14 full review (D) — docs and prose.
  {
    const dRead = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const dRef = (f) => dRead("skills", "dev-spec-driven", "references", f);
    const dWs = (t) => t.replace(/\s+/g, " ");
    // D1: red-green counts only _Makes green:_ IDs — a bugfix's guard test T-02 shows up only on a pre-1.14 bugfix
    // (its task 4 still lists it); the docs said it "is expected here" / "is named there too" on every bugfix.
    // (1.26: /spec-doctor no longer explains each check — its result does, and tooling-reference.md lists them; the references keep it)
    const d1Docs = [dRef("verification.md"), dRef("test-patterns.md")].map(dWs);
    ok(d1Docs.every((t) => !/T-02 is expected here|is named there too/.test(t) && /before 1\.14|an older bugfix scaffold/.test(t) && /remove (?:T-02|it) from (?:that|there|task 4)/.test(t)) &&
      !/T-02 is expected here|is named there too/.test(dWs(dRead("commands", "spec-doctor.md"))),
      "full review D1: verification / test-patterns — T-02 in red-green only on a pre-1.14 bugfix; the fix is removing it from task 4's _Makes green:_ (/spec-doctor says nothing else)");
    // D2: the canonical _Expect: fail_ example keeps _Makes green:_ off the red task (the fix task makes it green).
    const d2Ex = ((dRef("verification.md").split("## Red → green")[1] || "").match(/```markdown\n([\s\S]*?)\n```/) || [])[1] || "";
    ok(/_Expect: fail_/.test(d2Ex) && !/_Makes green:/.test(d2Ex), "full review D2: verification.md's _Expect: fail_ example has no _Makes green:_ on the red task");
    // D3: design section examples use the template's heading ("Data Models"); decide refuses "Data Model" on a fresh scaffold.
    const d3Surfaces = [dRead("cli", "commands.js"), dRead("mcp", "server.js"), dRead("commands", "spec-change.md"), dRef("change-management.md")];
    const d3p = path.join(tmp, "fr-d3");
    S.initProject(d3p, ["core"], "en");
    S.createFeature(d3p, "Keys", ["core"]);
    const d3bad = S.decide(d3p, "keys", { title: "t", decision: "d", affects: ["Data Model"] });
    const d3ok = S.decide(d3p, "keys", { title: "t", decision: "d", affects: ["Data Models"] });
    ok(d3Surfaces.every((t) => !/["'`]Data Model["'`]|Data Model_/.test(t)) && d3Surfaces.every((t) => /Data Models/.test(t)) && d3bad.ok === false && d3ok.ok === true,
      "full review D3: no \"Data Model\" example (the design template's heading is Data Models) — decide refuses the singular, accepts the heading (got " + JSON.stringify([d3bad.ok, d3ok.ok]) + ")");
    // D4: every command / agent / SKILL.md front matter is strict `key: value` YAML — a plain scalar never holds ": " or
    // " #" nor starts with an indicator; quoted values are valid; block scalars are indented. The prompts reader agrees.
    const d4Files = [...fs.readdirSync(path.join(root, "commands")).filter((x) => x.endsWith(".md")).map((x) => ["commands", x]),
      ...fs.readdirSync(path.join(root, "agents")).filter((x) => x.endsWith(".md")).map((x) => ["agents", x]), ["skills", "dev-spec-driven", "SKILL.md"]];
    const d4Bad = [];
    for (const f of d4Files) {
      const lines = dRead(...f).split("\n");
      const end = lines.indexOf("---", 1);
      if (lines[0] !== "---" || end < 0) { d4Bad.push(f.join("/") + ": no front matter"); continue; }
      for (let i = 1; i < end; i++) {
        const m = /^([A-Za-z][A-Za-z0-9_-]*):(?: (.*))?$/.exec(lines[i]);
        if (!m) { d4Bad.push(f.join("/") + ":" + (i + 1)); continue; }
        const v = (m[2] || "").trim();
        if (v === "") continue;
        if (/^[|>][+-]?$/.test(v)) { while (i + 1 < end && /^(?:\s+\S.*)?$/.test(lines[i + 1])) i++; continue; }
        if (v[0] === "\"") { try { JSON.parse(v); } catch { d4Bad.push(f.join("/") + ":" + (i + 1) + " bad quoted"); } continue; }
        if (v[0] === "'") { if (!/^'(?:[^']|'')*'$/.test(v)) d4Bad.push(f.join("/") + ":" + (i + 1) + " bad quoted"); continue; }
        if (/^[[\]{}#&*!|>%@`,]/.test(v) || /^[-?:](?:\s|$)/.test(v) || /: |:$/.test(v) || /\s#/.test(v)) d4Bad.push(f.join("/") + ":" + (i + 1) + " plain scalar");
      }
    }
    const d4Report = require("./lib/prompts-resources.js").listPrompts().find((x) => x.name === "spec-report");
    ok(d4Files.length === 29 && d4Bad.length === 0 && d4Report && /^Reports from the specs: the living catalog, drift since finish/.test(d4Report.description),
      "full review D4: all 22 commands + 6 agents + SKILL.md front matter parse as strict key: value YAML (bad: " + d4Bad.join(", ") + "); the prompts reader still reads spec-report's quoted description");
    // D5: guard is a string enum on | off | scope — the docs told agents to pass guard: true / false.
    const d5Docs = [dRead("commands", "spec-setup.md"), dRef("tooling-reference.md")]; // 1.26: /spec-guard + /spec-init → /spec-setup guard | init
    const d5Schema = list.result.tools.find((t) => t.name === "spec_init").inputSchema.properties.guard;
    ok(d5Schema.type === "string" && d5Schema.enum.join() === "on,off,scope,tests" &&
      d5Docs.every((t) => !/guard: (?:true|false)\b|`true` \/ `"scope"`|`true` \/ `false`/.test(t) && /"on"/.test(t) && /"off"/.test(t) && /"scope"/.test(t) && /"tests"/.test(t)),
      "full review D5: /spec-setup (guard, init) and the tooling reference pass guard as \"on\" / \"off\" / \"scope\" / \"tests\" (the schema's string enum)");
    // D6: spec_approve's description lists every execution check (suite-evidence; a spike's spike / decision), one line.
    const d6Desc = list.result.tools.find((t) => t.name === "spec_approve").description;
    // (1.26: the per-phase check lists left the description and /approve — a refusal names its failing check ids; /approve still
    // says what gates `execution`)
    ok(!/\n/.test(d6Desc) && /REFUSES it while the phase's checks fail/.test(d6Desc) && /spec_finish's blockers[\s\S]{0,400}`suite-evidence`/.test(dWs(dRead("commands", "approve.md"))),
      "full review D6: spec_approve's description says the gate refuses while the phase's checks fail; /approve names the execution gate's suite-evidence");
    // 1.21 review A8: no tool description runs two sentences together (spec_approve read "…the user runs).WAIVERS:")
    // (1.32.2: read without the runnable CLI line's quoted path — it is the checkout's, and one in a folder named like `a.DFT…`,
    // the pre-push gate's temp worktree `dev-spec-pre-push.DFT…`, read as two sentences run together)
    const prose = (d) => d.replace(/node "[^"]*"/g, "node \"<cli>\"");
    const runTogether = list.result.tools.map((t) => [t.name, (prose(t.description).match(/[a-z)\]`'"]\.[A-Z]{3,}/g) || [])]).filter((x) => x[1].length);
    ok(!runTogether.length && /[a-z)`]\. FAST-FORWARD:/.test(d6Desc),
      "1.21 review A8: every tool description leaves a space after a sentence before the next heading word (spec_approve's '… FAST-FORWARD:') (got " + JSON.stringify(runTogether) + ")");
    // D7: the demo is in the 1.14 shape (stamp, stored tracks, the .gitignore init writes) — no upgrade notice — and its
    // +tdd feature records the Phase 4 red run, so executing it as written leaves no red-green warning.
    const d7Src = path.join(root, "examples", "demo-project");
    const d7 = path.join(tmp, "fr-d7", "demo-project");
    fs.cpSync(d7Src, d7, { recursive: true });
    const d7Init = path.join(tmp, "fr-d7-init");
    S.initProject(d7Init, ["core"], "en");
    const d7States = ["api-keys", "usage-metering"].map((f) => JSON.parse(fs.readFileSync(path.join(d7, ".specs", f, ".state.json"), "utf8")));
    const d7Tasks = fs.readFileSync(path.join(d7, ".specs", "api-keys", "tasks.md"), "utf8");
    const d7Verify = (d7Tasks.match(/^ {2}- _Verify: (.*)_$/m) || [])[1];
    const d7Red = S.completeTask(d7, "api-keys", 1, { command: d7Verify, exitCode: 1, summary: "7 failed" });
    for (let n = 2; n <= 9; n++) S.completeTask(d7, "api-keys", n, { summary: "done" });
    const d7Doc = S.specDoctor(d7, "api-keys");
    const d7Rg = d7Doc.checks.find((c) => c.id === "red-green");
    const d7Readme = dRead("examples", "README.md");
    ok(S.specVersionStatus(d7).behind === false && d7States.every((st) => Array.isArray(st.tracks) && st.tracks.includes("core")) &&
      fs.readFileSync(path.join(d7, ".specs", ".gitignore"), "utf8") === fs.readFileSync(path.join(d7Init, ".specs", ".gitignore"), "utf8") &&
      d7Red.ok && d7Red.redRecorded === true && d7Rg && d7Rg.status === "pass" && d7Readme.startsWith("# Example — a fully worked spec (" + JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version.split(".").slice(0, 2).join(".") + " shape)") && /0\/9 tasks done/.test(d7Readme),
      "full review D7: the demo is current-shaped (the current version — no upgrade notice, tracks stored, init's .gitignore) and its red-run task leaves red-green passing once every task is done (got " +
      JSON.stringify([S.specVersionStatus(d7), d7Red.ok, d7Rg && d7Rg.status]) + ")");
    // The +tdd reference example: an _Expect: fail_ task names every T-ID the other tasks make green; the combined example
    // no longer claims "all four tracks" (there are six).
    const d7ExTasks = (dRef("example-spec.md").split("## tasks.md")[1] || "").split(/\n(?=- \[ \] )/);
    const d7ExRed = d7ExTasks.find((b) => /_Expect: fail_/.test(b)) || "";
    const d7Greened = d7ExTasks.flatMap((b) => ((b.match(/_Makes green: ([^_]*)_/) || [])[1] || "").split(/,\s*/).filter(Boolean));
    ok(d7ExRed && d7Greened.length >= 13 && d7Greened.every((id) => new RegExp("(?<![A-Za-z0-9])" + id + "(?!\\d)").test(d7ExRed.split("\n")[0])) &&
      !/all four tracks|every track at once/.test(dRef("example-spec-combined.md")),
      "full review D7: example-spec.md's red-run task (_Expect: fail_) names every T-ID made green; example-spec-combined is no longer titled 'all four tracks'");
    // D8: the tour fills its plan before it approves it (1.26: a size-xs change — change.md, one plan approval — instead of
    // classification.md and four gates); the bugfix flow records task 1's red run before the fix (task 2) — the short form: the
    // reproduction and the root cause are bug.md's, gated by the approvals, never a task to tick.
    const d8Tour = dWs(dRead("commands", "spec-tour.md")), d8Bug = dWs(dRead("commands", "spec-bugfix.md")), d8Ref = dWs(dRef("bugfix.md"));
    ok(/3\. \*\*Classify and size\*\*.*4\. \*\*Plan\*\* — fill `change\.md`.*5\. \*\*Approve\*\*/.test(d8Tour) &&
      /\(T-01, task 1\) — the scaffold marks task 1 `_Expect: fail_`/.test(d8Bug) && /done <feature> 1 --run/.test(d8Bug) && /\*\*Fix the cause\*\* \(one change, task 2\)/.test(d8Bug) &&
      d8Bug.indexOf("done <feature> 1 --run") < d8Bug.indexOf("done <feature> 2 --run") && !/done <feature> [34]\b/.test(d8Bug) &&
      /no task stands for them/.test(d8Ref) && /\*\*Failing regression test\*\* \(task 1\)/.test(d8Ref) && /\*\*Fix\*\* \(task 2\)/.test(d8Ref),
      "full review D8: /spec-tour sizes the change (step 3) and fills change.md (step 4) before approving it (step 5); /spec-bugfix and references/bugfix.md: task 1 is the red regression test (its red run first), task 2 the fix — no reproduce / root-cause task to tick");
    // D9: the implementer and the reviewer get explicit tool lists — no Agent tool (they never dispatch subagents).
    const d9Tools = (x) => ((dRead("agents", x).split(/^---$/m)[1] || "").match(/^tools: (.*)$/m) || [])[1] || "";
    ok(["spec-implementer.md", "spec-reviewer.md", "spec-critic.md"].every((x) => d9Tools(x) && !/\b(?:Agent|Task)\b/.test(d9Tools(x))) &&
      !/\b(?:Write|Edit)\b/.test(d9Tools("spec-reviewer.md")) && /\bBash\b/.test(d9Tools("spec-reviewer.md")) && /\bWrite\b.*\bEdit\b/.test(d9Tools("spec-implementer.md")),
      "full review D9: spec-implementer (Read/Write/Edit/Glob/Grep/Bash) and spec-reviewer (read-only + Bash) declare tools — neither can dispatch subagents");
    // D10: spec_scan takes no path — /spec-adopt scan (/scan until 1.26) says to pass the folder as projectDir.
    const d10 = dRead("commands", "spec-adopt.md");
    ok(!list.result.tools.find((t) => t.name === "spec_scan").inputSchema.properties.path && !/\[optional path\]/.test(d10) && /as `projectDir`/.test(d10),
      "full review D10: /spec-adopt scan no longer hints at a path argument spec_scan doesn't have; it passes the folder as projectDir");
    // D11: the evidence rule sits in the initialize instructions, but not first — the CHANGELOG said they "open with it".
    ok(/Evidence before claims/.test(init.result.instructions) && !/^Evidence/.test(init.result.instructions) && !/instructions open with it/.test(dWs(dRead("CHANGELOG.md"))),
      "full review D11: the CHANGELOG no longer says the initialize instructions open with the evidence rule");
    // D12: INSTALL.md (and CONTRIBUTING.md) call the CLAUDE.md warning of `claude plugin validate` expected.
    ok([dWs(dRead("INSTALL.md")), dWs(dRead("CONTRIBUTING.md"))].every((t) => /CLAUDE\.md at the plugin root is not loaded as project context/.test(t) && /expected/.test(t)),
      "full review D12: INSTALL / CONTRIBUTING say the CLAUDE.md warning of plugin validate is expected");
    // D13: exit 126 / 127 / 9009 on an _Expect: fail_ task is refused AND recorded (a red run already there is kept).
    const d13p = path.join(tmp, "fr-d13");
    S.initProject(d13p, ["core"], "en");
    S.createFeature(d13p, "Red", ["core"]);
    fs.writeFileSync(path.join(d13p, ".specs", "red", "tasks.md"), "- [ ] 1. [US1] Write T-01 and watch it fail\n  - _Verify: node t.js_\n  - _Expect: fail_\n");
    const d13a = S.completeTask(d13p, "red", 1, { command: "node t.js", exitCode: 127 });
    const d13Rec = (JSON.parse(fs.readFileSync(path.join(d13p, ".specs", "red", ".state.json"), "utf8")).evidence || {})["1"] || {};
    ok(d13a.ok === false && d13a.recorded === true && d13Rec.exitCode === 127 && !/`done --run` records nothing for it/.test(maintainerNotes()),
      "full review D13: a could-not-run exit (127) on an _Expect: fail_ task is refused and recorded — no maintainer note (CLAUDE.md, docs/maintainers/) says done --run records nothing for it");
  }

  { // 1.21 F3 — what the plugin evals showed, in the prose the agent reads: (a) every `done … --run` / `finish … --run` line a command
    // file hands the user is runnable in a plugin install (node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" …), and the skill / the
    // references hand over the runnable line (`node "<clone>/cli/dev-spec.js" …`), never a bare `dev-spec done … --run`; (b) without a
    // shell: ask the user — never a subagent hunting for one (/spec-bugfix, verification.md, bugfix.md, red-flags.md, SKILL.md, the
    // spec_complete_task description and the MCP instructions); (c) a green run is evidence, not the execution sign-off — an explicit
    // yes first (/spec-finish step 3, SKILL.md, the spec_finish / spec_approve descriptions); (d) the bugfix prefill is documented.
    const cmdDir = path.join(root, "commands");
    const bareRun = fs.readdirSync(cmdDir).filter((f) => f.endsWith(".md")).flatMap((f) => (fs.readFileSync(path.join(cmdDir, f), "utf8").match(/`dev-spec (?:done|finish) <[^`\n]*--run[^`\n]*`/g) || []).map((m) => f + ": " + m));
    const runnableCmds = fs.readdirSync(cmdDir).filter((f) => /node "\$\{CLAUDE_PLUGIN_ROOT\}\/cli\/dev-spec\.js" (?:done|finish) /.test(fs.readFileSync(path.join(cmdDir, f), "utf8")));
    const skillT = docsSkill, verT = docsRef("verification.md"), bugT = docsRef("bugfix.md"), flagsT = docsRef("red-flags.md");
    const bareHandOff = [["SKILL.md", skillT], ["verification.md", verT], ["bugfix.md", bugT], ["red-flags.md", flagsT]]
      .filter(([, t]) => /(?:ask the user[^.\n]{0,120}|or to run |or run )`dev-spec (?:done|finish) /i.test(t.replace(/\s+/g, " "))).map(([f]) => f);
    const tools = Object.fromEntries(list.result.tools.map((t) => [t.name, t.description]));
    const finishCmd = docsWs(docsRead("commands", "spec-finish.md")), bugCmd = docsWs(docsRead("commands", "spec-bugfix.md"));
    const noSubagent = [["spec-bugfix.md", bugCmd], ["verification.md", docsWs(verT)], ["bugfix.md", docsWs(bugT)], ["red-flags.md", docsWs(flagsT)], ["SKILL.md", docsWs(skillT)],
      ["spec_complete_task", tools.spec_complete_task], ["initialize", init.result.instructions]].filter(([, t]) => !/(?:never|don't|not) send a subagent|never dispatch a subagent|send a subagent to find a shell/i.test(t || "")).map(([f]) => f);
    const signOff = /\*\*A green run is evidence, not\s+the sign-off:\*\*/.test(finishCmd) && /only on their yes/.test(finishCmd) &&
      /a green\s+run is evidence, not the sign-off/i.test(docsWs(skillT)) && /A green run is EVIDENCE, not the sign-off/.test(tools.spec_finish) &&
      /an explicit yes for THAT phase/.test(tools.spec_approve);
    const prefill = ["reproduction", "rootCause", "condition", "behaviour", "includeBody"].every((k) => bugCmd.includes("`" + k) || bugCmd.includes(k + "`")) &&
      /--root-cause/.test(docsWs(bugT)) && /prefill/i.test(tools.spec_create) && tools.spec_complete_task.includes(S.DEV_SPEC + " done <feature> <n> --run");
    ok(!bareRun.length && runnableCmds.length >= 6 && !bareHandOff.length && !noSubagent.length && signOff && prefill,
      "1.21 F3: command files hand over runnable `--run` lines (node \"${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js\" …), the skill and references the `node \"<clone>/cli/dev-spec.js\"` line; no shell → ask the user, never a subagent (bugfix command, verification / bugfix / red-flags references, SKILL.md, the complete_task description, the MCP instructions); a green run is evidence, not the execution sign-off (/spec-finish, SKILL.md, spec_finish / spec_approve); the bugfix prefill is documented (got " +
      JSON.stringify({ bareRun, runnableCmds: runnableCmds.length, bareHandOff, noSubagent, signOff, prefill }) + ")");
  }

  { // 1.22 review (prose) — one assertion per finding the independent review verified in the docs the agents read.
    const sub = docsWs(docsRef("subagent-execution.md")), impl = docsWs(docsRead("agents", "spec-implementer.md")), skillW = docsWs(docsSkill);
    const cut = (t, a, b) => (t.split(a)[1] || "").split(b)[0];
    const par = cut(sub, "## Parallel mode", "## Where autonomy stops");
    // P2: the Agent tool's worktree isolation bases the worktree on the default branch — the controller makes each one by
    // hand from the recorded BASE and the implementer checks its HEAD before it starts.
    ok(/git worktree add <path> -b task-N <BASE>/.test(par) && /Never the Agent tool's `isolation: "worktree"`/.test(par) &&
      !/each with worktree isolation/.test(sub) && /made by hand from the wave's BASE/.test(par) &&
      /\*\*Dispatched into a worktree\?\*\*[^#]*`git rev-parse HEAD` there equals the BASE you were given/.test(cut(impl, "## Before you begin", "1. Read the brief")),
      "1.22 review P2: parallel mode and waves create each worktree by hand from BASE (never isolation: \"worktree\"); spec-implementer checks HEAD = BASE before it begins");
    // P3: SKILL.md's subagent loop names the verify pass, still ≤ 5,000 words.
    ok(/send the diff to \*\*`dev-spec-driven:spec-reviewer`\*\*, verify each ❌ \/ Critical \/ Important finding \(a `dev-spec-driven:spec-verifier` per finding; only 80\+ opens a fix round\)/.test(skillW) &&
      docsSkill.split(/\s+/).filter(Boolean).length <= 5000,
      "1.22 review P3: SKILL.md's subagent loop verifies each ❌ / Critical / Important finding before a fix round (80+; the spec-verifier agent since 1.26), within 5,000 words (got " + docsSkill.split(/\s+/).filter(Boolean).length + ")");
    // P4: since 1.21 the MCP server guards approvals too (elicitation, or a refusal under deny) — AGENTS.md says so and how
    // to answer a declined / humanRequired result.
    const agentsW = docsWs(docsAgents), guardItem = cut(agentsW, "**The approval guard: a Claude Code hook, and the MCP server.**", "- **Alongside superpowers.**");
    ok(/elicitation/.test(guardItem) && /`declined: true`[^.]*record nothing, ask what should change/.test(guardItem) && /`humanRequired: true` refusal[^.]*names a `command`/.test(guardItem) &&
      /never approve on your own/.test(guardItem) && !/nothing enforces it|enforced by Claude Code hooks only/.test(agentsW),
      "1.22 review P4: AGENTS.md — the approval guard is the hook AND the MCP server (elicitation / deny); declined → record nothing, humanRequired → the user runs its command");
    // P5: spec_create's tracks is an array — a comma string is refused ("tracks must be an array").
    const mdDirs = [["commands"], ["agents"], ["skills", "dev-spec-driven", "references"]];
    const strTracks = mdDirs.flatMap((d) => fs.readdirSync(path.join(root, ...d)).filter((f) => f.endsWith(".md") && /\btracks: "/.test(docsRead(...d, f))).map((f) => d.join("/") + "/" + f));
    ok(!strTracks.length && /tracks: \["tdd", "a11y"\]/.test(docsRead("commands", "spec-setup.md")),
      "1.22 review P5: no command, agent or reference passes spec_create a comma string for tracks (got " + JSON.stringify(strTracks) + ")");
    // P6: SubagentStop matches spec-(implementer|simplifier) — no doc says the implementer only.
    const hooksJson = docsRead("hooks", "hooks.json");
    ok(/spec-\(implementer\|simplifier\)/.test(hooksJson) && /SubagentStop\*\* \(the `spec-implementer` and `spec-simplifier` agents only\)/.test(docsRef("verification.md")) &&
      /SubagentStop for the `spec-implementer` and `spec-simplifier` agents/.test(docsWs(docsRead("INSTALL.md"))) &&
      !/\(the `spec-implementer` agent only\)|SubagentStop for the `spec-implementer` agent\)/.test(docsWs(docsRef("verification.md") + docsRead("INSTALL.md"))),
      "1.22 review P6: verification.md and INSTALL.md name both SubagentStop agents (spec-implementer, spec-simplifier), as hooks.json matches");
    // P7: the doctor's check list names every built-in track's sections check and a pack's, and the 1.14–1.21 ids; the critic
    // checks the +api / +ui / +obs / +data design sections. Every id named is one the engine emits. (1.26: /approve and
    // /spec-doctor no longer carry the catalogue — the result names each check, /spec-doctor points to tooling-reference.md's list.)
    const engineSrc = libSources().map((f) => fs.readFileSync(f, "utf8")).join("\n");
    const drW = docsWs(docsRef("tooling-reference.md")), drCmd = docsWs(docsRead("commands", "spec-doctor.md"));
    const secIds = ["api-sections", "ui-sections", "obs-sections", "data-sections"];
    const drIds = ["task-deps", "change-scope", "merge-conflicts", "design-tradeoffs", "design-risks", "design-reuse", "waiver-expired", "track-pack-missing"];
    const criticTracks = (docsRead("agents", "spec-critic.md").match(/^\| \*\*Tracks\*\* \|.*$/m) || [""])[0];
    ok(secIds.every((id) => drW.includes("`" + id + "`") && engineSrc.includes('"' + id + '"')) && drW.includes("`<pack>-sections`") &&
      drIds.every((id) => drW.includes("`" + id + "`") && engineSrc.includes('"' + id + '"')) && /references\/tooling-reference\.md` → spec_doctor/.test(drCmd) &&
      ["+api: the `[API]`", "+ui: the `[UI]`", "+obs: the `[OBS]`", "+data: the `[DATA]`"].every((w) => criticTracks.includes(w)),
      "1.22 review P7: tooling-reference.md's doctor list (where /spec-doctor points) names api- / ui- / obs- / data- / <pack>-sections, task-deps, change-scope, merge-conflicts and the design-tradeoffs / risks / reuse, waiver-expired, track-pack-missing warnings (each an engine id); the critic's Tracks row covers +api / +ui / +obs / +data");
    // P8: the observe hook logs PowerShell runs (with an explicit exit code) — its row no longer says the opposite.
    const obsRow = (docsRef("tooling-reference.md").match(/^\| `hooks\/observe-hook\.js` \|.*$/m) || [""])[0];
    ok(/or PowerShell, with an explicit exit code/.test(obsRow) && !/PowerShell runs are not observed/.test(obsRow),
      "1.22 review P8: tooling-reference's observe-hook row says PowerShell runs are logged (explicit exit code) — no contradicting tail");
    // P9: a subagent (or an MCP prompt) can't resolve a bare `references/…`, run `dev-spec` or follow "agent X → section":
    // the agents name the plugin's skills/dev-spec-driven/references/ (the controller passes the folder), the final review
    // gets spec_log's output, /spec-review simplify and branch (/spec-simplify, /prReview until 1.26) carry the report headings and
    // the 0–100 scale inline; 1.26: a command names a reference by its full path (`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/…`).
    const agentDocs = ["spec-implementer.md", "spec-reviewer.md", "spec-simplifier.md", "spec-critic.md"].map((a) => [a, docsRead("agents", a)])
      .concat(fs.readdirSync(path.join(root, "commands")).filter((f) => f.endsWith(".md")).map((f) => ["commands/" + f, docsRead("commands", f)]));
    const bareRefs = agentDocs.filter(([, t]) => /(?<!skills\/dev-spec-driven\/)references\/[\w.-]+\.md/.test(t)).map(([a]) => a);
    const revW = docsWs(docsRead("agents", "spec-reviewer.md")), simpW = docsWs(docsRead("commands", "spec-review.md")), prrW = simpW;
    ok(!bareRefs.length && !/dev-spec log/.test(revW) && /the `spec_log` output the controller passed/.test(revW) &&
      /6\. the references folder path/.test(sub) && /the `spec_log \{name, gitLog\}` output/.test(cut(sub, "## Final review", "## The simplification pass")) &&
      /the report path \(`\.specs\/<feature>\/\.execution\/simplify-report\.md`\) and the references folder path/.test(sub) &&
      !/agents\/spec-simplifier\.md` → Report/.test(simpW) && ["`## Baseline`", "`## Changes`", "`## Dropped`", "`## Left alone`", "`## Final runs` LAST"].every((h) => simpW.includes(h)) &&
      /`` - `<the exact command>` → exit 0 \(212 passing\) ``/.test(simpW) &&
      !/agent → Calibration/.test(prrW) && /Rate each 0–100: \*\*0\*\* not real[^.]*\*\*25\*\* might be real, unverified · \*\*50\*\* verified but minor[^.]*\*\*75\*\*[^.]*\*\*100\*\* direct evidence/.test(prrW),
      "1.22 review P9: the agents cite the plugin's skills/dev-spec-driven/references/ (the controller passes the folder; bare: " + JSON.stringify(bareRefs) + "); the final review gets spec_log's output, never a bare dev-spec log; /spec-review inlines the simplify report headings and the Final-runs line, and the branch review's 0–100 scale");
    // P10: the reviewer's calibration lives in agents/spec-reviewer.md → Calibration, not in subagent-execution.md.
    ok(/\*\*Classify\*\* with the reviewer's calibration \(the plugin's `agents\/spec-reviewer\.md` → Calibration\)/.test(docsRef("code-reuse-and-quality.md")) &&
      /^### Calibration$/m.test(docsRead("agents", "spec-reviewer.md")),
      "1.22 review P10: code-reuse-and-quality.md points the calibration at agents/spec-reviewer.md → Calibration");
    // P11: an MCP-only client's stop gate is the spec_stop_check tool — INTEGRATIONS names it first, the tool catalog lists it
    // and spec_log; the short rule files say what `dev-spec <command>` stands for (`rules <tool>` makes it this clone's).
    const integrRow = (docsRead("INTEGRATIONS.md").match(/^\| End-of-turn evidence gate.*$/m) || [""])[0];
    const catalog = docsRef("tool-catalog.md");
    ok(/\| — \(call the `spec_stop_check \{message\}` MCP tool before claiming done — or the CLI `dev-spec stop-check/.test(integrRow) &&
      /`spec_stop_check \{message\}`/.test(catalog) && /`spec_log \{name, gitLog\}`/.test(catalog) && list.result.tools.some((t) => t.name === "spec_stop_check") && list.result.tools.some((t) => t.name === "spec_log") &&
      docsRules.slice(0, 4).every(([f]) => /Below, `dev-spec <command>` stands for `node cli\/dev-spec\.js <command>`/.test(docsWs(docsRead(f))) && /`spec_stop_check \{message\}`/.test(docsRead(f))),
      "1.22 review P11: INTEGRATIONS' stop-gate row names spec_stop_check first (CLI as the alternative); tool-catalog.md lists spec_stop_check and spec_log; the Cursor / Windsurf / Copilot / Gemini rule files spell out `dev-spec <command>` and the MCP stop-check");
    // P12: Spanish terminology follows es.js — "el gate de evidencia" (never "la puerta"), and a command's ES description says
    // "función", never "feature" (languages.md → Terminology). (1.24 review 6: the command descriptions carry no ES tail any
    // more — 10-guards-guard-downs checks they stay short English; kept as a guard should a Spanish one come back.) 1.26: the ES
    // README is README.es.md, whole — its release notes ("Novedades de la …") moved to CHANGELOG.md, the controller's.
    const esOutsideNews = docsSec("es");
    const esDescFeature = fs.readdirSync(path.join(root, "commands")).filter((f) => f.endsWith(".md")).filter((f) => {
      const d = (docsRead("commands", f).match(/^description: (.*)$/m) || [, ""])[1];
      return / ES - /.test(d) && /\bfeatures?\b/i.test(d.split(" ES - ").pop());
    });
    const esJs = docsRead("mcp", "lib", "i18n", "es.js");
    ok(/gate de evidencia/.test(esJs) && !/puerta de evidencia/.test(esJs) &&
      !/la puerta de evidencia|La puerta de evidencia/.test(esOutsideNews) && /el gate de evidencia/.test(esOutsideNews) && !esDescFeature.length,
      "1.22 review P12: README.es.md says 'el gate de evidencia' (as es.js), never 'la puerta'; no command's ES description says 'feature' (got " + JSON.stringify(esDescFeature) + ")");
  }

  { // 1.36 the review panel (meta.reviewModels) — the protocol is prose: merge first, then ONE verify per merged finding; the panel
    // ADDS models; the ledger names the models REQUESTED; what collapses it; the agents stay unaware of it
    const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n").replace(/\s+/g, " ");
    const ref = (f) => rd("skills", "dev-spec-driven", "references", f);
    const sub = ref("subagent-execution.md"), critic = ref("critic-review.md"), review = rd("commands", "spec-review.md");
    const agents = fs.readdirSync(path.join(root, "agents")).filter((f) => f.endsWith(".md")).filter((f) => /reviewPanel|reviewModels/.test(rd("agents", f)));
    const rows = [
      ["subagent-execution: the section", sub, /## Review on more than one model \(`meta\.reviewModels`, opt-in\)/],
      ["subagent-execution: the key", sub, /`reviewPanel: \{models\}`/],
      ["subagent-execution: merge, then verify each merged finding once", sub, /\*\*Then verify each MERGED finding once\*\* \(§6\)/],
      ["subagent-execution: agreement never skips the verifier", sub, /it never skips the verifier/],
      ["subagent-execution: the panel adds models", sub, /The panel ADDS models — it never replaces a review's own tier: the final review is the most capable model plus each panel model not already it/],
      ["subagent-execution: the ledger line, requested", sub, /Final review: ×2 \(requested opus, sonnet\) — 1 agreed, 3 single, 2 minor/],
      // (by fragments: the full names are Claude Code's, allowlisted by 17-docs-identifiers.js as names no code holds)
      ["subagent-execution: the collapse paths", sub, /_MODEL_FORCE` \(no `model` parameter\), a mod's `agent\.spawn` hook.*allowlist that substitutes it.*whose family the provider can't tell/],
      ["subagent-execution: no subagent tool", sub, /review inline and say the panel was not run/],
      ["subagent-execution: the task reviewer on another model", sub, /this ONE reviewer runs on the first panel model that differs from the implementer's/],
      ["subagent-execution: the 'reviewer is sure' row kept", sub, /"The reviewer is sure — skip the verifier"/],
      ["subagent-execution: no vote", sub, /"The models disagree — take the majority" \| There is no vote/],
      ["critic-review §1: the cold read stays one", critic, /The cold read stays one, on the session's model; xs stays as above/],
      ["spec-review branch: fresh reviewers per model", review, /one final-mode `dev-spec-driven:spec-reviewer` on the most capable model and one on each panel model not already it/],
      ["spec-review converge: every model's ✅", review, /an AC is ✅ only when every model says ✅, every ❌ still verified/],
      ["spec-doctor --deep", rd("commands", "spec-doctor.md"), /`reviewPanel` in this result.*critic-review\.md` §1/],
      ["spec-setup init", rd("commands", "spec-setup.md"), /`reviewModels` \(`--review-models opus,sonnet \| diverse \| off`\)/],
      ["spec-finish: the panel first", rd("commands", "spec-finish.md"), /`reviewPanel`\), the branch review on every model comes first/],
      ...["README.md", "README.pt.md", "README.es.md"].map((f) => [f + ": spec_init's settings", rd(f), /\| `spec_init` \|[^|]*`reviewModels`/]),
    ];
    all("1.36 review panel: the prose protocol — subagent-execution.md's section (merge, verify each merged finding once, the panel adds models, the requested-models ledger line, the collapse paths), critic-review §1, spec-review branch / converge, spec-doctor, spec-setup, spec-finish, the READMEs' spec_init row; no agent file knows the panel (got agents " + JSON.stringify(agents) + ")",
      Object.assign(Object.fromEntries(rows.map(([k, text, re]) => [k, () => re.test(text)])), { agentsUnaware: () => agents.length === 0 }));

    // 1.36.0 review 1 (RP-1): ONE rule for the gate critics in every file that states it — the panel ADDS critics (the size
    // table's on the session's model, plus one on each panel model not already it), and verify-once is the code reviews' rule:
    // the gate critics' merged findings go to the user (critic-review.md §3, no verifier). Before: §1 / spec-doctor put the
    // critics ON the panel's models and init's note verified every merged finding, gate findings included.
    const integ = rd("INTEGRATIONS.md"), on = (l) => S.msg(l).reviewModels.on("opus, sonnet", false);
    const rp1 = [
      ["critic-review §1: the panel ADDS critics", critic, /\*\*A review panel\*\* \([^)]*\) ADDS gate critics: the table's critics as they are, on the session's model, plus one gate critic on each panel model not already the session's — an explicit `model` on each, in the same message\. The cold read stays one/],
      ["critic-review §1: no 'on its models' re-assignment", critic, /^(?![\s\S]*puts the gate critics on its models)/],
      ["critic-review §3: merged findings to the user, no verifier", critic, /the merged findings go to the user, never to a verifier — gates have no verifier \(verifying each merged finding once is the code reviews' rule\)/],
      ["spec-doctor --deep: the panel ADDS critics, no verifier", rd("commands", "spec-doctor.md"), /`reviewPanel` in this result \(`meta\.reviewModels`\) ADDS gate critics: the critics above as they are, on the session's model, plus one on each panel model not already the session's \(`model` on each\); their merged findings go to the user, no verifier — `critic-review\.md` §1, §3/],
      ["subagent-execution: what it covers — the gate critics added", sub, /the gate critics are the size table's, on the session's model, plus one on each panel model not already the session's/],
      ["subagent-execution: verify-once scoped to the code reviews", sub, /\*\*Then verify each MERGED finding once\*\* \(§6\) in the code reviews — the final \/ branch review and converge; the gate critics' merged findings go to the user \(`references\/critic-review\.md` §3: gates have no verifier\)/],
      ["subagent-execution: the Model selection row", sub, /\| Review panel \(`reviewPanel`\) \| adds its models to the final review, converge and the gate critics — one reviewer each, beside the row's own model \(the gate critics': the session's\), never in place of it \|/],
      ["INTEGRATIONS: the row", integ, /the gate critics once per model — the panel adds models, never replaces the review's own; the gate critics' findings go to the user, no verifier\)/],
      ["init's note (en)", on("en"), /the branch review before merge, converge and the deep review's gate critics also run on each panel model — the panel adds models, never replaces the review's own \(the gate critics': the session's model\) —; the branch review's and converge's findings are merged and each verified once, the gate critics' merged findings go to the user \(gates have no verifier\)/],
      ["init's note (pt)", on("pt"), /a revisão do ramo antes do merge, o converge e os críticos do gate da revisão profunda correm também em cada modelo do painel — o painel acrescenta modelos, nunca substitui o da própria revisão \(o dos críticos do gate: o modelo da sessão\) —; os achados da revisão do ramo e do converge são reunidos e cada um é verificado uma vez, os achados reunidos dos críticos do gate vão para o utilizador \(os gates não têm verificador\)/],
      ["init's note (es)", on("es"), /la revisión de la rama antes del merge, el converge y los críticos del gate de la revisión profunda se ejecutan también en cada modelo del panel — el panel añade modelos, nunca sustituye el de la propia revisión \(el de los críticos del gate: el modelo de la sesión\) —; los hallazgos de la revisión de la rama y del converge se combinan y cada uno se verifica una vez, los hallazgos combinados de los críticos del gate van al usuario \(los gates no tienen verificador\)/],
    ];
    all("1.36.0 review 1 (RP-1): one rule for the gate critics with a review panel — critic-review.md §1 / §3, spec-doctor.md, subagent-execution.md (what it covers, the verify-once scope, the Model selection row), INTEGRATIONS.md and init's note (EN, PT, ES): the panel ADDS critics beside the session's model; the gate critics' merged findings go to the user, no verifier (failing: " +
      JSON.stringify(rp1.filter(([, text, re]) => !re.test(text)).map(([k]) => k)) + ")", Object.fromEntries(rp1.map(([k, text, re]) => [k, () => re.test(text)])));

    // 1.36.0 review 1 (RP-2): the task reviewer never drops below its row's tier (never haiku; none → sonnet), and the cost
    // text says where the task reviews go (diverse + a sonnet implementer → opus). (RP-3): every path that runs the panel
    // review — the collapsed host, the inline host — ledgers a `Final review: ×N` line, the finish sentence's exit, and
    // spec-finish.md names that exit too.
    const rp23 = [
      ["RP-2 subagent-execution §5: at least standard, none → sonnet", sub, /this ONE reviewer runs on the first panel model that differs from the implementer's and is at least standard \(never `haiku`, below the task reviewer's floor — Model selection\) — a second model's eyes at no extra dispatch\. None, or none the host can dispatch \(Claude Code: an alias\), → `sonnet`, as without a panel/],
      ["RP-2 subagent-execution: what it covers — at least standard", sub, /its ONE reviewer runs on the first panel model other than the implementer's, at least standard — §5\)/],
      ["RP-2 subagent-execution: the Task reviewer row", sub, /\| Task reviewer \|[^|\n]*with a review panel, the first panel model other than the implementer's that is at least standard \(never `haiku`; none → `sonnet`\) \|/],
      ["RP-2 subagent-execution: the Cost bullet", sub, /and the task reviews move to a panel model \(§5\): with `diverse` and a `sonnet` implementer, every task review runs on `opus` \(no extra dispatch, the priciest tier\)/],
      ["RP-2 init's note (en)", on("en"), /The task reviewer runs on a panel model other than the implementer's, never below sonnet's tier — with diverse and a sonnet implementer, every task review runs on opus\./],
      ["RP-2 init's note (pt)", on("pt"), /nunca abaixo do nível do sonnet — com diverse e um implementador sonnet, cada revisão de tarefa corre em opus\./],
      ["RP-2 init's note (es)", on("es"), /nunca por debajo del nivel de sonnet — con diverse y un implementador sonnet, cada revisión de tarea se ejecuta en opus\./],
      ["RP-3 subagent-execution: no 'review ×2 requested' form", sub, /^(?![\s\S]*"review ×2 requested)/],
    ];
    all("1.36.0 review 1 (RP-2, RP-3): the task reviewer at least standard (never haiku; none → sonnet) and the cost text saying where the task reviews go (subagent-execution §5, the row, the Cost bullet, init's note EN / PT / ES); no collapsed 'review ×2 requested' form (failing: " +
      JSON.stringify(rp23.filter(([, text, re]) => !re.test(text)).map(([k]) => k)) + ")", Object.fromEntries(rp23.map(([k, text, re]) => [k, () => re.test(text)])));

    // 1.36.0 review 3 (D3-1): round 2's `@ <HEAD>` on the Final review line (RP2-1) made the whole panel run again after every
    // commit — the branch review's own fixes, each simplify commit, a `.specs/`-only commit — with no bound. It went back out:
    // round 1's exit ("unless the ledger already has its Final review line since the last task") and its ledger lines, no `@`,
    // in every place; RP2-1's gap — a task done inline writes no ledger line — closed in prose: "if you did one after the
    // review, run it again". (D3-2): the branch review reads merge-base..HEAD — spec-review.md (branch) and spec-finish.md say
    // to commit the feature's work before it. spec-review.md keeps round 2's ledger path.
    const notes = (f) => rd("docs", "maintainers", f), finishCmd = rd("commands", "spec-finish.md");
    const INLINE = "a task done inline writes no ledger line — if you did one after the review, run it again";
    const noHead = /^(?![\s\S]*(?:Final review: ×[\dN][^`]*@ |names the current HEAD|rev-parse --short HEAD))/;
    const d31 = [
      ["subagent-execution: the ledger block's example", sub, /complete \(commits a1b2c3d\.\.e4f5a6b, review clean\) Final review: ×2 \(requested opus, sonnet\) — 1 agreed/],
      ["subagent-execution § Final review: the line, ONE fix and ONE re-review", sub, /still ONE fix dispatch and ONE scoped re-review\. Ledger the `Final review: ×N` line\. ## The simplification pass/],
      ["subagent-execution: the Ledger bullet", sub, /\*\*Ledger\*\* `Final review: ×2 \(requested opus, sonnet\) — 1 agreed, 3 single, 2 minor` \(agreed = raised by two or more models\)\. Name the models you REQUESTED/],
      ["subagent-execution: Resume — since the last task, an inline task → again", sub, new RegExp("\\*\\*Resume:\\*\\* the ledger already has a `Final review: ×N` line since the last task \\(any of its forms, below too\\) → the panel review ran; don't dispatch it again\\. A " + INLINE.slice(2) + "\\.")],
      ["subagent-execution: the collapsed form", sub, /\(`Final review: ×2 \(requested opus, sonnet\) — the host ran one model`\): fresh contexts, no model diversity/],
      ["subagent-execution: the inline form", sub, /review inline and say the panel was not run — ledger `Final review: ×1 \(requested opus, sonnet\) — inline, the panel was not run`, so a resumed session doesn't run it again\./],
      ["subagent-execution: no `@ <HEAD>` form", sub, noHead],
      ["spec-review: the panel line", review, /each merged finding once \(`subagent-execution\.md` → Review on more than one model\)\. Ledger `Final review: ×N \(requested …\)`\. Without/],
      ["spec-review: the inline form", review, /Without a subagent tool: review yourself as above, say the panel was not run, and ledger `Final review: ×1 \(requested …\) — inline, the panel was not run`\./],
      ["spec-review: the ledger's path", review, /The ledger: `\.specs\/<feature>\/\.execution\/ledger\.md` \(no `\.execution\/` yet: create it with a `\.gitignore` holding `\*`\)\./],
      ["spec-review: an inline task after the review → again", review, new RegExp("holding `\\*`\\)\\. A " + INLINE.slice(2) + "\\.")],
      ["spec-review: no `@ <HEAD>` form", review, noHead],
      ["spec-finish: the exit and the inline task", finishCmd, new RegExp("the branch review on every model comes first — unless the ledger already has its `Final review: ×N` line since the last task \\(" + INLINE + "\\)\\.")],
      ["spec-finish: no HEAD exit", finishCmd, noHead],
      ["the sentence's exit (en)", S.msg("en").next.reviewBranch("x", "opus, sonnet"), new RegExp("— unless the ledger already has its \"Final review: ×N\" line since the last task \\(" + INLINE + "\\); then the optional simplify pass")],
      ["the sentence's exit (pt)", S.msg("pt").next.reviewBranch("x", "opus, sonnet"), /— a não ser que o ledger já tenha a sua linha "Final review: ×N" desde a última tarefa \(uma tarefa feita sem subagentes não escreve linha no ledger — se fizeste uma depois da revisão, corre a revisão de novo\); depois a passagem de simplificação opcional/],
      ["the sentence's exit (es)", S.msg("es").next.reviewBranch("x", "opus, sonnet"), /— salvo que el ledger ya tenga su línea "Final review: ×N" desde la última tarea \(una tarea hecha sin subagentes no escribe línea en el ledger — si hiciste una después de la revisión, vuelve a ejecutar la revisión\); después la pasada de simplificación opcional/],
      ...["en", "pt", "es"].map((l) => ["the sentence: no HEAD exit (" + l + ")", S.msg(l).next.reviewBranch("x", "opus, sonnet"), /^(?![\s\S]*HEAD)/]),
      ["gates-and-approvals: next_action's rule", notes("gates-and-approvals.md"), /the controller's ledger line says whether the review ran — a `Final review: ×N` line since the last task \(the engine reads no ledger\); a task done inline writes no ledger line, so the hint says to run the review again after one\./],
      ["tasks-and-evidence: the panel's rule", notes("tasks-and-evidence.md"), /every path ledgers a `Final review: ×N` line — the finish sentence's exit; a task done inline writes no ledger line: after one, run the review again — and the branch review reads `merge-base\.\.HEAD`: the feature's work committed first\)/],
      ["tasks-and-evidence: the History entry", notes("tasks-and-evidence.md"), /\*\*1\.36\.0 review 3\*\* \(D3-1, D3-2\) — round 2's `@ <HEAD>` went back out/],
      // D3-2: the branch review reads merge-base..HEAD — commit the feature's work before it
      ["spec-review branch: commit first", review, /\*\*branch\*\* — a local pre-merge review of `git diff <merge-base>\.\.HEAD` \(`git merge-base <base-branch> HEAD`; it reads commits only — commit the feature's work before it\)/],
      ["spec-finish: commit first", finishCmd, /\. The branch review reads `merge-base\.\.HEAD`: commit the feature's work before it\. 1\. `spec_finish/],
    ];
    all("1.36.0 review 3 (D3-1, D3-2): round 1's panel exit and ledger lines, no `@ <HEAD>` — next.reviewBranch (EN / PT / ES), spec-finish.md, spec-review.md, subagent-execution.md (the ledger block, Final review, the Ledger bullet, Resume, the collapsed / inline forms), the maintainer notes — each place saying a task done inline writes no ledger line, so one done after the review means running it again; spec-review.md (branch) and spec-finish.md say to commit the feature's work first (failing: " +
      JSON.stringify(d31.filter(([, text, re]) => !re.test(text)).map(([k]) => k)) + ")", Object.fromEntries(d31.map(([k, text, re]) => [k, () => re.test(text)])));

    // 1.36.0 review 4 (D4-1): the merge summary written before an accept (or a lift) still names the test as changed and shows no
    // accept — /spec-finish step 1 says to run it again after one, as do the accept's note (EN / PT / ES) and verification.md
    const d41 = [
      ["spec-finish step 1: run it again after the accept", finishCmd, /After the accept \(or a lift\), run step 1 again \(`spec_finish \{name, write: true\}`\): the merge summary then lists the accept and no longer names the test as changed — the one written before it still does\. 2\. \*\*Verify fresh/],
      ["verification.md: the accept bullet", ref("verification.md"), /the merge summary of every written finish of that work cycle shows it — after the accept \(or a lift\), finish again with write \(`dev-spec finish <feature> --write`\): the summary written before it still names the test as changed\./],
      ["the accept's note (en)", S.msg("en").protectedTests.accepted("t.test.js", "alpha"), /Finish it again \([\s\S]*?finish alpha --write\): the merge summary then lists the accept and no longer names the test as changed\.$/],
      ["the accept's note (pt)", S.msg("pt").protectedTests.accepted("t.test.js", "alpha"), /Volta a fechá-la \([\s\S]*?finish alpha --write\): o resumo do merge passa a listar a aceitação e deixa de nomear o teste como alterado\.$/],
      ["the accept's note (es)", S.msg("es").protectedTests.accepted("t.test.js", "alpha"), /Ciérrala de nuevo \([\s\S]*?finish alpha --write\): el resumen del merge lista entonces la aceptación y deja de nombrar la prueba como cambiada\.$/],
    ];
    all("1.36.0 review 4 (D4-1): after an accept (or a lift) the finish is written again — /spec-finish step 1, the accept's note (EN / PT / ES), verification.md's accept bullet (failing: " +
      JSON.stringify(d41.filter(([, text, re]) => !re.test(text)).map(([k]) => k)) + ")", Object.fromEntries(d41.map(([k, text, re]) => [k, () => re.test(text)])));

    // 1.36.0 review 2 (RP2-2, RP2-3 — round 1's INT-8): tooling-reference's rows as round 1's fixes left the code — a task's
    // FIRST tick re-baselines its _Implements:_ tests (a re-tick keeps the hash), spec_next_task's +port hold keys, the fast
    // check in roadmap.json's meta list (every meta key the engine writes, but evidenceSince — the observed switch's internal
    // stamp) and in /spec-setup init's flags.
    const tref = ref("tooling-reference.md"), trow = (tool) => (tref.match(new RegExp("\\| `" + tool + "` \\|(?:(?! \\| `spec_)[\\s\\S])*")) || [""])[0];
    const engineSrc = fs.readdirSync(path.join(root, "mcp", "lib", "engine")).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(root, "mcp", "lib", "engine", f), "utf8")).join("\n");
    const metaWritten = [...new Set([...engineSrc.matchAll(/\bmeta\.([a-zA-Z]+) ?=(?!=)/g)].map((m) => m[1]))].filter((k) => k !== "evidenceSince");
    const metaListed = ((tref.match(/roadmap\.json +# order \+ dependencies \+ backlog \+ meta \(([^)]*)\)/) || [])[1] || "").split(/, */);
    const rp22 = [
      ["spec_complete_task: the FIRST tick re-baselines", trow("spec_complete_task"), /records the task's exact `_Implements:_` test files \(re-baselined at the task's FIRST tick only — a re-tick keeps the recorded hash, so finish names an edit made while it was open\)/],
      ["spec_complete_task: no bare '(re-baselined)'", trow("spec_complete_task"), /^(?![\s\S]*test files \(re-baselined\))/],
      ["spec_next_task: the +port hold keys", trow("spec_next_task"), /\+port \(1\.36\): a task the `\[PORT\]` fence holds is never next — passed over, `gated: "port-order"` \+ `heldBy` \[n\]; none left to start while that anchor is ticked but not verified → `next: null` \+ a note naming its run/],
      ["roadmap.json meta: every key the engine writes", metaWritten.join(","), { test: () => metaWritten.length >= 12 && metaWritten.includes("fastCheck") && metaWritten.every((k) => metaListed.includes(k)) }],
      ["/spec-setup init: --fast-check", tref, /\| `\/spec-setup init \\\| guard [^\n]*`spec_init`: `--lang`, `--check`, `--roles`, `--stop-check`, `--fast-check`, `--review-models`\)/],
    ];
    all("1.36.0 review 2 (RP2-2, RP2-3): tooling-reference — spec_complete_task re-baselines at a task's FIRST tick only, spec_next_task names +port's gated / heldBy, roadmap.json's meta list names every key the engine writes (fastCheck), /spec-setup init names --fast-check (failing: " +
      JSON.stringify(rp22.filter(([, text, re]) => !re.test(text)).map(([k]) => k)) + "; meta written " + JSON.stringify(metaWritten) + ", listed " + JSON.stringify(metaListed) + ")",
      Object.fromEntries(rp22.map(([k, text, re]) => [k, () => re.test(text)])));
  }

  { // 1.36 the fast check (meta.fastCheck, warn only) — the loop is prose the agent follows: run it ALONE after each small edit, clean
    // before the _Verify:_, the report line with the command in a code span; never described as a refusal
    const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n").replace(/\s+/g, " ");
    const ref = (f) => rd("skills", "dev-spec-driven", "references", f);
    const ver = ref("verification.md"), sub = ref("subagent-execution.md"), impl = rd("agents", "spec-implementer.md");
    const rows = [
      ["SKILL.md: the one line", rd("skills", "dev-spec-driven", "SKILL.md"), /`meta\.fastCheck`: run it alone after each small edit; clean before `_Verify:_`\./],
      ["verification: the section", ver, /### The fast check \(`meta\.fastCheck`, warn only\)/],
      ["verification: one call", ver, /spec_init \{checks: \{"typecheck": "npx tsc --noEmit"\}, fastCheck: "typecheck"\}/],
      ["verification: the statuses", ver, /`clean` · `stale` .*· `failed` .*· `missing` .*· `unknown`/],
      ["verification: never refused", ver, /the tick is never refused/],
      ["verification: base branch", ver, /\*\*Pick one that passes on the base branch:\*\*/],
      ["subagent-execution: the report form", sub, /``Fast check `<command>`: N runs → exit 0``/],
      ["subagent-execution: after a parallel merge", sub, /With a fast check \(`meta\.fastCheck`\), run it once on its own after the merges, before the ticks/],
      ["spec-implementer: the loop", impl, /after each small edit run it \*\*on its own\*\* \(never chained/],
      ["spec-implementer: the report line", impl, /``Fast check `npx tsc --noEmit`: 4 runs → exit 0``/],
      ["spec-setup init", rd("commands", "spec-setup.md"), /`fastCheck` \(`--fast-check <check>\|off`\)/],
      ["tooling-reference: spec_init", ref("tooling-reference.md"), /`fastCheck` \(1\.36 — the name of the project check run on its own after each small edit/],
      ["tooling-reference: doctor", ref("tooling-reference.md"), /`fast-check` \(1\.36 — `meta\.fastCheck` names no project check/],
      ...["README.md", "README.pt.md", "README.es.md"].map((f) => [f + ": spec_init's settings", rd(f), /\| `spec_init` \|[^|]*`fastCheck`/]),
    ];
    const refusal = [["verification", ver], ["subagent-execution", sub], ["spec-implementer", impl]].filter(([, t]) => /fast check[^.]{0,80}\b(?:refuses|blocks the tick)/i.test(t));
    all("1.36 fast check: the prose — SKILL.md's line, verification.md's section (one call, the statuses, never a refusal, the base branch), subagent-execution's report form and parallel merge, spec-implementer's loop and report line, spec-setup, tooling-reference, the READMEs' spec_init row; nothing calls it a refusal (got " + JSON.stringify(refusal.map(([k]) => k)) + ")",
      Object.assign(Object.fromEntries(rows.map(([k, text, re]) => [k, () => re.test(text)])), { noRefusal: () => refusal.length === 0 }));
  }

  { // 1.37 the visual review without a reference (the floor), the worst-case capture and the verdict pass after a fix (item 3),
    // the component contract, motion, forms / interaction details, the accessibility finding line and the user's taste (item
    // 4) — prose the agent follows. ONE assertion per prose rule: each fails with its rule undone (the 1.37 mutation pass)
    // and failed against 1.36. A row is [label, text, ...checks]: a RegExp must match the whitespace-folded text, {not: re}
    // must not, a function must return true. The budgets ride with a rule of their file (a budget alone held on 1.36).
    // Chain D's mutation pass: 117 mutants (each rule undone, each budget overrun) on a copy, 117 killed; 97 of 97 failed on 1.36.
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const refRaw = (f) => raw("skills", "dev-spec-driven", "references", f);
    const bytes = (...p) => fs.statSync(path.join(root, ...p)).size;
    const R = ws(refRaw("ui-review.md")), A = ws(raw("agents", "spec-ui-reviewer.md")), P = ws(refRaw("ui-design-patterns.md"));
    const X = ws(refRaw("subagent-execution.md")), E = ws(raw("commands", "executeTask.md")), C = ws(raw("agents", "spec-critic.md"));
    const T = ws(refRaw("track-checklists.md")), I = ws(refRaw("index.md")), F = ws(refRaw("review-feedback.md"));
    // a section of a raw file: from its heading line to the next heading of the same or a higher level
    const sectionOf = (text, head) => {
      const lines = text.split("\n"), at = lines.findIndex((l) => l.startsWith(head)), level = (head.match(/^#+/) || [""])[0].length;
      if (at < 0) return "";
      const end = lines.findIndex((l, i) => i > at && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level);
      return ws(lines.slice(at, end < 0 ? lines.length : end).join("\n"));
    };
    const agentFront = raw("agents", "spec-ui-reviewer.md").split(/^---$/m)[1] || "";
    const desc = ((agentFront.match(/^description: (.*)$/m) || [])[1] || "");
    const motion = sectionOf(refRaw("ui-design-patterns.md"), "## Motion"), taste = sectionOf(refRaw("review-feedback.md"), "## A UI taste");
    const contract = sectionOf(refRaw("ui-design-patterns.md"), "### Component contract"), worst = sectionOf(refRaw("ui-design-patterns.md"), "### The worst case");
    const floorMode = sectionOf(raw("agents", "spec-ui-reviewer.md"), "## Floor mode"), verdictMode = sectionOf(raw("agents", "spec-ui-reviewer.md"), "## Verdict mode");
    const checklist = sectionOf(refRaw("ui-design-patterns.md"), "## Design checklist");
    const rows = [
      // references/ui-review.md — the protocol
      ["ui-review: no reference → the floor alone, ledgered, never passed; the file ≤ 10,000 bytes", R,
        /\*\*No reference → the floor alone\*\* \(§2\): ledger `Task N: ui review — floor only \(no reference\)` and say at the checkpoint that the look was never compared with a design\. It is never "passed"\./,
        () => bytes("skills", "dev-spec-driven", "references", "ui-review.md") <= 10000],
      ["ui-review: the worst case's own capture, through the data boundary, never edited markup", R,
        /\*\*The worst case\*\*[^.]*is a state of its own: `<view>--worst--build\.png`/, /never by editing the markup/],
      ["ui-review: the floor through a tool that sets the viewport and records the width — never the Chrome command line", R,
        /taken by a tool that sets the viewport and records the width it got \(Playwright's `viewport`, Puppeteer's `setViewport`\) — never the Chrome command line/],
      ["ui-review: a measured width other than the one asked → INVALID", R, /A measured width other than the one asked makes the capture INVALID\./],
      ["ui-review: the three measured captures", R, /\| `floor-320` \| 320 CSS px wide, device scale 2 \| 1\.4\.10 Reflow \|/,
        /\| `floor-zoom` \| 640 × 360 CSS px, scale 2 — a 1280 × 720 window at 200 % \| 1\.4\.4 Resize Text \|/, /\| `floor-focus` \| the review viewport, Tab pressed until focus is inside the task's region/],
      ["ui-review: floor-focus by keys only, 50 presses at most", R, /\(50 at most\) — keys only, never a click or a script's `focus\(\)`/],
      ["ui-review: floor-spacing only where the script can add a style", R, /`floor-spacing` \([^)]*1\.4\.12\) only where the script can add a style/],
      ["ui-review: the kept capture script, the same settings every round", R, /keep the capture script at `\.execution\/ui\/capture\.<ext>` — every round and the verdict pass take the same settings with it/],
      ["ui-review: a retaken capture's old file kept as .prev.png", R, /before it retakes a capture it renames the old one `<name>\.prev\.png`/],
      ["ui-review: wait for the fonts and the images", R, /It waits for the fonts \(`document\.fonts\.ready`\) and the images before each shot/],
      ["ui-review: one viewport per image", R, /one viewport per image/],
      ["ui-review: at most 16 images a dispatch, the .prev.png counted", R, /At most 16 images a dispatch, the `\.prev\.png` counted/],
      ["ui-review: the reviewer told when the locale is a pseudo-locale", R, /say when the locale is a pseudo-locale/],
      ["ui-review: mobile in one line — the text size closest to 200 %, Android pseudo-locales only where enabled", R,
        /On mobile: the smallest supported width and the OS text size closest to 200 % \(iOS AX2, Android scale 2\.0\); Android's pseudo-locales only where the build enables them\./],
      ["ui-review: a capture the tool can't take — Not judged, never clean", R, /A capture the tool can't take is listed under Not judged and ledgered — never clean\./],
      ["ui-review: pair or floor is a property of the files", R, /\*\*Pair or floor is a property of the files:\*\* a `--build\.png` with its `--ref\.png` beside it is a pair; every other build capture, and every `floor-\*` one, is judged on the floor\./],
      ["ui-review: floor findings Major by default, only a measured reflow a Blocker", R, /Each is a \*\*Major\*\* by default — confirmed first, as above; only a measured reflow is a Blocker\./],
      ["ui-review: reflow only from the .json", R, /\*\*reflow\*\* \(from the `\.json` only[^)]*none → not judged\)/],
      // 1.37.0 review 1 (D4): the exception in W3C's terms — content that needs a two-dimensional layout, and no other; "a box
      // that scrolls inside the page" excepted any box
      ["ui-review: WCAG 1.4.10's exception — content that needs a two-dimensional layout scrolling in its own box, no other", R,
        /Not findings: content that needs a two-dimensional layout for its meaning or use \(a data table, a map, a diagram, a toolbar…\) scrolling inside its own box — the only content WCAG 1\.4\.10 excepts;/,
        { not: /a box that scrolls inside the page is not the page scrolling/ }],
      ["ui-review: below a stated minimum width — one checkpoint line per feature, never a fix round or a stop", R,
        /\*\*Below a minimum width the design or `ui\.md` states\*\*: one checkpoint line per feature[^.]*, never a fix round, never a stop\./],
      ["ui-review: truncation only when the design's row says the field wraps", R, /truncation, unless the design's row says the field wraps/],
      ["ui-review: a floor finding carried into a report is an accessibility finding line", R, /A floor finding carried into the ledger or a report is written as an accessibility finding \(`ui-design-patterns\.md` → Testing accessibility\)\./],
      ["ui-review: after a fix, a fresh reviewer in verdict mode — RESOLVED / PARTIAL / OPEN, never a new hunt", R,
        /dispatch a fresh reviewer \*\*in verdict mode\*\* \(`Mode: verdict` on the prompt's first line\)/, /each is RESOLVED, PARTIAL or OPEN/, /a fix round never opens a new hunt/],
      ["ui-review: verdict rule — one reviewer, at size l too", R, /1\. One reviewer, at size l too\./],
      ["ui-review: verdict rule — a PARTIAL graded again, still open", R, /2\. A PARTIAL is graded again for what remains, and stays open\./],
      ["ui-review: verdict rule — a confirmed finding not reconfirmed", R, /3\. A confirmed finding is not reconfirmed\./],
      ["ui-review: verdict rule — a regression Major through the confirmation step", R, /4\. A regression Major goes through the confirmation step \(§4\)/],
      // 1.37.0 review 1 (D7): a Blocker / Major missed earlier was neither open nor parked — no round, no tick; it goes as a
      // regression does (into the loop, a Major confirmed first), only a minor is deferred
      ["ui-review: verdict rule — a finding missed earlier keeps its severity and goes as a regression does; a minor deferred", R,
        /5\. A finding missed earlier keeps its severity and goes as a regression does \(rule 4\); a minor: `Task N: ui deferred \(missed earlier, minor\): …`, shown at the checkpoint\./,
        { not: /never a round of its own/ }],
      ["ui-review: verdict rule — after a code-review round, regressions only; changed regions only", R,
        /6\. After a code-review round: an empty open list — regressions only\./, /a regression counts only in a region that changed since the last capture/],
      ["ui-review: verdict rule — the Breaker uses verdict mode", R, /7\. The Breaker \(`references\/subagent-execution\.md` → 7\) uses verdict mode\./],
      ["ui-review: a full review instead — a new view, a reference changed with the user, the user's screenshot", R,
        /A \*\*full\*\* review instead when the diff renders a view or state no review saw, the reference changed with the user, or the user's screenshot contradicts a verdict\./],
      ["ui-review: the verdict pass credited to Impeccable", R, /The verdict pass follows Impeccable's finish reviewer \(Apache-2\.0\)/],
      ["ui-review: the ledger lines — floor only, re-review, missed earlier", R, /Task 5: ui re-review \(round 1\) — U1 resolved, U2 partial; 0 regressions → fix round 2\/5/,
        /Task 6: ui review — floor only \(no reference\): 1 view, 3 captures/, /Task 6: ui deferred \(missed earlier, minor\)/],
      ["ui-review: a correction another view would repeat is a taste → ui.md's ## Taste", R, /that another view would repeat is a taste: propose it for `\.specs\/steering\/ui\.md` → `## Taste`/],
      // agents/spec-ui-reviewer.md — the reviewer's modes
      ["spec-ui-reviewer: the description names the floor and the verdict pass (≤ 250, never edits code)", desc,
        /on the accessibility floor where it has none, or a verdict pass on its earlier findings/, /Never edits code\.$/, () => desc.length <= 250],
      ["spec-ui-reviewer: ## Modes — pair, floor, verdict; the files decide", A, /## Modes The files decide, capture by capture: a `--build\.png` with its `--ref\.png` beside it is a \*\*pair\*\*/, /`Mode: verdict`/],
      ["spec-ui-reviewer: floor — no \"should look like\", never a taste difference", floorMode, /Without a reference there is no "should look like": never a difference of spacing, colour, type or layout choice\./],
      ["spec-ui-reviewer: floor — four findings", floorMode, /Four findings only/, /- \*\*reflow\*\* —/, /- \*\*lost\*\* —/, /- \*\*focus\*\* —/, /- \*\*defect\*\* —/],
      ["spec-ui-reviewer: floor — Major, a measured reflow a Blocker", floorMode, /Each is \*\*Major\*\*; a reflow the `\.json` measures is a \*\*Blocker\*\*/],
      ["spec-ui-reviewer: floor — reflow only from the .json, two-dimensional content scrolling in its box is none", floorMode,
        /only from the `\.json`[^;]*; no `\.json` → Not judged\./, /scrolling inside its own box is no reflow/],
      ["spec-ui-reviewer: floor — truncation only where the row says the field wraps", floorMode, /a truncation only where the design's state row says the field wraps/],
      ["spec-ui-reviewer: floor — defect's examples illustrate a property, no list", floorMode, /illustrate the property; they are no list/],
      ["spec-ui-reviewer: floor — never contrast from a picture", floorMode, /Never contrast from a picture/],
      ["spec-ui-reviewer: floor — a pseudo-locale's text is no defect", floorMode, /A pseudo-locale's accented, padded text is no defect\./],
      ["spec-ui-reviewer: floor — a .json of another width → INVALID", floorMode, /A `\.json` whose width is not the capture's → that capture is INVALID\./],
      ["spec-ui-reviewer: verdict — resolved / partial / open, changed regions only, never a new hunt", verdictMode,
        /\*\*RESOLVED\*\*, \*\*PARTIAL\*\* \(what remains, graded again\) or \*\*OPEN\*\*/, /A regression counts only in a region that differs between `\.prev\.png` and the new capture — never a new hunt elsewhere\./],
      ["spec-ui-reviewer: verdict — missed earlier, with its severity", verdictMode, /goes under Missed earlier, with its severity\./],
      ["spec-ui-reviewer: the floor and verdict outputs, Open: N counted; the file ≤ 7,000 bytes", A, /### UI review \(floor\): Clean \| Findings \| Invalid/,
        /### UI re-review: Resolved \| Open: N \| Invalid/, /Open: N counts PARTIAL \+ OPEN \+ each Blocker \/ Major under Regressions or Missed earlier\./, // (D7)
        () => bytes("agents", "spec-ui-reviewer.md") <= 7000],
      // references/ui-design-patterns.md — the worst case (item 3) and the prose of item 4
      ["ui-design-patterns: the worst case — a matrix row, its kinds", worst, /One more row of the matrix: the view's data at its realistic extremes/,
        /an unbroken email, URL or ID/, /a one-letter name, counts of 0, 1 and thousands, a missing image/, /the longest translation or a right-to-left locale/],
      ["ui-design-patterns: the worst case — real data or the validation's limit, cited; no limit is a decision", worst, /Each extreme is real data or the validation's limit, its source cited/, /"no limit found" is a design decision/],
      ["ui-design-patterns: the worst case — spread across the first rows", worst, /Spread them across the first rows/],
      ["ui-design-patterns: the worst case — through the other states' boundary, never edited markup", worst, /through the boundary the other states use \(a story, a mock, a fixture route\), never by editing markup/],
      ["ui-design-patterns: the worst case — per field wrap / truncate / clamp, never a compared figure", worst, /it wraps, truncates at the end \(or the middle, for a path or an ID\), or clamps/, /never truncate a figure the user compares/],
      ["ui-design-patterns: the worst case credited to Emil Kowalski", worst, /After Emil Kowalski's break-ui skill \(MIT\)\./],
      ["ui-design-patterns: every state a fixture — the worst case too", P, /— the worst case too, the regression fixture of the next change/],
      ["ui-design-patterns: the contract — the optional section, a heading starting with the name, lists", contract,
        /design\.md's optional `## \[UI\] Component Contracts`/, /a `### <Component>` heading starting with its name, written as lists/],
      ["ui-design-patterns: the contract — its five parts", contract, /\*\*States\*\*/, /\*\*Keyboard\*\* \(the WAI-ARIA APG pattern's keys/, /\*\*Role and name\*\*/, /\*\*Variants\*\*/, /\*\*Slots\*\*/],
      ["ui-design-patterns: the contract — one enumerated prop per axis, never a boolean per mode", contract, /one enumerated prop per visual axis[^·]*never a boolean per mode/],
      ["ui-design-patterns: the contract — a mode that changes what renders is composition", contract, /a mode that changes what it renders is composition/],
      ["ui-design-patterns: the contract — slots in each framework's terms", contract, /Vue `<slot name>`, Svelte slots \/ snippets, Angular `ng-content select`, a web component's `<slot>`/, /a server partial: `n\/a — a server include takes no children`/],
      ["ui-design-patterns: the contract credited to designer-skills", contract, /After designer-skills' component spec \(MIT\)\./],
      ["ui-design-patterns: forms — unsaved edits never dropped silently", P, /Unsaved edits are never dropped silently: leaving asks first \(`beforeunload` for the tab, a confirm in the app\) or keeps a draft and says so\./],
      ["ui-design-patterns: forms — submit enabled until the request starts", P, /submit stays enabled until the request starts/],
      ["ui-design-patterns: interaction — the URL holds the view's state", P, /\*\*The URL holds the view's state\*\* — filter, sort, tab, page, an open panel/],
      ["ui-design-patterns: interaction — tabular numerals", P, /`font-variant-numeric: tabular-nums`/],
      ["ui-design-patterns: interaction — translate=\"no\"", P, /\*\*`translate="no"`\*\* on codes, identifiers, commands and names/],
      ["ui-design-patterns: motion — what each animation tells the user", motion, /\*\*Each animation says what it tells the user\*\*/],
      ["ui-design-patterns: motion — durations and easings are tokens, the values the team's", motion, /\*\*Durations and easings are tokens\*\* in the registry; their values are the team's\./],
      ["ui-design-patterns: motion — prefer transform / opacity, a measured height the exception", motion, /\*\*Prefer `transform` and `opacity`\*\*/, /The exception: a height that must be measured/],
      ["ui-design-patterns: motion — reduced motion keeps information-bearing motion", motion, /movement becomes an instant change or a fade; motion that carries information \(a progress bar\) stays/],
      ["ui-design-patterns: motion — no taste heuristic, no fixed duration", motion, /## Motion/,
        { not: /the more often|less it moves|changes at once|don't animate|\b\d+ ?ms\b|\b0?\.\d+ ?s\b|ease-in|ease-out/i }],
      ["ui-design-patterns: the accessibility finding line — criterion, element, impact, fix, found by; no [A11Y] tag", P,
        /Each finding, one line — criterion — element — impact — fix — found by/, /\*\*Blocker\*\* \(a user can't finish the task\), \*\*Major\*\* \(finishes with real difficulty\) or \*\*Minor\*\* \(a workaround exists\)/,
        { not: /\[A11Y\]/ }],
      ["ui-design-patterns: the checklist — 13 References kept, 14 Motion appended, the worst case and the contract; the file ≤ 60,000 bytes", checklist,
        /13\. \*\*References\*\*/, /14\. \*\*Motion\*\*/, /and the worst case/, /a New \/ Extend component's contract/,
        () => bytes("skills", "dev-spec-driven", "references", "ui-design-patterns.md") <= 60000],
      // references/subagent-execution.md — the controller's protocol
      ["subagent-execution: the tree — the kept script, the floor captures, .prev.png", X, /ui\/capture\.<ext> written by you: the kept capture script/, /--floor-320\.png…; a retaken one's old file kept as \.prev\.png/],
      ["subagent-execution: the re-review ledger line", X, /Task 3: ui re-review \(round 1\) — U1 resolved, U2 partial; 0 regressions → fix round 2\/5/],
      ["subagent-execution: the fix loop — a fresh spec-ui-reviewer in verdict mode, both places", X,
        /the captures it changed taken again and a fresh `spec-ui-reviewer` in verdict mode \(`references\/ui-review\.md` → 5\) —/,
        /take the captures it changed again and a fresh `spec-ui-reviewer` in verdict mode \(`references\/ui-review\.md` → 5\), whichever review the round answered/],
      ["subagent-execution: the Breaker — verdict mode", X, /a visual one on a fresh `spec-ui-reviewer`'s verdict, never yours \(verdict mode; you don't look at the images\)/],
      ["subagent-execution: the checkpoint — floor only", X, /each task's visual review \(match · differences fixed · floor only · skipped and why\)/],
      ["subagent-execution: no reference → the floor alone, never matching the design", X, /\| "No reference, so the review passed" \| No reference means only the floor ran\. Say so at the checkpoint; never count it as matching the design\. \|/],
      ["subagent-execution: a UI taste → ui.md's ## Taste", X, /a UI taste under `ui\.md`'s `## Taste`, `references\/review-feedback\.md` → A UI taste/],
      // the command, the critic, the checklists, the index
      ["executeTask: the floor alone without a reference; the verdict pass after a fix", E, /after a fix round, a verdict pass on what was found/,
        /No reference: the floor alone \(`ui-review\.md` → 1\) — never "matches the design"; no capture tool or no subagent tool: say it was not run — never that it passed\./],
      ["spec-critic: the state matrix's worst case", C, /and the worst case — each field's realistic extreme and where its limit comes from/],
      ["spec-critic: no reference → the floor alone, the old \"never runs\" gone", C, /none means the build is held to the accessibility floor alone/, { not: /none means that review never runs/ }],
      ["spec-critic: a New / Extend component's contract", C, /each New \/ Extend one with its contract — states, APG keys, role and name, one enumerated prop per variant axis, slots/],
      ["track-checklists: Phase 2 — the worst case, the optional Component Contracts", T, /UI States \(a state matrix with its worst case and a reference per view\)/, /optional, Component Contracts \(one per New \/ Extend component\)/],
      ["track-checklists: Phase 3 — the floor without a reference, a contract's states and keys as tests", T,
        /a contract's states as fixtures, its keys as component tests/, /each UI task's visual review against the view's reference — on the floor where it has none/],
      ["track-checklists: finish — against its reference, or on the floor", T, /each built state's visual review — against its reference, or on the floor where it has none — passed, or why it was not run/],
      ["index: ui-review's line — the floor, the worst case, the verdict pass", I, /the floor without a reference \(320 px, 200 % zoom, focus\), the worst-case capture, the fix loop, the verdict pass after a fix/],
      ["index: ui-design-patterns' line — contracts, the worst case, interaction details, motion", I, /component contracts, UI states and the worst case, forms and interaction details, motion/],
      // references/review-feedback.md — the user's taste, through the existing learning rule
      ["review-feedback: the Project rule — a UI taste in ui.md's ## Taste", F, /a UI taste in `ui\.md`'s `## Taste`, below/],
      ["review-feedback: taste — only the user's, never your preference", taste, /Only what the user said, edited \(a value they changed in a file you wrote\), picked or undid — never your own preference/],
      ["review-feedback: taste — the class, never one screen's instance", taste, /The class of element \("raised surfaces"\), never one screen's instance\./],
      ["review-feedback: taste — the entry format", taste, /`- \*\*<class> <value or token>, always \/ never\.\*\* Why: <their words>\. <!-- <date>, the user: "<their words>" -->`/],
      ["review-feedback: taste — a contradiction shown with both dates", taste, /show both with their dates; the user keeps one/],
      ["review-feedback: taste — a check offered where code can show a violation", taste, /Where code can show a violation, offer a check too/],
      ["review-feedback: taste — the re-check it costs, proposed in a batch", taste, /warn `steering-changed-since-approval` — propose them in a batch at a checkpoint, not one per nudge/],
      ["review-feedback: taste credited to Emil Kowalski", taste, /After Emil Kowalski's learn-taste skill \(MIT\)\./],
    ];
    const cond = (text, c) => c instanceof RegExp ? () => c.test(text) : typeof c === "function" ? c : () => !c.not.test(text);
    const condName = (c, i) => c instanceof RegExp ? "matches " + c.source.slice(0, 70) : typeof c === "function" ? "check " + i : "never " + c.not.source.slice(0, 60);
    for (const [label, text, ...checks] of rows) {
      all("1.37 UI prose — " + label, Object.fromEntries(checks.map((c, i) => [condName(c, i), cond(text, c)])));
    }
  }

  { // 1.37 the docs pass — items 1 and 2's user prose: the UI checks (engine/ui-checks.js) and the registry's `_Deprecated:_`
    // marker with doctor's ui-deprecated (quality.js). The rule ids, their levels and the bounds the prose quotes are read from
    // the engine's source, so a rule added, removed or moved between levels without the prose fails here.
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const refRaw = (f) => raw("skills", "dev-spec-driven", "references", f);
    // (1.38.0: the UI checks section moved WHOLE to ui-code-scan.md — read there; the registry slice of ui-design-patterns.md
    // ends at the next h2)
    const P = refRaw("ui-design-patterns.md"), S = ws(refRaw("steering-templates.md")), T = ws(refRaw("track-checklists.md"));
    const scanLines = refRaw("ui-code-scan.md").split("\n"), at = scanLines.findIndex((l) => l.startsWith("### UI checks"));
    const end = scanLines.findIndex((l, i) => i > at && /^#+ /.test(l));
    const checks = at < 0 ? "" : ws(scanLines.slice(at, end < 0 ? scanLines.length : end).join("\n"));
    const lines = P.split("\n"), regAt = lines.findIndex((l) => l.startsWith("### The registry"));
    const regEnd = lines.findIndex((l, i) => i > regAt && /^## /.test(l));
    const src = raw("mcp", "lib", "engine", "ui-checks.js");
    const rulesSrc = (src.match(/const UI_RULES = \{([^}]*)\}/) || ["", ""])[1];
    const rules = [...rulesSrc.matchAll(/"([a-z-]+)": "([a-z]+)"/g)].map((m) => ({ id: m[1], level: m[2] }));
    const num = (name) => Number(((src.match(new RegExp("const " + name + " = (\\d+)")) || [])[1]));
    const [warnPart, reportPart] = checks.split("In the report alone");
    const registry = regAt < 0 || regEnd < 0 ? "" : ws(lines.slice(regAt, regEnd).join("\n"));
    const rows = [
      ["ui-code-scan: the UI checks section — every warn rule before 'In the report alone', every report rule after it",
        () => rules.length >= 6 && reportPart !== undefined
          && rules.every((r) => (r.level === "warn" ? warnPart : reportPart).includes("`" + r.id + "`"))
          && rules.every((r) => !(r.level === "warn" ? reportPart : warnPart).includes("`" + r.id + "`"))],
      ["ui-code-scan: the UI checks — each warn rule's WCAG criterion", () => /`zoom-disabled` \([^)]*WCAG 1\.4\.4\)/.test(checks)
        && /`img-no-alt` \([^)]*1\.1\.1\)/.test(checks) && /`outline-removed` \(.*?2\.4\.7\)/.test(checks)
        && /`click-no-keyboard` \(.*?2\.1\.1\)/.test(checks) && /`paste-blocked` \([^)]*3\.3\.8 at a sign-in or code step, a usability defect elsewhere\)/.test(checks)],
      // (review 1 of 1.37: a role or a key handler alone reaches nothing — D1; a named handler is followed by no rule, but only
      // paste's is never judged — D3; a linter's suppression is not read, a CSS finding sits on its declaration — S11, D8)
      ["ui-code-scan: the UI checks — click-no-keyboard asks a tabindex (a role or a key handler alone is not enough)", () =>
        /`click-no-keyboard` \(a click handler on an element the keyboard cannot reach: no `tabindex` — a role or a key handler alone is not enough — 2\.1\.1\)/.test(checks)],
      ["ui-code-scan: the UI checks — a +ui feature's finish warning, never a blocker; one more warning registry or not",
        () => /For a \+ui feature, a warning of `spec_finish` too, never a blocker/.test(checks)
          && /The UI checks' findings are one more warning, registry or not\./.test(registry)],
      // (review 2 of 1.37: on its line or the line above whatever that line holds — S5's narrowing out —, the comment forms
      // that silence and a class's own line — R2-D1, R2-F4, R2-D5; what is not judged — R2-S6; the focus search's bound, the
      // engine's, and what a bound cut in the report alone — R2-E1, R2-E2)
      ["ui-code-scan: the UI checks — silencing with a reason, on the line or the one above; counted, never listed",
        () => /a comment `ui-check-off: <rule-id> <why>` on its line \(a declaration's, a class's\) or the line above — `\/\/`, `\/\* \*\/`, `<!-- -->`, not Blade's or Twig's: counted, never listed; only this comment silences \(a linter's is not read\) — an `<a>` a parent gives its href \(Next's `legacyBehavior`\) is one to silence/.test(checks)],
      ["ui-code-scan: the UI checks — what is never judged, its bounds the engine's", () => /A doubt is never judged: a named paste handler, a click whose content holds a control, a component \(an icon or a text component too\) or a slot, or no text \(an icon or an image alone\), a spread/.test(checks)
        && checks.includes("a tag past " + num("DS_TAG_ATTRS") + " attributes or " + num("DS_TAG_LINES") + " lines")
        && checks.includes("the project's first " + num("DS_FOCUS_SHEETS") + " stylesheets — past them, named unjudged — 2.4.7")
        && /In the report alone: `transition-all` \(kits ship it\), what a bound cut\./.test(checks)],
      ["ui-design-patterns: the Review row points to the UI checks (ui-code-scan.md since 1.38.0)", () => /— and the \*\*UI checks\*\* of the same files \(\[ui-code-scan\.md\]\(ui-code-scan\.md\)\)/.test(registry)],
      // (1.37.0 review 1: the whole component — never a variant or a prop —, a replacement not retired itself, the notes' name in
      // the registry's letter case; review 2: punctuation after the word, never a word; the replacement named on its own)
      ["ui-design-patterns: `_Deprecated:_` — the marker, its replacement rule, credited to Impeccable", () =>
        /`_Deprecated: use DataGrid_` \(retires the whole component, never a variant or a prop: in any cell after its name, `_Deprecated_` alone too, punctuation after the word, never a word; the replacement is the first other listed component, not retired itself, its first 20 words name on its own \(`use Dialog`, not `Dialog\.Root`\) — after Impeccable, Apache-2\.0\)/.test(registry)],
      ["ui-design-patterns: doctor's ui-deprecated — warns, never refuses, silent once the notes name the replacement", () =>
        /`ui-deprecated` warns — never refuses — when a Reuse \/ Extend row names a component the registry marks `_Deprecated:_`, naming its replacement; silent once the row's notes name it in the registry's letter case/.test(registry)],
      ["ui-design-patterns: one Vercel credit line, naming the UI checks too", () => (P.match(/Vercel's Web Interface Guidelines \(MIT\)/g) || []).length === 1
        && /After Vercel's Web Interface Guidelines \(MIT\) — the UI checks' rules too\./.test(P)],
      ["steering-templates: `_Deprecated:_` among the English markers, and its bullet", () =>
        /\(`_Token sources:_`, `_Libraries:_`, `_From:_`, `_Deprecated:_`\): they are what the engine reads/.test(S)
          && /`_Deprecated: use DataGrid_` in any cell after a component's name retires it \(`_Deprecated_` alone too, or a punctuation mark after the word — a word makes it a note: `_Deprecated in favour of DataGrid_` retires nothing\): doctor's `ui-deprecated` warns when a design still reuses or extends it, naming the first other listed component, not retired itself, the text names — by its name alone \(`use Dialog`, not `Dialog\/Sheet`, `Dialog\.Root` or a path\) — silent when the row's notes name that one, alone too, as this file writes it \(`DataGrid`, not "the data grid"\): a capitalised word reads as the name — to keep a component on purpose, write the name in a code span or a tag\. It retires the WHOLE component: write a retired variant or prop without the marker\./.test(S)],
      ["track-checklists: finish — the UI checks' warnings fixed or silenced with a reason", () =>
        /the UI checks' warnings \(`spec_scan \{designSystem: true, name\}`\) fixed or silenced with a reason/.test(T)],
    ];
    // 1.37.0 review 1 (D10): each README's +ui paragraph says what a user meets — the UI checks (how to run them, a finish
    // warning never a blocker, how to silence one), `_Deprecated:_` and the visual review's floor —, in its own language
    const cmd = /`dev-spec design-system <feature>` \(`spec_scan \{designSystem: true, name\}`\)/;
    const readme = {
      "README.md": [cmd, /also runs the UI checks on the feature's view and style files/, /one more `finish` warning, registry or not, never a blocker/,
        /a comment `ui-check-off: <rule-id>` with its reason, on the finding's line or the line above, silences one\./,
        /A registry row marked `_Deprecated: use DataGrid_` retires its component: `doctor` warns when a design still reuses or extends it, naming the replacement\./,
        /a view with no reference is held to the accessibility floor instead \(320 px wide, text at 200 %, focus visible\)/],
      "README.pt.md": [cmd, /corre também as verificações de interface sobre os ficheiros de vista e de estilos da feature/,
        /mais um aviso do `finish`, com ou sem registo, nunca um bloqueio/, /um comentário `ui-check-off: <rule-id>` com o motivo, na linha do problema ou na de cima, silencia-o\./,
        /Uma linha do registo marcada `_Deprecated: use DataGrid_` retira o seu componente: o `doctor` avisa quando um design ainda o reutiliza ou estende, e indica o que o substitui\./,
        /uma vista sem referência é avaliada no mínimo de acessibilidade \(320 px de largura, texto a 200 %, foco visível\)/],
      "README.es.md": [cmd, /ejecuta también las comprobaciones de interfaz sobre los ficheros de vista y de estilos de la funcionalidad/,
        /un aviso más de `finish`, con o sin registro, nunca un bloqueo/, /un comentario `ui-check-off: <rule-id>` con su motivo, en la línea del hallazgo o en la de encima, lo silencia\./,
        /Una fila del registro marcada `_Deprecated: use DataGrid_` retira su componente: `doctor` avisa cuando un diseño aún lo reutiliza o lo extiende, y nombra el que lo sustituye\./,
        /una vista sin referencia se juzga en el mínimo de accesibilidad \(320 px de ancho, texto al 200 %, foco visible\)/],
    };
    for (const [f, res] of Object.entries(readme)) {
      const t = ws(raw(f));
      rows.push([f + ": the +ui paragraph — the UI checks (run, warn never block, ui-check-off), `_Deprecated:_`, the floor", () => res.every((re) => re.test(t))]);
    }
    for (const [label, check] of rows) all("1.37 docs pass — " + label, { holds: check });
  }

  { // 1.38.0 F0a — the UI references split (CRIT_X D1 / D2): ui-design-patterns.md's code-scan table and its UI checks section
    // moved WHOLE to references/ui-code-scan.md, its Responsiveness section to references/ui-responsive.md; pointers left
    // behind. The table's whitespace-folded text is 1.37.0's to the byte (its sha1 below): an edit of the table is deliberate
    // and re-pins it, saying why. (The UI checks section is pinned clause by clause by the 1.37 docs pass above.)
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ").trim();
    const refRaw = (f) => raw("skills", "dev-spec-driven", "references", f);
    const bytes = (f) => Buffer.byteLength(refRaw(f), "utf8");
    const P = refRaw("ui-design-patterns.md"), C = refRaw("ui-code-scan.md"), R = refRaw("ui-responsive.md");
    const cl = C.split("\n"), tAt = cl.findIndex((l) => l === "**What the code scan reads — and what it doesn't.**");
    let tEnd = tAt + 2;
    while (tEnd < cl.length && cl[tEnd].startsWith("|")) tEnd++;
    const table = tAt < 0 ? "" : ws(cl.slice(tAt, tEnd).join("\n"));
    const sha = require("crypto").createHash("sha1").update(table).digest("hex");
    const pl = P.split("\n"), rAt = pl.findIndex((l) => l === "## Responsiveness");
    const rEnd = pl.findIndex((l, i) => i > rAt && /^## /.test(l));
    const resp = rAt < 0 ? "" : pl.slice(rAt + 1, rEnd).join("\n").trim();
    const regAt = pl.findIndex((l) => l.startsWith("### The registry")), regEnd = pl.findIndex((l, i) => i > regAt && /^## /.test(l));
    const registry = ws(pl.slice(regAt, regEnd).join("\n"));
    const I = ws(refRaw("index.md")), uiLine = (I.match(/- \+ui: .*?(?= - \+obs:)/) || [""])[0];
    const tool = (refRaw("tooling-reference.md").split("\n").find((l) => l.startsWith("| `spec_scan {designSystem: true}`")) || "");
    all("1.38.0 F0a: the code-scan table and the UI checks moved whole to ui-code-scan.md, Responsiveness to ui-responsive.md — pointers left behind, the two caps (got " +
      JSON.stringify({ sha, table: table.length, scan: bytes("ui-code-scan.md"), responsive: bytes("ui-responsive.md") }) + ")", {
      tableIdentical: () => sha === "77ce56108eac96e5204db8426e73e44bad3aa276" && table.length === 18970,
      checksMoved: () => /^### UI checks — defects whatever the taste$/m.test(C) && !/^### UI checks/m.test(P),
      tableGone: () => !P.includes("What the code scan reads — and what it doesn't.") && !/^\| Components \|/m.test(P),
      onePointer: () => /^What the code scan reads and what it doesn't, and the UI checks it runs: \[ui-code-scan\.md\]\(ui-code-scan\.md\)\.$/m.test(P),
      registryPointers: () => /\(what it reads, and what it doesn't: \[ui-code-scan\.md\]\(ui-code-scan\.md\)\)/.test(registry)
        && /\(what is never "gone": \[ui-code-scan\.md\]\(ui-code-scan\.md\)\)/.test(registry) && !/\(below\)|: below\)|the table below\)/.test(registry),
      responsivePointer: () => resp.split("\n").length === 2 && /\[ui-responsive\.md\]\(ui-responsive\.md\)\.$/.test(resp) && /^## Responsiveness$/m.test(R),
      backLinks: () => /\[ui-design-patterns\.md\]\(ui-design-patterns\.md\)/.test(C) && /\[ui-design-patterns\.md\]\(ui-design-patterns\.md\)/.test(R),
      caps: () => bytes("ui-code-scan.md") <= 30000 && bytes("ui-responsive.md") <= 12000,
      index: () => /`references\/ui-code-scan\.md`/.test(uiLine) && /`references\/ui-responsive\.md`/.test(uiLine)
        && /component contracts, UI states and the worst case, forms and interaction details, motion/.test(uiLine),
      tooling: () => /What the scan reads and what it doesn't: `references\/ui-code-scan\.md`/.test(tool),
    });
  }

  { // 1.38.0 F0c — font-size-viewport's prose: its criterion and failure (CRIT_3 §7), the three narrowings (CRIT_3 must-fix 1–3)
    // and what is not seen, in ui-code-scan.md's UI checks section (the 1.37 docs pass places it among the warn rules, read from
    // UI_RULES); tooling-reference's spec_scan row names it at its level
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const scan = raw("skills", "dev-spec-driven", "references", "ui-code-scan.md").split("\n"), at = scan.findIndex((l) => l.startsWith("### UI checks"));
    const end = scan.findIndex((l, i) => i > at && /^#+ /.test(l));
    const checks = at < 0 ? "" : ws(scan.slice(at, end < 0 ? scan.length : end).join("\n"));
    const tool = (raw("skills", "dev-spec-driven", "references", "tooling-reference.md").split("\n").find((l) => l.startsWith("| `spec_scan {designSystem: true}`")) || "");
    all("1.38.0 F0c: ui-code-scan.md's UI checks name font-size-viewport (WCAG 1.4.4, failure F94), what keeps it certain (a stylesheet's size only when its file sizes no text conditionally, an element's own style attribute, a bare text-[…vw] with no variant text- utility on its line) and what is not seen; tooling-reference's spec_scan row lists it among the warn rules", {
      criterion: () => /`font-size-viewport` \(text sized in viewport units alone.*?which zooming does not enlarge: WCAG 1\.4\.4, failure F94/.test(checks),
      sheet: () => /only when that file declares no font size inside `@media`, `@container`, `@supports` or a Sass `@include` \(nested too\)/.test(checks),
      inline: () => /an element's own `style` attribute, never a component's prop or a CSS-in-JS object \(`sx`, `css\(\)`, `style\(\)`\)/.test(checks),
      tailwind: () => /a bare `text-\[…vw\]` only when its line holds no `text-` utility under a variant \(`md:text-6xl`\)/.test(checks),
      notSeen: () => /An override in another file is not seen: silence that one\./.test(checks),
      tooling: () => /paste-blocked · font-size-viewport, `level` warn/.test(tool),
    });
  }

  // Release hygiene: the three version fields agree.
  const vRoot = path.join(__dirname, "..");
  const vPkg = require(path.join(vRoot, "package.json")).version;
  const vPlugin = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "plugin.json"), "utf8")).version;
  const vMkt = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "marketplace.json"), "utf8")).plugins[0].version;
  ok(vPkg === vPlugin && vPlugin === vMkt, `package.json / plugin.json / marketplace.json versions agree (${vPkg} / ${vPlugin} / ${vMkt})`);
};

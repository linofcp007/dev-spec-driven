"use strict";
// Docs and prose — the skill, commands, agents, README and rule files agree with the engine; release hygiene.
// The maintainer notes, no PR / CI steering, the docs' worked examples, the test counts, the three version fields.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Runs after 01-core, in the same process: it reads ctx.vDir — the v1.12 project whose login-loop feature 01-core took to its finish (the prose guard reads its merge summary).
exports.deps = ["01-core"];
exports.run = async ({
  ok, skip, all, S, root, tmp, libSources, maintainerNotes, approveBefore, init, list, require, __dirname, vDir,
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
  // 1.42 UX-16: quickstart.md and checklist.md come with design.md — a feature of any size —, never with a change (xs), a bugfix
  // or a spike: SKILL.md said "always". The sentence is held to spec_create's own scaffold.
  const docsQs = path.join(tmp, "proj-ux16");
  S.initProject(docsQs, ["core"], "en");
  const docsQsFiles = (f) => ["design.md", "quickstart.md", "checklist.md"].filter((x) => fs.existsSync(path.join(f.dir, x))).join(",");
  // (review 1, R1-SURF-08: a bugfix on a marker track gets design.md — its track sections — and neither file: "a feature's")
  const docsQsGot = [S.createFeature(docsQs, "alpha", ["core"]), S.createFeature(docsQs, { name: "delta", tracks: ["core"], size: "m" }),
    S.createFeature(docsQs, { name: "beta", tracks: ["core"], size: "xs" }), S.createFeature(docsQs, "gamma", ["core"], undefined, undefined, undefined, "bugfix"),
    S.createFeature(docsQs, "crash two", ["tdd", "saas"], "the tenant app crashes on save", undefined, "en", "bugfix")].map(docsQsFiles);
  ok(/`spec_doctor` only checks that the section is there/.test(docsSkill) && /`spec_create` scaffolds `quickstart\.md` and `checklist\.md` with a feature's `design\.md` \(never a bugfix's\) — fill both\./.test(docsSkill) &&
    !/always scaffolds `quickstart\.md`/.test(docsSkill) && JSON.stringify(docsQsGot) === JSON.stringify(["design.md,quickstart.md,checklist.md", "design.md,quickstart.md,checklist.md", "", "", "design.md"]) &&
    !/^\| Tool \|/m.test(docsSkill) && (docsRef("tooling-reference.md").match(/^\| `(?:spec_|ears_|trace_|steering_)/gm) || []).length >= 22,
    "SKILL.md claims are honest (constitution check = section presence; 1.42 UX-16: quickstart / checklist come with design.md — a feature, not a change or a bugfix); the tool table lives in tooling-reference.md (got " + JSON.stringify(docsQsGot) + ")");
  // 1.42 UX-06: `/spec` with no argument — a returning user who names no feature — routes through spec_status {}: one feature in
  // flight is resumed, several are listed to choose from, none starts Phase 0 (it routed an existing feature or a new idea only).
  const docsSpecCmd = docsRead("commands", "spec.md").replace(/\s+/g, " ");
  ok(/- \*\*No argument\*\* → `spec_status \{\}`: one feature in flight \(not complete\) → resume it as below; several → list them with their phase and progress and ask which; none → ask for the idea \(Phase 0\)\./.test(docsSpecCmd) &&
    docsSpecCmd.indexOf("**No argument**") < docsSpecCmd.indexOf("**An existing feature**"),
    "1.42 UX-06: /spec with no argument routes through spec_status {} — one in flight: resume; several: list and ask which; none: Phase 0 — before the existing-feature route");
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
  // 1.42 S14: a byte ratchet per agent prompt — an agents/*.md is paid on EVERY dispatch of its agent, so each file has a cap
  // and stays within it. A property over agents/*.md, never the six names: a new agent without a cap fails, and so does a cap
  // left for an agent that is gone. Four caps were measured on the integrated 1.42 branch at ceil(bytes × 1.02 / 100) × 100
  // (reviewer 27,211 · implementer 18,303 · critic 16,543 · simplifier 8,118 bytes); the verifier's 4,000 (1.26, the row above)
  // and the UI reviewer's 7,000 (1.32, its visual-review row) are their older pins, kept. Bytes as shipped (the file's size —
  // LF, .gitattributes), never characters: an em dash costs three. Past a cap: raise it in one line, the reason in the commit.
  const AGENT_CAPS = { "spec-critic.md": 16900, "spec-implementer.md": 18700, "spec-reviewer.md": 27800, "spec-simplifier.md": 8300,
    "spec-ui-reviewer.md": 7000, "spec-verifier.md": 4000 };
  const agentSizes = agentFiles.map((a) => [a, fs.statSync(path.join(agentsDir, a)).size, AGENT_CAPS[a]]);
  const staleCaps = Object.keys(AGENT_CAPS).filter((a) => !agentFiles.includes(a));
  all("1.42 S14: every agents/*.md has a byte cap and stays within it (bytes / cap: " +
    agentSizes.map(([a, b, c]) => a + " " + b + " / " + (c || "none")).join(", ") + ") — past a cap, raise it in one line, the reason in the commit",
    Object.assign(Object.fromEntries(agentSizes.map(([a, b, c]) => [a + " is " + b + " bytes, cap " + (c || "none"), Number.isInteger(c) && b <= c])),
      { ["a cap for every agent that exists (stale: " + (staleCaps.join(", ") || "none") + ")"]: agentFiles.length > 0 && !staleCaps.length }));
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
    // 1.42 UX-17: each README's requirements line names every agent that starts without CLAUDE.md — the set is read from the
    // agents' front matter (`omitClaudeMd: true`), never a name list: 1.41's named the critic and the verifier, not the UI reviewer.
    // A new such agent needs its display name here (and in the three sentences), and one that keeps CLAUDE.md again leaves both.
    const freshNames = {
      "spec-critic.md": { en: "the spec critic", pt: "o crítico da spec", es: "el crítico de la spec" },
      "spec-verifier.md": { en: "the verifier", pt: "o verificador", es: "el verificador" },
      "spec-ui-reviewer.md": { en: "the UI reviewer", pt: "o revisor de interface", es: "el revisor de interfaz" },
    };
    const freshAgents = agentFiles.filter((a) => /^omitClaudeMd: true$/m.test(front(a))).sort();
    const freshSentence = { en: /2\.1\.271 or later also starts ([^.]*) without your CLAUDE\.md\./, pt: /a 2\.1\.271 ou posterior também arranca ([^.]*) sem o teu CLAUDE\.md\./,
      es: /la 2\.1\.271 o posterior además arranca ([^.]*) sin tu CLAUDE\.md\./ };
    const freshGot = docsReadmes.map(([lang, , t]) => [lang, (docsWs(t).match(freshSentence[lang]) || [])[1] || ""]);
    all("1.42 UX-17: each README's Claude Code line names every omitClaudeMd agent (from agents/*.md's front matter: " + freshAgents.join(", ") + ") and no other (got " + JSON.stringify(freshGot) + ")", {
      sameSet: JSON.stringify(Object.keys(freshNames).sort()) === JSON.stringify(freshAgents) && freshAgents.length >= 3,
      named: freshGot.every(([lang, s]) => s && freshAgents.every((a) => s.includes((freshNames[a] || {})[lang] || "\0"))),
    });
    // 1.32 (from Shopify's Helix): the visual review of a +ui task — an image-only reviewer, INVALID on different states,
    // never "passed" without a reference or a capture; it re-runs after a fix that changes a view; more autonomy only on
    // the user's word; a checkpoint's general feedback becomes a steering amendment; the skeleton first.
    const uiAgent = docsWs(docsRead("agents", "spec-ui-reviewer.md")), uiRef = docsWs(docsRef("ui-review.md"));
    all("1.32: the visual review (agents/spec-ui-reviewer.md, references/ui-review.md) wired into the task loop, /executeTask and SKILL.md; the re-run after a fix, the autonomy grant, learnings → steering, the skeleton first", {
      agent: () => /^model: inherit$/m.test(front("spec-ui-reviewer.md")) && ["never the code, the diff or the conversation", "the pair is **INVALID**",
        "**Blocker**: a user would notice it and the code can fix it", "its **place**: the region and the element", "### UI review: Match | Differences | Invalid"].every((s) => uiAgent.includes(s)) &&
        // 1.42 (UX-13a): the credit lives in references/ui-review.md alone — the agent's copy, paid per visual review, is gone
        uiRef.includes("Adapted from the UI review gate of Shopify's Helix (shopify.engineering/helix)") && !uiAgent.includes("Helix"),
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
  // (tag `behavior`) grade what the agent DOES, not whether the skill fires; they are checked in the A3 block below, and the
  // review-seat cases (tag `review-seat`, 1.42: a review agent's reply) in 17-docs-evals.js.
  const evalCases = fs.readdirSync(evalRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && !["results", "fixtures"].includes(e.name)).map((e) => e.name);
  const evalBehavior = (c) => /^\s+- (?:behavior|review-seat)\s*$/m.test(fs.readFileSync(path.join(evalRoot, c, "prompt.md"), "utf8"));
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

  // 1.41.0 (CRIT_G1 #6): a `# nosec` example a user or an agent copies names the rule and gives its reason — `# nosec <id>  # <reason>`,
  // the form Bandit takes silently (a bare `# nosec` silences every Bandit rule on the line, and dev-guardian 3.17 reports it as a
  // blanket suppression). A property over every surface that teaches one — the prose files above, the i18n sources (every language),
  // the CLI and the hooks —, never a list of the places that held one. A directive NAMED without its `#` (`nosec`, a reviewer's
  // list of scanner directives) is no example. The guard's own reader is checked on both sides.
  {
    const RE_BARE_NOSEC = /#[ \t]*nosec\b(?![ \t]+(?:<id>|[A-Z]{1,2}\d{2,4})(?:,[ \t]*(?:<id>|[A-Z]{1,2}\d{2,4}))*[ \t]+#[ \t]*\S)/gi;
    const nosecFiles = proseFiles.concat(["mcp/lib/i18n", "cli", "hooks"].flatMap((d) => walkFiles(path.join(root, d)).filter((p) => /\.(?:js|cjs|mjs|md)$/.test(p))));
    const bareAt = nosecFiles.flatMap((p) => (fs.readFileSync(p, "utf8").match(RE_BARE_NOSEC) || []).length ? [path.relative(root, p)] : []);
    const flags = (s) => (s.match(RE_BARE_NOSEC) || []).length > 0;
    all("1.41.0 (CRIT_G1 #6): every `# nosec` example names the rule and its reason (`# nosec <id>  # <reason>`) — the prose, the i18n sources of every language, the CLI, the hooks; the reader flags a bare one and passes the named forms (got " + JSON.stringify(bareAt) + ")", {
      none: bareAt.length === 0 && nosecFiles.length > 100,
      reader: ["(nosemgrep: <rule> -- <reason>, # nosec)", "`# nosec`", "x = 1  #nosec", "# nosec B602", "# NOSEC <id>"].every(flags) &&
        !["# nosec <id>  # <reason>", "# nosec <id>  # <motivo>", "# nosec B602, B607  # reviewed: constant command", "`nosec`, `gitleaks:allow`"].some(flags),
      taught: ["en", "pt", "es", "pt-BR"].every((l) => /# nosec <id> {2}# </.test(S.msg(l).guardian.fixHint("x"))),
    });
  }

  // 1.41.0 chain P — the gardening round's prose: the reviewer's suppression line (CRIT_X D8.9).
  {
    const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n").replace(/\s+/g, " ");
    const rev = rd("agents", "spec-reviewer.md");
    all("1.41.0 (CRIT_X D8.9): spec-reviewer — a suppression the diff adds with no reason is a question, Important when it hides a security scanner (nosemgrep, Bandit's nosec, gitleaks:allow); a reasoned one stays Silenced on purpose", {
      reviewer: /\*\*Silenced on purpose\*\* — a rule the code switches off with its reason beside it[^.]*\. A suppression the diff adds with no reason is a question \(⚠️ — what does it silence, and why\?\), and \*\*Important\*\* when it hides a security scanner \(`nosemgrep`, Bandit's `nosec`, `gitleaks:allow`\): no scan sees that line again\./.test(rev),
    });

    // CRIT_S4 (KEEP, #6): the Test Value rule — the testing-standards template of a NEW +tdd project (EN / PT / ES, pt-BR derived),
    // the reference's template, test-patterns.md (the rule, new projects only and why, the criteria, the never-pruned list, remove a
    // test whole). A 1.40 stub verbatim (the template without the section) still reads as a template.
    const stub = (l) => {
      const p = path.join(tmp, "p141-tv-" + l);
      S.initProject(p, ["tdd"], l);
      return fs.readFileSync(path.join(p, ".specs", "steering", "testing-standards.md"), "utf8");
    };
    const tv = { en: stub("en"), pt: stub("pt"), es: stub("es"), "pt-BR": stub("pt-BR") };
    const old = path.join(tmp, "p141-tv-old");
    S.initProject(old, ["tdd"], "en");
    fs.writeFileSync(path.join(old, ".specs", "steering", "testing-standards.md"), tv.en.slice(0, tv.en.indexOf("\n## Test Value")) + "\n");
    S.createFeature(old, "Cart", ["tdd"]);
    const oldSteering = (S.specDoctor(old, "cart").checks || []).find((c) => c.id === "steering") || {};
    const tp = rd("skills", "dev-spec-driven", "references", "test-patterns.md"), stt = rd("skills", "dev-spec-driven", "references", "steering-templates.md");
    // (1.41.0 review 2, the user's ruling on R2-PZ-1: `retired-ac` cut — the pass keeps same-path / no-kill, never removes a
    // criterion's last planned test, and names a retired AC's test as one needing a /spec-change on its feature)
    all("1.41.0 (CRIT_S4 #6): the Test Value rule — a new +tdd project's testing-standards.md (EN / PT / ES / pt-BR), the reference's template, test-patterns.md (new projects only — adopting it re-reviews every approved +tdd feature —, the two criteria, the never-pruned list with a criterion's last planned test first, a retired AC's test never pruned, a test removed whole); the 1.40 stub verbatim still a template (got " +
      JSON.stringify({ tails: Object.fromEntries(Object.entries(tv).map(([l, t]) => [l, t.slice(t.lastIndexOf("\n## "))])), oldSteering }) + ")", {
      en: /\n## Test Value\n- A test earns its place when it guards an AC \(its T-ID in the test plan\) or a past bug \(a bugfix's regression test\), and fails when that behaviour breaks\.\n- The others — the same path as another test, green when its behaviour breaks — go to the pruning pass \(\/spec-review <feature> prune\): removed whole, only with the user's approval, never mid-task, never a criterion's last planned test\.\n$/.test(tv.en),
      pt: /\n## Valor dos Testes\n- Um teste merece o seu lugar quando guarda um AC \(o seu T-ID no plano de testes\) ou um bug passado[^\n]*\n- Os outros — o mesmo caminho de outro teste, [^\n]*\(\/spec-review <feature> prune\): removidos por inteiro, só com a aprovação do utilizador, nunca durante uma tarefa, nunca o último teste planeado de um critério\.\n$/.test(tv.pt) &&
        /só com a aprovação do usuário, nunca durante uma tarefa, nunca o último teste planejado de um critério\.\n$/.test(tv["pt-BR"]),
      es: /\n## Valor de las Pruebas\n- Una prueba se gana su lugar cuando protege un AC \(su T-ID en el plan de pruebas\)[^\n]*\n- Las demás — la misma ruta que otra prueba, [^\n]*\(\/spec-review <feature> prune\): se eliminan enteras, solo con la aprobación del usuario, nunca a mitad de una tarea, nunca la última prueba planificada de un criterio\.\n$/.test(tv.es),
      noRetired: Object.values(tv).every((t) => !/retired|retirados/.test(t.slice(t.lastIndexOf("\n## ")))),
      oldStub: oldSteering.status === "warn" && /testing-standards\.md \(4\)/.test(oldSteering.detail || ""),
      reference: /## Test Value - A test earns its place when it guards an AC \(its T-ID in the test plan\)[^#]*- The others — the same path as another test, green when its behaviour breaks — go to the pruning pass \(`\/spec-review <feature> prune`\): removed whole, only with the user's approval, never mid-task, never a criterion's last planned test\./.test(stt),
      rule: /\*\*The rule\.\*\* A test earns its place when it guards an AC — its T-ID in the test plan — or a past bug \(a bugfix's regression test\), and fails when that behaviour breaks\./.test(tp),
      newOnly: /for \*\*new projects only\*\*: an existing project that adds it to `\.specs\/steering\/testing-standards\.md` gets `steering-changed-since-approval` on every \+tdd feature whose requirements or design that file governed — a re-review and a re-approval each —/.test(tp),
      criteria: !/retired-ac/.test(tp) && /\| Criterion \| What it means \| Where it comes from \| \|---\|---\|---\| \| `same-path` \|/.test(tp) &&
        /\| `same-path` \|[^|]*\| the reviewer's proposal, confirmed by probes: every break that reddens this test reddens the kept one \|/.test(tp) && /\| `no-kill` \| it stays green when the behaviour it names breaks \|/.test(tp),
      retired: /A test of an AC a shipped feature retired \(the matrix's `supersededBy` without `supersedePending`\) is never pruned: it fails once the superseding feature ships, so the pass names it and tells the user it needs a `\/spec-change` on its own feature\./.test(tp) &&
        !/\*\*retrace\*\*/.test(tp) && /is \*\*strengthened\*\* \("When a test is wrong"\), never removed/.test(tp),
      noShell: /Without a shell \(an MCP client that runs no command\) no probe runs, so the pass proposes no pruning\./.test(tp),
      never: /\*\*Never pruned:\*\* a criterion's last planned test — every AC, EC, NFR or SC the test covers keeps another test-plan entry, or the test stays \(trace asks every AC for one, the test-plan approval refuses a plan without it\) · a bugfix's regression test while the code it guards lives · an eval or load row \(outside code — the eval regression set grows, never shrinks\) · a critical flow's twice \/ two-at-once \/ another-user rows/.test(tp),
      whole: /\*\*Remove a test whole\.\*\* A pruned test is deleted — its case, or its file when nothing in it is kept —, never left as an empty body, a skipped case or a constant assertion/.test(tp),
      notMidTask: /never mid-task: a test that looks worthless during a task is a concern in your report \("When a test is wrong"\), never a deletion/.test(tp),
    });

    // CRIT_S4 (PROSE, must-fixes 1–5 and 7; CRIT_X D5): the optional /spec-review <f> prune pass — the command's mode, the protocol
    // (subagent-execution.md → The pruning pass), the reviewer's prune mode, SKILL.md's pointer, verification.md's --fail-on medium note.
    const cmdRaw = fs.readFileSync(path.join(root, "commands", "spec-review.md"), "utf8");
    const cmd = rd("commands", "spec-review.md"), sub = rd("skills", "dev-spec-driven", "references", "subagent-execution.md");
    const ver = rd("skills", "dev-spec-driven", "references", "verification.md"), skill = rd("skills", "dev-spec-driven", "SKILL.md");
    const log = rd("CHANGELOG.md").slice(0, rd("CHANGELOG.md").indexOf("## [1.40.0]")); // the 1.41.0 entry
    const desc = (/^description: (.*)$/m.exec(fs.readFileSync(path.join(root, "agents", "spec-reviewer.md"), "utf8")) || [])[1] || "";
    all("1.41.0 (CRIT_S4 #1–5, #7; CRIT_X D5): the /spec-review prune pass, prose — the map from trace_check {matrix, code}, probes only on a tracked clean file with a hash-checked copy-restore and each test alone, never `git diff --quiet` alone, no shell no probe, the batch (rows, retire, _Implements:_, removed whole, the accept), the churn; the reviewer's prune mode; SKILL.md; --fail-on medium blocks like any medium; review 1 (R1-PZ-3): .execution/ made with its .gitignore; review 2 (the user's ruling on R2-PZ-1): `retired-ac` cut — never a criterion's last planned test, a retired AC's test named for a /spec-change, never pruned; the verdict names each criterion's guard; the re-approvals complete unforced", {
      hint: /^argument-hint: "\[feature\] \[branch \| converge \| simplify \[--subagents\] \| prune \| feedback <comments> \| prompt\]"$/m.test(cmdRaw),
      command: /\*\*prune\*\* — optional, a \+tdd feature with every task done \(or a finished one, which then reopens\)/.test(cmd) && !/retired-ac|retrace/.test(cmd) &&
        /The map: `trace_check \{name, matrix: true, code: true\}` \(each row's `tests\[\]\.files`\) — never a criterion's last planned test \(an AC, EC, NFR or SC left with none\) nor an eval \/ load row; a test of an AC a shipped feature retired \(`supersededBy` without `supersedePending`\) is never pruned: it fails once the superseding feature ships, so name it — it needs a `\/spec-change` on its own feature\./.test(cmd) &&
        /its `same-path` \/ `no-kill` candidates with their probe requests, then prune \(what still guards each criterion the test covers\) · keep · strengthen per candidate/.test(cmd) &&
        /\(test-plan, then tests, then tasks — each unforced: every criterion keeps a planned test; on a finished feature execution and a new finish too\)/.test(cmd) &&
        /a tracked, clean file only, restored from a hash-checked copy, each test of a pair run alone; no shell, no probe, so no pruning/.test(cmd) &&
        // (review 2, RX-2 ruled: the accept at guard level tests only — on a guard-off project it would start a protected-tests
        // list with later warnings of its own; there the test-plan re-approval answers dev-guardian's finding)
        /at guard level tests each changed protected test accepted \(`feature protect <feature> <file> --accept --reason "pruned: …"` — the record dev-guardian's test-integrity finding is answered with; without guard tests that record is the test-plan re-approval\), then the re-approvals\./.test(cmd),
      section: /## The pruning pass \(optional, before finishing\)/.test(sub) && /It never runs mid-task: an implementer who thinks a test worthless reports it as a concern\./.test(sub),
      map: !/retired-ac|retrace/.test(sub) &&
        /1\. \*\*Baseline and the map\.\*\* The project checks \(or the full suite\) green on HEAD first\. Then `trace_check \{name, matrix: true, code: true\}`: each row's `tests` \(their T-IDs, `tests\[\]\.files`\) say which criteria every test covers\. Never a candidate: a criterion's last planned test \(a T-ID that is some AC, EC, NFR or SC row's only test entry — the test-plan approval refuses an AC with none\), nor a test of an `outsideCode` row \(eval, load\)\. A test of an AC a shipped feature retired \(a non-empty `supersededBy`, no `supersedePending`\) is never pruned: it fails once the superseding feature ships, so name it to the user — it needs a `\/spec-change` on its own feature\./.test(sub) &&
        /It proposes the `same-path` \/ `no-kill` candidates with the probes each needs and, once you hand it their results, gives each candidate one verdict — prune \(naming what still guards EACH criterion the test covers\) · keep · strengthen/.test(sub),
      tracked: /only on a file git tracks with no change of its own: `git ls-files --error-unmatch -- <file>` exits 0 and `git status --porcelain -- <file>` prints nothing\. Never `git diff --quiet` alone — an untracked file passes it, and `git checkout --` cannot restore it\./.test(sub),
      // (R1-PZ-3: a finished feature's .execution/ went at Closing — the pass makes it again, ignoring itself)
      gitignore: /\(under `\.specs\/<feature>\/\.execution\/` — no `\.execution\/` yet, as on a finished feature, whose Closing deleted it\? Create it with a `\.gitignore` holding `\*`\)/.test(sub) &&
        /`\.specs\/<feature>\/\.execution\/prune-report\.md` \(git-ignored: a report, never evidence — no probe ran and no `\.execution\/` yet\? Create it with a `\.gitignore` holding `\*` first\)/.test(sub),
      restore: /Copy the file's bytes aside \(under `\.specs\/<feature>\/\.execution\/`[^)]*\) and record its `git hash-object`; make the break; run \*\*each test of the pair alone, by name\*\*[^;]*; restore from the copy, then check that `git hash-object` gives the recorded hash and `git status --porcelain -- <file>` is empty again — a mismatch stops the pass\./.test(sub),
      noShell: /\*\*No shell\*\* \(an MCP client that runs no command\): no probe, so the pass proposes no pruning\./.test(sub),
      batch: /\*\*The user approves each pruning — never you\.\*\*/.test(sub) && /`spec_impact \{name, phase: "test-plan"\}` — its `retire` names the tasks whose `_Makes green:_` still cite a removed T-ID/.test(sub) &&
        /a pruning that deletes a whole file also drops that file from every done task's `_Implements:_` \(left there, trace's missing-file gap fails doctor and blocks the finish\)/.test(sub) &&
        /remove each test \*\*whole\*\* — its case, or the file —, never an empty body, a skip or a constant assertion/.test(sub),
      record: /At guard level tests \(`meta\.guard: "tests"`\) the record of each protected file the pruning changed or deleted is the user's accept: `feature protect <feature> <file> --accept --reason "pruned: <criterion> — <what still guards it>"` \(a guard-down, asked with the file and the reason; the merge summary prints it\) — dev-guardian's test-integrity finding is answered with it\. Without guard tests the removed row in the approval history is the record \(no accept: it would start a protected-tests list of its own\): when dev-guardian asks why the test went, answer with that feature's test-plan re-approval\./.test(sub) &&
        /recorded through spec_impact's `retire` and, at guard level tests, `feature protect --accept --reason "pruned: …"` \(without guard tests the test-plan re-approval is the record dev-guardian's finding is answered with\), then the re-approvals/.test(log) &&
        !/recorded through spec_impact's `retire` and `feature protect --accept/.test(log),
      churn: /re-approve `test-plan`, then `tests` \(every remaining planned T-ID still in code\), then `tasks`; on a finished feature also `execution` and a new `\/spec-finish` — `spec_drift` names the gone file until then, and each re-approval counts as rework in `spec_metrics`\. Each completes unforced: every criterion keeps a planned test \(step 1\), so trace finds no new gap\. So batch per feature/.test(sub),
      failOnMedium: /At a non-default `--fail-on medium` an approved pruning blocks like any medium finding: dev-guardian reads no dev-spec approval/.test(ver) &&
        /at `--fail-on medium` an approved pruning blocks like any medium finding/.test(sub),
      reviewer: /- \*\*Prune mode\*\* — the candidate tests of a pruning pass/.test(rev) && /## Prune mode The question is "does each candidate test still earn its place\?"/.test(rev) && !/retired-ac|retrace/.test(rev) &&
        /Inputs: the feature folder, the `trace_check \{matrix: true, code: true\}` result, the references folder path; on a second dispatch, the probe results\. Output: the `same-path` \/ `no-kill` candidates and the probes you ask for, then one verdict per candidate/.test(rev) &&
        ["\\*\\*prune\\*\\* — name what still guards EACH criterion it covers, an AC or an EC / NFR / SC \\(the kept test's T-ID and file\\) — a criterion left with no other planned test is no prune;",
          "\\*\\*keep\\*\\* — why it earns its place", "\\*\\*strengthen\\*\\* — its AC's only test"].every((s) => new RegExp(s).test(rev)) &&
        /Never propose a test of the never-pruned list \(a criterion's last planned test, a bugfix's regression test while its code lives, an eval or load row, a critical flow's repetition or other-user rows\)/.test(rev) &&
        /A test of an AC a shipped feature retired \(the matrix's `supersededBy` without `supersedePending`\) is never pruned: it fails once the superseding feature ships — name it, it needs a `\/spec-change` on its own feature\./.test(rev) &&
        /`\*\*Pruning:\*\* N prune · M keep · J strengthen`/.test(rev) &&
        /the controller runs every probe \(you never edit a file to make one\)/.test(rev) && /a pruned test is removed whole\./.test(rev),
      description: /, a simplification or pruning pass — /.test(desc) && desc.length <= 250,
      skill: /\(also the final review, converge, the simplification pass, the pruning pass\)\./.test(skill),
      // the mode lists: the three READMEs' command row, tooling-reference's, a workflows row of its own
      lists: [["README.md", /`\/spec-review \[branch \\\| converge \\\| simplify \\\| prune \\\| feedback \\\| prompt\]` \| Review against the spec — the branch, a converge, simplification or pruning pass,/],
        ["README.pt.md", /`\/spec-review \[branch \\\| converge \\\| simplify \\\| prune \\\| feedback \\\| prompt\]` \| Revisão face à spec — o branch, uma passagem de convergência, de simplificação ou de poda,/],
        ["README.es.md", /`\/spec-review \[branch \\\| converge \\\| simplify \\\| prune \\\| feedback \\\| prompt\]` \| Revisión frente a la spec — la rama, una pasada de convergencia, de simplificación o de poda,/]]
        .every(([f, re]) => re.test(fs.readFileSync(path.join(root, f), "utf8"))) &&
        /\| `\/spec-review branch \\\| converge \\\| simplify \\\| prune \\\| feedback \\\| prompt` \|[^\n]*· `prune`: optional — the tests that no longer earn their place \(probed same-path \/ no-kill pairs, never a criterion's last planned test\)/.test(rd("skills", "dev-spec-driven", "references", "tooling-reference.md")) &&
        /\| `\/spec-review prune` \| Optional, a \+tdd feature with every task done[^|]*— a same-path \/ no-kill pair the reviewer proposes and you probe[^|]*, never a criterion's last planned test; a test of an AC a shipped feature retired is never pruned \(it needs a `\/spec-change` on its feature\)\.[^|]*approved again, unforced \(every criterion keeps a planned test\)\. \| `references\/subagent-execution\.md` \|/.test(rd("skills", "dev-spec-driven", "references", "workflows.md")),
      changelog: /test-patterns\.md holds the criteria \(`same-path`, `no-kill`\), the never-pruned list \(a criterion's last planned test first\)/.test(log) && !/`retired-ac`, `same-path`/.test(log) &&
        /then the re-approvals \(unforced: every criterion keeps a planned test\)\. No new tool argument\./.test(log) && !/An AC a shipped feature retired needs no planned test/.test(log) &&
        !/trace_check reads the other features' `_Supersedes:_` only when an AC has no test entry/.test(log),
    });
    // W (CRIT_X D7): verification.md says what finish shows of dev-guardian's own checks below the gate
    all("1.41.0 W (CRIT_X D7): verification.md — dev-guardian's test-integrity and suppressions checks below the gate are ONE finish warning, never a blocker, labelled per check; --compact names none; before 3.17 tests only; the pruning bullet points at it; review 2 (RX-1, RX-9): only finish --run hands the base the two checks read — a run reported over MCP names none —, only a suppression with no reason is reported, the action is to give it one; RX2-2: dev-guardian 3.17's rule — no reason and naming no rule, or a whole-file one with no reason even naming its rules; one with a reason only counted —, never \"or name its rule\"; the CHANGELOG's W bullet says the same", {
      w: /\*\*Its own checks' findings below the gate\*\* \(1\.41\) — the new findings that do not block from dev-guardian's test-integrity check \(`guardian-test-integrity`, 3\.8\+: a skip, a deleted test file, fewer assertions\) and its suppressions check \(`guardian-suppressions`, 3\.17\+:[^)]*\) — are ONE finish warning, never a blocker: each labelled by its check \(weakened test · suppression added\), the first 3 by severity, the rest counted\./.test(ver),
      limits: /A `--compact` report lists the blocking findings only, so none is named there; a dev-guardian before 3\.17 has no suppressions check — its test findings only\./.test(ver),
      pointer: /Below the default `--fail-on high` they never block — the warning below names them\./.test(ver) && /they never block \(`finish <feature> --run` names them in one warning\)/.test(sub),
      onlyRun: /Both checks read the change since the feature's base, which only `finish <feature> --run` hands the launcher: a run of the check's command reported over MCP \(`spec_finish \{evidence\}`\) has no base, so it names none\./.test(ver) &&
        /Both checks read the change since the feature's base, which only `finish --run` hands the launcher: a run reported over MCP names none \(the MCP run hint says so\), nor does a `--compact` report\./.test(log) &&
        !/a full report, without --compact, names the findings below the gate/.test(ver + log),
      reasonless: /`eslint-disable` … with no reason that names no rule, or a whole-file one with no reason even when it names its rules; one with a reason is only counted\) — are ONE finish warning/.test(ver) &&
        /The user decides each: a pruning they approved stays; a suppression they intended gets a reason; otherwise fix it and run the check again\./.test(ver) &&
        /`eslint-disable` … with no reason that names no rule, or a whole-file one with no reason even when it names its rules; one with a reason is only counted\) in ONE warning/.test(log) &&
        !/a suppression with its reason\)|or naming no rule|or names its rule/.test(ver + log),
      noteKeepsHead: /and the suppressions check while a `guardian-suppressions: ` note says it left changed files unread/.test(log),
    });
  }

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
    // 1.42 (S13): the root-cause phase instruments each boundary, and nothing said to take the instrumentation out. Each instrument
    // line is tagged DEBUG-<slug>, removed before the fix's run, and the Checkpoint asks for it gone — by `git grep -n`, which EXITS 1
    // when it finds nothing: the prose says "prints nothing", never "passes" / "succeeds". /spec-bugfix's step 6 says it too. The legacy
    // four-task sentence (tick 1 and 2 with a note) stays word for word: the plan note's investigation exemption rests on it (UX-02).
    // Review 1 (R1-TASKS-05): the search is `git grep -n --untracked -E 'DEBUG-<slug>([^[:alnum:]_-]|$)'` — a plain git grep skipped a
    // file created while tracing, and `DEBUG-login` matched another bugfix's `DEBUG-login-crash` (`-w` too: a hyphen is a word
    // boundary); /spec-bugfix's step 3 (the root cause, also the MCP prompt) tells the agent to tag. Mutations: G1 --untracked dropped
    // · G2 the boundary dropped (or `-w`) · G3 step 3's tag sentence dropped.
    // Review 2 (R2-TASKS-02): `--untracked` also read the feature's own uncommitted bug.md, whose Root Cause quotes the tagged
    // output as its evidence — "prints nothing" then asked to delete the approved evidence. A pathspec leaves every `.specs/`
    // folder out: `':(exclude,glob)**/.specs/**'` (any depth — the ruled `:(top,exclude).specs` is anchored at the git root and
    // missed a monorepo subproject's app/.specs, run from app/). The documented command is RUN below on both layouts.
    // Mutations: G4 the pathspec dropped · G5 the top-anchored pathspec · G6 the pathspec dropped from the Checkpoint only.
    {
      const s13Ref = dWs(dRef("bugfix.md")), s13Cmd = dWs(dRead("commands", "spec-bugfix.md"));
      const fixStep = (s13Ref.match(/4\. \*\*Fix\*\* \(task 2\)\.[\s\S]*?(?=\*\*Checkpoint:\*\*)/) || [""])[0], checkpoint = (s13Ref.match(/\*\*Checkpoint:\*\*.*?Close with/) || [""])[0];
      const step3 = (s13Cmd.match(/3\. \*\*Root cause with evidence\*\*.*?4\. \*\*STOP/) || [""])[0];
      const step6 = (s13Cmd.match(/6\. \*\*Fix the cause\*\*.*?7\. \*\*Close\*\*/) || [""])[0];
      const grep = (tag) => "`git grep -n --untracked -E 'DEBUG-<" + tag + ">([^[:alnum:]_-]|$)' -- ':(exclude,glob)**/.specs/**'` prints nothing";
      all("1.42 S13: the bugfix instrumentation is tagged DEBUG-<slug>, removed before the fix's run and gone at the Checkpoint (`git grep -n --untracked` with a tag boundary, every folder named .specs left out by pathspec — a code folder of that name too, said —, prints nothing — never 'passes'); /spec-bugfix steps 3 and 6 say so, step 6's command on one line; the four-task sentence is kept (got " +
        JSON.stringify([fixStep, checkpoint, step3, step6]) + ")", {
        "phase 2 tags each instrument line": /instrument each boundary once and run it[^.]*\.[^.]*Tag every instrument line `DEBUG-<slug>`/.test(s13Ref),
        "phase 4 removes it before task 2's run (G1, G2, G4)": fixStep.includes("Remove the instrumentation before task 2's run: " + grep("slug")),
        "the Checkpoint asks for it gone (G1, G2, G4, G6)": checkpoint.includes(grep("slug")),
        "/spec-bugfix step 3 tags (G3)": /tag every instrument line you add `DEBUG-<feature>`/.test(step3),
        "/spec-bugfix step 6 (G1, G2, G4)": /remove the instrumentation first, every line tagged `DEBUG-<feature>`/.test(step6) && step6.includes(grep("feature")),
        // review 3 (R3-TASKS-04): the namesake said — the pathspec leaves out a CODE folder named .specs too
        "bug.md's quoted evidence is said to stay, a code folder named .specs said to be left out": /the pathspec leaves out every folder named `\.specs`, a code folder of that name too — `bug\.md`'s quoted evidence is no instrument line, so it stays/.test(fixStep) &&
          /and so does every folder named `\.specs`, a code folder of that name too — `bug\.md`'s quoted evidence is no instrument line\)/.test(step6),
        // review 3 (R3-TASKS-05): /spec-bugfix step 6's command on ONE line of the MCP prompt's markdown — a line-by-line copy that
        // stopped at `--` ran a complete command, the one without the pathspec
        "/spec-bugfix step 6's command on one line": dRead("commands", "spec-bugfix.md").split(/\r?\n/).some((l) => l.includes("`git grep -n --untracked -E 'DEBUG-<feature>([^[:alnum:]_-]|$)' -- ':(exclude,glob)**/.specs/**'`")),
        "never 'passes' / 'succeeds' for the search": ![s13Ref, s13Cmd].some((t) => /git grep -n[^`]*DEBUG-<(?:slug|feature)>[^`]*`? (?:passes|succeeds|returns 0)/.test(t)),
        "no bare or -w search left": ![s13Ref, s13Cmd].some((t) => /git grep -n (?:-w )?DEBUG-</.test(t)),
        "the four-task sentence, word for word": s13Ref.includes("(A bugfix scaffolded before this had four tasks — 1 reproduce, 2 root cause, 3 the red test, 4 the fix; it stays valid as it is: tick 1 and 2 with a note, `dev-spec done <f> 1 --evidence \"…\"`, once `bug.md` holds them.)"),
      });
      // The Checkpoint's command, RUN as written (its words, the quoted ones unquoted, <slug> → login) from the project root, on a
      // project at the git root and on a monorepo subproject (app/): bug.md, uncommitted, quotes `DEBUG-login:` (the approved
      // evidence — never listed), a file made while tracing holds the instrument line (listed), another bugfix's
      // `DEBUG-login-crash` stays out; with the probe gone it prints nothing and exits 1. Nothing is committed (no hook, no identity).
      const s13Cmdline = (checkpoint.match(/`(git grep [^`]*)`/) || [])[1] || "";
      const s13Argv = (s13Cmdline.match(/'[^']*'|\S+/g) || []).map((w) => w.replace(/^'|'$/g, "").replace(/<slug>/g, "login"));
      if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) skip("1.42 review 2 (R2-TASKS-02) the documented DEBUG search, run", "git not available");
      else {
        // the developer's own git config stays out (review 3, R3-TASKS-03: a global `grep.fullName` or `color.ui = always` changed the
        // listed names, a global excludes file could hide the probe) — an empty global config, HOME and XDG_CONFIG_HOME in tmp, as
        // 09-evidence-guardian.js's git rows do
        const s13Cfg = path.join(tmp, "s13-gitconfig");
        fs.writeFileSync(s13Cfg, "");
        const s13Env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: s13Cfg, HOME: tmp, XDG_CONFIG_HOME: tmp, GIT_TERMINAL_PROMPT: "0" };
        const s13Git = (cwd, ...a) => spawnSync("git", ["-c", "core.autocrlf=false", ...a], { cwd, encoding: "utf8", env: s13Env });
        const s13Layout = (name, sub) => {
          const repo = path.join(tmp, "s13-grep-" + name), proj = sub ? path.join(repo, sub) : repo;
          fs.mkdirSync(path.join(proj, ".specs", "login"), { recursive: true });
          fs.mkdirSync(path.join(proj, "src"), { recursive: true });
          s13Git(repo, "init", "-q");
          fs.writeFileSync(path.join(proj, "crash.js"), "console.log(\"DEBUG-login-crash: trace\");\n");
          s13Git(repo, "add", "-A");
          fs.writeFileSync(path.join(proj, ".specs", "login", "bug.md"), "# Bug: login\n\n## Root Cause\nauth.js:1 reads p.length. Evidence: `DEBUG-login: p=undefined at auth.js:1`.\n");
          fs.writeFileSync(path.join(proj, "src", "probe.js"), "console.log(\"DEBUG-login:\", p);\n");
          const run = () => { const r = s13Git(proj, ...s13Argv.slice(1)); return [r.status, (r.stdout || "").split(/\r?\n/).filter(Boolean).map((l) => l.replace(/:.*$/, ""))]; };
          const found = run();
          fs.unlinkSync(path.join(proj, "src", "probe.js"));
          return [found, run()];
        };
        const s13Plain = s13Layout("plain", ""), s13Mono = s13Layout("mono", "app");
        const s13Want = JSON.stringify([[0, ["src/probe.js"]], [1, []]]);
        all("1.42 review 2 (R2-TASKS-02): the Checkpoint's DEBUG search, run as written from the project root, lists the instrument line of a file made while tracing and never the uncommitted bug.md's quoted evidence nor another bugfix's longer tag — at the git root and in a monorepo subproject; once removed it prints nothing (got " +
          JSON.stringify({ argv: s13Argv, plain: s13Plain, mono: s13Mono }) + ")", {
          command: s13Argv[0] === "git" && s13Argv[1] === "grep" && s13Argv.includes("--untracked") && s13Argv.indexOf("--") > 1,
          plain: JSON.stringify(s13Plain) === s13Want,
          monorepo: JSON.stringify(s13Mono) === s13Want,
        });
      }
    }
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
      ["spec-finish step 1: run it again after a protected test's accept", finishCmd, /After a protected test's accept \(or a lift\), run step 1 again \(`spec_finish \{name, write: true\}`\): the merge summary then lists the accept and no longer names the test as changed — the one written before it still does\. 2\. \*\*Verify fresh/],
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
      // (1.38.0: the cap 10,000 → 12,000 — §2 takes the capture matrix, CRIT_X D1)
      ["ui-review: no reference → the floor alone, ledgered, never passed; the file ≤ 12,000 bytes", R,
        /\*\*No reference → the floor alone\*\* \(§2\): ledger `Task N: ui review — floor only \(no reference\)` and say at the checkpoint that the look was never compared with a design\. It is never "passed"\./,
        () => bytes("skills", "dev-spec-driven", "references", "ui-review.md") <= 12000],
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
      // (1.38.0: the line moved to ui-responsive.md → Checking it, CRIT_X D1 / D2)
      ["ui-responsive: mobile in one line — the text size closest to 200 %, Android pseudo-locales only where enabled", ws(refRaw("ui-responsive.md")),
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
      // (1.38.0 Z: the cap re-pinned 60,000 → 48,000 — CRIT_X D1: the code scan and the UI checks moved to ui-code-scan.md,
      // Responsiveness to ui-responsive.md; the state matrix grew in place — 43,814 bytes at the docs pass)
      ["ui-design-patterns: the checklist — 13 References kept, 14 Motion appended, the worst case and the contract; the file ≤ 48,000 bytes", checklist,
        /13\. \*\*References\*\*/, /14\. \*\*Motion\*\*/, /and the worst case/, /a New \/ Extend component's contract/,
        () => bytes("skills", "dev-spec-driven", "references", "ui-design-patterns.md") <= 48000],
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

  { // 1.38.0 D — items 3 and 4's prose (DECISIONS "D", CRIT_3 must-fix 7, CRIT_4 must-fixes 7–11): ui-responsive.md's
    // content, the state matrix grown IN PLACE in ui-design-patterns.md (the template's 16 labels, the Announced · focus
    // column, what doctor's ui-states reads), ui-review.md §2's capture matrix (each designed state at one width, the worst
    // case at every breakpoint, ≤ 6 widths, the dispatch split) and the critic / reviewer / checklist / index clauses. The
    // 1.37 UI prose block's form: ONE assertion per prose rule, each failing with its rule undone (chain D's mutation pass)
    // and failing on F0 (8b4ece4a). The state labels and the matrix's a11y header are read from the template's source
    // (i18n's quality.uiState*, by their English-stable ids), the UI rule ids and doctor's steering check from the engine.
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const refRaw = (f) => raw("skills", "dev-spec-driven", "references", f);
    const bytes = (...p) => fs.statSync(path.join(root, ...p)).size;
    const sectionOf = (text, head) => {
      const lines = text.split("\n"), at = lines.findIndex((l) => l.startsWith(head)), level = (head.match(/^#+/) || [""])[0].length;
      if (at < 0) return "";
      const end = lines.findIndex((l, i) => i > at && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level);
      return ws(lines.slice(at, end < 0 ? lines.length : end).join("\n"));
    };
    // a table under a line that starts with `after` (the first table past it): its header cells and its rows' cells
    const tableAfter = (text, after) => {
      const lines = text.split("\n"), at = lines.findIndex((l) => l.startsWith(after));
      const h = at < 0 ? -1 : lines.findIndex((l, i) => i > at && l.startsWith("|"));
      const cells = (l) => l.split("|").slice(1, -1).map((c) => c.trim());
      const rows = [];
      for (let i = h + 2; h >= 0 && i < lines.length && lines[i].startsWith("|"); i++) rows.push(cells(lines[i]));
      return { head: h < 0 ? [] : cells(lines[h]), rows };
    };
    const Q = require(path.join(root, "mcp", "lib", "i18n.js")).msg("en").quality;
    const L = Q.uiStateLabels || {}, labels = Object.values(L);
    const RS = ws(refRaw("ui-responsive.md")), R = ws(refRaw("ui-review.md")), Praw = refRaw("ui-design-patterns.md");
    const P = ws(Praw), states = sectionOf(Praw, "## The states every view needs"), checklist = sectionOf(Praw, "## Design checklist");
    const matrix = tableAfter(Praw, "## The states every view needs"), capture = tableAfter(refRaw("ui-review.md"), "**What to capture, per view**");
    const rowOf = (id) => ws((matrix.rows.find((r) => r[0] === "**" + L[id] + "**") || []).join(" | "));
    const item = (n) => (checklist.match(new RegExp(" " + n + "\\. (.*?)(?= " + (n + 1) + "\\. \\*\\*|$)")) || ["", ""])[1];
    const C = ws(raw("agents", "spec-critic.md")), V = ws(raw("agents", "spec-reviewer.md")), T = ws(refRaw("track-checklists.md"));
    const I = ws(refRaw("index.md")), uiRules = raw("mcp", "lib", "engine", "ui-checks.js"), doctorSrc = raw("mcp", "lib", "engine", "doctor.js");
    // (1.38.0 Z) the engine the corrected rows run their examples through: a project whose ui.md holds `text` → its breakpoints
    const Eng = require(path.join(root, "mcp", "lib", "engine", "index.js"));
    let bpN = 0;
    const bpOf = (text) => {
      const d = path.join(tmp, "z138-bp-" + ++bpN);
      fs.mkdirSync(path.join(d, ".specs", "steering"), { recursive: true });
      fs.writeFileSync(path.join(d, ".specs", "steering", "ui.md"), "# UI\n\n" + text + "\n");
      return Eng.loadLazyTier().breakpointsReport(d, null);
    };
    const rows = [
      // references/ui-responsive.md — item 3's prose (ITEM_3 §6 as CRIT_3 and the DECISIONS cut it)
      ["responsive: the design says per view what changes at each of the project's breakpoints", RS,
        /The design says, per view, what changes at each of the project's breakpoints — columns, navigation, what moves or hides\./],
      // (1.38.0 Z: corrected to engine/breakpoints.js — the first source with a width ≥ 320 decides, ui.md's FIRST line outside
      // code and comments, its slot unread, a bare number's unit, thousands, 200 characters; a top-level @theme, `partial` as
      // the resets say; past six; who prints them; the values not read — each example below run through breakpointsReport)
      ["responsive: where the widths come from — the first source with a width ≥ 320: ui.md's first line, a top-level Tailwind 4 @theme, else the default set; ≤ 6, 320 first; who prints them, what is not read — as breakpoints.js reads them", RS,
        /from the first of these that gives a width of 320 px or more: 1\. `\.specs\/steering\/ui\.md`'s first `- Breakpoints:` line outside code and comments — the lengths before its first ` · ` that no length follows \(`320 · 390 · 768 px`, as `dev-spec design-system` prints them, is one list; ` · text expansion` ends it — a note after the widths starts with a word, ` · max width 1200 px`, and a name before a width ends the list: write `640 \(sm\) · 768 \(md\)`, not `sm 640 · md 768` \(640 alone\); px, or rem \/ em at 16 px; a bare number takes the unit written after it, `360 \/ 768 \/ 1280 px`; `1,440` is one width\), its first 200 characters; the stub's own `\[…\]` slot is never read, so an untouched stub falls through — your widths written inside its brackets are, and any other bracket is an aside, never a width \(`480 \/ 960 px \[1200 in print\]` is 480 and 960\);/,
        // (1.39, BS-2: under partial the theme's own widths first, the default set fills the places left in its order)
        // (1.39: + the Sass map)
        // (1.40: + the `@custom-media` alias list, a source of its own after them — read only when they give no width)
        /2\. a top-level Tailwind 4 `@theme` block's `--breakpoint-\*` in a stylesheet the code scan reads \(unless the sheets reset them — `--breakpoint-\*: initial` or `--\*: initial` —, Tailwind keeps its own five too, which are not read: the default set fills the places the theme's widths leave — list them all in ui\.md to choose\), and a top-level Sass map whose name ends in `breakpoints` \(`\$grid-breakpoints`, `\$breakpoints`, an override in `@use … with \(…\)`\) in a \.scss sheet the scan reads — a plain assignment over a `!default` one; 3\. the width edges of the top-level `@custom-media` rules in a stylesheet the scan reads — `\(min-width: 48rem\)` is 768, `\(max-width: 767px\)` too, a `width` range either way round: an alias list is never the whole set, so the default set fills its places as a theme's; 4\. the default set: 320 · 390 · 768 · 1024 · 1440 px\./,
        /At most six widths, 320 first \(the reflow width\) — past six, the narrowest five and the widest, the rest said; where the default set fills a theme's or an alias list's places, it comes in the order 768, 1024, 1440, 390, and only where room is left — list the widths in ui\.md's line to choose them\./,
        /`dev-spec design-system <feature>` prints them and where they came from \(without a feature too, and `spec_scan \{designSystem: true\}` in both shapes\), and lists a value it could not read \(`calc\(\)`, `var\(\)`, wider than 3840 px, `map-merge\(…\)`\) with its place — write the widths in ui\.md's line then\./,
        () => {
          const got = (line) => { const r = bpOf(line); return [r.from, r.widths.join(" "), r.unread.map((u) => u.value).join("|"), r.limits.map((l) => l.code).join(",")].join(" / "); };
          // (1.38.0 review 1: the printed list read whole, a filled bracket unread; review 2: a theme's declared 1600 the one left out
          // beside the default set, R2-BS-1 — a note led by a number read as a width, a name before a width ending the list, R2-BS-2 / 3)
          const lazy = Eng.loadLazyTier(), css = "@theme inline {\n  --breakpoint-3xl: 1600px;\n  --breakpoint-4xl: 2000px;\n}\n", w = lazy.breakpointWatch();
          lazy.styleTokens(css, "a.css", w.on("a.css", css));
          const theme = lazy.breakpointsReport(path.join(tmp, "z138-bp-none"), w.found);
          return got("- Breakpoints: 360 / 768 / 1,440 px · text expansion") === "ui.md / 320 360 768 1440 /  / "
            && got("- Breakpoints: 320 · 390 · 768 px · text expansion") === "ui.md / 320 390 768 /  / "
            && got("- Breakpoints: 360 / 768 / 1280 px · max width 1200 px") === "ui.md / 320 360 768 1280 /  / "
            && got("- Breakpoints: 360 / 768 / 1280 px · 1200 px max width") === "ui.md / 320 360 768 1200 1280 /  / "
            && got("- Breakpoints: 640 (sm) · 768 (md)") === "ui.md / 320 640 768 /  / " && got("- Breakpoints: sm 640 · md 768") === "ui.md / 320 640 /  / "
            && got("- Breakpoints: [576 / 768 / 992 px] · text expansion") === "ui.md / 320 576 768 992 /  / " // (1.39, BS-6)
            && got("- Breakpoints: 480 / 960 px [1200 in print]") === "ui.md / 320 480 960 /  / "
            && theme.widths.join(" ") === "320 768 1024 1440 1600 2000" && theme.limits.length === 0 // (1.39, BS-2)
            && got("- Breakpoints: [360 / 768 / 1280 px] · text expansion") === "default / 320 390 768 1024 1440 /  / "
            && got("- Breakpoints: 240 / 300 px") === "default / 320 390 768 1024 1440 /  / "
            && got("- Breakpoints: 30 / 48 / 80 rem") === "ui.md / 320 480 768 1280 /  / "
            && got("- Breakpoints: 400 / 500 / 600 / 700 / 800 / 900 / 1000 px") === "ui.md / 320 400 500 600 700 1000 /  / breakpoint-widths"
            && got("- Breakpoints: 360 / 768 / 5000 px") === "ui.md / 320 360 768 / 5000 px / "
            && got("```\n- Breakpoints: 500 px\n```\n<!-- - Breakpoints: 550 px -->\n- Breakpoints: 600 px") === "ui.md / 320 600 /  / ";
        },
        () => { // (1.39) the Sass map's claims, through the scan: a plain map over the vendored `!default` one (custom.scss, a sheet
          // the scan opens by name), a `with` override, `map-merge(…)` listed unread, `_config.scss` (no name the scan opens) not read
          const proj = (tag, files) => { const d = path.join(tmp, "z139-bp-" + tag); for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), text); } return S.designSystemReport(d).breakpoints; };
          const vars = "$grid-breakpoints: (\n  xs: 0,\n  sm: 576px,\n  md: 768px\n) !default;\n";
          const plain = proj("plain", { "scss/_variables.scss": vars, "scss/custom.scss": "$grid-breakpoints: (xs: 0, sm: 600px, md: 900px);\n", "scss/_config.scss": "$breakpoints: (tv: 3000px);\n" });
          const withIt = proj("with", { "scss/custom.scss": "@use 'bootstrap' with (\n  $grid-breakpoints: (\n    xs: 0,\n    md: 900px\n  )\n);\n" });
          const merge = proj("merge", { "scss/_variables.scss": vars, "scss/custom.scss": "$grid-breakpoints: map-merge($grid-breakpoints, (xxl: 1600px));\n" });
          return plain.from === "code" && plain.widths.join(" ") === "320 600 900" && withIt.widths.join(" ") === "320 900"
            && merge.from === "default" && merge.unread.map((u) => u.value).join("|") === "map-merge($grid-breakpoints, (xxl: 1600px))";
        },
        () => { // (1.40) the `@custom-media` claims, through the scan: `(min-width: 48rem)` and `(max-width: 767px)` are 768, a range
          // either way round; a lone alias is no whole set — the default set fills, from code; beside a theme the rules are not
          // read (the theme's widths alone); in `media.css` (no name the scan opens) not read
          const proj = (tag, files) => { const d = path.join(tmp, "z140-bp-" + tag); for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), text); } return S.designSystemReport(d).breakpoints; };
          const cm = (...r) => r.map((x) => "@custom-media " + x + ";\n").join("");
          const edges = ["(min-width: 48rem)", "(max-width: 767px)", "(width >= 48rem)", "(767px < width)"].map((q) => Eng.loadLazyTier().mediaEdges(q).px.join(""));
          const lone = proj("lone", { "src/index.css": cm("--md (min-width: 48rem)") });
          const beside = proj("beside", { "src/index.css": cm("--sm (min-width: 600px)") + "@import \"tailwindcss\";\n@theme {\n  --breakpoint-*: initial;\n  --breakpoint-md: 50rem;\n}\n" });
          const file = proj("file", { "src/media.css": cm("--sm (min-width: 600px)"), "src/index.css": "body { margin: 0; }\n" });
          return edges.every((e) => e === "768") && lone.from === "code" && lone.partial === true && lone.widths.join(" ") === "320 390 768 1024 1440"
            && beside.from === "code" && beside.widths.join(" ") === "320 800" && beside.partial === false && file.from === "default";
        }],
      ["responsive: what is never read, and the lines to paste into ui.md (Tailwind's defaults, Bootstrap 5)", RS,
        // (1.40: + an `@custom-media` rule in a file the scan does not open by name)
        /A framework's own defaults \(in its package\), Tailwind 3's `screens` \(a JS config\) and a map or an `@custom-media` rule in a file the scan does not open by name \(`_config\.scss`, `_settings\.scss`, `media\.css`\) are never read: paste the line into ui\.md instead/,
        /- Tailwind's defaults: `- Breakpoints: 640 \/ 768 \/ 1024 \/ 1280 \/ 1536 px`/, /- Bootstrap 5: `- Breakpoints: 576 \/ 768 \/ 992 \/ 1200 \/ 1400 px`/],
      // (1.39.0 review 1, BU-2 / BU-3 — prose, D1 / D2: the two Sass shapes the reader reads as designed but the prose did not say —
      // each claim run through the scan: a map of maps gives the default set and nothing unread; two `!default` maps of one name unite)
      ["responsive: a map of maps is neither read nor listed; two `!default` maps of one name both count — ui.md's line chooses", RS,
        /A map of maps \(Bulma's `"mobile": \("until": \$tablet\)`, a hand-written `'small': \(min-width: 767px\)`\) is neither read nor listed: paste its widths into ui\.md's line\./,
        /Two `!default` maps of one name \(a library copy beside your own\) both count: list the widths in ui\.md's line to choose them\./,
        () => {
          const proj = (tag, files) => { const d = path.join(tmp, "z139r1-bp-" + tag); for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), text); } return S.designSystemReport(d).breakpoints; };
          const nested = proj("nested", { "src/styles/custom.scss": "$breakpoints: (\n  'small': (min-width: 767px),\n  'large': (min-width: 1200px)\n) !default;\n" });
          const twice = proj("twice", { "public/lib/bootstrap/scss/_variables.scss": "$grid-breakpoints: (xs: 0, sm: 576px, md: 768px) !default;\n", "src/scss/_variables.scss": "$grid-breakpoints: (xs: 0, sm: 600px, md: 960px) !default;\n" });
          return nested.from === "default" && nested.unreadTotal === 0 && twice.from === "code" && twice.widths.join(" ") === "320 576 600 768 960";
        }],
      ["responsive: editing the line re-flags approved designs — doctor's steering check, by its engine id", RS,
        /editing the line makes doctor warn `steering-changed-since-approval` on approved designs — on purpose/,
        () => doctorSrc.includes('"steering-changed-since-approval"')],
      ["responsive: container queries — a component answers to its own width", RS, /`container-type: inline-size` on the wrapper, `@container \(min-width: 30rem\)` in the component/],
      ["responsive: the intrinsic grid — one column at 320 px, no media query, min(100%, …) against overflow", RS,
        /`grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 16rem\), 1fr\)\)` holds as many columns as fit, one at 320 px, with no media query; the `min\(100%, …\)` keeps a column from overflowing a narrower box\./],
      ["responsive: fluid type — a token with a rem term; viewport units alone fail 1.4.4 (F94), the UI check by its engine id", RS,
        /A fluid size is a \*\*token\*\* with a rem term: `--text-3xl: clamp\(1\.75rem, 1\.2rem \+ 2vw, 2\.5rem\)`\. The rem part grows when the user zooms or sets a larger font; viewport units alone don't — WCAG 1\.4\.4, failure F94, the UI check `font-size-viewport`/,
        () => /"font-size-viewport": "warn"/.test(uiRules)],
      ["responsive: the largest size ≤ 2.5 × the smallest, credited to Maxwell Barvian", RS,
        /Keep the largest size at most \*\*2\.5 ×\*\* the smallest: the browser's zoom can then still double the text at any window width \(Maxwell Barvian, Smashing Magazine, 2023\)\./],
      ["responsive: which unit for what — rem text, % / fr layout, dvh / svh sections, px borders; a convention; the units table", RS,
        /\| Text, and the space that grows with it \| `rem` \(`em` inside a component\) \| follows the user's font size and zoom \|/, /\| Borders, hairlines, shadows \| `px` \| stays crisp \|/,
        /A convention, not a WCAG rule: px-only text still zooms in every current browser — it only ignores the user's default font size\./,
        /Write the team's choice in `design-system\.md`'s units table, which the code scan compares the code with \(\[ui-code-scan\.md\]\(ui-code-scan\.md\)\)\./],
      // (1.39: "the visual review measures the sideways scroll instead" was false — its captures hide scrollbars, as
      // ui-review.md's capture line still writes: nothing measures it, the reader checks one by hand)
      ["responsive: 100vw and the classic scrollbar — 100 % in flow, a fixed overlay fine, no check and nothing measures it (the captures hide scrollbars); Chrome 145's condition", RS,
        /an in-flow box at `width: 100vw` is a scrollbar wider than the page — a sideways scroll\. Use `100%` there\./,
        /A fixed overlay \(`position: fixed; inset: 0`\) or a decoration its parent clips is fine, so no check flags `100vw` — and the visual review's captures hide scrollbars \(`--hide-scrollbars`, Playwright's headless default\), so nothing measures it: check an in-flow `100vw` box yourself at a desktop size, scrollbars shown\./,
        { not: /measures the sideways scroll instead/ }, () => /`chrome --headless=new --hide-scrollbars/.test(R),
        /Chrome 145 subtracts the scrollbar from `vw` only where the root reserves its room \(`scrollbar-gutter: stable`, `overflow-y: scroll`\) — Bramus Van Damme, bram\.us, 2026\./],
      ["responsive: 100vh on a phone — svh / dvh / lvh, the 100vh; 100dvh pair, min-height harmless", RS,
        /`svh` is the smallest viewport, `dvh` follows the toolbars \(relaid out as they move\), `lvh` the largest\./,
        /A full-height app shell: `height: 100vh; height: 100dvh;`/, /`min-height: 100vh` only lets a box grow — harmless unless something is pinned to its bottom\./],
      ["responsive: 2.5.8 — the 24-px circle, and its other exceptions", RS,
        /2\.5\.8 \(AA\) accepts a target under 24 × 24 CSS px when a 24-px circle centred on it touches no other target and no other small target's circle/,
        /exempts a control whose function another one on the page offers at full size, a link inside a sentence, a size the browser sets and a size that is essential\./],
      ["responsive: pointer and hover media queries; never an action only hover reaches", RS,
        /`@media \(pointer: coarse\)` — a finger is the main pointer: larger targets and gaps\. `@media \(hover: hover\)` — hover effects only where the main pointer hovers; `any-pointer` \/ `any-hover`/,
        /Never an action that only hover reaches\./],
      ["responsive: safe areas — viewport-fit=cover, env(safe-area-inset-*) never under the padding; never maximum-scale (zoom-disabled)", RS,
        /`viewport-fit=cover` in the viewport meta/, /`padding-bottom: max\(1rem, env\(safe-area-inset-bottom\)\)`/,
        /Never `maximum-scale=1` or `user-scalable=no` in that meta: they block zoom \(1\.4\.4 — the UI check `zoom-disabled`\)\./, () => /"zoom-disabled": "warn"/.test(uiRules)],
      ["responsive: images — srcset and sizes, picture, aspect-ratio", RS, /`srcset` with the widths you have and `sizes` that says the layout/, /`<picture>` where a layout wants another crop, `width` \/ `height` or `aspect-ratio` so nothing shifts as it loads/],
      ["responsive: tables at small widths — a labelled, focusable scroll box or stacked rows; what is around it reflows; never a column hidden silently", RS,
        /1\.4\.10 excepts content that needs two dimensions, not what is around it: the heading, the search and the pagination still reflow\./,
        /`<div role="region" aria-labelledby="orders-title" tabindex="0">` with `overflow-x: auto`, so a keyboard user can scroll it\./,
        /Never hide a column silently at a width: say it is hidden and how to show it\./],
      ["responsive: orientation — no lock (F97), no rotate message (F100), unless essential", RS,
        /Never lock the page to portrait or landscape \(1\.3\.4, AA — failure F97\), and never ask the user to rotate the device \(F100\), unless one orientation is essential/],
      ["responsive: zoom — 400 % of 1280 px is 320 CSS px; 1.4.12's spacing clips nothing", RS,
        /400 % zoom of a 1280-px window lays the page out at 320 CSS px: the reflow width is what a desktop user who zooms gets, not only a phone/,
        /a 1\.5 line height, paragraphs 2 × the font size apart, letters 0\.12em and words 0\.16em \(1\.4\.12\) clips nothing/],
      ["responsive: inputs — type, inputmode, autocomplete, enterkeyhint; 16 px so iOS does not zoom, never maximum-scale", RS,
        /`enterkeyhint` \(`search`, `send`, `next`\) names the Enter key\./, /Inputs take a font of at least 16 px: iOS Safari zooms into a smaller one on focus — never cured with `maximum-scale=1`\./],
      ["responsive: checking it — the worst case at every width, the other states at one (ui-review.md → 2)", RS,
        /The visual review captures each view's worst case at every width above, measured, and its other states at one \(\[ui-review\.md\]\(ui-review\.md\) → 2\)\./],
      ["responsive: credited to Vercel's Web Interface Guidelines; the file ≤ 12,000 bytes", RS,
        /After Vercel's Web Interface Guidelines \(MIT\) for the 16-px inputs, the safe areas and the target sizes\./,
        () => bytes("skills", "dev-spec-driven", "references", "ui-responsive.md") <= 12000],
      // references/ui-review.md §2 — the capture matrix of items 3 and 4 (CRIT_X D1) and §3's split (CRIT_3 must-fix 7)
      ["ui-review: what to capture per view — states plus widths, never every state at every width, never an n/a state", R,
        /\*\*What to capture, per view\*\* — its states plus its widths, never every state at every width; a state the matrix answers `n\/a` is never captured:/],
      ["ui-review: each designed state at one width — the reference's, else 320 — a pair where the reference shows it", () =>
        JSON.stringify(capture.rows[0]) === JSON.stringify(["Each designed state", "one: the reference's; no reference, 320", "a pair where the reference shows it, else a build capture judged on the floor"])],
      // (1.38.0 review 1, R1-DOC2: `floor-320` only for a view with no reference — the floor's own scope, §3's pair-or-floor rule;
      // a view with a reference keeps `--w320--build.png`, a pair where a 320 reference exists)
      ["ui-review: the worst case at every breakpoint, named by width, its .json; at 320 floor-320 for a view with no reference", () =>
        JSON.stringify(capture.rows[1]) === JSON.stringify(["The worst case", "each of the project's breakpoints", "`<view>--worst--w<width>--build.png` and its `.json`; at 320, `floor-320` for a view with no reference"])
          && JSON.stringify(capture.head) === JSON.stringify(["What", "Width", "Captured as"])],
      ["ui-review: the widths — ≤ 6, 320 first, their sources, the CLI that prints them; scale 1 above 320; a pair by its ref; a sideways scroll a Blocker", R,
        /\*\*Widths:\*\* the project's breakpoints, at most 6, 320 first — ui\.md's `- Breakpoints:` line, else the code's, else 320 · 390 · 768 · 1024 · 1440; `dev-spec design-system <feature>` prints them \(\[ui-responsive\.md\]\(ui-responsive\.md\) → The project's breakpoints\)\./,
        /Scale 1 above 320; a `--w<width>--ref\.png` beside a capture makes it a pair\. Each has its `\.json`, as the floor's do: a measured sideways scroll at any width is a Blocker\./],
      ["ui-review: each state through its data boundary; the script waits for its own element; never the default page", R,
        /a delayed response for Slow network, a 409 \/ 412 for Conflict, a 404 route for Not found, an invalid submit for Form validation, the moment after a delete for Undo\./,
        /The script waits for the state's own element \(its text or role\) before the shot; a state it can't reach is `not captured \(no data boundary\)`, never shot as the default page\./],
      ["ui-review: Announced · focus never judged from an image — each state's fixture asserts it", R,
        /\*\*Announced · focus is never judged from an image:\*\* each state's fixture test asserts it — the live region's role and text, a focus assertion/],
      ["ui-review: a view past 16 images — its states, then its widths, in dispatches of their own", R,
        /At most 16 images a dispatch, the `\.prev\.png` counted — past that, one per view; a view past that alone: its states, then its widths, in dispatches of their own\./],
      ["ui-review: On mobile moved to ui-responsive.md, a pointer left", R, /On mobile: \[ui-responsive\.md\]\(ui-responsive\.md\) → Checking it\./,
        { not: /On mobile: the smallest supported width/ }],
      ["ui-review: the worst case's name at a breakpoint", R, /`<view>--worst--build\.png` \(`--w768--` in the name at a breakpoint, below\)/],
      // references/ui-design-patterns.md — the state matrix in place (item 4, CRIT_4 must-fixes 7–11)
      ["ui-design-patterns: the matrix's rows are the template's labels in order, its header the template's State and a11y cells", () =>
        labels.length === 16 && JSON.stringify(matrix.rows.map((r) => r[0])) === JSON.stringify(labels.map((l) => "**" + l + "**"))
          && JSON.stringify(matrix.head) === JSON.stringify([Q.uiStateHead, "When", "What the user sees", Q.uiStateA11y, "Common mistake"])
          && matrix.rows.every((r) => r.length === 5 && r.every((c) => c.length > 0))],
      ["ui-design-patterns: Slow network — a status and Cancel; a timeout is Error", () =>
        /a "still working" message where the result will appear, and \*\*Cancel\*\*; a timeout becomes Error \| the message as a status; focus stays/.test(rowOf("slow-network"))],
      ["ui-design-patterns: Not found — said in the title and h1; announced by the route announcer or focus to the h1", () =>
        /the title and h1 say so, with a way on \(search, the list\) \| announced: the framework's route announcer, or focus to the h1/.test(rowOf("not-found"))],
      ["ui-design-patterns: Conflict — Reload or Keep mine, input kept; one mechanism", () =>
        /what changed, and \*\*Reload\*\* or \*\*Keep mine\*\* — the user's input kept \| an alert; focus stays on the action — one mechanism, never both/.test(rowOf("conflict"))],
      ["ui-design-patterns: Undo — until dismissed or a second home; focus to the next item, never lost", () =>
        /the item gone, and \*\*Undo\*\* until dismissed — or a second home \(the trash\) \| a status; focus to the next item, never lost to `<body>`/.test(rowOf("undo"))],
      ["ui-design-patterns: Form validation — focus to the summary on submit; a field's message tied to it, focus kept", () =>
        /on submit, focus to the summary; on leaving a field, its message tied to it \(`aria-describedby`\), focus not moved/.test(rowOf("form-validation"))],
      // (1.38.0 Z: the two rows below corrected to quality.js's reader — a row's n/a among its VIEW cells, the label in any
      // language and never after a word, a state's rows together, a dash / TBD open, EVERY anchored table, the columns from the
      // a11y one on unjudged, an untouched scaffold and an n/a section passing — each example run through the engine)
      ["ui-design-patterns: the matrix in design.md — the views between State and Announced · focus, n/a — why, a row's n/a among its view cells", states,
        /a column per view between `State` and `Announced · focus` — name the `View` column after the first view and add one per other view \(a screen, a route, a dialog; a component's own states belong to its contract\)\./,
        /or `n\/a — why` in four words or more; an `n\/a — why` alone among a row's view cells answers every view\./],
      ["ui-design-patterns: what doctor's ui-states reads — labels in any language, open cells, every anchored table, the a11y column on unjudged; a warn at m / l / no size, a note at s, never a gate — as uiStateMatrix reads them", states,
        /Doctor's `ui-states` finds each state by its label, in any of the plugin's languages — a qualifier after it is fine \(`Error — payment`, `Errors`\), a word before it is not \(`Network error`\), and a state's rows in one table count together — and warns about a state with no row and each cell left open \(blank, a dash, a `\[slot\]`, `TBD`, an `n\/a` without its four words\)/,
        /at size m \/ l or with no size; a note at size s; never a refusal, never part of a gate, never on a finished feature\./,
        /It reads every table of the section whose header holds `Announced · focus` \(in any of those languages\) — each a matrix of its own, a row per state in each: two tables never share their rows — and never judges that column or one after it — the critic does; a prose matrix is not checked, and an untouched scaffold or an `n\/a` section passes\./,
        // (1.38.0 review 1, BS-3: the gate refuses the untouched matrix, never a TBD one; review 2, R2-DOC2: only in a section left
        // as the template — a line written, its TODO gone, passes the untouched matrix too — sectionState below)
        /The design gate at size m \/ l refuses a UI States section left as the template \(its matrix untouched — a view column added or deleted, the table reformatted — and nothing else written\); once a line of it is written \(its TODO line gone\), an untouched matrix passes the gate as a `TBD` \/ dash one does — `ui-states` is what warns about each open cell\./,
        () => {
          const ids = ["loading", "error", "empty-first-use", "offline", "success", "stale", "partial"];
          const m = Eng.uiStateMatrix("# Design\n\n## [UI] UI States\n\n| " + Q.uiStateHead + " | Checkout | " + Q.uiStateA11y + " | Notes |\n|---|---|---|---|\n"
            + "| Errors | the error and Retry | an alert | |\n| Loading | — | | |\n| Loading (skeleton) | a skeleton | | |\n| Empty — first use | TBD | | |\n"
            + "| Offline | n/a — no network use here at all | a status | |\n| Success | n/a — no | | |\n| Stale | — | | |\n| Partial | [what the user sees] | | |\n\n"
            + "| State | Checkout | Announced · focus |\n|---|---|---|\n| Network error | the error | |\n\n"
            + "| Estado | Checkout | Anunciado · foco |\n|---|---|---|\n| A carregar | o esqueleto | |\n", ids);
          const gaps = (t) => t.gaps.map((g) => g.code + ":" + g.id).join(" ");
          const scaffold = (() => { const p = path.join(tmp, "z138-states"); S.initProject(p, ["ui"], "en"); return fs.readFileSync(path.join(S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" }).dir, "design.md"), "utf8"); })();
          // the scaffold's matrix, a view column added (untouched: the template's) or every view cell TBD (written: the gate passes it,
          // ui-states warns)
          const sec = Eng.trackSectionTable("ui").find((s) => s.name === "UI States"), bare = scaffold.replace(/^> \*\*TODO\*\*[^\n]*\n/gm, "");
          const gate = (design) => Eng.sectionState(design, [sec], Eng.trackMarker("ui"), { size: "m", lang: "en" })[0].status;
          const head = "| " + Q.uiStateHead + " | " + Q.uiStateView + " | " + Q.uiStateA11y + " |\n|---|---|---|";
          const added = bare.replace(head, "| " + Q.uiStateHead + " | Orders | " + Q.uiStateView + " | " + Q.uiStateA11y + " |\n|---|---|---|---|").replace(/^(\| [^|\n]+ )\| \| \|$/gm, "$1| | | |");
          const tbd = bare.replace(/^(\| [^|\n]+ )\| \| \|$/gm, "$1| TBD | |");
          const line = (d) => d.replace("## [UI] UI States\n", "## [UI] UI States\nThe checkout, built against design/checkout.png.\n");
          return m.tables.length === 3 && gaps(m.tables[0]) === "open:empty-first-use open:success open:stale open:partial"
            && m.tables[1].gaps.some((g) => g.code === "no-row" && g.id === "error") && !m.tables[2].gaps.some((g) => g.id === "loading")
            && m.tables[1].gaps.some((g) => g.code === "no-row" && g.id === "loading")
            && Eng.uiStatesCheck(scaffold, "en", { size: "m" }).status === "pass" && Eng.uiStatesCheck("# Design\n\n## [UI] UI States\n\nn/a — this feature has no screens at all\n", "en", { size: "m" }).status === "pass"
            && gate(bare) === "template" && bare.includes(head) && added.includes("| Orders |") && gate(added) === "template"
            && tbd !== bare && gate(tbd) === "filled" && Eng.uiStatesCheck(tbd, "en", { size: "m" }).status === "warn"
            && line(bare) !== bare && gate(line(bare)) === "filled" && Eng.uiStatesCheck(line(bare), "en", { size: "m" }).status === "warn"
            && line(scaffold) !== scaffold && gate(line(scaffold)) === "unfilled";
        }],
      ["ui-design-patterns: 4.1.3 — a live region before its text, no focus move; W3C's 5-errors example after an unsuccessful fill", states,
        /through a live region that exists before its text changes, without moving focus \(4\.1\.3\)/,
        /W3C's own example is "5 errors on page", added after an unsuccessful fill of a form\./, { not: /5 errors on page"?,? (?:shown |added )?after a submit/ }],
      ["ui-design-patterns: one mechanism a row — a message that takes focus is a change of context", states,
        /A message that takes focus is a change of context instead, so each row picks one mechanism — a live region, or focus moved, never both\./],
      ["ui-design-patterns: where focus moves — the next item, the trigger (2.4.3), the summary; never lost to <body>", states,
        /Focus moves when its place goes away or the user must act: to the next item after a delete, back to the trigger when a dialog closes \(2\.4\.3\), to the summary on a failed submit — never lost to `<body>`\./],
      ["ui-design-patterns: 2.4.11 — never entirely hidden; partly covered passes AA, Enhanced is AAA", states,
        /never hides the focused element entirely \(2\.4\.11 — partly covering it still passes AA; Focus Not Obscured \(Enhanced\), AAA, asks for none of it covered\)/,
        { not: /never covers (?:the )?focus/ }],
      ["ui-design-patterns: 2.2.1 per W3C's example — a timed message is a time limit only when nothing else shows it", states,
        /A message that disappears on a timer is a time limit \(2\.2\.1\) only when nothing else shows the same: W3C's example, a new-mail notice gone after 5 s, is none because the inbox shows the mail/,
        /an Undo that leaves with its toast needs a second home \(the trash\), or stays until dismissed\./],
      ["ui-design-patterns: Undo is one of 3.3.4's three ways — a confirm-dialog design writes its row", states,
        /Undo is one of 3\.3\.4's three ways for a delete \(reversible, checked, confirmed\): a design that confirms in a dialog instead writes that in its Undo row, not n\/a\./],
      ["ui-design-patterns: each state's fixture through a mocked response, asserting its announcement and focus by property", P,
        /reached through a mocked response \(a delay, a 404, a 409\)/,
        /Each asserts its row's Announced · focus: the live region's role and text, and where focus is, with a focus assertion \(Playwright's `toBeFocused`, Cypress's `have\.focus`/],
      ["ui-design-patterns: checklist 2 — a column per view, every template state, n/a — why, announced and focus", () =>
        /^\*\*The state matrix\*\* — a column per view, a row per state: .*empty \(first use and no results\).*and the worst case — each designed or `n\/a — why`, with how it is announced and where focus goes\.$/.test(item(2))
          && labels.filter((l) => !/—/.test(l) && l !== L["worst-case"]).every((l) => item(2).includes(" " + l.toLowerCase()))],
      ["ui-design-patterns: checklist 4 — the project's breakpoints and what each view changes at each", () =>
        /^\*\*Layout\*\* — the project's breakpoints and what each view changes at each \(\[ui-responsive\.md\]\(ui-responsive\.md\)\)/.test(item(4))],
      ["ui-design-patterns: where the decisions go — the matrix's shape, what each view changes per breakpoint", P,
        /the \*\*state matrix\*\* \(a row per state, a column per view\)/, /what each view changes per breakpoint, the accessibility plan/],
      ["ui-design-patterns: the visual review — each state at one width, the worst case at each breakpoint", P,
        /in the same state and settings \(each at one width, the worst case at each breakpoint\)/],
      // the critic, the reviewer, the checklists, the index (CRIT_X D7.7: items 3 and 4 in one edit; Z adds item 2's line)
      ["spec-critic: every listed state designed or n/a, how each is announced, where focus goes — the worst-case phrase kept", C,
        /and the worst case — each field's realistic extreme and where its limit comes from; every listed state designed or n\/a with a reason, how each is announced and where focus goes\)/],
      ["spec-critic: what each view changes at the project's breakpoints", C, /say what each view changes at the project's breakpoints, cover i18n, and set a Core Web Vitals budget\./],
      ["spec-reviewer: every state handled, with the announcement and focus its row names", V,
        /every state of the design's state matrix handled, with the announcement and focus its row names;/],
      ["track-checklists: Phase 2 — Responsiveness & i18n says what each view changes per breakpoint", T,
        /Responsiveness & i18n \(what each view changes at the project's breakpoints — `references\/ui-responsive\.md`\)/],
      ["track-checklists: Phase 2 — the matrix: a column per view, n/a — why, announced and focus", T,
        /The matrix: a column per view, a row per state — each designed or `n\/a — why`, with how it is announced and where focus goes\./],
      ["track-checklists: Phase 3 — each state a fixture asserting its announcement and focus; the worst case at each breakpoint", T,
        /\(each state a fixture asserting its announcement and focus; a contract's states as fixtures, its keys as component tests\)/,
        /on the floor where it has none, the worst case at each breakpoint \(`references\/ui-review\.md`\)/],
      ["index: ui-review's line — what to capture per view", I, /what to capture per view \(each state at one width, the worst case at every breakpoint\)/],
      ["index: ui-responsive's line — its contents", I,
        /`references\/ui-responsive\.md` \(the project's breakpoints and the lines to paste, layouts without breakpoints, fluid type, which unit for what, viewport units, reflow at 320 px, zoom and text size, touch targets and pointers, safe areas, images, tables, orientation, inputs\)/],
      ["index: ui-design-patterns' line — how each state is announced and where focus goes", I, /motion, how each state is announced and where focus goes, WCAG 2\.2 AA/],
      // (1.38.0 review 1, R1-DOC3: each README's +ui paragraph names what 1.38 added, in its language — the project's UI checks
      // and their `_UI checks off:_` switch, the scale's token, the breakpoints, doctor's ui-states and its note at s; the marker,
      // the check id and the note read from the engine. R1-DOC4: quality.md's level rule — the reports, the project inventory
      // too; finish only for `warn` — each UI_RULES id under its own level's clause)
      ...[["README.md", /Without a feature, `dev-spec design-system` also inventories the project's UI checks, counted per rule over every view and style file \(a line `_UI checks off: <rule-id> \(reason\)_` in design-system\.md switches one off everywhere\), a feature's report names the token of the project's scale that a raw colour, font or timing already is, and both end in the project's breakpoints, the widths the visual review captures\./,
          /`doctor`'s `ui-states` warns \(a note at size s\) when the design's state matrix gives a state no row or leaves a view's cell open\./],
        ["README.pt.md", /Sem uma feature, o `dev-spec design-system` faz também o inventário das verificações de interface do projeto, contadas por regra em todos os ficheiros de vista e de estilos \(uma linha `_UI checks off: <rule-id> \(motivo\)_` no design-system\.md desliga uma em todo o lado\), o relatório de uma feature indica, para cada cor, fonte ou temporização fixa, o token da escala do projeto que ela já é, e os dois acabam nos breakpoints do projeto, as larguras que a revisão visual captura\./,
          /O `ui-states` do `doctor` avisa \(uma nota no tamanho s\) quando a matriz de estados do design deixa um estado sem linha ou a célula de uma vista por preencher\./],
        ["README.es.md", /Sin una funcionalidad, `dev-spec design-system` hace también el inventario de las comprobaciones de interfaz del proyecto, contadas por regla en todos los ficheros de vista y de estilos \(una línea `_UI checks off: <rule-id> \(motivo\)_` en design-system\.md desactiva una en todas partes\), el informe de una funcionalidad nombra, para cada color, fuente o temporización fijos, el token de la escala del proyecto que ya es, y los dos terminan en los breakpoints del proyecto, los anchos que captura la revisión visual\./,
          /El `ui-states` de `doctor` avisa \(una nota en el tamaño s\) cuando la matriz de estados del diseño deja un estado sin fila o la celda de una vista sin rellenar\./]]
        .map(([f, ...res]) => [f + ": the +ui paragraph — the project's UI checks, `_UI checks off:_`, the scale's token, the breakpoints, doctor's ui-states (a note at s)", ws(raw(f)), ...res,
          () => /const RE_DS_MARKER = .*\|UI checks off\)/.test(raw("mcp", "lib", "engine", "quality.js")) && /const UI_STATES_CHECK = "ui-states";/.test(raw("mcp", "lib", "engine", "quality.js")),
          () => {
            const open = "# Design\n\n## [UI] UI States\n\n| " + Q.uiStateHead + " | Checkout | " + Q.uiStateA11y + " |\n|---|---|---|\n| " + L.loading + " | TBD | |\n";
            return Eng.uiStatesCheck(open, "en", { size: "s" }).state === "small" && Eng.uiStatesCheck(open, "en", { size: "s" }).status === "pass"
              && Eng.uiStatesCheck(open, "en", { size: "m" }).status === "warn";
          }]),
      ["quality.md (maintainers): UI checks → Rules — warn: the reports and finish's warning; report: the reports alone, never finish; each UI_RULES id under its level", () => {
        const lines = raw("docs", "maintainers", "quality.md").split("\n"), at = lines.findIndex((l) => l.startsWith("## UI checks"));
        const r = at < 0 ? -1 : lines.findIndex((l, i) => i > at && l.startsWith("- **Rules**"));
        const e = r < 0 ? -1 : lines.findIndex((l, i) => i > r && /^- \*\*/.test(l));
        const rule = r < 0 ? "" : ws(lines.slice(r, e < 0 ? lines.length : e).join("\n"));
        const [warnPart, reportPart] = rule.split("`report` — ");
        const levels = [...((uiRules.match(/const UI_RULES = \{([^}]*)\}/) || ["", ""])[1]).matchAll(/"([a-z-]+)": "([a-z]+)"/g)].map((m) => [m[1], m[2]]);
        return /`warn` — the reports \(a feature's, the project inventory\) and finish's warning, never a blocker:/.test(warnPart)
          && /^the reports alone, never finish:/.test(reportPart || "") && levels.length >= 7
          && levels.every(([id, level]) => (level === "warn" ? warnPart : reportPart).includes("`" + id + "`") && !(level === "warn" ? reportPart : warnPart).includes("`" + id + "`"));
      }],
    ];
    const cond = (text, c) => c instanceof RegExp ? () => c.test(text) : typeof c === "function" ? c : () => !c.not.test(text);
    const condName = (c, i) => c instanceof RegExp ? "matches " + c.source.slice(0, 70) : typeof c === "function" ? "check " + i : "never " + c.not.source.slice(0, 60);
    for (const [label, text, ...checks] of rows) {
      const cs = typeof text === "function" ? [text] : checks;
      all("1.38 UI prose — " + label, Object.fromEntries(cs.map((c, i) => [condName(c, i), cond(text, c)])));
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
      ["ui-code-scan: the UI checks — what is never judged, its bounds the engine's", () => /A doubt is never judged: a named paste handler, a click whose content holds a control, a component \(an icon or a text component too; a bound Vue `<component :is>` in it is none\) or a slot, or no text \(an icon or an image alone\), a spread/.test(checks)
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
      // (1.38.0 Z: `_UI checks off:_` joins the English markers — the units table's `Property` the first header cells)
      ["steering-templates: `_Deprecated:_` among the English markers, and its bullet", () =>
        /\(`_Token sources:_`, `_Libraries:_`, `_From:_`, `_Deprecated:_`, `_UI checks off:_`\): they are what the engine reads/.test(S)
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
      // (1.39.0: ui-code-scan.md's cap 30,000 → 32,000 — the pinned "What the code scan reads" table is 64 % of it, and the file
      // is read on demand from index.md's +ui line alone; 1.39's scan prose — deprecated uses, the script search — needs the room)
      caps: () => bytes("ui-code-scan.md") <= 32000 && bytes("ui-responsive.md") <= 12000,
      index: () => /`references\/ui-code-scan\.md`/.test(uiLine) && /`references\/ui-responsive\.md`/.test(uiLine)
        && /component contracts, UI states and the worst case, forms and interaction details, motion/.test(uiLine),
      tooling: () => /What the scan reads and what it doesn't: `references\/ui-code-scan\.md`/.test(tool),
    });
  }

  { // 1.39.0 A — deprecated uses' prose (DECISIONS A 5 / Shared 1, CRIT_X D1): ui-code-scan.md's LAST section says what the project
    // report's `deprecatedUses` reads and what it does not (CRIT_1 must-fix 6: a namesake's importers count, a non-component export
    // or a type through a barrel is not seen); ui-design-patterns.md's Later row and steering-templates.md's `_Deprecated:_` bullet
    // point to it. A bound or a code a clause names is read from the engine's source. ONE assertion per clause.
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const ref = (f) => ws(raw("skills", "dev-spec-driven", "references", f));
    const C = ref("ui-code-scan.md"), DP = ref("ui-design-patterns.md"), ST = ref("steering-templates.md");
    const DS = raw("mcp", "lib", "engine", "design-system.js"), EN = require(path.join(root, "mcp", "lib", "i18n.js")).msg("en").quality.dsDepUsesNote;
    const head = "### Deprecated components the code still imports", section = C.slice(C.indexOf(head));
    const shown = (DS.match(/const DS_DEP_SHOWN = (\d+);/) || [])[1];
    // (the note's "Not seen" list, as the engine words it — the docs' list is the same, in the same order)
    const unseen = ((EN.match(/Not seen: (.*?)\. No import found/) || [])[1] || "").split(/, (?![^(]*\))/).map((x) => x.replace(/ \(.*\)$/, "").replace(/ reached /, " ").replace(/import\(\)/, "`import()`").replace(/\.ts file/, "`.ts` file"));
    const rows = [
      ["ui-code-scan: the deprecated uses are the file's last section", () => C.indexOf(head) > 0 && !section.slice(head.length).includes("### ")],
      ["ui-code-scan: the files that still import a row — the first DS_DEP_SHOWN by path, all counted", () => shown && section.includes("(`files`, the first " + shown + " by path; `filesTotal`)")],
      ["ui-code-scan: the replacement as doctor names it (dsReplacement, one expression)", () => section.includes("its replacement as doctor names it (`use`)") && /use: dsReplacement\(/.test(DS) && /dsReplacement\(opts\.registry, r\.key, names\)/.test(raw("mcp", "lib", "engine", "quality.js"))],
      ["ui-code-scan: a namesake's importers count (CRIT_1 must-fix 6)", () => section.includes("its component files (`paths` — a namesake's importers count too)")],
      // (review 1 of 1.39: a row a component folder's index names is located — the wording says what is true, as the CLI's does)
      ["ui-code-scan: unlocated — no component file whose importers the scan reads (CRIT_1 must-fix 4)", () => section.includes("`unlocated`: rows whose name no component file the scan reads gives — a .tsx / .jsx / .js / .vue / .svelte / .astro file or a component folder's index (a library's, an Angular or a Blade one)")],
      // (1.40: then the rows only rendered with no import — `unbound` —, before the rest: R2-DEP-2 d)
      ["ui-code-scan: the rows still imported first, then those only rendered (review 1 of 1.39, 1.40)", () => section.includes("for each such row the code holds a component file for — the rows still imported first, then those only rendered —,")],
      // (1.40, R3-DEP-4: `import type X from` the row's file counts too — the exception is gone)
      ["ui-code-scan: a row named by its file is its module — any import of it, type-only too", () => section.includes("A row named by its file is its **module** — any import of it counts (renamed, default, type-only, `require`, a non-component export, a namespace's member, an SFC with or without its extension)")],
      ["ui-code-scan: …and its components through `export *` and a component folder's barrel", () => section.includes("and its components, followed through `export *` and a component folder's barrel")],
      ["ui-code-scan: a component a file exports beside its own counts by its name", () => section.includes("a component a file exports beside its own counts by its **name**")],
      ["ui-code-scan: an .mdx / .vue tag no import binds counted apart (RE_UNBOUND_FILE)", () => section.includes("An .mdx / .vue tag no import binds is counted apart (`unbound`)") && DS.includes("const RE_UNBOUND_FILE = /\\.(?:mdx|vue)$/i;")],
      // (review 1 of 1.39: the list's sixth, a tag an auto-import names by its folder — Nuxt's <BaseCard>)
      ["ui-code-scan: what is not seen — the note's list (CRIT_1 must-fixes 1, 6)", () => unseen.length === 6 && section.includes("Not seen (its `note`): " + unseen.join(", ") + ".") && section.includes("Nuxt's `<BaseCard>` is such a tag")],
      ["ui-code-scan: no import found is not unused", () => section.includes("**No import found is not unused.**")],
      ["ui-code-scan: its limits never the report's (usage-files, deprecated-follow)", () => section.includes("Its `limits` (`usage-files`, `deprecated-follow`) never touch the report's `limits` or `inSync`.")
        && DS.includes("code: \"usage-files\"") && DS.includes("code: \"deprecated-follow\"")],
      ["ui-design-patterns: the Later row — per `_Deprecated:_` row, the files that still import it", () => DP.includes("Per `_Deprecated:_` row, it lists the files that still import it ([ui-code-scan.md](ui-code-scan.md)). |")],
      ["steering-templates: the `_Deprecated:_` bullet — the project report lists the files that still import it", () => ST.includes("write a retired variant or prop without the marker. `dev-spec design-system` lists the files that still import it.")],
    ];
    for (const [label, check] of rows) all("1.39.0 A docs — " + label + (label.includes("not seen") ? " (got " + JSON.stringify(unseen) + ")" : ""), { holds: check });
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
    all("1.38.0 F0c: ui-code-scan.md's UI checks name font-size-viewport (WCAG 1.4.4, failure F94), what keeps it certain (a stylesheet's size only when its file sizes no text conditionally, an element's own style attribute, a bare text-[…vw] with no size under a variant in its file — reviews 1 and 2 of 1.38) and what is not seen; tooling-reference's spec_scan row lists it among the warn rules", {
      criterion: () => /`font-size-viewport` \(text sized in viewport units alone.*?which zooming does not enlarge: WCAG 1\.4\.4, failure F94/.test(checks),
      sheet: () => /only when that file declares no font size inside `@media`, `@container`, `@supports` or a Sass `@include` \(nested too\)/.test(checks),
      inline: () => /an element's own `style` attribute, never a component's prop or a CSS-in-JS object \(`sx`, `css\(\)`, `style\(\)`\)/.test(checks),
      // (review 1 of 1.38: decided per FILE — the per-line test went; review 2: a SIZE under a variant, the prose's examples
      // through the engine — `md:text-6xl` silences the file's bare one, a colour or a key of the project's own does not)
      tailwind: () => {
        const T = require(path.join(root, "mcp", "lib", "engine", "index.js")).loadLazyTier();
        const bare = (v) => T.uiChecksOf(T.viewLines("<p class=\"text-[5vw]\">a</p>\n<p class=\"" + v + "\">b</p>\n", "a.html"), "a.html").findings.length;
        const said = checks.match(/a bare `text-\[…vw\]` only when its file holds no size under a variant \(`([^`]+)`; not a colour, nor a key of your own: `([^`]+)`\)/);
        return !!said && bare(said[1]) === 0 && bare(said[2]) === 1 && bare("dark:text-white") === 1;
      },
      notSeen: () => /An override in another file is not seen: silence that one\./.test(checks),
      tooling: () => /paste-blocked · font-size-viewport, `level` warn/.test(tool),
    });
  }

  { // 1.38.0 Z — the docs pass: ui-code-scan.md's 1.38 prose (the project's UI checks and the fact no-reduced-motion, the
    // `_UI checks off:_` marker, raw values against the scale, token values, the units table, DESIGN.md, the breakpoints and
    // doctor's ui-states pointers), test-patterns' test files and index.md's line — read against the engine's SOURCE: every
    // rule / fact id, limit code, bound and `why` code below comes from mcp/lib/engine/*.js, so one added, removed or changed
    // without the prose fails here (never a hand list). ONE assertion per prose clause: the docs pass's mutation pass drops each
    // clause in a copy and its row fails (%TEMP%/dsd-138-z/MUTATIONS.md).
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const eng = (f) => raw("mcp", "lib", "engine", f);
    const UC = eng("ui-checks.js"), DS = eng("design-system.js"), DV = eng("design-values.js"), BP = eng("breakpoints.js"), QY = eng("quality.js");
    // a constant's value as the source writes it — `5000`, `32 * 1024 * 1024`, `0.011` — and its prose spelling
    const num = (src, name) => { const m = src.match(new RegExp("const " + name + " = ([0-9.e* -]+);")); return m ? m[1].split("*").reduce((a, x) => a * Number(x.trim()), 1) : NaN; };
    const n = (v) => v.toLocaleString("en-US"); // 5000 → "5,000"
    const fnBody = (src, name) => { const at = src.indexOf("function " + name + "("); return at < 0 ? "" : src.slice(at, src.indexOf("\n}\n", at)); };
    const idsOf = (src, name) => [...(((src.match(new RegExp("const " + name + " = \\{([^}]*)\\}")) || [])[1] || "").matchAll(/"([a-z-]+)":/g))].map((m) => m[1]);
    const regexOf = (src, name) => { const m = src.match(new RegExp("const " + name + " = /(.*)/([a-z]*);")); return m ? new RegExp(m[1], m[2]) : /(?!)/; };
    const rules = idsOf(UC, "UI_RULES"), facts = idsOf(UC, "UI_FACTS");
    const pass = fnBody(UC, "uiProjectPass");
    // (the limit codes the inventory builds — a fact's `code` is a fact's, below)
    const passCodes = [...pass.matchAll(/code: "([a-z-]+)"/g)].map((m) => m[1]).concat(((pass.match(/for \(const code of \[([^\]]*)\]\)/) || [])[1] || "").match(/[a-z-]+/g) || [])
      .filter((c) => !facts.includes(c));
    const whys = [...((UC.match(/const why = [^\n]*/) || [""])[0]).matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    const kinds = DS.match(/for \(const kind of \[([^\]]*)\]\) if \(kindCut\[kind\]\) limits\.push\(\{ code: kind \+ "(-[a-z]+)"/) || [];
    const kindCodes = ((kinds[1] || "").match(/[a-z]+/g) || []).map((k) => k + kinds[2]);
    const bpCodes = [...BP.matchAll(/code: "([a-z-]+)"/g)].map((m) => m[1]);
    const B = { files: num(DS, "DS_UI_FILES"), chars: num(DS, "DS_UI_CHARS"), read: num(DS, "DS_READ_CHARS"), line: num(DS, "DS_LINE_MAX"), tag: num(UC, "DS_TAG_LINES"),
      sheets: num(UC, "DS_FOCUS_SHEETS"), entries: num(QY, "DS_MARKER_ENTRIES"), unitRows: num(QY, "DS_UNIT_ROWS"), perFile: num(DS, "DS_RAW_PER_FILE"), list: num(DS, "DS_LIST"),
      jnd: num(DV, "DS_JND"), hsl: num(DV, "DS_SAME_HSL"), cross: num(DV, "DS_SAME_CROSS"), alpha: num(DV, "DS_ALPHA"),
      motionFiles: num(DS, "DS_MOTION_SCRIPTS"), motionChars: num(DS, "DS_MOTION_CHARS") };
    const scanRaw = raw("skills", "dev-spec-driven", "references", "ui-code-scan.md"), scanLines = scanRaw.split("\n");
    const section = (head) => { const at = scanLines.findIndex((l) => l === head), end = scanLines.findIndex((l, i) => i > at && /^#+ /.test(l)); return at < 0 ? "" : ws(scanLines.slice(at, end < 0 ? scanLines.length : end).join("\n")); };
    const proj = section("### The project's UI checks"), scale = section("### Raw values against the project's scale");
    const offPara = (proj.match(/\*\*Off for the project\.\*\*.*$/) || [""])[0];
    const tick = (id) => "`" + id + "`";
    const TP = ws(raw("skills", "dev-spec-driven", "references", "test-patterns.md")), SC = eng("scan.js");
    const testDirs = (((SC.match(/const TEST_DIRS = new Set\(\[([^\]]*)\]\)/) || [])[1] || "").match(/"[a-z0-9_]+"/g) || []).map((d) => d.slice(1, -1));
    const uiLine = (ws(raw("skills", "dev-spec-driven", "references", "index.md")).match(/`references\/ui-code-scan\.md` \([^)]*\)/) || [""])[0];
    const E = require(path.join(root, "mcp", "lib", "engine", "index.js")), T = E.loadLazyTier();
    const STraw = raw("skills", "dev-spec-driven", "references", "steering-templates.md"), ST = ws(STraw);
    const DP = ws(raw("skills", "dev-spec-driven", "references", "ui-design-patterns.md"));
    // a registry holding `text`, read by the engine (quality.js designSystemRegistry)
    const regOf = (name, text) => {
      const d = path.join(tmp, "z138-reg-" + name, ".specs");
      fs.mkdirSync(path.join(d, "steering"), { recursive: true });
      fs.writeFileSync(path.join(d, "steering", "design-system.md"), "# Design System\n\n" + text);
      return E.designSystemRegistry(d);
    };
    const toolRow = raw("skills", "dev-spec-driven", "references", "tooling-reference.md").split("\n").find((l) => l.startsWith("| `spec_scan {designSystem: true}` |")) || "";
    // both report shapes on a project that fills every 1.38 part (a drifted token, a gone source, a units table with an
    // unread row, the marker with an applied and an unknown entry, raw colours exact and near, a font, a motion value, a
    // repeated value, an img-no-alt, motion declared and no reduced-motion mention) → the keys they return (`ok` aside: every
    // result's), each of which the row must name in a code span; `sane`: the fixture filled what it was built to fill
    const scanKeys = () => {
      const p = path.join(tmp, "z138-scan");
      S.initProject(p, ["ui"], "en");
      const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
      put(".specs/steering/design-system.md", "# Design System\n\n## Tokens\n_Token sources: src/styles/tokens.css, src/old/gone.css_\n\n| Token | Value | Use |\n|---|---|---|\n"
        + "| --brand | #1d4ed8 | primary |\n| --font-body | Inter, sans-serif | text |\n| --duration-fast | 150ms | hover |\n\n## Units\n| Property | Units |\n|---|---|\n| padding-* | rem |\n| spacing | small |\n\n"
        + "_UI checks off: transition-all (the kit animates on purpose), nope (x)_\n");
      put("src/styles/tokens.css", ":root {\n  --brand: #1e40af;\n}\n");
      put("src/checkout/Pay.tsx", "export function Pay() {\n  return <div className=\"p-[13px] text-[#1d4ed9]\" style={{ color: \"#1d4ed8\" }}><img src=\"a.png\" />Pay</div>;\n}\n");
      put("src/checkout/pay.css", ".pay {\n  font-family: Inter, sans-serif;\n  transition: transform 150ms ease;\n  color: #1d4ed8;\n}\n.all {\n  transition: all 200ms;\n}\n");
      // (1.42 B141-01: an outline removal a focus style excuses — the inventory's `excused`)
      put("src/checkout/reset.css", "*:focus {\n  outline: none;\n}\n");
      put("src/checkout/Ring.tsx", "export const Ring = () => <button className=\"focus-visible:ring-2\">ok</button>;\n");
      const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/_\n  - _Verify: npm test_\n");
      const pr = S.designSystemReport(p, { uiPass: true }), fr = S.designSystemReport(p, { name: f.slug });
      const keys = new Set(), add = (o) => { for (const k of Object.keys(o || {})) if (k !== "ok") keys.add(k); };
      const first = (list) => (list || [])[0];
      [pr, fr, pr.breakpoints, pr.unitsTable, pr.uiChecks, first(pr.drift), first(Object.values(pr.uiChecks.rules)), first(pr.uiChecks.facts), first(pr.uiChecks.off),
        first(pr.uiChecks.offIgnored), first(Object.values(pr.uiChecks.excused || {})), fr.counts, first(fr.groups), fr.units, first(fr.units && fr.units.findings), fr.uiChecks,
        first(fr.uiChecks.off)].forEach(add);
      for (const r of fr.raw || []) { add(r); if (r.near) add(r.near); }
      const sane = pr.drift.length === 1 && pr.gone.length === 1 && pr.unitsTable && pr.unitsTable.unread.length === 1 && pr.uiChecks.facts.length === 1
        && pr.uiChecks.off.length === 1 && pr.uiChecks.offIgnored.length === 1 && Object.keys(pr.uiChecks.rules).length >= 1
        && !!(pr.uiChecks.excused && pr.uiChecks.excused["outline-removed"])
        && ["font", "motion"].every((k) => fr.raw.some((r) => r.kind === k && r.token)) && fr.raw.some((r) => r.near) && fr.groups.length >= 1
        && fr.units && fr.units.findings.length >= 1 && fr.uiChecks.off.length === 1;
      return { keys: [...keys], missed: [...keys].filter((k) => !toolRow.includes("`" + k + "`")), sane };
    };
    const rows = [
      ["intro: what the file says — the scale, the units table, the project's checks, switching one off; the file ≤ 32,000 bytes (1.39.0's cap, the F0a row's)", () =>
        /what a raw value is against the project's own scale, the units table, and the UI checks it runs on a feature's view and style files and on the project's — and how a team switches one off\./.test(ws(scanRaw))
          && Buffer.byteLength(scanRaw, "utf8") <= 32000],
      ["inventory: both surfaces, the keys; counts, never a list, never finish", () =>
        /`spec_scan \{designSystem: true\}` \/ `dev-spec design-system` \(no feature\) also run the UI checks over the project's view and style files — an inventory, `uiChecks`: `read`, `total`, `silenced`, `byRule` and `rules` \(per rule its level, the files holding one, the first place\), `facts`, `limits`\./.test(proj)
          && /Counts, never a list, never a finish warning: each feature's report lists its own\./.test(proj)],
      ["opt-in: the tool and the CLI ask for it, the engine's default runs none — as operations.js and designSystemReport do", () =>
        /The tool and the CLI ask for it; the engine's own default runs none\./.test(proj) && /S\.designSystemReport\(dir, \{ name: o\.name, uiPass: true \}\)/.test(raw("mcp", "lib", "operations.js"))
          && /\.\.\.\(opts\.uiPass \? \{ uiChecks: uiProject\(scan, reg\) \} : \{\}\)/.test(DS)],
      ["bounds: the inventory's files / characters, a file's and a line's read, a tag's — every code uiProjectPass emits, its own limits", () =>
        passCodes.length === 5 && passCodes.every((c) => proj.includes(tick(c)))
          && proj.includes("at most " + n(B.files) + " files and " + B.chars / 1048576 + " MB (`" + passCodes[0] + "`, naming the outline removals it left unjudged)")
          && proj.includes("each file's first " + B.read / 1024 + "K and a line's first " + n(B.line) + " characters (`view-size`, `line-length`; a tag past " + B.tag + " lines, `tag-length` — each with a count and the first file)")
          && proj.includes("its own limits, never the report's `limits` or `truncated`")],
      // (review 1 of 1.38, UP-1: what the prose says of a long stylesheet is what uiProject feeds the pass)
      // (review 2 of 1.38, R2-UP-2 / R2-DOC1: counted there — the first file by path is named —, and fed no line, its focus
      // styles excuse nothing)
      ["a stylesheet past the read: counted in view-size, never checked, its focus styles excuse nothing — uiProject feeds it no line", () =>
        proj.includes("A stylesheet past " + B.read / 1024 + "K (a compiled bundle) is counted in `view-size`, never checked: its focus styles excuse nothing, so the inventory may warn of a removal a feature report excuses by them.")
          && /pass\.feed\(x\.rel, over && RE_STYLE_EXT\.test\(x\.rel\) \? \[\] : viewLines\(text, x\.rel\), over, text\)/.test(DS)],
      ["order: the stylesheets first, then the shorter path", () => /Stylesheets are read first, then the shorter path/.test(proj)],
      ["view files: no test, story, mock or fixture", () => /A test, a story, a mock or a fixture is no view file\./.test(proj)],
      ["outline-removed: the project-wide excuse, the removals past the focus search's sheets judged here, a cut pass judges none", () =>
        proj.includes("any focus style in any file read excuses every removal —, so the removals a feature report leaves unjudged past the project's first " + B.sheets + " stylesheets are judged here")
          && /a cut pass that read no focus style judges none\./.test(proj)],
      ["fact: every project fact id (UI_FACTS), WCAG 2.3.3 AAA, what declares motion", () =>
        facts.length >= 1 && facts.every((id) => proj.includes("The fact " + tick(id) + " (WCAG 2.3.3, AAA)"))
          && /the view files declare motion — an animation, a transform's transition, smooth scrolling — and none of the files read mentions reduced motion/.test(proj)],
      ["fact: each mention the prose names is one the engine reads (RE_REDUCED_ASK)", () => {
        const said = (proj.match(/mentions reduced motion \(([^)]*)\)/) || ["", ""])[1].match(/`[^`]+`/g) || [];
        const re = regexOf(UC, "RE_REDUCED_ASK");
        return said.length >= 4 && said.every((w) => re.test(w.slice(1, -1)));
      }],
      // (1.39, D6: the scripts are searched — the bounds from the source, the order and the filter the engine's: a test setup is
      // no test by name, so its mention counts)
      ["fact: said only when no view read was cut — the inventory's bound by its code; the scripts searched, a test setup's outside a test folder too (review 1 of 1.39, UC-4), their bounds and code", () =>
        proj.includes("Said only when no view read was cut (the walk, `" + passCodes[0] + "`, a file's " + B.read / 1024 + "K); a script's mention counts too — a test setup's outside a test folder included (" + n(B.motionFiles) + " by shorter path, " + B.motionChars / 1048576 + " MB: `" + passCodes[1] + "`).")
          && require(path.join(root, "mcp", "lib", "engine", "index.js")).loadLazyTier().isTestFile("src/test/setup.ts")
          && passCodes[1] === "motion-scripts" && /const more = scan\.scripts\.filter\(\(x\) => !isViewFile\(x\.rel\) && !isTestFile\(x\.rel\) && !RE_NOT_COMPONENT_FILE\.test\(x\.rel\)\)\.sort\(\(a, b\) => a\.rel\.length - b\.rel\.length \|\| order\(a, b\)\)/.test(DS)
          && ["jest.setup.js", "vitest.setup.ts", "playwright.config.ts", "src/setupTests.ts"].every((f) => !require(path.join(root, "mcp", "lib", "engine", "index.js")).loadLazyTier().isTestFile(f))],
      ["marker: `_UI checks off: <rule-id> (reason)_` — the label the registry reads (RE_DS_MARKER), an example entry a rule; off everywhere, counted never listed", () =>
        /\|UI checks off\)/.test((QY.match(/const RE_DS_MARKER = [^\n]*/) || [""])[0]) && offPara.includes("`_UI checks off: <rule-id> (reason)_`")
          && rules.includes(((offPara.match(/`_UI checks off: ([a-z-]+) \(/) || [])[1]))
          && /switches a UI check or a project fact off everywhere: the inventory, every feature report \(`off`: the rule, its reason, the findings it hid\) and so finish — counted, never listed \(an inline-silenced finding stays `silenced`\)\./.test(offPara)],
      ["marker: every `why` code uiOff gives (from its source), the entries bound", () =>
        whys.length === 4 && whys.every((w) => offPara.includes(tick(w))) && offPara.includes("one past the first " + B.entries + " entries is not applied")],
      ["marker: creating design-system.md for it enrols the project in the registry", () =>
        /Creating design-system\.md for the marker alone enrols the project in the registry: a written finish adds the feature's New components to it, and from its first component doctor's `ui-design-system` checks every design's rows against it \(a refusal at size m \/ l\) — without a registry, use the inline comment\./.test(offPara)],
      ["marker: what-input's modality rule — the inline comment, never the marker", () =>
        /A what-input modality rule \(`\[data-whatintent='mouse'\] \*:focus \{ outline: none \}`\) is judged as written: silence it with an inline `ui-check-off: outline-removed` on that rule — the marker would switch off every removal of the project\./.test(offPara)],
      ["colours: every notation the engine parses, the tolerances (design-values.js), alphas", () =>
        ((DV.match(/const RE_COLOR_CALL = \/\^\(([^)]*)\)/) || [])[1] || "").split("|").map((f) => f.replace(/a\?$/, "")).every((f) => scale.includes("`" + f + "()`"))
          && scale.includes("(`none` reads as 0)")
          && scale.includes("across two within the rounding of the pair as written (" + B.hsl + " ΔEOK with an HSL side, " + B.cross + " otherwise; an HSL side")
          && scale.includes("), alphas within " + B.alpha)],
      // (1.38.0 review 1, T1 / review 2, R2-T1) an HSL side against a hex / rgb by the pair's rounding both ways, its examples
      // as the engine judges them; the nearest token of several
      ["colours: an HSL side against a hex / rgb by the rounding both ways — the examples (judgeRaw); the nearest of several", () => {
        const j = (value, ...tok) => T.judgeRaw({ kind: "color", value }, T.tokenScale(tok.map(([name, v]) => ({ name, value: v })), []));
        return scale.includes("`token` names the token the value IS (the nearest of several), in any notation")
          && scale.includes("an HSL side against a hex or `rgb()` also both ways: the other in HSL rounds to its numbers or the HSL paints it, 8 bits a channel — `#05787d` is `hsl(183 92% 25%)`, `#eeeff2` `hsl(220 14% 94%)`, `#18181b` is not `hsl(0 0% 9%)`;")
          && j("#05787d", ["--a", "hsl(183 92% 25%)"]).token === "--a" && j("#eeeff2", ["--a", "hsl(220 14% 94%)"]).token === "--a"
          && !j("#18181b", ["--a", "hsl(0 0% 9%)"]).token && j("#18181b", ["--a", "hsl(240 5.9% 10%)"], ["--b", "#18181b"]).token === "--b";
      }],
      // (review 2, R2-T2) zinc's hexes are not the neutral in either notation — (1.40, R2-T2) nor its oklch() the hsl() one: an
      // HSL side against oklch / oklab by the written roundings, or one painting the other at 8 bits, both orders (the neutral's
      // own oklch is hsl(0 0% 9%); 1.38 review 2's #eeeff2 written as oklch is hsl(220 14% 94%))
      ["colours: an HSL side against oklch() / oklab() — the written roundings meet or one paints the other (meets), both orders; `near` — the nearest within the JND, a hint; zinc's hexes against the neutral, nor its oklch() the hsl() one; what is not parsed matches by text", () => {
        const j = (value, tok) => T.judgeRaw({ kind: "color", value }, T.tokenScale([{ name: "--a", value: tok }], []));
        const both = (x, y) => JSON.stringify([j(x, y).token, j(y, x).token]);
        return scale.includes("`#18181b` is not `hsl(0 0% 9%)`; against `oklch()` / `oklab()` the written roundings meet, or one paints the other at 8 bits), alphas within " + B.alpha)
          && scale.includes("`near` {`token`, `delta`} the nearest within " + B.jnd + " ΔEOK — a hint, never the token's colour (Tailwind's zinc hexes are not shadcn's neutral, nor its `oklch()` zinc the `hsl()` one)")
          && !j("#18181b", "hsl(0 0% 9%)").token && !j("#18181b", "oklch(0.205 0 0)").token
          && both("oklch(21% 0.006 285.885)", "hsl(0 0% 9%)") === "[null,null]" && j("oklch(21% 0.006 285.885)", "hsl(0 0% 9%)").near.token === "--a"
          && both("oklch(20.5% 0 0)", "hsl(0 0% 9%)") === "[\"--a\",\"--a\"]" && both("oklch(0.952 0.004 271.369)", "hsl(220 14% 94%)") === "[\"--a\",\"--a\"]"
          && /`hwb\(\)`, `lab\(\)`, `lch\(\)`, `color\(\)` and a named colour match by text alone\./.test(scale);
      }],
      ["fonts: a stack by its first family, against the registry rows' font tokens only", () =>
        /\*\*Fonts\*\* — a `font-family` stack ending in a generic family, by its first family, against the registry rows' font tokens only \(a code token's stack is never read; one ending in a named emoji font is no stack\)\. Read when the registry holds one\./.test(scale)],
      ["motion: literal times and the easing functions the engine reads (RE_EASING), Tailwind's arbitrary utilities, never a nearest", () =>
        ((DV.match(/const RE_EASING = [^\n]*?\(((?:[a-z-]+\|)+[a-z-]+)\)/) || [])[1] || "x").split("|").every((f) => scale.includes("`" + f + "()`"))
          && /a `transition` \/ `animation` declaration's literal times above 1 ms and easing functions/.test(scale)
          && /Tailwind's `duration-\[…\]` \/ `delay-\[…\]` \/ `ease-\[…\]`: `token` when each literal is a duration or easing token's, never a nearest\. Read when the scale holds such a token\./.test(scale)],
      ["sizes: raw, no size scale", () => /\*\*Sizes\*\* stay raw: no size scale is guessed\./.test(scale)],
      ["kinds: counts only when read, their own per-file bound and codes (design-system.js)", () =>
        kindCodes.length === 2 && scale.includes("`counts` gains `font` / `motion` only when read; each has its own bound, a file's first " + B.perFile + " (" + kindCodes.map(tick).join(" / ") + ", with the first file)")],
      ["groups: by what each value is — the example one group (groupKey) — the most frequent first, the first 50 and the total", () =>
        scale.includes("`groups`: the values read twice or more, by what each is (`#1E40AF`, `rgb(30 64 175)` and `text-[#1e40af]` are one; a utility without its variants), the most frequent first — the first " + B.list + ", `groupsTotal`.")
          && new Set(["#1E40AF", "rgb(30 64 175)", "#1e40af"].map((value) => T.groupKey({ kind: "color", value }))).size === 1],
      ["finish: colours and sizes alone", () => /Finish still counts colours and sizes alone\./.test(scale)],
      ["drift: the same notation — the examples never compared (tokenDrift), a name with two values skipped; the first 50", () =>
        scale.includes("The project report's `drift` (the first " + B.list + ", `driftTotal`) lists a registry token the code declares with another value IN THE SAME NOTATION")
          && /`#3b82f6` against `hsl\(217 91% 60%\)`, `16px` against `1rem` are not compared, nor a name the code declares with two values or more \(a theme, a twin sheet\)\./.test(scale)
          && T.tokenDrift("#3b82f6", "hsl(217 91% 60%)") === null && T.tokenDrift("16px", "1rem") === null && T.tokenDrift("150ms", "0.2s") === "quantity"],
      ["gone, and neither changes inSync", () => /`gone` lists the `_Token sources:_` files that no longer exist\. Neither changes `inSync`: it compares names\./.test(scale)],
      // (1.39, chain E: the table's shape moved to steering-templates.md — its row below reads the headers against the engine)
      ["units table: its shape and an example — a pointer to steering-templates.md", () =>
        scale.includes("**The units table** — the team's convention of which units each property takes, in design-system.md (its shape and an example: [steering-templates.md](steering-templates.md) → design-system.md).")],
      ["units: the feature report's findings and their keys, the first 50; a negative length counts, a Tailwind size in any unit (offUnit, RE_TW_UNIT — RE_TW_SIZE stays the raw values')", () => {
        // (1.39, 1.38.0 review 1's T2: what the units table judges, as the engine reads it)
        const tw = new RegExp(regexOf(DS, "RE_TW_UNIT").source), raw = new RegExp(regexOf(DS, "RE_TW_SIZE").source);
        return scale.includes("{`findings` — the first " + B.list + ": `file`, `line`, `property`, `value`, `unit`, `allowed` —, `total`, `byProperty`}")
          && /lists each declaration whose value takes, outside parentheses, a unit its row does not give \(never `0` or a unitless number; a negative length counts: `-8px`\), and a Tailwind arbitrary size in any unit \(`p-\[10px\]`, `-mt-\[12px\]`, `text-\[2vw\]`\) by the property it sets/.test(scale)
          && T.offUnit("0 -8px", ["rem"]) === "px" && T.offUnit("0 8px", ["rem"]) === "px" && T.offUnit("0", ["rem"]) === null && T.offUnit("1.5", ["rem"]) === null
          && ["p-[10px]", "-mt-[12px]", "text-[2vw]"].every((u) => tw.test(u)) && raw.test("p-[10px]") && !raw.test("-mt-[12px]") && !raw.test("text-[2vw]");
      }],
      ["units: the project's unitsTable and its rows bound; a report, never finish or doctor; the brief's own bound (DS_BRIEF_UNITS); no default", () =>
        scale.includes("The project report's `unitsTable` {`rows`, `unread`, `past` — rows past the first " + B.unitRows + "}.")
          && scale.includes("A report — never finish or doctor; a UI task's brief quotes its rows (their first " + n(num(QY, "DS_BRIEF_UNITS")) + " characters) — and no default: without the table both are null.")],
      ["DESIGN.md: not read; its own CLI's export to a token file", () =>
        /\*\*DESIGN\.md\*\* is not read; its own CLI writes a file that is: `npx @google\/design\.md export --format css-tailwind DESIGN\.md > theme\.css` \(a token file by its name\)\./.test(scale)],
      ["breakpoints: both reports, where they come from, every limit code breakpoints.js gives, never truncated", () =>
        bpCodes.length === 2 && bpCodes.every((c) => scale.includes(tick(c)))
          && /both reports end in `breakpoints`, the widths the visual review captures \(\[ui-responsive\.md\]\(ui-responsive\.md\) → The project's breakpoints\) — its own limits .* never make a report truncated\./.test(scale)],
      ["doctor's ui-states: the design's matrix, not the code — a pointer", () =>
        /\*\*Doctor's `ui-states`\*\* reads the design's state matrix, not the code \(\[ui-design-patterns\.md\]\(ui-design-patterns\.md\) → The states every view needs\)/.test(scale)
          && /const UI_STATES_CHECK = "ui-states";/.test(QY)],
      ["test-patterns: every test folder isTestFile reads (TEST_DIRS — Jest's __mocks__ / __fixtures__ too) and Cypress's *.cy.ts with the Welsh-locale caveat", () =>
        testDirs.length >= 12 && testDirs.every((d) => TP.includes("`" + d + "/`"))
          && /Cypress's `\*\.cy\.ts` — a Welsh-locale module named so reads as a test too —/.test(TP)
          && E.isTestFile("src/i18n/messages.cy.ts") && !E.isTestFile("src/i18n/strings.cy.json")],
      ["index: ui-code-scan's line names the project's checks, switching one off, the scale, drift and the units table", () =>
        /the UI checks it runs on a feature's files and the project's, switching one off, raw values against the scale, token drift, the units table\)/.test(uiLine)],
      // references/steering-templates.md (item 2): the units table's example and the marker's line — each READ by the engine
      ["steering-templates: `Property` among the first header cells kept as written", () =>
        /Keep the first header cell of each table \(`Token`, `Component`, `Property` — or their PT \/ ES forms\)/.test(ST)],
      ["steering-templates: the units table's example IS one to the registry's reader, under its PT / ES headers too; a report, never a default", () => {
        const block = (STraw.match(/The units table, under any heading \(PT `\| Propriedade \| Unidades \|`, ES `\| Propiedad \| Unidad \|`\):\n\n```markdown\n([\s\S]*?)```/) || [])[1] || "";
        const read = (head) => regOf("units-" + head.length, block.replace("| Property | Units |", head)).units;
        const all3 = ["| Property | Units |", "| Propriedade | Unidades |", "| Propiedad | Unidad |"].map(read);
        return all3.every((u) => u && u.rows.length === 3 && !u.unread.length && u.rows.every((r) => r.props.length && r.units.length))
          && /- A \*\*units table\*\* \(below\) is optional — the team's convention of which units each property takes: a report, never a default \(none is written for you\)\./.test(ST)
          && ST.includes("`spec_scan {designSystem: true, name}` lists a feature's declarations off it (`units`), `spec_scan {designSystem: true}` the rows it could not read (`unitsTable`), and a UI task's brief quotes its rows (their first " + n(num(QY, "DS_BRIEF_UNITS")) + " characters); never finish or doctor.")
          && /`margin-\*` covers `margin` and `margin-top`; a component's props table \(`\| Property \| Type \| Default \|`\) is none\./.test(ST);
      }],
      // (1.39, chain E — 1.38.0 review 1's T3): the headers the registry reads, as the engine reads them — the 1.38 tier (a header
      // that STARTS with Units / Unidades / Unidad), the word's (RE_DS_UNITS_WORD), no polarity (a column of units to avoid)
      ["steering-templates: the units table's headers (RE_DS_PROPERTY_HEAD, RE_DS_COL.units, RE_DS_UNITS_WORD) in EN / PT / ES; the units ALLOWED", () => {
        const heads = (ST.match(/Its first header cell is `Property` \(`([^`]+)`, `([^`]+)`\); its units column's header starts with `Units` \(`([^`]+)`, `([^`]+)`\) — else holds the word \(`([^`]+)`\) — and its cells list CSS units: the units each property is ALLOWED \(a column of units to avoid would read as allowed ones\)\./) || []).slice(1);
        const prop = regexOf(QY, "RE_DS_PROPERTY_HEAD"), unit = new RegExp(((QY.match(/units: \/(.*)\/i,/) || [])[1] || "(?!)"), "i"), word = regexOf(QY, "RE_DS_UNITS_WORD");
        const read = (head) => { const u = regOf("units-head-" + head.replace(/\W/g, ""), "| Property | " + head + " |\n|---|---|\n| gap | px |\n").units; return u && u.rows.map((r) => r.units.join()).join(); };
        return heads.length === 5 && ["Property", heads[0], heads[1]].every((h) => prop.test(h)) && ["Units", heads[2], heads[3]].every((h) => unit.test(h))
          && !unit.test(heads[4]) && word.test(heads[4]) && read(heads[4]) === "px" && read("Units to avoid") === "px";
      }],
      ["steering-templates: the marker's example line is applied (uiOff); counted never listed, finish silent; an entry not applied is said", () => {
        const line = (ST.match(/- `(_UI checks off: [^`]*_)`/) || [])[1] || "";
        const off = T.uiOff(regOf("marker", line + "\n"));
        return off.off.size === 1 && rules.includes([...off.off.keys()][0]) && !off.ignored.length
          && /switches a UI check off for the whole project: the project's report and every feature's count what it hides, never list it, and finish never warns about it\. An entry without its reason in parentheses, or naming no check or project fact, is not applied — the report says why\./.test(ST);
      }],
      ["steering-templates: the marker's cost — the registry it enrols; the inline comment without one", () =>
        /A design-system\.md written only for this line enrols the project in the registry \(doctor's `ui-design-system`, finish's New components\); without one, silence a single finding with the inline `ui-check-off:` comment/.test(ST)],
      // references/tooling-reference.md's spec_scan {designSystem} row (item 3): every key the two report shapes RETURN — read
      // from a report of each, on a project built to fill every 1.38 part — and every code above, named in the one row
      ["tooling-reference: the spec_scan {designSystem} row names every key both shapes return and every 1.38 code", () => {
        const { keys, missed, sane } = scanKeys();
        const codes = [...passCodes, ...kindCodes, ...bpCodes, ...facts, ...whys];
        return sane && keys.length >= 60 && !missed.length && codes.length >= 13 && codes.every((c) => toolRow.includes(c))
          && /the tool and the CLI ask for it, the engine's default runs none/.test(toolRow) && /never in it, and `gone` and the units table never change it either/.test(toolRow);
      }],
      // (item 5's reach: chain S's doctor entry, corrected to uiStateMatrix as ui-design-patterns.md is — the D block runs the examples)
      ["tooling-reference: doctor's ui-states — the anchor in any language, every anchored table, an n/a alone among a row's view cells, the a11y column and after unjudged", () => {
        const doc = ws(raw("skills", "dev-spec-driven", "references", "tooling-reference.md"));
        // (1.39: the header bound's clause between — the 1.39 Z block's row reads it)
        return /recognised by its `Announced · focus` header cell in any language(?: \([^)]*\))?, every such table of the section:/.test(doc)
          && /\(an n\/a alone among a row's view cells answers its row\); the a11y column and the ones after it are not judged, a matrix in prose is not checked\./.test(doc);
      }],
      // item 2's one-liners (DECISIONS "T"): the checklist, the reviewer, the implementer
      ["track-checklists: Phase 2 — a team's units convention declared once, as the registry's units table", () =>
        /A team with a convention for units declares it once, as `design-system\.md`'s units table \(`references\/ui-code-scan\.md`\)\./.test(ws(raw("skills", "dev-spec-driven", "references", "track-checklists.md")))],
      ["spec-reviewer: a raw value's `token` is the scale's; `near` a hint, never the token's colour", () =>
        /`token` names the scale's token the value is; `near` is a hint — a close colour, not the token's\) are \*\*candidates\*\*/.test(ws(raw("agents", "spec-reviewer.md")))],
      ["spec-implementer: each property in the units the registry's units table gives", () =>
        /When `design-system\.md` has a units table, write each property in the units it gives\./.test(ws(raw("agents", "spec-implementer.md")))],
      // ui-design-patterns.md's registry table, corrected to chain T's engine (item 5): a colour names the token it IS, in any
      // notation, `near` a hint; "in sync" is said of names, drift and gone listed beside it — tokenDrift's same-notation rule
      ["ui-design-patterns: the Review row — a colour that is a token's, in any notation, names it; one only close to it a hint", () =>
        /a colour that is a token's, in any notation, names that token — one only close to it, `near`, is a hint\) — and the \*\*UI checks\*\*/.test(DP)],
      ["ui-design-patterns: the Later row — in sync of names; drift (the same notation) and gone beside it, never in it; a token gone from the code not reported", () =>
        /"In sync" is said of names: a token the code holds with another value in the same notation \(`drift`\) and a token file that is gone \(`gone`\) are listed beside it, never in it; a token the code no longer declares is not reported — review the token rows when the tokens change\./.test(DP)],
    ];
    // (a label without a file's name is ui-code-scan.md's)
    for (const [label, check] of rows) all("1.38.0 Z docs — " + label, { holds: check });
  }

  { // 1.38.0 review 1 (area ui) — the prose of its fixes, each clause read where the user meets it, its bounds from the engine's
    // SOURCE: a file read in part judges no per-file font size (UP-4), Astro's define:vars block (UP-5, the 1.39 backlog), why a
    // feature report may warn where the inventory does not (UP-6), the marker's real spellings (UP-7)
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const js = (v) => JSON.stringify(v);
    const num = (src, name) => { const m = src.match(new RegExp("const " + name + " = ([0-9.e* -]+);")); return m ? m[1].split("*").reduce((a, x) => a * Number(x.trim()), 1) : NaN; };
    const DS = raw("mcp", "lib", "engine", "design-system.js");
    const C = ws(raw("skills", "dev-spec-driven", "references", "ui-code-scan.md")), ST = ws(raw("skills", "dev-spec-driven", "references", "steering-templates.md"));
    const read = num(DS, "DS_READ_CHARS") / 1024, line = num(DS, "DS_LINE_MAX").toLocaleString("en-US");
    // (the spellings the prose names, through the registry's reader and uiOff: a list item, a bold line — no entry at all —;
    // the bare line applied; 1.39 UP-7: an id in ONE code span applied too, a lone or a doubled backtick `unreadable`)
    const E = require(path.join(root, "mcp", "lib", "engine", "index.js")), T = E.loadLazyTier();
    const offOf = (name, text) => {
      const d = path.join(tmp, "r138-marker-" + name, ".specs");
      fs.mkdirSync(path.join(d, "steering"), { recursive: true });
      fs.writeFileSync(path.join(d, "steering", "design-system.md"), "# Design System\n\n" + text + "\n");
      const o = T.uiOff(E.designSystemRegistry(d));
      return [o.off.size, o.ignored.map((x) => x.why)];
    };
    const spell = { bare: offOf("bare", "_UI checks off: img-no-alt (decorative)_"), item: offOf("item", "- _UI checks off: img-no-alt (decorative)_"),
      bold: offOf("bold", "**UI checks off:** img-no-alt (decorative)"), code: offOf("code", "_UI checks off: `img-no-alt` (decorative)_"),
      lone: offOf("lone", "_UI checks off: `img-no-alt (decorative)_"), double: offOf("double", "_UI checks off: ``img-no-alt`` (decorative)_") };
    const spelled = js(spell) === js({ bare: [1, []], item: [0, []], bold: [0, []], code: [1, []], lone: [0, ["unreadable"]], double: [0, ["unreadable"]] });
    const R1 = [
      ["ui-code-scan: a file read in part judges neither per-file font size (the read and the line bounds, design-system.js)", () =>
        C.includes("Neither the stylesheet's nor the bare one is judged in a file read in part (past " + read + "K, a line past " + line + " characters).")],
      ["ui-code-scan: an Astro define:vars block's first at-rule — silence what it gives", () =>
        /An Astro `<style define:vars>` block's first at-rule reads as a selector: silence what it gives\./.test(C)],
      ["ui-code-scan: a feature report's focus search is narrower than the inventory's — it may warn where the inventory does not", () =>
        /A feature report looks for a focus style in its own files and the project's stylesheets alone, so it may warn of a removal the inventory excuses by one in another view file: check that the removal's elements get it, or silence it\./.test(C)],
      ["ui-code-scan: the marker's spellings — a list item or bold not read, an id bare or in a code span (the engine agrees)", () => spelled
        && /`_UI checks off: <rule-id> \(reason\)_` — a line of its own in design-system\.md \(never a list item or bold\), the marker in English, ids bare or in a code span, entries separated by commas/.test(C)],
      ["steering-templates: the marker's spellings — a line of its own as `_Token sources:_`, never a list item or bold; ids bare or in a code span (the engine agrees)", () => spelled
        && /a line of its own, as `_Token sources:_` is \(in a list item or bold it is not read\), each id bare or in a code span, entries separated by commas/.test(ST)],
    ];
    for (const [label, check] of R1) all("1.38.0 review 1 docs — " + label + (label.includes("spellings") ? " (got " + js(spell) + ")" : ""), { holds: check });
  }

  { // 1.39.0 Z — the docs pass: tooling-reference.md written once for 1.39 (spec_scan {designSystem}'s `deprecatedUses`, the
    // inventory's `motion-scripts`, the breakpoints' Sass map, partial fill and ui.md line, the units table's 1.39 reads;
    // spec_task_brief's `designSystem.units`; doctor's ui-states header bound), the READMEs' deprecated-uses sentence and
    // CLAUDE.md's topic map. Every key a clause names is read from a report the engine returns, every code and bound from
    // mcp/lib/engine/*.js — never a hand list; each example runs through the engine. ONE assertion per prose clause: the docs
    // pass's mutation pass drops each clause in a copy and its row fails (%TEMP%/dsd-139-z-mut).
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const js = (v) => JSON.stringify(v);
    const eng = (f) => raw("mcp", "lib", "engine", f);
    const DS = eng("design-system.js"), UC = eng("ui-checks.js"), BP = eng("breakpoints.js"), QY = eng("quality.js"), TK = eng("tasks.js"), DV = eng("design-values.js");
    // a constant's value as the source writes it — alone (`const X = 5000;`) or in a list (`const A = 1, X = 8 * 1024 * 1024, …;`)
    const num = (src, name) => { const m = src.match(new RegExp("\\b" + name + " = ([0-9.e* ]+)[,;]")); return m ? m[1].split("*").reduce((a, x) => a * Number(x.trim()), 1) : NaN; };
    const n = (v) => v.toLocaleString("en-US");
    const fnBody = (src, name) => { const at = src.indexOf("function " + name + "("); return at < 0 ? "" : src.slice(at, src.indexOf("\n}\n", at)); };
    const regexOf = (src, name) => { const m = src.match(new RegExp("const " + name + " = /(.*)/([a-z]*);")); return m ? new RegExp(m[1], m[2]) : /(?!)/; };
    const codesIn = (text) => [...text.matchAll(/code: "([a-z-]+)"/g)].map((m) => m[1]);
    const tick = (id) => "`" + id + "`";
    const TR = raw("skills", "dev-spec-driven", "references", "tooling-reference.md");
    const rowOf = (head) => TR.split("\n").find((l) => l.startsWith(head)) || "";
    const scanRow = rowOf("| `spec_scan {designSystem: true}` |"), briefRow = rowOf("| `spec_task_brief` |");
    // (a clause of the row: from its opening words to the next top-level key of its shape)
    const between = (text, from, to) => { const a = text.indexOf(from), b = a < 0 ? -1 : text.indexOf(to, a + from.length); return a < 0 || b < 0 ? "" : text.slice(a, b); };
    const depClause = between(scanRow, "`deprecatedUses` (1.39", ". With `name`:");
    const bpClause = between(scanRow, "both end in `breakpoints` (1.38", ". What the scan reads");
    const E = require(path.join(root, "mcp", "lib", "engine", "index.js")), T = E.loadLazyTier();
    const put = (p, rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
    const project = (tag) => { const p = path.join(tmp, "z139-" + tag); S.initProject(p, ["ui"], "en"); return p; };
    // the deprecated uses on a project that fills each key: a located row with an importer and an .mdx tag no import binds, an
    // unlocated row (no file) — the keys the report returns, each of which the clause must name in a code span
    const dep = (() => {
      const p = project("dep");
      put(p, ".specs/steering/design-system.md", "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n"
        + "| Callout | src/components/callout.tsx |  | _Deprecated: use Box_ |\n| Box | src/components/box.tsx |  |  |\n| Modal |  |  | _Deprecated_ |\n");
      put(p, "package.json", js({ name: "kit", dependencies: { react: "^19" } }));
      put(p, "src/components/callout.tsx", "export function Callout() { return <div />; }\n");
      put(p, "src/components/box.tsx", "export function Box() { return <div />; }\n");
      put(p, "src/app/page.tsx", "import { Callout } from \"../components/callout\";\nexport const P = () => <Callout />;\n");
      put(p, "docs/guide.mdx", "# Guide\n\n<Callout>hi</Callout>\n");
      const r = S.designSystemReport(p), d = r.deprecatedUses || { rows: [] }, row = d.rows[0] || {};
      const keys = [...Object.keys(d), ...Object.keys(row)];
      const sane = row.name === "Callout" && row.use === "Box" && row.filesTotal === 1 && row.unbound === 1 && d.unlocatedTotal === 1 && d.unlocated[0] === "Modal"
        && !r.limits.length && !r.truncated;
      return { r, d, keys, sane };
    })();
    // the limit codes the watch builds (deprecatedWatch) and the report's cuts it repeats (scanCode's `watch.report([…])`)
    const depCodes = codesIn(fnBody(DS, "deprecatedWatch")).concat(codesIn((DS.match(/deprecatedUses: watch\.report\(\[[^\n]*/) || [""])[0]));
    const usage = { files: num(DS, "DS_USAGE_FILES"), chars: num(DS, "DS_USAGE_CHARS") }, follow = { files: num(DS, "DS_PASS_FILES"), chars: num(DS, "DS_PASS_CHARS"), steps: num(DS, "DS_PASS_STEPS") };
    // the inventory's motion-scripts limit as uiProjectPass builds it — its keys — and the bounds readHeads may name
    const msLine = (UC.match(/code: "motion-scripts"[^\n]*/) || [""])[0];
    const msKeys = [...msLine.matchAll(/([a-z]+): scripts\./g)].map((m) => m[1]);
    const cutNames = [...fnBody(DS, "readHeads").matchAll(/cut = "([a-z]+)"/g)].map((m) => m[1]);
    // the breakpoints through the engine: ui.md's line (a no-break space, the slot's brackets, an aside), a Sass map, a partial theme
    const ui = (() => {
      const p = project("ui");
      const at = (line) => { put(p, ".specs/steering/ui.md", "# UI\n\n" + line + "\n"); return T.breakpointsReport(p, null).widths.join(","); };
      const nb = String.fromCharCode(0xa0), dot = String.fromCharCode(0xb7);
      return { nbsp: at("- Breakpoints: 360 " + dot + nb + "768 px " + dot + " text expansion"), thin: at("- Breakpoints: 360 " + dot + String.fromCharCode(0x2009) + "768 px " + dot + " text expansion"),
        slot: at("- Breakpoints: [576 / 768 px] " + dot + " text expansion"), aside: at("- Breakpoints: 480 / 960 px [1200 in print]"), stub: at("- Breakpoints: [360 / 768 / 1280 px] " + dot + " text expansion") };
    })();
    const sass = (() => {
      const p = project("sass"), q = project("sass-merge");
      put(p, "scss/_variables.scss", "$grid-breakpoints: (xs: 0, sm: 576px, md: 768px) !default;\n$spacers: (0: 0, 1: 400px);\n");
      put(p, "scss/custom.scss", "$grid-breakpoints: (xs: 0, sm: 600px, md: 900px);\n");
      put(q, "scss/_variables.scss", "$grid-breakpoints: (xs: 0, sm: 576px) !default;\n");
      put(q, "scss/custom.scss", "$grid-breakpoints: map-merge($grid-breakpoints, (xxl: 1600px));\n");
      const a = S.designSystemReport(p).breakpoints, b = S.designSystemReport(q).breakpoints;
      return { plain: a.from + ":" + a.widths.join(","), merge: b.from + ":" + b.unread.map((x) => x.name).join(",") };
    })();
    const partial = (() => {
      const p = project("partial");
      put(p, "src/app/globals.css", "@import \"tailwindcss\";\n@theme {\n  --breakpoint-3xl: 1600px;\n  --breakpoint-4xl: 2000px;\n  --color-a: #fff;\n  --color-b: #000;\n  --color-c: #111;\n}\n");
      const b = S.designSystemReport(p).breakpoints;
      return b.partial + ":" + b.widths.join(",");
    })();
    const fill = (((BP.match(/const BP_FILL = \[([^\]]*)\]/) || [])[1] || "").match(/\d+/g) || []).join(" · ");
    // (1.40) an `@custom-media` alias list: alone (its edge, partial, a rule it cannot read unread) and beside a theme (not read)
    const media = (() => {
      const p = project("media"), q = project("media-beside");
      put(p, "src/index.css", "@custom-media --md (max-width: 767px);\n@custom-media --x (min-width: 30ch);\n");
      put(q, "src/index.css", "@custom-media --sm (min-width: 600px);\n@import \"tailwindcss\";\n@theme {\n  --breakpoint-3xl: 1600px;\n}\n");
      const a = S.designSystemReport(p).breakpoints, b = S.designSystemReport(q).breakpoints;
      return { alone: [a.from, a.partial, a.widths.join(","), a.unread.map((u) => u.name).join(",")].join(":"), beside: b.widths.join(",") };
    })();
    const readmeDep = { "README.md": "`dev-spec design-system` lists the files that still import it (`deprecatedUses`).",
      "README.pt.md": "O `dev-spec design-system` lista os ficheiros que ainda o importam (`deprecatedUses`).",
      "README.es.md": "`dev-spec design-system` enumera los ficheros que aún lo importan (`deprecatedUses`)." };
    const qmap = ws(((raw("CLAUDE.md").split(/\n## Topic map\n/)[1] || "").match(/- \*\*`docs\/maintainers\/quality\.md`\*\*[\s\S]*?(?=\n- \*\*)/) || [""])[0]);
    const rows = [
      // spec_scan {designSystem} — the project shape's deprecatedUses (item 1)
      ["tooling-reference: spec_scan's deprecatedUses — only while a row is marked, every key the report returns (rows and a row's), in its clause", () =>
        dep.sane && dep.keys.length === 15 && dep.keys.every((k) => depClause.includes(tick(k)))
          && depClause.startsWith("`deprecatedUses` (1.39 — only while the registry marks a row `_Deprecated:_`, a report:")],
      ["tooling-reference: deprecatedUses' rows — the files and component files listed by their first DS_DEP_SHOWN", () => {
        const shown = num(DS, "DS_DEP_SHOWN");
        return shown === 3 && depClause.includes("`paths` (its component files, the first " + shown + " — a namesake's too)") && depClause.includes("`files` (the files that still import it, the first " + shown + " by path)");
      }],
      ["tooling-reference: deprecatedUses' unlocated — no component file whose importers the scan reads (RE_JSX_FILE ∪ RE_MARKUP_FILE)", () => {
        const exts = [regexOf(DS, "RE_JSX_FILE"), regexOf(DS, "RE_MARKUP_FILE")];
        const said = ["tsx", "jsx", "js", "vue", "svelte", "astro"];
        // (review 1 of 1.39: a component folder's index that gives the name locates the row too; the rows still imported first;
        // review 2: the index the row's path names, when several give the name to different files)
        return depClause.includes("`unlocated` (the rows whose name no component file the scan reads gives — a .tsx / .jsx / .js / .vue / .svelte / .astro file or a component folder's index, the one the row's path names when several give it to different files: a library's, an Angular or a Blade one)")
          && said.every((x) => exts.some((re) => re.test("a." + x))) && !exts.some((re) => re.test("a.component.ts"))
          && depClause.includes("`rows` — each row the code holds a component file for, the rows still imported first, then those only rendered with no import, each group in the registry's order:");
      }],
      ["tooling-reference: deprecatedUses' limits — every code the watch builds or repeats, the usage read's and the follow's bounds (design-system.js)", () =>
        depCodes.length === 4 && depCodes.every((c) => depClause.includes(tick(c)))
          && depClause.includes("`usage-files` (the project's files read for what they import, " + n(usage.files) + " / " + usage.chars / 1048576 + " MB: `read`)")
          && depClause.includes("`deprecated-follow` (the re-exports followed, " + n(follow.files) + " files / " + follow.chars / 1048576 + " MB / " + n(follow.steps) + " steps: `read`, `chars`, `count`)")],
      ["tooling-reference: deprecatedUses — its note, localized: no import found is not unused; never the report's limits, truncated or inSync", () =>
        dep.d.note === require(path.join(root, "mcp", "lib", "i18n.js")).msg("en").quality.dsDepUsesNote && /No import found is not unused/.test(dep.d.note)
          && depClause.includes("`note` (localized: what it does not see — no import found is not unused); never the report's `limits`, `truncated` or `inSync`")],
      // the inventory's motion-scripts (item 2)
      ["tooling-reference: uiChecks' motion-scripts — its bounds (DS_MOTION_*), every key uiProjectPass gives it, the bounds readHeads names", () =>
        js(msKeys) === js(["read", "bound", "count", "file"]) && js(cutNames) === js(["files", "chars"])
          && scanRow.includes("`motion-scripts` (1.39 — the fact's script search, " + n(num(DS, "DS_MOTION_SCRIPTS")) + " scripts / " + num(DS, "DS_MOTION_CHARS") / 1048576 + " MB: `read`, `bound` " + cutNames.join(" · ") + " when one ended it, `count` and the first `file` of the scripts read only in part)")],
      ["tooling-reference: the fact no-reduced-motion — taken back by a script's mention", () => /said only when no view read was cut, taken back by a script's mention \(1\.39\)/.test(scanRow)],
      // the breakpoints (item 3)
      ["tooling-reference: breakpoints' ui.md line — a no-break space after the `·` continues the list (RE_UI_END; a thin space ends it)", () =>
        ui.nbsp === "320,360,768" && ui.thin === "320,360"
          && bpClause.includes("1.39: a no-break space after the `·` continues the list as a blank does")],
      ["tooling-reference: breakpoints' ui.md line — the stub's slot unread, widths written in the brackets opening the value read, another bracket an aside", () =>
        ui.slot === "320,576,768" && ui.aside === "320,480,960" && ui.stub === "320,390,768,1024,1440"
          && bpClause.includes("the stub's `[…]` slot is not read, but widths written inside the brackets that open the value are, and any other bracket is an aside")],
      ["tooling-reference: breakpoints' code — a top-level Sass …breakpoints map (RE_SASS_NAME), a plain assignment over a `!default` one, map-merge unread", () => {
        const name = regexOf(BP, "RE_SASS_NAME");
        return sass.plain === "code:320,600,900" && sass.merge === "default:$grid-breakpoints" && name.test("$grid-breakpoints") && name.test("$breakpoints") && !name.test("$spacers")
          && bpClause.includes("— 1.39 — a top-level Sass map whose name ends in `breakpoints`, `$grid-breakpoints`, in a .scss sheet the scan reads, a plain assignment over a `!default` one, `map-merge` or a variable unread");
      }],
      ["tooling-reference: breakpoints' code — (1.40) an @custom-media rule's width edges, only when no theme and no map gives a width, a rule it cannot read unread", () =>
        media.alone === "code:true:320,390,768,1024,1440:--x" && media.beside === "320,390,768,1024,1440,1600"
          && bpClause.includes("; and — 1.40 — only when neither gives a width, the width edges of a top-level `@custom-media` rule, `(max-width: 767px)` is 768, a rule it cannot read unread)")],
      ["tooling-reference: breakpoints' partial — a theme's or (1.40) an alias list's widths first, then the default set fills the places left in BP_FILL's order", () =>
        partial === "true:320,768,1024,1440,1600,2000" && fill === "768 · 1024 · 1440 · 390" && media.alone.startsWith("code:true:")
          && bpClause.includes("`partial` — a Tailwind 4 theme that keeps Tailwind's own five, or (1.40) an `@custom-media` alias list: the source's widths first, then (1.39) the default set fills the places left, " + fill + " —")],
      ["tooling-reference: breakpoints' breakpoint-widths — the source's own widths past BP_WIDTHS, never a default one", () =>
        bpClause.includes("`breakpoint-widths` (the source's own widths past " + num(BP, "BP_WIDTHS") + " — never a default one)")],
      // the units table (item 4)
      ["tooling-reference: units — a negative length and a Tailwind size in any unit judged (offUnit, RE_TW_UNIT)", () =>
        T.offUnit("0 -8px", ["rem"]) === "px" && new RegExp(regexOf(DS, "RE_TW_UNIT").source).test("text-[2vw]")
          && scanRow.includes("`units` — the declarations off the registry's units table (1.39: a negative length too, `-8px`, and a Tailwind arbitrary size in any unit, `text-[2vw]`):")],
      ["tooling-reference: unitsTable — the units column by its header's start, else the first holding the word (RE_DS_UNITS_WORD)", () =>
        regexOf(QY, "RE_DS_UNITS_WORD").test("Allowed units") && !/^units/i.test("Allowed units")
          && scanRow.includes("its units column is the one whose header starts with Units, else — 1.39 — the first holding the word, `Allowed units`")],
      // spec_task_brief (item 4) and doctor's ui-states (item 3)
      ["tooling-reference: spec_task_brief — the units table's rows within DS_BRIEF_UNITS, a units-only registry too, `designSystem.units` {rows, more} as briefDesignSystem builds it", () => {
        const body = fnBody(QY, "briefDesignSystem");
        return /units = \{ rows: \[\], more: 0 \}/.test(body) && /units\.rows\.push\(\{ props: r\.props, units: r\.units \}\)/.test(body) && /!reg\.units\)\) return null/.test(body)
          && /if \(ds\.units\) res\.designSystem\.units = ds\.units;/.test(TK)
          && briefRow.includes("and (1.39) the registry's units table, its first rows within " + num(QY, "DS_BRIEF_UNITS") + " characters, then how many more (a registry holding only the table gets the part too)")
          && briefRow.includes("and with a units table `units` {`rows` [{props, units}], `more`} (1.39)}");
      }],
      // (1.39.0 review 1, BU-5 / R1-DOC-5: the detail names that bound — usTruncated is handed US_HEADER)
      ["tooling-reference: doctor's ui-states — the anchor looked for in a header's first US_HEADER cells, past them no matrix, the detail naming that bound", () =>
        /t\.header\.slice\(0, US_HEADER\)/.test(QY) && /if \(a < 0 && t\.header\.length > US_HEADER\) truncated\.views = true;/.test(QY)
          && /Q\.usTruncated\(US_TABLES, US_ROWS, US_VIEWS, US_HEADER\)/.test(QY)
          && ws(TR).includes("header cell in any language (looked for in a header's first " + num(QY, "US_HEADER") + " cells — 1.39: past them the table is none, the detail naming that bound)")],
      // the READMEs (EN / PT / ES) and CLAUDE.md's topic map
      ...Object.entries(readmeDep).map(([f, s]) => [f + ": the +ui paragraph — the files that still import a deprecated component (`deprecatedUses`)", () => ws(raw(f)).includes(s)]),
      ["CLAUDE.md: the topic map's quality.md line — the deprecated uses, the Sass breakpoints map, the reduced-motion script search", () =>
        qmap.includes("the deprecated uses — the files that still import a `_Deprecated:_` component, settle's follow —") && qmap.includes("a Sass `…breakpoints` map too")
          && qmap.includes("the project UI inventory and its reduced-motion script search")],
    ];
    for (const [label, check] of rows) all("1.39.0 Z docs — " + label + (label.includes("every key the report returns") ? " (got " + js({ keys: dep.keys, sane: dep.sane, missed: dep.keys.filter((k) => !depClause.includes(tick(k))) }) + ")" : ""), { holds: check });
  }

  { // 1.40.0 Z — the docs pass: the clauses it wrote or made true over the merged chains — ui-code-scan.md's index sentence
    // (R3-DEP-3's any word, R2-DEP-2 b's renamed file), quality.md's current rules (R2-T2's examples, the `@custom-media` edges
    // and what is not read, the non-enumerable `parsed`), testing.md's rule 1, tasks-and-evidence.md's two counted checks and
    // gates-and-approvals.md's stamp line. Each example runs through the engine; each counted check is read from its test's
    // source. ONE assertion per clause: the docs pass's mutation pass drops each in a copy and its row fails (%TEMP%/dsd-140-z-mut).
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const js = (v) => JSON.stringify(v);
    const note = (f) => ws(raw("docs", "maintainers", f));
    const QM = note("quality.md"), TM = note("testing.md"), TE = note("tasks-and-evidence.md"), GA = note("gates-and-approvals.md");
    const UCS = ws(raw("skills", "dev-spec-driven", "references", "ui-code-scan.md"));
    const E = require(path.join(root, "mcp", "lib", "engine", "index.js")), T = E.loadLazyTier();
    const put = (p, rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
    const project = (tag, files) => { const p = path.join(tmp, "z140-" + tag); S.initProject(p, ["ui"], "en"); for (const [rel, text] of Object.entries(files)) put(p, rel, text); return p; };
    const L = (lines) => lines.join("\n") + "\n";
    const REG = (rows) => ({ ".specs/steering/design-system.md": "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n" + rows.join("\n") + "\n" });
    const usesOf = (p) => S.designSystemReport(p).deprecatedUses || { rows: [] };
    const rowOf = (d, name) => d.rows.find((x) => x.name === name) || { files: [], filesTotal: 0 };
    // a kit of two component folders whose indexes give `Content` to different files, a page importing each kit as a namespace
    const K = "src/lib/components/ui/";
    const kit = {};
    for (const c of ["card", "picker"]) {
      kit[K + c + "/" + c + "-content.svelte"] = L(["<div><slot /></div>"]);
      kit[K + c + "/index.ts"] = L(["import Content from \"./" + c + "-content.svelte\";", "export { Content };"]);
      kit["src/routes/" + c + "/+page.svelte"] = L(["<script lang=\"ts\">", "  import * as Kit from '../../lib/components/ui/" + c + "';", "</script>", "<Kit.Content />"]);
    }
    kit["package.json"] = js({ name: "z140-kit" });
    const cell = (tag, text) => rowOf(usesOf(project("cell-" + tag, Object.assign(REG(["| Content | " + text + " |  | _Deprecated_ |"]), kit))), "Content");
    const words = cell("words", "`" + K + "picker/index.ts`, `" + K + "picker/picker-content.svelte`"), two = cell("two", K + "picker/index.ts " + K + "card/index.ts");
    // vben's shape: a component folder's index renames button.vue; icon-button.vue imports that file directly
    const B = "src/components/button/";
    const renamed = rowOf(usesOf(project("renamed", Object.assign(REG(["| VbenButton | " + B + "index.ts |  | _Deprecated_ |"]), {
      "package.json": js({ name: "z140-renamed" }), [B + "button.vue"]: L(["<template><button /></template>"]),
      [B + "index.ts"]: L(["export { default as VbenButton } from './button.vue';"]),
      [B + "icon-button.vue"]: L(["<script setup lang=\"ts\">", "import VbenButton from './button.vue';", "</script>", "<template><VbenButton /></template>"]) }))), "VbenButton");
    const judge = (value, tok) => { const r = T.judgeRaw({ kind: "color", value }, T.tokenScale([{ name: "--a", value: tok }], [])); return r.token ? "token" : r.near ? "near" : "none"; };
    const both = (x, y) => judge(x, y) + "|" + judge(y, x);
    const bp = (tag, css) => { const b = S.designSystemReport(project("bp-" + tag, { "src/index.css": css })).breakpoints; return [b.from, b.partial, b.widths.join(","), b.unreadTotal].join(":"); };
    const DEF = "320,390,768,1024,1440";
    const parsed = (() => {
      const d = usesOf(project("parsed", Object.assign(REG(["| Table | src/components/table.tsx |  | _Deprecated_ |"]), {
        "package.json": js({ name: "z140-parsed" }), "src/components/table.tsx": "export function Table() { return <table />; }\n",
        "src/app/page.tsx": "import { Table } from \"../components/table\";\nexport const P = () => <Table />;\n" })));
      return { n: d.parsed, enumerable: Object.keys(d).includes("parsed"), inJson: js(d).includes("parsed"), files: rowOf(d, "Table").filesTotal };
    })();
    const testSrc = (f) => raw("mcp", "tests", f);
    const G1 = testSrc("15-quality-design-system-cost-deprecated.js"), FC = testSrc("09-evidence-fast-check.js"), PT = testSrc("10-guards-protected-tests.js");
    const rows = [
      ["ui-code-scan: an index sentence — when several give the name to different files, only those the row's path names (any word: one backticked beside another path; two named, both locate it)", () =>
        UCS.includes("when several give it to different files (a kit's parts: `Content` — the files their relative imports name), only those the row's path names (any word)")
          && words.filesTotal === 1 && js(words.files) === js(["src/routes/picker/+page.svelte"]) && two.filesTotal === 2],
      ["ui-code-scan: a direct import of a file an index renames counts for each such row (vben's icon-button.vue)", () =>
        UCS.includes("a direct import of a file it renames counts for each such row (`import VbenButton from './button.vue'`)")
          && renamed.filesTotal === 1 && js(renamed.files) === js([B + "icon-button.vue"])],
      ["quality.md: R2-T2's examples — zinc-900's oklch() is not the hsl() neutral, the neutral's own oklch() and zinc's hex's HSL are, #eeeff2 as oklch() is hsl(220 14% 94%), both orders", () =>
        QM.includes("So Tailwind 4's zinc-900 `oklch(21% 0.006 285.885)` is no longer shadcn's `hsl(0 0% 9%)` neutral")
          && QM.includes("the neutral's own `oklch(20.5% 0 0)` is its token, zinc's own hex's HSL `hsl(240 5.9% 10%)` is zinc-900's, and 1.38's `#eeeff2` written as `oklch(0.952 0.004 271.369)` is `hsl(220 14% 94%)`")
          && both("oklch(21% 0.006 285.885)", "hsl(0 0% 9%)") === "near|near" && both("oklch(20.5% 0 0)", "hsl(0 0% 9%)") === "token|token"
          && both("oklch(21% 0.006 285.885)", "hsl(240 5.9% 10%)") === "token|token" && both("oklch(0.952 0.004 271.369)", "hsl(220 14% 94%)") === "token|token"],
      ["quality.md: the @custom-media edges — a max-width one past its value, a lone `--md` the default set itself, from code and partial", () =>
        QM.includes("so `(max-width: 767px)` and `767.98px` are 768") && QM.includes("`partial` (so a lone `--md (min-width: 768px)` captures the default set itself)")
          && js(T.mediaEdges("(max-width: 767px)").px) === "[768]" && js(T.mediaEdges("(max-width: 767.98px)").px) === "[768]"
          && bp("lone", "@custom-media --md (min-width: 768px);\n") === "code:true:" + DEF + ":0"],
      ["quality.md: what @custom-media is not read — an alias of an alias (no edge, nothing unread), upper case, a rule whose `(` no `)` closes before its `;` (silent); one wrapped over lines whose groups close is read", () =>
        QM.includes("an alias of an alias (`(--a)`: no edge, nothing unread), upper-case `@CUSTOM-MEDIA`, and, silent, a rule longer than DS_PRELUDE (it arrives without its head, as a one-line Sass map) or one whose `(` no `)` closes before its `;` (a rule wrapped over lines whose groups close is read)")
          && js(T.mediaEdges("(--a)")) === js({ px: [], bad: false }) && bp("upper", "@CUSTOM-MEDIA --md (min-width: 600px);\n") === "default:false:" + DEF + ":0"
          && bp("open", "@custom-media --md (min-width: 600px;\n") === "default:false:" + DEF + ":0"
          && bp("wrapped", "@custom-media --md (\n  min-width: 768px\n);\n").startsWith("code:true:")],
      ["quality.md: the deprecated uses' `parsed` — not enumerable (in-process only), the pages the watch parsed itself", () =>
        QM.includes("the report's `parsed`, NOT enumerable (as classify's `tiers`) — MCP, `--json` and a spread drop it")
          && typeof parsed.n === "number" && !parsed.enumerable && !parsed.inJson && parsed.files === 1],
      ["testing.md: rule 1 — the engine's own count, `deprecatedUses.parsed`, so G1's asks is counted (no clock), its reads under the project root", () =>
        TM.includes("the deprecated uses' watch counts the pages it parses itself, `deprecatedUses.parsed` (not enumerable: in-process only, never in a result's JSON), so G1's `asks` asserts that count and the fs calls under the project root, no clock")
          && /asks: \(\) => counted\.asks === counted\.table - counted\.settled/.test(G1) && /asksReads: \(\) =>/.test(G1) && !/within\(rep\(G1\.asksOn\)/.test(G1)
          && /fsCalls\(G1\.asksOn \+ path\.sep/.test(G1)],
      ["tasks-and-evidence.md: the fast check's planned-walk reuse — counted under the project root (09-evidence-fast-check), a 2.5× backstop", () =>
        TE.includes("`09-evidence-fast-check` COUNTS it since 1.40 — the brief and next_task with the fast check make, under the project root, the fs calls of the call without it plus the planned walk's and one open more, the observed log's (1.41.1: and the read gate's two lstats and one realpath of its path); a 2.5× timed backstop beside")
          && /counted: \(\) => js\(counted\) === js\(\{ brief: \{ lstatSync: 2, \"realpathSync\.native\": 1, openSync: 1 \}, next: \{ lstatSync: 2, \"realpathSync\.native\": 1, openSync: 1 \} \}\)/.test(FC) && /\(x\) => x\.ratio <= 2\.5\)/.test(FC)],
      ["tasks-and-evidence.md: the protected-tests walk stops at its cap — counted under the project root (10-guards-protected-tests)", () =>
        TE.includes("past the cap the walk stops — COUNTED since 1.40 under the project root (10-guards-protected-tests: 4,000 test files open and stat what 2,000 do and list strictly fewer folders")
          && /stops: \(\) => fewer\(over\.a\.k, over\.b\.k\)/.test(PT) && /a\.readdirSync < b\.readdirSync/.test(PT)],
      ["gates-and-approvals.md: the uiStates stamp cut a third time — no stamp key in the engine", () =>
        GA.includes("- **1.40.0** — the `uiStates` stamp cut a third time") && !libSources().some((f) => /\buiStates\b/.test(fs.readFileSync(f, "utf8")))],
    ];
    for (const [label, check] of rows) all("1.40.0 Z docs — " + label, { holds: check });
  }

  // 1.41 the METRIC line (engine/metric.js): ONE owner of its form — METRIC_GRAMMAR, the contract fixture's grammar.line — quoted whole by
  // references/verification.md (its indented line), the agents' rule against loosening a line to pass, /spec-finish's decision.
  {
    const E = require(path.join(__dirname, "lib", "engine", "index.js"));
    const rd = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8").replace(/\r\n/g, "\n");
    const VER = rd("skills", "dev-spec-driven", "references", "verification.md");
    const sec = (VER.split("### Metrics that regress silently\n")[1] || "").split("\n## ")[0];
    const quoted = sec.split("\n").filter((l) => /^ {4}METRIC /.test(l)).map((l) => l.trim());
    all("1.41 the METRIC line's form is ONE text: verification.md's Metrics that regress silently quotes METRIC_GRAMMAR (the fixture's line) whole, once; spec-implementer never loosens, flips or drops a line to pass, spec-reviewer calls that Important, /spec-finish has the user decide on the warning (got " + JSON.stringify(quoted) + ")", {
      grammar: quoted.length === 1 && quoted[0] === E.METRIC_GRAMMAR,
      implementer: /never\s+loosen its tolerance, flip or drop its `better=`, change its unit or remove it to pass/.test(rd("agents", "spec-implementer.md")),
      reviewer: /A diff that raises or drops a METRIC line's `tolerance=`, flips or drops its `better=`, changes its unit or\s+removes the line[^\n]*\n?[^\n]*\*\*Important\*\*/.test(rd("agents", "spec-reviewer.md")),
      finish: /METRIC reading worse past its stated tolerance, or a loosened METRIC line: tell the user/.test(rd("commands", "spec-finish.md").replace(/\n\s+/g, " ")),
    });
    // 1.41.0 review 2 (R2-MF-1, R2-MF-7): metricsUnmeasured claims no READABLE line (a malformed one or one past a bound is not read),
    // only once finish --run ran every check — verification.md and tooling-reference.md alike; the readings' `text` in both tools' shapes
    const TOOL = rd("skills", "dev-spec-driven", "references", "tooling-reference.md");
    const doubt = "a malformed line, or one past a reader bound, is not read — the run's note names it";
    all("1.41.0 review 2 R2-MF-1 / R2-MF-7 docs: verification.md and tooling-reference.md say finish's unmeasured claim is about a READABLE METRIC line, and when it is made; spec_complete_task's and spec_finish's `metrics` carry `text`", {
      verification: sec.replace(/\n\s*/g, " ").includes("finish warns when no passing check printed a readable METRIC line of a name a row declares (" + doubt + ") — once `finish --run` ran every check"),
      tooling: TOOL.includes("`metricsUnmeasured` — the design's Silent Regressions names no passing run printed as a readable METRIC line (" + doubt + "), said only once every check's latest run is `finish --run`'s"),
      text: TOOL.includes("`metrics` [{name, value, text, unit, better, tolerance {amount, percent, text}}") && TOOL.includes("`metrics` [{check, name, value, text, unit, better, tolerance,") &&
        TOOL.includes("reference: {feature, at, value, text, unit, better, tolerance}"),
    });
    // 1.41.0 RX-4 / RX-6 (the cross-plugin review): the reader's 64 MiB bound is its own — the CLI records nothing past 64 MB of
    // output —, and a name printed on both streams reads stderr's here, print order in dev-guardian's `2>&1` file: one stream per name
    const flat = sec.replace(/\n\s*/g, " ");
    all("1.41.0 RX-4 / RX-6 docs: verification.md keeps the reader's 64 MiB bound apart from what the CLI runs, and gives the one-stream rule for a name both plugins read", {
      // (review 3, R3-A-1: done --run reads its several _Verify:_ commands together — those can reach the bound)
      bound: flat.includes("The reader's own bound is an output's last 64 MiB: `finish --run` reads each check alone, under the CLI's 64 MB cap (a run whose output passes it records nothing — `output-too-large`, above), so it never reaches that bound; several `_Verify:_` commands of one `done --run` are read together and can reach it, and then `metricsDropped` says `readBytes`.") &&
        !flat.includes("(its last 64 MiB") && !flat.includes("is past what the CLI runs"),
      streams: flat.includes("**One stream per name.** dev-spec reads stdout, then stderr, as two texts: a name printed on both reads stderr's line. dev-guardian's `metrics` reads one file — a CI job that captures `2>&1` reads it in print order, the last printed winning. Print each name on ONE stream"),
    });
    // 1.41.0 review 3 (prose): R3-A-1 the bound in the CHANGELOG and tasks-and-evidence.md too; R3-A-2 a BOM at stderr's start, read past
    // here, sits mid-file in a `2>&1` capture; R3-A-3 values and tolerances show as printed, the delta and the applied tolerance as
    // numbers; R3-B-1 the W bullet's diff-base line; R3-B-4 a quoted --fail-on is not read; R3-B-6 the prune row's accept at guard level tests
    const LOG = rd("CHANGELOG.md").replace(/\s+/g, " "), TE = rd("docs", "maintainers", "tasks-and-evidence.md").replace(/\s+/g, " ");
    const TOOLF = TOOL.replace(/\s+/g, " ");
    all("1.41.0 review 3 docs (R3-A-1/2/3, R3-B-1/4/6): the reader's bound reachable only by several _Verify:_ commands of one done --run; stderr's BOM; values shown as printed, the delta and the applied tolerance as numbers; a quoted --fail-on not read; the diff-base line quoted as printed; the prune row's accept at guard level tests", {
      boundLog: LOG.includes("`finish --run` reads each check alone, under the CLI's 64 MB cap, so it never reaches the reader's 64 MiB bound; several `_Verify:_` commands of one `done --run` are read together and can reach it, and then `metricsDropped` says `readBytes`") &&
        !LOG.includes("the reader's own 64 MiB bound is past what the CLI runs"),
      boundNotes: TE.includes("`finish --run` reads each check alone, so it never reaches the bound; several `_Verify:_` commands of one `done --run` are read together and can — `metricsDropped` says `readBytes`") &&
        !TE.includes("from the CLI the bound is never reached"),
      // (RX2-4) the stream printed second, not stderr: with a BOM on both and stderr first, a `2>&1` capture holds stdout's mid-file
      bom: flat.includes("Print each name on ONE stream and both read the same value. A byte-order mark at the start of the stream printed second is read past by dev-spec, while a `2>&1` capture holds it mid-file, and dev-guardian reads nothing there.") &&
        !flat.includes("at the start of stderr") && TE.includes("RX-3 — the stream printed second's too, which a `2>&1` capture holds mid-file") && !TE.includes("RX-3 — stderr's too"),
      shown: LOG.includes("values and tolerances compare as the exact decimals printed and show as printed (120 → 122.4 at 2 % is `within`); the delta and the applied tolerance print as numbers.") &&
        !LOG.includes("compare — and show — as the exact decimals") && flat.includes("the warning and `## Metrics` show them as printed (the delta and the applied tolerance as numbers)"),
      // (RX2-1) the first segment that carries a --fail-on, its last flag: a `cd . &&` prefix is read past
      failOn: LOG.includes("The gate's `--fail-on` is the LAST one of the first part of the command that has one, as dev-guardian reads it (the command cut at `;` / `&&` / `|` / a line break: `cd . && <check> --fail-on medium` reads medium, a later `echo --fail-on low` is not read; a quoted one is not read, as in 1.40): 1.40 read the first") &&
        !LOG.includes("an unquoted flag of the check's own command") && TE.includes("of the FIRST segment that carries one, the command cut at `;` / `&&` / `||` / `|` / a line break"),
      // (RX2-3) the blocked gate's hint names the real choices for a weakened or deleted test
      fixHintLog: LOG.includes("finish's hint for a blocked gate says a weakened or deleted test (dev-guardian's test-integrity check) takes no inline suppression: restore the test, or the user decides — at `--fail-on medium` an approved pruning blocks by design."),
      // (R3-B-1) the W bullet quotes the diff-base line as the engine prints it
      diffBase: LOG.includes("The verdict's line says \"" + require(path.join(__dirname, "lib", "i18n.js")).msg("en").guardian.diffBase("<base>").replace(/^ · /, "") + "\" — one text, true for every version."),
      prune: TOOLF.includes("each removal the user's, recorded through spec_impact's `retire` and, at guard level tests, the protected-test accept · `feedback`") &&
        TE.includes("the record spec_impact's `retire` and, at guard level tests, the protected-test accept"),
    });
  }

  { // 1.42 (DS-PROMPTS) — the review loop's prose and the agent prompts: each row reads the real files.
    const raw = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
    const ws = (t) => t.replace(/\s+/g, " ");
    const SUBX = raw("skills", "dev-spec-driven", "references", "subagent-execution.md"), SUB = ws(SUBX);
    const REV = ws(raw("agents", "spec-reviewer.md")), FIN = ws(raw("commands", "spec-finish.md"));
    const section = (text, head) => { const i = text.indexOf(head); if (i < 0) return ""; const rest = text.slice(i + head.length); const j = rest.search(/\n#{2,3} /); return head + (j < 0 ? rest : rest.slice(0, j)); };
    const ledger = (SUBX.match(/Ledger lines \(one per event, appended\):\n\n```\n([\s\S]*?)```/) || [])[1] || "";
    const closing = ws(section(SUBX, "## Closing")), fix = ws(section(SUBX, "### 7. Fix loop"));
    const step4 = (FIN.match(/ 4\. (.*?) 5\. /) || [])[1] || "";

    // S1: the review loop's residues — the findings a feature ships with still open — are filed before the merge, since the ledger
    // goes with .execution/ and nothing else reads it. The set is a PROPERTY (fix round 1, R1-PROMPTS-02/03): a defect that exists
    // at HEAD and ships — pre-existing (deferred) (the reviewer's Pre-existing label, renamed from "Out of scope (deferred)", which
    // the re-review keeps for a deferred minor — the namesake), a refutation real at HEAD, parked (real), an unconfirmed (NN)
    // finding or a class place outside a task the final review let ship; never parked (contested) or another refutation (no
    // defect), never minor (deferred). Fix round 2 (R2-PROMPTS-01 / -04): "real at HEAD" is ONE predicate on TWO verifier inputs —
    // its verdict's reason (pre-existing / not in the diff) AND its Exists at HEAD line (yes) — written the same in §6, Closing and
    // /spec-review branch (an intended, silenced, no-rule or nitpick refutation can say "Exists at HEAD: yes" and is no defect);
    // every other reason of the verifier's template is named as no residue, so a reason added there must be classed here.
    // ONE entry per feature (keyed on the slug, an input), split at the 2,000-character note limit; the lines after the ledger's
    // LAST `Residues filed:` line are the ones filed (R2-PROMPTS-03: a kept branch's later residues). ONE closing order in both
    // files (R1-PROMPTS-01): finish → the execution sign-off → the residues → the commit → switch + merge. The commit (R2-PROMPTS-02)
    // adds what the run and the closing wrote — the feature's folder, roadmap.json, the generated roadmap files, the registry / a
    // steering file / the launcher / .specs/.gitignore when written — in the SAME words in both texts (fix round 1's "until git
    // status is empty … ask the user" asked on every close: the ticks' tasks.md is listed and no closing step wrote it). Fix round 3
    // (R3-PROMPTS-01 / -02 / -03): a plain `git commit` commits the whole INDEX, so "git carries any other uncommitted change: not
    // committed" was false for a change staged before the closing — the texts look at the index first (`git diff --cached
    // --name-only`: those files go to the user, an input, so nothing is asked when nothing was staged), say that a file the run
    // wrote is added whole, and that only an unstaged or untracked change is carried across the switch; no sweeping add in either
    // whole text. No recovery verb that parks or drops a change is named in either whole text (R2-PROMPTS-05), the sign-off asked
    // in ONE sentence of each, whatever its spelling. UX-11: step 4 names the branch the merge line names, no guess without one.
    const VERIFIER = raw("agents", "spec-verifier.md");
    const verdictReasons = ((VERIFIER.match(/REFUTED \(under 50\) — ([^\n]*)/) || [])[1] || "").split(" | ").map((s) => s.trim().replace(/ \(cite\)$/, ""));
    const REAL = "refuted as pre-existing or not in the diff with its `Exists at HEAD` line yes";
    const sec6 = ws(section(SUBX, "### 6. Verify the findings")), REVIEW = ws(raw("commands", "spec-review.md"));
    const otherReasons = verdictReasons.filter((r) => r !== "pre-existing" && r !== "not in the diff");
    const COMMIT = "what the run and the closing wrote under `.specs/`. Before the `git add`, `git diff --cached --name-only` — a file it lists was staged before the closing and would go into the commit: show those files to the user, who decides (unstage them with `git restore --staged <file>`, or commit them too). Then `git add` the feature's folder, `.specs/roadmap.json` and the generated roadmap files the project has (`.specs/ROADMAP.md`, `.specs/ROADMAP.html`, `.specs/SPECS.md`) — with `.specs/steering/design-system.md` when the finish registered components, a steering file the run amended, `.specs/guardian.cjs` when `finish --run` replaced it and `.specs/.gitignore` when the engine added lines to it —, then commit (a file the run wrote is added whole: an edit of the user's in it goes into the commit too; a path git ignores stays out: `git add` names it and adds the rest; a git-ignored `.specs/` has nothing to commit). An unstaged or untracked change of the user's is not added, and git carries it across the switch (or the switch refuses, naming the file, when the branch changed it: ask the user).";
    // the exclusion lists (every refutation reason that is NO residue) of §6 and Closing — read by two keys below
    const excl6 = (sec6.match(/Any other reason — (.*?) — is no residue, whatever its `Exists at HEAD` line says\./) || [, ""])[1];
    const exclC = (closing.match(/another refutation \((.*?): no defect to file\)/) || [, ""])[1];
    // R3-PROMPTS-05: a sentence of §6 / Closing that pairs "residue" with a no-residue reason once its exclusion list is taken out
    // (an intended refutation filed as a residue after all — the rule then contradicts itself)
    const contrary = (t, excl) => (excl ? t.split(excl).join("") : t).split(/(?<=\.)\s+/).filter((s) => /\bresidues?\b/i.test(s) && otherReasons.some((r) => s.includes(r)));
    const commitIn = (t, lead) => { const i = t.indexOf(lead); if (i < 0) return ""; const rest = t.slice(i + lead.length), j = rest.indexOf("ask the user)."); return j < 0 ? "" : rest.slice(0, j + "ask the user).".length); };
    const SIGN = /spec_approve|dev-spec approve|approve `execution`|phase: "execution"|sign(?:s|ed)? off the `execution`/;
    const signSentences = (t) => t.split(/(?<=\.)\s+/).filter((s) => SIGN.test(s)).length;
    all("1.42 (S1 + UX-11, fix rounds 1-3): the residues — a defect that exists at HEAD and ships: pre-existing (deferred), a refutation real at HEAD (refuted as pre-existing or not in the diff AND its Exists at HEAD line yes — one predicate in §6, Closing and /spec-review branch), parked (real), an unconfirmed (NN) or a class place outside a task the final review let ship — the ones after the last `Residues filed:` line filed as ONE residue-<feature> backlog entry, the defect in the controller's own words, the note split at 2,000 characters; ONE closing order in Closing and /spec-finish (finish, the execution sign-off asked in one sentence, the residues, then the commit of what the run and the closing wrote, a file staged before it shown to the user — the same words in both, no sweeping add —, then the merge); /spec-finish step 4 merges the branch spec_finish's merge line names", {
      reviewerLabel: /one "Pre-existing \(deferred\)" line at most/.test(REV) && !/one "Out of scope \(deferred\)" line at most/.test(REV) &&
        /outside the fix diff → "Out of scope \(deferred\)", one line each — it never reopens the loop/.test(REV),
      ledgerKinds: ["Task 3: pre-existing (deferred): <one-liner>", "Task 3: parked (real) — ", "Task 3: parked (contested) — ", "Residues filed: residue-<feature> (3)"].every((l) => ledger.includes(l)) &&
        !/Task 3: parked — /.test(ledger),
      fixLoopRoutes: /Nor does a reviewer's `Pre-existing \(deferred\)` line \(a problem already there at BASE\): ledger it `pre-existing \(deferred\)` — a residue, filed at Closing\./.test(fix) &&
        /out-of-scope observations become deferred minors\./.test(fix) && !/out-of-scope observations[^.]*residue/.test(fix),
      breaker: /Reviewer wrong\/contestable → `parked \(contested\)` with a ruling; real but nothing builds on it → `parked \(real\)` with a ruling \(a residue, filed at Closing\)\./.test(fix),
      set: closing.includes("A residue is a defect that exists at HEAD and ships: a `pre-existing (deferred)` line, a refutation `real at HEAD` (§6: " + REAL + "), a `parked (real)` one, an `unconfirmed (NN)` finding or a class place outside a task the final review let ship — never a `parked (contested)` one or another refutation (") &&
        /never a `minor \(deferred\)` one/.test(closing),
      // R1-PROMPTS-02 + R2-PROMPTS-01: §6 ledgers a refutation as a residue on TWO verifier inputs — its reason and its Exists line
      refutedRealAtHead: sec6.includes("**Under 50** → refuted: ledger `refuted (NN, <why>)` and drop it — unless it is " + REAL + " (a real defect this diff didn't make): ledger `refuted (NN, <why>, real at HEAD)`, a residue, filed at Closing.") &&
        !/unless its `Exists at HEAD` line says yes/.test(sec6) &&
        ledger.includes("Task 3: refuted (0, pre-existing, real at HEAD): <one-liner>") && /- Exists at HEAD: /.test(VERIFIER),
      // one predicate, the same words, in the three texts that ledger it (R2-PROMPTS-01 / -04: /spec-review branch keyed on two other
      // lines and labelled the same verified fact `pre-existing (deferred)`, which Closing files as `unverified`)
      onePredicate: [sec6, closing, REVIEW].every((t) => t.split(REAL).length === 2) &&
        REVIEW.includes("and each one " + REAL + " (checked yourself: your answers to the first two questions) `Final review: refuted (NN, <why>, real at HEAD): …` — residues `/spec-finish` files (`subagent-execution.md` → Closing; any other refutation is none)") &&
        !/Final review: pre-existing \(deferred\)/.test(REVIEW) && !/real at HEAD that the branch did not introduce/.test(REVIEW),
      // its two reasons are the verifier template's own words, and every OTHER reason of the template is named as no residue — in
      // §6 and in Closing (an intended / silenced / no-rule / nitpick refutation says "Exists at HEAD: yes" and is no defect)
      reasonsFromTemplate: verdictReasons.length >= 7 && ["pre-existing", "not in the diff"].every((r) => verdictReasons.includes(r)) &&
        otherReasons.length === verdictReasons.length - 2 &&
        otherReasons.every((r) => excl6.split(", ").includes(r)) && otherReasons.every((r) => exclC.split(", ").includes(r)),
      // R3-PROMPTS-05 (mutants R3-m3 / R3-m4): and no contrary rule — neither exclusion list names a residue's own reason, and no
      // other sentence of §6 or Closing files a no-residue reason as a residue
      noContraryRule: excl6 !== "" && exclC !== "" && ["pre-existing", "not in the diff"].every((r) => !excl6.includes(r) && !exclC.includes(r)) &&
        contrary(sec6, excl6).length === 0 && contrary(closing, exclC).length === 0,
      name: /name: "residue-<feature>"/.test(closing) && /dev-spec backlog add residue-<feature> "residues: …"/.test(closing) && !/residue-<topic>/.test(SUB),
      ownWords: /<the defect, in your own words, never the reviewer's text>/.test(closing) && /<confidence NN \| ruling: why it shipped \| real at HEAD \| unverified>/.test(closing) &&
        /a pre-existing line or a class place never had a verify pass: `unverified`; a refutation real at HEAD: `real at HEAD` \(its confidence rated a fix round, not the defect\)/.test(closing),
      // R1-PROMPTS-10 + R2-PROMPTS-03: the ledger line is the mark (the engine dedupes a backlog note only on its exact text) — the
      // lines after the LAST one are the ones filed (kept the branch, ran more tasks, closed again: its later residues are new)
      once: closing.includes("**File the residues before the merge** — the residue lines after the ledger's last `Residues filed:` line (the ones above it are filed; no such line: every one).") &&
        /files the residues after its last `Residues filed:` line \(/.test(step4) && !/means they are filed|files its residues, once/.test(closing + FIN),
      split: /A note holds at most 2,000 characters — the rest goes in `residue-<feature>-2`, never truncated\./.test(closing),
      // R1-PROMPTS-01 / 05 + R2-PROMPTS-02 + R3-PROMPTS-01..03: the commit adds what the run and the closing wrote, after everything
      // that writes the spec state, in the SAME words in both texts — the index looked at first (a file staged before the closing
      // goes to the user), a file the run wrote added whole, only an unstaged / untracked change carried across the switch (never
      // asked on every close); a git-ignored .specs/ has nothing to commit (its add would refuse)
      commitState: commitIn(closing, "**Then commit the spec state with the feature** — ") === COMMIT &&
        commitIn(step4, "then commit the spec state with the feature — ") === COMMIT && step4.includes(COMMIT + " Offer exactly two options") &&
        !/user's work|is the user's, ask|porcelain -- \.specs|until it prints nothing|refuses while any of it/.test(closing + FIN) &&
        // fix round 2's promise, false for a staged change (R3-PROMPTS-01), gone from both
        !/any other uncommitted change|not lost and not committed/.test(closing + FIN),
      // R3-PROMPTS-05 (mutants R3-m1 / R3-m2): no sweeping add in either WHOLE text, with or without `--`, a trailing slash or a glob
      noSweepingAdd: !/git add (?:-A|--all|-u|\.(?=[\s`])|(?:-- )?\.specs\/?(?=[\s`*]))/.test(SUB + " " + FIN),
      // R2-PROMPTS-05: no recovery verb that parks or drops a change, in EITHER WHOLE text (the old key read Closing + step 4)
      noRecoveryVerb: !/\bstash\b|switch -f|--force|add -f|checkout --|reset --hard/.test(closing + FIN),
      // residues and the commit before the merge, after the sign-off — the same order in both files
      beforeMerge: (() => { const at = ["Ask the human to approve `execution`", "**File the residues before the merge**", "**Then commit the spec state with the feature**", "Then ask the human to choose: merge locally or keep the branch", "delete `.specs/<feature>/.execution/`"].map((s) => closing.indexOf(s));
        return at.every((i, k) => i > 0 && (k === 0 || at[k - 1] < i)); })() &&
        /One order, `\/spec-finish`'s: the finish, the `execution` sign-off, the residues, the commit, then the merge\./.test(closing),
      finishOrder: (() => { const at = [FIN.indexOf("call `spec_approve {name, phase: \"execution\"}` only on their yes"), FIN.indexOf(" 4. Before either option"), FIN.indexOf("files the residues after its last `Residues filed:` line"), FIN.indexOf("then commit the spec state with the feature — "), FIN.indexOf("Offer exactly two options")];
        return at.every((i, k) => i > 0 && (k === 0 || at[k - 1] < i)); })() &&
        // the sign-off asked in ONE sentence of each text, whatever its spelling (R2-PROMPTS-05: a second ask spelled as a call
        // survived a count of one spelling) — a second call after the options would be a second order
        signSentences(FIN) === 1 && signSentences(closing) === 1,
      listed: /your final message lists them after the rulings, with the line that drops the entry \(`dev-spec backlog rm residue-<feature>`\)/.test(closing) &&
        /git history and the backlog are the record now\./.test(closing),
      // R1-PROMPTS-04: the final review and /spec-review branch ledger their own pre-existing and 50–79 lines, so Closing files them;
      // step 4 keys on the ledger (a property), not on how the feature ran
      finalLedger: /Ledger its own lines as a task's are: a `Pre-existing \(deferred\)` line `Final review: pre-existing \(deferred\): …`, a verified 50–79 one `Final review: unconfirmed \(NN\): …`, a refutation real at HEAD with `real at HEAD` \(§6\) — Closing files them\./.test(ws(section(SUBX, "## Final review"))) &&
        /ledger each 50–79 one `Final review: unconfirmed \(NN\): …` and each one refuted as/.test(REVIEW),
      finishStep4: /^Before either option, a feature with a review ledger \(`\.specs\/<feature>\/\.execution\/ledger\.md`\) files the residues after its last `Residues filed:` line \(`\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/dev-spec-driven\/references\/subagent-execution\.md` → Closing/.test(step4) &&
        !/a feature run with subagents files/.test(FIN),
      finishBranch: /`git switch <base>`, then `git merge <branch>`: the branch `spec_finish`'s merge line names \(`feature\/<slug>` by default, `fix\/<slug>` for a bugfix\); without one, the branch you worked on, if it is not the base\./.test(step4) &&
        /A fast-forward when possible; a merge commit \(`--no-ff`, or branches that diverged\) takes the merge title and summary as its message/.test(step4) &&
        !/git merge <name>/.test(FIN) && !/already on the base/.test(FIN),
    });

    // S4(a): the duplicate detector before the TASK review. Its JSON goes to a file beside the package (§4's fence — so the
    // review-seat fixture, tied to the fence's output, follows), never into the controller's context; the REVIEWER keeps the
    // runs in the package's files (the path's tail: a monorepo's stat paths are the repository's, the detector's the project's).
    // A capped list is never a "none" (L8, L12): only counts.existing 0 is, and a list shorter than its total is the top DUP_TOP.
    const sec4 = section(SUBX, "### 4. Review package"), fence4 = (sec4.match(/```\n([\s\S]*?)```/) || [])[1] || "";
    const DUP_TOP = +((fs.readFileSync(path.join(root, "mcp", "lib", "engine", "dupes.js"), "utf8").match(/^const DUP_TOP = (\d+);/m) || [])[1]);
    const GUIDE = ws(raw("skills", "dev-spec-driven", "references", "code-reuse-and-quality.md")), EXEC = ws(raw("commands", "executeTask.md"));
    all("1.42 (S4a): the task review gets the duplicate detector's file — §4 writes it beside the package, never through the controller's context; the reviewer keeps the runs in the package's files (by the path's tail), says none only at counts.existing 0 neither truncated nor partial (fix round 1) and knows a list shorter than its total is the top " + DUP_TOP, {
      fenceLine: /^node "<clone>\/cli\/dev-spec\.js" dupes <feature> --json {2}> {2}\.specs\/<feature>\/\.execution\/task-N-dupes\.json$/m.test(fence4),
      notInContext: /The last line is the duplicate detector, run from the project root \(`<clone>`: the plugin's folder, as the tools' messages print it\): its runs go to the reviewer in that file, never through your context — the reviewer keeps the ones in the package's files\./.test(ws(sec4)),
      dispatch: /in \*\*task\*\* mode with: the brief path, the report path, the diff path, the detector's file \(`task-N-dupes\.json`, §4\), BASE\/HEAD/.test(SUB),
      cost: /one implementer \+ one reviewer per task, and one duplicate-detector run — seconds, its output kept in a file/.test(SUB),
      reviewerInput: /\*\*Task mode\*\* — one task's diff\. Inputs: [^\n]*the duplicate detector's file \(`task-N-dupes\.json`\)/.test(REV),
      reviewerFilter: /Task mode: the detector's file — a run counts when its place is a package `--stat` file \(by the path's tail: repository vs project paths\)/.test(REV),
      // (fix round 1, R1-PROMPTS-07) a zero the detector's own reading caps made (`truncated`: past DUP_FILE_CAP files; `partial`:
      // past DUP_TOTAL_BYTES — files never compared) is a capped zero, never a "none"; both keys are the detector's own
      noneOnlyAtZero: /only `counts\.existing` 0, not `truncated` and with no `partial`, is "none"/.test(REV) &&
        [/\btruncated: /, /\bpartial: \{/].every((re) => re.test(fs.readFileSync(path.join(root, "mcp", "lib", "engine", "dupes.js"), "utf8"))),
      capTold: Number.isInteger(DUP_TOP) && REV.includes("a `duplicates` list shorter than `total` is the top " + DUP_TOP + ", which can miss this task's run"),
      pinsKept: /the duplicate detector's `existing` runs first when the dispatch carries them/.test(REV) && /"Duplicated on purpose" is not/.test(REV),
      guide: /\(the task review, the final review, `\/spec-review branch` \/ `converge` run it first\)/.test(GUIDE),
      exec: /`dev-spec-driven:spec-reviewer` \(with the duplicate detector's file — subagent-execution\.md §4;/.test(EXEC),
    });

    // S6: a defect that comes back at ANOTHER place is fixed as a class. ONE trigger with its own predicate (L7 — not the review
    // panel's merge rule, which is the same place; not every NOT ADDRESSED, which the rounds / tier-up / breaker already answer);
    // the scope is the task's _Implements:_ files (a property, L1); a place outside them is ledgered for the final review, never
    // a NEEDS_CONTEXT / converge task mid-story. Ships unmeasured (no review-seat case drives fix rounds).
    // S3 (the one clause kept): a package too long for one Read is read in parts to its end, never through the shell.
    const IMPL = ws(raw("agents", "spec-implementer.md"));
    const classBullet = (fix.match(/- \*\*A defect that comes back at another place is a class\.\*\*(.*?)- \*\*Gates a fix can undo/) || [])[1] || "";
    all("1.42 (S6 + S3): a confirmed new breakage with an earlier finding's defect at another place is asked for as a class — every place in the task's _Implements:_ files, one fix, the re-review's ADDRESSED only when none is left; a place outside them ledgered for the final review; the reviewer reads a long package in parts, never through the shell", {
      trigger: /When the verify pass confirms new breakage whose defect — the input or state that breaks — an earlier finding of this task already named, at another place, the next round asks for the class/.test(classBullet) &&
        !/NOT ADDRESSED/.test(classBullet) && !/overlapping lines|Merge first/.test(classBullet),
      scope: /every place in the task's `_Implements:_` files that holds it, listed in the fix report, and one fix for all; its re-review gets the list\./.test(classBullet) && !/MERGE_BASE/.test(classBullet),
      outside: /A place outside those files is not this task's to fix: ledger `Task N: class outside the task — <place>` for the final review \(one it lets ship is a residue\)\./.test(classBullet) &&
        !/NEEDS_CONTEXT|converge/.test(classBullet),
      ledger: ["Task 3: class fix (round 2) — <the defect>, 3 places", "Task 3: class outside the task — <place>"].every((l) => ledger.includes(l)),
      finalTriage: /triages the ledger's deferred minors, unconfirmed and parked findings and the class places outside a task\./.test(SUB) &&
        /Triage the ledger's deferred minors, unconfirmed findings, parked findings and class places outside a task:/.test(REV),
      implementer: /A class fix: first list every `file:line` in your task's `_Implements:_` files that holds the defect, then one fix for all; a place outside them you only name\./.test(IMPL),
      reviewer: /A class finding is ADDRESSED only when every place listed is fixed and a search of the task's `_Implements:_` files finds no other\./.test(REV),
      readWhole: /\*\*Read the package once\*\* — one too long for a single Read in parts \(`offset` \/ `limit`\) to its last line, never through the shell \(it cuts long output\)\./.test(REV),
    });

    // The critic's gate rows (GATES' SK-P2 / SK-P3 / S15 as prose, REVIEW's SK-P6) — one cell each, read from the table row.
    // SK-P6 is a PROPERTY (would a user or caller notice the swap?), never a track list (L1); its exemptions are what the critic
    // can check — the feature's own story / summary, the steering (Grep), an approved artifact — never "the user's request" it
    // never sees (it starts fresh); always Minor (placement). SK-P3 asks per principle; the constitution stub is untouched (its
    // whole-file hash is doctor's steering-placeholder test and the steering importer's, isSteeringStub — the brief's "still a
    // template" test was UX-10, cut in review 1). S15 stays within 150 bytes: the critic is paid per pre-flight too.
    const CRITIC = raw("agents", "spec-critic.md");
    const cell = (cat) => (CRITIC.match(new RegExp("^\\| \\*\\*" + cat + "\\*\\* \\| (.*) \\|$", "m")) || [])[1] || "";
    const clarity = cell("Clarity"), consistency = cell("Consistency"), testability = cell("Testability");
    // (fix round 1, R1-PROMPTS-08) S15 exempts an AC that IS the check's result — the improvement-spec template's "the existing
    // tests stay green" / "0 findings" ACs, proven by the very check; still within the 150 bytes
    const s15 = "; a task citing an AC whose only `_Verify:_` is a project check naming no test of it, unless the AC is that check's result — it proves nothing broke";
    const p6 = (clarity.match(/; an AC naming an internal choice.*$/) || [""])[0];
    all("1.42 (SK-P6, SK-P3, S15, SK-P2): spec-critic flags an AC naming an internal choice no user or caller would notice swapped — Minor, unless the swap IS the feature, the steering sets it or an approved artifact does, never a bugfix's; asks each constitution principle answered; flags a task proved only by a project check unless the AC is that check's result (≤ 150 B); and ACs that repeat each other (fix round 1: only each other — contradiction still reaches the design, the constitution, Out of Scope)", {
      p6Property: /^; an AC naming an internal choice no user or caller would notice swapped \(a framework, database, library — not an endpoint path or a schema others read\): Minor, it belongs in the design/.test(p6),
      p6Exempt: /unless the swap IS the feature \(story or summary\), `\.specs\/steering\/` sets it \(Grep\) or an approved artifact the requirements follow; never a bugfix's criteria\.$/.test(p6),
      p6NotAList: !/\+api|\+data|\+port|the user's request|Important/.test(p6) && /words the glossary says to avoid \(the doctor's `glossary` check\)/.test(clarity),
      p3: /each principle of `constitution\.md` answered in the design's Constitution Check \(by number or name, with how the design meets it\) — "all principles respected" with none named is a finding\./.test(consistency),
      // (fix round 1, R1-PROMPTS-09) "repeat" is within the feature only — an AC restating a constitution principle or one the
      // design echoes is intended repetition; contradiction still reaches the design, the constitution and Out of Scope
      p2: /^ACs that repeat each other; ACs that contradict each other, the design, the constitution, or `Out of Scope`/.test(consistency) &&
        !/repeat each other, the design|contradict or repeat/.test(consistency),
      s15: testability.endsWith(s15 + ".") && Buffer.byteLength(s15) <= 150 && /^ACs no test could fail; test-plan rows that don't actually exercise the AC they claim to cover/.test(testability),
    });

    // fix round 1, R1-XPLUG-02 (prose, no new reader): with dev-guardian 3.18 a coverage note can also be findings the gate did
    // not count as new — verification.md's notes clause names that kind and says what it is, so the merge summary's count is read
    const VERI = ws(raw("skills", "dev-spec-driven", "references", "verification.md"));
    all("1.42 fix round 1 (R1-XPLUG-02): verification.md's coverage-notes clause names findings the gate did not count as new — never gating, findings it let through", {
      notes: VERI.includes("The merge summary also counts dev-guardian's coverage notes (taint timeouts, a baseline entry it could not read, findings the gate did not count as new — never gating, though the last are findings it let through: `finish --run` prints the first notes)."),
    });
  }

  // Release hygiene: the three version fields agree.
  const vRoot = path.join(__dirname, "..");
  const vPkg = require(path.join(vRoot, "package.json")).version;
  const vPlugin = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "plugin.json"), "utf8")).version;
  const vMkt = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "marketplace.json"), "utf8")).plugins[0].version;
  ok(vPkg === vPlugin && vPlugin === vMkt, `package.json / plugin.json / marketplace.json versions agree (${vPkg} / ${vPlugin} / ${vMkt})`);
};

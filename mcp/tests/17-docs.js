"use strict";
// Docs and prose — the skill, commands, agents, README and rule files agree with the engine; release hygiene.
// The maintainer notes, no PR / CI steering, the docs' worked examples, the test counts, the three version fields.

const fs = require("fs");
const path = require("path");

// Runs after 01-core, in the same process: it reads ctx.vDir — the v1.12 project whose login-loop feature 01-core took to its finish (the prose guard reads its merge summary).
exports.deps = ["01-core"];
exports.run = async ({
  ok, S, root, tmp, libSources, maintainerNotes, approveBefore, init, list, require, __dirname, vDir,
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
    const claude15 = docText("CLAUDE.md");
    const log15 = docText("CHANGELOG.md").split(/\n## \[/)[1] || "";
    const counts15 = [(claude15.match(/\((\d+) assertions, incl\./) || [])[1], (claude15.match(/`node cli\/test-cli\.js` adds (\d+)/) || [])[1],
      (log15.match(/`node mcp\/test\.js` (\d+) assertions/) || [])[1], (log15.match(/`node cli\/test-cli\.js` (\d+)/) || [])[1]];
    ok(stale15.length === 0 && counts15.every(Boolean) && counts15[0] === counts15[2] && counts15[1] === counts15[3],
      "README / INSTALL / llms-install / CONTRIBUTING hard-code no test count; CLAUDE.md and the current CHANGELOG entry state the same mcp / cli totals (stale: " +
      stale15.join(", ") + "; CLAUDE.md " + counts15.slice(0, 2).join("/") + " vs CHANGELOG " + counts15.slice(2).join("/") + ")");
  }

  // Prose regressions: the skill must describe the engine honestly (loops tick with evidence, examples
  // pass its own linter), stay compact, and every user-facing surface must agree with it.
  const docsRead = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
  const docsRef = (f) => docsRead("skills", "dev-spec-driven", "references", f);
  const docsSkill = docsRead("skills", "dev-spec-driven", "SKILL.md");
  const docsDesc = ((docsSkill.match(/^description: >\r?\n([\s\S]*?)\r?\n---/m) || [])[1] || "").split(/\r?\n/).map((l) => l.trim()).join(" ").trim();
  // 1.26: the description is intent-based — what the user wants (plan before coding, fix a bug properly, adopt specs, a
  // roadmap, update the specs after a plugin update) — and SAYS it works in Portuguese and Spanish instead of listing their
  // trigger phrases (280 of its 1,011 characters); ≤ ~600 characters, the near-miss exclusions kept.
  ok(docsDesc.length > 200 && docsDesc.length <= 620 && /Not for trivial edits, requirements\.txt/.test(docsDesc) && /eval\(\) or an LLM/.test(docsDesc) &&
    /Works in English, Portuguese and Spanish/.test(docsDesc) && !/antes de|especificar|corrige|arregla|atualizar|actualizar/.test(docsDesc) &&
    /before coding/.test(docsDesc) && /fix a reported bug/.test(docsDesc) && /existing codebase/.test(docsDesc) && /roadmap/.test(docsDesc) &&
    /update the specs/.test(docsDesc) && /after a dev-spec-driven update/.test(docsDesc) && !/^## When to use this skill/m.test(docsSkill) && !/\| Replaces \|/.test(docsSkill) && !/^\*\*One sentence:\*\*/m.test(docsSkill),
    `SKILL.md description is intent-based, says it works in EN / PT / ES (no literal PT / ES trigger list), scoped ("Not for …") and ≤ 620 chars (${docsDesc.length}); no in-body trigger list, Replaces column or closing summary`);
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
      ["engine first, then tool AND subcommand AND test", /add it to the engine module of its concern first .* then wire it into server\.js \(tool\) AND cli\/commands\.js \(subcommand — one entry of its table\) AND a test in the area's mcp\/tests file\. Keep the CLI and MCP behavior identical/],
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
  ok(agentFiles.sort().join() === "spec-critic.md,spec-implementer.md,spec-reviewer.md,spec-simplifier.md,spec-verifier.md" &&
    agentTools("spec-critic.md").join() === "tools: Read, Grep, Glob" &&
    agentTools("spec-reviewer.md").join() === "tools: Read, Grep, Glob, Bash, PowerShell" &&
    agentTools("spec-verifier.md").join() === "tools: Read, Grep, Glob, Bash, PowerShell" &&
    agentTools("spec-implementer.md").join() === "tools: Read, Write, Edit, Glob, Grep, Bash, PowerShell" &&
    agentTools("spec-simplifier.md").join() === "tools: Read, Write, Edit, Glob, Grep, Bash, PowerShell" &&
    agentFiles.every((a) => agentDesc(a).length > 80 && agentDesc(a).length <= 250 && !/When to invoke|agent body/.test(agentDesc(a))) &&
    !/read-only/i.test(agentDesc("spec-reviewer.md")) && /never edits code/i.test(agentDesc("spec-reviewer.md")) && /never edits code/i.test(agentDesc("spec-verifier.md")) &&
    Buffer.byteLength(fs.readFileSync(path.join(agentsDir, "spec-verifier.md"), "utf8")) <= 4000 && !/^## Verify mode$/m.test(fs.readFileSync(path.join(agentsDir, "spec-reviewer.md"), "utf8")),
    "5 plugin agents: the critic is read-only (Read, Grep, Glob), the reviewer and the verifier add a shell, the implementer and the simplifier Write/Edit and a shell — Bash and (1.23 review 5) PowerShell: Claude Code on Windows without Git Bash has only the PowerShell tool, and a tools list with an unresolved entry still launches — none gets the Agent tool; every description ≤ 250 characters with no pointer to the body, the reviewer's says 'never edits code' (it has a shell), the verifier ≤ 4 KB and the reviewer has no verify mode left (1.26; got " +
    JSON.stringify(agentFiles.map((a) => a + " " + agentDesc(a).length)) + ")");
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
    ok(d4Files.length === 28 && d4Bad.length === 0 && d4Report && /^Reports from the specs: the living catalog, drift since finish/.test(d4Report.description),
      "full review D4: all 22 commands + 5 agents + SKILL.md front matter parse as strict key: value YAML (bad: " + d4Bad.join(", ") + "); the prompts reader still reads spec-report's quoted description");
    // D5: guard is a string enum on | off | scope — the docs told agents to pass guard: true / false.
    const d5Docs = [dRead("commands", "spec-setup.md"), dRef("tooling-reference.md")]; // 1.26: /spec-guard + /spec-init → /spec-setup guard | init
    const d5Schema = list.result.tools.find((t) => t.name === "spec_init").inputSchema.properties.guard;
    ok(d5Schema.type === "string" && d5Schema.enum.join() === "on,off,scope" &&
      d5Docs.every((t) => !/guard: (?:true|false)\b|`true` \/ `"scope"`|`true` \/ `false`/.test(t) && /"on"/.test(t) && /"off"/.test(t) && /"scope"/.test(t)),
      "full review D5: /spec-setup (guard, init) and the tooling reference pass guard as \"on\" / \"off\" / \"scope\" (the schema's string enum)");
    // D6: spec_approve's description lists every execution check (suite-evidence; a spike's spike / decision), one line.
    const d6Desc = list.result.tools.find((t) => t.name === "spec_approve").description;
    // (1.26: the per-phase check lists left the description and /approve — a refusal names its failing check ids; /approve still
    // says what gates `execution`)
    ok(!/\n/.test(d6Desc) && /REFUSES it while the phase's checks fail/.test(d6Desc) && /spec_finish's blockers[\s\S]{0,400}`suite-evidence`/.test(dWs(dRead("commands", "approve.md"))),
      "full review D6: spec_approve's description says the gate refuses while the phase's checks fail; /approve names the execution gate's suite-evidence");
    // 1.21 review A8: no tool description runs two sentences together (spec_approve read "…the user runs).WAIVERS:")
    const runTogether = list.result.tools.map((t) => [t.name, (t.description.match(/[a-z)\]`'"]\.[A-Z]{3,}/g) || [])]).filter((x) => x[1].length);
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
    // more — 10-guards-review6 checks they stay short English; kept as a guard should a Spanish one come back.) 1.26: the ES
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

  // Release hygiene: the three version fields agree.
  const vRoot = path.join(__dirname, "..");
  const vPkg = require(path.join(vRoot, "package.json")).version;
  const vPlugin = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "plugin.json"), "utf8")).version;
  const vMkt = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "marketplace.json"), "utf8")).plugins[0].version;
  ok(vPkg === vPlugin && vPlugin === vMkt, `package.json / plugin.json / marketplace.json versions agree (${vPkg} / ${vPlugin} / ${vMkt})`);
};

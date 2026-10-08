"use strict";
// Tracks — track input, scaffolds and mandatory sections per track, add_track / remove, track packs.
// The project-defined track packs (.specs/tracks/<name>/): loading, validation, rendering, gates, spec_tracks.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, root, tmp, approveBefore, __dirname }) => {

  { // --- 1.13 WP2: tracks, scaffolds & sections (own block scope: no name clashes with other packages) ---
  const w2 = path.join(tmp, "proj-wp2");
  const w2s = path.join(w2, ".specs");
  S.initProject(w2, ["core"], "en");
  const readW2 = (...p) => fs.readFileSync(path.join(w2s, ...p), "utf8");
  const stateW2 = (slug) => JSON.parse(readW2(slug, ".state.json"));
  const headingCount = (md, marker) => md.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l) && l.includes(marker)).length;

  // (1) persisted tracks; legacy detection only trusts markers on real headings
  const pf1 = S.createFeature(w2, "Invoice export", ["tdd"]);
  ok(stateW2("invoice-export").tracks.join() === "core,tdd", "spec_create persists the track set in .state.json");
  const leg = S.createFeature(w2, "Legacy Diagram", ["core"]);
  fs.writeFileSync(path.join(leg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {} })); // a pre-1.13 feature
  fs.appendFileSync(path.join(leg.dir, "design.md"), "\n```mermaid\ngraph TD\n  UI --> X[AI]\n  X --> Q[SaaS]\n```\nThe [AI] helper is out of scope.\n");
  const legDoc = S.specDoctor(w2, "legacy-diagram");
  const legAdd = S.addTrack(w2, "legacy-diagram", "ai");
  ok(legDoc.tracks === "core" && !legDoc.checks.some((c) => c.id === "ai-sections" || c.id === "saas-sections") && legAdd.addedTracks.join() === "ai" &&
    headingCount(fs.readFileSync(path.join(leg.dir, "design.md"), "utf8"), "[AI]") === 10,
    "a Mermaid node X[AI] / prose [AI] no longer switches a track on (doctor, add_track 'already on')");

  // (2) track input: arrays or strings, split on space/comma/'+', case-insensitive; unknown → did-you-mean
  ok(S.parseTracks("tdd,saas").tracks.join() === "core,tdd,saas" && S.parseTracks("+SaaS +ai").tracks.join() === "core,saas,ai" &&
    S.parseTracks(["tdd saas"]).tracks.join() === "core,tdd,saas" && S.parseTracks(["TDD", "+ai"]).tracks.join() === "core,tdd,ai",
    "track input is split on whitespace, commas and '+' (arrays and strings), case-insensitive, core implied");
  const badCreate = S.createFeature(w2, "Typo Feature", "tdd,sass");
  ok(badCreate.ok === false && /'sass'/.test(badCreate.error) && /did you mean 'saas'/.test(badCreate.error) && /core, tdd, saas, ai/.test(badCreate.error) &&
    !fs.existsSync(path.join(w2s, "typo-feature")), "an unknown track is an error with a did-you-mean (nothing scaffolded, no silent drop)");
  const mcpBad = await rpc("tools/call", { name: "spec_create", arguments: { name: "Typo MCP", tracks: ["sass"], projectDir: w2 } });
  const mcpBadInit = payload(await rpc("tools/call", { name: "spec_init", arguments: { tracks: ["ia"], projectDir: w2 } }));
  const mcpBadAdd = payload(await rpc("tools/call", { name: "spec_add_track", arguments: { name: "invoice-export", track: "sass", projectDir: w2 } }));
  ok(mcpBad.result.isError === true && /did you mean 'saas'/.test(mcpBad.result.content[0].text) && /did you mean 'ai'/.test(mcpBadInit.error) && /did you mean 'saas'/.test(mcpBadAdd.error),
    "MCP spec_create / spec_init / spec_add_track reject unknown tracks the same way");
  const ptW2 = path.join(tmp, "proj-wp2-pt");
  S.initProject(ptW2, ["core"], "pt");
  ok(/querias dizer 'saas'/.test(S.createFeature(ptW2, "Exportar", ["sass"]).error), "the unknown-track error is localized (PT)");

  // (3) spec_create on an EXISTING feature with new tracks → the add_track path (never overwrites)
  const reqBefore = readW2("invoice-export", "requirements.md");
  const again3 = S.createFeature(w2, "Invoice export", "saas");
  const des3 = readW2("invoice-export", "design.md");
  ok(again3.ok && again3.label === "core +tdd +saas" && again3.addedTracks.join() === "saas" && headingCount(des3, "[SaaS]") === 5 &&
    fs.existsSync(path.join(w2s, "invoice-export", "load-test.md")) && stateW2("invoice-export").tracks.join() === "core,tdd,saas" &&
    readW2("invoice-export", "requirements.md") === reqBefore && /already existed/.test(again3.note),
    "spec_create with a new track on an existing core+tdd feature adds it (design sections, load-test, state) — label [core +tdd +saas]");
  const same3 = S.createFeature(w2, "Invoice export", "tdd");
  ok(same3.ok && !same3.addedTracks && same3.created.length === 0 && same3.label === "core +tdd +saas", "spec_create with no new track keeps the plain additive behavior");

  // (4) add_track completeness: Active Tracks line, steering, template tasks once, localized bugfix design title
  const tasks4 = readW2("invoice-export", "tasks.md");
  ok(/^## Active Tracks\ncore \+tdd \+saas$/m.test(readW2("invoice-export", "classification.md")) &&
    ["scale.md", "observability.md", "cost.md"].every((x) => fs.existsSync(path.join(w2s, "steering", x))) &&
    (tasks4.match(/## Story US-1 — Observability & Scale/g) || []).length === 1 && /- \[ \] 7\. \[US1\] Emit metrics/.test(tasks4),
    "add_track path updates classification Active Tracks, scaffolds the track's steering and appends its template tasks (numbered on)");
  const tr4 = S.traceCheck(w2, "invoice-export");
  S.addTrack(w2, "invoice-export", "saas"); S.createFeature(w2, "Invoice export", "saas");
  ok(tr4.phantomAcsInTasks.length === 0 && (readW2("invoice-export", "tasks.md").match(/Observability & Scale/g) || []).length === 1,
    "appended track tasks never cite ACs the spec lacks (no phantom IDs) and are appended only once");
  const pt4 = S.createFeature(ptW2, "Painel", ["core"]);
  S.addTrack(ptW2, "painel", "ai");
  ok(/^## Tracks Ativos\ncore \+ai$/m.test(fs.readFileSync(path.join(pt4.dir, "classification.md"), "utf8")) &&
    /## História US-1 — IA/.test(fs.readFileSync(path.join(pt4.dir, "tasks.md"), "utf8")), "add_track updates the PT 'Tracks Ativos' line and appends the PT task block");
  const esW2 = path.join(tmp, "proj-wp2-es");
  S.initProject(esW2, ["core"], "es");
  const esBug = S.createFeature(esW2, "Error de pago", undefined, "falla el cobro", undefined, undefined, "bugfix");
  S.addTrack(esW2, "error-de-pago", "saas");
  const esPagos = S.createFeature(esW2, "Pagos", ["core"]);
  S.addTrack(esW2, "pagos", "tdd");
  ok(/^# Diseño: /.test(fs.readFileSync(path.join(esBug.dir, "design.md"), "utf8")) && /^## Tracks Activos\ncore \+tdd$/m.test(fs.readFileSync(path.join(esPagos.dir, "classification.md"), "utf8")) &&
    fs.existsSync(path.join(esW2, ".specs", "steering", "testing-standards.md")),
    "add_track on a bugfix writes a localized design title (ES '# Diseño:'); the ES 'Tracks Activos' line and steering follow");

  // (5) removal: non-destructive, core can't go, a bugfix keeps +tdd; doctor/status/next_action stop requiring it
  const rmSaas = payload(await rpc("tools/call", { name: "spec_add_track", arguments: { name: "invoice-export", track: "saas", remove: true, projectDir: w2 } }));
  const docRm = S.specDoctor(w2, "invoice-export");
  ok(rmSaas.ok && rmSaas.removedTracks.join() === "saas" && rmSaas.tracks === "core +tdd" && rmSaas.inactive.includes("load-test.md") &&
    rmSaas.inactive.some((x) => /\[SaaS\]/.test(x)) && fs.existsSync(path.join(w2s, "invoice-export", "load-test.md")) &&
    headingCount(readW2("invoice-export", "design.md"), "[SaaS]") === 5 && stateW2("invoice-export").tracks.join() === "core,tdd" &&
    /^## Active Tracks\ncore \+tdd$/m.test(readW2("invoice-export", "classification.md")),
    "spec_add_track remove:true turns +saas off — every file kept, inactive artifacts listed, state + Active Tracks updated");
  ok(!docRm.checks.some((c) => c.id === "saas-sections") && S.statusFeature(w2, "invoice-export").scaleSections === null &&
    !/\*\*invoice-export\*\* — design has unfilled/.test(S.renderRoadmapMd(w2, "en")),
    "after removal doctor/status/roadmap stop requiring the +saas sections");
  const aiRm = S.createFeature(w2, "Ai Gone", ["ai"]);
  S.approvePhase(w2, "ai-gone", "requirements", undefined, { force: true }); S.approvePhase(w2, "ai-gone", "design", undefined, { force: true }); // templates: 1.13 gate
  S.removeTrack(w2, "ai-gone", "ai");
  ok(!S.specDoctor(w2, "ai-gone").pendingGates.includes("eval-plan") && !/eval-plan/.test(S.nextAction(w2, "ai-gone").recommendation) && fs.existsSync(path.join(aiRm.dir, "eval-plan.md")),
    "an inactive track's artifact is no longer an approval gate (doctor, next_action) — and it is still on disk");
  const vBug = path.join(tmp, "proj-wp2-bug"); // this section's own bugfix (the sections run in parallel, apart from main's)
  S.createFeature(vBug, "Login Loop", undefined, "users bounce back to /login", undefined, "en", "bugfix");
  ok(S.addTrack(w2, "invoice-export", "core", { remove: true }).ok === false && /core/.test(S.addTrack(w2, "invoice-export", "core", { remove: true }).error) &&
    S.removeTrack(vBug, "login-loop", "tdd").ok === false && /bugfix/i.test(S.removeTrack(vBug, "login-loop", "tdd").error),
    "'core' can't be removed; a bugfix can't drop +tdd");

  // (6) placeholder helpers
  const phText = [
    "# Feature: x", "## Summary", "[1-2 sentences: what this does and why it matters]",
    "1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior] within $[0.03]",
    "- [ ] tick me · - see [RFC 7519](https://x) ![img](a.png) [ref][r1] [r1] [^1] [[Wiki]] `code [x]` items[0]",
    "- [x] done [US1][P] [shared] [SaaS] [AI] [US-1.AC-1, T-01] [NEEDS CLARIFICATION: which?] [P1] [US-2]",
    "> **TODO** — replace me", "<!-- [inside comment] -->", "```", "[inside fence]", "```", "[r1]: https://example.com",
    "| T-01 | unit | `[path]` |", "> [!NOTE] a callout",
  ].join("\n");
  const ph = S.placeholderReport(phText).map((p) => p.line + ":" + p.text);
  ok(ph.join("|") === "3:[1-2 sentences: what this does and why it matters]|4:[trigger]|4:[behavior]|4:[0.03]|7:> **TODO** — replace me|13:[path]",
    "placeholderReport flags bracketed prose + the TODO sentinel, never links/refs/footnotes/checkboxes/tags/IDs/NEEDS CLARIFICATION/comments/fences (got " + ph.join("|") + ")");
  const ptReqFresh = fs.readFileSync(path.join(pt4.dir, "requirements.md"), "utf8");
  const esReqFresh = fs.readFileSync(path.join(esBug.dir, "requirements.md"), "utf8");
  ok(S.artifactState(path.join(w2s, "nope.md")) === "missing" && S.artifactState({ file: path.join(pt4.dir, "requirements.md") }) === "placeholder" &&
    S.artifactState({ text: esReqFresh }) === "placeholder" && S.artifactState({ text: "# Title\n\n## Summary\n" }) === "placeholder" &&
    S.artifactState({ text: "## Summary\nShips invoices as CSV.\n" }) === "filled" && S.artifactState({ text: "## A\nsame text\n" }, { template: "## A\n  same   text" }) === "placeholder" &&
    S.placeholderReport(ptReqFresh).length > 10, "artifactState: missing / placeholder (EN/PT/ES templates, heading-only, == template) / filled");

  // (7) phase + % for fresh scaffolds; template track tasks are placeholder tasks
  const fr = ["saas", "ai", "tdd"].map((t) => S.createFeature(w2, "Fresh " + t, [t]));
  const rmv7 = S.roadmap(w2).features;
  ok(fr.every((x) => S.statusFeature(w2, x.slug).phase === "requirements") && fr.every((x) => rmv7.find((f) => f.name === x.slug).percent === 8),
    "a fresh +saas/+ai/+tdd scaffold is in 'requirements' at 8% (not tasks-ready 30% / test-plan 20%)");
  ok(S.isPlaceholderTask("[US1] Emit metrics, add dashboard, configure alerts") && S.isPlaceholderTask("[US1] Monitorização de custo — emitir métrica de custo + alerta") &&
    !S.isPlaceholderTask("[shared] Reproduce the bug reliably and write the steps in bug.md → Reproduction") && !S.isPlaceholderTask("[US1] Emit invoice metrics to Prometheus"),
    "template track tasks count as placeholders (EN/PT) until edited; the verbatim bugfix steps are the method, not placeholders");
  fs.writeFileSync(path.join(fr[0].dir, "requirements.md"), "## Summary\nExport invoices.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL export CSV.\n");
  const ph7a = S.statusFeature(w2, fr[0].slug).phase;
  fs.appendFileSync(path.join(fr[0].dir, "tasks.md"), "\n## Real\n- [ ] 20. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1_\n");
  ok(ph7a === "design" && S.statusFeature(w2, fr[0].slug).phase === "tasks-ready", "filled requirements → 'design'; one real task → 'tasks-ready' (task-driven model kept)");

  // (8) listFeatures ignores dot-folders and non-addressable names; _archive and legacy slugs keep working
  fs.mkdirSync(path.join(w2s, ".obsidian"), { recursive: true });
  fs.mkdirSync(path.join(w2s, "My Notes"), { recursive: true });
  fs.mkdirSync(path.join(w2s, "fatura-o"), { recursive: true });
  const lf8 = S.listFeatures(w2);
  ok(!lf8.features.some((f) => f.name === ".obsidian" || f.name === "My Notes") && lf8.features.some((f) => f.name === "fatura-o") &&
    lf8.ignored.join() === "My Notes" && !S.roadmap(w2).features.some((f) => f.name === ".obsidian"),
    "listFeatures/roadmap skip .obsidian and 'My Notes' (reported as ignored); legacy slug folders stay listed");

  // (9) extractSection never matches the H1 title
  const wk = S.createFeature(w2, "Weekly summary email", ["core"]);
  const ptWk = S.createFeature(ptW2, "Resumo semanal", ["core"]);
  ok(S.finishFeature(w2, wk.slug).mergeTitle === "feat(weekly-summary-email): weekly-summary-email" && !/##/.test(S.finishFeature(ptW2, ptWk.slug).mergeTitle) &&
    S.extractSection("# Feature: Weekly summary email\n\n## Summary\nReal one.\n", ["summary"]).trim() === "Real one." &&
    S.extractSection("## [AI] 3. Token Economics\nx\n## Tokens\ny", ["token economics"]).trim() === "x" && S.extractSection("## Fixtures\nz", ["fix"]) === null,
    "extractSection skips the H1 (feature names contain synonyms), matches after marker/numbering, at a word boundary");
  const aiRef = S.createFeature(w2, "Ai Reference", ["ai"]);
  fs.copyFileSync(path.join(root, "skills", "dev-spec-driven", "references", "mandatory-ai-design-sections.md"), path.join(aiRef.dir, "design.md"));
  ok(S.specDoctor(w2, "ai-reference").checks.find((c) => c.id === "ai-sections").status === "pass", "the AI reference design ('## Section 1: Model Strategy' headings) still has all 10 sections filled");
  const fx = S.createFeature(w2, "Fix login crash", undefined, "crash on login", undefined, "en", "bugfix");
  const fxBug = path.join(fx.dir, "bug.md");
  fs.writeFileSync(fxBug, fs.readFileSync(fxBug, "utf8").replace(/## Fix\n\[[^\n]*\]/, "## Fix\nGuard the null session."));
  const fxSum = S.finishFeature(w2, fx.slug).mergeSummary;
  ok(/## Fix\nGuard the null session\.\n/.test(fxSum) && !/## Reproduction/.test(fxSum) && !/# Bug:/.test(fxSum), "a bugfix named 'Fix …' gets only its Fix section in the merge summary");

  // (10) status reports present AND filled, agreeing with doctor
  const st10 = S.statusFeature(w2, fr[0].slug);
  const doc10 = S.specDoctor(w2, fr[0].slug).checks.find((c) => c.id === "saas-sections");
  // The filled reference template, in this section's own project (the sections run in parallel, apart from main's fixtures).
  const tplDir = path.join(tmp, "proj-wp2-tpl");
  const tplF = S.createFeature(tplDir, "Tpl", ["saas"]);
  fs.copyFileSync(path.join(root, "skills", "dev-spec-driven", "references", "scale-design-template.md"), path.join(tplF.dir, "design.md"));
  ok(st10.scaleSections.every((s) => s.present && s.filled === false) && doc10.status === "fail" && S.statusFeature(tplDir, "tpl").scaleSections.every((s) => s.filled),
    "status scaleSections carry present + filled (fresh: present, unfilled — same as doctor; the filled template: all filled)");

  // (11) creating a feature removes its backlog entry
  S.backlog(w2, "add", "SSO Login", "SAML");
  S.backlog(w2, "add", "Exports v2");
  const sso = S.createFeature(w2, "sso-login", ["core"]);
  ok(sso.removedFromBacklog.join() === "SSO Login" && S.backlog(w2).backlog.map((b) => b.name).join() === "Exports v2", "spec_create drops the backlog item with the same slug");

  // --- review fixes ---
  // placeholderReport: literals in code spans and number intervals are code/data, not placeholders
  const lit = S.placeholderReport('returns `[]`, `["read", "write"]`, `[0, 1]`, `[chunk:ID]` or `[a-z]`; score in [0, 1]; file `[path]`; slot: []; ≥ [85]%').map((x) => x.text);
  ok(lit.join("|") === "[path]|[]|[85]",
    "placeholderReport: code-span literals ([], [\"a\"], [0, 1], [chunk:ID], [a-z]) and number intervals are not placeholders; `[path]`, a bare [] slot and [85] still are (got " + lit.join("|") + ")");
  const keys = S.createFeature(w2, "Keys", ["core"]);
  fs.writeFileSync(path.join(keys.dir, "requirements.md"), "# Feature: Keys\n\n## Summary\nList API keys.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a tenant has no keys THE SYSTEM SHALL return `[]`.\n");
  ok(S.statusFeature(w2, keys.slug).phase === "design", "an AC that returns `[]` does not send a filled feature back to 'requirements'");
  // inline code is code even when it is bracketed words; only the templates' own `[path]`/`[caminho]`/`[ruta]` open up
  const words = S.placeholderReport("xUnit `[Fact]` · `[Authorize]` · Cargo `[dependencies]` · ini `[database]` · regex `[aeiou]` · `[Serializable]` `[HttpGet]`; PT `[caminho]`, ES `[ruta]`").map((x) => x.text);
  ok(words.join("|") === "[caminho]|[ruta]", "placeholderReport: C# attributes, TOML/INI tables and regex classes in code spans are code; PT `[caminho]` / ES `[ruta]` still are placeholders (got " + words.join("|") + ")");
  // RE_STABLE_BRACKET is linear: a bracket of space-separated IDs followed by a word used to backtrack 2^k (26 IDs ≈ 9 s,
  // freezing the MCP server and timing the hooks out). 40 single- and double-spaced IDs must take milliseconds.
  const redosT0 = Date.now();
  const redos = [S.placeholderReport("[" + "US-1 ".repeat(40) + "x]"), S.placeholderReport("Related: [" + Array.from({ length: 40 }, (_, i) => "US-" + (1 + (i % 3)) + ".AC-" + i).join("  ") + " and follow-ups]"),
    S.placeholderReport("[" + "US-1 ".repeat(40) + "[trigger]]")];
  const redosMs = Date.now() - redosT0;
  ok(redosMs < 500 && !redos[0].length && !redos[1].length && redos[2].map((p) => p.text).join() === "[trigger]" && !S.placeholderReport("[US-1.AC-1 T-01] [US-1.AC-1, T-01] [US-1.AC-1/T-01] [US-1.AC-1T-01]").length,
    "placeholderReport: 40 space-separated IDs + a word in one bracket is checked in linear time (" + redosMs + " ms) and is content (no template writes it); a template slot nested inside it is still found; ID lists (space, comma, slash, glued) stay exempt");
  // A bracket is a placeholder only when a template writes that text: written-out lists, values and prose of the user's own
  // are content (approved 1.12 specs quote them in ACs); the templates' own brackets — enumerations included — stay placeholders.
  const enums = S.placeholderReport([
    "1. **US-1.AC-1** — WHEN an admin exports THE SYSTEM SHALL download a CSV with the columns [id, number, amount_cents, issued_at].",
    "2. **US-1.AC-2** — IF the user's role is not one of [owner, admin] THEN THE SYSTEM SHALL return HTTP 403 for [GET | POST] and [`draft`, `sent`] or [\"read only\", \"admin\"].",
    "Mocks: [factories, fixtures, seeds] · [GDPR | PCI | HIPAA | SOC2 | none] · [rede, fs, tempo, serviços externos] · [Consultivo | Semi-autónomo | Autónomo]",
    "Content: [e.g., Redis] · [a, b c] · [optional] · [ , ] — slots: [trigger] · [Story   title] · [e.g., 90% of users complete checkout in under [N] seconds]",
  ].join("\n")).map((x) => x.line + ":" + x.text);
  const enumReq = "# Feature: Export\n\n## Summary\nExport invoices.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV with the columns [id, number, amount_cents, issued_at].\n2. **US-1.AC-2** — IF the user's role is not one of [owner, admin] THEN THE SYSTEM SHALL return HTTP 403.\n";
  ok(enums.join("|") === "3:[factories, fixtures, seeds]|3:[GDPR | PCI | HIPAA | SOC2 | none]|3:[rede, fs, tempo, serviços externos]|3:[Consultivo | Semi-autónomo | Autónomo]|4:[trigger]|4:[Story   title]|4:[N]" &&
    S.artifactState({ text: enumReq }) === "filled" && !S.earsValidate(enumReq).issues.some((i) => i.code === "placeholder"),
    "placeholderReport: written-out enumerations ([id, amount_cents], [owner, admin], [GET | POST], code/quoted items) and the user's own bracketed prose are content — not in the gate, not an EARS 'placeholder' warning; the templates' texts (enumerations too; case/spacing ignored) and a slot left inside a half-edited template sentence still are (got " + enums.join("|") + ")");
  // Real bracketed values in a criterion (the 1.13 acceptance repro) are content everywhere: the approval, doctor, EARS;
  // the generic unfilled tokens (TODO / TBD / TBC / FIXME / … / "por definir") are placeholders, "todo" (a PT/ES word) is not.
  const quota = S.createFeature(w2, "Plan quotas", ["core"]);
  const quotaReq = "# Feature: Plan quotas\n\n## Summary\nPer-plan request quotas.\n\n## User Stories\n\n### US-1 (P1 — MVP): Enforce quotas\n**As an** operator, **I want** quotas, **so that** no tenant starves the others.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — THE SYSTEM SHALL apply the per-minute quotas [free: 60, pro: 600, enterprise: 6000].\n" +
    "2. **US-1.AC-2** — WHEN a user's role is one of [admin, billing-manager, read only] THE SYSTEM SHALL allow uploads up to [10 MB, 25 MB for pro].\n\n" +
    "## Success Criteria\n- **SC-001** — zero noisy-neighbour incidents.\n";
  fs.writeFileSync(path.join(quota.dir, "requirements.md"), quotaReq);
  approveBefore(w2, quota.slug, "requirements");
  const quotaAp = S.approvePhase(w2, quota.slug, "requirements");
  const generic = S.placeholderReport("[TODO] · [TBD: pricing] · [tbc] · [FIXME later] · [...] · [ … ] · [por definir] · [todo] · [TODOs list] · [fill me in]").map((x) => x.text).join("|");
  ok(quotaAp.ok && !quotaAp.forced && !S.placeholderReport(quotaReq).length && !S.earsValidate(quotaReq).issues.some((i) => i.code === "placeholder") &&
    generic === "[TODO]|[TBD: pricing]|[tbc]|[FIXME later]|[...]|[ … ]|[por definir]|[fill me in]",
    "real bracketed values ([free: 60, pro: 600, enterprise: 6000], [admin, billing-manager, read only], [10 MB, 25 MB for pro]) never block the requirements approval nor read as EARS placeholders; TODO/TBD/TBC/FIXME/…/'por definir' and the init stub's [fill me in] do, 'todo' does not (got " +
    JSON.stringify([quotaAp.ok, quotaAp.error, generic]) + ")");
  // Every bracket text a scaffold writes is in the set, in every language, track combination and kind — and the 1.12.1
  // texts are kept (a spec scaffolded by 1.12 still holds them): each fresh chain artifact reads 'placeholder'.
  const everyScaffold = [];
  for (const l of ["en", "pt", "es"]) {
    const d = path.join(tmp, "proj-a1-" + l);
    for (const [n, t, k] of [["All " + l, ["tdd", "saas", "ai"]], ["Core " + l, ["core"]], ["Bug " + l, ["saas", "ai"], "bugfix"]]) {
      const c = S.createFeature(d, n, t, undefined, undefined, l, k);
      for (const file of ["classification.md", "requirements.md", "design.md", "tasks.md", "test-plan.md", "eval-plan.md", "bug.md"]) {
        const txt = fs.existsSync(path.join(c.dir, file)) ? fs.readFileSync(path.join(c.dir, file), "utf8") : null;
        if (txt != null && S.artifactState({ text: txt }) !== "placeholder") everyScaffold.push(l + "/" + c.slug + "/" + file);
      }
    }
  }
  ok(!everyScaffold.length && S.isTemplatePlaceholder("1-2 frases: o que faz e porque importa") && S.isTemplatePlaceholder("Advisory  |  Semi-autonomous | Autonomous"),
    "every fresh scaffold artifact (EN/PT/ES, all tracks, core-only, bugfix + tracks) reads 'placeholder'; 1.12.1 template texts stay placeholders (got " + everyScaffold.join(", ") + ")");
  const auth = S.createFeature(w2, "Auth keys", ["core"]);
  fs.writeFileSync(path.join(auth.dir, "requirements.md"), "# Feature: Auth keys\n\n## Summary\nOnly callers passing the `[Authorize]` filter may list keys.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN an admin lists keys THE SYSTEM SHALL return them.\n");
  fs.writeFileSync(path.join(auth.dir, "design.md"), "# Design: Auth keys\n\n## Overview\nA GET endpoint on KeysController.\n");
  ok(S.artifactState({ file: path.join(auth.dir, "requirements.md") }) === "filled" && S.statusFeature(w2, auth.slug).phase === "design" &&
    S.roadmap(w2).features.find((x) => x.name === auth.slug).percent === 16,
    "an `[Authorize]` code span leaves requirements.md 'filled': phase 'design' (16%), not back at 'requirements'");

  // a NEW bugfix given extra tracks gets them — the same command twice gives the same track set
  const bf1 = S.createFeature(w2, "Login crash", ["saas"], "crash", undefined, "en", "bugfix");
  const bf2 = S.createFeature(w2, "Login crash", ["saas"], "crash", undefined, "en", "bugfix");
  ok(bf1.label === "core +tdd +saas" && bf2.label === bf1.label && !bf2.addedTracks && stateW2("login-crash").tracks.join() === "core,tdd,saas" &&
    /^# Design: Login crash/.test(readW2("login-crash", "design.md")) && headingCount(readW2("login-crash", "design.md"), "[SaaS]") === 5 &&
    fs.existsSync(path.join(w2s, "login-crash", "load-test.md")) && /## Story US-1 — Observability & Scale/.test(readW2("login-crash", "tasks.md")),
    "a new bugfix given +saas scaffolds it (design sections, load-test, tasks); a re-run gives the same [core +tdd +saas]");

  // a fully planned bugfix reaches tasks-ready: its verbatim steps count once requirements + test plan are filled
  const ns = S.createFeature(w2, "Null session", undefined, "crash on login", undefined, "en", "bugfix");
  const ns0 = S.statusFeature(w2, ns.slug).phase;
  const fillNs = (rel, fn) => fs.writeFileSync(path.join(ns.dir, rel), fn(fs.readFileSync(path.join(ns.dir, rel), "utf8")));
  fillNs("requirements.md", (s) => s.replace("[the condition that triggers the bug]", "the session is null").replace("[the correct behavior]", "redirect to /login")
    .replace("[the neighbouring behavior that already worked]", "a normal login").replace("[nearby inputs that must keep working]", "an expired session"));
  const ns1 = S.statusFeature(w2, ns.slug).phase;
  fillNs("test-plan.md", (s) => s.replace(/\[unit\/integration\]/g, "unit").replace(/`\[path\]`/g, "`test/session.test.js`"));
  ok(ns0 === "requirements" && ns1 === "test-plan" && S.statusFeature(w2, ns.slug).phase === "tasks-ready" && S.roadmap(w2).features.find((x) => x.name === ns.slug).percent === 30,
    "bugfix phase: fresh → requirements, requirements filled → test-plan, test plan filled → tasks-ready (30%) with the steps kept verbatim");
  // the same bugfix planned with +saas, then +saas removed: its design.md held only the track's sections — out of the chain
  const nsS = S.createFeature(w2, "Null session saas", ["saas"], "crash on login", undefined, "en", "bugfix");
  for (const rel of ["requirements.md", "test-plan.md"]) fs.copyFileSync(path.join(ns.dir, rel), path.join(nsS.dir, rel));
  const nsS0 = S.statusFeature(w2, nsS.slug).phase;
  S.removeTrack(w2, nsS.slug, "saas");
  const nsS1 = S.statusFeature(w2, nsS.slug);
  ok(nsS0 === "design" && nsS1.phase === "tasks-ready" && nsS1.tracks === "core +tdd" && S.roadmap(w2).features.find((x) => x.name === nsS.slug).percent === 30 &&
    fs.existsSync(path.join(nsS.dir, "design.md")),
    "a bugfix planned with +saas waits on its [SaaS] design sections; once +saas is removed it reaches tasks-ready (30%) like a plain bugfix (design.md kept)");
  // …but a regular feature whose design.md is only headings is still in 'design' (+tdd: a wrong skip would say 'test-plan')
  const hd = S.createFeature(w2, "Headings only", ["tdd"]);
  fs.writeFileSync(path.join(hd.dir, "requirements.md"), "## Summary\nX.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL answer.\n");
  fs.writeFileSync(path.join(hd.dir, "design.md"), "# Design: Headings only\n\n## Overview\n");
  ok(S.statusFeature(w2, hd.slug).phase === "design", "only a bugfix drops a headings-only design.md from the chain; a feature's stays open at 'design'");

  // localized removal / create-on-existing messages (PT, ES)
  const ptRel = S.createFeature(ptW2, "Relatórios", ["saas"]);
  const ptRelRm = S.addTrack(ptW2, ptRel.slug, "saas", { remove: true });
  ok(/^Tracks desativados: \+saas\. Nenhum ficheiro foi apagado/.test(ptRelRm.note) && S.addTrack(ptW2, ptRel.slug, "core", { remove: true }).error === "O 'core' está sempre ativo — não pode ser removido." &&
    /^Não ativo: \+ai/.test(S.addTrack(ptW2, ptRel.slug, "ai", { remove: true }).note), "removal messages follow the feature language (PT: removed, core, not active)");
  S.createFeature(esW2, "Exportar", ["core"]);
  const esAgain = S.createFeature(esW2, "Exportar", ["saas"]);
  ok(/^'exportar' ya existía — tracks añadidos: \+saas/.test(esAgain.note) && esAgain.addedTracks.join() === "saas" &&
    S.removeTrack(esW2, "error-de-pago", "tdd").error === "Un bugfix es siempre test-first — no se puede quitar +tdd.",
    "create-on-existing note and the bugfix +tdd refusal are localized (ES)");

  // roadmap: planned-but-not-started (tasks-ready, 0 done) is its own state — never ⬜ next to 30%
  const pl = S.createFeature(w2, "Planned export", ["saas"]);
  fs.appendFileSync(path.join(pl.dir, "tasks.md"), "\n- [ ] 20. [US1] Build the CSV writer\n");
  const mdEn = S.renderRoadmapMd(w2, "en");
  const plRow = mdEn.split("\n").find((l) => l.includes("[planned-export]")) || "";
  ok(/^\| 📋 \|/.test(plRow) && / 30% /.test(plRow) && /📋 planned · ⬜ not started/.test(mdEn) && !mdEn.split("\n").some((l) => /^\| ⬜ \|.* 30% /.test(l)) &&
    /📋 planeada/.test(S.renderRoadmapMd(w2, "pt")) && /planificada/.test(S.renderRoadmapHtml(w2, "es")),
    "a planned feature (tasks-ready, nothing done) shows 📋 planned at 30% — never ⬜ (MD EN/PT, HTML ES)");

  // after removing a track, its leftover [SaaS] TODO sections don't hold the phase at 'design'
  const ex6 = S.createFeature(w2, "Export six", ["tdd", "saas"]);
  fs.writeFileSync(path.join(ex6.dir, "requirements.md"), "## Summary\nExport.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL export CSV.\n");
  const d6 = fs.readFileSync(path.join(ex6.dir, "design.md"), "utf8");
  fs.writeFileSync(path.join(ex6.dir, "design.md"), "# Design: Export six\n\n## Overview\nA nightly job.\n\n" + d6.slice(d6.search(/^## \[SaaS\]/m)));
  const ph6 = S.statusFeature(w2, ex6.slug).phase;
  S.removeTrack(w2, ex6.slug, "saas");
  ok(ph6 === "design" && S.statusFeature(w2, ex6.slug).phase === "test-plan", "phase judges design.md on its active part: removing +saas moves 'design' on to 'test-plan'");

  // a removed track's task block is inactive: not next, not progress, not a finish blocker — and back when re-added
  const chat = S.createFeature(w2, "Chat seven", ["ai"]);
  const t7 = path.join(chat.dir, "tasks.md");
  const raw7 = fs.readFileSync(t7, "utf8");
  const aiNums7 = S.parseTasks(raw7.split("## Story US-1 — AI")[1].split(/\n## /)[0]).map((t) => t.number);
  fs.writeFileSync(t7, raw7.replace(/- \[ \] (\d+)\./g, (m, n) => (aiNums7.includes(+n) ? m : `- [x] ${n}.`)));
  const rm7 = S.removeTrack(w2, chat.slug, "ai");
  const st7 = S.statusFeature(w2, chat.slug);
  const ct7 = S.completeTask(w2, chat.slug, 1);
  ok(aiNums7.length === 2 && rm7.inactive.includes("tasks.md (Story US-1 — AI)") && S.nextTask(w2, chat.slug).next === null && st7.tasks.done === st7.tasks.total &&
    st7.phase === "complete" && !S.finishFeature(w2, chat.slug).blockers.some((b) => /open tasks/.test(b)) && ct7.next === null && ct7.done === ct7.total &&
    S.roadmap(w2).features.find((x) => x.name === chat.slug).percent === 100,
    "after add_track --remove the track's template tasks stop counting (next_task, status, complete_task, finish, roadmap)");
  const br7 = S.taskBrief(w2, chat.slug);
  const br7n = S.taskBrief(w2, chat.slug, aiNums7[0]);
  ok(br7.ok && br7.task === null && br7.note === "All tasks are done — nothing to brief." && br7n.ok && br7n.task.number === aiNums7[0],
    "spec_task_brief with no number agrees with next_task (removed track's block is not 'next'); an explicit number still reaches it");
  S.addTrack(w2, chat.slug, "ai");
  ok(S.nextTask(w2, chat.slug).next.number === aiNums7[0] && (fs.readFileSync(t7, "utf8").match(/## Story US-1 — AI/g) || []).length === 1 &&
    S.taskBrief(w2, chat.slug).task.number === aiNums7[0],
    "re-adding the track brings its task block back into play (next_task and brief; never appended twice)");

  // prototype keys never produce a did-you-mean
  const ctor = S.createFeature(w2, "Ctor", ["constructor"]);
  ok(S.parseTracks("constructor").unknown[0].suggestion === null && S.parseTracks("__proto__").unknown[0].suggestion === null && ctor.ok === false && !/did you mean/.test(ctor.error),
    "'constructor' / '__proto__' are unknown tracks without a did-you-mean");

  // a .state.json that parses but isn't an object is refused — never a removal that "succeeds" without saving
  const arr = S.createFeature(w2, "Array state", ["saas"]);
  fs.writeFileSync(path.join(arr.dir, ".state.json"), "[]");
  const arrRm = S.removeTrack(w2, arr.slug, "saas");
  const arrAdd = S.addTrack(w2, arr.slug, "ai");
  const arrCreate = S.createFeature(w2, "Array state", ["ai"]);
  const ptArr = S.createFeature(ptW2, "Estado lista", ["saas"]);
  fs.writeFileSync(path.join(ptArr.dir, ".state.json"), "[1]");
  ok(arrRm.ok === false && /array-state\/\.state\.json has an unexpected shape \(the top level must be an object\)/.test(arrRm.error) && arrAdd.ok === false && arrCreate.ok === false &&
    readW2(arr.slug, ".state.json") === "[]" && !fs.existsSync(path.join(arr.dir, "eval-plan.md")) && /nível de topo tem de ser um objeto/.test(S.removeTrack(ptW2, ptArr.slug, "saas").error),
    "add_track / remove / create-with-new-tracks refuse a non-object .state.json (nothing written; PT message)");

  // a case-only folder name ('Billing/') stays listed where the slug reaches it (case-insensitive FS), ignored where it can't
  const caseInsensitive = fs.existsSync(path.join(w2s, "INVOICE-EXPORT"));
  const bil = S.createFeature(w2, "Billing", ["core"]);
  fs.renameSync(bil.dir, path.join(w2s, "Billing"));
  const lf11 = S.listFeatures(w2);
  ok(caseInsensitive ? lf11.features.some((f) => f.name === "Billing") && S.statusFeature(w2, "billing").ok && !(lf11.ignored || []).includes("Billing")
    : !lf11.features.some((f) => f.name === "Billing") && lf11.ignored.includes("Billing"),
    "listFeatures keeps a case-only folder name when 'billing' reaches it (" + (caseInsensitive ? "case-insensitive" : "case-sensitive") + " FS)");
  { // merge follow-up: a removed track's ticked-without-evidence task is not an unverified gap
    const vt = S.createFeature(w2, "Verify inactive", ["saas"]);
    const vtTasks = path.join(vt.dir, "tasks.md");
    const allNums = S.statusFeature(w2, vt.slug).tasks.list.map((t) => t.number);
    S.removeTrack(w2, vt.slug, "saas");
    const activeNums = S.statusFeature(w2, vt.slug).tasks.list.map((t) => t.number);
    const inactive = allNums.find((n) => !activeNums.includes(n));
    // tick one of the removed track's tasks without evidence, and give it a runnable _Verify:_
    const vl = fs.readFileSync(vtTasks, "utf8").split("\n");
    const at = vl.findIndex((l) => new RegExp("^\\s*- \\[ \\] " + inactive + "\\.").test(l));
    if (at >= 0) { vl[at] = vl[at].replace("- [ ]", "- [x]"); vl.splice(at + 1, 0, "  - _Verify: npm test_"); }
    fs.writeFileSync(vtTasks, vl.join("\n"));
    ok(inactive != null && at >= 0 && S.verificationStatus(w2, vt.slug, vt.dir).unverified.length === 0,
      "verificationStatus ignores the tasks of a removed track (inactive, not a gap)");
  }
  }

  // 1.15 feature (F4) — project-defined tracks (track packs in .specs/tracks/<name>/).
  {
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const js = (x) => JSON.stringify(x);
    const rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
    const packDir = (proj, n) => path.join(proj, ".specs", "tracks", n);
    const writePack = (proj, n, json, frags = {}) => {
      const d = packDir(proj, n);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, "track.json"), typeof json === "string" ? json : JSON.stringify(json, null, 2));
      for (const [f, text] of Object.entries(frags)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), text); }
      return d;
    };
    const A11Y_JSON = `// the team's accessibility track — comments are allowed
{
  "name": "a11y",
  "marker": "A11Y",
  "title": { "en": "Accessibility", "pt": "Acessibilidade", "es": "Accesibilidad" },
  /* strong: one turns the track on */
  "signals": { "strong": ["accessibility", "screen reader", "wcag 2.1"], "weak": ["keyboard", "contrast"], "context": ["focus"] },
  "sections": [
    { "name": { "en": "Keyboard Navigation", "pt": "Navegação por Teclado", "es": "Navegación por Teclado" }, "syn": ["keyboard access"],
      "guidance": { "en": "Tab order, focus traps, shortcuts.", "pt": "Ordem de tabulação, armadilhas de foco, atalhos." } },
    { "name": { "en": "Screen Reader Support", "pt": "Leitor de Ecrã", "es": "Lector de Pantalla" }, "guidance": "Landmarks, labels, live regions." },
    { "name": "Contrast", "loose": ["colours"] }
  ],
  "steering": "accessibility.md"
}
`;
    const A11Y_FRAGS = {
      "requirements.md": "<!-- the criteria every +a11y feature starts with -->\n- WHEN a user navigates with the keyboard only THE SYSTEM SHALL make every control reachable and operable\n- THE SYSTEM SHALL keep a text contrast ratio of at least [4.5:1] on every screen\n",
      "tasks.md": "- [ ] Keyboard walk-through of {{name}}\n  - _Requirements: {{ac1}}_\n  - _Makes green: {{t1}}_\n- [ ] Contrast audit\n  - _Requirements: {{ac2}}_\n  - _Makes green: {{t2}}_\n",
      "test-plan.md": "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n| T-00 | e2e | example | keyboard-only walk-through reaches every control | {{ac1}} | `tests/e2e/a11y-keyboard.spec.ts` |\n| T-00 | unit | property | every text / background pair keeps its contrast ratio | {{ac2}} | `tests/unit/contrast.test.ts` |\n",
      "checklist.md": "- axe-core reports no violation on the feature's pages\n",
      "steering.md": "# Accessibility\n\n- WCAG 2.1 AA is the floor.\n",
      "pt/requirements.md": "- QUANDO um utilizador navega só com o teclado O SISTEMA DEVE tornar todos os controlos alcançáveis\n- O SISTEMA DEVE manter um contraste de texto de pelo menos [4,5:1] em todos os ecrãs\n",
    };
    const tp = path.join(tmp, "proj-f4-tracks");
    S.initProject(tp, ["core"], "en");
    writePack(tp, "a11y", A11Y_JSON, A11Y_FRAGS);

    // spec_tracks list / check (MCP) — the built-in tracks and the pack, valid; check passes.
    const lst = payload(await call("spec_tracks", { projectDir: tp }));
    const chk = payload(await call("spec_tracks", { action: "check", projectDir: tp }));
    const a11yRow = (lst.packs || []).find((p) => p.name === "a11y");
    ok(lst.ok && lst.builtIn.map((b) => b.name).join() === "core,tdd,saas,ai,sec,privacy,dist,api,ui,obs,data" && a11yRow && a11yRow.valid && a11yRow.marker === "[A11Y]" &&
      a11yRow.title === "Accessibility" && a11yRow.sections.length === 3 && a11yRow.steering === "accessibility.md" && chk.ok && chk.verdict === "pass" && chk.errors === 0,
      "feature F4: spec_tracks list shows the built-in tracks and the valid +a11y pack ([A11Y], 3 sections, steering); check passes (got " + js(a11yRow) + " / " + js(chk.problems) + ")");

    // Classification: spec_classify with the project picks +a11y from its signals (a strong keyword); without it, never.
    const cl = payload(await call("spec_classify", { description: "Make the settings page usable with a screen reader and the keyboard", projectDir: tp }));
    const clNo = S.classify("Make the settings page usable with a screen reader and the keyboard");
    const clWcag = S.classify("Meets WCAG 2.1 AA", { projectDir: tp }), clNot = S.classify("Meets WCAG 2x1 AA", { projectDir: tp });
    ok(cl.tracks.includes("a11y") && cl.signals.a11y.includes("screen reader") && /\+a11y: ON/.test(cl.reasoning) && !clNo.tracks.includes("a11y") &&
      clWcag.tracks.includes("a11y") && !clNot.tracks.includes("a11y"),
      "feature F4: spec_classify reads the pack's signals as literal words (\"wcag 2.1\" — the dot is no wildcard: \"wcag 2x1\" stays off); without the project no pack (got " + js(cl.tracks) + " " + js(clWcag.tracks) + "/" + js(clNot.tracks) + ")");
    // Linear on adversarial text, with the pack's keywords in play.
    const t0 = Date.now();
    S.classify(("a".repeat(5000) + "(a+)+$ wcag 2. screen-readerx ").repeat(40), { projectDir: tp });
    ok(Date.now() - t0 < 5000, "feature F4: classify with a pack stays linear on a 200 KB adversarial text (" + (Date.now() - t0) + " ms)");

    // spec_create +tdd +a11y: criteria under #### [A11Y] (after the US-1 ones, before US-2), design sections with the TODO sentinel,
    // the task block, the test rows, the checklist item and the steering file.
    const cr = payload(await call("spec_create", { name: "Settings", tracks: ["tdd,a11y"], summary: "Settings page", lang: "en", projectDir: tp }));
    const sd = path.join(tp, ".specs", "settings");
    const req = rd(path.join(sd, "requirements.md")), des = rd(path.join(sd, "design.md")), tsk = rd(path.join(sd, "tasks.md"));
    const plan = rd(path.join(sd, "test-plan.md")), chl = rd(path.join(sd, "checklist.md")), cls = rd(path.join(sd, "classification.md"));
    const steer = rd(path.join(tp, ".specs", "steering", "accessibility.md"));
    ok(cr.ok && cr.tracks.join() === "core,tdd,a11y" && /#### \[A11Y\] Accessibility — Acceptance Criteria \(EARS\)\n5\. \*\*US-1\.AC-5\*\* — WHEN a user navigates with the keyboard only/.test(req) &&
      /6\. \*\*US-1\.AC-6\*\* — THE SYSTEM SHALL keep a text contrast ratio/.test(req) && req.indexOf("[A11Y]") < req.indexOf("### US-2") &&
      /## \[A11Y\] Keyboard Navigation\n> \*\*TODO\*\* — replace with real values \(remove this line when done\)\.\nTab order, focus traps, shortcuts\./.test(des) &&
      /## \[A11Y\] Screen Reader Support\n> \*\*TODO\*\*/.test(des) && /## \[A11Y\] Contrast\n> \*\*TODO\*\*/.test(des) &&
      /## Story US-1 — \[A11Y\] Accessibility\n- \[ \] 7\. \[US1\] Keyboard walk-through of Settings\n  - _Requirements: US-1\.AC-5_\n  - _Makes green: T-06_\n- \[ \] 8\. \[US1\] Contrast audit\n  - _Requirements: US-1\.AC-6_\n  - _Makes green: T-07_/.test(tsk) &&
      /## \[A11Y\] Traceability Matrix[\s\S]*\| T-06 \| e2e \| example \| keyboard-only walk-through reaches every control \| US-1\.AC-5 \|[\s\S]*\| T-07 \| unit \| property \|/.test(plan) &&
      /\| T-05 \| integration \| example \| \[behavior\] \| US-2\.AC-1 \|/.test(plan) && /- \[ \] A11Y: axe-core reports no violation/.test(chl) &&
      /## Active Tracks\ncore \+tdd \+a11y/.test(cls) && /\*\*\+a11y:\*\*/.test(cls) && /WCAG 2\.1 AA is the floor/.test(steer) && cr.created.includes("steering/accessibility.md"),
      "feature F4: spec_create +tdd +a11y scaffolds the [A11Y] criteria (US-1.AC-5/6, before US-2), the 3 design sections with the > **TODO** sentinel, the task block (Requirements + Makes green), the T-06/T-07 rows after the template's, the checklist item, classification and the steering file (got " + js(cr.created) + ")");
    const st = S.statusFeature(tp, "settings");
    ok(st.tracks === "core +tdd +a11y" && st.packSections && st.packSections.a11y.marker === "[A11Y]" && st.packSections.a11y.sections.every((s) => s.present && !s.filled),
      "feature F4: spec_status reports the pack's sections (present, not filled) under packSections (got " + js(st.packSections) + ")");

    // Doctor fails a11y-sections until every section is filled; the design approval is refused on it; [A11Y] is never a placeholder.
    const d1 = S.specDoctor(tp, "settings");
    const sec1 = d1.checks.find((c) => c.id === "a11y-sections");
    const ph1 = [...S.featurePlaceholders(tp, "settings", "requirements.md").items, ...S.featurePlaceholders(tp, "settings", "design.md").items, ...S.featurePlaceholders(tp, "settings", "tasks.md").items].map((x) => x.text);
    const ap1 = S.approvePhase(tp, "settings", "design", "t");
    ok(sec1 && sec1.status === "fail" && /Keyboard Navigation/.test(sec1.detail) && /Contrast/.test(sec1.detail) && !ph1.some((x) => /A11Y/.test(x)) && ph1.includes("[4.5:1]") &&
      ap1.ok === false && (ap1.failing || []).includes("a11y-sections"),
      "feature F4: doctor fails a11y-sections (every section unfilled), the design approval is refused on it, the pack's [4.5:1] slot is a placeholder and [A11Y] never is (got " + js(sec1) + " / " + js(ap1.failing) + ")");
    fs.writeFileSync(path.join(sd, "design.md"), des.replace(/(## \[A11Y\] Keyboard Navigation\n)> \*\*TODO\*\*[^\n]*\n/, "$1Tab through every control; no focus trap.\n")
      .replace(/(## \[A11Y\] Screen Reader Support\n)> \*\*TODO\*\*[^\n]*\n/, "$1Landmarks and labelled inputs.\n").replace(/(## \[A11Y\] Contrast\n)> \*\*TODO\*\*[^\n]*\n/, "$1Tokens checked on every local run.\n"));
    const d2 = S.specDoctor(tp, "settings");
    const ap2 = S.approvePhase(tp, "settings", "design", "t");
    ok(d2.checks.find((c) => c.id === "a11y-sections").status === "pass" && !(ap2.failing || []).includes("a11y-sections"),
      "feature F4: once every [A11Y] section is filled, a11y-sections passes and the design gate no longer names it (got " + js(ap2.failing) + ")");

    // trace_check sees the pack's criteria: covered by its tasks and rows; without its tasks they are uncovered.
    const tr1 = S.traceCheck(tp, "settings");
    fs.writeFileSync(path.join(sd, "tasks.md"), tsk.replace(/## Story US-1 — \[A11Y\][\s\S]*$/, ""));
    const tr2 = S.traceCheck(tp, "settings");
    fs.writeFileSync(path.join(sd, "tasks.md"), tsk);
    ok(tr1.ok && tr1.totalAcs === 7 && !tr1.uncoveredByTasks.length && !tr1.uncoveredByTests.length && !tr1.testsNotMappedToTasks.length &&
      js(tr2.uncoveredByTasks) === js(["US-1.AC-5", "US-1.AC-6"]),
      "feature F4: trace_check counts the [A11Y] criteria (7 ACs, all tasked and planned); without the pack's tasks US-1.AC-5/6 are uncovered (got " + js(tr2.uncoveredByTasks) + ")");

    // The brief of a pack task carries the pack's design sections; ROADMAP.md names the unfilled ones of another feature.
    const br = S.taskBrief(tp, "settings", 7, { includeBrief: true });
    ok(br.ok && /\[A11Y\] Keyboard Navigation/.test(br.brief || br.markdown || js(br)), "feature F4: a pack task's brief quotes the [A11Y] design sections (trackMarks)");

    // add_track / remove on an existing core feature: sections, task block (the criterion slot), steering; remove makes them inactive.
    S.createFeature(tp, "Profile", ["core"], "Profile page", undefined, "en");
    const pd = path.join(tp, ".specs", "profile");
    const at = payload(await call("spec_add_track", { name: "profile", track: "+a11y", projectDir: tp }));
    const pdes = rd(path.join(pd, "design.md")), ptsk = rd(path.join(pd, "tasks.md"));
    const pdoc = S.specDoctor(tp, "profile");
    ok(at.ok && at.addedTracks.join() === "a11y" && /## \[A11Y\] Keyboard Navigation\n> \*\*TODO\*\*/.test(pdes) &&
      /## Story US-1 — \[A11Y\] Accessibility\n- \[ \] \d+\. \[US1\] Keyboard walk-through of profile[\s\S]*_Requirements: \[the \+a11y criterion this task proves\]_/.test(ptsk) &&
      pdoc.checks.find((c) => c.id === "a11y-sections").status === "fail" && JSON.parse(rd(path.join(pd, ".state.json"))).tracks.includes("a11y"),
      "feature F4: spec_add_track +a11y appends the [A11Y] design sections and the task block (citing the track's criterion slot) and saves the track; doctor fails a11y-sections (got " + js(at.added) + ")");
    const rm = payload(await call("spec_add_track", { name: "profile", track: "a11y", remove: true, projectDir: tp }));
    const pdoc2 = S.specDoctor(tp, "profile");
    const rmPh = pdoc2.checks.find((c) => c.id === "placeholders");
    ok(rm.ok && rm.removedTracks.join() === "a11y" && rm.inactive.some((x) => /\[A11Y\]/.test(x)) && rm.inactive.some((x) => /tasks\.md \(Story US-1 — \[A11Y\]/.test(x)) &&
      !pdoc2.checks.some((c) => c.id === "a11y-sections") && !/\+a11y criterion/.test(rmPh.detail) && rd(path.join(pd, "design.md")) === pdes,
      "feature F4: remove +a11y is non-destructive — the files stay, the [A11Y] sections / task block are listed inactive and doctor stops requiring them (got " + js(rm.inactive) + ")");

    // PT / ES scaffolds: the pack's title, section names and a pt/ fragment in the feature's language; doctor finds the sections.
    const crPt = S.createFeature(tp, "Definições", ["a11y"], "", undefined, "pt");
    const reqPt = rd(path.join(crPt.dir, "requirements.md")), desPt = rd(path.join(crPt.dir, "design.md")), tskPt = rd(path.join(crPt.dir, "tasks.md"));
    const crEs = S.createFeature(tp, "Ajustes", ["a11y"], "", undefined, "es");
    const reqEs = rd(path.join(crEs.dir, "requirements.md")), desEs = rd(path.join(crEs.dir, "design.md")), tskEs = rd(path.join(crEs.dir, "tasks.md"));
    const crBr = S.createFeature(tp, "Configurações", ["a11y"], "", undefined, "pt-BR");
    const reqBr = rd(path.join(crBr.dir, "requirements.md"));
    const dPt = S.specDoctor(tp, crPt.slug).checks.find((c) => c.id === "a11y-sections"), dEs = S.specDoctor(tp, crEs.slug).checks.find((c) => c.id === "a11y-sections");
    ok(/#### \[A11Y\] Acessibilidade — Critérios de Aceitação \(EARS\)\n5\. \*\*US-1\.AC-5\*\* — QUANDO um utilizador navega só com o teclado/.test(reqPt) &&
      /## \[A11Y\] Navegação por Teclado\n> \*\*TODO\*\* — substituir pelos valores reais/.test(desPt) && /## \[A11Y\] Leitor de Ecrã/.test(desPt) && /## História US-1 — \[A11Y\] Acessibilidade/.test(tskPt) &&
      /#### \[A11Y\] Accesibilidad — Criterios de Aceptación \(EARS\)\n5\. \*\*US-1\.AC-5\*\* — WHEN a user navigates/.test(reqEs) && /## \[A11Y\] Navegación por Teclado\n> \*\*TODO\*\* — reemplazar con valores reales/.test(desEs) &&
      /## Historia US-1 — \[A11Y\] Accesibilidad/.test(tskEs) && /QUANDO um utilizador navega só com o teclado|QUANDO um usuário navega só com o teclado/.test(reqBr) &&
      dPt && dPt.status === "fail" && !/missing|em falta/.test(dPt.detail) && dEs && dEs.status === "fail",
      "feature F4: PT / ES / pt-BR scaffolds — the pack's title and section names in the feature's language, pt/requirements.md for pt and pt-BR (the root one for es), localized TODO line and task heading; doctor finds the localized sections (got " + js(dPt && dPt.detail) + ")");

    // A pack the project loses: the saved track stays, inactive (its sections and tasks are no gate, no placeholder), doctor warns.
    const tq = path.join(tmp, "proj-f4-gone");
    S.initProject(tq, ["core"], "en");
    writePack(tq, "a11y", A11Y_JSON, A11Y_FRAGS);
    S.createFeature(tq, "Search", ["a11y"], "Search page", undefined, "en");
    fs.rmSync(packDir(tq, "a11y"), { recursive: true, force: true });
    let gone = null, goneErr = null;
    try { gone = S.specDoctor(tq, "search"); } catch (e) { goneErr = e; }
    const miss = gone && gone.checks.find((c) => c.id === "track-pack-missing");
    const gph = S.featurePlaceholders(tq, "search", "design.md").items.map((x) => x.text).join(" | ");
    const gst = S.statusFeature(tq, "search");
    S.addTrack(tq, "search", "tdd");
    const gstate = JSON.parse(rd(path.join(tq, ".specs", "search", ".state.json")));
    const gtr = S.traceCheck(tq, "search");
    ok(!goneErr && miss && miss.status === "warn" && /\+a11y \(no \.specs\/tracks\/a11y\/ in this project\)/.test(miss.detail) && !gone.checks.some((c) => c.id === "a11y-sections") &&
      !/replace with real values/.test(gph) && gst.tracks === "core" && js(gst.missingPacks) === js(["a11y"]) && gstate.tracks.includes("a11y") && gstate.packMarkers.a11y === "[A11Y]" &&
      gtr.ok && gtr.verdict === "pass",
      "feature F4: a deleted pack — no crash; doctor warns track-pack-missing, its sections / tasks are inactive (no a11y-sections, no > **TODO** placeholder in the active design, trace passes), the saved track and its marker stay in .state.json after another add_track (got " + js(miss) + " / " + gph.slice(0, 300) + ")");
    // … and an INVALID pack the same way, naming why.
    writePack(tq, "a11y", "{ not json", {});
    const inval = S.specDoctor(tq, "search").checks.find((c) => c.id === "track-pack-missing");
    ok(inval && /\+a11y \(the pack is invalid: json-invalid\)/.test(inval.detail), "feature F4: a pack that turned invalid → track-pack-missing names the check code (got " + js(inval && inval.detail) + ")");

    // Invalid packs: every one reported by check with its stable code — and ignored everywhere (never half-applied).
    const tv = path.join(tmp, "proj-f4-bad");
    S.initProject(tv, ["core"], "en");
    const base = (n, over = {}) => ({ name: n, marker: n.toUpperCase(), title: { en: n }, sections: [{ name: "Scope" }], ...over });
    writePack(tv, "badjson", "{ \"name\": \"badjson\", ");
    writePack(tv, "mismatch", base("mismatch", { name: "other" }));
    writePack(tv, "builtin", base("builtin", { marker: "SEC" }));
    writePack(tv, "alpha", base("alpha", { marker: "DUPE" }));
    writePack(tv, "beta", base("beta", { marker: "DUPE" }));
    writePack(tv, "huge", JSON.stringify(base("huge", { description: "x" })) + " ".repeat(40 * 1024));
    writePack(tv, "regexy", base("regexy", { signals: { strong: ["(a+)+$"] } }));
    writePack(tv, "nosections", base("nosections", { sections: [] }));
    writePack(tv, "badrow", base("badrow"), { "test-plan.md": "| T-1 | unit | {{ac1}} |\n" });
    writePack(tv, "badref", base("badref"), { "tasks.md": "- [ ] do it\n  - _Requirements: {{ac3}}_\n" });
    writePack(tv, "sec", base("sec", { marker: "SECX" }));
    writePack(tv, "Upper", base("Upper"));
    const bc = payload(await call("spec_tracks", { action: "check", projectDir: tv }));
    const code = (pack, c) => bc.problems.some((p) => p.pack === pack && p.code === c && p.severity === "error");
    const bl = S.trackPacks(tv, "list");
    const validNames = bl.packs.filter((p) => p.valid).map((p) => p.name);
    const bcr = S.createFeature(tv, "Thing", ["regexy"], "", undefined, "en");
    ok(bc.ok && bc.verdict === "fail" && code("badjson", "json-invalid") && code("mismatch", "name-mismatch") && code("builtin", "marker-reserved") && code("beta", "marker-duplicate") &&
      code("huge", "too-big") && code("regexy", "signal-invalid") && code("nosections", "field-invalid") && code("badrow", "fragment-row") && code("badref", "fragment-ref") &&
      code("sec", "name-reserved") && code("Upper", "name-invalid") && js(validNames) === js(["alpha"]) && bcr.ok === false && /Unknown track/.test(bcr.error),
      "feature F4: invalid packs — bad JSON, name ≠ folder, a built-in marker, a duplicate marker (the first by name keeps it), an oversized track.json, a regex-looking keyword, no sections, a malformed row, an {{ac3}} naming nothing, a reserved and an invalid name — each an error with its code, and ignored (only 'alpha' is a track; +regexy is an unknown track) (got " + js(validNames) + " / " + js(bc.problems.filter((p) => p.severity === "error").map((p) => p.pack + ":" + p.code)) + ")");

    // A pack folder that is a link (symlink / junction) out of .specs/ is never read.
    const tl = path.join(tmp, "proj-f4-link");
    S.initProject(tl, ["core"], "en");
    const outside = path.join(tmp, "f4-outside-pack");
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, "track.json"), JSON.stringify(base("evil")));
    fs.mkdirSync(path.join(tl, ".specs", "tracks"), { recursive: true });
    let linked = false;
    try { fs.symlinkSync(outside, path.join(tl, ".specs", "tracks", "evil"), "junction"); linked = true; } catch { /* no link support */ }
    if (linked) {
      const lc = S.trackPacks(tl, "check");
      ok(lc.problems.some((p) => p.pack === "evil" && p.code === "linked-folder") && !S.trackPacks(tl, "list").packs.some((p) => p.valid) && S.createFeature(tl, "X", ["evil"], "", undefined, "en").ok === false,
        "feature F4: a pack folder linked (junction / symlink) to a folder outside .specs/ is reported linked-folder and never read");
    } else ok(true, "feature F4: (no link support here — the linked-pack check is skipped)");

    // `tracks` is a reserved feature slug — unless .specs/tracks/ is a feature created before 1.15 (its .state.json): then no packs.
    const rs = S.createFeature(tp, "tracks", ["core"], "", undefined, "en");
    const tg = path.join(tmp, "proj-f4-legacy");
    S.initProject(tg, ["core"], "en");
    fs.mkdirSync(path.join(tg, ".specs", "tracks"), { recursive: true });
    fs.writeFileSync(path.join(tg, ".specs", "tracks", ".state.json"), JSON.stringify({ lang: "en", tracks: ["core"], approvals: {} }));
    fs.writeFileSync(path.join(tg, ".specs", "tracks", "requirements.md"), "# Feature: tracks\n");
    writePack(tg, "a11y", A11Y_JSON, {});
    const lg = S.trackPacks(tg, "list");
    ok(rs.ok === false && /reserved/i.test(rs.error) && S.listFeatures(tg).features.some((f) => f.name === "tracks") && lg.ok === false && lg.legacyFeature === true &&
      S.createFeature(tg, "Y", ["a11y"], "", undefined, "en").ok === false,
      "feature F4: 'tracks' is a reserved slug; a pre-1.15 feature named tracks stays a feature and is never read as packs (legacyFeature)");

    // init scaffolds a valid, commented pack (never overwriting); the scaffold reads 'placeholder' for a feature using it.
    const ti = path.join(tmp, "proj-f4-init");
    S.initProject(ti, ["core"], "en");
    const in1 = payload(await call("spec_tracks", { action: "init", name: "mobile", projectDir: ti }));
    const in2 = S.trackPacks(ti, "init", { name: "mobile" });
    const inBad = S.trackPacks(ti, "init", { name: "sec" }), inBad2 = S.trackPacks(ti, "init", { name: "Bad Name" });
    const ic = S.trackPacks(ti, "check");
    const mcr = S.createFeature(ti, "Offline", ["mobile"], "Offline mode", undefined, "en");
    const mreq = rd(path.join(mcr.dir || "", "requirements.md"));
    const mdoc = mcr.ok ? S.specDoctor(ti, "offline") : null;
    ok(in1.ok && in1.created.length === 6 && in1.marker === "[MOBILE]" && /^\/\/ Track pack \+mobile/.test(rd(path.join(packDir(ti, "mobile"), "track.json"))) && in2.ok && in2.created.length === 0 && in2.kept.length === 6 &&
      inBad.ok === false && inBad2.ok === false && ic.verdict !== "fail" && mcr.ok && /#### \[MOBILE\] Mobile — Acceptance Criteria/.test(mreq) &&
      mdoc.checks.find((c) => c.id === "mobile-sections").status === "fail" && S.featurePlaceholders(ti, "offline", "requirements.md").items.some((x) => x.text === "[the Mobile behavior]"),
      "feature F4: spec_tracks init scaffolds a commented, valid pack (6 files, never overwritten; reserved / invalid names refused); a feature using it reads its slots as placeholders and fails mobile-sections (got " + js(ic.problems) + ")");

    // Every reader: ROADMAP.md names the unfilled [A11Y] sections, the design-save check lists them, the stakeholder export carries
    // them, and the PostToolUse hook never lints a pack's own fragments as a feature's spec (.specs/tracks/ is no feature).
    const rmap = rd(path.join(tp, ".specs", "ROADMAP.md"));
    const dsc = S.designSaveCheck(tp, crEs.slug);
    const exp = S.exportSpecs(tp, { name: "settings", format: "md" });
    const hookOut = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse",
      tool_input: { file_path: path.join(packDir(tp, "a11y"), "requirements.md") } }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });
    ok(/\[A11Y\] Keyboard Navigation/.test(rmap) && dsc.ok && dsc.sections.some((x) => x.track === "a11y" && x.marker === "[A11Y]" && x.sections.length === 3) &&
      exp.ok && /\[A11Y\] Keyboard Navigation/.test(exp.content) && /core \+tdd \+a11y/.test(exp.content) && hookOut.status === 0 && !hookOut.stdout.trim(),
      "feature F4: ROADMAP.md attention, the design-save check and spec_export know the [A11Y] sections; the hook is silent on .specs/tracks/<pack>/requirements.md (got " + js(hookOut.stdout.slice(0, 200)) + ")");

    // A pack marker is an exact, case-sensitive token: beside a ROLE pack the template's lower-case [role] slot stays a slot.
    const tr0 = path.join(tmp, "proj-f4-role");
    S.initProject(tr0, ["core"], "en");
    writePack(tr0, "roles", { name: "roles", marker: "ROLE", title: { en: "Roles" }, sections: [{ name: "Role Matrix" }] });
    S.createFeature(tr0, "Admin", ["roles"], "Admin page", undefined, "en");
    const roleItems = S.featurePlaceholders(tr0, "admin", "requirements.md").items.map((x) => x.text);
    ok(roleItems.includes("[role]") && !roleItems.includes("[ROLE]") && S.specDoctor(tr0, "admin").checks.some((c) => c.id === "roles-sections"),
      "feature F4: a ROLE pack never hides the template's [role] slot (markers are case-sensitive); roles-sections is checked (got " + js(roleItems.slice(0, 6)) + ")");

    // A project template for requirements + a pack: the pack's criteria still land after the template's own US-1 criteria.
    fs.mkdirSync(path.join(tp, ".specs", "templates"), { recursive: true });
    fs.writeFileSync(path.join(tp, ".specs", "templates", "requirements.md"), "# Feature: {{name}}\n\n### US-1 (P1): [Story]\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN [x] THE SYSTEM SHALL [y]\n\n## Out of Scope\n- [none]\n");
    const tcr = S.createFeature(tp, "Team", ["a11y"], "", undefined, "en");
    const treq = rd(path.join(tcr.dir, "requirements.md"));
    ok(tcr.templates && tcr.templates["requirements.md"] && /1\. \*\*US-1\.AC-1\*\*[\s\S]*#### \[A11Y\] Accessibility — Acceptance Criteria \(EARS\)\n2\. \*\*US-1\.AC-2\*\*[\s\S]*## Out of Scope/.test(treq),
      "feature F4: a project requirements template still gets the pack's criteria — numbered after its own US-1 ACs, before the next section");
    fs.rmSync(path.join(tp, ".specs", "templates"), { recursive: true, force: true });

    // --- F4 review (R1 … R10) ---
    const rvNew = (n) => { const p = path.join(tmp, "proj-f4r-" + n); S.initProject(p, ["core"], "en"); return p; };
    const A11Y_OBJ = JSON.parse(A11Y_JSON.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""));
    // R1: a pack turned OFF for a feature and later deleted from the project stays inactive (its sections, criteria and task block
    // are no gate, no placeholder, no open task).
    const r1 = rvNew("r1");
    writePack(r1, "a11y", A11Y_JSON, A11Y_FRAGS);
    S.createFeature(r1, "Login", ["a11y"], "Login form", undefined, "en");
    S.addTrack(r1, "login", "a11y", { remove: true });
    fs.rmSync(packDir(r1, "a11y"), { recursive: true, force: true });
    const r1Design = S.featurePlaceholders(r1, "login", "design.md").items.map((x) => x.text).join(" | ");
    const r1Open = (S.finishFeature(r1, "login", {}).blockers || []).find((b) => /open tasks/.test(b)) || "";
    const r1Req = S.traceMatrix(r1, "login").rows.map((r) => r.id);
    ok(!/replace with real values/.test(r1Design) && /#6\b/.test(r1Open) && !/#7\b/.test(r1Open) && !r1Req.includes("US-1.AC-5") &&
      !S.specDoctor(r1, "login").checks.some((c) => c.id === "track-pack-missing"),
      "F4 review R1: a pack turned off, then deleted from the project — its [A11Y] sections, criteria and task block stay inactive (no TODO placeholder, open tasks #1–#6 only, no matrix row) and no pack-missing warning (the feature no longer uses it) (got " + js(r1Open) + ")");

    // R2: a fragment slot holding {{name}} / {{slug}} / {{acN}} is still a template placeholder once substituted; a task line too.
    const r2 = rvNew("r2");
    writePack(r2, "a11y", A11Y_JSON, {
      "requirements.md": "- WHEN a user tabs through [the {{name}} screens] THE SYSTEM SHALL move focus in reading order\n",
      "tasks.md": "- [ ] Keyboard audit of {{name}}\n  - _Requirements: {{ac1}}_\n",
      "checklist.md": "- [record the {{slug}} axe report for {{ac1}}]\n",
    });
    S.createFeature(r2, "Login", ["a11y"], "Login form", undefined, "en");
    const r2Req = S.featurePlaceholders(r2, "login", "requirements.md").items.map((x) => x.text);
    const r2Chk = S.featurePlaceholders(r2, "login", "checklist.md").items.map((x) => x.text);
    const r2Task = S.withReadCache(() => { S.specsRoot(r2); return S.isPlaceholderTask("[US1] Keyboard audit of Login"); });
    const r2Other = S.withReadCache(() => { S.specsRoot(r2); return S.isPlaceholderTask("[US1] Audit the checkout flow with a screen reader"); });
    const r2Free = S.placeholderReport("the ratio [free: 60, pro: 600] and [owner, admin]");
    ok(r2Req.includes("[the Login screens]") && r2Chk.includes("[record the login axe report for US-1.AC-5]") && r2Task === true && r2Other === false && r2Free.length === 0,
      "F4 review R2: fragment slots with {{name}} / {{slug}} / {{acN}} read as placeholders after substitution ([the Login screens], the checklist item), the untouched task line is a template task — a linear wildcard, never a match-all (got " + js(r2Req) + " / " + js(r2Chk) + ")");

    // R3: a project requirements template whose US-1 criteria are followed by an HTML comment holding a "### US-2" example: the pack
    // block lands after the comment, never inside it.
    const r3 = rvNew("r3");
    writePack(r3, "a11y", A11Y_JSON, A11Y_FRAGS);
    fs.mkdirSync(path.join(r3, ".specs", "templates"), { recursive: true });
    fs.writeFileSync(path.join(r3, ".specs", "templates", "requirements.md"), ["# Feature: {{name}}", "", "### US-1 (P1): [Story Title]", "#### Acceptance Criteria (EARS)",
      "1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]", "", "<!-- Add more stories like this:", "### US-2 (P2): [Story Title]",
      "1. **US-2.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]", "-->", "", "## Out of Scope", "- [none]", ""].join("\n"));
    const r3c = S.createFeature(r3, "Login", ["a11y"], "", undefined, "en");
    const r3Req = rd(path.join(r3c.dir, "requirements.md"));
    const r3Tr = S.traceCheck(r3, "login");
    ok(r3Req.indexOf("#### [A11Y]") > r3Req.indexOf("-->") && r3Req.indexOf("#### [A11Y]") < r3Req.indexOf("## Out of Scope") && r3Tr.totalAcs === 3 && !r3Tr.uncoveredByTasks.length,
      "F4 review R3: the [A11Y] criteria go after an HTML comment that holds a heading, before the next real heading — trace sees all 3 criteria (got " + js(r3Tr.uncoveredByTasks) + ")");

    // R4 + R7: section names with a heading lead (emoji, numbering, "Section N", a dash) match their own headings (check warns); pack
    // sections are marker-bound — a core "## Architecture" never satisfies "[MOB] Architecture", an unmarked heading UNDER a [MOB]
    // heading does.
    const r4 = rvNew("r4");
    writePack(r4, "mob", { name: "mob", marker: "MOB", title: "Mobile", sections: [{ name: "🔐 Secrets" }, { name: "2 Offline Modes" }, { name: "Section 3 Push" },
      { name: "- Store Review" }, { name: "Architecture" }, { name: "Battery", loose: ["power"] }, { name: "Crash Reporting" }] });
    const r4Chk = S.trackPacks(r4, "check");
    const r4c = S.createFeature(r4, "App", ["mob"], "An app", undefined, "en");
    const r4dp = path.join(r4c.dir, "design.md");
    let r4d = rd(r4dp).replace(/> \*\*TODO\*\* — replace with real values \(remove this line when done\)\.\n/g, "Real content.\n");
    fs.writeFileSync(r4dp, r4d);
    const r4Filled = S.statusFeature(r4, "app").packSections.mob.sections.every((x) => x.present && x.filled);
    r4d = r4d.replace("## [MOB] Architecture\nReal content.\n", "").replace("## [MOB] Battery\nReal content.\n", "")
      .replace("## [MOB] Crash Reporting\nReal content.\n", "## [MOB] Platform\n### Crash Reporting\nNested under the marker.\n");
    fs.writeFileSync(r4dp, r4d + "\n## Power budget\nplain text\n");
    const r4After = Object.fromEntries(S.statusFeature(r4, "app").packSections.mob.sections.map((x) => [x.section, x.present && x.filled]));
    const r4Codes = r4Chk.problems.map((x) => x.code);
    ok(r4Chk.verdict === "warn" && r4Codes.filter((c) => c === "section-name-lead").length === 4 && r4Filled &&
      r4After["2 Offline Modes"] === true && r4After["🔐 Secrets"] === true && r4After["Section 3 Push"] === true && r4After["- Store Review"] === true,
      "F4 review R4: section names with a heading lead (emoji, '2 ', 'Section 3', '- ') match their own headings once filled — check warns section-name-lead (got " + js(r4After) + ")");
    ok(r4Codes.includes("section-core-name") && r4After["Architecture"] === false && r4After["Battery"] === false && r4After["Crash Reporting"] === true,
      "F4 review R7: pack sections are marker-bound — a core '## Architecture' (and a loose '## Power budget') never satisfies them, check warns section-core-name; an unmarked heading nested under a [MOB] heading does (got " + js(r4After) + ")");

    // R5: a missing pack's ghost sections never join another track's criteria — a pack added later cites its own slot.
    const r5 = rvNew("r5");
    writePack(r5, "a11y", A11Y_JSON, A11Y_FRAGS);
    S.createFeature(r5, "Login", ["tdd", "sec", "a11y"], "Login form", undefined, "en");
    fs.rmSync(packDir(r5, "a11y"), { recursive: true, force: true });
    writePack(r5, "mob", { name: "mob", marker: "MOB", title: "Mobile", sections: [{ name: "Offline" }] });
    S.addTrack(r5, "login", "mob");
    const r5Block = rd(path.join(r5, ".specs", "login", "tasks.md")).split("## Story US-1 — [MOB] Mobile")[1] || "";
    ok(/_Requirements: \[the \+mob criterion this task proves\]_/.test(r5Block) && !/US-1\.AC-1[3-9]|T-\d+/.test(r5Block),
      "F4 review R5: after the a11y pack is deleted, a new +mob task block cites +mob's own criterion slot — never the ghost [A11Y] criteria or their tests (got " + js(r5Block.slice(0, 200)) + ")");

    // R6: a hand-edited saved list with a word that is no pack (a typo, "security", "gdpr") keeps 1.14's rule — the files decide.
    const r6 = rvNew("r6");
    S.createFeature(r6, "Pay", ["tdd", "sec"], "payments", undefined, "en");
    const r6sp = path.join(r6, ".specs", "pay", ".state.json");
    const r6Out = [["core", "tdd", "security"], ["core", "tdd", "secc"], ["core", "gdpr"]].map((list) => {
      const st = JSON.parse(rd(r6sp));
      st.tracks = list;
      fs.writeFileSync(r6sp, JSON.stringify(st));
      const d = S.specDoctor(r6, "pay");
      return S.statusFeature(r6, "pay").tracks + (d.checks.some((c) => c.id === "track-pack-missing") ? " +warn" : "");
    });
    ok(r6Out.every((x) => x === "core +tdd +sec"), "F4 review R6: a saved list naming no pack (\"security\", a typo, \"gdpr\") falls back to the files as in 1.14 — core +tdd +sec, no track-pack-missing (got " + js(r6Out) + ")");

    // R8: import with a pack — its criteria come back after the imported US-1 ones, its test rows and task block cite them; trace passes.
    const r8 = rvNew("r8");
    writePack(r8, "a11y", A11Y_JSON, A11Y_FRAGS);
    const r8src = path.join(r8, "kiro", "login");
    fs.mkdirSync(r8src, { recursive: true });
    fs.writeFileSync(path.join(r8src, "requirements.md"), "# Requirements\n\n## Introduction\nLog in.\n\n### Requirement 1\n**User Story:** As a user, I want to log in, so that I can work.\n\n#### Acceptance Criteria\n1. WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. IF the password is wrong THEN THE SYSTEM SHALL show an error\n");
    const r8i = S.importSpec(r8, "kiro", "kiro/login", { tracks: ["tdd", "a11y"] });
    const r8Req = rd(path.join(r8, ".specs", "login", "requirements.md")), r8Plan = rd(path.join(r8, ".specs", "login", "test-plan.md"));
    const r8Tasks = rd(path.join(r8, ".specs", "login", "tasks.md"));
    const r8Tr = S.traceCheck(r8, "login");
    ok(r8i.ok && /#### \[A11Y\] Accessibility — Acceptance Criteria \(EARS\)\n3\. \*\*US-1\.AC-3\*\* — WHEN a user navigates with the keyboard only/.test(r8Req) &&
      /## \[A11Y\] Traceability Matrix[\s\S]*\| US-1\.AC-3 \|[\s\S]*\| US-1\.AC-4 \|/.test(r8Plan) && /\[A11Y\] Accessibility\n- \[ \] \d+\. \[US1\] Keyboard walk-through of login\n  - _Requirements: US-1\.AC-3_\n  - _Makes green: T-03_/.test(r8Tasks) &&
      r8Tr.verdict === "pass" && r8Tr.totalAcs === 4,
      "F4 review R8: spec_import with a pack — the [A11Y] criteria follow the imported US-1 ones (AC-3/4), the pack's rows plan them and its task block cites them; trace passes (got " + js(r8Tr.verdict) + ")");

    // R9: packs are cached across calls, and an edit is picked up by the very next call; a large pack set stays cheap once warm.
    const r9 = rvNew("r9");
    writePack(r9, "a11y", A11Y_JSON, A11Y_FRAGS);
    const r9t1 = S.trackPacks(r9, "list").packs[0].title;
    fs.writeFileSync(path.join(packDir(r9, "a11y"), "track.json"), JSON.stringify({ ...A11Y_OBJ, title: { en: "Accessible UI" } }));
    const r9t2 = S.trackPacks(r9, "list").packs[0].title;
    fs.writeFileSync(path.join(packDir(r9, "a11y"), "requirements.md"), "- THE SYSTEM SHALL label every [form field]\n- THE SYSTEM SHALL announce every error\n");
    const r9c = S.createFeature(r9, "Form", ["a11y"], "x", undefined, "en");
    const r9Req = rd(path.join(r9c.dir, "requirements.md"));
    for (let i = 0; i < 20; i++) {
      const n = "pk" + String.fromCharCode(97 + i);
      const fr = {};
      for (const l of ["", "pt/", "es/", "pt-BR/"]) for (const [k, v] of Object.entries(A11Y_FRAGS)) if (!k.includes("/")) fr[l + k] = v;
      writePack(r9, n, { ...A11Y_OBJ, name: n, marker: "PK" + String.fromCharCode(65 + i), steering: n + ".md" }, fr);
    }
    S.listFeatures(r9); // warm the caches
    const r9s = Date.now();
    for (let i = 0; i < 5; i++) S.featurePlaceholders(r9, "form", "requirements.md");
    const r9ms = (Date.now() - r9s) / 5;
    ok(r9t1 === "Accessibility" && r9t2 === "Accessible UI" && /#### \[A11Y\] Accessible UI — Acceptance Criteria \(EARS\)\n5\. \*\*US-1\.AC-5\*\* — THE SYSTEM SHALL label every \[form field\]/.test(r9Req) &&
      S.featurePlaceholders(r9, "form", "requirements.md").items.some((x) => x.text === "[form field]") && r9ms < 1000,
      "F4 review R9: pack edits (track.json, a fragment) are picked up by the next call despite the cross-call cache; 20 packs × 4 languages stay cheap once warm (" + r9ms.toFixed(1) + " ms per call)");

    // R10: fragment-ref names its language context and where the count comes from; the guidance's {{name}} is filled in.
    const r10 = rvNew("r10");
    writePack(r10, "a11y", { ...A11Y_OBJ, sections: [{ name: "Keyboard Map", guidance: "The keyboard map of {{name}} ({{marker}})." }] }, {
      "requirements.md": "- THE SYSTEM SHALL do one\n- THE SYSTEM SHALL do two\n",
      "tasks.md": "- [ ] both\n  - _Requirements: {{ac2}}_\n",
      "pt/requirements.md": "- O SISTEMA DEVE fazer uma coisa\n",
    });
    const r10p = S.trackPacks(r10, "check").problems.find((x) => x.code === "fragment-ref") || {};
    writePack(r10, "kbd", { name: "kbd", marker: "KBD", title: "Keyboard", sections: [{ name: "Keyboard Map", guidance: "The keyboard map of {{name}} ({{marker}})." }] });
    const r10c = S.createFeature(r10, "Search", ["kbd"], "x", undefined, "en");
    ok(/for pt features/.test(r10p.message || "") && /pt\/requirements\.md gives 1 criterion/.test(r10p.message || "") && r10p.file === ".specs/tracks/a11y/tasks.md" &&
      /## \[KBD\] Keyboard Map\n> \*\*TODO\*\*[^\n]*\nThe keyboard map of Search \(\[KBD\]\)\./.test(rd(path.join(r10c.dir, "design.md"))),
      "F4 review R10: fragment-ref names the language context and the file its count comes from; a section's guidance fills in {{name}} / {{marker}} (got " + js(r10p.message) + ")");
  }

  { // 1.21 F2b — project-level signal overrides learned from Phase 0 corrections (.specs/classifier.json): learned after two
    // consistent corrections, applied by classify {projectDir} and named, set / forget by hand, never silent, never a crash
    const js = (x) => JSON.stringify(x);
    const fdir = (n) => path.join(tmp, "proj-f2b-" + n);
    const cfile = (d) => path.join(d, ".specs", "classifier.json");
    const readC = (d) => (fs.existsSync(cfile(d)) ? fs.readFileSync(cfile(d), "utf8") : null);
    // (1) two consistent corrections: "admin panel" suggested +ui, the human created the feature core-only — twice
    const d1 = fdir("learn");
    S.initProject(d1, [], "en");
    const c1 = S.createFeature(d1, "Coupons admin", ["core"], "Admin panel to manage coupons with filters");
    const mid = S.classify("Admin panel for refunds", { projectDir: d1 });
    const c2 = S.createFeature(d1, "Sales admin", "core", "Admin panel for the sales team");
    const after = S.classify("Admin panel for refunds", { projectDir: d1 }), builtIn = S.classify("Admin panel for refunds");
    ok(c1.ok && js(c1.signalOverrides) === js({ learned: [{ track: "ui", word: "admin panel", effect: "off", count: 1, active: false }], forgotten: [] }) &&
      /Phase 0 correction recorded: 'admin panel' suggested \+ui and you left it off \(1 of 2/.test(c1.note) && mid.tracks.includes("ui") && !mid.overrides &&
      c2.signalOverrides.learned[0].active === true && /Learned from 2 consistent Phase 0 corrections: 'admin panel' no longer suggests \+ui/.test(c2.note) &&
      !after.tracks.includes("ui") && js(after.overrides) === js([{ track: "ui", word: "admin panel", effect: "off" }]) &&
      after.notes.some((n) => /signal overrides changed the reading \(\.specs\/classifier\.json\): 'admin panel' for \+ui → no signal/.test(n)) &&
      builtIn.tracks.includes("ui") && !builtIn.overrides,
      "1.21 F2b: two consistent Phase 0 corrections learn an override — pending after the first (the suggestion unchanged), applied after the second: 'admin panel' no longer suggests +ui in THIS project, and classify names it (`overrides` + a note); without the project the built-in reading stands (got " +
      js([c1.signalOverrides, c2.signalOverrides, mid.tracks, after.tracks, after.overrides]) + ")");
    // (2) the other direction: +ui added twice where "dashboard" was only a hint → a strong +ui signal; an agreement resets a
    // pending record; a correction that contradicts an applied override drops it
    const d2 = fdir("promote");
    S.initProject(d2, [], "en");
    const p1 = S.createFeature(d2, "Sales board", ["core", "ui"], "Metrics dashboard for sales");
    const p2 = S.createFeature(d2, "Marketing board", "core +ui", "Metrics dashboard for the marketing team");
    const pOn = S.classify("Metrics dashboard for finance", { projectDir: d2 });
    S.createFeature(d2, "Stock admin", ["core"], "Admin panel for the stock");
    const agreed = S.createFeature(d2, "Refund admin", ["core", "tdd", "ui"], "Admin panel for refunds");
    const pend = S.trackPacks(d2, "signals");
    const contra = S.createFeature(d2, "Ops board", ["core"], "Metrics dashboard for ops");
    const pAfter = S.classify("Metrics dashboard for finance", { projectDir: d2 });
    ok(p1.signalOverrides.learned[0].effect === "strong" && p2.signalOverrides.learned[0].active && pOn.tracks.includes("ui") &&
      js(pOn.overrides) === js([{ track: "ui", word: "dashboard", effect: "strong" }]) && agreed.signalOverrides && agreed.signalOverrides.forgotten.some((x) => x.word === "admin panel") &&
      !pend.overrides.some((o) => o.word === "admin panel") && contra.signalOverrides.forgotten.some((x) => x.word === "dashboard") && !pAfter.tracks.includes("ui"),
      "1.21 F2b: +ui added twice where 'dashboard' was only a hint makes it a strong +ui signal here; agreeing with a suggestion resets a pending correction; leaving +ui off where the learned 'dashboard' turned it on drops that override (got " +
      js([p1.signalOverrides, pOn.tracks, agreed.signalOverrides, contra.signalOverrides, pAfter.tracks]) + ")");
    // (3) set / forget by hand (MCP spec_tracks {action: "signals"} = the engine), validated; a set word applies at once and learning
    // never changes it; a word no table has is matched as a literal
    const d3 = fdir("set");
    S.initProject(d3, [], "en");
    const set1 = payload(await rpc("tools/call", { name: "spec_tracks", arguments: { action: "signals", op: "set", track: "obs", word: "heartbeat check", effect: "strong", projectDir: d3 } }));
    const hb = S.classify("Add a heartbeat check to the export worker", { projectDir: d3 });
    const setOff = S.trackPacks(d3, "signals", { op: "set", track: "ui", word: "Dashboard", effect: "off" });
    const learnSet = S.createFeature(d3, "Sales board", ["core", "ui"], "Sales dashboard"), keepSet = S.trackPacks(d3, "signals");
    const bad = [S.trackPacks(d3, "signals", { op: "set", track: "core", word: "x", effect: "off" }), S.trackPacks(d3, "signals", { op: "set", track: "uii", word: "x", effect: "off" }),
      S.trackPacks(d3, "signals", { op: "set", track: "ui", word: "(a|b)+", effect: "off" }), S.trackPacks(d3, "signals", { op: "set", track: "ui", word: "grid", effect: "loud" }),
      S.trackPacks(d3, "signals", { op: "forget", track: "ui", word: "nothing here" }), S.trackPacks(d3, "signals", { op: "purge" })];
    const fg = payload(await rpc("tools/call", { name: "spec_tracks", arguments: { action: "signals", op: "forget", track: "obs", word: "heartbeat check", projectDir: d3 } }));
    const listMcp = payload(await rpc("tools/call", { name: "spec_tracks", arguments: { action: "signals", projectDir: d3 } }));
    ok(set1.ok && set1.override.origin === "set" && set1.override.active && hb.tracks.includes("obs") && hb.overrides[0].word === "heartbeat check" &&
      setOff.ok && keepSet.overrides.find((o) => o.track === "ui").effect === "off" && keepSet.overrides.find((o) => o.track === "ui").origin === "set" && !learnSet.signalOverrides &&
      bad.every((r) => r.ok === false && typeof r.error === "string") && /core is always on/.test(bad[0].error) && /No track 'uii'/.test(bad[1].error) &&
      /not a signal word/.test(bad[2].error) && /Unknown effect 'loud'/.test(bad[3].error) && bad[4].notFound && /Unknown signals operation 'purge'/.test(bad[5].error) &&
      fg.ok && fg.removed.word === "heartbeat check" && js(listMcp) === js(S.trackPacks(d3, "signals")) && listMcp.overrides.length === 1 &&
      /^\{\n {2}"signals": \[\n {4}\{"track":"ui","word":"Dashboard","effect":"off","count":1,"origin":"set","lastAt":"[^"]+"\}\n {2}\]\n\}\n$/.test(readC(d3)),
      "1.21 F2b: spec_tracks {action: 'signals'} sets (applies at once — a word no table has is a literal signal), forgets and lists overrides; learning never changes a word set by hand; core, an unknown track, a pattern-like word, an unknown effect / op and a missing override are refused; MCP = engine; the file is one record per line (got " +
      js([set1, hb.tracks, bad.map((r) => r.error), readC(d3)]) + ")");
    // (4) a project without overrides is byte-identical — no classifier.json written when the human keeps the suggestion, no new keys
    // in classify / create results; a file of pending corrections only changes nothing either
    const d4 = fdir("same"), d5 = fdir("pending");
    S.initProject(d4, [], "en");
    S.initProject(d5, [], "en");
    fs.writeFileSync(cfile(d5), js({ signals: [{ track: "ui", word: "dashboard", effect: "off", count: 1, origin: "learned" }] }));
    const kept = S.createFeature(d4, "Coupons", ["core", "ui"], "Admin panel to manage coupons");
    const sample = ["Admin panel to manage coupons", "Metrics dashboard for sales", "We will not add feature flags or canary releases.", "Publicar eventos no Kafka.",
      "Sin datos personales ni autenticación", "Our public REST API returns problem+json errors"];
    ok(kept.ok && !("signalOverrides" in kept) && readC(d4) === null &&
      sample.every((t) => js(S.classify(t, { projectDir: d4 })) === js(S.classify(t, { projectDir: d5 })) && !("overrides" in S.classify(t, { projectDir: d4 })) &&
        !("overridesWarning" in S.classify(t, { projectDir: d5 })) && !("explain" in S.classify(t, { projectDir: d4 }))),
      "1.21 F2b: a project without overrides is byte-identical — no classifier.json when Phase 0 is confirmed as suggested, no signalOverrides / overrides / overridesWarning / explain key; a file holding only pending corrections reads the same (got " +
      js([kept.signalOverrides, readC(d4)]) + ")");
    // (5) a classifier.json that doesn't parse, or holds an invalid entry, is ignored with a warning — classify still answers, set /
    // learning refuse to rewrite it (its entries would be lost), list says what to fix; a 201st entry is beyond the bound
    const d6 = fdir("invalid");
    S.initProject(d6, [], "en");
    fs.writeFileSync(cfile(d6), "{ nope");
    const w1 = S.classify("Admin panel for refunds", { projectDir: d6 });
    const w1set = S.trackPacks(d6, "signals", { op: "set", track: "ui", word: "grid", effect: "weak" });
    const w1learn = S.createFeature(d6, "Admin", ["core"], "Admin panel for coupons");
    const w1list = S.trackPacks(d6, "signals"), w1raw = readC(d6);
    const many = Array.from({ length: 201 }, (_, i) => ({ track: "ui", word: "word" + i, effect: "off", origin: "set" }));
    fs.writeFileSync(cfile(d6), js({ signals: [{ track: "ui", word: "a|b", effect: "off" }, { track: "ui", word: "admin panel", effect: "off", origin: "set" }, ...many] }));
    const w2 = S.classify("Admin panel for refunds", { projectDir: d6 }), w2list = S.trackPacks(d6, "signals");
    ok(w1.tracks.includes("ui") && js(w1.overridesWarning) === js({ code: "invalid-json" }) && w1.notes.some((n) => /classifier\.json is ignored \(not valid JSON\)/.test(n)) &&
      !w1set.ok && /never rewritten/.test(w1set.error) && w1raw === "{ nope" &&
      w1learn.ok && w1learn.signalOverrides.error === "invalid-json" && /was not recorded/.test(w1learn.note) && w1list.ok && w1list.warning.code === "invalid-json" &&
      !w2.tracks.includes("ui") && w2.overridesWarning.code === "invalid-entries" && w2list.overrides.length === 200 &&
      w2list.problems.some((p) => p.index === 0 && p.code === "invalid-entry") && w2list.problems.some((p) => p.code === "too-many"),
      "1.21 F2b: an unparseable classifier.json is ignored with a warning (classify answers, set and learning refuse to rewrite it, list says why); an invalid entry is skipped with a warning while the valid ones apply; at most 200 overrides (got " +
      js([w1.overridesWarning, w1set.error, w1learn.signalOverrides, w2.overridesWarning, w2list.problems.slice(0, 2)]) + ")");
    // (6) explain: every match with its tiers, cue / override, negation — and the project's overrides with their state
    const ex = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "We will not add feature flags or canary releases; show a modal instead", explain: true, projectDir: d1 } }));
    const m = (kw) => ex.explain.matches.find((x) => x.keyword === kw) || {};
    ok(m("canary release").negated && m("canary release").negation === "list" && m("feature flag").negation === "before" && m("modal").base === "weak" &&
      m("modal").tier === "strong" && m("modal").cue && ex.explain.min === 2 && ex.explain.overrides.some((o) => o.word === "admin panel" && o.active && !o.applied),
      "1.21 F2b: spec_classify {explain} lists every match (table tier → final tier, a cue, the negation: before / a negated list) and the project's overrides with their state (got " +
      js([ex.explain.matches, ex.explain.overrides]) + ")");
  }

  { // 1.22 review — +sec's two-factor / multi-factor signal in PT / ES too; the reasoning of a track kept off by a lone weak signal
    const js = (x) => JSON.stringify(x);
    const on = (t) => S.classify(t).tracks.includes("sec");
    const pos = ["Add two-factor authentication to the login", "Adicionar autenticação de dois fatores ao login", "Añadir autenticación de dos factores al inicio de sesión",
      "Añadir autenticación de doble factor para administradores", "Add multi-factor authentication for admins", "Add multifactor authentication for admins",
      "Adicionar autenticação multifator para administradores", "Añadir autenticación multifactor para administradores"];
    // (review 2: a factor word counts only next to an auth word — "login com dois fatores" is a lone hint; login is +tdd's, not +sec's)
    const lone = S.classify("Adicionar login com dois fatores para os administradores");
    ok(pos.every(on) && !lone.tracks.includes("sec") && js(lone.signals.sec) === '["dois fatores"]' && !on("Os dois fatores principais do relatório") && !on("Uma doença multifatorial"),
      "1.22 review: 'autenticação de dois fatores', 'autenticación de dos factores / de doble factor', 'multi-factor / multifactor / multifator' are +sec's weak signal like 'two-factor' (+ the auth word: ON); alone only a hint (got " +
      js(pos.filter((t) => !on(t))) + ")");
    // 1.22 review 2 — the factor words in everyday phrases are no +sec signal at all (they were a weak one: a "Possible +sec" note, and
    // with one more weak word +sec turned ON): PT "depende de dois fatores", ES "depende de dos factores", "doble factor de ponderación",
    // EN "a multi-factor risk model". Next to an auth word they still count (above).
    const secSig = (t) => S.classify(t).signals.sec;
    const everyday = ["O cálculo do frete depende de dois fatores: o peso da encomenda e a distância até ao cliente.",
      "El precio final depende de dos factores: el volumen del pedido y la región del cliente.",
      "Build a multi-factor risk model that scores loan applicants from income and credit history.",
      "Ativar dois fatores para os administradores", "Os dois fatores principais do relatório"];
    const withWeak = ["O frete depende de dois fatores e da segurança da entrega.",
      "El descuento se calcula con doble factor de ponderación según la antigüedad del cliente y su credencial de socio."];
    ok(everyday.every((t) => !secSig(t).length) && withWeak.every((t) => !on(t) && secSig(t).length === 1) &&
      ["Adicionar autenticação de dois fatores", "Añadir doble factor de autenticación", "Add multi-factor sign-in"].every((t) => secSig(t).some((w) => /fator|factor/.test(w))),
      "1.22 review 2: 'depende de dois fatores' / 'depende de dos factores' / 'doble factor de ponderación' / 'a multi-factor risk model' are no +sec signal (one more weak word no longer turns +sec on); next to an auth word they are (got " +
      js([everyday.map(secSig), withWeak.map((t) => [on(t), secSig(t)])]) + ")");
    const api = S.classify("add a flag to the export endpoint");
    const apiPt = S.classify("adicionar uma flag ao endpoint de exportação", { lang: "pt" });
    const apiEs = S.classify("añadir un indicador al endpoint de exportación", { lang: "es" });
    const line = (r, t) => r.reasoning.split("\n").find((l) => l.startsWith("+" + t + ":")) || "";
    ok(js(api.signals.api) === '["endpoint"]' && !api.tracks.includes("api") && line(api, "api") === "+api: off — weak signal only ('endpoint'), not enough on its own." &&
      /^\+api: inativo — só sinais fracos \('endpoint'\)/.test(line(apiPt, "api")) && /^\+api: inactivo — solo señales débiles \('endpoint'\)/.test(line(apiEs, "api")) &&
      line(api, "ai") === "+ai: off — no signals matched.",
      "1.22 review: a track kept off with a weak signal says so in the reasoning (EN / PT / ES) — never 'no signals matched' beside a 'Possible +api' note (got " +
      js([line(api, "api"), line(apiPt, "api"), line(apiEs, "api")]) + ")");
  }

  { // 1.22 review 3 — natural phrasings of a factor word next to an auth VERB / connector: "Iniciar sesión con doble factor", "passam a
    // entrar com dois fatores", "Require multifactor at login" were no signal at all (their English twin "Admins sign in with
    // multi-factor" is +sec's weak signal); with the auth word they are +sec's weak signal, with another +sec word +sec is ON.
    const js = (x) => JSON.stringify(x);
    const sig = (t, lang) => S.classify(t, { lang }).signals.sec;
    const on = (t, lang) => S.classify(t, { lang }).tracks.includes("sec");
    const natural = [["Iniciar sesión con doble factor", "es"], ["Os administradores passam a entrar com dois fatores", "pt"], ["Require multifactor at login", "en"],
      ["Doble factor al iniciar sesión", "es"], ["Dois fatores ao entrar", "pt"], ["Admins log in with multi-factor", "en"]];
    const stillNone = [["O preço depende de dois fatores", "pt"], ["Vamos entrar no mercado com dois fatores de preço", "pt"], ["The risk model weighs multi-factor at random", "en"],
      ["El modelo al entrar usa dos factores de ponderación", "es"]];
    ok(natural.every(([t, l]) => sig(t, l).length === 1 && /fator|factor/.test(sig(t, l)[0])) && stillNone.every(([t, l]) => !sig(t, l).length) &&
      on("Iniciar sesión con doble factor y registro de auditoría", "es") && on("Require multifactor at login and encrypt the session tokens", "en"),
      "1.22 review 3 (8): 'iniciar sesión con doble factor', 'entrar com dois fatores', 'multifactor at login' (and 'al iniciar sesión', 'ao entrar', 'log in with') are +sec's weak signal next to the auth verb / connector; ON beside another +sec word; a factor word away from one stays none (got " +
      js([natural.map(([t, l]) => sig(t, l)), stillNone.map(([t, l]) => sig(t, l))]) + ")");
  }

  { // 1.22 review 4 — "multi-factored" / "multifactored" escaped the catch-all (a weak +sec signal: "a multi-factored discount and a security
    // deposit" was ON); PT / ES put the adjective between the auth noun and the factor word ("autenticação forte de dois fatores" was a
    // hint while "strong multi-factor authentication" is ON); a conjugated auth verb ("logs in", "signing in", "inicia sesión") was none.
    const js = (x) => JSON.stringify(x);
    const sig = (t, lang) => S.classify(t, { lang }).signals.sec;
    const on = (t, lang) => S.classify(t, { lang }).tracks.includes("sec");
    const offs = [["The pricing engine uses a multi-factored discount and a security deposit.", "en"], ["We need a multifactored scoring model and an encrypted export.", "en"]];
    const ons = [["Adicionar autenticação forte de dois fatores", "pt"], ["Adicionar autenticação obrigatória de dois fatores para administradores", "pt"],
      ["Añadir autenticación obligatoria de doble factor para administradores", "es"], ["Añadir autenticación reforzada de doble factor", "es"],
      ["The user logs in with multi-factor and the session token is encrypted", "en"], ["El administrador inicia sesión con doble factor y un registro de auditoría", "es"],
      ["Os utilizadores iniciam sessão com dois fatores e registo de auditoria", "pt"]];
    ok(offs.every(([t, l]) => !on(t, l) && sig(t, l).length === 1) && !sig("Build a multi-factored risk model that scores loan applicants.", "en").length &&
      ons.every(([t, l]) => on(t, l)) && !sig("O preço depende de dois fatores: o peso e a distância.", "pt").length,
      "1.22 review 4: an inflected factor word away from an auth word is no signal ('multi-factored discount'); 'autenticação forte / obrigatória de dois fatores', 'autenticación obligatoria / reforzada de doble factor', 'logs in / inicia sesión / iniciam sessão com …' keep the factor word (ON with another +sec word) (got " +
      js([offs.map(([t, l]) => sig(t, l)), ons.map(([t, l]) => [on(t, l), sig(t, l)])]) + ")");
  }

  { // review 5 (L29 + recall) — a short PT / ES summary in an English project; a version glued to a keyword; the missing auth / ML / REST words
    const js = (v) => JSON.stringify(v);
    const d = path.join(tmp, "proj-r5-classify");
    S.initProject(d, ["core"], "en");
    const cl = (t, o) => S.classify(t, o || { projectDir: d });
    const tr = (t, o) => cl(t, o).tracks.filter((x) => x !== "core").join(",");
    // L29a: one language's content words mark the language in a text with no English function word — its "no" is PT em + o
    const ptNo = [["Erro no pagamento", "tdd"], ["Cupom de desconto no checkout", "tdd"], ["Campo de email no login", "tdd"], ["Alertas no PagerDuty", "obs"]]
      .map(([t, w]) => [t, cl(t).lang, tr(t), w]);
    const enNo = [["No Kafka", ""], ["We need no Kafka", ""], ["No payments in the MVP", ""], ["Show the pagamento status in the dashboard", "tdd"]]
      .map(([t, w]) => [t, cl(t).lang, tr(t), w]);
    ok(ptNo.every(([, l, g, w]) => l === "pt" && g === w) && enNo.every(([, l, g, w]) => l === "en" && g === w) && cl("Exportar facturas").lang === "es",
      "review 5 (L29): 'Erro no pagamento', 'Cupom de desconto no checkout', 'Campo de email no login', 'Alertas no PagerDuty' read PT in an English project (their 'no' is em + o: +tdd / +obs kept); 'No Kafka', 'We need no Kafka' stay English negations; a PT word in an English sentence changes nothing (got " +
      js([ptNo, enNo]) + ")");
    // L29b: a version glued to an acronym-sized keyword or a product name; never to a longer word, never a track pack's
    const ver = ["Use OAuth2 for the partner sign-in", "Upgrade the summaries to GPT4", "Use GPT4o for the summaries", "Support TLS1.3 only", "Summaries with Claude3", "Use Gemini1.5 to tag photos"]
      .map((t) => [t, tr(t, {})]);
    ok(js(ver.map(([, g]) => g)) === js(["tdd", "ai", "ai", "", "ai", "ai"]) && cl("Support TLS1.3 only", {}).signals.sec.join() === "tls" &&
      !cl("Raging rivers", {}).signals.ai.length && !cl("Billing10x report", {}).signals.tdd.length,
      "review 5 (L29): OAuth2 / GPT4 / GPT4o / TLS1.3 / Claude3 / Gemini1.5 are their keyword's signal (TLS a weak +sec one); 'raging' and 'Billing10x' are not (got " + js(ver) + ")");
    // recall: +sec (password, SSO / OIDC / SAML, role-based access control), +ai (machine learning), +api (a REST endpoint) — EN / PT / ES
    const rec = [["Add user authentication with email and password", "sec"], ["Use OAuth2 / OIDC single sign-on for employees", "sec"],
      ["Role-based access control for admins", "sec"], ["Controle de acesso baseado em papéis para administradores", "sec"], ["Control de acceso basado en roles", "sec"],
      ["Detect fraud with a machine learning model", "ai"], ["Detetar fraude com aprendizagem automática", "ai"], ["Detectar fraude con aprendizaje automático", "ai"],
      ["Expose a REST endpoint for orders", "api"], ["Expor um endpoint REST para encomendas", "api"], ["Exponer un endpoint REST para pedidos", "api"]].map(([t, w]) => [t, tr(t, {}), w]);
    const hints = [["SSO (single sign-on) for staff", "sec"], ["Password reset email", "sec"], ["Call the Stripe REST endpoint to refund", "api"]]
      .map(([t, w]) => { const r = cl(t, {}); return [t, r.tracks.includes(w), (r.possible || []).some((p) => p.track === w)]; });
    ok(rec.every(([, g, w]) => g.split(",").includes(w)) && hints.every(([, on, poss]) => !on && poss),
      "review 5: +sec (authentication + password, OIDC + single sign-on, role-based access control EN / PT / ES), +ai (machine learning EN / PT / ES), +api (a REST endpoint we expose EN / PT / ES) turn on; 'SSO (single sign-on)' (one concept), a password reset, a third party's REST endpoint stay hints (got " +
      js([rec, hints]) + ")");
  }
};

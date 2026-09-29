"use strict";

/**
 * dev-spec-driven — localized scaffold content (EN / PT / ES, plus pt-BR DERIVED from PT — see "pt-BR — a derived
 * locale" in i18n/pt-br.js). Zero-dependency, data-only.
 *
 * This module holds ALL user-facing text the engine GENERATES (feature artifacts, steering
 * stubs) and the human-readable tool messages (doctor / clarify / next-action / hooks) — as a facade: each language's
 * blocks live in mcp/lib/i18n/<lang>.js (en · pt · es), the shared helpers in i18n/common.js and the pt-BR derivation in
 * i18n/pt-br.js; the tables are assembled here, and this file is what the engine and the tests require.
 * The engine (mcp/lib/spec.js over mcp/lib/engine/) keeps the logic; it calls the builders here with a resolved `lang`.
 *
 * Language model: a project picks ONE language (persisted in `.specs/roadmap.json` meta.lang —
 * the single source of truth), inherited by every new feature and overridable per feature
 * (persisted in `.specs/<feature>/.state.json` lang). `spec.js` resolves the lang and passes it.
 *
 * STABLE TOKENS — never translated, the tooling matches them literally:
 *   AC/SC/test IDs (US-1.AC-1, SC-001, T-01, EC-1, NFR-1), section markers ([SaaS], [AI], [SEC], [PRIVACY], [DIST]),
 *   story/parallel tags ([US1], [US2], [shared], [P]), the unfilled sentinel `> **TODO**`,
 *   `[NEEDS CLARIFICATION]`, the annotation tags `_Requirements:_ / _Makes green:_ /
 *   _Affects evals:_ / _Emits metrics:_ / _Implements:_`, `**Checkpoint:**`, the ```mermaid /
 *   ```typescript fences, the eval-harness headings `## System` / `## User Template`, and the test-plan
 *   Kind values (example / property).
 * EARS modal/keywords ARE localized (WHEN→QUANDO→CUANDO, THE SYSTEM SHALL→O SISTEMA DEVE→
 * EL SISTEMA DEBE, …) because earsValidate recognizes all three languages. Translated headings
 * are matched by the synonym tables (SAAS_SECTIONS/AI_SECTIONS/SEC_SECTIONS/PRIVACY_SECTIONS/DIST_SECTIONS) and RE_* matchers in the engine.
 */

const { BASE_LANGS, LANGS, normalizeLang, canonicalLang, baseLang, templateTests } = require("./i18n/common.js");
const { toPtBr, derivePtBr, defineDerivedLocale, PTBR_STOP_EXTRA } = require("./i18n/pt-br.js");
// Each language's blocks (the AUTHORED locales: pt-BR derives from pt below).
const LOCALES = { en: require("./i18n/en.js"), pt: require("./i18n/pt.js"), es: require("./i18n/es.js") };
const table = (key) => ({ en: LOCALES.en[key], pt: LOCALES.pt[key], es: LOCALES.es[key] });

// Artifact builders, one set per language (i18n/<lang>.js `build`).
const BUILD = table("build");
// Steering stubs, one set per language. Filenames stay constant; content localized.
const STEERING = table("steering");
// The evals README, a single block per language.
const EVALS_README = table("evalsReadme");
// Human-readable tool messages (doctor / clarify / next-action / add-track / init notes / hook output).
const MSG = table("msg");
// The [SEC] / [PRIVACY] section display names live with their track's messages; every caller reads sectionNames.
for (const l of BASE_LANGS) Object.assign(MSG[l].sectionNames, MSG[l].secPrivacy.sectionNames); // pt-BR derives from pt's merged table

// 1.16 Q — spec quality (Q1 steering amendments, Q2 cross-feature acceptance criteria, Q3 the glossary): one group per
// language, merged into MSG (pt-BR derives from pt's).
const QUALITY_MSG = table("quality");
for (const l of BASE_LANGS) MSG[l].quality = QUALITY_MSG[l];

// 1.17 A — doctor's design-tradeoffs / design-risks details and spec_clarify's consistency nudge, merged into MSG.
const DESIGN_WEIGH_MSG = table("designWeigh");
for (const l of BASE_LANGS) MSG[l].designWeigh = DESIGN_WEIGH_MSG[l];

// Task brief (spec_task_brief) labels and loop rules per language; renderBrief() owns the layout.
const BRIEF = table("brief");
for (const l of BASE_LANGS) LOCALES[l].__link({ BUILD, MSG }); // the builders' and messages' own cross-references (call time)

// Layout of the brief (language-neutral; every label comes from BRIEF[lang]).
function renderBrief(d, lang) {
  const t = BRIEF[normalizeLang(lang)];
  const out = [];
  const push = (...lines) => out.push(...lines);
  const task = d.task;
  push(t.title(d.feature, task.number), "", "> " + t.intro, "");
  push(`- **${t.story}:** ${task.story || "—"} · **${t.phase}:** ${task.phase || "—"} · **${t.parallel}:** ${task.parallel ? t.yes : t.no}`);
  push(`- **${t.tracks}:** ${d.tracks} · **${t.loop}:** ${d.loop}`);
  if (d.inlineOnly) push("", t.inlineOnly);

  push("", t.task, `${task.number}. ${task.text}`, ...task.body.map((l) => "   " + l));
  if ((d.dependsOn || []).length) { // 1.14 F3: the task's _Depends:_ and where each stands
    const TD = MSG[normalizeLang(lang)].taskDeps;
    const mark = { done: "✓", open: "○", missing: "✗" };
    push("", TD.briefHeading, ...d.dependsOn.map((x) => `- #${x.number} ${mark[x.status]} ${TD.briefStatus[x.status]}${x.text ? " — " + x.text : ""}`));
    if (d.dependsOn.some((x) => x.status !== "done")) push("", TD.briefOpenNote);
  }
  if (d.stories.length) {
    push("", t.context);
    d.stories.forEach((s, i) => { if (i) push(""); push(`**${s[0]}**`, ...s.slice(1)); });
  }
  if (d.bug) { // a bugfix task: the reproduction and the root cause it must respect (or that they are still unwritten)
    push("", t.bug, `**${t.bugRepro}**`, d.bug.reproduction || t.bugUnfilled, "", `**${t.bugRootCause}**`, d.bug.rootCause || t.bugUnfilled);
  }

  push("", t.acs);
  if (d.acceptanceCriteria.length) d.acceptanceCriteria.forEach((a) => push("- " + a.text));
  else push(t.acsNone);
  // 1.16 Q3: the glossary entries this task's text and criteria use (bounded) — the words to use, and the ones to avoid
  if ((d.glossary || []).length) {
    const Q = MSG[normalizeLang(lang)].quality;
    push("", Q.briefGlossaryHeading, Q.briefGlossaryIntro);
    d.glossary.forEach((g) => push(`- **${g.term}**${g.definition ? " — " + g.definition : ""}${g.avoid.length ? ` _(${Q.briefGlossaryAvoid(g.avoid.join(", "))})_` : ""}`));
    if ((d.glossaryOmitted || []).length) push(Q.briefGlossaryOmitted(d.glossaryOmitted.join(", ")));
  }

  if (d.tests.length) {
    push("", d.expectFail ? t.testsRed : t.tests); // full review Ga7: a red task writes the tests; it never makes them green
    let lastHeader;
    for (const r of d.tests) {
      if (r.header && r.header !== lastHeader) {
        push(r.header, r.sep || r.header.replace(/[^|]/g, "-"));
        lastHeader = r.header;
      } else if (!r.header) lastHeader = undefined;
      push(r.row);
    }
  }
  if (d.evals.length) push("", t.evals, ...d.evals.map((e) => "- " + e));
  if (d.metrics.length) push("", t.metrics, ...d.metrics.map((m) => "- `" + m + "`"));
  if (d.implements.length) push("", t.files, ...d.implements.map((f) => "- `" + f + "`"));
  const verify = d.verify || [];
  if (verify.length) push("", t.verification, ...verify.map((c) => "- `" + c + "`"));
  if ((d.verifyPipes || []).length) push("", MSG[normalizeLang(lang)].verifyPipe.brief(d.verifyPipes));
  // B5: _Expect: fail_ — the Verification section says the run must fail (the heading too when the task has no _Verify:_)
  if (d.expectFail) push(...(verify.length ? [] : ["", t.verification]), "", MSG[normalizeLang(lang)].redGreen.briefExpect);

  if (d.design.toc.length) {
    push("", t.design, t.designToc(d.design.path) + " " + d.design.toc.join(" · "));
    d.design.included.forEach((s) => push("", "### " + s.title, s.body));
    if (d.design.omitted.length) push("", t.designOmitted + " " + d.design.omitted.join(" · "));
  }
  // 1.14 C2: the decisions.md entries that cite this task's ACs / T-IDs (bounded; superseded ones left out)
  if ((d.decisions || []).length) {
    const D = MSG[normalizeLang(lang)].decisions;
    push("", D.briefHeading, D.briefIntro);
    d.decisions.forEach((x) => push(`- **${x.id}** — ${x.title} _(${[D.kinds[x.kind] || x.kind, x.affects.join(", "), x.supersedes.length ? D.supersedesNote(x.supersedes.join(", ")) : ""].filter(Boolean).join(" · ")})_` + (x.text ? ": " + x.text : "")));
    if ((d.decisionsOmitted || []).length) push(D.briefOmitted(d.decisionsOmitted.join(", ")));
  }

  const constraints = d.globalConstraints || [];
  const scoped = d.steeringScoped || []; // fileMatch steering matching this task's files, quoted (front matter stripped)
  const manual = d.steeringManual || [];
  if (constraints.length || d.steering.length || manual.length) {
    push("", t.steering);
    if (constraints.length) push(t.constraintsIntro, ...constraints);
    if (constraints.length && d.steering.length) push("");
    if (d.steering.length) push(t.steeringRead + " " + d.steering.map((p) => "`" + p + "`").join(", "));
    const S = MSG[normalizeLang(lang)].scopedSteering;
    // Quoted as a blockquote: the file's own headings can't break the brief's outline.
    if (scoped.length) push("", S.scoped);
    scoped.forEach((s) => push("", `**\`${s.path}\`** (fileMatch: ${s.patterns.map((p) => "`" + p + "`").join(", ")})`, ...s.body.split(/\r?\n/).map((l) => (l ? "> " + l : ">"))));
    if (manual.length) push("", S.manual + " " + manual.map((p) => "`" + p + "`").join(", "));
  }

  if (d.unresolved.acs.length || d.unresolved.tests.length) {
    push("", t.unresolved, t.unresolvedNote, ...[...d.unresolved.acs, ...d.unresolved.tests].map((id) => "- " + id));
  }

  // full review Ga7: an _Expect: fail_ task's definition of done is the red task's (write the test, it must FAIL for the right
  // reason, no production code) — the loop's "make the target tests green" / "nothing that passed may fail" contradicted it.
  const rules = d.expectFail ? t.redRules : t.loopRules[d.loop];
  push("", t.dod, ...rules.map((r, i) => `${i + 1}. ${r}`));
  let extra = rules.length;
  if (d.metrics.length) push(`${++extra}. ${t.metricsRule}`);
  if (d.evals.length && d.loop !== "ai-prompt") push(`${++extra}. ${t.evalsRule}`);
  if (verify.length) push(`${++extra}. ${t.verifyRule}`);
  const B5 = MSG[normalizeLang(lang)]; // B5: the red run, then the project checks (roadmap.json meta.checks)
  if (d.expectFail) push(`${++extra}. ${B5.redGreen.dodExpect}`);
  if ((d.projectChecks || []).length) push(`${++extra}. ${B5.projectChecks[d.expectFail ? "briefDodRed" : "briefDod"](d.projectChecks.map((c) => "`" + c.command + "` (" + c.name + ")").join(" · "))}`);
  if (task.checkpoint) push("", t.checkpoint, "**Checkpoint:** " + task.checkpoint);

  push("", t.report, t.reportTo(d.reportPath), "");
  return out.join("\n");
}

// pt-BR (1.14 D1) — every table's pt-BR twin, derived lazily from pt (i18n/pt-br.js).
defineDerivedLocale(BUILD);
defineDerivedLocale(STEERING);
defineDerivedLocale(EVALS_README);
defineDerivedLocale(BRIEF);
defineDerivedLocale(MSG, { stopGate: { claims: true, negators: true, admissions: true, fixed: true } }, {
  stopGate: (m, pt) => Object.assign(m, { claims: [...pt.claims, ...PTBR_STOP_EXTRA.claims], admissions: [...pt.admissions, ...PTBR_STOP_EXTRA.admissions] }),
});


// ===========================================================================
// Public API — thin dispatchers that resolve the language and delegate.
// ===========================================================================

function L(lang) { return BUILD[normalizeLang(lang)]; }

module.exports = {
  LANGS,
  BASE_LANGS,
  normalizeLang,
  canonicalLang,
  baseLang,
  toPtBr, // (text, masks?) European → Brazilian Portuguese (the pt-BR derivation, 1.14 D1)
  derivePtBr: (value, raw) => derivePtBr(value, raw || null, null, value), // a pt table (spec.js's roadmap chrome) → its pt-BR twin
  // artifact builders
  classification: (a, lang) => L(lang).classification(a),
  requirements: (a, lang) => L(lang).requirements(a),
  trackDesignBlock: (track, lang) => L(lang).trackDesignBlock(track),
  design: (a, lang) => L(lang).design(a),
  tasks: (a, lang) => L(lang).tasks(a),
  testPlan: (name, lang, tracks, acs) => L(lang).testPlan(name, tracks, acs), // tracks: which template ACs get a planned test; acs: the real AC IDs instead (one generic row each)
  templateAcIds: (tracks) => Object.keys(templateTests(tracks)), // the template AC IDs a test plan scaffolded for these tracks covers
  evalPlan: (name, lang) => L(lang).evalPlan(name),
  loadTest: (name, lang) => L(lang).loadTest(name),
  quickstart: (name, lang) => L(lang).quickstart(name),
  checklist: (a, lang) => L(lang).checklist(a),
  integrationPlan: (name, lang) => L(lang).integrationPlan(name),
  promptStub: (name, lang) => L(lang).promptStub(name),
  evalsReadme: (lang) => EVALS_README[normalizeLang(lang)],
  // steering
  // Own keys only: 'constructor' / '__proto__' / 'toString' must be "unknown file", not Object.prototype members.
  steeringStub: (file, lang) => {
    const t = STEERING[normalizeLang(lang)];
    return typeof file === "string" && Object.prototype.hasOwnProperty.call(t, file) ? t[file] : undefined;
  },
  steeringKnownFiles: () => Object.keys(STEERING.en),
  // tool messages
  msg: (lang) => MSG[normalizeLang(lang)],
  // task brief (spec_task_brief)
  brief: (lang) => BRIEF[normalizeLang(lang)],
  // bugfix templates (spec_create kind:"bugfix")
  bugReport: (a, lang) => L(lang).bugReport(a),
  bugRequirements: (a, lang) => L(lang).bugRequirements(a),
  bugTestPlan: (name, lang) => L(lang).bugTestPlan(name),
  bugTasks: (name, lang) => L(lang).bugTasks(name),
  renderBrief,
};

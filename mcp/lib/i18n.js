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
 * The STRUCTURE every language's scaffolds share is written once here (LAYOUTS, approvalAction, renderBrief, renderRetro):
 * a language's file holds what they say (its `text` block), never which sections come or under which condition.
 *
 * Language model: a project picks ONE language (persisted in `.specs/roadmap.json` meta.lang —
 * the single source of truth), inherited by every new feature and overridable per feature
 * (persisted in `.specs/<feature>/.state.json` lang). The engine (engine/state.js) resolves the lang and passes it.
 *
 * STABLE TOKENS — never translated, the tooling matches them literally:
 *   AC/SC/test IDs (US-1.AC-1, SC-001, T-01, EC-1, NFR-1), every marker track's section marker ([SaaS], [AI], [SEC],
 *   [PRIVACY], [DIST], [API], [UI], [OBS], [DATA] — engine/tracks.js TRACK_MARKER, rendered in MARKER_TRACK_ORDER) and a
 *   track pack's own,
 *   story/parallel tags ([US1], [US2], [shared], [P]), the unfilled sentinel `> **TODO**`,
 *   `[NEEDS CLARIFICATION]`, the annotation tags `_Requirements:_ / _Makes green:_ /
 *   _Affects evals:_ / _Emits metrics:_ / _Implements:_`, `**Checkpoint:**`, the ```mermaid /
 *   ```typescript fences, the eval-harness headings `## System` / `## User Template`, and the test-plan
 *   Kind values (example / property).
 * EARS modal/keywords ARE localized (WHEN→QUANDO→CUANDO, THE SYSTEM SHALL→O SISTEMA DEVE→
 * EL SISTEMA DEBE, …) because earsValidate recognizes all three languages. Translated headings
 * are matched by the synonym tables (every table of TRACK_SECTIONS in engine/tracks.js — one per marker track, SAAS_SECTIONS …
 * DATA_SECTIONS) and RE_* matchers in the engine.
 */

const { BASE_LANGS, LANGS, normalizeLang, canonicalLang, baseLang, templateTests, DEV_SPEC, DEV_SPEC_SCRIPT, cliPrefix, portableCli, FEATURE_SIZES,
  TEMPLATE_ACS, MARKER_TRACK_ORDER, MARKER_TAG, greenLine, signalTracks, templateTestRows, coreSuperseded } = require("./i18n/common.js");
// The pt-BR derivation (i18n/pt-br.js) loads on its first use — a table's "pt-BR" entry, toPtBr, derivePtBr: a process
// that never meets pt-BR (most hooks) doesn't load it.
let PTBR = null;
const ptbr = () => PTBR || ((PTBR = require("./i18n/pt-br.js")), localeFileLoaded("i18n/pt-br.js"), PTBR);
// 1.20 review — the engine's corpus check (engine/markdown.js) is told of every language file loaded on demand
// (onLocaleLoad(fn): fn("i18n/<file>.js") once it has loaded): a file that changed on disk after the engine loaded (a
// `git pull` under a long-lived MCP server) must not run under a corpus stamped for the old one. A listener never breaks
// a load.
const LOCALE_LISTENERS = [];
const onLocaleLoad = (fn) => { if (typeof fn === "function") LOCALE_LISTENERS.push(fn); };
function localeFileLoaded(rel) {
  for (const fn of LOCALE_LISTENERS) { try { fn(rel); } catch { /* the listener's own trouble */ } }
}

// Artifact builders, one set per language: i18n/<lang>.js `build` (its single-template builders) plus LAYOUTS bound to its
// `text` block (loadLocale).
const BUILD = {};
// Steering stubs, one set per language. Filenames stay constant; content localized.
const STEERING = {};
// The evals README, a single block per language.
const EVALS_README = {};
// Human-readable tool messages (doctor / clarify / next-action / add-track / init notes / hook output).
const MSG = {};
// 1.16 Q — spec quality (Q1 steering amendments, Q2 cross-feature acceptance criteria, Q3 the glossary): one group per
// language, merged into MSG (pt-BR derives from pt's).
const QUALITY_MSG = {};
// 1.17 A — doctor's design-tradeoffs / design-risks details and spec_clarify's consistency nudge, merged into MSG.
const DESIGN_WEIGH_MSG = {};
// Task brief (spec_task_brief) labels and loop rules per language; renderBrief() owns the layout.
const BRIEF = {};
// Each AUTHORED locale's blocks (i18n/<lang>.js) load on the first use of any table's entry for that language — a process
// pays only for the languages it speaks. Every table holds its en · pt · es keys from the start, in that order (pt-BR
// follows, derived from pt below); the first read of one replaces all of that language's getters by its blocks, runs
// the merges into MSG and links the language file to the assembled BUILD / MSG (its own cross-references, call time).
const LOCALE_FILES = { en: "./i18n/en.js", pt: "./i18n/pt.js", es: "./i18n/es.js" };
const TABLES = [[BUILD, "build"], [STEERING, "steering"], [EVALS_README, "evalsReadme"], [MSG, "msg"], [QUALITY_MSG, "quality"],
  [DESIGN_WEIGH_MSG, "designWeigh"], [BRIEF, "brief"]];
function loadLocale(l) {
  const blocks = require(LOCALE_FILES[l]);
  for (const [t, key] of TABLES) Object.defineProperty(t, l, { value: blocks[key], enumerable: true, configurable: true, writable: true });
  // The artifact layouts, bound to this language's text: BUILD[l] holds them beside the builders the language writes whole.
  for (const name of Object.keys(LAYOUTS)) BUILD[l][name] = (...args) => LAYOUTS[name](blocks.text, ...args);
  // …and the approval guard's action sentence (its decision tree, approvalAction below — the sentences in text.approvalActions,
  // never in MSG: pt-BR derives the bound function's output, not a group of sentences the hook would pay toPtBr for).
  MSG[l].approvalGuard.action = (a) => approvalAction(blocks.text.approvalActions, a);
  // The [SEC] / [PRIVACY] section display names live with their track's messages; every caller reads sectionNames.
  Object.assign(MSG[l].sectionNames, MSG[l].secPrivacy.sectionNames); // pt-BR derives from pt's merged table
  MSG[l].quality = QUALITY_MSG[l];
  MSG[l].designWeigh = DESIGN_WEIGH_MSG[l];
  blocks.__link({ BUILD, MSG, renderRetro });
  localeFileLoaded(LOCALE_FILES[l].slice(2)); // "i18n/<l>.js"
}
for (const l of BASE_LANGS) for (const [t] of TABLES) Object.defineProperty(t, l, { enumerable: true, configurable: true, get() { loadLocale(l); return t[l]; } });

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
  // 1.19 R2 — search before you write: the design's Reuse & Integration entries for this task (a table row's cells joined by
  // " · ", a list item without its bullet) and the existing source files next to the task's own (bounded by the engine)
  if (d.reuse) {
    const r = d.reuse;
    const entry = (e) => (/^\s*\|/.test(e) ? e.split("|").map((c) => c.trim()).filter(Boolean).join(" · ") : e.replace(/^(?:[-*+]|\d+[.)])\s+/, ""));
    push("", t.reuse, t.reuseRule);
    if (r.entries.length) push("", t.reuseEntries, ...r.entries.map((e) => "- " + entry(e)));
    if (r.omitted) push(t.reuseOmitted(r.omitted));
    if (!r.entries.length && r.total) push("", t.reuseNoMatch(r.total));
    if (r.files.length) push("", t.reuseFiles, ...r.files.map((f) => "- `" + f + "`"));
    // R review 4: a folder read up to its cap (`truncated`) makes the count a lower bound — "at least N more", or "possibly more"
    if (r.files.length && (r.more || r.truncated)) push(t.reuseFilesMore(r.more, !!r.truncated));
  }
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

// Layout of a feature's retro.md (spec_metrics {write} — engine/finish.js calls a language's MSG.metrics.retro(m, fmt), which
// renders through here): language-neutral, every label from that language's metrics.retroText (T), its phase names from
// metrics.phase (P). It lived in en.js until 1.25.1 — a PT or ES retro loaded the English locale file to render.
// fmt: { dur, today, day? } — day: a stored instant's calendar date (finish.js passes dayOf, the local date).
function renderRetro(T, P, m, fmt) {
  const lt = m.leadTime || {};
  const rows = [[T.created, m.createdAt ? (fmt.day ? fmt.day(m.createdAt) : m.createdAt.slice(0, 10)) + (m.createdAtApproximate ? ` (${T.approximate})` : "") : T.unknown]];
  for (const ph of ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "complete", "finished"]) {
    if (lt[ph]) rows.push([T.lead(P[ph] || ph), fmt.dur(lt[ph].hours) + (lt[ph].approximate ? ` (${T.approximate})` : "")]);
  }
  const by = m.reworkByPhase ? Object.entries(m.reworkByPhase).map(([ph, n]) => `${P[ph] || ph} ${n}`).join(", ") : "";
  const reworkValue = m.rework == null ? null : m.rework + (by ? ` (${by})` : "");
  rows.push([T.rework, reworkValue == null ? T.reworkUnknown
    : m.reworkLowerBound && Array.isArray(m.legacyPhases) ? T.reworkPartial(reworkValue, m.legacyPhases.map((ph) => P[ph] || ph).join(", ")) : reworkValue]);
  rows.push([T.forced, String(m.forcedApprovals)]);
  rows.push([T.changes, `${m.changeRequests} (${T.reopened(m.reopenedTasks)})`]);
  rows.push([T.passRate, m.evidence && m.evidence.runs ? T.runs(m.evidence.passRate, m.evidence.passing, m.evidence.runs) : T.noRuns]);
  rows.push([T.tasks, T.tasksValue(m.tasks.done, m.tasks.total)]);
  rows.push([T.clar, String(m.openClarifications)]);
  const sig = [];
  if (m.reworkByPhase) for (const [ph, n] of Object.entries(m.reworkByPhase)) sig.push(T.sigRework(P[ph] || ph, n + 1));
  if (m.forcedApprovals) sig.push(T.sigForced(m.forcedApprovals));
  if (m.reopenedTasks) sig.push(T.sigReopened(m.reopenedTasks));
  if (m.evidence && m.evidence.runs && m.evidence.passRate < 100) sig.push(T.sigPass(m.evidence.passRate));
  if (m.openClarifications) sig.push(T.sigClar(m.openClarifications));
  return [T.title(m.feature), "", T.intro(fmt.today), "", T.metrics, "", T.header, "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`), "",
    T.well, "", "- ", "", T.hurt, "", ...(sig.length ? [T.signals(sig.join("; "))] : []), "- ", "", T.amend, "", T.amendNote, "- ", "",
    T.followUps, "", T.followUpsNote, "- ", ""].join("\n");
}

// ===========================================================================
// Artifact layouts (1.27) — the STRUCTURE every language's scaffolds share: which sections, in which order, under which
// track or size; the IDs, markers, numbering and fixed annotation lines. A language's file holds only what they SAY: its
// `text` block (strings — a function where a value sits inside a sentence). loadLocale binds each layout to a language's
// text as BUILD[lang].<name>, beside the builders a language still writes whole (one template each, no structure to share);
// pt-BR derives from pt's bound builders like from any other (toPtBr over each whole output). A structural change is made
// here, once — the three language files no longer change together for it.
// ===========================================================================
const own = (o, k) => (o && typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
// Each built-in track's template tasks (+tdd has none — it only adds markers), in order: the criteria each one implements
// (US-1.AC-<n>, its _Requirements:_), whether a +tdd scaffold's tests make them green (_Makes green:_ — only on a greenfield
// scaffold, whose test plan holds those T-IDs) and a fixed annotation before / after that line. The text of each task:
// text.trackTasks[track].tasks, in this order.
const TRACK_TASK_PLAN = {
  saas: [{ ac: [6] }, { ac: [6], green: true }, { ac: [5], green: true }],
  ai: [{ ac: [7, 8], before: "_Affects evals: golden, adversarial, regression_", green: true }, { ac: [9], green: true }],
  sec: [{ ac: [10, 11, 12] }, { ac: [10, 11], green: true }, { ac: [12], green: true }, { ac: [10, 11, 12] }],
  privacy: [{ ac: [13, 14, 15] }, { ac: [13, 14], green: true }, { ac: [15], green: true }],
  dist: [{ ac: [16], green: true }, { ac: [17], green: true }, { ac: [18], green: true }, { ac: [19], green: true }, { ac: [16, 17, 18, 19] }],
  api: [{ ac: [20, 21, 22, 23] }, { ac: [20], green: true }, { ac: [21, 22], green: true }, { ac: [23], green: true }, { ac: [20, 21, 22, 23] }],
  ui: [{ ac: [24, 25, 26, 27] }, { ac: [26, 27], green: true }, { ac: [24, 25], green: true }, { ac: [24, 25] }, { ac: [24, 26, 27] }],
  obs: [{ ac: [29], green: true }, { ac: [28], green: true, after: "_Emits metrics: requests_total, request_duration_seconds, errors_total_" },
    { ac: [30], green: true }, { ac: [31], green: true }, { ac: [28, 29, 30, 31] }],
  data: [{ ac: [35], green: true }, { ac: [32, 34], green: true }, { ac: [33], green: true }, { ac: [33] }, { ac: [32, 33, 34, 35] }],
};
const LAYOUTS = {
  // classification.md: a signal line per active track (signalTracks: +tdd, the marker tracks, then a project's packs — up to six
  // distinct signals each), the Hot Path / Autonomy / Volume sections only with +saas / +ai, the Summary only when given.
  classification(T, a) {
    const K = T.classification;
    const sig = a.signals || { tdd: [], saas: [], ai: [] };
    const sigLine = (t) => (a.tracks.includes(t) ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || K.signalSlot} — ${K.whySlot}` : null);
    const saas = a.tracks.includes("saas"), ai = a.tracks.includes("ai");
    return `${K.title(a.name)}\n\n${K.mode}\n\n${K.activeTracks}\n${a.label}\n\n${K.signals}\n${signalTracks(a.tracks).map(sigLine).filter(Boolean).join("\n") || K.noSignals}\n\n` +
      `${K.blastRadius}\n${saas ? "\n" + K.hotPath + "\n" : ""}${ai ? "\n" + K.autonomy + "\n" : ""}${saas || ai ? "\n" + K.volume + "\n" : ""}\n${K.compliance}\n\n` +
      (a.summary ? K.summary + "\n" + a.summary + "\n" : "");
  },

  // requirements.md: the title and Summary, the user stories up to the core criteria (size S: one story, two criteria), then
  // each active track's criteria under its marker's heading — inactive (not a gate, not a placeholder) once the track is off;
  // they keep their TEMPLATE_ACS numbers at every size (US-1.AC-5…) — then the rest.
  requirements(T, a) {
    const R = T.requirements, s = a.size === "s";
    const trackAcs = MARKER_TRACK_ORDER.filter((t) => a.tracks.includes(t)).map((t) => `\n\n#### ${MARKER_TAG[t]} ${R.trackAcsHeading}\n` +
      TEMPLATE_ACS[t].map((id, i) => `${id.slice(id.lastIndexOf("-") + 1)}. **${id}** — ${R.trackAcs[t][i]}`).join("\n")).join("");
    return `${R.title(a.name)}\n\n${R.summary}\n${a.summary || R.summarySlot}\n\n${s ? R.storyS : R.stories}${trackAcs}\n\n${s ? R.endS : R.end}`;
  },

  // design.md: the core sections, then the active tracks' (trackDesignBlock, +tdd first), then the footer. No size: the 1.20
  // design. A SIZED feature (1.21 F5 — s | m | l; xs is a change, no design): Error Handling points at the IF…THEN criteria (never
  // asked twice), Complexity Tracking has no example row (the placeholder gate refused it), and a core section a track's own
  // sections supersede is left out (CORE_SUPERSEDED_BY). M / L: Reuse & Integration with one example row. S: the three weigh
  // sections merged into ONE "Decisions, reuse & risks" (designWeighChecks reads it), no Data Models / API Contracts / Security
  // Considerations / Testing Strategy / Risks. The track blocks are the full ones — the engine keeps a size's tiers and drops the
  // sections another active track covers (engine/scaffold.js).
  design(T, a) {
    const D = T.design;
    const extra = ["tdd", ...MARKER_TRACK_ORDER].filter((t) => a.tracks.includes(t)).map((t) => LAYOUTS.trackDesignBlock(T, t)).join("");
    if (!a.size) {
      return [D.title(a.name), D.overview, D.architecture, D.reuse, D.alternatives, D.dataModels, D.apiContracts, D.security, D.errorHandling, D.testing,
        D.risks, D.constitution, D.complexity + "\n" + D.complexityExample].join("\n\n") + "\n" + extra + "\n" + D.footer(a.label) + "\n";
    }
    const s = a.size === "s", keep = (key) => !coreSuperseded(a, key);
    const secs = [D.title(a.name), D.overview, D.architecture];
    if (s) secs.push(D.decisions);
    else {
      secs.push(D.reuseSized, D.alternatives, D.dataModels);
      if (keep("apiContracts")) secs.push(D.apiContracts);
      if (keep("securityConsiderations")) secs.push(D.security);
    }
    if (keep("errorHandling")) secs.push(D.errorHandlingSized);
    if (!s && keep("testingStrategy")) secs.push(D.testing);
    if (!s) secs.push(D.risks);
    secs.push(D.constitution, D.complexity);
    return secs.join("\n\n") + "\n" + extra + "\n" + D.footerSized(a.label, a.size) + "\n";
  },

  // tasks.md, organized by user story: Setup, Foundational, US-1 (its core task and a parallel one), the active tracks' task blocks
  // (trackTasks, numbered on), US-2, Polish. Size S (1.21 F5): one core task (US-1's two criteria), then the track blocks (the
  // engine keeps, per track, the tasks that implement a criterion — engine/scaffold.js trimTrackTasks); no setup / foundational /
  // US-2 / polish phases. +tdd: each template test made green by one task (_Makes green:_, templateTests of the tracks and size);
  // +saas: the latency metric on the first task that carries it; +ai: the golden baseline on the core task.
  tasks(T, a) {
    const K = T.tasks, s = a.size === "s";
    const green = a.tracks.includes("tdd") ? templateTests(a.tracks, s ? "s" : undefined) : null;
    const evals = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
    const metrics = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
    const verify = `\n  - _Verify: ${K.verify}_`;
    let n = 0;
    // one task line (numbered in order), its _Requirements:_ and — makesGreen — the _Makes green:_ of those criteria
    const task = (tags, text, acs, makesGreen) => `- [ ] ${++n}. ${tags} ${text}` + (acs ? `\n  - _Requirements: ${acs.join(", ")}_` : "") +
      (makesGreen ? greenLine(green, ...acs) : "");
    const trackBlocks = () => {
      let out = "";
      for (const t of MARKER_TRACK_ORDER) {
        if (!a.tracks.includes(t)) continue;
        const block = LAYOUTS.trackTasks(T, { track: t, start: n + 1, green });
        out += block;
        n += (block.match(/^- \[ \] \d+\./gm) || []).length;
      }
      return out;
    };
    if (s) {
      const story = `${K.story1}\n${task("[US1]", K.coreTask, ["US-1.AC-1", "US-1.AC-2"], true)}${metrics}${evals}${verify}\n**Checkpoint:** ${K.checkpoint1}\n`;
      return `${K.title(a.name)}\n\n${K.introS(a.label)}\n\n${K.constraintsS}\n\n${story}${trackBlocks()}`;
    }
    let phases = `${K.setup}\n${task("[shared][P]", K.setupTask)}\n\n${K.foundational}\n${task("[shared]", K.foundationalTask, ["US-1.AC-1"])}${metrics}\n\n` +
      `${K.story1}\n${task("[US1]", K.coreTask, ["US-1.AC-1", "US-1.AC-2", "US-1.AC-3"], true)}${evals}${verify}\n` +
      `${task("[US1][P]", K.parallelTask, ["US-1.AC-4"], true)}\n**Checkpoint:** ${K.checkpoint1}\n`;
    phases += trackBlocks();
    phases += `\n${K.story2}\n${task("[US2]", K.story2Task, ["US-2.AC-1"], true)}\n**Checkpoint:** ${K.checkpoint2}\n\n${K.polish}\n${task("[shared][P]", K.polishTask)}\n`;
    return `${K.title(a.name)}\n\n${K.intro(a.label)}\n\n${K.constraints}\n\n${phases}`;
  },

  // test-plan.md: the traceability matrix's rows are templateTestRows' (i18n/common.js — tracks: which template ACs get a planned
  // test; acs: the real AC IDs instead, one generic row each; size: S plans its two core criteria), worded with text.testPlan.rows.
  testPlan(T, name, tracks, acs, size) {
    const P = T.testPlan;
    const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`, P.rows, acs, size);
    return `${P.title(name)}\n\n${P.head}\n${rows}\n\n${P.tail}`;
  },

  // checklist.md: the core items, +tdd's, each active marker track's three (the first counts its design sections — a sized
  // feature's own count, a.sectionCounts, else its whole design block; with +obs on a sized feature, +saas's third item leaves
  // the telemetry to +obs: one line, not two), then the closing two.
  checklist(T, a) {
    const K = T.checklist;
    const count = (t) => (a.sectionCounts && a.sectionCounts[t] != null ? a.sectionCounts[t] : T.designBlocks[t].length);
    const items = [...K.core];
    if (a.tracks.includes("tdd")) items.push(...K.tdd);
    for (const t of MARKER_TRACK_ORDER) {
      if (!a.tracks.includes(t)) continue;
      const [sections, second, third] = K[t];
      items.push(sections(count(t)), second, t === "saas" && a.size && a.tracks.includes("obs") ? K.saasLoadOnly : third);
    }
    items.push(...K.done);
    return K.title(a.name, a.label) + "\n\n" + items.map((i) => "- [ ] " + i).join("\n") + "\n";
  },

  // One track's design sections (design() appends the active tracks'; spec_add_track writes one into an existing design.md):
  // "## <marker> <heading>", the TODO line, the guidance. +tdd's Testability Notes: no marker, no TODO (notes, never a gate).
  // Any other name (core, a track pack — packs.js renders those): "".
  trackDesignBlock(T, track) {
    const secs = own(T.designBlocks, track);
    if (!secs) return "";
    const tdd = track === "tdd";
    return "\n" + secs.map(([heading, guidance]) => `## ${tdd ? "" : MARKER_TAG[track] + " "}${heading}\n${tdd ? "" : T.designTodo + "\n"}${guidance}\n`).join("\n");
  },

  // A track's template task block (TRACK_TASK_PLAN). Shared by tasks() and spec_add_track, so a feature escalated later gets
  // the very same tasks. a = { track, start, green? } — green (templateTests) only on a greenfield +tdd scaffold.
  trackTasks(T, a) {
    const plan = own(TRACK_TASK_PLAN, a.track), text = own(T.trackTasks, a.track);
    if (!plan || !text) return "";
    let n = a.start - 1;
    return `\n## ${text.heading}\n` + plan.map((t, i) => {
      const ids = t.ac.map((x) => "US-1.AC-" + x);
      return `- [ ] ${++n}. [US1] ${text.tasks[i]}\n  - _Requirements: ${ids.join(", ")}_` + (t.before ? "\n  - " + t.before : "") +
        (t.green ? greenLine(a.green, ...ids) : "") + (t.after ? "\n  - " + t.after : "") + "\n";
    }).join("");
  },
};

// What the approval guard tells the user an agent wants to do (msg.approvalGuard.action — the hook's ask / deny lines and
// spec_approve's elicitation quote it): the case of `a` → one sentence of X (text.approvalActions). kind "remove" (a feature's
// removal); "unreadable" (1.23 review 5 — a shell command the guard can't read: too long (a.length characters) or in a form it
// can't follow; 1.24 review 6 — a tool call received only in part; 1.25.1 review 7 — a script fed to a shell out of sight, an
// unknown program on .specs/ files, the hook's own failure, a projectDir it can't read); "guard-down" (lowering this guard, or
// weakening what it stands for — a.setting: the spec_init / `init` setting, a shell write of roadmap.json, a hand edit with the
// Write / Edit tool — a.source "edit", the harness-observed run log, a gated track turned off, a .specs/ link); else an approval
// (or a revocation) of a phase, of every phase through one, as a role, in another's name, forced.
function approvalAction(X, a) {
  const f = a.feature || "?";
  if (a.kind === "remove") return X.remove(f);
  if (a.kind === "unreadable") {
    if (a.why === "partial") return X.partial;
    if (a.why === "fed") return X.fed;
    if (a.why === "specs-arg") return X.specsArg;
    if (a.why === "error") return X.error;
    if (a.why === "project") return X.project;
    return a.why === "too-long" ? X.tooLong(a.length) : X.unreadable;
  }
  if (a.kind === "guard-down") {
    if (a.setting === "roadmap" && a.source === "edit") return X.roadmapEdit;
    if (a.setting === "state") return a.source === "edit" ? X.stateEdit(f) : X.stateShell(f);
    if (a.setting === "observed") return a.feature ? X.observedFeature(a.feature) : X.observedProject;
    if (a.setting === "track") return X.trackOff((a.tracks || []).map((t) => "+" + t).join(", "), f);
    if (a.setting === "evidence") return X.evidence;
    if (a.setting === "stopCheck") return X.stopCheck;
    if (a.setting === "guard") return a.from ? X.guardLower(a.from, a.to) : X.guardSet(a.to);
    if (a.setting === "roles") {
      if (!a.to || !Object.keys(a.to).length) return X.rolesClear;
      return Array.isArray(a.removed) ? X.rolesDrop(a.removed.join(", ")) : X.rolesReplace;
    }
    if (a.setting === "check") return a.to == null ? X.checkRemove(a.name) : X.checkChange(a.name);
    if (a.setting === "roadmap") return X.roadmapShell;
    if (a.setting === "specs") return a.source === "edit" ? X.specsEdit : X.specsShell;
    if (a.setting === "link") return X.link;
    return X.lower(a.from, a.to);
  }
  const who = (a.role ? X.asRole(a.role) : "") + (a.by ? X.onBehalf(a.by) : "");
  if (a.revoke) return X.revoke(a.phase || "?", f) + who;
  return (a.through ? X.approveThrough(f, a.through) : X.approve(a.phase || "?", f)) + who + (a.force ? X.forced : "");
}

// pt-BR (1.14 D1) — every table's pt-BR twin, derived lazily from pt (i18n/pt-br.js, loaded by the first read of one).
const defineDerivedLocale = (table, raw, patch) => Object.defineProperty(table, "pt-BR", { enumerable: true, configurable: true,
  get() { ptbr().defineDerivedLocale(table, raw, patch); return table["pt-BR"]; } });
defineDerivedLocale(BUILD);
defineDerivedLocale(STEERING);
defineDerivedLocale(EVALS_README);
defineDerivedLocale(BRIEF);
defineDerivedLocale(MSG, { stopGate: { claims: true, triggers: true, negators: true, admissions: true, fixed: true, zeroes: true, passNow: true } }, {
  stopGate: { claims: (v) => [...v, ...ptbr().PTBR_STOP_EXTRA.claims], admissions: (v) => [...v, ...ptbr().PTBR_STOP_EXTRA.admissions],
    passNow: (v) => [...v, ...ptbr().PTBR_STOP_EXTRA.passNow] },
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
  DEV_SPEC, // 1.21 F3: `node "<clone>/cli/dev-spec.js"` — the runnable CLI line every message prints (i18n/common.js)
  DEV_SPEC_SCRIPT, // this clone's cli/dev-spec.js (forward slashes)
  cliPrefix, // (script?) → `node "<script>"`, quoted to paste into bash and PowerShell
  portableCli, // text for a committed file: the runnable line → `dev-spec`
  onLocaleLoad, // (fn) fn("i18n/<file>.js") after each language file loads on demand — the engine's corpus check (1.20 review)
  toPtBr: (text, masks) => ptbr().toPtBr(text, masks), // (text, masks?) European → Brazilian Portuguese (the pt-BR derivation, 1.14 D1)
  derivePtBr: (value, raw) => ptbr().derivePtBr(value, raw || null, null, value), // a pt table (roadmap-md.js's roadmap chrome) → its pt-BR twin
  // artifact builders
  classification: (a, lang) => L(lang).classification(a),
  requirements: (a, lang) => L(lang).requirements(a),
  trackDesignBlock: (track, lang) => L(lang).trackDesignBlock(track),
  design: (a, lang) => L(lang).design(a),
  tasks: (a, lang) => L(lang).tasks(a),
  testPlan: (name, lang, tracks, acs, size) => L(lang).testPlan(name, tracks, acs, size), // tracks: which template ACs get a planned test; acs: the real AC IDs instead (one generic row each); size (1.21 F5): S plans its two core criteria
  templateAcIds: (tracks, size) => Object.keys(templateTests(tracks, size)), // the template AC IDs a test plan scaffolded for these tracks (and size) covers
  change: (a, lang) => L(lang).change(a), // 1.21 F5: a change's one file (kind "change", size xs)
  FEATURE_SIZES, // 1.21 F5: xs · s · m · l (i18n/common.js)
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
  bugTasks: (name, lang) => L(lang).bugTasks(name), // one form for every size: the red regression test + the fix (no reproduce / root-cause tasks — their gates hold them)
  renderBrief,
  renderRetro, // (retroText, phaseNames, metrics, fmt) → retro.md — the layout every language's metrics.retro renders through
};

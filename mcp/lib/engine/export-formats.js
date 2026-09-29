"use strict";

/**
 * dev-spec-driven engine — Gherkin and tracker CSV exports.
 * spec_export {format: gherkin | jira | linear}: EARS criteria as Gherkin scenarios, tasks as tracker CSV rows.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
const { B, E } = require("./ears.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, acOneLine, activeDesign, activeTasks, BOM_CHAR, buildTraceMatrix, cleanTaskText, csvRecord, detectPhase,
  detectTracks, dirKey, extractAcIds, featureLang, headingIndex, markerTracks, mdPlainText, oneLiner, placeholderReport,
  RE_LIST_ITEM, readContained, requirementIndex, sectionText, SIZE_POINTS, specTitle, SPIKE_FILE, spikeInfo,
  stateFromFile, statePath, storyContext, stripEnd, stripEnds, stripHtmlComments, SUMMARY_SYN, supersededByIndex,
  taskBlocks, taskProse, taskSize, titledSlug, trackAcIds, trackLabel, trackMarker, withoutTaskMarkers, wsOrUnitIn;
function __link(E) { ({ acIndex, acOneLine, activeDesign, activeTasks, BOM_CHAR, buildTraceMatrix, cleanTaskText,
  csvRecord, detectPhase, detectTracks, dirKey, extractAcIds, featureLang, headingIndex, markerTracks, mdPlainText,
  oneLiner, placeholderReport, RE_LIST_ITEM, readContained, requirementIndex, sectionText, SIZE_POINTS, specTitle,
  SPIKE_FILE, spikeInfo, stateFromFile, statePath, storyContext, stripEnd, stripEnds, stripHtmlComments, SUMMARY_SYN,
  supersededByIndex, taskBlocks, taskProse, taskSize, titledSlug, trackAcIds, trackLabel, trackMarker,
  withoutTaskMarkers, wsOrUnitIn } = E); }

// ---------------------------------------------------------------------------
// 1.16 E1 — Gherkin export: spec_export {format: "gherkin"} · `dev-spec export [f] --gherkin` → .specs/exports/<slug>.feature
// ---------------------------------------------------------------------------
//
// One `Feature:` per feature (its title; the summary as the description; the active tracks as tags — a track's marker, else
// its name: @SaaS @AI @SEC @PRIVACY @tdd …), one `Scenario:` per CURRENT acceptance criterion in document order, tagged
// with its AC ID, the T-IDs the test plan plans for it (the matrix's reading) and the marker of the track that defines it.
// Left out, each with a comment saying so: a template criterion (not written yet) and one a SHIPPED feature superseded
// (1.15's rule — it no longer describes the system); one a draft plans to supersede is kept, with a comment. The steps
// ARE the EARS clauses, never invented behaviour: WHILE / WHERE / IF (ENQUANTO / ONDE / SE · MIENTRAS / DONDE / SI) →
// Given, WHEN (QUANDO / CUANDO) → When, the response (its subject + SHALL / DEVE / DEBE …) → Then, verbatim; text before the
// response with no EARS keyword (a ubiquitous criterion's context) → Given. A criterion whose clauses can't be split
// cleanly (no modal, text before the first keyword, a condition after THEN, an empty clause, no subject before the modal)
// becomes ONE Then step with its whole text (listed in `unsplit`) — never a lost word. Quoted and code spans are opaque to
// the split (a comma or a keyword inside "…" / `…` never cuts a clause). A PT / ES feature (pt-BR too) is written in
// Gherkin's own dialect: `# language: pt` / `# language: es` + its keywords (GHERKIN_DIALECT — Gherkin's tokens, not
// dev-spec prose). A spike (no acceptance criteria) has no Gherkin: named, it is refused; the project export skips it.
// `keywords`: EVERY keyword of the dialect, as Gherkin's gherkin-languages.json lists them for en / pt / es (compared with
// cucumber/gherkin main — 1.16 E review m6; step keywords without their trailing space, the "*" step aside) — the words
// the description guard checks (a summary line starting with one of them gets the summary label in front); the other
// fields are the ones the export writes.
const GHERKIN_DIALECT = {
  en: { feature: "Feature", scenario: "Scenario", given: "Given", when: "When", then: "Then", and: "And",
    keywords: { feature: ["Feature", "Business Need", "Ability"], background: ["Background"], rule: ["Rule"], scenario: ["Example", "Scenario"],
      scenarioOutline: ["Scenario Outline", "Scenario Template"], examples: ["Examples", "Scenarios"],
      given: ["Given"], when: ["When"], then: ["Then"], and: ["And"], but: ["But"] } },
  pt: { feature: "Funcionalidade", scenario: "Cenário", given: "Dado", when: "Quando", then: "Então", and: "E",
    keywords: { feature: ["Funcionalidade", "Característica", "Caracteristica"], background: ["Contexto", "Cenário de Fundo", "Cenario de Fundo", "Fundo"], rule: ["Regra"],
      scenario: ["Exemplo", "Cenário", "Cenario"], scenarioOutline: ["Esquema do Cenário", "Esquema do Cenario", "Delineação do Cenário", "Delineacao do Cenario"],
      examples: ["Exemplos", "Cenários", "Cenarios"], given: ["Dado", "Dada", "Dados", "Dadas"], when: ["Quando"], then: ["Então", "Entao"], and: ["E"], but: ["Mas"] } },
  es: { feature: "Característica", scenario: "Escenario", given: "Dado", when: "Cuando", then: "Entonces", and: "Y",
    keywords: { feature: ["Característica", "Necesidad del negocio", "Requisito"], background: ["Antecedentes"], rule: ["Regla", "Regla de negocio"],
      scenario: ["Ejemplo", "Escenario"], scenarioOutline: ["Esquema del escenario"], examples: ["Ejemplos"],
      given: ["Dado", "Dada", "Dados", "Dadas"], when: ["Cuando"], then: ["Entonces"], and: ["Y", "E"], but: ["Pero"] } },
};
const GHERKIN_BLOCK_KINDS = ["feature", "background", "rule", "scenario", "scenarioOutline", "examples"]; // "<keyword>:" lines
const GHERKIN_STEP_KINDS = ["given", "when", "then", "and", "but"]; // "<keyword> " lines
// Would this description line read as a Gherkin token in the dialect `D` (or English)? A tag, a comment, a table row, a doc
// string, a "*" step, a block keyword + ':' or a step keyword + a space (any case — the guard errs on the safe side).
function ghRiskyLine(s, D) {
  if (/^[@#|*]|^"""|^```/.test(s)) return true;
  const low = s.toLowerCase();
  const ks = (kinds) => [D, GHERKIN_DIALECT.en].flatMap((d) => kinds.flatMap((k) => d.keywords[k]));
  return ks(GHERKIN_BLOCK_KINDS).some((b) => low.startsWith(b.toLowerCase()) && /^\s*:/.test(s.slice(b.length))) ||
    ks(GHERKIN_STEP_KINDS).some((w) => low.startsWith(w.toLowerCase()) && /^\s/.test(s.slice(w.length)));
}
// The EARS condition keywords (upper-case spelling) → the step they become; THEN / ENTÃO / ENTONCES only mark the response.
const GHERKIN_COND = { WHEN: "when", QUANDO: "when", CUANDO: "when", WHILE: "given", ENQUANTO: "given", MIENTRAS: "given",
  IF: "given", SE: "given", SI: "given", WHERE: "given", ONDE: "given", DONDE: "given" };
const GHERKIN_THEN = new Set(["THEN", "ENTÃO", "ENTAO", "ENTONCES"]);
const RE_GH_KEYWORD = new RegExp(B + "(when|while|if|where|then|quando|enquanto|se|onde|então|entao|cuando|mientras|si|donde|entonces)" + E, "giu");
const RE_GH_MODAL = new RegExp(B + "(shall|dever[áa]|deve|devem|dever[ãa]o|deber[áa]|debe|deben|deber[áa]n)" + E, "iu");
const RE_GH_DET = new RegExp(B + "(the|o|a|os|as|el|la|los|las)\\s", "giu");
// Quoted ("…" “…” «…») and code (`…`) spans masked out (same length) — what the split reads; the text itself is kept.
function ghMask(s) {
  const close = { '"': '"', "“": "”", "«": "»", "`": "`" };
  let out = "";
  for (let i = 0; i < s.length;) {
    const c = close[s[i]];
    const j = c ? s.indexOf(c, i + 1) : -1;
    if (j > i) { out += s[i] + "\u0001".repeat(j - i - 1) + c; i = j + 1; continue; }
    out += s[i++];
  }
  return out;
}
// Markdown emphasis MARKUP out of a criterion (1.16 E review m5): a run of * or _ counts only when it pairs with a run of the
// same character — an opener (followed by a non-space, not preceded by a letter or digit) before a closer (preceded by a
// non-space, not followed by a letter or digit), CommonMark's flanking rules otherwise — and only its paired characters go
// (** with ** first, then * with *; a pair never crosses another). Code spans (`…`, any backtick run up to the next run of
// the same length) are opaque. Everything else is kept as written: `2**n`, `a_b_c`, `x * y`, `2*3*4`, an unpaired `**`.
// One pass over the runs, each opener popped at most once — linear.
function ghStripEmphasis(s) {
  const n = s.length;
  // code spans: each backtick run → the next run of the same length (computed right to left — linear)
  const ticks = [];
  for (let i = 0; i < n;) { if (s[i] !== "`") { i++; continue; } let j = i; while (s[j] === "`") j++; ticks.push({ at: i, end: j, len: j - i }); i = j; }
  const codeEnd = new Map(); // a span's opening index → the index after its closing run
  const nextSame = new Map();
  const partner = new Array(ticks.length).fill(-1);
  for (let k = ticks.length - 1; k >= 0; k--) { const p = nextSame.get(ticks[k].len); if (p != null) partner[k] = p; nextSame.set(ticks[k].len, k); }
  for (let k = 0; k < ticks.length;) { if (partner[k] >= 0) { codeEnd.set(ticks[k].at, ticks[partner[k]].end); const p = partner[k]; while (k < ticks.length && ticks[k].at < ticks[p].end) k++; } else k++; }
  const ws = (c) => c === undefined || /\s/u.test(c);
  const punct = (c) => c !== undefined && /[\p{P}\p{S}]/u.test(c);
  const word = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  const drop = new Uint8Array(n);
  const stacks = { "*": [], _: [] };
  for (let i = 0; i < n;) {
    if (codeEnd.has(i)) { i = codeEnd.get(i); continue; }
    const c = s[i];
    // a backslash escape (`\*`, `\_`) is a literal character, never a delimiter (1.17 verification N3 — mdPlainText drops the
    // backslash afterwards; a paired `\*x\*` was markup, and left `\x\`)
    if (c === "\\" && i + 1 < n && s[i + 1] !== "`" && /[!-/:-@[-`{-~]/.test(s[i + 1])) { i += 2; continue; }
    if (c !== "*" && c !== "_") { i++; continue; }
    let j = i;
    while (s[j] === c) j++;
    const before = s[i - 1], after = s[j];
    const left = !ws(after) && (!punct(after) || ws(before) || punct(before));
    const right = !ws(before) && (!punct(before) || ws(after) || punct(after));
    const run = { at: i, lo: i, hi: j, len: j - i };
    if (right && !word(after)) { // a closer: pair with the nearest opener of its character
      const st = stacks[c];
      while (run.len > 0 && st.length) {
        const o = st[st.length - 1];
        const use = o.len >= 2 && run.len >= 2 ? 2 : 1;
        for (let k = o.hi - use; k < o.hi; k++) drop[k] = 1;
        for (let k = run.lo; k < run.lo + use; k++) drop[k] = 1;
        o.hi -= use; o.len -= use; run.lo += use; run.len -= use;
        if (!o.len) st.pop();
        const other = stacks[c === "*" ? "_" : "*"]; // no pair crosses this one
        while (other.length && other[other.length - 1].at > o.at) other.pop();
      }
    }
    if (run.len > 0 && left && !word(before)) stacks[c].push(run);
    i = j;
  }
  let out = "";
  for (let i = 0; i < n; i++) if (!drop[i]) out += s[i];
  return out;
}
// The EARS keywords a feature's language reads: English ones in any feature, plus its own language's (an English criterion's
// "SI units" or "SE region" is no condition).
const GHERKIN_LANG_KEYWORDS = { pt: ["QUANDO", "ENQUANTO", "SE", "ONDE", "ENTÃO", "ENTAO"], es: ["CUANDO", "MIENTRAS", "SI", "DONDE", "ENTONCES"] };
// One criterion's text (acOneLine, whole) → { steps: [{ kind: "given" | "when" | "then", text }], split }. lang (optional):
// the feature's language — only English keywords and its own are read (every language's without it). Paired emphasis
// markup is dropped first (ghStripEmphasis); every other character reaches a step — the EARS keywords the Gherkin ones
// replace and the separators (spaces, commas) between clauses aside; characters before the first keyword ("(", "*") lead
// its step.
function earsSteps(raw, lang) {
  const text = ghStripEmphasis(String(raw == null ? "" : raw).replace(/\s+/g, " ").trim()).replace(/\s+/g, " ").trim();
  const whole = { steps: [{ kind: "then", text }], split: false };
  if (!text) return whole;
  const m = ghMask(text);
  const mod = m.match(RE_GH_MODAL);
  if (!mod) return whole;
  const modalAt = mod.index;
  const allowed = lang ? new Set(["WHEN", "WHILE", "IF", "WHERE", "THEN"].concat(GHERKIN_LANG_KEYWORDS[i18n.baseLang(lang)] || [])) : null;
  // The EARS keywords before the modal: any case at the very start or right after a comma (se / si only in capitals there —
  // ordinary PT / ES words), anywhere in capitals.
  const kws = [];
  const lead0 = m.search(/[^\s([{*_~]/);
  RE_GH_KEYWORD.lastIndex = 0;
  for (let k; (k = RE_GH_KEYWORD.exec(m)) && k.index < modalAt;) {
    const w = k[1];
    const up = w.toUpperCase();
    if (allowed && !allowed.has(up)) continue;
    const atStart = k.index === lead0;
    const afterComma = /,\s*$/.test(m.slice(Math.max(0, k.index - 64), k.index));
    if (w === up || atStart || (afterComma && !/^(se|si)$/i.test(w))) kws.push({ at: k.index, end: k.index + w.length, word: up, then: GHERKIN_THEN.has(up) });
  }
  const thenKw = kws.filter((k) => k.then).pop();
  const conds = kws.filter((k) => !k.then);
  if (thenKw && conds.some((c) => c.at > thenKw.at)) return whole; // a condition after THEN: no clean reading
  const from = conds.length ? conds[conds.length - 1].end : 0;
  let subj = -1;
  if (thenKw) subj = thenKw.end;
  else {
    const region = m.slice(from, modalAt);
    const comma = region.lastIndexOf(",");
    if (comma >= 0) subj = from + comma + 1;
    else if (!conds.length) subj = 0; // a ubiquitous criterion: its context is a lead set off by a comma, else there is none
    else {
      // The subject: the upper-case run right before an upper-case modal ("THE SYSTEM SHALL") — its first determiner —,
      // else the last determiner before the modal ("the system shall", "o sistema deve"); neither → no clean split.
      let runStart = modalAt;
      if (mod[1] === mod[1].toUpperCase()) {
        const trimmed = region.trimEnd(); // /\s+$/ rescanned a blank run from each of its units (1.17 H)
        const words = trimmed.split(" ");
        let end = trimmed.length;
        for (let w = words.length - 1; w >= 0 && words[w] && words[w] === words[w].toUpperCase() && /\p{Lu}/u.test(words[w]); w--) {
          runStart = from + end - words[w].length;
          end -= words[w].length + 1;
        }
      }
      const dets = [...region.matchAll(RE_GH_DET)].map((d) => from + d.index);
      const inRun = dets.find((d) => d >= runStart);
      subj = inRun != null ? inRun : dets.length ? dets[dets.length - 1] : -1;
    }
  }
  if (subj < 0) return whole;
  const steps = [];
  // Characters before the first keyword — only brackets / emphasis leftovers may stand there — lead that keyword's step:
  // "(WHEN the user pays) …" → When "(the user pays)" (they were dropped).
  let lead = "";
  const withLead = (t) => (!lead ? t : /\s$/.test(lead) ? lead.trim() + " " + t : lead.trim() + t);
  let resp = text.slice(subj).replace(/^[\s,]+/, "").trim();
  if (!conds.length && !thenKw) {
    const ctx = stripEnd(text.slice(0, subj), wsOrUnitIn(",")).trim(); // /[\s,]+$/
    if (ctx) steps.push({ kind: "given", text: ctx });
  } else {
    lead = text.slice(0, conds.length ? conds[0].at : thenKw.at);
    if (ghMask(lead).replace(/[\s([{*_~]/g, "")) return whole; // text before the first keyword
    for (let i = 0; i < conds.length; i++) {
      const stop = i + 1 < conds.length ? conds[i + 1].at : thenKw ? thenKw.at : subj;
      const t = stripEnds(text.slice(conds[i].end, stop), wsOrUnitIn(",")); // /^[\s,]+|[\s,]+$/g
      if (!t) return whole;
      steps.push({ kind: GHERKIN_COND[conds[i].word] || "given", text: i ? t : withLead(t) });
    }
    if (!conds.length && resp) resp = withLead(resp); // "(THEN THE SYSTEM SHALL …"
  }
  // The response must start with its subject (1.16 E review m4): "WHEN a payment fails, the cart, including discounts,
  // SHALL be kept" has none after its last comma — cut there it read When "a payment fails, the cart, including
  // discounts" + Then "SHALL be kept" — so the criterion stays one Then with its whole text.
  const rmask = ghMask(resp);
  const modalIn = rmask.search(RE_GH_MODAL);
  if (!resp || modalIn < 0 || !/[\p{L}\p{N}]/u.test(resp.slice(0, modalIn))) return whole;
  const order = { given: 0, when: 1 }; // Given before When (Gherkin's order); each kind keeps the criterion's order
  steps.sort((a, b) => order[a.kind] - order[b.kind]);
  steps.push({ kind: "then", text: resp });
  return { steps, split: true };
}
// A Gherkin comment / free-text line: one line, whatever the spec wrote.
const ghLine = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
// A track as a tag: its marker without the brackets ([SaaS] → @SaaS), else its name (@tdd).
const ghTag = (tr) => "@" + String(trackMarker(tr) || tr).replace(/^\[|\]$/g, "");
// The Feature's tags: each active optional track (+ @bugfix for a bugfix).
function gherkinFeatureTags(tracks, kind) {
  const tags = tracks.filter((t) => t !== "core").map((t) => ghTag(t));
  if (kind === "bugfix") tags.push("@bugfix");
  return tags;
}
// One feature ({ slug, dir }) → { content, scenarios, skipped: { template, superseded }, unsplit, lang } — a spike →
// { error, spike: true }. opts.supBy: a supersededByIndex() to reuse (the project export).
function gherkinFeature(projectDir, f, opts = {}) {
  const { slug, dir } = f;
  const lang = featureLang(projectDir, slug);
  const G = i18n.msg(lang).gherkin;
  const X = i18n.msg(lang).stakeholderExport;
  const state = stateFromFile(projectDir, statePath(dir));
  if (state.kind === "spike") return { error: G.spike(slug), spike: true, lang };
  const D = GHERKIN_DIALECT[i18n.baseLang(lang)] || GHERKIN_DIALECT.en;
  const tracks = detectTracks(dir);
  const reqRaw = readContained(projectDir, path.join(dir, "requirements.md")) || "";
  const reqs = activeDesign(reqRaw, tracks);
  const idx = requirementIndex(reqs);
  const mx = buildTraceMatrix(projectDir, f, { supBy: opts.supBy });
  const byTrack = markerTracks().filter((tr) => tracks.includes(tr)).map((tr) => ({ tag: ghTag(tr), acs: trackAcIds(reqs, tr) }));
  const lines = [`# language: ${i18n.baseLang(lang)}`, `# ${G.autogen}`, `# ${G.source(".specs/" + slug + "/requirements.md")}`];
  const ftags = gherkinFeatureTags(tracks, state.kind);
  if (ftags.length) lines.push(ftags.join(" "));
  // Gherkin is plain text: markdown escapes and entities are written as the characters a reader sees (mdPlainText — 1.17
  // verification N3: `NFR\-2`, `US-3\.AC-1`, `&lt;!--` from an import reached the steps as written).
  lines.push(`${D.feature}: ${ghLine(mdPlainText(titledSlug(specTitle(reqRaw, slug), slug)))}`);
  const summary = sectionText(reqs, SUMMARY_SYN) || (state.kind === "bugfix" ? sectionText(readContained(projectDir, path.join(dir, "bug.md")) || "", SUMMARY_SYN) : null);
  if (summary) {
    // A description line that reads like a Gherkin token (a tag, a comment, a table row, a doc string, any keyword of the
    // dialect or English — ghRiskyLine) would change the file's structure: it gets the summary label in front — the words stay.
    const s = ghLine(mdPlainText(summary));
    lines.push("  " + (ghRiskyLine(s, D) ? G.summaryLabel + ": " : "") + s);
  }
  const skipped = { template: [], superseded: [] };
  const unsplit = [];
  let scenarios = 0;
  let story = null;
  for (const r of mx.rows) {
    if (r.kind !== "ac") continue;
    const n = r.id.match(/^US-(\d+)/)[1];
    if (n !== story) {
      story = n;
      const ctx = storyContext(reqs, n);
      lines.push("", `  # ${ghLine(mdPlainText(ctx ? ctx[0] : "US-" + n))}`);
    }
    if (r.template) { skipped.template.push(r.id); lines.push("", `  # ${G.template(r.id)}`); continue; }
    if (r.supersededBy.length && !r.supersedePending) { skipped.superseded.push(r.id); lines.push("", `  # ${G.superseded(r.id, r.supersededBy.join(", "))}`); continue; }
    const e = idx.get(r.id);
    const full = acOneLine(e ? e.text : r.text, r.id, Infinity);
    const sp = earsSteps(full, lang);
    if (!sp.split) unsplit.push(r.id);
    const steps = sp.steps.map((st) => ({ kind: st.kind, text: mdPlainText(st.text) })); // split first: an escape never cuts a clause
    lines.push("");
    if (r.supersedePending) lines.push(`  # ${X.toBeSupersededBy(r.supersededBy.join(", "))}`);
    if (!sp.split) lines.push(`  # ${G.unsplit}`);
    const tags = ["@" + r.id, ...r.tests.map((t) => "@" + t.id), ...byTrack.filter((t) => t.acs.has(r.id)).map((t) => t.tag)];
    lines.push("  " + [...new Set(tags)].join(" "));
    lines.push(`  ${D.scenario}: ${r.id} — ${ghLine(oneLiner(steps[steps.length - 1].text, 100) || mdPlainText(full))}`);
    let prev = null;
    for (const st of steps) {
      lines.push(`    ${st.kind === prev ? D.and : D[st.kind]} ${st.text}`);
      prev = st.kind;
    }
    scenarios++;
  }
  if (!scenarios) lines.push("", `  # ${G.noScenarios}`);
  return { content: lines.join("\n") + "\n", scenarios, skipped, unsplit, lang };
}
// .specs/exports/<slug>.feature — the same name in the feature and the project export (a feature slugged 'project':
// project.feature.feature, as the other formats keep a feature off the project's file).
const gherkinBase = (slug) => (slug === "project" ? "project.feature" : slug) + ".feature";

// ---------------------------------------------------------------------------
// 1.16 E2 — tracker CSV: spec_export {format: "jira" | "linear"} · `dev-spec export [f] --tracker jira|linear` →
// .specs/exports/<slug>.<tracker>.csv (the project: project.<tracker>.csv — every active feature). Nothing is sent anywhere:
// the file is for the tool's own CSV importer. One record per feature (the parent), per user story (a child of its
// feature) and per task (a child of its story through its [USn] tag, else of the feature) — parents before their children.
// Column names are the importers' documented ones:
//   jira    Work item ID · Work type · Summary · Description · Status · Parent · Labels (repeated, one label per column)
//           — Jira Cloud "Import data from a CSV file": Summary is the only required field; the hierarchy is "Work item
//           ID" + "Work type" + "Parent" (the parent's Work item ID, parents first); several labels = several Labels columns.
//           Work types Epic (the feature) · Story · Sub-task (a story's task) · Task (a feature-level task); Status To Do ·
//           In Progress · Done (existing workflow statuses).
//   linear  ID · Title · Description · Status · Estimate · Labels · Parent issue — Linear's CSV (its export / CLI importer:
//           Title, Description, Status, Estimate, Labels comma-separated; ID and Parent issue carry the hierarchy as local
//           keys <slug>, <slug>/US-n, <slug>/#n). Status Todo · In Progress · Done; Estimate = a task's _Size:_ points
//           (1/2/3/5/8 — Linear's scale), empty when unsized.
// Labels: the feature slug, its active optional tracks, its kind when not a plain feature (bugfix / spike), and the AC IDs
// (a story's own criteria, a task's cited ones). The F5 CSV rules: csvCell (RFC 4180 quoting, the formula guard), CRLF,
// a UTF-8 BOM; the AUTO-GENERATED marker is the LAST header cell (its column stays empty) — never a trailing record,
// which an importer would turn into a work item.
const TRACKERS = ["jira", "linear"];
const TRACKER_LABELS_MAX = 30; // labels per record (a story citing more ACs keeps the first ones)
const TRACKER_SUMMARY_MAX = 250; // Jira's Summary holds at most 255 characters
const TRACKER_STATUS = { jira: { open: "To Do", doing: "In Progress", done: "Done" }, linear: { open: "Todo", doing: "In Progress", done: "Done" } };
// One feature → its records { key, parent, type, summary, description, status, labels, estimate? } (parents first).
function trackerRecords(projectDir, f, lang, supBy) {
  const { slug, dir } = f;
  const T = i18n.msg(lang).trackerCsv;
  const X = i18n.msg(lang).stakeholderExport;
  const tracks = detectTracks(dir);
  const state = stateFromFile(projectDir, statePath(dir));
  const kind = state.kind === "bugfix" || state.kind === "spike" ? state.kind : "feature";
  const reqRaw = readContained(projectDir, path.join(dir, "requirements.md")) || "";
  const reqs = activeDesign(reqRaw, tracks);
  const blocks = taskBlocks(activeTasks(readContained(projectDir, path.join(dir, "tasks.md")) || "", tracks) || "");
  const base = [slug, ...tracks.filter((t) => t !== "core")].concat(kind === "feature" ? [] : [kind]);
  const cap = (list) => [...new Set(list)].slice(0, TRACKER_LABELS_MAX);
  const status = (done, total) => (total && done === total ? "done" : done ? "doing" : "open");
  const done = blocks.filter((b) => b.done).length;
  const phase = detectPhase(dir, tracks);
  const summary = sectionText(reqs, SUMMARY_SYN) || (kind === "bugfix" ? sectionText(readContained(projectDir, path.join(dir, "bug.md")) || "", SUMMARY_SYN) : null) ||
    (kind === "spike" ? spikeInfo(dir).question : null);
  const title = specTitle(reqRaw || (kind === "spike" ? readContained(projectDir, path.join(dir, SPIKE_FILE)) || "" : ""), slug);
  const feature = { key: slug, parent: null, type: "feature", summary: mdPlainText(titledSlug(title, slug)),
    description: [summary, T.featureLine(".specs/" + slug + "/", trackLabel(tracks), (i18n.msg(lang).phaseNames || {})[phase] || phase, done, blocks.length)].filter(Boolean).join("\n\n"),
    status: phase === "complete" ? "done" : status(done, blocks.length), labels: cap(base) };
  // The stories: heading order, then first-AC order (the export's); each with its intro and its criteria, whole.
  const marks = supBy || supersededByIndex(projectDir);
  const acs = [...acIndex(reqs).values()].sort((a, b) => a.line - b.line);
  const order = [];
  const lines = stripHtmlComments(reqs).split(/\r?\n/);
  for (const k of headingIndex(lines)) { const m = lines[k].match(/^#{1,6}\s+US-(\d+)(?!\d)/); if (m && !order.includes(m[1])) order.push(m[1]); }
  for (const a of acs) { const n = a.id.match(/^US-(\d+)/)[1]; if (!order.includes(n)) order.push(n); }
  const stories = [];
  for (const n of kind === "spike" ? [] : order) {
    const ctx = storyContext(reqs, n);
    const intro = [];
    for (const l of ctx ? ctx.slice(1) : []) { if (RE_LIST_ITEM.test(l) || /^\|/.test(l)) break; intro.push(l); }
    const own = acs.filter((a) => a.id.startsWith(`US-${n}.`));
    const acLines = own.map((a) => {
      const k = dirKey(dir) + "\n" + a.id;
      const by = marks.get(k);
      const note = !by ? "" : " — " + (marks.live && !marks.live.has(k) ? X.toBeSupersededBy(by.join(", ")) : X.supersededBy(((marks.liveBy && marks.liveBy.get(k)) || by).join(", ")));
      // the criterion as a reader sees it (mdPlainText — an import's `NFR\-2` / `&lt;!--` read as written; 1.17 verification N3)
      return `- ${a.id} — ${mdPlainText(acOneLine(a.text, a.id, Infinity))}${note}${placeholderReport(a.text).length ? ` (${X.template})` : ""}`;
    });
    const st = blocks.filter((b) => b.story && b.story.toUpperCase() === "US" + n);
    stories.push({ n, rec: { key: `${slug}/US-${n}`, parent: slug, type: "story", summary: ghLine(mdPlainText(ctx ? ctx[0] : `US-${n}`)),
      description: [intro.join("\n"), acLines.length ? T.acceptance + "\n" + acLines.join("\n") : ""].filter(Boolean).join("\n\n"),
      status: status(st.filter((b) => b.done).length, st.length), labels: cap(base.concat(own.map((a) => a.id))) } });
  }
  const storyKey = new Map(stories.map((s) => [s.n, s.rec.key]));
  // Each record's key is unique (1.16 E review m3): a task number used twice (doctor's duplicate-tasks) keeps it for its
  // first task, the next ones get an occurrence suffix — `<slug>/#3`, `<slug>/#3 (2)` — never two work items with one ID.
  const seen = new Map();
  const tasks = blocks.map((b) => {
    const n = b.story && /^US\d+$/i.test(b.story) ? b.story.replace(/\D/g, "") : null;
    const parent = n && storyKey.has(n) ? storyKey.get(n) : slug;
    const prose = taskProse(b);
    const size = taskSize(b);
    const occ = (seen.get(String(b.number)) || 0) + 1;
    seen.set(String(b.number), occ);
    return { key: `${slug}/#${b.number}${occ > 1 ? ` (${occ})` : ""}`, parent, type: parent === slug ? "task" : "subtask", summary: `#${b.number} ${ghLine(mdPlainText(withoutTaskMarkers(cleanTaskText(b.text)))) || ghLine(b.text)}`,
      description: prose.map((l) => l.trim()).filter(Boolean).join("\n") + "\n\n" + T.taskLine(".specs/" + slug + "/tasks.md", b.number),
      status: b.done ? "done" : "open", labels: cap(base.concat([...extractAcIds(prose.join("\n"))])), estimate: size ? SIZE_POINTS[size] : null };
  });
  // Each story's tasks right after it, then the feature-level ones — parents always before their children.
  const out = [feature];
  for (const s of stories) out.push(s.rec, ...tasks.filter((t) => t.parent === s.rec.key));
  out.push(...tasks.filter((t) => t.parent === slug));
  return out;
}
// records (every feature's, in order) → the CSV document text for `tracker` (a BOM first; the marker the last header cell).
function trackerCsv(records, tracker, lang) {
  const T = i18n.msg(lang).trackerCsv;
  const S = TRACKER_STATUS[tracker];
  const marker = "# " + T.autogen;
  const cut = (s) => oneLiner(s, TRACKER_SUMMARY_MAX) || "";
  let out = BOM_CHAR;
  if (tracker === "jira") {
    // Work item ID = the record's row number (unique whatever its key); a Parent names the FIRST record with that key.
    const ids = new Map();
    records.forEach((r, i) => { if (!ids.has(r.key)) ids.set(r.key, String(i + 1)); });
    const type = { feature: "Epic", story: "Story", subtask: "Sub-task", task: "Task" };
    const nLabels = Math.max(1, ...records.map((r) => r.labels.length));
    out += csvRecord(["Work item ID", "Work type", "Summary", "Description", "Status", "Parent", ...Array(nLabels).fill("Labels"), marker]);
    for (const [i, r] of records.entries()) {
      out += csvRecord([String(i + 1), type[r.type], cut(r.summary), r.description, S[r.status], r.parent ? ids.get(r.parent) || "" : "",
        ...Array.from({ length: nLabels }, (_, k) => r.labels[k] || ""), ""]);
    }
    return out;
  }
  out += csvRecord(["ID", "Title", "Description", "Status", "Estimate", "Labels", "Parent issue", marker]);
  for (const r of records) out += csvRecord([r.key, cut(r.summary), r.description, S[r.status], r.estimate == null ? "" : r.estimate, r.labels.join(", "), r.parent || "", ""]);
  return out;
}

module.exports = { GHERKIN_DIALECT, GHERKIN_BLOCK_KINDS, GHERKIN_STEP_KINDS, ghRiskyLine, GHERKIN_COND, GHERKIN_THEN,
  RE_GH_KEYWORD, RE_GH_MODAL, RE_GH_DET, ghMask, ghStripEmphasis, GHERKIN_LANG_KEYWORDS, earsSteps, ghLine, ghTag,
  gherkinFeatureTags, gherkinFeature, gherkinBase, TRACKERS, TRACKER_LABELS_MAX, TRACKER_SUMMARY_MAX, TRACKER_STATUS,
  trackerRecords, trackerCsv, __link };

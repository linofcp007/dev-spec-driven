"use strict";

/**
 * dev-spec-driven engine — EARS, traceability and the traceability matrix.
 * Criterion blocks (lines folded into logical criteria first) and the EARS linter (EN / PT / ES keywords); trace_check
 * (AC → tasks → tests → _Implements:_), its gaps and the deep warnings (EC / NFR / SC, T-IDs in test code); the
 * requirements traceability matrix (trace_check {matrix}, `trace --matrix | --csv`, its CSV and export section).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acOneLine, activeDesign, activeTasks, artifactState, atxHeading, BOM_CHAR, cleanTaskText, commentLines,
  decisionLog, DECISIONS_FILE, decisionsTrace, designSections, detectTracks, dirKey, duplicateTaskNumbers, evidenceRule,
  existingFeature, featureDirs, featureLang, fingerprintMatches, FOLD_CASE, gitEvidence, globFiles, GUARD_CODE_EXT,
  historyText, implementsPath, indentOf, inertOutsideCode, isApprovalRecord, isCodeFile, isImplementsGlob, isObj, isRecord, isTestFixture,
  isSlashUnit, isTestFile, isWsUnit, readFileHead, testNamed, italic, latestSnapshot, mdCell, mdPlainText, normWs, oneLiner, ownEvidence,
  packTracks, PHASE_FILE, phaseActive, placeholderReport, planIdText, readContained, readIfExists, readJson, realLines,
  requirementAcIds, requirementIndex, reservedSlug, resolveSupersedes, retiredDecisions, safeReaddir,
  SAMPLE_ADVERSARIAL, SAMPLE_GOLDEN, SCAN_READ_BYTES, specsRoot, stateFromFile, statePath, stripEnd, stripEnds,
  stripStart, supersedesMarkers, supersedesTrace, tableCells, taskBlocks, taskMarkers, taskMarkerValues, taskProse,
  tasksProseText, taskVerification, textFingerprint, timeOf, toPosix, trackAcIds, trackLabel, trackMarker, unitIn,
  useTemplateScopeOf, utcStamp, walkProject, withinRoot, criteriaText, tasksIdText, changeViews, isChangeDir;
function __link(E) { ({ acOneLine, activeDesign, activeTasks, artifactState, atxHeading, BOM_CHAR, cleanTaskText,
  commentLines, decisionLog, DECISIONS_FILE, decisionsTrace, designSections, detectTracks, dirKey,
  duplicateTaskNumbers, evidenceRule, existingFeature, featureDirs, featureLang, fingerprintMatches, FOLD_CASE,
  gitEvidence, globFiles, GUARD_CODE_EXT, historyText, implementsPath, indentOf, inertOutsideCode, isApprovalRecord,
  isCodeFile, isImplementsGlob, isObj, isRecord, isSlashUnit, isTestFile, isTestFixture, readFileHead, testNamed, isWsUnit, italic, latestSnapshot, mdCell, mdPlainText,
  normWs, oneLiner, ownEvidence, packTracks, PHASE_FILE, phaseActive, placeholderReport, planIdText, readContained,
  readIfExists, readJson, realLines, requirementAcIds, requirementIndex, reservedSlug, resolveSupersedes,
  retiredDecisions, safeReaddir, SAMPLE_ADVERSARIAL, SAMPLE_GOLDEN, SCAN_READ_BYTES, specsRoot, stateFromFile,
  statePath, stripEnd, stripEnds, stripStart, supersedesMarkers, supersedesTrace, tableCells, taskBlocks, taskMarkers,
  taskMarkerValues, taskProse, tasksProseText, taskVerification, textFingerprint, timeOf, toPosix, trackAcIds,
  trackLabel, trackMarker, unitIn, useTemplateScopeOf, utcStamp, walkProject, withinRoot, criteriaText, tasksIdText, changeViews,
  isChangeDir } = E); }

// ---------------------------------------------------------------------------
// EARS linting
// ---------------------------------------------------------------------------

const VAGUE_WORDS = [
  // EN
  "fast", "quick", "user-friendly", "user friendly", "appropriate", "robust", "scalable",
  "efficient", "intuitive", "seamless", "simple", "easy", "nice", "good performance",
  "as needed", "etc.", "snappy", "lightweight", "elegant", "performant", "modern", "clean",
  "flexible", "powerful", "smooth", "reliable", "optimal", "real-time",
  // PT
  "rápido", "rapido", "rápida", "rapida", "amigável", "amigavel", "adequado", "adequada", "fácil", "facil",
  "fluido", "fluida", "moderno", "moderna", "fiável", "fiavel", "otimizado", "otimizada", "intuitivo",
  "intuitiva", "robusto", "robusta", "simples", "fácil de usar", "eficiente", "escalável", "escalavel",
  "tempo real", "limpo", "limpa", "ótimo", "otimo", "ótima", "conforme necessário",
  "conforme necessario", "flexível", "flexivel", "poderoso", "poderosa", "elegante", "adequadamente",
  "confiável", "confiavel", "performático", "performática", // pt-BR (1.14 D1): fiável → confiável; the "performant" anglicism
  // ES
  "amigable", "adecuado", "adecuada", "sencillo", "sencilla", "fiable", "optimizado", "optimizada",
  "fácil de usar", "rápida", "intuitiva", "robusta", "moderna", "escalable", "tiempo real", "ligero",
  "ligera", "limpio", "limpia", "óptimo", "optimo", "óptima", "según sea necesario", "segun sea necesario",
  "flexible", "potente", "fluida",
];
// Whole-word match (unicode-aware boundaries) so 'clean' doesn't fire inside 'cleanup', etc.
// Longest-first so multi-word phrases ("user-friendly") win over their substrings.
const VAGUE_RE = new RegExp(
  "(?<![\\p{L}\\p{N}])(" +
    [...VAGUE_WORDS].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
    ")(?![\\p{L}\\p{N}])",
  "iu"
);
const VAGUE_RE_ALL = new RegExp(VAGUE_RE.source, "giu");

// A criterion is a LOGICAL unit, not a physical line. Markdown list items continue across lines
// (indented or lazy), and EARS phrasing — "WHILE <state> WHEN <trigger> THE SYSTEM SHALL <response>"
// — pushes past one line for anything non-trivial. Validating line-by-line scored a wrapped
// criterion twice: the half carrying the ID has no modal verb (error) and the half carrying the
// modal verb has no ID (warn). Group first, lint the joined criterion. Never go back to per-line.
const RE_LIST_ITEM = /^\s*(?:\d+[.)]|[-*+])\s+/; // starts a new criterion block
const RE_NUMBERED = /^\s*\d+[.)]\s+/; // …and is enumerated, so it may be an AC without a modal verb
// Block-level constructs that can never be part of a criterion, and end the one in progress.
const RE_BLOCK_BREAK = /^\s*(?:#{1,6}\s|>|\||(?:-{3,}|={3,}|\*{3,})\s*$)/;
const B = "(?<![\\p{L}\\p{N}_])"; // unicode word boundary (before)
const E = "(?![\\p{L}\\p{N}_])"; // unicode word boundary (after)
const RE_MODAL_EN = new RegExp(B + "SHALL" + E, "iu");
const RE_MODAL_CAPS = new RegExp(B + "(DEVE|DEVER[ÁA]|DEVEM|DEVER[ÃA]O|DEBE|DEBER[ÁA]|DEBEN|DEBER[ÁA]N)" + E, "u");
const RE_MODAL_SYSTEM = new RegExp(B + "sistema\\s+(n[ãa]o\\s+|no\\s+)?(deve|dever[áa]|debe|deber[áa])" + E, "iu");
// A list item that opens with a stable AC ID defines a criterion, whatever section it sits in — a checkbox item
// (`- [ ] **US-1.AC-1** — …`) too, and an ID in single italics or a code span (1.14 full review Pa2).
const RE_LIST_DEFINES_AC = /^(?:(?:\d+[.)]|[-*+])\s+)(?:\[[ xX]\]\s+)?(?:\*\*|__|\*|_|`)?(?:US-\d+\.AC-\d+|AC-\d+)(?!\d)/;
const RE_MODAL = { test: (s) => RE_MODAL_EN.test(s) || RE_MODAL_CAPS.test(s) || RE_MODAL_SYSTEM.test(s) };
// Lowercase PT/ES modal — only trusted on a numbered item inside an acceptance-criteria context.
const RE_MODAL_LOOSE = new RegExp(B + "(deve|dever[áa]|devem|dever[ãa]o|debe|deber[áa]|deben|deber[áa]n)" + E, "iu");
const RE_AC_SHAPE = new RegExp(B + "(WHEN|WHILE|IF|WHERE|THE SYSTEM|SHOULD|MUST|WILL|NEEDS? TO|QUANDO|ENQUANTO|SE|ONDE|O SISTEMA|CUANDO|MIENTRAS|SI|DONDE|EL SISTEMA)" + E, "iu");
// Headings under which numbered items ARE acceptance criteria (EN/PT/ES).
// …or a user-story heading ("### US-1 (P1): …"), whose body holds its criteria.
const RE_AC_HEADING = /acceptance criteria|crit[ée]rios de aceita[çc][ãa]o|crit[ée]rios de aceite|criterios de aceptaci[óo]n|(?<![\p{L}])EARS(?![\p{L}])|(?:^|\/ )US-\d+(?!\d)/iu;
// A numbered item WITHOUT a modal verb is still linted as a (broken) criterion when it carries a stable
// ID or an EARS keyword in CAPITALS — not for any "if/will/se" in ordinary prose (PT/ES reflexive "se").
const RE_EARS_CAPS = new RegExp(B + "(WHEN|WHILE|IF|WHERE|QUANDO|ENQUANTO|SE|ONDE|CUANDO|MIENTRAS|SI|DONDE)" + E, "u");
const RE_EARS_KEYWORD = new RegExp(B + "(WHEN|WHILE|IF|WHERE|QUANDO|ENQUANTO|SE|ONDE|CUANDO|MIENTRAS|SI|DONDE)" + E, "iu");
const RE_UBIQUITOUS = /(THE SYSTEM SHALL|O SISTEMA (N[ÃA]O )?(DEVE|DEVER[ÁA])|EL SISTEMA (NO )?(DEBE|DEBER[ÁA]))/iu;
// The scaffold's own edge cases / NFRs / success criteria (EC-1, NFR-1, SC-001) are stable IDs too.
const RE_STABLE_ID = /(?<![A-Za-z0-9])(US-\d+\.AC-\d+|AC-\d+|T-\d+|EC-\d+|NFR-\d+|SC-\d+)/;

// A unit that DEFINES an AC for the EARS linter (criterionBlocks {acUnits}) — 1.14 full review Pa2: only list items were
// linted, so an AC written as a table row, a bold paragraph, a heading or a checkbox item was never EARS-checked while
// trace_check counted it. A line (list marker / checkbox optional) or a heading that starts with its ID; a table row
// with a cell that is exactly an AC ID.
const RE_LEAD_DEFINES_AC = /^(?:(?:\d+[.)]|[-*+])\s+)?(?:\[[ xX]\]\s+)?(?:\*\*|__|\*|_|`)?(?:US-\d+\.AC-\d+|AC-\d+)(?!\d)/;
const RE_CELL_AC = /^(?:\*\*|__|\*|_|`)?(?:US-\d+\.AC-\d+|AC-\d+)(?:\*\*|__|\*|_|`)?$/;

// Strip HTML comments (possibly multi-line — commentLines) so template guidance doesn't count as real content,
// then fold the surviving lines into criterion blocks.
// opts.acUnits (earsValidate): every unit that defines an AC is its own criterion — a line starting with an AC ID (two
// such lines in a row were ONE block), a checkbox item, a table row with a cell that is exactly an AC ID (under an
// acceptance-criteria / user-story heading or no heading at all, or holding a modal verb — elsewhere a table of IDs is a
// summary, not a criterion) and a heading that starts with an AC ID, whose body (paragraphs and list items up to the next heading,
// table, quote, rule or AC-defining unit — blank lines included) is its text. Those blocks carry definesAc: true.
// Without it (acIndex, the secondary IDs, _Supersedes:_) table rows and headings stay block breaks, as they always were.
function criterionBlocks(text, opts = {}) {
  const acUnits = !!(opts && opts.acUnits);
  const cleaned = []; // every content line, comments removed — [NEEDS CLARIFICATION] scans these
  const blocks = [];
  let cur = null;
  let section = null; // the heading path the criterion sits under, "H2 / H3 / …" (null = no heading yet)
  const stack = []; // open headings [{ level, text }] — a sub-heading inherits its parents' context
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };

  const all = text.split(/\r?\n/);
  const cl = commentLines(all); // comments and fenced code as every reader sees them (a code span's "<!--" is text)
  // acUnits: a table row, heading or paragraph line led by an AC ID is a REFERENCE — never a criterion to lint — when a list
  // item defines that ID anywhere, or an earlier unit already did ("US-1.AC-2 depends on the IdP's error codes." in Notes, a
  // "| US-1.AC-1 | P1 |" coverage table); outside an acceptance-criteria context it defines one only when it reads like one
  // (a modal verb or a capitalised EARS keyword). (Full review R5 — Pa2 linted those references and refused valid specs.)
  const leadId = (s) => { const m = s.match(/(?:US-\d+\.AC-\d+|AC-\d+)(?!\d)/); return m ? m[0] : null; };
  const listDefined = new Set();
  if (acUnits) all.forEach((raw, i) => {
    const c = cl[i];
    if (!c.hidden && !c.fence && RE_LIST_DEFINES_AC.test(c.vis.trim())) listDefined.add(leadId(c.vis.trim()));
  });
  const unitDefined = new Set();
  const definesHere = (s, sect) => {
    const id = leadId(s);
    if (!id || listDefined.has(id) || unitDefined.has(id)) return false;
    if (sect && !RE_AC_HEADING.test(sect) && !RE_MODAL.test(s) && !RE_EARS_CAPS.test(s)) return false;
    unitDefined.add(id);
    return true;
  };
  all.forEach((raw, i) => {
    const ln = i + 1;
    const c = cl[i];
    if (c.hidden) return; // wholly inside a comment: no content, and no break in the criterion
    if (c.fence === "open") return flush(); // an unclosed fence in a list item ends with the item (fenceStep)
    if (c.fence) return; // inside a fence: no content, no criteria ("const shall = 1")
    const line = c.vis;
    if (!line.trim()) {
      // A blank source line ends the criterion; a line that held only a comment does not. An AC heading's body may
      // follow it after a blank line.
      if (!raw.trim() && !(cur && cur.heading)) flush();
      return;
    }
    cleaned.push({ line: ln, text: line.trim() });
    const hd = atxHeading(stripStart(line, isWsUnit), 1, 6, "raw"); // /^\s*(#{1,6})\s+(.*)$/
    if (hd) {
      while (stack.length && stack[stack.length - 1].level >= hd.level) stack.pop();
      stack.push({ level: hd.level, text: hd.text.trim() });
      section = stack.map((h) => h.text).join(" / ");
      if (acUnits && RE_LEAD_DEFINES_AC.test(hd.text.trim()) && definesHere(hd.text.trim(), stack.slice(0, -1).map((h) => h.text).join(" / ") || null)) {
        flush();
        cur = { line: ln, endLine: ln, numbered: false, section, indent: 0, parts: [hd.text.trim()], definesAc: true, heading: true };
        return;
      }
    }
    if (acUnits && /^\s*\|/.test(line)) {
      flush();
      const cells = tableCells(line);
      const idCell = cells.find((x) => RE_CELL_AC.test(x));
      if (idCell && (!section || RE_AC_HEADING.test(section) || RE_MODAL.test(line)) && definesHere(idCell, null)) { // earsValidate's AC context; a reference is no criterion
        blocks.push({ line: ln, endLine: ln, numbered: false, section, indent: indentOf(line), parts: [cells.filter(Boolean).join(" | ")], definesAc: true });
      }
      return;
    }
    if (RE_BLOCK_BREAK.test(line)) return flush();
    const trimmed = line.trim();
    if (RE_LIST_ITEM.test(line)) {
      // An AC heading's body: its list items are its text (one that defines an AC of its own is a new criterion).
      if (cur && cur.heading && !RE_LIST_DEFINES_AC.test(trimmed)) {
        cur.endLine = ln;
        cur.parts.push(trimmed);
        return;
      }
      // A sub-list indented deeper than a criterion's first line continues it ("THE SYSTEM SHALL:" followed by
      // its numbered points is ONE criterion) — when the parent reads as a criterion (a modal verb or a defined
      // AC) and the sub-item doesn't define an AC of its own.
      if (cur && indentOf(line) > cur.indent && !RE_LIST_DEFINES_AC.test(trimmed) &&
        (RE_MODAL.test(cur.parts.join(" ")) || RE_LIST_DEFINES_AC.test(cur.parts[0]))) {
        cur.endLine = ln;
        cur.parts.push(trimmed);
        return;
      }
      flush();
      cur = { line: ln, endLine: ln, numbered: RE_NUMBERED.test(line), section, indent: indentOf(line), parts: [trimmed] };
      if (acUnits && RE_LIST_DEFINES_AC.test(trimmed)) cur.definesAc = true;
      return;
    }
    if (acUnits && RE_LEAD_DEFINES_AC.test(trimmed) && definesHere(trimmed, section)) {
      // A paragraph line that starts with an AC ID defines its own criterion — never the lazy continuation of the one above.
      flush();
      cur = { line: ln, endLine: ln, numbered: false, section, indent: indentOf(line), parts: [trimmed], definesAc: true };
      return;
    }
    if (cur) {
      cur.endLine = ln; // indented or lazy continuation of the criterion above (or an AC heading's body)
      cur.parts.push(trimmed);
      return;
    }
    cur = { line: ln, endLine: ln, numbered: false, section, indent: indentOf(line), parts: [trimmed] };
  });
  flush();
  return {
    cleaned,
    blocks: blocks.map((b) => ({ line: b.line, endLine: b.endLine, numbered: b.numbered, section: b.section, text: b.parts.join(" "), ...(b.definesAc ? { definesAc: true } : {}) })),
  };
}

// ears_validate {name} / `dev-spec ears <feature>`: lint a feature's requirements.md (resolver-aware).
function earsFeature(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const text = criteriaText(f.dir); // a change: its change.md without the task blocks (1.21 review C1)
  const lng = featureLang(projectDir, f.slug);
  if (text == null) return { ok: false, error: i18n.msg(lng).err.requirementsMissing(f.slug) };
  return earsValidate(text, lng);
}

// requirements.md defines AC IDs (trace_check's reading, requirementAcIds) but EARS linted no criterion at all: the IDs,
// shortened ("US-1.AC-1, US-1.AC-2 …"), else null. Doctor's `ears` check and the requirements approval gate fail on it
// (1.14 full review Pa2) — an AC written only mid-sentence, or in a summary table, is counted yet never checked.
function earsUnlinted(reqText, ears) {
  if (!ears || !ears.summary || ears.summary.criteriaDetected > 0) return null;
  const ids = [...requirementAcIds(reqText || "")];
  return ids.length ? ids.slice(0, 5).join(", ") + (ids.length > 5 ? " …" : "") : null;
}
// Issues carry a stable `code` (no-modal · no-id · vague · no-keyword · needs-clarification · placeholder) —
// callers branch on it, never on the (localized) `msg`.
function earsValidate(text, lang) {
  const M = i18n.msg(lang).ears;
  const G = i18n.msg(lang).gates;
  if (!text || !text.trim()) return { ok: false, error: i18n.msg(lang).err.noText };
  const issues = [];
  const { cleaned, blocks } = criterionBlocks(text, { acUnits: true }); // every unit that defines an AC is linted (Pa2)
  let acCount = 0;
  let withShall = 0;
  let withId = 0;
  let needsClar = 0;
  let withPlaceholder = 0;

  // Unresolved [NEEDS CLARIFICATION] markers can sit anywhere (heading, table, prose), not just in
  // a criterion — design is gated on these, so scan every content line.
  for (const c of cleaned) {
    if (/\[NEEDS[ _-]CLARIFICATION/i.test(c.text)) {
      needsClar++;
      issues.push({ line: c.line, severity: "warn", code: "needs-clarification", msg: M.needsClar, text: c.text });
    }
  }

  for (const b of blocks) {
    const add = (severity, code, msg) => {
      const issue = { line: b.line, severity, code, msg, text: b.text };
      if (b.endLine !== b.line) issue.endLine = b.endLine;
      issues.push(issue);
    };
    // Acceptance-criteria context: under an "Acceptance Criteria (EARS)" heading, or plain text with no
    // headings at all (ears_validate on a snippet). Elsewhere (Assumptions, prose) the loose heuristics
    // would flag ordinary sentences — "1. Users will already have an account", "O utilizador já se registou".
    const acContext = !b.section || RE_AC_HEADING.test(b.section);
    // EARS modal verb — SHALL, PT DEVE/DEVERÁ, ES DEBE/DEBERÁ (capitals, or after "sistema"); lowercase
    // deve/debe only on a numbered item in an AC context.
    const definesAc = !!b.definesAc || RE_LIST_DEFINES_AC.test(b.text); // a list item, checkbox, table row, heading or line opening with an AC ID
    const isList = RE_LIST_ITEM.test(b.text);
    const mentionsShall = RE_MODAL.test(b.text) || ((definesAc || (isList && acContext)) && RE_MODAL_LOOSE.test(b.text));
    // A unit that defines an AC is always linted (a missing modal is an error). Other numbered items
    // count only in an AC context, when they carry an ID, a CAPITALISED EARS keyword, or read like one.
    const looksLikeAc = mentionsShall || definesAc ||
      (b.numbered && acContext && (RE_STABLE_ID.test(b.text) || RE_EARS_CAPS.test(b.text) || RE_AC_SHAPE.test(b.text)));
    if (!looksLikeAc) continue;

    acCount++;
    if (mentionsShall) withShall++;
    else add("error", "no-modal", M.noModal);

    if (RE_STABLE_ID.test(b.text)) withId++;
    else add("warn", "no-id", M.noId);

    // Every distinct vague term, not just the first ("rápida e amigável" is two things to quantify).
    const vagueTerms = [...new Set([...b.text.matchAll(VAGUE_RE_ALL)].map((v) => v[1].toLowerCase()))];
    vagueTerms.forEach((term) => add("warn", "vague", M.vague(term)));
    // A template criterion ("WHEN [trigger] THE SYSTEM SHALL [behavior]") is well-formed EARS but says nothing
    // yet — never "clean" while its placeholders remain.
    const slots = placeholderReport(b.text).map((p) => p.text);
    if (slots.length) {
      withPlaceholder++;
      add("warn", "placeholder", G.earsPlaceholder(slots.slice(0, 4).join(" ") + (slots.length > 4 ? " …" : "")));
    }
    // EARS keyword presence (EN/PT/ES)
    if (mentionsShall && !RE_EARS_KEYWORD.test(b.text) && !RE_UBIQUITOUS.test(b.text)) {
      add("info", "no-keyword", M.noKeyword);
    }
  }

  issues.sort((a, b) => a.line - b.line); // stable: clarification markers first on a shared line

  return {
    ok: true,
    summary: { criteriaDetected: acCount, withShall, withStableId: withId, needsClarification: needsClar, placeholders: withPlaceholder, issues: issues.length },
    issues,
    verdict: issues.filter((x) => x.severity === "error").length === 0 ? "pass" : "fail",
  };
}

// ---------------------------------------------------------------------------
// Traceability check
// ---------------------------------------------------------------------------

function extractAcIds(text) {
  // No trailing \b: AC IDs are often wrapped in markdown italics (`_US-1.AC-1_`) and `_`
  // counts as a word char, which would defeat \b. A leading non-alnum guard avoids
  // matching inside other tokens; greedy \d+ grabs the full number (AC-10, not AC-1).
  const ids = new Set();
  const re = /(?<![A-Za-z0-9])US-\d+\.AC-\d+/g;
  let m;
  while ((m = re.exec(text || "")) !== null) ids.add(m[0]);
  return ids;
}

function extractTestIds(text) {
  // Negative lookbehind avoids matching the "T-4" inside e.g. "GPT-4".
  const ids = new Set();
  const re = /(?<![A-Za-z0-9])T-\d+/g;
  let m;
  while ((m = re.exec(text || "")) !== null) ids.add(m[0]);
  return ids;
}

// opts.code: also scan the project's TEST files for T-IDs / AC IDs (result.code — see traceTestCode). opts.scan: a
// scanTestCode() result to reuse instead of walking again (doctor / finish share one walk per call). opts.globCap: files
// an _Implements:_ glob walk may look at (default COVERAGE_CAP) — engine-internal (tests), never a tool argument.
function traceCheck(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const dir = f.dir;
  // Strip HTML comments so example markers in template guidance don't count as real refs.
  // 1.21 review C1: a change's change.md is read as two views — its criteria without the task blocks, its task blocks alone —
  // or every task reference would count as a defined criterion and every criterion as covered by its own definition.
  const rawReqs = criteriaText(dir) || "";
  const rawTasks = tasksIdText(dir) || "";
  const rawPlan = readIfExists(path.join(dir, "test-plan.md")) || "";
  // `_Supersedes: other/US-1.AC-2_` names ANOTHER feature's AC — never one of this feature's (see supersedesTrace). An ID
  // that only appears in a fenced code block (an example) is not a required AC either (requirementAcIds).
  const tasks = tasksProseText(rawTasks); // comments out, fenced examples blanked (the task scanner's view)
  const testPlan = planIdText(rawPlan); // comments out, fenced examples blanked — like the tasks
  const tracks = detectTracks(dir);

  const requiredAcs = requirementAcIds(rawReqs);
  const acsInTasks = extractAcIds(tasks);
  const acsInTestPlan = extractAcIds(testPlan);

  const uncoveredByTasks = [...requiredAcs].filter((id) => !acsInTasks.has(id));
  // Reverse direction: AC IDs referenced by tasks that don't exist in requirements (typos).
  const phantomAcsInTasks = [...acsInTasks].filter((id) => !requiredAcs.has(id));

  // Spec ↔ code: tasks may carry `_Implements: path/to/file_` markers. Verify the files exist.
  const implFiles = [];
  // The task-marker reader (taskMarkerSpans): `src/user_service.py` stays whole, and `_Implements: src/a.ts_;` /
  // `(see _Implements: src/old.ts_).` are markers too (1.14 full review Pa1 — they read as no file at all).
  for (const v of taskMarkerValues(tasks, "implements")) {
    v.split(/[,;]/).map((s) => s.trim().replace(/^`|`$/g, "")).filter(Boolean).forEach((p) => { if (!implFiles.includes(p)) implFiles.push(p); });
  }
  // Clamp to the project root: paths that escape it count as missing without probing arbitrary FS.
  const projRoot = path.resolve(projectDir);
  const outOfRoot = new Set();
  const unresolvedImplGlobs = [];
  const absent = implFiles.filter((f) => {
    // The file a reference names, as coverage / the drift baseline / the brief's steering read it (implementsPath):
    // a `path/to/file.js:12` or `#L12` anchor is dropped — resolving the raw spelling failed doctor and finish with
    // "files that don't exist" for a file coverage counted (on NTFS `app.js:1` even names an alternate data stream).
    // Reported with the spelling the task wrote. An anchor with no path names nothing: missing.
    const p = implementsPath(f);
    if (!p) return true;
    // A glob (`src/api/**`, `lib/*.js`) is present once it matches a file — coverage()'s glob, walked from its literal
    // folders only. One that would leave the project is out of root like any such path. A walk that hit its cap before
    // any match proves nothing (the file may sit past the cap): never a missing-file gap — a warning (unresolvedImplGlobs).
    if (isImplementsGlob(p)) {
      const g = globFiles(projRoot, p, { first: true, cap: opts.globCap });
      if (g.outside) outOfRoot.add(f);
      if (!g.files.length && g.truncated) { unresolvedImplGlobs.push(f); return false; }
      return !g.files.length;
    }
    const abs = path.resolve(projRoot, p);
    const inRoot = withinRoot(projRoot, abs); // a drive root (C:\) already ends in a separator
    if (!inRoot) outOfRoot.add(f);
    return !inRoot || !fs.existsSync(abs);
  });
  // A file that doesn't exist YET is a gap only once a task claiming it is done: an OPEN task's _Implements:_ is
  // the plan (next --batch needs those markers before a line is written) — reported as plannedImplFiles. A marker
  // no open task holds (a done task's, or one outside any task) stays a gap — and so does a path outside the
  // project root: no task can ever create it there, so it is never "planned".
  const unq = (p) => p.trim().replace(/^`|`$/g, "");
  const openOnly = new Set();
  const claimed = new Set();
  const blocks = taskBlocks(rawTasks);
  for (const b of blocks) {
    for (const p of taskMarkers(b).implements.map(unq)) {
      if (!b.done && !claimed.has(p)) openOnly.add(p);
      if (b.done) { claimed.add(p); openOnly.delete(p); }
    }
  }
  const planned = (p) => openOnly.has(p) && !outOfRoot.has(p);
  const plannedImplFiles = absent.filter(planned);
  const missingImplFiles = absent.filter((p) => !planned(p));

  const result = {
    ok: true,
    feature: f.slug,
    tracks: trackLabel(tracks),
    totalAcs: requiredAcs.size,
    coveredByTasks: requiredAcs.size - uncoveredByTasks.length,
    uncoveredByTasks,
    phantomAcsInTasks,
    implementsFiles: implFiles,
    missingImplFiles,
    plannedImplFiles,
    unresolvedImplGlobs, // globs whose bounded walk ended (COVERAGE_CAP) before a match: neither present nor missing
  };

  if (tracks.includes("tdd")) {
    const uncoveredByTests = [...requiredAcs].filter((id) => !acsInTestPlan.has(id));
    // Reverse: AC IDs the test plan covers that requirements.md doesn't define (a typo, a removed criterion, a template
    // row for a track the requirements never got) — a fenced example is no reference (planIdText), as for tasks.
    const phantomAcsInTests = [...extractAcIds(testPlan)].filter((id) => !requiredAcs.has(id));
    const planTestIds = extractTestIds(testPlan);
    const tasksTestIds = extractTestIds(tasks);
    const testsNotInTasks = [...planTestIds].filter((id) => !tasksTestIds.has(id));
    // Reverse: test IDs referenced by tasks that aren't in the test plan (typos).
    const phantomTestsInTasks = [...tasksTestIds].filter((id) => !planTestIds.has(id));
    result.coveredByTests = requiredAcs.size - uncoveredByTests.length;
    result.uncoveredByTests = uncoveredByTests;
    result.phantomAcsInTests = phantomAcsInTests;
    result.plannedTests = planTestIds.size;
    result.testsNotMappedToTasks = testsNotInTasks;
    result.phantomTestsInTasks = phantomTestsInTasks;
  }

  const gaps =
    uncoveredByTasks.length +
    phantomAcsInTasks.length +
    missingImplFiles.length +
    (result.uncoveredByTests ? result.uncoveredByTests.length : 0) +
    (result.phantomAcsInTests ? result.phantomAcsInTests.length : 0) +
    (result.phantomTestsInTasks ? result.phantomTestsInTasks.length : 0);
  result.verdict = gaps === 0 ? "pass" : "gaps-found";
  // Phantom AC IDs that a recorded change request REMOVED from requirements.md (spec_impact --reopen): still gaps, but
  // no typos — traceGapLines names the change request and says to delete or update what cites them. Informational.
  const removedAt = new Map();
  const changes = stateFromFile(projectDir, statePath(dir)).changes;
  const reqPhase = isChangeDir(dir) ? "tasks" : "requirements"; // 1.21 review C4: a change's criteria change with its plan (phase tasks)
  (Array.isArray(changes) ? changes : []).forEach((c, i) => {
    if (isRecord(c) && c.phase === reqPhase && Array.isArray(c.removed)) for (const id of c.removed) if (typeof id === "string") removedAt.set(id, i + 1);
  });
  result.removedAcs = [...new Set([...phantomAcsInTasks, ...(result.phantomAcsInTests || [])])].filter((id) => removedAt.has(id))
    .map((id) => ({ id, changeRequest: removedAt.get(id) }));

  // Deep traceability — WARNINGS, never part of the verdict (above) nor of traceGaps(): the secondary IDs of
  // requirements.md and, with opts.code, the T-IDs of the project's test code.
  Object.assign(result, traceSecondary(dir, rawReqs, blocks, rawPlan, tracks));
  // 1.14 F5 — opts.matrix: + the requirements traceability matrix (buildTraceMatrix); with code both share ONE walk.
  const scan = opts.code && opts.matrix ? (typeof opts.scan === "function" ? opts.scan() : opts.scan) || scanTestCode(projectDir) : opts.scan;
  if (opts.code) result.code = traceTestCode(projectDir, dir, testPlan, requiredAcs, scan);
  result.warnings = traceWarnings(result);
  Object.assign(result, supersedesTrace(projectDir, dir, rawReqs)); // informational: never a gap, never the verdict
  Object.assign(result, decisionsTrace(dir, stateFromFile(projectDir, statePath(dir)).kind)); // 1.14 C2: phantom _Affects:_ (warnings)
  if (opts.matrix) { const { ok: _ok, ...mx } = buildTraceMatrix(projectDir, f, { code: opts.code, scan }); result.matrix = mx; } // informational (F5)
  return result;
}

// Every non-empty gap list of a trace_check result, in a stable order, so the CLI, the hook and doctor
// list them ALL — a hand-picked subset used to print "gaps-found" with nothing under it (phantom T-IDs,
// missing _Implements:_ files). Any array field a later version adds is a gap kind too, unless listed as
// informational here.
// planned = an OPEN task's file, not written yet; the deep-traceability warnings (TRACE_WARNING_ORDER) are warnings.
const TRACE_INFO_FIELDS = new Set(["implementsFiles", "plannedImplFiles", "unresolvedImplGlobs", "warnings", "uncoveredEdgeCases", "uncoveredNfr", "uncoveredSuccessCriteria", "phantomSecondary", "removedAcs"]);
const TRACE_GAP_ORDER = ["uncoveredByTasks", "phantomAcsInTasks", "uncoveredByTests", "phantomAcsInTests", "phantomTestsInTasks", "testsNotMappedToTasks", "missingImplFiles"];
// The kinds trace_check's verdict counts (testsNotMappedToTasks is listed, never failing), and the kinds that read
// tasks.md / test-plan.md — doctor defers the latter while that artifact is still a later phase's template.
const TRACE_VERDICT_KINDS = new Set(["uncoveredByTasks", "phantomAcsInTasks", "missingImplFiles", "uncoveredByTests", "phantomAcsInTests", "phantomTestsInTasks"]);
const TRACE_TASK_KINDS = ["uncoveredByTasks", "phantomAcsInTasks", "phantomTestsInTasks", "testsNotMappedToTasks", "missingImplFiles"];
const TRACE_PLAN_KINDS = ["uncoveredByTests", "phantomAcsInTests", "phantomTestsInTasks", "testsNotMappedToTasks"];
function traceGaps(tr) {
  const rank = (k) => (TRACE_GAP_ORDER.includes(k) ? TRACE_GAP_ORDER.indexOf(k) : TRACE_GAP_ORDER.length);
  return Object.keys(tr || {})
    .filter((k) => Array.isArray(tr[k]) && tr[k].length && !TRACE_INFO_FIELDS.has(k))
    .sort((a, b) => rank(a) - rank(b))
    .map((k) => ({ kind: k, items: tr[k].map((x) => (typeof x === "string" ? x : (x && x.id) || JSON.stringify(x))) }));
}
// The same gaps as localized "label: ID, ID" lines. A phantom AC that a change request removed (tr.removedAcs) gets its
// own line naming the request — "delete or update what cites it", never "(typos?)".
function traceGapLines(tr, lang) {
  const T = i18n.msg(lang).traceGapText;
  const removed = new Map((Array.isArray(tr && tr.removedAcs) ? tr.removedAcs : []).filter(isRecord).map((r) => [r.id, r.changeRequest]));
  const out = [];
  for (const g of traceGaps(tr)) {
    const rem = T.removedKinds[g.kind] && removed.size ? g.items.filter((id) => removed.has(id)) : [];
    const rest = g.items.filter((id) => !rem.includes(id));
    if (rest.length) out.push(T.gap(T.kinds[g.kind] || g.kind, rest.join(", ")));
    if (rem.length) out.push(T.gap(T.removedKinds[g.kind], rem.map((id) => T.removedRef(id, removed.get(id))).join(", ")));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deep traceability: secondary IDs (EC / NFR / SC) and T-IDs in test code — warnings only
// ---------------------------------------------------------------------------

// trace_check `warnings` — ONE shape, the one traceGaps() returns: [{ kind, items: [id, …] }], only the non-empty
// kinds, in this order. The secondary kinds are also top-level arrays (always present); the code kinds live in
// result.code (present with opts.code). None of them changes the verdict. unresolvedImplGlobs (a top-level array too):
// an _Implements:_ glob whose bounded walk stopped at its cap before any match.
const TRACE_WARNING_ORDER = ["uncoveredEdgeCases", "uncoveredNfr", "uncoveredSuccessCriteria", "phantomSecondary", "plannedNotInCode", "inCodeNotInPlan", "unresolvedImplGlobs"];
const TRACE_SECONDARY_KINDS = TRACE_WARNING_ORDER.slice(0, 4);
function traceWarnings(tr) {
  const src = { ...(tr && tr.code ? { plannedNotInCode: tr.code.plannedNotInCode, inCodeNotInPlan: tr.code.inCodeNotInPlan } : {}) };
  for (const k of [...TRACE_SECONDARY_KINDS, "unresolvedImplGlobs"]) if (tr && Array.isArray(tr[k])) src[k] = tr[k];
  return TRACE_WARNING_ORDER.filter((k) => Array.isArray(src[k]) && src[k].length).map((k) => ({ kind: k, items: src[k].slice() }));
}
// The warnings as localized "label: ID, ID" lines (kinds = a subset, e.g. the secondary ones for doctor).
function traceWarningLines(tr, lang, kinds) {
  const T = i18n.msg(lang).traceGapText;
  const K = i18n.msg(lang).deepTrace.kinds;
  const list = Array.isArray(tr && tr.warnings) ? tr.warnings : traceWarnings(tr);
  return list.filter((w) => !kinds || kinds.includes(w.kind)).map((w) => T.gap(K[w.kind] || w.kind, w.items.join(", ")));
}

// Secondary IDs — edge cases (EC-1), non-functional requirements (NFR-1), success criteria (SC-001) — compared by
// prefix + NUMBER (SC-1 names SC-001) and reported as written. The leading guard keeps DESC-1 / SPEC-2 out.
const RE_SECONDARY_ID = /(?<![A-Za-z0-9])(EC|NFR|SC)-(\d+)/g;
const RE_SECONDARY_ID_LINE = /(?<![A-Za-z0-9])(?:EC|NFR|SC)-\d+/;
const idKey = (prefix, num) => prefix + "-" + parseInt(num, 10);
function secondaryIds(text) { // → Map(key → first spelling)
  const out = new Map();
  for (const m of String(text || "").matchAll(RE_SECONDARY_ID)) {
    const k = idKey(m[1], m[2]);
    if (!out.has(k)) out.set(k, m[0]);
  }
  return out;
}
// requirements.md → { defined: Map(key → id) — IDs with a REAL definition, in document order; all: Set(key) — every ID
// written, template or not }. A unit that still holds a template placeholder ("- **SC-001** — [e.g., 90% of users …]")
// doesn't define its IDs yet: an untouched scaffold row is never "uncovered". Units are criterionBlocks' logical items
// (wrapped list items folded; comments and fenced code skipped) plus the table rows, headings and quotes it keeps apart.
function secondaryDefinitions(reqText) {
  const { cleaned, blocks } = criterionBlocks(reqText || "");
  const units = blocks.map((b) => ({ line: b.line, text: b.text }))
    .concat(cleaned.filter((c) => /^[|#>]/.test(c.text)))
    .sort((a, b) => a.line - b.line);
  const defined = new Map();
  const all = new Set();
  for (const u of units) {
    const ids = secondaryIds(u.text);
    if (!ids.size) continue;
    const real = !placeholderReport(u.text).length;
    for (const [k, id] of ids) {
      all.add(k);
      if (real && !defined.has(k)) defined.set(k, id);
    }
  }
  return { defined, all };
}
// EC / NFR are covered by a task (its text or any sub-line, _Requirements:_ included) or a test-plan row (a T-ID's row);
// SC by a test-plan row or a real (non-template) line of quickstart.md. phantomSecondary = IDs the tasks / test plan
// cite that requirements.md never writes. The test plan counts only while +tdd is active: after add_track --remove tdd
// it is an inactive artifact and must not silence (or raise) anything — the rest of traceCheck reads it only under tdd.
function traceSecondary(dir, reqText, blocks, planText, tracks) {
  const { defined, all } = secondaryDefinitions(reqText);
  const inTasks = secondaryIds(blocks.map((b) => taskProse(b).join("\n")).join("\n"));
  const inPlan = tracks.includes("tdd") ? secondaryIds(testPlanEntries(planText).map((e) => e.text).join("\n")) : new Map();
  const inQuickstart = secondaryIds(realLines(readIfExists(path.join(dir, "quickstart.md")) || "", RE_SECONDARY_ID_LINE).join("\n"));
  const out = { uncoveredEdgeCases: [], uncoveredNfr: [], uncoveredSuccessCriteria: [], phantomSecondary: [] };
  for (const [k, id] of defined) {
    const prefix = k.slice(0, k.indexOf("-"));
    if (prefix === "SC") { if (!inPlan.has(k) && !inQuickstart.has(k)) out.uncoveredSuccessCriteria.push(id); }
    else if (!inTasks.has(k) && !inPlan.has(k)) (prefix === "EC" ? out.uncoveredEdgeCases : out.uncoveredNfr).push(id);
  }
  const cited = new Map(inTasks);
  for (const [k, id] of inPlan) if (!cited.has(k)) cited.set(k, id);
  for (const [k, id] of cited) if (!all.has(k)) out.phantomSecondary.push(id);
  return out;
}
function testPlanEntries(planText) {
  const out = [];
  let header = null;
  let sep = false;
  let inTable = false;
  let item = null; // the list entry being continued: { indent, blank, entry }
  const tidLead = (line) => RE_LIST_ITEM.test(line) && line.replace(RE_LIST_ITEM, "").replace(/^[\s*`_]+/, "").match(/^T-\d+(?!\d)/);
  for (const line of planIdText(planText || "").split(/\r?\n/)) {
    if (item) {
      const indent = line.match(/^\s*/)[0].length;
      if (!line.trim()) { item.blank = true; continue; }
      const block = RE_LIST_ITEM.test(line) || /^\s*(?:#|\||>|[-*_]{3,}\s*$)/.test(line);
      if (!tidLead(line) && (indent > item.indent || (!item.blank && !block))) { item.entry.text += "\n" + line.trim(); continue; }
      item = null;
    }
    if (/^\s*\|/.test(line)) {
      if (!inTable) { inTable = true; header = tableCells(line); sep = false; continue; }
      if (!sep && /^\s*\|[\s:|-]+$/.test(line.trim())) { sep = true; continue; }
      const cells = tableCells(line);
      const ids = [...extractTestIds(cells[0] || "")];
      if (ids.length) out.push({ ids, text: line.trim(), cells, header });
      continue;
    }
    inTable = false;
    const m = tidLead(line);
    if (m) {
      const entry = { ids: [m[0]], text: line.trim(), cells: null, header: null };
      out.push(entry);
      item = { indent: line.match(/^\s*/)[0].length, blank: false, entry };
    }
  }
  return out;
}

// T-IDs as test code writes them: "T-01" anywhere (a test title, DisplayName, a comment), test_T01 / testT01 / TestT01
// (pytest, JUnit, Go) and a leading T01_ method name (C# / Java). Without the hyphen the T is UPPERCASE and the number
// zero-padded (two digits or more) as the templates write it: a bare "T1" collides with generic type parameters
// (Func<T1, T2>), and test_t2_is_after_t1 / test_t0_is_epoch are pytest names about time variables, not tests T-2 / T-0.
// Group 1/2/3 = the number as written.
const RE_CODE_TID = /(?<![A-Za-z0-9])T-(\d+)|(?<![A-Za-z0-9])[Tt]est_?T(\d{2,})(?![0-9])|(?<![A-Za-z0-9_])T(\d{2,})_(?=[A-Za-z])/g;
const CODE_TRACE_CAP = 5000; // files walked
const CODE_TRACE_READ_CAP = 1500; // test files read
const CODE_TRACE_FILES_PER_ID = 10; // files listed per ID (every one still counts)
// A test file in any language — isTestFile (engine/scan.js), the ONE rule since 1.21.1. Until then F# / Scala / Groovy,
// Elixir and Dart kept their own conventions here, unknown to the scan, coverage and the guard; scan.js's RE_TEST_NAME holds
// them now, with PowerShell's, shell's, C/C++'s, Lua's, R's, Erlang's, Haskell's, Clojure's, Objective-C / VB's and Perl's.
const isTestCodePath = (rel) => isTestFile(rel);
const tKey = (num) => "T-" + parseInt(num, 10);
// The feature folders under .specs/ (live, then archived — their tests may still be in the tree).
function specFeatureDirs(projectDir) {
  const root = specsRoot(projectDir);
  return safeReaddir(root).filter((n) => !n.startsWith(".") && n !== "_archive" && !reservedSlug(n, root)).map((n) => path.join(root, n))
    .concat(safeReaddir(path.join(root, "_archive")).map((n) => path.join(root, "_archive", n)));
}
// One bounded, read-only walk of the project (walkProject: SCAN_IGNORE, hidden dirs and .specs skipped) over its TEST
// files — code in any language of CODE_EXT (isCodeFile: a .bats suite and Perl's t/*.t too) that isTestFile says is a test:
// test/spec/__tests__ folders, *.test.* / *.spec.*, test_*.py, *_test.go, *Test.java, *Tests.cs, Pester's *.Tests.ps1 …),
// collecting the T-IDs and AC IDs they name — plus each feature's own .specs/<feature>/tests/ (the folder +tdd and bugfix
// scaffold for the failing tests), within the same caps; the rest of .specs/ stays skipped. Project-level (not per
// feature), so doctor / finish reuse it; traceTestCode decides which files count for a feature.
// 1.21.1 review: a test FIXTURE — data-like code (.sql, .ipynb) in a test folder whose name follows no test convention
// (isTestFixture: tests/fixtures/seed.sql) — is never read, nor counted; when more test files than CODE_TRACE_READ_CAP are
// found, the ones NAMED like a test (testNamed) are read first, in walk order (below the cap nothing changes: every one,
// in walk order); each is read up to SCAN_READ_BYTES from disk (readFileHead — never the whole file).
// → { tids: Map(key → { id, files }), acs: Map(acId → { id, files }), scanned, truncated }
function scanTestCode(projectDir) {
  const root = path.resolve(projectDir);
  const tids = new Map();
  const acs = new Map();
  let scanned = 0;
  let readCapped = false;
  const note = (map, key, id, rel) => {
    if (!map.has(key)) map.set(key, { id, files: [] });
    const e = map.get(key);
    if (!e.files.includes(rel)) e.files.push(rel);
  };
  const cands = []; // the test files found, in walk order: { rel, full }
  const onFile = (rel, full) => {
    if (isCodeFile(rel) && isTestCodePath(rel) && !isTestFixture(rel)) cands.push({ rel, full });
  };
  const walk = walkProject(root, CODE_TRACE_CAP, onFile);
  let left = CODE_TRACE_CAP - walk.total;
  let truncated = walk.truncated;
  for (const d of specFeatureDirs(projectDir)) {
    if (left <= 0) break;
    const tdir = path.join(d, "tests");
    try { if (!fs.lstatSync(tdir).isDirectory()) continue; } catch { continue; } // a symlinked tests/ is never followed
    const tPre = toPosix(path.relative(root, tdir));
    const w = walkProject(tdir, left, (rel, full) => onFile(tPre + "/" + rel, full));
    left -= w.total;
    truncated = truncated || w.truncated;
  }
  let pick = cands;
  if (cands.length > CODE_TRACE_READ_CAP) {
    readCapped = true;
    const keep = new Set(cands.filter((c) => testNamed(c.rel)).slice(0, CODE_TRACE_READ_CAP));
    for (const c of cands) { if (keep.size >= CODE_TRACE_READ_CAP) break; keep.add(c); }
    pick = cands.filter((c) => keep.has(c));
  }
  for (const { rel, full } of pick) {
    const txt = readFileHead(full, SCAN_READ_BYTES);
    if (txt == null) continue;
    scanned++;
    for (const m of txt.matchAll(RE_CODE_TID)) {
      const num = m[1] || m[2] || m[3];
      note(tids, tKey(num), "T-" + num, rel);
    }
    for (const id of extractAcIds(txt)) note(acs, id, id, rel);
  }
  return { tids, acs, scanned, truncated: truncated || readCapped };
}
// Every T-ID any feature's test plan lists (archived features too — their tests may still be in the tree), by key.
function allPlannedTestKeys(projectDir) {
  const keys = new Set();
  for (const d of specFeatureDirs(projectDir)) {
    const plan = readIfExists(path.join(d, "test-plan.md"));
    if (plan != null) for (const id of extractTestIds(planIdText(plan))) keys.add(tKey(id.slice(2)));
  }
  return keys;
}
// A test-plan table's File column (EN / PT / ES header synonyms, optional "Test" prefix or "(…)" note).
const RE_FILE_COLUMN = /^(?:test\s+)?(?:files?|paths?|ficheiros?|arquivos?|caminhos?|archivos?|ficheros?|rutas?)(?:\s*\(.*\))?$/i;
// Is `rel` the path `p` or under the folder `p`? Forward-slash project-relative paths; case-folded where the FS is.
function pathUnder(rel, p) {
  const fold = (s) => (FOLD_CASE ? s.toLowerCase() : s);
  const r = fold(rel);
  const q = stripEnd(fold(p), isSlashUnit); // /\/+$/
  return q !== "" && (r === q || r.startsWith(q + "/"));
}
// Does the File cell path `p` name `rel`? People write the cell from the project root, from the feature folder, from a
// monorepo package (`tests/unit/login.test.ts` for packages/api/tests/unit/login.test.ts) or as a bare file name
// (`login.test.ts`), so `p` matches whole path segments at the END of `rel` (a file) or inside it (a folder) — never a
// partial segment: `tests/beta.test.js` doesn't name tests/alpha.test.js, nor `beta.test.js` alphabeta.test.js.
function pathNames(rel, p) {
  const fold = (s) => (FOLD_CASE ? s.toLowerCase() : s);
  const r = "/" + fold(rel);
  const q = stripEnd(fold(p), isSlashUnit); // /\/+$/
  return q !== "" && (r.endsWith("/" + q) || r.includes("/" + q + "/"));
}
// A File cell path the test-code scan can find a T-ID in: a folder (`tests/auth/`, no extension) or a file the scan reads.
// `tests/load/checkout-load.md` sits under a test dir but is never read, so scoping to it would warn forever.
function scannableTestPath(t) {
  if (t.endsWith("/")) return true;
  const ext = path.posix.extname(t).toLowerCase();
  // code in any language, or a test-only extension (.bats, Perl's .t) — never a test fixture the scan skips (seed.sql)
  return ext === "" || (GUARD_CODE_EXT.has(ext) && !isTestFixture(t));
}
// A File cell token naming a non-code artifact — a document or data file, never source in any language (GUARD_CODE_EXT):
// `load-test.md`, `evals/golden.json`, `tests/load/plan.md`, a Gherkin `.feature` or a JMeter `.jmx`. The test-code scan
// reads none of them, so a row whose File column names only such files is checked outside test code (a load run, the eval
// harness, a manual pass) — expecting its T-ID in a test file warned forever (the scaffold's own load/eval rows did).
function nonCodeArtifactPath(t) {
  const ext = path.posix.extname(stripEnds(t, unitIn("(\"'["), unitIn(")\"'].,:;"))).toLowerCase(); // /^[("'[]+|[)"'\].,:;]+$/g
  return /^\.[a-z][a-z0-9]*$/.test(ext) && !GUARD_CODE_EXT.has(ext);
}
// Does a File cell token look like code — a source file in any language, or a folder? Then the row is not "outside code".
function codePathToken(t) {
  const ext = path.posix.extname(t).toLowerCase();
  return GUARD_CODE_EXT.has(ext) || (ext === "" && t.includes("/"));
}
// → { scopes, outside }. scopes: key(T-ID) → [test paths] its plan rows' File column names — only CONCRETE test paths (a
// test file or a folder under a test dir: `tests/unit/login.test.ts`, `tests/auth/`); a template slot (`[path]`,
// `tests/unit/...`), a non-test artifact or a missing column scopes nothing. `::test_x`, `#L3` and `:12` suffixes are
// cut. outside: the keys whose EVERY plan row names only non-code artifacts (nonCodeArtifactPath) in its File column —
// verified outside test code, never expected in a test file; a row with no File cell, a template slot or a code path
// keeps its T-ID expected in code.
// files: every concrete test FILE the plan's File column names (a test path with an extension — never a folder), any row:
// what the plan claims as its own (traceTestCode's cross-feature rule, 1.14 full review Pa5).
function planFileScopes(planText) {
  const scopes = new Map();
  const files = new Set();
  const outsideRows = new Set();
  const inCodeRows = new Set();
  for (const e of testPlanEntries(planText)) {
    const keys = e.ids.map((id) => tKey(id.slice(2)));
    const fc = fileCellTokens(e);
    if (!fc) { keys.forEach((k) => inCodeRows.add(k)); continue; }
    const { raw, tokens } = fc;
    const paths = tokens.filter((t) => isTestCodePath(t) && scannableTestPath(t));
    const outside = !paths.length && tokens.length === raw.length && tokens.some(nonCodeArtifactPath) && !tokens.some(codePathToken);
    for (const k of keys) (outside ? outsideRows : inCodeRows).add(k);
    if (!paths.length) continue;
    for (const p of paths) if (!p.endsWith("/") && path.posix.extname(p)) files.add(p);
    for (const k of keys) scopes.set(k, [...new Set([...(scopes.get(k) || []), ...paths])]);
  }
  return { scopes, files, outside: new Set([...outsideRows].filter((k) => !inCodeRows.has(k))) };
}
// The File column of one test-plan entry (testPlanEntries) as path tokens → { raw, tokens } or null (no File column / cell):
// raw = every token (code spans first; `::test_x`, `#L3` and `:12` suffixes cut, `./` and a leading `/` dropped), tokens =
// those that are no template slot (`[path]`, `tests/unit/...`, `<file>`, a glob).
function fileCellTokens(e) {
  const col = e.cells && e.header ? e.header.findIndex((h) => RE_FILE_COLUMN.test(h.replace(/[*_`]/g, "").trim())) : -1;
  if (col < 0 || col >= e.cells.length) return null;
  const cell = e.cells[col];
  const spans = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const raw = (spans.length ? spans.join(" ") : cell).split(/[\s,;]+/)
    .map((t) => t.replace(/\\/g, "/").replace(/::.*$/, "").replace(/#.*$/, "").replace(/:\d+(?::\d+)?$/, "").replace(/^(?:\.\/)+/, "").replace(/^\/+/, ""))
    .filter(Boolean);
  const tokens = raw.filter((t) => !/[[\]<>{}*?…]|\.\.\.|(?:^|\/)\.\.(?:\/|$)/.test(t)); // template slots out
  return { raw, tokens };
}
// 1.14 full review Pa6 — the tests this feature's plan checks OUTSIDE test code (planFileScopes' outside: every row's File
// column names only non-code artifacts — load-test.md, evals/golden.json) whose artifact is still the scaffold: a
// load-test.md holding template placeholders (artifactState), the scaffold's sample eval set. Judged once such a test is
// due — a DONE task makes it green (greenDone), or every active task is done; a scaffold nobody filled in used to let the
// feature finish "ready" with no load run at all. A token is looked up in the feature folder, then from the project root
// (inside it only); a missing file, or a kind this can't judge (.feature, .jmx …), is not reported. → [{ id, file }]
function outsideCodeTemplates(projectDir, dir, tracks, greenDone) {
  if (!tracks.includes("tdd")) return [];
  const planText = planIdText(readIfExists(path.join(dir, "test-plan.md")) || "");
  const { outside } = planFileScopes(planText);
  if (!outside.size) return [];
  const blocks = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || "");
  const allDone = blocks.length > 0 && blocks.every((b) => b.done);
  const due = new Set([...(greenDone || [])].map((id) => tKey(id.slice(2))));
  const root = path.resolve(projectDir);
  const samples = new Set([SAMPLE_GOLDEN, SAMPLE_ADVERSARIAL].map((x) => JSON.stringify(JSON.parse(x))));
  useTemplateScopeOf(dir); // the project's own templates are template text too
  const judged = new Map(); // file token → template?
  const isTemplate = (t) => {
    if (judged.has(t)) return judged.get(t);
    let res = false;
    const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
    const abs = [path.resolve(dir, t), path.resolve(root, t)].find((p) => withinRoot(root, p) && isFile(p));
    const ext = path.extname(t).toLowerCase();
    if (abs && (ext === ".md" || ext === ".markdown")) res = artifactState({ file: abs }) === "placeholder";
    else if (abs && ext === ".json") { const j = readJson(abs); res = !!j.data && samples.has(JSON.stringify(j.data)); }
    judged.set(t, res);
    return res;
  };
  const out = [];
  const seen = new Set();
  for (const e of testPlanEntries(planText)) {
    const ids = e.ids.filter((id) => { const k = tKey(id.slice(2)); return outside.has(k) && (allDone || due.has(k)); });
    const fc = ids.length ? fileCellTokens(e) : null;
    if (!fc) continue;
    for (const t of fc.tokens.filter(nonCodeArtifactPath)) {
      if (!isTemplate(t)) continue;
      for (const id of ids) { const key = id + " " + t; if (!seen.has(key)) { seen.add(key); out.push({ id, file: t }); } }
    }
  }
  return out;
}
// The concrete test files OTHER features' plans (active and archived) name in their File column (planFileScopes' files).
function otherPlanTestFiles(projectDir, ownDir) {
  const own = dirKey(ownDir);
  const out = new Set();
  for (const d of specFeatureDirs(projectDir)) {
    if (dirKey(d) === own) continue;
    const plan = readIfExists(path.join(d, "test-plan.md"));
    if (plan != null) for (const p of planFileScopes(planIdText(plan)).files) out.add(p);
  }
  return [...out];
}
// trace_check {code: true}: this feature's plan against the test code. T-IDs restart at T-01 in every plan, so a file
// counts for THIS feature unless it sits in ANOTHER feature's .specs/<f>/tests/ or another feature's plan names that file
// in its File column while this plan doesn't (1.14 full review Pa5); and a planned T-ID whose plan row's File
// column names a concrete test path counts only in that file / under that folder (pathNames: written from the project
// root, the feature folder, a package folder, or a bare file name) — otherwise another feature's test with the same
// number would pass it. Without a File path the match is by number across the project.
//   testsInCode       { T-ID: [test files …] } — every T-ID found in files that count, keyed by this plan's spelling
//   plannedNotInCode  this plan's T-IDs that no counting test file names (those checked outside test code left out)
//   plannedOutsideCode  this plan's T-IDs whose every row's File column names only non-code artifacts (load-test.md,
//                     evals/golden.json …): run outside test code — never expected in a test file (planFileScopes)
//   inCodeNotInPlan   T-IDs in test code that NO feature's test plan lists (another feature's T-01 is not this one's gap)
//   acsInTests        this feature's AC IDs that test code names (another feature's .specs tests excluded)
//   planned           how many T-IDs this plan lists
//   scanned / truncated  test files read · the walk or the read hit its cap
function traceTestCode(projectDir, dir, planText, requiredAcs, scan) {
  // scan: a scanTestCode() result, or a function returning one (spec_upgrade walks the project once, and only when a feature needs it)
  const s = (typeof scan === "function" ? scan() : scan) || scanTestCode(projectDir);
  const root = path.resolve(projectDir);
  const own = toPosix(path.relative(root, dir));
  const specsRel = toPosix(path.relative(root, specsRoot(projectDir)));
  const mine = (rel) => !pathUnder(rel, specsRel) || pathUnder(rel, own);
  const planned = new Map([...extractTestIds(planText)].map((id) => [tKey(id.slice(2)), id]));
  const { scopes, files: ownFiles, outside } = planFileScopes(planText);
  const inScope = (k, rel) => !scopes.has(k) || scopes.get(k).some((p) => pathNames(rel, p));
  // 1.14 full review Pa5 — T-IDs restart at T-01 in every plan, so a test FILE another feature's plan (active or
  // archived) names in its File column is that feature's: it never counts for this plan's T-IDs unless this plan names
  // that file too. A folder (`test/`) claims nothing — it scopes, it doesn't own. Without it a new feature whose rows say
  // File `test/` passed the Phase 4 gate, doctor and trace --code on another feature's test/shortener.test.js.
  // Ownership is claimed by the EXACT project-relative path only — pathNames' suffix match made another plan's
  // `tests/test_api.py` own services/beta/tests/test_api.py and hid a monorepo feature's own tests.
  const fold = (s) => { const t = stripEnd(String(s).replace(/^\.\//, ""), isSlashUnit); return FOLD_CASE ? t.toLowerCase() : t; };
  const claimed = new Set(otherPlanTestFiles(projectDir, dir).map(fold));
  const foreignMemo = new Map();
  const foreign = (rel) => {
    if (!claimed.size) return false;
    if (!foreignMemo.has(rel)) foreignMemo.set(rel, claimed.has(fold(rel)) && ![...ownFiles].some((p) => pathNames(rel, p)));
    return foreignMemo.get(rel);
  };
  const counts = (rel) => mine(rel) && !foreign(rel);
  const everyPlan = allPlannedTestKeys(projectDir);
  const testsInCode = {};
  const found = new Set();
  for (const [k, e] of s.tids) {
    const files = e.files.filter((rel) => counts(rel) && (!planned.has(k) || inScope(k, rel)));
    if (!files.length) continue;
    found.add(k);
    testsInCode[planned.get(k) || e.id] = files.slice(0, CODE_TRACE_FILES_PER_ID);
  }
  return {
    planned: planned.size,
    testsInCode,
    plannedNotInCode: [...planned].filter(([k]) => !found.has(k) && !outside.has(k)).map(([, id]) => id),
    plannedOutsideCode: [...planned].filter(([k]) => outside.has(k)).map(([, id]) => id),
    inCodeNotInPlan: [...s.tids].filter(([k]) => found.has(k) && !planned.has(k) && !everyPlan.has(k)).map(([, e]) => e.id),
    acsInTests: [...requiredAcs].filter((id) => s.acs.has(id) && s.acs.get(id).files.some(counts)),
    scanned: s.scanned,
    truncated: s.truncated,
  };
}

// ---------------------------------------------------------------------------
// 1.14 F5 — requirements traceability matrix (RTM): trace_check {matrix} · `dev-spec trace <f> --matrix | --csv` ·
// spec_export {format: "csv"} (.specs/exports/<slug>.rtm.csv) · an RTM section in the stakeholder export
// ---------------------------------------------------------------------------
//
// ONE row per requirement ID of the feature — its US-n.AC-m criteria (document order), then its EC-n, NFR-n and SC-nnn IDs
// (trace_check's sets, read from requirements.md as it is active: a removed track's criteria are out, as in the export and
// the catalog). Nothing new is recorded: each column is what another tool already reads —
//   text        acOneLine (the whole criterion on one line, its ID and a _Supersedes:_ marker dropped); template = still
//               template text (placeholderReport; a secondary ID trace_check doesn't count as defined)
//   design      the `##` sections of design.md (a bugfix: bug.md + design.md, named by file as spec_impact names them) that
//               mention the ID — plus, for a [SEC] / [PRIVACY] criterion, that track's sections (the brief's rule)
//   tasks       the LINKED tasks: those whose own prose (never a fenced example) cites the ID, and those citing one of its
//               planned T-IDs — each with done, verified + its stable reason (taskVerification, the ONE verdict) and the
//               latest evidence record (command, exitCode, at, commit / dirty when `done --run` recorded them)
//   tests       the T-IDs of the test-plan entries that cite the ID (+tdd); with opts.code the test files naming each one
//               (traceTestCode: bounded, read-only; a T-ID run outside test code is flagged outsideCode)
//   decisions   the CURRENT decisions.md entries (not superseded) whose _Affects:_ names the ID
//   supersedes / supersededBy   this criterion's _Supersedes:_ targets / the other features' criteria replacing it
//   approval    the requirements approval (at, by, forced) and whether THIS row changed since (the approved snapshot's text
//               for the ID; an approval without a snapshot knows only whether the file changed: null = unknown)
// status (stable codes):
//   untraced    a trace gap names it — `gaps`: no-task (an AC no task cites), no-test (+tdd: an AC no test-plan line covers),
//               no-coverage (an EC / NFR no task or planned test covers; an SC no test-plan row or quickstart.md line) —
//               exactly trace_check's gaps and its secondary warnings for that ID
//   planned     traced, but no linked task is done yet — one is still open, or none is linked (a planned test only)
//   implemented every linked task is done, but one of them is not verified
//   verified    every linked task is done and verified (a task with no runnable _Verify:_ counts — nothingToVerify)
const RTM_STATUSES = ["verified", "implemented", "planned", "untraced"];
const RTM_KIND_ORDER = { ac: 0, ec: 1, nfr: 2, sc: 3 };
const RTM_TEXT_MAX = 1000; // characters of a criterion's one line (the matrix is bounded by the requirement count)
// "US-2.AC-10" → [2, 10] (the order an AC no criterion defines falls back to).
const acNums = (id) => (String(id).match(/\d+/g) || []).map(Number);
// Other features' _Supersedes:_ markers → Map(dirKey(target dir) + "\n" + AC → ["<feature>/<AC>" | "<feature>"]) — the
// catalog's rule, built once per call (the project export passes it to every feature). `.live` (a Set of the same keys):
// retired by at least one SHIPPED feature (featureShipped); a key outside it is only "to be superseded" (1.15). A feature
// archived without ever shipping (abandoned) declares nothing.
function supersededByIndex(projectDir) {
  const out = new Map();
  out.live = new Set();
  out.liveBy = new Map(); // key → the SHIPPED declarers only (a retired AC names those, never a draft's plan)
  const cache = new Map();
  const push = (m, k, who) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(who)) m.get(k).push(who); };
  for (const s of featureDirs(projectDir)) {
    const raw = readContained(projectDir, path.join(s.dir, "requirements.md"));
    if (!raw || !/_Supersedes:/i.test(raw)) continue;
    const state = stateFromFile(projectDir, statePath(s.dir));
    const shipped = featureShipped(state);
    if (s.archived && !shipped) continue;
    const shippedKeys = shipped ? shippedSupersedeKeys(projectDir, s.dir, state, raw, cache) : null;
    for (const v of resolveSupersedes(projectDir, s.dir, supersedesMarkers(raw), cache).valid) {
      const k = dirKey(v.dir) + "\n" + v.ac;
      const who = s.slug + (v.by ? "/" + v.by : "");
      push(out, k, who);
      if (shipped && (!shippedKeys || shippedKeys.has(k))) { out.live.add(k); push(out.liveBy, k, who); }
    }
  }
  return out;
}
// The _Supersedes:_ targets (dirKey + "\n" + AC) a SHIPPED feature actually shipped with — null when every current
// declaration counts: requirements.md is unchanged since the requirements snapshot approved at or before its latest ship
// (a finish or an execution sign-off), or there is no such snapshot (a pre-1.13 approval: trusted). A declaration a later
// change request added is only "to be superseded" until the feature ships again (the release notes list it then).
function shippedSupersedeKeys(projectDir, dir, state, reqRaw, cache) {
  const t = (v) => timeOf(v) || 0;
  const shipAt = Math.max(t(isObj(state.finished) ? state.finished.at : null), t(isRecord(state.approvals) && isRecord(state.approvals.execution) ? state.approvals.execution.at : null));
  if (!shipAt) return null;
  const hist = Array.isArray(state.approvalHistory) ? state.approvalHistory.filter((h) => isApprovalRecord(h) && h.phase === "requirements" &&
    typeof h.snapshot === "string" && timeOf(h.at) != null && timeOf(h.at) <= shipAt) : [];
  const rec = hist[hist.length - 1];
  if (!rec) return null;
  const text = historyText(dir, rec.snapshot);
  if (text == null || textFingerprint(text, "requirements") === textFingerprint(reqRaw || "", "requirements")) return null;
  return new Set(resolveSupersedes(projectDir, dir, supersedesMarkers(text), cache).valid.map((v) => dirKey(v.dir) + "\n" + v.ac));
}
// A feature that SHIPPED — a finish recorded, or its execution signed off (spec_changelog's rule). Only a shipped feature's
// _Supersedes:_ retires the older criterion in the catalog, the export and the matrix (1.15): a draft's declaration is
// "to be superseded" — the catalog says what the system does today.
function featureShipped(st) {
  return isObj(st) && (isObj(st.finished) || (isRecord(st.approvals) && isRecord(st.approvals.execution)));
}
// The latest evidence record of a task, as the matrix shows it (null = nothing recorded for it).
function rtmEvidence(rec) {
  if (!isRecord(rec)) return null;
  const o = {};
  for (const k of ["command", "exitCode", "at", "expected", "observed"]) if (rec[k] != null && typeof rec[k] !== "object") o[k] = rec[k]; // observed: 1.14 F1
  Object.assign(o, gitEvidence(rec));
  if (rec.exitCode == null && typeof rec.summary === "string" && rec.summary.trim()) o.note = oneLiner(rec.summary, 200);
  if (rec.stale === true) o.stale = true;
  return Object.keys(o).length ? o : null;
}
// traceMatrix for a resolved feature ({ slug, dir }). opts: code (+ scan: a scanTestCode() result or a function returning
// one), supBy (a supersededByIndex() result to reuse).
function buildTraceMatrix(projectDir, f, opts = {}) {
  const { slug, dir } = f;
  const lang = featureLang(projectDir, slug);
  const tracks = detectTracks(dir);
  const state = stateFromFile(projectDir, statePath(dir));
  const kind = state.kind === "bugfix" || state.kind === "spike" || state.kind === "change" ? state.kind : "feature";
  const read = (n) => readContained(projectDir, path.join(dir, n));
  // 1.21 review C1 / C5: a change's criteria are its change.md without the task blocks, and its plan approval (phase tasks)
  // signed them off — there is no requirements approval.
  const change = kind === "change";
  const fullReq = read("requirements.md") || "";
  const reqRaw = change ? changeViews(fullReq).criteria : fullReq;
  const reqs = activeDesign(reqRaw, tracks);
  const idx = requirementIndex(reqs);

  // The rows: trace_check's AC set (requirementAcIds) in document order, then the secondary IDs (trace's secondaryDefinitions).
  const rows = [];
  for (const id of requirementAcIds(reqs)) {
    const e = idx.get(id);
    rows.push({ id, key: id, kind: "ac", raw: e ? e.text : "", line: e ? e.line : Infinity });
  }
  rows.sort((a, b) => a.line - b.line || acNums(a.id)[0] - acNums(b.id)[0] || acNums(a.id)[1] - acNums(b.id)[1]);
  const sec = secondaryDefinitions(reqs);
  const secEntry = new Map();
  for (const [id, e] of idx) {
    const m = id.match(/^(EC|NFR|SC)-(\d+)$/);
    if (m && !secEntry.has(idKey(m[1], m[2]))) secEntry.set(idKey(m[1], m[2]), e);
  }
  const secRows = [...sec.all].map((k) => {
    const e = secEntry.get(k);
    return { id: sec.defined.get(k) || (e && e.id) || k, key: k, kind: k.slice(0, k.indexOf("-")).toLowerCase(), raw: e ? e.text : "", line: e ? e.line : Infinity, secTemplate: !sec.defined.has(k) };
  }).sort((a, b) => RTM_KIND_ORDER[a.kind] - RTM_KIND_ORDER[b.kind] || a.line - b.line);
  rows.push(...secRows);
  const cites = (row, acs, secIds) => (row.kind === "ac" ? acs.has(row.id) : secIds.has(row.key));

  // Tasks (the active ones — verificationStatus' view), each read once.
  const blocks = taskBlocks(activeTasks(read("tasks.md") || "", tracks) || "");
  const dups = new Set(duplicateTaskNumbers(blocks));
  const evidence = isRecord(state.evidence) ? state.evidence : {};
  const evMode = evidenceRule(projectDir); // 1.14 F1: the ONE verdict, in the project's evidence mode (unobserved under "observed")
  const tinfo = blocks.map((b) => {
    const prose = taskProse(b).join("\n");
    return { b, acs: extractAcIds(prose), sec: secondaryIds(prose), tids: new Set([...extractTestIds(prose)].map((t) => tKey(t.slice(2)))) };
  });
  const tasksAcs = new Set(tinfo.flatMap((t) => [...t.acs]));
  const tasksSec = new Set(tinfo.flatMap((t) => [...t.sec.keys()]));

  // The test plan (+tdd only — an inactive artifact otherwise, as trace_check reads it).
  const planOn = phaseActive("test-plan", tracks);
  const planRaw = planOn ? read("test-plan.md") || "" : "";
  const planText = planIdText(planRaw);
  const planAcs = extractAcIds(planText); // trace_check's uncoveredByTests set
  const entries = testPlanEntries(planRaw).map((e) => ({ ids: e.ids, acs: extractAcIds(e.text), sec: secondaryIds(e.text) }));
  const planSec = new Set(entries.flatMap((e) => [...e.sec.keys()]));
  const quickSec = secondaryIds(realLines(read("quickstart.md") || "", RE_SECONDARY_ID_LINE).join("\n"));
  let code = null;
  if (opts.code && planOn) code = traceTestCode(projectDir, dir, planText, requirementAcIds(reqs), opts.scan);
  const inCode = new Map(code ? Object.entries(code.testsInCode).map(([id, files]) => [tKey(id.slice(2)), files]) : []);
  const outside = new Set(code ? code.plannedOutsideCode.map((id) => tKey(id.slice(2))) : []);

  // Design sections (a bugfix: bug.md's and design.md's, named by file — spec_impact's keys), each scanned once.
  let dsecs = designSections(activeDesign(read("design.md") || "", tracks));
  if (kind === "bugfix") {
    const byFile = (name) => (s) => ({ ...s, title: `${name}: ${s.title}` });
    dsecs = designSections(read("bug.md") || "").map(byFile("bug.md")).concat(dsecs.map(byFile(PHASE_FILE.design)));
  }
  const dinfo = dsecs.map((s) => { const hay = s.title + "\n" + s.body; return { title: s.title, acs: extractAcIds(hay), sec: secondaryIds(hay) }; });
  const trackMarks = ["sec", "privacy", "dist", "api", "ui", "obs", "data", ...packTracks()].filter((tr) => tracks.includes(tr)).map((tr) => ({ marker: trackMarker(tr), acs: trackAcIds(reqs, tr) })); // + track packs (1.15)

  // decisions.md — the current entries (a later entry's _Supersedes: D-n_ retires D-n).
  const decRaw = read(DECISIONS_FILE);
  const log = decRaw == null ? [] : decisionLog(decRaw);
  const retired = retiredDecisions(log);
  const decs = log.filter((e) => !retired.has(e.id)).map((e) => {
    const acs = new Set();
    const secIds = new Set();
    for (const r of e.affects) {
      let m;
      if ((m = r.match(/^US-(\d+)\.AC-(\d+)$/i))) acs.add(`US-${m[1]}.AC-${m[2]}`);
      else if ((m = r.match(/^(EC|NFR|SC)-(\d+)$/i))) secIds.add(idKey(m[1].toUpperCase(), m[2]));
    }
    return { id: e.id, title: e.title, kind: e.kind, acs, secIds };
  });

  // _Supersedes:_ both ways.
  const own = resolveSupersedes(projectDir, dir, supersedesMarkers(reqs), new Map()).valid;
  const supBy = opts.supBy || supersededByIndex(projectDir);

  // The requirements approval, and per row whether its text changed since (the snapshot), or only whether the file did.
  const apPhase = change ? "tasks" : "requirements";
  const appr = isRecord(state.approvals) ? state.approvals[apPhase] : null;
  let approval = null;
  let rowChanged = () => null;
  if (isRecord(appr)) {
    approval = { at: typeof appr.at === "string" ? appr.at : null, by: appr.by == null ? null : String(appr.by), forced: appr.forced === true };
    if (appr.forced === true && Array.isArray(appr.failing)) approval.failing = appr.failing.filter((x) => typeof x === "string");
    const snap = latestSnapshot(dir, state, apPhase);
    if (snap) {
      const snapReq = change ? changeViews(snap.text).criteria : snap.text;
      const before = requirementIndex(snapReq);
      // (a change: the views' blank lines stand for task lines — a task added or moved is no change of the criteria)
      const cmp = (t) => (change ? t.split("\n").filter((l) => l.trim()).join("\n") : t);
      Object.assign(approval, { baseline: "snapshot", snapshot: snap.rel, changed: textFingerprint(cmp(reqRaw), "requirements") !== textFingerprint(cmp(snapReq), "requirements") });
      rowChanged = (row) => { const o = before.get(row.id); return !o || normWs(o.text) !== normWs(row.raw); };
    } else if (appr.fingerprint) {
      const changed = !fingerprintMatches(change ? fullReq : reqRaw, apPhase, appr.fingerprint);
      Object.assign(approval, { baseline: "fingerprint-only", changed });
      rowChanged = () => (changed ? null : false); // THAT the file changed, not which criterion
    } else Object.assign(approval, { baseline: "none", changed: null });
  }

  const out = rows.map((row) => {
    const tests = [];
    for (const e of entries) {
      if (!cites(row, e.acs, e.sec)) continue;
      for (const id of e.ids) if (!tests.some((t) => tKey(t.id.slice(2)) === tKey(id.slice(2)))) tests.push({ id });
    }
    if (code) for (const t of tests) {
      const k = tKey(t.id.slice(2));
      if (outside.has(k)) t.outsideCode = true;
      else t.files = inCode.get(k) || [];
    }
    const testKeys = new Set(tests.map((t) => tKey(t.id.slice(2))));
    const tasks = [];
    for (const t of tinfo) {
      const via = [];
      if (cites(row, t.acs, t.sec)) via.push(row.id);
      for (const tt of tests) if (t.tids.has(tKey(tt.id.slice(2)))) via.push(tt.id);
      if (!via.length) continue;
      const b = t.b;
      const dup = dups.has(b.number);
      const v = b.done ? taskVerification(evidence, b, dup, evMode) : { reason: null, nothingToVerify: false };
      const task = { number: b.number, text: oneLiner(cleanTaskText(b.text) || b.text, 200) || "", done: b.done, verified: b.done && v.reason == null, reason: b.done ? v.reason : null };
      if (b.done && v.nothingToVerify) task.nothingToVerify = true;
      task.cites = via;
      task.evidence = rtmEvidence(ownEvidence(evidence, b, dup));
      tasks.push(task);
    }
    const gaps = [];
    if (row.kind === "ac") {
      if (!tasksAcs.has(row.id)) gaps.push("no-task");
      if (planOn && !planAcs.has(row.id)) gaps.push("no-test");
    } else if (!row.secTemplate && (row.kind === "sc" ? !planSec.has(row.key) && !quickSec.has(row.key) : !tasksSec.has(row.key) && !planSec.has(row.key))) {
      gaps.push("no-coverage"); // a scaffold's untouched EC/NFR/SC row is no gap — trace_check warns about none (review R11)
    }
    const status = gaps.length ? "untraced" : !tasks.length || tasks.some((t) => !t.done) ? "planned" : tasks.some((t) => !t.verified) ? "implemented" : "verified";
    const design = dinfo.filter((d) => cites(row, d.acs, d.sec) || (row.kind === "ac" && trackMarks.some((m) => m.acs.has(row.id) && d.title.includes(m.marker)))).map((d) => d.title);
    const decisions = decs.filter((d) => (row.kind === "ac" ? d.acs.has(row.id) : d.secIds.has(row.key))).map((d) => ({ id: d.id, title: d.title, kind: d.kind }));
    const r = {
      id: row.id,
      kind: row.kind,
      text: acOneLine(row.raw, row.id, RTM_TEXT_MAX),
      template: row.kind === "ac" ? placeholderReport(row.raw).length > 0 : row.secTemplate === true,
      status,
      gaps,
      design,
      tasks,
      tests,
      decisions,
      supersedes: row.kind === "ac" ? own.filter((v) => v.by === row.id).map((v) => v.feature + "/" + v.ac) : [],
      supersededBy: row.kind === "ac" ? (supBy.get(dirKey(dir) + "\n" + row.id) || []).slice() : [],
      approval: approval ? { at: approval.at, by: approval.by, forced: approval.forced, changed: rowChanged(row) } : null,
    };
    // Declared only by features not shipped yet: "to be superseded", never retired (1.15 — supersededByIndex().live); a
    // retired AC names its shipped declarers only.
    const supKey = dirKey(dir) + "\n" + row.id;
    if (r.supersededBy.length && supBy.live && !supBy.live.has(supKey)) r.supersedePending = true;
    else if (r.supersededBy.length && supBy.liveBy && supBy.liveBy.has(supKey)) r.supersededBy = supBy.liveBy.get(supKey).slice();
    return r;
  });
  const counts = { rows: out.length, verified: 0, implemented: 0, planned: 0, untraced: 0, template: 0, superseded: 0, supersedePending: 0 };
  for (const r of out) {
    counts[r.status]++;
    if (r.template) counts.template++;
    if (r.supersededBy.length) counts[r.supersedePending ? "supersedePending" : "superseded"]++;
  }
  const res = { ok: true, feature: slug, lang, kind, tracks: trackLabel(tracks), approval, counts, rows: out };
  if (code) res.code = { scanned: code.scanned, truncated: code.truncated };
  return res;
}
// trace_check {matrix: true} / `dev-spec trace <f> --matrix`: the matrix of one feature (see above). opts.code: + the test
// files naming each planned T-ID (bounded walk; opts.scan reuses one).
function traceMatrix(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  return buildTraceMatrix(projectDir, f, opts);
}

// --- the matrix as CSV (RFC 4180) ---
// Records end with CRLF; a field holding a comma, a double quote, CR or LF is quoted (its quotes doubled). Formula
// injection guard (OWASP): a field starting with = + - @, a tab or a CR gets a leading apostrophe — a criterion written
// "=HYPERLINK(…)" or "@SUM(…)" is shown as text in Excel / LibreOffice / Sheets, never evaluated.
const RE_CSV_FORMULA = /^[=+\-@\t\r]/;
function csvCell(v) {
  let s = v == null ? "" : String(v);
  if (RE_CSV_FORMULA.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const csvRecord = (cells) => cells.map(csvCell).join(",") + "\r\n";
const RTM_CSV_COLS = ["feature", "id", "kind", "requirement", "status", "gaps", "template", "design", "tasks", "tests", "testFiles", "evidence", "decisions", "supersedes", "supersededBy", "approvedAt", "approvedBy", "changed"];
// One task of a row as words ("#3 done, not verified (latest run failed)"), in `lang`.
function rtmTaskWords(t, lang) {
  const R = i18n.msg(lang).rtm;
  if (!t.done) return R.task.open(t.number);
  if (t.verified) return t.nothingToVerify ? R.task.nothing(t.number) : R.task.verified(t.number);
  return R.task.unverified(t.number, i18n.msg(lang).evidenceGate.reason[t.reason] || t.reason || "");
}
function rtmEvidenceWords(t, lang) {
  const R = i18n.msg(lang).rtm;
  const e = t.evidence;
  if (e.exitCode == null) return R.evidenceNote(t.number, e.note || "—", e.at || null);
  return R.evidence(t.number, e.command || "—", e.exitCode, e.at || null, e.commit ? e.commit.slice(0, 12) + (e.dirty ? "-dirty" : "") : null, e.expected === "fail");
}
// matrices: traceMatrix results → the CSV text (header + one record per row; a Test files column when one was built with
// code). opts.document (spec_export): a UTF-8 BOM first — Excel reads a BOM-less CSV in the ANSI code page and mangles
// every accent — and a LAST record carrying the AUTO-GENERATED marker in its first cell ("# AUTO-GENERATED by dev-spec …",
// the other cells empty: the table stays rectangular, the header stays the first record a spreadsheet or a CSV reader
// takes as the column names, and `comment="#"` readers skip it); isGeneratedOrAbsent finds it in the file's tail.
// `dev-spec trace --csv` prints the data alone (no BOM, no marker record) for pipes and scripts.
function matrixCsv(matrices, lang, opts = {}) {
  const R = i18n.msg(lang).rtm;
  const withCode = matrices.some((m) => m && m.code);
  const cols = RTM_CSV_COLS.filter((c) => c !== "testFiles" || withCode);
  const yn = (v) => (v === true ? R.yes : v === false ? R.no : R.unknown);
  let out = (opts.document ? BOM_CHAR : "") + csvRecord(cols.map((c) => R.cols[c]));
  for (const m of matrices) {
    if (!m || !Array.isArray(m.rows)) continue;
    for (const r of m.rows) {
      const cell = {
        feature: m.feature,
        id: r.id,
        kind: r.kind.toUpperCase(),
        requirement: mdPlainText(r.text), // plain text: an escape / entity as the character (1.17 verification N3)
        status: R.status[r.status] || r.status,
        gaps: r.gaps.map((g) => R.gap[g === "no-coverage" && r.kind === "sc" ? "no-coverage-sc" : g] || g).join("; "),
        template: r.template ? R.yes : "",
        design: r.design.join("; "),
        tasks: r.tasks.map((t) => rtmTaskWords(t, lang)).join("; "),
        tests: r.tests.map((t) => t.id).join("; "),
        testFiles: r.tests.map((t) => `${t.id}: ${t.outsideCode ? R.outsideCode : t.files && t.files.length ? t.files.join(", ") : R.notInCode}`).join("; "),
        evidence: r.tasks.filter((t) => t.evidence).map((t) => rtmEvidenceWords(t, lang)).join("; "),
        decisions: r.decisions.map((d) => `${d.id} ${mdPlainText(d.title)}`).join("; "),
        supersedes: r.supersedes.join("; "),
        supersededBy: r.supersedePending ? R.toBeSupersededBy(r.supersededBy.join("; ")) : r.supersededBy.join("; "), // 1.15: pending reads apart
        approvedAt: r.approval ? r.approval.at || "" : "",
        approvedBy: r.approval ? (r.approval.by || "—") + (r.approval.forced ? ` (${R.forced})` : "") : "",
        changed: r.approval ? yn(r.approval.changed) : "",
      };
      out += csvRecord(cols.map((c) => cell[c]));
    }
  }
  if (opts.document) out += csvRecord(cols.map((c, k) => (k ? "" : "# " + R.autogen)));
  return out;
}

// --- the matrix in the stakeholder export (markdown → the export's escaping renderer) ---
const RTM_ICON = { verified: "✅", implemented: "⚠", planned: "☐", untraced: "✗" };
// A table cell: a '|' escaped, lines folded (mdCell), and an HTML comment opener neutralized — markdownToHtml drops
// <!-- … --> first, so an opener in one cell and a closer in a later one would swallow the cells between them.
const rtmCell = (s) => mdCell(s).replace(/<!--/g, "&lt;!--");
// The requirement's cell (the row's first text — only its ID before it, no backtick): an opener inside a code span stays as
// written (commentInert's rule — "escape `<!--` in names" showed `&lt;!--` in the export's code; 1.17 verification N3).
const rtmTextCell = (s) => inertOutsideCode(mdCell(s), false);
function rtmMarkdown(mx, lang) {
  const R = i18n.msg(lang).rtm;
  const code = (s) => "`" + s + "`";
  const lines = [italic(R.legend)];
  const a = mx.approval;
  const plan = mx.kind === "change"; // 1.21 review C5: a change's criteria are signed off with its plan (change.md)
  lines.push("", a ? (plan ? R.planApprovedLine : R.approvedLine)(utcStamp(a.at), a.by == null ? "—" : a.by, a.forced) : plan ? R.planNotApproved : R.notApproved);
  if (!mx.rows.length) return lines.concat(["", italic(R.none)]).join("\n");
  const cols = ["id", "requirement", "status", "design", "tasks", "tests", "decisions"].map((c) => R.cols[c]);
  lines.push("", `| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`);
  for (const r of mx.rows) {
    const notes = [];
    if (r.supersededBy.length) notes.push((r.supersedePending ? R.toBeSupersededBy : R.supersededBy)(r.supersededBy.map(code).join(", ")));
    if (r.supersedes.length) notes.push(i18n.msg(lang).stakeholderExport.supersedes(r.supersedes.map(code).join(", ")));
    if (r.template) notes.push(R.template);
    if (r.approval && r.approval.changed === true) notes.push(plan ? R.changedSincePlan : R.changedSince);
    const gaps = r.gaps.map((g) => R.gap[g === "no-coverage" && r.kind === "sc" ? "no-coverage-sc" : g] || g);
    const taskIcon = (t) => (!t.done ? "☐" : t.verified ? "✅" : "⚠");
    const cells = [
      r.supersededBy.length && !r.supersedePending ? `~~${r.id}~~` : r.id,
      rtmTextCell(r.text) + (notes.length ? " " + italic("(" + rtmCell(notes.join("; ")) + ")") : ""),
      `${RTM_ICON[r.status]} ${R.status[r.status]}` + (gaps.length ? " — " + rtmCell(gaps.join("; ")) : ""),
      r.design.length ? rtmCell(r.design.join("; ")) : "—",
      r.tasks.length ? r.tasks.map((t) => `#${t.number} ${taskIcon(t)}`).join(", ") : "—",
      r.tests.length ? r.tests.map((t) => t.id).join(", ") : "—",
      r.decisions.length ? rtmCell(r.decisions.map((d) => d.id).join(", ")) : "—",
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}
// The project document's per-feature status counts (active features with requirements).
function rtmProjectMarkdown(projectDir, lang, features) {
  const R = i18n.msg(lang).rtm;
  const supBy = supersededByIndex(projectDir);
  const rows = [];
  for (const f of features) {
    const mx = buildTraceMatrix(projectDir, f, { supBy });
    if (!mx.rows.length) continue;
    const c = mx.counts;
    rows.push(`| ${rtmCell(f.slug)} | ${c.rows} | ${c.verified} | ${c.implemented} | ${c.planned} | ${c.untraced} |`);
  }
  if (!rows.length) return italic(R.none);
  return [italic(R.projectLegend), "", `| ${R.projectCols.join(" | ")} |`, `|${R.projectCols.map(() => "---").join("|")}|`, ...rows].join("\n");
}

module.exports = { VAGUE_WORDS, VAGUE_RE, VAGUE_RE_ALL, RE_LIST_ITEM, RE_NUMBERED, RE_BLOCK_BREAK, B, E, RE_MODAL_EN,
  RE_MODAL_CAPS, RE_MODAL_SYSTEM, RE_LIST_DEFINES_AC, RE_MODAL, RE_MODAL_LOOSE, RE_AC_SHAPE, RE_AC_HEADING,
  RE_EARS_CAPS, RE_EARS_KEYWORD, RE_UBIQUITOUS, RE_STABLE_ID, RE_LEAD_DEFINES_AC, RE_CELL_AC, criterionBlocks,
  earsFeature, earsUnlinted, earsValidate, extractAcIds, extractTestIds, traceCheck, TRACE_INFO_FIELDS, TRACE_GAP_ORDER,
  TRACE_VERDICT_KINDS, TRACE_TASK_KINDS, TRACE_PLAN_KINDS, traceGaps, traceGapLines, TRACE_WARNING_ORDER,
  TRACE_SECONDARY_KINDS, traceWarnings, traceWarningLines, RE_SECONDARY_ID, RE_SECONDARY_ID_LINE, idKey, secondaryIds,
  secondaryDefinitions, traceSecondary, testPlanEntries, RE_CODE_TID, CODE_TRACE_CAP, CODE_TRACE_READ_CAP,
  CODE_TRACE_FILES_PER_ID, isTestCodePath, tKey, specFeatureDirs, scanTestCode,
  allPlannedTestKeys, RE_FILE_COLUMN, pathUnder, pathNames, scannableTestPath, nonCodeArtifactPath, codePathToken,
  planFileScopes, fileCellTokens, outsideCodeTemplates, otherPlanTestFiles, traceTestCode, RTM_STATUSES, RTM_KIND_ORDER,
  RTM_TEXT_MAX, acNums, supersededByIndex, shippedSupersedeKeys, featureShipped, rtmEvidence, buildTraceMatrix,
  traceMatrix, RE_CSV_FORMULA, csvCell, csvRecord, RTM_CSV_COLS, rtmTaskWords, rtmEvidenceWords, matrixCsv, RTM_ICON,
  rtmCell, rtmTextCell, rtmMarkdown, rtmProjectMarkdown, __link };

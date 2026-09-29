"use strict";

/**
 * dev-spec-driven engine — EARS linting.
 * Criterion blocks (lines folded into logical criteria first) and the EARS linter (EN / PT / ES keywords).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let atxHeading, commentLines, existingFeature, featureLang, indentOf, isWsUnit, placeholderReport, readIfExists,
  requirementAcIds, stripStart, tableCells;
function __link(E) { ({ atxHeading, commentLines, existingFeature, featureLang, indentOf, isWsUnit, placeholderReport,
  readIfExists, requirementAcIds, stripStart, tableCells } = E); }

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
  const text = readIfExists(path.join(f.dir, "requirements.md"));
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

module.exports = { VAGUE_WORDS, VAGUE_RE, VAGUE_RE_ALL, RE_LIST_ITEM, RE_NUMBERED, RE_BLOCK_BREAK, B, E, RE_MODAL_EN,
  RE_MODAL_CAPS, RE_MODAL_SYSTEM, RE_LIST_DEFINES_AC, RE_MODAL, RE_MODAL_LOOSE, RE_AC_SHAPE, RE_AC_HEADING,
  RE_EARS_CAPS, RE_EARS_KEYWORD, RE_UBIQUITOUS, RE_STABLE_ID, RE_LEAD_DEFINES_AC, RE_CELL_AC, criterionBlocks,
  earsFeature, earsUnlinted, earsValidate, __link };

"use strict";

/**
 * dev-spec-driven engine — spec_import kiro.
 * A Kiro spec (requirements.md / design.md / tasks.md) → the import model.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let clauseScanner, earsThen, firstParagraph, leftoverExtras, markRange, mdHeadings, mdListItems, mdRange,
  newImportModel, RE_MD_HR, RE_MODAL, stripHtmlComments, tidyLines, titleAfterDash, titleFromStory, trimClause,
  unusedLines;
function __link(E) { ({ clauseScanner, earsThen, firstParagraph, leftoverExtras, markRange, mdHeadings, mdListItems,
  mdRange, newImportModel, RE_MD_HR, RE_MODAL, stripHtmlComments, tidyLines, titleAfterDash, titleFromStory, trimClause,
  unusedLines } = E); }

// A Kiro criterion is usually EARS already ("WHEN … THEN the system SHALL …") — kept verbatim; a WHEN/IF … THEN
// without SHALL gets its response rewritten. A spec written in Portuguese / Spanish (QUANDO … ENTÃO … / CUANDO … ENTONCES …)
// the same way, in its language (full review Pb1: only the English keywords were read). Read as
// /^(WHEN|IF|WHILE|WHERE)\s+(.+?),?\s+THEN\s+(.+)$/i by clauseScanner (1.17 H): [lang, the condition keyword, THEN, …].
const KIRO_COND = [
  ["en", /(WHEN|IF|WHILE|WHERE)(?=\s)/iy, /THEN(?=\s)/iy, { when: "when", if: "if", while: "while", where: "where" }],
  ["pt", /(QUANDO|SE|ENQUANTO|ONDE)(?=\s)/iy, /ENT[ÃA]O(?=\s)/iy, { quando: "when", se: "if", enquanto: "while", onde: "where" }],
  ["es", /(CUANDO|SI|MIENTRAS|DONDE)(?=\s)/iy, /ENTONCES(?=\s)/iy, { cuando: "when", si: "if", mientras: "while", donde: "where" }],
];
function kiroCondMatch(S, t, head, thenRe) {
  const h = S.kwAt(head, 0);
  if (!h) return null;
  const C = S.memo((k) => S.thenAt(thenRe, k));
  const c = S.clause(h.end, S.lazyReader("kiro", C), C);
  return c ? [t, h.m[1], c.g, c.r] : null;
}
// Kiro's requirements.md headings in EN / PT / ES: the document title, "## Introduction", "## Requirements" and the story
// headings "### Requirement N" (PT/ES "Requisito N" — or a translated "História de Utilizador / Usuário N", "Historia de
// Usuario N"). The English forms read exactly as before; a PT/ES "## Requisitos" wrapper only when it is the whole heading
// ("## Requisitos Não Funcionais" is a section of its own, carried).
const RE_KIRO_REQ_TITLE = /^(?:requirements?(?:\s+document)?|(?:documento\s+de\s+)?requisitos)$/i;
const RE_KIRO_INTRO = /^(?:introduction\b|introdu[çc][ãa]o(?![\p{L}\p{N}_])|introducci[óo]n(?![\p{L}\p{N}_]))/iu;
const RE_KIRO_REQS = /^(?:requirements\b|requisitos\s*$)/i;
// A Kiro story heading → [text, word, number, title] | null — /^(requirement|…)\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i with the
// title read by a scan (the two \s* around the optional dash backtracked quadratically before a line break — 1.17 H).
const RE_KIRO_STORY_HEAD = /^(requirement|requisito|hist[óo]ria\s+de\s+(?:utilizador|usu[áa]rio)|historia\s+de\s+usuario)\s+(\d+)/i;
function kiroStoryHeading(text) {
  const h = RE_KIRO_STORY_HEAD.exec(text);
  const title = h && titleAfterDash(text, h[0].length);
  return title == null ? null : [text, h[1], h[2], title];
}
function earsFromKiro(text) {
  const t = String(text).trim();
  if (RE_MODAL.test(t)) return t;
  const S = clauseScanner(t);
  for (const [lng, head, thenRe, kws] of KIRO_COND) {
    const m = kiroCondMatch(S, t, head, thenRe);
    if (!m) continue;
    const E = i18n.msg(lng).importSpec.ears;
    const then = earsThen(m[3], lng, E);
    const kw = kws[m[1].toLowerCase()];
    return kw === "if" ? `${E.if} ${trimClause(m[2])}, ${E.then} ${then}` : `${E[kw]} ${trimClause(m[2])}, ${then}`;
  }
  return null;
}

// Kiro: .kiro/specs/<name>/ — requirements.md (### Requirement N, **User Story:**, #### Acceptance Criteria with
// numbered WHEN/THEN/SHALL items), design.md, tasks.md (- [ ] 1. / 2.1 with _Requirements: 1.1, 2.3_).
function parseKiro(dir, read, W) {
  const req = read(path.join(dir, "requirements.md"));
  const des = read(path.join(dir, "design.md"));
  const tasks = read(path.join(dir, "tasks.md"));
  if (req == null && tasks == null) return null;
  const model = newImportModel();
  model.nameHint = path.basename(dir);
  if (req != null) {
    const lines = stripHtmlComments(req).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    const h1 = hs.find((h) => h.level === 1);
    if (h1) used.add(h1.i);
    model.title = h1 && !RE_KIRO_REQ_TITLE.test(h1.text) ? h1.text : null;
    const introK = hs.findIndex((h) => RE_KIRO_INTRO.test(h.text));
    if (introK !== -1) used.add(hs[introK].i);
    const [sLo, sHi] = introK !== -1 ? mdRange(lines, hs, introK) : [h1 ? h1.i + 1 : 0, (hs.find((h) => h.level > 1) || { i: lines.length }).i];
    const sAt = [];
    model.summary = firstParagraph(lines.slice(sLo, sHi), sAt);
    sAt.forEach((r) => used.add(sLo + r)); // the rest of the introduction is carried verbatim
    hs.forEach((h, k) => {
      if (h.level === 2 && RE_KIRO_REQS.test(h.text)) { used.add(h.i); return; }
      const hm = kiroStoryHeading(h.text);
      if (!hm) return;
      // m = [, number, title] as the English form always had it; the heading's own word names the story in the mapping
      // ("Requisito 1") — English keeps "Requirement N" whatever its case.
      const m = [hm[0], hm[2], hm[3]];
      const word = /^requirement$/i.test(hm[1]) ? "Requirement" : hm[1].charAt(0).toUpperCase() + hm[1].slice(1).toLowerCase().replace(/\s+/g, " ");
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi); // prose, criteria AND what follows them are all written into the story
      const body = lines.slice(lo, hi);
      // "#### Acceptance Criteria" (or a bold "**Acceptance Criteria:**" label) opens the criteria.
      // (?=(\s+))\1: the heading's blanks taken whole — \s+.* rescanned a long blank run from each of its units (1.17 H).
      const acAt = body.findIndex((l) => /^\s*(?:#{1,6}(?=(\s+))\1|\*\*|__).*(?:acceptance criteria|crit[ée]rios de aceita|criterios de aceptaci)/i.test(l));
      const off = acAt === -1 ? 0 : acAt + 1;
      const acBody = body.slice(off);
      // Numbered criteria (Kiro's form); bulleted ones when there are none — but only under an explicit label, where
      // a bullet can't be a note in the story's prose.
      let items = mdListItems(acBody, true);
      if (!items.length && acAt !== -1) items = mdListItems(acBody, false);
      const inItem = new Set(items.flatMap((it) => it.at.map((r) => r + off)));
      const proseLines = tidyLines(body.slice(0, acAt === -1 ? body.length : acAt).filter((l, r) => !inItem.has(r) && !/^\s*#/.test(l)));
      // Anything under the label that is not a criterion (a note, a sub-heading, a table) follows the criteria.
      const after = acAt === -1 ? [] : tidyLines(acBody.filter((l, r) => !inItem.has(r + off) && !RE_MD_HR.test(l)));
      model.stories.push({
        printed: +m[1], key: `${word} ${m[1]}`, title: m[2].trim() || titleFromStory(proseLines) || `${word} ${m[1]}`, priority: null,
        prose: proseLines, quote: [], after,
        criteria: items.map((it, j) => ({ key: `${m[1]}.${it.n != null ? it.n : j + 1}`, raw: it.text, ears: earsFromKiro(it.text) })),
      });
    });
    if (!model.stories.length) model.warnings.push(W.wNoRequirements("requirements.md"));
    // Other top-level sections (Glossary, non-functional notes…) travel verbatim.
    hs.forEach((h, k) => {
      if (h.level !== 2 || RE_KIRO_INTRO.test(h.text) || RE_KIRO_REQS.test(h.text) || used.has(h.i)) return;
      const [lo, hi] = mdRange(lines, hs, k);
      const rest = unusedLines(lines, used, lo, hi);
      markRange(used, h.i, hi);
      if (tidyLines(rest).length) model.extra.push({ heading: "## " + h.text, lines: rest });
    });
    model.carried.push(...leftoverExtras(lines, hs, used)); // e.g. a ### Non-Functional Requirements under ## Requirements
  }
  if (des != null) model.design = { text: des, file: "design.md" };
  else model.warnings.push(W.wNoDesign("design.md"));
  if (tasks != null) model.tasks = { text: tasks, file: "tasks.md" };
  else model.warnings.push(W.wNoTasks);
  return model;
}

module.exports = { KIRO_COND, kiroCondMatch, RE_KIRO_REQ_TITLE, RE_KIRO_INTRO, RE_KIRO_REQS, RE_KIRO_STORY_HEAD,
  kiroStoryHeading, earsFromKiro, parseKiro, __link };

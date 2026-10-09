"use strict";

/**
 * dev-spec-driven engine — spec_import bmad.
 * A BMAD PRD + stories → the import model.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let checkboxUnits, closesFence, earsFromPlanText, firstParagraph, isWsUnit, leftoverExtras, markRange, mdHeadings,
  mdListItems, mdRange, newImportModel, planDone, planHeadingText, planPaths, planTaskLines, plusAfterBlanks, RE_FENCE,
  RE_MD_HR, safeReaddir, shortTitle, stripEnd, stripHtmlComments, tidyLines, titleAfterDash, toPosix, unitProse,
  unusedLines;
function __link(E) { ({ checkboxUnits, closesFence, earsFromPlanText, firstParagraph, isWsUnit, leftoverExtras,
  markRange, mdHeadings, mdListItems, mdRange, newImportModel, planDone, planHeadingText, planPaths, planTaskLines,
  plusAfterBlanks, RE_FENCE, RE_MD_HR, safeReaddir, shortTitle, stripEnd, stripHtmlComments, tidyLines, titleAfterDash,
  toPosix, unitProse, unusedLines } = E); }

// Headings whose whole section is already imported (every line used, blank, or a heading marked so) — marked used too, so
// leftoverExtras never carries an empty "## Requirements" wrapping the FR / NFR lines it read. Bottom-up: a parent follows its children.
function markEmptyHeadings(lines, hs, used) {
  for (let k = hs.length - 1; k >= 0; k--) {
    if (used.has(hs[k].i)) continue;
    const [lo, hi] = mdRange(lines, hs, k);
    let empty = true;
    for (let i = lo; i < hi && empty; i++) if (!used.has(i) && lines[i].trim() && !RE_MD_HR.test(lines[i])) empty = false;
    if (empty) used.add(hs[k].i);
  }
}

// bmad — BMAD-METHOD docs (v4 docs/…, v6 _bmad-output/…): see the block comment above.
// 1.17 H — the heads below are read by a regex up to their separator, the text after it by a scan: their \s*…\s*(.*)$ tails
// rescanned a long blank run from each blank they gave back.
// /^(?:story\s+)?(\d+)\.(\d+)\s*(?:[:.\-–—]\s*)?(.*)$/i → [text, epic, story, title] | null
const RE_BMAD_STORY_START = /^(?:story\s+)?(\d+)\.(\d+)/i;
function bmadStoryHead(text) {
  const h = RE_BMAD_STORY_START.exec(text);
  const title = h && titleAfterDash(text, h[0].length);
  return title == null ? null : [text, h[1], h[2], title];
}
// A PRD title without its "Product Requirements Document" / "(PRD)" / "PRD" words and the separator they leave at either end:
// text.replace(/\s*(?:product requirements document|\(prd\)|prd)\s*/gi, " ").replace(/^\s*[:—–-]\s*|\s*[:—–-]\s*$/g, ""), by a
// scan (a blank run was rescanned from each of its units). A word's blanks: the run before it (from where the last match
// ended at most) and the one after it.
const RE_PRD_WORDS = /product requirements document|\(prd\)|prd/gi;
function bmadPrdTitle(text) {
  let out = "", at = 0;
  RE_PRD_WORDS.lastIndex = 0;
  for (let m; (m = RE_PRD_WORDS.exec(text));) {
    let p = m.index, e = p + m[0].length;
    while (p > at && isWsUnit(text[p - 1])) p--;
    while (e < text.length && isWsUnit(text[e])) e++;
    out += text.slice(at, p) + " ";
    at = RE_PRD_WORDS.lastIndex = e;
  }
  const s = out + text.slice(at);
  const lead = /^\s*[:—–-]\s*/.exec(s);
  const from = lead ? lead[0].length : 0;
  const end = stripEnd(s, isWsUnit).length;
  if (end <= from || !":—–-".includes(s[end - 1])) return s.slice(from);
  let p = end - 1;
  while (p > from && isWsUnit(s[p - 1])) p--;
  return s.slice(from, p);
}
// /^story\s+(\d+)\.(\d+)\s*[:.\-–—]?\s*(.*)$/i → [text, epic, story, title] | null
const RE_BMAD_EPIC_STORY_START = /^story\s+(\d+)\.(\d+)/i;
function bmadEpicStory(text) {
  const h = RE_BMAD_EPIC_STORY_START.exec(text);
  const title = h && titleAfterDash(text, h[0].length);
  return title == null ? null : [text, h[1], h[2], title];
}
// /^\s*(?:[-*+]|\d+[.)])?\s*(?:\*\*|__)?(N?FR)[-\s]?(\d+)(?:\*\*|__)?\s*[:.\-–—]\s*(?:\*\*|__)?\s*(.+)$/i → [line, kind, n, text] | null
const RE_BMAD_FR_HEAD = /^\s*(?:(?:[-*+]|\d+[.)])\s*)?(?:\*\*|__)?(N?FR)[-\s]?(\d+)(?:\*\*|__)?\s*[:.\-–—]/i;
function bmadFrLine(l) {
  const h = RE_BMAD_FR_HEAD.exec(l);
  if (!h) return null;
  const text = boldThenText(l, h[0].length);
  return text == null ? null : [l, h[1], h[2], text];
}
// /^#{1,6}\s+(N?FR)[-\s]?(\d+)\s*[:.\-–—]\s*(.+)$/i → [line, kind, n, text] | null
const RE_BMAD_FR_HEADING = /^#{1,6}\s+(N?FR)[-\s]?(\d+)\s*[:.\-–—]/i;
function bmadFrHeading(l) {
  const h = RE_BMAD_FR_HEADING.exec(l);
  const text = h && plusAfterBlanks(l, h[0].length);
  return text == null ? null : [l, h[1], h[2], text];
}
// \s*(?:\*\*|__)?\s*(.+)$ from p: with the bold marker first, then without it.
function boldThenText(s, p) {
  let w = p;
  while (w < s.length && isWsUnit(s[w])) w++;
  const b = s.startsWith("**", w) || s.startsWith("__", w) ? plusAfterBlanks(s, w + 2) : null;
  return b != null ? b : plusAfterBlanks(s, p);
}
const RE_BMAD_WORKFLOW = /^(?:change log|changelog|status)$/i; // BMAD's own workflow records — named in a warning, not imported
const RE_BMAD_PRD_DESIGN = /^(?:technical assumptions|user interface design goals)\b/i;
function parseBmad(dir, read0, W, src) {
  const P = i18n.msg(src.lang).importPlans;
  const seen = new Map(); // each file read once (a story file is read to recognise it, then to parse it)
  const read = (f) => { if (!seen.has(f)) seen.set(f, read0(f)); return seen.get(f); };
  const isDir = (p) => { try { const st = fs.lstatSync(p); return st.isDirectory() && !st.isSymbolicLink(); } catch { return false; } };
  const isFile = (p) => { try { return fs.lstatSync(p).isFile(); } catch { return false; } };
  const mdIn = (d) => (isDir(d) ? safeReaddir(d).filter((n) => /\.md$/i.test(n) && isFile(path.join(d, n))).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).map((n) => path.join(d, n)) : []);
  const bases = [dir, path.join(dir, "docs"), path.join(dir, "_bmad-output", "planning-artifacts"), path.join(dir, "planning-artifacts")];
  const first = (names) => { for (const b of bases) for (const n of names) if (isFile(path.join(b, n))) return path.join(b, n); return null; };
  const isStoryText = (t) => /^#\s+(?:story\s+)?\d+\.\d+\b/im.test(t || "");
  let prdFiles = [], storyFiles = [], epicsFile = null, archFile = null;
  const skipped = [];
  if (src.file) {
    const t = read(src.file);
    if (t == null) return null;
    if (isStoryText(t) && !/^[^\S\n\r\u2028\u2029]*(?:[-*+]\s*)?(?:\*\*)?N?FR-?\d+/im.test(t)) storyFiles = [src.file];
    else { prdFiles = [src.file]; storyFiles = mdIn(path.join(dir, "stories")).filter((f) => isStoryText(read(f))); }
  } else {
    const prd = first(["prd.md", "PRD.md"]);
    if (prd) prdFiles = [prd];
    else for (const b of bases) { const sh = mdIn(path.join(b, "prd")); if (sh.length) { prdFiles = sh.sort((a, b2) => (/index\.md$/i.test(a) ? -1 : /index\.md$/i.test(b2) ? 1 : 0)); break; } }
    epicsFile = first(["epics.md"]);
    archFile = first(["architecture.md"]);
    for (const b of bases) if (!archFile && isDir(path.join(b, "architecture")) && mdIn(path.join(b, "architecture")).length) skipped.push(toPosix(path.relative(src.root, path.join(b, "architecture"))) + "/");
    for (const d of [path.join(dir, "stories"), path.join(dir, "docs", "stories"), path.join(dir, "_bmad-output", "implementation-artifacts"), path.join(dir, "implementation-artifacts"), dir]) {
      const found = mdIn(d).filter((f) => isStoryText(read(f)));
      if (found.length) { storyFiles = found; break; }
    }
  }
  if (!prdFiles.length && !storyFiles.length && !epicsFile) return null;
  const model = newImportModel();
  model.nameHint = path.basename(dir) === "docs" ? path.basename(path.dirname(dir)) : path.basename(dir);
  model.skipped = skipped;
  const stories = new Map(); // "E.S" → { e, s, title, prose, acs: [{n, raw}], tasks: {lines, units} | null, design: [], file }
  const workflow = new Map(); // BMAD's workflow records (Status, Change Log) → the documents they were found in
  const addWorkflow = (t, where) => { const k = /^status$/i.test(t) ? "Status" : t; if (!workflow.has(k)) workflow.set(k, []); if (!workflow.get(k).includes(where)) workflow.get(k).push(where); };
  const designParts = [];
  // A story's criteria items ("1: text" / "1. text" / "- text"; a BDD block's bold title dropped) → [{ n, raw }].
  const acItems = (body) => mdListItems(body.map((l) => l.replace(/^(\s*)(\d+)\s*:\s/, "$1$2. ")), false).map((it) => ({
    n: it.n, raw: it.text.replace(/^(?:\*\*|__)?AC\s*(?:#\s*)?(\d+)(?:\*\*|__)?\s*[:.\-–—]\s*/i, "").trim(),
  }));
  const acEars = (raw) => {
    const t = raw.replace(/^(?:\*\*|__)[^*_]+(?:\*\*|__)\s*(?=(?:\*\*|__)?(?:given|when|dad[oa]|quando|cuando)\b)/i, "");
    return earsFromPlanText(t);
  };
  // PRD text(s) → title, summary, FR/NFR, stories (from its epics), carried sections.
  const prdText = prdFiles.map((f) => read(f)).filter((t) => t != null).join("\n\n");
  const epicsText = epicsFile ? read(epicsFile) : null;
  for (const [txt, isPrd] of [[prdText, true], [epicsText, false]]) {
    if (!txt) continue;
    const lines = stripHtmlComments(txt).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    if (!isPrd && hs.length && hs[0].level === 1) used.add(hs[0].i); // epics.md's own title
    if (isPrd) {
      const h1 = hs.find((h) => h.level === 1);
      if (h1) { used.add(h1.i); model.title = bmadPrdTitle(h1.text).trim() || null; }
      const sk = hs.findIndex((h) => /^(?:background context|vision|1\.\s*vision)\b/i.test(planHeadingText(h.text)));
      const [lo, hi] = sk !== -1 ? [hs[sk].i + 1, sk + 1 < hs.length ? hs[sk + 1].i : lines.length] : [h1 ? h1.i + 1 : 0, (hs.find((h) => h.level > 1) || { i: lines.length }).i];
      const at = [];
      model.summary = firstParagraph(lines.slice(lo, hi), at);
      at.forEach((r) => used.add(lo + r));
      // FR / NFR: list lines ("- FR1: …", "**NFR2**: …") and v6 headings ("#### FR-1: name" + its first paragraph).
      const fr = [], nfr = [];
      let fence = null;
      lines.forEach((l, i) => {
        if (fence) { if (closesFence(l, fence)) fence = null; return; }
        const f = l.match(RE_FENCE);
        if (f) { fence = f[1]; return; }
        const hm = bmadFrHeading(l);
        const m = hm || (!/^\s*#/.test(l) && bmadFrLine(l));
        if (!m) return;
        const kind = m[1].toUpperCase();
        let txt2 = m[3].replace(/(?:\*\*|__)\s*$/, "").trim();
        used.add(i);
        if (hm) {
          const k = hs.findIndex((h) => h.i === i);
          const body = [];
          for (let j = i + 1; j < (k + 1 < hs.length ? hs[k + 1].i : lines.length); j++) body.push(j);
          const at2 = [];
          const para = firstParagraph(body.map((j) => lines[j]), at2);
          if (para) { txt2 += " — " + para; at2.forEach((r) => used.add(body[r])); }
        }
        const id = `${kind}-${+m[2]}`;
        model.mapping[(l.match(/N?FR[-\s]?\d+/i) || [id])[0].toUpperCase().replace(/\s+/, "")] = id; // "FR1" → "FR-1" (as written → dev-spec's form)
        (kind === "NFR" ? nfr : fr).push(`- **${id}** — ${txt2}`);
      });
      if (fr.length) model.extra.push({ key: "functional", lines: fr });
      if (nfr.length) model.extra.push({ heading: P.nonFunctional, lines: nfr });
    }
    // Stories: "### Story 1.1 Title" (v4 PRD epic sections), "### Story 1.1: Title" (v6 epics.md).
    hs.forEach((h, k) => {
      const m = bmadEpicStory(planHeadingText(h.text));
      if (!m) return;
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi);
      const body = lines.slice(lo, hi);
      // /^\s*(?:#{1,6}\s+|\*\*|__)?\s*acceptance criteria/i as \s*(?:(?:#{1,6}\s|\*\*|__)\s*)? (the same lines): blank runs meeting
      // around an absent marker backtracked quadratically (1.17 H)
      const acAt = body.findIndex((l) => /^\s*(?:(?:#{1,6}\s|\*\*|__)\s*)?acceptance criteria/i.test(l));
      const prose = tidyLines(body.slice(0, acAt === -1 ? body.length : acAt).filter((l) => !/^\s*#/.test(l)));
      const acs = acAt === -1 ? [] : acItems(body.slice(acAt + 1));
      const key = `${+m[1]}.${+m[2]}`;
      if (!stories.has(key)) stories.set(key, { e: +m[1], s: +m[2], title: m[3].trim() || `Story ${key}`, prose, acs, tasks: null, design: [], from: "prd" });
    });
    // PRD sections: design-level ones → design.md; BMAD's change log → a warning; the rest → carried into requirements.md.
    hs.forEach((h, k) => {
      if (used.has(h.i)) return;
      const t = planHeadingText(h.text);
      const [lo, hi] = mdRange(lines, hs, k);
      if (isPrd && RE_BMAD_PRD_DESIGN.test(t)) { designParts.push("## " + t, ...unusedLines(lines, used, lo, hi)); markRange(used, h.i, hi); }
      else if (RE_BMAD_WORKFLOW.test(t)) { addWorkflow(t, isPrd ? "PRD" : "epics.md"); markRange(used, h.i, hi); }
    });
    markEmptyHeadings(lines, hs, used); // "## Requirements" whose FR / NFR lines were all read carries nothing
    model.carried.push(...leftoverExtras(lines, hs, used, isPrd ? "" : "epics: "));
  }
  // Story files: # Story 1.1: Title · Status · Story · Acceptance Criteria · Tasks / Subtasks · Dev Notes (+ Testing) · Change Log ·
  // Dev Agent Record · QA Results — the file wins over the PRD's copy of the same story.
  for (const file of storyFiles) {
    const txt = read(file);
    if (txt == null) continue;
    const lines = stripHtmlComments(txt).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const h1 = hs.find((h) => h.level === 1);
    const m = h1 && bmadStoryHead(planHeadingText(h1.text));
    if (!m) continue;
    const key = `${+m[1]}.${+m[2]}`;
    const st = { e: +m[1], s: +m[2], title: m[3].trim() || `Story ${key}`, prose: [], acs: [], tasks: null, design: [], from: toPosix(path.relative(src.root, file)) };
    const top = hs.filter((h) => h.level === 2);
    // Before the first section: v6's "Status: ready-for-dev" line (a workflow record); any other text → the story's design notes.
    const intro = lines.slice(h1.i + 1, top.length ? top[0].i : lines.length);
    if (intro.some((l) => /^\s*status\s*:/i.test(l))) addWorkflow("Status", key);
    const introRest = tidyLines(intro.filter((l) => !/^\s*status\s*:/i.test(l)));
    if (introRest.length) st.design.push("", ...introRest);
    for (const h of top) {
      const k = hs.indexOf(h);
      const t = planHeadingText(h.text);
      const [lo, hi] = mdRange(lines, hs, k);
      const body = lines.slice(lo, hi);
      if (/^(?:story|user story)$/i.test(t)) st.prose = tidyLines(body.filter((l) => !/^\s*#/.test(l)).map((l) => l.replace(/\*\*(as an?|i want|so that)\*\*/gi, "$1")));
      else if (/^acceptance criteria$/i.test(t)) st.acs = acItems(body);
      else if (/^tasks?\s*(?:(?:\/|&|and)\s*)?(?:subtasks?)?$/i.test(t)) st.tasks = { lines, lo, hi };
      else if (RE_BMAD_WORKFLOW.test(t)) addWorkflow(t, key);
      else if (tidyLines(body).length) st.design.push("", `### ${t}`, ...tidyLines(body.map((l) => l.replace(/^(#{1,4})(\s)/, "#$1$2"))));
    }
    stories.set(key, st);
  }
  const ordered = [...stories.values()].sort((a, b) => a.e - b.e || a.s - b.s);
  const out = [];
  const keys = [];
  ordered.forEach((st, idx) => {
    const n = idx + 1;
    const key = `Story ${st.e}.${st.s}`;
    const byNumber = new Map(); // the printed AC number a task's (AC: …) cites → the new AC ID
    const criteria = st.acs.map((a, j) => {
      const id = `US-${n}.AC-${j + 1}`;
      if (a.n != null && !byNumber.has(a.n)) byNumber.set(a.n, id);
      if (!byNumber.has(j + 1) && a.n == null) byNumber.set(j + 1, id);
      return { key: `${key} / AC ${a.n != null ? a.n : j + 1}`, raw: a.raw, ears: acEars(a.raw) };
    });
    model.stories.push({ printed: null, key, title: st.title, priority: null, prose: st.prose, quote: [], after: [], criteria });
    if (st.design.length) designParts.push("", `## US-${n}: ${st.title}`, ...st.design);
    if (!st.tasks) return;
    const units = checkboxUnits(st.tasks.lines, st.tasks.lo, st.tasks.hi);
    if (!units.length) return;
    out.push("", `## US-${n}: ${st.title}`);
    // 1.22 review — BMAD writes the (AC: n) references on a task, not on each of its subtasks: a nested unit that names none
    // of its own carries its parent's (the nearest unit above it with a smaller indent; a grandchild its inherited ones).
    const parents = []; // [{ indent, req }] the open units above the current one
    units.forEach((u, j) => {
      while (parents.length && parents[parents.length - 1].indent >= u.indent) parents.pop();
      // /\(\s*ACs?\s*[:#]?\s*([^)]*)\)/i, read up to the last ')' (no match can end later: each "(AC" rescanned the rest of a
      // text with no ')' after it) with \s*(?:[:#]\s*)? (blank runs meeting with no ':' / '#' between them) — 1.17 H.
      const refM = u.text.slice(0, u.text.lastIndexOf(")") + 1).match(/\(\s*ACs?\s*(?:[:#]\s*)?([^)]*)\)/i);
      // "(AC: 1, 3)", "(AC #2)", "(ACs: 1-3)" — a range is every number in it (bounded: a typo like 1-9999 is not expanded)
      const nums = refM ? (refM[1].match(/\d+\s*[-–]\s*\d+|\d+/g) || []).flatMap((x) => {
        const r = x.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        return r && +r[2] >= +r[1] && +r[2] - +r[1] < 50 ? Array.from({ length: +r[2] - +r[1] + 1 }, (_, q) => +r[1] + q) : (x.match(/\d+/g) || []).map(Number);
      }) : [];
      const req = [], unknown = [];
      nums.forEach((x) => { if (byNumber.has(x)) { if (!req.includes(byNumber.get(x))) req.push(byNumber.get(x)); } else unknown.push(x); });
      if (unknown.length) model.warnings.push(P.wUnknownAc(key, shortTitle(u.text, 40), unknown.join(", ")));
      if (!refM && parents.length) req.push(...parents[parents.length - 1].req);
      parents.push({ indent: u.indent, req: req.slice() });
      const text = refM && !unknown.length ? u.text.replace(refM[0], "").replace(/\s{2,}/g, " ").trim() : u.text;
      const label = (u.text.match(/^(?:sub)?task\s+[\d.]+/i) || [`item ${j + 1}`])[0];
      out.push(...planTaskLines(st.tasks.lines, u, { done: planDone(u.box), tag: `[US${n}]`, text: text.replace(/^\[US\d+\]\s*/, ""), req, paths: planPaths(unitProse(st.tasks.lines, u)) }));
      keys.push(`${key} / ${label}`);
    });
  });
  if (!ordered.length) model.warnings.push(W.wNoRequirements(prdFiles.concat(epicsFile ? [epicsFile] : []).map((f) => toPosix(path.relative(src.root, f))).join(", ") || "."));
  if (out.length) { model.tasks = { text: out.join("\n"), file: "Tasks / Subtasks" }; model.taskKeys = keys; }
  else model.warnings.push(W.wNoTasks);
  if (workflow.size) model.warnings.push(P.wWorkflow([...workflow].map(([t, where]) => `${t} (${where.join(", ")})`).join(", ")));
  const arch = archFile ? read(archFile) : null;
  const design = [arch != null ? arch.trimEnd() : null, ...(designParts.length ? ["", ...designParts] : [])].filter((x) => x != null);
  if (tidyLines(design).length) model.design = { text: tidyLines(design).join("\n"), file: archFile ? path.basename(archFile) : "Dev Notes" };
  else model.warnings.push(W.wNoDesign("architecture.md"));
  model.nameFallback = model.nameHint; // the folder's name: for a title that slugifies to nothing (importSpec, 1.22 review)
  if (model.title) model.nameHint = model.title; // the product's name, not "docs"
  if (storyFiles.length === 1 && !prdFiles.length && ordered.length === 1) {
    model.sourceFile = storyFiles[0];
    model.nameHint = ordered[0].title;
    model.nameFallback = path.basename(storyFiles[0]).replace(/\.md$/i, "");
  }
  return model;
}

module.exports = { parseBmad, __link };

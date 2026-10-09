"use strict";

/**
 * dev-spec-driven engine — markdown readers and template placeholders.
 * The ONE reader of HTML comments (commentLines), fences (closesFence / fenceStep), headings and sections
 * (headingIndex, headingMatches, extractSection), the artifact ID readers built on them (requirementAcIds, planIdText),
 * and what a scaffold still waits for: the template corpus (a lookup, never a guess from the shape), the bracket scan,
 * artifact states and the per-artifact / per-chain placeholder views the gates read.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
const { MARKER_TRACKS } = require("./tracks.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeSectionTracks, atxHeading, backtickRuns, chainArtifacts, codeSpans, detectTracks, dirKey, existingFeature, extractAcIds,
  featureFlow, flowPhaseIndex, FOLD_CASE, hasOutsideCode, inactiveMarkerLines, inactiveTaskLines, indentOf, isPackMarkerBracket,
  locateFeatures, markerTracks, OPTIONAL_TRACKS, packDesignBlock, packRegistry, parseTasks, projectTemplateHas, RE_THEMATIC_BREAK, readIfExists, renderTrackTaskHeadings,
  replaceCodeSpans, stripSupersedes, TASK_HEADINGS, taskDescription, trackLabel, trackMarker, TRACK_OVERLAPS, useTemplateScopeOf,
  VALID_TRACKS, wildcardMatch;
function __link(E) { ({ activeSectionTracks, atxHeading, backtickRuns, chainArtifacts, codeSpans, detectTracks, dirKey, existingFeature,
  extractAcIds, featureFlow, flowPhaseIndex, FOLD_CASE, hasOutsideCode, inactiveMarkerLines, inactiveTaskLines, indentOf,
  isPackMarkerBracket, locateFeatures, markerTracks, OPTIONAL_TRACKS, packDesignBlock, packRegistry, parseTasks, projectTemplateHas, RE_THEMATIC_BREAK, readIfExists,
  renderTrackTaskHeadings, replaceCodeSpans, stripSupersedes, TASK_HEADINGS, taskDescription, trackLabel, trackMarker, TRACK_OVERLAPS,
  useTemplateScopeOf, VALID_TRACKS, wildcardMatch } = E); }

// The text minus its HTML comments (commentLines' reading: a "<!--" in fenced code or an inline code span is text, one
// that never closes is text). A comment spanning lines takes its line breaks with it, as the old regex did.
function stripHtmlComments(s) {
  const text = String(s || "");
  if (!text.includes("<!--")) return text;
  const lines = text.split("\n");
  const cl = commentLines(lines);
  let out = "";
  cl.forEach((c, i) => {
    if (c.hidden) return;
    out += c.vis;
    if (!c.open && i < lines.length - 1) out += "\n";
  });
  return out;
}
// HTML comments as a markdown reader sees them, line by line — the ONE comment rule of stripHtmlComments, criterionBlocks
// and visibleLines (the tasks scanner, scanTaskLines, adds its own list-item / paragraph reach). Fenced code (fenceStep)
// and inline code spans are code: a "<!--" there is text (1.14 full review Pa3 — an AC saying "contains `<!--`" hid every
// criterion down to the next "-->" from EARS, trace_check and the placeholder scan). A "<!--" outside code opens a
// comment only when a "-->" outside code follows it, on its line or a later one (one that never closes is text); an open
// comment ends at the first "-->", whatever it sits in (inside a comment nothing is code). Linear.
// lines: the text split on "\n" (a trailing "\r" is harmless). → per line { vis, fence, hidden, open }: vis = the line
// minus its comments; fence = fenceStep's verdict ("open" | "code" | null — a fence line keeps vis = the line); hidden =
// the line lies wholly inside a comment; open = a comment is still open at its end.
function commentLines(lines) {
  const n = lines.length;
  let closerAfter = null; // closerAfter[i]: a "-->" outside fenced code and code spans on a line after i
  const later = (i) => {
    if (!closerAfter) {
      const pre = { fence: null };
      const has = lines.map((l) => !fenceStep(pre, l) && l.includes("-->") && hasOutsideCode(l, "-->"));
      closerAfter = new Array(n).fill(false);
      for (let j = n - 2; j >= 0; j--) closerAfter[j] = has[j + 1] || closerAfter[j + 1];
    }
    return closerAfter[i];
  };
  const out = [];
  const st = { fence: null };
  let comment = false;
  for (let i = 0; i < n; i++) {
    const raw = lines[i];
    let k = 0;
    if (comment) {
      const end = raw.indexOf("-->");
      if (end === -1) { out.push({ vis: "", fence: null, hidden: true, open: true }); continue; }
      comment = false;
      k = end + 3;
    } else {
      const fl = fenceStep(st, raw);
      if (fl) { out.push({ vis: raw, fence: fl, hidden: false, open: false }); continue; }
    }
    let lt = raw.indexOf("<!--", k);
    if (lt === -1) { out.push({ vis: k ? raw.slice(k) : raw, fence: null, hidden: false, open: false }); continue; }
    const ticks = backtickRuns(raw);
    let closers = null; // this line's "-->" outside code spans, ascending
    const closesOnLine = (from) => {
      if (!closers) {
        closers = [];
        const t2 = backtickRuns(raw);
        for (let q = 0; q < raw.length;) {
          if (raw[q] === "`") q = t2.spanEnd(q);
          else if (raw.startsWith("-->", q)) { closers.push(q); q += 3; } else q++;
        }
      }
      return closers.length > 0 && closers[closers.length - 1] >= from;
    };
    let vis = "";
    let bt = raw.indexOf("`", k);
    while (k < raw.length) {
      if (comment) {
        const end = raw.indexOf("-->", k);
        if (end === -1) { k = raw.length; break; }
        comment = false;
        k = end + 3;
        continue;
      }
      if (bt !== -1 && bt < k) bt = raw.indexOf("`", k);
      if (lt !== -1 && lt < k) lt = raw.indexOf("<!--", k);
      if (lt === -1) { vis += raw.slice(k); break; }
      if (bt !== -1 && bt < lt) { const e = ticks.spanEnd(bt); vis += raw.slice(k, e); k = e; continue; } // a code span: text
      if (closesOnLine(lt + 4) || later(i)) { vis += raw.slice(k, lt); comment = true; } else vis += raw.slice(k, lt + 4);
      k = lt + 4;
    }
    out.push({ vis, fence: null, hidden: false, open: comment });
  }
  return out;
}
// Fenced code blocks blanked line for line (the fence lines too) — criterionBlocks' fence rule, so an ID in a ``` example
// is never a real one. Lines are kept (as empty ones): line-based rules — a table row, a marker's wrap — read the same.
// An unclosed fence inside a list item ends with the item (fenceStep).
// An INDENTED code block is code too (review 5, L32): "Example:\n\n    US-1.AC-7 …" defined a required AC (and an EARS no-modal error).
function stripFencedCode(s) {
  const lines = String(s || "").split("\n");
  const code = codeBlockLines(lines);
  return lines.map((line, i) => (code[i] ? "" : line)).join("\n");
}
// The code lines of a text, as CommonMark reads its blocks → flags[i] (1 = code): every fenced-code line (fenceStep, the fence
// lines too) and every line of an INDENTED code block — indented 4 columns or more (a tab is 4), starting after a blank line, a
// heading, a fence or the text's start (it never interrupts a paragraph: an indented line right after text is a lazy
// continuation), and never inside a list (a list item's continuation and nested items are indented that deep; a list ends at a
// heading, or at a line less indented than 2 columns after a blank line). Blank lines inside a run are blank anyway. Linear.
const RE_CODE_LIST_ITEM = /^\s*(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const RE_CODE_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
function codeBlockLines(lines) {
  const flags = new Uint8Array(lines.length);
  const st = { fence: null };
  let fresh = true, list = false, run = false;
  const cols = (l) => { let c = 0; for (const ch of l) { if (ch === " ") c++; else if (ch === "\t") c += 4 - (c % 4); else break; if (c >= 8) break; } return c; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (fenceStep(st, l)) { flags[i] = 1; fresh = true; run = false; continue; }
    if (!l.trim()) { fresh = true; continue; }
    const ind = cols(l);
    if (ind >= 4 && (run || (fresh && !list))) { flags[i] = 1; run = true; continue; }
    run = false;
    const heading = RE_CODE_HEADING.test(l);
    if (RE_CODE_LIST_ITEM.test(l)) list = true;
    else if (heading || (fresh && ind < 2)) list = false;
    fresh = heading;
  }
  return flags;
}
// requirements.md's own AC IDs as the tools read them: outside HTML comments and fenced code, `_Supersedes:_`
// references (another feature's ACs) left out — and so is any `<feature>/US-n.AC-m` (the _Supersedes:_ / _Affects:_ syntax)
// written in prose: "rules of checkout/US-3.AC-2 stay as they are" names checkout's criterion, never one of this feature's
// (1.22 review: it was a required AC no task covered). `dir`: the feature's folder — see stripForeignAcRefs.
function requirementAcIds(reqText, dir) {
  return extractAcIds(stripForeignAcRefs(stripSupersedes(stripTitleLines(stripFencedCode(stripHtmlComments(reqText)))), dir));
}
// A level-1 heading — the document's title, written from the feature's name — never defines a criterion (1.23.1: a name holding
// `US-9.AC-1`, bold or not, made one more required AC no task covered). Blanked line by line, so line numbers stay put.
const RE_TITLE_LINE = /^ {0,3}#(?:[^\S\n][^\n]*)?$/gm;
function stripTitleLines(text) {
  return String(text || "").replace(RE_TITLE_LINE, "");
}
// `<slug>/US-n.AC-m` (blanks around the slash allowed, as _Supersedes:_ reads it) → removed when <slug> names ANOTHER feature.
// The slug is one token starting at a token start (linear: a match starts only there). Never a feature (review 2 — the
// feature's own ID was dropped, its required ACs went to 0): a token that is itself an ID ("US-1.AC-1/US-1.AC-2", "AC-1 /
// US-1.AC-2"), a story ("US-1 / US-1.AC-1"), a priority ("**P1/US-1.AC-1**"), a number ("1.1/US-1.AC-1"), no letter at all.
// With `dir` — a feature folder under <project>/.specs/ (or its _archive/) — the slug is resolved as _Supersedes:_ validation
// resolves it (locateFeatures: active or archived): another feature → removed; this feature (`login/US-1.AC-1`) → kept; NO
// feature of that name (review 3 — "keep the rules of billing/US-3.AC-2" with no billing feature was a required AC no task
// covered) → this feature's only when the same ID LABELS one of the text's criteria (criterionLabelIds: "5. Step-2/US-1.AC-5 —
// WHEN …"), else a foreign reference, removed. Without `dir` (a pure reader: a template, a pack's numbering, an import's task
// fitting) every token of a slug's shape counts as another feature's — the limit: there "Step-2/US-1.AC-1" reads as one.
// labelText (review 5, M5 — a text that CITES criteria: tasks.md, the test plan): the criteria whose labels decide a slug that
// names no feature are requirements.md's, not the citing text's own (a task line labels no criterion).
const RE_FOREIGN_AC = /(?<![\p{L}\p{N}_.-])([\p{L}\p{N}][\p{L}\p{N}_.-]*)[^\S\n]*\/[^\S\n]*(US-\d+\.AC-\d+)(?!\d)/gu;
const RE_ID_TOKEN_END = /(?<![A-Za-z0-9])(?:US-\d+\.AC-\d+|AC-\d+|T-\d+|EC-\d+|NFR-\d+|SC-\d+)$/;
const RE_NOT_A_SLUG = /^(?:\d+(?:[._-]\d+)*|p\d+|(?:us|ac|t|ec|nfr|sc)-\d+)$/i;
// A token before a slash that names no feature by its shape (an ID, a priority, a number, no letter): the ID after it is the text's own.
const notASlug = (slug) => RE_ID_TOKEN_END.test(slug) || RE_NOT_A_SLUG.test(slug) || !/\p{L}/u.test(slug);
function stripForeignAcRefs(text, dir, labelText) {
  const s = String(text || "");
  if (!s.includes("/")) return s;
  let kind = null, labels = null;
  return s.replace(RE_FOREIGN_AC, (whole, slug, id) => {
    if (notASlug(slug)) return whole;
    if (!kind) kind = featureRefTest(dir);
    const k = kind(slug);
    if (k === "self") return whole;
    if (k === "other") return "";
    if (!labels) labels = criterionLabelIds(labelText == null ? s : stripHtmlComments(labelText), kind);
    return labels.has(id) ? whole : "";
  });
}
// dir (a feature folder) → slug → "other" (ANOTHER feature of its project, active or archived) · "self" (this feature) · null
// (no feature of that name). No dir, or one outside a .specs/ folder → "other" for every slug-shaped token (the pure reader).
function featureRefTest(dir) {
  const proj = dir ? featureProjectDir(dir) : null;
  if (!proj) return () => "other";
  const self = dirKey(dir);
  const memo = new Map();
  return (slug) => {
    if (!memo.has(slug)) {
      let hit = null;
      try {
        const found = locateFeatures(proj, slug);
        hit = found.some((t) => dirKey(t.dir) !== self) ? "other" : found.length ? "self" : null;
      } catch { /* unreadable: none */ }
      memo.set(slug, hit);
    }
    return memo.get(slug);
  };
}
// The pre-review-3 reading (does the slug name ANOTHER feature?) — kept for its callers.
function otherFeatureTest(dir) {
  const k = featureRefTest(dir);
  return (slug) => k(slug) === "other";
}
// Review 3 — the ID that LABELS a criterion: the one that leads it (after a heading mark, a list marker, a checkbox, an emphasis /
// bracket opener — `- **US-1.AC-1** — WHEN …`, `1. NFR-2: THE SYSTEM SHALL …`, `### US-1.AC-3: …`, `- [ ] (EC-1) IF …`), with the
// token before a slash in front of it (`login/US-1.AC-1`, `P1/US-1.AC-1`); for a table row with no lead label, its cell that is
// exactly such an ID. An ID cited later in the criterion ("… (see EC-1)", "… (T-01)") labels nothing. → {id, slug} | null.
// Review 5 (L31): a sub-criterion ID (US-1.AC-1.2) is a label of its own — never its parent's US-1.AC-1 — and no stable ID (bareLabel).
// 1.24 review 6 (F1): an emphasis AND a bracket opener (`- **[NFR-1]** …`) lead a label too — the EARS unit readers accept the same leads.
const RE_LEAD_LABEL = /^[ \t]*(?:#{1,6}[ \t]+)?(?:(?:\d+[.)]|[-*+])[ \t]+)?(?:\[[ xX]\][ \t]+)?(?:\*\*|__|\*|_|`)?[[(]?(?:([\p{L}\p{N}][\p{L}\p{N}_.-]{0,200}?)[^\S\n]*\/[^\S\n]*)?(US-\d+\.AC-\d+\.\d+|US-\d+\.AC-\d+|AC-\d+|T-\d+|EC-\d+|NFR-\d+|SC-\d+)(?!\d)/u;
const RE_CELL_LABEL = /^(?:\*\*|__|\*|_|`)?(?:([\p{L}\p{N}][\p{L}\p{N}_.-]{0,200}?)[^\S\n]*\/[^\S\n]*)?(US-\d+\.AC-\d+\.\d+|US-\d+\.AC-\d+|AC-\d+|T-\d+|EC-\d+|NFR-\d+|SC-\d+)(?:\*\*|__|\*|_|`)?$/u;
function criterionLabel(text) {
  const s = String(text || "");
  const m = RE_LEAD_LABEL.exec(s);
  if (m) return { id: m[2], slug: m[1] || null };
  if (!s.includes("|")) return null;
  for (const cell of s.replace(/^[ \t]*\|/, "").split("|").slice(0, 64)) {
    const c = RE_CELL_LABEL.exec(cell.trim());
    if (c) return { id: c[2], slug: c[1] || null };
  }
  return null;
}
// The US-n.AC-m IDs that label a criterion line of the text (criterionLabel, line by line — the table rows too), its own: no slug,
// a slug that names no feature by its shape, this feature or no feature at all (kind: featureRefTest's answer). Linear.
function criterionLabelIds(text, kind) {
  const ids = new Set();
  for (const line of String(text || "").split("\n")) {
    if (!line.includes("US-")) continue;
    const lab = criterionLabel(line);
    if (!lab || !/^US-\d+\.AC-\d+$/.test(lab.id)) continue; // (a sub-criterion ID labels no AC)
    if (!lab.slug || notASlug(lab.slug) || kind(lab.slug) !== "other") ids.add(lab.id);
  }
  return ids;
}
// <project>/.specs/<f> or <project>/.specs/_archive/<f> → <project>; anything else → null. (Lexical — nothing is stat'ed.)
function featureProjectDir(dir) {
  const isSpecs = (p) => (FOLD_CASE ? path.basename(p).toLowerCase() : path.basename(p)) === ".specs";
  let d = path.resolve(dir);
  for (let i = 0; i < 2; i++) {
    const up = path.dirname(d);
    if (up === d) return null;
    if (isSpecs(up)) return path.dirname(up);
    d = up;
  }
  return null;
}
// test-plan.md as every reader of its IDs sees it — trace_check's coverage and planned T-IDs, its test-code scan, the
// Phase 4 gate, doctor, finish, the brief and impact: outside HTML comments AND fenced code. A fenced example row
// (`| T-02 | US-1.AC-2 | … |` in a ```md block) is no planned test: it counted as coverage (a false traceability pass for an
// AC with no real row) and as a planned T-ID the tests gate then demanded in the test code.
function planIdText(planText) {
  return stripFencedCode(stripHtmlComments(planText));
}

// Count unresolved [NEEDS CLARIFICATION: ...] markers in real content (not template comments). 1.24 review 6 (F11): never in fenced or
// indented code either (stripFencedCode — every other reader's rule): an example of how to mark an open point blocked the design.
function clarificationMarkers(md) {
  const text = stripFencedCode(stripHtmlComments(md));
  const out = [];
  const re = /\[NEEDS[ _-]CLARIFICATION:?([^\]\n]{0,500})\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) out.push((m[1] || "").trim());
  return out;
}
// The scaffold's own +saas/+ai track tasks (every language): their descriptions are template text until the
// user edits them — "Emit metrics, add dashboard, configure alerts" is not a breakdown yet. Built-in: the pre-generated
// corpus (builtinCorpus) or rendered.
let TEMPLATE_TASKS = null;
function templateTaskSet() {
  if (TEMPLATE_TASKS) return TEMPLATE_TASKS;
  const c = builtinCorpus();
  return (TEMPLATE_TASKS = new Set(c ? c.tasks : renderTemplateTasks()));
}
function renderTemplateTasks() {
  const set = new Set();
  for (const l of i18n.LANGS) {
    for (const t of parseTasks(i18n.tasks({ name: "x", tracks: VALID_TRACKS, label: "", slug: "x" }, l))) set.add(taskDescription(t.text));
  }
  return [...set];
}
// The bugfix steps (every language). They ARE the method — kept verbatim, so never placeholders — but on a
// fresh bugfix they don't mean "broken into tasks" yet: detectPhase counts them once the planning chain is filled.
let BUG_STEPS = null;
// The two steps every bugfix but an XS one was scaffolded with before the short form (1. reproduce → bug.md → Reproduction,
// 2. the root cause → bug.md → Root Cause — their gates hold them now), as taskDescription() reads them: EN · PT · pt-BR · ES.
// A tasks.md scaffolded with them is never rewritten (spec_upgrade leaves it alone), so they stay bug steps: left out, they
// would read as a real breakdown on such a fresh bugfix, and detectPhase would jump to tasks-ready before requirements.md.
const LEGACY_BUG_STEPS = [
  "reproduce the bug reliably and write the steps in bug.md → reproduction",
  "find the root cause with evidence; fill bug.md → root cause (no fix yet)",
  "reproduzir o bug de forma fiável e escrever os passos em bug.md → reprodução",
  "reproduzir o bug de forma confiável e escrever os passos em bug.md → reprodução",
  "encontrar a causa raiz com evidência; preencher bug.md → causa raiz (ainda sem corrigir)",
  "reproducir el bug de forma fiable y escribir los pasos en bug.md → reproducción",
  "encontrar la causa raíz con evidencia; rellenar bug.md → causa raíz (aún sin corregir)",
];
const renderBugSteps = () => [...LEGACY_BUG_STEPS, ...i18n.LANGS.flatMap((l) => parseTasks(i18n.bugTasks("x", l)).map((t) => taskDescription(t.text)))];
function bugStepSet() {
  if (!BUG_STEPS) { const c = builtinCorpus(); BUG_STEPS = new Set(c ? c.bugSteps : renderBugSteps()); }
  return BUG_STEPS;
}
function isBugStep(text) {
  const d = taskDescription(text);
  return bugStepSet().has(d) || projectTemplateHas("bugSteps", d); // + the project's bug-tasks template (1.14)
}
// A scaffold task: its whole description is a [bracketed placeholder] (after the known tags), or it is
// still the verbatim text of a +saas/+ai template task — or of a task of the project's tasks template (1.14).
function isPlaceholderTask(text) {
  const rest = taskDescription(text);
  return /^\[[^\]]*\]$/.test(rest) || templateTaskSet().has(rest) || projectTemplateHas("tasks", rest);
}
// A fence opener as CommonMark reads it: a backtick fence's info string holds no backtick — "```US-1.AC-1``` is how
// an ID looks." is inline code, not a fence that would turn the rest of the file into code (and hide every AC below it).
const RE_FENCE = /^\s*(`{3,}(?![^`]*`)|~{3,})/;
// A fence closer as CommonMark reads it: the opener's character, at least as long, and nothing after it but spaces.
const RE_FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
// Does `line` close the fence opened by `fence` (its marker: "```", "~~~~" …)? The ONE closer rule of every fence-aware
// reader: a closer carries no info string, so "```js" inside an open ``` block is code — it used to close the block and
// the rest of the file read inverted (the code below as prose, the prose after the real closer as code).
function closesFence(line, fence) {
  const c = String(line).match(RE_FENCE_CLOSE);
  return !!c && c[1][0] === fence[0] && c[1].length >= fence.length;
}
// One line of a fence-aware reader (stripFencedCode, criterionBlocks, placeholderReport, headingIndex, designSections).
// st.fence: the open fence ({ mark, indent }) or null. → "open" (this line opens a fence) | "code" (a fence line, or a line
// inside one) | null (not code). As in CommonMark — and the tasks scanner (fenceLine) — a fence opened inside a list item
// (indented) ends with that item: a non-blank line LESS indented than its opener (the next "- T-02 …", a heading or a
// table row at the margin) is outside it. One unclosed fence in a test-plan bullet used to blank every row below it —
// their T-IDs planned nothing and covered nothing (trace_check, the Phase 4 gate, the brief) — while a renderer showed them.
function fenceStep(st, line) {
  if (st.fence) {
    if (closesFence(line, st.fence.mark)) { st.fence = null; return "code"; }
    if (!(st.fence.indent > 0 && line.trim() && indentOf(line) < st.fence.indent)) return "code";
    st.fence = null; // the list item ended, and its unclosed fence with it: this line is read as usual
  }
  const m = line.match(RE_FENCE);
  if (m) { st.fence = { mark: m[1], indent: indentOf(line) }; return "open"; }
  return null;
}

// Every test-plan entry that belongs to a T-ID — ALL of them, not testIndex's first row per ID (a T-ID may have a row in
// the matrix and another in a "non-functional checks" table): each table row whose FIRST cell holds a T-ID, with its
// cells and its table's header cells, and each list item that starts with a T-ID, with its continuation lines (sub-bullets
// indented under it, a lazy continuation before any blank line). → [{ ids: [T-ID …], text, cells, header }]
const tableCells = (line) => line.trim().replace(/^\|/, "").replace(/\|\s*$/, "").split(/(?<!\\)\|/).map((c) => c.trim());

// The headings of a markdown text as a reader of its STRUCTURE sees them — the ONE heading reader (review 5, M2): never in fenced
// code ("# comment" in a bash block) nor in an HTML comment (a section commented out, `<!--` … `## [SEC] Threat Model` … `-->`, was
// read as present and filled — doctor passed it; commentLines' rule: a "<!--" with no "-->" after it is text). An ATX heading
// indented 0–3 spaces ("#"s, then a blank or a tab; its closing "#" sequence dropped, its trailing comment too) and a SETEXT
// heading: a one-line paragraph — after a blank or comment-only line, a heading, a fence or the text's start — underlined by
// at least three "=" (level 1) or "-" (level 2), as CommonMark reads them (a paragraph of several lines followed by "---" is left
// alone, so YAML front matter is never a heading). Linear.
// lines: the text split on "\n" (a trailing "\r" is harmless). → [{ i, level, text, body, atx, indent }]: i = the heading's
// line (a setext heading's text line), body = the first line after it (after a setext underline), atx / indent = an ATX
// heading and its leading spaces.
const RE_SETEXT_UNDERLINE = /^ {0,3}(?:={3,}|-{3,})[ \t]*\r?$/;
const RE_SETEXT_NOT_TEXT = /^\s*(?:[-*+](?:\s|$)|\d{1,9}[.)](?:\s|$)|>|\||(?:[-*_][ \t]*){3,}\r?$)/; // a list item, quote, table row, rule
function headingEntries(lines) {
  const cl = lines.some((l) => l.includes("<!--")) ? commentLines(lines) : null; // no comment at all: the fences alone
  const st = { fence: null };
  const vis = (k) => (cl ? (cl[k].hidden ? "" : cl[k].vis) : lines[k]);
  const code = (k) => (cl ? !!cl[k].fence : false); // (without comments, fenceStep is stepped in the loop, once per line)
  const inComment = (k) => !!cl && (cl[k].hidden || (k > 0 && cl[k - 1].open)); // the line starts inside a comment
  const out = [];
  let fresh = true; // the next line may start a setext heading's paragraph (the text's start, a blank line, a heading, a fence)
  for (let i = 0; i < lines.length; i++) {
    if (cl ? code(i) : fenceStep(st, lines[i])) { fresh = true; continue; }
    const v = vis(i);
    if (inComment(i) || !v.trim()) { fresh = fresh || !v.trim(); continue; }
    let p = 0;
    while (p < 3 && v[p] === " ") p++;
    if (v[p] === "#") {
      const h = atxHeading(v.slice(p), 1, 6, "closing");
      if (h) { out.push({ i, level: h.level, text: h.text, body: i + 1, atx: true, indent: p }); fresh = true; continue; }
    }
    if (fresh && v[p] !== " " && v[p] !== "\t" && !RE_SETEXT_NOT_TEXT.test(v) && i + 1 < lines.length) { // (4+ spaces: code)
      const nl = lines[i + 1];
      const nextCode = cl ? code(i + 1) || inComment(i + 1) : false;
      if (!nextCode && RE_SETEXT_UNDERLINE.test(cl ? vis(i + 1) : nl)) {
        if (!cl) fenceStep(st, nl); // keep the fence state in step (an underline is never a fence line)
        out.push({ i, level: nl.trim()[0] === "=" ? 1 : 2, text: v.trim(), body: i + 2, atx: false, indent: p });
        i++;
        fresh = true;
        continue;
      }
    }
    fresh = false;
  }
  return out;
}
// The ATX heading lines at the margin (the "#"s first), outside fenced code and HTML comments — for the readers that parse the
// line themselves (decisions, export, import, packs). The section readers use headingEntries (setext and indented ATX too).
function headingIndex(lines) {
  return headingEntries(lines).filter((e) => e.atx && e.indent === 0).map((e) => e.i);
}

// Does a heading line name one of the synonyms? Never a level-1 title — it carries the feature NAME
// ("# Feature: Weekly summary email", "# Bug: Fix login crash" used to BE the Summary / Fix section). The
// synonym must START the heading text, after an optional [SaaS]/[AI] marker, numbering ("1.", "10)",
// "Section 1:" — the form references/mandatory-ai-design-sections.md uses) and emphasis, and end at a word
// boundary ("fix" ≠ "Fixtures").
// An emoji (with its variation selector / joiner / skin tone) before or after the marker is decoration too:
// "## 🔐 [SEC] Threat Model" (full review Pb4).
const headingLeadSource = (markers) => "^(?:[\\s*_—–:-]+|[\\p{Extended_Pictographic}\\u{1F3FB}-\\u{1F3FF}\\u{FE0E}\\u{FE0F}\\u{200D}\\u{20E3}]+|\\[(?:" + markers.join("|") +
  ")\\]|(?:section|sec[çc][ãa]o|se[çc][ãa]o|secci[óo]n)\\s+\\d+[.:)]?(?=\\s|$)|\\d+(?:\\.\\d+)*[.):]?(?=\\s))";
const RE_HEADING_LEAD = new RegExp(headingLeadSource(MARKER_TRACKS), "u");
// + the project's track packs' markers (1.15), lower-cased as the heading text is: [A-Z0-9] tokens (validated) — regex-safe.
let HEADING_LEAD_PACKS = { key: "", re: RE_HEADING_LEAD };
function headingLeadRe() {
  const packs = packRegistry().packs;
  if (!packs.length) return RE_HEADING_LEAD;
  const key = packs.map((p) => p.token).join("|");
  if (HEADING_LEAD_PACKS.key !== key) HEADING_LEAD_PACKS = { key, re: new RegExp(headingLeadSource(MARKER_TRACKS.concat(packs.map((p) => p.token.toLowerCase()))), "u") };
  return HEADING_LEAD_PACKS.re;
}
// inflect (the marker tracks' sections — full review Pb4): an English inflection of the synonym's last word names the same
// section — "Threat Modeling" / "Threat Modelling" / "Threat Models" are the Threat Model.
const RE_SYN_INFLECTION = /^(?:s|es|ing|ling)(?![\p{L}\p{N}])/u;
function headingMatches(line, syns, inflect) {
  const m = atxHeading(line, 2, 6, "raw"); // /^#{2,6}\s+(.*)$/
  return !!m && headingTextMatches(m.text, syns, inflect);
}
// The same test on a heading's TEXT (a headingEntries entry's — an ATX or setext heading of level ≥ 2; the caller keeps the H1 out).
function headingTextMatches(text, syns, inflect) {
  let t = String(text).toLowerCase();
  const lead = headingLeadRe();
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(lead, ""); }
  return syns.some((s) => t.startsWith(s) && (!/[\p{L}\p{N}]/u.test(t.charAt(s.length)) || (inflect && RE_SYN_INFLECTION.test(t.slice(s.length)))));
}
// 1.24 review 6 (F7): can ONE heading answer both a section named / synonymed `x` and one named `y`? — headingTextMatches' rule (the
// synonym STARTS the heading, word-bounded, an English inflection allowed on a track section): only when one key equals the other or
// is a word-prefix of it ("offline" / "offline sync") or its inflection ("model" / "modeling notes"). Two such sections of ONE track
// are answered by the longer one's heading: "## [MOB] Offline Sync" filled "Offline" too, so deleting the "Offline" section passed.
const keyStarts = (s, t) => t.startsWith(s) && (!/[\p{L}\p{N}]/u.test(t.charAt(s.length)) || RE_SYN_INFLECTION.test(t.slice(s.length)));
function synonymsOverlap(x, y) {
  const a = String(x).trim().toLowerCase(), b = String(y).trim().toLowerCase();
  return !!a && !!b && (keyStarts(a, b) || keyStarts(b, a));
}
// A track's section table → the pairs of sections that one heading can answer: [[name, other name, key, other key]] ([] when none —
// the invariant every built-in table keeps; `tracks check` refuses a pack that breaks it, section-overlap). Keys: name + syn + loose.
function sectionOverlaps(sections) {
  const keys = (sections || []).map((s) => [...new Set([s.name, ...(s.syn || []), ...(s.loose || [])].filter((k) => typeof k === "string").map((k) => k.trim().toLowerCase()))]);
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      let hit = null;
      for (const a of keys[i]) { for (const b of keys[j]) if (synonymsOverlap(a, b)) { hit = [a, b]; break; } if (hit) break; }
      if (hit) out.push([sections[i].name, sections[j].name, hit[0], hit[1]]);
    }
  }
  return out;
}

// marker = "[SaaS]" / "[AI]": a heading carrying the track marker wins, so "[AI] Observability for AI"
// can no longer stand in for "[SaaS] Observability". Unmarked headings are the fallback (hand-written
// designs), but never one that carries the OTHER track's marker. Markers are case-sensitive tokens (C4).
// `loose` (C4): the synonyms of a track section that are ordinary words in a design ("Processors", "Retention",
// "Conservação", "Data inventory", "Avaliação de impacto") — they name the section only on a heading that carries the
// marker, or on an unmarked heading nested under a heading that does (the track's context: `## [PRIVACY] Processing` →
// `### Processors`). Without that, deleting a `[PRIVACY]` heading let a core heading like "## Processors and queues"
// satisfy "Processors & International Transfers" and doctor passed a section nobody wrote. The other synonyms are
// unambiguous and keep the unmarked fallback anywhere (hand-written and PT/ES designs without markers, the reference
// templates' "## Observability" / "## Section 1: Model Strategy") — except inside ANOTHER track's section (1.21 review B5: an
// unmarked heading whose nearest marked enclosing heading carries another marker belongs to that section).
function extractSection(md, synonyms, marker, loose) {
  const syns = (Array.isArray(synonyms) ? synonyms : [synonyms]).map((s) => s.toLowerCase());
  const looseSet = new Set((loose || []).map((s) => s.toLowerCase()));
  const strict = looseSet.size ? syns.filter((s) => !looseSet.has(s)) : syns;
  const lines = (md || "").split(/\r?\n/);
  // The headings as the ONE heading reader sees them (review 5, M2: never in a comment or a fence; setext and indented ATX too);
  // a heading's marker is read in its visible text (never a trailing comment's). The H1 title is never a section.
  const heads = headingEntries(lines);
  const matches = (h, list) => h.level >= 2 && headingTextMatches(h.text, list || syns, !!marker); // a track section's heading may inflect its name
  const level = (h) => h.level;
  const has = (h, mk) => h.text.includes(mk);
  // An enclosing heading (a lower level, above i — its parent, the parent's parent…) carries the marker: the heading sits in the
  // track's context. Every heading's answer comes from ONE linear pass (a stack of the enclosing headings), on first use — the
  // back-walk from each loose-synonym heading (heads.indexOf + a scan up) was quadratic: a 200 KB design.md of "### Processors"
  // with no [PRIVACY] heading took status 9 s.
  let inCtx = null;
  const inTrackContext = (i) => {
    if (!inCtx) {
      inCtx = new Map();
      const stack = [];
      for (const h of heads) {
        const lv = level(h);
        while (stack.length && stack[stack.length - 1].lv >= lv) stack.pop();
        const inside = stack.length > 0 && stack[stack.length - 1].marked;
        inCtx.set(h, inside);
        stack.push({ lv, marked: inside || has(h, marker) });
      }
    }
    return inCtx.get(i) === true;
  };
  const MARKERS = markerTracks().map((t) => trackMarker(t)); // + the track packs' (1.15)
  // 1.21 review B5 — the mirror of inTrackContext: the nearest enclosing heading that carries a marker carries ANOTHER track's — the
  // heading is part of that track's section ("## [PRIVACY] Lawful Basis" → "### Data quality (LGPD art. 6, V)" never stands in for a
  // deleted [DATA] Data Quality). Tried last (only on a heading whose name matches); every heading's context marker comes from ONE
  // linear pass (a stack of the enclosing headings), on first use.
  let ctxOf = null;
  const inOtherTrackContext = (i) => {
    if (!ctxOf) {
      ctxOf = new Map();
      const stack = [];
      for (const h of heads) {
        const lv = level(h);
        while (stack.length && stack[stack.length - 1].lv >= lv) stack.pop();
        const top = stack[stack.length - 1];
        const ctx = top ? top.own || top.ctx : null;
        ctxOf.set(h, ctx);
        stack.push({ lv, own: MARKERS.find((x) => has(h, x)) || null, ctx });
      }
    }
    const m = ctxOf.get(i);
    return !!m && m !== marker;
  };
  let start = null;
  if (marker) start = heads.find((h) => has(h, marker) && matches(h));
  if (!start) {
    const other = marker ? MARKERS.filter((m) => m !== marker) : [];
    start = heads.find((h) => (matches(h, strict) || (marker && looseSet.size && matches(h) && inTrackContext(h))) && !other.some((m) => has(h, m)) &&
      !(marker && inOtherTrackContext(h)));
  }
  if (!start) return null;
  const end = heads.find((h) => h.i > start.i && level(h) <= level(start));
  return lines.slice(start.body, end ? end.i : lines.length).join("\n");
}

// The indent is read within its line ([^\S\n\r\u2028\u2029], not \s — a line start of a long blank run rescanned the whole
// run, 1.17 H): the line holding the '>' matches either way, and every reader only asks whether one does.
const RE_TODO_SENTINEL = /^[^\S\n\r\u2028\u2029]*>\s*\*\*TODO\*\*/m;
const ROOT_CAUSE_SYN = ["root cause", "causa raiz", "causa raíz"];
const REPRO_SYN = ["reproduction", "reprodução", "reproducao", "reproducción", "reproduccion"];
// A track's mandatory sections → [{ section, status }] (+ `tier` "core" | "extended" on a SIZED feature). Statuses: missing ·
// unfilled (the `> **TODO**` sentinel is still there, or nothing was written — blank is not an answer) · template (1.21 F5:
// nothing but the template's own guidance lines — deleting the sentinel and keeping the scaffold's bullet used to pass) ·
// filled; on a sized feature (opts.size) also na (the section's own text is ONE "n/a — <reason of ≥ 4 words>" line) and
// na-short (an n/a with a shorter reason, or none). The verdict is sectionVerdict's; opts.lang adds that language's template
// lines (pt-BR's derived ones).
function sectionState(design, sections, marker, opts = {}) {
  return sections.map((sec) => {
    const out = (status) => (opts.size ? { section: sec.name, status, tier: sec.tier === "extended" ? "extended" : "core" } : { section: sec.name, status });
    const body = extractSection(design, sec.syn, marker, sec.loose);
    if (body == null) return out("missing");
    // review 5 (M2 / L28): the sentinel as a reader sees it (a commented-out or quoted-in-code one is none), and nothing but
    // structure — sub-headings, a rule, an empty table — is nothing written; nor (1.24 review 6, F4) a generic slot / punctuation line
    if (RE_TODO_SENTINEL.test(stripFencedCode(stripHtmlComments(body)))) return out("unfilled");
    const content = writtenContent(body);
    if (!content.prose.length && !content.code.length) return out("unfilled");
    const own = sectionOwnLines(body, opts.lang);
    if (!own.length) return out("template");
    if (opts.size) { const na = naAnswer(own); if (na) return out(na); }
    return out("filled");
  });
}
// 1.21 F5 — the section's lines the USER wrote: visible (comments out), not blank, not a line of a track design block as the
// scaffold writes it (the built-in tracks' in EN / PT / ES — pt-BR's too for a pt-BR feature — and this project's track packs'):
// a key per line, whitespace folded, lower-cased, a list bullet or quote marker dropped. Exact lines only — a guidance line the
// user edited is theirs. Fenced code is the user's too (1.21 review C2 — no track block holds a fence: a section answered by a
// ```json schema, an OpenAPI ```yaml or a ```mermaid diagram read as "only the template's guidance"): its content lines count,
// its fence lines don't. A pack's guidance line holding the feature's {{name}} / {{slug}} (the scaffold filled them in) is a
// LINEAR wildcard (wildcardMatch, the project templates' rule — never a regex built from template text; 1.21 review C6).
const sectionLineKey = (s) => String(s).replace(/^\s*(?:[-*+]|\d+[.)]|>)\s+/, "").replace(/\s+/g, " ").trim().toLowerCase();
let SECTION_TEMPLATE_LINES = null; // process-wide: the built-in track blocks (EN / PT / ES)
let SECTION_TEMPLATE_LINES_BR = null; // … their pt-BR twins, built on the first pt-BR feature
const PACK_SECTION_LINES = new WeakMap(); // a call's pack registry → its packs' design-block lines (every language): { set, wild }
const RE_SECTION_WILD_VAR = /\{\{\s*(?:name|slug)\s*\}\}/; // a key is lower-cased already
const RE_SECTION_WILD_VAR_G = new RegExp(RE_SECTION_WILD_VAR.source, "g");
function addSectionLines(set, text, wild) {
  for (const l of stripFencedCode(stripHtmlComments(String(text || ""))).split(/\r?\n/)) {
    if (!l.trim() || /^#{1,6}\s/.test(l) || RE_TODO_SENTINEL.test(l)) continue;
    const k = sectionLineKey(l);
    if (wild && RE_SECTION_WILD_VAR.test(k)) {
      const segs = k.split(RE_SECTION_WILD_VAR_G);
      if (segs.join("").replace(/\s+/g, "").length >= 3) wild.push(segs); // a line that is nothing but a variable matches nothing
      continue;
    }
    set.add(k);
  }
}
// The built-in track design blocks' line keys → a sorted list: group "base" (EN / PT / ES), or "pt-BR" — only its lines the base
// set lacks (a pt-BR section is read against both). 1.24 r6 I-I2: read from the corpus (builtinCorpus) — rendered, they loaded
// pt.js and es.js into every English gate that reads a section.
function renderSectionLines(group) {
  const lines = (langs) => {
    const set = new Set();
    for (const l of langs) for (const tr of VALID_TRACKS) { try { addSectionLines(set, i18n.trackDesignBlock(tr, l)); } catch { /* a builder's trouble never breaks a gate */ } }
    return set;
  };
  const base = lines(i18n.BASE_LANGS);
  if (group !== "pt-BR") return sortList(base);
  return sortList([...lines(["pt-BR"])].filter((k) => !base.has(k)));
}
function sectionTemplateLines(lang) {
  if (!SECTION_TEMPLATE_LINES) { const c = builtinCorpus(); SECTION_TEMPLATE_LINES = new Set(c ? c.sectionLines : renderSectionLines("base")); }
  const sets = [SECTION_TEMPLATE_LINES];
  if (lang === "pt-BR") {
    if (!SECTION_TEMPLATE_LINES_BR) { const c = builtinCorpus(); SECTION_TEMPLATE_LINES_BR = new Set(c ? c.sectionLinesBr : renderSectionLines("pt-BR")); }
    sets.push(SECTION_TEMPLATE_LINES_BR);
  }
  const reg = packRegistry();
  let wild = [];
  if (reg.packs.length) {
    let pk = PACK_SECTION_LINES.get(reg);
    if (!pk) {
      pk = { set: new Set(), wild: [] };
      // rendered with no feature values: {{name}} / {{slug}} stay variables (packSubstBasic) and are read as wildcards
      for (const p of reg.packs) for (const l of i18n.LANGS) { try { addSectionLines(pk.set, packDesignBlock(p, l, {}), pk.wild); } catch { /* ignore */ } }
      PACK_SECTION_LINES.set(reg, pk);
    }
    sets.push(pk.set);
    wild = pk.wild;
  }
  return { sets, wild };
}
function sectionOwnLines(body, lang) {
  const { prose, code } = writtenContent(body); // (1.24 review 6, F4: a TBD beside the guidance line is no line of the author's)
  if (!prose.length) return code;
  const { sets, wild } = sectionTemplateLines(lang);
  return prose.filter((l) => { const k = sectionLineKey(l); return !sets.some((s) => s.has(k)) && !wild.some((w) => wildcardMatch(w, k)); }).concat(code);
}
// A section's content lines → { prose, code }: visible (comments out), not blank, outside fences (prose) or inside one (code — its
// fence lines are no content). Structure is no content (review 5, L28): a heading (ATX or setext, its underline too), a thematic
// break, a table's header and separator rows — a section of sub-headings, a rule or an empty table read as "filled".
// A table's separator row ("|---|:--:|", "--- | ---"): every cell dashes with optional colons — cell by cell (linear).
const isTableSep = (l) => {
  const t = String(l).trim();
  if (!t.includes("|") || !t.includes("-")) return false;
  return t.replace(/^\|/, "").replace(/\|$/, "").split("|").every((c) => /^:?-+:?$/.test(c.trim()));
};
function sectionContent(body) {
  const lines = stripHtmlComments(body).split(/\r?\n/);
  const structure = new Set();
  for (const h of headingEntries(lines)) { structure.add(h.i); if (!h.atx) structure.add(h.i + 1); }
  const st = { fence: null };
  const prose = [], code = [];
  lines.forEach((l, i) => {
    const f = fenceStep(st, l);
    if (f === "open") return; // a fence line is no content
    if (f) { if (st.fence && l.trim()) code.push(l); return; } // inside the fence (still open after the step) — its closer is no content
    if (!l.trim() || structure.has(i) || RE_THEMATIC_BREAK.test(l)) return;
    if (l.includes("|") && (isTableSep(l) || (i + 1 < lines.length && isTableSep(lines[i + 1])))) return; // a separator row, a header row
    prose.push(l);
  });
  return { prose, code };
}
// 1.24 review 6 (F4) — what a section's author WROTE: sectionContent() minus the prose lines that answer nothing — a generic slot
// word (genericAnswer: TODO / TBD / TBC / FIXME / "…" / "a definir", "Pending" / "Pendente" / "Pendiente" / "to be decided" …, after
// list / quote / checkbox markers, emphasis, a wrapping bracket and trailing punctuation: "- TBD", "**TBD**", "[TBD]", "- [ ] TODO",
// "> TBD", "Pending.") and a line with no letter or digit ("-", "—", "...", "| - | - |"); a table row answers when one of its cells
// does. A section holding only those read as filled — a [SEC] Threat Model "TBD" approved the design, a bugfix's Root Cause "TBD"
// passed the iron law. A real one-word answer stays: "N/A", "None.", "No." (the honest "nothing here" a Risks section asks for; a
// sized feature's na / na-short rule reads its own text). Fenced code is the author's (review C2). The ONE reader of sectionState,
// sectionOwnLines and — through hasProseOutsideBrackets — gates.js's sectionFilled / bugSectionFilled and the spike / decision prose.
// → { prose, code }. Linear.
const RE_PENDING_ANSWER = /^(?:pending|pendente|pendiente|to be (?:defined|determined|decided|confirmed|written)|(?:a|por) (?:decidir|determinar|confirmar|preencher|rellenar))$/iu;
function genericAnswer(s) {
  let t = String(s).replace(/[*_`]+/g, "").trim();
  let e = t.length;
  while (e > 0 && ".:;!?".includes(t[e - 1])) e--; // trailing punctuation (a loop: linear on a long run of dots)
  t = t.slice(0, e).trim();
  if (t.startsWith("[") && t.endsWith("]")) t = t.slice(1, -1).trim(); // "[TBD]"
  return isGenericSlot(t) || RE_PENDING_ANSWER.test(t);
}
const RE_LINE_MARKERS = /^[ \t]*(?:>[ \t]*)*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?(?:\[[ xX]\][ \t]+)?/;
const RE_WORD_CHAR = /[\p{L}\p{N}]/u;
function lineAnswers(l) {
  if (/^\s*\|/.test(l)) return tableCells(l).some((c) => RE_WORD_CHAR.test(c) && !genericAnswer(c));
  const rest = l.replace(RE_LINE_MARKERS, "");
  return RE_WORD_CHAR.test(rest) && !genericAnswer(rest);
}
function writtenContent(body) {
  const { prose, code } = sectionContent(body);
  return { prose: prose.filter(lineAnswers), code };
}
// A design's Mermaid diagram as doctor's `mermaid` check reads it (review 5, L28) → "present" | "template" | "missing": the fenced
// blocks (``` or ~~~, any length) whose info string starts with "mermaid", outside HTML comments; "template" when every one still
// holds the scaffold's own diagram (any language — whitespace folded). It was a substring test for "```mermaid": a ~~~mermaid fence
// warned "missing", a "```mermaid" mentioned in a comment passed, and the untouched "A[Component] → C[(Database)]" passed.
const RE_MERMAID_FENCE = /^\s*(?:`{3,}|~{3,})[ \t]*mermaid(?![\p{L}\p{N}_-])/iu;
function mermaidBlocks(text) {
  const st = { fence: null };
  const out = [];
  let cur = null;
  for (const l of stripHtmlComments(text || "").split(/\r?\n/)) {
    const f = fenceStep(st, l);
    if (f === "open") { cur = RE_MERMAID_FENCE.test(l) ? [] : null; if (cur) out.push(cur); continue; }
    if (f && st.fence) { if (cur) cur.push(l); continue; }
    cur = null; // a closer, or outside any fence
  }
  return out.map((b) => b.join(" ").replace(/\s+/g, " ").trim());
}
// The scaffold's own diagrams (every language, pt-BR's too; each design size) → a sorted list. 1.24 r6 I-I2: read from the corpus
// (builtinCorpus) — rendered, doctor's mermaid check loaded pt.js, es.js and pt-BR into every English process.
function renderTemplateDiagrams() {
  const set = new Set();
  for (const l of i18n.LANGS) {
    for (const size of [undefined, "s", "m"]) {
      try { mermaidBlocks(i18n.design({ name: "x", tracks: ["core"], label: trackLabel(["core"]), slug: "x", summary: "", size }, l)).forEach((d) => set.add(d)); } catch { /* a builder's trouble never breaks a check */ }
    }
  }
  return sortList(set);
}
let TEMPLATE_DIAGRAMS = null; // Set — process-wide
function templateDiagramSet() {
  if (!TEMPLATE_DIAGRAMS) { const c = builtinCorpus(); TEMPLATE_DIAGRAMS = new Set(c ? c.diagrams : renderTemplateDiagrams()); }
  return TEMPLATE_DIAGRAMS;
}
function mermaidState(design) {
  const blocks = mermaidBlocks(design).filter(Boolean); // an empty block draws nothing
  if (!blocks.length) return "missing";
  return blocks.every((d) => templateDiagramSet().has(d)) ? "template" : "present";
}
// "n/a — <why it does not apply>" (EN / PT / ES; any emphasis around the n/a): the section's own text is that ONE line → "na"
// when the reason holds at least NA_REASON_WORDS words, "na-short" when it holds fewer; anything else → null.
const RE_NA_LEAD = /^\s*(?:[-*+]\s+|>\s*)?(?:\*\*|__|\*|_)?(?:n\/a|n\.a\.|not applicable|does not apply|n[ãa]o se aplica|n[ãa]o aplic[áa]vel|no (?:se )?aplica|no aplicable)(?:\*\*|__|\*|_)?(?![\p{L}\p{N}])/iu;
const NA_REASON_WORDS = 4;
function naAnswer(own) {
  if (own.length !== 1) return null;
  const m = own[0].match(RE_NA_LEAD);
  if (!m) return null;
  const words = own[0].slice(m[0].length).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  return words.length >= NA_REASON_WORDS ? "na" : "na-short";
}
// 1.21 F5 — the active marker tracks' mandatory sections as every gate reads them (doctor `<track>-sections`, the design
// approval, the design save check, status, the roadmap) → [[track, marker, rows]]. On a SIZED feature a section two active tracks
// both ask for (TRACK_OVERLAPS) that the design leaves out is `covered` (+ `by`: the headings that answer it) once one of the
// covering sections is there — the sized scaffold writes only those. opts: { size, lang }.
function trackSectionReport(design, tracks, opts = {}) {
  const out = activeSectionTracks(tracks).map(([tr, secs, mark]) => [tr, mark, sectionState(design, secs, mark, opts)]);
  if (!opts.size) return out;
  const rowsOf = (t) => (out.find(([x]) => x === t) || [])[2] || [];
  for (const o of TRACK_OVERLAPS) {
    if (![o.drop[0], ...o.by.map(([t]) => t)].every((t) => tracks.includes(t))) continue; // both tracks on
    const row = rowsOf(o.drop[0]).find((s) => s.section === o.drop[1]);
    if (!row || row.status !== "missing") continue;
    const by = o.by.filter(([t, n]) => rowsOf(t).some((s) => s.section === n && s.status !== "missing"));
    if (by.length) Object.assign(row, { status: "covered", by: by.map(([t, n]) => trackMarker(t) + " " + n) });
  }
  return out;
}
// One section row's verdict → "pass" | "warn" | "fail". Size S: an EXTENDED-tier section may be absent (the scaffold leaves it
// out). "template" fails a new approval — opts.approved (the design is approved already): a warn, never a fail on a phase signed
// off before the stricter rule (1.21). na / covered answer the section; unfilled and na-short never do.
function sectionVerdict(row, opts = {}) {
  switch (row.status) {
    case "filled": case "na": case "covered": return "pass";
    case "missing": return opts.size === "s" && row.tier === "extended" ? "pass" : "fail";
    case "template": return opts.approved ? "warn" : "fail";
    default: return "fail";
  }
}

// ---------------------------------------------------------------------------
// Template placeholders — what a scaffold still waits for (the gates build on these two)
// ---------------------------------------------------------------------------

// Bracket contents that are never a placeholder: English-stable tags, stable IDs (alone or as a list).
// The list separator is UNAMBIGUOUS — `\s*(?:[,;/]\s*)?`, never `\s*[,;/]?\s*`: with the separator optional
// between two `\s*`, every whitespace gap could split two ways and a failing match (`[US-1 US-2 … and more]`)
// backtracked 2^k — 26 space-separated IDs froze the MCP server and pushed the hooks past their timeout.
const RE_STABLE_BRACKET = /^(?:US\d+|P\d?|shared|SaaS|AI|SEC|PRIVACY|DIST|API|UI|OBS|DATA|x)$|^\s*(?:US-\d+(?:\.AC-\d+)?|AC-\d+|T-\d+|SC-\d+|EC-\d+|NFR-\d+)(?:\s*(?:[,;/]\s*)?(?:US-\d+(?:\.AC-\d+)?|AC-\d+|T-\d+|SC-\d+|EC-\d+|NFR-\d+))*\s*$/i;
const RE_REF_DEFINITION = /^\s{0,3}\[([^\]]+)\]:\s*\S/;
// The core-only Signals answer scaffolds before 1.13 wrote in brackets (`- [none beyond core]`, PT/ES): the tool's own
// final answer, never a slot — the classification.md of every core-only feature created by 1.12 still holds it.
const RE_LEGACY_ANSWER = /^\s*(?:none beyond core|nenhum além de core|ninguno además de core)\s*$/i;
const RE_LIST_CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\](?=\s|$)/;

// A bracket is a TEMPLATE PLACEHOLDER only when its text is one a scaffold actually writes — a deterministic lookup,
// never a guess from its shape. 1.13 first guessed (bracketed prose = a slot, a written-out one-token enumeration =
// content), and a criterion quoting real values — `[free: 60, pro: 600, enterprise: 6000]`, `[admin, billing-manager,
// read only]`, `[10 MB, 25 MB for pro]` — read as a slot: the approval was refused and finished, upgraded 1.12 specs
// were blocked (doctor FAIL, next_action "fill requirements.md" at 5/5 tasks, finish refused). The set
// (templateSets) holds every bracket text the CURRENT templates render (templateCorpus: every builder, EN/PT/ES,
// every track combination and kind, the track / import task slots, the steering stubs — pt-BR's derived ones in
// templateSetsBr, built on the first miss), every bracket text the 1.12.1
// templates rendered (LEGACY_TEMPLATE_PLACEHOLDERS: a spec scaffolded by 1.12 still holds those), and the generic unfilled
// tokens (isGenericSlot: TODO, TBD, TBC, FIXME, "...", "…"). Anything else in brackets is the user's own content.
// The key ignores case, spacing and "…" vs "...": `[Story title]` is `[story   title]`.
const placeholderKey = (inner) => String(inner).normalize("NFC").replace(/…/g, "...").replace(/\s+/g, " ").trim().toLowerCase();
// TODO / TBD / TBC / FIXME (alone or leading: "[TBD: pricing]"), an ellipsis, "a definir" / "por definir". TODO is
// matched upper-case only: "todo" is a Portuguese / Spanish word.
function isGenericSlot(inner) {
  const t = String(inner).trim();
  return /^TODO(?![\p{L}\p{N}_])/u.test(t) || /^(?:tbd|tbc|fixme)(?![\p{L}\p{N}_])/iu.test(t) || /^(?:\.{3,}|…+)$/u.test(t) || /^(?:a|por) definir$/iu.test(t);
}
// The stub `spec_init` writes for a steering file with no template (the file name is the user's; the slot is fixed).
const unknownSteeringStub = (f) => `# ${f.replace(/\.md$/, "")}\n\n[fill me in]\n`;
// The bracket texts the 1.12.1 templates rendered (and the current ones no longer do) — extracted ONCE from
// `git show main:mcp/lib/i18n.js` (1.12.1) by rendering every builder (classification, requirements, design + the
// track blocks, tasks, test plan, eval plan, load test, quickstart, checklist, integration plan, the bugfix templates,
// the prompt stub, the steering stubs; EN/PT/ES; every track combination; a dummy name) and reading each bracket as
// templateBracketKeys does. A 1.12 spec that still holds one of them is still a template there; the texts the current
// templates share with 1.12.1 come from templateCorpus.
const LEGACY_TEMPLATE_PLACEHOLDERS = [
  "", "0.03", "0.1", "1-2 frases: o que faz e porque importa", "1-2 frases: qué hace y por qué importa",
  "1-2 sentences: what this does and why it matters", "85", "98", "a condição que provoca o bug", "acción específica",
  "aciona uma condição de erro de um ac se...então", "advisory | semi-autonomous | autonomous",
  "algo assumido como verdadeiro que, se for falso, muda a spec",
  "algo asumido como verdadero que, si es falso, cambia la spec", "always-true property",
  "ambiente / dados / contas necessárias", "anything assumed true that, if wrong, changes the spec",
  "auth, validación, riesgos de exposición de datos", "auth, validation, data exposure risks",
  "auth, validação, riscos de exposição de dados", "ação específica", "behavior", "behavior for us-2", "beneficio",
  "benefit", "benefício", "caminho", "caminho → alteração", "capability", "capacidad", "capacidade", "carga, ~$/mes",
  "carga, ~$/mês", "cenário", "clocks, randomness, ids abstracted how", "comando da suite de testes completa",
  "comando de la suite de pruebas completa", "comando que lo demuestra, p. ej.: npm test -- ruta/fichero.test.js",
  "comando que o prova, ex.: npm test -- caminho/ficheiro.test.js",
  "command that proves it, e.g. npm test -- path/to/file.test.js",
  "como desempatar — ex.: 'preferir o aborrecido/comprovado ao engenhoso'.", "como gera receita",
  "como isto se integra com o sistema existente. decisões-chave e fundamentação.", "como testar esta sozinha",
  "componentes/módulos existentes que esta feature toca", "componentes/módulos existentes que esta función toca",
  "comportamento", "comportamento central para us-1", "comportamento correto", "comportamento esperado",
  "comportamento para us-2", "comportamiento", "comportamiento central para us-1", "comportamiento correcto",
  "comportamiento esperado", "comportamiento para us-2", "condición de error", "condição de erro",
  "consultivo | semi-autónomo | autónomo", "core behavior for us-1", "correct behavior",
  "cómo desempatar — p.ej., 'preferir lo aburrido/probado a lo ingenioso'.", "cómo genera ingresos",
  "cómo se integra esto con el sistema existente. decisiones clave y justificación.", "cómo testear esta sola",
  "depois isto", "directory tree", "dispara una condición de error de un ac si...entonces", "disparador", "do this",
  "docs, cleanup, edge-case hardening", "docs, limpeza, robustez de casos limite",
  "docs, limpieza, robustez de casos límite", "dónde inyectar test doubles",
  "e.g. node >= 20 · no new runtime dependencies · api field names in snake_case",
  "e.g., 90% of users complete [task] in under [n] seconds", "e.g., backend service", "e.g., db migrations",
  "e.g., error rate on [flow] stays below [n]%", "e.g., errors fail closed (deny) on the security path.",
  "e.g., every write is idempotent or explicitly justified.",
  "e.g., no breaking api change without a versioned migration path.",
  "e.g., no pii in logs; user ids are pseudonymized.", "e.g., second cache layer", "e.g., wire ui",
  "el comportamiento correcto", "el comportamiento vecino que ya funcionaba", "entorno / datos / cuentas necesarias",
  "entradas cercanas que deben seguir funcionando", "env / data / accounts needed", "error condition", "escenario",
  "estado", "estrategia por modo de fallo a partir de los requisitos",
  "estratégia por modo de falha a partir dos requisitos",
  "ex.: 90% dos utilizadores completam [tarefa] em menos de [n] segundos",
  "ex.: a taxa de erro em [fluxo] mantém-se abaixo de [n]%", "ex.: ligar a ui", "ex.: migrações de bd",
  "ex.: node >= 20 · sem dependências de runtime novas · campos da api em snake_case",
  "ex.: os erros falham fechados (negar) no caminho de segurança.", "ex.: segunda camada de cache",
  "ex.: sem alteração de api com quebra sem um caminho de migração versionado.",
  "ex.: sem pii nos logs; os ids de utilizador são pseudonimizados.", "ex.: serviço de backend",
  "ex.: toda a escrita é idempotente ou explicitamente justificada.",
  "exact values the fix must respect — versions, limits, formats", "existing components/modules this feature touches",
  "expected behavior", "factories, fixtures, seeds", "faz isto", "flow", "flujo", "fluxo", "full test suite command",
  "gatilho", "gdpr | pci | hipaa | soc2 | nenhuma", "gdpr | pci | hipaa | soc2 | ninguna",
  "gdpr | pci | hipaa | soc2 | none", "graceful handling", "hard tech/regulatory constraints that bound all designs.",
  "haz esto", "how it makes money", "how this integrates with the existing system. key decisions and rationale.",
  "how to break ties — e.g., 'prefer boring/proven over clever'.", "how to test this alone",
  "inputs próximos que têm de continuar a funcionar", "la condición que provoca el bug",
  "lo que esta función no incluye", "lo que esto explícitamente no es",
  "lo que ocurre — mensaje de error, salida, líneas de log", "load, ~$/month", "luego esto", "manejo elegante",
  "measurable performance / security / accessibility constraint", "mensagem do utilizador / {{variáveis}}",
  "mensaje del usuario / {{variables}}", "mitigación / rollback", "mitigation / rollback", "mitigação / rollback",
  "modelos, schemas, índices compartidos entre historias", "modelos, schemas, índices partilhados entre histórias",
  "models, schemas, indexes shared across stories", "métrica específica a 6 meses", "n",
  "nearby inputs that must keep working", "nenhuma", "network, fs, time, external services", "ninguna", "none",
  "o comportamento correto", "o comportamento vizinho que já funcionava",
  "o que acontece — mensagem de erro, output, linhas de log", "o que cada um cobre", "o que esta feature não inclui",
  "o que falha se isto estiver errado? quem é afetado? recuperável? em quanto tempo?",
  "o que isto explicitamente não é", "o que muda e porque é que elimina a causa raiz — uma correção, não um pacote.",
  "o que tem de mudar no código existente, e porquê", "observable result tied to a success criterion, e.g. sc-001",
  "onde injetar test doubles", "one line: the bug being fixed", "one line: what is broken, for whom, since when",
  "one sentence: what is this product and who is it for?",
  "p. ej.: node >= 20 · sin dependencias de runtime nuevas · campos de la api en snake_case",
  "p.ej., 90% de los usuarios completan [tarea] en menos de [n] segundos", "p.ej., conectar la ui",
  "p.ej., la tasa de error en [flujo] se mantiene por debajo de [n]%",
  "p.ej., los errores fallan cerrados (denegar) en la ruta de seguridad.", "p.ej., migraciones de bd",
  "p.ej., segunda capa de caché", "p.ej., servicio de backend",
  "p.ej., sin cambio de api con ruptura sin una ruta de migración versionada.",
  "p.ej., sin pii en los logs; los ids de usuario se pseudonimizan.",
  "p.ej., toda escritura es idempotente o explícitamente justificada.", "papel",
  "parallelizable task — different file, no deps", "path", "path → change", "por qué es la porción mínima viable",
  "por qué la opción simple falla", "por qué se aplica", "porque a opção simples falha", "porque se aplica",
  "porque é a fatia mínima viável", "principio 1", "principio 2", "principle 1", "principle 2", "princípio 1",
  "princípio 2", "project/dev setup if needed — deps, scaffolding", "propiedad siempre verdadera",
  "propriedade sempre verdadeira", "quem mais lhe toca?", "quem usa isto diariamente?",
  "qué cambia y por qué elimina la causa raíz — una corrección, no un paquete.", "qué cubre cada uno",
  "qué debe cambiar en el código existente, y por qué", "razão", "razón", "reason", "recovery", "recuperación",
  "recuperação", "red, fs, tiempo, servicios externos", "rede, fs, tempo, serviços externos",
  "relojes, aleatoriedad, ids abstraídos cómo", "relógios, aleatoriedade, ids abstraídos como",
  "restricciones técnicas/regulatorias rígidas que limitan todos los diseños.",
  "restricción medible de rendimiento / seguridad / accesibilidad",
  "restrição mensurável de desempenho / segurança / acessibilidade",
  "restrições técnicas/regulatórias rígidas que limitam todos os designs.",
  "resultado observable vinculado a un criterio de éxito, p.ej. sc-001",
  "resultado observável ligado a um critério de sucesso, ex. sc-001", "riesgo", "risco", "risk", "rol", "role", "ruta",
  "ruta → cambio", "scenario", "setup de projeto/dev se necessário — deps, scaffolding",
  "setup de proyecto/dev si hace falta — deps, scaffolding", "señal", "signal",
  "sim/não — se sim, load-test.md é obrigatório.", "sinal", "specific 6-month metric", "specific action",
  "specific value", "state", "story title", "strategy per failure mode from requirements",
  "sí/no — si sí, load-test.md es obligatorio.", "tarea", "tarea paralelizable — archivo distinto, sin deps", "tarefa",
  "tarefa paralelizável — ficheiro diferente, sem deps", "task", "the condition that triggers the bug",
  "the correct behavior", "the neighbouring behavior that already worked", "then this", "tratamento controlado",
  "trigger", "trigger an error condition from an if...then ac", "título da história", "título de la historia",
  "ubicuo", "ubiquitous", "ubíquo", "uma frase: o que é este produto e para quem é?", "uma linha: o bug a corrigir",
  "uma linha: o que está partido, para quem, desde quando", "una frase: ¿qué es este producto y para quién es?",
  "una línea: el bug a corregir", "una línea: qué está roto, para quién, desde cuándo", "unit/integración",
  "unit/integration", "unit/integração", "user message / {{variables}}", "valor específico",
  "valores exactos que la corrección debe respetar — versiones, límites, formatos",
  "valores exatos que a correção tem de respeitar — versões, limites, formatos",
  "what breaks if this is wrong? who is affected? recoverable? how fast?",
  "what changes and why it removes the root cause — one fix, not a bundle.", "what each covers",
  "what happens — error message, output, log lines", "what must change in existing code, and why",
  "what this feature does not include", "what this is explicitly not", "where test doubles inject",
  "who else touches it?", "who uses this daily?", "why it applies", "why the simple option fails",
  "why this is the minimum viable slice", "yes/no — if yes, load-test.md is required.", "¿quién más lo toca?",
  "¿quién usa esto a diario?", "¿qué se rompe si esto está mal? ¿a quién afecta? ¿recuperable? ¿en cuánto tiempo?",
  "árbol de directorios", "árvore de diretórios"
];
function templateCorpus(langs) {
  const out = [];
  const add = (fn) => { try { const t = fn(); if (typeof t === "string") out.push(t); } catch { /* a builder's trouble never breaks placeholder detection */ } };
  // Every set of at most TWO optional tracks, plus all of them — the builders compose per track, and the only interplay
  // they have is pairwise (+tdd's test IDs / green lines with another track, "+saas or +ai"), so pairs render every text
  // a larger set does (for three tracks this IS the full power set; it grows quadratically, not 2^n, as tracks are added).
  const combos = [[], ...OPTIONAL_TRACKS.map((t) => [t]), ...OPTIONAL_TRACKS.flatMap((t, i) => OPTIONAL_TRACKS.slice(i + 1).map((u) => [t, u])), OPTIONAL_TRACKS]
    .map((x) => ["core", ...x]);
  const signals = { tdd: ["tdd"], saas: ["tenant"], ai: ["llm"], sec: ["owasp"], privacy: ["gdpr"], dist: ["kafka"], api: ["openapi"], ui: ["wcag"], obs: ["slo"], data: ["etl"] };
  for (const l of langs || i18n.BASE_LANGS) { // the authored locales; pt-BR's slots come from pt's lines (templateSetsBr)
    const M = i18n.msg(l);
    for (const tracks of combos) {
      const a = { name: "x", tracks, label: trackLabel(tracks), slug: "x", summary: "" };
      add(() => i18n.classification(a, l));
      add(() => i18n.classification({ ...a, signals }, l));
      add(() => i18n.requirements(a, l));
      add(() => i18n.design(a, l));
      add(() => i18n.tasks(a, l));
      add(() => i18n.testPlan("x", l, tracks));
      add(() => i18n.checklist(a, l));
    }
    add(() => i18n.testPlan("x", l, VALID_TRACKS, ["US-1.AC-1"]));
    add(() => i18n.testPlan("x", l, ["core", "tdd"], [])); // requirements that define no AC yet: one generic row (Pa4)
    // 1.21 F5 — the sized builders (s: one story, the merged weigh section; m / l: the trimmed core design) and the change's one
    // file. Their slots differ from the unsized ones only in the core parts — the track blocks and criteria are the same
    // texts — so core alone, core +tdd and every track render each of them. (The bugfix tasks have one form for every size —
    // bugTasks below; the four-task form they replaced held no slot the current one doesn't.)
    for (const size of ["s", "m"]) {
      for (const tracks of [["core"], ["core", "tdd"], VALID_TRACKS]) {
        const a = { name: "x", tracks, label: trackLabel(tracks), slug: "x", summary: "", size };
        add(() => i18n.requirements(a, l));
        add(() => i18n.design(a, l));
        add(() => i18n.tasks(a, l));
        add(() => i18n.testPlan("x", l, tracks, undefined, size));
        add(() => i18n.checklist({ ...a, sectionCounts: {} }, l));
      }
    }
    add(() => i18n.change({ name: "x", summary: "" }, l));
    for (const tr of VALID_TRACKS) {
      add(() => i18n.trackDesignBlock(tr, l));
      add(() => M.tracks.taskBlock(tr, 1));
      add(() => M.tracks.acPlaceholder(tr));
    }
    for (const fn of [i18n.evalPlan, i18n.loadTest, i18n.quickstart, i18n.integrationPlan, i18n.promptStub, i18n.bugTestPlan, i18n.bugTasks]) add(() => fn("x", l));
    add(() => i18n.bugReport({ name: "x" }, l));
    add(() => i18n.bugRequirements({ name: "x" }, l));
    add(() => i18n.evalsReadme(l));
    for (const f of i18n.steeringKnownFiles()) add(() => i18n.steeringStub(f, l));
    add(() => M.scopedSteering.customStub("X", "src/api/**"));
    add(() => M.importSpec.taskAcPlaceholder + "\n" + M.importSpec.taskTestPlaceholder);
  }
  add(() => unknownSteeringStub("x.md"));
  return out;
}
// Every bracket group a text holds as the gates read it (visible lines, syntax and exempt groups set aside, nested
// groups too) → { brackets: [key], code: [key] } — code: a code span that is exactly one bracket group (`` `[path]` ``).
function templateBracketKeys(text, seen) {
  const brackets = [], code = [];
  const slot = (body) => { const b = body.match(/^\[([^[\]]*)\]$/); return !!b && !!b[1].trim(); };
  for (const [, line, refs] of visibleLines(text)) {
    if (seen && !refs.size) { if (seen.has(line)) continue; seen.add(line); } // the corpus repeats most lines
    for (const m of codeSpans(line)) if (slot(m.body.trim())) code.push(placeholderKey(m.body.trim().slice(1, -1)));
    scanBrackets(line, refs, slot, (inner, raw) => { brackets.push(placeholderKey(raw)); return false; });
  }
  return { brackets, code };
}
let TEMPLATE_SETS = null;
function templateSets() {
  if (TEMPLATE_SETS) return TEMPLATE_SETS;
  const c = builtinCorpus();
  return (TEMPLATE_SETS = c ? { brackets: new Set(c.brackets), code: new Set(c.code) } : renderTemplateSets());
}
function renderTemplateSets() {
  const brackets = new Set(LEGACY_TEMPLATE_PLACEHOLDERS), code = new Set();
  const seen = new Set();
  CTX.BUILTIN_CORPUS_BUILD++; // a process-wide cache: the current call's track packs never shape it (isPackMarkerBracket)
  try {
    for (const t of new Set(templateCorpus())) {
      const k = templateBracketKeys(t, seen);
      k.brackets.forEach((x) => brackets.add(x));
      k.code.forEach((x) => code.add(x));
    }
  } finally { CTX.BUILTIN_CORPUS_BUILD--; }
  return { brackets, code };
}
// pt-BR (1.14 D1) renders every pt template through i18n.toPtBr, whose rules never cross a line: its slots are exactly the
// pt corpus's visible bracket lines transformed one by one (the corpus is not rendered a fourth time). Built on the first
// bracket the EN/PT/ES sets don't know — checking a fresh EN/PT/ES scaffold never pays for it; only pt-BR's own keys are kept.
let TEMPLATE_SETS_BR = null;
function templateSetsBr() {
  if (TEMPLATE_SETS_BR) return TEMPLATE_SETS_BR;
  const c = builtinCorpus();
  return (TEMPLATE_SETS_BR = c ? { brackets: new Set(c.bracketsBr), code: new Set(c.codeBr) } : renderTemplateSetsBr(templateSets()));
}
function renderTemplateSetsBr(base) {
  const brackets = new Set(), code = new Set(), seen = new Set(), done = new Set();
  CTX.BUILTIN_CORPUS_BUILD++;
  try {
    for (const t of new Set(templateCorpus(["pt"]))) for (const [, line] of visibleLines(t)) {
      if (!line.includes("[") || done.has(line)) continue;
      done.add(line);
      const br = i18n.toPtBr(line);
      if (br === line) continue;
      const k = templateBracketKeys(br, seen);
      k.brackets.forEach((x) => { if (!base.brackets.has(x)) brackets.add(x); });
      k.code.forEach((x) => { if (!base.code.has(x)) code.add(x); });
    }
  } finally { CTX.BUILTIN_CORPUS_BUILD--; }
  return { brackets, code };
}

// ---------------------------------------------------------------------------
// The pre-generated built-in corpus (1.20)
// ---------------------------------------------------------------------------
// The built-in part of the corpus — templateSets, templateSetsBr, templateTaskSet, the bug steps — is the same in every
// process of one engine, and rendering it (1,165 texts, their pt-BR twins through toPtBr: ~200 ms) was the biggest slice of
// a hook or CLI call. scripts/build.js (`npm run build`) renders it ONCE with the functions above (renderCorpusData) into
// engine/corpus.generated.json, stamped with the hash of CORPUS_SOURCES — every file the render runs through (mcp/test.js
// proves the list with V8 coverage) — and nothing else: no version (1.26 — the render never reads it, so a release that changes
// no source keeps the same file). A process reads that file (one JSON.parse) only while the stamp matches the engine it LOADED
// (the sources as they were at load — LOADED_STATS below); otherwise —
// a hand-edited clone that wasn't rebuilt, a missing or broken file, sources updated under a running process — it renders
// as before: a slower answer, never a wrong one. Inside spec.bundle.js the corpus is the copy the build embedded beside the
// very sources it was rendered from (module.bundle — undefined under Node's own loader). The per-project part (the
// project's templates, its track packs: projectTemplateHas, packCorpusSets) stays computed per call. Only .has() is ever
// asked of these sets. 1.24 r6 I-I2 (review 6, I1): every OTHER all-language template set a gate asks about comes from it too —
// the steering stubs (isSteeringStub), the scaffold's diagrams (templateDiagramSet), the track design blocks' lines
// (sectionTemplateLines), the bug report's slots (bugTemplateSlots) and the requirement templates (builtinTemplateReqs): rendered,
// they loaded pt.js, es.js and pt-BR into every English doctor / next_action / done / finish / catalog (~78 ms a call).
const CORPUS_FILE = "corpus.generated.json";
const CORPUS_KEYS = ["brackets", "code", "bracketsBr", "codeBr", "tasks", "bugSteps", "diagrams", "sectionLines", "sectionLinesBr", "bugSlots"];
const sortList = (xs) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // code-unit order, stable across Node versions
const CORPUS_SOURCES = ["i18n.js", "i18n/common.js", "i18n/en.js", "i18n/es.js", "i18n/pt-br.js", "i18n/pt.js", "engine/core.js",
  "engine/markdown.js", "engine/packs.js", "engine/tasks.js", "engine/tracks.js"]; // mcp/lib-relative, in hash order
// A source file's text as the stamp reads it: a leading BOM and CRLF line ends are encoding, not code.
function sourceText(buf) {
  if (!buf.includes(13) && !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)) return buf;
  const s = buf.toString("utf8").replace(/\r\n/g, "\n");
  return Buffer.from(s.charCodeAt(0) === 0xfeff ? s.slice(1) : s, "utf8");
}
// sha1 over CORPUS_SOURCES (each file's path and text) — libDir: the mcp/lib folder (default: this engine's).
function corpusSourcesHash(libDir) {
  const dir = libDir || path.join(__dirname, "..");
  const h = crypto.createHash("sha1");
  for (const rel of CORPUS_SOURCES) h.update(rel + "\0").update(sourceText(fs.readFileSync(path.join(dir, ...rel.split("/"))))).update("\0");
  return h.digest("hex");
}
// The stamp's inputs as this process LOADED them (1.20 review). A long-lived process — the MCP server — keeps the code it
// loaded while a `git pull` or `npm run build` rewrites the sources AND the corpus under it: compared with the files as they
// are at its first placeholder question, the old code would trust a corpus rendered from the NEW sources (a reworded slot of
// its own fresh scaffold would then read as the user's text). So every source's size, mtime and ctime are taken as the engine
// loads (one stat each, no read — ~0.5 ms); the file is trusted only while every source still has them — its text on disk is then the text this process runs, and the sources
// hash is compared as before (an edit that keeps a file's size, mtime AND ctime is the accepted limit). A language file loads
// on its first use (i18n.js): one that loads after the corpus was trusted and has changed since the engine loaded drops the
// corpus (localeLoaded) — the sets render again, from the code this process now runs. Not in a bundle (its corpus is
// embedded beside the very sources it was rendered from, which never change under it).
const sourceStat = (rel) => {
  try { const st = fs.statSync(path.join(__dirname, "..", ...rel.split("/"))); return st.size + ":" + st.mtimeMs + ":" + st.ctimeMs; } catch { return null; }
};
const LOADED_STATS = module.bundle ? null : new Map(CORPUS_SOURCES.map((rel) => [rel, sourceStat(rel)]));
const sourcesUnchanged = () => !!LOADED_STATS && CORPUS_SOURCES.every((rel) => { const s = LOADED_STATS.get(rel); return s !== null && sourceStat(rel) === s; });
// The built-in corpus as it renders now → { brackets, code, bracketsBr, codeBr, tasks, bugSteps, taskHeadings, steeringStubs,
// diagrams, sectionLines, sectionLinesBr, bugSlots, templateReqs }: sorted string lists (the sets' members — code-unit order,
// stable across Node versions) — the requirement templates in render order. What scripts/build.js writes, and what the tests compare.
function renderCorpusData() {
  const sort = sortList;
  const base = renderTemplateSets(), br = renderTemplateSetsBr(base);
  return { brackets: sort(base.brackets), code: sort(base.code), bracketsBr: sort(br.brackets), codeBr: sort(br.code),
    tasks: sort(renderTemplateTasks()), bugSteps: sort(new Set(renderBugSteps())),
    // 1.22 review: every built-in track's template task headings, all languages (trackTaskHeadings — tracks.js)
    taskHeadings: Object.fromEntries(VALID_TRACKS.map((t) => [t, sort(renderTrackTaskHeadings(t))])),
    // 1.24 r6 I-I2: the gates' other all-language sets
    steeringStubs: renderSteeringStubs(), diagrams: renderTemplateDiagrams(), sectionLines: renderSectionLines("base"),
    sectionLinesBr: renderSectionLines("pt-BR"), bugSlots: renderBugSlots(), templateReqs: renderTemplateReqs() };
}
// The corpus's task headings, steering stubs, requirement templates: { key: [string…] } — strings only, own keys.
const taskHeadingsShape = (h) => !!h && typeof h === "object" && !Array.isArray(h) &&
  Object.values(h).every((v) => Array.isArray(v) && v.every((x) => typeof x === "string"));
let BUILTIN_CORPUS = undefined; // undefined: not looked for yet · null: none usable (render) · else the data
let BUILTIN_CORPUS_FROM = "render"; // "file" | "bundle" | "render" — where this process's built-in corpus comes from
function builtinCorpus() {
  if (BUILTIN_CORPUS !== undefined) return BUILTIN_CORPUS;
  BUILTIN_CORPUS = null;
  try {
    const b = module.bundle; // set by spec.bundle.js's module registry only
    const data = b ? b.corpus() : JSON.parse(fs.readFileSync(path.join(__dirname, CORPUS_FILE), "utf8"));
    // (The modules) the sources' hash, the sources unchanged since the engine loaded — stat'ed AFTER the hash read them, so a
    // file rewritten before or while it was hashed is never trusted. No version (1.26): a `version` key an older build wrote is
    // ignored — the hash alone decides, and an older corpus of the same sources is the same corpus.
    if (data && typeof data === "object" && CORPUS_KEYS.every((k) => Array.isArray(data[k]) && data[k].every((x) => typeof x === "string")) &&
      taskHeadingsShape(data.taskHeadings) && taskHeadingsShape(data.steeringStubs) && taskHeadingsShape(data.templateReqs) && (b ? data.sources === b.corpusSources : data.sources === corpusSourcesHash() && sourcesUnchanged())) {
      BUILTIN_CORPUS = data;
      BUILTIN_CORPUS_FROM = b ? "bundle" : "file";
    }
  } catch { /* missing, unreadable or malformed: render */ }
  return BUILTIN_CORPUS;
}
const builtinCorpusSource = () => { builtinCorpus(); return BUILTIN_CORPUS_FROM; };
// A built-in track's template task headings from the trusted corpus (normalized, every language), or null: trackTaskHeadings
// renders them then (1.22 review — rendered, they load pt.js, es.js and pt-BR into an English process).
function builtinTaskHeadings(tr) {
  const c = builtinCorpus();
  return c && Object.prototype.hasOwnProperty.call(c.taskHeadings, tr) ? c.taskHeadings[tr] : null;
}
// i18n.js tells us each language file it loads (en / pt / es.js on first use, pt-br.js): one changed since the engine loaded
// makes a trusted file corpus the corpus of code this process doesn't run — dropped, with the sets built from it.
function localeLoaded(rel) {
  if (BUILTIN_CORPUS_FROM !== "file" || !LOADED_STATS.has(rel) || sourceStat(rel) === LOADED_STATS.get(rel)) return;
  BUILTIN_CORPUS = null; // looked for, none usable: the sets render on their next use
  BUILTIN_CORPUS_FROM = "render";
  TEMPLATE_SETS = TEMPLATE_SETS_BR = TEMPLATE_TASKS = BUG_STEPS = null;
  STEERING_STUBS = TEMPLATE_DIAGRAMS = SECTION_TEMPLATE_LINES = SECTION_TEMPLATE_LINES_BR = BUG_SLOTS = TEMPLATE_REQS = null; // 1.24 r6 I-I2
  TASK_HEADINGS.clear(); // tracks.js's per-track sets, read from it (1.22 review)
}
if (LOADED_STATS) i18n.onLocaleLoad(localeLoaded);
// …and the slots of the project's own templates (.specs/templates/ — projectTemplateHas, 1.14).
// A bracket longer than SLOT_MAX is no template's slot (only a generic one — "[TODO: …]" — can be that long): never keyed (review 5).
const isTemplatePlaceholder = (inner) => {
  if (String(inner).length > SLOT_MAX) return isGenericSlot(inner);
  const k = placeholderKey(inner);
  return isGenericSlot(inner) || templateSets().brackets.has(k) || templateSetsBr().brackets.has(k) || projectTemplateHas("brackets", k);
};
// A code span is opaque — `[Authorize]`, `[dependencies]`, `[aeiou]`, `[]`, `["a"]` are code — except a template's own
// code-span slot (the bugfix test plan's `[path]` / `[caminho]` / `[ruta]`), which is unwrapped and scanned.
const isCodeSlot = (body) => { const b = body.match(/^\[([^[\]]*)\]$/); if (!b) return false; const k = placeholderKey(b[1]); return templateSets().code.has(k) || templateSetsBr().code.has(k) || projectTemplateHas("code", k); };

// [lineNo, content, refs] — the lines a placeholder can sit on: HTML comments, fenced code and reference definitions
// set aside (refs: the reference labels those define, so a bare `[x]` with a `[x]: url` is a link).
function visibleLines(text) {
  const lines = String(text || "").split(/\r?\n/);
  const refs = new Set();
  const visible = [];
  // commentLines: fenced code (an unclosed fence in a list item ends with the item) and comments — a "<!--" that never
  // closes, or that sits in a code span or a fence, is text: it hides no placeholder below it.
  const cl = commentLines(lines);
  lines.forEach((raw, i) => {
    const c = cl[i];
    if (c.hidden || c.fence) return;
    const line = c.vis;
    const def = line.match(RE_REF_DEFINITION);
    if (def) { refs.add(def[1].trim().toLowerCase()); return; }
    visible.push([i + 1, line]);
  });
  return visible.map(([n, l]) => [n, l, refs]);
}

// [{ line, text, kind }] — the template placeholders left in `text` (1-based line, the placeholder as written,
// kind 'bracket' | 'todo'):
//   • a bracket whose text a template writes (isTemplatePlaceholder): `[trigger]`, `[1-2 sentences: what this does and
//     why it matters]`, `[N]`, `$[0.03]`, an empty `[]` / `[ ]` slot, the code-span slots (`` `[path]` ``), and the
//     generic TODO / TBD / FIXME / … tokens — a half-edited template sentence still reports the slot left inside it;
//   • the `> **TODO**` sentinel line.
// NOT placeholders: every other bracket (the user's own values — `[free: 60, pro: 600]`, `[owner, admin]`, `[0, 1]`),
// links/images `[x](y)`, reference links `[x][y]` (and a bare `[x]` whose `[x]: url` is defined), footnotes `[^1]`,
// callouts `> [!NOTE]`, wiki links `[[x]]`, list checkboxes `- [ ]` / `- [x]`, the English-stable tags ([US1] [P]
// [shared] [SaaS] [AI], priorities [P1]), stable IDs ([US-1.AC-1], [T-01]…), indexing glued to a word (`x[0]`), escaped
// `\[`, [NEEDS CLARIFICATION] (clarificationMarkers tracks those), the pre-1.13 core-only answer `[none beyond core]`
// (PT/ES too), every other code span, and anything inside HTML comments or fenced code. Language-agnostic.
function placeholderReport(text) {
  const out = [];
  for (const [ln, line, refs] of visibleLines(text)) {
    if (RE_TODO_SENTINEL.test(line)) { out.push({ line: ln, text: line.trim(), kind: "todo" }); continue; }
    bracketPlaceholders(line, refs).forEach((t) => out.push({ line: ln, text: t, kind: "bracket" }));
  }
  return out;
}

function bracketPlaceholders(line, refs) {
  const found = [];
  scanBrackets(line, refs, isCodeSlot, (inner, raw, i, j, s) => {
    if (!isTemplatePlaceholder(raw)) return false;
    // 1.25.1: an EMPTY ([] / [ ]) or ELLIPSIS ([...] / […]) bracket is a slot only where a template writes one — a field's whole value
    if (RE_BARE_SLOT.test(raw) && !wholeValueAt(s, i, j)) return false;
    found.push("[" + inner + "]");
    return true;
  });
  return found;
}
// 1.25.1 — every empty / ellipsis slot the templates write is a field's WHOLE value: the line's own (after a list marker, a checkbox
// or a quote: "- []", "1. []"), a label's after its colon ("- **Test runner:** []", "Secret store: [] — never in code…", "SAST: [] ·
// dependency audit: []"), a table cell's or an item of a " · " field list. Anywhere else it is the user's text — "THE SYSTEM SHALL
// return HTTP 200 with an empty array []", "… append [...]", "returns a []string" (glued to the text after it) failed placeholders
// and refused the approval.
const RE_BARE_SLOT = /^\s*(?:\.{3,}|…+)?\s*$/u;
const RE_VALUE_LEAD = /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])(?:\s+\[[ xX]\])?)?$/;
function wholeValueAt(s, i, j) {
  if (/[\p{L}\p{N}_]/u.test(s[j + 1] || "")) return false; // glued to the text after it: `[]string`, `[...]rest`
  let k = i;
  while (k > 0 && /[\s*_]/.test(s[k - 1])) k--; // spaces and emphasis ("**Label:** []")
  if (k === 0) return true;
  const c = s[k - 1];
  return c === ":" || c === "|" || c === "·" || RE_VALUE_LEAD.test(s.slice(0, k));
}

// The bracket groups of one line, outermost first: visit(inner, rawInner) → true = a placeholder (its nested groups are
// part of it), false = not (its nested groups are visited in turn — a template sentence half edited keeps its `[N]`).
// Syntax (links, reference links, footnotes, callouts, wiki links, glued indexing, the list checkbox) and the exempt
// contents (stable tags / IDs, NEEDS CLARIFICATION, the legacy core-only answer) are skipped whole, never visited.
// codeSlot(body) says which code spans are unwrapped; every other span is blanked (columns kept). Linear per line (review 5,
// P5): every "[" learns its closer from ONE stack pass (it rescanned to its closer at every nesting level), the groups are
// walked with an explicit stack (one recursion per level overflowed the call stack: a 24 KB line of nested "[a [a …]]" threw
// RangeError out of ears_validate, doctor and approve), and a group longer than SLOT_MAX is looked up nowhere — no template slot,
// reference label or marker is that long, and keying each level's inner text made the walk quadratic.
const SLOT_MAX = 1000; // longer than any template slot (the built-in corpus' longest is under 200) and CommonMark's link label (999)
function bracketCloser(s) { // → closer[i] = the index of the "]" closing the "[" at i (nesting-aware, "\" escapes the next character), or -1
  const closer = new Int32Array(s.length).fill(-1);
  const open = [];
  for (let j = 0; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "[") open.push(j);
    else if (c === "]" && open.length) closer[open.pop()] = j;
  }
  return closer;
}
function scanBrackets(line, refs, codeSlot, visit) {
  const s = replaceCodeSpans(line, (m, tick, body) =>
    codeSlot(body.trim()) ? tick.replace(/`/g, " ") + body + tick.replace(/`/g, " ") : " ".repeat(m.length));
  if (!s.includes("[")) return;
  const box = s.match(RE_LIST_CHECKBOX);
  const closer = bracketCloser(s);
  // Frames [from, to]: a group's inner range is walked before the rest of the range that holds it (the recursion's order).
  const frames = [[box ? box[0].length : 0, s.length]];
  while (frames.length) {
    const [from, to] = frames.pop();
    for (let i = from; i < to; i++) {
      if (s[i] === "\\") { i++; continue; }
      if (s[i] !== "[") continue;
      const j = closer[i];
      if (j === -1 || j >= to) break; // unbalanced: nothing reliable after this point in this range
      const inner = s.slice(i + 1, j);
      const before = i > 0 ? s[i - 1] : "";
      const after = s[j + 1] || "";
      const short = inner.length <= SLOT_MAX;
      let skip = after === "(" || /[\p{L}\p{N}_]/u.test(before) ||
        (inner.startsWith("[") && inner.endsWith("]")) || inner.startsWith("^") || inner.startsWith("!") ||
        (short && (refs.has(inner.trim().toLowerCase()) || RE_STABLE_BRACKET.test(inner) || RE_LEGACY_ANSWER.test(inner) ||
          isPackMarkerBracket(inner))) || /^NEEDS[ _-]CLARIFICATION/i.test(inner); // a track pack's [MARKER] (1.15) is as stable as [SaaS]
      let end = j;
      if (after === "[") { // reference link [x][y]: both halves are syntax
        const k = closer[j + 1];
        if (k !== -1) { skip = true; end = k; }
      }
      if (!skip && !visit(inner, line.slice(i + 1, j), i, j, s)) { // rawInner: code spans intact (columns kept); the group's place (1.25.1)
        frames.push([end + 1, to], [i + 1, j]); // the group's inside next, then the rest of this range
        break;
      }
      i = end;
    }
  }
}

// 'missing' | 'placeholder' | 'filled' for an artifact — `input` is { file } or { text }, or a string
// (a single-line string that is absolute or ends in .md/.json is a path, anything else is text). The rule is
// deterministic and language-agnostic:
//   missing      no input, or the file does not exist;
//   placeholder  it exists but (a) holds nothing beyond headings once HTML comments are set aside, (b) still
//                contains a template placeholder (placeholderReport: bracketed prose or the `> **TODO**`
//                sentinel), or (c) equals `opts.template` (a string or a list) ignoring whitespace;
//   filled       anything else.
function artifactState(input, opts = {}) {
  if (input == null) return "missing";
  let text;
  if (typeof input === "object") text = input.file != null ? readIfExists(input.file) : input.text;
  else if (!/[\r\n]/.test(input) && (path.isAbsolute(input) || /\.(md|markdown|json)$/i.test(input))) text = readIfExists(input);
  else text = String(input);
  if (text == null) return "missing";
  const squash = squashText; // whitespace aside (the steering stubs' hashes are taken the same way — isSteeringStub)
  const templates = opts.template == null ? [] : [].concat(opts.template);
  if (templates.some((tpl) => squash(tpl) === squash(text))) return "placeholder";
  if (headingsOnly(text)) return "placeholder";
  return placeholderReport(text).length ? "placeholder" : "filled";
}
// Nothing beyond headings once HTML comments are set aside (a skeleton, or what's left after inactive sections go).
function headingsOnly(text) {
  return !stripHtmlComments(text).split(/\r?\n/).some((l) => l.trim() && !/^#{1,6}(\s|$)/.test(l.trim()));
}

// `_Verify: [manual: …]_` names a human check (not a runnable command) — not a template placeholder.
const RE_MANUAL_VERIFY = /_Verify:\s*`?\[\s*manual\b/i;
// An artifact as the gates judge it: its ACTIVE part (a removed track's [SaaS]/[AI] sections and task blocks are
// inactive), with each placeholder's real line number. → { file, state: missing | placeholder | filled,
// items: [{ line, text }], empty }. The scaffold's +saas/+ai track tasks left verbatim are NOT placeholders here:
// "Enforce tenant isolation — every query scoped by tenant_id" is a concrete, traced task (the template's T-IDs map
// to them) — counting them made doctor FAIL and next_action say "fill tasks.md" in the middle of execution. Only the
// tasks approval gate asks for one real task beyond them (approvalChecks, isPlaceholderTask — detectPhase's rule).
function artifactReport(dir, file, tracks, preloaded) {
  useTemplateScopeOf(dir); // the project's templates are template text too (1.14)
  const raw = preloaded !== undefined ? preloaded : readIfExists(path.join(dir, file)); // preloaded: null = missing
  if (raw == null) return { file, state: "missing", items: [], empty: false };
  const lines = raw.split(/\r?\n/);
  const drop = file === "tasks.md" ? inactiveTaskLines(raw, tracks)
    : file === "requirements.md" || file === "design.md" ? inactiveMarkerLines(raw, tracks) : new Set();
  let found = placeholderReport(raw).filter((p) => !drop.has(p.line - 1));
  if (file === "bug.md") found = bugPlaceholders(raw, found); // quoted evidence ([object Object], [WARN]) is not a slot
  let items = found.map((p) => ({ line: p.line, text: p.text }));
  if (file === "tasks.md") items = items.filter((p) => !(/^\[\s*manual\b/i.test(p.text) && RE_MANUAL_VERIFY.test(lines[p.line - 1])));
  const empty = headingsOnly(lines.filter((_, i) => !drop.has(i)).join("\n"));
  return { file, state: empty || items.length ? "placeholder" : "filled", items, empty };
}

// artifactReport by feature name (resolver-aware) — for the hooks and the CLI. null when the feature doesn't exist.
// text: the content to judge instead of the file on disk (the pre-commit hook passes the STAGED version).
function featurePlaceholders(projectDir, name, file, text) {
  const f = existingFeature(projectDir, name);
  return f.ok ? artifactReport(f.dir, file, detectTracks(f.dir), typeof text === "string" ? text : undefined) : null;
}

// "requirements.md (17): requirements.md:11 [1-2 sentences…], …, +12 more" — bounded (5 per file) for every surface.
function placeholderSummary(reports, lang) {
  const G = i18n.msg(lang).gates;
  const short = (s) => (s.length > 48 ? s.slice(0, 47) + "…" : s);
  return reports.map((r) => {
    if (!r.items.length) return `${r.file} (${G.empty})`;
    const shown = r.items.slice(0, 5).map((p) => `${r.file}:${p.line} ${short(p.text)}`);
    if (r.items.length > 5) shown.push(G.more(r.items.length - 5));
    return `${r.file} (${r.items.length}): ${shown.join(", ")}`;
  }).join("; ");
}

// Chain artifacts still holding template placeholders, split at the current phase: `blocking` (current and earlier)
// fail the gates, `later` are informational. blockingOnly skips reading the later ones (the roadmap refresh runs on
// every mutation, for every feature — file reads are its cost).
function chainPlaceholders(dir, tracks, kind, phase, blockingOnly, texts) {
  const cur = flowPhaseIndex(phase, featureFlow(dir, kind)); // C3: on the flow's scale (chainArtifacts' idx follows it)
  const all = chainArtifacts(dir, tracks, kind).filter((a) => !blockingOnly || a.idx <= cur)
    .map((a) => ({ ...artifactReport(dir, a.file, tracks, texts ? texts[a.file] : undefined), idx: a.idx })).filter((r) => r.state === "placeholder");
  return { all, blocking: all.filter((r) => r.idx <= cur), later: all.filter((r) => r.idx > cur) };
}
// Some prose (written content — writtenContent) once brackets (nested too), HTML comments and the TODO sentinel are set aside: a root cause written as
// nothing but "[the cause, with evidence]" is not written yet — whatever the bracket says. A bracket group is set aside when it
// closes on its own line (its nested groups with it); an unbalanced "[" or "]" stays. ONE pass (review 5, P5): a stack of the
// open "[" (emptied at each line break) marks each closed group in a difference array — removing the innermost groups again and
// again until nothing changed was quadratic in the nesting (60 KB of nested "[a" in bug.md: 2.9 s).
function hasProseOutsideBrackets(body) {
  const t = stripHtmlComments(body).replace(RE_TODO_SENTINEL_LINE, " ");
  const diff = new Int32Array(t.length + 1);
  const open = [];
  for (let j = 0; j < t.length; j++) {
    const c = t[j];
    if (c === "\n") open.length = 0;
    else if (c === "[") open.push(j);
    else if (c === "]" && open.length) { diff[open.pop()]++; diff[j + 1]--; }
  }
  const outside = []; // the text outside every closed group, in pieces (a letter outside the BMP stays whole)
  let cut = 0, from = 0;
  for (let j = 0; j < t.length; j++) {
    const was = cut;
    cut += diff[j];
    if (!was && cut) outside.push(t.slice(from, j));
    else if (was && !cut) from = j;
  }
  if (!cut) outside.push(t.slice(from));
  // 1.24 review 6 (F4): "prose" is WRITTEN content (writtenContent — never a generic slot line, TBD / TODO / "Pending." / "…", a
  // punctuation-only line or bare structure) — a Root Cause "TBD" passed the iron law, a Constitution Check "TBD" its gate.
  const w = writtenContent(outside.join(" "));
  return w.prose.length > 0 || w.code.some((l) => RE_WORD_CHAR.test(l));
}
// bug.md is a bug REPORT: its Reproduction, Expected vs Actual and Root Cause quote logs, output and error text, full of
// brackets that are evidence, not slots — `[object Object]`, `[WARN]`, a regex class `[A-Z]`, `[Error: ENOENT …]`,
// `[Invalid Date]`. The generic rule (any bracketed prose is a slot) reported a written root cause as "not filled": the
// design approval, the fix tasks and finish were refused with no word about the bracket. In bug.md a bracket is a
// placeholder only when it IS one of the bug report's own slots (bugTemplateSlots, every language) or when its section
// holds nothing but brackets (no prose written around them). The TODO sentinel always counts.
// → the `items` (placeholderReport(text) entries) that still count.
function bugPlaceholders(text, items) {
  const lines = String(text || "").split(/\r?\n/);
  const heads = headingEntries(lines); // the ONE heading reader (review 5, M2): setext and indented headings, never one in a comment
  const headAt = new Map(heads.map((h) => [h.i, h]));
  const slots = bugTemplateSlots();
  const unitCache = new Map();
  // A heading line is judged on its own text; any other line on its section's body (up to the next heading).
  const unitHasProse = (i) => {
    const own = headAt.get(i);
    const start = own || heads.filter((h) => h.i < i).pop();
    const key = own ? "h" + i : "s" + (start ? start.i : -1);
    if (!unitCache.has(key)) {
      const from = start ? start.body : 0;
      const end = heads.find((h) => h.i > (start ? start.i : -1));
      const body = own ? own.text : lines.slice(from, end ? end.i : lines.length).join("\n");
      unitCache.set(key, hasProseOutsideBrackets(body));
    }
    return unitCache.get(key);
  };
  const isSlot = (k) => slots.has(k) || projectTemplateHas("bugSlots", k); // + the slots of the project's bug.md template (1.14)
  return (items || []).filter((p) => p.kind !== "bracket" || isSlot(placeholderKey(String(p.text).slice(1, -1))) || !unitHasProse(p.line - 1));
}
// (hasProseOutsideBrackets: the blank lines above a sentinel line are no longer part of what is blanked — they hold no
// bracket, letter or digit, so its answer is the same; 1.17 H, as RE_TODO_SENTINEL)
const RE_TODO_SENTINEL_LINE = /^[^\S\n\r\u2028\u2029]*>\s*\*\*TODO\*\*.*$/gm;
// Every bracketed slot of the bug report template, in every language (the Summary slot included: built without one) — from the
// corpus (1.24 r6 I-I2), rendered when it can't be trusted.
let BUG_SLOTS = null;
function renderBugSlots() {
  const set = new Set();
  for (const l of i18n.LANGS) {
    let t;
    try { t = i18n.bugReport({ name: "x" }, l); } catch { continue; } // a builder's trouble never breaks the check
    for (const m of String(t || "").matchAll(/\[([^[\]\n]*)\]/g)) set.add(placeholderKey(m[1]));
  }
  return sortList(set);
}
function bugTemplateSlots() {
  if (BUG_SLOTS) return BUG_SLOTS;
  const c = builtinCorpus();
  return (BUG_SLOTS = new Set(c ? c.bugSlots : renderBugSlots()));
}

// 1.24 r6 I-I2 — the steering stubs of every language (doctor's steering check: a steering file whose body is still one of them
// verbatim, whitespace aside, is a template — scaffold.js steeringPlaceholders): per known file, the sha1 of each stub with its
// whitespace taken out (artifactState's comparison), from the corpus — never every language's text rendered to compare one file.
const squashText = (x) => String(x).replace(/\s+/g, "");
const stubHash = (text) => crypto.createHash("sha1").update(squashText(text)).digest("hex");
function renderSteeringStubs() {
  const out = {};
  for (const f of sortList(i18n.steeringKnownFiles())) {
    const hs = new Set();
    for (const l of i18n.LANGS) { const t = i18n.steeringStub(f, l); if (typeof t === "string" && t) hs.add(stubHash(t)); }
    out[f] = sortList(hs);
  }
  return out;
}
let STEERING_STUBS = null; // { file: [hash…] } — process-wide
function isSteeringStub(file, text) {
  if (!STEERING_STUBS) { const c = builtinCorpus(); STEERING_STUBS = c ? c.steeringStubs : renderSteeringStubs(); }
  const hs = typeof file === "string" && Object.prototype.hasOwnProperty.call(STEERING_STUBS, file) ? STEERING_STUBS[file] : null;
  return !!hs && hs.includes(stubHash(text));
}
// 1.24 r6 I-I2 — the built-in requirement templates (EN / PT / pt-BR / ES: every built-in track's requirements.md, the bugfix's)
// whose criteria the cross-feature check (quality.js builtinTemplateAcs) sets aside: { lang: [text…] }, in render order. The texts
// themselves (i18n only): their criteria are read live (acIndex), so the corpus never depends on the criteria readers.
function renderTemplateReqs() {
  const out = {};
  for (const l of i18n.LANGS) {
    out[l] = [];
    for (const fn of [() => i18n.requirements({ name: "x", tracks: VALID_TRACKS.slice(), summary: "" }, l), () => i18n.bugRequirements({ name: "x" }, l)]) {
      try { const t = fn(); if (typeof t === "string") out[l].push(t); } catch { /* a builder's trouble never breaks the check */ }
    }
  }
  return out;
}
let TEMPLATE_REQS = null; // [[text, lang]…] in i18n.LANGS order — process-wide (quality.js keys its table on this array)
function builtinTemplateReqs() {
  if (TEMPLATE_REQS) return TEMPLATE_REQS;
  const c = builtinCorpus();
  const by = c ? c.templateReqs : renderTemplateReqs();
  return (TEMPLATE_REQS = i18n.LANGS.flatMap((l) => (Object.prototype.hasOwnProperty.call(by, l) ? by[l] : []).map((t) => [t, l])));
}

module.exports = { stripHtmlComments, commentLines, stripFencedCode, codeBlockLines, requirementAcIds, stripForeignAcRefs, RE_NOT_A_SLUG, RE_ID_TOKEN_END,
  notASlug, featureRefTest, RE_LEAD_LABEL, RE_CELL_LABEL, criterionLabel, criterionLabelIds,
  otherFeatureTest, featureProjectDir, planIdText, clarificationMarkers,
  templateTaskSet, bugStepSet, isBugStep, isPlaceholderTask, RE_FENCE, RE_FENCE_CLOSE, closesFence, fenceStep, tableCells,
  headingEntries, headingIndex, headingLeadSource, RE_HEADING_LEAD, headingLeadRe, RE_SYN_INFLECTION, headingMatches, headingTextMatches, synonymsOverlap, sectionOverlaps, extractSection,
  sectionContent, writtenContent, genericAnswer, lineAnswers, isTableSep, SLOT_MAX, bracketCloser, mermaidBlocks, mermaidState,
  RE_TODO_SENTINEL, ROOT_CAUSE_SYN, REPRO_SYN, sectionState, sectionLineKey, sectionOwnLines, RE_NA_LEAD, NA_REASON_WORDS, naAnswer,
  trackSectionReport, sectionVerdict, RE_STABLE_BRACKET, RE_REF_DEFINITION, RE_LEGACY_ANSWER,
  RE_LIST_CHECKBOX, placeholderKey, isGenericSlot, unknownSteeringStub, LEGACY_TEMPLATE_PLACEHOLDERS, templateCorpus,
  templateBracketKeys, templateSets, templateSetsBr, CORPUS_FILE, CORPUS_SOURCES, corpusSourcesHash, renderCorpusData,
  builtinCorpusSource, builtinTaskHeadings, isTemplatePlaceholder, isCodeSlot, visibleLines, placeholderReport,
  bracketPlaceholders, scanBrackets, artifactState, headingsOnly, RE_MANUAL_VERIFY, artifactReport, featurePlaceholders,
  placeholderSummary, chainPlaceholders, hasProseOutsideBrackets, bugPlaceholders, RE_TODO_SENTINEL_LINE,
  bugTemplateSlots, renderBugSlots, renderSectionLines, renderTemplateDiagrams, templateDiagramSet, renderSteeringStubs, isSteeringStub,
  renderTemplateReqs, builtinTemplateReqs, __link };

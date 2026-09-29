"use strict";

/**
 * dev-spec-driven engine — markdown readers.
 * The ONE reader of HTML comments (commentLines), fences (closesFence / fenceStep), headings and sections
 * (headingIndex, headingMatches, extractSection) and the artifact ID readers built on them (requirementAcIds, planIdText).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const { MARKER_TRACKS } = require("./tracks.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let atxHeading, backtickRuns, extractAcIds, hasOutsideCode, indentOf, markerTracks, packRegistry, stripSupersedes,
  trackMarker;
function __link(E) { ({ atxHeading, backtickRuns, extractAcIds, hasOutsideCode, indentOf, markerTracks, packRegistry,
  stripSupersedes, trackMarker } = E); }

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
function stripFencedCode(s) {
  const st = { fence: null };
  return String(s || "").split("\n").map((line) => (fenceStep(st, line) ? "" : line)).join("\n");
}
// requirements.md's own AC IDs as the tools read them: outside HTML comments and fenced code, `_Supersedes:_`
// references (another feature's ACs) left out.
function requirementAcIds(reqText) {
  return extractAcIds(stripSupersedes(stripFencedCode(stripHtmlComments(reqText))));
}
// test-plan.md as every reader of its IDs sees it — trace_check's coverage and planned T-IDs, its test-code scan, the
// Phase 4 gate, doctor, finish, the brief and impact: outside HTML comments AND fenced code. A fenced example row
// (`| T-02 | US-1.AC-2 | … |` in a ```md block) is no planned test: it counted as coverage (a false traceability pass for an
// AC with no real row) and as a planned T-ID the tests gate then demanded in the test code.
function planIdText(planText) {
  return stripFencedCode(stripHtmlComments(planText));
}

// Count unresolved [NEEDS CLARIFICATION: ...] markers in real content (not template comments).
function clarificationMarkers(md) {
  const text = stripHtmlComments(md);
  const out = [];
  const re = /\[NEEDS[ _-]CLARIFICATION:?([^\]\n]{0,500})\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) out.push((m[1] || "").trim());
  return out;
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

// Heading lines outside fenced code (a "# comment" inside a bash block is not a heading).
function headingIndex(lines) {
  const out = [];
  const fst = { fence: null };
  lines.forEach((l, i) => {
    if (fenceStep(fst, l)) return;
    if (/^#{1,6}\s/.test(l)) out.push(i);
  });
  return out;
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
  if (!m) return false;
  let t = m.text.toLowerCase();
  const lead = headingLeadRe();
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(lead, ""); }
  return syns.some((s) => t.startsWith(s) && (!/[\p{L}\p{N}]/u.test(t.charAt(s.length)) || (inflect && RE_SYN_INFLECTION.test(t.slice(s.length)))));
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
// templates' "## Observability" / "## Section 1: Model Strategy").
function extractSection(md, synonyms, marker, loose) {
  const syns = (Array.isArray(synonyms) ? synonyms : [synonyms]).map((s) => s.toLowerCase());
  const looseSet = new Set((loose || []).map((s) => s.toLowerCase()));
  const strict = looseSet.size ? syns.filter((s) => !looseSet.has(s)) : syns;
  const lines = (md || "").split(/\r?\n/);
  const heads = headingIndex(lines);
  const matches = (i, list) => headingMatches(lines[i], list || syns, !!marker); // a track section's heading may inflect its name
  const level = (l) => (lines[l].match(/^(#{1,6})\s/) || ["", "######"])[1].length;
  // The nearest enclosing heading (a lower level, above i) carries the marker: the heading sits in the track's context.
  const inTrackContext = (i) => {
    let lv = level(i);
    for (let k = heads.indexOf(i) - 1; k >= 0 && lv > 1; k--) {
      const h = heads[k];
      if (level(h) >= lv) continue;
      if (lines[h].includes(marker)) return true;
      lv = level(h);
    }
    return false;
  };
  const MARKERS = markerTracks().map((t) => trackMarker(t)); // + the track packs' (1.15)
  let start = -1;
  if (marker) start = heads.find((i) => lines[i].includes(marker) && matches(i));
  if (start == null || start === -1) {
    const other = marker ? MARKERS.filter((m) => m !== marker) : [];
    start = heads.find((i) => (matches(i, strict) || (marker && looseSet.size && matches(i) && inTrackContext(i))) && !other.some((m) => lines[i].includes(m)));
  }
  if (start == null || start === -1) return null;
  const end = heads.find((i) => i > start && level(i) <= level(start));
  return lines.slice(start + 1, end == null ? lines.length : end).join("\n");
}

// The indent is read within its line ([^\S\n\r\u2028\u2029], not \s — a line start of a long blank run rescanned the whole
// run, 1.17 H): the line holding the '>' matches either way, and every reader only asks whether one does.
const RE_TODO_SENTINEL = /^[^\S\n\r\u2028\u2029]*>\s*\*\*TODO\*\*/m;
const ROOT_CAUSE_SYN = ["root cause", "causa raiz", "causa raíz"];
const REPRO_SYN = ["reproduction", "reprodução", "reproducao", "reproducción", "reproduccion"];
function sectionState(design, sections, marker) {
  return sections.map((sec) => {
    const body = extractSection(design, sec.syn, marker, sec.loose);
    if (body == null) return { section: sec.name, status: "missing" };
    // Unfilled = the scaffold sentinel is still there, or nothing real was written (blank is not an answer).
    if (RE_TODO_SENTINEL.test(body) || !stripHtmlComments(body).trim()) return { section: sec.name, status: "unfilled" };
    return { section: sec.name, status: "filled" };
  });
}

module.exports = { stripHtmlComments, commentLines, stripFencedCode, requirementAcIds, planIdText, clarificationMarkers,
  RE_FENCE, RE_FENCE_CLOSE, closesFence, fenceStep, tableCells, headingIndex, headingLeadSource, RE_HEADING_LEAD,
  headingLeadRe, RE_SYN_INFLECTION, headingMatches, extractSection, RE_TODO_SENTINEL, ROOT_CAUSE_SYN, REPRO_SYN,
  sectionState, __link };

"use strict";

/**
 * dev-spec-driven engine — spec_import — shared readers.
 * The markdown and EARS helpers every importer shares (headings, ranges, list items, clause → EARS).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const i18n = require("../../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let backtickRuns, closesFence, headingIndex, headRest, indentOf, isLtUnit, isWsUnit, RE_EARS_KEYWORD, RE_FENCE,
  RE_MODAL, restAfterBlanks, shortTitle, stripEnd, wsOrUnitIn;
function __link(E) { ({ backtickRuns, closesFence, headingIndex, headRest, indentOf, isLtUnit, isWsUnit,
  RE_EARS_KEYWORD, RE_FENCE, RE_MODAL, restAfterBlanks, shortTitle, stripEnd, wsOrUnitIn } = E); }

// `<!--` (and, with `closers`, `-->`) → `&lt;!--` / `--&gt;` outside inline code spans, line by line. Linear.
function inertOutsideCode(text, closers) {
  if (!text.includes("<!--") && !(closers && text.includes("-->"))) return text;
  const esc = (t) => (closers ? t.replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;") : t.replace(/<!--/g, "&lt;!--"));
  return text.split("\n").map((line) => {
    if (!line.includes("`")) return esc(line);
    const ticks = backtickRuns(line);
    let out = "";
    let from = 0;
    // [k, spanEnd(k)) is a whole code span, or an unmatched backtick run (literal — the scan goes on after it): kept as written
    for (let k = line.indexOf("`"); k !== -1; k = line.indexOf("`", from)) {
      const e = ticks.spanEnd(k);
      out += esc(line.slice(from, k)) + line.slice(k, e);
      from = e;
    }
    return out + esc(line.slice(from));
  }).join("\n");
}

// Headings outside fenced code: [{ i, level, text }].
function mdHeadings(lines) {
  return headingIndex(lines).map((i) => ({ i, ...mdHeadingParts(lines[i]) }));
}
// "## Title ##" → { level, text }: what /^(#{1,6})\s+(.*?)\s*#*\s*$/ captured (text trimmed), read by a scan — that pattern
// backtracked cubically on a heading holding a long run of spaces (a 3,000-space heading took 10 s; 1.17 F review). The line
// is one headingIndex() accepts (1–6 '#' then whitespace). The closing sequence is the longest suffix whitespace · '#'s ·
// whitespace.
const isWs = (c) => c !== undefined && c.trim() === "";
function mdHeadingParts(line) {
  let level = 0;
  while (level < 6 && line[level] === "#") level++;
  let lo = level;
  while (lo < line.length && isWs(line[lo])) lo++;
  let hi = line.length;
  while (hi > lo && isWs(line[hi - 1])) hi--;
  while (hi > lo && line[hi - 1] === "#") hi--;
  while (hi > lo && isWs(line[hi - 1])) hi--;
  return { level, text: line.slice(lo, hi).trim() };
}
// [lo, hi) of the lines under heading hs[k], up to the next heading of the same or a higher level.
function mdRange(lines, hs, k) {
  const h = hs[k];
  let next = null; // a scan, no slice: copying the rest of the headings for each one was quadratic on a long PLAN.md (1.17 F review)
  for (let j = k + 1; j < hs.length && !next; j++) if (hs[j].level <= h.level) next = hs[j];
  return [h.i + 1, next ? next.i : lines.length];
}
function mdBody(lines, hs, k) {
  const [lo, hi] = mdRange(lines, hs, k);
  return lines.slice(lo, hi);
}
// The parsers mark every source line they import; leftoverExtras() carries the rest.
function markRange(used, lo, hi) {
  for (let i = lo; i < hi; i++) used.add(i);
}
// The lines of [lo, hi) no parser used: a "## Functional Requirements" wrapping "### Requirement N" (already a
// story) carries only what is left around it, never a second verbatim copy of the requirement.
function unusedLines(lines, used, lo, hi) {
  return lines.slice(lo, hi).filter((_, r) => !used.has(lo + r));
}
const RE_MD_HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
// First paragraph of prose (no headings, lists, quotes, tables or metadata), whitespace-folded. `at` (optional)
// collects the offsets of the lines it used.
function firstParagraph(lines, at) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) { if (out.length) break; continue; }
    if (/^(?:#|[-*+]\s|\d+[.)]\s|>|\||```|~~~|---)/.test(t) || /^\*\*[^*]+\*\*:?/.test(t)) { if (out.length) break; continue; }
    out.push(t);
    if (at) at.push(i);
  }
  return out.join(" ").trim() || null;
}
// List items of a body: [{ n (printed number or null), text (continuation folded), at (offsets of its lines) }].
// A continuation line is indented OR lazy (CommonMark: an unindented line right after the item's text — a wrapped
// "THEN the system SHALL …" belongs to its criterion); a more-indented sub-list folds into its item. A blank line,
// a heading, a quote, a table, a rule or a sibling list that is not ours ends the item.
function mdListItems(lines, numberedOnly) {
  const items = [];
  let cur = null;
  let fence = null;
  lines.forEach((l, i) => {
    if (fence) { if (closesFence(l, fence)) fence = null; cur = null; return; }
    const f = l.match(RE_FENCE);
    if (f) { fence = f[1]; cur = null; return; }
    const ind = indentOf(l);
    // /^\s*(\d+)[.)]\s+(.*)$/ (or with a bullet too), the text read by headRest (1.17 H)
    const m = headRest(l, numberedOnly ? /^\s*(\d+)[.)]/ : /^\s*(?:(\d+)[.)]|[-*+])/, true);
    if (m && (!cur || ind <= cur.indent)) { cur = { n: m[1] ? +m[1] : null, text: m[2].trim(), indent: ind, at: [i] }; items.push(cur); return; }
    if (!l.trim() || /^\s*(?:#|>|\|)/.test(l) || RE_MD_HR.test(l)) { cur = null; return; }
    if (!cur) return;
    if (/^\s*(?:[-*+]|\d+[.)])\s/.test(l) && ind <= cur.indent) { cur = null; return; }
    cur.text += " " + l.trim();
    cur.at.push(i);
  });
  return items.map(({ n, text, at }) => ({ n, text, at }));
}
// What no parser mapped still travels verbatim: the unused lines of one file, grouped under their nearest heading
// (an unused heading opens its own group and keeps its unused sub-headings inside it) → [{ heading, label, lines }].
// Nothing is dropped silently — importSpec appends them and names them in a warning. `prefix` names the
// capability when an OpenSpec import reads several spec.md files.
function leftoverExtras(lines, hs, used, prefix = "") {
  const at = new Map(hs.map((h) => [h.i, h]));
  const out = [];
  let near = null;
  let cur = null;
  lines.forEach((raw, i) => {
    const h = at.get(i);
    if (h) {
      near = h;
      if (used.has(i)) { cur = null; return; }
      if (cur && cur.level != null && h.level > cur.level) { cur.lines.push(raw.trimEnd()); return; } // trimEnd: /\s+$/ is quadratic on a long space run
      cur = { label: prefix + h.text, level: h.level, lines: [] };
      out.push(cur);
      return;
    }
    if (used.has(i)) return;
    const l = raw.trimEnd();
    if (!l.trim() || RE_MD_HR.test(l)) { if (cur) cur.lines.push(""); return; }
    if (!cur) { cur = { label: near ? prefix + near.text : null, level: null, lines: [] }; out.push(cur); }
    cur.lines.push(l);
  });
  return out.map((b) => ({ heading: b.label != null ? "## " + b.label : null, label: b.label, lines: tidyLines(b.lines) })).filter((b) => b.lines.length);
}
const trimClause = (s) => stripEnd(String(s || "").trim(), wsOrUnitIn(",.;:")); // /[\s,.;:]+$/
// Prose lines as written (trailing spaces dropped), blank runs folded, no blank edges.
function tidyLines(lines) {
  const out = [];
  for (const l of lines.map((x) => x.trimEnd())) if (l || (out.length && out[out.length - 1])) out.push(l); // trimEnd: /\s+$/ is quadratic on a long blank run (1.17 F)
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
const lcFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const IRREGULAR_VERBS = new Map([["is", "be"], ["are", "be"], ["has", "have"], ["does", "do"], ["goes", "go"]]);
function baseVerb(v) {
  const w = v.toLowerCase();
  if (IRREGULAR_VERBS.has(w)) return IRREGULAR_VERBS.get(w);
  if (/[^aeiou]ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/(?:ss|sh|ch|x|z|o)es$/.test(w)) return w.slice(0, -2);
  if (/[^s]s$/.test(w)) return w.slice(0, -1);
  return w;
}
// A THEN clause as an EARS response. Already modal ("the API SHALL return 401") → kept. English "the system
// returns X" → THE SYSTEM SHALL return X; anything else → THE SYSTEM SHALL ensure that <clause> (PT/ES likewise,
// with 'garantir que' / 'garantizar que' — no verb guessing there).
function earsThen(clause, lng, E) {
  const c = trimClause(clause);
  if (!c) return null;
  if (RE_MODAL.test(c)) return c;
  if (lng === "en") {
    let m = c.match(/^(?:the\s+)?system\s+(?:should|must|will|shall)\s+(not\s+)?(.+)$/i);
    if (m) return E.shall + " " + (m[1] ? E.not + " " : "") + m[2];
    m = c.match(/^(?:the\s+)?system\s+(?:does\s+not|doesn't|never)\s+(.+)$/i);
    if (m) return E.shall + " " + E.not + " " + m[1];
    // Only a verb-shaped word ("returns", "is", "stores"): "the system administrator approves" / "the system status is
    // green" name something else — those take the 'ensure that' form below.
    m = c.match(/^(?:the\s+)?system\s+([a-z]+)\b(.*)$/i);
    if (m && (IRREGULAR_VERBS.has(m[1].toLowerCase()) || /(?:[^aeiou]ies|(?:ss|sh|ch|x|z|o)es|[^usi]s)$/i.test(m[1]))) return E.shall + " " + baseVerb(m[1]) + m[2];
  }
  return E.ensure + " " + lcFirst(c);
}
// { given, when, then } → "WHILE <given>, WHEN <when>, THE SYSTEM SHALL …" (null without a THEN).
function earsFromClauses(cl, lng) {
  const E = i18n.msg(lng).importSpec.ears;
  const then = earsThen(cl.then, lng, E);
  if (!then) return null;
  return [cl.given ? E.while + " " + trimClause(cl.given) + "," : null, cl.when ? E.when + " " + trimClause(cl.when) + "," : null, then].filter(Boolean).join(" ");
}
// 1.17 H — the importer's clause patterns, read by a scan. /^(?:given\s+(.+?)\s*,?\s+)?(?:when\s+(.+?)\s*,?\s+)?then\s+(.+)$/i
// and /^(WHEN|IF|WHILE|WHERE)\s+(.+?),?\s+THEN\s+(.+)$/i backtracked quadratically — Given/When/Then cubically — on a long
// blank run, a long run of "when"s or a line break a capture can't cross. The scan tries the choices in the order the regex
// engine does, so the first reading it finds is the engine's own, captures included (down to the one-blank capture the
// engine settled for by giving back a keyword's \s+). Per-position facts are filled in one pass; every run of blanks /
// commas that a keyword follows is judged once.
function clauseScanner(t) {
  const n = t.length;
  const nnw = new Int32Array(n + 1), nlt = new Int32Array(n + 1), sepEnd = new Int32Array(n + 1), prevComma = new Int32Array(n + 1);
  nnw[n] = n; nlt[n] = n; sepEnd[n] = n;
  for (let i = n - 1; i >= 0; i--) {
    const c = t[i], w = isWsUnit(c);
    nnw[i] = w ? nnw[i + 1] : i; // the first non-blank at or after i
    nlt[i] = isLtUnit(c) ? i : nlt[i + 1]; // the first line terminator at or after i (n: none)
    sepEnd[i] = w || c === "," ? sepEnd[i + 1] : i; // the end of the run of blanks / commas at i
  }
  for (let i = 0, pc = -1; i <= n; i++) { prevComma[i] = pc; if (t[i] === ",") pc = i; }
  const runStart = [], runKw = []; // each run of blanks / commas that something follows: its start and what follows
  for (let i = 0; i < n;) {
    if (isWsUnit(t[i]) || t[i] === ",") { if (sepEnd[i] < n) { runStart.push(i); runKw.push(sepEnd[i]); } i = sepEnd[i]; } else i++;
  }
  const firstRun = new Int32Array(n + 2); // the first run starting at or after p
  for (let p = n + 1, j = runStart.length; p >= 0; p--) { while (j > 0 && runStart[j - 1] >= p) j--; firstRun[p] = j; }
  const kwAt = (re, at) => { re.lastIndex = at; const m = re.exec(t); return m ? { end: at + m[0].length, m } : null; };
  // The smallest e ≥ x (x..k inside one run) whose separator t[e..k) the rule reads: "gwt" \s*,?\s+ (one comma at most, a
  // blank last), "kiro" ,?\s+ (a comma only first). -1: none.
  const sepStart = (rule, x, k) => {
    if (k <= x || !isWsUnit(t[k - 1])) return -1;
    const c1 = prevComma[k];
    if (rule === "kiro") return c1 < x ? x : c1 < k - 1 ? c1 : -1;
    const c2 = c1 >= x ? prevComma[c1] : -1;
    return c2 >= x ? c2 + 1 : x;
  };
  // (.+?)<separator> before a keyword whose continuation cont(k) reads: from a capture start gs → { e, k, r } | null.
  const lazyReader = (rule, cont) => {
    const nv = new Int32Array(runStart.length + 1).fill(-1), res = new Array(runStart.length).fill(null);
    for (let j = runStart.length - 1; j >= 0; j--) {
      if (sepStart(rule, runStart[j], runKw[j]) !== -1) res[j] = cont(runKw[j]);
      nv[j] = res[j] ? j : nv[j + 1]; // the first run from j on whose keyword reads
    }
    return (gs) => {
      const x = gs + 1, lt = nlt[gs]; // the capture t[gs..e) holds no line terminator: e ≤ lt
      if (x >= n) return null;
      let j = firstRun[x];
      if (isWsUnit(t[x]) || t[x] === ",") { // a run under way at x is read from x
        const k = sepEnd[x];
        const e = k < n ? sepStart(rule, x, k) : -1;
        if (e !== -1) { if (e > lt) return null; const r = cont(k); if (r) return { e, k, r }; }
        j = firstRun[k + 1];
      }
      j = j < runStart.length ? nv[j] : -1;
      if (j === -1) return null;
      const e = sepStart(rule, runStart[j], runKw[j]);
      return e > lt ? null : { e, k: runKw[j], r: res[j] };
    };
  };
  // KW\s+(.+?)<separator><keyword …> at `a` (just past KW, a blank there): the capture from the first non-blank — else,
  // as the engine giving back \s+ found it, one blank (the last that is no line terminator, a blank kept on each side)
  // before a keyword at that first non-blank.
  const clause = (a, lazy, cont) => {
    const gs = nnw[a];
    if (gs >= n) return null;
    const m = lazy(gs);
    if (m) return { g: t.slice(gs, m.e), r: m.r };
    if (t[gs] === "," || gs - a < 3) return null;
    const r = cont(gs);
    if (r) for (let s = gs - 2; s > a; s--) if (!isLtUnit(t[s])) return { g: t[s], r };
    return null;
  };
  // THEN\s+(.+)$ at c → the response | null (all blanks: the last one, as the engine giving back \s+ read it).
  const thenAt = (re, c) => {
    const kw = kwAt(re, c);
    if (!kw) return null;
    const q = nnw[kw.end];
    if (q < n) return nlt[q] === n ? t.slice(q) : null;
    return n - kw.end >= 2 && !isLtUnit(t[n - 1]) ? t[n - 1] : null;
  };
  const memo = (f) => { const c = new Map(); return (k) => { if (!c.has(k)) c.set(k, f(k)); return c.get(k); }; };
  return { n, nnw, kwAt, lazyReader, clause, thenAt, memo };
}
// Given/When/Then prose (spec-kit scenarios; Gherkin keywords in EN/PT/ES) → EARS, in the scenario's language. Each language's
// keywords, a blank after each (`given\s+` …; PT / ES: dad[oa]s?\s+(?:que\s+)?).
const GWT = [
  ["en", { given: /given(?=\s)/iy, que: null, when: /when(?=\s)/iy, then: /then(?=\s)/iy }],
  ["pt", { given: /dad[oa]s?(?=\s)/iy, que: /que(?=\s)/iy, when: /quando(?=\s)/iy, then: /ent[ãa]o(?=\s)/iy }],
  ["es", { given: /dad[oa]s?(?=\s)/iy, que: /que(?=\s)/iy, when: /cuando(?=\s)/iy, then: /entonces(?=\s)/iy }],
];
// /^(?:given\s+(.+?)\s*,?\s+)?(?:when\s+(.+?)\s*,?\s+)?then\s+(.+)$/i on t → [t, given, when, then] | null (clauseScanner S).
function gwtMatch(S, t, K) {
  const C = S.memo((k) => S.thenAt(K.then, k));
  const lazyC = S.lazyReader("gwt", C);
  const B = S.memo((k) => { const kw = S.kwAt(K.when, k); const c = kw && S.clause(kw.end, lazyC, C); return c ? { when: c.g, then: c.r } : null; });
  const cont = S.memo((k) => B(k) || (C(k) != null ? { then: C(k) } : null)); // (?:when…)? then…
  const g = S.kwAt(K.given, 0);
  if (g) {
    const lazyAG = S.lazyReader("gwt", cont);
    const g0 = S.nnw[g.end];
    const q = K.que && g0 < S.n ? S.kwAt(K.que, g0) : null;
    const r = (q && S.clause(q.end, lazyAG, cont)) || S.clause(g.end, lazyAG, cont);
    if (r) return [t, r.g, r.r.when, r.r.then];
  }
  const r0 = cont(0);
  return r0 ? [t, undefined, r0.when, r0.then] : null;
}
function earsFromGwt(text) {
  const t = String(text).replace(/\*\*|__/g, "").trim();
  if (RE_MODAL.test(t) && RE_EARS_KEYWORD.test(t)) return t;
  const S = clauseScanner(t);
  for (const [lng, K] of GWT) {
    const m = gwtMatch(S, t, K);
    if (m && (m[1] || m[2])) return earsFromClauses({ given: m[1], when: m[2], then: m[3] }, lng);
  }
  return null;
}
// The story's title from its "I want …" clause (PT "quero …", ES "quiero …").
function titleFromStory(prose) {
  const s = prose.join(" ");
  const m = wantClause(s, /\bI want(?=\s)/gi, /to(?=\s)/iy, /so that\b/iy) ||
    wantClause(s, /(?<![\p{L}\p{N}_])(?:quero|quiero)(?=\s)/giu, /que(?=\s)/iuy, /(?:para|de modo a|de forma a)(?![\p{L}\p{N}_])/iuy);
  return m ? shortTitle(m.charAt(0).toUpperCase() + m.slice(1), 60) : null;
}
// The capture of /\bI want\s+(?:to\s+)?(.+?)(?:,|\s+so that\b|$)/i (and its PT / ES twin) by a scan: head / opt / closing are
// its pieces (head global, opt / closing sticky). The lazy capture rescanned a long blank run at each step and every head
// the text after it (1.17 H); here each position's "a clause ends here" is known once. Choices in the engine's order: the
// heads left to right; the optional word taken, its blanks given back one by one, not taken; the head's blanks given back.
function wantClause(s, head, opt, closing) {
  const n = s.length;
  const nnw = new Int32Array(n + 1), nlt = new Int32Array(n + 1), nextEnd = new Int32Array(n + 1);
  nnw[n] = n; nlt[n] = n; nextEnd[n] = n;
  for (let i = n - 1; i >= 0; i--) {
    nnw[i] = isWsUnit(s[i]) ? nnw[i + 1] : i;
    nlt[i] = isLtUnit(s[i]) ? i : nlt[i + 1];
    let ends = s[i] === ",";
    if (!ends && nnw[i] > i) { closing.lastIndex = nnw[i]; ends = closing.test(s); } // \s+ then the closing words
    nextEnd[i] = ends ? i : nextEnd[i + 1]; // the first position ≥ i where the capture may end (n: the end)
  }
  const from = (cs) => { const e = cs < n ? nextEnd[cs + 1] : -1; return e !== -1 && e <= nlt[cs] ? s.slice(cs, e) : null; };
  head.lastIndex = 0;
  for (let h; (h = head.exec(s));) {
    const a = h.index + h[0].length, g0 = nnw[a];
    let r = null;
    opt.lastIndex = g0;
    if (g0 < n && opt.test(s)) {
      const a1 = opt.lastIndex, g1 = nnw[a1];
      for (let cs = g1; cs > a1 && r == null; cs--) r = from(cs);
    }
    for (let cs = g0; cs > a && r == null; cs--) r = from(cs);
    if (r != null) return r;
  }
  return null;
}
function newImportModel() {
  return { title: null, summary: null, nameHint: null, stories: [], extra: [], carried: [], design: null, tasks: null, skipped: [], warnings: [], mapping: {} };
}
// \s*[:.\-–—]?\s*(.*)$ (= \s*(?:[:.\-–—]\s*)?(.*)$) from i → the title | null
function titleAfterDash(s, i) {
  while (i < s.length && isWsUnit(s[i])) i++;
  if (i < s.length && ":.-–—".includes(s[i])) i++;
  return restAfterBlanks(s, i, false);
}

module.exports = { inertOutsideCode, mdHeadings, isWs, mdHeadingParts, mdRange, mdBody, markRange, unusedLines,
  RE_MD_HR, firstParagraph, mdListItems, leftoverExtras, trimClause, tidyLines, lcFirst, IRREGULAR_VERBS, baseVerb,
  earsThen, earsFromClauses, clauseScanner, GWT, gwtMatch, earsFromGwt, titleFromStory, wantClause, newImportModel,
  titleAfterDash, __link };

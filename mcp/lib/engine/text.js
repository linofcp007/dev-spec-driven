"use strict";

/**
 * dev-spec-driven engine — linear text scans and small string helpers.
 * Pure string helpers every module shares: the 1.17 H linear scans (each returns byte for byte what the regex it
 * replaced returned), own-key lookup and the per-position blank facts the import scans use.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */

// ---------------------------------------------------------------------------
// Linear text scans (1.17 H). Regexes such as /^#{1,6}\s+(.*?)\s*$/, /\/+$/ or /\s*\r?\n\s*/g backtracked quadratically
// (or worse) on a line holding a long run of one character — a heading with 100,000 spaces stalled the MCP server or a
// hook. Each scan here returns byte for byte what the regex it replaces returned; the pattern is quoted beside each use.
// "Whitespace" is JavaScript's \s (= what String.prototype.trim removes), one UTF-16 unit at a time.
// ---------------------------------------------------------------------------

function isWsUnit(c) {
  if (c === undefined) return false;
  const u = c.charCodeAt(0);
  return u === 32 || (u >= 9 && u <= 13) || u === 0xa0 || u === 0x1680 || (u >= 0x2000 && u <= 0x200a) || u === 0x2028 || u === 0x2029
    || u === 0x202f || u === 0x205f || u === 0x3000 || u === 0xfeff;
}
// A line terminator — what `.` never matches and `$` (with the m flag) stops before.
const RE_LINE_TERMINATOR = /[\n\r\u2028\u2029]/;
const isLtUnit = (c) => c === "\n" || c === "\r" || c === "\u2028" || c === "\u2029";
function lastLtIndex(s) {
  for (let i = s.length - 1; i >= 0; i--) if (isLtUnit(s[i])) return i;
  return -1;
}
// s without a trailing " # comment" — s.replace(/\s+#.*$/, ""): the first whitespace run followed by a '#' with no line
// terminator after it, and everything from that run on.
function stripHashComment(s) {
  const lastLt = lastLtIndex(s);
  for (let i = 0; i < s.length; i++) {
    if (!isWsUnit(s[i])) continue;
    const r = i;
    while (i < s.length && isWsUnit(s[i])) i++;
    if (s[i] === "#" && i > lastLt) return s.slice(0, r);
  }
  return s;
}
// 'x' / "x" (then whitespace and an optional # comment) → x, else null — s.match(/^(["'])(.*?)\1\s*(?:#.*)?$/)[2].
function quotedValue(s) {
  const q = s[0];
  if (q !== '"' && q !== "'") return null;
  const lastLt = lastLtIndex(s);
  const tail = new Array(s.length + 1); // tail[p]: from p on, whitespace then an optional '#' comment, to the end
  tail[s.length] = true;
  for (let p = s.length - 1; p >= 0; p--) tail[p] = isWsUnit(s[p]) ? tail[p + 1] : s[p] === "#" && p > lastLt;
  for (let c = 1; c < s.length; c++) {
    if (isLtUnit(s[c])) return null;
    if (s[c] === q && tail[c + 1]) return s.slice(1, c);
  }
  return null;
}
// Unit predicates for stripEnd / stripStart: the units of `chars`, optionally with whitespace.
const unitIn = (chars) => (c) => chars.includes(c);
const wsOrUnitIn = (chars) => (c) => isWsUnit(c) || chars.includes(c);
const isSlashUnit = (c) => c === "/";
const isBacktickUnit = (c) => c === "`";
// s without its trailing run of units `test` accepts — s.replace(/[set]+$/, "") (unanchored, that regex rescanned the run
// from each of its units).
function stripEnd(s, test) {
  let hi = s.length;
  while (hi > 0 && test(s[hi - 1])) hi--;
  return hi === s.length ? s : s.slice(0, hi);
}
function stripStart(s, test) {
  let lo = 0;
  while (lo < s.length && test(s[lo])) lo++;
  return lo ? s.slice(lo) : s;
}
// s.replace(/^[lead]+|[trail]+$/g, "") — a string made of the units alone comes back empty, as with the regex.
function stripEnds(s, lead, trail = lead) {
  return stripEnd(stripStart(s, lead), trail);
}
// A line's text after its blanks: `\s+(.*)$` at p (needBlank) or `\s*(.*)$` → the text, or null when a line terminator
// follows the text (no shorter blank run reads then either — the greedy pattern rescanned the text from each blank it gave
// back).
function restAfterBlanks(s, p, needBlank) {
  if (needBlank && !isWsUnit(s[p])) return null;
  let q = p;
  while (q < s.length && isWsUnit(s[q])) q++;
  const rest = s.slice(q);
  return RE_LINE_TERMINATOR.test(rest) ? null : rest;
}
// `\s*(.+)$` at p → the text | null: the rest after the blanks — only blanks left: the last one (no line terminator), as the
// engine giving back \s* read it.
function plusAfterBlanks(s, p) {
  let q = p;
  while (q < s.length && isWsUnit(s[q])) q++;
  if (q < s.length) return RE_LINE_TERMINATOR.test(s.slice(q)) ? null : s.slice(q);
  return q > p && !isLtUnit(s[q - 1]) ? s[q - 1] : null;
}
// s.match(/^HEAD\s+(.*)$/) (needBlank) or /^HEAD\s*(.*)$/ as [line, …HEAD's groups, text] | null — `head` is the anchored
// part before the blanks, read by the regex engine, the text by restAfterBlanks.
function headRest(s, head, needBlank) {
  const h = head.exec(s);
  const rest = h && restAfterBlanks(s, h[0].length, needBlank);
  if (rest == null) return null;
  const m = Array.from(h);
  m[0] = s;
  m.push(rest);
  return m;
}
// s.match(/^HEAD\s*(.+)$/) as [line, …HEAD's groups, text] | null (the text by plusAfterBlanks).
function headPlus(s, head) {
  const h = head.exec(s);
  const text = h && plusAfterBlanks(s, h[0].length);
  if (text == null) return null;
  const m = Array.from(h);
  m[0] = s;
  m.push(text);
  return m;
}
// s.replace(/<!--[\s\S]*?-->/g, fn): each "<!--" to the first "-->" after it; an opener with none after it ends the scan
// (the pattern rescanned the rest of the text from each such opener).
function replaceHtmlCommentSpans(s, fn) {
  let out = "", at = 0;
  for (let i = s.indexOf("<!--"); i !== -1;) {
    const j = s.indexOf("-->", i + 4);
    if (j === -1) break;
    out += s.slice(at, i) + fn(s.slice(i, j + 3));
    at = j + 3;
    i = s.indexOf("<!--", at);
  }
  return at ? out + s.slice(at) : s;
}
// The code spans of s — what /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g matched, read from the backtick runs: an opener is the
// rest of a run (the whole run first), its closer the first later run of exactly its length; bodyMax bounds the body as
// the export's [^`][\s\S]{0,4000}?[^`] does (4002). → [{ index, end, tick, body }]. The pattern rescanned the text from
// each unit of a long backtick run.
function codeSpans(s, bodyMax = Infinity) {
  const runs = [];
  for (let i = s.indexOf("`"); i !== -1;) {
    let e = i;
    while (s[e] === "`") e++;
    runs.push([i, e - i]);
    i = s.indexOf("`", e);
  }
  const byLen = new Map(); // run length → indices of the runs of that length, in order
  runs.forEach(([, len], k) => { if (!byLen.has(len)) byLen.set(len, []); byLen.get(len).push(k); });
  const firstAfter = (list, k) => { // the first index in list greater than k, or -1
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid] > k) hi = mid; else lo = mid + 1; }
    return lo < list.length ? list[lo] : -1;
  };
  const out = [];
  for (let k = 0; k < runs.length; k++) {
    const e = runs[k][0] + runs[k][1];
    for (let L = runs[k][1]; L >= 1; L--) {
      const j = byLen.has(L) ? firstAfter(byLen.get(L), k) : -1;
      if (j === -1 || runs[j][0] - e > bodyMax) continue;
      out.push({ index: e - L, end: runs[j][0] + L, tick: "`".repeat(L), body: s.slice(e, runs[j][0]) });
      k = j;
      break;
    }
  }
  return out;
}
// s.replace(<that code-span pattern>, fn) — fn(match, tick, body).
function replaceCodeSpans(s, fn, bodyMax) {
  let out = "", at = 0;
  for (const m of codeSpans(s, bodyMax)) {
    out += s.slice(at, m.index) + fn(s.slice(m.index, m.end), m.tick, m.body);
    at = m.end;
  }
  return at ? out + s.slice(at) : s;
}
// An ATX heading line → { level, text } | null, as /^(#{min,max})\s+(.*?)\s*$/ read it (text trimmed at the end). closing:
// a closing sequence led by whitespace goes too — /^(#{min,max})\s+(.*?)(?:\s+#+)?\s*$/. raw: the text is the whole rest —
// /^(#{min,max})\s+(.*)$/. The text never holds a line terminator (`.` stops there): a line whose would is no heading.
function atxHeading(line, min = 1, max = 6, mode = "trim") {
  const s = String(line);
  let level = 0;
  while (s[level] === "#") level++;
  if (level < min || level > max || !isWsUnit(s[level])) return null;
  let lo = level + 1;
  while (lo < s.length && isWsUnit(s[lo])) lo++;
  let hi = s.length;
  if (mode !== "raw") {
    while (hi > lo && isWsUnit(s[hi - 1])) hi--;
    if (mode === "closing" && s[hi - 1] === "#") {
      let h0 = hi - 1;
      while (h0 > lo && s[h0 - 1] === "#") h0--;
      let w0 = h0;
      while (w0 > lo && isWsUnit(s[w0 - 1])) w0--;
      if (w0 > lo && w0 < h0) hi = w0;
    }
  }
  const text = s.slice(lo, hi);
  return RE_LINE_TERMINATOR.test(text) ? null : { level, text };
}
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// Per-position facts for the scans below: nnw[i] the first non-blank ≥ i, nlt[i] the first line terminator ≥ i (n: none),
// and tws(p) — "\s* then $ (m flag)" reads at p: the blank run at p reaches the end or holds a line terminator.
function blankFacts(s) {
  const n = s.length;
  const nnw = new Int32Array(n + 1), nlt = new Int32Array(n + 1);
  nnw[n] = n; nlt[n] = n;
  for (let i = n - 1; i >= 0; i--) { nnw[i] = isWsUnit(s[i]) ? nnw[i + 1] : i; nlt[i] = isLtUnit(s[i]) ? i : nlt[i + 1]; }
  return { n, nnw, nlt, tws: (p) => nnw[p] === n || nlt[p] < nnw[p] };
}

module.exports = { isWsUnit, RE_LINE_TERMINATOR, isLtUnit, lastLtIndex, stripHashComment, quotedValue, unitIn,
  wsOrUnitIn, isSlashUnit, isBacktickUnit, stripEnd, stripStart, stripEnds, restAfterBlanks, plusAfterBlanks, headRest,
  headPlus, replaceHtmlCommentSpans, codeSpans, replaceCodeSpans, atxHeading, own, blankFacts };

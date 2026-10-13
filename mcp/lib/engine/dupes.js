"use strict";

/**
 * dev-spec-driven engine — the duplicate-code detector: spec_scan {duplicates: true}, `dev-spec dupes`, spec_finish's warning
 * and the review flow's candidate findings. A MECHANICAL reuse check — the prose asks the implementer to search before it
 * writes; this finds the code a feature repeats. Windows of `minLines` consecutive normalized code lines (comments, blank,
 * brace-only and import lines left out; string contents kept — two blocks that differ only in their strings are no duplicate)
 * are hashed, matched across the project's source files and merged into runs. Language-agnostic by extension (scan.js's notion
 * of code), bounded (a file cap, a size cap, the occurrences kept per window), read-only, deterministic.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let decodeText, existingFeature, FOLD_CASE, gitignoreRules, implementsPath, implementsRefs, implementsTargets, isCodeFile, isDirSafe,
  isImplementsGlob, isTestFile, isTestFixture, projectLang, readIfExists, realRootOf, toPosix, walkProject, withinRoot;
function __link(E) { ({ decodeText, existingFeature, FOLD_CASE, gitignoreRules, implementsPath, implementsRefs, implementsTargets,
  isCodeFile, isDirSafe, isImplementsGlob, isTestFile, isTestFixture, projectLang, readIfExists, realRootOf, toPosix, walkProject,
  withinRoot } = E); }

const DUP_MIN_LINES = 6; // the window: this many consecutive code lines (the tool's minLines, 4–100)
const DUP_MIN_LINES_RANGE = [4, 100];
const DUP_FILE_CAP = 5000; // source files read (`truncated` past it) — a feature's own files are read whatever the cap
const DUP_MAX_BYTES = 512 * 1024; // a larger file is data or a bundle, never read (skipped.large)
// the source bytes a report reads, all files together (`partial` past it) — the time and memory grow with them (200 files of
// 500 KB took 4.5 s and 634 MB); a feature's own files are read whatever the budget
const DUP_TOTAL_BYTES = 32 * 1024 * 1024;
const DUP_LINE_CHARS = 12; // a window counts only when its lines hold at least minLines × this many characters (no `x = 1;` runs)
const DUP_OCC_MAX = 32; // the occurrences of one window kept — a boilerplate block repeated 500 times costs 32
const DUP_TOP = 20; // duplicates a report lists (`counts` / `total` count them all)
const DUP_ALSO_MAX = 5; // other places listed per duplicate (`alsoMore`: the rest)
const SPAN = 4294967296; // 2^32 — an occurrence packed as file index × SPAN + window index (exact in a double)

// --- normalization: one line's code, its comments dropped, its strings kept --------------------------------------------------
// The comment syntax of a language family: line comment tokens, block comment pairs, the quotes of a one-line string, the
// delimiters of a string that may span lines, `esc` (a backslash outside a string escapes the next character — a JS regex
// literal's `\/\/` is no comment), `regex` (JS / TS: a `/` where an operand starts opens a regex literal — `/[/*]/` holds no
// comment, `/`/` no template string), `wordHash` (the shells: `#` starts a comment only at a word's start — `$#`, `${#x}`),
// `hashAttr` (PHP: `#[` is an attribute, not a comment) and `lineStart` (a batch file's REM / ::). A family not listed strips
// nothing (whitespace still collapses).
const C_LIKE = { line: ["//"], block: [["/*", "*/"]], quotes: "\"'`", multi: ["`"], esc: true };
const MARKUP = { line: ["//"], block: [["<!--", "-->"], ["/*", "*/"]], quotes: "\"'`", multi: ["`"], esc: true };
const STYLES = {
  c: C_LIKE,
  js: { ...C_LIKE, regex: true },
  php: { ...C_LIKE, line: ["//", "#"], hashAttr: true },
  markup: MARKUP,
  markupJs: { ...MARKUP, regex: true },
  py: { line: ["#"], block: [], quotes: "\"'", multi: ["\"\"\"", "'''"] },
  hash: { line: ["#"], block: [], quotes: "\"'", multi: [] },
  shell: { line: ["#"], block: [], quotes: "\"'", multi: [], wordHash: true },
  ps: { line: ["#"], block: [["<#", "#>"]], quotes: "\"'", multi: [], wordHash: true },
  sql: { line: ["--"], block: [["/*", "*/"]], quotes: "'\"", multi: [] },
  lua: { line: ["--"], block: [["--[[", "]]"]], quotes: "'\"", multi: [] },
  hs: { line: ["--"], block: [["{-", "-}"]], quotes: "\"", multi: [] },
  ml: { line: [], block: [["(*", "*)"]], quotes: "\"", multi: [] },
  lisp: { line: [";"], block: [], quotes: "\"", multi: [] },
  erl: { line: ["%"], block: [], quotes: "\"", multi: [] },
  vb: { line: ["'"], block: [], quotes: "\"", multi: [] },
  fortran: { line: ["!"], block: [], quotes: "\"'", multi: [] },
  pas: { line: ["//"], block: [["{", "}"], ["(*", "*)"]], quotes: "'", multi: [] },
  bat: { line: [], block: [], quotes: "\"", multi: [], lineStart: /^\s*(?:@?rem\b|::)/i },
  none: { line: [], block: [], quotes: "\"'", multi: [] },
};
const STYLE_OF_EXT = new Map();
for (const [style, exts] of [
  ["c", "go java c cpp h cc cxx c++ hpp hh hxx cs kt kts swift scala sc dart groovy sol rs m mm zig v sv svh glsl hlsl wgsl vert frag metal cu cuh hx odin vala d ino fs fsx fsi re rei"],
  ["js", "js mjs cjs ts tsx jsx mts cts"],
  ["php", "php"],
  ["markup", "razor cshtml jsp erb"],
  ["markupJs", "vue svelte astro"],
  ["py", "py pyi pyx mojo"],
  ["hash", "rb pl pm raku rakumod r jl nim ex exs cr tcl awk coffee gd nix"],
  ["shell", "sh bash zsh ksh fish csh tcsh"],
  ["ps", "ps1 psm1"],
  ["sql", "sql"],
  ["lua", "lua"],
  ["hs", "hs elm purs adb ads vhd vhdl"],
  ["ml", "ml mli"],
  ["lisp", "lisp el clj cljs cljc scm rkt asm s"],
  ["erl", "erl hrl"],
  ["vb", "vb vbs bas"],
  ["fortran", "f f90 f95 f03"],
  ["pas", "pas dpr"],
  ["bat", "bat cmd"],
]) for (const e of exts.split(" ")) STYLE_OF_EXT.set("." + e, style);
// each style's trigger characters — the first characters of its tokens — as a global class: the scan jumps from one to the next
// (a line holding none of them is code as it stands)
for (const st of Object.values(STYLES)) {
  const trig = new Set([...st.quotes, ...st.multi.map((d) => d[0]), ...st.block.map((b) => b[0][0]), ...st.line.map((t) => t[0]), ...(st.esc ? ["\\"] : [])]);
  st.trig = trig.size ? new RegExp("[" + [...trig].map((c) => "\\" + c).join("") + "]", "g") : null;
}
const RE_NOT_SOURCE = /\.ipynb$/i; // a notebook is JSON — its kernelspec / language_info metadata made any two one duplicate
const styleOf = (file) => {
  const f = String(file).toLowerCase();
  const dot = f.lastIndexOf(".");
  return STYLES[(dot > f.lastIndexOf("/") && STYLE_OF_EXT.get(f.slice(dot))) || "none"];
};

// Where the delimiter `d` closes a string opened before `from` (a backslash escapes the next character), or -1.
function closeAt(l, from, d) {
  for (let j = from; j < l.length; j++) {
    if (l[j] === "\\") { j++; continue; }
    if (l.startsWith(d, j)) return j;
  }
  return -1;
}
// JS / TS: may the `/` at k start a regex literal? Where an operand starts — the line's start, after an operator or an opening
// bracket, or after a keyword that takes an expression (`return /x/`); after a name, a number or a closing bracket it divides.
// Not after `<`: JSX's `</div>` closes a tag.
const RE_BEFORE_REGEX = /[(,=:[!&|?{};+\-*%>~^]/;
const REGEX_KEYWORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
function regexMayStart(l, k) {
  let p = k - 1;
  while (p >= 0 && (l[p] === " " || l[p] === "\t")) p--;
  if (p < 0 || RE_BEFORE_REGEX.test(l[p])) return true;
  let q = p;
  while (q >= 0 && /[\w$]/.test(l[q])) q--;
  return q < p && REGEX_KEYWORDS.has(l.slice(q + 1, p + 1));
}
// The end of the regex literal opened by the `/` at k — the index after its closing `/` (escapes and a character class's `/`
// skipped) — or -1 when the line holds none (a division after all).
function regexEnd(l, k) {
  let cls = false;
  for (let j = k + 1; j < l.length; j++) {
    const ch = l[j];
    if (ch === "\\") { j++; continue; }
    if (cls) { if (ch === "]") cls = false; continue; }
    if (ch === "[") cls = true;
    else if (ch === "/") return j + 1;
  }
  return -1;
}
// One line's code with its comments dropped and its strings kept; `state` carries a block comment (its closing token) or a
// string spanning lines (its delimiter) to the next line. One pass; a one-line string runs to its closing quote or the line's end.
function stripLine(l, st, state) {
  const n = l.length;
  let out = "", from = 0, k = 0;
  if (state.block) {
    const e = l.indexOf(state.block);
    if (e < 0) return "";
    k = from = e + state.block.length;
    state.block = null;
  } else if (state.multi) {
    const e = closeAt(l, 0, state.multi);
    if (e < 0) return l; // the whole line is inside the string: content, kept
    k = e + state.multi.length;
    state.multi = null;
  }
  if (k === 0 && st.lineStart && st.lineStart.test(l)) return "";
  const trig = st.trig;
  while (k < n && trig) {
    trig.lastIndex = k;
    const hit = trig.exec(l);
    if (!hit) break;
    k = hit.index;
    const c = l[k];
    let m = null;
    for (const d of st.multi) if (l.startsWith(d, k)) { m = d; break; }
    if (m) {
      const e = closeAt(l, k + m.length, m);
      if (e < 0) { state.multi = m; return out + l.slice(from); }
      k = e + m.length;
      continue;
    }
    if (st.quotes.indexOf(c) >= 0) {
      let j = k + 1;
      while (j < n && l[j] !== c) j += l[j] === "\\" ? 2 : 1;
      k = j + 1;
      continue;
    }
    // a regex literal (`/` then neither `/` nor `*`, where an operand starts): its text is code, never a comment or a string
    if (st.regex && c === "/" && l[k + 1] !== "/" && l[k + 1] !== "*" && regexMayStart(l, k)) {
      const e = regexEnd(l, k);
      k = e < 0 ? k + 1 : e;
      continue;
    }
    let b = null;
    for (const p of st.block) if (l.startsWith(p[0], k)) { b = p; break; }
    if (b) {
      out += l.slice(from, k) + " ";
      const e = l.indexOf(b[1], k + b[0].length);
      if (e < 0) { state.block = b[1]; return out; }
      k = from = e + b[1].length;
      continue;
    }
    if (st.line.some((t) => l.startsWith(t, k)) && (!st.wordHash || k === 0 || l[k - 1] === " " || l[k - 1] === "\t") &&
      !(st.hashAttr && c === "#" && l[k + 1] === "[")) return out + l.slice(from, k);
    k += st.esc && c === "\\" ? 2 : 1;
  }
  return out + l.slice(from);
}
// Lines that carry no code of their own: punctuation alone (`});`, `]`), a block's closing keyword, an import / include / use.
const RE_PUNCT_LINE = /^[\s{}()[\];,]*$/;
const RE_CLOSER_LINE = /^(?:end|fi|done|esac|endif|end if|wend|else|begin)\s*;?$/i;
const RE_IMPORT_LINE = /^(?:import\b|export\s+(?:\*|\{[^}]*\})\s+from\b|from\s+[\w.]+\s+import\b|#\s*(?:include|import)\b|using\s+(?:static\s+)?[\w.]+\s*;$|use\s+[\w:\\{}, *]+;$|package\s+[\w.]+;?$|require(?:_once|_relative)?\b|include(?:_once)?\s*[("']|(?:const|let|var)\s+[\w${}\s,:]+=\s*require\s*\(\s*["'`][^"'`]*["'`]\s*\)\s*;?$)/;
// An import spread over several lines: a first line that opens a bracket it doesn't close (over the normalized line). A sure one —
// Go's `import (`, Python's `from x import (`, JS / TS `import {` (`import type {`, `import React, {`), Rust's `use a::{`, PHP's
// `use A\{` — drops every line up to the bracket's close. `export {` and `const {` / `let {` / `var {` are one only when their
// closing line says so (`} from "…"`, `} = require(…)`): held until then, code otherwise. A line no import holds (an `=`, a
// call, a `;` before the close) ends the block — its held lines and itself are code — so an unclosed bracket never swallows the
// rest of a file; nor does a block past IMPORT_HOLD_MAX lines.
const RE_IMPORT_OPEN = /^(?:import \($|import (?:type )?(?:[\w$]+ ?, ?)?\{|from [\w.]+ import \(|(?:pub )?use [\w:]+::\{|use [\w\\]+\\\{)/;
const RE_IMPORT_MAYBE = /^(?:export (?:type )?\{|(?:const|let|var) \{)/;
const RE_IMPORT_MAYBE_CLOSE = /^\} ?(?:from ?["'`][^"'`]*["'`]|= ?require ?\( ?["'`][^"'`]*["'`] ?\)) ?;?$/;
const RE_IMPORT_BODY = /^[\w$.*"'`\\/:@, {}[\]-]*$/; // names, paths, aliases (`as`), Rust's nested `a::{b, c}` — no `=`, `;` nor call
const IMPORT_HOLD_MAX = 200;
const bracketDelta = (s) => {
  let d = 0;
  for (let j = 0; j < s.length; j++) {
    const ch = s[j];
    if (ch === "(" || ch === "{" || ch === "[") d++;
    else if (ch === ")" || ch === "}" || ch === "]") d--;
  }
  return d;
};
// A source text's code lines → { nums: their line numbers (1-based), keys: the normalized lines } — a leading BOM and CRLF are
// encoding; whitespace runs collapse to one space.
function codeLines(text, file) {
  const nums = [], keys = [];
  if (RE_NOT_SOURCE.test(String(file))) return { nums, keys }; // a notebook holds no code lines of its own (JSON)
  const st = styleOf(file);
  const state = { block: null, multi: null };
  let t = String(text == null ? "" : text);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const keep = (num, norm) => {
    if (RE_PUNCT_LINE.test(norm) || RE_CLOSER_LINE.test(norm) || RE_IMPORT_LINE.test(norm)) return;
    nums.push(num);
    keys.push(norm);
  };
  let imp = null; // inside a multi-line import: { depth (its open brackets), sure, held: [[line, norm]] — a maybe-import's lines }
  const release = () => { for (const [n0, k0] of imp.held) keep(n0, k0); imp = null; };
  const lines = t.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (l.charCodeAt(l.length - 1) === 13) l = l.slice(0, -1);
    const s = stripLine(l, st, state).trim();
    if (!s) continue;
    const norm = s.indexOf("  ") < 0 && s.indexOf("\t") < 0 ? s : s.replace(/\s+/g, " ");
    const delta = bracketDelta(norm);
    if (imp) {
      if (imp.depth + delta <= 0) { // its closing line: an import, or (a maybe-import that isn't) code
        if (imp.sure || RE_IMPORT_MAYBE_CLOSE.test(norm)) imp = null;
        else { imp.held.push([i + 1, norm]); release(); }
        continue;
      }
      if (RE_IMPORT_BODY.test(norm) && imp.held.length < IMPORT_HOLD_MAX && imp.lines++ < IMPORT_HOLD_MAX) {
        imp.depth += delta;
        if (!imp.sure) imp.held.push([i + 1, norm]);
        continue;
      }
      release(); // no import holds this line: the block was none (its held lines are code), and this line is read as any other
    }
    if (delta > 0 && RE_IMPORT_OPEN.test(norm)) { imp = { depth: delta, sure: true, held: [], lines: 0 }; continue; }
    if (delta > 0 && RE_IMPORT_MAYBE.test(norm)) { imp = { depth: delta, sure: false, held: [[i + 1, norm]], lines: 0 }; continue; }
    keep(i + 1, norm);
  }
  if (imp) release();
  return { nums, keys };
}

// --- matching ----------------------------------------------------------------------------------------------------------------
const minLinesOf = (v) => (Number.isSafeInteger(v) && v >= DUP_MIN_LINES_RANGE[0] && v <= DUP_MIN_LINES_RANGE[1] ? v : DUP_MIN_LINES);
// A window's identity: two 32-bit hashes of its line ids, as one 53-bit number (a match is then checked line by line).
function windowHash(ids, i, m) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let k = i; k < i + m; k++) {
    const v = ids[k];
    a = Math.imul(a ^ v, 0x01000193);
    b = Math.imul(b + v + 0x7f4a7c15, 0x5bd1e995) ^ (b >>> 15);
  }
  return (a >>> 0) * 2097152 + ((b >>> 0) & 0x1fffff);
}
function sameWindow(x, i, y, j, m) {
  for (let k = 0; k < m; k++) if (x[i + k] !== y[j + k]) return false;
  return true;
}
// Intervals [file, lo, hi] merged where they overlap or touch, in (file, lo) order.
function mergeIntervals(list) {
  const sorted = list.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const out = [];
  for (const s of sorted) {
    const cur = out[out.length - 1];
    if (cur && cur[0] === s[0] && s[1] <= cur[2] + 1) cur[2] = Math.max(cur[2], s[2]);
    else out.push(s.slice());
  }
  return out;
}

// The matcher over files already read — the detector's core, for any caller that has the texts (duplicationReport reads the
// project; a test hands it the plugin's own sources). files: [{ file (a forward-slash path), text }]. opts.minLines (default 6,
// 4–100); opts.feature: the paths of the feature's files (a Set or an array) — then the runs of the feature's lines that repeat
// code OUTSIDE them (`existing`) or another place INSIDE them (`within`); without it every run repeated anywhere among the files
// (`within`), each reported once (the longest first — a place already listed beside another is not listed again). opts.code: each
// duplicate also carries `code`, its normalized lines (what an allow-list reads — the plugin's duplication guard).
// → { minLines, scanned: {files, lines, duplicated}, duplicates: [{kind, file, from, to, lines, also: [{file, from, to}], alsoMore?,
//    code?}], counts: {existing, within} } — every duplicate, existing first, then the longest, then by file and line. `lines` counts
//    code lines (blank, comment, brace-only and import lines aside); from / to are the file's own line numbers; `duplicated`: the
//    code lines that lie in a repeated window, on either side (with a feature: of the runs reported).
function duplicateRuns(files, opts = {}) {
  const ix = lineIndex(opts.code === true);
  for (const x of files) indexFile(ix, x.file, x.text);
  return matchRuns(ix, minLinesOf(opts.minLines), opts.feature ? new Set(opts.feature) : null);
}
// The corpus as line ids: every distinct code line gets an id (interned); lens / seen: its length and how often it occurs (a window
// holding a line that occurs once can repeat nowhere — never hashed); texts: the line itself (code: true only). A file becomes its
// ids as it is added and its text is dropped — what a report holds grows with the DISTINCT lines, never with the bytes read.
const lineIndex = (code) => ({ idOf: new Map(), lens: [], seen: [], texts: code ? [] : null, F: [], lines: 0 });
function indexFile(ix, file, text) {
  const cl = codeLines(text, file);
  const ids = new Int32Array(cl.keys.length);
  for (let i = 0; i < cl.keys.length; i++) {
    let id = ix.idOf.get(cl.keys[i]);
    if (id === undefined) { id = ix.lens.length; ix.idOf.set(cl.keys[i], id); ix.lens.push(cl.keys[i].length); ix.seen.push(0); if (ix.texts) ix.texts.push(cl.keys[i]); }
    ix.seen[id]++;
    ids[i] = id;
  }
  ix.lines += ids.length;
  ix.F.push({ key: file, file: toPosix(file), ids, nums: Int32Array.from(cl.nums) });
}
// The runs over an index — read-only on it, so one index serves a feature's match and the project-wide one (dev-guardian's
// budget). m: the window; featureSet: the feature's files (the keys given to indexFile), or null.
function matchRuns(ix, m, featureSet) {
  ix.idOf.clear(); // every file is in: the ids are final
  const { lens, seen, texts, lines } = ix;
  const F = ix.F.map((f) => ({ file: f.file, ids: f.ids, nums: f.nums, feature: !!featureSet && featureSet.has(f.key) }));
  const minChars = m * DUP_LINE_CHARS;
  // each window of a file that could repeat (every line seen twice, enough characters) → fn(index, hash)
  const eachWindow = (fi, fn) => {
    const a = F[fi].ids, n = a.length;
    if (n < m) return;
    let sum = 0, rare = 0;
    for (let k = 0; k < m; k++) { sum += lens[a[k]]; if (seen[a[k]] < 2) rare++; }
    for (let i = 0; ; i++) {
      if (!rare && sum >= minChars) fn(i, windowHash(a, i, m));
      if (i + m >= n) break;
      sum += lens[a[i + m]] - lens[a[i]];
      if (seen[a[i + m]] < 2) rare++;
      if (seen[a[i]] < 2) rare--;
    }
  };
  const W = new Map(); // hash → an occurrence (packed) or the list of them
  const put = (h, fi, i) => {
    const v = fi * SPAN + i, cur = W.get(h);
    if (cur === undefined) W.set(h, v);
    else if (typeof cur === "number") W.set(h, [cur, v]);
    else if (cur.length < DUP_OCC_MAX) cur.push(v);
  };
  if (featureSet) {
    // the feature's windows first; every other file's only where one of them repeats
    F.forEach((f, fi) => { if (f.feature) eachWindow(fi, (i, h) => put(h, fi, i)); });
    F.forEach((f, fi) => { if (!f.feature) eachWindow(fi, (i, h) => { if (W.has(h)) put(h, fi, i); }); });
  } else F.forEach((f, fi) => eachWindow(fi, (i, h) => put(h, fi, i)));
  // matched windows → their diagonals (file a, file b, offset): consecutive windows on one diagonal are one run
  const diag = new Map();
  const pair = (x, y) => {
    const fa = Math.floor(x / SPAN), ia = x - fa * SPAN, fb = Math.floor(y / SPAN), ib = y - fb * SPAN;
    if (fa === fb && Math.abs(ia - ib) < m) return; // the same lines, overlapping
    if (!sameWindow(F[fa].ids, ia, F[fb].ids, ib, m)) return; // a hash collision
    const key = fa + ":" + fb + ":" + (ia - ib);
    const list = diag.get(key);
    if (list) list.push(ia); else diag.set(key, [ia]);
  };
  for (const occ of W.values()) {
    if (typeof occ === "number") continue;
    if (featureSet) {
      const mine = occ.filter((v) => F[Math.floor(v / SPAN)].feature), other = occ.filter((v) => !F[Math.floor(v / SPAN)].feature);
      for (const x of mine) for (const y of other) pair(x, y);
      for (let t = 1; t < mine.length; t++) pair(mine[0], mine[t]);
    } else for (let t = 1; t < occ.length; t++) pair(occ[0], occ[t]);
  }
  // runs: windows on one diagonal no more than a window apart cover every line between them (each line lies in a matched window)
  const sides = { existing: [], within: [] };
  const marks = F.map((f) => new Uint8Array(f.ids.length)); // the lines in a repeated window, either side (scanned.duplicated)
  for (const [key, list] of diag) {
    const [fa, fb, d] = key.split(":").map(Number);
    list.sort((p, q) => p - q);
    let s = list[0], e = list[0];
    for (let t = 1; t <= list.length; t++) {
      if (t < list.length && list[t] <= e + m) { e = list[t]; continue; }
      const a = [fa, s, e + m - 1], b = [fb, s - d, e + m - 1 - d];
      marks[fa].fill(1, a[1], a[2] + 1);
      marks[fb].fill(1, b[1], b[2] + 1);
      if (!featureSet) sides.within.push([a, b], [b, a]);
      else if (F[fa].feature && F[fb].feature) sides.within.push([a, b], [b, a]);
      else if (F[fa].feature) sides.existing.push([a, b]);
      if (t < list.length) s = e = list[t];
    }
  }
  const duplicated = marks.reduce((n, mk) => n + mk.reduce((x, v) => x + v, 0), 0);
  // per kind: each file's places merged (where they overlap or touch), with the places they repeat
  const places = (list) => {
    list.sort((p, q) => p[0][0] - q[0][0] || p[0][1] - q[0][1] || p[0][2] - q[0][2]);
    const out = [];
    for (const [a, b] of list) {
      const cur = out[out.length - 1];
      if (cur && cur.fi === a[0] && a[1] <= cur.hi + 1) { cur.hi = Math.max(cur.hi, a[2]); cur.also.push(b); }
      else out.push({ fi: a[0], lo: a[1], hi: a[2], also: [b] });
    }
    for (const p of out) p.also = mergeIntervals(p.also);
    return out;
  };
  const byName = (x, y) => (x < y ? -1 : x > y ? 1 : 0); // code-unit order: the same on every platform and locale
  const longest = (p, q) => q.hi - q.lo - (p.hi - p.lo) || byName(F[p.fi].file, F[q.fi].file) || p.lo - q.lo;
  // a repeat is listed once: the longest place first; a place it lists (or that overlaps one listed) is not listed again
  const once = (list) => {
    const claimed = new Map();
    const taken = (fi, lo, hi) => (claimed.get(fi) || []).some(([x, y]) => lo <= y && x <= hi);
    const claim = (fi, lo, hi) => { if (!claimed.has(fi)) claimed.set(fi, []); claimed.get(fi).push([lo, hi]); };
    return list.sort(longest).filter((p) => {
      if (taken(p.fi, p.lo, p.hi)) return false;
      claim(p.fi, p.lo, p.hi);
      for (const [f, lo, hi] of p.also) claim(f, lo, hi);
      return true;
    });
  };
  const at = (fi, lo, hi) => ({ file: F[fi].file, from: F[fi].nums[lo], to: F[fi].nums[hi] });
  const entry = (kind) => (p) => {
    const also = p.also.slice().sort((x, y) => byName(F[x[0]].file, F[y[0]].file) || x[1] - y[1]);
    return Object.assign({ kind, ...at(p.fi, p.lo, p.hi), lines: p.hi - p.lo + 1, also: also.slice(0, DUP_ALSO_MAX).map(([f, lo, hi]) => at(f, lo, hi)) },
      also.length > DUP_ALSO_MAX ? { alsoMore: also.length - DUP_ALSO_MAX } : {},
      texts ? { code: Array.from(F[p.fi].ids.subarray(p.lo, p.hi + 1), (id) => texts[id]) } : {});
  };
  const existing = places(sides.existing).sort(longest).map(entry("existing"));
  const within = once(places(sides.within)).map(entry("within"));
  return { minLines: m, scanned: { files: F.length, lines, duplicated }, duplicates: existing.concat(within), counts: { existing: existing.length, within: within.length } };
}

// --- the project's files -----------------------------------------------------------------------------------------------------
// generated or minified sources are nobody's duplicate: by name (x.min.js, *.generated.*, *.g.cs, *.pb.go, *_pb2.py…), by the
// generators' own header comment, or minified (lines of 400+ characters on average). The header is a convention, never any comment
// naming the word — "// IDs generated by the server" or "uses the auto-generated client" is a hand-written file, whose repeats are
// real: in the first 5 lines a comment holding `@generated`, `<auto-generated>` or Go's `Code generated … DO NOT EDIT`; in the first
// 3 (a shebang or an encoding line may come first) a comment that STARTS with "generated by / from / with …", "auto-generated",
// "this file was (automatically) generated" or an upper-case DO NOT EDIT.
const RE_GENERATED_NAME = /(?:\.min\.[a-z0-9]+|\.bundle\.js|\.generated\.[a-z0-9]+|\.g\.(?:cs|dart)|\.designer\.cs|\.pb\.(?:go|cc|h)|_pb2(?:_grpc)?\.pyi?)$/i;
const RE_GENERATED_MARK = /^\s*(?:\/\/|\/\*|\*|#|--|<!--|;|')[^\n]*?(?:@generated\b|<auto-?generated\b|\bcode generated\b[^\n]*\bdo not edit\b)/i;
const RE_GENERATED_LEAD = /^\s*(?:\/\/|\/\*|\*|#|--|<!--|;|')[\s!*/#=-]*(?:(?:this (?:file|code|module|class|source) (?:is|was|has been) )?(?:auto-?|automatically |machine[- ])?generated(?:\s+(?:by|from|with|using|on|code|file|source|automatically)\b|[\s.:;,!-]*(?:\*\/|-->)?\s*$)|auto-?generated\b)/i;
const RE_GENERATED_DO_NOT_EDIT = /^\s*(?:\/\/|\/\*|\*|#|--|<!--|;|')[\s!*/#=-]*DO NOT (?:EDIT|MODIFY)\b/;
function generatedText(text) {
  const head = text.slice(0, 2000).split("\n", 5);
  if (head.some((l) => RE_GENERATED_MARK.test(l))) return true;
  if (head.slice(0, 3).some((l) => RE_GENERATED_LEAD.test(l) || RE_GENERATED_DO_NOT_EDIT.test(l))) return true;
  if (text.length < 5000) return false;
  let nl = 0;
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) nl++;
  return (nl + 1) * 400 < text.length;
}
// A source file's text and size ({text, bytes}), or why it isn't read: "large" (past DUP_MAX_BYTES), "generated", null (unreadable).
// One open, its size from the open file (no second path lookup), one read into a reused buffer, decoded as every reader decodes
// (decodeText: a UTF-16 BOM decides, else UTF-8).
let READ_BUF = null;
function readSource(full, rel) {
  if (RE_GENERATED_NAME.test(rel)) return "generated";
  let fd = null;
  try {
    fd = fs.openSync(full, "r");
    const size = fs.fstatSync(fd).size;
    if (size > DUP_MAX_BYTES) return "large";
    if (!READ_BUF || READ_BUF.length < size) READ_BUF = Buffer.allocUnsafe(Math.max(size, 65536));
    let n = 0;
    while (n < size) {
      const r = fs.readSync(fd, READ_BUF, n, size - n, null);
      if (r <= 0) break;
      n += r;
    }
    const text = decodeText(READ_BUF, n);
    return generatedText(text) ? "generated" : { text, bytes: n };
  } catch {
    return null;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* already closed */ }
  }
}
// A plain _Implements:_ file the walk didn't reach (past its cap, or in a folder it skips) is still the feature's: its project
// path when it is a source file inside the project (never through a link out of it), else null.
function featureFileOnDisk(root, realRoot, ref, want) {
  const p = implementsPath(ref);
  if (!p || isImplementsGlob(p)) return null;
  const abs = path.resolve(root, p);
  if (abs === root || !withinRoot(root, abs)) return null;
  const rel = toPosix(path.relative(root, abs));
  if (!want(rel)) return null;
  try {
    if (!fs.statSync(abs).isFile() || !withinRoot(realRoot, fs.realpathSync.native(abs))) return null;
  } catch { return null; }
  return rel;
}

// dev-guardian's duplication budget (1.29): .guardian/budgets.yml → quality.duplication_pct — jscpd's duplicated-lines percentage,
// project-wide, which dev-guardian's quality_check holds the project to. A close measure, not the same one: this detector counts
// windows of code lines (comments, blank, brace-only and import lines aside). Read as dev-guardian reads it (loadBudgets, its
// budgets/budgets.ts — a YAML parser and a schema), with no YAML parser (zero dependencies): the document is a mapping of `perf:`
// and / or `quality:` (any other top-level key: dev-guardian refuses the file — so does this), each a block mapping (its keys at ONE
// indent, the first line's) or a flow mapping on its line, of KNOWN fields (perf: lcp_ms, inp_ms, cls, tbt_ms, bundle_size_kb ·
// quality: duplication_pct, complexity) whose values are plain YAML numbers — a quoted "5" is a string, a nested map no number:
// the file is invalid, and dev-guardian then enforces no budget at all, so nor does dev-spec. Comments and a `---` start are
// fine; anything else this reader can't follow (a sequence, a tab, a repeated key, a second document) reads as no budget. The
// file is read only when it is a plain file inside the project, ≤ 64 KB. → the limit (a finite number) | null.
const BUDGETS_FILE = ".guardian/budgets.yml";
const BUDGET_FIELDS = new Map([["perf", ["lcp_ms", "inp_ms", "cls", "tbt_ms", "bundle_size_kb"]], ["quality", ["duplication_pct", "complexity"]]]);
const RE_YAML_NUMBER = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;
const RE_YAML_ENTRY = /^( *)([^\s:#][^:]*?)\s*:(?:\s+(.*))?$/; // `<indent>key: value` (a value after a space; none: a block)
const yamlKey = (k) => (/^(["'])(.*)\1$/.test(k) ? k.slice(1, -1) : k);
function duplicationBudget(root) {
  const file = path.join(root, ".guardian", "budgets.yml");
  let text;
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > 65536 || !withinRoot(realRootOf(root), fs.realpathSync.native(file))) return null;
    text = decodeText(fs.readFileSync(file));
  } catch { return null; }
  const doc = readBudgets(text);
  return doc && doc.has("quality") && doc.get("quality").has("duplication_pct") ? doc.get("quality").get("duplication_pct") : null;
}
// budgets.yml's text → Map(section → Map(field → number)) as dev-guardian would load it, or null (invalid there, or a form this
// reader doesn't follow).
function readBudgets(text) {
  const doc = new Map();
  let open = null, indent = null; // the block section being read, and its entries' indent
  const emptyBlocks = new Set(); // a `quality:` with no entry under it is YAML null — no mapping: invalid
  const entry = (section, sec, key, val) => {
    if (!BUDGET_FIELDS.get(section).includes(key) || sec.has(key) || !RE_YAML_NUMBER.test(val)) return false;
    const n = Number(val);
    if (!Number.isFinite(n)) return false;
    sec.set(key, n);
    return true;
  };
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/\r$/, "").replace(/(?:^|\s)#.*$/, "").trimEnd(); // a comment: a # at the start or after a space
    if (!line.trim()) continue;
    if (/^[ \t]*\t/.test(line)) return null; // a tab indents nothing in YAML
    if (line === "---" && !doc.size) continue;
    const m = RE_YAML_ENTRY.exec(line);
    if (!m) return null;
    const ind = m[1].length, key = yamlKey(m[2].trim()), val = m[3] == null ? "" : m[3].trim();
    if (ind === 0) {
      if (!BUDGET_FIELDS.has(key) || doc.has(key)) return null; // an unknown top-level key: dev-guardian refuses the file
      const sec = new Map();
      doc.set(key, sec);
      open = null;
      if (!val) { open = key; indent = null; emptyBlocks.add(key); continue; } // a block: its entries follow
      const flow = /^\{(.*)\}$/.exec(val); // quality: { duplication_pct: 5, complexity: 15 }
      if (!flow) return null;
      for (const part of flow[1].split(",")) {
        if (!part.trim()) continue;
        const p = /^\s*([^:]+?)\s*:\s*(.+?)\s*$/.exec(part);
        if (!p || !entry(key, sec, yamlKey(p[1]), p[2])) return null;
      }
      continue;
    }
    if (!open) return null;
    if (indent === null) indent = ind;
    if (ind !== indent) return null; // deeper: a nested value — dev-guardian takes numbers only
    emptyBlocks.delete(open);
    if (!entry(open, doc.get(open), key, val)) return null;
  }
  return emptyBlocks.size ? null : doc;
}

// spec_scan {duplicates: true} / `dev-spec dupes [feature]`. opts.name: a feature — its code is the existing source files its
// tasks' _Implements:_ name (every task; a folder or a glob names the code files under it), reported against the rest of the
// project; without it the whole project's top duplicates. opts.minLines (default 6); opts.tests: test files too (left out by
// default); opts.cap: the files read (engine-internal); opts.budget (spec_finish's warning): with a feature, measure the whole
// project too for dev-guardian's duplication budget. The corpus is the scan's: source files by extension, no node_modules /
// .git / .specs / dist / build / vendor / coverage / hidden folders nor a folder the root .gitignore names, no test fixture,
// generated or minified file, none larger than DUP_MAX_BYTES (skipped {large, generated}), no notebook (.ipynb: JSON — its metadata
// made any two notebooks one duplicate). The files are read until DUP_TOTAL_BYTES of source (opts.maxBytes: engine-internal) — past
// it only the feature's own: `partial`.
// → { ok, feature?, minLines, featureFiles?, scanned: {files, lines, duplicated}, skipped: {large, generated}, truncated, duplicates (the top
//    DUP_TOP), counts: {existing, within}, total, partial?, budget? } — stable keys, English; the CLI renders it (cliText). partial
//    (only when the byte budget stopped the reading): { bytes (the budget), unread (the source files left unread) } — a repeat in them
//    is not seen. budget (1.29, when .guardian/budgets.yml sets quality.duplication_pct; without a feature, or with opts.budget):
//    { file, key, limit, measured (the project's duplicated share of its code lines, %, one decimal), over, note (the localized line) }.
function duplicationReport(projectDir, opts = {}) {
  const root = path.resolve(projectDir);
  const lang = projectLang(projectDir);
  if (!isDirSafe(root)) return { ok: false, root, error: i18n.msg(lang).brownfield.notFolder(root) };
  const m = minLinesOf(opts.minLines);
  const named = opts.name != null && String(opts.name).trim() !== "";
  const f = named ? existingFeature(projectDir, opts.name) : null;
  if (f && !f.ok) return { ok: false, error: f.error, code: f.code };
  const realRoot = realRootOf(root);
  const want = (rel) => isCodeFile(rel) && !RE_NOT_SOURCE.test(rel) && !isTestFixture(rel) && (opts.tests === true || !isTestFile(rel));
  const found = [];
  const walk = walkProject(root, Number.isSafeInteger(opts.cap) && opts.cap >= 1 ? opts.cap : DUP_FILE_CAP, (rel, full) => {
    if (want(rel)) found.push({ rel, full });
  }, { counts: want, gitignore: gitignoreRules(root, realRoot) });
  let mine = null;
  if (f) {
    const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
    const code = new Map(found.map((x) => [fold(x.rel), x.rel]));
    const keys = [...code.keys()].sort();
    mine = new Set();
    for (const ref of implementsRefs(readIfExists(path.join(f.dir, "tasks.md")))) {
      const hits = implementsTargets(root, ref, code, fold, keys);
      if (hits.length) { for (const k of hits) mine.add(code.get(k)); continue; }
      const extra = featureFileOnDisk(root, realRoot, ref, want);
      if (extra && !code.has(fold(extra))) { code.set(fold(extra), extra); found.push({ rel: extra, full: path.join(root, extra) }); mine.add(extra); }
    }
  }
  const skipped = { large: 0, generated: 0 };
  const ix = lineIndex(false);
  const maxBytes = Number.isSafeInteger(opts.maxBytes) && opts.maxBytes >= 1 ? opts.maxBytes : DUP_TOTAL_BYTES;
  let bytes = 0, unread = 0;
  // a feature without a source file of its own: nothing to compare, nothing read
  if (!mine || mine.size) {
    for (const x of found) {
      // past the byte budget only the feature's own files are read (partial: the rest is never seen)
      if (bytes >= maxBytes && !(mine && mine.has(x.rel))) { unread++; continue; }
      const r = readSource(x.full, x.rel);
      if (r === "large" || r === "generated") { skipped[r]++; if (mine) mine.delete(x.rel); }
      else if (r) { bytes += r.bytes; indexFile(ix, x.rel, r.text); }
    }
  }
  const r = mine && !mine.size ? { scanned: { files: 0, lines: 0, duplicated: 0 }, duplicates: [], counts: { existing: 0, within: 0 } } : matchRuns(ix, m, mine);
  // dev-guardian's budget beside the project's share: the project report's own count; a feature's (finish) a second, project-wide
  // match over the index already built — only when the budget is set
  const limit = duplicationBudget(root);
  const whole = limit == null ? null : !mine ? r.scanned : opts.budget === true && ix.F.length ? matchRuns(ix, m, null).scanned : null;
  let budget = null;
  if (whole && whole.lines) {
    const measured = Math.round((1000 * whole.duplicated) / whole.lines) / 10;
    budget = { file: BUDGETS_FILE, key: "quality.duplication_pct", limit, measured, over: measured > limit, note: i18n.msg(lang).guardian.budget(measured, limit, measured > limit, m) };
  }
  return Object.assign({ ok: true }, f ? { feature: f.slug } : {}, { minLines: m }, mine ? { featureFiles: mine.size } : {}, {
    scanned: r.scanned, skipped, truncated: walk.truncated, duplicates: r.duplicates.slice(0, DUP_TOP), counts: r.counts, total: r.duplicates.length,
  }, unread ? { partial: { bytes: maxBytes, unread } } : {}, budget ? { budget } : {});
}

module.exports = { duplicateRuns, duplicationReport, __link };

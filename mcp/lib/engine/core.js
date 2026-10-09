"use strict";

/**
 * dev-spec-driven engine — text scans, glob matching and _Implements:_ paths.
 * Pure helpers every module shares: the 1.17 H linear scans (each returns byte for byte what the regex it replaced
 * returned), own-key lookup, per-position blank facts, the linear glob matchers (capped brace expansion — never a
 * backtracking regex) and the ONE reading of an _Implements:_ reference (implementsPath / Rel / Key, globFiles).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let COVERAGE_CAP, FOLD_CASE, isInsideDir, readCacheKey, realRootOf, taskMarkerValues, tasksProseText, toPosix,
  WALK_STOP, walkProject, withinRoot;
function __link(E) { ({ COVERAGE_CAP, FOLD_CASE, isInsideDir, readCacheKey, realRootOf, taskMarkerValues,
  tasksProseText, toPosix, WALK_STOP, walkProject, withinRoot } = E); }

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

// Zero-dep glob for fileMatchPattern: `**` (any depth, none included), `*` and `?` (inside one segment), `{a,b}`
// (nested allowed; unbalanced braces are literal). Forward slashes; a leading "./" is ignored on both sides;
// case-insensitive where the filesystem folds case (Windows, macOS). The pattern is the user's, so no backtracking
// regex: braces expand into at most GLOB_MAX_ALTS alternatives (more → no match) and each one is matched by a
// linear DP over (token, position) — `**/**/**/x` or `*a*a*a*b` against a deep path used to hang the brief.
// It is the project's ONE glob: steering fileMatchPattern, and the _Implements:_ globs coverage() and trace_check resolve.
const GLOB_MAX_ALTS = 256;
const globNorm = (s) => String(s == null ? "" : s).trim().replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
function steeringGlobMatch(pattern, file) {
  return globMatcher(pattern)(file);
}
// The pattern compiled once (brace expansion) → (file) => boolean — for matching one pattern against many paths.
function globMatcher(pattern) {
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const g = fold(globNorm(pattern));
  const alts = g ? globAlternatives(g) : null;
  if (!alts) return () => false;
  return (file) => {
    const p = fold(globNorm(file));
    return !!p && alts.some((a) => globDpMatch(a, p));
  };
}
// An _Implements:_ entry that is a glob (coverage's and trace_check's rule). Braces alone don't make one: an
// _Implements:_ list is split on commas, so `{a,b}` can't survive there anyway.
const isImplementsGlob = (p) => /[*?]/.test(String(p || ""));
// "src/{a,b/{c,d}}/*.js" → ["src/a/*.js", "src/b/c/*.js", "src/b/d/*.js"]; unbalanced braces stay literal (the
// pattern itself); a top-level comma is literal. null past GLOB_MAX_ALTS.
function globAlternatives(g) {
  let depth = 0;
  for (const c of g) { if (c === "{") depth++; else if (c === "}" && --depth < 0) return [g]; }
  if (depth !== 0) return [g];
  const out = [];
  const walk = (s) => {
    if (out.length > GLOB_MAX_ALTS) return;
    const open = s.indexOf("{"); // the leftmost group: its prefix holds no brace, so the rest stays balanced
    if (open === -1) { out.push(s); return; }
    const parts = [];
    let d = 0, from = open + 1, close = -1;
    for (let i = open; i < s.length && close === -1; i++) {
      if (s[i] === "{") d++;
      else if (s[i] === "}" && --d === 0) close = i;
      else if (s[i] === "," && d === 1) { parts.push(s.slice(from, i)); from = i + 1; }
    }
    parts.push(s.slice(from, close));
    for (const part of parts) walk(s.slice(0, open) + part + s.slice(close + 1));
  };
  walk(g);
  return out.length > GLOB_MAX_ALTS ? null : out;
}
// One brace-free glob against one path. Tokens: "**/" (nothing, or anything ending in "/"), "**" (anything),
// "*" (anything but "/"), "?" (one char but "/"), a literal char. reach[j] = the tokens so far match p[0..j).
function globDpMatch(g, p) {
  const n = p.length;
  let cur = new Uint8Array(n + 1);
  cur[0] = 1;
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    const nxt = new Uint8Array(n + 1);
    let r = 0;
    if (c === "*" && g[i + 1] === "*") {
      while (g[i + 1] === "*") i++;
      if (g[i + 1] === "/") { // "**/"
        i++;
        for (let j = 0; j <= n; j++) { nxt[j] = cur[j] || (j > 0 && r && p[j - 1] === "/") ? 1 : 0; r = r || cur[j]; }
      } else for (let j = 0; j <= n; j++) { r = r || cur[j]; nxt[j] = r; } // "**"
    } else if (c === "*") {
      for (let j = 0; j <= n; j++) { r = cur[j] || (r && p[j - 1] !== "/") ? 1 : 0; nxt[j] = r; }
    } else {
      for (let j = 1; j <= n; j++) nxt[j] = cur[j - 1] && (c === "?" ? p[j - 1] !== "/" : p[j - 1] === c) ? 1 : 0;
    }
    if (!nxt.includes(1)) return false;
    cur = nxt;
  }
  return cur[n] === 1;
}

// _Implements:_ references of one tasks.md — the same reading as trace_check (HTML comments and fenced code out, the
// task-marker reader taskMarkerSpans, comma/semicolon lists, backticks dropped).
function implementsRefs(tasksText) {
  const out = [];
  for (const v of taskMarkerValues(tasksProseText(tasksText || ""), "implements")) {
    v.split(/[,;]/).map((s) => stripEnds(s.trim(), isBacktickUnit).trim()).filter(Boolean).forEach((p) => { if (!out.includes(p)) out.push(p); });
  }
  return out;
}
// A glob as a project-relative pattern that stays in the project, or null: an absolute pattern is accepted only under
// `root` (made relative, like an absolute in-project _Implements:_ path); otherwise no absolute path, drive, URI scheme,
// home ('~') or '..' segment.
function projectGlob(pattern, root) {
  let g = globNorm(pattern);
  if (root && (g.startsWith("/") || /^[A-Za-z]:\//.test(g))) {
    const r = toPosix(path.resolve(root)).replace(/\/+$/, "") + "/";
    const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
    if (fold(g).startsWith(fold(r))) g = g.slice(r.length);
  }
  if (!g || g.startsWith("/") || g.startsWith("~") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(g) || g.split("/").includes("..")) return null;
  return g;
}
// The files a project-relative glob matches (globMatcher — the one glob), walked only from its literal leading folders
// ("src/api/**" walks src/api; "lib/*.js" reads lib/ alone) and only as deep as the pattern can reach. Never outside the
// project: a glob that would leave it matches nothing (`outside`), the walk follows no symlink (walkProject) and a
// literal folder that resolves out of the project through a link is not entered. opts.first: stop at the first match;
// opts.cap: files looked at (default COVERAGE_CAP). The walk skips hidden and SCAN_IGNORE folders (dist, build, vendor…)
// like every project walk — except one the pattern spells out in a folder segment ("packages/*/dist/*.js",
// "src/**/.generated/*.ts"): a lone `*` / `**` never enters them, a named one does. Memoized per call (GLOB_CACHE).
// → { files: [rel], outside, truncated }
function globFiles(projectDir, pattern, opts = {}) {
  const root = path.resolve(projectDir);
  const cap = opts.cap || COVERAGE_CAP;
  const key = CTX.GLOB_CACHE ? [readCacheKey(root), String(pattern), opts.first ? 1 : 0, cap].join("\u0000") : null;
  const copy = (r) => ({ files: r.files.slice(), outside: r.outside, truncated: r.truncated });
  if (key !== null && CTX.GLOB_CACHE.has(key)) return copy(CTX.GLOB_CACHE.get(key).result);
  const done = (result, base, allowDir) => {
    if (key !== null) CTX.GLOB_CACHE.set(key, { base: base == null ? null : readCacheKey(base), allowDir, result: copy(result) });
    return result;
  };
  const g = projectGlob(pattern, root);
  if (!g) return done({ files: [], outside: true, truncated: false }, null);
  const parts = g.split("/");
  const lit = [];
  for (let i = 0; i < parts.length - 1 && !/[*?{]/.test(parts[i]); i++) lit.push(parts[i]);
  const base = path.resolve(root, ...lit);
  if (!withinRoot(root, base)) return done({ files: [], outside: true, truncated: false }, null);
  const allowDir = globFolderNames(g);
  try {
    if (!fs.statSync(base).isDirectory() || !withinRoot(realRootOf(root), fs.realpathSync.native(base))) return done({ files: [], outside: false, truncated: false }, base, allowDir);
  } catch {
    return done({ files: [], outside: false, truncated: false }, base, allowDir); // the literal folder doesn't exist: nothing matches
  }
  const rest = parts.slice(lit.length);
  const match = globMatcher(g);
  const files = [];
  const basePre = toPosix(path.relative(root, base)); // the literal folders, as path.relative spells them
  const walk = walkProject(base, cap, (r) => {
    const rel = basePre ? basePre + "/" + r : r;
    if (!match(rel)) return undefined;
    files.push(rel);
    return opts.first ? WALK_STOP : undefined;
  }, { maxDepth: rest.some((s) => s.includes("**")) ? Infinity : rest.length - 1, allowDir });
  return done({ files, outside: false, truncated: walk.truncated }, base, allowDir);
}
// The folder names a glob spells out → (name) => boolean, or null: every folder segment (all but the last, in every brace
// alternative) that is not wildcards alone — `dist`, `.generated`, `.gen*` — matched like the glob matches (case folded
// where the file system folds case). `*`, `**` and `?*` name no folder.
function globFolderNames(g) {
  const alts = globAlternatives(globNorm(g)) || [];
  const segs = new Set();
  for (const a of alts) for (const s of a.split("/").slice(0, -1)) if (s && /[^*?]/.test(s)) segs.add(s);
  if (!segs.size) return null;
  const matchers = [...segs].map((s) => globMatcher(s));
  return (name) => matchers.some((m) => m(name));
}
// The code files one reference names (keys of `code`): the file itself, every code file under a folder, or a
// glob's matches. `path/to/file.js:12` and `#L12` anchors are dropped; a path outside the project names nothing.
const implementsPath = (ref) => {
  const s = stripHashLineAnchor(String(ref).trim().replace(/\\/g, "/")); // .replace(/#L?\d+.*$/, "")
  const c = colonLineAnchorAt(s); // .replace(/:\d+(?:[-:]\d+)*$/, "")
  return (c === -1 ? s : s.slice(0, c)).trim();
};
function isDigitUnit(c) {
  return c !== undefined && c >= "0" && c <= "9";
}
// s.replace(/#L?\d+.*$/, ""): from the first '#' followed by digits (or L and digits) with no line terminator after it.
function stripHashLineAnchor(s) {
  for (let i = s.indexOf("#", lastLtIndex(s) + 1); i !== -1; i = s.indexOf("#", i + 1)) {
    if (isDigitUnit(s[s[i + 1] === "L" ? i + 2 : i + 1])) return s.slice(0, i);
  }
  return s;
}
// Where /:\d+(?:[-:]\d+)*$/ matches in s (a trailing ":12" / ":12-20" / ":3:5" anchor), else -1: the leftmost ':' of the
// trailing run of digit groups joined by single '-' / ':'.
function colonLineAnchorAt(s) {
  let at = -1;
  for (let i = s.length - 1; i >= 0 && isDigitUnit(s[i]);) {
    let j = i;
    while (j >= 0 && isDigitUnit(s[j])) j--;
    if (s[j] === ":") at = j;
    if (s[j] !== ":" && s[j] !== "-") break;
    i = j - 1;
  }
  return at;
}
// One _Implements:_ reference as every reader spells the file: backticks, a line anchor (:12 / #L12), a leading ./ and a
// trailing / dropped, forward slashes. implementsKey: the same, case-folded where the file system folds case — so
// `src/payment.js:10`, `./src/payment.js#L50` and `SRC/Payment.js` (on Windows / macOS) compare as one file.
const implementsRel = (ref) => stripEnd(implementsPath(stripEnds(String(ref).trim(), isBacktickUnit)).replace(/^(?:\.\/)+/, ""), isSlashUnit);
const implementsKey = (ref) => (FOLD_CASE ? implementsRel(ref).toLowerCase() : implementsRel(ref));
// sorted (optional — coverage builds it once per call, 1.22 review): code's keys, sorted. A folder's files are then found by a
// binary search (keysWithPrefix) instead of a scan of every key; the same files, in key order instead of the map's.
function implementsTargets(root, ref, code, fold, sorted) {
  const p = implementsPath(ref);
  if (!p) return [];
  if (isImplementsGlob(p)) {
    const g = projectGlob(p, root); // "../x/**", "/elsewhere/*": outside the project, names nothing
    if (!g) return [];
    const match = globMatcher(g); // keys are already case-folded where the file system folds case; the matcher folds too
    return (sorted || [...code.keys()]).filter((k) => match(k));
  }
  const abs = path.resolve(root, p);
  // The whole project, or outside it: never counted. isInsideDir, not `root + sep`: a drive root (Q:\ from subst)
  // already ends in a separator.
  if (abs === root || !isInsideDir(root, abs)) return [];
  const rel = fold(toPosix(path.relative(root, abs)));
  if (code.has(rel)) return [rel];
  return sorted ? keysWithPrefix(sorted, rel + "/") : [...code.keys()].filter((k) => k.startsWith(rel + "/"));
}
// The keys of a sorted array that start with `prefix` — contiguous in code-unit order (Array#sort's and `<`'s): the first is
// found by a binary search, the rest follow it.
function keysWithPrefix(sorted, prefix) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid] < prefix) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < sorted.length && sorted[i].startsWith(prefix); i++) out.push(sorted[i]);
  return out;
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

// ---------------------------------------------------------------------------
// Did-you-mean (1.24 r6) — the one edit distance behind every suggestion: a track (suggestTrack), a tool argument (the MCP
// server's unknown-argument refusal). Words are short (names, keys), so the O(a·b) table is cheap.
// ---------------------------------------------------------------------------

// The optimal-string-alignment distance: insert, delete, substitute — and a transposition ('sasa', 'revokde') — cost 1.
function osaDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// The candidate nearest to `word` — compared case-insensitively — within `limit(candidate, word)` edits (default: max(1,
// ⌊candidate length / 3⌋), the CLI's rule for a mistyped flag; the first of equals wins), else null. A suggestion only:
// never accepted as input.
function closestName(word, candidates, limit) {
  const w = String(word == null ? "" : word).toLowerCase();
  const max = typeof limit === "function" ? limit : (c) => Math.max(1, Math.floor(c.length / 3));
  let best = null;
  for (const c of candidates || []) {
    if (typeof c !== "string") continue;
    const n = osaDistance(w, c.toLowerCase());
    if (n <= max(c, w) && (!best || n < best.n)) best = { c, n };
  }
  return best ? best.c : null;
}

module.exports = { isWsUnit, RE_LINE_TERMINATOR, isLtUnit, lastLtIndex, stripHashComment, quotedValue, unitIn,
  wsOrUnitIn, isSlashUnit, isBacktickUnit, stripEnd, stripStart, stripEnds, restAfterBlanks, plusAfterBlanks, headRest,
  headPlus, replaceHtmlCommentSpans, codeSpans, replaceCodeSpans, atxHeading, GLOB_MAX_ALTS, globNorm,
  steeringGlobMatch, globMatcher, isImplementsGlob, globAlternatives, globDpMatch, implementsRefs, projectGlob,
  globFiles, globFolderNames, implementsPath, isDigitUnit, stripHashLineAnchor, colonLineAnchorAt, implementsRel,
  implementsKey, implementsTargets, keysWithPrefix, own, blankFacts, osaDistance, closestName, __link };

"use strict";

/**
 * dev-spec-driven engine — glob matching and _Implements:_ paths.
 * Linear glob matchers (capped brace expansion — never a backtracking regex) and the ONE reading of an
 * _Implements:_ reference (implementsPath / implementsRel / implementsKey, globFiles).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let COVERAGE_CAP, FOLD_CASE, isBacktickUnit, isInsideDir, isSlashUnit, lastLtIndex, readCacheKey, realRootOf, stripEnd,
  stripEnds, taskMarkerValues, tasksProseText, toPosix, WALK_STOP, walkProject, withinRoot;
function __link(E) { ({ COVERAGE_CAP, FOLD_CASE, isBacktickUnit, isInsideDir, isSlashUnit, lastLtIndex, readCacheKey,
  realRootOf, stripEnd, stripEnds, taskMarkerValues, tasksProseText, toPosix, WALK_STOP, walkProject, withinRoot } = E); }

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
function implementsTargets(root, ref, code, fold) {
  const p = implementsPath(ref);
  if (!p) return [];
  if (isImplementsGlob(p)) {
    const g = projectGlob(p, root); // "../x/**", "/elsewhere/*": outside the project, names nothing
    if (!g) return [];
    const match = globMatcher(g); // keys are already case-folded where the file system folds case; the matcher folds too
    return [...code.keys()].filter((k) => match(k));
  }
  const abs = path.resolve(root, p);
  // The whole project, or outside it: never counted. isInsideDir, not `root + sep`: a drive root (Q:\ from subst)
  // already ends in a separator.
  if (abs === root || !isInsideDir(root, abs)) return [];
  const rel = fold(toPosix(path.relative(root, abs)));
  if (code.has(rel)) return [rel];
  return [...code.keys()].filter((k) => k.startsWith(rel + "/"));
}

module.exports = { GLOB_MAX_ALTS, globNorm, steeringGlobMatch, globMatcher, isImplementsGlob, globAlternatives,
  globDpMatch, implementsRefs, projectGlob, globFiles, globFolderNames, implementsPath, isDigitUnit,
  stripHashLineAnchor, colonLineAnchorAt, implementsRel, implementsKey, implementsTargets, __link };

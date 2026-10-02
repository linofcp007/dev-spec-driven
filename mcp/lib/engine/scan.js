"use strict";

/**
 * dev-spec-driven engine — brownfield scan and coverage.
 * The heuristic, bounded, read-only codebase scan (routes, env, migrations, entrypoints) and spec_coverage.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let FOLD_CASE, implementsPath, implementsRefs, implementsTargets, isDirSafe, isInsideDir, isObj, isSlashUnit, listFeatures,
  projectLang, readDirCached, readFileHead, readIfExists, safeReaddir, specsRoot, stripEnd;
function __link(E) { ({ FOLD_CASE, implementsPath, implementsRefs, implementsTargets, isDirSafe, isInsideDir, isObj, isSlashUnit,
  listFeatures, projectLang, readDirCached, readFileHead, readIfExists, safeReaddir, specsRoot, stripEnd } = E); }

// ---------------------------------------------------------------------------
// Brownfield: heuristic local codebase scan + spec coverage (no model, no cost)
// ---------------------------------------------------------------------------

const SCAN_IGNORE = new Set([".git", ".specs", ".kiro", "_archive", "node_modules", "dist", "build", ".next", "out", "coverage", "vendor", "target", ".venv", "venv", "__pycache__", ".idea", ".vscode", ".cursor", ".windsurf", ".gemini", ".github"]);
// ONE notion of code (1.21.1): source files in a broad list of languages. The brownfield scan's inventory, spec_coverage's
// denominators, the test-code scan (trace --code, the Phase 4 tests gate, doctor's tests-in-code, finish) and guard mode
// all read it. Until 1.21.1 the scan, coverage and the test scan knew only JS/TS, Python, Go, Rust, Java, Ruby, PHP, C#,
// Kotlin, Swift, C/C++ and Vue/Svelte — a PowerShell, shell, Lua, R, Erlang… project scanned empty, had 0 code files and a
// tests gate that could never pass (its test files were never read) — while guard mode kept its own, broader list.
// It is an allow-list, so the docs say "a broad list of languages", never "any source file": docs, config, data, markup and
// styles (.md, .json, .yaml, .toml, .html, .css, a PowerShell data / module manifest .psd1…) are never code.
const CODE_EXT = new Set([
  // the languages the scan also READS (SCAN_TEXT_EXT: routes, env names, entrypoints, test runners)
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".mts", ".cts", ".py", ".go", ".rs", ".java", ".rb", ".php", ".cs", ".kt", ".swift", ".c", ".cpp", ".h",
  ".vue", ".svelte", ".ps1", ".psm1",
  ".ipynb", ".cc", ".cxx", ".c++", ".hpp", ".hh", ".hxx", ".m", ".mm", ".scala", ".sc", ".dart", ".ex", ".exs", ".erl", ".hrl",
  ".hs", ".clj", ".cljs", ".cljc", ".lua", ".pl", ".pm", ".r", ".jl", ".zig", ".nim", ".groovy", ".fs", ".fsx", ".fsi", ".vb", ".ml", ".mli",
  ".sol", ".sh", ".bash", ".zsh", ".sql",
  // shells and scripting (Windows batch included — the platform this plugin must stay safe on)
  ".bat", ".cmd", ".ksh", ".fish", ".csh", ".tcsh", ".awk", ".vbs", ".tcl", ".raku", ".rakumod",
  // JVM / .NET / web-compiled languages
  ".kts", ".coffee", ".elm", ".purs", ".re", ".rei", ".hx", ".gleam", ".cr", ".nix", ".vala", ".gd", ".mojo", ".odin", ".pyi", ".pyx",
  // Lisps and other functional languages
  ".rkt", ".scm", ".lisp", ".el",
  // systems, scientific, legacy
  ".d", ".cu", ".cuh", ".f", ".f90", ".f95", ".f03", ".pas", ".dpr", ".asm", ".s", ".adb", ".ads", ".cob", ".cbl", ".bas", ".ino",
  // hardware description and shaders
  ".v", ".sv", ".svh", ".vhd", ".vhdl", ".glsl", ".hlsl", ".wgsl", ".vert", ".frag", ".metal",
  // templates that carry code (not plain markup)
  ".astro", ".razor", ".cshtml", ".jsp", ".erb"]);
// Test-only extensions: never production code, so never in the inventory or coverage's denominators — a file with one is
// code only where it is a TEST (isCodeFile): a Bats suite (*.bats, anywhere) or a Perl test (*.t, under t/, xt/ or a test
// folder — a .t anywhere else is neither).
const TEST_EXTRA_EXT = new Set([".bats", ".t"]);
// The extension allow-list with the test-only ones — what a File cell or a path "looks like code" by its extension alone
// (trace's plannedOutsideCode, the reuse check's neighbours). Guard mode decides per path, with isCodeFile.
const GUARD_CODE_EXT = new Set([...CODE_EXT, ...TEST_EXTRA_EXT]);
// The code files whose TEXT the scan reads (routes, env names, entrypoints, the runner a test imports) — the languages it
// has readers for. Every other code file is counted (inventory, tests, coverage), never read: a tree of SQL migrations or
// shell scripts would otherwise spend SCAN_READ_CAP before the first route file.
const SCAN_TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".mts", ".cts", ".py", ".go", ".rs", ".java", ".rb", ".php", ".cs", ".kt",
  ".swift", ".c", ".cpp", ".h", ".vue", ".svelte", ".ps1", ".psm1"]);
const SCAN_READ_CAP = 1500; // code files whose text is read (routes, env names, test/entrypoint hints)
const SCAN_READ_BYTES = 200000;
const SCAN_ROUTE_CAP = 200; // routes listed — candidateEndpoints still counts every one found
const SCAN_LIST_CAP = 100; // entrypoints / migrations listed (env names: twice that)
const COVERAGE_CAP = 20000; // code files walked by coverage() (every file, for the other walks that default to it)
// 1.22 review — a COUNTING walk (opts.counts: the scan, coverage) bounds the files that count (code, manifests) by its cap and
// every folder entry it examines by this one: 6,000 PNGs in assets/ before src/ no longer use up the cap before the first code
// file, and a huge tree still ends.
const WALK_ENTRY_CAP = 200000;

// Bounded, read-only, alphabetical walk (hidden dirs and SCAN_IGNORE skipped; symlinks never followed — a link
// out of the project is not read). onFile(rel, full, name) gets a forward-slash path relative to the root.
// opts.maxDepth: folder levels below the root to enter (0 = the root's own files); onFile returning WALK_STOP ends the walk.
// opts.allowDir(name): a hidden / SCAN_IGNORE folder this walk enters anyway (a glob that spells `dist` or `.generated`).
// opts.counts(rel, name) (1.22 review): only the files it says yes to count toward `cap` (every other file is still visited),
// opts.entryCap (default WALK_ENTRY_CAP) bounds the entries examined, and `truncated` means a counted file — or, past entryCap,
// any entry — was left unvisited. Without it every file counts and `truncated` is "the cap was reached" (the other walks).
// opts.gitignore (gitignoreRules — the scan and coverage): a folder its `dir(rel)` names is skipped, and so is one (not the
// root) whose own .gitignore ignores everything in it. → { total (counted files), files (visited), truncated }.
// Folder listings come from the per-call read cache (readDirCached). `full` is absolute (under path.resolve(root)) and
// both paths are built by concatenation — path.relative / path.join cost ~15 µs a file on Windows, most of a `**` walk.
const WALK_STOP = Symbol("walk-stop");
function walkProject(root, cap, onFile, opts = {}) {
  let total = 0, files = 0, seen = 0;
  const maxDepth = opts.maxDepth == null ? Infinity : opts.maxDepth;
  const counts = typeof opts.counts === "function" ? opts.counts : null;
  const entryCap = counts ? opts.entryCap || WALK_ENTRY_CAP : Infinity;
  const gi = opts.gitignore || null;
  const stack = [[path.resolve(root), 0, ""]]; // [absolute folder, depth, its forward-slash path from the root]
  let stopped = false, over = false;
  while (stack.length && !stopped && (counts ? !over : total < cap)) {
    const [d, depth, relDir] = stack.pop();
    const entries = readDirCached(d);
    if (!entries) continue;
    const pre = d.endsWith(path.sep) ? d : d + path.sep; // a drive / file-system root already ends in a separator
    const relPre = relDir ? relDir + "/" : "";
    if (gi && relDir && gitignoredFolder(entries, pre)) continue;
    const dirs = [];
    for (const e of entries) {
      if (counts) { if (seen++ >= entryCap) { over = true; break; } } else if (total >= cap) break;
      if (e.isDirectory() && (e.name.startsWith(".") || SCAN_IGNORE.has(e.name))) {
        if (!(opts.allowDir && opts.allowDir(e.name))) continue; // hidden dirs: VCS, tool caches, worktrees
      } else if (SCAN_IGNORE.has(e.name)) continue;
      if (e.isDirectory()) { if (depth < maxDepth && !(gi && gi.dir && gi.dir(relPre + e.name))) dirs.push(e.name); continue; }
      if (!e.isFile()) continue;
      const rel = relPre + e.name;
      if (!counts) total++;
      else if (counts(rel, e.name)) { if (total >= cap) { over = true; break; } total++; }
      files++;
      if (onFile(rel, pre + e.name, e.name) === WALK_STOP) { stopped = true; break; }
    }
    if (!stopped && !over) for (let i = dirs.length - 1; i >= 0; i--) stack.push([pre + dirs[i], depth + 1, relPre + dirs[i]]);
  }
  return { total, files, truncated: counts ? over : !stopped && total >= cap };
}

// 1.22 review — generated and vendored folders the scan and coverage walks leave out beyond SCAN_IGNORE (.NET obj/, Elixir
// deps/ and _build/, iOS Pods/…: their AssemblyInfo.cs / GlobalUsings.g.cs were production code, and their routes phantom
// ones): the project ROOT .gitignore's plain directory patterns — a name, optionally with a leading and / or trailing '/',
// or a path of such names (a slash inside anchors it to the root, as in git), each name literal or with simple character
// classes ([Bb]in/, [Oo]bj/, [a-z]) — matched against folders only. Wildcards (* ? **), escapes and negated classes are left
// out, and so is a pattern a negation could re-include (review 2): a pattern read wrongly would hide real code. And a folder (never the root) whose OWN .gitignore ignores
// everything in it — '*', re-including at most .gitignore / .gitkeep / .keep — as Laravel's storage/framework/views/ and
// bootstrap/cache/ do. Never a built-in name list: Ruby and Node keep real code in bin/.
const GITIGNORE_MAX_CHARS = 100000;
const GITIGNORE_MAX_PATTERNS = 2000;
// One name of a pattern → its units (a character, or the Set a class allows), or null when it holds anything else.
function gitignoreName(s) {
  if (!s || s === "." || s === "..") return null;
  const units = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "*" || c === "?" || c === "]" || c === "\\") return null;
    if (c !== "[") { units.push(c); continue; }
    const close = s.indexOf("]", i + 1);
    if (close <= i + 1) return null;
    const body = s.slice(i + 1, close);
    if (body[0] === "!" || body[0] === "^" || body.includes("[") || body.includes("\\")) return null;
    const set = new Set();
    for (let j = 0; j < body.length; j++) {
      if (body[j + 1] === "-" && j + 2 < body.length) {
        const a = body.charCodeAt(j), b = body.charCodeAt(j + 2);
        if (b < a || b - a > 256) return null;
        for (let k = a; k <= b; k++) set.add(String.fromCharCode(k));
        j += 2;
      } else set.add(body[j]);
    }
    units.push(set);
    i = close;
  }
  return units;
}
// .gitignore text → [{ anchored, names: [units…] }] (the plain directory patterns above; folded where the file system folds case).
// 1.22 review 2 — a NEGATION re-includes what a pattern left out, and Git then tracks it: `lib/` (the Python template) with
// `!frontend/src/lib/` (a SvelteKit app's code) hid frontend/src/lib/*.ts from the scan and coverage. A pattern a negation could
// re-include is never applied (conservative — never hide code Git tracks): one whose LAST name the negation's last name could
// be (`gitignoreNegationReincludes` — the same name, or a wildcard / class that could match it). Only the last name: Git
// re-includes nothing below a folder that stays excluded, so `!lib/keep/` brings back no `lib/` (dropping it would only show
// more code). The line order is not read (a negation BEFORE its pattern loses in Git — dropping that one is conservative too).
function gitignoreDirPatterns(text) {
  const pos = [], negs = [];
  let negOverflow = false;
  for (const raw of String(text).split(/\r?\n/)) {
    let l = raw.trim();
    if (!l || l[0] === "#") continue;
    if (FOLD_CASE) l = l.toLowerCase();
    if (l[0] === "!") {
      const tokens = gitignoreNegationTokens(l.slice(1));
      if (tokens === undefined) continue; // names nothing a folder could be called
      if (negs.length >= GITIGNORE_MAX_NEGATIONS) { negOverflow = true; break; }
      negs.push(tokens);
      continue;
    }
    if (pos.length >= GITIGNORE_MAX_PATTERNS) continue; // keep reading: a negation further down still counts
    let anchored = false;
    if (l[0] === "/") { anchored = true; l = l.slice(1); }
    if (l.endsWith("/")) l = l.slice(0, -1);
    const segs = l.split("/");
    if (segs.length > 1) anchored = true; // a slash inside the pattern anchors it to the .gitignore's folder (git)
    const names = segs.map(gitignoreName);
    if (!names.length || names.some((n) => !n) || names[names.length - 1].length > GITIGNORE_MAX_NAME) continue;
    pos.push({ anchored, names });
  }
  if (negOverflow) return []; // too many negations to weigh: apply none of the patterns rather than guess
  if (!negs.length) return pos;
  let budget = GITIGNORE_NEGATION_BUDGET;
  const out = [];
  for (const p of pos) {
    const last = p.names[p.names.length - 1];
    let reincluded = false;
    for (const t of negs) {
      budget -= (t ? t.length : 1) * last.length + 1;
      if (budget < 0) return []; // a hostile file: apply none of the patterns rather than spend the walk on it
      if (gitignoreNegationReincludes(t, last)) { reincluded = true; break; }
    }
    if (!reincluded) out.push(p);
  }
  return out;
}
const GITIGNORE_MAX_NAME = 255; // a longer name is no folder name (every file system's limit)
const GITIGNORE_MAX_NEGATIONS = 200;
const GITIGNORE_NEGATION_BUDGET = 4000000; // name-unit comparisons over all pattern × negation pairs
// A negation's LAST name (after `!`, a leading `/`, a trailing `/` or `/**`) → its glob tokens ({ lit } · { one } · { star } ·
// { set, neg }; a class it can't read is { one }: any character), or undefined when it could be no folder name (empty, `.` /
// `..`, longer than any name can be). (gitignoreNegationReincludes reads a missing token list as "any name".)
function gitignoreNegationTokens(l) {
  let s = l.trim();
  while (s.endsWith("/**")) s = s.slice(0, -3);
  s = s.replace(/\/+$/, "");
  const last = s.slice(s.lastIndexOf("/") + 1);
  if (!last || last === "." || last === "..") return undefined;
  const tokens = [];
  let fixed = 0;
  for (let i = 0; i < last.length; i++) {
    const c = last[i];
    if (c === "*") { if (!tokens.length || !tokens[tokens.length - 1].star) tokens.push({ star: true }); continue; }
    fixed++;
    if (c === "?") { tokens.push({ one: true }); continue; }
    if (c === "\\") { if (i + 1 < last.length) i++; tokens.push({ lit: last[i] }); continue; }
    if (c !== "[") { tokens.push({ lit: c }); continue; }
    let j = i + 1;
    const neg = last[j] === "!" || last[j] === "^";
    if (neg) j++;
    const close = last.indexOf("]", last[j] === "]" ? j + 1 : j); // a ']' first in the class is a member
    if (close === -1) { tokens.push({ lit: "[" }); continue; }
    const body = last.slice(j, close);
    i = close;
    if (body.includes("\\") || body.includes("[")) { tokens.push({ one: true }); continue; } // unread: any one character
    const set = new Set();
    for (let k = 0; k < body.length; k++) {
      if (body[k + 1] === "-" && k + 2 < body.length) {
        const a = body.charCodeAt(k), b = body.charCodeAt(k + 2);
        if (b < a || b - a > 256) { set.clear(); break; }
        for (let x = a; x <= b; x++) set.add(String.fromCharCode(x));
        k += 2;
      } else set.add(body[k]);
    }
    tokens.push(set.size ? { set, neg } : { one: true });
  }
  if (fixed > GITIGNORE_MAX_NAME) return undefined;
  return tokens;
}
// Could the negation's last name (its tokens) be a name the pattern's last name (its units — a character or a class's Set)
// matches? One pass over the units per token (a star: any run) — exact for the units' per-position choices.
function gitignoreNegationReincludes(tokens, units) {
  if (!tokens) return true;
  const fits = (t, u) => {
    if (t.one) return true;
    const chars = typeof u === "string" ? [u] : u;
    for (const c of chars) if (t.lit != null ? c === t.lit : t.set.has(c) !== t.neg) return true;
    return false;
  };
  let prev = new Array(units.length + 1).fill(false);
  prev[0] = true;
  for (const t of tokens) {
    const cur = new Array(units.length + 1).fill(false);
    if (t.star) { let any = false; for (let j = 0; j <= units.length; j++) { any = any || prev[j]; cur[j] = any; } }
    else for (let j = 1; j <= units.length; j++) cur[j] = prev[j - 1] && fits(t, units[j - 1]);
    prev = cur;
  }
  return prev[units.length];
}
function gitignoreNameMatch(units, name) {
  if (units.length !== name.length) return false;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (typeof u === "string" ? u !== name[i] : !u.has(name[i])) return false;
  }
  return true;
}
// The rules of the project's ROOT .gitignore (read only when it is a file inside the project) → { dir(relFolder) | null } for
// walkProject's opts.gitignore. `dir` gets a folder's forward-slash path from the root; its parents were already let in.
function gitignoreRules(root, realRoot) {
  const file = path.join(root, ".gitignore");
  const pats = projectFileInside(realRoot || root, file) ? gitignoreDirPatterns(readFileHead(file, GITIGNORE_MAX_CHARS) || "") : [];
  const floating = pats.filter((p) => !p.anchored).map((p) => p.names[0]);
  const anchored = pats.filter((p) => p.anchored).map((p) => p.names);
  const dir = (rel) => {
    const segs = (FOLD_CASE ? String(rel).toLowerCase() : String(rel)).split("/");
    const last = segs[segs.length - 1];
    if (floating.some((u) => gitignoreNameMatch(u, last))) return true;
    return anchored.some((names) => names.length === segs.length && names.every((u, k) => gitignoreNameMatch(u, segs[k])));
  };
  return { dir: pats.length ? dir : null };
}
// A .gitignore that ignores everything in its folder: '*' (or '/*', '**', '/**', '**/*'), re-including at most the
// placeholder files that keep the empty folder in git. Any other rule → no (a narrower or a mixed list).
function gitignoresAll(text) {
  let all = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l[0] === "#") continue;
    if (l === "*" || l === "/*" || l === "**" || l === "/**" || l === "**/*") { all = true; continue; }
    if (/^!\/?\.(?:gitignore|gitkeep|keep)$/.test(l)) continue;
    return false;
  }
  return all;
}
function gitignoredFolder(entries, pre) {
  const g = entries.find((e) => e.name === ".gitignore");
  return !!g && g.isFile() && gitignoresAll(readFileHead(pre + ".gitignore", 4000) || "");
}
// A ROOT file the scan reads (a manifest, the .gitignore): a regular file, or a link whose real path stays inside the project —
// a committed `package.json -> /home/me/.npmrc` is never read (1.22 review; the walk itself never follows a link). realRoot: the
// project's real path.
function projectFileInside(realRoot, full) {
  try {
    const st = fs.lstatSync(full);
    if (!st.isSymbolicLink()) return st.isFile();
    const real = fs.realpathSync.native(full);
    return isInsideDir(realRoot, real) && fs.statSync(real).isFile();
  } catch {
    return false;
  }
}

// Test code: under a test folder, or named like a test in its language. Reported apart by scan and coverage. ONE rule —
// isTestFile — for the scan, coverage, the test-code scan (trace's isTestCodePath is this), the guard's tests-phase and
// scope levels, the reuse check's neighbours and the status line's tests gate. Julia (test/runtests.jl), Nim (tests/),
// OCaml (dune's test/), Rust (tests/) and R (tests/testthat/) keep their tests in these folders.
const TEST_DIRS = new Set(["test", "tests", "__tests__", "__test__", "spec", "e2e"]);
// Perl's test folders — for a .t file only (t/basic.t, xt/pod.t): a t/ folder of another language is no test folder.
const PERL_TEST_DIRS = new Set(["t", "xt"]);
// Only the conventions — every alternative anchored, the names are one path segment (linear):
//   foo.test.ts · foo.spec.js · foo.test.mts / .spec.cts (any language) · test.js / tests.py
//   test-x.js · test_x.py · test-x.R / test_x.R (testthat)
//   x_test.go · x_test.py · x_test.c / .cc / .cpp / .cxx (GoogleTest) · x_unittest.cc (Chromium) · x_test.sh (shunit2)
//   x_test.exs (ExUnit) · x_test.dart · core_test.clj / .cljs / .cljc (clojure.test)
//   x_spec.rb (RSpec) · x_spec.lua (busted) · x_SUITE.erl (Common Test) · x_tests.erl (EUnit)
//   FooTest(s).java / .kt / .cs / .swift / .php / .scala · FooIT.java · FooTests.fs / FooSpec.scala / FooSuite.groovy (F#,
//   ScalaTest, Spock) · FooTests.m / .mm (XCTest) / FooTests.vb · FooSpec.kt
// A module that merely ends in "spec" / "test" without the separator is code: dev-spec.js, lib/spec.js, latest.sh,
// contest.py, inspect.lua, attest.c. 1.21.1 review: a PREFIX alone names no shell / C / C++ test and "Spec" no Haskell one
// (scripts/test_data.sh, test-connection.sh, src/test_utils.c, lib/test_helper.c, lib/DevSpec.hs are production code) —
// those count under a test folder (shunit / Bats / Unity / hspec keep their tests in test/), their SUFFIXES anywhere.
const RE_TEST_NAME = /\.(?:test|spec)\.[a-z0-9]+$|^tests?\.(?:[cm]?[jt]s|py)$|^test[-_][^/]*\.(?:[cm]?[jt]s|py|[Rr])$|_test\.(?:go|py|c|cc|cpp|cxx|sh|bash|exs|dart|clj|cljs|cljc)$|_unittest\.(?:c|cc|cpp|cxx)$|_spec\.(?:rb|lua)$|_(?:SUITE|tests)\.erl$|(?:Tests?|IT)\.(?:java|kt|cs|swift|php|scala)$|(?:Tests?|Spec|Suite)\.(?:fs|fsx|scala|groovy)$|Tests?\.(?:m|mm|vb)$|Spec\.kt$/;
// The conventions whose case doesn't matter (Windows file systems): Pester's *.Tests.ps1 (Invoke-Pester's default filter,
// anywhere in the tree) and a Bats suite (*.bats).
const RE_TEST_NAME_EXTRA = /\.tests\.ps1$|\.bats$/i;
function isTestFile(rel) {
  const parts = String(rel).split("/");
  const name = parts.pop();
  if (RE_TEST_NAME.test(name) || RE_TEST_NAME_EXTRA.test(name)) return true;
  if (parts.some((p) => TEST_DIRS.has(p.toLowerCase()))) return true;
  return /\.t$/i.test(name) && parts.some((p) => PERL_TEST_DIRS.has(p.toLowerCase()));
}
// 1.21.1 review — code extensions that are mostly DATA under a test folder: SQL dumps / seeds and notebooks in
// tests/fixtures/. Such a file is a test only when its NAME says so (pgTAP's test_*.sql / *_test.sql, x.test.sql, nbval's
// test_*.ipynb); otherwise it is a fixture — neither code nor a test for the scan, coverage and the test-code scan (1,600
// .sql fixtures used to exhaust the test scan's read cap before the one real test file; a 'T-01' in seed.sql counted as the
// test). Guard mode still asks before editing one (it is code by extension).
const TEST_DATA_EXT = new Set([".sql", ".ipynb"]);
const RE_TEST_DATA_NAME = /^test[-_][^/]*\.(?:sql|ipynb)$|_test\.(?:sql|ipynb)$/i;
// Does the file NAME follow a test convention (not merely sit in a test folder)? The test-code scan reads these first.
function testNamed(rel) {
  const parts = String(rel).split("/");
  const name = parts.pop();
  return RE_TEST_NAME.test(name) || RE_TEST_NAME_EXTRA.test(name) || RE_TEST_DATA_NAME.test(name) ||
    (/\.t$/i.test(name) && parts.some((p) => PERL_TEST_DIRS.has(p.toLowerCase())));
}
const extOf = (rel) => { const r = String(rel); return path.posix.extname(r.slice(r.lastIndexOf("/") + 1)).toLowerCase(); };
// 1.22 review — and every file under a testdata/ folder (Go's convention: the toolchain ignores it — fixture sources, golden
// files): neither code nor a test, never read for routes (a fixture's http.HandleFunc was a phantom route).
const RE_TESTDATA_DIR = /(?:^|\/)testdata\//i;
function isTestFixture(rel) {
  return RE_TESTDATA_DIR.test(String(rel)) || (TEST_DATA_EXT.has(extOf(rel)) && isTestFile(rel) && !testNamed(rel));
}
// Is this project-relative (forward-slash) path code? Its extension is in CODE_EXT, or it is a test-only one
// (TEST_EXTRA_EXT) on a file that IS a test. The scan, coverage, the test-code scan and guard mode ask this (the first three
// then set test fixtures apart — isTestFixture).
function isCodeFile(rel) {
  const ext = extOf(rel);
  return CODE_EXT.has(ext) || (TEST_EXTRA_EXT.has(ext) && isTestFile(rel));
}

// --- routes (method + path + file:line), one matcher set per framework family --------------------------------
const JS_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".mts", ".cts"]);
const FRONTEND_EXT = new Set([".jsx", ".tsx"]); // `api.get('/users')` there is a client call, not a route
// Express / Koa router / Fastify / Hono: <owner>.<verb>('/path' — only owners that name a server or router
// (axios.get('/x') and map.get('k') are not routes), and the path must start with '/' (app.get('env') reads a setting).
const JS_ROUTE_OWNERS = new Set(["app", "router", "r", "route", "routes", "server", "fastify", "api", "hono", "koa", "instance"]);
const RE_JS_OWNER_SUFFIX = /(?:Router|Routes|App|Server|router|routes|app|server)$/;
const RE_JS_ROUTE = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"`])(\/[^'"`]*|\*)\3/g;
const RE_JS_ROUTE_CHAIN = /[\w$)\]]\s*\.\s*route\s*\(\s*(['"`])(\/[^'"`]*)\1\s*\)/; // router.route('/x').get(…).post(…)
// Prettier puts each argument on its own line when the call head doesn't fit: `router.post(` ends the line and the
// path opens the next one. Only that leading string literal is joined — the whole call would re-scan the handler
// body, counting a route declared inside it twice.
const RE_JS_ROUTE_OPEN = /(?<![\w$.])[A-Za-z_$][\w$]*\s*\.\s*(?:get|post|put|patch|delete|options|head|all)\s*\(\s*$/;
const RE_JS_LEAD_STRING = /^\s*(['"`])(?:\/[^'"`]*|\*)\1/;
const RE_JS_CHAIN_VERB = /\.\s*(get|post|put|patch|delete|options|head|all)\s*\(/g;
const RE_JS_IMPORT = /(?:require\s*\(\s*|from\s+)['"](express|koa|@koa\/router|koa-router|fastify|hono)(?:\/[^'"]*)?['"]/;
// HTTP clients: `const api = axios.create(…); api.get('/users')` in a .js/.ts service file is a CALL, not a route.
// A name assigned from a client factory is never a route owner; in a file that imports a client and no server
// framework, the owners that name a client as often as a router (JS_GENERIC_OWNERS) don't count either.
const RE_JS_CLIENT_IMPORT = /(?:require\s*\(\s*|from\s+)['"](axios|ky|ky-universal|got|node-fetch|cross-fetch|isomorphic-fetch|ofetch|redaxios|wretch|superagent|undici|@angular\/common\/http)(?:\/[^'"]*)?['"]/;
const RE_JS_CLIENT_DEF = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(?:axios|ky|got|ofetch|wretch|redaxios|superagent)\s*\.\s*(?:create|extend)\s*\(/g;
const JS_GENERIC_OWNERS = new Set(["api", "instance", "r", "route", "routes", "server"]);
// `\(\s*(?:X)?\s*\)` read as `\(\s*(?:X\s*)?\)` (same calls): two blank runs meeting around an absent argument backtracked
// quadratically (1.17 H).
const RE_NEST_ROUTE = /@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(\s*(?:(['"`])([^'"`]*)\2\s*)?\)/g;
const RE_NEST_CTRL = /@Controller\s*\(\s*(?:(?:(['"`])([^'"`]*)\1|\{[^}]*?path\s*:\s*(['"`])([^'"`]*)\3[^}]*\})\s*)?\)/;
const RE_NEXT_APP = /(?:^|\/)app\/((?:[^/]+\/)*)route\.[cm]?[jt]sx?$/; // Next.js app router: app/**/route.ts
const RE_NEXT_PAGES = /(?:^|\/)pages\/api\/(.+)\.[cm]?[jt]sx?$/;
const RE_NEXT_EXPORT = /^\s*export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
// Flask / FastAPI decorators (@app.route('/x', methods=[…]), @bp.get, @router.post) + APIRouter/Blueprint prefixes.
const RE_PY_ROUTE = /^\s*@\s*([A-Za-z_]\w*)\.(route|get|post|put|patch|delete|options|head|api_route|websocket)\s*\(\s*(?:(?:path|rule)\s*=\s*)?[rRuUbBfF]{0,2}(['"])([^'"]*)\3(.*)$/;
const RE_PY_METHODS = /methods\s*=\s*[[(]([^\])]*)[\])]/;
// Decorator owners that name an app/router (@mock.patch("mod.fn") is not a PATCH route) — plus any name the file
// assigns from FastAPI()/Flask()/APIRouter()/Blueprint().
const PY_ROUTE_OWNERS = new Set(["app", "api", "application", "router", "routes", "route", "bp", "blueprint", "web", "server", "admin", "v1", "v2"]);
const RE_PY_OWNER_SUFFIX = /(?:_app|_api|_router|_routes|_bp|_blueprint|App|Api|Router|Routes|Bp|Blueprint)$/;
const RE_PY_APP_DEF = /^\s*([A-Za-z_]\w*)\s*(?::\s*[\w.]+\s*)?=\s*(?:[\w.]+\.)?(?:FastAPI|Flask|APIRouter|Blueprint|Quart|Sanic|Starlette)\s*\(/;
const RE_PY_PREFIX_DEF = /^\s*([A-Za-z_]\w*)\s*(?::\s*[\w.]+\s*)?=\s*(?:[\w.]+\.)?(?:APIRouter|Blueprint)\s*\((.*)$/;
const RE_PY_PREFIX_ARG = /\b(?:prefix|url_prefix)\s*=\s*[rRuU]?(['"])([^'"]*)\1/;
const RE_PY_WEB_IMPORT = /^[^\S\n\r\u2028\u2029]*(?:from|import)\s+(fastapi|flask|django)\b/m; // the indent within its line (1.17 H)
const RE_DJANGO_ROUTE = /(?<![\w.])(?:path|re_path|url)\s*\(\s*[rRuU]?(['"])([^'"]*)\1/g;
const RE_SPRING = /@(Get|Post|Put|Patch|Delete|Request)Mapping\b(?:\s*\(([^)]*)\))?/g;
const RE_ASP_ATTR = /\[\s*(?:[\w.]+\s*,\s*)*Http(Get|Post|Put|Patch|Delete|Head|Options)\s*(?:\(\s*(?:template\s*:\s*)?"([^"]*)"[^)]*\))?/g;
const RE_ASP_ROUTE_ATTR = /\[\s*Route\s*\(\s*"([^"]*)"\s*\)/;
const RE_ASP_MAP = /\.Map(Get|Post|Put|Patch|Delete)?\s*\(\s*"([^"]*)"/g;
const RE_RUBY_VERB = /^\s*(get|post|put|patch|delete|match)\s*(?:\(\s*)?(['"])([^'"]+)\2/; // \s*\(?\s* → \s*(?:\(\s*)? (1.17 H)
const RE_RAILS_RES = /^\s*(resources|resource)\s*(?:\(\s*)?:(\w+)/;
const RE_LARAVEL = /Route::(get|post|put|patch|delete|options|any|match|resource|apiResource)\s*\(\s*(?:\[[^\]]*\]\s*,\s*)?(['"])([^'"]+)\2/g;
const RE_LARAVEL_CHAIN = /->\s*(get|post|put|patch|delete|options|any)\s*\(\s*(['"])([^'"]*)\2/g; // routes/*.php only
const RE_SYMFONY = /#\[\s*Route\s*\(\s*(?:path\s*:\s*)?(['"])([^'"]+)\1(.*)$/; // the rest of the line holds methods: [...]
const RE_GO_HANDLE = /(?<![\w.])(\w+)\.(?:HandleFunc|Handle)\s*\(\s*"([^"]+)"/g;
const RE_GO_UPPER = /(?<![\w.])(\w+)\.(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|Any)\s*\(\s*"(\/[^"]*)"/g; // gin / echo
const RE_GO_TITLE = /(?<![\w.])(\w+)\.(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*"(\/[^"]*)"/g; // chi / fiber
const GO_CLIENTS = new Set(["http", "client", "httpClient", "resty"]); // http.Get("/x") is a client call
const RE_SLASH_COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*(?:\s|\/|$))/;
const RE_HASH_COMMENT_LINE = /^\s*#(?!\[)/;
// Labels that don't name one framework: kept on the route, never listed under `frameworks`.
const AMBIGUOUS_FRAMEWORK = new Set(["node", "python", "gin/echo", "chi/fiber"]);

// A call split over several lines (a Black-wrapped `@router.get(\n    "/x",\n)`, a multi-line Spring annotation) joined
// into one, bounded to SCAN_JOIN_LINES continuation lines. Parens are counted naively: route paths hold none.
const SCAN_JOIN_LINES = 6;
function joinOpenCall(lines, i) {
  const depth = (s) => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
  let s = lines[i];
  let d = depth(s);
  for (let j = i + 1; d > 0 && j <= i + SCAN_JOIN_LINES && j < lines.length; j++) { s += " " + lines[j].trim(); d += depth(lines[j]); }
  return s;
}

function normRoutePath(p) {
  const s = String(p == null ? "" : p).trim();
  if (!s) return "/";
  return /^[/^*]/.test(s) ? s : "/" + s; // Django regexes (^…$) and wildcards stay as written
}
function joinRoute(prefix, sub) {
  const a = stripEnd(String(prefix || "").trim(), isSlashUnit); // /\/+$/
  const b = String(sub || "").trim().replace(/^\/+/, "");
  return normRoutePath(a ? (b ? a + "/" + b : a) : b);
}
function springPaths(args) {
  if (!args || !args.trim()) return [""];
  const named = args.match(/\b(?:value|path)\s*=\s*(\{[^}]*\}|\[[^\]]*\]|"[^"]*")/);
  const lead = args.match(/^\s*(\{[^}]*\}|\[[^\]]*\]|"[^"]*")/);
  const src = named ? named[1] : lead ? lead[1] : "";
  const lits = [...src.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return lits.length ? lits : [""];
}

// The action an ASP.NET route attribute on line i decorates: the first public / internal / protected method declared on that
// line (after its attributes) or the next few — its name, without the "Async" suffix ASP.NET Core drops by default. null: none.
function aspActionName(lines, i) {
  for (let j = i; j < lines.length && j <= i + 8; j++) {
    const l = lines[j];
    if (l.length > 4000) return null;
    const m = /(?:^|[\s\]])(?:public|internal|protected)\s/.exec(l);
    if (!m) {
      const t = l.trim(); // between the attribute and its method: blank lines, more attributes, comments
      if (j > i && t && !t.startsWith("[") && !t.startsWith("//")) return null;
      continue;
    }
    const decl = l.slice(m.index);
    let e = decl.indexOf("(");
    if (e === -1) return null;
    while (e > 0 && /\s/.test(decl[e - 1])) e--;
    if (decl[e - 1] === ">") { const lt = decl.lastIndexOf("<", e - 1); if (lt === -1) return null; e = lt; while (e > 0 && /\s/.test(decl[e - 1])) e--; }
    let b = e;
    while (b > 0 && /\w/.test(decl[b - 1])) b--;
    if (b === e) return null;
    const name = decl.slice(b, e);
    return name.replace(/Async$/, "") || name;
  }
  return null;
}

// The routes one (non-test) source file declares: [{ method, path, file, line, framework }].
function scanRoutes(rel, text) {
  const out = [];
  const ext = path.extname(rel).toLowerCase();
  const base = rel.split("/").pop();
  // A trailing " // …" comment is dropped too (a URL's "://" has no space before it).
  const lines = text.split(/\r?\n/).map((l) => (ext === ".py" || ext === ".rb" ? l : l.replace(/\s\/\/\s.*$/, "")));
  const add = (method, p, i, framework) => out.push({ method: String(method).toUpperCase(), path: normRoutePath(p), file: rel, line: i + 1, framework });
  const each = (re, line, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(line)) !== null) fn(m); };
  // A comment line documents a route, it doesn't declare one ("# @app.get('/x')", "// app.get('/x')"); a PHP #[Route] attribute is
  // code. One huge line is bundled code: nothing to learn, and slow to scan.
  const hashComments = ext === ".py" || ext === ".rb" || ext === ".php";
  const skipLine = (l) => l.length > 4000 || RE_SLASH_COMMENT_LINE.test(l) || (hashComments && RE_HASH_COMMENT_LINE.test(l));

  if (JS_EXT.has(ext)) {
    const app = rel.match(RE_NEXT_APP);
    if (app) {
      const route = "/" + app[1].split("/").filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@")).join("/");
      lines.forEach((l, i) => { const m = l.match(RE_NEXT_EXPORT); if (m) add(m[1], route, i, "next.js"); });
    }
    const pages = rel.match(RE_NEXT_PAGES);
    if (pages) {
      const i = lines.findIndex((l) => /^\s*export\s+default\b/.test(l));
      if (i !== -1) add("ANY", "/api/" + pages[1].replace(/(?:^|\/)index$/, ""), i, "next.js");
    }
    const imp = text.match(RE_JS_IMPORT);
    const jsFw = imp ? ({ "@koa/router": "koa", "koa-router": "koa" }[imp[1]] || imp[1]) : "node";
    const nest = /@Controller\s*\(|@nestjs\//.test(text);
    const clientOwners = new Set([...text.matchAll(RE_JS_CLIENT_DEF)].map((m) => m[1]));
    const clientFile = !imp && !nest && RE_JS_CLIENT_IMPORT.test(text);
    let prefix = "";
    lines.forEach((l, i) => {
      if (skipLine(l)) return;
      if (nest) {
        const c = l.match(RE_NEST_CTRL);
        if (c) prefix = c[2] != null ? c[2] : c[4] != null ? c[4] : "";
        each(RE_NEST_ROUTE, l, (m) => add(m[1], joinRoute(prefix, m[3] || ""), i, "nestjs"));
      }
      let jl = l;
      if (RE_JS_ROUTE_OPEN.test(l)) {
        let j = i + 1;
        while (j < lines.length && j <= i + SCAN_JOIN_LINES && !lines[j].trim()) j++;
        const lead = j < lines.length ? lines[j].match(RE_JS_LEAD_STRING) : null;
        if (lead) jl = l + " " + lead[0].trim(); // reported on the call's line
      }
      each(RE_JS_ROUTE, jl, (m) => {
        if (!JS_ROUTE_OWNERS.has(m[1]) && !RE_JS_OWNER_SUFFIX.test(m[1])) return;
        if (m[1] === "api" && FRONTEND_EXT.has(ext)) return;
        if (clientOwners.has(m[1]) || (clientFile && JS_GENERIC_OWNERS.has(m[1]))) return; // an HTTP client's call
        add(m[2], m[4], i, m[1] === "fastify" ? "fastify" : jsFw);
      });
      const ch = l.match(RE_JS_ROUTE_CHAIN);
      if (ch) {
        const verbs = [...l.slice(ch.index + ch[0].length).matchAll(RE_JS_CHAIN_VERB)].map((v) => v[1]);
        for (let j = i + 1; j < Math.min(lines.length, i + 12) && /^\s*\./.test(lines[j]); j++) {
          const v = lines[j].match(/^\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(/);
          if (v) verbs.push(v[1]);
        }
        verbs.forEach((v) => add(v, ch[2], i, jsFw));
      }
    });
  } else if (ext === ".py") {
    const imp = text.match(RE_PY_WEB_IMPORT);
    const pyFw = imp && imp[1] !== "django" ? imp[1] : null;
    const prefixes = new Map();
    const owners = new Set(lines.map((l) => (l.match(RE_PY_APP_DEF) || [])[1]).filter(Boolean));
    lines.forEach((l, i) => {
      if (skipLine(l)) return;
      // `router = APIRouter(\n    prefix="/items",\n    tags=[…],\n)` (Black / FastAPI's own docs) holds its prefix below.
      const d = (RE_PY_PREFIX_DEF.test(l) ? joinOpenCall(lines, i) : l).match(RE_PY_PREFIX_DEF);
      if (d) { const pm = d[2].match(RE_PY_PREFIX_ARG); if (pm) prefixes.set(d[1], pm[2]); }
      // A wrapped decorator is matched on its joined call and reported on the decorator's line.
      const m = (/^\s*@\s*[A-Za-z_]\w*\.\w+\s*\(/.test(l) ? joinOpenCall(lines, i) : l).match(RE_PY_ROUTE);
      if (!m) return;
      const [, owner, verb, , p, rest] = m;
      if (!owners.has(owner) && !PY_ROUTE_OWNERS.has(owner) && !RE_PY_OWNER_SUFFIX.test(owner)) return;
      const fw = pyFw || (verb === "route" ? "flask" : "python");
      const full = joinRoute(prefixes.get(owner) || "", p);
      if (verb === "route" || verb === "api_route") {
        const mm = rest.match(RE_PY_METHODS);
        const methods = mm ? [...mm[1].matchAll(/['"](\w+)['"]/g)].map((x) => x[1]) : [];
        (methods.length ? methods : [verb === "route" ? "GET" : "ANY"]).forEach((x) => add(x, full, i, fw));
      } else add(verb === "websocket" ? "WS" : verb, full, i, fw);
    });
    if (base === "urls.py" || /from\s+django\.(?:urls|conf\.urls)\s+import/.test(text)) {
      lines.forEach((l, i) => { if (!skipLine(l)) each(RE_DJANGO_ROUTE, l, (m) => add("ANY", m[2], i, "django")); });
    }
  } else if (ext === ".java" || ext === ".kt") {
    const classLine = lines.findIndex((l) => /\b(?:class|interface)\s+[A-Z]\w*/.test(l));
    let prefix = "";
    lines.forEach((l, i) => {
      if (skipLine(l)) return;
      each(RE_SPRING, /Mapping\s*\(/.test(l) ? joinOpenCall(lines, i) : l, (m) => {
        const paths = springPaths(m[2]);
        if (classLine !== -1 && i < classLine) { prefix = paths[0]; return; } // class-level mapping = prefix
        const methods = m[1] === "Request" ? [...(m[2] || "").matchAll(/RequestMethod\.(\w+)/g)].map((x) => x[1]) : [m[1]];
        (methods.length ? methods : ["ANY"]).forEach((mt) => paths.forEach((p) => add(mt, joinRoute(prefix, p), i, "spring")));
      });
    });
  } else if (ext === ".cs") {
    const classLine = lines.findIndex((l) => /\bclass\s+\w+/.test(l));
    // ASP.NET's route tokens (1.22 review — "/api/[controller]/{id}" was listed as written): [controller] is the class name
    // without its "Controller" suffix, [action] the method the attribute decorates (aspActionName); one it can't name stays.
    const cls = classLine === -1 ? null : lines[classLine].match(/\bclass\s+(\w+)/)[1];
    const ctrl = cls ? cls.replace(/Controller$/, "") || cls : null;
    const tokens = (p, i) => {
      let s = p;
      if (ctrl && /\[controller\]/i.test(s)) s = s.replace(/\[controller\]/gi, () => ctrl);
      if (/\[action\]/i.test(s)) { const a = aspActionName(lines, i); if (a) s = s.replace(/\[action\]/gi, () => a); }
      return s;
    };
    let prefix = "";
    lines.forEach((l, i) => {
      if (skipLine(l)) return;
      const r = l.match(RE_ASP_ROUTE_ATTR);
      if (r && (classLine === -1 || i < classLine)) prefix = r[1]; // [Route("api/[controller]")] on the controller
      // the class-level [Route] prefixes every method-level [HttpGet("x")] below it
      each(RE_ASP_ATTR, l, (m) => add(m[1], tokens(joinRoute(prefix, m[2] || ""), i), i, "aspnet"));
      each(RE_ASP_MAP, l, (m) => add(m[1] || "ANY", m[2], i, "aspnet")); // minimal APIs: app.MapGet("/x", …)
    });
  } else if (ext === ".rb") {
    const rails = /(?:^|\/)routes\.rb$|(?:^|\/)config\/routes\//.test(rel);
    const sinatra = /require\s+['"]sinatra/.test(text);
    if (rails || sinatra) {
      lines.forEach((l, i) => {
        if (skipLine(l)) return;
        const v = l.match(RE_RUBY_VERB);
        if (v) add(v[1] === "match" ? "ANY" : v[1], v[3], i, rails ? "rails" : "sinatra");
        const res = rails && l.match(RE_RAILS_RES);
        if (res) add(res[1] === "resources" ? "RESOURCES" : "RESOURCE", res[2], i, "rails");
      });
    }
  } else if (ext === ".php") {
    const routeFile = /(?:^|\/)routes\//.test(rel);
    lines.forEach((l, i) => {
      if (skipLine(l)) return;
      each(RE_LARAVEL, l, (m) => add(/resource/i.test(m[1]) ? "RESOURCE" : m[1] === "any" || m[1] === "match" ? "ANY" : m[1], m[3], i, "laravel"));
      if (routeFile) each(RE_LARAVEL_CHAIN, l, (m) => add(m[1] === "any" ? "ANY" : m[1], m[3], i, "laravel"));
      const sy = l.match(RE_SYMFONY);
      if (sy) {
        const mm = sy[3].match(/methods\s*:\s*\[([^\]]*)\]/);
        const methods = mm ? [...mm[1].matchAll(/['"](\w+)['"]/g)].map((x) => x[1]) : [];
        (methods.length ? methods : ["ANY"]).forEach((x) => add(x, sy[2], i, "symfony"));
      }
    });
  } else if (ext === ".go") {
    const fwUpper = /labstack\/echo/.test(text) ? "echo" : /gin-gonic\/gin/.test(text) ? "gin" : "gin/echo";
    const fwTitle = /gofiber\/fiber/.test(text) ? "fiber" : /go-chi\/chi/.test(text) ? "chi" : "chi/fiber";
    const fwHandle = /gorilla\/mux/.test(text) ? "gorilla/mux" : "net/http";
    lines.forEach((l, i) => {
      if (skipLine(l)) return;
      each(RE_GO_HANDLE, l, (m) => {
        const pm = m[2].match(/^([A-Z]+)\s+(\S+)$/); // Go 1.22 patterns: HandleFunc("GET /x", …)
        add(pm ? pm[1] : (l.match(/\.Methods\(\s*"(\w+)"/) || [])[1] || "ANY", pm ? pm[2] : m[2], i, fwHandle);
      });
      each(RE_GO_UPPER, l, (m) => add(m[2] === "Any" ? "ANY" : m[2], m[3], i, fwUpper));
      each(RE_GO_TITLE, l, (m) => { if (!GO_CLIENTS.has(m[1])) add(m[2], m[3], i, fwTitle); });
    });
  }
  return out;
}

// Environment variable NAMES the code reads — never a value. `.env` itself is never opened; only example files.
const RE_ENV_READS = [
  /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
  /process\.env\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g,
  /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
  /(?:Deno|Bun)\.env\.get\(\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]/g,
  /\bos\.environ\[\s*['"]([A-Za-z_]\w*)['"]\s*\]/g,
  /\b(?:os\.)?environ\.get\(\s*['"]([A-Za-z_]\w*)['"]/g,
  /\bgetenv\(\s*['"]([A-Za-z_]\w*)['"]/g, // Python os.getenv, PHP / C getenv
  /\bENV\[\s*['"]([A-Za-z_]\w*)['"]\s*\]/g,
  /\bENV\.fetch\(\s*['"]([A-Za-z_]\w*)['"]/g,
  /\bSystem\.getenv\(\s*"([A-Za-z_]\w*)"\s*\)/g,
  /\bos\.(?:Getenv|LookupEnv)\(\s*"([A-Za-z_]\w*)"\s*\)/g,
  /\bEnvironment\.GetEnvironmentVariable\(\s*"([A-Za-z_]\w*)"/g,
  /\$_ENV\[\s*['"]([A-Za-z_]\w*)['"]\s*\]/g,
  /(?<![\w>$:])env\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g, // Laravel env('APP_KEY') — upper-case names only
  /\benv::var(?:_os)?\(\s*"([A-Za-z_]\w*)"/g, // Rust
  /\$\{?env:([A-Za-z_][A-Za-z0-9_]*)/gi, // PowerShell $env:NAME / ${env:NAME} (any case)
  /\[(?:System\.)?Environment\]::GetEnvironmentVariable\(\s*['"]([A-Za-z_]\w*)['"]/gi, // PowerShell [Environment]::…('NAME')
];
const ENV_EXAMPLE_FILES = new Set([".env.example", ".env.sample", ".env.template", ".env.dist", ".env.defaults", "env.example", "example.env", "sample.env"]);
function envNamesIn(text, into) {
  for (const re of RE_ENV_READS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) into.add(m[1]);
  }
}

// Migrations and schema files: anything under a migrations/migrate/alembic folder, *.sql, *.prisma, db/schema.rb.
const MIGRATION_DIRS = new Set(["migrations", "migrate", "migration", "alembic"]);
function isMigrationFile(dirsLc, name, ext) {
  if (ext === ".sql" || ext === ".prisma") return true;
  if (name === "schema.rb" && dirsLc[dirsLc.length - 1] === "db") return true;
  if (!dirsLc.some((d) => MIGRATION_DIRS.has(d))) return false;
  return !/^(?:__init__\.py|readme(?:\.\w+)?|\.gitkeep|\.keep)$/i.test(name) && ![".md", ".txt", ".pyc", ".mako"].includes(ext);
}

// Entrypoints recognised by name and place.
const PY_ENTRY = new Set(["main.py", "app.py", "manage.py", "wsgi.py", "asgi.py", "__main__.py", "run.py", "server.py"]);
const NODE_ROOT_ENTRY = new Set(["index.js", "server.js", "app.js", "main.js", "index.mjs", "server.mjs", "index.ts", "server.ts", "app.ts", "main.ts"]);
function entryKind(rel, name, depth) {
  if (PY_ENTRY.has(name) && depth <= 2) return "python";
  // a top-level PowerShell script (build.ps1, deploy.ps1 — Pester's *.Tests.ps1 is a test); a module's RootModule comes
  // from its .psd1 manifest (scanCodebase)
  if (depth === 0 && /\.ps1$/i.test(name) && !isTestFile(rel)) return "powershell script";
  if (name === "main.go" && (depth === 0 || /(?:^|\/)cmd\/[^/]+\/main\.go$/.test(rel))) return "go main";
  if (name === "Program.cs") return ".NET Program.cs";
  if (/(?:^|\/)src\/main\.rs$/.test(rel) || /(?:^|\/)src\/bin\/[^/]+\.rs$/.test(rel)) return "rust main";
  if (name === "config.ru" && depth === 0) return "rack";
  if (name === "artisan" && depth === 0) return "laravel artisan";
  if (/^(?:[^/]+\/)?public\/index\.php$/.test(rel)) return "php front controller";
  if (NODE_ROOT_ENTRY.has(name) && depth === 0) return "node";
  return null;
}
const normEntry = (p) => String(p).trim().replace(/\\/g, "/").replace(/^\.\//, "");

const NODE_FRAMEWORKS = { express: "express", koa: "koa", "@koa/router": "koa", "koa-router": "koa", fastify: "fastify", hono: "hono", "@nestjs/core": "nestjs", next: "next.js", "@hapi/hapi": "hapi", restify: "restify" };
const NODE_TEST_RUNNERS = { jest: "jest", vitest: "vitest", mocha: "mocha", ava: "ava", jasmine: "jasmine", tap: "tap", "@playwright/test": "playwright", cypress: "cypress", uvu: "uvu" };
// The manifests the scan reads at the root (by name; *.csproj, *.psd1, *.cabal, *.nimble by extension) — the files its cap
// counts besides code (scanCounts, 1.22 review: a cap spent on 6,000 PNGs read no code at all).
const MANIFEST_NAMES = new Set(["package.json", "requirements.txt", "requirements-dev.txt", "pyproject.toml", "setup.py", "setup.cfg",
  "Pipfile", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "Gemfile", "composer.json", "Cargo.toml", "CMakeLists.txt",
  "meson.build", "Makefile", "makefile", "GNUmakefile", "configure.ac", "DESCRIPTION", "mix.exs", "rebar.config", "pubspec.yaml",
  "build.sbt", "Package.swift", "stack.yaml", "cabal.project", "deps.edn", "project.clj", "shadow-cljs.edn", "Project.toml",
  "build.zig", "dune-project", "cpanfile", "Makefile.PL", "Build.PL", "pytest.ini", "phpunit.xml", "phpunit.xml.dist"]);
const isManifestName = (name) => MANIFEST_NAMES.has(name) || /\.(?:csproj|psd1|cabal|nimble)$/i.test(name);
const scanCounts = (rel, name) => (isCodeFile(rel) && !isTestFixture(rel)) || isManifestName(name);
// 1.22 review — monorepos: the manifests read BELOW the root too (apps/web/package.json, apps/api/pyproject.toml,
// services/billing/go.mod) — a package's own manifest, never a per-folder build file (CMakeLists.txt, Makefile) — at most
// NESTED_MANIFEST_CAP of them read (every name found still counts for the stack); never one in a fixtures / testdata folder,
// nor (review 2) in a docs / examples / samples folder: a Node app's docs/requirements.txt (Sphinx), docs/Gemfile (Jekyll) and
// examples/flask-client/requirements.txt made its stack "python (flask)" and "ruby".
const NESTED_MANIFESTS = new Set(["package.json", "requirements.txt", "requirements-dev.txt", "pyproject.toml", "setup.py", "setup.cfg",
  "Pipfile", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "Gemfile", "composer.json", "Cargo.toml", "mix.exs",
  "rebar.config", "pubspec.yaml", "build.sbt", "Package.swift", "stack.yaml", "deps.edn", "project.clj", "Project.toml",
  "build.zig", "dune-project", "cpanfile"]);
const NESTED_MANIFEST_CAP = 20;
const MANIFEST_FIXTURE_DIRS = new Set(["fixtures", "__fixtures__", "testdata", "docs", "doc", "examples", "example", "samples", "sample"]);

function scanCodebase(projectDir, opts = {}) {
  const root = path.resolve(projectDir);
  // Both surfaces refuse a cap that is not an integer ≥ 1 before calling; here it can only fall back to the default
  // (a negative cap used to scan zero files and report "truncated").
  const cap = Number.isSafeInteger(opts.cap) && opts.cap >= 1 ? opts.cap : 5000;
  const lang = projectLang(projectDir);
  const B = i18n.msg(lang).brownfield;
  // 1.22 review — a path that is no folder (a typo, a file) is an error, never an empty codebase ("0 files, stack: unknown").
  if (!isDirSafe(root)) return { ok: false, root, error: B.notFolder(root) };
  const byExt = {};
  const topDirs = [];
  const routes = [];
  let routeTotal = 0;
  const routeFiles = new Set();
  const env = new Set();
  const envFiles = [];
  const migrations = [];
  const entrypoints = [];
  const testFws = new Set();
  const frameworks = new Set();
  const csproj = [];
  const psd1 = []; // PowerShell data files (≤ 20 read): a module manifest names its RootModule and RequiredModules
  const langs = { code: 0, shell: 0, sql: 0, c: 0, powershell: 0 }; // non-test code files, per family (the stack's "mostly" rules)
  let testFiles = 0;
  let read = 0;
  let readCapped = false;
  let pytestConfig = false;
  let phpunitConfig = false;
  const addEntry = (file, kind) => { if (!entrypoints.some((e) => e.file === file && e.kind === kind)) entrypoints.push({ file, kind }); };

  // top-level dirs (candidate modules — never a folder the root .gitignore names) and files (manifests named by extension:
  // *.cabal, *.nimble)
  let realRoot = root;
  try { realRoot = fs.realpathSync.native(root); } catch { /* the text path stands */ }
  const gitignore = gitignoreRules(root, realRoot); // 1.22 review: obj/, deps/, _build/, Pods/… are not the project's code
  const rootFiles = [];
  try {
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      if (e.isDirectory() && !SCAN_IGNORE.has(e.name) && !e.name.startsWith(".") && !(gitignore.dir && gitignore.dir(e.name))) topDirs.push(e.name);
      else if (e.isFile() && rootFiles.length < 500) rootFiles.push(e.name);
    }
  } catch {}
  // 1.22 review — monorepos: the manifests BELOW the root (apps/web/package.json, services/billing/go.mod) join the stack and
  // the test frameworks — every name found counts for the stack, the first NESTED_MANIFEST_CAP are read (frameworks, runners).
  const nestedSeen = new Set();
  const nested = []; // [{ name, full }]

  // bounded recursive walk — its cap counts code files and manifests (scanCounts), never images, docs or data (1.22 review)
  const walk = walkProject(root, cap, (rel, full, name) => {
    const ext = path.extname(name).toLowerCase();
    byExt[ext] = (byExt[ext] || 0) + 1;
    const parts = rel.split("/");
    const dirsLc = parts.slice(0, -1).map((p) => p.toLowerCase());
    if (isMigrationFile(dirsLc, name, ext)) migrations.push(rel);
    if (ENV_EXAMPLE_FILES.has(name)) {
      envFiles.push(rel);
      try {
        for (const l of (readFileHead(full, 50000) || "").split(/\r?\n/)) {
          const m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
          if (m) env.add(m[1]);
        }
      } catch {}
    }
    const fixture = isTestFixture(rel); // tests/fixtures/seed.sql, pkg/testdata/** — data: no code, test, route or entrypoint
    const kind = fixture ? null : entryKind(rel, name, parts.length - 1);
    if (kind) addEntry(rel, kind);
    if (name === "conftest.py" || name === "pytest.ini") pytestConfig = true;
    if (/^phpunit\.xml(?:\.dist)?$/.test(name)) phpunitConfig = true;
    if (ext === ".csproj" && csproj.length < 20) csproj.push(full);
    if (ext === ".psd1" && psd1.length < 20) psd1.push({ rel, full });
    if (parts.length > 1 && NESTED_MANIFESTS.has(name) && !dirsLc.some((d) => MANIFEST_FIXTURE_DIRS.has(d))) {
      nestedSeen.add(name);
      if (nested.length < NESTED_MANIFEST_CAP) nested.push({ name, full });
    }
    if (!isCodeFile(rel) || fixture) return; // a test fixture (tests/fixtures/seed.sql) is data, no test
    const test = isTestFile(rel);
    if (test) {
      testFiles++;
      // the runner a test file's NAME gives away
      if (/_test\.go$/.test(name)) testFws.add("go test");
      if (/_spec\.rb$/.test(name)) testFws.add("rspec");
      if (/\.tests\.ps1$/i.test(name)) testFws.add("pester");
      if (ext === ".bats") testFws.add("bats");
      if (/_spec\.lua$/.test(name)) testFws.add("busted");
      if (ext === ".r" && dirsLc.includes("testthat")) testFws.add("testthat");
      if (/Spec\.hs$/.test(name)) testFws.add("hspec");
      if (/_test\.exs$/.test(name)) testFws.add("exunit");
    } else {
      langs.code++;
      if (ext === ".sh" || ext === ".bash" || ext === ".zsh" || ext === ".ksh" || ext === ".fish" || ext === ".csh" || ext === ".tcsh") langs.shell++;
      else if (ext === ".sql") langs.sql++;
      else if (ext === ".ps1" || ext === ".psm1") langs.powershell++;
      else if (ext === ".c" || ext === ".h" || ext === ".cc" || ext === ".cpp" || ext === ".cxx" || ext === ".c++" || ext === ".hpp" || ext === ".hh" || ext === ".hxx") langs.c++;
    }
    if (!SCAN_TEXT_EXT.has(ext)) return; // counted, never read: the scan has no reader for its language
    if (read >= SCAN_READ_CAP) { readCapped = true; return; }
    read++;
    const txt = readFileHead(full, SCAN_READ_BYTES);
    if (txt == null) return;
    envNamesIn(txt, env);
    if (ext === ".rs" && /#\[(?:test|cfg\(test\))\]/.test(txt)) testFws.add("cargo test");
    if ((ext === ".ps1" || ext === ".psm1") && /\bInvoke-Pester\b/i.test(txt)) testFws.add("pester"); // build.ps1 runs the suite
    if (test) {
      // The runner a test file imports (the manifests above only cover declared dependencies).
      [[/['"]node:test['"]/, "node:test"], [/from\s+['"]vitest['"]/, "vitest"], [/['"]@jest\/globals['"]/, "jest"], [/^[^\S\n\r\u2028\u2029]*(?:import|from)\s+pytest\b/m, "pytest"],
        [/^[^\S\n\r\u2028\u2029]*(?:import|from)\s+unittest\b/m, "unittest"], [/import\s+org\.junit\b/, "junit"], [/using\s+Xunit\b/, "xunit"], [/using\s+NUnit\b/, "nunit"]]
        .forEach(([re, fw]) => { if (re.test(txt)) testFws.add(fw); });
      return; // tests call routes (supertest's api.get('/x')), they don't declare them
    }
    if (ext === ".py") { const im = txt.match(RE_PY_WEB_IMPORT); if (im) frameworks.add(im[1]); } // FastAPI/Flask without a manifest
    if (/@SpringBootApplication\b/.test(txt)) addEntry(rel, "spring boot");
    else if (ext === ".java" && /\bstatic\s+void\s+main\s*\(/.test(txt)) addEntry(rel, "java main");
    else if (ext === ".kt" && /^[^\S\n\r\u2028\u2029]*fun\s+main\s*\(/m.test(txt)) addEntry(rel, "kotlin main"); // indents within their line (1.17 H)
    const found = scanRoutes(rel, txt);
    if (!found.length) return;
    routeFiles.add(rel);
    routeTotal += found.length;
    for (const r of found) {
      if (!AMBIGUOUS_FRAMEWORK.has(r.framework)) frameworks.add(r.framework);
      if (routes.length < SCAN_ROUTE_CAP) routes.push(r);
    }
  }, { counts: scanCounts, gitignore });
  for (const f of csproj) {
    const t = (readFileHead(f, SCAN_READ_BYTES) || "").toLowerCase();
    if (/microsoft\.net\.sdk\.web|microsoft\.aspnetcore/.test(t)) frameworks.add("aspnet");
    [["xunit", "xunit"], ["nunit", "nunit"], ["mstest", "mstest"]].forEach(([k, v]) => { if (t.includes(k)) testFws.add(v); });
  }
  if (pytestConfig) testFws.add("pytest");
  if (phpunitConfig) testFws.add("phpunit");
  // PowerShell module manifests (.psd1 — data, never code): the module's RootModule is an entrypoint, Pester in its
  // RequiredModules is the test runner. A .psd1 without ModuleVersion / RootModule is plain data (a localized strings file).
  let psManifest = false;
  for (const f of psd1) {
    const t = readFileHead(f.full, SCAN_READ_BYTES) || "";
    const root1 = t.match(/\b(?:RootModule|ModuleToProcess)\s*=\s*['"]([^'"\r\n]{1,260})['"]/i);
    if (!root1 && !/\bModuleVersion\s*=/i.test(t)) continue;
    psManifest = true;
    if (root1) {
      const dir = f.rel.includes("/") ? f.rel.slice(0, f.rel.lastIndexOf("/")) : "";
      const target = path.posix.normalize((dir ? dir + "/" : "") + normEntry(root1[1]));
      if (!target.startsWith("../")) addEntry(target, "powershell module");
    }
    const req = t.search(/\bRequiredModules\s*=/i);
    if (req !== -1 && /\bPester\b/i.test(t.slice(req, req + 600))) testFws.add("pester");
  }

  // Manifests: the root's (a file, or a link that stays in the project — hasRoot, 1.22 review) and the nested ones the walk met
  // (monorepos) → stack, frameworks, test runners; the ROOT package.json's entrypoints (listed first). Every reader reads at
  // most its cap from disk — readFileHead, never the whole file then a slice.
  const rootMemo = new Map();
  const hasRoot = (f) => { if (!rootMemo.has(f)) rootMemo.set(f, projectFileInside(realRoot, path.join(root, f))); return rootMemo.get(f); };
  const has = (f) => hasRoot(f) || nestedSeen.has(f);
  const head = (full) => readFileHead(full, SCAN_READ_BYTES) || "";
  const rootText = (f) => (hasRoot(f) ? head(path.join(root, f)) : "");
  const text = (f) => [rootText(f), ...nested.filter((n) => n.name === f).map((n) => head(n.full))].filter(Boolean).join("\n");
  const stackHints = [];
  const pkgEntries = [];
  const addPkgEntry = (file, kind) => { if (!pkgEntries.some((e) => e.file === file && e.kind === kind)) pkgEntries.push({ file, kind }); };
  if (has("package.json")) {
    const deps = new Set();
    let parsed = false;
    const pjs = [...(hasRoot("package.json") ? [{ text: rootText("package.json"), root: true }] : []),
      ...nested.filter((n) => n.name === "package.json").map((n) => ({ text: head(n.full), root: false }))];
    // /\bnode\s+(?:[^|&;]*\s)?--test\b/, one command at a time: that pattern rescanned the command from each "node" and
    // each of a long blank run's units (1.17 H).
    const nodeTest = (seg) => { const m = /\bnode\s/.exec(seg); return !!m && /\s--test\b/.test(seg.slice(m.index + 4)); };
    for (const p of pjs) {
      let pj;
      try { pj = JSON.parse(p.text.charCodeAt(0) === 0xfeff ? p.text.slice(1) : p.text); } catch { continue; }
      if (!isObj(pj)) continue;
      parsed = true;
      for (const d of Object.keys({ ...(isObj(pj.dependencies) ? pj.dependencies : {}), ...(isObj(pj.devDependencies) ? pj.devDependencies : {}) })) deps.add(d);
      const scripts = isObj(pj.scripts) ? pj.scripts : {};
      if (typeof scripts.test === "string" && scripts.test.split(/[|&;]/).some(nodeTest)) testFws.add("node:test");
      if (!p.root) continue;
      if (typeof pj.main === "string" && pj.main.trim()) addPkgEntry(normEntry(pj.main), "package.json main");
      if (typeof pj.bin === "string" && pj.bin.trim()) addPkgEntry(normEntry(pj.bin), "package.json bin");
      else if (isObj(pj.bin)) Object.values(pj.bin).filter((v) => typeof v === "string" && v.trim()).forEach((v) => addPkgEntry(normEntry(v), "package.json bin"));
      if (typeof scripts.start === "string" && scripts.start.trim()) {
        const m = scripts.start.match(/(?:^|\s)(?:node|nodemon|ts-node|tsx|bun(?:\s+run)?|deno\s+run)\s+(?:--?[\w-]+(?:=\S+)?\s+)*([^\s&|;]+\.[cm]?[jt]s)\b/);
        addPkgEntry(m ? normEntry(m[1]) : scripts.start.trim(), "npm start");
      }
    }
    const depList = [...deps];
    depList.forEach((d) => {
      if (Object.prototype.hasOwnProperty.call(NODE_FRAMEWORKS, d)) frameworks.add(NODE_FRAMEWORKS[d]);
      if (Object.prototype.hasOwnProperty.call(NODE_TEST_RUNNERS, d)) testFws.add(NODE_TEST_RUNNERS[d]);
    });
    stackHints.push(parsed ? "node (" + depList.slice(0, 12).join(", ") + (depList.length > 12 ? ", …" : "") + ")" : "node");
  }
  entrypoints.unshift(...pkgEntries);
  const pyManifest = ["requirements.txt", "requirements-dev.txt", "pyproject.toml", "setup.py", "setup.cfg", "Pipfile"].map(text).join("\n").toLowerCase();
  const hasPyManifest = has("requirements.txt") || has("pyproject.toml") || has("setup.py");
  for (const fw of ["fastapi", "flask", "django"]) if (new RegExp("\\b" + fw + "\\b").test(pyManifest)) frameworks.add(fw);
  if (/\bpytest\b/.test(pyManifest)) testFws.add("pytest");
  const goMod = text("go.mod");
  [["gin-gonic/gin", "gin"], ["labstack/echo", "echo"], ["go-chi/chi", "chi"], ["gofiber/fiber", "fiber"], ["gorilla/mux", "gorilla/mux"]].forEach(([k, v]) => { if (goMod.includes(k)) frameworks.add(v); });
  const jvm = ["pom.xml", "build.gradle", "build.gradle.kts"].map(text).join("\n").toLowerCase();
  if (/spring-boot/.test(jvm)) frameworks.add("spring");
  [["junit", "junit"], ["testng", "testng"], ["kotest", "kotest"]].forEach(([k, v]) => { if (jvm.includes(k)) testFws.add(v); });
  const gemfile = text("Gemfile");
  if (/['"]rails['"]/.test(gemfile)) frameworks.add("rails");
  if (/['"]sinatra['"]/.test(gemfile)) frameworks.add("sinatra");
  [["rspec", "rspec"], ["minitest", "minitest"]].forEach(([k, v]) => { if (gemfile.includes(k)) testFws.add(v); });
  const composer = text("composer.json");
  [["laravel/framework", "laravel"], ["symfony/framework-bundle", "symfony"]].forEach(([k, v]) => { if (composer.includes(k)) frameworks.add(v); });
  [["phpunit/phpunit", "phpunit"], ["pestphp/pest", "pest"]].forEach(([k, v]) => { if (composer.includes(k)) testFws.add(v); });
  const cargo = text("Cargo.toml");
  [["actix-web", "actix"], ["axum", "axum"], ["rocket", "rocket"]].forEach(([k, v]) => { if (new RegExp("^[^\\S\\n\\r\\u2028\\u2029]*" + k + "\\s*=", "m").test(cargo)) frameworks.add(v); }); // the indent within its line (1.17 H)
  // 1.21.1 — C / C++ (CMake's test drivers) and R (a package's DESCRIPTION: testthat in Suggests) — the root's only
  const cmake = rootText("CMakeLists.txt");
  if (/\b(?:GTest|gtest|googletest)\b/.test(cmake)) testFws.add("googletest");
  if (/\b(?:enable_testing|add_test)\s*\(/.test(cmake)) testFws.add("ctest");
  const rDescription = rootText("DESCRIPTION");
  const rPackage = /^Package:/m.test(rDescription);
  if (rPackage && /\btestthat\b/.test(rDescription)) testFws.add("testthat");

  // Stack from manifests; Python also from imports (FastAPI/Flask apps often ship without a manifest).
  const pyFw = ["fastapi", "flask", "django"].filter((f) => frameworks.has(f));
  if (hasPyManifest || pyFw.length) stackHints.push("python" + (pyFw.length ? " (" + pyFw.join(", ") + ")" : ""));
  if (has("go.mod")) stackHints.push("go");
  if (has("Cargo.toml")) stackHints.push("rust");
  if (has("composer.json")) stackHints.push("php");
  if (has("pom.xml") || has("build.gradle") || has("build.gradle.kts")) stackHints.push("java/jvm");
  if (has("Gemfile")) stackHints.push("ruby");
  if (csproj.length) stackHints.push(".net");
  // 1.21.1 — the other languages the scan now counts: one existence check (or the root listing) per manifest.
  const rootHas = (re) => rootFiles.some((n) => re.test(n));
  if (has("CMakeLists.txt")) stackHints.push("c/c++ (cmake)");
  else if (has("meson.build")) stackHints.push("c/c++ (meson)");
  else if (langs.c && (has("Makefile") || has("makefile") || has("GNUmakefile") || has("configure.ac"))) stackHints.push("c/c++ (make)");
  if (has("mix.exs")) stackHints.push("elixir");
  if (has("rebar.config")) stackHints.push("erlang");
  if (has("pubspec.yaml")) stackHints.push(/^[ \t]*flutter\s*:/m.test(text("pubspec.yaml")) ? "dart (flutter)" : "dart");
  if (has("build.sbt")) stackHints.push("scala");
  if (has("Package.swift")) stackHints.push("swift");
  if (has("stack.yaml") || has("cabal.project") || rootHas(/\.cabal$/)) stackHints.push("haskell");
  if (has("deps.edn") || has("project.clj") || has("shadow-cljs.edn")) stackHints.push("clojure");
  if (rPackage) stackHints.push("r");
  if (has("Project.toml")) stackHints.push("julia");
  if (has("build.zig")) stackHints.push("zig");
  if (has("dune-project")) stackHints.push("ocaml");
  if (rootHas(/\.nimble$/)) stackHints.push("nim");
  if (has("cpanfile") || has("Makefile.PL") || has("Build.PL")) stackHints.push("perl");
  // PowerShell: a module manifest, a Pester suite, or scripts that are at least half the code (1.21.1 review — a Node repo's
  // build.ps1 / install.ps1 alone is no PowerShell stack)
  if (psManifest || testFws.has("pester") || (langs.powershell && langs.powershell * 2 >= langs.code)) stackHints.push("powershell");
  // a tree that is mostly shell scripts or SQL (at least half of its code files, tests apart)
  if (langs.shell && langs.shell * 2 >= langs.code) stackHints.push("shell");
  if (langs.sql && langs.sql * 2 >= langs.code) stackHints.push("sql");

  const extList = Object.entries(byExt).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => (k || "(none)") + ":" + v);
  const envList = [...env].sort();
  const res = {
    ok: true,
    root,
    filesScanned: walk.files, // every file visited — the cap counts only code and manifests (codeFilesCounted)
    codeFilesCounted: walk.total,
    truncated: walk.truncated, // a code file or a manifest was left unscanned (the cap, or the entry cap of a huge tree)
    topLevelDirs: topDirs.sort(),
    byExtension: extList,
    stack: stackHints,
    frameworks: [...frameworks].sort(),
    candidateEndpoints: routeTotal, // ROUTES found (before 1.13: files that matched)
    endpointFiles: routeFiles.size,
    endpointSamples: [...routeFiles].slice(0, 25), // forward-slash paths of files that declare routes
    routes,
    routesTruncated: routeTotal > routes.length,
    testFrameworks: [...testFws].sort(),
    testFiles,
    entrypoints: entrypoints.slice(0, SCAN_LIST_CAP),
    envVars: envList.slice(0, SCAN_LIST_CAP * 2),
    envVarsTotal: envList.length,
    envFiles,
    migrations: migrations.slice(0, SCAN_LIST_CAP),
    migrationsTotal: migrations.length,
    migrationDirs: [...new Set(migrations.map((m) => (m.includes("/") ? m.slice(0, m.lastIndexOf("/")) : ".")))].slice(0, SCAN_LIST_CAP),
    codeFilesRead: read,
    readCapped,
    note: i18n.msg(lang).notes.scan,
  };
  if (res.routesTruncated) res.routesNote = B.routesTruncated(routes.length, routeTotal);
  if (readCapped) res.readNote = B.readCapped(SCAN_READ_CAP);
  return res;
}

// Spec coverage: the share of code files (isCodeFile — every language of CODE_EXT since 1.21.1 —, tests apart) named in any
// _Implements:_ marker of any feature — active or archived — with a per-top-level-folder breakdown. Compatible fields, meaning since 1.13:
// coveragePercent = covered code files / code files (was: top-level folders whose NAME matched a feature slug);
// modulesTotal = top-level folders holding code ("." = the root); documented / undocumented = those folders
// with at least one / no covered file (undocumented is also returned as uncoveredFolders); features = the
// active features (unchanged). unmatchedImplements = entries naming nothing on disk (a gap);
// nonCodeImplements = entries naming an existing test / non-code file (informational, never counted).
// opts.cap: the code files the walk counts (default COVERAGE_CAP) — engine-internal (tests), never a tool argument.
function coverage(projectDir, opts = {}) {
  const root = path.resolve(projectDir);
  const cap = Number.isSafeInteger(opts.cap) && opts.cap >= 1 ? opts.cap : COVERAGE_CAP;
  const lang = projectLang(projectDir);
  if (!isDirSafe(root)) return { ok: false, root, error: i18n.msg(lang).brownfield.notFolder(root) }; // 1.22 review (as scan)
  const specs = specsRoot(root);
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const active = listFeatures(projectDir).features.map((f) => f.name);
  const archiveDir = path.join(specs, "_archive");
  const archived = safeReaddir(archiveDir).filter((n) => { try { return fs.statSync(path.join(archiveDir, n)).isDirectory(); } catch { return false; } }).sort();
  const sources = active.map((n) => ({ feature: n, archived: false, dir: path.join(specs, n) }))
    .concat(archived.map((n) => ({ feature: n, archived: true, dir: path.join(archiveDir, n) })));

  const code = new Map(); // fold(rel) → rel
  const other = new Map(); // every other walked file (tests, docs, config) — an _Implements:_ naming one is not a gap
  let testFiles = 0;
  let realRoot = root;
  try { realRoot = fs.realpathSync.native(root); } catch { /* the text path stands */ }
  // The cap counts code files (tests included) only, and the root .gitignore's generated folders are left out — as the scan's
  // walk (1.22 review).
  const walk = walkProject(root, cap, (rel) => {
    if (!isCodeFile(rel) || isTestFixture(rel)) other.set(fold(rel), rel); // a test fixture (tests/fixtures/seed.sql) is data
    else if (isTestFile(rel)) { testFiles++; other.set(fold(rel), rel); }
    else code.set(fold(rel), rel);
  }, { counts: (rel) => isCodeFile(rel) && !isTestFixture(rel), gitignore: gitignoreRules(root, realRoot) });

  // 1.22 review — a reference that names no file is a folder: its files are found by a binary search of the keys, sorted once
  // here (two scans of every key per reference cost 1.2 s of 1.9 s on 18k code files × 2,160 references). The same files.
  const codeKeys = [...code.keys()].sort();
  let otherKeys = null;
  const otherSorted = () => otherKeys || (otherKeys = [...other.keys()].sort());
  const covered = new Set();
  const byFeature = [];
  const unmatched = [];
  const nonCode = [];
  const onDisk = (ref) => { // a file/folder the walk skips (dist/, a hidden dir) still exists
    const p = implementsPath(ref);
    if (!p || /[*?]/.test(p)) return false;
    const abs = path.resolve(root, p);
    return abs !== root && isInsideDir(root, abs) && fs.existsSync(abs);
  };
  for (const s of sources) {
    const refs = implementsRefs(readIfExists(path.join(s.dir, "tasks.md")));
    const mine = new Set();
    for (const ref of refs) {
      const hits = implementsTargets(root, ref, code, fold, codeKeys);
      // No code file: a test / doc / config target that exists is informational (a +tdd task names its test file);
      // only an entry that names nothing on disk is a gap — the same reading as trace_check.
      if (!hits.length) {
        const list = implementsTargets(root, ref, other, fold, otherSorted()).length || onDisk(ref) ? nonCode : unmatched;
        if (list.length < 50) list.push({ feature: s.feature, ref });
      }
      hits.forEach((k) => { mine.add(k); covered.add(k); });
    }
    if (refs.length) byFeature.push({ feature: s.feature, archived: s.archived, refs: refs.length, files: mine.size });
  }

  const folders = new Map();
  for (const [k, rel] of code) {
    const top = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : ".";
    const f = folders.get(top) || { folder: top, files: 0, covered: 0 };
    f.files++;
    if (covered.has(k)) f.covered++;
    folders.set(top, f);
  }
  const byFolder = [...folders.values()].sort((a, b) => (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0))
    .map((f) => ({ ...f, percent: Math.round((f.covered / f.files) * 100) }));
  const documented = byFolder.filter((f) => f.covered > 0).map((f) => f.folder);
  const undocumented = byFolder.filter((f) => f.covered === 0).map((f) => f.folder);
  return {
    ok: true,
    coveragePercent: code.size ? Math.round((covered.size / code.size) * 100) : 0,
    codeFiles: code.size,
    coveredFiles: covered.size,
    testFiles,
    modulesTotal: byFolder.length,
    documented,
    undocumented,
    uncoveredFolders: undocumented.slice(),
    byFolder,
    uncoveredSample: [...code].filter(([k]) => !covered.has(k)).map(([, rel]) => rel).sort().slice(0, 25),
    features: active,
    archivedFeatures: archived,
    byFeature,
    unmatchedImplements: unmatched,
    nonCodeImplements: nonCode,
    truncated: walk.truncated,
    note: i18n.msg(lang).notes.coverage,
  };
}

module.exports = { SCAN_IGNORE, CODE_EXT, TEST_EXTRA_EXT, GUARD_CODE_EXT, SCAN_TEXT_EXT, SCAN_READ_CAP, SCAN_READ_BYTES,
  SCAN_ROUTE_CAP, SCAN_LIST_CAP, COVERAGE_CAP, WALK_ENTRY_CAP, WALK_STOP, walkProject, GITIGNORE_MAX_CHARS,
  GITIGNORE_MAX_PATTERNS, GITIGNORE_MAX_NAME, GITIGNORE_MAX_NEGATIONS, GITIGNORE_NEGATION_BUDGET, gitignoreNegationTokens,
  gitignoreNegationReincludes, gitignoreName, gitignoreDirPatterns, gitignoreNameMatch, gitignoreRules, gitignoresAll,
  gitignoredFolder, projectFileInside, TEST_DIRS, PERL_TEST_DIRS, RE_TEST_NAME,
  RE_TEST_NAME_EXTRA, isTestFile, TEST_DATA_EXT, RE_TEST_DATA_NAME, testNamed, extOf, RE_TESTDATA_DIR, isTestFixture, isCodeFile, JS_EXT, FRONTEND_EXT, JS_ROUTE_OWNERS,
  RE_JS_OWNER_SUFFIX, RE_JS_ROUTE, RE_JS_ROUTE_CHAIN, RE_JS_ROUTE_OPEN, RE_JS_LEAD_STRING, RE_JS_CHAIN_VERB,
  RE_JS_IMPORT, RE_JS_CLIENT_IMPORT, RE_JS_CLIENT_DEF, JS_GENERIC_OWNERS, RE_NEST_ROUTE, RE_NEST_CTRL, RE_NEXT_APP,
  RE_NEXT_PAGES, RE_NEXT_EXPORT, RE_PY_ROUTE, RE_PY_METHODS, PY_ROUTE_OWNERS, RE_PY_OWNER_SUFFIX, RE_PY_APP_DEF,
  RE_PY_PREFIX_DEF, RE_PY_PREFIX_ARG, RE_PY_WEB_IMPORT, RE_DJANGO_ROUTE, RE_SPRING, RE_ASP_ATTR, RE_ASP_ROUTE_ATTR,
  RE_ASP_MAP, RE_RUBY_VERB, RE_RAILS_RES, RE_LARAVEL, RE_LARAVEL_CHAIN, RE_SYMFONY, RE_GO_HANDLE, RE_GO_UPPER,
  RE_GO_TITLE, GO_CLIENTS, RE_SLASH_COMMENT_LINE, RE_HASH_COMMENT_LINE, AMBIGUOUS_FRAMEWORK, SCAN_JOIN_LINES,
  joinOpenCall, normRoutePath, joinRoute, springPaths, scanRoutes, RE_ENV_READS, ENV_EXAMPLE_FILES, envNamesIn,
  MIGRATION_DIRS, isMigrationFile, PY_ENTRY, NODE_ROOT_ENTRY, entryKind, normEntry, NODE_FRAMEWORKS, NODE_TEST_RUNNERS,
  MANIFEST_NAMES, isManifestName, scanCounts, NESTED_MANIFESTS, NESTED_MANIFEST_CAP, MANIFEST_FIXTURE_DIRS, aspActionName,
  scanCodebase, coverage, __link };

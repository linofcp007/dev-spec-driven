"use strict";

/**
 * dev-spec-driven engine — traceability.
 * trace_check (AC → tasks → tests → _Implements:_), its gaps and the deep warnings (EC / NFR / SC, T-IDs in test code).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, artifactState, buildTraceMatrix, CODE_EXT, criterionBlocks, decisionsTrace, detectTracks, dirKey,
  existingFeature, FOLD_CASE, globFiles, GUARD_CODE_EXT, implementsPath, isImplementsGlob, isRecord, isSlashUnit,
  isTestFile, placeholderReport, planIdText, RE_LIST_ITEM, readIfExists, readJson, realLines, requirementAcIds,
  reservedSlug, safeReaddir, SAMPLE_ADVERSARIAL, SAMPLE_GOLDEN, SCAN_READ_BYTES, specsRoot, stateFromFile, statePath,
  stripEnd, stripEnds, supersedesTrace, tableCells, taskBlocks, taskMarkers, taskMarkerValues, taskProse,
  tasksProseText, toPosix, trackLabel, unitIn, useTemplateScopeOf, walkProject, withinRoot;
function __link(E) { ({ activeTasks, artifactState, buildTraceMatrix, CODE_EXT, criterionBlocks, decisionsTrace,
  detectTracks, dirKey, existingFeature, FOLD_CASE, globFiles, GUARD_CODE_EXT, implementsPath, isImplementsGlob,
  isRecord, isSlashUnit, isTestFile, placeholderReport, planIdText, RE_LIST_ITEM, readIfExists, readJson, realLines,
  requirementAcIds, reservedSlug, safeReaddir, SAMPLE_ADVERSARIAL, SAMPLE_GOLDEN, SCAN_READ_BYTES, specsRoot,
  stateFromFile, statePath, stripEnd, stripEnds, supersedesTrace, tableCells, taskBlocks, taskMarkers, taskMarkerValues,
  taskProse, tasksProseText, toPosix, trackLabel, unitIn, useTemplateScopeOf, walkProject, withinRoot } = E); }

// ---------------------------------------------------------------------------
// Traceability check
// ---------------------------------------------------------------------------

function extractAcIds(text) {
  // No trailing \b: AC IDs are often wrapped in markdown italics (`_US-1.AC-1_`) and `_`
  // counts as a word char, which would defeat \b. A leading non-alnum guard avoids
  // matching inside other tokens; greedy \d+ grabs the full number (AC-10, not AC-1).
  const ids = new Set();
  const re = /(?<![A-Za-z0-9])US-\d+\.AC-\d+/g;
  let m;
  while ((m = re.exec(text || "")) !== null) ids.add(m[0]);
  return ids;
}

function extractTestIds(text) {
  // Negative lookbehind avoids matching the "T-4" inside e.g. "GPT-4".
  const ids = new Set();
  const re = /(?<![A-Za-z0-9])T-\d+/g;
  let m;
  while ((m = re.exec(text || "")) !== null) ids.add(m[0]);
  return ids;
}

// opts.code: also scan the project's TEST files for T-IDs / AC IDs (result.code — see traceTestCode). opts.scan: a
// scanTestCode() result to reuse instead of walking again (doctor / finish share one walk per call). opts.globCap: files
// an _Implements:_ glob walk may look at (default COVERAGE_CAP) — engine-internal (tests), never a tool argument.
function traceCheck(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const dir = f.dir;
  // Strip HTML comments so example markers in template guidance don't count as real refs.
  const rawReqs = readIfExists(path.join(dir, "requirements.md")) || "";
  const rawTasks = readIfExists(path.join(dir, "tasks.md")) || "";
  const rawPlan = readIfExists(path.join(dir, "test-plan.md")) || "";
  // `_Supersedes: other/US-1.AC-2_` names ANOTHER feature's AC — never one of this feature's (see supersedesTrace). An ID
  // that only appears in a fenced code block (an example) is not a required AC either (requirementAcIds).
  const tasks = tasksProseText(rawTasks); // comments out, fenced examples blanked (the task scanner's view)
  const testPlan = planIdText(rawPlan); // comments out, fenced examples blanked — like the tasks
  const tracks = detectTracks(dir);

  const requiredAcs = requirementAcIds(rawReqs);
  const acsInTasks = extractAcIds(tasks);
  const acsInTestPlan = extractAcIds(testPlan);

  const uncoveredByTasks = [...requiredAcs].filter((id) => !acsInTasks.has(id));
  // Reverse direction: AC IDs referenced by tasks that don't exist in requirements (typos).
  const phantomAcsInTasks = [...acsInTasks].filter((id) => !requiredAcs.has(id));

  // Spec ↔ code: tasks may carry `_Implements: path/to/file_` markers. Verify the files exist.
  const implFiles = [];
  // The task-marker reader (taskMarkerSpans): `src/user_service.py` stays whole, and `_Implements: src/a.ts_;` /
  // `(see _Implements: src/old.ts_).` are markers too (1.14 full review Pa1 — they read as no file at all).
  for (const v of taskMarkerValues(tasks, "implements")) {
    v.split(/[,;]/).map((s) => s.trim().replace(/^`|`$/g, "")).filter(Boolean).forEach((p) => { if (!implFiles.includes(p)) implFiles.push(p); });
  }
  // Clamp to the project root: paths that escape it count as missing without probing arbitrary FS.
  const projRoot = path.resolve(projectDir);
  const outOfRoot = new Set();
  const unresolvedImplGlobs = [];
  const absent = implFiles.filter((f) => {
    // The file a reference names, as coverage / the drift baseline / the brief's steering read it (implementsPath):
    // a `path/to/file.js:12` or `#L12` anchor is dropped — resolving the raw spelling failed doctor and finish with
    // "files that don't exist" for a file coverage counted (on NTFS `app.js:1` even names an alternate data stream).
    // Reported with the spelling the task wrote. An anchor with no path names nothing: missing.
    const p = implementsPath(f);
    if (!p) return true;
    // A glob (`src/api/**`, `lib/*.js`) is present once it matches a file — coverage()'s glob, walked from its literal
    // folders only. One that would leave the project is out of root like any such path. A walk that hit its cap before
    // any match proves nothing (the file may sit past the cap): never a missing-file gap — a warning (unresolvedImplGlobs).
    if (isImplementsGlob(p)) {
      const g = globFiles(projRoot, p, { first: true, cap: opts.globCap });
      if (g.outside) outOfRoot.add(f);
      if (!g.files.length && g.truncated) { unresolvedImplGlobs.push(f); return false; }
      return !g.files.length;
    }
    const abs = path.resolve(projRoot, p);
    const inRoot = withinRoot(projRoot, abs); // a drive root (C:\) already ends in a separator
    if (!inRoot) outOfRoot.add(f);
    return !inRoot || !fs.existsSync(abs);
  });
  // A file that doesn't exist YET is a gap only once a task claiming it is done: an OPEN task's _Implements:_ is
  // the plan (next --batch needs those markers before a line is written) — reported as plannedImplFiles. A marker
  // no open task holds (a done task's, or one outside any task) stays a gap — and so does a path outside the
  // project root: no task can ever create it there, so it is never "planned".
  const unq = (p) => p.trim().replace(/^`|`$/g, "");
  const openOnly = new Set();
  const claimed = new Set();
  const blocks = taskBlocks(rawTasks);
  for (const b of blocks) {
    for (const p of taskMarkers(b).implements.map(unq)) {
      if (!b.done && !claimed.has(p)) openOnly.add(p);
      if (b.done) { claimed.add(p); openOnly.delete(p); }
    }
  }
  const planned = (p) => openOnly.has(p) && !outOfRoot.has(p);
  const plannedImplFiles = absent.filter(planned);
  const missingImplFiles = absent.filter((p) => !planned(p));

  const result = {
    ok: true,
    feature: f.slug,
    tracks: trackLabel(tracks),
    totalAcs: requiredAcs.size,
    coveredByTasks: requiredAcs.size - uncoveredByTasks.length,
    uncoveredByTasks,
    phantomAcsInTasks,
    implementsFiles: implFiles,
    missingImplFiles,
    plannedImplFiles,
    unresolvedImplGlobs, // globs whose bounded walk ended (COVERAGE_CAP) before a match: neither present nor missing
  };

  if (tracks.includes("tdd")) {
    const uncoveredByTests = [...requiredAcs].filter((id) => !acsInTestPlan.has(id));
    // Reverse: AC IDs the test plan covers that requirements.md doesn't define (a typo, a removed criterion, a template
    // row for a track the requirements never got) — a fenced example is no reference (planIdText), as for tasks.
    const phantomAcsInTests = [...extractAcIds(testPlan)].filter((id) => !requiredAcs.has(id));
    const planTestIds = extractTestIds(testPlan);
    const tasksTestIds = extractTestIds(tasks);
    const testsNotInTasks = [...planTestIds].filter((id) => !tasksTestIds.has(id));
    // Reverse: test IDs referenced by tasks that aren't in the test plan (typos).
    const phantomTestsInTasks = [...tasksTestIds].filter((id) => !planTestIds.has(id));
    result.coveredByTests = requiredAcs.size - uncoveredByTests.length;
    result.uncoveredByTests = uncoveredByTests;
    result.phantomAcsInTests = phantomAcsInTests;
    result.plannedTests = planTestIds.size;
    result.testsNotMappedToTasks = testsNotInTasks;
    result.phantomTestsInTasks = phantomTestsInTasks;
  }

  const gaps =
    uncoveredByTasks.length +
    phantomAcsInTasks.length +
    missingImplFiles.length +
    (result.uncoveredByTests ? result.uncoveredByTests.length : 0) +
    (result.phantomAcsInTests ? result.phantomAcsInTests.length : 0) +
    (result.phantomTestsInTasks ? result.phantomTestsInTasks.length : 0);
  result.verdict = gaps === 0 ? "pass" : "gaps-found";
  // Phantom AC IDs that a recorded change request REMOVED from requirements.md (spec_impact --reopen): still gaps, but
  // no typos — traceGapLines names the change request and says to delete or update what cites them. Informational.
  const removedAt = new Map();
  const changes = stateFromFile(projectDir, statePath(dir)).changes;
  (Array.isArray(changes) ? changes : []).forEach((c, i) => {
    if (isRecord(c) && c.phase === "requirements" && Array.isArray(c.removed)) for (const id of c.removed) if (typeof id === "string") removedAt.set(id, i + 1);
  });
  result.removedAcs = [...new Set([...phantomAcsInTasks, ...(result.phantomAcsInTests || [])])].filter((id) => removedAt.has(id))
    .map((id) => ({ id, changeRequest: removedAt.get(id) }));

  // Deep traceability — WARNINGS, never part of the verdict (above) nor of traceGaps(): the secondary IDs of
  // requirements.md and, with opts.code, the T-IDs of the project's test code.
  Object.assign(result, traceSecondary(dir, rawReqs, blocks, rawPlan, tracks));
  // 1.14 F5 — opts.matrix: + the requirements traceability matrix (buildTraceMatrix); with code both share ONE walk.
  const scan = opts.code && opts.matrix ? (typeof opts.scan === "function" ? opts.scan() : opts.scan) || scanTestCode(projectDir) : opts.scan;
  if (opts.code) result.code = traceTestCode(projectDir, dir, testPlan, requiredAcs, scan);
  result.warnings = traceWarnings(result);
  Object.assign(result, supersedesTrace(projectDir, dir, rawReqs)); // informational: never a gap, never the verdict
  Object.assign(result, decisionsTrace(dir, stateFromFile(projectDir, statePath(dir)).kind)); // 1.14 C2: phantom _Affects:_ (warnings)
  if (opts.matrix) { const { ok: _ok, ...mx } = buildTraceMatrix(projectDir, f, { code: opts.code, scan }); result.matrix = mx; } // informational (F5)
  return result;
}

// Every non-empty gap list of a trace_check result, in a stable order, so the CLI, the hook and doctor
// list them ALL — a hand-picked subset used to print "gaps-found" with nothing under it (phantom T-IDs,
// missing _Implements:_ files). Any array field a later version adds is a gap kind too, unless listed as
// informational here.
// planned = an OPEN task's file, not written yet; the deep-traceability warnings (TRACE_WARNING_ORDER) are warnings.
const TRACE_INFO_FIELDS = new Set(["implementsFiles", "plannedImplFiles", "unresolvedImplGlobs", "warnings", "uncoveredEdgeCases", "uncoveredNfr", "uncoveredSuccessCriteria", "phantomSecondary", "removedAcs"]);
const TRACE_GAP_ORDER = ["uncoveredByTasks", "phantomAcsInTasks", "uncoveredByTests", "phantomAcsInTests", "phantomTestsInTasks", "testsNotMappedToTasks", "missingImplFiles"];
// The kinds trace_check's verdict counts (testsNotMappedToTasks is listed, never failing), and the kinds that read
// tasks.md / test-plan.md — doctor defers the latter while that artifact is still a later phase's template.
const TRACE_VERDICT_KINDS = new Set(["uncoveredByTasks", "phantomAcsInTasks", "missingImplFiles", "uncoveredByTests", "phantomAcsInTests", "phantomTestsInTasks"]);
const TRACE_TASK_KINDS = ["uncoveredByTasks", "phantomAcsInTasks", "phantomTestsInTasks", "testsNotMappedToTasks", "missingImplFiles"];
const TRACE_PLAN_KINDS = ["uncoveredByTests", "phantomAcsInTests", "phantomTestsInTasks", "testsNotMappedToTasks"];
function traceGaps(tr) {
  const rank = (k) => (TRACE_GAP_ORDER.includes(k) ? TRACE_GAP_ORDER.indexOf(k) : TRACE_GAP_ORDER.length);
  return Object.keys(tr || {})
    .filter((k) => Array.isArray(tr[k]) && tr[k].length && !TRACE_INFO_FIELDS.has(k))
    .sort((a, b) => rank(a) - rank(b))
    .map((k) => ({ kind: k, items: tr[k].map((x) => (typeof x === "string" ? x : (x && x.id) || JSON.stringify(x))) }));
}
// The same gaps as localized "label: ID, ID" lines. A phantom AC that a change request removed (tr.removedAcs) gets its
// own line naming the request — "delete or update what cites it", never "(typos?)".
function traceGapLines(tr, lang) {
  const T = i18n.msg(lang).traceGapText;
  const removed = new Map((Array.isArray(tr && tr.removedAcs) ? tr.removedAcs : []).filter(isRecord).map((r) => [r.id, r.changeRequest]));
  const out = [];
  for (const g of traceGaps(tr)) {
    const rem = T.removedKinds[g.kind] && removed.size ? g.items.filter((id) => removed.has(id)) : [];
    const rest = g.items.filter((id) => !rem.includes(id));
    if (rest.length) out.push(T.gap(T.kinds[g.kind] || g.kind, rest.join(", ")));
    if (rem.length) out.push(T.gap(T.removedKinds[g.kind], rem.map((id) => T.removedRef(id, removed.get(id))).join(", ")));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deep traceability: secondary IDs (EC / NFR / SC) and T-IDs in test code — warnings only
// ---------------------------------------------------------------------------

// trace_check `warnings` — ONE shape, the one traceGaps() returns: [{ kind, items: [id, …] }], only the non-empty
// kinds, in this order. The secondary kinds are also top-level arrays (always present); the code kinds live in
// result.code (present with opts.code). None of them changes the verdict. unresolvedImplGlobs (a top-level array too):
// an _Implements:_ glob whose bounded walk stopped at its cap before any match.
const TRACE_WARNING_ORDER = ["uncoveredEdgeCases", "uncoveredNfr", "uncoveredSuccessCriteria", "phantomSecondary", "plannedNotInCode", "inCodeNotInPlan", "unresolvedImplGlobs"];
const TRACE_SECONDARY_KINDS = TRACE_WARNING_ORDER.slice(0, 4);
function traceWarnings(tr) {
  const src = { ...(tr && tr.code ? { plannedNotInCode: tr.code.plannedNotInCode, inCodeNotInPlan: tr.code.inCodeNotInPlan } : {}) };
  for (const k of [...TRACE_SECONDARY_KINDS, "unresolvedImplGlobs"]) if (tr && Array.isArray(tr[k])) src[k] = tr[k];
  return TRACE_WARNING_ORDER.filter((k) => Array.isArray(src[k]) && src[k].length).map((k) => ({ kind: k, items: src[k].slice() }));
}
// The warnings as localized "label: ID, ID" lines (kinds = a subset, e.g. the secondary ones for doctor).
function traceWarningLines(tr, lang, kinds) {
  const T = i18n.msg(lang).traceGapText;
  const K = i18n.msg(lang).deepTrace.kinds;
  const list = Array.isArray(tr && tr.warnings) ? tr.warnings : traceWarnings(tr);
  return list.filter((w) => !kinds || kinds.includes(w.kind)).map((w) => T.gap(K[w.kind] || w.kind, w.items.join(", ")));
}

// Secondary IDs — edge cases (EC-1), non-functional requirements (NFR-1), success criteria (SC-001) — compared by
// prefix + NUMBER (SC-1 names SC-001) and reported as written. The leading guard keeps DESC-1 / SPEC-2 out.
const RE_SECONDARY_ID = /(?<![A-Za-z0-9])(EC|NFR|SC)-(\d+)/g;
const RE_SECONDARY_ID_LINE = /(?<![A-Za-z0-9])(?:EC|NFR|SC)-\d+/;
const idKey = (prefix, num) => prefix + "-" + parseInt(num, 10);
function secondaryIds(text) { // → Map(key → first spelling)
  const out = new Map();
  for (const m of String(text || "").matchAll(RE_SECONDARY_ID)) {
    const k = idKey(m[1], m[2]);
    if (!out.has(k)) out.set(k, m[0]);
  }
  return out;
}
// requirements.md → { defined: Map(key → id) — IDs with a REAL definition, in document order; all: Set(key) — every ID
// written, template or not }. A unit that still holds a template placeholder ("- **SC-001** — [e.g., 90% of users …]")
// doesn't define its IDs yet: an untouched scaffold row is never "uncovered". Units are criterionBlocks' logical items
// (wrapped list items folded; comments and fenced code skipped) plus the table rows, headings and quotes it keeps apart.
function secondaryDefinitions(reqText) {
  const { cleaned, blocks } = criterionBlocks(reqText || "");
  const units = blocks.map((b) => ({ line: b.line, text: b.text }))
    .concat(cleaned.filter((c) => /^[|#>]/.test(c.text)))
    .sort((a, b) => a.line - b.line);
  const defined = new Map();
  const all = new Set();
  for (const u of units) {
    const ids = secondaryIds(u.text);
    if (!ids.size) continue;
    const real = !placeholderReport(u.text).length;
    for (const [k, id] of ids) {
      all.add(k);
      if (real && !defined.has(k)) defined.set(k, id);
    }
  }
  return { defined, all };
}
// EC / NFR are covered by a task (its text or any sub-line, _Requirements:_ included) or a test-plan row (a T-ID's row);
// SC by a test-plan row or a real (non-template) line of quickstart.md. phantomSecondary = IDs the tasks / test plan
// cite that requirements.md never writes. The test plan counts only while +tdd is active: after add_track --remove tdd
// it is an inactive artifact and must not silence (or raise) anything — the rest of traceCheck reads it only under tdd.
function traceSecondary(dir, reqText, blocks, planText, tracks) {
  const { defined, all } = secondaryDefinitions(reqText);
  const inTasks = secondaryIds(blocks.map((b) => taskProse(b).join("\n")).join("\n"));
  const inPlan = tracks.includes("tdd") ? secondaryIds(testPlanEntries(planText).map((e) => e.text).join("\n")) : new Map();
  const inQuickstart = secondaryIds(realLines(readIfExists(path.join(dir, "quickstart.md")) || "", RE_SECONDARY_ID_LINE).join("\n"));
  const out = { uncoveredEdgeCases: [], uncoveredNfr: [], uncoveredSuccessCriteria: [], phantomSecondary: [] };
  for (const [k, id] of defined) {
    const prefix = k.slice(0, k.indexOf("-"));
    if (prefix === "SC") { if (!inPlan.has(k) && !inQuickstart.has(k)) out.uncoveredSuccessCriteria.push(id); }
    else if (!inTasks.has(k) && !inPlan.has(k)) (prefix === "EC" ? out.uncoveredEdgeCases : out.uncoveredNfr).push(id);
  }
  const cited = new Map(inTasks);
  for (const [k, id] of inPlan) if (!cited.has(k)) cited.set(k, id);
  for (const [k, id] of cited) if (!all.has(k)) out.phantomSecondary.push(id);
  return out;
}
function testPlanEntries(planText) {
  const out = [];
  let header = null;
  let sep = false;
  let inTable = false;
  let item = null; // the list entry being continued: { indent, blank, entry }
  const tidLead = (line) => RE_LIST_ITEM.test(line) && line.replace(RE_LIST_ITEM, "").replace(/^[\s*`_]+/, "").match(/^T-\d+(?!\d)/);
  for (const line of planIdText(planText || "").split(/\r?\n/)) {
    if (item) {
      const indent = line.match(/^\s*/)[0].length;
      if (!line.trim()) { item.blank = true; continue; }
      const block = RE_LIST_ITEM.test(line) || /^\s*(?:#|\||>|[-*_]{3,}\s*$)/.test(line);
      if (!tidLead(line) && (indent > item.indent || (!item.blank && !block))) { item.entry.text += "\n" + line.trim(); continue; }
      item = null;
    }
    if (/^\s*\|/.test(line)) {
      if (!inTable) { inTable = true; header = tableCells(line); sep = false; continue; }
      if (!sep && /^\s*\|[\s:|-]+$/.test(line.trim())) { sep = true; continue; }
      const cells = tableCells(line);
      const ids = [...extractTestIds(cells[0] || "")];
      if (ids.length) out.push({ ids, text: line.trim(), cells, header });
      continue;
    }
    inTable = false;
    const m = tidLead(line);
    if (m) {
      const entry = { ids: [m[0]], text: line.trim(), cells: null, header: null };
      out.push(entry);
      item = { indent: line.match(/^\s*/)[0].length, blank: false, entry };
    }
  }
  return out;
}

// T-IDs as test code writes them: "T-01" anywhere (a test title, DisplayName, a comment), test_T01 / testT01 / TestT01
// (pytest, JUnit, Go) and a leading T01_ method name (C# / Java). Without the hyphen the T is UPPERCASE and the number
// zero-padded (two digits or more) as the templates write it: a bare "T1" collides with generic type parameters
// (Func<T1, T2>), and test_t2_is_after_t1 / test_t0_is_epoch are pytest names about time variables, not tests T-2 / T-0.
// Group 1/2/3 = the number as written.
const RE_CODE_TID = /(?<![A-Za-z0-9])T-(\d+)|(?<![A-Za-z0-9])[Tt]est_?T(\d{2,})(?![0-9])|(?<![A-Za-z0-9_])T(\d{2,})_(?=[A-Za-z])/g;
const CODE_TRACE_CAP = 5000; // files walked
const CODE_TRACE_READ_CAP = 1500; // test files read
const CODE_TRACE_FILES_PER_ID = 10; // files listed per ID (every one still counts)
// Test code in languages scan/coverage don't count as code (CODE_EXT), with their own test-name conventions: F# / Scala /
// Groovy (FsCheck, ScalaTest, Spock: CodecTests.fs, CodecSpec.scala), Elixir and Dart (codec_test.exs / codec_test.dart).
const TEST_EXTRA_EXT = new Set([".fs", ".fsx", ".scala", ".groovy", ".exs", ".dart"]);
const RE_TEST_NAME_EXTRA = /(?:Tests?|Spec|Suite)\.(?:fs|fsx|scala|groovy)$|_test\.(?:exs|dart)$/;
const isTestCodePath = (rel) => isTestFile(rel) || RE_TEST_NAME_EXTRA.test(rel.split("/").pop());
const tKey = (num) => "T-" + parseInt(num, 10);
// The feature folders under .specs/ (live, then archived — their tests may still be in the tree).
function specFeatureDirs(projectDir) {
  const root = specsRoot(projectDir);
  return safeReaddir(root).filter((n) => !n.startsWith(".") && n !== "_archive" && !reservedSlug(n, root)).map((n) => path.join(root, n))
    .concat(safeReaddir(path.join(root, "_archive")).map((n) => path.join(root, "_archive", n)));
}
// One bounded, read-only walk of the project (walkProject: SCAN_IGNORE, hidden dirs and .specs skipped) over its TEST
// files (isTestFile: test/spec/__tests__ folders, *.test.* / *.spec.*, test_*.py, *_test.go, *Test.java, *Tests.cs …),
// collecting the T-IDs and AC IDs they name — plus each feature's own .specs/<feature>/tests/ (the folder +tdd and bugfix
// scaffold for the failing tests), within the same caps; the rest of .specs/ stays skipped. Project-level (not per
// feature), so doctor / finish reuse it; traceTestCode decides which files count for a feature.
// → { tids: Map(key → { id, files }), acs: Map(acId → { id, files }), scanned, truncated }
function scanTestCode(projectDir) {
  const root = path.resolve(projectDir);
  const tids = new Map();
  const acs = new Map();
  let scanned = 0;
  let readCapped = false;
  const note = (map, key, id, rel) => {
    if (!map.has(key)) map.set(key, { id, files: [] });
    const e = map.get(key);
    if (!e.files.includes(rel)) e.files.push(rel);
  };
  const onFile = (rel, full, name) => {
    const ext = path.extname(name).toLowerCase();
    if (!(CODE_EXT.has(ext) || TEST_EXTRA_EXT.has(ext)) || !isTestCodePath(rel)) return;
    if (scanned >= CODE_TRACE_READ_CAP) { readCapped = true; return; }
    let txt;
    try { txt = fs.readFileSync(full, "utf8").slice(0, SCAN_READ_BYTES); } catch { return; }
    scanned++;
    for (const m of txt.matchAll(RE_CODE_TID)) {
      const num = m[1] || m[2] || m[3];
      note(tids, tKey(num), "T-" + num, rel);
    }
    for (const id of extractAcIds(txt)) note(acs, id, id, rel);
  };
  const walk = walkProject(root, CODE_TRACE_CAP, onFile);
  let left = CODE_TRACE_CAP - walk.total;
  let truncated = walk.truncated;
  for (const d of specFeatureDirs(projectDir)) {
    if (left <= 0) break;
    const tdir = path.join(d, "tests");
    try { if (!fs.lstatSync(tdir).isDirectory()) continue; } catch { continue; } // a symlinked tests/ is never followed
    const tPre = toPosix(path.relative(root, tdir));
    const w = walkProject(tdir, left, (rel, full, name) => onFile(tPre + "/" + rel, full, name));
    left -= w.total;
    truncated = truncated || w.truncated;
  }
  return { tids, acs, scanned, truncated: truncated || readCapped };
}
// Every T-ID any feature's test plan lists (archived features too — their tests may still be in the tree), by key.
function allPlannedTestKeys(projectDir) {
  const keys = new Set();
  for (const d of specFeatureDirs(projectDir)) {
    const plan = readIfExists(path.join(d, "test-plan.md"));
    if (plan != null) for (const id of extractTestIds(planIdText(plan))) keys.add(tKey(id.slice(2)));
  }
  return keys;
}
// A test-plan table's File column (EN / PT / ES header synonyms, optional "Test" prefix or "(…)" note).
const RE_FILE_COLUMN = /^(?:test\s+)?(?:files?|paths?|ficheiros?|arquivos?|caminhos?|archivos?|ficheros?|rutas?)(?:\s*\(.*\))?$/i;
// Is `rel` the path `p` or under the folder `p`? Forward-slash project-relative paths; case-folded where the FS is.
function pathUnder(rel, p) {
  const fold = (s) => (FOLD_CASE ? s.toLowerCase() : s);
  const r = fold(rel);
  const q = stripEnd(fold(p), isSlashUnit); // /\/+$/
  return q !== "" && (r === q || r.startsWith(q + "/"));
}
// Does the File cell path `p` name `rel`? People write the cell from the project root, from the feature folder, from a
// monorepo package (`tests/unit/login.test.ts` for packages/api/tests/unit/login.test.ts) or as a bare file name
// (`login.test.ts`), so `p` matches whole path segments at the END of `rel` (a file) or inside it (a folder) — never a
// partial segment: `tests/beta.test.js` doesn't name tests/alpha.test.js, nor `beta.test.js` alphabeta.test.js.
function pathNames(rel, p) {
  const fold = (s) => (FOLD_CASE ? s.toLowerCase() : s);
  const r = "/" + fold(rel);
  const q = stripEnd(fold(p), isSlashUnit); // /\/+$/
  return q !== "" && (r.endsWith("/" + q) || r.includes("/" + q + "/"));
}
// A File cell path the test-code scan can find a T-ID in: a folder (`tests/auth/`, no extension) or a file the scan reads.
// `tests/load/checkout-load.md` sits under a test dir but is never read, so scoping to it would warn forever.
function scannableTestPath(t) {
  if (t.endsWith("/")) return true;
  const ext = path.posix.extname(t).toLowerCase();
  return ext === "" || CODE_EXT.has(ext) || TEST_EXTRA_EXT.has(ext);
}
// A File cell token naming a non-code artifact — a document or data file, never source in any language (GUARD_CODE_EXT):
// `load-test.md`, `evals/golden.json`, `tests/load/plan.md`, a Gherkin `.feature` or a JMeter `.jmx`. The test-code scan
// reads none of them, so a row whose File column names only such files is checked outside test code (a load run, the eval
// harness, a manual pass) — expecting its T-ID in a test file warned forever (the scaffold's own load/eval rows did).
function nonCodeArtifactPath(t) {
  const ext = path.posix.extname(stripEnds(t, unitIn("(\"'["), unitIn(")\"'].,:;"))).toLowerCase(); // /^[("'[]+|[)"'\].,:;]+$/g
  return /^\.[a-z][a-z0-9]*$/.test(ext) && !GUARD_CODE_EXT.has(ext);
}
// Does a File cell token look like code — a source file in any language, or a folder? Then the row is not "outside code".
function codePathToken(t) {
  const ext = path.posix.extname(t).toLowerCase();
  return GUARD_CODE_EXT.has(ext) || (ext === "" && t.includes("/"));
}
// → { scopes, outside }. scopes: key(T-ID) → [test paths] its plan rows' File column names — only CONCRETE test paths (a
// test file or a folder under a test dir: `tests/unit/login.test.ts`, `tests/auth/`); a template slot (`[path]`,
// `tests/unit/...`), a non-test artifact or a missing column scopes nothing. `::test_x`, `#L3` and `:12` suffixes are
// cut. outside: the keys whose EVERY plan row names only non-code artifacts (nonCodeArtifactPath) in its File column —
// verified outside test code, never expected in a test file; a row with no File cell, a template slot or a code path
// keeps its T-ID expected in code.
// files: every concrete test FILE the plan's File column names (a test path with an extension — never a folder), any row:
// what the plan claims as its own (traceTestCode's cross-feature rule, 1.14 full review Pa5).
function planFileScopes(planText) {
  const scopes = new Map();
  const files = new Set();
  const outsideRows = new Set();
  const inCodeRows = new Set();
  for (const e of testPlanEntries(planText)) {
    const keys = e.ids.map((id) => tKey(id.slice(2)));
    const fc = fileCellTokens(e);
    if (!fc) { keys.forEach((k) => inCodeRows.add(k)); continue; }
    const { raw, tokens } = fc;
    const paths = tokens.filter((t) => isTestCodePath(t) && scannableTestPath(t));
    const outside = !paths.length && tokens.length === raw.length && tokens.some(nonCodeArtifactPath) && !tokens.some(codePathToken);
    for (const k of keys) (outside ? outsideRows : inCodeRows).add(k);
    if (!paths.length) continue;
    for (const p of paths) if (!p.endsWith("/") && path.posix.extname(p)) files.add(p);
    for (const k of keys) scopes.set(k, [...new Set([...(scopes.get(k) || []), ...paths])]);
  }
  return { scopes, files, outside: new Set([...outsideRows].filter((k) => !inCodeRows.has(k))) };
}
// The File column of one test-plan entry (testPlanEntries) as path tokens → { raw, tokens } or null (no File column / cell):
// raw = every token (code spans first; `::test_x`, `#L3` and `:12` suffixes cut, `./` and a leading `/` dropped), tokens =
// those that are no template slot (`[path]`, `tests/unit/...`, `<file>`, a glob).
function fileCellTokens(e) {
  const col = e.cells && e.header ? e.header.findIndex((h) => RE_FILE_COLUMN.test(h.replace(/[*_`]/g, "").trim())) : -1;
  if (col < 0 || col >= e.cells.length) return null;
  const cell = e.cells[col];
  const spans = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const raw = (spans.length ? spans.join(" ") : cell).split(/[\s,;]+/)
    .map((t) => t.replace(/\\/g, "/").replace(/::.*$/, "").replace(/#.*$/, "").replace(/:\d+(?::\d+)?$/, "").replace(/^(?:\.\/)+/, "").replace(/^\/+/, ""))
    .filter(Boolean);
  const tokens = raw.filter((t) => !/[[\]<>{}*?…]|\.\.\.|(?:^|\/)\.\.(?:\/|$)/.test(t)); // template slots out
  return { raw, tokens };
}
// 1.14 full review Pa6 — the tests this feature's plan checks OUTSIDE test code (planFileScopes' outside: every row's File
// column names only non-code artifacts — load-test.md, evals/golden.json) whose artifact is still the scaffold: a
// load-test.md holding template placeholders (artifactState), the scaffold's sample eval set. Judged once such a test is
// due — a DONE task makes it green (greenDone), or every active task is done; a scaffold nobody filled in used to let the
// feature finish "ready" with no load run at all. A token is looked up in the feature folder, then from the project root
// (inside it only); a missing file, or a kind this can't judge (.feature, .jmx …), is not reported. → [{ id, file }]
function outsideCodeTemplates(projectDir, dir, tracks, greenDone) {
  if (!tracks.includes("tdd")) return [];
  const planText = planIdText(readIfExists(path.join(dir, "test-plan.md")) || "");
  const { outside } = planFileScopes(planText);
  if (!outside.size) return [];
  const blocks = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || "");
  const allDone = blocks.length > 0 && blocks.every((b) => b.done);
  const due = new Set([...(greenDone || [])].map((id) => tKey(id.slice(2))));
  const root = path.resolve(projectDir);
  const samples = new Set([SAMPLE_GOLDEN, SAMPLE_ADVERSARIAL].map((x) => JSON.stringify(JSON.parse(x))));
  useTemplateScopeOf(dir); // the project's own templates are template text too
  const judged = new Map(); // file token → template?
  const isTemplate = (t) => {
    if (judged.has(t)) return judged.get(t);
    let res = false;
    const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
    const abs = [path.resolve(dir, t), path.resolve(root, t)].find((p) => withinRoot(root, p) && isFile(p));
    const ext = path.extname(t).toLowerCase();
    if (abs && (ext === ".md" || ext === ".markdown")) res = artifactState({ file: abs }) === "placeholder";
    else if (abs && ext === ".json") { const j = readJson(abs); res = !!j.data && samples.has(JSON.stringify(j.data)); }
    judged.set(t, res);
    return res;
  };
  const out = [];
  const seen = new Set();
  for (const e of testPlanEntries(planText)) {
    const ids = e.ids.filter((id) => { const k = tKey(id.slice(2)); return outside.has(k) && (allDone || due.has(k)); });
    const fc = ids.length ? fileCellTokens(e) : null;
    if (!fc) continue;
    for (const t of fc.tokens.filter(nonCodeArtifactPath)) {
      if (!isTemplate(t)) continue;
      for (const id of ids) { const key = id + " " + t; if (!seen.has(key)) { seen.add(key); out.push({ id, file: t }); } }
    }
  }
  return out;
}
// The concrete test files OTHER features' plans (active and archived) name in their File column (planFileScopes' files).
function otherPlanTestFiles(projectDir, ownDir) {
  const own = dirKey(ownDir);
  const out = new Set();
  for (const d of specFeatureDirs(projectDir)) {
    if (dirKey(d) === own) continue;
    const plan = readIfExists(path.join(d, "test-plan.md"));
    if (plan != null) for (const p of planFileScopes(planIdText(plan)).files) out.add(p);
  }
  return [...out];
}
// trace_check {code: true}: this feature's plan against the test code. T-IDs restart at T-01 in every plan, so a file
// counts for THIS feature unless it sits in ANOTHER feature's .specs/<f>/tests/ or another feature's plan names that file
// in its File column while this plan doesn't (1.14 full review Pa5); and a planned T-ID whose plan row's File
// column names a concrete test path counts only in that file / under that folder (pathNames: written from the project
// root, the feature folder, a package folder, or a bare file name) — otherwise another feature's test with the same
// number would pass it. Without a File path the match is by number across the project.
//   testsInCode       { T-ID: [test files …] } — every T-ID found in files that count, keyed by this plan's spelling
//   plannedNotInCode  this plan's T-IDs that no counting test file names (those checked outside test code left out)
//   plannedOutsideCode  this plan's T-IDs whose every row's File column names only non-code artifacts (load-test.md,
//                     evals/golden.json …): run outside test code — never expected in a test file (planFileScopes)
//   inCodeNotInPlan   T-IDs in test code that NO feature's test plan lists (another feature's T-01 is not this one's gap)
//   acsInTests        this feature's AC IDs that test code names (another feature's .specs tests excluded)
//   planned           how many T-IDs this plan lists
//   scanned / truncated  test files read · the walk or the read hit its cap
function traceTestCode(projectDir, dir, planText, requiredAcs, scan) {
  // scan: a scanTestCode() result, or a function returning one (spec_upgrade walks the project once, and only when a feature needs it)
  const s = (typeof scan === "function" ? scan() : scan) || scanTestCode(projectDir);
  const root = path.resolve(projectDir);
  const own = toPosix(path.relative(root, dir));
  const specsRel = toPosix(path.relative(root, specsRoot(projectDir)));
  const mine = (rel) => !pathUnder(rel, specsRel) || pathUnder(rel, own);
  const planned = new Map([...extractTestIds(planText)].map((id) => [tKey(id.slice(2)), id]));
  const { scopes, files: ownFiles, outside } = planFileScopes(planText);
  const inScope = (k, rel) => !scopes.has(k) || scopes.get(k).some((p) => pathNames(rel, p));
  // 1.14 full review Pa5 — T-IDs restart at T-01 in every plan, so a test FILE another feature's plan (active or
  // archived) names in its File column is that feature's: it never counts for this plan's T-IDs unless this plan names
  // that file too. A folder (`test/`) claims nothing — it scopes, it doesn't own. Without it a new feature whose rows say
  // File `test/` passed the Phase 4 gate, doctor and trace --code on another feature's test/shortener.test.js.
  // Ownership is claimed by the EXACT project-relative path only — pathNames' suffix match made another plan's
  // `tests/test_api.py` own services/beta/tests/test_api.py and hid a monorepo feature's own tests.
  const fold = (s) => { const t = stripEnd(String(s).replace(/^\.\//, ""), isSlashUnit); return FOLD_CASE ? t.toLowerCase() : t; };
  const claimed = new Set(otherPlanTestFiles(projectDir, dir).map(fold));
  const foreignMemo = new Map();
  const foreign = (rel) => {
    if (!claimed.size) return false;
    if (!foreignMemo.has(rel)) foreignMemo.set(rel, claimed.has(fold(rel)) && ![...ownFiles].some((p) => pathNames(rel, p)));
    return foreignMemo.get(rel);
  };
  const counts = (rel) => mine(rel) && !foreign(rel);
  const everyPlan = allPlannedTestKeys(projectDir);
  const testsInCode = {};
  const found = new Set();
  for (const [k, e] of s.tids) {
    const files = e.files.filter((rel) => counts(rel) && (!planned.has(k) || inScope(k, rel)));
    if (!files.length) continue;
    found.add(k);
    testsInCode[planned.get(k) || e.id] = files.slice(0, CODE_TRACE_FILES_PER_ID);
  }
  return {
    planned: planned.size,
    testsInCode,
    plannedNotInCode: [...planned].filter(([k]) => !found.has(k) && !outside.has(k)).map(([, id]) => id),
    plannedOutsideCode: [...planned].filter(([k]) => outside.has(k)).map(([, id]) => id),
    inCodeNotInPlan: [...s.tids].filter(([k]) => found.has(k) && !planned.has(k) && !everyPlan.has(k)).map(([, e]) => e.id),
    acsInTests: [...requiredAcs].filter((id) => s.acs.has(id) && s.acs.get(id).files.some(counts)),
    scanned: s.scanned,
    truncated: s.truncated,
  };
}

module.exports = { extractAcIds, extractTestIds, traceCheck, TRACE_INFO_FIELDS, TRACE_GAP_ORDER, TRACE_VERDICT_KINDS,
  TRACE_TASK_KINDS, TRACE_PLAN_KINDS, traceGaps, traceGapLines, TRACE_WARNING_ORDER, TRACE_SECONDARY_KINDS,
  traceWarnings, traceWarningLines, RE_SECONDARY_ID, RE_SECONDARY_ID_LINE, idKey, secondaryIds, secondaryDefinitions,
  traceSecondary, testPlanEntries, RE_CODE_TID, CODE_TRACE_CAP, CODE_TRACE_READ_CAP, CODE_TRACE_FILES_PER_ID,
  TEST_EXTRA_EXT, RE_TEST_NAME_EXTRA, isTestCodePath, tKey, specFeatureDirs, scanTestCode, allPlannedTestKeys,
  RE_FILE_COLUMN, pathUnder, pathNames, scannableTestPath, nonCodeArtifactPath, codePathToken, planFileScopes,
  fileCellTokens, outsideCodeTemplates, otherPlanTestFiles, traceTestCode, __link };

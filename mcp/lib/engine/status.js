"use strict";

/**
 * dev-spec-driven engine — spec_list / spec_status, the status line and the plan-mode bridge.
 * Introspection, the Claude Code status line (`dev-spec statusline`), the plan-mode bridge (hooks/plan-hook.js) and
 * the user's DEV_SPEC_* defaults.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, AI_SECTIONS, approvalChecks, artifactReport, bugSectionFilled, changedSinceApproval,
  clarificationMarkers, detectPhase, detectTracks, duplicateTaskNumbers, evidenceRule, executionSignOffStale,
  existingFeature, extractTestIds, featureDirs, featureFlow, featureLang, FOLD_CASE, gateArtifacts, gateWalk,
  guardInput, headingHasMarker, isDirSafe, isFeatureFolder, isInsideDir, isNetworkPath, isObj, isRecord, isTestCodePath,
  loadRoadmap, missingPackTracks, normalizeLang, own, packOf, packTitle, packTracks, parseTasks, PHASE_FILE, phaseFile,
  planFileScopes, planIdText, projectLang, RE_CODE_TID, readIfExists, readJson, readRoadmap, readState, reservedSlug,
  roadmapError, ROOT_CAUSE_SYN, SAAS_SECTIONS, safeReaddir, SAMPLE_GOLDEN, SCAN_IGNORE, SCAN_READ_BYTES, sectionState,
  specsRoot, SPIKE_FILE, spikeInfo, staleFinish, stateEvidence, statePath, stopActivity, suiteStatus, taskBlocks,
  taskSchedule, taskVerification, tKey, toPosix, TRACK_MARKER, TRACK_SECTIONS, trackLabel, trackMarker,
  trackSectionTable, verificationStatus, withinRoot, withRoadmapLock, writeRoadmap;
function __link(E) { ({ activeTasks, AI_SECTIONS, approvalChecks, artifactReport, bugSectionFilled,
  changedSinceApproval, clarificationMarkers, detectPhase, detectTracks, duplicateTaskNumbers, evidenceRule,
  executionSignOffStale, existingFeature, extractTestIds, featureDirs, featureFlow, featureLang, FOLD_CASE,
  gateArtifacts, gateWalk, guardInput, headingHasMarker, isDirSafe, isFeatureFolder, isInsideDir, isNetworkPath, isObj,
  isRecord, isTestCodePath, loadRoadmap, missingPackTracks, normalizeLang, own, packOf, packTitle, packTracks,
  parseTasks, PHASE_FILE, phaseFile, planFileScopes, planIdText, projectLang, RE_CODE_TID, readIfExists, readJson,
  readRoadmap, readState, reservedSlug, roadmapError, ROOT_CAUSE_SYN, SAAS_SECTIONS, safeReaddir, SAMPLE_GOLDEN,
  SCAN_IGNORE, SCAN_READ_BYTES, sectionState, specsRoot, SPIKE_FILE, spikeInfo, staleFinish, stateEvidence, statePath,
  stopActivity, suiteStatus, taskBlocks, taskSchedule, taskVerification, tKey, toPosix, TRACK_MARKER, TRACK_SECTIONS,
  trackLabel, trackMarker, trackSectionTable, verificationStatus, withinRoot, withRoadmapLock, writeRoadmap } = E); }

// 1.16 C2 — the user's defaults, the environment variables DEV_SPEC_<KEY>, read as FALLBACKS only: a project's own roadmap.json
// meta always wins, and a variable that is unset, empty, unexpanded (`${X}`) or not a valid value changes nothing (today's
// behaviour). Set in Claude Code's settings.json `env` block they reach the hooks, the MCP server and the CLI alike (and any
// other tool's MCP config `env`, or a shell). Deliberately NOT plugin.json `userConfig`: it opens a configuration dialog on every
// install / enable, and an older Claude Code that validates option fields strictly would refuse to load the plugin.
// Keys: DEFAULT_LANG (the language a NEW project gets — newProjectLang), STOP_CHECK (the end-of-turn evidence gate while
// meta.stopCheck is unset), GUARD_DEFAULT (off | on | scope while meta.guard is unset). hooks/guard-hook.js and
// hooks/stop-hook.js read the same variables raw (their cheap pre-checks).
function userOptionRaw(key) {
  for (const name of ["DEV_SPEC_" + key]) {
    const v = process.env[name];
    const s = typeof v === "string" ? v.trim() : "";
    if (s && !/^\$\{[^}]*\}$/.test(s)) return s;
  }
  return null;
}
const boolWord = (s) => (/^(?:true|on|yes|1)$/i.test(s) ? true : /^(?:false|off|no|0)$/i.test(s) ? false : undefined);
// → { lang?, stopCheck?, guard? } — only the options that are set to a valid value.
function userDefaults() {
  const out = {};
  const l = userOptionRaw("DEFAULT_LANG");
  const c = l ? i18n.canonicalLang(l) : null;
  if (c && i18n.LANGS.includes(c)) out.lang = c;
  const s = userOptionRaw("STOP_CHECK");
  if (s && boolWord(s) !== undefined) out.stopCheck = boolWord(s);
  const g = userOptionRaw("GUARD_DEFAULT");
  const gv = g ? (boolWord(g) !== undefined ? boolWord(g) : guardInput(g)) : undefined;
  if (gv !== undefined) out.guard = gv;
  return out;
}
// The user's default language for a NEW project: only while roadmap.json names no language (meta.lang) and the project has no
// feature yet (active or archived) — an existing project keeps the language it was written in. → lang | undefined
function newProjectLang(projectDir) {
  const d = userDefaults().lang;
  if (!d) return undefined;
  const l = loadRoadmap(projectDir);
  if (l.parseError) return undefined;
  const cur = isObj(l.rm.meta) ? l.rm.meta.lang : undefined;
  if (typeof cur === "string" && cur.trim()) return undefined;
  return featureDirs(projectDir).length ? undefined : d;
}
// The settings of a project that its user's options decide right now (meta leaves them unset) — spec_init reports them as
// `userDefaults` {lang?, stopCheck?, guard?}; opts.lang: the language this call seeded from the user's option.
function userDefaultsApplied(projectDir, opts = {}) {
  const d = userDefaults();
  const l = loadRoadmap(projectDir);
  const meta = l.parseError ? null : isObj(l.rm.meta) ? l.rm.meta : {}; // an unreadable roadmap.json: the options decide nothing
  const out = {};
  if (opts.lang) out.lang = opts.lang;
  if (meta && d.stopCheck !== undefined && typeof meta.stopCheck !== "boolean") out.stopCheck = d.stopCheck;
  if (meta && d.guard !== undefined && meta.guard === undefined) out.guard = d.guard;
  return out;
}
// meta.lang := lang, under the roadmap lock, only while it is still unset (spec_create's first feature with the user's default).
function seedProjectLang(projectDir, lang) {
  return withRoadmapLock(projectDir, () => {
    if (roadmapError(projectDir)) return false;
    const rm = readRoadmap(projectDir);
    rm.meta = isObj(rm.meta) ? rm.meta : {};
    if (typeof rm.meta.lang === "string" && rm.meta.lang.trim()) return false;
    rm.meta.lang = normalizeLang(lang);
    writeRoadmap(projectDir, rm);
    return true;
  }, () => false);
}

// ---------------------------------------------------------------------------
// Introspection: list / status / tasks
// ---------------------------------------------------------------------------

function listFeatures(projectDir) {
  const root = specsRoot(projectDir);
  if (!fs.existsSync(root)) return { specsDir: root, exists: false, features: [] };
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  const entries = dirs.filter((d) => isFeatureFolder(d.name, root));
  // Visible, non-addressable folders are named (so a hand-made "My Feature/" can be renamed), never listed.
  const ignored = dirs.filter((d) => !isFeatureFolder(d.name, root) && !/^[._]/.test(d.name) && !reservedSlug(d.name, root)).map((d) => d.name);
  const features = entries.map((d) => {
    const dir = path.join(root, d.name);
    const tracks = detectTracks(dir);
    const tasks = parseTasks(activeTasks(readIfExists(path.join(dir, "tasks.md")), tracks));
    const done = tasks.filter((t) => t.done).length;
    const row = {
      name: d.name,
      kind: readState(projectDir, d.name).kind || "feature",
      tracks: trackLabel(tracks),
      phase: detectPhase(dir, tracks),
      tasks: tasks.length,
      tasksDone: done,
    };
    if (featureFlow(dir) === "design-first") row.flow = "design-first"; // C3 (only then — the default row is unchanged)
    return row;
  });
  const res = { specsDir: root, exists: true, features };
  if (ignored.length) res.ignored = ignored;
  return res;
}

function statusFeature(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir } = f;
  const tracks = detectTracks(dir);
  const artifacts = fs
    .readdirSync(dir, { withFileTypes: true })
    .map((d) => d.name + (d.isDirectory() ? "/" : ""));
  const tasksText = activeTasks(readIfExists(path.join(dir, "tasks.md")), tracks); // inactive-track tasks are not counted
  const tasks = parseTasks(tasksText);
  const done = tasks.filter((t) => t.done).length;
  // Judged per task BLOCK (its own _Verify:_, its own record), never per number: a duplicated number must
  // not lend one task's run or _Verify:_ to the other. Same order as parseTasks (stable sort by number).
  const blocks = taskBlocks(tasksText || "");
  const next = taskSchedule(blocks).next; // 1.14 F3: next_task's rule (_Depends:_ all done)
  const dups = new Set(duplicateTaskNumbers(blocks));
  const evidence = stateEvidence(projectDir, slug);
  const mode = evidenceRule(projectDir); // 1.14 F1: meta.evidence "observed" — an unobserved run verifies nothing
  const list = blocks.map((b) => {
    const v = taskVerification(evidence, b, dups.has(b.number), mode); // doctor's rule — never a second opinion
    return { number: b.number, done: b.done, parallel: b.parallel, story: b.story, text: b.text, verified: !v.reason, ...(v.nothingToVerify ? { nothingToVerify: true } : {}) };
  }).sort((a, b) => a.number - b.number);

  // Mandatory-section completeness — headings matched by EN/PT/ES synonym. `filled` uses the SAME rule as
  // doctor (sectionState: no `> **TODO**` sentinel, non-empty body): status used to show ✓ for sections doctor
  // called unfilled.
  const design = readIfExists(path.join(dir, "design.md")) || "";
  const sectionView = (st) => st.map((s) => ({ section: s.section, present: s.status !== "missing", filled: s.status === "filled" }));
  let scaleSections = null;
  if (tracks.includes("saas")) scaleSections = sectionView(sectionState(design, SAAS_SECTIONS, "[SaaS]"));
  let aiSections = null;
  if (tracks.includes("ai")) {
    aiSections = { hasEvalPlan: fs.existsSync(path.join(dir, "eval-plan.md")), promptVersions: safeReaddir(path.join(dir, "prompts")).filter((f) => /\.md$/.test(f)),
      designHasAiSections: headingHasMarker(design, "[AI]"), sections: sectionView(sectionState(design, AI_SECTIONS, "[AI]")) };
  }
  // +sec / +privacy: the same view as the scale sections (null while the track is off).
  const trackView = (tr) => (tracks.includes(tr) ? sectionView(sectionState(design, TRACK_SECTIONS[tr], TRACK_MARKER[tr])) : null);
  // The active track packs (1.15): { <name>: { marker, title, sections } } — present only when the feature has one.
  const packSections = {};
  for (const tr of packTracks()) {
    if (tracks.includes(tr)) packSections[tr] = { marker: trackMarker(tr), title: packTitle(packOf(tr), featureLang(projectDir, slug)), sections: sectionView(sectionState(design, trackSectionTable(tr), trackMarker(tr))) };
  }
  const missingPacks = missingPackTracks(dir);

  const kind = readState(projectDir, slug).kind || "feature";
  return {
    ok: true,
    feature: slug,
    kind, // feature | bugfix | spike (1.14 — the same field spec_list rows carry)
    flow: featureFlow(dir, kind), // requirements-first | design-first (C3; a bugfix / spike is always requirements-first)
    tracks: trackLabel(tracks),
    phase: detectPhase(dir, tracks),
    artifacts,
    tasks: { total: tasks.length, done, next: next ? { number: next.number, text: next.text } : null, list },
    scaleSections,
    aiSections,
    secSections: trackView("sec"),
    privacySections: trackView("privacy"),
    distSections: trackView("dist"), // 1.17 D
    ...(Object.keys(packSections).length ? { packSections } : {}),
    ...(missingPacks.length ? { missingPacks } : {}), // saved track packs the project lacks now (inactive — doctor: track-pack-missing)
  };
}

// ---------------------------------------------------------------------------
// 1.16 C — Claude Code integration: the status line (`dev-spec statusline`) and the plan-mode bridge (hooks/plan-hook.js).
// The user's DEV_SPEC_* defaults (userDefaults) live beside guardLevel / stopCheckEnabled, which read them.
// ---------------------------------------------------------------------------

const STATUS_MAX_FEATURES = 200; // feature folders a status line reads, at most (sorted by name)
const STATUS_MAX_UP = 40; // folders walked up from a status line's cwd looking for a dev-spec .specs/
const STATUS_TEST_FILES = 20; // test files the status line reads for Phase 4's gate, at most (statusTestsGate)
// Approve-gate checks the doctor only WARNS about (spec_doctor: success-criteria, priorities, reproduction, constitution-check) —
// a forced approval failing only these is no `fix` for next_action, so none for the status line either.
const STATUS_DOCTOR_WARNS = new Set(["success-criteria", "priorities", "reproduction", "constitution-check"]);
// A folder whose .specs/ dev-spec owns: roadmap.json, steering/, or a feature folder with its .state.json (the hooks' rule).
function isDevSpecDir(dir) {
  const root = path.join(dir, ".specs");
  if (!isDirSafe(root)) return false;
  if (fs.existsSync(path.join(root, "roadmap.json")) || isDirSafe(path.join(root, "steering"))) return true;
  return safeReaddir(root).some((n) => !n.startsWith(".") && fs.existsSync(path.join(root, n, ".state.json")));
}
// The project a status line is about: the nearest folder at or above one of the candidate folders (in order) that holds a
// dev-spec .specs/ — a few stats per level, never a walk down. Unusable candidates (empty, an unexpanded `${VAR}`, a network
// path — isNetworkPath, skipped before any fs call) are skipped.
// → the project folder | null
function statusLineProject(candidates) {
  const seen = new Set();
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (typeof c !== "string" || !c.trim() || /^\$\{[^}]*\}$/.test(c.trim()) || c.length > 4096 || isNetworkPath(c)) continue;
    let dir = path.resolve(c.trim());
    for (let i = 0; i < STATUS_MAX_UP; i++) {
      const key = FOLD_CASE ? dir.toLowerCase() : dir;
      if (seen.has(key)) break;
      seen.add(key);
      if (isDevSpecDir(dir)) return dir;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}
// The latest activity of a feature for the status line (ms): what the engine recorded (ticks, evidence, approvals, creation,
// finish) and the dates of .state.json / tasks.md — a status line shows what is being worked on, so a file date counts here.
function statusActivity(dir, st) {
  let best = stopActivity(st) || 0;
  const see = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; if (Number.isFinite(t) && t > best) best = t; };
  see(st.createdAt);
  if (isObj(st.approvals)) Object.values(st.approvals).forEach((a) => isObj(a) && see(a.at));
  if (isObj(st.finished)) see(st.finished.at);
  for (const f of [statePath(dir), path.join(dir, "tasks.md")]) {
    try { const m = fs.statSync(f).mtimeMs; if (m > best) best = m; } catch { /* absent */ }
  }
  return best;
}
// Phase 4's gate for the status line, kept cheap (approvalChecks' `tests` case runs trace_check's code scan — a walk of the
// whole project): +ai's eval-sets check is the gate's own (one read of evals/golden.json); +tdd's tests-in-code is answered only
// when it can be proven without the walk — no planned T-ID (the gate refuses: noPlannedTests), or every planned T-ID found in a
// test FILE its own plan row names (read directly: at most STATUS_TEST_FILES files, inside the project, never through a hidden or
// ignored folder the scan skips, never a link) or checked outside test code. Anything else is unknown. → "pass" | "fail" | "unknown"
function statusTestsGate(pdir, dir, tracks) {
  const tdd = tracks.includes("tdd") && fs.existsSync(path.join(dir, "test-plan.md"));
  const ai = tracks.includes("ai") && fs.existsSync(path.join(dir, "eval-plan.md"));
  if (ai) {
    const golden = readJson(path.join(dir, "evals", "golden.json"));
    const items = golden.data && Array.isArray(golden.data.items) ? golden.data.items : null;
    const sample = items && JSON.stringify(golden.data) === JSON.stringify(JSON.parse(SAMPLE_GOLDEN));
    if (!(items && items.length) || sample) return "fail";
  }
  if (!tdd) return "pass";
  const planText = planIdText(readIfExists(path.join(dir, "test-plan.md")) || "");
  const planned = [...new Set([...extractTestIds(planText)].map((id) => tKey(id.slice(2))))];
  if (!planned.length) return "fail";
  const { scopes, outside } = planFileScopes(planText);
  const root = path.resolve(pdir);
  const read = new Map(); // project-relative file → the T-ID keys it names (null: not a file the scan would read)
  const keysOf = (p) => {
    const rel = toPosix(p).replace(/^\.\/+/, "");
    if (read.has(rel)) return read.get(rel);
    let keys = null;
    const abs = path.resolve(root, rel);
    const segs = toPosix(path.relative(root, abs)).split("/");
    if (read.size < STATUS_TEST_FILES && withinRoot(root, abs) && !segs.slice(0, -1).some((s) => s.startsWith(".") || SCAN_IGNORE.has(s)) &&
      !SCAN_IGNORE.has(segs[segs.length - 1]) && isTestCodePath(segs.join("/"))) {
      try {
        if (fs.lstatSync(abs).isFile()) {
          keys = new Set();
          for (const m of fs.readFileSync(abs, "utf8").slice(0, SCAN_READ_BYTES).matchAll(RE_CODE_TID)) keys.add(tKey(m[1] || m[2] || m[3]));
        }
      } catch { keys = null; }
    }
    read.set(rel, keys);
    return keys;
  };
  for (const k of planned) {
    if (outside.has(k)) continue;
    const files = (scopes.get(k) || []).filter((p) => !p.endsWith("/") && path.posix.extname(p));
    if (!files.some((p) => { const ks = keysOf(p); return !!ks && ks.has(k); })) return "unknown";
  }
  return "pass";
}
// The step the status line names — spec_next_action's order, kept cheap (a status line runs after every assistant message; it
// never runs the doctor, trace_check's code scan or the drift hash):
//   spike: fill spike.md (its question) → the next investigation task → blocked (none can start) → decide (the decision, then its
//     _Outcome:_ line) → promote (go) · archive (no-go) · pivot — next_action's own spike steps;
//   re-review (an artifact changed since its approval, as far as the first pending phase) → the first unapproved phase: fill its
//     artifact / fix (its approve gate's checks) / approve — Phase 4 (tests) through statusTestsGate: approve · fix · tests (not
//     known cheaply: write the tests, then approve them);
//   every phase approved: a FORCED approval whose gate still fails (approvalChecks re-run for the forced phases — next_action's
//     doctor step for a forced approval), or a bugfix whose bug.md → Root Cause is still empty (the doctor's root-cause failure; the
//     bugfix gate refuses every task after the one that writes it) → fix;
//   tasks: none → tasks · the next startable one → implement · none startable → blocked;
//   every task done: a tick not verified → verify · no finish baseline → finish · a baseline older than a change (staleFinish,
//     state only — the _Implements:_ walk skipped) → finish (again) · a project check without a passing run since the last task
//     activity (suiteStatus without the code hash) → verify · the execution sign-off missing or older than a change → sign-off ·
//     else finished — the drift of the recorded files is NOT checked (next_action's `drift`), so the line never says "clean".
// → { step, … } with stable step codes: re-review · fill · fix · approve · tests · tasks · implement · blocked · verify · decide ·
// promote · archive · pivot · finish · sign-off · finished. The parity with spec_next_action's `step` (mcp/test.js "1.16 C review"):
// blocked → fix; tests → fix | approve; sign-off / finished → finished; every other code is next_action's own — and any end state
// (finish · verify of the checks · sign-off · finished) may be next_action's `drift`.
function statusNext(pdir, f, kind, lng, unverified) {
  const st = f.st;
  const approvals = isObj(st.approvals) ? st.approvals : {};
  const open = f.blocks.filter((b) => !b.done);
  if (kind === "spike") {
    const si = spikeInfo(f.dir);
    if (!si.questionFilled) return { step: "fill", file: SPIKE_FILE };
    const nx = taskSchedule(f.blocks).next;
    if (nx) return { step: "implement", task: nx.number };
    if (open.length) return { step: "blocked" };
    if (!si.decisionFilled) return { step: "decide" };
    if (!si.outcome) return { step: "decide", outcome: true };
    return { step: si.outcome === "go" ? "promote" : si.outcome === "no-go" ? "archive" : "pivot", outcome: si.outcome };
  }
  const walk = gateWalk(f.dir, f.tracks, kind);
  const pending = walk.find((ph) => !approvals[ph]) || null;
  const phaseOfFile = (file) => Object.keys(PHASE_FILE).find((ph) => phaseFile(ph, kind) === file) || (file === "design.md" ? "design" : null);
  const changed = changedSinceApproval(f.dir, approvals, f.tracks, kind)
    .filter((file) => { if (!pending) return true; const i = walk.indexOf(phaseOfFile(file)); return i === -1 || i <= walk.indexOf(pending); });
  if (changed.length) return { step: "re-review", files: changed };
  if (pending) {
    const art = gateArtifacts(f.dir, f.tracks, kind, pending).map((file) => artifactReport(f.dir, file, f.tracks)).find((r) => r.state !== "filled");
    if (art) return { step: "fill", file: art.file, phase: pending };
    if (pending === "tests") {
      const g = statusTestsGate(pdir, f.dir, f.tracks);
      return g === "pass" ? { step: "approve", phase: "tests" } : g === "fail" ? { step: "fix", phase: "tests" } : { step: "tests" };
    }
    const g = approvalChecks(pdir, f.slug, f.dir, pending, f.tracks, kind, lng);
    return g.checks.length ? { step: "fix", phase: pending, failing: g.checks.map((c) => c.id) } : { step: "approve", phase: pending };
  }
  // Every phase approved. A forced approval (force: true — recorded with the checks it failed) is re-checked: while its gate still
  // fails on a check the DOCTOR fails too, next_action's doctor step says fix (never Phase 4's: its tests-in-code is a doctor
  // warning, and its gate scans the code). The gate is stricter than the doctor on a few checks (STATUS_DOCTOR_WARNS), and its
  // clarifications count design.md's markers where the doctor reads requirements.md's only.
  for (const ph of walk) {
    if (ph === "tests" || !isRecord(approvals[ph]) || approvals[ph].forced !== true) continue;
    const failing = approvalChecks(pdir, f.slug, f.dir, ph, f.tracks, kind, lng).checks.map((c) => c.id).filter((id) => !STATUS_DOCTOR_WARNS.has(id) &&
      (id !== "clarifications" || clarificationMarkers(readIfExists(path.join(f.dir, "requirements.md")) || "").length > 0));
    if (failing.length) return { step: "fix", phase: ph, failing, ...(failing.includes("root-cause") ? { file: "bug.md" } : {}) };
  }
  // A bugfix: no fix before its root cause — bug.md → Root Cause empty fails the doctor (root-cause) and the bugfix gate refuses
  // every task after the one that writes it (one read of bug.md).
  if (kind === "bugfix" && !bugSectionFilled(readIfExists(path.join(f.dir, "bug.md")), ROOT_CAUSE_SYN)) {
    return { step: "fix", phase: "design", failing: ["root-cause"], file: "bug.md" };
  }
  if (!f.blocks.length) return { step: "tasks" };
  if (open.length) {
    const nx = taskSchedule(f.blocks).next;
    return nx ? { step: "implement", task: nx.number } : { step: "blocked" };
  }
  if (unverified.length) return { step: "verify", task: unverified[0] };
  const fin = isObj(st.finished) && isObj(st.finished.files) ? st.finished : null;
  if (!fin) return { step: "finish" };
  if (staleFinish(pdir, st, "", { newFiles: false })) return { step: "finish", again: true };
  const suite = suiteStatus(pdir, st, null).missing; // no `dir`: the code-changed hash is skipped (state and roadmap.json only)
  if (suite.length) return { step: "verify", suite: suite.map((i) => i.name) };
  if (!isRecord(approvals.execution)) return { step: "sign-off" };
  if (executionSignOffStale(st)) return { step: "sign-off", again: true };
  return { step: "finished" };
}
// `dev-spec statusline` — ONE short line about the project for Claude Code's status line (settings.json "statusLine"), e.g.
// "◆ billing · 4/9 tasks · 1 unverified · next: approve tasks", in the project language. The feature shown: the most recently
// active one with work under way (some tasks done, some open), else the most recently active one. Read-only and bounded: each
// active feature's .state.json + tasks.md (at most STATUS_MAX_FEATURES), then the chosen feature's evidence and the step
// statusNext names. opts: { columns } — the line is cut to that width. → { ok, found, project, lang, feature, kind, tasks,
// unverified, next, features, line }; found false (line "") when there is no .specs/.
function statusLine(projectDir, opts = {}) {
  const pdir = path.resolve(projectDir);
  const root = specsRoot(pdir);
  if (!isDirSafe(root)) return { ok: true, found: false, project: pdir, line: "" };
  const lng = projectLang(pdir);
  const SL = i18n.msg(lng).claudeCode.statusLine;
  const rows = [];
  for (const n of safeReaddir(root).filter((x) => isFeatureFolder(x, root)).sort().slice(0, STATUS_MAX_FEATURES)) {
    const dir = path.join(root, n);
    if (!isDirSafe(dir)) continue;
    const j = readJson(statePath(dir));
    const st = isObj(j.data) ? j.data : {};
    const tracks = detectTracks(dir);
    const blocks = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || "");
    const done = blocks.filter((b) => b.done).length;
    rows.push({ slug: n, dir, st, tracks, blocks, done, total: blocks.length, at: statusActivity(dir, st) });
  }
  const clip = (s) => {
    const cols = Number.isSafeInteger(opts.columns) && opts.columns >= 20 ? opts.columns : 0;
    const cps = [...s];
    return cols && cps.length > cols ? cps.slice(0, cols - 1).join("") + "…" : s;
  };
  if (!rows.length) return { ok: true, found: true, project: pdir, lang: lng, feature: null, features: 0, line: clip(SL.none) };
  const executing = rows.filter((r) => r.done > 0 && r.done < r.total);
  const f = (executing.length ? executing : rows).slice().sort((a, b) => b.at - a.at || (a.slug < b.slug ? -1 : 1))[0];
  const kind = typeof f.st.kind === "string" ? f.st.kind : "feature";
  const unverified = f.done ? verificationStatus(pdir, f.slug, f.dir).unverified : [];
  let next = null;
  try { next = statusNext(pdir, f, kind, lng, unverified); } catch { next = null; } // a status line never fails on one feature's files
  const stepText = next && own(SL.steps, next.step) ? SL.steps[next.step](next) : null;
  const parts = [SL.head(f.slug, kind)];
  if (f.total) parts.push(SL.tasks(f.done, f.total));
  if (unverified.length) parts.push(SL.unverified(unverified.length));
  if (stepText) parts.push(SL.next(stepText));
  return { ok: true, found: true, project: pdir, lang: lng, feature: f.slug, kind, tasks: { done: f.done, total: f.total },
    unverified: unverified.length, next, features: rows.length, line: clip(parts.join(" · ")) };
}

// The plan-mode bridge (hooks/plan-hook.js, PostToolUse on ExitPlanMode): the plan the user just approved can become a spec —
// one line of context for the agent suggesting /spec-import (spec_import {tool: "plan", text} — or {path} when the plan file
// is inside the project). The payload shape is read defensively (tool_input.plan, a planFilePath / filePath in the input or the
// response); nothing is read from disk. → { hint, lang, planFile, inProject, hasText } | null (not an ExitPlanMode payload)
function planBridge(projectDir, payload) {
  if (!isObj(payload) || (payload.tool_name || payload.toolName) !== "ExitPlanMode") return null;
  const ti = isObj(payload.tool_input) ? payload.tool_input : isObj(payload.toolInput) ? payload.toolInput : {};
  const tr = isObj(payload.tool_response) ? payload.tool_response : isObj(payload.toolResponse) ? payload.toolResponse : {};
  const usable = (v) => typeof v === "string" && v.trim() && v.length <= 4096 && !/[\u0000-\u001f]/.test(v);
  const hasText = [ti.plan, tr.plan].some((v) => typeof v === "string" && v.trim() !== "");
  const file = [ti.planFilePath, ti.plan_file_path, tr.planFilePath, tr.plan_file_path, tr.filePath].find(usable) || null;
  const pdir = path.resolve(projectDir);
  const lng = projectLang(pdir);
  const P = i18n.msg(lng).claudeCode.planBridge;
  let rel = null;
  if (file) {
    const abs = path.resolve(pdir, file.trim());
    if (isInsideDir(pdir, abs) && !toPosix(path.relative(pdir, abs)).split("/").includes(".specs")) rel = toPosix(path.relative(pdir, abs));
  }
  return { hint: rel ? P.byPath(rel) : P.byText, lang: lng, planFile: file, inProject: !!rel, hasText };
}

module.exports = { userOptionRaw, boolWord, userDefaults, newProjectLang, userDefaultsApplied, seedProjectLang,
  listFeatures, statusFeature, STATUS_MAX_FEATURES, STATUS_MAX_UP, STATUS_TEST_FILES, STATUS_DOCTOR_WARNS, isDevSpecDir,
  statusLineProject, statusActivity, statusTestsGate, statusNext, statusLine, planBridge, __link };

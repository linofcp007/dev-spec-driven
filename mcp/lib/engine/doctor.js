"use strict";

/**
 * dev-spec-driven engine — spec_doctor, spec_next_action, spec_list / spec_status and the status line.
 * The one health check that decides "ready to advance?", "you are here → do this next", the design.md save check;
 * introspection, the Claude Code status line (`dev-spec statusline`), the plan-mode bridge (hooks/plan-hook.js) and the
 * user's DEV_SPEC_* defaults.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acDuplicates, activeDesign, activeSectionTracks, activeTasks, AI_SECTIONS, approvalChecks, approvalRolesOf,
  approveStepExtras, artifactReport, artifactState, b5DoctorChecks, baselineDrift, bugSectionFilled, chainPlaceholders,
  changedSinceApproval, checkPhaseIndex, clarificationMarkers, cleanTaskText, CONSTITUTION_SYN, crossAcDoctorDetail,
  crossFeatureAcs, decisionDoctorChecks, designApprovedBeforeWeigh, designWeighChecks, detectPhase, detectTracks,
  duplicateTaskNumbers, earsUnlinted, earsUnidentified, shortIdList, earsValidate, evidenceRule, executionSignOffStale, existingFeature, expectsFail,
  extractSection, extractTestIds, featureDirs, featureFlow, featureLang, featureOverlaps, flowOrderText, flowPhaseIndex,
  FOLD_CASE, gateArtifacts, gateWalk, glossaryEntries, glossaryHits, guardInput, hasPriority, hasSuccessCriteria,
  headingHasMarker, isDirSafe, isFeatureFolder, isInsideDir, isNetworkPath, isObj, isRecord, isSpikeDir, isTestCodePath,
  legacyPackName, legacyPackMarkerTrack, loadRoadmap, malformedMarkers, mergeConflictsCheck, missingPackTracks, packReservedSince, normalizeLang, outsideCodeTemplates,
  overlapDoctorDetail, own, packOf, packRegistry, packTitle, packTracks, parseTasks, pendingGateList, PHASE_FILE,
  phaseActive, phaseContent, phaseFile, PHASES, placeholderSummary, planFileScopes, planIdText, projectLang,
  RE_CODE_TID, RE_CONSTITUTION_CHECK, readFileHead, readIfExists, readJson, readRoadmap, readState, realRootOf, redPhaseHint,
  REPRO_SYN, reReviewRoles, reservedSlug, roadmapError, roleGateView, roleSignOffs, ROOT_CAUSE_SYN, SAAS_SECTIONS,
  safeReaddir, SAMPLE_GOLDEN, SCAN_IGNORE, SCAN_READ_BYTES, secondaryDefinitions, sectionFilled, sectionState,
  signOffWhyText, snapshotPhases, specsRoot, SPIKE_FILE, spikeDoctor, spikeInfo, spikeNextAction, staleFinish,
  staleFinishText, stateEvidence, statePath, steeringChanges, steeringChangeText, steeringPlaceholders, stopActivity,
  suiteLabel, suiteStatus, supersedesWarnings, taskBlocks, taskDepsBlockedNote, taskDepsCheck, taskMarkers,
  taskSchedule, taskVerification, tKey, toPosix, TRACE_PLAN_KINDS, TRACE_SECONDARY_KINDS, TRACE_TASK_KINDS,
  TRACE_VERDICT_KINDS, traceCheck, traceGapLines, traceGaps, traceWarningLines, TRACK_MARKER, TRACK_SECTIONS,
  trackLabel, trackMarker, trackSectionTable, unreadTasksDetail, unverifiedLabel, VALID_TRACKS, verificationStatus, verifyPipes,
  waiverExpiredCheck, withinRoot, withRoadmapLock, writeRoadmap,
  featureSize, trackSectionReport, sectionVerdict,
  isChangeDir, changeScope, changeViews, criteriaText, CHANGE_FILE, planFastForwardEnd, approvalsInForce, testsStaleText;
function __link(E) { ({ acDuplicates, activeDesign, activeSectionTracks, activeTasks, AI_SECTIONS, approvalChecks,
  approvalRolesOf, approveStepExtras, artifactReport, artifactState, b5DoctorChecks, baselineDrift, bugSectionFilled,
  chainPlaceholders, changedSinceApproval, checkPhaseIndex, clarificationMarkers, cleanTaskText, CONSTITUTION_SYN,
  crossAcDoctorDetail, crossFeatureAcs, decisionDoctorChecks, designApprovedBeforeWeigh, designWeighChecks, detectPhase,
  detectTracks, duplicateTaskNumbers, earsUnlinted, earsUnidentified, shortIdList, earsValidate, evidenceRule, executionSignOffStale, existingFeature,
  expectsFail, extractSection, extractTestIds, featureDirs, featureFlow, featureLang, featureOverlaps, flowOrderText,
  flowPhaseIndex, FOLD_CASE, gateArtifacts, gateWalk, glossaryEntries, glossaryHits, guardInput, hasPriority,
  hasSuccessCriteria, headingHasMarker, isDirSafe, isFeatureFolder, isInsideDir, isNetworkPath, isObj, isRecord,
  isSpikeDir, isTestCodePath, legacyPackName, legacyPackMarkerTrack, loadRoadmap, malformedMarkers, mergeConflictsCheck, missingPackTracks, packReservedSince, normalizeLang,
  outsideCodeTemplates, overlapDoctorDetail, own, packOf, packRegistry, packTitle, packTracks, parseTasks,
  pendingGateList, PHASE_FILE, phaseActive, phaseContent, phaseFile, PHASES, placeholderSummary, planFileScopes,
  planIdText, projectLang, RE_CODE_TID, RE_CONSTITUTION_CHECK, readFileHead, readIfExists, readJson, readRoadmap, readState,
  realRootOf, redPhaseHint, REPRO_SYN, reReviewRoles, reservedSlug, roadmapError, roleGateView, roleSignOffs,
  ROOT_CAUSE_SYN, SAAS_SECTIONS, safeReaddir, SAMPLE_GOLDEN, SCAN_IGNORE, SCAN_READ_BYTES, secondaryDefinitions,
  sectionFilled, sectionState, signOffWhyText, snapshotPhases, specsRoot, SPIKE_FILE, spikeDoctor, spikeInfo,
  spikeNextAction, staleFinish, staleFinishText, stateEvidence, statePath, steeringChanges, steeringChangeText,
  steeringPlaceholders, stopActivity, suiteLabel, suiteStatus, supersedesWarnings, taskBlocks, taskDepsBlockedNote,
  taskDepsCheck, taskMarkers, taskSchedule, taskVerification, tKey, toPosix, TRACE_PLAN_KINDS, TRACE_SECONDARY_KINDS,
  TRACE_TASK_KINDS, TRACE_VERDICT_KINDS, traceCheck, traceGapLines, traceGaps, traceWarningLines, TRACK_MARKER,
  TRACK_SECTIONS, trackLabel, trackMarker, trackSectionTable, unreadTasksDetail, unverifiedLabel, VALID_TRACKS, verificationStatus,
  verifyPipes, waiverExpiredCheck, withinRoot, withRoadmapLock, writeRoadmap,
  featureSize, trackSectionReport, sectionVerdict,
  isChangeDir, changeScope, changeViews, criteriaText, CHANGE_FILE, planFastForwardEnd, approvalsInForce, testsStaleText } = E); }

// What the PostToolUse hook reports when design.md is saved: the design's mandatory checks for the feature's ACTIVE
// tracks — [SaaS]/[AI] sections missing or unfilled, the Constitution Check (not for a bugfix: bug.md's Root Cause
// replaces the design) and template placeholders — as structured fields plus a short localized `text`.
function designSaveCheck(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const design = readIfExists(path.join(f.dir, "design.md"));
  const lng = featureLang(projectDir, f.slug);
  const fm = i18n.msg(lng);
  const D = fm.designSaveCheck;
  if (design == null) return { ok: false, error: fm.doctor.designMissing };
  const tracks = detectTracks(f.dir);
  const kind = readState(projectDir, f.slug).kind || "feature";
  const label = (s) => `${fm.sectionNames[s.section] || s.section}:${fm.sectionStatus[s.status] || s.status}`;
  const sections = [];
  // 1.21 F5: the size's rules (tiers, overlaps) and the stricter filled rule; a section holding only the template's guidance
  // is listed even on an approved design (the hook informs — doctor warns there, a new approval refuses).
  const size = featureSize(f.dir);
  for (const [tr, marker, rows] of trackSectionReport(design, tracks, { size, lang: lng })) {
    const bad = rows.filter((s) => sectionVerdict(s, { size }) !== "pass");
    if (bad.length) sections.push({ track: tr, marker, sections: bad });
  }
  let constitution = null; // null = not checked (bugfix)
  let weigh = null; // 1.17 A1: {tradeoffs, risks} = designWeighState's status codes (null for a bugfix) — notes, never unclean
  let reuse = null; // 1.19 R1: the Reuse & Integration section's state (null for a bugfix) — a note, never unclean
  const notes = [];
  if (kind !== "bugfix") {
    const active = activeDesign(design, tracks);
    constitution = extractSection(active, CONSTITUTION_SYN) == null ? "missing" : sectionFilled(active, CONSTITUTION_SYN) ? "filled" : "unfilled";
    const wc = designWeighChecks(active, lng, { integrationPlan: readIfExists(path.join(f.dir, "integration-plan.md")) });
    weigh = { tradeoffs: wc[0].state, risks: wc[1].state };
    reuse = wc[2].state;
    // A section still holding its template slots is the placeholders line's; missing / empty / too few options get a ▲ note.
    for (const c of wc) if (c.status === "warn" && c.state !== "template") notes.push("  ▲ " + c.detail);
  }
  const placeholders = artifactReport(f.dir, "design.md", tracks, design).items;
  const clean = !sections.length && constitution !== "missing" && constitution !== "unfilled" && !placeholders.length;
  const lines = [];
  sections.forEach((s) => lines.push("  - " + D.sections(s.marker, s.sections.map(label).join("; "))));
  if (constitution === "missing" || constitution === "unfilled") lines.push("  - " + D.constitution[constitution]);
  if (placeholders.length) {
    const short = (t) => (t.length > 40 ? t.slice(0, 39) + "…" : t);
    lines.push("  - " + D.placeholders(placeholders.length, placeholders.slice(0, 3).map((p) => `L${p.line} ${short(p.text)}`).join(", ") +
      (placeholders.length > 3 ? ", " + fm.gates.more(placeholders.length - 3) : "")));
  }
  const text = clean ? [D.clean(trackLabel(tracks), constitution != null), ...notes].join("\n") : [D.head(f.slug, trackLabel(tracks)), ...lines, ...notes, D.hint(f.slug)].join("\n");
  return { ok: true, feature: f.slug, tracks: trackLabel(tracks), kind, sections, constitution, weigh, reuse, placeholders, clean, text };
}

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
  // 1.21 F5: the size's rules (an optional extended section at S, a section another active track covers) and the stricter filled
  // rule (the template's guidance alone is not filled). A sized feature's rows also carry `status` (+ `tier`, `by`).
  const size = featureSize(dir);
  const report = trackSectionReport(design, tracks, { size, lang: featureLang(projectDir, slug) });
  // (1.21 review C10: an unsized row carries its `status` too — status said "unfilled" where doctor said "only the template's
  // guidance"; `tier` / `by` stay a sized feature's)
  const sectionView = (st) => st.map((s) => Object.assign({ section: s.section, present: s.status !== "missing" && s.status !== "covered", filled: sectionVerdict(s, { size }) === "pass" && (s.status !== "missing" || !!size), status: s.status },
    size ? { tier: s.tier, ...(s.by ? { by: s.by } : {}) } : {}));
  const rowsOf = (tr) => (report.find(([t]) => t === tr) || [])[2] || [];
  let scaleSections = null;
  if (tracks.includes("saas")) scaleSections = sectionView(rowsOf("saas"));
  let aiSections = null;
  if (tracks.includes("ai")) {
    aiSections = { hasEvalPlan: fs.existsSync(path.join(dir, "eval-plan.md")), promptVersions: safeReaddir(path.join(dir, "prompts")).filter((f) => /\.md$/.test(f)),
      designHasAiSections: headingHasMarker(design, "[AI]"), sections: sectionView(rowsOf("ai")) };
  }
  // +sec / +privacy: the same view as the scale sections (null while the track is off).
  const trackView = (tr) => (tracks.includes(tr) ? sectionView(rowsOf(tr)) : null);
  // The active track packs (1.15): { <name>: { marker, title, sections } } — present only when the feature has one.
  const packSections = {};
  for (const tr of packTracks()) {
    if (tracks.includes(tr)) packSections[tr] = { marker: trackMarker(tr), title: packTitle(packOf(tr), featureLang(projectDir, slug)), sections: sectionView(rowsOf(tr)) };
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
    apiSections: trackView("api"), // 1.19 T
    uiSections: trackView("ui"),
    obsSections: trackView("obs"),
    dataSections: trackView("data"), // 1.21 F4
    ...(Object.keys(packSections).length ? { packSections } : {}),
    ...(missingPacks.length ? { missingPacks } : {}), // saved track packs the project lacks now (inactive — doctor: track-pack-missing)
  };
}

// ---------------------------------------------------------------------------
// spec_next_action — "you are here → do this next" + what changed since approval
// ---------------------------------------------------------------------------

// opts.doctor: this feature's specDoctor() result, already computed in the same call (spec_upgrade) — never run twice.
function nextAction(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  if (isSpikeDir(f.dir)) return spikeNextAction(projectDir, f, opts); // 1.14 C2
  const { slug, dir } = f;
  const tracks = detectTracks(dir);
  const phase = detectPhase(dir, tracks);
  const doc = opts.doctor && opts.doctor.ok ? opts.doctor : specDoctor(projectDir, name, { lean: true }); // lean: the verdict and the failing checks only
  const st = readState(projectDir, name);
  // 1.22 review: the approvals in force — a Phase 4 sign-off the plan outgrew (a T-ID planned since, a plan re-approved since)
  // is pending again (testsSignOffStale)
  const approvals = approvalsInForce(dir, tracks, st.approvals || {});
  // An approved artifact whose content changed after ITS OWN approval needs re-review (shared with finish/roadmap).
  const changed = changedSinceApproval(dir, approvals, tracks, st.kind);

  const lng = featureLang(projectDir, name);
  const fm = i18n.msg(lng);
  const nx = fm.next;
  const G = fm.gates;
  const kind = st.kind || "feature";
  // Phase by phase (SKILL.md: each phase is presented for approval before the next one starts), so a brand-new feature
  // is told to write its classification — never the design before the requirements are approved, and never to fix the
  // checks of phases it hasn't reached:
  // (1) an artifact changed since its approval → re-review;
  // (2) the FIRST active phase not approved yet (gateWalk: the chain's order, execution apart, `tests` once due) — its
  //     artifact missing / still a template → fill it; else the checks its approval runs failing → fix them (named —
  //     never an approval the gate would refuse); else → approve it. Only that approval opens the next phase;
  // (3) every phase approved: failing checks of the current phase (or an earlier one — e.g. a forced approval) → fix;
  // (4) the next task; (5) all tasks done → a ticked task without passing evidence → verify it (spec_finish would
  //     refuse), else drift since a finish → decide, else spec_finish (again, when its baseline is stale), else — finished —
  //     project checks without a passing run since the last task activity → verify (res.suite), else finished.
  const pending = gateWalk(dir, tracks, kind).find((ph) => !approvals[ph]) || null;
  let open = null;
  let refused = null;
  // 1.21 F5 P3 — size XS / S: the plan is filled WHOLE, then approved in one call (spec_approve {through: "tasks"} — each gate still
  // runs, in order): the fill step names every planning artifact through tasks still a template, from the first pending phase on.
  const size = featureSize(dir);
  const planFf = (size === "xs" || size === "s") && kind !== "spike";
  // 1.21 review C3: where the plan's one call ends — tasks, or the planning phase before a Phase 4 tests gate still ahead
  // (its gate needs the written failing tests / eval sets: a call through tasks stopped there every time)
  const ffEnd = planFf ? planFastForwardEnd(dir, tracks, kind, pending) || "tasks" : "tasks";
  let planOpen = [];
  if (pending) {
    if (planFf) {
      const walk0 = gateWalk(dir, tracks, kind);
      const upto = walk0.indexOf("tasks") >= 0 ? walk0.indexOf("tasks") : walk0.length - 1;
      planOpen = walk0.slice(walk0.indexOf(pending), upto + 1).filter((ph) => !approvals[ph])
        .flatMap((ph) => gateArtifacts(dir, tracks, kind, ph)).map((file) => artifactReport(dir, file, tracks)).filter((r) => r.state !== "filled");
    }
    open = gateArtifacts(dir, tracks, kind, pending).map((file) => artifactReport(dir, file, tracks)).find((r) => r.state !== "filled") || null;
    if (!open) {
      // doctor already ran this gate's own checks when it is its first pending gate (nextGate) — the tests gate scans the
      // test code, so it is never run twice.
      const g = doc.nextGate && doc.nextGate.phase === pending ? { checks: doc.nextGate.failing } : approvalChecks(projectDir, slug, dir, pending, tracks, kind, lng);
      if (g.checks.length) refused = g.checks;
      else if (planFf && planOpen.length) open = planOpen[0]; // P3: the rest of the plan before the one approval call
    }
  }
  const flow = featureFlow(dir, kind); // C3: the phase scale of the feature's flow (design-first: design 1, requirements 2)
  const cur = flowPhaseIndex(phase, flow);
  const fails = doc.ok ? doc.checks.filter((c) => c.status === "fail" && checkPhaseIndex(c.id, flow) <= cur) : [];
  // Phase 4 names what it asks for: failing tests (+tdd), the eval harness + baseline (+ai), or both.
  const plans = [tracks.includes("tdd") && fs.existsSync(path.join(dir, "test-plan.md")), tracks.includes("ai") && fs.existsSync(path.join(dir, "eval-plan.md"))];
  const testsWhat = plans[0] && plans[1] ? "both" : plans[1] ? "ai" : "tdd";
  // Once tasks are ticked (executing / complete — e.g. a 1.12 feature, which had no tests gate) the code exists: "write
  // every test and confirm it fails … no implementation code until then" is impossible. The gate is then a sign-off for
  // the tests that exist (T-IDs in test names, the feature's own eval set + baseline) — the same gate, reworded.
  const testsSignOff = phase === "executing" || phase === "complete";
  const approveMsg = { classification: G.approveClassification, requirements: nx.approveRequirements,
    design: st.kind === "bugfix" ? nx.approveBugDesign : nx.approveDesign, "test-plan": nx.approveTestPlan, "eval-plan": nx.approveEvalPlan,
    tests: (s) => (testsSignOff ? nx.signOffTests(s, testsWhat) : nx.approveTests(s, testsWhat)), tasks: kind === "change" ? fm.sizes.approvePlan : nx.approveTasks };
  let step;
  let recommendation;
  let gateFix = false;
  let impactPhases = [];
  let finishedDrift = null;
  let staleBaseline = null;
  let approveExtras = null; // 1.14 B3: {missingRoles?, fastForward?} of the approve step
  let reReviewRefused = null; // the re-review phase whose approve gate would refuse (refusedGate names it)
  let finishedRoles = null; // the roles still to sign the execution phase off (finished step)
  let finishedComplete = false; // 1.21 review A1: every execution role signed, yet no approval (finished step)
  let suiteMissing = null; // the project checks without a passing run since the last task activity (verify step, finished)
  let depsBlocked = null; // 1.14 F3: [{number, waitsOn}] — open tasks, none can start (fix step)
  let missingApproved = []; // 1.22 review: approved artifacts that are gone (re-review step)
  // 1.22 review: Phase 4 pending again because its sign-off no longer covers the plan — said before what the phase asks for
  const testsStale = pending === "tests" ? testsStaleText(dir, tracks, st.approvals, lng) : null;
  // Re-review now only what can be re-approved now: an artifact of a phase AFTER the first pending gate waits for that gate
  // (approve refuses it on phase-order — next_action looped "re-review tasks.md" → refused → "re-review tasks.md"); the
  // chain reaches it again once the earlier gate is approved.
  const walk = gateWalk(dir, tracks, kind);
  const phaseOfFile = (file) => Object.keys(PHASE_FILE).find((ph) => phaseFile(ph, kind) === file) || (file === "design.md" ? "design" : null);
  const reReviewNow = pending ? changed.filter((file) => { const i = walk.indexOf(phaseOfFile(file)); return i === -1 || i <= walk.indexOf(pending); }) : changed;
  if (reReviewNow.length) {
    step = "re-review";
    // 1.22 review: an approved artifact that is gone can't be re-reviewed nor re-approved (nothing to approve) — restore it, or
    // withdraw its approval (revoke: the phase then waits for a new file, and the Phase 4 gate a test plan opened follows it).
    missingApproved = reReviewNow.filter((file) => !fs.existsSync(path.join(dir, file)));
    const present = reReviewNow.filter((file) => !missingApproved.includes(file));
    recommendation = [present.length ? nx.reReview(present.join(", ")) : null,
      missingApproved.length ? nx.approvedMissing(missingApproved.join(", "), slug, phaseOfFile(missingApproved[0]) || "design") : null].filter(Boolean).join(" ");
    // Never "re-approve" what the approve gate would refuse (an edit added a [NEEDS CLARIFICATION], a placeholder…): it
    // looped re-review → refused → re-review. The first changed phase whose gate fails is named with its failing checks
    // (refusedGate, as the fix step) — fix them, then re-approve.
    for (const ph of walk.filter((p) => reReviewNow.some((file) => phaseOfFile(file) === p))) {
      const g = approvalChecks(projectDir, slug, dir, ph, tracks, kind, lng);
      if (!g.artifact || !g.checks.length) continue;
      refused = g.checks;
      reReviewRefused = ph;
      gateFix = true;
      recommendation += " " + G.fixGate(ph, g.checks.map((c) => c.id + (c.detail ? ` (${c.detail})` : "")).join("; "), slug);
      break;
    }
    // An approval with a snapshot: spec_impact lists what the edit touches (tasks, tests, design) — before re-approving.
    impactPhases = snapshotPhases(dir, st, reReviewNow);
    if (impactPhases.length) recommendation += " " + fm.impact.nextHint(slug, impactPhases);
    const resign = reReviewRoles(projectDir, dir, st, reReviewNow.map(phaseOfFile), kind, slug, lng); // 1.14 B3: each role signs again
    if (resign) recommendation += " " + resign;
  } else if (open) {
    step = "fill";
    const first = open.items.length ? open.items[0].text : "";
    const what = open.state === "missing" ? G.fillMissing : open.empty && !open.items.length ? G.fillEmpty
      : G.fillPlaceholders(open.items.length, `L${open.items[0].line} ${first.length > 48 ? first.slice(0, 47) + "…" : first}`);
    recommendation = G.fill(open.file, what, (G.fillHint[open.file] || G.fillHint.default)(slug));
    // 1.21 F5 P3 — size XS / S (a change's own hint says it already): the whole plan, then one approval call
    if (planFf && kind !== "change") {
      const files = [...new Set([open.file, ...planOpen.map((r) => r.file)])];
      recommendation += " " + (ffEnd === "tasks" ? fm.sizes.planFastForward(slug, size, files.join(", "))
        : fm.sizes.planFastForwardTests(slug, size, files.join(", "), ffEnd, testsWhat));
    }
  } else if (pending && approveMsg[pending] && refused) {
    // Never recommend an approval the approve gate would refuse (it looped: "approve X" → refused → "approve X"…):
    // name what it would fail on instead — classification.md placeholders, missing SC-### / P1 lines…
    step = "fix";
    gateFix = true;
    const ids = refused.map((c) => c.id + (c.detail ? ` (${c.detail})` : "")).join("; ");
    // Phase 4: what its gate refuses on (planned tests not in the test code, the sample eval set) IS the work the phase
    // asks for — name that work (/writeTests), then what the gate checks.
    recommendation = pending === "tests" ? approveMsg.tests(slug) + " " + G.testsGateChecks(refused.map((c) => c.id).join(", ")) : G.fixGate(pending, ids, slug);
    if (testsStale) recommendation = testsStale + " " + recommendation; // 1.22 review: why Phase 4 is asked for again
  } else if (pending && approveMsg[pending]) {
    step = "approve";
    recommendation = approveMsg[pending](slug);
    if (testsStale) recommendation = testsStale + " " + recommendation;
    // 1.14 B3: the roles still to sign off this phase (the role to sign as), and the fast-forward when every gate through tasks passes.
    approveExtras = approveStepExtras(projectDir, slug, dir, st, tracks, kind, pending, doc, lng);
    // Phase 4's own wording says what the phase asks for (the tests / eval harness) — the role step is added to it there.
    if (approveExtras.text) recommendation = pending === "tests" ? recommendation + " " + approveExtras.text : approveExtras.text;
    if (approveExtras.hint) recommendation += " " + approveExtras.hint;
  } else if (fails.length) {
    step = "fix";
    recommendation = nx.fixChecks(fails.map((c) => c.id).join(", "), slug);
  } else {
    const activeText = activeTasks(readIfExists(path.join(dir, "tasks.md")), tracks);
    const tasks = parseTasks(activeText);
    const sch = taskSchedule(taskBlocks(activeText || "")); // 1.14 F3: the next task whose _Depends:_ are all done
    const next = sch.next;
    // Open tasks, none of which can start (a cycle, a _Depends:_ naming no task): fix the dependencies — never "finish".
    const stuck = !next && tasks.some((t) => !t.done);
    step = next ? "implement" : stuck ? "fix" : tasks.length ? "finish" : "tasks";
    recommendation = next
      ? nx.implement(next.number, cleanTaskText(next.text), slug)
      : stuck ? taskDepsBlockedNote(sch, slug, lng) : (tasks.length ? nx.allDone(slug) : nx.breakIntoTasks(slug));
    if (stuck) depsBlocked = sch.blocked.length ? sch.blocked : sch.skipped;
    if (step === "finish") {
      const stale = staleFinish(projectDir, st, activeText || "");
      const fin = isObj(st.finished) && isObj(st.finished.files) ? st.finished : null;
      // The recorded files are hashed whether or not the baseline is stale: a stale baseline (a change request, a
      // re-approval, a new implementing file under a folder _Implements:_ names) still records them, and a re-finish would
      // accept their drift. Skipping the hash when stale hid a changed file behind "finish it again" — adding one more file
      // made the drift warning go away.
      let dr = null;
      if (fin) {
        const root = path.resolve(projectDir);
        dr = baselineDrift(root, realRootOf(root), fin);
        finishedDrift = { finishedAt: typeof fin.at === "string" ? fin.at : null, files: Object.keys(fin.files).length, changed: dr.changed, missing: dr.missing, nowPresent: dr.nowPresent, drifted: dr.drifted };
      }
      if (stale) staleBaseline = stale;
      const day = fin && typeof fin.at === "string" ? fin.at.slice(0, 10) : "?";
      // Every task ticked, but not every tick verified: spec_finish and the execution sign-off refuse on exactly these
      // (verificationStatus) — never "close the feature" / "finished, nothing left to do" while a latest run failed or a
      // runnable _Verify:_ was never run (that looped: next_action → /spec-finish → refused → next_action …).
      const vs = verificationStatus(projectDir, slug, dir);
      const suiteGap = fin && !vs.unverified.length ? suiteStatus(projectDir, st, dir).missing : [];
      if (vs.unverified.length) {
        step = "verify";
        const n = vs.unverified[0];
        const blk = taskBlocks(activeText || "").find((b) => b.number === n && b.done);
        const runnable = !!blk && taskMarkers(blk).verify.some((c) => !/^\[.*\]$/.test(c.trim())); // what `done --run` would run
        const detail = (vs.unverifiedDetail || []).find((d) => d.number === n);
        // A number two tasks share: `done N` resolves to the first open "N." (or answers alreadyDone), so no re-run can
        // ever verify the other one — it looped "re-run task N" forever. The way out is renumbering (doctor: duplicate-tasks).
        if (detail && detail.reason === "duplicate-number") recommendation = nx.verifyDuplicate(slug, unverifiedLabel(vs, lng), n);
        else {
          recommendation = nx.verify(slug, unverifiedLabel(vs, lng), n, runnable);
          if (detail && detail.reason === "unobserved") recommendation += " " + i18n.msg(lng).observed.naHint; // 1.14 F1 (meta.evidence "observed")
          // A red-phase task can't pass its own must-pass _Verify:_: re-running it is no way out — say how to fix the task.
          const red = redPhaseHint(blk, slug, lng);
          if (red) recommendation += " " + red;
          if (expectsFail(blk)) recommendation += " " + i18n.msg(lng).redGreen.naVerify(n, slug); // B5: its proof is a FAILING run, not a passing one
        }
      } else if (dr && dr.drifted) {
        // Drift since the finish → decide (change-management §7) before any re-baseline — a stale baseline included: it
        // also needs finishing again, after that decision.
        step = "drift";
        recommendation = nx.drifted(slug, day, dr.changed.length + dr.missing.length + dr.nowPresent.length, finishedDrift.files, [...dr.changed, ...dr.missing, ...dr.nowPresent].slice(0, 5).join(", "));
        if (stale) recommendation += " " + nx.driftedStale(staleFinishText(stale, lng));
      } else if (stale) {
        // Finished once, then changed (a change request, a re-approval, a new implementing file) and done again: finish it
        // AGAIN — a fresh readiness report, merge summary and baseline — then the execution sign-off again. step stays
        // "finish"; staleBaseline says why.
        recommendation = nx.refinish(slug, stale.finishedAt ? stale.finishedAt.slice(0, 10) : "?", staleFinishText(stale, lng));
      } else if (fin && suiteGap.length) {
        // Finished, but a project check (meta.checks) has no passing run since the last task activity (a task re-run after
        // the finish, a check whose command changed…): spec_finish refuses on it, doctor warns, the stop gate sends a "done"
        // back — never "finished — nothing left to do". Any status but pass counts (suiteStatus().missing).
        step = "verify";
        suiteMissing = suiteGap.map((i) => ({ name: i.name, status: i.status }));
        recommendation = nx.verifySuite(slug, suiteLabel(suiteGap, lng));
      } else if (fin) {
        // Already finished (spec_finish {write} recorded the baseline): not "close the feature" again. The sign-off, if
        // the execution phase isn't approved yet (or its approval predates a change), or nothing left to do.
        step = "finished";
        // No execution approval → sign it off; one that predates a later change (an upgraded feature's new tests sign-off,
        // a change request) → re-confirm it, naming what came after — never "missing" when it exists.
        const exAt = isRecord(approvals.execution) && typeof approvals.execution.at === "string" ? approvals.execution.at : null;
        const signOff = !approvals.execution ? {} : executionSignOffStale(st) ? { at: exAt ? exAt.slice(0, 10) : "?", why: signOffWhyText(st, lng) } : null;
        // With roadmap.json meta.approvalRoles.execution the sign-off is per role (a role-less /approve is refused): name
        // the roles still missing and the one to sign as. A stale sign-off is renewed by any role's new sign-off.
        const exRoles = approvalRolesOf(projectDir).execution || [];
        if (signOff && exRoles.length) {
          if (!approvals.execution) {
            const v = roleSignOffs(st, "execution", exRoles, phaseContent(dir, "execution", kind));
            const all = !v.missing.length && v.signed.length > 0; // 1.21 review A1: every role signed, no approval — one re-signs
            finishedRoles = all ? null : v.missing;
            if (all) finishedComplete = true;
            Object.assign(signOff, { role: v.missing[0] || v.signed[0] || exRoles[0], missing: all ? fm.governance.signedAll(v.signed.join(", ")) : v.missing.length ? fm.governance.missing(v.missing) : null,
              signed: all ? "" : v.signed.join(", ") });
          } else signOff.role = exRoles[0];
        }
        recommendation = nx.finished(slug, day, finishedDrift.files, signOff);
      }
      // full review Ga8: with project checks configured (meta.checks), a plain /spec-finish is refused until each has a passing
      // run since the last task activity (or on the code as it is now: Ga3's code-changed) — say how to run and record them
      // (dev-spec finish <f> --run / spec_finish {evidence}); also on `drift`, whose "harmless → re-finish" needs that run.
      if ((step === "finish" || step === "drift") && !st.invalid) {
        const suite = suiteStatus(projectDir, st, dir);
        if (suite.missing.length) recommendation += " " + i18n.msg(lng).projectChecks.naFinish(slug, suiteLabel(suite.missing, lng));
      }
    }
  }

  const res = { ok: true, feature: slug, tracks: trackLabel(tracks), phase, verdict: doc.verdict,
    gatesOk: doc.gatesOk, pendingGates: doc.pendingGates || [], changedSinceApproval: changed, step, recommendation };
  if (finishedDrift) res.drift = finishedDrift; // stable: {finishedAt, files, changed, missing, nowPresent, drifted}
  if (staleBaseline) res.staleBaseline = staleBaseline; // stable: {finishedAt, since: [{kind, n | phase, at}], newFiles}
  if (open) res.file = open.file;
  if (gateFix) res.refusedGate = { phase: reReviewRefused || pending, failing: refused.map((c) => c.id) }; // stable ids to branch on
  if (finishedRoles) res.missingRoles = finishedRoles; // the execution sign-off's roles still to sign (finished step)
  if (suiteMissing) res.suite = suiteMissing; // stable: [{name, status}] — the project checks the verify step asks to run
  if (depsBlocked) res.blocked = depsBlocked; // 1.14 F3: stable — the open tasks and the dependencies each waits on
  if (impactPhases.length) res.impact = { tool: "spec_impact", phases: impactPhases }; // what to run before re-approval
  if (missingApproved.length) res.missingApproved = missingApproved; // 1.22 review: stable — approved artifacts that no longer exist
  if (approveExtras && approveExtras.missingRoles) res.missingRoles = approveExtras.missingRoles; // 1.14 B3: stable — the roles to sign
  if ((approveExtras && approveExtras.signoffsComplete) || finishedComplete) res.signoffsComplete = true; // 1.21 review A1: stable — every role signed, one re-signs to approve
  if (approveExtras && approveExtras.fastForward) res.fastForward = approveExtras.fastForward; // 1.14 B3: {through, phases, role}
  // 1.21 F5 P3: size XS / S — the one approval call the plan ends with, named from the start (the fill step)
  if (!res.fastForward && planFf && pending && step === "fill" && walk.includes(ffEnd)) {
    res.fastForward = { through: ffEnd, phases: walk.slice(walk.indexOf(pending), walk.indexOf(ffEnd) + 1).filter((ph) => !approvals[ph]), role: null };
  }
  // 1.16 Q1: steering amended after the requirements / design approval — a re-review hint added to whatever the step is, never a
  // step (or a block) of its own; re-approving the phase records the current steering.
  if (Array.isArray(doc.steeringChanged) && doc.steeringChanged.length) {
    res.steeringChanged = doc.steeringChanged;
    res.recommendation += " " + fm.quality.naSteering(doc.steeringChanged.map((c) => c.phase).join(", "),
      [...new Set(doc.steeringChanged.flatMap((c) => c.files.map((x) => x.file)))].join(", "), slug);
  }
  if (flow === "design-first") { // C3: stable `flow`; the order is named while the design / requirements gates are the open ones
    res.flow = flow;
    if (["fill", "fix", "approve"].includes(step) && (pending === "design" || pending === "requirements")) res.recommendation += " " + fm.flow.nextNote(flowOrderText(dir, tracks, flow));
  }
  return res;
}

// ---------------------------------------------------------------------------
// spec_doctor — one health-check that decides "ready to advance?"
// ---------------------------------------------------------------------------

// opts.scan: a scanTestCode() result to reuse for the tests-in-code check (spec_finish walks the project once). opts.lean: the
// caller reads only the failing checks and the verdict — the warn-only cross-feature-acs check is skipped once the verdict is
// already warn / fail (1.16 Q review).
function specDoctor(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  if (isSpikeDir(f.dir)) return spikeDoctor(projectDir, f); // 1.14 C2
  const { slug, dir, root } = f;
  const tracks = detectTracks(dir);
  const lng = featureLang(projectDir, name);
  const fm = i18n.msg(lng);
  const m = fm.doctor; // localized detail strings
  const G = fm.gates;
  const sectionLabel = (s) => `${fm.sectionNames[s.section] || s.section}:${fm.sectionStatus[s.status] || s.status}`;
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });

  // Steering
  const steeringDir = path.join(root, "steering");
  const coreSteering = ["constitution.md", "product.md", "tech.md", "structure.md"];
  const missingSteering = coreSteering.filter((f) => !fs.existsSync(path.join(steeringDir, f)));
  // Present is not enough: a steering file that is still its template steers nothing (named, with its count).
  const stubSteering = steeringPlaceholders(root);
  const steeringIssues = [missingSteering.length ? m.steeringMissing(missingSteering.join(", ")) : null,
    stubSteering.length ? fm.scopedSteering.placeholders(stubSteering.map((s) => s.file + (s.placeholders ? ` (${s.placeholders})` : "")).join(", ")) : null].filter(Boolean);
  add("steering", steeringIssues.length ? "warn" : "pass", steeringIssues.join("; ") || m.steeringOk);
  // 1.16 Q3 — the glossary (.specs/steering/glossary.md): words it says to avoid used in requirements.md / design.md — a warn
  // with the count (spec_clarify asks about each). Only when the glossary lists an avoided word: no glossary, no check.
  const gloss = glossaryEntries(root);
  if (gloss && (gloss.truncated || gloss.entries.some((e) => e.avoid.length))) {
    const Q = fm.quality;
    const gh = glossaryHits(dir, gloss, { projectDir, lang: lng });
    const items = gh.slice(0, 6).map((h) => Q.glossaryItem(h.word, h.term, h.locations.join(", ")));
    if (gh.length > 6) items.push(Q.xacMore(gh.length - 6));
    // Past GLOSSARY_MAX_ENTRIES the rest of the glossary is never read — said, never silent (a warn).
    const cut = gloss.truncated ? Q.glossaryTruncated(gloss.entries.length, gloss.total) : null;
    add("glossary", gh.length || cut ? "warn" : "pass", [gh.length ? Q.glossaryDoctor(gh.reduce((a, h) => a + h.count, 0), items.join("; ")) : cut ? null : Q.glossaryOk(gloss.entries.length), cut].filter(Boolean).join("; "));
  }

  // Requirements + EARS
  const reqsFull = readIfExists(path.join(dir, "requirements.md"));
  const isChange = isChangeDir(dir);
  // 1.21 review C1: a change's criteria are its change.md WITHOUT the task blocks (a task's _Requirements:_ defines nothing)
  const reqs = reqsFull != null && isChange ? changeViews(reqsFull).criteria : reqsFull;
  if (reqs == null) add("requirements", "fail", m.requirementsMissing);
  else {
    const e = earsValidate(reqs, featureLang(projectDir, slug));
    const nErr = e.issues ? e.issues.filter((i) => i.severity === "error").length : 0;
    const nCrit = e.summary ? e.summary.criteriaDetected : 0;
    // Zero criteria is not a pass — an empty requirements.md must not read as "EARS clean". And requirements.md whose AC
    // IDs trace_check counts while EARS linted none of them fails (1.14 full review Pa2): nothing was checked.
    // The mirror (1.22 review): criteria linted, but no AC ID trace_check reads (bare AC-1 IDs, or none) — it traced 0 ACs.
    const unlinted = earsUnlinted(reqs, e);
    const unidentified = unlinted ? null : earsUnidentified(reqs, e);
    const file = isChange ? CHANGE_FILE : undefined;
    add("ears", nErr || unlinted || unidentified ? "fail" : nCrit === 0 ? "warn" : "pass",
      unlinted ? m.earsNoCriteria(unlinted, file) : unidentified ? m.earsNoAcIds(shortIdList(unidentified), file)
        : m.earsDetail(nCrit, nErr, e.issues ? e.issues.filter((i) => i.severity === "warn").length : 0));
    // Clarifications gate — design is blocked while any [NEEDS CLARIFICATION] remains.
    const markers = clarificationMarkers(reqsFull);
    add("clarifications", markers.length ? "fail" : "pass", markers.length ? (isChange ? m.clarificationsOpenPlan : m.clarificationsOpen)(markers.length) : m.clarificationsNone); // a change has no design (1.21 verify V7)
    // Spec-Kit-style structure — only REAL lines count: the template's P1 legend and placeholder SC-001 don't. (1.21 F5: a change
    // — one change.md, 1–3 criteria — has no stories to prioritize nor success criteria of its own: its scope check instead.)
    const reqsActive = activeDesign(reqs, tracks);
    if (!isChange) {
      add("success-criteria", hasSuccessCriteria(reqsActive) ? "pass" : "warn", hasSuccessCriteria(reqsActive) ? m.scPresent : m.scMissing);
      add("priorities", hasPriority(reqsActive) ? "pass" : "warn", hasPriority(reqsActive) ? m.prioritiesOk : m.prioritiesMissing);
    } else {
      const sc = changeScope(dir, tracks, lng);
      add("change-scope", sc.ok ? "pass" : "fail", sc.detail);
    }
    // Folded analyze: AC ID uniqueness (duplicate IDs = a real spec bug)
    const dups = acDuplicates(reqs);
    add("ac-uniqueness", dups.length ? "fail" : "pass", dups.length ? m.acDup(dups.join(", ")) : m.acUnique);
  }

  // Bugfix (systematic debugging): bug.md replaces design.md, and the root cause gates the fix.
  const kind = readState(projectDir, slug).kind || "feature";
  if (kind === "bugfix") {
    const bug = readIfExists(path.join(dir, "bug.md")) || "";
    const filled = (syn) => bugSectionFilled(bug, syn); // a bug-report slot left in the section is not filled either (quoted [evidence] is)
    add("reproduction", filled(REPRO_SYN) ? "pass" : "warn", filled(REPRO_SYN) ? m.reproOk : m.reproMissing);
    add("root-cause", filled(ROOT_CAUSE_SYN) ? "pass" : "fail", filled(ROOT_CAUSE_SYN) ? m.rootCauseOk : m.rootCauseMissing);
  }

  // Template placeholders: the current phase's artifact and every earlier one must be real content — an untouched
  // scaffold used to pass with readyToAdvance=true. A later phase's template is informational (warn) only.
  const phase = detectPhase(dir, tracks);
  const ph = chainPlaceholders(dir, tracks, kind, phase);
  add("placeholders", ph.blocking.length ? "fail" : ph.later.length ? "warn" : "pass",
    ph.blocking.length ? G.placeholdersFail(placeholderSummary(ph.blocking, lng))
      : ph.later.length ? G.placeholdersLater(ph.later.map((r) => `${r.file} (${r.items.length || G.empty})`).join(", ")) : G.placeholdersNone);
  // C3: design-first — while requirements.md is still a LATER phase's template (the design is being written), its own checks
  // (EARS, open questions, duplicate IDs) inform instead of failing the design; they gate the requirements approval as ever.
  if (ph.later.some((r) => r.file === "requirements.md")) {
    for (const c of checks) if (c.status === "fail" && ["ears", "clarifications", "ac-uniqueness"].includes(c.id)) Object.assign(c, { status: "warn", detail: fm.flow.laterPhase(c.detail) });
  }

  // Design + Mermaid + Constitution Check
  const design = readIfExists(path.join(dir, "design.md"));
  if (design == null) { if (kind !== "bugfix" && kind !== "change") add("design", "fail", m.designMissing); } // 1.21 F5: a change has no design
  else if (kind !== "bugfix") {
    add("mermaid", /```mermaid/.test(design) ? "pass" : "warn", /```mermaid/.test(design) ? m.mermaidOk : m.mermaidMissing);
    add("constitution-check", RE_CONSTITUTION_CHECK.test(design) ? "pass" : "warn", RE_CONSTITUTION_CHECK.test(design) ? m.constitutionOk : m.constitutionMissing);
    // 1.17 A1 — design-tradeoffs / design-risks, 1.19 R1 — design-reuse: warns only (never a fail, never an approval check).
    // Not while design.md is still a LATER phase's template (nothing is being designed yet — the placeholders check already says
    // so). A design approved before a check existed (its approval lacks that check's stamp — `weigh` 1.17, `reuse` 1.19) is
    // never flagged by it: a pass with a note (A review 3). A brownfield feature's filled integration-plan.md → Integration
    // Points answers a missing / empty Reuse & Integration section.
    if (!ph.later.some((r) => r.file === "design.md")) {
      const approvals = readState(projectDir, slug).approvals;
      const opts = { approval: approvals && approvals.design, integrationPlan: readIfExists(path.join(dir, "integration-plan.md")) };
      for (const c of designWeighChecks(activeDesign(design, tracks), lng, opts)) add(c.id, c.status, c.detail);
    }
  }

  // Mandatory sections — `<track>-sections` per active marker track (saas, ai, sec, privacy).
  const allFilled = { saas: m.saasAllFilled, ai: m.aiAllFilled, ...fm.secPrivacy.allFilled };
  if (design != null) {
    // 1.21 F5 — the size's rules (tiers, overlaps) and the stricter filled rule: a section holding nothing but the template's
    // guidance lines fails — a WARN on a design approved already (never a phase failed retroactively; its next approval asks).
    const size = featureSize(dir);
    const dApproval = readState(projectDir, slug).approvals.design;
    const approved = isRecord(dApproval);
    for (const [tr, mark, rows] of trackSectionReport(design, tracks, { size, lang: lng })) {
      const bad = rows.filter((s) => sectionVerdict(s, { size, approved }) === "fail");
      const soft = rows.filter((s) => sectionVerdict(s, { size, approved }) === "warn");
      const S = fm.sizes;
      const okText = Object.prototype.hasOwnProperty.call(allFilled, tr) ? allFilled[tr] : fm.trackPacks.allFilled(mark); // a track pack's (1.15)
      const sizedText = size ? S.sectionsPassSized(rows.filter((s) => s.status === "filled" || s.status === "na").length, rows.filter((s) => s.status === "covered").length,
        rows.filter((s) => s.status === "missing").length) : null;
      add(tr + "-sections", bad.length ? "fail" : soft.length ? "warn" : "pass", bad.length ? bad.map(sectionLabel).join("; ")
        : soft.length ? S.templateApproved(soft.map(sectionLabel).join("; ")) : sizedText || okText);
    }
  }
  // 1.15: a saved track pack the project no longer has (its folder deleted, or the pack now invalid) — the track is inactive.
  const missingPacks = missingPackTracks(dir);
  if (missingPacks.length) {
    const reg = packRegistry();
    const st = readJson(statePath(dir)).data;
    add("track-pack-missing", "warn", fm.trackPacks.missing(missingPacks.map((n) => {
      // 1.17 D review: a pre-1.17 pack whose name is reserved now — why, and the way out (for 'dist': the built-in track is NOT on)
      if (legacyPackName(st, n)) return fm.trackPacks.missingReserved(n, slug, VALID_TRACKS.includes(n), packReservedSince(n));
      // 1.19 T review: a pack whose marker is a built-in track's now ('webui' with [UI]) — why, and the two ways out
      const bt = legacyPackMarkerTrack(st, n);
      if (bt) return fm.trackPacks.missingReservedMarker(n, st.packMarkers[n], bt, slug, packReservedSince(bt));
      const e = reg.entries.find((x) => x.name === n);
      return e ? fm.trackPacks.missingInvalid(n, [...new Set(reg.problems.filter((x) => x.pack === n && x.severity === "error").map((x) => x.code))].join(", ") || "invalid")
        : fm.trackPacks.missingAbsent(n);
    }).join("; ")));
  }

  // tdd: test plan + eval plan presence
  if (tracks.includes("tdd")) add("test-plan", fs.existsSync(path.join(dir, "test-plan.md")) ? "pass" : "warn", "");
  if (tracks.includes("ai")) add("eval-plan", fs.existsSync(path.join(dir, "eval-plan.md")) ? "pass" : "warn", "");

  // Traceability. Done tasks that claim `_Makes green:_` T-IDs (+tdd active) → the test code is scanned too (once per call).
  const greenDone = new Set();
  for (const b of tracks.includes("tdd") ? taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks)) : []) {
    if (b.done) for (const id of extractTestIds(taskMarkers(b)["makes green"].join(" "))) greenDone.add(id);
  }
  const tr = traceCheck(projectDir, name, greenDone.size ? { code: true, scan: opts.scan } : {});
  if (tr.ok) {
    // Name every failing kind with its IDs (the old counters read "=0" for kinds they didn't count).
    // Scoped like the placeholders check: a LATER phase's artifact that is still its template (tasks.md / test-plan.md
    // at the requirements or design gate) is not traced yet — its template rows (_Requirements: US-1.AC-3…_, T-04 →
    // US-1.AC-4) are no typos and no gap of the phase being judged. The gap kinds that read it are deferred (a warn).
    const laterFiles = ph.later.map((r) => r.file);
    const deferKinds = new Set([
      ...(laterFiles.includes("tasks.md") ? TRACE_TASK_KINDS : []),
      ...(laterFiles.includes("test-plan.md") ? TRACE_PLAN_KINDS : []),
      // C3: design-first — requirements.md is a LATER phase's template at the design gate: its template ACs are no gap yet
      // (the checks involving the requirements run once they are written).
      ...(laterFiles.includes("requirements.md") ? [...TRACE_TASK_KINDS, ...TRACE_PLAN_KINDS, "unidentifiedCriteria"].filter((k) => k !== "missingImplFiles") : []),
    ]);
    const kept = Object.fromEntries(Object.entries(tr).filter(([k]) => !deferKinds.has(k)));
    const gapLines = traceGapLines(kept, lng);
    // The verdict's own kinds decide fail (testsNotMappedToTasks is listed, never failing — trace_check's verdict rule).
    const failing = traceGaps(kept).some((g) => TRACE_VERDICT_KINDS.has(g.kind));
    const deferred = traceGaps(tr).some((g) => deferKinds.has(g.kind) && TRACE_VERDICT_KINDS.has(g.kind));
    const deferredFiles = laterFiles.filter((x) => x === "tasks.md" || x === "test-plan.md" || x === "requirements.md").join(", "); // C3: + requirements.md (design-first)
    if (failing) add("traceability", "fail", gapLines.join("; "));
    else if (deferred) add("traceability", "warn", [G.traceDeferred(deferredFiles), ...gapLines].join("; "));
    else add("traceability", "pass", [fm.traceGapText.allCovered(tr.totalAcs), ...gapLines].join("; "));
    // Secondary IDs (EC / NFR / SC): a warn, never a fail — only when requirements.md defines or the chain cites one.
    const D = fm.deepTrace;
    const secLines = traceWarningLines(tr, lng, TRACE_SECONDARY_KINDS);
    const secDefined = secondaryDefinitions(criteriaText(dir) || "").defined.size;
    if (secLines.length || secDefined) add("secondary-trace", secLines.length ? "warn" : "pass", secLines.length ? secLines.join("; ") : D.secondaryOk(secDefined));
    // `_Supersedes:_` references that resolve to nothing (a typo, a removed feature): trace_check's warnings, surfaced
    // here too — until fixed, the living catalog shows the AC they meant to replace as current. Never a fail.
    const supLines = supersedesWarnings(tr, lng);
    if (supLines.length) add("supersedes", "warn", supLines.join("; "));
    // T-IDs made green by DONE tasks must be named by some test file (planned ones only — a phantom T-ID is a trace
    // gap already). Open tasks' tests may legitimately not exist yet.
    if (tr.code) {
      const key = (id) => tKey(id.slice(2)); // T-1 in a task names T-01 in the plan
      const planKeys = new Set([...extractTestIds(planIdText(readIfExists(path.join(dir, "test-plan.md")) || ""))].map(key));
      const notInCode = new Set(tr.code.plannedNotInCode.map(key));
      const outsideCode = new Set(tr.code.plannedOutsideCode.map(key)); // a load run / eval set: its own evidence, no test file
      const claimed = [...greenDone].filter((id) => planKeys.has(key(id)) && !outsideCode.has(key(id)));
      const missing = claimed.filter((id) => notInCode.has(key(id)));
      const tail = tr.code.truncated ? " (" + D.truncated + ")" : "";
      if (claimed.length) add("tests-in-code", missing.length ? "warn" : "pass", (missing.length ? D.testsInCodeMissing(missing.join(", ")) : D.testsInCodeOk(claimed.length)) + tail);
    }
  }

  // Verification evidence: ticked tasks without a passing run (a _Verify:_ command that was never run,
  // only noted, or whose latest run failed).
  const vs = verificationStatus(projectDir, slug, dir);
  if (vs.withVerify || Object.keys(vs.evidence).length) {
    add("verification", vs.unverified.length ? "warn" : "pass", vs.unverified.length ? m.unverified(unverifiedLabel(vs, featureLang(projectDir, slug))) : m.verifiedOk);
  }
  // B5 (warns): red-green — T-IDs made green with no recorded red run of an _Expect: fail_ task; suite-evidence — the project
  // checks (meta.checks) without a passing run since the last task activity, once every task is done (finish blocks on it).
  for (const c of b5DoctorChecks(projectDir, slug, dir, tracks, lng)) add(c.id, c.status, c.detail);
  // Duplicated task numbers: complete/brief resolve to the first OPEN one, but humans read them as one task.
  const dupTasks = duplicateTaskNumbers(taskBlocks(readIfExists(path.join(dir, "tasks.md")) || ""));
  if (dupTasks.length) add("duplicate-tasks", "warn", fm.evidenceGate.duplicateTasks(dupTasks.map((n) => "#" + n).join(", ")));
  // 1.22 review — checkbox lines the task scanner doesn't read (`1. [ ] text`, an unnumbered `- [ ] text` outside a task): never
  // ticked, briefed or verified — a tasks.md written that way read as zero tasks, silently. A warn naming the lines.
  const unread = unreadTasksDetail(readIfExists(path.join(dir, "tasks.md")) || "");
  if (unread) add("unread-tasks", "warn", fm.markerSyntax.unreadTasks(unread));
  // 1.14 F3 — `_Depends:_` that name no (active) task, a task depending on itself, a cycle: a fail (the tasks approval refuses
  // on it) — only when some task declares _Depends:_. Active tasks only (a removed track's tasks are inactive).
  const depsCheck = taskDepsCheck(taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || ""), lng);
  if (depsCheck) add("task-deps", depsCheck.status, depsCheck.detail);
  // A _Verify:_ that pipes into another command (`npm test | tee log`) reports the pipeline's LAST exit code: a failing
  // check exits 0 and its run reads as verified. Active tasks only (a removed track's tasks are inactive).
  const pipeTasks = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || "")
    .map((b) => ({ number: b.number, cmds: verifyPipes(b) })).filter((p) => p.cmds.length);
  if (pipeTasks.length) add("verify-pipes", "warn", fm.verifyPipe.doctor(pipeTasks.map((p) => "#" + p.number + " " + p.cmds.map((c) => "`" + c + "`").join(", ")).join("; ")));
  // 1.14 full review Pa1 — marker-shaped text that yields no marker (`**Verify:** npm test`, `Verify: npm test`): the tools
  // read nothing there — no check runs, no file is traced. Active tasks only; a warn.
  const oddMarkers = malformedMarkers(taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || ""));
  if (oddMarkers.length) add("malformed-markers", "warn", fm.markerSyntax.doctor(oddMarkers.map((o) => "#" + o.number + " (" + o.labels.map((l) => l + ":").join(", ") + ")").join("; ")));
  // 1.14 full review Pa6 — a test planned outside test code (load-test.md, evals/*.json) whose artifact is still the
  // scaffold, once that test is due (a done task makes it green, or every task is done). A warn; spec_finish repeats it.
  const ocTemplates = outsideCodeTemplates(projectDir, dir, tracks, greenDone);
  if (ocTemplates.length) add("outside-code-artifacts", "warn", fm.outsideCode.doctor(ocTemplates.map((o) => o.id + " → " + o.file).join(", ")));
  // 1.14 B4 — cross-feature file overlap (featureOverlaps): this feature's open tasks plan files another active feature's open
  // tasks plan too, or files a finished feature recorded in its drift baseline — a warn, only when there is one.
  // 1.22 review: a pair of `slug` needs one of its OPEN active tasks to plan a file (_Implements:_) — without one, the whole
  // roadmap walk (every feature's tasks, the finished baselines) could only answer "none": skipped, the result the same.
  const plansFiles = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || "").some((b) => !b.done && taskMarkers(b).implements.length > 0);
  const overlapPairs = plansFiles ? featureOverlaps(projectDir, undefined, { only: slug }).pairs : [];
  if (overlapPairs.length) add("cross-feature-overlap", "warn", overlapDoctorDetail(overlapPairs, slug, lng));
  // 1.16 Q2 — cross-feature acceptance criteria: this feature's criteria that read like another active feature's (near-duplicate)
  // or may contradict them (same trigger, SHALL vs SHALL NOT or different numbers) — a warn, only when there is a pair. Computed
  // last and put back here (xacAt): a caller that reads only the failing checks and the verdict (opts.lean — next_action's and
  // spec_finish's own doctor) skips it once another check already warns or fails — the verdict can't change.
  const xacAt = checks.length;

  // Brownfield: an integration plan that is still the template (only when the feature has one).
  const planFile = path.join(dir, "integration-plan.md");
  if (fs.existsSync(planFile)) {
    const planFilled = artifactState({ file: planFile }) === "filled";
    add("integration-plan", planFilled ? "pass" : "warn", planFilled ? fm.brownfield.integrationPlanOk : fm.brownfield.integrationPlanPlaceholder);
  }

  // Approval gates — a real gate, not advice: any artifact that exists but whose phase
  // has not been approved is flagged (warn, so quality fails still dominate the verdict).
  const state = readState(projectDir, name);
  const approvals = state.approvals || {};
  // In the chain's order (PHASES). A phase is pending once the artifact it signs off exists — phaseFile(), so a
  // bugfix's design gate is due on bug.md (its Root Cause) — or, for `tests` (Phase 4, no artifact), once
  // testsGateDue() says the plan it implements exists.
  const pendingGates = pendingGateList(dir, tracks, kind, approvals);
  // A forced approval (approve --force over failing checks) is recorded, but it stays visible here as a warn.
  const forcedGates = PHASES.filter((ph) => phaseActive(ph, tracks) && approvals[ph] && approvals[ph].forced);
  // The first pending gate — the one next_action recommends — run through the approve gate itself, which is stricter
  // than these checks (success criteria / priorities are warns here, classification.md isn't in the chain). Surfaced
  // so doctor, next_action and approve agree instead of next_action recommending an approval approve refuses.
  let nextGate = null;
  // 1.14 B3 — approvals by role: the roles each pending phase still waits for (named in the list), stale / missing sign-offs.
  // The execution sign-off joins them once a finish is recorded (spec_finish {write}) and it isn't approved yet — only for the
  // roles view (pendingRoles, the approval-gates line): pendingGates stays the planning chain, which spec_finish's blockers read
  // (the sign-off comes after the finish, never a blocker of it).
  const execDue = !approvals.execution && isRecord(state.finished);
  // (1.22 review: a stale Phase 4 sign-off lends no role a current sign-off — the view reads the approvals in force)
  const inForce = approvalsInForce(dir, tracks, approvals);
  const rv = roleGateView(projectDir, dir, inForce === approvals ? state : Object.assign({}, state, { approvals: inForce }), execDue ? pendingGates.concat("execution") : pendingGates, tracks, kind, lng);
  const testsStale = inForce === approvals ? null : testsStaleText(dir, tracks, approvals, lng); // 1.22 review: why `tests` is pending again
  const shownPending = rv.pending.execution ? pendingGates.concat("execution") : pendingGates;
  if (pendingGates.length) {
    const g = approvalChecks(projectDir, slug, dir, pendingGates[0], tracks, kind, lng);
    nextGate = { phase: pendingGates[0], ready: g.artifact && !g.checks.length, failing: g.checks };
    if (rv.pending[pendingGates[0]]) nextGate.missingRoles = rv.pending[pendingGates[0]].missing;
    if (rv.pending[pendingGates[0]] && rv.pending[pendingGates[0]].signoffsComplete) nextGate.signoffsComplete = true; // 1.21 review A1: re-sign to complete
  }
  // Artifacts edited after THEIR approval (next_action / finish / roadmap's view): re-review, then re-approve —
  // spec_impact lists what the edit touches when the approval has a snapshot.
  const changedArts = changedSinceApproval(dir, approvals, tracks, kind);
  if (changedArts.length) {
    // One `impact --phase` command per phase with a snapshot (the CLI defaults to requirements) — next_action's hint.
    const impactPhases = snapshotPhases(dir, state, changedArts);
    add("changed-since-approval", "warn", impactPhases.length
      ? fm.impact.doctorChanged(changedArts.join(", "), slug, impactPhases) : fm.impact.doctorChangedPlain(changedArts.join(", "), slug));
  }
  // 1.16 Q1 — a steering file that governed the requirements / design approval changed (or was removed) since: re-review, then
  // re-approve (which records the current steering). A warn; approvals made before 1.16 (no steering fingerprints) never.
  const steeringChanged = steeringChanges(root, approvals, dir, tracks);
  if (steeringChanged.length) add("steering-changed-since-approval", "warn", fm.quality.steeringDoctor(steeringChangeText(steeringChanged, lng), slug));
  add("approval-gates", shownPending.length || forcedGates.length || rv.notes.length ? "warn" : "pass",
    [shownPending.length ? m.gatesPending(shownPending.map(rv.label).join(", ")) : null,
      nextGate && nextGate.failing.length ? G.gateWouldRefuse(nextGate.phase, nextGate.failing.map((c) => c.id).join(", ")) : null,
      forcedGates.length ? G.forcedGates(forcedGates.map((p) => p + (Array.isArray(approvals[p].failing) && approvals[p].failing.length ? ` (${approvals[p].failing.join(", ")})` : "")).join(", ")) : null,
      testsStale, ...rv.notes]
      .filter(Boolean).join("; ") || m.gatesOk);
  for (const c of decisionDoctorChecks(projectDir, slug, dir, state, kind, lng, tr)) add(c.id, c.status, c.detail); // 1.14 C2 (warns)
  const wExp = waiverExpiredCheck(approvals, tracks, slug, lng); // 1.16 U3: a forced approval whose waiver expired
  if (wExp) add(wExp.id, wExp.status, wExp.detail);
  const mc = mergeConflictsCheck(projectDir, slug, state, lng); // 1.21 F1a: conflicts the merge driver left unresolved (a fail)
  if (mc) add(mc.id, mc.status, mc.detail);
  const gatesOk = pendingGates.length === 0;
  if (kind === "feature" && !(opts.lean && checks.some((c) => c.status !== "pass"))) {
    const xac = crossFeatureAcs(projectDir, { only: slug }).pairs;
    if (xac.length) checks.splice(xacAt, 0, { id: "cross-feature-acs", status: "warn", detail: crossAcDoctorDetail(xac, slug, lng) });
  }

  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const verdict = fails.length ? "fail" : warns.length ? "warn" : "pass";
  const res = {
    ok: true,
    feature: slug,
    tracks: trackLabel(tracks),
    phase,
    approvals,
    pendingGates,
    forcedGates,
    nextGate,
    gatesOk,
    checks,
    summary: { pass: checks.filter((c) => c.status === "pass").length, warn: warns.length, fail: fails.length },
    readyToAdvance: fails.length === 0,
    verdict,
  };
  // 1.14 B3 (only when the project has approval roles): {phase: {required, signed, missing, stale}} per pending phase that
  // needs roles, and {phase: [roles]} per approved phase lacking a role now required.
  if (rv.any) Object.assign(res, { pendingRoles: rv.pending, unsignedRoles: rv.unsigned });
  if (featureFlow(dir, kind) === "design-first") res.flow = "design-first"; // C3 (only then: the default flow's result is unchanged)
  if (steeringChanged.length) res.steeringChanged = steeringChanged; // 1.16 Q1 (stable): [{phase, approvedAt, files: [{file, change}]}]
  return res;
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
          const head = readFileHead(abs, SCAN_READ_BYTES); // the first SCAN_READ_BYTES characters, one bounded read (1.21.1 review)
          if (head != null) {
            keys = new Set();
            for (const m of head.matchAll(RE_CODE_TID)) keys.add(tKey(m[1] || m[2] || m[3]));
          }
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
  const approvals = approvalsInForce(f.dir, f.tracks, isObj(st.approvals) ? st.approvals : {}); // 1.22 review: a stale tests sign-off is pending
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

module.exports = { designSaveCheck, userOptionRaw, boolWord, userDefaults, newProjectLang, userDefaultsApplied,
  seedProjectLang, listFeatures, statusFeature, nextAction, specDoctor, STATUS_MAX_FEATURES, STATUS_MAX_UP,
  STATUS_TEST_FILES, STATUS_DOCTOR_WARNS, isDevSpecDir, statusLineProject, statusActivity, statusTestsGate, statusNext,
  statusLine, planBridge, __link };

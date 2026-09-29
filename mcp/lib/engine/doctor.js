"use strict";

/**
 * dev-spec-driven engine — spec_doctor and spec_next_action.
 * The one health check that decides "ready to advance?", "you are here → do this next", and the design.md save check.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acDuplicates, activeDesign, activeSectionTracks, activeTasks, approvalChecks, approvalRolesOf, approveStepExtras,
  artifactReport, artifactState, b5DoctorChecks, baselineDrift, bugSectionFilled, chainPlaceholders,
  changedSinceApproval, checkPhaseIndex, clarificationMarkers, cleanTaskText, CONSTITUTION_SYN, crossAcDoctorDetail,
  crossFeatureAcs, decisionDoctorChecks, designApprovedBeforeWeigh, designWeighChecks, detectPhase, detectTracks,
  duplicateTaskNumbers, earsUnlinted, earsValidate, executionSignOffStale, existingFeature, expectsFail, extractSection,
  extractTestIds, featureFlow, featureLang, featureOverlaps, flowOrderText, flowPhaseIndex, gateArtifacts, gateWalk,
  glossaryEntries, glossaryHits, hasPriority, hasSuccessCriteria, isObj, isRecord, isSpikeDir, legacyPackName,
  malformedMarkers, missingPackTracks, outsideCodeTemplates, overlapDoctorDetail, packRegistry, parseTasks,
  pendingGateList, PHASE_FILE, phaseActive, phaseContent, phaseFile, PHASES, placeholderSummary, planIdText,
  RE_CONSTITUTION_CHECK, readIfExists, readJson, readState, realRootOf, redPhaseHint, REPRO_SYN, reReviewRoles,
  roleGateView, roleSignOffs, ROOT_CAUSE_SYN, secondaryDefinitions, sectionFilled, sectionState, signOffWhyText,
  snapshotPhases, spikeDoctor, spikeNextAction, staleFinish, staleFinishText, statePath, steeringChanges,
  steeringChangeText, steeringPlaceholders, suiteLabel, suiteStatus, supersedesWarnings, taskBlocks,
  taskDepsBlockedNote, taskDepsCheck, taskMarkers, taskSchedule, tKey, TRACE_PLAN_KINDS, TRACE_SECONDARY_KINDS,
  TRACE_TASK_KINDS, TRACE_VERDICT_KINDS, traceCheck, traceGapLines, traceGaps, traceWarningLines, trackLabel,
  unverifiedLabel, VALID_TRACKS, verificationStatus, verifyPipes, waiverExpiredCheck;
function __link(E) { ({ acDuplicates, activeDesign, activeSectionTracks, activeTasks, approvalChecks, approvalRolesOf,
  approveStepExtras, artifactReport, artifactState, b5DoctorChecks, baselineDrift, bugSectionFilled, chainPlaceholders,
  changedSinceApproval, checkPhaseIndex, clarificationMarkers, cleanTaskText, CONSTITUTION_SYN, crossAcDoctorDetail,
  crossFeatureAcs, decisionDoctorChecks, designApprovedBeforeWeigh, designWeighChecks, detectPhase, detectTracks,
  duplicateTaskNumbers, earsUnlinted, earsValidate, executionSignOffStale, existingFeature, expectsFail, extractSection,
  extractTestIds, featureFlow, featureLang, featureOverlaps, flowOrderText, flowPhaseIndex, gateArtifacts, gateWalk,
  glossaryEntries, glossaryHits, hasPriority, hasSuccessCriteria, isObj, isRecord, isSpikeDir, legacyPackName,
  malformedMarkers, missingPackTracks, outsideCodeTemplates, overlapDoctorDetail, packRegistry, parseTasks,
  pendingGateList, PHASE_FILE, phaseActive, phaseContent, phaseFile, PHASES, placeholderSummary, planIdText,
  RE_CONSTITUTION_CHECK, readIfExists, readJson, readState, realRootOf, redPhaseHint, REPRO_SYN, reReviewRoles,
  roleGateView, roleSignOffs, ROOT_CAUSE_SYN, secondaryDefinitions, sectionFilled, sectionState, signOffWhyText,
  snapshotPhases, spikeDoctor, spikeNextAction, staleFinish, staleFinishText, statePath, steeringChanges,
  steeringChangeText, steeringPlaceholders, suiteLabel, suiteStatus, supersedesWarnings, taskBlocks,
  taskDepsBlockedNote, taskDepsCheck, taskMarkers, taskSchedule, tKey, TRACE_PLAN_KINDS, TRACE_SECONDARY_KINDS,
  TRACE_TASK_KINDS, TRACE_VERDICT_KINDS, traceCheck, traceGapLines, traceGaps, traceWarningLines, trackLabel,
  unverifiedLabel, VALID_TRACKS, verificationStatus, verifyPipes, waiverExpiredCheck } = E); }

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
  for (const [tr, secs, marker] of activeSectionTracks(tracks)) {
    const bad = sectionState(design, secs, marker).filter((s) => s.status !== "filled");
    if (bad.length) sections.push({ track: tr, marker, sections: bad });
  }
  let constitution = null; // null = not checked (bugfix)
  let weigh = null; // 1.17 A1: {tradeoffs, risks} = designWeighState's status codes (null for a bugfix) — notes, never unclean
  const notes = [];
  if (kind !== "bugfix") {
    const active = activeDesign(design, tracks);
    constitution = extractSection(active, CONSTITUTION_SYN) == null ? "missing" : sectionFilled(active, CONSTITUTION_SYN) ? "filled" : "unfilled";
    const wc = designWeighChecks(active, lng);
    weigh = { tradeoffs: wc[0].state, risks: wc[1].state };
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
  return { ok: true, feature: f.slug, tracks: trackLabel(tracks), kind, sections, constitution, weigh, placeholders, clean, text };
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
  const approvals = st.approvals || {};
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
  if (pending) {
    open = gateArtifacts(dir, tracks, kind, pending).map((file) => artifactReport(dir, file, tracks)).find((r) => r.state !== "filled") || null;
    if (!open) {
      // doctor already ran this gate's own checks when it is its first pending gate (nextGate) — the tests gate scans the
      // test code, so it is never run twice.
      const g = doc.nextGate && doc.nextGate.phase === pending ? { checks: doc.nextGate.failing } : approvalChecks(projectDir, slug, dir, pending, tracks, kind, lng);
      if (g.checks.length) refused = g.checks;
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
    tests: (s) => (testsSignOff ? nx.signOffTests(s, testsWhat) : nx.approveTests(s, testsWhat)), tasks: nx.approveTasks };
  let step;
  let recommendation;
  let gateFix = false;
  let impactPhases = [];
  let finishedDrift = null;
  let staleBaseline = null;
  let approveExtras = null; // 1.14 B3: {missingRoles?, fastForward?} of the approve step
  let reReviewRefused = null; // the re-review phase whose approve gate would refuse (refusedGate names it)
  let finishedRoles = null; // the roles still to sign the execution phase off (finished step)
  let suiteMissing = null; // the project checks without a passing run since the last task activity (verify step, finished)
  let depsBlocked = null; // 1.14 F3: [{number, waitsOn}] — open tasks, none can start (fix step)
  // Re-review now only what can be re-approved now: an artifact of a phase AFTER the first pending gate waits for that gate
  // (approve refuses it on phase-order — next_action looped "re-review tasks.md" → refused → "re-review tasks.md"); the
  // chain reaches it again once the earlier gate is approved.
  const walk = gateWalk(dir, tracks, kind);
  const phaseOfFile = (file) => Object.keys(PHASE_FILE).find((ph) => phaseFile(ph, kind) === file) || (file === "design.md" ? "design" : null);
  const reReviewNow = pending ? changed.filter((file) => { const i = walk.indexOf(phaseOfFile(file)); return i === -1 || i <= walk.indexOf(pending); }) : changed;
  if (reReviewNow.length) {
    step = "re-review";
    recommendation = nx.reReview(reReviewNow.join(", "));
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
  } else if (pending && approveMsg[pending] && refused) {
    // Never recommend an approval the approve gate would refuse (it looped: "approve X" → refused → "approve X"…):
    // name what it would fail on instead — classification.md placeholders, missing SC-### / P1 lines…
    step = "fix";
    gateFix = true;
    const ids = refused.map((c) => c.id + (c.detail ? ` (${c.detail})` : "")).join("; ");
    // Phase 4: what its gate refuses on (planned tests not in the test code, the sample eval set) IS the work the phase
    // asks for — name that work (/writeTests), then what the gate checks.
    recommendation = pending === "tests" ? approveMsg.tests(slug) + " " + G.testsGateChecks(refused.map((c) => c.id).join(", ")) : G.fixGate(pending, ids, slug);
  } else if (pending && approveMsg[pending]) {
    step = "approve";
    recommendation = approveMsg[pending](slug);
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
            finishedRoles = v.missing;
            Object.assign(signOff, { role: v.missing[0] || exRoles[0], missing: v.missing.length ? fm.governance.missing(v.missing) : null, signed: v.signed.join(", ") });
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
  if (approveExtras && approveExtras.missingRoles) res.missingRoles = approveExtras.missingRoles; // 1.14 B3: stable — the roles to sign
  if (approveExtras && approveExtras.fastForward) res.fastForward = approveExtras.fastForward; // 1.14 B3: {through, phases, role}
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
  const reqs = readIfExists(path.join(dir, "requirements.md"));
  if (reqs == null) add("requirements", "fail", m.requirementsMissing);
  else {
    const e = earsValidate(reqs, featureLang(projectDir, slug));
    const nErr = e.issues ? e.issues.filter((i) => i.severity === "error").length : 0;
    const nCrit = e.summary ? e.summary.criteriaDetected : 0;
    // Zero criteria is not a pass — an empty requirements.md must not read as "EARS clean". And requirements.md whose AC
    // IDs trace_check counts while EARS linted none of them fails (1.14 full review Pa2): nothing was checked.
    const unlinted = earsUnlinted(reqs, e);
    add("ears", nErr || unlinted ? "fail" : nCrit === 0 ? "warn" : "pass",
      unlinted ? m.earsNoCriteria(unlinted) : m.earsDetail(nCrit, nErr, e.issues ? e.issues.filter((i) => i.severity === "warn").length : 0));
    // Clarifications gate — design is blocked while any [NEEDS CLARIFICATION] remains.
    const markers = clarificationMarkers(reqs);
    add("clarifications", markers.length ? "fail" : "pass", markers.length ? m.clarificationsOpen(markers.length) : m.clarificationsNone);
    // Spec-Kit-style structure — only REAL lines count: the template's P1 legend and placeholder SC-001 don't.
    const reqsActive = activeDesign(reqs, tracks);
    add("success-criteria", hasSuccessCriteria(reqsActive) ? "pass" : "warn", hasSuccessCriteria(reqsActive) ? m.scPresent : m.scMissing);
    add("priorities", hasPriority(reqsActive) ? "pass" : "warn", hasPriority(reqsActive) ? m.prioritiesOk : m.prioritiesMissing);
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
  if (design == null) { if (kind !== "bugfix") add("design", "fail", m.designMissing); }
  else if (kind !== "bugfix") {
    add("mermaid", /```mermaid/.test(design) ? "pass" : "warn", /```mermaid/.test(design) ? m.mermaidOk : m.mermaidMissing);
    add("constitution-check", RE_CONSTITUTION_CHECK.test(design) ? "pass" : "warn", RE_CONSTITUTION_CHECK.test(design) ? m.constitutionOk : m.constitutionMissing);
    // 1.17 A1 — design-tradeoffs / design-risks: warns only (never a fail, never an approval check). Not while design.md is
    // still a LATER phase's template (nothing is being designed yet — the placeholders check already says so). A design approved
    // before 1.17 (no `weigh` stamp) is never flagged: a pass with a note (A review 3).
    if (!ph.later.some((r) => r.file === "design.md")) {
      const legacy = designApprovedBeforeWeigh(readState(projectDir, slug).approvals);
      for (const c of designWeighChecks(activeDesign(design, tracks), lng, { legacy })) add(c.id, c.status, c.detail);
    }
  }

  // Mandatory sections — `<track>-sections` per active marker track (saas, ai, sec, privacy).
  const allFilled = { saas: m.saasAllFilled, ai: m.aiAllFilled, ...fm.secPrivacy.allFilled };
  if (design != null) {
    for (const [tr, secs, mark] of activeSectionTracks(tracks)) {
      const bad = sectionState(design, secs, mark).filter((s) => s.status !== "filled");
      add(tr + "-sections", bad.length ? "fail" : "pass", bad.length ? bad.map(sectionLabel).join("; ")
        : Object.prototype.hasOwnProperty.call(allFilled, tr) ? allFilled[tr] : fm.trackPacks.allFilled(mark)); // a track pack's (1.15)
    }
  }
  // 1.15: a saved track pack the project no longer has (its folder deleted, or the pack now invalid) — the track is inactive.
  const missingPacks = missingPackTracks(dir);
  if (missingPacks.length) {
    const reg = packRegistry();
    const st = readJson(statePath(dir)).data;
    add("track-pack-missing", "warn", fm.trackPacks.missing(missingPacks.map((n) => {
      // 1.17 D review: a pre-1.17 pack whose name is reserved now — why, and the way out (for 'dist': the built-in track is NOT on)
      if (legacyPackName(st, n)) return fm.trackPacks.missingReserved(n, slug, VALID_TRACKS.includes(n));
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
      ...(laterFiles.includes("requirements.md") ? [...TRACE_TASK_KINDS, ...TRACE_PLAN_KINDS].filter((k) => k !== "missingImplFiles") : []),
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
    const secDefined = secondaryDefinitions(readIfExists(path.join(dir, "requirements.md")) || "").defined.size;
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
  const overlapPairs = featureOverlaps(projectDir, undefined, { only: slug }).pairs;
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
  const rv = roleGateView(projectDir, dir, state, execDue ? pendingGates.concat("execution") : pendingGates, tracks, kind, lng);
  const shownPending = rv.pending.execution ? pendingGates.concat("execution") : pendingGates;
  if (pendingGates.length) {
    const g = approvalChecks(projectDir, slug, dir, pendingGates[0], tracks, kind, lng);
    nextGate = { phase: pendingGates[0], ready: g.artifact && !g.checks.length, failing: g.checks };
    if (rv.pending[pendingGates[0]]) nextGate.missingRoles = rv.pending[pendingGates[0]].missing;
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
      ...rv.notes]
      .filter(Boolean).join("; ") || m.gatesOk);
  for (const c of decisionDoctorChecks(projectDir, slug, dir, state, kind, lng, tr)) add(c.id, c.status, c.detail); // 1.14 C2 (warns)
  const wExp = waiverExpiredCheck(approvals, tracks, slug, lng); // 1.16 U3: a forced approval whose waiver expired
  if (wExp) add(wExp.id, wExp.status, wExp.detail);
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

module.exports = { designSaveCheck, nextAction, specDoctor, __link };

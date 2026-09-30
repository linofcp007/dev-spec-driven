"use strict";

/**
 * dev-spec-driven engine — spec_finish, drift, the feature lifecycle, the catalog and metrics.
 * Close a feature LOCALLY (readiness + a merge summary from the spec chain — never a merge, push or pull request) and
 * the finish baseline spec_drift hashes; remove / rename / archive / restore (folder moves under the feature lock that
 * keep dependencies, _Supersedes:_ references and archive records consistent); _Supersedes:_ and .specs/SPECS.md;
 * spec_metrics (derived only from .state.json, .history/ and the artifacts).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { TRACE_INFO_FIELDS } = require("./trace.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, activeDesign, activeTasks, artifactReport, bugSectionFilled, catalogDecisions, chainArtifacts,
  changedSinceApproval, clarificationMarkers, cleanTaskText, commitTag, criterionBlocks, crossFeatureAcs,
  DECISIONS_FILE, decisionSummaryLines, detectPhase, detectTracks, duplicateTaskNumbers, ensureDir, errs,
  evidenceRecords, existingFeature, expectsFail, extractAcIds, extractSection, extractTestIds, featureDirs, featureFlow,
  featureLang, featurePercent, featureShipped, featureVelocity, findCycle, FOLD_CASE, forcedApprovalList, forecastInput,
  forgetCached, globFiles, implementsPath, implementsRefs, invalidateReadCache, isApprovalRecord, isBacktickUnit,
  isDirSafe, isFeatureFolder, isGeneratedOrAbsent, isImplementsGlob, isInsideDir, isObj, isRecord, isRedRun,
  legacySlugify, listFeatures, locateFeatures, LOCK_FILE, maybeRefreshRoadmap, milestonesFollow, moveDirOrBusy,
  normalizeLang, ownEvidence, parseTasks, pendingGateList, PHASES, placeholderReport, placeholderSummary, planIdText,
  projectLang, pruneBacklog, RE_DEFINES_AC, RE_TODO_SENTINEL, readContained, readIfExists, readRoadmap, readState,
  recordFinishChecks, renderCrossAcsMd, resolveFeature, roadmapBusyResult, roadmapError, roleLabel, ROOT_CAUSE_SYN,
  safeReaddir, scanTestCode, setFeatureFlowLocked, shippedSupersedeKeys, slugify, specDoctor, specsRoot, spikeFinish,
  spikeInfo, stateFromFile, statePath, stripEnds, stripHtmlComments, suiteLabel, suiteStatus, suiteSummaryLines,
  taskBlocks, taskMarkers, testIndex, toPosix, TRACE_SECONDARY_KINDS, traceCheck, traceWarningLines, trackLabel,
  unverifiedLabel, velocityOf, verificationStatus, waiverResult, waiverSummaryLines, walkProject, withMoveLock,
  withRoadmapLock, writeFileAtomic, writeIfAbsent, writeRoadmap;
function __link(E) { ({ acIndex, activeDesign, activeTasks, artifactReport, bugSectionFilled, catalogDecisions,
  chainArtifacts, changedSinceApproval, clarificationMarkers, cleanTaskText, commitTag, criterionBlocks,
  crossFeatureAcs, DECISIONS_FILE, decisionSummaryLines, detectPhase, detectTracks, duplicateTaskNumbers, ensureDir,
  errs, evidenceRecords, existingFeature, expectsFail, extractAcIds, extractSection, extractTestIds, featureDirs,
  featureFlow, featureLang, featurePercent, featureShipped, featureVelocity, findCycle, FOLD_CASE, forcedApprovalList,
  forecastInput, forgetCached, globFiles, implementsPath, implementsRefs, invalidateReadCache, isApprovalRecord,
  isBacktickUnit, isDirSafe, isFeatureFolder, isGeneratedOrAbsent, isImplementsGlob, isInsideDir, isObj, isRecord,
  isRedRun, legacySlugify, listFeatures, locateFeatures, LOCK_FILE, maybeRefreshRoadmap, milestonesFollow,
  moveDirOrBusy, normalizeLang, ownEvidence, parseTasks, pendingGateList, PHASES, placeholderReport, placeholderSummary,
  planIdText, projectLang, pruneBacklog, RE_DEFINES_AC, RE_TODO_SENTINEL, readContained, readIfExists, readRoadmap,
  readState, recordFinishChecks, renderCrossAcsMd, resolveFeature, roadmapBusyResult, roadmapError, roleLabel,
  ROOT_CAUSE_SYN, safeReaddir, scanTestCode, setFeatureFlowLocked, shippedSupersedeKeys, slugify, specDoctor, specsRoot,
  spikeFinish, spikeInfo, stateFromFile, statePath, stripEnds, stripHtmlComments, suiteLabel, suiteStatus,
  suiteSummaryLines, taskBlocks, taskMarkers, testIndex, toPosix, TRACE_SECONDARY_KINDS, traceCheck, traceWarningLines,
  trackLabel, unverifiedLabel, velocityOf, verificationStatus, waiverResult, waiverSummaryLines, walkProject,
  withMoveLock, withRoadmapLock, writeFileAtomic, writeIfAbsent, writeRoadmap } = E); }

// ---------------------------------------------------------------------------
// spec_finish — close a feature LOCALLY: readiness report + a merge summary generated from the spec chain
// (no PRs, no CI — the owner's cost rule; the summary is the merge commit message)
// ---------------------------------------------------------------------------

// The first paragraph of a section (wrapped lines joined), or null for a placeholder / TODO sentinel.
function sectionFirstParagraph(md, synonyms) {
  const body = extractSection(md, synonyms);
  if (body == null) return null;
  const para = [];
  for (const l of stripHtmlComments(body).split(/\r?\n/).map((x) => x.trim())) {
    if (!l) { if (para.length) break; continue; }
    para.push(l);
  }
  const text = para.join(" ");
  return text && !/^\[.*\]$/.test(text) && !RE_TODO_SENTINEL.test(text) ? text : null;
}
// Markdown helpers for the merge summary: multi-line output collapsed to one line; a code span whose fence is
// longer than any backtick run inside it.
function oneLine(s) {
  return String(s || "").replace(/(?<!\s)\s*\r?\n\s*/g, " ⏎ ").trim(); // (?<!\s): a blank run is read from its start only (1.17 H)
}
function codeSpan(s) {
  const text = oneLine(s);
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((r) => r.length));
  const fence = "`".repeat(longest + 1);
  return longest ? fence + " " + text + " " + fence : fence + text + fence;
}
// A commit title's text: the first sentence, at most `max` characters. Abbreviations like "e.g." / "i.e." / "p. ej." don't
// end a sentence. A longer sentence is cut at its LAST clause boundary that fits — a comma, a semicolon or a dash (— –) —
// and reads whole there (no ellipsis); only when no boundary leaves at least a third of the budget is it cut at a word
// boundary, with "…" (counted in `max`). 1.21 F3: the 1.19 eval run's merge title ran to ~90 characters, cut mid-clause.
function shortTitle(text, max = 72) {
  const first = String(text || "").split(/(?<!\b(?:e\.g|i\.e|ex|etc|ej|vs|p)\.)(?<=[.!?])\s+(?=\p{Lu})/u)[0].trim();
  if (first.length <= max) return first.replace(/\.$/, "");
  const head = first.slice(0, max + 2); // bounded: the boundary scan never reads past the budget
  let clause = -1;
  for (const m of head.matchAll(/[,;]\s|\s[—–]/g)) if (m.index <= max && m.index >= max / 3) clause = m.index;
  if (clause > 0) return first.slice(0, clause).replace(/[,;:\s—–-]+$/, "");
  const cut = first.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(max / 2))).replace(/[,;:\s—–-]+$/, "") + "…";
}
// The merge / commit title: `type(slug): ` + shortTitle, the WHOLE line at most 72 characters — the text gets what the prefix
// leaves (at least 24, so a very long slug still keeps a readable title).
const COMMIT_TITLE_MAX = 72;
function commitTitle(prefix, text) {
  return prefix + shortTitle(text, Math.max(24, COMMIT_TITLE_MAX - prefix.length));
}

function finishFeature(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const F = i18n.msg(lng).finish;
  const tracks = detectTracks(dir);
  // B5: spec_finish {evidence} — the project checks' runs, recorded BEFORE the readiness is computed (the same call can make
  // the feature ready); all-or-nothing, under the feature lock.
  let recordedChecks = null;
  if (opts.evidence != null) {
    const rc = recordFinishChecks(projectDir, slug, dir, opts.evidence, lng, opts.ranBy); // ranBy "cli": `finish --run` (1.14 F1; never from MCP)
    if (rc.error) return { ok: false, error: rc.error };
    recordedChecks = rc.recorded;
  }
  const state = readState(projectDir, slug);
  const kind = state.kind || "feature";
  if (kind === "spike") return spikeFinish(projectDir, f, opts, recordedChecks); // 1.14 C2: ready once the decision is written
  // Deep traceability — WARNINGS, never blockers: uncovered / phantom EC·NFR·SC, and planned tests no test file names.
  // One walk of the test code (only when an active +tdd plan has T-IDs), shared with doctor's tests-in-code check.
  const scan = tracks.includes("tdd") && extractTestIds(planIdText(readIfExists(path.join(dir, "test-plan.md")) || "")).size ? scanTestCode(projectDir) : null;
  const tr = traceCheck(projectDir, slug, { ...(scan ? { code: true, scan } : {}), globCap: opts.globCap });
  const warnings = tr.ok ? traceWarningLines(tr, lng, [...TRACE_SECONDARY_KINDS, "plannedNotInCode"]) : [];
  const doc = specDoctor(projectDir, slug, { scan, lean: true }); // lean: finish reads the failing checks (never the cross-feature warn)
  const tasksText = activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks);
  const blocks = taskBlocks(tasksText);
  const open = blocks.filter((b) => !b.done).map((b) => b.number);
  const vs = verificationStatus(projectDir, slug, dir);
  const G = i18n.msg(lng).gates;
  // placeholders / root-cause get their own, more precise blockers below.
  const failing = doc.ok ? doc.checks.filter((c) => c.status === "fail" && c.id !== "placeholders" && c.id !== "root-cause").map((c) => c.id) : [];
  const pendingGates = doc.pendingGates || [];
  // What next_action flags must block finishing too: an artifact edited after its approval, a template placeholder
  // ANYWHERE in the chain, and — for a bugfix — an unwritten root cause. Only a change known by CONTENT blocks: a file date
  // (a pre-1.11 approval) is no evidence — every clone or copy resets it — and a pre-1.13 bugfix design approval never
  // tracked bug.md; both are warnings (re-approve to track them).
  const cs = changedSinceApproval(dir, state.approvals || {}, tracks, kind, { detail: true });
  const changed = cs.changed.filter((x) => !cs.byDate.includes(x));
  if (cs.byDate.length) warnings.push(F.changedByDate(cs.byDate.join(", "), slug));
  if (cs.untracked.length) warnings.push(F.untrackedApproval(cs.untracked.map((u) => `${u.phase} (${u.file})`).join(", "), slug));
  // 1.14 B3: phases approved without the role sign-offs now required (approved before the roles) — a warning, never a blocker.
  const unsigned = doc.ok && isObj(doc.unsignedRoles) ? Object.entries(doc.unsignedRoles) : [];
  if (unsigned.length) warnings.push(i18n.msg(lng).governance.unsigned(unsigned.map(([p, l]) => `${p} (${l.join(", ")})`).join(", ")));
  // 1.14 full review Pa6: a test planned outside test code whose artifact (load-test.md, an eval set) is still the scaffold —
  // doctor's outside-code-artifacts warn, repeated here as a warning (never a blocker).
  const ocWarn = doc.ok && Array.isArray(doc.checks) ? doc.checks.find((c) => c.id === "outside-code-artifacts") : null;
  if (ocWarn) warnings.push(ocWarn.detail);
  // 1.16 U3: the forced approvals (each a waived gate, with its waiver when one was recorded) — the merge summary lists them,
  // an expired waiver is a warning (never a blocker; doctor warns waiver-expired).
  const forcedList = forcedApprovalList(state.approvals, tracks);
  const expiredW = forcedList.filter((x) => x.waiver && x.waiver.expired);
  if (expiredW.length) warnings.push(i18n.msg(lng).waiver.finishWarn(expiredW.map((x) => i18n.msg(lng).waiver.expiredItem(x.phase, x.waiver.expires, x.waiver.reason)).join(", "), slug));
  const leftovers = chainArtifacts(dir, tracks, kind).map((a) => artifactReport(dir, a.file, tracks)).filter((r) => r.state === "placeholder");
  const rootCauseMissing = kind === "bugfix" && !bugSectionFilled(readIfExists(path.join(dir, "bug.md")), ROOT_CAUSE_SYN);

  // Each blocker with a stable id: the approve gate of 'execution' refuses on exactly these (opts.gateOnly).
  const blocked = [];
  const block = (id, detail) => blocked.push({ id, detail });
  if (failing.length) block("doctor", F.doctor(failing.join(", ")));
  if (rootCauseMissing) block("root-cause", G.finishRootCause);
  if (leftovers.length) block("placeholders", G.finishPlaceholders(placeholderSummary(leftovers, lng)));
  if (changed.length) block("changed-since-approval", G.finishChanged(changed.join(", ")));
  if (!blocks.length) block("tasks", F.noTasks);
  if (open.length) block("open-tasks", F.open(open.map((n) => "#" + n).join(", ")));
  if (vs.unverified.length) block("verification", F.unverified(unverifiedLabel(vs, lng)));
  // B5: meta.checks set → every check needs a passing run since the feature's last task activity (suiteStatus).
  const suite = suiteStatus(projectDir, state, dir);
  if (suite.missing.length) block("suite-evidence", i18n.msg(lng).projectChecks.blocker(suiteLabel(suite.missing, lng), slug));
  if (suite.invalid.length) warnings.push(i18n.msg(lng).projectChecks.invalidStored(suite.invalid.join(", ")));
  if (pendingGates.length) block("approval-gates", F.gates(pendingGates.map((p) => roleLabel(doc.pendingRoles, p, lng)).join(", "))); // + the roles a phase waits for (1.14 B3)
  if (opts.gateOnly) return { ok: true, checks: blocked };
  const blockers = blocked.map((b) => b.detail);

  // What only a human (or a fresh run) can confirm — the track-gated "done" checks.
  const checks = [F.checkSuite];
  if (kind === "bugfix") checks.push(F.checkBug);
  if (tracks.includes("saas")) checks.push(F.checkLoad, F.checkObs);
  if (tracks.includes("ai")) checks.push(F.checkCost, F.checkSafety);
  for (const tr of ["sec", "privacy", "dist", "api", "ui", "obs", "data"]) if (tracks.includes(tr)) checks.push(...i18n.msg(lng).secPrivacy.finishChecks[tr]);

  // Merge summary from the spec chain (usable as the merge commit message).
  const reqs = readIfExists(path.join(dir, "requirements.md")) || "";
  const summary = sectionFirstParagraph(reqs, ["summary", "resumo", "resumen"]) || slug;
  const mergeTitle = commitTitle(`${kind === "bugfix" ? "fix" : "feat"}(${slug}): `, summary);
  const body = [F.prSummary, summary, ""];
  if (kind === "bugfix") {
    const bug = readIfExists(path.join(dir, "bug.md")) || "";
    const rc = extractSection(bug, ROOT_CAUSE_SYN);
    const fix = extractSection(bug, ["fix", "correção", "correcao", "corrección", "correccion"]);
    // Only real content: an unfilled TODO sentinel or a [bracketed placeholder] stays out of the PR.
    const real = (x) => { const t = stripHtmlComments(x || "").trim(); return t && !RE_TODO_SENTINEL.test(t) && !/^\[[^\]]*\]$/.test(t) ? t : null; };
    if (real(rc)) body.push(F.prRootCause, real(rc), "");
    if (real(fix)) body.push(F.prFix, real(fix), "");
  }
  const acs = [...acIndex(reqs).values()];
  if (acs.length) body.push(F.prAcs, ...acs.map((a) => "- " + a.text), "");
  if (blocks.length) {
    body.push(F.prTasks);
    const dups = new Set(duplicateTaskNumbers(blocks));
    for (const b of blocks) {
      const ev = ownEvidence(vs.evidence, b, dups.has(b.number)); // never the other "N."'s run
      const hasVerify = taskMarkers(b).verify.length > 0;
      // A record with nothing to show (a v1.12 bare {exitCode: 0}) prints its exit code — never a dangling " — ".
      // full review Ga8: an _Expect: fail_ task's red run is labelled as the EXPECTED failure (a bare "→ exit 1" read as a
      // failing check), and a passing re-run after the fix names the red run it keeps as the proof.
      const RG = i18n.msg(lng).redGreen;
      const redTag = ev && expectsFail(b) ? (isRedRun(ev) ? RG.prRed : ev.exitCode === 0 && isRedRun(ev.red) ? RG.prRedKept(ev.red.exitCode, typeof ev.red.at === "string" ? ev.red.at.slice(0, 10) : "") : "") : "";
      const shown = ev ? [ev.command ? codeSpan(ev.command) + (ev.exitCode != null ? " → exit " + ev.exitCode : "") + (redTag ? ` (${redTag})` : "") : ev.exitCode != null ? "exit " + ev.exitCode : "",
        oneLine(ev.summary), commitTag(ev)].filter(Boolean) : [];
      const tail = shown.length ? " — " + shown.join(" · ") : hasVerify ? " — " + F.noEvidence : "";
      body.push(`- [${b.done ? "x" : " "}] ${b.number}. ${cleanTaskText(b.text)}${tail}`);
    }
    body.push("");
  }
  if (suite.items.length) body.push(...suiteSummaryLines(suite.items, lng), ""); // B5: the project checks' recorded runs
  const testIds = [...testIndex(readIfExists(path.join(dir, "test-plan.md")) || "").keys()];
  if (testIds.length) body.push(F.prTests, testIds.join(", "), "");
  const decLines = decisionSummaryLines(dir, lng); // 1.14 C2: decisions.md
  if (decLines.length) body.push(...decLines, "");
  if (forcedList.length) body.push(...waiverSummaryLines(forcedList, lng), ""); // 1.16 U3: the waived gates
  body.push(F.prChecks, ...checks.map((c) => "- [ ] " + c), "");
  const specFiles = ["requirements.md", "change.md", "bug.md", "design.md", "test-plan.md", "eval-plan.md", "load-test.md", "tasks.md", DECISIONS_FILE] // 1.21 F5: a change's one file
    .filter((x) => fs.existsSync(path.join(dir, x)));
  body.push(F.prSpec, ...specFiles.map((x) => "- `.specs/" + slug + "/" + x + "`"));
  const mergeSummary = body.join("\n") + "\n";

  const exDir = path.join(dir, ".execution");
  const summaryPath = path.join(exDir, "merge-summary.md");
  const write = !!opts.write;
  if (write) {
    ensureDir(exDir);
    writeIfAbsent(path.join(exDir, ".gitignore"), "*\n");
    forgetCached(summaryPath); // written in place below: its cached text is dropped
    fs.writeFileSync(summaryPath, "# " + mergeTitle + "\n\n" + mergeSummary, "utf8"); // derived: regenerated on every call
  }
  const ready = blockers.length === 0;
  // A written finish of a READY feature is the drift baseline: a hash of every _Implements:_ file (spec_drift).
  const baseline = write && ready ? recordFinishBaseline(projectDir, slug, dir, tasksText, opts.globCap) : null;
  const res = {
    ok: true,
    feature: slug,
    kind,
    tracks: trackLabel(tracks),
    readyToFinish: ready,
    message: ready ? F.ready(slug) : F.notReady(slug),
    blockers,
    warnings, // localized lines; readyToFinish ignores them
    openTasks: open,
    unverified: vs.unverified,
    pendingGates,
    changedSinceApproval: changed,
    placeholders: leftovers.map((r) => r.file),
    checks,
    mergeTitle,
    paths: { summary: summaryPath },
    wrote: write,
  };
  if (baseline) res.baseline = baseline;
  if (forcedList.length) res.waivers = waiverResult(forcedList); // 1.16 U3: [{phase, failing, reason?, expires?, expired}]
  if (suite.items.length) res.suiteChecks = suite.items; // B5: [{name, command, status, exitCode?, at?, …}] — status is a stable code
  if (recordedChecks) res.recordedChecks = recordedChecks; // B5: the runs this call recorded
  if (doc.ok && doc.pendingRoles) res.pendingRoles = doc.pendingRoles; // 1.14 B3: the roles each pending phase waits for
  if (opts.includeBody != null ? !!opts.includeBody : !write) res.mergeSummary = mergeSummary;
  return res;
}

// ---------------------------------------------------------------------------
// Metrics & retrospective (1.13) — derived only from .state.json, .history/ and the artifacts (local, no cost).
// Legacy state never throws: what can't be derived is null.
// ---------------------------------------------------------------------------

// Every gated planning phase in PHASES order — Phase 4 ('tests', the hard gate since 1.13) included; a phase a feature
// doesn't have (or never approved) is null, so a core-only feature is unaffected.
const METRIC_PHASES = ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks"];
const timeOf = (v) => { if (typeof v !== "string" && typeof v !== "number") return null; const t = new Date(v).getTime(); return Number.isFinite(t) && t > 0 ? t : null; };
const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;
const isoOf = (t) => (t == null ? null : new Date(t).toISOString());
// Lead time in hours (never negative: an approximate start may postdate a milestone).
const hoursFrom = (start, t) => (start == null || t == null ? null : round2(Math.max(0, t - start) / 3600000));

function featureMetrics(projectDir, slug, dir) {
  const state = readState(projectDir, slug);
  const tracks = detectTracks(dir);
  const kind = state.kind || "feature";
  const approvals = isRecord(state.approvals) ? state.approvals : {};
  // A state whose shape was refused (readState drops a non-list approvalHistory) can't say how many approvals were
  // made: approvals/rework unknown (null). A missing history is an empty one (createFeature doesn't seed the key).
  const lost = !!state.invalid && !Array.isArray(state.approvalHistory);
  // A role sign-off that didn't complete its phase (`partial`, 1.14 B3) is no approval: not counted, never a lead time.
  const history = lost ? null : (Array.isArray(state.approvalHistory) ? state.approvalHistory : []).filter((h) => isApprovalRecord(h) && typeof h.phase === "string"); // + no revocation (1.16 U2)
  // Approvals made before the change history (a feature upgraded mid-flight): the `legacy` records approvePhase seeds,
  // and approved phases with no history entry at all (not re-approved since). Each is counted once (its latest
  // approval — earlier ones were overwritten), so their rework is unknown: `rework` is then a lower bound.
  const unseeded = history ? Object.keys(approvals).filter((ph) => isRecord(approvals[ph]) && !history.some((h) => h.phase === ph)) : [];
  const legacySet = new Set([...(history || []).filter((h) => h.legacy === true).map((h) => h.phase), ...unseeded]);
  const legacyPhases = history ? [...PHASES.filter((ph) => legacySet.has(ph)), ...[...legacySet].filter((ph) => !PHASES.includes(ph))] : null;
  // Start: createdAt (1.13+), else the earliest approval, else the folder's birth/modification time — approximate.
  let created = timeOf(state.createdAt);
  let createdSource = created != null ? "state" : null;
  if (created == null) {
    const seen = [...(history || []).map((h) => timeOf(h.at)), ...Object.values(approvals).map((a) => (isRecord(a) ? timeOf(a.at) : null))].filter((t) => t != null);
    if (seen.length) { created = Math.min(...seen); createdSource = "approval"; }
    else {
      try { const st = fs.statSync(dir); created = st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs > 0 ? st.mtimeMs : null; createdSource = created != null ? "filesystem" : null; } catch { /* unknown */ }
    }
  }
  // First approval of each phase: the history; a phase approved only before 1.13 falls back to its (latest) approval —
  // approximate, like a seeded legacy record (the phase may have been approved earlier).
  const first = {}, count = {};
  for (const h of history || []) {
    const t = timeOf(h.at);
    count[h.phase] = (count[h.phase] || 0) + 1;
    if (t != null && (first[h.phase] == null || t < first[h.phase].t)) first[h.phase] = { t, approximate: h.legacy === true };
  }
  for (const [ph, a] of Object.entries(approvals)) {
    const t = isRecord(a) ? timeOf(a.at) : null;
    if (t != null && !first[ph]) first[ph] = { t, approximate: true };
  }
  const leadTime = {};
  for (const ph of METRIC_PHASES) {
    leadTime[ph] = first[ph] ? { at: isoOf(first[ph].t), hours: hoursFrom(created, first[ph].t), ...(first[ph].approximate ? { approximate: true } : {}) } : null;
  }
  // Tasks: the active view (status's). Complete = every task done — when: the latest evidence recorded for them.
  const tasksText = readIfExists(path.join(dir, "tasks.md"));
  const active = parseTasks(activeTasks(tasksText, tracks));
  const done = active.filter((t) => t.done).length;
  const evidence = isRecord(state.evidence) ? state.evidence : {};
  leadTime.complete = null;
  if (active.length && done === active.length) {
    const stamps = [];
    let everyTask = true;
    for (const t of active) {
      const recs = evidenceRecords(evidence[String(t.number)]);
      if (!recs.length) everyTask = false;
      for (const r of recs) for (const k of ["at", "noteAt"]) { const x = timeOf(r[k]); if (x != null) stamps.push(x); }
    }
    let t = stamps.length ? Math.max(...stamps) : null;
    if (t == null) { try { t = fs.statSync(path.join(dir, "tasks.md")).mtimeMs; } catch { /* unknown */ } }
    if (t != null) leadTime.complete = { at: isoOf(t), hours: hoursFrom(created, t), ...(!stamps.length || !everyTask ? { approximate: true } : {}) };
  }
  // Finished, when recorded: the earliest of the execution phase's first approval (gated on spec_finish's readiness since
  // 1.13 — a forced one is counted in forcedApprovals) and the finish spec_finish {write} records on a READY feature
  // (state.finished.at; finishedAt: an older spelling).
  const finishes = [first.execution ? first.execution.t : null, isRecord(state.finished) ? timeOf(state.finished.at) : null, timeOf(state.finishedAt)].filter((t) => t != null);
  const fin = finishes.length ? Math.min(...finishes) : null;
  leadTime.finished = fin != null ? { at: isoOf(fin), hours: hoursFrom(created, fin) } : null;
  // Rework: approvals of a phase beyond its first (history only — a pre-1.13 approval replaced its predecessor).
  // Nothing but legacy approvals (none made under the history): unknown, not 0.
  const known = history && (history.some((h) => h.legacy !== true) || !legacyPhases.length);
  const reworkByPhase = known ? Object.fromEntries(Object.entries(count).filter(([, n]) => n > 1).map(([ph, n]) => [ph, n - 1])) : null;
  const rework = reworkByPhase ? Object.values(reworkByPhase).reduce((s, n) => s + n, 0) : null;
  const forcedApprovals = history ? history.filter((h) => h.forced === true).length + unseeded.filter((ph) => approvals[ph].forced === true).length
    : Object.values(approvals).filter((a) => isRecord(a) && a.forced === true).length;
  // Evidence pass rate: passing runs / all recorded runs (evidence[n].history; a v1.12 record is its own single run).
  // The evidence gate's rules: a pass is {command, exitCode: 0} — a bare {exitCode: 0} (v1.12) proves nothing, so it
  // is no run at all — while any non-zero exit code is a failed run (the gate's failed-run), with or without a command.
  const exitOf = (h) => (h.exitCode == null ? null : Number(h.exitCode));
  // B5: an _Expect: fail_ run (expected: "fail") passes when it FAILED as expected — its red run met the expectation.
  const isPass = (h) => !!h.command && (h.expected === "fail" ? isRedRun({ ...h, exitCode: exitOf(h) }) : exitOf(h) === 0);
  const isRun = (h) => isPass(h) || (exitOf(h) != null && (exitOf(h) !== 0 || (h.expected === "fail" && !!h.command))); // B5: an unexpected pass is a failed run
  let runs = 0, passing = 0;
  for (const slot of Object.values(evidence)) {
    for (const r of evidenceRecords(slot)) {
      const list = (Array.isArray(r.history) && r.history.length ? r.history.filter(isRecord) : [r]).filter(isRun);
      runs += list.length;
      passing += list.filter(isPass).length;
    }
  }
  const changes = (state.changes || []).filter(isRecord);
  const reopened = changes.flatMap((c) => (Array.isArray(c.reopened) ? c.reopened : []));
  const openClarifications = chainArtifacts(dir, tracks, kind).reduce((s, a) => s + clarificationMarkers(readIfExists(path.join(dir, a.file)) || "").length, 0);
  const res = {
    feature: slug, kind, tracks: trackLabel(tracks), phase: detectPhase(dir, tracks),
    createdAt: isoOf(created), createdAtApproximate: createdSource !== "state", createdAtSource: createdSource,
    leadTime,
    approvalsTotal: history ? history.length + unseeded.length : null,
    rework, reworkByPhase, reworkLowerBound: rework != null && legacyPhases.length > 0, legacyPhases, forcedApprovals,
    batchApprovals: history ? history.filter((h) => h.batch === true).length : null, // 1.14 B3: approvals made by a fast-forward
    // 1.16 U: approvals revoked (spec_approve {revoke} — a withdrawn role sign-off is none) and ticks undone (spec_complete_task {undo})
    revokedApprovals: lost ? null : (Array.isArray(state.approvalHistory) ? state.approvalHistory : []).filter((h) => isRecord(h) && h.revoked === true && h.partial !== true).length,
    untickedTasks: Array.isArray(state.unticks) ? state.unticks.length : 0,
    changeRequests: changes.length, reopenedTasks: reopened.length, reopenedTasksUnique: new Set(reopened).size,
    evidence: { runs, passing, passRate: runs ? round1((passing / runs) * 100) : null },
    tasks: { done, total: active.length },
    openClarifications,
  };
  if (state.invalid) res.warning = state.invalid; // the valid parts were used
  return res;
}

// avg / median of the numbers in a list (nulls = unknown, skipped).
function stats(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0, avg: null, median: null };
  const mid = Math.floor(v.length / 2);
  return { n: v.length, avg: round2(v.reduce((s, x) => s + x, 0) / v.length), median: round2(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2) };
}

// spec_metrics {name?, write?} / `dev-spec metrics [feature] [--write]`: one feature's metrics, or the project's (every
// feature + averages/medians). write (a feature only) creates .specs/<f>/retro.md from a localized template pre-filled
// with the metrics — create-only, never overwritten.
function metrics(projectDir, name, opts = {}) {
  const write = opts.write === true;
  if (name != null && String(name).trim() !== "") {
    const f = existingFeature(projectDir, name);
    if (!f.ok) return { ok: false, error: f.error };
    const lng = featureLang(projectDir, f.slug);
    const M = i18n.msg(lng).metrics;
    const res = { ok: true, scope: "feature", lang: lng, ...featureMetrics(projectDir, f.slug, f.dir) };
    res.velocity = featureVelocity(projectDir, f.slug, opts); // 1.14 B4 — points / working day over the forecast window
    if (write) {
      const file = path.join(f.dir, "retro.md");
      const rel = path.relative(projectDir, file).split(path.sep).join("/");
      const written = writeIfAbsent(file, i18n.portableCli(M.retro(res, { dur: fmtHours, today: new Date().toISOString().slice(0, 10) })));
      res.retro = { path: rel, written };
      res.note = written ? M.retroWritten(rel) : M.retroExists(rel);
    }
    return res;
  }
  const lng = projectLang(projectDir);
  if (write) return { ok: false, error: i18n.msg(lng).metrics.writeNeedsName };
  const list = listFeatures(projectDir);
  const features = list.features.map((x) => featureMetrics(projectDir, x.name, path.join(list.specsDir, x.name)));
  const col = (fn) => features.map(fn);
  const aggregates = {
    leadTimeHours: Object.fromEntries([...METRIC_PHASES, "complete", "finished"].map((ph) => [ph, stats(col((m) => (m.leadTime[ph] ? m.leadTime[ph].hours : null)))])),
    rework: stats(col((m) => m.rework)),
    forcedApprovals: stats(col((m) => m.forcedApprovals)),
    changeRequests: stats(col((m) => m.changeRequests)),
    reopenedTasks: stats(col((m) => m.reopenedTasks)),
    evidencePassRate: stats(col((m) => m.evidence.passRate)),
    tasksDone: stats(col((m) => m.tasks.done)),
    tasksTotal: stats(col((m) => m.tasks.total)),
    openClarifications: stats(col((m) => m.openClarifications)),
  };
  const sum = (fn) => features.reduce((s, m) => s + (fn(m) || 0), 0);
  const runs = sum((m) => m.evidence.runs), passing = sum((m) => m.evidence.passing);
  const totals = { features: features.length, tasksDone: sum((m) => m.tasks.done), tasksTotal: sum((m) => m.tasks.total), forcedApprovals: sum((m) => m.forcedApprovals),
    batchApprovals: sum((m) => m.batchApprovals), // 1.14 B3
    changeRequests: sum((m) => m.changeRequests), reopenedTasks: sum((m) => m.reopenedTasks), openClarifications: sum((m) => m.openClarifications),
    evidenceRuns: runs, evidencePassing: passing, evidencePassRate: runs ? round1((passing / runs) * 100) : null };
  // 1.14 B4 — the project velocity (every feature's completions: the roadmap forecasts' rate)
  const velocity = velocityOf(list.features.flatMap((x) => forecastInput(projectDir, x.name).completions), (opts.now != null && timeOf(opts.now)) || Date.now());
  return { ok: true, scope: "project", lang: lng, specsDir: list.specsDir, features, aggregates, totals, velocity };
}

// 0.5 → "30m", 5 → "5h", 60 → "2.5d" (same units in EN/PT/ES); null → "—".
function fmtHours(h) {
  if (h == null) return "—";
  if (h < 1) return Math.round(h * 60) + "m";
  if (h < 48) return round1(h) + "h";
  return round1(h / 24) + "d";
}

// Human-readable spec_metrics (CLI), in the feature's / project's language.
function metricsLines(r) {
  const M = i18n.msg(r.lang).metrics;
  const leads = (m) => [...METRIC_PHASES, "complete", "finished"].filter((ph) => m.leadTime[ph]).map((ph) => `${M.phase[ph] || ph} ${fmtHours(m.leadTime[ph].hours)}`);
  const pass = (e) => (e.runs ? `${e.passRate}%` : "—");
  if (r.scope === "feature") {
    const out = [M.head(r.feature, r.tracks, r.createdAt ? r.createdAt.slice(0, 10) : M.unknown, r.createdAtApproximate ? M.source[r.createdAtSource] || M.unknown : null)];
    const l = leads(r);
    out.push(l.length ? M.leadTimes(l.join(" · ")) : M.noLeadTimes);
    const byPhase = r.reworkByPhase ? Object.entries(r.reworkByPhase).map(([ph, n]) => `${M.phase[ph] || ph} ${n}`).join(", ") : "";
    out.push(r.rework == null ? M.reworkUnknown(r.forcedApprovals)
      : r.reworkLowerBound ? M.reworkPartial(r.approvalsTotal, r.rework, byPhase, r.forcedApprovals, r.legacyPhases.map((ph) => M.phase[ph] || ph).join(", "))
        : M.rework(r.approvalsTotal, r.rework, byPhase, r.forcedApprovals));
    if (r.batchApprovals) out.push(i18n.msg(r.lang).governance.batch(r.batchApprovals)); // 1.14 B3
    out.push(M.changes(r.changeRequests, r.reopenedTasks));
    out.push(r.evidence.runs ? M.evidence(r.evidence.passRate, r.evidence.passing, r.evidence.runs) : M.noRuns);
    out.push(M.tasks(r.tasks.done, r.tasks.total, r.openClarifications));
    if (r.velocity) out.push(i18n.msg(r.lang).forecast.metricsVelocity(r.velocity)); // 1.14 B4
    if (r.warning) out.push("  ⚠ " + r.warning);
    if (r.note) out.push(r.note);
    return out;
  }
  if (!r.features.length) return [M.noFeatures(r.specsDir)];
  const out = [M.projectHead(r.features.length)];
  const w = Math.min(28, Math.max(8, ...r.features.map((m) => m.feature.length)));
  for (const m of r.features) {
    out.push("  " + m.feature.padEnd(w) + "  " + M.row(m.createdAt ? m.createdAt.slice(0, 10) : "—", fmtHours(m.leadTime.complete && m.leadTime.complete.hours),
      m.rework == null ? "—" : m.rework + (m.reworkLowerBound ? "+" : ""), m.forcedApprovals, m.changeRequests, pass(m.evidence), `${m.tasks.done}/${m.tasks.total}`));
  }
  const A = r.aggregates;
  const num = (v, unit = "") => (v == null ? "—" : v + unit);
  for (const k of ["avg", "median"]) { // no tasks column here: an average "0.33/2" says less than the totals line
    out.push("  " + M[k].padEnd(w) + "  " + M.row("", fmtHours(A.leadTimeHours.complete[k]), num(A.rework[k]), num(A.forcedApprovals[k]),
      num(A.changeRequests[k]), num(A.evidencePassRate[k], "%"), null));
  }
  const reqLead = A.leadTimeHours.requirements, desLead = A.leadTimeHours.design, taskLead = A.leadTimeHours.tasks;
  if (reqLead.n || desLead.n || taskLead.n) {
    out.push(M.medianLeads([["requirements", reqLead], ["design", desLead], ["tasks", taskLead]].filter(([, s]) => s.n).map(([ph, s]) => `${M.phase[ph]} ${fmtHours(s.median)}`).join(" · ")));
  }
  out.push(M.totals(r.totals.tasksDone, r.totals.tasksTotal, r.totals.evidenceRuns ? `${r.totals.evidencePassRate}%` : "—", r.totals.evidenceRuns, r.totals.changeRequests, r.totals.reopenedTasks));
  if (r.velocity) out.push(i18n.msg(r.lang).forecast.metricsVelocity(r.velocity)); // 1.14 B4
  return out;
}

// ---------------------------------------------------------------------------
// Feature lifecycle — remove / rename / archive (keeps roadmap.json deps consistent)
// ---------------------------------------------------------------------------

// Drop a feature slug from roadmap.json: its own entry and any dependsOn that referenced it.
// archived (1.16 E3): an archive — the feature moves to its milestones' `archived` list instead of leaving them (a remove
// drops it; a rename renames it). → milestonesFollow's { changed, invalid }.
function pruneRoadmapRefs(projectDir, slug, renameTo, archived) {
  return withRoadmapLock(projectDir, () => pruneRoadmapRefsLocked(projectDir, slug, renameTo, archived), (b) => { throw new Error(roadmapBusyResult(projectDir, b).error); });
}
// A lifecycle result's milestone fields: milestonesUpdated (the names changed) and milestonesInvalid ({ count, names, notList? }
// — stored entries left as they are, 1.16 verify NEW-1).
const milestoneResult = (ms) => ({ ...(ms && ms.changed.length ? { milestonesUpdated: ms.changed } : {}), ...(ms && ms.invalid ? { milestonesInvalid: ms.invalid } : {}) });
function pruneRoadmapRefsLocked(projectDir, slug, renameTo, archived) {
  const rm = readRoadmap(projectDir);
  if (!rm || !rm.features) return { changed: [], invalid: null };
  if (renameTo) {
    if (rm.features[slug]) { rm.features[renameTo] = rm.features[slug]; delete rm.features[slug]; }
  } else {
    delete rm.features[slug];
  }
  for (const k of Object.keys(rm.features)) {
    const dep = rm.features[k].dependsOn;
    if (!Array.isArray(dep)) continue;
    rm.features[k].dependsOn = renameTo ? dep.map((d) => (d === slug ? renameTo : d)) : dep.filter((d) => d !== slug);
  }
  const milestones = milestonesFollow(rm, slug, renameTo ? "rename" : archived ? "archive" : "remove", renameTo); // 1.16 E3
  writeRoadmap(projectDir, rm);
  return milestones;
}

// remove / archive / rename / restore: the folder's lock (withMoveLock), then the roadmap lock around the move and the
// roadmap.json prune, the feature re-resolved under them (it may have moved meanwhile); the ROADMAP.md refresh after both.
function removeFeature(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  sweepTombstones(f.root);
  const res = withMoveLock(projectDir, f.dir, f.slug, null, () => withRoadmapLock(projectDir, () => removeFeatureLocked(projectDir, name)));
  if (res.ok) maybeRefreshRoadmap(projectDir);
  return res;
}
// A feature folder is removed in two steps: renamed to a dot TOMBSTONE (`.specs/.removing-<slug>-<token>/`, its .lock
// inside), then deleted there. fs.rmSync of the folder in place deleted its .lock early while the folder still existed: a
// waiter created a fresh lock in the half-deleted folder, got it, wrote into it — and the removed feature came back
// (.state.json, .history/) after an ok remove. Renamed first, the old path is gone at once: a waiter's lock create answers
// ENOENT and its re-resolve answers "not found". Dot folders are never features (list, roadmap, catalog, drift, hooks skip
// them) and the maintained .specs/.gitignore ignores `.removing-*/`; a tombstone left by a failed delete (a file held open on
// Windows) is swept by the next remove.
const TOMBSTONE_PREFIX = ".removing-";
const TOMBSTONE_SWEEP_AGE_MS = 60 * 1000; // younger: another process may still be deleting it
function sweepTombstones(root) {
  for (const n of safeReaddir(root)) {
    if (!n.startsWith(TOMBSTONE_PREFIX)) continue;
    const p = path.join(root, n);
    try {
      if (Date.now() - fs.statSync(p).mtimeMs < TOMBSTONE_SWEEP_AGE_MS) continue;
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
    } catch { /* best-effort: still held open — the next remove tries again */ }
  }
}
function removeFeatureLocked(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir, root } = f;
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  invalidateReadCache(); // a folder moved or removed: the per-call read cache can't follow it
  const tomb = path.join(root, TOMBSTONE_PREFIX + slug + "-" + require("crypto").randomBytes(4).toString("hex"));
  const inUse = moveDirOrBusy(projectDir, slug, dir, tomb); // the folder (and its .lock, ours) leaves the feature path at once
  if (inUse) return inUse;
  try { fs.rmSync(tomb, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); } catch { /* left as a tombstone: swept later */ }
  const ms = pruneRoadmapRefs(projectDir, slug);
  return { ok: true, action: "remove", feature: slug, ...milestoneResult(ms) }; // 1.16 E3: dropped from its milestones
}

function archiveFeature(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const res = withMoveLock(projectDir, f.dir, f.slug, null, (moved) => withRoadmapLock(projectDir, () => archiveFeatureLocked(projectDir, name, moved)));
  if (res.ok) maybeRefreshRoadmap(projectDir);
  return res;
}
function archiveFeatureLocked(projectDir, name, moved) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir, root } = f;
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  // restore needs what the prune below removes: it is recorded in the feature's own .state.json (a broken one is
  // refused like in every mutator — never rewritten).
  const state = readState(projectDir, slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const archRoot = path.join(root, "_archive");
  ensureDir(archRoot);
  const dest = path.join(archRoot, slug);
  if (fs.existsSync(dest)) return { ok: false, error: errs(projectDir).alreadyArchived(slug) };
  const record = { at: new Date().toISOString(), ...archiveRecord(readRoadmap(projectDir), slug) };
  // What the prune does to the roadmap, said out loud: every feature that depended on this one stops being blocked by it —
  // silently turning a blocked feature into a ready one when the archived work was never finished (roadmap's rule: a dep
  // is met at 100%). Measured before the move, in the feature's own language.
  const tracks = detectTracks(dir);
  const tasks = parseTasks(activeTasks(readIfExists(path.join(dir, "tasks.md")), tracks));
  const percent = featurePercent(detectPhase(dir, tracks), tasks.filter((t) => t.done).length, tasks.length, featureFlow(dir)); // C3: + the flow
  const R = i18n.msg(featureLang(projectDir, slug)).restore;
  invalidateReadCache(); // a folder moved or removed: the per-call read cache can't follow it
  const inUse = moveDirOrBusy(projectDir, slug, dir, dest);
  if (inUse) return inUse;
  moved(dest); // the lock went with the folder: released there once the archive is done
  writeFileAtomic(statePath(dest), JSON.stringify({ ...state, archived: record }, null, 2));
  const ms = pruneRoadmapRefs(projectDir, slug, undefined, true); // archived features leave the active roadmap (milestones: → archived)
  const res = { ok: true, action: "archive", feature: slug, dest: path.join("_archive", slug), dependentsPruned: record.dependents.map((d) => d.feature) };
  Object.assign(res, milestoneResult(ms)); // 1.16 E3
  if (res.dependentsPruned.length) {
    const list = res.dependentsPruned.join(", ");
    if (percent < 100) res.incompleteDependency = true; // stable: those features now read as unblocked, the work isn't done
    res.note = percent < 100 ? R.prunedIncomplete(slug, percent, list) : R.prunedDependents(list);
  }
  return res;
}

function renameFeature(projectDir, name, newName) {
  if (newName == null || !String(newName).trim()) return { ok: false, error: errs(projectDir).renameNeedsName };
  const from = existingFeature(projectDir, name);
  if (!from.ok) return { ok: false, error: from.error };
  const res = withMoveLock(projectDir, from.dir, from.slug, null, (moved) => withRoadmapLock(projectDir, () => renameFeatureLocked(projectDir, name, newName, moved)));
  if (res.ok) maybeRefreshRoadmap(projectDir);
  return res;
}
function renameFeatureLocked(projectDir, name, newName, moved) {
  const from = existingFeature(projectDir, name);
  if (!from.ok) return { ok: false, error: from.error };
  const to = resolveFeature(projectDir, newName);
  if (!to.ok) return { ok: false, error: to.error };
  const oldSlug = from.slug;
  const newSlug = to.slug;
  if (newSlug === oldSlug) return { ok: false, error: errs(projectDir).sameSlug };
  const oldDir = from.dir;
  const newDir = to.dir;
  if (fs.existsSync(newDir)) return { ok: false, error: errs(projectDir).alreadyExists(newSlug) };
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  // Every other reference to the feature follows it — planned while the old folder still resolves, written after the move.
  const plan = renamePlan(projectDir, oldDir, oldSlug, newSlug);
  if (plan.error) return { ok: false, error: plan.error };
  invalidateReadCache(); // a folder moved or removed: the per-call read cache can't follow it
  const inUse = moveDirOrBusy(projectDir, oldSlug, oldDir, newDir);
  if (inUse) return inUse;
  moved(newDir); // the lock went with the folder: released there once the rename is done
  const ms = pruneRoadmapRefs(projectDir, oldSlug, newSlug);
  for (const s of plan.supersedes) writeFileAtomic(s.file, s.text);
  for (const r of plan.records) writeFileAtomic(r.file, JSON.stringify(r.state, null, 2));
  const res = { ok: true, action: "rename", from: oldSlug, to: newSlug };
  Object.assign(res, milestoneResult(ms)); // 1.16 E3
  const where = (x) => (x.archived ? "_archive/" : "") + x.feature;
  const fm = i18n.msg(featureLang(projectDir, newSlug));
  const notes = [];
  if (plan.supersedes.length) {
    res.supersedesUpdated = plan.supersedes.map((s) => ({ feature: s.feature, archived: s.archived, refs: s.refs }));
    notes.push(fm.supersedes.renamed(plan.supersedes.map((s) => `${where(s)} (${s.refs})`).join(", ")));
  }
  if (plan.records.length) {
    res.archiveRecordsUpdated = plan.records.map((r) => r.feature);
    notes.push(fm.restore.renamedRecords(plan.records.map((r) => r.feature).join(", ")));
  }
  if (notes.length) res.note = notes.join(" · ");
  return res;
}

// What a rename rewrites besides roadmap.json, computed BEFORE the folder moves (the old slug must still resolve):
//   • `_Supersedes: <old>/US-n.AC-m_` in every OTHER feature's requirements.md (active and archived) → the new slug, so
//     the living catalog keeps striking the replaced ACs through (they turned phantom, and the auto-refreshed SPECS.md
//     listed the old and the new behaviour as current). Only real markers, never one in a comment or fenced code; the
//     edit is content, so an approved requirements.md shows as changed-since-approval (re-review, then re-approve).
//   • archived features' .state.json `archived` record (entry.dependsOn, dependents[].feature / .dependsOn) → the new
//     slug, so restore puts the dependency back instead of reporting the renamed feature as gone. A state file that
//     can't be read and names the old slug refuses the rename — never rewritten, never silently left stale.
// → { supersedes: [{ feature, archived, file, text, refs }], records: [{ feature, file, state }] } or { error }.
function renamePlan(projectDir, oldDir, oldSlug, newSlug) {
  const oldKey = dirKey(oldDir);
  const supersedes = [];
  const records = [];
  for (const fd of featureDirs(projectDir)) {
    if (dirKey(fd.dir) === oldKey) continue;
    const reqFile = path.join(fd.dir, "requirements.md");
    const raw = readIfExists(reqFile);
    if (raw != null && /_Supersedes:/i.test(raw)) {
      const upd = renameSupersedesRefs(projectDir, fd.dir, raw, oldKey, newSlug);
      if (upd.refs) supersedes.push({ feature: fd.slug, archived: fd.archived, file: reqFile, text: upd.text, refs: upd.refs });
    }
    if (!fd.archived) continue;
    const sf = statePath(fd.dir);
    if (!fs.existsSync(sf)) continue;
    const st = stateFromFile(projectDir, sf);
    if (st.invalid) {
      if ((readIfExists(sf) || "").includes(JSON.stringify(oldSlug))) return { error: st.invalid };
      continue;
    }
    const rec = isObj(st.archived) ? st.archived : null;
    if (!rec) continue;
    let changed = false;
    const swap = (list) => {
      if (!Array.isArray(list) || !list.includes(oldSlug)) return list;
      changed = true;
      return list.map((d) => (d === oldSlug ? newSlug : d));
    };
    if (isObj(rec.entry) && Array.isArray(rec.entry.dependsOn)) rec.entry.dependsOn = swap(rec.entry.dependsOn);
    for (const d of Array.isArray(rec.dependents) ? rec.dependents : []) {
      if (!isObj(d)) continue;
      if (d.feature === oldSlug) { d.feature = newSlug; changed = true; }
      if (Array.isArray(d.dependsOn)) d.dependsOn = swap(d.dependsOn);
    }
    if (changed) records.push({ feature: fd.slug, file: sf, state: st });
  }
  return { supersedes, records };
}
// requirements.md text with every real `_Supersedes:_` reference that resolves to the renamed folder (resolveSupersedes'
// rule: of the other folders the name reaches, the first holding the AC, else the first) pointed at `newSlug`.
function renameSupersedesRefs(projectDir, fromDir, raw, oldKey, newSlug) {
  const visible = new Map(criterionBlocks(raw).cleaned.map((c) => [c.line, c.text]));
  const fromKey = dirKey(fromDir);
  const acs = new Map();
  const acsOf = (dir) => {
    if (!acs.has(dir)) acs.set(dir, acIndex(readIfExists(path.join(dir, "requirements.md")) || ""));
    return acs.get(dir);
  };
  const hitsOld = (name, ac) => {
    const targets = locateFeatures(projectDir, name).filter((t) => dirKey(t.dir) !== fromKey);
    if (!targets.some((t) => dirKey(t.dir) === oldKey)) return false;
    return dirKey((targets.find((t) => acsOf(t.dir).has(ac)) || targets[0]).dir) === oldKey;
  };
  let refs = 0;
  const text = raw.replace(new RegExp(RE_SUPERSEDES_SRC, "gi"), (whole, value, offset) => {
    const line = (raw.slice(0, offset).match(/\n/g) || []).length + 1;
    if (!(visible.get(line) || "").includes("_Supersedes:")) return whole; // inside a comment or fenced code: no marker
    // (^|[,;])(\s*`?\s*)([^,;`/]+?)(\s*\/\s*)(US-…) with the lead taken whole ((?=(…))\2) and the name read up to its last
    // non-blank unit: the same references, without the cubic backtracking over a long blank run (1.17 H). (The old pattern
    // also read a lone blank before the '/' as a name — "" names no feature, so nothing was ever rewritten there.)
    const nv = value.replace(/(^|[,;])(?=(\s*`?\s*))\2([^,;`/\s](?:[^,;`/]*[^,;`/\s])?)(\s*\/\s*)(US-\d+\.AC-\d+)/g, (t, sep, lead, name, slash, ac) => {
      if (!hitsOld(name.trim(), ac)) return t;
      refs++;
      return sep + lead + newSlug + slash + ac;
    });
    return nv === value ? whole : whole.slice(0, whole.length - 1 - value.length) + nv + "_";
  });
  return { text, refs };
}

// What `remove` would delete, returned INSTEAD of deleting when the caller hasn't confirmed.
function removePreview(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  // Same order as removeFeature: never preview (and promise) a delete that the confirmed call would refuse.
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  let files = 0;
  const walk = (d) => safeReaddir(d).forEach((e) => {
    const p = path.join(d, e);
    let st;
    // lstat, never stat: a symlink/junction is ONE entry, as for fs.rmSync — following it would count files
    // outside the feature (that the delete never touches) and recurse forever through a link loop.
    try { st = fs.lstatSync(p); } catch { return; }
    if (st.isDirectory() && !st.isSymbolicLink()) walk(p); else files++;
  });
  walk(f.dir);
  return {
    ok: false,
    needsConfirm: true,
    action: "remove",
    feature: f.slug,
    wouldDelete: { dir: f.dir, files, entries: safeReaddir(f.dir).sort() },
    error: i18n.msg(featureLang(projectDir, f.slug)).featureOps.removeNeedsConfirm(f.slug, files),
  };
}

// The actions are spec_feature's enum, exactly — no hidden alias (a CLI-only `feature delete` used to remove a folder
// the MCP tool refused to, and the help never named it).
function manageFeature(projectDir, action, name, arg, opts = {}) {
  switch (String(action || "").trim().toLowerCase()) {
    case "remove":
      // Deleting a spec folder can't be undone: without an explicit confirm (MCP confirm:true, CLI --yes)
      // nothing is deleted and the caller gets what WOULD be.
      if (opts.confirm !== true) return removePreview(projectDir, name);
      return removeFeature(projectDir, name);
    case "archive":
      return archiveFeature(projectDir, name);
    case "rename":
      return renameFeature(projectDir, name, arg);
    case "restore":
      return restoreFeature(projectDir, name);
    case "flow": // C3: opts.flow (MCP `flow`), else the positional value (CLI `feature flow <name> <flow>`)
      return setFeatureFlowLocked(projectDir, name, opts.flow != null ? opts.flow : arg);
    default:
      return { ok: false, error: errs(projectDir).badAction };
  }
}

// ---------------------------------------------------------------------------
// Living catalog (.specs/SPECS.md) · _Supersedes:_ · restore · drift since finish
// ---------------------------------------------------------------------------

// `_Supersedes: <feature>/US-n.AC-m[, …]_` — English-stable, on a criterion of requirements.md (its line or a sub-line):
// that criterion replaces an AC of an earlier feature, active or archived. Read like the task markers: HTML comments
// and fenced code never count, the value runs to the first underscore followed by whitespace, punctuation or the end
// (requirements are prose: `…_.`, `(…_)`, `**…_**`, `…_|`) and is kept whole (then split on , / ;). The referenced ID
// is ANOTHER feature's — stripped before this feature's own AC IDs are read.
// A long list wraps like any criterion: a newline continues the value unless the next line is blank or opens a new
// list item / block (heading, quote, table row, rule, fence) — criterionBlocks' boundaries, so traceCheck (whole
// text), acIndex and supersedesMarkers (one criterion at a time, lines joined by "\n") all read the same marker.
const SUP_NL = "\\r?\\n(?![ \\t]*(?:\\r?\\n|$|(?:[-*+]|\\d+[.)])[ \\t]|#{1,6}[ \\t]|[>|]|```|~~~|(?:-{3,}|={3,}|\\*{3,})[ \\t]*(?:\\r?\\n|$)))";
// The value never runs into a second marker (an unclosed one before it stays unclosed).
// The blanks after the colon: all of them (the value starts at its first other unit) — or, only when that finds no closing
// "_", all but the last one when the next unit is that "_" (`_Supersedes: _`: a one-blank value). That is what
// `_Supersedes:[ \t]*(…+?)_` read, without rescanning the value from each of a long blank run's units (1.17 H).
const RE_SUPERSEDES_SRC = "_Supersedes:(?:[ \\t]*(?=[^ \\t])|[ \\t]*?(?=[ \\t]_))((?:(?!_Supersedes:)[^\\r\\n]|" + SUP_NL + ")+?)_(?=[\\s.,;:!?)\\]*`|'\"]|$)";
// Safety net: a marker never closed runs to the end of its criterion — its foreign ID must never become one of this
// feature's ACs; supersedesMarkers reports it (reason `unterminated`).
const RE_SUPERSEDES_OPEN_SRC = "_Supersedes:[ \\t]*((?:[^\\r\\n]|" + SUP_NL + ")*)";
function stripSupersedes(text) {
  return String(text || "").replace(new RegExp(RE_SUPERSEDES_SRC, "gi"), "").replace(new RegExp(RE_SUPERSEDES_OPEN_SRC, "gi"), "");
}
// A criterion block's lines joined by "\n" (criterionBlocks joins them with spaces, which would erase the line starts
// the wrap rule above reads). `byLine` = line number → its cleaned text; every cleaned line in the range is a part.
function blockLines(byLine, b) {
  const out = [];
  for (let l = b.line; l <= b.endLine; l++) if (byLine.has(l)) out.push({ line: l, text: byLine.get(l) });
  return out;
}
function lineMap(cleaned) {
  return new Map(cleaned.map((c) => [c.line, c.text]));
}
// The AC a criterion block defines (its leading ID, else the first own ID it names), or null.
function criterionAc(text) {
  const m = String(text || "").match(RE_DEFINES_AC);
  return m ? m[1] : [...extractAcIds(stripSupersedes(text))][0] || null;
}
// → [{ ref, feature, ac, by, line[, unterminated] }] — `by` = the AC of the criterion carrying the marker (null outside
// one); `line` = where the marker starts. Read per criterion, so a marker wrapped onto its next line is ONE marker.
// A table row is a block break for criterionBlocks, yet acIndex reads table-row ACs: there the row itself is it (and
// any other line outside a criterion is its own unit).
function supersedesMarkers(reqText) {
  const { cleaned, blocks } = criterionBlocks(reqText || "");
  const byLine = lineMap(cleaned);
  const inBlock = new Set();
  const units = blocks.map((b) => {
    const ls = blockLines(byLine, b);
    ls.forEach((l) => inBlock.add(l.line));
    return { ls, block: true };
  });
  for (const c of cleaned) if (!inBlock.has(c.line)) units.push({ ls: [c], block: false });
  const out = [];
  const fold = (s) => s.replace(/\s+/g, " ").trim();
  for (const u of units) {
    const text = u.ls.map((l) => l.text).join("\n");
    if (!/_Supersedes:/i.test(text)) continue;
    const by = u.block ? criterionAc(text) : text.startsWith("|") ? criterionAc(text) : null;
    const lineAt = (i) => u.ls[(text.slice(0, i).match(/\n/g) || []).length].line;
    const re = new RegExp(RE_SUPERSEDES_SRC, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      for (const ref of m[1].split(/[,;]/).map((s) => stripEnds(fold(s), isBacktickUnit).trim()).filter(Boolean)) {
        const mm = ref.match(/^(.+?)\s*\/\s*(US-\d+\.AC-\d+)$/);
        out.push({ ref, feature: mm ? mm[1].trim() : null, ac: mm ? mm[2] : null, by, line: lineAt(m.index) });
      }
    }
    // Whatever opens and never closes, once the closed markers are blanked out (same length, so positions hold).
    const rest = text.replace(new RegExp(RE_SUPERSEDES_SRC, "gi"), (s) => s.replace(/[^\n]/g, " "));
    const reOpen = new RegExp(RE_SUPERSEDES_OPEN_SRC, "gi");
    while ((m = reOpen.exec(rest)) !== null) {
      out.push({ ref: fold(m[1]), feature: null, ac: null, by, line: lineAt(m.index), unterminated: true });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}
// Folder identity for keys and comparisons: on a case-insensitive file system `.specs/Billing` IS `.specs/billing`.
const dirKey = (d) => (FOLD_CASE ? path.resolve(d).toLowerCase() : path.resolve(d));
// Markers → { valid: [{…, feature (slug), ac, archived, dir}], phantom: [{…, reason}] }. Reasons (English-stable):
// bad-ref (not <feature>/US-n.AC-m) · unterminated (no closing `_`) · unknown-feature (no active or archived folder) ·
// unknown-ac · self. `cache` (dir → acIndex) is shared across features by the catalog.
function resolveSupersedes(projectDir, fromDir, markers, cache) {
  const acsOf = (t) => {
    if (!cache.has(t.dir)) cache.set(t.dir, acIndex(readIfExists(path.join(t.dir, "requirements.md")) || ""));
    return cache.get(t.dir);
  };
  const valid = [];
  const phantom = [];
  for (const mk of markers) {
    const base = { ref: mk.ref, by: mk.by, line: mk.line };
    if (mk.unterminated) { phantom.push({ ...base, reason: "unterminated" }); continue; }
    if (!mk.feature || !mk.ac) { phantom.push({ ...base, reason: "bad-ref" }); continue; }
    const targets = locateFeatures(projectDir, mk.feature);
    if (!targets.length) { phantom.push({ ...base, feature: slugify(mk.feature), ac: mk.ac, reason: "unknown-feature" }); continue; }
    const others = targets.filter((t) => dirKey(t.dir) !== dirKey(fromDir));
    if (!others.length) { phantom.push({ ...base, feature: targets[0].slug, ac: mk.ac, reason: "self" }); continue; }
    const hit = others.find((t) => acsOf(t).has(mk.ac));
    if (!hit) { phantom.push({ ...base, feature: others[0].slug, ac: mk.ac, reason: "unknown-ac" }); continue; }
    valid.push({ ...base, feature: hit.slug, ac: mk.ac, archived: hit.archived, dir: hit.dir });
  }
  return { valid, phantom };
}
// trace_check's part: the declared replacements and the ones that resolve to nothing — warnings, never an AC gap.
function supersedesTrace(projectDir, dir, reqsRaw) {
  const r = resolveSupersedes(projectDir, dir, supersedesMarkers(reqsRaw), new Map());
  return { supersedes: r.valid.map(({ dir: _d, ...v }) => v), phantomSupersedes: r.phantom };
}
TRACE_INFO_FIELDS.add("supersedes").add("phantomSupersedes"); // informational, so traceGaps never lists them as gaps
// Localized "⚠" lines for a trace_check result's phantom _Supersedes:_ references (CLI).
function supersedesWarnings(tr, lang) {
  const W = i18n.msg(lang).supersedes;
  return (tr && Array.isArray(tr.phantomSupersedes) ? tr.phantomSupersedes : []).map((p) => W.phantom(p.ref, W.reason[p.reason] || p.reason, p.by));
}

// --- catalog ---

const day = (iso) => String(iso || "").slice(0, 10);
// One line of an AC for the catalog: whitespace folded, its own leading ID and the _Supersedes:_ marker dropped.
function acOneLine(text, id, max = 200) { // max: the length cap (spec_export shows the whole criterion: Infinity)
  // A sub-list bullet that only carried the marker ("… owner - _Supersedes: x/US-1.AC-3_") goes with it, and so do the
  // emphasis around it ("**_Supersedes: …_**"), the parentheses around it and the space before the punctuation after
  // it ("… days (_Supersedes: …_)." → "… days.").
  let s = String(text || "").replace(new RegExp("(?:(?:^|\\s)[-*+]\\s+)?(?:" + RE_SUPERSEDES_SRC + "|" + RE_SUPERSEDES_OPEN_SRC + ")", "gi"), "\u0000")
    .replace(/(\*\*|__|\*|~~)\s*\u0000\s*\1/g, "\u0000")
    .replace(/(?<!\s)\s*\(\s*\u0000\s*\)/g, "").replace(/(?<!\s)\s*\u0000\s*(?=[.,;:!?]|$)/g, "").replace(/\u0000/g, " ").replace(/\s+/g, " ").trim(); // (?<!\s): a blank run read from its start only (1.17 H)
  if (s.startsWith("|")) s = s.split("|").map((c) => c.trim()).filter((c) => c && c.replace(/[*_`]/g, "") !== id).join(" — ");
  const esc = id.replace(/\./g, "\\.");
  s = s.replace(new RegExp("^(?:\\*\\*|__|\\*|_)?" + esc + "(?:\\*\\*|__|\\*|_)?\\s*(?:[—–:-]\\s*)?"), "").replace(new RegExp("\\s*\\(" + esc + "\\)"), "");
  if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  return s || id;
}
function catalogData(projectDir) {
  const lang = projectLang(projectDir);
  const cache = new Map();
  const srcs = featureDirs(projectDir).map((s) => {
    const tracks = detectTracks(s.dir);
    const reqRaw = readContained(projectDir, path.join(s.dir, "requirements.md")) || "";
    return { ...s, tracks, phase: detectPhase(s.dir, tracks), reqRaw, state: stateFromFile(projectDir, statePath(s.dir)) };
  });
  // Superseded ACs, keyed by the target folder (dirKey: case-folded where the file system is) + ID → the
  // "<feature>/<AC>" that replaces them. 1.15: only a SHIPPED declaring feature (featureShipped) retires the AC; one still in
  // flight marks it "to be superseded" (supersedePending) — the catalog says what the system does today; one archived
  // without ever shipping (abandoned) declares nothing.
  const supBy = new Map(); // key → every declarer (drafts included)
  const supLiveBy = new Map(); // key → the SHIPPED declarers — a declaration added after the ship waits (shippedSupersedeKeys)
  const push = (m, k, who) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(who)) m.get(k).push(who); };
  for (const s of srcs) {
    s.sup = resolveSupersedes(projectDir, s.dir, supersedesMarkers(s.reqRaw), cache).valid;
    s.shipped = featureShipped(s.state);
    if (s.archived && !s.shipped) continue;
    const shippedKeys = s.shipped ? shippedSupersedeKeys(projectDir, s.dir, s.state, s.reqRaw, cache) : null;
    for (const v of s.sup) {
      const k = dirKey(v.dir) + "\n" + v.ac;
      const who = s.slug + (v.by ? "/" + v.by : "");
      push(supBy, k, who);
      if (s.shipped && (!shippedKeys || shippedKeys.has(k))) push(supLiveBy, k, who);
    }
  }
  const features = srcs.map((s) => {
    // A removed track's [SaaS]/[AI] criteria are inactive — not what the system does.
    const acs = [...acIndex(activeDesign(s.reqRaw, s.tracks)).values()].sort((a, b) => a.line - b.line).map((e) => {
      const o = { id: e.id, text: acOneLine(e.text, e.id) };
      if (placeholderReport(e.text).length) o.template = true;
      const key = dirKey(s.dir) + "\n" + e.id;
      if (supLiveBy.has(key)) o.supersededBy = supLiveBy.get(key); // retired: named by the shipped declarers only
      else if (supBy.has(key)) { o.supersededBy = supBy.get(key); o.supersedePending = true; } // a draft's plan
      const mine = s.sup.filter((v) => v.by === e.id).map((v) => v.feature + "/" + v.ac);
      if (mine.length) o.supersedes = mine;
      return o;
    });
    let fin = isObj(s.state.finished) && typeof s.state.finished.at === "string" ? s.state.finished.at : null;
    const arch = isObj(s.state.archived) && typeof s.state.archived.at === "string" ? s.state.archived.at : null;
    // Finished = complete with a CURRENT finish baseline, its artifacts as approved and every tick verified — what
    // next_action and spec_finish call finished, so SPECS.md never says ✅ while they say "finish it again" / "re-review".
    // It reads as complete until it is finished (verified, re-approved) again when: an artifact changed after its own
    // approval (changedSinceApproval, by CONTENT — a pre-1.11 approval judged by file date is no evidence, as in finish; an
    // unapproved criterion edit is not "what the system does today"), a ticked task's latest run failed / its _Verify:_
    // never ran (verificationStatus), or it changed since the finish (staleFinish: a change request or re-approval, then —
    // the cheap checks first, only for a feature still finished — an _Implements:_ file the baseline never recorded, the
    // bounded walk next_action and drift do). 1.16 U review 3: nor while a gate is pending (pendingGateList — a revoked approval,
    // a phase that became due after the finish: next_action asks for the approval, spec_finish refuses) — existence checks only.
    if (fin && !s.archived && s.phase === "complete") {
      const appr = isObj(s.state.approvals) ? s.state.approvals : {};
      const cs = changedSinceApproval(s.dir, appr, s.tracks, s.state.kind, { detail: true });
      if (pendingGateList(s.dir, s.tracks, s.state.kind || "feature", appr).length ||
        cs.changed.some((x) => !cs.byDate.includes(x)) || verificationStatus(projectDir, s.slug, s.dir).unverified.length ||
        staleFinish(projectDir, s.state, "", { newFiles: false }) ||
        staleFinish(projectDir, s.state, activeTasks(readIfExists(path.join(s.dir, "tasks.md")) || "", s.tracks))) fin = null;
    }
    const status = s.archived ? "archived" : s.phase === "complete" ? (fin ? "finished" : "complete") : "active";
    const kind = s.state.kind === "bugfix" || s.state.kind === "spike" ? s.state.kind : "feature";
    const f = { feature: s.slug, kind, status, phase: s.phase, tracks: trackLabel(s.tracks), archived: s.archived, acs };
    if (fin) f.finishedAt = fin;
    if (arch && s.archived) f.archivedAt = arch;
    f.decisions = catalogDecisions(s.dir); // 1.14 C2: decisions.md — { count, items: [{ id, title, kind, supersededBy? }] }
    if (kind === "spike") { const si = spikeInfo(s.dir); f.spike = { question: si.question, outcome: si.outcome }; } // 1.14 C2
    return f;
  });
  const all = features.flatMap((f) => f.acs);
  const retired = (a) => a.supersededBy && !a.supersedePending;
  const superseded = all.filter(retired).length;
  // Current = what the system does today: neither retired by a shipped feature nor a criterion of an abandoned feature
  // (archived without ever shipping). A shipped feature archived to declutter still does what its criteria say. `pending`
  // (to be superseded) is a subset of current — the totals line reads "N current (P to be superseded), S superseded".
  const abandoned = new Set(srcs.filter((s) => s.archived && !s.shipped).map((s) => s.slug));
  const currentAcs = features.filter((f) => !abandoned.has(f.feature)).flatMap((f) => f.acs).filter((a) => !retired(a));
  const pending = currentAcs.filter((a) => a.supersedePending).length;
  const totals = { features: features.length, acs: all.length, current: currentAcs.length, superseded, pending };
  const data = { lang, features, totals };
  const xac = crossFeatureAcs(projectDir); // 1.16 Q2: near-duplicate / conflicting criteria across the active features
  data.crossAcs = { pairs: xac.pairs, truncated: xac.truncated };
  data.markdown = renderCatalogMd(data, lang, path.basename(path.resolve(projectDir)));
  return data;
}
function renderCatalogMd(data, lang, proj) {
  const C = i18n.msg(lang).catalog;
  const P = i18n.msg(lang).phaseNames || {};
  const icon = { finished: "✅", complete: "☑", active: "🟡", archived: "🗄" };
  const code = (s) => "`" + s + "`";
  const t = data.totals;
  let md = `# ${C.title(proj)}\n\n<!-- ${C.autogen} -->\n\n> ${C.intro}\n\n${C.totals(t.features, t.acs, t.current, t.superseded, t.pending)}\n`;
  if (!data.features.length) md += `\n_${C.noFeatures}_\n`;
  for (const f of data.features) {
    const SP = i18n.msg(lang).spike; // 1.14 C2: a spike reads apart (its question + decision instead of ACs)
    md += `\n## ${icon[f.status]} ${f.feature} — ${C.status[f.status]}${f.status === "active" ? ` (${P[f.phase] || f.phase})` : ""}${f.kind === "spike" ? " · 🔬 " + SP.kind : ""}\n\n`;
    const meta = [f.tracks, f.finishedAt ? C.finishedOn(day(f.finishedAt)) : null, f.archivedAt ? C.archivedOn(day(f.archivedAt)) : null].filter(Boolean);
    md += `_${meta.join(" · ")}_\n\n`;
    const pre = [];
    if (f.spike) pre.push(`- ${SP.catalogQuestion(f.spike.question || "—")}`, `- ${f.spike.outcome ? SP.catalogOutcome(f.spike.outcome) : SP.catalogPending}`);
    if (f.decisions && f.decisions.count) {
      const D = i18n.msg(lang).decisions;
      pre.push(`- 📝 ${D.catalogLine(f.decisions.count, f.decisions.items.map((d) => (d.supersededBy ? `~~${d.id} ${d.title}~~` : `${d.id} ${d.title}`)).join(" · "))}`);
    }
    if (pre.length) md += pre.join("\n") + "\n" + (f.acs.length || !f.spike ? "\n" : "");
    if (!f.acs.length && !f.spike) md += `_${C.noAcs}_\n`;
    for (const a of f.acs) {
      const body = `**${a.id}** — ${a.text}`;
      let line = a.supersedePending ? `- ${body} — ${C.toBeSupersededBy(a.supersededBy.map(code).join(", "))}` // a draft's plan
        : a.supersededBy ? `- ~~${body}~~ — ${C.supersededBy(a.supersededBy.map(code).join(", "))}` : `- ${body}`;
      if (a.supersedes) line += ` _(${C.supersedes(a.supersedes.map(code).join(", "))})_`;
      if (a.template) line += ` _(${C.template})_`;
      md += line + "\n";
    }
  }
  return md + renderCrossAcsMd(data.crossAcs, lang); // 1.16 Q2 (only when there is a pair)
}
// spec_catalog {write} / `dev-spec catalog [--write]`: the structure (+ markdown unless writing). Writing never
// replaces a same-named file dev-spec didn't generate (the roadmap's guard) — the result is then an error.
function catalog(projectDir, opts = {}) {
  const root = specsRoot(projectDir);
  const file = path.join(root, "SPECS.md");
  const data = catalogData(projectDir);
  const res = { ok: true, file, lang: data.lang, totals: data.totals, features: data.features, crossAcs: data.crossAcs, wrote: false };
  if (opts.write) {
    const E = i18n.msg(data.lang).err;
    if (!fs.existsSync(root)) return { ...res, ok: false, error: E.noSpecs(root) };
    if (!isGeneratedOrAbsent(file)) return { ...res, ok: false, skipped: true, error: E.notGenerated("SPECS.md") };
    writeFileAtomic(file, i18n.portableCli(data.markdown)); // committed: `dev-spec`, never a machine path (1.21 F3)
    res.wrote = true;
  } else res.markdown = data.markdown;
  return res;
}
// Keep SPECS.md current after a mutation — only once it exists and carries the marker. Best-effort.
// → true when it rewrote the file (unchanged content is not rewritten: the hook runs this on every spec save).
function maybeRefreshCatalog(projectDir) {
  try {
    const file = path.join(specsRoot(projectDir), "SPECS.md");
    const cur = readIfExists(file);
    if (cur == null || !isGeneratedOrAbsent(file)) return false;
    const md = i18n.portableCli(catalogData(projectDir).markdown);
    if (md === cur) return false;
    writeFileAtomic(file, md);
    return true;
  } catch {
    return false; // best-effort
  }
}

// --- archive record → restore ---

// What archiving `slug` prunes from roadmap.json: its own entry and the dependsOn lists that name it (whole, so restore
// can put the name back where it was).
function archiveRecord(rm, slug) {
  const feats = rm.features || {};
  return {
    entry: isObj(feats[slug]) ? JSON.parse(JSON.stringify(feats[slug])) : null,
    dependents: Object.keys(feats).filter((k) => k !== slug && Array.isArray(feats[k].dependsOn) && feats[k].dependsOn.includes(slug))
      .map((k) => ({ feature: k, dependsOn: feats[k].dependsOn.slice() })),
  };
}
// `slug` back into a dependsOn list: after the dep that preceded it at archive time (if still there), else at its old index.
function reinsertDep(current, slug, original) {
  const idx = original.indexOf(slug);
  const prev = original.slice(0, Math.max(0, idx)).reverse().find((d) => current.includes(d));
  const at = prev != null ? current.indexOf(prev) + 1 : idx < 0 ? current.length : Math.min(idx, current.length);
  return [...current.slice(0, at), slug, ...current.slice(at)];
}
// The archived folder a name reaches (current or pre-1.11 slug) → { f, slug, from } or { error }.
function archivedFeature(projectDir, name) {
  const f = resolveFeature(projectDir, name);
  if (!f.ok) return { error: f.error };
  const archRoot = path.join(f.root, "_archive");
  const slug = [slugify(name), legacySlugify(name)].find((s) => s && isFeatureFolder(s, archRoot) && isDirSafe(path.join(archRoot, s)));
  if (!slug) return { error: i18n.msg(projectLang(projectDir)).restore.notArchived(f.slug) };
  return { f, slug, from: path.join(archRoot, slug) };
}
function restoreFeature(projectDir, name) {
  const a = archivedFeature(projectDir, name);
  if (a.error) return { ok: false, error: a.error };
  const res = withMoveLock(projectDir, a.from, a.slug, ".specs/_archive/" + a.slug + "/" + LOCK_FILE,
    (moved) => withRoadmapLock(projectDir, () => restoreFeatureLocked(projectDir, name, moved)));
  if (res.ok) maybeRefreshRoadmap(projectDir);
  return res;
}
function restoreFeatureLocked(projectDir, name, moved) {
  const a = archivedFeature(projectDir, name); // again, under the locks: it may have been restored meanwhile
  if (a.error) return { ok: false, error: a.error };
  const { f, slug, from } = a;
  const R0 = i18n.msg(projectLang(projectDir)).restore;
  const to = path.join(f.root, slug);
  if (fs.existsSync(to)) return { ok: false, error: R0.activeExists(slug) };
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  const st = stateFromFile(projectDir, statePath(from));
  if (st.invalid) return { ok: false, error: st.invalid };
  const R = i18n.msg(normalizeLang(st.lang || projectLang(projectDir))).restore;
  invalidateReadCache(); // a folder moved or removed: the per-call read cache can't follow it
  const inUse = moveDirOrBusy(projectDir, slug, from, to);
  if (inUse) return inUse;
  moved(to); // the lock went with the folder: released there once the restore is done

  const rec = isObj(st.archived) ? st.archived : null;
  const restored = { entry: false, dependsOn: [], dependents: [] };
  const skipped = [];
  if (rec) {
    const rm = readRoadmap(projectDir);
    // The record is hand-editable JSON and writeRoadmap only vets the file already on disk: every part that doesn't
    // have loadRoadmap's shape is left out (reported as `invalid`) so restore never writes a roadmap.json every other
    // mutator would then refuse.
    const invalid = (field) => skipped.push({ feature: slug, kind: "record", field, reason: "invalid" });
    // Only references to features that still exist come back (by their folder, as at archive time).
    const exists = (k) => typeof k === "string" && k !== slug && isFeatureFolder(k, f.root) && isDirSafe(path.join(f.root, k));
    // A reference to a feature that is ARCHIVED too (not gone) is handed to that feature's own archive record, so ITS
    // restore puts the edge back — in either order of archive → restore it used to be dropped as "gone" for good.
    const archRoot = path.join(f.root, "_archive");
    const others = new Map(); // archived slug → its state (null: unusable), written back below when handed an edge
    const handed = new Set();
    const archivedState = (k) => {
      if (typeof k !== "string" || k === slug || !isFeatureFolder(k, archRoot) || !isDirSafe(path.join(archRoot, k))) return null;
      if (!others.has(k)) {
        const o = stateFromFile(projectDir, statePath(path.join(archRoot, k)));
        others.set(k, o.invalid || !isObj(o.archived) ? null : o);
      }
      return others.get(k);
    };
    // `slug` depends on archived `d`: d's restore re-links it as one of its dependents.
    const handDependsOn = (d, original) => {
      const o = archivedState(d);
      if (!o) return false;
      const deps = Array.isArray(o.archived.dependents) ? o.archived.dependents : (o.archived.dependents = []);
      if (!deps.some((x) => isObj(x) && x.feature === slug)) deps.push({ feature: slug, dependsOn: original.slice() });
      handed.add(d);
      return true;
    };
    // Archived `k` depended on `slug`: k's restore brings the dependency back with its entry.
    const handDependent = (k, original) => {
      const o = archivedState(k);
      if (!o) return false;
      if (!isObj(o.archived.entry)) o.archived.entry = {};
      const cur = Array.isArray(o.archived.entry.dependsOn) ? o.archived.entry.dependsOn.filter((d) => typeof d === "string") : [];
      if (!cur.includes(slug)) o.archived.entry.dependsOn = reinsertDep(cur, slug, original);
      handed.add(k);
      return true;
    };
    if (rec.entry != null && !isObj(rec.entry)) invalid("entry");
    if (isObj(rec.entry) && !rm.features[slug]) {
      const entry = JSON.parse(JSON.stringify(rec.entry));
      if (entry.dependsOn !== undefined && !Array.isArray(entry.dependsOn)) { invalid("entry.dependsOn"); delete entry.dependsOn; }
      if (Array.isArray(entry.dependsOn)) {
        if (!entry.dependsOn.every((d) => typeof d === "string")) invalid("entry.dependsOn");
        const original = entry.dependsOn.filter((d) => typeof d === "string");
        entry.dependsOn = original.filter((d) => exists(d) ||
          (skipped.push({ feature: d, kind: "dependsOn", reason: handDependsOn(d, original) ? "archived" : "gone" }), false));
        restored.dependsOn = entry.dependsOn.slice();
      }
      rm.features[slug] = entry;
      restored.entry = true;
    }
    if (rec.dependents !== undefined && !Array.isArray(rec.dependents)) invalid("dependents");
    else if (Array.isArray(rec.dependents) && !rec.dependents.every((d) => isObj(d) && typeof d.feature === "string")) invalid("dependents");
    for (const dep of Array.isArray(rec.dependents) ? rec.dependents : []) {
      if (!isObj(dep) || typeof dep.feature !== "string") continue;
      const k = dep.feature;
      if (!exists(k)) {
        const original = Array.isArray(dep.dependsOn) ? dep.dependsOn.filter((d) => typeof d === "string") : [slug];
        skipped.push({ feature: k, kind: "dependent", reason: handDependent(k, original) ? "archived" : "gone" });
        continue;
      }
      const cur = rm.features[k] && Array.isArray(rm.features[k].dependsOn) ? rm.features[k].dependsOn : [];
      if (cur.includes(slug)) continue;
      const next = reinsertDep(cur, slug, Array.isArray(dep.dependsOn) ? dep.dependsOn.filter((d) => typeof d === "string") : [slug]);
      // A dependency declared since the archive may make the old edge circular: that one stays out (reported).
      const map = Object.create(null);
      for (const [key, v] of Object.entries(rm.features)) map[key] = (v.dependsOn || []).slice();
      map[k] = next;
      if (findCycle(map)) { skipped.push({ feature: k, kind: "dependent", reason: "cycle" }); continue; }
      rm.features[k] = { ...(rm.features[k] || {}), dependsOn: next };
      restored.dependents.push(k);
    }
    writeRoadmap(projectDir, rm);
    // under the roadmap lock, like every archive record write (rename's renamePlan, archive itself)
    for (const k of handed) writeFileAtomic(statePath(path.join(archRoot, k)), JSON.stringify(others.get(k), null, 2));
    delete st.archived;
    writeFileAtomic(statePath(to), JSON.stringify(st, null, 2));
  }
  let msInvalid = null;
  { // 1.16 E3: back into the milestones that kept it as archived (under the roadmap lock, like the edges above)
    const rmm = readRoadmap(projectDir);
    const ms = milestonesFollow(rmm, slug, "restore");
    if (ms.changed.length) { writeRoadmap(projectDir, rmm); restored.milestones = ms.changed; }
    msInvalid = ms.invalid; // invalid stored entries were left as they are (1.16 verify NEW-1)
  }
  const fromBacklog = pruneBacklog(projectDir, slug); // the feature has a folder again, like createFeature
  const res = { ok: true, action: "restore", feature: slug, from: "_archive/" + slug, restored, skipped };
  if (msInvalid) res.milestonesInvalid = msInvalid;
  if (fromBacklog.length) res.removedFromBacklog = fromBacklog;
  const skipLine = (s) => s.kind === "record" ? R.skipRecord(s.field, R.reason[s.reason] || s.reason)
    : (s.kind === "dependsOn" ? R.skipDependsOn : R.skipDependent)(s.feature, R.reason[s.reason] || s.reason);
  const notes = [rec ? null : R.noRecord, skipped.length ? R.skipped(skipped.map(skipLine).join("; ")) : null].filter(Boolean);
  if (notes.length) res.note = notes.join(" ");
  return res;
}

// --- drift since finish ---

// Content hash of a file, CRLF-normalized on the raw bytes (latin1 is byte-preserving), or null (missing / not a file).
function fileHash(abs) {
  try {
    if (!fs.statSync(abs).isFile()) return null;
    return require("crypto").createHash("sha1").update(fs.readFileSync(abs).toString("latin1").replace(/\r\n/g, "\n"), "latin1").digest("hex");
  } catch {
    return null;
  }
}
// A project-relative path → its absolute path, or null when it leaves the project (by path or through a symlink).
function projectFile(root, rootReal, rel) {
  if (typeof rel !== "string" || !rel.trim() || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null;
  const abs = path.resolve(root, rel);
  if (abs === root || !isInsideDir(root, abs)) return null;
  try {
    return isInsideDir(rootReal, fs.realpathSync.native(abs)) ? abs : null;
  } catch {
    return abs; // missing: judged by its path alone
  }
}
const realRootOf = (root) => { try { return fs.realpathSync.native(root); } catch { return root; } };
// The files a feature's _Implements:_ markers name, project-relative with forward slashes: a file (existing or not) or
// every file under a folder, or the files a glob matches now (globFiles — trace_check's reading) — only inside the
// project, at most BASELINE_CAP.
const BASELINE_CAP = 500;
// known: a Set of fold(rel) already recorded in a baseline (staleFinish) — those are counted without the realpath check
// (they were checked when recorded, and can never be "new"): the check is the whole cost of the walk, and the catalog
// runs it for every finished feature on each refresh.
function baselineFiles(projectDir, tasksText, globCap, known) {
  const root = path.resolve(projectDir);
  const rootReal = realRootOf(root);
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const out = new Map(); // fold(rel) → rel
  let truncated = false;
  const add = (rel) => {
    const k = fold(rel);
    if (out.has(k)) return;
    if (out.size >= BASELINE_CAP) { truncated = true; return; }
    if ((known && known.has(k)) || projectFile(root, rootReal, rel)) out.set(k, rel);
  };
  for (const ref of implementsRefs(tasksText)) {
    const p = implementsPath(ref).replace(/^\.\//, "");
    if (!p) continue;
    if (isImplementsGlob(p)) {
      const g = globFiles(root, p, { cap: globCap || BASELINE_CAP * 20 });
      if (g.truncated) truncated = true; // the walk stopped at its cap: the glob's file list is incomplete
      for (const rel of g.files) add(rel);
      continue;
    }
    const abs = path.resolve(root, p);
    if (abs === root || !isInsideDir(root, abs)) continue;
    if (isDirSafe(abs)) { const pre = toPosix(path.relative(root, abs)); walkProject(abs, BASELINE_CAP + 1, (r) => add(pre + "/" + r)); }
    else add(toPosix(path.relative(root, abs)));
  }
  return { files: [...out.values()], truncated };
}
// state.finished = { at, files: { '<rel>': sha1 | null } } — latest finish wins.
function recordFinishBaseline(projectDir, slug, dir, tasksText, globCap) {
  const st = readState(projectDir, slug);
  if (st.invalid) return { recorded: false, error: st.invalid };
  const root = path.resolve(projectDir);
  // A re-finish over a DRIFTED baseline accepts the drift: say which files it was (replaced), never erase it silently.
  const before = isObj(st.finished) && isObj(st.finished.files) ? baselineDrift(root, realRootOf(root), st.finished) : null;
  const replaced = before && before.drifted ? { at: typeof st.finished.at === "string" ? st.finished.at : null,
    changed: before.changed, missing: before.missing, nowPresent: before.nowPresent } : null;
  const { files, truncated } = baselineFiles(root, tasksText, globCap);
  const map = {};
  for (const rel of files) map[rel] = fileHash(path.resolve(root, rel));
  const at = new Date().toISOString();
  // firstAt: when the feature was FIRST finished — a re-finish (a stale baseline, a change request) keeps it, so the release
  // notes never list a feature that already shipped as new again (spec_changelog's shipped-before test).
  const prevFin = isObj(st.finished) ? st.finished : null;
  const firstAt = prevFin && typeof prevFin.firstAt === "string" ? prevFin.firstAt : prevFin && typeof prevFin.at === "string" ? prevFin.at : null;
  st.finished = firstAt ? { at, firstAt, files: map } : { at, files: map };
  if (truncated) st.finished.truncated = true;
  writeFileAtomic(statePath(dir), JSON.stringify(st, null, 2));
  maybeRefreshCatalog(projectDir); // the feature now reads as finished
  const res = { recorded: true, at, files: files.length, missing: files.filter((r) => map[r] === null).length };
  if (truncated) res.truncated = true;
  if (replaced) res.replaced = replaced; // the drift this finish accepted: {at, changed, missing, nowPresent}
  return res;
}
// A finish baseline (state.finished) describes the feature as it was when it was finished. Work added or reopened AFTER
// it — a change request (spec_impact --reopen: state.changes[].at), a re-approval of any other phase (the tasks
// re-approved after append_tasks …), or an active task's _Implements:_ file the baseline never recorded — means the
// feature has to be finished AGAIN (spec_finish {write}: a fresh readiness report, merge summary and baseline) before
// drift or next_action's "nothing left to do" can speak for it. Once its tasks were done again, next_action said
// "finished — nothing left to do", drift kept hashing the old file list (a new implementing file was never checked) and
// the catalog kept calling it finished. tasksText: the ACTIVE tasks (what a finish records). opts.newFiles === false skips
// the _Implements:_ walk (state only): SessionStart's bounded drift check and the catalog, refreshed after every mutation.
// → null (no baseline, or still current) | { finishedAt, since: [{ kind: "change-request", n, at } | { kind: "approval",
// phase, at } | { kind: "untick", task, at } (1.16 U1) | { kind: "revoke", phase, at } (1.16 U review 3)], newFiles: [rel …] }
function staleFinish(projectDir, st, tasksText, opts = {}) {
  const fin = isObj(st.finished) && isObj(st.finished.files) ? st.finished : null;
  if (!fin) return null;
  const finAt = timeOf(fin.at);
  const since = finAt == null ? [] : changesSince(st, finAt, "execution");
  let newFiles = [];
  if (!fin.truncated && opts.newFiles !== false) {
    const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
    const had = new Set(Object.keys(fin.files).map(fold));
    const now = baselineFiles(projectDir, tasksText || "", undefined, had);
    if (!now.truncated) newFiles = now.files.filter((rel) => !had.has(fold(rel))); // a capped walk proves nothing about what is new
  }
  if (!since.length && !newFiles.length) return null;
  return { finishedAt: typeof fin.at === "string" ? fin.at : null, since, newFiles };
}
// What changed the spec after time t: change requests, and approvals of any phase but `except`.
function changesSince(st, t, except) {
  const out = [];
  (Array.isArray(st.changes) ? st.changes : []).forEach((c, i) => {
    const at = isRecord(c) ? timeOf(c.at) : null;
    if (at != null && at > t) out.push({ kind: "change-request", n: i + 1, at: c.at });
  });
  for (const [phase, a] of Object.entries(isObj(st.approvals) ? st.approvals : {})) {
    const at = phase !== except && isRecord(a) ? timeOf(a.at) : null;
    if (at != null && at > t) out.push({ kind: "approval", phase, at: a.at });
  }
  // 1.16 U1: a task unticked after t (spec_complete_task {undo}) — the work was reopened: a finish or a sign-off older than it no
  // longer speaks for the feature once the task is done again.
  for (const u of Array.isArray(st.unticks) ? st.unticks : []) {
    const at = isRecord(u) && Number.isSafeInteger(u.n) ? timeOf(u.at) : null;
    if (at != null && at > t) out.push({ kind: "untick", task: u.n, at: u.at });
  }
  // 1.16 U review 3: an approval revoked after t (spec_approve {revoke}) — the phase is pending again, so a finish or a sign-off
  // older than it no longer speaks for the feature (the catalog kept calling it finished, drift said clean). Only a revocation
  // that removed an approval (a `partial` one withdrew waiting sign-offs: nothing was approved) and never of `except`.
  for (const h of Array.isArray(st.approvalHistory) ? st.approvalHistory : []) {
    const at = isRecord(h) && h.revoked === true && h.partial !== true && typeof h.phase === "string" && h.phase !== except ? timeOf(h.at) : null;
    if (at != null && at > t) out.push({ kind: "revoke", phase: h.phase, at: h.at });
  }
  return out;
}
// The phases revoked in `since` that no approval in it restores (a revoke then a re-approval reads "re-approved" alone).
function revokedSinceList(since) {
  const back = new Set(since.filter((x) => x.kind === "approval").map((x) => x.phase));
  return [...new Set(since.filter((x) => x.kind === "revoke" && !back.has(x.phase)).map((x) => x.phase))];
}
// The execution sign-off predates a change (a change request or a re-approval of another phase after it): it signed
// off a different feature — next_action asks for it again.
function executionSignOffStale(st) {
  const ex = isObj(st.approvals) && isRecord(st.approvals.execution) ? timeOf(st.approvals.execution.at) : null;
  return ex != null && changesSince(st, ex, "execution").length > 0;
}
// What came after the execution sign-off, localized: "the approval of tests and change request #2".
function signOffWhyText(st, lang) {
  const W = i18n.msg(lang).next.signOffWhy;
  const ex = isObj(st.approvals) && isRecord(st.approvals.execution) ? timeOf(st.approvals.execution.at) : null;
  const since = ex == null ? [] : changesSince(st, ex, "execution");
  const parts = [];
  const phases = [...new Set(since.filter((x) => x.kind === "approval").map((x) => x.phase))];
  if (phases.length) parts.push(W.approvals(phases.join(", ")));
  const crs = since.filter((x) => x.kind === "change-request").map((x) => "#" + x.n);
  if (crs.length) parts.push(W.changeRequests(crs.join(", ")));
  const un = [...new Set(since.filter((x) => x.kind === "untick").map((x) => "#" + x.task))]; // 1.16 U1
  if (un.length) parts.push(i18n.msg(lang).undo.signOffWhy(un.join(", ")));
  const rv = revokedSinceList(since); // 1.16 U review 3
  if (rv.length) parts.push(i18n.msg(lang).revoke.signOffWhy(rv.join(", ")));
  return parts.join(W.join);
}
// "change request #2, tasks re-approved, 1 implementing file not in the baseline (src/a.js)" — localized.
function staleFinishText(stale, lang) {
  const W = i18n.msg(lang).drift.staleWhy;
  const parts = [];
  const crs = stale.since.filter((x) => x.kind === "change-request").map((x) => "#" + x.n);
  if (crs.length) parts.push(W.changeRequests(crs.join(", ")));
  const phases = [...new Set(stale.since.filter((x) => x.kind === "approval").map((x) => x.phase))];
  if (phases.length) parts.push(W.approvals(phases.join(", ")));
  if (stale.newFiles.length) parts.push(W.newFiles(stale.newFiles.length, stale.newFiles.slice(0, 5).join(", ") + (stale.newFiles.length > 5 ? ", …" : "")));
  const un = [...new Set(stale.since.filter((x) => x.kind === "untick").map((x) => "#" + x.task))]; // 1.16 U1
  if (un.length) parts.push(i18n.msg(lang).undo.driftWhy(un.join(", ")));
  const rv = revokedSinceList(stale.since); // 1.16 U review 3
  if (rv.length) parts.push(i18n.msg(lang).revoke.driftWhy(rv.join(", ")));
  return parts.join("; ");
}
// spec_drift {name?} / `dev-spec drift [feature]`: per finished feature, the recorded files changed / missing / now
// present since the finish baseline. Only the recorded files are hashed. "Finished" here is phase complete AND a
// baseline (the catalog also needs it current and every tick verified): a baselined feature whose tasks are open again (append_tasks after finish) is
// `reopened`, listed apart and not hashed until it is finished again; one whose tasks are done again but changed since
// the finish (staleFinish) is `stale` — listed apart with why (verdict `stale` unless something drifted or a state file
// failed): finish it again. Its recorded files are still hashed: one that drifted puts the feature in `features` too
// (`stale: true`) and in `drifted` (verdict `drift`) — a stale baseline never hides a changed file (adding one file
// under a folder _Implements:_ names made the drift of another go unreported), and a re-finish would accept it. A state file that can't be read is an error (verdict `error` unless something
// drifted; a named feature that can't be read at all → ok:false), never "clean".
// opts.maxFiles / opts.maxBytes bound the work (SessionStart): over budget, nothing is hashed and the result says
// `skipped`. opts.activeOnly leaves archived features out (the SessionStart line is about the work in .specs/).
function drift(projectDir, name, opts = {}) {
  const root = path.resolve(projectDir);
  const named = name != null && String(name).trim() !== "";
  let sources;
  if (named) {
    const f = resolveFeature(projectDir, name);
    if (!f.ok) return { ok: false, error: f.error };
    sources = locateFeatures(projectDir, name);
    if (!sources.length) return { ok: false, error: errs(projectDir).notFound(f.slug, f.root) };
  } else sources = featureDirs(projectDir);
  if (opts.activeOnly) sources = sources.filter((s) => !s.archived);
  const withBase = [];
  const unbaselined = [];
  const reopened = [];
  const stale = []; // [{ feature, archived, finishedAt, since, newFiles, why, drifted? }] — finished again needed (staleFinish)
  const errors = [];
  let lang = projectLang(projectDir);
  for (const s of sources) {
    const st = stateFromFile(projectDir, statePath(s.dir));
    if (named && typeof st.lang === "string") lang = normalizeLang(st.lang);
    if (st.invalid) { errors.push({ feature: s.slug, error: st.invalid }); continue; }
    if (!isObj(st.finished) || !isObj(st.finished.files)) { unbaselined.push(s.slug); continue; }
    const tracks = detectTracks(s.dir);
    if (detectPhase(s.dir, tracks) !== "complete") { reopened.push(s.slug); continue; }
    // Budgeted (SessionStart): the state-only check — no _Implements:_ walk before the hashing budget is even known. An
    // ARCHIVED feature is never walked either (the catalog's rule): it can't be finished again where it is, so a file
    // added later under a folder it once implemented kept drift at exit 1 for good, with a remedy (finish) that failed.
    // Its recorded files are still hashed, and a change request / re-approval newer than its baseline still makes it
    // stale — the CLI line then says to restore it first.
    const budgeted = opts.maxFiles != null || opts.maxBytes != null;
    const walk = !budgeted && !s.archived;
    const sf = staleFinish(projectDir, st, walk ? activeTasks(readIfExists(path.join(s.dir, "tasks.md")) || "", tracks) : "", { newFiles: walk });
    const staleEntry = sf ? { feature: s.slug, archived: s.archived, ...sf } : null;
    if (staleEntry) stale.push(staleEntry);
    withBase.push({ s, fin: st.finished, staleEntry });
  }
  if (named && errors.length && errors.length === sources.length) return { ok: false, error: errors[0].error, errors };
  const res = { ok: true, lang, features: [], drifted: [], unbaselined, reopened, stale, verdict: errors.length ? "error" : "clean" };
  for (const x of stale) x.why = staleFinishText(x, lang); // localized, for the CLI line
  if (errors.length) res.errors = errors;
  const recorded = withBase.reduce((n, x) => n + Object.keys(x.fin.files).length, 0);
  const rootReal = realRootOf(root);
  const over = () => {
    if (opts.maxFiles != null && recorded > opts.maxFiles) return true;
    if (opts.maxBytes == null) return false;
    let bytes = 0;
    for (const { fin } of withBase) for (const rel of Object.keys(fin.files)) {
      const abs = projectFile(root, rootReal, rel);
      try { if (abs) bytes += fs.statSync(abs).size; } catch { /* missing */ }
      if (bytes > opts.maxBytes) return true;
    }
    return false;
  };
  if (over()) return { ...res, skipped: true, recordedFiles: recorded, verdict: "skipped" };
  for (const { s, fin, staleEntry } of withBase) {
    const { unchanged, changed, missing, nowPresent, ignored } = baselineDrift(root, rootReal, fin);
    const d = { feature: s.slug, archived: s.archived, finishedAt: typeof fin.at === "string" ? fin.at : null, files: Object.keys(fin.files).length,
      unchanged, changed, missing, nowPresent, drifted: changed.length + missing.length + nowPresent.length > 0 };
    if (ignored.length) d.ignored = ignored;
    if (staleEntry) {
      staleEntry.drifted = d.drifted;
      if (!d.drifted) continue; // nothing recorded changed: listed in `stale` only (finish it again)
      d.stale = true;
    }
    res.features.push(d);
    if (d.drifted) res.drifted.push(s.slug);
  }
  if (res.drifted.length) res.verdict = "drift";
  else if (!errors.length && stale.length) res.verdict = "stale"; // not "clean": the baseline no longer covers the feature
  if (!res.features.length && !errors.length && !reopened.length && !stale.length) res.note = i18n.msg(lang).drift.none;
  return res;
}
// One finish baseline (state.finished) against the files now: the recorded files changed / missing / now present
// (missing at finish). Shared by spec_drift, next_action and a re-finish that replaces a drifted baseline.
function baselineDrift(root, rootReal, fin) {
  const changed = [], missing = [], nowPresent = [], ignored = [];
  let unchanged = 0;
  for (const [rel, was] of Object.entries(isObj(fin && fin.files) ? fin.files : {})) {
    const abs = projectFile(root, rootReal, rel);
    if (!abs || (was !== null && typeof was !== "string")) { ignored.push(rel); continue; }
    const now = fileHash(abs);
    if (was === null) { if (now === null) unchanged++; else nowPresent.push(rel); }
    else if (now === null) missing.push(rel);
    else if (now !== was) changed.push(rel);
    else unchanged++;
  }
  return { unchanged, changed, missing, nowPresent, ignored, drifted: changed.length + missing.length + nowPresent.length > 0 };
}

module.exports = { sectionFirstParagraph, oneLine, codeSpan, shortTitle, COMMIT_TITLE_MAX, commitTitle, finishFeature, METRIC_PHASES, timeOf, round1,
  round2, isoOf, hoursFrom, featureMetrics, stats, metrics, fmtHours, metricsLines, pruneRoadmapRefs, milestoneResult,
  pruneRoadmapRefsLocked, removeFeature, TOMBSTONE_PREFIX, TOMBSTONE_SWEEP_AGE_MS, sweepTombstones, removeFeatureLocked,
  archiveFeature, archiveFeatureLocked, renameFeature, renameFeatureLocked, renamePlan, renameSupersedesRefs,
  removePreview, manageFeature, SUP_NL, RE_SUPERSEDES_SRC, RE_SUPERSEDES_OPEN_SRC, stripSupersedes, blockLines, lineMap,
  criterionAc, supersedesMarkers, dirKey, resolveSupersedes, supersedesTrace, supersedesWarnings, day, acOneLine,
  catalogData, renderCatalogMd, catalog, maybeRefreshCatalog, archiveRecord, reinsertDep, archivedFeature,
  restoreFeature, restoreFeatureLocked, fileHash, projectFile, realRootOf, BASELINE_CAP, baselineFiles,
  recordFinishBaseline, staleFinish, changesSince, revokedSinceList, executionSignOffStale, signOffWhyText,
  staleFinishText, drift, baselineDrift, __link };

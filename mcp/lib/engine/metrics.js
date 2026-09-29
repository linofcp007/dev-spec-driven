"use strict";

/**
 * dev-spec-driven engine — metrics and retrospective.
 * spec_metrics: derived only from .state.json, .history/ and the artifacts.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, chainArtifacts, clarificationMarkers, detectPhase, detectTracks, evidenceRecords, existingFeature,
  featureLang, featureVelocity, forecastInput, isApprovalRecord, isRecord, isRedRun, listFeatures, parseTasks, PHASES,
  projectLang, readIfExists, readState, trackLabel, velocityOf, writeIfAbsent;
function __link(E) { ({ activeTasks, chainArtifacts, clarificationMarkers, detectPhase, detectTracks, evidenceRecords,
  existingFeature, featureLang, featureVelocity, forecastInput, isApprovalRecord, isRecord, isRedRun, listFeatures,
  parseTasks, PHASES, projectLang, readIfExists, readState, trackLabel, velocityOf, writeIfAbsent } = E); }

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
      const written = writeIfAbsent(file, M.retro(res, { dur: fmtHours, today: new Date().toISOString().slice(0, 10) }));
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

module.exports = { METRIC_PHASES, timeOf, round1, round2, isoOf, hoursFrom, featureMetrics, stats, metrics, fmtHours,
  metricsLines, __link };

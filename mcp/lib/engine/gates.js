"use strict";

/**
 * dev-spec-driven engine — gates, approvals and change requests.
 * The ONE view doctor / approve / next_action / finish / roadmap share of what a phase still lacks (the phase walk,
 * pending gates, changed-since-approval, each phase's approval checks, the flows, the phase detector); spec_approve (a
 * gate, not a stamp: force, waivers, revoke, roles, the fast-forward); the .history/ snapshots and spec_impact.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { featureLocked } = require("./files.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, activeDesign, activeSectionTracks, activeTasks, artifactMatches, artifactReport, artifactState,
  bugPlaceholders, clarificationMarkers, criterionBlocks, designSections, detectTracks, duplicateTaskNumbers,
  earsUnlinted, earsUnidentified, shortIdList, earsValidate, errs, evidenceRule, existingFeature, existsCached, extractSection, extractTestIds,
  featureLang, fingerprintMatches, finishFeature, hasProseOutsideBrackets, headingsOnly, inactiveTaskLines, isBugStep,
  isInsideDir, isObj, isPlaceholderTask, isRecord, isSpikeDir, loadRoadmap, maybeRefreshRoadmap, normalizeLang, own,
  ownRecord, parseTasks, PHASE_FILE, phaseFile, PHASES, placeholderReport, placeholderSummary, planIdText, projectLang,
  RE_LIST_ITEM, RE_TODO_SENTINEL, readIfExists, readJson, readRoadmap, readState, reasonInput, REPRO_SYN,
  ROOT_CAUSE_SYN, SAMPLE_GOLDEN, sectionState, specChangedSince, spikePhase, statePath, STEERING_GOVERNED,
  steeringFingerprints, steeringImpact, steeringImpactLines, stripFencedCode, stripHtmlComments, taskBlocks,
  taskDepsCheck, taskMarkers, taskVerification, testIndex, textFingerprint, timeOf, todayIso, traceCheck, traceGapLines,
  uncheckTasks, untickedSince, useTemplateScopeOf, validIsoDay, writeFileAtomic, writeRoadmap,
  featureSize, trackSectionReport, sectionVerdict,
  CHANGE_FILE, requirementAcIds, changeViews, isChangeDir;
function __link(E) { ({ acIndex, activeDesign, activeSectionTracks, activeTasks, artifactMatches, artifactReport,
  artifactState, bugPlaceholders, clarificationMarkers, criterionBlocks, designSections, detectTracks,
  duplicateTaskNumbers, earsUnlinted, earsUnidentified, shortIdList, earsValidate, errs, evidenceRule, existingFeature, existsCached, extractSection,
  extractTestIds, featureLang, fingerprintMatches, finishFeature, hasProseOutsideBrackets, headingsOnly,
  inactiveTaskLines, isBugStep, isInsideDir, isObj, isPlaceholderTask, isRecord, isSpikeDir, loadRoadmap,
  maybeRefreshRoadmap, normalizeLang, own, ownRecord, parseTasks, PHASE_FILE, phaseFile, PHASES, placeholderReport,
  placeholderSummary, planIdText, projectLang, RE_LIST_ITEM, RE_TODO_SENTINEL, readIfExists, readJson, readRoadmap,
  readState, reasonInput, REPRO_SYN, ROOT_CAUSE_SYN, SAMPLE_GOLDEN, sectionState, specChangedSince, spikePhase,
  statePath, STEERING_GOVERNED, steeringFingerprints, steeringImpact, steeringImpactLines, stripFencedCode,
  stripHtmlComments, taskBlocks, taskDepsCheck, taskMarkers, taskVerification, testIndex, textFingerprint, timeOf,
  todayIso, traceCheck, traceGapLines, uncheckTasks, untickedSince, useTemplateScopeOf, validIsoDay, writeFileAtomic,
  writeRoadmap,
  featureSize, trackSectionReport, sectionVerdict,
  CHANGE_FILE, requirementAcIds, changeViews, isChangeDir } = E); }

// Phases that only exist for a track: an inactive track's artifact (kept on disk after add_track --remove)
// is not a gate, not a phase and not a "changed since approval".
function phaseActive(phase, tracks) {
  return phase === "test-plan" ? tracks.includes("tdd") : phase === "eval-plan" ? tracks.includes("ai")
    : phase === "tests" ? tracks.includes("tdd") || tracks.includes("ai") : true;
}
// Phase 4 — the hard gate (failing tests on +tdd, the eval harness + baseline on +ai), approved before any
// implementation. It has no artifact of its own, so it is due once the plan it implements exists (test-plan.md /
// eval-plan.md of an active track) — never for a bugfix, whose failing regression test is one of its tasks.
function testsGateDue(dir, tracks, kind) {
  if (kind === "bugfix" || !phaseActive("tests", tracks)) return false;
  return (tracks.includes("tdd") && fs.existsSync(path.join(dir, "test-plan.md"))) || (tracks.includes("ai") && fs.existsSync(path.join(dir, "eval-plan.md")));
}

function detectPhase(dir, tracks) {
  useTemplateScopeOf(dir); // the project's templates are template text too (1.14)
  const has = (f) => existsCached(path.join(dir, f));
  const tasks = parseTasks(activeTasks(readIfExists(path.join(dir, "tasks.md")), tracks));
  const anyDone = tasks.some((t) => t.done);
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  if (isSpikeDir(dir)) return spikePhase(dir, tasks); // 1.14 C2: question → investigate → decide (no planning chain)
  if (allDone) return "complete";
  if (anyDone) return "executing";
  // Planning: the EARLIEST artifact of the chain that is still a template (artifactState). design.md is judged
  // on its active part — a removed track's [SaaS]/[AI] sections keep their TODOs, and they are inactive.
  // A bugfix has no design of its own (bug.md takes its place): its design.md exists only for a track's sections,
  // so once that track is removed and nothing active is left, the file is out of the chain — not a phase forever open.
  const activeDesignText = () => activeDesign(readIfExists(path.join(dir, "design.md")) || "", tracks);
  const bugfix = (readJson(statePath(dir)).data || {}).kind === "bugfix";
  const planning = [["requirements", "requirements.md"], ["design", "design.md"], ["test-plan", "test-plan.md"], ["eval-plan", "eval-plan.md"]];
  if (featureFlow(dir) === "design-first") planning.unshift(planning.splice(1, 1)[0]); // C3: design-first — the design is the chain's first artifact
  const chain = planning
    .filter(([ph, f]) => phaseActive(ph, tracks) && has(f) && !(f === "design.md" && bugfix && headingsOnly(activeDesignText())));
  // requirements.md too: its +saas/+ai template criteria sit under [SaaS]/[AI] headings, inactive once the track is off.
  const stateOf = (f) => artifactState(f === "design.md" ? { text: activeDesignText() }
    : f === "requirements.md" ? { text: activeDesign(readIfExists(path.join(dir, f)) || "", tracks) } : { file: path.join(dir, f) });
  const open = chain.find(([, f]) => stateOf(f) !== "filled");
  // A scaffold whose tasks are ALL still placeholders / template track tasks hasn't been broken into tasks yet.
  // One real task wins over an unfilled chain (the task-driven model); the verbatim bugfix steps only count
  // once the bug's planning chain is filled.
  if (has("tasks.md") && tasks.some((t) => !isPlaceholderTask(t.text) && !(open && isBugStep(t.text)))) return "tasks-ready";
  // So a fresh scaffold is in "requirements" — not in its last scaffolded phase (test-plan 20%, or tasks-ready
  // 30% for +saas/+ai). Once every artifact is filled, the last planning phase present.
  if (open) return open[0];
  if (chain.length) return chain[chain.length - 1][0];
  if (has("classification.md")) return "classified";
  return "empty";
}

// An approval is a GATE, not a stamp: the checks of the phase being approved run first (approvalChecks) and a
// failure refuses it — unless opts.force, which records it anyway with `forced: true` and the failing check ids
// (doctor's approval-gates and the roadmap keep showing it). A phase with no artifact to sign off (eval-plan
// without +ai, test-plan without +tdd, a missing file) is an error even with force: there is nothing to approve.
function approvePhase(projectDir, name, phase, by, opts = {}) {
  if (opts.revoke === true) return revokeApproval(projectDir, name, phase, by, opts); // 1.16 U2: spec_approve {revoke} / approve --revoke
  if (opts.through != null) return approveThrough(projectDir, name, phase, by, opts); // 1.14 B3: the fast-forward (spec_approve {through})
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  if (phase == null || String(phase).trim() === "") return { ok: false, error: i18n.msg(featureLang(projectDir, f.slug)).governance.phaseRequired };
  const p = String(phase || "").toLowerCase().trim();
  if (!PHASES.includes(p)) return { ok: false, error: errs(projectDir, f.slug).unknownPhase(phase, PHASES.join(", ")) };
  const state = readState(projectDir, f.slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const lng = featureLang(projectDir, f.slug);
  // 1.16 U3: the waiver a forced approval carries (reason / expires) — validated before anything else; either one without force is refused.
  const wv = waiverInput(opts, lng);
  if (wv.error) return { ok: false, error: wv.error };
  if (state.kind === "spike" && p !== "execution") return { ok: false, spike: true, error: i18n.msg(lng).spike.noGate(p, f.slug) }; // 1.14 C2
  // 1.21 F5: a change has two approvals — the plan (phase `tasks`: its change.md) and the execution sign-off
  if (state.kind === "change" && p !== "tasks" && p !== "execution") return { ok: false, change: true, error: i18n.msg(lng).sizes.noGate(p, f.slug) };
  const G = i18n.msg(lng).gates;
  const tracks = detectTracks(f.dir);
  const gate = approvalChecks(projectDir, f.slug, f.dir, p, tracks, state.kind || "feature", lng);
  if (!gate.artifact) return { ok: false, nothingToApprove: true, error: G.approveNothing(p, f.slug, gate.file) };
  // 1.14 B3 — approvals by role: the role this sign-off is for (required while roadmap.json meta.approvalRoles lists the phase).
  const rc = approvalRole(projectDir, f.slug, p, opts.role, lng);
  if (rc.error) return rc.error;
  // Phase by phase: an EARLIER active phase still waiting for its approval refuses this one (a bugfix's tasks before its
  // design) — force records it anyway, flagged with `phase-order`. The execution sign-off needs no extra check: its gate
  // is spec_finish's blockers, which already name every pending gate.
  if (p !== "execution") {
    const order = phaseOrder(featureFlow(f.dir, state.kind || "feature")); // C3: design-first puts design before requirements
    const earlier = pendingGateList(f.dir, tracks, state.kind || "feature", state.approvals).filter((ph) => order.indexOf(ph) < order.indexOf(p));
    if (earlier.length) gate.checks.unshift({ id: "phase-order", detail: G.phaseOrder(earlier.join(", "), f.slug, earlier[0]) });
  }
  const failing = gate.checks.map((c) => c.id);
  if (failing.length && opts.force !== true) {
    return { ok: false, refused: true, failing, checks: gate.checks,
      error: G.approveRefused(p, f.slug, failing.join(", "), gate.checks.map((c) => G.checkLine(c.id, c.detail)).join("\n")) };
  }
  // 1.21 F1b: the MCP server's preview before it asks the user (elicitation) — every check above ran, nothing is written.
  if (opts.dryRun === true) {
    return Object.assign({ ok: true, dryRun: true, feature: f.slug, phase: p, failing, checks: gate.checks }, rc.role ? { role: rc.role } : {},
      failing.length && wv.waiver ? { waiver: wv.waiver } : {});
  }
  // One default for every surface (the CLI used $USER, the MCP server 'user').
  const entry = { at: new Date().toISOString(), by: by || process.env.USER || process.env.USERNAME || "user" };
  // The artifact is read ONCE: its fingerprint and its snapshot are the same version.
  const file = phaseFile(p, state.kind || "feature");
  const raw = file ? readIfExists(path.join(f.dir, file)) : null;
  if (raw != null) entry.fingerprint = textFingerprint(raw, p);
  let design = null;
  if (file && file !== PHASE_FILE[p]) {
    entry.file = file;
    // A bugfix's design.md holds only track sections ([SaaS]/[AI]) the gate checked too: an edit to it still counts.
    // (1.21 F5: a change's plan signs off change.md alone — its tasks.md IS change.md, nothing else to fingerprint)
    design = state.kind === "change" ? null : readIfExists(path.join(f.dir, PHASE_FILE[p]));
    if (design != null) entry.designFingerprint = textFingerprint(design, p);
  }
  if (failing.length) { entry.forced = true; entry.failing = failing; } // a clean re-approval replaces it
  if (failing.length && wv.waiver) entry.waiver = wv.waiver; // 1.16 U3: why the gate was forced, and until when
  // 1.16 Q1: the steering that governed a requirements / design approval (constitution, the tracks' files, always / matching
  // fileMatch files) — doctor warns steering-changed-since-approval once one of them changes.
  if (STEERING_GOVERNED.includes(p)) {
    const sf = steeringFingerprints(f.root, f.dir, tracks, { match: true });
    entry.steering = sf.steering;
    if (Object.keys(sf.steeringMatch).length) entry.steeringMatch = sf.steeringMatch; // fileMatch files: counted while _Implements:_ match
  }
  // 1.17 A review 3: a design approved by 1.17+ is held to the Alternatives & Trade-offs / Risks warns; one approved before never is.
  // 1.19 R1: `reuse` — the same for the Reuse & Integration warn (design-reuse): a 1.17 / 1.18 approval carries weigh only.
  if (p === "design") { entry.weigh = true; entry.reuse = true; }
  if (rc.role) entry.role = rc.role; // 1.14 B3: the role signing (informational on a phase no role is required for)
  if (opts.batch === true) entry.batch = true; // 1.14 B3: approved by a fast-forward (metrics count them apart)
  const conf = confirmationOf(opts.confirmation); // 1.21 F1b: the user confirmed it in the MCP client (elicitation)
  if (conf) entry.confirmed = conf;
  // Change history (1.13): `approvals[p]` stays the latest approval; every approval is also appended to
  // approvalHistory, with a snapshot of what it signed off (.history/<phase>@<n>.md) — the baseline spec_impact diffs.
  // A feature upgraded mid-flight: the approvals made before the history are seeded first as `legacy` records (no
  // snapshot), so metrics keep counting them (forced ones too) after their phase is re-approved and they're replaced.
  const hist = Array.isArray(state.approvalHistory) ? state.approvalHistory : [];
  const legacy = legacySeeds(state.approvals, hist);
  const record = { phase: p, at: entry.at, by: entry.by };
  if (entry.file) record.file = entry.file;
  if (entry.fingerprint) record.fingerprint = entry.fingerprint;
  if (entry.forced) { record.forced = true; record.failing = failing; }
  if (entry.waiver) record.waiver = entry.waiver;
  if (entry.steering) record.steering = entry.steering; // 1.16 Q1
  if (entry.steeringMatch) record.steeringMatch = entry.steeringMatch;
  if (entry.weigh) record.weigh = true; // 1.17 A review 3
  if (entry.reuse) record.reuse = true; // 1.19 R1
  if (entry.role) record.role = entry.role;
  if (entry.batch) record.batch = true;
  if (entry.confirmed) record.confirmed = entry.confirmed;
  // 1.14 B3: with roles, a sign-off that doesn't complete the phase waits in state.signoffs — approvals[p] untouched, no snapshot.
  const so = rc.roles.length ? recordRoleSignOff(state, p, entry, rc.roles, record) : dropRoleSignOffs(state, p);
  // A bugfix's design approval keeps design.md as it was too (<phase>@<n>.design.md): spec_impact diffs both files.
  if (raw != null && (!so || so.complete)) Object.assign(record, writeSnapshot(f.dir, p, raw, hist, design));
  state.approvalHistory = hist.concat(legacy, [record]);
  if (!so || so.complete) {
    state.approvals[p] = entry;
    state.lastApprovedPhase = p;
  }
  writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
  maybeRefreshRoadmap(projectDir);
  const res = { ok: true, feature: f.slug, approved: p, approvals: state.approvals };
  if (record.snapshot) res.snapshot = record.snapshot;
  if (record.designSnapshot) res.designSnapshot = record.designSnapshot;
  if (failing.length) Object.assign(res, { forced: true, failing, checks: gate.checks, note: G.approveForced(failing.join(", ")) });
  if (entry.role) res.role = entry.role;
  if (so) roleSignOffResult(res, so, p, lng);
  // 1.16 U3: the waiver recorded with a forced approval (or sign-off) — or, when the gate passed, that nothing was waived.
  const W = i18n.msg(lng).waiver;
  if (failing.length && wv.waiver) Object.assign(res, { waiver: wv.waiver, note: [res.note, W.recorded(wv.waiver.reason, wv.waiver.expires)].filter(Boolean).join(" ") });
  else if (wv.waiver) Object.assign(res, { waiverIgnored: true, note: [res.note, W.notForced].filter(Boolean).join(" ") });
  if (so && so.complete && entry.waiver) res.waiver = entry.waiver; // the completing sign-off: the waiver the approval carries
  return res;
}

// 1.21 F1b — how the user confirmed an agent's approval over MCP (mcp/server.js asked them: elicitation/create) → { via:
// "elicitation", at, note? } | null — recorded as `confirmed` on the approval, its history record and a role's sign-off (a
// revocation's record too). Only the server passes it, never a tool argument; the note: one line, at most 500 characters.
function confirmationOf(c) {
  if (!isObj(c) || c.via !== "elicitation") return null;
  const out = { via: "elicitation", at: typeof c.at === "string" && c.at ? c.at : new Date().toISOString() };
  const note = typeof c.note === "string" ? c.note.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  if (note) out.note = note;
  return out;
}

// 1.16 U3 — the waiver a forced approval carries: spec_approve {force: true, reason?, expires?} / `approve <f> <phase> --force
// --reason "…" --expires 2026-12-31|30d`. reason: one line (reasonInput, ≤ 500 characters); expires: an ISO date (today or later)
// or a number of days (Nd), at most WAIVER_MAX_DAYS ahead, stored as YYYY-MM-DD (UTC). Either without force is refused (a
// waiver is what a force records); a force without them stays allowed (no waiver). Recorded as `waiver {reason?, expires?}` on
// the approval and its history record only when the approval IS forced (a passing gate waives nothing: waiverIgnored + a note).
// A waiver expires once today (UTC) is past `expires` (valid through that day). → { waiver: null | {reason?, expires?} } | { error }
const WAIVER_MAX_DAYS = 3650;
function waiverInput(opts, lng) {
  const W = i18n.msg(lng).waiver;
  const r = reasonInput(opts.reason, lng);
  if (r.error) return { error: r.error };
  let expires = null;
  if (opts.expires != null && !(typeof opts.expires === "string" && !opts.expires.trim())) {
    const bad = { error: W.badExpires(JSON.stringify(opts.expires), WAIVER_MAX_DAYS) };
    if (typeof opts.expires !== "string") return bad;
    const v = opts.expires.trim();
    const t0 = Date.parse(todayIso() + "T00:00:00Z");
    const day = (k) => new Date(t0 + k * 864e5).toISOString().slice(0, 10);
    const m = v.match(/^(\d{1,4})\s*d$/i);
    if (m) {
      const k = parseInt(m[1], 10);
      if (k < 1 || k > WAIVER_MAX_DAYS) return bad;
      expires = day(k);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(v) && validIsoDay(v) && v >= day(0) && v <= day(WAIVER_MAX_DAYS)) expires = v;
    else return bad;
  }
  if ((r.value || expires) && opts.force !== true) return { error: W.needsForce };
  if (!r.value && !expires) return { waiver: null };
  return { waiver: Object.assign({}, r.value ? { reason: r.value } : {}, expires ? { expires } : {}) };
}
// A stored waiver → { reason, expires, expired } (null when it holds neither); expired: today (UTC) is past its `expires`.
function waiverView(w) {
  if (!isRecord(w)) return null;
  const reason = typeof w.reason === "string" && w.reason.trim() ? w.reason.trim() : null;
  const expires = typeof w.expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w.expires) ? w.expires : null;
  if (!reason && !expires) return null;
  return { reason, expires, expired: !!expires && expires < todayIso() };
}
// The forced approvals of the ACTIVE phases, in PHASES order → [{phase, failing: [ids], waiver: {reason, expires, expired} | null}]
// — doctor's waiver-expired, the roadmap's forced line, spec_finish's merge summary / `waivers` / expired warning.
function forcedApprovalList(approvals, tracks) {
  const a = isObj(approvals) ? approvals : {};
  return PHASES.filter((ph) => phaseActive(ph, tracks) && isRecord(a[ph]) && a[ph].forced === true)
    .map((ph) => ({ phase: ph, failing: Array.isArray(a[ph].failing) ? a[ph].failing.filter((x) => typeof x === "string") : [], waiver: waiverView(a[ph].waiver) }));
}
// spec_finish's merge summary: "## Waived gates (forced approvals)" and one line per forced approval (its failing checks, the
// waiver's reason and expiry — "no reason recorded" for a force without one).
function waiverSummaryLines(list, lng) {
  const W = i18n.msg(lng).waiver;
  return [W.prHeading, ...list.map((x) => W.prLine(x.phase, x.failing.join(", "), x.waiver && x.waiver.reason, x.waiver && x.waiver.expires, !!(x.waiver && x.waiver.expired)))];
}
// spec_finish's `waivers` (stable): [{phase, failing, reason?, expires?, expired}] — every forced approval, the waiver's fields when recorded.
function waiverResult(list) {
  return list.map((x) => Object.assign({ phase: x.phase, failing: x.failing }, x.waiver && x.waiver.reason ? { reason: x.waiver.reason } : {},
    x.waiver && x.waiver.expires ? { expires: x.waiver.expires } : {}, { expired: !!(x.waiver && x.waiver.expired) }));
}
// doctor's waiver-expired (stable id, a warn): the forced approvals still standing whose waiver expired → the check, or null.
function waiverExpiredCheck(approvals, tracks, slug, lng) {
  const W = i18n.msg(lng).waiver;
  const list = forcedApprovalList(approvals, tracks).filter((x) => x.waiver && x.waiver.expired);
  return list.length ? { id: "waiver-expired", status: "warn", detail: W.doctor(list.map((x) => W.expiredItem(x.phase, x.waiver.expires, x.waiver.reason)).join(", "), slug) } : null;
}
// Of several sign-offs' waivers, the one the completed approval carries: the earliest expiry (the strictest), else the first one.
function strictestWaiver(list) {
  const ws = list.filter((w) => waiverView(w));
  if (!ws.length) return null;
  const dated = ws.filter((w) => waiverView(w).expires).sort((x, y) => (x.expires < y.expires ? -1 : x.expires > y.expires ? 1 : 0));
  return dated[0] || ws[0];
}
// The approvals not in approvalHistory yet (made before the history, or by an older engine) → their `legacy` records, oldest first
// — seeded before a new approval's (approvePhase) or a revocation's (revokeApproval) record.
function legacySeeds(approvals, hist) {
  return Object.entries(isObj(approvals) ? approvals : {}).filter(([ph, a]) => isRecord(a) && !hist.some((h) => isApprovalRecord(h) && h.phase === ph))
    .map(([ph, a]) => legacyRecord(ph, a))
    .sort((x, y) => (timeOf(x.at) || 0) - (timeOf(y.at) || 0));
}

// 1.16 U2 — revoke an approval: spec_approve {name, phase, revoke: true, reason?} / `approve <f> <phase> --revoke [--reason "…"]`
// (under the feature lock, through approvePhase). approvals[phase] is removed, and so are the role sign-offs waiting for it
// (signoffs[phase]); approvalHistory gets {phase, at, by, revoked: true, reason?, role?, roles? (the sign-offs withdrawn),
// approvedAt?, wasForced?, partial? (only waiting sign-offs were withdrawn — nothing had been approved)} — never a snapshot, and
// every reader of the history as a list of APPROVALS skips it (isApprovalRecord). Approvals made before the history are seeded as
// `legacy` records first (approvePhase's rule), so the revoked approval itself stays in the history. NEVER cascades: the later
// phases stay approved (`laterApproved`); the revoked one is pending again, so doctor / next_action / spec_finish ask for it and
// approving another phase is refused on phase-order until it is approved again. A phase neither approved nor waiting for a
// sign-off → error (notApproved); `execution` included (its sign-off is asked for again). force / expires / through are refused.
function revokeApproval(projectDir, name, phase, by, opts) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const lng = featureLang(projectDir, f.slug);
  const R = i18n.msg(lng).revoke;
  if (opts.through != null) return { ok: false, error: R.noThrough };
  if (opts.force === true || opts.expires != null) return { ok: false, error: R.noForce };
  if (phase == null || String(phase).trim() === "") return { ok: false, error: R.phaseRequired };
  const p = String(phase).toLowerCase().trim();
  if (!PHASES.includes(p)) return { ok: false, error: errs(projectDir, f.slug).unknownPhase(phase, PHASES.join(", ")) };
  const reason = reasonInput(opts.reason, lng);
  if (reason.error) return { ok: false, error: reason.error };
  const role = opts.role == null || String(opts.role).trim() === "" ? null : normRole(opts.role);
  if (role != null && !RE_ROLE.test(role)) return { ok: false, badRole: true, error: i18n.msg(lng).governance.badRole(String(opts.role)) };
  const state = readState(projectDir, f.slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const appr = isRecord(state.approvals[p]) ? state.approvals[p] : null;
  const waiting = isObj(state.signoffs) && isObj(state.signoffs[p]) ? Object.keys(state.signoffs[p]) : [];
  if (!appr && !waiting.length) return { ok: false, notApproved: true, error: R.notApproved(p, f.slug) };
  if (opts.dryRun === true) return { ok: true, dryRun: true, feature: f.slug, phase: p, revoke: true }; // 1.21 F1b: the MCP server's preview
  const conf = confirmationOf(opts.confirmation); // 1.21 F1b
  const hist = Array.isArray(state.approvalHistory) ? state.approvalHistory : [];
  const legacy = legacySeeds(state.approvals, hist);
  const record = { phase: p, at: new Date().toISOString(), by: by || process.env.USER || process.env.USERNAME || "user", revoked: true };
  if (reason.value) record.reason = reason.value;
  if (role) record.role = role;
  if (appr) {
    if (appr.at) record.approvedAt = appr.at;
    if (appr.forced === true) record.wasForced = true;
  } else record.partial = true; // only waiting sign-offs were withdrawn: nothing had been approved
  if (waiting.length) record.roles = waiting;
  if (conf) record.confirmed = conf;
  state.approvalHistory = hist.concat(legacy, [record]);
  delete state.approvals[p];
  dropRoleSignOffs(state, p);
  if (state.lastApprovedPhase === p) {
    const rest = Object.entries(state.approvals).filter(([, a]) => isRecord(a)).sort((x, y) => (timeOf(x[1].at) || 0) - (timeOf(y[1].at) || 0));
    if (rest.length) state.lastApprovedPhase = rest[rest.length - 1][0];
    else delete state.lastApprovedPhase;
  }
  writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
  maybeRefreshRoadmap(projectDir);
  const order = phaseOrder(featureFlow(f.dir, state.kind || "feature"));
  const later = order.slice(order.indexOf(p) + 1).filter((ph) => isRecord(state.approvals[ph]));
  const message = appr ? [R.revoked(p, f.slug), waiting.length ? R.signOffsToo(waiting.join(", ")) : null, later.length ? R.laterStay(later.join(", "), p) : null].filter(Boolean).join(" ")
    : R.withdrawn(p, f.slug, waiting.join(", "));
  const res = { ok: true, feature: f.slug, revoked: p, revokedApproval: !!appr, withdrawnSignOffs: waiting, laterApproved: later, approvals: state.approvals, message };
  if (reason.value) res.reason = reason.value;
  return res;
}

// ---------------------------------------------------------------------------
// Team governance (1.14) — approvals by role, and the fast-forward approval.
// roadmap.json meta.approvalRoles = { <phase>: [<role>, …] } (spec_init {approvalRoles} / `init --roles`). A phase listed
// there is APPROVED only once every role has signed off its CURRENT content (the artifact fingerprint an approval records):
// each sign-off runs the phase's gate like any approval (force records it forced), is appended to approvalHistory with its
// `role` and, until the last role signs, waits in .state.json `signoffs[<phase>][<role>]` — its history record flagged
// `partial: true`, no snapshot. The completing sign-off writes approvals[<phase>] (with `roles` {<role>: {by, at,
// fingerprint…}}) and the snapshot exactly like a single approval, so every reader of approvals[<phase>] — doctor's
// approval-gates, next_action, finish, the roadmap, the guard hook, metrics — sees the phase approved only then. A sign-off
// of older content no longer counts: the artifact changed after it, that role signs again (doctor names it).
// Without meta.approvalRoles nothing changes. A phase approved WITHOUT the roles now required (approved before the roles
// were configured, or before a role was added) stays approved — by an unknown role, never retroactively pending — and
// doctor / finish name the missing sign-offs as a warning: re-signing records them.
// ---------------------------------------------------------------------------
const RE_ROLE = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,39}$/u;
const normRole = (r) => String(r == null ? "" : r).trim().toLowerCase();
// A role list from an array or a "tech+security" / "tech, security" string → { roles } | { bad } (the first invalid name).
function parseRoleList(v) {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[+,\s]+/) : null;
  if (!items) return { roles: null };
  const roles = [];
  for (const it of items) {
    if (typeof it !== "string") return { bad: String(it) };
    const r = normRole(it);
    if (!r) continue;
    if (!RE_ROLE.test(r)) return { bad: it };
    if (!roles.includes(r)) roles.push(r);
  }
  return { roles };
}
// spec_init {approvalRoles} → { ok, map } (phases in PHASES order, roles lower-cased) | { ok: false, error }. {} clears them.
function validateApprovalRoles(input, lang) {
  const E = i18n.msg(lang).governance;
  if (!isObj(input)) return { ok: false, error: E.rolesShape };
  const map = {};
  for (const [k, v] of Object.entries(input)) {
    const ph = String(k).trim().toLowerCase();
    if (!PHASES.includes(ph)) return { ok: false, error: E.rolesPhase(k, PHASES.join(", ")) };
    const r = parseRoleList(v);
    if (r.bad != null) return { ok: false, error: E.badRole(r.bad) };
    if (!r.roles) return { ok: false, error: E.rolesShape };
    if (!r.roles.length) return { ok: false, error: E.rolesEmpty(ph) };
    map[ph] = [...new Set([...(map[ph] || []), ...r.roles])];
  }
  return { ok: true, map: Object.fromEntries(PHASES.filter((p) => map[p]).map((p) => [p, map[p]])) };
}
// `dev-spec init --roles requirements=product,design=tech+security` → the object spec_init takes (validated by it). A word
// with no '=' is one more role of the phase before it ("design=tech,security"); "none" / "off" → {} (clears them).
// → the object, or { error } (localized) when the text names a role before any phase.
function parseApprovalRolesText(text, lang) {
  const s = String(text == null ? "" : text).trim();
  if (/^(none|off)$/i.test(s)) return {};
  const map = Object.create(null); // a phase typed as "__proto__" is a plain (refused) key, never the prototype
  let last = null;
  for (const part of s.split(/[,;]/)) {
    const t = part.trim();
    if (!t) continue;
    const eq = t.indexOf("=");
    if (eq >= 0) { last = t.slice(0, eq).trim(); map[last] = (map[last] || []).concat(t.slice(eq + 1).split("+")); }
    else if (last != null) map[last] = map[last].concat(t.split("+"));
    else return { error: i18n.msg(normalizeLang(lang)).governance.rolesShape };
  }
  return Object.keys(map).length ? Object.fromEntries(Object.entries(map)) : { error: i18n.msg(normalizeLang(lang)).governance.rolesShape };
}
// The project's approval roles (roadmap.json meta.approvalRoles), sanitized — a hand-edited entry keeps its valid role names
// only; an unreadable roadmap.json has none. → { <phase>: [roles] } (empty object = no governance).
function approvalRolesOf(projectDir) {
  const l = loadRoadmap(projectDir);
  return approvalRolesFrom(!l.parseError && isObj(l.rm.meta) ? l.rm.meta.approvalRoles : undefined);
}
// meta.approvalRoles as stored → the sanitized map (also the approval guard's view of a project's roles — 1.14 F2, pure).
function approvalRolesFrom(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const ph of PHASES) {
    if (!own(raw, ph)) continue;
    const items = Array.isArray(raw[ph]) ? raw[ph] : typeof raw[ph] === "string" ? raw[ph].split(/[+,\s]+/) : [];
    const roles = [...new Set(items.filter((x) => typeof x === "string").map(normRole).filter((r) => RE_ROLE.test(r)))];
    if (roles.length) out[ph] = roles;
  }
  return out;
}
const rolesSummary = (map) => Object.entries(map).map(([p, r]) => `${p}=${r.join("+")}`).join(" · ");
// meta.approvalRoles ← map ({} deletes it). Called under the roadmap lock (initProject); no write when unchanged.
function setApprovalRoles(projectDir, map) {
  const rm = readRoadmap(projectDir);
  rm.meta = isObj(rm.meta) ? rm.meta : {};
  const empty = !Object.keys(map).length;
  if (empty ? rm.meta.approvalRoles === undefined : JSON.stringify(rm.meta.approvalRoles) === JSON.stringify(map)) return;
  if (empty) delete rm.meta.approvalRoles;
  else rm.meta.approvalRoles = map;
  writeRoadmap(projectDir, rm);
}
// approvePhase's role check → { roles, role } | { error: <refusal result> }. roles = the phase's required roles ([] = a single
// approval, as before 1.14 — a role given then is only recorded). With roles: one of them must be named.
function approvalRole(projectDir, slug, phase, role, lng) {
  const E = i18n.msg(lng).governance;
  const roles = approvalRolesOf(projectDir)[phase] || [];
  const given = role == null || String(role).trim() === "" ? null : normRole(role);
  if (given != null && !RE_ROLE.test(given)) return { error: { ok: false, badRole: true, error: E.badRole(String(role)) } };
  if (!roles.length) return { roles, role: given };
  if (!given) return { error: { ok: false, roleRequired: true, roles, error: E.roleRequired(phase, slug, roles.join(", ")) } };
  if (!roles.includes(given)) return { error: { ok: false, roleNotListed: true, roles, error: E.roleNotListed(given, phase, roles.join(", ")) } };
  return { roles, role: given };
}
// The content a sign-off is judged against — what approvePhase records on an approval: the phase artifact's fingerprint (and
// design.md's, for a bugfix's design, which signs off bug.md). A phase with no file (tests, execution) has none: its sign-offs
// stay valid until the phase is approved.
function phaseContent(dir, phase, kind) {
  const file = phaseFile(phase, kind);
  const raw = file ? readIfExists(path.join(dir, file)) : null;
  const c = { fingerprint: raw != null ? textFingerprint(raw, phase) : null, designFingerprint: null };
  // (1.21 verify V4: a change's plan signs off change.md ALONE — approvePhase records no designFingerprint for it; reading
  // tasks.md here, the alias of that very change.md, gave every role sign-off a second fingerprint no record carries: stale forever)
  if (file && file !== PHASE_FILE[phase] && kind !== "change") {
    const d = readIfExists(path.join(dir, PHASE_FILE[phase]));
    if (d != null) c.designFingerprint = textFingerprint(d, phase);
  }
  return c;
}
const sameContent = (rec, c) => isRecord(rec) && (rec.fingerprint || null) === (c.fingerprint || null) && (rec.designFingerprint || null) === (c.designFingerprint || null);
// The role sign-offs an approval carries: its `roles`, or — a single approval that named a role (made while no role was required
// for the phase) — that role, signed with the approval's own content. → { role: {by, at, fingerprint?, designFingerprint?, forced?, failing?} }
function approvalRoleRecords(appr) {
  if (!isRecord(appr)) return {};
  if (isObj(appr.roles)) return appr.roles;
  if (typeof appr.role !== "string" || !appr.role) return {};
  const rec = { by: appr.by, at: appr.at };
  for (const k of ["fingerprint", "designFingerprint"]) if (appr[k]) rec[k] = appr[k];
  if (appr.forced === true) { rec.forced = true; rec.failing = Array.isArray(appr.failing) ? appr.failing : []; }
  return { [appr.role]: rec };
}
// Which required roles have signed off `content` (state.signoffs, and the roles of the phase's current approval) →
// { valid: {role: record}, signed, missing, stale } — stale: a waiting sign-off of older content (that role signs again).
function roleSignOffs(state, phase, required, content) {
  const so = isObj(state.signoffs) && isObj(state.signoffs[phase]) ? state.signoffs[phase] : {};
  const appr = isObj(state.approvals) && isRecord(state.approvals[phase]) ? state.approvals[phase] : null;
  const fromAppr = approvalRoleRecords(appr);
  const valid = {}, stale = [];
  for (const r of required) {
    const waiting = own(so, r) && isRecord(so[r]) ? so[r] : null;
    const approved = own(fromAppr, r) && isRecord(fromAppr[r]) ? fromAppr[r] : null;
    const hit = [waiting, approved].find((x) => x && sameContent(x, content));
    if (hit) valid[r] = hit;
    else if (waiting) stale.push(r);
  }
  return { valid, signed: Object.keys(valid), missing: required.filter((r) => !valid[r]), stale };
}
// approvePhase with roles: records this role's sign-off of entry's content. Every required role signed it → the phase is
// approved (entry gets `roles`; forced when a sign-off that counts was forced; signoffs[phase] cleared) — else it waits in
// state.signoffs[phase] (only the sign-offs that still count are kept) and the history record is `partial`.
// → { complete, missing, signed }
function recordRoleSignOff(state, phase, entry, required, record) {
  const rec = { by: entry.by, at: entry.at };
  for (const k of ["fingerprint", "designFingerprint"]) if (entry[k]) rec[k] = entry[k];
  if (entry.forced) { rec.forced = true; rec.failing = entry.failing; }
  if (entry.waiver) rec.waiver = entry.waiver; // 1.16 U3: a forced sign-off's waiver
  if (entry.batch) rec.batch = true;
  if (entry.confirmed) rec.confirmed = entry.confirmed; // 1.21 F1b
  const signoffs = isObj(state.signoffs) ? state.signoffs : {};
  const cur = isObj(signoffs[phase]) ? signoffs[phase] : {};
  const view = roleSignOffs({ signoffs: { [phase]: { ...cur, [entry.role]: rec } }, approvals: state.approvals }, phase, required, entry);
  if (view.missing.length) {
    signoffs[phase] = view.valid;
    state.signoffs = signoffs;
    record.partial = true;
    return { complete: false, missing: view.missing, signed: view.signed };
  }
  entry.roles = view.valid;
  const forced = Object.values(view.valid).filter((x) => x.forced === true);
  if (forced.length) {
    const ids = [...new Set(forced.flatMap((x) => (Array.isArray(x.failing) ? x.failing : [])))];
    entry.forced = true; entry.failing = ids;
    record.forced = true; record.failing = ids;
    // 1.16 U3: the approval carries a waiver when a forced sign-off that counts gave one (its own, else the strictest).
    if (!entry.waiver) { const w = strictestWaiver(forced.map((x) => x.waiver)); if (w) entry.waiver = w; }
    if (entry.waiver) record.waiver = entry.waiver;
  }
  record.roles = required.slice();
  delete signoffs[phase];
  if (Object.keys(signoffs).length) state.signoffs = signoffs; else delete state.signoffs;
  return { complete: true, missing: [], signed: view.signed };
}
// A single approval (no role required for the phase any more): sign-offs still waiting from when roles were required are moot.
// → null (approvePhase's "no role sign-off" marker)
function dropRoleSignOffs(state, phase) {
  if (isObj(state.signoffs) && own(state.signoffs, phase)) {
    delete state.signoffs[phase];
    if (!Object.keys(state.signoffs).length) delete state.signoffs;
  }
  return null;
}
// The approve result of a role sign-off: complete / missingRoles / signedRoles, and — when the phase still waits — approved:
// null + signedOff + pending, with a localized note (after a forced approval's note).
function roleSignOffResult(res, so, phase, lng) {
  const E = i18n.msg(lng).governance;
  Object.assign(res, { complete: so.complete, missingRoles: so.missing, signedRoles: so.signed });
  const note = so.complete ? E.approvedByRoles(phase, so.signed.join(", ")) : E.stillPending(phase, E.missing(so.missing));
  if (!so.complete) {
    Object.assign(res, { approved: null, signedOff: phase, pending: true });
    if (res.forced) res.note = E.signedForced(res.failing.join(", ")); // a sign-off, not an approval (yet)
  }
  res.note = res.note ? res.note + " " + note : note;
}
// Doctor's view of the role sign-offs (one read of the config): per PENDING phase that needs roles, {required, signed, missing,
// stale}; the approved phases whose approval lacks a role now required (`unsigned` — approved before the roles, or before one
// was added); the approved phases with a re-sign round under way; localized notes; and label(phase) → "design (missing role:
// security)" for the pending lists. No roles configured → any: false, and every label is the bare phase (output unchanged).
function roleGateView(projectDir, dir, state, pendingGates, tracks, kind, lng) {
  const cfg = approvalRolesOf(projectDir);
  const pending = {}, unsigned = {};
  if (!Object.keys(cfg).length) return { any: false, pending, unsigned, notes: [], label: (p) => p };
  const E = i18n.msg(lng).governance;
  const stale = [], resign = [], complete = [];
  for (const p of pendingGates) {
    if (!cfg[p]) continue;
    const v = roleSignOffs(state, p, cfg[p], phaseContent(dir, p, kind));
    pending[p] = { required: cfg[p].slice(), signed: v.signed, missing: v.missing, stale: v.stale };
    // 1.21 review A1: every required role signed the CURRENT content, yet no approval (the sign-offs were recorded apart — two
    // branches the merge driver united, or a role dropped since): never "missing roles" — any of them signs again to complete it.
    if (!v.missing.length && v.signed.length) { pending[p].signoffsComplete = true; complete.push(p); }
    if (v.stale.length) stale.push(`${p} (${v.stale.join(", ")})`);
  }
  const approvals = isObj(state.approvals) ? state.approvals : {};
  for (const p of PHASES) {
    const a = approvals[p];
    if (!cfg[p] || !isRecord(a) || !phaseActive(p, tracks)) continue;
    const have = Object.keys(approvalRoleRecords(a));
    const lack = cfg[p].filter((r) => !have.includes(r));
    if (lack.length) unsigned[p] = lack;
    if (isObj(state.signoffs) && isObj(state.signoffs[p]) && Object.keys(state.signoffs[p]).length) {
      const v = roleSignOffs(state, p, cfg[p], phaseContent(dir, p, kind));
      if (v.missing.length && v.signed.some((r) => own(state.signoffs[p], r))) resign.push(`${p} (${E.missing(v.missing)})`);
    }
  }
  const notes = [];
  if (complete.length) {
    const slug = path.basename(dir);
    notes.push(E.signoffsComplete(complete.map((p) => `${p} (${pending[p].signed.join(", ")})`).join(", "), `/approve ${slug} ${complete[0]} --role ${pending[complete[0]].signed[0]}`));
  }
  if (stale.length) notes.push(E.staleSignOffs(stale.join(", ")));
  if (resign.length) notes.push(E.resigning(resign.join(", ")));
  const un = Object.entries(unsigned);
  if (un.length) notes.push(E.unsigned(un.map(([p, l]) => `${p} (${l.join(", ")})`).join(", ")));
  return { any: true, pending, unsigned, notes, label: (p) => roleLabel(pending, p, lng) };
}
// "design (missing role: security)" for a pending phase that waits for roles; "design (every role signed: … — not approved yet)"
// for one whose sign-offs are complete but never became an approval (1.21 review A1); the bare phase otherwise.
function roleLabel(pendingRoles, p, lng) {
  const pr = isObj(pendingRoles) && own(pendingRoles, p) ? pendingRoles[p] : null;
  if (pr && pr.signoffsComplete) return `${p} (${i18n.msg(lng).governance.signedAll(pr.signed.join(", "))})`;
  return pr && pr.missing.length ? `${p} (${i18n.msg(lng).governance.missing(pr.missing)})` : p;
}
// ROADMAP.md "Needs attention": the phases of a feature whose sign-off round is under way (some role signed, some didn't yet).
// `st` is the raw .state.json data (the roadmap reads it without the resolver). → [{phase, missing}]
function roleWaitList(projectDir, dir, st, tracks) {
  if (!isObj(st) || !isObj(st.signoffs)) return [];
  const cfg = approvalRolesOf(projectDir);
  const approvals = isObj(st.approvals) ? st.approvals : {};
  const kind = typeof st.kind === "string" ? st.kind : "feature";
  const out = [];
  for (const p of PHASES) {
    if (!cfg[p] || approvals[p] || !phaseActive(p, tracks) || !isObj(st.signoffs[p]) || !Object.keys(st.signoffs[p]).length) continue;
    const v = roleSignOffs({ signoffs: st.signoffs, approvals }, p, cfg[p], phaseContent(dir, p, kind));
    if (v.missing.length) out.push({ phase: p, missing: v.missing });
  }
  return out;
}

// next_action's re-review step: an approved phase with roles whose artifact changed is re-approved by EVERY role again — the
// roles that haven't signed the new content yet, and the first sign-off to make. → a localized sentence, or null.
function reReviewRoles(projectDir, dir, st, phases, kind, slug, lng) {
  const cfg = approvalRolesOf(projectDir);
  const items = [];
  for (const p of [...new Set(phases)]) {
    if (!p || !cfg[p]) continue;
    const v = roleSignOffs(st, p, cfg[p], phaseContent(dir, p, kind));
    if (v.missing.length) items.push({ p, missing: v.missing });
  }
  if (!items.length) return null;
  const E = i18n.msg(lng).governance;
  return E.resignHint(items.map((x) => `${x.p} (${E.missing(x.missing)})`).join(", "), `/approve ${slug} ${items[0].p} --role ${items[0].missing[0]}`);
}

// next_action's fast-forward: when the first pending phase would be approved now and EVERY unapproved phase after it through
// `tasks` is filled and passes its own gate, one /spec-ff approves them all in order. With roles, a single role must be the
// one missing sign-off of each phase that needs roles (the fast-forward signs as that role) — otherwise no suggestion.
// → { through, phases, role } | null (fewer than two phases, or some gate would refuse). `through`: tasks, or where a sized plan's
// one call ends (planFastForwardEnd — 1.21 review C3).
function fastForwardPlan(projectDir, slug, dir, st, tracks, kind, pending, doc, lng, through = "tasks") {
  const walk = gateWalk(dir, tracks, kind);
  const start = walk.indexOf(pending), end = walk.indexOf(through);
  if (start < 0 || end < start) return null;
  const approvals = isObj(st.approvals) ? st.approvals : {};
  const chain = walk.slice(start, end + 1).filter((ph) => !approvals[ph]);
  if (chain.length < 2) return null;
  const cfg = approvalRolesOf(projectDir);
  let role = null;
  for (const ph of chain) {
    if (gateArtifacts(dir, tracks, kind, ph).some((file) => artifactReport(dir, file, tracks).state !== "filled")) return null;
    const g = doc.nextGate && doc.nextGate.phase === ph ? { artifact: true, checks: doc.nextGate.failing } : approvalChecks(projectDir, slug, dir, ph, tracks, kind, lng);
    if (!g.artifact || g.checks.length) return null;
    if (cfg[ph]) {
      const v = roleSignOffs(st, ph, cfg[ph], phaseContent(dir, ph, kind));
      if (v.missing.length !== 1 || (role && role !== v.missing[0])) return null;
      role = v.missing[0];
    }
  }
  return { through, phases: chain, role };
}
// 1.21 review C3 — where a size xs / s plan's ONE approval call ends: tasks, or — with the Phase 4 tests gate due (+tdd / +ai:
// the written failing tests / the feature's own eval sets, work that comes AFTER the plan) and still ahead of the pending
// phase — the last planning phase before it (test-plan / eval-plan): a fast-forward through tasks stopped at `tests` every time.
// null: no sized plan (no size, m / l, a spike).
function planFastForwardEnd(dir, tracks, kind, pending) {
  const size = featureSize(dir);
  if ((size !== "xs" && size !== "s") || kind === "spike") return null;
  const walk = gateWalk(dir, tracks, kind);
  const t = walk.indexOf("tests");
  const at = walk.indexOf(pending);
  return t > 0 && at >= 0 && at < t ? walk[t - 1] : "tasks";
}
// next_action's "approve" step, 1.14: the roles still missing for the pending phase (the recommendation names the role to
// sign as) and the fast-forward, when it applies. → { text, missingRoles?, fastForward? } (text null = keep the default).
function approveStepExtras(projectDir, slug, dir, st, tracks, kind, pending, doc, lng) {
  const E = i18n.msg(lng).governance;
  const out = { text: null };
  const pr = doc.pendingRoles && own(doc.pendingRoles, pending) ? doc.pendingRoles[pending] : null;
  if (pr && pr.signoffsComplete) { // 1.21 review A1: every role signed, no approval — one of them signs again (no missing roles)
    out.signoffsComplete = true;
    out.text = E.completeSignoffs(pending, slug, pr.signed.join(", "), pr.signed[0]);
  } else if (pr && pr.missing.length) {
    out.missingRoles = pr.missing;
    out.text = E.approveRoles(pending, slug, E.missing(pr.missing), pr.signed.join(", "), pr.missing[0]);
  }
  let ff = fastForwardPlan(projectDir, slug, dir, st, tracks, kind, pending, doc, lng);
  // 1.21 review C3: a size xs / s plan whose tests gate is still ahead — the one call through the planning phases before it
  const end = ff ? null : planFastForwardEnd(dir, tracks, kind, pending);
  if (end && end !== "tasks") ff = fastForwardPlan(projectDir, slug, dir, st, tracks, kind, pending, doc, lng, end);
  if (ff) {
    out.fastForward = ff;
    out.hint = ff.through === "tasks" ? E.ffHint(slug, ff.phases.join(", "), ff.role) : E.ffHintTests(slug, ff.phases.join(", "), ff.through, ff.role);
  }
  return out;
}

// spec_approve {name, through} / `dev-spec approve <f> --through <phase>` / /spec-ff — the fast-forward ("quick spec"): approve
// the active phases IN ORDER, from the first unapproved one up to `through`, each through its own gate (approvePhase — the
// same checks, snapshot and history record, flagged `batch: true`). It stops at the first phase that is not approved: a
// refused gate (ok: false, refused, failing, checks — the phases before it stay approved), a phase with nothing to approve,
// a role error, or — with roles — a phase that was signed off but still waits for another role (ok: true, complete: false).
// `force` still only when the user asked: it forces each gate, like approve --force. Called by approvePhase, under its lock.
function approveThrough(projectDir, name, phase, by, opts) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const lng = featureLang(projectDir, f.slug);
  const E = i18n.msg(lng).governance;
  const G = i18n.msg(lng).gates;
  if (phase != null && String(phase).trim() !== "") return { ok: false, error: E.ffBoth };
  const wv = waiverInput(opts, lng); // 1.16 U3: with force, each forced phase of the run records the same waiver
  if (wv.error) return { ok: false, error: wv.error };
  const t = String(opts.through || "").toLowerCase().trim();
  if (t === "execution") return { ok: false, error: E.ffExecution };
  if (!PHASES.includes(t)) return { ok: false, error: errs(projectDir, f.slug).unknownPhase(opts.through, PHASES.filter((p) => p !== "execution").join(", ")) };
  const state = readState(projectDir, f.slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const tracks = detectTracks(f.dir);
  const walk = gateWalk(f.dir, tracks, state.kind || "feature");
  if (!walk.includes(t)) return { ok: false, notActive: true, error: E.ffNotActive(t, f.slug) };
  const chain = walk.slice(0, walk.indexOf(t) + 1).filter((ph) => !state.approvals[ph]);
  const base = { feature: f.slug, through: t, batch: true };
  if (!chain.length) return { ok: true, ...base, approved: [], steps: [], complete: true, nothingToDo: true, approvals: state.approvals, message: E.ffNothing(f.slug, t) };
  if (opts.dryRun === true) return { ok: true, dryRun: true, ...base, chain }; // 1.21 F1b: the MCP server's preview (each gate runs when approved)
  const approved = [], steps = [];
  let approvals = state.approvals;
  for (const ph of chain) {
    const r = approvePhase(projectDir, f.slug, ph, by, { force: opts.force === true, role: opts.role, batch: true, reason: opts.reason, expires: opts.expires,
      confirmation: opts.confirmation });
    if (r.approvals) approvals = r.approvals;
    const step = { phase: ph, approved: !!r.ok && r.complete !== false };
    if (r.role) step.role = r.role;
    if (r.forced) Object.assign(step, { forced: true, failing: r.failing });
    if (r.waiver) step.waiver = r.waiver; // 1.16 U3
    if (step.approved) { approved.push(ph); steps.push(step); continue; }
    const list = approved.join(", ");
    if (r.ok) { // signed off by role — the phase waits for the other roles, and the later ones can't pass phase-order before it
      steps.push(Object.assign(step, { signedOff: true, missingRoles: r.missingRoles }));
      return { ok: true, ...base, approved, steps, complete: false, stoppedAt: ph, stopReason: "roles", missingRoles: r.missingRoles, approvals,
        message: E.ffStopped(f.slug, ph, list, E.ffWhyRoles(E.missing(r.missingRoles))) };
    }
    if (r.failing) step.failing = r.failing;
    steps.push(step);
    // A role refusal: approvePhase's own text ends "Nothing recorded." — wrong once earlier phases of this run were approved
    // (they are listed before it): say that nothing was recorded for THIS phase, and how to resume.
    const why = r.refused ? E.ffWhyRefused(r.failing.join(", "), r.checks.map((c) => G.checkLine(c.id, c.detail)).join("\n"), f.slug, ph)
      : (r.roleRequired || r.roleNotListed) && Array.isArray(r.roles) ? E.ffWhyRole(r.roles.join(", "), f.slug, ph, t, r.roleNotListed ? normRole(opts.role) : null) : r.error;
    const reason = r.refused ? "refused" : r.nothingToApprove ? "nothing-to-approve" : r.roleRequired || r.roleNotListed || r.badRole ? "role" : r.busy ? "busy" : "error";
    const res = { ok: false, ...base, approved, steps, complete: false, stoppedAt: ph, stopReason: reason, approvals, error: E.ffStopped(f.slug, ph, list, why) };
    if (r.refused) Object.assign(res, { refused: true, failing: r.failing, checks: r.checks });
    if (r.roles) res.roles = r.roles;
    return res;
  }
  return { ok: true, ...base, approved, steps, complete: true, approvals, message: E.ffDone(f.slug, approved.join(", "), t) };
}

// ---------------------------------------------------------------------------
// Change requests (1.13) — approval snapshots, spec_impact (what an edit after approval touches) and reopen.
// OpenSpec deltas / BMAD correct-course, done locally: the approved version is kept, the edit is diffed against it.
// ---------------------------------------------------------------------------

const HISTORY_DIR = ".history"; // spec history, meant to be committed with the spec (NOT self-ignored like .execution/)
// The artifacts spec_impact diffs against their approved snapshot — every one next_action can list as changed since its
// approval (test-plan.md / eval-plan.md were listed with only `--phase design` offered). tasks reopens nothing.
const IMPACT_PHASES = ["requirements", "design", "test-plan", "eval-plan", "tasks"];
// Requirement-level IDs a task cites in _Requirements:_ (ACs, success criteria, edge cases, NFRs), and T-IDs.
const RE_REQ_REF = /(?<![A-Za-z0-9])(?:US-\d+\.AC-\d+|SC-\d+|EC-\d+|NFR-\d+)(?!\d)/g;
const RE_OTHER_REQ_REF = /(?<![A-Za-z0-9])(?:SC-\d+|EC-\d+|NFR-\d+)(?!\d)/g;
const RE_TEST_REF = /(?<![A-Za-z0-9])T-\d+(?!\d)/g;
const RE_DEFINES_REQ_ID = /^(?:(?:\d+[.)]|[-*+])\s+)?(?:\*\*|__)?((?:SC|EC|NFR)-\d+)(?!\d)/;
const normWs = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const refsIn = (s, re) => [...new Set(String(s || "").match(re) || [])];
const shortDigest = (s) => require("crypto").createHash("sha1").update(normWs(s)).digest("hex").slice(0, 12);

// The approvalHistory record of an approval made before the history existed (no snapshot) — what approvePhase seeds before
// its own record, and what spec_upgrade {apply} seeds (it may then add the snapshot, when the fingerprint still matches).
// A history record that IS an approval — not a role's partial sign-off (1.14 B3), not a revocation (1.16 U2): every reader of
// approvalHistory as a list of approvals (snapshots, metrics, the legacy seeding, shipped supersessions, the changelog, upgrade).
const isApprovalRecord = (h) => isRecord(h) && h.partial !== true && h.revoked !== true;
function legacyRecord(ph, a) {
  return Object.assign({ phase: ph, at: a.at, by: a.by }, a.file ? { file: a.file } : {}, a.fingerprint ? { fingerprint: a.fingerprint } : {},
    a.forced === true ? { forced: true, failing: Array.isArray(a.failing) ? a.failing : [] } : {}, { legacy: true });
}

// .history/<phase>@<n>.md — n counts that phase's snapshots (1, 2, …) and never reuses a file that exists. `design`
// (a bugfix's design approval) is saved next to it as <phase>@<n>.design.md. → { snapshot, designSnapshot? }
function writeSnapshot(dir, phase, raw, history, design) {
  const rel = (k, ext) => `${HISTORY_DIR}/${phase}@${k}${ext}`;
  let n = (Array.isArray(history) ? history : []).filter((h) => isRecord(h) && h.phase === phase && typeof h.snapshot === "string").length + 1;
  while (fs.existsSync(path.join(dir, rel(n, ".md"))) || (design != null && fs.existsSync(path.join(dir, rel(n, ".design.md"))))) n++;
  writeFileAtomic(path.join(dir, rel(n, ".md")), phase === "tasks" ? uncheckTasks(raw) : raw);
  if (design == null) return { snapshot: rel(n, ".md") };
  writeFileAtomic(path.join(dir, rel(n, ".design.md")), design);
  return { snapshot: rel(n, ".md"), designSnapshot: rel(n, ".design.md") };
}

// A history file, only inside the feature's .history (a hand-edited path never reads elsewhere) → its text, or null.
function historyText(dir, rel) {
  if (typeof rel !== "string") return null;
  const abs = path.resolve(dir, rel);
  return isInsideDir(path.join(dir, HISTORY_DIR), abs) ? readIfExists(abs) : null;
}

// The snapshot of the phase's LATEST approval → { rel, text, at, record } — null when that approval has none (made
// before 1.13, or by an older engine after a 1.13 one), or the file is gone / points outside the feature's .history.
function latestSnapshot(dir, state, phase) {
  const hist = Array.isArray(state.approvalHistory) ? state.approvalHistory.filter((h) => isApprovalRecord(h) && h.phase === phase) : []; // not a partial role sign-off (1.14), nor a revocation (1.16)
  const last = hist[hist.length - 1];
  if (!last || typeof last.snapshot !== "string") return null;
  const appr = isRecord(state.approvals) ? state.approvals[phase] : null;
  if (isRecord(appr) && appr.at && last.at && appr.at !== last.at) return null;
  const text = historyText(dir, last.snapshot);
  return text == null ? null : { rel: last.snapshot, text, at: last.at || null, record: last };
}

// A bugfix design approval's second baseline — design.md as it was approved: its snapshot (designSnapshot), or empty
// when design.md didn't exist then (no designFingerprint: every section is new). null = not diffable (an approval
// that recorded only designFingerprint, or a snapshot file that is gone).
function designBaseline(dir, snap, appr) {
  if (typeof snap.record.designSnapshot === "string") {
    const text = historyText(dir, snap.record.designSnapshot);
    return text == null ? null : { rel: snap.record.designSnapshot, text };
  }
  return isRecord(appr) && appr.designFingerprint ? null : { rel: null, text: "" };
}

// The spec_impact phases among changed artifacts whose approval has a snapshot (next_action / doctor name the tool).
// A bugfix's design phase also covers design.md, when its approval baselined it (designBaseline).
function snapshotPhases(dir, state, changedFiles) {
  const kind = state.kind || "feature";
  return IMPACT_PHASES.filter((p) => {
    const snap = latestSnapshot(dir, state, p);
    if (!snap) return false;
    if (changedFiles.includes(phaseFile(p, kind))) return true;
    return kind !== "change" && phaseFile(p, kind) !== PHASE_FILE[p] && changedFiles.includes(PHASE_FILE[p]) && !!designBaseline(dir, snap, state.approvals[p]); // (a change: change.md alone)
  });
}

// requirements.md → every requirement-level ID with its text: acIndex() for the ACs; SC-/EC-/NFR- IDs by the same
// rule (the item that defines it, else its first mention, else a table row).
function requirementIndex(reqText) {
  const map = acIndex(reqText);
  const blocks = criterionBlocks(reqText || "").blocks;
  const other = new Map();
  const entry = (id, b) => ({ id, text: b.text.replace(RE_LIST_ITEM, ""), line: b.line });
  for (const b of blocks) { const m = b.text.match(RE_DEFINES_REQ_ID); if (m && !other.has(m[1])) other.set(m[1], entry(m[1], b)); }
  for (const b of blocks) for (const id of refsIn(b.text, RE_OTHER_REQ_REF)) if (!other.has(id)) other.set(id, entry(id, b));
  stripFencedCode(stripHtmlComments(reqText || "")).split(/\r?\n/).forEach((l, i) => {
    if (/^\s*\|/.test(l)) for (const id of refsIn(l, RE_OTHER_REQ_REF)) if (!other.has(id)) other.set(id, { id, text: l.trim(), line: i + 1 });
  });
  for (const [id, e] of other) if (!map.has(id)) map.set(id, e);
  return map;
}

// Keyed diff: added / modified (whitespace-normalized text differs) / removed, in document order.
function diffEntries(before, after) {
  const added = [], modified = [], removed = [];
  for (const [k, e] of after) {
    const o = before.get(k);
    if (!o) added.push(e);
    else if (normWs(o.text) !== normWs(e.text)) modified.push({ key: k, before: o, after: e });
  }
  for (const [k, o] of before) if (!after.has(k)) removed.push(o);
  return { added, modified, removed };
}
// design.md → its `##` sections by (whitespace-normalized) title; a repeated title gets " (2)", " (3)"…
function sectionEntries(designText) {
  const map = new Map();
  for (const s of designSections(designText)) {
    const title = normWs(s.title);
    let k = title;
    for (let i = 2; map.has(k); i++) k = `${title} (${i})`;
    map.set(k, { section: k, text: s.body });
  }
  return map;
}
// tasks.md → task content by number (checkbox state is not content; a duplicated number keeps both).
function taskEntries(tasksText) {
  const map = new Map();
  for (const b of taskBlocks(tasksText || "")) {
    const content = [b.text, ...b.body].join("\n");
    const prev = map.get(b.number);
    map.set(b.number, prev ? { ...prev, text: prev.text + "\n" + content } : { number: b.number, title: b.text, text: content });
  }
  return map;
}
// test-plan.md → its planned tests by T-ID (testIndex: a table row keyed by its FIRST cell, or a list item leading with
// it); a table row's text is compared cell by cell (re-padding a column is no change).
function plannedTestEntries(planText) {
  const map = new Map();
  for (const r of testIndex(planText || "").values()) {
    const text = /^\s*\|/.test(r.row) ? r.row.replace(/^\s*\||\|\s*$/g, "").split("|").map((c) => normWs(c)).join(" | ") : normWs(r.row);
    map.set(r.id, { id: r.id, text });
  }
  return map;
}
// Active task blocks (a removed track's task section is inactive) with their REAL line numbers — reopen unticks them.
function activeTaskBlocks(tasksText, tracks) {
  if (tasksText == null) return [];
  const drop = inactiveTaskLines(tasksText, tracks);
  return taskBlocks(tasksText).filter((b) => !drop.has(b.line));
}

// spec_impact {name, phase?, reopen?} / `dev-spec impact <feature> [--phase p] [--reopen]`: the current artifact against
// the snapshot of its latest approval. requirements → AC-level diff (+ SC/EC/NFR IDs) and, for every modified/removed
// ID, the tasks citing it (done/open + evidence state), the tests covering it and the design sections mentioning it;
// design → section-level diff and the tasks citing an ID named in a changed section; tasks → added/removed/changed task
// numbers; test-plan → T-ID row diff and the tasks making a changed test green; eval-plan → section diff like design.
// reopen (all but tasks): unticks the affected DONE tasks, marks their evidence stale and records the
// change request in .state.json `changes` — it never edits requirements.md or design.md. Idempotent: a change already
// recorded against the same snapshot reopens nothing again.
function impactReport(projectDir, name, opts = {}) {
  // 1.16 Q1: phase 'steering' — the features approved under steering that changed since (project-wide without a name).
  const ph0 = opts.phase == null ? "" : String(opts.phase).toLowerCase().trim();
  if (ph0 === "steering") return steeringImpact(projectDir, name, opts);
  if (name == null || String(name).trim() === "") return { ok: false, error: i18n.msg(projectLang(projectDir)).quality.impactNeedsName([...IMPACT_PHASES, "steering"].join(", ")) };
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const I = i18n.msg(lng).impact;
  // 1.21 review C4 — a change has ONE approved artifact, change.md (its plan: phase tasks) holding its criteria AND its tasks:
  // the default phase is tasks; its criteria are diffed by stable ID (as requirements), its tasks by number, and --reopen works.
  const isChange = isChangeDir(dir);
  const phase = opts.phase == null || String(opts.phase).trim() === "" ? (isChange ? "tasks" : "requirements") : String(opts.phase).toLowerCase().trim();
  if (!IMPACT_PHASES.includes(phase)) return { ok: false, error: I.badPhase(String(opts.phase), [...IMPACT_PHASES, "steering"].join(", ")) };
  if (isChange && phase !== "tasks") return { ok: false, change: true, error: I.changePhase(phase, slug) };
  const reopen = opts.reopen === true;
  if (reopen && phase === "tasks" && !isChange) return { ok: false, error: I.reopenTasks };
  const state = readState(projectDir, slug);
  if (state.invalid) return { ok: false, error: state.invalid }; // approvals/history of the wrong shape: nothing to trust
  const file = phaseFile(phase, state.kind || "feature"); // a bugfix's design approval signed off bug.md
  const cur = readIfExists(path.join(dir, file));
  if (cur == null) return { ok: false, error: I.missing(file, slug) };
  const appr = state.approvals[phase];
  if (!isRecord(appr)) return { ok: false, neverApproved: true, error: I.neverApproved(phase, slug) };
  const tracks = detectTracks(dir);
  const res = { ok: true, feature: slug, lang: lng, phase, file, approvedAt: appr.at || null };
  // 1.14 — roadmap.json meta.approvalRoles: a re-approval of a phase signed off per role names the role to sign as (a role-less
  // /approve is refused); `missingRoles` (stable, when the artifact changed) lists every role that hasn't signed the current content.
  const phaseRoles = approvalRolesOf(projectDir)[phase] || [];
  const roleMissing = phaseRoles.length ? roleSignOffs(state, phase, phaseRoles, phaseContent(dir, phase, state.kind || "feature")).missing : [];
  const ap = roleMissing.length ? `${phase} --role ${roleMissing[0]}` : phase; // what the /approve hints name
  const withRoles = () => { if (roleMissing.length && res.changed) res.missingRoles = roleMissing; };
  const snap = latestSnapshot(dir, state, phase);
  if (!snap && !appr.fingerprint) {
    // Approved before content fingerprints (≤1.10, or a 1.12 bugfix design approval): nothing about the approved version
    // was recorded. `changed` is true only for a change known without a date (a bugfix's design.md created since), else
    // null — unknown: a file date is no evidence (a clone or copy resets it).
    const cs = changedSinceApproval(dir, { [phase]: appr }, tracks, state.kind, { detail: true });
    Object.assign(res, { baseline: "none", changed: cs.changed.some((x) => !cs.byDate.includes(x)) ? true : null, hint: I.noFingerprint(ap, slug) });
    withRoles();
    if (reopen) Object.assign(res, { reopened: [], recorded: false, note: I.reopenNeedsSnapshot(phase) });
    return res;
  }
  if (!snap) {
    // Approved before 1.13: only the fingerprint was recorded — WHETHER it changed, not what.
    Object.assign(res, { baseline: "fingerprint-only", changed: changedSinceApproval(dir, { [phase]: appr }, tracks, state.kind).length > 0, hint: I.fingerprintOnly(ap, slug) });
    withRoles();
    if (reopen) Object.assign(res, { reopened: [], recorded: false, note: I.reopenNeedsSnapshot(phase) });
    return res;
  }
  Object.assign(res, { baseline: "snapshot", snapshot: snap.rel, changed: textFingerprint(cur, phase) !== textFingerprint(snap.text, phase) });
  // A bugfix's design approval signed off bug.md AND design.md as it was then (its [SaaS]/[AI] sections, see
  // changedSinceApproval): both are diffed, each section keyed by its file ("bug.md: Root Cause") so they never collide.
  // designMd.baseline: 'snapshot'; 'absent' (no design.md at approval — every section is added); 'fingerprint-only'
  // (approved without a snapshot of it: only THAT it changed, + designHint). A deleted design.md is not a change
  // (changedSinceApproval's rule).
  const bugfixDesign = phase === "design" && file !== PHASE_FILE.design;
  let designBase = null, curDesign = null;
  if (bugfixDesign) {
    curDesign = readIfExists(path.join(dir, PHASE_FILE.design));
    designBase = designBaseline(dir, snap, appr);
    if (curDesign != null || designBase && designBase.rel) {
      const designChanged = curDesign != null && !fingerprintMatches(curDesign, phase, appr.designFingerprint);
      const designMd = { file: PHASE_FILE.design, baseline: !designBase ? "fingerprint-only" : designBase.rel ? "snapshot" : "absent", changed: designChanged };
      if (designBase && designBase.rel) designMd.snapshot = designBase.rel;
      res.designMd = designMd;
      if (designChanged) res.changed = true;
      if (designChanged && !designBase) res.designHint = I.designFingerprintOnly(slug);
    }
  }
  withRoles();

  const tasksFile = path.join(dir, "tasks.md");
  const tasksText = readIfExists(tasksFile);
  const blocks = activeTaskBlocks(tasksText, tracks);
  const dups = new Set(duplicateTaskNumbers(blocks));
  const evidence = isRecord(state.evidence) ? state.evidence : {};
  const mode = evidenceRule(projectDir); // 1.14 F1
  const taskView = (b) => {
    const { reason, nothingToVerify } = taskVerification(evidence, b, dups.has(b.number), mode);
    return { number: b.number, text: b.text, done: b.done, evidence: reason || "verified", ...(nothingToVerify ? { nothingToVerify: true } : {}),
      ...(specChangedSince(evidence, b, dups.has(b.number), reason) ? { specChanged: true } : {}), ...(untickedSince(evidence, b, dups.has(b.number), reason) ? { unticked: true } : {}) };
  };
  const citing = (ids) => blocks.filter((b) => {
    const mk = taskMarkers(b);
    const refs = new Set([...refsIn(mk.requirements.join(" "), RE_REQ_REF), ...refsIn(mk["makes green"].join(" "), RE_TEST_REF)]);
    return ids.some((id) => refs.has(id));
  });
  const mentions = (text, id) => refsIn(text, id.startsWith("T-") ? RE_TEST_REF : RE_REQ_REF).includes(id);

  const digests = {}; // change key → digest of its new content ("removed") — what a reopen records, to stay idempotent
  const reach = new Map(); // change key (modified/removed ID, changed section) → the IDs whose citing tasks it affects
  if (phase === "requirements") {
    const d = diffEntries(requirementIndex(snap.text), requirementIndex(cur));
    const plan = [...testIndex(tracks.includes("tdd") ? readIfExists(path.join(dir, "test-plan.md")) || "" : "").values()];
    let sections = designSections(activeDesign(readIfExists(path.join(dir, "design.md")) || "", tracks));
    if ((state.kind || "feature") === "bugfix") {
      // A bugfix's design is bug.md (its Root Cause / Fix sections name the ACs they serve) plus design.md for a track's
      // sections: both are searched, each section named by its file — the keys spec_impact --phase design uses.
      const byFile = (name) => (s) => ({ ...s, title: `${name}: ${s.title}` });
      sections = designSections(readIfExists(path.join(dir, "bug.md")) || "").map(byFile("bug.md")).concat(sections.map(byFile(PHASE_FILE.design)));
    }
    res.added = d.added.map((a) => ({ id: a.id, text: a.text, tasks: citing([a.id]).map((b) => b.number) }));
    res.modified = d.modified.map((m) => ({ id: m.key, before: m.before.text, after: m.after.text }));
    res.removed = d.removed.map((r) => ({ id: r.id, text: r.text }));
    res.impacted = [...res.modified.map((m) => [m.id, "modified"]), ...res.removed.map((r) => [r.id, "removed"])].map(([id, change]) => ({
      id, change,
      tasks: citing([id]).map(taskView),
      tests: plan.filter((t) => mentions(t.row, id)).map((t) => ({ id: t.id, row: t.row })),
      designSections: sections.filter((s) => mentions(s.title + "\n" + s.body, id)).map((s) => s.title),
    }));
    for (const a of res.added) digests[a.id] = shortDigest(a.text);
    for (const m of res.modified) { digests[m.id] = shortDigest(m.after); reach.set(m.id, [m.id]); }
    for (const r of res.removed) { digests[r.id] = "removed"; reach.set(r.id, [r.id]); }
  } else if (isChange) {
    // 1.21 review C4 — a change: the criteria (change.md WITHOUT its task blocks — changeViews) by stable ID, as requirements —
    // a modified / removed criterion reaches the tasks citing it —, and the tasks (by number, checkboxes normalized) in `tasks`.
    const crit = (t) => changeViews(t).criteria;
    const d = diffEntries(requirementIndex(crit(snap.text)), requirementIndex(crit(cur)));
    res.added = d.added.map((a) => ({ id: a.id, text: a.text, tasks: citing([a.id]).map((b) => b.number) }));
    res.modified = d.modified.map((m) => ({ id: m.key, before: m.before.text, after: m.after.text }));
    res.removed = d.removed.map((r) => ({ id: r.id, text: r.text }));
    res.impacted = [...res.modified.map((m) => [m.id, "modified"]), ...res.removed.map((r) => [r.id, "removed"])].map(([id, change]) => ({ id, change, tasks: citing([id]).map(taskView) }));
    for (const a of res.added) digests[a.id] = shortDigest(a.text);
    for (const m of res.modified) { digests[m.id] = shortDigest(m.after); reach.set(m.id, [m.id]); }
    for (const r of res.removed) { digests[r.id] = "removed"; reach.set(r.id, [r.id]); }
    const t = diffEntries(taskEntries(uncheckTasks(snap.text)), taskEntries(uncheckTasks(cur)));
    res.tasks = { added: t.added.map((e) => ({ number: e.number, text: e.title })), modified: t.modified.map((m) => ({ number: m.key, before: m.before.title, after: m.after.title })),
      removed: t.removed.map((e) => ({ number: e.number, text: e.title })) };
  } else if (phase === "test-plan") {
    // T-ID row diff: added / modified / removed planned tests; a changed or removed test reaches the tasks that make it
    // green (_Makes green:_). Reopen semantics are the requirements': a modified test's done tasks are unticked (their
    // evidence proved the old test), a removed one's are listed in `retire` (drop or repoint the T-ID), never redone.
    const d = diffEntries(plannedTestEntries(snap.text), plannedTestEntries(cur));
    res.added = d.added.map((a) => ({ id: a.id, text: a.text, tasks: citing([a.id]).map((b) => b.number) }));
    res.modified = d.modified.map((m) => ({ id: m.key, before: m.before.text, after: m.after.text }));
    res.removed = d.removed.map((r) => ({ id: r.id, text: r.text }));
    res.impacted = [...res.modified.map((m) => [m.id, "modified"]), ...res.removed.map((r) => [r.id, "removed"])].map(([id, change]) => ({ id, change, tasks: citing([id]).map(taskView) }));
    for (const a of res.added) digests[a.id] = shortDigest(a.text);
    for (const m of res.modified) { digests[m.id] = shortDigest(m.after); reach.set(m.id, [m.id]); }
    for (const r of res.removed) { digests[r.id] = "removed"; reach.set(r.id, [r.id]); }
  } else if (phase === "design" || phase === "eval-plan") {
    // eval-plan.md is diffed like the design: by `##` section, reaching the tasks that cite an ID a changed section names.
    let before = sectionEntries(snap.text), after = sectionEntries(cur);
    if (bugfixDesign) {
      const byFile = (map, name) => [...map].map(([k, e]) => [`${name}: ${k}`, { ...e, section: `${name}: ${k}`, file: name }]);
      const both = designBase && curDesign != null;
      before = new Map([...byFile(before, file), ...(both ? byFile(sectionEntries(designBase.text), PHASE_FILE.design) : [])]);
      after = new Map([...byFile(after, file), ...(both ? byFile(sectionEntries(curDesign), PHASE_FILE.design) : [])]);
    }
    const d = diffEntries(before, after);
    const idsIn = (...texts) => [...new Set(texts.flatMap((t) => [...refsIn(t, RE_REQ_REF), ...refsIn(t, RE_TEST_REF)]))];
    const changes = [...d.added.map((e) => [e.section, "added", idsIn(e.section, e.text), shortDigest(e.text), e.file]),
      ...d.modified.map((m) => [m.key, "modified", idsIn(m.key, m.before.text, m.after.text), shortDigest(m.after.text), m.after.file]),
      ...d.removed.map((e) => [e.section, "removed", idsIn(e.section, e.text), "removed", e.file])];
    const inFile = (name) => (name ? { file: name } : {}); // a bugfix's sections name their file (bug.md / design.md)
    res.added = d.added.map((e) => ({ section: e.section, ...inFile(e.file) }));
    res.modified = d.modified.map((m) => ({ section: m.key, ...inFile(m.after.file) }));
    res.removed = d.removed.map((e) => ({ section: e.section, ...inFile(e.file) }));
    // "The tasks whose brief would include a changed section", kept simple: the tasks citing an ID it names.
    res.impacted = changes.map(([section, change, ids, , name]) => ({ section, ...inFile(name), change, ids, tasks: citing(ids).map(taskView) }));
    for (const [section, , ids, dg] of changes) { digests[section] = dg; reach.set(section, ids); }
  } else {
    // Both sides normalized like the fingerprint: a ticked sub-step ("  - [x] 1.1 …") is progress, not a change of task 1.
    const d = diffEntries(taskEntries(uncheckTasks(snap.text)), taskEntries(uncheckTasks(cur)));
    res.added = d.added.map((e) => ({ number: e.number, text: e.title }));
    res.modified = d.modified.map((m) => ({ number: m.key, before: m.before.title, after: m.after.title }));
    res.removed = d.removed.map((e) => ({ number: e.number, text: e.title }));
  }
  if (phase !== "tasks" || isChange) {
    // Every task a change reaches, once, with what reaches it.
    const byTask = new Map();
    for (const [k, ids] of reach) for (const b of citing(ids)) {
      const e = byTask.get(b) || { ...taskView(b), via: [] };
      if (!e.via.includes(k)) e.via.push(k);
      byTask.set(b, e);
    }
    res.affectedTasks = [...byTask.values()].sort((a, b) => a.number - b.number);
  }
  // Only what no earlier change request against THIS snapshot already recorded (same key, same content) counts —
  // for the reopen itself and for the hint offering it (a change already reopened, its task redone since, is covered).
  const prior = (state.changes || []).filter((c) => isRecord(c) && c.phase === phase && c.snapshot === snap.rel);
  const fresh = Object.keys(digests).filter((k) => !prior.some((c) => isRecord(c.digests) && c.digests[k] === digests[k]));
  // A REMOVED requirement is not redone: the tasks and test-plan rows still citing it are to be deleted or pointed at the
  // criterion that replaces it — listed in `retire`, never unticked ("redo them with fresh evidence" re-built a feature
  // the spec no longer has). A task also reached by a modified ID or a changed section is reopened as before.
  const byId = phase === "requirements" || phase === "test-plan" || isChange; // ID-keyed diffs (sections for design / eval-plan)
  const removedIds = new Set(byId ? res.removed.map((r) => r.id) : []);
  if (byId) {
    // test-plan: a removed T-ID's tasks still name it in _Makes green:_ (no test rows to list).
    res.retire = res.impacted.filter((x) => x.change === "removed" && (x.tasks.length || (x.tests || []).length))
      .map((x) => ({ id: x.id, tasks: x.tasks.map((t) => t.number), tests: (x.tests || []).map((t) => t.id) }));
  }
  const retireList = (res.retire || []).map((x) => I.retireItem(x.id, x.tasks.map((n) => "#" + n), x.tests)).join("; ");
  const RT = phase === "test-plan" ? I.retireTests : I; // a removed TEST is repointed/dropped, not a removed criterion
  // The same rule for a design / eval-plan change: an ID its section names that requirements.md no longer defines
  // reopens nothing.
  const reqText = phase === "design" || phase === "eval-plan" ? readIfExists(path.join(dir, "requirements.md")) : null;
  const reqNow = reqText != null ? requirementIndex(reqText) : null;
  const reopenIds = (k) => reach.get(k).filter((id) => !removedIds.has(id) && (!reqNow || id.startsWith("T-") || reqNow.has(id)));
  const toReopen = [...new Set(fresh.filter((k) => reach.has(k) && !removedIds.has(k)).flatMap((k) => citing(reopenIds(k))))].filter((b) => b.done)
    .sort((a, b) => a.number - b.number);
  if (!reopen) {
    // tasks: nothing reaches a task (reach is empty). The retire hint offers --reopen only while the removal is unrecorded.
    const offer = (res.retire || []).some((x) => fresh.includes(x.id));
    const hints = [toReopen.length ? I.reopenHint(slug, phase) : null, retireList ? RT.retireHint(retireList, slug, phase, offer) : null].filter(Boolean);
    if (hints.length) res.hint = hints.join(" ");
    return res;
  }
  if (!fresh.length) {
    // Why nothing is reopened: a design.md that changed without a snapshot to diff; nothing (structural) changed at all;
    // or every change was already covered by an earlier reopen against this approval.
    const note = !Object.keys(digests).length ? (res.designHint ? I.reopenDesignUnknown : I.nothingToReopen(res.changed)) : I.nothingNew;
    return Object.assign(res, { reopened: [], recorded: false, note });
  }
  if (toReopen.length) {
    // tasks.md first: a state write that fails afterwards leaves unticked tasks a re-run records — never a record
    // claiming tasks were reopened while they are still ticked. Line endings (CRLF too) are kept.
    const lines = tasksText.split("\n");
    for (const b of toReopen) {
      const raw = lines[b.line];
      if (/[xX]/.test(raw.charAt(b.col))) lines[b.line] = raw.slice(0, b.col) + " " + raw.slice(b.col + 1);
    }
    writeFileAtomic(tasksFile, lines.join("\n"));
  }
  for (const b of toReopen) {
    const rec = ownRecord(evidence[String(b.number)], b, dups.has(b.number)); // this task's record, never the other "N."'s
    if (isRecord(rec)) { rec.stale = true; delete rec.staleBy; } // mutates state.evidence in place (a spec change — not an undo, 1.16 U1)
  }
  const keys = (list, k) => list.map((x) => x[k]);
  const idKey = byId ? "id" : "section";
  const change = { at: new Date().toISOString(), phase, snapshot: snap.rel, added: keys(res.added, idKey), modified: keys(res.modified, idKey),
    removed: keys(res.removed, idKey), reopened: toReopen.map((b) => b.number), digests };
  state.changes = (state.changes || []).concat([change]);
  writeFileAtomic(statePath(dir), JSON.stringify(state, null, 2));
  maybeRefreshRoadmap(projectDir);
  const note = change.reopened.length ? [I.reopened(change.reopened.map((n) => "#" + n).join(", "), slug, ap), retireList ? RT.retireNote(retireList) : null].filter(Boolean).join(" ")
    : retireList ? RT.recordedRetire(state.changes.length, retireList, slug, ap) : I.recordedOnly(state.changes.length, slug, ap);
  return Object.assign(res, { reopened: change.reopened, recorded: true, changeRequest: state.changes.length, note });
}

// Human-readable spec_impact (CLI), in the feature's language.
function impactLines(r) {
  if (r.phase === "steering") return steeringImpactLines(r); // 1.16 Q1
  const I = i18n.msg(r.lang).impact;
  const R = i18n.msg(r.lang).evidenceGate.reason;
  const cut = (s, n = 90) => { const t = normWs(s); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
  const task = (t) => `#${t.number} [${t.done ? "x" : " "}] ${t.nothingToVerify ? I.nothingToVerify : t.evidence === "verified" ? I.verified : t.specChanged ? I.staleSpec : t.unticked ? i18n.msg(r.lang).undo.label : R[t.evidence] || t.evidence}`;
  if (r.baseline === "fingerprint-only" || r.baseline === "none") {
    const out = [(r.baseline === "none" ? I.headNone : I.headFp)(r.feature, r.phase, r.changed), "  " + r.hint];
    if (r.note) out.push("  " + r.note);
    return out;
  }
  const snaps = [r.snapshot, r.designMd && r.designMd.snapshot].filter(Boolean).join(", "); // a bugfix: bug.md + design.md
  const out = [I.head(r.feature, r.phase, String(r.approvedAt || "").slice(0, 10), snaps)];
  const label = (x) => (x.id || x.section || (x.number != null ? "#" + x.number : ""));
  // The criterion text without its own leading "**US-1.AC-2** —" (the label already names it) — or a test row's "T-01 |".
  const body = (x) => String(x.after != null ? x.after : x.text != null ? x.text : "")
    .replace(/^(?:\*\*|__)?(?:US-\d+\.AC-\d+|SC-\d+|EC-\d+|NFR-\d+|T-\d+)(?:\*\*|__)?\s*[—–:|-]?\s*/, "");
  // (1.21 review C4: a change lists its criteria, then its tasks — r.tasks)
  const lists = [["+", r.added], ["~", r.modified], ["-", r.removed], ...(r.tasks ? [["+", r.tasks.added], ["~", r.tasks.modified], ["-", r.tasks.removed]] : [])];
  for (const [sign, list] of lists) {
    for (const x of list || []) out.push(`  ${sign} ${label(x)}${body(x) && r.phase !== "design" ? "  " + cut(body(x)) : ""}`);
  }
  // design.md changed but can't be diffed (no snapshot of it): say that, never "no changes since the approval".
  if (r.designHint) out.push("  " + r.designHint);
  else if (lists.every(([, list]) => !(list || []).length)) out.push("  " + (r.changed ? I.noStructural : I.noChanges));
  if ((r.impacted || []).length) {
    out.push("  " + I.affected);
    for (const x of r.impacted) {
      const parts = [`${I.tasksLabel}: ${x.tasks.length ? x.tasks.map(task).join(", ") : I.none}`];
      if (x.tests) parts.push(`${I.testsLabel}: ${x.tests.length ? x.tests.map((t) => t.id).join(", ") : I.none}`);
      if (x.designSections) parts.push(`${I.designLabel}: ${x.designSections.length ? x.designSections.join(", ") : I.none}`);
      if (x.ids) parts.push(`${I.idsLabel}: ${x.ids.length ? x.ids.join(", ") : I.none}`);
      out.push(`    ${x.id || x.section} (${I.change[x.change] || x.change}) — ${parts.join(" · ")}`);
    }
  }
  const uncovered = (r.added || []).filter((a) => Array.isArray(a.tasks) && !a.tasks.length).map((a) => a.id);
  if (uncovered.length) out.push("  " + I.uncovered(uncovered.join(", ")));
  if (r.note) out.push("  " + r.note);
  else if (r.hint) out.push("  " + r.hint);
  if (r.changed) out.push("  → " + I.reReview(r.feature, r.phase, r.missingRoles)); // 1.14: with the role(s) still to sign
  return out;
}
// The approval chain next_action walks, in order: every active phase (PHASES; `execution` is the sign-off after a
// finish, not a planning phase), `tests` only once testsGateDue says the plan it implements exists (never a bugfix's),
// classification only when classification.md exists (a feature folder made by hand, or by an old engine, has none —
// it was never a gate there; every other chain artifact that is missing is "fill it").
function gateWalk(dir, tracks, kind) {
  if (kind === "spike") return []; // 1.14 C2: a spike has no approval chain (question → investigate → decide)
  if (kind === "change") return ["tasks"]; // 1.21 F5: a change has ONE planning approval — the plan (change.md), phase `tasks`
  return phaseOrder(featureFlow(dir, kind)).filter((ph) => ph !== "execution" && phaseActive(ph, tracks) && (ph !== "tests" || testsGateDue(dir, tracks, kind)) && // C3: the feature's flow orders the chain
    (ph !== "classification" || fs.existsSync(path.join(dir, "classification.md"))));
}
// The artifacts a phase's approval signs off, as next_action's "fill" step checks them: classification.md, the chain
// artifact(s) of that phase (a bugfix's design is bug.md, plus design.md while it holds active track sections), none for `tests`.
function gateArtifacts(dir, tracks, kind, phase) {
  if (phase === "classification") return ["classification.md"];
  return chainArtifacts(dir, tracks, kind).filter((a) => a.phase === phase).map((a) => a.file);
}
// Doctor's pending gates: the active phases whose artifact exists (phaseFile — a bugfix's design gate is due on bug.md)
// or, for `tests` (Phase 4, no artifact), once testsGateDue() says so — not approved yet, in the chain's order. approvePhase
// refuses a phase while an EARLIER one is still in this list (a phase with nothing to approve never blocks a later one).
function pendingGateList(dir, tracks, kind, approvals) {
  if (kind === "spike") return []; // 1.14 C2
  if (kind === "change") return fs.existsSync(path.join(dir, CHANGE_FILE)) && !(approvals || {}).tasks ? ["tasks"] : []; // 1.21 F5: the plan
  const due = (ph) => (ph === "tests" ? testsGateDue(dir, tracks, kind) : fs.existsSync(path.join(dir, phaseFile(ph, kind))));
  return phaseOrder(featureFlow(dir, kind)).filter((ph) => ph !== "execution" && phaseActive(ph, tracks) && due(ph) && !(approvals || {})[ph]); // C3: in the flow's order
}

// ---------------------------------------------------------------------------
// Flows (1.14 C3) — Kiro's tech-design-first variant. Some features start from an architecture (a port, platform or performance
// work): `.state.json → flow: "design-first"` (spec_create {flow} / `create --flow design-first`; changed later with spec_feature
// {action: "flow"} / `feature flow <name> <flow>`) orders the chain classification → design → requirements → (test-plan / eval-plan)
// → tests → tasks, for every reader of the order: gateWalk / pendingGateList (next_action, doctor, approve's phase-order check,
// the fast-forward), detectPhase and chainArtifacts (the placeholder gate's phase scoping), next_action's failing-check filter and
// the roadmap percent. The design gate of a design-first feature never looks at the requirements (they come after it): its
// clarifications are the design's own, and doctor defers the AC traceability while requirements.md is still a later phase's
// template. No flow (or "requirements-first") = the default order, unchanged. A bugfix, a spike — any kind but a plain feature —
// keeps its own fixed order: the flow is ignored there (spec_create says so; spec_feature {action: "flow"} refuses it).
// ---------------------------------------------------------------------------
const FLOWS = ["requirements-first", "design-first"];
const DESIGN_FIRST_PHASES = ["classification", "design", "requirements", "test-plan", "eval-plan", "tests", "tasks", "execution"];
// The flow a state (the raw .state.json data) gives. `kind`: the caller's (else the state's) — only a plain feature has one.
function flowOfState(st, kind) {
  const k = kind != null ? kind : isObj(st) && typeof st.kind === "string" ? st.kind : "feature";
  return k === "feature" && isObj(st) && st.flow === "design-first" ? "design-first" : "requirements-first";
}
// A feature folder's flow (read-cached like every .state.json read of the same call).
function featureFlow(dir, kind) {
  return flowOfState(readJson(statePath(dir)).data, kind);
}
const phaseOrder = (flow) => (flow === "design-first" ? DESIGN_FIRST_PHASES : PHASES);
// PHASE_INDEX / CHECK_PHASE / chainArtifacts' idx on the flow's scale: design-first swaps the requirements (1) and design (2) slots.
const flowIndex = (i, flow) => (flow === "design-first" && (i === 1 || i === 2) ? 3 - i : i);
const flowPhaseIndex = (phase, flow) => flowIndex(PHASE_INDEX[phase] || 0, flow);
// A track pack's `<name>-sections` check (1.15) is a design check, as the built-in marker tracks' are.
const checkPhaseIndex = (id, flow) => flowIndex((Object.prototype.hasOwnProperty.call(CHECK_PHASE, id) && CHECK_PHASE[id]) || (/-sections$/.test(id) ? 2 : 0), flow);
// The default flow's phase at the same position of the chain (design-first: design ↔ requirements) — for the tables keyed by
// position: PHASE_PERCENT (the roadmap percent) and NOT_STARTED_PHASES (spec_upgrade's status).
const positionPhase = (phase, flow) => (flow === "design-first" && (phase === "design" || phase === "requirements") ? (phase === "design" ? "requirements" : "design") : phase);
// A flow as given (MCP enum / CLI --flow, folded like the other enums) → { flow } | { flow: null } (not given) | { error }.
function parseFlow(v, lng) {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return { flow: null };
  const s = typeof v === "string" ? v.trim().toLowerCase() : null;
  if (s && FLOWS.includes(s)) return { flow: s };
  const A = i18n.msg(lng).args;
  return { error: A.invalid(A.item("flow", A.oneOf(FLOWS.join(", ")), JSON.stringify(typeof v === "string" ? v : String(v)))) };
}
// "classification → design → requirements → test-plan → tests → tasks" — the active phases of a feature in its flow's order.
function flowOrderText(dir, tracks, flow) {
  return phaseOrder(flow).filter((ph) => ph !== "execution" && phaseActive(ph, tracks) && (ph !== "classification" || fs.existsSync(path.join(dir, "classification.md")))).join(" → ");
}
// spec_feature {action: "flow", name, flow} / `dev-spec feature flow <name> <flow>` — set (or reset) a feature's flow. Phases
// already approved stay approved (named); the pending gates follow the new order at once. → { ok, action: "flow", feature, flow,
// previous, changed, order, pendingGates, note }
function setFeatureFlow(projectDir, name, flow) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const lng = featureLang(projectDir, f.slug);
  const F = i18n.msg(lng).flow;
  const pf = parseFlow(flow, lng);
  if (pf.error) return { ok: false, error: pf.error };
  if (!pf.flow) return { ok: false, error: F.required(f.slug, FLOWS.join(", ")) };
  const state = readState(projectDir, f.slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const kind = typeof state.kind === "string" ? state.kind : "feature";
  if (kind !== "feature") return { ok: false, kindIgnored: true, kind, error: F.kindRefused(f.slug, kind) };
  const tracks = detectTracks(f.dir);
  const previous = flowOfState(state);
  const res = { ok: true, action: "flow", feature: f.slug, flow: pf.flow, previous, changed: previous !== pf.flow };
  if (res.changed) {
    if (pf.flow === "design-first") state.flow = "design-first";
    else delete state.flow; // the default order: no key (a pre-1.14 engine reads the feature as it always did)
    writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
    maybeRefreshRoadmap(projectDir);
  }
  res.order = flowOrderText(f.dir, tracks, pf.flow);
  res.pendingGates = pendingGateList(f.dir, tracks, kind, state.approvals);
  const approved = ["requirements", "design"].filter((ph) => isRecord(state.approvals[ph]));
  res.note = [res.changed ? F.set(f.slug, pf.flow, previous, res.order) : F.same(f.slug, pf.flow, res.order),
    res.changed && approved.length ? F.approvedStay(approved.join(", ")) : null].filter(Boolean).join(" ");
  return res;
}
const setFeatureFlowLocked = featureLocked(setFeatureFlow); // manageFeature's "flow": a .state.json read-modify-write, under the feature lock
// createFeature's flow (spec_create {flow} / `create --flow`) → { error } | { flow, store?, note? }. A NEW plain feature created
// design-first stores it (`store`); an existing feature keeps its flow (a note names spec_feature {action: "flow"} when another
// one is asked); any other kind (bugfix, spike…) ignores it, and a note says so.
function createFlow(projectDir, slug, dir, existed, kind, asked, lang) {
  const lng = existed ? featureLang(projectDir, slug) : normalizeLang(lang || projectLang(projectDir));
  const pf = parseFlow(asked, lng);
  if (pf.error) return { error: pf.error };
  const F = i18n.msg(lng).flow;
  if (existed) {
    const cur = featureFlow(dir);
    return { flow: cur, note: pf.flow && pf.flow !== cur ? (kind !== "feature" ? F.kindIgnored(kind) : F.kept(slug, cur, pf.flow)) : null };
  }
  if (kind !== "feature") return { flow: "requirements-first", note: pf.flow === "design-first" ? F.kindIgnored(kind) : null };
  return { flow: pf.flow || "requirements-first", store: pf.flow === "design-first" ? "design-first" : null };
}
// The new feature's .state.json (just written by createFeature) ← flow.
function storeCreateFlow(dir, flow) {
  const j = readJson(statePath(dir));
  if (!isObj(j.data)) return;
  j.data.flow = flow;
  writeFileAtomic(statePath(dir), JSON.stringify(j.data, null, 2));
}

// The phase each doctor check belongs to (PHASE_INDEX scale) — next_action only puts the current phase's failures
// (and earlier ones) first. A check not listed (placeholders: it only fails for the current phase or an earlier
// one) counts as current.
const CHECK_PHASE = { requirements: 1, ears: 1, clarifications: 1, "success-criteria": 1, priorities: 1, "ac-uniqueness": 1, reproduction: 1,
  design: 2, mermaid: 2, "constitution-check": 2, "saas-sections": 2, "ai-sections": 2, "sec-sections": 2, "privacy-sections": 2, "dist-sections": 2, "api-sections": 2, "ui-sections": 2, "obs-sections": 2, "data-sections": 2, "root-cause": 2,
  "test-plan": 3, "eval-plan": 4, traceability: 5, "duplicate-tasks": 5, "verify-pipes": 5, "malformed-markers": 5, verification: 6, "outside-code-artifacts": 6 };
CHECK_PHASE["task-deps"] = 5; // 1.14 F3: the tasks phase (task dependencies)
Object.assign(CHECK_PHASE, { glossary: 1, "cross-feature-acs": 1, "steering-changed-since-approval": 2 }); // 1.16 Q (warns only)
Object.assign(CHECK_PHASE, { "design-tradeoffs": 2, "design-risks": 2, "design-reuse": 2 }); // 1.17 A1, 1.19 R1 (warns only)
CHECK_PHASE["change-scope"] = 1; // 1.21 F5: a change's size (1–3 criteria, 1–3 tasks, core only) — its plan, from the start

// 1.21 F5 — a change stays XS: 1–3 acceptance criteria, 1–3 tasks, no optional track (a +track is a design's worth of sections).
// Past that it is a feature of size s — never ratcheted silently: doctor fails `change-scope`, the plan approval refuses, and the
// detail says so (a new feature, spec_create {size: "s"}; the change archived). → { ok, acs, tasks, tracks, detail }
const CHANGE_MAX_ACS = 3, CHANGE_MAX_TASKS = 3;
function changeScope(dir, tracks, lang) {
  const text = readIfExists(path.join(dir, CHANGE_FILE)) || "";
  // 1.21 review C1: the criteria are change.md WITHOUT its task blocks — a task's _Requirements:_ reference defines none
  const acs = requirementAcIds(changeViews(text).criteria).size;
  const tasks = parseTasks(text).length;
  const extra = (tracks || []).filter((t) => t !== "core");
  const ok = acs >= 1 && acs <= CHANGE_MAX_ACS && tasks >= 1 && tasks <= CHANGE_MAX_TASKS && !extra.length;
  const S = i18n.msg(lang).sizes;
  return { ok, acs, tasks, tracks: extra, detail: ok ? S.scopeOk(acs, tasks) : S.scope(acs, tasks, CHANGE_MAX_ACS, CHANGE_MAX_TASKS, extra.map((t) => "+" + t).join(", ")) };
}

// ---------------------------------------------------------------------------
// Gates — the ONE view doctor / approve / next_action / finish / roadmap share of what a phase still lacks
// ---------------------------------------------------------------------------

// detectPhase's phases on the chain's scale: the artifact at the current position and every earlier one must be
// real content; later ones may still be templates (tasks-ready = tasks.md is current; executing/complete = all).
const PHASE_INDEX = { empty: 0, classified: 0, requirements: 1, design: 2, "test-plan": 3, "eval-plan": 4, tests: 5, "tasks-ready": 5, executing: 6, complete: 6 };

// The planning chain in phase order (detectPhase's walk). A bugfix's bug.md takes the design slot — its Root Cause
// replaces the design — and its design.md joins only while it holds active track sections (detectPhase's rule).
function chainArtifacts(dir, tracks, kind) {
  if (kind === "spike") return []; // 1.14 C2: spike.md is judged by the spike tools (spikeDoctor / spikeFinish), not the planning chain
  if (kind === "change") return [{ file: CHANGE_FILE, phase: "tasks", idx: 1 }]; // 1.21 F5: the plan is the whole chain (current from the start)
  const out = [{ file: "requirements.md", phase: "requirements", idx: 1 }];
  if (kind === "bugfix") {
    out.push({ file: "bug.md", phase: "design", idx: 2 });
    const d = readIfExists(path.join(dir, "design.md"));
    if (d != null && !headingsOnly(activeDesign(d, tracks))) out.push({ file: "design.md", phase: "design", idx: 2 });
  } else if (featureFlow(dir, kind) === "design-first") { // C3: design first — the requirements take the second slot
    out[0].idx = 2;
    out.unshift({ file: "design.md", phase: "design", idx: 1 });
  } else out.push({ file: "design.md", phase: "design", idx: 2 });
  if (tracks.includes("tdd")) out.push({ file: "test-plan.md", phase: "test-plan", idx: 3 });
  if (tracks.includes("ai")) out.push({ file: "eval-plan.md", phase: "eval-plan", idx: 4 });
  out.push({ file: "tasks.md", phase: "tasks", idx: 5 });
  return out;
}

// Approved artifacts whose content changed after THEIR OWN approval (fingerprint at approval; checkbox ticks in
// tasks.md don't count). Approvals recorded before fingerprints existed fall back to that phase's own timestamp —
// never the latest approval of any phase. Inactive-track phases are skipped. Shared by next_action, finish, roadmap.
// kind: the feature's (state.kind). A file's date is no evidence of an edit — a clone, checkout, copy or unzip gives every
// file a new mtime — so what is judged by it alone is reported apart (opts.detail → { changed, byDate, untracked }):
//   byDate     a pre-1.11 approval (no fingerprint): its phase file newer than the approval — kept in `changed` (next_action,
//              doctor and the roadmap show it, as 1.12 did) but never a spec_finish blocker (a warning there);
//   untracked  a pre-1.13 bugfix design approval (no fingerprint, no `file`) signed off bug.md, and nothing about bug.md was
//              recorded (1.12 never tracked it): not a change at all — re-approving starts tracking it.
// Without opts.detail → the `changed` list.
function changedSinceApproval(dir, approvals, tracks, kind, opts = {}) {
  const out = [];
  const byDate = [];
  const untracked = [];
  for (const [ph, file] of Object.entries(PHASE_FILE)) {
    const a = approvals && approvals[ph];
    if (a && !a.fingerprint && !a.file && a.at && kind === "bugfix" && ph === "design" && phaseActive(ph, tracks)) {
      // bug.md: untracked (above). design.md: 1.12 fingerprinted design.md whenever it existed, so one that exists now was
      // created after this approval (a track added since) — a change known without any date, as for a 1.13 approval.
      if (fs.existsSync(path.join(dir, phaseFile(ph, "bugfix")))) untracked.push({ phase: ph, file: phaseFile(ph, "bugfix") });
      if (fs.existsSync(path.join(dir, file))) out.push(file);
      continue;
    }
    if (a && a.file !== file && a.file === phaseFile(ph, "bugfix") && phaseActive(ph, tracks)) {
      // A bugfix's design approval signed off bug.md (`file`, see phaseFile) and design.md as it was then
      // (`designFingerprint`) — a design.md created since (a track added) is a change too.
      const bug = path.join(dir, a.file), design = path.join(dir, file);
      if (fs.existsSync(bug) && !artifactMatches(bug, ph, a.fingerprint)) out.push(a.file);
      if (fs.existsSync(design) && !artifactMatches(design, ph, a.designFingerprint)) out.push(file);
      continue;
    }
    const rel = kind === "change" ? phaseFile(ph, kind) : file; // 1.21 F5: a change's plan approval signed off change.md
    const abs = path.join(dir, rel);
    if (!a || !fs.existsSync(abs) || !phaseActive(ph, tracks)) continue;
    if (a.fingerprint) {
      if (!artifactMatches(abs, ph, a.fingerprint)) out.push(rel);
    } else if (a.at && ph !== "tasks") {
      try { if (fs.statSync(abs).mtime.getTime() > new Date(a.at).getTime()) { out.push(rel); byDate.push(rel); } } catch { /* ignore */ }
    }
  }
  return opts.detail ? { changed: out, byDate, untracked } : out;
}

// Success criteria / priorities count once they are REAL: the template's "Priorities: **P1** = …" legend, its
// "US-1 (P1 — MVP): [Story Title]" and its placeholder SC-001 line must not pass while still template — nor a line in a
// fenced example or an HTML comment.
function realLines(md, re) {
  return stripFencedCode(stripHtmlComments(md || "")).split(/\r?\n/).filter((l) => re.test(l) && !placeholderReport(l).length);
}
function hasSuccessCriteria(md) {
  return realLines(md, /(?<![A-Za-z0-9])SC-\d+/).length > 0;
}
function hasPriority(md) {
  // A line naming P1, P2 AND P3 is the priority legend, not a prioritized story.
  return realLines(md, /(?<![A-Za-z0-9])P1(?![0-9])/).some((l) => !(/(?<![A-Za-z0-9])P2(?![0-9])/.test(l) && /(?<![A-Za-z0-9])P3(?![0-9])/.test(l)));
}
// Duplicate AC DEFINITIONS (the ID opening a list item, optionally bold) — "as in US-1.AC-1" is a reference, and a
// fenced example is no definition.
function acDuplicates(md) {
  const seen = new Set(), dups = new Set();
  // The indent within its line ([^\S\n\r\u2028\u2029]): the same IDs, without rescanning a long blank run from each of its
  // line starts (1.17 H).
  for (const mm of stripFencedCode(stripHtmlComments(md || "")).matchAll(/^[^\S\n\r\u2028\u2029]*(?:\d+[.)]|[-*+])\s+(?:\*\*|__)?(US-\d+\.AC-\d+)(?!\d)/gm)) (seen.has(mm[1]) ? dups : seen).add(mm[1]);
  return [...dups];
}
// A section with real content: present, no `> **TODO**` sentinel, not empty, no template placeholder left.
function sectionFilled(md, syn) {
  const b = extractSection(md || "", syn);
  return b != null && !RE_TODO_SENTINEL.test(b) && !!stripHtmlComments(b).trim() && !placeholderReport(b).length;
}
// bug.md's Reproduction / Root Cause as the bugfix gates judge them (doctor, approve requirements / design, complete_task's
// root-cause gate, finish, the brief): present, no `> **TODO**` sentinel, not empty, and no bug-report placeholder left
// (bugPlaceholders — quoted evidence such as `[object Object]` or `[WARN]` is content, not a slot).
function bugSectionFilled(md, syn) {
  const b = extractSection(md || "", syn);
  return b != null && !RE_TODO_SENTINEL.test(b) && !!stripHtmlComments(b).trim() && !bugPlaceholders(b, placeholderReport(b)).length && hasProseOutsideBrackets(b);
}
const CONSTITUTION_SYN = ["constitution check", "verificação da constituição", "verificacao da constituicao", "verificación de la constitución", "verificacion de la constitucion"];

// What approving `phase` requires (the same checks doctor runs, scoped to that phase). → { artifact, file, checks }
// where `checks` lists only the FAILING ones as { id, detail }; artifact=false = nothing to approve (the file is
// missing, or its track is off) — an error even with force.
function approvalChecks(projectDir, slug, dir, phase, tracks, kind, lang) {
  const fm = i18n.msg(lang);
  const m = fm.doctor, G = fm.gates;
  const read = (x) => readIfExists(path.join(dir, x));
  const exists = (x) => fs.existsSync(path.join(dir, x));
  const checks = [];
  const need = (id, ok, detail) => { if (!ok && !checks.some((c) => c.id === id)) checks.push({ id, detail }); };
  const noPlaceholders = (x) => { const r = artifactReport(dir, x, tracks); need("placeholders", r.state !== "placeholder", placeholderSummary([r], lang)); };
  const gaps = (tr, kinds) => traceGapLines({ ...Object.fromEntries(kinds.map((k) => [k, tr[k] || []])), removedAcs: tr.removedAcs }, lang).join("; ");
  const nothing = (file) => ({ artifact: false, file, checks });
  const bugfix = kind === "bugfix";
  const label = (s) => `${fm.sectionNames[s.section] || s.section}:${fm.sectionStatus[s.status] || s.status}`;
  switch (phase) {
    case "classification":
      if (!exists("classification.md")) return nothing("classification.md");
      noPlaceholders("classification.md");
      break;
    case "requirements": {
      if (!exists("requirements.md")) return nothing("requirements.md");
      const reqs = read("requirements.md");
      const ev = earsValidate(reqs, lang);
      const errs = (ev.issues || []).filter((i) => i.severity === "error");
      need("ears", !errs.length, errs.slice(0, 3).map((i) => `L${i.line} ${i.msg}`).join("; "));
      const unlinted = earsUnlinted(reqs, ev); // AC IDs trace_check counts, none linted (doctor's rule — Pa2)
      need("ears", !unlinted, unlinted ? m.earsNoCriteria(unlinted) : "");
      const unidentified = earsUnidentified(reqs, ev); // …and the mirror: criteria, but no AC ID trace_check counts (1.22 review)
      need("ears", !unidentified, unidentified ? m.earsNoAcIds(shortIdList(unidentified)) : "");
      noPlaceholders("requirements.md");
      const mk = clarificationMarkers(reqs);
      need("clarifications", !mk.length, m.clarificationsOpen(mk.length));
      need("success-criteria", hasSuccessCriteria(activeDesign(reqs, tracks)), m.scMissing);
      need("priorities", hasPriority(activeDesign(reqs, tracks)), m.prioritiesMissing);
      const dups = acDuplicates(reqs);
      need("ac-uniqueness", !dups.length, m.acDup(dups.join(", ")));
      if (bugfix) need("reproduction", bugSectionFilled(read("bug.md"), REPRO_SYN), m.reproMissing);
      break;
    }
    case "design": {
      const design = read("design.md");
      if (bugfix) {
        // A bugfix has no design of its own: its Root Cause stands in for it.
        if (!exists("bug.md")) return nothing("bug.md");
        need("root-cause", bugSectionFilled(read("bug.md"), ROOT_CAUSE_SYN), m.rootCauseMissing);
      } else {
        if (design == null) return nothing("design.md");
        noPlaceholders("design.md");
        need("constitution-check", sectionFilled(activeDesign(design, tracks), CONSTITUTION_SYN), G.constitutionUnfilled);
      }
      if (design != null) {
        // 1.21 F5: a NEW approval is held to the stricter rule — a section holding only the template's guidance is not filled —
        // and a sized feature to its size (an optional extended section at S, a section another active track covers).
        const size = featureSize(dir);
        for (const [tr, , rows] of trackSectionReport(design, tracks, { size, lang })) {
          const bad = rows.filter((s) => sectionVerdict(s, { size }) !== "pass");
          need(tr + "-sections", !bad.length, bad.map(label).join("; "));
        }
      }
      // C3: a design-first design is approved BEFORE the requirements are written — only its own open questions block it.
      const reqMarkers = featureFlow(dir, kind) === "design-first" ? [] : clarificationMarkers(read("requirements.md") || "");
      const mk = [...reqMarkers, ...clarificationMarkers(design || "")];
      need("clarifications", !mk.length, m.clarificationsOpen(mk.length));
      break;
    }
    case "test-plan": {
      if (!phaseActive("test-plan", tracks) || !exists("test-plan.md")) return nothing("test-plan.md");
      noPlaceholders("test-plan.md");
      const tr = traceCheck(projectDir, slug);
      need("traceability", !(tr.uncoveredByTests || []).length && !(tr.phantomAcsInTests || []).length, gaps(tr, ["uncoveredByTests", "phantomAcsInTests"]));
      break;
    }
    case "eval-plan":
      if (!phaseActive("eval-plan", tracks) || !exists("eval-plan.md")) return nothing("eval-plan.md");
      noPlaceholders("eval-plan.md");
      break;
    case "tasks": {
      if (kind === "change") { // 1.21 F5 — the plan of a change: ONE file holds its criteria and its tasks, one gate checks both
        if (!exists(CHANGE_FILE)) return nothing(CHANGE_FILE);
        const text = read(CHANGE_FILE);
        const crit = changeViews(text).criteria; // 1.21 review C1: its criteria without the task blocks (line numbers kept)
        const ev = earsValidate(crit, lang);
        const errs = (ev.issues || []).filter((i) => i.severity === "error");
        need("ears", !errs.length, errs.slice(0, 3).map((i) => `L${i.line} ${i.msg}`).join("; "));
        const unlinted = earsUnlinted(crit, ev);
        need("ears", !unlinted, unlinted ? m.earsNoCriteria(unlinted, CHANGE_FILE) : "");
        const unidentified = earsUnidentified(crit, ev);
        need("ears", !unidentified, unidentified ? m.earsNoAcIds(shortIdList(unidentified), CHANGE_FILE) : "");
        noPlaceholders(CHANGE_FILE);
        const mk = clarificationMarkers(text);
        need("clarifications", !mk.length, m.clarificationsOpenPlan(mk.length)); // (1.21 verify V7: no design to resolve them before)
        const dups = acDuplicates(crit);
        need("ac-uniqueness", !dups.length, m.acDup(dups.join(", ")));
        need("placeholders", parseTasks(text).some((t) => !isPlaceholderTask(t.text)), G.noRealTasks);
        const sc = changeScope(dir, tracks, lang);
        need("change-scope", sc.ok, sc.detail);
        const tr = traceCheck(projectDir, slug);
        const kinds = ["uncoveredByTasks", "phantomAcsInTasks", "phantomTestsInTasks"];
        need("traceability", kinds.every((k) => !(tr[k] || []).length), gaps(tr, kinds));
        const deps = taskDepsCheck(taskBlocks(text || ""), lang);
        if (deps) need("task-deps", deps.status !== "fail", deps.detail);
        break;
      }
      if (!exists("tasks.md")) return nothing("tasks.md");
      noPlaceholders("tasks.md");
      // No placeholder tasks: bracketed ones are in the report above; a list made ONLY of the scaffold's verbatim track
      // tasks (isPlaceholderTask) is not a breakdown yet either — detectPhase's "tasks-ready" rule.
      const active = parseTasks(activeTasks(read("tasks.md"), tracks));
      need("placeholders", active.some((t) => !isPlaceholderTask(t.text)), G.noRealTasks);
      const tr = traceCheck(projectDir, slug);
      const kinds = ["uncoveredByTasks", "phantomAcsInTasks", "phantomTestsInTasks"];
      need("traceability", kinds.every((k) => !(tr[k] || []).length), gaps(tr, kinds));
      const deps = taskDepsCheck(taskBlocks(activeTasks(read("tasks.md"), tracks) || ""), lang); // 1.14 F3: doctor's task-deps
      if (deps) need("task-deps", deps.status !== "fail", deps.detail);
      break;
    }
    case "tests": {
      // Phase 4 has no artifact of its own: it signs off the failing tests (+tdd) / the eval harness (+ai) that implement
      // an active plan — nothing to approve without one (a core-only feature has no Phase 4).
      const tdd = tracks.includes("tdd") && exists("test-plan.md");
      const ai = tracks.includes("ai") && exists("eval-plan.md");
      if (!phaseActive("tests", tracks) || (!tdd && !ai)) return nothing(tracks.includes("ai") && !tracks.includes("tdd") ? "eval-plan.md" : "test-plan.md");
      if (tdd) {
        // Every planned T-ID named by a test file (SKILL Phase 4: the T-ID in each failing test's name) — trace_check's
        // own code scan, so a row scoped to a test path counts only there.
        const planned = extractTestIds(planIdText(read("test-plan.md") || "")).size;
        const tr = planned ? traceCheck(projectDir, slug, { code: true }) : null;
        const missing = tr && tr.ok && tr.code ? tr.code.plannedNotInCode : [];
        // Once tasks are ticked (executing / complete) the code exists: the refusal is worded as next_action's sign-off
        // (name each existing test's T-ID), never "write each failing test".
        const started = missing.length && ["executing", "complete"].includes(detectPhase(dir, tracks));
        need("tests-in-code", planned > 0 && !missing.length, planned ? (started ? G.testsNotInCodeSignOff : G.testsNotInCode)(missing.join(", ")) : G.noPlannedTests);
      }
      if (ai) {
        // The harness runs this feature's eval sets: evals/golden.json must be a set of its own, not the scaffold's sample.
        const golden = readJson(path.join(dir, "evals", "golden.json"));
        const items = golden.data && Array.isArray(golden.data.items) ? golden.data.items : null;
        const sample = items && JSON.stringify(golden.data) === JSON.stringify(JSON.parse(SAMPLE_GOLDEN));
        need("eval-sets", !!(items && items.length) && !sample, sample ? G.evalSetsSample : G.evalSetsMissing);
      }
      break;
    }
    case "execution": {
      // The sign-off after a READY finish (commands/spec-finish.md): spec_finish's blockers are its failing checks —
      // open or unverified tasks, pending gates, edits after approval, placeholders, a bugfix's missing root cause.
      const fin = finishFeature(projectDir, slug, { gateOnly: true });
      if (fin.ok) fin.checks.forEach((c) => need(c.id, false, c.detail));
      break;
    }
    default:
  }
  return { artifact: true, checks };
}

// Multilingual heading matchers for the doctor / clarify checks.
const RE_CONSTITUTION_CHECK = /constitution check|verifica[çc][ãa]o da constitui[çc][ãa]o|verificaci[óo]n de la constituci[óo]n/i;
const RE_SUCCESS_CRITERIA = /success criteria|crit[ée]rios de sucesso|criterios de [ée]xito/i;
const RE_INDEPENDENT_TEST = /independent test|teste independente|prueba independiente/i;
const RE_OUT_OF_SCOPE = /out of scope|fora de [aâ]mbito|fora do [aâ]mbito|fora d[eo] escopo|fuera de alcance/i; // pt-BR: Fora do Escopo
const RE_NFR = /non-functional|nfr|performance|security|n[ãa]o[- ]funcional|no funcional|desempenho|rendimento|rendimiento|seguran[çc]a|seguridad/i;
const RE_EDGE_CASES = /edge case|error handling|casos? limite|casos? l[íi]mite|tratamento de erro|manejo de error/i;
// The +tdd design block heading, localized (used by addTrack to avoid re-appending it).
const RE_TESTABILITY = /##\s*(testability notes|notas de testabilidade|notas de testabilidad)/i;

module.exports = { phaseActive, testsGateDue, detectPhase, approvePhase, WAIVER_MAX_DAYS, waiverInput, waiverView,
  forcedApprovalList, waiverSummaryLines, waiverResult, waiverExpiredCheck, strictestWaiver, legacySeeds,
  revokeApproval, RE_ROLE, normRole, parseRoleList, validateApprovalRoles, parseApprovalRolesText, approvalRolesOf,
  approvalRolesFrom, rolesSummary, setApprovalRoles, approvalRole, phaseContent, sameContent, approvalRoleRecords,
  roleSignOffs, recordRoleSignOff, dropRoleSignOffs, roleSignOffResult, roleGateView, roleLabel, roleWaitList,
  reReviewRoles, fastForwardPlan, planFastForwardEnd, approveStepExtras, approveThrough, HISTORY_DIR, IMPACT_PHASES, RE_REQ_REF,
  RE_OTHER_REQ_REF, RE_TEST_REF, RE_DEFINES_REQ_ID, normWs, refsIn, shortDigest, isApprovalRecord, legacyRecord,
  writeSnapshot, historyText, latestSnapshot, designBaseline, snapshotPhases, requirementIndex, diffEntries,
  sectionEntries, taskEntries, plannedTestEntries, activeTaskBlocks, impactReport, impactLines, gateWalk, gateArtifacts,
  pendingGateList, FLOWS, DESIGN_FIRST_PHASES, flowOfState, featureFlow, phaseOrder, flowIndex, flowPhaseIndex,
  checkPhaseIndex, positionPhase, parseFlow, flowOrderText, setFeatureFlow, setFeatureFlowLocked, createFlow,
  storeCreateFlow, CHECK_PHASE, CHANGE_MAX_ACS, CHANGE_MAX_TASKS, changeScope, PHASE_INDEX, chainArtifacts, changedSinceApproval, realLines, hasSuccessCriteria,
  hasPriority, acDuplicates, sectionFilled, bugSectionFilled, CONSTITUTION_SYN, approvalChecks, RE_CONSTITUTION_CHECK,
  RE_SUCCESS_CRITERIA, RE_INDEPENDENT_TEST, RE_OUT_OF_SCOPE, RE_NFR, RE_EDGE_CASES, RE_TESTABILITY, __link };

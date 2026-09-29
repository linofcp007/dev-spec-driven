"use strict";

/**
 * dev-spec-driven engine — approvals, waivers and roles.
 * spec_approve (an approval is a gate, not a stamp), forced approvals and waivers, revocation, approvals by role
 * and the fast-forward approval.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let approvalChecks, artifactReport, detectTracks, errs, existingFeature, featureFlow, featureLang, gateArtifacts,
  gateWalk, isApprovalRecord, isObj, isRecord, legacyRecord, loadRoadmap, maybeRefreshRoadmap, normalizeLang, own,
  pendingGateList, PHASE_FILE, phaseActive, phaseFile, phaseOrder, PHASES, readIfExists, readRoadmap, readState,
  reasonInput, statePath, STEERING_GOVERNED, steeringFingerprints, textFingerprint, timeOf, todayIso, validIsoDay,
  writeFileAtomic, writeRoadmap, writeSnapshot;
function __link(E) { ({ approvalChecks, artifactReport, detectTracks, errs, existingFeature, featureFlow, featureLang,
  gateArtifacts, gateWalk, isApprovalRecord, isObj, isRecord, legacyRecord, loadRoadmap, maybeRefreshRoadmap,
  normalizeLang, own, pendingGateList, PHASE_FILE, phaseActive, phaseFile, phaseOrder, PHASES, readIfExists,
  readRoadmap, readState, reasonInput, statePath, STEERING_GOVERNED, steeringFingerprints, textFingerprint, timeOf,
  todayIso, validIsoDay, writeFileAtomic, writeRoadmap, writeSnapshot } = E); }

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
    design = readIfExists(path.join(f.dir, PHASE_FILE[p]));
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
  if (p === "design") entry.weigh = true;
  if (rc.role) entry.role = rc.role; // 1.14 B3: the role signing (informational on a phase no role is required for)
  if (opts.batch === true) entry.batch = true; // 1.14 B3: approved by a fast-forward (metrics count them apart)
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
  if (entry.role) record.role = entry.role;
  if (entry.batch) record.batch = true;
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
  if (file && file !== PHASE_FILE[phase]) {
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
  const stale = [], resign = [];
  for (const p of pendingGates) {
    if (!cfg[p]) continue;
    const v = roleSignOffs(state, p, cfg[p], phaseContent(dir, p, kind));
    pending[p] = { required: cfg[p].slice(), signed: v.signed, missing: v.missing, stale: v.stale };
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
  if (stale.length) notes.push(E.staleSignOffs(stale.join(", ")));
  if (resign.length) notes.push(E.resigning(resign.join(", ")));
  const un = Object.entries(unsigned);
  if (un.length) notes.push(E.unsigned(un.map(([p, l]) => `${p} (${l.join(", ")})`).join(", ")));
  return { any: true, pending, unsigned, notes, label: (p) => roleLabel(pending, p, lng) };
}
// "design (missing role: security)" for a pending phase that waits for roles; the bare phase otherwise.
function roleLabel(pendingRoles, p, lng) {
  const pr = isObj(pendingRoles) && own(pendingRoles, p) ? pendingRoles[p] : null;
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
// → { through: "tasks", phases, role } | null (fewer than two phases, or some gate would refuse).
function fastForwardPlan(projectDir, slug, dir, st, tracks, kind, pending, doc, lng) {
  const walk = gateWalk(dir, tracks, kind);
  const start = walk.indexOf(pending), end = walk.indexOf("tasks");
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
  return { through: "tasks", phases: chain, role };
}
// next_action's "approve" step, 1.14: the roles still missing for the pending phase (the recommendation names the role to
// sign as) and the fast-forward, when it applies. → { text, missingRoles?, fastForward? } (text null = keep the default).
function approveStepExtras(projectDir, slug, dir, st, tracks, kind, pending, doc, lng) {
  const E = i18n.msg(lng).governance;
  const out = { text: null };
  const pr = doc.pendingRoles && own(doc.pendingRoles, pending) ? doc.pendingRoles[pending] : null;
  if (pr && pr.missing.length) {
    out.missingRoles = pr.missing;
    out.text = E.approveRoles(pending, slug, E.missing(pr.missing), pr.signed.join(", "), pr.missing[0]);
  }
  const ff = fastForwardPlan(projectDir, slug, dir, st, tracks, kind, pending, doc, lng);
  if (ff) {
    out.fastForward = ff;
    out.hint = E.ffHint(slug, ff.phases.join(", "), ff.role);
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
  const approved = [], steps = [];
  let approvals = state.approvals;
  for (const ph of chain) {
    const r = approvePhase(projectDir, f.slug, ph, by, { force: opts.force === true, role: opts.role, batch: true, reason: opts.reason, expires: opts.expires });
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

module.exports = { approvePhase, WAIVER_MAX_DAYS, waiverInput, waiverView, forcedApprovalList, waiverSummaryLines,
  waiverResult, waiverExpiredCheck, strictestWaiver, legacySeeds, revokeApproval, RE_ROLE, normRole, parseRoleList,
  validateApprovalRoles, parseApprovalRolesText, approvalRolesOf, approvalRolesFrom, rolesSummary, setApprovalRoles,
  approvalRole, phaseContent, sameContent, approvalRoleRecords, roleSignOffs, recordRoleSignOff, dropRoleSignOffs,
  roleSignOffResult, roleGateView, roleLabel, roleWaitList, reReviewRoles, fastForwardPlan, approveStepExtras,
  approveThrough, __link };

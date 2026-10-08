"use strict";

/**
 * dev-spec-driven engine — spec_upgrade.
 * meta.specVersion, the read-only audit and the safe migrations after the plugin is updated.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, baselineDrift, chainArtifacts, CHANGE_FILE, criteriaBareIds, criteriaText, DESIGN_WEIGH_IDS, detectTracks, ensureLockIgnore, errs, existsCached,
  featureBusyResult, featureDirs, fingerprintMatches, flowOfState, isApprovalRecord, isChangeDir, isGeneratedOrAbsent, isObj,
  isRecord, latestSnapshot, legacyPackName, legacyPackMarkerTrack, packReservedSince, legacyRecord, LOCK_IGNORE_LINES, maybeRefreshRoadmap, missingPackTracks,
  nextAction, normalizeLang, parseTasks, PHASE_FILE, phaseActive, phaseFile, positionPhase, projectLang, readIfExists,
  readJson, readRoadmap, realRootOf, roadmapBusyResult, roadmapError, savedTracks, scanTestCode, shortIdList, specDoctor, specsRoot,
  staleFinish, stateFromFile, statePath, timeOf, trackLabel, unverifiedLabel, verificationStatus, withFeatureLock,
  withRoadmapLock, writeFileAtomic, writeRoadmap, writeSnapshot;
function __link(E) { ({ activeTasks, baselineDrift, chainArtifacts, CHANGE_FILE, criteriaBareIds, criteriaText, DESIGN_WEIGH_IDS, detectTracks, ensureLockIgnore,
  errs, existsCached, featureBusyResult, featureDirs, fingerprintMatches, flowOfState, isApprovalRecord, isChangeDir,
  isGeneratedOrAbsent, isObj, isRecord, latestSnapshot, legacyPackName, legacyPackMarkerTrack, packReservedSince, legacyRecord, LOCK_IGNORE_LINES,
  maybeRefreshRoadmap, missingPackTracks, nextAction, normalizeLang, parseTasks, PHASE_FILE, phaseActive, phaseFile,
  positionPhase, projectLang, readIfExists, readJson, readRoadmap, realRootOf, roadmapBusyResult, roadmapError,
  savedTracks, scanTestCode, shortIdList, specDoctor, specsRoot, staleFinish, stateFromFile, statePath, timeOf, trackLabel,
  unverifiedLabel, verificationStatus, withFeatureLock, withRoadmapLock, writeFileAtomic, writeRoadmap, writeSnapshot } = E); }

// ---------------------------------------------------------------------------
// Upgrade (1.13) — after the plugin is updated. roadmap.json meta.specVersion records the dev-spec version that last
// upgraded or created the project; spec_upgrade / `dev-spec upgrade [--apply]` / `/spec-upgrade` audits every active
// feature against the current rules and (apply) runs the safe migrations; SessionStart prints one line while the stamp is
// absent or older than the engine.
// ---------------------------------------------------------------------------

// The engine's own version: package.json at the repo root (mcp/lib/engine → ../../../package.json), read ONCE — as the engine
// loads (the call below the function, 1.20 review): a long-lived process (the MCP server) reports, stamps and compares the
// corpus stamp with (markdown.js) the version it LOADED, never one a `git pull` wrote under it since. null when it can't be
// read or isn't x.y.z — then nothing is stamped and no notice is shown (never a guessed version).
let ENGINE_VERSION = undefined; // undefined: not read yet — initialized, so it never reads as a linked name (mcp/test.js)
function engineVersion() {
  if (ENGINE_VERSION === undefined) {
    ENGINE_VERSION = null;
    try {
      const v = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "package.json"), "utf8").replace(/^\uFEFF/, "")).version;
      if (typeof v === "string" && parseSemver(v)) ENGINE_VERSION = v.trim();
    } catch { /* the engine was copied without its package.json: unknown */ }
  }
  return ENGINE_VERSION;
}
engineVersion(); // at load: the version this process runs (package.json only, and parseSemver — nothing linked yet)
// "1.13.0" / "v1.13.0" / "1.14.0-beta.2" → { nums: [1, 13, 0], pre: ["beta", "2"] | null }; anything else → null.
function parseSemver(v) {
  const m = /^v?(\d{1,9})\.(\d{1,9})\.(\d{1,9})(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v == null ? "" : v).trim());
  return m ? { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : null } : null;
}
// Numeric semver order — 1.9.0 < 1.13.0, never a string compare; a pre-release sorts before its release (numeric
// identifiers numerically, below alphanumeric ones). An unparseable version sorts below every real one. → -1 | 0 | 1
function compareSemver(a, b) {
  const x = parseSemver(a), y = parseSemver(b);
  if (!x || !y) return !x && !y ? 0 : !x ? -1 : 1;
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] < y.nums[i] ? -1 : 1;
  if (!x.pre || !y.pre) return !x.pre && !y.pre ? 0 : !x.pre ? 1 : -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return +p < +q ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}
// A meta.specVersion value → the version string, or null (absent, not a string, not x.y.z).
const stampOf = (meta) => (isObj(meta) && typeof meta.specVersion === "string" && parseSemver(meta.specVersion) ? meta.specVersion.trim() : null);
// The project's stamp against the engine → { from, to, behind (no stamp, or an older one), newer (stamped by a newer engine) }.
// Reads roadmap.json only (SessionStart runs it every session).
function specVersionStatus(projectDir) {
  const from = stampOf(readRoadmap(projectDir).meta);
  const to = engineVersion();
  const cmp = from && to ? compareSemver(from, to) : null;
  return { from, to, behind: !!to && (from == null || cmp < 0), newer: cmp != null && cmp > 0 };
}
// meta.specVersion := the engine's version, under the roadmap lock — never lowered (a newer stamp stays), never over a
// broken roadmap.json. → { stamped, from, to } | { stamped: false, error }. init / create of a brand-new project call it
// best-effort; spec_upgrade {apply} reports it.
function stampSpecVersion(projectDir) {
  const to = engineVersion();
  if (!to) return { stamped: false, from: null, to: null };
  return withRoadmapLock(projectDir, () => {
    const bad = roadmapError(projectDir);
    if (bad) return { stamped: false, error: bad };
    const rm = readRoadmap(projectDir);
    rm.meta = rm.meta || {};
    const from = stampOf(rm.meta);
    if (from && compareSemver(from, to) >= 0) return { stamped: false, from, to };
    rm.meta.specVersion = to;
    writeRoadmap(projectDir, rm);
    return { stamped: true, from, to };
  }, (b) => ({ stamped: false, ...roadmapBusyResult(projectDir, b) }));
}
// The maintained .specs/.gitignore lines that file lacks (read-only; ensureLockIgnore adds them). A folder or an unreadable
// file there is left alone, like ensureLockIgnore does.
function missingIgnoreLines(specsDir) {
  let cur;
  try { cur = fs.readFileSync(path.join(specsDir, ".gitignore"), "utf8"); } catch (e) { return e.code === "ENOENT" ? LOCK_IGNORE_LINES.slice() : []; }
  const have = new Set(cur.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()));
  return LOCK_IGNORE_LINES.filter((l) => !have.has(l));
}
// The last approvalHistory record of a phase (null when none).
function lastRecord(hist, phase) {
  let r = null;
  for (const h of hist) if (isApprovalRecord(h) && h.phase === phase) r = h; // a partial role sign-off (1.14) or a revocation (1.16) approved nothing
  return r;
}

// What `spec_upgrade {apply: true}` changes in ONE feature's .state.json — never an artifact, an approval or a tick:
//   tracks   the inferred track set, saved only when the state holds none (detectTracks then stops guessing from the files);
//   records  approvals not in approvalHistory yet (made before the history, or re-approved by an older engine after a 1.13
//            one) → `legacy` records (legacyRecord — approvePhase's seeding), in time order;
//   seed     an approval without a snapshot whose recorded fingerprint still matches its artifact — proof the file IS what
//            was approved — gets that artifact saved as its baseline (writeSnapshot: .history/<phase>@<n>.md, the next free
//            number, existing snapshots never renumbered; a bugfix's design approval also keeps design.md as approved);
//   skip     the ones that can't: no-fingerprint (a date-only approval, ≤1.10), changed (edited since), missing (the file is
//            gone), untracked (a 1.12 bugfix design approval — bug.md was never tracked), snapshot-missing — re-approve to
//            start the history.
// present: phases whose latest approval already has its snapshot. Inactive-track phases are left alone.
function upgradePlan(dir, st, tracks) {
  const kind = st.kind || "feature";
  const approvals = isObj(st.approvals) ? st.approvals : {};
  const hist = Array.isArray(st.approvalHistory) ? st.approvalHistory : [];
  const plan = { tracks: null, records: [], seed: [], skip: [], present: [] };
  if (st.tracks === undefined || (Array.isArray(st.tracks) && !st.tracks.length)) plan.tracks = tracks;
  for (const [ph, a] of Object.entries(approvals)) {
    if (!isRecord(a)) continue;
    const last = lastRecord(hist, ph);
    if (!last || (a.at && last.at !== a.at)) plan.records.push(legacyRecord(ph, a));
  }
  plan.records.sort((x, y) => (timeOf(x.at) || 0) - (timeOf(y.at) || 0));
  for (const ph of Object.keys(PHASE_FILE)) {
    const a = approvals[ph];
    if (!isRecord(a) || !phaseActive(ph, tracks)) continue;
    if (latestSnapshot(dir, st, ph)) { plan.present.push(ph); continue; }
    const skip = (reason) => plan.skip.push({ phase: ph, reason });
    const last = lastRecord(hist, ph);
    if (last && last.at === a.at && typeof last.snapshot === "string") { skip("snapshot-missing"); continue; }
    const file = phaseFile(ph, kind);
    // A 1.12 bugfix design approval signed off bug.md without recording anything about it (a fingerprint there is design.md's).
    if ((a.file || PHASE_FILE[ph]) !== file) { skip("untracked"); continue; }
    if (!a.fingerprint) { skip("no-fingerprint"); continue; }
    const raw = readIfExists(path.join(dir, file));
    if (raw == null) { skip("missing"); continue; }
    if (!fingerprintMatches(raw, ph, a.fingerprint)) { skip("changed"); continue; }
    let design = null;
    if (file !== PHASE_FILE[ph] && a.designFingerprint) { // the bugfix design approval signed off design.md as it was too
      design = readIfExists(path.join(dir, PHASE_FILE[ph]));
      if (design == null || !fingerprintMatches(design, ph, a.designFingerprint)) { skip("changed"); continue; }
    }
    plan.seed.push({ phase: ph, raw, design });
  }
  plan.changes = !!plan.tracks || plan.records.length > 0 || plan.seed.length > 0;
  return plan;
}
// Apply one feature's plan to its state (read under its lock) and write it once. → the snapshots saved [{phase, snapshot, designSnapshot?}]
function applyUpgradePlan(dir, st, plan) {
  const hist = (Array.isArray(st.approvalHistory) ? st.approvalHistory : []).concat(plan.records);
  const seeded = [];
  const at = new Date().toISOString();
  for (const s of plan.seed) {
    const a = st.approvals[s.phase];
    const rec = lastRecord(hist, s.phase); // the record of that very approval: a legacy one just added, or an existing one without snapshot
    if (!rec || rec.at !== a.at || typeof rec.snapshot === "string") continue;
    const snap = writeSnapshot(dir, s.phase, s.raw, hist, s.design);
    Object.assign(rec, snap, { seededAt: at }); // seededAt: the snapshot was taken by the upgrade (the content matched the approval's fingerprint)
    seeded.push({ phase: s.phase, ...snap });
  }
  if (plan.tracks) st.tracks = plan.tracks;
  if (plan.records.length || seeded.length) st.approvalHistory = hist;
  writeFileAtomic(statePath(dir), JSON.stringify(st, null, 2));
  return seeded;
}

// The phases a feature's status can be `not-started` in: nothing written beyond the classification.
const NOT_STARTED_PHASES = new Set(["empty", "classified", "requirements"]);
const shortDetail = (s) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > 110 ? t.slice(0, 109) + "…" : t; };
// One active feature, audited against the current rules — every verdict comes from the engine's own checks (doctor,
// next_action, verificationStatus, changedSinceApproval, the finish baseline), computed once (ctx.scan: one test-code walk
// shared by every feature, only when one needs it).
function upgradeFeature(projectDir, s, ctx) {
  const st = stateFromFile(projectDir, statePath(s.dir));
  if (st.invalid) return { name: s.slug, error: st.invalid, group: "blocked", attention: ["state"] };
  const doc = specDoctor(projectDir, s.slug, { scan: ctx.scan });
  if (!doc.ok) return { name: s.slug, error: doc.error, group: "blocked", attention: ["state"] };
  const na = nextAction(projectDir, s.slug, { doctor: doc });
  const tracks = detectTracks(s.dir);
  const kind = st.kind || "feature";
  const approvals = st.approvals;
  const phase = doc.phase;
  const tasks = parseTasks(activeTasks(readIfExists(path.join(s.dir, "tasks.md")), tracks));
  const done = tasks.filter((t) => t.done).length;
  const vs = verificationStatus(projectDir, s.slug, s.dir);
  const plan = upgradePlan(s.dir, st, tracks);
  const legacyApprovals = Object.keys(PHASE_FILE).filter((ph) => isRecord(approvals[ph]) && !approvals[ph].fingerprint && phaseActive(ph, tracks));
  const fin = isObj(st.finished) && isObj(st.finished.files) ? st.finished : null;
  const status = phase === "complete" ? (fin ? "finished" : "complete") : phase === "executing" ? "executing"
    : NOT_STARTED_PHASES.has(positionPhase(phase, flowOfState(st))) && !Object.keys(approvals).length ? "not-started" : "planning"; // C3: a design-first feature starts at its design
  // Complete / finished: nothing to review beyond the drift since the finish (next_action's hash when it computed one).
  let drift = null;
  if (fin && phase === "complete") {
    const root = path.resolve(projectDir);
    const d = na.drift || baselineDrift(root, realRootOf(root), fin);
    drift = { finishedAt: typeof fin.at === "string" ? fin.at : null, drifted: !!d.drifted, changed: d.changed, missing: d.missing, nowPresent: d.nowPresent,
      stale: !!(na.staleBaseline || staleFinish(projectDir, st, "", { newFiles: false })) };
  }
  // The review: critic before any task is ticked (the created-but-not-implemented specs), the converge pass mid-execution, none once complete.
  const review = done === 0 ? "critic" : done < tasks.length ? "converge" : "none";
  const chain = chainArtifacts(s.dir, tracks, kind).filter((a) => existsCached(path.join(s.dir, a.file)));
  const changed = na.changedSinceApproval || [];
  const reviewArtifacts = review === "critic" ? chain.map((a) => a.file)
    : review === "converge" ? chain.filter((a) => changed.includes(a.file) || !isRecord(approvals[a.phase])).map((a) => a.file) : [];
  const fails = doc.checks.filter((c) => c.status === "fail");
  const warns = doc.checks.filter((c) => c.status === "warn");
  const attention = [];
  if (doc.pendingGates.length) attention.push("pending-gates");
  if (changed.length) attention.push("changed-since-approval");
  if (plan.skip.length) attention.push("re-approve");
  if (vs.unverified.length) attention.push("unverified");
  if (drift && drift.drifted) attention.push("drift");
  if (drift && drift.stale) attention.push("stale-finish");
  // 1.17 D review: a track pack from before 1.17 whose name is reserved now ('dist', 'kafka', 'consistency'…) — named, with the way out
  const rawSt = readJson(statePath(s.dir)).data;
  const missingPacks = missingPackTracks(s.dir);
  const reservedPacks = missingPacks.filter((n) => legacyPackName(rawSt, n));
  // 1.19 T review: a pack whose MARKER is a built-in track's now ('webui' with [UI]) — { name, marker, track }
  const reservedMarkers = missingPacks.filter((n) => !legacyPackName(rawSt, n) && legacyPackMarkerTrack(rawSt, n))
    .map((n) => ({ name: n, marker: rawSt.packMarkers[n], track: legacyPackMarkerTrack(rawSt, n) }));
  if (reservedPacks.length || reservedMarkers.length) attention.push("track-pack-reserved");
  // 1.22 review 2: criteria numbered with bare AC-n IDs (approved before 1.22: doctor's ears / traceability fail on them now) —
  // renumber them US-<story>.AC-<n>, their references too, then re-approve. Never edited here: the audit names them.
  const bareAcIds = criteriaBareIds(criteriaText(s.dir) || "", s.dir);
  if (bareAcIds.length) attention.push("bare-ac-ids");
  // 1.17 A review 3: the design weigh warns (design-tradeoffs / design-risks) are listed, never an upgrade to-do on their own.
  if (warns.some((c) => !DESIGN_WEIGH_IDS.has(c.id))) attention.push("warnings");
  const res = {
    name: s.slug, kind, tracks: trackLabel(tracks), tracksSource: savedTracks(st) ? "state" : "inferred", tracksPending: !!plan.tracks,
    lang: normalizeLang(st.lang || projectLang(projectDir)), phase, status, tasks: { done, total: tasks.length },
    doctor: { verdict: doc.verdict, failing: fails.map((c) => ({ id: c.id, detail: shortDetail(c.detail) })), warnings: warns.map((c) => c.id) },
    pendingGates: doc.pendingGates, changedSinceApproval: changed, legacyApprovals,
    history: { present: plan.present, seed: plan.seed.map((x) => x.phase), skip: plan.skip },
    unverified: vs.unverifiedDetail.map((d) => Object.assign({ number: d.number, reason: d.reason }, d.specChanged ? { specChanged: true } : {}, d.unticked ? { unticked: true } : {})),
    next: { step: na.step, recommendation: na.recommendation },
    review, reviewArtifacts, drift, reservedPacks, reservedMarkers, bareAcIds, criteriaFile: isChangeDir(s.dir) ? CHANGE_FILE : "requirements.md",
    group: fails.length ? "blocked" : attention.length ? "attention" : "ok", attention,
  };
  if (na.impact) res.impact = na.impact.phases; // the spec_impact phases to diff before re-approving
  return res;
}

// spec_upgrade {apply?} / `dev-spec upgrade [--apply]`. The audit (default) is read-only; apply runs the safe migrations
// (upgradePlan per feature, under its lock; the maintained .specs/.gitignore; meta.specVersion under the roadmap lock —
// stamped only once every feature migrated), then audits the result and writes .specs/UPGRADE.md (AUTO-GENERATED, never
// over a hand-written file). Idempotent: a second apply changes nothing (not even UPGRADE.md) and says so.
function specUpgrade(projectDir, opts = {}) {
  const apply = opts.apply === true;
  const root = specsRoot(projectDir);
  if (!fs.existsSync(root)) return { ok: false, error: errs(projectDir).noSpecs(root) };
  const bad = roadmapError(projectDir); // never "repaired": the stamp would rewrite it
  if (bad) return { ok: false, error: bad };
  const lang = projectLang(projectDir);
  const ver = specVersionStatus(projectDir);
  const dirs = featureDirs(projectDir);
  const active = dirs.filter((s) => !s.archived);
  // The plan first (read-only): what apply changes — the preview in audit mode, the "before" in apply mode.
  const plan = { specVersion: { from: ver.from, to: ver.to, stamp: ver.behind }, tracks: [], history: { seed: [], skip: [], records: 0 },
    gitignore: missingIgnoreLines(root), errors: [] };
  for (const s of active) {
    const st = stateFromFile(projectDir, statePath(s.dir));
    if (st.invalid) { plan.errors.push({ feature: s.slug, error: st.invalid }); continue; }
    const p = upgradePlan(s.dir, st, detectTracks(s.dir));
    if (p.tracks) plan.tracks.push({ feature: s.slug, tracks: trackLabel(p.tracks) });
    plan.history.records += p.records.length;
    p.seed.forEach((x) => plan.history.seed.push({ feature: s.slug, phase: x.phase }));
    p.skip.forEach((x) => plan.history.skip.push({ feature: s.slug, ...x }));
  }
  plan.changes = plan.specVersion.stamp || plan.tracks.length > 0 || plan.history.records > 0 || plan.history.seed.length > 0 || plan.gitignore.length > 0;
  let migrations = null;
  if (apply) {
    migrations = { changed: false, specVersion: { from: ver.from, to: ver.to, stamped: false }, tracks: [], history: { seeded: [], skipped: [], records: 0 },
      gitignore: [], errors: [], report: null };
    for (const s of active) {
      const r = withFeatureLock(s.dir, () => {
        const st = stateFromFile(projectDir, statePath(s.dir)); // re-read under the lock
        if (st.invalid) return { error: st.invalid };
        const p = upgradePlan(s.dir, st, detectTracks(s.dir));
        return { tracks: p.tracks, records: p.records.length, skip: p.skip, seeded: p.changes ? applyUpgradePlan(s.dir, st, p) : [] };
      }, { onBusy: (b) => featureBusyResult(projectDir, s.slug, null, b) });
      if (r.error) { migrations.errors.push({ feature: s.slug, error: r.error }); continue; }
      if (r.tracks) migrations.tracks.push({ feature: s.slug, tracks: trackLabel(r.tracks) });
      migrations.history.records += r.records;
      r.seeded.forEach((x) => migrations.history.seeded.push({ feature: s.slug, ...x }));
      r.skip.forEach((x) => migrations.history.skipped.push({ feature: s.slug, ...x }));
    }
    ensureLockIgnore(root); // (every lock above ensured it too)
    const still = new Set(missingIgnoreLines(root));
    migrations.gitignore = plan.gitignore.filter((l) => !still.has(l));
    // The stamp last, and only once every feature migrated: a busy or broken one keeps the notice until the upgrade is re-run.
    if (!migrations.errors.length && ver.behind) {
      const sv = stampSpecVersion(projectDir);
      if (sv.error) migrations.errors.push({ feature: null, error: sv.error });
      else migrations.specVersion.stamped = sv.stamped;
    }
    migrations.changed = migrations.specVersion.stamped || migrations.tracks.length > 0 || migrations.history.records > 0 ||
      migrations.history.seeded.length > 0 || migrations.gitignore.length > 0;
    if (migrations.changed) maybeRefreshRoadmap(projectDir);
  }
  // The audit — after the migrations when applying (fresh reads: the locks dropped the read cache).
  let scanned;
  const ctx = { scan: () => scanned || (scanned = scanTestCode(projectDir)) };
  const features = active.map((s) => upgradeFeature(projectDir, s, ctx));
  const count = (g) => features.filter((f) => f.group === g).length;
  const res = { ok: true, lang, from: ver.from, to: ver.to, needsUpgrade: ver.behind || plan.changes, newer: ver.newer,
    features, summary: { ok: count("ok"), attention: count("attention"), blocked: count("blocked") }, archived: dirs.length - active.length, migrations };
  if (!apply) res.plan = plan;
  if (apply) {
    const file = path.join(root, "UPGRADE.md");
    if (!migrations.changed) migrations.report = { file, written: false };
    else if (!isGeneratedOrAbsent(file)) migrations.report = { file, written: false, error: i18n.msg(lang).err.notGenerated("UPGRADE.md") };
    else {
      writeFileAtomic(file, i18n.portableCli(renderUpgradeMd(res, lang, path.basename(path.resolve(projectDir))))); // committed (1.21 F3)
      migrations.report = { file, written: true };
    }
  }
  res.lines = upgradeLines(res, lang);
  return res;
}

// The localized to-do items of one audited feature — shared by the CLI / MCP `lines` and UPGRADE.md's checklist.
// → [{ check: true (an action) | false (information), text }]
function upgradeItems(f, lang) {
  const U = i18n.msg(lang).upgrade;
  const I = U.item;
  const out = [];
  const act = (text) => out.push({ check: true, text });
  if (f.error) { act(I.error(f.error)); return out; }
  if (f.next && f.next.recommendation) act(I.next(f.next.recommendation)); // next_action's one step first, then everything the rules flag
  if (f.doctor.failing.length) act(I.fix(f.doctor.failing.map((c) => c.id + (c.detail ? ` (${c.detail})` : "")).join("; ")));
  if (f.pendingGates.length) act(I.approve(f.pendingGates.join(", "), f.name));
  if (f.changedSinceApproval.length) act(I.reReview(f.changedSinceApproval.join(", "), (f.impact || []).map((p) => `${i18n.DEV_SPEC} impact ${f.name} --phase ${p}`).join(" · ")));
  if (f.history.skip.length) act(I.reapprove(f.history.skip.map((x) => `${x.phase} (${U.reason[x.reason] || x.reason})`).join(", ")));
  if (f.unverified.length) act(I.verify(unverifiedLabel({ unverifiedDetail: f.unverified }, lang), f.name));
  if (f.drift && f.drift.drifted) act(I.drift(f.drift.changed.length + f.drift.missing.length + f.drift.nowPresent.length, f.name));
  if (f.drift && f.drift.stale) act(I.stale(f.name));
  if (f.reservedPacks && f.reservedPacks.length) act(I.packReserved(f.reservedPacks.map((n) => "+" + n).join(", "), f.name, f.reservedPacks.map(packReservedSince).sort().pop())); // 1.17 D review
  if (f.reservedMarkers && f.reservedMarkers.length) { // 1.19 T review
    act(I.packMarkerReserved(f.reservedMarkers.map((x) => `+${x.name} ${x.marker}`).join(", "), f.name,
      f.reservedMarkers.map((x) => packReservedSince(x.track)).sort().pop(), [...new Set(f.reservedMarkers.map((x) => x.track))].join(" ")));
  }
  if (f.bareAcIds && f.bareAcIds.length) act(I.bareAcIds(shortIdList(f.bareAcIds), f.name, f.criteriaFile)); // 1.22 review 2
  if (f.review === "critic") act(I.critic(f.reviewArtifacts.join(", ")));
  else if (f.review === "converge") act(I.converge(f.reviewArtifacts.join(", ")));
  else out.push({ check: false, text: I.none });
  if (f.doctor.warnings.length) out.push({ check: false, text: I.warnings(f.doctor.warnings.join(", ")) });
  if (f.tracksPending) out.push({ check: false, text: U.tracksInferred }); // apply saves them (a malformed saved list is left alone)
  return out;
}
// "a [core +tdd], b [core]" / "a/requirements → .history/requirements@1.md" … — the migration lines (plan or applied).
function upgradeMigrationLines(r, lang) {
  const U = i18n.msg(lang).upgrade;
  const m = r.migrations;
  const p = r.plan;
  const out = [];
  const reason = (x) => `${x.feature}/${x.phase} (${U.reason[x.reason] || x.reason})`;
  if (m) {
    if (m.specVersion.stamped) out.push(U.migStamp(m.specVersion.from, m.specVersion.to));
    if (m.tracks.length) out.push(U.migTracks(m.tracks.map((t) => `${t.feature} [${t.tracks}]`).join(", ")));
    if (m.history.seeded.length) out.push(U.migSeeded(m.history.seeded.map((x) => `${x.feature}/${x.snapshot}`).join(", ")));
    if (m.history.records) out.push(U.migRecords(m.history.records));
    if (m.history.skipped.length) out.push(U.migSkipped(m.history.skipped.map(reason).join(", ")));
    if (m.gitignore.length) out.push(U.migGitignore(m.gitignore.length));
    if (m.errors.length) out.push(U.migErrors(m.errors.map((e) => (e.feature ? e.feature + ": " : "") + e.error).join(" | ")));
  } else if (p) {
    if (p.specVersion.stamp && p.specVersion.to) out.push(U.migStamp(p.specVersion.from, p.specVersion.to));
    if (p.tracks.length) out.push(U.migTracks(p.tracks.map((t) => `${t.feature} [${t.tracks}]`).join(", ")));
    if (p.history.seed.length) out.push(U.planSeed(p.history.seed.map((x) => `${x.feature}/${x.phase}`).join(", ")));
    if (p.history.records) out.push(U.migRecords(p.history.records));
    if (p.history.skip.length) out.push(U.migSkipped(p.history.skip.map(reason).join(", ")));
    if (p.gitignore.length) out.push(U.migGitignore(p.gitignore.length));
    if (p.errors.length) out.push(U.migErrors(p.errors.map((e) => e.feature + ": " + e.error).join(" | ")));
  }
  return out;
}
// The human report — `lines` of the result, printed by the CLI (project language; next_action's recommendations stay in
// each feature's own language, as everywhere).
function upgradeLines(r, lang) {
  const U = i18n.msg(lang).upgrade;
  const P = i18n.msg(lang).phaseNames || {};
  const mode = !r.to ? "unknown" : r.from == null || compareSemver(r.from, r.to) < 0 ? "behind" : r.needsUpgrade ? "pending" : "current";
  const out = [U.head(r.from, r.to, mode)];
  if (r.newer) out.push(U.newer(r.from, r.to));
  out.push(r.features.length ? U.summary(r.features.length, r.summary.blocked, r.summary.attention, r.summary.ok, r.archived) : U.noFeatures);
  for (const g of ["blocked", "attention", "ok"]) {
    const list = r.features.filter((f) => f.group === g);
    if (!list.length) continue;
    out.push("", U.group[g]);
    for (const f of list) {
      out.push("  ▸ " + (f.error ? f.name : U.feature(f.name, U.status[f.status] || f.status, f.tracks, P[f.phase] || f.phase, f.tasks.done, f.tasks.total, f.kind === "bugfix")));
      for (const it of upgradeItems(f, lang)) out.push((it.check ? "      - " : "      · ") + it.text);
    }
  }
  const mig = upgradeMigrationLines(r, lang);
  out.push("");
  if (r.migrations) {
    if (!r.migrations.changed && !r.migrations.errors.length) out.push(U.nothing);
    else {
      out.push(U.migHead);
      mig.forEach((l) => out.push("  · " + l));
    }
    const rep = r.migrations.report;
    if (rep && rep.written) out.push(U.reportAt(".specs/UPGRADE.md"));
    else if (rep && rep.error) out.push(U.reportKept(".specs/UPGRADE.md"));
  } else if (r.plan && (r.plan.changes || r.plan.errors.length)) {
    out.push(U.planHead);
    mig.forEach((l) => out.push("  · " + l));
    out.push(U.applyHint);
  } else out.push(U.upToDate);
  return out;
}
// .specs/UPGRADE.md — the checklist the user and Claude work through (/spec-upgrade), chrome in the project language.
function renderUpgradeMd(r, lang, proj) {
  const U = i18n.msg(lang).upgrade;
  const M = U.md;
  const P = i18n.msg(lang).phaseNames || {};
  let md = `# ${M.title(proj)}\n\n<!-- ${M.autogen} -->\n\n> ${M.intro(r.from, r.to)}\n\n`;
  md += `**${r.features.length ? U.summary(r.features.length, r.summary.blocked, r.summary.attention, r.summary.ok, r.archived) : U.noFeatures}**\n`;
  const mig = upgradeMigrationLines(r, lang);
  if (mig.length) md += `\n## ${M.migrations}\n\n` + mig.map((l) => `- ${l}`).join("\n") + "\n";
  for (const g of ["blocked", "attention", "ok"]) {
    const list = r.features.filter((f) => f.group === g);
    if (!list.length) continue;
    md += `\n## ${M.group[g]}\n`;
    for (const f of list) {
      md += `\n### ${f.error ? f.name : U.feature(f.name, U.status[f.status] || f.status, f.tracks, P[f.phase] || f.phase, f.tasks.done, f.tasks.total, f.kind === "bugfix")}\n\n`;
      md += upgradeItems(f, lang).map((it) => (it.check ? `- [ ] ${it.text}` : `- _${it.text}_`)).join("\n") + "\n";
    }
  }
  md += `\n---\n\n${M.footer}\n`;
  return md;
}

module.exports = { engineVersion, parseSemver, compareSemver, stampOf, specVersionStatus, stampSpecVersion,
  missingIgnoreLines, lastRecord, upgradePlan, applyUpgradePlan, NOT_STARTED_PHASES, shortDetail, upgradeFeature,
  specUpgrade, upgradeItems, upgradeMigrationLines, upgradeLines, renderUpgradeMd, __link };

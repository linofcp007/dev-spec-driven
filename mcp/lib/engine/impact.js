"use strict";

/**
 * dev-spec-driven engine — change requests: approval snapshots and spec_impact.
 * The .history/ snapshots every approval saves, the diff of an artifact against its approved snapshot, and reopen.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, activeDesign, approvalRolesOf, changedSinceApproval, criterionBlocks, designSections, detectTracks,
  duplicateTaskNumbers, evidenceRule, existingFeature, featureLang, fingerprintMatches, inactiveTaskLines, isInsideDir,
  isRecord, maybeRefreshRoadmap, ownRecord, PHASE_FILE, phaseContent, phaseFile, projectLang, RE_LIST_ITEM,
  readIfExists, readState, roleSignOffs, specChangedSince, statePath, steeringImpact, steeringImpactLines,
  stripFencedCode, stripHtmlComments, taskBlocks, taskMarkers, taskVerification, testIndex, textFingerprint,
  uncheckTasks, untickedSince, writeFileAtomic;
function __link(E) { ({ acIndex, activeDesign, approvalRolesOf, changedSinceApproval, criterionBlocks, designSections,
  detectTracks, duplicateTaskNumbers, evidenceRule, existingFeature, featureLang, fingerprintMatches, inactiveTaskLines,
  isInsideDir, isRecord, maybeRefreshRoadmap, ownRecord, PHASE_FILE, phaseContent, phaseFile, projectLang, RE_LIST_ITEM,
  readIfExists, readState, roleSignOffs, specChangedSince, statePath, steeringImpact, steeringImpactLines,
  stripFencedCode, stripHtmlComments, taskBlocks, taskMarkers, taskVerification, testIndex, textFingerprint,
  uncheckTasks, untickedSince, writeFileAtomic } = E); }

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
    return phaseFile(p, kind) !== PHASE_FILE[p] && changedFiles.includes(PHASE_FILE[p]) && !!designBaseline(dir, snap, state.approvals[p]);
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
  const phase = opts.phase == null || String(opts.phase).trim() === "" ? "requirements" : String(opts.phase).toLowerCase().trim();
  if (!IMPACT_PHASES.includes(phase)) return { ok: false, error: I.badPhase(String(opts.phase), [...IMPACT_PHASES, "steering"].join(", ")) };
  const reopen = opts.reopen === true;
  if (reopen && phase === "tasks") return { ok: false, error: I.reopenTasks };
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
  if (phase !== "tasks") {
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
  const byId = phase === "requirements" || phase === "test-plan"; // ID-keyed diffs (sections for design / eval-plan)
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
  for (const [sign, list] of [["+", r.added], ["~", r.modified], ["-", r.removed]]) {
    for (const x of list || []) out.push(`  ${sign} ${label(x)}${body(x) && r.phase !== "design" ? "  " + cut(body(x)) : ""}`);
  }
  // design.md changed but can't be diffed (no snapshot of it): say that, never "no changes since the approval".
  if (r.designHint) out.push("  " + r.designHint);
  else if (!(r.added || []).length && !(r.modified || []).length && !(r.removed || []).length) out.push("  " + (r.changed ? I.noStructural : I.noChanges));
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

module.exports = { HISTORY_DIR, IMPACT_PHASES, RE_REQ_REF, RE_OTHER_REQ_REF, RE_TEST_REF, RE_DEFINES_REQ_ID, normWs,
  refsIn, shortDigest, isApprovalRecord, legacyRecord, writeSnapshot, historyText, latestSnapshot, designBaseline,
  snapshotPhases, requirementIndex, diffEntries, sectionEntries, taskEntries, plannedTestEntries, activeTaskBlocks,
  impactReport, impactLines, __link };

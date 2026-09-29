"use strict";

/**
 * dev-spec-driven engine — feature lifecycle: remove, rename, archive, restore.
 * Folder moves under the feature lock that keep roadmap.json dependencies, _Supersedes:_ references and archive
 * records consistent.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, activeTasks, criterionBlocks, detectPhase, detectTracks, dirKey, ensureDir, errs, existingFeature,
  featureDirs, featureFlow, featureLang, featurePercent, findCycle, invalidateReadCache, isDirSafe, isFeatureFolder,
  isObj, legacySlugify, locateFeatures, LOCK_FILE, maybeRefreshRoadmap, milestonesFollow, moveDirOrBusy, normalizeLang,
  parseTasks, projectLang, pruneBacklog, RE_SUPERSEDES_SRC, readIfExists, readRoadmap, readState, resolveFeature,
  roadmapBusyResult, roadmapError, safeReaddir, setFeatureFlowLocked, slugify, stateFromFile, statePath, withMoveLock,
  withRoadmapLock, writeFileAtomic, writeRoadmap;
function __link(E) { ({ acIndex, activeTasks, criterionBlocks, detectPhase, detectTracks, dirKey, ensureDir, errs,
  existingFeature, featureDirs, featureFlow, featureLang, featurePercent, findCycle, invalidateReadCache, isDirSafe,
  isFeatureFolder, isObj, legacySlugify, locateFeatures, LOCK_FILE, maybeRefreshRoadmap, milestonesFollow,
  moveDirOrBusy, normalizeLang, parseTasks, projectLang, pruneBacklog, RE_SUPERSEDES_SRC, readIfExists, readRoadmap,
  readState, resolveFeature, roadmapBusyResult, roadmapError, safeReaddir, setFeatureFlowLocked, slugify, stateFromFile,
  statePath, withMoveLock, withRoadmapLock, writeFileAtomic, writeRoadmap } = E); }

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

module.exports = { pruneRoadmapRefs, milestoneResult, pruneRoadmapRefsLocked, removeFeature, TOMBSTONE_PREFIX,
  TOMBSTONE_SWEEP_AGE_MS, sweepTombstones, removeFeatureLocked, archiveFeature, archiveFeatureLocked, renameFeature,
  renameFeatureLocked, renamePlan, renameSupersedesRefs, removePreview, manageFeature, archiveRecord, reinsertDep,
  archivedFeature, restoreFeature, restoreFeatureLocked, __link };

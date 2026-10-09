"use strict";

/**
 * dev-spec-driven engine — feature resolution, .state.json, fingerprints and roadmap.json.
 * Language resolution (project / feature), the feature resolver every name-taking operation goes through
 * (resolveFeature / existingFeature), .state.json reads, the phases and their artifacts, content fingerprints; the
 * roadmap store (read / validate / write under the roadmap lock), feature dependencies, the backlog, the roadmap
 * language, the generated-file guard (RE_AUTOGEN) and the roadmap writers; the semantic 3-way merge of .state.json /
 * roadmap.json behind git's merge driver (1.21 F1a — mergeStateJson, pure).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let catalogData, compareSemver, EVIDENCE_HISTORY, EVIDENCE_OTHERS, existsCached, isDirSafe, isObj, jsonRel, listFeatures, maybeRefreshCatalog, own,
  positionPhase, readIfExists, readJson, removeSpecFile, renderRoadmapHtml, renderRoadmapMd, roadmapData, roadmapExtras, safeReaddir,
  shapeError, specsRoot, withRoadmapLock, writeFileAtomic, writeIfAbsent;
function __link(E) { ({ catalogData, compareSemver, EVIDENCE_HISTORY, EVIDENCE_OTHERS, existsCached, isDirSafe, isObj, jsonRel, listFeatures,
  maybeRefreshCatalog, own, positionPhase, readIfExists, readJson, removeSpecFile, renderRoadmapHtml, renderRoadmapMd, roadmapData,
  roadmapExtras, safeReaddir, shapeError, specsRoot, withRoadmapLock, writeFileAtomic, writeIfAbsent } = E); }

// Language resolution. The project's language is the single source of truth, persisted in
// .specs/roadmap.json meta.lang (seeded by spec_init); each feature may override it via
// .specs/<feature>/.state.json lang. spec.js resolves the lang and hands it to i18n builders.
const normalizeLang = i18n.normalizeLang;
function projectLang(projectDir) {
  return normalizeLang(roadmapLang(projectDir)); // roadmapLang reads meta.lang (hoisted below)
}
function featureLang(projectDir, name) {
  const st = readState(projectDir, name); // readState is hoisted below
  return normalizeLang(st.lang || projectLang(projectDir));
}
// Localized engine errors: the feature's language when there is one, else the project's.
function errs(projectDir, slug) {
  return i18n.msg(slug ? featureLang(projectDir, slug) : projectLang(projectDir)).err;
}

function slugify(name) {
  return slugifyFull(name).slice(0, 64).replace(/-+$/, "");
}
// The slug before slugify's 64-character cut — the same text when the name fits (1.23 review 5: two names that differ only
// past the cut reach one folder; spec_create tells them apart with it).
function slugifyFull(name) {
  if (name == null) return ""; // never "undefined" — a missing name must not become a folder
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // transliterate: "Autenticação" → "autenticacao" (not "autentica-o")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Pre-1.11 slug (accents dropped as separators). Only used to keep finding folders created back then.
function legacySlugify(name) {
  if (name == null) return "";
  return String(name).trim().toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 64).replace(/-+$/, "");
}

// Windows reserves these device names in every directory (`.specs\nul\` is unusable from most tools).
const RE_WIN_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;
const RESERVED_SLUGS = new Set(["steering", "exports", "templates", "tracks"]); // folders under .specs/ that are not features (1.14: exports/ holds spec_export's documents, templates/ the project's templates; 1.15: tracks/ the project's track packs)
// Is this folder name under `root` (.specs/ or .specs/_archive/) reserved? "steering" always; "templates" / "exports" (1.14) and
// "tracks" (1.15 — the track packs) unless that folder is a FEATURE created before them — it holds a .state.json: it stays a feature (listed,
// reachable, renameable) and is never read as templates (templateFileList), so an upgrade never turns a filled spec into
// every new feature's scaffold.
function reservedSlug(name, root) {
  const s = String(name).toLowerCase();
  if (!RESERVED_SLUGS.has(s)) return false;
  return !((s === "templates" || s === "exports" || s === "tracks") && root && existsCached(statePath(path.join(root, s))));
}

// Every name-taking operation resolves its folder HERE. An empty slug ("日本語", "...", undefined) used to
// make path.join(root, "") === .specs itself, so `spec_feature remove` wiped every spec.
function resolveFeature(projectDir, name) {
  const root = specsRoot(projectDir);
  const slug = slugify(name);
  const E = () => errs(projectDir); // only on a refusal: the project language costs a roadmap.json read
  if (!slug) return { ok: false, slug, root, code: "feature-name-invalid", error: E().noUsableName(name == null ? "" : name) };
  if (reservedSlug(slug, root)) return { ok: false, slug, root, code: "feature-name-reserved", error: E().reserved(slug) };
  // Windows device names: refuse new ones, but an existing folder of that name (created on another OS)
  // must stay reachable so it can be renamed away. Check the real listing — on Windows existsSync("con")
  // can report the device.
  if (RE_WIN_RESERVED.test(slug) && !safeReaddir(root).includes(slug)) return { ok: false, slug, root, code: "feature-name-reserved", error: E().reservedWin(slug) };
  const dir = path.join(root, slug);
  if (!existsCached(dir)) {
    const legacy = legacySlugify(name);
    if (legacy && legacy !== slug && !reservedSlug(legacy, root) && existsCached(path.join(root, legacy))) {
      return { ok: true, slug: legacy, dir: path.join(root, legacy), root };
    }
  }
  return { ok: true, slug, dir, root };
}
// resolveFeature + "must exist".
function existingFeature(projectDir, name) {
  const f = resolveFeature(projectDir, name);
  if (f.ok && !existsCached(f.dir)) {
    // An archived feature is not an active one — but "not found" alone sent the user nowhere (drift's finish-it-again line
    // for an archived feature used to end right here): name the archive and the restore.
    const E = errs(projectDir);
    const arch = locateFeatures(projectDir, name).find((x) => x.archived);
    return { ...f, ok: false, code: "feature-not-found", error: E.notFound(f.slug, f.root) + (arch ? " " + E.archivedHint(arch.slug) : "") };
  }
  return f;
}

// A folder name a feature command can address (current or pre-1.11 slug). `.obsidian`, `My Notes/` are not
// features: they used to list as 0% features that no command could reach or remove. A case-only difference
// ("Billing/") is addressable on a case-insensitive filesystem (Windows, macOS): 'billing' resolves to it, so
// it stays listed — but only when it IS the folder that slug reaches (never beside a real "billing/").
function isFeatureFolder(name, root) {
  if (name.startsWith(".") || name.startsWith("_") || reservedSlug(name, root)) return false;
  if (slugify(name) === name) return true;
  if (!root || slugify(name) !== name.toLowerCase()) return false;
  try {
    return fs.realpathSync.native(path.join(root, name.toLowerCase())) === fs.realpathSync.native(path.join(root, name));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// State (.state.json) — the approval gates themselves are in gates.js
// ---------------------------------------------------------------------------

const PHASES = ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"];

function statePath(dir) {
  return path.join(dir, ".state.json");
}

function readState(projectDir, name) {
  const f = resolveFeature(projectDir, name);
  if (!f.ok) return { approvals: {} };
  return stateFromFile(projectDir, statePath(f.dir));
}
// The same read + shape check for a state file at a known path (an archived feature's .state.json too).
function stateFromFile(projectDir, file) {
  const j = readJson(file);
  if (j.error) return { approvals: {}, invalid: i18n.msg(projectLang(projectDir)).err.invalidJson(j.errorRel, j.errorDetail) };
  // Valid JSON of the wrong shape is refused like unparseable JSON — an `approvals` ARRAY silently dropped
  // every approval on the next write. Readers get the valid parts (lang kept); mutators check `invalid`.
  const problems = [];
  if (j.exists && !isObj(j.data)) problems.push(["topLevel"]);
  const s = isObj(j.data) ? j.data : {};
  for (const [key, ok] of [["approvals", isObj], ["evidence", isObj], ["tracks", Array.isArray], ["finishChecks", isObj], ["signoffs", isObj]]) { // finishChecks: project check runs; signoffs: role sign-offs
    if (s[key] !== undefined && !ok(s[key])) { problems.push([key]); delete s[key]; }
  }
  // The change history (approvePhase / spec_impact append to these lists): a non-list would be replaced by the next append.
  for (const key of ["approvalHistory", "changes", "unticks"]) if (s[key] !== undefined && !Array.isArray(s[key])) { problems.push([key]); delete s[key]; } // unticks: 1.16 U1 (undone ticks)
  s.approvals = s.approvals || {};
  if (problems.length) s.invalid = shapeError(typeof s.lang === "string" ? s.lang : projectLang(projectDir), jsonRel(file), problems);
  return s;
}

// The artifact each approvable phase signs off, and a content fingerprint recorded at approval so a
// later edit is detected by CONTENT, not mtime (ticking a task checkbox is progress, not a spec edit).
const PHASE_FILE = { classification: "classification.md", requirements: "requirements.md", design: "design.md", "test-plan": "test-plan.md", "eval-plan": "eval-plan.md", tasks: "tasks.md" };
// That fingerprint, of the artifact's text (an approval snapshot is compared by it too).
// A leading BOM is encoding, not content (like CRLF): an editor or Windows PowerShell 5.1 re-saving an approved
// artifact as "UTF-8 with BOM" must not read as changed-since-approval (it blocked spec_finish while spec_impact
// showed nothing changed).
function textFingerprint(raw, phase) {
  return sha1Hex(fingerprintText(raw, phase));
}
function fingerprintText(raw, phase) {
  const text = String(raw).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return phase === "tasks" ? uncheckTasks(text) : text;
}
const sha1Hex = (text) => require("crypto").createHash("sha1").update(text).digest("hex");
// r5 review — the text a WHITESPACE-ONLY edit leaves unchanged: fingerprintText with each line's trailing whitespace and the blank lines
// at the end dropped (an editor's "trim trailing whitespace" / "insert final newline", a formatter). The recorded fingerprint keeps
// its rule (every approval recorded so far stays valid, and two records of the same content still compare equal); this text is
// compared with the approval's own .history snapshot when the fingerprint no longer matches (gates.js wsOnlyEdit) — linear: no
// regex over a run of spaces.
function wsText(raw, phase) {
  const lines = fingerprintText(raw, phase).split("\n").map((l) => l.trimEnd());
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") end--;
  return lines.slice(0, end).join("\n");
}
// 1.24 review 6 (E-I5) — the fingerprint of wsText: recorded as `wsFingerprint` (`designWsFingerprint`) on every NEW approval, its
// history record and each role sign-off, next to `fingerprint` (which keeps its rule). Two versions that differ only in trailing
// whitespace / final blank lines share it — a waiting role sign-off (no snapshot of its own) of such a version still counts, and
// changedSinceApproval needs no .history snapshot to tell a whitespace-only edit. Older records have none: the snapshot fallback.
function wsFingerprint(raw, phase) {
  return raw == null ? null : sha1Hex(wsText(raw, phase));
}
// Does this text still match a fingerprint an approval recorded? An approval recorded before the BOM was ignored
// hashed the file with its BOM: that fingerprint still matches the same content (with or without the BOM now).
function fingerprintMatches(raw, phase, stored) {
  if (raw == null || typeof stored !== "string" || !stored) return false;
  const text = fingerprintText(raw, phase);
  if (sha1Hex(text) === stored || sha1Hex(BOM_CHAR + text) === stored) return true;
  if (phase !== "tasks") return false;
  // An approval recorded before 1.22 normalized only `- [x]` ticks: the same content still matches it (a `* [x]` / `+ [x]` line
  // kept its tick in that fingerprint).
  const legacy = uncheckDashTasks(String(raw).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"));
  return legacy !== text && (sha1Hex(legacy) === stored || sha1Hex(BOM_CHAR + legacy) === stored);
}
const BOM_CHAR = String.fromCharCode(0xfeff);
// Checkbox state is not content. The indent is read within its line ([^\S\n\r\u2028\u2029], not \s): from each line start of a
// long blank run \s* rescanned the whole run (1.17 H) — the lines above keep their text either way ($1 puts it back). Any GFM
// bullet (1.22 review: `* [ ] 1.` / `+ [ ] 1.` are task lines too — the scanner reads them).
const uncheckTasks = (text) => text.replace(/^([^\S\n\r\u2028\u2029]*[-*+]\s*\[)[xX](\])/gm, "$1 $2");
const uncheckDashTasks = (text) => text.replace(/^([^\S\n\r\u2028\u2029]*-\s*\[)[xX](\])/gm, "$1 $2"); // the pre-1.22 rule (legacy fingerprints)
// The artifact a phase's approval signs off: a bugfix has no design of its own — its design approval signs off bug.md
// (the Root Cause the gate checks). approvePhase records it as `file` on the approval, so changedSinceApproval
// compares the right file (an approval without `file` signed off PHASE_FILE's, as before).
// 1.21 F5: a change's plan approval (its `tasks` phase) signs off change.md — the one file of a change.
const phaseFile = (phase, kind) => (phase === "design" && kind === "bugfix" ? "bug.md" : phase === "tasks" && kind === "change" ? "change.md" : PHASE_FILE[phase]);

// 1.21 F5 — feature sizes: spec_create {size: xs | s | m | l} stored in .state.json `size` (a plain value — git's merge driver
// needs no rule). xs = a change (one change.md) or an XS bugfix (its plan approved in one call — every bugfix's tasks.md is the
// two-task form); s = one story, the track sections of the "core" tier (TRACK_SECTIONS tier "extended" optional), the three weigh
// sections merged; m / l = the full chain with the duplicate sections merged (TRACK_OVERLAPS, CORE_SUPERSEDED_BY). No size
// (every feature created before 1.21, and any created without one) = the 1.20 rules and scaffolds exactly — but a bugfix's
// tasks.md (the short form at every size); spec_upgrade never assigns one.
const FEATURE_SIZES = ["xs", "s", "m", "l"];
// A size as given (MCP / CLI; case-folded) → { size } | { size: null } (not given) | { error }.
function sizeInput(v, lng) {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return { size: null };
  const s = typeof v === "string" ? v.trim().toLowerCase() : null;
  if (s && FEATURE_SIZES.includes(s)) return { size: s };
  const A = i18n.msg(lng).args;
  return { error: A.invalid(A.item("size", A.oneOf(FEATURE_SIZES.join(", ")), JSON.stringify(typeof v === "string" ? v : String(v)))) };
}
// A feature folder's size (its .state.json `size`, read-cached) → "xs" | "s" | "m" | "l" | null.
function featureSize(dir) {
  const st = readJson(statePath(dir)).data;
  return isObj(st) && typeof st.size === "string" && FEATURE_SIZES.includes(st.size) ? st.size : null;
}
const isChangeDir = (dir) => { const st = readJson(statePath(dir)).data; return isObj(st) && st.kind === "change"; };

// ---------------------------------------------------------------------------
// Roadmap & feature dependencies (.specs/roadmap.json)
// ---------------------------------------------------------------------------

// Progress model. Planning (classify → design → tasks-ready) is the run-up; the
// bulk of the work is *implementing* the tasks. So all planning phases together
// top out at PLANNING_CEILING, and the implementation span (executing → complete)
// is driven by the real fraction of tasks done — not a flat per-phase number.
// This stops a fully-planned-but-unimplemented feature (phase "tasks-ready", zero
// tasks done) from reading as ~70% complete when no code has been written yet.
const PLANNING_CEILING = 30;
const PHASE_PERCENT = {
  empty: 0,
  classified: 4,
  requirements: 8,
  design: 16,
  "test-plan": 20,
  "eval-plan": 20,
  tests: 25,
  "tasks-ready": PLANNING_CEILING,
  executing: PLANNING_CEILING, // real value comes from featurePercent (task-driven)
  complete: 100,
};

function phasePercent(phase, flow) {
  phase = positionPhase(phase, flow); // C3: design-first walks design (8%) before requirements (16%) — the same run-up, in its own order
  return PHASE_PERCENT[phase] != null ? PHASE_PERCENT[phase] : 0;
}

// Task-aware completion percentage. Once tasks exist, implementation spans
// PLANNING_CEILING → 100 in proportion to the tasks actually completed.
// "complete" is the only phase that reaches 100; an in-flight "executing"
// feature is capped at 99 so it can never masquerade as done.
function featurePercent(phase, tasksDone, tasksTotal, flow) { // flow (C3): the feature's — design-first swaps the design / requirements steps
  if (phase === "complete") return 100;
  if (phase === "tasks-ready" || phase === "executing") {
    const total = Number(tasksTotal) || 0;
    if (total <= 0) return PLANNING_CEILING;
    const done = Math.max(0, Math.min(total, Number(tasksDone) || 0));
    const impl = Math.round((done / total) * (100 - PLANNING_CEILING));
    return Math.min(99, PLANNING_CEILING + impl);
  }
  return phasePercent(phase, flow);
}

function roadmapPath(projectDir) {
  return path.join(specsRoot(projectDir), "roadmap.json");
}

// roadmap.json = parse + SHAPE. Valid JSON of the wrong shape ({"features":{"b":null}}) reached a mutator and
// crashed it AFTER its destructive step (remove deleted the folder, then pruneRoadmapRefs threw). Readers get
// a sanitized copy (bad parts dropped, unknown keys and meta kept, so messages stay in the project language);
// roadmapError() reports every problem so each mutator refuses before touching anything.
function loadRoadmap(projectDir) {
  const file = roadmapPath(projectDir);
  const j = readJson(file);
  const problems = [];
  const parsed = j.exists && !j.error;
  if (parsed && !isObj(j.data)) problems.push(["topLevel"]);
  const rm = parsed && isObj(j.data) ? { ...j.data } : {};
  // Null prototype: a feature slugged "constructor" is a plain key, never Object.prototype.constructor.
  const features = Object.create(null);
  if (rm.features !== undefined && !isObj(rm.features)) problems.push(["features"]);
  else {
    for (const [k, v] of Object.entries(rm.features || {})) {
      if (!isObj(v)) { problems.push(["featureEntry", k]); continue; }
      features[k] = v;
      if (v.dependsOn !== undefined && !(Array.isArray(v.dependsOn) && v.dependsOn.every((d) => typeof d === "string"))) {
        problems.push(["dependsOn", k]);
        features[k] = { ...v };
        delete features[k].dependsOn;
      }
    }
  }
  rm.features = features;
  if (rm.meta !== undefined && !isObj(rm.meta)) { problems.push(["meta"]); delete rm.meta; }
  if (rm.backlog !== undefined) {
    const okEntry = (b) => isObj(b) && typeof b.name === "string";
    if (!Array.isArray(rm.backlog)) { problems.push(["backlog"]); delete rm.backlog; }
    else if (!rm.backlog.every(okEntry)) { problems.push(["backlogEntry"]); rm.backlog = rm.backlog.filter(okEntry); }
  }
  return { rm, parseError: j.error ? j : null, problems, rel: jsonRel(file) };
}

function readRoadmap(projectDir) {
  return loadRoadmap(projectDir).rm;
}

// Non-null when roadmap.json exists but is unreadable OR has the wrong shape — every mutator checks this
// BEFORE changing anything, so a typo in the file is reported instead of being "repaired" into data loss.
function roadmapError(projectDir) {
  const l = loadRoadmap(projectDir);
  if (!l.parseError && !l.problems.length) return null;
  const lang = projectLang(projectDir); // meta survives sanitizing, so this is still the project language
  return l.parseError ? i18n.msg(lang).err.invalidJson(l.parseError.errorRel, l.parseError.errorDetail) : shapeError(lang, l.rel, l.problems);
}

function writeRoadmap(projectDir, rm) {
  const bad = roadmapError(projectDir);
  if (bad) throw new Error(bad); // last line of defence; mutators return this as { ok:false } first
  writeFileAtomic(roadmapPath(projectDir), JSON.stringify(rm, null, 2));
}

function findCycle(depsMap) {
  // Own-key lookups and a null-prototype colour map: a dependency named "constructor" used to resolve to
  // Object.prototype.constructor, and iterating that threw.
  const color = Object.create(null); // undefined=white, 1=gray, 2=black
  const depsOf = (n) => (Object.prototype.hasOwnProperty.call(depsMap, n) && Array.isArray(depsMap[n]) ? depsMap[n] : []);
  const stack = [];
  let cycle = null;
  function dfs(n) {
    color[n] = 1;
    stack.push(n);
    for (const d of depsOf(n)) {
      if (color[d] === 1) {
        cycle = stack.slice(stack.indexOf(d)).concat(d);
        return true;
      }
      if (color[d] !== 2 && dfs(d)) return true;
    }
    color[n] = 2;
    stack.pop();
    return false;
  }
  for (const n of Object.keys(depsMap)) {
    if (color[n] === undefined && dfs(n)) break;
  }
  return cycle;
}
// 1.24 r6 (G6) — EVERY dependency cycle (findCycle stops at the first: `a → a` hid `b ↔ c`): the strongly connected components
// with more than one feature, or one naming itself (Tarjan's, iterative — no recursion depth). → [{ members, path }] in the order
// their first feature appears in the map; `path` a cycle through the component's first feature (`a → b → c → a`, the shortest one
// its own edges give, closed on its start — as findCycle reports one), `members` every feature of it (a component can hold more
// than one cycle: each member is in one).
function findCycles(depsMap) {
  const depsOf = (n) => (Object.prototype.hasOwnProperty.call(depsMap, n) && Array.isArray(depsMap[n]) ? depsMap[n].filter((d) => typeof d === "string") : []);
  const keys = Object.keys(depsMap);
  const pos = new Map(keys.map((k, i) => [k, i]));
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], comps = [];
  let next = 0;
  const visit = (v) => { index.set(v, next); low.set(v, next); next++; stack.push(v); onStack.add(v); };
  for (const root of keys) {
    if (index.has(root)) continue;
    visit(root);
    const work = [[root, 0]];
    while (work.length) {
      const top = work[work.length - 1];
      const v = top[0];
      const ds = depsOf(v);
      if (top[1] < ds.length) {
        const w = ds[top[1]++];
        if (!index.has(w)) { visit(w); work.push([w, 0]); }
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
        continue;
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
      if (low.get(v) !== index.get(v)) continue;
      const comp = [];
      for (let w = null; w !== v;) { w = stack.pop(); onStack.delete(w); comp.push(w); }
      if (comp.length > 1 || depsOf(v).includes(v)) comps.push(comp);
    }
  }
  const at = (n) => (pos.has(n) ? pos.get(n) : Infinity);
  return comps.map((comp) => {
    const members = comp.slice().sort((a, b) => at(a) - at(b) || (a < b ? -1 : a > b ? 1 : 0));
    const start = members[0];
    const inComp = new Set(comp);
    // the shortest way back to `start` inside the component (breadth first)
    const parent = new Map([[start, null]]);
    const queue = [start];
    let last = null;
    for (let q = 0; q < queue.length && last === null; q++) {
      for (const w of depsOf(queue[q])) {
        if (!inComp.has(w)) continue;
        if (w === start) { last = queue[q]; break; }
        if (!parent.has(w)) { parent.set(w, queue[q]); queue.push(w); }
      }
    }
    const back = [];
    for (let n = last; n !== null; n = parent.get(n)) back.push(n);
    return { members, path: back.reverse().concat(start) };
  }).sort((a, b) => at(a.members[0]) - at(b.members[0]));
}

// dependsOn REPLACES the list ([] clears it); edits.add / edits.remove change it incrementally (applied in
// that order, after a replacement); order sets the position. Nothing requested = a read: the current deps
// come back and roadmap.json is not touched (the CLI's bare `depend <f>` used to clear them).
function setDependency(projectDir, name, dependsOn, order, edits) {
  const e = edits || {};
  const asked = (v) => v != null && !(Array.isArray(v) && !v.length) && String(v).trim() !== "";
  // A change is one read-modify-write of roadmap.json under the roadmap lock; a bare read takes no lock.
  if (dependsOn == null && order == null && !asked(e.add) && !asked(e.remove)) return dependencyUnlocked(projectDir, name, dependsOn, order, e);
  const r = withRoadmapLock(projectDir, () => dependencyUnlocked(projectDir, name, dependsOn, order, e));
  if (r.ok && r.changed) maybeRefreshRoadmap(projectDir); // outside the lock: the lock covers roadmap.json only
  if (r.ok) delete r.changed;
  return r;
}
// A roadmap order as a caller gave it (a number over MCP, the raw word on the CLI) → the safe integer, or null.
function orderInput(v) {
  if (typeof v === "number") return Number.isSafeInteger(v) ? v : null;
  const s = String(v).trim();
  return /^-?\d+$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : null;
}
function dependencyUnlocked(projectDir, name, dependsOn, order, edits) {
  edits = edits || {};
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error, code: f.code };
  const slug = f.slug;
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  const D = i18n.msg(projectLang(projectDir)).depend;
  const names = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(/[\s,]+/)).map((d) => String(d).trim()).filter(Boolean);
  // Every dependency named here must be an existing feature (reserved names like `steering` included): an
  // unknown name used to be stored and then read as a dependency that could never be met.
  const unknownNames = [];
  const resolveDeps = (list) => {
    const out = [];
    for (const d of names(list)) {
      const r = existingFeature(projectDir, d);
      if (!r.ok) unknownNames.push(d);
      else if (!out.includes(r.slug)) out.push(r.slug);
    }
    return out;
  };
  const replaced = dependsOn === undefined || dependsOn === null ? null : resolveDeps(dependsOn);
  const added = resolveDeps(edits.add);
  if (unknownNames.length) return { ok: false, error: D.unknown(unknownNames.join(", ")) };
  // order: a SAFE integer, as spec_roadmap_edit {kind: "depend"}'s schema ({type: "integer"} — no bound) — the CLI passes the raw word, and
  // `--order 99999999999999999999` matched the digits and was stored as 1e20 (1.22 review). Refused with the MCP
  // validator's own message (args), so both surfaces refuse the same values alike.
  const orderNum = order == null ? null : orderInput(order);
  if (order != null && orderNum === null) {
    const A = i18n.msg(projectLang(projectDir)).args;
    return { ok: false, error: A.invalid(A.item("order", A.type.integer, JSON.stringify(typeof order === "number" ? order : String(order)))) };
  }
  // Removals match the slug as typed, transliterated or legacy — a stale dep on a deleted feature can go too.
  const drop = new Set(names(edits.remove).flatMap((d) => [d, slugify(d), resolveFeature(projectDir, d).slug]).filter(Boolean));

  const rm = readRoadmap(projectDir);
  const current = (rm.features[slug] && rm.features[slug].dependsOn) || [];
  const deps = (replaced || current).slice();
  added.forEach((d) => { if (!deps.includes(d)) deps.push(d); });
  const finalDeps = deps.filter((d) => !drop.has(d));
  const known = listFeatures(projectDir).features.map((x) => x.name);
  const unknown = finalDeps.filter((d) => !known.includes(d)); // stale entries from an earlier hand edit
  if (replaced === null && !added.length && !drop.size && order == null) {
    return { ok: true, feature: slug, dependsOn: finalDeps, order: (rm.features[slug] || {}).order, unknownDeps: unknown };
  }

  // Build the candidate dependency map (existing + this change) and reject cycles.
  const map = Object.create(null);
  for (const [k, v] of Object.entries(rm.features)) map[k] = (v.dependsOn || []).slice();
  map[slug] = finalDeps;
  const cycle = findCycle(map);
  if (cycle) return { ok: false, error: errs(projectDir).cycle(cycle.join(" → ")) };

  rm.features[slug] = rm.features[slug] || {};
  rm.features[slug].dependsOn = finalDeps;
  if (orderNum !== null) rm.features[slug].order = orderNum;
  writeRoadmap(projectDir, rm);
  return { ok: true, changed: true, feature: slug, dependsOn: finalDeps, order: rm.features[slug].order, unknownDeps: unknown };
}

function roadmap(projectDir) {
  const list = listFeatures(projectDir);
  if (!list.exists) return { ok: true, specsDir: list.specsDir, features: [], overallPercent: 0, complete: 0, total: 0, cycle: null, cycles: [], backlog: [] };
  const rm = readRoadmap(projectDir);
  const pctByName = Object.create(null); // a dep named "constructor" must not read Object.prototype's
  const feats = list.features.map((f) => {
    const meta = rm.features[f.name] || {};
    const pct = featurePercent(f.phase, f.tasksDone, f.tasks, f.flow); // C3: f.flow — a design-first feature's own order
    pctByName[f.name] = pct;
    return { name: f.name, kind: f.kind, tracks: f.tracks, phase: f.phase, percent: pct, dependsOn: meta.dependsOn || [], order: meta.order != null ? meta.order : 999 };
  });
  // Dependency satisfaction: a dep is met when that feature is 100% (complete).
  for (const f of feats) {
    f.unmetDeps = f.dependsOn.filter((d) => (pctByName[d] != null ? pctByName[d] : 0) < 100);
    f.blocked = f.unmetDeps.length > 0;
  }
  feats.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  // 1.24 r6 (G6): every cycle (`cycles`, one path each), `cycle` the first of them (as before: one path, or null)
  const cycles = findCycles(Object.fromEntries(feats.map((f) => [f.name, f.dependsOn]))).map((c) => c.path);
  const overall = feats.length ? Math.round(feats.reduce((s, f) => s + f.percent, 0) / feats.length) : 0;
  const backlog = readRoadmap(projectDir).backlog || [];
  return { ok: true, specsDir: list.specsDir, features: feats, cycle: cycles[0] || null, cycles, overallPercent: overall, complete: feats.filter((f) => f.percent === 100).length, total: feats.length, backlog };
}

// ---------------------------------------------------------------------------
// Backlog — planned features that don't have a .specs/<feature>/ folder yet
// ---------------------------------------------------------------------------

// One line: a line break in a backlog name or note became markdown structure (a heading) in ROADMAP.md and the export.
const flatText = (s) => String(s || "").replace(/\s+/g, " ").trim();
// 1.24 r6 (G4) — a feature NAME as a spec writes it (every title, a template's {{name}}): one line (flatText) and inert to HTML
// comments — "<!--" / "-->" as &lt;!-- / --&gt; (a name holding "<!--" opened a comment in its titles that hid every criterion
// of the scaffold; the summary and an imported title were already made inert). The slug is the name's, as before.
const specNameText = (s) => flatText(s).replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;");
function addBacklog(projectDir, name, note) {
  const nm = flatText(name);
  if (!nm) return { ok: false, error: errs(projectDir).nameRequired };
  // The backlog is what has NO spec folder yet: a name an active feature already answers to was listed twice in
  // ROADMAP.md (under Features and under Backlog). An archived feature's name may be planned again.
  const f = existingFeature(projectDir, nm);
  if (f.ok) return { ok: false, feature: f.slug, error: i18n.msg(projectLang(projectDir)).featureOps.backlogIsFeature(nm, f.slug) };
  const r = withRoadmapLock(projectDir, () => addBacklogUnlocked(projectDir, nm, note));
  if (r.ok) maybeRefreshRoadmap(projectDir); // outside the lock: the lock covers roadmap.json only
  return r;
}
// A name already in the backlog (case-insensitive) keeps its entry and its spelling, and a NEW note is appended to its note
// (1.19 R review 5 — add answered "added" and kept the old note, so a second refactor candidate filed under the same name was
// lost): joined with " · " on one line; a note the entry already holds (or none) changes nothing; the whole note stays within
// BACKLOG_NOTE_MAX characters — past it nothing is appended and add is refused (file it under another name). Such a result
// carries `exists: true`, `appended` and a localized `note`. A NEW entry's note (1.19 verify 5) has the same cap: past it the
// add is refused and nothing is written.
const BACKLOG_NOTE_MAX = 2000;
const BACKLOG_NOTE_SEP = " · ";
function addBacklogUnlocked(projectDir, nm, note) {
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  const rm = readRoadmap(projectDir);
  rm.backlog = rm.backlog || [];
  const text = flatText(note);
  const cur = rm.backlog.find((b) => b.name.toLowerCase() === nm.toLowerCase());
  const O = i18n.msg(projectLang(projectDir)).featureOps;
  if (!cur) {
    // (1.19 verify 5) a new entry's note has the same cap (one line, BACKLOG_NOTE_MAX characters) — a first add stored any length
    if (text.length > BACKLOG_NOTE_MAX) return { ok: false, backlog: rm.backlog, error: O.backlogNoteLong(nm, BACKLOG_NOTE_MAX) };
    rm.backlog.push({ name: nm, note: text });
    writeRoadmap(projectDir, rm);
    return { ok: true, backlog: rm.backlog };
  }
  const old = flatText(cur.note);
  if (!text || old === text || old.split(BACKLOG_NOTE_SEP).includes(text)) {
    return { ok: true, exists: true, appended: false, backlog: rm.backlog, note: O.backlogKept(cur.name) };
  }
  const joined = old ? old + BACKLOG_NOTE_SEP + text : text;
  if (joined.length > BACKLOG_NOTE_MAX) {
    return { ok: false, exists: true, appended: false, backlog: rm.backlog, error: O.backlogNoteFull(cur.name, BACKLOG_NOTE_MAX) };
  }
  cur.note = joined;
  writeRoadmap(projectDir, rm);
  return { ok: true, exists: true, appended: true, backlog: rm.backlog, note: O.backlogAppended(cur.name) };
}

function removeBacklog(projectDir, name) {
  const nm = String(name || "").trim();
  if (!nm) return { ok: false, error: errs(projectDir).nameRequired };
  const r = withRoadmapLock(projectDir, () => removeBacklogUnlocked(projectDir, nm));
  if (r.ok) maybeRefreshRoadmap(projectDir);
  return r;
}
function removeBacklogUnlocked(projectDir, nm) {
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  const rm = readRoadmap(projectDir);
  const before = rm.backlog || [];
  // A name that isn't there is an error, not a silent "ok" (a typo must not read as removed).
  if (!before.some((b) => b.name.toLowerCase() === nm.toLowerCase())) {
    return { ok: false, error: i18n.msg(projectLang(projectDir)).featureOps.backlogNotFound(nm, before.map((b) => b.name).join(", ")) };
  }
  rm.backlog = before.filter((b) => b.name.toLowerCase() !== nm.toLowerCase());
  writeRoadmap(projectDir, rm);
  return { ok: true, backlog: rm.backlog };
}

const BACKLOG_ACTIONS = ["add", "rm", "remove", "list"]; // = the spec_roadmap_edit {kind: "backlog"} enum (server.js reads it from here)
function backlog(projectDir, action, name, note) {
  const a = String(action == null ? "" : action).trim().toLowerCase(); // 'ADD' is add on every surface (the MCP enum folds it too)
  if (a === "add") return addBacklog(projectDir, name, note);
  // "remove" is an alias of "rm" on EVERY surface (the spec_roadmap_edit {kind: "backlog"} enum lists it too) — it used to be a CLI-only alias,
  // then refused everywhere while the docs still named it.
  if (a === "rm" || a === "remove") return removeBacklog(projectDir, name);
  // Absent/"list" lists; anything else is an error (the MCP enum refuses it) — `backlog delete X` used to just list.
  if (a && a !== "list") {
    const A = i18n.msg(projectLang(projectDir)).args;
    return { ok: false, error: A.invalid(A.item("action", A.oneOf(BACKLOG_ACTIONS.join(", ")), JSON.stringify(String(action)))) };
  }
  // 1.24 review 6 (E4): a roadmap.json that doesn't parse (or has the wrong shape) is an error, never "Backlog (0)" — milestone /
  // depend's rule (its sanitized copy read as an empty backlog)
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  return { ok: true, backlog: readRoadmap(projectDir).backlog || [] };
}

// --- writers + language persistence (.specs/roadmap.json meta.lang) ---

// meta.lang = the PROJECT language (seeded by spec_init). meta.roadmapLang = the language of the
// generated ROADMAP chrome only — asking for a Spanish roadmap must not turn a PT project into ES.
function roadmapLang(projectDir) {
  return (readRoadmap(projectDir).meta || {}).lang || "en";
}
function roadmapChromeLang(projectDir) {
  const meta = readRoadmap(projectDir).meta || {};
  return meta.roadmapLang || meta.lang || "en";
}
function setRoadmapLang(projectDir, lang, key) {
  return withRoadmapLock(projectDir, () => {
    const rm = readRoadmap(projectDir);
    rm.meta = rm.meta || {};
    rm.meta[key || "lang"] = normalizeLang(lang);
    writeRoadmap(projectDir, rm);
    return { ok: true };
  });
}

// Generated roadmap files carry this marker (EN/PT/ES). A same-named file WITHOUT it was written by a
// human (the hooks run in every project) and is never overwritten.
const RE_AUTOGEN = /AUTO-GE(?:NERATED|RADO|NERADO) (?:by|por) dev-spec/;
function isGeneratedOrAbsent(file) {
  const raw = readIfExists(file);
  return raw == null || RE_AUTOGEN.test(raw.slice(0, 4000)) || RE_AUTOGEN.test(raw.slice(-4000));
}

// `data`: a roadmapData() result computed by the caller (maybeRefreshRoadmap shares one between MD and HTML); the
// counts returned are that same computation (ROADMAP.* is not a feature, so writing it changes none of them).
function writeRoadmapMd(projectDir, lang, data) {
  return writeRoadmapFile(projectDir, lang, data, "ROADMAP.md", renderRoadmapMd);
}

function writeRoadmapHtml(projectDir, lang, data) {
  return writeRoadmapFile(projectDir, lang, data, "ROADMAP.html", renderRoadmapHtml);
}

function writeRoadmapFile(projectDir, lang, data, name, render) {
  const root = specsRoot(projectDir);
  if (!fs.existsSync(root)) return { ok: false, error: errs(projectDir).noSpecs(root) };
  const file = path.join(root, name);
  if (!isGeneratedOrAbsent(file)) return { ok: false, skipped: true, file, error: errs(projectDir).notGenerated(name) };
  // 1.23 review 5 — a roadmap.json that doesn't parse (or has the wrong shape) is read as its sanitized copy: rendered from it, the
  // file lost every dependency, backlog item and milestone while `roadmap --write` exited 0. The last good one is kept.
  const broken = roadmapError(projectDir);
  if (broken) return { ok: false, skipped: true, broken: true, file, error: errs(projectDir).roadmapNotWritten(name, broken) };
  if (lang) {
    const saved = withRoadmapLock(projectDir, () => {
      const bad = roadmapError(projectDir); // persisting roadmapLang writes roadmap.json: refuse on a broken one
      return bad ? { ok: false, error: bad } : setRoadmapLang(projectDir, lang, "roadmapLang");
    });
    if (!saved.ok) return saved;
  }
  const d = data || roadmapData(projectDir);
  writeFileAtomic(file, i18n.portableCli(render(projectDir, lang || roadmapChromeLang(projectDir), d))); // committed: `dev-spec`, never a machine path (1.21 F3)
  const rmv = d.rmv;
  return { ok: true, file, overallPercent: rmv.overallPercent, complete: rmv.complete, total: rmv.total };
}

// Keep the roadmap current after any mutation. MD is the default (always); HTML only if it exists.
// Best-effort — never breaks the primary operation. It clears the stale stamp first (below): this refresh covers it.
function maybeRefreshRoadmap(projectDir) {
  try {
    const root = specsRoot(projectDir);
    if (!fs.existsSync(root)) return;
    clearRoadmapStale(projectDir);
    const html = fs.existsSync(path.join(root, "ROADMAP.html"));
    // One computation for both files — none when neither may be written (hand-written ROADMAP.md, no HTML; a broken roadmap.json
    // keeps them as they are — 1.23 review 5).
    if (!roadmapError(projectDir)) {
      const data = isGeneratedOrAbsent(path.join(root, "ROADMAP.md")) || (html && isGeneratedOrAbsent(path.join(root, "ROADMAP.html"))) ? roadmapData(projectDir) : undefined;
      writeRoadmapMd(projectDir, undefined, data);
      if (html) writeRoadmapHtml(projectDir, undefined, data);
    }
    maybeRefreshCatalog(projectDir); // .specs/SPECS.md — only once it exists (and is generated)
  } catch {
    /* best-effort */
  }
}

// 1.24 r6 I-I1 — the save hook's DEFERRED refresh. A spec file saved through Claude Code's Write / Edit tool refreshed ROADMAP.md
// and SPECS.md on the spot (hooks/spec-hook.js, PostToolUse): every save recomputed every feature's row — ~75 % of the hook, 272 /
// 423 / 725 ms per save at 10 / 50 / 150 features. The hook now leaves a STAMP, `.specs/.execution/roadmap-stale` (the project's
// scratch folder, which git-ignores itself), and the refresh runs ONCE for all the saves since: at the end of the turn (the Stop /
// SubagentStop hook), at SessionStart, in the next engine mutation (maybeRefreshRoadmap clears the stamp first) and in the pre-commit
// check — refreshStaleRoadmap. The lint stays on every save. The generated files lag at most one turn, and nothing reads them for a
// decision: approvals fingerprint a feature's own artifacts, every view (spec_roadmap, the catalog, next_action, the status line)
// computes from the specs, and the specs://roadmap / catalog resources render in memory while the stamp is there
// (docs/maintainers/lifecycle.md → Roadmap files). → whether the stamp is there (written now or before).
const ROADMAP_STALE_FILE = "roadmap-stale";
const roadmapStalePath = (projectDir) => path.join(specsRoot(projectDir), ".execution", ROADMAP_STALE_FILE);
function markRoadmapStale(projectDir) {
  try {
    const root = specsRoot(projectDir);
    if (!isDirSafe(root)) return false;
    const ex = path.join(root, ".execution");
    writeIfAbsent(path.join(ex, ".gitignore"), "*\n"); // .execution/ (created through the write gate) ignores itself
    writeIfAbsent(path.join(ex, ROADMAP_STALE_FILE), "");
    return true;
  } catch {
    return false; // best-effort: a read-only folder, a link (the gate) — the next mutation refreshes anyway
  }
}
// Is the stamp there? (A plain stat: never the read cache — the stamp comes and goes inside one call.)
function roadmapStale(projectDir) {
  try { return fs.statSync(roadmapStalePath(projectDir)).isFile(); } catch { return false; }
}
function clearRoadmapStale(projectDir) {
  if (!roadmapStale(projectDir)) return false;
  try { return removeSpecFile(roadmapStalePath(projectDir)); } catch { return false; }
}
// The refresh the stamp stands for, when it is there → { refreshed }. The stamp goes first (maybeRefreshRoadmap): a save while the
// refresh runs stamps again, and the next refresh covers it.
function refreshStaleRoadmap(projectDir) {
  if (!roadmapStale(projectDir)) return { refreshed: false };
  maybeRefreshRoadmap(projectDir);
  return { refreshed: true };
}
// While the stamp is there: the text the refresh WOULD write now for a generated ROADMAP.md / SPECS.md (in memory, nothing written),
// else null — not stale, the file absent or hand-written, a broken roadmap.json (the refresh keeps the last good file). The
// specs://roadmap / specs://catalog resources serve it: never the stale file.
function staleGeneratedText(projectDir, name) {
  if (!roadmapStale(projectDir)) return null;
  const file = path.join(specsRoot(projectDir), name);
  if (readIfExists(file) == null || !isGeneratedOrAbsent(file)) return null;
  if (name === "ROADMAP.md") return roadmapError(projectDir) ? null : i18n.portableCli(renderRoadmapMd(projectDir, roadmapChromeLang(projectDir)));
  if (name === "SPECS.md") return i18n.portableCli(catalogData(projectDir).markdown);
  return null;
}

// spec_roadmap as ONE operation for the MCP tool and the CLI: the roadmap view plus, with write/html, the
// generated files. A write that fails (a hand-written ROADMAP.md, no .specs/) makes the result an error
// naming it — never `wrote: []` reported as success.
function roadmapReport(projectDir, opts = {}) {
  const write = !!(opts.write || opts.html); // html implies writing
  const wrote = [];
  const errors = [];
  const warnings = [];
  let data = null; // one roadmap computation for the files and the view (writing ROADMAP.* changes no feature)
  if (write) {
    data = roadmapData(projectDir, { now: opts.now });
    const m = writeRoadmapMd(projectDir, opts.lang, data);
    if (m.ok) wrote.push(m.file); else errors.push(m.error);
    if (opts.html) { // independent files: a refused ROADMAP.md is an error, a skipped hand-written ROADMAP.html a warning
      const h = writeRoadmapHtml(projectDir, opts.lang, data);
      if (h.ok) wrote.push(h.file); else if (!h.broken) warnings.push(h.error); // a broken roadmap.json: said once, by ROADMAP.md's error
    }
  } else {
    // 1.23 review 5 — the view of a broken roadmap.json is its sanitized copy: say what it leaves out
    const broken = roadmapError(projectDir);
    if (broken) warnings.push(errs(projectDir).roadmapViewPartial(broken));
  }
  const rm = data ? data.rmv : roadmapExtras(projectDir, roadmap(projectDir), opts); // forecasts + overlaps (roadmapData attaches them too)
  if (write) rm.wrote = wrote;
  if (warnings.length) rm.warnings = warnings;
  if (errors.length) {
    rm.ok = false;
    rm.error = errors.join(" ");
    rm.errors = errors;
  }
  return rm;
}

// Every feature folder, active first, then archived (.specs/_archive/<slug>/) — the same addressability rule as
// listFeatures, without its per-feature phase work (the SessionStart drift check runs on this). → [{ slug, dir, archived }]
function featureDirs(projectDir) {
  const root = specsRoot(projectDir);
  const dirsIn = (base) => {
    try {
      return fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && isFeatureFolder(d.name, base)).map((d) => d.name).sort();
    } catch {
      return [];
    }
  };
  const archRoot = path.join(root, "_archive");
  return dirsIn(root).map((n) => ({ slug: n, dir: path.join(root, n), archived: false }))
    .concat(dirsIn(archRoot).map((n) => ({ slug: n, dir: path.join(archRoot, n), archived: true })));
}

// The existing folders a name reaches — active and/or archived (current or pre-1.11 slug). → [{ slug, dir, archived }]
function locateFeatures(projectDir, name) {
  const root = specsRoot(projectDir);
  const slugs = [...new Set([slugify(name), legacySlugify(name)])].filter((s) => s && !reservedSlug(s, root));
  const out = [];
  for (const [base, archived] of [[root, false], [path.join(root, "_archive"), true]]) {
    const s = slugs.find((x) => isFeatureFolder(x, base) && isDirSafe(path.join(base, x)));
    if (s) out.push({ slug: s, dir: path.join(base, s), archived });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1.21 F1a — git's merge driver for the spec state: a SEMANTIC 3-way merge of .specs/<feature>/.state.json and
// .specs/roadmap.json (`dev-spec merge-state %O %A %B %P`; `dev-spec merge-state --install` writes the .gitattributes lines
// and the clone's git config). Two branches that both approve phases, tick tasks or record evidence used to conflict in these
// JSON files — a text merge can't union two lists. PURE: JSON values in, the merged value and the real conflicts out; no file,
// no git (the CLI reads / writes the files and runs git config). The rules:
//   · a key only one side changed takes that side (a deletion included); both sides equal → that value;
//   · append-only lists (approvalHistory, changes, unticks) → the union by identity (a record both sides hold once; the same
//     record with different fields — spec_upgrade seeding a snapshot — gets both sides' fields), in chronological order;
//   · evidence[n] / finishChecks[name] → the record with the latest run `at` (a tie is the same run: its note and stale mark
//     merged), both histories merged, deduped, bounded by EVIDENCE_HISTORY; ticks[n], lastTickAt and lastEditAt → the later time;
//     `finished` → the later baseline (firstAt: the earliest finish); createdAt → the earlier;
//   · approvals[phase] → the later approval, unless a revocation (an approvalHistory record, revoked: true) is later than it —
//     revocations win by time; signoffs[phase][role] → the later sign-off, dropped when a revocation or the phase's merged
//     approval is later; lastApprovedPhase → recomputed; tracks → a 3-way set merge (what either side added, minus what
//     either side removed);
//   · roadmap.json: features (by slug; dependsOn → a set merge), backlog (by name, case-insensitive; notes joined),
//     meta.milestones (by name; features → a set merge), meta.checks / meta.approvalRoles (by key; roles → a set merge);
//     meta.specVersion → the higher, meta.changelogAt → the later, meta.evidenceSince → the earlier;
//   · a keyed entry one side deleted and the other changed → the changed one (a union);
//   · anything else both sides changed differently (a meta scalar, an unknown key) → a CONFLICT: ours is kept there and
//     {path, base, ours, theirs} is reported (a side missing from the record deleted the key). mergeStateText writes them
//     into the file as `mergeConflicts` (still valid JSON; doctor fails `merge-conflicts` until they are resolved).
// ---------------------------------------------------------------------------
const MERGE_DRIVER = "dev-spec-state";
const MERGE_KINDS = ["state", "roadmap", "generated"];
// The files the driver handles (.gitattributes patterns, relative to the project folder): the state, and the generated
// overviews — a both-sides regeneration of ROADMAP.md / SPECS.md keeps ours (the next write regenerates it from the merged
// state); a hand-written one (no AUTO-GENERATED marker) is text-merged by git itself (`git merge-file`, the CLI).
const MERGE_ATTRIBUTE_PATHS = [".specs/**/.state.json", ".specs/roadmap.json", ".specs/ROADMAP.md", ".specs/ROADMAP.html", ".specs/SPECS.md"];
const MERGE_ATTRIBUTES_HEAD = "# dev-spec: the spec state merges semantically — dev-spec merge-state --install (git config merge." + MERGE_DRIVER + ".*)";
const MERGE_CONFLICTS_KEY = "mergeConflicts";
// Canonical JSON (sorted keys): deep equality and record identity.
function mergeCanon(v) {
  if (v === undefined) return "#undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(mergeCanon).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + mergeCanon(v[k])).join(",") + "}";
}
const mergeSame = (a, b) => a === b || ((typeof a === "object" || typeof b === "object") && mergeCanon(a) === mergeCanon(b));
// A plain own property (a "__proto__" key from JSON.parse stays a key, never the prototype).
const setOwn = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
function copyOwn(x) {
  const out = {};
  for (const k of Object.keys(x)) setOwn(out, k, x[k]);
  return out;
}
const mergeTime = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : -Infinity; };
const mergeKeys = (o, t) => Object.keys(o).concat(Object.keys(t).filter((k) => !own(o, k)));
const ownVal = (x, k) => (isObj(x) && own(x, k) ? x[k] : undefined);
const mergePathText = (p) => p.map((k, i) => (/^[A-Za-z_$][\w$-]*$|^\d+$/.test(k) ? (i ? "." : "") + k : "[" + JSON.stringify(k) + "]")).join("");
// The 3-way rule every merge starts with: equal sides, or one side unchanged → no decision to make; else both().
function mergeThree(b, o, t, both) {
  if (mergeSame(o, t)) return o;
  if (mergeSame(b, o)) return t;
  if (mergeSame(b, t)) return o;
  return both();
}
function mergeConflict(ctx, p, b, o, t) {
  const c = { path: mergePathText(p) };
  if (b !== undefined) c.base = b;
  if (o !== undefined) c.ours = o;
  if (t !== undefined) c.theirs = t;
  ctx.conflicts.push(c);
  return o;
}
// One side deleted / never had a keyed entry the other changed → the changed one (a union); both non-objects → a conflict.
const mergeEither = (ctx, p, b, o, t) => (o === undefined ? t : t === undefined ? o : mergeConflict(ctx, p, b, o, t));
// An object key by key; fieldFn(key) → the merger of that key's value when both sides changed it (null: mergeValue).
function mergeObject(b, o, t, p, ctx, fieldFn) {
  const out = {};
  for (const k of mergeKeys(o, t)) {
    const bv = ownVal(b, k), ov = ownVal(o, k), tv = ownVal(t, k);
    const fn = fieldFn ? fieldFn(k) : null;
    const v = mergeThree(bv, ov, tv, () => (fn || mergeValue)(bv, ov, tv, p.concat(k), ctx));
    if (v !== undefined) setOwn(out, k, v);
  }
  return out;
}
// Both sides changed a value, differently: two objects merge key by key, anything else is a conflict (ours kept).
function mergeValue(b, o, t, p, ctx) {
  if (isObj(o) && isObj(t) && (b === undefined || isObj(b))) return mergeObject(b, o, t, p, ctx, null);
  return mergeConflict(ctx, p, b, o, t);
}
// A map of independent entries (evidence by task number, features by slug …): entry by entry, a deleted-vs-changed entry
// keeps the change; entry(b, o, t, path, ctx) decides when both sides changed it.
function mergeMapWith(entry) {
  return (b, o, t, p, ctx) => {
    if (!isObj(o) || !isObj(t)) return mergeEither(ctx, p, b, o, t);
    const out = {};
    for (const k of mergeKeys(o, t)) {
      const bv = ownVal(b, k), ov = ownVal(o, k), tv = ownVal(t, k);
      const v = mergeThree(bv, ov, tv, () => (ov === undefined || tv === undefined ? mergeEither(ctx, p.concat(k), bv, ov, tv) : entry(bv, ov, tv, p.concat(k), ctx)));
      if (v !== undefined) setOwn(out, k, v);
    }
    return out;
  };
}
// A list of keyed entries (the backlog by name, milestones by name): ours' order, then theirs' new entries; an entry without a
// key is kept as is (theirs' only when ours has no equal one).
function mergeListBy(keyOf, entry) {
  return (b, o, t, p, ctx) => {
    if (!Array.isArray(o) || !Array.isArray(t)) return mergeEither(ctx, p, b, o, t);
    const index = (list) => { const m = new Map(); for (const x of Array.isArray(list) ? list : []) { const k = keyOf(x); if (k != null && !m.has(k)) m.set(k, x); } return m; };
    const bm = index(b), om = index(o), tm = index(t);
    const order = o.map((x) => ({ k: keyOf(x), x }));
    for (const x of t) { const k = keyOf(x); if (k == null ? !o.some((y) => mergeSame(x, y)) : !om.has(k)) order.push({ k, x }); }
    const out = [], seen = new Set();
    for (const it of order) {
      if (it.k == null) { out.push(it.x); continue; }
      if (seen.has(it.k)) continue;
      seen.add(it.k);
      const bv = bm.get(it.k), ov = om.get(it.k), tv = tm.get(it.k), pp = p.concat(String(it.k));
      const v = mergeThree(bv, ov, tv, () => (ov === undefined || tv === undefined ? mergeEither(ctx, pp, bv, ov, tv) : entry(bv, ov, tv, pp, ctx)));
      if (v !== undefined) out.push(v);
    }
    return out;
  };
}
// A set (a string list — tracks, dependsOn, roles, a milestone's features): what either side added, minus what either side
// removed; ours' order first.
function mergeSet(b, o, t, p, ctx) {
  if (!Array.isArray(o) || !Array.isArray(t)) return mergeEither(ctx, p, b, o, t);
  const bs = new Set((Array.isArray(b) ? b : []).map(mergeCanon)), os = new Set(o.map(mergeCanon)), ts = new Set(t.map(mergeCanon));
  const out = [], seen = new Set();
  for (const x of o.concat(t)) {
    const c = mergeCanon(x);
    if (seen.has(c) || (bs.has(c) && (!os.has(c) || !ts.has(c)))) continue;
    seen.add(c);
    out.push(x);
  }
  return out;
}
// An append-only list: the union by identity (keyOf), a record both sides hold with different fields gets both sides' fields
// (ours win on a clash), then chronological (a stable sort on `at`) once theirs added a record.
function mergeHistoryBy(keyOf) {
  return (b, o, t, p, ctx) => {
    if (!Array.isArray(o) || !Array.isArray(t)) return mergeEither(ctx, p, b, o, t);
    const out = o.slice();
    const at = new Map();
    o.forEach((x, i) => { const k = keyOf(x); if (!at.has(k)) at.set(k, i); });
    let added = false;
    for (const y of t) {
      const k = keyOf(y);
      if (!at.has(k)) { at.set(k, out.length); out.push(y); added = true; continue; }
      const i = at.get(k);
      if (isObj(out[i]) && isObj(y) && !mergeSame(out[i], y)) {
        const m = copyOwn(y);
        for (const f of Object.keys(out[i])) setOwn(m, f, out[i][f]);
        out[i] = m;
      }
    }
    if (!added) return out;
    return out.map((x, i) => [x, i]).sort((x, y) => mergeTime(isObj(x[0]) ? x[0].at : null) - mergeTime(isObj(y[0]) ? y[0].at : null) || x[1] - y[1]).map((e) => e[0]);
  };
}
const idOf = (tag, fields) => (h) => (isObj(h) ? JSON.stringify([tag, ...fields.map((f) => (own(h, f) ? h[f] : null))]) : mergeCanon(h));
const HISTORY_ID = idOf("h", ["phase", "at", "by", "revoked", "partial", "role"]); // an approval / sign-off / revocation
const CHANGE_ID = idOf("c", ["at", "phase", "snapshot"]); // a change request (spec_impact --reopen)
const UNTICK_ID = idOf("u", ["n", "at"]); // an undone tick
const mergeLaterTime = (b, o, t, p, ctx) => (typeof o === "string" && typeof t === "string" ? (mergeTime(t) > mergeTime(o) ? t : o) : mergeConflict(ctx, p, b, o, t));
const mergeEarlierTime = (b, o, t, p, ctx) => (typeof o === "string" && typeof t === "string" ? (mergeTime(t) < mergeTime(o) ? t : o) : mergeConflict(ctx, p, b, o, t));
// evidence[n] / finishChecks[name]: the record whose latest run is the later; the same run on both sides → its annotations
// merged (a note, a stale mark — an undo, a reopen); the runs of both histories, deduped, chronological, bounded.
// r5 review: evidence[n] of two tasks that share the number n — a record carries its task's stamp (`task`) and the OTHER tasks'
// records in `others` (storeEvidence). The merge kept the winning side's record and `others` only: the other side's `others`, and its
// own record when it was another task's, were lost (and that task's runs were merged into the winner's history). Now: the runs of
// the SAME task (or of records without a stamp — v1.12 / finishChecks) merge as before; every other task's record is kept in
// `others`, one per task (the latest run), newest first, bounded (EVIDENCE_OTHERS) — storeEvidence's rule.
const runTask = (r) => (isObj(r) && typeof r.task === "string" ? r.task : null);
function mergeRunRecord(b, o, t, p, ctx) {
  if (!isObj(o) || !isObj(t)) return mergeConflict(ctx, p, b, o, t);
  const to = mergeTime(o.at), tt = mergeTime(t.at);
  const win = tt > to ? t : o, lose = win === t ? o : t;
  const rec = copyOwn(win);
  const sameTask = runTask(win) === null || runTask(lose) === null || runTask(win) === runTask(lose);
  if (to === tt && sameTask) {
    if (t.stale === true && o.stale !== true) { rec.stale = true; if (t.staleBy !== undefined) rec.staleBy = t.staleBy; }
    if (mergeTime(t.noteAt) > mergeTime(o.noteAt)) { rec.note = t.note; rec.noteAt = t.noteAt; }
  }
  const others = [o.others, t.others].filter(Array.isArray).flat().filter(isObj);
  if (!sameTask) others.push(lose);
  if (others.length) {
    const byTask = new Map();
    for (const x of others) {
      const k = runTask(x) !== null ? "t:" + runTask(x) : "c:" + mergeCanon(x);
      if (runTask(x) !== null && runTask(x) === runTask(win)) continue; // the winner's own task
      const prev = byTask.get(k);
      if (!prev || mergeTime(x.at) > mergeTime(prev.at)) byTask.set(k, x);
    }
    const list = [...byTask.values()].map((x) => { const c = copyOwn(x); delete c.others; return c; })
      .sort((x, y) => mergeTime(y.at) - mergeTime(x.at)).slice(0, EVIDENCE_OTHERS);
    if (list.length) setOwn(rec, "others", list); else delete rec.others;
  }
  const runs = (sameTask ? [o.history, t.history] : [win.history]).filter(Array.isArray).flat().filter(isObj);
  if (runs.length) {
    const seen = new Set();
    const uniq = runs.filter((h) => { const c = mergeCanon(h); if (seen.has(c)) return false; seen.add(c); return true; });
    rec.history = uniq.map((h, i) => [h, i]).sort((x, y) => mergeTime(x[0].at) - mergeTime(y[0].at) || x[1] - y[1]).map((e) => e[0]).slice(-EVIDENCE_HISTORY);
  }
  return rec;
}
// `branch` (1.25 — create --branch): recorded once, when the feature started on its own git branch. Two records (each side recorded
// one) → the EARLIER — its `at`: where the feature started first, as createdAt (a record without a time reads as the later one); the
// same time → the same name is one record (ours' fields over theirs'), two names a conflict (ours kept).
function mergeBranchRecord(b, o, t, p, ctx) {
  if (!isObj(o) || !isObj(t)) return mergeEither(ctx, p, b, o, t);
  const when = (x) => { const v = mergeTime(x.at); return v === -Infinity ? Infinity : v; };
  const to = when(o), tt = when(t);
  if (to !== tt) return tt < to ? t : o;
  if (o.name !== t.name) return mergeConflict(ctx, p, b, o, t);
  const m = copyOwn(t);
  for (const k of Object.keys(o)) setOwn(m, k, o[k]);
  return m;
}
// `finished` (the drift baseline): the later one; firstAt = the earliest finish either side recorded.
function mergeFinished(b, o, t, p, ctx) {
  if (!isObj(o) || !isObj(t)) return mergeEither(ctx, p, b, o, t);
  const win = copyOwn(mergeTime(t.at) > mergeTime(o.at) ? t : o);
  const firsts = [o.firstAt || o.at, t.firstAt || t.at].filter((x) => mergeTime(x) > -Infinity).sort((x, y) => mergeTime(x) - mergeTime(y));
  if (firsts.length && firsts[0] !== win.at) win.firstAt = firsts[0];
  return win;
}
// The revocations that cut waiting sign-offs: { all: phase → time (an approval revoked, or a partial revocation that withdrew every
// waiting sign-off — the rule before 1.23), byRole: phase → role → time (r5 review: a partial revocation flagged `roleOnly` withdrew the
// sign-off of the role it names in `roles` — the others stayed, and a merge keeps them) }.
function signoffRevocations(hist) {
  const all = Object.create(null), byRole = Object.create(null);
  for (const h of Array.isArray(hist) ? hist : []) {
    if (!isObj(h) || h.revoked !== true || typeof h.phase !== "string") continue;
    const tm = mergeTime(h.at);
    if (h.partial === true && h.roleOnly === true && Array.isArray(h.roles) && h.roles.length) {
      const m = byRole[h.phase] || (byRole[h.phase] = Object.create(null));
      for (const r of h.roles) if (typeof r === "string" && (!(r in m) || tm > m[r])) m[r] = tm;
    } else if (!(h.phase in all) || tm > all[h.phase]) all[h.phase] = tm;
  }
  return { all, byRole };
}
// phase → the time of its latest revocation in the (merged) history; withPartial: also a revocation that withdrew only
// waiting role sign-offs (nothing had been approved).
function revocationTimes(hist, withPartial) {
  const out = Object.create(null);
  for (const h of Array.isArray(hist) ? hist : []) {
    if (!isObj(h) || h.revoked !== true || typeof h.phase !== "string" || (!withPartial && h.partial === true)) continue;
    const tm = mergeTime(h.at);
    if (!(h.phase in out) || tm > out[h.phase]) out[h.phase] = tm;
  }
  return out;
}
const laterAt = (x, y) => (mergeTime(y.at) > mergeTime(x.at) ? y : x);
// approvals: phase by phase the later approval (a deleted-vs-changed phase: the change) — then none when a revocation is later.
function mergeApprovals(hist) {
  const revokedAt = revocationTimes(hist, false);
  return (b, o, t, p, ctx) => {
    if (!isObj(o) || !isObj(t)) return mergeEither(ctx, p, b, o, t);
    const out = {};
    for (const ph of mergeKeys(o, t)) {
      const bv = ownVal(b, ph), ov = ownVal(o, ph), tv = ownVal(t, ph);
      let v = mergeThree(bv, ov, tv, () => (ov === undefined || tv === undefined ? mergeEither(ctx, p.concat(ph), bv, ov, tv)
        : isObj(ov) && isObj(tv) ? laterAt(ov, tv) : mergeConflict(ctx, p.concat(ph), bv, ov, tv)));
      if (isObj(v) && ph in revokedAt && revokedAt[ph] > mergeTime(v.at)) v = undefined;
      if (v !== undefined) setOwn(out, ph, v);
    }
    return out;
  };
}
// approvals → without an approval older than a (non-partial) revocation of its phase — the same object when none is (r5 review).
function pruneRevokedApprovals(a, hist) {
  if (!isObj(a)) return a;
  const revokedAt = revocationTimes(hist, false);
  const out = {};
  let dropped = false;
  for (const ph of Object.keys(a)) {
    if (isObj(a[ph]) && ph in revokedAt && revokedAt[ph] > mergeTime(a[ph].at)) { dropped = true; continue; }
    setOwn(out, ph, a[ph]);
  }
  return dropped ? out : a;
}
// signoffs[phase][role]: the later sign-off (per role; a deleted-vs-changed entry keeps the change). The drop rule is
// pruneSignoffs', applied to the 3-way RESULT.
const mergeSignoffs = mergeMapWith(mergeMapWith((b, o, t, p, ctx) => (isObj(o) && isObj(t) ? laterAt(o, t) : mergeConflict(ctx, p, b, o, t))));
// The drop rule (1.21 review A1): a waiting sign-off no later than a revocation of its phase or than the phase's merged approval
// is gone — run on whatever the 3-way gave, also when only ONE side changed signoffs (mergeThree hands that side back as it is:
// its sign-off stayed next to the other side's later approval). → the signoffs (the same object when nothing drops), or undefined
// once none is left. The driver never APPROVES anything: sign-offs of every role made on two branches stay waiting sign-offs —
// doctor / next_action say to complete them (any listed role signs again: approve <f> <phase> --role <role>).
function pruneSignoffs(m, hist, approvals) {
  if (!isObj(m)) return m;
  const rv = signoffRevocations(hist);
  const out = {};
  let dropped = false;
  for (const ph of Object.keys(m)) {
    if (!isObj(m[ph]) || !Object.keys(m[ph]).length) { setOwn(out, ph, m[ph]); continue; }
    const cut = Math.max(ph in rv.all ? rv.all[ph] : -Infinity, isObj(ownVal(approvals, ph)) ? mergeTime(approvals[ph].at) : -Infinity);
    const byRole = ph in rv.byRole ? rv.byRole[ph] : Object.create(null);
    const roles = {};
    for (const r of Object.keys(m[ph])) {
      if (isObj(m[ph][r]) && mergeTime(m[ph][r].at) <= Math.max(cut, r in byRole ? byRole[r] : -Infinity)) dropped = true;
      else setOwn(roles, r, m[ph][r]);
    }
    if (Object.keys(roles).length) setOwn(out, ph, roles);
  }
  if (!dropped) return m;
  return Object.keys(out).length ? out : undefined;
}
// .state.json: the approval history first (approvals read its revocations), then approvals (the sign-offs read them).
function mergeFeatureState(b, o, t, ctx) {
  const H = mergeThree(ownVal(b, "approvalHistory"), o.approvalHistory, t.approvalHistory,
    () => mergeHistoryBy(HISTORY_ID)(ownVal(b, "approvalHistory"), o.approvalHistory, t.approvalHistory, ["approvalHistory"], ctx));
  // (r5 review: "revocations win by time" on the 3-way RESULT — when only one side changed approvals, mergeThree handed that side back
  // unfiltered, so an approval older than a revocation the other side recorded survived)
  const A = pruneRevokedApprovals(mergeThree(ownVal(b, "approvals"), o.approvals, t.approvals, () => mergeApprovals(H)(ownVal(b, "approvals"), o.approvals, t.approvals, ["approvals"], ctx)), H);
  const SO = pruneSignoffs(mergeThree(ownVal(b, "signoffs"), o.signoffs, t.signoffs, () => mergeSignoffs(ownVal(b, "signoffs"), o.signoffs, t.signoffs, ["signoffs"], ctx)), H, A);
  // lastApprovedPhase: the phase of the latest merged approval (the engine's own rule after an approval or a revocation).
  const lastApproved = () => {
    const list = isObj(A) ? Object.keys(A).filter((ph) => isObj(A[ph])) : [];
    return list.length ? list.reduce((x, y) => (mergeTime(A[y].at) > mergeTime(A[x].at) ? y : x)) : undefined;
  };
  const FIELDS = {
    approvalHistory: () => H, approvals: () => A, signoffs: () => SO, lastApprovedPhase: lastApproved,
    changes: mergeHistoryBy(CHANGE_ID), unticks: mergeHistoryBy(UNTICK_ID), [MERGE_CONFLICTS_KEY]: mergeHistoryBy(mergeCanon),
    evidence: mergeMapWith(mergeRunRecord), finishChecks: mergeMapWith(mergeRunRecord), ticks: mergeMapWith(mergeLaterTime),
    finished: mergeFinished, tracks: mergeSet, createdAt: mergeEarlierTime, lastTickAt: mergeLaterTime, lastEditAt: mergeLaterTime, // lastEditAt: 1.22 review (the spec-hook's stamp)
    branch: mergeBranchRecord, // 1.25 (create --branch)
  };
  const out = mergeObject(b, o, t, [], ctx, (k) => (own(FIELDS, k) ? FIELDS[k] : null));
  // lastApprovedPhase follows the merged approvals, never its own 3-way (ours unchanged + theirs revoked would drop it while a
  // re-approval stands): the side whose approvals ARE the result keeps its value; approvals merged from both → recomputed.
  if (own(o, "lastApprovedPhase") || own(t, "lastApprovedPhase")) {
    const lap = mergeSame(A, o.approvals) ? ownVal(o, "lastApprovedPhase") : mergeSame(A, t.approvals) ? ownVal(t, "lastApprovedPhase") : lastApproved();
    if (lap === undefined) delete out.lastApprovedPhase;
    else setOwn(out, "lastApprovedPhase", lap);
  }
  // approvals: always the filtered result (the same reason — r5 review).
  if ((own(o, "approvals") || own(t, "approvals")) && A !== undefined) setOwn(out, "approvals", A);
  // signoffs: always the pruned result (mergeObject's own 3-way hands back a side that alone changed them, unpruned).
  if (own(o, "signoffs") || own(t, "signoffs")) {
    if (SO === undefined) delete out.signoffs;
    else setOwn(out, "signoffs", SO);
  }
  // 1.24 review 6 (E2): a run older than a reopen / an undo of its task that only ONE side recorded is stale in the result
  const ev = ownVal(out, "evidence");
  const evStale = staleMergedEvidence(o, t, ev);
  if (evStale !== ev) setOwn(out, "evidence", evStale);
  return out;
}
// 1.24 review 6 (E2) — the merge's post-pass over the evidence. A change request that reopened task n (`changes[].reopened`) or an
// undone tick of n (`unticks[]` {n, at}) recorded on ONE side never reached the other side's evidence: a run of that task the other
// branch made BEFORE it won the merge (the later run, mergeRunRecord) with no stale mark, and a re-tick with no new run read
// verified (finish and the execution sign-off passed). A merged record of slot n whose run is older than such an event is marked
// stale — `staleBy: "undo"` for an untick; a reopen (the spec changed — redProof never reads through it) wins over an undo —
// unless the side that recorded the event kept that task's own record valid (a task sharing the number that the reopen didn't
// reach). A record's time is its run's `at`, or its note's (`noteAt`) for a task with no _Verify:_ command (the note IS its
// re-check — recordEvidence). Events both sides hold (the base's) are applied on both already. Copy on write: no input is mutated.
// → the evidence (the same object when nothing changes)
function staleMergedEvidence(o, t, ev) {
  if (!isObj(ev)) return ev;
  const listOf = (doc, key) => (Array.isArray(ownVal(doc, key)) ? ownVal(doc, key) : []);
  const onlyIn = (side, other, key, idOf) => { const there = new Set(listOf(other, key).map(idOf)); return listOf(side, key).filter((x) => isObj(x) && !there.has(idOf(x))); };
  const events = [];
  for (const [side, other] of [[o, t], [t, o]]) {
    for (const c of onlyIn(side, other, "changes", CHANGE_ID)) if (Array.isArray(c.reopened)) for (const n of c.reopened) events.push({ n: String(n), at: mergeTime(c.at), undo: false, side });
    for (const u of onlyIn(side, other, "unticks", UNTICK_ID)) if (u.n != null) events.push({ n: String(u.n), at: mergeTime(u.at), undo: true, side });
  }
  if (!events.length) return ev;
  const records = (slot) => (isObj(slot) ? [slot, ...(Array.isArray(slot.others) ? slot.others.filter(isObj) : [])] : []);
  const runTime = (r) => (typeof r.verify === "string" && r.verify ? mergeTime(r.at) : Math.max(mergeTime(r.at), mergeTime(r.noteAt)));
  // The side's own record of r's task: by its `task` stamp; an unstamped record (v1.12) is the slot's latest.
  const sideRecord = (side, n, r, isMain) => {
    const recs = records(ownVal(ownVal(side, "evidence"), n));
    return runTask(r) !== null ? recs.find((x) => runTask(x) === runTask(r)) : isMain ? recs[0] : undefined;
  };
  const judge = (n, r, isMain) => {
    let reopen = false, undo = false;
    for (const e of events) {
      if (e.n !== n || !(e.at > runTime(r))) continue;
      const mine = sideRecord(e.side, n, r, isMain);
      if (mine && mine.stale !== true) continue; // the side that recorded it kept this task's record valid: it never reached it
      if (e.undo) undo = true; else reopen = true;
    }
    if (reopen && !(r.stale === true && r.staleBy === undefined)) { const c = copyOwn(r); c.stale = true; delete c.staleBy; return c; }
    if (!reopen && undo && r.stale !== true) { const c = copyOwn(r); c.stale = true; c.staleBy = "undo"; return c; }
    return r;
  };
  let out = ev;
  for (const n of Object.keys(ev)) {
    const slot = ev[n];
    if (!isObj(slot) || !events.some((e) => e.n === n)) continue;
    let next = judge(n, slot, true);
    if (Array.isArray(slot.others)) {
      const others = slot.others.map((x) => (isObj(x) ? judge(n, x, false) : x));
      if (others.some((x, i) => x !== slot.others[i])) { if (next === slot) next = copyOwn(slot); setOwn(next, "others", others); }
    }
    if (next !== slot) { if (out === ev) out = copyOwn(ev); setOwn(out, n, next); }
  }
  return out;
}
// 1.24 review 6 (E5) — roadmap.json: dependency edges each side added alone can close a cycle together (alpha → beta on one branch,
// beta → alpha on the other): the merge was clean, wrote the cycle, and every later depend was refused on it. A cycle in the merged
// features is a CONFLICT: the first edge on it ours doesn't hold (theirs brought it) is undone — ours kept at that feature's
// dependsOn, {path: features.<slug>.dependsOn, base?, ours?, theirs?} reported — until no cycle is left; a cycle ours' own lists
// hold is not the merge's (left as it is). → the merged document (a copy when something changed)
function breakMergedCycles(b, o, t, merged, ctx) {
  let feats = ownVal(merged, "features");
  if (!isObj(feats)) return merged;
  const depsAt = (doc, slug) => ownVal(ownVal(ownVal(doc, "features"), slug), "dependsOn");
  let copied = false;
  for (let round = 0, max = Object.keys(feats).length + 1; round < max; round++) {
    const map = Object.create(null);
    for (const k of Object.keys(feats)) map[k] = isObj(feats[k]) && Array.isArray(feats[k].dependsOn) ? feats[k].dependsOn.filter((d) => typeof d === "string") : [];
    const cycle = findCycle(map);
    if (!cycle) break;
    let slug = null;
    for (let i = 0; i + 1 < cycle.length && slug === null; i++) {
      const ov = depsAt(o, cycle[i]);
      if (!(Array.isArray(ov) && ov.includes(cycle[i + 1])) && isObj(feats[cycle[i]])) slug = cycle[i];
    }
    if (slug === null) break; // a cycle ours already had (a hand edit): not the merge's
    if (!copied) { feats = copyOwn(feats); copied = true; }
    const ov = depsAt(o, slug);
    mergeConflict(ctx, ["features", slug, "dependsOn"], depsAt(b, slug), ov, depsAt(t, slug));
    const entry = copyOwn(feats[slug]);
    if (ov === undefined) delete entry.dependsOn; else setOwn(entry, "dependsOn", ov);
    setOwn(feats, slug, entry);
  }
  if (!copied) return merged;
  const out = copyOwn(merged);
  setOwn(out, "features", feats);
  return out;
}
// roadmap.json.
const joinNotes = (b, o, t, p, ctx) => {
  if (typeof o !== "string" || typeof t !== "string") return mergeEither(ctx, p, b, o, t);
  const parts = [];
  for (const s of o.split(BACKLOG_NOTE_SEP).concat(t.split(BACKLOG_NOTE_SEP))) if (s.trim() && !parts.includes(s.trim())) parts.push(s.trim());
  return parts.join(BACKLOG_NOTE_SEP);
};
const ROADMAP_ENTRY = {
  feature: (b, o, t, p, ctx) => (isObj(o) && isObj(t) ? mergeObject(b, o, t, p, ctx, (k) => (k === "dependsOn" ? mergeSet : null)) : mergeConflict(ctx, p, b, o, t)),
  backlog: (b, o, t, p, ctx) => (isObj(o) && isObj(t) ? mergeObject(b, o, t, p, ctx, (k) => (k === "note" ? joinNotes : k === "name" ? (bv, ov) => ov : null)) : mergeConflict(ctx, p, b, o, t)),
  milestone: (b, o, t, p, ctx) => (isObj(o) && isObj(t) ? mergeObject(b, o, t, p, ctx, (k) => (k === "features" || k === "archived" ? mergeSet : null)) : mergeConflict(ctx, p, b, o, t)),
};
const backlogKey = (x) => (isObj(x) && typeof x.name === "string" ? flatText(x.name).toLowerCase() : null);
const milestoneKey = (x) => (isObj(x) && typeof x.name === "string" ? x.name : null);
const META_FIELDS = {
  checks: mergeMapWith(mergeValue),
  approvalRoles: mergeMapWith(mergeSet),
  milestones: mergeListBy(milestoneKey, ROADMAP_ENTRY.milestone),
  specVersion: (b, o, t, p, ctx) => (typeof o === "string" && typeof t === "string" ? (compareSemver(t, o) > 0 ? t : o) : mergeConflict(ctx, p, b, o, t)),
  changelogAt: mergeLaterTime,
  evidenceSince: mergeEarlierTime,
};
const ROADMAP_FIELDS = {
  features: mergeMapWith(ROADMAP_ENTRY.feature),
  backlog: mergeListBy(backlogKey, ROADMAP_ENTRY.backlog),
  meta: (b, o, t, p, ctx) => (isObj(o) && isObj(t) ? mergeObject(b, o, t, p, ctx, (k) => (own(META_FIELDS, k) ? META_FIELDS[k] : null)) : mergeEither(ctx, p, b, o, t)),
  [MERGE_CONFLICTS_KEY]: mergeHistoryBy(mergeCanon),
};
// A document's kind from its keys when the caller doesn't say: roadmap.json holds features / meta / backlog.
function mergeKindOf(doc) {
  const x = isObj(doc) ? doc : {};
  return ["features", "meta", "backlog", "milestones"].some((k) => own(x, k)) && !["approvals", "evidence", "approvalHistory", "tracks"].some((k) => own(x, k)) ? "roadmap" : "state";
}
// The kind from a repository path (git's %P): .state.json · roadmap.json · the generated overviews; else null.
function mergeKindOfPath(p) {
  const base = typeof p === "string" ? p.replace(/\\/g, "/").split("/").pop() : "";
  return base === ".state.json" ? "state" : base === "roadmap.json" ? "roadmap" : ["ROADMAP.md", "ROADMAP.html", "SPECS.md"].includes(base) ? "generated" : null;
}
// The semantic 3-way merge (pure) of a .state.json (kind "state") or roadmap.json ("roadmap"; absent: read from the keys).
// base: the common ancestor (undefined when both sides added the file). → { kind, merged, conflicts: [{path, base?, ours?,
// theirs?}] } — merged holds ours at each conflict.
function mergeStateJson(base, ours, theirs, kind) {
  const k = kind === "state" || kind === "roadmap" ? kind : mergeKindOf(isObj(ours) ? ours : theirs);
  const ctx = { conflicts: [] };
  if (!isObj(ours) || !isObj(theirs)) return { kind: k, merged: mergeThree(base, ours, theirs, () => mergeConflict(ctx, [], base, ours, theirs)), conflicts: ctx.conflicts };
  const b = isObj(base) ? base : undefined;
  const merged = k === "roadmap" ? breakMergedCycles(b, ours, theirs, mergeObject(b, ours, theirs, [], ctx, (f) => (own(ROADMAP_FIELDS, f) ? ROADMAP_FIELDS[f] : null)), ctx) // 1.24 review 6 (E5)
    : mergeFeatureState(b, ours, theirs, ctx);
  return { kind: k, merged, conflicts: ctx.conflicts };
}
// The driver's whole job on file TEXTS (git's %O %A %B; opts.path = %P, opts.kind overrides): parse (a BOM tolerated; an empty
// base = the file was added on both sides), merge, and render the result as ours was written (BOM, CRLF, final newline). A
// conflict is written INTO the result — ours at each conflicting place plus a top-level "mergeConflicts" list — so the file
// stays valid JSON. → { ok: true, kind, clean, conflicts, merged, text } · a generated overview: { ok: true, kind: "generated",
// keepOurs } (both sides dev-spec's own output → keep ours) · ours / theirs not JSON: { ok: false, parseError: "ours" | "theirs",
// error } (nothing merged — the caller leaves ours as it is).
function mergeStateText(baseText, oursText, theirsText, opts = {}) {
  const kind = MERGE_KINDS.includes(opts.kind) ? opts.kind : mergeKindOfPath(opts.path);
  const strip = (s) => (typeof s === "string" && s.charCodeAt(0) === 0xfeff ? s.slice(1) : typeof s === "string" ? s : "");
  if (kind === "generated") return { ok: true, kind, keepOurs: RE_AUTOGEN.test(strip(oursText)) && RE_AUTOGEN.test(strip(theirsText)) };
  const parse = (s) => { try { return { value: JSON.parse(strip(s)) }; } catch (e) { return { error: String(e && e.message || e).slice(0, 200) }; } };
  const o = parse(oursText);
  if (o.error) return { ok: false, kind, parseError: "ours", error: o.error };
  const t = parse(theirsText);
  if (t.error) return { ok: false, kind, parseError: "theirs", error: t.error };
  const b = strip(baseText).trim() ? parse(baseText) : { value: undefined };
  const r = mergeStateJson(b.error ? undefined : b.value, o.value, t.value, kind);
  let out = r.merged;
  if (r.conflicts.length && isObj(out)) {
    out = copyOwn(out);
    // 1.21 review A7: a re-merge with the list still unresolved reports the same conflicts again — each is listed once
    // (mergeCanon: the same {path, base, ours, theirs}).
    const seen = new Set();
    const list = (Array.isArray(out[MERGE_CONFLICTS_KEY]) ? out[MERGE_CONFLICTS_KEY] : []).concat(r.conflicts)
      .filter((c) => { const k = mergeCanon(c); if (seen.has(k)) return false; seen.add(k); return true; });
    setOwn(out, MERGE_CONFLICTS_KEY, list);
  }
  const raw = String(oursText || "");
  const eol = /\r\n/.test(raw) ? "\r\n" : "\n";
  let text = JSON.stringify(out, null, 2);
  if (eol === "\r\n") text = text.replace(/\n/g, "\r\n");
  if (/\n$/.test(raw)) text += eol;
  if (raw.charCodeAt(0) === 0xfeff) text = BOM_CHAR + text;
  return { ok: true, kind: r.kind, clean: !r.conflicts.length, conflicts: r.conflicts, merged: out, text };
}
// .gitattributes with the driver's lines (install) or without them (remove) — pure, the file's other lines and EOL kept; an
// install that finds a line missing rewrites the block (the head comment + every line) at the end. → { text, changed, lines }
const MERGE_ATTRIBUTE_LINES = MERGE_ATTRIBUTE_PATHS.map((p) => p + " merge=" + MERGE_DRIVER);
function mergeAttributes(text, remove) {
  const src = typeof text === "string" ? text : "";
  const eol = /\r\n/.test(src) ? "\r\n" : "\n";
  const lines = src ? src.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n") : [];
  const oursLine = (l) => { const w = l.trim().split(/\s+/); return w.length >= 2 && MERGE_ATTRIBUTE_PATHS.includes(w[0]) && w.slice(1).includes("merge=" + MERGE_DRIVER); };
  const head = (l) => l.trim() === MERGE_ATTRIBUTES_HEAD;
  const unchanged = { text: src, changed: false, lines: MERGE_ATTRIBUTE_LINES };
  if (remove ? !lines.some((l) => oursLine(l) || head(l)) : MERGE_ATTRIBUTE_PATHS.every((p) => lines.some((l) => oursLine(l) && l.trim().split(/\s+/)[0] === p))) return unchanged;
  const kept = lines.filter((l) => !oursLine(l) && !head(l));
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  const next = remove ? kept : kept.concat(kept.length ? [""] : [], [MERGE_ATTRIBUTES_HEAD], MERGE_ATTRIBUTE_LINES);
  const out = next.length ? next.join(eol) + eol : "";
  return { text: out, changed: out !== src, lines: MERGE_ATTRIBUTE_LINES };
}
// Doctor's `merge-conflicts` (fail): the conflicts the merge driver left in the feature's .state.json or in roadmap.json that
// nobody resolved yet (their `mergeConflicts` list) → the check, or null.
function mergeConflictsCheck(projectDir, slug, state, lng) {
  const list = (doc, file) => (isObj(doc) && Array.isArray(doc[MERGE_CONFLICTS_KEY]) ? doc[MERGE_CONFLICTS_KEY].map((c) => file + " " + (isObj(c) && typeof c.path === "string" && c.path ? c.path : "?")) : []);
  const items = list(state, `.specs/${slug}/.state.json`).concat(list(readRoadmap(projectDir), ".specs/roadmap.json"));
  if (!items.length) return null;
  return { id: "merge-conflicts", status: "fail", detail: i18n.msg(lng).mergeState.doctor(items.length, items.slice(0, 6).join(", ") + (items.length > 6 ? ", …" : "")) };
}

// ---------------------------------------------------------------------------
// 1.21 review A3 — is the installed merge driver still THIS clone's? `merge-state --install` writes git config
// merge.dev-spec-state.driver = `node '<clone>/cli/dev-spec.js' merge-state %O %A %B %P`; a plugin install lives in a versioned
// folder (plugins/cache/<marketplace>/dev-spec-driven/<version>/), so after an update that path is gone — git then reports a
// content conflict, leaves ours without markers or a mergeConflicts list, and `git add` drops theirs' changes silently. Read
// only: `merge-state --check` passes the value `git config --get` read; the SessionStart hook passes nothing and the repository's
// config is read here AS TEXT (no git process in a hook). Pure helpers first.
// ---------------------------------------------------------------------------
const MERGE_DRIVER_KEY = "merge." + MERGE_DRIVER + ".driver";
// One value of a git config file's text (name "section.sub.key": section and key case-insensitive, the subsection exact; the old
// `[section.sub]` form too) — the LAST definition wins, as in git. Values as git reads them: `#` / `;` comments outside quotes,
// quotes dropped, the escapes \" \\ \n \t \b, a trailing backslash continues the line, unquoted whitespace kept inside and dropped
// around. → the string, true (a key without `=`), or undefined.
function gitConfigGet(text, name) {
  const parts = String(name || "").split(".");
  if (parts.length < 2) return undefined;
  const wantSec = parts[0].toLowerCase(), wantKey = parts[parts.length - 1].toLowerCase(), wantSub = parts.length > 2 ? parts.slice(1, -1).join(".") : null;
  const s = String(text || "").replace(/\r\n/g, "\n");
  const n = s.length;
  let i = s.charCodeAt(0) === 0xfeff ? 1 : 0;
  let inSec = false, found;
  const toEol = () => { while (i < n && s[i] !== "\n") i++; };
  while (i < n) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c === "#" || c === ";") { toEol(); continue; }
    if (c === "[") {
      const m = /^\[[ \t]*([A-Za-z0-9.-]+)(?:[ \t]+"((?:[^"\\\n]|\\.)*)")?[ \t]*\]/.exec(s.slice(i, i + 4096));
      if (!m) { inSec = false; toEol(); continue; }
      i += m[0].length;
      let sec = m[1], sub = m[2] === undefined ? null : m[2].replace(/\\(.)/g, "$1");
      if (sub === null && sec.includes(".")) { sub = sec.slice(sec.indexOf(".") + 1).toLowerCase(); sec = sec.slice(0, sec.indexOf(".")); }
      inSec = sec.toLowerCase() === wantSec && sub === wantSub;
      continue;
    }
    const km = /^[A-Za-z][A-Za-z0-9-]*/.exec(s.slice(i, i + 256));
    if (!km) { toEol(); continue; }
    i += km[0].length;
    const hit = inSec && km[0].toLowerCase() === wantKey;
    while (i < n && (s[i] === " " || s[i] === "\t")) i++;
    if (s[i] !== "=") { if (hit) found = true; if (s[i] === "#" || s[i] === ";") toEol(); continue; }
    i++;
    let val = "", quote = false, space = 0, comment = false, bad = false;
    for (; i < n; i++) {
      let ch = s[i];
      if (ch === "\n") { if (quote) bad = true; break; }
      if (comment) continue;
      if ((ch === " " || ch === "\t") && !quote) { if (val.length) space++; continue; }
      if (!quote && (ch === "#" || ch === ";")) { comment = true; continue; }
      for (; space; space--) val += " ";
      if (ch === "\\") {
        const nx = s[i + 1];
        i++;
        if (nx === "\n") continue;
        if (nx === "t") ch = "\t"; else if (nx === "b") ch = "\b"; else if (nx === "n") ch = "\n"; else if (nx === "\\" || nx === "\"") ch = nx;
        else { bad = true; break; }
        val += ch;
        continue;
      }
      if (ch === "\"") { quote = !quote; continue; }
      val += ch;
    }
    if (bad) { toEol(); continue; }
    if (hit) found = val;
  }
  return found;
}
// The script a merge driver command runs: the word before `merge-state` (sh quoting read: '…' literal, "…" with \" \\ \$ \`,
// a bare word with \x) — `node '/x/cli/dev-spec.js' merge-state %O %A %B %P` → "/x/cli/dev-spec.js". → the path, or null.
function mergeDriverScript(command) {
  if (typeof command !== "string") return null;
  const words = [];
  let w = null, i = 0;
  const s = command;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n") { if (w !== null) { words.push(w); w = null; } i++; continue; }
    if (w === null) w = "";
    if (c === "'") { const e = s.indexOf("'", i + 1); if (e < 0) return null; w += s.slice(i + 1, e); i = e + 1; continue; }
    if (c === "\"") {
      i++;
      while (i < s.length && s[i] !== "\"") {
        if (s[i] === "\\" && "\"\\$`".includes(s[i + 1] || "")) { w += s[i + 1]; i += 2; continue; }
        w += s[i++];
      }
      if (i >= s.length) return null;
      i++;
      continue;
    }
    if (c === "\\" && i + 1 < s.length) { w += s[i + 1]; i += 2; continue; }
    w += c;
    i++;
  }
  if (w !== null) words.push(w);
  const at = words.indexOf("merge-state");
  return at > 0 && words[at - 1] ? words[at - 1] : null;
}
// The repository's git config TEXT for the project folder (fs only): the nearest `.git` up from it — a folder, or a worktree's /
// submodule's `.git` FILE (`gitdir: <path>`, relative to the file's folder); a linked worktree's settings live in the common dir
// (`<gitdir>/commondir`), plus its own config.worktree (read after, so its values win). → { text, dir } | null
function repoGitConfigText(projectDir) {
  let dir = path.resolve(String(projectDir || "."));
  for (let k = 0; k < 64; k++) {
    const dotGit = path.join(dir, ".git");
    let st = null;
    try { st = fs.statSync(dotGit); } catch { st = null; }
    if (st) {
      let gitDir = dotGit;
      if (st.isFile()) {
        const m = /^gitdir:[ \t]*(.+?)[ \t]*$/m.exec(fs.readFileSync(dotGit, "utf8"));
        if (!m) return null;
        gitDir = path.resolve(dir, m[1]);
      }
      let common = gitDir;
      try { common = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, "commondir"), "utf8").trim()); } catch { common = gitDir; }
      const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };
      return { text: read(path.join(common, "config")) + "\n" + (common !== gitDir ? read(path.join(gitDir, "config.worktree")) : ""), dir: gitDir };
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
// The project's merge driver, checked (read only). opts.driver: the configured command when the caller read it (`git config --get`:
// a string, or null when none is set); absent → read from the repository's config text. opts.cli: this clone's cli/dev-spec.js
// (default: the engine's own clone). → { status, named, attributes, driver, script, cli } — status (stable): `ok` (it runs this
// clone's CLI) · `none` (no driver and .gitattributes doesn't name it: nothing to check) · `not-installed` (.gitattributes names it,
// this clone has no driver: git falls back to its text merge) · `other` (it runs another script, or a command that names none) ·
// `missing` (it runs a script that doesn't exist — a plugin update moved the plugin).
function mergeDriverStatus(projectDir, opts = {}) {
  const attributes = path.join(path.resolve(String(projectDir || ".")), ".gitattributes");
  let attrText = "";
  try { attrText = fs.readFileSync(attributes, "utf8"); } catch { attrText = ""; }
  const named = attrText.replace(/\r\n/g, "\n").split("\n").some((l) => { const w = l.trim().split(/\s+/); return w.length >= 2 && !w[0].startsWith("#") && w.slice(1).includes("merge=" + MERGE_DRIVER); });
  const cli = path.resolve(typeof opts.cli === "string" && opts.cli ? opts.cli : i18n.DEV_SPEC_SCRIPT).replace(/\\/g, "/");
  let driver;
  if (own(opts, "driver")) driver = typeof opts.driver === "string" && opts.driver.trim() ? opts.driver.trim() : null;
  else if (!named) driver = null; // the hook's cheap path: nothing names the driver — no config read
  else {
    const g = repoGitConfigText(projectDir);
    const v = g ? gitConfigGet(g.text, MERGE_DRIVER_KEY) : undefined;
    driver = typeof v === "string" && v.trim() ? v.trim() : null;
  }
  const res = { status: "none", named, attributes, driver, script: null, cli };
  if (!driver) { res.status = named ? "not-installed" : "none"; return res; }
  const script = mergeDriverScript(driver);
  res.script = script;
  if (!script) { res.status = "other"; return res; }
  const norm = (p) => { const x = path.resolve(p).replace(/\\/g, "/"); return process.platform === "win32" ? x.toLowerCase() : x; };
  let exists = false;
  try { exists = fs.statSync(script).isFile(); } catch { exists = false; }
  if (!exists) { res.status = "missing"; return res; }
  let same = norm(script) === norm(cli);
  if (!same) { try { same = norm(fs.realpathSync(script)) === norm(fs.realpathSync(cli)); } catch { same = false; } }
  res.status = same ? "ok" : "other";
  return res;
}

// ---------------------------------------------------------------------------
// 1.25 — a feature's own git branch (spec_create {branch} / `create --branch [<name>]`). `.state.json → branch` = { name, base,
// commit, at }: the branch the feature started on, the branch HEAD named when it was recorded (null: a detached HEAD) and HEAD's
// commit then (null: a repository without a commit yet). The engine never runs git: the repository is READ as files — HEAD, the
// loose refs, packed-refs — as repoGitConfigText reads its config; the CLI hands what git itself says (createFeature's opts.git) and
// runs `git switch -c` after the record is written.
// ---------------------------------------------------------------------------
const BRANCH_PREFIX = { feature: "feature", change: "feature", bugfix: "fix", spike: "spike" }; // the default name: <prefix>/<slug>
const BRANCH_NAME_MAX = 200;
// A name handed to git AND to a shell unquoted (`git switch -c <name>` reads the same in sh, PowerShell and cmd.exe): letters,
// digits, '.', '_', '+', '-', '/' — then git's own rules for a branch (git check-ref-format --branch): no '..' or '//', no part
// starting with '.' or ending with '.lock', no leading '-' or '/', no trailing '/' or '.', not HEAD. → true when usable.
const RE_BRANCH_CHARS = /^[\p{L}\p{N}._+\/-]+$/u;
function branchNameOk(name) {
  if (typeof name !== "string" || !name || name.length > BRANCH_NAME_MAX || !RE_BRANCH_CHARS.test(name)) return false;
  if (name === "HEAD" || /^[-/]|[/.]$|\.\.|\/\//.test(name)) return false;
  return name.split("/").every((p) => p && !p.startsWith(".") && !/\.lock$/i.test(p));
}
const defaultBranchName = (kind, slug) => (own(BRANCH_PREFIX, kind) ? BRANCH_PREFIX[kind] : "feature") + "/" + slug;
const RE_GIT_SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
// The repository a project folder lies in (fs only): the nearest `.git` up from it — a folder, or a worktree's / submodule's `.git`
// FILE (`gitdir: <path>`, relative to its folder) — and its common dir (`<gitdir>/commondir`: a linked worktree's branches live
// there, its HEAD in its own gitdir). → { gitDir, commonDir } | null
function gitDirsOf(projectDir) {
  let dir = path.resolve(String(projectDir || "."));
  for (let k = 0; k < 64; k++) {
    const dotGit = path.join(dir, ".git");
    let st = null;
    try { st = fs.statSync(dotGit); } catch { st = null; }
    if (st) {
      let gitDir = dotGit;
      if (st.isFile()) {
        let m = null;
        try { m = /^gitdir:[ \t]*(.+?)[ \t]*$/m.exec(fs.readFileSync(dotGit, "utf8").slice(0, 4096)); } catch { m = null; }
        if (!m) return null;
        gitDir = path.resolve(dir, m[1]);
      }
      let commonDir = gitDir;
      try { commonDir = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, "commondir"), "utf8").trim()); } catch { commonDir = gitDir; }
      return { gitDir, commonDir };
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
// refs/heads/<name>'s commit as the files hold it: the loose ref, else its packed-refs line → the sha | null (none, or unreadable).
function gitHeadsSha(commonDir, name) {
  const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
  const loose = read(path.join(commonDir, "refs", "heads", ...name.split("/")));
  if (loose != null) return RE_GIT_SHA.test(loose.trim()) ? loose.trim() : null;
  const want = " refs/heads/" + name;
  for (const l of (read(path.join(commonDir, "packed-refs")) || "").split(/\r?\n/)) {
    if (l.endsWith(want) && RE_GIT_SHA.test(l.slice(0, l.length - want.length))) return l.slice(0, l.length - want.length);
  }
  return null;
}
// What the repository's FILES say (never git): null — no repository found — | { repo: true, base, commit, current, exists(name) }.
// base / current: the branch HEAD names (null: a detached HEAD, or one these files can't tell — a reftable repository's HEAD reads
// "refs/heads/.invalid"); commit: HEAD's (null: no commit yet, or unreadable); exists(name): refs/heads/<name> is there (null: can't
// tell — reftable, or a name git would refuse).
function gitRepoFacts(projectDir) {
  const g = gitDirsOf(projectDir);
  if (!g) return null;
  let head;
  try { head = fs.readFileSync(path.join(g.gitDir, "HEAD"), "utf8").trim(); } catch { return null; }
  const reftable = isDirSafe(path.join(g.commonDir, "reftable"));
  const m = /^ref:[ \t]*refs\/heads\/(.+)$/.exec(head);
  const base = m && !reftable && m[1] !== ".invalid" ? m[1] : null;
  const commit = RE_GIT_SHA.test(head) ? head : base && branchNameOk(base) ? gitHeadsSha(g.commonDir, base) : null;
  const exists = (name) => {
    if (reftable || !branchNameOk(name)) return null;
    try { if (fs.statSync(path.join(g.commonDir, "refs", "heads", ...name.split("/"))).isFile()) return true; } catch { /* not a loose ref */ }
    return gitHeadsSha(g.commonDir, name) != null;
  };
  return { repo: true, base, commit, current: base, exists };
}
// .state.json → branch, sanitized: { name, base, commit, at } | null (absent, or not a usable record — a hand edit).
function featureBranchRecord(state) {
  const b = isObj(state) ? state.branch : undefined;
  if (!isObj(b) || !branchNameOk(b.name)) return null;
  return { name: b.name, base: typeof b.base === "string" && b.base.trim() ? b.base : null,
    commit: typeof b.commit === "string" && RE_GIT_SHA.test(b.commit) ? b.commit : null, at: typeof b.at === "string" ? b.at : null };
}
// The record as status / next_action / finish show it, plus where the repository stands NOW (its files): current — the branch HEAD
// names (null: none or unknown) — and exists (false: the branch is not there — never created, or deleted since; null: can't tell).
// facts: what gitRepoFacts() said, when the caller has it. → null when the feature has no branch.
function branchView(projectDir, state, facts) {
  const rec = featureBranchRecord(state);
  if (!rec) return null;
  const f = facts !== undefined ? facts : gitRepoFacts(projectDir);
  const repo = !!(f && f.repo);
  return { ...rec, current: repo ? f.current || null : null, exists: repo && typeof f.exists === "function" ? f.exists(rec.name) : null };
}
// A feature's branch by its name (the CLI's `log` reads the base commit from it) → branchView() | null.
function featureBranch(projectDir, name) {
  const f = existingFeature(projectDir, name);
  return f.ok ? branchView(projectDir, readState(projectDir, f.slug)) : null;
}

module.exports = { normalizeLang, projectLang, featureLang, errs, slugify, slugifyFull, legacySlugify, RE_WIN_RESERVED,
  RESERVED_SLUGS, reservedSlug, resolveFeature, existingFeature, isFeatureFolder, PHASES, statePath, readState,
  stateFromFile, PHASE_FILE, textFingerprint, fingerprintText, wsText, wsFingerprint, sha1Hex, fingerprintMatches,
  BOM_CHAR, uncheckTasks, phaseFile, FEATURE_SIZES, sizeInput, featureSize, isChangeDir, PLANNING_CEILING, PHASE_PERCENT, phasePercent, featurePercent,
  roadmapPath, loadRoadmap, readRoadmap, roadmapError, writeRoadmap, findCycle, findCycles, setDependency, dependencyUnlocked,
  roadmap, flatText, specNameText, addBacklog, BACKLOG_NOTE_MAX, BACKLOG_NOTE_SEP, addBacklogUnlocked, removeBacklog, removeBacklogUnlocked, BACKLOG_ACTIONS, backlog,
  roadmapLang, roadmapChromeLang, setRoadmapLang, RE_AUTOGEN, isGeneratedOrAbsent, writeRoadmapMd, writeRoadmapHtml,
  writeRoadmapFile, maybeRefreshRoadmap, ROADMAP_STALE_FILE, markRoadmapStale, roadmapStale, clearRoadmapStale, refreshStaleRoadmap, staleGeneratedText,
  roadmapReport, featureDirs, locateFeatures,
  // 1.21 F1a — the spec state's git merge driver
  MERGE_DRIVER, MERGE_KINDS, MERGE_ATTRIBUTE_PATHS, MERGE_ATTRIBUTE_LINES, MERGE_CONFLICTS_KEY, mergeStateJson, mergeStateText,
  mergeKindOfPath, mergeAttributes, mergeConflictsCheck,
  // 1.21 review A3 — the installed driver still this clone's? (merge-state --check, the SessionStart hook)
  MERGE_DRIVER_KEY, gitConfigGet, mergeDriverScript, repoGitConfigText, mergeDriverStatus,
  // 1.25 — a feature's own git branch (create --branch): its name, the repository read as files, the record
  BRANCH_PREFIX, BRANCH_NAME_MAX, branchNameOk, defaultBranchName, gitDirsOf, gitRepoFacts, featureBranchRecord, branchView, featureBranch, __link };

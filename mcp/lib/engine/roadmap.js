"use strict";

/**
 * dev-spec-driven engine — roadmap.json: dependencies, backlog and the roadmap writers.
 * The roadmap store (read / validate / write under the roadmap lock), feature dependencies, the backlog, the
 * roadmap language and the generated-file guard (RE_AUTOGEN).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let errs, existingFeature, isObj, jsonRel, listFeatures, maybeRefreshCatalog, normalizeLang, positionPhase, projectLang,
  readIfExists, readJson, renderRoadmapHtml, renderRoadmapMd, resolveFeature, roadmapData, roadmapExtras, shapeError,
  slugify, specsRoot, withRoadmapLock, writeFileAtomic;
function __link(E) { ({ errs, existingFeature, isObj, jsonRel, listFeatures, maybeRefreshCatalog, normalizeLang,
  positionPhase, projectLang, readIfExists, readJson, renderRoadmapHtml, renderRoadmapMd, resolveFeature, roadmapData,
  roadmapExtras, shapeError, slugify, specsRoot, withRoadmapLock, writeFileAtomic } = E); }

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
function dependencyUnlocked(projectDir, name, dependsOn, order, edits) {
  edits = edits || {};
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
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
  if (order != null && !/^-?\d+$/.test(String(order).trim())) return { ok: false, error: D.orderInt(order) };
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
  if (order != null) rm.features[slug].order = parseInt(String(order).trim(), 10);
  writeRoadmap(projectDir, rm);
  return { ok: true, changed: true, feature: slug, dependsOn: finalDeps, order: rm.features[slug].order, unknownDeps: unknown };
}

function roadmap(projectDir) {
  const list = listFeatures(projectDir);
  if (!list.exists) return { ok: true, specsDir: list.specsDir, features: [], overallPercent: 0, complete: 0, total: 0, cycle: null, backlog: [] };
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
  const cycle = findCycle(Object.fromEntries(feats.map((f) => [f.name, f.dependsOn])));
  const overall = feats.length ? Math.round(feats.reduce((s, f) => s + f.percent, 0) / feats.length) : 0;
  const backlog = readRoadmap(projectDir).backlog || [];
  return { ok: true, specsDir: list.specsDir, features: feats, cycle: cycle || null, overallPercent: overall, complete: feats.filter((f) => f.percent === 100).length, total: feats.length, backlog };
}

// ---------------------------------------------------------------------------
// Backlog — planned features that don't have a .specs/<feature>/ folder yet
// ---------------------------------------------------------------------------

// One line: a line break in a backlog name or note became markdown structure (a heading) in ROADMAP.md and the export.
const flatText = (s) => String(s || "").replace(/\s+/g, " ").trim();
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
function addBacklogUnlocked(projectDir, nm, note) {
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  const rm = readRoadmap(projectDir);
  rm.backlog = rm.backlog || [];
  if (!rm.backlog.some((b) => b.name.toLowerCase() === nm.toLowerCase())) rm.backlog.push({ name: nm, note: flatText(note) });
  writeRoadmap(projectDir, rm);
  return { ok: true, backlog: rm.backlog };
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

const BACKLOG_ACTIONS = ["add", "rm", "remove", "list"]; // = the spec_backlog enum (server.js reads it from here)
function backlog(projectDir, action, name, note) {
  const a = String(action == null ? "" : action).trim().toLowerCase(); // 'ADD' is add on every surface (the MCP enum folds it too)
  if (a === "add") return addBacklog(projectDir, name, note);
  // "remove" is an alias of "rm" on EVERY surface (the spec_backlog enum lists it too) — it used to be a CLI-only alias,
  // then refused everywhere while the docs still named it.
  if (a === "rm" || a === "remove") return removeBacklog(projectDir, name);
  // Absent/"list" lists; anything else is an error (the MCP enum refuses it) — `backlog delete X` used to just list.
  if (a && a !== "list") {
    const A = i18n.msg(projectLang(projectDir)).args;
    return { ok: false, error: A.invalid(A.item("action", A.oneOf(BACKLOG_ACTIONS.join(", ")), JSON.stringify(String(action)))) };
  }
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
  if (lang) {
    const saved = withRoadmapLock(projectDir, () => {
      const bad = roadmapError(projectDir); // persisting roadmapLang writes roadmap.json: refuse on a broken one
      return bad ? { ok: false, error: bad } : setRoadmapLang(projectDir, lang, "roadmapLang");
    });
    if (!saved.ok) return saved;
  }
  const d = data || roadmapData(projectDir);
  writeFileAtomic(file, render(projectDir, lang || roadmapChromeLang(projectDir), d));
  const rmv = d.rmv;
  return { ok: true, file, overallPercent: rmv.overallPercent, complete: rmv.complete, total: rmv.total };
}

// Keep the roadmap current after any mutation. MD is the default (always); HTML only if it exists.
// Best-effort — never breaks the primary operation.
function maybeRefreshRoadmap(projectDir) {
  try {
    const root = specsRoot(projectDir);
    if (!fs.existsSync(root)) return;
    const html = fs.existsSync(path.join(root, "ROADMAP.html"));
    // One computation for both files — none when neither may be written (hand-written ROADMAP.md, no HTML).
    const data = isGeneratedOrAbsent(path.join(root, "ROADMAP.md")) || (html && isGeneratedOrAbsent(path.join(root, "ROADMAP.html"))) ? roadmapData(projectDir) : undefined;
    writeRoadmapMd(projectDir, undefined, data);
    if (html) writeRoadmapHtml(projectDir, undefined, data);
    maybeRefreshCatalog(projectDir); // .specs/SPECS.md — only once it exists (and is generated)
  } catch {
    /* best-effort */
  }
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
      if (h.ok) wrote.push(h.file); else warnings.push(h.error);
    }
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

module.exports = { PLANNING_CEILING, PHASE_PERCENT, phasePercent, featurePercent, roadmapPath, loadRoadmap, readRoadmap,
  roadmapError, writeRoadmap, findCycle, setDependency, dependencyUnlocked, roadmap, flatText, addBacklog,
  addBacklogUnlocked, removeBacklog, removeBacklogUnlocked, BACKLOG_ACTIONS, backlog, roadmapLang, roadmapChromeLang,
  setRoadmapLang, RE_AUTOGEN, isGeneratedOrAbsent, writeRoadmapMd, writeRoadmapHtml, writeRoadmapFile,
  maybeRefreshRoadmap, roadmapReport, __link };

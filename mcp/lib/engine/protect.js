"use strict";

/**
 * dev-spec-driven engine — protected tests (1.36: roadmap.json meta.guard "tests" — off < on < scope < tests).
 * At level tests the scope guard also protects TESTS, file by file, in each feature's .state.json `protectedTests` (a file only
 * the approval guard keeps agents from editing): { at, via (approval | protect), files: {"<rel>": "<16 hex>" | null}, truncated?,
 * lifts: [{file, at, by, reason, confirmed?} | {file, at, by, revoked: true}] }.
 *   · the snapshot — the test files present at the feature's FIRST complete tasks approval (walked and hashed BEFORE the feature lock:
 *     protectWalkFirst, the facade's approvePhase), at most PROTECT_MAX_FILES (`truncated` past them); `feature protect` adds the files
 *     present now — ADD-ONLY: a recorded entry keeps its hash (no laundering);
 *   · the tick record — a tick at level tests re-baselines the test files its task names EXACTLY in _Implements:_ (planned: their hash
 *     now is the authorised one) and adds the test files its _Verify:_ runs; an untick never removes one;
 *   · the decision (guardCheck) — an edit, removal or move of a listed test asks (deny under meta.approvalGuard deny) unless a task
 *     that can start now names it EXACTLY in _Implements:_, or a lift is in force (`feature unprotect` — the user's, a guard-down);
 *   · spec_finish re-hashes the list: a change no recorded hash and no lift explains is a warning (never a blocker); doctor warns
 *     protected-tests.
 * Known limits (docs/maintainers/tasks-and-evidence.md → Protected tests): tests under SCAN_IGNORE / hidden / linked folders or outside
 * the project folder and past the cap are not listed; new test-support files stay editable; a git command or a script is not read.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let approvalCommand, approvalGuardLevel, confirmationOf, dayOf, existingFeature, featureDirs, featureLang, featureLocked, fileHash,
  FOLD_CASE, globMatcher, guardLevel, implementsRel, insideDirAlias, isCodeFile, isImplementsGlob, isObj, isTestFile, projectLang,
  readJson, readState, readyTasks, reasonInput, statePath, taskMarkers, walkProject, writeFileAtomic;
function __link(E) { ({ approvalCommand, approvalGuardLevel, confirmationOf, dayOf, existingFeature, featureDirs, featureLang, featureLocked,
  fileHash, FOLD_CASE, globMatcher, guardLevel, implementsRel, insideDirAlias, isCodeFile, isImplementsGlob, isObj, isTestFile, projectLang,
  readJson, readState, readyTasks, reasonInput, statePath, taskMarkers, walkProject, writeFileAtomic } = E); }

const PROTECT_MAX_FILES = 2000; // test files a snapshot records, at most (past them: `truncated` — doctor warns)
const PROTECT_HASH_HEX = 16; // a file's content hash as recorded: fileHash's sha1 (CRLF-normalized), shortened
const PROTECT_WARN_FILES = 5; // the unexplained files finish's warning names (then "and N more")
const fold = (s) => (FOLD_CASE ? String(s).toLowerCase() : String(s));
const isTest = (rel) => isCodeFile(rel) && isTestFile(rel);
const hash16 = (abs) => { const h = fileHash(abs); return h ? h.slice(0, PROTECT_HASH_HEX) : null; };
const userName = () => process.env.USER || process.env.USERNAME || "user"; // approvePhase's default `by`
// A feature's list as .state.json holds it — guardCheck reads that file raw, so a malformed shape is no list (never a throw).
function listOf(state) {
  const pt = isObj(state) ? state.protectedTests : null;
  if (!isObj(pt)) return null;
  return { at: typeof pt.at === "string" ? pt.at : null, via: typeof pt.via === "string" ? pt.via : null, files: isObj(pt.files) ? pt.files : {},
    truncated: pt.truncated === true, lifts: Array.isArray(pt.lifts) ? pt.lifts.filter(isObj) : [] };
}
// A path a task, a command or a call names → its project-relative spelling (an absolute one inside the project, through an alias
// too), else null (outside, `..` out of it, empty).
function projectRel(root, p) {
  if (typeof p !== "string" || !p.trim()) return null;
  const s = p.trim().replace(/\\/g, "/");
  const abs = path.isAbsolute(s) ? insideDirAlias(root, path.resolve(s)) : path.resolve(root, s);
  if (!abs) return null;
  const rel = path.relative(root, abs).split(path.sep).join("/");
  return rel && !/^\.\.(?:\/|$)/.test(rel) ? rel : null;
}
// The test files a _Verify:_ command names: its words, quotes and backticks off, a pytest `::node` / a `:line[:col]` suffix off,
// never a glob (a word naming no file records nothing: its hash is null).
function verifyTestPaths(cmd) {
  const out = [];
  for (const raw of String(cmd).split(/\s+/)) {
    const w = raw.replace(/^["'`(]+|["'`;,)]+$/g, "").replace(/::.*$/, "").replace(/:\d+(?::\d+)?$/, "").replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
    if (w && !/[*?{]/.test(w) && isTest(w)) out.push(w);
  }
  return out;
}

// The test files present now — the project's (walkProject: hidden and SCAN_IGNORE folders skipped, links never followed) and each
// live feature's .specs/<f>/tests/ (its failing tests, scanTestCode's loop) — hashed, at most PROTECT_MAX_FILES. Run OUTSIDE any lock
// (a walk of up to the scan's entry cap). → { files: {rel: hash | null}, truncated }
function protectWalk(projectDir) {
  const root = path.resolve(projectDir);
  const files = Object.create(null);
  let n = 0;
  const w = walkProject(root, PROTECT_MAX_FILES, (rel, full) => { if (isTest(rel)) { files[rel] = hash16(full); n++; } }, { counts: isTest });
  let truncated = w.truncated;
  for (const f of featureDirs(projectDir)) {
    if (f.archived) continue;
    const tdir = path.join(f.dir, "tests");
    try { if (!fs.lstatSync(tdir).isDirectory()) continue; } catch { continue; } // a linked tests/ is never followed
    const pre = path.relative(root, tdir).split(path.sep).join("/") + "/";
    const tw = walkProject(tdir, PROTECT_MAX_FILES - n, (rel, full) => { if (isTest(pre + rel)) { files[pre + rel] = hash16(full); n++; } }, { counts: (rel) => isTest(pre + rel) });
    truncated = truncated || tw.truncated;
  }
  return { files, truncated };
}
// `walk` added to a feature's list, ADD-ONLY: an entry already recorded keeps its hash (a protect run never launders a weakened test);
// the first snapshot's `at` / `via` stay, the rest of the record (its lifts) too. → { list, added }
function withWalk(pt, walk, via) {
  const cur = listOf({ protectedTests: pt }) || { at: null, via: null, files: {}, truncated: false };
  const files = Object.create(null);
  const seen = new Set();
  for (const k of Object.keys(cur.files)) { files[k] = cur.files[k]; seen.add(fold(k)); }
  let added = 0, truncated = cur.truncated || walk.truncated;
  for (const k of Object.keys(walk.files)) {
    if (seen.has(fold(k))) continue;
    if (seen.size >= PROTECT_MAX_FILES) { truncated = true; break; }
    files[k] = walk.files[k];
    seen.add(fold(k));
    added++;
  }
  const list = Object.assign({}, isObj(pt) ? pt : {}, { at: cur.at || new Date().toISOString(), via: cur.via || via, files });
  if (truncated) list.truncated = true;
  return { list, added };
}

// The facade's approvePhase (mcp/lib/spec.js): when the call may be a feature's first complete tasks approval at level tests, the test
// files are walked and hashed HERE, before the feature lock is taken (a walk of seconds held it: a concurrent call answered busy), and
// handed to approvePhase as opts.protectWalk — never a tool argument — which merges them under the lock (protectOnApproval).
function protectWalkFirst(fn) {
  const run = function (projectDir, name, phase, by, opts) {
    const o = isObj(opts) ? opts : {};
    const target = String(o.through != null ? o.through : phase == null ? "" : phase).trim().toLowerCase();
    if (target !== "tasks" || o.revoke === true || o.dryRun === true || guardLevel(projectDir) !== "tests") return fn.apply(this, arguments);
    const f = existingFeature(projectDir, name);
    if (!f.ok || (listOf(readJson(statePath(f.dir)).data) || {}).at) return fn.apply(this, arguments);
    return fn.call(this, projectDir, name, phase, by, Object.assign({}, o, { protectWalk: protectWalk(projectDir) }));
  };
  Object.defineProperty(run, "name", { value: fn.name });
  return run;
}
// approvePhase (gates.js), under the feature lock, on a complete tasks approval: the FIRST one at level tests (a walk was made)
// records the snapshot; a later one (a re-approval, a revoke and approve again) keeps it. Changes `state` in place (written with the
// approval). → {count, at, truncated?} for the result, or null.
function protectOnApproval(state, walk) {
  const cur = listOf(state);
  if (!walk || (cur && cur.at)) return null;
  const { list } = withWalk(state.protectedTests, walk, "approval");
  state.protectedTests = list;
  return Object.assign({ count: Object.keys(list.files).length, at: list.at }, list.truncated ? { truncated: true } : {});
}
// …its note (the approval's result).
const protectApprovalNote = (snap, lng) => i18n.msg(lng).protectedTests.snapshotNote(snap.count, snap.truncated ? PROTECT_MAX_FILES : 0);
// completeTask (tasks.js), under the feature lock, when the call TICKS a task at level tests: the test files its task names EXACTLY in
// _Implements:_ are re-baselined (planned — their content now is the authorised one) and the test files its _Verify:_ runs join the
// list when absent. An untick never removes one. Changes `state` in place (written with the tick).
function protectOnTick(projectDir, state, task) {
  if (guardLevel(projectDir) !== "tests") return;
  const root = path.resolve(projectDir);
  const m = taskMarkers(task);
  const planned = new Set(), ran = new Set();
  for (const ref of m.implements) { const r = projectRel(root, implementsRel(ref)); if (r && !isImplementsGlob(r) && isTest(r)) planned.add(r); }
  for (const cmd of m.verify) for (const w of verifyTestPaths(cmd)) { const r = projectRel(root, w); if (r && isTest(r)) ran.add(r); }
  if (!planned.size && !ran.size) return;
  const pt = isObj(state.protectedTests) ? state.protectedTests : (state.protectedTests = {});
  const files = isObj(pt.files) ? pt.files : (pt.files = {});
  const keyOf = new Map(Object.keys(files).map((k) => [fold(k), k]));
  for (const r of planned) files[keyOf.get(fold(r)) || r] = hash16(path.join(root, r));
  for (const r of ran) {
    if (keyOf.has(fold(r)) || planned.has(r)) continue;
    const h = hash16(path.join(root, r));
    if (h) files[r] = h;
  }
}
// The number of test files a feature's list holds (the brief's definition-of-done line).
const protectedCount = (state) => { const pt = listOf(state); return pt ? Object.keys(pt.files).length : 0; };

// The lifts in force across these states, by file (folded): each file's LATEST record (by `at`, then list order) — a lift until a
// `protect <file>` record (revoked) follows it, in any feature. → Map(fold(file) → its lift record)
function activeLifts(states) {
  const last = new Map();
  for (const st of states) {
    const pt = listOf(st);
    if (!pt) continue;
    for (const l of pt.lifts) {
      if (typeof l.file !== "string") continue;
      const k = fold(l.file);
      const t = Number.isFinite(Date.parse(l.at)) ? Date.parse(l.at) : -Infinity;
      const prev = last.get(k);
      if (!prev || t >= prev.t) last.set(k, { t, rec: l });
    }
  }
  const out = new Map();
  for (const [k, v] of last) if (v.rec.revoked !== true) out.set(k, v.rec);
  return out;
}
// Every live (non-archived) feature's .state.json, read raw (listOf tolerates any shape).
const liveStates = (projectDir) => featureDirs(projectDir).filter((f) => !f.archived).map((f) => readJson(statePath(f.dir)).data);

// guardCheck (guards.js) at level tests — BEFORE its stale / tests-phase / spike / scope answers: is the target a listed test of an
// unfinished feature (ctx.holders — every feature with open tasks: covering, forced, stale or pending), a folder holding one, or a
// glob in its last segment matching one (or a folder holding one)? → null when none, or when every one is lifted (a lift in force of
// any feature: ctx.states) or named EXACTLY in the _Implements:_ of a task that can start now (readyTasks) of a covering or forced
// feature (ctx.unlockers — a folder, a glob or _Makes green:_ never unlocks); else ask — deny under meta.approvalGuard deny, with the
// user's line (userNote: the lift command). ctx.blocks: each feature's active task blocks, parsed once by guardCheck.
function protectedTestDecision(pdir, abs, rel, ctx) {
  const key = fold(rel);
  const glob = /[*?[]/.test(key.slice(key.lastIndexOf("/") + 1));
  const file = !glob && isTest(rel);
  let dir = false;
  if (!file && !glob) { try { dir = fs.lstatSync(abs).isDirectory(); } catch { dir = false; } }
  if (!file && !glob && !dir) return null;
  const m = glob ? globMatcher(key) : null;
  const hits = file ? (p) => p === key : glob ? (p) => { for (let q = p; q; q = q.slice(0, Math.max(0, q.lastIndexOf("/")))) if (m(q)) return true; return false; }
    : (p) => key === "" || p.startsWith(key + "/");
  const found = [], seen = new Set();
  for (const name of ctx.holders) {
    const pt = listOf(ctx.states.get(name));
    if (!pt) continue;
    for (const p of Object.keys(pt.files)) {
      const k = fold(p);
      if (!seen.has(k) && hits(k)) { seen.add(k); found.push({ file: p, key: k, feature: name, at: pt.at }); }
    }
  }
  if (!found.length) return null;
  const lifted = activeLifts([...ctx.states.values()]);
  const root = path.resolve(pdir);
  const unlocked = new Set(), current = [];
  for (const name of ctx.unlockers) {
    const blocks = ctx.blocks.get(name) || [];
    const ready = new Set(readyTasks(blocks));
    for (const b of blocks) {
      if (b.done || !ready.has(b.number)) continue;
      current.push({ feature: name, number: b.number });
      for (const ref of taskMarkers(b).implements) { const r = projectRel(root, implementsRel(ref)); if (r) unlocked.add(fold(r)); } // a folder / glob never equals a file
    }
  }
  const blocking = found.filter((x) => !lifted.has(x.key) && !unlocked.has(x.key));
  if (!blocking.length) return null;
  const P = i18n.msg(projectLang(pdir)).protectedTests;
  const first = blocking[0];
  const shown = rel || ".";
  const why = file ? P.whyFile(first.feature, first.at ? dayOf(first.at) : "") : P.whyFolder(blocking.length, first.file);
  const cur = current.length ? P.current(current.slice(0, 4).map((t) => `${t.number} (${t.feature})`).join(", ") + (current.length > 4 ? ", …" : "")) : P.noCurrent;
  const lift = approvalCommand({ kind: "guard-down", setting: "unprotect", feature: first.feature, file: first.file }, i18n.DEV_SPEC_SCRIPT);
  const deny = approvalGuardLevel(pdir) === "deny";
  const res = { guard: true, level: "tests", decision: deny ? "deny" : "ask", why: "protected-test", file: shown, feature: first.feature,
    protected: blocking.slice(0, PROTECT_WARN_FILES).map((x) => x.file), current,
    reason: deny ? P.deny(shown, why) : P.ask(shown, why, cur, current.length ? P.planHint(current[0].number, current[0].feature) : "", lift) };
  if (deny) res.userNote = P.denyUser(shown, "! " + lift);
  return res;
}

// spec_feature {action: "protect" | "unprotect"} / `dev-spec feature protect|unprotect` (finish.js manageFeature):
//   protect <f>            the test files present now join the feature's list — walked before the lock, ADD-ONLY (a recorded entry
//                          keeps its hash); a list without a snapshot gets one (`at`, via "protect");
//   protect <f> <file>     that file's lift ends (a `revoked` record, when one is in force in any feature) and it joins the list when absent;
//   unprotect <f> <file>   lifts its protection — the user's decision (an agent's call is a guard-down of the approval guard): a record
//                          {file, at, by, reason, confirmed?}; `reason` required (one line, ≤ 500). opts.dryRun: the checks only (the
//                          MCP server asks the user after them); opts.confirmation: the user's answer over elicitation.
// → { ok, feature, action, … } — refusals carry a stable `code`: file-required · reason-required · not-a-test · outside-project.
function protectTests(projectDir, action, name, file, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error, code: f.code };
  const lng = featureLang(projectDir, f.slug);
  const P = i18n.msg(lng).protectedTests;
  let rel = null;
  if (typeof file === "string" && file.trim()) {
    rel = projectRel(path.resolve(projectDir), file);
    if (!rel) return { ok: false, code: "outside-project", error: P.err.outside(file.trim()) };
    if (/[*?[]/.test(rel) || !isTest(rel)) return { ok: false, code: "not-a-test", error: P.err.notATest(rel) };
  }
  if (action === "unprotect") {
    if (!rel) return { ok: false, code: "file-required", error: P.err.fileRequired };
    const r = reasonInput(opts.reason, lng);
    if (r.error) return { ok: false, code: "invalid-arguments", invalid: ["reason"], error: r.error };
    if (!r.value) return { ok: false, code: "reason-required", error: P.err.reasonRequired };
    if (opts.dryRun === true) return { ok: true, dryRun: true, feature: f.slug, action, file: rel, reason: r.value };
    return featureLocked(protectLocked)(projectDir, f.slug, { action, rel, reason: r.value, confirmation: opts.confirmation, lng });
  }
  if (opts.dryRun === true) return { ok: true, dryRun: true, feature: f.slug, action, ...(rel ? { file: rel } : {}) };
  return featureLocked(protectLocked)(projectDir, f.slug, { action, rel, walk: rel ? null : protectWalk(projectDir), lng });
}
function protectLocked(projectDir, slug, o) {
  const f = existingFeature(projectDir, slug);
  if (!f.ok) return { ok: false, error: f.error, code: f.code };
  const state = readState(projectDir, f.slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const P = i18n.msg(o.lng).protectedTests;
  const at = new Date().toISOString();
  const listed = () => { const pt = listOf(state); return !!pt && Object.keys(pt.files).some((k) => fold(k) === fold(o.rel)); };
  if (o.action === "unprotect") {
    const pt = isObj(state.protectedTests) ? state.protectedTests : (state.protectedTests = { files: {} });
    const rec = { file: o.rel, at, by: userName(), reason: o.reason };
    const conf = confirmationOf(o.confirmation); // the user confirmed it in the MCP client (elicitation)
    if (conf) rec.confirmed = conf;
    pt.lifts = (Array.isArray(pt.lifts) ? pt.lifts : []).concat([rec]);
    writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
    return { ok: true, feature: f.slug, action: "unprotect", lifted: rec, listed: listed(), note: P.lifted(o.rel, f.slug, listed()) };
  }
  let added = 0, unlifted = null;
  if (o.walk) {
    const w = withWalk(state.protectedTests, o.walk, "protect");
    state.protectedTests = w.list;
    added = w.added;
  } else {
    const pt = isObj(state.protectedTests) ? state.protectedTests : (state.protectedTests = { files: {} });
    if (activeLifts(liveStates(projectDir).concat([state])).has(fold(o.rel))) {
      pt.lifts = (Array.isArray(pt.lifts) ? pt.lifts : []).concat([{ file: o.rel, at, by: userName(), revoked: true }]);
      unlifted = o.rel;
    }
    if (!listed()) {
      if (!isObj(pt.files)) pt.files = {};
      pt.files[o.rel] = hash16(path.join(path.resolve(projectDir), o.rel));
      added = 1;
    }
  }
  writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
  const pt = listOf(state);
  const inForce = activeLifts(liveStates(projectDir).concat([state])); // as the guard reads them: any feature's later record ends a lift
  const inForceIs = (l) => { const a = inForce.get(fold(l.file)); return !!a && a.at === l.at && a.by === l.by; };
  const lifts = pt.lifts.map((l) => Object.assign({ file: l.file, at: l.at, by: l.by }, l.revoked === true ? { revoked: true } : { reason: l.reason, active: inForceIs(l) }));
  const count = Object.keys(pt.files).length;
  const note = [P.listNote(f.slug, count, pt.at ? dayOf(pt.at) : "", P.via[pt.via] || "", added), unlifted ? P.unlifted(unlifted) : null,
    pt.truncated ? P.truncated(PROTECT_MAX_FILES) : null, guardLevel(projectDir) === "tests" ? null : P.notEnforced].filter(Boolean).join(" ");
  return { ok: true, feature: f.slug, action: "protect", protectedTests: Object.assign({ at: pt.at, via: pt.via, count, added }, pt.truncated ? { truncated: true } : {}),
    lifts, ...(unlifted ? { unlifted } : {}), note };
}

// spec_finish: the feature's list hashed again. A file whose content now matches NO hash a live feature recorded for it (a snapshot,
// a tick) and that no lift in force (of any feature) covers is unexplained — changed or deleted; a lift in force explains a change
// (`lifted`). → { count, unexplained: [{file, status}], lifted: [{file, by, at, reason}] } | null (no list) — a warning and the merge
// summary's block, never a blocker.
function protectedTestsFinish(projectDir, state) {
  const own = listOf(state);
  if (!own || !Object.keys(own.files).length) return null;
  const root = path.resolve(projectDir);
  const states = liveStates(projectDir).concat([state]);
  const recorded = new Map();
  for (const st of states) {
    const pt = listOf(st);
    if (pt) for (const k of Object.keys(pt.files)) { const fk = fold(k); if (!recorded.has(fk)) recorded.set(fk, new Set()); recorded.get(fk).add(pt.files[k]); }
  }
  const lifts = activeLifts(states);
  const unexplained = [], lifted = [];
  for (const k of Object.keys(own.files)) {
    const now = hash16(path.join(root, k));
    if (recorded.get(fold(k)).has(now)) continue;
    const l = lifts.get(fold(k));
    if (l) lifted.push({ file: k, by: l.by, at: l.at, reason: l.reason });
    else unexplained.push({ file: k, status: now == null ? "deleted" : "changed" });
  }
  return { count: Object.keys(own.files).length, unexplained, lifted };
}
// …its warning (null when nothing is unexplained) and its merge-summary lines.
function protectedFinishWarning(pt, slug, lng) {
  if (!pt || !pt.unexplained.length) return null;
  const P = i18n.msg(lng).protectedTests;
  const items = pt.unexplained.slice(0, PROTECT_WARN_FILES).map((x) => P[x.status](x.file));
  return P.finishWarn(slug, items.join(", "), Math.max(0, pt.unexplained.length - PROTECT_WARN_FILES));
}
function protectedSummaryLines(pt, lng) {
  const P = i18n.msg(lng).protectedTests;
  return [P.summaryHead, P.summaryLine(pt.count, pt.unexplained.length), ...pt.unexplained.map((x) => "- " + P[x.status](x.file)),
    ...pt.lifted.map((l) => P.summaryLift(l.file, l.by, l.reason))];
}

// doctor protected-tests (warn) — level tests, a feature with approved, open tasks: no snapshot (feature protect takes one), a truncated
// one, the approval guard off (the list lives in .state.json, which only that guard keeps agents from editing). → verdict | null
function protectedTestsDoctor(projectDir, slug, state, lng) {
  const P = i18n.msg(lng).protectedTests;
  const pt = listOf(state);
  const issues = [];
  if (!pt || !pt.at) issues.push(P.doctorMissing(slug));
  else if (pt.truncated) issues.push(P.truncated(PROTECT_MAX_FILES));
  if (approvalGuardLevel(projectDir) === "off") issues.push(P.unguarded);
  return issues.length ? { status: "warn", detail: issues.join(" ") } : null;
}

module.exports = { protectWalkFirst, protectOnApproval, protectApprovalNote, protectOnTick, protectedCount, protectedTestDecision,
  protectTests, protectedTestsFinish, protectedFinishWarning, protectedSummaryLines, protectedTestsDoctor, __link };

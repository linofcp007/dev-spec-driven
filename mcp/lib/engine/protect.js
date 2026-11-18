"use strict";

/**
 * dev-spec-driven engine — protected tests (1.36: roadmap.json meta.guard "tests" — off < on < scope < tests).
 * At level tests the scope guard also protects TESTS, file by file, in each feature's .state.json `protectedTests` (a file only
 * the approval guard keeps agents from editing): { at, via (approval | protect), files: {"<rel>": "<16 hex>" | null}, truncated?,
 * lifts: [{file, at, by, reason, confirmed?} | {file, at, by, revoked: true} | {file, at, by, reason, accepted: true, confirmed?}] }.
 *   · the snapshot — the test files present at the feature's FIRST complete tasks approval (walked and hashed BEFORE the feature lock:
 *     protectWalkFirst, the facade's approvePhase — the features' .specs/<f>/tests/ first, its own first), at most PROTECT_MAX_FILES
 *     (`truncated` past them), marked via "approval"; `feature protect` adds the files present now — ADD-ONLY: a recorded entry keeps
 *     its hash, and a file another live feature lists joins with that feature's hash (no laundering);
 *   · the tick record — a task's FIRST tick at level tests re-baselines the test files it names EXACTLY in _Implements:_ (planned: their
 *     hash now is the authorised one) and adds the test files its _Verify:_ runs; an untick never removes one, a re-tick keeps them;
 *   · the decision (guardCheck) — an edit, removal or move of a listed test (its real path, a glob anywhere, any case where the file
 *     system folds it) of an unfinished feature asks (deny under meta.approvalGuard deny) unless a task that can start now — never a
 *     reopened one — names it EXACTLY in _Implements:_, or a lift is in force (`feature unprotect` — the user's, a guard-down; in force
 *     until a later `protect <file>` record of any feature);
 *   · the accept — `feature protect <f> <file> --accept --reason` (the user's, a guard-down): the file's hash NOW becomes the authorised
 *     one in that feature's list (a re-baseline), its lift ends, and an accept record keeps the reason (the merge summary shows it);
 *   · spec_finish re-hashes the list (before the feature lock: protectHashFirst): a change no recorded hash and no lift in force explains
 *     is a warning (never a blocker) that advises the accept; doctor warns protected-tests (a lift still in force after its finish too).
 * Known limits (docs/maintainers/tasks-and-evidence.md → Protected tests): tests under SCAN_IGNORE / hidden / linked folders or outside
 * the project folder and past the cap are not listed; new test-support files stay editable; a git command or a script is not read; an
 * archived feature's list and lifts are not read; a tick record is keyed by the task's number (a re-plan that renumbers the tasks
 * gives an open task a ticked number); a glob through a link or junction is matched as typed (its real path is not read); a lift lasts
 * until a `protect <file>` record — its feature's finish never ends it (doctor warns).
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
let portHeldNumbers, detectTracks, specsRoot, evidenceRule; // port.js · tracks.js · core.js · evidence.js — a task +port's fence holds
function __link(E) { ({ approvalCommand, approvalGuardLevel, confirmationOf, dayOf, existingFeature, featureDirs, featureLang, featureLocked,
  fileHash, FOLD_CASE, globMatcher, guardLevel, implementsRel, insideDirAlias, isCodeFile, isImplementsGlob, isObj, isTestFile, projectLang,
  readJson, readState, readyTasks, reasonInput, statePath, taskMarkers, walkProject, writeFileAtomic,
  portHeldNumbers, detectTracks, specsRoot, evidenceRule } = E); }

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

// The test files present now — each live feature's .specs/<f>/tests/ (its failing tests, scanTestCode's loop) FIRST, `first`'s (the
// approving / protecting feature's slug) before the others, then the project's (walkProject: hidden and SCAN_IGNORE folders skipped,
// links never followed) — hashed, at most PROTECT_MAX_FILES (1.36.0 review 1: the project walked first filled the cap in a repo with
// 2,000+ tests, and the feature's own red tests were never listed). Run OUTSIDE any lock (a walk of up to the scan's entry cap).
// → { files: {rel: hash | null}, truncated }
function protectWalk(projectDir, first) {
  const root = path.resolve(projectDir);
  const files = Object.create(null);
  let n = 0, truncated = false;
  const feats = featureDirs(projectDir).filter((f) => !f.archived);
  for (const f of feats.filter((x) => x.slug === first).concat(feats.filter((x) => x.slug !== first))) {
    const tdir = path.join(f.dir, "tests");
    try { if (!fs.lstatSync(tdir).isDirectory()) continue; } catch { continue; } // a linked tests/ is never followed
    const pre = path.relative(root, tdir).split(path.sep).join("/") + "/";
    const tw = walkProject(tdir, PROTECT_MAX_FILES - n, (rel, full) => { if (isTest(pre + rel)) { files[pre + rel] = hash16(full); n++; } }, { counts: (rel) => isTest(pre + rel) });
    truncated = truncated || tw.truncated;
  }
  const w = walkProject(root, PROTECT_MAX_FILES - n, (rel, full) => { if (isTest(rel)) { files[rel] = hash16(full); n++; } }, { counts: isTest });
  return { files, truncated: truncated || w.truncated };
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
// "Already snapshotted" is the approval's own mark, via "approval" — never `at`, which a `feature protect` run before the approval sets
// too (1.36.0 review 1: the approval then recorded nothing, and the tests written after the protect were never listed).
const snapshotted = (pt) => !!pt && pt.via === "approval";
function protectWalkFirst(fn) {
  const run = function (projectDir, name, phase, by, opts) {
    const o = isObj(opts) ? opts : {};
    const target = String(o.through != null ? o.through : phase == null ? "" : phase).trim().toLowerCase();
    if (target !== "tasks" || o.revoke === true || o.dryRun === true || guardLevel(projectDir) !== "tests") return fn.apply(this, arguments);
    const f = existingFeature(projectDir, name);
    if (!f.ok || snapshotted(listOf(readJson(statePath(f.dir)).data))) return fn.apply(this, arguments);
    return fn.call(this, projectDir, name, phase, by, Object.assign({}, o, { protectWalk: protectWalk(projectDir, f.slug) }));
  };
  Object.defineProperty(run, "name", { value: fn.name });
  return run;
}
// approvePhase (gates.js), under the feature lock, on a complete tasks approval: the FIRST one at level tests (a walk was made)
// records the snapshot — merged ADD-ONLY into a list `feature protect` or a lift began (its hashes kept), then marked via "approval";
// a later one (a re-approval, a revoke and approve again) keeps it. Changes `state` in place (written with the approval).
// → {count, at, truncated?} for the result, or null.
function protectOnApproval(state, walk) {
  if (!walk || snapshotted(listOf(state))) return null;
  const { list } = withWalk(state.protectedTests, walk, "approval");
  list.via = "approval";
  state.protectedTests = list;
  return Object.assign({ count: Object.keys(list.files).length, at: list.at }, list.truncated ? { truncated: true } : {});
}
// …its note (the approval's result).
const protectApprovalNote = (snap, lng) => i18n.msg(lng).protectedTests.snapshotNote(snap.count, snap.truncated ? PROTECT_MAX_FILES : 0);
// A task's tick record (1.36.0 review 1): its tick stamped (ticks[n] — a box unchecked by hand keeps it) or undone (an `unticks` entry:
// the untick drops ticks[n]). Reopened, such a task no longer unlocks its _Implements:_ tests (an untick or a hand-uncheck made the red
// test editable again, and the re-tick recorded the weakened content), and its re-tick re-baselines no file already recorded.
const tickRecorded = (st, n) => isObj(st) && ((isObj(st.ticks) && Object.prototype.hasOwnProperty.call(st.ticks, String(n))) ||
  (Array.isArray(st.unticks) && st.unticks.some((u) => isObj(u) && String(u.n) === String(n))));
// completeTask (tasks.js), under the feature lock, when the call TICKS a task at level tests — BEFORE it stamps ticks[n]: the test files
// its task names EXACTLY in _Implements:_ are re-baselined at its FIRST tick (planned — their content now is the authorised one; a
// re-tick after an untick keeps a recorded hash, so finish names an edit made meanwhile) and the test files its _Verify:_ runs join the
// list when absent. An untick never removes one. Changes `state` in place (written with the tick).
function protectOnTick(projectDir, state, task) {
  if (guardLevel(projectDir) !== "tests") return;
  const root = path.resolve(projectDir);
  const m = taskMarkers(task);
  const planned = new Set(), ran = new Set();
  for (const ref of m.implements) { const r = projectRel(root, implementsRel(ref)); if (r && !isImplementsGlob(r) && isTest(r)) planned.add(r); }
  for (const cmd of m.verify) for (const w of verifyTestPaths(cmd)) { const r = projectRel(root, w); if (r && isTest(r)) ran.add(r); }
  if (!planned.size && !ran.size) return;
  const retick = tickRecorded(state, task.number);
  const pt = isObj(state.protectedTests) ? state.protectedTests : (state.protectedTests = {});
  const files = isObj(pt.files) ? pt.files : (pt.files = {});
  const keyOf = new Map(Object.keys(files).map((k) => [fold(k), k]));
  for (const r of planned) { const k = keyOf.get(fold(r)); if (!(retick && k)) files[k || r] = hash16(path.join(root, r)); }
  for (const r of ran) {
    if (keyOf.has(fold(r)) || planned.has(r)) continue;
    const h = hash16(path.join(root, r));
    if (h) files[r] = h;
  }
}
// The number of test files a feature's list holds (the brief's definition-of-done line).
const protectedCount = (state) => { const pt = listOf(state); return pt ? Object.keys(pt.files).length : 0; };

// The lifts in force across these states, by file (folded): each file's LATEST record (by `at`, then list order) — a lift until a
// `protect <file>` record (revoked) follows it, in any feature; nothing else ends one (no expiry, no finish, no open-task test — 1.36.0
// review 3 went back to this rule: each narrowing of rounds 1 and 2 lost real cases — the guard's own line lifting nothing once every
// task was ticked, a lift dormant until an agent's one-line edit of tasks.md revived it, a lift of an earlier cycle explaining a change
// the guard refused). An accept record (`accepted`) is no lift: the accept ends one with its own revoked record. An archived feature's
// lifts are not read (callers pass live features). → Map(fold(file) → its lift record)
function activeLifts(states) {
  const last = new Map();
  for (const st of states) {
    const pt = listOf(st);
    if (!pt) continue;
    for (const l of pt.lifts) {
      if (typeof l.file !== "string" || l.accepted === true) continue;
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
// Every live (non-archived) feature's .state.json but `slug`'s (the caller's own, read under its lock), read raw (listOf tolerates any
// shape), then `state` — the states activeLifts reads.
const liveStatesWith = (projectDir, slug, state) => featureDirs(projectDir).filter((f) => !f.archived && fold(f.slug) !== fold(slug))
  .map((f) => readJson(statePath(f.dir)).data).concat([state]);
// Every hash these states' lists recorded, by file (folded) — a snapshot, a tick, an accept: what finish counts as explained, and
// (1.36.0 review 4) the hashes a plain protect copies for a file another feature lists. → Map(fold(file) → Set(hash), list order)
function recordedHashes(states) {
  const out = new Map();
  for (const st of states) {
    const pt = listOf(st);
    if (pt) for (const k of Object.keys(pt.files)) { const fk = fold(k); if (!out.has(fk)) out.set(fk, new Set()); out.get(fk).add(pt.files[k]); }
  }
  return out;
}

// An existing target as the file system reads it (1.36.0 review 1): its project-relative REAL path — links and junctions resolved, the
// on-disk case (`t2/auth.test.js` through a junction to test/ IS test/auth.test.js) — or null (nothing there: the text path stands).
// The target is inside the project (guardCheck): on a share, the project's own host, which the reads below reach anyway.
function realRel(pdir, abs) {
  try { return path.relative(fs.realpathSync.native(pdir), fs.realpathSync.native(abs)).split(path.sep).join("/"); } catch { return null; }
}
// A glob's [class] read as any one character too (`[t]est`) — globMatcher reads `[` as itself (a path holding brackets: app/[id]/…).
const RE_GLOB_CLASS = /\[[^\]/]+\]/g;
// guardCheck (guards.js) at level tests — BEFORE its stale / tests-phase / spike / scope answers: is the target a listed test of an
// unfinished feature (ctx.holders — every feature with open tasks: covering, forced, stale or pending — or with no finish recorded), a
// folder holding one, or a glob (in any segment) matching one or a folder holding one? An existing target is read by its real path;
// "listed" is folded membership in the lists, whatever its name (a case variant of a listed file is that file). → null when none, or
// when every one is lifted (a lift in force of any feature: ctx.states, activeLifts) or named
// EXACTLY in the _Implements:_ of a task that can start now (readyTasks — never one +port's fence holds: portHeldNumbers — and never a
// reopened task with a tick record: tickRecorded, which the ask then names as reopened, 1.36.0 review 2) of a covering or forced
// feature (ctx.unlockers — a folder, a glob or _Makes green:_ never unlocks); else ask — deny under meta.approvalGuard deny, with the
// user's line (userNote: the lift command). The lift line names the feature being worked on (1.36.0 review 2): an unlocker that lists
// the file, else the first unlocker, else a holder with open tasks, else the holder listing it with the latest tick (1.36.0 review 4:
// the first by folder name was an old all-ticked feature, whose lift then stood unseen). ctx.blocks: each feature's active task
// blocks, parsed once by guardCheck.
function protectedTestDecision(pdir, abs, rel, ctx) {
  const real = realRel(pdir, abs);
  const key = fold(real != null ? real : rel);
  const glob = /[*?[]/.test(key);
  let dir = false;
  if (!glob) { try { dir = fs.lstatSync(abs).isDirectory(); } catch { dir = false; } }
  const file = !glob && !dir;
  const m = glob ? globMatcher(key) : null;
  const classed = glob ? key.replace(RE_GLOB_CLASS, "?") : key;
  const mc = classed !== key ? globMatcher(classed) : null;
  const hits = file ? (p) => p === key : glob ? (p) => { for (let q = p; q; q = q.slice(0, Math.max(0, q.lastIndexOf("/")))) if (m(q) || (mc && mc(q))) return true; return false; }
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
  const unlocked = new Set(), current = [], reopened = [];
  let rule; // (the evidence rule, read once — only when a +port feature asks it)
  for (const name of ctx.unlockers) {
    const blocks = ctx.blocks.get(name) || [];
    const st = ctx.states.get(name), dir = path.join(specsRoot(pdir), name), tracks = detectTracks(dir);
    if (tracks.includes("port") && rule === undefined) rule = evidenceRule(pdir);
    const held = portHeldNumbers(dir, isObj(st) ? st.kind : undefined, tracks, blocks, isObj(st) ? st.evidence : undefined, rule);
    const ready = new Set(readyTasks(blocks).filter((n) => !held.has(n)));
    for (const b of blocks) {
      if (b.done || !ready.has(b.number)) continue;
      const refs = taskMarkers(b).implements.map((ref) => projectRel(root, implementsRel(ref))).filter(Boolean).map(fold); // a folder / glob never equals a file
      if (tickRecorded(st, b.number)) { reopened.push({ feature: name, number: b.number, refs }); continue; } // (a reopened task: no unlock, not named as one)
      current.push({ feature: name, number: b.number });
      for (const r of refs) unlocked.add(r);
    }
  }
  const blocking = found.filter((x) => !lifted.has(x.key) && !unlocked.has(x.key));
  if (!blocking.length) return null;
  const P = i18n.msg(projectLang(pdir)).protectedTests;
  const first = blocking[0];
  const shown = rel || ".";
  const why = file ? P.whyFile(first.feature, first.at ? dayOf(first.at) : "") : P.whyFolder(blocking.length, first.file);
  const taskList = (ts) => ts.slice(0, 4).map((t) => `${t.number} (${t.feature})`).join(", ") + (ts.length > 4 ? ", …" : "");
  // a reopened task that names a blocking test: the ask says so — its planned test needs a lift (it said no task named it)
  const reop = reopened.filter((t) => t.refs.some((r) => blocking.some((x) => x.key === r)));
  const cur = reop.length ? P.reopened(taskList(reop)) : current.length ? P.current(taskList(current)) : P.noCurrent;
  const lists = (name) => { const pt = listOf(ctx.states.get(name)); return !!pt && Object.keys(pt.files).some((k) => fold(k) === first.key); };
  const open = (name) => (ctx.blocks.get(name) || []).some((b) => !b.done);
  // (1.36.0 review 4) no open task anywhere: the holder listing it with the latest tick (state.ticks) — the one being worked on
  const lastTick = (name) => { const st = ctx.states.get(name); let t = -Infinity; if (isObj(st) && isObj(st.ticks)) for (const v of Object.values(st.ticks)) { const n = Date.parse(v); if (n > t) t = n; } return t; };
  const latest = () => ctx.holders.filter(lists).reduce((a, b) => (lastTick(b) > lastTick(a) ? b : a), first.feature);
  const liftIn = ctx.unlockers.find(lists) || ctx.unlockers[0] || ctx.holders.find(open) || latest();
  const lift = approvalCommand({ kind: "guard-down", setting: "unprotect", feature: liftIn, file: first.file }, i18n.DEV_SPEC_SCRIPT);
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
//                          (1.36.0 review 4) both add a file another live feature lists with a hash that feature recorded, never its
//                          content now; an existing <file> is read by its real path (realRel, as the guard reads it);
//   protect <f> <file> + opts.accept   (1.36.0 review 3) the user ACCEPTS the test's current content — a guard-down of the approval
//                          guard, `reason` required: its hash now is recorded in the feature's list (a re-baseline), its lift ends as
//                          above, and a record {file, at, by, reason, accepted: true, confirmed?} keeps the decision; its dry run
//                          returns that `hash`, and opts.preview {hash} (the MCP server's question) refuses another content
//                          (changed-since-preview, nothing written);
//   unprotect <f> <file>   lifts its protection — the user's decision (an agent's call is a guard-down of the approval guard): a record
//                          {file, at, by, reason, confirmed?}; `reason` required (one line, ≤ 500). opts.dryRun: the checks only (the
//                          MCP server asks the user after them); opts.confirmation: the user's answer over elicitation.
// → { ok, feature, action, … } — refusals carry a stable `code`: file-required · reason-required · not-a-test · outside-project ·
// changed-since-preview.
function protectTests(projectDir, action, name, file, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error, code: f.code };
  const lng = featureLang(projectDir, f.slug);
  const P = i18n.msg(lng).protectedTests;
  let rel = null;
  const root = path.resolve(projectDir);
  if (typeof file === "string" && file.trim()) {
    rel = projectRel(root, file);
    if (!rel) return { ok: false, code: "outside-project", error: P.err.outside(file.trim()) };
    // protect / accept: an existing target by its real path, as the guard reads it (1.36.0 review 4 — a path through a junction
    // added a second key and left the real file's lift in force); one outside the project keeps the typed path
    const real = action === "protect" ? realRel(root, path.join(root, rel)) : null;
    if (real && projectRel(root, real) === real) rel = real;
    if (/[*?[]/.test(rel) || !isTest(rel)) return { ok: false, code: "not-a-test", error: P.err.notATest(rel) };
  }
  const accept = action === "protect" && opts.accept === true;
  if (action === "unprotect" || accept) {
    if (!rel) return { ok: false, code: "file-required", error: accept ? P.err.acceptFileRequired : P.err.fileRequired };
    const r = reasonInput(opts.reason, lng);
    if (r.error) return { ok: false, code: "invalid-arguments", invalid: ["reason"], error: r.error };
    if (!r.value) return { ok: false, code: "reason-required", error: accept ? P.err.acceptReasonRequired : P.err.reasonRequired };
    // the accept's dry run: the content the user is asked about (its hash — the MCP server's preview, 1.36.0 review 4)
    if (opts.dryRun === true) return Object.assign({ ok: true, dryRun: true, feature: f.slug, action }, accept ? { accept: true, hash: hash16(path.join(root, rel)) } : {}, { file: rel, reason: r.value });
    return featureLocked(protectLocked)(projectDir, f.slug, { action, accept, rel, reason: r.value, confirmation: opts.confirmation, preview: opts.preview, lng });
  }
  if (opts.dryRun === true) return { ok: true, dryRun: true, feature: f.slug, action, ...(rel ? { file: rel } : {}) };
  return featureLocked(protectLocked)(projectDir, f.slug, { action, rel, walk: rel ? null : protectWalk(projectDir, f.slug), lng });
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
  let added = 0, unlifted = null, accepted = null;
  const abs = o.rel ? path.join(path.resolve(projectDir), o.rel) : null;
  const now = o.accept ? hash16(abs) : null;
  // the accept asked over MCP elicitation records the content the question was about — never one written while it waited
  if (o.accept && isObj(o.preview) && "hash" in o.preview && o.preview.hash !== now) {
    return { ok: false, changedSincePreview: true, code: "changed-since-preview", feature: f.slug, file: o.rel, error: P.err.acceptChangedSincePreview(o.rel) };
  }
  const others = liveStatesWith(projectDir, f.slug, state); // every live feature's state, this one's as written below
  // (1.36.0 review 4) a plain protect adds a file another live feature lists with a hash that feature recorded — the union finish
  // reads gains nothing, so only the accept authorises new content; a file no live feature lists gets its hash now
  const known = recordedHashes(others.slice(0, -1));
  const hashOf = (rel, fresh) => (known.has(fold(rel)) ? known.get(fold(rel)).values().next().value : fresh());
  if (o.walk) {
    const walk = { files: Object.create(null), truncated: o.walk.truncated };
    for (const k of Object.keys(o.walk.files)) walk.files[k] = hashOf(k, () => o.walk.files[k]);
    const w = withWalk(state.protectedTests, walk, "protect");
    state.protectedTests = w.list;
    added = w.added;
  } else {
    const pt = isObj(state.protectedTests) ? state.protectedTests : (state.protectedTests = { files: {} });
    if (activeLifts(others).has(fold(o.rel))) { // a lift in force, of any feature: ended by this feature's later record
      pt.lifts = (Array.isArray(pt.lifts) ? pt.lifts : []).concat([{ file: o.rel, at, by: userName(), revoked: true }]);
      unlifted = o.rel;
    }
    if (!isObj(pt.files)) pt.files = {};
    const key = Object.keys(pt.files).find((k) => fold(k) === fold(o.rel));
    if (o.accept) { // the user's accept: the content now is the authorised one (its hash, under the listed spelling) + the record
      pt.files[key || o.rel] = now;
      accepted = { file: o.rel, at, by: userName(), reason: o.reason, accepted: true };
      const conf = confirmationOf(o.confirmation);
      if (conf) accepted.confirmed = conf;
      pt.lifts = (Array.isArray(pt.lifts) ? pt.lifts : []).concat([accepted]);
    } else if (key === undefined) pt.files[o.rel] = hashOf(o.rel, () => hash16(abs)); // never re-hashes a listed one
    if (key === undefined) added = 1;
  }
  writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
  const pt = listOf(state);
  const inForce = activeLifts(others); // as the guard reads them: any feature's later record ends a lift
  const lifts = pt.lifts.map((l) => Object.assign({ file: l.file, at: l.at, by: l.by }, l.revoked === true ? { revoked: true }
    : l.accepted === true ? { reason: l.reason, accepted: true } : { reason: l.reason, active: inForce.get(fold(l.file)) === l }));
  const count = Object.keys(pt.files).length;
  const note = [accepted ? P.accepted(o.rel, f.slug) : null, P.listNote(f.slug, count, pt.at ? dayOf(pt.at) : "", P.via[pt.via] || "", added),
    unlifted ? P.unlifted(unlifted) : null, pt.truncated ? P.truncated(PROTECT_MAX_FILES) : null, guardLevel(projectDir) === "tests" ? null : P.notEnforced].filter(Boolean).join(" ");
  return { ok: true, feature: f.slug, action: "protect", protectedTests: Object.assign({ at: pt.at, via: pt.via, count, added }, pt.truncated ? { truncated: true } : {}),
    lifts, ...(unlifted ? { unlifted } : {}), ...(accepted ? { accepted } : {}), note };
}

// The facade's finishFeature (mcp/lib/spec.js, 1.36.0 review 1): the feature's listed tests hashed HERE, before the feature lock a write
// / evidence call takes (2,000 files held it ~2 s — the MCP server waits 2 s for a lock), handed in as opts.protectHashes {file:
// hash} — never a tool argument — which protectedTestsFinish reads (a file listed since is hashed under the lock).
function protectHashFirst(fn) {
  const run = function (projectDir, name, opts) {
    const f = existingFeature(projectDir, name);
    const pt = f.ok ? listOf(readJson(statePath(f.dir)).data) : null;
    if (!pt) return fn.apply(this, arguments);
    const root = path.resolve(projectDir), hashes = Object.create(null);
    for (const k of Object.keys(pt.files)) hashes[k] = hash16(path.join(root, k));
    return fn.call(this, projectDir, name, Object.assign({}, isObj(opts) ? opts : {}, { protectHashes: hashes }));
  };
  Object.defineProperty(run, "name", { value: fn.name });
  return run;
}
// spec_finish: the feature's list hashed again (`hashes`: protectHashFirst's, taken before the lock). A file whose content now matches
// NO hash a live feature recorded for it (a snapshot, a tick, an accept) and that no lift in force covers is unexplained — changed or
// deleted; a lift in force (activeLifts, of any live feature — this one's `state` read under the lock) explains a change (`lifted`).
// `accepted`: this feature's accept records of its work cycle (the merge summary shows them). → { count, unexplained: [{file,
// status}], lifted: [{file, by, at, reason}], accepted: [{file, by, at, reason}] } | null (no list) — a warning and the merge summary's
// block, never a blocker.
function protectedTestsFinish(projectDir, state, hashes, slug) {
  const own = listOf(state);
  if (!own || !Object.keys(own.files).length) return null;
  const root = path.resolve(projectDir);
  const states = liveStatesWith(projectDir, slug, state);
  const recorded = recordedHashes(states);
  const lifts = activeLifts(states);
  const unexplained = [], lifted = [];
  for (const k of Object.keys(own.files)) {
    const now = isObj(hashes) && Object.prototype.hasOwnProperty.call(hashes, k) ? hashes[k] : hash16(path.join(root, k));
    if (recorded.get(fold(k)).has(now)) continue;
    const l = lifts.get(fold(k));
    if (l) lifted.push({ file: k, by: l.by, at: l.at, reason: l.reason });
    else unexplained.push({ file: k, status: now == null ? "deleted" : "changed" });
  }
  // the accepts of the feature's work cycle (1.36.0 review 4 — a re-finish of the same cycle dropped them): since its last finish when
  // that finish came before its latest tasks approval (a new cycle; this one is written after), else since that approval (the cycle
  // was finished once already), else every one (never finished)
  const fin = isObj(state.finished) ? Date.parse(state.finished.at) : NaN;
  const appr = isObj(state.approvals) && isObj(state.approvals.tasks) ? Date.parse(state.approvals.tasks.at) : NaN;
  const since = fin >= appr ? appr : fin;
  const accepted = own.lifts.filter((l) => l.accepted === true && typeof l.file === "string" && !(Date.parse(l.at) <= since))
    .map((l) => ({ file: l.file, by: l.by, at: l.at, reason: l.reason }));
  return { count: Object.keys(own.files).length, unexplained, lifted, accepted };
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
    ...pt.lifted.map((l) => P.summaryLift(l.file, l.by, l.reason)), ...(pt.accepted || []).map((a) => P.summaryAccept(a.file, a.by, a.reason))];
}

// doctor protected-tests (warn) — level tests. A feature with approved, open tasks (`open`): no snapshot (feature protect takes one), a
// truncated one, the approval guard off (the list lives in .state.json, which only that guard keeps agents from editing). Any feature with
// a finish recorded (1.36.0 review 3): a lift of its own recorded BEFORE that finish and still in force (activeLifts over the live
// features) — the test stays unprotected for every later feature: the lines that end it (protect <file>) or accept its content.
// → verdict | null
function protectedTestsDoctor(projectDir, slug, state, lng, open) {
  const P = i18n.msg(lng).protectedTests;
  const pt = listOf(state);
  const issues = [];
  if (open) {
    if (!pt || !pt.at) issues.push(P.doctorMissing(slug));
    else if (pt.truncated) issues.push(P.truncated(PROTECT_MAX_FILES));
    if (approvalGuardLevel(projectDir) === "off") issues.push(P.unguarded);
  }
  const fin = pt && isObj(state.finished) ? Date.parse(state.finished.at) : NaN;
  const before = pt ? pt.lifts.filter((l) => l.revoked !== true && l.accepted !== true && typeof l.file === "string" && Date.parse(l.at) < fin) : [];
  if (before.length) {
    const inForce = activeLifts(liveStatesWith(projectDir, slug, state));
    const files = [...new Set(before.filter((l) => inForce.get(fold(l.file)) === l).map((l) => l.file))];
    if (files.length) issues.push(P.doctorLiftAfterFinish(slug, files.slice(0, PROTECT_WARN_FILES).join(", "), files.length === 1 ? files[0] : null));
  }
  return issues.length ? { status: "warn", detail: issues.join(" ") } : null;
}

module.exports = { protectWalkFirst, protectOnApproval, protectApprovalNote, protectOnTick, protectedCount, tickRecorded, protectedTestDecision,
  protectTests, protectHashFirst, protectedTestsFinish, protectedFinishWarning, protectedSummaryLines, protectedTestsDoctor, __link };

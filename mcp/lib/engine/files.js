"use strict";

/**
 * dev-spec-driven engine — paths, files, the read cache and the locks.
 * Project and .specs/ paths, create-only and atomic writes, JSON reads, the per-call read cache (withReadCache: one
 * read per file per engine call — the engine's writers keep it true), path containment (drive roots, 8.3 names,
 * junctions, network paths), and the cross-process locks: the feature lock, the roadmap lock, folder moves under the
 * lock and the .specs/.gitignore lock lines (the mutual-exclusion rules: docs/maintainers/conventions.md → Conventions &
 * gotchas).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let errs, existingFeature, projectLang, roadmapPath;
function __link(E) { ({ errs, existingFeature, projectLang, roadmapPath } = E); }

// ---------------------------------------------------------------------------
// Paths & small fs helpers
// ---------------------------------------------------------------------------

function resolveProjectDir(arg) {
  const usable = (v) => v != null && String(v).trim() && !/^\$\{[^}]*\}$/.test(String(v).trim()) ? String(v).trim() : null;
  const dir = usable(arg) || usable(process.env.SPEC_PROJECT_DIR) || usable(process.env.CLAUDE_PROJECT_DIR) || process.cwd();
  return path.resolve(dir);
}

function specsRoot(projectDir) {
  // Always use `.specs/` at the project root.
  const root = path.join(projectDir, ".specs");
  // The project this engine call works in: its .specs/templates/ join the placeholder corpus (projectTemplateSets).
  if (CTX.READ_CACHE) CTX.TEMPLATE_SCOPE_ROOT = root;
  return root;
}

function ensureDir(p) {
  forgetCached(p, { dir: true });
  fs.mkdirSync(p, { recursive: true });
}

function writeIfAbsent(file, content) {
  forgetCached(file);
  ensureDir(path.dirname(file));
  try {
    fs.writeFileSync(file, content, { encoding: "utf8", flag: "wx" }); // atomic "create only" — never clobbers
    return true;
  } catch (e) {
    if (e.code === "EEXIST") return false;
    throw e;
  }
}

// Replace a file without a torn intermediate state: a concurrent reader (hook + MCP tool) sees the old
// content or the new one, never an empty/half-written file.
// The temp file NEVER outlives the call: when the rename and the plain-write fallback both fail (a read-only or
// locked target on Windows, a folder where the file should be) the error is thrown with the temp file already
// removed — the best-effort roadmap/catalog refreshes and the hook swallow it, and they used to leave one
// full-size `<file>.<pid>.<ts>.tmp` in the committed .specs/ per call. On Windows a brief lock (a scanner, an
// indexer, a preview pane) is retried a few times first.
const RENAME_RETRY_MS = [5, 15, 40];
const RENAME_RETRY_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);
function writeFileAtomic(file, content) {
  if (!existsRaw(file)) { const a = changeAlias(file); if (a) file = a; } // 1.21 F5: a change's tasks.md / requirements.md is its change.md
  forgetCached(file);
  ensureDir(path.dirname(file));
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  let moved = false;
  try {
    fs.writeFileSync(tmp, content, "utf8");
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(tmp, file);
        moved = true;
        break;
      } catch (e) {
        if (process.platform !== "win32" || attempt >= RENAME_RETRY_MS.length || !RENAME_RETRY_CODES.has(e.code)) break;
        sleepSync(RENAME_RETRY_MS[attempt]);
      }
    }
    if (!moved) fs.writeFileSync(file, content, "utf8"); // still locked / read-only: a plain write (may throw)
  } finally {
    if (!moved) try { fs.unlinkSync(tmp); } catch { /* never created, or already gone */ }
  }
}

// Synchronous sleep (the engine is synchronous end to end): blocks this thread only, no busy loop.
const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(SLEEP_CELL, 0, 0, ms);
}

// Cross-process lock for a feature's read-modify-write. Two MCP servers (two editors on one repo) or an MCP server
// and `dev-spec done` completing tasks of the same feature at the same moment each read tasks.md + .state.json,
// changed their copy and wrote the whole file back — the last writer won, so a tick or an evidence record was
// silently lost while both calls answered ok. The mutators of a feature (featureLocked — spec_create re-run on an existing
// feature included — and the folder moves, withMoveLock) now hold
// `.specs/<feature>/.lock` (created with O_EXCL) for the whole read → check → write, and waiters retry for up to
// LOCK_WAIT_MS before answering a localized "busy" error. A lock left by a crashed process is reclaimed: its pid is
// gone (same host), or it is older than LOCK_STALE_MS (LOCK_MAX_HOLD_MS while its holder still runs). Re-entrant in
// one process. Where the lock can't be created at all (a read-only folder) the operation runs unlocked, as before.
// Every acquisition writes a random `token` into the lock's note: a stale lock is removed only while the file there is
// still the one judged stale (reclaimStaleLock), and a holder removes only the lock carrying its own token (releaseLock).
// Both used to unlink whatever sat at the path: a waiter whose stale verdict came from a lock released a moment earlier
// (a failed stat read as "stale", or a pid probe answering ESRCH for the holder that had just finished) deleted the NEXT
// holder's fresh lock, two processes ran the read-modify-write at once, and ticks / evidence / backlog items were lost
// while every call answered ok.
const LOCK_FILE = ".lock";
const LOCK_WAIT_MS = 10000;
const LOCK_STALE_MS = 2 * 60 * 1000;
const LOCK_MAX_HOLD_MS = 10 * 60 * 1000;
const LOCK_RECLAIM_SUFFIX = ".reclaim"; // `<lock>.reclaim`: held (O_EXCL) for the few microseconds of one reclaim
const LOCK_RECLAIM_STALE_MS = 30 * 1000; // a reclaim guard this old was left by a process that died holding it
// A lock with no readable note (empty, or not JSON) this old is stale: the note is written into place with the lock
// (acquireLockFile), so only a process killed inside the O_EXCL fallback's microsecond window, or a foreign file, leaves one
// — it used to block the feature for LOCK_STALE_MS.
const LOCK_NOTELESS_STALE_MS = 5 * 1000;
// A lock taken while this process already holds another (a folder move's roadmap lock inside its feature lock) waits only
// for what is left of the outer acquisition's budget — at least this much — never a second full DEV_SPEC_LOCK_WAIT_MS.
const LOCK_NESTED_MIN_MS = 500;
let LOCK_DEADLINE = null; // the acquisition deadline of the outermost lock this process is inside (null: none)
const HELD_LOCKS = new Map(); // lock key → this process's acquisition { token, ino, mtimeMs } (re-entrant, and what release checks)
// The lock file as it is now: its note (raw text, null when it can't be read — a directory, a file being deleted) and
// the stat that identifies it. null: gone, or it changed while being read (the caller just retries).
function lockSnapshot(lock) {
  let st, raw = null, st2;
  try { st = fs.statSync(lock); } catch { return null; }
  try { raw = fs.readFileSync(lock, "utf8"); } catch { /* a directory, being deleted, not ours */ }
  try { st2 = fs.statSync(lock); } catch { return null; }
  if (st2.ino !== st.ino || st2.mtimeMs !== st.mtimeMs || st2.size !== st.size) return null; // replaced / rewritten meanwhile
  return { raw, ino: st.ino, mtimeMs: st.mtimeMs, size: st.size };
}
const sameLockSnapshot = (a, b) => !!a && !!b && a.raw === b.raw && a.ino === b.ino && a.mtimeMs === b.mtimeMs && a.size === b.size;
// → the snapshot of a lock judged stale, or null: held by a live process, still being written — or gone / unreadable
// meanwhile, which is never "stale" (the lock was just released, or Windows is still deleting it): the caller retries
// the create instead of unlinking a path another process may have locked in between.
function staleLock(lock) {
  const snap = lockSnapshot(lock);
  if (!snap) return null;
  const age = Date.now() - snap.mtimeMs;
  let info = null;
  try { info = JSON.parse(snap.raw); } catch { /* being written, or not ours */ }
  let stale = age > LOCK_STALE_MS || (!isObj(info) && snap.raw != null && age > LOCK_NOTELESS_STALE_MS);
  if (isObj(info) && info.host === require("os").hostname() && Number.isSafeInteger(info.pid) && info.pid > 0 && info.pid !== process.pid) {
    try {
      process.kill(info.pid, 0); // signal 0: an existence probe, nothing is sent
      stale = age > LOCK_MAX_HOLD_MS;
    } catch (e) {
      if (e.code === "ESRCH") stale = true; // its holder is gone (this very note: reclaimStaleLock re-checks it)
    }
  }
  return stale ? snap : null;
}
// Remove the stale lock `snap` describes — atomically with respect to every other waiter: under `<lock>.reclaim` (O_EXCL),
// and only while the file at the path is still that same lock (note + stat). → "removed" (retry the create at once) |
// "changed" (another process took it over or reclaimed it first) | "busy" (another waiter is reclaiming it) | "failed"
// (it can't be removed: a handle without delete sharing, a read-only folder, a directory named .lock) — all but
// "removed" wait like a held lock, so an undeletable one ends in the busy answer at the deadline, never a spin.
function reclaimStaleLock(lock, snap) {
  const guard = lock + LOCK_RECLAIM_SUFFIX;
  let gfd;
  try {
    gfd = fs.openSync(guard, "wx");
  } catch (e) {
    if (e.code !== "EEXIST") return "failed";
    // A guard is held for microseconds: an old one was left by a process that died holding it — cleared for the next try.
    try { if (Date.now() - fs.statSync(guard).mtimeMs > LOCK_RECLAIM_STALE_MS) fs.unlinkSync(guard); } catch { /* gone, or not removable */ }
    return "busy";
  }
  try {
    try { fs.closeSync(gfd); } catch { /* ignore */ }
    if (!sameLockSnapshot(lockSnapshot(lock), snap)) return "changed";
    try { fs.unlinkSync(lock); return "removed"; } catch { return "failed"; }
  } finally {
    try { fs.unlinkSync(guard); } catch { /* ignore */ }
  }
}
// Remove `lock` only when it is this acquisition's own (`mine`: its note's token — or, when the note could not be
// written, the file's identity): one taken over meanwhile (reclaimed after LOCK_MAX_HOLD_MS, or created at a folder's
// old path after the folder moved) belongs to its new holder.
function releaseLock(lock, mine) {
  if (!mine) return;
  const now = lockSnapshot(lock);
  if (!now) return;
  let info = null;
  try { info = JSON.parse(now.raw); } catch { /* no note */ }
  const own = mine.token ? isObj(info) && info.token === mine.token : now.size === 0 && now.ino === mine.ino && now.mtimeMs === mine.mtimeMs;
  if (own) try { fs.unlinkSync(lock); } catch { /* ignore */ }
}
// → fn()'s result, or opts.onBusy({ stuck }) when the lock stayed held for opts.waitMs (default: DEV_SPEC_LOCK_WAIT_MS from
// the environment when it is an integer ≥ 0 — a slow network file system may want more — else LOCK_WAIT_MS). `stuck`:
// the lock was stale but could not be removed (the busy error then says so — delete it by hand).
function lockWaitMs() {
  const v = String(process.env.DEV_SPEC_LOCK_WAIT_MS || "").trim();
  return /^\d{1,7}$/.test(v) ? Number(v) : LOCK_WAIT_MS;
}
function withFeatureLock(dir, fn, opts = {}) {
  return withLockFile(path.join(dir, LOCK_FILE), fn, opts);
}
// The lock itself, on any lock file (a feature's .lock, the project's .specs/.roadmap.lock).
function withLockFile(lock, fn, opts = {}) {
  const key = readCacheKey(lock);
  if (HELD_LOCKS.has(key)) return fn();
  ensureLockIgnore(specsDirOf(path.dirname(lock))); // before the lock exists: one left by a killed process is never committable
  const waitMs = Number.isSafeInteger(opts.waitMs) && opts.waitMs >= 0 ? opts.waitMs : lockWaitMs();
  const now0 = Date.now();
  // Nested (this process already inside another lock): what is left of the outer acquisition's budget, at least
  // LOCK_NESTED_MIN_MS — the two waits together stay one budget (they could take twice DEV_SPEC_LOCK_WAIT_MS).
  const deadline = LOCK_DEADLINE == null ? now0 + waitMs : Math.min(now0 + waitMs, Math.max(LOCK_DEADLINE, now0 + Math.min(LOCK_NESTED_MIN_MS, waitMs)));
  // The note (and its token) is ready BEFORE the lock exists, so the lock is never there without it.
  const mine = { token: require("crypto").randomBytes(12).toString("hex"), ino: null, mtimeMs: null };
  const note = JSON.stringify({ pid: process.pid, host: require("os").hostname(), at: new Date().toISOString(), token: mine.token });
  let acquired = false;
  let delay = 5;
  let denied = 0; // consecutive EPERM/EACCES: Windows answers that for a lock being deleted — or the folder is read-only
  let stuck = false; // the last stale lock seen could not be removed
  while (!acquired) {
    try {
      acquired = acquireLockFile(lock, note, mine);
    } catch (e) {
      if (e.code === "EEXIST") {
        denied = 0;
        const snap = staleLock(lock);
        if (snap) {
          const r = reclaimStaleLock(lock, snap);
          if (r === "removed") { stuck = false; continue; } // retry the create at once
          stuck = r === "failed";
        } else stuck = false;
        // Otherwise it waits like a held lock — a stale lock that can't be removed included: the deadline and the sleep
        // below always run (a `continue` here spun at 100% CPU forever on an undeletable one, freezing the MCP server).
      } else if ((e.code === "EPERM" || e.code === "EACCES" || e.code === "EBUSY") && ++denied < 10) {
        /* transient on Windows: retry below */
      } else {
        // No lock possible here (the folder vanished while we waited — removed / renamed / archived — or is read-only, or an
        // odd file system): run unlocked, as before, but on FRESH reads — the caller's pre-lock check ("the feature exists")
        // is stale once its folder moved, and a write from it recreated a zombie .specs/<old>/ (it now answers not-found).
        invalidateReadCache();
        return fn();
      }
      if (Date.now() >= deadline) return opts.onBusy ? opts.onBusy({ stuck }) : { ok: false, busy: true, ...(stuck ? { stuck: true } : {}) };
      sleepSync(delay);
      delay = Math.min(delay * 2, 50);
    }
  }
  HELD_LOCKS.set(key, mine);
  const outerDeadline = LOCK_DEADLINE;
  if (outerDeadline == null) LOCK_DEADLINE = deadline;
  try {
    // Anything read before the lock may predate another process's write: the whole read cache (a feature's files), or
    // only what opts.forget names (the roadmap lock: roadmap.json).
    if (typeof opts.forget === "function") opts.forget(); else invalidateReadCache();
    return fn();
  } finally {
    LOCK_DEADLINE = outerDeadline;
    HELD_LOCKS.delete(key);
    releaseLock(lock, mine); // only our own: after a folder move the old path is empty — or another process's lock
  }
}
// Create `lock` holding `note` — atomically: the note goes to a temp file (named like writeFileAtomic's, so the maintained
// .specs/.gitignore covers it) that is hard-linked into place — linkSync fails with EEXIST exactly like an O_EXCL create —
// then the temp name is dropped. The lock is never there without its note: a process killed between the O_EXCL create and
// the note's write left an EMPTY lock that blocked the feature for LOCK_STALE_MS. Where hard links are unavailable (FAT, some
// network shares) → the O_EXCL create + write (staleLock treats a noteless lock older than LOCK_NOTELESS_STALE_MS as stale).
// → true, or throws what the create threw (EEXIST: held; ENOENT: no folder; EPERM/EACCES: being deleted, or read-only).
function acquireLockFile(lock, note, mine) {
  const tmp = lock + "." + process.pid + "." + Date.now() + "." + Math.floor(Math.random() * 1e6) + ".tmp";
  let linked = false;
  try {
    fs.writeFileSync(tmp, note, { encoding: "utf8", flag: "wx" });
    fs.linkSync(tmp, lock);
    linked = true;
  } catch (e) {
    if (e.code === "EEXIST" || e.code === "ENOENT") throw e; // held (or a temp name taken: retried) / no folder: the caller decides
    // no hard links here, or the temp file couldn't be written: the O_EXCL create below throws the real reason
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* never created */ }
  }
  if (linked) {
    try { const st = fs.statSync(lock); mine.ino = st.ino; mine.mtimeMs = st.mtimeMs; } catch { /* ignore */ }
    return true;
  }
  const fd = fs.openSync(lock, "wx");
  try {
    fs.writeSync(fd, note);
  } catch {
    mine.token = null; // the lock holds without its note: release recognises it by its identity instead
  }
  try { const st = fs.fstatSync(fd); mine.ino = st.ino; mine.mtimeMs = st.mtimeMs; } catch { /* ignore */ }
  try { fs.closeSync(fd); } catch { /* ignore */ }
  return true;
}
// A feature mutator (projectDir, name, …) run under that feature's lock; `when(args)` limits it to the calls that
// write (impact --reopen, finish --write, brief --write, metrics --write — a derived file written into the feature folder
// is a write too: resolved before a rename / archive / remove and written after it, it recreated a zombie .specs/<old>/).
// An unknown feature runs straight through: fn reports it (spec_create of a NEW feature too — there is no folder to lock
// yet; re-run on an existing one, it adds tracks like spec_add_track, locked).
function featureLocked(fn, when) {
  const run = function (projectDir, name) {
    const args = arguments;
    if (when && !when(args)) return fn.apply(this, args);
    const f = existingFeature(projectDir, name);
    if (!f.ok) return fn.apply(this, args);
    return withFeatureLock(f.dir, () => fn.apply(this, args), { onBusy: (b) => featureBusyResult(projectDir, f.slug, null, b) });
  };
  Object.defineProperty(run, "name", { value: fn.name });
  return run;
}
// The localized busy answer; b.stuck (a stale lock that could not be removed) → says so and names the file to delete.
const featureBusyResult = (projectDir, slug, rel, b) => {
  const E = errs(projectDir, slug);
  return b && b.stuck ? { ok: false, busy: true, stuck: true, error: E.lockStuck(rel || `.specs/${slug}/${LOCK_FILE}`) }
    : { ok: false, busy: true, error: E.featureBusy(slug, rel) };
};
// A feature folder that moves or goes (rename / archive / restore / remove) under the lock its mutators hold: it waits for
// a running tick, approval or track change to finish (or answers busy) instead of moving the folder away mid-write — the
// writer's next write (writeFileAtomic → ensureDir) recreated a zombie .specs/<old>/ beside the moved spec, and progress
// and spec split between two folders. The lock file travels with the folder; `release(newDir)` drops it at the NEW place
// once the whole operation is done (left there, it kept the renamed / archived feature "busy" for as long as its holder
// ran). A folder is never moved while another process holds its lock.
function withMoveLock(projectDir, dir, slug, rel, fn) {
  const oldKey = readCacheKey(path.join(dir, LOCK_FILE));
  return withFeatureLock(dir, () => {
    const mine = HELD_LOCKS.get(oldKey); // undefined when no lock could be taken here (run unlocked): nothing to release
    let moved = null;
    try {
      // Held at its new place from the move on (re-entrant there too, like the old one).
      return fn((to) => { moved = to; if (mine) HELD_LOCKS.set(readCacheKey(path.join(to, LOCK_FILE)), mine); });
    } finally {
      if (moved) {
        HELD_LOCKS.delete(readCacheKey(path.join(moved, LOCK_FILE)));
        releaseLock(path.join(moved, LOCK_FILE), mine); // the lock this process carried there — only its own token
      }
    }
  }, { onBusy: (b) => featureBusyResult(projectDir, slug, rel, b) });
}
// fs.renameSync of a folder, retried on Windows: a scanner, an indexer or a lock waiter reading a file inside answers
// EPERM / EACCES / EBUSY for a moment. The feature lock is already held, so it waits longer than a file's rename (~1.4 s —
// 60 ms answered a raw EPERM under contention); still refused → the caller's localized "folder in use" (moveDirOrBusy).
const DIR_RENAME_RETRY_MS = [10, 20, 40, 80, 120, 180, 250, 300, 400];
function renameDirSync(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      return fs.renameSync(from, to);
    } catch (e) {
      if (process.platform !== "win32" || attempt >= DIR_RENAME_RETRY_MS.length || !RENAME_RETRY_CODES.has(e.code)) throw e;
      sleepSync(DIR_RENAME_RETRY_MS[attempt]);
    }
  }
}
// renameDirSync → null, or the localized "folder in use" result when the folder stayed locked by another program
// (EPERM / EACCES / EBUSY after the retries) — never a raw, untranslated EPERM. Anything else is thrown as before.
function moveDirOrBusy(projectDir, slug, from, to) {
  try {
    renameDirSync(from, to);
    return null;
  } catch (e) {
    if (!RENAME_RETRY_CODES.has(e.code)) throw e;
    const rel = path.relative(path.resolve(projectDir), from).split(path.sep).join("/");
    return { ok: false, busy: true, inUse: true, error: errs(projectDir, slug).folderInUse(rel) };
  }
}

// roadmap.json's read-modify-writes — depend, backlog, the backlog / dependency prunes of create / restore / archive /
// rename / remove, init's lang and guard, roadmap --lang — under ONE project lock, .specs/.roadmap.lock (the feature
// lock's O_EXCL file, wait, stale-reclaim and busy answer). Each process read roadmap.json, changed its copy and wrote it
// back: the last writer won, silently dropping the other's dependency (a blocked feature then read as ready), backlog item
// or meta.guard while both answered ok. Lock order: a feature lock first, then this one — never the other way round.
const ROADMAP_LOCK_FILE = ".roadmap.lock";
// The engine's transient files — the feature and roadmap locks and their reclaim guards — are git-ignored by
// `.specs/.gitignore` (unanchored names: they match in every feature folder, _archive/ included). A lock left by a killed
// process (Ctrl-C, a closed session, a crash) showed in `git status`, `git add -A` committed it, and on every clone its
// checkout mtime made the feature "busy" for LOCK_STALE_MS — then the reclaim deleted a tracked file and dirtied the tree.
// Ensured before any lock file is created (withLockFile) and by spec_init / spec_create; an existing .specs/.gitignore
// only gains the lines it lacks (its own lines and line endings are kept). Best-effort: it never creates .specs/ itself and
// never fails the operation (a read-only folder just stays as it is).
// Also the temp files a killed process leaves: writeFileAtomic's `<file>.<pid>.<ts>.tmp` and acquireLockFile's
// `<lock>.<pid>.<ts>.<n>.tmp` (git listed them as untracked), and the tombstone a failed remove leaves (`.removing-*/`).
const LOCK_IGNORE_LINES = [LOCK_FILE, LOCK_FILE + LOCK_RECLAIM_SUFFIX, ROADMAP_LOCK_FILE, ROADMAP_LOCK_FILE + LOCK_RECLAIM_SUFFIX,
  "*.[0-9]*.[0-9]*.tmp", ".removing-*/"];
function ensureLockIgnore(specsDir) {
  if (!specsDir) return;
  const file = path.join(specsDir, ".gitignore");
  try {
    let cur = null;
    try { cur = fs.readFileSync(file, "utf8"); } catch (e) { if (e.code !== "ENOENT") return; } // a folder there, unreadable: left alone
    if (cur == null) {
      fs.writeFileSync(file, LOCK_IGNORE_LINES.join("\n") + "\n", { encoding: "utf8", flag: "wx" }); // ENOENT without .specs/: nothing created
    } else {
      const have = new Set(cur.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()));
      const missing = LOCK_IGNORE_LINES.filter((l) => !have.has(l));
      if (!missing.length) return;
      const eol = /\r\n/.test(cur) ? "\r\n" : "\n";
      fs.appendFileSync(file, (cur === "" || /\n$/.test(cur) ? "" : eol) + missing.join(eol) + eol, "utf8");
    }
    forgetCached(file);
  } catch { /* best-effort: read-only, or another process wrote it first */ }
}
// The `.specs` folder a lock sits in or under (.specs/, .specs/<feature>/, .specs/_archive/<feature>/) — null elsewhere.
function specsDirOf(dir) {
  let d = path.resolve(dir);
  for (let i = 0; i < 3; i++) {
    if (path.basename(d) === ".specs") return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
  return null;
}
const roadmapBusyResult = (projectDir, b) => {
  const E = i18n.msg(projectLang(projectDir)).err;
  return b && b.stuck ? { ok: false, busy: true, stuck: true, error: E.lockStuck(".specs/" + ROADMAP_LOCK_FILE) } : { ok: false, busy: true, error: E.roadmapBusy };
};
function withRoadmapLock(projectDir, fn, onBusy) {
  return withLockFile(path.join(specsRoot(projectDir), ROADMAP_LOCK_FILE), fn,
    { onBusy: onBusy || ((b) => roadmapBusyResult(projectDir, b)), forget: () => forgetCached(roadmapPath(projectDir)) });
}

// JSON state (.specs/roadmap.json, .specs/<feature>/.state.json). A file that EXISTS but doesn't parse
// is never treated as empty — the next write would silently erase deps/backlog/approvals/lang. A
// leading BOM (Windows editors) is tolerated.
function readJson(file) {
  const raw = readIfExists(file);
  if (raw == null) return { exists: false, data: null, error: null };
  try {
    return { exists: true, data: JSON.parse(raw.replace(/^\uFEFF/, "")), error: null };
  } catch (e) {
    const rel = jsonRel(file);
    return { exists: true, data: null, error: `${rel} is not valid JSON (${e.message}) — fix it by hand; refusing to overwrite it.`, errorRel: rel, errorDetail: e.message };
  }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// ".specs/roadmap.json" / "<feature>/.state.json" — the same relative name readJson() reports.
function jsonRel(file) {
  return path.relative(path.dirname(path.dirname(file)), file).split(path.sep).join("/"); // same on every OS
}
// Localized "valid JSON, wrong shape" error from [code, key?] problems (codes = i18n jsonShape keys).
function shapeError(lang, rel, problems) {
  const S = i18n.msg(lang).jsonShape;
  return S.invalid(rel, problems.map(([code, key]) => (typeof S[code] === "function" ? S[code](key) : S[code])).join("; "));
}

// One read per file per computation: the roadmap refresh (run by every mutator and the hook) and the checks (doctor,
// next_action, trace, the catalog) read each feature's artifacts and .state.json from many helpers — the same file up to
// six times, and on Windows a read costs ~1 ms (the scanner opens every file). withReadCache(fn) serves repeats from
// memory while fn runs, and only then: the cache lives for ONE call (never across MCP calls — nothing can go stale
// between them). Inside it every engine write keeps it true: writeFileAtomic / writeIfAbsent / ensureDir drop the entry
// of what they write (and the "exists" answers of its folders), and a raw write — a moved or removed folder, an in-place
// edit — clears the whole cache (invalidateReadCache). Nested scopes share the outer one. Keys are resolved paths,
// case-folded where the file system folds case, so two spellings of one file can't hold two different texts.
// The same scope memoizes the folder listings walkProject reads and the files each _Implements:_ glob matches
// (globFiles): trace_check runs several times in one call (finish → trace + doctor → trace; next_action; approve's
// checks) and a `**` glob walks the whole tree. A written file drops every listing above it and every glob whose walk
// could see it (forgetCached); a created folder alone adds no file, so it leaves the globs alone.
function withReadCache(fn) {
  if (CTX.READ_CACHE) return fn();
  CTX.READ_CACHE = new Map();
  CTX.GLOB_CACHE = new Map();
  CTX.XAC_MEMO = null;
  CTX.TEMPLATE_SCOPE_ROOT = null; // the call's project (specsRoot) and its parsed templates live as long as the scope
  CTX.TEMPLATE_MEMO = null;
  CTX.PACK_MEMO = null; // … and its track packs (1.15)
  CTX.GHOST_MARKERS = null;
  try {
    return fn();
  } finally {
    CTX.READ_CACHE = null;
    CTX.GLOB_CACHE = null;
    CTX.XAC_MEMO = null;
    CTX.TEMPLATE_SCOPE_ROOT = null;
    CTX.TEMPLATE_MEMO = null;
    CTX.PACK_MEMO = null;
    CTX.GHOST_MARKERS = null;
  }
}
const readCacheKey = (p) => { const r = path.resolve(String(p)); return FOLD_CASE ? r.toLowerCase() : r; };
const EXISTS_KEY = "\u0000exists:";
const DIR_KEY = "\u0000dir:";
// A spec file whose CONTENT is copied out — decisions.md (appended and rewritten), the export's documents, the release notes —
// must be a regular file whose real path stays inside the project's .specs/: a committed symlink out (decisions.md ->
// ~/.ssh/id_rsa) is never followed (the specs:// resources refuse it the same way). Absent → true (nothing to follow).
// Within a read-cache scope the verdict is memoized per file and the root's real path per root (1.16 Q review: the cross-feature
// criteria and supersededByIndex read every requirements.md in one call — two real-path walks per file were a third of it).
const CONTAINED_KEY = "\u0000contained:";
function specsFileContained(projectDir, file) {
  const k = CTX.READ_CACHE ? CONTAINED_KEY + readCacheKey(file) : null;
  if (k !== null && CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  const v = specsFileContainedNow(projectDir, file);
  if (k !== null) CTX.READ_CACHE.set(k, v);
  return v;
}
function specsFileContainedNow(projectDir, file) {
  let st;
  try { st = fs.lstatSync(file); } catch { return true; }
  if (st.isSymbolicLink() || !st.isFile()) return false;
  try {
    const root = specsRoot(projectDir);
    const rk = CTX.READ_CACHE ? CONTAINED_KEY + "root:" + readCacheKey(root) : null;
    let realRoot = rk !== null ? CTX.READ_CACHE.get(rk) : undefined;
    if (realRoot === undefined) { realRoot = fs.realpathSync.native(root); if (rk !== null) CTX.READ_CACHE.set(rk, realRoot); }
    const real = fs.realpathSync.native(file);
    return real !== realRoot && withinRoot(realRoot, real);
  } catch {
    return false;
  }
}
// readIfExists for such a file: null when it is not contained (skipped, as if absent).
function readContained(projectDir, file) {
  const f = (!existsRaw(file) && changeAlias(file)) || file; // 1.21 F5: a change's change.md is checked as itself
  return specsFileContained(projectDir, f) ? readRaw(f) : null;
}
// 1.21 F5 — a CHANGE (kind "change", size xs) keeps its requirements AND its tasks in ONE file, change.md: every reader and
// writer of a feature's requirements.md / tasks.md reaches it through this alias, so the engine's many readers of those two
// files (EARS, trace, the tasks scanner, the evidence gate, finish, the roadmap, the exports, the hooks) work on it unchanged.
// Only when the file itself is absent, its folder holds change.md and that folder's .state.json says kind "change" — a plain
// feature is never aliased (its requirements.md exists; a missing one stays missing). → change.md's path | null.
const CHANGE_FILE = "change.md";
function changeAlias(file) {
  const s = String(file);
  const base = path.basename(s);
  if (base !== "requirements.md" && base !== "tasks.md") return null;
  const dir = path.dirname(s);
  const ch = path.join(dir, CHANGE_FILE);
  if (!existsRaw(ch)) return null;
  const raw = readRaw(path.join(dir, ".state.json"));
  if (raw == null || !raw.includes("change")) return null;
  try {
    const j = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
    return j && typeof j === "object" && j.kind === "change" ? ch : null;
  } catch {
    return null;
  }
}
function readIfExists(file) {
  const text = readRaw(file);
  if (text != null) return text;
  const a = changeAlias(file);
  return a ? readRaw(a) : null;
}
// 1.21.1 review — the first maxBytes of a file, UTF-8 decoded, from ONE bounded read of the disk: never the whole file then a
// slice (a 177 MB tests/fixtures/db.sql cost every trace / doctor / finish / approve 249 ms and 179 MB). The brownfield scan,
// the test-code scan and the status line's tests gate read code this way. A multi-byte character cut at the limit decodes as
// U+FFFD. null when the file can't be read. Uncached (not the read cache): these readers visit each file once per call.
let HEAD_BUF = null; // one scratch buffer, reused (the reads are synchronous)
function readFileHead(file, maxBytes) {
  const max = Math.max(1, Math.floor(maxBytes) || 1);
  if (!HEAD_BUF || HEAD_BUF.length < max) HEAD_BUF = Buffer.allocUnsafe(max);
  let fd = null;
  try {
    fd = fs.openSync(file, "r");
    let n = 0;
    while (n < max) {
      const r = fs.readSync(fd, HEAD_BUF, n, max - n, null);
      if (r <= 0) break;
      n += r;
    }
    return HEAD_BUF.toString("utf8", 0, n);
  } catch {
    return null;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* already closed */ }
  }
}
function readRaw(file) {
  const k = CTX.READ_CACHE ? readCacheKey(file) : null;
  if (k !== null && CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    text = null;
  }
  if (k !== null) CTX.READ_CACHE.set(k, text);
  return text;
}
// fs.existsSync, served from the same scope (the per-feature file probes of listFeatures / detectPhase / detectTracks) — a
// change's requirements.md / tasks.md exist as its change.md (changeAlias, 1.21 F5).
function existsCached(p) {
  return existsRaw(p) || !!changeAlias(p);
}
function existsRaw(p) {
  if (!CTX.READ_CACHE) return fs.existsSync(p);
  const k = EXISTS_KEY + readCacheKey(p);
  if (CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  const v = fs.existsSync(p);
  CTX.READ_CACHE.set(k, v);
  return v;
}
// fs.readdirSync(d, { withFileTypes: true }) sorted by name, served from the same scope (walkProject); null = unreadable.
function readDirCached(d) {
  const k = CTX.READ_CACHE ? DIR_KEY + readCacheKey(d) : null;
  if (k !== null && CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  let entries = null;
  try {
    entries = fs.readdirSync(d, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch {
    entries = null;
  }
  if (k !== null) CTX.READ_CACHE.set(k, entries);
  return entries;
}
// `file` is about to be written (or created, with its folders): its text, the "exists" answers and listings of it and of
// every folder above it are dropped — and every cached glob whose walk could reach it. opts.dir: `file` is a folder being
// created (ensureDir) — an empty folder changes no glob's matches.
function forgetCached(file, opts = {}) {
  if (!CTX.READ_CACHE) return;
  let k = readCacheKey(file);
  CTX.READ_CACHE.delete(k);
  CTX.READ_CACHE.delete(CONTAINED_KEY + k);
  CTX.XAC_MEMO = null; // 1.16 Q2: any write may change a criterion, a state or a template — the cross-feature table is rebuilt
  // A write under .specs/templates/ (templates init) changes the project's template corpus.
  if (CTX.TEMPLATE_MEMO && (k === CTX.TEMPLATE_MEMO.tdirKey || k.startsWith(CTX.TEMPLATE_MEMO.tdirKey + path.sep))) CTX.TEMPLATE_MEMO = null;
  // … and a write under .specs/tracks/ (tracks init) changes the project's track packs (1.15).
  if (CTX.PACK_MEMO && (k === CTX.PACK_MEMO.dirKey || k.startsWith(CTX.PACK_MEMO.dirKey + path.sep))) CTX.PACK_MEMO = null;
  for (;;) {
    CTX.READ_CACHE.delete(EXISTS_KEY + k);
    CTX.READ_CACHE.delete(DIR_KEY + k);
    const up = path.dirname(k);
    if (up === k) break;
    k = up;
  }
  if (!opts.dir && CTX.GLOB_CACHE && CTX.GLOB_CACHE.size) {
    const abs = readCacheKey(file);
    for (const [gk, e] of CTX.GLOB_CACHE) if (e.base !== null && globWalkReaches(e, abs)) CTX.GLOB_CACHE.delete(gk);
  }
}
// Could the walk of a cached glob (from e.base, entering e.allowDir's folders) reach the file `abs` (both readCacheKey
// forms)? Only a hidden folder on the way (.specs, where the engine writes) proves it can't — anything else is "yes",
// so a cached result is dropped rather than risked.
function globWalkReaches(e, abs) {
  const rel = path.relative(e.base, abs);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) return false;
  return rel.split(path.sep).slice(0, -1).every((n) => !n.startsWith(".") || (e.allowDir && e.allowDir(n)));
}
// A write the per-file bookkeeping can't follow (a folder moved or removed, a file edited in place): forget everything.
function invalidateReadCache() {
  if (CTX.READ_CACHE) CTX.READ_CACHE.clear();
  if (CTX.GLOB_CACHE) CTX.GLOB_CACHE.clear();
  CTX.TEMPLATE_MEMO = null;
  CTX.PACK_MEMO = null;
  CTX.XAC_MEMO = null;
}

function safeReaddir(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

// Is `p` the root itself or inside it? path.relative, not `root + sep`: a drive root (C:\, or Q:\ from subst) already
// ends in a separator, and another drive comes back absolute.
function withinRoot(root, p) {
  const rel = path.relative(root, p);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}

const isDirSafe = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
// Windows and macOS file systems are case-insensitive: `_Implements: SRC/App.js_` names src/app.js there.
const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";
const toPosix = (p) => String(p).split(path.sep).join("/");

function isInsideDir(root, p) {
  const f = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const r = f(root.endsWith(path.sep) ? root : root + path.sep);
  return f(p) === f(root) || f(p).startsWith(r);
}

// The real path of p even when it doesn't exist yet: the real path (fs.realpathSync.native — 8.3 short names, junctions
// and symlinks resolved) of its nearest EXISTING ancestor, plus the segments below it. null when nothing resolves.
function realPathLoose(p) {
  let cur = path.resolve(p);
  const rest = [];
  for (let i = 0; i < 256; i++) {
    try {
      return path.join(fs.realpathSync.native(cur), ...rest);
    } catch (e) {
      if (!e || (e.code !== "ENOENT" && e.code !== "ENOTDIR")) return null; // EACCES, ELOOP…: no answer
    }
    const up = path.dirname(cur);
    if (up === cur) return null;
    rest.unshift(path.basename(cur));
    cur = up;
  }
  return null;
}
// A network path in its plain UNC spelling (`\\?\UNC\host\share\…` and `\\.\UNC\…` → `\\host\share\…`), for a text comparison.
function plainUnc(p) {
  const s = String(p);
  const m = /^[\\/]{2}[?.][\\/]UNC[\\/]/i.exec(s);
  return m ? "\\\\" + s.slice(m[0].length) : s;
}
// Is network path p inside network folder root — decided on the TEXT alone, never a stat or realpath (1.16 verify NEW-3)?
// Both are read as Windows paths (a UNC path is one): `\\?\UNC\` = `\\`, / = \, `..` resolved, case folded (SMB host and share
// names are case-insensitive). A local root or p → false. → the relative path ("" for root itself) | null.
function networkPathInside(root, p) {
  if (typeof root !== "string" || typeof p !== "string" || !isNetworkPath(root) || !isNetworkPath(p)) return null;
  const W = path.win32;
  const r = W.resolve(plainUnc(root)), q = W.resolve(plainUnc(p));
  if (!isNetworkPath(r) || !isNetworkPath(q)) return null;
  const rl = r.toLowerCase().replace(/\\+$/, ""), ql = q.toLowerCase();
  return ql === rl || ql.startsWith(rl + "\\") ? W.relative(r, q) : null;
}
// p spelled under root when it lies inside root — as text, or through an alias of either (an 8.3 short name
// `C:\Users\ADMINI~1\…`, a junction, a symlink); null when it is outside. The text comparison answers first; the real
// paths are read only when it says "outside" (the guard hook calls this on every edit). Never throws.
// A NETWORK path on either side (isNetworkPath — an agent's Write to `\\host\share\a.js`, an absolute `_Implements:_`) is decided
// on the text alone (1.16 verify NEW-3): a realpath / stat of it opens an SMB connection to the host it names before the permission
// prompt — hanging on an unreachable host, and on Windows sending the user's NTLM credentials. Inside only under the same
// `\\host\share\…` prefix as root (a project living on a share stays guarded), the `\\?\UNC\` spelling read as the plain one.
function insideDirAlias(root, p) {
  if (isInsideDir(root, p)) return p;
  if (isNetworkPath(root) || isNetworkPath(p)) {
    const rel = networkPathInside(root, p);
    return rel == null ? null : rel ? path.join(root, rel) : root;
  }
  try {
    const rr = realPathLoose(root), rp = realPathLoose(p);
    if (rr && rp && isInsideDir(rr, rp)) return path.join(root, path.relative(rr, rp));
  } catch { /* the text answer stands */ }
  return null;
}
// A network path — UNC `\\host\share`, `//host/share`, `\\?\UNC\host\share`, `\\.\UNC\…` — opens an SMB/WebDAV connection to
// whatever host it names (on Windows the redirector sends the user's NTLM credentials) and, the engine being synchronous, blocks
// until an unreachable host times out (a status line hung 7 minutes on a payload cwd `\\192.0.2.1\share`). The MCP server
// refuses such a projectDir before any fs call; the status line and hooks/plan-hook.js skip such a candidate folder. Local:
// the extended/device forms of a drive path (`\\?\C:\…`, `\\.\C:\…`) and WSL's own hosts (`\\wsl$\…`, `\\wsl.localhost\…`).
// Other device paths (`\\.\pipe\…`, `\\?\Volume{…}\…`) are no project folder either. (A drive letter mapped to a share can't be
// told apart without I/O.)
function isNetworkPath(p) {
  const s = String(p).trim();
  if (!/^[\\/]{2}/.test(s)) return false;
  let rest = s.slice(2);
  if (/^[?.][\\/]/.test(rest)) {
    rest = rest.slice(2);
    if (/^[A-Za-z]:(?:[\\/]|$)/.test(rest)) return false; // \\?\C:\… — a local drive
    if (!/^UNC[\\/]/i.test(rest)) return true; // \\.\pipe\…, \\?\Volume{…}, \\?\GLOBALROOT\… — not a project folder
    rest = rest.slice(4);
  }
  const host = rest.split(/[\\/]/)[0].toLowerCase();
  return host !== "wsl$" && host !== "wsl.localhost";
}

module.exports = { resolveProjectDir, specsRoot, ensureDir, writeIfAbsent, RENAME_RETRY_MS, RENAME_RETRY_CODES,
  writeFileAtomic, SLEEP_CELL, sleepSync, LOCK_FILE, LOCK_WAIT_MS, LOCK_STALE_MS, LOCK_MAX_HOLD_MS, LOCK_RECLAIM_SUFFIX,
  LOCK_RECLAIM_STALE_MS, LOCK_NOTELESS_STALE_MS, LOCK_NESTED_MIN_MS, HELD_LOCKS, lockSnapshot, sameLockSnapshot,
  staleLock, reclaimStaleLock, releaseLock, lockWaitMs, withFeatureLock, withLockFile, acquireLockFile, featureLocked,
  featureBusyResult, withMoveLock, DIR_RENAME_RETRY_MS, renameDirSync, moveDirOrBusy, ROADMAP_LOCK_FILE,
  LOCK_IGNORE_LINES, ensureLockIgnore, specsDirOf, roadmapBusyResult, withRoadmapLock, readJson, isObj, jsonRel,
  shapeError, withReadCache, readCacheKey, EXISTS_KEY, DIR_KEY, CONTAINED_KEY, specsFileContained,
  specsFileContainedNow, readContained, readIfExists, readFileHead, readRaw, existsCached, existsRaw, CHANGE_FILE, changeAlias, readDirCached, forgetCached, globWalkReaches,
  invalidateReadCache, safeReaddir, withinRoot, isDirSafe, FOLD_CASE, toPosix, isInsideDir, realPathLoose, plainUnc,
  networkPathInside, insideDirAlias, isNetworkPath, __link };

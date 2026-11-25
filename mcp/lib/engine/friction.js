"use strict";

/**
 * dev-spec-driven engine — the friction budget (1.41): how long the project checks (roadmap.json meta.checks) take in the dev loop,
 * against the budgets steering/tech.md states. Report only — never a gate, a refusal, a doctor entry or a size rule.
 *   - The log: a git-ignored, bounded `.specs/.execution/timings.jsonl`, one line per measured run of a project check —
 *     {check, checkCmd, exitCode, ms, at, by: "cli" | "hook", tool?} — from `done --run` / `finish --run` (the CLI's own clock: spawn
 *     → the command's EXIT, never the pipes' drain — cli/run.js) and, in Claude Code, the observe hook (the payload's `duration_ms`,
 *     through observeRun). A run is a check's only as the evidence matcher reads it, the check as ONE command (runProvesVerify: a
 *     piped, chained or joined run is none); `checkCmd` is the check's command when the line was written, so the reader keeps a line
 *     only while meta.checks still says so — a string compare, no matcher (CRIT_S3 #1). Past TIMINGS_MAX_BYTES the log keeps, per
 *     check, its newest FRICTION_KEEP passing lines (the fast check, run after every edit, never pushes the suite's few runs out —
 *     CRIT_S3 #2). observed.jsonl (evidence) is never touched: two rules, two files (the fast check's unknown / missing split stays).
 *   - The budgets: `_Budget: <check> <duration>_` markers in steering/tech.md (frictionBudgets), read by the task markers' span
 *     reader under its own label (tasks.js labelMarkerSpans — one closer grammar), outside fenced code and HTML comments.
 *   - The verdict (frictionStatus): the MEDIAN of a check's newest FRICTION_RUNS passing measured runs (FRICTION_MIN_RUNS needed)
 *     against its budget — spec_metrics' project `friction`; next_action's finish step proposes a platform item (frictionHint) until
 *     the backlog or a feature answers to `friction-<check>`.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // load time — the read-cache scope the timings read is memoized in
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let appendLog, isObj, labelMarkerSpans, locateFeatures, observedBodies, observedNorm, projectChecks, readCacheKey, readIfExists, readLogTail,
  readRoadmap, runProvesVerify, scanTaskLines, slugify, specsRoot, stripCdPrefix, validCheckName, writeFileAtomic;
function __link(E) { ({ appendLog, isObj, labelMarkerSpans, locateFeatures, observedBodies, observedNorm, projectChecks, readCacheKey, readIfExists,
  readLogTail, readRoadmap, runProvesVerify, scanTaskLines, slugify, specsRoot, stripCdPrefix, validCheckName, writeFileAtomic } = E); }

const TIMINGS_LOG = "timings.jsonl";
const TIMINGS_MAX_BYTES = 64 * 1024; // past this the log keeps, per check, its newest FRICTION_KEEP passing lines (read: 4 × this at most)
const FRICTION_RUNS = 5; // the verdict reads a check's newest 5 passing measured runs…
const FRICTION_MIN_RUNS = 3; // …and judges once it has 3 of them (fewer: few-runs)
const FRICTION_KEEP = FRICTION_RUNS * 2; // the trim's lines per check
const FRICTION_MAX_MS = 24 * 3600 * 1000; // a run's ms and a budget: 1 ms – 24 h (a run 0 ms – 24 h)
const BUDGET_MARKERS_MAX = 20; // _Budget:_ markers read from tech.md (one per check at most counts; more → truncated)
const BUDGET_TEXT_MAX = 256 * 1024; // the characters of tech.md read for them (past it → truncated)
const PLATFORM_PREFIX = "friction-"; // the platform item's name: friction-<check> (a backlog entry or a feature, by slug)

const timingsFile = (projectDir) => path.join(specsRoot(projectDir), ".execution", TIMINGS_LOG);
// a timings line as the writer writes it — a hand-made or garbled one is skipped (its check and exit code are read by a compare with
// meta.checks' command and with 0: no other test is needed for them)
const timingLine = (e) => typeof e.checkCmd === "string" && Number.isInteger(e.ms) && e.ms >= 0 && e.ms <= FRICTION_MAX_MS;
// The log's records ONCE per engine call (spec_upgrade runs next_action per feature): memoized in the read-cache scope under a key of
// its own, dropped by recordTiming's append. → readLogTail's { records, read }.
const TIMINGS_MEMO = "\u0000timings:";
function readTimings(projectDir) {
  const file = timingsFile(projectDir);
  const k = CTX.READ_CACHE ? TIMINGS_MEMO + readCacheKey(file) : null;
  if (k !== null && CTX.READ_CACHE.has(k)) return CTX.READ_CACHE.get(k);
  const v = readLogTail(file, 4 * TIMINGS_MAX_BYTES);
  if (k !== null) CTX.READ_CACHE.set(k, v);
  return v;
}

// A budget's duration → ms, or null: a number (≤ 6 digits, ≤ 3 decimals), optional blanks, a unit — ms · s · m / min (minutes) · h,
// any case; 1 ms – 24 h.
const DURATION_UNITS = { ms: 1, s: 1000, m: 60000, min: 60000, h: 3600000 };
const RE_DURATION = /^(\d{1,6}(?:\.\d{1,3})?)[ \t]*(ms|min|s|m|h)$/i;
function parseDuration(text) {
  const m = RE_DURATION.exec(String(text == null ? "" : text).trim());
  if (!m) return null;
  const ms = Math.round(parseFloat(m[1]) * DURATION_UNITS[m[2].toLowerCase()]);
  return ms >= 1 && ms <= FRICTION_MAX_MS ? ms : null;
}

// steering/tech.md's budget markers → { budgets: [{check, ms, line}], invalid: [{line, text, why}], truncated } — tech.md through the
// call's read cache (readIfExists). A marker is `_Budget: <check> <duration>_` (or `*…*`, any case — the task markers' reader under
// its own label: their closer, code spans, fences and HTML comments), anywhere on a visible line; <check> a meta.checks name (backticks
// allowed), text after the closer a comment. Readings: a check + a duration → a budget · a check + anything else → `duration` ·
// another check-shaped name + a duration → `no-check` · a second budget of one check → `duplicate` (the first counts) · anything else
// (`_Budget: $500/month_`, a bold `**Budget:**` label) → not ours, silent. Bounds, each said (`truncated`): the first BUDGET_TEXT_MAX
// characters, the first BUDGET_MARKERS_MAX markers. checks: meta.checks' list (projectChecks), when the caller has it. Not enumerable:
// `scanned` — the lines read for markers (the cost guard's count: a tech.md that never says "budget:" is not scanned — ~110× on 250 KB).
function frictionBudgets(projectDir, checks) {
  const out = { budgets: [], invalid: [], truncated: false };
  Object.defineProperty(out, "scanned", { value: 0, writable: true });
  const text = readIfExists(path.join(specsRoot(projectDir), "steering", "tech.md"));
  if (!text || !/budget:/i.test(text)) return out;
  const names = new Set((checks || projectChecks(projectDir).checks).map((c) => c.name));
  let head = text;
  if (head.length > BUDGET_TEXT_MAX) { head = head.slice(0, BUDGET_TEXT_MAX); out.truncated = true; }
  const lines = scanTaskLines(head);
  out.scanned = lines.length;
  let read = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].code) continue;
    const vis = lines[i].vis;
    for (const sp of labelMarkerSpans(vis, "Budget")) {
      if (++read > BUDGET_MARKERS_MAX) { out.truncated = true; break; }
      const m = /^(`?)([^\s`]+)\1(?:[ \t]+([^]*))?$/.exec(sp.value.trim());
      if (!m) continue;
      const name = m[2], ms = parseDuration(m[3] || "");
      const bad = (why) => out.invalid.push({ line: i + 1, text: vis.slice(sp.start, sp.end).slice(0, 120), why });
      if (!names.has(name)) { if (validCheckName(name) && ms != null) bad("no-check"); }
      else if (ms == null) bad("duration");
      else if (out.budgets.some((b) => b.check === name)) bad("duplicate");
      else out.budgets.push({ check: name, ms, line: i + 1 });
    }
  }
  return out;
}

// One measured run → a timings line per project check it is a run of → { timed: [check names] }. run: {command, exitCode, ms, by:
// "cli" | "hook", at?, cwd?, roots?, tool?, check?} — `check` (finish --run: the check it ran, still in meta.checks) names it; else every
// check whose command the run proves AS ONE COMMAND (runProvesVerify — never observeRun's plain-step fallback: one step's time is no
// check's), its leading `cd <root> &&` stripped as observeRun strips it (stripCdPrefix, the same roots — a worktree's). ms: rounded,
// 0 – FRICTION_MAX_MS, else nothing. Without .specs/ nothing is written (appendLog never creates it, and there is no check); the line goes
// through the appender that makes .execution/ ignore itself. Never throws.
function recordTiming(projectDir, run) {
  try {
    const pdir = path.resolve(projectDir);
    if (!run || typeof run !== "object") return { timed: [] };
    const ms = typeof run.ms === "number" && Number.isFinite(run.ms) ? Math.round(run.ms) : NaN;
    if (!(ms >= 0 && ms <= FRICTION_MAX_MS) || !Number.isInteger(run.exitCode) || (run.by !== "cli" && run.by !== "hook")) return { timed: [] };
    const { checks } = projectChecks(pdir);
    let hit = [];
    if (typeof run.check === "string") hit = checks.filter((c) => c.name === run.check);
    else {
      const roots = [pdir, ...(Array.isArray(run.roots) ? run.roots : [])];
      const key = stripCdPrefix(run.command, roots, typeof run.cwd === "string" && run.cwd ? run.cwd : pdir);
      const bodies = observedBodies(key);
      // (the cheap text test first — the observe hook's pre-filter reading — then the matcher)
      if (bodies.length) hit = checks.filter((c) => { const t = observedNorm(c.command); return bodies.every((b) => t.includes(b)) && runProvesVerify({ command: key }, [c.command], pdir); });
    }
    const at = typeof run.at === "string" && Number.isFinite(Date.parse(run.at)) ? run.at : new Date().toISOString();
    const tool = typeof run.tool === "string" && run.tool ? { tool: run.tool.slice(0, 40) } : {};
    const exDir = path.join(specsRoot(pdir), ".execution");
    const timed = [];
    for (const c of hit) {
      const line = { check: c.name, checkCmd: c.command, exitCode: run.exitCode, ms, at, by: run.by, ...tool };
      if (appendLog(exDir, TIMINGS_LOG, line, (file) => trimTimings(file, checks))) timed.push(c.name);
    }
    if (CTX.READ_CACHE) CTX.READ_CACHE.delete(TIMINGS_MEMO + readCacheKey(timingsFile(pdir))); // this call's memo may be stale now
    return { timed };
  } catch {
    return { timed: [] };
  }
}
// Past TIMINGS_MAX_BYTES: per check meta.checks holds now, the newest FRICTION_KEEP passing lines stamped with its command now — failed
// runs, a changed command's lines and a removed check's dropped (no reader counts them); replaced atomically. Per check, never by newest
// bytes. Two appends while one trims can lose a line (one run fewer in a median). (Called by appendLog, which catches.)
function trimTimings(file, checks) {
  if (fs.statSync(file).size <= TIMINGS_MAX_BYTES) return;
  const live = new Map(checks.map((c) => [c.name, c.command]));
  const kept = new Map();
  const keep = [];
  const { records } = readLogTail(file, 4 * TIMINGS_MAX_BYTES);
  for (let i = records.length - 1; i >= 0; i--) {
    const e = records[i];
    if (!timingLine(e) || e.exitCode !== 0 || live.get(e.check) !== e.checkCmd) continue;
    const n = kept.get(e.check) || 0;
    if (n >= FRICTION_KEEP) continue;
    kept.set(e.check, n + 1);
    keep.push(JSON.stringify(e) + "\n");
  }
  writeFileAtomic(file, keep.reverse().join(""));
}

// Each check's newest FRICTION_RUNS passing measured runs, newest first in FILE order (no clock: a line's `at` is never read) → { runs:
// Map name → [ms…], read (the bytes read: 4 × TIMINGS_MAX_BYTES at most) }. A line counts while meta.checks still runs the command it
// names (checkCmd — a string compare).
function checkTimings(projectDir, checks) {
  const cmd = new Map(checks.map((c) => [c.name, c.command]));
  const runs = new Map(checks.map((c) => [c.name, []]));
  const { records, read } = readTimings(projectDir);
  for (let i = records.length - 1; i >= 0; i--) {
    const e = records[i];
    if (!timingLine(e) || e.exitCode !== 0 || cmd.get(e.check) !== e.checkCmd) continue;
    const list = runs.get(e.check);
    if (list.length < FRICTION_RUNS) list.push(e.ms);
  }
  return { runs, read };
}

// spec_metrics' project `friction` → null (no check, or no budget, no unreadable budget and no measured run) · { checks: [{check,
// budgetMs, runs, medianMs, minMs, maxMs, status}] (meta.checks' order: a check with a budget or a measured passing run), invalid:
// [{line, text, why, message}], truncated? }. status (stable): over (the median above the budget) · within (at or below it — the
// boundary is within) · few-runs (fewer than FRICTION_MIN_RUNS) · no-runs (a budget, no measured run) · unbudgeted. lng: the
// messages' language (the project's). Not enumerable: `read` — the bytes of timings.jsonl read (the cost guard's count).
function frictionStatus(projectDir, lng) {
  const { checks } = projectChecks(projectDir);
  return checks.length ? frictionOf(projectDir, checks, frictionBudgets(projectDir, checks), lng) : null;
}
function frictionOf(projectDir, checks, b, lng) {
  const { runs, read } = checkTimings(projectDir, checks);
  const budget = new Map(b.budgets.map((x) => [x.check, x.ms]));
  const items = [];
  for (const c of checks) {
    const list = runs.get(c.name).slice().sort((x, y) => x - y);
    const budgetMs = budget.has(c.name) ? budget.get(c.name) : null;
    const n = list.length;
    if (budgetMs == null && !n) continue;
    const medianMs = !n ? null : n % 2 ? list[(n - 1) / 2] : Math.round((list[n / 2 - 1] + list[n / 2]) / 2);
    const status = budgetMs == null ? "unbudgeted" : !n ? "no-runs" : n < FRICTION_MIN_RUNS ? "few-runs" : medianMs > budgetMs ? "over" : "within";
    items.push({ check: c.name, budgetMs, runs: n, medianMs, minMs: n ? list[0] : null, maxMs: n ? list[n - 1] : null, status });
  }
  if (!items.length && !b.invalid.length) return null;
  const F = i18n.msg(lng).friction;
  const names = checks.map((c) => c.name).join(", ");
  const out = { checks: items, invalid: b.invalid.map((x) => ({ ...x, message: F.invalid(x.line, x.text, x.why, names) })), ...(b.truncated ? { truncated: true } : {}) };
  Object.defineProperty(out, "read", { value: read, enumerable: false });
  return out;
}
// The CLI's spec_metrics lines for it (finish.js metricsLines, the project view) → [lines].
function frictionLines(fr, lng) {
  if (!fr) return [];
  const F = i18n.msg(lng).friction, ms = i18n.fmtMs;
  const item = (c) => (c.status === "over" ? F.over(c.check, ms(c.medianMs), ms(c.budgetMs), c.runs)
    : c.status === "within" ? F.within(c.check, ms(c.medianMs), ms(c.budgetMs), c.runs)
      : c.status === "few-runs" ? F.fewRuns(c.check, c.runs, FRICTION_MIN_RUNS)
        : c.status === "no-runs" ? F.noRuns(c.check) : F.unbudgeted(c.check, ms(c.medianMs), c.runs));
  return [...(fr.checks.length ? [F.metrics(fr.checks.map(item).join(" · "))] : []), ...fr.invalid.map((x) => "    ▲ " + x.message), ...(fr.truncated ? ["    ▲ " + F.truncated] : [])];
}

// next_action's finish step (doctor.js tasksStep — its LAST hint; never at `implement`: no per-task nag): each budgeted check `over` that
// neither a backlog entry nor a feature folder (active or archived — spec_create prunes the backlog entry it fulfils) answers to as
// `friction-<check>` (by slug, as the backlog matches names) → { text, over: [{check, medianMs, budgetMs, runs}] } | null. The engine
// never files it: the user does — or raises or removes the budget. Reads nothing more than meta.checks without a budget line.
function frictionHint(projectDir, lng) {
  const { checks } = projectChecks(projectDir);
  if (!checks.length) return null;
  const b = frictionBudgets(projectDir, checks);
  if (!b.budgets.length) return null;
  const st = frictionOf(projectDir, checks, b, lng);
  const over = st ? st.checks.filter((c) => c.status === "over") : [];
  if (!over.length) return null;
  const backlog = readRoadmap(projectDir).backlog;
  const listed = new Set((Array.isArray(backlog) ? backlog : []).filter((x) => isObj(x) && typeof x.name === "string").map((x) => slugify(x.name)));
  const open = over.filter((c) => !listed.has(slugify(PLATFORM_PREFIX + c.check)) && !locateFeatures(projectDir, PLATFORM_PREFIX + c.check).length);
  if (!open.length) return null;
  const F = i18n.msg(lng).friction, ms = i18n.fmtMs;
  const items = open.map((c) => F.naItem(c.check, ms(c.medianMs), c.runs, ms(c.budgetMs))).join("; ");
  const cmds = open.map((c) => `${i18n.DEV_SPEC} backlog add "${PLATFORM_PREFIX}${c.check}" "${F.backlogNote(ms(c.medianMs), c.runs, ms(c.budgetMs))}"`).join(" · ");
  return { text: F.naHint(items, cmds), over: open.map((c) => ({ check: c.check, medianMs: c.medianMs, budgetMs: c.budgetMs, runs: c.runs })) };
}

module.exports = { parseDuration, frictionBudgets, recordTiming, frictionStatus, frictionLines, frictionHint, TIMINGS_MAX_BYTES, __link };

"use strict";

/**
 * dev-spec-driven engine — +port (1.36): port first, improve later.
 * The fence a +port plan's two anchors draw over tasks.md (portAnchors): B, the baseline — the first task under the track's lead
 * template heading (the one naming its Behaviour Baseline section), else the first task citing a [PORT] criterion — and D, the
 * differential check — the last task under its other template heading that cites a [PORT] criterion, else the first task under it,
 * else the last citing task. Every task listed after B (D included) waits for B, every task listed after D waits for D; nothing before
 * B is held; B == D (a D listed before B counts as none): everything after waits for it. An anchor opens the fence only ticked AND
 * verified with a runnable _Verify:_ (taskVerification: no reason — an unverified tick, or any tick of a [PORT] task without a runnable
 * _Verify:_, opens nothing). portTask: the gate complete_task and the brief apply (`gated: "port-order"`, `heldBy` — checked
 * before anything is recorded; the brief carries it, so `done --run` runs nothing) and the brief's portRole; portSchedule: the next
 * task with the held ones passed over (spec_next_task, next_action, the status line); portPlanCheck /
 * portPlanProbe: doctor's port-verify and the tasks approval's probe at size m / l; portRunState: the re-check of D after the
 * improvements (doctor port-recheck, spec_finish's port-recheck blocker, next_action's step before the finish) and the fence audit
 * (doctor port-fence) — read from what
 * .state.json already holds (the evidence `at` and `history`, `ticks`): no state, no merge rule of its own.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let blockPosition, designReuseGated, duplicateTaskNumbers, EVIDENCE_HISTORY, extractAcIds, isRecord, normTaskHeading, ownEvidence, readIfExists,
  taskDependsSpec, taskMarkers, taskProse, taskSchedule, taskVerification, trackAcIds, trackSectionTable, trackTaskHeadings;
function __link(E) { ({ blockPosition, designReuseGated, duplicateTaskNumbers, EVIDENCE_HISTORY, extractAcIds, isRecord, normTaskHeading, ownEvidence,
  readIfExists, taskDependsSpec, taskMarkers, taskProse, taskSchedule, taskVerification, trackAcIds, trackSectionTable, trackTaskHeadings } = E); }

// +port applies to a plain feature (a bugfix refuses it; a spike / a change has no track)
const portOn = (kind, tracks) => (kind || "feature") === "feature" && Array.isArray(tracks) && tracks.includes("port");

// The two anchors over `blocks` (a tasks.md's task blocks, in file order) → { b, d } — indices, -1: none. reqText: requirements.md
// (the [PORT] criteria a task may cite — trackAcIds). The lead heading is the track's template heading naming the Behaviour Baseline
// (a strict name of its first section, in any language); the other one is the differential check's.
function portAnchors(blocks, reqText) {
  const heads = trackTaskHeadings("port");
  const first = (trackSectionTable("port") || [])[0] || { syn: [] };
  const leadNames = first.syn.filter((s) => !(first.loose || []).includes(s));
  const acs = trackAcIds(reqText || "", "port");
  const under = blocks.map((x) => {
    const h = x.phase ? normTaskHeading(x.phase) : "";
    return !h || !heads.has(h) ? null : leadNames.some((s) => h.includes(s)) ? "lead" : "main";
  });
  const cites = (x) => acs.size > 0 && [...extractAcIds(taskProse(x).join(" "))].some((id) => acs.has(id));
  let b = under.indexOf("lead");
  if (b < 0) b = blocks.findIndex(cites);
  // D: the last task under the differential check's heading citing a [PORT] criterion (the template's does — a task written after it
  // in its section is never the check), else the first task under that heading, else the last citing task
  const mains = under.map((u, i) => (u === "main" ? i : -1)).filter((i) => i >= 0);
  let d = -1;
  for (let k = mains.length - 1; k >= 0 && d < 0; k--) if (cites(blocks[mains[k]])) d = mains[k];
  // uncited: no task under that heading cites one — its first task is taken (port-verify warns: a prep task there would be D — 1.36
  // review 2, P2-4)
  const uncited = d < 0 && mains.length > 0;
  if (uncited) d = mains[0];
  if (d < 0) for (let i = blocks.length - 1; i >= 0; i--) if (cites(blocks[i])) { d = i; break; }
  // a differential check listed before the baseline compares nothing yet: read as absent (B == D — every task after the baseline
  // waits for it, nothing before it is held); port-verify names the order (early: its index)
  if (d >= 0 && d < b) return { b, d: b, early: d };
  return { b, d, ...(uncited ? { uncited } : {}) };
}
// the anchors, distinct, in file order
const anchorList = (b, d) => [...new Set([b, d])].filter((i) => i >= 0).sort((x, y) => x - y);
// A task's evidence view: its own record (a duplicated number's other task's never counts) and its verdict.
function evidenceView(blocks, evidence, rule) {
  const ev = isRecord(evidence) ? evidence : {};
  const dups = new Set(duplicateTaskNumbers(blocks));
  return { rec: (x) => ownEvidence(ev, x, dups.has(x.number)), open: (x) => {
    // a [PORT] task without a runnable _Verify:_ (taskMarkers drops a [slot]) never opens the fence: a note ticks it, and taskVerification
    // passes a verify-less task on a note (with one, no reason means a passing run of it)
    if (!x.done || !taskMarkers(x).verify.length) return false;
    const v = taskVerification(ev, x, dups.has(x.number), rule);
    return !v.reason && !v.nothingToVerify;
  } };
}
// "#3, #4, #5 (+N more)"
function numList(nums, lng) {
  return nums.slice(0, 8).map((n) => "#" + n).join(", ") + (nums.length > 8 ? " " + i18n.msg(lng).gates.more(nums.length - 8) : "");
}

// complete_task's and the brief's view of ONE task of a +port plan → null (off +port, no anchor, the task not in `blocks`) or
// { gate: null | { gated: "port-order", heldBy: [n…], error }, role: null | "port" | "after", differential?: n }.
// gate: the anchors listed before the task that are not open, in file order (heldBy, stable); the error names the first — open, or
// ticked but not verified. role (the brief's definition of done): a task between B and D "port"; after D "after" (+ differential: D's
// number); never an anchor, a task before B, or an "after" in a plan with one anchor.
function portTask(dir, kind, tracks, blocks, task, evidence, rule, lng, slug) {
  if (!portOn(kind, tracks) || !task) return null;
  const pos = blockPosition(blocks, task);
  if (pos < 0) return null;
  const { b, d } = portAnchors(blocks, readIfExists(path.join(dir, "requirements.md")));
  if (b < 0) return null;
  const view = evidenceView(blocks, evidence, rule);
  const held = anchorList(b, d).filter((i) => i < pos && !view.open(blocks[i]));
  let gate = null;
  if (held.length) {
    const a = blocks[held[0]], G = i18n.msg(lng).gates;
    gate = { gated: "port-order", heldBy: held.map((i) => blocks[i].number), error: (a.done ? G.portHeldUnverified : G.portHeld)(task.number, a.number, slug) };
  }
  const role = pos === b || pos === d || pos < b ? null : d > b && pos > d ? "after" : "port";
  return { gate, role, ...(role === "after" ? { differential: blocks[d].number } : {}) };
}

// The task numbers the fence holds now — every task listed after the first anchor that is not ticked AND verified — or an empty
// set (off +port, no anchor). The protected tests (protect.js, guard tests): a held task cannot start now, so it unlocks no test; next
// --batch never adds one (1.36 review 3).
function portHeldNumbers(dir, kind, tracks, blocks, evidence, rule) {
  if (!portOn(kind, tracks)) return new Set();
  const { b, d } = portAnchors(blocks, readIfExists(path.join(dir, "requirements.md")));
  if (b < 0) return new Set();
  const view = evidenceView(blocks, evidence, rule);
  const closed = anchorList(b, d).find((i) => !view.open(blocks[i]));
  return closed === undefined ? new Set() : new Set(blocks.slice(closed + 1).map((x) => x.number));
}
// The next task with the fence applied (1.36 review 1 — spec_next_task, next_action, the status line): taskSchedule's, the tasks the
// fence holds passed over → { sch: taskSchedule's result, held: null | { number: the first open task it passed over, heldBy, anchor:
// the first of them, ticked: that anchor is ticked (unverified: only its run opens the fence), runnable: it has a runnable _Verify:_ } }.
// (next --batch reads portHeldNumbers: it holds the same tasks when the next one is the open anchor itself — 1.36 review 3.)
function portSchedule(dir, kind, tracks, blocks, evidence, rule) {
  const sch = taskSchedule(blocks);
  if (!sch.next || !portOn(kind, tracks)) return { sch, held: null };
  const { b, d } = portAnchors(blocks, readIfExists(path.join(dir, "requirements.md")));
  const view = evidenceView(blocks, evidence, rule);
  const closed = b < 0 ? [] : anchorList(b, d).filter((i) => !view.open(blocks[i]));
  const by = closed.filter((i) => i < blockPosition(blocks, sch.next));
  if (!by.length) return { sch, held: null };
  const a = blocks[by[0]], hold = new Set(blocks.slice(by[0] + 1).map((x) => x.number));
  return { sch: taskSchedule(blocks, hold),
    held: { number: sch.next.number, heldBy: by.map((i) => blocks[i].number), anchor: a.number, ticked: a.done, runnable: taskMarkers(a).verify.length > 0 } };
}

// Is the plan's fence complete: both anchors there — two tasks, the baseline listed first —, each with a runnable _Verify:_
// (taskMarkers drops a [slot])? → { ok, both, b, d, early, uncited, noVerify: [n…] } (early: a differential check listed before the
// baseline; uncited: D taken as the first task under its heading — none there cites a [PORT] criterion)
function portPlan(blocks, reqText) {
  const { b, d, early, uncited } = portAnchors(blocks, reqText);
  const noVerify = anchorList(b, d).filter((i) => !taskMarkers(blocks[i]).verify.length).map((i) => blocks[i].number);
  const both = b >= 0 && d > b;
  return { ok: both && !noVerify.length, both, b, d, early, uncited: !!uncited, noVerify };
}
// port-verify's detail for an incomplete fence: a differential check listed before the baseline, no pair of anchors, an anchor
// without a runnable _Verify:_
function planGap(p, blocks, lng) {
  const P = i18n.msg(lng).port;
  return p.early != null ? P.verifyOrder(blocks[p.early].number, blocks[p.b].number) : !p.both ? P.verifyMissing : P.noVerify(numList(p.noVerify, lng));
}
// tasks listed before the baseline (baselineLate) → its detail, or null — a project tasks template with no level-2 heading over its
// first task gets the baseline appended after them (templates.js beforeFirstTaskSection), add_track on a written plan too
const lateDetail = (p, blocks, lng) => (p.b > 0 ? i18n.msg(lng).port.baselineLate(numList(blocks.slice(0, p.b).map((x) => x.number), lng), blocks[p.b].number) : null);
// The tasks approval's probe at size m / l (designReuseGated) — [[ok, detail]…] (the first failing one counts), [] elsewhere: the fence
// complete, then the baseline first (1.36 review 2, P2-1: a plan with the port's tasks before it was approved at m without a word)
function portPlanProbe(blocks, reqText, kind, tracks, size, lng) {
  if (!portOn(kind, tracks) || !designReuseGated(kind, size)) return [];
  const p = portPlan(blocks, reqText);
  const late = lateDetail(p, blocks, lng);
  return [[p.ok, planGap(p, blocks, lng)], ...(late ? [[false, late]] : [])];
}
// doctor's port-verify (phase 5) over the ACTIVE tasks → { status, detail }. The fence incomplete (portPlan), or tasks listed before
// the baseline (baselineLate): a FAIL at size m / l (the approval refuses it) unless the tasks are approved already (then a warn + the
// next approval requires it — never a phase failed retroactively: add_track on an approved plan appends the baseline), a warn at s /
// no size. Warns besides: a task listed after the baseline whose _Depends:_ never reaches it (a wave would start it first — a task
// without _Depends:_ waits by tasks order), no task under the differential check's heading citing a [PORT] criterion (its first task
// is taken for the check). The pass detail is the fence as the plan reads.
function portPlanCheck(blocks, reqText, kind, size, approved, lng) {
  const P = i18n.msg(lng).port;
  const p = portPlan(blocks, reqText);
  const gated = designReuseGated(kind, size);
  if (!p.ok) {
    const detail = planGap(p, blocks, lng) + (approved ? " " + P.approvedAlready : "");
    return { status: gated && !approved ? "fail" : "warn", detail };
  }
  const B = blocks[p.b].number, warns = [];
  const late = lateDetail(p, blocks, lng);
  if (late) warns.push(late);
  // the tasks whose _Depends:_ chain reaches the baseline: B, a task after it without _Depends:_ (it waits by tasks order), a task
  // declaring one that names such a task — propagated backwards over the declared edges (linear, iterative)
  const byNum = new Map();
  blocks.forEach((x, i) => { if (!byNum.has(x.number)) byNum.set(x.number, []); byNum.get(x.number).push(i); });
  const specs = blocks.map((x) => taskDependsSpec(x));
  const users = new Map(); // dependency index → the indices that declare it
  specs.forEach((s, i) => { if (s.declared) for (const n of s.numbers) for (const j of byNum.get(n) || []) { if (!users.has(j)) users.set(j, []); users.get(j).push(i); } });
  const reach = new Set([p.b]);
  specs.forEach((s, i) => { if (i > p.b && !s.declared) reach.add(i); });
  const queue = [...reach];
  while (queue.length) for (const i of users.get(queue.pop()) || []) if (!reach.has(i)) { reach.add(i); queue.push(i); }
  const escape = blocks.map((x, i) => (i > p.b && specs[i].declared && !reach.has(i) ? x.number : null)).filter((n) => n != null);
  if (escape.length) warns.push(P.dependsEscape(numList(escape, lng), B));
  if (p.uncited) warns.push(P.dUncited(blocks[p.d].number));
  if (late && gated) return { status: approved ? "warn" : "fail", detail: warns.join("; ") + (approved ? " " + P.approvedAlready : "") };
  if (warns.length) return { status: "warn", detail: warns.join("; ") };
  const waiting = blocks.slice(p.d + 1).map((x) => x.number);
  return { status: "pass", detail: P.verifyOk(B, blocks[p.d].number, waiting.length ? numList(waiting, lng) : "") };
}

// --- the instants (ms; NaN: none), from the evidence records (`at`, `noteAt`, their bounded `history` of runs) and `ticks` ---
const ms = (v) => (typeof v === "string" ? Date.parse(v) : NaN);
const latest = (list) => { let m = NaN; for (const x of list) if (!Number.isNaN(x) && !(x <= m)) m = x; return m; };
const earliest = (list) => { let m = NaN; for (const x of list) if (!Number.isNaN(x) && !(x >= m)) m = x; return m; };
// a record's runs, oldest first: its history holds the latest run too (recordEvidence); a v1.12 record is its one run
const runsOf = (rec) => (!isRecord(rec) ? [] : Array.isArray(rec.history) && rec.history.length ? rec.history.filter(isRecord) : rec.exitCode != null ? [rec] : []);
// a run that ticks its task: exit 0 — an _Expect: fail_ run (expected "fail"): a red one
const ticking = (r) => r.exitCode != null && (r.expected === "fail" ? r.exitCode !== 0 : r.exitCode === 0);
const firstPass = (rec) => earliest(runsOf(rec).filter(ticking).map((r) => ms(r.at)));
// an anchor's first pass, as the fence audit reads it: its first passing run on record — unknown once its bounded history is full (the
// runs before the window, its true first pass among them, are gone: -Infinity, no task is flagged for being ticked before it; one with
// no record of when still is) — re-running an anchor (the brief asks it after each improvement) never flags honest work
const anchorPass = (rec) => (runsOf(rec).length >= EVIDENCE_HISTORY ? -Infinity : firstPass(rec));
// when a done task was first ticked: its first ticking run, else its note, else its tick (NaN: no record of when — a checkbox
// edited by hand)
function firstTick(rec, tick) {
  const run = firstPass(rec);
  if (!Number.isNaN(run)) return run;
  const note = isRecord(rec) ? earliest([rec.exitCode == null ? ms(rec.at) : NaN, ms(rec.noteAt)]) : NaN;
  return Number.isNaN(note) ? ms(tick) : note;
}
// its latest activity: its last tick, run or note
const lastTouch = (rec, tick) => latest([ms(tick), ...runsOf(rec).map((r) => ms(r.at)), ...(isRecord(rec) ? [ms(rec.noteAt), rec.exitCode == null ? ms(rec.at) : NaN] : [])]);

// The re-check and the fence audit over the ACTIVE tasks → null (no anchor) or { recheck: null | { d, tasks: [n…] }, fence: [{ number,
// anchor }] }.
//   recheck — D ticked and verified, its latest run (the one that verifies it) older than the latest tick / run of a done task listed
//             after it: the improvements were never compared with the baseline since (doctor warns, spec_finish blocks — `done <f> <D>
//             --run`); not in a plan with one anchor.
//   fence   — a done task listed after an anchor, first ticked before that anchor first passed, while it never has, or with no record
//             of when: the fence was gone round (a task moved, +port off and on again, a checkbox edited by hand) — doctor warns.
function portRunState(blocks, reqText, evidence, ticks, rule) {
  const { b, d } = portAnchors(blocks, reqText);
  if (b < 0) return null;
  const view = evidenceView(blocks, evidence, rule);
  const tk = isRecord(ticks) ? ticks : {};
  const tick = (x) => tk[String(x.number)];
  let recheck = null;
  if (d > b && view.open(blocks[d])) {
    const dAt = ms((view.rec(blocks[d]) || {}).at);
    const later = blocks.slice(d + 1).filter((x) => x.done && lastTouch(view.rec(x), tick(x)) > dAt).map((x) => x.number);
    if (later.length) recheck = { d: blocks[d].number, tasks: later };
  }
  const anchors = anchorList(b, d);
  const passed = new Map(anchors.map((i) => [i, anchorPass(view.rec(blocks[i]))]));
  const fence = [];
  blocks.forEach((x, i) => {
    if (!x.done) return;
    // (NaN on either side compares false: an anchor that never passed, a task with no record of when, flag it)
    const a = anchors.find((k) => k < i && !(firstTick(view.rec(x), tick(x)) >= passed.get(k)));
    if (a !== undefined) fence.push({ number: x.number, anchor: blocks[a].number });
  });
  return { recheck, fence };
}
// doctor's port-recheck / port-fence (phase 6) → [{ id, status, detail }] (warns only; nothing to say: [])
function portRunChecks(blocks, reqText, evidence, ticks, rule, lng, slug) {
  const r = portRunState(blocks, reqText, evidence, ticks, rule);
  if (!r) return [];
  const P = i18n.msg(lng).port, out = [];
  if (r.recheck) out.push({ id: "port-recheck", status: "warn", detail: P.recheck(r.recheck.d, numList(r.recheck.tasks, lng), slug) });
  if (r.fence.length) out.push({ id: "port-fence", status: "warn", detail: P.fence(r.fence.slice(0, 8).map((f) => "#" + f.number + " (#" + f.anchor + ")").join(", ") +
    (r.fence.length > 8 ? " " + i18n.msg(lng).gates.more(r.fence.length - 8) : "")) });
  return out;
}
// spec_finish's port-recheck blocker → its detail, or null
function portFinishRecheck(blocks, reqText, evidence, ticks, rule, lng, slug) {
  const r = portRunState(blocks, reqText, evidence, ticks, rule);
  return r && r.recheck ? i18n.msg(lng).port.recheck(r.recheck.d, numList(r.recheck.tasks, lng), slug) : null;
}
// next_action's and the status line's step before the finish (1.36 review 1): that blocker pending → { d, text } (re-run the
// differential check first, then the project checks — the re-run is task activity), or null
function portRecheckNext(blocks, reqText, evidence, ticks, rule, lng, slug) {
  const r = portRunState(blocks, reqText, evidence, ticks, rule);
  return r && r.recheck ? { d: r.recheck.d, text: i18n.msg(lng).port.naRecheck(r.recheck.d, numList(r.recheck.tasks, lng), slug) } : null;
}
// Does a plan draw the fence at all (a baseline anchor)? — spec_import warns when an imported tasks.md of a +port feature doesn't.
const portAnchored = (blocks, reqText) => portAnchors(blocks, reqText).b >= 0;
// The differential check's task number in a plan with both anchors, or null — next_action's finish step says to run it again after
// any fix from there on (the review panel's included: port-recheck counts only tasks listed after it — 1.36 review 2, P2-2). Null too
// when it has no runnable _Verify:_ (1.36 review 3: the line named a `done --run` that exits 1 — port-recheck never reads such a D either).
function portCheckNumber(blocks, reqText) {
  const { b, d } = portAnchors(blocks, reqText);
  return b >= 0 && d > b && taskMarkers(blocks[d]).verify.length ? blocks[d].number : null;
}

module.exports = { portOn, portTask, portHeldNumbers, portSchedule, portPlanProbe, portPlanCheck, portRunChecks, portFinishRecheck, portRecheckNext,
  portAnchored, portCheckNumber, __link };

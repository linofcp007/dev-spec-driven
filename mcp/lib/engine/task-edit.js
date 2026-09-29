"use strict";

/**
 * dev-spec-driven engine — task mutations: spec_complete_task, untick, spec_append_tasks.
 * Ticking a task with its evidence (the bugfix gate first), unticking one, and appending new tasks (converge) —
 * existing tasks are never renumbered or edited.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, activeTasks, artifactMatches, atxHeading, bugSectionFilled, cleanTaskText, dependencyCycles, detectTracks,
  errs, evidenceRule, existingFeature, expectFailRefusal, expectFailResult, expectFailRun, expectsFail, extractTestIds,
  featureLang, ghostMarkers, idKey, inactiveTaskLines, isObj, isPackTrack, isRecord, markerTracks, maybeRefreshRoadmap,
  normalizeEvidence, normTaskHeading, observedAny, observedStamp, openDependenciesOf, own, ownEvidence, ownRecord,
  parseTasks, planIdText, RE_CHECKPOINT, RE_DEP_TOKEN, RE_GLOBAL_CONSTRAINTS, readIfExists, readState, redPhaseHint,
  redProof, resolveTask, ROOT_CAUSE_SYN, scanTaskLines, secondaryDefinitions, SIZE_POINTS, statePath, storeEvidence,
  taskBlocks, taskDependsSpec, taskDepGraph, taskDepsBlockedNote, taskMarkers, taskProse, taskSchedule, taskSize,
  taskVerification, tKey, trackMarker, trackTaskHeadings, verifyPipeMasked, writeFileAtomic;
function __link(E) { ({ acIndex, activeTasks, artifactMatches, atxHeading, bugSectionFilled, cleanTaskText,
  dependencyCycles, detectTracks, errs, evidenceRule, existingFeature, expectFailRefusal, expectFailResult,
  expectFailRun, expectsFail, extractTestIds, featureLang, ghostMarkers, idKey, inactiveTaskLines, isObj, isPackTrack,
  isRecord, markerTracks, maybeRefreshRoadmap, normalizeEvidence, normTaskHeading, observedAny, observedStamp,
  openDependenciesOf, own, ownEvidence, ownRecord, parseTasks, planIdText, RE_CHECKPOINT, RE_DEP_TOKEN,
  RE_GLOBAL_CONSTRAINTS, readIfExists, readState, redPhaseHint, redProof, resolveTask, ROOT_CAUSE_SYN, scanTaskLines,
  secondaryDefinitions, SIZE_POINTS, statePath, storeEvidence, taskBlocks, taskDependsSpec, taskDepGraph,
  taskDepsBlockedNote, taskMarkers, taskProse, taskSchedule, taskSize, taskVerification, tKey, trackMarker,
  trackTaskHeadings, verifyPipeMasked, writeFileAtomic } = E); }

const RE_ROOT_CAUSE_TASK = /(?<![\p{L}])(?:root[\s-]+cause|causa[\s-]+ra[ií]z)(?![\p{L}])/iu;

// Bugfix iron law, enforced during execution: while bug.md → Root Cause is unfilled, no task positioned AFTER the
// one that writes it can be completed (ticked or given evidence): no fix before the root cause is written in bug.md.
// "The one that writes it" = the first task that references the Root Cause SECTION — it names bug.md and a Root Cause
// synonym (root cause / causa raiz / causa raíz) — and is not itself a fix: a task carrying _Makes green:_ or _Verify:_
// never qualifies. A bare "root cause" mention is not enough: the template's own fix task ("Fix the root cause",
// "Corrigir a causa raiz") would otherwise open the gate for itself once step 2 is reworded. Without such a task only
// the first task can be completed. → null (allowed) or { gated: 'root-cause', error } (localized).
function bugfixGate(dir, kind, blocks, task, lng) {
  if (kind !== "bugfix" || !task || bugSectionFilled(readIfExists(path.join(dir, "bug.md")), ROOT_CAUSE_SYN)) return null;
  const pos = blockPosition(blocks, task);
  const rc = rootCauseTaskIndex(blocks);
  if (pos <= Math.max(rc, 0)) return null;
  const GT = i18n.msg(lng).gates;
  // The root-cause task already ticked with the section still empty: "do task 2 first" would name a task shown as done.
  const error = rc === -1 ? GT.bugGateFirst(task.number, blocks[0].number)
    : blocks[rc].done ? GT.bugGateTicked(task.number, blocks[rc].number) : GT.bugGate(task.number, blocks[rc].number);
  return { gated: "root-cause", error };
}
// The task that writes bug.md → Root Cause (bugfixGate's rule), as an index into `blocks`, or -1.
function rootCauseTaskIndex(blocks) {
  return blocks.findIndex((b) => {
    const t = taskProse(b).join(" ");
    const mk = taskMarkers(b);
    return RE_ROOT_CAUSE_TASK.test(t) && /(?<![\p{L}\p{N}_])bug\.md(?![\p{L}\p{N}_])/iu.test(t) && !mk["makes green"].length && !mk.verify.length;
  });
}
// A task's position in the WHOLE file (a brief's "next task" comes from the active view, whose objects differ).
function blockPosition(blocks, task) {
  const pos = blocks.indexOf(task);
  return pos !== -1 ? pos : blocks.findIndex((b) => b.number === task.number && b.text === task.text && b.done === task.done);
}
// A task number as given by a caller → the integer, or NaN. Digits only ("01" is task 1, like the "01." it names) or a
// safe non-negative integer: parseInt read "1.9" and "2abc" as tasks 1 and 2 (and 1e21 as 1) — the CLI's `brief 1.9`
// briefed task 1 where spec_task_brief {number: 1.9} is refused. The same rule on every surface.
function taskNumber(v) {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? v : NaN;
  if (typeof v !== "string" || !/^\s*\d+\s*$/.test(v)) return NaN;
  const n = parseInt(v, 10);
  return Number.isSafeInteger(n) ? n : NaN;
}
// opts.ranBy "cli" (1.14 F1): the CLI's `done --run` ran the command itself — the record's observed stamp is "cli". The MCP
// server never passes it (and normalizeEvidence keeps no caller-given `observed`): a reported run is looked up in the
// harness's log (observedRun).
function completeTask(projectDir, name, number, evidence, opts = {}) {
  if (opts && opts.undo === true) return untickTask(projectDir, name, number, { reason: opts.reason, evidence }); // 1.16 U1
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  // 1.16 U1: a reason explains an undo — a tick records evidence instead (refused, never silently dropped).
  if (opts && opts.reason != null) return { ok: false, error: i18n.msg(featureLang(projectDir, f.slug)).undo.reasonNeedsUndo };
  const file = path.join(f.dir, "tasks.md");
  const text = readIfExists(file);
  const E = errs(projectDir, f.slug);
  if (text == null) return { ok: false, error: E.tasksMissing(f.slug) };
  const n = taskNumber(number); // "01" is task 1, like the "01." it names
  if (!Number.isFinite(n)) return { ok: false, error: E.numberInt };
  // The same scanner + resolver as status/brief/`done --run`: a "- [ ] N." inside a comment or a code fence
  // is never ticked, "1.1" is not task 1, and a duplicated number resolves to its first OPEN task.
  const blocks = taskBlocks(text);
  const task = resolveTask(blocks, n);
  if (!task) return { ok: false, error: E.taskNotFound(n) };
  const dup = blocks.filter((b) => b.number === n).length > 1;
  const lng = featureLang(projectDir, f.slug);
  const EV = i18n.msg(lng).evidence;
  const EG = i18n.msg(lng).evidenceGate;
  const ev = normalizeEvidence(evidence);
  if (ev && ev.error) return { ok: false, error: ev.error === "badExit" ? EV.badExit(ev.value) : ev.error === "noContent" ? EG.noContent : EV.needsExit };
  // Validate the state BEFORE touching tasks.md: a broken .state.json used to throw after the tick,
  // leaving a ticked task with no evidence.
  const state = readState(projectDir, f.slug);
  const bad = state.invalid; // readState refuses wrong-shape JSON (evidence/approvals/tracks/top level) — checked before any write
  if (bad) return { ok: false, error: bad };
  // Bugfix iron law (bugfixGate): no fix before the root cause is written in bug.md. Checked before anything is
  // recorded or ticked.
  const gate = bugfixGate(f.dir, state.kind, blocks, task, lng);
  if (gate) return { ok: false, ...gate };
  const key = String(n);
  // 1.14 F1: every run {command, exitCode} is stamped observed: true | false (the harness's log) | "cli" (`done --run`), and
  // every result of this call carries it (stable).
  const observed = observedStamp(projectDir, f.slug, ev, opts && opts.ranBy);
  if (observed !== undefined) ev.observed = observed;
  const withObserved = (r) => (observed !== undefined ? Object.assign(r, { observed }) : r);
  // _Expect: fail_ (B5): a red run {command, exitCode ≠ 0} is the proof; a passing run is refused unless a red run of this
  // _Verify:_ was recorded before it (the fix made the test green); a could-not-run exit (127, 9009…) is refused like a failure.
  const xf = expectsFail(task) ? expectFailRun(ev, ownEvidence(state.evidence || {}, task, dup)) : null;
  // The run is stored with expected: "fail" (metrics count a red run as a pass, an unexpected pass as a failure) — except the
  // pass after the red run: a plain passing run that keeps the red run as the record's proof (recordEvidence).
  // Any run that is not itself the red proof (a pass after it, a could-not-run exit, a refused pass) carries the red run on
  // record forward: one exit 127 used to drop it, and every later (fixed, passing) run was then refused as unexpected-pass.
  if (xf && ev && ev.exitCode != null) {
    if (xf.passAfterRed) ev.keepRed = true;
    else { ev.expected = "fail"; if (!xf.red) ev.keepRed = true; }
  }
  const failed = !!ev && ev.exitCode != null && (xf ? xf.refused : ev.exitCode !== 0);
  const alreadyDone = task.done;
  const now = new Date().toISOString();
  if (ev) { // every run is recorded — a failure too (never ticked), so a later note can't paper over it
    state.evidence = state.evidence || {};
    // Only THIS task's record is extended; another task's record under the same number is kept aside.
    state.evidence[key] = storeEvidence(state.evidence[key], task, dup, ev, now);
  }
  const ticks = !alreadyDone && !failed;
  if (ticks) {
    state.lastTickAt = now; // spec_finish's suite-evidence needs every project check run AFTER the last tick
    // when this task was ticked (state.ticks[n]) — the roadmap forecasts' completion times; a hand-broken ticks value is left alone
    if (state.ticks === undefined || isRecord(state.ticks)) state.ticks = { ...(state.ticks || {}), [key]: now };
  }
  if (ev || ticks) writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2)); // one write, before the tick
  let updated = text;
  if (ticks) {
    // Tick the resolved line at its checkbox column (line endings, CRLF included, are kept).
    const lines = text.split("\n");
    const raw = lines[task.line];
    lines[task.line] = raw.slice(0, task.col) + "x" + raw.slice(task.col + 1);
    updated = lines.join("\n");
    // Replaced atomically: a reader in another process (status, a hook, a second server) never catches a truncated
    // tasks.md — it used to refuse a real task as "not found" mid-write.
    writeFileAtomic(file, updated);
  }
  if (updated !== text || ev) maybeRefreshRoadmap(projectDir);
  // A red-phase task (it writes a test that must FAIL) with a must-pass _Verify:_ can never be verified: its refusal and
  // its unverified note say how to fix the task (redPhaseHint) — never only "re-run it" / "fix the code first".
  const redHint = redPhaseHint(task, f.slug, lng);
  // Never tick on a failure; a failed re-check of a ticked task stays recorded (it is now unverified).
  if (failed && xf) return withObserved(expectFailRefusal(n, ev, alreadyDone, lng)); // B5: a pass (unexpected-pass) or a command that couldn't run
  if (failed) {
    const out = { ok: false, recorded: true, error: (alreadyDone ? EV.failedTicked(n, ev.exitCode) : EV.failed(n, ev.exitCode)) + (redHint ? " " + redHint : "") };
    if (redHint) out.redPhaseVerify = true; // stable: branch on it, never on the text
    return withObserved(out);
  }
  const tracksNow = detectTracks(f.dir);
  const tasks = parseTasks(activeTasks(updated, tracksNow)); // done/total/next as status counts them
  const sch = taskSchedule(taskBlocks(activeTasks(updated, tracksNow) || "")); // 1.14 F3: next_task's rule
  const next = sch.next;
  const runnable = taskMarkers(task).verify.length > 0;
  const entry = ownEvidence(state.evidence || {}, task, dup);
  // The same verdict doctor, spec_finish and ROADMAP.md give (taskVerification): unverified ⇔ a reason code.
  const { reason, nothingToVerify } = taskVerification(state.evidence || {}, task, dup, evidenceRule(projectDir));
  const res = {
    ok: true,
    feature: f.slug,
    alreadyDone,
    completed: n,
    verified: !reason,
    done: tasks.filter((t) => t.done).length,
    total: tasks.length,
    next: next && { number: next.number, text: next.text },
  };
  // No runnable _Verify:_ and nothing usable recorded: verified (nothing to run), flagged so no one reads it as a check.
  if (nothingToVerify) res.nothingToVerify = true;
  if (reason) {
    res.unverifiedReason = reason; // stable code — callers branch on this, never on the note's text
    res.note = reason === "failed-run" ? EG.failedRun(n, entry.exitCode, f.slug, runnable)
      : reason === "manual-note-on-runnable-verify" ? EG.manualOnRunnable(n, f.slug)
      : reason === "duplicate-number" ? EG.duplicateNumber(n)
      : reason === "stale-evidence" ? (entry && entry.stale ? (entry.staleBy === "undo" ? i18n.msg(lng).undo.staleNote(n, f.slug, runnable) : i18n.msg(lng).impact.staleNote(n, f.slug, runnable)) : EG.staleEvidence(n, f.slug, runnable))
      : reason === "unexpected-pass" ? i18n.msg(lng).redGreen.unexpectedPassNote(n, f.slug) // B5: _Expect: fail_, but the latest run passed
      // 1.14 F1 (meta.evidence "observed"): the harness never saw the run — and, when it never saw any run here, why (no hook)
      : reason === "unobserved" ? (expectsFail(task) ? i18n.msg(lng).observed.unobservedRedNote(n, f.slug) : i18n.msg(lng).observed.unobservedNote(n, f.slug)) +
        (observedAny(projectDir) ? "" : " " + i18n.msg(lng).observed.neverObserved) // an _Expect: fail_ task: its RED run must be observed
      : EV.missing(n, f.slug); // no-evidence: only ever a runnable _Verify:_
    if (redHint && ["failed-run", "manual-note-on-runnable-verify", "no-evidence"].includes(reason)) {
      res.note += " — " + redHint;
      res.redPhaseVerify = true;
    }
  }
  // Bugfix: the root-cause task ticked while bug.md → Root Cause is still empty — allowed (it is the task that writes it),
  // but its deliverable is that section: say so now, not only when the next task is refused. rootCausePending: stable.
  if (state.kind === "bugfix" && blockPosition(blocks, task) === rootCauseTaskIndex(blocks) &&
      !bugSectionFilled(readIfExists(path.join(f.dir, "bug.md")), ROOT_CAUSE_SYN)) {
    res.rootCausePending = true;
    res.note = [i18n.msg(lng).gates.rootCauseTaskEmpty(n), res.note].filter(Boolean).join(" ");
  }
  // A passing run whose recorded command pipes into another one (`npm test | tee log`): its exit 0 is the pipeline's LAST
  // command's, so it may hide a failing check. Recorded and ticked as given — flagged (pipeMasked: stable) with a note.
  if (ev && ev.exitCode === 0 && ev.command && verifyPipeMasked(ev.command)) {
    res.pipeMasked = true;
    res.note = [res.note, i18n.msg(lng).verifyPipe.completeNote(n, ev.command)].filter(Boolean).join(" ");
  }
  if (xf) expectFailResult(res, xf, n, lng); // B5: expected: "fail" (+ redRecorded / the pass-after-red note)
  // 1.14 F3: ticked while some of its _Depends:_ are still open — a warning, never a refusal (a tick records what happened;
  // the work may have been done in another order). waitsOn: stable. No task left that can start: blocked, as next_task says.
  const early = ticks ? openDependenciesOf(text, tracksNow, task) : [];
  if (early.length) {
    res.waitsOn = early;
    res.note = [res.note, i18n.msg(lng).taskDeps.tickedEarly(n, early.map((d) => "#" + d).join(", "))].filter(Boolean).join(" ");
  }
  if (!next && res.done < res.total) {
    if (sch.blocked.length) res.blocked = sch.blocked;
    res.note = [res.note, taskDepsBlockedNote(sch, f.slug, lng)].filter(Boolean).join(" ");
  }
  return withObserved(res); // 1.14 F1: the observed stamp on every result
}

// 1.16 U1 — undo a tick: spec_complete_task {undo: true, reason?} / `dev-spec undone <feature> <n> [--reason "…"]` (both reach
// it through completeTask, under the feature lock). The task goes back to open: the checkbox of the line it resolves to — the
// TICKED task of that number (several ticked tasks sharing it → refused, duplicateTicked: which tick was the mistake is
// unknowable), else the one resolveTask answers — is reset at
// its checkbox column (CRLF / a BOM kept, tasks.md replaced atomically). In .state.json, written FIRST (a failure after it
// leaves a ticked task whose evidence no longer counts — erring toward unverified, never a tick that keeps a stale proof):
// its own evidence record is marked `stale: true` + `staleBy: "undo"` (a re-tick needs a new run, like spec_impact --reopen —
// reason stale-evidence, with its own label; an _Expect: fail_ task's red run still counts as its red proof — redProof —, so
// the pass after the fix re-ticks it: redKept), ticks[n] is dropped (forecasts: it is open again) unless another task of that
// number stays ticked, and `unticks` gets {n, at, reason?} (changesSince reads it: a finish or an execution sign-off older than
// an untick is asked for again). An open task → ok, nothing changed (alreadyOpen + a note). Never gated (the bugfix gate
// refuses TICKS: unticking completes nothing). → { ok, feature, number, unticked, alreadyOpen?, evidenceStale, done, total, next, note }
const UNDO_REASON_MAX = 500;
// A one-line reason (revoke, undo, a waiver): whitespace runs folded, at most UNDO_REASON_MAX characters. → { value } | { error }
function reasonInput(v, lng) {
  if (v == null) return { value: null };
  if (typeof v !== "string") return { error: i18n.msg(lng).undo.badReason(UNDO_REASON_MAX) };
  const s = v.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
  if (s.length > UNDO_REASON_MAX) return { error: i18n.msg(lng).undo.badReason(UNDO_REASON_MAX) };
  return { value: s || null };
}
function untickTask(projectDir, name, number, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const lng = featureLang(projectDir, f.slug);
  const U = i18n.msg(lng).undo;
  const E = errs(projectDir, f.slug);
  if (opts.evidence != null) return { ok: false, error: U.noEvidence };
  const file = path.join(f.dir, "tasks.md");
  const text = readIfExists(file);
  if (text == null) return { ok: false, error: E.tasksMissing(f.slug) };
  const n = taskNumber(number);
  if (!Number.isFinite(n)) return { ok: false, error: E.numberInt };
  const reason = reasonInput(opts.reason, lng);
  if (reason.error) return { ok: false, error: reason.error };
  const blocks = taskBlocks(text);
  const same = blocks.filter((b) => b.number === n);
  if (!same.length) return { ok: false, error: E.taskNotFound(n) };
  // 1.16 U review 2: several TICKED tasks share the number — undo can't know which tick was the mistake (done ticks the first
  // OPEN one, so "the first ticked" was usually the right tick of another task: its proof went stale). Refused, nothing
  // changed; duplicateTicked + tasks [{number, line, text}] are stable. Renumber them first (doctor warns duplicate-tasks).
  const ticked = same.filter((b) => b.done);
  if (ticked.length > 1) {
    return { ok: false, duplicateTicked: true, tasks: ticked.map((b) => ({ number: b.number, line: b.line + 1, text: b.text })),
      error: U.duplicateTicked(n, ticked.map((b) => U.duplicateItem(b.line + 1, cleanTaskText(b.text).slice(0, 80))).join(", ")) };
  }
  const task = ticked[0] || resolveTask(blocks, n);
  const state = readState(projectDir, f.slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const progress = (txt) => {
    const tracks = detectTracks(f.dir);
    const tasks = parseTasks(activeTasks(txt, tracks));
    const next = taskSchedule(taskBlocks(activeTasks(txt, tracks) || "")).next;
    return { done: tasks.filter((t) => t.done).length, total: tasks.length, next: next && { number: next.number, text: next.text } };
  };
  if (!task.done) return { ok: true, feature: f.slug, number: n, unticked: false, alreadyOpen: true, evidenceStale: false, ...progress(text), note: U.alreadyOpen(n) };
  const key = String(n);
  const dup = same.length > 1;
  const rec = ownRecord(isObj(state.evidence) ? state.evidence[key] : undefined, task, dup); // this task's record, never the other "N."'s
  const staled = isRecord(rec);
  if (staled) { rec.stale = true; rec.staleBy = "undo"; } // mutates state.evidence in place
  // ticks[n] (forecasts): dropped unless another task of that number stays ticked; a hand-broken ticks value is left alone.
  if (isRecord(state.ticks) && own(state.ticks, key) && !same.some((b) => b !== task && b.done)) {
    delete state.ticks[key];
    if (!Object.keys(state.ticks).length) delete state.ticks;
  }
  const entry = { n, at: new Date().toISOString() };
  if (reason.value) entry.reason = reason.value;
  state.unticks = (Array.isArray(state.unticks) ? state.unticks : []).concat([entry]);
  writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
  const lines = text.split("\n");
  const raw = lines[task.line];
  lines[task.line] = raw.slice(0, task.col) + " " + raw.slice(task.col + 1);
  const updated = lines.join("\n");
  writeFileAtomic(file, updated);
  maybeRefreshRoadmap(projectDir);
  const runnable = taskMarkers(task).verify.length > 0;
  // 1.16 U review 1: an _Expect: fail_ task keeps its red run (redProof reads through staleBy "undo"): once the fix is in, the
  // re-tick's passing run is the fix going green — the note must not ask for a red run that can no longer happen. redKept: stable.
  const red = staled && expectsFail(task) ? redProof(rec) : null;
  const notes = [U.unticked(n, f.slug, runnable, staled && !red)];
  if (red) notes.push(U.redKept(n, f.slug, String(red.at || "?").slice(0, 10)));
  if (isObj(state.finished) || (isRecord(state.approvals) && isRecord(state.approvals.execution))) notes.push(U.reopened(f.slug));
  const res = { ok: true, feature: f.slug, number: n, unticked: true, evidenceStale: staled, ...progress(updated), note: notes.join(" ") };
  if (red) res.redKept = true;
  if (reason.value) res.reason = reason.value;
  return res;
}

// ---------------------------------------------------------------------------
// spec_append_tasks — converge: NEW tasks appended to tasks.md (existing tasks are never renumbered or edited)
// ---------------------------------------------------------------------------

const RE_NEW_TASK_TAGS = /^(?:\[(?:US\d+|shared|P)\]\s*)+/i; // the known-tag run taskBlocks reads
const RE_THEMATIC_BREAK = /^\s{0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/; // '---' / '***' / '___'
// `npm test` — ONE code span around the whole value (no inner backtick run as long as its fence) — is the command
// npm test, as taskMarkers reads it. Anything else (`a` && `b`, test -n `echo ok`) is the command itself.
function unwrapCodeSpan(v) {
  const m = v.match(/^(`+)(?!`)([\s\S]*[^`])\1$/);
  if (!m || (m[2].match(/`+/g) || []).some((r) => r.length === m[1].length)) return v;
  return m[2].trim();
}

// One task of a spec_append_tasks call → its normalized fields and rendered text/sub-lines, or { error }.
// `i` is its 1-based position in the call (errors name it).
function newTaskSpec(t, i, A, D) {
  if (!isObj(t)) return { error: A.noText(i) };
  const folded = typeof t.text === "string" ? t.text.replace(/\s+/g, " ").trim() : "";
  // Tags typed in the text merge with story/parallel — never "[US1] [US1] …".
  const lead = (folded.match(RE_NEW_TASK_TAGS) || [""])[0];
  const text = folded.slice(lead.length).trim();
  if (!text) return { error: A.noText(i) };
  let story = t.story != null && String(t.story).trim() ? String(t.story).trim() : (lead.match(/\[(US\d+|shared)\]/i) || [])[1] || null;
  if (story != null) {
    const m = story.match(/^(?:US-?(\d+)|(shared))$/i);
    if (!m) return { error: A.badStory(i, story) };
    story = m[1] ? "US" + parseInt(m[1], 10) : "shared";
  }
  const parallel = typeof t.parallel === "boolean" ? t.parallel : /\[P\]/i.test(lead);
  const list = (v, sep) => (Array.isArray(v) ? v : v == null ? [] : [v]).flatMap((x) => String(x == null ? "" : x).split(sep)).map((s) => s.trim()).filter(Boolean);
  // AC IDs and the secondary IDs (EC-n / NFR-n / SC-nnn) are English-stable ("us-1.ac-2" is US-1.AC-2, "ec-2" is EC-2);
  // anything else stays as given and is reported as unknown.
  const requirements = [...new Set(list(t.requirements, /[,;\s]+/).map((id) => (/^(?:us-\d+\.ac-\d+|(?:ec|nfr|sc)-\d+)$/i.test(id) ? id.toUpperCase() : id)))];
  const files = [];
  for (const given of list(t.implements, /[,;]/)) {
    const p = given.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
    // Project-relative only (trace_check resolves them from the project root): no absolute path, drive or URI scheme
    // (C:, file:), no home in any form (~, ~/x, ~user/x), no '..'.
    if (!p || p === "." || p.startsWith("/") || p.startsWith("~") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(p) || p.split("/").includes("..")) return { error: A.badPath(i, given) };
    if (!files.includes(p)) files.push(p);
  }
  let verify = null;
  let stored = null;
  if (t.verify != null && String(t.verify).trim()) {
    const v = String(t.verify).trim();
    if (/[\r\n]/.test(v)) return { error: A.badVerify(i) };
    verify = unwrapCodeSpan(v) || null; // "` `" is no command
    // Every reader drops a [bracketed] value as a placeholder: the evidence gate would never apply to it.
    if (verify && /^\[.*\]$/.test(verify)) return { error: A.placeholderVerify(i, verify) };
    if (verify) {
      // taskMarkers strips a leading/trailing backtick run, so a command that starts or ends with one (`make` && x,
      // test -n `echo ok`) is stored inside a longer code span — it reads back, and runs, exactly as given.
      const fence = "`".repeat(Math.max(0, ...(verify.match(/`+/g) || []).map((r) => r.length)) + 1);
      stored = /^`|`$/.test(verify) ? `${fence} ${verify} ${fence}` : verify;
    }
  }
  // full review Ga6: _Makes green:_ (planned T-IDs — appendTasks checks them against test-plan.md), _Expect: fail_ (a red
  // task: its proof is a FAILING run) and _Size:_ (XS…XL, the forecasts' points). "t-1" is T-1; T-01 and T-1 are one test.
  const makesGreen = [];
  for (const id of list(t.makesGreen, /[,;\s]+/)) {
    const m = id.match(/^T-?(\d{1,6})$/i);
    if (!m) return { error: A.badTestId(i, id) };
    if (!makesGreen.some((x) => tKey(x.slice(2)) === tKey(m[1]))) makesGreen.push("T-" + m[1]);
  }
  const expectFail = t.expectFail === true;
  let size = null;
  if (t.size != null && String(t.size).trim()) {
    size = String(t.size).trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(SIZE_POINTS, size)) return { error: A.badSize(i, String(t.size).trim()) };
  }
  // 1.14 F3: _Depends:_ — task numbers (3, "3", "#3"; "3,5" split like the other lists). appendTasks checks each names a task:
  // an active one, or one this call appends.
  const depends = [];
  const depSeen = new Set();
  for (const v of list(t.depends, /[,;\s]+/)) {
    const m = v.match(RE_DEP_TOKEN);
    const num = m ? taskNumber(m[1]) : NaN;
    if (!Number.isFinite(num)) return { error: D.badDepends(i, v) };
    if (!depSeen.has(num)) { depSeen.add(num); depends.push(num); }
  }
  const tags = (story ? `[${story}]` : "") + (parallel ? "[P]" : "");
  const lineText = (tags ? tags + " " : "") + text;
  const body = [];
  if (requirements.length) body.push(`_Requirements: ${requirements.join(", ")}_`);
  if (makesGreen.length) body.push(`_Makes green: ${makesGreen.join(", ")}_`);
  if (files.length) body.push(`_Implements: ${files.join(", ")}_`);
  if (stored) body.push(`_Verify: ${stored}_`);
  if (expectFail) body.push("_Expect: fail_");
  if (size) body.push(`_Size: ${size}_`);
  if (depends.length) body.push(`_Depends: ${depends.join(", ")}_`);
  // Round trip: the markers must read back exactly as given — a "_ " inside a path or command, a marker typed in
  // the text… would make trace/brief/complete see something other than what was asked for.
  const mk = taskMarkers({ text: lineText, body });
  const same = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
  if (!same(mk.requirements, requirements)) return { error: A.unstorable(i, "_Requirements:_") };
  if (!same(mk["makes green"], makesGreen)) return { error: A.unstorable(i, "_Makes green:_") };
  if (!same(mk.implements, files)) return { error: A.unstorable(i, "_Implements:_") };
  if (!same(mk.verify, verify ? [verify] : [])) return { error: A.unstorable(i, "_Verify:_") };
  if (!same(mk.expect, expectFail ? ["fail"] : [])) return { error: A.unstorable(i, "_Expect:_") };
  if (taskSize({ text: lineText, body }) !== size) return { error: A.unstorable(i, "_Size:_") };
  const depSpec = taskDependsSpec({ text: lineText, body });
  if (!same(depSpec.numbers, depends) || depSpec.invalid.length || depSpec.declared !== depends.length > 0) return { error: A.unstorable(i, "_Depends:_") };
  return { text, lineText, body, story, parallel, requirements, makesGreen, expectFail, size, depends, implements: files, verify, markers: mk };
}

// spec_append_tasks {name, tasks: [{text, requirements?, implements?, verify?, makesGreen?, expectFail?, size?, depends?, story?, parallel?}], heading?}.
// Tasks are numbered after every number in use and appended under a phase heading: an existing heading with that
// text (at the end of its phase, before its closing checkpoint) or a new one (default: the localized
// "Phase: Convergence", with a closing **Checkpoint:**) placed after the last ACTIVE line — never inside a removed
// track's section. All-or-nothing: an invalid task or an unknown AC writes nothing.
function appendTasks(projectDir, name, tasks, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const M = i18n.msg(lng);
  const A = M.appendTasks;
  const file = path.join(dir, "tasks.md");
  const raw = readIfExists(file);
  if (raw == null) return { ok: false, error: M.err.tasksMissing(slug) };
  const state = readState(projectDir, slug);
  if (state.invalid) return { ok: false, error: state.invalid };

  const items = [];
  const DP = M.taskDeps; // 1.14 F3: `depends`
  if (!Array.isArray(tasks) || !tasks.length) return { ok: false, error: A.noTasks };
  for (let i = 0; i < tasks.length; i++) {
    const t = newTaskSpec(tasks[i], i + 1, A, DP);
    if (t.error) return { ok: false, error: t.error };
    items.push(t);
  }
  // Every cited AC must exist — the same index spec_task_brief resolves them with. A secondary ID (EC-2, NFR-1, SC-001)
  // must be one requirements.md writes (secondaryDefinitions — trace_check's phantomSecondary rule: SC-1 names SC-001).
  const cited = [...new Set(items.flatMap((t) => t.requirements))];
  if (cited.length) {
    const reqText = readIfExists(path.join(dir, "requirements.md"));
    if (reqText == null) return { ok: false, error: M.err.requirementsMissing(slug) };
    const known = acIndex(reqText);
    const secondary = cited.some((id) => /^(?:EC|NFR|SC)-\d+$/.test(id)) ? secondaryDefinitions(reqText).all : new Set();
    const isKnown = (id) => {
      if (known.has(id)) return true;
      const m = id.match(/^(EC|NFR|SC)-(\d+)$/);
      return !!m && secondary.has(idKey(m[1], m[2]));
    };
    const phantom = cited.filter((id) => !isKnown(id));
    if (phantom.length) return { ok: false, error: A.phantom(phantom.join(", ")), phantom };
  }
  // full review Ga6: every _Makes green:_ T-ID must be planned in test-plan.md (its IDs as every reader takes them —
  // planIdText: comments and fenced examples out; T-01 = T-1), like an AC must exist in requirements.md.
  const citedTests = [...new Set(items.flatMap((t) => t.makesGreen))];
  if (citedTests.length) {
    const planText = readIfExists(path.join(dir, "test-plan.md"));
    if (planText == null) return { ok: false, error: A.noTestPlan(slug) };
    const planned = new Map(); // tKey → the T-ID as test-plan.md spells it
    for (const id of extractTestIds(planIdText(planText))) if (!planned.has(tKey(id.slice(2)))) planned.set(tKey(id.slice(2)), id);
    const phantomTests = citedTests.filter((id) => !planned.has(tKey(id.slice(2))));
    if (phantomTests.length) return { ok: false, error: A.phantomTests(phantomTests.join(", ")), phantomTests };
    // Stored as test-plan.md spells them: trace_check compares T-IDs as written (T-1 given for a planned T-01 would be a gap).
    for (let i = 0; i < items.length; i++) {
      if (!items[i].makesGreen.length) continue;
      const again = newTaskSpec({ ...tasks[i], makesGreen: items[i].makesGreen.map((id) => planned.get(tKey(id.slice(2)))) }, i + 1, A, DP);
      if (again.error) return { ok: false, error: again.error };
      items[i] = again;
    }
  }

  let heading = A.heading;
  if (opts.heading != null && String(opts.heading).trim()) {
    const h = String(opts.heading).trim();
    heading = h.replace(/^#{1,6}(?:\s+|$)/, "").replace(/\s+/g, " ").trim();
    if (/[\r\n]/.test(h) || !heading) return { ok: false, error: A.badHeading };
  }
  // Refused by the SAME test globalConstraints() finds that section with (any heading containing the words), so
  // appended tasks can never be read into every brief as "binding" constraints.
  if (RE_GLOBAL_CONSTRAINTS.test(heading)) return { ok: false, error: A.constraintsHeading(heading) };
  const tracks = detectTracks(dir);
  const norm = normTaskHeading(heading);
  // A turned-off track's task heading is hidden wherever it appears (activeTasks matches it by text).
  const offTrack = markerTracks().find((t) => !tracks.includes(t) && (isPackTrack(t) ? heading.includes(trackMarker(t)) : trackTaskHeadings(t).has(norm))) ||
    (ghostMarkers().find(([, m]) => heading.includes(m)) || [])[0]; // + a saved track pack the project lacks now (1.15)
  if (offTrack) return { ok: false, error: A.inactiveHeading(heading, "+" + offTrack) };

  // Line-exact editing: split on "\n" only, so every existing line keeps its own ending (CRLF stays CRLF); new
  // lines take the file's. The BOM stays first. Headings/checkpoints are read as the task tools read them.
  const bom = raw.startsWith("\uFEFF") ? "\uFEFF" : "";
  const parts = raw.slice(bom.length).split("\n");
  const cr = raw.includes("\r\n") ? "\r" : "";
  const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));
  const scan = scanTaskLines(raw);
  const off = inactiveTaskLines(lines, tracks);
  const heads = [];
  scan.forEach((s, i) => { const m = !s.code && atxHeading(s.vis); if (m) heads.push({ i, level: m.level, text: m.text }); }); // /^(#{1,6})\s+(.*?)\s*$/
  const lastContent = (from, to, skip) => { for (let i = to - 1; i >= from; i--) if (lines[i].trim() && !(skip && skip.has(i))) return i; return -1; };

  const matches = heads.filter((h) => h.level >= 2 && normTaskHeading(h.text) === norm); // never the H1 title
  const target = matches.filter((h) => !off.has(h.i)).pop(); // the latest round, when the heading repeats
  if (!target && matches.length) return { ok: false, error: A.inactiveHeading(matches[0].text, "+" + off.get(matches[0].i)) };

  // Numbered after every number in use — tasks.md's, and any evidence record or tick time a removed task left behind (a
  // new task must never inherit an old run, nor an old completion time the forecasts would count).
  const before = taskBlocks(raw);
  const usedKeys = (o) => Object.keys(isRecord(o) ? o : {}).filter((k) => /^\d+$/.test(k)).map(Number);
  let n = Math.max(0, ...before.map((b) => b.number), ...usedKeys(state.evidence), ...usedKeys(state.ticks));
  const numbered = items.map((t) => ({ ...t, number: ++n }));
  // 1.14 F3: every `depends` names an ACTIVE task or a task of this call (by the number it gets here), never the task itself.
  const withDeps = numbered.some((t) => t.depends.length);
  if (withDeps) {
    const known = new Set(taskBlocks(activeTasks(raw, tracks) || "").map((b) => b.number));
    const fresh = new Set(numbered.map((t) => t.number));
    for (let k = 0; k < numbered.length; k++) {
      const t = numbered[k];
      if (t.depends.includes(t.number)) return { ok: false, error: DP.selfDepends(k + 1, t.number) };
      const missing = t.depends.filter((d) => !known.has(d) && !fresh.has(d));
      if (missing.length) {
        return { ok: false, error: DP.phantomDepends(k + 1, missing.map((d) => "#" + d).join(", "), numbered[0].number, numbered[numbered.length - 1].number), phantomDepends: missing };
      }
    }
  }
  const taskLines = numbered.flatMap((t) => [`- [ ] ${t.number}. ${t.lineText}`, ...t.body.map((b) => "  - " + b)]);
  let at;
  let insert;
  let closingCp = null; // the checkpoint the new tasks must read back with when an existing phase is reused
  if (target) {
    // End of that phase (up to the next heading of any level — taskBlocks starts a phase at each one). Its closing
    // **Checkpoint:** is the first one after the phase's LAST task, as taskBlocks reads it: a comment, a '---' or a
    // note after it doesn't move it, and the new tasks go right before it (so they join that section).
    const next = heads.find((h) => h.i > target.i);
    const end = next ? next.i : lines.length;
    let lastTask = target.i;
    for (let i = target.i + 1; i < end; i++) if (!scan[i].code && scan[i].task) lastTask = i;
    let closing = -1;
    for (let i = lastTask + 1; i < end && closing === -1; i++) if (!scan[i].code && RE_CHECKPOINT.test(scan[i].vis)) closing = i;
    if (closing !== -1) {
      closingCp = scan[closing].vis.replace(RE_CHECKPOINT, "").trim();
    } else {
      // No checkpoint: the end a reader sees — trailing blank lines, '---' rules and comments that START on their own
      // line stay after the new tasks. (A comment line without its "<!--", or one that starts inside an open comment
      // — "<!-- a" … "<!-- b -->" — is the tail of a multi-line one: the tasks go after it, never inside it.)
      closing = end;
      while (closing > target.i + 1) {
        const i = closing - 1;
        const s = lines[i].trim();
        const trailer = !s || (!scan[i].code && (RE_THEMATIC_BREAK.test(scan[i].vis) || (!scan[i].vis.trim() && !scan[i].inComment && s.startsWith("<!--"))));
        if (!trailer) break;
        closing = i;
      }
      // …but never inside the last task's block: a rule right under its line or a sub-line (or an indented one after
      // a blank) is that task's lazy-continuation body to taskBlocks, and would move into the new task's. Its body
      // is the next body.length lines a reader sees (the lines between them are blank or comment-only).
      const last = before.find((b) => b.line === lastTask);
      let bodyEnd = lastTask;
      for (let i = lastTask + 1, seen = 0; last && seen < last.body.length && i < end; i++) if (scan[i].vis.trim()) { seen++; bodyEnd = i; }
      closing = Math.max(closing, bodyEnd + 1);
    }
    at = lastContent(target.i, closing) + 1;
    insert = taskLines;
  } else {
    // A new phase after the last active line: a removed track's trailing section stays after it. (On line 0 of a
    // BOM file the heading would carry the BOM and read as plain text — it starts one line down.)
    at = lastContent(0, lines.length, off) + 1;
    insert = [...(at > 0 || bom ? [""] : []), "## " + heading, ...taskLines, "**Checkpoint:** " + A.checkpoint, ...(at < lines.length && lines[at].trim() ? [""] : [])];
  }
  const out = parts.slice();
  const added = insert.map((l) => l + cr);
  if (at === out.length) {
    // After a last line with no newline: end that line, and keep "no final newline" at the new end.
    if (!out[at - 1].endsWith("\r")) out[at - 1] += cr;
    added[added.length - 1] = insert[insert.length - 1];
  }
  out.splice(at, 0, ...added);
  const updated = bom + out.join("\n");

  // Read the result back with the tools' own scanner: every existing task unchanged, every new task parsed as
  // written, in its phase, and active (status/next count it). Anything else writes nothing.
  const after = taskBlocks(updated);
  const newNums = new Set(numbered.map((t) => t.number));
  const sig = (b) => JSON.stringify([b.number, b.done, b.text, b.body, b.phase, b.checkpoint]);
  const kept = after.filter((b) => !newNums.has(b.number));
  if (kept.length !== before.length || kept.some((b, k) => sig(b) !== sig(before[k]))) return { ok: false, error: A.unsafe(null) };
  const phase = target ? target.text : heading;
  const active = new Set(parseTasks(activeTasks(updated, tracks)).map((t) => t.number));
  const same = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
  for (const t of numbered) {
    const hits = after.filter((b) => b.number === t.number);
    const b = hits[0];
    const mk = b && taskMarkers(b);
    const fits = hits.length === 1 && !b.done && b.text === t.lineText && b.phase === phase && active.has(t.number) &&
      b.checkpoint === (target ? closingCp : A.checkpoint) && ["requirements", "makes green", "implements", "verify", "expect"].every((k) => same(mk[k], t.markers[k])) && taskSize(b) === t.size &&
      same(taskDependsSpec(b).numbers, t.depends);
    if (!fits) return { ok: false, error: A.unsafe(t.number) };
  }
  // 1.14 F3: no new dependency cycle — one through a task of this call (a pre-existing cycle is doctor's task-deps).
  if (withDeps) {
    const cyc = dependencyCycles(taskDepGraph(taskBlocks(activeTasks(updated, tracks) || "")), false).filter((c) => c.some((x) => newNums.has(x)));
    if (cyc.length) return { ok: false, error: DP.cycleDepends(cyc.map((c) => c.map((x) => "#" + x).join(", ")).join("; ")), cycles: cyc };
  }

  writeFileAtomic(file, updated);
  maybeRefreshRoadmap(projectDir);
  // New content after an approval of the task breakdown: next_action reports tasks.md as changed-since-approval.
  const appr = state.approvals.tasks;
  const needsReapproval = !!appr && (!appr.fingerprint || !artifactMatches(file, "tasks", appr.fingerprint));
  const now = parseTasks(activeTasks(updated, tracks));
  const res = {
    ok: true,
    feature: slug,
    lang: lng,
    heading: phase,
    headingCreated: !target,
    appended: numbered.map((t) => ({ number: t.number, text: t.lineText, story: t.story, parallel: t.parallel, requirements: t.requirements, implements: t.implements, verify: t.verify,
      makesGreen: t.makesGreen, expectFail: t.expectFail, size: t.size, depends: t.depends })), // full review Ga6: _Makes green:_ / _Expect: fail_ / _Size:_; 1.14 F3: _Depends:_
    total: now.length,
    remaining: now.filter((t) => !t.done).length,
    needsReapproval,
  };
  if (needsReapproval) res.note = A.reapprove(slug);
  return res;
}

module.exports = { RE_ROOT_CAUSE_TASK, bugfixGate, rootCauseTaskIndex, blockPosition, taskNumber, completeTask,
  UNDO_REASON_MAX, reasonInput, untickTask, RE_NEW_TASK_TAGS, RE_THEMATIC_BREAK, unwrapCodeSpan, newTaskSpec,
  appendTasks, __link };

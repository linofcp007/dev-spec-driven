"use strict";

/**
 * dev-spec-driven engine — tasks.md: the scanner, markers, dependencies, ticks and the task brief.
 * The ONE task scanner (taskBlocks / parseTasks — comments and fenced code never hold tasks), the English-stable
 * task markers, _Depends:_ and the execution waves (taskSchedule is THE next-task rule), spec_next_task; ticking a task
 * with its evidence (the bugfix gate first), unticking one, appending new tasks (spec_append_tasks — existing tasks
 * are never renumbered or edited); and spec_task_brief, the self-contained brief for ONE task.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, AI_SECTIONS, artifactMatches, atxHeading, blockLines, briefDecisions, briefGlossary, briefSteering,
  bugSectionFilled, cleanTaskText, closesFence, criterionBlocks, detectTracks, ensureDir, errs, evidenceRule,
  existingFeature, expectFailRefusal, expectFailResult, expectFailRun, expectsFail, extractAcIds, extractSection,
  extractTestIds, featureLang, fenceStep, forgetCached, ghostMarkers, headingEntries, idKey, implementsKey, implementsRel,
  inactiveTaskLines, isBacktickUnit, isObj, isPackTrack, isRecord, lineMap, markerTracks, maybeRefreshRoadmap,
  normalizeEvidence, normTaskHeading, observedAny, observedStamp, own, ownEvidence, ownRecord, packTracks, planIdText,
  projectChecks, RE_FENCE_CLOSE, RE_LIST_ITEM, RE_TEST_REF, readIfExists, readState, redProof, REPRO_SYN,
  ROOT_CAUSE_SYN, SAAS_SECTIONS, secondaryDefinitions, SIZE_POINTS, statePath, storeEvidence, stripEnds,
  stripFencedCode, stripHtmlComments, stripSupersedes, taskSize, taskVerification, tKey, trackAcIds, trackLabel,
  trackMarker, trackTaskHeadings, verifyPipeMasked, verifyPipes, writeFileAtomic, writeIfAbsent,
  briefReuse, reuseQuotedSection, trackSectionTable, isChangeDir, CHANGE_FILE, runStartOf, runRootStamp,
  decodeText, existsRaw, changeAlias, taskStamp, unknownExpectValues, isWsUnit, vacuousRun;
function __link(E) { ({ activeTasks, AI_SECTIONS, artifactMatches, atxHeading, blockLines, briefDecisions,
  briefGlossary, briefSteering, bugSectionFilled, cleanTaskText, closesFence, criterionBlocks, detectTracks, ensureDir,
  errs, evidenceRule, existingFeature, expectFailRefusal, expectFailResult, expectFailRun, expectsFail, extractAcIds,
  extractSection, extractTestIds, featureLang, fenceStep, forgetCached, ghostMarkers, headingEntries, idKey, implementsKey,
  implementsRel, inactiveTaskLines, isBacktickUnit, isObj, isPackTrack, isRecord, lineMap, markerTracks,
  maybeRefreshRoadmap, normalizeEvidence, normTaskHeading, observedAny, observedStamp, own, ownEvidence, ownRecord,
  packTracks, planIdText, projectChecks, RE_FENCE_CLOSE, RE_LIST_ITEM, RE_TEST_REF, readIfExists, readState, redProof,
  REPRO_SYN, ROOT_CAUSE_SYN, SAAS_SECTIONS, secondaryDefinitions, SIZE_POINTS, statePath, storeEvidence, stripEnds,
  stripFencedCode, stripHtmlComments, stripSupersedes, taskSize, taskVerification, tKey, trackAcIds, trackLabel,
  trackMarker, trackTaskHeadings, verifyPipeMasked, verifyPipes, writeFileAtomic, writeIfAbsent,
  briefReuse, reuseQuotedSection, trackSectionTable, isChangeDir, CHANGE_FILE, runStartOf, runRootStamp,
  decodeText, existsRaw, changeAlias, taskStamp, unknownExpectValues, isWsUnit, vacuousRun } = E); }

// The line-only view (public through spec_status). It is a projection of taskBlocks() — the ONE task
// scanner — so status/next/phase can never count a task that complete/brief/finish don't see.
function parseTasks(tasksText) {
  if (!tasksText) return [];
  const tasks = taskBlocks(tasksText).map((b) => ({ number: b.number, done: b.done, parallel: b.parallel, story: b.story, text: b.text }));
  tasks.sort((a, b) => a.number - b.number);
  return tasks;
}

// A task description without its leading tags, whitespace-folded — the unit placeholder checks compare.
function taskDescription(text) {
  return String(text || "").replace(/^(?:\[(?:US\d+|shared|P)\]\s*)+/i, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function nextTask(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const raw = readIfExists(path.join(f.dir, "tasks.md"));
  if (raw == null) return { ok: false, error: errs(projectDir, f.slug).tasksMissing(f.slug) };
  const tracks = detectTracks(f.dir);
  const text = activeTasks(raw, tracks); // a removed track's task block is inactive, never "next"
  const blocks = taskBlocks(text || "");
  const sch = taskSchedule(blocks); // 1.14 F3: the next OPEN task whose _Depends:_ are all done
  const next = sch.next;
  const res = {
    ok: true,
    feature: f.slug,
    next: next ? { number: next.number, text: next.text } : null,
    remaining: blocks.filter((b) => !b.done).length,
    total: blocks.length,
  };
  // Only when dependencies are in play (a tasks.md without _Depends:_ answers exactly as before): the open tasks passed over
  // because they wait (skipped), the ones that can't start as things stand (blocked — a cycle, a _Depends:_ naming no task).
  if (sch.skipped.length) res.skipped = sch.skipped;
  if (sch.blocked.length) res.blocked = sch.blocked;
  if (!next && res.remaining) res.note = taskDepsBlockedNote(sch, f.slug, featureLang(projectDir, f.slug));
  if (opts.batch && next) res.batch = parallelBatch(text, opts.max, tracks);
  if (opts.waves) {
    const w = taskWaves(blocks, tracks);
    Object.assign(res, { waves: w.waves, cycles: w.cycles, blocked: w.blocked });
  }
  return res;
}

// A batch for parallel subagents: the next task (taskSchedule) and, when it is [P], the following open [P] tasks of
// the SAME section whose _Implements:_ files are declared and disjoint (never across a checkpoint) and whose own _Depends:_
// are all done — a task waiting on an open dependency (one in the batch included) ends it.
function parallelBatch(tasksText, max, tracks) {
  const cap = Math.max(1, Math.min(parseInt(max, 10) || 3, 8));
  const blocks = taskBlocks(tasksText);
  const sch = taskSchedule(blocks);
  const i0 = sch.next ? blocks.indexOf(sch.next) : -1;
  if (i0 === -1) return [];
  const first = blocks[i0];
  const pick = (b) => ({ number: b.number, text: b.text, implements: taskMarkers(b).implements });
  const batch = [pick(first)];
  // Compared as files (implementsKey: anchors, backticks, ./ and case where the file system folds it dropped) — the raw
  // spellings `src/payment.js:10`, `src/payment.js#L50` and `./src/payment.js` sent three parallel implementers to one
  // file. A folder overlaps every file under it.
  const keys = (list) => list.map(implementsKey).filter(Boolean);
  const files = keys(batch[0].implements);
  const overlaps = (k) => files.some((f) => f === k || k.startsWith(f + "/") || f.startsWith(k + "/"));
  if (!first.parallel || !files.length || isPromptTask(first, taskMarkers(first), tracks || [])) return batch;
  for (let i = i0 + 1; i < blocks.length && batch.length < cap; i++) {
    const b = blocks[i];
    if (b.done) continue;
    if (!b.parallel || b.phase !== first.phase || b.checkpoint !== first.checkpoint) break;
    if (isPromptTask(b, taskMarkers(b), tracks || [])) break;
    if (sch.graph.waitsOn(i).length) break; // 1.14 F3: it waits on an open task (or on one of this batch)
    const imp = keys(taskMarkers(b).implements);
    if (!imp.length || imp.some(overlaps)) break;
    files.push(...imp);
    batch.push(pick(b));
  }
  return batch;
}

// ---------------------------------------------------------------------------
// Task dependencies and execution waves (1.14 F3)
// ---------------------------------------------------------------------------
// `_Depends: 3, 5_` (English-stable; `#3` or `3`, separated by commas, semicolons or spaces; the task line or a sub-line,
// never fenced code — taskMarkers reads it like every marker) names tasks of the SAME tasks.md that must be done first.
// Every reader works on ONE view — the active tasks (activeTasks) — and follows resolveTask's duplicate-number rule: a
// dependency on number n is done once EVERY task numbered n is done; a number no active task carries never is.
//   - next (taskSchedule): the first open task in tasks order (taskDepGraph: by section in file order, then by number — 1.24 r6
//     D6; parseTasks' public list stays by number) whose _Depends:_ are all done —
//     only the task resolveTask answers for its number is a candidate. A tasks.md without _Depends:_ gets exactly the task it
//     got before (the first open one). `skipped` = the tasks passed over, `blocked` = the tasks that can never start as things
//     stand (a cycle, a _Depends:_ naming no task — or waiting on such a task).
//   - waves (taskWaves): layers of the open tasks. A task WITH _Depends:_ waits for exactly those tasks. A task WITHOUT one
//     keeps tasks.md order among the tasks that declare none (today's sequential default): it waits for the open ones before
//     it — a run of consecutive [P] tasks of one section (phase + checkpoint) waits together for what precedes the run, and
//     the task after the run waits for the whole run (today's [P] batch). A wave holds tasks whose dependencies are done or
//     in earlier waves, filled in tasks order with the batch's limits: never two tasks sharing an _Implements:_ file
//     (implementsKey; a folder overlaps its files), and a task without _Implements:_ (its files can't be proven disjoint) or
//     an +ai prompt task (inline only) is a wave of its own. Only a task's own _Depends:_ can take it ahead of an earlier
//     section's checkpoint — the controller still stops at each checkpoint once that section's tasks are done.
//   - complete_task never refuses a task whose dependencies are open (a tick records what happened — work may have been
//     done in another order): it ticks, with `waitsOn` + a note. The bugfix gate keeps its precedence (a refusal).
//   - doctor `task-deps` (fail): a _Depends:_ value that is not a task number, a number no active task carries, a task that
//     depends on itself, a cycle — only when some task declares _Depends:_; the tasks approval refuses on it.
// The graph walks are linear in the tasks and their dependencies and iterative (no recursion on a long chain); the waves'
// greedy rounds only revisit tasks that were ready together and collided on a file (n tasks sharing one file: n rounds).
const RE_DEP_TOKEN = /^#?(\d{1,15})$/;
// A block's _Depends:_ → { declared, numbers (unique, as written), invalid (tokens that are not a task number) }.
// A value wholly in [brackets] is a template slot, like a [placeholder] _Verify:_: nothing is declared.
function taskDependsSpec(block) {
  const numbers = [], invalid = [];
  // Fast path — every status / roadmap / next call reads every task: no "depends" on its lines, no marker to parse.
  if (!/depends/i.test(block.text || "") && !(block.body || []).some((l) => /depends/i.test(l))) return { declared: false, numbers, invalid };
  const seenN = new Set(), seenBad = new Set();
  let declared = false;
  for (const v of taskMarkers(block).depends) {
    if (/^\[.*\]$/.test(v)) continue;
    declared = true;
    for (const tok of v.split(/\s+/)) {
      if (!tok) continue;
      const m = tok.match(RE_DEP_TOKEN);
      const n = m ? taskNumber(m[1]) : NaN;
      if (Number.isFinite(n)) { if (!seenN.has(n)) { seenN.add(n); numbers.push(n); } }
      else if (!seenBad.has(tok)) { seenBad.add(tok); invalid.push(tok); }
    }
  }
  return { declared, numbers, invalid };
}
// The dependency view of a task list (blocks in file order): numbers → blocks, each block's _Depends:_, which numbers are
// done, and the tasks order: by SECTION (taskSections — a phase heading and the checkpoint closing it, in file order), then by
// number (stable). 1.24 r6 D6: by number alone, a task spec_append_tasks put into an EARLIER phase (numbered after every task)
// came after a later phase's tasks — next served Phase 2 past Phase 1's checkpoint. parseTasks' public order stays by number;
// within a section (a tasks.md without phases: one section) the number decides, as before.
function taskSections(blocks) {
  const sec = [];
  let k = -1;
  blocks.forEach((b, i) => { const p = blocks[i - 1]; if (!p || b.phase !== p.phase || b.checkpoint !== p.checkpoint) k++; sec.push(k); });
  return sec;
}
function taskDepGraph(blocks) {
  const byNum = new Map();
  blocks.forEach((b, i) => { const l = byNum.get(b.number); if (l) l.push(i); else byNum.set(b.number, [i]); });
  const doneNum = new Map();
  for (const [num, l] of byNum) doneNum.set(num, l.every((i) => blocks[i].done));
  const specs = blocks.map(taskDependsSpec);
  const sec = taskSections(blocks);
  const order = blocks.map((_, i) => i).sort((a, b) => sec[a] - sec[b] || blocks[a].number - blocks[b].number || a - b);
  // The dependency numbers of block i that are not done yet (open, or carried by no task), ascending.
  const waitsOn = (i) => specs[i].numbers.filter((n) => doneNum.get(n) !== true).sort((a, b) => a - b);
  return { blocks, byNum, doneNum, specs, order, waitsOn };
}
// Open tasks that can never start as things stand: Kahn's walk over the open tasks' _Depends:_ — a dependency no task
// carries never clears, a cycle never clears, and neither does a task waiting on one of those. Tasks without _Depends:_ are
// never blocked (tasks.md order always lets them start eventually). → [{number, waitsOn}] in tasks order.
function stuckTasks(g) {
  const { blocks, byNum, specs } = g;
  const need = new Array(blocks.length).fill(0);
  const dependents = new Map();
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].done) continue;
    for (const d of specs[i].numbers) {
      const l = byNum.get(d);
      if (!l) { need[i]++; continue; }
      for (const j of l) {
        if (blocks[j].done) continue;
        need[i]++;
        if (dependents.has(j)) dependents.get(j).push(i); else dependents.set(j, [i]);
      }
    }
  }
  const queue = [];
  for (let i = 0; i < blocks.length; i++) if (!blocks[i].done && need[i] === 0) queue.push(i);
  for (let q = 0; q < queue.length; q++) for (const k of dependents.get(queue[q]) || []) if (--need[k] === 0) queue.push(k);
  return g.order.filter((i) => !blocks[i].done && need[i] > 0).map((i) => ({ number: blocks[i].number, waitsOn: g.waitsOn(i) }));
}
// The next task — ONE rule for spec_next_task, next_action's implement step, spec_task_brief's default task, `next --batch`,
// spec_status, the roadmap and complete_task's `next`. → { next (a block of `blocks`, or null), skipped, blocked, graph }.
function taskSchedule(blocks) {
  const g = taskDepGraph(blocks);
  const seen = new Set(); // numbers answered for: resolveTask serves the FIRST open task of a duplicated number
  const skipped = [];
  let next = null;
  for (const i of g.order) {
    const b = blocks[i];
    if (b.done || seen.has(b.number)) continue;
    seen.add(b.number);
    const w = g.waitsOn(i);
    if (!w.length) { next = b; break; }
    skipped.push({ number: b.number, waitsOn: w });
  }
  const anyDeps = g.specs.some((s) => s.declared);
  return { next, skipped, blocked: anyDeps ? stuckTasks(g) : [], graph: g };
}
// Cycles of _Depends:_ (Tarjan, iterative): → [[numbers…]] (each ascending, unique), a self-dependency included as [n].
// openOnly: only open tasks (a done task no longer holds anyone back — waves); else every task (doctor: the plan itself).
function dependencyCycles(g, openOnly) {
  const { blocks, byNum, specs } = g;
  const n = blocks.length;
  const skip = (i) => openOnly && blocks[i].done;
  const adj = blocks.map((_, i) => (skip(i) ? [] : specs[i].numbers.flatMap((d) => (byNum.get(d) || []).filter((j) => !skip(j)))));
  const idx = new Array(n).fill(-1), low = new Array(n).fill(0), on = new Array(n).fill(false);
  const stack = [];
  const out = [];
  let counter = 0;
  for (let s = 0; s < n; s++) {
    if (idx[s] !== -1 || skip(s)) continue;
    const call = [[s, 0]];
    idx[s] = low[s] = counter++;
    stack.push(s); on[s] = true;
    while (call.length) {
      const top = call[call.length - 1];
      const v = top[0];
      if (top[1] < adj[v].length) {
        const w = adj[v][top[1]++];
        if (idx[w] === -1) { idx[w] = low[w] = counter++; stack.push(w); on[w] = true; call.push([w, 0]); }
        else if (on[w]) low[v] = Math.min(low[v], idx[w]);
        continue;
      }
      call.pop();
      if (call.length) { const u = call[call.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
      if (low[v] !== idx[v]) continue;
      const comp = [];
      let w;
      do { w = stack.pop(); on[w] = false; comp.push(w); } while (w !== v);
      if (comp.length > 1 || adj[v].includes(v)) out.push([...new Set(comp.map((i) => blocks[i].number))].sort((a, b) => a - b));
    }
  }
  const key = (c) => c.join(",");
  const uniq = new Map();
  for (const c of out) if (!uniq.has(key(c))) uniq.set(key(c), c);
  return [...uniq.values()].sort((a, b) => a[0] - b[0] || a.length - b.length);
}
// Execution waves of the open tasks (the rules above). → { waves: [[numbers…]…], cycles, blocked }.
function taskWaves(blocks, tracks) {
  const g = taskDepGraph(blocks);
  const n = blocks.length;
  const open = (i) => !blocks[i].done;
  const rank = new Array(n);
  g.order.forEach((i, r) => { rank[i] = r; });
  // Nodes: the blocks, then one join node per multi-task [P] run (it clears once the whole run is placed).
  const dependents = blocks.map(() => []);
  const need = new Array(n).fill(0);
  const edge = (from, to) => { dependents[from].push(to); need[to]++; };
  for (let i = 0; i < n; i++) {
    if (!open(i)) continue;
    for (const d of g.specs[i].numbers) {
      const l = g.byNum.get(d);
      if (!l) { need[i]++; continue; } // names no task: never clears (blocked)
      for (const j of l) if (open(j)) edge(j, i);
    }
  }
  // tasks.md order among the open tasks without _Depends:_: runs of consecutive [P] tasks of one section wait together.
  let prev = -1; // the node the next run waits for (a task, or the previous run's join)
  let run = null;
  const closeRun = () => {
    if (!run) return;
    if (prev !== -1) run.members.forEach((i) => edge(prev, i));
    if (run.members.length === 1) prev = run.members[0];
    else {
      const J = dependents.length;
      dependents.push([]);
      need.push(0);
      run.members.forEach((i) => edge(i, J));
      prev = J;
    }
    run = null;
  };
  for (const i of g.order) {
    const b = blocks[i];
    if (!open(i) || g.specs[i].declared) continue;
    if (run && run.parallel && b.parallel && run.phase === b.phase && run.checkpoint === b.checkpoint) { run.members.push(i); continue; }
    closeRun();
    run = { members: [i], parallel: b.parallel, phase: b.phase, checkpoint: b.checkpoint };
  }
  closeRun();
  // Files per task (the batch's comparison: implementsKey, a folder overlaps the files under it) — computed once.
  const keysOf = blocks.map((b, i) => (open(i) ? [...new Set(taskMarkers(b).implements.map(implementsKey).filter(Boolean))] : []));
  const alone = blocks.map((b, i) => open(i) && (!keysOf[i].length || isPromptTask(b, taskMarkers(b), tracks || [])));
  const parents = (k) => { const parts = k.split("/"); const out = []; for (let p = 1; p < parts.length; p++) out.push(parts.slice(0, p).join("/")); return out; };
  const above = keysOf.map((ks) => ks.map(parents)); // the folders above each file, once per task
  const waves = [];
  let ready = g.order.filter((i) => open(i) && need[i] === 0);
  // Greedy per round, in tasks order: linear in a round; only tasks that are ready together AND collide are looked at again in
  // the next round (n tasks sharing one file: n rounds — the degenerate case, still a simple scan each).
  while (ready.length) {
    const wave = [];
    const files = new Set(), folders = new Set(); // the wave's files, and every folder above them
    let solo = false;
    const rest = [];
    for (const i of ready) {
      if (solo || (alone[i] && wave.length)) { rest.push(i); continue; }
      if (alone[i]) { wave.push(i); solo = true; continue; }
      const ks = keysOf[i];
      if (ks.some((k, x) => files.has(k) || folders.has(k) || above[i][x].some((p) => files.has(p)))) { rest.push(i); continue; }
      wave.push(i);
      ks.forEach((k, x) => { files.add(k); above[i][x].forEach((p) => folders.add(p)); });
    }
    waves.push(wave.map((i) => blocks[i].number));
    // Release what the wave clears (a join node passes it on to the run after it), then keep tasks order.
    const released = [];
    const stack = wave.slice();
    while (stack.length) {
      const x = stack.pop();
      for (const y of dependents[x]) if (--need[y] === 0) (y < n ? released.push(y) : stack.push(y));
    }
    released.sort((a, b) => rank[a] - rank[b]);
    const merged = [];
    for (let a = 0, b = 0; a < rest.length || b < released.length;) {
      merged.push(b >= released.length || (a < rest.length && rank[rest[a]] < rank[released[b]]) ? rest[a++] : released[b++]);
    }
    ready = merged;
  }
  return { waves, cycles: dependencyCycles(g, true), blocked: stuckTasks(g) };
}
// complete_task: the task's _Depends:_ that are not done in the active view (its own number aside), ascending.
function openDependenciesOf(tasksText, tracks, task) {
  const spec = taskDependsSpec(task);
  if (!spec.numbers.length) return [];
  const g = taskDepGraph(taskBlocks(activeTasks(tasksText, tracks) || ""));
  return spec.numbers.filter((d) => d !== task.number && g.doneNum.get(d) !== true).sort((a, b) => a - b);
}
// The brief's view of a task's _Depends:_: [{number, status: done | open | missing, text?}] in the order written.
function briefDependencies(activeBlocks, task) {
  const spec = taskDependsSpec(task);
  if (!spec.numbers.length) return [];
  const g = taskDepGraph(activeBlocks);
  return spec.numbers.map((d) => {
    const l = g.byNum.get(d);
    if (!l) return { number: d, status: "missing" };
    const b = activeBlocks[l.find((i) => !activeBlocks[i].done) ?? l[0]];
    return { number: d, status: g.doneNum.get(d) ? "done" : "open", text: b.text };
  });
}
// The localized note for "no task can start": the blocked tasks (else the waiting ones — a duplicated number).
function taskDepsBlockedNote(sch, slug, lang) {
  const D = i18n.msg(lang).taskDeps;
  const list = (sch.blocked.length ? sch.blocked : sch.skipped);
  return D.blocked(taskDepsWaitList(list, lang), slug);
}
function taskDepsWaitList(list, lang) {
  const D = i18n.msg(lang).taskDeps;
  const shown = list.slice(0, 8).map((x) => D.waitLine(x.number, x.waitsOn.map((d) => "#" + d).join(", ")));
  return shown.join("; ") + (list.length > 8 ? " " + i18n.msg(lang).gates.more(list.length - 8) : "");
}
// doctor `task-deps` (the active tasks): null when no task declares _Depends:_, else { declared, issues: [localized] }.
function taskDepsIssues(blocks, lang) {
  const g = taskDepGraph(blocks);
  const declared = g.specs.filter((s) => s.declared).length;
  if (!declared) return null;
  const D = i18n.msg(lang).taskDeps;
  const issues = [];
  const seen = new Set();
  const add = (s) => { if (!seen.has(s)) { seen.add(s); issues.push(s); } };
  blocks.forEach((b, i) => {
    const s = g.specs[i];
    s.invalid.forEach((tok) => add(D.invalid(b.number, tok)));
    s.numbers.forEach((d) => { if (d === b.number) add(D.self(b.number)); else if (!g.byNum.has(d)) add(D.phantom(b.number, d)); });
  });
  for (const c of dependencyCycles(g, false)) if (c.length > 1) add(D.cycle(c.map((x) => "#" + x).join(", ")));
  return { declared, issues };
}
function taskDepsCheck(blocks, lang) {
  const r = taskDepsIssues(blocks, lang);
  if (!r) return null;
  const D = i18n.msg(lang).taskDeps;
  if (!r.issues.length) return { status: "pass", detail: D.doctorOk(r.declared) };
  const shown = r.issues.slice(0, 8).join("; ") + (r.issues.length > 8 ? " " + i18n.msg(lang).gates.more(r.issues.length - 8) : "");
  return { status: "fail", detail: D.doctorFail(shown) };
}

const RE_ROOT_CAUSE_TASK = /(?<![\p{L}])(?:root[\s-]+cause|causa[\s-]+ra[ií]z)(?![\p{L}])/iu;

// Bugfix iron law, enforced during execution: while bug.md → Root Cause is unfilled, no task positioned AFTER the
// one that writes it can be completed (ticked or given evidence): no fix before the root cause is written in bug.md.
// "The one that writes it" = the first task that references the Root Cause SECTION — it names bug.md and a Root Cause
// synonym (root cause / causa raiz / causa raíz) — and is not itself a fix: a task carrying _Makes green:_ or _Verify:_
// never qualifies. A bare "root cause" mention is not enough: the template's own fix task ("Fix the root cause",
// "Corrigir a causa raiz") would otherwise open the gate for itself once step 2 is reworded. Without such a task only
// the first task can be completed — the scaffold today: the red regression test, then the fix (bug.md's Root Cause is
// gated at the design approval); the root-cause task is a tasks.md scaffolded before (reproduce · root cause · test · fix)
// or one the user wrote. → null (allowed) or { gated: 'root-cause', error } (localized).
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
// The task number a caller ASKED FOR (spec_complete_task / spec_task_brief {number}, the CLI's done / undone / brief word) →
// the integer, or NaN: an integer ≥ 0 — the tools' schema minimum (1.22 review: `-1` read "must be an integer"). Not ≥ 1: the
// scanner reads a hand-written "0." task and next serves it, so refusing 0 would loop next → complete. A refusal says it in
// the MCP validator's words (args), so both surfaces refuse the same values alike.
function askedTaskNumber(v) { const n = taskNumber(v); return n >= 0 ? n : NaN; }
function taskNumberError(lang, v) {
  const A = i18n.msg(lang).args;
  return A.invalid(A.item("number", A.type.integer + " " + A.atLeast(0), JSON.stringify(typeof v === "number" ? v : String(v))));
}
// Review 5 (P3) — tasks.md written back as the bytes it holds. readIfExists decodes a file as UTF-8 (UTF-16 by its BOM), so a
// tasks.md in another encoding — Windows' ANSI code page, what Windows PowerShell 5.1's Set-Content / Add-Content write ("sessão"
// is E3 there) — reads with a U+FFFD for each such byte, and writing that TEXT back made every one of them U+FFFD for good:
// ticking one task destroyed the accents of the whole file. Now a tick / untick (and spec_impact --reopen) changes the
// checkbox's own byte(s) and nothing else (checkboxBytes); a rewrite that adds text (spec_append_tasks, a track's template
// tasks) keeps the file's own encoding — UTF-8, or UTF-16 with its BOM (it used to become UTF-8) — and is refused, nothing
// written, when the file's bytes are not its text in that encoding (tasksRewrite → null; err.tasksNotText).
// The file's bytes (a change's change.md for its tasks.md — writeFileAtomic's alias), or null.
function tasksBytes(file) {
  const real = existsRaw(file) ? file : changeAlias(file) || file;
  try { return fs.readFileSync(real); } catch { return null; }
}
// The encoding decodeText read the bytes in: a UTF-16 BOM decides, anything else is UTF-8.
const textEncoding = (raw) => (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe ? "utf16le" : raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff ? "utf16be" : "utf8");
// text → its bytes in that encoding (decodeText keeps a BOM as U+FEFF, so the text carries it back).
function encodeText(enc, text) {
  const b = Buffer.from(text, enc === "utf8" ? "utf8" : "utf16le");
  return enc === "utf16be" ? b.swap16() : b;
}
// The bytes to write for `updated` — tasks.md's new text — given `text`, the file as it was read: `updated` in the file's own
// encoding, or null when the file's bytes are no text in it (the caller refuses: err.tasksNotText). No file: UTF-8.
function tasksRewrite(file, text, updated) {
  const raw = tasksBytes(file);
  if (!raw) return Buffer.from(updated, "utf8");
  const enc = textEncoding(raw);
  if (decodeText(raw) !== text) return encodeText(enc, updated); // rewritten meanwhile (never under the feature lock): as before
  return encodeText(enc, text).equals(raw) ? encodeText(enc, updated) : null;
}
// The bytes of tasks.md with the checkbox of each box ({line, col}: the scanner's, over `text`) set to ch (" " / "x"), every
// other byte as it was. → a Buffer · null when there is no file, or it isn't `text` any more (the caller writes the text, as
// before) · false when a box can't be found in the bytes (the line before it is no text the engine reads) — refused.
function checkboxBytes(file, text, boxes, ch) {
  const raw = tasksBytes(file);
  if (!raw || decodeText(raw) !== text) return null;
  const enc = textEncoding(raw);
  const buf = Buffer.from(raw);
  const lines = text.split("\n");
  const isBox = (c) => c === 0x20 || c === 0x78 || c === 0x58; // " " / "x" / "X"
  if (enc !== "utf8") { // UTF-16: one code unit (two bytes) per character of the text, its BOM included
    const starts = [];
    for (let i = 0, at = 0; i < lines.length; i++) { starts.push(at); at += lines[i].length + 1; }
    const get = (o) => (enc === "utf16le" ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
    for (const b of boxes) {
      const o = 2 * (starts[b.line] + b.col);
      if (!(b.line < lines.length) || o < 2 || o + 1 >= buf.length || get(o - 2) !== 0x5b || !isBox(get(o))) return false;
      if (enc === "utf16le") buf.writeUInt16LE(ch.charCodeAt(0), o); else buf.writeUInt16BE(ch.charCodeAt(0), o);
    }
    return buf;
  }
  // UTF-8 — or another code page: a line ends at its 0x0A byte (in every ASCII-compatible encoding; no decoder takes an ASCII
  // byte into what it replaces), and the bytes before the box count only when they decode to exactly the text before it.
  const nl = [0];
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) nl.push(i + 1);
  for (const b of boxes) {
    const start = nl[b.line];
    if (start === undefined || lines[b.line] === undefined) return false;
    const prefix = lines[b.line].slice(0, b.col);
    const off = start + Buffer.byteLength(prefix, "utf8");
    if (off >= buf.length || buf.toString("utf8", start, off) !== prefix || buf[off - 1] !== 0x5b || !isBox(buf[off])) return false;
    buf[off] = ch.charCodeAt(0);
  }
  return buf;
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
  const n = askedTaskNumber(number); // "01" is task 1, like the "01." it names
  if (!Number.isFinite(n)) return { ok: false, error: taskNumberError(featureLang(projectDir, f.slug), number) };
  // The same scanner + resolver as status/brief/`done --run`: a "- [ ] N." inside a comment or a code fence
  // is never ticked, "1.1" is not task 1, and a duplicated number resolves to its first OPEN task.
  const blocks = taskBlocks(text);
  const task = resolveTask(blocks, n);
  if (!task) return { ok: false, error: E.taskNotFound(n, tasksFileName(f.dir)) };
  const dup = blocks.filter((b) => b.number === n).length > 1;
  const lng = featureLang(projectDir, f.slug);
  const EV = i18n.msg(lng).evidence;
  const EG = i18n.msg(lng).evidenceGate;
  const ev = normalizeEvidence(evidence);
  if (ev && ev.error) return { ok: false, error: ev.error === "badExit" ? EV.badExit(ev.value) : ev.error === "noContent" ? EG.noContent : EV.needsExit };
  // 1.24 r6 D4: a passing run whose summary shows no test ran (a glob, a path or a filter that matched nothing — vacuousRun) proves
  // nothing: refused before anything is recorded (couldNotRun "no-tests", stable). `done --run` (ranBy "cli") read the whole output.
  const vacuous = ev && ev.command && ev.exitCode === 0 && !(opts && opts.ranBy === "cli") ? vacuousRun(ev.summary) : null;
  if (vacuous) return { ok: false, couldNotRun: "no-tests", error: EV.noTests(n, vacuous.text) };
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
  const verifyCmds = taskMarkers(task).verify;
  // Review 3: a run whose command holds an absolute `cd` is stamped with the project root it was read against (runRootStamp — the
  // project, or a git worktree of it holding this feature): its verdict is then the same on another machine.
  const runRoot = ev && ev.command && ev.exitCode != null ? runRootStamp(ev.command, projectDir, f.slug) : undefined;
  if (runRoot) ev.root = runRoot;
  // 1.24 r6 D-I5: when the task's own latest recorded run FAILED (or its record is stale), only a run the harness logged after it is
  // this report's — a pass logged before the failure stamped a later, un-run pass report observed. (After a recorded pass, the same
  // logged run reported again in another spelling is still that run.)
  const prevOwn = ownEvidence(state.evidence || {}, task, dup);
  const prevAt = isRecord(prevOwn) && prevOwn.exitCode != null && (prevOwn.exitCode !== 0 || prevOwn.stale === true) ? Date.parse(prevOwn.at) : NaN;
  const observed = observedStamp(projectDir, f.slug, ev, opts && opts.ranBy, verifyCmds, prevAt); // an observed run of ITS _Verify:_ (1.22 review)
  if (observed !== undefined) ev.observed = observed;
  const withObserved = (r) => (observed !== undefined ? Object.assign(r, { observed }) : r);
  // _Expect: fail_ (B5): a red run {command, exitCode ≠ 0} is the proof; a passing run is refused unless a red run of this
  // _Verify:_ was recorded before it (the fix made the test green); a could-not-run exit (127, 9009…) is refused like a failure.
  const xf = expectsFail(task) ? expectFailRun(ev, ownEvidence(state.evidence || {}, task, dup), verifyCmds, projectDir) : null;
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
  // 1.22 review — `done --run` (ranBy "cli") hands over the stamps taken BEFORE its run: when it started (the run's `at`) and
  // the _Verify:_ commands it ran (the record's `verify` stamp: a _Verify:_ edited while it ran makes the record stale-evidence).
  // They were taken after the run — an edit made meanwhile read as tested.
  const cli = !!opts && opts.ranBy === "cli";
  const cliStart = cli ? runStartOf({ at: opts.startedAt }) : null;
  const ranVerify = cli && Array.isArray(opts.ranVerify) ? opts.ranVerify.filter((c) => typeof c === "string").join("\n").slice(0, 1000) : undefined;
  if (ev) { // every run is recorded — a failure too (never ticked), so a later note can't paper over it
    state.evidence = state.evidence || {};
    // Only THIS task's record is extended; another task's record under the same number is kept aside.
    const run = ev.exitCode != null;
    state.evidence[key] = storeEvidence(state.evidence[key], task, dup, ev, run && cliStart ? cliStart.at : now, run ? ranVerify : undefined, projectDir);
  }
  const ticks = !alreadyDone && !failed;
  // Review 5 (P3): the tick changes the checkbox's byte and nothing else — found BEFORE anything is written: a box the bytes
  // don't show where the text has it is refused with nothing recorded (never half a tick).
  const tickBytes = ticks ? checkboxBytes(file, text, [task], "x") : null;
  if (tickBytes === false) return { ok: false, error: E.tasksNotText(tasksFileName(f.dir)) };
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
    // tasks.md — it used to refuse a real task as "not found" mid-write. The file's own bytes with the box's changed (P3).
    writeFileAtomic(file, tickBytes || updated);
  }
  if (updated !== text || ev) maybeRefreshRoadmap(projectDir);
  // A red-phase task (it writes a test that must FAIL) with a must-pass _Verify:_ can never be verified: its refusal and
  // its unverified note say how to fix the task (redPhaseHint) — never only "re-run it" / "fix the code first".
  const redHint = redPhaseHint(task, f.slug, lng);
  // Never tick on a failure; a failed re-check of a ticked task stays recorded (it is now unverified).
  if (failed && xf) return withObserved(expectFailRefusal(n, ev, alreadyDone, lng)); // B5: a pass (unexpected-pass) or a command that couldn't run
  if (failed) {
    // 1.24 r6 D7: an _Expect:_ value other than fail (`failure`, `red`…) — the refusal names it: the task is must-pass as written
    const unknown = unknownExpectValues(task);
    const hint = unknown.length ? EV.unknownExpect(n, unknown) : redHint;
    const out = { ok: false, recorded: true, error: (alreadyDone ? EV.failedTicked(n, ev.exitCode) : EV.failed(n, ev.exitCode)) + (hint ? " " + hint : "") };
    if (redHint) out.redPhaseVerify = true; // stable: branch on it, never on the text
    if (unknown.length) out.unknownExpect = unknown; // stable: the _Expect:_ values the marker doesn't know
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
      // 1.22 review: the run recorded is not a run of the task's _Verify:_ command(s)
      : reason === "command-mismatch" ? EG.commandMismatch(n, f.slug, String((ev && ev.command) || (entry && entry.command) || ""), verifyCmds.join(" · "), expectsFail(task))
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
  const n = askedTaskNumber(number);
  if (!Number.isFinite(n)) return { ok: false, error: taskNumberError(lng, number) };
  const reason = reasonInput(opts.reason, lng);
  if (reason.error) return { ok: false, error: reason.error };
  const blocks = taskBlocks(text);
  const same = blocks.filter((b) => b.number === n);
  if (!same.length) return { ok: false, error: E.taskNotFound(n, tasksFileName(f.dir)) };
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
  // Review 5 (P3): the checkbox's own byte, found before anything is written (refused with nothing changed when it can't be).
  const untickBytes = checkboxBytes(file, text, [task], " ");
  if (untickBytes === false) return { ok: false, error: E.tasksNotText(tasksFileName(f.dir)) };
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
  writeFileAtomic(file, untickBytes || updated);
  maybeRefreshRoadmap(projectDir);
  const runnable = taskMarkers(task).verify.length > 0;
  // 1.16 U review 1: an _Expect: fail_ task keeps its red run (redProof reads through staleBy "undo"): once the fix is in, the
  // re-tick's passing run is the fix going green — the note must not ask for a red run that can no longer happen. redKept: stable.
  const red = staled && expectsFail(task) ? redProof(rec, taskMarkers(task).verify, rec, projectDir) : null; // (rec's own pass: review 2's grandfathering)
  const notes = [U.unticked(n, f.slug, runnable, staled && !red)];
  if (red) notes.push(U.redKept(n, f.slug, String(red.at || "?").slice(0, 10)));
  if (isObj(state.finished) || (isRecord(state.approvals) && isRecord(state.approvals.execution))) notes.push(U.reopened(f.slug));
  const res = { ok: true, feature: f.slug, number: n, unticked: true, evidenceStale: staled, ...progress(updated), note: notes.join(" ") };
  if (red) res.redKept = true;
  if (reason.value) res.reason = reason.value;
  return res;
}

// Tasks as BLOCKS: the task line plus its sub-lines (markers, sub-steps), the phase heading it sits
// under and the **Checkpoint:** that closes its section. This is the ONE task scanner: parseTasks() (the
// line-only view public through spec_status) projects it, and completeTask ticks the line it resolves.
// Task-looking lines inside HTML comments (single- or multi-line) or fenced code are NOT tasks.
// A task line → [line, lead, box, number, text] | null: /^(\s*[-*+]\s*\[)([ xX])\]\s*(\d+)\.(?!\d)\s*(.*)$/ ("1.1 sub-step" is
// not task 1), its text read by headRest (\s*(.*)$ rescanned a long blank run before a line terminator — 1.17 H). Any GFM bullet
// (1.22 review: `* [ ] 1.` / `+ [ ] 1.` read as ZERO tasks, silently); an ordered-list checkbox (`1. [ ] text`) is no task —
// doctor's unread-tasks names it (unreadTaskLines).
// 1.24 r6 D3: its text is every character to the end of the scanner's line (which holds no "\n" and no trailing CR) — a U+2028 /
// U+2029 inside it (pasted from a PDF, Word, a JSON string) is an ordinary character, as a markdown reader reads it: headRest
// refused such a line (a line terminator to `.`), so the task vanished from complete_task / brief while the active view read it.
const RE_TASK_LINE_HEAD = /^(\s*[-*+]\s*\[)([ xX])\]\s*(\d+)\.(?!\d)/;
function taskLine(s) {
  const h = RE_TASK_LINE_HEAD.exec(s);
  if (!h) return null;
  let q = h[0].length;
  while (q < s.length && isWsUnit(s[q])) q++;
  const m = Array.from(h);
  m[0] = s;
  m.push(s.slice(q));
  return m;
}
// A line without its trailing CRs — every one of them (1.24 r6 D3: "\r\r\n", a CRLF file converted to CRLF again, kept a "\r" on
// each line and no task was read). A loop, not /\r+$/ (quadratic on a long run of CRs followed by text).
function dropTrailingCr(l) {
  let e = l.length;
  while (e > 0 && l.charCodeAt(e - 1) === 13) e--;
  return e === l.length ? l : l.slice(0, e);
}
const RE_CHECKPOINT = /^\s*\*\*Checkpoint:?\*\*:?\s*/i;
const COMMENT_MASK = "\u0001";
// CommonMark fence opener: a backtick fence's info string can't hold a backtick ("```npm test``` must pass"
// is inline code, not a fence); a tilde fence's can. The fence run is taken whole ((?=(…))\2): giving it back never
// helps, and a long run followed by a backtick or a line terminator was quadratic (1.17 H).
const RE_TASK_FENCE_OPEN = /^(\s*)(?:(?=(`{3,}))\2[^`]*|(?=(~{3,}))\3.*)$/;
// Read like a markdown reader, in document order: fenced code first, then — outside code — HTML comments,
// where an `inline code span` wins over a "<!--"/"-->" inside it. Comments are blanked IN PLACE (same
// length), so each line keeps its index and the checkbox its column; `vis` is what a reader sees.
// A marker that never closes (a fence opener, a "<!--") is plain text: a stray marker must not silently
// hide every task below it (and flip the phase to "complete"). As in CommonMark, only a "<!--" that starts
// its line (an HTML block) may run past the end of its list item's paragraph; one after text on the line is
// inline and ends with the paragraph — never past the next task line. A "-->" inside fenced code or an inline
// code span doesn't count as the closer that lets a comment open.
const RE_PARA_BREAK = /^\s*$|^\s*(?:[-*+]|\d+[.)])(?:\s|$)|^\s{0,3}#{1,6}(?:\s|$)|^\s*(?:`{3,}|~{3,})|^\s*<!--/;
function scanTaskLines(tasksText) {
  const lines = String(tasksText || "").split("\n").map(dropTrailingCr);
  // Facts about the lines BELOW each line, so an unclosed marker is known the moment it opens (linear
  // passes): the longest ``` / ~~~ closer and the smallest indentation of a non-blank line.
  const n = lines.length;
  const below = { "`": new Array(n + 1).fill(0), "~": new Array(n + 1).fill(0), indent: new Array(n + 1).fill(Infinity) };
  for (let i = n - 1; i >= 0; i--) {
    const c = lines[i].match(RE_FENCE_CLOSE);
    for (const ch of ["`", "~"]) below[ch][i] = Math.max(below[ch][i + 1], c && c[1][0] === ch ? c[1].length : 0);
    below.indent[i] = lines[i].trim() ? Math.min(below.indent[i + 1], indentOf(lines[i])) : below.indent[i + 1];
  }
  // Where a multi-line comment may find its "-->": closers[k] = lines before k holding one outside fenced
  // code and code spans; a line-start "<!--" searches until its list item ends (the next less-indented
  // line — nothing is less than 0, so top level runs to the end), an inline one until its paragraph ends.
  const pre = { fence: null };
  const closers = [0];
  for (let i = 0; i < n; i++) closers.push(closers[i] + (!fenceLine(pre, lines, i, below) && hasOutsideCode(lines[i], "-->") ? 1 : 0));
  const itemEnd = new Array(n).fill(n);
  const paraEnd = new Array(n + 1).fill(n);
  for (let i = n - 1, stack = []; i >= 0; i--) {
    paraEnd[i] = RE_PARA_BREAK.test(lines[i]) || RE_CHECKPOINT.test(lines[i]) ? i : paraEnd[i + 1];
    if (!lines[i].trim()) continue;
    const ind = indentOf(lines[i]);
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    if (stack.length) itemEnd[i] = stack[stack.length - 1].i;
    stack.push({ i, ind });
  }
  const out = [];
  const st = { fence: null };
  let comment = false;
  // Review 5 — CommonMark's INDENTED code block: outside every list, a line indented 4+ columns after a blank line (or a heading,
  // or at the top) is code, and so is each line after it while it stays indented or blank: its `    - [ ] 1. example` is no
  // task (resolveTask's "first open task 1" ticked the example above the real one). Inside a list — a task's sub-lines, a nested
  // task, `- Phase A` then `    - [ ] 1.` — the indentation is the item's own, as before. listStep reads each line once it is
  // scanned: a list item opens the list, a heading or an unindented line after a blank one closes it.
  const ind = { list: false, blank: true, heading: false, code: false };
  const listStep = (s, o) => {
    if (!s.trim()) { ind.blank = true; ind.heading = false; return; }
    if (o.code) { ind.blank = false; ind.heading = false; return; }
    if (!o.vis.trim()) return; // a comment-only line
    const h = /^\s{0,3}#{1,6}(?:\s|$)/.test(o.vis);
    if (/^\s*(?:[-*+]|\d{1,9}[.)])(?:\s|$)/.test(o.vis)) ind.list = true;
    else if (h || (ind.blank && indentCols(o.vis) === 0)) ind.list = false;
    ind.blank = false;
    ind.heading = h;
  };
  for (let i = 0; i < n; i++) {
    const src = lines[i];
    const inComment = comment; // the line starts inside a multi-line comment (a "<!--" on it is comment text)
    if (i > 0) listStep(lines[i - 1], out[i - 1]);
    if (!comment && !st.fence) {
      const blank = !src.trim();
      if (ind.code && !blank && indentCols(src) < 4) ind.code = false;
      if (!ind.code && !blank && !ind.list && (ind.blank || ind.heading) && indentCols(src) >= 4) ind.code = true;
      if (ind.code) { out.push({ vis: src, code: true, fenceOpen: false, indented: true }); continue; }
    }
    // An open fence never coexists with a comment: neither opens inside the other.
    const fl = !comment && fenceLine(st, lines, i, below);
    if (fl) { out.push({ vis: src, code: true, fenceOpen: fl === "open" }); continue; }
    let masked = "";
    let seen = false; // visible text before k on this line (a "<!--" after it is inline)
    const lastClose = src.lastIndexOf("-->");
    const ticks = backtickRuns(src);
    for (let k = 0; k < src.length;) {
      if (comment) {
        const end = src.indexOf("-->", k);
        const stop = end === -1 ? src.length : end + 3;
        masked += COMMENT_MASK.repeat(stop - k);
        k = stop;
        if (end !== -1) comment = false;
      } else if (src[k] === "`") {
        const stop = ticks.spanEnd(k); // an unmatched run is literal backticks
        masked += src.slice(k, stop);
        seen = true;
        k = stop;
      } else if (src.startsWith("<!--", k) && (lastClose >= k + 4 || commentCloses(i, !seen))) {
        comment = true;
        masked += COMMENT_MASK.repeat(4);
        k += 4;
      } else {
        if (!seen && /\S/.test(src[k])) seen = true;
        masked += src[k++];
      }
    }
    const vis = masked.split(COMMENT_MASK).join("");
    const t = taskLine(masked.split(COMMENT_MASK).join(" ")); // column-aligned with the source
    if (!t) { out.push({ vis, code: false, task: null, inComment }); continue; }
    const text = masked.slice(masked.length - t[4].length).split(COMMENT_MASK).join("").trim();
    out.push({ vis, code: false, task: { col: t[1].length, done: t[2].toLowerCase() === "x", number: parseInt(t[3], 10), text }, inComment });
  }
  return out;
  // Does a "<!--" on line i that doesn't close on its own line have a closer within its reach?
  function commentCloses(i, lineStart) {
    const end = lineStart ? itemEnd[i] : paraEnd[i + 1];
    return end > i + 1 && closers[end] - closers[i + 1] > 0;
  }
}
// One fence step for line i (`st.fence` carries an open fence): "open" / "code" (a fence line) or null.
function fenceLine(st, lines, i, below) {
  const src = lines[i];
  const indent = indentOf(src);
  if (st.fence) {
    if (closesFence(src, st.fence.mark)) { st.fence = null; return "code"; }
    // A fence opened inside a list item ends with it: a less-indented line (the next "- [ ] N.") is
    // outside, as in CommonMark — so an unclosed fence in a task's body can't swallow the next task.
    if (!(st.fence.indent > 0 && src.trim() && indent < st.fence.indent)) return "code";
    st.fence = null;
  }
  const f = src.match(RE_TASK_FENCE_OPEN);
  const mark = f && (f[2] || f[3]);
  if (mark && (below[mark[0]][i + 1] >= mark.length || (indent > 0 && below.indent[i + 1] < indent))) {
    st.fence = { mark, indent };
    return "open";
  }
  return null;
}
// Leading whitespace width — a UTF-8 BOM on the first line is not indentation.
function indentOf(s) {
  return s.match(/^\s*/)[0].replace(/\uFEFF/g, "").length;
}
// Leading indentation in COLUMNS, as CommonMark counts it (a tab to the next multiple of 4; a BOM is no column).
function indentCols(s) {
  let c = 0;
  for (let k = s.charCodeAt(0) === 0xfeff ? 1 : 0; k < s.length; k++) {
    if (s[k] === " ") c++;
    else if (s[k] === "\t") c += 4 - (c % 4);
    else break;
  }
  return c;
}
// Does `token` occur in `s` outside every `inline code span`?
function hasOutsideCode(s, token) {
  const ticks = backtickRuns(s);
  for (let k = 0; k < s.length;) {
    if (s[k] === "`") k = ticks.spanEnd(k);
    else if (s.startsWith(token, k)) return true;
    else k++;
  }
  return false;
}
// Code spans of one line, read left to right: spanEnd(k) — for the backtick run starting at k — is the index
// just past its code span (the next run of exactly as many backticks closes it), or past the run itself when
// nothing closes it (literal backticks). Runs are indexed once by length and every length's cursor only
// moves forward (callers ask with a growing k), so a long line of backticks stays linear.
function backtickRuns(s) {
  const byLen = new Map();
  for (let k = 0; k < s.length;) {
    if (s[k] !== "`") { k++; continue; }
    let e = k;
    while (s[e] === "`") e++;
    if (!byLen.has(e - k)) byLen.set(e - k, { at: [], cur: 0 });
    byLen.get(e - k).at.push(k);
    k = e;
  }
  return {
    spanEnd(k) {
      let e = k;
      while (s[e] === "`") e++;
      const runs = byLen.get(e - k);
      if (!runs) return e; // never: k always starts a whole run
      while (runs.cur < runs.at.length && runs.at[runs.cur] < e) runs.cur++;
      return runs.cur < runs.at.length ? runs.at[runs.cur] + (e - k) : e;
    },
  };
}
// The scan is linear but not cheap, and one refresh asks for the same tasks.md many times (status, phase, roadmap row,
// verification) — the last few results are kept by text. Callers get their own copies (they may annotate them).
const TASK_BLOCKS_MEMO = new Map();
const TASK_BLOCKS_MEMO_MAX = 32;
// 1.24 r6 D1 — the tasks.md a block was read from, for ownRecord's renumber rule (evidence.js): every block taskBlocks() hands
// out → the blocks of that read, and taskPeerStamps(block) → their task stamps (taskStamp: the text, ≤ 500 characters) — one
// Set per scan, computed on first use and shared by its copies. A block built any other way (or copied by a caller) has none:
// ownRecord then keeps its older rule.
const BLOCK_PEERS = new WeakMap();
const SCAN_STAMPS = new WeakMap();
function taskPeerStamps(block) {
  const blocks = block && typeof block === "object" ? BLOCK_PEERS.get(block) : undefined;
  if (!blocks) return null;
  let stamps = SCAN_STAMPS.get(blocks);
  if (!stamps) { stamps = new Set(blocks.map(taskStamp)); SCAN_STAMPS.set(blocks, stamps); }
  return stamps;
}
function taskBlocks(tasksText) {
  const key = String(tasksText || "");
  let blocks = TASK_BLOCKS_MEMO.get(key);
  if (blocks) {
    TASK_BLOCKS_MEMO.delete(key); // most recently used last
  } else {
    blocks = scanTaskBlocks(key);
    if (TASK_BLOCKS_MEMO.size >= TASK_BLOCKS_MEMO_MAX) TASK_BLOCKS_MEMO.delete(TASK_BLOCKS_MEMO.keys().next().value);
  }
  TASK_BLOCKS_MEMO.set(key, blocks);
  return blocks.map((b) => { const c = { ...b, body: b.body.slice(), bodyCode: b.bodyCode.slice() }; BLOCK_PEERS.set(c, blocks); return c; });
}
// ownLines (changeViews only): an array filled with true at every line index a task block holds — its task line, its body
// lines and the fenced code it owns.
function scanTaskBlocks(tasksText, ownLines) {
  const blocks = [];
  let phase = null;
  let cur = null;
  let open = []; // tasks of the current section still waiting for their checkpoint
  let prevBlank = false;
  let owner = null; // the task a fenced block belongs to (null = a free-standing block)
  const hold = (i) => { if (ownLines) ownLines[i] = true; };
  scanTaskLines(tasksText).forEach((ln, i) => {
    const line = ln.vis;
    if (ln.code) {
      // Fenced code is never a task, heading or checkpoint. Right under a task it stays in its body (the brief shows
      // it) — flagged in bodyCode: an example's _Verify:_ / _Implements:_ / IDs are never the task's own (taskProse).
      if (ln.fenceOpen) owner = cur && line.trim() && (/^\s/.test(line) || !prevBlank) ? cur : null;
      if (owner && line.trim()) { owner.body.push(line.trim()); owner.bodyCode.push(owner.body.length - 1); }
      if (owner) hold(i);
      if (!owner) cur = null;
      prevBlank = !line.trim();
      return;
    }
    owner = null;
    const h = atxHeading(line); // /^#{1,6}\s+(.*?)\s*$/
    if (h) {
      phase = h.text;
      cur = null;
      open = [];
    } else if (RE_CHECKPOINT.test(line)) {
      const cp = line.replace(RE_CHECKPOINT, "").trim();
      open.forEach((b) => { b.checkpoint = cp; });
      cur = null;
      open = [];
    } else if (ln.task) {
      const text = ln.task.text;
      // Leading tag run — only known tags: [US1] [US2] [shared] [P]. (A description that happens to
      // start with [brackets] is NOT a tag.)
      const lead = (text.match(/^(?:\[(?:US\d+|shared|P)\]\s*)+/i) || [""])[0];
      cur = {
        number: ln.task.number,
        done: ln.task.done,
        parallel: /\[P\]/i.test(lead), // [P] = can run in parallel (different files, no deps)
        story: (lead.match(/\[(US\d+|shared)\]/i) || [])[1] || null,
        text,
        body: [],
        bodyCode: [], // indices into body of the lines that are fenced code
        phase,
        checkpoint: null,
        line: i, // source line index + checkbox column: completeTask ticks exactly this task
        col: ln.task.col,
      };
      blocks.push(cur);
      open.push(cur);
      hold(i);
    } else if (cur && line.trim() && (/^\s/.test(line) || !prevBlank)) {
      cur.body.push(line.trim()); // indented sub-line, or a lazy continuation right under the task
      hold(i);
    } else if (line.trim()) {
      cur = null; // un-indented prose after a blank line is not part of the task
    }
    prevBlank = !line.trim();
  });
  return blocks;
}

// 1.22 review — checkbox list lines the ONE scanner does not read as tasks: an ordered-list checkbox (`1. [ ] text`), an
// unnumbered one outside every task block (`- [ ] text`) — never ticked, briefed or verified (a sub-step checkbox in a task's
// body is that task's). Comments and fenced code hold none. → [{ line (1-based), text }] — doctor's unread-tasks warn.
const RE_LIST_BOX_LINE = /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[[ xX]\]/;
function unreadTaskLines(tasksText) {
  const src = String(tasksText || "");
  const held = new Array(src.split("\n").length).fill(false);
  scanTaskBlocks(src, held);
  const out = [];
  // (review 5: a checkbox line in an INDENTED code block — 4+ spaces after a blank line, outside a list — is named too: indenting
  // real tasks that way reads as zero tasks)
  scanTaskLines(src).forEach((ln, i) => {
    if ((!ln.code || ln.indented) && !ln.task && !held[i] && RE_LIST_BOX_LINE.test(ln.vis)) out.push({ line: i + 1, text: ln.vis.trim().slice(0, 80) });
  });
  return out;
}
// …as the doctor names them ("L5 `1. [ ] Build the parser`, L9 …", at most 8, then "+N"), or null when there is none.
function unreadTasksDetail(tasksText) {
  const u = unreadTaskLines(tasksText);
  return u.length ? u.slice(0, 8).map((x) => "L" + x.line + " `" + x.text + "`").join(", ") + (u.length > 8 ? ", +" + (u.length - 8) : "") : null;
}
// Duplicated numbers: the FIRST OPEN task with that number, else the first one. completeTask, taskBrief and
// the CLI's `done --run` all resolve through here, so the _Verify:_ that runs belongs to the task that ticks.
function resolveTask(tasks, n) {
  return tasks.find((t) => t.number === n && !t.done) || tasks.find((t) => t.number === n) || null;
}
// Task numbers used more than once (doctor's duplicate-tasks check).
function duplicateTaskNumbers(tasks) {
  const seen = new Set();
  const dups = new Set();
  for (const t of tasks) (seen.has(t.number) ? dups : seen).add(t.number);
  return [...dups].sort((a, b) => a - b);
}

// A task's own lines: its text and the body lines OUTSIDE fenced code. Markers, IDs and the bugfix gate read these —
// "HTML comments and fenced code never count": a ```md example under a task holding `_Verify: rm -rf dist_` used to
// become the task's _Verify:_ (and `done --run` executed it). The brief still shows the whole body.
function taskProse(block) {
  const code = new Set(block.bodyCode || []);
  return [block.text, ...block.body.filter((_, k) => !code.has(k))];
}
// A RED-PHASE task: its job is a test that must FAIL ("Write regression test T-01 and watch it fail for the right reason",
// "write the failing tests", PT "vê-lo falhar pela razão certa", ES "verla fallar por la razón correcta"). Its run is red by
// design, so a must-pass _Verify:_ on it can never verify it — completeTask and next_action say how to fix that
// (redPhaseVerify) instead of "re-run it" / "a failing run means fixing the code". Markers are not prose (the regex reads
// the task's own text lines, _Verify:_ values removed).
const RE_RED_PHASE_TASK = new RegExp([
  "watch (?:it|them) fail", "fail(?:s|ing)? for the right reason", "(?:write|writes|writing) (?:the |a |an |every )?failing (?:regression |unit |integration |e2e )?tests?",
  "red phase", "red before the fix",
  "v[êe]-l[oa]s? falhar", "ver (?:o teste |os testes )?falhar", "falh(?:ar|e|a|em) pel[ao] (?:raz[ãa]o|motivo) cert[ao]", "teste(?:s)? (?:de regress[ãa]o )?a falhar", "teste(?:s)? (?:de regress[ãa]o )?falhando", "fase vermelha", // pt-BR: falhando
  "verl[ao]s? fallar", "fall(?:ar|e|a|en) por (?:la|el) (?:raz[óo]n|motivo) correct[ao]", "prueba(?:s)? (?:de regresi[óo]n )?que falla", "fase roja",
].join("|"), "i");
function redPhaseTask(block) {
  return RE_RED_PHASE_TASK.test(taskProse(block).map(withoutTaskMarkers).join(" "));
}
// The redPhaseVerify hint for a block (null unless it is a red-phase task with a runnable _Verify:_ and no _Expect: fail_ —
// with it, the red run IS the proof): the hint points at _Expect: fail_ and names its first T-ID (text or _Makes green:_),
// else the localized "the test".
function redPhaseHint(block, slug, lang) {
  if (!block || expectsFail(block) || !redPhaseTask(block) || !taskMarkers(block).verify.some((c) => !/^\[.*\]$/.test(c.trim()))) return null;
  const EG = i18n.msg(lang).evidenceGate;
  const t = (taskProse(block).join(" ").match(RE_TEST_REF) || [])[0];
  return EG.redPhaseVerify(block.number, slug, t || EG.redPhaseTestWord);
}
// tasks.md as the task scanner reads it: HTML comments out and fenced code blanked line for line (the same fence
// rules as taskBlocks — an unclosed fence in a task's body ends with the item). trace_check and implementsRefs read
// AC/T IDs and _Implements:_ from it, so a fenced example is never coverage nor a planned file.
function tasksProseText(tasksText) {
  return scanTaskLines(tasksText).map((l) => (l.code ? "" : l.vis)).join("\n");
}

// 1.21 review C1 — a CHANGE keeps its criteria AND its tasks in ONE file, change.md (read through the requirements.md /
// tasks.md alias): read whole, a task's `_Requirements: US-1.AC-7_` counted as a DEFINED criterion and every AC as covered by
// its own definition — trace_check could never fail. Two views of the text, line for line (the other lines blanked, so a line
// number still points into change.md): `criteria` = the file WITHOUT its task blocks (what EARS, trace's required ACs, the scope
// check, the matrix and spec_impact read as the change's criteria), `tasks` = ONLY its task blocks (taskBlocks' own lines — the
// task line, its body, the fenced code it owns): what trace reads as the tasks.
function changeViews(text) {
  const src = String(text == null ? "" : text);
  const lines = src.split("\n");
  const own = new Array(lines.length).fill(false);
  scanTaskBlocks(src, own);
  return { criteria: lines.map((l, i) => (own[i] ? "" : l)).join("\n"), tasks: lines.map((l, i) => (own[i] ? l : "")).join("\n") };
}
// A feature's criteria text as every reader of its criteria reads it: requirements.md, or — a change — its change.md without the
// task blocks (changeViews). null when there is none.
function criteriaText(dir) {
  const text = readIfExists(path.join(dir, "requirements.md"));
  return text != null && isChangeDir(dir) ? changeViews(text).criteria : text;
}
// The file a feature's tasks live in, as messages name it: tasks.md, or a change's change.md (1.21 review C10).
const tasksFileName = (dir) => (isChangeDir(dir) ? CHANGE_FILE : "tasks.md");
// …and its tasks text for the readers of IDs in it (trace_check): tasks.md, or a change's task blocks alone.
function tasksIdText(dir) {
  const text = readIfExists(path.join(dir, "tasks.md"));
  return text != null && isChangeDir(dir) ? changeViews(text).tasks : text;
}

// `_Label: value_` markers on the task line or its sub-lines — or `*Label: value*`, the same italics (a renderer shows
// both alike). ONE reader, taskMarkerSpans(), for every consumer of the English-stable task markers: taskMarkers (so
// the brief, the evidence gate, the bugfix gate, red-green, overlaps, the guard), trace_check's and implementsRefs'
// _Implements:_, _Size:_ and the templates check. The value ends at the first `_` (`*`) that closes the italics — one
// followed by whitespace, the end of the line, or closing punctuation first: `(_Verify: npm test_)`, `… _Verify: x_.`,
// `_Implements: src/a.ts_;` (1.14 full review Pa1 — those yielded NO marker: a task whose check fails ticked as "nothing
// to verify", and a done task's missing file passed trace_check). An underscore inside the value survives
// (`src/keys_util.js`, `src/__init__.py`). Linear: a line's closers are found once, its openers walk them with a cursor.
// Review 5 (M4) — what a markdown reader reads as italics, never more:
//   - a `_` opener after a letter, a digit or another `_` opens nothing (CommonMark: intraword `_` is no emphasis; `__Verify: x__`
//     is bold, and read as italics its value was `x_` — `done --run` ran `npm test_`);
//   - an EMPTY marker (`_Verify:_`, `*Implements:*`) is a span with an empty value: a title naming a marker ("Document the
//     _Verify:_ and _Implements:_ markers") yielded the runnable _Verify:_ `_ and _Implements:` — the task could never be
//     verified, and `done --run` executed it; "_Depends:_ and _Size:_" failed doctor's task-deps, refusing the tasks approval;
//   - a closer is searched only before the next opener (else the end of the line) — the value never swallows a marker after it;
//   - inline code is code: a `_` / `*` inside a code span never closes a marker (``_Verify: `npm test -- -g "a_ b"`_`` was cut at
//     `"a`), and a label inside one opens none.
const TASK_MARKER_LABELS = ["Requirements", "Makes green", "Affects evals", "Emits metrics", "Implements", "Verify", "Expect", "Size", "Depends"]; // _Depends:_ (1.14 F3)
// 1.24 r6 D9 — bold-italic: `***Verify: x***` opens at its third `*` (exactly two before it — `**Verify:**` stays a bold label, no
// marker); a closer may be followed by `*` (`**_Verify: x_**`), quotes (`("_Verify: x_")`, “…”, ‘…’, «…»), a dash (`_Verify: x_—`)
// — CommonMark's right-flanking rule (a closer followed by punctuation); and a run of `*` closes at its first star.
const RE_TASK_MARKER_OPEN = new RegExp("(?:(?<![_\\p{L}\\p{N}])_|(?<![*\\p{L}\\p{N}_])\\*|(?<=(?:^|[^*\\p{L}\\p{N}_])\\*\\*)\\*)(" + TASK_MARKER_LABELS.join("|") + "):[ \\t]*", "giu");
const MARKER_CLOSE_PUNCT = new Set([".", ",", ";", ":", "!", "?", ")", "]", "*", '"', "'", "—", "–", "”", "’", "»"]);
// → [{ key (the label, lower-case), value (untrimmed), start, end }], in line order.
// A closer followed directly by whitespace / the end ("plain") wins over one followed by closing punctuation, when one exists
// before the next marker opener (else the end of the line): `_Verify: python -c "import a_; print(1)"_` keeps its whole
// command, `(_Verify: npm test_), _Implements: a.js_` still closes at "test_)" (full review R7 — Pa1 cut the first at "a_;").
// 1.22 review — memoized by line (bounded; a line past MARKER_MEMO_LINE_MAX characters is scanned every time): one ROADMAP.md
// refresh reads the same task lines over and over (status, the schedule, verification, sizes, every roadmap row) and each scan
// built a RegExp and two passes — ~45 ms of every refresh on 30 features × 40 tasks. The result is FROZEN: callers share it.
const MARKER_SPANS_MEMO = new Map();
const MARKER_SPANS_MEMO_MAX = 8192;
const MARKER_MEMO_LINE_MAX = 4000;
const NO_MARKER_SPANS = Object.freeze([]);
function taskMarkerSpans(line) {
  const s = String(line == null ? "" : line);
  if (!s.includes(":")) return NO_MARKER_SPANS;
  if (s.length > MARKER_MEMO_LINE_MAX) return Object.freeze(scanMarkerSpans(s).map(Object.freeze));
  let hit = MARKER_SPANS_MEMO.get(s);
  if (!hit) {
    hit = Object.freeze(scanMarkerSpans(s).map(Object.freeze));
    if (MARKER_SPANS_MEMO.size >= MARKER_SPANS_MEMO_MAX) MARKER_SPANS_MEMO.clear();
    MARKER_SPANS_MEMO.set(s, hit);
  }
  return hit;
}
function scanMarkerSpans(s) {
  const out = [];
  // The characters inside inline code spans (a backtick run closed by a run of the same length — backtickRuns, linear).
  let inCode = null;
  if (s.includes("`")) {
    const ticks = backtickRuns(s);
    for (let k = 0; k < s.length;) {
      if (s[k] !== "`") { k++; continue; }
      let r = k;
      while (s[r] === "`") r++;
      const e = ticks.spanEnd(k);
      if (e > r) (inCode || (inCode = new Uint8Array(s.length))).fill(1, k, e);
      k = e;
    }
  }
  const re = new RegExp(RE_TASK_MARKER_OPEN.source, RE_TASK_MARKER_OPEN.flags); // its own lastIndex
  const opens = [];
  let m;
  while ((m = re.exec(s)) !== null) if (!inCode || !inCode[m.index]) opens.push({ index: m.index, len: m[0].length, key: m[1] });
  if (!opens.length) return out;
  // Per delimiter, the indices of the `_` / `*` that can close a marker, ascending: plain, or before punctuation.
  const ok = new Array(s.length + 1).fill(false); // ok[i]: from i, closing punctuation then whitespace or the end
  ok[s.length] = true;
  for (let i = s.length - 1; i >= 0; i--) ok[i] = /\s/.test(s[i]) || (MARKER_CLOSE_PUNCT.has(s[i]) && ok[i + 1]);
  const plain = { _: [], "*": [] }, punct = { _: [], "*": [] };
  for (let j = 0; j < s.length; j++) {
    if (s[j] === "*" && s[j - 1] === "*") continue; // r6 D9: a run of `*` closes at its first star (`***Verify: x***` → x)
    if ((s[j] === "_" || s[j] === "*") && ok[j + 1] && !(inCode && inCode[j])) (j + 1 === s.length || /\s/.test(s[j + 1]) ? plain : punct)[s[j]].push(j);
  }
  const cursor = { plain: { _: 0, "*": 0 }, punct: { _: 0, "*": 0 } };
  const next = (lists, kind, d, v) => { // the first closer after v (the value holds one character at least); cursors only move on
    const list = lists[d];
    let p = cursor[kind][d];
    while (p < list.length && list[p] <= v) p++;
    cursor[kind][d] = p;
    return p < list.length ? list[p] : -1;
  };
  let at = 0;
  for (let k = 0; k < opens.length; k++) {
    const o = opens[k];
    if (o.index < at) continue; // inside the previous marker's value
    const d = s[o.index];
    const v = o.index + o.len;
    // An empty marker (`_Verify:_`): the label named, no value — a span of its own, so nothing after it reads as its value.
    if (s[v] === d && ok[v + 1] && !(inCode && inCode[v])) {
      out.push({ key: o.key.toLowerCase(), value: "", start: o.index, end: v + 1 });
      at = v + 1;
      continue;
    }
    let limit = s.length;
    for (let q = k + 1; q < opens.length; q++) if (opens[q].index > v) { limit = opens[q].index; break; }
    const pc = next(plain, "plain", d, v), uc = next(punct, "punct", d, v);
    const close = pc >= 0 && pc < limit ? pc : uc >= 0 && uc < limit ? uc : -1; // never past the next opener
    if (close < 0) continue;
    out.push({ key: o.key.toLowerCase(), value: s.slice(v, close), start: o.index, end: close + 1 });
    at = close + 1;
  }
  return out;
}
// Every raw value of one marker (`key`, lower-case) in a text, line by line — callers split and trim.
function taskMarkerValues(text, key) {
  const out = [];
  for (const line of String(text || "").split("\n")) for (const sp of taskMarkerSpans(line)) if (sp.key === key) out.push(sp.value);
  return out;
}
// The line with every marker blanked (a red-phase task's prose is read without its _Verify:_ values).
function withoutTaskMarkers(line) {
  const s = String(line == null ? "" : line);
  let out = "", at = 0;
  for (const sp of taskMarkerSpans(s)) { out += s.slice(at, sp.start) + " "; at = sp.end; }
  return out + s.slice(at);
}
const WHOLE_VALUE_MARKERS = new Set(["emits metrics", "affects evals", "verify", "expect"]); // commas belong to the value
// 1.22 review — memoized by the block's own lines (taskProse, bounded); every caller gets its own copy of the lists.
const TASK_MARKERS_MEMO = new Map();
const TASK_MARKERS_MEMO_MAX = 4096;
function taskMarkers(block) {
  const prose = taskProse(block);
  const key = prose.join("\n");
  let m = key.length <= 4 * MARKER_MEMO_LINE_MAX ? TASK_MARKERS_MEMO.get(key) : undefined;
  if (!m) {
    m = scanTaskMarkers(prose);
    if (key.length <= 4 * MARKER_MEMO_LINE_MAX) {
      if (TASK_MARKERS_MEMO.size >= TASK_MARKERS_MEMO_MAX) TASK_MARKERS_MEMO.clear();
      TASK_MARKERS_MEMO.set(key, m);
    }
  }
  const out = {};
  for (const k of Object.keys(m)) out[k] = m[k].slice();
  return out;
}
function scanTaskMarkers(prose) {
  const out = { requirements: [], "makes green": [], "affects evals": [], "emits metrics": [], implements: [], verify: [], expect: [], depends: [] };
  const seen = {}; // per key: what out[key] holds — a long `_Depends: 1, 2, …_` list stays linear (no includes() per value)
  for (const line of prose) {
    for (const sp of taskMarkerSpans(line)) {
      const key = sp.key;
      if (!out[key]) continue; // _Size:_ — taskSize reads it
      let parts = WHOLE_VALUE_MARKERS.has(key) ? [sp.value.trim()] : sp.value.split(/[,;]/).map((s) => s.trim());
      if (key === "verify") parts = parts.map((p) => stripEnds(p, isBacktickUnit).trim()).filter((p) => p && !/^\[.*\]$/.test(p));
      const have = seen[key] || (seen[key] = new Set());
      parts.filter(Boolean).forEach((p) => { if (!have.has(p)) { have.add(p); out[key].push(p); } });
    }
  }
  return out;
}
// Marker-shaped text on a task's own lines that yielded NO marker (1.14 full review Pa1): "Verify:" / "Implements:" /
// "Makes green:" / "Expect:" outside every parsed marker and every code span — `**Verify:** npm test`, `Verify: npm test` —
// and (1.24 r6 D2) an EMPTY marker written apart from its value: `_Verify:_ npm test`, `- _Verify:_ `npm test``, `*Verify:*
// npm test` (emptyLabelValues — review 5 made `_Verify:_` an empty span, which hid them). The tools read nothing there (no check
// to run, no file to trace). → [{ number, labels }] — doctor's malformed-markers warn.
// "depends:" only before a task number ("depends: 3", "Depends: #3, 5") — prose like "(depends: the schema from task 1)" is
// prose (feature review R8).
const RE_MARKER_WORD = /(?<![\p{L}\p{N}])(verify|implements|makes[ \t]+green|expect|depends(?=[ \t]*:[ \t*_]*#?\d))[ \t]*:/giu;
const MARKER_WORD_LABEL = { verify: "Verify", implements: "Implements", "makes green": "Makes green", expect: "Expect", depends: "Depends" };
// 1.24 r6 D2 — the empty markers of a line followed by a value: a code span right after one (any line), or plain text after the
// line's ONLY empty marker whose first word is no marker noun — a title naming markers is prose ("Document the _Verify:_ and
// _Implements:_ markers": two empty markers; "the _Verify:_ marker in the README"; PT / ES "marcador", "etiqueta"). → [keys]
const MARKER_NOUNS = new Set(["marker", "markers", "label", "labels", "tag", "tags", "field", "fields", "line", "lines", "spelling", "spellings",
  "syntax", "value", "values", "and", "or", "marcador", "marcadores", "etiqueta", "etiquetas", "campo", "campos", "linha", "linhas", "línea", "líneas",
  "valor", "valores", "e", "ou", "y", "o"]);
function emptyLabelValues(line) {
  const spans = taskMarkerSpans(line);
  const empties = spans.filter((sp) => sp.value === "");
  const out = [];
  let ticks = null;
  for (const e of empties) { // in line order: backtickRuns' cursor only moves forward
    let p = e.end;
    while (p < line.length && (line[p] === " " || line[p] === "\t")) p++;
    if (p >= line.length) continue;
    if (line[p] === "`") {
      ticks = ticks || backtickRuns(line);
      let r = p;
      while (line[r] === "`") r++;
      if (ticks.spanEnd(p) > r) { out.push(e.key); continue; } // a code span: the value, written apart
    }
    if (empties.length > 1) continue; // several empty markers: a sentence naming them
    const next = spans.find((sp) => sp.start >= p);
    const word = (line.slice(p, next ? next.start : line.length).match(/^[\p{L}\p{N}]+/u) || [""])[0].toLowerCase();
    if (word && !MARKER_NOUNS.has(word)) out.push(e.key);
  }
  return out;
}
const markerLabel = (key) => TASK_MARKER_LABELS.find((l) => l.toLowerCase() === key) || key;
function malformedMarkers(blocks) {
  const out = [];
  for (const b of blocks) {
    const labels = new Set();
    for (const line of taskProse(b)) {
      for (const key of emptyLabelValues(line)) labels.add(markerLabel(key)); // r6 D2
      if (!/verify|implements|green|expect|depends/i.test(line)) continue;
      const masked = withoutTaskMarkers(line);
      const ticks = backtickRuns(masked);
      let plain = "";
      for (let k = 0; k < masked.length;) {
        if (masked[k] !== "`") { plain += masked[k++]; continue; }
        let r = k;
        while (masked[r] === "`") r++;
        const e = ticks.spanEnd(k);
        plain += e > r ? " " : masked.slice(k, e); // a code span is code; an unmatched run is literal backticks
        k = e;
      }
      for (const m of plain.matchAll(RE_MARKER_WORD)) labels.add(MARKER_WORD_LABEL[m[1].toLowerCase().replace(/[ \t]+/g, " ")]);
    }
    if (labels.size) out.push({ number: b.number, labels: [...labels] });
  }
  return out;
}

// Review 5 — a _Verify:_ value that looks garbled (doctor's verify-suspicious warn; `done --run` would run it exactly as written):
// it starts with `_` or `*` (a marker's delimiter read into the value), it holds a code span INSIDE it (`` `npm test` and `npm run
// lint` `` — two commands written as one; the whole-value span is dropped before), or a quote has no partner (an odd count of `"`;
// of `'` not between two letters — `it's` is a word). → [{ number, values }]
function suspiciousVerify(blocks) {
  const out = [];
  for (const b of blocks) {
    const values = taskMarkers(b).verify.filter(verifySuspicious);
    if (values.length) out.push({ number: b.number, values });
  }
  return out;
}
function verifySuspicious(v) {
  if (/^[_*]/.test(v)) return true;
  if (v.includes("`")) {
    const ticks = backtickRuns(v);
    for (let k = 0; k < v.length;) {
      if (v[k] !== "`") { k++; continue; }
      let r = k;
      while (v[r] === "`") r++;
      const e = ticks.spanEnd(k);
      if (e > r) return true; // a closed code span
      k = e;
    }
  }
  const word = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
  let dq = 0, sq = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '"' && v[i - 1] !== String.fromCharCode(92)) dq++;
    else if (v[i] === "'" && !(word(v[i - 1]) && word(v[i + 1]))) sq++;
  }
  return dq % 2 === 1 || sq % 2 === 1;
}

// tasks.md → "## Global Constraints" (EN/PT/ES): exact values every task must respect. Placeholder-only
// bullets from the scaffold are skipped.
const RE_GLOBAL_CONSTRAINTS = /global constraints|restri[çc][õo]es globais|restricciones globales/i;
function globalConstraints(tasksText) {
  const lines = stripHtmlComments(tasksText || "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && RE_GLOBAL_CONSTRAINTS.test(l));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i++) {
    const l = lines[i].trim();
    if (l && !/^[-*+]\s*\[[^\]]*\]\s*$/.test(l)) out.push(l);
  }
  return out;
}

// ---------------------------------------------------------------------------
// spec_task_brief — a self-contained brief for ONE task (subagent-driven execution)
// ---------------------------------------------------------------------------

// +ai prompt work (touches prompts/, or an _Affects evals:_ task about a prompt) stays with the controller.
function isPromptTask(block, mk, tracks) {
  return tracks.includes("ai") && (mk.implements.some((f) => /(^|[\\/])prompts[\\/]/.test(f)) ||
    (mk["affects evals"].length > 0 && /(?<![\p{L}])prompts?(?![\p{L}])/iu.test(block.text)));
}

// AC ID → the full logical criterion (multi-line EARS folded by criterionBlocks). Exact-ID keys, so
// US-1.AC-1 can never resolve to US-1.AC-10.
const RE_DEFINES_AC = /^(?:(?:\d+[.)]|[-*+])\s+)?(?:\*\*|__)?(US-\d+\.AC-\d+)(?!\d)/;
function acIndex(reqText) {
  const map = new Map();
  const { cleaned, blocks } = criterionBlocks(reqText || "");
  const entry = (id, b) => ({ id, text: b.text.replace(RE_LIST_ITEM, ""), line: b.line });
  for (const b of blocks) {
    const m = b.text.match(RE_DEFINES_AC);
    if (m && !map.has(m[1])) map.set(m[1], entry(m[1], b));
  }
  // A `_Supersedes: other/US-1.AC-2_` reference is another feature's AC, not one of this feature's — stripped over the
  // criterion's own lines (joined by "\n"), so a marker wrapped onto the next line follows traceCheck's wrap rule.
  const byLine = lineMap(cleaned);
  for (const b of blocks) {
    for (const id of extractAcIds(stripSupersedes(blockLines(byLine, b).map((l) => l.text).join("\n")))) if (!map.has(id)) map.set(id, entry(id, b));
  }
  stripFencedCode(stripHtmlComments(reqText || "")).split(/\r?\n/).forEach((l, i) => { // a table in a ``` example is code
    if (!/^\s*\|/.test(l)) return;
    for (const id of extractAcIds(stripSupersedes(l))) if (!map.has(id)) map.set(id, { id, text: l.trim(), line: i + 1 });
  });
  return map;
}

// The `### US-n …` heading and its body (As a / Why P1 / Independent Test) up to the next heading.
function storyContext(reqText, n) {
  const lines = stripHtmlComments(reqText || "").split(/\r?\n/);
  const re = new RegExp("^#{1,6}\\s+US-" + n + "(?!\\d)");
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return null;
  const out = [lines[start].replace(/^#{1,6}\s+/, "").trim()];
  for (let i = start + 1; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i++) {
    if (lines[i].trim()) out.push(lines[i].trim());
  }
  return out;
}

// T-ID → its test-plan row. A table row is keyed by the T-ID in its FIRST cell (other cells may cite
// IDs of other tests); a list item is keyed by a T-ID it starts with. Rows remember their table header.
function testIndex(planText) {
  const map = new Map();
  let header = null;
  let sep = null;
  let inTable = false;
  for (const line of planIdText(planText || "").split(/\r?\n/)) {
    if (/^\s*\|/.test(line)) {
      if (!inTable) { inTable = true; header = line.trim(); sep = null; continue; }
      if (!sep && /^\s*\|[\s:|-]+$/.test(line.trim())) { sep = line.trim(); continue; }
      for (const id of extractTestIds(line.split("|")[1] || "")) {
        if (!map.has(id)) map.set(id, { id, row: line.trim(), header, sep });
      }
      continue;
    }
    inTable = false;
    const lead = line.replace(RE_LIST_ITEM, "").replace(/^[\s*`_]+/, "");
    if (RE_LIST_ITEM.test(line)) {
      const m = lead.match(/^T-\d+(?!\d)/);
      if (m && !map.has(m[0])) map.set(m[0], { id: m[0], row: line.trim(), header: null, sep: null });
    }
  }
  return map;
}

// design.md split into its level-2 sections (nested `###` content stays in the body) — the ONE heading reader's (review 5, M2:
// headingEntries — a setext "Title\n---" or an indented "  ## Title" is a section too; its title drops a closing "##", as
// weighSectionHead's does).
function designSections(designText) {
  const lines = stripHtmlComments(designText || "").split(/\r?\n/);
  const heads = headingEntries(lines).filter((h) => h.level === 2);
  return heads.map((h, k) => ({ title: h.text, body: lines.slice(h.body, k + 1 < heads.length ? heads[k + 1].i : lines.length).join("\n").trim() }));
}

const BRIEF_DESIGN_BUDGET = 4000; // chars of design text carried into a brief (keeps it ~≤8 KB)

function taskBrief(projectDir, name, number, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir, root } = f;
  const tasksText = readIfExists(path.join(dir, "tasks.md"));
  const E = errs(projectDir, slug);
  if (tasksText == null) return { ok: false, error: E.tasksMissing(slug) };

  const lng = featureLang(projectDir, slug);
  const t = i18n.brief(lng);
  const tracks = detectTracks(dir);
  const blocks = taskBlocks(tasksText);
  const rel = (p) => path.relative(projectDir, p).split(path.sep).join("/");
  const exDir = path.join(dir, ".execution");

  let block;
  const activeBlocks = taskBlocks(activeTasks(tasksText, tracks) || "");
  if (number == null || number === "") {
    // "The next task" is next_task's (taskSchedule — its _Depends:_ all done): a removed track's block is inactive, never
    // served as next. An explicit number still reaches the whole file (like complete_task).
    const sch = taskSchedule(activeBlocks);
    block = sch.next;
    if (!block && activeBlocks.some((b) => !b.done)) { // 1.14 F3: open tasks, none can start — say why, never "all done"
      return { ok: true, feature: slug, lang: lng, tracks: trackLabel(tracks), task: null, ...(sch.blocked.length ? { blocked: sch.blocked } : { skipped: sch.skipped }),
        note: taskDepsBlockedNote(sch, slug, lng) };
    }
    if (!block) return { ok: true, feature: slug, lang: lng, tracks: trackLabel(tracks), task: null, note: t.allDone };
  } else {
    const n = askedTaskNumber(number);
    if (!Number.isFinite(n)) return { ok: false, error: taskNumberError(lng, number) };
    block = resolveTask(blocks, n); // the task completeTask would tick (first OPEN one of a duplicated number)
    if (!block) return { ok: false, error: E.taskNotFound(n, tasksFileName(dir)) };
  }

  const reqText = criteriaText(dir) || ""; // a change: its change.md without the task blocks (1.21 review C1)
  const planText = readIfExists(path.join(dir, "test-plan.md")) || "";
  const mk = taskMarkers(block);
  // The task's OWN text — fenced code under it is an example (taskProse): its AC/T IDs are never the task's (they gave the
  // brief a foreign AC, flipped the loop to tdd for the example's T-ID and reported it unresolved, while trace_check read
  // the same criterion as uncovered). The rendered brief still shows the whole body.
  const blockText = taskProse(block).join("\n");
  // A bugfix task carries the bug itself: bug.md's Reproduction and Root Cause (null while still unwritten).
  let bug = null;
  const kind = readState(projectDir, slug).kind;
  // The same gate complete_task applies — reported up front, so `done --run` refuses BEFORE running any command.
  const gate = bugfixGate(dir, kind, blocks, block, lng);
  if (kind === "bugfix") {
    const bugText = readIfExists(path.join(dir, "bug.md")) || "";
    const sec = (syn) => (bugSectionFilled(bugText, syn) ? stripHtmlComments(extractSection(bugText, syn)).trim() : null);
    bug = { reproduction: sec(REPRO_SYN), rootCause: sec(ROOT_CAUSE_SYN) };
  }

  // Acceptance criteria and tests referenced by the task, resolved to their spec text.
  const acs = acIndex(reqText);
  const acIds = [...extractAcIds(blockText)];
  const acceptanceCriteria = acIds.filter((id) => acs.has(id)).map((id) => acs.get(id));
  const tests = testIndex(planText);
  const testIds = [...extractTestIds(blockText)];
  const testRows = testIds.filter((id) => tests.has(id)).map((id) => tests.get(id));
  const unresolved = { acs: acIds.filter((id) => !acs.has(id)), tests: testIds.filter((id) => !tests.has(id)) };
  const dec = briefDecisions(dir, acIds, testIds, blockText); // 1.14 C2: decisions.md entries citing the task's IDs (bounded)
  // 1.16 Q3: the glossary entries the task's text and its criteria use (a term or an avoided word; bounded)
  const gloss = briefGlossary(root, [blockText, ...acceptanceCriteria.map((a) => a.text)].join("\n"));

  // Which loop the implementer follows; +ai prompt work stays with the controller (evals cost money,
  // accept/revert is a judgment call).
  // The scaffold also puts _Affects evals:_ on ordinary code tasks, so that alone doesn't make a prompt task.
  const loop = isPromptTask(block, mk, tracks) ? "ai-prompt" : tracks.includes("tdd") && testIds.length ? "tdd" : "core";
  const inlineOnly = loop === "ai-prompt";

  // Story context: the task's own story tag plus the stories its ACs belong to.
  const storyNums = new Set();
  if (block.story && /^US\d+$/i.test(block.story)) storyNums.add(block.story.replace(/\D/g, ""));
  acIds.forEach((id) => storyNums.add(id.match(/^US-(\d+)/)[1]));
  const stories = [...storyNums].map((n) => storyContext(reqText, n)).filter(Boolean);

  // Design sections that mention the task's IDs or files, plus the track sections its markers touch.
  const designText = readIfExists(path.join(dir, "design.md"));
  const sections = designSections(designText || "");
  // The files as the design spells them: `src/payment.js:10` / `#L10` / backticks never appear there (implementsRel, the
  // way briefSteering reads them) — the raw spelling left the design section out.
  const impFiles = mk.implements.map(implementsRel).filter(Boolean);
  // Review 5 (M15) — IDs and files as whole words: a substring test took US-1.AC-1 for US-1.AC-10 and T-1 for T-10, quoted that
  // section and pushed the one about the task's own criterion out of the budget. An AC ID ends before a non-digit (and never
  // follows another feature's `x/`), a T-ID is read by its number (T-01 = T-1, tKey's rule), a file needs a boundary on both
  // sides (its basename may follow a folder). The sections naming one of the task's IDs fill the budget first.
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idNeedles = [...acIds.map((id) => new RegExp("(?<![\\w./-])" + reEsc(id) + "(?!\\d)")),
    ...testIds.map((id) => new RegExp("(?<![\\w-])T-0*" + parseInt(id.slice(2), 10) + "(?!\\d)"))];
  const fileNeedles = [...impFiles, ...impFiles.map((f) => path.posix.basename(f)).filter((b) => b.length >= 5)]
    .map((x) => new RegExp("(?<![\\w-])" + reEsc(x) + "(?![\\w-])"));
  const idHit = (s) => idNeedles.some((r) => r.test(s.title + "\n" + s.body));
  // A task proving a +sec / +privacy criterion reads that track's design sections (threat model, authz, retention…).
  // … and a track pack's (1.15) — its sections are the rigor its criteria were written for.
  const trackMarks = ["sec", "privacy", "dist", "api", "ui", "obs", "data", ...packTracks()].filter((tr) => tracks.includes(tr) && acIds.some((id) => trackAcIds(reqText, tr).has(id))).map((tr) => trackMarker(tr));
  // 1.19 R2 — search before you write: the design's Reuse & Integration entries naming this task's files / folders / ACs, and the
  // existing source files next to its _Implements:_ targets (names only; bounded).
  const reuse = briefReuse(projectDir, designText, mk.implements, acIds);
  const reuseShown = reuse.entries.length > 0 || reuse.total > 0 || reuse.files.length > 0;
  // … and the design section it quotes leaves "Design context" only when the Reuse section quotes ALL of it (R review 2 —
  // reuseQuotedSection): every other section, whatever its heading, keeps the 1.18 selection below.
  const reuseSection = reuseQuotedSection(sections, designText, reuse);
  // A task emitting metrics reads the design's observability: a section named like [SaaS] Observability (any track, as in 1.18) and,
  // on an +obs feature, its [OBS] Telemetry section (T review 6 — a task citing a core AC reached no [OBS] section).
  const obsMarker = tracks.includes("obs") ? trackMarker("obs") : null;
  const obsTelemetry = obsMarker ? ((trackSectionTable("obs") || []).find((x) => x.name === "Telemetry") || { syn: [] }).syn : [];
  const want = (s) => {
    if (s === reuseSection) return false;
    const hay = s.title + "\n" + s.body;
    if (idHit(s) || fileNeedles.some((r) => r.test(hay))) return true;
    const title = s.title.toLowerCase();
    const syn = (list, nm) => list.find((x) => x.name === nm).syn.some((y) => title.includes(y));
    if (mk["emits metrics"].length && syn(SAAS_SECTIONS, "Observability")) return true;
    if (mk["emits metrics"].length && obsTelemetry.length && s.title.includes(obsMarker) && obsTelemetry.some((y) => title.includes(y))) return true;
    if (mk["affects evals"].length && (syn(AI_SECTIONS, "Prompt Architecture") || syn(AI_SECTIONS, "Eval Strategy"))) return true;
    if (trackMarks.some((m) => s.title.includes(m))) return true; // the case-sensitive marker (C4)
    return false;
  };
  let budget = BRIEF_DESIGN_BUDGET;
  const included = [];
  const omitted = [];
  const wanted = sections.filter(want);
  for (const s of [...wanted.filter(idHit), ...wanted.filter((x) => !idHit(x))]) { // the task's own IDs first (M15)
    if (s.body.length <= budget) { included.push(s); budget -= s.body.length; }
    else omitted.push(s);
  }
  const docOrder = (a, b) => sections.indexOf(a) - sections.indexOf(b); // shown as design.md orders them
  included.sort(docOrder);
  omitted.sort(docOrder);
  omitted.forEach((s, i) => { omitted[i] = s.title; });

  // Steering: the default files (as before) + front-matter scoped ones (always / fileMatch on _Implements:_ paths).
  const steer = briefSteering(root, tracks, mk.implements);
  const steering = steer.included.map((s) => rel(path.join(steer.dir, s.name)));

  const paths = {
    dir: exDir,
    brief: path.join(exDir, `task-${block.number}-brief.md`),
    report: path.join(exDir, `task-${block.number}-report.md`),
    ledger: path.join(exDir, "ledger.md"),
  };
  // The runnable _Verify:_ commands that pipe into another one: their exit code is the pipeline's LAST command's.
  const pipes = verifyPipes(block);
  const expectFail = expectsFail(block); // B5: _Expect: fail_ — the brief's Verification section says the run must fail
  const checks = projectChecks(projectDir).checks; // B5: roadmap.json meta.checks — part of the definition of done
  const deps = briefDependencies(activeBlocks, block); // 1.14 F3: its _Depends:_ and where each stands

  const md = i18n.renderBrief({
    feature: slug,
    tracks: trackLabel(tracks),
    task: block,
    dependsOn: deps,
    loop,
    inlineOnly,
    stories,
    bug,
    acceptanceCriteria,
    glossary: gloss.items,
    glossaryOmitted: gloss.omitted,
    tests: testRows,
    evals: mk["affects evals"],
    metrics: mk["emits metrics"],
    implements: mk.implements,
    reuse: reuseShown ? reuse : null,
    unresolved,
    design: { path: rel(path.join(dir, "design.md")), toc: sections.map((s) => s.title), included, omitted },
    steering,
    steeringScoped: steer.included.filter((s) => s.body).map((s) => ({ path: rel(path.join(steer.dir, s.name)), patterns: s.patterns, body: s.body })),
    steeringManual: steer.manual.map((n) => rel(path.join(steer.dir, n))),
    verify: mk.verify,
    verifyPipes: pipes, // a pipe masks the check's exit code — the brief says so
    expectFail,
    projectChecks: checks,
    globalConstraints: globalConstraints(tasksText),
    decisions: dec.items,
    decisionsOmitted: dec.omitted,
    reportPath: rel(paths.report),
  }, lng);

  const write = !!opts.write;
  if (write) {
    ensureDir(exDir);
    writeIfAbsent(path.join(exDir, ".gitignore"), "*\n"); // self-ignoring scratch: no repo config needed
    writeIfAbsent(paths.ledger, t.ledgerHeader(slug));    // the ledger is appended by the controller, never reset
    writeFileAtomic(paths.brief, md);                     // derived artifact: regenerated on every call (1.24 r6: through the write gate)
  }
  const includeBrief = opts.includeBrief != null ? !!opts.includeBrief : !write;

  const res = {
    ok: true,
    feature: slug,
    lang: lng,
    tracks: trackLabel(tracks),
    task: { number: block.number, text: block.text, story: block.story, parallel: block.parallel, done: block.done, phase: block.phase, checkpoint: block.checkpoint },
    loop,
    inlineOnly,
    acceptanceCriteria,
    tests: testRows.map((r) => ({ id: r.id, row: r.row })),
    implements: mk.implements,
    metrics: mk["emits metrics"],
    evals: mk["affects evals"],
    verify: mk.verify,
    unresolved,
    designSections: included.map((s) => s.title),
    // which steering the brief carries and why (inclusion mode; the patterns/paths that matched a fileMatch file)
    steering: {
      included: steer.included.map((s) => Object.assign({ file: rel(path.join(steer.dir, s.name)), inclusion: s.inclusion },
        s.inclusion === "fileMatch" ? { patterns: s.patterns, matched: s.matched, quoted: !!s.body } : {})),
      manual: steer.manual.map((n) => rel(path.join(steer.dir, n))),
    },
    paths,
    wrote: write,
  };
  if (bug) res.bug = bug;
  if (gate) Object.assign(res, { gated: gate.gated, gateError: gate.error });
  if (pipes.length) res.verifyPipes = pipes; // stable: branch on it, never on the brief's text
  if (expectFail) res.expect = "fail"; // B5 (kept with write:true, like verify): the run must exit non-zero
  if (checks.length) res.projectChecks = checks; // B5: [{name, command}] the definition of done names
  if (deps.length) res.dependsOn = deps.map((d) => ({ number: d.number, status: d.status })); // 1.14 F3 (kept with write:true: identifiers only)
  if (dec.items.length) res.decisions = dec.items.map((x) => ({ id: x.id, title: x.title, kind: x.kind, affects: x.affects })); // 1.14 C2
  if (dec.omitted.length) res.decisionsOmitted = dec.omitted;
  if (gloss.items.length) res.glossary = gloss.items.map((g) => ({ term: g.term, definition: g.definition, avoid: g.avoid })); // 1.16 Q3
  if (gloss.omitted.length) res.glossaryOmitted = gloss.omitted;
  if (reuseShown) res.reuse = reuse; // 1.19 R2: {state, total, entries, omitted, files, more}
  if (block.done) res.note = t.alreadyDone(block.number);
  if (includeBrief) res.brief = md;
  else if (write) {
    // write:true is the controller's call (references/subagent-execution.md): the brief lives in the file, so the result
    // keeps what the controller acts on — the paths, the task's identity, its loop (inlineOnly), _Verify:_ command, the
    // IDs it cites (refs) and the unresolved ones, markers, the bugfix gate — never the spec text the brief quotes (AC
    // texts, test rows, design sections, steering, bug.md). includeBrief:true returns everything, brief included.
    res.refs = { acs: acceptanceCriteria.map((a) => a.id), tests: testRows.map((r) => r.id) };
    if (res.decisions) res.refs.decisions = res.decisions.map((x) => x.id); // 1.14 C2: the IDs only (their text is in the brief)
    if (res.glossary) res.refs.glossary = res.glossary.map((g) => g.term); // 1.16 Q3: the terms only (the entries are in the brief)
    // 1.19 R2: the nearby files (identifiers) and how many design entries the brief quotes — never the entries' text
    if (res.reuse) res.refs.reuse = { entries: res.reuse.entries.length, files: res.reuse.files };
    for (const k of ["acceptanceCriteria", "tests", "designSections", "steering", "bug", "decisions", "glossary", "reuse"]) delete res[k];
  }
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
    const reqText = criteriaText(dir); // a change: its criteria, never an existing task's reference (1.21 review C1)
    if (reqText == null) return { ok: false, error: M.err.requirementsMissing(slug) };
    const known = acIndex(reqText);
    const secondary = cited.some((id) => /^(?:EC|NFR|SC)-\d+$/.test(id)) ? secondaryDefinitions(reqText).all : new Set();
    const isKnown = (id) => {
      if (known.has(id)) return true;
      const m = id.match(/^(EC|NFR|SC)-(\d+)$/);
      return !!m && secondary.has(idKey(m[1], m[2]));
    };
    const phantom = cited.filter((id) => !isKnown(id));
    if (phantom.length) return { ok: false, error: A.phantom(phantom.join(", "), isChangeDir(dir) ? CHANGE_FILE : "requirements.md"), phantom };
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

  // Review 5 (P3): written in the file's own encoding — refused, nothing written, when its bytes are no text in it (a code page).
  const bytes = tasksRewrite(file, raw, updated);
  if (!bytes) return { ok: false, error: M.err.tasksNotText(tasksFileName(dir)) };
  writeFileAtomic(file, bytes);
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
  const tf = tasksFileName(dir); // a change's tasks are in change.md (1.21 review C10)
  if (tf !== "tasks.md") res.file = tf;
  if (needsReapproval) res.note = A.reapprove(slug, tf);
  return res;
}

module.exports = { parseTasks, taskDescription, nextTask, parallelBatch, RE_DEP_TOKEN, taskDependsSpec, taskDepGraph,
  stuckTasks, taskSchedule, dependencyCycles, taskWaves, openDependenciesOf, briefDependencies, taskDepsBlockedNote,
  taskDepsWaitList, taskDepsIssues, taskDepsCheck, RE_ROOT_CAUSE_TASK, bugfixGate, rootCauseTaskIndex, blockPosition,
  taskSections, taskNumber, tasksBytes, textEncoding, encodeText, tasksRewrite, checkboxBytes, completeTask, UNDO_REASON_MAX, reasonInput, untickTask, RE_TASK_LINE_HEAD, taskLine, dropTrailingCr, RE_CHECKPOINT,
  COMMENT_MASK, RE_TASK_FENCE_OPEN, RE_PARA_BREAK, scanTaskLines, fenceLine, indentOf, hasOutsideCode, backtickRuns,
  TASK_BLOCKS_MEMO, TASK_BLOCKS_MEMO_MAX, BLOCK_PEERS, SCAN_STAMPS, taskPeerStamps, taskBlocks, scanTaskBlocks, RE_LIST_BOX_LINE, unreadTaskLines, unreadTasksDetail, resolveTask, duplicateTaskNumbers, taskProse,
  RE_RED_PHASE_TASK, redPhaseTask, redPhaseHint, tasksProseText, changeViews, criteriaText, tasksIdText, TASK_MARKER_LABELS, RE_TASK_MARKER_OPEN,
  MARKER_CLOSE_PUNCT, MARKER_SPANS_MEMO, MARKER_SPANS_MEMO_MAX, MARKER_MEMO_LINE_MAX, NO_MARKER_SPANS, taskMarkerSpans, scanMarkerSpans,
  taskMarkerValues, withoutTaskMarkers, WHOLE_VALUE_MARKERS, TASK_MARKERS_MEMO, TASK_MARKERS_MEMO_MAX, taskMarkers, scanTaskMarkers,
  RE_MARKER_WORD, MARKER_WORD_LABEL, MARKER_NOUNS, emptyLabelValues, markerLabel, malformedMarkers, suspiciousVerify, verifySuspicious, RE_GLOBAL_CONSTRAINTS, globalConstraints, isPromptTask,
  RE_DEFINES_AC, acIndex, storyContext, testIndex, designSections, BRIEF_DESIGN_BUDGET, taskBrief, RE_NEW_TASK_TAGS,
  RE_THEMATIC_BREAK, unwrapCodeSpan, newTaskSpec, appendTasks, __link };

"use strict";

/**
 * dev-spec-driven engine — the tasks.md scanner, task markers and dependencies.
 * The ONE task scanner (taskBlocks / parseTasks — comments and fenced code never hold tasks), the English-stable
 * task markers, _Depends:_ and the execution waves (taskSchedule is THE next-task rule), spec_next_task.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, atxHeading, closesFence, detectTracks, errs, existingFeature, expectsFail, featureLang, headRest,
  implementsKey, isBacktickUnit, isPromptTask, RE_FENCE_CLOSE, RE_TEST_REF, readIfExists, stripEnds, stripHtmlComments,
  taskNumber;
function __link(E) { ({ activeTasks, atxHeading, closesFence, detectTracks, errs, existingFeature, expectsFail,
  featureLang, headRest, implementsKey, isBacktickUnit, isPromptTask, RE_FENCE_CLOSE, RE_TEST_REF, readIfExists,
  stripEnds, stripHtmlComments, taskNumber } = E); }

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
//   - next (taskSchedule): the first open task in tasks order (parseTasks: by number, stable) whose _Depends:_ are all done —
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
// done, and the tasks order (parseTasks' — by number, stable).
function taskDepGraph(blocks) {
  const byNum = new Map();
  blocks.forEach((b, i) => { const l = byNum.get(b.number); if (l) l.push(i); else byNum.set(b.number, [i]); });
  const doneNum = new Map();
  for (const [num, l] of byNum) doneNum.set(num, l.every((i) => blocks[i].done));
  const specs = blocks.map(taskDependsSpec);
  const order = blocks.map((_, i) => i).sort((a, b) => blocks[a].number - blocks[b].number || a - b);
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

// Tasks as BLOCKS: the task line plus its sub-lines (markers, sub-steps), the phase heading it sits
// under and the **Checkpoint:** that closes its section. This is the ONE task scanner: parseTasks() (the
// line-only view public through spec_status) projects it, and completeTask ticks the line it resolves.
// Task-looking lines inside HTML comments (single- or multi-line) or fenced code are NOT tasks.
// A task line → [line, lead, box, number, text] | null: /^(\s*-\s*\[)([ xX])\]\s*(\d+)\.(?!\d)\s*(.*)$/ ("1.1 sub-step" is
// not task 1), its text read by headRest (\s*(.*)$ rescanned a long blank run before a line terminator — 1.17 H).
const RE_TASK_LINE_HEAD = /^(\s*-\s*\[)([ xX])\]\s*(\d+)\.(?!\d)/;
const taskLine = (s) => headRest(s, RE_TASK_LINE_HEAD, false);
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
  const lines = String(tasksText || "").split("\n").map((l) => l.replace(/\r$/, ""));
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
  for (let i = 0; i < n; i++) {
    const src = lines[i];
    const inComment = comment; // the line starts inside a multi-line comment (a "<!--" on it is comment text)
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
  return blocks.map((b) => ({ ...b, body: b.body.slice(), bodyCode: b.bodyCode.slice() }));
}
function scanTaskBlocks(tasksText) {
  const blocks = [];
  let phase = null;
  let cur = null;
  let open = []; // tasks of the current section still waiting for their checkpoint
  let prevBlank = false;
  let owner = null; // the task a fenced block belongs to (null = a free-standing block)
  scanTaskLines(tasksText).forEach((ln, i) => {
    const line = ln.vis;
    if (ln.code) {
      // Fenced code is never a task, heading or checkpoint. Right under a task it stays in its body (the brief shows
      // it) — flagged in bodyCode: an example's _Verify:_ / _Implements:_ / IDs are never the task's own (taskProse).
      if (ln.fenceOpen) owner = cur && line.trim() && (/^\s/.test(line) || !prevBlank) ? cur : null;
      if (owner && line.trim()) { owner.body.push(line.trim()); owner.bodyCode.push(owner.body.length - 1); }
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
    } else if (cur && line.trim() && (/^\s/.test(line) || !prevBlank)) {
      cur.body.push(line.trim()); // indented sub-line, or a lazy continuation right under the task
    } else if (line.trim()) {
      cur = null; // un-indented prose after a blank line is not part of the task
    }
    prevBlank = !line.trim();
  });
  return blocks;
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

// `_Label: value_` markers on the task line or its sub-lines — or `*Label: value*`, the same italics (a renderer shows
// both alike). ONE reader, taskMarkerSpans(), for every consumer of the English-stable task markers: taskMarkers (so
// the brief, the evidence gate, the bugfix gate, red-green, overlaps, the guard), trace_check's and implementsRefs'
// _Implements:_, _Size:_ and the templates check. The value ends at the first `_` (`*`) that closes the italics — one
// followed by whitespace, the end of the line, or closing punctuation first: `(_Verify: npm test_)`, `… _Verify: x_.`,
// `_Implements: src/a.ts_;` (1.14 full review Pa1 — those yielded NO marker: a task whose check fails ticked as "nothing
// to verify", and a done task's missing file passed trace_check). An underscore inside the value survives
// (`src/keys_util.js`, `src/__init__.py`). Linear: a line's closers are found once, its openers walk them with a cursor.
const TASK_MARKER_LABELS = ["Requirements", "Makes green", "Affects evals", "Emits metrics", "Implements", "Verify", "Expect", "Size", "Depends"]; // _Depends:_ (1.14 F3)
const RE_TASK_MARKER_OPEN = new RegExp("(?:_|(?<![*\\p{L}\\p{N}_])\\*)(" + TASK_MARKER_LABELS.join("|") + "):[ \\t]*", "giu");
const MARKER_CLOSE_PUNCT = new Set([".", ",", ";", ":", "!", "?", ")", "]"]);
// → [{ key (the label, lower-case), value (untrimmed), start, end }], in line order.
// A closer followed directly by whitespace / the end ("plain") wins over one followed by closing punctuation, when one exists
// before the next marker opener (else the end of the line): `_Verify: python -c "import a_; print(1)"_` keeps its whole
// command, `(_Verify: npm test_), _Implements: a.js_` still closes at "test_)" (full review R7 — Pa1 cut the first at "a_;").
function taskMarkerSpans(line) {
  const s = String(line == null ? "" : line);
  const out = [];
  if (!s.includes(":")) return out;
  const re = new RegExp(RE_TASK_MARKER_OPEN.source, RE_TASK_MARKER_OPEN.flags); // its own lastIndex
  const opens = [];
  let m;
  while ((m = re.exec(s)) !== null) opens.push({ index: m.index, len: m[0].length, key: m[1] });
  if (!opens.length) return out;
  // Per delimiter, the indices of the `_` / `*` that can close a marker, ascending: plain, or before punctuation.
  const ok = new Array(s.length + 1).fill(false); // ok[i]: from i, closing punctuation then whitespace or the end
  ok[s.length] = true;
  for (let i = s.length - 1; i >= 0; i--) ok[i] = /\s/.test(s[i]) || (MARKER_CLOSE_PUNCT.has(s[i]) && ok[i + 1]);
  const plain = { _: [], "*": [] }, punct = { _: [], "*": [] };
  for (let j = 0; j < s.length; j++) {
    if ((s[j] === "_" || s[j] === "*") && ok[j + 1]) (j + 1 === s.length || /\s/.test(s[j + 1]) ? plain : punct)[s[j]].push(j);
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
    let limit = s.length;
    for (let q = k + 1; q < opens.length; q++) if (opens[q].index > v) { limit = opens[q].index; break; }
    const pc = next(plain, "plain", d, v), uc = next(punct, "punct", d, v);
    const close = pc >= 0 && pc < limit ? pc : uc >= 0 && uc < limit ? uc : pc;
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
function taskMarkers(block) {
  const out = { requirements: [], "makes green": [], "affects evals": [], "emits metrics": [], implements: [], verify: [], expect: [], depends: [] };
  const seen = {}; // per key: what out[key] holds — a long `_Depends: 1, 2, …_` list stays linear (no includes() per value)
  for (const line of taskProse(block)) {
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
// "Makes green:" / "Expect:" outside every parsed marker and every code span — `**Verify:** npm test`, `Verify: npm test`,
// `_Verify:_ npm test`. The tools read nothing there (no check to run, no file to trace). → [{ number, labels }] — doctor's
// malformed-markers warn.
// "depends:" only before a task number ("depends: 3", "Depends: #3, 5") — prose like "(depends: the schema from task 1)" is
// prose (feature review R8).
const RE_MARKER_WORD = /(?<![\p{L}\p{N}])(verify|implements|makes[ \t]+green|expect|depends(?=[ \t]*:[ \t*_]*#?\d))[ \t]*:/giu;
const MARKER_WORD_LABEL = { verify: "Verify", implements: "Implements", "makes green": "Makes green", expect: "Expect", depends: "Depends" };
function malformedMarkers(blocks) {
  const out = [];
  for (const b of blocks) {
    const labels = new Set();
    for (const line of taskProse(b)) {
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

module.exports = { parseTasks, taskDescription, nextTask, parallelBatch, RE_DEP_TOKEN, taskDependsSpec, taskDepGraph,
  stuckTasks, taskSchedule, dependencyCycles, taskWaves, openDependenciesOf, briefDependencies, taskDepsBlockedNote,
  taskDepsWaitList, taskDepsIssues, taskDepsCheck, RE_TASK_LINE_HEAD, taskLine, RE_CHECKPOINT, COMMENT_MASK,
  RE_TASK_FENCE_OPEN, RE_PARA_BREAK, scanTaskLines, fenceLine, indentOf, hasOutsideCode, backtickRuns, TASK_BLOCKS_MEMO,
  TASK_BLOCKS_MEMO_MAX, taskBlocks, scanTaskBlocks, resolveTask, duplicateTaskNumbers, taskProse, RE_RED_PHASE_TASK,
  redPhaseTask, redPhaseHint, tasksProseText, TASK_MARKER_LABELS, RE_TASK_MARKER_OPEN, MARKER_CLOSE_PUNCT,
  taskMarkerSpans, taskMarkerValues, withoutTaskMarkers, WHOLE_VALUE_MARKERS, taskMarkers, RE_MARKER_WORD,
  MARKER_WORD_LABEL, malformedMarkers, RE_GLOBAL_CONSTRAINTS, globalConstraints, __link };

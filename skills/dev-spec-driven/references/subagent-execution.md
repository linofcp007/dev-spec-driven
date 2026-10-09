# Subagent-driven execution (Phase 6, opt-in)

Execute a feature's `tasks.md` by dispatching a **fresh implementer subagent per task**, a **task
review** (spec compliance per AC ID + code quality) after each, and a **track-aware final review** at
the end. You — the main session — are the **controller**: you never write feature code yourself; you
brief, dispatch, review-route, rule, and keep the ledger.

Adapted from the `subagent-driven-development` skill of [obra/superpowers](https://github.com/obra/superpowers)
(MIT), rebuilt on this plugin's engine: the brief comes from `spec_task_brief` (ACs and tests resolved
to their spec text), completion goes through `spec_complete_task`, and autonomy stops at the spec's
own gates.

## When to use it — and when not

| Use subagents | Stay inline (the default Phase 6 loop) |
|---|---|
| ~6+ tasks, mostly independent (`_Implements:_` files rarely overlap) | a handful of tasks, or tightly coupled ones |
| long features where your context would fill up | the user wants to watch/steer each step |
| Claude Code (or any host with a subagent tool) | Cursor / Windsurf / Copilot / Gemini / claude.ai — no subagents; use `dev-spec brief` + inline |
| deterministic tasks on any track | **+ai prompt/eval tasks** (`inlineOnly: true` in the brief) — evals cost money and accept/revert is a judgment call |

Cost: roughly 2–3× the tokens of inline execution (one implementer + one reviewer per task). Say so
when you offer it; it is opt-in (`/executeTask <feature> --subagents`, or the user asks for it).

## Preconditions (check before Task 1)

1. `spec_doctor <feature>` → `readyToAdvance: true` and every gate approved (`gatesOk` — the **tasks** phase
   and, on +tdd / +ai, Phase 4 `tests`: the failing tests are written and approved — implementers make planned
   tests green, they don't write the test plan).
2. **Not on the default branch** without the user's explicit consent — create a feature branch (or a
   worktree) first.
3. `trace_check <feature>` passes — phantom AC/T references become `unresolved` in every brief and
   stall implementers.
4. **Baseline green.** Run the full test suite once before Task 1 and ledger the result
   (`Preflight: baseline <command> → <N passing / M failing>`). Failures that exist before you start are
   not yours to fix silently — report them, or you can't tell your regressions from theirs.

## The workspace and the ledger

`spec_task_brief {name, number, write: true}` creates `.specs/<feature>/.execution/` on first use:

```
.specs/<feature>/.execution/
  .gitignore            "*" — the folder ignores itself; no repo config needed
  ledger.md             append-only record of this run (created once, never reset by the engine)
  task-N-brief.md       regenerated per call — the implementer's requirements
  task-N-report.md      written by the implementer (+ appended fix reports)
  task-N-review.diff    written by you: the review package
```

The local hook ignores this folder (no roadmap churn, no lint). **Resume rule:** a `- [x]` in
`tasks.md` means *implemented and reviewed* — only the controller ticks it, only after a clean review.
The ledger holds everything in flight. After a context compaction, trust `tasks.md`, the ledger and
`git log` over your memory; never re-dispatch a task that is ticked or has a `complete` ledger line.

Ledger lines (one per event, appended):

```
Preflight: <table — see below>
Ruling: <what you decided> — <why> — <what it costs if wrong>
Task 3: dispatched (base a1b2c3d, model sonnet)
Task 3: minor (deferred): <one-liner>
Task 3: verify — 2 confirmed, 1 unconfirmed, 1 refuted
Task 3: unconfirmed (65): <one-liner> — <why it isn't 80>
Task 3: refuted (20, pre-existing): <one-liner>
Task 3: fix round 1/5 (2 addressed, 0 open — <one-liners>; commits a1b2c3d..e4f5a6b)
Task 3: parked — <finding> — Ruling: <why the code stands>
Task 3: refactor candidate filed: refactor-pricing-rules (backlog)
Task 3: complete (commits a1b2c3d..e4f5a6b, review clean)
Checkpoint US1: presented → approved
```

## Pre-flight scan (once, before Task 1)

Read `tasks.md` once. Write a table to the ledger with one row per **pair of tasks that share a file**
(`_Implements:_`) or an interface — what one produces vs. what the other consumes — and one row per task
whose own text disagrees with itself (its tests vs. its code, its files vs. later tasks). Check that
every `[P]` claim is true (different files, no dependency) and that every `_Depends: 3, 5_` marker is right: a task
that consumes what another produces must name it (`spec_doctor` fails `task-deps` on a dependency naming no task, a
task depending on itself or a cycle). Rule on each conflict **within the design**
and ledger the ruling. A conflict that can only be resolved by changing an AC, the design or a planned
test is not yours to rule on — see "Where autonomy stops".

## The per-task loop

### 1. Brief

`spec_task_brief {name, number: N, write: true}` → the paths plus the task's identifiers (number and
text, `loop`, `inlineOnly`, its `_Verify:_` command — with `verifyPipes` when one pipes and `expect: "fail"` on an
`_Expect: fail_` task — the project checks `projectChecks`, `refs` — the AC/T IDs it cites — `unresolved` IDs, a
bugfix `gated`), never the spec text the brief quotes: the brief never enters your context. The brief itself also
carries the decisions (`decisions.md`) that cite the task's ACs / T-IDs, and a **Reuse** section — the design's Reuse &
Integration entries for the task's files, folders or ACs, and the existing source files next to its `_Implements:_`
targets (`refs.reuse`: how many entries, the files) — where the implementer's search before writing starts
(`references/code-reuse-and-quality.md`).
If the result says `inlineOnly`, do this task yourself in the inline prompt-iteration loop instead.
Record `BASE = git rev-parse HEAD`.

### 2. Dispatch the implementer

Dispatch the plugin agent **`dev-spec-driven:spec-implementer`** (plugin agents are namespaced by the plugin, like its commands) with an explicit `model` (see Model selection).
The dispatch contains only:
1. one line on where the task fits (feature, story, what earlier tasks produced);
2. the brief path — "read this first; it is your requirements";
3. interfaces/decisions from earlier tasks the brief cannot know, and pointers to ledger rulings or
   parked findings that touch this task's files;
4. your resolution of any ambiguity you noticed;
5. the report path (`paths.report`) — the implementer names it in its reply;
6. the references folder path — this folder, the plugin's `skills/dev-spec-driven/references/`, absolute: the agent's
   guides (`code-reuse-and-quality.md`, `test-patterns.md`) live there, and a subagent can't resolve a bare
   `references/…`.

Never paste prior-task history or the whole spec into a dispatch. Never dispatch two implementers on
the same working tree — they conflict. Concurrency is only for the parallel mode below (one worktree
each). **Batch** several small same-shape `[P]` tasks (the same one-line change across files) into ONE
dispatch and review them as one unit. Record the implementer's agent ID (fix rounds 1–3 resume it).

### 3. Handle the status

**The SubagentStop gate (Claude Code).** When a `spec-implementer` stops claiming DONE (or DONE_WITH_CONCERNS) for a
task whose `_Verify:_` holds a runnable command, the plugin's SubagentStop hook opens the report named in its reply
(`.specs/<feature>/.execution/task-N-report.md`) and sends the stop back unless the report carries **each
`_Verify:_` command, verbatim, and the exit code the task needs** ("exit 0", "exit code: 1", "código de saída 0"…): an
exit 0 for a must-pass `_Verify:_`, a non-zero exit for an `_Expect: fail_` task — read per run: each command's own exit code,
the LAST run of it deciding (a report showing the red run and then the green one passes; another command's exit 0 never
stands in for it). BLOCKED / NEEDS_CONTEXT and tasks without a runnable `_Verify:_` pass. So an implementer's DONE
reaches you only with its evidence written down — still read it: the gate reads the report's text, it never ran the
command (`spec_complete_task` records the run you pass it, and refuses a failed one).
`dev-spec stop-check --agent spec-implementer --message "<its reply>"` shows the gate's decision; `spec_init {stopCheck: false}` turns the Stop and SubagentStop gates off for the project.

- **DONE** → check the report has its **Reuse** block (what was searched, reused, extended or created, and why —
  missing for a task that added code: resume the implementer), then build the review package, dispatch the reviewer.
- **DONE_WITH_CONCERNS** → read the concerns; correctness/scope concerns get resolved before review,
  observations get noted.
- **NEEDS_CONTEXT** → supply it and resume the same implementer. One the implementer raises to **extend a unit outside
  the task's files** (`_Implements:_`) is a plan question: add a converge task for it (`spec_append_tasks` with that file
  in `_Implements:_` — the human approves the changed tasks) and run it first, or tell the implementer to go ahead (with
  `meta.guard: "scope"` the edit then asks the user) or to create locally — never let it edit that file silently.
- **BLOCKED** → context problem: more context, same model. Needs more reasoning: re-dispatch one tier
  up. Too big: split it (ledger a ruling). **The spec is wrong** (a test that can't be right, an AC that
  contradicts the design): stop — this is a phase problem, not an implementation one.

### 4. Review package

Write the diff to a file so it never enters your context:

```
git log --oneline BASE..HEAD  >  .specs/<feature>/.execution/task-N-review.diff
git diff --stat   BASE..HEAD  >> .specs/<feature>/.execution/task-N-review.diff
git diff -U10     BASE..HEAD  >> .specs/<feature>/.execution/task-N-review.diff
```

(Same commands in PowerShell or bash. Use the recorded BASE — never `HEAD~1`, which drops all but the
last commit of a multi-commit task.)

### 5. Dispatch the reviewer

Dispatch **`dev-spec-driven:spec-reviewer`** in **task** mode with: the brief path, the report path, the diff
path, BASE/HEAD, the active tracks and the references folder path. The reviewer returns a verdict **per AC ID** (✅ / ❌ / ⚠️ cannot
verify from the diff), track checks, the project's written rules and the history of rewritten lines, and Critical /
Important / Minor findings, each Critical / Important one rated 0–100. Never tell a reviewer what not to flag. Resolve
every ⚠️ yourself (you hold the cross-task context); a confirmed gap is a failed spec review.

### 6. Verify the findings

A finding is a claim, like an implementer's DONE: check it independently before it may cost a fix round — a false
positive costs a round, and an implementer "fixing" correct code can break it. (Adapted from Anthropic's `code-review`
plugin: each issue rated by a separate agent, only the confident ones kept.)

- **What goes through:** every ❌ and every Critical / Important finding — and, later, each piece of new breakage a
  re-review reports. **What doesn't:** the facts the report or the diff settle by themselves — a `_Verify:_` run
  missing, a non-zero exit, a piped exit code with no unpiped run, a planned test's expectation changed.
- **How:** one **`dev-spec-driven:spec-verifier`** per finding, all dispatched in one message (they are
  independent), on the cheapest tier — standard for a security, concurrency or data-loss finding — with the finding
  verbatim, the package path, BASE/HEAD, the brief path (the feature folder in the final review and the simplification
  pass) and the report path (the implementer's, or the simplifier's). Never the first review's reasoning, never the
  answer you expect.
- **Then, by its confidence:** **80 or more** → confirmed: it enters the fix loop. **50–79** → unconfirmed: no fix
  round — ledger `unconfirmed (NN)`, show it at the next checkpoint; the final review triages it with the deferred
  minors. **Under 50** → refuted: ledger `refuted (NN, <why>)` and drop it.
- **An ❌ comes back CONFIRMED or REFUTED, never unconfirmed** (an AC with no code is never pre-existing): its verdict
  decides, not a confidence. A refuted ❌ cites the file:line that satisfies the AC — read that line before you count the
  AC as satisfied; a refutation without one is a confirmed ❌, and a confirmed ❌ enters the fix loop.
- **An implementer that disputes a finding** in a fix round, with evidence, gets the same verify pass — not your
  hunch.

### 7. Fix loop (max 5 rounds)

Triggers: any confirmed ❌ or Critical / Important finding (§6), or a ⚠️ you confirmed. Minor findings never enter the
loop — ledger them as `minor (deferred)` for the final review.

- **Rounds 1–3:** resume the same implementer with the open findings verbatim.
- **Rounds 4–5:** a fresh implementer one model tier up: "A prior implementer attempted this N times;
  you own it now — read the report file for what was tried."
- Every round: the implementer fixes, re-runs the covering tests, appends a fix report (tests, command,
  output). Then a **scoped** re-review: package `FIX_BASE..HEAD` (FIX_BASE = the head the last review
  saw) and dispatch `dev-spec-driven:spec-reviewer` in **re-review** mode with the findings list. New breakage in the
  fix diff joins the list once its verify pass confirms it; out-of-scope observations become deferred minors.
- Never fix findings yourself — it pollutes your context and skips review.
- **Breaker (after round 5):** adjudicate each open finding. Reviewer wrong/contestable, or real but
  nothing builds on it → `parked` with a ruling. Real and load-bearing → rule on the smallest change
  that unblocks dependent work and carry it into the next dispatch. Every adjudication is a ledger line.

### 8. Complete

Clean review — no confirmed finding open (unconfirmed ones ledgered), or every open one parked with a ruling →
`spec_complete_task {name, number, evidence}`
with the evidence **from the implementer's report** — the task's `_Verify:_` command, its exit code and
the output summary (`references/verification.md`) — + ledger `complete` line. A non-zero exit code is
refused by the engine: that task is not done. Never tick a task with open Critical/Important findings.

**Refactor candidates are filed, never done in the task.** The report's **Reuse** block lists them (a smell, a
duplicate, a tangled file the implementer noticed), and so do the reviewer's out-of-scope refactor ideas: file each
one in the roadmap backlog — `spec_roadmap_edit {kind: "backlog", action: "add", name: "refactor-<topic>", note: "refactor: <smell> in <files>
— <the refactoring> — found in <feature> task N"}` (CLI `dev-spec backlog add refactor-<topic> "refactor: …"`) — and
ledger `Task N: refactor candidate filed: refactor-<topic>`. One name per candidate (the topic, not the area): an `add`
of a name already in the backlog appends its note to that entry (`exists: true`, `appended`) — right for the same
candidate found again, wrong for a different one. A candidate becomes an improvement spec later
(`references/improvement-specs.md`: characterization tests first, the refactor on green); one the task can't be done
without is a preparatory task — a converge pass (below) and the human's approval, not the current diff.

## Parallel mode (optional): `[P]` tasks in separate worktrees

When a story has several independent `[P]` tasks, they can run concurrently — each implementer in its
own git worktree, so they never share a working tree. Adapted from superpowers' *using-git-worktrees* and
*dispatching-parallel-agents*.

1. `spec_next_task {name, batch: true}` (CLI `dev-spec next <feature> --batch`) returns the next task (the first
   open one whose `_Depends:_` tasks are all done) plus the following open `[P]` tasks **of the same section** whose
   `_Implements:_` files are declared and disjoint and whose own `_Depends:_` are done (max 3 by default). No
   `_Implements:_`, a shared file (`src/a.js:12`, `src/a.js#L40`, `./src/a.js` are one file; a folder shares every
   file under it), a task waiting on an open dependency, a non-`[P]` task or a section
   boundary ends the batch — then run sequentially. The pre-flight scan must agree (no shared interface).
2. Record BASE (`git rev-parse HEAD` on the feature branch), write each task's brief, and **create each worktree by
   hand from that BASE**: `git worktree add <path> -b task-N <BASE>`. Never the Agent tool's `isolation: "worktree"` —
   it bases the worktree on the default branch, not on the feature branch's HEAD, so the implementer would start
   without the earlier tasks and the Phase 4 failing tests. Dispatch the implementers **in one message**, each with its
   worktree path and the BASE it was made from, and the brief and report paths written out absolute, in the main
   checkout (`.execution/` ignores itself, so a worktree has no copy — and the SubagentStop gate reads the report
   there). Each implementer checks `git rev-parse HEAD` in its worktree equals that BASE before it starts, and commits
   on its own `task-N` branch.
3. **Merge one at a time** into the feature branch (fast-forward or rebase — never a merge that rewrites
   the others' work). After EACH merge, run the full suite; a conflict or a red suite takes that task out
   of the batch: re-run it sequentially on the updated branch.
4. Review each task's diff as usual (its own review package), complete each with its own evidence.
5. Never run a batch across a `**Checkpoint:**`, and never in parallel with +ai prompt tasks.

Worth it only when the tasks are genuinely independent and big enough to amortise the merges; for small
tasks the sequential loop is faster end to end.

### Dispatch by waves (tasks that declare `_Depends:_`)

When tasks.md states its dependencies (`_Depends: 3, 5_` on a task: the numbers of the tasks that must be done
first), plan the whole run as **waves**: `spec_next_task {name, waves: true}` (CLI `dev-spec next <feature> --waves`)
returns `waves` — `[[1], [2, 3], [4]]` — plus `cycles` and `blocked`. The rules, which the engine applies (never guess
them):

- a task **with** `_Depends:_` waits for exactly those tasks; a task **without** one keeps tasks.md order among the
  tasks that declare none — it waits for the open ones before it, a run of consecutive `[P]` tasks of one section
  waits together, and the task after the run waits for the whole run (the batch's `[P]` rule, unchanged);
- a wave holds tasks whose dependencies are done or in earlier waves, never two tasks sharing an `_Implements:_` file
  (a folder shares its files), and a task without `_Implements:_` (its files can't be proven disjoint) or an +ai
  prompt task (inline only) is a wave of its own;
- `blocked` tasks can never start as things stand (a cycle, a `_Depends:_` naming no task, or waiting on one of
  those) and `cycles` lists the loops: stop — `spec_doctor` fails `task-deps`; fixing tasks.md changes the approved
  plan (re-approve the tasks phase).

Per wave: write each task's brief, dispatch a wave of one sequentially as usual, and a wider wave as in the parallel
mode above (one worktree per implementer, made by hand from the wave's BASE — `git worktree add <path> -b task-N
<BASE>`, never `isolation: "worktree"` —, merge one at a time, full suite after each merge, review each diff,
complete each with its own evidence). Ask for the waves again after each wave — a merge conflict re-run sequentially
or a task that turned out to need another changes them. Only a task's own `_Depends:_` can take it ahead of an
earlier section's checkpoint: still stop at every `**Checkpoint:**` once that section's tasks are done.

## Where autonomy stops

Run continuously within a story — no "should I continue?" prompts between tasks. Stop and ask the
human **only** for:

1. **A `**Checkpoint:**` line** (end of a story). Present: tasks done, commits, per-task review verdicts,
   deferred minors, unconfirmed findings (with their confidence), every `Ruling:` made so far (with its cost if wrong),
   and the next story. Continue on
   approval; ledger `Checkpoint USn: presented → approved`.
2. **A spec change.** Any finding or blocker that requires changing an AC, a design decision, or a
   planned test's expectation. Go back to that phase (requirements, design or test plan) — never
   rule on it, never let an implementer "fix" a test to pass.
3. An irreversible or destructive operation, a security-sensitive action, or a side effect outside the
   working tree that norms say to ask about (merge, push to a shared branch, publish, deploy).
4. A plan so broken that every path forward is a guess.

Everything else — ambiguity inside the design, an implementer question you can answer from the spec,
a conflict between two tasks' file plans — you decide, and ledger the ruling.

## Track specifics

- **+tdd:** the implementer shows RED-for-the-right-reason output before implementing and GREEN after,
  with the full suite (targets green, prior green still green, later tasks' tests still red). The
  reviewer checks that evidence and that no planned test's expectation changed. An `_Expect: fail_` task (it writes
  a test before its code) is DONE when its `_Verify:_` run **fails** for the right reason — the implementer reports
  that failing run (command, non-zero exit, the failure) and you record it as the red run; a passing run is refused
  (`unexpected-pass`), and so is a failing run whose output shows the test never ran — a missing test file, module or
  script, nothing collected (`couldNotRun: "output"`). Its brief is a red task's: the tests it writes must fail first,
  no production code in it.
- **Project checks** (`roadmap.json → meta.checks`, listed in every brief as `projectChecks`): the brief's definition
  of done has the implementer run each one and put its command, exit code and output tail in the report — nothing
  that passed before the task may fail after it (on an `_Expect: fail_` task, only its new red tests may); the reviewer
  checks it. At the end `/spec-finish` needs a passing run of each since the last task activity, on the code as it is
  now — a run older than an edit of the implementing files reads `code-changed` (`spec_finish {evidence}` or
  `dev-spec finish <f> --run`).
- **+saas:** tasks with `_Emits metrics:_` must show the metric emitting in the report. The hot-path
  load test and observability validation stay feature-level "done" checks (run them at the end, as in
  inline Phase 6).
- **+ai:** prompt/eval tasks are `inlineOnly` — you run them in the main session with the eval harness.
  A task counts as prompt work when it touches `prompts/` or is a `_Affects evals:_` task about a
  prompt. Other tasks marked `_Affects evals:_` (the scaffold puts it on ordinary code tasks) and
  deterministic +ai tasks (schema validation, rate limits, fallback, cost circuit breaker) delegate
  normally, and their brief adds "run the eval harness afterwards". Cost and safety validation stay
  feature-level checks.

## Final review

After the last task: package `MERGE_BASE..HEAD` (`git merge-base <default-branch> HEAD`) and dispatch
`dev-spec-driven:spec-reviewer` in **final** mode on the most capable model, with the package path, the feature folder,
the ledger, the active tracks, the references folder path and, on +tdd, the `spec_log {name, gitLog}` output (you run
`git log --name-only --relative` and pass its text — the server never runs git; the reviewer can't call MCP tools) — it
runs the branch-review checklist
(track-aware: spec compliance, red-first evidence, tenant isolation, eval deltas, security, the project's written rules
and the history of rewritten lines) and triages the ledger's deferred minors, unconfirmed and parked findings. If it
returns findings: verify each Critical / Important one (§6), then ONE fix dispatch with the confirmed list, ONE scoped
re-review, then adjudicate residuals as in the breaker. No second wave — residual load-bearing findings go to the human.

## The simplification pass (optional, before finishing)

With every task done and the final review's fixes in, the code the feature added can often be simpler than the
task-by-task loop left it — the smells the reviews deferred as Minor are still there. **The simplification pass** (the
user's `/spec-review <feature> simplify`; with subagents as below) cleans them up without changing behaviour, and proves
it (adapted from Anthropic's `code-simplifier` plugin — with the proof added: its own tests after every change, one
commit each, a review of the pass):

1. Record `SIMPLIFY_BASE = git rev-parse HEAD` and `MERGE_BASE` (as for the final review). No `.execution/` yet (the
   feature ran inline)? Create it with a `.gitignore` holding `*` — the folder ignores itself. Dispatch
   **`dev-spec-driven:spec-simplifier`** with the feature, MERGE_BASE, the list — the ledger's deferred minors and the
   final review's "can ship" minors —, the project checks, the report path
   (`.specs/<feature>/.execution/simplify-report.md`) and the references folder path. It touches only lines `MERGE_BASE..HEAD` added or changed —
   never a test, a contract, a dependency or code the feature didn't write — runs the covering tests after each change,
   commits each one alone, and ends its report with a `## Final runs` section: the project checks (or the full suite)
   and the changed tasks' `_Verify:_` on the final code, one line each. In Claude Code the SubagentStop hook sends back
   a DONE whose `## Final runs` lacks a project check or shows a run that fails. **Guard mode** (`meta.guard` on or
   `scope`): once every task is done no open task covers an edit, so each edit of the pass asks the user — tell them
   before you dispatch, and dispatch the simplifier in the foreground (Claude Code: `run_in_background: false`) so those
   questions reach them; a handful of approvals, never a reason to lower the guard.
2. Package `SIMPLIFY_BASE..HEAD` (as in §4) and dispatch `dev-spec-driven:spec-reviewer` in **simplify** mode with the
   package path, MERGE_BASE, SIMPLIFY_BASE, the report path and the feature folder: is the behaviour unchanged, no test
   and no contract touched, the change inside the feature's lines, and actually simpler? Verify its Critical / Important
   findings (§6). A confirmed one is **reverted**, not repaired: resume the simplifier to `git revert` that commit — and
   the later ones that build on it, newest first — and re-run the suite; a revert that conflicts is aborted
   (`git revert --abort`) and stops the pass (BLOCKED), never a hand-resolved merge. A cleanup that isn't safe as written is dropped, and there is no fix loop.
3. Re-record the `_Verify:_` run of each done task whose `_Implements:_` files the pass changed, from the report
   (`spec_complete_task {name, number, evidence}` — on a ticked task it is a re-check: a failing one makes it
   unverified; not an `_Expect: fail_` task, whose red run stays its proof). With project checks set (`meta.checks`),
   record them on this code too — each under its name: `spec_finish {name, evidence: [{name: <check name>, command,
   exitCode, summary}]}` from the report's final runs, or `dev-spec finish <feature> --run` —: `/spec-finish`'s
   `code-changed` rule sees only the files the tasks implement, so a pass that touched another file would leave an older
   passing run standing. (No project checks: nothing to record — `/spec-finish` asks for the full suite fresh. Never add
   checks to record a run.) Ledger `Simplify: N commits (a1b2c3d..e4f5a6b), M dropped, review clean`.

Skip it for a small feature or a review with no deferred smells. `NO_CHANGES` is a fine result.

## Closing

Then close with **`spec_finish {name, write: true}`** (the user's `/spec-finish`): it lists any blocker (doctor
fails, open tasks, tasks without a passing run, project checks without a passing run since the last tick (on the
current code), pending
approvals, artifacts changed since approval, template placeholders, a bugfix's missing root cause) and non-blocking
warnings, the track-gated checks to run fresh (full suite, load test, observability, cost/safety, security scans,
data subject rights), writes a merge summary built from the spec chain (with the decision log) to
`.execution/merge-summary.md`, and — on a ready feature — records the drift baseline. **Collect every `Ruling:` line from the ledger into your final message**
("Rulings I made", in order, each with its cost if wrong). Ask the human to approve `execution`
(`spec_approve`) and to choose: merge locally or keep the branch (no PRs, no CI). When done, delete
`.specs/<feature>/.execution/` — git history is the record now.

## Converge mode (whole feature, AC by AC)

The converge pass (the user's `/spec-review <feature> converge`) asks a different question from the task loop: not "is
this diff right?" but "does the code, as it stands, deliver every AC?". Use it when implementation drifted from the plan, after a review found follow-up
work, or before finishing when every task is ticked but you doubt the feature is complete. It works on any
feature, inline-executed or not.

1. **Gather.** `spec_status` and `trace_check {name, code: true}` (T-IDs and AC IDs named in the test files,
   planned tests missing from the code).
2. **Dispatch `dev-spec-driven:spec-reviewer` in converge mode** (standard tier; most capable for a large or
   security-sensitive feature) with: the feature folder `.specs/<feature>/`, the active tracks, the
   `trace_check` result (its gaps and `code` block, pasted) and the source roots to inspect. The reviewer is
   read-only and works AC by AC: implemented? (file:line) · tested? (test name / T-ID) → ✅ / ❌ / ⚠️, then
   returns — in its reply — the missing work as **proposed tasks** shaped for `spec_append_tasks`.
3. **Triage the proposals yourself.** A gap fixable within the approved ACs and design is a task. A gap that
   needs a different AC, design decision or test expectation is a **spec change** — back to its phase
   (`spec_impact` after the edit), never a task.
4. **Human approves** the list (edited as needed) → `spec_append_tasks {name, tasks: [{text, requirements,
   implements, verify, makesGreen, expectFail, size, story, parallel}]}`: appended under "Phase: Convergence",
   numbered after the highest task, existing tasks untouched, an unknown AC ID (or a `makesGreen` T-ID test-plan.md
   doesn't plan) refuses the whole call. `needsReapproval` → `trace_check`, then
   re-approve the **tasks** phase.
5. Execute the new tasks with the normal loop (inline or per-task subagents), each with its evidence.

**No subagent tool?** Run the same AC-by-AC checklist inline and write the same per-AC table before proposing
tasks. Either way, never append a task the human hasn't approved.

## Model selection

Pass `model` explicitly on every dispatch. The implementer, the reviewer, the verifier and the simplifier declare
`model: sonnet` in their frontmatter, so an omitted `model` runs them on `sonnet` — right for most implementer and
reviewer work, wrong for the cheap transcription tasks, most verify passes and the final review below. (The critic
declares `model: inherit`: one semantic review per gate, on the session's own model.)

| Role | Tier (Claude Code alias) |
|---|---|
| Implementer, brief contains the complete code/values (transcription + tests), or a one-file mechanical fix | cheapest (`haiku`) |
| Implementer working from prose, multi-file integration | standard (`sonnet`) — the floor for prose tasks |
| Task reviewer | standard (`sonnet`); scale up for subtle concurrency/security diffs |
| Scoped re-review of a small fix | cheap-to-standard |
| Verify pass (one finding) | cheapest (`haiku`); standard for a security, concurrency or data-loss finding |
| Fix rounds 4–5 | one tier above the implementer that got stuck |
| Final review, architecture-level judgment | most capable (`opus`) |
| Simplifier | standard (`sonnet`); its simplify-mode review standard too |

Turn count beats token price: the cheapest models take 2–3× the turns on multi-step work.

## Common rationalizations

| Excuse | Reality |
|---|---|
| "Close enough on spec compliance" | An ❌ on an AC ID is not done. Fix it or hit the cap and adjudicate. |
| "I'll just fix it myself" | Controller fixes skip review and pollute your context. Resume the implementer. |
| "The test is wrong, let the implementer adjust it" | That is a spec change — stop and go back to the test plan. |
| "One more round will converge" | Past the cap the failure is structural. Adjudicate. |
| "The fix was small, skip the re-review" | Unreviewed fixes are how regressions land. |
| "Ledger bookkeeping is overhead" | The ledger is what survives compaction. Without it, controllers re-dispatch finished tasks. |
| "I'll tick the task now and review later" | `tasks.md` `[x]` means reviewed. The roadmap reads it. |
| "The implementer said the tests pass" | Tick with the evidence from its report (command, exit code, output) — no evidence, no claim. |
| "The SubagentStop hook let it through, so it passed" | The gate reads the report's text — each `_Verify:_` command with the exit code the task needs — it never ran anything. Read it; record the run with `spec_complete_task`. |
| "The implementer found a good refactor — let it do it in this task" | File it: `spec_roadmap_edit {kind: "backlog"} add` with a `refactor:` note. A refactor folded into a feature task makes the diff bigger and a regression unattributable. |
| "The new helper is tiny, no need to look for an existing one" | Tiny duplicates are how a codebase ends up with four retry wrappers. No **Reuse** block with the search in the report → send it back. |
| "The reviewer is sure — skip the verifier" | A reviewer's certainty is a claim. One cheap verify per finding costs less than one fix round spent on a false positive. |
| "Unconfirmed means wrong — drop it" | Unconfirmed means not proven. It skips the fix loop, not the ledger: the checkpoint shows it and the final review triages it. |
| "The simplification broke a test — adjust the test" | The tests are the proof that behaviour didn't change. Revert the simplification. |

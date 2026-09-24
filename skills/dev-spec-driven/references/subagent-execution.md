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

1. `spec_doctor <feature>` → `readyToAdvance: true` and the **tasks** phase approved (`gatesOk`). On
   +tdd, Phase 4 (failing tests) is approved too — implementers make planned tests green, they don't
   write the test plan.
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
Task 3: fix round 1/5 (2 addressed, 0 open — <one-liners>; commits a1b2c3d..e4f5a6b)
Task 3: parked — <finding> — Ruling: <why the code stands>
Task 3: complete (commits a1b2c3d..e4f5a6b, review clean)
Checkpoint US1: presented → approved
```

## Pre-flight scan (once, before Task 1)

Read `tasks.md` once. Write a table to the ledger with one row per **pair of tasks that share a file**
(`_Implements:_`) or an interface — what one produces vs. what the other consumes — and one row per task
whose own text disagrees with itself (its tests vs. its code, its files vs. later tasks). Check that
every `[P]` claim is true (different files, no dependency). Rule on each conflict **within the design**
and ledger the ruling. A conflict that can only be resolved by changing an AC, the design or a planned
test is not yours to rule on — see "Where autonomy stops".

## The per-task loop

### 1. Brief

`spec_task_brief {name, number: N, write: true}` → paths only (the brief never enters your context).
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
5. the report path (`paths.report`).

Never paste prior-task history or the whole spec into a dispatch. Never dispatch two implementers on
the same working tree — they conflict. Concurrency is only for the parallel mode below (one worktree
each). **Batch** several small same-shape `[P]` tasks (the same one-line change across files) into ONE
dispatch and review them as one unit. Record the implementer's agent ID (fix rounds 1–3 resume it).

### 3. Handle the status

- **DONE** → build the review package, dispatch the reviewer.
- **DONE_WITH_CONCERNS** → read the concerns; correctness/scope concerns get resolved before review,
  observations get noted.
- **NEEDS_CONTEXT** → supply it and resume the same implementer.
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
path, BASE/HEAD, and the active tracks. The reviewer returns a verdict **per AC ID** (✅ / ❌ / ⚠️ cannot
verify from the diff), track checks, and Critical / Important / Minor findings. Never tell a reviewer
what not to flag. Resolve every ⚠️ yourself (you hold the cross-task context); a confirmed gap is a
failed spec review.

### 6. Fix loop (max 5 rounds)

Triggers: any ❌, any Critical/Important finding, or a ⚠️ you confirmed. Minor findings never enter the
loop — ledger them as `minor (deferred)` for the final review.

- **Rounds 1–3:** resume the same implementer with the open findings verbatim.
- **Rounds 4–5:** a fresh implementer one model tier up: "A prior implementer attempted this N times;
  you own it now — read the report file for what was tried."
- Every round: the implementer fixes, re-runs the covering tests, appends a fix report (tests, command,
  output). Then a **scoped** re-review: package `FIX_BASE..HEAD` (FIX_BASE = the head the last review
  saw) and dispatch `dev-spec-driven:spec-reviewer` in **re-review** mode with the findings list. New breakage in the
  fix diff joins the list; out-of-scope observations become deferred minors.
- Never fix findings yourself — it pollutes your context and skips review.
- **Breaker (after round 5):** adjudicate each open finding. Reviewer wrong/contestable, or real but
  nothing builds on it → `parked` with a ruling. Real and load-bearing → rule on the smallest change
  that unblocks dependent work and carry it into the next dispatch. Every adjudication is a ledger line.

### 7. Complete

Clean review (or every open finding parked with a ruling) → `spec_complete_task {name, number, evidence}`
with the evidence **from the implementer's report** — the task's `_Verify:_` command, its exit code and
the output summary (`references/verification.md`) — + ledger `complete` line. A non-zero exit code is
refused by the engine: that task is not done. Never tick a task with open Critical/Important findings.

## Parallel mode (optional): `[P]` tasks in separate worktrees

When a story has several independent `[P]` tasks, they can run concurrently — each implementer in its
own git worktree, so they never share a working tree. Adapted from superpowers' *using-git-worktrees* and
*dispatching-parallel-agents*.

1. `spec_next_task {name, batch: true}` (CLI `dev-spec next <feature> --batch`) returns the next open task
   plus the following open `[P]` tasks **of the same section** whose `_Implements:_` files are declared
   and disjoint (max 3 by default). No `_Implements:_`, a shared file, a non-`[P]` task or a section
   boundary ends the batch — then run sequentially. The pre-flight scan must agree (no shared interface).
2. Record BASE, write each task's brief, and dispatch the implementers **in one message**, each with
   worktree isolation (Claude Code: the Agent tool's `isolation: "worktree"`). Each commits on its own
   worktree branch.
3. **Merge one at a time** into the feature branch (fast-forward or rebase — never a merge that rewrites
   the others' work). After EACH merge, run the full suite; a conflict or a red suite takes that task out
   of the batch: re-run it sequentially on the updated branch.
4. Review each task's diff as usual (its own review package), complete each with its own evidence.
5. Never run a batch across a `**Checkpoint:**`, and never in parallel with +ai prompt tasks.

Worth it only when the tasks are genuinely independent and big enough to amortise the merges; for small
tasks the sequential loop is faster end to end.

## Where autonomy stops

Run continuously within a story — no "should I continue?" prompts between tasks. Stop and ask the
human **only** for:

1. **A `**Checkpoint:**` line** (end of a story). Present: tasks done, commits, per-task review verdicts,
   deferred minors, every `Ruling:` made so far (with its cost if wrong), and the next story. Continue on
   approval; ledger `Checkpoint USn: presented → approved`.
2. **A spec change.** Any finding or blocker that requires changing an AC, a design decision, or a
   planned test's expectation. Go back to that phase (`/createSpec`, `/design`, `/testPlan`) — never
   rule on it, never let an implementer "fix" a test to pass.
3. An irreversible or destructive operation, a security-sensitive action, or a side effect outside the
   working tree that norms say to ask about (merge, push to a shared branch, publish, deploy).
4. A plan so broken that every path forward is a guess.

Everything else — ambiguity inside the design, an implementer question you can answer from the spec,
a conflict between two tasks' file plans — you decide, and ledger the ruling.

## Track specifics

- **+tdd:** the implementer shows RED-for-the-right-reason output before implementing and GREEN after,
  with the full suite (targets green, prior green still green, later tasks' tests still red). The
  reviewer checks that evidence and that no planned test's expectation changed.
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
`dev-spec-driven:spec-reviewer` in **final** mode on the most capable model — it runs the `/prReview` checklist
(track-aware: spec compliance, red-first evidence, tenant isolation, eval deltas, security) and triages
the ledger's deferred minors and parked findings. If it returns findings: ONE fix dispatch with the whole
list, ONE scoped re-review, then adjudicate residuals as in the breaker. No second wave — residual
load-bearing findings go to the human.

Then close with **`/spec-finish`** (`spec_finish {name, write: true}`): it lists any blocker (doctor
fails, open tasks, tasks without evidence, pending approvals), the track-gated checks to run fresh (full
suite, load test, observability, cost/safety) and writes a merge summary built from the spec chain to
`.execution/merge-summary.md`. **Collect every `Ruling:` line from the ledger into your final message**
("Rulings I made", in order, each with its cost if wrong). Ask the human to approve `execution`
(`spec_approve`) and to choose: merge locally or keep the branch (no PRs, no CI). When done, delete
`.specs/<feature>/.execution/` — git history is the record now.

## Model selection

Always pass `model` explicitly — an omitted model inherits the session's (usually the most expensive).

| Role | Tier (Claude Code alias) |
|---|---|
| Implementer, brief contains the complete code/values (transcription + tests), or a one-file mechanical fix | cheapest (`haiku`) |
| Implementer working from prose, multi-file integration | standard (`sonnet`) — the floor for prose tasks |
| Task reviewer | standard (`sonnet`); scale up for subtle concurrency/security diffs |
| Scoped re-review of a small fix | cheap-to-standard |
| Fix rounds 4–5 | one tier above the implementer that got stuck |
| Final review, architecture-level judgment | most capable (`opus`) |

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

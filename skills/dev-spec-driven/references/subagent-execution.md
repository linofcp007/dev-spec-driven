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

Cost: roughly 2–3× the tokens of inline execution (one implementer + one reviewer per task, and one duplicate-detector
run — seconds, its output kept in a file) — in Claude Code `spec_metrics`' `agents` counts it per role (dispatches, turns,
tokens). Say so when you offer it; it is opt-in (`/executeTask <feature> --subagents`, or the user asks for it).

## Preconditions (check before Task 1)

1. `spec_doctor <feature>` → `readyToAdvance: true` and every gate approved (`gatesOk` — the **tasks** phase
   and, on +tdd / +ai, Phase 4 `tests`: the failing tests are written and approved — implementers make planned
   tests green, they don't write the test plan). A `reviewPanel` in the result: the project's review panel (Review on
   more than one model, below) — ledger its models.
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
  ui/capture.<ext>      written by you: the kept capture script (the same settings every round)
  ui/task-N/*.png       written by you: the visual review's captures (<view>--<state>--ref.png / --build.png /
                        --floor-320.png…; a retaken one's old file kept as .prev.png)
  task-N-ui-review.md   written by you: the visual reviewer's reply
```

The local hook ignores this folder (no roadmap churn, no lint). **Resume rule:** a `- [x]` in
`tasks.md` means *implemented and reviewed* — only the controller ticks it, only after a clean review.
The ledger holds everything in flight. After a context compaction, trust `tasks.md`, the ledger and
`git log` over your memory; never re-dispatch a task that is ticked or has a `complete` ledger line.

Ledger lines (one per event, appended):

```
Preflight: <table — see below>
Ruling: <what you decided> — <why> — <what it costs if wrong>
Task 3: pre-flight — 1 decision (ruled)
Task 3: dispatched (base a1b2c3d, model sonnet)
Task 3: minor (deferred): <one-liner>
Task 3: pre-existing (deferred): <one-liner>
Task 3: verify — 2 confirmed, 1 unconfirmed, 1 refuted
Task 3: unconfirmed (65): <one-liner> — <why it isn't 80>
Task 3: refuted (0, pre-existing, real at HEAD): <one-liner>
Task 3: ui review — 3 pairs: 2 match, 1 differences (1 blocker) → fix round 1/5
Task 3: ui re-review (round 1) — U1 resolved, U2 partial; 0 regressions → fix round 2/5
Task 3: fix round 1/5 (2 addressed, 0 open — <one-liners>; commits a1b2c3d..e4f5a6b)
Task 3: class fix (round 2) — <the defect>, 3 places
Task 3: class outside the task — <place>
Task 3: lesson D-4 (example-copied → src/lib/price.js)
Task 3: parked (real) — <finding> — Ruling: <why it ships>
Task 3: parked (contested) — <finding> — Ruling: <why the reviewer is wrong>
Task 3: refactor candidate filed: refactor-pricing-rules (backlog)
Task 3: complete (commits a1b2c3d..e4f5a6b, review clean)
Final review: ×2 (requested opus, sonnet) — 1 agreed, 3 single, 2 minor
Checkpoint US1: presented → approved
Autonomy: through checkpoint US3 — granted by the user
Checkpoint US2: summarized (autonomy) — not yet seen by the user
Learning: <the rule> → steering/<file> (the user's OK)
Residues filed: residue-<feature> (3)
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
bugfix's or +port's `gated` (+port: `heldBy`, the [PORT] tasks it waits for — never dispatch a gated brief; `portRole` and
`differential` say which port rule its definition of done carries), never the spec text the brief quotes: the brief never enters your context. The brief itself also
carries the decisions (`decisions.md`) that cite the task's ACs / T-IDs, and a **Reuse** section — the design's Reuse &
Integration entries for the task's files, folders or ACs, and the existing source files next to its `_Implements:_`
targets (`refs.reuse`: how many entries, the files) — where the implementer's search before writing starts
(`references/code-reuse-and-quality.md`) —, the rows of `structure.md`'s `## Reference Examples` table for its files (a
gone file named, never quoted — `refs.examples`) and the feature's open lessons (§7b — `refs.lessons`).
If the result says `inlineOnly`, do this task yourself in the inline prompt-iteration loop instead.
Record `BASE = git rev-parse HEAD`.

#### Pre-flight the brief (`preflight: true` — size m / l, or no size)

A brief that leaves a design decision open costs a whole dispatch: the implementer comes back NEEDS_CONTEXT, or worse,
decides alone and doesn't say so. When the result says `preflight: true`, have a fresh reader check the brief first —
the zero-decision rule of google/elephant-goldfish-model's Implementation Readiness review (Apache-2.0):

- Dispatch **`dev-spec-driven:spec-critic`** with `Mode: brief` on the prompt's first line (a line of the prompt, never
  a tool parameter), the brief path (`paths.brief`) and the project root — never your own view of the task. Cheapest
  tier (`haiku`) for a brief that carries the code or values, standard otherwise. A batch is pre-flighted once; a
  wave's briefs all in one message.
- **Ready** → dispatch. **Decisions needed** → settle each one before the dispatch:
  - the spec settles it (an AC, a design section, a decision, a ruling) → the answer goes in the dispatch (item 4
    below), citing where it comes from;
  - a choice within the design that no artifact records → rule on it (a `Ruling:` ledger line, carried in the
    dispatch); one that later tasks build on goes to `decisions.md` (`spec_decide {affects}` naming the AC / T-IDs of
    every task that builds on it — a brief quotes only the decisions that cite its own task's IDs);
  - it changes an AC, the design or a planned test → stop: "Where autonomy stops";
  - a `[Gap]` — a `_Verify:_` that can't run as written: check the claim yourself first (does the path, script or
    test file exist; does the task create it?). Confirmed, it is a plan defect: fix the task with the user's OK (an
    edited `tasks.md` is re-approved) before the dispatch; refuted, ledger it and dispatch.
- Ledger: `Task N: pre-flight — ready` or `Task N: pre-flight — 2 decisions (1 from the design, 1 ruled)`.

`preflight: false` (sizes xs / s, a spike, a +ai prompt task, a done task): no pre-flight — with one or two small
tasks the implementer's own NEEDS_CONTEXT is the cheaper check, and a spike's tasks exist to make the decision.

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
  missing for a task that added code: resume the implementer). With `uiReview: true`, the visual review comes first
  (`references/ui-review.md`: the build captured beside the design's reference, state by state, and a
  `dev-spec-driven:spec-ui-reviewer` that sees only the images); its Blockers, and the Majors a fresh reviewer
  confirms (`ui-review.md` → 4), enter the fix loop (§7).
  Then build the review package, dispatch the reviewer.
- **DONE_WITH_CONCERNS** → read the concerns; correctness/scope concerns get resolved before review,
  observations get noted.
- **NEEDS_CONTEXT** → supply it and resume the same implementer. One the implementer raises to **extend a unit outside
  the task's files** (`_Implements:_`) is a plan question: add a converge task for it (`spec_append_tasks` with that file
  in `_Implements:_` — the human approves the changed tasks) and run it first, or tell the implementer to go ahead (with
  `meta.guard: "scope"` the edit then asks the user) or to create locally — never let it edit that file silently.
  One about a **protected test** (`meta.guard: "tests"`, 1.36 — the guard asked about, or refused, an edit of a test the plan
  approved) is the same plan question, never a workaround: the test changes only when a task that can start now names it
  exactly in `_Implements:_` (a converge task, approved by the human) or the user lifts it (`feature unprotect <f> <file>
  --reason …` — theirs to run; it lasts until `feature protect <f> <file>`); a red test turns green by fixing the code. When
  you plan a task that extends an existing test file, name that file in its `_Implements:_` from the start (a folder or a
  glob never unlocks one).
- **BLOCKED** → context problem: more context, same model. Needs more reasoning: re-dispatch one tier
  up. Too big: split it (ledger a ruling). **The spec is wrong** (a test that can't be right, an AC that
  contradicts the design): stop — this is a phase problem, not an implementation one.

### 4. Review package

Write the diff to a file so it never enters your context:

```
git log --oneline BASE..HEAD  >  .specs/<feature>/.execution/task-N-review.diff
git diff --stat   BASE..HEAD  >> .specs/<feature>/.execution/task-N-review.diff
git diff -U10     BASE..HEAD  >> .specs/<feature>/.execution/task-N-review.diff
node "<clone>/cli/dev-spec.js" dupes <feature> --json  >  .specs/<feature>/.execution/task-N-dupes.json
```

(Same commands in PowerShell or bash. Use the recorded BASE — never `HEAD~1`, which drops all but the
last commit of a multi-commit task.) The last line is the duplicate detector, run from the project root (`<clone>`: the
plugin's folder, as the tools' messages print it): its runs go to the reviewer in that file, never through your context —
the reviewer keeps the ones in the package's files.

### 5. Dispatch the reviewer

Dispatch **`dev-spec-driven:spec-reviewer`** in **task** mode with: the brief path, the report path, the diff
path, the detector's file (`task-N-dupes.json`, §4), BASE/HEAD, the active tracks and the references folder path. The reviewer returns a verdict **per AC ID** (✅ / ❌ / ⚠️ cannot
verify from the diff), track checks, the project's written rules and the history of rewritten lines, and Critical /
Important / Minor findings, each Critical / Important one rated 0–100. Never tell a reviewer what not to flag. Resolve
every ⚠️ yourself (you hold the cross-task context); a confirmed gap is a failed spec review. With a review panel, this ONE
reviewer runs on the first panel model that differs from the implementer's and is at least standard (never `haiku`, below
the task reviewer's floor — Model selection) — a second model's eyes at no extra dispatch. None, or none the host can
dispatch (Claude Code: an alias), → `sonnet`, as without a panel.

### 6. Verify the findings

A finding is a claim, like an implementer's DONE: check it independently before it may cost a fix round — a false
positive costs a round, and an implementer "fixing" correct code can break it. (Adapted from Anthropic's `code-review`
plugin: each issue rated by a separate agent, only the confident ones kept.)

- **What goes through:** every ❌ and every Critical / Important finding — and, later, each piece of new breakage a
  re-review reports. Reviewers on several models: merge their findings first, then one verify per MERGED finding (Review on
  more than one model). **What doesn't:** the facts the report or the diff settle by themselves — a `_Verify:_` run
  missing, a non-zero exit, a piped exit code with no unpiped run, a planned test's expectation changed.
- **How:** one **`dev-spec-driven:spec-verifier`** per finding, all dispatched in one message (they are
  independent), on the cheapest tier — standard for a security, concurrency or data-loss finding — with the finding
  verbatim, the package path, BASE/HEAD, the brief path (the feature folder in the final review and the simplification
  pass) and the report path (the implementer's, or the simplifier's). Never the first review's reasoning, never the
  answer you expect.
- **Then, by its confidence:** **80 or more** → confirmed: it enters the fix loop. **50–79** → unconfirmed: no fix
  round — ledger `unconfirmed (NN)`, show it at the next checkpoint; the final review triages it with the deferred
  minors. **Under 50** → refuted: ledger `refuted (NN, <why>)` and drop it — unless it is refuted as pre-existing or not
  in the diff with its `Exists at HEAD` line yes (a real defect this diff didn't make): ledger
  `refuted (NN, <why>, real at HEAD)`, a residue, filed at Closing. Any other reason — intended, disproved by a run,
  silenced on purpose, no rule says so, nitpick — is no residue, whatever its `Exists at HEAD` line says.
- **An ❌ comes back CONFIRMED or REFUTED, never unconfirmed** (an AC with no code is never pre-existing): its verdict
  decides, not a confidence. A refuted ❌ cites the file:line that satisfies the AC — read that line before you count the
  AC as satisfied; a refutation without one is a confirmed ❌, and a confirmed ❌ enters the fix loop.
- **An implementer that disputes a finding** in a fix round, with evidence, gets the same verify pass — not your
  hunch.

### 7. Fix loop (max 5 rounds)

Triggers: any confirmed ❌ or Critical / Important finding (§6), a ⚠️ you confirmed, or a visual Blocker / confirmed
Major (`references/ui-review.md` → 4). Minor findings never enter the loop — ledger them as `minor (deferred)` for the
final review. Nor does a reviewer's `Pre-existing (deferred)` line (a problem already there at BASE): ledger it
`pre-existing (deferred)` — a residue, filed at Closing.

- **Rounds 1–3:** resume the same implementer with the open findings verbatim — and ask each one's cause (§7b).
- **Rounds 4–5:** a fresh implementer one model tier up: "A prior implementer attempted this N times;
  you own it now — read the report file for what was tried."
- Every round: the implementer fixes, re-runs the covering tests, appends a fix report (tests, command, output). A round
  that answered the visual review is checked by that review — the captures it changed taken again and a fresh
  `spec-ui-reviewer` in verdict mode (`references/ui-review.md` → 5) —, then the code review: the task's first one if none ran yet, else a scoped re-review
  of the round's diff. A round that answered the code review gets a **scoped** re-review: package `FIX_BASE..HEAD`
  (FIX_BASE = the head the last review saw) and dispatch `dev-spec-driven:spec-reviewer` in **re-review** mode with the
  findings list. New breakage in the fix diff joins the list once its verify pass confirms it; out-of-scope observations
  become deferred minors.
- **A defect that comes back at another place is a class.** When the verify pass confirms new breakage whose defect — the
  input or state that breaks — an earlier finding of this task already named, at another place, the next round asks for
  the class: every place in the task's `_Implements:_` files that holds it, listed in the fix report, and one fix for all;
  its re-review gets the list. A place outside those files is not this task's to fix: ledger `Task N: class outside the
  task — <place>` for the final review (one it lets ship is a residue). Ledger `Task N: class fix (round R) — <the defect>, K places`.
- **Gates a fix can undo run again.** A round's diff changes what a reviewed view renders → take the captures it
  changed again and a fresh `spec-ui-reviewer` in verdict mode (`references/ui-review.md` → 5), whichever review the
  round answered.
- Never fix findings yourself — it pollutes your context and skips review.
- **Breaker (after round 5):** adjudicate each open finding — a visual one on a fresh `spec-ui-reviewer`'s verdict,
  never yours (verdict mode; you don't look at the images). Reviewer wrong/contestable → `parked (contested)` with a
  ruling; real but nothing builds on it → `parked (real)` with a ruling (a residue, filed at Closing). Real and
  load-bearing → rule on the smallest change
  that unblocks dependent work and carry it into the next dispatch. Every adjudication is a ledger line.

### 7b. Lessons — why a confirmed finding happened

A confirmed finding (§6's 80+, a confirmed ❌, a visual Blocker or a confirmed Major) gets its cause from the thread that
wrote the code — never your guess. The round 1–3 resume adds: *"Before fixing, for each finding: `Cause: <code> — <what
led you there: the brief line, the file you copied, the check that was slow or would not run>`. `model-error` is a fine
answer; a guess is not — say you don't know."* The five codes (English-stable):

- `guidance-missing` — nothing it was given said what to do;
- `guidance-wrong` — something it was given said to do it;
- `example-copied` — it followed existing code that is the bad pattern;
- `tool-friction` — a tool or a check pushed it there;
- `model-error` — the guidance was there and right.

**Check before recording** the three a file can show: `example-copied` — the file it names holds the same shape (grep
it), else no lesson; `guidance-wrong` — the line it names exists and says that; `tool-friction` — the evidence shows the
slow or failed check. A `guidance-missing` answer when the brief carried the rule: ask once ("brief line N says X —
unclear, or missed?"); still unclear → no lesson. Rounds 4–5 (a fresh implementer) answer for their own diff only; a
final-review finding gets a cause only when its task's implementer can be resumed. Inline — and in `/spec-review
feedback` — you answer your own cause, the same way.

**Record it:** `spec_decide {name, kind: "lesson", cause, target, title, decision: "<the rule>", context: "Task N, round R —
finding (92): …", affects}` (CLI `decide <f> --kind lesson --cause <code> --target <path> …`). `target` is the file a fix
changes — the copied file, the steering file, the script; an `example-copied` / `guidance-wrong` target that is gone is
refused. The same cause, target and rule as an open lesson → no second entry. Ledger `Task N: lesson D-4 (example-copied →
src/lib/price.js)`. Every later brief quotes the feature's open lessons (newest first, bounded): task 3's lesson reaches
task 4. **A rule the user states at a checkpoint gets no lesson:** it is written to steering on their OK at once (Where
autonomy stops), and that amendment is its record.

**The finish batch.** `spec_finish` lists the open lessons (`lessons`, one warning, never a blocker — at any size: inline
work and `/spec-review feedback` record lessons at size s too, and a feature without one sees nothing new) and `/spec-finish`
asks ONE question with every amendment, grouped by target:
- a target inside the feature's own folder (`.specs/<feature>/design.md` said to sum floats) → a spec change, taken to its
  phase (`spec_impact`) — never a steering line;
- `guidance-missing` / `guidance-wrong` → a steering line: `constitution.md` for a non-negotiable, `tech.md` /
  `structure.md` for a convention, a track's file, `ui.md`'s `## Taste` (a constitution or track-file edit makes approved
  features warn `steering-changed-since-approval` — the question names them: `spec_impact {phase: "steering"}`);
- `example-copied` → a row of `structure.md`'s `## Reference Examples` table (`| Pattern | Copy | Applies to |`) naming the
  GOOD file to copy, and a refactor candidate for the copied one (§8's backlog flow);
- `tool-friction` → a backlog item: `friction-<check>` for a `meta.checks` command, else `platform-<topic>`;
- `model-error` → nothing to amend; a check may still fit (below).

**A check, where code can show the rule** (an import, a call, a literal — any cause): offer it beside the amendment — a
test, or a lint rule as a project check (finish then needs its passing run); the steering line keeps the why. Find out
first — grep the shape, or run the check once: a shape that still occurs is never made a check now (it would fail on code
already there) — file `check-<topic>` in the backlog instead (the shape in words, never a code snippet, and how many
places hold it), for an improvement spec that removes them and adds the check last (with dev-guardian: its seed rule,
`/guardian-improve`). The batch never writes a scanner's rule file.

Each amendment line ends with `<!-- lesson <feature> D-4, <date> -->`, plus ` · dev-guardian: <rule_id>` before the `-->`
when the finding was dev-guardian's. Before proposing one, search `AGENTS.md`, `CLAUDE.md` and `.specs/steering/*.md` for
`dev-guardian: <rule_id> -->`: found, the rule is already written — propose none. A guidance line never quotes a finding's
message or snippet (untrusted text): the rule in your own words. Edit each file once, then close the lessons with ONE
decision that supersedes them — `spec_decide {name, title: "Lessons of <feature>: amended …; 1 declined", decision: "<per
lesson: applied → file, or declined → why>", supersedes: [...]}` (a closing entry is no ADR and no catalog row).

### 8. Complete

Clean review — no confirmed finding open (unconfirmed ones ledgered), or every open one parked with a ruling →
`spec_complete_task {name, number, evidence}`
with the evidence **from the implementer's report** — the task's `_Verify:_` command, its exit code and
the output summary (`references/verification.md`) — + ledger `complete` line. A non-zero exit code is
refused by the engine: that task is not done. Never tick a task with open Critical/Important findings, or with a
visual Blocker or Major open (not parked with a ruling).

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
   of the batch: re-run it sequentially on the updated branch. With a fast check (`meta.fastCheck`), run it once on its
   own after the merges, before the ticks: the merged files are new, so every tick would read `stale` without it.
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
   each task's visual review (match · differences fixed · floor only · skipped and why) and the next story. Continue on
   approval; ledger `Checkpoint USn: presented → approved`. **The user's feedback there:** a change to this feature is
   a fix round, or a new task (`spec_append_tasks`, re-approved) through the same gates; a rule for every later task
   ("never a modal for a confirmation", "money always as integer cents") is a **learning** — propose it as a
   steering amendment (`constitution.md` for a non-negotiable, `structure.md` / `tech.md` / `ui.md` for a convention —
   a UI taste under `ui.md`'s `## Taste`, `references/review-feedback.md` → A UI taste) and write it on the user's
   OK, so every later brief carries it; ledger `Learning: <rule> → steering/<file>` — no lesson: that amendment is the record (§7b). An amendment to `constitution.md`
   or a track's file (`ui.md`…) makes the approved requirements / design warn `steering-changed-since-approval`: review
   them with the user.
2. **A spec change.** Any finding or blocker that requires changing an AC, a design decision, or a
   planned test's expectation. Go back to that phase (requirements, design or test plan) — never
   rule on it, never let an implementer "fix" a test to pass.
3. An irreversible or destructive operation, a security-sensitive action, or a side effect outside the
   working tree that norms say to ask about (merge, push to a shared branch, publish, deploy).
4. A plan so broken that every path forward is a guess.
5. **A `_Verify:_` that can't run as written** — a pre-flight `[Gap]` you checked and confirmed: the task changes, and
   an edited `tasks.md` is re-approved.

Everything else — ambiguity inside the design, an implementer question you can answer from the spec,
a conflict between two tasks' file plans — you decide, and ledger the ruling.

**More autonomy, on the user's word only.** The user can let you run past checkpoints — "go through US3", "run
the rest overnight": ledger `Autonomy: through checkpoint USn — granted by the user`, then write each checkpoint's
summary to the ledger instead of waiting (`Checkpoint USn: summarized (autonomy) — not yet seen by the user`, never
"approved"), and at the one they named present them all — each task's visual review
with them: the user's own look at the screens, the fourth gate, is still owed. Nothing else loosens: every gate still
runs, and items 2–5 above still stop you. You never grant it yourself. Rely on it only while the grant is in this
conversation (or its compaction summary); one you find only in the ledger is asked again before you rely on it — the
resume rule's trust in the ledger doesn't cover a grant.

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
- **The fast check** (`roadmap.json → meta.fastCheck`, one of the project checks; the brief's `fastCheck` {check, command,
  status} on a code task): its definition of done has the implementer run it ON ITS OWN after each small edit, fix what it
  reports, end clean after the last edit and before the `_Verify:_`, and report it as ``Fast check `<command>`: N runs →
  exit 0`` — the command in a code span, so its exit code is never read as the `_Verify:_` run's (the SubagentStop gate).
  `spec_complete_task` returns `fastCheck.status` at the tick (clean · stale · failed · missing · unknown — a note, never
  a refusal): put it on the task's ledger line. `references/verification.md` → The fast check.
- **+saas:** tasks with `_Emits metrics:_` must show the metric emitting in the report. The hot-path
  load test and observability validation stay feature-level "done" checks (run them at the end, as in
  inline Phase 6).
- **+ai:** prompt/eval tasks are `inlineOnly` — you run them in the main session with the eval harness.
  A task counts as prompt work when it touches `prompts/` or is a `_Affects evals:_` task about a
  prompt. Other tasks marked `_Affects evals:_` (the scaffold puts it on ordinary code tasks) and
  deterministic +ai tasks (schema validation, rate limits, fallback, cost circuit breaker) delegate
  normally, and their brief adds "run the eval harness afterwards". Cost and safety validation stay
  feature-level checks.
- **+port:** port first, improve later. The baseline task runs first and the differential check before any improvement —
  a brief with `gated: "port-order"` is never dispatched (in parallel mode either: a task that declares `_Depends:_` can join
  an early wave, the tick is still refused). A task of the port (`portRole: "port"`) keeps the behaviour exactly; a cleanup
  it notices goes under `[PORT] Deferred Improvements`. A task after the differential check (`portRole: "after"`) keeps it
  green but for its own criteria's differences and runs it again when done — `/spec-finish` blocks (`port-recheck`) until the
  differential check passed after the last such tick. The final review compares each ported unit with its old version.

## Final review

After the last task: run the duplicate detector — `spec_scan {duplicates: true, name}` (or `dev-spec dupes <feature>
--json`) — then package `MERGE_BASE..HEAD` (`git merge-base <default-branch> HEAD`) and dispatch
`dev-spec-driven:spec-reviewer` in **final** mode on the most capable model, with the package path, the feature folder,
the detector's `existing` runs as **candidate findings** (each `file:from-to` and the places it repeats — a duplicate the
spec asks for, or one a report lists under "Duplicated on purpose", is no finding), on a +ui feature of a project with a
design-system registry the `problems` and `raw` values of `spec_scan {designSystem: true, name}` (candidates too: a
design row that disagrees with the registry, a hard-coded colour or size in the feature's view files — a report's "Raw
values kept on purpose" is none), the ledger, the active tracks, the
references folder path and, on +tdd, the `spec_log {name, gitLog}` output (you run
`git log --name-only --relative` and pass its text — the server never runs git; the reviewer can't call MCP tools) — it
runs the branch-review checklist
(track-aware: spec compliance, red-first evidence, tenant isolation, eval deltas, security, the project's written rules
and the history of rewritten lines) and triages the ledger's deferred minors, unconfirmed and parked findings and the
class places outside a task. If it
returns findings: verify each Critical / Important one (§6), then ONE fix dispatch with the confirmed list, ONE scoped
re-review, then adjudicate residuals as in the breaker. No second wave — residual load-bearing findings go to the human.
Ledger its own lines as a task's are: a `Pre-existing (deferred)` line `Final review: pre-existing (deferred): …`, a verified
50–79 one `Final review: unconfirmed (NN): …`, a refutation real at HEAD with `real at HEAD` (§6) — Closing files them.
**With a review panel** (`reviewPanel`): the same package to one final-mode reviewer on the most capable model and one
on each panel model not already it, in one message; their findings merged before the verify pass (Review on more than one
model); still ONE fix dispatch and ONE scoped re-review. Ledger the `Final review: ×N` line.

## The simplification pass (optional, before finishing)

With every task done and the final review's fixes in, the code the feature added can often be simpler than the
task-by-task loop left it — the smells the reviews deferred as Minor are still there. **The simplification pass** (the
user's `/spec-review <feature> simplify`; with subagents as below) cleans them up without changing behaviour, and proves
it (adapted from Anthropic's `code-simplifier` plugin — with the proof added: its own tests after every change, one
commit each, a review of the pass):

1. Record `SIMPLIFY_BASE = git rev-parse HEAD` and `MERGE_BASE` (as for the final review). No `.execution/` yet (the
   feature ran inline)? Create it with a `.gitignore` holding `*` — the folder ignores itself. Dispatch
   **`dev-spec-driven:spec-simplifier`** with the feature, MERGE_BASE, the list — the ledger's deferred minors, the
   final review's "can ship" minors and the detector's `within` runs (`spec_scan {duplicates: true, name}`: the feature
   repeating its own code) —, the project checks, the report path
   (`.specs/<feature>/.execution/simplify-report.md`) and the references folder path. It touches only lines `MERGE_BASE..HEAD` added or changed —
   never a test, a contract, a dependency or code the feature didn't write — runs the covering tests after each change,
   commits each one alone, and ends its report with a `## Final runs` section: the project checks (or the full suite)
   and the changed tasks' `_Verify:_` on the final code, one line each. In Claude Code the SubagentStop hook sends back
   a DONE whose `## Final runs` lacks a project check or shows a run that fails. **Guard mode** (`meta.guard` on,
   `scope` or `tests`): once every task is done no open task covers an edit, so each edit of the pass asks the user — tell them
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

Skip it for a small feature or a review with no deferred smells. `NO_CHANGES` is a fine result. On a **+port** feature the
pass runs only once the differential check is ticked, takes from `[PORT] Deferred Improvements` only the behaviour-preserving
cleanups, and its `## Final runs` include the differential check's `_Verify:_` (record it again — step 3).

## The pruning pass (optional, before finishing)

A test earns its place when it guards an AC or a past bug and fails when that behaviour breaks (`test-patterns.md` → Test
value and pruning). **The pruning pass** (the user's `/spec-review <feature> prune`) finds the tests of a +tdd feature that
no longer do and removes them only on the user's word — every task done, or on a finished feature (see the churn, step 6).
It never runs mid-task: an implementer who thinks a test worthless reports it as a concern.

1. **Baseline and the map.** The project checks (or the full suite) green on HEAD first. Then `trace_check {name, matrix:
   true, code: true}`: each row's `tests` (their T-IDs, `tests[].files`) say which criteria every test covers. Never a
   candidate: a criterion's last planned test (a T-ID that is some AC, EC, NFR or SC row's only test entry — the test-plan
   approval refuses an AC with none), nor a test of an `outsideCode` row (eval, load). A test of an AC a shipped feature
   retired (a non-empty `supersededBy`, no `supersedePending`) is never pruned: it fails once the superseding feature ships,
   so name it to the user — it needs a `/spec-change` on its own feature.
2. **Review.** Dispatch `dev-spec-driven:spec-reviewer` in **prune** mode (inline without a subagent tool) with the feature
   folder, the `trace_check` result and the references folder path. It proposes the `same-path` / `no-kill` candidates with
   the probes each needs and, once you hand it their results, gives each candidate one verdict — prune (naming what still
   guards EACH criterion the test covers) · keep · strengthen (its AC's only test, green with the behaviour broken).
3. **Probes** — you run them, inline (the reviewer edits nothing). A probe breaks the behaviour in ONE line and runs one test,
   and only on a file git tracks with no change of its own: `git ls-files --error-unmatch -- <file>` exits 0 and
   `git status --porcelain -- <file>` prints nothing. Never `git diff --quiet` alone — an untracked file passes it, and
   `git checkout --` cannot restore it. Copy the file's bytes aside (under `.specs/<feature>/.execution/` — no `.execution/`
   yet, as on a finished feature, whose Closing deleted it? Create it with a `.gitignore` holding `*`) and record its
   `git hash-object`; make the break; run **each test of the pair alone, by name** (a file's exit code cannot say which test
   reddened) and record each exit code; restore from the copy, then check that `git hash-object` gives the recorded hash and
   `git status --porcelain -- <file>` is empty again — a mismatch stops the pass. A `same-path` pruning holds only when
   every break that reddens the pruned test reddens the kept one; a `no-kill` test is one the break leaves green. Under
   **guard mode** each break and each restore asks the user — say so before the first. **No shell** (an MCP client that runs
   no command): no probe, so the pass proposes no pruning.
4. **Report** `.specs/<feature>/.execution/prune-report.md` (git-ignored: a report, never evidence — no probe ran and no
   `.execution/` yet? Create it with a `.gitignore` holding `*` first) — `## Candidates` ·
   `## Verdicts` (one line each) · `## Probes` (`` - probe T-12: src/cart.ts:42 `>`→`>=` · `npm test -- -t "T-12"` → exit 1 ``) ·
   `## Left alone`. Ledger `Prune: N proposed, M probes`.
5. **The user approves each pruning — never you.** Then, for the whole feature in ONE batch: remove each pruned row from
   `test-plan.md`; `spec_impact {name, phase: "test-plan"}` — its `retire` names the tasks whose `_Makes green:_` still cite
   a removed T-ID: drop it there, or point it at the test that replaces it (`reopen: true` records the change request; a
   removed test unticks nothing); a pruning that deletes a whole file also drops that file from every done task's
   `_Implements:_` (left there, trace's missing-file gap fails doctor and blocks the finish); remove each test **whole** — its
   case, or the file —, never an empty body, a skip or a constant assertion. At guard level tests (`meta.guard: "tests"`)
   the record of each protected file the pruning changed or deleted is the user's accept: `feature protect <feature> <file>
   --accept --reason "pruned: <criterion> — <what still guards it>"` (a guard-down, asked with the file and the reason; the
   merge summary prints it) — dev-guardian's test-integrity finding is answered with it. Without guard tests the removed row
   in the approval history is the record (no accept: it would start a protected-tests list of its own): when dev-guardian
   asks why the test went, answer with that feature's test-plan re-approval.
6. **The churn — tell the user before step 5.** The plan's re-approval makes the Phase 4 sign-off stale: re-approve
   `test-plan`, then `tests` (every remaining planned T-ID still in code), then `tasks`; on a finished feature also
   `execution` and a new `/spec-finish` — `spec_drift` names the gone file until then, and each re-approval counts as rework
   in `spec_metrics`. Each completes unforced: every criterion keeps a planned test (step 1), so trace finds no new gap. So
   batch per feature: one pass, every pruning of the feature, one round of approvals. dev-guardian's gate reads the removals as test-integrity findings (medium): below the default `--fail-on high` they never block
   (`finish <feature> --run` names them in one warning); at
   `--fail-on medium` an approved pruning blocks like any medium finding (verification.md → dev-guardian's gate).

## Closing

Then close with **`spec_finish {name, write: true}`** (the user's `/spec-finish`): it lists any blocker (doctor
fails, open tasks, tasks without a passing run, project checks without a passing run since the last tick (on the
current code), pending
approvals, artifacts changed since approval, template placeholders, a bugfix's missing root cause) and non-blocking
warnings, the track-gated checks to run fresh (full suite, load test, observability, cost/safety, security scans,
data subject rights), writes a merge summary built from the spec chain (with the decision log) to
`.execution/merge-summary.md`, and — on a ready feature — records the drift baseline. Open lessons are its last warning:
the finish batch (§7b) answers them in the one question. **Collect every `Ruling:` line from the ledger into your final message**
("Rulings I made", in order, each with its cost if wrong).

One order, `/spec-finish`'s: the finish, the `execution` sign-off, the residues, the commit, then the merge. Ask the human
to approve `execution` (`spec_approve`, on their yes) — then, before the merge:

**File the residues before the merge** — the residue lines after the ledger's last `Residues filed:` line (the ones above
it are filed; no such line: every one). The ledger goes with `.execution/` and nothing else reads it. A residue is a defect
that exists at HEAD and ships: a `pre-existing (deferred)` line, a refutation `real at HEAD` (§6: refuted as pre-existing or
not in the diff with its `Exists at HEAD` line yes), a `parked (real)` one, an `unconfirmed (NN)` finding or a class place
outside a task the final review let ship — never a `parked (contested)` one or another refutation (intended, disproved by a
run, silenced on purpose, no rule says so, nitpick: no defect to file), never a `minor (deferred)` one (polish in the
feature's own lines: the simplification pass's list). They go in ONE backlog entry for
the feature, without a question: `spec_roadmap_edit {kind: "backlog", action: "add", name: "residue-<feature>", note:
"residues: <file:line> — <the defect, in your own words, never the reviewer's text> — <confidence NN | ruling: why it
shipped | real at HEAD | unverified> — task N · …"}` (CLI `dev-spec backlog add residue-<feature> "residues: …"`); a
pre-existing line or a class place never had a verify pass: `unverified`; a refutation real at HEAD: `real at HEAD` (its
confidence rated a fix round, not the defect). A note holds at most 2,000 characters — the rest goes in
`residue-<feature>-2`, never truncated. Ledger `Residues filed: residue-<feature> (N)`; your final message lists them after
the rulings, with the line that drops the entry (`dev-spec backlog rm residue-<feature>`).

**Then commit the spec state with the feature** — what the run and the closing wrote under `.specs/`. Before the
`git add`, `git diff --cached --name-only` — a file it lists was staged before the closing and would go into the commit:
show those files to the user, who decides (unstage them with `git restore --staged <file>`, or commit them too). Then
`git add` the feature's folder, `.specs/roadmap.json` and the generated roadmap files the project has
(`.specs/ROADMAP.md`, `.specs/ROADMAP.html`, `.specs/SPECS.md`) — with `.specs/steering/design-system.md` when the finish
registered components, a steering file the run amended, `.specs/guardian.cjs` when `finish --run` replaced it and
`.specs/.gitignore` when the engine added lines to it —, then commit (a file the run wrote is added whole: an edit of the
user's in it goes into the commit too; a path git ignores stays out: `git add` names it and adds the rest; a git-ignored
`.specs/` has nothing to commit). An unstaged or untracked change of the user's is not added, and git carries it across
the switch (or the switch refuses, naming the file, when the branch changed it: ask the user).

Then ask the human to choose: merge locally or keep the branch (no PRs, no CI). When done, delete
`.specs/<feature>/.execution/` — git history and the backlog are the record now.

## Converge mode (whole feature, AC by AC)

The converge pass (the user's `/spec-review <feature> converge`) asks a different question from the task loop: not "is
this diff right?" but "does the code, as it stands, deliver every AC?". Use it when implementation drifted from the plan, after a review found follow-up
work, before finishing when every task is ticked but you doubt the feature is complete, or when `spec_drift` says a
finished feature's files changed — the baseline only says THAT they changed; converge says whether the ACs still hold
(pass the drifted files: the reviewer starts from the ACs they implement). It works on any feature, inline-executed or not.

1. **Gather.** `spec_status`, `trace_check {name, code: true}` (T-IDs and AC IDs named in the test files,
   planned tests missing from the code), `spec_scan {duplicates: true, name}` (its `existing` runs go to the
   reviewer as candidate findings, verified before they cost a task) and, on a +ui feature of a project with a
   design-system registry, `spec_scan {designSystem: true, name}` (its `problems` and `raw` values: candidates too).
2. **Dispatch `dev-spec-driven:spec-reviewer` in converge mode** (standard tier; most capable for a large or
   security-sensitive feature) with: the feature folder `.specs/<feature>/`, the active tracks, the `trace_check` result
   (its gaps and `code` block, pasted), the source roots to inspect and, after a drift, the drifted files. The reviewer
   is read-only and works AC by AC: implemented? (file:line) · tested? (test name / T-ID) → ✅ / ❌ / ⚠️, then returns —
   in its reply — the missing work as **proposed tasks** shaped for `spec_append_tasks`. **With a review panel**
   (`reviewPanel`): one converge reviewer on that tier and one on each panel model not already it, in one message — an AC
   is ✅ only when every model says ✅, each ❌ still gets its verifier, the proposed tasks merged by AC and files.
3. **Triage the proposals yourself.** A gap fixable within the approved ACs and design is a task. A gap that
   needs a different AC, design decision or test expectation is a **spec change** — back to its phase
   (`spec_impact` after the edit), never a task. **After a drift** (a finished feature), ask what the change meant: an ❌
   it didn't intend is a regression of an AC that shipped — `/spec-bugfix` (root cause, red test), never a task
   appended to the finished feature; one it intended is a spec change (`/spec-change <feature> impact`, or a new
   feature with `_Supersedes:_`); every AC ✅ → the change is harmless: finish again for a fresh baseline.
4. **Human approves** the list (edited as needed) → `spec_append_tasks {name, tasks: [{text, requirements,
   implements, verify, makesGreen, expectFail, size, story, parallel}]}`: appended under "Phase: Convergence",
   numbered after the highest task, existing tasks untouched, an unknown AC ID (or a `makesGreen` T-ID test-plan.md
   doesn't plan) refuses the whole call. `needsReapproval` → `trace_check`, then
   re-approve the **tasks** phase.
5. Execute the new tasks with the normal loop (inline or per-task subagents), each with its evidence.

**No subagent tool?** Run the same AC-by-AC checklist inline and write the same per-AC table before proposing
tasks. Either way, never append a task the human hasn't approved.

## Review on more than one model (`meta.reviewModels`, opt-in)

A fresh reviewer misses less than the context that wrote the code; a reviewer on another model misses different things
again. The project's **review panel** — 2–3 model names in `roadmap.json → meta.reviewModels` (`spec_init {reviewModels:
["opus", "sonnet"]}`, `["diverse"]` = opus + sonnet, `[]` off; CLI `init --review-models opus,sonnet | diverse | off`) —
runs the feature-wide reviews once per model. `spec_doctor` and `spec_next_action` carry `reviewPanel: {models}` while it is
set (none for an xs change or a spike); next_action's finish step then names the branch review first. The engine dispatches
nothing and records nothing: what follows is yours.

- **What it covers.** The final review and `/spec-review <feature> branch` (§ Final review), converge (§ Converge mode) and
  the deep review's gate critics (`references/critic-review.md` §1). The panel ADDS models — it never replaces a review's own
  tier: the final review is the most capable model plus each panel model not already it; the gate critics are the size
  table's, on the session's model, plus one on each panel model not already the session's. Never multiplied: the task review
  (its ONE reviewer runs on the first panel model other than the implementer's, at least standard — §5), the pre-flight,
  the verifier, the cold read, the visual and the simplify-mode review, a fix dispatch, a scoped re-review.
- **Dispatch** one reviewer per model in ONE message, an explicit `model` on each, the same inputs to every one — never one
  reviewer's output to another (each is a fresh goldfish).
- **Merge first.** The same finding = the same file with overlapping lines, or the same AC ID, AND the same defect (the
  input or state that breaks); in doubt, two findings. A merged finding keeps the higher severity and lists each model with
  its confidence. Every finding of every model enters the merged list; minors are the union, deduped.
- **Then verify each MERGED finding once** (§6) in the code reviews — the final / branch review and converge; the gate
  critics' merged findings go to the user (`references/critic-review.md` §3: gates have no verifier). One verifier per
  merged finding, not one per model's copy — the merge is the saving. Agreement only ranks a finding first: two models read
  the same package, so they can share a mistake about pre-existing lines or an AC that asks for the behaviour — it never
  skips the verifier. A ⚠️ from any model is yours to resolve. No vote: any confirmed finding or ❌ means Needs fixes.
- **Ledger** `Final review: ×2 (requested opus, sonnet) — 1 agreed, 3 single, 2 minor` (agreed = raised by two or more
  models). Name the models you REQUESTED: you can't see which one ran. **Resume:** the ledger already has a
  `Final review: ×N` line since the last task (any of its forms, below too) → the panel review ran; don't dispatch it again.
  A task done inline writes no ledger line — if you did one after the review, run it again.
- **When a model can't run.** Claude Code's Agent tool takes an alias only (`opus`, `sonnet`, `haiku`, `fable`) — a full model
  ID or another host's name can't be passed there. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` (no `model` parameter), a mod's
  `agent.spawn` hook that sets the model, an `availableModels` allowlist that substitutes it, or an `opus` alias whose family
  the provider can't tell (set `ANTHROPIC_DEFAULT_OPUS_MODEL`) runs every reviewer on one model: say so in the ledger line
  and the report (`Final review: ×2 (requested opus, sonnet) — the host ran one model`): fresh contexts, no model diversity.
  Without a subagent tool (Cursor, Windsurf, Copilot, Gemini, claude.ai), review inline and say the panel was not run —
  ledger `Final review: ×1 (requested opus, sonnet) — inline, the panel was not run`, so a resumed session doesn't run it
  again.
- **Cost:** one more review dispatch per extra model per review it covers (the final review once a feature; converge and the
  gate critics when you run them) — and the task reviews move to a panel model (§5): with `diverse` and a `sonnet`
  implementer, every task review runs on `opus` (no extra dispatch, the priciest tier). Say so when the user turns it on
  (init's note does).

## Model selection

Pass `model` explicitly on every dispatch. The implementer, the reviewer, the verifier and the simplifier declare
`model: sonnet` in their frontmatter, so an omitted `model` runs them on `sonnet` — right for most implementer and
reviewer work, wrong for the cheap transcription tasks, most verify passes and the final review below. (The critic
declares `model: inherit`: one semantic review per gate, on the session's own model — pass `model` for a pre-flight.)

| Role | Tier (Claude Code alias) |
|---|---|
| Implementer, brief contains the complete code/values (transcription + tests), or a one-file mechanical fix | cheapest (`haiku`) |
| Implementer working from prose, multi-file integration | standard (`sonnet`) — the floor for prose tasks |
| Visual review (`spec-ui-reviewer`) | the session's own model (it declares `model: inherit`); the most capable at size l |
| Pre-flight (the critic, brief mode) | cheapest (`haiku`) for a brief that carries the code or values; standard otherwise |
| Task reviewer | standard (`sonnet`); scale up for subtle concurrency/security diffs; with a review panel, the first panel model other than the implementer's that is at least standard (never `haiku`; none → `sonnet`) |
| Scoped re-review of a small fix | cheap-to-standard |
| Verify pass (one finding) | cheapest (`haiku`); standard for a security, concurrency or data-loss finding |
| Fix rounds 4–5 | one tier above the implementer that got stuck |
| Final review, architecture-level judgment | most capable (`opus`) |
| Simplifier | standard (`sonnet`); its simplify-mode review standard too |
| Review panel (`reviewPanel`) | adds its models to the final review, converge and the gate critics — one reviewer each, beside the row's own model (the gate critics': the session's), never in place of it |

Turn count beats token price: the cheapest models take 2–3× the turns on multi-step work.

## Common rationalizations

| Excuse | Reality |
|---|---|
| "Close enough on spec compliance" | An ❌ on an AC ID is not done. Fix it or hit the cap and adjudicate. |
| "The tests pass, so the screen is right" | Tests check behaviour. Spacing, order and the wrong component pass every test — the visual review is what looks. |
| "No reference, so the review passed" | No reference means only the floor ran. Say so at the checkpoint; never count it as matching the design. |
| "The brief looks complete — skip the pre-flight" | You wrote the spec, so you can't see what it leaves out. One cheap fresh read costs less than a NEEDS_CONTEXT round trip, or an implementer's silent guess. |
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
| "The models disagree — take the majority" | There is no vote. Every model's findings enter the merged list; any confirmed finding or ❌ means Needs fixes. |
| "Two models agree — skip the verifier" | They read the same package and can share a mistake. Agreement ranks a finding first; each merged finding is still verified once. |
| "The second model only repeated the first — drop it" | Its value is what only it sees. Merge the repeats; keep every single-model finding for the verify pass. |
| "The simplification broke a test — adjust the test" | The tests are the proof that behaviour didn't change. Revert the simplification. |

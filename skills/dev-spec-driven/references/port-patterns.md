# +port — port first, improve later

Read when a feature carries behaviour that exists into new code: another language, framework or design, a rewrite of a
module, a reimplementation behind the same interface. The rule is old and simple: **first make the new code do exactly what
the old code did, prove it on a corpus, and only then improve it** — with the same comparison run again after the
improvements. A port that mixes cleanups into the move can no longer tell a porting bug from an intended change; an
AI-assisted rewrite that "improved while porting" is the classic way to ship regressions nobody can attribute.

## What the track scaffolds

- **Criteria** (`#### [PORT] Acceptance Criteria (EARS)`): `US-1.AC-36` — the new implementation produces the old one's outputs
  on the corpus, case by case; `US-1.AC-37` — the same error code or type where the old one rejects an input. Name the corpus
  in the bracket; an intended difference is a criterion of its own (`US-2.AC-1 — WHEN … THE SYSTEM SHALL return 422 where the
  old code returned 500`), never a silent exception.
- **Design** — three `[PORT]` sections: **Behaviour Baseline** · **Differential Check** · **Deferred Improvements** (optional at size s).
- **Tasks** — the **baseline task first** (before Setup; at size s before the story): it runs the OLD implementation on the corpus
  and records its outputs (`_Implements:_` the baseline files, `_Verify:_` the old code against them). The **differential check**
  after US-1's tasks: it runs the NEW implementation against the RECORDED baseline. US-2 and Polish come after it.
- **+tdd**: the test plan's rows for AC-36 / AC-37 are properties over the corpus, made green by the differential check.

## Choosing the corpus

The corpus decides what "the same" means — it must reach the paths that matter.

- **Recorded production inputs** (sanitized: no personal data — `+privacy`), the old test suite's cases, golden files, a
  sample of every input class (empty, the largest, malformed, each error path). Say in Behaviour Baseline how many cases
  and why they cover the behaviour (the old code's coverage on the corpus is a good number to quote).
- **Errors are behaviour**: record the failing cases too — the error code or type, the message when callers read it.
- **Side effects and their order** (writes, events, calls to other systems) are outputs: record them as the cases' output.

## Recorded baseline vs live comparison

Two ways to compare, one rule: **the differential check compares the new output with the RECORDED baseline**, never only
with the old code running beside it — the recording outlives the old code, so the check still runs after the cut-over.

- **Record first** (the baseline task): run the old code over the corpus, store each case's output under the baseline's path
  (`tests/baseline/…`), commit it before any code the baseline covers changes. Its `_Verify:_` re-runs the old code against the
  recording (the baseline is reproducible). Never regenerate it from the new code — that makes the check compare the new code
  with itself.
- **Side by side** (optional, while both exist): a harness that feeds each case to both and diffs them finds differences
  faster; it does not replace the recording.

## Normalizing — and nothing more

A difference that is no behaviour is normalized away, each with a written reason in Differential Check: timestamps and
durations, generated IDs, an order the contract doesn't fix (a set serialized as a list), floating-point noise within a
stated tolerance, a log line's format when nothing parses it. Anything else that differs is a **bug of the port** or an
**intended difference** listed with the criterion that asks for it. A normalization added to make a test pass is a
silenced regression: the reviewer checks each one against its reason.

## Reporting a difference

Print the case's name, the old and the new output (or a diff of them), and the normalizations applied — enough to reproduce
it alone. A differential check that only says "37 cases differ" costs a debugging session per case.

## The fence the engine keeps

`spec_complete_task` (and `done <f> <n> --run`, through the brief) refuses, before anything is recorded:

- every task listed **after the baseline task** while the baseline is not ticked AND verified — a note-only tick, or a
  baseline without a runnable `_Verify:_`, opens nothing;
- every task listed **after the differential check** while it is not ticked and verified.

The refusal is `gated: "port-order"` with `heldBy` (the `[PORT]` tasks it waits for). Nothing before the baseline is held;
`undo` never is. The anchors: the first task under the baseline's template heading (else the first task citing a `[PORT]`
criterion) and the last task under the differential check's heading that cites a `[PORT]` criterion (else the first task
under that heading, else the last citing task) — a hand-written plan works by citing the criteria, and an improvement written
after the check in its section still waits for it. A differential check listed before the baseline holds nothing (port-verify
says so: move it after the port's tasks). Moving a task across an anchor is a plan change: tasks.md is approved again.

`spec_next_task` (its `batch` too), `spec_next_action`, the status line, `spec_complete_task`'s `next`, `spec_status`'s next
and the brief's default task never name a held task (the roadmap's row and `next_task`'s waves still list them): while the
baseline (or the differential check) is ticked but not verified, the next step is its run — `done <f> <n> --run` (a `[PORT]`
task without a runnable `_Verify:_` needs its command written first).

doctor's **`port-verify`** checks the plan: both anchors, each with a runnable `_Verify:_`, and no task listed before the
baseline — a fail at size m / l, where the tasks approval refuses the plan until both hold (once the tasks are approved, a
warn: their next approval requires it), a warn at s / no size. `add-track port` puts the baseline's section before the
plan's first task section while no task of it is ticked (an untouched scaffold included). A task lands before the baseline
when `add-track port` appends the two tasks — a task of the plan is ticked already, or no level-2 heading holds its first
task —, or when a project tasks template has no level-2 heading over its first task (Kiro's tasks right under the title,
`###`-only sections): the scaffold then appends the baseline after the template's tasks. The way out: the baseline's section
first, then those tasks under a **level-2 heading of their own** (`## …` — moved into the baseline's section, they would go
with it: removing +port hides them), and the tasks renumbered in file order. It warns besides about a `_Depends:_` after the
baseline that never reaches it (a wave would start it first), and about a differential check's heading where no task cites a
`[PORT]` criterion: its first task is then taken for the check — a preparation task there would open the fence for the
improvements before the comparison runs; cite the criteria in the check's `_Requirements:_`.

## Improve later — and compare again

Each cleanup or behaviour change noticed during the port goes under **Deferred Improvements**, written down instead of
made. After the differential check passes they become: later tasks (listed after it — the fence holds them until then), the
simplification pass (behaviour-preserving cleanups only), or a follow-up feature.

An improvement task keeps the differential check green but for the differences its own criteria ask for (each added to
Differential Check's list of intended differences with the criterion's ID), and **runs the differential check again when
it is done**. doctor's **`port-recheck`** warns, and `spec_finish` blocks, while the differential check's latest passing
run is older than the latest tick or run of a task listed after it — `done <f> <n> --run` on the differential check clears
it (a forced execution approval waives it, like any blocker). `spec_next_action` names that run before the finish step, so
the project checks run once, after it. **`port-recheck` counts only the tasks listed after the differential check**: a fix
after that run — the review panel's branch review, the final review, the simplify pass, any edit to the port's own tasks —
is never asked for, so run the differential check again on the final code yourself before `/spec-finish` (the finish
step's `+port:` line says so when the check has a runnable `_Verify:_`; one checked by hand, compare again by hand).
doctor's **`port-fence`** warns about a task ticked before the `[PORT]` task it waits for had passed — a task moved across
an anchor, +port turned off and on again, a checkbox ticked by hand. The evidence keeps
an anchor's last 5 runs: past them its first pass is no longer known, and only a task with no record of when it was ticked
is still named.

## Cut-over and removing the old code

Switch the callers over (a flag, a router, a strangler fig's facade), watch the new code in production against the same
outputs, then remove the old code — a Polish task after the differential check. The differential check keeps running
after that: it reads the recording.

## What the engine does not see

The fence orders ticks, not edits: code written before the baseline is recorded (and a baseline recorded from it) is a
review finding — the baseline's git history must be older than the port's changes (`spec_finish`'s checks and the
reviewer ask for it). A baseline file edited later to match the new output is the same: the reviewer compares the
baseline's history with the port's commits.

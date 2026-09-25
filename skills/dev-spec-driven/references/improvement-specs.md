# Improvement specs — the metric is the acceptance criterion

An *improvement spec* is a feature whose goal is not new behaviour but better internals: raise
coverage, split an oversized module, kill duplication, drop a complexity hotspot. These usually
arrive from `dev-guardian`'s `/guardian-improve`, which hands over metric-anchored seeds. This file
defines how to spec them so the loop closes with proof.

## The rule

**An improvement spec's success criterion is a re-measurable metric delta — nothing vaguer.**

"Clean up the checkout module" is not a spec; it can't be verified. "No function over 60 lines in
`checkout`, and branch coverage ≥ 45%" is — the same quality gate that found the problem re-measures
it at the end. If the gate can't verify "done", it isn't an improvement spec; it's a wish.

**The target numbers are per project, not universal.** Don't hardcode 60 / 45 from this doc — those
are illustrations. Pull the real thresholds from the project's `.guardian/budgets.yml` (max file/
function lines, max complexity, coverage floor), which `dev-guardian` sets per detected stack. When
no absolute budget exists, make the target relative to the baseline ("improve by X%", "no worse than
today"). A Rust crate, a React app and a billing service will each have different sane numbers — the
budget file is where that per-project tuning lives.

## Writing the requirements

Turn each target into EARS acceptance criteria, phrased against the metric, and add a hard behaviour
guard so "cleaner" never means "broken". Give them the same stable `US-n.AC-m` IDs as any other spec:
`trace_check`, the tasks' `_Requirements:_` and the approval gates follow only those — a bare `AC-1`
heading is invisible to them (the feature would trace **0** ACs). Keep the baseline/target note as a
sub-line of its criterion:

```markdown
# Feature: Refactor checkout module

## User Stories

### US-1 (P1 — MVP): A checkout module the team can change safely
**As a** maintainer, **I want** `checkout` small and covered, **so that** changes stop breaking it.

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN the refactor starts, THE SYSTEM SHALL first have characterization tests that
   capture the current observable behaviour of `checkout` (+tdd), so later steps can prove nothing changed.
2. **US-1.AC-2** — WHEN the `checkout` module is built, THE SYSTEM SHALL contain no file over 300 lines
   and no function over 60 lines.
   (Baseline: 1 file @ 912 lines, 3 functions > 60. Target: 0 / 0.)
3. **US-1.AC-3** — WHEN the test suite runs, THE SYSTEM SHALL reach a branch coverage of `checkout` ≥ 45%.
   (Baseline: 24%. Target: ≥ 45%.)
4. **US-1.AC-4** — _(when the improvement is speed)_ WHEN load-tested at the expected rate, THE SYSTEM
   SHALL keep the p95 latency of `/api/checkout` ≤ 400ms and the JS bundle ≤ 250KB.
   (Baseline: p95 820ms, bundle 310KB. Targets from `.guardian/perf-budget.yml`.)
5. **US-1.AC-5** — _(when the improvement is systemic security)_ WHEN any query in `orders` is built,
   THE SYSTEM SHALL use parameterized statements (0 raw-string SQL), with 0 injection findings from
   `scan_sast` in the module.
6. **US-1.AC-6** — _(when the improvement is deletion)_ WHEN the dead-code scan runs (`knip` / `vulture`
   / `deadcode` / `cargo-udeps` per stack), THE SYSTEM SHALL report 0 unused exports in `<module>`,
   with every removed symbol proven unreachable (no reflection / dynamic route / public API /
   feature-flag caller — verified by grill) before deletion.
7. **US-1.AC-7** — _(mandatory)_ WHEN the refactor is done, THE SYSTEM SHALL keep its observable
   behaviour unchanged: all existing tests and the characterization tests of US-1.AC-1 stay green.
```

Pick only the criteria that fit the improvement (US-1.AC-1 and US-1.AC-7 always):
- **Speed** (US-1.AC-4): only for a path *measured* over budget — profile first, never speculative.
- **Security** (US-1.AC-5): only for *systemic* hardening. A live critical/high vuln is not an
  improvement spec — it blocks and is fixed via guardian-review/leak/panic. Don't backlog an active
  vulnerability.
- **Deletion** (US-1.AC-6): if reachability is uncertain, deprecate (mark + log + one cycle) instead of
  deleting.

## Track and flow

- **Track:** usually `core`; add **+tdd** whenever behaviour must be pinned before moving code
  (almost always, for refactors). The red-green here is: write characterization tests → refactor →
  tests still green.
- **Grill first:** before touching the code, run `/grill` (or `/guardian-grill` on the current
  module) so you understand the branches you're about to move. Fold that Shared Understanding into the
  requirements — it's free RFC.
- **Exit = re-measure:** the feature is done when `dev-guardian`'s gate re-runs and shows the target
  deltas met. Record the before/after in the spec's completion note so the improvement is auditable.

## The loop this belongs to

```
guardian gate (measure)  →  /guardian-improve (seed specs)  →  /grill (understand)
        ↑                                                              │
        └──────────────  re-run gate (prove the delta)  ←── execute ───┘
```

Keep improvement specs small — one module or one metric per spec. A spec you can't re-measure in one
gate run is too big.

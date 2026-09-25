# Example — a fully worked spec (1.13 shape)

`demo-project/` is a self-contained mini-project showing what a feature looks like with the current
methodology: **prioritized user stories (P1/P2)**, **Success Criteria**, **Constitution Check**,
**story-organized tasks** tagged `[US1]`/`[shared]` with `[P]` parallel markers and **Checkpoints**,
a **quickstart** acceptance scenario, **spec↔code** wiring via `_Implements:_`, the **Phase 4 failing tests**
named by their T-IDs, and **fingerprinted approvals** with their `.history/` snapshots. It also shows a
**multi-feature roadmap with a dependency**.

It is real and verifiable — the primary feature (`api-keys`) passes `doctor` (verdict PASS, no warnings) and
`trace`, from a fresh clone too: each approval records a content fingerprint, so the new file dates a checkout
gives every file are not mistaken for edits after approval. `cli/test-cli.js` re-runs the commands below on a
copy of the demo and compares their output with this page.

## What's inside

```
demo-project/
├── .specs/
│   ├── steering/                       # constitution (the principles the design is checked against) + filled product/tech/structure/testing/scale/cost/observability
│   ├── roadmap.json                    # usage-metering depends on api-keys
│   ├── api-keys/                        # ← the fully-worked feature (core +tdd +saas), approved up to tasks
│   │   ├── classification.md           # tracks + the signals, blast radius and hot-path call behind them
│   │   ├── requirements.md             # US-1 (P1) + US-2 (P2), Independent Test, SC-001/002, EC-1/2, NFR-1, EARS ACs
│   │   ├── design.md                   # mermaid + Constitution Check + Complexity + 5 scale sections
│   │   ├── test-plan.md                # T-01..T-07 mapped to every AC and edge case
│   │   ├── tasks.md                    # by story, [US1]/[shared] tags, [P], Checkpoints, _Implements:_
│   │   ├── quickstart.md               # human-runnable acceptance scenario
│   │   ├── load-test.md                # scenarios + budget for the hot path (+saas)
│   │   ├── checklist.md
│   │   ├── .state.json                 # approvals, each with a content fingerprint
│   │   └── .history/                   # what each approval signed off (the baseline spec_impact diffs)
│   └── usage-metering/                  # a second feature, earlier phase, depends on api-keys
├── src/api-keys/service.js              # stub the tasks _Implement_ (so trace closes the loop)
└── tests/                              # Phase 4: the failing tests, one T-ID per test name (illustrative, no runner)
```

## Verify it yourself

From the plugin root:

```bash
node cli/dev-spec.js doctor   api-keys        --project examples/demo-project
node cli/dev-spec.js trace    api-keys --code --project examples/demo-project
node cli/dev-spec.js roadmap                  --project examples/demo-project
node cli/dev-spec.js clarify  api-keys        --project examples/demo-project
```

### `doctor api-keys` → ready to advance ✓

```
Doctor: api-keys  [core +tdd +saas]  verdict=PASS  readyToAdvance=true
  ✓ steering — core steering present (incl. constitution)
  ✓ ears — criteria=5, errors=0, warnings=0
  ✓ clarifications — none open
  ✓ success-criteria — present
  ✓ priorities — user stories prioritized
  ✓ ac-uniqueness — AC IDs unique
  ✓ placeholders — no template placeholders left in the current phase
  ✓ mermaid — has a diagram
  ✓ constitution-check — present — verify each principle is checked
  ✓ saas-sections — all 5 filled
  ✓ test-plan
  ✓ traceability — all 5 ACs covered by tasks
  ✓ secondary-trace — all 5 EC/NFR/SC IDs covered
  ✓ approval-gates — all present phases approved
```

Every gate up to `tasks` is approved, the steering has no template placeholders left, and every edge case
(EC) and non-functional requirement (NFR) is covered by a task or a test.

### `trace api-keys --code` → every AC covered, every planned test in code ✓

```
Trace: api-keys  verdict=pass  ACs=5  coveredByTasks=5
  tests in code: 7/7 planned T-ID(s) named in 5 test file(s)
```

(`_Implements: src/api-keys/service.js_` resolves — no missing files. `--code` also scans the test files:
each T-ID of `test-plan.md` names a test under `tests/`.)

### `roadmap` → dependency-aware ✓

```
Roadmap — overall 19%  (0/2 complete)
     api-keys                    30%  [core +tdd +saas]  tasks-ready
  ⛔ usage-metering               8%  [core +saas]  requirements  deps: api-keys (unmet: api-keys)
```

`api-keys` has every planning gate approved and 0/8 tasks done; `usage-metering` is an earlier-phase
scaffold (its requirements are still the template). It is **blocked (⛔)** until `api-keys` reaches 100% —
exactly what `spec_depend` records and `spec_roadmap` computes (cycle-checked). The same data is in the
generated `.specs/ROADMAP.md`.

### `clarify api-keys` → one question left for the author

```
Clarify: api-keys  [core +tdd +saas]  → needs-clarification (1 question(s))
  1. Specify rate limits (per-user / per-tenant / global).
```

`clarify` is a prompt for the human, not a gate: the design rate-limits key creation per tenant, and the
requirements never say the limit.

## The tasks layout (why it reads well for everyone)

Tasks are grouped by **user story** so a product/basic reader maps them straight to the value slices
in `requirements.md`, while a technical reader keeps build-order *within* each story plus explicit
`[P]` parallel markers. Every task is tagged with its owner — `[US1]`, `[US2]`, or `[shared]` for
cross-cutting work — so membership is unmistakable even for foundational/setup/polish tasks. See
`api-keys/tasks.md`. (If a feature's stories aren't independently shippable, that's a mis-slice
signal; fall back to a technical-layer layout keeping the `[US1]` tags — see the skill's Phase 5.)

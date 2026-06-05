# Example — a fully worked spec (v1.5 shape)

`demo-project/` is a self-contained mini-project showing what a feature looks like with the current
methodology: **prioritized user stories (P1/P2)**, **Success Criteria**, **Constitution Check**,
**story-organized tasks** tagged `[US1]`/`[shared]` with `[P]` parallel markers and **Checkpoints**,
a **quickstart** acceptance scenario, and **spec↔code** wiring via `_Implements:_`. It also shows a
**multi-feature roadmap with a dependency**.

It is real and verifiable — the primary feature (`api-keys`) passes `doctor` and `trace`.

## What's inside

```
demo-project/
├── .specs/
│   ├── steering/constitution.md        # filled principles the design is checked against
│   ├── roadmap.json                    # usage-metering depends on api-keys
│   ├── api-keys/                        # ← the fully-worked feature (core +tdd +saas)
│   │   ├── requirements.md             # US-1 (P1) + US-2 (P2), Independent Test, SC-001/002, EARS ACs
│   │   ├── design.md                   # mermaid + Constitution Check + Complexity + 5 scale sections
│   │   ├── test-plan.md                # T-01..T-05 mapped to every AC
│   │   ├── tasks.md                    # by story, [US1]/[shared] tags, [P], Checkpoints, _Implements:_
│   │   ├── quickstart.md               # human-runnable acceptance scenario
│   │   └── checklist.md
│   └── usage-metering/                  # a second feature, earlier phase, depends on api-keys
└── src/api-keys/service.js              # stub the tasks _Implement_ (so trace closes the loop)
```

## Verify it yourself

From the plugin root:

```bash
node bin/dev-spec.js doctor   api-keys --project examples/demo-project
node bin/dev-spec.js trace    api-keys --project examples/demo-project
node bin/dev-spec.js roadmap            --project examples/demo-project
node bin/dev-spec.js clarify  api-keys --project examples/demo-project
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
  ✓ mermaid — has a diagram
  ✓ constitution-check — present — verify each principle is checked
  ✓ saas-sections — all 5 filled
  ✓ test-plan
  ✓ traceability — uncoveredByTasks=0, phantomAcs=0, uncoveredByTests=0
  ✓ approval-gates — all present phases approved
```

### `trace api-keys` → every AC covered, code linked ✓

```
Trace: api-keys  verdict=pass  ACs=5  coveredByTasks=5
```

(`_Implements: src/api-keys/service.js_` resolves — no missing files.)

### `roadmap` → dependency-aware ✓

```
Roadmap — overall 70%  (0/2 complete)
     api-keys          70%  [core +tdd +saas]  tasks-ready
  ⛔ usage-metering    70%  [core +saas]  tasks-ready  deps: api-keys (unmet: api-keys)
```

`usage-metering` is **blocked (⛔)** until `api-keys` reaches 100% — exactly what `spec_depend`
records and `spec_roadmap` computes (cycle-checked).

## The tasks layout (why it reads well for everyone)

Tasks are grouped by **user story** so a product/basic reader maps them straight to the value slices
in `requirements.md`, while a technical reader keeps build-order *within* each story plus explicit
`[P]` parallel markers. Every task is tagged with its owner — `[US1]`, `[US2]`, or `[shared]` for
cross-cutting work — so membership is unmistakable even for foundational/setup/polish tasks. See
`api-keys/tasks.md`. (If a feature's stories aren't independently shippable, that's a mis-slice
signal; fall back to a technical-layer layout keeping the `[US1]` tags — see the skill's Phase 5.)

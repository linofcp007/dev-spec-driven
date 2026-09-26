# Other starting points — design-first flow and spikes

Read on demand from `SKILL.md`. The default Spec-mode order starts from the need: classification →
requirements → design → plans → tests → tasks. Two work shapes start elsewhere, and the engine gives each its
own order instead of making you fake the missing artifact.

## Design-first — the architecture comes first

Use it when the design is the input, not the output: a migration or re-platforming whose shape is already
decided, a plan imported from Claude Code plan mode / Cursor / a Codex ExecPlan that is mostly architecture, or
an architecture spike that ended in `go`. Writing EARS criteria first would mean inventing them.

- **Create:** `spec_create {name, tracks, lang, flow: "design-first"}` (CLI `dev-spec create "<name>" --flow
  design-first`). **Switch an existing feature:** `spec_feature {action: "flow", name, flow: "design-first" |
  "requirements-first"}` (CLI `dev-spec feature flow <name> <design-first|requirements-first>`). The flow is
  stored in `.state.json → flow`; phases already approved stay approved (the result names them) and the pending
  gates follow the new order at once. A bugfix or a spike is refused — each keeps its own fixed order.
- **Order:** classification → **design** → **requirements** → test plan / eval plan → tests → tasks. Every gate
  still applies, in that order: `spec_next_action` asks for the design right after the classification (its result
  carries `flow: "design-first"`), `spec_approve` refuses the requirements while the design is unapproved
  (`phase-order`), and the roadmap percent and `spec_upgrade` read the same order.
- **What the gates read:** the design gate never reads `requirements.md`, and `spec_doctor` defers the AC
  traceability and the requirements' own checks while `requirements.md` is still a later phase's template. Once
  you write the requirements, they are checked like any other — and they must match the approved design: a
  criterion that needs a different design sends you back to the design (edit, `/spec-impact`, re-approve).
- **Tasks and tests** still trace to AC IDs: write the requirements before the test plan and the tasks, as usual.

Design-first is not "skip the requirements". It changes which artifact is the source for the other; both are
approved before any code.

## Spikes — a question, not a feature

A spike is a timeboxed investigation that ends in a **decision** — which queue, can this API do X, is this
library fast enough — not in production code and not in made-up acceptance criteria.

- **Create:** `spec_create {name, kind: "spike", question, timebox, lang}` (CLI `dev-spec spike "<name>"
  --question "…" --timebox 3d`, or `create --kind spike`; `/spec-spike`). `timebox` is an end date
  (`YYYY-MM-DD`) or a duration (`3d`). It scaffolds `spike.md` — Question · Timebox · Options considered · Evidence
  · Decision (with an `_Outcome: go | no-go | pivot_` line) · Follow-up — and a short `tasks.md` of investigation
  steps. A spike is core-only and has **no requirements / design / tasks gates**.
- **Doctor:** `question` and `decision` (**fail** until the Question and the Decision sections are written) and `timebox`
  (warns once the end date passed without a decision — then decide with the evidence you have).
- **Next action:** fill the question → investigate (the next task; tick it with `dev-spec done <spike> <n>`, a note
  is enough — there is no evidence gate on a spike) → decide → act on the outcome:
  - `go` → `step: "promote"` with a `seed` {name, summary} built from the question and the decision: spec the real
    feature with `spec_create` and archive the spike (`/feature archive <spike>`) — the recommendation says which
    first (archive first when the real feature takes the spike's name);
  - `no-go` → `step: "archive"` — the reason stays in the Decision;
  - `pivot` → `step: "pivot"` — a new spike for the new direction, then archive this one.
- **Prototype code stays outside `.specs/`** (a scratch folder or a branch); link it, the measurements and the
  sources under Evidence. The real feature rewrites what it keeps as its own tasks.
- **Log the decision** with `spec_decide` (`/spec-decide`, usually `D-1`), so it shows up in the catalog and the
  export. `spec_finish` is ready once the decision is written and every task ticked; its merge summary carries the
  question, the decision and the evidence. Spikes show apart in the roadmap (🔬), the catalog and the export; the
  release notes never list one.

A spike whose answer is "we know what to build" often feeds a design-first feature: the options and the evidence
are the design's raw material.

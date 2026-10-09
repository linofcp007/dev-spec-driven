---
description: Plan a feature spec-first, or resume one — classify, then requirements, design and tasks, each approved by the user.
argument-hint: "[feature | idea] [requirements|design|test-plan|eval-plan|tests|tasks]"
---

Use the **dev-spec-driven** skill. Request: $ARGUMENTS

**Route the request.**
- **An existing feature** (`.specs/<feature>/`) → `spec_next_action {name}`: report its tracks, phase, doctor verdict and
  `changedSinceApproval`, then do the ONE step it names — never skip a step to reach a later one. With a phase named,
  do that phase once the phases before it are approved.
- **A new idea** → Phase 0: the mode (Vibe / Bounded / Spec — a real defect goes to the bugfix flow, `/spec-bugfix`; a
  question to investigate is a spike), then `spec_classify` for the tracks and its `suggestedSize` (xs = one `change.md`
  · s = one story, its plan approved in one call · m / l = the full chain). Present the mode, tracks and size and get the
  user's OK. Then `spec_init {tracks, lang}` if `.specs/steering/` is missing, and `spec_create {name, tracks, summary,
  size, lang}` once — `brownfield: true` in existing code, `flow: "design-first"` when the architecture is the input,
  `branch: "true"` for its own git branch (run the `branch.command` it returns). Size m / l: record the decisions in the
  `classification.md` it seeds and get it approved; size s / xs: no `classification.md` — record mode, tracks and size in
  the Summary of `requirements.md` (s) or `change.md` (xs). A spec or plan from Kiro, spec-kit, OpenSpec, plan mode or
  BMAD: `spec_import` instead of re-typing it.

**The phases** (each one: fill the artifact, `spec_doctor`, then the user's approval):
- **requirements** — EARS criteria with stable IDs (`US-1.AC-1`, `EC-1`, `NFR-1`, `SC-001`), every placeholder
  replaced; `ears_validate`, then `spec_clarify` for the gaps.
- **design** — the active tracks' sections, Alternatives & Trade-offs, Risks, Reuse & Integration, the Constitution Check.
- **test-plan** (+tdd) — at least one test row per AC (T-IDs, layer, kind); **eval-plan** (+ai) — golden, adversarial and
  regression sets, thresholds, a baseline.
- **tests** (+tdd / +ai) — every planned test written and red for the right reason, its T-ID in its name;
  `trace_check {name, code: true}`. No implementation code before this gate.
- **tasks** — ordered, each with `_Requirements:_`, `_Implements:_` and `_Verify: <command>_` always (on +tdd the command
  that runs its target tests); `trace_check {name}`.

**Approvals are the user's.** Present the artifact and the verdict, and record an approval with `spec_approve {name,
phase}` only after their explicit yes (`/approve` is their own command). A refused gate names its failing checks: fix
them — `force` only when the user explicitly accepts the failures. Implementation follows in Phase 6 of the skill (the
user's `/executeTask`).

Detail: `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/workflows.md` (sizes, supporting flows) and
`classification-matrix.md` beside it. Respond in the user's language (EN / PT / ES).

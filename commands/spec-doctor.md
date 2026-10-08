---
description: Health-check a feature — is it ready to advance a phase? Runs EARS + placeholders + traceability + mandatory-section + evidence + approval checks. PT - diagnóstico (pronto para avançar?). ES - diagnóstico (¿listo para avanzar?).
argument-hint: "[feature name] [--deep]"
---

Use the **dev-spec-driven** skill health-check.

Feature: $ARGUMENTS

Run the `spec_doctor` MCP tool for this feature (CLI `dev-spec doctor <feature>`, exit 1 on FAIL) and report the
result clearly: each check (pass/warn/fail), the recorded phase approvals, and the `readyToAdvance` verdict.

- **Fails** (block advancing): `ears` errors (or requirements.md cites AC IDs but no criterion was linted — write each AC
  as a list item, heading or line that starts with its ID, or a table row under an Acceptance Criteria heading — or it
  has criteria but no `US-n.AC-m` ID trace_check reads: number each one `US-1.AC-1`, `US-1.AC-2` …; a bare `AC-1` is
  not one),
  `clarifications` still open (a bugfix: in `bug.md` too), `ac-uniqueness`, `placeholders` (template
  text left in the current phase's artifact or an earlier one — including a `[bracketed placeholder]` left inside
  a track section, which the design approval refuses; only a bracket whose text the templates write — the built-in
  ones or the project's own `.specs/templates/` — or TODO / TBD / FIXME / `…`, is a placeholder — real values such as
  `[owner, admin]` or `[free: 60, pro: 600]` are content), `traceability` gaps (a phantom AC that a recorded change
  request removed is named with that request — delete or update what cites it — never "typos?"), unfilled
  `saas-sections` / `ai-sections` / `sec-sections` / `privacy-sections` / `dist-sections` / `api-sections` /
  `ui-sections` / `obs-sections` / `data-sections` and a project track pack's `<pack>-sections` (missing, or the
  `> **TODO**` sentinel still there / empty body), `task-deps` (a `_Depends:_` value that is no task number, a task
  depending on itself, a cycle), `change-scope` (a change past 1–3 criteria, 1–3 tasks or core only — make it a feature),
  `merge-conflicts` (conflicts git's merge driver left in `.state.json` / `roadmap.json` — resolve them), `state` (the
  feature's `.state.json` can't be read — not valid JSON, e.g. a text merge's conflict markers, or the wrong shape: repair
  it by hand or restore it from git; its approvals, ticks and evidence are unknown until then), missing
  `requirements`/`design`, a bugfix's `root-cause`, a spike's `question` / `decision`.
- **Warnings**: `steering` (missing core files, or steering files still holding template placeholders — named),
  `success-criteria`, `priorities`, `mermaid`, `constitution-check`, `placeholders` of a later phase,
  `traceability` "not traced yet" (the gaps that come only from a later phase's still-template `tasks.md` /
  `test-plan.md` — its template rows are no typos at the requirements or design gate; they fail once it is written),
  `secondary-trace` (EC / NFR / SC IDs no task or test covers), `supersedes` (`_Supersedes:_` references that resolve
  to nothing — the catalog shows the AC they meant to replace as current), `tests-in-code` (T-IDs made green by done tasks that
  no test file names), `verification` (ticked tasks without a passing run — the reason per task: no evidence,
  note on a runnable `_Verify:_`, failed run, stale evidence, duplicate number, unexpected pass on an
  `_Expect: fail_` task, a run of another command than its `_Verify:_` — `command-mismatch` —, a run the harness never
  saw under `meta.evidence: "observed"`), `red-green` (+tdd: T-IDs made green with no recorded red run — a test that never failed
  proves nothing; only `_Makes green:_` IDs count, so a bugfix's guard test T-02 appears here only on a bugfix
  scaffolded before 1.14, whose task 4 still lists it — remove T-02 from that `_Makes green:_`), `suite-evidence`
  (project checks without a passing run since the last task activity, or run before the implementing files changed —
  `/spec-finish` blocks on it), `verify-pipes` (a `_Verify:_` that pipes: its exit code is the last command's),
  `malformed-markers` (text on a task line shaped like a marker that yields none — `**Verify:** npm test`, a bare
  `Verify:` — so no check runs and no file is traced: write `_Verify: <command>_`), `verify-suspicious` (a `_Verify:_`
  value that looks garbled — it starts with `_` or `*`, holds a code span inside it, or has a quote with no partner —
  which `done --run` would run as written), `outside-code-artifacts` (+tdd: a
  test planned outside test code — `load-test.md`, an eval set — whose artifact is still the scaffold),
  `duplicate-tasks`, `unread-tasks` (checkbox lines the task scanner does not read as tasks — an ordered-list
  `1. [ ] text`, an unnumbered `- [ ] text` outside every task, one in an indented code block: never ticked, briefed or verified; a task line is
  `- [ ] N. text` with a `-`, `*` or `+` bullet), `integration-plan` (still the template), `changed-since-approval` (re-review → `/spec-impact`, then re-approve), `decision-affects` / `decision-affects-approved` (a decision's
  `_Affects:_` naming nothing, or recorded after the approval of what it affects → `/spec-impact`),
  `cross-feature-overlap` (another active feature's open tasks plan the same files → `/depend` or re-plan),
  `cross-feature-acs` (this feature's acceptance criteria read like another ACTIVE feature's — a near-duplicate — or may
  contradict them — the same trigger with SHALL vs SHALL NOT, or different numbers; each pair names the other feature's
  AC: merge or reword them, or declare `_Supersedes: <feature>/US-n.AC-m_` on the newer one; template criteria and
  declared replacements never count), `steering-changed-since-approval` (a steering file that governed the requirements /
  design approval — constitution, the tracks' files, `always` / matching `fileMatch` ones — changed or was removed since:
  re-review — `/spec-impact` with phase `steering` lists every feature concerned — then re-approve; approvals made before
  1.16 are never flagged), `glossary` (words `.specs/steering/glossary.md` says to avoid, used in `requirements.md` /
  `design.md` — with the count; `/clarify` asks about each; no glossary → no check),
  `design-tradeoffs` / `design-risks` / `design-reuse` (design.md has no Alternatives & Trade-offs with ≥ 2 options per
  key decision, no Risks, or no Reuse & Integration — never a fail), `waiver-expired` (a forced approval whose waiver's
  expiry passed while it still stands forced), `track-pack-missing` (a saved track names a pack that is gone or invalid),
  `approval-gates` (pending phases — a bugfix's `design` on `bug.md`, Phase 4 `tests` on +tdd/+ai once its plan exists
  or was approved, again once its sign-off no longer covers the plan — a T-ID planned since, a plan re-approved with
  other content —, a phase still
  missing a role's sign-off — the gate the next approval would fail, forced approvals), a bugfix's `reproduction`, a
  spike's `timebox`.

List exactly what to fix before advancing, then the warnings worth acting on. `nextGate` says whether the next
pending approval would pass (`/approve` refuses while its checks fail; `missingRoles` names the roles still to sign).

**`--deep`** also reviews the MEANING of the artifact the next gate approves: dispatch the
`dev-spec-driven:spec-critic` agent (completeness, contradictions, ambiguity, testability, scope, YAGNI,
track coverage — including the `[SEC]` / `[PRIVACY]` / `[DIST]` / `[API]` / `[UI]` / `[OBS]` / `[DATA]` sections; bug.md: repro + evidence-backed root cause) and
present its verdict next to the doctor's. Without a subagent tool, run the same checklist yourself. Respond in the
user's language.

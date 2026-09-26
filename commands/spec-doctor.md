---
description: Health-check a feature — is it ready to advance a phase? Runs EARS + placeholders + traceability + mandatory-section + evidence + approval checks. PT - diagnóstico (pronto para avançar?). ES - diagnóstico (¿listo para avanzar?).
argument-hint: "[feature name] [--deep]"
---

Use the **dev-spec-driven** skill health-check.

Feature: $ARGUMENTS

Run the `spec_doctor` MCP tool for this feature (CLI `dev-spec doctor <feature>`, exit 1 on FAIL) and report the
result clearly: each check (pass/warn/fail), the recorded phase approvals, and the `readyToAdvance` verdict.

- **Fails** (block advancing): `ears` errors, `clarifications` still open, `ac-uniqueness`, `placeholders` (template
  text left in the current phase's artifact or an earlier one — including a `[bracketed placeholder]` left inside
  a track section, which the design approval refuses; only a bracket whose text the templates write — the built-in
  ones or the project's own `.specs/templates/` — or TODO / TBD / FIXME / `…`, is a placeholder — real values such as
  `[owner, admin]` or `[free: 60, pro: 600]` are content), `traceability` gaps (a phantom AC that a recorded change
  request removed is named with that request — delete or update what cites it — never "typos?"), unfilled
  `saas-sections` / `ai-sections` / `sec-sections` / `privacy-sections` (missing, or the `> **TODO**` sentinel still
  there / empty body), missing `requirements`/`design`, a bugfix's `root-cause`, a spike's `question` / `decision`.
- **Warnings**: `steering` (missing core files, or steering files still holding template placeholders — named),
  `success-criteria`, `priorities`, `mermaid`, `constitution-check`, `placeholders` of a later phase,
  `traceability` "not traced yet" (the gaps that come only from a later phase's still-template `tasks.md` /
  `test-plan.md` — its template rows are no typos at the requirements or design gate; they fail once it is written),
  `secondary-trace` (EC / NFR / SC IDs no task or test covers), `supersedes` (`_Supersedes:_` references that resolve
  to nothing — the catalog shows the AC they meant to replace as current), `tests-in-code` (T-IDs made green by done tasks that
  no test file names), `verification` (ticked tasks without a passing run — the reason per task: no evidence,
  note on a runnable `_Verify:_`, failed run, stale evidence, duplicate number, unexpected pass on an
  `_Expect: fail_` task), `red-green` (+tdd: T-IDs made green with no recorded red run — a test that never failed
  proves nothing; a bugfix's guard test T-02 is expected here), `suite-evidence` (project checks without a passing run
  since the last task activity — `/spec-finish` blocks on it), `verify-pipes` (a `_Verify:_` that pipes: its exit code
  is the last command's), `duplicate-tasks`, `integration-plan` (still the template), `changed-since-approval`
  (re-review → `/spec-impact`, then re-approve), `decision-affects` / `decision-affects-approved` (a decision's
  `_Affects:_` naming nothing, or recorded after the approval of what it affects → `/spec-impact`),
  `cross-feature-overlap` (another active feature's open tasks plan the same files → `/depend` or re-plan),
  `approval-gates` (pending phases — a bugfix's `design` on `bug.md`, Phase 4 `tests` on +tdd/+ai, a phase still
  missing a role's sign-off — the gate the next approval would fail, forced approvals), a bugfix's `reproduction`, a
  spike's `timebox`.

List exactly what to fix before advancing, then the warnings worth acting on. `nextGate` says whether the next
pending approval would pass (`/approve` refuses while its checks fail; `missingRoles` names the roles still to sign).

**`--deep`** also reviews the MEANING of the artifact the next gate approves: dispatch the
`dev-spec-driven:spec-critic` agent (completeness, contradictions, ambiguity, testability, scope, YAGNI,
track coverage — including the `[SEC]` / `[PRIVACY]` sections; bug.md: repro + evidence-backed root cause) and
present its verdict next to the doctor's. Without a subagent tool, run the same checklist yourself. Respond in the
user's language.

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
  a `[SaaS]`/`[AI]` section, which the design approval refuses; a written-out list such as `[owner, admin]` is
  content, not a placeholder), `traceability` gaps (a phantom AC that a recorded change request removed is named
  with that request — delete or update what cites it — never "typos?"), unfilled `saas-sections` /
  `ai-sections` (missing, or the `> **TODO**` sentinel still there / empty body), missing `requirements`/`design`,
  a bugfix's `root-cause`.
- **Warnings**: `steering` (missing core files, or steering files still holding template placeholders — named),
  `success-criteria`, `priorities`, `mermaid`, `constitution-check`, `placeholders` of a later phase,
  `traceability` "not traced yet" (the gaps that come only from a later phase's still-template `tasks.md` /
  `test-plan.md` — its template rows are no typos at the requirements or design gate; they fail once it is written),
  `secondary-trace` (EC / NFR / SC IDs no task or test covers), `supersedes` (`_Supersedes:_` references that resolve
  to nothing — the catalog shows the AC they meant to replace as current), `tests-in-code` (T-IDs made green by done tasks that
  no test file names), `verification` (ticked tasks without a passing run — the reason per task: no evidence,
  note on a runnable `_Verify:_`, failed run, stale evidence, duplicate number), `duplicate-tasks`,
  `integration-plan` (still the template), `changed-since-approval` (re-review → `/spec-impact`, then re-approve),
  `approval-gates` (pending phases — a bugfix's `design` on `bug.md`, Phase 4 `tests` on +tdd/+ai — the gate the
  next approval would fail, forced approvals), a bugfix's `reproduction`.

List exactly what to fix before advancing, then the warnings worth acting on. `nextGate` says whether the next
pending approval would pass (`/approve` refuses while its checks fail).

**`--deep`** also reviews the MEANING of the artifact the next gate approves: dispatch the
`dev-spec-driven:spec-critic` agent (completeness, contradictions, ambiguity, testability, scope, YAGNI,
track coverage; bug.md: repro + evidence-backed root cause) and present its verdict next to the
doctor's. Without a subagent tool, run the same checklist yourself. Respond in the user's language.

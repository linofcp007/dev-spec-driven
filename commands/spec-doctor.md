---
description: Health-check a feature — is it ready to advance a phase? Runs EARS + traceability + mandatory-section + steering checks. PT - diagnóstico (pronto para avançar?). ES - diagnóstico (¿listo para avanzar?).
argument-hint: "[feature name] [--deep]"
---

Use the **dev-spec-driven** skill health-check.

Feature: $ARGUMENTS

Run the `spec_doctor` MCP tool for this feature and report the result clearly: each check
(pass/warn/fail), the recorded phase approvals, and the `readyToAdvance` verdict. If anything is
`fail` (e.g. EARS errors, traceability gaps, unfilled mandatory +saas/+ai sections still carrying
the `TODO` sentinel, a bugfix without a root cause), list exactly what to fix before advancing; call out
the warnings too (e.g. ticked tasks without verification evidence, pending approvals).

**`--deep`** also reviews the MEANING of the artifact the next gate approves: dispatch the
`dev-spec-driven:spec-critic` agent (completeness, contradictions, ambiguity, testability, scope, YAGNI,
track coverage; bug.md: repro + evidence-backed root cause) and present its verdict next to the
doctor's. Without a subagent tool, run the same checklist yourself. Respond in the user's language.

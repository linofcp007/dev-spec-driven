---
description: Health-check a feature — is it ready to advance a phase? Runs EARS + traceability + mandatory-section + steering checks. PT - diagnóstico (pronto para avançar?). ES - diagnóstico (¿listo para avanzar?).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill health-check.

Feature: $ARGUMENTS

Run the `spec_doctor` MCP tool for this feature and report the result clearly: each check
(pass/warn/fail), the recorded phase approvals, and the `readyToAdvance` verdict. If anything is
`fail` (e.g. EARS errors, traceability gaps, unfilled mandatory +saas/+ai sections still carrying
the `TODO` sentinel), list exactly what to fix before advancing. Respond in the user's language.

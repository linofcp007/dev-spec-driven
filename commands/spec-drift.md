---
description: Drift since finish — which implementing files of finished features changed, went missing or appeared since spec_finish recorded the baseline. PT - deriva desde o fecho da feature. ES - deriva desde el cierre de la función.
argument-hint: "[feature name | blank for all]"
---

Use the **dev-spec-driven** skill, drift check (`references/change-management.md` → Drift).

Target: $ARGUMENTS

`spec_finish {write: true}` on a READY feature records a baseline: a hash of every file its `_Implements:_`
markers name (a folder expands to its files). Call the `spec_drift` MCP tool `{name?}` (CLI
`dev-spec drift [feature]`, exit 1 on drift) to compare each finished feature's recorded files with the working
tree. It is read-only and hashes only the recorded files. The session-start hook also prints one line per
drifted active feature.

Report per feature: files **changed**, **missing**, or **now present** (missing at finish), and list apart the
features without a baseline (`unbaselined` — finished before 1.13, or never finished with `write`) and those whose
tasks are open again (`reopened`). A state file that can't be read is an error, never "clean".

For each drifted feature, look at the diff (`git log -p -- <file>`) and help the user decide:
- **the spec is now wrong** (behaviour changed on purpose) → edit the requirements/design and run `/spec-impact`,
  then re-approve; or, for new behaviour, a new feature (`/spec`) whose criteria carry `_Supersedes:_`;
- **the code is wrong** (an unintended regression) → fix it — a bugfix (`/spec-bugfix`) when it's a real defect;
- **harmless** (refactor, formatting) → accept it: after the spec chain is confirmed, re-run
  `spec_finish {write: true}` to record a fresh baseline.

Respond in the user's language (EN/PT/ES).

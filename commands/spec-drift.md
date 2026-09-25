---
description: Drift since finish — which implementing files of finished features changed, went missing or appeared since spec_finish recorded the baseline. PT - deriva desde o fecho da feature. ES - deriva desde el cierre de la función.
argument-hint: "[feature name | blank for all]"
---

Use the **dev-spec-driven** skill, drift check (`references/change-management.md` → Drift).

Target: $ARGUMENTS

`spec_finish {write: true}` on a READY feature records a baseline: a hash of every file its `_Implements:_`
markers name (a folder expands to its files). Call the `spec_drift` MCP tool `{name?}` (CLI
`dev-spec drift [feature]`, exit 1 on drift or a stale baseline) to compare each finished feature's recorded files with the working
tree. It is read-only and hashes only the recorded files. The session-start hook also prints one line per
drifted active feature.

Report per feature: files **changed**, **missing**, or **now present** (missing at finish), and list apart the
features without a baseline (`unbaselined` — finished before 1.13, or never finished with `write`), those whose
tasks are open again (`reopened`), and those that changed since their finish and are done again (`stale`, with
`why`: a change request or a re-approval after the finish, or an `_Implements:_` file the baseline never recorded —
not hashed: tell the user to finish them again with `spec_finish {write: true}`, then re-approve `execution`). A state
file that can't be read is an error, never "clean".

For each drifted feature, look at the diff (`git log -p -- <file>`) and help the user decide:
- **the spec is now wrong** (behaviour changed on purpose) → edit the requirements/design and run `/spec-impact`,
  then re-approve; or, for new behaviour, a new feature (`/spec`) whose criteria carry `_Supersedes:_`;
- **the code is wrong** (an unintended regression) → fix it — a bugfix (`/spec-bugfix`) when it's a real defect;
- **harmless** (refactor, formatting) → accept it: after the spec chain is confirmed, re-run
  `spec_finish {write: true}` to record a fresh baseline — its `baseline.replaced` names the drift it accepted.

`spec_next_action` on a finished feature says the same: `step: "drift"` (with `drift` {changed, missing, nowPresent}),
`step: "finish"` with `staleBaseline` when the feature changed since its finish (finish it again), or
`step: "finished"` when nothing drifted.

Respond in the user's language (EN/PT/ES).

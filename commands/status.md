---
description: Report mode, active tracks, phase, task progress, and test/eval state for a feature (or all features). PT - estado da funcionalidade/projeto. ES - estado de la función/proyecto.
argument-hint: "[feature name | blank for all]"
---

Use the **dev-spec-driven** skill status workflow.

Target: $ARGUMENTS

If a feature name is given, run the `spec_status` MCP tool and report: active tracks, current
phase, artifacts present, task progress (done/total) and the next task, plus +saas scale-section
completeness and +ai eval/prompt state. If no name is given, run `spec_list` and show every feature
with its track set, phase, and task progress. Keep it concise and scannable.

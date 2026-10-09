---
description: Mode, tracks, phase, task progress and test / eval state of a feature (or of every feature).
argument-hint: "[feature name | blank for all]"
---

Use the **dev-spec-driven** skill status workflow.

Target: $ARGUMENTS

If a feature name is given, run the `spec_status` MCP tool and report: the feature's kind and flow, active tracks, current
phase, artifacts present, task progress (done/total, with each task's `verified` flag) and the next task,
plus each active track's mandatory design sections — +saas / +ai / +sec (`secSections`) / +privacy
(`privacySections`) / +dist (`distSections`) / +api (`apiSections`) / +ui (`uiSections`) / +obs (`obsSections`) / +data (`dataSections`), each one **present** vs **filled** (the same rule `spec_doctor` uses) — and the +ai
eval-plan/prompt state. If no name is given, run `spec_status` and show every feature with its track set, phase, and
task progress — and its `kind` when it is a bugfix or a spike, its `flow` when design-first. Keep it concise and
scannable. For "what now?", use `spec_next_action`; for dates, `/roadmap` (ETAs from the recorded velocity).
Respond in the user's language (EN/PT/ES).

---
description: Metrics and retrospective — lead times, rework, forced approvals, change requests, evidence pass rate; optional retro.md.
argument-hint: "[feature name | blank for the project] [--write]"
---

Use the **dev-spec-driven** skill, metrics & retrospective.

Args: $ARGUMENTS

Call the `spec_metrics` MCP tool (CLI `dev-spec metrics [feature] [--write]`). Everything is derived locally
from `.state.json`, `.history/` and the artifacts — no model, no cost.

- **With a feature name:** lead time (hours) from creation to the first approval of each phase and to
  complete / finished, **rework** (re-approvals of a phase), **forced approvals** and batch approvals (`/spec-ff`),
  **change requests** and reopened tasks (from `spec_impact --reopen`), **evidence pass rate** (passing runs /
  recorded runs — an `_Expect: fail_` task's red run counts as a pass, an unexpected pass as a failure), tasks
  done/total, open `[NEEDS CLARIFICATION]` markers and the feature's **velocity** (points per working day over the
  last 28 days, `_Size:_`). A created date or rework flagged approximate / a lower bound comes from approvals made
  before the change history — say so.
- **Without a name:** every feature plus averages, medians and totals, and the project's velocity (the rate the
  roadmap's ETAs use; it needs 3 completed tasks in the window).

Present the numbers briefly and point at what they suggest (a phase approved three times, forced approvals,
a low pass rate). **`write: true`** (with a name, usually after `/spec-finish`) creates
`.specs/<feature>/retro.md`, pre-filled with the metrics: What went well · What hurt · Proposed steering or
constitution amendments · Follow-ups. An existing `retro.md` is **never overwritten**. Help the user write the
prose; the amendments are **proposals for the human** — never edit `constitution.md` or a steering file
without their approval, and add accepted follow-ups with `spec_backlog`. Respond in the user's language
(EN/PT/ES).

---
description: Escalate an existing feature to a new track (+tdd/+saas/+ai), additive only. PT - adiciona um track a uma feature. ES - añade un track a una feature.
argument-hint: "[feature name] [tdd|saas|ai]"
---

Use the **dev-spec-driven** skill to add a track to an existing feature.

Args: $ARGUMENTS

Call the `spec_add_track` MCP tool (CLI `dev-spec add-track <feature> <tdd|saas|ai>`). It is **additive
and never overwrites**: it scaffolds only the missing artifacts for the new track (test-plan.md +
tests/ for +tdd; eval-plan.md + prompts/ + evals/ for +ai; load-test.md for +saas) and appends that
track's mandatory `design.md` sections if they aren't already there. Use it when a feature grew into
needing tests, scale, or AI after it was first created. After running it, report which files were
added, tell the user to fill the new design sections, then run `spec_doctor` for the feature. Respond
in the user's language (EN/PT/ES).

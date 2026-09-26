---
description: Escalate an existing feature to a new track (+tdd/+saas/+ai), additive only — or turn one off with --remove (no file deleted). PT - adiciona (ou remove) um track de uma feature. ES - añade (o quita) un track de una feature.
argument-hint: "[feature name] [tdd|saas|ai] [--remove]"
---

Use the **dev-spec-driven** skill to add a track to an existing feature.

Args: $ARGUMENTS

Call the `spec_add_track` MCP tool `{name, track}` (CLI `dev-spec add-track <feature> <tdd|saas|ai>`). `track`
takes one or several (`'saas,ai'`, `'+saas +ai'`); an unknown name is an error with a did-you-mean. It is
**additive and never overwrites**: it scaffolds only the missing artifacts for the new track (test-plan.md +
tests/ for +tdd; eval-plan.md + prompts/ + evals/ for +ai; load-test.md for +saas), appends that track's
mandatory `design.md` sections and template tasks if they aren't already there, adds its steering files,
updates `classification.md`'s Active Tracks line and persists the track set in `.state.json`. Use it when a
feature grew into needing tests, scale, or AI after it was first created. After running it, report which files
were added, tell the user to fill the new design sections and tasks (the design gate refuses unfilled
`[SaaS]`/`[AI]` sections), then run `spec_doctor` for the feature. Respond in the user's language (EN/PT/ES).

To take a track **off** (the feature turned out simpler), pass `remove: true` (CLI `--remove`): the track leaves
the stored track set and **no file is deleted** — the result lists the now-inactive artifacts, and doctor, status,
next_action and the gates stop requiring them (a removed track's sections, criteria and tasks are ignored). `core`
can't be removed, and a bugfix keeps +tdd. Clean up leftover files by hand only if the user asks.

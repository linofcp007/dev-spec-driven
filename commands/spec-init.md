---
description: Initialize .specs/ and the steering files for the tracks this project uses. PT - inicializa .specs/ e steering. ES - inicializa .specs/ y steering.
argument-hint: "[tracks, e.g. tdd saas ai] [--lang pt] [--guard on|off]"
---

Use the **dev-spec-driven** skill to bootstrap project context.

Args: $ARGUMENTS

Run the `spec_init` MCP tool `{tracks, lang, guard?}` (CLI `dev-spec init [tracks...] [--lang pt] [--guard on|off]`)
to create `.specs/steering/` and the steering files the given tracks require (constitution/product/tech/structure
always; testing-standards for +tdd; scale/observability/cost for +saas; ai-strategy for +ai). Tracks may be given
as `tdd saas`, `'tdd,saas'` or `+saas +ai`; an unknown name is an error with a did-you-mean. **Pass `lang`
matching the user's language** — the stubs come out in it and it becomes the project default every new feature
inherits. `guard` is the opt-in guard mode (see `/spec-guard`); omit it to leave it unchanged. It never
overwrites an existing file.

Then help the user fill each file with real, project-specific content using `references/steering-templates.md` —
a steering file full of placeholders is a liability (`spec_doctor` warns about each one by name). For rules that
apply only to part of the code (API conventions, a UI kit), add a scoped steering file with
`steering_scaffold {file: "api-conventions.md"}` (front matter `inclusion: always | fileMatch | manual`).
Respond in the user's language (EN/PT/ES).

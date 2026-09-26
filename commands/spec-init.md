---
description: Initialize .specs/ and the steering files for the tracks this project uses. PT - inicializa .specs/ e steering. ES - inicializa .specs/ y steering.
argument-hint: "[tracks, e.g. tdd saas ai sec privacy] [--lang pt] [--guard on|off|scope] [--check name=cmd] [--roles requirements=product,design=tech+security] [--stop-check on|off]"
---

Use the **dev-spec-driven** skill to bootstrap project context.

Args: $ARGUMENTS

Run the `spec_init` MCP tool `{tracks, lang, guard?, checks?, approvalRoles?, stopCheck?}` (CLI
`dev-spec init [tracks...] [--lang pt] [--guard on|off|scope] [--check name="cmd"] [--roles …] [--stop-check on|off]`)
to create `.specs/steering/` and the steering files the given tracks require (constitution/product/tech/structure always;
testing-standards for +tdd; scale/observability/cost for +saas; ai-strategy for +ai; security for +sec; privacy for
+privacy). Tracks may be given as `tdd saas`, `'tdd,saas'` or `+saas +ai`; an unknown name is an error with a
did-you-mean. **Pass `lang` matching the user's language** — the stubs come out in it and it becomes the project
default every new feature inherits. It never overwrites an existing file (a team's own steering stubs in
`.specs/templates/steering/` are used when present — `/spec-templates`).

The opt-in settings, each stored in `.specs/roadmap.json → meta` and reported back on every call (omit one to leave it
unchanged):

- `guard` — guard mode `true` / `"scope"` / `false` (see `/spec-guard`).
- `checks` — the project's named check commands, e.g. `{"test": "npm test", "lint": "npm run lint"}` (CLI
  `--check test="npm test"`, repeatable; `name=` removes one): every task brief lists them in its definition of done,
  and `/spec-finish` then needs a passing run of each since the feature's last task (`dev-spec finish <f> --run`).
  Ask the user for the real commands — never guess them.
- `approvalRoles` — team governance (CLI `--roles requirements=product,design=tech+security`, `--roles none` clears
  them): each listed phase is approved only once every role has signed off its current content (see `/approve`).
- `stopCheck` — the end-of-turn evidence gate (on by default; `false` / `--stop-check off` turns the Stop and
  SubagentStop hooks' check off for this project).

Then help the user fill each file with real, project-specific content using `references/steering-templates.md` —
a steering file full of placeholders is a liability (`spec_doctor` warns about each one by name). For rules that
apply only to part of the code (API conventions, a UI kit), add a scoped steering file with
`steering_scaffold {file: "api-conventions.md"}` (front matter `inclusion: always | fileMatch | manual`).
Respond in the user's language (EN/PT/ES).

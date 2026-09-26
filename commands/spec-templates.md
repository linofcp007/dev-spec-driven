---
description: Project templates — list, copy (init) or check the team's own scaffolds in .specs/templates/ that replace the built-in ones. PT - templates do projeto. ES - plantillas del proyecto.
argument-hint: "[list|init|check] [artifact] [--lang en|pt|es]"
---

Use the **dev-spec-driven** skill, project templates.

Args: $ARGUMENTS

Call the `spec_templates` MCP tool (CLI `dev-spec templates [list|init|check] [artifact] [--lang en|pt|es]`) and show
its `lines`.

- **`list`** (default) — for each artifact, whether new features get the built-in template or the project's
  (`.specs/templates/<artifact>.md`; `.specs/templates/<lang>/<artifact>.md` wins for features in that language), and
  any file there that is not a template name (ignored).
- **`init`** — copies the built-in template(s) into `.specs/templates/` (one `artifact`, or all) with the variables in
  place, so the team edits them there. `lang` given → `.specs/templates/<lang>/`. It never overwrites a file. Artifacts:
  classification, requirements, design, tasks, test-plan, eval-plan, load-test, quickstart, checklist,
  integration-plan, bug, bug-requirements, bug-test-plan, bug-tasks, and `steering/<file>.md`.
- **`check`** — validates the project's templates against the current rules and lists each problem with its severity
  (the CLI exits 1 on an error). Fix the errors before scaffolding with them.

What to tell the user when they edit a template:

- Variables: `{{name}}` `{{slug}}` `{{summary}}` `{{tracks}}` `{{lang}}` `{{date}}` — an unknown `{{x}}` is left as is.
- Keep the **English-stable** tokens exactly: AC IDs `US-n.AC-m`, test IDs `T-nn`, `[SaaS]`/`[AI]`/`[SEC]`/`[PRIVACY]`,
  `> **TODO**`, `_Requirements:_`, `_Verify:_`, `**Checkpoint:**`.
- Leave `[bracketed]` slots for what each feature must fill: they count as template placeholders, so an untouched
  scaffold stays unapprovable. A template with no slot at all scaffolds a file its gate could approve unedited.
- **Track sections are added by the engine**: an overridden design.md, requirements.md, tasks.md or test-plan.md still
  gets each active track's sections / criteria / tasks / test rows appended at the end — unless the template already has
  that track's heading. A design template that carries some of a track's headings (`[SaaS] …`) must carry all of that
  track's mandatory sections, each with its `> **TODO**` line.
- New scaffolds only: existing features never change. Respond in the user's language (EN/PT/ES).

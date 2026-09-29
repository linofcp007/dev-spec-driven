---
description: Project-defined tracks — list, scaffold (init) or check the team's own track packs in .specs/tracks/ (+a11y, +mobile…), marker tracks like +sec. PT - tracks do projeto. ES - tracks del proyecto.
argument-hint: "[list|init <name>|check] [name] [--lang en|pt|pt-BR|es]"
---

Use the **dev-spec-driven** skill, project-defined tracks.

Args: $ARGUMENTS

Call the `spec_tracks` MCP tool (CLI `dev-spec tracks [list|init <name>|check] [name] [--lang en|pt|pt-BR|es]`) and show
its `lines`.

- **`list`** (default) — the built-in tracks (core, tdd, saas, ai, sec, privacy, dist, api, ui) and every pack folder in
  `.specs/tracks/`, valid or not (an invalid pack is ignored everywhere until it is fixed).
- **`init <name>`** — scaffolds `.specs/tracks/<name>/`: a commented example `track.json` and one example of each
  fragment (`requirements.md`, `tasks.md`, `test-plan.md`, `checklist.md`, `steering.md`) in `lang` or the project
  language. It never overwrites a file. The pack is a valid track as soon as it is written — edit it, then `check` it.
- **`check`** — validates every pack (or one): each problem with its file, line, stable code and severity (the CLI
  exits 1 on an error). Fix the errors: a bad pack is ignored as a whole, never half-applied.

What to tell the user when they write a pack (details: `references/project-tracks.md`):

- `track.json`: `name` = the folder name (`^[a-z][a-z0-9]{1,19}$`, never a built-in track), `marker` (`^[A-Z][A-Z0-9]{1,11}$`,
  case-sensitive, unique — never SaaS / AI / SEC / PRIVACY / DIST), `title` {en, pt?, es?}, `signals` {strong, weak, context} (the
  classifier matches them as literal words — never as patterns), `sections` [{name, syn?, loose?, guidance?}] (the
  mandatory design sections), `steering` (optional file name). `//` comments are allowed.
- Fragments are plain markdown: one list item = one criterion / task / checklist line; test-plan rows keep the built-in
  plan's six cells. `{{ac1}}`… / `{{acs}}` name the pack's criteria as the feature numbers them, `{{t1}}`… / `{{tests}}`
  their planned tests. A `<lang>/` subfolder's fragment wins over the pack root's. `[bracketed]` slots stay template
  placeholders until a feature fills them; the `[MARKER]` never is one.
- Using it: name it like any track — `spec_create {tracks: "tdd,a11y"}`, `/add-track <feature> a11y`, or let
  `spec_classify` pick it from its signals (confirm in Phase 0). doctor then fails `<name>-sections` and the design
  approval is refused until every `## [MARKER] <section>` is filled.
- A feature whose saved track names a pack that is gone or invalid keeps it inactive; doctor warns `track-pack-missing`.
  A pack is data only: nothing in it runs. Respond in the user's language (EN/PT/ES).

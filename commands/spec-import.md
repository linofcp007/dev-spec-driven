---
description: Import a spec written for Kiro, spec-kit or OpenSpec as a new dev-spec feature (IDs remapped, source untouched). PT - importa uma spec do Kiro, spec-kit ou OpenSpec. ES - importa una spec de Kiro, spec-kit u OpenSpec.
argument-hint: "[kiro|spec-kit|openspec] [path] [--name n] [--tracks tdd,saas] [--lang pt]"
---

Use the **dev-spec-driven** skill, import from other tools (`references/brownfield.md` → Import).

Args: $ARGUMENTS

Call the `spec_import` MCP tool `{tool, path, name?, tracks?, lang?}` (CLI
`dev-spec import <kiro|spec-kit|openspec> <path> [--name n] [--tracks tdd,saas] [--lang pt]`):

- `tool` — `kiro` (`.kiro/specs/<name>/`), `spec-kit` (`specs/<nnn-name>/`) or `openspec`
  (`openspec/specs/<capability>/`, or a change folder `openspec/changes/<id>/`);
- `path` — the spec folder (or a file in it), **inside the project**; the source is only read, never modified;
- `name` — defaults to the source folder name (spec-kit's number prefix dropped); an existing feature with that
  slug is an error (import never writes over a feature);
- `tracks` — omit to auto-classify from the imported requirements; `lang` — the generated headings/notes
  (the imported text is kept as written).

It creates a NEW feature: requirement/story N, criterion/scenario M → `US-N.AC-M`; each scenario becomes one
EARS criterion where possible (else its text is kept with `[NEEDS CLARIFICATION]`); Kiro `_Requirements: 1.1_`
references are rewritten; tasks are renumbered 1…K keeping their checkbox state and `[P]`/`[USn]` tags;
`SC-`/`FR-` IDs stay; every artifact carries an "Imported from <tool> <path> on <date>" note.

Show the user: the files written, the **ID mapping** (`mapping`: old → new) and every **warning** (criteria
not in EARS form, stories without criteria, carried or skipped sections, unresolved task references). Then treat
it like any new feature: **Phase 0** — confirm the track set with the user (`spec_add_track` to change it) —
then `spec_clarify` / `ears_validate` on the imported requirements and the normal gates (`spec_doctor`,
`/approve` per phase). Imported checkboxes are not evidence: re-verify ticked tasks before trusting them.
Respond in the user's language (EN/PT/ES).

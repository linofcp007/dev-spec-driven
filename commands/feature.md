---
description: Manage a feature's lifecycle - archive, restore, rename, or remove (keeps roadmap deps consistent). PT - gere a feature (arquivar/restaurar/renomear/apagar). ES - gestiona la feature (archivar/restaurar/renombrar/eliminar).
argument-hint: "[archive|restore|rename|remove] [feature name] [new name]"
---

Use the **dev-spec-driven** skill to manage a feature's lifecycle.

Args: $ARGUMENTS

Call the `spec_feature` MCP tool `{action, name, newName?, confirm?}` (CLI
`dev-spec feature <action> <name> [new-name] [--yes]`) with one of:

- **archive** — move `.specs/<slug>/` to `.specs/_archive/<slug>/`, out of the active roadmap. Its roadmap entry
  and the `dependsOn` references it prunes are recorded in its `.state.json` (`archived`). **Prefer this** over remove.
  The result names the features that depended on it (`dependentsPruned`); when the archived feature wasn't complete
  it also carries `incompleteDependency: true` and a warning `note` — those features now read as unblocked, so tell
  the user and offer `restore` or re-declaring the dependency with `spec_depend`.
- **restore** — move `.specs/_archive/<slug>/` back and put back its roadmap entry and the `dependsOn` references
  archive pruned — only for features that still exist (and never one that would now close a cycle); the rest are
  listed in `skipped`. An error when an active feature already has that slug or nothing is archived under the name.
- **rename** — change the slug + folder + `roadmap.json` key, updating every reference to it: `dependsOn` lists,
  `_Supersedes: <old>/US-n.AC-m_` markers in other features' requirements.md (active and archived — never an example
  in a comment or fenced code; an approved requirements.md then shows as changed-since-approval, re-approve it) and
  archived features' archive records (so restore brings their dependencies back). The result lists them
  (`supersedesUpdated`, `archiveRecordsUpdated`, `note`).
- **remove** — permanently delete the feature's folder. **Destructive**: without `confirm: true` (CLI `--yes`)
  nothing is deleted and the result lists what would be (`needsConfirm`). Show that list to the user and pass
  `confirm: true` only after they confirm (or were explicit) — suggest archive instead.

Every action keeps `roadmap.json` dependencies consistent and regenerates the roadmap (and `.specs/SPECS.md`
when it exists). None moves or deletes a folder while another process (another editor, a running `dev-spec`
command) is updating that feature or `roadmap.json`: it waits, then answers `busy` with nothing changed — retry. Report what changed, including any `skipped` references on restore. Respond in the user's
language (EN/PT/ES).

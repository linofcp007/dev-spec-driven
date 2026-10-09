---
description: Manage a feature's lifecycle — archive, restore, rename, remove, or switch its phase order (design-first).
disable-model-invocation: true
argument-hint: "[archive|restore|rename|remove|flow] [feature] [new name | design-first|requirements-first]"
---

Args: $ARGUMENTS

`spec_feature {action, name, newName?, flow?, confirm?}` (CLI `dev-spec feature <action> <name> …`):
- **archive** — to `.specs/_archive/<slug>/`, out of the roadmap; prefer it to remove. Features that depended on it now
  read as unblocked (`dependentsPruned`; `incompleteDependency` when it wasn't done) — tell the user.
- **restore** — back from the archive with its roadmap entry and dependencies (`skipped` lists those that no longer apply).
- **rename `<new name>`** — slug, folder and every reference to it (`dependsOn`, other features' `_Supersedes:_` markers —
  an approved requirements.md they rewrite then needs re-approval).
- **flow `design-first | requirements-first`** — the phase order; phases already approved stay approved.
- **remove** — permanent. Without `confirm: true` it only lists what it would delete (`needsConfirm`): show the list and
  pass `confirm: true` only after the user confirms. Suggest archive instead.

`busy` or `inUse` → nothing changed: close what holds the folder and retry. Report what changed. Respond in the user's
language (EN / PT / ES).

---
description: Manage a feature's lifecycle - remove, archive, or rename (keeps roadmap deps consistent). PT - gere a feature (apagar/arquivar/renomear). ES - gestiona la feature (eliminar/archivar/renombrar).
argument-hint: "[remove|archive|rename] [feature name] [new name]"
---

Use the **dev-spec-driven** skill to manage a feature's lifecycle.

Args: $ARGUMENTS

Call the `spec_feature` MCP tool (CLI `dev-spec feature <action> <name> [new-name]`) with one of:

- **archive** — move `.specs/<slug>/` to `.specs/_archive/<slug>/`, out of the active roadmap (reversible). **Prefer this** over remove.
- **rename** — change the slug + folder + `roadmap.json` key, updating every `dependsOn` reference to it.
- **remove** — permanently delete the feature's folder. **Destructive** — confirm with the user first, and look at the feature before deleting.

All three keep `roadmap.json` dependencies consistent and regenerate the roadmap. For **remove**, since
it's hard to reverse, confirm intent first unless the user was explicit. Report what changed. Respond
in the user's language (EN/PT/ES).

---
description: Show the roadmap and (re)generate .specs/ROADMAP.md (+ optional brand-styled .html). PT - roadmap do projeto. ES - hoja de ruta del proyecto.
argument-hint: "[--write] [--html] [--lang pt]"
---

Use the **dev-spec-driven** skill roadmap view.

Args: $ARGUMENTS

Run the `spec_roadmap` MCP tool. With `write: true` (CLI `dev-spec roadmap --write`) it (re)generates
**`.specs/ROADMAP.md`** — the default overview (progress bar, feature table, Mermaid dependency graph,
needs-attention, backlog; git/PR-friendly). Add `html: true` (`--html`) to also write a self-contained,
offline, brand-styled **`.specs/ROADMAP.html`** (light/dark toggle that defaults to the system theme).
**Pass `lang` (`--lang pt|es|en`) matching the user's language** — it localizes the chrome and is
stored for auto-refresh. Report: each feature's tracks, phase, %, dependencies and whether they're
met, blocked features, overall %, and any cycle; recommend the next unblocked feature. The roadmap is
auto-generated on every mutation and by a hook, so it's normally already up to date. Respond in the
user's language (EN/PT/ES).

---
description: Declare feature dependencies or order (cycle-checked) in the roadmap. PT - define dependências entre features. ES - define dependencias entre funciones.
argument-hint: "[feature] depends-on [other features…]"
---

Use the **dev-spec-driven** skill dependency manager.

Request: $ARGUMENTS

Interpret natural-language intents like "X depends on Y", "X no longer needs Y" or "do X before Y", then call the
`spec_depend` MCP tool with the feature and:
- `dependsOn` — **replaces** the list (`[]` clears it); `add` / `remove` — edit it one dependency at a time;
- `order` — an explicit position ("do X before Y");
- `name` alone — only shows the current dependencies (nothing is written).

CLI: `dev-spec depend <feature> [deps...]` (replace), `--add x[,y]` / `--rm x[,y]` (edit), `--clear`,
`--order N`; a bare `dev-spec depend <feature>` just shows them. Every dependency must be an **existing feature**
(an unknown slug is refused — check `spec_list`; a planned-but-unspecced one belongs in `/backlog`; a stale entry
left by a hand edit shows up in `unknownDeps` — drop it with `remove` / `--rm`), and a change
that would create a **circular dependency** is rejected — explain the cycle and propose a fix. It writes
`.specs/roadmap.json`; then show the updated `spec_roadmap`. Respond in the user's language (EN/PT/ES).

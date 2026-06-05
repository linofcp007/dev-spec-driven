---
description: Declare feature dependencies or order (cycle-checked) in the roadmap. PT - define dependências entre features. ES - define dependencias entre funciones.
argument-hint: "[feature] depends-on [other features…]"
---

Use the **dev-spec-driven** skill dependency manager.

Request: $ARGUMENTS

Interpret natural-language intents like "X depends on Y" or "do X before Y", then call the
`spec_depend` MCP tool with the feature, its `dependsOn` list, and/or an explicit `order`. It writes
`.specs/roadmap.json` and **rejects changes that create a circular dependency** — if rejected,
explain the cycle and propose a fix. Then show the updated `spec_roadmap`. Respond in the user's
language (EN/PT/ES).

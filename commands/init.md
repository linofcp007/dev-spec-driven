---
description: Initialize .specs/ and the steering files for the tracks this project uses. PT - inicializa .specs/ e steering. ES - inicializa .specs/ y steering.
argument-hint: "[tracks, e.g. tdd saas ai]"
---

Use the **dev-spec-driven** skill to bootstrap project context.

Tracks: $ARGUMENTS

Run the `spec_init` MCP tool to create `.specs/steering/` and the steering files the given tracks
require (product/tech/structure always; testing-standards for +tdd; scale/observability/cost for
+saas; ai-strategy for +ai). Then help the user fill each file with real, project-specific content
using `references/steering-templates.md` — a steering file full of placeholders is a liability.

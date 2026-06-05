---
description: Brownfield — inventory an existing codebase (stack, modules, endpoints) before reverse-engineering specs. PT - analisa código existente. ES - analiza código existente.
argument-hint: "[optional path]"
---

Use the **dev-spec-driven** skill brownfield scan.

Path: $ARGUMENTS

Run the `spec_scan` MCP tool (defaults to the project root) for a local, zero-cost inventory:
detected stack, top-level modules, file mix by extension, and candidate HTTP endpoints. Then read
the key files it points to and summarize the architecture. Use this as the basis to infer
`steering/` + `constitution.md` and to plan reverse-engineering. Respond in the user's language
(EN/PT/ES).

---
description: Brownfield — estimate what % of the existing codebase has specs, and list the gaps. PT - cobertura de specs. ES - cobertura de specs.
argument-hint: ""
---

Use the **dev-spec-driven** skill brownfield coverage check.

Args: $ARGUMENTS

Run the `spec_coverage` MCP tool: it maps top-level code modules to documented features by name and
reports a coverage %, plus the undocumented modules. Treat it as a coarse starting point (not a hard
metric) and prioritize documenting the highest-risk undocumented modules next. Respond in the user's
language (EN/PT/ES).

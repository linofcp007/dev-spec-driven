---
description: Brownfield — reverse-engineer steering + specs from an existing codebase. PT - engenharia reversa de specs. ES - ingeniería inversa de specs.
argument-hint: "[module or feature to document]"
---

Use the **dev-spec-driven** skill brownfield reverse-engineering flow.

Target: $ARGUMENTS

1. `spec_scan` the codebase and read the relevant code.
2. Draft `steering/` and `constitution.md` that **acknowledge the existing patterns** (don't impose
   new ones). Get approval.
3. Pick a strategy (constitution-only / + baseline specs for core modules / full coverage).
4. For each documented module, `spec_create` a feature and fill `requirements.md` + `design.md`
   describing what the code *does today* (mark as reverse-engineered). Use `_Implements: path_`
   markers so `trace` ties specs to real files.
5. Run `spec_coverage` to see what's still undocumented.

See `references/brownfield.md`. Respond in the user's language (EN/PT/ES).

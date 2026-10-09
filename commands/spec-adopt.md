---
description: Adopt specs in an existing codebase — scan it, reverse-engineer specs, measure coverage, or import another tool's specs.
disable-model-invocation: true
argument-hint: "[scan [folder] [--cap N] | reverse [module] | coverage | import <tool> <path|text> [--dry-run]]"
---

Args: $ARGUMENTS — the brownfield flow: `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/brownfield.md`.

- **scan `[folder]` `[--cap N]`** — `spec_scan {cap?}`, read-only: stack and frameworks, modules, HTTP routes with
  `file:line`, test frameworks, entry points, migrations, environment variable names (never values). It takes no path:
  another folder goes as `projectDir`, an absolute path. Then read the files it points to and summarize the architecture.
- **reverse `[module]`** — from the scan: draft steering and `constitution.md` that acknowledge the existing patterns
  (approval first), pick a strategy, then per module `spec_create` and requirements / design describing what the code
  does today, with `_Implements: path_` on its tasks. Specs already written in another tool → `import` instead.
- **coverage** — `spec_scan {coverage: true}`: the share of code files some task's `_Implements:_` names
  (`coveragePercent`, `byFolder`, `undocumented`) and the markers naming nothing (`unmatchedImplements` — fix them).
  Document the riskiest uncovered folders next.
- **import `<tool>` `<path | text>`** — `spec_import {tool, path | text, name?, tracks?, lang?, dryRun?}`: kiro ·
  spec-kit · openspec · plan · execplan · bmad · fluidplan become a NEW feature (`mapping` old → new IDs, `warnings`);
  kiro-steering · cursor-rules become steering files. `dryRun: true` previews it. A plan outside the project (plan mode's
  `~/.claude/plans`) goes as `text`. Then treat it as a new feature: confirm its tracks, `spec_clarify`, the gates —
  imported ticks are no evidence.

Respond in the user's language (EN / PT / ES).

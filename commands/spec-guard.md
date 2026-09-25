---
description: Turn guard mode on or off — Claude Code asks before editing code while no feature has approved tasks. PT - liga/desliga o modo guarda. ES - activa/desactiva el modo guardia.
argument-hint: "[on|off]"
---

Use the **dev-spec-driven** skill, guard mode (opt-in).

Args: $ARGUMENTS

Call the `spec_init` MCP tool with `guard: true` (on) or `guard: false` (off) — CLI
`dev-spec init --guard on|off`. It can be combined with tracks or used alone, writes `roadmap.json → meta.guard`,
scaffolds any missing core steering file like every `spec_init` (never overwrites one), and the result always
reports the current `guard` state. With no argument, read
`.specs/roadmap.json → meta.guard` (absent = off), report the state and explain it — don't call `spec_init` just
to look (it scaffolds any missing core steering file).

**What it does (Claude Code only).** The plugin's PreToolUse hook runs before Write / Edit / MultiEdit /
NotebookEdit. While the guard is on, an edit to a **code file outside `.specs/`** gets a permission prompt
("ask") with a localized reason **unless some feature has an approved tasks phase and open tasks** — then it
is silent. It is silent too for spec files, non-code files, files outside the project, and whenever the guard
is off. An approval recorded with `--force` still counts, with a note saying so. A tasks approval whose
tasks.md changed afterwards (tasks appended with `spec_append_tasks` or edited by hand — ticking boxes doesn't
count) no longer covers code edits: the prompt names the feature until its tasks phase is re-approved. It
never blocks on its own error, and the human can always confirm the edit.

Explain it to the user in those terms: it is a reminder to plan before coding, not a lock. Other hosts (Cursor,
Windsurf, Copilot, Gemini) have no PreToolUse hook — there the rule lives in the workflow text only.
Respond in the user's language (EN/PT/ES).

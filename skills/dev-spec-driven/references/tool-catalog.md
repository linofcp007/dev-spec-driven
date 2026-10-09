# Which MCP tool when

The bundled zero-dependency MCP server **`spec-driven`** does the mechanical work; prefer it over hand-rolled edits
for the structural steps. The tools produce **skeletons and checks** (never overwriting your files); *you* fill them
with real content from the `references/` templates. No MCP connection (e.g. claude.ai)? Write the files by hand.

- **Start:** `spec_classify` (Phase 0 draft) → `spec_init` (steering; opt-in `guard`, project `checks`,
  `approvalRoles`, `evidence: "observed"`, `approvalGuard`) → `spec_create` (one feature; `kind: "bugfix"` for a defect
  — prefill `reproduction`, `rootCause`, `condition`, `behaviour` and ask for `includeBody` instead of reading the
  scaffolds back; `kind: "spike"` for a question, `brownfield: true` in existing code, `flow: "design-first"`) — or
  `spec_import` (Kiro / spec-kit / OpenSpec / a plan / a Codex ExecPlan / BMAD / fluidplan; Kiro steering / Cursor rules →
  `.specs/steering/`; `dryRun: true` previews without writing). The team's own scaffolds:
  `spec_templates`; the team's own tracks: `spec_tracks`.
- **Gates:** `ears_validate` · `spec_clarify` · `trace_check` (`code: true` → T-IDs in test files; `matrix: true` → the
  requirements traceability matrix) · `spec_doctor` (one "ready to advance?" verdict) · `spec_approve` (refused while
  the phase's checks fail; `role`, `through`; only on the user's explicit yes for that phase) · `spec_next_action`
  (you are here, one ordered next step).
- **Execute:** `spec_next_task` (`waves: true` → the parallel execution waves) · `spec_task_brief` ·
  `spec_complete_task {evidence}` · `spec_append_tasks` (converge) · `spec_finish` · `spec_stop_check {message}` (the
  end-of-turn evidence gate for clients without Claude Code's Stop hook: pass your closing message before you say done /
  verified — `block: true` means ticked tasks still lack passing evidence) · `spec_log {name, gitLog}` (the commits citing
  each task, + a red-first check on +tdd, from the `git log --name-only --relative` text you pass — from the feature's
  `branch.commit` (`<commit>..HEAD`) when it has its own branch — the server never runs git).
- **Change & after:** `spec_impact` (an edit after approval → what it touches; reopen) · `spec_decide` (decision log) ·
  `spec_drift` · `spec_metrics` · `spec_catalog` · `spec_export` · `spec_changelog`.
- **Project:** `spec_list` / `spec_status` · `spec_roadmap` / `spec_depend` / `spec_backlog` / `spec_milestone` ·
  `spec_add_track` / `spec_feature` · `spec_scan` / `spec_coverage` (brownfield) · `steering_scaffold` · `spec_upgrade`
  (after a plugin update).

**The CLI** runs the same engine (`dev-spec <command>` in these docs — its name). A plugin install puts no `dev-spec` on
PATH: a CLI line you hand the user is the runnable one the tools' messages print, `node "<clone>/cli/dev-spec.js" …`
with the clone's path resolved (`node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" …` in the command files). Its `done <f> <n>
--run` runs a task's `_Verify:_` in the platform shell (cmd.exe on Windows, /bin/sh elsewhere) or the one `--shell` names —
`bash` (Git Bash), `pwsh` / `powershell` for a PowerShell command (the portable choice; a `pwsh -Command` script holding `$`
takes double quotes under cmd.exe, single quotes under a POSIX shell): `references/verification.md` → PowerShell.

Full tool table, the CLI, the hooks, doctor's check ids, the MCP prompts + `specs://` resources other MCP clients get and
the annotated `.specs/` tree: `references/tooling-reference.md`.

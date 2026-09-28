# Integrations — use dev-spec-driven in any tool

The methodology travels through **three portable layers**, so it works far beyond Claude Code:

1. **MCP server** (`mcp/server.js`) — the open Model Context Protocol. Any MCP client gets all 36
   tools (`spec_classify`, `spec_init`, `spec_create`, `spec_doctor`, `trace_check`, `ears_validate`,
   `spec_approve`, …), including the change-management ones — `spec_impact`, `spec_append_tasks`,
   `spec_import`, `spec_metrics`, `spec_catalog`, `spec_drift` —, `spec_upgrade` (after a plugin update) and the 1.14
   ones — `spec_templates`, `spec_export`, `spec_changelog`, `spec_decide` — and, unreleased (1.15), `spec_tracks` (project-defined tracks). They are plain local file operations, so
   they behave the same in every client. The server also offers **prompts** (one per plugin command) and read-only
   **resources** (the specs) — see [MCP prompts and resources](#mcp-prompts-and-resources).
2. **Universal CLI** (`cli/dev-spec.js`) — the same engine from any terminal or tool, even without MCP.
3. **Instructions files** — `AGENTS.md` (cross-tool) plus per-tool rule files, so the agent follows
   the workflow.

Everything is **local, zero-dependency (Node ≥18), no GitHub Actions, no paid CI, no pull requests, no cost.**

> Tip: run `node cli/dev-spec.js mcp-config <client>` to print a ready-to-paste config with the
> correct absolute path already filled in. `<client>` = `claude-desktop`, `claude-code`, `cursor`,
> `windsurf`, `vscode`, `gemini`, `codex`, `generic`, or `all`.
>
> 📁 **Config templates** live in [`integrations/`](./integrations/). They are **not** path-filled:
> each carries the placeholder `/ABSOLUTE/PATH/TO/dev-spec-driven/mcp/server.js`, to replace with your
> clone's path — or skip them and run `node cli/dev-spec.js mcp-config <client>`, which prints the same
> config already filled in (see [`integrations/README.md`](./integrations/README.md)). Opening *this*
> folder in Cursor/VS Code/Gemini works out of the box via the root `.cursor/mcp.json`,
> `.vscode/mcp.json`, and `.gemini/settings.json`.
>
> 📝 **Rule files for your own project:** the rule files in this repo (`.cursor/rules/`, `.windsurf/rules/`,
> `.github/copilot-instructions.md`, `GEMINI.md`, `AGENTS.md`) use paths relative to this clone, which
> don't exist in your project. Generate them instead — `node "<PLUGIN>/cli/dev-spec.js" rules <tool>`
> (`cursor` | `windsurf` | `copilot` | `gemini` | `agents`) prints the rule file with this clone's
> absolute paths; redirect it to the destination shown per tool below (if that file already exists,
> merge the output into it instead of overwriting it). Run it from your project's root. A shell
> redirect does not create missing folders, so create the folder first. In **Windows PowerShell 5.1**,
> `>` writes UTF-16, and piping to `Out-File`/`Set-Content` re-encodes the text through the console code
> page, so let `cmd` do the redirect. It keeps the exact UTF-8 bytes and works in PowerShell 7 too:
>
> ```bash
> # macOS / Linux / Git Bash
> mkdir -p .cursor/rules && node "<PLUGIN>/cli/dev-spec.js" rules cursor > .cursor/rules/dev-spec-driven.mdc
> ```
>
> ```powershell
> # PowerShell (5.1 or 7)
> New-Item -ItemType Directory -Force .cursor\rules | Out-Null
> cmd /c 'node "<PLUGIN>\cli\dev-spec.js" rules cursor > .cursor\rules\dev-spec-driven.mdc'
> ```

Replace `<PLUGIN>` throughout this page with the absolute path to your clone of this repo (where you ran
`git clone https://github.com/linofcp007/dev-spec-driven.git`). Tip: `node cli/dev-spec.js mcp-config <client>`
prints the config with that path already filled in for your machine.

## MCP prompts and resources

Besides its tools, the `spec-driven` server advertises two more MCP capabilities, so clients that support them get
more than tool calls:

- **Prompts** — one per plugin command (`spec`, `spec-status`, `spec-impact`, `spec-ff`, `spec-tour`, … — 51, read from
  `commands/*.md`), each with one optional `args` argument. A client that surfaces MCP prompts shows them as slash
  commands or in a prompt picker — VS Code / Copilot Chat, for example, lists them under `/`; whether and how another
  client shows them depends on the client and its version. Each prompt starts with one line telling an agent without the
  dev-spec-driven skill to follow `AGENTS.md`.
- **Resources** (read-only) — `specs://roadmap`, `specs://catalog`, `specs://steering/{file}` and
  `specs://feature/{slug}/{artifact}` (requirements.md, design.md, tasks.md, decisions.md, spike.md, …) for the project
  the server runs in. Clients that support resources let you attach them as context.

Clients that support neither simply ignore them — the tools are the same everywhere, and `dev-spec prompts [name]`
prints any prompt in a terminal. The Claude Code plugin turns the prompts off (`SPEC_MCP_PROMPTS=off` in
`mcp/servers.json`) because its commands are already slash commands there; set the same variable in another client's
server entry (`"env": { "SPEC_MCP_PROMPTS": "off" }`) if you don't want them.

---

## Claude Code (CLI / IDE extension)

Native — it's a plugin. Skills, the 53 commands, the 3 agents, the hooks (PostToolUse + SessionStart, the Stop /
SubagentStop evidence gate, the Bash observed-evidence log, plus the opt-in PreToolUse guard and approval guard) and the
MCP server all load:

```bash
claude --plugin-dir "<PLUGIN>"
```

Or register just the MCP server: `claude mcp add spec-driven -- node "<PLUGIN>/mcp/server.js"`.
See [INSTALL.md](./INSTALL.md) for the persistent marketplace install.

**Alongside superpowers.** If the superpowers plugin is installed too, its planning / TDD / debugging / execution /
review / branch-finishing skills overlap this plugin. `/spec-superpowers` writes (after you confirm) a marked
precedence block into the project's `CLAUDE.md` (or `~/.claude/CLAUDE.md` with `--user`) — superpowers itself defers
to CLAUDE.md — so feature work runs here and superpowers keeps the rest. To switch it off instead: per project,
`.claude/settings.json` → `"enabledPlugins": { "superpowers@claude-plugins-official": false }`; everywhere, `/plugin disable`.
In Cursor / Codex / Gemini, where superpowers also ships, copy the same block into that tool's rules or `AGENTS.md`.

## Claude Desktop

Add the MCP server to `claude_desktop_config.json`
(Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "spec-driven": { "command": "node", "args": ["<PLUGIN>/mcp/server.js"] }
  }
}
```

Restart Claude Desktop. The `spec-driven` tools appear. The workflow itself: paste the output of
`node "<PLUGIN>/cli/dev-spec.js" rules agents` into a Project's custom instructions (Claude Desktop has
no skills/rules file convention).

## Claude CoWork

Same as Claude Code (skills + MCP supported). If no project folder is mounted, the engine writes
`.specs/` in the workspace; move it into your repo afterwards.

## Cursor

- **MCP:** `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):
  ```json
  { "mcpServers": { "spec-driven": { "command": "node", "args": ["<PLUGIN>/mcp/server.js"] } } }
  ```
- **Rules:** [`.cursor/rules/dev-spec-driven.mdc`](./.cursor/rules/dev-spec-driven.mdc) ships in this
  repo (`alwaysApply: true`). For your own project, generate it with absolute paths:
  `mkdir -p .cursor/rules && node "<PLUGIN>/cli/dev-spec.js" rules cursor > .cursor/rules/dev-spec-driven.mdc`
  (PowerShell: the recipe at the top).

## Windsurf

- **MCP:** `~/.codeium/windsurf/mcp_config.json`:
  ```json
  { "mcpServers": { "spec-driven": { "command": "node", "args": ["<PLUGIN>/mcp/server.js"] } } }
  ```
- **Rules:** [`.windsurf/rules/dev-spec-driven.md`](./.windsurf/rules/dev-spec-driven.md)
  (`trigger: always_on`). For your own project:
  `mkdir -p .windsurf/rules && node "<PLUGIN>/cli/dev-spec.js" rules windsurf > .windsurf/rules/dev-spec-driven.md`
  (PowerShell: the recipe at the top).

## GitHub Copilot (VS Code, agent mode)

- **MCP:** `.vscode/mcp.json` in your workspace (note the `servers` key + `type`):
  ```json
  { "servers": { "spec-driven": { "type": "stdio", "command": "node", "args": ["<PLUGIN>/mcp/server.js"] } } }
  ```
  Enable agent mode and start the server from the MCP view.
- **Instructions:** [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) (a static
  file Copilot reads — **not** a GitHub Action, no CI, no cost). For your own repo:
  `mkdir -p .github && node "<PLUGIN>/cli/dev-spec.js" rules copilot > .github/copilot-instructions.md`
  (PowerShell: the recipe at the top).

## Gemini (Gemini CLI / Code Assist)

- **MCP:** `~/.gemini/settings.json` (or project `.gemini/settings.json`):
  ```json
  { "mcpServers": { "spec-driven": { "command": "node", "args": ["<PLUGIN>/mcp/server.js"] } } }
  ```
- **Instructions:** Gemini CLI reads `GEMINI.md` at the project root automatically. For your own project:
  `node "<PLUGIN>/cli/dev-spec.js" rules gemini > GEMINI.md` (PowerShell: the recipe at the top, which
  also keeps the file UTF-8).

## OpenAI Codex (Codex CLI)

- **MCP:** `~/.codex/config.toml` (single-quoted = literal path, safe on Windows):
  ```toml
  [mcp_servers.spec-driven]
  command = "node"
  args = ['<PLUGIN>/mcp/server.js']
  ```
- **Instructions:** Codex reads `AGENTS.md` at the project root automatically. For your own project:
  `node "<PLUGIN>/cli/dev-spec.js" rules agents > AGENTS.md` (PowerShell: the recipe at the top, which
  also keeps the file UTF-8).

## Any other MCP client (Cline, Roo, Zed, Continue, …)

Point it at a stdio server: `command: node`, `args: ["<PLUGIN>/mcp/server.js"]`. For instructions,
generate `AGENTS.md` with `rules agents` (many of these read it) or paste its output into the tool's
rules file.

## Plain CLI / shell / scripts (no MCP, no agent)

The engine is a normal CLI — usable in any environment:

```bash
node "<PLUGIN>/cli/dev-spec.js" classify "multi-tenant billing webhook with an LLM summary"
node "<PLUGIN>/cli/dev-spec.js" create "Invoice Summary" tdd saas ai
node "<PLUGIN>/cli/dev-spec.js" doctor "Invoice Summary"
node "<PLUGIN>/cli/dev-spec.js" evals "Invoice Summary" --dry-run
```

Optionally put it on PATH (`npm link` in this folder gives you a global `dev-spec`), then just
`dev-spec classify "…"`. Run `dev-spec help` for the full command list.

## Updating to a new version (every tool)

`git pull` in your clone (a Claude Code marketplace install: `/plugin marketplace update dev-spec-driven-marketplace`),
restart the tool or MCP client, then run the upgrade in each project that already has a `.specs/`:

```bash
node "<PLUGIN>/cli/dev-spec.js" upgrade           # the audit (read-only): every active feature against the new rules
node "<PLUGIN>/cli/dev-spec.js" upgrade --apply   # after the user agrees: the safe migrations + .specs/UPGRADE.md
```

Over MCP it is `spec_upgrade {}` then `spec_upgrade {apply: true}`. Claude Code runs it as `/spec-upgrade`, and its
session-start hook reminds you while `.specs/` comes from an older version; in other tools, run the audit yourself
after each update. Apply never edits a spec, approves or ticks anything. The review the audit recommends (the critic
for specs not implemented yet, the converge pass for half-done ones) runs inline where the tool has no subagents.

---

## What transfers where

| Capability | Claude Code | Other MCP tools | CLI / any tool |
|---|---|---|---|
| Engine tools (classify, scaffold, doctor, trace, EARS, approval gates and roles, evidence, impact, converge, import, catalog, drift, metrics, upgrade, templates, export, changelog, decisions) | ✅ MCP | ✅ MCP | ✅ CLI |
| Workflow methodology | ✅ skill | ✅ `AGENTS.md` / rules file | ✅ `AGENTS.md` |
| Slash commands (`/spec`, `/spec-doctor`, `/spec-impact`, …) | ✅ | ✅ as MCP prompts, where the client shows them (else the CLI) | — (use the CLI; `dev-spec prompts` prints one) |
| Spec resources (`specs://…`) | — (the files are in the project) | ✅ where the client supports resources | — |
| Hooks on save (EARS / traceability / design checks) + SessionStart status, drift, upgrade and overlap lines | ✅ | — (use git `pre-commit`, `dev-spec doctor`, `dev-spec drift`, `dev-spec upgrade`, `dev-spec roadmap`) | ✅ git pre-commit |
| End-of-turn evidence gate (a "done" claim with unverified ticks is sent back) | ✅ Stop / SubagentStop hook, on by default | — (run `dev-spec stop-check --message "…"` before claiming done) | — (`dev-spec stop-check`) |
| Guard mode (asks before code edits while no feature has approved tasks; `scope`: outside the plan too) | ✅ opt-in PreToolUse hook | — (`spec_init {guard}` stores the setting, but nothing enforces it) | — |
| Human approval guard (an agent's approval asks the user, or is refused) | ✅ opt-in PreToolUse hook (`approvalGuard` ask / deny) | — (`spec_init {approvalGuard}` stores the setting, but nothing enforces it) | — |
| Observed evidence (each reported run stamped `observed`; opt-in `evidence: "observed"` verifies only runs the harness saw) | ✅ PostToolUse / PostToolUseFailure hook on Bash | — (no hook: every reported run reads `observed: false` — under `"observed"`, record runs with `dev-spec done <f> <n> --run`) | ✅ `done --run` / `finish --run` (stamped `"cli"`) |
| Subagent execution (`/executeTask --subagents`) | ✅ | — (`dev-spec brief` per task, run inline) | — (`dev-spec brief`) |
| Eval harness | ✅ | ✅ (CLI) | ✅ CLI |

Claude-specific slash commands and hooks don't run inside other IDEs, but **every function they
trigger is available through `dev-spec` and the MCP tools** (and the commands themselves as MCP prompts in clients
that show them), so no capability is lost — only the invocation surface differs. The exceptions are the enforcing
hooks: guard mode is a Claude Code **hook** (PreToolUse, wired in `hooks/hooks.json`), so other tools can store the
setting but only Claude Code asks before a code edit — elsewhere, follow the rule in `AGENTS.md` (no implementation
before the tasks are approved); the approval guard is a PreToolUse hook as well (elsewhere approvals are the user's, as
`AGENTS.md` says); the observed-evidence log is a Claude Code hook on the Bash tool, so a project that opts into
`evidence: "observed"` records runs from other tools with `dev-spec done --run`; the end-of-turn evidence gate is a Stop / SubagentStop hook — elsewhere, the agent runs
`dev-spec stop-check` before claiming a task or feature is done, as `AGENTS.md` says. The PostToolUse and SessionStart
hooks are Claude Code only too; everything they report is also available on demand through `dev-spec ears` / `trace` /
`doctor` / `status` / `drift` / `upgrade` / `roadmap`.

Two CLI helpers set up the other tools: `dev-spec mcp-config <client>` prints the MCP config with this
clone's absolute path, and `dev-spec rules <tool>` prints the workflow rule file for your project (see
the top of this page).

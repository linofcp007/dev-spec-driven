# Integrations — use dev-spec-driven in any tool

The methodology travels through **three portable layers**, so it works far beyond Claude Code:

1. **MCP server** (`mcp/server.js`) — the open Model Context Protocol. Any MCP client gets the
   tools (`spec_classify`, `spec_init`, `spec_create`, `spec_doctor`, `trace_check`, `ears_validate`,
   `spec_approve`, …).
2. **Universal CLI** (`cli/dev-spec.js`) — the same engine from any terminal or tool, even without MCP.
3. **Instructions files** — `AGENTS.md` (cross-tool) plus per-tool rule files, so the agent follows
   the workflow.

Everything is **local, zero-dependency (Node ≥18), no GitHub Actions, no paid CI, no pull requests, no cost.**

> Tip: run `node cli/dev-spec.js mcp-config <client>` to print a ready-to-paste config with the
> correct absolute path already filled in. `<client>` = `claude-desktop`, `claude-code`, `cursor`,
> `windsurf`, `vscode`, `gemini`, `codex`, or `all`.
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
> merge the output into it instead of overwriting it).

Replace `<PLUGIN>` below with the absolute path to your clone of this repo (where you ran
`git clone https://github.com/linofcp007/dev-spec-driven.git`). Tip: `node cli/dev-spec.js mcp-config <client>`
prints the config with that path already filled in for your machine.

---

## Claude Code (CLI / IDE extension)

Native — it's a plugin. Skills, the 35 commands, the 3 agents, hooks, and the MCP server all load:

```bash
claude --plugin-dir "<PLUGIN>"
```

Or register just the MCP server: `claude mcp add spec-driven -- node "<PLUGIN>/mcp/server.js"`.
See [INSTALL.md](./INSTALL.md) for the persistent marketplace install.

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
  `node "<PLUGIN>/cli/dev-spec.js" rules cursor > .cursor/rules/dev-spec-driven.mdc`.

## Windsurf

- **MCP:** `~/.codeium/windsurf/mcp_config.json`:
  ```json
  { "mcpServers": { "spec-driven": { "command": "node", "args": ["<PLUGIN>/mcp/server.js"] } } }
  ```
- **Rules:** [`.windsurf/rules/dev-spec-driven.md`](./.windsurf/rules/dev-spec-driven.md)
  (`trigger: always_on`). For your own project:
  `node "<PLUGIN>/cli/dev-spec.js" rules windsurf > .windsurf/rules/dev-spec-driven.md`.

## GitHub Copilot (VS Code, agent mode)

- **MCP:** `.vscode/mcp.json` in your workspace (note the `servers` key + `type`):
  ```json
  { "servers": { "spec-driven": { "type": "stdio", "command": "node", "args": ["<PLUGIN>/mcp/server.js"] } } }
  ```
  Enable agent mode and start the server from the MCP view.
- **Instructions:** [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) (a static
  file Copilot reads — **not** a GitHub Action, no CI, no cost). For your own repo:
  `node "<PLUGIN>/cli/dev-spec.js" rules copilot > .github/copilot-instructions.md`.

## Gemini (Gemini CLI / Code Assist)

- **MCP:** `~/.gemini/settings.json` (or project `.gemini/settings.json`):
  ```json
  { "mcpServers": { "spec-driven": { "command": "node", "args": ["<PLUGIN>/mcp/server.js"] } } }
  ```
- **Instructions:** Gemini CLI reads `GEMINI.md` at the project root automatically. For your own project:
  `node "<PLUGIN>/cli/dev-spec.js" rules gemini > GEMINI.md`.

## OpenAI Codex (Codex CLI)

- **MCP:** `~/.codex/config.toml` (single-quoted = literal path, safe on Windows):
  ```toml
  [mcp_servers.spec-driven]
  command = "node"
  args = ['<PLUGIN>/mcp/server.js']
  ```
- **Instructions:** Codex reads `AGENTS.md` at the project root automatically. For your own project:
  `node "<PLUGIN>/cli/dev-spec.js" rules agents > AGENTS.md`.

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

---

## What transfers where

| Capability | Claude Code | Other MCP tools | CLI / any tool |
|---|---|---|---|
| Engine tools (classify, scaffold, doctor, trace, EARS) | ✅ MCP | ✅ MCP | ✅ CLI |
| Workflow methodology | ✅ skill | ✅ `AGENTS.md` / rules file | ✅ `AGENTS.md` |
| Slash commands (`/spec`, `/spec-doctor`, …) | ✅ | — (use the CLI instead) | — (use the CLI) |
| Hooks (auto EARS/trace on save) | ✅ | — (use git `pre-commit`) | ✅ git pre-commit |
| Eval harness | ✅ | ✅ (CLI) | ✅ CLI |

Claude-specific slash commands and hooks don't run inside other IDEs, but **every function they
trigger is available through `dev-spec` and the MCP tools**, so no capability is lost — only the
invocation surface differs.

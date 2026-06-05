# Ready-to-use MCP configs

These files are **templates**. Each `args` path is a placeholder —
`/ABSOLUTE/PATH/TO/dev-spec-driven/mcp/server.js` — because a global tool config (in your home
folder) needs the **absolute path to wherever _you_ installed this plugin**, which differs per machine.

Two ways to get a working config:

1. **Generate it (recommended)** — prints the config with the correct absolute path for *your* machine:
   ```bash
   node bin/dev-spec.js mcp-config <client>     # claude-desktop | cursor | windsurf | vscode | gemini | codex | all
   ```
2. **Copy a template and replace the placeholder** with your real path to `mcp/server.js`.

If the destination file already exists with other servers, **merge** the `spec-driven` entry instead
of overwriting.

| File | Tool | Copy / merge into (Windows path) |
|---|---|---|
| `claude-desktop.json` | Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` (Settings → Developer → Edit Config) |
| `cursor.mcp.json` | Cursor | project `.\.cursor\mcp.json`  **or** global `%USERPROFILE%\.cursor\mcp.json` |
| `windsurf.mcp_config.json` | Windsurf | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` |
| `vscode.mcp.json` | VS Code / GitHub Copilot (agent mode) | project `.\.vscode\mcp.json` |
| `gemini.settings.json` | Gemini CLI | `%USERPROFILE%\.gemini\settings.json` (or project `.gemini\settings.json`) |
| `codex.config.toml` | OpenAI Codex CLI | append to `%USERPROFILE%\.codex\config.toml` |

**Claude Code** doesn't need any of these — use the bundled plugin
(`claude --plugin-dir ./dev-spec-driven`, pointing at your local clone) or
`claude mcp add spec-driven -- node "/ABSOLUTE/PATH/TO/dev-spec-driven/mcp/server.js"`.

## Already live in this folder

If you open **this plugin folder itself** as a workspace, MCP is already wired via the root-level
`.cursor/mcp.json`, `.vscode/mcp.json`, and `.gemini/settings.json`. Those use a **path relative to the
workspace** (`mcp/server.js`, and `${workspaceFolder}/mcp/server.js` for VS Code), so they work on any
machine when this repo is the open project — no editing needed.

## Notes

- Forward slashes are valid in JSON and accepted by Node on Windows — no `\\` escaping needed.
- The server writes specs to `.specs/` in the directory the client launches it from (your project).
  To pin a project explicitly, add `"env": { "SPEC_PROJECT_DIR": "/path/to/your/project" }` to the
  server entry.
- After editing a config, restart the tool (or restart the MCP server from its UI). Verify the
  `spec-driven` tools appear. Full per-tool walkthrough: [`../INTEGRATIONS.md`](../INTEGRATIONS.md).

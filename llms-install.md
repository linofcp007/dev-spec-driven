# Installing dev-spec-driven (agents & Cline)

`dev-spec-driven` bundles a **local, zero-dependency MCP server** (Node.js ≥ 18, no
`npm install` step). It is distributed **as source**: clone the repository, then point your
MCP client at `mcp/server.js`. All tools are local file operations on `.specs/` — no network,
no API key.

## Steps

1. **Clone the repository** to a permanent location and note its absolute path:

   ```bash
   git clone https://github.com/linofcp007/dev-spec-driven.git
   # remember the absolute path, e.g. /home/you/dev-spec-driven (or C:\tools\dev-spec-driven)
   ```

2. **(Optional) Verify it runs** — no dependencies required:

   ```bash
   node /ABSOLUTE/PATH/dev-spec-driven/mcp/test.js   # ends `N passed, 0 failed`, exits 0 on success
   ```

3. **Register the server** with your MCP client. For **Cline**, add this to
   `cline_mcp_settings.json` (replace `/ABSOLUTE/PATH/` with the path from step 1):

   ```json
   {
     "mcpServers": {
       "spec-driven": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/dev-spec-driven/mcp/server.js"],
         "disabled": false
       }
     }
   }
   ```

   The same `mcpServers` shape works for Cursor, Claude Desktop, Windsurf, and Gemini. To print a
   ready-to-paste snippet with the absolute path already filled in for your machine:

   ```bash
   node /ABSOLUTE/PATH/dev-spec-driven/cli/dev-spec.js mcp-config cursor
   # clients: claude-code | claude-desktop | cursor | windsurf | vscode | gemini | codex | generic | all
   ```

4. **Reload the MCP client.** The server advertises **38 tools** over stdio — `spec_init`,
   `spec_classify`, `spec_create`, `spec_doctor`, `trace_check`, `ears_validate`, `spec_roadmap`,
   and more — for spec-driven development (EARS requirements → design → traceable tasks →
   approval-gated execution). It also offers MCP **prompts** (one per plugin command, for clients that show them as
   slash commands) and read-only **resources** (`specs://roadmap`, `specs://feature/{slug}/{artifact}`, …). To hide
   the prompts, add `"env": { "SPEC_MCP_PROMPTS": "off" }` to the server entry.

5. **(Optional) Give the agent the workflow.** `node /ABSOLUTE/PATH/dev-spec-driven/cli/dev-spec.js rules agents`
   prints `AGENTS.md` with absolute paths — paste it into the client's rules or custom instructions. Tools without
   Claude Code hooks should run `dev-spec stop-check --message "…"` (or the MCP tool `spec_stop_check`) before claiming a
   task is done (it is in there).

## Notes

- **Requirements:** Node.js ≥ 18. Nothing to install — zero runtime dependencies.
- **Privacy:** every operation is a local file op on `.specs/`; the server never reaches the network.
- **Transport:** stdio, newline-delimited JSON-RPC 2.0.
- **Updating:** `git pull` the clone and restart the client; in a project that already has a `.specs/`, call
  `spec_upgrade` (read-only audit against the new rules), then `spec_upgrade {apply: true}` once the user agrees
  (CLI: `dev-spec upgrade [--apply]`).

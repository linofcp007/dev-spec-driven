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
   node /ABSOLUTE/PATH/dev-spec-driven/mcp/test.js   # 55 assertions, exits 0 on success
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
   node /ABSOLUTE/PATH/dev-spec-driven/cli/dev-spec.js mcp-config generic
   # clients: claude-code | claude-desktop | cursor | windsurf | vscode | gemini | codex | all
   ```

4. **Reload the MCP client.** The server advertises **21 tools** over stdio — `spec_init`,
   `spec_classify`, `spec_create`, `spec_doctor`, `trace_check`, `ears_validate`, `spec_roadmap`,
   and more — for spec-driven development (EARS requirements → design → traceable tasks →
   approval-gated execution).

## Notes

- **Requirements:** Node.js ≥ 18. Nothing to install — zero runtime dependencies.
- **Privacy:** every operation is a local file op on `.specs/`; the server never reaches the network.
- **Transport:** stdio, newline-delimited JSON-RPC 2.0.

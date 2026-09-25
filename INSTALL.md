# Installing dev-spec-driven

This is a Claude Code **plugin** with a bundled **local MCP server**. It needs **Node.js** on your
PATH (the MCP server is plain Node — no `npm install`, no dependencies). Check with `node --version`
(v18+; tested on v24).

There is **no GitHub Actions and no cloud component** — nothing to configure remotely, nothing that
costs money per run.

---

## Option A — Install from GitHub (recommended)

Add the repo as a marketplace and install — works on any machine, no path editing:

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

Enable it when prompted; it auto-loads in future sessions. Verify:

- `/help` → you should see `/dev-spec-driven:*` commands.
- `/mcp` → you should see the **spec-driven** server connected with its 29 tools.

> You can also use the interactive `/plugin` menu: **Browse marketplaces → add `linofcp007/dev-spec-driven`
> → install dev-spec-driven**.

---

## Option B — Clone and try for one session

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

`--plugin-dir` accepts any path (relative or absolute) to your clone. The skill, the 42 commands, the 3 agents, the
hooks and the `spec-driven` MCP server (29 tools) load for that session.

> The rest of this guide uses a `$plugin` variable for your clone location. Set it once (PowerShell):
> ```powershell
> $plugin = (Resolve-Path ./dev-spec-driven).Path   # or wherever you cloned it
> ```

---

## Option C — Always-on from your local clone

Register the clone itself as a local marketplace, then install from it — it loads in every session
(after pulling new commits, refresh it with `/plugin marketplace update dev-spec-driven-marketplace`):

```text
/plugin marketplace add <path-to-your-clone>
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

(`dev-spec-driven-marketplace` is the `name` in `.claude-plugin/marketplace.json`.) Don't copy the folder
into `~/.claude/plugins/` by hand: that directory is Claude Code's marketplace cache, not an auto-load
location, so a manual copy never loads.

---

## Verify the MCP server independently

You don't need Claude to test the server — run the bundled smoke test:

```powershell
node "$plugin\mcp\test.js"
```

Expected tail: `N passed, 0 failed` and exit code 0 — N is the assertion count, which grows with every release
(the exact figure is in CHANGELOG.md); what matters is `0 failed`. The same goes for `node "$plugin\cli\test-cli.js"`.

To watch the raw protocol, you can pipe a request in by hand:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node "$plugin\mcp\server.js"
```

---

## How the MCP finds your project

The server resolves the project directory in this order:
1. `SPEC_PROJECT_DIR` (set by the plugin's `mcp/servers.json` to `${CLAUDE_PROJECT_DIR}`)
2. `CLAUDE_PROJECT_DIR`
3. the process working directory

Every tool also accepts an explicit `projectDir` argument if you ever need to override it. It writes
to `.specs/` in that project, and **never overwrites** existing files. An explicit `projectDir` must be a
local folder: a network path (`\\host\share`, `//host/share`) is refused, so a tool call can never point the
server at another machine. A project that lives on a share can still be the server's working directory
(or `SPEC_PROJECT_DIR`) — that is your own configuration, not a tool argument.

---

## Validate the plugin manifest

```powershell
claude plugin validate "$plugin\.claude-plugin\plugin.json"   # the plugin (manifest + its components)
claude plugin validate "$plugin"                               # the marketplace (.claude-plugin/marketplace.json)
claude plugin details dev-spec-driven
```

On the repo root, `validate` checks only the marketplace file (it is present), not the plugin itself —
validate the plugin through its `plugin.json`.

---

## Local automation (optional, all free)

**Hooks** load automatically with the plugin from the standard `hooks/hooks.json` (the manifest must
NOT also reference it, or Claude Code reports `Duplicate hooks file detected`): saving a
`requirements.md` lints EARS (and reports template placeholders), saving a `tasks.md` checks
traceability, saving a `design.md` checks the active tracks' mandatory sections, and session start
prints feature status plus one line per finished feature whose files drifted since `/spec-finish`. To
turn them off, disable the plugin (or empty `hooks/hooks.json`).

**Guard mode (opt-in, off by default).** A PreToolUse hook (`hooks/guard-hook.js`) that, once you turn
it on for a project, asks for confirmation before Claude writes or edits a code file outside `.specs/`
while no feature has approved, unfinished tasks. It stays silent when the guard is off and never blocks
on its own errors:

```powershell
node "$plugin\cli\dev-spec.js" init --guard on    # or /spec-guard, or spec_init {guard: true}; --guard off to disable
```

The setting lives in `.specs/roadmap.json` (`meta.guard`). Only Claude Code runs the hook; other tools
store the setting but don't enforce it.

**Git pre-commit validator** (blocks commits with EARS errors / phantom AC refs in the *staged*
content) — install inside your repo. The `[ -f … ] || exit 0` guard keeps commits working if the
plugin folder later moves:

```powershell
$hook = "$(git rev-parse --git-dir)/hooks/pre-commit"
Set-Content $hook "#!/bin/sh`n[ -f `"$plugin/hooks/precommit-check.js`" ] || exit 0`nnode `"$plugin/hooks/precommit-check.js`" || exit 1"
```

**Eval harness** (+ai features) — run live with your own key, or offline with `--dry-run`:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # only for a live run
node "$plugin\mcp\evals\run-evals.js" <feature> --dry-run
```

No GitHub Actions, no cloud — everything above runs on your machine.

## Use it in other tools (Cursor, Windsurf, Copilot, Gemini, Codex, …)

This plugin works far beyond Claude Code via its MCP server, the universal `dev-spec` CLI, and
`AGENTS.md`. For per-tool setup and exact MCP configs, see **[INTEGRATIONS.md](./INTEGRATIONS.md)**,
or generate a config instantly (prints the correct absolute path for your machine):

```powershell
node "$plugin\cli\dev-spec.js" mcp-config all
node "$plugin\cli\dev-spec.js" rules cursor    # the workflow rule file for your project (also windsurf|copilot|gemini|agents)
```

To save a rule file into your project, use the recipe in INTEGRATIONS.md → *Rule files for your own
project*. In Windows PowerShell 5.1, a plain `>` writes UTF-16.

The CLI also runs standalone in any shell — `node cli/dev-spec.js help`.

## Uninstall

```text
/plugin uninstall dev-spec-driven
```

or just stop passing `--plugin-dir`. The four predecessor skills live in git history and the v1.8.0
release if you ever want them back.

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
- `/mcp` → you should see the **spec-driven** server connected with its tools.

> You can also use the interactive `/plugin` menu: **Browse marketplaces → add `linofcp007/dev-spec-driven`
> → install dev-spec-driven**.

---

## Option B — Clone and try for one session

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

`--plugin-dir` accepts any path (relative or absolute) to your clone. The skill, the 31 commands, and
the `spec-driven` MCP server load for that session.

> The rest of this guide uses a `$plugin` variable for your clone location. Set it once (PowerShell):
> ```powershell
> $plugin = (Resolve-Path ./dev-spec-driven).Path   # or wherever you cloned it
> ```

---

## Option C — Make it always-on for this user

Copy the plugin into your user plugins directory so it loads automatically:

```powershell
$dest = "$env:USERPROFILE\.claude\plugins\dev-spec-driven"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Recurse -Force "$plugin\*" $dest
```

(The GitHub marketplace flow in Option A is the supported path and is recommended over manual copying.)

---

## Verify the MCP server independently

You don't need Claude to test the server — run the bundled smoke test:

```powershell
node "$plugin\mcp\test.js"
```

Expected tail: `55 passed, 0 failed`. (And `node "$plugin\bin\test-cli.js"` → `34 passed, 0 failed`.)

To watch the raw protocol, you can pipe a request in by hand:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node "$plugin\mcp\server.js"
```

---

## How the MCP finds your project

The server resolves the project directory in this order:
1. `SPEC_PROJECT_DIR` (set by `.mcp.json` to `${CLAUDE_PROJECT_DIR}`)
2. `CLAUDE_PROJECT_DIR`
3. the process working directory

Every tool also accepts an explicit `projectDir` argument if you ever need to override it. It writes
to `.specs/` in that project, and **never overwrites** existing files.

---

## Validate the plugin manifest

```powershell
claude plugin validate "$plugin"
claude plugin details dev-spec-driven
```

---

## Local automation (optional, all free)

**Hooks** load automatically with the plugin (`hooks/hooks.json`): saving a `requirements.md`
lints EARS, saving a `tasks.md` checks traceability, and session start prints feature status. To
turn them off, remove the `"hooks"` line from `.claude-plugin/plugin.json` (or disable the plugin).

**Git pre-commit validator** (blocks commits with EARS errors / phantom AC refs) — install inside
your repo:

```powershell
$hook = "$(git rev-parse --git-dir)/hooks/pre-commit"
Set-Content $hook "#!/bin/sh`nnode `"$plugin/hooks/precommit-check.js`" || exit 1"
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
node "$plugin\bin\dev-spec.js" mcp-config all
```

The CLI also runs standalone in any shell — `node bin/dev-spec.js help`.

## Uninstall

```text
/plugin uninstall dev-spec-driven
```

or just stop passing `--plugin-dir`. The originals remain in `_archive/` if you ever want them back.

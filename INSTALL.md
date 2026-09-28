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
- `/mcp` → you should see the **spec-driven** server connected with its 35 tools.

> You can also use the interactive `/plugin` menu: **Browse marketplaces → add `linofcp007/dev-spec-driven`
> → install dev-spec-driven**.

---

## Option B — Clone and try for one session

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

`--plugin-dir` accepts any path (relative or absolute) to your clone. The skill, the 52 commands, the 3 agents, the
hooks and the `spec-driven` MCP server (35 tools) load for that session.

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

Besides `tools/list`, the server answers `prompts/list` / `prompts/get` (one prompt per plugin command) and
`resources/list` / `resources/read` (the project's specs as `specs://` URIs) — see INTEGRATIONS.md.

**On Linux too (optional, needs Docker):** `npm run test:docker` (from the clone) runs both suites in Linux containers
— Node 18, 22 and 24 — with the plugin mounted read-only and no network; only the first run needs network, to pull the
images. It exits 0 when every suite passed, 1 on a failure and 2 when Docker isn't available. Nothing is installed on
your machine and nothing runs remotely.

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

The plugin check ends with `Validation passed with warnings` and one warning — `CLAUDE.md at the plugin root is not
loaded as project context`. That is expected: `CLAUDE.md` holds the maintainers' notes for working on the plugin
itself, not context for your projects (the workflow ships as the skill). Any other warning or error is worth a look.

---

## Local automation (optional, all free)

**Hooks** load automatically with the plugin from the standard `hooks/hooks.json` (the manifest must
NOT also reference it, or Claude Code reports `Duplicate hooks file detected`): saving a
`requirements.md` lints EARS (and reports template placeholders), saving a `tasks.md` checks
traceability, saving a `design.md` checks the active tracks' mandatory sections, and session start
prints feature status plus one line per finished feature whose files drifted since `/spec-finish` (one line while
`.specs/` comes from an older dev-spec — see *Updating* — and one when two features' open tasks plan the same files). To
turn them off, disable the plugin (or empty `hooks/hooks.json`).

**Evidence gate at the end of a turn (on by default).** A Stop hook (`hooks/stop-hook.js`, also on SubagentStop for the
`spec-implementer` agent) sends Claude back to work — once — when its closing message says a task or feature is done or
verified while a feature active in the last hours has ticked tasks without passing evidence. It is silent otherwise and
never blocks on its own errors. To turn it off for a project:

```powershell
node "$plugin\cli\dev-spec.js" init --stop-check off   # or spec_init {stopCheck: false}; --stop-check on to re-enable
```

Other tools don't run the hook; `dev-spec stop-check --message "<text>"` gives the same verdict on demand.

**Guard mode (opt-in, off by default).** A PreToolUse hook (`hooks/guard-hook.js`) that, once you turn
it on for a project, asks for confirmation before Claude writes or edits a code file outside `.specs/`
while no feature has approved, unfinished tasks. It stays silent when the guard is off and never blocks
on its own errors:

```powershell
node "$plugin\cli\dev-spec.js" init --guard on    # or /spec-guard, or spec_init {guard: "on"}; --guard off to disable
node "$plugin\cli\dev-spec.js" init --guard scope # stricter: once tasks are approved, also a code file no open task names
```

The setting lives in `.specs/roadmap.json` (`meta.guard`). Only Claude Code runs the hook; other tools
store the setting but don't enforce it.

**Observed evidence (the log is always on; the rule is opt-in).** A PostToolUse hook (`hooks/observe-hook.js`, the Bash tool — and PowerShell when it reports an exit code)
silently logs each run of a task's `_Verify:_` command or a project check to a git-ignored `.execution/observed.jsonl`,
so every recorded run says whether Claude Code actually saw it (`observed`). To verify tasks only with runs the
harness saw (or that `dev-spec done --run` made):

```powershell
node "$plugin\cli\dev-spec.js" init --evidence observed   # or spec_init {evidence: "observed"}; --evidence reported to go back
```

**Human approval guard (opt-in, off by default).** A PreToolUse hook (`hooks/approval-hook.js`) that makes approvals a
human act: when Claude calls `spec_approve` (even with force), runs `dev-spec approve` / `feature remove --yes`, or tries
to lower the guard, you are asked (`ask`) or the call is refused (`deny` — you approve yourself, in your terminal or with
Claude Code's `!` prefix):

```powershell
node "$plugin\cli\dev-spec.js" init --approval-guard deny   # or ask; off to disable (only you can lower it)
```

`ask` relies on Claude Code's permission prompt, which auto / bypass permission modes may skip; `deny` holds in every mode.
Both are guardrails, not a sandbox, and only Claude Code runs these hooks.

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

## Updating

1. **Update the plugin.** Options A and C: `/plugin marketplace update dev-spec-driven-marketplace` (for C, `git pull`
   in the clone first), then restart Claude Code. Option B or another tool: `git pull` in the clone, then restart the
   session / MCP client.
2. **Upgrade each project that already has a `.specs/`.** The session-start hook prints one line while `.specs/`
   comes from an older version (`roadmap.json → meta.specVersion` absent or older than the plugin). Run
   `/spec-upgrade` in Claude Code, or from any shell:

   ```powershell
   node "$plugin\cli\dev-spec.js" upgrade           # the audit, read-only: every active feature against the new rules
   node "$plugin\cli\dev-spec.js" upgrade --apply   # the safe migrations + the checklist .specs/UPGRADE.md
   ```

   The audit groups the features (blocked · needs attention · ok) with their status, what the current rules flag,
   the next step and the review to run (the `spec-critic` agent for specs not implemented yet, the converge pass for
   half-done ones). `--apply` saves inferred tracks, gives each pre-1.13 approval a history baseline when its file
   still matches what was approved, completes `.specs/.gitignore` and stamps `meta.specVersion`. It never edits a
   spec, approves, ticks or deletes anything, and a second run changes nothing.

## Uninstall

```text
/plugin uninstall dev-spec-driven
```

or just stop passing `--plugin-dir`. The four predecessor skills live in git history and the v1.8.0
release if you ever want them back.

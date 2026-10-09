# Installing dev-spec-driven

A Claude Code **plugin** with a bundled **local MCP server**. It needs **Node.js** v18 or later on your PATH
(`node --version`; 18 is end-of-life — 20 or later is recommended) and nothing else: no `npm install`, no dependencies.
Its hooks need **Claude Code 2.1.139 or later** (`claude --version`): they run in exec form — `node` started directly
with the hook's script, no shell per call — which older versions don't read (their hooks would not run).

There is **no GitHub Actions and no cloud component** — nothing to configure remotely, nothing that costs money per run.
Using another tool (Claude Desktop, Cursor, Windsurf, Copilot, Gemini CLI, Codex CLI)? See [INTEGRATIONS.md](./INTEGRATIONS.md).

## Install

**A — from GitHub (recommended).** Works on any machine, no paths to edit (or use the `/plugin` menu: Browse
marketplaces → add `linofcp007/dev-spec-driven` → install). Enable it when prompted; it loads in every session from then on.

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

**B — a clone, for one session:** `git clone https://github.com/linofcp007/dev-spec-driven.git`, then
`claude --plugin-dir ./dev-spec-driven` (any path to the clone, relative or absolute).

**C — always on from your clone.** Register the clone itself as a local marketplace, then install from it (after a
`git pull`, refresh it with `/plugin marketplace update dev-spec-driven-marketplace`):

```text
/plugin marketplace add <path-to-your-clone>
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

(`dev-spec-driven-marketplace` is the `name` in `.claude-plugin/marketplace.json`.) Don't copy the folder into
`~/.claude/plugins/` by hand: that is Claude Code's marketplace cache, not an auto-load location — a copy never loads.

**Check it.** `/help` lists the `/dev-spec-driven:*` commands and `/mcp` the **spec-driven** server with its tools —
all but `spec_stop_check` and `spec_log` (the plugin's Stop hook and CLI do their job; both stay callable). The skill,
the 5 agents and the hooks load with it. New here? `/dev-spec-driven:spec-tour` takes one tiny real change on your
repository through every gate.

## Your plugin folder (`$plugin`)

The commands below use `$plugin` for the folder the plugin runs from. With `--plugin-dir` (option B) it is your clone.
**Installed from a marketplace (option A or C)**, Claude Code runs its own copy in the plugin cache —
`~/.claude/plugins/cache/dev-spec-driven-marketplace/dev-spec-driven/<version>/` — and that folder **changes on every
update** (a new version folder; the old one goes away). Read it from Claude Code's record of the install — the same
`node` line in both shells:

```powershell
$plugin = node -p "require(require('os').homedir() + '/.claude/plugins/installed_plugins.json').plugins['dev-spec-driven@dev-spec-driven-marketplace'][0].installPath"
```

```bash
plugin=$(node -p "require(require('os').homedir() + '/.claude/plugins/installed_plugins.json').plugins['dev-spec-driven@dev-spec-driven-marketplace'][0].installPath")
```

(With `CLAUDE_CONFIG_DIR` set, that file lives under it instead of `~/.claude`.) Run it again after every
`/plugin marketplace update`: what you set up with the old path — the pre-commit validator, the merge driver — still
points at the removed folder until you refresh it (each section below says how).

## Verify the MCP server

No Claude needed: `node "$plugin\mcp\test.js"` and `node "$plugin\cli\test-cli.js"` each end `N passed, 0 failed` and
exit 0 (N grows with every release; what matters is `0 failed`). The raw protocol:
`'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node "$plugin\mcp\server.js"` — it also answers `prompts/*` (one
prompt per command) and `resources/*` (the specs as `specs://` URIs; INTEGRATIONS.md). On Linux too, with Docker:
`npm run test:docker` from the clone runs both suites in containers (Node 18, 22, 24; read-only mount, no network after
the first pull) and exits 0 / 1 on a failure / 2 without Docker.

## How the MCP finds your project

In this order: `SPEC_PROJECT_DIR` (the plugin's `mcp/servers.json` sets it to `${CLAUDE_PROJECT_DIR}`) ·
`CLAUDE_PROJECT_DIR` · the client's first local workspace root (MCP `roots` — VS Code reports them) · the nearest folder at
or above the working directory that holds a dev-spec `.specs/` · the working directory. A variable the client left
unexpanded (`${workspaceFolder}`, `%CD%`) counts as not set. Every tool also takes an explicit `projectDir` — an existing
local folder (only `spec_init` creates one), a path or a local `file://` URI; a network path (`\\host\share`) is refused,
so a tool call never points the server at another machine. It writes only under `.specs/` and **never overwrites** a file.

## Local automation (optional, all free)

**Hooks** load with the plugin from the standard `hooks/hooks.json` (a manifest that also names it gets `Duplicate hooks
file detected`): saving a `requirements.md` lints EARS and placeholders, a `tasks.md` checks traceability, a `design.md`
the active tracks' mandatory sections; session start prints feature status, drift since `/spec-finish`, an outdated
`.specs/` and features whose open tasks plan the same files. Each hook is `node` started directly (exec form): on Windows
a shell-form hook cost +~40 ms (Git Bash) to +~300 ms (PowerShell) a call. Disable the plugin to turn them off.

**Evidence gate at the end of a turn (on by default).** A Stop hook (`hooks/stop-hook.js`, also on SubagentStop for the
`spec-implementer` and `spec-simplifier` agents, checked on their reports) sends Claude back to work — once — when its
closing message says a task or feature is done or verified while a feature active in the last hours has ticked tasks
without passing evidence. Silent otherwise; never blocks on its own errors. Off for a project:
`node "$plugin\cli\dev-spec.js" init --stop-check off` (`spec_init {stopCheck: false}`). Other tools:
`dev-spec stop-check --message "<text>"` gives the same verdict.

**Guard mode (opt-in).** A PreToolUse hook (`hooks/guard-hook.js`) asks before Claude writes a code file outside `.specs/`
while no feature has approved, unfinished tasks — through Write / Edit or a Bash / PowerShell command that writes one
(`sed -i`, a redirect, `tee`, `Set-Content`…; reads, test runs, builds and git don't prompt); in a monorepo the nearest
`.specs/` counts. `scope` also asks, once tasks are approved, for a code file no open task names. Only Claude Code runs it:

```powershell
node "$plugin\cli\dev-spec.js" init --guard on    # or scope; off to disable — or /spec-setup guard, spec_init {guard}
```

**Observed evidence (the log is always on; the rule is opt-in).** A PostToolUse hook (`hooks/observe-hook.js` — Bash,
and PowerShell when it reports an exit code) silently logs each run of a `_Verify:_` command or a project check to a
git-ignored `.execution/observed.jsonl`, so every recorded run says whether Claude Code saw it. `init --evidence observed`
then verifies a task only with such a run, or one `dev-spec done --run` made. It is only as strong as the approval guard:
with that off, an agent appending one line to the log forges a run (`init` and doctor's `observed-unguarded` say so).
A run Claude Code logged no exit code for (the PowerShell tool alone): record it with `dev-spec done <feature> <n> --run`.

**Human approval guard (opt-in, off by default).** A PreToolUse hook (`hooks/approval-hook.js`) that makes approvals a
human act: when Claude calls `spec_approve` (even with force), runs `dev-spec approve` / `feature remove --yes`, tries
to lower the guard, or writes the spec state itself (`.specs/roadmap.json`, a feature's `.state.json`, the observed log —
through Write / Edit, another MCP server's file tools, or a shell command: a redirect, a writer, a glob, a link to
`.specs/`), you are asked (`ask`) or the call is refused (`deny` — you approve yourself, in your terminal or with Claude
Code's `!` prefix):

```powershell
node "$plugin\cli\dev-spec.js" init --approval-guard deny   # or ask; off to disable (only you can lower it)
```

`ask` relies on Claude Code's permission prompt, which auto mode still shows and only bypass-permissions mode may skip.
`deny` is refused in auto mode too — but a session in bypass-permissions mode, or with hooks disabled, runs no hook at all.

**What the guards are — and aren't.** They stop accidents and casual workarounds, not a determined agent with a shell.
They read each command as text (nothing is run or evaluated) and ask whenever a command names dev-spec or `.specs/` in a
form they can't follow. Known limits: an inline script or a script file the agent wrote (`node -e`, `python -c`,
`./x.sh`), a variable, alias or function defined in an earlier command, encoded or downloaded text fed to a shell
(`… | base64 -d | bash`), a copy of the CLI under another name, git forms whose files can't be known from the command
(`git apply`, `git stash pop`, `git reset --hard`, a branch switch), an archive extracted into the project root, and a
link to `.specs/` made by one of those routes. In other MCP clients the MCP server enforces the same setting itself: a
client that supports MCP elicitation shows you the question (Approve + an optional note) and only your explicit approve
records it; a client without it runs `ask` as before and refuses `deny` with the command to run yourself.

**Teams: a merge driver for the spec state (opt-in, once per clone).** Two branches that both approve phases, tick tasks
or record evidence change the same `.state.json` / `roadmap.json`; `merge-state --install` makes git merge them
semantically (both sides united; a real conflict stays valid JSON under `mergeConflicts`, and doctor fails until you
resolve it). Commit the `.gitattributes` it writes; every teammate runs it once (git config is per clone):

```powershell
node "$plugin\cli\dev-spec.js" merge-state --install   # --check: does git's driver still run this plugin's CLI? --uninstall
```

**Re-run `--install` after each plugin update**: git runs the driver by the CLI's path, which a marketplace update moves.
With the old folder gone, git reports a conflict on the spec state and keeps only your side — `git add` would drop the
other branch's approvals and evidence. `--check` exits 1 then, and the session-start status says so.

**Plan-mode bridge (always on).** When you approve a plan in Claude Code's plan mode inside a dev-spec project
(`hooks/plan-hook.js`), Claude is reminded it can become a spec — `/spec-adopt import` (`spec_import {tool: "plan", text}`,
CLI `dev-spec import plan - < plan.md`); plan mode keeps plans outside the project. It never imports by itself.

**Status line (opt-in).** `dev-spec statusline` prints one line for Claude Code's status bar — the feature under way, its
tasks, unverified ticks and the next step (`◆ billing · 4/9 tasks · 1 unverified · next: approve tasks`), no tokens.
`/spec-setup statusline` sets it up after you confirm (by hand: `statusline --print-config` prints the entry for
`~/.claude/settings.json` or `.claude/settings.local.json`); from a marketplace install it survives plugin updates.

**Your defaults (environment variables).** Fallbacks where a project's `.specs/roadmap.json` sets nothing — put them in
the `env` block of `~/.claude/settings.json` or a project's `.claude/settings.local.json` (Claude Code hands it to the
hooks, the MCP server and the commands), elsewhere in your shell or the MCP config's `env`:

| Variable | Default | What it does |
|---|---|---|
| `DEV_SPEC_DEFAULT_LANG` | unset (= en) | The language of a NEW project (`en`, `pt`, `pt-BR`, `es`) — seeded into `meta.lang`, so it travels with the project |
| `DEV_SPEC_STOP_CHECK` | on | `off` turns the end-of-turn evidence gate off where `meta.stopCheck` isn't set |
| `DEV_SPEC_GUARD_DEFAULT` | off | Guard mode (`off` / `on` / `scope`) where `meta.guard` isn't set |

**Git pre-commit validator** (blocks commits with EARS errors / phantom AC refs in the *staged* content) — install
inside your repo. The `[ -f … ]` guard keeps commits working if the plugin folder later moves — and says so on every
commit, instead of silently checking nothing:

```powershell
$hook = "$(git rev-parse --git-dir)/hooks/pre-commit"
Set-Content $hook "#!/bin/sh`n[ -f `"$plugin/hooks/precommit-check.js`" ] || { echo `"dev-spec pre-commit: $plugin is gone - re-install this hook`" >&2; exit 0; }`nnode `"$plugin/hooks/precommit-check.js`" || exit 1"
```

**Re-install it after each plugin update** when `$plugin` is a marketplace install: the hook names that version's
folder, which the update removes — find the folder again ([Your plugin folder](#your-plugin-folder-plugin)) and re-run
the two lines above. A hook that names a clone you update with `git pull` keeps working.

**Eval harness** (+ai features) — live with your own `ANTHROPIC_API_KEY`, or offline:
`node "$plugin\mcp\evals\run-evals.js" <feature> --dry-run`.

## Other tools and the CLI

The MCP server, the `dev-spec` CLI and `AGENTS.md` carry the workflow beyond Claude Code — see
**[INTEGRATIONS.md](./INTEGRATIONS.md)**, or let the CLI print a config or a rule file with this machine's path:
`node "$plugin\cli\dev-spec.js" mcp-config all` · `rules cursor` (or windsurf, copilot, gemini, agents). To save a rule
file into your project, use the recipe in INTEGRATIONS.md → *Rule files for your own project*. In
Windows PowerShell 5.1, a plain `>` writes UTF-16. The CLI runs in any shell — `node cli/dev-spec.js help`.

## Shell completion

Commands, flags, their values (`--lang`, `--size`, the phases of `approve`…) and the project's feature names. Save the
script once and load it from your profile (`completion --help` prints these lines with your path filled in):

```powershell
node "$plugin\cli\dev-spec.js" completion powershell > "$HOME\dev-spec-completion.ps1"; Add-Content $PROFILE '. "$HOME\dev-spec-completion.ps1"'
```

```bash
node "$plugin/cli/dev-spec.js" completion bash > ~/.dev-spec-completion.bash && echo '. ~/.dev-spec-completion.bash' >> ~/.bashrc
node "$plugin/cli/dev-spec.js" completion zsh > ~/.dev-spec-completion.zsh && echo '. ~/.dev-spec-completion.zsh' >> ~/.zshrc   # after compinit
node "$plugin/cli/dev-spec.js" completion fish > ~/.config/fish/conf.d/dev-spec.fish
```

The script also defines `dev-spec` (a plugin install puts none on PATH) and finds the newest installed version after an
update; save it again to complete a new version's commands. In PowerShell, type a letter after `-` before Tab.

## A slow file system (Docker bind mount, network drive, WSL on `/mnt/c`)

Every hook and CLI call loads the engine — about 36 files, tens of milliseconds each on a slow file system. Build it as
ONE file with `node "<plugin clone>/cli/dev-spec.js" bundle` (git-ignored `mcp/lib/spec.bundle.js`; a read-only clone:
`bundle --out <path>` + `DEV_SPEC_BUNDLE_PATH=<path>`) and set `DEV_SPEC_BUNDLE=1` where Claude Code or your MCP client
starts — same results, 0.65 s → 0.25 s a call on a Docker Desktop bind mount. Rebuild after each plugin update: a stale
bundle is ignored, silently. On a local disk leave it unset.

## Validate the plugin manifest

```powershell
claude plugin validate "$plugin\.claude-plugin\plugin.json"   # the plugin (manifest + its components)
claude plugin validate "$plugin"                               # the marketplace (.claude-plugin/marketplace.json)
```

On the repo root, `validate` checks only the marketplace file — validate the plugin through its `plugin.json`. It ends
with `Validation passed with warnings` and one warning, `CLAUDE.md at the plugin root is not loaded as project context` —
expected: `CLAUDE.md` holds the maintainers' notes, not context for your projects. Any other warning is worth a look.

## Updating

1. **Update the plugin.** Options A and C: `/plugin marketplace update dev-spec-driven-marketplace` (for C, `git pull`
   in the clone first), then restart Claude Code. Option B or another tool: `git pull`, then restart the session / client.
2. **Upgrade each project that has a `.specs/`** (the session-start hook reminds you): `/spec-upgrade`, or
   `node "$plugin\cli\dev-spec.js" upgrade` — a read-only audit (every active feature: what the current rules flag, the
   next step, the review to run); `upgrade --apply`, after your OK, saves inferred tracks, baselines pre-1.13 approvals and
   stamps `meta.specVersion`. It never edits a spec, approves, ticks or deletes anything.
3. **Refresh what names the old folder** (a marketplace install): `merge-state --install`, the pre-commit hook, a bundle.

From 1.25 or earlier: the slash commands were renamed — the table is in
[README.md → Upgrading](./README.md#upgrading-from-125-or-earlier); your specs need no change.

## Troubleshooting

- **No `/dev-spec-driven:*` commands** — check `/plugin` (installed and enabled?) and restart Claude Code. A folder copied
  into `~/.claude/plugins/` by hand never loads: install from a marketplace (option A or C) or use `--plugin-dir`.
- **The hooks don't run** (no EARS lint on save, no session-start status) — `claude --version` must be 2.1.139 or later;
  bypass-permissions mode and disabled hooks run none. `Duplicate hooks file detected`: a manifest that also names
  `hooks/hooks.json` — the standard file loads on its own.
- **An old command name** (`/spec-init`, `/spec-ff`, `/prReview`…) — 1.26 renamed it: README.md → Upgrading.
- **The pre-commit hook says the plugin folder is gone, or `merge-state --check` exits 1** — an update moved the folder:
  find it again ([Your plugin folder](#your-plugin-folder-plugin)) and re-install.
- **Every hook or CLI call is slow** — see [A slow file system](#a-slow-file-system-docker-bind-mount-network-drive-wsl-on-mntc).
- **A rule file written from PowerShell 5.1 is garbled** — `>` wrote UTF-16; use INTEGRATIONS.md's `cmd /c` recipe.
- **The specs landed in another folder** — [How the MCP finds your project](#how-the-mcp-finds-your-project); or pass `projectDir`.

## Uninstall

`/plugin uninstall dev-spec-driven`, or stop passing `--plugin-dir`. The four predecessor skills are in git history (v1.8.0).

# Installing dev-spec-driven

This is a Claude Code **plugin** with a bundled **local MCP server**. It needs **Node.js** on your
PATH (the MCP server is plain Node — no `npm install`, no dependencies). Check with `node --version`
(v18+; tested on v24). Its hooks need **Claude Code 2.1.139 or later** (`claude --version`): they run in exec form — `node`
started directly with the hook's script, no shell per call — which older versions don't read (their hooks would not run).

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
- `/mcp` → you should see the **spec-driven** server connected with its 38 tools.

> You can also use the interactive `/plugin` menu: **Browse marketplaces → add `linofcp007/dev-spec-driven`
> → install dev-spec-driven**.

---

## Option B — Clone and try for one session

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

`--plugin-dir` accepts any path (relative or absolute) to your clone. The skill, the 55 commands, the 4 agents, the
hooks and the `spec-driven` MCP server (38 tools) load for that session.

> The rest of this guide uses a `$plugin` variable for the plugin's folder — here, your clone. Set it once (PowerShell):
> ```powershell
> $plugin = (Resolve-Path ./dev-spec-driven).Path   # or wherever you cloned it
> ```
> Installed from a marketplace (Option A or C) instead? See [Your plugin folder](#your-plugin-folder-plugin) below.

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

## Your plugin folder (`$plugin`)

The commands in this guide use `$plugin` for the folder the plugin runs from. With a clone loaded by `--plugin-dir`
(Option B) it is the clone. **Installed from a marketplace (Option A or C)**, Claude Code runs its own copy in the plugin
cache — `~/.claude/plugins/cache/dev-spec-driven-marketplace/dev-spec-driven/<version>/` — and that folder **changes on
every update** (a new version folder; the old one goes away). Read it from Claude Code's record of the install — the same
`node` line in both shells:

```powershell
$plugin = node -p "require(require('os').homedir() + '/.claude/plugins/installed_plugins.json').plugins['dev-spec-driven@dev-spec-driven-marketplace'][0].installPath"
$plugin   # e.g. C:\Users\you\.claude\plugins\cache\dev-spec-driven-marketplace\dev-spec-driven\<version>
```

```bash
plugin=$(node -p "require(require('os').homedir() + '/.claude/plugins/installed_plugins.json').plugins['dev-spec-driven@dev-spec-driven-marketplace'][0].installPath")
echo "$plugin"
```

(With `CLAUDE_CONFIG_DIR` set, that file lives under it instead of `~/.claude`.) Run it again after every
`/plugin marketplace update`: whatever you set up with the old path — the git pre-commit validator, the merge driver, a
status line — still points at the removed folder until you refresh it (each section below says how).

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
3. the client's first local workspace root, when the client reports its roots (MCP `roots` — VS Code does)
4. the nearest folder at or above the process working directory that holds a dev-spec `.specs/`
5. the process working directory

A variable the client left unexpanded (`${workspaceFolder}`, `$HOME`, `%CD%`) counts as not set.
Every tool also accepts an explicit `projectDir` argument if you ever need to override it. It writes
to `.specs/` in that project, and **never overwrites** existing files. An explicit `projectDir` must name an
existing local folder (only `spec_init` creates one — a mistyped path is refused, never created), as a path or a
local `file://` URI; a relative one is read from the client's root when the roots chose the project. A network
path (`\\host\share`, `//host/share`) is refused, so a tool call can never point the
server at another machine. A project that lives on a share can still be the server's working directory
(or `SPEC_PROJECT_DIR`) — that is your own configuration, not a tool argument.

---

## A slow file system (Docker bind mount, network drive, WSL on `/mnt/c`)

Every hook and CLI call is a fresh Node process that loads the engine — about 36 files. When the plugin's clone sits on
a slow file system (a Docker Desktop bind mount, a network drive, WSL reading a Windows folder), each file can cost tens
of milliseconds. Build the engine as ONE file, then tell the plugin to load it:

```bash
node "<plugin clone>/cli/dev-spec.js" bundle     # writes <plugin clone>/mcp/lib/spec.bundle.js (git-ignored; npm run build:bundle does the same)
# a read-only clone (a container's mount): write it elsewhere and point at it
node "<plugin clone>/cli/dev-spec.js" bundle --out /tmp/dev-spec/spec.bundle.js
```

Then set `DEV_SPEC_BUNDLE=1` (and, with `--out`, `DEV_SPEC_BUNDLE_PATH=<that absolute path>`) in the environment Claude
Code or your MCP client starts with — your shell profile, or the server's `env` in an MCP config. Same code, same results;
on a Docker Desktop bind mount loading the engine went from about 0.65 s to 0.25 s per call. **Build it once after each
plugin update**, in the environment that runs it (inside the container, for a container): a bundle whose version or files
no longer match the installed plugin — an update, even to the same version, or an edit — is ignored and the modules load
as usual, silently. On a local disk it makes little difference: leave it unset there.

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
itself (an index over `docs/maintainers/`), not context for your projects (the workflow ships as the skill). Any other
warning or error is worth a look.

---

## Local automation (optional, all free)

**Hooks** load automatically with the plugin from the standard `hooks/hooks.json` (the manifest must
NOT also reference it, or Claude Code reports `Duplicate hooks file detected`): saving a
`requirements.md` lints EARS (and reports template placeholders), saving a `tasks.md` checks
traceability, saving a `design.md` checks the active tracks' mandatory sections, and session start
prints feature status plus one line per finished feature whose files drifted since `/spec-finish` (one line while
`.specs/` comes from an older dev-spec — see *Updating* — and one when two features' open tasks plan the same files). To
turn them off, disable the plugin (or empty `hooks/hooks.json`). Each hook is `node` started directly with its script (exec
form, Claude Code 2.1.139+): on Windows a shell-form hook went through Git Bash (+~40 ms a call) or, without Git Bash,
PowerShell (+~300 ms a call), and a Write / Edit runs three hooks.

**Evidence gate at the end of a turn (on by default).** A Stop hook (`hooks/stop-hook.js`, also on SubagentStop for the
`spec-implementer` and `spec-simplifier` agents, checked on their reports) sends Claude back to work — once — when its closing message says a task or feature is done or
verified while a feature active in the last hours has ticked tasks without passing evidence. It is silent otherwise and
never blocks on its own errors. To turn it off for a project:

```powershell
node "$plugin\cli\dev-spec.js" init --stop-check off   # or spec_init {stopCheck: false}; --stop-check on to re-enable
```

Other tools don't run the hook; `dev-spec stop-check --message "<text>"` gives the same verdict on demand.

**Guard mode (opt-in, off by default).** A PreToolUse hook (`hooks/guard-hook.js`) that, once you turn
it on for a project, asks for confirmation before Claude writes or edits a code file outside `.specs/`
while no feature has approved, unfinished tasks — through Write / Edit and (1.25.1) a Bash / PowerShell command that
writes one (`sed -i`, a redirect, `tee`, `cp`, `Set-Content`…; reads, test runs, builds and git don't prompt). In a
monorepo the nearest `.specs/` above the edited file counts too. It stays silent when the guard is off and never blocks
on its own errors:

```powershell
node "$plugin\cli\dev-spec.js" init --guard on    # or /spec-guard, or spec_init {guard: "on"}; --guard off to disable
node "$plugin\cli\dev-spec.js" init --guard scope # stricter: once tasks are approved, also a code file no open task names
```

The setting lives in `.specs/roadmap.json` (`meta.guard`). Only Claude Code runs the hook; other tools
store the setting but don't enforce it.

**Observed evidence (the log is always on; the rule is opt-in).** A PostToolUse hook (`hooks/observe-hook.js`, the Bash tool — and PowerShell when it reports an exit code)
silently logs each run of a task's `_Verify:_` command or a project check to a git-ignored `.execution/observed.jsonl`,
so every recorded run says whether Claude Code actually saw it (`observed`). It runs in the background (`async`): Claude
never waits for it — in a headless `claude -p` session, the run made just before the session ends may go unlogged. To
verify tasks only with runs the harness saw (or that `dev-spec done --run` made):

```powershell
node "$plugin\cli\dev-spec.js" init --evidence observed   # or spec_init {evidence: "observed"}; --evidence reported to go back
```

Observed evidence is only as strong as the approval guard below: with it off, an agent appending one line to
`.execution/observed.jsonl` forges an observed run (`init` and `dev-spec doctor` — `observed-unguarded` — say so). Turn
the approval guard on with it. With the PowerShell tool alone (Windows without Git Bash) a run is logged only when Claude
Code reports its exit code — record the others with `dev-spec done <feature> <n> --run`.

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

**Teams: a merge driver for the spec state (opt-in, once per clone).** Two branches that both approve phases, tick tasks or
record evidence change the same `.specs/<feature>/.state.json` and `.specs/roadmap.json` — a plain git merge conflicts on
them. `merge-state --install` makes git merge them semantically (approvals, ticks, evidence and history of both branches
united; a real conflict — a setting both branches changed differently — stays valid JSON, listed under `mergeConflicts`,
and `dev-spec doctor` fails until you resolve it):

```powershell
node "$plugin\cli\dev-spec.js" merge-state --install   # writes .gitattributes (commit it) + this clone's git config
```

Commit `.gitattributes`; every teammate runs `--install` once in their clone (git config is per clone — without it git
falls back to its text merge). `--uninstall` removes both.

**Re-run `merge-state --install` after each plugin update.** Git runs the driver by the CLI's path, and a plugin install
lives in a versioned folder (`plugins/cache/<marketplace>/dev-spec-driven/<version>/`): after an update the configured
path points at the old folder. When it no longer exists, git reports a conflict on the spec state and keeps only your
side — `git add` would then drop the other branch's approvals and evidence. `merge-state --check` tells (exit 1 when the
driver runs another or a missing script), and the session-start status adds one line when it happens:

```powershell
node "$plugin\cli\dev-spec.js" merge-state --check     # read-only: does git's driver still run this plugin's CLI?
node "$plugin\cli\dev-spec.js" merge-state --install   # points it at the current plugin folder again
```

**Plan-mode bridge (always on, one line of context).** A PostToolUse hook on `ExitPlanMode` (`hooks/plan-hook.js`): when
you approve a plan in Claude Code's plan mode inside a dev-spec project, Claude is reminded that the plan can become a spec
— `/spec-import` with the plan's text (`spec_import {tool: "plan", text}`, CLI `dev-spec import plan - < plan.md`), since
plan mode keeps plans in `~/.claude/plans`, outside the project. It never imports by itself and is silent elsewhere.

**Status line (opt-in).** `dev-spec statusline` prints one line for Claude Code's status bar — the feature with work under
way, its tasks, unverified ticks and the next step (`◆ billing · 4/9 tasks · 1 unverified · next: approve tasks`), in the
project language, and nothing outside a dev-spec project. `/spec-statusline` sets it up after you confirm; by hand:

```powershell
node "$plugin\cli\dev-spec.js" statusline --print-config   # prints the "statusLine" entry with this clone's absolute path
```

Put that entry in `~/.claude/settings.json` (every project) or a project's `.claude/settings.local.json` (the path is this
machine's — keep it out of a committed `.claude/settings.json`). A plugin installed from a git marketplace lives in a
versioned cache folder: there the printed command finds the newest installed version at each run, so it survives plugin
updates (1.25.1). It reads `.specs/` (at Phase 4 also the few test files
the test plan names — never a repo walk, never a network folder), names the same next step as `/next-action` (it doesn't
check drift, so a finished feature reads "finished", not "clean"), exits 0 always and costs no tokens.

**Your defaults (environment variables, 1.16).** Three optional settings for every project that doesn't set its own —
each is a fallback; a project's `.specs/roadmap.json` always wins:

| Variable | Default | What it does |
|---|---|---|
| `DEV_SPEC_DEFAULT_LANG` | unset (= en) | The language a NEW project gets when `/spec-init` or its first feature names none (`en`, `pt`, `pt-BR`, `es`) — seeded into `meta.lang`, so the project keeps it on every machine. A project that has a language, or already has features, keeps its own. |
| `DEV_SPEC_STOP_CHECK` | on | `off` switches the end-of-turn evidence gate off for every project that doesn't set `meta.stopCheck` itself (`init --stop-check on\|off` pins a project). |
| `DEV_SPEC_GUARD_DEFAULT` | off | Guard mode (`off` / `on` / `scope`) for every project that doesn't set `meta.guard` (`/spec-guard` pins a project). |

In Claude Code put them in the `env` block of `~/.claude/settings.json` (you, every project) or a project's
`.claude/settings.local.json` — Claude Code hands that block to the hooks, the MCP server and the commands Claude runs, so
all three see the same values:

```json
{ "env": { "DEV_SPEC_DEFAULT_LANG": "pt", "DEV_SPEC_GUARD_DEFAULT": "scope" } }
```

Elsewhere set them in your shell or in the other tool's MCP config `env`. An empty or invalid value changes nothing.
(The plugin declares no `userConfig`: that would open a configuration dialog on every install, and it would reach neither
the CLI nor other MCP clients.)

**Git pre-commit validator** (blocks commits with EARS errors / phantom AC refs in the *staged*
content) — install inside your repo. The `[ -f … ]` guard keeps commits working if the plugin folder later moves — and
says so on every commit, instead of silently checking nothing:

```powershell
$hook = "$(git rev-parse --git-dir)/hooks/pre-commit"
Set-Content $hook "#!/bin/sh`n[ -f `"$plugin/hooks/precommit-check.js`" ] || { echo `"dev-spec pre-commit: $plugin is gone - re-install this hook`" >&2; exit 0; }`nnode `"$plugin/hooks/precommit-check.js`" || exit 1"
```

**Re-install it after each plugin update** when `$plugin` is a marketplace install: the hook names that version's
folder, which the update removes — find the folder again ([Your plugin folder](#your-plugin-folder-plugin)) and re-run
the two lines above. A hook that names a clone you update with `git pull` keeps working.

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

## Shell completion

Tab completion for the CLI — the commands, their flags, the values they take (`--lang`, `--flow`, `--size`, the phases of
`approve`, the tracks of `add-track`…) and the feature names of the project you are in. Save the script once, then load it
from your shell's profile (`$plugin` as in [Your plugin folder](#your-plugin-folder-plugin)):

**PowerShell** (Windows PowerShell 5.1 or PowerShell 7):

```powershell
node "$plugin\cli\dev-spec.js" completion powershell > "$HOME\dev-spec-completion.ps1"
Add-Content $PROFILE '. "$HOME\dev-spec-completion.ps1"'    # or add that line to $PROFILE by hand (notepad $PROFILE)
```

**bash** / **zsh** / **fish**:

```bash
node "$plugin/cli/dev-spec.js" completion bash > ~/.dev-spec-completion.bash && echo '. ~/.dev-spec-completion.bash' >> ~/.bashrc
node "$plugin/cli/dev-spec.js" completion zsh > ~/.dev-spec-completion.zsh && echo '. ~/.dev-spec-completion.zsh' >> ~/.zshrc   # after compinit
node "$plugin/cli/dev-spec.js" completion fish > ~/.config/fish/conf.d/dev-spec.fish
```

Open a new shell and type `dev-spec st<Tab>`, `dev-spec status <Tab>`. A plugin install puts no `dev-spec` on PATH, so the
script also defines `dev-spec` itself (it runs this CLI with `node`); with a `dev-spec` already on PATH (`npm link`) it only
adds the completion. Feature names are read from the project's `.specs/` on each Tab (a `--project` on the line counts), in
about the time Node takes to start — the engine is not loaded. After a plugin update the script finds the newest installed
version by itself (feature names and the `dev-spec` command keep working); save it again to complete the new version's
commands and flags. `node "$plugin/cli/dev-spec.js" completion --help` prints these lines with your path filled in. (In
PowerShell, type a letter after `-` or `--` before Tab: a bare `-` is PowerShell's own parameter syntax.)

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

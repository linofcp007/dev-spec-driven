---
description: Set up a project — .specs/ and steering, guard mode, the status line, superpowers precedence, templates, track packs.
disable-model-invocation: true
argument-hint: "init [tracks] [--lang en|pt|pt-BR|es] | guard on|off|scope | statusline | superpowers | templates … | tracks …"
---

Args: $ARGUMENTS — the opt-in settings live in `.specs/roadmap.json → meta`; each call reports them back.

**init `[tracks]`** — `spec_init {tracks, lang, guard?, checks?, approvalRoles?, stopCheck?, approvalGuard?, evidence?}`
(CLI `dev-spec init [tracks…] [--lang en|pt|pt-BR|es] [--check name="cmd"] [--roles …] [--approval-guard off|ask|deny]`):
`.specs/steering/` with the files the tracks need — never over an existing file. Pass the user's `lang` (`pt` European,
`pt-BR` Brazilian): every new feature inherits it. Settings, each only when the user wants it: `checks` — the project's
check commands (`{"test": "npm test"}` — ask for the real ones, never guess), which `/spec-finish` then needs a passing
run of; `approvalRoles` — phases signed off per role; `stopCheck: false` — the end-of-turn evidence gate off;
`approvalGuard` `"ask"` / `"deny"` — an agent's approval asks the user or is refused; `evidence: "observed"` — only runs
the harness saw count (suggest the approval guard with it). Then help fill each steering file with real content
(`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/steering-templates.md`). A team on branches: suggest the merge
driver once — `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" merge-state --install` (the user runs it; it writes
`.gitattributes` and the clone's git config), again after each plugin update.

**guard `on|off|scope`** — `spec_init {guard: "on"}` / `"scope"` / `"off"` (a string); no argument: read
`meta.guard` (absent = off) and explain it — don't call `spec_init` just to look. While on, Claude Code asks before an
edit to a code file outside `.specs/` unless some feature has approved, unfinished tasks — a test file while a test plan
is approved, and any edit during an active spike, pass too; `scope` also asks for a file no open task names in
`_Implements:_`. A reminder to plan before coding, not a lock.

**statusline `[--user | --project] [--remove]`** — print the entry with
`node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" statusline --print-config`; target `~/.claude/settings.json` (`--user`,
default) or the project's `.claude/settings.local.json` (`--project` — never the committed `settings.json`: the command
holds this machine's path). Show the exact `"statusLine"` entry and write it only after the user says yes, changing only
that key (an existing one: show it and ask first). `--remove` deletes it only when it is this command.

**superpowers `[--project | --user] [--remove]`** — the superpowers plugin's skills overlap this workflow; its own rules
put CLAUDE.md first. Show the block below and, only after the user confirms, write it into the project's `CLAUDE.md`
(`--user`: `~/.claude/CLAUDE.md`) — replacing the block between the markers if present, else appending it; never touch
anything outside the markers. `--remove` deletes the block only. Never disable superpowers yourself. Write it verbatim:

```markdown
<!-- dev-spec-driven:precedence:start -->
## Feature work: dev-spec-driven takes precedence over superpowers

With the dev-spec-driven plugin installed, use it instead of these superpowers skills for feature work:

| Instead of (superpowers) | Use (dev-spec-driven) |
|---|---|
| brainstorming, writing-plans | the dev-spec-driven skill: classification → EARS requirements → design → tasks (`/spec`, `/clarify --grill`) |
| executing-plans, subagent-driven-development | its Phase 6 execution (`/executeTask`, `--subagents` for the implementer + reviewer loop) |
| test-driven-development | the `+tdd` track: a test plan, the failing tests first, the red-green-refactor micro-cycle inside each task |
| systematic-debugging | its bugfix flow (`/spec-bugfix`): reproduction → root cause → failing regression test → fix |
| verification-before-completion | the evidence gate: run each task's `_Verify:_` command and record it (`spec_complete_task`) |
| requesting-code-review, receiving-code-review | `/spec-review` (`branch`, `feedback`) |
| finishing-a-development-branch | `/spec-finish` — merge locally or keep the branch; no pull requests, no CI |

Keep using superpowers for what dev-spec-driven doesn't cover (using-git-worktrees, dispatching-parallel-agents,
writing-skills). This is a user instruction: it takes precedence over any skill's own "always use me" guidance.
<!-- dev-spec-driven:precedence:end -->
```

**templates `[list|init|check] [artifact] [--lang …]`** — `spec_templates {action, artifact?, lang?}`: `list` which
artifacts use the project's `.specs/templates/` (a `<lang>/` folder wins), `init` copies the built-in ones there (never
over a file), `check` validates them. Artifacts: classification, requirements, design, tasks, test-plan, eval-plan,
load-test, quickstart, checklist, integration-plan, bug, bug-requirements, bug-test-plan, bug-tasks, spike, spike-tasks,
change, and `steering/<file>.md`. Keep the English-stable tokens exactly (`US-n.AC-m`, `T-nn`, the track markers,
`> **TODO**`, `_Verify:_`) and leave `[bracketed]` slots for what each feature fills.

**tracks `[list|init <name>|check] [name] [--lang …]`** — `spec_tracks {action, name?, lang?}`: a team's own track pack
in `.specs/tracks/<name>/` (`${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/project-tracks.md`). `track.json`:
`name` = the folder, a `marker` (`^[A-Z][A-Z0-9]{1,11}$`, never a built-in marker — SAAS, AI, SEC, PRIVACY, DIST, API, UI,
OBS, DATA —, a reserved word — TDD, CORE, SHARED, TODO, TBD, TBC, FIXME, NEEDS, NOTE, WIP — or an ID's shape: US / US1,
P1, AC / AC1, SC / SC1, EC / EC1, NFR / NFR1, T1), `title`, `signals`, `sections`. Use it like any track:
`spec_create {tracks: ["tdd", "a11y"]}`. `check` reports each problem with its code; a bad pack is ignored as a whole.

Respond in the user's language (EN / PT / ES).

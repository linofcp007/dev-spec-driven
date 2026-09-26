# dev-spec-driven — agent instructions (tool-agnostic)

This file is the portable version of the dev-spec-driven workflow. Any agent tool that reads an
instructions file — **Codex CLI, Gemini CLI, Cursor, Windsurf, Copilot, Claude, Zed, Cline, …** —
can follow it. The full reference lives in `skills/dev-spec-driven/SKILL.md` and
`skills/dev-spec-driven/references/`.

> Paths in this file point into the dev-spec-driven clone. `node cli/dev-spec.js rules agents` prints this file with those paths made absolute — the copy to use in your own project (re-run it if the clone moves).

> **Language:** detect the user's language and respond in it (English, Português, Español),
> including the prose inside generated artifacts. Pass `--lang en|pt|es` to `dev-spec init`
> (sets the project default) and `dev-spec create` (per feature; inherits the project default) so
> the scaffolds, steering and tool messages come out already localized — you only fill the
> placeholders. Keep structural tokens stable (AC IDs like `US-1.AC-1`, task markers
> `_Requirements:_`, track names `core/+tdd/+saas/+ai`). EARS keywords work in all three:
> `SHALL`/`DEVE`/`DEBE`, `WHEN`/`QUANDO`/`CUANDO`, etc.

## What this is

Spec-driven development that scales rigor to the feature. You classify each feature into composable
**tracks**, then run an approval-gated pipeline producing traceable artifacts in `.specs/`.

| Track | Adds | Turn on when |
|---|---|---|
| **core** *(always)* | EARS requirements → design → tasks → execute | every Spec-mode feature |
| **+tdd** | test plan + failing-tests-first + red→green→refactor | correctness matters / hard to undo |
| **+saas** | performance/scale/multi-tenancy/observability/cost + load test | multi-tenant, hot path, prod scale |
| **+ai** | eval-driven dev, prompts-as-code, token economics, safety | quality depends on LLM/agent output |

Tracks combine (e.g. a billing webhook in a multi-tenant SaaS that calls an LLM = `core +tdd +saas +ai`).
The chosen tracks are stored with the feature (`.specs/<feature>/.state.json`); change them with
`dev-spec add-track` (add, or `--remove` to turn one off — no file is deleted).

## The engine: CLI and/or MCP (both local, zero-cost, no CI)

Do the mechanical steps with the bundled engine instead of hand-editing files. Two equivalent ways:

- **CLI (works anywhere):** `node cli/dev-spec.js <command>` (or `dev-spec <command>` if on PATH).
- **MCP (if your tool speaks MCP):** the `spec-driven` server exposes the same operations as 29 tools.

Key operations (CLI form):

```
dev-spec classify "<feature description>" [--name "<feature>"]   # recommend tracks (multilingual, weighted)
dev-spec init [tracks...] [--lang en|pt|es] [--guard on|off]   # scaffold .specs/steering (incl. constitution.md); --lang sets the project default
dev-spec steering <file> [--lang]              # one steering file from its template (constitution.md, tech.md, …) or a custom scoped one (api-rules.md)
dev-spec create "<name>" [tracks...] [--lang] [--summary "…"] [--brownfield]  # scaffold the feature (no tracks → auto-classify; --brownfield → integration-plan.md)
dev-spec bugfix "<name>" [--summary "…"]       # bugfix flow: reproduce → root cause → regression test → fix
dev-spec import <kiro|spec-kit|openspec> <path> [--name "<feature>"] [--tracks …]   # another tool's spec → a NEW feature (IDs remapped)
dev-spec status [feature] | list               # progress, phase, tracks, sections filled vs present
dev-spec clarify <feature>                      # surface requirement gaps before design
dev-spec doctor <feature>                      # health-check → ready to advance? (exit 1 on FAIL — scriptable)
dev-spec ears <feature|file.md>                # lint EARS (SHALL/DEVE/DEBE, IDs, vague words, placeholders); --text "…" or - (stdin) for a snippet
dev-spec trace <feature> [--code]              # AC ↔ task ↔ test ↔ code (_Implements:_, phantom refs, EC/NFR/SC warnings); --code finds T-IDs in test files
dev-spec next <feature> [--batch]              # next task (--batch: + the [P] tasks that can run beside it)
dev-spec next-action <feature>                 # "you are here → do this next", phase by phase: re-review → fill → fix → approve (then the next phase) → implement → verify → finish
dev-spec brief <feature> [n] [--write]         # self-contained brief for one task (ACs + tests resolved, scoped steering, DoD)
dev-spec done <feature> <n> --run              # run the task's _Verify:_ command and record the evidence (failure → stays open)
dev-spec approve <feature> <phase> [--force]   # record an approval gate — refused while that phase's checks fail
dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen]   # what an edit after approval touches; --reopen unticks affected done tasks (never a removed AC's: retire lists those)
dev-spec append-tasks <feature> --task "…" [--req US-1.AC-2] [--implements path] [--verify "<cmd>"]   # converge: append a task (Phase: Convergence)
dev-spec finish <feature> [--write] [--include-body]   # blockers + fresh checks + merge summary from the spec chain (merge locally; no PRs)
dev-spec metrics [feature] [--write]           # lead times, rework, forced approvals, change requests, evidence pass rate (--write → retro.md)
dev-spec add-track <feature> <track> [--remove]   # add a track (additive, never overwrites); --remove takes one off, files kept
dev-spec feature <archive|restore|rename|remove> <name> [new-name] [--yes]   # lifecycle; remove is destructive and needs --yes
dev-spec catalog [--write]                     # living catalog of every feature's ACs (_Supersedes:_ marks replaced ones) → .specs/SPECS.md
dev-spec drift [feature]                       # implementing files changed / missing / new since finish recorded its baseline (exit 1 on drift or a stale baseline)
dev-spec roadmap                               # multi-feature roadmap: %, dependencies, cycles
dev-spec depend <feature> [deps...]            # show / set dependencies (rejects cycles); --add / --rm <dep>, --clear, --order N
dev-spec backlog [add|rm "<name>" ["note"]]    # planned-but-unspecced features (shown in ROADMAP.md)
dev-spec scan [path]  /  dev-spec coverage     # brownfield: routes, tests, entrypoints, env var names, migrations + % of code named in _Implements:_
dev-spec evals <feature> [--dry-run]           # run local eval harness (+ai; your API key)
dev-spec mcp-config [client]                   # print MCP config for your tool
dev-spec rules <cursor|windsurf|copilot|gemini|agents>   # print that tool's rule file with this clone's absolute paths
```

## The pipeline (Spec mode)

For anything beyond a quick fix (Vibe mode = just do it, no artifacts) or a contained change to an existing
flow (Bounded mode = a short design in chat and an explicit yes, no artifacts):

0. **Classify** — `dev-spec classify` to seed tracks; confirm against `skills/dev-spec-driven/references/classification-matrix.md`. Get user approval of the mode and track set (a real defect → `dev-spec bugfix` instead; a spec written for Kiro, spec-kit or OpenSpec → `dev-spec import`). After approval: `dev-spec init <tracks> --lang <xx>` if `.specs/steering/` is missing, then `dev-spec create "<name>" <tracks> --lang <xx>` once — it seeds `.specs/<feature>/classification.md`, where you record the decision (add `--brownfield` when the feature lands in existing code).
1. **Requirements** — fill the scaffolded `requirements.md`: EARS criteria with stable AC IDs; run `dev-spec ears` to lint and `dev-spec clarify` for gaps. Add track-specific ACs (tenant isolation for +saas; quality/safety/cost for +ai). Approve.
2. **Design** — base sections + the mandatory sections of the active tracks (5 for +saas, 10 for +ai). The scaffold marks each with a `> **TODO**` sentinel; replace it with real content. No blank mandatory sections. Approve.
3. **Test/Eval plan** — +tdd: enumerate tests mapped to AC IDs (Kind `example` or `property`). +ai: golden/adversarial/regression sets + thresholds + baseline. Approve.
4. **Failing tests / eval harness** — +tdd: write tests, all red for the right reason (hard gate); put the T-ID in the test name so `dev-spec trace --code` finds it. +ai: deterministic tests + runnable eval harness + baseline. No implementation before this passes — record the sign-off with `dev-spec approve <feature> tests` (the engine tracks it: `next-action` asks for it and `gatesOk` / `finish` count it; a bugfix has no such gate, its regression test is a task).
5. **Tasks** — ordered, traceable; markers `_Requirements:_` and `_Verify: <command>_` always (+tdd: the command that runs that task's own tests — the full suite stays red until the last task), `_Makes green:_` (+tdd), `_Emits metrics:_` (+saas), `_Affects evals:_` (+ai). Run `dev-spec trace` — every AC must map to a task.
6. **Execute** — per task: implement-and-test (core) / red→green→refactor (+tdd) / prompt-iteration gated on eval delta (+ai). `dev-spec brief <feature>` gives you the task with its ACs, tests and matching steering already resolved — handy to focus, or to hand one task to another agent. Mark done with `dev-spec done <feature> <n> --run` (MCP: `spec_complete_task`) — the only way to tick a task; evidence before claims: the task's `_Verify:_` command runs and its result is recorded; a failure leaves the task open and stays recorded; for a task whose `_Verify:_` names a runnable command, a text note alone (`--evidence "…"` without `--cmd "…" --exit 0`) ticks it but leaves it unverified (a task with no runnable `_Verify:_` can be attested by that note). Close the feature with `dev-spec finish`. (In Claude Code, `/executeTask --subagents` runs an implementer + reviewer subagent per task — see `skills/dev-spec-driven/references/subagent-execution.md`; tools without subagents run inline.) Before "done": load test + observability (+saas), cost + safety validation (+ai).

At each phase boundary, run `dev-spec doctor <feature>`; only advance when it reports
`readyToAdvance`. Record sign-off with `dev-spec approve <feature> <phase>`. When unsure what comes
next, `dev-spec next-action <feature>` names the single next step.

## Gates and evidence

- **Approval is a gate.** `dev-spec approve` runs that phase's checks first (EARS errors, template
  placeholders, open `[NEEDS CLARIFICATION]`, missing sections, uncovered ACs, phantom IDs …) and refuses
  while any fails, listing them. Fix them and approve again. `--force` records it anyway as a *forced*
  approval with the failing checks; `doctor` and the roadmap keep flagging it — use it only when the user
  explicitly accepts the gap.
- **A template is not content.** `doctor`'s `placeholders` check fails while the current (or an earlier)
  phase's artifact still holds template placeholders; a fresh feature starts at phase `requirements`.
- **Evidence rules.** A task whose `_Verify:_` holds a runnable command counts as verified only with
  that command and exit code 0. A note ticks it but leaves it unverified; a failed run is recorded and
  keeps the task unverified until a later passing run; evidence goes stale when the spec behind the
  task changes (`impact --reopen`) or its `_Verify:_` command is edited. `done --json` (MCP
  `spec_complete_task`) returns a stable reason code in `unverifiedReason` (`no-evidence`, `failed-run`,
  `manual-note-on-runnable-verify`, `duplicate-number`, `stale-evidence`) whenever `verified` is false;
  `doctor`, `finish` and the `ROADMAP.md` "Needs attention" line list each unverified task with a localized
  reason. A task with no runnable `_Verify:_` and nothing recorded comes back `verified: true` with
  `nothingToVerify: true` — the same verdict doctor gives; a note records how it was checked.
- **Bugfix iron law.** For a `dev-spec bugfix` feature, `doctor` fails until `bug.md` → Root Cause is
  written, and the tasks after the root-cause task can't be completed before that.
- **`dev-spec finish` blocks** on doctor failures, an artifact changed since its approval, placeholders
  anywhere in the chain, open or unverified tasks and pending approvals. Warnings (uncovered EC/NFR/SC
  IDs, planned tests no test file names) never block.

## When the spec changes

- **Every approval is kept.** Approvals are appended to `.state.json` and snapshot the artifact into
  `.specs/<feature>/.history/<phase>@<n>.md` — commit these with the spec.
- **Impact before re-approval.** After editing an approved artifact, run
  `dev-spec impact <feature> --phase requirements|design|test-plan|eval-plan|tasks`: it lists the changed ACs / sections /
  tests / tasks and, for each, the tasks that cite it, the tests covering it and the design sections mentioning
  it. `--reopen` unticks the affected done tasks and marks their evidence stale — never the tasks of a
  removed criterion: `retire` lists them (and their test rows) to delete or point at the criterion that
  replaces it; then re-review and re-approve.
- **Converge.** When implementation drifted from the plan or a review found follow-up work, append tasks
  with `dev-spec append-tasks` instead of editing the numbered list by hand: they go under
  `Phase: Convergence`, numbered after the last task; unknown AC IDs are refused, and an approved task
  list needs re-approval.
- **Living catalog.** `dev-spec catalog --write` keeps `.specs/SPECS.md` — every feature's ACs, "what the
  system does today". A criterion that replaces an older feature's one declares
  `_Supersedes: <feature>/US-n.AC-m_` on its line; `trace` warns when the reference resolves to nothing.
- **Drift.** `dev-spec finish <feature> --write` on a ready feature records a hash of its `_Implements:_`
  files; `dev-spec drift` later reports the files changed, missing or new since then.
- **Archive, don't delete.** `dev-spec feature archive` is reversible (`feature restore` brings back the
  roadmap entry and the dependencies archive pruned); `feature remove` deletes and needs `--yes`.

## Steering, import and guard mode

- **Scoped steering.** A steering file may start with front matter: `inclusion: always`, `fileMatch` (with
  `fileMatchPattern: "src/api/**"`) or `manual`. `dev-spec brief` includes the `fileMatch` files whose
  pattern matches the task's `_Implements:_` paths and lists `manual` ones as available.
- **Import.** `dev-spec import <kiro|spec-kit|openspec> <path>` turns a spec written for another tool into
  a new feature: criteria become `US-N.AC-M` (EARS where possible, else `[NEEDS CLARIFICATION]`), tasks are
  renumbered keeping their checkbox state. The source must be inside the project and is never modified.
- **Guard mode is a Claude Code hook.** `dev-spec init --guard on` sets it, but only Claude Code runs the
  PreToolUse hook that asks before code edits while no feature has approved, unfinished tasks. In other
  tools, follow the same rule yourself: no implementation before the tasks are approved.
- **Alongside superpowers.** If the superpowers skills are installed in your tool too, this workflow replaces
  their planning, TDD, debugging, execution, verification, review and branch-finishing skills for feature work.
  Put the precedence block from `commands/spec-superpowers.md` into your rules / `AGENTS.md` to make it stick.

## Non-negotiables

- **No implementation without approval** at each gate.
- **Traceability end-to-end**: code → tasks → (tests/evals) → design → requirements → need.
- **Mandatory track sections are mandatory** — an honest "not needed because X" is fine; blank is not.
- **Evidence before claims** — a task is done when its `_Verify:_` run passed, not when someone says so.
- **Everything is local. No GitHub Actions, no paid CI, no pull requests** — integrate by merging locally. Tests/load/evals run in the user's own env.

See `skills/dev-spec-driven/references/` for EARS, scale, eval, safety, and prompt-engineering guides.

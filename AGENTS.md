# dev-spec-driven — agent instructions (tool-agnostic)

This file is the portable version of the dev-spec-driven workflow. Any agent tool that reads an
instructions file — **Codex CLI, Gemini CLI, Cursor, Windsurf, Copilot, Claude, Zed, Cline, …** —
can follow it. The full reference lives in `skills/dev-spec-driven/SKILL.md` and
`skills/dev-spec-driven/references/`.

> Paths in this file point into the dev-spec-driven clone. `node cli/dev-spec.js rules agents` prints this file with those paths made absolute — the copy to use in your own project (re-run it if the clone moves).

> **Language:** detect the user's language and respond in it (English, Português — European or
> Brazilian —, Español), including the prose inside generated artifacts. Pass `--lang en|pt|pt-BR|es` to
> `dev-spec init` (sets the project default) and `dev-spec create` (per feature; inherits the project default) so
> the scaffolds, steering and tool messages come out already localized — you only fill the
> placeholders. Keep structural tokens stable (AC IDs like `US-1.AC-1`, task markers
> `_Requirements:_`, track names `core/+tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data`). EARS keywords work in every one of them:
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
| **+sec** | threat model, security requirements, authn/authz, secrets & keys, security testing | auth, secrets, untrusted input, an attack surface |
| **+privacy** | personal data inventory, lawful basis, retention & deletion, data subject rights, processors & transfers, DPIA | personal data (GDPR / RGPD / HIPAA) |
| **+dist** | consistency model, cross-system (dual) writes, delivery & idempotency, concurrency, failure modes | one write reaches more than one system (DB + broker / cache / another service): Kafka, outbox, saga, microservices, retries, race conditions |
| **+api** | API contract, versioning & compatibility, error model (problem+json), pagination / idempotency / concurrency, rate limits & quotas | a public / partner / internal API others code against: OpenAPI, GraphQL, gRPC, versioning, breaking changes, SDKs |
| **+ui** | design-system usage, UI states, accessibility (WCAG 2.2 AA), responsiveness & i18n, a UI performance budget | a user-facing screen: a design system, accessibility, a screen reader, responsive layout, dark mode, a settings / admin page |
| **+obs** | SLIs & SLOs, telemetry, alerting & runbooks, rollout & rollback, health & capacity | a service people depend on: SLOs, error budgets, alerting, on-call, runbooks, OpenTelemetry, feature flags, canary releases |
| **+data** | data contracts & schema evolution, data quality, pipeline idempotency & backfills, lineage & ownership, retention & cost | data that moves between stores on a schedule or a stream: ETL / ELT, a data warehouse / lake, dbt, Airflow, Spark, data-quality checks, backfills, lineage |

Tracks combine (e.g. a billing webhook in a multi-tenant SaaS that calls an LLM = `core +tdd +saas +ai`).
The chosen tracks are stored with the feature (`.specs/<feature>/.state.json`); change them with
`dev-spec add-track` (add, or `--remove` to turn one off — no file is deleted).

## The engine: CLI and/or MCP (both local, zero-cost, no CI)

Do the mechanical steps with the bundled engine instead of hand-editing files. Two equivalent ways:

- **CLI (works anywhere):** `node cli/dev-spec.js <command>`.
  Below, `dev-spec <command>` stands for `node cli/dev-spec.js <command>` (a bare `dev-spec` works only when it is on
  PATH — `npm link` in the clone; a plugin install puts none there).
- **MCP (if your tool speaks MCP):** the `spec-driven` server exposes the same operations as 38 tools, plus one
  prompt per plugin command (slash commands in clients that show MCP prompts) and the specs as read-only
  `specs://` resources.

Key operations (CLI form):

```
dev-spec classify "<feature description>" [--name "<feature>"]   # recommend tracks (multilingual, weighted)
dev-spec init [tracks...] [--lang en|pt|pt-BR|es] [--guard on|off|scope]   # scaffold .specs/steering (incl. constitution.md); --lang sets the project default
dev-spec init --check test="npm test" [--check lint="npm run lint"]   # the project's check commands: finish needs a passing run of each
dev-spec init --roles requirements=product,design=tech+security   # approvals by role (--roles none clears); --stop-check on|off
dev-spec init [--evidence reported|observed] [--approval-guard off|ask|deny]   # opt-ins: observed evidence needs Claude Code's hook; the approval guard its hook or the MCP server (see Gates and evidence)
dev-spec steering <file> [--lang]              # one steering file from its template (constitution.md, tech.md, …) or a custom scoped one (api-rules.md)
dev-spec templates [list|init|check] [artifact] [--lang]   # the team's own scaffolds in .specs/templates/ (replace the built-in ones)
dev-spec tracks [list|init <name>|check] [name] [--lang]   # the team's own tracks: packs in .specs/tracks/<name>/ (marker tracks like +sec)
dev-spec create "<name>" [tracks...] [--size xs|s|m|l] [--lang] [--summary "…"] [--brownfield] [--flow design-first]  # scaffold the feature (no tracks → auto-classify; --size: xs = one change.md, s = no classification.md; --brownfield → integration-plan.md)
dev-spec bugfix "<name>" [--summary "…"]       # bugfix flow: reproduce → root cause → regression test → fix
dev-spec spike "<name>" [--question "…"] [--timebox 3d]   # a timeboxed investigation that ends in a decision (go / no-go / pivot)
dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name "<feature>"] [--tracks …]   # another tool's spec, a plan, an ExecPlan, BMAD docs or a fluidplan plan → a NEW feature (IDs remapped)
dev-spec import <plan|execplan|fluidplan> - | --text "<markdown>"   # the same from the plan's text (stdin or inline) — a plan kept outside the project
dev-spec status [feature] | list               # progress, phase, tracks, sections filled vs present
dev-spec clarify <feature>                      # surface requirement gaps before design
dev-spec doctor <feature>                      # health-check → ready to advance? (exit 1 on FAIL — scriptable)
dev-spec ears <feature|file.md>                # lint EARS (SHALL/DEVE/DEBE, IDs, vague words, placeholders); --text "…" or - (stdin) for a snippet
dev-spec trace <feature> [--code]              # AC ↔ task ↔ test ↔ code (_Implements:_, phantom refs, EC/NFR/SC warnings); --code finds T-IDs in test files
dev-spec trace <feature> --matrix | --csv      # the requirements traceability matrix: one row per AC/EC/NFR/SC — status, tasks + evidence, tests, design, decisions, approval
dev-spec next <feature> [--batch] [--waves]    # next task whose _Depends:_ are done (--batch: + the [P] tasks that can run beside it; --waves: the execution waves of every open task)
dev-spec next-action <feature>                 # "you are here → do this next", phase by phase: re-review → fill → fix → approve (then the next phase) → implement → verify → finish
dev-spec brief <feature> [n] [--write]         # self-contained brief for one task (ACs + tests resolved, scoped steering, DoD)
dev-spec done <feature> <n> --run              # run the task's _Verify:_ command and record the evidence (failure → stays open; an _Expect: fail_ task: its failing run is the proof)
dev-spec undone <feature> <n> [--reason "…"]  # untick a task ticked by mistake: its evidence turns stale, a re-tick needs a new run
dev-spec approve <feature> <phase> [--force] [--role <role>]   # record the user's approval of a phase (after their explicit yes) — refused while that phase's checks fail
dev-spec approve <feature> <phase> --force --reason "…" --expires 30d   # a forced approval with its waiver (doctor warns waiver-expired once it lapses)
dev-spec approve <feature> <phase> --revoke [--reason "…"]   # revoke an approval: the phase is pending again, later phases stay approved
dev-spec approve <feature> --through tasks     # fast-forward: every filled phase in order, each through its own gate; stops at the first refusal
dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen]   # what an edit after approval touches; --reopen unticks affected done tasks (never a removed AC's: retire lists those)
dev-spec append-tasks <feature> --task "…" [--req US-1.AC-2] [--implements path] [--verify "<cmd>"] [--makes-green T-01] [--expect-fail] [--size M] [--depends 3,5]   # converge: append a task (Phase: Convergence)
dev-spec finish <feature> [--write] [--include-body] [--run]   # blockers + fresh checks + merge summary from the spec chain (merge locally; no PRs); --run runs the project checks
dev-spec decide <feature> --title "…" --decision "…" [--affects US-1.AC-2,T-03] [--discovery]   # append a D-n entry to decisions.md
dev-spec stop-check --message "<your closing message>"   # before saying "done" / "verified": exit 1 = unverified ticks, fix them or say so
dev-spec log <feature> [--max N]               # the commits that cite each task (+ a red-first check on +tdd)
dev-spec metrics [feature] [--write]           # lead times, rework, forced approvals, change requests, evidence pass rate, velocity (--write → retro.md)
dev-spec add-track <feature> <track> [--remove]   # add a track (additive, never overwrites); --remove takes one off, files kept
dev-spec feature <archive|restore|rename|remove> <name> [new-name] [--yes]   # lifecycle; remove is destructive and needs --yes
dev-spec feature flow <name> <requirements-first|design-first>   # the phase order (design-first: the design before the requirements)
dev-spec catalog [--write]                     # living catalog of every feature's ACs (_Supersedes:_ marks replaced ones) → .specs/SPECS.md
dev-spec export [feature] [--md|--csv] [--write]   # one offline, printable document (HTML / markdown) for stakeholders, or the traceability matrix as CSV → .specs/exports/
dev-spec export [feature] --gherkin [--write]  # BDD: one Gherkin .feature per feature — a scenario per current AC, its EARS clauses as Given / When / Then
dev-spec export [feature] --tracker jira|linear [--write]   # a CSV for Jira's / Linear's importer (feature → stories → tasks; nothing is sent)
dev-spec export [feature] --adr [--write]      # the decision log as ADRs: one MADR file per decision (ADR number = its D-n) → .specs/exports/adr/<feature>/
dev-spec changelog [--since <date|last|all>] [--milestone <name>] [--write]   # release notes from the specs (Added / Changed / Fixed) → .specs/RELEASE-NOTES.md
dev-spec drift [feature]                       # implementing files changed / missing / new since finish recorded its baseline (exit 1 on drift or a stale baseline)
dev-spec upgrade [--apply]                     # after updating dev-spec-driven: audit .specs/ against the new rules (read-only); --apply = the safe migrations + .specs/UPGRADE.md
dev-spec roadmap                               # multi-feature roadmap: %, dependencies, cycles, ETA per feature, overlapping features, milestones
dev-spec milestone [add "<name>" <YYYY-MM-DD> <features…> | rm "<name>" | list]   # target dates vs ETAs → on-track · at-risk · late · done
dev-spec depend <feature> [deps...]            # show / set dependencies (rejects cycles); --add / --rm <dep>, --clear, --order N
dev-spec backlog [add|rm|remove "<name>" ["note"]]    # planned-but-unspecced features (shown in ROADMAP.md)
dev-spec scan [path]  /  dev-spec coverage     # brownfield: routes, tests, entrypoints, env var names, migrations + % of code named in _Implements:_
dev-spec evals <feature> [--dry-run]           # run local eval harness (+ai; your API key)
dev-spec mcp-config [client]                   # print MCP config for your tool
dev-spec rules <cursor|windsurf|copilot|gemini|agents>   # print that tool's rule file with this clone's absolute paths
dev-spec prompts [name] [--args "…"]           # the plugin's commands as MCP prompts: list them, or print one rendered
dev-spec statusline [--print-config]           # one status line (Claude Code's statusLine command reads its session JSON on stdin); --print-config: the settings entry
```

## The pipeline (Spec mode)

For anything beyond a quick fix (Vibe mode = just do it, no artifacts) or a contained change to an existing
flow (Bounded mode = a short design in chat and an explicit yes, no artifacts):

0. **Classify** — `dev-spec classify` to seed tracks; confirm against `skills/dev-spec-driven/references/classification-matrix.md`. Get user approval of the mode and track set (a real defect → `dev-spec bugfix` instead; an open question to investigate before committing to requirements → `dev-spec spike`; a spec written for Kiro, spec-kit or OpenSpec, a Claude Code / Cursor plan, a Codex ExecPlan or BMAD docs → `dev-spec import`; work that starts from an architecture → `create --flow design-first`, which puts the design before the requirements). Agree the size with the user too (`classify` suggests one: xs a one-file change, s one story, m / l the full chain). After approval: `dev-spec init <tracks> --lang <xx>` if `.specs/steering/` is missing, then `dev-spec create "<name>" <tracks> --size <xs|s|m|l> --lang <xx>` once (add `--brownfield` when the feature lands in existing code). Size m / l (or no size) seeds `.specs/<feature>/classification.md`, where you record the decision, then `dev-spec approve <feature> classification` once the user says yes; size s or xs seeds no `classification.md` and has no classification gate — record the decision in the Summary of `requirements.md` (s) or `change.md` (xs).
1. **Requirements** — fill the scaffolded `requirements.md`: EARS criteria with stable AC IDs; run `dev-spec ears` to lint and `dev-spec clarify` for gaps. Add track-specific ACs (tenant isolation for +saas; quality/safety/cost for +ai; threats and authorization for +sec; lawful basis, retention and data subject rights for +privacy; the outbox, duplicate-delivery, concurrent-update and dependency-down criteria for +dist). Approve.
2. **Design** — base sections + the mandatory sections of the active tracks (5 for +saas, 10 for +ai, 5 for +sec, 6 for +privacy, 5 for +dist, 5 for +api, 5 for +ui, 5 for +obs, 5 for +data). The scaffold marks each with a `> **TODO**` sentinel; replace it with real content. No blank mandatory sections. Every design weighs its choices: **Alternatives & Trade-offs** (at least two options per key decision — pros, cons, cost of being wrong, the one chosen and why) and **Risks** (likelihood, impact, mitigation, owner) — `doctor` warns `design-tradeoffs` / `design-risks` without them. Every design also names what it reuses: **Reuse & Integration** (the existing modules, components, helpers and services it reuses or extends, with their paths; what is new and why nothing existing fits; where the new code lives) — `doctor` warns `design-reuse` without it (`skills/dev-spec-driven/references/code-reuse-and-quality.md`). Approve.
3. **Test/Eval plan** — +tdd: enumerate tests mapped to AC IDs (Kind `example` or `property`). +ai: golden/adversarial/regression sets + thresholds + baseline. Approve.
4. **Failing tests / eval harness** — +tdd: write tests, all red for the right reason (hard gate); put the T-ID in the test name so `dev-spec trace --code` finds it. +ai: deterministic tests + runnable eval harness + baseline. No implementation before this passes — record the sign-off with `dev-spec approve <feature> tests` (the engine tracks it: `next-action` asks for it and `gatesOk` / `finish` count it; a bugfix has no such gate, its regression test is a task).
5. **Tasks** — ordered, traceable; markers `_Requirements:_` and `_Verify: <command>_` always (+tdd: the command that runs that task's own tests — the full suite stays red until the last task), `_Makes green:_` (+tdd), `_Emits metrics:_` (+saas), `_Affects evals:_` (+ai); optionally `_Size: XS|S|M|L|XL_` (roadmap forecasts), `_Depends: 3, 5_` (tasks of this tasks.md that must be done first — without it, tasks.md order is the order; `dev-spec next` serves the first open task whose dependencies are done, `next --waves` shows what can run in parallel, and `doctor` fails `task-deps` on an unknown number or a cycle) and, on a task that writes a test before its fix, `_Expect: fail_` (its run must fail). Run `dev-spec trace` — every AC must map to a task.
6. **Execute** — task by task, in order (`dev-spec next <feature>` serves the next one whose dependencies are done):
   - **The loop of the task's track:** implement-and-test (core) / red→green→refactor one behaviour at a time (+tdd) — a new behaviour's test first and watched failing for the right reason; its code written before the test is deleted and redone, while guard tests, characterization tests of existing code and T-IDs an earlier task turned green pass at once (never forced red); the micro-cycle in `skills/dev-spec-driven/references/test-patterns.md` / prompt-iteration gated on eval delta (+ai).
   - **Search before you write:** before adding a helper, component, client or formatter, look for an existing one (the design's Reuse & Integration, then the codebase by concept and synonyms) — reuse, else extend, else create; a refactor outside the task goes to `dev-spec backlog add refactor-<topic> "refactor: …"`, never into the task.
   - **Focus:** `dev-spec brief <feature>` gives you the task with its ACs, tests, matching steering and the files next to its own already resolved — handy to focus, or to hand one task to another agent.
   - **Tick with evidence:** mark done with `dev-spec done <feature> <n> --run` (MCP: `spec_complete_task`) — the only way to tick a task; evidence before claims: the task's `_Verify:_` command runs and its result is recorded; a failure leaves the task open and stays recorded; for a task whose `_Verify:_` names a runnable command, a text note alone (`--evidence "…"` without `--cmd "…" --exit 0`) ticks it but leaves it unverified (a task with no runnable `_Verify:_` can be attested by that note).
   - **Before you claim it:** before you tell the user a task or feature is done or verified, run `dev-spec stop-check --message "<what you are about to say>"`: exit 1 means ticked tasks still lack passing evidence — record the run or say plainly what is not verified.
   - **Review findings are claims:** before you fix a finding of this plugin's reviewer (`/prReview`, the `spec-reviewer` agent), check that it exists at HEAD, that this branch introduced it (or broke unchanged code with it), that no AC, design or decision asks for it and that no green check already answers it (`agents/spec-reviewer.md` → Verify mode; only a confidence of 80+ is worth a fix; an AC with no code is always a gap). A person's review comments go through `commands/spec-review-feedback.md` instead.
   - **Optionally, a simplification pass** before finishing (`commands/spec-simplify.md`): behaviour-preserving cleanups of the lines the feature added, one commit each, its tests after every change and the project checks at the end — never a test, a contract or code the feature didn't write.
   - **Close** the feature with `dev-spec finish`. Before "done": load test + observability (+saas), cost + safety validation (+ai).
   - **Subagents:** in Claude Code, `/executeTask --subagents` runs an implementer + reviewer subagent per task — see `skills/dev-spec-driven/references/subagent-execution.md`; tools without subagents run inline.

At each phase boundary, run `dev-spec doctor <feature>`; only advance when it reports
`readyToAdvance`. Record the user's sign-off (their explicit yes for that phase) with `dev-spec approve <feature> <phase>`. When unsure what comes
next, `dev-spec next-action <feature>` names the single next step.

## Gates and evidence

- **Approval is a gate.** `dev-spec approve` runs that phase's checks first (EARS errors, template
  placeholders, open `[NEEDS CLARIFICATION]`, missing sections, uncovered ACs, phantom IDs …) and refuses
  while any fails, listing them. Fix them and approve again. `--force` records it anyway as a *forced*
  approval with the failing checks; `doctor` and the roadmap keep flagging it — use it only when the user
  explicitly accepts the gap.
- **Roles and fast-forward.** When `dev-spec init --roles …` lists a phase, it is approved only once every role has
  signed its current content (`approve <f> <phase> --role <role>`); until then it stays pending and `next-action` names
  the missing role. `approve <f> --through tasks` approves the filled phases in order, each through its own gate, and
  stops at the first refusal — only when the user asked for it.
- **A template is not content.** `doctor`'s `placeholders` check fails while the current (or an earlier)
  phase's artifact still holds template placeholders; a fresh feature starts at its first phase (`requirements`; `design`
  on the design-first flow).
- **Evidence rules.** A task whose `_Verify:_` holds a runnable command counts as verified only with a recorded
  run of it: exit code 0 — or, on an `_Expect: fail_` task (a red test, such as a bugfix's task 1), a failing run (see
  Red → green). **Can't run the command yourself?** Don't tick the task — not bare, not with a note: name the command
  and ask the user for its output (or to run `node cli/dev-spec.js done <feature> <n> --run` — the line the tool's
  note prints, the clone's path resolved: no `dev-spec` is on PATH unless linked), then record what they report —
  never send a subagent to look for a shell; a
  note-only tick (it stays unverified) is for when the user explicitly asks for one. A failed run is recorded and
  keeps the task unverified until a later passing run; evidence goes stale when the spec behind the
  task changes (`impact --reopen`) or its `_Verify:_` command is edited. `done --json` (MCP
  `spec_complete_task`) returns a stable reason code in `unverifiedReason` (`no-evidence`, `failed-run`,
  `manual-note-on-runnable-verify`, `duplicate-number`, `stale-evidence`, `unexpected-pass`, `unobserved`, `command-mismatch` — the run recorded is not a run of the task's `_Verify:_` command) whenever `verified` is false;
  `doctor`, `finish` and the `ROADMAP.md` "Needs attention" line list each unverified task with a localized
  reason. A task with no runnable `_Verify:_` and nothing recorded comes back `verified: true` with
  `nothingToVerify: true` — the same verdict doctor gives; a note records how it was checked.
- **Red → green.** A task marked `_Expect: fail_` is proven by a FAILING run of its `_Verify:_` (the test fails before
  its fix); a passing run is refused (`unexpected-pass`) until that red run is on record. Exit 126 / 127 / 9009 (the
  command could not run) is no red test, nor is a failing run whose output shows the test never ran (a missing test
  file, module or script, nothing collected).
- **Project checks.** With `init --check name="cmd"` set, every brief lists them and `finish` blocks (`suite-evidence`)
  until each has a passing recorded run since the last task activity, on the current code (a run made before the
  implementing files changed reads `code-changed`) — run them and report them (MCP `spec_finish {evidence}`), or
  `dev-spec finish <f> --run`.
- **`--run` and its shell.** `done --run` / `finish --run` use cmd.exe on Windows (`/bin/sh` elsewhere) unless `--shell`
  (or `DEV_SPEC_SHELL`) names another; on Windows `--shell bash` is Git Bash, never WSL's `bash.exe` launcher (name that one by its path to run inside WSL).
  `--shell pwsh` / `powershell` runs a PowerShell `_Verify:_` (`-NoProfile -NonInteractive -Command`) — the portable choice.
  Otherwise quote the pwsh script for the shell that runs it: double quotes under cmd.exe, single quotes under a POSIX shell
  when it holds `$` (`pwsh -NoProfile -Command 'npm test; exit $LASTEXITCODE'` — a double-quoted one is refused there).
  A run that could not happen (the shell didn't start, a signal, `--timeout <seconds>` expired, output over 64 MB)
  records nothing: the task stays open.
- **No pipes in `_Verify:_`.** `npm test | tee log` exits with the last command's code, so a failure can read as
  verified; drop the pipe (or `set -o pipefail;` under bash). doctor warns `verify-pipes`.
- **Observed evidence is a Claude Code hook.** There a hook logs every Bash or PowerShell run of a `_Verify:_` or project-check command,
  and each recorded run is stamped `observed: true | false` (`"cli"` for `done --run` / `finish --run`). With
  `dev-spec init --evidence observed` only such runs verify (reason `unobserved` otherwise). Other tools have no such
  hook: in a project set to `observed`, record runs with `dev-spec done <feature> <n> --run`; the default `reported`
  changes nothing.
- **Claims at the end of a turn.** Claude Code runs a Stop hook that sends a turn back when its closing message claims
  "done" / "verified" while recently ticked tasks lack passing evidence. Other tools have no such hook: run
  `dev-spec stop-check --message "…"` yourself before claiming it (MCP-only: `spec_stop_check {message}`; `spec_log {name, gitLog}`
  reads the `git log --name-only --relative` text you pass — the MCP server never runs git).
- **Bugfix iron law.** For a `dev-spec bugfix` feature, `doctor` fails (and the design approval is refused) until
  `bug.md` → Root Cause is written, and the fix can't be completed before that. Its two tasks: 1 the failing
  regression test, 2 the fix — the reproduction and the root cause live in `bug.md`, gated by the approvals.
- **`dev-spec finish` blocks** on doctor failures, an artifact changed since its approval, placeholders
  anywhere in the chain, open or unverified tasks, pending approvals (a role still to sign included) and — with project
  checks set — a check without a passing run since the last task activity. Warnings (uncovered EC/NFR/SC
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
- **Steering amendments.** Requirements / design approvals record the steering that governed them; after editing
  `constitution.md` or a track's steering file, `dev-spec impact --phase steering` lists every feature approved under the
  old version (doctor: `steering-changed-since-approval`) — re-review each and re-approve. A glossary
  (`dev-spec steering glossary.md`: `- **Customer** — … _Avoid: client, user_`) makes `clarify` ask about avoided words.
- **Record decisions.** A design choice or a discovery made while implementing goes into the feature's decision log:
  `dev-spec decide <feature> --title "…" --decision "…" --affects US-1.AC-2,T-03` appends `D-n` to `decisions.md`
  (unknown references are refused). Briefs, the merge summary and the export show the entries; a decision recorded after
  the approval of the requirements or design it affects makes doctor ask for a re-review.
- **Converge.** When implementation drifted from the plan or a review found follow-up work, append tasks
  with `dev-spec append-tasks` instead of editing the numbered list by hand: they go under
  `Phase: Convergence`, numbered after the last task; unknown AC IDs (and `--makes-green` T-IDs the test plan
  doesn't plan) are refused, and an approved task list needs re-approval.
- **Living catalog.** `dev-spec catalog --write` keeps `.specs/SPECS.md` — every feature's ACs, "what the
  system does today". A criterion that replaces an older feature's one declares
  `_Supersedes: <feature>/US-n.AC-m_` on its line; `trace` warns when the reference resolves to nothing.
- **Drift.** `dev-spec finish <feature> --write` on a ready feature records a hash of its `_Implements:_`
  files; `dev-spec drift` later reports the files changed, missing or new since then.
- **Archive, don't delete.** `dev-spec feature archive` is reversible (`feature restore` brings back the
  roadmap entry and the dependencies archive pruned); `feature remove` deletes and needs `--yes`.
- **After updating dev-spec-driven.** `git pull` the clone and restart your tool (or MCP client), then in each
  project with an existing `.specs/` run `dev-spec upgrade` (MCP `spec_upgrade`): a read-only audit — per feature its
  status, what the new rules flag, the next step and the review to run (the critic review for specs not implemented
  yet, the converge pass for half-done ones). With the user's OK, `dev-spec upgrade --apply` saves inferred tracks,
  gives pre-1.13 approvals a history baseline when the file still matches, stamps `meta.specVersion` in
  `.specs/roadmap.json`, writes the checklist `.specs/UPGRADE.md` and refreshes the generated `ROADMAP.md`; it never
  edits a spec, approves or ticks
  anything. Every fix it leads to still goes through the gates.

## Steering, templates, import, spikes and guard mode

- **Scoped steering.** A steering file may start with front matter: `inclusion: always`, `fileMatch` (with
  `fileMatchPattern: "src/api/**"`) or `manual`. `dev-spec brief` includes the `fileMatch` files whose
  pattern matches the task's `_Implements:_` paths and lists `manual` ones as available.
- **Project templates.** `.specs/templates/<artifact>.md` (or `<lang>/<artifact>.md`; a pt-BR feature falls back to
  `pt/`) replaces a built-in scaffold for new features (`{{name}}`, `{{summary}}`, `{{tracks}}`… filled in);
  `dev-spec templates init` copies the built-in ones to edit, `templates check` validates them. An untouched custom scaffold still counts as a template: fill it in.
- **Project-defined tracks.** A pack `.specs/tracks/<name>/` (`track.json` + optional markdown fragments) is a track like
  +sec: `classify` reads its signals, `create` / `add-track` scaffold its `[MARKER]` criteria, design sections, tasks and
  test rows, and `doctor` fails `<name>-sections` until they are filled. `dev-spec tracks init <name>` scaffolds one,
  `tracks check` validates them (a bad pack is ignored). Guide: `skills/dev-spec-driven/references/project-tracks.md`.
- **Import.** `dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path>` turns a spec written for another tool
  — or a Claude Code / Cursor plan, a Codex ExecPlan, BMAD docs, a fluidplan plan (its settled decisions → `decisions.md`) — into a new feature: criteria become `US-N.AC-M` (EARS
  where possible, else `[NEEDS CLARIFICATION]`), tasks are renumbered keeping their checkbox state. The source must be
  inside the project and is never modified (a Claude Code plan lives under `~/.claude/plans` — pass its text instead:
  `dev-spec import plan - < plan.md`, or `--text "…"`).
- **Spikes.** `dev-spec spike "<name>" --question "…" --timebox 3d` scaffolds `spike.md` + investigation tasks, with no
  requirements / design gates: investigate, then write the Decision (`_Outcome: go | no-go | pivot_` + the rationale).
  Go → spec the real feature; no-go → archive the spike. Prototype code stays outside `.specs/`.
- **For stakeholders.** `dev-spec export [feature]` builds one offline, printable document; `dev-spec changelog` writes
  release notes from what shipped. For audits, `dev-spec trace <feature> --matrix` (or `export <feature> --csv --write`
  → `.specs/exports/<feature>.rtm.csv`) gives the requirements traceability matrix, each row `verified` · `implemented` ·
  `planned` · `untraced`.
- **Guard mode is a Claude Code hook.** `dev-spec init --guard on` sets it, but only Claude Code runs the
  PreToolUse hook that asks before code edits while no feature has approved, unfinished tasks — except a test file
  while a feature's test plan is approved (Phase 4) and code while an active spike exists (its prototype); `--guard
  scope`: also before a code file no open task names in `_Implements:_`. In other tools, follow the same rule yourself:
  no implementation before the tasks are approved, and no code outside the plan without a converge task.
- **The approval guard: a Claude Code hook, and the MCP server.** `dev-spec init --approval-guard ask|deny` makes Claude
  Code ask the user before an agent's approval (`spec_approve`, `dev-spec approve` through its shell, a feature removal,
  lowering the guard) or refuse it. In other MCP clients the server guards its own tools (`spec_approve`, `spec_feature`
  remove, `spec_init` lowering a guard): when the client supports elicitation it asks the user itself (a question with an
  Approve box and a note — only their explicit approve is recorded, as `confirmed`); a `declined: true` result means the
  user said no (or didn't answer): record nothing, ask what should change. A `changedSincePreview: true` result means
  the artifact (or, forced, its failing checks) changed while they decided: nothing was recorded — preview it again and
  ask again. A `humanRequired: true` refusal (`deny`, a
  client that can't ask) names a `command`: give it to the user to run themselves and wait — never retry it another way.
  Where nothing asks (`ask` in a client without elicitation, the CLI outside Claude Code), approvals are still the
  user's — never approve on your own.
- **Alongside superpowers.** If the superpowers skills are installed in your tool too, this workflow replaces
  their planning, TDD, debugging, execution, verification, review and branch-finishing skills for feature work.
  Put the precedence block of the `spec-superpowers` command (`dev-spec prompts spec-superpowers` prints it) into your
  tool's rules file or your project's instructions file to make it stick.

## Non-negotiables

- **No implementation without approval** at each gate.
- **Traceability end-to-end**: code → tasks → (tests/evals) → design → requirements → need.
- **Mandatory track sections are mandatory** — an honest "not needed because X" is fine; blank is not.
- **Evidence before claims** — a task is done when its `_Verify:_` run is on record (passed; for an `_Expect: fail_`
  task, failed before the fix), not when someone says so. No run you can see → don't tick; ask for the output.
- **Everything is local. No GitHub Actions, no paid CI, no pull requests** — integrate by merging locally. Tests/load/evals run in the user's own env.

See `skills/dev-spec-driven/references/` for EARS, scale, eval, safety, and prompt-engineering guides.

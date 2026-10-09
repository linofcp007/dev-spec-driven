# Tooling reference

Read on demand from `SKILL.md`. The workflow itself lives in `SKILL.md`; this file holds the lookup
tables.

## MCP tools (`spec-driven` server — 38 tools)

All tools are local file operations on `.specs/` (or a read-only scan of the codebase); none hit the network.
They scaffold and check — they never overwrite your files. Arguments are validated against each tool's
input schema (a wrong type or unknown value is refused with a clear message) — and so is an argument the schema doesn't
list (1.24: `revoked` for `revoke` used to be dropped silently; now nothing runs and the reply names the right one). An
argument error carries a stable `code`: `unknown-argument` (`unknown` [{argument, didYouMean}]) · `missing-arguments`
(`missing`) · `invalid-arguments` (`invalid`) · `project-dotdot` · `project-network` · `project-uri` · `project-missing` ·
`project-not-dir`. `projectDir` names an EXISTING folder (only `spec_init` creates one), as a path or a local `file://` URI;
not given (or a variable the client left unexpanded, `${workspaceFolder}`, `$HOME`, `%CD%`), the server's project is used —
`SPEC_PROJECT_DIR` / `CLAUDE_PROJECT_DIR`, else the client's first root (MCP roots), else the nearest folder with a `.specs/`
at or above its working folder, else that folder; a relative one resolves from the client's root when roots chose the default.
Results are compact JSON.

| Tool | Use it for |
|---|---|
| `spec_classify` | Phase 0 — seed the track recommendation (core +tdd +saas +ai +sec +privacy +dist +api +ui +obs +data) from a description (keyword heuristic, strong / weak / corroborating signals, negation-aware — a negation reaches every item of a coordinated list); the project's signal overrides (`.specs/classifier.json`, 1.21) apply and are named (`overrides`); `explain: true` lists every match; `lang` is the language it read (`pt` for any Portuguese), `langHint: "pt-BR"` (1.24) says the wording is Brazilian — pass `lang: "pt-BR"` to spec_init / spec_create |
| `spec_init` | Scaffold `.specs/steering/` for the active tracks; `lang` sets the project default; opt-in `guard` (`"on"` / `"off"` / `"scope"`), `stopCheck` (the end-of-turn evidence gate, on by default), `checks` (the project's named check commands), `approvalRoles` (phase → roles), `evidence` (`"reported"` default / `"observed"` — only runs the harness saw, or the CLI made, verify a runnable `_Verify:_`) and `approvalGuard` (`"off"` / `"ask"` / `"deny"` — an agent's approval asks the user or is refused) — each stored in `roadmap.json → meta` and always reported back |
| `steering_scaffold` | Create one steering file from its template (incl. `security.md`, `privacy.md`, `distributed.md`, `api.md`, `ui.md`, `data.md`, and `glossary.md` — the terms to use and the words to avoid, `_Avoid:_`) — or a custom scoped one (`api-conventions.md`, front matter `inclusion: always / fileMatch / manual`) |
| `spec_templates` | The team's own scaffolds in `.specs/templates/`: `list` (built-in vs project per artifact) · `init` (copy the built-in ones to edit) · `check` (validate them) |
| `spec_tracks` | The team's own tracks (1.15): packs in `.specs/tracks/<name>/` — `list` (built-in + packs, valid or not) · `init <name>` (a commented example pack) · `check` (stable codes, verdict) — see `references/project-tracks.md`; `signals` (1.21) — the classifier's signal overrides of this project (`op` list / set / forget; learned by `spec_create` from Phase 0 corrections, applied after 2 consistent ones) |
| `spec_create` | Scaffold a feature for its tracks (tracks + lang persisted in `.state.json`; with `tracks` AND a `summary`, a choice that differs from the summary's classification is recorded as a Phase 0 correction — `signalOverrides`); `kind: "bugfix"` → the bugfix flow, `kind: "spike"` (+ `question`, `timebox`) → a spike; `size` (1.21: xs · s · m · l — xs = `kind: "change"`, one `change.md`; s = one story, merged weigh sections, core-tier track sections; m / l = the full chain, duplicate track sections merged — `references/workflows.md` → Sizes); `brownfield: true` → + `integration-plan.md`; `flow: "design-first"` |
| `spec_import` | Import a Kiro / spec-kit / OpenSpec spec, a plan (Claude Code plan mode / Cursor), a Codex ExecPlan, BMAD docs or a fluidplan plan (path inside the project — or, for a plan / ExecPlan / fluidplan PLAN.md, its markdown as `text`: plan mode keeps plans in `~/.claude/plans`) as a NEW feature — IDs remapped (`mapping`), `warnings` listed, source untouched; a fluidplan plan's settled decisions → `decisions.md` |
| `spec_list` | List all features with track set, phase, and task progress |
| `spec_status` | One feature: kind (feature / bugfix / spike / change), flow, phase, artifacts, tasks (with `verified`), each active track's sections present vs filled (`secSections`, `privacySections`, `distSections` …), eval state |
| `spec_next_action` | "You are here → do this next": one `step`, phase by phase (re-review → for the first unapproved phase: fill → fix → approve, the next phase only after that approval → fix → implement → verify → finish → finished / drift; a spike: fill → implement → decide → promote / archive / pivot) + `changedSinceApproval`; suggests `/spec-ff` when every planning artifact passes its gate |
| `ears_validate` | Lint criteria: modal verb, stable IDs, vague words, placeholders — issue `code`s `no-modal` · `no-id` · `vague` · `placeholder` · `no-keyword` · `needs-clarification` · `padded-id` (a zero-padded `US-1.AC-01` — IDs are compared as written: write `US-1.AC-1`) |
| `spec_clarify` | Requirement ambiguities/gaps before design (markers, placeholders with file:line, missing sections, IF…THEN, track gaps — tenant isolation, AI quality/cost, access denial, secrets, data subject rights, retention; with a glossary, every avoided word used — `glossary`; queues / events / concurrency / transactions named (two concepts, or one strong phrase; never the template's words) while neither requirements.md nor design.md states a consistency model, delivery guarantee or idempotency — one question, `nudges` `consistency-unstated`) |
| `trace_check` | AC ↔ task ↔ test gaps (the verdict — a test-plan ROW covers an AC, never a Gaps / Out of Scope note; a removed track's criteria are not required) + warnings for EC/NFR/SC, `justifiedTestGaps` (+tdd: uncovered ACs the plan names only in such a note — still gaps), `untracedCriteria` (criteria with a modal verb but no ID beside US-n.AC-m ones, by line), `phantomSupersedes` and `phantomAffects`; `code: true` scans test files for T-IDs; `matrix: true` adds the requirements traceability matrix (one row per AC / EC / NFR / SC — `status` verified · implemented · planned · untraced, `gaps` no-task · no-test · no-coverage, linked tasks + evidence, tests, design, decisions, supersedes, changed since approval; informational, never the verdict) |
| `spec_doctor` | One health-check → `readyToAdvance` (the checks are listed below) |
| `spec_approve` | Record a phase approval — a GATE: refused while that phase's checks fail; `force: true` records it as forced; saves a `.history/` snapshot; `role` signs off as a role (`meta.approvalRoles`); `through` fast-forwards every active phase up to it, each through its own gate; with `force`, `reason` + `expires` (YYYY-MM-DD or `30d`) record the approval's `waiver` (doctor `waiver-expired` once it lapses, ROADMAP.md and the merge summary show it); `revoke: true` (+ `reason`) removes the phase's approval and its waiting role sign-offs — history record `revoked: true`, never a cascade (`laterApproved` stay approved; the phase is pending again); on a role-governed phase it names a listed `role`, and before the approval withdraws only that role's sign-off |
| `spec_impact` | What an edit after approval touches (vs the approved snapshot): ACs/sections/tasks; `reopen: true` unticks the affected done tasks and marks their evidence stale — never a removed criterion's tasks: `retire` [{id, tasks, tests}] lists them to delete or repoint; `phase: "steering"` (no name = every active feature) lists the approvals made under steering that changed since (read-only) |
| `spec_decide` | Append one entry to the decision log `decisions.md` (`D-n`, `_Kind:_`, `_Date:_`, `_Affects:_` validated against the feature, `_Supersedes:_`) — append-only |
| `spec_next_task` | The next task — the first open one whose `_Depends:_` are all done (`skipped` / `blocked` `[{number, waitsOn}]` when dependencies are in play; `next: null` + a note when none can start); `batch: true` → + the `[P]` tasks that can run beside it; `waves: true` → the execution waves of every open task + `cycles` + `blocked` |
| `spec_task_brief` | Self-contained brief for one task (ACs + tests resolved, design context, a Reuse section — the design's Reuse & Integration entries for the task and the source files next to its own —, scoped steering, decisions, project checks, `_Expect: fail_`, pipe warnings, its `_Depends:_` and where each stands, DoD); default = the next task by `spec_next_task`'s rule; `write: true` → `.specs/<feature>/.execution/` |
| `spec_complete_task` | The only way to tick task N, with `evidence {command, exitCode, summary}` — a failed run is recorded and refuses the tick; a runnable `_Verify:_` counts as verified only with `{command, exitCode: 0}` of its `_Verify:_` command (a run of another command ticks it unverified: `command-mismatch`); an `_Expect: fail_` task needs a failing run (a pass → `unexpectedPass`; a run that never reached the test — exit 126/127/9009, a missing test file or module, a test file that doesn't parse — → `couldNotRun`); a passing run whose summary shows no test ran ("tests 0", go "[no tests to run]"…) → `couldNotRun: "no-tests"`, nothing recorded; a failed run of a task whose `_Expect:_` value is not `fail` names it (`unknownExpect`); a piped command → `pipeMasked`; every run stamped `observed` (true / false; `"cli"` for `done --run`) — with `meta.evidence: "observed"` an unobserved run leaves it unverified (`unobserved`); a task ticked before its `_Depends:_` → `waitsOn` + a note (never refused); `undo: true` (+ `reason`) unticks it — its evidence turns stale (`staleBy: "undo"`, a re-tick needs a new run), `ticks[n]` dropped, `.state.json → unticks` {n, at, reason} |
| `spec_append_tasks` | Converge: append new tasks under "Phase: Convergence" (existing tasks never renumbered; each task may carry `_Requirements:_`, `_Makes green:_`, `_Implements:_`, `_Verify:_`, `_Expect: fail_`, `_Size:_`, `_Depends:_`; unknown AC IDs, unplanned T-IDs, or a `depends` naming no task / closing a cycle refuse the call; `needsReapproval`) |
| `spec_finish` | Close a feature: blockers (incl. `suite-evidence` with project checks) + warnings + fresh checks + a merge summary from the spec chain; `evidence` records the project checks you ran; `write: true` on a ready feature records the drift baseline |
| `spec_drift` | Implementing files of finished features changed / missing / now present since the finish baseline |
| `spec_stop_check` | The end-of-turn evidence gate for MCP-only clients (= the Stop hook, `stop-check --json`): `message` → `block` + `reason` when it claims done / verified while recently active features have unverified ticks (or project checks without a passing run); `why` otherwise; `agent: "spec-implementer"` checks the task report, `agent: "spec-simplifier"` the simplification report |
| `spec_log` | Git-linked evidence from `gitLog` — the `git log --name-only --relative` text the client passes (the server never runs git): the commits citing each task + the +tdd red-first check (= `log <f> - --json`); `max` = the window it was read with |
| `spec_metrics` | Lead times, rework, forced and batch approvals, change requests, evidence pass rate, velocity; `write: true` (with `name`) → `retro.md` (never overwritten) |
| `spec_catalog` | The living catalog: every feature + AC (superseded ones marked), spikes, decisions, possible duplicate / conflicting criteria across active features (`crossAcs`); `write: true` → `.specs/SPECS.md` (AUTO-GENERATED) |
| `spec_export` | Stakeholder export: one offline, printable HTML (or `md`) document of a feature or the whole project (with a traceability-matrix section / per-feature counts); `format: "csv"` → the traceability matrix as RFC 4180 CSV (formula-safe, UTF-8 BOM, the AUTO-GENERATED marker as its last record); `format: "gherkin"` (1.16) → a Gherkin `.feature` per feature: one Scenario per current acceptance criterion (tags `@US-n.AC-m`, its planned `@T-xx`, the track markers), the EARS clauses as Given (WHILE / WHERE / IF) · When (WHEN) · Then (the SHALL response, verbatim) — a criterion that can't be split cleanly is one Then step with its whole text (`unsplit`); template and shipped-superseded criteria left out with a comment; PT / ES in Gherkin's own dialect (`# language: pt` / `es`); `format: "jira"` · `"linear"` (1.16) → a CSV for the tracker's importer (feature → stories → tasks by `[USn]`; Jira: Work item ID · Work type · Summary · Description · Status · Parent · Labels…; Linear: ID · Title · Description · Status · Estimate · Labels · Parent issue; the marker is the last header cell); `write: true` → `.specs/exports/` (`<feature>.rtm.csv` / `project.rtm.csv` for csv, `<feature>.feature`, `<feature>.<tracker>.csv` / `project.<tracker>.csv`) |
| `spec_changelog` | Release notes from the specs (Added · Changed · Fixed) since `since` (default: the last written notes); `write: true` → `.specs/RELEASE-NOTES.md`; `milestone` → only that milestone's features (`since` defaults to `all`; `write` → `.specs/RELEASE-NOTES.<milestone>.md`, `meta.changelogAt` untouched) |
| `spec_add_track` | Escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data (additive, never overwrites); `remove: true` takes a track off without deleting files |
| `spec_feature` | archive (reversible) · restore · rename (deps follow) · flow (`design-first` / `requirements-first`) · remove (destructive — needs `confirm: true`) |
| `spec_roadmap` | Multi-feature roadmap (%, blocked, cycles, velocity + ETA forecasts, cross-feature overlaps, needs attention); `write: true` → `.specs/ROADMAP.md` (+ `html: true`), `lang` = chrome language |
| `spec_depend` | Show / replace (`dependsOn`) / edit (`add`, `remove`) dependencies and `order` — existing features only, cycles rejected |
| `spec_milestone` | Milestones (`meta.milestones`): `add` (name, date YYYY-MM-DD, existing active features — an existing name is updated) · `rm` · `list`; each judged against its features' ETAs → `on-track` · `at-risk` (`eta-after-date` · `eta-unknown` · `no-features`) · `late` · `done`; ROADMAP.md shows a Milestones table and lists late / at-risk ones under Needs attention; rename / remove / archive (→ `archived`, restore puts it back) of a feature follow |
| `spec_backlog` | Planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` | Brownfield inventory: stack, frameworks, routes (method + path + file:line), tests, entrypoints, env var names, migrations |
| `spec_coverage` | Brownfield: share of code files named in any `_Implements:_` marker, per folder, + unmatched markers |
| `spec_upgrade` | After a plugin update: audit every active feature against the current rules (status, doctor fails/warns, pending gates, changed since approval, approvals without history, unverified tasks, drift, next step, `review` critic / converge / none, grouped blocked · attention · ok); `apply: true` saves inferred tracks, seeds pre-1.13 approval baselines (`.history/`), completes `.specs/.gitignore`, stamps `roadmap.json → meta.specVersion` and writes `.specs/UPGRADE.md` — never edits an artifact, approves or ticks |

### `spec_doctor` checks (stable ids)

Each check is pass / warn / fail; `readyToAdvance` means no fail.

- **Fail when broken:** `requirements` (missing) · `ears` (a criterion without a modal verb, requirements.md
  defining an AC ID that no linted criterion carries — an AC is linted as a list item, heading or line led by its ID, `[ID]` /
  `(ID)` too, or a table row under an Acceptance Criteria heading — or criteria with no `US-n.AC-m` ID — a bare `AC-1` is none) · `clarifications` (open
  `[NEEDS CLARIFICATION]`) · `ac-uniqueness` (an AC ID defined twice — a list or checkbox item, a heading, a table row or a
  line led by it; compared by number, `US-1.AC-01` = `US-1.AC-1`) · `placeholders` (template text in the current or an earlier phase's
  artifact; a later phase's only warns) · `design` (missing) · `saas-sections` / `ai-sections` / `sec-sections` /
  `privacy-sections` / `dist-sections` / `api-sections` / `ui-sections` / `obs-sections` / `data-sections` / `<pack>-sections` (an active track's mandatory design section missing, empty, still holding its `> **TODO**`
  sentinel, holding only a placeholder word or mark — TBD, TODO, …, `-`, "Pending" — or — 1.21 — nothing but the template's guidance line (a warn on a design approved before); a sized feature: an
  extended section may be absent at size s or answered `n/a — <reason of 4+ words>`, a section another active track covers counts) ·
  `change-scope` (a change: 1–3 criteria, 1–3 tasks, core only) · `traceability` (every gap kind with its IDs; the kinds a later phase's still-template file would cause
  are deferred as a warn; a warn too for modal criteria with no ID beside US-n.AC-m ones — `untracedCriteria`) · `task-deps` (only when some task declares `_Depends:_`: a value that is no task number, a
  number no active task carries, a self-dependency, a cycle — the tasks approval refuses on it) · bugfix `root-cause` ·
  spike `spike` (spike.md missing) / `question` / `decision` · `merge-conflicts` (a `mergeConflicts` list the git merge driver left in the feature's
  `.state.json` or in `roadmap.json` — pick each value, delete the list) · `state` (the feature's `.state.json` is not
  valid JSON or has the wrong shape — next_action's one step is to repair it, spec_finish blocks on it) · `roadmap`
  (`.specs/roadmap.json` is not valid JSON — e.g. a text merge's conflict markers — or has the wrong shape: the approval
  roles and project checks it holds can't be read, so approve / revoke / the fast-forward refuse (code `roadmap-invalid`),
  spec_finish blocks on `roadmap` and next_action's one step is to repair it — every doctor reports it).
- **Warn:** `steering` (core files missing, or files still holding template placeholders) · `success-criteria` ·
  `priorities` · `mermaid` (no mermaid code block outside comments, or only the template's own diagram) ·
  `constitution-check` (a `## Constitution Check` section with written content — the design gate's reader; a mention in a
  comment or a "TBD" is none) · `design-tradeoffs` (the design's Alternatives & Trade-offs missing,
  empty, still the template, or fewer than 2 options) · `design-risks` (its Risks section missing, empty or still the
  template) · `design-reuse` (its Reuse & Integration section missing, empty or still the template — a brownfield
  feature's filled `integration-plan.md` → Integration Points counts; the three never block an approval, a bugfix and a
  spike are exempt, and a design approved before the check existed — 1.17 for the first two, 1.19 for reuse — is never
  flagged) · `test-plan` / `eval-plan` · `secondary-trace` (EC / NFR / SC) ·
  `supersedes` (`_Supersedes:_` references that resolve to nothing) · `tests-in-code` (+tdd: T-IDs made green by done
  tasks that no test file names) · `verification` (ticked tasks without passing evidence, with the reason — `unobserved`
  too under `meta.evidence: "observed"`) ·
  `red-green` (+tdd: T-IDs made green with no recorded red run of an `_Expect: fail_` task) · `suite-evidence`
  (project checks without a passing run since the last task activity — or run before the implementing files changed —
  once every task is done) · `duplicate-tasks` · `unread-tasks` (checkbox lines the task scanner does not read as tasks —
  an ordered-list `1. [ ] text`, an unnumbered `- [ ] text` outside every task, one in an indented code block) · `verify-pipes` (a `_Verify:_` that pipes) · `malformed-markers`
  (text on a task line shaped like a marker that yields none — `**Verify:** …`, a bare `Verify:`, an empty `_Verify:_` with
  its value written after it — so nothing runs or is
  traced) · `verify-suspicious` (a `_Verify:_` value that looks garbled: it starts with `_` / `*`, holds a code span inside
  it, or has a quote with no partner) · `expect-value` (an `_Expect:_` value other than `fail` — `failure`, `red`: the task
  stays must-pass) · `evidence-moved` (a run recorded under a task number whose task was renumbered — `#1 → #2`: neither
  task reads it; record the moved task's own run) · `outside-code-artifacts` (+tdd: a test planned outside test code — `load-test.md`, an eval set — whose
  artifact is still the scaffold once a done task makes it green or every task is done; `spec_finish` repeats it as a
  warning) · `integration-plan` (brownfield template unfilled) · bugfix
  `reproduction` · `changed-since-approval` (names the `spec_impact` phases to diff) · `decision-affects` (phantom
  `_Affects:_`) · `decision-affects-approved` (a decision recorded after the approval of what it affects) ·
  `cross-feature-overlap` (another active feature's open tasks plan the same files) · `cross-feature-acs` (a criterion
  that reads like another active feature's, or may contradict it: SHALL vs SHALL NOT, different numbers) ·
  `steering-changed-since-approval` (a steering file that governed the requirements / design approval changed or was
  removed since — `steeringChanged`; approvals before 1.16 never) · `glossary` (words the glossary says to avoid, used in
  requirements.md / design.md) · spike `timebox` (past its date with no decision) · `waiver-expired` (a forced approval still standing whose
  waiver's `expires` date has passed) · `track-pack-missing` (a project track pack the feature uses is gone — its
  `.specs/tracks/<name>/` folder deleted, the pack now invalid, or its name or marker now a built-in track's: that track is
  inactive for the feature until the pack is back — `dev-spec tracks check` says why).
- **`approval-gates`** — pending phases (every phase whose artifact exists, a bugfix's `design` on `bug.md`, Phase 4
  `tests` on +tdd / +ai once its plan exists or was approved — again once its sign-off no longer covers the plan: a T-ID
  planned since, or a plan re-approved with other content —, a phase still missing a role's sign-off), forced approvals with their
  failing checks, and what the next approval would refuse (`nextGate {phase, ready, failing, missingRoles}`).

## MCP prompts and resources (other MCP clients)

Besides the tools, the server advertises **prompts**, **resources** and **completions** (`capabilities: {tools, prompts,
resources, completions}`, none of them `listChanged`), so a client that is not Claude Code still gets the plugin's commands
and can read the specs:

- **Prompts** — one per `commands/*.md`, read at runtime: name = the file name (`spec-doctor`, `spec-finish`…),
  description = its front-matter description, one optional `args` argument (from `argument-hint`). `prompts/get` returns
  the command's body with `$ARGUMENTS` replaced, after one line telling an agent without the dev-spec-driven skill to
  follow `AGENTS.md` and where `references/` lives. In MCP clients they show up as slash commands.
  **In Claude Code** the plugin's own slash commands are these files, so `mcp/servers.json` sets
  `SPEC_MCP_PROMPTS=off` for the plugin's server (no duplicate `/mcp__…` entries); the resources stay.
- **Resources** — read-only, confined to `.specs/`: `specs://roadmap` (ROADMAP.md, else rendered from roadmap.json),
  `specs://catalog` (SPECS.md), `specs://steering/<file>`, and `specs://feature/<slug>/<artifact>` for the allowlisted
  artifacts of each active feature (classification, requirements, design, test-plan, eval-plan, load-test, tasks, bug,
  quickstart, checklist, integration-plan, retro, spike, decisions, change). Templates: `specs://feature/{slug}/{artifact}`,
  `specs://steering/{file}`. The list comes in pages of 500 (`nextCursor` while there are more); `..`, absolute paths,
  other schemes and links out of `.specs/` are refused.
- **The project** — `SPEC_PROJECT_DIR`, else `CLAUDE_PROJECT_DIR`; else, when the client declares MCP `roots` (VS Code
  does), its first local `file://` root; else the server's working directory. A tool's own `projectDir` always wins.
  In a client with a global config and no roots (Claude Desktop), set `SPEC_PROJECT_DIR` in the server's `env` or pass
  `projectDir` — otherwise `.specs/` lands in the app's working directory.
- **Completions** (`completion/complete`, 1.16) — a prompt whose argument names a feature (`[feature name]`, `[feature] …`)
  completes its first word to the active features' slugs; `specs://feature/{slug}/{artifact}` completes `{slug}` and
  `{artifact}` (the artifacts the feature in `context.arguments.slug` has, else every allowlisted one) and
  `specs://steering/{file}` completes `{file}` — prefix matches first, then substring matches, at most 100 values (`total`,
  `hasMore`). An unknown prompt, template or argument name is `-32602`; with `SPEC_MCP_PROMPTS=off` a `ref/prompt` is too.
- **Tool annotations** (1.16) — every tool carries MCP `annotations`: `readOnlyHint: true` only for the tools no
  argument can make write (status, doctor, trace, ears, classify, list, next task / action, clarify, scan, coverage,
  drift), `destructiveHint: true` only on `spec_feature` (remove), `idempotentHint` where a repeat changes nothing more,
  `openWorldHint: false` everywhere. Hints only — the engine enforces its own rules.
- **CLI parity:** `dev-spec prompts` lists them; `dev-spec prompts <name> [--args "…"]` prints one rendered as
  `prompts/get` returns it.

## CLI (`dev-spec`, same engine, same behaviour)

`node cli/dev-spec.js <command>` from the plugin clone (or `dev-spec` on PATH — only after `npm link`; a plugin install
has none). `dev-spec …` below is the CLI's NAME: a line you hand the user is the runnable one the tools print, `node
"<clone>/cli/dev-spec.js" …` with the path resolved (1.21 — every engine, hook and tool message prints it that way;
the command files write `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" …`; a committed file — ROADMAP.md, SPECS.md,
UPGRADE.md, the exports, retro.md — keeps `dev-spec`, never a machine path). `--json` prints the structured
result — a refused operation too (`{ok: false, error, …}` on stdout, exit 1, as the MCP tool returns it), and a usage
error or an unexpected failure (`{ok: false, error[, code]}`); human output is localized. The project: `--project <dir>`
(an existing folder — only `init` creates one) > `SPEC_PROJECT_DIR` > `CLAUDE_PROJECT_DIR` > the nearest folder at or above
the working one that holds a dev-spec `.specs/` (run from a subfolder, the CLI works in the project above) > the working
folder; the MCP server resolves its default the same way. A `SPEC_PROJECT_DIR` / `CLAUDE_PROJECT_DIR` that chose the project
is checked like `--project` (a missing folder — `init` aside — or a file is refused, naming the variable), and a project's own
`.specs/` folder is never taken for the project. A path argument (`scan`, `ears`, `import`) is relative to the
project when it was named, else to the working folder. Each command takes its own options and arguments — another option,
one argument too many, or a single-value flag given twice (only `--add` / `--rm`, `--check`, `--req` / `--implements` /
`--makes-green` / `--depends` and `--affects` / `--supersedes` repeat) is a usage error; `<command> --help` (or `-h`, or
`help <command>`) prints that command's part of the help and its options. `version` (or `--version` / `-V`)
prints the version, the CLI's path, the engine it runs on (its modules, or the bundle — and why a requested bundle was
skipped), the project, which input chose it and its language. A reader that closes the output early (`| head`) ends it
quietly. Switches take `--x` or `--x=true|false`
(any other value is an error) — so do the eval harness's (`--dry-run`, `--set-baseline`, `--require-live`), which
`evals` forwards wherever they stand (an unknown one is refused, exit 2; `evals --help` prints its usage). `doctor` (FAIL), `trace` (gaps), `ears` (errors) and `drift` (drift, a stale baseline or an
unreadable state) exit 1, so they are scriptable; so do `templates check` (an error), `finish` (not ready),
`decide` (an unknown `_Affects:_`) and `stop-check` (the turn would be sent back); `upgrade` exits 0 with its report,
1 only on an error.

```
classify "<description>" [--name n] [--explain]
init [tracks...] [--lang] [--guard on|off|scope] [--stop-check on|off] [--check name="cmd" …] [--roles phase=role+role,… | none]
     [--evidence reported|observed] [--approval-guard off|ask|deny]
steering <file> [--lang]                 templates [list|init|check] [artifact] [--lang]
tracks [list|init <name>|check] [name] [--lang]
signals [list | set <track> <word> off|weak|strong | forget <track> <word>] [--lang]
create "<name>" [tracks...] [--summary] [--kind feature|bugfix|spike|change] [--size xs|s|m|l] [--lang] [--brownfield] [--flow design-first]
bugfix "<name>" [--summary]              spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]
import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name n] [--lang] [--tracks …]
import <plan|execplan|fluidplan> - | --text "<markdown>"   (the document from stdin / inline — a plan outside the project)
list · status [feature]                  doctor <feature> · clarify <feature>
ears <feature|path> | --text "…" | -     trace <feature> [--code] [--matrix | --csv]
next <feature> [--batch] [--max N] [--waves]    brief <feature> [n] [--write] [--include-brief]
done <feature> <n> [--run [--shell bash|pwsh] [--timeout <s>] | --evidence "…" --exit N --cmd "…"]
approve <feature> <phase> [--by NAME] [--role ROLE] [--force [--reason "…"] [--expires YYYY-MM-DD|Nd]]
approve <feature> <phase> --revoke [--reason "…"]     undone <feature> <n> [--reason "…"]
approve <feature> --through <phase> [--role ROLE] [--force]
impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen]    impact [feature] --phase steering
decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"] [--affects ids,…] [--supersedes D-n] [--discovery]
next-action|na <feature>                 finish <feature> [--write] [--include-body] [--run [--shell bash|pwsh] [--timeout <s>]]
append-tasks <feature> --task "…" [--req ids] [--implements paths] [--verify "cmd"] [--makes-green T-01,…] [--expect-fail]
             [--size XS|S|M|L|XL] [--depends 3,5] [--story US1|shared] [--parallel] [--heading "…"]
metrics [feature] [--write]              catalog [--write] · drift [feature] · upgrade [--apply]
export [feature] [--md | --csv | --gherkin | --tracker jira|linear] [--write]
changelog [--since <ISO date|last|all>] [--milestone <name>] [--write]
milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list]
log <feature> [--max N] [-]              stop-check [--message "…" | -] [--agent <type>]
add-track <feature> <track...> [--remove]
feature <remove|archive|rename|restore> <name> [new] [--yes]     feature flow <name> <requirements-first|design-first>
roadmap [--write] [--html] [--lang]      depend <feature> [deps...] [--add x] [--rm x] [--clear] [--order N]
backlog [add|rm|remove <name> [note]]    scan [path] [--cap N] · coverage
evals <feature> [--dry-run ...]          mcp-config [client] · rules <cursor|windsurf|copilot|gemini|agents>
prompts [name] [--args "…"]              statusline [--print-config]
merge-state --install | --uninstall | --check [--project <dir>]     merge-state <base> <ours> <theirs> [<path>]   (git's merge driver)
bundle [--out <file.js>] [--force]       version (or --version / -V)
completion <powershell|bash|zsh|fish>    (the shell's completion script on stdout — INSTALL.md → Shell completion)
```

**Shell completion.** `completion <shell>` prints a script for PowerShell (5.1 and 7), bash, zsh or fish — built from the
CLI's own tables (each command's flags, the values known for a flag or an argument: languages, tracks, phases, flows,
sizes, import formats…), so a new command, flag or value completes without touching it. Feature names come from the
project's `.specs/` on Tab through a hidden `__complete features|archived [--project <dir>]` that never loads the engine
(about Node's startup). Without a `dev-spec` on PATH the script also defines `dev-spec` (running this CLI with `node`); in a
plugin's versioned folder it follows a plugin update to the newest installed version — save it again for the new commands
and flags. Install lines: `completion --help` and INSTALL.md.

**Teams — git's merge driver for the spec state.** `merge-state --install` writes `.gitattributes` (commit it) and this
clone's git config (`merge.dev-spec-state.driver`; every teammate runs it once). Git then runs `merge-state %O %A %B %P` on
`.specs/**/.state.json` and `.specs/roadmap.json` whenever both branches changed one: approvals, ticks, evidence (the
latest run per task, histories merged), the approval history, change requests, sign-offs, backlog, dependencies,
milestones and checks of both branches are united — a revocation wins over an older approval, and a run one branch made
before the other branch reopened (spec_impact --reopen) or unticked that task is stale in the result (a new run is needed). A
real conflict (a setting both branches changed differently, e.g. `meta.lang`, or dependencies whose edges from the two
branches close a cycle — ours is kept at the edge that closes it) exits 1 and stays valid JSON: ours is kept, the file lists each one
under `mergeConflicts` (base / ours / theirs) and `spec_doctor` fails `merge-conflicts` until you pick the values and
delete the list. `ROADMAP.md` / `SPECS.md` keep ours (regenerated on the next write). `--uninstall` removes both.
**Re-run `merge-state --install` after each plugin update:** the git config names the CLI by its path, and a plugin update
moves the versioned plugin folder — a driver whose script is gone makes git report a conflict and keep only ours (a
`git add` then drops theirs). `merge-state --check` (read-only) exits 1 when the configured driver runs another or a
missing script, or when `.gitattributes` names the driver and the clone has none; the SessionStart hook adds one line
while it points at a missing script or another copy.

**Approvals over MCP (other clients).** With `meta.approvalGuard` `ask` / `deny`, the MCP server itself guards an agent's
`spec_approve` (approve, revoke, fast-forward, force), `spec_feature` remove and a `spec_init` that lowers a protection:
a client that supports MCP **elicitation** gets an `elicitation/create` question for its user (the action, the gate —
forced checks, the waiver —, an Approve box and a note); only an explicit approve records it, with `confirmed {via:
"elicitation", at, note}`, and only the version the question showed — an artifact edited while the user decided (or, forced,
a gate failing more checks) → `changedSincePreview: true`, nothing recorded: ask again; decline, cancel or no answer within
5 min (`DEV_SPEC_ELICIT_TIMEOUT_MS`) → `declined: true`, nothing recorded. Without elicitation `ask` runs as before and `deny`
is refused (`humanRequired: true` + the `command`). The Claude Code plugin's server leaves `ask` to the approval hook
(`SPEC_MCP_APPROVAL_HOOK=on` in `mcp/servers.json`); a `deny`-level call that still reaches it got past no hook and is
guarded as above.

`done --run` runs the task's own `_Verify:_` command(s) from the project root and records the evidence (with the git
commit and whether the tree was dirty, when git is available); `finish --run` runs the project checks
(`meta.checks`) and records them — the only CLI commands that execute anything from your spec. On Windows
`--shell bash` is Git Bash, never WSL's `bash.exe` launcher (named by its path, WSL is used as given); `--shell pwsh` /
`powershell` (or `DEV_SPEC_SHELL=pwsh`) runs the command as PowerShell (`-NoProfile -NonInteractive -Command`) — the portable
choice; under cmd.exe a `pwsh -NoProfile -Command "…"` `_Verify:_` runs as written (its `$` is PowerShell's — never refused as
POSIX syntax), while a POSIX shell (`/bin/sh`, `--shell bash`) takes the single-quoted script (it would expand a double-quoted
`$LASTEXITCODE` to nothing — refused before anything runs; `references/verification.md` → PowerShell); a run that could not happen (no shell, a signal,
`--timeout <seconds>` expired — at most 2147483 —, output over 64 MB) records nothing, and neither does a `done --run` that passed
without running a test (`couldNotRun: "no-tests"`); a run ends when its command exits (a background process it started, such as a
dev server, holds nothing up beyond a 2 s drain — a note says so). `log` reads `git log`
(read-only; `-` reads a log from stdin) and lists per task the commits that cite it, plus the +tdd red-first check.
`done --run` / `finish --run` runs are stamped `observed: "cli"` (they count as observed under `init --evidence
observed`). `next --waves` prints the execution waves (+ cycles, blocked tasks); `trace --matrix` prints the requirements
traceability matrix as a table and `trace --csv` as CSV on stdout (data only — `export <f> --csv --write` writes the
file with a BOM and the marker record; the exit code stays trace's). `stop-check` prints the Stop hook's decision for a
closing message (MCP: `spec_stop_check`; `log`'s MCP twin is `spec_log`, fed the `git log` text). `undone` unticks a task —
its evidence turns stale, so a re-tick needs a new run. `statusline` prints one line for Claude Code's status bar (the
feature with work under way, its tasks, unverified ticks and the next step, in the project language; nothing outside a
dev-spec project; exit 0 always; it reads the session JSON on stdin and walks up from its folder to the nearest
`.specs/`) — `--print-config` prints the `settings.json` `statusLine` entry with this clone's absolute path
(`/spec-statusline` installs it). `rules <tool>` prints a rule file with this
clone's absolute paths, to paste into another project; `mcp-config <client>` prints a ready MCP config.

## Hooks (Claude Code, local — never block on their own errors)

| Hook | Event | What it does |
|---|---|---|
| `hooks/guard-hook.js` | PreToolUse (Write/Edit/NotebookEdit) | Only with guard mode on: asks before an edit to a code file outside `.specs/` while no feature has approved, unfinished tasks — except a test file while a feature has an approved test plan and is unfinished (Phase 4 writes the failing tests first) and any code edit while an active spike exists (its prototype); with `guard: "scope"`, once tasks are approved, also for a code file no open task names in `_Implements:_` (test files excepted — the reason names the likely task or `/spec-converge`); silent otherwise |
| `hooks/approval-hook.js` | PreToolUse (`Bash`, `PowerShell`, `Monitor`, `Write` / `Edit`, `spec_approve` / `spec_feature` / `spec_init` / `spec_add_track` under any MCP prefix) | Only with `meta.approvalGuard` `ask` / `deny` (`init --approval-guard`): an agent's `spec_approve`, `spec_feature` remove with `confirm`, `dev-spec approve` / `feature remove --yes` through the Bash, PowerShell or Monitor tool (also inside `bash -c` / `cmd /c` / `pwsh -Command` / `-EncodedCommand`, after PowerShell's `--%`), turning +tdd / +ai off (`spec_add_track {remove}` / `add-track --remove`), a hand or shell edit of `.specs/roadmap.json`, a feature's `.state.json` (also by `dev-spec merge-state` or git's `checkout` / `restore` / `merge-file` / `rm` / `mv`) or a harness-observed log (`.execution/observed.jsonl`), or lowering the guard → `ask` (a permission prompt naming the feature, phase, role and `--force`; Claude Code shows it in auto mode too, only bypass-permissions mode may skip it) or `deny` (refused in every mode; the user sees the `! node <clone>/cli/dev-spec.js …` command to run). A command naming the CLI with an approval word in a form the guard can't read always asks; one too long to read is treated as an approval. Silent otherwise — a shell command not naming dev-spec is never read further; a guardrail, not a sandbox |
| `hooks/spec-hook.js` | PostToolUse (Write/Edit) | On save: `requirements.md` → EARS lint + placeholders; `tasks.md` → traceability (+ EC/NFR/SC warnings); `design.md` → every active track's mandatory sections (`[SaaS]` `[AI]` `[SEC]` `[PRIVACY]` `[DIST]` `[API]` `[UI]` `[OBS]` `[DATA]`, and a track pack's), Constitution Check, placeholders; any spec file → marks `ROADMAP.md` / `SPECS.md` stale (a stamp in `.specs/.execution/`, refreshed once at the end of the turn). Skips `.execution/` and `.specs/templates/` |
| `hooks/spec-hook.js` | SessionStart | Refreshes a stale `ROADMAP.md` / `SPECS.md` (a session that ended before its Stop hook), then one status line per feature (at most 20, the most relevant — then one "+N more — /spec-status" line), plus one line per finished feature whose implementing files drifted, one line when features' open tasks plan the same files (cross-feature overlap), one line while `.specs/` comes from an older dev-spec (`meta.specVersion` absent or older — run `/spec-upgrade`), and one line when `.gitattributes` names the spec state's merge driver but git config runs it from a missing script or another copy (re-run `merge-state --install` after a plugin update — read as text, no git process) |
| `hooks/observe-hook.js` | PostToolUse + PostToolUseFailure (Bash, PowerShell) | Logs a Bash (or PowerShell, with an explicit exit code) run of a task's runnable `_Verify:_` command (or its `&&` join) or of a `meta.checks` command — `{command, exitCode, at, event, session}` — to `.specs/<feature>/.execution/observed.jsonl` / `.specs/.execution/observed.jsonl` (git-ignored, ≤ 64 KB); interrupted or backgrounded runs are skipped. The engine then stamps each reported run `observed: true / false`. Prints nothing |
| `hooks/stop-hook.js` | Stop | First refreshes `ROADMAP.md` / `SPECS.md` when the turn's spec saves left them stale (once a turn); then the end-of-turn evidence gate: when the closing message claims done / verified (EN/PT/ES) while a feature active in the last hours has ticked tasks without passing evidence (or, all tasks done, project checks without a passing run), sends the turn back with the reason; never twice in a row; off with `meta.stopCheck: false` |
| `hooks/plan-hook.js` | PostToolUse (`ExitPlanMode`) | The plan-mode bridge: when the user approves a plan in a dev-spec project, one line of context suggests `/spec-import` of it (`spec_import {tool: "plan", text}` — or `{path}` when the plan file is inside the project); never imports by itself, silent elsewhere |
| `hooks/stop-hook.js` | SubagentStop (`spec-implementer`, `spec-simplifier`) | An implementer's DONE for a task with a runnable `_Verify:_` needs its report (`task-N-report.md`, named in the reply) to carry each `_Verify:_` command and the exit code the task needs (exit 0; a non-zero exit for an `_Expect: fail_` task); a simplifier's DONE needs `simplify-report.md` to end with a `## Final runs` section in which every run exits 0 and every project check is one of the runs — else the stop is sent back |

`hooks/precommit-check.js` is an optional git pre-commit validator (staged EARS errors, phantom references; a stale `ROADMAP.md` /
`SPECS.md` is refreshed first, and staged again when it was staged). The
evidence rules behind the Stop hooks: `references/verification.md`.

**Your defaults (environment variables, 1.16)** — fallbacks only; a project's own `roadmap.json` meta always wins:
`DEV_SPEC_DEFAULT_LANG` (the language a NEW project gets when `spec_init` / its first `spec_create` names none — seeded into
`meta.lang`), `DEV_SPEC_STOP_CHECK` (the Stop gate while `meta.stopCheck` is unset), `DEV_SPEC_GUARD_DEFAULT` (`off` / `on` /
`scope` while `meta.guard` is unset). In Claude Code: the `env` block of `settings.json`, which reaches the hooks, the MCP
server and the Bash tool alike; elsewhere the shell or the MCP config's `env`. An empty, invalid or unexpanded value changes
nothing. `spec_init` reports the values a variable decides in `userDefaults`.

## Directory structure

All artifacts live in `.specs/` at the project root:

```
project-root/
└── .specs/
    ├── roadmap.json              # order + dependencies + backlog + meta (lang, roadmapLang, guard, stopCheck, evidence, approvalGuard, checks, approvalRoles, changelogAt, specVersion, milestones)
    ├── ROADMAP.md  (ROADMAP.html)   # generated — never hand-edit
    ├── SPECS.md                  # generated living catalog (spec_catalog write) — never hand-edit
    ├── RELEASE-NOTES.md          # generated release notes (spec_changelog write) — never hand-edit
    ├── UPGRADE.md                # generated upgrade checklist (spec_upgrade apply) — tick its boxes as you go
    ├── exports/                  # generated stakeholder documents (spec_export write)
    ├── templates/                # the team's own scaffolds (spec_templates) — <artifact>.md, <lang>/, steering/
    ├── tracks/                   # the team's own tracks (spec_tracks) — <name>/track.json + fragments, <lang>/
    ├── classifier.json           # the classifier's signal overrides (spec_tracks signals) — learned from Phase 0 corrections; commit it
    ├── .gitignore                # ignores the transient files (.lock, .roadmap.lock, *.reclaim, a killed process's *.tmp, .removing-*/ tombstones) — commit it
    ├── steering/                 # shared project context (created per active tracks)
    │   ├── constitution.md       # core (always) — non-negotiable principles
    │   ├── product.md  tech.md  structure.md        # core (always)
    │   ├── testing-standards.md                      # +tdd
    │   ├── scale.md  observability.md  cost.md       # +saas (observability.md: +obs too)
    │   ├── ai-strategy.md                            # +ai
    │   ├── security.md                               # +sec
    │   ├── privacy.md                                # +privacy
    │   ├── distributed.md                            # +dist
    │   ├── api.md                                    # +api
    │   ├── ui.md                                     # +ui
    │   ├── data.md                                   # +data
    │   └── <custom>.md           # scoped steering (front matter inclusion: always | fileMatch | manual)
    ├── _archive/<feature>/       # archived features (spec_feature archive / restore)
    └── [feature-name]/
        ├── classification.md     # mode + active tracks + signals + blast radius
        ├── requirements.md       # EARS, stable IDs (US-1.AC-1, SC-001, EC-1, NFR-1)
        ├── design.md             # base sections + the active tracks' mandatory sections
        ├── integration-plan.md   # brownfield (spec_create brownfield: true)
        ├── test-plan.md          # +tdd (Kind column: example | property)
        ├── tests/                # +tdd — failing tests live/index here
        ├── eval-plan.md          # +ai — golden / adversarial / regression sets
        ├── prompts/  evals/      # +ai — versioned prompts + eval sets (JSON) + graders
        ├── load-test.md          # +saas hot path
        ├── quickstart.md         # human-runnable acceptance scenario (manual smoke test)
        ├── checklist.md          # track-aware quality checklist
        ├── tasks.md              # story-organized, traceable plan ([P] = parallelizable, _Verify:_ = proof)
        ├── decisions.md          # the decision log (spec_decide) — append-only, committed
        ├── bug.md                # bugfix flow only — reproduction · root cause · fix (its design approval)
        ├── spike.md              # spike only — question · timebox · options · evidence · decision
        ├── change.md             # change only (size xs) — the whole plan: summary · 1–3 EARS criteria · approach · tasks
        ├── retro.md              # spec_metrics write — the retrospective (never overwritten)
        ├── .history/             # approval snapshots <phase>@<n>.md — commit them with the spec
        └── .execution/           # self-ignoring workspace (briefs, reports, ledger, merge-summary.md)
```

`.specs/<feature>/.state.json` records the feature's language, its track set, `kind` (bugfix / spike / change), `size` (1.21, when given) and `flow`
(design-first), `createdAt`, the latest approval per phase (with a content fingerprint, and `forced` + `failing` for a
forced one, `roles` when signed by roles), pending role `signoffs`, `approvalHistory`, the change requests
(`changes`), verification evidence (`evidence[<task>]`: latest run + history, a red run kept as `red`), when each task
was ticked (`ticks`, `lastTickAt`), the recorded project-check runs (`finishChecks`), the finish baseline (`finished`)
and, once archived, the `archived` record restore uses. Change management in depth: `references/change-management.md`.

## Roadmap generation

**Always-current roadmap overview.** The default is **`.specs/ROADMAP.md`** (git-friendly, keeps
the Mermaid dependency graph): a progress bar, feature table (with an ETA column), dependency graph, "needs
attention", and a backlog of planned-but-unspecced features. **An optional self-contained `.specs/ROADMAP.html`**
(`html: true` / `--html`) renders the same as a brand-styled page (Pro Digital Key palette, offline,
light/dark toggle defaulting to the system theme). It's kept up to date automatically: the engine
regenerates it on every mutation (`spec_create`, `spec_complete_task`, `spec_approve`, `spec_depend`,
`spec_backlog`, `spec_impact` reopen, `spec_feature`…); a spec file you (or the agent) hand-edit in Claude Code marks it stale and the
Stop hook regenerates it once, at the end of the turn (SessionStart, the next mutation and the optional pre-commit check too —
the pre-commit check stages it again when it was staged).
As a backstop, call `spec_roadmap` with `write: true` (CLI: `dev-spec roadmap --write [--html]`). **Pass the
user's language** (`lang` / `--lang pt`) so the roadmap chrome matches — it's stored and reused on
auto-refresh. Track future work with `spec_backlog` (`/backlog add "name"`). The files are
auto-generated — never hand-edit them. Spikes are listed apart (🔬, with their timebox).

**Forecasts.** A task's `_Size: XS|S|M|L|XL_` marker is worth 1 / 2 / 3 / 5 / 8 points (an unsized task counts as its
feature's median, else M). `velocity` = points completed per working day (Mon–Fri) over the last 28 days, from when
`spec_complete_task` ticked each task. Each feature's `forecast` = its open points ÷ velocity (its own once it has 3
completions in the window, else the project's) → an `eta` with a ±25% `range`, starting after any unfinished
dependency's ETA — or `eta: null` with a `reason` (`not-enough-data`, `no-tasks`, `dependency`, `cycle`, `done`).
`spec_metrics` reports the same velocity.

**Cross-feature overlaps.** Two active features whose OPEN tasks plan the same files (`_Implements:_`; a folder covers
the files under it), or an active feature planning files a finished feature recorded in its drift baseline, collide at
merge time — unless a dependency orders them or `_Supersedes:_` declares it. They are listed in `overlaps`, under
"needs attention", in a SessionStart line and as doctor's `cross-feature-overlap` warning: order them with
`spec_depend`, or re-plan the files.

"Needs attention" lists, per feature: unmet dependencies, open clarifications, unfilled track sections
(every active track's — `[SaaS]` / `[AI]` / `[SEC]` / `[PRIVACY]` / `[DIST]` / `[API]` / `[UI]` / `[OBS]` / `[DATA]` — and a track pack's), template placeholders in the current phase, artifacts changed since their
approval, forced approvals, missing role sign-offs, overlaps, a spike past its timebox, and ticked tasks without a
passing run — each named with its reason, as `spec_doctor` gives it (`#1 (latest run failed), #2 (note only,
_Verify:_ command not run), #3`; no label = no run recorded).

A `ROADMAP.md`/`ROADMAP.html` that dev-spec did **not** generate (no `AUTO-GENERATED by dev-spec`
marker) is never overwritten. `lang` on `spec_roadmap` sets only the roadmap chrome language
(`meta.roadmapLang`); the project language (`meta.lang`) is set by `spec_init`.

## Command reference (55 commands)

| Command | Phase | What it does |
|---|---|---|
| `/spec` | entry | Start/resume the whole workflow for a feature — picks mode + tracks, then runs the pipeline (uses `spec_classify`/`spec_next_action`) |
| `/spec-tour` | entry | A guided ~10-minute tour on the user's own repo: one tiny real change through every gate, then keep / archive / remove it |
| `/spec-init` | setup | Scaffold `.specs/steering/` for the active tracks; `--lang`, `--guard`, `--check`, `--roles`, `--stop-check` (uses `spec_init`) |
| `/spec-guard` | setup | Guard mode on / off / scope: code edits ask while no feature has approved tasks (not Phase 4 test files, nor a spike's prototype) — scope: also outside the plan's files (uses `spec_init {guard}`) |
| `/spec-templates` | setup | The team's own scaffolds in `.specs/templates/`: list / init / check (uses `spec_templates`) |
| `/spec-tracks` | setup | The team's own tracks — packs in `.specs/tracks/<name>/`: list / init / check (uses `spec_tracks`) |
| `/spec-superpowers` | setup | With superpowers installed too: a marked precedence block in CLAUDE.md (project or `--user`) routes feature work here; `--remove` |
| `/spec-upgrade` | setup | After a plugin update: audit `.specs/` against the new rules, apply the safe migrations after an OK, then the critic / converge reviews it recommends (uses `spec_upgrade`) |
| `/classify` | 0 | Pick mode + composable tracks; write classification.md (uses `spec_classify`) |
| `/spec-spike` | 0 | A timeboxed investigation that ends in a decision (go / no-go / pivot) (uses `spec_create {kind: "spike"}`) |
| `/createSpec` | 1 | Requirements in EARS with stable AC IDs (uses `ears_validate`) |
| `/clarify` | 1 | Surface requirement ambiguities/gaps before design (uses `spec_clarify`) |
| `/grill` | 1 | Interrogate your understanding of the requirements before design, and fold the answers into requirements.md |
| `/design` | 2 | Design with base + active-track mandatory sections |
| `/testPlan` | 3 | (+tdd) enumerate tests, map to AC IDs, choose layers and Kind (example / property) |
| `/evalPlan` | 3 | (+ai) golden/adversarial/regression sets, graders, thresholds, baseline |
| `/writeTests` | 4 | (+tdd/+ai) failing tests (T-IDs in test names, `trace --code`) + eval harness; the hard gate |
| `/createTask` | 5 | Traceable, ordered tasks with `_Verify:_`, `_Expect: fail_`, `_Size:_` (uses `trace_check`) |
| `/executeTask` | 6 | Implement: core / red-green-refactor / prompt-iteration per task; `--subagents` → implementer + reviewer per task (uses `spec_task_brief`) |
| `/spec-converge` | 6 | Whole feature AC by AC vs the code (reviewer in converge mode) → approved follow-up tasks (uses `spec_append_tasks`) |
| `/spec-doctor` | gate | Health-check a feature; returns readyToAdvance + gate status (uses `spec_doctor`); `--deep` adds the `spec-critic` semantic review |
| `/approve` | gate | Record a phase approval — refused while its checks fail, `--force` records it as forced (`--reason` / `--expires` = its waiver), `--role` signs as a role, `--revoke` withdraws an approval (uses `spec_approve`) |
| `/spec-ff` | gate | Fast-forward: approve every filled planning phase in order, each through its own gate (uses `spec_approve {through}`) |
| `/next-action` | any | "You are here → do this next" + what changed since approval (uses `spec_next_action`) |
| `/spec-impact` | change | What an edit after approval touches; `--reopen` with the user's OK; then re-approve (uses `spec_impact`) |
| `/spec-decide` | change | Record a decision or discovery in `decisions.md` (D-n, `_Affects:_`) (uses `spec_decide`) |
| `/add-track` | any | Escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data, additive; `--remove` takes a track off without deleting files (uses `spec_add_track`) |
| `/feature` | any | Archive / restore / rename / remove a feature, deps kept consistent; `flow` switches design-first; remove needs `confirm: true` (CLI `--yes`) (uses `spec_feature`) |
| `/eval` | +ai | Run the local eval harness (golden/adversarial/regression) with your API key |
| `/roadmap` | any | Multi-feature roadmap: %, deps, blocked, cycles, ETA, overlaps, needs attention; writes `.specs/ROADMAP.md` (uses `spec_roadmap`) |
| `/depend` | any | Show / set / edit feature dependencies and order, cycle-checked; CLI `--add` / `--rm` / `--clear` (uses `spec_depend`) |
| `/backlog` | any | Add/remove planned features shown in ROADMAP.md (uses `spec_backlog`) |
| `/spec-catalog` | any | Living catalog of every feature + AC, superseded ones marked → `.specs/SPECS.md` (uses `spec_catalog`) |
| `/spec-export` | any | One offline, printable document of a feature or the project for stakeholders; `--csv` the traceability matrix, `--gherkin` BDD `.feature` files, `--tracker jira` · `--tracker linear` a tracker import CSV (uses `spec_export`) |
| `/spec-changelog` | after | Release notes (Added · Changed · Fixed) from the specs → `.specs/RELEASE-NOTES.md`; `--milestone <name>` scopes them (uses `spec_changelog`) |
| `/spec-milestone` | any | Milestones: a target date for a set of features vs their ETAs → on-track · at-risk · late · done (uses `spec_milestone`) |
| `/scan` | brownfield | Inventory an existing codebase (uses `spec_scan`) |
| `/reverse` | brownfield | Reverse-engineer steering + specs from existing code |
| `/coverage` | brownfield | Spec coverage of existing code via `_Implements:_` (uses `spec_coverage`) |
| `/spec-import` | brownfield | Import a Kiro / spec-kit / OpenSpec spec, a plan, a Codex ExecPlan, BMAD docs or a fluidplan plan as a new feature (uses `spec_import`) |
| `/spec-bugfix` | bugfix | Reproduce → root cause (with evidence) → approval → failing regression test (`_Expect: fail_`) → fix → verify (uses `spec_create {kind:"bugfix"}`) |
| `/spec-simplify` | close | Optional, before `/spec-finish`: behaviour-preserving cleanups of the feature's own lines, one commit each, proven by the tests and reviewed; `--subagents` → the `spec-simplifier` agent |
| `/spec-finish` | close | Blockers + warnings + fresh checks + a merge summary from the spec chain; then merge locally / keep (uses `spec_finish`) |
| `/spec-drift` | after | Implementing files changed since finish, and what to do about it (uses `spec_drift`) |
| `/spec-metrics` | after | Lead times, rework, forced approvals, change requests, pass rate, velocity; `--write` → retro.md (uses `spec_metrics`) |
| `/spec-review-feedback` | support | Classify review comments against the spec: fix AC violations, route spec changes, push back on out-of-scope |
| `/spec-commit` | support | Conventional commits referencing spec + tests + evals (format below) |
| `/prReview` | support | Track-aware local pre-merge review against the full chain, the project's written rules and the history of rewritten lines; each finding verified (confidence 80+) before it is reported |
| `/promptReview` | support | (+ai) gate prompt changes on eval/cost/version |
| `/migrateModel` | support | (+ai) eval-gated model migration |
| `/spec-status` | any | Mode, tracks, phase, task/test/eval state (uses `spec_status`/`spec_list`) |
| `/spec-statusline` | setup | Claude Code status line: the active feature, tasks, unverified ticks, next step — writes the `settings.json` entry after you confirm (uses `dev-spec statusline`) |

**Aliases:** `/ds` → `/spec` · `/dsx` → `/executeTask` · `/dss` → `/spec-status`. (As a plugin, all
commands are namespaced, e.g. `/dev-spec-driven:spec-doctor`. The `spec-` prefix on `/spec-init`, `/spec-status`,
`/spec-doctor` and `/spec-commit` keeps them from colliding with Claude Code's built-in `/init`, `/status`,
`/doctor` and `/commit`. Other MCP clients get the same commands as MCP prompts.)

## Commit messages (`/spec-commit`)

Conventional commits whose body references the spec chain:

```
feat(billing): implement webhook signature verification

Part of .specs/billing-webhooks/ task #3.
Makes T-05, T-06 green.            # +tdd
Eval delta: golden 82% → 87%.     # +ai
Emits metric webhook_verify_duration_ms.   # +saas
```

Types: feat | fix | refactor | test | docs | chore | style | perf. Phase-4 commits use `test:`. Written this way,
`dev-spec log <feature>` maps every commit back to its task ("task #N" with the feature name, or the T- / AC IDs it
names) and, on +tdd, flags an implementation committed before its test (the red-first check).

# Changelog

All notable changes to **dev-spec-driven**. Format loosely follows Keep a Changelog;
this project versions the plugin as a whole.

## [1.13.0] — 2026-09-25

A full audit of the engine, then gates you can trust and the change-management layer that comes after
a spec is approved: impact analysis, convergence, a living catalog, drift, metrics, import from other
spec tools, an opt-in guard and scoped steering. 29 MCP tools (was 23), 42 commands (was 35).

### Fixed — audit of 1.12 (every fix has a regression test)
- **Evidence gate.** A task whose `_Verify:_` names a runnable command was "verified" by a text note, and a
  bare `{exitCode: 0}` verified a task on its own. Now only `{command, exitCode: 0}` verifies it; a note
  ticks it but leaves it unverified, an exit code only counts next to its command ("exit 0" without one
  is kept as a note), and `{exitCode}` alone is rejected. A failed run on an OPEN task used to be
  discarded — every run is now recorded (never ticked) with a short history (last 5), and a later note
  can't clear it. Evidence records are stamped with their task's text and `_Verify:_` command, so the
  second of two tasks numbered `3.` never borrows the first one's passing run and an edited command's old
  run no longer counts. `spec_complete_task` returns a stable reason code (`unverifiedReason`:
  `failed-run`, `manual-note-on-runnable-verify`, `duplicate-number`, `stale-evidence`, `no-evidence`);
  doctor and `spec_finish` list each unverified task with a localized reason, and ROADMAP.md counts them
  per feature. A `.state.json` whose evidence/approvals aren't objects is refused
  before tasks.md is touched. A task with no runnable `_Verify:_` stays outside the run gate: a v1.12 bare
  `{exitCode: 0}` there still verifies (legacy evidence never leaves a task worse off than none), a later
  note becomes its summary, and the "no evidence" note never claims a `_Verify:_` command it doesn't have.
- **Placeholder and approve gates.** An untouched scaffold passed `doctor` with `readyToAdvance: true`,
  and `spec_approve` stamped anything. Doctor has a `placeholders` check (fail for the current and earlier
  phases, warn for later ones), the approval runs that phase's checks and refuses while any fails, and
  `next_action` no longer loops recommending an approval the gate refuses (it names what it fails on).
  `next_action` also stopped telling a brand-new feature to fix the checks of phases it hasn't reached.
  `spec_finish` could be "ready" with an artifact edited after its approval, template placeholders left in
  the chain, or a bugfix without a root cause; each now blocks. A bugfix's fix task could be ticked before
  bug.md's Root Cause was written — tasks after the root-cause task are now refused until it is, and the
  template's own "Fix the root cause" task can't open the gate for itself. The requirements.md hook no
  longer says "all clean" while placeholders remain. Placeholder detection leaves code alone
  (`[Authorize]`, `[dependencies]`, `[]`, `[0, 1]`) and written-out enumerations (`[owner, admin]`,
  `[id, amount_cents, issued_at]`, `[GET | POST]` — only the templates' own, like `[factories, fixtures, seeds]`,
  stay placeholders), so an approved 1.12 spec with bracketed lists stays finishable; its ID-list check is
  linear (a long space-separated ID list in one bracket used to freeze the server); and it treats the
  scaffold's verbatim +saas/+ai tasks as real tasks. A core-only feature's Signals line is written as
  `- none beyond core` (PT/ES too) — in brackets, the gate refused every core-only classification (created or
  imported) on the tool's own answer — and a pre-1.13 `[none beyond core]` is not a placeholder either.
  `tests` and `execution` were stamped unchecked (an untouched scaffold with 0 tasks done was "finished 0m" in
  `spec_metrics`): approving `tests` now needs every planned T-ID named by a test file (+tdd, `tests-in-code`) and an
  `evals/golden.json` of the feature's own (+ai, `eval-sets`) — nothing to approve on a core-only feature — and
  `execution` runs `spec_finish`'s blockers; `spec_metrics` also reads `finished` from the finish `spec_finish {write}`
  records. A file date alone no longer blocks `spec_finish`: a 1.12 bugfix design approval (no fingerprint) judged
  bug.md by its mtime, so every clone or copy was "changed since approval" and couldn't finish — bug.md is now
  reported as untracked (a warning to re-approve), a pre-1.11 approval's date check is a finish warning, and
  `spec_impact` says `baseline: "none"` (changed unknown) instead of "only its fingerprint was recorded".
- **Gates next_action follows.** SKILL.md calls Phase 4 (failing tests / eval harness) the hard gate, yet no
  surface ever asked for it: on a +tdd feature `next_action` went from the tasks approval straight to "Implement
  task #1" with `gatesOk: true`. Phase `tests` is now pending on a +tdd / +ai feature once its test or eval plan
  exists — `next_action` asks for it (`/writeTests`, then `/approve <f> tests`) before any task, and `gatesOk` /
  `spec_finish` count it (never for a bugfix: its failing regression test is a task). A bugfix's design gate
  (bug.md — Reproduction + Root Cause) was never pending either, because `pendingGates` looked for a design.md:
  it wasn't asked for, finish didn't need it and a later root-cause edit went unnoticed. It is now due on bug.md,
  like approve, impact and changed-since-approval already read it.
- **Task scanner.** Tasks inside HTML comments or fenced code were counted and ticked, `complete` ticked
  the first regex match in the file, `01.` wasn't task 1, and a stray unclosed `<!--` or fence hid every
  task below it (the feature could read as complete). One comment- and fence-aware scanner now serves
  status, next, complete, brief and finish; task numbers are numeric; a duplicated number resolves to its
  first OPEN task (doctor warns `duplicate-tasks`), `done --run` runs the `_Verify:_` of the task it
  ticks, and the tick lands on exactly that line (CRLF kept). Markers in a fenced example under a task
  (`_Verify:_`, `_Implements:_`, AC/T IDs) are the example's, never the task's: `done --run` doesn't
  execute them, and trace_check doesn't count them as coverage or planned files.
- **Tracks.** A Mermaid node `X[AI]` or prose mentioning `[AI]` switched +ai on (doctor then failed ten
  "missing" AI sections). Tracks are now stored in `.state.json`; older features are detected from real
  headings only. `'tdd,saas'` / `'+saas +ai'` are split, unknown names get a did-you-mean error, and
  `spec_create` on an existing feature with new tracks adds them the way `spec_add_track` does. `add_track`
  now updates the Active Tracks line, the track's steering, its template tasks (once) and the stored set.
  A fresh scaffold starts at phase `requirements` (it could report a later one), dot-folders and non-slug
  folders are no longer listed as features, and a tasks-ready feature with nothing done shows 📋 planned.
- **Sections and the merge title.** `extractSection` matched the H1 title (`# Bug: Fix login crash` was
  the Fix section, and fed the merge summary) and any heading merely containing a synonym (`Fixtures` as
  Fix). A synonym must now start an H2+ heading, word-bounded. `spec_status` distinguishes a section that
  is present from one that is filled.
- **Traceability, EARS, clarify.** An OPEN task's `_Implements:_` file that isn't written yet was a
  gap (it is the plan: `plannedImplFiles`); at a drive root (`subst Q:\`) every `_Implements:_` path read as
  outside the project. EC-/NFR-/SC- IDs got `no-id` warnings, a deeper sub-list split its criterion, and a
  template criterion linted clean (new `placeholder` code). A stray unclosed `<!--` above the criteria hid every AC
  from the EARS linter (0 criteria, verdict pass — so the requirements approval passed a criterion with no modal verb)
  while trace_check counted them all; a marker that never closes is now plain text there and in placeholder
  detection, as it already was for tasks. `clarify` finds IF…THEN per criterion, keeps
  real line numbers after multi-line comments and groups placeholder questions. The classifier negates
  across filler words ("sem uso de IA") while PT "no uso do LLM" stays em+o. Every template AC now has a
  task and a test row, so a fresh scaffold traces clean once filled. `spec_create` on an existing feature adding
  +tdd with +saas/+ai planned test rows for US-1.AC-5…AC-9 its requirements never had (`spec_add_track` already
  didn't) — both now share one rule — and `trace_check` reports a test-plan row covering an AC requirements.md
  doesn't define as a gap (`phantomAcsInTests`; doctor and the test-plan approval see it).
- **Robustness.** MCP arguments weren't type-checked: `number: 1.9` (or `1e21`) ticked task 1, `name: {a:1}`
  created `.specs/object-object/`, `cap: "abc"` scanned nothing. Arguments are now validated against each
  tool's `inputSchema` (safe integers, enums, minimum, array items, nested objects) with localized errors.
  Valid JSON of the wrong shape in `roadmap.json` / `.state.json` crashed mutators after their destructive
  step (remove deleted the folder, then threw); it is now refused up front like unparseable JSON.
  Prototype keys (`constructor`, `__proto__`) as feature, steering or rule names are plain keys. `spec_depend`
  accepted dependencies on features that don't exist. `spec_roadmap` reported a refused ROADMAP.md write as
  success. The eval harness now resolves accented and legacy slugs and rejects wrong-shaped sets.
- **CLI ↔ MCP parity.** `finish --include-body`, `classify --name` and `ears --text "…"` / `ears -` match
  their MCP arguments; trace, doctor and the hook list every gap kind with its IDs (they could print
  "gaps-found" with nothing under it); a value flag no longer swallows the next flag; repeated `--add` /
  `--rm` / `--req` are all kept; `--tracks` is merged with positional tracks everywhere; `backlog rm` of an
  unknown name is an error; `ears --text "---"` is a value; approvals default to the same approver on both
  surfaces; `--lang` is checked against `en|pt|es` like the MCP enum (an unknown value such as `fr` became
  `en` and was saved — `init` rewrote the project language). The new MCP enum validation was case-sensitive while
  the CLI (and the 1.12 MCP) took `Design` / `PT` / `Bugfix`: enums the engine folds (phase, lang, kind, action) are
  case-insensitive on both surfaces (`backlog ADD` too); `spec_import`'s tool stays exact.
- **CLI switches, numbers and refusals.** Boolean switches were read by truthiness, so `--x=false` turned them
  ON: `done --run=false` ran the `_Verify:_` commands, `add-track --remove=false` removed the track, `--write=false`
  wrote. `--x=true|false` (1/0, yes/no, on/off) is now honored and any other value is an error. The CLI refuses
  what MCP refuses: a task number like `1.9` / `2abc` (`brief 1.9` briefed task 1 — the engine now refuses it on
  both surfaces), `--cap` / `--max` that aren't integers ≥ 1 (`scan --cap -3` scanned nothing; `spec_next_task`
  `max` gets `minimum: 1` too), an unknown `--kind` (a typo scaffolded a plain feature for good) or backlog action
  (`backlog delete X` just listed). With `--json`, a refused operation prints the engine result
  (`{ok: false, error, recorded…}`) on stdout, as MCP returns it, and exits 1 — stdout used to be empty.
- **Localization.** CLI human output, SessionStart phase names, argument errors and the eval harness speak
  the feature's (or project's) language — EN/PT/ES; `--json` is unchanged. Leftovers fixed: status section
  labels, `depend` and `add-track` lines, usage prefixes, `unknown command`, EARS severities, doctor's ears
  detail, `spec_add_track`'s `added` entries and the ROADMAP.md / ROADMAP.html phase column were English in
  PT/ES projects (the JSON `phase` stays English-stable).
- **Pre-commit.** Staged paths with accents (`serviços/.specs/…`) were quoted by git and skipped; names are
  now read NUL-separated, and the output names the phantom and uncovered IDs. A requirements.md with EARS
  warnings or template placeholders no longer reads "EARS clean" — a non-blocking ⚠ line names them.
- **`done --run` on Windows.** cmd.exe (the default shell) has no single quotes, so `_Verify: node -e
  'process.exit(1)'_` exited 0 and the task was recorded as verified. A `_Verify:_` in POSIX syntax (single quotes,
  `$VAR`) is now refused before anything runs unless `--shell` picks a shell (`--shell bash`, or `--shell cmd` to
  run it under cmd.exe anyway).
- **Docs.** SKILL.md claims match the engine (every execution loop ends in `spec_complete_task
  {evidence}`, the EARS example passes the linter, the constitution check is section presence), the
  description is trigger-accurate and under 1,024 characters, rule files stay true in the copy
  `rules <tool>` prints, PowerShell saves rule files as UTF-8, and the prose guard against PR/CI wording
  covers EN/PT/ES.

### Added
- **`spec_import`** (`dev-spec import`, `/spec-import`): a Kiro, spec-kit or OpenSpec spec becomes a new
  feature — criteria mapped to `US-N.AC-M` (one EARS criterion per scenario, else the text is kept with
  `[NEEDS CLARIFICATION]`), Kiro `_Requirements:_` rewritten, tasks renumbered keeping checkbox state and
  `[P]`/`[USn]` tags, unmapped text carried with a warning. The source must be inside the project and is
  only read; it never imports over an existing feature.
- **`spec_append_tasks`** (`dev-spec append-tasks`, `/spec-converge`): append follow-up tasks under a
  localized `Phase: Convergence` heading, numbered after the last, with `_Requirements:_` / `_Implements:_`
  / `_Verify:_`. All-or-nothing validation (unknown AC IDs refused), existing tasks never change, CRLF/BOM
  kept; an approved task list reports `needsReapproval`.
- **Approval history + `spec_impact`** (`dev-spec impact`, `/spec-impact`): every approval is appended to
  `.state.json → approvalHistory` and snapshots the artifact to `.specs/<f>/.history/<phase>@<n>.md`.
  `spec_impact` diffs the current requirements (by AC and SC/EC/NFR ID), design (by section) or tasks
  against that snapshot and lists the tasks, tests and design sections each change touches; `reopen`
  unticks the affected done tasks, marks their evidence stale and records the change request
  (`.state.json → changes`).
- **`spec_metrics`** (`dev-spec metrics`, `/spec-metrics`): lead time per phase, rework, forced approvals,
  change requests, reopened tasks and evidence pass rate, per feature or for the project (averages and
  medians); `write` creates a pre-filled `retro.md`.
- **`spec_catalog`** (`dev-spec catalog`, `/spec-catalog`): the living catalog `.specs/SPECS.md`
  (AUTO-GENERATED, never over a hand-written file) — every feature's ACs, with the English-stable marker
  `_Supersedes: <feature>/US-n.AC-m_` marking criteria a later feature replaced.
- **`spec_drift`** (`dev-spec drift`, `/spec-drift`): `spec_finish {write}` on a ready feature records a
  hash of its `_Implements:_` files; drift reports what changed, went missing or appeared since then, and
  SessionStart adds one line per drifted feature.
- **`spec_feature restore`** (`dev-spec feature restore`): archive now records the roadmap entry and the
  dependencies it prunes; restore puts the feature and them back. `rename` now follows every reference to the old
  slug — archived features' archive records (restore used to drop the edge as "no longer exists") and
  `_Supersedes:_` markers in other features' requirements.md, active and archived (the auto-refreshed SPECS.md
  un-struck the replaced ACs); the result lists what it rewrote. Doctor warns (`supersedes`) on a `_Supersedes:_`
  reference that resolves to nothing.
- **Guard mode** (`spec_init {guard}`, `dev-spec init --guard on|off`, `/spec-guard`): an opt-in
  PreToolUse hook (`hooks/guard-hook.js`) that asks before a Write/Edit on a code file outside `.specs/`
  while no feature has approved, unfinished tasks — a tasks approval whose tasks.md changed afterwards
  (appended or edited) covers nothing until re-approved. Silent when off; never blocks on its own errors.
  "Code" is any source file — not only the scanner's list, so `.mts`, `.cc`/`.hpp`, Scala, Dart, Elixir, shell,
  PowerShell and SQL edits ask too; docs, config, markup and styles stay silent.
- **Scoped steering**: Kiro-compatible front matter (`inclusion: always | fileMatch | manual`,
  `fileMatchPattern`), custom steering files via `steering_scaffold` / `dev-spec steering`, per-task
  selection in `spec_task_brief` (matching `fileMatch` bodies quoted), and a doctor warning for steering
  files still holding template placeholders.
- **Deeper traceability**: `trace_check` warns about edge cases, NFRs and success criteria nothing covers
  (never the verdict); `trace --code` finds T-IDs in test names (`test("T-01 …")`, `def test_T01_…`,
  `TestT01…`) and doctor warns when a test made green by a done task isn't in any test file.
- **Test plans** gain a **Kind** column (`example` | `property`) with property-based testing guidance in
  `references/test-patterns.md`.
- **Brownfield depth**: `spec_scan` lists HTTP routes with method, path and `file:line` across the common
  web frameworks, test frameworks and test-file count, entrypoints, environment variable names (never
  values, never `.env`) and migration files; `spec_coverage` measures code files named in any
  `_Implements:_` (active + archived features), per folder; `create --brownfield` scaffolds
  `integration-plan.md` (doctor warns while it is the template).
- **`dev-spec rules <cursor|windsurf|copilot|gemini|agents>`** prints a rule file with this clone's absolute
  paths for your own project.
- **Seven commands**: `/spec-impact`, `/spec-metrics`, `/spec-converge`, `/spec-import`, `/spec-catalog`,
  `/spec-drift`, `/spec-guard`.
- A design.md save check in the PostToolUse hook (the active tracks' mandatory sections, Constitution
  Check, placeholders), `spec_finish` `warnings`, `spec_doctor` `nextGate` / `forcedGates`, and
  `spec_next_action` `step` / `refusedGate` / `impact`.

### Changed (heads-up)
- **`spec_approve` refuses** an artifact that is still a template or fails that phase's checks. Pass
  `force: true` (CLI `--force`) to record it anyway — it is stored as forced, with the failing checks, and
  stays flagged.
- **`spec_feature remove` needs `confirm: true`** (CLI `--yes`); without it nothing is deleted and the
  result lists what would be. Prefer `archive`, now reversible with `restore`.
- **`dev-spec depend <feature>` with no dependencies only shows them** — it used to clear the list. Use
  `--clear` (MCP `dependsOn: []`); `--add` / `--rm` (MCP `add` / `remove`) edit it incrementally.
- **A fresh feature starts at phase `requirements`** (8%) until its artifacts hold real content.
- **Two more pending gates.** A +tdd / +ai feature now has a pending `tests` approval (Phase 4) and a bugfix a
  pending `design` approval (bug.md): in-flight features show them in doctor / next_action and can't finish until
  `approve <f> tests` / `approve <f> design`. Approving `tests` checks that the planned tests exist in test code
  (+tdd) and that the eval set is the feature's own (+ai); approving `execution` needs a ready `spec_finish` — or
  `--force`.
- **Windows: `done --run` refuses a POSIX-syntax `_Verify:_`** under the default cmd.exe — add `--shell bash` (or
  `DEV_SPEC_SHELL=bash`), or `--shell cmd` to keep cmd.exe.
- **Renaming a feature edits other features' requirements.md** when they `_Supersedes:_` its ACs; an approved one
  then shows as changed-since-approval (re-review, re-approve).
- **A note no longer verifies a task with a runnable `_Verify:_`** — record the command and its exit code
  (`dev-spec done <f> <n> --run`).
- **Track input is validated**: an unknown track name is an error with a did-you-mean instead of being
  ignored.
- `spec_coverage` now measures code files named in `_Implements:_` (`coveragePercent`, and
  `documented`/`undocumented` are folders with / without a covered file) instead of the folder-name
  heuristic; `spec_scan`'s `candidateEndpoints` counts routes.
- The EN/PT/ES templates changed on purpose: every template AC is planned and tasked, track ACs sit under
  `[SaaS]` / `[AI]` headings, and the test plan has the Kind column.

### Tests
- `node mcp/test.js` 674 assertions (was 181), `node cli/test-cli.js` 221 (was 53); the tool count is
  asserted exactly again (29).

## [1.12.1]

### Changed
- **No pull requests, no CI — anywhere in the workflow.** Before, `/spec-finish` offered to "push and open a
  Pull Request" and several references recommended running evals or load tests "in CI" / "on every PR".
  Integration is now **local only**: `/spec-finish` offers *merge locally* or *keep the branch*, and
  the generated text is a **merge summary** for the merge commit message. `spec_finish` returns
  `mergeTitle` / `mergeSummary` / `paths.summary` (`.execution/merge-summary.md`), replacing
  `prTitle` / `prBody` / `paths.pr` from 1.12.0. Eval, load-test and prompt-review guidance now
  describes a local merge gate. A new test fails if any command, skill, agent or reference text steers
  toward PRs or CI.

## [1.12.0]

More ideas from [obra/superpowers](https://github.com/obra/superpowers) (MIT), rebuilt on the spec engine
so they extend the traceability chain rather than sit beside it.

### Added
- **Evidence before claims** (*verification-before-completion*). A new English-stable task marker
  `_Verify: <command>_` names the command that proves a task. `spec_complete_task {…, evidence:
  {command, exitCode, summary}}` records it in `.state.json`, a non-zero exit code **refuses the tick**,
  and a task declaring `_Verify:_` that is ticked without evidence is flagged by the result, by
  `spec_doctor` (new `verification` check), by `ROADMAP.md` ("needs attention") and by `spec_finish`,
  until the evidence is back-filled. CLI: `dev-spec done <feature> <n> --run` runs the task's own
  `_Verify:_` command(s) and records the result (a failure leaves the task open, exit 1), or
  `--evidence "…" --exit N --cmd "…"`. `spec_status` marks each task `verified`. Briefs carry the
  command and require its output in the implementer's report; the reviewer checks it.
- **Bugfix flow** (*systematic-debugging*): `/spec-bugfix`, `spec_create {kind: "bugfix"}`,
  `dev-spec bugfix "<name>"`. It scaffolds `bug.md` (reproduction · expected vs actual · root cause ·
  fix · regression test), a one-story `IF … THEN THE SYSTEM SHALL …` requirement, a regression test plan
  and the fixed order reproduce → root cause → failing regression test → fix → verify, in EN/PT/ES.
  `spec_doctor` **fails until the root cause is written** (no fix before the cause is known); design.md
  isn't required. `references/bugfix.md` covers the four phases, the "three failed fixes → question the
  design" rule and the red flags.
- **`spec_finish` / `/spec-finish` / `dev-spec finish`** (*finishing-a-development-branch*), tool #23.
  It reports the blockers (doctor fails, open tasks, tasks without evidence, pending approvals) and the
  track-gated checks to run fresh, and **generates the PR title and description from the spec chain**:
  summary, root cause/fix, ACs, tasks with their evidence, tests, checks, spec files. `write:true` puts
  it in `.execution/pr-description.md`. Then the user picks: merge locally, open a PR, or keep the
  branch. It never merges or pushes by itself.
- **`/spec-review-feedback`** (*receiving-code-review*, anchored in the spec): every comment is
  verified and classified before any change. AC violation → fix; spec change → back to its phase for
  approval; out of scope / YAGNI → reasoned push-back citing `Out of Scope`; unclear → ask; no
  performative agreement. See `references/review-feedback.md`.
- **`spec-critic` agent + `/spec-doctor --deep`** (*brainstorming's spec reviewer*): a semantic review
  of the artifact at its gate — completeness, contradictions, ambiguity, testability, scope, YAGNI,
  track coverage, and for bug.md an evidence-backed root cause.
- **Global Constraints** (*writing-plans*): a `## Global Constraints` section in every `tasks.md`
  (EN/PT/ES headings), inlined verbatim into each task brief.
- **Bounded mode** (*brainstorming's three paths*): between Vibe and Spec, a contained change to an
  existing flow gets a short design in chat and an explicit yes, with no artifacts. The ratchet is
  one-way: hidden complexity upgrades the mode.
- **Parallel `[P]` tasks** (*using-git-worktrees* + *dispatching-parallel-agents*):
  `spec_next_task {batch: true}` / `dev-spec next --batch` returns the next open task plus the following
  `[P]` tasks of the same section with declared, disjoint `_Implements:_` files. The subagent protocol
  gains a parallel mode (one worktree per implementer, merge one at a time, full suite after each) and
  a **baseline-green** precondition.
- **Red flags & rationalizations** per phase (`references/red-flags.md`), including the TDD iron law.
  **Verification reference**: `references/verification.md`.
- **Plugin evals** (*writing-skills: test the skill under pressure*): `evals/` cases for
  `claude plugin eval` check that the workflow triggers on planning and bug-fix requests in EN/PT/ES and
  stays silent on unrelated ones. They run locally and cost tokens (never CI). Results are git-ignored.
  The case layout matches `claude plugin eval init --bare` (CLI 2.1.282); run with `--ablation none` so the
  `tool_used: Skill` graders are scored rather than shown as indicators. First run: **5/5 cases at 1.0**
  (15 runs, $1.71). `claude plugin validate .` passes, and the eval harness loaded the MCP server through
  `plugin.json → mcp/servers.json`, which confirms the 1.11 move.

### Fixed before release (independent review of 1.12)
- A failed re-check of an already-ticked task is now recorded, and the task counts as **unverified**.
  Before, it was discarded and the old passing evidence stayed. A non-integer `exitCode`, or a command
  given without its exit code, is rejected; summary-only evidence counts as a manual attestation.
- Parallel batches never cross a `**Checkpoint:**` and never include +ai prompt tasks.
- `_Verify:_` values lose wrapping backticks, and a `[placeholder]` is not treated as a command.
  `done "" --run` fails before running anything.
- `add_track saas|ai` on a bugfix creates `design.md` with the track sections. A different explicit
  `kind` on an existing feature is reported (the stored kind wins). `spec_finish` is never ready with zero
  tasks. `next_action` prompts the test-plan / eval-plan gates.
- PR body: evidence collapsed to one line with safe code spans; the title keeps "e.g." inside the
  sentence. ES bugfix tasks are titled "Tareas".

### Changed
- `spec-implementer` must report `_Verify:_` evidence; `spec-reviewer` checks it (missing or
  non-zero evidence is Important).
- `SKILL.md` stays at ~540 lines: Brownfield, Language and a few supporting sections were condensed
  into pointers to their references.

## [1.11.0]

### Added
- **Subagent-driven execution (Phase 6, opt-in).** `/executeTask <feature> --subagents` (and `/dsx`):
  the main session becomes a controller that never writes feature code. Per task it writes a brief,
  dispatches a fresh **`dev-spec-driven:spec-implementer`** agent, sends the diff to a **`dev-spec-driven:spec-reviewer`** agent
  (verdict per AC ID + code quality + track checks), runs a fix loop capped at 5 rounds (rounds 4–5
  on a fresh, more capable implementer), and only then calls `spec_complete_task`, so a ticked task
  means *implemented and reviewed*. It runs on its own within a story, **stops at every
  `**Checkpoint:**`** for human review, and sends any finding that would change an AC, the design or a
  planned test back to that phase. +ai prompt/eval tasks stay inline. There is an append-only ledger
  for resume after compaction, a pre-flight conflict scan, per-role model selection and a track-aware
  final review. Protocol: `references/subagent-execution.md`. Adapted from the
  `subagent-driven-development` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT).
- **`spec_task_brief` MCP tool + `dev-spec brief <feature> [n] [--write]`** (tool #22). Builds a
  self-contained brief for one task (the next open task by default). It includes the task,
  story/phase/`[P]`/closing checkpoint, the full EARS text of each AC in `_Requirements:_`, the
  test-plan row of each T-ID in `_Makes green:_`, the evals/metrics/files markers, the design sections
  that mention the task, the steering files to read, unresolved (phantom) references, and the
  definition of done for the task's loop. It is generated in the feature's language (EN/PT/ES).
  `write:true` writes `.specs/<feature>/.execution/` (a self-ignoring workspace plus `ledger.md`) and
  returns paths instead of content. It is useful in any tool, subagents or not.
- **Plugin agents** `agents/spec-implementer.md` and `agents/spec-reviewer.md` (task / re-review /
  final modes).

### Changed (heads-up)
- **Renamed the four commands that collided with Claude Code built-ins:** `/init` → `/spec-init`,
  `/status` → `/spec-status`, `/doctor` → `/spec-doctor`, `/commit` → `/spec-commit`. A bare `/doctor`
  ran Claude Code's own doctor, and our messages told users to "run /doctor". `/dss` still points at
  status. If you invoked the old namespaced forms (`/dev-spec-driven:doctor`), use the new names.
- **The MCP server registration moved from a root `.mcp.json` to `mcp/servers.json`** (referenced by
  `plugin.json → mcpServers`). A root `.mcp.json` is also read as a *project* config when the repo is
  opened directly, where `${CLAUDE_PLUGIN_ROOT}` is undefined. That caused the `CONNECTION_CLOSED` error
  in every maintainer session.
- **CLI exit codes:** `dev-spec doctor` (FAIL), `trace` (gaps) and `ears` (errors) now exit 1, so they
  can be used in scripts.
- **`spec_create` tracks are optional in MCP too.** Without tracks a NEW feature is auto-classified
  from name + summary (an existing feature keeps its tracks), the same as the CLI (which gains `--summary`). New `dev-spec steering <file>` subcommand,
  equivalent to `steering_scaffold`. The CLI honours `CLAUDE_PROJECT_DIR` like the server.
- **Everything the engine returns is trilingual:** errors, EARS issue messages (plus a stable `code`),
  classifier notes and reasoning (in the description's language, or `lang`), doctor section names,
  SessionStart lines and pre-commit output. EN text is unchanged.
- The two plugin agents no longer restrict `tools:` (behaviour with unknown tool names is undocumented,
  so a Windows-only `PowerShell` entry could break them elsewhere). Read-only / no-subagents stay as
  rules in the prompts.
- `SKILL.md` is ~530 lines (was ~590): the command table, the annotated `.specs/` tree and the roadmap
  details moved to `references/tooling-reference.md`.

### Fixed — full plugin review (6 parallel reviewers + a final review of this release; every fix has a regression test)
- **Critical: `spec_feature remove` could delete the whole `.specs/`.** A name that slugifies to `""`
  (non-Latin text such as `日本語`, `...`, a missing name) resolved to `.specs/` itself. Every
  name-taking operation now goes through one resolver that rejects empty slugs, `steering` and Windows
  device names (`nul`, `con`, …). The MCP server also validates each tool's required arguments, so a
  missing `name` no longer creates `.specs/undefined/`.
- **Data loss on unreadable JSON.** A `roadmap.json` / `.state.json` with a typo was read as empty and
  then written back, erasing dependencies, backlog, approvals and the project language. Such files are
  now reported and left untouched. A UTF-8 BOM (Windows editors) is accepted. Writes are atomic.
- **The hooks overwrote a hand-written `.specs/ROADMAP.md` in any project.** Only files that carry the
  `AUTO-GENERATED` marker are regenerated, and the hook only acts on dev-spec projects.
- **EARS (PT/ES):** `DEVERÁ`/`DEBERÁ` were never recognised (JS `\b` is ASCII-only), so correct
  criteria hard-failed `doctor`. Numbered prose under Assumptions/Pressupostos ("O utilizador já se
  registou") and template prose ("Cada história deve…") are no longer linted as criteria. ES `SI` was
  added, and `clarify`'s unwanted-behaviour check now looks for IF/SE/SI…THEN (it used CUANDO = WHEN).
- **`doctor` passed a `[SaaS] Observability` section still marked TODO** once an `[AI] Observability
  for AI` heading existed. Sections now prefer the track-marked heading and skip fenced code. An empty
  section counts as unfilled, and zero criteria is a warning, not a pass. AC uniqueness counts
  definitions, not references.
- **`next_action` said "re-review tasks.md" for the whole execution phase.** Approvals now record a
  content fingerprint, and checkbox ticks don't count as edits.
- **Tasks:** a duplicated task number re-ticked the first line forever, and `1.1 sub-step` was parsed
  as task 1. `_Implements: src/user_service.py_` was cut at the underscore. A scaffold whose tasks are all
  still `[bracketed placeholders]` reported phase `tasks-ready`.
- **`spec_depend` with only an order wiped the dependencies.** The CLI now takes `--order 3` /
  `--cap 10` / `--by NAME` (space form) instead of turning `3` into a dependency.
  `roadmap --write --json` prints valid JSON, and the codex TOML path is safe for `'`.
- **`spec_roadmap {lang}` silently changed the project language.** The roadmap chrome now has its own
  `meta.roadmapLang`. `html:true` implies writing.
- **MCP protocol:** a `null` message crashed the server. Malformed JSON gets `-32700`, notifications
  never get a response (and never run tools), and `initialize` negotiates a supported protocol version.
- **The test harness exited 0 when the server died mid-run.** It now fails on early exit and times out
  each request.
- **Hooks:** they now survive a `null` payload or a non-string `file_path`, flush before exit, have a
  10 s timeout, and the stdin safety net can't run the hook twice. The **pre-commit validator** checks
  the **staged** content (`git show :path`), not the working tree, supports nested `.specs/`, and its
  install snippet no longer blocks every commit if the plugin folder moves.
- **Eval harness:** the default model is `claude-sonnet-5` (was the previous generation), with room for
  adaptive thinking (`max_tokens` 4096). A dry run with an invalid set now exits 1, and
  `--require-live` refuses to fall back to a dry run without a key. The references recommended pinning
  `claude-sonnet-4-6-20250929`, which doesn't exist; they now pin exact published IDs.
- **Skill:** the `description` was 2,577 characters, over the Agent Skills 1,024 limit and a likely
  cause of Desktop sync failures. It is now 1,015, and the long trigger lists moved into a "When to use
  this skill" section. `/grill` was added to the command reference, and `steering-templates` now
  lists 9 templates.
- **Wording:** `/tasks` (non-existent) → `/createTask` in `next_action`. PT-PT fixes: *concorrentes →
  simultâneos*, *imposto → garantido*, AO90 forms, and *página → alerta imediato*. ES (Spain): *corre →
  ejecuta*, *ligar → vincular*, *caché*. Slugs now transliterate accents (`Autenticação` →
  `autenticacao`); folders created with the old slug are still found.
- **Caught by the final review before release** (regressions this release had introduced): sections
  filled under `###` sub-headings read as empty (the plugin's own `scale-design-template.md` failed
  `doctor`); `_Affects evals:_` on ordinary code tasks made them inline-only prompt tasks (they now keep
  their tdd/core loop plus an eval check); briefs could show the wrong criterion when one AC mentions
  another; Kiro-style `1.1` sub-tasks became separate briefs; `_Implements:` mid-line; bracket-style
  tasks read as complete after one tick; EARS false errors on open questions, `SI units`, pt-BR
  *Critérios de Aceite*, sub-headings under an AC heading and plural `DEBERÁN`/`DEVERÃO`; `ears_validate`
  missing legacy slugs; an existing `aux` folder that could not be renamed; the hook skipping v1.8-era
  projects.
- **Classifier:** the PT contraction *no* (em+o) no longer negates ("desconto aplicado no checkout" →
  +tdd), while EN "no auth" and ES "no usa LLM" still do. Prose pairs such as `login/signup` and
  `RAG/embeddings` are matched, and paths like `src/rag.ts` still aren't. PT/ES plurals (`migrações`,
  `suscripciones`, `limites de taxa`) are recognised, and new signals were added (*subscrição, sessão,
  sesión, modelo de linguagem/lenguaje, language model, resumir*). `spec_classify` now uses its `name`.
- **EARS reports every vague term** in a criterion, not just the first. The PT/ES vague-word lists now
  include feminine forms and counterparts of *real-time, lightweight, clean, optimal, as needed*.
- `spec_create` on an existing feature keeps the feature's language and says so, instead of mixing
  languages. `spec_coverage` matches whole slug segments ("ui" no longer documents "build-tools") and
  reads only the top-level listing. A JSON-RPC batch gets one array reply. An unexpanded `${VAR}`
  project dir is ignored.
- **Caught by a third review** of the remaining-items round: the language guess read ordinary
  English ("Do the export", "example.com", "USA offices", "Canada") as PT/ES and stopped negating;
  English multi-word keywords got plurals ("tools used" → *tool use*, "loads test" → *load test*); the
  twin keywords `sessão`/`sessao` counted twice; `spec_create` without tracks re-classified an
  existing feature (it now keeps its tracks, and a string `tracks` is accepted again); extensionless
  paths like `routes/login` were split; *leve* ("não leve mais de 5 s") was flagged as vague; the
  pre-commit spoke the project language instead of the feature's; scan/coverage notes were English-only.
- **Docs:** stale `bin/` paths in INSTALL.md, and test/tool/command counts across README, INSTALL,
  CONTRIBUTING, llms-install and CLAUDE.md. The release checklist now includes `marketplace.json`, and
  a test asserts that all three versions agree.

## [1.10.1]

### Fixed
- **Marketplace sync failed on Claude Desktop / claude.ai.** The top-level `bin/` directory is now
  `cli/`. Desktop does not clone the repository — it delegates validation to a remote Anthropic
  service, which rejected the plugin with `status=failed_content`: *"Plugin contains a top-level
  bin/ directory ('bin/dev-spec.js', 'bin/test-cli.js'). claude.ai-hosted plugins may not ship bin/
  executables because they are added to PATH on the CLI but are not shown on the admin approval
  surface. Declare executable entry points via hooks, commands, or mcpServers instead."* The UI
  surfaced this only as **"Marketplace sync failed. Check the repository URL"**, which is misleading
  — the URL was always correct. Installing through the Claude Code CLI was never affected, because
  it uses a local `git clone` and skips this validation, so a passing CLI install is not evidence
  that Desktop will accept the plugin.
- The universal CLI is now `node cli/dev-spec.js` and its smoke test `node cli/test-cli.js` — same
  commands, same assertions. `package.json` (`bin`, `test`, `cli` scripts) and all 16 referencing
  files were updated: `README.md`, `INSTALL.md`, `INTEGRATIONS.md`, `CONTRIBUTING.md`, `CLAUDE.md`,
  `AGENTS.md`, `GEMINI.md`, `llms-install.md`, `examples/`, `integrations/` and the per-tool rule
  files for Cursor, Windsurf and Copilot.

## [1.10.0]

### Added
- **`/grill` — planning-time interrogation of your *understanding*, not just the text.** The sharp,
  decision-tree cousin of `/clarify`: it runs the dev-grill engine (or an inline fallback) over a
  feature's significant decision-branches — business rules, validation → failure paths, in/out of
  scope, the language-agnostic I/O contract, edge cases — one question at a time, then folds the
  resulting shared understanding into `requirements.md` as EARS acceptance criteria and filled-in
  edge-case / out-of-scope / non-functional sections. `/clarify` now points to it for deeper passes.
- **`references/improvement-specs.md` — how to spec internal-improvement work.** Defines the
  *improvement spec*: a feature whose success criterion is a **re-measurable metric delta** (coverage
  floor, size budget, complexity, dead-code, perf/security budgets pulled from the project's guardian
  budgets) rather than new behaviour, with a mandatory behaviour-preserving guard (+tdd
  characterization tests) so "cleaner" never means "broken". Closes the dev-guardian loop: gate
  measures → seeds specs → grill → execute → re-run the gate to prove the delta. `/backlog` now
  routes `guardian-improve` seeds here, and the reference is indexed in the skill's library.

## [1.9.3]

### Fixed
- **Roadmap progress no longer reads ~70% before any code is written.** The completion percentage
  was derived purely from the *phase*, so a fully-planned feature (phase `tasks-ready`, zero tasks
  implemented) reported **70%**, and an `executing` feature reported a flat **85%** regardless of how
  many tasks were actually done — even though implementation is the bulk of the work. Planning now
  tops out at **30%** and the implementation span (`executing` → `complete`) is driven by the *real*
  fraction of tasks completed (`featurePercent`, using the counts `detectPhase` already parsed): a
  planned-but-unimplemented feature reads **30%**, `executing` 2/4 reads **65%**, and only `complete`
  reaches **100%** (in-flight `executing` is capped at 99% so it never masquerades as done). Applies
  to `spec_roadmap`, the generated `ROADMAP.md`/`.html`, and the roadmap-updated message. Regression
  test added.

## [1.9.2]

### Fixed — engine correctness (dogfooding the plugin on its own specs)
- **`ears_validate` was line-based, not criterion-based — it hard-failed any well-written long
  criterion.** EARS phrasing wraps across lines (`WHILE … WHEN … THE SYSTEM SHALL …`), and markdown
  list items continue on the next line. The validator scored each *physical* line: the half carrying
  the ID had no modal verb (**error**), the half carrying the modal verb had no ID (**warn**) — the
  same criterion counted twice. Because `spec_doctor` gates the phase on `errors === 0` (and the
  PostToolUse hook + pre-commit check run the same validator), this **blocked the design gate and
  commits** on any criterion over ~one line. Criteria are now folded into logical blocks first
  (bounded by blank lines, headings, tables, HR and fenced code), then each whole criterion is
  linted. Issues report the criterion's start `line` (plus `endLine` when it spans several).
- **Fenced code counted as acceptance criteria.** A `const shall = 1;` line inside a ` ``` ` block
  matched the modal-verb heuristic. Fence state is now tracked; a fence body is never a criterion.
- **`spec_classify` matched signals as substrings, firing phantom tracks.** `indexOf` fired `claude`
  inside `.claude-plugin/plugin.json` (→ `+ai`), `rag` inside `storage` (→ `+ai`), `sla` inside
  `translate` (→ `+saas`) and `auth` inside `author` (→ `+tdd`). Keywords are now matched at word
  boundaries, keeping inflections (`payments`, `rate-limiting`), plural-only for ≤3-char acronyms
  (so `rag`+`ing` ≠ `raging`), deliberate stems (`idempoten`, `hallucinat`) and `-based`/`-powered`
  adjectives, while rejecting `-<letter>` compounds and dotted/slashed identifiers (`gpt-4` still
  matches). All 260 signal keywords verified to still self-match.
- **A phantom signal silently masked the negation the classifier had computed.** Because the bogus
  strong match turned a track on, the "kept off — negated" note never fired. Negation now annotates
  rather than vetoes: when a track is on *and* has negated keywords, `classify` surfaces the conflict
  (`+ai is ON although 'llm' appeared negated — confirm this is intentional`) for the Phase-0 review.

### Tests
- `mcp/test.js` 66 → 80 assertions (wrapped EN/PT/ES criteria, block boundaries, substring traps,
  inflection/acronym coverage, negation-conflict surfacing).

## [1.9.1]

### Fixed
- **Plugin failed to load hooks: `Duplicate hooks file detected`.** The manifest
  (`.claude-plugin/plugin.json`) declared `"hooks": "./hooks/hooks.json"`, but Claude Code already
  loads the standard `hooks/hooks.json` automatically — the explicit reference loaded the same file a
  second time and errored out. Removed the `hooks` key from the manifest; `hooks/hooks.json` (and its
  PostToolUse/SessionStart `spec-hook.js`) still load via the standard path. `manifest.hooks` is only
  for *additional* hook files.

## [1.9.0]

### Added — trilingual generation (EN / PT / ES): the engine now WRITES, not just reads, three languages
- **Localized scaffolding.** `spec_init` and `spec_create` accept `lang` (`en`/`pt`/`es`); every
  generated artifact (classification / requirements / design / tasks / test-plan / eval-plan /
  load-test / quickstart / checklist), every steering stub, the prompt stub and the evals README come
  out in that language. CLI: `--lang en|pt|es` on `init` / `create`.
- **Single source of truth + per-feature override.** The project language is persisted in
  `.specs/roadmap.json` `meta.lang` (set by `spec_init`, inherited by every new feature); a feature can
  override it, persisted in `.specs/<feature>/.state.json`. Resolution: explicit `lang` > project
  default > `en`.
- **Localized tool messages.** `spec_doctor`, `spec_clarify`, `spec_next_action`, `spec_add_track` and
  the local hooks (EARS / traceability / roadmap-refresh / session start) now respond in the feature's
  language.
- **New module `mcp/lib/i18n.js`** holds all localized content (artifact + steering builders, tool
  messages); `spec.js` keeps the logic and delegates. EN output is byte-identical to 1.8.0.

### Fixed
- `spec_status` scale-section completeness matched English literals only — it now uses the EN/PT/ES
  synonym tables, so a PT/ES design reports section presence correctly.
- `spec_add_track` detected an existing `+tdd` block by the English "Testability Notes" heading only —
  it now matches the localized heading too (no duplicate scaffolding in a PT/ES project).

### Conventions
- Structural tokens stay **English-stable** across all languages (AC/SC/test IDs, `[SaaS]`/`[AI]`,
  `[US1]`/`[shared]`/`[P]`, the `> **TODO**` sentinel, `[NEEDS CLARIFICATION]`, the `_Requirements:_`/
  `_Implements:_` annotation tags, `**Checkpoint:**`, the ` ```mermaid `/` ```typescript ` fences, and
  the eval-harness `## System` heading). EARS keywords and section headings are localized and matched by
  the existing synonym (`SAAS_SECTIONS`/`AI_SECTIONS`) and `RE_*` tables.

### Tests
- `mcp/test.js` 55 → 66 assertions (PT and ES end-to-end scaffolds + per-feature language override);
  `bin/test-cli.js` 34 → 38. Still zero runtime dependencies.

## [1.8.0]

### Added — review-driven UX: real gates, lifecycle, resume
- **Approval gates are now a real gate.** `spec_doctor` adds an `approval-gates` check plus `gatesOk`
  and `pendingGates`: any artifact that exists but whose phase hasn't been approved is surfaced
  (warn-level, so quality fails still dominate the verdict). Progress is sign-off-checked, not just
  quality-checked.
- **`spec_next_action`** (`/next-action`, `dev-spec next-action`) — "you are here → do this next",
  synthesized from phase + doctor verdict + gates, and lists any artifact modified **after** its last
  approval (so a post-approval edit is re-reviewed, not silently shipped).
- **`spec_add_track`** (`/add-track`, `dev-spec add-track`) — escalate an existing feature to
  `+tdd/+saas/+ai`. **Additive only**: scaffolds just the missing artifacts and appends that track's
  mandatory `design.md` sections; never overwrites. Idempotent.
- **`spec_feature`** (`/feature`, `dev-spec feature`) — lifecycle management: **archive** (reversible,
  to `.specs/_archive/`), **rename** (slug + folder + every `roadmap.json` dependency reference), or
  **remove** (destructive). All keep the dependency graph consistent and regenerate the roadmap.

### Fixed
- `spec_roadmap` no longer crashes on a project with no `.specs/` yet (full early-return shape).
- Classifier no longer double-counts overlapping multilingual signals (e.g. `agent`/`agente`).
- `ears_validate`: vague-term detection uses Unicode word boundaries (`clean` no longer matches inside
  `cleanup`); criteria after an inline `<!-- … -->` comment are counted.
- `slugify` no longer leaves a trailing dash when a long name is truncated.
- Roadmap Markdown table escapes `|` in task text (no broken columns).
- Local hook emits exactly one JSON object (idempotent `emit`), and the MCP server reports the real
  package version.

### Security
- MCP tool calls reject a `projectDir` containing `..` path segments (the CLI, user-driven, is not
  restricted). `trace_check` `_Implements:` paths are clamped to the project root. The eval harness
  fetch has a 30s timeout and a `--max-items` cap.

### Packaging / distribution
- **No machine-specific paths committed** — the repo is now portable for `git clone`/download. The
  in-repo MCP dotfiles use workspace-relative references (`.vscode/mcp.json` → `${workspaceFolder}`;
  `.cursor/mcp.json` and `.gemini/settings.json` → `mcp/server.js`), and the `integrations/*` global
  templates carry a `/ABSOLUTE/PATH/TO/dev-spec-driven/…` placeholder. Run
  `node bin/dev-spec.js mcp-config <client>` to print a config with the correct absolute path for your
  machine. (Claude Code's `.mcp.json` already uses `${CLAUDE_PLUGIN_ROOT}`.)

- 21 MCP tools, 31 commands; tests 55 (MCP) + 34 (CLI).

## [1.7.0]

### Added — optional branded HTML roadmap + localized chrome
- **`.specs/ROADMAP.md` stays the default** roadmap output (git/PR-friendly, keeps the Mermaid
  dependency graph).
- **Optional `.specs/ROADMAP.html`** (`--html` / `html:true`) — a **self-contained, zero-dependency,
  offline** page (no CDN/network) styled with the Pro Digital Key brand palette (brand `#11689B`,
  Outfit font), a **light/dark toggle that defaults to the system preference** (`prefers-color-scheme`)
  and remembers your choice. Progress bar, feature table with colored status dots, dependency list,
  needs-attention, and backlog.
- **Localized chrome (EN/PT/ES)** — the roadmap labels are written in the language of the command
  (`--lang` / `lang`), stored in `roadmap.json` `meta.lang` so auto-refresh keeps it. Spec content
  is already in the user's language.
- Auto-refresh updates the MD on every mutation (and the HTML too if it exists). `spec_roadmap`
  gained `html` + `lang`; CLI `dev-spec roadmap --write [--html] [--lang pt]`.

## [1.6.0]

### Added — always-current `.specs/ROADMAP.md`
- **A generated, single-file overview** of every feature: progress bar + overall %, a feature table
  (status ✅🟡⛔⬜, tracks, phase, %, tasks done/total, deps, next task), a **Mermaid dependency
  graph**, a **"needs attention"** section (blocked / open `[NEEDS CLARIFICATION]` / unfilled design),
  and a **backlog** of planned-but-unspecced features.
- **Kept current three ways** (as requested): (1) the engine regenerates it on every mutation
  (`spec_create`, `spec_complete_task`, `spec_approve`, `spec_depend`, `spec_backlog`); (2) the
  PostToolUse hook regenerates it when you hand-edit a spec file; (3) a skill rule + on-demand
  `spec_roadmap write:true` / `dev-spec roadmap --write`.
- **`spec_backlog`** MCP tool + `/backlog` command + `dev-spec backlog [add|rm]` — manage planned
  features (stored in `.specs/roadmap.json`).
- 18 MCP tools, 28 commands; tests 45 (MCP) + 25 (CLI).

## [1.5.0]

### Added — ideas adapted from the official GitHub Spec-Kit (kept EARS-based, local & zero-dep)
- **Prioritized, independently-testable user stories (P1/P2/P3)** + per-story *Independent Test* line,
  and a **Success Criteria** section (measurable, technology-agnostic `SC-001` …) alongside EARS ACs.
- **`[NEEDS CLARIFICATION: …]` inline markers + gate** — `ears_validate` counts them (ignoring
  template comments), `spec_clarify` lists them first, and `spec_doctor` **fails the `clarifications`
  check until they're resolved** (design is gated).
- **Story-organized tasks with story tags + `[P]` parallel markers + `**Checkpoint:**` lines** — the
  tasks template groups by independently-shippable story (Setup → Foundational → Story US-1 (P1) → …
  → Polish). Each task is tagged `[US1]`/`[US2]` or `[shared]` (cross-cutting) so membership is
  obvious even for foundational/setup/polish tasks; `[P]` marks parallelizable work (`[US1][P]`).
  `parseTasks` exposes `story` and `parallel`. The skill documents a fallback to a technical-layer
  layout (keeping the tags) when stories aren't genuinely independent.
- **Worked example** under `examples/demo-project/` — a real, verifiable feature (`api-keys`, core
  +tdd +saas) in the v1.5 shape that passes `doctor` and `trace`, plus a second feature with a
  cross-feature dependency on the roadmap. See `examples/README.md`.
- **Brownfield support** — a read-only `scan` of an existing codebase (no model, no cost), an
  inferred `constitution.md`, and reverse-engineered specs that pass `doctor` + `trace`, via the
  `spec_scan` / `spec_coverage` tools and the `/scan` · `/reverse` · `/coverage` commands.

### Changed
- **Multilingual section headings.** `spec_doctor` and `spec_clarify` now recognize the mandatory
  section headings in EN/PT/ES (the 5 +saas sections, the 10 +ai sections, `Constitution Check`,
  `Success Criteria`, `Independent Test`, `Out of Scope`, edge-cases, NFR). A spec written fully in
  the user's language — headings included — passes the checks. Structural IDs/markers/tags stay
  stable (`US-1.AC-1`, `_Requirements:_`, `[US1]`, `[P]`, `[NEEDS CLARIFICATION:]`). Only code stays English.

### Fixed
- `trace_check` now strips HTML comments before extracting AC/test IDs and `_Implements:_` markers,
  so example markers inside template guidance comments no longer count as real references (matches
  the `[NEEDS CLARIFICATION]` handling).
- **Constitution Check + Complexity Tracking** sections in `design.md`; `spec_doctor` checks the
  Constitution Check section is present.
- **`quickstart.md`** scaffolded per feature — a human-runnable acceptance/smoke scenario.
- **Folded "analyze" checks into `spec_doctor`**: duplicate-AC-ID detection (`ac-uniqueness`),
  success-criteria presence, story prioritization presence.
- Kept EARS as the testable-behavior layer (NOT replaced by spec-kit's FR/Given-When-Then). Did NOT
  adopt the `uv`/Python `specify` CLI, `/speckit.*` naming, or `taskstoissues` (GitHub-coupled).
- Tests now 38 (MCP) + 24 (CLI).

## [1.4.0]

### Added — ideas adapted from GitHub Spec-Kit (SpillwaveSolutions/sdd-skill), kept local & zero-dep
- **Brownfield / reverse-engineering** — `spec_scan` (heuristic codebase inventory: stack, modules,
  endpoints) and `spec_coverage` (% of code modules with specs). New `/scan`, `/reverse`,
  `/coverage` commands + `references/brownfield.md`; a Brownfield mode in the skill.
- **Constitution** — `constitution.md` is now a core steering file (project principles/laws);
  `spec_doctor` checks it's present and the skill/`/prReview` check designs against it.
- **Multi-feature roadmap + dependencies** — `.specs/roadmap.json`, `spec_roadmap` (per-feature
  completion %, blocked status, overall %, cycle detection) and `spec_depend` (declare deps/order,
  **rejects circular dependencies**). New `/roadmap`, `/depend` commands.
- **Clarify phase** — `spec_clarify` surfaces requirement ambiguities/gaps (vague terms,
  placeholders, missing edge-cases/NFR/out-of-scope, missing IF…THEN, track-specific gaps) before
  design. New `/clarify` command, wired into Phase 1.
- **Spec ↔ code traceability** — `trace_check` now parses `_Implements: path_` task markers and
  flags missing files (orphaned specs).
- **Per-feature `checklist.md`** (track-aware) scaffolded with each feature; structured phase-summary
  guidance at every gate.
- Engine grew to **17 MCP tools** and **27 commands**; tests now 35 (MCP) + 23 (CLI).

## [1.3.0]

### Added — cross-tool support (works beyond Claude Code)
- **Universal CLI** `bin/dev-spec.js` (`dev-spec`) — the whole engine from any terminal or tool,
  even without MCP: `classify`, `init`, `create`, `list`, `status`, `doctor`, `trace`, `ears`,
  `next`, `done`, `approve`, `evals`, and `mcp-config` (prints ready configs per client). Added to
  `package.json` `bin`.
- **`AGENTS.md`** — portable, tool-agnostic version of the workflow (read by Codex CLI, Gemini CLI,
  and other agent tools).
- **Per-tool rule files** — `.cursor/rules/dev-spec-driven.mdc`, `.windsurf/rules/dev-spec-driven.md`,
  `.github/copilot-instructions.md` (a static instructions file, NOT a GitHub Action), and `GEMINI.md`.
- **`INTEGRATIONS.md`** — step-by-step setup + exact MCP config for Claude Code, Claude Desktop,
  Claude CoWork, Cursor, Windsurf, GitHub Copilot (VS Code), Gemini CLI, OpenAI Codex CLI, any MCP
  client, and plain CLI.
- **`integrations/`** — ready-made, path-filled config files per client (+ `integrations/README.md`
  mapping each to its destination). Root `.cursor/mcp.json`, `.vscode/mcp.json`, `.gemini/settings.json`
  make this folder MCP-enabled out of the box and double as live examples.
- `bin/test-cli.js` (17 assertions) added to `npm test` alongside `mcp/test.js` (27).
- README compatibility section.

The same local, zero-dependency engine now reaches every MCP/agent tool — still no GitHub Actions,
no cloud, no cost. Claude-specific slash commands/hooks remain Claude-only, but every function they
trigger is available via `dev-spec` and the MCP tools.

## [1.2.0]

### Added / Improved (semantic layer)
- **Multilingual classifier** — `SIGNALS` now covers EN/PT/ES plus technical synonyms across all
  three tracks, so Portuguese/Spanish feature descriptions classify correctly.
- **Weighted signals** — signals are split STRONG (enables a track alone) vs WEAK (needs
  corroboration). A lone weak signal (e.g. "agent", "model") is surfaced as `possible` rather than
  auto-enabling a track, cutting false positives. Confidence is reported per track.
- **Negation after the keyword** — detects "auth is not needed", "auth não é preciso", etc., in
  addition to "no auth" / "sem auth".
- **EARS in PT/ES** — `ears_validate` accepts `DEVE`/`DEVERÁ` (PT) and `DEBE`/`DEBERÁ` (ES) as
  modal verbs alongside `SHALL`, and recognizes EARS keywords QUANDO/ENQUANTO/SE/ONDE and
  CUANDO/MIENTRAS/SI/DONDE.
- **Expanded lexicons** — `VAGUE_WORDS` (EN/PT/ES weasel words) and the eval `REFUSAL` markers
  (EN/PT/ES) are much broader.
- Richer skill `description` triggers: more natural-language intents in EN/PT/ES.

## [1.1.0]

### Added
- **`spec_doctor`** — one health-check per feature (EARS lint + traceability + steering presence
  + design/Mermaid + mandatory +saas/+ai section completeness) returning a `readyToAdvance` verdict.
- **`spec_approve`** + `.specs/<feature>/.state.json` — auditable, resumable phase-approval gates.
- **Bidirectional `trace_check`** — also flags phantom AC/test IDs referenced by tasks (typos).
- **Local hooks** (`hooks/hooks.json`): PostToolUse lints `requirements.md` (EARS) and checks
  `tasks.md` (traceability) on save; SessionStart prints feature status. Optional git
  `pre-commit` validator (`hooks/precommit-check.js`). The free substitute for CI.
- **Local eval harness** (`mcp/evals/run-evals.js`) — runs golden/adversarial/regression sets
  against a model with your own `ANTHROPIC_API_KEY`; `--dry-run` works offline; `--set-baseline`
  records a baseline. Sample `golden.json`/`adversarial.json` scaffolded for +ai features.
- **Smarter classifier** — negation handling ("no auth", "sem LLM"), per-track confidence levels,
  and weak-signal flags.
- New commands: `/doctor`, `/approve`, `/eval`; aliases `/ds`, `/dsx`, `/dss`; PT/ES triggers.
- Project meta: `package.json`, `LICENSE` (MIT), `CLAUDE.md`, a combined-track worked example,
  and dev-guardian / ui-ux-pro-max handoff guidance.

### Fixed
- AC/test ID extraction missed IDs wrapped in markdown italics (`_US-1.AC-1_`) because `_` is a
  word char and defeated `\b`. Now uses a lookbehind guard; trace + EARS detect all IDs.
- Hook stdout could be truncated on Windows pipes (exit raced the flush); now flushes first.

## [1.0.0]

### Added
- Initial unified, track-based plugin merging four predecessor skills into one
  (`core` + optional `+tdd` / `+saas` / `+ai`), with a Phase 0 classifier.
- Local, zero-dependency stdio MCP server `spec-driven` with: `spec_init`, `spec_classify`,
  `spec_create`, `spec_list`, `spec_status`, `spec_next_task`, `spec_complete_task`,
  `ears_validate`, `trace_check`, `steering_scaffold`.
- 15 slash commands, a deep `references/` library, README, INSTALL, and a bundled
  `.claude-plugin/marketplace.json` for local install. No GitHub Actions anywhere.
- The four original skills preserved under `_archive/`.

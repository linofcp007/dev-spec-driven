# Changelog

All notable changes to **dev-spec-driven**. Format loosely follows Keep a Changelog;
this project versions the plugin as a whole.

## [1.22.0] — 2026-10-08

Reviews you can trust, and an optional simplification pass before finishing. Both ideas come from Anthropic's
`code-review` and `code-simplifier` plugins (claude-plugins-official), rebuilt around the spec and the evidence gate:
local, no pull requests, no CI.

### Added
- **Every finding is verified before it costs a fix round.** The `spec-reviewer` agent rates each Critical / Important
  finding 0–100 and lists what is not a finding: a problem that was already there, one on lines the diff left alone,
  what an AC, the design or a decision asks for, what a green check already answers, a rule switched off on purpose, a
  nitpick. Its new **verify** mode takes ONE finding and judges it fresh — does it exist at HEAD, did this diff
  introduce it, is it intended, is it already answered? In `/executeTask --subagents` the controller sends every ❌ and
  Critical / Important finding to a verify pass (one cheap reviewer per finding, in parallel): **80+** opens a fix round,
  **50–79** is ledgered as unconfirmed (shown at the checkpoint, triaged by the final review), **under 50** is refuted.
  The facts the report or the diff settle (a missing run, a non-zero exit, a changed planned test) skip it. An ❌ comes
  back confirmed or refuted with the file:line that satisfies the AC — never unconfirmed: an AC with no code is never
  "pre-existing". A break the diff causes on lines it didn't touch (a caller of a contract it changed) is the diff's.
- **`/prReview` verifies before it reports** — the same questions per finding (a verify-mode reviewer each, or checked
  inline and labelled self-verified); only 80+ is reported as a finding, the rest listed as "Unconfirmed (below 80)".
- **Two review angles a diff-only read misses:** the project's written rules — the constitution, the `CLAUDE.md` /
  `AGENTS.md` of the touched directories, the comments around the changed code ("keep in sync with…"), each quoted with
  its file:line — and the history of the lines a change rewrites (`git log -L`, `git blame`): a fix there must survive,
  and a finished bugfix in `.specs/` whose tasks implement the file keeps its Root Cause away and its regression test
  unchanged. A fixed bug brought back is Critical.
- **`/spec-simplify`** (55 commands) — an optional pass after the last task and **before** `/spec-finish`:
  behaviour-preserving cleanups of the lines the feature's branch added or changed (the deferred minor smells first),
  one commit each, the covering tests after every change and the project checks at the end. Never a test, a contract, a
  dependency, a prompt file or code the feature didn't write. The pass is reviewed (the reviewer's new **simplify**
  mode), a confirmed finding is **reverted** (with the commits that build on it), never repaired, and each changed task's
  `_Verify:_` and the project checks are recorded again (a failing re-check makes the task unverified). With guard mode
  on, each edit of the pass asks the user — every task is done, so no open task covers it. Claude Code's built-in
  `/simplify` is not run inside the pass (it applies its cleanups in one go). next_action's "all tasks done" step
  mentions it.
- **The `spec-simplifier` agent** (4 plugin agents) does the pass under `--subagents`, and the SubagentStop gate now
  covers it (hooks.json matcher `^(dev-spec-driven:)?spec-(implementer|simplifier)$`): its DONE is sent back unless
  `.specs/<feature>/.execution/simplify-report.md` ends with a `## Final runs` section — everything after its last such
  heading, one line per run at the margin, ``- `<command>` → exit 0``, output indented below — in which every run passes
  and every project check is one of the runs (as a whole command: a longer one that starts with it, like a re-run
  `_Verify:_`, never stands in). A baseline run, a code quoted in output, a fenced block or a failed run followed by a
  passing one never pass it; the report is read from its end. `dev-spec
  stop-check --agent spec-simplifier` and `spec_stop_check {agent}` give the same decision (`why`: `simplify-ok` ·
  `simplifier-evidence` · `no-changes` · `no-report`; EN / PT / pt-BR / ES).

### Changed
- `references/subagent-execution.md`: step 6 "Verify the findings" before the fix loop (now step 7), the simplification
  pass before closing, the verify and simplifier rows in model selection, three new rationalizations.
- `references/code-reuse-and-quality.md`: "The simplification pass" (the rules and why), a checklist item.
- The evidence gate's "not-done" line now says "the subagent" (it covers the simplifier too).
- **A run proves a task only when it IS the task's `_Verify:_` command.** Any other command (`echo ok` for `npm test`, another
  test file, one of two `_Verify:_` commands alone, a `cd` into another folder) ticks the task but leaves it unverified —
  the new reason `command-mismatch` (EN / PT / ES). Spacing, quotes, `\` vs `/`, a trailing `2>&1`, your own `cd <project
  root> &&` / `set -o pipefail;` / `VAR=value` don't matter; a prefix the `_Verify:_` holds must be there. A project
  check's run is held to its `meta.checks` command the same way (`changed`). Runs recorded by an older dev-spec keep the
  verdict they had — a plugin update never turns a verified task unverified.
- **Criteria numbered with a bare `AC-1` are flagged** — EARS warns (`no-id`), trace_check reports them
  (`unidentifiedCriteria`), and doctor's `ears` check and the requirements / change-plan approvals fail instead of "all 0
  ACs covered". `/spec-upgrade` lists such features with the way out (renumber them US-<story>.AC-<n>, then re-approve).
- `references/subagent-execution.md`: in parallel mode the controller creates each worktree from the recorded BASE (the
  Agent tool's isolation started from the default branch, without the earlier tasks).
- Faster: the spec-hook ~173 → ~68 ms per edit outside `.specs/`, the Stop hook ~235 → ~88 ms on an idle project, a tick
  with its ROADMAP.md refresh ~185 → ~65 ms (30 features × 40 tasks), the fast-forward ~1.2 → ~0.4 s, the pre-commit
  check ~238 → ~127 ms, an English `list` ~144 → ~66 ms.

### Fixed
- An implementer's "**Status:** `DONE`" (the status in backticks) read as no claim, so its report was never checked; a
  status token in inline code on the status line is read now — any other code span still isn't ("`order.status ===
  "blocked"`" or "with status `blocked`" in a commit line is no status).
- **Evidence and runs.** `done --run` / `finish --run` take a run's time and stamps BEFORE it runs (an edit made during a
  long run read as tested). Folders a run `cd`s into are resolved from the project root (`cd ../other-project && npm test`
  proved `npm test`; `cd ./packages/web` or an absolute path didn't prove `cd packages/web`); a `cd` into a git worktree of
  the project — beside it or inside it (`.claude/worktrees/<name>`) — is that worktree's root; `cd #` and a `cd` inside
  `$(…)` / backticks prove nothing. An `_Expect: fail_` task is never verified by a red run of another test file. Its note
  says to set the fix aside with `git stash push -- <the fix's files>` (a bare `git stash` also takes tasks.md and
  .state.json). On a Portuguese or Spanish Windows, `done --run --shell cmd` took cmd.exe's own failure ("O sistema não
  conseguiu localizar o caminho especificado", read from the console's code page) as a red run. Observed mode
  (`meta.evidence: observed`) sees every form reported mode accepts (`tests\x.test.js`, a reversed join, `CI=1 …`, the steps
  of a `_Verify:_` holding ` && ` run one by one). `* [ ]` / `+ [ ]` bullets are task lines; doctor warns about checkbox
  lines it can't read as tasks (`unread-tasks`). A task number is an integer ≥ 0 on every surface; `depend --order` a safe
  integer.
- **The stop gate** read "0 tests failing", "none of the tests fail" or "the 2 failing tests now pass" as admissions and
  stayed silent; tasks ticked by hand counted as no activity; only the first 50 features were read. The implementer's gate
  checked the FIRST task report its reply named, not the last.
- **The approval guard** let an approval through at `deny` behind an unquoted `cmd /c …`, `pwsh -Command …`, `Start-Process`,
  `find -exec`, `winpty`, `flock` or `script -c`; and `SPEC_MCP_APPROVAL_HOOK=on` waved a deny-level approval through the MCP
  server.
- **Gates and lifecycle.** The Phase 4 `tests` approval is pending again once a T-ID is planned after it or a plan is
  re-approved with other content. An approval over MCP elicitation records only what the user was shown (an edit meanwhile
  is refused: `changedSincePreview`). A deleted approved artifact counts as a change (next_action: restore or revoke). A
  re-approval of unchanged content after a finish no longer makes the finish stale. `_Affects:_` can name a heading holding
  "," or ";". Doctor names the stale tests sign-off only while `tests` is pending. Hashing a file over 512 MiB works.
- **Requirements and traceability.** A `<!--` in a feature's summary hid every criterion. `checkout/US-3.AC-2` written in
  prose is another feature's criterion, not a required one. A spec of NFR-n / EC-n / SC-n criteria alone passes the gates,
  and so does a criterion whose ID is not at its start (`… in 200 ms (NFR-1)`). Each criterion is judged by its own ID: one
  numbered `AC-1` is flagged even when it cites a US-n.AC-m, and an `AC-2` it only quotes (in `_Supersedes:_`, behind
  another feature's name, in a URL) is not its number. "clean" as a verb is no vague term. UTF-16 files (with a BOM) are
  read everywhere.
- **Classifier.** Two-factor / multi-factor authentication counts for +sec in Portuguese and Spanish too ("autenticação
  forte de dois fatores", "inicia sesión con doble factor"), and only as authentication: "depende de dois fatores", "a
  multi-factor risk model" or "a multi-factored discount" are no +sec signal. A track kept off with weak signals says so
  ("off — weak signal only"), never "no signals matched".
- **Brownfield scan and coverage.** The cap counts code files, not every file. Folders the ROOT `.gitignore` excludes are
  skipped as Git reads them — its negations and a nested `.gitignore`'s (`!frontend/src/lib/`, `!src/**`), a BOM, a UTF-16
  file (no pattern), leading blanks — and so are folders whose own `.gitignore` ignores everything; `testdata/` is fixtures.
  Nested manifests (monorepos) join the stack; docs / examples manifests don't; a root manifest linked outside the project
  is never read.
- **Imports and exports.** `spec_export {write}` never writes through a linked folder or document. spec-kit's bulleted
  scenarios, a title in a non-Latin script, BMAD subtasks (their parent's `(AC: n)`), "Run `npm test` and expect …" (no
  criterion), a plan step's `cd packages/web && npm test` (imported whole as the `_Verify:_`), and a bare `AC-1` in imported
  fluidplan prose are read correctly.
- **CLI.** `--json` on a text-only command (help, rules, mcp-config, evals) is a usage error; `evals` exits 1 when the
  harness never ran; `dev-spec rules agents` writes absolute paths.

### Tests
- `node mcp/test.js` 1803 assertions (was 1680), `node cli/test-cli.js` 535 (was 522) — a regression per review finding,
  and: the simplifier's SubagentStop gate
  — its `## Final runs` section: no report, a baseline only, a red run, a failed run hidden by a later passing one, a code
  quoted in output or in a fenced block, a check never run or without its code, a longer command starting with a
  check's, a check listed twice, a run nested under a group bullet, "# pass 212" output lines, a revert round with and without a new heading, a 256 KB
  report read from its end (also when the window starts inside a fence), a double-backtick command, a status in
  backticks vs a code span holding "blocked"; NO_CHANGES / BLOCKED / no report path allowed; the hook's reason = the
  engine's; EN / PT / pt-BR / ES strings; `stop-check --agent spec-simplifier` in PT —, the hooks.json matcher, 4 agents
  and 55 commands, and the prose of the verify pass, the written rules and history, the simplify mode and the
  simplification pass.

## [1.21.1] — 2026-09-30

PowerShell projects — and every language outside the old short list — work end to end.

### Fixed
- **One list of languages everywhere.** `spec_scan`, `spec_coverage`, `trace_check {code}` and the Phase 4 tests gate now
  use the same broad list of languages as guard mode. A PowerShell, shell, SQL, Lua, R, Perl, Erlang / Elixir, Haskell,
  Clojure or C++ project is scanned, counted and has its tests read — before, it scanned empty and its +tdd tests gate
  could never pass. Coverage percentages of existing projects can drop: SQL migrations, shell scripts and similar files
  now count as code. SQL and notebook fixtures in test folders count as neither code nor tests.
- **Test files are recognised in every language:** Pester `*.Tests.ps1` (also beside the code), Bats, `*_test.sh`,
  GoogleTest `*_test.cc` / `*_unittest.cc`, busted `*_spec.lua`, testthat `test-*.R`, Common Test / EUnit, clojure.test,
  XCTest, Perl `t/*.t`, C / shell / hspec tests in test folders, and SQL tests (pgTAP) a test plan's File column names —
  the file, or the folder that directly holds it (they count for those rows only).
- **The scan reports a PowerShell project** — a module manifest, a Pester suite, or mostly PowerShell code: the stack,
  Pester, the scripts and the module's entry point, and `$env:` names. It also reads CMake / Make, mix, rebar, pubspec,
  sbt, SwiftPM, cabal, deps.edn, R, Julia, Zig, dune, nimble and cpanfile manifests.
- **`done --run` / `finish --run` run PowerShell checks:** `--shell pwsh`, `--shell powershell` or `DEV_SPEC_SHELL=pwsh`
  run the bare script (`_Verify: Invoke-Pester -Path tests -CI_`) with `-NoProfile -NonInteractive -Command` — the
  portable choice. Under the default cmd.exe, `pwsh -NoProfile -Command "Invoke-Pester -Path tests -CI; exit
  $LASTEXITCODE"` now runs instead of being refused as POSIX syntax; under a POSIX shell (bash, sh) a pwsh script holding
  `$` must be single-quoted — a double-quoted one is refused before it runs, because the shell would turn
  `exit $LASTEXITCODE` into `exit 0`.
- **A PowerShell or Pester run that never ran the test is no red proof:** an unknown cmdlet, a missing module, the
  execution policy, a missing `-File` script, a Pester block or test file that failed before its tests, "No test files
  were found", or PowerShell's own parse error is refused with nothing recorded; a test that ran and failed stays red;
  colour codes are stripped from run summaries.
- The plan importer reads `.psm1`, `.psd1` and `.bats` file names as `_Implements:_` paths; a bare `color.r` or
  `args.cmd` needs a folder part.

### Tests
- `node mcp/test.js` 1680 assertions (was 1653), `node cli/test-cli.js` 522 (was 508): a PowerShell project end to
  end on MCP and the CLI (scan, coverage, the +tdd tests gate over a Pester file, guard and scope guard), the test-file
  matrix of every language with its negatives, T-IDs found in each language's test files, SQL fixtures past the read
  cap, `--shell pwsh` / `powershell` runs and the POSIX refusal, the could-not-run vs red readings of real pwsh 7 / 5.1
  and Pester 3–6 output, and a 200 KB linearity sweep over every new pattern.

## [1.21.0] — 2026-09-30

Rigor sized to the change, and a spec that works in a team: a typo no longer carries a feature's ceremony, git merges the
spec state, approvals can be put to the human over MCP, the classifier learns from your Phase 0 corrections, and +data
joins the built-in tracks. 38 MCP tools, 54 commands, eleven built-in tracks (was ten).

### Added — right-sized rigor
- **Feature sizes** — `spec_create {size: xs|s|m|l}` / `create --size` (`spec_classify` suggests one: `suggestedSize`,
  `sizeReason`, `sizeNote`). At **S** a feature scaffolds one story (a WHEN and an IF…THEN criterion plus its tracks'),
  one core task and no classification.md; the core design sections merge into "Decisions, reuse & risks"; a track's
  *extended* sections may be absent or one `n/a — <reason>` line (the table in `references/track-checklists.md`), and
  `spec_clarify` asks no edge-case or NFR questions. **M** /
  **L** keep the full chain. At XS / S next_action offers to approve the whole plan in one call (`approve --through`,
  `fastForward`) — with +tdd or +ai it ends before Phase 4, which needs the failing tests or eval sets first.
- **XS is a change** — `kind: "change"` (or size xs on a plain feature) writes ONE `change.md` holding its criteria and
  tasks: two approvals (the plan and the execution sign-off), at most 3 criteria or tasks (doctor `change-scope`), no
  tracks. Its criteria and its tasks are read apart, so traceability, EARS, the plan gate, the pre-commit and save hooks,
  `spec_impact` (criteria by ID, tasks by number, `--reopen`), `spec_clarify` (only a change's own questions),
  `spec_decide --affects` (a `change.md` section), approvals by role, exports, the matrix and release notes treat it as a
  change. An XS bugfix skips the first two steps and keeps the root-cause gate.
- **Overlapping track sections merge** on a sized feature — `[SaaS] Observability` is covered by +obs's Telemetry and
  Alerting, `[SaaS] Performance Budget` by its SLIs & SLOs; the covered section reads `covered` (with `by`) and its
  duplicate task or checklist item is dropped. Removing the covering track puts the covered sections back in design.md
  (`restoredSections`).
- Measured on 14 features of every size: slots −36%, tasks −29%, approvals −27%, calls −22% (XS 28 → 15 calls, S 85 → 40);
  M and L lose ~10% of their slots. **A feature without a size scaffolds exactly as in 1.20**, and `spec_upgrade` never
  assigns one.

### Added — team collaboration
- **Git merges the spec state** — `dev-spec merge-state --install` (once per clone, and again after each plugin update;
  commit `.gitattributes`) makes git merge `.state.json` / `roadmap.json` by meaning: the approvals, ticks, evidence,
  history, sign-offs, backlog, dependencies and milestones of both branches are united (revocations win by time). A real
  conflict exits 1 and stays valid JSON (`mergeConflicts`); doctor fails `merge-conflicts` until it is resolved.
  ROADMAP.md / SPECS.md keep ours. Role sign-offs completed across two branches are reported as such
  (`signoffsComplete`: one role signs again to record the approval). `merge-state --check` — and one session-start line —
  report a driver that points at an old or missing plugin folder.
- **Human approvals over MCP elicitation** — with `approvalGuard` ask / deny, the MCP server asks the user through
  `elicitation/create` before an agent's `spec_approve` (approve, revoke, fast-forward, force), `spec_feature` remove or a
  `spec_init` that lowers a guard; only an explicit approve is recorded (`confirmed`); a decline, a cancel or no answer
  within `DEV_SPEC_ELICIT_TIMEOUT_MS` (5 min) records nothing. Without elicitation, `deny` is refused (`humanRequired`)
  with the plain command for the user to run. The Claude Code plugin keeps its hook (`SPEC_MCP_APPROVAL_HOOK=on`).

### Added — classifier
- A negation that governs a list reaches every item ("no payments or subscriptions", "sem pagamentos nem subscrições",
  "sin pagos ni suscripciones", "we will not add X or Y"); a list ends at its closing "or" / "nem" / "ni", at "and" / "e" /
  "y", at a contrast ("no X, just Y") and at a new clause. A negation excludes a track only when it certainly governs
  the keyword — "no payments", "we don't use Kafka", "we will not add an LLM", "no need for Kafka", "we should not enable
  feature flags", "não queremos usar LLM nem embeddings", "nunca usaremos Kafka"; anything else keeps the track for you to
  confirm in Phase 0: a modal's or an auxiliary's verb ("the system must not lose payments nor duplicate invoices", "the
  report does not show the LLM cost"), a condition ("if we don't add rate limiting…"), a relative clause, a hazard ("we
  don't want duplicate payments"), "without" after a negated verb ("we won't ship without a canary release"), and an
  access or entitlement rule — a role's, a user group's or a plan's ("guests can't use the checkout", "the free plan does
  not include webhooks", "os editores não podem adicionar feature flags"): only the one designing — we, the system, or
  no subject at all — excludes ("the service must not use Redis", "do not use Kafka"), and so does a part of what is
  being built after a plain negation ("the importer does not need Kafka", "la versión 2 no añadirá suscripciones"),
  while a modal or a plural keeps the track ("the importer can't use Kafka", "suppliers don't use the checkout"); a
  negated verb whose object is data to protect — personal data, PII, a token, a secret, a key, a password, a card number
  — keeps its track whatever the verb and the subject ("the email doesn't include personal data", "the URL does not
  include the session token", "o email não inclui dados pessoais"); "cannot" reads like "can't".
  +ui recognises confirm dialogs, toasts, snackbars,
  field-level errors and mobile-friendly screens; +api reads "our API needs a v2" as contract work; a public API for a
  screen is +api +ui.
- **Project signal overrides** — `spec_create` learns from your Phase 0 corrections (a track you reject or add; an
  override applies after two consistent corrections) into `.specs/classifier.json`; every override is shown (`overrides`,
  `signalOverrides`, `spec_classify {explain}` / `classify --explain`) and managed with `spec_tracks {action: "signals"}` /
  `dev-spec signals list|set|forget`. A project without the file classifies as the built-in tables say.

### Added — +data track and an example +mobile pack
- **+data** `[DATA]` (data pipelines and data quality) — Data Contracts & Schema Evolution · Data Quality · Pipeline
  Idempotency & Backfills · Lineage & Ownership · Retention & Cost (the last two *extended*: optional at size S); criteria
  US-1.AC-32..35; data-quality, re-run / backfill, freshness-SLA and schema-compatibility tests; `steering/data.md`; guide
  `references/data-pipeline-patterns.md`. Doctor `data-sections`, status, finish checks, brief / matrix / Gherkin,
  add_track, import, project templates, spec_tracks; EN / PT / ES / pt-BR. It turns on from data phrases (ETL / ELT
  pipelines, a data warehouse or lakehouse, dbt, Airflow, CDC, lineage of data, freshness SLAs, CSV ingestion into a
  table, a type-2 SCD) — never from everyday
  words (a lakehouse to rent, parquet flooring, the Portuguese BI card, a horse's lineage, a stock warehouse); a table or
  a query never backs an everyday word — "a BI dashboard over the orders table" is +data, "duplicate rows in the users
  table" is not; BI phrases match at a sentence start or in title case ("Relatório de BI", "BI Dashboard").
- **Example track pack +mobile** — `examples/track-packs/mobile/` (offline & sync, platform versions & rollout, device
  permissions, performance & battery, push notifications; EN / PT / ES): copy it to `.specs/tracks/mobile/` to start.

### Changed
- **A track section holding only its template's guidance is not filled** — at every size: removing the `> **TODO**` line
  alone no longer passes (a code block — a JSON schema, an OpenAPI snippet, a Mermaid diagram — is an answer). A new
  approval is refused on it; a design approved before 1.21 only warns until its next approval.
- The eval findings: SKILL.md 7,968 → ~5,000 words (the tool catalog, track checklists, workflows and reference index
  moved to `references/`); every message prints a runnable `node "<clone>/cli/dev-spec.js"` line (committed files keep
  `dev-spec`); `spec_create {kind: "bugfix"}` / `create` take `reproduction`, `rootCause`, `condition`, `behaviour`
  (prefilled bug report; the root-cause gate is unchanged); the merge title is at most 72 characters, cut at a clause
  boundary; the execution sign-off asks for an explicit yes — a green run is evidence, not the sign-off; with no shell the
  agent asks the user, never a subagent.
- Eleven built-in tracks, 33 built-in templates (+ `change.md`, `steering/data.md`).

### Fixed
- A track section's name written under ANOTHER track's section (e.g. "### Data quality" under "## [PRIVACY] …") no
  longer counts as that track's deleted section.
- Merge titles never cut an emoji in half.

### Upgrade note — track packs with a now-reserved name or marker
- Track packs named `data`, `etl`, `elt`, `pipeline`, `pipelines`, `warehouse`, `datawarehouse`, `lakehouse`, `dbt`,
  `dataquality` or `dataeng`, or marked `DATA`, are now reserved (`analytics` and `mobile` stay free). A feature that used
  one keeps it as a missing pack (doctor `track-pack-missing`, spec_upgrade "from before 1.21"); `dev-spec add-track
  <feature> data` adopts the built-in track, or rename the pack and re-add it.

### Tests
- `node mcp/test.js` 1653 assertions (was 1544), `node cli/test-cli.js` 508 (was 480): sizes
  and the change kind end to end (the no-size scaffolds pinned by hash in EN / PT / ES), the merge driver (six 3-way cases,
  sign-offs, a real two-branch git merge, `--check`), elicitation over a fake MCP client (accept / decline / cancel /
  error / timeout, force, batch), coordinated negation and signal overrides (a precision / recall assertion per track),
  +data (133 EN / PT / ES texts, 100% / 100%) and the +mobile example pack, the eval fixes, and one regression per review
  finding.

## [1.20.0] — 2026-09-30

Easier to maintain and faster to start, with no behaviour change: the maintainer notes, the test suites and the track
engine split into smaller files, and the placeholder corpus pre-generated. Same tools, commands, results and files.

### Changed — for maintainers
- `CLAUDE.md` is a short index over topic files in `docs/maintainers/` (architecture, tracks, gates and approvals, tasks
  and evidence, markdown and trace, templates / imports / exports, lifecycle, MCP, languages, Claude Code integration,
  conventions, quality, testing, extending); the rules needed at decision time stay in the index.
- The test suites are split by area — `mcp/tests/NN-<area>.js` and `cli/tests/NN-<area>-<topic>.js`, NN shared by both —
  over one runner, `scripts/test-runner.js`: `--only gates,09` (a name, an area or a number, plus the files it needs),
  `--list`, `--times`, `--jobs`; independent files run in parallel child processes, the longest first; the last line is
  still `N passed, M failed`, and an assertion that fires after its file has finished counts as a failure. The MCP suite on
  Windows 114–126 s → 40–50 s, in Docker (node:24-alpine) 83 s → 32 s. Every moved assertion is byte-identical; the
  timing-bound ones are measured against a baseline taken in the same test.
- `engine/tracks.js` is split into the registries (`tracks.js` — which now holds `SIGNALS` as data: per track its keyword
  tiers, concepts, hazards and cues), the classifier (`classify.js`) and track packs (`packs.js`). Tuning a track's
  signals no longer edits classifier code. 0 differences over 48,272 `classify()` inputs and 2,077,424 cue calls.

### Changed — performance
- The built-in placeholder corpus (~1,165 rendered templates and their pt-BR twins) is pre-generated by `npm run build`
  into `mcp/lib/engine/corpus.generated.json` and read with one `JSON.parse`. It is stamped with the version and a sha1 of
  the sources it renders from; a clone whose sources don't match renders it as before, and a running process trusts it only
  while the sources it loaded are unchanged (a `git pull` or a rebuild under a long-lived MCP server makes that server
  render from the code it runs). SessionStart ~37% faster natively (542 → 344 ms p50).
- An optional one-file engine for a slow file system (a Docker bind mount, a network drive, WSL's `/mnt/c`):
  `node cli/dev-spec.js bundle` (or `npm run build:bundle`) writes `mcp/lib/spec.bundle.js` — git-ignored, never shipped.
  It is used only with `DEV_SPEC_BUNDLE=1`, and only while every module it holds still has the size and modification time
  it was built from (otherwise the modules load, silently); `DEV_SPEC_BUNDLE_PATH` names another absolute `.js` path. On
  a bind mount the engine loads in ~0.2 s instead of ~0.8 s. Rebuild it after every plugin update.
- Maintainers: run `npm run build` after changing i18n, templates, tracks or a module the corpus renders through;
  `npm run build -- --check` and the MCP suite fail on a stale corpus.

### Tests
- `node mcp/test.js` 1544 assertions (was 1529), `node cli/test-cli.js` 480 (was 471): the build (a stale
  corpus fails, the file-backed sets equal the rendered ones, a missing, broken, hand-edited or foreign corpus falls back to
  rendering, a corpus rebuilt under a running process is not trusted by it), the bundle (its guards, namespace and paths),
  the runner (a self-test on a fake suite) and the docs index.

## [1.19.0] — 2026-09-29

Code you don't have to write twice, and three more kinds of rigor: every design names what it reuses and the implementer
searches before writing, and three built-in tracks for API contracts, user interfaces and operability. 38 MCP tools,
54 commands, ten built-in tracks (was seven).

### Added — reuse and clean code
- **Every design names what it reuses** — a scaffolded **Reuse & Integration** section (the existing modules, components and
  helpers reused or extended, with their paths; what is new and why nothing existing fits; where it lives — module
  boundaries). `spec_doctor` warns `design-reuse` while it is missing, empty or still the template — a warning only, never
  a refused approval; a design approved before 1.19 is never flagged (a new `reuse` approval stamp); a brownfield
  feature's filled integration-plan.md → Integration Points counts; `templates check` warns `reuse-missing`.
- **Task briefs gain a Reuse section** — the design's entries that name the task's files, folders or criteria, and the
  existing source files next to its own (bounded; never a path outside the project, a network path or a link out).
- **Search before you write** — a hard step for the implementer (with a Reuse block in its report: reused / extended /
  created and why); the reviewer checks duplication against the existing codebase, not only inside the diff (a helper
  duplicating an existing one is Important); refactor candidates go to the backlog instead of into the task; extending code
  outside the task's files is a NEEDS_CONTEXT or a converge task, never a silent edit. `structure.md` gains Module
  Boundaries and Shared Code; the constitution stub a reuse principle.
- Guide **`references/code-reuse-and-quality.md`** — search before you write, reuse vs extend vs new (the rule of three),
  module boundaries, duplication, the code smells worth acting on and the refactoring that answers each.

### Added — three built-in tracks: +api, +ui, +obs
- **+api** `[API]` — API Contract · Versioning & Compatibility · Error Model (RFC 9457 problem+json) · Pagination,
  Idempotency & Concurrency · Rate Limits & Quotas; criteria US-1.AC-20..23; contract, Idempotency-Key replay, stale ETag
  (412) and breaking-change tests; `steering/api.md`; guide `references/api-design-patterns.md`.
- **+ui** `[UI]` — Design System Usage · UI States · Accessibility (WCAG 2.2 AA) · Responsiveness & i18n · UI Performance
  Budget (Core Web Vitals); criteria US-1.AC-24..27; keyboard + automated accessibility, form errors, visual regression and
  failed-load tests; `steering/ui.md`; guide `references/ui-design-patterns.md`.
- **+obs** `[OBS]` — SLIs & SLOs · Telemetry · Alerting & Runbooks · Rollout & Rollback · Health & Capacity; criteria
  US-1.AC-28..31; telemetry, burn-rate alert, rollback drill and fault-injection tests; `observability.md` gains SLOs,
  rollout and health; guide `references/observability-patterns.md`.
- Each: doctor `<track>-sections` (the design approval refuses it until filled), status, finish checks, brief / matrix /
  Gherkin, add_track / --remove, import, project templates, spec_tracks; EN / PT / ES / pt-BR.
- Classifier: +api fires on designing an API (ours — "expose a REST API", "publish an OpenAPI spec", "API consumers"),
  not on consuming someone else's ("call Stripe's REST API"); +obs on operating a service (SLOs, telemetry, runbooks,
  rollouts), not on business monitoring or support incidents; +ui on user-facing work, not on the backend behind a page.
  No decision of the seven older tracks changes.

### Upgrade note — track packs with a now-reserved name or marker
- Track packs named `api`, `rest`, `openapi`, `graphql`, `ui`, `frontend`, `ux`, `wcag`, `obs`, `observability`,
  `monitoring`, `sre`, `telemetry` (and the other aliases listed in references/project-tracks.md), or marked `API`, `UI`
  or `OBS`, are now reserved (`a11y` stays free). A feature that used one keeps it as a missing pack (doctor
  `track-pack-missing`, spec_upgrade "from before 1.19"); `dev-spec add-track <feature> api|ui|obs` adopts the built-in
  track, or rename the pack and re-add it.

### Changed
- Ten built-in tracks, 31 built-in templates; the placeholder corpus renders ~1,165 texts.
- `spec_backlog add` of a name that already exists appends the new note (`exists: true`, `appended`) instead of keeping
  the old one silently; a backlog note — a new entry's too — is one line of at most 2,000 characters (past it add is
  refused).

### Fixed
- `references/saas-patterns.md` cited RFC 8594 for the `Deprecation` header — it is RFC 9745 (`Sunset` is RFC 8594).

### Tests
- `node mcp/test.js` 1529 assertions (was 1447), `node cli/test-cli.js` 471 (was 455): the three tracks end to end (a
  precision / recall assertion over 88 hard EN / PT / ES texts — consuming vs designing an API, business monitoring vs
  operability, the backend behind a page — every track combination, legacy packs by name and by marker), the Reuse &
  Integration check and its upgrade path, the brief's Reuse section (a network path, a link out, a big folder), backlog
  notes, and one regression per review finding.

## [1.18.0] — 2026-09-29

A pure refactor: the engine as modules. No behaviour change — same tools, commands, results and files.

### Changed
- `mcp/lib/spec.js` (23,469 lines) is now a facade over `mcp/lib/engine/`: 20 modules by concept (text and paths, files and
  locks, state, markdown, tracks and the classifier, templates, scaffolding, tasks, evidence, trace, gates and approvals,
  doctor and next_action, quality, finish and the catalog, the roadmap, decisions, exports, guards, upgrade, the codebase
  scan) plus one importer per source tool in `engine/import/`. The public object is unchanged (same keys, order, types and
  arities; every operation in one read-cache scope; mutators under the feature lock), and the moved code is byte-identical.
- The module rule: a value needed while a module loads comes through an acyclic `require` (marked `// load time`); every
  other cross-module name is bound at call time by `__link` (`engine/index.js` merges the modules' exports — a name
  defined twice throws); per-call state lives on one object, `CTX` (`engine/ctx.js`), mutated in place.
- `mcp/lib/i18n.js` is a facade over `i18n/en.js`, `pt.js`, `es.js`, `common.js` and `pt-br.js`; each language loads on
  first use (pt-BR is still derived lazily). Load time, measured (Windows, Node 24, p50 of 40 interleaved fresh
  processes, 1.17 → 1.18): 36 files instead of 3 cost ~0.65 ms each before any compile, so the facade turns on Node's
  module compile cache (Node ≥ 22.8 — one file per module in `<os.tmpdir()>/node-compile-cache` or `NODE_COMPILE_CACHE`,
  off with `NODE_DISABLE_COMPILE_CACHE=1`; the first process after an update writes it, 45–60 ms once) and `pt-br.js`
  loads only when pt-BR is read — the guard hook 220 → 238 ms (+8%), `dev-spec status` 211 → 224 (+6%), SessionStart
  345 → 364 (+5%), the observe hook 167 → 156, the stop hook on a "done" claim 252 → 231 (its claim scan no longer derives
  pt-BR's messages); without those two the split cost 10–18% (guard 260, status 243, stop 284).
- On a SLOW file system the extra files cost more: a clone on a Docker Desktop bind mount, a network drive or WSL's
  `/mnt/c` loads the engine in ~0.4–1.7 s instead of ~0.2 s. Keep the plugin on a local disk (Claude Code installs
  plugins there). `npm run test:docker` now copies the repo into each container before running the suites (a local
  disk, as installed); `--mounted` runs from the bind mount.
- Proof: a differential harness ran the 1.17.0 engine and the new one side by side — 897,053 comparisons (pure functions
  over 13,996 corpus strings, every i18n table leaf in four locales, lockstep project scenarios in EN / PT / ES / pt-BR,
  every importer, 57 CLI commands, an MCP session, the hooks with 72 malformed payloads) — 0 differences.

### Tests
- `node mcp/test.js` 1447 assertions (was 1442), `node cli/test-cli.js` 455 (unchanged): the source guards scan every
  `mcp/lib` file, and a new guard checks the module list and that `mcp/lib` requires only Node core or relative files;
  the module rule itself is checked from the sources (each module's `let` list = its `__link` destructure, every name
  exported by a module, none shadowing the `__link` parameter; the load-time requires acyclic and marked), and the load
  time (the compile cache on, no pt-BR in an English process, the stop gate's claim scan deriving nothing).

## [1.17.0] — 2026-09-29

Engineering judgement in the spec: a seventh track for distributed systems and data consistency (the dual-write problem,
outbox, idempotency, retries, consistency models, locking), every design weighing its alternatives and risks, /grill
asking about the constraints, the red → green → refactor micro-cycle inside each task, and plans settled with fluidplan
imported as specs. 38 MCP tools, 54 commands, seven built-in tracks (was six).

### Added — the +dist track (distributed systems & data consistency)
- A seventh built-in track **`+dist`**, marker `[DIST]`: five mandatory design sections — **Consistency Model** (what must
  be atomic, ACID and the isolation level, strong vs eventual), **Cross-system Writes** (every dual write with its
  mitigation: transactional outbox, inbox, saga, CDC or an accepted risk), **Delivery & Idempotency** (at-least-once,
  idempotency keys, deduplication, retry policy, DLQ), **Concurrency** (race conditions, optimistic vs pessimistic locking)
  and **Failure Modes** (partial failures, partitions, each dependency down); `[DIST]` criteria (US-1.AC-16..19: the event
  delivered later without loss or duplicates when publishing fails after the commit, a duplicate delivery applied once, no
  lost concurrent update, a dependency down), data-consistency tasks, failure-injection test rows (+tdd), checklist items
  and `steering/distributed.md`; doctor `dist-sections` (the design approval refuses it until filled), `spec_status`
  `distSections`, clarify questions, brief / matrix / export / Gherkin; EN / PT / ES / pt-BR.
- Classifier: EN / PT / ES +dist signals (named brokers and cross-system patterns strong; queue, retry, webhook,
  idempotency, race condition weak; transaction / consistency only as context), gap phrases ("publishes a UserCreated
  event"), retry / retries counted once. "Create an endpoint that writes a user to Postgres and publishes a UserCreated
  event to Kafka" is `core +dist` in the three languages.
- **`references/distributed-data-patterns.md`** — the dual-write problem, transactional outbox (polling relay vs CDC),
  inbox / idempotent consumer, sagas and compensations, retries with backoff and jitter, deduplication and idempotency,
  consistency models, ACID isolation levels and their anomalies, optimistic vs pessimistic locking, CAP / PACELC, monolith
  vs microservices, large data volumes, and a decision checklist.

### Added — every design weighs its choices
- The core design template gains **Alternatives & Trade-offs** (the options per key decision — pros, cons, the cost of
  being wrong, the one chosen and why) and **Risks** (likelihood, impact, mitigation, owner), EN / PT / ES; doctor warns
  `design-tradeoffs` / `design-risks` when they are missing, empty, still the template, or list fewer than two options —
  a warning only, never a refused approval (a bugfix and a spike are exempt); the design-save hook notes them and
  `templates check` warns about a project design template without them.
- **/grill constraints round** — atomicity, ACID and the isolation level, race conditions, the consistency model, delivery
  guarantees and idempotency, each dependency failing, volume and growth, and a business outcome you can measure after
  release. `spec_clarify` asks one question (`nudges: [{code: "consistency-unstated"}]`) when your own text (never the
  templates') names two such concepts — queues, events, webhooks, async work, concurrency, transactions, retries — or one
  strong phrase (a message queue, publishing an event, a background job, concurrent writes, Kafka…), and neither the
  requirements nor the design answer it (eventual / strong consistency, idempotency, at-least-once, isolation level,
  optimistic / pessimistic locking, outbox…).
- **The TDD micro-cycle** inside each task (adapted from obra/superpowers' test-driven-development, MIT): one behaviour at
  a time, watch it fail for the right reason, minimal code, refactor only on green, code written before its new
  behaviour's test is deleted and redone — with the usual rationalizations answered and the red flags (guard tests,
  characterization tests of existing code and a test an earlier task already turned green are exempt); in the +tdd loop,
  the implementer and reviewer agents and /executeTask.

### Added — import
- **`spec_import {tool: "fluidplan"}`** / `dev-spec import fluidplan <path>|-` — a plan settled with the fluidplan skill
  (`.fluidplan/<id>/`: the finalized PLAN.md / DECISIONS.md, else plan.json + answers.json; English or French labels)
  becomes a new feature: pages → stories, acceptance → EARS criteria (else `[NEEDS CLARIFICATION]`), tasks with their
  ticks, `_Implements:_`, `_Verify:_` and `_Depends:_`, the settled decisions → `decisions.md` + the design's Decisions /
  Alternatives & Trade-offs, rejected ones → Out of Scope, open ones flagged. Inline text (a pasted PLAN.md) works too.

### Changed
- Design approvals record `weigh: true`; `design-tradeoffs` / `design-risks` warn on a design not yet approved or approved
  from 1.17 on — a design approved before 1.17 is never flagged (a pass with a note: it is asked from its next approval),
  and the checks never count toward the spec_upgrade audit's attention. Nothing is refused and no artifact is edited.
- Negated classifier keywords are deduplicated like matched ones; "message queue" hints +dist as well as +saas.
- `spec_templates` lists 29 built-in templates (the `distributed.md` steering stub).

### Upgrade note — track packs with a now-reserved name
- Track packs from before 1.17 named `dist`, `kafka`, `distributed`, `microservices`, `consistency` (or their PT / ES
  forms), or marked `DIST`, are now reserved and ignored. A feature that used one keeps it as a missing pack: doctor's
  `track-pack-missing` and `spec_upgrade` (`track-pack-reserved`) say so. A pack named `dist` is never read as the
  built-in +dist. The way out: rename `.specs/tracks/<name>/` (and its marker and headings if the marker is reserved),
  then `dev-spec add-track <feature> <new-name>` and `dev-spec add-track <feature> <old-name> --remove` — or, for `dist`,
  adopt the built-in track with `dev-spec add-track <feature> dist`.

### Fixed
- `spec_import` no longer stalls on long whitespace runs or long plans: markdown headings and ranges are read by scans (a
  3,000-space heading took 10 s), the importers' trailing trims use `trimEnd` (`/\s+$/` was quadratic), a long dependency
  chain is ordered in linear time, and imported requirements.md lines never open an HTML comment that hides the criteria
  below it (every importer — a Kiro `<!-- … -->` line could hide an acceptance criterion).
- The classifier's shadowing check (a weak keyword inside a longer strong one) is linear — 100 KB of repeated keywords
  took seconds.
- A PT / ES request starting with an infinitive ("Publicar eventos no Kafka") is read in its language: "no" there is em+o,
  not a negation.
- The PT / ES glossary stub lost a space in 1.16 ("produto:uma").
- **Linear markdown readers everywhere** — a heading, list item, table row or marker holding a long whitespace / backtick /
  `#` run (or a line break after it) no longer stalls the MCP server, a hook or spec_import (the readers were quadratic,
  Given / When / Then cubic: a 100,000-character run took 18–30 s in status / doctor / trace / imports; now well under 1 s).
- The BMAD importer's story `Status:` line is recognised with spaces around it (`/^\s*status\s*:/i` had lost its
  backslashes in 1.14).
- A Spanish or short English request is no longer read as Portuguese because it starts with a verb both languages share
  ("Alterar el formulario…; no usar LLM" switched +ai on).

### Tests
- `node mcp/test.js` 1442 assertions (was 1362), `node cli/test-cli.js` 455 (was 438): the +dist track end to end
  (the user's example and a precision / recall corpus in EN / PT / ES, every track combination, a 1.16 pack upgrade), the
  design weigh checks and the nudge (every track's pristine scaffold stays quiet), real fluidplan exports (injection,
  cycles, half-settled decisions), linear-time bounds on adversarial markdown, a guard against backslash-stripped regex
  literals, and one regression per review finding.

## [1.16.0] — 2026-09-29

Day-to-day comfort and reach: undo a tick, revoke an approval, say why a gate was forced and until when; a status line,
MCP tool annotations and argument completion, a plan-mode bridge; specs that notice an amended constitution, criteria
that duplicate or contradict another feature's, and a glossary; Gherkin and Jira / Linear exports, and milestones judged
against the forecasts. 38 MCP tools (was 35), 54 commands (was 52).

### Added — usability
- **Undo a tick** — `spec_complete_task {undo: true, reason?}` / `dev-spec undone <feature> <n> [--reason "…"]`: the task
  reopens (CRLF / BOM kept), its evidence turns stale (`staleBy: "undo"` — a re-tick needs a new run), `ticks[n]` is
  dropped and the untick is logged in `.state.json → unticks` `[{n, at, reason?}]`; a finish or execution sign-off older
  than an untick reads stale. Under the feature lock; never gated (the bugfix root-cause gate only refuses ticks).
- **Revoke an approval** — `spec_approve {phase, revoke: true, reason?}` / `approve <feature> <phase> --revoke [--reason]`:
  removes the phase's approval and its waiting role sign-offs, appends a history record `revoked: true` (no snapshot) and
  never cascades — the phase is pending again, so a later phase can't be approved (`phase-order`) until it is re-approved.
  The human approval guard treats a revoke as an approval action.
- **Waivers** — `force` with `reason` and / or `expires` (`YYYY-MM-DD` or `30d`) records why a gate was forced and until
  when (`waiver` on the approval, its history record and role sign-offs); doctor warns `waiver-expired` once it lapses,
  ROADMAP.md shows each waiver and flags the expired ones, `spec_finish` returns `waivers` and its merge summary lists
  "Waived gates". A force without a reason is still accepted.
- **`spec_stop_check`** and **`spec_log`** — MCP tools for clients without a shell: the end-of-turn evidence gate's
  decision for a closing message, and the commits citing each task from `git log` text the client supplies (the server
  still never runs git or any command).

### Added — Claude Code integration
- **Status line** — `dev-spec statusline` reads Claude Code's status-line JSON on stdin and prints one line: the feature
  with work under way, its tasks, unverified ticks and the next step, in the project language (nothing outside a dev-spec
  project; exit 0 always; reads only `.specs/`). `/spec-statusline` installs it; `statusline --print-config` prints the
  `settings.json` entry with this clone's absolute path.
- **Your defaults** — the environment variables `DEV_SPEC_DEFAULT_LANG` (the language a NEW project gets),
  `DEV_SPEC_STOP_CHECK` (the stop gate where a project leaves it unset) and `DEV_SPEC_GUARD_DEFAULT` (off / on / scope):
  fallbacks only, a project's `roadmap.json` always wins. Put them in Claude Code's `settings.json` `env` block — it
  reaches the hooks, the MCP server and the commands Claude runs alike. (No plugin `userConfig`: it would open a dialog on
  every install and reach neither the CLI nor other MCP clients.)
- **MCP tool annotations** (`readOnlyHint` / `destructiveHint` / `idempotentHint`, `openWorldHint: false` everywhere) and
  **`completion/complete`** (feature slugs for prompt arguments that name a feature; the `specs://` template variables).
- **Plan-mode bridge** — `spec_import {tool: "plan" | "execplan", text}` / `dev-spec import plan - | --text "…"` imports
  a plan pasted inline (a Claude Code plan lives in `~/.claude/plans`, outside the project); the PostToolUse hook
  `hooks/plan-hook.js` (ExitPlanMode) adds one line suggesting `/spec-import` of the approved plan in a dev-spec project.

### Added — spec quality
- **Steering amendments** — requirements and design approvals record the steering that governed them (constitution, the
  active tracks' files, `inclusion: always` files, `fileMatch` files matching the feature's `_Implements:_`); doctor warns
  `steering-changed-since-approval`, next_action adds a re-review hint, and `spec_impact {phase: "steering"}` /
  `dev-spec impact [feature] --phase steering` lists every feature approved under an older version (read-only). Approvals
  made before 1.16 are never flagged.
- **Cross-feature criteria** — near-duplicate or likely conflicting acceptance criteria across active features (EN / PT /
  ES; SHALL vs SHALL NOT, different numbers): doctor warns `cross-feature-acs`, `spec_catalog` returns `crossAcs` and
  SPECS.md gets a "Possible duplicates / conflicts" section. Template criteria and declared `_Supersedes:_` pairs are
  ignored; the comparison is bounded.
- **Glossary** — `.specs/steering/glossary.md` (`steering_scaffold glossary.md`) with entries `- **Term** — definition.
  _Avoid: a, b_`: clarify asks about every avoided word the requirements / design use, doctor warns `glossary`, briefs
  quote the matching entries.

### Added — exports and planning
- **Gherkin** — `spec_export {format: "gherkin"}` / `export [feature] --gherkin`: a `.feature` per feature, one Scenario per
  current acceptance criterion (tags: the AC ID, its planned T-IDs, its track marker), the EARS clauses as Given / When /
  Then verbatim (a criterion that can't be split cleanly is one `Then`, listed in `unsplit`); PT / ES in Gherkin's own
  dialects (`# language: pt` / `es`).
- **Tracker CSV** — `format: "jira" | "linear"` / `export [feature] --tracker jira|linear`: the feature, its stories and
  its tasks as a CSV for the tracker's own importer (nothing is sent anywhere), with the matrix CSV's rules (RFC 4180, the
  formula guard, a BOM).
- **Milestones** — `spec_milestone {action: add | rm | list}` / `dev-spec milestone` / `/spec-milestone`: named target
  dates for sets of features (`meta.milestones`), judged against the forecast ETAs — `on-track` · `at-risk` · `late` ·
  `done` — in ROADMAP.md (a table + "Needs attention") and `spec_roadmap`; they follow a feature's rename / archive /
  restore / remove. `spec_changelog {milestone}` / `changelog --milestone` scopes the release notes to a milestone.

### Changed
- `spec_impact`'s `name` is optional in the MCP schema (phase `steering` only — every other phase still needs it).
- `spec_templates` lists 28 templates (the glossary stub).

### Fixed
- **The guard hook never touches a network path an agent names** (`\\host\share\…` in a Write / Edit, or an absolute
  `_Implements:_` path): inside / outside is decided on the text alone (a project that lives on a share stays guarded).
  It used to stat and resolve it — an SMB connection to that host before the permission prompt, and a hang until the
  hook timeout when the host was unreachable. The PostToolUse hook skips a network `.specs/` file outside the session.
- The README labelled the shipped 1.15 section "Unreleased".

### Tests
- `node mcp/test.js` 1362 assertions (was 1256), `node cli/test-cli.js` 438 (was 402): every new tool, flag and
  surface (MCP and CLI parity, EN / PT / ES), a status line ↔ next_action parity table over 27 project states, a seeded
  fuzz of the EARS → Gherkin splitter (no character lost), the cross-feature detector on true and false pairs in three
  languages, relative timings for the cached criteria table, and one regression per review finding of the four packages;
  existing assertions unchanged except the exact tool / command / template counts and two status-line fixtures.

## [1.15.0] — 2026-09-28

Your own tracks: a project defines its domain rigor (+a11y, +mobile, +compliance…) as a local track pack, and it
behaves like a built-in track everywhere. The catalog says what the system does today (a draft's `_Supersedes:_` no
longer strikes the criterion it plans to replace), and `--shell` accepts WSL's bash.exe when you name it.
35 MCP tools (was 34), 52 commands (was 51).

### Added
- **Project-defined tracks (track packs)** — beyond the six built-in tracks, a project defines its own domain rigor
  (+a11y, +mobile, +dbmigration…) as a folder `.specs/tracks/<name>/`: `track.json` (JSON, comments allowed — `name` =
  the folder, a case-sensitive `marker` such as `A11Y`, a localized `title`, classifier `signals` strong / weak / context,
  the mandatory design `sections` with synonyms, loose words and guidance, an optional `steering` file) plus optional
  markdown fragments — `requirements.md` (criteria), `tasks.md` (the task block, `{{ac1}}` / `{{acs}}` / `{{t1}}` /
  `{{tests}}` naming the pack's criteria and tests as the feature numbers them), `test-plan.md` (rows), `checklist.md`,
  `steering.md`; a `<lang>/` subfolder wins (pt-BR → pt → root). A valid pack is a marker track everywhere, through the
  same registries as the built-in ones (now project-aware, scoped to the engine call like the project templates):
  `spec_classify` (new optional `projectDir`) / `spec_create` / `spec_import` score its signals as literal words;
  `spec_create` scaffolds its `#### [MARKER] <title> — Acceptance Criteria (EARS)` criteria after the US-1 ones, its
  `## [MARKER] <section>` design sections with the `> **TODO**` sentinel, its task block, test rows (+tdd), checklist
  items and steering file; `spec_add_track` adds / removes it (non-destructive); doctor fails `<name>-sections` and the
  design approval is refused until every section is filled; trace_check, spec_status (`packSections`), next_action, the
  roadmap, the design-save hook, the task brief, spec_export and project templates follow it; its `[bracketed]` slots
  are template placeholders, its `[MARKER]` never is. A pack is data only (nothing runs; allowlisted file names only,
  lstat + realpath — a symlink / junction out of `.specs/` is ignored; every size and count bounded) and a bad one is
  reported and ignored as a whole. A feature whose saved track names a pack that is gone or invalid keeps it (with its
  marker, `.state.json → packMarkers`) as an INACTIVE track and doctor warns `track-pack-missing`. New MCP tool
  **`spec_tracks`** `{action: list | init | check, name?, lang?}` (35 tools), CLI `dev-spec tracks [list|init <name>|check]`
  (check exits 1 on an error), command **`/spec-tracks`** (52 commands), guide `references/project-tracks.md`. `tracks`
  is a reserved feature slug (a pre-1.15 feature of that name stays a feature); the PostToolUse hook and the pre-commit
  check never lint a pack's fragments as a feature's spec. Pack sections are marker-bound (a heading counts only with the
  pack's marker, or under one — a core `## Architecture` never satisfies a pack's section) and a name's lead (numbering,
  an emoji, a dash) is ignored when matching, as in the heading; a slot holding a variable (`[the {{name}} screens]`)
  still reads as a placeholder; packs and their placeholder corpus are cached across calls by their files' size / mtime
  (an edit is picked up by the next call).

### Changed (heads-up)
- **Only a shipped feature's `_Supersedes:_` retires the older criterion** in the catalog (SPECS.md), the stakeholder
  export and the traceability matrix — shipped = a finish recorded or the execution signed off, the release notes' rule.
  A draft's declaration now reads "to be superseded by … (not shipped yet)" (JSON `supersedePending: true`, catalog
  `totals.pending`, matrix `counts.supersedePending`) and the criterion stays current; a feature archived without ever
  shipping declares nothing, and its own criteria no longer count as current; a shipped feature counts only the
  declarations it shipped with (one a later change request adds waits until it ships again), and a retired criterion
  names only its shipped declarers. The totals read "N current (P to be superseded), S superseded". 1.14 struck the
  criterion as soon as any feature declared it.
- **`--shell <path to WSL's bash.exe>` is used as given** (`done --run` / `finish --run`): running the checks inside a
  Linux distribution is your choice when you name it, with a one-line note; a bare `--shell bash` still never resolves to
  WSL (Git Bash, else `no-git-bash`), and a run WSL's relay fails is still could-not-run, nothing recorded. 1.14 refused
  that path (`couldNotRun: "wsl-bash"`, no longer produced). `wsl.exe` (named or bare) is no shell — it rejects the
  `-c` every run uses — and is refused (`couldNotRun: "wsl-exe"`); a quoted `--shell "C:\…\bash.exe"` loses its quotes.

### Tests
- `node mcp/test.js` 1256 assertions (was 1221), `node cli/test-cli.js` 402 (was 395): a full +a11y pack end to end
  (classification, the scaffold in EN / PT / ES / pt-BR, the gates, trace, add / remove, a deleted and an invalidated pack,
  twelve kinds of invalid pack, a linked pack folder, the reserved slug, init, a project template, the hook), one
  regression per F4 review finding (R1–R10) and the CLI's `tracks` command; every existing assertion unchanged except the
  exact tool / command counts; the catalog / export / matrix tests that exercise `_Supersedes:_` mark the declaring
  feature shipped (plus the draft / shipped / abandoned cases), and the WSL shell tests follow the new rule.

## [1.14.0] — 2026-09-28

Teams, stakeholders and evidence that holds at the end of a turn: two new tracks (`+sec`, `+privacy`), project
templates, a stakeholder export and release notes, a requirements traceability matrix, approvals by role and a
fast-forward, an opt-in human approval guard, roadmap forecasts, task dependencies and execution waves, red → green
evidence and project checks, harness-observed evidence, an end-of-turn evidence gate, a decision log and spikes, import
from plans / ExecPlans / BMAD, a design-first flow, MCP prompts and resources, a guided tour, Brazilian Portuguese and a
local Linux test runner.
34 MCP tools (was 30), 51 commands (was 44), six tracks (was four).

### Added
- **`+sec` and `+privacy` tracks** — composable like the others and wired through the same data-driven registries:
  `[SEC]` / `[PRIVACY]` EARS criteria, mandatory design sections with the `> **TODO**` sentinel (+sec: Threat Model,
  Security Requirements, Authentication & Authorization, Secrets & Key Management, Security Testing; +privacy: Personal
  Data Inventory, Lawful Basis & Purpose, Retention & Deletion, Data Subject Rights, Processors & International
  Transfers, DPIA), task blocks, test rows, checklist items and the steering stubs `security.md` / `privacy.md`
  (EN/PT/ES). Doctor checks `sec-sections` / `privacy-sections`, the design gate refuses them unfilled, `spec_finish`
  lists their fresh checks, and a task proving one of their criteria gets those design sections in its brief. The
  classifier has EN/PT/ES strong and weak signals for both (+sec also a corroborating-only tier). New references: `security-track.md` (STRIDE,
  ASVS, OWASP Top 10, abuse cases, local security testing) and `privacy-track.md` (GDPR, CNPD, Lei 58/2019 — not legal
  advice).
- **MCP prompts and resources.** The server was tools-only; it now also serves one prompt per plugin command
  (`commands/*.md`, read at runtime — `$ARGUMENTS` from the `args` argument, a one-line preamble for agents without the
  skill) and the project's specs as read-only resources: `specs://roadmap` (ROADMAP.md, else rendered from
  roadmap.json), `specs://catalog`, `specs://steering/{file}` and `specs://feature/{slug}/{artifact}` for 14 allowlisted
  artifacts, capped at 500 entries (`_meta.truncated`). URIs are parsed segment by segment, features resolved like every
  tool, no symlink out of `.specs/`; an invalid URI or prompt is `-32602`, a missing resource `-32002`.
  `SPEC_MCP_PROMPTS=off` drops the prompts (the Claude Code plugin sets it — its commands are already slash commands).
  CLI parity: `dev-spec prompts [name] [--args "…"]`.
- **Project templates** (`spec_templates`, `dev-spec templates [list|init|check]`, `/spec-templates`) —
  `.specs/templates/<artifact>.md` (and `<lang>/<artifact>.md`, which wins) replaces the built-in template of any
  chain artifact, the bugfix and spike variants, or a steering stub (`steering/<file>.md`), with `{{name}}` `{{slug}}`
  `{{summary}}` `{{tracks}}` `{{lang}}` `{{date}}` substituted. Active tracks still get their blocks appended unless the
  template carries them; the templates' own slots count as placeholders, so an untouched custom scaffold is still a
  template to doctor, approve and next_action. `init` copies the built-in ones (never overwrites), `check` validates them
  (CLI exit 1 on an error).
- **Stakeholder export** (`spec_export`, `dev-spec export [feature] [--md] [--write]`, `/spec-export`) — one
  self-contained, offline, printable document for people who don't read markdown folders: a feature (stories + EARS ACs,
  design or bug.md, test plan, tasks with their verification, decisions, approvals, open clarifications) or the whole
  project (roadmap, backlog, a page per feature, the catalog). HTML with the roadmap palette, light/dark and print rules,
  every text escaped and no external URL — or markdown. `write` → `.specs/exports/`, never over a hand-written file.
- **Release notes** (`spec_changelog`, `dev-spec changelog [--since <ISO date|last|all>] [--write]`, `/spec-changelog`) —
  Added (features shipped since then + their ACs), Changed (superseded ACs, change requests with the current AC text),
  Fixed (bugfixes + their root cause), from the spec data only. `write` → `.specs/RELEASE-NOTES.md` and stamps
  `meta.changelogAt` (the default `since`); nothing to report writes nothing.
- **Requirements traceability matrix** (`trace_check {matrix: true}`, `dev-spec trace <f> --matrix | --csv`,
  `spec_export {format: "csv"}` / `dev-spec export [f] --csv [--write]`) — one row per requirement ID (the US-n.AC-m
  criteria, then EC / NFR / SC) with its linked tasks (done, verified + the stable reason, the latest evidence), planned
  tests (+ the test files naming them with `--code`), design sections, current decisions, `_Supersedes:_` both ways and
  whether the row changed since the requirements approval. Stable status codes `verified` · `implemented` · `planned` ·
  `untraced` and gap codes `no-task` · `no-test` · `no-coverage`, computed by the same readers as trace_check and the
  evidence gate (no second verdict). The CSV is RFC 4180 and formula-safe (a cell starting with `=` `+` `-` `@` gets an
  apostrophe); the exported file (`.specs/exports/<feature>.rtm.csv`, `project.rtm.csv`) adds a UTF-8 BOM for Excel and
  the AUTO-GENERATED marker as its last record. The HTML / md feature export gains a Traceability matrix section, the
  project export each feature's counts by status. Informational only — trace_check's verdict doesn't change.
- **Approvals by role** — `roadmap.json` `meta.approvalRoles` (`spec_init {approvalRoles}`, `init --roles
  requirements=product,design=tech+security`, `--roles none` clears): a listed phase is approved once every role has
  signed off its current content (`spec_approve {role}`, `approve --role`); until then the sign-offs wait in
  `.state.json` `signoffs` and doctor, next_action, finish, ROADMAP.md and the guard hook see the phase as pending,
  naming the missing roles. Approvals made before the roles stay approved (doctor and finish warn).
- **Fast-forward approval** (`spec_approve {through}`, `approve --through <phase>`, `/spec-ff`) — approves the filled
  phases in order, each through its own gate (snapshot + history, flagged `batch`), and stops at the first refusal;
  next_action suggests it when every planning artifact passes its gate.
- **Human approval guard** (opt-in; `roadmap.json` `meta.approvalGuard` `off | ask | deny` — `spec_init {approvalGuard}`,
  `dev-spec init --approval-guard`; default `off`, nothing changes) — a new PreToolUse hook (`hooks/approval-hook.js`)
  catches an agent's approval: `spec_approve` under any MCP server prefix, `spec_feature` remove with `confirm`,
  `dev-spec approve` / `feature remove --yes` run through the Bash or PowerShell tool (quotes, chains and nested
  `bash -c` / `cmd /c` / `pwsh -Command` scripts, heredocs and each shell's escapes read by a linear lexer), lowering the
  guard itself, and weakening what it protects (evidence observed → reported, approval roles cleared, a project check
  removed or changed, the stop gate or the edit guard off, a shell write of `.specs/roadmap.json`); a `roadmap.json` that
  no longer parses keeps the guard on (fail closed). `ask` shows a
  permission prompt naming the feature, phase, role and — loudly — `--force` (Claude Code's auto / bypass modes may skip
  it); `deny` refuses it in every mode, tells the agent to stop and ask, and shows the user the
  `! node <clone>/cli/dev-spec.js …` command to run themselves. Silent unless on (a shell command not naming dev-spec is
  never read further), never blocks on its own errors; a guardrail on the approve paths, not a sandbox.
- **Roadmap forecasts** — `_Size: XS|S|M|L|XL_` (1/2/3/5/8 points; unsized = the feature's median, else M);
  `spec_complete_task` records when each task is ticked (`.state.json` `ticks`); velocity = points per working day over
  the last 28 days (project-wide, and per feature with 3+ completions); each feature gets an ETA with a ±25% range,
  chained after unfinished dependencies, or a reason (`not-enough-data`, `no-tasks`, `dependency`, `cycle`, `done`).
  ROADMAP.md / .html gain an ETA column and the velocity line; `spec_metrics` carries `velocity`.
- **Cross-feature overlap** — two active features whose open tasks plan the same files (or an active one planning files
  a finished feature's drift baseline holds), unless ordered by a dependency or declared with `_Supersedes:_`: listed
  under ROADMAP.md "Needs attention", doctor warn `cross-feature-overlap`, one SessionStart line.
- **Task dependencies and execution waves** — `_Depends: 3, 5_` on a task (English-stable; `#3` = 3) names tasks of the
  same tasks.md that must be done first. The next task (`spec_next_task`, next_action, the brief's default task,
  `next --batch`, `spec_status`, the roadmap, `spec_complete_task`'s `next`, the spike's steps, the scope guard's hint)
  is now the first open task whose dependencies are all done — with `skipped` / `blocked` `[{number, waitsOn}]`, and
  next_action's step `fix` when no open task can start. `spec_next_task {waves: true}` / `dev-spec next <f> --waves`
  returns the execution waves of every open task (dependencies done or in earlier waves, no two tasks sharing an
  `_Implements:_` file, a task without `_Implements:_` or a prompt task alone; undeclared tasks keep tasks.md order, a
  `[P]` run together) plus `cycles` and `blocked`. Ticking a task early is allowed (`waitsOn` + a note); doctor fails
  `task-deps` (unknown numbers, self-dependency, cycles) and the tasks approval refuses on it; the brief lists the
  task's dependencies; `spec_append_tasks {depends}` / `append-tasks --depends 3,5`. A tasks.md without `_Depends:_`
  behaves exactly as before.
- **Red → green evidence** — `_Expect: fail_` on a task that writes a test before its fix: a failing run
  `{command, exitCode ≠ 0}` is its proof (`expected: "fail"`, `redRecorded`); a passing run is refused and recorded
  (`unexpectedPass`, reason code `unexpected-pass`) unless the red run is already on record; exit 126 / 127 / 9009 is no
  red test. `done --run` honours it; doctor warns `red-green` (+tdd) for T-IDs made green without a recorded red run.
- **Project checks** — `meta.checks` (`spec_init {checks}`, `init --check test="npm test"`, repeatable, `name=`
  removes one): every brief lists them in its definition of done, and `spec_finish` (and the execution gate) block on
  `suite-evidence` until each has a passing recorded run since the feature's last task activity —
  `spec_finish {evidence}` records runs the agent made, `dev-spec finish <f> --run` runs them.
- **Git-linked evidence** — `done --run` / `finish --run` record `{commit, dirty}` (read-only git, skipped without it);
  the merge summary tags runs `@sha`; `dev-spec log <feature>` lists the commits citing each task ("task #N" with the
  feature name, its T-/AC IDs) plus a +tdd red-first check.
- **Pipe warning** — a `_Verify:_` whose command pipes (`npm test | tee log`) exits with the last command's code, so a
  failing check can read as passing: the brief (`verifyPipes`), `done --run` (a hint before running), doctor
  (`verify-pipes`, warn) and `spec_complete_task` (`pipeMasked: true` + a note) say so.
- **End-of-turn evidence gate** — `hooks/stop-hook.js` on Stop and SubagentStop: when the closing message claims the
  work is done or verified (EN/PT/ES; negations, questions, code and quotes claim nothing, an honest "not verified" is
  never sent back) while a feature active in the last 4 hours has ticked tasks without passing evidence — or a complete
  feature lacks a passing project-check run — the turn is sent back once with a localized reason. A
  `spec-implementer`'s DONE needs its task's `_Verify:_` command(s) and an exit code in its report. CLI:
  `dev-spec stop-check [--message "…"|-] [--agent <type>]` (exit 1 = sent back).
- **Harness-observed evidence** — a new hook (`hooks/observe-hook.js`, PostToolUse + PostToolUseFailure on the Bash
  tool) logs each Bash run of a task's `_Verify:_` command or a project check to a git-ignored, size-bounded
  `.execution/observed.jsonl`. Every run `spec_complete_task` / `done` and `spec_finish {evidence}` record is stamped
  `observed: true | false` (the same command, the same exit code, logged in the last 24 h); `done --run` /
  `finish --run` stamp `"cli"`. Opt-in `meta.evidence: "observed"` (`spec_init {evidence}`, `dev-spec init --evidence
  observed`) makes it the rule: a runnable `_Verify:_` is verified only by an observed (or CLI) run — new reason code
  `unobserved`, and project checks likewise (suiteChecks status `unobserved`). The default `reported` keeps the verdict
  unchanged (the stamp is information only). Claude Code only (an MCP-only client has no hook — use `done --run`); not
  a security boundary.
- **Scope guard** — `guard: "scope"` (`init --guard scope`, `/spec-guard scope`): once tasks are approved, a code file
  no open task names in `_Implements:_` (test files excepted) asks, naming the likely task or `/spec-converge`.
- **Decision log** (`spec_decide`, `dev-spec decide`, `/spec-decide`) — `.specs/<feature>/decisions.md`, committed with
  the spec: `D-1`, `D-2`… with `_Kind:_` `_Date:_` `_Affects:_` `_Supersedes:_` and localized Context / Decision /
  Consequences; append-only under the feature lock, `_Affects:_` validated against the feature. Briefs inline the entries
  citing the task, the merge summary and the export show them, the catalog lists them, trace_check reports
  `phantomAffects` and doctor warns `decision-affects` / `decision-affects-approved`.
- **Spike kind** (`spec_create {kind: "spike", question, timebox}`, `dev-spec spike`, `/spec-spike`) — a timeboxed
  investigation that ends in a decision: `spike.md` (Question · Timebox · Options considered · Evidence · Decision with
  `_Outcome: go | no-go | pivot_` · Follow-up) and investigation tasks; core-only, no requirements / design / tasks gates.
  Doctor fails until the decision is written (warns once the timebox is past), next_action goes question → investigate →
  decide → go (spec the real feature) / no-go (archive) / pivot, finish is ready once decided. The roadmap, catalog and
  export show spikes apart; release notes never list one.
- **Import from plans** — `spec_import` / `dev-spec import` take `plan` (a Claude Code plan-mode file copied into the
  project, or a Cursor `.cursor/plans/*.plan.md`), `execplan` (a Codex ExecPlan) and `bmad` (BMAD-METHOD PRD, epics and
  story files, v4 and v6 layouts), with the existing guarantees (a new feature, the source only read and inside the
  project, mapping + warnings).
- **Design-first flow** — `.state.json` `flow: "design-first"` (`spec_create {flow}`, `create --flow design-first`,
  changed later with `spec_feature {action: "flow"}` / `feature flow`): classification → design → requirements → … for
  every reader of the phase order. A bugfix or spike keeps its own order.
- **`/spec-tour`** — a guided 10-minute tour on the user's own repo: scan it, then take one tiny real change through
  every gate (approvals only on the user's yes), and keep, archive or remove it at the end.
- **Brazilian Portuguese** — `pt-BR` joins EN / PT (pt-PT) / ES as a generated language (`lang: "pt-BR"`), a locale
  derived from the pt-PT texts.
- **Linux test runner** — `npm run test:docker` (`scripts/test-docker.js`, zero dependencies) runs both suites in
  `node:18-alpine`, `node:22-bookworm-slim` and `node:24-alpine` on your own Docker: the repo mounted read-only,
  `--network none`, an unprivileged user; only the first run needs network (pull + a cached image with git). Exit 0 all
  passed · 1 a failure · 2 no Docker. Local only.
- **Behavioural plugin evals** — seven `claude plugin eval` cases (tag `behavior`, EN/PT/ES) grade what the agent does
  once the skill fires, against fixture projects and the real MCP server: plan first, bugfix root cause, evidence
  recorded, no bare tick, local merge only, a refused gate never forced, upgrade audit before apply. See
  `evals/README.md`.

### Fixed
- **What Linux exposed** (found by the Docker runner): the MCP server exited on stdin close before its queued replies
  were flushed — a slow reader got 0 of 8 replies; it now flushes first. Both test harnesses called `process.exit()`
  right after writing, and on a Linux pipe the tail (FAIL lines and the total) was dropped; they exit once stdout has
  flushed. A CLI test's `_Verify: node -e process.exit(0)_` was a `/bin/sh` syntax error (cmd.exe accepted it). Node 18
  prints a RegExp syntax error without its flags (the eval-harness assertion accepts both). The case-folding catalog
  check ran only on Windows/macOS; Linux asserts its counterpart.
- **MCP server stdout errors**: a client that closed its read end (`… | head -1`) made the next write fail with EPIPE —
  a stack trace and exit 1. It now exits quietly 0; any other stdout error prints one stderr line and exits 1.
- **Classifier**: "GDPR-compliant", "HIPAA-compliant", "SOC2-certified", "enterprise-grade" were no signal (a rejected
  `-<letter>` compound); `-compliant` / `-compliance` / `-certified` / `-grade` are accepted suffixes now.
- Review of the 1.14 packages before release (each with a regression test): the ES and PT signals match their EN twins
  (`consentimiento`; encryption in transit and security testing strong in all three); `consent` and retention period /
  policy are weak (one generic word no longer turns +privacy on), lower-case `stride` is no signal (upper-case STRIDE is
  matched case-sensitively), `permission` counts only beside another +sec signal, and "brute force" alone is weak (the
  attack phrase is strong); track markers match case-sensitively (`### Timeout [sec]` inferred +sec and hid a section);
  the generic `[PRIVACY]` synonyms (Processors, Retention, Data inventory, Avaliação de impacto…) count only on or under
  a marked heading (`## Processors and queues` satisfied a deleted section); the pipe check runs over a small shell
  lexer (only `set -o pipefail` before the pipe silences it, pipes inside `bash -c` / `sh -c` / `pwsh -Command` /
  `cmd /c` are flagged, a Windows path ending in `\` before the closing quote no longer hides the pipe); the export's
  approvals table flags a change by content only and shows a `## US-n` story once; classify is back to its 1.13 cost
  (a literal precheck before compiling ~300 keyword regexes).
- Final adversarial review (each with a regression test): the **Stop gate** counts only activity the engine recorded
  (a fresh clone's tasks.md date or a future stamp in a committed `.state.json` made it fire on unrelated work) and its
  reason never hands the agent a `--run` command — it names the `_Verify:_` / `meta.checks` to read, run only if safe,
  and record; `spec_decide` refuses a `decisions.md` that is a symlink, and export / changelog / catalog never copy a
  linked artifact out of `.specs/`; the pt-BR transform leaves a text holding its private-use sentinels as it is (a
  planted one grew the string until the heap ran out); the overlap check, the `_Verify:_` lexer and the export's inline
  markdown are bounded (they were quadratic); an exit-127 re-run of an `_Expect: fail_` task keeps its red proof; a
  re-finish keeps `finished.firstAt` (release notes no longer list a shipped feature again) and a zone-less `since` is
  UTC; a blank plan imports nothing; CLI `decide` keeps repeated `--affects` / `--supersedes` and honours `--kind`,
  `spike` passes `--flow`, `approve --through` labels a forced step in the feature's language; pt-BR keeps descriptive
  verbs descriptive ("que faz T-01 passar", "segue") and says "gerado em <data>".

### Fixed — full review before release (seven parallel reviewers, a dogfood run; every fix has a regression test)
- **Evidence that never ran is no evidence.** `done --run` / `finish --run` turned a shell that could not start, a
  signal, output over 64 MB or (new) a `--timeout` into "exit 1" — a bogus red proof for an `_Expect: fail_` task, a
  failed run for any other. They now refuse and record nothing (stable `couldNotRun` code); a check that crashes (SIGSEGV…) is still a
  failed run. On Windows `--shell bash`
  reached the WSL launcher (`System32\bash.exe`) before Git Bash — every command "failed"; a bare `bash` now resolves to
  Git Bash and the WSL launcher is refused. A red run whose output shows the test never ran (missing test file or
  module, nothing collected) is refused on `_Expect: fail_` tasks — a bugfix shipped with no regression test that way.
- **Markers followed by punctuation were invisible.** `(_Verify: npm test_)`, `_Verify: …_.` and `*Verify: …*` yielded no
  marker, so the task was "verified" with nothing run; `_Implements: x_;` was never traced. One marker reader now ends a
  value before closing punctuation and reads `*…*` italics; doctor warns `malformed-markers` for look-alikes.
- **EARS linted only list items.** ACs written as table rows, headings or bold paragraphs were never checked while
  trace_check counted them; the linter now lints every AC-defining unit, and doctor's `ears` fails (the requirements
  approval is refused) when AC IDs exist but no criterion was linted. A `<!--` inside a code span no longer opens a
  comment that hid the criteria after it.
- **T-IDs are scoped per feature in the code scan**: a new feature's Phase 4 gate passed on ANOTHER feature's
  `test('T-01 …')`. A test file another feature's plan names is no longer this feature's.
- **Project checks are tied to the code**: each recorded run carries a hash of the implementing files; after an edit
  the run reads `code-changed` (finish refuses a re-baseline on an old run). A future timestamp no longer blocks finish.
- **next_action never dead-ends**: re-review names the checks a re-approval would fail; execution roles are named
  (`--role qa`, then `--role product`) and doctor lists the pending sign-off; a finished feature with stale project
  checks asks for `finish --run` instead of "nothing left to do"; duplicate task numbers ask for a renumber instead of a
  re-run that can't help; `impact` names the role a re-approval needs.
- **Stop gate**: PT "no" (em+o) and "se" no longer cancel real PT/ES claims; "All tasks done", "All green", "Tasks 1-3
  done", "Feature complete" and ✅ are claims; "I fixed the 2 failing tests" is not an admission; a spike is never held
  to project checks; the spec-implementer's report needs exit 0 on a must-pass task.
- **Guard**: test files are allowed while a feature's approved test plan is being written (Phase 4), prototype edits
  while a spike is active within its timebox (it has no tasks gate to approve; never over an approved plan at `scope`), and an 8.3 short name, junction or symlink of the project
  is inside it.
- **MCP server**: framing splits on `\n` only — `readline` also split on U+2028 / U+2029 (legal inside JSON strings,
  common in pasted text), so the request was never answered; replies escape them. `id: null` / non-scalar ids get
  -32600, an unknown tool -32602.
- **CLI**: unknown `--flags` are refused with a did-you-mean (`done 2 --rnu` ticked the task with no evidence); `--`
  ends the options; `--include-body=false` is honoured.
- **Change management**: a partial role sign-off no longer hides a feature from the release notes; restore re-links a
  dependency on a feature that is archived too; `spec_decide` closes a code fence left open at the end of
  decisions.md (the entry was unreadable and its D-n reused); append never reuses a removed task's tick time; backlog
  names and notes are one line and can't name an existing feature; `backlog remove` = `rm`.
- **Import and classification**: Kiro specs in PT/ES import their stories; classification reads a summary in its own
  language, the project's only as a fallback, the same on every surface (a PT summary read "no checkout" as a negation); a plan's "Approach" section no longer duplicates its steps;
  an ID-less import no longer gets the template's test rows; PT/ES encryption verbs are +sec signals; section headings
  accept pt-BR (LGPD) names, emoji and "Threat Modeling".
- **Quality**: pt-BR wording (tem que, se mantém, RIPD, Operadores…) and pt-BR templates fall back to `templates/pt/`;
  three quadratic regexes made linear; the SessionStart status is capped at 20 features.
- **Docs**: the red-task and red-green guidance matches the 1.14 bugfix scaffold, `--affects "Data Models"`, `guard:
  "on"`, strict-YAML command front matter, the implementer and reviewer subagents declare their tools, and the demo in
  `examples/` is in the 1.14 shape with a red task.
### Changed (heads-up)
- **GDPR / RGPD / HIPAA now point to `+privacy`**, not `+saas` (classifier and classification matrix). Stored tracks
  don't change: add it with `dev-spec add-track <f> privacy` (MCP `spec_add_track`) where a feature processes personal
  data.
- **The Stop hook is on by default.** A closing message that claims done / verified while recent ticks lack passing
  evidence is sent back once. Opt out per project: `spec_init {stopCheck: false}` / `dev-spec init --stop-check off`.
- **`spec_init {guard}` is a string enum `on | off | scope`** (true / false still accepted as on / off); the result
  reports `true | false | "scope"`.
- **`templates` and `exports` are reserved folder names under `.specs/`** — no new feature can take them. A feature of
  that name created before 1.14 (its folder holds a `.state.json`) stays a feature and is never read as templates.
- **`spec_approve`'s `phase` is optional** — give `phase`, or `through` for the fast-forward.
- `spec_complete_task` can answer the new reason code `unexpected-pass`, and the red-phase hint now suggests
  `_Expect: fail_`.
- **The bugfix scaffold's task 3 carries `_Verify: [command that runs T-01]_` + `_Expect: fail_`** (its red run is
  the proof), and guard test T-02 — green before and after the fix — is no longer in task 4's `_Makes green:_`, so
  doctor's `red-green` stops warning about it on every bugfix. Existing bugfixes keep their tasks.md.
- **The evidence rule now reaches agents that never load the skill**: `spec_complete_task`'s description states it
  right after its first sentence, and the MCP server's `initialize` instructions right after the workflow overview —
  no run of a runnable `_Verify:_` → don't call the tool (not bare, not with a note); name the command and ask for its
  output. The behavioural eval caught agents going straight to the tool and ticking with a "no shell, not run"
  note. The skill's description names bug reports (EN/PT/ES triggers) and the +sec / +privacy tracks.
- `spec_status` returns the feature's `kind` (feature · bugfix · spike) and `flow` (requirements-first ·
  design-first; `spec_list` rows name `flow` only when design-first); the task brief's reply line asks the implementer for the report path
  (the SubagentStop gate finds its evidence through it).
- `initialize` advertises `prompts` and `resources` besides `tools`; `spec_import`'s `tool` gains `plan` · `execplan` ·
  `bmad`, `spec_create`'s `kind` gains `spike`, `spec_feature`'s `action` gains `flow`.

- **Unknown CLI `--flags` are refused** (exit 1, with a did-you-mean) — a script with a mistyped flag now fails loudly
  instead of running without it; `evals` still forwards its own flags.
- **Doctor's `ears` check can now fail on criteria it never saw**: ACs written as table rows, headings or bold
  paragraphs are linted (and so reported by the save and pre-commit hooks).
- **MCP: an unknown tool is a JSON-RPC error `-32602`** (it was a result with `isError`), and so is `tools/call`
  without a name.
- New stable codes: `suiteChecks` status `code-changed`; `spec_complete_task` / `done --run` `couldNotRun`; doctor
  warnings `malformed-markers` and `outside-code-artifacts`. `done --run` / `finish --run` take `--timeout <seconds>`;
  `spec_append_tasks` takes `makesGreen`, `expectFail`, `size` and `depends` (CLI `--makes-green`, `--expect-fail`,
  `--size`, `--depends`); `spec_backlog` takes `remove` (= `rm`). The four opt-ins above add: reason code and suiteChecks
  status `unobserved` (only with `meta.evidence: "observed"`), an `observed` field on `spec_complete_task` results and
  suiteChecks items, `evidence` and `approvalGuard` on every `spec_init` result, `skipped` / `blocked` / `waitsOn` on the
  next-task surfaces once a task declares `_Depends:_`, doctor check `task-deps`, and `spec_export`'s `format: "csv"`.
### Tests
- `node mcp/test.js` 1221 assertions (was 766), `node cli/test-cli.js` 395 (was 257); the README tool tables are
  checked against all 34 live tools in EN/PT/ES again, and both suites also run in Linux containers
  (`npm run test:docker`).

## [1.13.0] — 2026-09-26

A full audit of the engine, then gates you can trust and the change-management layer that comes after
a spec is approved: impact analysis, convergence, a living catalog, drift, metrics, import from other
spec tools, an opt-in guard, scoped steering and an upgrade path for projects made by an older version. 30 MCP tools
(was 23), 44 commands (was 35).

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
  doctor, `spec_finish` and the ROADMAP.md / ROADMAP.html "needs attention" line list each unverified task
  with a localized reason (`#1 (latest run failed), #3` — the roadmap used to show only a count), the roadmap's
  in its chrome language. A `.state.json` whose evidence/approvals aren't objects is refused
  before tasks.md is touched. A task with no runnable `_Verify:_` stays outside the run gate: a v1.12 bare
  `{exitCode: 0}` there still verifies (legacy evidence never leaves a task worse off than none) and a later
  note becomes its summary. `verified` is one verdict on every surface (`spec_complete_task`, `spec_status`,
  `spec_impact`, doctor, `spec_finish`, ROADMAP.md): `spec_complete_task` answered `verified: false` with no
  `unverifiedReason` for a task with no runnable `_Verify:_` and nothing recorded while doctor and finish passed
  it — it is now verified with `nothingToVerify: true`, `unverifiedReason` is present whenever `verified` is
  false, `done` prints no "(verified)" for it and `spec_impact` says "nothing to verify" (the `spec_complete_task` tool description no longer says doctor and finish
  keep listing such a task).
- **Placeholder and approve gates.** An untouched scaffold passed `doctor` with `readyToAdvance: true`,
  and `spec_approve` stamped anything. Doctor has a `placeholders` check (fail for the current and earlier
  phases, warn for later ones), the approval runs that phase's checks and refuses while any fails, and
  `next_action` no longer loops recommending an approval the gate refuses (it names what it fails on).
  `next_action` also stopped telling a brand-new feature to fix the checks of phases it hasn't reached.
  `spec_finish` could be "ready" with an artifact edited after its approval, template placeholders left in
  the chain, or a bugfix without a root cause; each now blocks. A bugfix's fix task could be ticked before
  bug.md's Root Cause was written — tasks after the root-cause task are now refused until it is, and the
  template's own "Fix the root cause" task can't open the gate for itself. The requirements.md hook no
  longer says "all clean" while placeholders remain. Placeholder detection is a lookup, not a guess from the
  bracket's shape: a bracket is a template placeholder only when its text (case and spacing ignored) is one a
  scaffold writes — the current templates (every builder, EN/PT/ES, every track combination and kind), the 1.12.1
  templates (kept as a static list, so a spec scaffolded by 1.12 is still read correctly) — or a generic
  TODO / TBD / TBC / FIXME / `…`. Everything else in brackets is your content: real values in a criterion
  (`[free: 60, pro: 600, enterprise: 6000]`, `[admin, billing-manager, read only]`, `[10 MB, 25 MB for pro]`, `[owner, admin]`)
  never refuse an approval, and an approved 1.12 spec with bracketed values stays finishable (a shape heuristic
  flagged those, so upgraded, fully-done features failed doctor, `next_action` said "fill requirements.md" at 5/5
  tasks and finish was blocked). Code is left alone (`[Authorize]`, `[dependencies]`, `[]`) except the templates' own
  `` `[path]` ``, a slot left inside a half-edited template sentence is still found, the ID-list check is
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
- **Phase by phase.** SKILL.md presents each phase for approval before the next one starts, but `next_action` went
  from "fill requirements.md" straight to "fill design.md" and asked for approvals only once the whole chain was
  written — and `spec_approve` took a bugfix's tasks before its design. `next_action` now walks the active phases in
  order (classification, requirements, design, test/eval plan, tests, tasks) and, for the first one not approved yet,
  says fill it → fix what its gate refuses → approve it; the next phase starts only after that approval (a changed
  artifact's re-review still comes first — for the artifacts that can be re-approved now: one of a phase after the
  first pending gate waits for that gate, since approve would refuse it on `phase-order` and next_action looped;
  implement, verify, drift and finish follow). Approving a phase while an
  earlier one is still unapproved is refused (check `phase-order`, naming the earlier phase — EN/PT/ES) unless forced.
  A finished feature whose `execution` approval exists but predates a later approval or change request (an upgraded
  1.12 feature after its new tests sign-off) was told the final approval was missing; it is now asked to re-confirm
  it, naming what came after (EN/PT/ES).
- **Task scanner.** Tasks inside HTML comments or fenced code were counted and ticked, `complete` ticked
  the first regex match in the file, `01.` wasn't task 1, and a stray unclosed `<!--` or fence hid every
  task below it (the feature could read as complete). One comment- and fence-aware scanner now serves
  status, next, complete, brief and finish; task numbers are numeric; a duplicated number resolves to its
  first OPEN task (doctor warns `duplicate-tasks`), `done --run` runs the `_Verify:_` of the task it
  ticks, and the tick lands on exactly that line (CRLF kept). Markers in a fenced example under a task
  (`_Verify:_`, `_Implements:_`, AC/T IDs) are the example's, never the task's: `done --run` doesn't
  execute them, trace_check doesn't count them as coverage or planned files, and `spec_task_brief` takes no AC / T-ID
  from them (the example's IDs gave the brief a foreign criterion and test, the tdd loop and an "unresolved" warning).
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
  outside the project. `_Implements: src/app.js:12_` / `src/app.js#L12` named the file for coverage and the drift
  baseline but a missing one for trace_check (doctor and `spec_finish` failed "files that don't exist"); every reader
  now drops the anchor — `next --batch` too (`src/pay.js:10`, `src/pay.js#L50` and `./src/pay.js` went to three
  parallel implementers as three files; a folder now also overlaps the files under it) and the brief's design
  sections (the raw spelling found none). EC-/NFR-/SC- IDs got `no-id` warnings, a deeper sub-list split its criterion, and a
  template criterion linted clean (new `placeholder` code). A stray unclosed `<!--` above the criteria hid every AC
  from the EARS linter (0 criteria, verdict pass — so the requirements approval passed a criterion with no modal verb)
  while trace_check counted them all; a marker that never closes is now plain text there and in placeholder
  detection, as it already was for tasks. Every fence-aware reader shares one CommonMark closer rule: a closing
  fence carries no info string and is at least as long as its opener — a `js`-tagged fence line inside an open
  block used to close it, so the rest of requirements.md read inverted and its ACs vanished from EARS and
  trace_check. `clarify` finds IF…THEN per criterion, keeps
  real line numbers after multi-line comments and groups placeholder questions, and never asks a bugfix for
  non-functional requirements — its EN/PT/ES template has no NFR section by design, so a filled bugfix stayed
  `needs-clarification` forever at the step next_action points to. The classifier negates
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
  (`backlog delete X` just listed), and the hidden CLI-only aliases are gone: `feature delete X --yes` removed a
  folder and `backlog remove X` an item that `spec_feature` / `spec_backlog` refused (exit 1 now, like MCP). With
  `--json`, a refused operation prints the engine result (`{ok: false, error, recorded…}`) on stdout, as MCP
  returns it, and exits 1 — stdout used to be empty.
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
  run it under cmd.exe anyway). The "retry with `--shell bash`" hint is printed only when cmd.exe itself failed (an
  unknown command — exit 9009 —, its own syntax error, a path it can't find; EN/PT/ES Windows wording), never after a
  check that ran and failed (`node tests/x.js` → exit 1), which needs a code fix. A red-phase task (it writes a test
  that must FAIL) carrying a must-pass `_Verify:_` could never be verified — `--run` refused the red run and a note
  left it unverified, with no word on why; its refusal, its note and `next_action`'s verify step now say to move the
  command to the fix task, or drop it and record the red run as a note (`redPhaseVerify: true`, EN/PT/ES), and the
  bugfix template's tasks comment says its failing-test task carries no `_Verify:_`.
- **`spec_impact --phase test-plan` / `eval-plan`.** `next_action` listed test-plan.md (and eval-plan.md) among the
  artifacts changed since their approval but offered only `--phase design`. `spec_impact` (MCP enum and CLI) now takes
  `test-plan` — the T-ID row diff (added / modified / removed planned tests; re-padding a table column is no change) with
  the tasks making each changed test green; `--reopen` unticks a modified test's done tasks and lists a removed test's in
  `retire` (never redone, EN/PT/ES) — and `eval-plan` (a section diff, like design); next_action and doctor name the
  right phase for each changed file.
- **Concurrency, Windows files and foreign `.specs/`.** Two processes completing tasks of one feature at the same
  moment (two editors' MCP servers, or MCP + `dev-spec done`) lost ticks and evidence while both answered ok — the
  feature mutators (complete, approve, append-tasks, add/remove track, `spec_create` re-run on an existing feature,
  impact `--reopen`, finish `--write`, brief `--write`, metrics `--write`) now hold a cross-process lock (`.specs/<feature>/.lock`, reclaimed when its
  process is gone) and a caller that can't get it within `DEV_SPEC_LOCK_WAIT_MS` (default 10 s) gets a localized
  "busy" error with nothing changed (a caller whose feature folder was removed, renamed or archived while it waited
  answers not-found on fresh reads — it recreated a zombie folder from its stale pre-lock check); tasks.md ticks and track additions are written atomically (a concurrent reader no
  longer sees a truncated file). `spec_feature` rename / archive / remove / restore never move or delete a folder
  another process is writing (they moved it away mid-write: a zombie `.specs/<old>/` came back and a feature's ticks
  and its spec split between two folders) — they wait on the same lock, which moves with the folder and is released
  there (left behind, it kept the renamed feature "busy"). `roadmap.json`'s read-modify-writes (depend, backlog, the
  prunes of create / archive / rename / remove / restore, init `--lang` / `--guard`, roadmap `--lang`) hold
  `.specs/.roadmap.lock`: two processes adding backlog items at once kept about half of them, and a dependency could
  vanish (its feature then read as unblocked). The lock itself guarantees one holder at a time: a waiter that found a
  just-released lock gone read it as stale and deleted the NEXT holder's fresh lock (and a holder's release deleted
  whatever lock sat at the path), so under contention two processes ran the read-modify-write at once — 80 parallel
  `dev-spec done` calls all answered ok and kept 49–71 ticks. A lock that can't be stat'ed is never stale, a stale
  lock is removed only under a `<lock>.reclaim` guard while it is still the lock judged stale, and a holder removes
  only the lock carrying its own token. A stale lock that can't be removed (held open without delete sharing by a
  scanner or sync client, a read-only folder, a folder named `.lock`) spun at 100% CPU with no deadline and froze
  the MCP server; it now waits like a held lock and answers `busy` + `stuck` with a localized "delete it by hand"
  error. The lock files and their reclaim guards are git-ignored by a `.specs/.gitignore` that init, create and every
  lock acquisition keep (an existing one only gains the missing lines): a lock left by a killed process showed in
  `git status`, `git add -A` committed it, and on a clone its fresh checkout time kept the feature "busy" for two
  minutes before the reclaim deleted a tracked file. `brief --write` (`spec_task_brief {write}`) resolved the feature,
  and a rename / archive / remove landing before its write recreated a zombie `.specs/<old>/.execution/` that listed
  as a phantom feature and blocked renaming back — it and `metrics --write` now wait on the lock like every writer.
  `feature remove` deleted the folder in place, so its `.lock` went early while the folder still existed: a waiter took a
  fresh lock in the half-deleted folder and wrote into it, and the removed feature came back (`.state.json`,
  `.history/`) after an ok remove (1 run in 12 under stress). The folder is now renamed to a dot tombstone
  (`.specs/.removing-<slug>-…`, the lock inside) before it is deleted — waiters find nothing to lock and answer "not
  found" — and a tombstone a failed delete leaves is swept by the next remove. A process killed between creating a lock
  and writing its note left an EMPTY lock that blocked the feature for two minutes: the note is now written with the lock
  (a temp file hard-linked into place; an O_EXCL fallback where links are unsupported) and a noteless lock older than 5 s
  is stale. Archive / rename / restore / remove answered a raw, untranslated `EPERM` when another program held the folder
  open for more than 60 ms: the rename is retried for ~1.4 s (the lock is held), then a localized "folder in use, try
  again" (EN/PT/ES). A lock taken inside another (a folder move's roadmap lock) could wait a second full
  `DEV_SPEC_LOCK_WAIT_MS`; it now gets what is left of the outer budget. The temp files a killed process leaves
  (`<file>.<pid>.<ts>.tmp`) and leftover tombstones are git-ignored too.
  When a generated file couldn't be replaced
  (read-only or locked on Windows, a folder in its place) every mutator and hook run left a full-size
  `ROADMAP.md.<pid>.<ts>.tmp` in `.specs/` — the temp file is now always removed (and a brief Windows lock is
  retried). A BOM-only re-save ("UTF-8 with BOM", Windows PowerShell 5.1) of an approved artifact counted as
  changed-since-approval and blocked `spec_finish` while `spec_impact` showed nothing changed — a BOM is ignored like
  CRLF, and approvals recorded over a BOM file still match. SessionStart printed a dev-spec status block for a
  `.specs/` that belongs to another tool; it now applies the PostToolUse ownership check. The MCP server refuses a
  network `projectDir` (`\\host\share`, `//host/share`, `\\?\UNC\…`) before touching it — a tool call made the server
  connect out over SMB to any host it named (and hang on an unreachable one); WSL paths and `\\?\C:\…` stay accepted.
- **Docs.** SKILL.md claims match the engine (every execution loop ends in `spec_complete_task
  {evidence}`, the EARS example passes the linter, the constitution check is section presence), the
  description is trigger-accurate and under 1,024 characters, rule files stay true in the copy
  `rules <tool>` prints, PowerShell saves rule files as UTF-8, and the prose guard against PR/CI wording
  covers EN/PT/ES. The worked designs "a complete design.md looks like" (`scale-design-template.md`,
  `mandatory-ai-design-sections.md`) had no Constitution Check, so the 1.13 design gate refused a copy of
  them — both now carry a filled Constitution Check and Complexity Tracking. The improvement-spec example
  used bare `AC-1` headings, which trace to 0 ACs; it uses `US-1.AC-n` criteria. The demo project
  (`examples/demo-project`) passes doctor with verdict PASS again, from a fresh clone too: its approvals carry
  fingerprints, its steering and classification are filled, its edge cases are covered and its Phase 4 tests
  exist; `examples/README.md` shows the real outputs, and `cli/test-cli.js` compares them on every run. README /
  INSTALL / llms-install / CONTRIBUTING no longer hard-code test counts that go stale with every assertion.
  README (EN/PT/ES) and AGENTS.md say the ROADMAP.md "needs attention" line names each unverified task with its
  reason (they still said it showed a count); README, AGENTS.md, tooling-reference and `dev-spec help` say `reopen`
  never unticks a removed criterion's tasks (`retire` lists them); `/approve` and the `spec_approve` description put a
  test-plan row citing an undefined AC under the test-plan gate, where it is checked (they listed it under tasks).
  tooling-reference says `dev-spec drift` also exits 1 on a stale baseline or an unreadable state, as the CLI help,
  AGENTS.md and `/spec-drift` do (it said only on drift).
- **Planning gates and test-plan rows.** At the requirements and design gates `spec_doctor` failed `traceability`
  on the untouched tasks.md / test-plan.md template ("tasks reference unknown ACs (typos?): US-1.AC-3…") for any
  feature whose ACs aren't the template's — while the same report called that file a later phase's template, "not
  blocking yet", and the approve gate passed. The gap kinds that read a later phase's still-template artifact are
  deferred (a warn, "not traced yet"); once it is written they fail as before. `spec_add_track tdd` (and
  `spec_create` +tdd on an existing feature) planned the template's US-1.AC-1…4 / US-2.AC-1 rows for requirements
  that were already written (an import) — a test for a criterion the feature lacks, approvable; the rows now come
  from its own AC IDs (one generic row each). `spec_import` with +tdd still planned the template's rows (it scaffolded
  before writing the imported requirements): trace said "(typos?)" on a fresh import and doctor failed traceability
  once real tasks were imported. It now plans the imported ACs too, and the scaffold tasks.md it keeps when the source
  has none cites only imported ACs and the tests covering them — else a localized placeholder. Its +saas / +ai track
  tasks (and the ones `spec_add_track` appends) cite a criterion only when requirements.md defines it AS that track's
  (under a `[SaaS]` / `[AI]` heading or carrying the marker): kept by number, tenant isolation / load test / the
  prompt task "covered" an import's unrelated US-1.AC-5…8 (a coupon, a checkout) and trace_check passed with those
  criteria implemented by nothing.
- **Bugfix root-cause task.** Ticking the root-cause task while bug.md → Root Cause is still empty stays allowed (it
  is the task that writes it) but returns `rootCausePending: true` with a note, and a later task's refusal no longer
  says "do task 2 first" for a task already ticked — it says the section is still empty (EN/PT/ES). A Reproduction or
  Root Cause that quotes bracketed evidence — `[object Object]`, a regex class `[A-Z]`, a log tag `[WARN]`,
  `[Error: ENOENT …]` — was "not filled" in every language (doctor, the requirements / design approvals, the fix tasks
  and finish refused a documented bug, naming no bracket); in bug.md only the bug report's own slots, or a section
  holding nothing but brackets, count as unfilled — the 1.12 behaviour for evidence.
- **Removed criteria.** `spec_impact --reopen` unticked the tasks of a REMOVED AC with "redo them with fresh
  evidence" — `next` then pointed at re-building a feature the spec no longer has — and doctor called the leftover
  reference a typo. A removed criterion's tasks are never unticked (nor by a design section naming only removed
  criteria): `spec_impact` lists them with their test rows in `retire` `[{id, tasks, tests}]` to delete or repoint,
  and `trace_check`'s informational `removedAcs` `[{id, changeRequest}]` lets doctor, trace and the approve gate say
  "ACs a change request removed … (change request #N)" instead of "(typos?)".
- **Finished features.** After `spec_finish {write}`, `spec_next_action` kept answering "close the feature with
  /spec-finish" — even after the `execution` approval — and never mentioned drift, so following it re-baselined over
  drifted files without a word. It now answers `finished` (asking for the `execution` sign-off while it is missing)
  or `drift` with the changed files and the decision (spec wrong → `spec_impact`, code wrong → fix, harmless →
  re-finish), plus a structured `drift`; a re-finish over a drifted baseline returns `baseline.replaced` and the CLI
  prints the files it accepted. A feature that changed after its finish — a change request or a re-approval newer
  than the baseline (tasks re-approved after `spec_append_tasks`), or an `_Implements:_` file the baseline never
  recorded — read "finished — nothing left to do" again once its tasks were done, drift called it unchanged (a new
  implementing file was never hashed), the catalog called it finished and the old execution sign-off still counted.
  `spec_next_action` now answers `finish` again with `staleBaseline` {finishedAt, since, newFiles}, `spec_drift` lists
  it as `stale` (verdict `stale`, CLI exit 1), the catalog shows it as complete, and an execution sign-off older than
  the change is asked for again. A stale baseline still hashes the files it recorded: adding a file under an
  implemented folder made a changed recorded file vanish from next_action ("finish it again") and `spec_drift`, and
  the re-finish accepted it — now next_action answers `drift` (the decision, then finish again) with `staleBaseline`
  and `drift`, and `spec_drift` lists the feature as drifted (`stale: true`, verdict `drift`), like SessionStart.
  With every task ticked but one unverified (its latest run failed, a note on a runnable `_Verify:_`), next_action
  said "close the feature with /spec-finish" — or "finished, nothing left to do" — while spec_finish and the
  execution sign-off refused, and the catalog showed ✅ finished; it now answers `verify`, naming each task with its
  reason and how to record a passing run (`dev-spec done <f> <n> --run`), and the catalog calls it complete.
  The catalog's `finished` now means exactly what next_action and finish mean: it also reads `complete` when the only
  change is an `_Implements:_` file the baseline never recorded (it checked state only and kept ✅ finished while
  next_action said "finish it again"), and when an approved artifact was edited and not re-approved (it listed the
  unapproved criterion as current behaviour under ✅ finished while finish refused). An ARCHIVED finished feature is
  never walked for new files: a file added later under a folder it once implemented kept `dev-spec drift` at exit 1
  for good with "finish it again (dev-spec finish <f> --write)", a command that answered only "not found"; a stale
  archived feature's line now says to restore it first, then finish and archive it again (EN/PT/ES), and any
  operation on an archived feature's name says it is archived and how to restore it.
- **Eval sets.** The harness's dry run said "sets are valid" for items a live run then paid a model call for and
  failed: an unknown grader type, a missing `id` / `input` / `expect`, a non-object item, a regex that doesn't
  compile, `judge` without a rubric, `contains` / `equals` / `regex` without a value. Every item is validated — the
  dry run exits 1 with one line per bad item, and a live run calls no model while any set is invalid; an
  unparseable `evals/thresholds.json` (or a set threshold outside [0, 1]) is invalid instead of silently ignored.
  A bare, non-numeric, zero or negative `--max-items` graded nothing and scored every set 0/0 = 100% (exit 0, and
  `--set-baseline` wrote a 100% baseline): it must be an integer ≥ 1 (exit 2 otherwise, before any model call), and a
  set with no items is invalid instead of passing. The harness's switches follow the CLI's rule: `--set-baseline=false`
  (as `dev-spec evals` forwards it) overwrote `evals/baseline.json` and `--dry-run=false` dry-ran — `--dry-run`,
  `--set-baseline` and `--require-live` take `=true|false` (1/0, yes/no, on/off), any other value exits 2.
- **Fenced examples in test-plan.md.** A ```fenced``` example row counted as a real one: it covered its AC (trace_check
  and the test-plan approval passed for an AC with no real test row) and planned a T-ID the Phase 4 `tests` gate then
  demanded in the test code. Every reader of test-plan.md's IDs now skips fenced code, like tasks.md and
  requirements.md — and a fence left unclosed inside a list item ends with that item (CommonMark, and the tasks
  scanner's rule): it blanked every row below it, so their T-IDs planned nothing, covered nothing and read as phantoms
  in tasks.md. requirements.md (criteria, EARS), the placeholder check and heading / design-section readers follow the
  same rule.
- **The requirements.md hook in PT/ES** printed each EARS issue's severity in English (`[warn]`) inside an otherwise
  localized message; it now uses the label `dev-spec ears` prints (`[aviso]` / `[erro]` · `[aviso]` / `[error]`).

### Added
- **Upgrading an existing project: `spec_upgrade`** (`dev-spec upgrade [--apply]`, `/spec-upgrade`). After a plugin update,
  a project's `.specs/` from an older version kept working, but nothing said so, nothing reviewed the specs created but not
  implemented yet against the new rules, and approvals made before 1.13 had no history baseline (`spec_impact` answered
  `fingerprint-only`). `roadmap.json → meta.specVersion` now records the dev-spec version that last upgraded or created the
  project — `spec_init` / `spec_create` stamp a brand-new project only (creating one feature in an older project stamps
  nothing); versions are compared numerically. While it is absent or older than the plugin, the SessionStart hook prints one
  line pointing at `/spec-upgrade` (EN/PT/ES). The audit (read-only) groups every active feature — blocked (doctor fails) ·
  needs attention · ok — with its status (not started · planning · executing · complete · finished), the failing and
  warning checks, pending gates, artifacts changed since approval, approvals without a fingerprint or a history baseline,
  unverified tasks with their reason codes, drift, next_action's step and a review recommendation: the read-only
  `spec-critic` agent for specs with no task ticked, the spec-reviewer converge pass for half-done ones, none once complete.
  `apply` runs the safe migrations only — it never edits an artifact, approves, ticks or deletes: inferred tracks saved to
  `.state.json` (when none are), earlier approvals recorded in `approvalHistory`, a `.history/<phase>@<n>.md` baseline for each
  approval whose fingerprint still matches its file (a changed or date-only approval is listed: re-approve to start its
  history), the maintained `.specs/.gitignore`, the stamp (only once every feature migrated — each under its lock) and the
  checklist `.specs/UPGRADE.md` (AUTO-GENERATED, in the project language; a hand-written one is left alone), plus the usual
  refresh of the generated `ROADMAP.md` / `.html` (its progress now follows the 1.13 rules). A second apply
  changes nothing. `/spec-upgrade` shows the audit, asks before applying, then offers the critic / converge reviews and turns
  their findings into a proposed action list that goes through the normal gates. README (EN/PT/ES), INSTALL, INTEGRATIONS and
  AGENTS.md gain an "Updating" step: update the plugin, then upgrade each project.
- **`/spec-superpowers`** and a "Using it alongside superpowers" section (README EN/PT/ES, INTEGRATIONS,
  AGENTS.md, SKILL.md): superpowers' planning / TDD / debugging / execution / verification / review /
  branch-finishing skills overlap this plugin, and its own instructions defer to CLAUDE.md — the command writes
  (after the user confirms) a marked precedence block into the project's or the user's CLAUDE.md, updates it in
  place or removes it (`--remove`), and never disables superpowers. A prose command: no engine code, no hook.
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
  medians); `write` creates a pre-filled `retro.md`. Every gated planning phase is measured, Phase 4 (`tests`)
  included (lead time, the CLI line, retro.md's "Lead time → tests" row, the project's `leadTimeHours.tests`); a
  phase never approved is null. `finished` is the earliest of the first execution approval and the finish
  `spec_finish {write}` recorded on a ready feature (the tool description said "execution approved" only).
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
  reference that resolves to nothing. Archive names the features whose dependency it pruned (`dependentsPruned`,
  printed by the CLI) and warns (`incompleteDependency`) when the archived feature wasn't complete — the roadmap
  used to turn a blocked feature into a ready one without a word.
- **Guard mode** (`spec_init {guard}`, `dev-spec init --guard on|off`, `/spec-guard`): an opt-in
  PreToolUse hook (`hooks/guard-hook.js`) that asks before a Write/Edit on a code file outside `.specs/`
  while no feature has approved, unfinished tasks — a tasks approval whose tasks.md changed afterwards
  (appended or edited) covers nothing until re-approved. Silent when off; never blocks on its own errors.
  "Code" is a source file in a broad list of languages — not only the scanner's list, so `.mts`, `.cc`/`.hpp`,
  Scala, Dart, Elixir, shell (Windows `.bat`/`.cmd`, `.ksh`, `.fish` too), PowerShell, SQL, Kotlin script,
  CoffeeScript, CUDA, Fortran, Pascal, assembly, HDL, shaders and code-bearing templates (`.erb`, `.jsp`,
  `.razor`, `.astro`) ask too; docs, config, data, markup and styles stay silent.
- **Scoped steering**: Kiro-compatible front matter (`inclusion: always | fileMatch | manual`,
  `fileMatchPattern`), custom steering files via `steering_scaffold` / `dev-spec steering`, per-task
  selection in `spec_task_brief` (matching `fileMatch` bodies quoted), and a doctor warning for steering
  files still holding template placeholders.
- **Deeper traceability**: `trace_check` warns about edge cases, NFRs and success criteria nothing covers
  (never the verdict); `trace --code` finds T-IDs in test names (`test("T-01 …")`, `def test_T01_…`,
  `TestT01…`) and doctor warns when a test made green by a done task isn't in any test file. A plan row whose
  File column names only a non-code artifact (`load-test.md`, `evals/golden.json`, a `.feature`) is a check run
  outside test code — listed in `plannedOutsideCode`, never expected in a test file — so the scaffold's own load
  and eval rows no longer leave a permanent tests-in-code warning (doctor, finish) once their task is done.
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
  `--force`. On a feature already executing or complete (an upgraded 1.12 feature), `next_action` words Phase 4 as a
  sign-off for the tests that exist — name each planned T-ID in its test's name (`test("T-01 …")`), or record the eval
  baseline — never "write failing tests first, no implementation code until then". `approve <f> tests`' own
  `tests-in-code` refusal uses the same sign-off wording there (EN/PT/ES) — it said "write each failing test" right
  after next_action's sign-off.
- **Windows: `done --run` refuses a POSIX-syntax `_Verify:_`** under the default cmd.exe — add `--shell bash` (or
  `DEV_SPEC_SHELL=bash`), or `--shell cmd` to keep cmd.exe.
- **MCP: an explicit `projectDir` must be a local folder** — a network path (`\\host\share`, `//host/share`) is
  refused. A project on a share can still be the server's working directory or `SPEC_PROJECT_DIR`; the CLI is
  unchanged.
- **Renaming a feature edits other features' requirements.md** when they `_Supersedes:_` its ACs; an approved one
  then shows as changed-since-approval (re-review, re-approve).
- **A note no longer verifies a task with a runnable `_Verify:_`** — record the command and its exit code
  (`dev-spec done <f> <n> --run`).
- **`spec_task_brief {write: true}` returns paths and identifiers only** (the controller's call in subagent
  execution): the task, `loop`, `inlineOnly`, `verify`, markers, `refs` {acs, tests}, `unresolved`, the bugfix gate and
  `paths` — no longer `acceptanceCriteria` / `tests` / `designSections` / `steering` / `bug`, the spec text the brief
  quotes. Pass `includeBrief: true` (CLI `--include-brief`) for the full result.
- **Track input is validated**: an unknown track name is an error with a did-you-mean instead of being
  ignored.
- `spec_coverage` now measures code files named in `_Implements:_` (`coveragePercent`, and
  `documented`/`undocumented` are folders with / without a covered file) instead of the folder-name
  heuristic; `spec_scan`'s `candidateEndpoints` counts routes.
- The EN/PT/ES templates changed on purpose: every template AC is planned and tasked, track ACs sit under
  `[SaaS]` / `[AI]` headings, and the test plan has the Kind column.

### Tests
- `node mcp/test.js` 766 assertions (was 181), `node cli/test-cli.js` 257 (was 53); the tool count is
  asserted exactly again (30), and the README tool tables are checked against the live `tools/list` (a hand-kept
  list of 23 names had gone stale).

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

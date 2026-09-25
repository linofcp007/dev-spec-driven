#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local MCP server (stdio, zero-dependency).
 *
 * Implements the Model Context Protocol over newline-delimited JSON-RPC 2.0
 * on stdin/stdout. No npm install, no network, no cost — pure Node core.
 *
 * Tools (all operate on the project's `.specs/` directory): see TOOLS below —
 * 29 tools, verify with an `initialize` + `tools/list` handshake.
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const spec = require("./lib/spec.js");

let VERSION = "0.0.0";
try {
  VERSION = require(path.join(__dirname, "..", "package.json")).version || VERSION;
} catch {
  /* keep fallback */
}
const SERVER_INFO = { name: "dev-spec-driven", version: VERSION };
const DEFAULT_PROTOCOL = "2024-11-05";
// Protocol revisions this tools-only server speaks. A client asking for another one gets the latest.
const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18"];

// --- Tool catalogue --------------------------------------------------------

const TOOLS = [
  {
    name: "spec_init",
    description:
      "Initialize spec-driven structure in the project: create `.specs/steering/` and the steering files required by the given tracks (constitution/product/tech/structure always; testing-standards for +tdd; scale/observability/cost for +saas; ai-strategy for +ai). Steering content is generated in `lang` (en/pt/es), which also becomes the project's default language (persisted in .specs/roadmap.json meta.lang and inherited by every new feature). `guard` turns the opt-in guard mode on/off (roadmap.json meta.guard; with or without tracks): while on, the plugin's PreToolUse hook ASKS before Write/Edit on a code file outside .specs/ unless some feature has approved, unfinished tasks. The result always reports the current `guard` state. Idempotent — never overwrites existing files.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Tracks in use across the project. 'core' is always included." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Project language for generated steering + tool messages (default en). Becomes the project default." },
        guard: { type: "boolean", description: "Guard mode (opt-in): true = code edits ask for confirmation while no feature has approved, unfinished tasks; false = off. Omit to leave it unchanged (CLI: --guard on|off)." },
        projectDir: { type: "string", description: "Project root. Defaults to SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / cwd." },
      },
    },
  },
  {
    name: "spec_classify",
    description:
      "Heuristically classify a feature description into the track set (core +tdd? +saas? +ai?) using local keyword signals — no LLM, no cost. Returns the recommended tracks, matched signals, and reasoning. Use this to seed Phase 0; the human still approves.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Plain-language description of the feature/request." },
        name: { type: "string", description: "Optional feature name (also used as evidence)." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Language of the notes/reasoning. Default: the description's own language." },
      },
      required: ["description"],
    },
  },
  {
    name: "spec_create",
    description:
      "Scaffold a feature's spec folder under `.specs/<slug>/` with the artifact skeleton for the chosen tracks: classification.md, requirements.md (EARS + stable AC IDs), design.md (with mandatory +saas/+ai sections), tasks.md, plus test-plan.md/tests/ (+tdd), eval-plan.md/prompts/evals/ (+ai), load-test.md (+saas). Artifacts are generated in `lang` (en/pt/es) — defaults to the project language, persisted per feature in .state.json. Idempotent.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name (human readable; slugified for the folder)." },
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Active tracks ('core' always added). Omit to auto-classify from name + summary (same as the CLI) — confirm with the human in Phase 0." },
        summary: { type: "string", description: "Optional one-line feature summary." },
        kind: { type: "string", enum: ["feature", "bugfix"], description: "'bugfix' scaffolds the systematic-debugging flow instead: bug.md (reproduction · root cause · fix), a one-story requirements.md (IF…THEN), a regression test plan and the fixed task order (reproduce → root cause → failing regression test → fix → verify). Always +tdd." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Language for the generated artifacts. Defaults to the project language (roadmap.json meta.lang), else en." },
        brownfield: { type: "boolean", description: "The feature lands in an EXISTING codebase: also scaffold integration-plan.md (integration points · required modifications · sequencing · risks · affected files). Create-only; doctor warns while it is still the template." },
        projectDir: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "spec_list",
    description: "List all features under `.specs/`, each with its detected tracks, current phase, and task progress (done/total).",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" } } },
  },
  {
    name: "spec_status",
    description: "Detailed status for one feature: active tracks, phase, artifacts present, task progress and next task, plus +saas scale-section completeness and +ai eval/prompt state.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_next_task",
    description: "Return the next unchecked task for a feature (its number and text), plus remaining/total counts. With `batch: true`, also return the tasks that can run in parallel with it: the following open [P] tasks of the same section whose _Implements:_ files are declared and disjoint (for parallel subagents in separate worktrees; max 3 by default).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, batch: { type: "boolean", description: "Also return the parallel batch." }, max: { type: "integer", minimum: 1, description: "Batch size cap (default 3, max 8)." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_task_brief",
    description:
      "Build a self-contained brief for ONE task (default: the next open active task; an explicit number resolves like spec_complete_task — the first OPEN task of a duplicated number) so a fresh implementer can execute it without reading the whole spec: task text + story/phase/[P]/closing checkpoint, the full EARS text of every AC it cites, the test-plan row of every T-ID it names, evals/metrics/files markers, its `_Verify:_` command (the evidence the report must carry), the tasks.md Global Constraints, the design sections that mention the task, unresolved (phantom) references, and the definition of done for the task's loop (core / tdd / ai-prompt — +ai prompt tasks are flagged inlineOnly). STEERING is selected per task: the default files (constitution/tech/structure + the active tracks' files) plus front-matter scoped files — `inclusion: always` listed, `fileMatch` included when its fileMatchPattern matches one of the task's _Implements:_ paths (real body quoted, front matter stripped, bounded), `manual` listed as available on request; the result's `steering` = {included: [{file, inclusion, patterns?, matched?, quoted?}], manual}. BUGFIX: the brief carries bug.md's Reproduction and Root Cause (`bug`; null while unwritten), and a task after the root-cause task while Root Cause is still unfilled comes back with `gated` + `gateError` (spec_complete_task would refuse it). Generated in the feature's language. With `write: true` it writes `.specs/<feature>/.execution/task-<N>-brief.md` (self-gitignored workspace, plus an append-only ledger.md) and returns the paths instead of the content — the basis of subagent-driven execution: the result then keeps only the task (number/text/story/phase), loop, inlineOnly, verify, implements/metrics/evals markers, `refs` {acs, tests} (the IDs it cites), unresolved, the bugfix gate and `paths`; the spec text (acceptanceCriteria, tests, designSections, steering, bug) is left out unless includeBrief.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        number: { type: "integer", description: "Task number. Omit for the next open task." },
        write: { type: "boolean", description: "Write the brief to .specs/<feature>/.execution/ and return paths + the task's identifiers (the brief markdown and the spec text it quotes are omitted unless includeBrief)." },
        includeBrief: { type: "boolean", description: "Include the brief markdown and the full structured result (AC texts, test rows, design sections, steering) (default: true when not writing, false when writing)." },
        projectDir: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "spec_finish",
    description:
      "Close a feature (finishing-a-development-branch): a readiness report plus a merge title + summary GENERATED FROM THE SPEC CHAIN. `blockers` (readyToFinish is true only with none): doctor fail checks, an artifact changed since its approval (changedSinceApproval), template placeholders anywhere in the chain (placeholders), for a bugfix an unwritten bug.md Root Cause, no tasks, open tasks (openTasks), ticked tasks without passing verification evidence under the evidence gate (unverified), phases awaiting approval (pendingGates). `warnings` (localized lines, never blockers): uncovered / phantom EC-, NFR- and SC- IDs and planned T-IDs that no test file names. `checks`: the track-gated items only a fresh run or a human can confirm (full suite green; +saas load test + observability; +ai cost + safety; bugfix: no longer reproduces). The summary (summary, root cause/fix for bugfixes, ACs, tasks with their evidence, tests, checks, spec files) is the merge commit message. With `write: true` it is written to .specs/<feature>/.execution/merge-summary.md (content omitted unless includeBody), and a READY feature also records its drift baseline — .state.json `finished` {at, files: sha1 of every _Implements:_ file}, returned as `baseline` (with `replaced` {at, changed, missing, nowPresent} when it replaces a drifted baseline) — which spec_drift compares against later. Integration is LOCAL: the human picks merge locally or keep the branch — no pull requests, no CI. It never merges, pushes or approves by itself.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, write: { type: "boolean", description: "Write the merge summary to .specs/<feature>/.execution/merge-summary.md." }, includeBody: { type: "boolean", description: "Include the merge summary in the result (default: true when not writing, false when writing)." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_complete_task",
    description: "Mark task N as done in a feature's tasks.md — ticks exactly that task's checkbox line, found by the same comment- and fence-aware scanner as status ('01' is task 1; a duplicated number resolves to its first OPEN task) — and return updated progress + the new next task. Pass `evidence` — the verification you actually ran: {command, exitCode, summary} (the task's _Verify:_ command, its exit code, an output summary). Every run is recorded in .state.json evidence[N] (the latest run plus a short history); a non-zero exitCode REFUSES the tick and stays recorded (a failed re-check of a ticked task makes it unverified; only a later passing run clears it). An exit code alone, or a command without its exit code, is rejected. EVIDENCE GATE: a task whose _Verify:_ names a runnable command counts as verified only with {command, exitCode: 0} — a summary-only note ticks it but leaves it unverified (a task without a runnable _Verify:_ may be attested by a note). The result carries `verified` — the same verdict doctor, spec_finish, spec_status and ROADMAP.md give; whenever it is false it also carries a stable `unverifiedReason` (no-evidence · failed-run · manual-note-on-runnable-verify · duplicate-number · stale-evidence — e.g. spec_impact reopened the task, or its _Verify:_ changed) plus a localized note; doctor, spec_finish and ROADMAP.md list such an unverified task with its localized reason. A task with no runnable _Verify:_ and nothing recorded is verified with `nothingToVerify: true` (nothing was run or attested) — doctor, spec_finish and ROADMAP.md pass it too (never listed as unverified). Bugfix: a task after the root-cause task is refused (nothing recorded or ticked) until bug.md's Root Cause is filled; ticking the root-cause task itself while that section is still empty returns `rootCausePending: true` with a note. Evidence can also be back-filled for a task ticked earlier.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, number: { type: "integer" }, evidence: { type: "object", properties: { command: { type: "string" }, exitCode: { type: "integer" }, summary: { type: "string", description: "e.g. '14/14 passing' or the last lines of output" } }, description: "Verification actually run for this task." }, projectDir: { type: "string" } }, required: ["name", "number"] },
  },
  {
    name: "ears_validate",
    description: "Lint EARS acceptance criteria, one logical criterion at a time (wrapped lines and list continuations are joined; HTML comments and fenced code are skipped): flags criteria missing a modal verb (SHALL / DEVE / DEBE), missing a stable ID (US-1.AC-1; EC-1, NFR-1 and SC-001 count too), vague words (fast, user-friendly, appropriate, … in EN/PT/ES), template placeholders still in a criterion ([trigger], [behavior] …), a missing EARS keyword, and every open [NEEDS CLARIFICATION]. Pass `text` directly, or `name` to lint that feature's requirements.md. Each issue has a stable `code` (no-modal · no-id · vague · placeholder · no-keyword · needs-clarification), a severity (only no-modal is an error, which makes the verdict fail), the criterion's `line` (+ `endLine` when it spans several) and a `msg` in the feature's language (or `lang` for raw text).",
    inputSchema: { type: "object", properties: { text: { type: "string" }, name: { type: "string" }, lang: { type: "string", enum: ["en", "pt", "es"] }, projectDir: { type: "string" } } },
  },
  {
    name: "trace_check",
    description: "Verify traceability for a feature, both directions. GAPS decide `verdict`: ACs in requirements.md that no task cites (uncoveredByTasks), phantom AC IDs in tasks (typos), on +tdd ACs without a test-plan row (uncoveredByTests), test-plan rows citing ACs requirements.md doesn't define (phantomAcsInTests) and phantom T-IDs in tasks, and `_Implements:_` files that don't exist (missingImplFiles) — a file named only by OPEN tasks is the plan (plannedImplFiles), not a gap; planned T-IDs no task names are listed as testsNotMappedToTasks without failing the verdict. `_Supersedes: <feature>/US-n.AC-m_` markers are reported as `supersedes`, and the ones that resolve to nothing as `phantomSupersedes` (informational); `removedAcs` [{id, changeRequest}] (informational) names the phantom AC IDs a recorded change request (spec_impact reopen) removed from requirements.md — delete or update what still cites them. WARNINGS (never the verdict) trace the secondary IDs of requirements.md: edge cases EC-n and NFR-n need a task or a test-plan row, success criteria SC-nnn a test-plan row or quickstart.md (uncoveredEdgeCases / uncoveredNfr / uncoveredSuccessCriteria / phantomSecondary; untouched template rows don't count) — all listed in `warnings` as [{kind, items}]. With `code: true` it also scans the project's test files (bounded, read-only; each feature's own .specs/<feature>/tests/ included) for T-IDs and AC IDs — a planned T-ID whose plan row names a concrete test path in its File column counts only in that file/folder, and another feature's .specs tests never count; a planned T-ID whose every plan row names only a non-code artifact in its File column (`load-test.md`, `evals/golden.json` …) is run outside test code — listed in plannedOutsideCode, never expected in a test file: `code` = {planned, testsInCode, plannedNotInCode, plannedOutsideCode, inCodeNotInPlan (in no feature's plan), acsInTests, scanned, truncated} — plannedNotInCode / inCodeNotInPlan are warnings too.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, code: { type: "boolean", description: "Also scan test files (test/spec/__tests__ folders, .specs/<feature>/tests/, *.test.*, test_*.py, *_test.go, *Test.java, *Tests.cs, *Tests.fs, *Spec.scala …) for the T-IDs they name — put the T-ID in the test name: test(\"T-01 …\"), def test_T01_…, func TestT01…, [Fact(DisplayName=\"T-01 …\")] (CLI: --code)." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_doctor",
    description: "One health-check that decides whether a feature is ready to advance a phase. Per-check pass/warn/fail (stable ids): steering (core files missing, or files still holding template placeholders), requirements (requirements.md missing), ears, clarifications, success-criteria, priorities, ac-uniqueness, placeholders (template placeholders — fail in the current and earlier phases' artifacts, warn in later ones), design + mermaid + constitution-check, saas-sections / ai-sections (the active tracks' mandatory design sections present AND filled — no leftover TODO sentinel), test-plan / eval-plan, traceability (every gap kind with its IDs; the kinds that read a LATER phase's still-template tasks.md / test-plan.md are deferred — a warn, 'not traced yet'; a phantom AC a recorded change request removed is named with that request), secondary-trace (EC/NFR/SC warnings), supersedes (_Supersedes:_ references that resolve to nothing), tests-in-code (+tdd: T-IDs made green by done tasks that no test file names), verification (ticked tasks without passing evidence, with the reason), duplicate-tasks, integration-plan (brownfield template still unfilled), bugfix reproduction / root-cause (root-cause fails until written — no fix before the cause), changed-since-approval (names the spec_impact phases to diff), approval-gates (pending phases — every phase whose artifact exists, a bugfix's design on bug.md, and Phase 4 `tests` on a +tdd/+ai feature once its test/eval plan exists — forced approvals with their failing checks, and what the approve gate would refuse for the next pending phase). Returns checks, phase, approvals, pendingGates, forcedGates, nextGate {phase, ready, failing}, gatesOk, summary, readyToAdvance (no fail) and verdict.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_approve",
    description: "Record human approval of a phase gate for a feature (writes to .specs/<feature>/.state.json). Phases: classification, requirements, design, test-plan, eval-plan, tests, tasks, execution. The approval is a GATE: that phase's checks run first (requirements: EARS errors, template placeholders, open [NEEDS CLARIFICATION], success criteria + priorities, AC uniqueness — bugfix: bug.md Reproduction; design: placeholders, Constitution Check, active +saas/+ai sections, clarifications — bugfix: bug.md Root Cause instead; test-plan: placeholders, every AC has a test, no row citing an AC requirements.md does not define; eval-plan: placeholders; tasks: no placeholder tasks, every AC covered, no phantom IDs; tests — the Phase 4 sign-off: +tdd every planned T-ID named by a test file (tests-in-code), +ai an evals/golden.json of the feature's own, not the scaffold's sample (eval-sets), nothing to approve on a core-only feature; execution — spec_finish's blockers: doctor, root-cause, placeholders, changed-since-approval, tasks, open-tasks, verification, approval-gates) and any failure REFUSES it, listing the failing check ids and details. Phase by phase: while an EARLIER active phase with an artifact is still unapproved (a bugfix's design before its tasks), the approval is refused too — check `phase-order`, naming the earlier phase(s) to approve first. `force: true` records it anyway as a forced approval (`forced` + the failing ids; doctor's approval-gates and the roadmap keep flagging it). A phase with no artifact (eval-plan without +ai, test-plan without +tdd, a missing file) can't be approved, not even with force. Makes approval-gated progress auditable and resumable.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, phase: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"] }, by: { type: "string", description: "Approver (default: $USER / $USERNAME, else 'user' — same as the CLI)." }, force: { type: "boolean", description: "Approve even though the phase's checks fail — recorded as forced, with the failing check ids (CLI: --force)." }, projectDir: { type: "string" } }, required: ["name", "phase"] },
  },
  {
    name: "steering_scaffold",
    description: "Create a single steering file from its template (constitution.md, product.md, tech.md, structure.md, testing-standards.md, scale.md, observability.md, cost.md, ai-strategy.md) — or a CUSTOM scoped steering file for any other name matching ^[a-z0-9][a-z0-9-]{0,62}\\.md$ (not a Windows device name such as nul.md/com1.md, not a JavaScript built-in): a stub with Kiro-compatible front matter (`inclusion: always | fileMatch | manual`, `fileMatchPattern: \"src/api/**\"` — a glob with ** * ? {a,b}, or a list) plus short guidance. spec_task_brief includes `always` files, `fileMatch` files whose pattern matches one of the task's _Implements:_ paths (their body quoted, front matter stripped), and lists `manual` ones as available on request; spec_doctor warns about steering files still holding template placeholders. In `lang` (en/pt/es; defaults to the project language). Idempotent — never overwrites.",
    inputSchema: { type: "object", properties: { file: { type: "string", description: "A known template name, or a custom name like api-conventions.md." }, lang: { type: "string", enum: ["en", "pt", "es"] }, projectDir: { type: "string" } }, required: ["file"] },
  },
  {
    name: "spec_roadmap",
    description: "Show the multi-feature roadmap: each feature's tracks, phase, completion % (planning phases up to 30%, then driven by the fraction of tasks done), declared dependencies, blocked status (a dep is met when that feature is 100%), plus overall % and any circular dependency. With `write: true`, (re)generates the always-current overview: `.specs/ROADMAP.md` by default (Markdown, keeps the Mermaid dependency graph — git-friendly) — and also a self-contained brand-styled `.specs/ROADMAP.html` (light/dark toggle, offline) when `html: true`. Pass `lang` ('en'/'pt'/'es') to localize the roadmap chrome only (stored as meta.roadmapLang for auto-refresh; the project language is unchanged). `html: true` implies writing. A same-named file that dev-spec did not generate is never overwritten — the result is then an error naming it (`errors`), with `wrote` listing only what was written. Reads .specs/roadmap.json + the feature folders.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" }, write: { type: "boolean", description: "(Re)write .specs/ROADMAP.md (default format)." }, html: { type: "boolean", description: "Also (re)write the brand-styled .specs/ROADMAP.html." }, lang: { type: "string", enum: ["en", "pt", "es"], description: "Language for the roadmap chrome." } } },
  },
  {
    name: "spec_backlog",
    description: "Manage the backlog — planned features that don't have a `.specs/<feature>/` folder yet (so the roadmap's 'what's left' includes work not yet started). Actions: 'add' (name + optional note), 'rm', or omit to list. Stored in .specs/roadmap.json.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["add", "rm", "list"] }, name: { type: "string" }, note: { type: "string" }, projectDir: { type: "string" } } },
  },
  {
    name: "spec_depend",
    description: "Show or edit a feature's dependencies and/or order in .specs/roadmap.json. `dependsOn` REPLACES the list ([] clears it); `add` / `remove` edit it incrementally; `order` sets the position; `name` alone only returns the current dependencies (nothing is written). Every dependency must be an existing feature. Rejects changes that would create a circular dependency. Use for 'feature X depends on Y' or 'do X before Y' (set order).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, dependsOn: { type: "array", items: { type: "string" }, description: "Replaces the list with these feature slugs ([] clears it)." }, add: { type: "array", items: { type: "string" }, description: "Feature slugs to add to the current list." }, remove: { type: "array", items: { type: "string" }, description: "Feature slugs to remove from the current list." }, order: { type: "integer", description: "Optional explicit ordering position." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_scan",
    description: "Brownfield: heuristic, bounded, read-only scan of an EXISTING codebase (no model, no cost) — file inventory by extension, top-level modules, stack + web frameworks (manifests; FastAPI/Flask/Django also from imports), HTTP ROUTES with method + path + file:line (Express/Koa/Fastify/Hono, NestJS, Next.js, Flask, FastAPI, Django, Spring, ASP.NET, Rails/Sinatra, Laravel/Symfony, Go net/http/gin/echo/chi/fiber; listed up to a cap, `candidateEndpoints` counts every route), test frameworks + test-file count, entrypoints, environment variable NAMES the code reads (never values; .env itself is never read — only .env.example-style files), and migration/schema files. The agent interprets this to infer steering/constitution and reverse-engineer specs.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" }, cap: { type: "integer", minimum: 1, description: "Max files to scan (default 5000)." } } },
  },
  {
    name: "spec_coverage",
    description: "Brownfield: how much of the codebase is covered by specs — the share of code files (test files reported apart) named in any `_Implements:_` marker (a file, a folder or a glob) of any feature, active or archived, with a per-top-level-folder breakdown (`byFolder`), the uncovered folders, per-feature counts, the _Implements:_ entries that name nothing on disk (`unmatchedImplements`) and those naming an existing test or non-code file (`nonCodeImplements`, informational). `coveragePercent` = covered code files / code files; `documented`/`undocumented` = folders with at least one / no covered file.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" } } },
  },
  {
    name: "spec_clarify",
    description: "Surface ambiguities and gaps in a feature's requirements BEFORE design: vague terms, leftover placeholders/TBD, missing edge-cases/NFR/out-of-scope sections, missing IF…THEN failure paths, and track-specific gaps (tenant isolation, AI quality/cost). Returns a list of clarification questions to ask the user.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_next_action",
    description:
      "\"You are here, do this next.\" ONE recommendation for a feature, phase by phase — `step`: re-review (an artifact changed after ITS approval, so a spec edited post-approval is re-reviewed, not silently shipped; `impact` = {tool: 'spec_impact', phases} when that approval has a snapshot to diff) → then the FIRST active phase not approved yet (classification, requirements, design, test-plan (+tdd), eval-plan (+ai), tests (Phase 4 on +tdd/+ai, once its plan exists), tasks): fill (its artifact still missing or a template; `file` names it) → fix (what that phase's approve gate would refuse: `refusedGate` {phase, failing}) → approve (its gate passes) — the next phase starts only after that approval, so the design is never asked for before the requirements are approved → fix (every phase approved, but a check of the current or an earlier phase still fails, e.g. after a forced approval) → implement (the next open task) → verify (every task ticked, but one is not verified — its latest recorded run failed, or its runnable _Verify:_ has only a note, stale or shared-number evidence: spec_finish and the execution sign-off refuse it; the recommendation names each task with its reason and how to record a passing run, e.g. `dev-spec done <f> <n> --run`) → finish (every task done and verified: run spec_finish); `tasks` when there are no tasks yet. Once spec_finish {write} has recorded the finish: `finished` (it asks for the execution sign-off while that approval is missing) or `drift` (implementing files changed since the finish — decide: spec wrong → spec_impact, code wrong → fix, harmless → re-finish), with `drift` {finishedAt, files, changed, missing, nowPresent, drifted}. A finished feature that changed since its finish (a change request or a re-approval after it, or an _Implements:_ file its baseline never recorded) and whose tasks are done again answers `finish` again — re-run spec_finish {write} for a fresh report, merge summary and baseline, then the execution sign-off — with `staleBaseline` {finishedAt, since: [{kind: 'change-request', n, at} | {kind: 'approval', phase, at}], newFiles} (and `drift`: its recorded files are still hashed — when one of them changed, the step is `drift`, the decision first, then finish again); an execution sign-off older than such a change (or than a later approval, e.g. an upgraded feature's tests sign-off) is asked to be re-confirmed, naming what came after it. Also returns phase, tracks, the doctor verdict, gatesOk, pendingGates, changedSinceApproval and the localized `recommendation`. Use to resume work or answer 'what now?'.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_add_track",
    description:
      "Escalate an EXISTING feature to a new track (+tdd, +saas or +ai) - additive only, never overwrites. Scaffolds just the missing artifacts (test-plan.md/tests/, eval-plan.md/prompts/evals/, load-test.md), appends that track's mandatory design.md sections and template tasks, adds its steering files, updates classification.md's Active Tracks line and persists the track set in .state.json. `track` takes one or several ('saas,ai', '+saas +ai'); an unknown track is an error with a did-you-mean. With `remove: true` the track is turned OFF instead - non-destructive: no file is deleted, the result lists the now-inactive artifacts, and doctor/status/next_action stop requiring them ('core' can't be removed; a bugfix keeps +tdd). Use when a feature grew into needing tests, scale, or AI after it was created (or no longer does).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, track: { type: "string", description: "tdd | saas | ai - or several: 'saas,ai' / '+saas +ai'." }, remove: { type: "boolean", description: "Turn the track(s) off instead (files are kept, listed as inactive)." }, projectDir: { type: "string" } }, required: ["name", "track"] },
  },
  {
    name: "spec_feature",
    description:
      "Manage a feature's lifecycle: remove (delete its `.specs/<slug>/` folder), archive (move it to `.specs/_archive/<slug>/`, out of the active roadmap — its roadmap.json entry and the dependsOn references it prunes are recorded in its .state.json `archived`; the result names the features that depended on it in `dependentsPruned`, with `incompleteDependency: true` and a localized warning `note` when the archived feature was not complete — they now read as unblocked), restore (move `.specs/_archive/<slug>/` back to `.specs/<slug>/` and put back its roadmap.json entry and the dependsOn references archive pruned — only for features that still exist, the rest are listed in `skipped`; an error if an active feature has that slug or nothing is archived under that name), or rename (slug + folder + roadmap.json key, with every reference updated: dependsOn lists, `_Supersedes: <old>/US-n.AC-m_` markers in other features' requirements.md — active and archived, never one in a comment or fenced code — and archived features' archive records, so restore brings their dependencies back; listed in `supersedesUpdated` / `archiveRecordsUpdated` and a localized `note`). All actions keep roadmap.json dependencies consistent and regenerate the roadmap (and .specs/SPECS.md when it exists). 'remove' is destructive and needs `confirm: true` - without it nothing is deleted and the result (an error with needsConfirm) lists what would be; prefer 'archive' (reversible with 'restore'). A folder is never moved or deleted while another process updates that feature (its .specs/<slug>/.lock) or roadmap.json (.specs/.roadmap.lock): the action waits, then answers `busy` with a localized error and nothing changed.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["remove", "archive", "rename", "restore"] }, name: { type: "string" }, newName: { type: "string", description: "New name (required for action 'rename')." }, confirm: { type: "boolean", description: "Must be true for action 'remove' (deletion is permanent). Ignored by archive/rename/restore." }, projectDir: { type: "string" } }, required: ["action", "name"] },
  },

  {
    name: "spec_import",
    description:
      "Import a spec written for another tool as a NEW dev-spec feature (never over an existing feature; the source files are only read, never modified). `tool`: 'kiro' (.kiro/specs/<name>/ — requirements.md '### Requirement N' + numbered WHEN/THEN/SHALL criteria, design.md, tasks.md with _Requirements: 1.1, 2.3_), 'spec-kit' (specs/<nnn-name>/ — spec.md user stories + Given/When/Then acceptance scenarios + FR-xxx/SC-xxx, plan.md → design.md, tasks.md 'T001 [P] [US1] …'), or 'openspec' (openspec/specs/<capability>/spec.md '### Requirement:' + '#### Scenario:', or a change folder openspec/changes/<id>/). Requirement/story N criterion/scenario M → US-N.AC-M; each scenario becomes ONE EARS criterion (WHEN … THE SYSTEM SHALL …) where possible, else its text is kept with [NEEDS CLARIFICATION]; Kiro _Requirements:_ references are rewritten; tasks are renumbered 1…K keeping checkbox state and [P]/[USn] tags; SC-/FR- IDs stay. Every generated artifact carries an 'Imported from <tool> <path> on <date>' note. `path` must resolve inside the project. Tracks: `tracks`, else auto-classified from the imported requirements. Returns {feature, files, mapping: {oldId: newId}, warnings}.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", enum: ["kiro", "spec-kit", "openspec"], description: "The format of the source spec." },
        path: { type: "string", description: "The spec's folder (or a file inside it), relative to the project root or absolute — it must be inside the project." },
        name: { type: "string", description: "Feature name (default: the source folder's name; spec-kit's number prefix is dropped). An existing feature with that slug is an error." },
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Active tracks ('core' always added). Omit to auto-classify from the imported requirements." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Language of the generated artifacts (headings, notes). Defaults to the project language, else en. The imported text itself is kept as written." },
        projectDir: { type: "string" },
      },
      required: ["tool", "path"],
    },
  },

  {
    name: "spec_append_tasks",
    description:
      "Converge: append NEW tasks to an existing feature's tasks.md without touching the tasks already there (never renumbered or edited). They are numbered after the highest number in use and go under a phase heading — default a localized 'Phase: Convergence' (created with a closing **Checkpoint:**, after the last active phase); an existing heading with that exact text is reused (tasks go at the end of that phase, before its closing checkpoint). Each task becomes `- [ ] N. [USn][P] text` with `_Requirements:_` / `_Implements:_` / `_Verify:_` sub-lines, so status, next_task {batch}, task_brief, complete_task (evidence) and finish work on them as on any task. Every AC ID must exist in requirements.md — an unknown one is an error and NOTHING is written; _Implements:_ paths must be project-relative (stored with forward slashes, no '..'). CRLF line endings and a BOM are preserved; a removed track's task section is never used. New content invalidates an earlier tasks approval: the result says so (`needsReapproval`) — review and re-approve. Use when implementation drifted from the plan or a review found follow-up work.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        tasks: {
          type: "array",
          description: "The tasks to append, in order (at least one).",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "Task description (required)." },
              requirements: { type: "array", items: { type: "string" }, description: "AC IDs the task proves (e.g. US-1.AC-2) — each must exist in requirements.md." },
              implements: { type: "array", items: { type: "string" }, description: "Project-relative files the task touches (_Implements:_)." },
              verify: { type: "string", description: "Single-line command that proves the task (_Verify:_) — spec_complete_task then needs its passing run as evidence." },
              story: { type: "string", description: "US<n> (e.g. US1) or shared." },
              parallel: { type: "boolean", description: "[P] — can run in parallel (different files, no dependencies)." },
            },
            required: ["text"],
          },
        },
        heading: { type: "string", description: "Phase heading to append under (default: the localized 'Phase: Convergence')." },
        projectDir: { type: "string" },
      },
      required: ["name", "tasks"],
    },
  },

  {
    name: "spec_impact",
    description:
      "Change request: what an edit made AFTER an approval touches. Compares the current artifact with the snapshot saved by its latest approval (.specs/<feature>/.history/<phase>@<n>.md — every spec_approve appends to .state.json approvalHistory and saves one). `phase` 'requirements' (default): AC-level diff via stable IDs — added / modified (whitespace-normalized text differs) / removed ACs, plus SC-/EC-/NFR- IDs — and, for each modified or removed ID, the tasks citing it in _Requirements:_ (done/open + evidence state), the T-IDs covering it in the test plan and the design sections mentioning it. 'design': section-level diff (## headings, by normalized body — of design.md; for a bugfix, of bug.md and design.md, which its design approval signs off, each section keyed by its file ('bug.md: Root Cause'), with `designMd` giving design.md's baseline) and the tasks citing an ID named in a changed section. 'tasks': added / removed / changed task numbers. An approval made before the change history has only a fingerprint → `baseline: 'fingerprint-only'` with `changed` and a hint to re-approve (which starts the history); one with no fingerprint either (≤1.10, a 1.12 bugfix design approval) → `baseline: 'none'`, `changed: null` (unknown — a file date is no evidence) unless a file was added after it; a phase never approved is an error. `reopen: true` (requirements/design): unticks the affected DONE tasks (never those of a REMOVED criterion — requirements returns them with their test rows in `retire` [{id, tasks, tests}] to delete or repoint, and a design section naming only removed criteria reopens nothing), marks their evidence stale (they count as unverified until a new run is recorded), records the change request in .state.json `changes` and refreshes the roadmap — it never edits requirements.md or design.md, and a second reopen with nothing new changes nothing.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        phase: { type: "string", enum: ["requirements", "design", "tasks"], description: "Which approved artifact to compare (default requirements)." },
        reopen: { type: "boolean", description: "requirements/design only: untick the affected done tasks, mark their evidence stale and record the change request." },
        projectDir: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "spec_metrics",
    description:
      "Metrics & retrospective, derived locally from .state.json, .history/ and the artifacts (no model, no cost). With `name`: that feature's createdAt (older features: the earliest approval, else the folder's date — flagged approximate), lead time in hours from creation to the first approval of each phase (classification → requirements → design → test-plan/eval-plan → tests → tasks; a phase never approved is null) and to complete (all tasks done) / finished (the earliest of the first execution approval and the finish spec_finish {write} recorded on a ready feature), rework (approvals of a phase beyond its first, from approvalHistory; approvals made before the change history are counted once and listed in `legacyPhases`, their rework unknown — `rework` is then a lower bound (`reworkLowerBound`), or null when nothing was approved under the history), forced approvals, change requests (spec_impact reopen) and reopened tasks, evidence pass rate (passing runs / all recorded runs, percent), tasks done/total and open [NEEDS CLARIFICATION] markers. Without `name`: every feature plus averages/medians and totals. `write: true` (with `name`) creates .specs/<feature>/retro.md — a localized retrospective pre-filled with the metrics (What went well / What hurt / Proposed steering or constitution amendments for human approval, never applied automatically / Follow-ups as candidate backlog items); an existing retro.md is never overwritten.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug. Omit for the whole project." },
        write: { type: "boolean", description: "Create .specs/<feature>/retro.md (needs name; never overwrites)." },
        projectDir: { type: "string" },
      },
    },
  },

  {
    name: "spec_catalog",
    description:
      "Living catalog — 'what the system does today': every feature (active; complete/finished; archived under .specs/_archive) with its status — `finished` as spec_next_action / spec_finish mean it: a current finish baseline (no change request, re-approval or new _Implements:_ file since), every artifact as approved and every tick verified, else `complete` — and every AC ID with a one-line EARS text, grouped by feature. A criterion replaced by a later feature is shown as superseded, naming the ID that replaces it: the newer criterion declares it with the English-stable marker `_Supersedes: <feature>/US-n.AC-m[, …]_` (same line, a sub-line or its table row; trace_check reports references that resolve to nothing as `phantomSupersedes` warnings). With `write: true` it (re)writes `.specs/SPECS.md` — chrome in the project language, carrying the AUTO-GENERATED marker; a hand-written SPECS.md (no marker) is never overwritten (the result is then an error). Without `write` it returns the structure plus the markdown. Once SPECS.md exists, every mutator that refreshes the roadmap refreshes it too.",
    inputSchema: { type: "object", properties: { write: { type: "boolean", description: "(Re)write .specs/SPECS.md (never over a hand-written one)." }, projectDir: { type: "string" } } },
  },
  {
    name: "spec_drift",
    description:
      "Drift since finish: spec_finish {write: true} on a ready feature records a baseline — a CRLF-normalized sha1 of every file its `_Implements:_` markers name (a folder expands to its files; only files inside the project). spec_drift compares each finished feature's recorded files with the working tree and reports, per feature, the files changed, missing, or now present (missing at finish) since that baseline. `name` checks one feature (active or archived); features without a baseline are listed apart (`unbaselined`), not an error, and so are baselined features whose tasks are open again (`reopened` — checked once they are finished again) and finished features that changed since their finish (`stale` [{feature, finishedAt, since, newFiles, why, drifted}] — a change request or a re-approval after it, or — for an ACTIVE feature — an _Implements:_ file the baseline never recorded: verdict `stale` unless something drifted — finish them again (an archived one can't be finished where it is: its `archived: true` entry means restore, finish, archive again); their recorded files are still hashed, and one that changed ALSO lists the feature in `features` (with `stale: true`) and `drifted`, verdict `drift` — decide on the drift first). An unreadable .state.json is reported in `errors` (verdict `error`), never as clean. Read-only; hashes only the recorded files (never walks the tree).",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "One feature (active or archived). Omit for every feature." }, projectDir: { type: "string" } } },
  },
];

// --- Tool dispatch ---------------------------------------------------------

function runTool(name, args) {
  args = args || {};
  // Guard against RELATIVE traversal only: a tool call must not reach out of the project with `..`.
  // This is NOT a sandbox — an absolute projectDir is accepted by design (multi-project use), and the
  // engine confines every write to <projectDir>/.specs/. (The CLI, user-driven, is not restricted.)
  if (args.projectDir && RE_DOTDOT.test(String(args.projectDir))) {
    return { ok: false, error: argMessages().dotdot };
  }
  // …nor reach out of the MACHINE: a network path is refused before any fs call (isNetworkPath).
  if (args.projectDir && isNetworkPath(args.projectDir)) {
    return { ok: false, error: argMessages().network(String(args.projectDir).trim()) };
  }
  const pdir = spec.resolveProjectDir(args.projectDir);
  switch (name) {
    case "spec_init": // guard: boolean → roadmap.json meta.guard (undefined leaves it unchanged; same call as `init --guard`)
      return spec.initProject(pdir, args.tracks, args.lang, { guard: args.guard });
    case "spec_classify":
      return spec.classify(args.description, { name: args.name, lang: args.lang });
    case "spec_create": {
      // No tracks → the engine keeps an existing feature's tracks, or classifies a new one (same as the CLI).
      const cls = spec.classify(args.summary || "", { name: args.name, lang: args.lang });
      return spec.createFeature(pdir, args.name, args.tracks, args.summary, cls, args.lang, args.kind, { brownfield: args.brownfield === true });
    }
    case "spec_list":
      return spec.listFeatures(pdir);
    case "spec_status":
      return spec.statusFeature(pdir, args.name);
    case "spec_next_task":
      return spec.nextTask(pdir, args.name, { batch: args.batch, max: args.max });
    case "spec_task_brief":
      return spec.taskBrief(pdir, args.name, args.number, { write: args.write, includeBrief: args.includeBrief });
    case "spec_complete_task":
      return spec.completeTask(pdir, args.name, args.number, args.evidence);
    case "spec_finish":
      return spec.finishFeature(pdir, args.name, { write: args.write, includeBody: args.includeBody });
    case "ears_validate":
      return !args.text && args.name ? spec.earsFeature(pdir, args.name) : spec.earsValidate(args.text, args.lang || spec.projectLang(pdir));
    case "trace_check":
      return spec.traceCheck(pdir, args.name, { code: args.code === true }); // same call as `dev-spec trace <f> --code`
    case "spec_doctor":
      return spec.specDoctor(pdir, args.name);
    case "spec_approve":
      return spec.approvePhase(pdir, args.name, args.phase, args.by, { force: args.force === true });
    case "steering_scaffold":
      return spec.scaffoldSteeringFile(pdir, args.file, args.lang);
    case "spec_roadmap": // html:true implies writing; a failed write is an error (same engine call as the CLI)
      return spec.roadmapReport(pdir, { write: args.write, html: args.html, lang: args.lang });
    case "spec_backlog":
      return spec.backlog(pdir, args.action, args.name, args.note);
    case "spec_depend":
      return spec.setDependency(pdir, args.name, args.dependsOn, args.order, { add: args.add, remove: args.remove });
    case "spec_scan":
      return spec.scanCodebase(pdir, { cap: args.cap });
    case "spec_coverage":
      return spec.coverage(pdir);
    case "spec_clarify":
      return spec.clarify(pdir, args.name);
    case "spec_next_action":
      return spec.nextAction(pdir, args.name);
    case "spec_add_track":
      return spec.addTrack(pdir, args.name, args.track, { remove: !!args.remove });
    case "spec_feature":
      return spec.manageFeature(pdir, args.action, args.name, args.newName, { confirm: args.confirm === true });

    case "spec_import": // the engine refuses a path outside the project (same call as the CLI's `import`)
      return spec.importSpec(pdir, args.tool, args.path, { name: args.name, tracks: args.tracks, lang: args.lang });

    case "spec_append_tasks":
      return spec.appendTasks(pdir, args.name, args.tasks, { heading: args.heading });

    case "spec_impact": // the same engine call as the CLI's `impact` (reopen only on an explicit true)
      return spec.impactReport(pdir, args.name, { phase: args.phase, reopen: args.reopen === true });
    case "spec_metrics":
      return spec.metrics(pdir, args.name, { write: args.write === true });

    case "spec_catalog": // a refused write (hand-written SPECS.md, no .specs/) is an error — same call as the CLI's `catalog`
      return spec.catalog(pdir, { write: args.write === true });
    case "spec_drift":
      return spec.drift(pdir, args.name);
    default:
      throw new Error("Unknown tool: " + name);
  }
}

// --- JSON-RPC / MCP plumbing ----------------------------------------------

let batchSink = null; // while handling a batch, replies are collected and sent as ONE array
function send(msg) {
  if (batchSink) batchSink.push(msg);
  else process.stdout.write(JSON.stringify(msg) + "\n");
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

// Required arguments per tool, straight from the advertised inputSchema — a missing `name` must be an
// error, not a folder called "undefined".
function missingArgs(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool || !tool.inputSchema || !Array.isArray(tool.inputSchema.required)) return [];
  return tool.inputSchema.required.filter((k) => args[k] === undefined || args[k] === null || (typeof args[k] === "string" && !args[k].trim()));
}

// Argument TYPES, also straight from the inputSchema, checked before dispatch. A wrong type used to reach the
// engine and be coerced: number 1.9 ticked task 1, name {a:1} created .specs/object-object/, cap "abc"
// scanned 0 files, text 123 threw 'text.trim is not a function'. Unknown extra properties are ignored.
const RE_DOTDOT = /(^|[\\/])\.\.([\\/]|$)/;
// A network path in projectDir — UNC `\\host\share`, `//host/share`, `\\?\UNC\host\share`, `\\.\UNC\…` — made this
// local server open an SMB/WebDAV connection to whatever host a tool call named (on Windows the redirector sends the
// user's NTLM credentials) and, the engine being synchronous, stop answering every call while an unreachable host
// timed out. The engine and server make no network calls, so such a projectDir is refused before any fs call — as
// spec_import / the trace globs already refuse paths outside the project. Allowed: the local extended/device forms of
// a drive path (`\\?\C:\…`, `\\.\C:\…`) and WSL's own hosts (`\\wsl$\…`, `\\wsl.localhost\…`, local to the machine).
// Other device paths (`\\.\pipe\…`, `\\?\Volume{…}\…`) are no project folder either. A default projectDir (the
// server's cwd, SPEC_PROJECT_DIR, CLAUDE_PROJECT_DIR) is the user's own config, not an argument, and the CLI is
// user-driven: neither is restricted. (A drive letter mapped to a share can't be told apart without I/O.)
function isNetworkPath(p) {
  const s = String(p).trim();
  if (!/^[\\/]{2}/.test(s)) return false;
  let rest = s.slice(2);
  if (/^[?.][\\/]/.test(rest)) {
    rest = rest.slice(2);
    if (/^[A-Za-z]:(?:[\\/]|$)/.test(rest)) return false; // \\?\C:\… — a local drive
    if (!/^UNC[\\/]/i.test(rest)) return true; // \\.\pipe\…, \\?\Volume{…}, \\?\GLOBALROOT\… — not a project folder
    rest = rest.slice(4);
  }
  const host = rest.split(/[\\/]/)[0].toLowerCase();
  return host !== "wsl$" && host !== "wsl.localhost";
}
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const TYPE_CHECK = {
  string: (v) => typeof v === "string",
  // Safe integers only: 1.9 is not an integer, and neither is 1e21 for the engine — String(1e21) is '1e+21',
  // which parseInt reads as 1 (both used to tick task 1).
  integer: (v) => Number.isSafeInteger(v),
  number: (v) => typeof v === "number" && Number.isFinite(v),
  boolean: (v) => typeof v === "boolean",
  array: (v) => Array.isArray(v),
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  null: (v) => v === null,
};
// Validation messages in the project's language (projectDir only when it is a local string without '..' — reading a
// network projectDir's roadmap.json for its language would be the very connection runTool refuses).
function argMessages(args) {
  const pd = args && typeof args.projectDir === "string" && !RE_DOTDOT.test(args.projectDir) && !isNetworkPath(args.projectDir) ? args.projectDir : undefined;
  try {
    return spec.msg(spec.projectLang(spec.resolveProjectDir(pd))).args;
  } catch {
    return spec.msg("en").args;
  }
}
function shortJson(v) {
  let s;
  try { s = JSON.stringify(v); } catch { s = undefined; }
  if (s === undefined) s = String(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}
function expectedType(schema, A) {
  const types = [].concat(schema.type || []);
  let d = Array.isArray(schema.enum) ? A.oneOf(schema.enum.join(", "))
    : types.map((t) => (t === "array" && schema.items ? A.arrayOf(expectedType(schema.items, A)) : hasOwn(A.type, t) ? A.type[t] : t)).join(" | ");
  if (schema.minimum != null) d += " " + A.atLeast(schema.minimum);
  return d;
}
function schemaIssues(schema, value, where, out) {
  const types = [].concat(schema.type || []);
  const bad = () => out.push({ where, schema, value });
  if (types.length && !types.some((t) => hasOwn(TYPE_CHECK, t) && TYPE_CHECK[t](value))) return bad();
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return bad();
  if (typeof value === "number" && schema.minimum != null && value < schema.minimum) return bad();
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => schemaIssues(schema.items, v, `${where}[${i}]`, out));
  if (TYPE_CHECK.object(value) && schema.properties) propertyIssues(schema.properties, value, where + ".", out);
}
// Iterates the SCHEMA's keys (never the caller's), so '__proto__' / 'constructor' arguments are just ignored.
function propertyIssues(props, obj, prefix, out) {
  for (const [k, s] of Object.entries(props)) {
    // absent or null = not given (the engine applies its default) — the same rule as missingArgs
    if (hasOwn(obj, k) && obj[k] !== undefined && obj[k] !== null) schemaIssues(s, obj[k], prefix + k, out);
  }
}
// [{ where, schema, value }] — formatted (and localized) only when there is something to report.
function invalidArgs(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool || !tool.inputSchema || !tool.inputSchema.properties) return [];
  const out = [];
  propertyIssues(tool.inputSchema.properties, args, "", out);
  return out;
}
// String enums are case-insensitive where the ENGINE folds them (phase, lang, kind, action — the CLI passes 'Design' / 'PT'
// straight through and the 1.12 MCP accepted them): a value that trims + lowercases to a member is replaced by it before
// validation, so both surfaces take the same input. spec_import's `tool` stays exact on both surfaces (the engine
// matches it literally). Only the schema's own top-level keys are read; a value that folds to no member is left as given
// (the enum error names it).
const EXACT_ENUMS = { spec_import: new Set(["tool"]) };
function foldEnumArgs(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool || !tool.inputSchema || !tool.inputSchema.properties) return args;
  let out = args;
  for (const [k, s] of Object.entries(tool.inputSchema.properties)) {
    if (!Array.isArray(s.enum) || !hasOwn(args, k) || typeof args[k] !== "string" || (EXACT_ENUMS[toolName] && EXACT_ENUMS[toolName].has(k))) continue;
    const v = args[k].trim().toLowerCase();
    if (v !== args[k] && s.enum.includes(v)) {
      if (out === args) out = { ...args };
      out[k] = v;
    }
  }
  return out;
}
function argError(id, message) {
  return result(id, { content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }, null, 2) }], isError: true });
}

function handle(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return error(null, -32600, "Invalid Request");
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;
  // Notifications never get a response — and never run tools.
  if (isNotification) return;

  try {
    switch (method) {
      case "initialize": {
        const asked = params && params.protocolVersion;
        const proto = SUPPORTED_PROTOCOLS.includes(asked) ? asked : asked ? SUPPORTED_PROTOCOLS[SUPPORTED_PROTOCOLS.length - 1] : DEFAULT_PROTOCOL;
        return result(id, {
          protocolVersion: proto,
          serverInfo: SERVER_INFO,
          capabilities: { tools: { listChanged: false } },
          instructions:
            "Local spec-driven engine. Use spec_classify to pick tracks, spec_init to scaffold steering, spec_create to scaffold a feature, then spec_status / spec_next_task / spec_complete_task to drive execution (spec_task_brief builds a self-contained brief per task for subagent execution). ears_validate, trace_check and spec_doctor enforce quality gates. All file ops are local to the project's .specs/ directory.",
        });
      }
      case "ping":
        return result(id, {});
      case "tools/list":
        return result(id, { tools: TOOLS });
      case "tools/call": {
        const toolName = params && params.name;
        const rawArgs = params ? params.arguments : undefined;
        if (rawArgs != null && !TYPE_CHECK.object(rawArgs)) return argError(id, argMessages().notObject);
        const args = foldEnumArgs(toolName, rawArgs || {});
        const missing = missingArgs(toolName, args);
        if (missing.length) return argError(id, argMessages(args).missing(missing.join(", ")));
        const invalid = invalidArgs(toolName, args);
        if (invalid.length) {
          const A = argMessages(args);
          return argError(id, A.invalid(invalid.map((i) => A.item(i.where, expectedType(i.schema, A), shortJson(i.value))).join("; ")));
        }
        let out;
        try {
          out = runTool(toolName, args);
        } catch (e) {
          return result(id, { content: [{ type: "text", text: "ERROR: " + e.message }], isError: true });
        }
        const isErr = out && out.ok === false;
        return result(id, {
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
          isError: !!isErr,
        });
      }
      default:
        return error(id, -32601, "Method not found: " + method);
    }
  } catch (e) {
    error(id, -32603, "Internal error: " + e.message);
  }
}

function main() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return error(null, -32700, "Parse error");
    }
    if (Array.isArray(msg)) {
      if (!msg.length) return error(null, -32600, "Invalid Request");
      batchSink = [];
      try {
        msg.forEach(handle);
      } finally {
        const replies = batchSink;
        batchSink = null;
        if (replies.length) process.stdout.write(JSON.stringify(replies) + "\n");
      }
    } else handle(msg);
  });
  rl.on("close", () => process.exit(0));
}

main();

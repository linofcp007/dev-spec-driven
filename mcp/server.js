#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local MCP server (stdio, zero-dependency).
 *
 * Implements the Model Context Protocol over newline-delimited JSON-RPC 2.0
 * on stdin/stdout. No npm install, no network, no cost — pure Node core.
 *
 * Tools (all operate on the project's `.specs/` directory): see TOOLS below —
 * 32 tools, verify with an `initialize` + `tools/list` handshake.
 * Prompts: one per plugin command (commands/*.md) — slash commands in MCP clients without the skill
 * (SPEC_MCP_PROMPTS=off drops them). Resources: the project's spec artifacts, read-only, as specs:// URIs.
 * Both live in lib/prompts-resources.js.
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const spec = require("./lib/spec.js");
const content = require("./lib/prompts-resources.js"); // MCP prompts + resources

let VERSION = "0.0.0";
try {
  VERSION = require(path.join(__dirname, "..", "package.json")).version || VERSION;
} catch {
  /* keep fallback */
}
const SERVER_INFO = { name: "dev-spec-driven", version: VERSION };
const DEFAULT_PROTOCOL = "2024-11-05";
// Protocol revisions this server speaks. A client asking for another one gets the latest.
const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18"];

// --- Tool catalogue --------------------------------------------------------

const TOOLS = [
  {
    name: "spec_init",
    description:
      "Initialize spec-driven structure in the project: create `.specs/steering/` and the steering files required by the given tracks (constitution/product/tech/structure always; testing-standards for +tdd; scale/observability/cost for +saas; ai-strategy for +ai; security for +sec; privacy for +privacy). Steering content is generated in `lang` (en/pt/es), which also becomes the project's default language (persisted in .specs/roadmap.json meta.lang and inherited by every new feature). `guard` turns the opt-in guard mode on/off (roadmap.json meta.guard; with or without tracks): while on, the plugin's PreToolUse hook ASKS before Write/Edit on a code file outside .specs/ unless some feature has approved, unfinished tasks; `guard: \"scope\"` also asks, once tasks are approved, for a code file no open task names in _Implements:_. The result always reports the current `guard` state (true | false | \"scope\"). `stopCheck` turns the end-of-turn evidence gate on/off (roadmap.json meta.stopCheck, on by default — the plugin's Stop hook); the result always reports the current `stopCheck`. `checks` = the project's named check commands (roadmap.json meta.checks, e.g. {\"test\": \"npm test\", \"lint\": \"npm run lint\", \"typecheck\": \"npx tsc --noEmit\"}): the given names are added or replaced, an empty command removes one, the others are kept; every task brief lists them in its definition of done, and once set spec_finish needs a passing recorded run of each since the feature's last task activity (blocker suite-evidence). The result always reports the current `checks`. `approvalRoles` (team governance, opt-in) maps phases to the roles that must sign them off — e.g. {\"requirements\": [\"product\"], \"design\": [\"tech\", \"security\"], \"tasks\": [\"tech\"]} — stored in roadmap.json meta.approvalRoles ({} clears it; the result then reports the current `approvalRoles` + a `rolesNote`): a listed phase counts as approved only once every role has signed off its current content (spec_approve {role}). Idempotent — never overwrites existing files.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Tracks in use across the project. 'core' is always included." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Project language for generated steering + tool messages (default en). Becomes the project default." },
        guard: { type: "string", enum: ["on", "off", "scope"], description: "Guard mode (opt-in): \"on\" = code edits ask for confirmation while no feature has approved, unfinished tasks; \"scope\" = that, and once tasks are approved a code file no open task names in _Implements:_ (the file, a folder above it or a glob; test files excepted) asks too, naming the task to add it to; \"off\" = off. The booleans true / false are accepted as on / off. Omit to leave it unchanged (CLI: --guard on|off|scope)." },
        stopCheck: { type: "boolean", description: "The end-of-turn evidence gate (roadmap.json meta.stopCheck; on by default): the plugin's Stop hook sends a turn back when the agent's closing message claims the work is done or verified while a recently active feature has ticked tasks without verification evidence. false = off, true = on again. Omit to leave it unchanged (CLI: --stop-check on|off)." },
        checks: { type: "object", additionalProperties: { type: "string" }, description: "Project check commands {name: command} → roadmap.json meta.checks. Names: letters, digits, . _ : - (≤ 40); commands: one line (≤ 500 chars); an empty command removes that check; at most 20. Omit to leave them unchanged (CLI: --check name=\"cmd\", repeatable)." },
        approvalRoles: { type: "object", description: "Approvals by role (opt-in): {<phase>: [<role>, …]} — phases classification … execution, roles lower-cased (letters, digits, - _ .; a \"tech+security\" string is split). {} clears them; omit to leave them unchanged (CLI: --roles requirements=product,design=tech+security | none)." },
        projectDir: { type: "string", description: "Project root. Defaults to SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / cwd." },
      },
    },
  },
  {
    name: "spec_classify",
    description:
      "Heuristically classify a feature description into the track set (core +tdd? +saas? +ai? +sec? +privacy?) using local keyword signals (EN/PT/ES) — no LLM, no cost. Returns the recommended tracks, matched signals, and reasoning. Use this to seed Phase 0; the human still approves.",
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
      "Scaffold a feature's spec folder under `.specs/<slug>/` with the artifact skeleton for the chosen tracks: classification.md, requirements.md (EARS + stable AC IDs), design.md (with mandatory +saas/+ai/+sec/+privacy sections), tasks.md, plus test-plan.md/tests/ (+tdd), eval-plan.md/prompts/evals/ (+ai), load-test.md (+saas). Artifacts are generated in `lang` (en/pt/es) — defaults to the project language, persisted per feature in .state.json. Idempotent.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name (human readable; slugified for the folder)." },
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Active tracks ('core' always added). Omit to auto-classify from name + summary (same as the CLI) — confirm with the human in Phase 0." },
        summary: { type: "string", description: "Optional one-line feature summary." },
        kind: { type: "string", enum: ["feature", "bugfix", "spike"], description: "'bugfix' scaffolds the systematic-debugging flow instead: bug.md (reproduction · root cause · fix), a one-story requirements.md (IF…THEN), a regression test plan and the fixed task order (reproduce → root cause → failing regression test → fix → verify). Always +tdd. 'spike' scaffolds a timeboxed investigation that ends in a decision: spike.md (Question · Timebox · Options considered · Evidence · Decision with _Outcome: go | no-go | pivot_ · Follow-up) and a small tasks.md of investigation steps — core-only, no requirements / design / tasks gates (spec_approve refuses them; spec_add_track refuses a spike); doctor fails `decision` until spike.md → Decision is written and warns `timebox` once its end date passed with no decision; spec_next_action goes question → investigate → decide → go: spec the real feature (seed {name, summary} from the question + decision) and archive the spike · no-go: archive it with its reason · pivot: a new spike; spec_finish is ready once the decision is written and every task ticked. Prototype code lives outside .specs/." },
        question: { type: "string", description: "kind 'spike' only: the question it answers → spike.md → Question (default: summary). Create-only." },
        timebox: { type: "string", description: "kind 'spike' only: its end — a date (YYYY-MM-DD) or a duration from today (3d, 2w, 8h) → spike.md → Timebox (**Until:** YYYY-MM-DD). Create-only." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Language for the generated artifacts. Defaults to the project language (roadmap.json meta.lang), else en." },
        brownfield: { type: "boolean", description: "The feature lands in an EXISTING codebase: also scaffold integration-plan.md (integration points · required modifications · sequencing · risks · affected files). Create-only; doctor warns while it is still the template." },
        flow: { type: "string", enum: ["requirements-first", "design-first"], description: "Phase order (1.14). 'design-first' (Kiro's tech-design-first variant — a port, platform or performance work that starts from an architecture): classification → design → requirements → test/eval plan → tests → tasks, stored in .state.json `flow` and followed by next_action, approve's phase-order check, doctor's phase scoping and the roadmap; the design gate never asks for requirements that don't exist yet. Default 'requirements-first' (unchanged). A new feature only — an existing one keeps its flow (change it with spec_feature {action: 'flow'}); a bugfix ignores it (the result's note says so)." },
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
    description: "Detailed status for one feature: active tracks, phase, artifacts present, task progress and next task, plus +saas scale-section completeness, +ai eval/prompt state and the +sec / +privacy section completeness (secSections / privacySections).",
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
      "Build a self-contained brief for ONE task (default: the next open active task; an explicit number resolves like spec_complete_task — the first OPEN task of a duplicated number) so a fresh implementer can execute it without reading the whole spec: task text + story/phase/[P]/closing checkpoint, the full EARS text of every AC it cites, the test-plan row of every T-ID it names, evals/metrics/files markers, its `_Verify:_` command (the evidence the report must carry; `verifyPipes` lists the ones that pipe into another command — a pipeline's exit code is its LAST command's, so a failing check could read as passing — and the brief says so), the tasks.md Global Constraints, the design sections that mention the task, unresolved (phantom) references, and the definition of done for the task's loop (core / tdd / ai-prompt — +ai prompt tasks are flagged inlineOnly) — plus, for a task marked `_Expect: fail_`, that its run must FAIL (`expect: \"fail\"`), and the project checks to run (roadmap.json meta.checks, `projectChecks` [{name, command}]). STEERING is selected per task: the default files (constitution/tech/structure + the active tracks' files) plus front-matter scoped files — `inclusion: always` listed, `fileMatch` included when its fileMatchPattern matches one of the task's _Implements:_ paths (real body quoted, front matter stripped, bounded), `manual` listed as available on request; the result's `steering` = {included: [{file, inclusion, patterns?, matched?, quoted?}], manual}. BUGFIX: the brief carries bug.md's Reproduction and Root Cause (`bug`; null while unwritten), and a task after the root-cause task while Root Cause is still unfilled comes back with `gated` + `gateError` (spec_complete_task would refuse it). Generated in the feature's language. With `write: true` it writes `.specs/<feature>/.execution/task-<N>-brief.md` (self-gitignored workspace, plus an append-only ledger.md) and returns the paths instead of the content — the basis of subagent-driven execution: the result then keeps only the task (number/text/story/phase), loop, inlineOnly, verify (+ verifyPipes, expect), projectChecks, implements/metrics/evals markers, `refs` {acs, tests} (the IDs it cites), unresolved, the bugfix gate and `paths`; the spec text (acceptanceCriteria, tests, designSections, steering, bug) is left out unless includeBrief.",
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
      "Close a feature (finishing-a-development-branch): a readiness report plus a merge title + summary GENERATED FROM THE SPEC CHAIN. `blockers` (readyToFinish is true only with none): doctor fail checks, an artifact changed since its approval (changedSinceApproval), template placeholders anywhere in the chain (placeholders), for a bugfix an unwritten bug.md Root Cause, no tasks, open tasks (openTasks), ticked tasks without passing verification evidence under the evidence gate (unverified), with project checks set (roadmap.json meta.checks — spec_init {checks}) a check without a passing recorded run since the feature's last task activity (suite-evidence; `suiteChecks` [{name, command, status: pass · no-run · failed · changed · before-last-tick, exitCode?, at?}]), phases awaiting approval (pendingGates). `evidence` [{name, command, exitCode, summary}] records the project checks as YOU ran them (each `name` a meta.checks name; run the configured command from the project root) in .state.json finishChecks — BEFORE the readiness is computed, so one call can make the feature ready; a failed run is recorded too (it stays a blocker); returned as `recordedChecks` (CLI: dev-spec finish <f> --run runs them). `warnings` (localized lines, never blockers): uncovered / phantom EC-, NFR- and SC- IDs and planned T-IDs that no test file names. `checks`: the track-gated items only a fresh run or a human can confirm (full suite green; +saas load test + observability; +ai cost + safety; +sec security scans + threat model re-check; +privacy data subject rights + retention; bugfix: no longer reproduces). The summary (summary, root cause/fix for bugfixes, ACs, tasks with their evidence, tests, checks, spec files) is the merge commit message. With `write: true` it is written to .specs/<feature>/.execution/merge-summary.md (content omitted unless includeBody), and a READY feature also records its drift baseline — .state.json `finished` {at, files: sha1 of every _Implements:_ file}, returned as `baseline` (with `replaced` {at, changed, missing, nowPresent} when it replaces a drifted baseline) — which spec_drift compares against later. Integration is LOCAL: the human picks merge locally or keep the branch — no pull requests, no CI. It never merges, pushes or approves by itself.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, write: { type: "boolean", description: "Write the merge summary to .specs/<feature>/.execution/merge-summary.md." }, includeBody: { type: "boolean", description: "Include the merge summary in the result (default: true when not writing, false when writing)." }, evidence: { type: "array", description: "The project checks' runs (roadmap.json meta.checks) — the server never runs them: run each configured command and report it here. Needs meta.checks; validated all-or-nothing.", items: { type: "object", properties: { name: { type: "string", description: "A meta.checks name (required)." }, command: { type: "string", description: "The command that ran (required)." }, exitCode: { type: "integer", description: "Its exit code (required)." }, summary: { type: "string", description: "e.g. '212 passing' or the last lines of output." }, commit: { type: "string", description: "Optional: the git commit it ran on." }, dirty: { type: "boolean", description: "Optional, with commit: uncommitted changes outside .specs/." } } } }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_complete_task",
    description: "Mark task N as done in a feature's tasks.md — ticks exactly that task's checkbox line, found by the same comment- and fence-aware scanner as status ('01' is task 1; a duplicated number resolves to its first OPEN task) — and return updated progress + the new next task. Pass `evidence` — the verification you actually ran: {command, exitCode, summary} (the task's _Verify:_ command, its exit code, an output summary). Every run is recorded in .state.json evidence[N] (the latest run plus a short history); a non-zero exitCode REFUSES the tick and stays recorded (a failed re-check of a ticked task makes it unverified; only a later passing run clears it). An exit code alone, or a command without its exit code, is rejected. EVIDENCE GATE: a task whose _Verify:_ names a runnable command counts as verified only with {command, exitCode: 0} — a summary-only note ticks it but leaves it unverified (a task without a runnable _Verify:_ may be attested by a note). The result carries `verified` — the same verdict doctor, spec_finish, spec_status and ROADMAP.md give; whenever it is false it also carries a stable `unverifiedReason` (no-evidence · failed-run · manual-note-on-runnable-verify · duplicate-number · stale-evidence — e.g. spec_impact reopened the task, or its _Verify:_ changed · unexpected-pass — see _Expect: fail_) plus a localized note; doctor, spec_finish and ROADMAP.md list such an unverified task with its localized reason. RED → GREEN: a task marked `_Expect: fail_` (it writes a test before its fix) is proven by a FAILING run — {command, exitCode ≠ 0} is recorded with `expected: \"fail\"`, ticks it and verifies it (`redRecorded: true`); a passing run (exit 0) is refused and recorded (`unexpectedPass: true` — the test doesn't fail yet, it tests nothing; a ticked task becomes unverified, reason unexpected-pass) unless a red run of the same _Verify:_ is already on record (the fix made it green: the red run stays the proof); exit 126 / 127 / 9009 (the command could not run) is refused like a failed run. Every result for such a task carries `expected: \"fail\"`. A RED-PHASE task (it writes a test that must fail) carrying a must-pass _Verify:_ and no _Expect: fail_ gets `redPhaseVerify: true` and a note / refusal saying to mark it _Expect: fail_ (or move the command to the fix task). A task with no runnable _Verify:_ and nothing recorded is verified with `nothingToVerify: true` (nothing was run or attested) — doctor, spec_finish and ROADMAP.md pass it too (never listed as unverified). Bugfix: a task after the root-cause task is refused (nothing recorded or ticked) until bug.md's Root Cause is filled; ticking the root-cause task itself while that section is still empty returns `rootCausePending: true` with a note. A passing run whose command pipes into another one (`npm test | tee log` — a pipeline's exit code is its LAST command's) is recorded and ticked as given, with `pipeMasked: true` and a note (drop the pipe or use `set -o pipefail`). Evidence can also be back-filled for a task ticked earlier.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, number: { type: "integer" }, evidence: { type: "object", properties: { command: { type: "string" }, exitCode: { type: "integer" }, summary: { type: "string", description: "e.g. '14/14 passing' or the last lines of output" }, commit: { type: "string", description: "Optional: the git commit the run was made on (`git rev-parse --short HEAD`) — `dev-spec done --run` records it." }, dirty: { type: "boolean", description: "Optional, with commit: the working tree had uncommitted changes outside .specs/." } }, description: "Verification actually run for this task." }, projectDir: { type: "string" } }, required: ["name", "number"] },
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
    description: "One health-check that decides whether a feature is ready to advance a phase. Per-check pass/warn/fail (stable ids): steering (core files missing, or files still holding template placeholders), requirements (requirements.md missing), ears, clarifications, success-criteria, priorities, ac-uniqueness, placeholders (template placeholders — fail in the current and earlier phases' artifacts, warn in later ones), design + mermaid + constitution-check, saas-sections / ai-sections / sec-sections / privacy-sections (the active tracks' mandatory design sections present AND filled — no leftover TODO sentinel), test-plan / eval-plan, traceability (every gap kind with its IDs; the kinds that read a LATER phase's still-template tasks.md / test-plan.md are deferred — a warn, 'not traced yet'; a phantom AC a recorded change request removed is named with that request), secondary-trace (EC/NFR/SC warnings), supersedes (_Supersedes:_ references that resolve to nothing), tests-in-code (+tdd: T-IDs made green by done tasks that no test file names), verification (ticked tasks without passing evidence, with the reason), red-green (warn, +tdd: T-IDs that done tasks make green (_Makes green:_) with no recorded red run of an `_Expect: fail_` task citing them — a test that never failed proves nothing), suite-evidence (warn, once every task is done and roadmap.json meta.checks is set: checks without a passing run since the last task activity — spec_finish blocks on them), duplicate-tasks, verify-pipes (warn: tasks whose _Verify:_ pipes into another command — a pipeline's exit code is its LAST command's, so a failing check can pass), integration-plan (brownfield template still unfilled), bugfix reproduction / root-cause (root-cause fails until written — no fix before the cause), changed-since-approval (names the spec_impact phases to diff), approval-gates (pending phases — every phase whose artifact exists, a bugfix's design on bug.md, and Phase 4 `tests` on a +tdd/+ai feature once its test/eval plan exists — forced approvals with their failing checks, and what the approve gate would refuse for the next pending phase). Returns checks, phase, approvals, pendingGates, forcedGates, nextGate {phase, ready, failing}, gatesOk, summary, readyToAdvance (no fail) and verdict.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_approve",
    description: "Record human approval of a phase gate for a feature (writes to .specs/<feature>/.state.json). Phases: classification, requirements, design, test-plan, eval-plan, tests, tasks, execution. The approval is a GATE: that phase's checks run first (requirements: EARS errors, template placeholders, open [NEEDS CLARIFICATION], success criteria + priorities, AC uniqueness — bugfix: bug.md Reproduction; design: placeholders, Constitution Check, active +saas/+ai/+sec/+privacy sections, clarifications — bugfix: bug.md Root Cause instead; test-plan: placeholders, every AC has a test, no row citing an AC requirements.md does not define; eval-plan: placeholders; tasks: no placeholder tasks, every AC covered, no phantom IDs; tests — the Phase 4 sign-off: +tdd every planned T-ID named by a test file (tests-in-code), +ai an evals/golden.json of the feature's own, not the scaffold's sample (eval-sets), nothing to approve on a core-only feature; execution — spec_finish's blockers: doctor, root-cause, placeholders, changed-since-approval, tasks, open-tasks, verification, approval-gates) and any failure REFUSES it, listing the failing check ids and details. Phase by phase: while an EARLIER active phase with an artifact is still unapproved (a bugfix's design before its tasks), the approval is refused too — check `phase-order`, naming the earlier phase(s) to approve first. `force: true` records it anyway as a forced approval (`forced` + the failing ids; doctor's approval-gates and the roadmap keep flagging it). A phase with no artifact (eval-plan without +ai, test-plan without +tdd, a missing file) can't be approved, not even with force. APPROVALS BY ROLE (opt-in, roadmap.json meta.approvalRoles — spec_init {approvalRoles}): a phase listed there needs `role` (one of its roles; each sign-off runs the gate and is recorded under the approval's `roles` and in approvalHistory with its role) and counts as approved only once EVERY role has signed off its CURRENT content — until then the result is ok with approved: null, signedOff, pending, missingRoles, and the phase stays pending (doctor, next_action, finish and ROADMAP.md name the missing roles); a sign-off of content changed since no longer counts. Without roles configured, a single approval as before. FAST-FORWARD: `through` (instead of `phase`, e.g. 'tasks') approves the active phases IN ORDER from the first unapproved one up to it, each through its own gate (snapshot + history record flagged batch: true) — it stops at the first refused gate (ok: false, refused, stoppedAt, failing, checks; the phases before it stay approved: `approved`) or, with roles, at a phase still waiting for another role (ok: true, complete: false); `role` signs each phase, `force` forces each gate (only when the user asked). Makes approval-gated progress auditable and resumable.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, phase: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"], description: "The phase to approve (or `through` for the fast-forward)." }, through: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks"], description: "Fast-forward: approve every active phase from the first unapproved one up to this one, in order, each through its gate (CLI: --through <phase>; /spec-ff)." }, role: { type: "string", description: "The role this sign-off is for, when roadmap.json meta.approvalRoles lists the phase (CLI: --role)." }, by: { type: "string", description: "Approver (default: $USER / $USERNAME, else 'user' — same as the CLI)." }, force: { type: "boolean", description: "Approve even though the phase's checks fail — recorded as forced, with the failing check ids (CLI: --force)." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "steering_scaffold",
    description: "Create a single steering file from its template (constitution.md, product.md, tech.md, structure.md, testing-standards.md, scale.md, observability.md, cost.md, ai-strategy.md, security.md, privacy.md) — or a CUSTOM scoped steering file for any other name matching ^[a-z0-9][a-z0-9-]{0,62}\\.md$ (not a Windows device name such as nul.md/com1.md, not a JavaScript built-in): a stub with Kiro-compatible front matter (`inclusion: always | fileMatch | manual`, `fileMatchPattern: \"src/api/**\"` — a glob with ** * ? {a,b}, or a list) plus short guidance. spec_task_brief includes `always` files, `fileMatch` files whose pattern matches one of the task's _Implements:_ paths (their body quoted, front matter stripped), and lists `manual` ones as available on request; spec_doctor warns about steering files still holding template placeholders. In `lang` (en/pt/es; defaults to the project language). Idempotent — never overwrites.",
    inputSchema: { type: "object", properties: { file: { type: "string", description: "A known template name, or a custom name like api-conventions.md." }, lang: { type: "string", enum: ["en", "pt", "es"] }, projectDir: { type: "string" } }, required: ["file"] },
  },
  {
    name: "spec_roadmap",
    description: "Show the multi-feature roadmap: each feature's tracks, phase, completion % (planning phases up to 30%, then driven by the fraction of tasks done), declared dependencies, blocked status (a dep is met when that feature is 100%), plus overall % and any circular dependency. With `write: true`, (re)generates the always-current overview: `.specs/ROADMAP.md` by default (Markdown, keeps the Mermaid dependency graph — git-friendly) — and also a self-contained brand-styled `.specs/ROADMAP.html` (light/dark toggle, offline) when `html: true`. Pass `lang` ('en'/'pt'/'es') to localize the roadmap chrome only (stored as meta.roadmapLang for auto-refresh; the project language is unchanged). `html: true` implies writing. A same-named file that dev-spec did not generate is never overwritten — the result is then an error naming it (`errors`), with `wrote` listing only what was written. Reads .specs/roadmap.json + the feature folders. FORECASTS: `velocity` = points completed per working day (Mon–Fri) over the last 28 days, from when spec_complete_task ticked each task (.state.json ticks; older ticks: their first passing evidence run) — a task's `_Size: XS|S|M|L|XL_` marker = 1/2/3/5/8 points, an unsized task counts as its feature's median (else M); each feature's `forecast` = its open points ÷ velocity (its own once it has 3 completions in the window, else the project's) → `eta` + `range` (±25%) in working days, starting after the ETA of any unfinished dependency — or `eta: null` with a `reason` (not-enough-data: fewer than 3 completed tasks in the window · no-tasks · dependency · cycle · done). OVERLAPS: `overlaps` = pairs of features that collide at merge time — two active features whose OPEN tasks plan the same files (_Implements:_; a folder covers the files under it) or an active feature planning files a finished feature recorded in its drift baseline — unless ordered by a dependency or declared with _Supersedes:_ (ROADMAP.md lists them under Needs attention; spec_doctor warns: cross-feature-overlap).",
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
      "\"You are here, do this next.\" ONE recommendation for a feature, phase by phase — `step`: re-review (an artifact changed after ITS approval, so a spec edited post-approval is re-reviewed, not silently shipped; `impact` = {tool: 'spec_impact', phases} when that approval has a snapshot to diff) → then the FIRST active phase not approved yet (classification, requirements, design, test-plan (+tdd), eval-plan (+ai), tests (Phase 4 on +tdd/+ai, once its plan exists), tasks): fill (its artifact still missing or a template; `file` names it) → fix (what that phase's approve gate would refuse: `refusedGate` {phase, failing}) → approve (its gate passes) — the next phase starts only after that approval, so the design is never asked for before the requirements are approved (a design-first feature — .state.json flow, spec_create {flow} — walks classification → design → requirements → …; the result then carries `flow: 'design-first'`) → fix (every phase approved, but a check of the current or an earlier phase still fails, e.g. after a forced approval) → implement (the next open task) → verify (every task ticked, but one is not verified — its latest recorded run failed, or its runnable _Verify:_ has only a note, stale or shared-number evidence: spec_finish and the execution sign-off refuse it; the recommendation names each task with its reason and how to record a passing run, e.g. `dev-spec done <f> <n> --run`) → finish (every task done and verified: run spec_finish); `tasks` when there are no tasks yet. Once spec_finish {write} has recorded the finish: `finished` (it asks for the execution sign-off while that approval is missing) or `drift` (implementing files changed since the finish — decide: spec wrong → spec_impact, code wrong → fix, harmless → re-finish), with `drift` {finishedAt, files, changed, missing, nowPresent, drifted}. A finished feature that changed since its finish (a change request or a re-approval after it, or an _Implements:_ file its baseline never recorded) and whose tasks are done again answers `finish` again — re-run spec_finish {write} for a fresh report, merge summary and baseline, then the execution sign-off — with `staleBaseline` {finishedAt, since: [{kind: 'change-request', n, at} | {kind: 'approval', phase, at}], newFiles} (and `drift`: its recorded files are still hashed — when one of them changed, the step is `drift`, the decision first, then finish again); an execution sign-off older than such a change (or than a later approval, e.g. an upgraded feature's tests sign-off) is asked to be re-confirmed, naming what came after it. Also returns phase, tracks, the doctor verdict, gatesOk, pendingGates, changedSinceApproval and the localized `recommendation`. Use to resume work or answer 'what now?'.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_add_track",
    description:
      "Escalate an EXISTING feature to a new track (+tdd, +saas, +ai, +sec or +privacy) - additive only, never overwrites. Scaffolds just the missing artifacts (test-plan.md/tests/, eval-plan.md/prompts/evals/, load-test.md), appends that track's mandatory design.md sections and template tasks, adds its steering files, updates classification.md's Active Tracks line and persists the track set in .state.json. `track` takes one or several ('saas,ai', '+saas +ai'); an unknown track is an error with a did-you-mean. With `remove: true` the track is turned OFF instead - non-destructive: no file is deleted, the result lists the now-inactive artifacts, and doctor/status/next_action stop requiring them ('core' can't be removed; a bugfix keeps +tdd). Use when a feature grew into needing tests, scale, AI, security or privacy work after it was created (or no longer does).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, track: { type: "string", description: "tdd | saas | ai | sec | privacy - or several: 'saas,ai' / '+sec +privacy'." }, remove: { type: "boolean", description: "Turn the track(s) off instead (files are kept, listed as inactive)." }, projectDir: { type: "string" } }, required: ["name", "track"] },
  },
  {
    name: "spec_feature",
    description:
      "Manage a feature's lifecycle: remove (delete its `.specs/<slug>/` folder), archive (move it to `.specs/_archive/<slug>/`, out of the active roadmap — its roadmap.json entry and the dependsOn references it prunes are recorded in its .state.json `archived`; the result names the features that depended on it in `dependentsPruned`, with `incompleteDependency: true` and a localized warning `note` when the archived feature was not complete — they now read as unblocked), restore (move `.specs/_archive/<slug>/` back to `.specs/<slug>/` and put back its roadmap.json entry and the dependsOn references archive pruned — only for features that still exist, the rest are listed in `skipped`; an error if an active feature has that slug or nothing is archived under that name), rename (slug + folder + roadmap.json key, with every reference updated: dependsOn lists, `_Supersedes: <old>/US-n.AC-m_` markers in other features' requirements.md — active and archived, never one in a comment or fenced code — and archived features' archive records, so restore brings their dependencies back; listed in `supersedesUpdated` / `archiveRecordsUpdated` and a localized `note`), or flow (1.14: set the feature's phase order — `flow` 'design-first' = classification → design → requirements → … | 'requirements-first' = the default; stored in .state.json `flow`; phases already approved stay approved (named in the note), the pending gates follow the new order at once — returned as {flow, previous, changed, order, pendingGates, note}; a bugfix is refused: it keeps its own order). All actions keep roadmap.json dependencies consistent and regenerate the roadmap (and .specs/SPECS.md when it exists). 'remove' is destructive and needs `confirm: true` - without it nothing is deleted and the result (an error with needsConfirm) lists what would be; prefer 'archive' (reversible with 'restore'). A folder is never moved or deleted while another process updates that feature (its .specs/<slug>/.lock) or roadmap.json (.specs/.roadmap.lock): the action waits, then answers `busy` with a localized error and nothing changed.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["remove", "archive", "rename", "restore", "flow"] }, name: { type: "string" }, newName: { type: "string", description: "New name (required for action 'rename')." }, flow: { type: "string", enum: ["requirements-first", "design-first"], description: "The phase order (required for action 'flow')." }, confirm: { type: "boolean", description: "Must be true for action 'remove' (deletion is permanent). Ignored by archive/rename/restore/flow." }, projectDir: { type: "string" } }, required: ["action", "name"] },
  },

  {
    name: "spec_import",
    description:
      "Import a spec written for another tool as a NEW dev-spec feature (never over an existing feature; the source files are only read, never modified). `tool`: 'kiro' (.kiro/specs/<name>/ — requirements.md '### Requirement N' + numbered WHEN/THEN/SHALL criteria, design.md, tasks.md with _Requirements: 1.1, 2.3_), 'spec-kit' (specs/<nnn-name>/ — spec.md user stories + Given/When/Then acceptance scenarios + FR-xxx/SC-xxx, plan.md → design.md, tasks.md 'T001 [P] [US1] …'), 'openspec' (openspec/specs/<capability>/spec.md '### Requirement:' + '#### Scenario:', or a change folder openspec/changes/<id>/), 'plan' (a Markdown plan: Claude Code plan mode — saved under plansDirectory, default ~/.claude/plans, OUTSIDE the project: copy the file in first or point plansDirectory inside it — or a Cursor plan .cursor/plans/*.plan.md with name/overview/todos front matter: goals and acceptance-like bullets → US-1's criteria, checklists / Cursor todos / a Steps section's items → tasks keeping their state, the file paths a step names → _Implements:_, the rest → design.md), 'execplan' (a Codex ExecPlan per PLANS.md: Validation and Acceptance → criteria, Progress (state kept) + Concrete Steps → tasks with _Verify:_ when a step names a test/lint/build/curl command, Decision Log → design.md '## Decisions' D-1…, Purpose → summary, the living sections → design.md) or 'bmad' (BMAD-METHOD: docs/prd.md or a sharded docs/prd/ (v6: _bmad-output/planning-artifacts/) FR/NFR lines → FR-n / NFR-n, epic stories + story files docs/stories/*.md → US-1…US-n in story order, their ACs → US-n.AC-m, Tasks / Subtasks → tasks tagged [USn] with '(AC: 1, 3)' → _Requirements:_, architecture.md + Dev Notes → design.md; a single story file imports that story). A folder holding several plans is refused — name the file. Requirement/story N criterion/scenario M → US-N.AC-M; each scenario becomes ONE EARS criterion (WHEN … THE SYSTEM SHALL …) where possible, else its text is kept with [NEEDS CLARIFICATION]; Kiro _Requirements:_ references are rewritten; tasks are renumbered 1…K keeping checkbox state and [P]/[USn] tags; SC-/FR- IDs stay. Every generated artifact carries an 'Imported from <tool> <path> on <date>' note (the file itself for a plan / ExecPlan / single story). `path` must resolve inside the project. Tracks: `tracks`, else auto-classified from the imported requirements. Returns {feature, files, mapping: {oldId: newId}, warnings}.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", enum: ["kiro", "spec-kit", "openspec", "plan", "execplan", "bmad"], description: "The format of the source spec." },
        path: { type: "string", description: "The spec's folder (or a file inside it; for a plan / ExecPlan the file itself when its folder holds several), relative to the project root or absolute — it must be inside the project." },
        name: { type: "string", description: "Feature name (default: the source folder's name, spec-kit's number prefix dropped; a plan / ExecPlan: its title, else its file name; BMAD: the PRD's title, else the folder — or the story's title for one story file). An existing feature with that slug is an error." },
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Active tracks ('core' always added). Omit to auto-classify from the imported requirements." },
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
      "Change request: what an edit made AFTER an approval touches. Compares the current artifact with the snapshot saved by its latest approval (.specs/<feature>/.history/<phase>@<n>.md — every spec_approve appends to .state.json approvalHistory and saves one). `phase` 'requirements' (default): AC-level diff via stable IDs — added / modified (whitespace-normalized text differs) / removed ACs, plus SC-/EC-/NFR- IDs — and, for each modified or removed ID, the tasks citing it in _Requirements:_ (done/open + evidence state), the T-IDs covering it in the test plan and the design sections mentioning it. 'design': section-level diff (## headings, by normalized body — of design.md; for a bugfix, of bug.md and design.md, which its design approval signs off, each section keyed by its file ('bug.md: Root Cause'), with `designMd` giving design.md's baseline) and the tasks citing an ID named in a changed section. 'test-plan': T-ID row diff (a row keyed by its first cell; re-padding a column is no change) — added / modified / removed planned tests and, for each modified or removed one, the tasks making it green (_Makes green:_). 'eval-plan': section-level diff of eval-plan.md, like 'design'. 'tasks': added / removed / changed task numbers. An approval made before the change history has only a fingerprint → `baseline: 'fingerprint-only'` with `changed` and a hint to re-approve (which starts the history); one with no fingerprint either (≤1.10, a 1.12 bugfix design approval) → `baseline: 'none'`, `changed: null` (unknown — a file date is no evidence) unless a file was added after it; a phase never approved is an error. `reopen: true` (requirements / design / test-plan / eval-plan): unticks the affected DONE tasks (never those of a REMOVED criterion or test — requirements returns them with their test rows in `retire` [{id, tasks, tests}] to delete or repoint, and a design section naming only removed criteria reopens nothing), marks their evidence stale (they count as unverified until a new run is recorded), records the change request in .state.json `changes` and refreshes the roadmap — it never edits requirements.md or design.md, and a second reopen with nothing new changes nothing.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        phase: { type: "string", enum: ["requirements", "design", "test-plan", "eval-plan", "tasks"], description: "Which approved artifact to compare (default requirements)." },
        reopen: { type: "boolean", description: "requirements / design / test-plan / eval-plan (not tasks): untick the affected done tasks, mark their evidence stale and record the change request." },
        projectDir: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "spec_metrics",
    description:
      "Metrics & retrospective, derived locally from .state.json, .history/ and the artifacts (no model, no cost). With `name`: that feature's createdAt (older features: the earliest approval, else the folder's date — flagged approximate), lead time in hours from creation to the first approval of each phase (classification → requirements → design → test-plan/eval-plan → tests → tasks; a phase never approved is null) and to complete (all tasks done) / finished (the earliest of the first execution approval and the finish spec_finish {write} recorded on a ready feature), rework (approvals of a phase beyond its first, from approvalHistory; approvals made before the change history are counted once and listed in `legacyPhases`, their rework unknown — `rework` is then a lower bound (`reworkLowerBound`), or null when nothing was approved under the history), forced approvals, change requests (spec_impact reopen) and reopened tasks, evidence pass rate (passing runs / all recorded runs, percent), tasks done/total and open [NEEDS CLARIFICATION] markers. Without `name`: every feature plus averages/medians and totals. `write: true` (with `name`) creates .specs/<feature>/retro.md — a localized retrospective pre-filled with the metrics (What went well / What hurt / Proposed steering or constitution amendments for human approval, never applied automatically / Follow-ups as candidate backlog items); an existing retro.md is never overwritten. `velocity` (the feature's, or the project's without `name`): points completed per working day over the last 28 days — the rate spec_roadmap's forecasts use (enough: 3 completed tasks in the window).",
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
  {
    name: "spec_upgrade",
    description:
      "After updating the plugin: audit the project's .specs/ against this engine's rules and, with `apply: true`, run the safe migrations. roadmap.json meta.specVersion records the dev-spec version that last upgraded or created the project (spec_init / spec_create stamp a brand-new project only; the SessionStart hook prints one line while it is absent or older than the engine). The audit (default, read-only) returns from / to / needsUpgrade and, per ACTIVE feature (archived ones are counted in `archived`): kind, tracks + tracksSource (state | inferred), phase, status (not-started · planning · executing · complete · finished — a finish baseline recorded), the doctor verdict with the failing check ids + short details and the warning ids, pendingGates, changedSinceApproval, legacyApprovals (phases approved without a fingerprint), history {present, seed, skip: [{phase, reason: no-fingerprint | changed | missing | untracked | snapshot-missing}]}, unverified tasks with their reason codes, next {step, recommendation} (spec_next_action's), drift (complete / finished features), a `review` recommendation — critic (no task ticked yet: run the spec-critic agent, read-only, over `reviewArtifacts`, phase by phase), converge (some tasks done, some open: the spec-reviewer converge pass + the critic on the changed / unapproved artifacts), none (complete) — and `group` blocked (doctor fails) · attention (pending gates, changed since approval, approvals to redo for the history, unverified tasks, drift, warnings) · ok; plus `summary` counts, `plan` (what apply would change) and localized `lines`. `apply: true` never edits an artifact, approves, ticks or deletes anything: it saves the inferred tracks to .state.json (only when none are saved), records the approvals made before the change history in approvalHistory and, for each approval without a snapshot whose recorded fingerprint still matches its artifact, saves that artifact as its history baseline (.specs/<feature>/.history/<phase>@<n>.md — spec_impact can then diff later edits; approvals changed since, or without a fingerprint, are listed as skipped: re-approve to start the history), completes the maintained .specs/.gitignore, stamps meta.specVersion (only once every feature migrated) and writes the checklist .specs/UPGRADE.md (AUTO-GENERATED, in the project language; a hand-written UPGRADE.md is never overwritten) — `migrations` says what it did. Each feature migrates under its lock, the stamp under the roadmap lock; a second apply changes nothing and says so.",
    inputSchema: { type: "object", properties: { apply: { type: "boolean", description: "Run the safe migrations, write .specs/UPGRADE.md and refresh the generated ROADMAP.md/.html (default: read-only audit). CLI: dev-spec upgrade --apply." }, projectDir: { type: "string" } } },
  },

  // @pkg A1 tools >>>
  // @pkg A1 <<<

  // @pkg A2 tools >>>
  // @pkg A2 <<<

  // @pkg A3 tools >>>
  // @pkg A3 <<<

  // @pkg A4 tools >>>
  // @pkg A4 <<<

  // @pkg B1 tools >>>
  {
    name: "spec_templates",
    description:
      "Project templates: a team's own scaffolds in .specs/templates/. `<artifact>.md` replaces the built-in template of classification, requirements, design, tasks, test-plan, eval-plan, load-test, quickstart, checklist, integration-plan, bug (bug.md), the bugfix variants bug-requirements / bug-test-plan / bug-tasks or the spike ones spike (spike.md — {{summary}} is the spike's question) / spike-tasks; `<lang>/<artifact>.md` (en | pt | es) replaces it for features in that language and wins over the shared one; `steering/<file>.md` (also under <lang>/) replaces a steering stub. spec_create, spec_add_track, spec_init, steering_scaffold and spec_import (through spec_create) use an override when present — create-only, never over an existing file — with {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}} substituted (an unknown {{x}} is left as is; no summary → a generic [TBD] slot). Track blocks: an overridden design.md still gets each active track's sections (+tdd Testability Notes, [SaaS] / [AI] / [SEC] / [PRIVACY]), requirements.md each marker track's criteria (renumbered after the template's own US-1 ACs when they would collide), tasks.md its task block and test-plan.md its test rows, appended at the end as spec_add_track does — unless the template already has that track's heading (for the test plan: already cites its criteria). The [bracketed] slots, code-span slots and task lines of the project's templates count as template placeholders, so an untouched custom scaffold still reads 'placeholder' for spec_doctor, spec_approve and spec_next_action. `action`: 'list' (default) — built-in vs project template per artifact for `lang` (default: the project language), plus files that are not a template name (ignored); 'init' — copy the built-in template(s) (`artifact`, or all of them) into .specs/templates/ for editing, variables in place — with `lang` into .specs/templates/<lang>/, else the shared folder in the project language; never overwrites; 'check' — validate the project's templates against the current rules: a design template with some of a track's marker headings but not all its mandatory sections (error), a track section without its > **TODO** line, EARS / AC-ID problems (a criterion with no modal verb or duplicate AC IDs are errors), AC IDs a tasks / test-plan template cites that the requirements template doesn't define and _Makes green:_ T-IDs the test plan doesn't plan (built-in ones included when only one side is the team's), bug.md without a Root Cause section or with one that already reads as written (errors), unknown {{variables}}, chain templates with no placeholder at all, empty files, names that are not templates — each problem with {file, line?, code, severity, message} and a verdict pass | warn | fail (`lang` limits it to the templates that apply to that language). Every path is built from the allowlisted names; nothing outside .specs/templates/ is read or written (a linked folder, or a file whose real path is outside the project, is ignored); a .specs/templates/ that is a feature created before 1.14 (it holds a .state.json) stays that feature — every action refuses with legacyFeature: true. Returns localized `lines`.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "init", "check"], description: "list (default) | init | check." },
        artifact: { type: "string", description: "One template: classification | requirements | design | tasks | test-plan | eval-plan | load-test | quickstart | checklist | integration-plan | bug | bug-requirements | bug-test-plan | bug-tasks | spike | spike-tasks | steering/<file>.md ('.md' optional). Omit for all." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "list: the feature language to resolve for (default: the project language). init: copy the templates in this language into .specs/templates/<lang>/. check: only the templates that apply to it. Messages follow it." },
        projectDir: { type: "string" },
      },
    },
  },
  // @pkg B1 <<<

  // @pkg B2 tools >>>
  {
    name: "spec_export",
    description:
      "Stakeholder export: ONE self-contained, offline, printable document for people who don't read markdown folders (product, legal, clients). With `name`: that feature, in its language — summary, user stories with their EARS acceptance criteria (stable IDs; a criterion a later feature superseded is struck through, a template one flagged), the other requirements sections (success criteria, edge cases, NFRs, out of scope …), the design sections (a bugfix: bug.md — reproduction, root cause, fix), the test plan, every task with its done / verified status (the verdict doctor gives, with the reason), decisions.md when present, the phase approvals (who / when, forced, changed since, still pending) and the open [NEEDS CLARIFICATION] markers. Without `name`: the whole project, in the project language — the roadmap summary (+ backlog), every active feature's requirements digest (summary, stories + ACs, success criteria — each feature on its own printed page) and the living catalog when .specs/SPECS.md exists. `format`: 'html' (default — the roadmap's brand palette, light/dark following the system with a toggle, print rules: light on paper, no buttons, a page break per feature; every spec text escaped, links kept for http(s)/mailto only, no image, font, script or stylesheet URL — it opens offline) or 'md'. Without `write` the document comes back as `content`; `write: true` writes .specs/exports/<feature>.<format> (the project: project.<format>; a feature slugged 'project': project.feature.<format>) carrying the AUTO-GENERATED marker, and returns `file` + `bytes` — a same-named file dev-spec did not generate is never overwritten (the result is then an error). Nothing is sent anywhere.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug. Omit for the whole project." },
        format: { type: "string", enum: ["html", "md"], description: "Document format (default html). CLI: --md." },
        write: { type: "boolean", description: "Write .specs/exports/<feature|project>.<format> instead of returning the content (never over a hand-written file). CLI: --write." },
        projectDir: { type: "string" },
      },
    },
  },
  {
    name: "spec_changelog",
    description:
      "Release notes generated from the spec data (no model, no git log). **Added**: features that shipped since `since` — spec_finish {write} recorded their baseline, or their execution sign-off was approved — each with its summary and every user-story acceptance criterion as one line (template criteria left out). **Changed**: acceptance criteria superseded (_Supersedes:_) by a feature shipped since then, each with the criterion that replaces it; and the change requests (spec_impact reopen — .state.json changes) recorded since then: the IDs / sections added, modified and removed, the tasks reopened and, for a requirements change, the current text of the criteria it added or modified — a feature new in these notes has its change requests folded into its entry. **Fixed**: bugfix features shipped since then, with the root-cause one-liner from bug.md. A feature that already shipped before `since` is never listed as Added again. `since`: an ISO date (YYYY-MM-DD = 00:00 UTC) or timestamp, 'last' (the default — roadmap.json meta.changelogAt, stamped by the last written notes; everything while it is unset) or 'all'. Chrome in the project language; IDs stay English. Returns added / changed {superseded, changeRequests} / fixed, counts, since + sinceSource (last · date · all) and the markdown. `write: true` writes .specs/RELEASE-NOTES.md (AUTO-GENERATED; a hand-written RELEASE-NOTES.md is never overwritten — the result is then an error) and stamps meta.changelogAt, both under the roadmap lock; when there is nothing to report, nothing is written or stamped (`note`).",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "string", description: "ISO date / timestamp, 'last' (default: since the last written release notes) or 'all'. CLI: --since." },
        write: { type: "boolean", description: "Write .specs/RELEASE-NOTES.md and stamp meta.changelogAt (nothing when there is nothing to report). CLI: --write." },
        projectDir: { type: "string" },
      },
    },
  },
  // @pkg B2 <<<

  // @pkg B3 tools >>>
  // @pkg B3 <<<

  // @pkg B4 tools >>>
  // @pkg B4 <<<

  // @pkg B5 tools >>>
  // @pkg B5 <<<

  // @pkg C1 tools >>>
  // @pkg C1 <<<

  // @pkg C2 tools >>>
  {
    name: "spec_decide",
    description:
      "Decision log: append ONE entry to .specs/<feature>/decisions.md (committed with the spec — created with a localized header when absent): `## D-<n> — <title>` numbered after the highest D-n, with the English-stable markers _Kind: decision | discovery_, _Date: <ISO timestamp>_, _Affects: <refs>_ and _Supersedes: D-n_ (when given), then the localized Context / Decision (Discovery) / Consequences paragraphs. Append-only, under the feature lock: an existing entry is never renumbered or rewritten, the file's bytes stay as they are (a BOM and CRLF line ends are kept; the new entry follows its line ends). `affects` is validated against the feature — an AC ID must be defined in requirements.md, a T-ID planned in test-plan.md, an EC/NFR/SC ID written in requirements.md, anything else must be a section heading of design.md (bug.md / design.md for a bugfix, spike.md for a spike): an unknown one is an error listing them (`unknownAffects`), nothing written; `supersedes` must name entries already in the log. Works on spikes too (a spike's decision logged as D-1). Where the log shows up: spec_task_brief inlines the current entries citing the task's ACs / T-IDs (bounded; `decisions` in the result), spec_finish's merge summary and spec_export get a Decisions section, spec_catalog lists each feature's decisions (count + titles, superseded marked), trace_check reports _Affects:_ references that name nothing any more (`phantomAffects`, warnings — never a gap) and spec_doctor warns `decision-affects` (the same phantoms) and `decision-affects-approved` (a current decision recorded AFTER the approval of requirements.md it names ACs of, or of the design it names sections of — re-review with spec_impact, update, re-approve). Returns {id, n, kind, title, affects (canonical), supersedes, at, file, created, message}.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug (a spike or a bugfix too)." },
        title: { type: "string", description: "One line — the decision in a few words (≤ 200 chars)." },
        decision: { type: "string", description: "What was decided (for a discovery: what was found). Markdown; multi-line allowed." },
        context: { type: "string", description: "Optional — why it had to be decided: the forces, the options weighed." },
        consequences: { type: "string", description: "Optional — what follows from it: what changes, what it rules out, the follow-up work." },
        affects: { type: "array", items: { type: "string" }, description: "Optional — what it touches: AC IDs (US-1.AC-2), T-IDs (T-03), EC/NFR/SC IDs, design section names ('Data Model'); a comma-separated item is split. CLI: --affects US-1.AC-2,T-03." },
        supersedes: { type: "array", items: { type: "string" }, description: "Optional — earlier entries this one replaces (D-1). CLI: --supersedes D-1." },
        kind: { type: "string", enum: ["decision", "discovery"], description: "decision (default) | discovery — a fact learnt while working (CLI: --discovery)." },
        projectDir: { type: "string" },
      },
      required: ["name", "title", "decision"],
    },
  },
  // @pkg C2 <<<

  // @pkg C3 tools >>>
  // @pkg C3 <<<

  // @pkg C4 tools >>>
  // @pkg C4 <<<
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
    case "spec_init": // guard → meta.guard; checks → meta.checks; approvalRoles → meta.approvalRoles; stopCheck → meta.stopCheck (undefined leaves each unchanged; = `init --guard / --check / --roles / --stop-check`)
      return spec.initProject(pdir, args.tracks, args.lang, { guard: args.guard, checks: args.checks, approvalRoles: args.approvalRoles, stopCheck: args.stopCheck });
    case "spec_classify":
      return spec.classify(args.description, { name: args.name, lang: args.lang });
    case "spec_create": {
      // No tracks → the engine keeps an existing feature's tracks, or classifies a new one (same as the CLI).
      const cls = spec.classify(args.summary || "", { name: args.name, lang: args.lang });
      return spec.createFeature(pdir, args.name, args.tracks, args.summary, cls, args.lang, args.kind, { brownfield: args.brownfield === true, flow: args.flow, question: args.question, timebox: args.timebox }); // flow (C3), question / timebox (C2 spike)
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
    case "spec_finish": // evidence (B5): the project checks' runs the agent reports — the server never runs them (`finish --run` does)
      return spec.finishFeature(pdir, args.name, { write: args.write, includeBody: args.includeBody, evidence: args.evidence });
    case "ears_validate":
      return !args.text && args.name ? spec.earsFeature(pdir, args.name) : spec.earsValidate(args.text, args.lang || spec.projectLang(pdir));
    case "trace_check":
      return spec.traceCheck(pdir, args.name, { code: args.code === true }); // same call as `dev-spec trace <f> --code`
    case "spec_doctor":
      return spec.specDoctor(pdir, args.name);
    case "spec_approve": // role: the sign-off's role (approvals by role); through: the fast-forward — the same engine call as `approve [--role] [--through]`
      return spec.approvePhase(pdir, args.name, args.phase, args.by, { force: args.force === true, role: args.role, ...(args.through != null ? { through: args.through } : {}) });
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
      return spec.manageFeature(pdir, args.action, args.name, args.newName, { confirm: args.confirm === true, flow: args.flow }); // flow (C3): action 'flow'

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
    case "spec_upgrade": // the same engine call as the CLI's `upgrade [--apply]` (apply only on an explicit true)
      return spec.specUpgrade(pdir, { apply: args.apply === true });
    // @pkg A1 dispatch >>>
    // @pkg A1 <<<

    // @pkg A2 dispatch >>>
    // @pkg A2 <<<

    // @pkg A3 dispatch >>>
    // @pkg A3 <<<

    // @pkg A4 dispatch >>>
    // @pkg A4 <<<

    // @pkg B1 dispatch >>>
    case "spec_templates": // the same engine call as the CLI's `templates [list|init|check] [artifact] [--lang]`
      return spec.templates(pdir, args.action, { artifact: args.artifact, lang: args.lang });
    // @pkg B1 <<<

    // @pkg B2 dispatch >>>
    case "spec_export": // the same engine call as the CLI's `export [feature] [--md] [--write]`
      return spec.exportSpecs(pdir, { name: args.name, format: args.format, write: args.write === true });
    case "spec_changelog": // the same engine call as the CLI's `changelog [--since …] [--write]`
      return spec.changelog(pdir, { since: args.since, write: args.write === true });
    // @pkg B2 <<<

    // @pkg B3 dispatch >>>
    // @pkg B3 <<<

    // @pkg B4 dispatch >>>
    // @pkg B4 <<<

    // @pkg B5 dispatch >>>
    // @pkg B5 <<<

    // @pkg C1 dispatch >>>
    // @pkg C1 <<<

    // @pkg C2 dispatch >>>
    case "spec_decide": // the same engine call as the CLI's `decide <f> --title … --decision … [--affects …] [--supersedes …] [--discovery]`
      return spec.decide(pdir, args.name, { title: args.title, decision: args.decision, context: args.context, consequences: args.consequences,
        affects: args.affects, supersedes: args.supersedes, kind: args.kind });
    // @pkg C2 <<<

    // @pkg C3 dispatch >>>
    // @pkg C3 <<<

    // @pkg C4 dispatch >>>
    // @pkg C4 <<<
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

function error(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } });
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
    // A boolean for an on/off string enum → "on" / "off" (spec_init {guard: true} — a boolean until 1.14 added "scope"; one plain
    // string enum stays portable: some MCP clients reject a schema whose `type` is a list).
    if (Array.isArray(s.enum) && s.enum.includes("on") && s.enum.includes("off") && hasOwn(args, k) && typeof args[k] === "boolean") {
      if (out === args) out = { ...args };
      out[k] = args[k] ? "on" : "off";
      continue;
    }
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

// --- MCP prompts + resources (lib/prompts-resources.js) ----------------------
// Prompts are the plugin's commands/*.md — slash commands in Cursor, VS Code/Copilot, Windsurf, Zed… The Claude Code
// plugin already ships those files as its own slash commands, so mcp/servers.json sets SPEC_MCP_PROMPTS=off there:
// without the prompts capability Claude Code doesn't list every command a second time (/mcp__…__spec-impact).
// Resources and prompts use the default project (SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / cwd — the tools' default):
// neither request carries a projectDir. Messages are in that project's language.
const PROMPTS_ON = !/^(off|0|false|no)$/i.test(String(process.env.SPEC_MCP_PROMPTS || "").trim());
function handleContent(id, method, params) {
  if (method.startsWith("prompts/") && !PROMPTS_ON) return error(id, -32601, "Method not found: " + method);
  const p = TYPE_CHECK.object(params) ? params : {};
  const pdir = spec.resolveProjectDir();
  const lang = spec.projectLang(pdir);
  switch (method) {
    case "prompts/list": // argumentHint is the CLI's; a prompt carries name / description / arguments
      return result(id, { prompts: content.listPrompts({ lang }).map((x) => ({ name: x.name, description: x.description, arguments: x.arguments })) });
    case "prompts/get": {
      const a = content.promptArgs(p.arguments, lang);
      const r = a.ok ? content.getPrompt(p.name, a.args, { lang }) : a;
      if (!r.ok) return error(id, -32602, r.error); // unknown prompt / bad arguments: Invalid params (MCP)
      return result(id, { description: r.description, messages: r.messages });
    }
    case "resources/list": {
      const r = content.listResources(pdir);
      const out = { resources: r.resources };
      if (r.truncated) out._meta = { truncated: true, total: r.total, cap: r.cap, note: r.note }; // capped — and says so
      return result(id, out);
    }
    case "resources/templates/list":
      return result(id, { resourceTemplates: content.resourceTemplates(pdir) });
    case "resources/read": {
      const r = content.readResource(pdir, p.uri);
      // An invalid / refused URI is Invalid params (-32602); a valid one naming nothing is Resource not found (-32002).
      if (!r.ok) return error(id, r.reason === "not-found" ? -32002 : -32602, r.error, { uri: typeof p.uri === "string" ? p.uri : null });
      return result(id, { contents: r.contents });
    }
    default:
      return error(id, -32601, "Method not found: " + method);
  }
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
          capabilities: PROMPTS_ON
            ? { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false, subscribe: false } }
            : { tools: { listChanged: false }, resources: { listChanged: false, subscribe: false } },
          instructions:
            "Local spec-driven engine. Use spec_classify to pick tracks, spec_init to scaffold steering, spec_create to scaffold a feature, then spec_status / spec_next_task / spec_complete_task to drive execution (spec_task_brief builds a self-contained brief per task for subagent execution). ears_validate, trace_check and spec_doctor enforce quality gates. After a plugin update, spec_upgrade audits an existing .specs/ (apply: the safe migrations). All file ops are local to the project's .specs/ directory." +
            (PROMPTS_ON ? " Prompts: one per plugin command (spec, spec-status, spec-impact, …) — the slash-command workflow for clients without the dev-spec-driven skill." : "") +
            " Resources (read-only): the project's spec artifacts — specs://roadmap, specs://catalog, specs://steering/{file}, specs://feature/{slug}/{artifact}.",
        });
      }
      case "ping":
        return result(id, {});
      case "tools/list":
        return result(id, { tools: TOOLS });
      case "prompts/list": case "prompts/get": case "resources/list": case "resources/templates/list": case "resources/read":
        return handleContent(id, method, params);
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

// stdout errors (C4). A client that closes its read end first (it quit, `… | head -1`) made the next reply write fail with
// EPIPE — an unhandled 'error' event: a stack trace on stderr and exit 1. Nobody is left to read a reply, so that is a quiet
// exit 0 (EOF: Windows' wording for the same closed pipe; ERR_STREAM_DESTROYED: a write after it). Any other stdout error
// is real: one line on stderr, exit 1.
function onStdoutError(e) {
  const code = e && e.code;
  if (code === "EPIPE" || code === "EOF" || code === "ERR_STREAM_DESTROYED") process.exit(0);
  try { process.stderr.write("dev-spec MCP server: stdout error: " + ((e && e.message) || String(e)) + "\n"); } catch { /* stderr gone too */ }
  process.exit(1);
}

function main() {
  process.stdout.on("error", onStdoutError);
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
  // stdin closed: exit once the replies already written have flushed. On Linux a pipe takes writes asynchronously once
  // its 64 KB buffer is full, and a bare process.exit() dropped the queued replies — a client that sends its requests and
  // closes stdin (`printf … | node mcp/server.js | jq`) lost the tail of a large answer.
  rl.on("close", () => process.stdout.write("", () => process.exit(0)));
}

main();

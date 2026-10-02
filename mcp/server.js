#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local MCP server (stdio, zero-dependency).
 *
 * Implements the Model Context Protocol over newline-delimited JSON-RPC 2.0
 * on stdin/stdout. No npm install, no network, no cost — pure Node core.
 *
 * Tools (all operate on the project's `.specs/` directory): see TOOLS below —
 * 38 tools, verify with an `initialize` + `tools/list` handshake; each carries `annotations` (TOOL_ANNOTATIONS).
 * Prompts: one per plugin command (commands/*.md) — slash commands in MCP clients without the skill
 * (SPEC_MCP_PROMPTS=off drops them). Resources: the project's spec artifacts, read-only, as specs:// URIs.
 * Completions (completion/complete): feature slugs and specs:// template variables. All live in lib/prompts-resources.js.
 */

const { StringDecoder } = require("string_decoder"); // stdin framing (main): "\n"-delimited, never readline
const fs = require("fs");
const path = require("path");
const spec = require("./lib/spec.js");
// The `lang` enum of every tool: en · pt (European Portuguese) · es · pt-BR (Brazilian Portuguese, 1.14 D1) — spec.LANGS.
const LANG_ENUM = spec.LANGS.slice();
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
      "Initialize spec-driven structure in the project: create `.specs/steering/` and the steering files required by the given tracks (constitution/product/tech/structure always; testing-standards for +tdd; scale/observability/cost for +saas; ai-strategy for +ai; security for +sec; privacy for +privacy; distributed for +dist; api for +api; ui for +ui; observability for +obs; data for +data). Steering content is generated in `lang` (en/pt/pt-BR/es — pt = European, pt-BR = Brazilian Portuguese), which also becomes the project's default language (persisted in .specs/roadmap.json meta.lang and inherited by every new feature). `guard` turns the opt-in guard mode on/off (roadmap.json meta.guard; with or without tracks): while on, the plugin's PreToolUse hook ASKS before Write/Edit on a code file outside .specs/ unless some feature has approved, unfinished tasks; `guard: \"scope\"` also asks, once tasks are approved, for a code file no open task names in _Implements:_. The result always reports the current `guard` state (true | false | \"scope\"). `stopCheck` turns the end-of-turn evidence gate on/off (roadmap.json meta.stopCheck, on by default — the plugin's Stop hook); the result always reports the current `stopCheck`. `approvalGuard` (off | ask | deny, roadmap.json meta.approvalGuard, default off) makes approvals a human act: the plugin's PreToolUse hook asks the user (ask) or refuses (deny — the human approves in their own terminal or with Claude Code's ! prefix) when an agent calls spec_approve, spec_feature remove, `dev-spec approve` / `feature remove --yes` through the shell, or lowers this guard; the result always reports the current `approvalGuard`. `checks` = the project's named check commands (roadmap.json meta.checks, e.g. {\"test\": \"npm test\", \"lint\": \"npm run lint\", \"typecheck\": \"npx tsc --noEmit\"}): the given names are added or replaced, an empty command removes one, the others are kept; every task brief lists them in its definition of done, and once set spec_finish needs a passing recorded run of each since the feature's last task activity (blocker suite-evidence). The result always reports the current `checks`. `evidence` (opt-in) = the evidence mode (roadmap.json meta.evidence): \"reported\" (default — the runs an agent reports verify as given; each record is still stamped `observed`) or \"observed\" — a task whose _Verify:_ is runnable is verified only by a passing run the harness saw (the plugin's PostToolUse Bash hook logs it in Claude Code) or that `dev-spec done --run` / `finish --run` made (unverifiedReason `unobserved`; a project check's run likewise, suiteChecks status `unobserved`) — an MCP-only client has no such hook; the result always reports the current `evidence`. `approvalRoles` (team governance, opt-in) maps phases to the roles that must sign them off — e.g. {\"requirements\": [\"product\"], \"design\": [\"tech\", \"security\"], \"tasks\": [\"tech\"]} — stored in roadmap.json meta.approvalRoles ({} clears it; the result then reports the current `approvalRoles` + a `rolesNote`): a listed phase counts as approved only once every role has signed off its current content (spec_approve {role}). Idempotent — never overwrites existing files.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack in .specs/tracks/<name>/ (spec_tracks) ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Tracks in use across the project. 'core' is always included." },
        lang: { type: "string", enum: LANG_ENUM, description: "Project language for generated steering + tool messages (default en). Becomes the project default." },
        guard: { type: "string", enum: ["on", "off", "scope"], description: "Guard mode (opt-in): \"on\" = code edits ask for confirmation while no feature has approved, unfinished tasks; \"scope\" = that, and once tasks are approved a code file no open task names in _Implements:_ (the file, a folder above it or a glob; test files excepted) asks too, naming the task to add it to; \"off\" = off. The booleans true / false are accepted as on / off. Omit to leave it unchanged (CLI: --guard on|off|scope)." },
        evidence: { type: "string", enum: ["reported", "observed"], description: "Evidence mode (roadmap.json meta.evidence): \"reported\" (default) — reported runs verify as given; \"observed\" — a runnable _Verify:_ (and a project check) is verified only by a run the harness observed (the plugin's Bash hook in Claude Code) or the CLI ran (done --run / finish --run). Omit to leave it unchanged (CLI: --evidence reported|observed)." },
        stopCheck: { type: "boolean", description: "The end-of-turn evidence gate (roadmap.json meta.stopCheck; on by default): the plugin's Stop hook sends a turn back when the agent's closing message claims the work is done or verified while a recently active feature has ticked tasks without verification evidence. false = off, true = on again. Omit to leave it unchanged (CLI: --stop-check on|off)." },
        approvalGuard: { type: "string", enum: ["off", "ask", "deny"], description: "The human approval guard (opt-in, roadmap.json meta.approvalGuard, default off): \"ask\" = an agent's approval (spec_approve, spec_feature remove, dev-spec approve / feature remove --yes through the shell, lowering this guard) asks the user first — a prompt some permission modes (auto / bypass) may skip; \"deny\" = it is refused in every mode, the human runs it in their own terminal or with Claude Code's ! prefix; \"off\" = off. In MCP clients without the plugin's hook this server enforces it: a client with elicitation asks its user (only an explicit approve records it), else deny is refused. Omit to leave it unchanged (CLI: --approval-guard off|ask|deny)." },
        checks: { type: "object", additionalProperties: { type: "string" }, description: "Project check commands {name: command} → roadmap.json meta.checks. Names: letters, digits, . _ : - (≤ 40); commands: one line (≤ 500 chars); an empty command removes that check; at most 20. Omit to leave them unchanged (CLI: --check name=\"cmd\", repeatable)." },
        approvalRoles: { type: "object", description: "Approvals by role (opt-in): {<phase>: [<role>, …]} — phases classification … execution, roles lower-cased (letters, digits, - _ .; a \"tech+security\" string is split). {} clears them; omit to leave them unchanged (CLI: --roles requirements=product,design=tech+security | none)." },
        projectDir: { type: "string", description: "Project root. Defaults to SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / cwd." },
      },
    },
  },
  {
    name: "spec_classify",
    description:
      "Heuristically classify a feature description into the track set (core +tdd? +saas? +ai? +sec? +privacy? +dist? +api? +ui? +obs? +data?, plus the project's own track packs — .specs/tracks/<name>/track.json signals, see spec_tracks) using local keyword signals (EN/PT/ES) — no LLM, no cost. Returns the recommended tracks, matched signals, and reasoning — plus (1.21) a suggested size: suggestedSize xs | s | m | l, sizeReason (stable: trivial-change · single-unit · several-tracks · public-api · cross-system · default) and sizeNote; confirm it with the human and pass it to spec_create {size} (nothing applies a size by itself). Use this to seed Phase 0; the human still approves — then pass the tracks they chose to spec_create: when they differ from this suggestion, the words that drove it are recorded, and after 2 consistent corrections the project's .specs/classifier.json overrides them here (`overrides` names the ones that changed a reading; spec_tracks {action: 'signals'} lists / sets / forgets them).",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Plain-language description of the feature/request." },
        name: { type: "string", description: "Optional feature name (also used as evidence)." },
        lang: { type: "string", enum: LANG_ENUM, description: "Language of the notes/reasoning. Default: the description's own language." },
        explain: { type: "boolean", description: "Also return `explain`: every keyword match (track, keyword, table tier → final tier, cue / project override, negation) and the project's signal overrides with their state." },
        projectDir: { type: "string", description: "The project whose track packs (.specs/tracks/) and signal overrides (.specs/classifier.json) are applied, and whose meta.lang is the fallback language. Default: the server's project." },
      },
      required: ["description"],
    },
  },
  {
    name: "spec_create",
    description:
      "Scaffold a feature's spec folder under `.specs/<slug>/` with the artifact skeleton for the chosen tracks: classification.md, requirements.md (EARS + stable AC IDs), design.md (with mandatory +saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data sections), tasks.md, plus test-plan.md/tests/ (+tdd), eval-plan.md/prompts/evals/ (+ai), load-test.md (+saas). Artifacts are generated in `lang` (en/pt/pt-BR/es — pt = European, pt-BR = Brazilian Portuguese) — defaults to the project language, persisted per feature in .state.json. Idempotent. A bugfix can be prefilled in the same call — reproduction · rootCause · condition · behaviour (`prefilled` / `prefillSkipped` say what landed) — and includeBody returns the created scaffolds' bodies, so no Read-back is needed.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name (human readable; slugified for the folder)." },
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack in .specs/tracks/<name>/ (spec_tracks) ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Active tracks ('core' always added). Omit to auto-classify from name + summary (same as the CLI) — confirm with the human in Phase 0." },
        summary: { type: "string", description: "Optional one-line feature summary." },
        size: { type: "string", enum: ["xs", "s", "m", "l"], description: "1.21 — the feature's size, the rigor it gets (spec_classify suggests one; confirm it in Phase 0): 'xs' = a CHANGE (kind 'change'): ONE change.md — summary, 1–3 EARS criteria, the approach, 1–3 tasks with _Verify:_ — two approvals (the plan: spec_approve {through: 'tasks'}, then the execution sign-off), core only (a track, or more than 3 criteria / tasks, is refused — size s); a bugfix of size xs drops the reproduce / root-cause tasks (their gates hold them). 's' = one story (two core criteria + every track criterion), no classification.md, the three weigh sections merged into 'Decisions, reuse & risks', only the core-tier track sections (the extended ones optional: absent or one 'n/a — <reason>' line), a track task per criterion, the plan filled whole then approved in one call (with +tdd / +ai the call ends at the test / eval plan — Phase 4's tests gate needs the written failing tests / eval sets, then tests, then tasks). 'm' / 'l' = the full chain with the duplicate sections of two active tracks merged (+saas / +obs; the core API Contracts / Error Handling under +api, Security Considerations under +sec, Testing Strategy under +tdd). Stored in .state.json; a new feature only. Omit = the pre-1.21 scaffold and rules exactly. Every size keeps EARS, trace, the evidence gate, the bugfix iron law, phase order and the finish gate." },
        kind: { type: "string", enum: ["feature", "bugfix", "spike", "change"], description: "'change' (1.21) = size xs: one change.md (see size). 'bugfix' scaffolds the systematic-debugging flow instead: bug.md (reproduction · root cause · fix), a one-story requirements.md (IF…THEN), a regression test plan and the fixed task order (reproduce → root cause → failing regression test → fix → verify). Always +tdd. 'spike' scaffolds a timeboxed investigation that ends in a decision: spike.md (Question · Timebox · Options considered · Evidence · Decision with _Outcome: go | no-go | pivot_ · Follow-up) and a small tasks.md of investigation steps — core-only, no requirements / design / tasks gates (spec_approve refuses them; spec_add_track refuses a spike); doctor fails `decision` until spike.md → Decision is written and warns `timebox` once its end date passed with no decision; spec_next_action goes question → investigate → decide → go: spec the real feature (seed {name, summary} from the question + decision) and archive the spike · no-go: archive it with its reason · pivot: a new spike; spec_finish is ready once the decision is written and every task ticked. Prototype code lives outside .specs/." },
        question: { type: "string", description: "kind 'spike' only: the question it answers → spike.md → Question (default: summary). Create-only." },
        timebox: { type: "string", description: "kind 'spike' only: its end — a date (YYYY-MM-DD) or a duration from today (3d, 2w, 8h) → spike.md → Timebox (**Until:** YYYY-MM-DD). Create-only." },
        reproduction: { type: "string", description: "kind 'bugfix' only (1.21): the exact steps / input / environment that reproduce the bug → bug.md → Reproduction, in place of its > **TODO** slot (≤ 20000 characters, several lines allowed). Create-only: an existing bug.md, or one from a project template, is left alone (`prefillSkipped`)." },
        rootCause: { type: "string", description: "kind 'bugfix' only (1.21): the root cause WITH its evidence → bug.md → Root Cause. Only once you know it — the iron law still holds: the root-cause gate counts the section as written only when it is real prose (no slot, no > **TODO**, not only [brackets]), and the human still approves bug.md before any fix. Create-only." },
        condition: { type: "string", description: "kind 'bugfix' only (1.21): the trigger of the regression criterion — requirements.md US-1.AC-1 becomes `IF <condition> THEN THE SYSTEM SHALL <behaviour>` (localized keywords; a leading IF / trailing THEN is dropped). One line, ≤ 500 characters." },
        behaviour: { type: "string", description: "kind 'bugfix' only (1.21): the correct behaviour → the THEN clause of US-1.AC-1 and bug.md → Expected (a leading THE SYSTEM SHALL is dropped). One line, ≤ 500 characters. A text left out stays a slot." },
        includeBody: { type: "boolean", description: "Return the body of every artifact this call created as `bodies` {file: text} — edit what's left without reading the files back (1.21)." },
        lang: { type: "string", enum: LANG_ENUM, description: "Language for the generated artifacts. Defaults to the project language (roadmap.json meta.lang), else en." },
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
    description: "Detailed status for one feature: its kind (feature / bugfix / spike) and flow (requirements-first / design-first), active tracks, phase, artifacts present, task progress and next task, plus +saas scale-section completeness, +ai eval/prompt state and the +sec / +privacy / +dist / +api / +ui / +obs / +data section completeness (secSections / privacySections / distSections / apiSections / uiSections / obsSections / dataSections).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_next_task",
    description: "Return the next task for a feature (its number and text) — the first open task, in task-number order, whose `_Depends: 3, 5_` tasks are all done (a task without _Depends:_ has none, so a tasks.md without them gets its first open task) — plus remaining/total counts. When dependencies are in play: `skipped` [{number, waitsOn}] = open tasks passed over because they wait, `blocked` [{number, waitsOn}] = open tasks that can never start as things stand (a cycle, a _Depends:_ naming no task, or waiting on such a task); no task able to start → next null + a localized note (fix the _Depends:_ markers; spec_doctor fails `task-deps`). With `batch: true`, also return the tasks that can run in parallel with it: the following open [P] tasks of the same section whose _Implements:_ files are declared and disjoint and whose _Depends:_ are done (for parallel subagents in separate worktrees; max 3 by default). With `waves: true`, also return the execution waves of every open task: `waves` [[numbers…]…] (a wave's tasks can run at once — their dependencies are done or in earlier waves, no two share an _Implements:_ file, a task without _Implements:_ or an +ai prompt task runs alone; a task without _Depends:_ keeps tasks.md order behind the tasks before it, a run of [P] tasks of one section together), `cycles` [[numbers…]] and `blocked`.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, batch: { type: "boolean", description: "Also return the parallel batch." }, max: { type: "integer", minimum: 1, description: "Batch size cap (default 3, max 8)." }, waves: { type: "boolean", description: "Also return the execution waves of the open tasks (+ cycles, blocked)." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_task_brief",
    description:
      "Build a self-contained brief for ONE task (default: the next task by spec_next_task's rule — open, active, its _Depends:_ all done; none able to start → task null, `blocked` and a note; an explicit number resolves like spec_complete_task — the first OPEN task of a duplicated number) so a fresh implementer can execute it without reading the whole spec: task text + story/phase/[P]/closing checkpoint, the full EARS text of every AC it cites, the test-plan row of every T-ID it names, evals/metrics/files markers, its `_Verify:_` command (the evidence the report must carry; `verifyPipes` lists the ones that pipe into another command — a pipeline's exit code is its LAST command's, so a failing check could read as passing — and the brief says so), the tasks.md Global Constraints, the design sections that mention the task, unresolved (phantom) references, and the definition of done for the task's loop (core / tdd / ai-prompt — +ai prompt tasks are flagged inlineOnly), its _Depends:_ with the status of each (`dependsOn` [{number, status: done | open | missing}] — kept with write:true), plus, for a task marked `_Expect: fail_`, that its run must FAIL (`expect: \"fail\"`), and the project checks to run (roadmap.json meta.checks, `projectChecks` [{name, command}]). STEERING is selected per task: the default files (constitution/tech/structure + the active tracks' files) plus front-matter scoped files — `inclusion: always` listed, `fileMatch` included when its fileMatchPattern matches one of the task's _Implements:_ paths (real body quoted, front matter stripped, bounded), `manual` listed as available on request; the result's `steering` = {included: [{file, inclusion, patterns?, matched?, quoted?}], manual}. BUGFIX: the brief carries bug.md's Reproduction and Root Cause (`bug`; null while unwritten), and a task after the root-cause task while Root Cause is still unfilled comes back with `gated` + `gateError` (spec_complete_task would refuse it). Generated in the feature's language. With `write: true` it writes `.specs/<feature>/.execution/task-<N>-brief.md` (self-gitignored workspace, plus an append-only ledger.md) and returns the paths instead of the content — the basis of subagent-driven execution: the result then keeps only the task (number/text/story/phase), loop, inlineOnly, verify (+ verifyPipes, expect), projectChecks, implements/metrics/evals markers, `refs` {acs, tests} (the IDs it cites), unresolved, the bugfix gate and `paths`; the spec text (acceptanceCriteria, tests, designSections, steering, bug, glossary) is left out unless includeBrief. GLOSSARY (1.16): when .specs/steering/glossary.md exists, the brief quotes the entries (term, definition, the words to avoid) whose term or avoided word the task's text or its acceptance criteria use — at most 8 / 1500 characters (`glossary`, `glossaryOmitted`; with write:true only `refs.glossary`, the terms). REUSE (1.19 — search before you write): a Reuse section quotes the design's Reuse & Integration entries that name the task's _Implements:_ file, a sibling in its folder, the folder or one of its ACs (≤ 8 / 1500 characters) and lists the existing source files next to its _Implements:_ targets (names only, ≤ 15 + `more`) — `reuse` {state, total, entries, omitted, files, more}; with write:true only `refs.reuse` {entries (a count), files}.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        number: { type: "integer", minimum: 0, description: "Task number (≥ 0). Omit for the next open task." },
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
      "Close a feature (finishing-a-development-branch): a readiness report plus a merge title + summary GENERATED FROM THE SPEC CHAIN. `blockers` (readyToFinish is true only with none): doctor fail checks, an artifact changed since its approval (changedSinceApproval), template placeholders anywhere in the chain (placeholders), for a bugfix an unwritten bug.md Root Cause, no tasks, open tasks (openTasks), ticked tasks without passing verification evidence under the evidence gate (unverified), with project checks set (roadmap.json meta.checks — spec_init {checks}) a check without a passing recorded run since the feature's last task activity (suite-evidence; `suiteChecks` [{name, command, status: pass · no-run · failed · changed · before-last-tick · code-changed · unobserved (meta.evidence \"observed\" only), exitCode?, at?, observed?}]), phases awaiting approval (pendingGates). `evidence` [{name, command, exitCode, summary}] records the project checks as YOU ran them (each `name` a meta.checks name; run the configured command from the project root — a run of another command reads `changed`) in .state.json finishChecks — BEFORE the readiness is computed, so one call can make the feature ready; a failed run is recorded too (it stays a blocker); returned as `recordedChecks` [{name, exitCode, observed}] — observed: true when the plugin's Bash hook saw that command exit with that code (Claude Code), false otherwise, \"cli\" for finish --run (CLI: `" + spec.DEV_SPEC + " finish <f> --run` runs them). `warnings` (localized lines, never blockers): uncovered / phantom EC-, NFR- and SC- IDs and planned T-IDs that no test file names. `checks`: the track-gated items only a fresh run or a human can confirm (full suite green; +saas load test + observability; +ai cost + safety; +sec security scans + threat model re-check; +privacy data subject rights + retention; +dist failure-injection tests + no bypassed outbox; +api contract tests + breaking-change diff; +ui accessibility checks + keyboard / screen-reader pass + UI states; +obs an alert firing in a staged failure + a rollback drill; +data the data-quality checks + a partition re-run / backfill rehearsal; bugfix: no longer reproduces). The summary (summary, root cause/fix for bugfixes, ACs, tasks with their evidence, tests, checks, spec files) is the merge commit message. With `write: true` it is written to .specs/<feature>/.execution/merge-summary.md (content omitted unless includeBody), and a READY feature also records its drift baseline — .state.json `finished` {at, files: sha1 of every _Implements:_ file}, returned as `baseline` (with `replaced` {at, changed, missing, nowPresent} when it replaces a drifted baseline) — which spec_drift compares against later. Integration is LOCAL: the human picks merge locally or keep the branch — no pull requests, no CI. It never merges, pushes or approves by itself. A green run is EVIDENCE, not the sign-off: after it, ask the user for an explicit yes on the `execution` phase before calling spec_approve — never promise to approve it once they paste a passing run.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, write: { type: "boolean", description: "Write the merge summary to .specs/<feature>/.execution/merge-summary.md." }, includeBody: { type: "boolean", description: "Include the merge summary in the result (default: true when not writing, false when writing)." }, evidence: { type: "array", description: "The project checks' runs (roadmap.json meta.checks) — the server never runs them: run each configured command and report it here. Needs meta.checks; validated all-or-nothing.", items: { type: "object", properties: { name: { type: "string", description: "A meta.checks name (required)." }, command: { type: "string", description: "The command that ran (required)." }, exitCode: { type: "integer", description: "Its exit code (required)." }, summary: { type: "string", description: "e.g. '212 passing' or the last lines of output." }, commit: { type: "string", description: "Optional: the git commit it ran on." }, dirty: { type: "boolean", description: "Optional, with commit: uncommitted changes outside .specs/." } } } }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_complete_task",
    description: "Mark task N as done in a feature's tasks.md. EVIDENCE BEFORE CLAIMS — BEFORE calling this: if the task has a runnable _Verify:_ command and you have NOT run it yourself (no shell in this session, no environment), do NOT call this tool at all — not bare, not with a summary-only note, never with an exit code you did not see: name the _Verify:_ command and ask the user for its output (or to run `" + spec.DEV_SPEC + " done <feature> <n> --run` — hand them that exact line: a plugin install puts no `dev-spec` on PATH), then record what they report — never send a subagent to look for a shell; tick with a note only when the user explicitly asks for an UNVERIFIED tick. \"I finished it, mark it done\" is a claim, not a run. It ticks exactly that task's checkbox line, found by the same comment- and fence-aware scanner as status ('01' is task 1; a duplicated number resolves to its first OPEN task) — and return updated progress + the new next task. Pass `evidence` — the verification you actually ran: {command, exitCode, summary} (the task's _Verify:_ command, its exit code, an output summary). Every run is recorded in .state.json evidence[N] (the latest run plus a short history); a non-zero exitCode REFUSES the tick and stays recorded (a failed re-check of a ticked task makes it unverified; only a later passing run clears it). An exit code alone, or a command without its exit code, is rejected. OBSERVED: every run is stamped `observed` in its record and in the result — true when the plugin's Bash hook (Claude Code) logged that same command exiting with that same code in the last 24 h (its latest run), false otherwise (\"cli\" for dev-spec done --run) — so run the _Verify:_ command yourself with your shell tool before reporting it. EVIDENCE GATE: a task whose _Verify:_ names a runnable command counts as verified only with {command, exitCode: 0} where `command` IS its _Verify:_ command — with several _Verify:_ commands, EVERY one of them in ONE run joined with ` && ` (any order) — as written: `\\` for `/`, quotes around a plain argument, a trailing 2>&1 or a leading `cd <dir> &&` / `set -o pipefail;` / VAR=value of your own are fine, but a prefix the _Verify:_ itself holds (`cd packages/api &&`, `NODE_ENV=production`) must stay; any other command — one of two _Verify:_ commands alone included — ticks it unverified — command-mismatch) — a summary-only note ticks it but leaves it unverified (a task without a runnable _Verify:_ may be attested by a note). The result carries `verified` — the same verdict doctor, spec_finish, spec_status and ROADMAP.md give; whenever it is false it also carries a stable `unverifiedReason` (no-evidence · failed-run · manual-note-on-runnable-verify · duplicate-number · stale-evidence — e.g. spec_impact reopened the task, or its _Verify:_ changed · unexpected-pass — see _Expect: fail_ · unobserved — roadmap.json meta.evidence is \"observed\" and the harness never saw the run · command-mismatch — the run recorded is not a run of its _Verify:_ command) plus a localized note; doctor, spec_finish and ROADMAP.md list such an unverified task with its localized reason. RED → GREEN: a task marked `_Expect: fail_` (it writes a test before its fix) is proven by a FAILING run — {command, exitCode ≠ 0} is recorded with `expected: \"fail\"`, ticks it and verifies it (`redRecorded: true`); a passing run (exit 0) is refused and recorded (`unexpectedPass: true` — the test doesn't fail yet, it tests nothing; a ticked task becomes unverified, reason unexpected-pass) unless a red run of the same _Verify:_ is already on record (the fix made it green: the red run stays the proof) — a passing run of the _Verify:_ itself also accepts a red run of another form already on record (a red run recorded as another command ticks the task, command-mismatch: record the red run of the _Verify:_ BEFORE the fix lands; once the fix is in, the passing run of the _Verify:_ makes the red run on record count); exit 126 / 127 / 9009 (the command could not run), or a failing run whose `summary` shows the test never ran (a missing test file, module or script, no test collected — `couldNotRun: \"output\"`; a missing file or import is not the right reason), is refused like a failed run. Every result for such a task carries `expected: \"fail\"`. A RED-PHASE task (it writes a test that must fail) carrying a must-pass _Verify:_ and no _Expect: fail_ gets `redPhaseVerify: true` and a note / refusal saying to mark it _Expect: fail_ (or move the command to the fix task). A task with no runnable _Verify:_ and nothing recorded is verified with `nothingToVerify: true` (nothing was run or attested) — doctor, spec_finish and ROADMAP.md pass it too (never listed as unverified). Bugfix: a task after the root-cause task is refused (nothing recorded or ticked) until bug.md's Root Cause is filled; ticking the root-cause task itself while that section is still empty returns `rootCausePending: true` with a note. A passing run whose command pipes into another one (`npm test | tee log` — a pipeline's exit code is its LAST command's) is recorded and ticked as given, with `pipeMasked: true` and a note (drop the pipe or use `set -o pipefail`). Evidence can also be back-filled for a task ticked earlier. A task whose `_Depends:_` tasks are not all done is ticked anyway (a tick records what happened — the bugfix gate stays the only refusal), with `waitsOn` [numbers] and a note; the result's `next` follows spec_next_task's rule (`blocked` when no open task can start). UNDO A TICK: `undo: true` (+ an optional one-line `reason`, no evidence) unticks task N when it was ticked by mistake or its work turned out incomplete — use it instead of editing tasks.md by hand: the checkbox goes back to [ ] (the ticked task of that number — several ticked tasks sharing it are refused with `duplicateTicked` + `tasks`: renumber them first), its evidence record is marked stale (a re-tick needs a NEW run, like spec_impact reopen — stale-evidence, labelled as unticked; an _Expect: fail_ task keeps its red run as the proof — `redKept: true` — so once the fix is in a passing run re-ticks it), ticks[N] is dropped and .state.json unticks gets {n, at, reason}; an already-open task answers ok with alreadyOpen and a note. A finished or signed-off feature reads reopened (spec_drift) and must be finished and signed off again once the task is done (next_action says so). `reason` without undo is refused. CLI: dev-spec undone <feature> <n> [--reason \"…\"].",
    inputSchema: { type: "object", properties: { name: { type: "string" }, number: { type: "integer", minimum: 0 }, evidence: { type: "object", properties: { command: { type: "string" }, exitCode: { type: "integer" }, summary: { type: "string", description: "e.g. '14/14 passing' or the last lines of output" }, commit: { type: "string", description: "Optional: the git commit the run was made on (`git rev-parse --short HEAD`) — `dev-spec done --run` records it." }, dirty: { type: "boolean", description: "Optional, with commit: the working tree had uncommitted changes outside .specs/." } }, description: "Verification actually run for this task." }, undo: { type: "boolean", description: "Untick task N instead (no evidence): its evidence turns stale, a re-tick needs a new run (CLI: dev-spec undone <feature> <n>)." }, reason: { type: "string", description: "With undo: why the tick is undone (one line, ≤ 500 characters) — recorded in .state.json unticks (CLI: --reason)." }, projectDir: { type: "string" } }, required: ["name", "number"] },
  },
  {
    name: "ears_validate",
    description: "Lint EARS acceptance criteria, one logical criterion at a time (wrapped lines and list continuations are joined; HTML comments and fenced code are skipped): flags criteria missing a modal verb (SHALL / DEVE / DEBE), missing a stable ID (US-1.AC-1; EC-1, NFR-1 and SC-001 count too — a bare AC-1 does not: trace_check reads US-n.AC-m only), vague words (fast, user-friendly, appropriate, … in EN/PT/ES), template placeholders still in a criterion ([trigger], [behavior] …), a missing EARS keyword, and every open [NEEDS CLARIFICATION]. Pass `text` directly, or `name` to lint that feature's requirements.md. Each issue has a stable `code` (no-modal · no-id · vague · placeholder · no-keyword · needs-clarification), a severity (only no-modal is an error, which makes the verdict fail), the criterion's `line` (+ `endLine` when it spans several) and a `msg` in the feature's language (or `lang` for raw text).",
    inputSchema: { type: "object", properties: { text: { type: "string" }, name: { type: "string" }, lang: { type: "string", enum: LANG_ENUM }, projectDir: { type: "string" } } },
  },
  {
    name: "trace_check",
    description: "Verify traceability for a feature, both directions. GAPS decide `verdict`: criteria with no US-n.AC-m ID at all (unidentifiedCriteria — their bare AC-n IDs or L<line>; 0 ACs is never a pass while EARS reads criteria), ACs in requirements.md that no task cites (uncoveredByTasks), phantom AC IDs in tasks (typos), on +tdd ACs without a test-plan row (uncoveredByTests), test-plan rows citing ACs requirements.md doesn't define (phantomAcsInTests) and phantom T-IDs in tasks, and `_Implements:_` files that don't exist (missingImplFiles) — a file named only by OPEN tasks is the plan (plannedImplFiles), not a gap; planned T-IDs no task names are listed as testsNotMappedToTasks without failing the verdict. `_Supersedes: <feature>/US-n.AC-m_` markers are reported as `supersedes`, and the ones that resolve to nothing as `phantomSupersedes` (informational); `removedAcs` [{id, changeRequest}] (informational) names the phantom AC IDs a recorded change request (spec_impact reopen) removed from requirements.md — delete or update what still cites them. WARNINGS (never the verdict) trace the secondary IDs of requirements.md: edge cases EC-n and NFR-n need a task or a test-plan row, success criteria SC-nnn a test-plan row or quickstart.md (uncoveredEdgeCases / uncoveredNfr / uncoveredSuccessCriteria / phantomSecondary; untouched template rows don't count) — all listed in `warnings` as [{kind, items}]. With `code: true` it also scans the project's test files (bounded, read-only; each feature's own .specs/<feature>/tests/ included) for T-IDs and AC IDs — a planned T-ID whose plan row names a concrete test path in its File column counts only in that file/folder, and another feature's .specs tests never count; a planned T-ID whose every plan row names only a non-code artifact in its File column (`load-test.md`, `evals/golden.json` …) is run outside test code — listed in plannedOutsideCode, never expected in a test file: `code` = {planned, testsInCode, plannedNotInCode, plannedOutsideCode, inCodeNotInPlan (in no feature's plan), acsInTests, scanned, truncated} — plannedNotInCode / inCodeNotInPlan are warnings too. With `matrix: true` (informational, never the verdict) it adds `matrix` — the requirements traceability matrix for audits: one row per requirement ID (the US-n.AC-m criteria, then EC-n / NFR-n / SC-nnn) with {id, kind: ac|ec|nfr|sc, text (one line), template, status, gaps, design (the design sections naming it), tasks (the tasks citing it or one of its planned T-IDs: number, done, verified + the stable evidence reason, cites, the latest evidence {command, exitCode, at, commit}), tests (planned T-IDs; with `code: true` the test files naming each), decisions (current decisions.md entries whose _Affects:_ name it), supersedes, supersededBy (+ supersedePending: declared only by features not shipped yet), approval {at, by, forced, changed — this row's text vs the approved snapshot; null = unknown}}, plus the requirements `approval`, `counts` and `lang`. Status codes (stable): untraced (a trace gap names it — gaps: no-task, no-test (+tdd), no-coverage (EC / NFR: no task or planned test; SC: no test-plan row or quickstart line)) · planned (traced, a linked task still open or none yet) · implemented (every linked task done, one not verified) · verified (every linked task done and verified). CLI: `dev-spec trace <f> --matrix` (a table), `--csv` (RFC 4180, formula-safe); spec_export {format: 'csv'} writes it as a file.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, code: { type: "boolean", description: "Also scan test files (test/spec/__tests__ folders, .specs/<feature>/tests/, *.test.*, test_*.py, *_test.go, *Test.java, *Tests.cs, *Tests.fs, *Spec.scala …) for the T-IDs they name — put the T-ID in the test name: test(\"T-01 …\"), def test_T01_…, func TestT01…, [Fact(DisplayName=\"T-01 …\")] (CLI: --code)." }, matrix: { type: "boolean", description: "Also return `matrix`, the requirements traceability matrix (one row per AC / EC / NFR / SC: status, tasks + evidence, tests, design, decisions, approval) — CLI: --matrix (table) or --csv." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_doctor",
    description: "One health-check that decides whether a feature is ready to advance a phase. Per-check pass/warn/fail (stable ids): steering (core files missing, or files still holding template placeholders), requirements (requirements.md missing), ears, clarifications, success-criteria, priorities, ac-uniqueness, placeholders (template placeholders — fail in the current and earlier phases' artifacts, warn in later ones), design + mermaid + constitution-check, saas-sections / ai-sections / sec-sections / privacy-sections / dist-sections (the active tracks' mandatory design sections present AND filled — no leftover TODO sentinel, and (1.21) more than the template's own guidance line: a section left with only that fails, a warn on a design approved before; on a sized feature an extended section may be left out at size s or answered by one 'n/a — <reason of 4+ words>' line, and a section another active track covers counts as covered), change-scope (1.21, a change: 1–3 criteria, 1–3 tasks, core only), test-plan / eval-plan, traceability (every gap kind with its IDs; the kinds that read a LATER phase's still-template tasks.md / test-plan.md are deferred — a warn, 'not traced yet'; a phantom AC a recorded change request removed is named with that request), secondary-trace (EC/NFR/SC warnings), supersedes (_Supersedes:_ references that resolve to nothing), tests-in-code (+tdd: T-IDs made green by done tasks that no test file names), verification (ticked tasks without passing evidence, with the reason), red-green (warn, +tdd: T-IDs that done tasks make green (_Makes green:_) with no recorded red run of an `_Expect: fail_` task citing them — a test that never failed proves nothing), suite-evidence (warn, once every task is done and roadmap.json meta.checks is set: checks without a passing run since the last task activity — spec_finish blocks on them), duplicate-tasks, unread-tasks (warn: checkbox lines the task scanner does not read as tasks — an ordered-list checkbox `1. [ ] text`, an unnumbered `- [ ] text` outside every task; a task line is `- [ ] N. text` with a -, * or + bullet), task-deps (fail, only when a task declares _Depends:_: a dependency that is not a task number or names no active task, a task depending on itself, a dependency cycle — the tasks approval refuses on it), verify-pipes (warn: tasks whose _Verify:_ pipes into another command — a pipeline's exit code is its LAST command's, so a failing check can pass), integration-plan (brownfield template still unfilled), bugfix reproduction / root-cause (root-cause fails until written — no fix before the cause), changed-since-approval (names the spec_impact phases to diff), approval-gates (pending phases — every phase whose artifact exists, a bugfix's design on bug.md, and Phase 4 `tests` on a +tdd/+ai feature once its test/eval plan exists — forced approvals with their failing checks, and what the approve gate would refuse for the next pending phase); 1.16: glossary (words .specs/steering/glossary.md says to avoid — `_Avoid:_` — used in requirements.md / design.md: warn with the count, pass when none; no glossary or no avoided word listed → no check), cross-feature-acs (warn: this feature's acceptance criteria that read like another ACTIVE feature's — near-duplicate, ≥ 80% word similarity, same polarity and numbers — or may contradict them — ≥ 70% alike with the same trigger: SHALL vs SHALL NOT, or different numbers; template criteria, criteria retired by a shipped feature's _Supersedes:_ and a pair where one declares _Supersedes:_ of the other never count; bugfixes and spikes are not compared), steering-changed-since-approval (warn: a steering file that governed the requirements / design approval — constitution.md, the active tracks' steering files, `inclusion: always` files, fileMatch files matching the feature's _Implements:_ paths, fingerprinted at approval — changed or was removed since; re-approving records the current steering; approvals made before 1.16 are never flagged; `steeringChanged` [{phase, approvedAt, files: [{file, change: modified | removed}]}] in the result); 1.17: design-tradeoffs / design-risks (warn only — never a fail, never an approval check — once design.md is being written: the core Alternatives & Trade-offs section missing, empty, still holding template placeholders, or listing fewer than 2 options (table rows / bullets / sub-headings); the Risks section missing, empty or still the template; a bugfix is exempt); 1.19: design-reuse (the same rules: the core Reuse & Integration section — the existing modules / components / helpers reused or extended, with paths; what is new and why; where it lives — missing, empty or still the template; a brownfield feature's filled integration-plan.md → Integration Points counts; a design approved before a check existed — 1.17 for trade-offs / risks, 1.19 for reuse — is never flagged by it). Returns checks, phase, approvals, pendingGates, forcedGates, nextGate {phase, ready, failing}, gatesOk, summary, readyToAdvance (no fail) and verdict.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_approve",
    description: "Record human approval of a phase gate for a feature (writes to .specs/<feature>/.state.json). Phases: classification, requirements, design, test-plan, eval-plan, tests, tasks, execution (a change — kind change, size xs — has only tasks, its plan = change.md, and execution). The approval is a GATE: that phase's checks run first (requirements: EARS errors, template placeholders, open [NEEDS CLARIFICATION], success criteria + priorities, AC uniqueness — bugfix: bug.md Reproduction; design: placeholders, Constitution Check, active +saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data sections, clarifications — bugfix: bug.md Root Cause instead; test-plan: placeholders, every AC has a test, no row citing an AC requirements.md does not define; eval-plan: placeholders; tasks: no placeholder tasks, every AC covered, no phantom IDs; tests — the Phase 4 sign-off: +tdd every planned T-ID named by a test file (tests-in-code), +ai an evals/golden.json of the feature's own, not the scaffold's sample (eval-sets), nothing to approve on a core-only feature — it records the plan it covered (testsPlan: the planned T-IDs, the plans' approvals) and is pending again once a T-ID was planned since or the test / eval plan was re-approved with other content since (an approval recorded before 1.22 never is), and due once its plan exists or was approved; execution — spec_finish's blockers: doctor, root-cause, placeholders, changed-since-approval, tasks, open-tasks, verification, suite-evidence (with project checks, roadmap.json meta.checks), approval-gates; a spike: spike, decision, open-tasks) and any failure REFUSES it, listing the failing check ids and details. Phase by phase: while an EARLIER active phase with an artifact is still unapproved (a bugfix's design before its tasks), the approval is refused too — check `phase-order`, naming the earlier phase(s) to approve first. `force: true` records it anyway as a forced approval (`forced` + the failing ids; doctor's approval-gates and the roadmap keep flagging it). A phase with no artifact (eval-plan without +ai, test-plan without +tdd, a missing file) can't be approved, not even with force. APPROVALS BY ROLE (opt-in, roadmap.json meta.approvalRoles — spec_init {approvalRoles}): a phase listed there needs `role` (one of its roles; each sign-off runs the gate and is recorded under the approval's `roles` and in approvalHistory with its role) and counts as approved only once EVERY role has signed off its CURRENT content — until then the result is ok with approved: null, signedOff, pending, missingRoles, and the phase stays pending (doctor, next_action, finish and ROADMAP.md name the missing roles); a sign-off of content changed since no longer counts. Without roles configured, a single approval as before. FAST-FORWARD: `through` (instead of `phase`, e.g. 'tasks') approves the active phases IN ORDER from the first unapproved one up to it, each through its own gate (snapshot + history record flagged batch: true) — it stops at the first refused gate (ok: false, refused, stoppedAt, failing, checks; the phases before it stay approved: `approved`) or, with roles, at a phase still waiting for another role (ok: true, complete: false); `role` signs each phase, `force` forces each gate (only when the user asked). Makes approval-gated progress auditable and resumable. Only record an approval the user gave — an explicit yes for THAT phase (a passing test run, a ticked task or \"finish it\" / \"fix it\" is not one; `execution` too): with roadmap.json meta.approvalGuard ask / deny (spec_init {approvalGuard}) the plugin's hook asks the user before this call, or refuses it — then ask the user to run it themselves (their terminal, or Claude Code's ! prefix), never retry it another way. In other MCP clients the server enforces it: a client that supports elicitation gets an elicitation/create question for the user (the phase, the gate — forced checks, waiver —, a boolean approve + an optional note) and the approval is recorded only on an explicit approve, with `confirmed` {via: \"elicitation\", at, note?}, and only as the question showed it: content edited while it waited (per phase for a fast-forward) or, forced, a gate failing more checks → `changedSincePreview: true` (code changed-since-preview), nothing recorded; declined, dismissed or unanswered (5 min, DEV_SPEC_ELICIT_TIMEOUT_MS) → `declined: true`, nothing recorded; at deny a client without elicitation is refused (`humanRequired: true` + the `command` the user runs). WAIVERS: with `force`, `reason` (one line) and `expires` (an ISO date YYYY-MM-DD, today or later, or a number of days like 30d — at most 3650) record why the gate was forced and until when, as `waiver` {reason, expires} on the approval and its history record (only when the approval IS forced — a passing gate waives nothing: waiverIgnored); either without force is refused, a force without them stays allowed. Doctor warns `waiver-expired` once the expiry passed while the approval still stands forced; ROADMAP.md shows each forced approval with its waiver (EXPIRED flagged); spec_finish lists them (`waivers`, and in the merge summary). REVOKE: `revoke: true` (+ `reason`) removes the approval of `phase` — and the role sign-offs waiting for it — when it was given by mistake or no longer holds; recorded in approvalHistory as {phase, at, by, revoked: true, reason} (no snapshot). It never cascades: later phases stay approved (`laterApproved`), the revoked phase is pending again (doctor, next_action and spec_finish ask for it; approving another phase is refused on phase-order until it is approved again); revoking a planning phase of a finished feature makes its finish stale (spec_drift `stale`, the catalog reads it complete, not finished) until it is approved again — with the same content the finish stands (a re-approval or a role re-signing of unchanged content after a finish changes nothing), edited it is finished again. Revoking an unapproved phase is an error (notApproved); `execution` included; no force / expires / through with it. CLI: approve <f> <phase> --revoke [--reason \"…\"] · approve <f> <phase> --force --reason \"…\" --expires 30d.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, phase: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"], description: "The phase to approve (or `through` for the fast-forward), or — with revoke — whose approval to revoke." }, through: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks"], description: "Fast-forward: approve every active phase from the first unapproved one up to this one, in order, each through its gate (CLI: --through <phase>; /spec-ff)." }, role: { type: "string", description: "The role this sign-off is for, when roadmap.json meta.approvalRoles lists the phase (CLI: --role)." }, by: { type: "string", description: "Approver (default: $USER / $USERNAME, else 'user' — same as the CLI)." }, force: { type: "boolean", description: "Approve even though the phase's checks fail — recorded as forced, with the failing check ids (CLI: --force)." }, reason: { type: "string", description: "With force: why the gate is waived (the waiver's reason); with revoke: why the approval is revoked. One line, ≤ 500 characters (CLI: --reason)." }, expires: { type: "string", description: "With force: when the waiver expires — YYYY-MM-DD (today or later) or Nd (e.g. 30d), at most 3650 days (CLI: --expires)." }, revoke: { type: "boolean", description: "Revoke the approval of `phase` (and its waiting role sign-offs) instead of approving it — never cascades (CLI: --revoke)." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "steering_scaffold",
    description: "Create a single steering file from its template (constitution.md, product.md, tech.md, structure.md, testing-standards.md, scale.md, observability.md, cost.md, ai-strategy.md, security.md, privacy.md, distributed.md, api.md, ui.md, data.md) — or a CUSTOM scoped steering file for any other name matching ^[a-z0-9][a-z0-9-]{0,62}\\.md$ (not a Windows device name such as nul.md/com1.md, not a JavaScript built-in): a stub with Kiro-compatible front matter (`inclusion: always | fileMatch | manual`, `fileMatchPattern: \"src/api/**\"` — a glob with ** * ? {a,b}, or a list) plus short guidance. spec_task_brief includes `always` files, `fileMatch` files whose pattern matches one of the task's _Implements:_ paths (their body quoted, front matter stripped), and lists `manual` ones as available on request; spec_doctor warns about steering files still holding template placeholders. In `lang` (en/pt/pt-BR/es; defaults to the project language). glossary.md (1.16, never created by spec_init) is the product's ubiquitous language: one entry per term — `- **Customer** — a person or company with a signed contract. _Avoid: client, user_` (the `_Avoid:_` marker stays English in every language); spec_clarify asks about every avoided word a feature's requirements.md / design.md use, spec_doctor warns `glossary`, spec_task_brief quotes the entries a task uses. Idempotent — never overwrites.",
    inputSchema: { type: "object", properties: { file: { type: "string", description: "A known template name, or a custom name like api-conventions.md." }, lang: { type: "string", enum: LANG_ENUM }, projectDir: { type: "string" } }, required: ["file"] },
  },
  {
    name: "spec_roadmap",
    description: "Show the multi-feature roadmap: each feature's tracks, phase, completion % (planning phases up to 30%, then driven by the fraction of tasks done), declared dependencies, blocked status (a dep is met when that feature is 100%), plus overall % and any circular dependency. With `write: true`, (re)generates the always-current overview: `.specs/ROADMAP.md` by default (Markdown, keeps the Mermaid dependency graph — git-friendly) — and also a self-contained brand-styled `.specs/ROADMAP.html` (light/dark toggle, offline) when `html: true`. Pass `lang` ('en'/'pt'/'pt-BR'/'es') to localize the roadmap chrome only (stored as meta.roadmapLang for auto-refresh; the project language is unchanged). `html: true` implies writing. A same-named file that dev-spec did not generate is never overwritten — the result is then an error naming it (`errors`), with `wrote` listing only what was written. Reads .specs/roadmap.json + the feature folders. FORECASTS: `velocity` = points completed per working day (Mon–Fri) over the last 28 days, from when spec_complete_task ticked each task (.state.json ticks; older ticks: their first passing evidence run) — a task's `_Size: XS|S|M|L|XL_` marker = 1/2/3/5/8 points, an unsized task counts as its feature's median (else M); each feature's `forecast` = its open points ÷ velocity (its own once it has 3 completions in the window, else the project's) → `eta` + `range` (±25%) in working days, starting after the ETA of any unfinished dependency — or `eta: null` with a `reason` (not-enough-data: fewer than 3 completed tasks in the window · no-tasks · dependency · cycle · done). OVERLAPS: `overlaps` = pairs of features that collide at merge time — two active features whose OPEN tasks plan the same files (_Implements:_; a folder covers the files under it) or an active feature planning files a finished feature recorded in its drift baseline — unless ordered by a dependency or declared with _Supersedes:_ (ROADMAP.md lists them under Needs attention; spec_doctor warns: cross-feature-overlap). MILESTONES (1.16, spec_milestone): `milestones` = each milestone with its date vs the latest ETA of its open features and a stable `status` — on-track · at-risk (reason eta-after-date · eta-unknown · no-features) · late (the date passed, not all done) · done; ROADMAP.md / .html show a Milestones table and list the late / at-risk ones under Needs attention.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" }, write: { type: "boolean", description: "(Re)write .specs/ROADMAP.md (default format)." }, html: { type: "boolean", description: "Also (re)write the brand-styled .specs/ROADMAP.html." }, lang: { type: "string", enum: LANG_ENUM, description: "Language for the roadmap chrome." } } },
  },
  {
    name: "spec_backlog",
    description: "Manage the backlog — planned features that don't have a `.specs/<feature>/` folder yet (so the roadmap's 'what's left' includes work not yet started). Actions: 'add' (name + optional note — one line, at most 2,000 characters, else add is refused and nothing is written; a name that already has an active feature folder is refused — it is specced, not planned; a name already in the backlog, compared case-insensitively, keeps its entry and the new note is APPENDED to its note — one line, joined with ' · ', a note it already holds changes nothing, the whole note at most 2,000 characters (past it add is refused: file it under another name) — the result then carries `exists: true`, `appended` and a localized `note`; give separate items distinct names), 'rm' (alias 'remove'), or omit / 'list' to list. Stored in .specs/roadmap.json.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: spec.BACKLOG_ACTIONS.slice() }, name: { type: "string" }, note: { type: "string" }, projectDir: { type: "string" } } },
  },
  {
    name: "spec_depend",
    description: "Show or edit a feature's dependencies and/or order in .specs/roadmap.json. `dependsOn` REPLACES the list ([] clears it); `add` / `remove` edit it incrementally; `order` sets the position; `name` alone only returns the current dependencies (nothing is written). Every dependency must be an existing feature. Rejects changes that would create a circular dependency. Use for 'feature X depends on Y' or 'do X before Y' (set order).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, dependsOn: { type: "array", items: { type: "string" }, description: "Replaces the list with these feature slugs ([] clears it)." }, add: { type: "array", items: { type: "string" }, description: "Feature slugs to add to the current list." }, remove: { type: "array", items: { type: "string" }, description: "Feature slugs to remove from the current list." }, order: { type: "integer", description: "Optional explicit ordering position." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_milestone",
    description: "Milestones — named target dates for a set of features, stored in .specs/roadmap.json meta.milestones [{name, date, features}] (under the roadmap lock; nothing is sent anywhere). `action`: 'list' (default) — every milestone with its status; 'add' — name + date (YYYY-MM-DD, a real day) + features (≥ 1, each an existing ACTIVE feature, resolved like spec_depend — each item is a feature name ('User Login' is one), 'a,b' is split on the comma) — an existing name is UPDATED (date and features replaced, the features archived since kept; `updated: true`) — names are compared case-insensitively with the accents of Latin letters and runs of spaces / _ - . : # ( ) folded, every other character counting ('Sprint α' and 'Sprint β', 'C' and 'C++' are two milestones); 'rm' (alias 'remove') — by name. A name is letters (any script), digits, spaces and . _ : # ( ) + - (≤ 60 characters, starting with a letter or a digit); at most 50 milestones and 200 features each. A feature's lifecycle follows, like dependsOn: spec_feature rename → the new slug, remove → dropped, archive → moved to the milestone's `archived` list (restore puts it back; the milestone's release notes still cover it, its status no longer counts it). STATUS (stable codes) against the roadmap forecasts (spec_roadmap: velocity → each feature's ETA): `done` — every active feature at 100%; `late` — the date has passed and a feature is not done; `at-risk` — `reason` eta-after-date (the latest ETA of its open features is after the date) · eta-unknown (an open feature has no ETA yet: not enough velocity data, no tasks, a dependency — listed in `unknownEta`) · no-features (nothing active or archived left); `on-track` — every open feature's ETA is on or before the date. Each milestone: {name, date, features, archived?, status, reason?, done, total, open, eta (the latest ETA of its open features, null when one is unknown), unknownEta?}, plus `today` and localized `lines`. spec_roadmap returns the same `milestones`; ROADMAP.md / .html show a Milestones table and list the late / at-risk ones under Needs attention; spec_changelog {milestone} scopes the release notes to a milestone's features. A meta.milestones of the wrong shape — or holding an entry add would refuse (a bad name or date, a duplicate name) — is refused by add / rm (fix it by hand) and read as its valid entries otherwise; a roadmap.json that doesn't parse is an error (list included).",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: spec.MILESTONE_ACTIONS.slice(), description: "list (default) | add | rm (alias remove)." }, name: { type: "string", description: "The milestone's name (add / rm)." }, date: { type: "string", description: "Its target day, YYYY-MM-DD (add)." }, features: { type: "array", items: { type: "string" }, description: "Its features — existing active feature names/slugs, one per item ('User Login' is one name; a comma splits an item) (add; replaces the active list when the milestone exists, its archived features kept)." }, projectDir: { type: "string" } } },
  },
  {
    name: "spec_scan",
    description: "Brownfield: heuristic, bounded, read-only scan of an EXISTING codebase (no model, no cost) — file inventory by extension, top-level modules, stack + web frameworks (manifests; FastAPI/Flask/Django also from imports), HTTP ROUTES with method + path + file:line (Express/Koa/Fastify/Hono, NestJS, Next.js, Flask, FastAPI, Django, Spring, ASP.NET, Rails/Sinatra, Laravel/Symfony, Go net/http/gin/echo/chi/fiber; listed up to a cap, `candidateEndpoints` counts every route), test frameworks + test-file count, entrypoints, environment variable NAMES the code reads (never values; .env itself is never read — only .env.example-style files), and migration/schema files. Manifests are the root's and, in a monorepo, the nested ones (≤ 20 read); a root manifest linked out of the project is never read. Skipped: the folders the root .gitignore names as plain directory patterns (obj/, [Bb]in/, /_build/, Pods/…), a folder whose own .gitignore ignores everything, and testdata/ (fixtures). A projectDir that is not a folder is an error (never an empty codebase). The agent interprets this to infer steering/constitution and reverse-engineer specs.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" }, cap: { type: "integer", minimum: 1, description: "Max code / manifest files to scan (default 5000; images, docs and data don't count). `truncated`: a code file was left unscanned." } } },
  },
  {
    name: "spec_coverage",
    description: "Brownfield: how much of the codebase is covered by specs — the share of code files (test files reported apart) named in any `_Implements:_` marker (a file, a folder or a glob) of any feature, active or archived, with a per-top-level-folder breakdown (`byFolder`), the uncovered folders, per-feature counts, the _Implements:_ entries that name nothing on disk (`unmatchedImplements`) and those naming an existing test or non-code file (`nonCodeImplements`, informational). `coveragePercent` = covered code files / code files; `documented`/`undocumented` = folders with at least one / no covered file. It skips what spec_scan skips (the root .gitignore's generated folders, testdata/); a projectDir that is not a folder is an error.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" } } },
  },
  {
    name: "spec_clarify",
    description: "Surface ambiguities and gaps in a feature's requirements BEFORE design: vague terms, leftover placeholders/TBD, missing edge-cases/NFR/out-of-scope sections, missing IF…THEN failure paths, and track-specific gaps (tenant isolation, AI quality/cost). Returns a list of clarification questions to ask the user. It asks what the feature's kind and size ask (1.21): a change (one change.md) only its own — its Summary / Approach written, 1–3 EARS criteria, its markers, vague terms and slots (named change.md:<line>), its XS scope; a size s feature no edge-case / NFR question (those mean size m). 1.16: when .specs/steering/glossary.md lists words to avoid (`_Avoid:_`), every one found in requirements.md / design.md (word-matched, case-insensitive, outside code and comments; the glossary's own terms masked first) is a question naming file:line and the term to use (at most 10, then one pointing at doctor) and the result carries `glossary` [{word, term, count, locations}]. 1.17: when requirements.md / design.md name queues, events, webhooks, async work, concurrency, transactions or retries (the user's own text: never a template's words, code, comments or slots; two distinct concepts, or one strong phrase such as a message queue, a webhook, publishing an event or concurrent writes) and neither requirements.md nor design.md states a consistency model, a delivery guarantee or idempotency (eventual / strong consistency, at-least-once, idempotency key, isolation level, optimistic locking, outbox…), ONE question asks for atomicity, the isolation level, concurrent writers, strong vs eventual consistency and the delivery guarantee + idempotency; the result carries `nudges` [{code: 'consistency-unstated', signals: [≤ 3 words]}] (a plain feature only — not a bugfix or spike, not with +dist).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_next_action",
    description:
      "\"You are here, do this next.\" ONE recommendation for a feature, phase by phase — `step`: re-review (an artifact changed after ITS approval, so a spec edited post-approval is re-reviewed, not silently shipped; `impact` = {tool: 'spec_impact', phases} when that approval has a snapshot to diff) → then the FIRST active phase not approved yet (classification, requirements, design, test-plan (+tdd), eval-plan (+ai), tests (Phase 4 on +tdd/+ai, once its plan exists), tasks): fill (its artifact still missing or a template; `file` names it) → fix (what that phase's approve gate would refuse: `refusedGate` {phase, failing}) → approve (its gate passes) — the next phase starts only after that approval, so the design is never asked for before the requirements are approved (a design-first feature — .state.json flow, spec_create {flow} — walks classification → design → requirements → …; the result then carries `flow: 'design-first'`) → fix (every phase approved, but a check of the current or an earlier phase still fails, e.g. after a forced approval) → implement (the next open task) → verify (every task ticked, but one is not verified — its latest recorded run failed, or its runnable _Verify:_ has only a note, stale or shared-number evidence: spec_finish and the execution sign-off refuse it; the recommendation names each task with its reason and how to record a passing run, e.g. `dev-spec done <f> <n> --run`) → finish (every task done and verified: run spec_finish); `tasks` when there are no tasks yet. Once spec_finish {write} has recorded the finish: `finished` (it asks for the execution sign-off while that approval is missing) or `drift` (implementing files changed since the finish — decide: spec wrong → spec_impact, code wrong → fix, harmless → re-finish), with `drift` {finishedAt, files, changed, missing, nowPresent, drifted}. A finished feature that changed since its finish (a change request or a re-approval after it, or an _Implements:_ file its baseline never recorded) and whose tasks are done again answers `finish` again — re-run spec_finish {write} for a fresh report, merge summary and baseline, then the execution sign-off — with `staleBaseline` {finishedAt, since: [{kind: 'change-request', n, at} | {kind: 'approval', phase, at}], newFiles} (and `drift`: its recorded files are still hashed — when one of them changed, the step is `drift`, the decision first, then finish again); an execution sign-off older than such a change (or than a later approval, e.g. an upgraded feature's tests sign-off) is asked to be re-confirmed, naming what came after it. Also returns phase, tracks, the doctor verdict, gatesOk, pendingGates, changedSinceApproval and the localized `recommendation`. When a steering file that governed the requirements / design approval changed since (doctor's steering-changed-since-approval), the recommendation adds a re-review hint and the result carries `steeringChanged` — never a step or a block of its own. Use to resume work or answer 'what now?'.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_add_track",
    description:
      "Escalate an EXISTING feature to a new track (+tdd, +saas, +ai, +sec, +privacy, +dist, +api, +ui, +obs or +data) - additive only, never overwrites. Scaffolds just the missing artifacts (test-plan.md/tests/, eval-plan.md/prompts/evals/, load-test.md), appends that track's mandatory design.md sections and template tasks, adds its steering files, updates classification.md's Active Tracks line and persists the track set in .state.json. `track` takes one or several ('saas,ai', '+saas +ai'); an unknown track is an error with a did-you-mean. With `remove: true` the track is turned OFF instead - non-destructive: no file is deleted, the result lists the now-inactive artifacts, and doctor/status/next_action stop requiring them ('core' can't be removed; a bugfix keeps +tdd). Use when a feature grew into needing tests, scale, AI, security or privacy work after it was created (or no longer does).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, track: { type: "string", description: "tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack (spec_tracks) - or several: 'saas,ai' / '+sec +privacy'." }, remove: { type: "boolean", description: "Turn the track(s) off instead (files are kept, listed as inactive)." }, projectDir: { type: "string" } }, required: ["name", "track"] },
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
      "Import a spec written for another tool as a NEW dev-spec feature (never over an existing feature; the source files are only read, never modified). `tool`: 'kiro' (.kiro/specs/<name>/ — requirements.md '### Requirement N' + numbered WHEN/THEN/SHALL criteria, design.md, tasks.md with _Requirements: 1.1, 2.3_), 'spec-kit' (specs/<nnn-name>/ — spec.md user stories + Given/When/Then acceptance scenarios + FR-xxx/SC-xxx, plan.md → design.md, tasks.md 'T001 [P] [US1] …'), 'openspec' (openspec/specs/<capability>/spec.md '### Requirement:' + '#### Scenario:', or a change folder openspec/changes/<id>/), 'plan' (a Markdown plan: Claude Code plan mode — saved under plansDirectory, default ~/.claude/plans, OUTSIDE the project: pass its markdown as `text` (or copy the file in / point plansDirectory inside it) — or a Cursor plan .cursor/plans/*.plan.md with name/overview/todos front matter: goals and acceptance-like bullets → US-1's criteria, checklists / Cursor todos / a Steps section's items → tasks keeping their state, the file paths a step names → _Implements:_, the rest → design.md), 'execplan' (a Codex ExecPlan per PLANS.md: Validation and Acceptance → criteria, Progress (state kept) + Concrete Steps → tasks with _Verify:_ when a step names a test/lint/build/curl command, Decision Log → design.md '## Decisions' D-1…, Purpose → summary, the living sections → design.md) 'bmad' (BMAD-METHOD: docs/prd.md or a sharded docs/prd/ (v6: _bmad-output/planning-artifacts/) FR/NFR lines → FR-n / NFR-n, epic stories + story files docs/stories/*.md → US-1…US-n in story order, their ACs → US-n.AC-m, Tasks / Subtasks → tasks tagged [USn] with '(AC: 1, 3)' → _Requirements:_, architecture.md + Dev Notes → design.md; a single story file imports that story) or 'fluidplan' (a plan settled with the fluidplan skill: a plan folder .fluidplan/<id>/ (plan.json, answers.json, PLAN.md, DECISIONS.md), its plan.json or its PLAN.md / DECISIONS.md — the finalized PLAN.md / DECISIONS.md win, plan.json + answers.json fill in the rest or stand alone: pages (themes) → user stories, each task's acceptance → criteria, tasks → tasks.md keeping their ticks with files → _Implements:_ (a delete in the task text), verify → one _Verify:_ per command, after → _Depends:_ (renumbered); accepted and rejected decisions → decisions.md (D-1…, spec_decide's format) + design.md Decisions / Alternatives & Trade-offs, the working rules → tasks.md Global Constraints, rejected ones → Out of Scope, decisions still open → requirements.md Open decisions with [NEEDS CLARIFICATION] + a warning; the round history is not imported). A folder holding several plans is refused — name the file. Requirement/story N criterion/scenario M → US-N.AC-M; each scenario becomes ONE EARS criterion (WHEN … THE SYSTEM SHALL …) where possible, else its text is kept with [NEEDS CLARIFICATION]; Kiro _Requirements:_ references are rewritten; tasks are renumbered 1…K keeping checkbox state and [P]/[USn] tags; SC-/FR- IDs stay. Every generated artifact carries an 'Imported from <tool> <path> on <date>' note (the file itself for a plan / ExecPlan / single story). `path` must resolve inside the project; `text` (plan / execplan / fluidplan only, instead of path) is the document itself (fluidplan: PLAN.md, DECISIONS.md may follow it) — same mapping and guarantees, the note says (inline text), the result has inline: true and source: null. Tracks: `tracks`, else auto-classified from the imported requirements. Returns {feature, files, mapping: {oldId: newId}, warnings}.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", enum: ["kiro", "spec-kit", "openspec", "plan", "execplan", "bmad", "fluidplan"], description: "The format of the source spec." },
        path: { type: "string", description: "The spec's folder (or a file inside it; for a plan / ExecPlan the file itself when its folder holds several), relative to the project root or absolute — it must be inside the project. Required unless `text` is given." },
        text: { type: "string", description: "tool 'plan' / 'execplan' / 'fluidplan' only, instead of `path`: the document's markdown itself (fluidplan: its PLAN.md, DECISIONS.md may follow it) (1.16 — the plan-mode bridge: Claude Code keeps an approved plan in plansDirectory, ~/.claude/plans by default, OUTSIDE the project — pass the plan's text). Same mapping and guarantees as the file; the note reads 'Imported from plan (inline text)', `source` is null and `inline` true. CLI: dev-spec import plan - (stdin) or --text \"…\"." },
        name: { type: "string", description: "Feature name (default: the source folder's name, spec-kit's number prefix dropped; a plan / ExecPlan: its title, else its file name; BMAD: the PRD's title, else the folder — or the story's title for one story file; fluidplan: the plan's title). An existing feature with that slug is an error." },
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack in .specs/tracks/<name>/ (spec_tracks) ('tdd,saas' / '+saas +ai' are split; unknown names get a did-you-mean error)" }, description: "Active tracks ('core' always added). Omit to auto-classify from the imported requirements." },
        lang: { type: "string", enum: LANG_ENUM, description: "Language of the generated artifacts (headings, notes). Defaults to the project language, else en. The imported text itself is kept as written." },
        projectDir: { type: "string" },
      },
      required: ["tool"], // + `path` or `text` — the engine says which is missing (a schema can't express "one of")
    },
  },

  {
    name: "spec_append_tasks",
    description:
      "Converge: append NEW tasks to an existing feature's tasks.md without touching the tasks already there (never renumbered or edited). They are numbered after the highest number in use and go under a phase heading — default a localized 'Phase: Convergence' (created with a closing **Checkpoint:**, after the last active phase); an existing heading with that exact text is reused (tasks go at the end of that phase, before its closing checkpoint). Each task becomes `- [ ] N. [USn][P] text` with `_Requirements:_` / `_Makes green:_` / `_Implements:_` / `_Verify:_` / `_Expect: fail_` / `_Size:_` / `_Depends:_` sub-lines, so status, next_task {batch, waves}, task_brief, complete_task (evidence) and finish work on them as on any task. Every AC ID must exist in requirements.md and every _Makes green:_ T-ID must be planned in test-plan.md — an unknown one is an error and NOTHING is written; every `depends` number must name an active task or a task of this same call (they are numbered consecutively after the highest number in use — the error names the numbers this call would take), never the task itself, and may not close a dependency cycle; _Implements:_ paths must be project-relative (stored with forward slashes, no '..'). CRLF line endings and a BOM are preserved; a removed track's task section is never used. New content invalidates an earlier tasks approval: the result says so (`needsReapproval`) — review and re-approve. Use when implementation drifted from the plan or a review found follow-up work.",
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
              makesGreen: { type: "array", items: { type: "string" }, description: "T-IDs the task makes green (_Makes green:_, e.g. T-01) — each must be planned in test-plan.md." },
              expectFail: { type: "boolean", description: "_Expect: fail_ — a red task: its proof is a run of its _Verify:_ that FAILS (the test written before its fix)." },
              size: { type: "string", description: "_Size:_ — XS, S, M, L or XL (1/2/3/5/8 points for the roadmap forecasts)." },
              depends: { type: "array", items: { type: "integer", minimum: 0 }, description: "_Depends:_ — numbers of the tasks that must be done first (an active task, or a task appended by this call)." },
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
      "Change request: what an edit made AFTER an approval touches. Compares the current artifact with the snapshot saved by its latest approval (.specs/<feature>/.history/<phase>@<n>.md — every spec_approve appends to .state.json approvalHistory and saves one). A change (kind change, size xs): its ONE file, change.md, approved as the plan — phase 'tasks' (its default; another phase is refused): its criteria diffed by stable ID as below, its tasks by number in `tasks`, and `reopen` works. `phase` 'requirements' (default): AC-level diff via stable IDs — added / modified (whitespace-normalized text differs) / removed ACs, plus SC-/EC-/NFR- IDs — and, for each modified or removed ID, the tasks citing it in _Requirements:_ (done/open + evidence state), the T-IDs covering it in the test plan and the design sections mentioning it. 'design': section-level diff (## headings, by normalized body — of design.md; for a bugfix, of bug.md and design.md, which its design approval signs off, each section keyed by its file ('bug.md: Root Cause'), with `designMd` giving design.md's baseline) and the tasks citing an ID named in a changed section. 'test-plan': T-ID row diff (a row keyed by its first cell; re-padding a column is no change) — added / modified / removed planned tests and, for each modified or removed one, the tasks making it green (_Makes green:_). 'eval-plan': section-level diff of eval-plan.md, like 'design'. 'tasks': added / removed / changed task numbers. 'steering' (1.16, read-only; `name` optional — without it, project-wide): every active feature (or the one named) whose requirements / design approval was made under an older version of a steering file that changed or was removed since — `features` [{feature, approvals: [{phase, approvedAt, files: [{file, change: modified | removed}]}]}], `files`, `changed`, and `untracked` [{feature, phases}] for approvals made before 1.16 (no steering fingerprints, never flagged); reopen is refused (re-review, then re-approve — the approval records the current steering). Every other phase needs `name`. An approval made before the change history has only a fingerprint → `baseline: 'fingerprint-only'` with `changed` and a hint to re-approve (which starts the history); one with no fingerprint either (≤1.10, a 1.12 bugfix design approval) → `baseline: 'none'`, `changed: null` (unknown — a file date is no evidence) unless a file was added after it; a phase never approved is an error. `reopen: true` (requirements / design / test-plan / eval-plan): unticks the affected DONE tasks (never those of a REMOVED criterion or test — requirements returns them with their test rows in `retire` [{id, tasks, tests}] to delete or repoint, and a design section naming only removed criteria reopens nothing), marks their evidence stale (they count as unverified until a new run is recorded), records the change request in .state.json `changes` and refreshes the roadmap — it never edits requirements.md or design.md, and a second reopen with nothing new changes nothing.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug (optional only with phase 'steering': omitted = every active feature)." },
        phase: { type: "string", enum: ["requirements", "design", "test-plan", "eval-plan", "tasks", "steering"], description: "Which approved artifact to compare (default requirements — a change: tasks, its change.md); 'steering' lists the features approved under steering that changed since." },
        reopen: { type: "boolean", description: "requirements / design / test-plan / eval-plan (not tasks — except a change's plan): untick the affected done tasks, mark their evidence stale and record the change request." },
        projectDir: { type: "string" },
      },
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
      "Living catalog — 'what the system does today': every feature (active; complete/finished; archived under .specs/_archive) with its status — `finished` as spec_next_action / spec_finish mean it: a current finish baseline (no change request, re-approval or new _Implements:_ file since), every artifact as approved and every tick verified, else `complete` — and every AC ID with a one-line EARS text, grouped by feature. A criterion replaced by a later SHIPPED feature (a finish recorded or the execution signed off) is shown as superseded, naming the ID that replaces it; one a feature still in progress plans to replace is 'to be superseded' (supersedePending) and stays current: the newer criterion declares it with the English-stable marker `_Supersedes: <feature>/US-n.AC-m[, …]_` (same line, a sub-line or its table row; trace_check reports references that resolve to nothing as `phantomSupersedes` warnings). With `write: true` it (re)writes `.specs/SPECS.md` — chrome in the project language, carrying the AUTO-GENERATED marker; a hand-written SPECS.md (no marker) is never overwritten (the result is then an error). Without `write` it returns the structure plus the markdown. Once SPECS.md exists, every mutator that refreshes the roadmap refreshes it too. 1.16: `crossAcs` {pairs, truncated} — criteria of two different ACTIVE features that read alike (kind duplicate, reason near-duplicate: ≥ 80% word similarity) or may contradict each other (kind conflict, reason opposite-modal — SHALL vs SHALL NOT — or different-numbers, ≥ 70% alike with the same trigger), each pair {kind, reason, similarity, a: {feature, id, text}, b, numbers?} — a deterministic heuristic (EN/PT/ES stop words, accents folded, numbers apart) bounded by an inverted index and caps; template criteria, retired ones and declared _Supersedes:_ pairs are left out; SPECS.md gets a 'Possible duplicates / conflicts' section when there is one.",
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

  {
    name: "spec_templates",
    description:
      "Project templates: a team's own scaffolds in .specs/templates/. `<artifact>.md` replaces the built-in template of classification, requirements, design, tasks, test-plan, eval-plan, load-test, quickstart, checklist, integration-plan, bug (bug.md), the bugfix variants bug-requirements / bug-test-plan / bug-tasks, the spike ones spike (spike.md — {{summary}} is the spike's question) / spike-tasks or change (change.md — a change's one file, kind change / size xs); `<lang>/<artifact>.md` (en | pt | pt-BR | es) replaces it for features in that language and wins over the shared one; `steering/<file>.md` (also under <lang>/) replaces a steering stub. spec_create, spec_add_track, spec_init, steering_scaffold and spec_import (through spec_create) use an override when present — create-only, never over an existing file — with {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}} substituted (an unknown {{x}} is left as is; no summary → a generic [TBD] slot). Track blocks: an overridden design.md still gets each active track's sections (+tdd Testability Notes, [SaaS] / [AI] / [SEC] / [PRIVACY]), requirements.md each marker track's criteria (renumbered after the template's own US-1 ACs when they would collide), tasks.md its task block and test-plan.md its test rows, appended at the end as spec_add_track does — unless the template already has that track's heading (for the test plan: already cites its criteria). The [bracketed] slots, code-span slots and task lines of the project's templates count as template placeholders, so an untouched custom scaffold still reads 'placeholder' for spec_doctor, spec_approve and spec_next_action. `action`: 'list' (default) — built-in vs project template per artifact for `lang` (default: the project language), plus files that are not a template name (ignored); 'init' — copy the built-in template(s) (`artifact`, or all of them) into .specs/templates/ for editing, variables in place — with `lang` into .specs/templates/<lang>/, else the shared folder in the project language; never overwrites; 'check' — validate the project's templates against the current rules: a design template with some of a track's marker headings but not all its mandatory sections (error), a track section without its > **TODO** line, EARS / AC-ID problems (a criterion with no modal verb or duplicate AC IDs are errors), AC IDs a tasks / test-plan template cites that the requirements template doesn't define and _Makes green:_ T-IDs the test plan doesn't plan (built-in ones included when only one side is the team's), bug.md without a Root Cause section or with one that already reads as written (errors), unknown {{variables}}, chain templates with no placeholder at all, empty files, names that are not templates — each problem with {file, line?, code, severity, message} and a verdict pass | warn | fail (`lang` limits it to the templates that apply to that language). Every path is built from the allowlisted names; nothing outside .specs/templates/ is read or written (a linked folder, or a file whose real path is outside the project, is ignored); a .specs/templates/ that is a feature created before 1.14 (it holds a .state.json) stays that feature — every action refuses with legacyFeature: true. Returns localized `lines`.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "init", "check"], description: "list (default) | init | check." },
        artifact: { type: "string", description: "One template: classification | requirements | design | tasks | test-plan | eval-plan | load-test | quickstart | checklist | integration-plan | bug | bug-requirements | bug-test-plan | bug-tasks | spike | spike-tasks | change | steering/<file>.md ('.md' optional). Omit for all." },
        lang: { type: "string", enum: LANG_ENUM, description: "list: the feature language to resolve for (default: the project language). init: copy the templates in this language into .specs/templates/<lang>/. check: only the templates that apply to it. Messages follow it." },
        projectDir: { type: "string" },
      },
    },
  },

  {
    name: "spec_tracks",
    description:
      "Project-defined tracks (track packs): a team's own domain rigor (+a11y, +mobile, +dbmigration…) beside the built-in core / tdd / saas / ai / sec / privacy / dist / api / ui / obs / data. A pack is the folder .specs/tracks/<name>/ — track.json (JSON; // and /* */ comments allowed): name (= the folder name, ^[a-z][a-z0-9]{1,19}$, never a built-in track or a reserved word), marker (^[A-Z][A-Z0-9]{1,11}$ — the stable, case-sensitive [MARKER] of its sections, criteria and task block; never SaaS / AI / SEC / PRIVACY / DIST / API / UI / OBS / DATA, unique across packs), title {en, pt?, es?}, signals {strong?, weak?, context?: [keywords]} (spec_classify / spec_create / spec_import read them like the built-in ones — matched as literal words, never as patterns), sections [{name, syn?, loose?, guidance?}] (the mandatory design sections, at least one — marker-bound: only a heading carrying [MARKER], or one under it, counts; a name's numbering / emoji lead is ignored when matching), steering (optional steering file name); plus optional markdown fragments — requirements.md (criteria, numbered after the feature's US-1 criteria under '#### [MARKER] <title> — Acceptance Criteria (EARS)'), tasks.md (the task block '## Story US-1 — [MARKER] <title>'; {{ac1}}… / {{acs}} = the pack's criteria as the feature numbers them, {{t1}}… / {{tests}} = their planned tests), test-plan.md (rows, +tdd), checklist.md (items), steering.md (the steering stub) — a <lang>/ subfolder's fragment wins over the pack root's (pt-BR → pt → root). A VALID pack is a marker track everywhere: spec_create / spec_add_track scaffold its criteria, design sections ('## [MARKER] <name>' + the > **TODO** sentinel), tasks, test rows, checklist items and steering; spec_doctor fails '<name>-sections' and the design approval is refused until each section is filled; trace_check, spec_status (packSections), spec_next_action, the roadmap, the task brief, spec_export and spec_import follow it; spec_add_track {remove: true} makes it inactive. Its [bracketed] slots are template placeholders; its [MARKER] never is. A pack is data only — nothing in it runs, only allowlisted file names are read from its own folder (a symlink / junction out of .specs/ is ignored), sizes and counts are bounded; a bad pack is reported and IGNORED as a whole, never half-applied; a feature whose saved track names a pack that is gone or invalid keeps it inactive and spec_doctor warns 'track-pack-missing'. `action`: 'list' (default) — the built-in tracks and every pack folder with its validity ({name, marker, title, sections, signals counts, steering, valid, errors}); 'init' — scaffold .specs/tracks/<name>/ (a commented example track.json + one example of each fragment, in `lang` / the project language; never overwrites); 'check' — validate every pack (or `name`): {file, line?, code, severity, message} with stable codes (json-invalid, name-mismatch, marker-reserved, marker-duplicate, signal-invalid, field-invalid, too-big, too-many, linked-folder, fragment-row, fragment-ref, unknown-key, ears-no-modal …) and a verdict pass | warn | fail. A .specs/tracks/ that is a feature created before 1.15 (it holds a .state.json) stays that feature — every action refuses with legacyFeature: true. 'signals' (1.21) — the project's classifier signal overrides in .specs/classifier.json (learned by spec_create from Phase 0 corrections: a word that drove a suggestion the human rejected votes 'off', one that only hinted at a track the human added votes 'weak' / 'strong'; a learned override applies after 2 consistent corrections, an opposite one or an agreement resets a pending one): `op` 'list' (default) — {overrides: [{track, word, effect, count, origin learned|set, active, lastAt}], problems, warning?}; 'set' — `track`, `word` (a literal word or phrase, the track-pack keyword rule — never a pattern), `effect` off | weak | strong: applies at once, never changed by learning; 'forget' — `track` + `word` (the built-in signals apply again). At most 200 overrides; a classifier.json that doesn't parse or holds an invalid entry is ignored with a warning and never rewritten. Returns localized `lines`.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "init", "check", "signals"], description: "list (default) | init | check | signals (the classifier's signal overrides — .specs/classifier.json)." },
        name: { type: "string", description: "init: the new pack's name (^[a-z][a-z0-9]{1,19}$). list / check: one pack (or a built-in track for list). Omit for all." },
        lang: { type: "string", enum: LANG_ENUM, description: "init: the language of the example files' text and comments (default: the project language). Messages follow it." },
        op: { type: "string", enum: ["list", "set", "forget"], description: "signals: list (default) | set | forget." },
        track: { type: "string", description: "signals set / forget: the track (tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a track pack)." },
        word: { type: "string", description: "signals set / forget: the word or phrase (a literal, 2–60 characters: letters, digits, inner spaces / hyphens / apostrophes / dots)." },
        effect: { type: "string", enum: ["off", "weak", "strong"], description: "signals set: off (no signal of that track) | weak (an anchor) | strong (turns the track on alone)." },
        projectDir: { type: "string" },
      },
    },
  },

  {
    name: "spec_export",
    description:
      "Stakeholder export: ONE self-contained, offline, printable document for people who don't read markdown folders (product, legal, clients). With `name`: that feature, in its language — summary, user stories with their EARS acceptance criteria (stable IDs; a criterion a later SHIPPED feature superseded is struck through, one a draft plans to replace reads 'to be superseded', a template one flagged), the other requirements sections (success criteria, edge cases, NFRs, out of scope …), the design sections (a bugfix: bug.md — reproduction, root cause, fix), the test plan, every task with its done / verified status (the verdict doctor gives, with the reason), decisions.md when present, the phase approvals (who / when, forced, changed since, still pending) and the open [NEEDS CLARIFICATION] markers. Without `name`: the whole project, in the project language — the roadmap summary (+ backlog), every active feature's requirements digest (summary, stories + ACs, success criteria — each feature on its own printed page) and the living catalog when .specs/SPECS.md exists. `format`: 'html' (default — the roadmap's brand palette, light/dark following the system with a toggle, print rules: light on paper, no buttons, a page break per feature; every spec text escaped, links kept for http(s)/mailto only, no image, font, script or stylesheet URL — it opens offline), 'md', or 'csv' — the requirements traceability matrix for audits (trace_check {matrix}; the project: every active feature's rows): RFC 4180 with CRLF records, localized headers, a leading = + - @ / tab / CR neutralized with an apostrophe (no formula runs in a spreadsheet), UTF-8 with a BOM (Excel reads the accents) and the AUTO-GENERATED marker as its LAST record (first cell, the rest empty — the header stays the first row); written as .specs/exports/<feature>.rtm.csv (project.rtm.csv). The HTML / md feature document also carries the matrix (a Traceability matrix section), the project document each feature's counts by status. 'gherkin' (1.16) — a BDD .feature file: one Feature per feature (its title; the summary as the description; the active tracks as tags @SaaS @AI @SEC @PRIVACY @tdd …), one Scenario per CURRENT acceptance criterion, tagged @US-n.AC-m + the T-IDs the test plan plans for it (@T-01) + its track marker; the steps ARE the EARS clauses (WHILE / WHERE / IF → Given, WHEN → When, the SHALL response → Then, verbatim — never invented behaviour; a criterion whose clauses can't be split cleanly is ONE Then step with its whole text, listed in `unsplit`); a template criterion and one a SHIPPED feature superseded are left out with a comment (`skipped` {template, superseded}), one a draft plans to supersede is kept; a PT / ES feature (pt-BR too) is written in Gherkin's dialect (# language: pt / es — Funcionalidade / Cenário / Dado / Quando / Então · Característica / Escenario / Dado / Cuando / Entonces); the AUTO-GENERATED marker is a # comment. Written as .specs/exports/<feature>.feature; without `name`, one .feature per active feature (a spike has no criteria: skipped — named, refused) as `documents` [{feature, lang, file, scenarios, skipped, unsplit, content | bytes}] — a write is all-or-nothing (a hand-written .feature refuses it, nothing written). 'jira' | 'linear' (1.16) — a CSV for the tracker's own importer (nothing is sent anywhere): one record per feature (the parent), per user story (a child of the feature) and per task (a child of its story through its [USn] tag, else of the feature), parents first; Jira columns Work item ID · Work type (Epic / Story / Sub-task / Task) · Summary · Description · Status (To Do / In Progress / Done) · Parent (the parent's Work item ID) · Labels (repeated, one label per column); Linear columns ID · Title · Description · Status (Todo / In Progress / Done) · Estimate (a task's _Size:_ points) · Labels (comma-separated) · Parent issue (local keys <feature>, <feature>/US-n, <feature>/#n); labels = the feature slug, its tracks, its kind (bugfix / spike) and the AC IDs; the F5 CSV rules (RFC 4180, formula guard, UTF-8 BOM) with the AUTO-GENERATED marker as the LAST header cell (an empty column to leave unmapped — never a record an importer would turn into a work item); written as .specs/exports/<feature>.<tracker>.csv (project.<tracker>.csv: every active feature); `records` = the work items. Without `write` the document comes back as `content`; `write: true` writes .specs/exports/<feature>.<format> (the project: project.<format>; a feature slugged 'project': project.feature.<format>) carrying the AUTO-GENERATED marker, and returns `file` + `bytes` — a same-named file dev-spec did not generate is never overwritten, and nothing is written through a .specs/exports/ (or a document) that is a link — a symlink, a junction — or resolves outside .specs/ (the result is then an error). Nothing is sent anywhere. CLI: dev-spec export [feature] [--md | --csv | --gherkin | --tracker jira|linear] [--write].",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug. Omit for the whole project." },
        format: { type: "string", enum: spec.EXPORT_FORMATS.slice(), description: "Document format (default html). CLI: --md, --csv (the traceability matrix → <slug>.rtm.csv), --gherkin (→ <slug>.feature), --tracker jira|linear (→ <slug>.<tracker>.csv)." },
        write: { type: "boolean", description: "Write .specs/exports/<feature|project>.<format> (csv: .rtm.csv) instead of returning the content (never over a hand-written file). CLI: --write." },
        projectDir: { type: "string" },
      },
    },
  },
  {
    name: "spec_changelog",
    description:
      "Release notes generated from the spec data (no model, no git log). **Added**: features that shipped since `since` — spec_finish {write} recorded their baseline, or their execution sign-off was approved — each with its summary and every user-story acceptance criterion as one line (template criteria left out). **Changed**: acceptance criteria superseded (_Supersedes:_) by a feature shipped since then, each with the criterion that replaces it; and the change requests (spec_impact reopen — .state.json changes) recorded since then: the IDs / sections added, modified and removed, the tasks reopened and, for a requirements change, the current text of the criteria it added or modified — a feature new in these notes has its change requests folded into its entry. **Fixed**: bugfix features shipped since then, with the root-cause one-liner from bug.md. A feature that already shipped before `since` is never listed as Added again. `since`: an ISO date (YYYY-MM-DD = 00:00 UTC) or timestamp, 'last' (the default — roadmap.json meta.changelogAt, stamped by the last written notes; everything while it is unset) or 'all'. Chrome in the project language; IDs stay English. Returns added / changed {superseded, changeRequests} / fixed, counts, since + sinceSource (last · date · all) and the markdown. `write: true` writes .specs/RELEASE-NOTES.md (AUTO-GENERATED; a hand-written RELEASE-NOTES.md is never overwritten — the result is then an error) and stamps meta.changelogAt, both under the roadmap lock; when there is nothing to report, nothing is written or stamped (`note`). `milestone` (1.16): the notes of that milestone's features only (spec_milestone — its features and the ones archived since), `since` then defaulting to 'all'; `write` goes to .specs/RELEASE-NOTES.<milestone-slug>.md (the slug + a short hash when the slug loses part of the name, e.g. 'Sprint α'; AUTO-GENERATED) and leaves meta.changelogAt alone; the result carries `milestone` {name, date, features}; an unknown name is an error listing the milestones.",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "string", description: "ISO date / timestamp, 'last' (default: since the last written release notes) or 'all'. CLI: --since." },
        milestone: { type: "string", description: "Scope the notes to this milestone's features (spec_milestone) — since then defaults to 'all'; write → .specs/RELEASE-NOTES.<milestone>.md, meta.changelogAt untouched. CLI: --milestone." },
        write: { type: "boolean", description: "Write .specs/RELEASE-NOTES.md and stamp meta.changelogAt (nothing when there is nothing to report). CLI: --write." },
        projectDir: { type: "string" },
      },
    },
  },

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
        affects: { type: "array", items: { type: "string" }, description: "Optional — what it touches: AC IDs (US-1.AC-2), T-IDs (T-03), EC/NFR/SC IDs, design section names as design.md spells them ('Data Models'); a comma-separated item is split. CLI: --affects US-1.AC-2,T-03." },
        supersedes: { type: "array", items: { type: "string" }, description: "Optional — earlier entries this one replaces (D-1). CLI: --supersedes D-1." },
        kind: { type: "string", enum: ["decision", "discovery"], description: "decision (default) | discovery — a fact learnt while working (CLI: --discovery)." },
        projectDir: { type: "string" },
      },
      required: ["name", "title", "decision"],
    },
  },
  {
    name: "spec_stop_check",
    description:
      "The end-of-turn evidence gate for MCP-only clients (no Stop hook, no shell) — the same decision as the plugin's Stop / SubagentStop hook and `dev-spec stop-check --json` (engine stopCheck). BEFORE sending a closing message that says the work is done or verified, pass that message: `block: true` means it would be sent back — a feature active in the last hours has ticked tasks without verification evidence (or, every task done, project checks without a passing run since the last task activity) — and `reason` lists them with what to record (spec_complete_task / spec_finish {evidence}); record the runs, or say plainly which items are NOT verified, then check again (an empty message claims nothing: no-claim). `block: false` with a stable `why`: no-specs · off (roadmap.json meta.stopCheck false) · no-claim · admitted (the message says what is not verified) · verified · no-recent; `features` [{feature, unverified: [{number, reason}], suite: [{name, status}]}], `claims`, `lang`. `agent: \"spec-implementer\"` checks an implementer's DONE report instead (its .specs/<feature>/.execution/task-N-report.md must show each _Verify:_ command and the exit code the task needs); `agent: \"spec-simplifier\"` a simplifier's DONE (its .specs/<feature>/.execution/simplify-report.md must end with a '## Final runs' section, one line per run, in which every run exits 0 and every project check is one of the runs; `why` simplify-ok · simplifier-evidence · no-changes · no-report). Read-only; it never runs anything.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The closing message you are about to send (its last 20 000 characters are read)." },
        agent: { type: "string", description: "Optional: the subagent type sending it — spec-implementer is checked on its task report, spec-simplifier on its simplification report (CLI: --agent)." },
        projectDir: { type: "string" },
      },
      required: ["message"],
    },
  },
  {
    name: "spec_log",
    description:
      "Git-linked evidence for clients without a shell tool for dev-spec: per ACTIVE task of a feature, the commits whose message cites it, plus (+tdd) a red-first check — the same result as `dev-spec log <feature> --json` (engine taskCommits). THIS SERVER NEVER RUNS GIT (or any command): pass `gitLog`, the text of `git log --name-only --relative` (git's default medium format; --name-status and --oneline are read too) that you or the user ran in the project — an empty gitLog (a repository without commits) is valid: 0 commits. A message cites task N when it names the feature (its slug as a word — `.specs/<slug>/`, `feat(<slug>):`) and \"task #N\" / \"task N\" / \"#N\" (PT tarefa, ES tarea), or one of the task's T-IDs (T-01 = T-1) / AC IDs, unless it names another feature and not this one. Red-first: a task with _Makes green: T-xx_ first committed before any commit touching a test file that names T-xx warns `impl-first` (`test-not-committed` when no commit read touches one). Returns {commits, truncated, citing, tasks: [{number, text, done, commits: [{hash, short, subject, date, via}]}], redFirst: [{task, tests, status: ok · impl-first · test-not-committed · no-test-file · no-task-commit · outside-window, taskCommit, testCommit, testFiles}], warnings, lines}. `max`: the --max-count the log was read with — a log that long is a full window, so an order it can't show is `outside-window`.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        gitLog: { type: "string", description: "The output of `git log --name-only --relative` (e.g. with --max-count=1000), run in the project — never run by this server." },
        max: { type: "integer", minimum: 1, description: "Optional: the --max-count the log was read with (a log that long is a full window)." },
        projectDir: { type: "string" },
      },
      required: ["name", "gitLog"],
    },
  },
];

// --- Tool annotations (MCP 2025-03-26+) -------------------------------------
// Hints for clients, one entry per tool (mcp/test.js requires every tool listed here) — never a security boundary: the engine
// enforces its own rules whatever a client makes of them. readOnlyHint: true only when NO argument can make the tool write
// (spec_roadmap / spec_catalog / spec_export / spec_changelog / spec_metrics / spec_task_brief write with `write: true`,
// spec_impact with `reopen`, spec_upgrade with `apply`, spec_templates / spec_tracks with `init` — so they are not read-only;
// a read-only tool never touches .specs/ — mcp/test.js snapshots the tree around each). destructiveHint: only spec_feature
// (`remove` deletes a feature folder) — every other writer only adds or updates what it owns. idempotentHint: a second
// identical call changes nothing more (a tick, an approval, an appended task or decision, finish's evidence each add a record:
// false). openWorldHint: false everywhere — local files only, no network, no command, no git.
const READ_ONLY = Object.freeze({ readOnlyHint: true, openWorldHint: false });
const writes = (idempotent, destructive) => Object.freeze({ readOnlyHint: false, destructiveHint: !!destructive, idempotentHint: idempotent, openWorldHint: false });
const TOOL_ANNOTATIONS = {
  spec_init: writes(true), spec_classify: READ_ONLY, spec_create: writes(true), spec_list: READ_ONLY, spec_status: READ_ONLY,
  spec_next_task: READ_ONLY, spec_task_brief: writes(true), spec_finish: writes(false), spec_complete_task: writes(false),
  ears_validate: READ_ONLY, trace_check: READ_ONLY, spec_doctor: READ_ONLY, spec_approve: writes(false), steering_scaffold: writes(true),
  spec_roadmap: writes(true), spec_backlog: writes(true), spec_depend: writes(true), spec_scan: READ_ONLY, spec_coverage: READ_ONLY,
  spec_clarify: READ_ONLY, spec_next_action: READ_ONLY, spec_add_track: writes(true), spec_feature: writes(true, true),
  spec_import: writes(true), spec_append_tasks: writes(false), spec_impact: writes(true), spec_metrics: writes(true),
  spec_catalog: writes(true), spec_drift: READ_ONLY, spec_upgrade: writes(true), spec_templates: writes(true), spec_tracks: writes(true),
  spec_export: writes(true), spec_changelog: writes(true), spec_decide: writes(false),
  spec_stop_check: READ_ONLY, spec_log: READ_ONLY, spec_milestone: writes(true),
};
// A tool missing from the table gets the protocol's own defaults spelled out (may write, may destroy, not idempotent) — the
// test fails on it anyway.
for (const t of TOOLS) t.annotations = Object.prototype.hasOwnProperty.call(TOOL_ANNOTATIONS, t.name) ? TOOL_ANNOTATIONS[t.name] : writes(false, true);

// --- Tool dispatch ---------------------------------------------------------

// extra (1.21 F1b, spec_approve only — set by the server, never by a tool call): { dryRun } the preview before the user is asked,
// { confirmation } the user's answer (elicitation), recorded with the approval, and (1.22 review) { preview } what that dry run
// judged — the content fingerprint(s) and the failing checks the question showed: the engine refuses to record anything else.
function runTool(name, args, extra) {
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
      return spec.initProject(pdir, args.tracks, args.lang, { guard: args.guard, checks: args.checks, approvalRoles: args.approvalRoles, stopCheck: args.stopCheck,
        approvalGuard: args.approvalGuard, evidence: args.evidence }); // 1.14 F2: approvalGuard → meta.approvalGuard (= `init --approval-guard`); F1: evidence → meta.evidence
    case "spec_classify":
      return spec.classify(args.description, { name: args.name, lang: args.lang, projectDir: pdir, explain: args.explain === true }); // meta.lang: the fallback when the text is inconclusive
    case "spec_create": {
      // No tracks → the engine keeps an existing feature's tracks, or classifies a new one in the feature's language — the explicit
      // lang, else the project's (same as the CLI: the engine classifies, never the surface — full review Pb2).
      return spec.createFeature(pdir, args.name, args.tracks, args.summary, undefined, args.lang, args.kind, { brownfield: args.brownfield === true, flow: args.flow, question: args.question, timebox: args.timebox,
        reproduction: args.reproduction, rootCause: args.rootCause, condition: args.condition, behaviour: args.behaviour, includeBody: args.includeBody === true, // flow (C3), question / timebox (C2 spike), the bugfix prefill + bodies (1.21 F3)
        size: args.size }); // 1.21 F5: the feature's size (= `create --size`)
    }
    case "spec_list":
      return spec.listFeatures(pdir);
    case "spec_status":
      return spec.statusFeature(pdir, args.name);
    case "spec_next_task":
      return spec.nextTask(pdir, args.name, { batch: args.batch, max: args.max, waves: args.waves === true }); // waves: = `next --waves`
    case "spec_task_brief":
      return spec.taskBrief(pdir, args.name, args.number, { write: args.write, includeBrief: args.includeBrief });
    case "spec_complete_task":
      return spec.completeTask(pdir, args.name, args.number, args.evidence, { undo: args.undo === true, reason: args.reason }); // undo (1.16 U1) = `dev-spec undone`
    case "spec_finish": // evidence (B5): the project checks' runs the agent reports — the server never runs them (`finish --run` does)
      return spec.finishFeature(pdir, args.name, { write: args.write, includeBody: args.includeBody, evidence: args.evidence });
    case "ears_validate":
      return !args.text && args.name ? spec.earsFeature(pdir, args.name) : spec.earsValidate(args.text, args.lang || spec.projectLang(pdir));
    case "trace_check":
      return spec.traceCheck(pdir, args.name, { code: args.code === true, matrix: args.matrix === true }); // same call as `dev-spec trace <f> [--code] [--matrix]`
    case "spec_doctor":
      return spec.specDoctor(pdir, args.name);
    case "spec_approve": // role: the sign-off's role (approvals by role); through: the fast-forward — the same engine call as `approve [--role] [--through]`
      return spec.approvePhase(pdir, args.name, args.phase, args.by, { force: args.force === true, role: args.role, ...(args.through != null ? { through: args.through } : {}),
        reason: args.reason, expires: args.expires, revoke: args.revoke === true, // 1.16 U2 / U3: revoke · the waiver (reason / expires) — = `approve --revoke / --reason / --expires`
        ...(extra && extra.dryRun === true ? { dryRun: true } : {}), ...(extra && extra.confirmation ? { confirmation: extra.confirmation } : {}), // 1.21 F1b: never tool arguments — the elicitation's preview and the user's confirmation
        ...(extra && TYPE_CHECK.object(extra.preview) ? { preview: extra.preview } : {}) }); // 1.22 review: what that preview judged — the engine refuses another version
    case "steering_scaffold":
      return spec.scaffoldSteeringFile(pdir, args.file, args.lang);
    case "spec_roadmap": // html:true implies writing; a failed write is an error (same engine call as the CLI)
      return spec.roadmapReport(pdir, { write: args.write, html: args.html, lang: args.lang });
    case "spec_backlog":
      return spec.backlog(pdir, args.action, args.name, args.note);
    case "spec_depend":
      return spec.setDependency(pdir, args.name, args.dependsOn, args.order, { add: args.add, remove: args.remove });
    case "spec_milestone": // 1.16 E3 — the same engine call as the CLI's `milestone [add <name> <date> <features…> | rm <name> | list]`
      return spec.milestone(pdir, args.action, { name: args.name, date: args.date, features: args.features });
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

    case "spec_import": // the engine refuses a path outside the project (same call as the CLI's `import`); text: 1.16 C4 (`import plan -`)
      return spec.importSpec(pdir, args.tool, args.path, { name: args.name, tracks: args.tracks, lang: args.lang, text: args.text });

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

    case "spec_templates": // the same engine call as the CLI's `templates [list|init|check] [artifact] [--lang]`
      return spec.templates(pdir, args.action, { artifact: args.artifact, lang: args.lang });
    case "spec_tracks": // the same engine call as the CLI's `tracks [list|init <name>|check] [name] [--lang]` / `signals [list|set|forget] …`
      return spec.trackPacks(pdir, args.action, { name: args.name, lang: args.lang, op: args.op, track: args.track, word: args.word, effect: args.effect });

    case "spec_export": // the same engine call as the CLI's `export [feature] [--md|--csv|--gherkin|--tracker jira|linear] [--write]`
      return spec.exportSpecs(pdir, { name: args.name, format: args.format, write: args.write === true });
    case "spec_changelog": // the same engine call as the CLI's `changelog [--since …] [--write]`
      return spec.changelog(pdir, { since: args.since, write: args.write === true, milestone: args.milestone });

    case "spec_decide": // the same engine call as the CLI's `decide <f> --title … --decision … [--affects …] [--supersedes …] [--discovery]`
      return spec.decide(pdir, args.name, { title: args.title, decision: args.decision, context: args.context, consequences: args.consequences,
        affects: args.affects, supersedes: args.supersedes, kind: args.kind });
    case "spec_stop_check": // 1.16 U4: the Stop hook's decision for MCP-only clients — the same engine call as `dev-spec stop-check --json`
      return spec.stopCheck(pdir, { message: args.message, agent: typeof args.agent === "string" ? args.agent : "" });
    case "spec_log": // 1.16 U4: the git log TEXT the client supplies (this server never runs git) — the same engine call as `dev-spec log <f> - [--max N]`
      return spec.taskCommits(pdir, args.name, args.gitLog, { max: args.max });
    default:
      throw new Error("Unknown tool: " + name);
  }
}

// --- JSON-RPC / MCP plumbing ----------------------------------------------

let batchSink = null; // while handling a batch, replies are collected and sent as ONE array
// One outgoing message = one line. JSON.stringify leaves U+2028 / U+2029 raw inside strings (legal JSON), and a client
// that frames our replies with Node's readline (or any splitter honouring the Unicode line separators) cut such a reply
// in two — so both go out as their JSON escapes (backslash-u 2028 / 2029: the same value). The class is built from char
// codes: a raw U+2028 in a regex literal (or a comment) is a line terminator.
const RE_UNICODE_LINE_SEP = new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]", "g");
function frame(msg) {
  return JSON.stringify(msg).replace(RE_UNICODE_LINE_SEP, (c) => "\\u" + c.charCodeAt(0).toString(16)) + "\n";
}
function send(msg) {
  sendTo(batchSink, msg);
}
// A reply to a request that finished LATER (an approval waiting for the user — 1.21 F1b) goes where its request came from: the
// batch it arrived in (the batch's reply array waits for it) or straight out.
function sendTo(sink, msg) {
  if (sink) sink.push(msg);
  else process.stdout.write(frame(msg));
}

// --- Human approvals over MCP elicitation (1.21 F1b) --------------------------------------------------------------------------
// With roadmap.json meta.approvalGuard ask | deny, an AGENT's approval — spec_approve (approve, revoke, fast-forward, force /
// waiver), spec_feature remove {confirm}, spec_init lowering a protection: the approval guard's own reading of the call
// (spec.approvalGuardDecision) — is the human's to make. In Claude Code the plugin's PreToolUse hook asks / refuses (and
// mcp/servers.json sets SPEC_MCP_APPROVAL_HOOK=on: the server leaves `ask` to the hook — that path is unchanged; a `deny`-level
// call that still reaches the server got past no hook — it is handled below as in any client, 1.22 review). In any other
// MCP client:
//   · the client advertised `elicitation` in initialize → the server asks its user (elicitation/create: the actions, the
//     gate's state — forced checks, the waiver, the phases of a fast-forward — and a boolean `approve` + an optional `note`)
//     and runs the call only on an explicit accept with approve: true, recording `confirmed` {via: "elicitation", at, note?}
//     with the approval; decline / cancel / no answer within DEV_SPEC_ELICIT_TIMEOUT_MS (default 5 min) → a localized
//     refusal (`declined: true`), nothing recorded. The wait never blocks the server: other requests are answered meanwhile.
//     spec_approve is previewed first (dryRun): a gate that refuses anyway is answered as it is — nobody is asked;
//   · no elicitation: ask → today's behaviour (the call runs); deny → refused (`humanRequired: true` + the command the human
//     runs in their own terminal) — a client that can't ask its user can't record an agent's approval.
// A guardrail on the approve paths, as the hook is — never a sandbox.
const APPROVAL_TOOLS = new Set(["spec_approve", "spec_feature", "spec_init"]);
const APPROVAL_HOOK = /^(?:on|1|true|yes)$/i.test(String(process.env.SPEC_MCP_APPROVAL_HOOK || "").trim());
const ELICIT_TIMEOUT_MS = (() => {
  const n = Number(String(process.env.DEV_SPEC_ELICIT_TIMEOUT_MS || "").trim());
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, 60 * 60 * 1000) : 5 * 60 * 1000;
})();
let clientElicits = false; // initialize: the client declared capabilities.elicitation
// Requests this server sent the client (elicitation/create), by id → the resolver of their response.
const serverRequests = new Map();
let serverRequestSeq = 0;
function clientRequest(method, params, timeoutMs) {
  return new Promise((resolve) => {
    const rid = "dev-spec-" + ++serverRequestSeq;
    const timer = setTimeout(() => {
      if (!serverRequests.delete(rid)) return;
      process.stdout.write(frame({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: rid, reason: "timeout" } }));
      resolve({ timeout: true });
    }, timeoutMs);
    serverRequests.set(rid, (msg) => { clearTimeout(timer); resolve(msg); });
    process.stdout.write(frame({ jsonrpc: "2.0", id: rid, method, params })); // never into a batch reply: the client must see it now
  });
}
// roadmap.json meta as the approval hook reads it: {} without a roadmap, undefined when it can't be read or parsed (unknown —
// the guard's guard-down reading fails closed).
function approvalMeta(pdir) {
  let text;
  try { text = fs.readFileSync(path.join(spec.specsRoot(pdir), "roadmap.json"), "utf8"); } catch (e) { return e && e.code === "ENOENT" ? {} : undefined; }
  try {
    const j = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    return TYPE_CHECK.object(j) ? (TYPE_CHECK.object(j.meta) ? j.meta : {}) : undefined;
  } catch { return undefined; }
}
// null → run the call as usual · { refuse } → that result · { elicit, … } → ask the user first.
function approvalPolicy(toolName, args) {
  if (!APPROVAL_TOOLS.has(toolName)) return null;
  if (args.projectDir && (RE_DOTDOT.test(String(args.projectDir)) || isNetworkPath(args.projectDir))) return null; // runTool refuses it
  const pdir = spec.resolveProjectDir(args.projectDir);
  const level = spec.approvalGuardLevel(pdir);
  if (level === "off") return null;
  // SPEC_MCP_APPROVAL_HOOK=on (the Claude Code plugin): its PreToolUse hook asks — the server never asks twice. But at `deny` the
  // hook refuses every agent approval, so one that reaches the server means the hook did not run (disableAllHooks, a managed
  // policy, a hook that failed open): deny must still refuse here (1.22 review) — it is "refused in every mode".
  if (APPROVAL_HOOK && level !== "deny") return null;
  let lang = spec.projectLang(pdir);
  if (typeof args.name === "string" && args.name.trim()) {
    const f = spec.existingFeature(pdir, args.name);
    if (f.ok) lang = spec.featureLang(pdir, f.slug);
  }
  // plain (1.21 review A4): this client is not Claude Code (its hook would have answered — SPEC_MCP_APPROVAL_HOOK), so the command
  // the user runs is the plain line, never `! …` (Claude Code's prefix: a PowerShell user can't run it), and the reason says so.
  const d = spec.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: toolName, tool_input: args }, level, { lang, meta: approvalMeta(pdir), plain: true });
  if (d.decision === "allow") return null;
  if (clientElicits) return { elicit: true, level, decision: d, lang };
  if (level === "deny") return { refuse: { ok: false, refused: true, humanRequired: true, approvalGuard: "deny", command: d.command, error: d.reason } };
  return null; // ask, and the client can't ask its user: today's behaviour
}
// Ask the user, then run the call only on an explicit approve. → the tool's result, or a refusal ({ok: false, declined: true, …}).
async function elicitApproval(toolName, args, pol) {
  const E = spec.msg(pol.lang).elicit;
  const list = pol.decision.summary || "";
  const details = [];
  let preview = null;
  if (toolName === "spec_approve") {
    const pre = runTool(toolName, args, { dryRun: true });
    if (!pre || pre.ok === false || !pre.dryRun) return pre; // refused, an error, nothing to do: the engine's own answer — nobody is asked
    // 1.22 review: the user judges THIS version — up to minutes pass before they answer; what is recorded must be what they saw
    // (the same content, per phase for a fast-forward, and — forced — no check failing that the question didn't name).
    if (!pre.revoke) preview = Array.isArray(pre.chain) ? { chain: pre.chain, fingerprints: pre.fingerprints }
      : Object.assign({ fingerprint: pre.fingerprint == null ? null : pre.fingerprint, failing: Array.isArray(pre.failing) ? pre.failing : [] }, pre.designFingerprint ? { designFingerprint: pre.designFingerprint } : {});
    if (Array.isArray(pre.chain)) details.push(E.phases(pre.chain.join(", ")));
    if (Array.isArray(pre.failing) && pre.failing.length) details.push(E.forced(pre.failing.join(", ")));
    else if (!pre.revoke && !pre.chain) details.push(E.gatePasses);
    if (pre.waiver) details.push(E.waiver(pre.waiver.reason, pre.waiver.expires));
  } else if (toolName === "spec_feature") {
    // remove's own preview (no confirm): a feature that doesn't exist is answered as it is — nobody is asked
    const pre = spec.manageFeature(spec.resolveProjectDir(args.projectDir), "remove", args.name, undefined, { confirm: false });
    if (pre && pre.ok === false && !pre.needsConfirm) return pre;
  }
  const res = await clientRequest("elicitation/create", {
    message: E.message(list, details.join(" ")),
    requestedSchema: {
      type: "object",
      properties: {
        approve: { type: "boolean", title: E.approveTitle, description: E.approveDesc, default: false },
        note: { type: "string", title: E.noteTitle, description: E.noteDesc, maxLength: 500 },
      },
      required: ["approve"],
    },
  }, ELICIT_TIMEOUT_MS);
  const refusal = (extra, error) => Object.assign({ ok: false, declined: true, approvalGuard: pol.level }, extra, { error });
  if (res.timeout) return refusal({ timedOut: true }, E.timedOut(String(ELICIT_TIMEOUT_MS / 1000), list));
  if (TYPE_CHECK.object(res.error)) {
    const why = String(res.error.message || res.error.code || "?").slice(0, 200);
    return refusal({ elicitationError: { code: res.error.code, message: why } }, E.failed(why, list));
  }
  const r = TYPE_CHECK.object(res.result) ? res.result : {};
  const answer = TYPE_CHECK.object(r.content) ? r.content : {};
  if (r.action !== "accept" || answer.approve !== true) {
    const action = ["accept", "decline", "cancel"].includes(r.action) ? r.action : "cancel";
    // 1.21 review A6: an accept without approve: true is its own answer (the user replied, Approve left unticked) — not "declined"
    return refusal({ action }, action === "cancel" ? E.cancelled(list) : action === "accept" ? E.unapproved(list) : E.declined(list));
  }
  const note = typeof answer.note === "string" ? answer.note.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  const confirmation = Object.assign({ via: "elicitation", at: new Date().toISOString() }, note ? { note } : {});
  const out = runTool(toolName, args, Object.assign({ confirmation }, preview ? { preview } : {}));
  // 1.21 review A6: `confirmed` goes with a call that ran — never onto a failed one (a fast-forward stopped by a later gate, an
  // error): the phases it did approve carry their own `confirmed` in .state.json.
  if (TYPE_CHECK.object(out) && out.ok !== false) out.confirmed = Object.assign({}, confirmation, { message: E.confirmed });
  return out;
}
function toolReply(id, out, sink) {
  sendTo(sink, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: !!(out && out.ok === false) } });
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } });
}

// Required arguments per tool, straight from the advertised inputSchema — a missing `name` must be an
// error, not a folder called "undefined".
// Groups of arguments of which ONE is required — a schema's `required` can't say "path or text" (spec_import, 1.16 C4): none
// given → the group's first name is reported missing, as a required key would be.
const REQUIRED_ONE_OF = { spec_import: [["path", "text"]] };
// Required string arguments for which an empty (or whitespace-only) value is a real value, not "not given" (1.16 U review 5):
// an empty git log is what `git log` prints in a repository without commits (→ 0 commits), an empty closing message claims
// nothing (→ no-claim) — the CLI's `log <f> -` / `stop-check --message ""` accept them, so MCP does too.
const EMPTY_OK = { spec_log: ["gitLog"], spec_stop_check: ["message"] };
function missingArgs(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool || !tool.inputSchema || !Array.isArray(tool.inputSchema.required)) return [];
  const emptyOk = hasOwn(EMPTY_OK, toolName) ? EMPTY_OK[toolName] : [];
  const given = (k) => !(args[k] === undefined || args[k] === null || (typeof args[k] === "string" && !args[k].trim() && !emptyOk.includes(k)));
  const missing = tool.inputSchema.required.filter((k) => !given(k));
  for (const group of hasOwn(REQUIRED_ONE_OF, toolName) ? REQUIRED_ONE_OF[toolName] : []) if (!group.some(given)) missing.push(group[0]);
  return missing;
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
// user-driven: neither is restricted. (A drive letter mapped to a share can't be told apart without I/O.) The rule is the
// engine's (spec.isNetworkPath — the status line and the plan-mode hook skip such a folder too, 1.16).
const isNetworkPath = spec.isNetworkPath;
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
    // A mixed-case member ("pt-BR") folds too, and a `lang` alias takes its canonical code (pt_BR / ptbr → pt-BR, pt-PT → pt).
    const member = s.enum.find((e) => typeof e === "string" && e.toLowerCase() === v) || (s.enum === LANG_ENUM ? spec.canonicalLang(v) : null);
    if (member && member !== args[k] && s.enum.includes(member)) {
      if (out === args) out = { ...args };
      out[k] = member;
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
    case "completion/complete": { // 1.16 C3: feature slugs, artifact / steering names — an unknown ref or argument is Invalid params
      const r = content.complete(pdir, p, { lang, prompts: PROMPTS_ON });
      if (!r.ok) return error(id, -32602, r.error);
      return result(id, { completion: r.completion });
    }
    default:
      return error(id, -32601, "Method not found: " + method);
  }
}

function handle(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return error(null, -32600, "Invalid Request");
  const { id, method, params } = msg;
  // A notification is a message WITHOUT an id member: it never gets a response — and never runs anything.
  if (!hasOwn(msg, "id")) return;
  // A JSON-RPC RESPONSE (result / error, no method) is never answered — whatever its id: a client's error response to a
  // request it couldn't parse carries id null (checked before the id rule, full review R9). One that answers a request THIS
  // server sent (elicitation/create — 1.21 F1b) resolves it.
  if (typeof method !== "string" && (hasOwn(msg, "result") || hasOwn(msg, "error"))) {
    const cb = typeof id === "string" ? serverRequests.get(id) : undefined;
    if (cb) { serverRequests.delete(id); cb(msg); }
    return;
  }
  // MCP: a request id is a string or an integer, never null. `id: null` used to be read as a notification and dropped (the
  // client waited forever), and an object / array / boolean / fractional id was echoed back. Invalid Request — with id
  // null, as JSON-RPC answers a request whose id can't be used.
  if (!(typeof id === "string" || Number.isInteger(id))) return error(null, -32600, "Invalid Request: the id must be a string or an integer");
  if (typeof method !== "string") {
    // A JSON-RPC RESPONSE (result / error, no method) is no request: never answered (this server sends no requests).
    if (hasOwn(msg, "result") || hasOwn(msg, "error")) return;
    return error(id, -32600, "Invalid Request: method must be a string"); // it was -32601 "Method not found: undefined"
  }

  try {
    switch (method) {
      case "initialize": {
        const asked = params && params.protocolVersion;
        const proto = SUPPORTED_PROTOCOLS.includes(asked) ? asked : asked ? SUPPORTED_PROTOCOLS[SUPPORTED_PROTOCOLS.length - 1] : DEFAULT_PROTOCOL;
        // 1.21 F1b: a client that can ask its user (capabilities.elicitation) gets the approval guard's questions (elicitation/create).
        clientElicits = TYPE_CHECK.object(params) && TYPE_CHECK.object(params.capabilities) && TYPE_CHECK.object(params.capabilities.elicitation);
        return result(id, {
          protocolVersion: proto,
          serverInfo: SERVER_INFO,
          // completions (1.16 C3): completion/complete for the prompts' feature argument and the specs:// template variables.
          capabilities: PROMPTS_ON
            ? { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false, subscribe: false }, completions: {} }
            : { tools: { listChanged: false }, resources: { listChanged: false, subscribe: false }, completions: {} },
          instructions:
            "Local spec-driven engine. Use spec_classify to pick tracks, spec_init to scaffold steering, spec_create to scaffold a feature, then spec_status / spec_next_task / spec_complete_task to drive execution (spec_task_brief builds a self-contained brief per task for subagent execution). Evidence before claims: tick a task (spec_complete_task) only with the run of its _Verify:_ command that you or the user actually made — if you cannot run it, ask for its output instead of ticking (never send a subagent to look for a shell). A CLI line you give the user is the runnable one the tools print — `" + spec.DEV_SPEC + " …` (a plugin install has no `dev-spec` on PATH). ears_validate, trace_check and spec_doctor enforce quality gates. Approvals are the user's: with meta.approvalGuard ask / deny, spec_approve asks the user through the client (elicitation) when it can. After a plugin update, spec_upgrade audits an existing .specs/ (apply: the safe migrations). All file ops are local to the project's .specs/ directory." +
            (PROMPTS_ON ? " Prompts: one per plugin command (spec, spec-status, spec-impact, …) — the slash-command workflow for clients without the dev-spec-driven skill." : "") +
            " Resources (read-only): the project's spec artifacts — specs://roadmap, specs://catalog, specs://steering/{file}, specs://feature/{slug}/{artifact}.",
        });
      }
      case "ping":
        return result(id, {});
      case "tools/list":
        return result(id, { tools: TOOLS });
      case "prompts/list": case "prompts/get": case "resources/list": case "resources/templates/list": case "resources/read":
      case "completion/complete":
        return handleContent(id, method, params);
      case "tools/call": {
        const toolName = TYPE_CHECK.object(params) ? params.name : undefined;
        // No such tool — or no params / no name at all: JSON-RPC Invalid params (-32602), as MCP specifies for an unknown
        // tool. It used to be a SUCCESSFUL result {isError: true, "ERROR: Unknown tool: nope"}. Localized (project language).
        if (typeof toolName !== "string" || !TOOLS.some((t) => t.name === toolName)) {
          const A = argMessages(TYPE_CHECK.object(params) && TYPE_CHECK.object(params.arguments) ? params.arguments : undefined);
          return error(id, -32602, typeof toolName === "string" && toolName.trim() ? A.unknownTool(toolName) : A.noTool);
        }
        const rawArgs = params.arguments;
        if (rawArgs != null && !TYPE_CHECK.object(rawArgs)) return argError(id, argMessages().notObject);
        const args = foldEnumArgs(toolName, rawArgs || {});
        const missing = missingArgs(toolName, args);
        if (missing.length) return argError(id, argMessages(args).missing(missing.join(", ")));
        const invalid = invalidArgs(toolName, args);
        if (invalid.length) {
          const A = argMessages(args);
          return argError(id, A.invalid(invalid.map((i) => A.item(i.where, expectedType(i.schema, A), shortJson(i.value))).join("; ")));
        }
        // 1.21 F1b: an agent's approval under meta.approvalGuard ask | deny — asked of the user (elicitation: the reply comes
        // later, the server keeps answering meanwhile) or refused (deny, a client that can't ask).
        const policy = approvalPolicy(toolName, args);
        if (policy && policy.elicit) {
          const sink = batchSink;
          return elicitApproval(toolName, args, policy).then((o) => toolReply(id, o, sink),
            (e) => sendTo(sink, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "ERROR: " + ((e && e.message) || String(e)) }], isError: true } }));
        }
        let out;
        try {
          out = policy && policy.refuse ? policy.refuse : runTool(toolName, args);
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

// One incoming line = one message: a JSON value, or a batch (an array) answered with ONE array.
function onLine(line) {
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
    const replies = [];
    let later = [];
    batchSink = replies;
    try {
      later = msg.map(handle).filter((p) => p && typeof p.then === "function");
    } finally {
      batchSink = null;
      // ONE array reply — once the requests still waiting (an approval the user is asked about, 1.21 F1b) have answered too.
      const flush = () => { if (replies.length) process.stdout.write(frame(replies)); };
      if (later.length) Promise.all(later).then(flush, flush);
      else flush();
    }
  } else handle(msg);
}

// Framing: messages end at "\n" ONLY (one trailing "\r" is dropped — CRLF clients). Node's readline also ended a line at
// U+2028 / U+2029 (and at a lone "\r"); both separators are legal RAW inside JSON strings — JSON.stringify emits them as
// they are (text pasted from Word / Docs / PDF) — so a valid request was cut in two, answered with two -32700 id:null
// errors and never answered itself (the client hung). Bytes go through a StringDecoder: a multibyte UTF-8 character split
// across two chunks stays whole.
function main() {
  process.stdout.on("error", onStdoutError);
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let scanned = 0; // pending[0, scanned) holds no "\n": a long message arriving in many chunks is scanned once
  const drain = () => {
    let nl;
    while ((nl = pending.indexOf("\n", scanned)) >= 0) {
      const line = pending.slice(0, nl);
      pending = pending.slice(nl + 1);
      scanned = 0;
      onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
    }
    scanned = pending.length;
  };
  process.stdin.on("data", (chunk) => {
    pending += typeof chunk === "string" ? chunk : decoder.write(chunk);
    drain();
  });
  // stdin closed: a last line without its newline is still a message; then exit once the replies already written have
  // flushed. On Linux a pipe takes writes asynchronously once its 64 KB buffer is full, and a bare process.exit() dropped
  // the queued replies — a client that sends its requests and closes stdin (`printf … | node mcp/server.js | jq`) lost the
  // tail of a large answer. A stdin read error ends the session the same way (it used to be an unhandled 'error' event).
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    pending += decoder.end();
    drain();
    if (pending) onLine(pending.endsWith("\r") ? pending.slice(0, -1) : pending);
    pending = "";
    process.stdout.write("", () => process.exit(0));
  };
  process.stdin.on("end", close);
  process.stdin.on("error", close);
}

main();

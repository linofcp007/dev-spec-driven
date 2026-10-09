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
const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];

// --- Tool catalogue --------------------------------------------------------

// Every tool's projectDir (1.24 r6 A5): spec_init's says how the folder is chosen (tools/call → projectDirArg); every other tool
// carries one short shared text — 37 copies of a longer one would cost ~2k characters of the description budget (tools/list
// stays under 76,000 characters: mcp/tests/02-mcp-server.js).
const PROJECT_DIR_INIT = Object.freeze({ type: "string", description: "Project folder, an existing one (only spec_init creates one): a path or a local file:// URI. Default: SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR, else the client's first root (MCP roots), else the nearest folder up from the server's cwd with a .specs/, else that cwd. Relative: from the client's first root when roots chose the default, else from the cwd; an unexpanded $VAR / %VAR% / ${VAR} counts as not given." });
const PROJECT_DIR = Object.freeze({ type: "string", description: "Project folder" });

const TOOLS = [
  {
    name: "spec_init",
    description:
      "Initialize the spec-driven structure: create `.specs/steering/` and the steering files the given tracks need (constitution/product/tech/structure always; testing-standards for +tdd; scale/observability/cost for +saas; ai-strategy for +ai; security for +sec; privacy for +privacy; distributed for +dist; api for +api; ui for +ui; observability for +obs; data for +data). `lang` (en/pt/pt-BR/es — pt = European, pt-BR = Brazilian Portuguese) writes the steering in that language and becomes the project default (roadmap.json meta.lang, inherited by every new feature). Project settings, each optional (omit = unchanged), stored in roadmap.json meta and always reported back: `guard` (on | off | scope — the plugin's PreToolUse hook asks before a code edit while no feature has approved, unfinished tasks; scope also asks for a file no open task names in _Implements:_), `stopCheck` (the end-of-turn evidence gate, on by default), `approvalGuard` (off | ask | deny — approvals become a human act: an agent's spec_approve, spec_feature remove or lowering this guard is asked of the user, or refused at deny), `checks` (the project's named check commands — every task brief lists them, and spec_finish then needs a passing recorded run of each since the feature's last task activity), `evidence` (reported | observed — observed: a runnable _Verify:_ counts only from a run the harness saw or the CLI made) and `approvalRoles` (phase → the roles that must each sign it off). Idempotent — never overwrites existing files.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack (spec_tracks); 'tdd,saas' / '+saas +ai' are split" }, description: "Tracks in use across the project. 'core' is always included." },
        lang: { type: "string", enum: LANG_ENUM, description: "Project language for generated steering + tool messages (default en). Becomes the project default." },
        guard: { type: "string", enum: ["on", "off", "scope"], description: "Guard mode: \"on\" = code edits ask while no feature has approved, unfinished tasks; \"scope\" = also, once tasks are approved, a code file no open task names in _Implements:_; \"off\". true / false mean on / off. Omit to leave it unchanged." },
        evidence: { type: "string", enum: ["reported", "observed"], description: "\"reported\" (default) — reported runs verify as given; \"observed\" — a runnable _Verify:_ (and a project check) counts only from a run the harness observed or the CLI made (done --run / finish --run). Omit to leave it unchanged." },
        stopCheck: { type: "boolean", description: "The end-of-turn evidence gate (on by default): the Stop hook sends a turn back when its closing message claims done / verified while a recently active feature has unverified ticks. Omit to leave it unchanged." },
        approvalGuard: { type: "string", enum: [...spec.APPROVAL_GUARD_LEVELS], description: "The human approval guard (default off): \"ask\" = an agent's approval (spec_approve, spec_feature remove, lowering this guard — or the same through the shell) asks the user first; \"deny\" = refused — the human runs it themselves. In MCP clients without the plugin's hook this server enforces it (elicitation, else deny refuses). Omit to leave it unchanged." },
        checks: { type: "object", additionalProperties: { type: "string" }, description: "Project check commands {name: command}, e.g. {\"test\": \"npm test\"}: names letters, digits, . _ : - (≤ 40), one-line commands (≤ 500 chars), at most 20; an empty command removes one, the others are kept. Omit to leave them unchanged." },
        approvalRoles: { type: "object", description: "Approvals by role: {<phase>: [<role>, …]} (a \"tech+security\" string is split); {} clears them. Omit to leave them unchanged." },
        projectDir: PROJECT_DIR_INIT,
      },
    },
  },
  {
    name: "spec_classify",
    description:
      "Heuristically classify a feature description into the track set (core +tdd? +saas? +ai? +sec? +privacy? +dist? +api? +ui? +obs? +data?, plus the project's track packs — spec_tracks) from local keyword signals (EN/PT/ES) — no LLM, no cost. Returns the recommended tracks, matched signals and reasoning, plus a suggested size (suggestedSize xs | s | m | l, sizeReason, sizeNote) and, for Brazilian Portuguese wording, `langHint: 'pt-BR'` (lang stays 'pt' — pass lang 'pt-BR' to spec_init / spec_create then): confirm it with the human and pass it to spec_create {size} — nothing applies a size by itself. Use it to seed Phase 0; the human still approves — then pass the tracks they chose to spec_create: a choice that differs from this suggestion is recorded, and after 2 consistent corrections the project's .specs/classifier.json overrides those words here (`overrides`; spec_tracks {action: 'signals'} lists / sets / forgets them). `explain: true` lists every keyword match.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Plain-language description of the feature/request." },
        name: { type: "string", description: "Optional feature name (also used as evidence)." },
        lang: { type: "string", enum: LANG_ENUM, description: "Language of the notes/reasoning. Default: the description's own language." },
        explain: { type: "boolean", description: "Also return `explain`: every keyword match and the project's signal overrides." },
        projectDir: PROJECT_DIR, // its track packs and signal overrides apply
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
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack (spec_tracks); 'tdd,saas' / '+saas +ai' are split" }, description: "Active tracks ('core' always added). Omit to auto-classify from name + summary (same as the CLI) — confirm with the human in Phase 0." },
        summary: { type: "string", description: "Optional one-line feature summary." },
        size: { type: "string", enum: [...spec.FEATURE_SIZES], description: "The feature's size, the rigor it gets (spec_classify suggests one; confirm it in Phase 0): 'xs' = a CHANGE (kind 'change'): ONE change.md — summary, 1–3 EARS criteria, the approach, 1–3 tasks with _Verify:_ — core only, two approvals (the plan, then the execution sign-off); 's' = one story, the weigh sections merged, only the core-tier track sections, the plan approved in one call; 'm' / 'l' = the full chain, duplicate sections of two active tracks merged. A new feature only; omit = the classic scaffold. Every size keeps EARS, trace, the evidence gate, the bugfix iron law, phase order and the finish gate." },
        kind: { type: "string", enum: ["feature", "bugfix", "spike", "change"], description: "'feature' (default). 'bugfix' — the systematic-debugging flow: bug.md (reproduction · root cause · fix — gated by the requirements / design approvals), a one-story requirements.md (IF…THEN), a regression test plan and two tasks: the failing regression test (_Expect: fail_), then the fix; always +tdd. 'spike' — a timeboxed investigation that ends in a decision: spike.md (Question · Timebox · Options · Evidence · Decision with _Outcome: go | no-go | pivot_) and a few investigation tasks, no requirements / design / tasks gates (doctor fails `decision` until it is written). 'change' — size xs (see size). Prototype code lives outside .specs/." },
        question: { type: "string", description: "kind 'spike' only: the question it answers → spike.md → Question (default: summary). Create-only." },
        timebox: { type: "string", description: "kind 'spike' only: its end — a date (YYYY-MM-DD) or a duration from today (3d, 2w, 8h) → spike.md → Timebox (**Until:** YYYY-MM-DD). Create-only." },
        reproduction: { type: "string", description: "kind 'bugfix' only: the exact steps / input / environment that reproduce the bug → bug.md → Reproduction (≤ 20000 characters). Create-only (an existing bug.md is left alone: `prefillSkipped`)." },
        rootCause: { type: "string", description: "kind 'bugfix' only: the root cause WITH its evidence → bug.md → Root Cause — only once you know it (the iron law holds: the human still approves bug.md before any fix). Create-only." },
        condition: { type: "string", description: "kind 'bugfix' only: the trigger of the regression criterion — US-1.AC-1 becomes `IF <condition> THEN THE SYSTEM SHALL <behaviour>`. One line, ≤ 500 characters." },
        behaviour: { type: "string", description: "kind 'bugfix' only: the correct behaviour → the THEN clause of US-1.AC-1 and bug.md → Expected. One line, ≤ 500 characters; left out, it stays a slot." },
        includeBody: { type: "boolean", description: "Return the body of every artifact this call created as `bodies` {file: text} — no need to read the files back." },
        lang: { type: "string", enum: LANG_ENUM, description: "Language for the generated artifacts. Defaults to the project language (roadmap.json meta.lang), else en." },
        brownfield: { type: "boolean", description: "The feature lands in an EXISTING codebase: also scaffold integration-plan.md (integration points, modifications, sequencing, risks)." },
        flow: { type: "string", enum: [...spec.FLOWS], description: "Phase order: 'design-first' = classification → design → requirements → test / eval plan → tests → tasks (work that starts from an architecture); 'requirements-first' (default). A new feature only (later: spec_feature {action: 'flow'}); a bugfix ignores it." },
        branch: { type: "string", description: "'true' or a name: the feature's own git branch (default feature/<slug>; fix/, spike/ by kind), recorded with its base — run the returned branch.command yourself (this server never runs git)." },
        projectDir: PROJECT_DIR,
      },
      required: ["name"],
    },
  },
  {
    name: "spec_list",
    description: "List all features under `.specs/`, each with its detected tracks, current phase, and task progress (done/total).",
    inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_status",
    description: "Detailed status for one feature: its kind (feature / bugfix / spike / change) and flow (requirements-first / design-first), active tracks, phase, artifacts present, task progress and next task, plus +saas scale-section completeness, +ai eval/prompt state and the +sec / +privacy / +dist / +api / +ui / +obs / +data section completeness (secSections / privacySections / distSections / apiSections / uiSections / obsSections / dataSections).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_next_task",
    description: "Return the next task for a feature (its number and text) — the first open task, in task-number order, whose `_Depends:_` tasks are all done — plus remaining/total counts. With dependencies in play: `skipped` [{number, waitsOn}] (open tasks passed over) and `blocked` (open tasks that can never start: a cycle, a _Depends:_ naming no task); none able to start → next null + a localized note (fix the _Depends:_ markers; spec_doctor fails `task-deps`). `batch: true` also returns the following open [P] tasks of the same section that can run beside it (declared, disjoint _Implements:_ files, dependencies done; max 3 by default) — for parallel subagents in separate worktrees. `waves: true` returns the execution waves of every open task (`waves` [[numbers…]] — a wave's tasks can run at once: their dependencies done or in earlier waves, no shared _Implements:_ file; a task without _Implements:_ or an +ai prompt task runs alone), plus `cycles` and `blocked`.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, batch: { type: "boolean", description: "Also return the parallel batch." }, max: { type: "integer", minimum: 1, maximum: 8, description: "Batch size cap (default 3, max 8)." }, waves: { type: "boolean", description: "Also return the execution waves of the open tasks (+ cycles, blocked)." }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_task_brief",
    description:
      "A self-contained brief for ONE task (default: the next task by spec_next_task's rule — none able to start → task null, `blocked` and a note; an explicit number resolves like spec_complete_task: the first OPEN task of a duplicated number) so a fresh implementer can execute it without reading the whole spec: the task text with its story / phase / [P], the full EARS text of every AC it cites, the test-plan row of every T-ID it names, its `_Verify:_` command — the evidence its report must carry (`verifyPipes` flags one that pipes: a pipeline's exit code is its LAST command's) —, `_Expect: fail_` (`expect: \"fail\"`: its run must FAIL), its `_Depends:_` with each one's status, the tasks.md Global Constraints, the design sections and decisions that mention it, the steering that applies (the defaults, `inclusion: always` files and `fileMatch` files matching its _Implements:_ paths; `manual` ones listed), the glossary entries its text uses, a Reuse section (the design's Reuse & Integration entries for it and the existing files next to its _Implements:_ targets — search before you write), the project checks (`projectChecks`) and the definition of done for its loop (core / tdd / ai-prompt — +ai prompt tasks are `inlineOnly`). BUGFIX: bug.md's Reproduction and Root Cause; while Root Cause is unfilled a task after the root-cause task (none: after task 1) comes back `gated` (spec_complete_task would refuse it). In the feature's language. `write: true` writes .specs/<feature>/.execution/task-<N>-brief.md (+ an append-only ledger.md) and returns the paths and the task's identifiers (`refs`) — the basis of subagent-driven execution; the spec text is then left out unless includeBrief.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        number: { type: "integer", minimum: 0, description: "Task number (≥ 0). Omit for the next open task." },
        write: { type: "boolean", description: "Write the brief to .specs/<feature>/.execution/ and return paths + the task's identifiers (the brief markdown and the spec text it quotes are omitted unless includeBrief)." },
        includeBrief: { type: "boolean", description: "Include the brief markdown and the full structured result (AC texts, test rows, design sections, steering) (default: true when not writing, false when writing)." },
        projectDir: PROJECT_DIR,
      },
      required: ["name"],
    },
  },
  {
    name: "spec_finish",
    description:
      "Close a feature (finishing-a-development-branch): a readiness report plus a merge title + summary GENERATED FROM THE SPEC CHAIN. `readyToFinish` is true only without `blockers`: doctor fails, an artifact changed since its approval, template placeholders, a bugfix's unwritten Root Cause, no tasks or open tasks, ticked tasks without passing verification evidence (`unverified`), with project checks (roadmap.json meta.checks) a check without a passing recorded run since the feature's last task activity (`suite-evidence`, each check in `suiteChecks`), and phases awaiting approval. `evidence` [{name, command, exitCode, summary}] records the project checks as YOU ran them (each a meta.checks name; run the configured command from the project root — another command reads `changed`) BEFORE the readiness is computed, so one call can make the feature ready; a failed run is recorded too and stays a blocker; returned as `recordedChecks` with `observed` (true when the plugin's Bash hook saw that run; \"cli\" for `" + spec.DEV_SPEC + " finish <f> --run`). `warnings` never block (uncovered EC / NFR / SC IDs, planned T-IDs no test file names); `checks` lists the track-gated items only a fresh run or a human can confirm. `write: true` writes the summary to .specs/<feature>/.execution/merge-summary.md (content omitted unless includeBody), and a READY feature records its drift baseline (`baseline` — spec_drift compares against it later). Integration is LOCAL: the human picks merge locally or keep the branch — no pull requests, no CI; it never merges, pushes or approves by itself. A green run is EVIDENCE, not the sign-off: after it, ask the user for an explicit yes on the `execution` phase before calling spec_approve — never promise to approve it once they paste a passing run.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, write: { type: "boolean", description: "Write the merge summary to .specs/<feature>/.execution/merge-summary.md." }, includeBody: { type: "boolean", description: "Include the merge summary in the result (default: true when not writing, false when writing)." }, evidence: { type: "array", description: "The project checks' runs (roadmap.json meta.checks) — the server never runs them: run each configured command and report it here. Needs meta.checks; validated all-or-nothing.", items: { type: "object", properties: { name: { type: "string", description: "A meta.checks name." }, command: { type: "string", description: "The command that ran." }, exitCode: { type: "integer", description: "Its exit code." }, summary: { type: "string", description: "e.g. '212 passing' or the last lines of output." }, commit: { type: "string", description: "Optional: the git commit it ran on." }, dirty: { type: "boolean", description: "Optional, with commit: uncommitted changes outside .specs/." } }, required: ["name", "command", "exitCode"] } }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_complete_task",
    description:
      "Mark task N as done in a feature's tasks.md — EVIDENCE BEFORE CLAIMS. BEFORE calling it: if the task has a runnable _Verify:_ command and you have NOT run it yourself (no shell in this session), do NOT call this tool at all — not bare, not with a summary-only note, never with an exit code you did not see: name the _Verify:_ command and ask the user for its output (or to run `" + spec.DEV_SPEC + " done <feature> <n> --run` — that exact line: a plugin install puts no `dev-spec` on PATH), then record what they report; never send a subagent to look for a shell. Tick with a note only when the user explicitly asks for an UNVERIFIED tick. \"I finished it, mark it done\" is a claim, not a run. Pass `evidence` {command, exitCode, summary} — the run you actually made (stamped `observed`: true when the plugin's Bash hook saw it). A non-zero exitCode REFUSES the tick and stays recorded; an exit code alone, or a command without its exit code, is rejected. EVIDENCE GATE: a runnable _Verify:_ counts as verified only with {command, exitCode: 0} where `command` IS its _Verify:_ command (several: all of them in ONE run joined with ` && `; a prefix the _Verify:_ holds must stay) — another command ticks it unverified (command-mismatch), and so does a summary-only note (a task without a runnable _Verify:_ may be attested by a note). The result carries `verified`; whenever it is false, a stable `unverifiedReason` (e.g. no-evidence · failed-run · stale-evidence · command-mismatch) plus a localized note; doctor, spec_finish and ROADMAP.md list such an unverified task with its localized reason. A task with no runnable _Verify:_ and nothing recorded is verified with `nothingToVerify: true` (nothing was run or attested) — doctor, spec_finish and ROADMAP.md pass it too (never listed as unverified). RED → GREEN: an `_Expect: fail_` task is proven by a FAILING run of its _Verify:_; a pass is refused (`unexpectedPass`) until its red run is on record; a run that never reached the test (exit 126 / 127 / 9009, a missing test file — `couldNotRun`) is refused. A piped command → `pipeMasked: true`. Bugfix: a task after the root-cause task (none: after task 1) is refused until bug.md's Root Cause is filled. A task ticked before its `_Depends:_` are done gets `waitsOn`. UNDO: `undo: true` (+ a one-line `reason`) unticks task N instead of editing tasks.md — its evidence turns stale (a re-tick needs a NEW run).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, number: { type: "integer", minimum: 0 }, evidence: { type: "object", properties: { command: { type: "string" }, exitCode: { type: "integer" }, summary: { type: "string", description: "e.g. '14/14 passing' or the last lines of output" }, commit: { type: "string", description: "Optional: the git commit the run was made on (`git rev-parse --short HEAD`) — `dev-spec done --run` records it." }, dirty: { type: "boolean", description: "Optional, with commit: the working tree had uncommitted changes outside .specs/." } }, description: "Verification actually run for this task." }, undo: { type: "boolean", description: "Untick task N instead (no evidence): its evidence turns stale, a re-tick needs a new run (CLI: dev-spec undone <feature> <n>)." }, reason: { type: "string", description: "With undo: why the tick is undone (one line, ≤ 500 characters) — recorded in .state.json unticks (CLI: --reason)." }, projectDir: PROJECT_DIR }, required: ["name", "number"] },
  },
  {
    name: "ears_validate",
    description: "Lint EARS acceptance criteria, one logical criterion at a time (wrapped lines and list continuations are joined; HTML comments and fenced code are skipped): flags criteria missing a modal verb (SHALL / DEVE / DEBE), missing a stable ID (US-1.AC-1; EC-1, NFR-1 and SC-001 count too — a bare AC-1 does not: trace_check reads US-n.AC-m only), vague words (fast, user-friendly, appropriate, … in EN/PT/ES), template placeholders still in a criterion ([trigger], [behavior] …), a missing EARS keyword, and every open [NEEDS CLARIFICATION]. Pass `text` directly, or `name` to lint that feature's requirements.md. Each issue has a stable `code` (no-modal · no-id · vague · placeholder · no-keyword · needs-clarification · padded-id), a severity (only no-modal is an error, which makes the verdict fail), the criterion's `line` (+ `endLine` when it spans several) and a `msg` in the feature's language (or `lang` for raw text).",
    inputSchema: { type: "object", properties: { text: { type: "string" }, name: { type: "string" }, lang: { type: "string", enum: LANG_ENUM }, projectDir: PROJECT_DIR } },
  },
  {
    name: "trace_check",
    description: "Verify traceability for a feature, both directions. GAPS decide `verdict`: criteria with no US-n.AC-m ID (`unidentifiedCriteria`; 0 ACs is never a pass), ACs no task cites (`uncoveredByTasks`), phantom AC / T-IDs in tasks, on +tdd ACs without a test-plan row (`uncoveredByTests`) and test-plan rows citing undefined ACs (`phantomAcsInTests`), and `_Implements:_` files that don't exist (`missingImplFiles` — a file named only by OPEN tasks is the plan, `plannedImplFiles`). Informational: `supersedes` / `phantomSupersedes`, `removedAcs` (phantom IDs a recorded change request removed — delete or update what still cites them), `testsNotMappedToTasks`. WARNINGS (never the verdict): `justifiedTestGaps` (ACs the test plan lists only as gaps / out of scope — still untested), `untracedCriteria` (modal criteria with no ID beside US-n.AC-m ones); EC-n / NFR-n need a task or a test-plan row, SC-nnn a test-plan row or quickstart.md. `code: true` also scans the project's test files (bounded, read-only) for the T-IDs and AC IDs they name — `code` (`plannedNotInCode`, `inCodeNotInPlan`…); a T-ID whose plan row names a test path counts only there. `matrix: true` adds `matrix`, the requirements traceability matrix (informational): one row per AC / EC / NFR / SC with its status — untraced (gaps no-task · no-test · no-coverage) · planned · implemented (every linked task done, one not verified) · verified — and its tasks + evidence, tests, design sections, decisions, supersedes and approval. CLI: dev-spec trace <f> --matrix (a table) or --csv; spec_export {format: 'csv'} writes it as a file.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, code: { type: "boolean", description: "Also scan test files (test/spec/__tests__ folders, .specs/<feature>/tests/, *.test.*, test_*.py, *_test.go, *Test.java, *Tests.cs, *Tests.fs, *Spec.scala …) for the T-IDs they name — put the T-ID in the test name: test(\"T-01 …\"), def test_T01_…, func TestT01…, [Fact(DisplayName=\"T-01 …\")] (CLI: --code)." }, matrix: { type: "boolean", description: "Also return `matrix`, the requirements traceability matrix (one row per AC / EC / NFR / SC: status, tasks + evidence, tests, design, decisions, approval) — CLI: --matrix (table) or --csv." }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_doctor",
    description: "One health-check that decides whether a feature is ready to advance a phase: per-check pass / warn / fail with stable ids, `readyToAdvance` (no fail) and `verdict`. FAIL: requirements / design missing, ears (a criterion without a modal verb or a US-n.AC-m ID), clarifications (open [NEEDS CLARIFICATION]), ac-uniqueness, placeholders (template text in the current or an earlier phase's artifact; a later phase's only warns), the active tracks' mandatory design sections present AND filled (saas-sections / ai-sections / sec-sections / privacy-sections / dist-sections / api-sections / ui-sections / obs-sections / data-sections / <pack>-sections), traceability (the gaps a later, still-template file would cause are deferred as a warn), task-deps, verify-control, change-scope, a bugfix's root-cause, a spike's question / decision, merge-conflicts. WARN: steering, success-criteria, priorities, mermaid, constitution-check, design-tradeoffs / design-risks / design-reuse, test-plan / eval-plan, secondary-trace, supersedes, tests-in-code, verification (ticked tasks without passing evidence, with the reason), red-green, suite-evidence, duplicate-tasks, unread-tasks, verify-pipes, integration-plan, changed-since-approval (names the spec_impact phases to diff), glossary, cross-feature-acs, cross-feature-overlap, steering-changed-since-approval (`steeringChanged`), decision-affects, waiver-expired, a spike's timebox. approval-gates: the pending phases, forced approvals with their failing checks, and what the next approval would refuse (`nextGate` {phase, ready, failing, missingRoles}). Also returns phase, approvals, pendingGates, forcedGates, gatesOk and summary.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_approve",
    description: "Record human approval of a phase gate for a feature (.state.json + a .history/ snapshot); a change has only tasks — its change.md — and execution. The approval is a GATE: that phase's checks run first and any failure REFUSES it, listing the failing check ids (requirements: EARS, placeholders, open clarifications, success criteria + priorities, AC uniqueness — bugfix: bug.md Reproduction; design: placeholders, Constitution Check, the active tracks' sections — bugfix: bug.md Root Cause; test-plan: placeholders, every AC has a test, no row citing an AC requirements.md does not define; eval-plan: placeholders; tests (Phase 4): +tdd every planned T-ID named by a test file, +ai a golden set of its own; tasks: no placeholder tasks, every AC covered, no phantom IDs; execution — spec_finish's blockers: state, doctor, root-cause, placeholders, changed-since-approval, tasks, open-tasks, verification, suite-evidence, approval-gates; a spike: spike, decision, open-tasks). An earlier unapproved phase refuses it (`phase-order`). `force: true` records it as forced — only when the user asked; a phase with no readable artifact can't be approved (`unreadable`). APPROVALS BY ROLE (roadmap.json meta.approvalRoles): a listed phase needs `role` and counts as approved only once every role signed off its CURRENT content (until then `missingRoles`; a tests / execution sign-off older than a change doesn't count; `sameSigner`: one person, two roles). FAST-FORWARD: `through` approves the active phases up to it in order, each through its gate, stopping at the first refusal. Only record an approval the user gave — an explicit yes for THAT phase (a passing test run, a ticked task or \"finish it\" / \"fix it\" is not one; `execution` too). With meta.approvalGuard ask / deny the plugin's hook asks the user before this call, or refuses it — then ask the user to run it themselves, never retry it another way. In other MCP clients the server asks through elicitation — recorded only on an explicit approve (`confirmed`; edited meanwhile: `changedSincePreview`); declined or unanswered → `declined: true`, nothing recorded — or, at deny without elicitation, refuses it (`humanRequired: true` + the `command` the user runs). WAIVERS: with `force`, `reason` (one line) and `expires` (UTC YYYY-MM-DD, or 30d) record why and until when. REVOKE: `revoke: true` (+ `reason`) removes `phase`'s approval — never cascades; on a per-role phase it names its `role` (before the approval: only that role's sign-off).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, phase: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"], description: "The phase to approve (or `through` for the fast-forward), or — with revoke — whose approval to revoke." }, through: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks"], description: "Fast-forward: approve every active phase from the first unapproved one up to this one, in order, each through its gate." }, role: { type: "string", description: "The role this sign-off (or, with revoke, this revocation) is for, when roadmap.json meta.approvalRoles lists the phase." }, by: { type: "string", description: "Approver (default: $USER / $USERNAME, else 'user')." }, force: { type: "boolean", description: "Approve even though the phase's checks fail — recorded as forced, with the failing check ids." }, reason: { type: "string", description: "With force: why the gate is waived; with revoke: why the approval is revoked. One line, ≤ 500 characters." }, expires: { type: "string", description: "With force: when the waiver expires — YYYY-MM-DD (today or later in UTC) or Nd (e.g. 30d), at most 3650 days." }, revoke: { type: "boolean", description: "Revoke the approval of `phase` (and its waiting role sign-offs) instead — never cascades." }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "steering_scaffold",
    description: "Create one steering file from its template (constitution.md, product.md, tech.md, structure.md, testing-standards.md, scale.md, observability.md, cost.md, ai-strategy.md, security.md, privacy.md, distributed.md, api.md, ui.md, data.md, glossary.md) — or a CUSTOM scoped steering file for any other name matching ^[a-z0-9][a-z0-9-]{0,62}\\.md$ (not a Windows device name such as nul.md): a stub with Kiro-compatible front matter (`inclusion: always | fileMatch | manual`, `fileMatchPattern: \"src/api/**\"`) — spec_task_brief includes `always` files and the `fileMatch` files matching a task's _Implements:_ paths, and lists `manual` ones. glossary.md (never created by spec_init) is the product's ubiquitous language, one entry per term — `- **Customer** — a person or company with a signed contract. _Avoid: client, user_` (the `_Avoid:_` marker stays English): spec_clarify and spec_doctor flag the avoided words, task briefs quote the entries they use. In `lang` (default: the project language). Idempotent — never overwrites.",
    inputSchema: { type: "object", properties: { file: { type: "string", description: "A known template name, or a custom name like api-conventions.md." }, lang: { type: "string", enum: LANG_ENUM }, projectDir: PROJECT_DIR }, required: ["file"] },
  },
  {
    name: "spec_roadmap",
    description: "Show the multi-feature roadmap: each feature's tracks, phase, completion % (planning phases up to 30%, then the fraction of tasks done), dependencies and blocked status (a dependency is met at 100%), the overall % and any circular dependency. `write: true` (re)generates .specs/ROADMAP.md (Markdown with the Mermaid dependency graph — git-friendly); `html: true` also writes a self-contained .specs/ROADMAP.html (offline, light/dark); `lang` localizes the chrome only (meta.roadmapLang). A same-named file dev-spec did not generate is never overwritten (`errors`). FORECASTS: `velocity` = points completed per working day over the last 28 days (a task's `_Size: XS|S|M|L|XL_` = 1/2/3/5/8 points); each feature's `forecast` → `eta` + `range` (±25%) in working days after its unfinished dependencies, or eta null with a `reason` (not-enough-data · no-tasks · dependency · cycle · done). OVERLAPS: `overlaps` = active features whose open tasks plan the same files (_Implements:_), unless ordered by a dependency or declared with _Supersedes:_ (spec_doctor warns cross-feature-overlap). MILESTONES: `milestones` with their status (spec_milestone).",
    inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR, write: { type: "boolean", description: "(Re)write .specs/ROADMAP.md (default format)." }, html: { type: "boolean", description: "Also (re)write the brand-styled .specs/ROADMAP.html." }, lang: { type: "string", enum: LANG_ENUM, description: "Language for the roadmap chrome." } } },
  },
  {
    name: "spec_backlog",
    description: "Manage the backlog — planned features that don't have a `.specs/<feature>/` folder yet (so the roadmap's 'what's left' includes work not yet started). Actions: 'add' (name + optional note — one line, at most 2,000 characters, else add is refused and nothing is written; a name that already has an active feature folder is refused — it is specced, not planned; a name already in the backlog, compared case-insensitively, keeps its entry and the new note is APPENDED to its note — one line, joined with ' · ', a note it already holds changes nothing, the whole note at most 2,000 characters (past it add is refused: file it under another name) — the result then carries `exists: true`, `appended` and a localized `note`; give separate items distinct names), 'rm' (alias 'remove'), or omit / 'list' to list. Stored in .specs/roadmap.json.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: spec.BACKLOG_ACTIONS.slice() }, name: { type: "string" }, note: { type: "string" }, projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_depend",
    description: "Show or edit a feature's dependencies and/or order in .specs/roadmap.json. `dependsOn` REPLACES the list ([] clears it); `add` / `remove` edit it incrementally; `order` sets the position; `name` alone only returns the current dependencies (nothing is written). Every dependency must be an existing feature. Rejects changes that would create a circular dependency. Use for 'feature X depends on Y' or 'do X before Y' (set order).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, dependsOn: { type: "array", items: { type: "string" }, description: "Replaces the list with these feature slugs ([] clears it)." }, add: { type: "array", items: { type: "string" }, description: "Feature slugs to add to the current list." }, remove: { type: "array", items: { type: "string" }, description: "Feature slugs to remove from the current list." }, order: { type: "integer", description: "Optional explicit ordering position." }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_milestone",
    description: "Milestones — named target dates for a set of features (roadmap.json meta.milestones [{name, date, features}]; nothing is sent anywhere). `action`: 'list' (default) — every milestone with its status; 'add' — name + date (YYYY-MM-DD) + features (≥ 1 existing ACTIVE feature; each item is one feature name, 'a,b' is split) — an existing name (compared case- and accent-insensitively) is UPDATED (`updated: true`); 'rm' (alias 'remove') — by name. A feature's rename / remove / archive is followed (archive → the milestone's `archived` list; restore puts it back). STATUS (stable codes) against the roadmap forecasts: done · late (the date passed, a feature not done) · at-risk — `reason` eta-after-date · eta-unknown (listed in `unknownEta`) · no-features — · on-track. Each milestone: {name, date, features, archived?, status, reason?, done, total, open, eta}, plus `today` and localized `lines`. ROADMAP.md shows a Milestones table; spec_changelog {milestone} scopes the release notes to one. A name: letters, digits, spaces and . _ : # ( ) + - (≤ 60 characters); at most 50 milestones of 200 features.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: spec.MILESTONE_ACTIONS.slice(), description: "list (default) | add | rm (alias remove)." }, name: { type: "string", description: "The milestone's name (add / rm)." }, date: { type: "string", description: "Its target day, YYYY-MM-DD (add)." }, features: { type: "array", items: { type: "string" }, description: "Its features — existing active feature names, one per item (add; replaces the active list of an existing milestone)." }, projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_scan",
    description: "Brownfield: heuristic, bounded, read-only scan of an EXISTING codebase (no model, no cost) — the file inventory by extension, top-level modules, stack + web frameworks, HTTP routes with method + path + file:line (the common Node, Python, Java, .NET, Ruby, PHP and Go frameworks; `candidateEndpoints` counts them all), test frameworks + test-file count, entrypoints, the environment variable NAMES the code reads (never values; .env itself is never read) and migration / schema files. Nested manifests count in a monorepo; the folders the root .gitignore excludes and testdata/ are skipped. A projectDir that is not a folder is an error. Interpret it to infer the steering / constitution and reverse-engineer specs.",
    inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR, cap: { type: "integer", minimum: 1, description: "Max code / manifest files to scan (default 5000; images, docs and data don't count). `truncated`: a code file was left unscanned." } } },
  },
  {
    name: "spec_coverage",
    description: "Brownfield: how much of the codebase is covered by specs — the share of code files (test files reported apart) named in any `_Implements:_` marker (a file, a folder or a glob) of any feature, active or archived, with a per-top-level-folder breakdown (`byFolder`), the uncovered folders, per-feature counts, the _Implements:_ entries that name nothing on disk (`unmatchedImplements`) and those naming an existing test or non-code file (`nonCodeImplements`, informational). `coveragePercent` = covered code files / code files; `documented`/`undocumented` = folders with at least one / no covered file. It skips what spec_scan skips (the root .gitignore's generated folders, testdata/); a projectDir that is not a folder is an error.",
    inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_clarify",
    description: "Surface ambiguities and gaps in a feature's requirements BEFORE design: vague terms, leftover placeholders / TBD (with file:line), missing edge-case / NFR / out-of-scope sections, missing IF…THEN failure paths and track-specific gaps (tenant isolation, AI quality / cost, access denial, data subject rights…). Returns the clarification questions to ask the user — what the feature's kind and size ask (a change: only its own change.md; size s: no edge-case / NFR question). With .specs/steering/glossary.md, every avoided word (`_Avoid:_`) used in requirements.md / design.md is a question naming the term to use (`glossary`). When the requirements / design name queues, events, webhooks, concurrency, transactions or retries but state no consistency model, delivery guarantee or idempotency, ONE question asks for them (`nudges` consistency-unstated; not with +dist).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_next_action",
    description:
      "\"You are here, do this next.\" ONE recommendation for a feature, phase by phase — `step`: first `fix` with `stateInvalid: true` when .state.json can't be read (repair or restore it); then re-review (an artifact changed after ITS approval: re-review it, never ship it silently; `impact` names the spec_impact phases to diff; a deleted approved artifact is named in `missingApproved` — restore it or revoke that approval) → for the FIRST active phase not approved yet (classification, requirements, design, test-plan, eval-plan, tests, tasks — or a design-first feature's order, `flow`): fill (`file`) → fix (`refusedGate` {phase, failing}) → approve, the next phase starting only after that approval → fix (a check still failing, e.g. after a forced approval) → implement (the next open task) → verify (a ticked task not verified: the recommendation names each with its reason and how to record a passing run) → finish (run spec_finish) → finished (asks for the execution sign-off) or drift (implementing files changed since the finish — spec wrong → spec_impact, code wrong → fix, harmless → re-finish); `tasks` when there are none yet. A finished feature that changed since its finish answers finish again (`staleBaseline`). Also returns phase, tracks, the doctor verdict, gatesOk, pendingGates, changedSinceApproval, `steeringChanged` and the localized `recommendation`. Use it to resume work or answer 'what now?'.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_add_track",
    description:
      "Escalate an EXISTING feature to a new track (+tdd, +saas, +ai, +sec, +privacy, +dist, +api, +ui, +obs or +data) - additive only, never overwrites. Scaffolds just the missing artifacts (test-plan.md/tests/, eval-plan.md/prompts/evals/, load-test.md), appends that track's mandatory design.md sections and template tasks, adds its steering files, updates classification.md's Active Tracks line and persists the track set in .state.json. `track` takes one or several ('saas,ai', '+saas +ai'); an unknown track is an error with a did-you-mean. With `remove: true` the track is turned OFF instead - non-destructive: no file is deleted, the result lists the now-inactive artifacts, and doctor/status/next_action stop requiring them ('core' can't be removed; a bugfix keeps +tdd). Use when a feature grew into needing tests, scale, AI, security or privacy work after it was created (or no longer does).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, track: { type: "string", description: "tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack (spec_tracks) - or several: 'saas,ai' / '+sec +privacy'." }, remove: { type: "boolean", description: "Turn the track(s) off instead (files are kept, listed as inactive)." }, projectDir: PROJECT_DIR }, required: ["name", "track"] },
  },
  {
    name: "spec_feature",
    description:
      "Manage a feature's lifecycle: archive (move it to .specs/_archive/<slug>/, out of the active roadmap; the features that depended on it are named in `dependentsPruned`, with a warning when it was not complete), restore (move it back with its roadmap entry and dependencies; those that no longer exist are listed in `skipped`), rename (slug, folder and roadmap key, with every reference updated — dependsOn lists, other features' `_Supersedes: <old>/US-n.AC-m_` markers, archive records), flow (the phase order: 'design-first' | 'requirements-first'; approved phases stay approved; a bugfix is refused) or remove (delete .specs/<slug>/ — destructive: needs `confirm: true`; without it nothing is deleted and the result, an error with needsConfirm, lists what would be; prefer archive, reversible with restore). Every action keeps roadmap.json consistent and regenerates the roadmap (and SPECS.md). A folder another process is updating is never moved or deleted: the action waits, then answers `busy`.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["remove", "archive", "rename", "restore", "flow"] }, name: { type: "string" }, newName: { type: "string", description: "New name (required for action 'rename')." }, flow: { type: "string", enum: [...spec.FLOWS], description: "The phase order (required for action 'flow')." }, confirm: { type: "boolean", description: "Must be true for action 'remove' (deletion is permanent). Ignored by archive/rename/restore/flow." }, projectDir: PROJECT_DIR }, required: ["action", "name"] },
  },

  {
    name: "spec_import",
    description:
      "Import a spec written for another tool as a NEW dev-spec feature (never over an existing feature; the source is only read). `tool`: 'kiro' (.kiro/specs/<name>/), 'spec-kit' (specs/<nnn-name>/ — spec.md, plan.md, tasks.md), 'openspec' (openspec/specs/<capability>/ or openspec/changes/<id>/), 'plan' (a Markdown plan — Claude Code plan mode, a Cursor .cursor/plans/*.plan.md), 'execplan' (a Codex ExecPlan), 'bmad' (BMAD PRD + stories, or one story file) or 'fluidplan' (a .fluidplan/<id>/ folder, its plan.json, PLAN.md or DECISIONS.md); 'kiro-steering' (.kiro/steering/*.md) / 'cursor-rules' (.cursor/rules/*.mdc, .cursorrules) write .specs/steering/ files instead (path optional; an existing name is skipped, never overwritten). Each scenario becomes ONE EARS criterion where possible (else kept with [NEEDS CLARIFICATION]); IDs are remapped to US-N.AC-M (`mapping` {oldId: newId}); tasks are renumbered keeping their ticks, [P] / [USn] tags, _Implements:_, _Verify:_ and _Depends:_; decisions go to decisions.md / design.md; every artifact notes 'Imported from <tool> <path> on <date>'. `path`: a document or folder inside the project, never in a hidden folder but the tools' own (several plans in a folder: name the file); `text` (plan / execplan / fluidplan only, instead of path) is the document itself — e.g. a Claude Code plan, kept in ~/.claude/plans OUTSIDE the project. Tracks: `tracks`, else auto-classified. `dryRun: true` writes nothing: the same result plus `preview` (each file, bounded). Returns {feature, files, mapping, counts, warnings}.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", enum: ["kiro", "spec-kit", "openspec", "plan", "execplan", "bmad", "fluidplan", "kiro-steering", "cursor-rules"], description: "The format of the source spec." },
        path: { type: "string", description: "The spec's folder or file, relative to the project root or absolute — inside the project. Required unless `text` is given." },
        text: { type: "string", description: "tool 'plan' / 'execplan' / 'fluidplan' only, instead of `path`: the document's markdown itself (fluidplan: its PLAN.md, DECISIONS.md may follow) — e.g. an approved Claude Code plan, kept in ~/.claude/plans outside the project. The result then has inline: true, source: null." },
        name: { type: "string", description: "Feature name (default: the source's title, else its folder or file name). An existing feature with that slug is an error." },
        tracks: { type: "array", items: { type: "string", description: "core | tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack (spec_tracks); 'tdd,saas' / '+saas +ai' are split" }, description: "Active tracks ('core' always added). Omit to auto-classify from the imported requirements." },
        lang: { type: "string", enum: LANG_ENUM, description: "Language of the generated artifacts (headings, notes). Defaults to the project language, else en. The imported text itself is kept as written." },
        dryRun: { type: "boolean", description: "Write nothing." },
        projectDir: PROJECT_DIR,
      },
      required: ["tool"], // + `path` or `text` (not for a steering tool) — the engine says which is missing (a schema can't express "one of")
    },
  },

  {
    name: "spec_append_tasks",
    description:
      "Converge: append NEW tasks to a feature's tasks.md without touching the tasks already there (never renumbered or edited): numbered after the highest number in use, under a phase heading (default the localized 'Phase: Convergence', created with a closing **Checkpoint:**; an existing heading with that text is reused). Each task becomes `- [ ] N. [USn][P] text` with its `_Requirements:_` / `_Makes green:_` / `_Implements:_` / `_Verify:_` / `_Expect: fail_` / `_Size:_` / `_Depends:_` sub-lines, so every other tool works on it as on any task. Every AC ID must exist in requirements.md, every T-ID be planned in test-plan.md, every `depends` name an active task or one of this call (never itself, no cycle), every path be project-relative — else an error and NOTHING is written. New content invalidates an earlier tasks approval (`needsReapproval`): review and re-approve. Use it when implementation drifted from the plan or a review found follow-up work.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        tasks: {
          type: "array",
          description: "The tasks to append, in order.",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "Task description (required)." },
              requirements: { type: "array", items: { type: "string" }, description: "AC IDs it proves (_Requirements:_, e.g. US-1.AC-2)." },
              implements: { type: "array", items: { type: "string" }, description: "Project-relative files it touches (_Implements:_)." },
              verify: { type: "string", description: "One-line command that proves it (_Verify:_)." },
              makesGreen: { type: "array", items: { type: "string" }, description: "T-IDs it makes green (_Makes green:_, e.g. T-01)." },
              expectFail: { type: "boolean", description: "_Expect: fail_ — its proof is a FAILING run (a test written before its fix)." },
              size: { type: "string", description: "_Size:_ XS | S | M | L | XL." },
              depends: { type: "array", items: { type: "integer", minimum: 0 }, description: "_Depends:_ — the task numbers to finish first." },
              story: { type: "string", description: "US<n> (e.g. US1) or shared." },
              parallel: { type: "boolean", description: "[P] — can run in parallel." },
            },
            required: ["text"],
          },
        },
        heading: { type: "string", description: "Phase heading to append under (default: the localized 'Phase: Convergence')." },
        projectDir: PROJECT_DIR,
      },
      required: ["name", "tasks"],
    },
  },

  {
    name: "spec_impact",
    description:
      "Change request: what an edit made AFTER an approval touches — the current artifact vs the snapshot its latest approval saved (.specs/<feature>/.history/). `phase`: 'requirements' (default): added / modified / removed ACs (and SC / EC / NFR IDs) by stable ID, each with the tasks citing it, the T-IDs covering it and the design sections naming it; 'design': the changed ## sections (a bugfix: bug.md + design.md) and the tasks citing an ID they name; 'test-plan': the T-ID rows changed and the tasks making each green; 'eval-plan': the changed sections; 'tasks': added / removed / changed task numbers; a change (kind change): its change.md, phase 'tasks'; 'steering' (read-only, `name` optional — omitted: project-wide): the features approved under a steering file that changed since. An approval with no snapshot → `baseline: 'fingerprint-only'` (changed or not) or 'none' (unknown); a phase never approved is an error. `reopen: true` (requirements / design / test-plan / eval-plan): unticks the affected DONE tasks (never a REMOVED criterion's — those come back in `retire` [{id, tasks, tests}] to delete or repoint), marks their evidence stale, records the change request in .state.json `changes` and refreshes the roadmap — it never edits the spec; review, then re-approve.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug (optional only with phase 'steering': omitted = every active feature)." },
        phase: { type: "string", enum: ["requirements", "design", "test-plan", "eval-plan", "tasks", "steering"], description: "Which approved artifact to compare (default requirements — a change: tasks, its change.md); 'steering' lists the features approved under steering that changed since." },
        reopen: { type: "boolean", description: "requirements / design / test-plan / eval-plan (not tasks — except a change's plan): untick the affected done tasks, mark their evidence stale and record the change request." },
        projectDir: PROJECT_DIR,
      },
    },
  },
  {
    name: "spec_metrics",
    description:
      "Metrics & retrospective, derived locally from .state.json, .history/ and the artifacts (no model, no cost). With `name`: the lead time in hours from creation to the first approval of each phase (classification → requirements → design → test-plan/eval-plan → tests → tasks), to complete (all tasks done) and to finished (the earliest of the first execution approval and the finish spec_finish {write} recorded on a ready feature); rework (re-approvals — a lower bound for approvals made before the change history, `reworkLowerBound`), forced approvals, change requests and reopened tasks, the evidence pass rate, tasks done / total and open [NEEDS CLARIFICATION] markers. Without `name`: every feature plus averages / medians and totals. `velocity`: points per working day over the last 28 days (the rate the roadmap forecasts use). `write: true` (with `name`) creates a localized .specs/<feature>/retro.md pre-filled with the metrics (its proposed steering amendments are for human approval, never applied); never overwrites.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug. Omit for the whole project." },
        write: { type: "boolean", description: "Create .specs/<feature>/retro.md (needs name; never overwrites)." },
        projectDir: PROJECT_DIR,
      },
    },
  },

  {
    name: "spec_catalog",
    description:
      "Living catalog — 'what the system does today': every feature (active, complete / finished, archived) with its status, and every AC ID with a one-line EARS text. A criterion replaced by a later SHIPPED feature (the newer criterion declares `_Supersedes: <feature>/US-n.AC-m_`) is shown as superseded, naming its replacement; one a feature still in progress plans to replace reads 'to be superseded' and stays current. `crossAcs` {pairs, truncated}: criteria of two ACTIVE features that read alike (near-duplicate) or may contradict each other (SHALL vs SHALL NOT, different numbers) — a bounded heuristic. `write: true` (re)writes .specs/SPECS.md (AUTO-GENERATED; a hand-written SPECS.md is never overwritten — the result is then an error); once it exists, every roadmap refresh refreshes it. Without `write`: the structure plus the markdown.",
    inputSchema: { type: "object", properties: { write: { type: "boolean", description: "(Re)write .specs/SPECS.md (never over a hand-written one)." }, projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_drift",
    description:
      "Drift since finish: spec_finish {write: true} on a ready feature records a baseline (a sha1 of every file its `_Implements:_` markers name); spec_drift reports, per finished feature, the files changed, missing or now present since that baseline. `name` checks one feature (active or archived). Listed apart, never errors: `unbaselined` (no baseline), `reopened` (its tasks are open again) and `stale` (changed since its finish — a change request, a re-approval of changed content, a new _Implements:_ file: finish it again; one whose files also changed is in `features` and `drifted` too, verdict drift — decide on the drift first). An unreadable .state.json is reported in `errors` (verdict error), never as clean. Read-only; it hashes only the recorded files.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "One feature (active or archived). Omit for every feature." }, projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_upgrade",
    description:
      "After updating the plugin: audit the project's .specs/ against this engine's rules (read-only by default) and, with `apply: true`, run the safe migrations. The audit returns from / to / needsUpgrade (roadmap.json meta.specVersion) and, per ACTIVE feature: kind, tracks, phase, status, the doctor verdict with the failing / warning ids, pending gates, changed since approval, approvals without history, unverified tasks, drift, the next step, a `review` recommendation (critic · converge · none) and a `group` (blocked · attention · ok); plus `summary`, `plan` (what apply would change) and localized `lines`. `apply: true` never edits an artifact, approves, ticks or deletes anything: it saves inferred tracks, seeds the change history of approvals whose content still matches (.history/), completes .specs/.gitignore, stamps meta.specVersion once every feature migrated and writes .specs/UPGRADE.md (AUTO-GENERATED) — `migrations` says what it did; a second apply changes nothing.",
    inputSchema: { type: "object", properties: { apply: { type: "boolean", description: "Run the safe migrations and write .specs/UPGRADE.md (default: a read-only audit)." }, projectDir: PROJECT_DIR } },
  },

  {
    name: "spec_templates",
    description:
      "Project templates: a team's own scaffolds in .specs/templates/. `<artifact>.md` replaces the built-in template of classification, requirements, design, tasks, test-plan, eval-plan, load-test, quickstart, checklist, integration-plan, bug (bug.md), the bugfix variants bug-requirements / bug-test-plan / bug-tasks, the spike ones spike / spike-tasks or change (change.md — a change's one file); `<lang>/<artifact>.md` (en | pt | pt-BR | es) wins for features in that language; `steering/<file>.md` replaces a steering stub. Every scaffolder uses an override when present — create-only — with {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}} substituted; the active tracks' sections, criteria, task blocks and test rows are still appended unless the template already has them. A template's [bracketed] slots count as placeholders (doctor, approve). `action`: 'list' (default) — built-in vs project template per artifact for `lang`; 'init' — copy the built-in template(s) (`artifact`, or all) into .specs/templates/ (with `lang`: its <lang>/ folder) for editing, never overwriting; 'check' — validate them against the current rules (missing track sections, EARS / AC-ID problems, unknown {{variables}}, a bug.md without a Root Cause section…): {file, line?, code, severity, message} + a verdict pass | warn | fail. Nothing outside .specs/templates/ is read or written. Returns localized `lines`.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "init", "check"], description: "list (default) | init | check." },
        artifact: { type: "string", description: "One template: classification | requirements | design | tasks | test-plan | eval-plan | load-test | quickstart | checklist | integration-plan | bug | bug-requirements | bug-test-plan | bug-tasks | spike | spike-tasks | change | steering/<file>.md ('.md' optional). Omit for all." },
        lang: { type: "string", enum: LANG_ENUM, description: "list: the feature language to resolve for (default: the project language). init: copy the templates in this language into .specs/templates/<lang>/. check: only the templates that apply to it. Messages follow it." },
        projectDir: PROJECT_DIR,
      },
    },
  },

  {
    name: "spec_tracks",
    description:
      "Project-defined tracks (track packs): a team's own domain rigor (+a11y, +mobile…) beside the built-in core / tdd / saas / ai / sec / privacy / dist / api / ui / obs / data. A pack is .specs/tracks/<name>/ — track.json (name, [MARKER], title, classifier signals, its mandatory design sections, an optional steering file) plus optional markdown fragments (requirements.md, tasks.md, test-plan.md, checklist.md, steering.md; a <lang>/ subfolder wins). A VALID pack is a marker track everywhere — the scaffolds, spec_doctor '<name>-sections', the design gate, trace, status, the roadmap, task briefs, export and import; a bad pack is reported and ignored as a whole, never half-applied. A pack is data only — nothing in it runs. `action`: 'list' (default) — the built-in tracks and every pack with its validity; 'init' — scaffold a commented example pack (`name`, in `lang`; never overwrites); 'check' — validate every pack (or `name`): {file, line?, code, severity, message} + a verdict; 'signals' — the classifier's signal overrides in .specs/classifier.json (learned by spec_create from Phase 0 corrections, applied after 2 consistent ones): `op` 'list' (default) | 'set' (`track`, `word` — a literal word or phrase —, `effect` off | weak | strong; applies at once) | 'forget'. The full pack format: references/project-tracks.md. Returns localized `lines`.",
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
        projectDir: PROJECT_DIR,
      },
    },
  },

  {
    name: "spec_export",
    description:
      "Stakeholder export: ONE self-contained, offline, printable document for product, legal and clients. With `name`: that feature in its language — summary, user stories with their EARS acceptance criteria (superseded ones struck through), the requirements, the design (a bugfix: bug.md), the test plan, the tasks (done / verified), decisions, approvals and a traceability matrix. Without `name`: the whole project — the roadmap summary, each active feature's requirements digest and the living catalog. `format`: 'html' (default — light/dark, print-ready, every spec text escaped, no external URL), 'md', 'csv' (the requirements traceability matrix — RFC 4180, formula-safe, UTF-8 BOM; written as .rtm.csv), 'gherkin' (a .feature per feature: one Scenario per current criterion tagged @US-n.AC-m + its T-IDs, the EARS clauses as Given / When / Then verbatim — never invented behaviour; PT / ES in Gherkin's dialect), 'jira' | 'linear' (a CSV for the tracker's own importer: feature → stories → tasks; nothing is sent anywhere) or 'adr' (decisions.md as MADR files — ADR number = D-n, discoveries left out — in .specs/exports/adr/<feature>/; a write removes the generated ones no decision backs). Without `write` the document comes back as `content`; `write: true` writes .specs/exports/<feature|project>.<format> (AUTO-GENERATED marker) and returns `file` + `bytes` — a hand-written file, or one reached through a link, is never overwritten (an error). CLI: dev-spec export [feature] [--md | --csv | --gherkin | --adr | --tracker jira|linear] [--write].",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug. Omit for the whole project." },
        format: { type: "string", enum: spec.EXPORT_FORMATS.slice(), description: "Document format (default html)." },
        write: { type: "boolean", description: "Write .specs/exports/<feature|project>.<format> instead of returning the content (never over a hand-written file)." },
        projectDir: PROJECT_DIR,
      },
    },
  },
  {
    name: "spec_changelog",
    description:
      "Release notes generated from the spec data (no model, no git log). Added: features shipped since `since` (a finish recorded or the execution signed off), each with its summary and acceptance criteria; Changed: criteria superseded by a feature shipped since then, the change requests recorded since (spec_impact reopen) and shipped changes (kind 'change'); Fixed: bugfixes shipped since then, with the root cause from bug.md. `since`: an ISO date or timestamp, 'last' (default — roadmap.json meta.changelogAt, stamped by the last written notes) or 'all'. Returns added / changed / fixed, counts, since + sinceSource and the markdown. `write: true` writes .specs/RELEASE-NOTES.md (AUTO-GENERATED; a hand-written one is never overwritten) and stamps meta.changelogAt — nothing when there is nothing to report. `milestone`: only that milestone's features (since then defaults to 'all'; write → .specs/RELEASE-NOTES.<milestone>.md, meta.changelogAt untouched).",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "string", description: "ISO date / timestamp, 'last' (default: since the last written release notes) or 'all'." },
        milestone: { type: "string", description: "Only this milestone's features (since then defaults to 'all')." },
        write: { type: "boolean", description: "Write .specs/RELEASE-NOTES.md and stamp meta.changelogAt (nothing when there is nothing to report)." },
        projectDir: PROJECT_DIR,
      },
    },
  },

  {
    name: "spec_decide",
    description:
      "Decision log: append ONE entry to .specs/<feature>/decisions.md (created with a localized header when absent): `## D-<n> — <title>` with the English-stable markers _Kind: decision | discovery_, _Date:_, _Affects:_ and _Supersedes: D-n_, then the Context / Decision / Consequences paragraphs. Append-only, under the feature lock — an existing entry is never renumbered or rewritten. `affects` is validated against the feature (an AC ID defined in requirements.md, a planned T-ID, an EC / NFR / SC ID, else a design.md section heading — bug.md for a bugfix, spike.md for a spike): an unknown one is an error (`unknownAffects`) and nothing is written; `supersedes` must name entries already in the log. Task briefs, the merge summary, the export and the catalog show the log; spec_doctor warns when a decision names something that no longer exists, or came after the approval of what it affects (re-review with spec_impact). Returns {id, n, kind, title, affects, supersedes, at, file, created, message}.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug (a spike or a bugfix too)." },
        title: { type: "string", description: "One line — the decision in a few words (≤ 200 chars)." },
        decision: { type: "string", description: "What was decided (for a discovery: what was found). Markdown; multi-line allowed." },
        context: { type: "string", description: "Optional — why it had to be decided: the forces, the options weighed." },
        consequences: { type: "string", description: "Optional — what follows from it: what changes, what it rules out, the follow-up work." },
        affects: { type: "array", items: { type: "string" }, description: "Optional — what it touches: AC IDs (US-1.AC-2), T-IDs (T-03), EC / NFR / SC IDs, design section names as design.md spells them ('Data Models'; a heading holding a comma is named as it is)." },
        supersedes: { type: "array", items: { type: "string" }, description: "Optional — earlier entries this one replaces (D-1)." },
        kind: { type: "string", enum: ["decision", "discovery"], description: "decision (default) | discovery — a fact learnt while working." },
        projectDir: PROJECT_DIR,
      },
      required: ["name", "title", "decision"],
    },
  },
  {
    name: "spec_stop_check",
    description:
      "The end-of-turn evidence gate for MCP-only clients (no Stop hook, no shell) — the same decision as the plugin's Stop hook and `dev-spec stop-check --json`. BEFORE sending a closing message that says the work is done or verified, pass that message: `block: true` means it would be sent back — a recently active feature has ticked tasks without verification evidence (or, every task done, project checks without a passing run since the last task activity) — and `reason` lists them with what to record (spec_complete_task / spec_finish {evidence}); record the runs, or say plainly which items are NOT verified, then check again. `block: false` with a stable `why`: no-specs · off · no-claim · admitted · verified · no-recent. `agent: \"spec-implementer\"` checks an implementer's DONE report (its .execution/task-N-report.md must show each _Verify:_ command and the exit code it needs); `agent: \"spec-simplifier\"` a simplifier's (its simplify-report.md must end with a '## Final runs' section where every run passes and every project check ran; `why` simplify-ok · simplifier-evidence · no-changes · no-report). Read-only; it never runs anything.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The closing message you are about to send (its last 20 000 characters are read)." },
        agent: { type: "string", description: "Optional: the subagent type sending it — spec-implementer is checked on its task report, spec-simplifier on its simplification report (CLI: --agent)." },
        projectDir: PROJECT_DIR,
      },
      required: ["message"],
    },
  },
  {
    name: "spec_log",
    description:
      "Git-linked evidence for clients without a shell tool for dev-spec: per ACTIVE task of a feature, the commits whose message cites it, plus (+tdd) a red-first check — the same result as `dev-spec log <feature> --json`. THIS SERVER NEVER RUNS GIT (or any command): pass `gitLog`, the text of `git log --name-only --relative` that you or the user ran in the project (an empty gitLog — a repository without commits — is valid: 0 commits). A message cites task N when it names the feature (its slug) and \"task #N\" / \"#N\" (PT tarefa, ES tarea), or one of the task's T-IDs / AC IDs. Red-first: a task with _Makes green: T-xx_ committed before any commit touching a test file that names T-xx warns `impl-first`. Returns {commits, truncated, citing, tasks, redFirst, warnings, lines}; `max` = the --max-count the log was read with (a log that long is a full window).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        gitLog: { type: "string", description: "The output of `git log --name-only --relative` (e.g. with --max-count=1000), run in the project — never run by this server." },
        max: { type: "integer", minimum: 1, description: "Optional: the --max-count the log was read with (a log that long is a full window)." },
        projectDir: PROJECT_DIR,
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
// a read-only tool never touches .specs/ — mcp/test.js snapshots the tree around each). destructiveHint (MCP: false = "only
// additive updates"): every tool one of whose arguments removes or overwrites a record the user made (1.25.1, review 7 — only
// spec_feature carried it): spec_feature (remove deletes a feature folder), spec_export (adr: removes the generated ADR files no
// decision backs), spec_approve (revoke), spec_complete_task (undo), spec_impact (reopen unticks), spec_backlog / spec_milestone
// (rm), spec_depend (dependsOn replaces the list, [] clears it), spec_add_track (remove), spec_init (an empty check command removes
// it, approvalRoles {} clears them, a setting is overwritten) and spec_tracks (signals set overwrites / forget removes an override).
// The rest only add records or regenerate their own derived files (ROADMAP.*, SPECS.md, a brief, a merge summary). idempotentHint:
// a second identical call changes nothing more (a tick, an approval, an appended task or decision, finish's evidence each add a
// record: false). openWorldHint: false everywhere — local files only, no network, no command, no git.
const READ_ONLY = Object.freeze({ readOnlyHint: true, openWorldHint: false });
const writes = (idempotent, destructive) => Object.freeze({ readOnlyHint: false, destructiveHint: !!destructive, idempotentHint: idempotent, openWorldHint: false });
const TOOL_ANNOTATIONS = {
  spec_init: writes(true, true), spec_classify: READ_ONLY, spec_create: writes(true), spec_list: READ_ONLY, spec_status: READ_ONLY,
  spec_next_task: READ_ONLY, spec_task_brief: writes(true), spec_finish: writes(false), spec_complete_task: writes(false, true),
  ears_validate: READ_ONLY, trace_check: READ_ONLY, spec_doctor: READ_ONLY, spec_approve: writes(false, true), steering_scaffold: writes(true),
  spec_roadmap: writes(true), spec_backlog: writes(true, true), spec_depend: writes(true, true), spec_scan: READ_ONLY, spec_coverage: READ_ONLY,
  spec_clarify: READ_ONLY, spec_next_action: READ_ONLY, spec_add_track: writes(true, true), spec_feature: writes(true, true),
  spec_import: writes(true), spec_append_tasks: writes(false), spec_impact: writes(true, true), spec_metrics: writes(true),
  spec_catalog: writes(true), spec_drift: READ_ONLY, spec_upgrade: writes(true), spec_templates: writes(true), spec_tracks: writes(true, true),
  spec_export: writes(true, true), spec_changelog: writes(true), spec_decide: writes(false),
  spec_stop_check: READ_ONLY, spec_log: READ_ONLY, spec_milestone: writes(true, true),
};
// A tool missing from the table gets the protocol's own defaults spelled out (may write, may destroy, not idempotent) — the
// test fails on it anyway.
for (const t of TOOLS) t.annotations = Object.prototype.hasOwnProperty.call(TOOL_ANNOTATIONS, t.name) ? TOOL_ANNOTATIONS[t.name] : writes(false, true);

// --- Tool dispatch ---------------------------------------------------------

// The feature-lock wait (1.24 r6 A6). The engine is synchronous: a call waiting for a lock another LIVE process holds (a CLI
// `done`, another editor's server) froze the whole server — pings, every other tool, a pending approval's reply — for
// DEV_SPEC_LOCK_WAIT_MS (10 s by default). The server waits MCP_LOCK_WAIT_MS instead, then answers the usual localized busy
// refusal (retry in a moment); an explicit DEV_SPEC_LOCK_WAIT_MS (a slow network file system) still wins. Set in this process's
// env: the engine reads it at every acquisition (lockWaitMs), and the server starts no child process.
const MCP_LOCK_WAIT_MS = 2000;
if (!/^\d{1,7}$/.test(String(process.env.DEV_SPEC_LOCK_WAIT_MS || "").trim())) process.env.DEV_SPEC_LOCK_WAIT_MS = String(MCP_LOCK_WAIT_MS);

// extra (1.21 F1b — set by the server, never by a tool call): { dryRun } the preview before the user is asked,
// { confirmation } the user's answer (elicitation), recorded with the approval, and (1.22 review) { preview } what that dry run
// judged — the content fingerprint(s) and the failing checks the question showed: the engine refuses to record anything else.
// spec_feature remove (1.23): { preview: {fingerprint} } — the folder the question named; another one now is not deleted.
function runTool(name, args, extra) {
  args = args || {};
  // tools/call already checked projectDir (projectDirArg — and resolved it); these two stay as the last line before the engine.
  // Guard against RELATIVE traversal only: a tool call must not reach out of the project with `..`.
  // This is NOT a sandbox — an absolute projectDir is accepted by design (multi-project use), and the
  // engine confines every write to <projectDir>/.specs/. (The CLI, user-driven, is not restricted.)
  if (args.projectDir && RE_DOTDOT.test(String(args.projectDir))) {
    return { ok: false, error: argMessages().dotdot, code: "project-dotdot" };
  }
  // …nor reach out of the MACHINE: a network path is refused before any fs call (isNetworkPath).
  if (args.projectDir && isNetworkPath(args.projectDir)) {
    return { ok: false, error: argMessages().network(String(args.projectDir).trim()), code: "project-network" };
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
        size: args.size, branch: args.branch }); // 1.21 F5: the feature's size (= `create --size`); 1.25: its own git branch (= `create --branch`)
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
    case "spec_feature": // flow (C3): action 'flow' · preview (1.23, remove only — never a tool argument): the folder the user was asked about
      return spec.manageFeature(pdir, args.action, args.name, args.newName, { confirm: args.confirm === true, flow: args.flow,
        ...(extra && TYPE_CHECK.object(extra.preview) ? { preview: extra.preview } : {}) });

    case "spec_import": // the engine refuses a path outside the project (same call as the CLI's `import`); text: 1.16 C4 (`import plan -`)
      return spec.importSpec(pdir, args.tool, args.path, { name: args.name, tracks: args.tracks, lang: args.lang, text: args.text, dryRun: args.dryRun === true });

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

    case "spec_export": // the same engine call as the CLI's `export [feature] [--md|--csv|--gherkin|--adr|--tracker jira|linear] [--write]`
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
// spec_add_track (1.24 review 6, E3): turning +tdd / +ai off drops the gates they carry — asked like dropping a role.
const APPROVAL_TOOLS = new Set(["spec_approve", "spec_feature", "spec_init", "spec_add_track"]);
const APPROVAL_HOOK = /^(?:on|1|true|yes)$/i.test(String(process.env.SPEC_MCP_APPROVAL_HOOK || "").trim());
const ELICIT_TIMEOUT_MS = (() => {
  const n = Number(String(process.env.DEV_SPEC_ELICIT_TIMEOUT_MS || "").trim());
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, 60 * 60 * 1000) : 5 * 60 * 1000;
})();
// While a question waits and the call carried a progressToken (1.23): notifications/progress at once, then every this many ms —
// a client whose tool-call timeout restarts on progress doesn't give up on the call while its user reads the question.
const PROGRESS_EVERY_MS = 10 * 1000;
let clientElicits = false; // initialize: the client declared capabilities.elicitation (form mode — 2025-11-25 adds url mode)
// Requests this server sent the client (elicitation/create, roots/list), by id → the handler of their response.
const serverRequests = new Map();
let serverRequestSeq = 0;
// → { rid, promise, cancel(reason) }. The promise resolves to the client's response, { timeout: true } (no answer within
// timeoutMs) or { cancelled: true } (cancel(): the request that needed it was cancelled); the last two tell the client
// (notifications/cancelled for our request id), so it can close the question. `late` (1.25.1, review 7 — roots/list): a timeout
// settles the promise but cancels nothing — the request stays open and an answer that comes later goes to late(response) (a
// client slower than the timeout used to leave the default project on the server's cwd for the whole session).
function clientRequest(method, params, timeoutMs, late) {
  const rid = "dev-spec-" + ++serverRequestSeq;
  let settle;
  const promise = new Promise((resolve) => { settle = resolve; });
  let timer = null;
  const done = (value, cancelReason) => {
    if (!serverRequests.delete(rid)) return false; // answered, timed out or cancelled already
    clearTimeout(timer);
    if (cancelReason) process.stdout.write(frame({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: rid, reason: cancelReason } }));
    settle(value);
    return true;
  };
  serverRequests.set(rid, (msg) => done(msg));
  const onTimeout = () => {
    if (typeof late !== "function") return done({ timeout: true }, "timeout");
    serverRequests.set(rid, (msg) => { serverRequests.delete(rid); late(msg); }); // still listening, nothing cancelled
    settle({ timeout: true });
  };
  timer = setTimeout(onTimeout, timeoutMs);
  process.stdout.write(frame({ jsonrpc: "2.0", id: rid, method, params })); // never into a batch reply: the client must see it now
  return { rid, promise, cancel: (reason) => done({ cancelled: true }, reason || "cancelled") };
}
// tools/call requests still running after their handler returned (1.23 — waiting for the user, or for the client's roots), by
// request id (JSON-encoded: "1" and 1 are two ids) → { cancelled, cancel }. notifications/cancelled from the client marks one:
// its question is withdrawn, nothing is recorded, and it gets no reply (MCP: a cancelled request is never answered).
const inflight = new Map();
const flightKey = (id) => JSON.stringify(id);
function onCancelled(params) {
  if (!TYPE_CHECK.object(params) || !(typeof params.requestId === "string" || Number.isInteger(params.requestId))) return;
  const f = inflight.get(flightKey(params.requestId));
  if (!f || f.cancelled) return;
  f.cancelled = true;
  if (typeof f.cancel === "function") f.cancel();
}
// A request's progress token (MCP params._meta.progressToken: a string or an integer), or undefined.
function progressTokenOf(params) {
  const t = TYPE_CHECK.object(params) && TYPE_CHECK.object(params._meta) ? params._meta.progressToken : undefined;
  return typeof t === "string" || Number.isInteger(t) ? t : undefined;
}
// roadmap.json meta as the approval hook reads it: {} without a roadmap, undefined when it can't be read or parsed (unknown —
// the guard's guard-down reading fails closed). Decoded as the engine reads it (spec.decodeText — 1.24 review 6, A4: a UTF-16
// roadmap.json, Windows PowerShell 5.1's Out-File, read as UTF-8 was "unknown", and an unchanged spec_init setting was refused).
function approvalMeta(pdir) {
  let text;
  try { text = spec.decodeText(fs.readFileSync(path.join(spec.specsRoot(pdir), "roadmap.json"))); } catch (e) { return e && e.code === "ENOENT" ? {} : undefined; }
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
  // resolveFeature (1.23): the question (and the command) name the feature the engine will act on — its slug — never the raw
  // argument: slugify drops what isn't a-z / 0-9, so "alpha <any text in another script>" targets alpha and must read so.
  const resolveFeature = (n) => { const f = spec.existingFeature(pdir, n); return f.ok ? f.slug : null; };
  const d = spec.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: toolName, tool_input: args }, level, { lang, meta: approvalMeta(pdir), plain: true, resolveFeature });
  if (d.decision === "allow") return null;
  if (clientElicits) return { elicit: true, level, decision: d, lang };
  if (level === "deny") return { refuse: { ok: false, refused: true, humanRequired: true, approvalGuard: "deny", command: d.command, error: d.reason } };
  return null; // ask, and the client can't ask its user: today's behaviour
}
// Ask the user, then run the call only on an explicit approve. → the tool's result, or a refusal ({ok: false, declined: true, …}).
// flight: the call's inflight entry (its cancel withdraws the question) · progressToken: the call's, when it gave one.
async function elicitApproval(toolName, args, pol, flight, progressToken) {
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
    // 1.24 review 6: a revocation removes THE approval (and the waiting sign-offs) the question named — another one recorded
    // while the user read it is not revoked in its place (the engine compares them: changed-since-preview, nothing written).
    else preview = { approvedAt: typeof pre.approvedAt === "string" ? pre.approvedAt : null, withdrawn: TYPE_CHECK.object(pre.withdrawn) ? pre.withdrawn : {} };
    if (Array.isArray(pre.chain)) details.push(E.phases(pre.chain.join(", ")));
    if (Array.isArray(pre.failing) && pre.failing.length) details.push(E.forced(pre.failing.join(", ")));
    else if (!pre.revoke && !pre.chain) details.push(E.gatePasses);
    if (pre.waiver) details.push(E.waiver(pre.waiver.reason, pre.waiver.expires));
  } else if (toolName === "spec_feature") {
    // remove's own preview (no confirm): a feature that doesn't exist is answered as it is — nobody is asked
    const pre = spec.manageFeature(spec.resolveProjectDir(args.projectDir), "remove", args.name, undefined, { confirm: false });
    if (pre && pre.ok === false && !pre.needsConfirm) return pre;
    // 1.23: the user confirms deleting THIS folder — another feature renamed into the name, or files edited while the question
    // waits, is not deleted (the engine compares the fingerprint under the folder's lock: changedSincePreview).
    if (pre && typeof pre.fingerprint === "string") preview = { fingerprint: pre.fingerprint };
    // 1.24 r6 A-I8: how much it deletes — the preview's file count (the user weighs a scratch folder and weeks of work alike)
    if (pre && TYPE_CHECK.object(pre.wouldDelete) && Number.isSafeInteger(pre.wouldDelete.files)) details.push(E.removeSize(pre.wouldDelete.files, ".specs/" + pre.feature + "/"));
  }
  const q = clientRequest("elicitation/create", {
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
  if (flight) flight.cancel = () => q.cancel("the request that asked it was cancelled");
  let ticker = null;
  if (progressToken !== undefined) {
    let n = 0;
    const tick = () => process.stdout.write(frame({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken, progress: n++, message: E.waiting } }));
    tick();
    ticker = setInterval(tick, PROGRESS_EVERY_MS);
  }
  let res;
  try { res = await q.promise; } finally { if (ticker) clearInterval(ticker); }
  const refusal = (extra, error) => Object.assign({ ok: false, declined: true, approvalGuard: pol.level }, extra, { error });
  if (res.cancelled) return refusal({ action: "cancel", cancelled: true }, E.cancelled(list)); // never sent: the call was cancelled
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
// A tool's result: its JSON, COMPACT (1.24 r6 A-I1 — the indentation was ~22% of a reply's characters, which an agent pays in
// context on every call; every client parses it), isError when it is a refusal ({ok: false}). The reply goes to `sink` — the
// batch it came in, or straight out (null).
function toolReply(id, out, sink) {
  sendTo(sink, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out) }], isError: !!(out && out.ok === false) } });
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
// given → the group's first name is reported missing, as a required key would be. `unless`: the call needs none of them (1.25: a
// steering import — kiro-steering / cursor-rules — reads the tool's own folder when no path is given).
const REQUIRED_ONE_OF = { spec_import: [{ names: ["path", "text"], unless: (a) => spec.STEERING_IMPORT_TOOLS.includes(a.tool) }] };
// Required string arguments for which an empty (or whitespace-only) value is a real value, not "not given" (1.16 U review 5):
// an empty git log is what `git log` prints in a repository without commits (→ 0 commits), an empty closing message claims
// nothing (→ no-claim) — the CLI's `log <f> -` / `stop-check --message ""` accept them, so MCP does too.
const EMPTY_OK = { spec_log: ["gitLog"], spec_stop_check: ["message"] };
function missingArgs(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool || !tool.inputSchema) return [];
  const emptyOk = hasOwn(EMPTY_OK, toolName) ? EMPTY_OK[toolName] : [];
  const given = (k) => !(args[k] === undefined || args[k] === null || (typeof args[k] === "string" && !args[k].trim() && !emptyOk.includes(k)));
  const missing = (Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []).filter((k) => !given(k));
  for (const group of hasOwn(REQUIRED_ONE_OF, toolName) ? REQUIRED_ONE_OF[toolName] : []) if (!group.unless(args) && !group.names.some(given)) missing.push(group.names[0]);
  // 1.25.1: a NESTED object's `required` keys too (spec_finish evidence[n] {name, command, exitCode}, spec_append_tasks tasks[n].text)
  // — by their path (`evidence[0].command`): `evidence: [{}]` reached the engine, which answered "'undefined' is not a project check".
  for (const [k, s] of Object.entries(tool.inputSchema.properties || {})) if (given(k)) nestedMissing(s, args[k], k, missing);
  return missing;
}
// A value's missing required keys, by path — an object's (schema `properties` + `required`) and each array item's; the value
// absent, null or a blank string is "not given" (the top-level rule). A value of the wrong type is invalidArgs' to report.
function nestedMissing(schema, value, where, out) {
  if (!TYPE_CHECK.object(schema)) return;
  if (Array.isArray(value)) {
    if (TYPE_CHECK.object(schema.items)) value.forEach((v, i) => nestedMissing(schema.items, v, `${where}[${i}]`, out));
    return;
  }
  if (!TYPE_CHECK.object(value) || !TYPE_CHECK.object(schema.properties)) return;
  for (const k of Array.isArray(schema.required) ? schema.required : []) {
    const v = hasOwn(value, k) ? value[k] : undefined;
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) out.push(where + "." + k);
  }
  for (const [k, s] of Object.entries(schema.properties)) if (hasOwn(value, k) && value[k] != null) nestedMissing(s, value[k], where + "." + k, out);
}

// Arguments the tool's inputSchema doesn't list (1.24 r6 A1) → { unknown: [{argument, didYouMean?}], valid } (valid: what the
// message lists — the tool's own names, and for a nested key the names its object takes). They used to be dropped, and the call
// did something else than asked: spec_approve {revoked: true} RE-APPROVED changed content, spec_task_brief {task: 3} briefed the
// next task, spec_export {feature} exported the whole project. Like the CLI's unknown flag (1.23), such a call is refused before
// anything runs. An absent or null value is "not given" (the rule of every argument) — never an error. The suggestion: a word
// people type for an argument (ARG_ALIASES, when the tool takes it), else the nearest name (spec.closestName).
// 1.25.1: NESTED keys too — an object whose schema lists `properties` (an array's items included): spec_append_tasks {tasks:
// [{text, verfy: "npm test"}]} appended a task with no _Verify:_ (then ticked "verified, nothing to verify"), spec_finish
// {evidence: [{…, sumary}]} dropped the summary. The argument is the key's path (`tasks[0].verfy`), the suggestion too.
const ARG_ALIASES = { feature: "name", slug: "name", task: "number", tasknumber: "number", project: "projectDir", dir: "projectDir",
  projectdirectory: "projectDir", untick: "undo", unapprove: "revoke" };
function unknownArgs(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  const props = tool && tool.inputSchema && tool.inputSchema.properties ? tool.inputSchema.properties : {};
  const names = Object.keys(props);
  const unknown = [];
  const scopes = new Map(); // where a key was unknown ("" = the tool's own arguments, "tasks[]") → the names it takes
  for (const k of Object.keys(args)) {
    if (args[k] === undefined || args[k] === null) continue;
    if (hasOwn(props, k)) { nestedUnknown(props[k], args[k], k, k, unknown, scopes); continue; }
    const low = k.toLowerCase();
    const alias = hasOwn(ARG_ALIASES, low) && hasOwn(props, ARG_ALIASES[low]) ? ARG_ALIASES[low] : null;
    const near = alias || spec.closestName(k, names);
    unknown.push(near ? { argument: k, didYouMean: near } : { argument: k });
    scopes.set("", names);
  }
  const valid = [...scopes].map(([label, list]) => (label ? `${label} {${list.join(", ")}}` : list.join(", "))).join("; ");
  return { unknown, valid };
}
// where: the value's path (`tasks[0]`) · label: its schema's (`tasks[]` — the message names the keys it takes once).
function nestedUnknown(schema, value, where, label, unknown, scopes) {
  if (!TYPE_CHECK.object(schema)) return;
  if (Array.isArray(value)) {
    if (TYPE_CHECK.object(schema.items)) value.forEach((v, i) => nestedUnknown(schema.items, v, `${where}[${i}]`, label + "[]", unknown, scopes));
    return;
  }
  if (!TYPE_CHECK.object(value) || !TYPE_CHECK.object(schema.properties)) return; // additionalProperties (spec_init checks): any key
  const props = schema.properties;
  for (const k of Object.keys(value)) {
    if (value[k] === undefined || value[k] === null) continue;
    if (hasOwn(props, k)) { nestedUnknown(props[k], value[k], where + "." + k, label + "." + k, unknown, scopes); continue; }
    const near = spec.closestName(k, Object.keys(props));
    unknown.push(near ? { argument: where + "." + k, didYouMean: where + "." + near } : { argument: where + "." + k });
    scopes.set(label, Object.keys(props));
  }
}

// Argument TYPES, also straight from the inputSchema, checked before dispatch. A wrong type used to reach the
// engine and be coerced: number 1.9 ticked task 1, name {a:1} created .specs/object-object/, cap "abc"
// scanned 0 files, text 123 threw 'text.trim is not a function'. An argument the schema doesn't list is refused before
// (unknownArgs — 1.24 r6; it used to be ignored — nested keys too since 1.25.1), and so is a missing nested required key.
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
// Validation messages in the project's language (projectDir only when it is a local folder argument — parseProjectDir: reading
// a network projectDir's roadmap.json for its language would be the very connection runTool refuses).
function argMessages(args) {
  const r = parseProjectDir(args ? args.projectDir : undefined);
  try {
    return spec.msg(spec.projectLang(spec.resolveProjectDir(r.dir || rootsDir || undefined))).args;
  } catch {
    return spec.msg("en").args;
  }
}
// projectDir as a tool argument (1.24 r6 A2 / A3), read WITHOUT any fs call → { none: true } not given (absent, blank, or a
// variable left unexpanded — `${workspaceFolder}/x`, `$HOME`, `%CD%`: spec.unexpandedVar, the engine's own rule) · { dir } the
// absolute folder it names (a local file:// URI — what roots/list hands a client — is its path; a RELATIVE path resolves from
// the client's root when roots chose the default project, else from the server's working folder) · { code, message(A) } refused:
// project-dotdot (a '..' segment — never resolved away first), project-network (a network / device path, a file:// URI naming a
// host) or project-uri (a file:// URI that is no local folder path).
function parseProjectDir(v) {
  if (!projectDirGiven(v)) return { none: true };
  const s = v.trim();
  if (RE_DOTDOT.test(s)) return { code: "project-dotdot", message: (A) => A.dotdot };
  let p = s;
  if (/^file:/i.test(s)) {
    const host = /^file:\/\/([^/?#]*)/i.exec(s);
    if (host && host[1] && host[1].toLowerCase() !== "localhost") return { code: "project-network", message: (A) => A.network(s) };
    p = fileUriToPath(s);
    if (!p) return { code: "project-uri", message: (A) => A.projectUri(s) };
  } else p = spec.expandHome(p); // 1.25.1 (review 7): "~/zz" is the home folder's zz — it made a folder named "~" in the cwd
  if (isNetworkPath(p)) return { code: "project-network", message: (A) => A.network(s) };
  return { dir: path.resolve(rootsDir || process.cwd(), p) };
}
// The tool call's projectDir, checked and resolved (1.24 r6 A2 / A3) → { args } (projectDir: the absolute folder; not given → the
// client's root when roots gave the default project, else left out — the engine's default) or { refuse: {code, error} }. It names
// an EXISTING folder, as the CLI's --project does (1.23 review L14): only spec_init creates one — a mistyped path used to get a
// whole new .specs/ tree (spec_create) and spec_list on a file answered {exists: false}.
function projectDirArg(toolName, args) {
  const r = parseProjectDir(args.projectDir);
  if (r.none) {
    const rest = { ...args };
    delete rest.projectDir; // not given: never passed on (the engine's default project)
    return { args: rootsDir ? { ...rest, projectDir: rootsDir } : rest };
  }
  if (r.code) return { refuse: { code: r.code, error: r.message(argMessages()) } };
  let st = null;
  try { st = fs.statSync(r.dir); } catch { st = null; }
  if (st && !st.isDirectory()) return { refuse: { code: "project-not-dir", error: argMessages().projectNotDir(r.dir) } };
  if (!st && toolName !== "spec_init") return { refuse: { code: "project-missing", error: argMessages().projectMissing(r.dir) } };
  // 1.25.1 (review 7): spec_import reads the files its path names and returns them (dryRun: `preview`) — {projectDir: "<home>/.aws",
  // tool: "plan", path: "credentials", dryRun: true} returned the credentials. An explicit projectDir other than the default project
  // (env / roots / cwd) must hold a dev-spec .specs/ — spec_init there first; the engine refuses a hidden folder or a file that is no
  // document wherever the project is (importSourceAt).
  if (SPECS_REQUIRED.has(toolName) && st && !sameFolder(r.dir, defaultProjectDir()) && !spec.isDevSpecDir(r.dir)) {
    return { refuse: { code: "project-no-specs", error: argMessages().projectNoSpecs(r.dir) } };
  }
  return { args: { ...args, projectDir: r.dir } };
}
const SPECS_REQUIRED = new Set(["spec_import"]);
const FOLD_PATHS = process.platform === "win32" || process.platform === "darwin";
// The same folder, by real path (8.3 names, links), case-folded where the file system is.
function sameFolder(a, b) {
  const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
  const x = real(a), y = real(b);
  return FOLD_PATHS ? x.toLowerCase() === y.toLowerCase() : x === y;
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
  if (schema.minimum != null && schema.maximum != null) d += " " + A.between(schema.minimum, schema.maximum); // 1.24 r6 A5
  else if (schema.minimum != null) d += " " + A.atLeast(schema.minimum);
  else if (schema.maximum != null) d += " " + A.atMost(schema.maximum);
  if (schema.minItems != null) d += " " + A.atLeastItems(schema.minItems); // 1.25.1: spec_append_tasks.tasks
  return d;
}
function schemaIssues(schema, value, where, out) {
  const types = [].concat(schema.type || []);
  const bad = () => out.push({ where, schema, value });
  if (types.length && !types.some((t) => hasOwn(TYPE_CHECK, t) && TYPE_CHECK[t](value))) return bad();
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return bad();
  if (typeof value === "number" && schema.minimum != null && value < schema.minimum) return bad();
  if (typeof value === "number" && schema.maximum != null && value > schema.maximum) return bad(); // 1.24 r6 A5: spec_next_task.max
  if (Array.isArray(value) && schema.minItems != null && value.length < schema.minItems) return bad(); // 1.25.1: tasks: [] appended nothing
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
// 1.25: a string that also reads 'true' / 'false' (spec_create {branch}: 'true' = the default name, or the name itself) — a boolean
// given for it becomes that string before validation (the schema stays one plain `type`, as guard's on / off: some MCP clients
// reject a list-valued type).
const BOOL_STRING_ARGS = { spec_create: new Set(["branch"]) };
function foldEnumArgs(toolName, args) {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool || !tool.inputSchema || !tool.inputSchema.properties) return args;
  let out = args;
  for (const [k, s] of Object.entries(tool.inputSchema.properties)) {
    if (BOOL_STRING_ARGS[toolName] && BOOL_STRING_ARGS[toolName].has(k) && hasOwn(args, k) && typeof args[k] === "boolean") {
      if (out === args) out = { ...args };
      out[k] = String(args[k]);
      continue;
    }
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
// An argument error (1.24 r6 A-I2): {ok: false, error: <localized>, code: <stable, English>, …what it names} — callers branch
// on the code: unknown-argument {unknown} · missing-arguments {missing} · invalid-arguments {invalid} · project-dotdot ·
// project-network · project-uri · project-missing · project-not-dir.
function argError(id, message, code, extra) {
  return toolReply(id, Object.assign({ ok: false, error: message, code }, extra || {}), batchSink);
}
// A tool that threw (a file system error: ENOTDIR, EACCES…) → the JSON result every other refusal is (1.23 — it was the bare
// text "ERROR: <message>"): {ok: false, error: <localized prefix + the message>, code: <the error's code, when it has one>}.
function toolFailure(e, args) {
  const out = { ok: false, error: argMessages(args).toolFailed((e && e.message) || String(e)) };
  if (e && e.code != null) out.code = String(e.code);
  return out;
}

// --- The default project from the client's roots (1.23) ---------------------------------------------------------------------
// With neither SPEC_PROJECT_DIR nor CLAUDE_PROJECT_DIR set (Claude Desktop, a global Cursor / Windsurf / Gemini config), the
// default project was the server's cwd — an app or home folder, where spec_init then scaffolded .specs/. A client that declares
// `roots` is asked once (roots/list, on the first request that needs the project) and its first local file:// root becomes the
// default: tools/call without a projectDir gets it as one, and resources / prompts / completions read it. A network root
// (file://host/…), one with '..', or no usable root → the old default (cwd). notifications/roots/list_changed asks again.
// 1.25.1 (review 7): no answer within ROOTS_TIMEOUT_MS → the cwd for now, but the question stays open: an answer that comes later
// still sets the root (it was dropped, and the cwd stayed the default for the session). DEV_SPEC_ROOTS_TIMEOUT_MS (≥ 1, ≤ 60 000).
const ROOTS_TIMEOUT_MS = (() => {
  const n = Number(String(process.env.DEV_SPEC_ROOTS_TIMEOUT_MS || "").trim());
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, 60000) : 5000;
})();
// An env value that names a folder (an unexpanded `${VAR}`, `$VAR` or `%VAR%` — a client that didn't expand it — names none).
const envDirSet = (v) => { const s = v == null ? "" : String(v).trim(); return !!s && !spec.unexpandedVar(s); };
const ENV_PROJECT = envDirSet(process.env.SPEC_PROJECT_DIR) || envDirSet(process.env.CLAUDE_PROJECT_DIR);
let clientRoots = false; // initialize: the client declared capabilities.roots
let rootsDir; // undefined: not asked yet · null: no usable root · the folder
let rootsWait = null; // the roots/list in flight
let rootsGen = 0; // which ask an answer belongs to (initialize / list_changed start another: an older late answer is ignored)
// A local file:// URI → its absolute path, else null (a host other than localhost, '..', a control character; on Windows a
// drive path only — file:///C:/x, file:///c%3A/x).
function fileUriToPath(uri) {
  const m = /^file:\/\/([^/?#]*)(\/[^?#]*)$/i.exec(String(uri).trim());
  if (!m || (m[1] && m[1].toLowerCase() !== "localhost")) return null;
  let p;
  try { p = decodeURIComponent(m[2]); } catch { return null; }
  if (/[\u0000-\u001f\u007f]/.test(p)) return null;
  if (process.platform === "win32") {
    if (!/^\/[A-Za-z]:(\/|$)/.test(p)) return null;
    p = p.slice(1);
  }
  if (RE_DOTDOT.test(p) || isNetworkPath(p)) return null;
  return path.resolve(p);
}
function firstFileRoot(res) {
  const roots = TYPE_CHECK.object(res) && TYPE_CHECK.object(res.result) && Array.isArray(res.result.roots) ? res.result.roots : [];
  for (const r of roots) {
    const p = TYPE_CHECK.object(r) && typeof r.uri === "string" ? fileUriToPath(r.uri) : null;
    if (p) return p;
  }
  return null;
}
// null → the default project is known (answer now) · a Promise → wait for the client's roots first.
function rootsPending() {
  if (!clientRoots || ENV_PROJECT || rootsDir !== undefined) return null;
  if (!rootsWait) {
    const gen = ++rootsGen;
    // A late answer (after the timeout) sets the root then — unless another ask started since, or a root was set meanwhile.
    const q = clientRequest("roots/list", {}, ROOTS_TIMEOUT_MS, (res) => { if (gen === rootsGen && rootsDir === null) rootsDir = firstFileRoot(res); });
    const w = q.promise.then((res) => {
      if (rootsWait === w) rootsWait = null;
      if (gen === rootsGen) rootsDir = res.timeout ? null : firstFileRoot(res);
    });
    rootsWait = w;
  }
  return rootsWait;
}
const defaultProjectDir = () => rootsDir || spec.resolveProjectDir();
// projectDir as a tool argument: given unless absent, blank or holding a variable left unexpanded — any `${`, a leading `$NAME`, a
// `%NAME%` (spec.unexpandedVar, the engine's own rule — resolveProjectDir). 1.24 r6 A2: only a whole `${VAR}` was caught, so with
// the client's roots `$HOME` or `${workspaceFolder}/` went to the engine, which resolved the server's cwd instead of the root.
const projectDirGiven = (v) => typeof v === "string" && !!v.trim() && !spec.unexpandedVar(v);
// Run `msg` again once `wait` settled, its reply going where it would have gone (the batch it came in, or straight out). A
// tools/call waits as an inflight entry: cancelled meanwhile, it never runs.
function deferUntil(wait, msg, cancellable) {
  const sink = batchSink;
  const key = cancellable ? flightKey(msg.id) : null;
  const flight = cancellable ? { cancelled: false, cancel: null } : null;
  if (flight) inflight.set(key, flight);
  return wait.then(() => {
    if (flight) {
      if (inflight.get(key) === flight) inflight.delete(key);
      if (flight.cancelled) return undefined;
    }
    const prev = batchSink;
    batchSink = sink;
    try { return handle(msg); } finally { batchSink = prev; }
  });
}
const NEEDS_PROJECT = new Set(["tools/call", "prompts/list", "prompts/get", "resources/list", "resources/templates/list", "resources/read", "completion/complete"]);

// --- MCP prompts + resources (lib/prompts-resources.js) ----------------------
// Prompts are the plugin's commands/*.md — slash commands in Cursor, VS Code/Copilot, Windsurf, Zed… The Claude Code
// plugin already ships those files as its own slash commands, so mcp/servers.json sets SPEC_MCP_PROMPTS=off there:
// without the prompts capability Claude Code doesn't list every command a second time (/mcp__…__spec-impact).
// Resources and prompts use the default project (SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / the client's first root / cwd — the
// tools' default): neither request carries a projectDir. Messages are in that project's language.
const PROMPTS_ON = !/^(off|0|false|no)$/i.test(String(process.env.SPEC_MCP_PROMPTS || "").trim());
function handleContent(id, method, params) {
  if (method.startsWith("prompts/") && !PROMPTS_ON) return error(id, -32601, "Method not found: " + method);
  const p = TYPE_CHECK.object(params) ? params : {};
  const pdir = defaultProjectDir();
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
    case "resources/list": { // pages (1.23): nextCursor while there are more; a cursor this server didn't hand out is Invalid params
      const r = content.listResources(pdir, { cursor: p.cursor });
      if (!r.ok) return error(id, -32602, r.error);
      return result(id, r.nextCursor ? { resources: r.resources, nextCursor: r.nextCursor } : { resources: r.resources });
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
  // A notification is a message WITHOUT an id member: it never gets a response — and never runs a tool. Two change state (1.23):
  // notifications/cancelled withdraws a request still waiting (inflight), notifications/roots/list_changed forgets the roots.
  if (!hasOwn(msg, "id")) {
    if (method === "notifications/cancelled") onCancelled(params);
    else if (method === "notifications/roots/list_changed" && !rootsWait) rootsDir = undefined;
    return;
  }
  // A JSON-RPC RESPONSE (result / error, no method) is never answered — whatever its id: a client's error response to a
  // request it couldn't parse carries id null (checked before the id rule, full review R9). One that answers a request THIS
  // server sent (elicitation/create — 1.21 F1b; roots/list — 1.23) settles it.
  if (typeof method !== "string" && (hasOwn(msg, "result") || hasOwn(msg, "error"))) {
    const cb = typeof id === "string" ? serverRequests.get(id) : undefined;
    if (cb) cb(msg);
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

  // 1.23: the default project may come from the client's roots — asked once, on the first request that reads the project.
  if (NEEDS_PROJECT.has(method)) {
    const wait = rootsPending();
    if (wait) return deferUntil(wait, msg, method === "tools/call");
  }

  try {
    switch (method) {
      case "initialize": {
        const asked = params && params.protocolVersion;
        const proto = SUPPORTED_PROTOCOLS.includes(asked) ? asked : asked ? SUPPORTED_PROTOCOLS[SUPPORTED_PROTOCOLS.length - 1] : DEFAULT_PROTOCOL;
        const caps = TYPE_CHECK.object(params) && TYPE_CHECK.object(params.capabilities) ? params.capabilities : {};
        // 1.21 F1b: a client that can ask its user (capabilities.elicitation) gets the approval guard's questions (elicitation/create)
        // — in form mode: `{}` (2025-06-18) or `{form: {…}}` (2025-11-25); a client declaring url mode only can't show a form.
        const el = caps.elicitation;
        clientElicits = TYPE_CHECK.object(el) && (!Object.keys(el).length || TYPE_CHECK.object(el.form));
        clientRoots = TYPE_CHECK.object(caps.roots); // 1.23: the default project from roots/list (rootsPending)
        rootsDir = undefined;
        rootsGen++; // 1.25.1: an answer to an earlier session's roots/list no longer applies
        rootsWait = null;
        return result(id, {
          protocolVersion: proto,
          serverInfo: SERVER_INFO,
          // completions (1.16 C3): completion/complete for the prompts' feature argument and the specs:// template variables.
          capabilities: PROMPTS_ON
            ? { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false, subscribe: false }, completions: {} }
            : { tools: { listChanged: false }, resources: { listChanged: false, subscribe: false }, completions: {} },
          instructions:
            "Local spec-driven engine. Use spec_classify to pick tracks, spec_init to scaffold steering, spec_create to scaffold a feature, then spec_status / spec_next_task / spec_complete_task to drive execution (spec_task_brief builds a self-contained brief per task for subagent execution). To resume a feature or answer 'where am I / what now?', call spec_next_action {name}: where it stands and the ONE next step. Evidence before claims: tick a task (spec_complete_task) only with the run of its _Verify:_ command that you or the user actually made — if you cannot run it, ask for its output instead of ticking (never send a subagent to look for a shell). A CLI line you give the user is the runnable one the tools print — `" + spec.DEV_SPEC + " …` (a plugin install has no `dev-spec` on PATH). ears_validate, trace_check and spec_doctor enforce quality gates. Approvals are the user's: with meta.approvalGuard ask / deny, spec_approve asks the user through the client (elicitation) when it can. After a plugin update, spec_upgrade audits an existing .specs/ (apply: the safe migrations). Everything is local: writes stay in the project's .specs/, reads inside the project (spec_scan / spec_coverage / trace_check {code} read its code; spec_import a source inside it — never a hidden folder or a non-document file, and with another projectDir only a dev-spec project's); no network, no command, no git." +
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
        if (rawArgs != null && !TYPE_CHECK.object(rawArgs)) return argError(id, argMessages().notObject, "invalid-arguments", { invalid: ["arguments"] });
        const folded = foldEnumArgs(toolName, rawArgs || {});
        // 1.24 r6 A1: an argument the schema doesn't list is refused FIRST — a misspelt required key reads as unknown (with its
        // did-you-mean) rather than missing; nothing runs.
        const { unknown, valid } = unknownArgs(toolName, folded);
        if (unknown.length) return argError(id, argMessages(folded).unknownArgs(toolName, unknown, valid), "unknown-argument", { unknown });
        const missing = missingArgs(toolName, folded);
        if (missing.length) return argError(id, argMessages(folded).missing(missing.join(", ")), "missing-arguments", { missing });
        const invalid = invalidArgs(toolName, folded);
        if (invalid.length) {
          const A = argMessages(folded);
          return argError(id, A.invalid(invalid.map((i) => A.item(i.where, expectedType(i.schema, A), shortJson(i.value))).join("; ")), "invalid-arguments", { invalid: invalid.map((i) => i.where) });
        }
        // 1.24 r6 A2 / A3: projectDir checked and resolved — an existing folder (spec_init may create it), a file:// URI read as its
        // path, a relative one from the client's root; not given → the client's root when its roots gave the default (1.23)
        const pd = projectDirArg(toolName, folded);
        if (pd.refuse) return argError(id, pd.refuse.error, pd.refuse.code);
        const args = pd.args;
        // 1.21 F1b: an agent's approval under meta.approvalGuard ask | deny — asked of the user (elicitation: the reply comes
        // later, the server keeps answering meanwhile) or refused (deny, a client that can't ask). 1.23: the call waits as an
        // inflight entry — cancelled by the client, its question is withdrawn and it gets no reply.
        const policy = approvalPolicy(toolName, args);
        if (policy && policy.elicit) {
          const sink = batchSink;
          const key = flightKey(id);
          const flight = { cancelled: false, cancel: null };
          inflight.set(key, flight);
          const finish = (o) => {
            if (inflight.get(key) === flight) inflight.delete(key);
            if (!flight.cancelled) toolReply(id, o, sink);
          };
          return elicitApproval(toolName, args, policy, flight, progressTokenOf(params)).then(finish, (e) => finish(toolFailure(e, args))).catch(() => {});
        }
        let out;
        try {
          out = policy && policy.refuse ? policy.refuse : runTool(toolName, args);
        } catch (e) {
          out = toolFailure(e, args); // 1.23: JSON like every other result (it was the bare text "ERROR: …")
        }
        return toolReply(id, out, batchSink);
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
// The size of one incoming message (1.23): a line growing past it — a client that never sends "\n", or a runaway payload — used
// to grow in memory until the process died. Past it the message is refused (-32600, id null: it can't be parsed for its id),
// its bytes are skipped up to the next "\n", and the server keeps answering. Characters, after UTF-8 decoding; default 32 MiB
// (an 8 MB ears_validate text is fine), DEV_SPEC_MCP_MAX_MESSAGE to change it (≥ 1024).
const MAX_MESSAGE = (() => {
  const n = Number(String(process.env.DEV_SPEC_MCP_MAX_MESSAGE || "").trim());
  return Number.isSafeInteger(n) && n >= 1024 ? n : 32 * 1024 * 1024;
})();
function main() {
  process.stdout.on("error", onStdoutError);
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let scanned = 0; // pending[0, scanned) holds no "\n": a long message arriving in many chunks is scanned once
  let skipping = false; // the rest of a message refused as too large, up to its "\n"
  const tooLarge = (n) => error(null, -32600, argMessages().tooLarge(n, MAX_MESSAGE));
  const drain = () => {
    let nl;
    while ((nl = pending.indexOf("\n", scanned)) >= 0) {
      const line = pending.slice(0, nl);
      pending = pending.slice(nl + 1);
      scanned = 0;
      if (skipping) { skipping = false; continue; } // the tail of the refused message
      if (line.length > MAX_MESSAGE) { tooLarge(line.length); continue; }
      onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
    }
    if (pending.length > MAX_MESSAGE || (skipping && pending)) {
      if (!skipping) tooLarge(pending.length);
      skipping = true;
      pending = "";
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
    if (pending && !skipping) onLine(pending.endsWith("\r") ? pending.slice(0, -1) : pending);
    pending = "";
    process.stdout.write("", () => process.exit(0));
  };
  process.stdin.on("end", close);
  process.stdin.on("error", close);
}

main();

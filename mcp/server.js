#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local MCP server (stdio, zero-dependency).
 *
 * Implements the Model Context Protocol over newline-delimited JSON-RPC 2.0
 * on stdin/stdout. No npm install, no network, no cost — pure Node core.
 *
 * Tools (all operate on the project's `.specs/` directory): see TOOLS below —
 * 32 tools (30 listed in Claude Code plugin mode — PLUGIN_UNLISTED), verify with an `initialize` + `tools/list` handshake; each
 * carries `annotations` (TOOL_ANNOTATIONS). The 1.26 hidden aliases (LEGACY_TOOLS) answer tools/call by the old names.
 * Prompts: one per plugin command (commands/*.md) — slash commands in MCP clients without the skill
 * (SPEC_MCP_PROMPTS=off drops them). Resources: the project's spec artifacts, read-only, as specs:// URIs.
 * Completions (completion/complete): feature slugs and specs:// template variables. All live in lib/prompts-resources.js.
 */

const { StringDecoder } = require("string_decoder"); // stdin framing (main): "\n"-delimited, never readline
const fs = require("fs");
const path = require("path");
const spec = require("./lib/spec.js");
// The `lang` enum of every tool: en · pt (European Portuguese) · es · pt-BR (Brazilian Portuguese) — spec.LANGS.
const LANG_ENUM = spec.LANGS.slice();
const content = require("./lib/prompts-resources.js"); // MCP prompts + resources
// the operations — for each tool, the engine call it makes (the CLI's very call) and the argument each option comes from
const OPS = require("./lib/operations.js");
// the projectDir reading the approval hook shares (zero-dependency — a path or a local file:// URI): ONE parser
const HOOK_UTILS = require("../hooks/hook-utils.js");

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

// The description budget (the context diet): tools/list is what every client that loads its tools up front pays in
// context on every session. A description says what a model needs to CHOOSE and CALL the tool: its purpose, when to use it
// (vs a neighbour), the important arguments and the rules an agent must act on (evidence before claims, approvals are the
// user's, never force without the user's consent). The reference detail — every output field, check id, format — lives in
// references/tooling-reference.md; the result itself carries its stable codes. mcp/tests/02-mcp-server.js caps the whole list.
// Every tool's projectDir: spec_init's says how the folder is chosen (tools/call → projectDirArg); every other tool
// carries one short shared text.
const PROJECT_DIR_INIT = Object.freeze({ type: "string", description: "Project folder — only spec_init creates a missing one: a path or a local file:// URI. Default: SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR, else the client's first root, else the nearest folder with .specs/ up from the server's cwd, else the cwd. Relative: from the client's first root, else the cwd." });
const PROJECT_DIR = Object.freeze({ type: "string", description: "Project folder" });
// A track name (spec_init / spec_create / spec_import): no enum — an unknown name gets the engine's did-you-mean.
const TRACK_ITEM = Object.freeze({ type: "string", description: "core | tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a project track pack; 'tdd,saas' / '+saas +ai' are split" });
const ROADMAP_ACTIONS = [...new Set([...spec.BACKLOG_ACTIONS, ...spec.MILESTONE_ACTIONS])]; // add · rm (alias remove) · list

const TOOLS = [
  {
    name: "spec_init",
    description:
      "Initialize .specs/ and the steering files of the tracks the project uses (core always; each track adds its own). Idempotent — never overwrites a file. `lang` writes the steering in that language and becomes the project default. Optional project settings, each unchanged when omitted and always reported back: `guard`, `stopCheck`, `approvalGuard`, `checks`, `evidence`, `approvalRoles`. Lowering a protection (guard, approvalGuard, roles) is the user's decision — never do it without their consent.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: { type: "array", items: TRACK_ITEM, description: "Tracks the project uses ('core' always included)." },
        lang: { type: "string", enum: LANG_ENUM, description: "Project language (default en): pt = European, pt-BR = Brazilian Portuguese." },
        guard: { type: "string", enum: ["on", "off", "scope"], description: "on = a code edit asks while no feature has approved, unfinished tasks; scope = also a file no open task names in _Implements:_; off." },
        evidence: { type: "string", enum: ["reported", "observed"], description: "observed = a runnable _Verify:_ counts only from a run the harness saw or the CLI made; reported (default)." },
        stopCheck: { type: "boolean", description: "The end-of-turn evidence gate (on by default)." },
        approvalGuard: { type: "string", enum: [...spec.APPROVAL_GUARD_LEVELS], description: "ask = an agent's approval asks the user first; deny = only the human approves; off (default)." },
        checks: { type: "object", additionalProperties: { type: "string" }, description: "Project check commands {name: command}, e.g. {\"test\": \"npm test\"} — spec_finish needs a passing run of each; an empty command removes one." },
        approvalRoles: { type: "object", description: "{<phase>: [<role>, …]}: every role signs the phase off; {} clears them." },
        projectDir: PROJECT_DIR_INIT,
      },
    },
  },
  {
    name: "spec_classify",
    description:
      "Phase 0: classify a feature description into tracks (core +tdd +saas +ai +sec +privacy +dist +api +ui +obs +data, plus the project's track packs) from local keyword signals in EN / PT / ES — no model. Returns the recommended tracks with the matched signals and reasoning, a suggested size (xs | s | m | l) and, for Brazilian wording, langHint 'pt-BR'. A suggestion: confirm tracks and size with the user, then pass their choice to spec_create. `explain: true` lists every keyword match.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "The feature or request in plain language." },
        name: { type: "string", description: "Optional feature name (also read as evidence)." },
        lang: { type: "string", enum: LANG_ENUM, description: "Language of the notes (default: the description's)." },
        explain: { type: "boolean", description: "Also return every keyword match." },
        projectDir: PROJECT_DIR, // its track packs and signal overrides apply
      },
      required: ["description"],
    },
  },
  {
    name: "spec_create",
    description:
      "Scaffold a feature under .specs/<slug>/ for the chosen tracks: classification, requirements (EARS, stable AC IDs), design (each active track's mandatory sections), tasks, plus the test plan (+tdd), eval plan (+ai) and load test (+saas). Idempotent. `kind`: feature (default) · bugfix (reproduce → root cause → failing regression test → fix; its bug.md can be prefilled in this call) · spike (a timeboxed question that ends in a decision) · change (size xs: one change.md). `includeBody` returns the created files — no read-back needed.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name (slugified for the folder)." },
        tracks: { type: "array", items: TRACK_ITEM, description: "Active tracks ('core' always added). Omit to auto-classify — confirm with the user in Phase 0." },
        summary: { type: "string", description: "One-line summary." },
        size: { type: "string", enum: [...spec.FEATURE_SIZES], description: "The rigor, confirmed with the user: xs = a change (one change.md, core only); s = one story, lighter sections; m / l = the full chain. New features only; omit = the classic scaffold." },
        kind: { type: "string", enum: ["feature", "bugfix", "spike", "change"], description: "feature (default) | bugfix | spike | change (= size xs)." },
        question: { type: "string", description: "spike: the question it answers (default: summary)." },
        timebox: { type: "string", description: "spike: its end — YYYY-MM-DD or a duration (3d, 2w, 8h)." },
        reproduction: { type: "string", description: "bugfix: the exact steps / input / environment that reproduce it." },
        rootCause: { type: "string", description: "bugfix: the root cause WITH its evidence — only once known." },
        condition: { type: "string", description: "bugfix: the trigger of US-1.AC-1 (IF <condition> THEN …), one line." },
        behaviour: { type: "string", description: "bugfix: the correct behaviour (THEN …), one line." },
        includeBody: { type: "boolean", description: "Return the created files' bodies (`bodies`)." },
        lang: { type: "string", enum: LANG_ENUM, description: "Artifacts' language (default: the project's)." },
        brownfield: { type: "boolean", description: "An existing codebase: also scaffold integration-plan.md." },
        flow: { type: "string", enum: [...spec.FLOWS], description: "design-first (design before requirements) | requirements-first (default). New features only." },
        branch: { type: "string", description: "'true' or a name: the feature's own git branch (default feature/<slug>) — run the returned branch.command yourself (this server never runs git)." },
        projectDir: PROJECT_DIR,
      },
      required: ["name"],
    },
  },
  {
    name: "spec_status",
    description:
      "A feature's status: its kind (feature / bugfix / spike / change), flow, tracks, phase, artifacts, task progress with the next task, and how complete each active track's design sections are. Without `name`: every feature under .specs/ with its kind, tracks, phase and task progress (done / total). For the one next step, call spec_next_action.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Feature name/slug. Omit to list every feature." }, projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_next_task",
    description:
      "The next task of a feature — the first open one, in number order, whose _Depends:_ tasks are done — plus remaining / total; `skipped` / `blocked` explain the tasks passed over (none able to start: next null and a note — fix the _Depends:_ markers). `batch: true` adds the following open [P] tasks that can run beside it (disjoint _Implements:_ files) for parallel subagents; `waves: true` returns the execution waves of every open task.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, batch: { type: "boolean", description: "Also return the parallel batch." }, max: { type: "integer", minimum: 1, maximum: 8, description: "Batch size cap (default 3)." }, waves: { type: "boolean", description: "Also return the execution waves (+ cycles, blocked)." }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_task_brief",
    description:
      "A self-contained brief for ONE task (default: the next one, as spec_next_task picks it) so a fresh implementer can execute it without the whole spec: the task, the full text of the ACs it cites, its test-plan rows, its _Verify:_ command (the evidence its report must carry), _Expect: fail_, dependencies, global constraints, the design sections, decisions, steering and glossary that apply, a Reuse section (search before you write), the project checks and the definition of done. A bugfix task after the root-cause task is `gated` until bug.md's Root Cause is filled. `write: true` writes .specs/<feature>/.execution/task-<N>-brief.md (+ ledger.md) and returns the paths — the basis of subagent-driven execution.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        number: { type: "integer", minimum: 0, description: "Task number. Omit for the next task." },
        write: { type: "boolean", description: "Write the brief file; the brief itself is then left out unless includeBrief." },
        includeBrief: { type: "boolean", description: "Include the brief and its structured content (default: true unless writing)." },
        projectDir: PROJECT_DIR,
      },
      required: ["name"],
    },
  },
  {
    name: "spec_finish",
    description:
      "Close a feature: a readiness report plus a merge title + summary generated from the spec chain. `readyToFinish` only without `blockers` (doctor fails, edits since an approval, placeholders, open or unverified tasks, a project check without a passing recorded run since the last task activity, phases awaiting approval); `warnings` never block. `evidence` [{name, command, exitCode, summary}] records the project checks' runs YOU made (meta.checks names; the server never runs them) before readiness is computed. `write: true` writes .specs/<feature>/.execution/merge-summary.md and, when ready, records the drift baseline. Integration is LOCAL — the human merges or keeps the branch; it never merges, pushes or approves by itself. A green run is EVIDENCE, not the sign-off: ask the user for an explicit yes on the `execution` phase before calling spec_approve.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, write: { type: "boolean", description: "Write the merge summary file (+ the drift baseline when ready)." }, includeBody: { type: "boolean", description: "Include the merge summary (default: true unless writing)." }, evidence: { type: "array", description: "The project checks' runs you made (needs meta.checks; all-or-nothing).", items: { type: "object", properties: { name: { type: "string", description: "A meta.checks name." }, command: { type: "string" }, exitCode: { type: "integer" }, summary: { type: "string", description: "e.g. '212 passing'." }, commit: { type: "string", description: "Optional: the git commit it ran on." }, dirty: { type: "boolean", description: "Optional: uncommitted changes outside .specs/." } }, required: ["name", "command", "exitCode"] } }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_complete_task",
    description:
      "Tick task N of a feature — EVIDENCE BEFORE CLAIMS. Pass `evidence` {command, exitCode, summary}: the run of its _Verify:_ command you actually made. If you cannot run it (no shell), do NOT call this tool: name the _Verify:_ command and ask the user for its output, or to run `" + spec.DEV_SPEC + " done <feature> <n> --run` (that exact line) — never send a subagent to look for a shell, never pass an exit code you did not see. \"I finished it, mark it done\" is a claim, not a run; tick with a note only when the user explicitly asks for an UNVERIFIED tick. A non-zero exitCode REFUSES the tick (it stays recorded). A runnable _Verify:_ is verified only by {command: that very command (several: one run joined with ` && `), exitCode: 0}; anything else ticks it unverified. The result carries `verified`; when false, a stable `unverifiedReason` plus a localized note; doctor, spec_finish and ROADMAP.md list such an unverified task with its localized reason. A task with no runnable _Verify:_ and nothing recorded is verified with `nothingToVerify: true` (nothing was run or attested) — doctor, spec_finish and ROADMAP.md pass it too (never listed as unverified). RED → GREEN: an `_Expect: fail_` task needs a FAILING run first; a run that never reached the test (exit 126 / 127 / 9009) is refused. Bugfix: a task after the root-cause task is refused until bug.md's Root Cause is filled. `undo: true` (+ `reason`) unticks it instead — its evidence turns stale.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, number: { type: "integer", minimum: 0 }, evidence: { type: "object", properties: { command: { type: "string" }, exitCode: { type: "integer" }, summary: { type: "string", description: "e.g. '14/14 passing' or the last lines of output." }, commit: { type: "string", description: "Optional: the git commit it ran on." }, dirty: { type: "boolean", description: "Optional: uncommitted changes outside .specs/." } }, description: "The run you made." }, undo: { type: "boolean", description: "Untick task N instead (its evidence turns stale)." }, reason: { type: "string", description: "With undo: why, one line." }, projectDir: PROJECT_DIR }, required: ["name", "number"] },
  },
  {
    name: "ears_validate",
    description: "Lint EARS acceptance criteria: a missing modal verb (SHALL / DEVE / DEBE — the only error), a missing stable ID (US-n.AC-m; EC / NFR / SC IDs count too), vague words, template placeholders, a missing EARS keyword and open [NEEDS CLARIFICATION] markers. Pass `text`, or `name` to lint that feature's requirements.md. Each issue has a stable `code`, a severity, its line and a localized `msg`.",
    inputSchema: { type: "object", properties: { text: { type: "string", description: "The criteria to lint." }, name: { type: "string", description: "Or a feature: its requirements.md." }, lang: { type: "string", enum: LANG_ENUM, description: "Language of the messages for raw text." }, projectDir: PROJECT_DIR } },
  },
  {
    name: "trace_check",
    description: "Traceability of a feature, both directions. Gaps decide `verdict`: criteria without a US-n.AC-m ID, ACs no task cites, phantom AC / T-IDs in tasks, on +tdd ACs without a test-plan row and rows citing undefined ACs, and _Implements:_ files that don't exist (those only open tasks name are the plan); warnings never decide it. `code: true` also scans the project's test files for the T-IDs / AC IDs they name; `matrix: true` adds the requirements traceability matrix (one row per AC / EC / NFR / SC: status, tasks + evidence, tests, design, decisions, approval).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, code: { type: "boolean", description: "Also scan test files for the T-IDs they name (put the T-ID in the test's name)." }, matrix: { type: "boolean", description: "Also return the traceability matrix." }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_doctor",
    description: "One health check that decides whether a feature can advance a phase: per-check pass / warn / fail with stable ids, `readyToAdvance` (no fail) and `verdict`. It fails on what blocks the next approval — missing artifacts, EARS problems, open clarifications, duplicate ACs, template placeholders in the current phase, the active tracks' mandatory design sections (<track>-sections), traceability gaps, task dependencies — and warns on the rest (unverified tasks, edits since an approval, steering changes, cross-feature overlaps…). Also returns the phase, approvals, pending and forced gates, and what the next approval would refuse (`nextGate`).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_approve",
    description: "Record the user's approval of a phase gate (.state.json + a .history/ snapshot). Only record an approval the user gave — an explicit yes for THAT phase (a passing test run, a ticked task or \"finish it\" / \"fix it\" is not one; `execution` too). The gate REFUSES it while the phase's checks fail (the failing check ids are listed — fix them) or an earlier phase is unapproved (`phase-order`). `force: true` records a forced approval — only when the user asked for it; with `reason` and `expires` it is a waiver. APPROVALS BY ROLE (meta.approvalRoles): pass `role`; the phase counts once every role signed off. FAST-FORWARD: `through` approves the active phases up to it in order, stopping at the first refusal. `revoke: true` (+ `reason`) withdraws `phase`'s approval (never cascades). With meta.approvalGuard ask / deny the user is asked first (the plugin's hook, else MCP elicitation — recorded only on their explicit approve) or the call is refused (`humanRequired`: hand the user the `command` to run) — never retry it another way.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, phase: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"], description: "The phase to approve — or, with revoke, whose approval to withdraw." }, through: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks"], description: "Fast-forward: approve every active phase up to this one, in order, each through its gate." }, role: { type: "string", description: "The role this sign-off (or revocation) is for, when meta.approvalRoles lists the phase." }, by: { type: "string", description: "Approver (default: $USER / $USERNAME, else 'user')." }, force: { type: "boolean", description: "Approve although the checks fail (recorded as forced) — only on the user's request." }, reason: { type: "string", description: "With force: why the gate is waived; with revoke: why. One line." }, expires: { type: "string", description: "With force: the waiver's end — YYYY-MM-DD (UTC) or Nd (e.g. 30d)." }, revoke: { type: "boolean", description: "Withdraw `phase`'s approval instead (never cascades)." }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "steering_scaffold",
    description: "Create one steering file from its template (constitution, product, tech, structure, testing-standards, scale, observability, cost, ai-strategy, security, privacy, distributed, api, ui, data or glossary .md) or a custom scoped one (another lowercase name.md) with Kiro-compatible front matter (`inclusion: always | fileMatch | manual`, `fileMatchPattern`) — task briefs include the files that apply. glossary.md is the product's ubiquitous language (`- **Term** — definition. _Avoid: synonyms_`): clarify and doctor flag the avoided words. Idempotent — never overwrites.",
    inputSchema: { type: "object", properties: { file: { type: "string", description: "A template name, or a custom name like api-conventions.md." }, lang: { type: "string", enum: LANG_ENUM }, projectDir: PROJECT_DIR }, required: ["file"] },
  },
  {
    name: "spec_roadmap",
    description: "The multi-feature roadmap: each feature's tracks, phase, completion %, dependencies and blocked status, the overall %, cycles, the backlog and milestones; forecasts (`velocity` from _Size:_ points, each feature's `eta` + range, or a reason) and `overlaps` (active features whose open tasks plan the same files). `write: true` (re)generates .specs/ROADMAP.md (Markdown + Mermaid, git-friendly), `html: true` also ROADMAP.html; a file dev-spec did not generate is never overwritten. To change the backlog, dependencies or milestones: spec_roadmap_edit.",
    inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR, write: { type: "boolean", description: "(Re)write .specs/ROADMAP.md." }, html: { type: "boolean", description: "Also (re)write .specs/ROADMAP.html." }, lang: { type: "string", enum: LANG_ENUM, description: "Language of the roadmap chrome." } } },
  },
  {
    name: "spec_roadmap_edit",
    description: "Edit the roadmap (.specs/roadmap.json); `kind` says what. 'backlog' — planned features without a spec folder yet: `action` add (`name` + an optional one-line `note`; an existing name gets the note appended) · rm · list (default). 'depend' — a feature's dependencies and order: `name` (required) with `dependsOn` (REPLACES the list; [] clears it) or `add` / `remove`, and `order`; `name` alone shows them. Every dependency must be an existing feature; a cycle is refused. 'milestone' — a target date for a set of features: `action` add (`name`, `date` YYYY-MM-DD, `features`; an existing name is updated) · rm · list (default), each with its status against the forecasts (done · late · at-risk · on-track). An argument of another kind is refused (inapplicable-arguments).",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["backlog", "depend", "milestone"], description: "What to edit." },
        action: { type: "string", enum: ROADMAP_ACTIONS, description: "backlog / milestone: add | rm (alias remove) | list (default)." },
        name: { type: "string", description: "backlog / milestone: the item's name; depend: the feature." },
        note: { type: "string", description: "backlog add: one line (≤ 2,000 characters)." },
        dependsOn: { type: "array", items: { type: "string" }, description: "depend: REPLACES the dependency list ([] clears it)." },
        add: { type: "array", items: { type: "string" }, description: "depend: dependencies to add." },
        remove: { type: "array", items: { type: "string" }, description: "depend: dependencies to remove." },
        order: { type: "integer", description: "depend: its position in the roadmap." },
        date: { type: "string", description: "milestone add: its target day, YYYY-MM-DD." },
        features: { type: "array", items: { type: "string" }, description: "milestone add: its features (existing active ones)." },
        projectDir: PROJECT_DIR,
      },
      required: ["kind"],
    },
  },
  {
    name: "spec_scan",
    description: "Brownfield, read-only, bounded, no model. Default: inventory an EXISTING codebase — files by extension, top-level modules, stack and web frameworks, HTTP routes (method, path, file:line), test frameworks and files, entrypoints, the environment variable NAMES the code reads (never values; .env is never read) and migration / schema files — to infer the steering and reverse-engineer specs. `coverage: true` instead measures how much code the specs cover: the share of code files any feature's _Implements:_ names (active or archived), per top-level folder, the uncovered folders and the _Implements:_ entries naming nothing on disk.",
    inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR, cap: { type: "integer", minimum: 1, description: "The inventory's max code / manifest files (default 5000)." }, coverage: { type: "boolean", description: "Measure the specs' coverage of the code instead." } } },
  },
  {
    name: "spec_clarify",
    description: "Surface the ambiguities and gaps of a feature's requirements BEFORE design — vague terms, leftover placeholders / TBD, missing edge cases / NFRs / out-of-scope / failure paths, track-specific gaps, glossary words to avoid, an unstated consistency model — as the clarification questions to ask the user (fewer for a change or a size-s feature).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_next_action",
    description:
      "\"You are here, do this next\" for a feature: ONE recommended `step` — fix (an unreadable .state.json), re-review (an artifact changed after its approval — never ship it silently; `impact` names the spec_impact phases), fill / fix / approve the first unapproved phase, implement, verify (ticked tasks without passing evidence), finish, finished (asks for the execution sign-off) or drift — with a localized `recommendation`, the phase, tracks, doctor verdict and pending gates. Use it to resume work or answer 'where am I / what now?'.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: PROJECT_DIR }, required: ["name"] },
  },
  {
    name: "spec_add_track",
    description:
      "Escalate an EXISTING feature to more tracks (+tdd, +saas, +ai, +sec, +privacy, +dist, +api, +ui, +obs, +data or a track pack) — additive, never overwrites: scaffolds the missing artifacts, appends the track's design sections and template tasks, adds its steering and records the track set. `remove: true` turns tracks off instead — no file is deleted, the now-inactive artifacts are listed ('core' can't be removed; a bugfix keeps +tdd). Turning +tdd / +ai off drops their gates: only with the user's consent.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, track: { type: "string", description: "tdd | saas | ai | sec | privacy | dist | api | ui | obs | data, or a track pack — several: 'saas,ai' / '+sec +privacy'." }, remove: { type: "boolean", description: "Turn the track(s) off instead (files kept)." }, projectDir: PROJECT_DIR }, required: ["name", "track"] },
  },
  {
    name: "spec_feature",
    description:
      "A feature's lifecycle: archive (to .specs/_archive/, out of the roadmap — reversible), restore, rename (folder, slug and every reference), flow (the phase order) or remove (deletes .specs/<slug>/ — needs `confirm: true` and the user's consent; without confirm nothing is deleted and the result lists what would be; prefer archive). The roadmap (and SPECS.md) are regenerated; a folder another process is updating is never moved (`busy`).",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["remove", "archive", "rename", "restore", "flow"] }, name: { type: "string" }, newName: { type: "string", description: "rename: the new name." }, flow: { type: "string", enum: [...spec.FLOWS], description: "flow: the phase order." }, confirm: { type: "boolean", description: "remove: must be true (deletion is permanent)." }, projectDir: PROJECT_DIR }, required: ["action", "name"] },
  },
  {
    name: "spec_import",
    description:
      "Import a spec written for another tool as a NEW feature (the source is only read): `tool` kiro · spec-kit · openspec · plan (a Markdown plan — Claude Code plan mode, Cursor) · execplan (Codex) · bmad · fluidplan; or steering: kiro-steering / cursor-rules (→ .specs/steering/, existing names skipped). Scenarios become EARS criteria (else [NEEDS CLARIFICATION]), IDs are remapped to US-n.AC-m (`mapping`), tasks keep their ticks and markers. `path`: a file or folder inside the project; `text` (plan / execplan / fluidplan): the document itself — e.g. a plan kept outside the project. `dryRun: true` writes nothing and returns a `preview`.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", enum: ["kiro", "spec-kit", "openspec", "plan", "execplan", "bmad", "fluidplan", "kiro-steering", "cursor-rules"], description: "The source's format." },
        path: { type: "string", description: "The source, inside the project (required unless text)." },
        text: { type: "string", description: "plan / execplan / fluidplan: the document itself, instead of path." },
        name: { type: "string", description: "Feature name (default: the source's title)." },
        tracks: { type: "array", items: TRACK_ITEM, description: "Active tracks ('core' always added). Omit to auto-classify." },
        lang: { type: "string", enum: LANG_ENUM, description: "Artifacts' language (the imported text stays as written)." },
        dryRun: { type: "boolean", description: "Write nothing." },
        projectDir: PROJECT_DIR,
      },
      required: ["tool"], // + `path` or `text` (not for a steering tool) — REQUIRED_ONE_OF (a schema can't express "one of")
    },
  },
  {
    name: "spec_append_tasks",
    description:
      "Converge: append NEW tasks to a feature's tasks.md without touching the existing ones (numbered after the highest), under a phase heading (default 'Phase: Convergence', with a **Checkpoint:**), each with its _Requirements:_ / _Makes green:_ / _Implements:_ / _Verify:_ / _Expect: fail_ / _Size:_ / _Depends:_ lines. AC IDs, T-IDs, dependencies and paths are validated — any error writes NOTHING. New tasks invalidate an earlier tasks approval (`needsReapproval`): review and re-approve. Use it when the implementation drifted from the plan or a review found follow-up work.",
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
              text: { type: "string", description: "Task description." },
              requirements: { type: "array", items: { type: "string" }, description: "AC IDs it proves (US-1.AC-2)." },
              implements: { type: "array", items: { type: "string" }, description: "Project-relative files it touches." },
              verify: { type: "string", description: "One-line command that proves it." },
              makesGreen: { type: "array", items: { type: "string" }, description: "T-IDs it makes green." },
              expectFail: { type: "boolean", description: "Its proof is a FAILING run (a test before its fix)." },
              size: { type: "string", description: "XS | S | M | L | XL." },
              depends: { type: "array", items: { type: "integer", minimum: 0 }, description: "Task numbers to finish first." },
              story: { type: "string", description: "US<n> or shared." },
              parallel: { type: "boolean", description: "[P] — can run in parallel." },
            },
            required: ["text"],
          },
        },
        heading: { type: "string", description: "Phase heading (default: the localized 'Phase: Convergence')." },
        projectDir: PROJECT_DIR,
      },
      required: ["name", "tasks"],
    },
  },
  {
    name: "spec_impact",
    description:
      "Change request: what an edit made AFTER an approval touches — the artifact vs the snapshot its approval saved. `phase`: requirements (default — added / modified / removed IDs with the tasks, tests and design sections citing each) · design · test-plan · eval-plan · tasks · steering (the features approved under a steering file that changed since; `name` optional). `reopen: true` unticks the affected done tasks (never a removed criterion's — those come back in `retire`), marks their evidence stale and records the change request — it never edits the spec; review, then re-approve.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug (optional with phase 'steering')." },
        phase: { type: "string", enum: ["requirements", "design", "test-plan", "eval-plan", "tasks", "steering"], description: "Which approved artifact to compare (default requirements)." },
        reopen: { type: "boolean", description: "Untick the affected done tasks and record the change request (not for tasks)." },
        projectDir: PROJECT_DIR,
      },
    },
  },
  {
    name: "spec_metrics",
    description:
      "Metrics & retrospective from the local spec data (no model). With `name`: the lead time from creation to each phase's first approval, to complete and to finished; rework (re-approvals), forced approvals, change requests, reopened tasks, the evidence pass rate and open clarifications. Without `name`: every feature plus averages / medians. `velocity`: points per working day over 28 days. `write: true` (with `name`) creates .specs/<feature>/retro.md — its proposed steering amendments need the user's approval; never overwrites.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug. Omit for the whole project." },
        write: { type: "boolean", description: "Create retro.md (needs name; never overwrites)." },
        projectDir: PROJECT_DIR,
      },
    },
  },
  {
    name: "spec_drift",
    description:
      "Drift since finish: per finished feature (or `name`), the files its _Implements:_ markers name that changed, went missing or appeared since spec_finish recorded the baseline. `unbaselined`, `reopened` and `stale` (changed since its finish — finish it again) are listed apart; an unreadable state is an error, never clean. Read-only.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "One feature (active or archived). Omit for all." }, projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_upgrade",
    description:
      "After a plugin update: audit .specs/ against this engine's rules (read-only by default) — per active feature its status, doctor fails / warnings, pending gates, edits since approval, unverified tasks, drift, the next step and a review recommendation (critic · converge · none), plus `plan` (what apply would change). `apply: true` — only after the user agrees — runs the safe migrations (saves inferred tracks, seeds the approval history, completes .specs/.gitignore, stamps meta.specVersion, writes .specs/UPGRADE.md); it never edits an artifact, approves, ticks or deletes.",
    inputSchema: { type: "object", properties: { apply: { type: "boolean", description: "Run the safe migrations (default: the read-only audit)." }, projectDir: PROJECT_DIR } },
  },
  {
    name: "spec_templates",
    description:
      "Project templates in .specs/templates/: `<artifact>.md` replaces the built-in template for new features (`<lang>/<artifact>.md` (en | pt | pt-BR | es) wins for that language), `steering/<file>.md` a steering stub; {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}} are substituted and the active tracks' sections still appended. `action`: list (default — built-in vs project per artifact) · init (copy the built-in templates for editing, never overwriting) · check (validate them: {file, line, code, severity, message} + a verdict).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "init", "check"], description: "list (default) | init | check." },
        artifact: { type: "string", description: "One template (requirements, design, tasks, bug, change… or steering/<file>.md). Omit for all." },
        lang: { type: "string", enum: LANG_ENUM, description: "The language to resolve, copy or check (default: the project's)." },
        projectDir: PROJECT_DIR,
      },
    },
  },
  {
    name: "spec_tracks",
    description:
      "Project-defined tracks (track packs in .specs/tracks/<name>/ — data only, nothing runs): a team's own rigor (+a11y, +mobile…) beside the built-in tracks. A valid pack works as a marker track everywhere; a bad one is reported and ignored whole (format: references/project-tracks.md). `action`: list (default) · init (scaffold an example pack `name`) · check (validate) · signals (the classifier's learned overrides in .specs/classifier.json — `op` list · set {track, word, effect} · forget).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "init", "check", "signals"], description: "list (default) | init | check | signals." },
        name: { type: "string", description: "init: the new pack's name; list / check: one pack." },
        lang: { type: "string", enum: LANG_ENUM, description: "init: the example's language (default: the project's)." },
        op: { type: "string", enum: ["list", "set", "forget"], description: "signals: list (default) | set | forget." },
        track: { type: "string", description: "signals set / forget: the track." },
        word: { type: "string", description: "signals set / forget: the word or phrase." },
        effect: { type: "string", enum: ["off", "weak", "strong"], description: "signals set: off | weak (an anchor) | strong (turns the track on alone)." },
        projectDir: PROJECT_DIR,
      },
    },
  },
  {
    name: "spec_export",
    description:
      "Documents generated from the specs. `format`: html (default) / md — ONE self-contained, offline, printable stakeholder document: a feature (`name`, in its language) or the whole project · csv — the requirements traceability matrix · gherkin — a .feature per feature (the EARS clauses as steps, never invented) · jira / linear — a tracker import CSV (nothing is sent) · adr — decisions.md as MADR files · catalog — the living catalog: every feature and AC with its status, superseded criteria named (.specs/SPECS.md) · changelog — release notes from the specs: Added / Changed / Fixed since `since`, or of one `milestone` (.specs/RELEASE-NOTES.md). `write: true` writes the file (AUTO-GENERATED; a hand-written one is never overwritten) and returns its path. Without write: html / md return a markdown `preview`, catalog / changelog their structure — `includeBody: true` adds the whole document.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "One feature (not for catalog / changelog). Omit for the whole project." },
        format: { type: "string", enum: spec.EXPORT_FORMATS.slice(), description: "Default html." },
        write: { type: "boolean", description: "Write the file instead of returning it." },
        includeBody: { type: "boolean", description: "html / md / catalog / changelog without write: return the whole document." },
        since: { type: "string", description: "changelog: an ISO date / timestamp, 'last' (default — since the last written notes) or 'all'." },
        milestone: { type: "string", description: "changelog: only this milestone's features." },
        projectDir: PROJECT_DIR,
      },
    },
  },
  {
    name: "spec_decide",
    description:
      "Decision log: append ONE entry to .specs/<feature>/decisions.md — `## D-<n> — <title>` with _Kind:_ decision | discovery, _Date:_, _Affects:_, _Supersedes:_ and Context / Decision / Consequences. Append-only: an entry is never renumbered or rewritten. `affects` must name what exists (an AC / T / EC / NFR / SC ID, or a design section) and `supersedes` earlier entries — else nothing is written (`unknownAffects`).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug (a spike or a bugfix too)." },
        title: { type: "string", description: "One line (≤ 200 characters)." },
        decision: { type: "string", description: "What was decided (a discovery: what was found)." },
        context: { type: "string", description: "Optional: why — the forces, the options weighed." },
        consequences: { type: "string", description: "Optional: what follows from it." },
        affects: { type: "array", items: { type: "string" }, description: "Optional: AC / T / EC / NFR / SC IDs, or design section headings as design.md spells them ('Data Models')." },
        supersedes: { type: "array", items: { type: "string" }, description: "Optional: the entries it replaces (D-1)." },
        kind: { type: "string", enum: ["decision", "discovery"], description: "decision (default) | discovery." },
        projectDir: PROJECT_DIR,
      },
      required: ["name", "title", "decision"],
    },
  },
  {
    name: "spec_stop_check",
    description:
      "The end-of-turn evidence gate for MCP-only clients (no Stop hook) — the plugin's Stop hook decision. BEFORE sending a closing message that says the work is done or verified, pass it: `block: true` means a recently active feature has ticks without verification evidence (or project checks without a passing run) and `reason` lists them — record the runs, or say plainly what is NOT verified, then check again; `block: false` carries a stable `why`. `agent` (spec-implementer / spec-simplifier) checks that subagent's report instead. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The closing message you are about to send." },
        agent: { type: "string", description: "Optional: spec-implementer | spec-simplifier." },
        projectDir: PROJECT_DIR,
      },
      required: ["message"],
    },
  },
  {
    name: "spec_log",
    description:
      "Git-linked evidence: per active task of a feature, the commits whose message cites it (the slug + \"task #N\" / \"#N\", or one of its T / AC IDs), plus (+tdd) a red-first check (`impl-first`: the code committed before its test). THIS SERVER NEVER RUNS GIT: pass `gitLog`, the output of `git log --name-only --relative` run in the project — for a feature on its own branch (spec_status `branch`) `git log <branch.commit>..HEAD --name-only --relative`; an empty log is valid.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        gitLog: { type: "string", description: "That output (e.g. with --max-count=1000) — never run by this server." },
        max: { type: "integer", minimum: 1, description: "Optional: the --max-count it was read with." },
        projectDir: PROJECT_DIR,
      },
      required: ["name", "gitLog"],
    },
  },
];

// --- Tool annotations (MCP 2025-03-26+) -------------------------------------
// Hints for clients, one entry per tool (mcp/test.js requires every tool listed here) — never a security boundary: the engine
// enforces its own rules whatever a client makes of them. readOnlyHint: true only when NO argument can make the tool write
// (spec_roadmap / spec_export / spec_metrics / spec_task_brief write with `write: true`, spec_impact with `reopen`, spec_upgrade
// with `apply`, spec_templates / spec_tracks with `init` — so they are not read-only; a read-only tool never touches .specs/ —
// mcp/test.js snapshots the tree around each). destructiveHint (MCP: false = "only additive updates"): every tool one of whose
// arguments removes or overwrites a record the user made (only spec_feature carried it): spec_feature (remove
// deletes a feature folder), spec_export (adr: removes the generated ADR files no decision backs), spec_approve (revoke),
// spec_complete_task (undo), spec_impact (reopen unticks), spec_roadmap_edit (rm; depend's dependsOn replaces the list, [] clears
// it), spec_add_track (remove), spec_init (an empty check command removes it, approvalRoles {} clears them, a setting is
// overwritten) and spec_tracks (signals set overwrites / forget removes an override). The rest only add records or regenerate
// their own derived files (ROADMAP.*, SPECS.md, a brief, a merge summary). idempotentHint: a second identical call changes nothing
// more (a tick, an approval, an appended task or decision, finish's evidence each add a record: false). openWorldHint: false
// everywhere — local files only, no network, no command, no git.
const READ_ONLY = Object.freeze({ readOnlyHint: true, openWorldHint: false });
const writes = (idempotent, destructive) => Object.freeze({ readOnlyHint: false, destructiveHint: !!destructive, idempotentHint: idempotent, openWorldHint: false });
const TOOL_ANNOTATIONS = {
  spec_init: writes(true, true), spec_classify: READ_ONLY, spec_create: writes(true), spec_status: READ_ONLY,
  spec_next_task: READ_ONLY, spec_task_brief: writes(true), spec_finish: writes(false), spec_complete_task: writes(false, true),
  ears_validate: READ_ONLY, trace_check: READ_ONLY, spec_doctor: READ_ONLY, spec_approve: writes(false, true), steering_scaffold: writes(true),
  spec_roadmap: writes(true), spec_roadmap_edit: writes(true, true), spec_scan: READ_ONLY,
  spec_clarify: READ_ONLY, spec_next_action: READ_ONLY, spec_add_track: writes(true, true), spec_feature: writes(true, true),
  spec_import: writes(true), spec_append_tasks: writes(false), spec_impact: writes(true, true), spec_metrics: writes(true),
  spec_drift: READ_ONLY, spec_upgrade: writes(true), spec_templates: writes(true), spec_tracks: writes(true, true),
  spec_export: writes(true, true), spec_decide: writes(false), spec_stop_check: READ_ONLY, spec_log: READ_ONLY,
};
// A tool missing from the table gets the protocol's own defaults spelled out (may write, may destroy, not idempotent) — the
// test fails on it anyway.
for (const t of TOOLS) t.annotations = Object.prototype.hasOwnProperty.call(TOOL_ANNOTATIONS, t.name) ? TOOL_ANNOTATIONS[t.name] : writes(false, true);

// --- Hidden aliases (the tools folded into others) ----------------------------------------------------------------------
// spec_list → spec_status (no name) · spec_backlog / spec_depend / spec_milestone → spec_roadmap_edit {kind} · spec_catalog /
// spec_changelog → spec_export {format} · spec_coverage → spec_scan {coverage: true}. A tools/call by an old name still works:
// its arguments are checked against the OLD schema (an old caller gets the very refusals it got — unknown, missing, invalid, by
// the old names), then translated, and the NEW tool runs — the result is the new tool's. Never listed (tools/list), never
// completed (completion/complete completes prompts and resources, no tool). docs/maintainers/mcp.md → Hidden aliases.
const ACTION = (actions) => ({ type: "string", enum: actions.slice() });
const STRINGS = Object.freeze({ type: "array", items: { type: "string" } });
const LEGACY_TOOLS = [
  { name: "spec_list", to: "spec_status", args: () => ({}), inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR } } },
  { name: "spec_backlog", to: "spec_roadmap_edit", args: (a) => ({ kind: "backlog", action: a.action, name: a.name, note: a.note }),
    inputSchema: { type: "object", properties: { action: ACTION(spec.BACKLOG_ACTIONS), name: { type: "string" }, note: { type: "string" }, projectDir: PROJECT_DIR } } },
  { name: "spec_depend", to: "spec_roadmap_edit", args: (a) => ({ kind: "depend", name: a.name, dependsOn: a.dependsOn, add: a.add, remove: a.remove, order: a.order }),
    inputSchema: { type: "object", properties: { name: { type: "string" }, dependsOn: STRINGS, add: STRINGS, remove: STRINGS, order: { type: "integer" }, projectDir: PROJECT_DIR }, required: ["name"] } },
  { name: "spec_milestone", to: "spec_roadmap_edit", args: (a) => ({ kind: "milestone", action: a.action, name: a.name, date: a.date, features: a.features }),
    inputSchema: { type: "object", properties: { action: ACTION(spec.MILESTONE_ACTIONS), name: { type: "string" }, date: { type: "string" }, features: STRINGS, projectDir: PROJECT_DIR } } },
  { name: "spec_catalog", to: "spec_export", args: (a) => ({ format: "catalog", write: a.write }),
    inputSchema: { type: "object", properties: { write: { type: "boolean" }, projectDir: PROJECT_DIR } } },
  { name: "spec_changelog", to: "spec_export", args: (a) => ({ format: "changelog", since: a.since, milestone: a.milestone, write: a.write }),
    inputSchema: { type: "object", properties: { since: { type: "string" }, milestone: { type: "string" }, write: { type: "boolean" }, projectDir: PROJECT_DIR } } },
  { name: "spec_coverage", to: "spec_scan", args: () => ({ coverage: true }), inputSchema: { type: "object", properties: { projectDir: PROJECT_DIR } } },
];
const LEGACY = new Map(LEGACY_TOOLS.map((t) => [t.name, t]));
// A tool's definition by name — a listed tool or a hidden alias (whose schema is the old one): what the argument checks read.
const toolDef = (name) => TOOLS.find((t) => t.name === name) || LEGACY.get(name);
// An alias call → the new tool's name and arguments (projectDir carried over; an absent / null argument stays absent).
function translateLegacy(legacy, args) {
  const out = legacy.args(args);
  if (args.projectDir != null) out.projectDir = args.projectDir;
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === null) delete out[k];
  return { name: legacy.to, args: out };
}

// --- Arguments by mode ----------------------------------------------------------------------------------------------
// A tool that took over others takes some arguments in one of its modes only — `kind` (spec_roadmap_edit), `format` (spec_export),
// `coverage` (spec_scan). An argument the call's mode doesn't take is refused before anything runs (code inapplicable-arguments,
// `inapplicable` [names] — before 1.26 it was another tool's argument, an unknown one), and a mode's `required` ones are missing
// arguments. The mode key itself and projectDir go everywhere. fallback: the mode when the key is not given. Derived from the
// operations table (mcp/lib/operations.js) — a mode's arguments are its operation's — { tool: { key, fallback?, modes: {value:
// [arguments]}, required?: {value: [arguments]} } }.
const ARG_MODES = OPS.argModes();
// The call's mode → { key, value, takes, required } (takes: the arguments it accepts), or null (a tool without modes, or a value the
// enum check refuses).
function argMode(toolName, args) {
  const m = hasOwn(ARG_MODES, toolName) ? ARG_MODES[toolName] : null;
  if (!m) return null;
  const value = args[m.key] == null ? m.fallback : args[m.key];
  const key = String(value);
  if (!hasOwn(m.modes, key)) return null;
  return { key: m.key, value, takes: m.modes[key], required: (m.required && hasOwn(m.required, key) && m.required[key]) || [] };
}
// The arguments given that the call's mode doesn't take → { names, mode, allowed } | null.
function inapplicableArgs(toolName, args) {
  const mode = argMode(toolName, args);
  if (!mode) return null;
  const names = Object.keys(args).filter((k) => args[k] != null && k !== mode.key && k !== "projectDir" && !mode.takes.includes(k));
  return names.length ? { names, mode: mode.key + ": " + JSON.stringify(mode.value), allowed: mode.takes.join(", ") } : null;
}
// Claude Code plugin mode (SPEC_MCP_APPROVAL_HOOK=on — mcp/servers.json): the plugin's own hooks do what these two are for (the
// Stop hook answers spec_stop_check's question at every turn's end; the CLI reads git for `log`), so they are not LISTED there —
// characters an agent would pay on every session for nothing. Both stay callable by name.
const PLUGIN_UNLISTED = new Set(["spec_stop_check", "spec_log"]);

// --- Tool dispatch ---------------------------------------------------------

// The feature-lock wait. The engine is synchronous: a call waiting for a lock another LIVE process holds (a CLI
// `done`, another editor's server) froze the whole server — pings, every other tool, a pending approval's reply — for
// DEV_SPEC_LOCK_WAIT_MS (10 s by default). The server waits MCP_LOCK_WAIT_MS instead, then answers the usual localized busy
// refusal (retry in a moment); an explicit DEV_SPEC_LOCK_WAIT_MS (a slow network file system) still wins. Set in this process's
// env: the engine reads it at every acquisition (lockWaitMs), and the server starts no child process.
const MCP_LOCK_WAIT_MS = 2000;
if (!/^\d{1,7}$/.test(String(process.env.DEV_SPEC_LOCK_WAIT_MS || "").trim())) process.env.DEV_SPEC_LOCK_WAIT_MS = String(MCP_LOCK_WAIT_MS);

// extra (set by the server, never by a tool call): { dryRun } the preview before the user is asked,
// { confirmation } the user's answer (elicitation), recorded with the approval, and { preview } what that dry run
// judged — the content fingerprint(s) and the failing checks the question showed: the engine refuses to record anything else.
// spec_feature remove: { preview: {fingerprint} } — the folder the question named; another one now is not deleted.
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
  // the tool's operation (mcp/lib/operations.js) — the engine call the CLI makes too, each option read from its argument by the
  // same table; a folded tool's mode (or the call's arguments) picks it. The server's own options are the extra ones it declares.
  const op = OPS.forTool(name, args);
  if (!op) throw new Error("Unknown tool: " + name);
  const own = {};
  const mine = OPS.internalOf(op, "mcp");
  if (extra && extra.dryRun === true && mine.includes("dryRun")) own.dryRun = true;
  if (extra && extra.confirmation && mine.includes("confirmation")) own.confirmation = extra.confirmation;
  if (extra && TYPE_CHECK.object(extra.preview) && mine.includes("preview")) own.preview = extra.preview;
  return OPS.run(op, spec, pdir, "mcp", (a) => (a.mcp === undefined ? undefined : args[a.mcp]), own);
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
// A reply to a request that finished LATER (an approval waiting for the user) goes where its request came from: the
// batch it arrived in (the batch's reply array waits for it) or straight out.
function sendTo(sink, msg) {
  if (sink) sink.push(msg);
  else process.stdout.write(frame(msg));
}

// --- Human approvals over MCP elicitation --------------------------------------------------------------------------
// With roadmap.json meta.approvalGuard ask | deny, an AGENT's approval — spec_approve (approve, revoke, fast-forward, force /
// waiver), spec_feature remove {confirm}, spec_init lowering a protection: the approval guard's own reading of the call
// (spec.approvalGuardDecision) — is the human's to make. In Claude Code the plugin's PreToolUse hook asks / refuses (and
// mcp/servers.json sets SPEC_MCP_APPROVAL_HOOK=on: the server leaves `ask` to the hook — that path is unchanged; a `deny`-level
// call that still reaches the server got past no hook — it is handled below as in any client). In any other
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
// spec_add_track: turning +tdd / +ai off drops the gates they carry — asked like dropping a role.
const APPROVAL_TOOLS = new Set(["spec_approve", "spec_feature", "spec_init", "spec_add_track"]);
const APPROVAL_HOOK = /^(?:on|1|true|yes)$/i.test(String(process.env.SPEC_MCP_APPROVAL_HOOK || "").trim());
const ELICIT_TIMEOUT_MS = (() => {
  const n = Number(String(process.env.DEV_SPEC_ELICIT_TIMEOUT_MS || "").trim());
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, 60 * 60 * 1000) : 5 * 60 * 1000;
})();
// While a question waits and the call carried a progressToken: notifications/progress at once, then every this many ms —
// a client whose tool-call timeout restarts on progress doesn't give up on the call while its user reads the question.
const PROGRESS_EVERY_MS = 10 * 1000;
let clientElicits = false; // initialize: the client declared capabilities.elicitation (form mode — 2025-11-25 adds url mode)
// Requests this server sent the client (elicitation/create, roots/list), by id → the handler of their response.
const serverRequests = new Map();
let serverRequestSeq = 0;
// → { rid, promise, cancel(reason) }. The promise resolves to the client's response, { timeout: true } (no answer within
// timeoutMs) or { cancelled: true } (cancel(): the request that needed it was cancelled); the last two tell the client
// (notifications/cancelled for our request id), so it can close the question. `late` (roots/list): a timeout
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
// tools/call requests still running after their handler returned (waiting for the user, or for the client's roots), by
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
// the guard's guard-down reading fails closed). Decoded as the engine reads it (spec.decodeText — a UTF-16
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
  // policy, a hook that failed open): deny must still refuse here — it is "refused in every mode".
  if (APPROVAL_HOOK && level !== "deny") return null;
  let lang = spec.projectLang(pdir);
  if (typeof args.name === "string" && args.name.trim()) {
    const f = spec.existingFeature(pdir, args.name);
    if (f.ok) lang = spec.featureLang(pdir, f.slug);
  }
  // plain: this client is not Claude Code (its hook would have answered — SPEC_MCP_APPROVAL_HOOK), so the command
  // the user runs is the plain line, never `! …` (Claude Code's prefix: a PowerShell user can't run it), and the reason says so.
  // resolveFeature: the question (and the command) name the feature the engine will act on — its slug — never the raw
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
    // the user judges THIS version — up to minutes pass before they answer; what is recorded must be what they saw
    // (the same content, per phase for a fast-forward, and — forced — no check failing that the question didn't name).
    if (!pre.revoke) preview = Array.isArray(pre.chain) ? { chain: pre.chain, fingerprints: pre.fingerprints }
      : Object.assign({ fingerprint: pre.fingerprint == null ? null : pre.fingerprint, failing: Array.isArray(pre.failing) ? pre.failing : [] }, pre.designFingerprint ? { designFingerprint: pre.designFingerprint } : {});
    // a revocation removes THE approval (and the waiting sign-offs) the question named — another one recorded
    // while the user read it is not revoked in its place (the engine compares them: changed-since-preview, nothing written).
    else preview = { approvedAt: typeof pre.approvedAt === "string" ? pre.approvedAt : null, withdrawn: TYPE_CHECK.object(pre.withdrawn) ? pre.withdrawn : {} };
    if (Array.isArray(pre.chain)) details.push(E.phases(pre.chain.join(", ")));
    if (Array.isArray(pre.failing) && pre.failing.length) details.push(E.forced(pre.failing.join(", ")));
    else if (!pre.revoke && !pre.chain) details.push(E.gatePasses);
    if (pre.waiver) details.push(E.waiver(pre.waiver.reason, pre.waiver.expires));
  } else if (toolName === "spec_feature") {
    // remove's own preview (no confirm): a feature that doesn't exist is answered as it is — nobody is asked
    const pre = runTool(toolName, { action: "remove", name: args.name, projectDir: args.projectDir });
    if (pre && pre.ok === false && !pre.needsConfirm) return pre;
    // the user confirms deleting THIS folder — another feature renamed into the name, or files edited while the question
    // waits, is not deleted (the engine compares the fingerprint under the folder's lock: changedSincePreview).
    if (pre && typeof pre.fingerprint === "string") preview = { fingerprint: pre.fingerprint };
    // how much it deletes — the preview's file count (the user weighs a scratch folder and weeks of work alike)
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
    // an accept without approve: true is its own answer (the user replied, Approve left unticked) — not "declined"
    return refusal({ action }, action === "cancel" ? E.cancelled(list) : action === "accept" ? E.unapproved(list) : E.declined(list));
  }
  const note = typeof answer.note === "string" ? answer.note.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  const confirmation = Object.assign({ via: "elicitation", at: new Date().toISOString() }, note ? { note } : {});
  const out = runTool(toolName, args, Object.assign({ confirmation }, preview ? { preview } : {}));
  // `confirmed` goes with a call that ran — never onto a failed one (a fast-forward stopped by a later gate, an
  // error): the phases it did approve carry their own `confirmed` in .state.json.
  if (TYPE_CHECK.object(out) && out.ok !== false) out.confirmed = Object.assign({}, confirmation, { message: E.confirmed });
  return out;
}
// A tool's result: its JSON, COMPACT (the indentation was ~22% of a reply's characters, which an agent pays in
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
// Groups of arguments of which ONE is required — a schema's `required` can't say "path or text" (spec_import): none
// given → the group's first name is reported missing, as a required key would be. `unless`: the call needs none of them (a
// steering import — kiro-steering / cursor-rules — reads the tool's own folder when no path is given).
const REQUIRED_ONE_OF = { spec_import: [{ names: ["path", "text"], unless: (a) => spec.STEERING_IMPORT_TOOLS.includes(a.tool) }] };
// Required string arguments for which an empty (or whitespace-only) value is a real value, not "not given":
// an empty git log is what `git log` prints in a repository without commits (→ 0 commits), an empty closing message claims
// nothing (→ no-claim) — the CLI's `log <f> -` / `stop-check --message ""` accept them, so MCP does too.
const EMPTY_OK = { spec_log: ["gitLog"], spec_stop_check: ["message"] };
function missingArgs(toolName, args) {
  const tool = toolDef(toolName); // a hidden alias: its OLD schema
  if (!tool || !tool.inputSchema) return [];
  const emptyOk = hasOwn(EMPTY_OK, toolName) ? EMPTY_OK[toolName] : [];
  const given = (k) => !(args[k] === undefined || args[k] === null || (typeof args[k] === "string" && !args[k].trim() && !emptyOk.includes(k)));
  const missing = (Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []).filter((k) => !given(k));
  for (const group of hasOwn(REQUIRED_ONE_OF, toolName) ? REQUIRED_ONE_OF[toolName] : []) if (!group.unless(args) && !group.names.some(given)) missing.push(group.names[0]);
  // what the call's mode can't do without (ARG_MODES — spec_roadmap_edit {kind: "depend"} needs its feature's name)
  const mode = argMode(toolName, args);
  for (const k of mode ? mode.required : []) if (!given(k) && !missing.includes(k)) missing.push(k);
  // a NESTED object's `required` keys too (spec_finish evidence[n] {name, command, exitCode}, spec_append_tasks tasks[n].text)
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

// Arguments the tool's inputSchema doesn't list → { unknown: [{argument, didYouMean?}], valid } (valid: what the
// message lists — the tool's own names, and for a nested key the names its object takes). They used to be dropped, and the call
// did something else than asked: spec_approve {revoked: true} RE-APPROVED changed content, spec_task_brief {task: 3} briefed the
// next task, spec_export {feature} exported the whole project. Like the CLI's unknown flag, such a call is refused before
// anything runs. An absent or null value is "not given" (the rule of every argument) — never an error. The suggestion: a word
// people type for an argument (ARG_ALIASES, when the tool takes it), else the nearest name (spec.closestName).
// NESTED keys too — an object whose schema lists `properties` (an array's items included): spec_append_tasks {tasks:
// [{text, verfy: "npm test"}]} appended a task with no _Verify:_ (then ticked "verified, nothing to verify"), spec_finish
// {evidence: [{…, sumary}]} dropped the summary. The argument is the key's path (`tasks[0].verfy`), the suggestion too.
const ARG_ALIASES = { feature: "name", slug: "name", task: "number", tasknumber: "number", project: "projectDir", dir: "projectDir",
  projectdirectory: "projectDir", untick: "undo", unapprove: "revoke" };
function unknownArgs(toolName, args) {
  const tool = toolDef(toolName); // a hidden alias: its OLD schema
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
// (unknownArgs; it used to be ignored — nested keys too since 1.25.1), and so is a missing nested required key.
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
// engine's (spec.isNetworkPath — the status line and the plan-mode hook skip such a folder too).
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
// projectDir as a tool argument, read WITHOUT any fs call → { none: true } not given (absent, blank, or a
// variable left unexpanded — `${workspaceFolder}/x`, `$HOME`, `%CD%`: spec.unexpandedVar, the engine's own rule) · { dir } the
// absolute folder it names (a local file:// URI — what roots/list hands a client — is its path; a RELATIVE path resolves from
// the client's root when roots chose the default project, else from the server's working folder) · { code, message(A) } refused:
// project-dotdot (a '..' segment — never resolved away first), project-network (a network / device path, a file:// URI naming a
// host) or project-uri (a file:// URI that is no local folder path). hooks/hook-utils.js parseProjectDir reads it —
// the approval hook reads the same projectDir the same way.
function parseProjectDir(v) {
  if (!projectDirGiven(v)) return { none: true };
  const s = v.trim();
  const r = HOOK_UTILS.parseProjectDir(s, rootsDir || process.cwd());
  if (r.code === "project-dotdot") return { code: r.code, message: (A) => A.dotdot };
  if (r.code === "project-network") return { code: r.code, message: (A) => A.network(s) };
  if (r.code === "project-uri") return { code: r.code, message: (A) => A.projectUri(s) };
  return r.none ? { none: true } : { dir: r.dir };
}
// The tool call's projectDir, checked and resolved → { args } (projectDir: the absolute folder; not given → the
// client's root when roots gave the default project, else left out — the engine's default) or { refuse: {code, error} }. It names
// an EXISTING folder, as the CLI's --project does: only spec_init creates one — a mistyped path used to get a
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
  // spec_import reads the files its path names and returns them (dryRun: `preview`) — {projectDir: "<home>/.aws",
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
  if (schema.minItems != null) d += " " + A.atLeastItems(schema.minItems); // spec_append_tasks.tasks
  return d;
}
function schemaIssues(schema, value, where, out) {
  const types = [].concat(schema.type || []);
  const bad = () => out.push({ where, schema, value });
  if (types.length && !types.some((t) => hasOwn(TYPE_CHECK, t) && TYPE_CHECK[t](value))) return bad();
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return bad();
  if (typeof value === "number" && schema.minimum != null && value < schema.minimum) return bad();
  if (typeof value === "number" && schema.maximum != null && value > schema.maximum) return bad(); // spec_next_task.max
  if (Array.isArray(value) && schema.minItems != null && value.length < schema.minItems) return bad(); // tasks: [] appended nothing
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
  const tool = toolDef(toolName); // a hidden alias: its OLD schema
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
// a string that also reads 'true' / 'false' (spec_create {branch}: 'true' = the default name, or the name itself) — a boolean
// given for it becomes that string before validation (the schema stays one plain `type`, as guard's on / off: some MCP clients
// reject a list-valued type).
const BOOL_STRING_ARGS = { spec_create: new Set(["branch"]) };
function foldEnumArgs(toolName, args) {
  const tool = toolDef(toolName); // a hidden alias: its OLD schema
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
// An argument error: {ok: false, error: <localized>, code: <stable, English>, …what it names} — callers branch
// on the code: unknown-argument {unknown} · missing-arguments {missing} · invalid-arguments {invalid} · project-dotdot ·
// project-network · project-uri · project-missing · project-not-dir.
function argError(id, message, code, extra) {
  return toolReply(id, Object.assign({ ok: false, error: message, code }, extra || {}), batchSink);
}
// A tool that threw (a file system error: ENOTDIR, EACCES…) → the JSON result every other refusal is (it was the bare
// text "ERROR: <message>"): {ok: false, error: <localized prefix + the message>, code: <the error's code, when it has one>}.
function toolFailure(e, args) {
  const out = { ok: false, error: argMessages(args).toolFailed((e && e.message) || String(e)) };
  if (e && e.code != null) out.code = String(e.code);
  return out;
}

// --- The default project from the client's roots ---------------------------------------------------------------------
// With neither SPEC_PROJECT_DIR nor CLAUDE_PROJECT_DIR set (Claude Desktop, a global Cursor / Windsurf / Gemini config), the
// default project was the server's cwd — an app or home folder, where spec_init then scaffolded .specs/. A client that declares
// `roots` is asked once (roots/list, on the first request that needs the project) and its first local file:// root becomes the
// default: tools/call without a projectDir gets it as one, and resources / prompts / completions read it. A network root
// (file://host/…), one with '..', or no usable root → the old default (cwd). notifications/roots/list_changed asks again.
// no answer within ROOTS_TIMEOUT_MS → the cwd for now, but the question stays open: an answer that comes later
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
// drive path only — file:///C:/x, file:///c%3A/x). The approval hook's own reading (hooks/hook-utils.js).
const fileUriToPath = (uri) => HOOK_UTILS.fileUriToPath(uri);
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
// `%NAME%` (spec.unexpandedVar, the engine's own rule — resolveProjectDir). Only a whole `${VAR}` was caught, so with
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
    case "resources/list": { // pages: nextCursor while there are more; a cursor this server didn't hand out is Invalid params
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
    case "completion/complete": { // feature slugs, artifact / steering names — an unknown ref or argument is Invalid params
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
  // A notification is a message WITHOUT an id member: it never gets a response — and never runs a tool. Two change state:
  // notifications/cancelled withdraws a request still waiting (inflight), notifications/roots/list_changed forgets the roots.
  if (!hasOwn(msg, "id")) {
    if (method === "notifications/cancelled") onCancelled(params);
    else if (method === "notifications/roots/list_changed" && !rootsWait) rootsDir = undefined;
    return;
  }
  // A JSON-RPC RESPONSE (result / error, no method) is never answered — whatever its id: a client's error response to a
  // request it couldn't parse carries id null (checked before the id rule). One that answers a request THIS
  // server sent (elicitation/create; roots/list) settles it.
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

  // the default project may come from the client's roots — asked once, on the first request that reads the project.
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
        // a client that can ask its user (capabilities.elicitation) gets the approval guard's questions (elicitation/create)
        // — in form mode: `{}` (2025-06-18) or `{form: {…}}` (2025-11-25); a client declaring url mode only can't show a form.
        const el = caps.elicitation;
        clientElicits = TYPE_CHECK.object(el) && (!Object.keys(el).length || TYPE_CHECK.object(el.form));
        clientRoots = TYPE_CHECK.object(caps.roots); // the default project from roots/list (rootsPending)
        rootsDir = undefined;
        rootsGen++; // an answer to an earlier session's roots/list no longer applies
        rootsWait = null;
        return result(id, {
          protocolVersion: proto,
          serverInfo: SERVER_INFO,
          // completions: completion/complete for the prompts' feature argument and the specs:// template variables.
          capabilities: PROMPTS_ON
            ? { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false, subscribe: false }, completions: {} }
            : { tools: { listChanged: false }, resources: { listChanged: false, subscribe: false }, completions: {} },
          instructions:
            "Local spec-driven engine. Use spec_classify to pick tracks, spec_init to scaffold steering, spec_create to scaffold a feature, then spec_status / spec_next_task / spec_complete_task to drive execution (spec_task_brief builds a self-contained brief per task for subagent execution). To resume a feature or answer 'where am I / what now?', call spec_next_action {name}: where it stands and the ONE next step. Evidence before claims: tick a task (spec_complete_task) only with the run of its _Verify:_ command that you or the user actually made — if you cannot run it, ask for its output instead of ticking (never send a subagent to look for a shell). A CLI line you give the user is the runnable one the tools print — `" + spec.DEV_SPEC + " …` (a plugin install has no `dev-spec` on PATH). ears_validate, trace_check and spec_doctor enforce quality gates. Approvals are the user's: with meta.approvalGuard ask / deny, spec_approve asks the user through the client (elicitation) when it can. After a plugin update, spec_upgrade audits an existing .specs/ (apply: the safe migrations). Everything is local: writes stay in the project's .specs/, reads inside the project (spec_scan / trace_check {code} read its code; spec_import a source inside it — never a hidden folder or a non-document file, and with another projectDir only a dev-spec project's); no network, no command, no git." +
            (PROMPTS_ON ? " Prompts: one per plugin command (spec, spec-status, spec-impact, …) — the slash-command workflow for clients without the dev-spec-driven skill." : "") +
            " Resources (read-only): the project's spec artifacts — specs://roadmap, specs://catalog, specs://steering/{file}, specs://feature/{slug}/{artifact}.",
        });
      }
      case "ping":
        return result(id, {});
      case "tools/list": // in Claude Code plugin mode without the two its hooks cover (PLUGIN_UNLISTED — still callable)
        return result(id, { tools: APPROVAL_HOOK ? TOOLS.filter((t) => !PLUGIN_UNLISTED.has(t.name)) : TOOLS });
      case "prompts/list": case "prompts/get": case "resources/list": case "resources/templates/list": case "resources/read":
      case "completion/complete":
        return handleContent(id, method, params);
      case "tools/call": {
        const toolName = TYPE_CHECK.object(params) ? params.name : undefined;
        // No such tool — or no params / no name at all: JSON-RPC Invalid params (-32602), as MCP specifies for an unknown
        // tool. It used to be a SUCCESSFUL result {isError: true, "ERROR: Unknown tool: nope"}. Localized (project language).
        if (typeof toolName !== "string" || !toolDef(toolName)) { // a listed tool, or a hidden alias (LEGACY_TOOLS)
          const A = argMessages(TYPE_CHECK.object(params) && TYPE_CHECK.object(params.arguments) ? params.arguments : undefined);
          return error(id, -32602, typeof toolName === "string" && toolName.trim() ? A.unknownTool(toolName) : A.noTool);
        }
        const rawArgs = params.arguments;
        if (rawArgs != null && !TYPE_CHECK.object(rawArgs)) return argError(id, argMessages().notObject, "invalid-arguments", { invalid: ["arguments"] });
        const folded = foldEnumArgs(toolName, rawArgs || {});
        // an argument the schema doesn't list is refused FIRST — a misspelt required key reads as unknown (with its
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
        // a hidden alias (an old tool name) — checked above against its old schema, it runs as the new tool with its
        // arguments translated (spec_list → spec_status, spec_backlog → spec_roadmap_edit {kind: "backlog"}…)
        const legacy = LEGACY.get(toolName);
        const call = legacy ? translateLegacy(legacy, folded) : { name: toolName, args: folded };
        // an argument of another mode of the tool (spec_roadmap_edit's kind, spec_export's format, spec_scan's coverage)
        const off = inapplicableArgs(call.name, call.args);
        if (off) return argError(id, argMessages(folded).inapplicable(call.name, off.mode, off.names.join(", "), off.allowed), "inapplicable-arguments", { inapplicable: off.names });
        // projectDir checked and resolved — an existing folder (spec_init may create it), a file:// URI read as its
        // path, a relative one from the client's root; not given → the client's root when its roots gave the default
        const pd = projectDirArg(call.name, call.args);
        if (pd.refuse) return argError(id, pd.refuse.error, pd.refuse.code);
        const args = pd.args;
        // an agent's approval under meta.approvalGuard ask | deny — asked of the user (elicitation: the reply comes
        // later, the server keeps answering meanwhile) or refused (deny, a client that can't ask). The call waits as an
        // inflight entry — cancelled by the client, its question is withdrawn and it gets no reply.
        const policy = approvalPolicy(call.name, args);
        if (policy && policy.elicit) {
          const sink = batchSink;
          const key = flightKey(id);
          const flight = { cancelled: false, cancel: null };
          inflight.set(key, flight);
          const finish = (o) => {
            if (inflight.get(key) === flight) inflight.delete(key);
            if (!flight.cancelled) toolReply(id, o, sink);
          };
          return elicitApproval(call.name, args, policy, flight, progressTokenOf(params)).then(finish, (e) => finish(toolFailure(e, args))).catch(() => {});
        }
        let out;
        try {
          out = policy && policy.refuse ? policy.refuse : runTool(call.name, args);
        } catch (e) {
          out = toolFailure(e, args); // JSON like every other result (it was the bare text "ERROR: …")
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

// stdout errors. A client that closes its read end first (it quit, `… | head -1`) made the next reply write fail with
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
      // ONE array reply — once the requests still waiting (an approval the user is asked about) have answered too.
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
// The size of one incoming message: a line growing past it — a client that never sends "\n", or a runaway payload — used
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

#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local MCP server (stdio, zero-dependency).
 *
 * Implements the Model Context Protocol over newline-delimited JSON-RPC 2.0
 * on stdin/stdout. No npm install, no network, no cost — pure Node core.
 *
 * Tools (all operate on the project's `.specs/` directory): see TOOLS below —
 * 23 tools, verify with an `initialize` + `tools/list` handshake.
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
      "Initialize spec-driven structure in the project: create `.specs/steering/` and the steering files required by the given tracks (constitution/product/tech/structure always; testing-standards for +tdd; scale/observability/cost for +saas; ai-strategy for +ai). Steering content is generated in `lang` (en/pt/es), which also becomes the project's default language (persisted in .specs/roadmap.json meta.lang and inherited by every new feature). Idempotent — never overwrites existing files.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: { type: "array", items: { type: "string", enum: ["core", "tdd", "saas", "ai"] }, description: "Tracks in use across the project. 'core' is always included." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Project language for generated steering + tool messages (default en). Becomes the project default." },
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
        tracks: { type: "array", items: { type: "string", enum: ["core", "tdd", "saas", "ai"] }, description: "Active tracks ('core' always added). Omit to auto-classify from name + summary (same as the CLI) — confirm with the human in Phase 0." },
        summary: { type: "string", description: "Optional one-line feature summary." },
        kind: { type: "string", enum: ["feature", "bugfix"], description: "'bugfix' scaffolds the systematic-debugging flow instead: bug.md (reproduction · root cause · fix), a one-story requirements.md (IF…THEN), a regression test plan and the fixed task order (reproduce → root cause → failing regression test → fix → verify). Always +tdd." },
        lang: { type: "string", enum: ["en", "pt", "es"], description: "Language for the generated artifacts. Defaults to the project language (roadmap.json meta.lang), else en." },
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
    inputSchema: { type: "object", properties: { name: { type: "string" }, batch: { type: "boolean", description: "Also return the parallel batch." }, max: { type: "integer", description: "Batch size cap (default 3, max 8)." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_task_brief",
    description:
      "Build a self-contained brief for ONE task (default: the next open task) so a fresh implementer can execute it without reading the whole spec: task text + story/phase/[P]/closing checkpoint, the full EARS text of every AC in `_Requirements:_`, the test-plan row of every T-ID in `_Makes green:_`, evals/metrics/files markers, the design sections that mention the task, the steering files to read, unresolved (phantom) references, and the definition of done for the task's loop (core / tdd / ai-prompt — +ai prompt tasks are flagged inlineOnly). Generated in the feature's language. With `write: true` it writes `.specs/<feature>/.execution/task-<N>-brief.md` (self-gitignored workspace, plus an append-only ledger.md) and returns the paths instead of the content — the basis of subagent-driven execution.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Feature name/slug." },
        number: { type: "integer", description: "Task number. Omit for the next open task." },
        write: { type: "boolean", description: "Write the brief to .specs/<feature>/.execution/ and return paths (content omitted unless includeBrief)." },
        includeBrief: { type: "boolean", description: "Include the brief markdown in the result (default: true when not writing, false when writing)." },
        projectDir: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "spec_finish",
    description:
      "Close a feature (finishing-a-development-branch): readiness report — doctor blocking checks, open tasks, tasks ticked without verification evidence, phases awaiting approval — plus the track-gated checks only a fresh run or a human can confirm (full suite green; +saas load test + observability; +ai cost + safety; bugfix: no longer reproduces), and a merge title + summary GENERATED FROM THE SPEC CHAIN (summary, root cause/fix for bugfixes, ACs, tasks with their evidence, tests, checks, spec files) to use as the merge commit message. `readyToFinish` is true only with zero blockers. With `write: true` the summary is written to .specs/<feature>/.execution/merge-summary.md (content omitted unless includeBody). Integration is LOCAL: the human picks merge locally or keep the branch — no pull requests, no CI. It never merges, pushes or approves by itself.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, write: { type: "boolean" }, includeBody: { type: "boolean" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_complete_task",
    description: "Mark task N as done in a feature's tasks.md (flips `- [ ] N.` to `- [x] N.`) and returns updated progress + the new next task. Pass `evidence` — the verification you actually ran (the task's _Verify:_ command, its exit code and an output summary): it is recorded in .state.json, a non-zero exitCode REFUSES the tick (evidence before claims), and a task that declares _Verify:_ but gets no evidence is ticked with a warning that doctor/roadmap keep surfacing. Evidence can also be back-filled for a task ticked earlier.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, number: { type: "integer" }, evidence: { type: "object", properties: { command: { type: "string" }, exitCode: { type: "integer" }, summary: { type: "string", description: "e.g. '14/14 passing' or the last lines of output" } }, description: "Verification actually run for this task." }, projectDir: { type: "string" } }, required: ["name", "number"] },
  },
  {
    name: "ears_validate",
    description: "Lint EARS acceptance criteria: flags criteria missing a modal verb (SHALL / DEVE / DEBE), missing stable IDs (US-1.AC-1), and vague words (fast, user-friendly, appropriate, …). Pass `text` directly, or `name` to lint that feature's requirements.md. Each issue has a stable `code` (no-modal · no-id · vague · no-keyword · needs-clarification) and a `msg` in the feature's language (or `lang` for raw text).",
    inputSchema: { type: "object", properties: { text: { type: "string" }, name: { type: "string" }, lang: { type: "string", enum: ["en", "pt", "es"] }, projectDir: { type: "string" } } },
  },
  {
    name: "trace_check",
    description: "Verify traceability for a feature, both directions: every AC ID in requirements.md should be referenced by ≥1 task (and, on +tdd, by the test plan; every planned T-ID should map to a task). Also flags phantom AC/T IDs referenced in tasks that don't exist (typos). Reports gaps.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_doctor",
    description: "One health-check that decides whether a feature is ready to advance a phase. Runs EARS lint, traceability, steering presence, design + Mermaid presence, and (per active track) that the mandatory +saas/+ai design sections are present AND filled (no leftover TODO sentinel). Returns per-check pass/warn/fail, the recorded approvals, and a readyToAdvance verdict.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_approve",
    description: "Record human approval of a phase gate for a feature (writes to .specs/<feature>/.state.json). Phases: classification, requirements, design, test-plan, eval-plan, tests, tasks, execution. Makes approval-gated progress auditable and resumable.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, phase: { type: "string", enum: ["classification", "requirements", "design", "test-plan", "eval-plan", "tests", "tasks", "execution"] }, by: { type: "string" }, projectDir: { type: "string" } }, required: ["name", "phase"] },
  },
  {
    name: "steering_scaffold",
    description: "Create a single steering file from its template (constitution.md, product.md, tech.md, structure.md, testing-standards.md, scale.md, observability.md, cost.md, ai-strategy.md), in `lang` (en/pt/es; defaults to the project language). Idempotent.",
    inputSchema: { type: "object", properties: { file: { type: "string" }, lang: { type: "string", enum: ["en", "pt", "es"] }, projectDir: { type: "string" } }, required: ["file"] },
  },
  {
    name: "spec_roadmap",
    description: "Show the multi-feature roadmap: each feature's tracks, phase, completion % (planning phases up to 30%, then driven by the fraction of tasks done), declared dependencies, blocked status (a dep is met when that feature is 100%), plus overall % and any circular dependency. With `write: true`, (re)generates the always-current overview: `.specs/ROADMAP.md` by default (Markdown, keeps the Mermaid dependency graph — git/PR-friendly) — and also a self-contained brand-styled `.specs/ROADMAP.html` (light/dark toggle, offline) when `html: true`. Pass `lang` ('en'/'pt'/'es') to localize the roadmap chrome only (stored as meta.roadmapLang for auto-refresh; the project language is unchanged). `html: true` implies writing. A same-named file that dev-spec did not generate is never overwritten. Reads .specs/roadmap.json + the feature folders.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" }, write: { type: "boolean", description: "(Re)write .specs/ROADMAP.md (default format)." }, html: { type: "boolean", description: "Also (re)write the brand-styled .specs/ROADMAP.html." }, lang: { type: "string", enum: ["en", "pt", "es"], description: "Language for the roadmap chrome." } } },
  },
  {
    name: "spec_backlog",
    description: "Manage the backlog — planned features that don't have a `.specs/<feature>/` folder yet (so the roadmap's 'what's left' includes work not yet started). Actions: 'add' (name + optional note), 'rm', or omit to list. Stored in .specs/roadmap.json.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["add", "rm", "list"] }, name: { type: "string" }, note: { type: "string" }, projectDir: { type: "string" } } },
  },
  {
    name: "spec_depend",
    description: "Declare feature dependencies and/or order in .specs/roadmap.json. Rejects changes that would create a circular dependency. Use for 'feature X depends on Y' or 'do X before Y' (set order).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, dependsOn: { type: "array", items: { type: "string" }, description: "Feature slugs this feature depends on." }, order: { type: "integer", description: "Optional explicit ordering position." }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_scan",
    description: "Brownfield: heuristic local scan of an EXISTING codebase (no model, no cost) — file inventory by extension, top-level modules, detected stack (from manifests), and candidate HTTP endpoints. The agent interprets this to infer steering/constitution and reverse-engineer specs.",
    inputSchema: { type: "object", properties: { projectDir: { type: "string" }, cap: { type: "integer", description: "Max files to scan (default 5000)." } } },
  },
  {
    name: "spec_coverage",
    description: "Brownfield: estimate how much of the codebase has specs — maps top-level code modules to documented features by name and reports a coverage % plus the undocumented modules.",
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
      "\"You are here, do this next.\" Synthesizes the single most useful next step for a feature from its phase, doctor verdict and approval gates, and lists any artifacts modified AFTER the last approval (so a spec edited post-approval is re-reviewed, not silently shipped). Use to resume work or answer 'what now?'.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, projectDir: { type: "string" } }, required: ["name"] },
  },
  {
    name: "spec_add_track",
    description:
      "Escalate an EXISTING feature to a new track (+tdd, +saas or +ai) - additive only, never overwrites. Scaffolds just the missing artifacts (test-plan.md/tests/, eval-plan.md/prompts/evals/, load-test.md) and appends that track's mandatory design.md sections. Use when a feature grew into needing tests, scale, or AI after it was created.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, track: { type: "string", enum: ["tdd", "saas", "ai"] }, projectDir: { type: "string" } }, required: ["name", "track"] },
  },
  {
    name: "spec_feature",
    description:
      "Manage a feature's lifecycle: remove (delete its `.specs/<slug>/` folder), archive (move it to `.specs/_archive/<slug>/`, out of the active roadmap), or rename (slug + folder + roadmap.json key, with all dependsOn references updated). All actions keep roadmap.json dependencies consistent and regenerate the roadmap. 'remove' is destructive - prefer 'archive'.",
    inputSchema: { type: "object", properties: { action: { type: "string", enum: ["remove", "archive", "rename"] }, name: { type: "string" }, newName: { type: "string", description: "New name (required for action 'rename')." }, projectDir: { type: "string" } }, required: ["action", "name"] },
  },

  // @wp WP5 tools >>>
  // @wp WP5 <<<

  // @wp WP6 tools >>>
  // @wp WP6 <<<

  // @wp WP7 tools >>>
  // @wp WP7 <<<

  // @wp WP8 tools >>>
  // @wp WP8 <<<

  // @wp WP9 tools >>>
  // @wp WP9 <<<

  // @wp WP10 tools >>>
  // @wp WP10 <<<

  // @wp WP11 tools >>>
  // @wp WP11 <<<
];

// --- Tool dispatch ---------------------------------------------------------

function runTool(name, args) {
  args = args || {};
  // Guard against RELATIVE traversal only: a tool call must not reach out of the project with `..`.
  // This is NOT a sandbox — an absolute projectDir is accepted by design (multi-project use), and the
  // engine confines every write to <projectDir>/.specs/. (The CLI, user-driven, is not restricted.)
  if (args.projectDir && /(^|[\\/])\.\.([\\/]|$)/.test(String(args.projectDir))) {
    return { ok: false, error: "projectDir must not contain '..' path segments." };
  }
  const pdir = spec.resolveProjectDir(args.projectDir);
  switch (name) {
    case "spec_init":
      return spec.initProject(pdir, args.tracks, args.lang);
    case "spec_classify":
      return spec.classify(args.description, { name: args.name, lang: args.lang });
    case "spec_create": {
      // No tracks → the engine keeps an existing feature's tracks, or classifies a new one (same as the CLI).
      const cls = spec.classify(args.summary || "", { name: args.name, lang: args.lang });
      return spec.createFeature(pdir, args.name, args.tracks, args.summary, cls, args.lang, args.kind);
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
      return spec.traceCheck(pdir, args.name);
    case "spec_doctor":
      return spec.specDoctor(pdir, args.name);
    case "spec_approve":
      return spec.approvePhase(pdir, args.name, args.phase, args.by);
    case "steering_scaffold":
      return spec.scaffoldSteeringFile(pdir, args.file, args.lang);
    case "spec_roadmap": {
      const rm = spec.roadmap(pdir);
      if (args.write || args.html) { // html:true implies writing (same as the CLI's --html)
        const wrote = [];
        const m = spec.writeRoadmapMd(pdir, args.lang);
        if (m.ok) wrote.push(m.file);
        if (args.html) {
          const h = spec.writeRoadmapHtml(pdir, args.lang);
          if (h.ok) wrote.push(h.file);
        }
        rm.wrote = wrote;
      }
      return rm;
    }
    case "spec_backlog":
      return spec.backlog(pdir, args.action, args.name, args.note);
    case "spec_depend":
      return spec.setDependency(pdir, args.name, args.dependsOn, args.order);
    case "spec_scan":
      return spec.scanCodebase(pdir, { cap: args.cap });
    case "spec_coverage":
      return spec.coverage(pdir);
    case "spec_clarify":
      return spec.clarify(pdir, args.name);
    case "spec_next_action":
      return spec.nextAction(pdir, args.name);
    case "spec_add_track":
      return spec.addTrack(pdir, args.name, args.track);
    case "spec_feature":
      return spec.manageFeature(pdir, args.action, args.name, args.newName);

    // @wp WP5 dispatch >>>
    // @wp WP5 <<<

    // @wp WP6 dispatch >>>
    // @wp WP6 <<<

    // @wp WP7 dispatch >>>
    // @wp WP7 <<<

    // @wp WP8 dispatch >>>
    // @wp WP8 <<<

    // @wp WP9 dispatch >>>
    // @wp WP9 <<<

    // @wp WP10 dispatch >>>
    // @wp WP10 <<<

    // @wp WP11 dispatch >>>
    // @wp WP11 <<<

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
        const args = (params && params.arguments) || {};
        const missing = missingArgs(toolName, args);
        if (missing.length) {
          return result(id, { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "Missing required argument(s): " + missing.join(", ") }, null, 2) }], isError: true });
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

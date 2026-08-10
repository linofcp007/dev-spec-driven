#!/usr/bin/env node
"use strict";

/**
 * dev-spec — universal CLI over the spec-driven engine (zero-dependency).
 *
 * Makes the whole methodology usable from ANY tool or terminal — Claude Code,
 * Cursor, Windsurf, Copilot, Gemini CLI, Codex CLI, plain shell, CI-free — even
 * where MCP isn't available. It is the same engine the MCP server exposes.
 *
 * Usage:
 *   node cli/dev-spec.js <command> [args]   (or `dev-spec <command>` if on PATH)
 *
 * Commands:
 *   classify "<description>"            Recommend tracks (multilingual)
 *   init [tracks...]                    Scaffold .specs/steering for tracks
 *   create "<name>" [tracks...]         Scaffold a feature (auto-classifies if no tracks)
 *   list                               List features + phase + progress
 *   status [feature]                   Status of one feature (or all)
 *   doctor <feature>                   Health-check → ready to advance?
 *   trace <feature>                    Traceability AC↔task↔test
 *   ears <feature|path>                Lint EARS in requirements.md (or a file)
 *   next <feature>                     Next unchecked task
 *   done <feature> <n>                 Mark task n complete
 *   approve <feature> <phase>          Record a phase approval
 *   next-action <feature>              "You are here → do this next" (+ changed-since-approval)
 *   add-track <feature> <track>        Escalate a feature to +tdd/+saas/+ai (additive)
 *   feature <action> <name> [new]      remove | archive | rename a feature
 *   evals <feature> [--dry-run ...]    Run the local eval harness (+ai)
 *   mcp-config [client]                Print ready MCP config (claude-desktop|claude-code|
 *                                      cursor|windsurf|vscode|gemini|codex|all)
 *
 * Flags: --json (raw JSON output) · --project <dir> (project root, default cwd)
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));

const SERVER = path.resolve(__dirname, "..", "mcp", "server.js");
const EVALS = path.resolve(__dirname, "..", "mcp", "evals", "run-evals.js");

// ---- arg parsing -----------------------------------------------------------
const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") flags.json = true;
  else if (a === "--project") flags.project = argv[++i];
  else if (a === "--lang") flags.lang = argv[++i];
  else if (a.startsWith("--") && a.includes("=")) { const [k, v] = a.slice(2).split("="); flags[k] = v; }
  else if (a.startsWith("--")) flags[a.slice(2)] = true;
  else pos.push(a);
}
const cmd = pos.shift();
const projectDir = path.resolve(flags.project || process.env.SPEC_PROJECT_DIR || process.cwd());

function out(obj, human) {
  if (flags.json) console.log(JSON.stringify(obj, null, 2));
  else if (typeof human === "function") human(obj);
  else console.log(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
}
function die(msg) {
  console.error("dev-spec: " + msg);
  process.exit(1);
}

// ---- mcp-config snippets ---------------------------------------------------
function mcpConfig(client) {
  // Forward slashes: valid in JSON without escaping and accepted by Node on Windows.
  const S = SERVER.replace(/\\/g, "/");
  const ROOT = path.resolve(__dirname, "..").replace(/\\/g, "/");
  const stdio = { command: "node", args: [S] };
  const blocks = {
    "claude-code": "Claude Code (CLI):\n  claude mcp add spec-driven -- node \"" + S + "\"\n  (or use the bundled plugin: claude --plugin-dir \"" + ROOT + "\")",
    "claude-desktop": "Claude Desktop — claude_desktop_config.json:\n" + JSON.stringify({ mcpServers: { "spec-driven": stdio } }, null, 2),
    cursor: "Cursor — .cursor/mcp.json (project) or ~/.cursor/mcp.json (global):\n" + JSON.stringify({ mcpServers: { "spec-driven": stdio } }, null, 2),
    windsurf: "Windsurf — ~/.codeium/windsurf/mcp_config.json:\n" + JSON.stringify({ mcpServers: { "spec-driven": stdio } }, null, 2),
    vscode: "VS Code / GitHub Copilot (agent mode) — .vscode/mcp.json:\n" + JSON.stringify({ servers: { "spec-driven": { type: "stdio", ...stdio } } }, null, 2),
    gemini: "Gemini CLI — ~/.gemini/settings.json (or .gemini/settings.json):\n" + JSON.stringify({ mcpServers: { "spec-driven": stdio } }, null, 2),
    codex: "OpenAI Codex CLI — ~/.codex/config.toml (single-quoted = literal path):\n[mcp_servers.spec-driven]\ncommand = \"node\"\nargs = ['" + S + "']",
    generic: "Generic stdio MCP client:\n  command: node\n  args: [\"" + S + "\"]",
  };
  if (client && client !== "all") {
    if (!blocks[client]) die("unknown client '" + client + "'. Known: " + Object.keys(blocks).join(", ") + ", all");
    return blocks[client];
  }
  return Object.values(blocks).join("\n\n");
}

// ---- dispatch --------------------------------------------------------------
function main() {
  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      return console.log(helpText());

    case "classify": {
      if (!pos[0]) die('usage: dev-spec classify "<description>"');
      const r = spec.classify(pos.join(" "));
      return out(r, (r) => {
        console.log("Tracks: " + r.label + "   confidence: " + JSON.stringify(r.confidence));
        console.log(r.reasoning);
        if (r.note) console.log("\nNote: " + r.note);
      });
    }

    case "init": {
      const r = spec.initProject(projectDir, pos.length ? pos : ["core"], flags.lang);
      return out(r, (r) => console.log("Created in " + r.specsDir + " [" + r.lang + "]:\n  " + (r.created.join(", ") || "(nothing new)") + (r.skipped.length ? "\n  (existing, kept: " + r.skipped.join(", ") + ")" : "")));
    }

    case "create": {
      if (!pos[0]) die('usage: dev-spec create "<name>" [tracks...] [--lang en|pt|es]');
      const name = pos[0];
      const tracks = pos.slice(1).length ? pos.slice(1) : spec.classify(name).tracks;
      const cls = spec.classify(name);
      const r = spec.createFeature(projectDir, name, tracks, undefined, cls, flags.lang);
      if (!r.ok) die(r.error);
      return out(r, (r) => console.log("Feature '" + r.slug + "' [" + r.label + "] (" + r.lang + ")\n  " + r.created.join(", ")));
    }

    case "list": {
      const r = spec.listFeatures(projectDir);
      return out(r, (r) => {
        if (!r.exists || !r.features.length) return console.log("No features under " + r.specsDir);
        r.features.forEach((f) => console.log("  " + f.name.padEnd(28) + " [" + f.tracks + "]  " + f.phase + "  (" + f.tasksDone + "/" + f.tasks + " tasks)"));
      });
    }

    case "status": {
      if (!pos[0]) return main2list();
      const r = spec.statusFeature(projectDir, pos[0]);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("Feature: " + r.feature + "  [" + r.tracks + "]  phase=" + r.phase);
        console.log("Tasks: " + r.tasks.done + "/" + r.tasks.total + (r.tasks.next ? "  next → #" + r.tasks.next.number + " " + r.tasks.next.text : ""));
        if (r.scaleSections) console.log("Scale sections: " + r.scaleSections.map((s) => s.section + (s.present ? "✓" : "✗")).join(" "));
      });
    }

    case "doctor": {
      if (!pos[0]) die("usage: dev-spec doctor <feature>");
      const r = spec.specDoctor(projectDir, pos[0]);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("Doctor: " + r.feature + "  [" + r.tracks + "]  verdict=" + r.verdict.toUpperCase() + "  readyToAdvance=" + r.readyToAdvance);
        r.checks.forEach((c) => console.log("  " + (c.status === "pass" ? "✓" : c.status === "warn" ? "▲" : "✗") + " " + c.id + (c.detail ? " — " + c.detail : "")));
      });
    }

    case "trace": {
      if (!pos[0]) die("usage: dev-spec trace <feature>");
      const r = spec.traceCheck(projectDir, pos[0]);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("Trace: " + r.feature + "  verdict=" + r.verdict + "  ACs=" + r.totalAcs + "  coveredByTasks=" + r.coveredByTasks);
        if (r.uncoveredByTasks.length) console.log("  uncovered by tasks: " + r.uncoveredByTasks.join(", "));
        if (r.phantomAcsInTasks.length) console.log("  phantom AC refs (typos): " + r.phantomAcsInTasks.join(", "));
        if (r.uncoveredByTests && r.uncoveredByTests.length) console.log("  uncovered by tests: " + r.uncoveredByTests.join(", "));
        if (r.missingImplFiles && r.missingImplFiles.length) console.log("  _Implements:_ files missing: " + r.missingImplFiles.join(", "));
      });
    }

    case "ears": {
      if (!pos[0]) die("usage: dev-spec ears <feature|path-to.md>");
      let text;
      if (fs.existsSync(pos[0]) && fs.statSync(pos[0]).isFile()) text = fs.readFileSync(pos[0], "utf8");
      else {
        const f = path.join(spec.specsRoot(projectDir), spec.slugify(pos[0]), "requirements.md");
        if (!fs.existsSync(f)) die("no requirements.md for '" + spec.slugify(pos[0]) + "' and not a file path");
        text = fs.readFileSync(f, "utf8");
      }
      const r = spec.earsValidate(text);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("EARS: " + r.summary.criteriaDetected + " criteria, " + r.summary.withShall + " with modal, verdict=" + r.verdict);
        r.issues.forEach((i) => console.log("  L" + i.line + " [" + i.severity + "] " + i.msg));
      });
    }

    case "next": {
      if (!pos[0]) die("usage: dev-spec next <feature>");
      const r = spec.nextTask(projectDir, pos[0]);
      if (!r.ok) die(r.error);
      return out(r, (r) => console.log(r.next ? "Next → #" + r.next.number + " " + r.next.text + "  (" + r.remaining + "/" + r.total + " left)" : "All tasks done ✓"));
    }

    case "done": {
      if (!pos[0] || pos[1] == null) die("usage: dev-spec done <feature> <task-number>");
      const r = spec.completeTask(projectDir, pos[0], pos[1]);
      if (!r.ok) die(r.error);
      return out(r, (r) => console.log("Task " + r.completed + " done. " + r.done + "/" + r.total + (r.next ? "  next → #" + r.next.number + " " + r.next.text : "  — all done ✓")));
    }

    case "approve": {
      if (!pos[0] || !pos[1]) die("usage: dev-spec approve <feature> <phase>");
      const r = spec.approvePhase(projectDir, pos[0], pos[1], process.env.USER || process.env.USERNAME || "user");
      if (!r.ok) die(r.error);
      return out(r, (r) => console.log("Approved '" + r.approved + "' for " + r.feature + " ✓"));
    }

    case "evals": {
      if (!pos[0]) die("usage: dev-spec evals <feature> [--dry-run] [--set-baseline]");
      const passthru = argv.slice(argv.indexOf(pos[0]) + 1);
      const res = spawnSync(process.execPath, [EVALS, pos[0], "--project", projectDir, ...passthru], { stdio: "inherit" });
      return process.exit(res.status || 0);
    }

    case "backlog": {
      const action = ["add", "rm", "remove"].includes(pos[0]) ? pos[0] : "list";
      const r = spec.backlog(projectDir, action, pos[1], action === "add" ? pos.slice(2).join(" ") : undefined);
      if (!r.ok) die(r.error);
      return out(r, (r) => { console.log("Backlog (" + r.backlog.length + "):"); r.backlog.forEach((b) => console.log("  - " + b.name + (b.note ? " — " + b.note : ""))); });
    }

    case "roadmap": {
      if (flags.write || flags.html || flags.md) {
        const m = spec.writeRoadmapMd(projectDir, flags.lang);
        if (!m.ok) die(m.error);
        console.log("✎ wrote " + m.file + "  (" + m.overallPercent + "%, " + m.complete + "/" + m.total + ")");
        if (flags.html) { const h = spec.writeRoadmapHtml(projectDir, flags.lang); if (h.ok) console.log("✎ wrote " + h.file); }
      }
      const r = spec.roadmap(projectDir);
      return out(r, (r) => {
        if (!r.features.length) return console.log("No features yet under " + r.specsDir);
        console.log("Roadmap — overall " + r.overallPercent + "%  (" + r.complete + "/" + r.total + " complete)" + (r.cycle ? "  ⚠ CYCLE: " + r.cycle.join(" → ") : ""));
        r.features.forEach((f) => console.log("  " + (f.blocked ? "⛔" : "  ") + " " + f.name.padEnd(26) + " " + String(f.percent + "%").padStart(4) + "  [" + f.tracks + "]  " + f.phase + (f.dependsOn.length ? "  deps: " + f.dependsOn.join(",") + (f.unmetDeps.length ? " (unmet: " + f.unmetDeps.join(",") + ")" : "") : "")));
      });
    }

    case "depend": {
      if (!pos[0]) die("usage: dev-spec depend <feature> [dep1 dep2 ...] [--order N]");
      const deps = pos.slice(1);
      const r = spec.setDependency(projectDir, pos[0], deps, flags.order);
      if (!r.ok) die(r.error);
      return out(r, (r) => console.log(r.feature + " depends on: " + (r.dependsOn.join(", ") || "(none)") + (r.order != null ? "  order=" + r.order : "") + (r.unknownDeps.length ? "  ⚠ unknown deps: " + r.unknownDeps.join(", ") : "")));
    }

    case "scan": {
      const r = spec.scanCodebase(pos[0] ? path.resolve(pos[0]) : projectDir, { cap: flags.cap ? parseInt(flags.cap, 10) : undefined });
      return out(r, (r) => {
        console.log("Scan of " + r.root + (r.truncated ? " (truncated at cap)" : ""));
        console.log("  files: " + r.filesScanned + "  | stack: " + (r.stack.join(" · ") || "unknown"));
        console.log("  top dirs: " + r.topLevelDirs.join(", "));
        console.log("  by ext: " + r.byExtension.join("  "));
        console.log("  candidate endpoints: " + r.candidateEndpoints + (r.endpointSamples.length ? " (e.g. " + r.endpointSamples.slice(0, 5).join(", ") + ")" : ""));
      });
    }

    case "coverage": {
      const r = spec.coverage(projectDir);
      return out(r, (r) => {
        console.log("Spec coverage: " + r.coveragePercent + "%  (" + r.documented.length + "/" + r.modulesTotal + " modules documented)");
        if (r.undocumented.length) console.log("  undocumented: " + r.undocumented.join(", "));
      });
    }

    case "clarify": {
      if (!pos[0]) die("usage: dev-spec clarify <feature>");
      const r = spec.clarify(projectDir, pos[0]);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("Clarify: " + r.feature + "  [" + r.tracks + "]  → " + r.verdict + " (" + r.gapCount + " question(s))");
        r.questions.forEach((q, i) => console.log("  " + (i + 1) + ". " + q));
      });
    }

    case "next-action":
    case "na": {
      if (!pos[0]) die("usage: dev-spec next-action <feature>");
      const r = spec.nextAction(projectDir, pos[0]);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("Feature: " + r.feature + "  [" + r.tracks + "]  phase=" + r.phase + "  verdict=" + r.verdict + "  gatesOk=" + r.gatesOk);
        if (r.changedSinceApproval.length) console.log("  ⚠ changed since last approval: " + r.changedSinceApproval.join(", "));
        console.log("  → " + r.recommendation);
      });
    }

    case "add-track": {
      if (!pos[0] || !pos[1]) die("usage: dev-spec add-track <feature> <tdd|saas|ai>");
      const r = spec.addTrack(projectDir, pos[0], pos[1]);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("'" + r.feature + "' now [" + r.tracks + "]");
        if (r.added.length) console.log("  + " + r.added.join(", "));
        if (r.note) console.log("  " + r.note);
      });
    }

    case "feature": {
      // dev-spec feature <remove|archive|rename> <name> [new-name]
      if (!pos[0] || !pos[1]) die("usage: dev-spec feature <remove|archive|rename> <name> [new-name]");
      const r = spec.manageFeature(projectDir, pos[0], pos[1], pos[2]);
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        if (r.action === "rename") console.log("Renamed '" + r.from + "' → '" + r.to + "' ✓");
        else if (r.action === "archive") console.log("Archived '" + r.feature + "' → .specs/" + r.dest + " ✓");
        else console.log("Removed '" + r.feature + "' ✓");
      });
    }

    case "mcp-config":
      return console.log(mcpConfig(pos[0]));

    default:
      die("unknown command '" + cmd + "'. Run `dev-spec help`.");
  }
}

function main2list() {
  const r = spec.listFeatures(projectDir);
  out(r, (r) => {
    if (!r.exists || !r.features.length) return console.log("No features under " + r.specsDir);
    r.features.forEach((f) => console.log("  " + f.name.padEnd(28) + " [" + f.tracks + "]  " + f.phase + "  (" + f.tasksDone + "/" + f.tasks + ")"));
  });
}

function helpText() {
  return `dev-spec — universal spec-driven CLI (local, zero-dependency)

  classify "<description>"        Recommend tracks (core/+tdd/+saas/+ai), multilingual
  init [tracks...] [--lang]       Scaffold .specs/steering (--lang en|pt|es → project default)
  create "<name>" [tracks...]     Scaffold a feature folder (auto-classifies if no tracks; --lang en|pt|es)
  list                            List features (phase + task progress)
  status [feature]                Status of a feature, or all
  doctor <feature>                Health-check → ready to advance?
  trace <feature>                 Traceability AC ↔ task ↔ test ↔ code (_Implements:_, phantom refs)
  clarify <feature>               Surface ambiguities/gaps in requirements before design
  ears <feature|file.md>          Lint EARS (SHALL/DEVE/DEBE, IDs, vague words)
  next <feature>                  Next unchecked task
  next-action <feature>           "You are here → do this next" (+ what changed since approval)
  done <feature> <n>              Mark task n complete
  approve <feature> <phase>       Record a phase approval (.state.json)
  add-track <feature> <track>     Escalate a feature to +tdd/+saas/+ai (additive, never overwrites)
  feature <remove|archive|rename> <name> [new-name]   Manage a feature's lifecycle
  roadmap [--write][--html][--lang]  Roadmap: %, deps, blocked, cycles. --write → .specs/ROADMAP.md (default); --html also writes the brand-styled ROADMAP.html (light/dark); --lang en|pt|es
  depend <feature> [deps...]      Declare dependencies / order (rejects cycles)
  backlog [add|rm <name> [note]]  Manage planned-but-unspecced features (shown in ROADMAP.md)
  scan [path]                     Brownfield: inventory an existing codebase (stack, modules, endpoints)
  coverage                        Brownfield: % of code modules with specs
  evals <feature> [--dry-run]     Run the local eval harness (+ai; your ANTHROPIC_API_KEY)
  mcp-config [client]             Print ready MCP config for a client (or 'all')

  Flags: --json  --project <dir>  --lang en|pt|es (init/create/roadmap)

  Works the same in Claude Code, Cursor, Windsurf, Copilot, Gemini/Codex CLI, or a plain shell.`;
}

main();

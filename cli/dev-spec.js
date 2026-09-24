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
 *   brief <feature> [n] [--write]      Self-contained brief for one task (subagent execution)
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
// Flags that take a value, as `--flag value` or `--flag=value`. Any other `--flag` is a boolean switch
// (so `depend a b --order 3` no longer turns "3" into a dependency).
const VALUE_FLAGS = new Set(["project", "lang", "order", "cap", "by", "summary", "kind", "max", "evidence", "exit", "cmd"]);
// @wp WP1 value-flags >>>
VALUE_FLAGS.add("shell"); // done --run --shell bash|<path>
// @wp WP1 <<<

// @wp WP2 value-flags >>>
// @wp WP2 <<<

// @wp WP3 value-flags >>>
// @wp WP3 <<<

// @wp WP4 value-flags >>>
// @wp WP4 <<<

// @wp WP5 value-flags >>>
// @wp WP5 <<<

// @wp WP6 value-flags >>>
// @wp WP6 <<<

// @wp WP7 value-flags >>>
// @wp WP7 <<<

// @wp WP8 value-flags >>>
// @wp WP8 <<<

// @wp WP9 value-flags >>>
// @wp WP9 <<<

// @wp WP10 value-flags >>>
// @wp WP10 <<<

// @wp WP11 value-flags >>>
// @wp WP11 <<<
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") flags.json = true;
  else if (a.startsWith("--") && a.includes("=")) { const k = a.slice(2, a.indexOf("=")); flags[k] = a.slice(a.indexOf("=") + 1); }
  else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2))) flags[a.slice(2)] = argv[++i];
  else if (a.startsWith("--")) flags[a.slice(2)] = true;
  else pos.push(a);
}
const cmd = pos.shift();
// --project > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > cwd — the same resolution as the MCP server.
const projectDir = spec.resolveProjectDir(flags.project);

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
    codex: "OpenAI Codex CLI — ~/.codex/config.toml:\n[mcp_servers.spec-driven]\ncommand = \"node\"\nargs = [" + JSON.stringify(S) + "]", // basic string: safe for paths with ' (forward slashes need no escaping)
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
      const r = spec.classify(pos.join(" "), { lang: flags.lang });
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

    case "bugfix":
    case "create": {
      if (!pos[0]) die('usage: dev-spec create "<name>" [tracks...] [--lang en|pt|es]');
      const name = pos[0];
      const cls = spec.classify(flags.summary || "", { name, lang: flags.lang }); // same as the MCP tool
      const tracks = pos.slice(1).length ? pos.slice(1) : undefined; // none → engine: keep existing / classify new
      const r = spec.createFeature(projectDir, name, tracks, flags.summary, cls, flags.lang, cmd === "bugfix" ? "bugfix" : flags.kind);
      if (!r.ok) die(r.error);
      return out(r, (r) => console.log("Feature '" + r.slug + "' [" + r.label + "] (" + r.lang + ")\n  " + r.created.join(", ") + (r.note ? "\n  " + r.note : "")));
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
      if (r.verdict === "fail") process.exitCode = 1; // scriptable: blocking checks → non-zero
      return out(r, (r) => {
        console.log("Doctor: " + r.feature + "  [" + r.tracks + "]  verdict=" + r.verdict.toUpperCase() + "  readyToAdvance=" + r.readyToAdvance);
        r.checks.forEach((c) => console.log("  " + (c.status === "pass" ? "✓" : c.status === "warn" ? "▲" : "✗") + " " + c.id + (c.detail ? " — " + c.detail : "")));
      });
    }

    case "trace": {
      if (!pos[0]) die("usage: dev-spec trace <feature>");
      const r = spec.traceCheck(projectDir, pos[0]);
      if (!r.ok) die(r.error);
      if (r.verdict !== "pass") process.exitCode = 1; // scriptable: gaps → non-zero
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
      const isFile = fs.existsSync(pos[0]) && fs.statSync(pos[0]).isFile();
      const r = isFile ? spec.earsValidate(fs.readFileSync(pos[0], "utf8"), flags.lang || spec.projectLang(projectDir)) : spec.earsFeature(projectDir, pos[0]);
      if (r.ok && r.verdict === "fail") process.exitCode = 1; // scriptable: EARS errors → non-zero
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log("EARS: " + r.summary.criteriaDetected + " criteria, " + r.summary.withShall + " with modal, verdict=" + r.verdict);
        r.issues.forEach((i) => console.log("  L" + i.line + " [" + i.severity + "] " + i.msg));
      });
    }

    case "next": {
      if (!pos[0]) die("usage: dev-spec next <feature>");
      const r = spec.nextTask(projectDir, pos[0], { batch: !!flags.batch, max: flags.max });
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        console.log(r.next ? "Next → #" + r.next.number + " " + r.next.text + "  (" + r.remaining + "/" + r.total + " left)" : "All tasks done ✓");
        if (r.batch && r.batch.length > 1) console.log("  parallel batch: " + r.batch.map((b) => "#" + b.number + " [" + b.implements.join(", ") + "]").join("  "));
      });
    }

    case "finish": {
      // dev-spec finish <feature> [--write] — readiness report + merge summary from the spec chain (no PRs)
      if (!pos[0]) die("usage: dev-spec finish <feature> [--write]");
      const r = spec.finishFeature(projectDir, pos[0], { write: !!flags.write });
      if (!r.ok) die(r.error);
      if (!r.readyToFinish) process.exitCode = 1; // scriptable: blockers → non-zero
      return out(r, (r) => {
        console.log(r.message);
        r.blockers.forEach((b) => console.log("  ✗ " + b));
        console.log("\n" + r.checks.map((c) => "  [ ] " + c).join("\n"));
        if (r.wrote) console.log("\nMerge summary → " + r.paths.summary);
        else console.log("\n# " + r.mergeTitle + "\n\n" + r.mergeSummary);
      });
    }

    case "steering": {
      // dev-spec steering <file> [--lang] — one steering file from its template (same as steering_scaffold)
      if (!pos[0]) die("usage: dev-spec steering <constitution.md|product.md|tech.md|…> [--lang en|pt|es]");
      const r = spec.scaffoldSteeringFile(projectDir, pos[0], flags.lang);
      if (!r.ok) die(r.error);
      return out(r, (r) => console.log((r.created ? "Created " : "Exists (left untouched) ") + r.file));
    }

    case "brief": {
      // dev-spec brief <feature> [n] [--write]  — self-contained brief for one task (default: next open)
      if (!pos[0]) die("usage: dev-spec brief <feature> [task-number] [--write]");
      const r = spec.taskBrief(projectDir, pos[0], pos[1], { write: !!flags.write, includeBrief: flags["include-brief"] ? true : undefined });
      if (!r.ok) die(r.error);
      return out(r, (r) => {
        if (!r.task) return console.log(r.note);
        if (r.brief) console.log(r.brief);
        if (r.wrote) {
          console.log("Brief → " + r.paths.brief + (r.inlineOnly ? "  (inline only: +ai prompt task)" : ""));
          console.log("  report → " + r.paths.report);
          console.log("  ledger → " + r.paths.ledger);
        }
        if (r.unresolved.acs.length || r.unresolved.tests.length) console.error("  ⚠ unresolved: " + [...r.unresolved.acs, ...r.unresolved.tests].join(", "));
      });
    }

    case "done": {
      if (!pos[0] || pos[1] == null) die("usage: dev-spec done <feature> <task-number> [--run [--shell bash|<path>] | --evidence \"summary\" [--exit N] [--cmd \"command\"]]");
      const D = spec.msg(spec.featureLang(projectDir, pos[0])).taskDone; // human output in the feature's language
      if (!/^\d+$/.test(String(pos[1]).trim())) die(D.numberInt); // before running anything
      const say = flags.json ? console.error : console.log; // --json keeps stdout one JSON document
      let evidence;
      let hint = null;
      if (flags.run) {
        // Evidence before claims: run the task's own _Verify:_ command(s) from the project root; any failure
        // leaves the task open. taskBrief resolves the SAME task completeTask ticks (first open one of a
        // duplicated number), so the command that runs belongs to the task that gets ticked.
        const b = spec.taskBrief(projectDir, pos[0], pos[1]);
        if (!b.ok) die(b.error);
        const cmds = b.verify.filter((c) => !/^\[.*\]$/.test(c.trim()));
        if (!cmds.length) die(D.noRunnable(b.task.number));
        // Default: the platform shell (cmd.exe on Windows). --shell / DEV_SPEC_SHELL pick another (e.g. bash).
        const shell = (typeof flags.shell === "string" && flags.shell.trim()) || (process.env.DEV_SPEC_SHELL || "").trim() || true;
        for (const cmd of cmds) {
          say("$ " + cmd);
          // Runs the user's OWN _Verify:_ command from their tasks.md, only on an explicit --run (the same
          // trust as an npm script) — a shell is the point: the marker is a shell command line.
          // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
          const run = spawnSync(cmd, { shell, cwd: projectDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
          const summary = spec.summarizeRunOutput((run.stdout || "") + (run.stderr || "") + (run.error ? "\n" + run.error.message : ""));
          if (summary) say(summary.replace(/^/gm, "  "));
          const code = run.status == null ? 1 : run.status;
          if (code !== 0) {
            evidence = { command: cmd, exitCode: code, summary };
            if (process.platform === "win32" && shell === true) hint = D.shellHint;
            break;
          }
          evidence = { command: cmds.join(" && "), exitCode: 0, summary };
        }
      } else if (flags.evidence != null || flags.exit != null || flags.cmd != null) {
        evidence = { command: flags.cmd, exitCode: flags.exit, summary: typeof flags.evidence === "string" ? flags.evidence : undefined };
      }
      const r = spec.completeTask(projectDir, pos[0], pos[1], evidence);
      if (!r.ok) {
        console.error("dev-spec: " + r.error);
        if (hint) console.error(hint);
        process.exit(1);
      }
      return out(r, (r) => {
        console.log((r.alreadyDone ? D.already : D.done)(r.completed, r.verified, r.done, r.total) + (r.next ? D.next(r.next.number, r.next.text) : D.allDone));
        if (r.note) console.log("  ⚠ " + r.note);
      });
    }

    case "approve": {
      if (!pos[0] || !pos[1]) die("usage: dev-spec approve <feature> <phase>");
      const r = spec.approvePhase(projectDir, pos[0], pos[1], flags.by || process.env.USER || process.env.USERNAME || "user");
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
      const wrote = [];
      if (flags.write || flags.html || flags.md) {
        const m = spec.writeRoadmapMd(projectDir, flags.lang);
        if (!m.ok) die(m.error);
        wrote.push(m.file);
        if (!flags.json) console.log("✎ wrote " + m.file + "  (" + m.overallPercent + "%, " + m.complete + "/" + m.total + ")");
        if (flags.html) {
          const h = spec.writeRoadmapHtml(projectDir, flags.lang);
          if (h.ok) { wrote.push(h.file); if (!flags.json) console.log("✎ wrote " + h.file); }
          else console.error("dev-spec: " + h.error);
        }
      }
      const r = spec.roadmap(projectDir);
      if (wrote.length) r.wrote = wrote; // --json stays one valid JSON document
      return out(r, (r) => {
        if (!r.features.length) return console.log("No features yet under " + r.specsDir);
        console.log("Roadmap — overall " + r.overallPercent + "%  (" + r.complete + "/" + r.total + " complete)" + (r.cycle ? "  ⚠ CYCLE: " + r.cycle.join(" → ") : ""));
        r.features.forEach((f) => console.log("  " + (f.blocked ? "⛔" : "  ") + " " + f.name.padEnd(26) + " " + String(f.percent + "%").padStart(4) + "  [" + f.tracks + "]  " + f.phase + (f.dependsOn.length ? "  deps: " + f.dependsOn.join(",") + (f.unmetDeps.length ? " (unmet: " + f.unmetDeps.join(",") + ")" : "") : "")));
      });
    }

    case "depend": {
      if (!pos[0]) die("usage: dev-spec depend <feature> [dep1 dep2 ...] [--order N]");
      // Only --order given → keep the declared deps; no deps and no order → clear them (as before).
      const deps = pos.slice(1).length ? pos.slice(1) : flags.order != null ? undefined : [];
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

    // @wp WP1 commands >>>
    // @wp WP1 <<<

    // @wp WP2 commands >>>
    // @wp WP2 <<<

    // @wp WP3 commands >>>
    // @wp WP3 <<<

    // @wp WP4 commands >>>
    // @wp WP4 <<<

    // @wp WP5 commands >>>
    // @wp WP5 <<<

    // @wp WP6 commands >>>
    // @wp WP6 <<<

    // @wp WP7 commands >>>
    // @wp WP7 <<<

    // @wp WP8 commands >>>
    // @wp WP8 <<<

    // @wp WP9 commands >>>
    // @wp WP9 <<<

    // @wp WP10 commands >>>
    // @wp WP10 <<<

    // @wp WP11 commands >>>
    // @wp WP11 <<<

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
  steering <file> [--lang]        Create one steering file from its template (constitution.md, tech.md, …)
  create "<name>" [tracks...]     Scaffold a feature folder (auto-classifies if no tracks; --summary, --lang en|pt|es)
  bugfix "<name>" [--summary]     Scaffold the bugfix flow: bug.md (repro · root cause · fix) + regression test plan
  list                            List features (phase + task progress)
  status [feature]                Status of a feature, or all
  doctor <feature>                Health-check → ready to advance? (exit 1 on FAIL; trace/ears likewise on gaps/errors)
  trace <feature>                 Traceability AC ↔ task ↔ test ↔ code (_Implements:_, phantom refs)
  clarify <feature>               Surface ambiguities/gaps in requirements before design
  ears <feature|file.md>          Lint EARS (SHALL/DEVE/DEBE, IDs, vague words)
  next <feature> [--batch]        Next unchecked task (--batch: + the [P] tasks that can run beside it)
  next-action <feature>           "You are here → do this next" (+ what changed since approval)
  brief <feature> [n] [--write]   Self-contained brief for task n (default: next open) — ACs, tests, design, DoD;
                                  --write → .specs/<feature>/.execution/task-<n>-brief.md (subagent execution)
  done <feature> <n> [--run]      Mark task n complete; --run executes its _Verify:_ command(s) first and records the evidence
                                  (a failure leaves it open; --shell bash|<path> or DEV_SPEC_SHELL picks the shell); or --evidence "…" [--exit N] [--cmd "…"]
  finish <feature> [--write]      Readiness report + merge summary from the spec chain (exit 1 if not ready)
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

  Flags: --json  --project <dir>  --lang en|pt|es (init/create/roadmap)  --order N (depend)
         --cap N (scan)  --by NAME (approve)  --write / --include-brief (brief)

  Works the same in Claude Code, Cursor, Windsurf, Copilot, Gemini/Codex CLI, or a plain shell.`;
}

// Engine guards (e.g. an unreadable roadmap.json) surface as a one-line error, not a stack trace.
try {
  main();
} catch (e) {
  die(e.message);
}

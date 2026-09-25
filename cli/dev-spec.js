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
 *   classify "<description>" [--name n]  Recommend tracks (multilingual; --name = the feature name as evidence)
 *   init [tracks...] [--lang]           Scaffold .specs/steering for tracks (--lang → project default;
 *                                      --guard on|off → guard mode: code edits ask while no approved tasks)
 *   steering <file> [--lang]            Create one steering file from its template, or a custom scoped one
 *                                      (any other name-like.md → front matter inclusion: always|fileMatch|manual)
 *   create "<name>" [tracks...]         Scaffold a feature (auto-classifies if no tracks; --summary, --kind, --lang,
 *                                      --brownfield → + integration-plan.md)
 *   bugfix "<name>" [--summary]         Scaffold the bugfix flow (bug.md + regression test plan)
 *   list                               List features + phase + progress
 *   status [feature]                   Status of one feature (or all)
 *   doctor <feature>                   Health-check → ready to advance?
 *   trace <feature> [--code]           Traceability AC↔task↔test↔code (every gap listed; EC/NFR/SC warnings;
 *                                      --code also scans test files for the T-IDs they name)
 *   clarify <feature>                  Surface ambiguities/gaps in requirements
 *   ears <feature|path> | --text "…" | -   Lint EARS in requirements.md, a file, raw text or stdin
 *   next <feature> [--batch] [--max N] Next unchecked task (+ the [P] tasks that can run beside it)
 *   done <feature> <n>                 Mark task n complete (--run [--shell bash|<path>] · --evidence/--exit/--cmd)
 *   approve <feature> <phase> [--by NAME] [--force]  Record a phase approval — refused while its checks fail
 *                                      (--by = who approved; --force records it anyway, flagged as forced)
 *   impact <feature> [--phase p] [--reopen]  What an edit after approval touches (vs the approved snapshot);
 *                                      --phase requirements|design|tasks, --reopen unticks the affected done tasks
 *   metrics [feature] [--write]        Lead times, rework, change requests, evidence pass rate (--write → retro.md)
 *   next-action|na <feature>           "You are here → do this next" (+ changed-since-approval)
 *   brief <feature> [n] [--write] [--include-brief]  Self-contained brief for one task (subagent execution)
 *   finish <feature> [--write] [--include-body]  Readiness report + merge summary (no PRs)
 *   append-tasks <feature> --task "…" [--req ids] [--implements paths] [--verify "cmd"] [--story US1|shared]
 *                                      [--parallel] [--heading "…"]  Append one task to tasks.md (converge)
 *   add-track <feature> <track...>     Escalate a feature to +tdd/+saas/+ai (additive); --remove turns one off
 *   feature <action> <name> [new]      remove (needs --yes) | archive | rename | restore a feature
 *   catalog [--write]                  Living catalog: every feature's ACs, superseded ones marked → .specs/SPECS.md
 *   drift [feature]                    Implementing files changed/missing since finish (exit 1 on drift)
 *   roadmap [--write|--md] [--html] [--lang]  Multi-feature roadmap (+ .specs/ROADMAP.md / .html)
 *   depend <feature> [deps...] [--add x] [--rm x] [--clear] [--order N]  Show / set dependencies (rejects cycles)
 *   backlog [add|rm <name> [note]]     Planned-but-unspecced features
 *   scan [path] [--cap N]              Brownfield: inventory an existing codebase (routes, tests, entrypoints, env names, migrations)
 *   coverage                           Brownfield: % of code files named in _Implements:_ (per folder)
 *   import <kiro|spec-kit|openspec> <path> [--name n] [--lang] [--tracks …]  Import another tool's spec as a NEW feature
 *   evals <feature> [--dry-run ...]    Run the local eval harness (+ai)
 *   mcp-config [client]                Print ready MCP config (claude-desktop|claude-code|
 *                                      cursor|windsurf|vscode|gemini|codex|generic|all)
 *   rules <tool>                       Print a rule file (cursor|windsurf|copilot|gemini|agents)
 *                                      with this clone's absolute paths, to paste into a project
 *
 * Flags: --json (raw JSON output) · --project <dir> (project root, default cwd) · --lang en|pt|es
 *        done: --run · --shell bash|<path> · --evidence "…" · --exit N · --cmd "…"   (value flags need a value; a following --flag is not one)
 *        Switches: --x or --x=true|false (1/0, yes/no, on/off). --json prints a refusal's {ok:false,…} result on stdout (exit 1).
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
VALUE_FLAGS.add("shell"); // done --run --shell bash|<path>

VALUE_FLAGS.add("add"); // depend <f> --add x[,y]
VALUE_FLAGS.add("rm"); // depend <f> --rm x[,y]

VALUE_FLAGS.add("name"); // classify --name <feature name> (evidence for the classifier, like spec_classify {name})
VALUE_FLAGS.add("text"); // ears --text "<criteria>" (raw text, like ears_validate {text})

// Localized human output — the feature's language for feature commands, the project's otherwise.
// (--json prints the structured result, which is never localized.)
function cliText(lang) {
  const m = spec.msg(lang);
  return Object.assign({}, m.cliOutput, {
    phase: (p) => (m.phaseNames && m.phaseNames[p]) || p,
    word: (v) => (m.cliOutput.words && m.cliOutput.words[v]) || v,
    bool: (b) => (b ? m.cliOutput.yes : m.cliOutput.no),
  });
}
function featureText(name) { return cliText(spec.featureLang(projectDir, name)); }
function projectText() { return cliText(spec.projectLang(projectDir)); }

// Read all of stdin asynchronously — fs.readFileSync(0) is unreliable on Windows pipes (same rule as the hooks).
function readStdin(cb) {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => { try { cb(data); } catch (e) { die(e.message); } });
  process.stdin.on("error", (e) => die(e.message));
}

VALUE_FLAGS.add("tracks"); // --tracks tdd,saas = the MCP `tracks` argument (import, create/bugfix, init, add-track)
// A value flag takes ONE token: `--tracks saas ai` leaves "ai" positional, so every command that takes tracks
// merges the flag with its positional tracks (parseTracks splits "tdd,saas") — none may drop it silently.
function withTracksFlag(list) {
  return typeof flags.tracks === "string" && flags.tracks.trim() ? list.concat([flags.tracks]) : list;
}

// append-tasks <f> --task "<text>" [--req ids] [--implements paths] [--verify "<cmd>"] [--story US1] [--heading "<phase>"]
["task", "req", "implements", "verify", "story", "heading"].forEach((k) => VALUE_FLAGS.add(k));

VALUE_FLAGS.add("phase"); // impact <f> --phase requirements|design|tasks

VALUE_FLAGS.add("guard"); // init --guard on|off (= spec_init {guard: true|false})
let missingValue = null; // reported in main(), once --project is known (message in the project language)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") flags.json = true;
  else if (a.startsWith("--") && a.includes("=")) { const k = a.slice(2, a.indexOf("=")); flags[k] = a.slice(a.indexOf("=") + 1); }
  else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2))) {
    // A value flag never swallows the next flag: `--order --json` must not set order="--json". Only a
    // `--<letter>` token is a flag — `---` (front matter, an HR) or `-- draft` stays a value, like over MCP.
    if (argv[i + 1] === undefined || /^--[A-Za-z]/.test(argv[i + 1])) missingValue = missingValue || a.slice(2);
    else flags[a.slice(2)] = argv[++i];
  }
  else if (a.startsWith("--")) flags[a.slice(2)] = true;
  else pos.push(a);
}
const cmd = pos.shift();
// --project > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > cwd — the same resolution as the MCP server.
const projectDir = spec.resolveProjectDir(flags.project);

// Boolean switches: `--x` is true, `--x=true|false` (also 1/0, yes/no, on/off) sets it explicitly; any other `=value` is
// an error (normalizeBoolFlags, in main). They are read with on(), never by truthiness — the string "false" is truthy,
// so `done --run=false` ran the _Verify:_ commands and `add-track --remove=false` removed the track (MCP `false` is false).
const BOOL_FLAGS = ["json", "run", "remove", "write", "md", "html", "batch", "include-brief", "include-body", "code", "force", "reopen", "yes", "brownfield", "parallel", "clear"];
const on = (k) => flags[k] === true;
function normalizeBoolFlags() {
  for (const k of BOOL_FLAGS) {
    if (typeof flags[k] !== "string") continue;
    const v = flags[k].trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) flags[k] = true;
    else if (["false", "0", "no", "off"].includes(v)) flags[k] = false;
    else {
      const A = spec.msg(spec.projectLang(projectDir)).args;
      die(A.invalid(A.item("--" + k, A.type.boolean, JSON.stringify(flags[k]))));
    }
  }
}
// --cap / --max: an integer ≥ 1, like the MCP schema ({type: integer, minimum: 1}). parseInt read "1.5" as 1, "-3" as -3
// (a scan of zero files, "truncated") and "abc" as the default. Absent → undefined (the engine's default).
function intFlag(k) {
  if (flags[k] === undefined) return undefined;
  const v = String(flags[k]).trim();
  if (/^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) >= 1) return Number(v);
  const A = spec.msg(spec.projectLang(projectDir)).args;
  return die(A.invalid(A.item("--" + k, A.type.integer + " " + A.atLeast(1), JSON.stringify(String(flags[k])))));
}

function out(obj, human) {
  if (flags.json) console.log(JSON.stringify(obj, null, 2));
  else if (typeof human === "function") human(obj);
  else console.log(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
}
function die(msg) {
  console.error("dev-spec: " + msg);
  process.exit(1);
}
// An engine refusal ({ok: false, error, …}). With --json the WHOLE result is the one JSON document on stdout — what the
// MCP tool returns, `recorded` / `neverApproved` / `gated`… included — and the exit code is 1; a script never has to
// parse localized stderr. Otherwise the error goes to stderr (+ an optional hint line), exit 1. Callers `return fail(r)`.
function fail(r, hint) {
  if (flags.json) {
    console.log(JSON.stringify(r, null, 2));
    if (hint) console.error(hint);
    process.exitCode = 1;
    return;
  }
  console.error("dev-spec: " + r.error);
  if (hint) console.error(hint);
  process.exit(1);
}
// A usage line: the syntax stays as typed, the "usage:" prefix is in the project language.
function usage(syntax) {
  die(projectText().usage(syntax));
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
    // Own keys only: 'constructor' / 'toString' are not clients.
    if (!Object.prototype.hasOwnProperty.call(blocks, client)) die(projectText().unknownClient(client, Object.keys(blocks).join(", ") + ", all"));
    return blocks[client];
  }
  return Object.values(blocks).join("\n\n");
}

// ---- dispatch --------------------------------------------------------------
const CLI_LANGS = ["en", "pt", "es"]; // = the MCP tools' `lang` enum
function main() {
  if (missingValue) die(projectText().missingValue(missingValue));
  // --lang is checked once, like the MCP `lang` enum: an unknown value (fr, spanish, portugues…) is refused before any
  // command runs — the engine would quietly turn it into 'en' and SAVE it (init rewrote the project language).
  if (flags.lang !== undefined) {
    const l = String(flags.lang).trim().toLowerCase();
    if (!CLI_LANGS.includes(l)) {
      const A = spec.msg(spec.projectLang(projectDir)).args;
      die(A.invalid(A.item("--lang", A.oneOf(CLI_LANGS.join(", ")), JSON.stringify(String(flags.lang)))));
    }
    flags.lang = l;
  }
  normalizeBoolFlags(); // `--run=false` is false, `--run=maybe` an error — before any command runs
  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      return console.log(helpText());

    case "classify": {
      if (!pos[0]) usage('dev-spec classify "<description>" [--name "<feature name>"] [--lang en|pt|es]');
      const r = spec.classify(pos.join(" "), { name: flags.name, lang: flags.lang }); // same args as spec_classify
      return out(r, (r) => {
        const T = cliText(r.lang); // the language the reasoning was written in
        const conf = spec.msg(r.lang).classify.conf;
        console.log(T.tracks(r.label, ["tdd", "saas", "ai"].map((t) => t + "=" + (conf[r.confidence[t]] || r.confidence[t])).join(", ")));
        console.log(r.reasoning);
        if (r.note) console.log(T.note(r.note));
      });
    }

    case "init": {
      const tr = withTracksFlag(pos);
      // --guard on|off = spec_init {guard: true|false}; absent leaves the guard as it is.
      let guard;
      if (flags.guard !== undefined) {
        const g = String(flags.guard).trim().toLowerCase();
        if (["on", "true", "yes", "1"].includes(g)) guard = true;
        else if (["off", "false", "no", "0"].includes(g)) guard = false;
        else die(spec.msg(flags.lang || spec.projectLang(projectDir)).guardMode.badValue(flags.guard));
      }
      const r = spec.initProject(projectDir, tr.length ? tr : ["core"], flags.lang, { guard });
      if (r.ok === false) return fail(r); // e.g. an unknown track (did-you-mean) or an unreadable roadmap.json
      return out(r, (r) => {
        console.log(cliText(r.lang).created(r.specsDir, r.lang, r.created.join(", ") || cliText(r.lang).nothingNew, r.skipped.join(", ")));
        if (r.guardNote) console.log("  " + r.guardNote);
      });
    }

    case "bugfix":
    case "create": {
      if (!pos[0]) usage('dev-spec create "<name>" [tracks...] [--lang en|pt|es]');
      const name = pos[0];
      const cls = spec.classify(flags.summary || "", { name, lang: flags.lang }); // same as the MCP tool
      const tr = withTracksFlag(pos.slice(1));
      const tracks = tr.length ? tr : undefined; // none → engine: keep existing / classify new
      const r = spec.createFeature(projectDir, name, tracks, flags.summary, cls, flags.lang, cmd === "bugfix" ? "bugfix" : flags.kind,
        { brownfield: on("brownfield") }); // = spec_create {brownfield}
      if (!r.ok) return fail(r);
      return out(r, (r) => { const T = cliText(r.lang); console.log(T.feature(r.slug, r.label, r.lang) + "\n  " + (r.created.join(", ") || T.nothingNew) + (r.note ? "\n  " + r.note : "")); });
    }

    case "list":
      return main2list();

    case "status": {
      if (!pos[0]) return main2list();
      const r = spec.statusFeature(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      const T = featureText(r.feature);
      return out(r, (r) => {
        console.log(T.statusHead(r.feature, r.tracks, T.phase(r.phase)));
        console.log(T.statusTasks(r.tasks.done, r.tasks.total, r.tasks.next ? "#" + r.tasks.next.number + " " + r.tasks.next.text : null));
        // ✓ only when FILLED (the doctor's rule): ◐ present but still a TODO/empty, ✗ missing — in the feature language.
        const fm = spec.msg(spec.featureLang(projectDir, r.feature));
        const marks = (list) => list.map((s) => (s.filled ? "✓ " : s.present ? "◐ " : "✗ ") + (fm.sectionNames[s.section] || s.section) +
          (s.filled ? "" : " (" + fm.sectionStatus[s.present ? "unfilled" : "missing"] + ")")).join(" · ");
        if (r.scaleSections) console.log(T.scaleSections(marks(r.scaleSections)));
        if (r.aiSections && r.aiSections.sections) console.log(T.aiSections(marks(r.aiSections.sections)));
      });
    }

    case "doctor": {
      if (!pos[0]) usage("dev-spec doctor <feature>");
      const r = spec.specDoctor(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      if (r.verdict === "fail") process.exitCode = 1; // scriptable: blocking checks → non-zero
      const T = featureText(r.feature);
      return out(r, (r) => {
        console.log(T.doctorHead(r.feature, r.tracks, T.word(r.verdict).toUpperCase(), T.bool(r.readyToAdvance)));
        r.checks.forEach((c) => console.log("  " + (c.status === "pass" ? "✓" : c.status === "warn" ? "▲" : "✗") + " " + c.id + (c.detail ? " — " + c.detail : "")));
      });
    }

    case "trace": {
      if (!pos[0]) usage("dev-spec trace <feature> [--code]");
      const r = spec.traceCheck(projectDir, pos[0], { code: on("code") }); // = trace_check {code}
      if (!r.ok) return fail(r);
      if (r.verdict !== "pass") process.exitCode = 1; // scriptable: gaps → non-zero (warnings never change it)
      const lang = spec.featureLang(projectDir, r.feature);
      const T = cliText(lang);
      return out(r, (r) => {
        console.log(T.traceHead(r.feature, T.word(r.verdict), r.totalAcs, r.coveredByTasks));
        // Every gap kind the engine reports, with its IDs — never "gaps-found" with nothing listed.
        spec.traceGapLines(r, lang).forEach((l) => console.log("  " + l));
        spec.traceWarningLines(r, lang).forEach((l) => console.log("  ▲ " + l));
        if (r.code) console.log(spec.msg(lang).deepTrace.codeSummary(r.code.planned - r.code.plannedNotInCode.length, r.code.planned, r.code.scanned, r.code.truncated));
        spec.supersedesWarnings(r, lang).forEach((l) => console.log("  ⚠ " + l)); // warnings, not gaps (exit code unchanged)
      });
    }

    case "ears": {
      // dev-spec ears <feature|file.md> | --text "<criteria>" | -   (raw text / stdin = ears_validate {text})
      if (flags.text == null && !pos[0]) usage('dev-spec ears <feature|path-to.md> | --text "<criteria>" | - (stdin)');
      const textLang = flags.lang || spec.projectLang(projectDir);
      const report = (r, T) => {
        if (!r.ok) return fail(r);
        if (r.verdict === "fail") process.exitCode = 1; // scriptable: EARS errors → non-zero
        return out(r, (r) => {
          console.log(T.earsHead(r.summary.criteriaDetected, r.summary.withShall, T.word(r.verdict)));
          r.issues.forEach((i) => console.log("  L" + i.line + " [" + T.word(i.severity) + "] " + i.msg)); // `severity` stays English in --json
        });
      };
      if (typeof flags.text === "string") return report(spec.earsValidate(flags.text, textLang), cliText(textLang));
      if (pos[0] === "-") return readStdin((txt) => report(spec.earsValidate(txt, textLang), cliText(textLang)));
      const isFile = fs.existsSync(pos[0]) && fs.statSync(pos[0]).isFile();
      if (isFile) return report(spec.earsValidate(fs.readFileSync(pos[0], "utf8"), textLang), cliText(textLang));
      return report(spec.earsFeature(projectDir, pos[0]), featureText(pos[0]));
    }

    case "next": {
      if (!pos[0]) usage("dev-spec next <feature> [--batch] [--max N]");
      const r = spec.nextTask(projectDir, pos[0], { batch: on("batch"), max: intFlag("max") });
      if (!r.ok) return fail(r);
      const T = featureText(r.feature);
      return out(r, (r) => {
        console.log(r.next ? T.next(r.next.number, r.next.text, r.remaining, r.total) : T.allDone);
        if (r.batch && r.batch.length > 1) console.log(T.batch(r.batch.map((b) => "#" + b.number + " [" + b.implements.join(", ") + "]").join("  ")));
      });
    }

    case "finish": {
      // dev-spec finish <feature> [--write] [--include-body] — readiness report + merge summary from the spec chain (no PRs)
      if (!pos[0]) usage("dev-spec finish <feature> [--write] [--include-body]");
      const r = spec.finishFeature(projectDir, pos[0], { write: on("write"), includeBody: on("include-body") ? true : undefined }); // = spec_finish {includeBody}
      if (!r.ok) return fail(r);
      if (!r.readyToFinish) process.exitCode = 1; // scriptable: blockers → non-zero
      const T = featureText(r.feature);
      return out(r, (r) => {
        console.log(r.message);
        r.blockers.forEach((b) => console.log("  ✗ " + b));
        (r.warnings || []).forEach((w) => console.log("  ▲ " + w)); // EC/NFR/SC and tests-in-code — never blockers
        console.log("\n" + r.checks.map((c) => "  [ ] " + c).join("\n"));
        if (r.wrote) console.log(T.mergeSummaryAt(r.paths.summary));
        if (r.baseline && r.baseline.recorded) {
          const D = spec.msg(spec.featureLang(projectDir, r.feature)).drift;
          console.log(D.baselineRecorded(r.baseline.files, r.baseline.missing));
          const rp = r.baseline.replaced; // a re-finish over a drifted baseline: the drift it accepted
          if (rp) { const list = [...rp.changed, ...rp.missing, ...rp.nowPresent]; console.log("  " + D.baselineReplaced(list.length, String(rp.at || "?").slice(0, 10), list.join(", "))); }
        } else if (r.baseline && r.baseline.error) console.error("dev-spec: " + r.baseline.error); // a broken .state.json is never rewritten
        if (r.mergeSummary != null) console.log("\n# " + r.mergeTitle + "\n\n" + r.mergeSummary);
      });
    }

    case "steering": {
      // dev-spec steering <file> [--lang] — one steering file from its template, or a custom scoped one with front
      // matter (inclusion: always|fileMatch|manual) for any other safe name (same as steering_scaffold)
      if (!pos[0]) usage("dev-spec steering <constitution.md|product.md|tech.md|…|<custom-name>.md> [--lang en|pt|es]");
      const r = spec.scaffoldSteeringFile(projectDir, pos[0], flags.lang);
      if (!r.ok) return fail(r);
      const T = cliText(flags.lang || spec.projectLang(projectDir)); // the language the file was written in
      return out(r, (r) => console.log(r.created ? T.steeringCreated(r.file) : T.steeringExists(r.file)));
    }

    case "brief": {
      // dev-spec brief <feature> [n] [--write]  — self-contained brief for one task (default: next open)
      if (!pos[0]) usage("dev-spec brief <feature> [task-number] [--write]");
      const r = spec.taskBrief(projectDir, pos[0], pos[1], { write: on("write"), includeBrief: on("include-brief") ? true : undefined });
      if (!r.ok) return fail(r);
      const T = cliText(r.lang);
      return out(r, (r) => {
        if (!r.task) return console.log(r.note);
        if (r.brief) console.log(r.brief);
        if (r.wrote) {
          console.log(T.briefAt(r.paths.brief, r.inlineOnly));
          console.log(T.reportAt(r.paths.report));
          console.log(T.ledgerAt(r.paths.ledger));
        }
        if (r.unresolved.acs.length || r.unresolved.tests.length) console.error(T.unresolved([...r.unresolved.acs, ...r.unresolved.tests].join(", ")));
      });
    }

    case "done": {
      if (!pos[0] || pos[1] == null) usage("dev-spec done <feature> <task-number> [--run [--shell bash|<path>] | --evidence \"summary\" [--exit N] [--cmd \"command\"]]");
      const D = spec.msg(spec.featureLang(projectDir, pos[0])).taskDone; // human output in the feature's language
      if (!/^\d+$/.test(String(pos[1]).trim())) die(D.numberInt); // before running anything
      const say = flags.json ? console.error : console.log; // --json keeps stdout one JSON document
      let evidence;
      let hint = null;
      if (on("run")) {
        // Evidence before claims: run the task's own _Verify:_ command(s) from the project root; any failure
        // leaves the task open. taskBrief resolves the SAME task completeTask ticks (first open one of a
        // duplicated number), so the command that runs belongs to the task that gets ticked.
        const b = spec.taskBrief(projectDir, pos[0], pos[1]);
        if (!b.ok) return fail(b);
        if (b.gated) return fail({ ok: false, gated: b.gated, error: b.gateError }); // complete_task would refuse it (bugfix: no fix before the root cause) — run nothing
        const cmds = b.verify.filter((c) => !/^\[.*\]$/.test(c.trim()));
        if (!cmds.length) return fail({ ok: false, error: D.noRunnable(b.task.number) });
        // Default: the platform shell (cmd.exe on Windows). --shell / DEV_SPEC_SHELL pick another (e.g. bash).
        const shell = (typeof flags.shell === "string" && flags.shell.trim()) || (process.env.DEV_SPEC_SHELL || "").trim() || true;
        // cmd.exe misreads POSIX quoting / $VAR — often without failing (`node -e 'process.exit(1)'` exits 0): a command
        // written for a POSIX shell is refused before anything runs unless a shell was chosen (--shell cmd: cmd.exe anyway).
        if (process.platform === "win32" && shell === true) {
          const posix = cmds.map((c) => [c, spec.posixShellSyntax(c)]).find(([, k]) => k.length);
          if (posix) return fail({ ok: false, error: D.posixOnWindows(posix[0], posix[1]) });
        }
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
      if (!r.ok) return fail(r, hint); // --json: {ok:false, recorded:true, …} on stdout, as spec_complete_task returns it
      return out(r, (r) => {
        console.log((r.alreadyDone ? D.already : D.done)(r.completed, r.verified, r.done, r.total) + (r.next ? D.next(r.next.number, r.next.text) : D.allDone));
        if (r.note) console.log("  ⚠ " + r.note);
      });
    }

    case "approve": {
      if (!pos[0] || !pos[1]) usage("dev-spec approve <feature> <phase> [--force] [--by NAME]");
      // Default approver: the engine's (same as MCP). --force = spec_approve {force: true}; a refusal exits 1 listing the failing checks.
      const r = spec.approvePhase(projectDir, pos[0], pos[1], typeof flags.by === "string" ? flags.by : undefined, { force: on("force") });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        console.log(featureText(r.feature).approved(r.approved, r.feature));
        if (r.note) console.log("  ⚠ " + r.note); // a forced approval names the checks that were failing
      });
    }

    case "evals": {
      if (!pos[0]) usage("dev-spec evals <feature> [--dry-run] [--set-baseline]");
      const passthru = argv.slice(argv.indexOf(pos[0]) + 1);
      const res = spawnSync(process.execPath, [EVALS, pos[0], "--project", projectDir, ...passthru], { stdio: "inherit" });
      return process.exit(res.status || 0);
    }

    case "backlog": {
      const a0 = String(pos[0] == null ? "" : pos[0]).trim().toLowerCase(); // case-folded, like the engine and the MCP enum
      // No action lists; an unknown one (delete, ad…) is an error from the engine, as over MCP — it used to just list.
      const action = a0 || "list";
      const r = spec.backlog(projectDir, action, pos[1], action === "add" ? pos.slice(2).join(" ") : undefined);
      if (!r.ok) return fail(r); // e.g. rm of a name that isn't in the backlog
      const T = projectText();
      return out(r, (r) => {
        if (action === "add") console.log(T.backlogAdded(String(pos[1]).trim()));
        else if (action === "rm" || action === "remove") console.log(T.backlogRemoved(String(pos[1]).trim()));
        console.log(T.backlogHead(r.backlog.length));
        r.backlog.forEach((b) => console.log("  - " + b.name + (b.note ? " — " + b.note : "")));
      });
    }

    case "roadmap": {
      // Same engine call as spec_roadmap: a failed write (e.g. a hand-written ROADMAP.md) is an error → exit 1.
      const r = spec.roadmapReport(projectDir, { write: on("write") || on("md"), html: on("html"), lang: flags.lang });
      if (r.ok === false) process.exitCode = 1;
      const T = cliText(flags.lang || spec.projectLang(projectDir));
      if (!flags.json) {
        (r.wrote || []).forEach((file, i) => console.log(i === 0 && /\.md$/i.test(file) ? T.wrote(file, r.overallPercent, r.complete, r.total) : T.wrote(file)));
        (r.errors || []).forEach((e) => console.error("dev-spec: " + e));
        (r.warnings || []).forEach((w) => console.error("dev-spec: " + w)); // e.g. a hand-written ROADMAP.html kept (non-fatal)
      }
      return out(r, (r) => { // --json stays one valid JSON document (wrote/errors/warnings included)
        if (!r.features.length) return console.log(T.noRoadmapFeatures(r.specsDir));
        console.log(T.roadmapHead(r.overallPercent, r.complete, r.total, r.cycle ? r.cycle.join(" → ") : null));
        r.features.forEach((f) => console.log("  " + (f.blocked ? "⛔" : "  ") + " " + f.name.padEnd(26) + " " + String(f.percent + "%").padStart(4) + "  [" + f.tracks + "]  " + T.phase(f.phase) + (f.dependsOn.length ? T.deps(f.dependsOn.join(","), f.unmetDeps.join(",")) : "")));
      });
    }

    case "depend": {
      const syntax = "dev-spec depend <feature> [dep1 dep2 ...] [--add x[,y]] [--rm x[,y]] [--order N] [--clear]";
      if (!pos[0]) usage(syntax);
      // The shared parser keeps only the LAST value of a repeated flag, so `--add b --add c` silently added c
      // alone. Collect every occurrence here, walking argv with the parser's own rules.
      const every = (name) => {
        const vals = [];
        for (let i = 0; i < argv.length; i++) {
          const a = argv[i];
          if (a === "--json") continue;
          if (a.startsWith("--") && a.includes("=")) { if (a.slice(2, a.indexOf("=")) === name) vals.push(a.slice(a.indexOf("=") + 1)); }
          else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2))) { const v = argv[++i]; if (a.slice(2) === name) vals.push(v); }
        }
        return vals;
      };
      const adds = every("add"), rms = every("rm");
      if (adds.concat(rms).some((v) => typeof v !== "string")) usage(syntax);
      // Same semantics as the MCP tool: positional deps REPLACE the list, --clear empties it, --add/--rm edit
      // it; with nothing at all it only shows the current deps (a bare `depend <f>` used to clear them).
      const deps = pos.slice(1).length ? pos.slice(1) : on("clear") ? [] : undefined;
      const r = spec.setDependency(projectDir, pos[0], deps, flags.order, { add: adds.length ? adds.join(",") : undefined, remove: rms.length ? rms.join(",") : undefined });
      if (!r.ok) return fail(r);
      return out(r, (r) => console.log(projectText().dependsOn(r.feature, r.dependsOn.join(", "), r.order, r.unknownDeps.join(", ")))); // project language, like the engine's depend messages
    }

    case "scan": {
      const root = pos[0] ? path.resolve(pos[0]) : projectDir;
      const r = spec.scanCodebase(root, { cap: intFlag("cap") });
      const T = cliText(spec.projectLang(root)); // same language as the engine's note
      const B = spec.msg(spec.projectLang(root)).brownfield;
      return out(r, (r) => {
        console.log(T.scanHead(r.root, r.truncated));
        console.log(T.scanFiles(r.filesScanned, r.stack.join(" · ")));
        console.log(T.scanDirs(r.topLevelDirs.join(", ")));
        console.log(T.scanExt(r.byExtension.join("  ")));
        if (r.frameworks.length) console.log(B.frameworks(r.frameworks.join(", ")));
        console.log(T.scanEndpoints(r.candidateEndpoints, r.endpointFiles));
        r.routes.slice(0, 15).forEach((x) => console.log(B.routeLine(x.method, x.path, x.file + ":" + x.line)));
        if (r.candidateEndpoints > 15) console.log(B.moreRoutes(r.candidateEndpoints - 15));
        if (r.routesNote) console.log("    " + r.routesNote);
        console.log(B.tests(r.testFiles, r.testFrameworks.join(", ") || B.none));
        console.log(B.entrypoints(r.entrypoints.map((e) => e.file + " (" + e.kind + ")").join(", ") || B.none));
        console.log(B.env(r.envVars.slice(0, 20).join(", ") || B.none, Math.max(0, r.envVarsTotal - 20)));
        console.log(B.migrations(r.migrationsTotal, r.migrationDirs.join(", ")));
        if (r.readNote) console.log("  " + r.readNote);
      });
    }

    case "coverage": {
      const r = spec.coverage(projectDir);
      const T = projectText();
      const B = spec.msg(spec.projectLang(projectDir)).brownfield;
      const folder = (x) => (x === "." ? B.root : x);
      return out(r, (r) => {
        console.log(T.coverage(r.coveragePercent, r.coveredFiles, r.codeFiles));
        if (r.testFiles) console.log(B.coverageTests(r.testFiles));
        r.byFolder.slice(0, 30).forEach((f) => console.log(B.coverageFolder(f.folder === "." ? B.root : f.folder + "/", f.covered, f.files, f.percent)));
        if (r.undocumented.length) console.log(T.undocumented(r.undocumented.map(folder).join(", ")));
        if (r.unmatchedImplements.length) console.log(B.coverageUnmatched(r.unmatchedImplements.map((u) => u.ref).join(", ")));
        if (r.nonCodeImplements.length) console.log(B.coverageNonCode(r.nonCodeImplements.map((u) => u.ref).join(", ")));
      });
    }

    case "clarify": {
      if (!pos[0]) usage("dev-spec clarify <feature>");
      const r = spec.clarify(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      const T = featureText(r.feature);
      return out(r, (r) => {
        console.log(T.clarify(r.feature, r.tracks, T.word(r.verdict), r.gapCount));
        r.questions.forEach((q, i) => console.log("  " + (i + 1) + ". " + q));
      });
    }

    case "next-action":
    case "na": {
      if (!pos[0]) usage("dev-spec next-action <feature>");
      const r = spec.nextAction(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      const T = featureText(r.feature);
      return out(r, (r) => {
        console.log(T.naHead(r.feature, r.tracks, T.phase(r.phase), T.word(r.verdict), T.bool(r.gatesOk)));
        if (r.changedSinceApproval.length) console.log(T.changed(r.changedSinceApproval.join(", ")));
        console.log("  → " + r.recommendation);
      });
    }

    case "add-track": {
      const tr = withTracksFlag(pos.slice(1));
      if (!pos[0] || !tr.length) usage("dev-spec add-track <feature> <tdd|saas|ai>... [--remove]");
      // Several tracks at once ("saas ai", "saas,ai"); --remove turns them off (files kept, listed as inactive).
      const r = spec.addTrack(projectDir, pos[0], tr, { remove: on("remove") });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        console.log(featureText(r.feature).trackNow(r.feature, r.tracks));
        if (r.added && r.added.length) console.log("  + " + r.added.join(", "));
        if (r.inactive && r.inactive.length) console.log("  ~ " + r.inactive.join(", "));
        if (r.note) console.log("  " + r.note);
      });
    }

    case "feature": {
      // dev-spec feature <remove|archive|rename|restore> <name> [new-name] — remove needs --yes (= spec_feature confirm:true)
      if (!pos[0] || !pos[1]) usage("dev-spec feature <remove|archive|rename|restore> <name> [new-name] [--yes]");
      const T = featureText(pos[1]); // resolved BEFORE the folder moves or disappears
      const r = spec.manageFeature(projectDir, pos[0], pos[1], pos[2], { confirm: on("yes") });
      if (!r.ok && r.needsConfirm) {
        // Without --yes: show what would be deleted, delete nothing, exit 1.
        process.exitCode = 1;
        return out(r, (r) => {
          console.log(T.wouldRemove(r.feature, r.wouldDelete.dir, r.wouldDelete.files, r.wouldDelete.entries.join(", ")));
          console.log(T.confirmHint(r.feature));
        });
      }
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        if (r.action === "rename") {
          console.log(T.renamed(r.from, r.to));
          if (r.note) console.log("  " + r.note); // _Supersedes:_ references / archive records that follow the new name
        }
        else if (r.action === "archive") console.log(T.archived(r.feature, String(r.dest).replace(/\\/g, "/")));
        else if (r.action === "restore") {
          const RT = spec.msg(spec.featureLang(projectDir, r.feature)).restore; // back in place: its own language
          console.log(RT.done(r.feature));
          if (r.note) console.log("  ⚠ " + r.note);
        }
        else console.log(T.removed(r.feature));
      });
    }

    case "rules": {
      // dev-spec rules <cursor|windsurf|copilot|gemini|agents> — a per-tool rule file from THIS clone, with its
      // relative paths made absolute so it works pasted into any project (like mcp-config, never committed).
      const RULE_FILES = {
        cursor: ".cursor/rules/dev-spec-driven.mdc",
        windsurf: ".windsurf/rules/dev-spec-driven.md",
        copilot: ".github/copilot-instructions.md",
        gemini: "GEMINI.md",
        agents: "AGENTS.md",
      };
      if (!pos[0]) usage("dev-spec rules <" + Object.keys(RULE_FILES).join("|") + ">");
      const tool = String(pos[0]).toLowerCase();
      // Own keys only: `constructor`/`__proto__` would pass a plain lookup and crash path.join.
      if (!Object.prototype.hasOwnProperty.call(RULE_FILES, tool)) die(projectText().unknownRules(pos[0], Object.keys(RULE_FILES).join(", ")));
      const ROOT = path.resolve(__dirname, "..").replace(/\\/g, "/"); // forward slashes: valid in markdown and on Windows
      const raw = fs.readFileSync(path.join(__dirname, "..", RULE_FILES[tool]), "utf8");
      // One pass (so skills/…/references/x.md is never rewritten twice). `../../AGENTS.md` (the Cursor link)
      // and bare `references/x.md` (relative to the skill) resolve too. Commands get quoted paths and link
      // targets get <…> when the clone path has spaces.
      const re = /(\bnode\s+|\]\()?(?<![\w./-])(?:\.\.\/)*(cli\/dev-spec\.js|mcp\/server\.js|AGENTS\.md|skills\/dev-spec-driven(?:\/[\w.-]+)*\/?|references\/(?:[\w.-]+\.md)?)/g;
      const text = raw.replace(re, (m, lead, rel) => {
        const abs = ROOT + "/" + (rel.startsWith("references/") ? "skills/dev-spec-driven/" + rel : rel);
        if (lead && /^node/.test(lead)) return lead + JSON.stringify(abs);
        if (lead) return lead + (/\s/.test(abs) ? "<" + abs + ">" : abs);
        return abs;
      }).replace(/ \(repo root\)/g, "");
      return process.stdout.write(text.endsWith("\n") ? text : text + "\n");
    }

    case "import": {
      // dev-spec import <kiro|spec-kit|openspec> <path> [--name n] [--lang] [--tracks …] — the same engine call as
      // spec_import: <path> resolves against the project root and must stay inside it.
      if (!pos[0] || !pos[1]) usage("dev-spec import <kiro|spec-kit|openspec> <path> [--name <feature>] [--lang en|pt|es] [--tracks tdd,saas,ai]");
      const r = spec.importSpec(projectDir, pos[0], pos[1], { name: flags.name, lang: flags.lang, tracks: withTracksFlag(pos.slice(2)) });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        const B = spec.msg(r.lang).importSpec;
        console.log(B.done(r.toolName, r.source, r.feature, r.label, r.lang));
        console.log("  " + r.files.join(", "));
        const ids = Object.entries(r.mapping);
        console.log(B.mapping(ids.length, ids.slice(0, 6).map(([a, b]) => a + " → " + b).join(", ") + (ids.length > 6 ? ", …" : "")));
        r.warnings.forEach((w) => console.log("  ⚠ " + w));
      });
    }

    case "append-tasks": {
      // dev-spec append-tasks <feature> --task "<text>" [...] — ONE task per call; = spec_append_tasks {tasks: [that task]}
      if (!pos[0] || typeof flags.task !== "string") usage('dev-spec append-tasks <feature> --task "<text>" [--req US-1.AC-2[,…]] [--implements path[,…]] [--verify "<cmd>"] [--story US1|shared] [--parallel] [--heading "<phase heading>"]');
      const T = spec.msg(spec.featureLang(projectDir, pos[0])).appendTasks;
      // The shared parser keeps only the LAST value of a repeated flag, so `--req a --req b` silently dropped a.
      // Collect every occurrence, walking argv with the parser's own rules (as `depend` does for --add/--rm).
      const every = (name) => {
        const vals = [];
        for (let i = 0; i < argv.length; i++) {
          const a = argv[i];
          if (a.startsWith("--") && a.includes("=")) { if (a.slice(2, a.indexOf("=")) === name) vals.push(a.slice(a.indexOf("=") + 1)); }
          else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2)) && argv[i + 1] !== undefined && !/^--[A-Za-z]/.test(argv[i + 1])) { const v = argv[++i]; if (a.slice(2) === name) vals.push(v); }
        }
        return vals;
      };
      // A second --task is a second task: refused (one per call) rather than merged or dropped.
      if (every("task").length > 1) die(T.oneTaskPerCall);
      // Single-valued like over MCP: a second --verify would silently drop the first check (the evidence gate would
      // never ask for it), a second --story/--heading the first choice — refused, never last-wins.
      const twice = ["verify", "story", "heading"].find((k) => every(k).length > 1);
      if (twice) die(T.oneValue(twice));
      const task = { text: flags.task };
      const reqs = every("req"), impls = every("implements");
      if (reqs.length) task.requirements = reqs; // each may hold "a,b" — the engine splits it, same as over MCP
      if (impls.length) task.implements = impls;
      if (typeof flags.verify === "string") task.verify = flags.verify;
      if (typeof flags.story === "string") task.story = flags.story;
      if (flags.parallel != null) task.parallel = on("parallel");
      const r = spec.appendTasks(projectDir, pos[0], [task], { heading: typeof flags.heading === "string" ? flags.heading : undefined });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        console.log(T.appended(r.heading, r.headingCreated));
        r.appended.forEach((t) => console.log("  - [ ] " + t.number + ". " + t.text));
        if (r.note) console.log("  ⚠ " + r.note);
      });
    }

    case "impact": {
      // dev-spec impact <feature> [--phase requirements|design|tasks] [--reopen] — the same engine call as spec_impact
      if (!pos[0]) usage("dev-spec impact <feature> [--phase requirements|design|tasks] [--reopen]");
      const r = spec.impactReport(projectDir, pos[0], { phase: flags.phase, reopen: on("reopen") });
      if (!r.ok) return fail(r);
      return out(r, (r) => spec.impactLines(r).forEach((l) => console.log(l)));
    }

    case "metrics": {
      // dev-spec metrics [feature] [--write] — one feature (+ retro.md with --write) or the whole project; = spec_metrics
      const r = spec.metrics(projectDir, pos[0], { write: on("write") });
      if (!r.ok) return fail(r);
      return out(r, (r) => spec.metricsLines(r).forEach((l) => console.log(l)));
    }

    case "catalog": {
      // dev-spec catalog [--write] — the living .specs/SPECS.md (= spec_catalog {write}). Without --write the markdown is
      // printed; a hand-written SPECS.md (no AUTO-GENERATED marker) is never overwritten → exit 1.
      const r = spec.catalog(projectDir, { write: on("write") });
      if (r.ok === false) process.exitCode = 1;
      if (!flags.json && r.error) console.error("dev-spec: " + r.error);
      const C = spec.msg(r.lang).catalog;
      return out(r, (r) => {
        if (r.wrote) console.log(C.cliWrote(r.file, r.totals.features, r.totals.acs, r.totals.superseded));
        else if (r.markdown != null) process.stdout.write(r.markdown);
      });
    }

    case "drift": {
      // dev-spec drift [feature] — implementing files changed / missing / now present since spec_finish recorded the
      // baseline (= spec_drift {name}); exit 1 when any finished feature drifted or a state file couldn't be read (a check
      // that didn't run is not "clean" — scriptable, like trace).
      const r = spec.drift(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      if (r.drifted.length || (r.errors && r.errors.length)) process.exitCode = 1;
      const D = spec.msg(r.lang).drift;
      const day = (iso) => String(iso || "").slice(0, 10);
      return out(r, (r) => {
        if (r.note) console.log(r.note);
        for (const f of r.features) {
          const n = f.changed.length + f.missing.length + f.nowPresent.length;
          if (!f.drifted) { console.log(D.clean(f.feature, f.files, day(f.finishedAt), f.archived)); continue; }
          console.log(D.drifted(f.feature, n, f.files, day(f.finishedAt), f.archived));
          if (f.changed.length) console.log(D.changed(f.changed.join(", ")));
          if (f.missing.length) console.log(D.missing(f.missing.join(", ")));
          if (f.nowPresent.length) console.log(D.nowPresent(f.nowPresent.join(", ")));
        }
        if (r.reopened.length) console.log(D.reopened(r.reopened.join(", ")));
        if (r.unbaselined.length) console.log(D.unbaselined(r.unbaselined.join(", ")));
        (r.errors || []).forEach((e) => console.error("dev-spec: " + e.error));
      });
    }

    case "mcp-config":
      return console.log(mcpConfig(pos[0]));

    default:
      die(projectText().unknownCommand(cmd));
  }
}

// `list` and a bare `status`: one line per feature, in the project language.
function main2list() {
  const r = spec.listFeatures(projectDir);
  const T = projectText();
  out(r, (r) => {
    if (!r.exists || !r.features.length) return console.log(T.noFeatures(r.specsDir));
    r.features.forEach((f) => console.log(T.listLine(f.name, f.tracks, T.phase(f.phase), f.tasksDone, f.tasks)));
  });
}

function helpText() {
  return `dev-spec — universal spec-driven CLI (local, zero-dependency)

  classify "<description>" [--name "<feature>"]   Recommend tracks (core/+tdd/+saas/+ai), multilingual
  init [tracks...] [--lang]       Scaffold .specs/steering (--lang en|pt|es → project default)
                                  --guard on|off: guard mode — Write/Edit on code files asks while no feature has approved, open tasks
  steering <file> [--lang]        Create one steering file from its template (constitution.md, tech.md, …) — any other
                                  name like api-rules.md → a custom scoped file (front matter inclusion: always|fileMatch|manual)
  create "<name>" [tracks...]     Scaffold a feature folder (auto-classifies if no tracks; --summary, --kind feature|bugfix, --lang en|pt|es)
                                  --brownfield also scaffolds integration-plan.md (a feature landing in an existing codebase)
  bugfix "<name>" [--summary]     Scaffold the bugfix flow: bug.md (repro · root cause · fix) + regression test plan
  list                            List features (phase + task progress)
  status [feature]                Status of a feature, or all (sections: ✓ filled · ◐ unfilled · ✗ missing)
  doctor <feature>                Health-check → ready to advance? (exit 1 on FAIL; trace/ears likewise on gaps/errors)
  trace <feature> [--code]        Traceability AC ↔ task ↔ test ↔ code (_Implements:_, phantom refs) — lists every gap,
                                  then the EC/NFR/SC warnings; --code also scans test files for the T-IDs they name
  clarify <feature>               Surface ambiguities/gaps in requirements before design
  ears <feature|file.md>          Lint EARS (SHALL/DEVE/DEBE, IDs, vague words);
       ears --text "…" | ears -   … or raw text / stdin (same as ears_validate {text})
  next <feature> [--batch]        Next unchecked task (--batch: + the [P] tasks that can run beside it; --max N, default 3)
  next-action <feature>           "You are here → do this next" (+ what changed since approval); alias: na
  brief <feature> [n] [--write]   Self-contained brief for task n (default: next open) — ACs, tests, design, DoD;
                                  --write → .specs/<feature>/.execution/task-<n>-brief.md (subagent execution)
  done <feature> <n> [--run]      Mark task n complete; --run executes its _Verify:_ command(s) first and records the evidence
                                  (a failure leaves it open; --shell bash|<path> or DEV_SPEC_SHELL picks the shell); or --evidence "…" [--exit N] [--cmd "…"]
  finish <feature> [--write] [--include-body]   Readiness report + merge summary from the spec chain (exit 1 if not ready);
                                  --write → .execution/merge-summary.md, --include-body also prints/returns the summary
  append-tasks <feature> --task "…"   Append one task to tasks.md, numbered after the last (default phase 'Phase: Convergence'):
                                  --req US-1.AC-2[,…] (must exist) · --implements path[,…] · --verify "<cmd>" · --story US1|shared · --parallel · --heading "…"
  approve <feature> <phase> [--force]  Record a phase approval (.state.json) — refused while that phase's checks fail;
                                  --force records it anyway (flagged as forced, with the failing checks)
  impact <feature> [--phase p] [--reopen]   What an edit after approval touches, against the approved snapshot
                                  (--phase requirements|design|tasks, default requirements): changed ACs/sections/tasks →
                                  tasks, tests, design; --reopen unticks the affected done tasks and marks their evidence stale
  metrics [feature] [--write]     Lead times, rework, forced approvals, change requests, evidence pass rate (project: + avg/median);
                                  --write → .specs/<feature>/retro.md (a pre-filled retrospective, never overwritten)
  add-track <feature> <track...>  Escalate a feature to +tdd/+saas/+ai (additive, never overwrites);
                                  --remove turns a track off (non-destructive: files kept, listed as inactive)
  feature <remove|archive|rename|restore> <name> [new-name]   Manage a feature's lifecycle (remove shows what it would delete; --yes deletes;
                                  restore brings an archived feature back with its roadmap entry and dependencies)
  catalog [--write]               Living catalog: every feature's ACs, superseded ones marked (_Supersedes:_); --write → .specs/SPECS.md
  drift [feature]                 Implementing files changed / missing / new since finish recorded its baseline (exit 1 on drift)
  roadmap [--write][--html][--lang]  Roadmap: %, deps, blocked, cycles. --write (alias --md) → .specs/ROADMAP.md (default); --html also writes the brand-styled ROADMAP.html (light/dark); --lang en|pt|es
  depend <feature> [deps...]      Show / set dependencies: deps replace the list; --add x,y · --rm x · --clear · --order N
                                  (every dep must be an existing feature; cycles are rejected)
  backlog [add|rm <name> [note]]  Manage planned-but-unspecced features (shown in ROADMAP.md)
  scan [path]                     Brownfield: inventory an existing codebase (stack, frameworks, routes with file:line,
                                  tests, entrypoints, env var names, migrations)
  coverage                        Brownfield: % of code files named in any _Implements:_ (active + archived features), per folder
  import <kiro|spec-kit|openspec> <path>   Import another tool's spec as a NEW feature (IDs → US-N.AC-M, scenarios → EARS,
                                  tasks renumbered, checkbox state kept); --name <feature> · --lang en|pt|es · --tracks tdd,saas,ai
  evals <feature> [--dry-run]     Run the local eval harness (+ai; your ANTHROPIC_API_KEY)
  mcp-config [client]             Print ready MCP config: claude-desktop|claude-code|cursor|windsurf|vscode|gemini|codex|generic|all
  rules <tool>                    Print a rule file (cursor|windsurf|copilot|gemini|agents) with this clone's absolute paths

  Flags: --json  --project <dir>  --lang en|pt|es (init/create/steering/roadmap/ears)  --order N (depend)
         --name "<feature>" (classify)  --summary "…"  --kind feature|bugfix (create)  --text "…" (ears)
         --batch  --max N (next)  --write / --include-brief (brief)  --write / --include-body (finish)
         --yes (feature remove)  --write|--md / --html (roadmap)  --cap N (scan)  --by NAME / --force (approve)
         --brownfield (create)  --name (import)  --tracks tdd,saas (import/create/init/add-track, beside positional tracks)
         Value flags need a value (--flag value or --flag=value); a following --flag is not one.
         Switches: --flag, or --flag=true|false (1/0, yes/no, on/off; anything else is an error).
         With --json a refused operation still prints its result ({"ok": false, "error": …}) on stdout, exit 1.

  Works the same in Claude Code, Cursor, Windsurf, Copilot, Gemini/Codex CLI, or a plain shell.`;
}

// Engine guards (e.g. an unreadable roadmap.json) surface as a one-line error, not a stack trace.
try {
  main();
} catch (e) {
  die(e.message);
}

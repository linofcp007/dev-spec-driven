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
 *                                      --guard on|off|scope → guard mode: code edits ask while no approved tasks
 *                                      (scope: also a code file no open task names in _Implements:_);
 *                                      --stop-check on|off → the end-of-turn evidence gate (roadmap.json meta.stopCheck, on by default);
 *                                      --check name="cmd" (repeatable; name= removes) → roadmap.json meta.checks)
 *                                      --roles requirements=product,design=tech+security → approvals by role, none clears)
 *                                      --approval-guard off|ask|deny → an agent's approval asks the user / is refused (meta.approvalGuard)
 *   steering <file> [--lang]            Create one steering file from its template, or a custom scoped one
 *                                      (any other name-like.md → front matter inclusion: always|fileMatch|manual)
 *   templates [list|init|check] [artifact] [--lang]  The project's own scaffolds in .specs/templates/ (exit 1 on a check error)
 *   create "<name>" [tracks...]         Scaffold a feature (auto-classifies if no tracks; --summary, --kind, --lang,
 *                                      --brownfield → + integration-plan.md; --flow design-first → design before requirements)
 *   bugfix "<name>" [--summary]         Scaffold the bugfix flow (bug.md + regression test plan)
 *   spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]  Scaffold a spike: spike.md (question · timebox · options ·
 *                                      evidence · decision go/no-go/pivot) + investigation tasks (= create --kind spike)
 *   decide <feature> --title "…" --decision "…"  Append a D-n entry to decisions.md ([--context] [--consequences]
 *                                      [--affects US-1.AC-2,T-03] [--supersedes D-1] [--discovery])
 *   list                               List features + phase + progress
 *   status [feature]                   Status of one feature (or all)
 *   doctor <feature>                   Health-check → ready to advance?
 *   trace <feature> [--code]           Traceability AC↔task↔test↔code (every gap listed; EC/NFR/SC warnings;
 *                                      --code also scans test files for the T-IDs they name)
 *   clarify <feature>                  Surface ambiguities/gaps in requirements
 *   ears <feature|path> | --text "…" | -   Lint EARS in requirements.md, a file, raw text or stdin
 *   next <feature> [--batch] [--max N] Next unchecked task (+ the [P] tasks that can run beside it)
 *   done <feature> <n>                 Mark task n complete (--run [--shell bash|<path>] · --evidence/--exit/--cmd);
 *                                      an _Expect: fail_ task needs a FAILING run (the red proof); --run records the git commit
 *   approve <feature> <phase> [--by NAME] [--force]  Record a phase approval — refused while its checks fail
 *                                      (--by = who approved; --force records it anyway, flagged as forced;
 *                                      --role ROLE = the role you sign off for, when init --roles lists the phase)
 *   approve <feature> --through <phase> Fast-forward: approve every active phase up to <phase>, in order, each through its
 *                                      own gate — stops at the first refused one (/spec-ff)
 *   impact <feature> [--phase p] [--reopen]  What an edit after approval touches (vs the approved snapshot);
 *                                      --phase requirements|design|tasks, --reopen unticks the affected done tasks
 *                                      (never a removed criterion's — `retire` lists those to delete or repoint)
 *   metrics [feature] [--write]        Lead times, rework, change requests, evidence pass rate, velocity (--write → retro.md)
 *   next-action|na <feature>           "You are here → do this next" (+ changed-since-approval)
 *   brief <feature> [n] [--write] [--include-brief]  Self-contained brief for one task (subagent execution)
 *   finish <feature> [--write] [--include-body] [--run]  Readiness report + merge summary (no PRs);
 *                                      --run [--shell bash|<path>] runs the project checks (meta.checks) and records them
 *   append-tasks <feature> --task "…" [--req ids] [--implements paths] [--verify "cmd"] [--story US1|shared]
 *                                      [--makes-green T-01,…] [--expect-fail] [--size XS|S|M|L|XL]
 *                                      [--parallel] [--heading "…"]  Append one task to tasks.md (converge)
 *   add-track <feature> <track...>     Escalate a feature to +tdd/+saas/+ai/+sec/+privacy (additive); --remove turns one off
 *   feature <action> <name> [new]      remove (needs --yes) | archive | rename | restore a feature; flow <name> <flow> sets its phase order
 *   catalog [--write]                  Living catalog: every feature's ACs, superseded ones marked → .specs/SPECS.md
 *   export [feature] [--md] [--write]  Stakeholder document (offline HTML, or markdown) → .specs/exports/ (no feature = project)
 *   changelog [--since d|last|all] [--write]  Release notes from the specs → .specs/RELEASE-NOTES.md (+ meta.changelogAt)
 *   drift [feature]                    Implementing files changed/missing since finish (exit 1 on drift or a stale baseline)
 *   stop-check [--message "<text>"|-] [--agent <type>]  The Stop hook's evidence gate for a closing message: does it claim
 *                                      done / verified while a recently active feature has ticked tasks without evidence? (exit 1 = sent back)
 *   log <feature> [--max N] [-]        Commits citing each task ("task #N" + the feature name, T-/AC IDs) + the +tdd red-first
 *                                      check, from git log (read-only, local; default 1000 commits); - reads a log from stdin
 *   upgrade [--apply]                  After a plugin update: audit .specs/ against the current rules (read-only);
 *                                      --apply runs the safe migrations + writes .specs/UPGRADE.md (exit 1 only on errors)
 *   roadmap [--write|--md] [--html] [--lang]  Multi-feature roadmap: ETA forecasts, cross-feature overlaps (+ .specs/ROADMAP.md / .html)
 *   depend <feature> [deps...] [--add x] [--rm x] [--clear] [--order N]  Show / set dependencies (rejects cycles)
 *   backlog [add|rm|remove <name> [note]]  Planned-but-unspecced features
 *   scan [path] [--cap N]              Brownfield: inventory an existing codebase (routes, tests, entrypoints, env names, migrations)
 *   coverage                           Brownfield: % of code files named in _Implements:_ (per folder)
 *   import <kiro|spec-kit|openspec|plan|execplan|bmad> <path> [--name n] [--lang] [--tracks …]  Import another tool's spec / a plan as a NEW feature
 *   evals <feature> [--dry-run ...]    Run the local eval harness (+ai)
 *   mcp-config [client]                Print ready MCP config (claude-desktop|claude-code|
 *                                      cursor|windsurf|vscode|gemini|codex|generic|all)
 *   rules <tool>                       Print a rule file (cursor|windsurf|copilot|gemini|agents)
 *                                      with this clone's absolute paths, to paste into a project
 *   prompts [name] [--args "…"]        The MCP prompts (one per plugin command): list them, or print one rendered as
 *                                      prompts/get returns it ($ARGUMENTS ← --args, or the words after the name)
 *
 * Flags: --json (raw JSON output) · --project <dir> (project root, default cwd) · --lang en|pt|pt-BR|es
 *        done: --run · --shell bash|<path> · --timeout <s> · --evidence "…" · --exit N · --cmd "…"   (value flags need a value; a following --flag is not one)
 *        init: --check name="cmd" (repeatable) · finish: --run · --shell bash|<path> · --timeout <s> · log: --max N (default 1000)
 *        --run: a command that could not run (missing shell, signal, --timeout, WSL's bash launcher) records nothing;
 *        on Windows --shell bash is Git Bash (never WSL's System32 / WindowsApps bash.exe)
 *        upgrade: --apply (the safe migrations: tracks, history baselines, .gitignore, meta.specVersion, UPGRADE.md)
 *        prompts: --args "…" (the command's arguments, = prompts/get {arguments: {args}})
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
VALUE_FLAGS.add("args"); // prompts <name> --args "…" (= MCP prompts/get {arguments: {args}})

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

// append-tasks <f> --task "<text>" [--req ids] [--implements paths] [--verify "<cmd>"] [--makes-green T-01] [--size M] [--story US1] [--heading "<phase>"]
["task", "req", "implements", "verify", "story", "heading", "makes-green", "size"].forEach((k) => VALUE_FLAGS.add(k));
VALUE_FLAGS.add("timeout"); // done --run / finish --run --timeout <seconds> (full review Ga10): a run past it is could-not-run, nothing recorded

VALUE_FLAGS.add("phase"); // impact <f> --phase requirements|design|test-plan|eval-plan|tasks

VALUE_FLAGS.add("guard"); // init --guard on|off|scope (= spec_init {guard: true|false|"scope"})
["stop-check", "message", "agent"].forEach((k) => VALUE_FLAGS.add(k)); // 1.14 C1: init --stop-check on|off (= spec_init {stopCheck}); stop-check --message "…" --agent <type>
VALUE_FLAGS.add("check"); // init --check name="cmd" (repeatable; name= removes) = spec_init {checks: {name: cmd}}
VALUE_FLAGS.add("approval-guard"); // 1.14 F2: init --approval-guard off|ask|deny (= spec_init {approvalGuard})
["roles", "role", "through"].forEach((k) => VALUE_FLAGS.add(k)); // init --roles …, approve --role <role> / --through <phase> (= spec_init {approvalRoles}, spec_approve {role, through})
VALUE_FLAGS.add("since"); // changelog --since <ISO date|last|all> (= spec_changelog {since})
VALUE_FLAGS.add("flow"); // create --flow design-first · feature flow <name> --flow <flow> (= spec_create / spec_feature {flow}) — C3
// 1.14 C2: spike / create --kind spike --question … --timebox … · decide <f> --title … --decision … [--context …] [--consequences …] [--affects …] [--supersedes …]
["question", "timebox", "title", "decision", "context", "consequences", "affects", "supersedes"].forEach((k) => VALUE_FLAGS.add(k));
let missingValue = null; // reported in main(), once --project is known (message in the project language)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  // `--` ends the options (POSIX): every later token is positional (`create -- --odd-name`) — it used to become flags[""].
  // argv is cut there, so the repeated-flag collectors below (depend --add, init --check, decide --affects…) stop there too.
  if (a === "--") { pos.push(...argv.slice(i + 1)); argv.splice(i); break; }
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
const BOOL_FLAGS = ["json", "run", "remove", "write", "md", "html", "batch", "include-brief", "include-body", "code", "force", "reopen", "yes", "brownfield", "parallel", "clear", "apply", "discovery", "expect-fail"];
const on = (k) => flags[k] === true;
// A switch passed through to an engine option whose default depends on others (finish's includeBody, brief's includeBrief:
// true when not writing): absent → undefined (the engine's default), else the explicit boolean — `--include-body=false`
// is false, as spec_finish {includeBody: false} (on() ? true : undefined turned it into the default).
const boolFlag = (k) => (typeof flags[k] === "boolean" ? flags[k] : undefined);
BOOL_FLAGS.push("help"); // --help anywhere prints the help (`done big 2 --help` ticked the task)
// An unknown --flag is a usage error, before anything runs: it used to be accepted as a silent boolean switch, so
// `done big 2 --rnu` ticked the task with no evidence (exit 0). Known = VALUE_FLAGS ∪ BOOL_FLAGS, with a did-you-mean.
// `evals` forwards its flags untouched to mcp/evals/run-evals.js, which checks its own (--dry-run, --max-items…).
function refuseUnknownFlags() {
  if (cmd === "evals") return;
  const known = [...VALUE_FLAGS, ...BOOL_FLAGS];
  const bad = Object.keys(flags).find((k) => !known.includes(k));
  if (bad === undefined) return;
  // Optimal-string-alignment distance (a transposition — --rnu — costs 1), as the track did-you-mean.
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  };
  const k = bad.toLowerCase();
  let best = null;
  for (const c of known) {
    const n = dist(k, c);
    if (n <= Math.max(1, Math.floor(c.length / 3)) && (!best || n < best.n)) best = { c, n };
  }
  die(projectText().unknownFlag("--" + bad, best ? "--" + best.c : null));
}
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
const CLI_LANGS = spec.LANGS; // = the MCP tools' `lang` enum (en · pt · es · pt-BR)
function main() {
  refuseUnknownFlags(); // `--rnu` is an error (did you mean --run?), never a silent switch
  if (missingValue) die(projectText().missingValue(missingValue));
  // --lang is checked once, like the MCP `lang` enum: an unknown value (fr, spanish, portugues…) is refused before any
  // command runs — the engine would quietly turn it into 'en' and SAVE it (init rewrote the project language).
  if (flags.lang !== undefined) {
    const l = spec.canonicalLang(String(flags.lang)); // PT → pt · pt-br / pt_BR / ptbr → pt-BR · pt-PT → pt (the MCP enum folds the same)
    if (!l || !CLI_LANGS.includes(l)) {
      const A = spec.msg(spec.projectLang(projectDir)).args;
      die(A.invalid(A.item("--lang", A.oneOf(CLI_LANGS.join(", ")), JSON.stringify(String(flags.lang)))));
    }
    flags.lang = l;
  }
  normalizeBoolFlags(); // `--run=false` is false, `--run=maybe` an error — before any command runs
  if (on("help") && cmd !== "evals") return console.log(helpText()); // `<command> --help` prints the help, runs nothing
  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      return console.log(helpText());

    case "classify": {
      if (!pos[0]) usage('dev-spec classify "<description>" [--name "<feature name>"] [--lang en|pt|pt-BR|es]');
      const r = spec.classify(pos.join(" "), { name: flags.name, lang: flags.lang, projectDir }); // same args as spec_classify
      return out(r, (r) => {
        const T = cliText(r.lang); // the language the reasoning was written in
        const conf = spec.msg(r.lang).classify.conf;
        console.log(T.tracks(r.label, spec.OPTIONAL_TRACKS.map((t) => t + "=" + (conf[r.confidence[t]] || r.confidence[t])).join(", ")));
        console.log(r.reasoning);
        if (r.note) console.log(T.note(r.note));
      });
    }

    case "init": {
      const tr = withTracksFlag(pos);
      // --guard on|off|scope = spec_init {guard: true|false|"scope"}; absent leaves the guard as it is.
      let guard;
      if (flags.guard !== undefined) {
        const g = String(flags.guard).trim().toLowerCase();
        if (["on", "true", "yes", "1"].includes(g)) guard = true;
        else if (["off", "false", "no", "0"].includes(g)) guard = false;
        else if (g === "scope") guard = "scope"; // 1.14 C1 — the scope guard
        else die(spec.msg(flags.lang || spec.projectLang(projectDir)).guardMode.badValue(flags.guard));
      }
      // 1.14 C1: --stop-check on|off = spec_init {stopCheck: true|false}; absent leaves the evidence gate as it is.
      let stopCheck;
      if (flags["stop-check"] !== undefined) {
        const v = String(flags["stop-check"]).trim().toLowerCase();
        if (["on", "true", "yes", "1"].includes(v)) stopCheck = true;
        else if (["off", "false", "no", "0"].includes(v)) stopCheck = false;
        else die(spec.msg(flags.lang || spec.projectLang(projectDir)).stopGate.badValue(flags["stop-check"]));
      }
      const checks = b5ChecksFlag(); // B5: --check name="cmd" (repeatable; name= removes) = spec_init {checks}
      // 1.14 F2: --approval-guard off|ask|deny = spec_init {approvalGuard}; absent leaves the human approval guard as it is.
      let approvalGuard;
      if (flags["approval-guard"] !== undefined) {
        approvalGuard = String(flags["approval-guard"]).trim().toLowerCase();
        if (!spec.APPROVAL_GUARD_LEVELS.includes(approvalGuard)) die(spec.msg(flags.lang || spec.projectLang(projectDir)).approvalGuard.badValue(flags["approval-guard"]));
      }
      // --roles requirements=product,design=tech+security | none = spec_init {approvalRoles} (1.14 B3); absent leaves them as they are.
      let approvalRoles;
      if (flags.roles !== undefined) {
        approvalRoles = spec.parseApprovalRolesText(flags.roles, flags.lang || spec.projectLang(projectDir));
        if (approvalRoles.error) die(approvalRoles.error);
      }
      const r = spec.initProject(projectDir, tr.length ? tr : ["core"], flags.lang, { guard, checks, approvalRoles, stopCheck, approvalGuard });
      if (r.ok === false) return fail(r); // e.g. an unknown track (did-you-mean) or an unreadable roadmap.json
      return out(r, (r) => {
        console.log(cliText(r.lang).created(r.specsDir, r.lang, r.created.join(", ") || cliText(r.lang).nothingNew, r.skipped.join(", ")));
        if (r.guardNote) console.log("  " + r.guardNote);
        if (r.stopCheckNote) console.log("  " + r.stopCheckNote);
        if (checks) console.log("  " + spec.msg(r.lang).projectChecks.initLine(Object.entries(r.checks || {}).map(([k, v]) => k + " → " + v).join(" · ") || "—"));
        if (r.rolesNote) console.log("  " + r.rolesNote);
        if (r.approvalGuardNote) console.log("  " + r.approvalGuardNote);
      });
    }

    case "bugfix":
    case "create": {
      if (!pos[0]) usage('dev-spec create "<name>" [tracks...] [--lang en|pt|pt-BR|es]');
      const name = pos[0];
      const tr = withTracksFlag(pos.slice(1));
      const tracks = tr.length ? tr : undefined; // none → engine: keep existing / classify new
      // the engine classifies a new feature in its language (the explicit --lang, else the project's) — same as spec_create
      const r = spec.createFeature(projectDir, name, tracks, flags.summary, undefined, flags.lang, cmd === "bugfix" ? "bugfix" : flags.kind,
        { brownfield: on("brownfield"), flow: flags.flow, question: flags.question, timebox: flags.timebox }); // = spec_create {brownfield, flow, question, timebox}
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
        for (const tr of ["sec", "privacy"]) if (r[tr + "Sections"]) console.log(fm.secPrivacy.statusSections[tr](marks(r[tr + "Sections"])));
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
        if (r.code) { // T-IDs run outside test code (a load-test.md / eval-set row) are listed apart, never counted as expected in code
          const outside = r.code.plannedOutsideCode || [];
          const expected = r.code.planned - outside.length;
          console.log(spec.msg(lang).deepTrace.codeSummary(expected - r.code.plannedNotInCode.length, expected, r.code.scanned, r.code.truncated, outside.join(", ")));
        }
        spec.supersedesWarnings(r, lang).forEach((l) => console.log("  ⚠ " + l)); // warnings, not gaps (exit code unchanged)
        spec.affectsWarnings(r, lang).forEach((l) => console.log("  ⚠ " + l)); // 1.14 C2: decisions.md _Affects:_ naming nothing — warnings too
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
      if (!pos[0]) usage("dev-spec finish <feature> [--write] [--include-body] [--run [--shell bash|<path>] [--timeout <s>]]");
      // B5: --run executes the project checks (roadmap.json meta.checks) — only on this explicit flag — and records every run
      // (= spec_finish {evidence}); without meta.checks it is an error, nothing runs.
      let evidence;
      if (on("run")) {
        const rc = b5RunChecks(pos[0]);
        if (!rc.ok) return fail(rc, rc.hint);
        evidence = rc.evidence;
      }
      const r = spec.finishFeature(projectDir, pos[0], { write: on("write"), includeBody: boolFlag("include-body"), evidence }); // = spec_finish {includeBody, evidence}
      if (!r.ok) return fail(r);
      if (!r.readyToFinish) process.exitCode = 1; // scriptable: blockers → non-zero
      const T = featureText(r.feature);
      return out(r, (r) => {
        if (r.recordedChecks) console.log(spec.msg(spec.featureLang(projectDir, r.feature)).projectChecks.recorded(r.recordedChecks.length));
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
      if (!pos[0]) usage("dev-spec steering <constitution.md|product.md|tech.md|…|<custom-name>.md> [--lang en|pt|pt-BR|es]");
      const r = spec.scaffoldSteeringFile(projectDir, pos[0], flags.lang);
      if (!r.ok) return fail(r);
      const T = cliText(flags.lang || spec.projectLang(projectDir)); // the language the file was written in
      return out(r, (r) => console.log(r.created ? T.steeringCreated(r.file) : T.steeringExists(r.file)));
    }

    case "brief": {
      // dev-spec brief <feature> [n] [--write]  — self-contained brief for one task (default: next open)
      if (!pos[0]) usage("dev-spec brief <feature> [task-number] [--write]");
      const r = spec.taskBrief(projectDir, pos[0], pos[1], { write: on("write"), includeBrief: boolFlag("include-brief") }); // = spec_task_brief {includeBrief}
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
      if (!pos[0] || pos[1] == null) usage("dev-spec done <feature> <task-number> [--run [--shell bash|<path>] [--timeout <s>] | --evidence \"summary\" [--exit N] [--cmd \"command\"]]");
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
        const M = spec.msg(spec.featureLang(projectDir, pos[0]));
        // Default: the platform shell (cmd.exe on Windows). --shell / DEV_SPEC_SHELL pick another (e.g. bash — Git Bash on
        // Windows, never WSL's launcher: b5Shell). A shell that can't be used is refused before anything runs.
        const sh = b5Shell();
        if (sh.error) return fail({ ok: false, couldNotRun: sh.error, error: sh.error === "wsl-bash" ? M.runGate.wslBash(sh.path) : M.runGate.noGitBash });
        // cmd.exe misreads POSIX quoting / $VAR — often without failing (`node -e 'process.exit(1)'` exits 0): a command
        // written for a POSIX shell is refused before anything runs unless a shell was chosen (--shell cmd: cmd.exe anyway).
        if (process.platform === "win32" && sh.shell === true) {
          const posix = cmds.map((c) => [c, spec.posixShellSyntax(c)]).find(([, k]) => k.length);
          if (posix) return fail({ ok: false, error: D.posixOnWindows(posix[0], posix[1]) });
        }
        // A pipe masks the check's exit code (a pipeline reports its LAST command's): one hint line — it still runs.
        cmds.filter(spec.verifyPipeMasked).forEach((c) => say(M.verifyPipe.runHint(c)));
        const git = b5GitState(); // B5: the commit the run is made on (+ dirty outside .specs/) — read-only git, skipped without it
        for (const cmd of cmds) {
          say("$ " + cmd);
          const x = b5Exec(cmd, sh, M);
          if (x.summary) say(x.summary.replace(/^/gm, "  "));
          // full review Ga1 / Ga9 / Ga10: a command that could not run (the shell never started, a signal, --timeout, output
          // over the buffer, WSL's launcher) is refused and NOTHING is recorded — it used to be recorded as exit 1 (an
          // _Expect: fail_ task was then ticked on a red run that never happened; a passing check recorded as failed).
          if (x.cantRun) return fail({ ok: false, couldNotRun: x.cantRun.code, error: M.runGate.taskRefused(cmd, x.cantRun.why) });
          // A crash is a failed check, but no red test (not failing "for the right reason"): refused, nothing recorded.
          if (x.crashed && b.expect === "fail") return fail({ ok: false, couldNotRun: "signal", error: M.runGate.taskRefused(cmd, M.runGate.why.signal(x.crashed)) });
          const code = x.code;
          if (code !== 0) {
            // B5: an _Expect: fail_ task needs a run that FAILS — but cmd.exe failing to run the line at all (a path it can't
            // find, its syntax error; exit 1) is no red test: refused, nothing recorded — whenever cmd.exe is the shell (the
            // default or --shell cmd, full review Ga10). (9009 goes to the engine: a failed run.)
            if (b.expect === "fail" && code !== 9009 && sh.cmd && spec.windowsShellFailure(x.output, code)) {
              return fail({ ok: false, expected: "fail", couldNotRun: "cmd", error: M.redGreen.shellNotRed(cmd) }, D.shellHint);
            }
            // full review Ga2: …nor is a run whose output shows the test never ran (a missing test file, module or script).
            const notRun = b.expect === "fail" ? spec.couldNotRunOutput(x.output) : null;
            if (notRun) return fail({ ok: false, expected: "fail", couldNotRun: "output", error: M.redGreen.notRed(cmd, notRun.text) });
            evidence = { command: cmd, exitCode: code, summary: x.summary, ...git };
            // The cmd.exe / --shell bash hint only when cmd.exe itself failed (unknown command, its syntax error) — a check
            // that ran and failed (node tests/x.js → exit 1) needs a code fix, not another shell.
            if (sh.cmd && spec.windowsShellFailure(x.output, code)) hint = D.shellHint;
            break;
          }
          evidence = { command: cmds.join(" && "), exitCode: 0, summary: x.summary, ...git };
        }
      } else if (flags.evidence != null || flags.exit != null || flags.cmd != null) {
        evidence = { command: flags.cmd, exitCode: flags.exit, summary: typeof flags.evidence === "string" ? flags.evidence : undefined };
      }
      const r = spec.completeTask(projectDir, pos[0], pos[1], evidence);
      if (!r.ok) return fail(r, hint); // --json: {ok:false, recorded:true, …} on stdout, as spec_complete_task returns it
      return out(r, (r) => {
        // "(verified)" only when something was run or attested — nothingToVerify is verified with nothing checked
        console.log((r.alreadyDone ? D.already : D.done)(r.completed, r.verified && !r.nothingToVerify, r.done, r.total) + (r.next ? D.next(r.next.number, r.next.text) : D.allDone));
        if (r.redRecorded) console.log(spec.msg(spec.featureLang(projectDir, r.feature)).redGreen.redRecorded(r.completed, evidence.exitCode)); // B5: _Expect: fail_
        if (r.note) console.log("  ⚠ " + r.note);
      });
    }

    case "approve": {
      // --through <phase> = the fast-forward (spec_approve {through}); --role <role> = the sign-off's role (spec_approve {role}).
      const through = typeof flags.through === "string" ? flags.through : undefined;
      if (!pos[0] || (!pos[1] && through === undefined)) usage("dev-spec approve <feature> <phase> [--force] [--by NAME] [--role ROLE] | dev-spec approve <feature> --through <phase>");
      // Default approver: the engine's (same as MCP). --force = spec_approve {force: true}; a refusal exits 1 listing the failing checks.
      const r = spec.approvePhase(projectDir, pos[0], pos[1], typeof flags.by === "string" ? flags.by : undefined,
        { force: on("force"), role: typeof flags.role === "string" ? flags.role : undefined, ...(through !== undefined ? { through } : {}) });
      if (!r.ok) return fail(r); // a fast-forward stopped at a refused gate: its error names what was approved before it
      const GV = spec.msg(spec.featureLang(projectDir, r.feature)).governance;
      return out(r, (r) => {
        if (r.through) { // the fast-forward: its summary, then one line per phase it reached
          console.log(r.message);
          (r.steps || []).forEach((s) => console.log("  " + (s.approved ? "✓" : "◐") + " " + s.phase + (s.role ? " [" + s.role + "]" : "") +
            (s.missingRoles && s.missingRoles.length ? " — " + GV.missing(s.missingRoles) : "") + (s.forced ? GV.stepForced(s.failing || []) : "")));
          return;
        }
        console.log(r.approved ? featureText(r.feature).approved(r.approved, r.feature) : GV.signedOff(r.signedOff, r.feature, r.role));
        // a forced approval names the checks that were failing; a role sign-off, the roles still missing (or that all signed)
        if (r.note) console.log((r.forced || r.pending ? "  ⚠ " : "  ") + r.note);
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
        // + each feature's ETA when it has one, then the velocity / ETA rule / cross-feature overlaps (spec_roadmap's forecast,
        // velocity, overlaps) — nothing new for a project with no completed task and no overlap.
        const lang = flags.lang || spec.projectLang(projectDir);
        const eta = (f) => { const e = spec.etaText(f.forecast, lang, true); return e ? "  · " + e : ""; };
        r.features.forEach((f) => console.log("  " + (f.blocked ? "⛔" : "  ") + " " + f.name.padEnd(26) + " " + String(f.percent + "%").padStart(4) + "  [" + f.tracks + "]  " + T.phase(f.phase) + (f.dependsOn.length ? T.deps(f.dependsOn.join(","), f.unmetDeps.join(",")) : "") + eta(f)));
        spec.roadmapTailLines(r, lang).forEach((l) => console.log(l));
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
      if (!pos[0] || !tr.length) usage("dev-spec add-track <feature> <tdd|saas|ai|sec|privacy>... [--remove]");
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
      // dev-spec feature <remove|archive|rename|restore|flow> <name> [new-name|flow] — remove needs --yes (= spec_feature confirm:true);
      // flow <name> <requirements-first|design-first> (or --flow) = spec_feature {action: "flow", flow} (C3)
      if (!pos[0] || !pos[1]) usage("dev-spec feature <remove|archive|rename|restore|flow> <name> [new-name|requirements-first|design-first] [--yes]");
      const T = featureText(pos[1]); // resolved BEFORE the folder moves or disappears
      const r = spec.manageFeature(projectDir, pos[0], pos[1], pos[2], { confirm: on("yes"), flow: flags.flow });
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
        else if (r.action === "archive") {
          console.log(T.archived(r.feature, String(r.dest).replace(/\\/g, "/")));
          // the dependents whose dependsOn the archive pruned — a warning when the archived work was never finished
          if (r.note) console.log((r.incompleteDependency ? "  ⚠ " : "  ") + r.note);
        }
        else if (r.action === "flow") console.log(r.note); // C3: the flow, the phase order (and the phases that stay approved)
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
      // dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad> <path> [--name n] [--lang] [--tracks …] — the same engine call as
      // spec_import: <path> resolves against the project root and must stay inside it.
      if (!pos[0] || !pos[1]) usage("dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad> <path> [--name <feature>] [--lang en|pt|pt-BR|es] [--tracks tdd,saas,ai,sec,privacy]");
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
      if (!pos[0] || typeof flags.task !== "string") usage('dev-spec append-tasks <feature> --task "<text>" [--req US-1.AC-2[,…]] [--implements path[,…]] [--verify "<cmd>"] [--makes-green T-01[,…]] [--expect-fail] [--size XS|S|M|L|XL] [--story US1|shared] [--parallel] [--heading "<phase heading>"]');
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
      const twice = ["verify", "story", "heading", "size"].find((k) => every(k).length > 1);
      if (twice) die(T.oneValue(twice));
      const task = { text: flags.task };
      const reqs = every("req"), impls = every("implements");
      if (reqs.length) task.requirements = reqs; // each may hold "a,b" — the engine splits it, same as over MCP
      if (impls.length) task.implements = impls;
      if (typeof flags.verify === "string") task.verify = flags.verify;
      if (typeof flags.story === "string") task.story = flags.story;
      if (flags.parallel != null) task.parallel = on("parallel");
      // full review Ga6: = the MCP task fields makesGreen / expectFail / size (repeatable --makes-green, "T-01,T-02" split by the engine)
      const greens = every("makes-green");
      if (greens.length) task.makesGreen = greens;
      if (flags["expect-fail"] != null) task.expectFail = on("expect-fail");
      if (typeof flags.size === "string") task.size = flags.size;
      const r = spec.appendTasks(projectDir, pos[0], [task], { heading: typeof flags.heading === "string" ? flags.heading : undefined });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        console.log(T.appended(r.heading, r.headingCreated));
        r.appended.forEach((t) => console.log("  - [ ] " + t.number + ". " + t.text));
        if (r.note) console.log("  ⚠ " + r.note);
      });
    }

    case "impact": {
      // dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen] — the same engine call as spec_impact
      if (!pos[0]) usage("dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen]");
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
      // baseline (= spec_drift {name}); exit 1 when any finished feature drifted, a baseline is stale (the feature changed
      // since its finish: finish it again) or a state file couldn't be read (a check that didn't run is not "clean" —
      // scriptable, like trace).
      const r = spec.drift(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      if (r.drifted.length || r.stale.length || (r.errors && r.errors.length)) process.exitCode = 1;
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
        for (const s of r.stale) console.log(D.stale(s.feature, day(s.finishedAt), s.why, s.archived));
        if (r.reopened.length) console.log(D.reopened(r.reopened.join(", ")));
        if (r.unbaselined.length) console.log(D.unbaselined(r.unbaselined.join(", ")));
        (r.errors || []).forEach((e) => console.error("dev-spec: " + e.error));
      });
    }

    case "upgrade": {
      // dev-spec upgrade [--apply] — after a plugin update (= spec_upgrade {apply}): the audit of every active feature against
      // the current rules (read-only), or --apply: the safe migrations + .specs/UPGRADE.md. A report exits 0; an error (no
      // .specs/, a broken roadmap.json, a feature that couldn't be migrated) exits 1.
      const r = spec.specUpgrade(projectDir, { apply: on("apply") });
      if (!r.ok) return fail(r);
      if (r.migrations && r.migrations.errors.length) process.exitCode = 1;
      return out(r, (r) => r.lines.forEach((l) => console.log(l)));
    }

    case "prompts": {
      // dev-spec prompts [name] [--args "…"] — the MCP prompts (one per commands/*.md): the list (= prompts/list), or one
      // rendered as prompts/get returns it (the words after the name are the args when --args is absent).
      const PR = require(path.join(__dirname, "..", "mcp", "lib", "prompts-resources.js"));
      const lang = spec.projectLang(projectDir);
      const P = spec.msg(lang).promptsResources;
      if (!pos[0]) {
        return out({ ok: true, prompts: PR.listPrompts({ lang }) }, (r) => {
          console.log(P.cliHead(r.prompts.length));
          r.prompts.forEach((x) => console.log("  " + x.name + (x.argumentHint ? " " + x.argumentHint : "") + "\n      " + x.description));
        });
      }
      if (typeof flags.args === "string" && pos.length > 1) usage('dev-spec prompts [name] [--args "…"]');
      const r = PR.getPrompt(pos[0], typeof flags.args === "string" ? flags.args : pos.slice(1).join(" "), { lang });
      if (!r.ok) return fail(r);
      return out(r, (r) => process.stdout.write(r.messages[0].content.text));
    }

    case "templates": {
      // dev-spec templates [list|init|check] [artifact] [--lang en|pt|pt-BR|es] — the project's own scaffolds in .specs/templates/
      // (= spec_templates {action, artifact, lang}). check exits 1 when a template has an error (scriptable, like doctor).
      if (pos.length > 2) usage("dev-spec templates [list|init|check] [artifact] [--lang en|pt|pt-BR|es]");
      const r = spec.templates(projectDir, pos[0], { artifact: pos[1], lang: flags.lang });
      if (!r.ok) return fail(r);
      if (r.action === "check" && r.errors) process.exitCode = 1;
      return out(r, (r) => r.lines.forEach((l) => console.log(l)));
    }

    case "export": {
      // dev-spec export [feature] [--md] [--write] — the stakeholder document (= spec_export {name, format, write}): printed on
      // stdout, or written to .specs/exports/ (never over a hand-written file → exit 1). No feature = the whole project.
      if (pos.length > 1 || (on("md") && on("html"))) usage("dev-spec export [feature] [--md] [--write]");
      const r = spec.exportSpecs(projectDir, { name: pos[0], format: on("md") ? "md" : "html", write: on("write") });
      if (!r.ok) return fail(r);
      const X = spec.msg(r.lang).stakeholderExport;
      return out(r, (r) => (r.wrote ? console.log(X.wrote(r.file)) : process.stdout.write(r.content)));
    }
    case "changelog": {
      // dev-spec changelog [--since <ISO date|last|all>] [--write] — release notes from the specs (= spec_changelog): the
      // markdown on stdout (a note on stderr), or --write → .specs/RELEASE-NOTES.md + meta.changelogAt (exit 1 on a refusal).
      if (pos.length) usage("dev-spec changelog [--since <ISO date|last|all>] [--write]");
      const r = spec.changelog(projectDir, { since: flags.since, write: on("write") });
      if (!r.ok) return fail(r);
      const N = spec.msg(r.lang).releaseNotes;
      return out(r, (r) => {
        if (r.wrote) console.log(N.wrote(r.file, r.counts.added, r.counts.changed, r.counts.fixed));
        if (r.markdown != null) {
          if (r.note) console.error(r.note); // stdout stays the markdown alone (pipe it into a file)
          process.stdout.write(r.markdown);
        } else if (r.note) console.log(r.note);
      });
    }

    case "log": {
      // dev-spec log <feature> [--max N] [-] — per task, the commits whose message cites it (+ the +tdd red-first check), from
      // `git log` (read-only, local, bounded by --max, default 1000); "-" reads a log from stdin instead (e.g. an agent's
      // `git log --name-only --relative`). The engine only parses the text (taskCommits) — it never runs git.
      if (!pos[0]) usage("dev-spec log <feature> [--max N] [-]");
      const fx = spec.existingFeature(projectDir, pos[0]);
      if (!fx.ok) return fail(fx);
      const max = intFlag("max") || 1000;
      const report = (text, opts) => {
        const r = spec.taskCommits(projectDir, pos[0], text, opts);
        if (!r.ok) return fail(r);
        return out(r, (r) => r.lines.forEach((l) => console.log(l)));
      };
      if (pos[1] === "-") return readStdin((text) => report(text, {}));
      const text = b5Git(["-c", "core.quotePath=false", "-c", "log.showSignature=false", "log", "--no-color", "--no-decorate", "--no-abbrev-commit",
        "--pretty=medium", "--date=iso-strict", "--name-only", "--relative", "--max-count=" + max]);
      if (text == null) return fail({ ok: false, error: spec.msg(spec.featureLang(projectDir, fx.slug)).gitLog.noGit });
      return report(text, { max });
    }
    // Helpers of done --run / finish --run / init --check / log (function declarations: hoisted across this switch block).
    // `git` is only ever read here: rev-parse, status, log — local, no network, no lock (GIT_OPTIONAL_LOCKS=0).
    function b5Git(args) {
      let r;
      try {
        r = spawnSync("git", args, { cwd: projectDir, encoding: "utf8", timeout: 30000, windowsHide: true, maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" } });
      } catch { return null; }
      return !r || r.error || r.status !== 0 ? null : String(r.stdout || "");
    }
    // {commit, dirty} for evidence — {} without git / a repository / a commit (silently: git is optional).
    function b5GitState() {
      const commit = String(b5Git(["rev-parse", "--short", "HEAD"]) || "").trim();
      if (!/^[0-9a-f]{4,40}$/i.test(commit)) return {};
      const st = b5Git(["status", "--porcelain", "--", ".", ":(exclude).specs"]); // .specs/ (ticks, state) is not the code under test
      return st == null ? { commit } : { commit, dirty: st.trim() !== "" };
    }
    // Every --check occurrence (the shared parser keeps only the last value) → {name: command} (null-prototype: "__proto__" stays
    // a plain key the engine refuses), or undefined when none was given.
    function b5ChecksFlag() {
      const vals = [];
      for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--") && a.includes("=")) { if (a.slice(2, a.indexOf("=")) === "check") vals.push(a.slice(a.indexOf("=") + 1)); }
        else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2))) { const v = argv[++i]; if (a.slice(2) === "check") vals.push(v); }
      }
      if (!vals.length) return undefined;
      const checks = Object.create(null);
      for (const v of vals) {
        const eq = typeof v === "string" ? v.indexOf("=") : -1;
        if (eq <= 0) die(spec.msg(flags.lang || spec.projectLang(projectDir)).projectChecks.badArg(String(v)));
        checks[v.slice(0, eq).trim()] = v.slice(eq + 1);
      }
      return checks;
    }
    // finish --run: every project check (meta.checks), in order, from the project root — the same shell rules as done --run
    // (--shell / DEV_SPEC_SHELL, POSIX syntax refused under cmd.exe, the pipe hint). Every run is recorded, a failure too.
    function b5RunChecks(feature) {
      const fx = spec.existingFeature(projectDir, feature);
      if (!fx.ok) return fx;
      const M = spec.msg(spec.featureLang(projectDir, fx.slug));
      const { checks } = spec.projectChecks(projectDir);
      if (!checks.length) return { ok: false, error: M.projectChecks.noneToRun };
      const sh = b5Shell();
      if (sh.error) return { ok: false, couldNotRun: sh.error, error: sh.error === "wsl-bash" ? M.runGate.wslBash(sh.path) : M.runGate.noGitBash };
      if (process.platform === "win32" && sh.shell === true) {
        const posix = checks.map((c) => [c, spec.posixShellSyntax(c.command)]).find(([, k]) => k.length);
        if (posix) return { ok: false, error: M.projectChecks.posixOnWindows(posix[0].name, posix[0].command, posix[1]) };
      }
      const say = flags.json ? console.error : console.log; // --json keeps stdout one JSON document
      checks.map((c) => c.command).filter(spec.verifyPipeMasked).forEach((c) => say(M.verifyPipe.runHint(c)));
      const git = b5GitState();
      const evidence = [];
      let cmdFailed = false;
      for (const c of checks) {
        say("$ " + c.command + "   (" + c.name + ")");
        const x = b5Exec(c.command, sh, M);
        if (x.summary) say(x.summary.replace(/^/gm, "  "));
        // full review Ga1 / Ga9 / Ga10: a check that could not run is refused and NOTHING is recorded (all-or-nothing, like
        // spec_finish {evidence}) — it used to be recorded as a failed run (exit 1).
        if (x.cantRun) return { ok: false, couldNotRun: x.cantRun.code, check: c.name, error: M.runGate.checkRefused(c.name, c.command, x.cantRun.why) };
        if (x.code !== 0 && sh.cmd && spec.windowsShellFailure(x.output, x.code)) cmdFailed = true;
        evidence.push({ name: c.name, command: c.command, exitCode: x.code, summary: x.summary, ...git });
      }
      if (cmdFailed) console.error(M.taskDone.shellHint);
      return { ok: true, evidence };
    }
    // full review Ga9: the shell of done --run / finish --run — --shell > DEV_SPEC_SHELL > the platform default, resolved by the
    // engine (a bare `bash` on Windows → Git Bash, found through `git --exec-path` (read-only), %ProgramFiles% or PATH; WSL's
    // bash.exe launcher refused). → spec.resolveRunShell's result.
    function b5Shell() {
      intFlag("timeout"); // --timeout <seconds>: an integer ≥ 1 — refused (exit 1) before anything runs
      const req = (typeof flags.shell === "string" && flags.shell.trim()) || (process.env.DEV_SPEC_SHELL || "").trim() || "";
      const needsGit = process.platform === "win32" && /^bash(?:\.exe)?$/i.test(req);
      return spec.resolveRunShell(req, { gitExecPath: needsGit ? b5Git(["--exec-path"]) : null });
    }
    // Runs ONE command line — the user's own _Verify:_ (done --run) or meta.checks command (finish --run), only on an explicit
    // --run: the same trust as an npm script; a shell is the point, each is a shell command line. → { code, output, summary,
    // cantRun: null | { code, why } } — cantRun (full review Ga1 / Ga9 / Ga10, stable codes): the run never exercised the check,
    // so nothing may be recorded for it: shell-not-started (spawn error: a missing or unusable shell) · timeout (--timeout) ·
    // output-too-large (over 64 MB) · signal (killed) · run-error (any other spawn error) · wsl (WSL's launcher answered).
    function b5Exec(command, sh, M) {
      const CRASH_SIGNALS = ["SIGSEGV", "SIGABRT", "SIGBUS", "SIGFPE", "SIGILL"]; // inside: b5Exec is hoisted above any outer const
      const timeoutS = intFlag("timeout"); // --timeout <seconds>: an integer ≥ 1 (validated before anything runs — first call)
      let run;
      try {
        // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
        run = spawnSync(command, { shell: sh.shell, cwd: projectDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true,
          ...(timeoutS ? { timeout: timeoutS * 1000 } : {}) });
      } catch (e) { run = { status: null, signal: null, error: e }; }
      const output = (run.stdout || "") + (run.stderr || "") + (run.error ? "\n" + run.error.message : "");
      const summary = spec.summarizeRunOutput(output);
      const W = M.runGate.why;
      const shellName = sh.shell === true ? (process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "/bin/sh") : String(sh.shell);
      let cantRun = null;
      if (run.error) {
        const ec = String(run.error.code || "");
        cantRun = ec === "ETIMEDOUT" ? { code: "timeout", why: W.timeout(timeoutS) }
          : ec === "ENOBUFS" ? { code: "output-too-large", why: W.buffer }
          : ["ENOENT", "EACCES", "ENOEXEC", "EPERM", "EISDIR", "ENOTDIR", "UNKNOWN"].includes(ec) ? { code: "shell-not-started", why: W.spawn(shellName, ec) }
          : { code: "run-error", why: W.error(ec || String(run.error.message || "?").slice(0, 120)) };
      } else if (run.status == null) {
        // The check itself CRASHED (a shell that execs its last command reports the crash as the signal): it ran and failed —
        // a failed run (128 + the signal number, the shells' convention), never "could not run", or a crashing re-check would
        // leave a ticked task verified (full review R6). Its caller refuses it as a red test. Any other signal: killed.
        const signo = CRASH_SIGNALS.includes(run.signal) ? (require("os").constants.signals || {})[run.signal] : null;
        if (signo) return { code: 128 + signo, output, summary, cantRun: null, crashed: run.signal };
        cantRun = { code: "signal", why: W.signal(run.signal || "?") };
      } else if (run.status !== 0) {
        const o = spec.couldNotRunOutput(output);
        if (o && o.kind === "wsl") cantRun = { code: "wsl", why: W.wsl(o.text) }; // WSL's relay answered: no command of this machine ran
      }
      return { code: run.status, output, summary, cantRun };
    }

    case "stop-check": {
      // = the Stop / SubagentStop hook's decision (spec.stopCheck): the closing message from --message "<text>", the words
      // after the command, or stdin (--message - / a lone -); --agent <subagent type> (a spec-implementer is checked on its
      // report). Exit 1 when the turn would be sent back (scriptable, like doctor); --json prints the result.
      const runCheck = (message) => {
        const r = spec.stopCheck(projectDir, { message, agent: typeof flags.agent === "string" ? flags.agent : "" });
        if (flags.json) console.log(JSON.stringify(r, null, 2));
        else if (r.block) console.log(r.reason);
        else {
          const A = spec.msg(r.lang).stopGate.allow;
          console.log(Object.prototype.hasOwnProperty.call(A, r.why) ? A[r.why]({ hours: spec.STOP_RECENT_HOURS, list: (r.verifiedFeatures || []).join(", "), n: r.task, slug: r.feature }) : r.why);
        }
        process.exitCode = r.block ? 1 : 0;
      };
      if (flags.message === "-" || (flags.message === undefined && pos.length === 1 && pos[0] === "-")) return readStdin(runCheck);
      return runCheck(typeof flags.message === "string" ? flags.message : pos.join(" "));
    }

    case "spike": {
      // dev-spec spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d|2w|8h] [--summary …] [--lang] — the spike shortcut
      // (= spec_create {name, kind: "spike", question, timebox}; `create "<name>" --kind spike` is the same call).
      if (!pos[0]) usage('dev-spec spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d] [--lang en|pt|pt-BR|es]');
      const tr = withTracksFlag(pos.slice(1));
      const r = spec.createFeature(projectDir, pos[0], tr.length ? tr : undefined, flags.summary, undefined, flags.lang, "spike", { question: flags.question, timebox: flags.timebox, flow: flags.flow, brownfield: on("brownfield") }); // = create --kind spike (a flow gets its note)
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        const T = cliText(r.lang);
        const SP = spec.msg(r.lang).spike;
        console.log(T.feature(r.slug, r.label, r.lang) + "\n  " + (r.created.join(", ") || T.nothingNew) + (r.note ? "\n  " + r.note : ""));
        const si = spec.spikeInfo(r.dir);
        if (si.question) console.log(SP.cliQuestion(si.question));
        if (si.timebox.state === "date") console.log(SP.cliUntil(si.timebox.date));
      });
    }
    case "decide": {
      // dev-spec decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"] [--affects US-1.AC-2,T-03]
      // [--supersedes D-1] [--discovery] — append one entry to decisions.md (= spec_decide; unknown _Affects:_ → exit 1, nothing written).
      if (!pos[0] || pos.length > 1) usage('dev-spec decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"] [--affects US-1.AC-2,T-03] [--supersedes D-1] [--discovery | --kind decision|discovery] (--affects / --supersedes repeatable)');
      // A repeated --affects / --supersedes adds to the list (the shared parser kept only the last one); --kind decision|discovery
      // is the MCP `kind` (the engine validates it), --discovery its shorthand.
      const every = (name) => {
        const vals = [];
        for (let i = 0; i < argv.length; i++) {
          const a = argv[i];
          if (a.startsWith("--") && a.includes("=")) { if (a.slice(2, a.indexOf("=")) === name) vals.push(a.slice(a.indexOf("=") + 1)); }
          else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2)) && argv[i + 1] !== undefined && !/^--[A-Za-z]/.test(argv[i + 1])) { const v = argv[++i]; if (a.slice(2) === name) vals.push(v); }
        }
        return vals;
      };
      const list = (name) => { const v = every(name); return v.length ? v : undefined; };
      const r = spec.decide(projectDir, pos[0], { title: flags.title, decision: flags.decision, context: flags.context, consequences: flags.consequences,
        affects: list("affects"), supersedes: list("supersedes"), kind: on("discovery") ? "discovery" : flags.kind });
      if (!r.ok) return fail(r);
      const D = spec.msg(spec.featureLang(projectDir, r.feature)).decisions;
      return out(r, (r) => {
        console.log(D.cliRecorded(r.id, r.title, r.file));
        if (r.affects.length) console.log("  _Affects: " + r.affects.join(", ") + "_");
        if (r.supersedes.length) console.log("  _Supersedes: " + r.supersedes.join(", ") + "_");
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

  classify "<description>" [--name "<feature>"]   Recommend tracks (core/+tdd/+saas/+ai/+sec/+privacy), multilingual
  init [tracks...] [--lang]       Scaffold .specs/steering (--lang en|pt|pt-BR|es → project default)
                                  --guard on|off|scope: guard mode — Write/Edit on code files asks while no feature has approved, open tasks
                                  (scope: once tasks are approved, also a code file no open task names in _Implements:_ — test files excepted)
                                  --stop-check on|off: the end-of-turn evidence gate (roadmap.json meta.stopCheck, on by default)
                                  --check name="cmd" (repeatable; name= removes one): the project's check commands (roadmap.json
                                  meta.checks, e.g. --check test="npm test" --check lint="npm run lint") — in every brief's definition of done
                                  --roles requirements=product,design=tech+security: approvals by role (a listed phase is approved once
                                  every role signed its current content); --roles none clears them
                                  --approval-guard off|ask|deny: the human approval guard — an agent's approve (MCP or this CLI through
                                  its shell tool), feature remove --yes or lowering this guard asks you (ask) or is refused (deny)
  steering <file> [--lang]        Create one steering file from its template (constitution.md, tech.md, …) — any other
                                  name like api-rules.md → a custom scoped file (front matter inclusion: always|fileMatch|manual)
  templates [list|init|check] [artifact] [--lang]   The project's own scaffolds: .specs/templates/<artifact>.md (<lang>/ wins)
                                  replace the built-in ones for new features / steering; init copies the built-in ones to
                                  edit; check validates them (exit 1 on an error)
  create "<name>" [tracks...]     Scaffold a feature folder (auto-classifies if no tracks; --summary, --kind feature|bugfix|spike, --lang en|pt|pt-BR|es)
                                  --brownfield also scaffolds integration-plan.md (a feature landing in an existing codebase);
                                  --flow design-first: classification → design → requirements → … (starts from an architecture)
  bugfix "<name>" [--summary]     Scaffold the bugfix flow: bug.md (repro · root cause · fix) + regression test plan
  spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]   Scaffold a spike (investigate → decide): spike.md — question,
                                  timebox, options, evidence, decision (go / no-go / pivot) — + investigation tasks; no
                                  requirements/design gates (= create --kind spike; prototype code stays outside .specs/)
  decide <feature> --title "…" --decision "…"   Append a D-n entry to decisions.md (append-only): [--context "…"]
                                  [--consequences "…"] [--affects US-1.AC-2,T-03,"Data Models"] [--supersedes D-1] [--discovery]
                                  — an unknown _Affects:_ reference is refused (exit 1, nothing written)
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
                                  (a failure leaves it open; --shell bash|<path> or DEV_SPEC_SHELL picks the shell — bash = Git Bash on
                                  Windows, never WSL's launcher; --timeout <s>; a command that could not run records nothing); or --evidence "…" [--exit N] [--cmd "…"]
                                  A task marked _Expect: fail_ needs a FAILING run (its red test — a pass is refused); --run also
                                  records the git commit (and whether the tree was dirty) when git is available
  finish <feature> [--write] [--include-body] [--run]   Readiness report + merge summary from the spec chain (exit 1 if not ready);
                                  --write → .execution/merge-summary.md, --include-body also prints/returns the summary;
                                  --run [--shell bash|<path>] runs the project checks (meta.checks) and records them — with meta.checks
                                  set, finish needs a passing run of each since the last task activity
  append-tasks <feature> --task "…"   Append one task to tasks.md, numbered after the last (default phase 'Phase: Convergence'):
                                  --req US-1.AC-2[,…] (must exist) · --implements path[,…] · --verify "<cmd>" · --story US1|shared · --parallel · --heading "…"
                                  · --makes-green T-01[,…] (planned in test-plan.md) · --expect-fail (_Expect: fail_) · --size XS|S|M|L|XL
  approve <feature> <phase> [--force]  Record a phase approval (.state.json) — refused while that phase's checks fail;
                                  --force records it anyway (flagged as forced, with the failing checks); --role ROLE signs off as
                                  that role (required for a phase init --roles lists)
  approve <feature> --through <phase>  Fast-forward (/spec-ff): approve every active phase up to <phase>, in order, each through its
                                  own gate — stops at the first refused gate (exit 1) or a phase still waiting for another role
  impact <feature> [--phase p] [--reopen]   What an edit after approval touches, against the approved snapshot
                                  (--phase requirements|design|test-plan|eval-plan|tasks, default requirements): changed ACs/sections/tests/tasks →
                                  tasks, tests, design; --reopen unticks the affected done tasks and marks their evidence stale
                                  (never a removed criterion's tasks — retire lists them and their test rows to delete or repoint)
  metrics [feature] [--write]     Lead times, rework, forced approvals, change requests, evidence pass rate, velocity (project: + avg/median);
                                  --write → .specs/<feature>/retro.md (a pre-filled retrospective, never overwritten)
  add-track <feature> <track...>  Escalate a feature to +tdd/+saas/+ai/+sec/+privacy (additive, never overwrites);
                                  --remove turns a track off (non-destructive: files kept, listed as inactive)
  feature <remove|archive|rename|restore> <name> [new-name]   Manage a feature's lifecycle (remove shows what it would delete; --yes deletes;
                                  restore brings an archived feature back with its roadmap entry and dependencies)
  feature flow <name> <requirements-first|design-first>   Set a feature's phase order (a bugfix keeps its own)
  catalog [--write]               Living catalog: every feature's ACs, superseded ones marked (_Supersedes:_); --write → .specs/SPECS.md
  export [feature] [--md] [--write]   One printable document for stakeholders — a feature (stories + EARS ACs, design, test plan,
                                  tasks with their verification, approvals, open clarifications) or, without one, the whole project;
                                  offline HTML (light/dark, print-ready) or --md; --write → .specs/exports/<feature|project>.html|.md
  changelog [--since d] [--write] Release notes from the specs: Added (shipped features + their ACs) · Changed (superseded ACs,
                                  change requests) · Fixed (bugfixes + root cause); --since <ISO date|last|all> (default: since the
                                  last written notes); --write → .specs/RELEASE-NOTES.md and stamps meta.changelogAt
  drift [feature]                 Implementing files changed / missing / new since finish recorded its baseline (exit 1 on drift or a stale baseline)
  stop-check [--message "<text>"|-] [--agent <type>]   The Stop hook's evidence gate: does a closing message claim done /
                                  verified (EN/PT/ES) while a feature active in the last hours has ticked tasks without verification
                                  evidence? Prints the reason it would send the turn back (exit 1) or why it lets it end; - reads stdin;
                                  --agent spec-implementer checks the task report named in the message instead
  log <feature> [--max N] [-]     Per task, the commits whose message cites it — "task #N" / "#N" with the feature name (as /spec-commit
                                  writes "Part of .specs/<feature>/ task #N."), or its T-/AC IDs ("Makes T-01 green") — and, +tdd, a
                                  red-first check (implementation committed before its test?); reads git log (read-only, local, --max
                                  commits, default 1000); - reads a log from stdin (git log --name-only --relative)
  upgrade [--apply]               After a plugin update: audit every active feature against the current rules (read-only) — status,
                                  what doctor flags, next step, review (critic / converge); --apply saves inferred tracks, seeds the
                                  approval history, stamps meta.specVersion and writes .specs/UPGRADE.md (never edits a spec)
  roadmap [--write][--html][--lang]  Roadmap: %, deps, blocked, cycles, ETA per feature (velocity from ticked tasks, _Size: XS|S|M|L|XL_), cross-feature file overlaps. --write (alias --md) → .specs/ROADMAP.md (default); --html also writes the brand-styled ROADMAP.html (light/dark); --lang en|pt|pt-BR|es
  depend <feature> [deps...]      Show / set dependencies: deps replace the list; --add x,y · --rm x · --clear · --order N
                                  (every dep must be an existing feature; cycles are rejected)
  backlog [add|rm|remove <name> [note]]  Manage planned-but-unspecced features (shown in ROADMAP.md)
  scan [path]                     Brownfield: inventory an existing codebase (stack, frameworks, routes with file:line,
                                  tests, entrypoints, env var names, migrations)
  coverage                        Brownfield: % of code files named in any _Implements:_ (active + archived features), per folder
  import <kiro|spec-kit|openspec|plan|execplan|bmad> <path>   Import another tool's spec as a NEW feature (IDs → US-N.AC-M, scenarios → EARS,
                                  tasks renumbered, checkbox state kept); --name <feature> · --lang en|pt|pt-BR|es · --tracks tdd,saas,ai,sec,privacy
                                  plan = Claude Code plan mode / Cursor .cursor/plans (copy a ~/.claude/plans file into the project first),
                                  execplan = a Codex ExecPlan (PLANS.md), bmad = BMAD-METHOD docs (prd.md + docs/stories/)
  evals <feature> [--dry-run]     Run the local eval harness (+ai; your ANTHROPIC_API_KEY)
  mcp-config [client]             Print ready MCP config: claude-desktop|claude-code|cursor|windsurf|vscode|gemini|codex|generic|all
  rules <tool>                    Print a rule file (cursor|windsurf|copilot|gemini|agents) with this clone's absolute paths
  prompts [name] [--args "…"]     The MCP prompts (one per plugin command — slash commands in MCP clients): list them, or print
                                  one rendered as prompts/get returns it ($ARGUMENTS ← --args, or the words after the name)

  Flags: --json  --project <dir>  --lang en|pt|pt-BR|es (init/create/steering/roadmap/ears)  --order N (depend)
         --name "<feature>" (classify)  --summary "…"  --kind feature|bugfix|spike (create; spike: --question, --timebox)  --text "…" (ears)
         --batch  --max N (next)  --write / --include-brief (brief)  --write / --include-body (finish)
         --yes (feature remove)  --write|--md / --html (roadmap)  --cap N (scan)  --by NAME / --force (approve)
         --role ROLE / --through PHASE (approve)  --roles phase=role+role,… | none (init)
         --brownfield / --flow design-first (create)  --flow (feature flow)  --name (import)  --tracks tdd,saas (import/create/init/add-track, beside positional tracks)
         --apply (upgrade)  --args "…" (prompts)  --check name="cmd" (init)  --run / --shell (done, finish)  --max N (next, log)
         --md / --write (export)  --since <ISO date|last|all> / --write (changelog)
         --guard on|off|scope / --stop-check on|off / --approval-guard off|ask|deny (init)  --message "…" / --agent <type> (stop-check)
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

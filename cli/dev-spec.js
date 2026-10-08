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
 *   classify "<description>" [--name n]  Recommend tracks (multilingual; --name = the feature name as evidence;
 *                                      --explain: every keyword match + the project's signal overrides)
 *   init [tracks...] [--lang]           Scaffold .specs/steering for tracks (--lang → project default;
 *                                      --guard on|off|scope → guard mode: code edits ask while no approved tasks
 *                                      (scope: also a code file no open task names in _Implements:_);
 *                                      --stop-check on|off → the end-of-turn evidence gate (roadmap.json meta.stopCheck, on by default);
 *                                      --evidence reported|observed → roadmap.json meta.evidence (observed: only runs the harness saw verify);
 *                                      --check name="cmd" (repeatable; name= removes) → roadmap.json meta.checks)
 *                                      --roles requirements=product,design=tech+security → approvals by role, none clears)
 *                                      --approval-guard off|ask|deny → an agent's approval asks the user / is refused (meta.approvalGuard)
 *   steering <file> [--lang]            Create one steering file from its template (glossary.md: the terms to use / avoid), or a custom scoped one
 *                                      (any other name-like.md → front matter inclusion: always|fileMatch|manual)
 *   templates [list|init|check] [artifact] [--lang]  The project's own scaffolds in .specs/templates/ (exit 1 on a check error)
 *   tracks [list|init <name>|check] [name] [--lang]  The project's own tracks: .specs/tracks/<name>/ track packs (exit 1 on a check error)
 *   signals [list | set <track> <word> off|weak|strong | forget <track> <word>]  The classifier's signal overrides of this
 *                                      project (.specs/classifier.json — learned from Phase 0 corrections, or set by hand)
 *   create "<name>" [tracks...]         Scaffold a feature (auto-classifies if no tracks; --summary, --kind, --lang,
 *                                      --brownfield → + integration-plan.md; --flow design-first → design before requirements)
 *   bugfix "<name>" [--summary]         Scaffold the bugfix flow (bug.md + regression test plan)
 *                                      [--reproduction "…"] [--root-cause "…"] [--condition "…"] [--behaviour "…"] prefill
 *                                      bug.md + the regression criterion; [--include-body] (--json: the scaffolds' bodies)
 *   spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]  Scaffold a spike: spike.md (question · timebox · options ·
 *                                      evidence · decision go/no-go/pivot) + investigation tasks (= create --kind spike)
 *   decide <feature> --title "…" --decision "…"  Append a D-n entry to decisions.md ([--context] [--consequences]
 *                                      [--affects US-1.AC-2,T-03] [--supersedes D-1] [--discovery])
 *   list                               List features + phase + progress
 *   status [feature]                   Status of one feature (or all)
 *   doctor <feature>                   Health-check → ready to advance?
 *   trace <feature> [--code]           Traceability AC↔task↔test↔code (every gap listed; EC/NFR/SC warnings;
 *                                      --code also scans test files for the T-IDs they name)
 *                                      [--matrix] the requirements traceability matrix (one row per AC/EC/NFR/SC:
 *                                      status, tasks, tests, evidence, decisions, approval); [--csv] the matrix as RFC 4180 CSV
 *   clarify <feature>                  Surface ambiguities/gaps in requirements
 *   ears <feature|path> | --text "…" | -   Lint EARS in requirements.md, a file, raw text or stdin
 *   next <feature> [--batch] [--max N] Next task whose _Depends:_ are done (+ the [P] tasks that can run beside it);
 *                                      --waves: the execution waves of every open task (+ cycles, blocked tasks)
 *   done <feature> <n>                 Mark task n complete (--run [--shell bash|pwsh|<path>] · --evidence/--exit/--cmd);
 *                                      an _Expect: fail_ task needs a FAILING run (the red proof); --run records the git commit
 *   undone <feature> <n> [--reason "…"]  Untick task n (ticked by mistake): its evidence turns stale — a re-tick needs a new
 *                                      run; recorded in .state.json unticks (= spec_complete_task {undo: true, reason})
 *   approve <feature> <phase> [--by NAME] [--force]  Record a phase approval — refused while its checks fail
 *                                      (--by = who approved; --force records it anyway, flagged as forced;
 *                                      --reason "…" --expires YYYY-MM-DD|30d with --force = its waiver: why, until when;
 *                                      --role ROLE = the role you sign off for, when init --roles lists the phase)
 *   approve <feature> <phase> --revoke [--reason "…"]  Revoke the phase's approval (and its waiting role sign-offs) —
 *                                      it is pending again; never cascades to the later phases
 *   approve <feature> --through <phase> Fast-forward: approve every active phase up to <phase>, in order, each through its
 *                                      own gate — stops at the first refused one (/spec-ff)
 *   impact <feature> [--phase p] [--reopen]  What an edit after approval touches (vs the approved snapshot);
 *                                      --phase requirements|design|tasks, --reopen unticks the affected done tasks
 *                                      (never a removed criterion's — `retire` lists those to delete or repoint)
 *   impact [feature] --phase steering  The features (all active ones without a name) whose requirements / design approval was
 *                                      made under steering (constitution, track files…) that changed since — re-review, re-approve
 *   metrics [feature] [--write]        Lead times, rework, change requests, evidence pass rate, velocity (--write → retro.md)
 *   next-action|na <feature>           "You are here → do this next" (+ changed-since-approval)
 *   brief <feature> [n] [--write] [--include-brief]  Self-contained brief for one task (subagent execution)
 *   finish <feature> [--write] [--include-body] [--run]  Readiness report + merge summary (no PRs);
 *                                      --run [--shell bash|pwsh|<path>] runs the project checks (meta.checks) and records them
 *   append-tasks <feature> --task "…" [--req ids] [--implements paths] [--verify "cmd"] [--story US1|shared]
 *                                      [--makes-green T-01,…] [--expect-fail] [--size XS|S|M|L|XL] [--depends 3,5]
 *                                      [--parallel] [--heading "…"]  Append one task to tasks.md (converge)
 *   add-track <feature> <track...>     Escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data or a track pack (additive); --remove turns one off
 *   feature <action> <name> [new]      remove (needs --yes) | archive | rename | restore a feature; flow <name> <flow> sets its phase order
 *   catalog [--write]                  Living catalog: every feature's ACs, superseded ones marked → .specs/SPECS.md
 *   export [feature] [--md] [--write]  Stakeholder document (offline HTML, or markdown) → .specs/exports/ (no feature = project)
 *                                      [--csv] the traceability matrix as CSV (UTF-8 BOM) → .specs/exports/<feature|project>.rtm.csv
 *                                      [--gherkin] one Gherkin .feature per feature (a scenario per AC, EARS → Given/When/Then) → <feature>.feature
 *                                      [--tracker jira|linear] a CSV for the tracker's importer (feature → stories → tasks) → <feature|project>.<tracker>.csv
 *   changelog [--since d|last|all] [--write]  Release notes from the specs → .specs/RELEASE-NOTES.md (+ meta.changelogAt);
 *                                      --milestone <name>: that milestone's features only → .specs/RELEASE-NOTES.<milestone>.md
 *   milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list]  Milestones in roadmap.json (meta.milestones): each one's
 *                                      date vs the latest ETA of its features → on-track · at-risk · late · done (ROADMAP.md shows them)
 *   drift [feature]                    Implementing files changed/missing since finish (exit 1 on drift or a stale baseline)
 *   stop-check [--message "<text>"|-] [--agent <type>]  The Stop hook's evidence gate for a closing message: does it claim
 *                                      done / verified while a recently active feature has ticked tasks without evidence? (exit 1 = sent back)
 *   log <feature> [--max N] [-]        Commits citing each task ("task #N" + the feature name, T-/AC IDs) + the +tdd red-first
 *                                      check, from git log (read-only, local; default 1000 commits); - reads a log from stdin
 *   merge-state <base> <ours> <theirs> [<path>]  git's merge driver for the spec state (%O %A %B %P): a semantic 3-way merge of
 *                                      .state.json / roadmap.json into <ours> (exit 1 = a real conflict, kept as valid JSON:
 *                                      "mergeConflicts"); --install / --uninstall writes .gitattributes + this clone's git config;
 *                                      --check: does the configured driver still run THIS clone's CLI? (re-run --install after an update)
 *   upgrade [--apply]                  After a plugin update: audit .specs/ against the current rules (read-only);
 *                                      --apply runs the safe migrations + writes .specs/UPGRADE.md (exit 1 only on errors)
 *   roadmap [--write|--md] [--html] [--lang]  Multi-feature roadmap: ETA forecasts, cross-feature overlaps (+ .specs/ROADMAP.md / .html)
 *   depend <feature> [deps...] [--add x] [--rm x] [--clear] [--order N]  Show / set dependencies (rejects cycles)
 *   backlog [add|rm|remove <name> [note]]  Planned-but-unspecced features
 *   scan [path] [--cap N]              Brownfield: inventory an existing codebase (routes, tests, entrypoints, env names, migrations)
 *   coverage                           Brownfield: % of code files named in _Implements:_ (per folder)
 *   import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name n] [--lang] [--tracks …]  Import another tool's spec / a plan as a NEW feature
 *   import <plan|execplan|fluidplan> - | --text "<markdown>"   … a plan from stdin or inline (Claude Code keeps plans in ~/.claude/plans)
 *   statusline [--print-config]        One line for Claude Code's status line (reads its session JSON on stdin; prints nothing
 *                                      outside a dev-spec project; exit 0 always); --print-config prints the settings.json snippet
 *   evals <feature> [--dry-run ...]    Run the local eval harness (+ai) — every flag goes to it wherever it stands; it refuses
 *                                      an unknown one (exit 2) and prints its usage on --help
 *   mcp-config [client]                Print ready MCP config (claude-desktop|claude-code|
 *                                      cursor|windsurf|vscode|gemini|codex|generic|all)
 *   rules <tool>                       Print a rule file (cursor|windsurf|copilot|gemini|agents)
 *                                      with this clone's absolute paths, to paste into a project
 *   prompts [name] [--args "…"]        The MCP prompts (one per plugin command): list them, or print one rendered as
 *                                      prompts/get returns it ($ARGUMENTS ← --args, or the words after the name)
 *   bundle [--out <file.js>]           Build this clone's engine as ONE file (mcp/lib/spec.bundle.js, git-ignored) for a
 *                                      slow file system — used with DEV_SPEC_BUNDLE=1 (+ DEV_SPEC_BUNDLE_PATH for --out)
 *
 * Flags: --json (raw JSON output) · --project <dir> (an existing folder; only init creates one) · --lang en|pt|pt-BR|es
 *        The project: --project > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest folder at or above the working one with a
 *        dev-spec .specs/ > the working folder. A path argument (scan, ears, import) is relative to the project when it was named
 *        (--project / the env), else to the working folder. Each command takes its own options: another one, or an extra
 *        argument, is a usage error (exit 1; with --json also {ok:false, error} on stdout).
 *        done: --run · --shell bash|pwsh|<path> · --timeout <s> · --evidence "…" · --exit N · --cmd "…"   (value flags need a value; a following --flag is not one)
 *        init: --check name="cmd" (repeatable) · finish: --run · --shell bash|pwsh|<path> · --timeout <s> · log: --max N (default 1000)
 *        undone: --reason "…" · approve: --revoke · --reason "…" · --expires YYYY-MM-DD|Nd (with --force: the waiver)
 *        --run: a command that could not run (missing shell, signal, --timeout, WSL's bash launcher) records nothing;
 *        on Windows --shell bash is Git Bash (never WSL's System32 / WindowsApps bash.exe)
 *        upgrade: --apply (the safe migrations: tracks, history baselines, .gitignore, meta.specVersion, UPGRADE.md)
 *        prompts: --args "…" (the command's arguments, = prompts/get {arguments: {args}})
 *        import: --text "<markdown>" (a plan / ExecPlan's text, = spec_import {text}) · statusline: --print-config
 *        Switches: --x or --x=true|false (1/0, yes/no, on/off). --json prints a refusal's {ok:false,…} result on stdout (exit 1).
 *        help, rules, mcp-config and evals print text only: --json there is a usage error (exit 1).
 */

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
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
VALUE_FLAGS.add("shell"); // done --run --shell bash|pwsh|<path>

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

// Read all of stdin asynchronously — fs.readFileSync(0) is unreliable on Windows pipes (same rule as the hooks). The bytes are
// decoded as a file is (spec.decodeText: a UTF-16 BOM decides, else UTF-8) — 1.23 review: a UTF-16 document (what Windows
// PowerShell 5.1's `>` writes) piped into `ears -` read as "0 criteria, pass" and `import plan -` imported garbage.
function readStdin(cb) {
  const chunks = [];
  process.stdin.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c), "utf8")));
  process.stdin.on("end", () => { try { cb(spec.decodeText(Buffer.concat(chunks))); } catch (e) { die(e.message); } });
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

VALUE_FLAGS.add("phase"); // impact [f] --phase requirements|design|test-plan|eval-plan|tasks|steering (1.16: steering needs no feature)

VALUE_FLAGS.add("guard"); // init --guard on|off|scope (= spec_init {guard: true|false|"scope"})
["stop-check", "message", "agent"].forEach((k) => VALUE_FLAGS.add(k)); // 1.14 C1: init --stop-check on|off (= spec_init {stopCheck}); stop-check --message "…" --agent <type>
VALUE_FLAGS.add("check"); // init --check name="cmd" (repeatable; name= removes) = spec_init {checks: {name: cmd}}
VALUE_FLAGS.add("approval-guard"); // 1.14 F2: init --approval-guard off|ask|deny (= spec_init {approvalGuard})
["roles", "role", "through"].forEach((k) => VALUE_FLAGS.add(k)); // init --roles …, approve --role <role> / --through <phase> (= spec_init {approvalRoles}, spec_approve {role, through})
VALUE_FLAGS.add("since"); // changelog --since <ISO date|last|all> (= spec_changelog {since})
VALUE_FLAGS.add("tracker"); // 1.16 E2: export [f] --tracker jira|linear (= spec_export {format: "jira" | "linear"})
VALUE_FLAGS.add("milestone"); // 1.16 E3: changelog --milestone <name> (= spec_changelog {milestone})
VALUE_FLAGS.add("flow"); // create --flow design-first · feature flow <name> --flow <flow> (= spec_create / spec_feature {flow}) — C3
// 1.14 C2: spike / create --kind spike --question … --timebox … · decide <f> --title … --decision … [--context …] [--consequences …] [--affects …] [--supersedes …]
["question", "timebox", "title", "decision", "context", "consequences", "affects", "supersedes"].forEach((k) => VALUE_FLAGS.add(k));
VALUE_FLAGS.add("depends"); // 1.14 F3: append-tasks --depends 3,5 (repeatable) = spec_append_tasks {tasks: [{depends}]}
["reason", "expires"].forEach((k) => VALUE_FLAGS.add(k)); // 1.16 U: undone --reason · approve --revoke --reason · approve --force --reason --expires (= spec_complete_task {undo, reason}, spec_approve {revoke, reason, expires})
VALUE_FLAGS.add("out"); // 1.20: bundle --out <file.js> — the one-file engine written elsewhere (a read-only clone: DEV_SPEC_BUNDLE_PATH)
// 1.21 F3: bugfix <name> --reproduction "…" --root-cause "…" --condition "…" --behaviour "…" (= spec_create's bugfix prefill)
["reproduction", "root-cause", "condition", "behaviour"].forEach((k) => VALUE_FLAGS.add(k));
let missingValue = null; // reported in main(), once --project is known (message in the project language)
const ARGV0 = argv.slice(); // the command line as given — `evals` hands its own flags to run-evals.js (evalsArgs)
let cmdIdx = -1; // where the command word stands in ARGV0
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  // `--` ends the options (POSIX): every later token is positional (`create -- --odd-name`) — it used to become flags[""].
  // argv is cut there, so the repeated-flag collectors below (depend --add, init --check, decide --affects…) stop there too.
  if (a === "--") { if (cmdIdx < 0 && !pos.length && i + 1 < argv.length) cmdIdx = i + 1; pos.push(...argv.slice(i + 1)); argv.splice(i); break; }
  if (a === "--json") flags.json = true;
  else if (a.startsWith("--") && a.includes("=")) { const k = a.slice(2, a.indexOf("=")); flags[k] = a.slice(a.indexOf("=") + 1); }
  else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2))) {
    // A value flag never swallows the next flag: `--order --json` must not set order="--json". Only a
    // `--<letter>` token is a flag — `---` (front matter, an HR) or `-- draft` stays a value, like over MCP.
    if (argv[i + 1] === undefined || /^--[A-Za-z]/.test(argv[i + 1])) missingValue = missingValue || a.slice(2);
    else flags[a.slice(2)] = argv[++i];
  }
  else if (a.startsWith("--")) flags[a.slice(2)] = true;
  else { if (!pos.length) cmdIdx = i; pos.push(a); }
}
const cmd = pos.shift();
// 1.23 review (L14): Windows' `--project "C:\dir\"` reaches the CLI as `C:\dir"` (the backslash escapes the closing quote) — a
// double quote is never part of a Windows path, so a trailing one is dropped.
if (process.platform === "win32" && typeof flags.project === "string") flags.project = flags.project.replace(/"+$/, "");
// --project > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest folder at or above the working folder with a dev-spec .specs/
// > the working folder — the same resolution as the MCP server (spec.resolveProjectDir). --project is checked in main().
const projectDir = spec.resolveProjectDir(flags.project);
// 1.24 r6 B1 — WHICH input chose it, read with resolveProjectDir's own precedence (a value that is empty or holds an unexpanded
// variable falls through): "flag" (--project) · "SPEC_PROJECT_DIR" · "CLAUDE_PROJECT_DIR" · "nearest" (a folder above the working
// one with a dev-spec .specs/) · "cwd" (the working folder). checkProject() checks a named one; `version` reports it.
const usableDir = (v) => v != null && String(v).trim() !== "" && !spec.unexpandedVar(v);
const PROJECT_SOURCE = typeof flags.project === "string" && usableDir(flags.project) ? "flag"
  : usableDir(process.env.SPEC_PROJECT_DIR) ? "SPEC_PROJECT_DIR"
  : usableDir(process.env.CLAUDE_PROJECT_DIR) ? "CLAUDE_PROJECT_DIR"
  : path.resolve(process.cwd()) === projectDir ? "cwd" : "nearest";
// Where a PATH argument is read from (scan <path>, ears <file>, import <tool> <path>): the project folder when it was NAMED
// (--project, SPEC_PROJECT_DIR, CLAUDE_PROJECT_DIR — as import always read it), else the working folder: a path typed in a
// subfolder of the project found by walking up is relative to that subfolder, as in git (1.23 review L12: scan and ears read it
// from the working folder even with --project, import from the project).
const projectNamed = typeof flags.project === "string" || PROJECT_SOURCE === "SPEC_PROJECT_DIR" || PROJECT_SOURCE === "CLAUDE_PROJECT_DIR";
const argPath = (p) => path.resolve(projectNamed ? projectDir : process.cwd(), String(p));

// Boolean switches: `--x` is true, `--x=true|false` (also 1/0, yes/no, on/off) sets it explicitly; any other `=value` is
// an error (normalizeBoolFlags, in main). They are read with on(), never by truthiness — the string "false" is truthy,
// so `done --run=false` ran the _Verify:_ commands and `add-track --remove=false` removed the track (MCP `false` is false).
// ONE list, spec.CLI_SWITCHES (the approval hook parses `dev-spec approve …` with it): add a new switch THERE. It holds
// --matrix / --csv (1.14 F5: trace <f> --matrix | --csv · export [f] --csv) and --help.
const BOOL_FLAGS = [...spec.CLI_SWITCHES];
const on = (k) => flags[k] === true;
// A switch passed through to an engine option whose default depends on others (finish's includeBody, brief's includeBrief:
// true when not writing): absent → undefined (the engine's default), else the explicit boolean — `--include-body=false`
// is false, as spec_finish {includeBody: false} (on() ? true : undefined turned it into the default).
const boolFlag = (k) => (typeof flags[k] === "boolean" ? flags[k] : undefined);
// --help (in BOOL_FLAGS) anywhere prints the help (`done big 2 --help` ticked the task)
// --waves (1.14 F3: next <f> --waves = spec_next_task {waves: true}) is in spec.CLI_SWITCHES too.
// An unknown --flag is a usage error, before anything runs: it used to be accepted as a silent boolean switch, so
// `done big 2 --rnu` ticked the task with no evidence (exit 0). Known = VALUE_FLAGS ∪ BOOL_FLAGS, with a did-you-mean.
// `evals` forwards its flags untouched to mcp/evals/run-evals.js, which refuses its own unknown ones (1.23 review: it took any
// flag silently — a mistyped --dryrun ran a LIVE, paid eval) and checks their values (--dry-run, --max-items…).
// A KNOWN flag the command doesn't read is refused too (checkCommandArgs: COMMAND_OPTIONS), and so is an extra argument.
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
// (a scan of zero files, "truncated") and "abc" as the default. Absent → undefined (the engine's default). `max`: the largest
// value allowed (--timeout: TIMEOUT_MAX_S).
function intFlag(k, max) {
  if (flags[k] === undefined) return undefined;
  const v = String(flags[k]).trim();
  if (/^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) >= 1 && (max === undefined || Number(v) <= max)) return Number(v);
  const A = spec.msg(spec.projectLang(projectDir)).args;
  const most = max === undefined ? "" : projectText().atMost(max);
  return die(A.invalid(A.item("--" + k, A.type.integer + " " + A.atLeast(1) + most, JSON.stringify(String(flags[k])))));
}
// 1.24 r6 B6 — done --run / finish --run --timeout <seconds>: at most Node's timer limit (2^31 - 1 ms) — a larger value became a
// TimeoutOverflowWarning and a timer of 1 ms: the run was refused as "did not finish within --timeout 9999999 s".
const TIMEOUT_MAX_S = Math.floor(2147483647 / 1000);
const timeoutFlag = () => intFlag("timeout", TIMEOUT_MAX_S);
// `dev-spec evals` (1.23 review P1): the words of the command line but the command, read with run-evals.js's own rules — its
// value flags (--project, --model, --prompt, --max-items) take the next word unless it is a flag; the first plain word is the
// feature, any other goes on (the harness refuses it). --project and its value are left out: the CLI passes its resolved project.
const EVALS_VALUE_FLAGS = new Set(["project", "model", "prompt", "max-items"]);
function evalsArgs() {
  const toks = ARGV0.filter((_, i) => i !== cmdIdx);
  let feature = null, help = false;
  const rest = [];
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i];
    if (!a.startsWith("--")) { if (feature === null) feature = a; else rest.push(a); continue; }
    const eq = a.indexOf("=");
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    const takesNext = eq === -1 && EVALS_VALUE_FLAGS.has(key) && i + 1 < toks.length && !toks[i + 1].startsWith("--");
    if (key === "help") help = eq === -1 || !/^(?:false|0|no|off)$/i.test(a.slice(eq + 1).trim());
    if (key === "project") { if (takesNext) i++; continue; }
    rest.push(a);
    if (takesNext) rest.push(toks[++i]);
  }
  return { feature, help, rest };
}
// done / finish: --shell and --timeout say how --run runs the commands — without --run they are a usage error (1.23 review: ignored).
function runOnlyFlags() {
  if (on("run")) return;
  const k = ["shell", "timeout"].find((n) => flags[n] !== undefined);
  if (k) die(projectText().needsRun("--" + k));
}
// done --run with several _Verify:_ commands, all passing (1.23 review): the record keeps one summary per command — "$ <command>"
// and its summary, each re-summarized shorter when together they'd pass the record's 2,000 characters (normalizeEvidence cuts
// there) — where it kept the LAST command's summary alone. One command: its summary, as ever.
const EVIDENCE_SUMMARY_MAX = 2000;
// 1.24 r6 B3: done --run / finish --run — after the command EXITS, how long its output may still drain before the pipes are dropped
// (a background process it started can hold them open for good).
const RUN_DRAIN_MS = 2000;
function runSummaries(parts) {
  if (parts.length === 1) return parts[0].summary;
  const budget = Math.floor(EVIDENCE_SUMMARY_MAX / parts.length);
  return parts.map((p) => {
    const head = "$ " + (p.cmd.length > 120 ? p.cmd.slice(0, 119) + "…" : p.cmd);
    const room = budget - head.length - 1;
    const body = room < 20 ? "" : p.summary && p.summary.length <= room ? p.summary : spec.summarizeRunOutput(p.output, room);
    return body ? head + "\n" + body : head;
  }).join("\n").slice(0, EVIDENCE_SUMMARY_MAX);
}

function out(obj, human) {
  if (flags.json) console.log(JSON.stringify(obj, null, 2));
  else if (typeof human === "function") human(obj);
  else console.log(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
}
// --json asked for (before normalizeBoolFlags has run too: a usage error found first still answers in JSON).
const jsonWanted = () => flags.json === true || (typeof flags.json === "string" && /^(?:true|1|yes|on)$/i.test(flags.json.trim()));
// A CLI usage / argument error: the message on stderr, exit 1 — and (1.23 review) with --json also {ok: false, error[, code]} as the
// one JSON document on stdout, as a refusal prints (fail), so a script reads one shape. `text: true` (the --json-on-a-text-command
// error) keeps stdout empty. Written synchronously: process.exit() follows.
function die(msg, opts) {
  console.error("dev-spec: " + msg);
  if (jsonWanted() && !(opts && opts.text)) {
    const doc = JSON.stringify({ ok: false, error: String(msg), ...(opts && opts.code ? { code: opts.code } : {}) }, null, 2) + "\n";
    try { fs.writeSync(1, doc); } catch { /* stdout gone */ }
  }
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
// 1.24 r6 B2 — stdout's reader went away (`export --md | head -1`, a pager quit): an EPIPE / EOF / ERR_STREAM_DESTROYED is the end
// of the output, never a crash — exit quietly with the status the command set (the MCP server's rule since 1.22); any other stdout
// error is one stderr line, exit 1. console.log swallows its own write errors, but process.stdout.write (export, catalog,
// changelog, rules, trace --csv, prompts…) raised an unhandled 'error' — a stack trace and exit 1. Installed by main() after
// the status line's render path, which keeps its own (exit 0 always).
function stdoutError(e) {
  const code = e && e.code;
  if (code === "EPIPE" || code === "EOF" || code === "ERR_STREAM_DESTROYED") process.exit(process.exitCode || 0);
  try { fs.writeSync(2, "dev-spec: " + (e && e.message ? e.message : String(e)) + "\n"); } catch { /* stderr gone too */ }
  process.exit(1);
}
// A usage line: the syntax stays as typed, the "usage:" prefix is in the project language.
function usage(syntax) {
  die(projectText().usage(syntax));
}

// 1.23 review — each command's own options and the most arguments it takes. A flag every command knows (--json, --project,
// --help) aside, any other KNOWN flag the command doesn't read is a usage error, and so is an argument past its last one: they
// were ignored silently — `approve <f> <phase> --remove` (meant --revoke) still approved, `done <f> 3 4` ticked task 3 alone,
// `done … --timeout 0` without --run did nothing. `max` absent = the command reads any number (a name and tracks, words of a
// message…) or checks its own (templates, export, decide…). `evals` is not listed: its flags are run-evals.js's.
const GLOBAL_OPTIONS = ["json", "project", "help"];
const CREATE_OPTIONS = ["tracks", "summary", "lang", "brownfield", "flow", "question", "timebox", "reproduction", "root-cause", "condition", "behaviour", "include-body", "size"];
const COMMAND_OPTIONS = {
  classify: { options: ["name", "lang", "explain"] },
  signals: { options: ["lang"] },
  init: { options: ["lang", "tracks", "guard", "stop-check", "check", "approval-guard", "evidence", "roles"] },
  create: { options: ["kind", ...CREATE_OPTIONS] },
  bugfix: { options: CREATE_OPTIONS },
  spike: { options: ["tracks", "summary", "lang", "question", "timebox", "flow", "brownfield"] },
  list: { options: [], max: 0 },
  status: { options: [], max: 1 },
  doctor: { options: [], max: 1 },
  trace: { options: ["code", "matrix", "csv"], max: 1 },
  ears: { options: ["text", "lang"], max: 1 },
  next: { options: ["batch", "max", "waves"], max: 1 },
  finish: { options: ["write", "include-body", "run", "shell", "timeout"], max: 1 },
  steering: { options: ["lang"], max: 1 },
  brief: { options: ["write", "include-brief"], max: 2 },
  done: { options: ["run", "shell", "timeout", "evidence", "exit", "cmd", "reason"], max: 2 },
  undone: { options: ["reason", "run", "evidence", "exit", "cmd", "shell", "timeout"], max: 2 }, // done's run / evidence flags: refused with undo's own message
  approve: { options: ["by", "force", "role", "through", "reason", "expires", "revoke"], max: 2 },
  backlog: { options: [] }, // add <name> [note words…] · rm|remove <name> · list — checked in its case
  milestone: { options: [] },
  milestones: { options: [] },
  roadmap: { options: ["write", "md", "html", "lang"], max: 0 },
  depend: { options: ["add", "rm", "clear", "order"] },
  scan: { options: ["cap"], max: 1 },
  coverage: { options: [], max: 0 },
  clarify: { options: [], max: 1 },
  "next-action": { options: [], max: 1 },
  na: { options: [], max: 1 },
  "add-track": { options: ["tracks", "remove"] },
  feature: { options: ["yes", "flow"], max: 3 },
  rules: { options: [], max: 1 },
  import: { options: ["name", "lang", "tracks", "text"] },
  "append-tasks": { options: ["task", "req", "implements", "verify", "story", "parallel", "makes-green", "expect-fail", "size", "depends", "heading"], max: 1 },
  impact: { options: ["phase", "reopen"], max: 1 },
  metrics: { options: ["write"], max: 1 },
  catalog: { options: ["write"], max: 0 },
  drift: { options: [], max: 1 },
  upgrade: { options: ["apply"], max: 0 },
  prompts: { options: ["args"] },
  templates: { options: ["lang"] },
  tracks: { options: ["lang"] },
  export: { options: ["md", "html", "csv", "gherkin", "tracker", "write"] },
  changelog: { options: ["since", "write", "milestone"] },
  log: { options: ["max"], max: 2 }, // <feature> [-]
  "stop-check": { options: ["message", "agent"] },
  decide: { options: ["title", "decision", "context", "consequences", "affects", "supersedes", "discovery", "kind"] },
  "merge-state": { options: ["install", "uninstall", "check", "kind"] },
  "mcp-config": { options: [], max: 1 },
  bundle: { options: ["out"] },
  statusline: { options: ["print-config"], max: 0 },
};
function checkCommandArgs() {
  const own = Object.prototype.hasOwnProperty.call(COMMAND_OPTIONS, cmd) ? COMMAND_OPTIONS[cmd] : null;
  if (!own) return; // an unknown command (its own error), evals (run-evals.js), help
  const T = projectText();
  const bad = Object.keys(flags).find((k) => !GLOBAL_OPTIONS.includes(k) && !own.options.includes(k));
  if (bad !== undefined) die(T.flagNotFor("--" + bad, cmd, own.options.map((f) => "--" + f).join(", ")));
  if (own.max !== undefined && pos.length > own.max) die(T.extraArgs(cmd, pos.slice(own.max).join(" ")));
}
// 1.23 review (L14) — --project names an existing FOLDER: an empty value, a variable left unexpanded (`$HOME/x`, `%DIR%`, `${…}`)
// or a file is refused, and so is a folder that doesn't exist — except for init, which creates it (`create x --project <typo>`
// used to create the whole mistyped tree; a file or `C:\dir"` ended in a raw ENOTDIR / ENOENT).
// 1.24 r6 B1 — SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR are checked the same way when one of them chose the project (PROJECT_SOURCE):
// a mistyped one created that tree, a file ended in a raw ENOTDIR and `list` answered "No features" — the message names the
// variable. A folder without .specs/ is fine (CLAUDE_PROJECT_DIR is whatever folder Claude Code opened). An empty or unexpanded
// value still falls through (resolveProjectDir's rule). B7 — a dev-spec project's own .specs/ folder named as the project is
// refused with the folder to name: it created .specs/.specs/, which then won every walk-up.
function checkProject() {
  const T = projectText();
  let v, src;
  if ("project" in flags) {
    v = typeof flags.project === "string" ? flags.project.trim() : "";
    if (!v) die(T.projectEmpty);
    if (spec.unexpandedVar(v)) die(T.projectUnexpanded(v));
    src = "--project";
  } else if (PROJECT_SOURCE === "SPEC_PROJECT_DIR" || PROJECT_SOURCE === "CLAUDE_PROJECT_DIR") {
    v = String(process.env[PROJECT_SOURCE]).trim();
    src = PROJECT_SOURCE;
  } else return;
  const abs = path.resolve(v);
  const flag = src === "--project";
  let st = null;
  try { st = fs.statSync(abs); } catch { st = null; }
  if (st && !st.isDirectory()) die(flag ? T.projectNotDir(abs) : T.projectEnvNotDir(src, abs));
  if (!st && cmd !== "init") die(flag ? T.projectMissing(abs) : T.projectEnvMissing(src, abs));
  const base = path.basename(abs);
  const specsName = process.platform === "win32" || process.platform === "darwin" ? /^\.specs$/i.test(base) : base === ".specs";
  if (st && specsName && spec.isDevSpecDir(path.dirname(abs))) die(T.projectIsSpecs(flag ? "--project " + abs : src + "=" + abs, path.dirname(abs)));
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
// The commands whose output is text only — no structured result — so --json is refused there (main; the help too).
const TEXT_ONLY_COMMANDS = new Set(["rules", "mcp-config", "evals"]);

// ---- statusline (1.16 C1) ----------------------------------------------------
// Claude Code runs the settings.json "statusLine" command after every assistant message (debounced, cancelled when a newer
// update starts) with its session JSON on stdin, and shows what it prints — a non-zero exit or no output blanks the line. So
// the render path never fails: no flag refusal, no usage error, bounded stdin, every error swallowed, exit 0 always, nothing
// printed outside a dev-spec project. The project: the nearest dev-spec .specs/ at or above --project / workspace.current_dir /
// cwd / workspace.project_dir of the payload (no payload — a terminal: --project / SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / the
// working folder). The line is spec.statusLine's, cut to $COLUMNS; --json prints the whole result.
const STATUS_STDIN_MAX = 1024 * 1024;
function statusLineRender() {
  let done = false;
  let data = "";
  process.stdout.on("error", () => process.exit(0)); // a reader gone (Claude Code cancelled this run): nothing left to show
  const render = () => {
    if (done) return;
    done = true;
    let r = { ok: true, found: false, line: "" };
    try {
      let payload = null;
      try { payload = data.trim() ? JSON.parse(data) : null; } catch { payload = null; }
      if (payload !== null && (typeof payload !== "object" || Array.isArray(payload))) payload = null;
      const ws = payload && payload.workspace && typeof payload.workspace === "object" ? payload.workspace : {};
      const given = typeof flags.project === "string" ? [flags.project] : [];
      const cands = payload ? given.concat([ws.current_dir, payload.cwd, ws.project_dir])
        : given.concat([process.env.SPEC_PROJECT_DIR, process.env.CLAUDE_PROJECT_DIR, process.cwd()]);
      const pdir = spec.statusLineProject(cands);
      const cols = parseInt(process.env.COLUMNS, 10);
      if (pdir) r = spec.statusLine(pdir, { columns: Number.isSafeInteger(cols) && cols > 0 ? cols : undefined });
    } catch {
      r = { ok: true, found: false, line: "" }; // never a stack trace in the status line
    }
    const text = flags.json === true ? JSON.stringify(r) + "\n" : r.line ? r.line + "\n" : "";
    try { process.stdout.write(text, () => process.exit(0)); } catch { process.exit(0); }
  };
  if (process.stdin.isTTY) return render();
  try {
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => { if (data.length < STATUS_STDIN_MAX) data += c; });
    process.stdin.on("end", render);
    process.stdin.on("error", render);
  } catch {
    return render();
  }
  setTimeout(render, 1500).unref(); // a caller that never closes stdin still gets its line
}
// `statusline --print-config`: the settings.json snippet with THIS clone's absolute path (never committed — like mcp-config).
function statusLineConfig() {
  const cli = path.resolve(__filename).replace(/\\/g, "/");
  const command = `node "${cli}" statusline`;
  const cfg = { statusLine: { type: "command", command } };
  if (flags.json) return console.log(JSON.stringify(cfg, null, 2));
  const C = spec.msg(spec.projectLang(projectDir)).claudeCode.statusLine.config;
  console.log(C.head);
  console.log(JSON.stringify(cfg, null, 2));
  console.log(C.after);
  if (/\/plugins\/cache\//i.test(cli)) console.log(C.cacheNote);
  console.log(C.tryIt(command));
}

// async (1.23 review M13): done --run / finish --run wait for their commands with a timer of their own (b5Exec) — a timeout kills
// the whole process tree, never only the shell.
async function main() {
  // 1.16 C1: the status line's render path runs before any flag / usage check — it must print its line or nothing, exit 0.
  if (cmd === "statusline" && !("print-config" in flags) && !("help" in flags)) return statusLineRender();
  process.stdout.on("error", stdoutError); // 1.24 r6 B2: a reader that closed early ends the output quietly
  refuseUnknownFlags(); // `--rnu` is an error (did you mean --run?), never a silent switch
  // 1.21 review A3: `merge-state --check` is a switch there — `--check` is init's VALUE flag (init --check name="cmd"), so it can't
  // join spec.CLI_SWITCHES (normalizeBoolFlags would refuse `init --check test="npm test"`, and the approval hook's lexer would read
  // init's value as the next word): a bare `--check` after merge-state reads as on.
  if (cmd === "merge-state" && missingValue === "check") { missingValue = null; flags.check = true; }
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
  // 1.22 review: --json on what prints text only — the help (`help`, no command, `--help` anywhere), `rules`, `mcp-config`, and
  // `evals` (the harness's text report; its flags go to run-evals.js, which refuses a --json given to it directly too) — is a
  // usage error, before anything runs: it printed the text on stdout with exit 0, and a script parsing it failed far away.
  const helpOnly = cmd === undefined || cmd === "help" || cmd === "-h" || cmd === "--help" || (on("help") && cmd !== "evals");
  if (on("json") && (helpOnly || TEXT_ONLY_COMMANDS.has(cmd))) die(projectText().noJson(helpOnly ? "help" : cmd), { text: true });
  if (on("help") && cmd !== "evals") return console.log(helpText()); // `<command> --help` prints the help, runs nothing
  if (!helpOnly) {
    checkProject(); // 1.23 review L14: an existing folder (init alone may create it) — 1.24 r6 B1: the environment too
    checkCommandArgs(); // 1.23 review: the command's own options, at most its own arguments
  }
  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      return console.log(helpText());

    case "classify": {
      if (!pos[0]) usage('dev-spec classify "<description>" [--name "<feature name>"] [--lang en|pt|pt-BR|es] [--explain]');
      const r = spec.classify(pos.join(" "), { name: flags.name, lang: flags.lang, projectDir, explain: on("explain") }); // same args as spec_classify
      return out(r, (r) => {
        const T = cliText(r.lang); // the language the reasoning was written in
        const C = spec.msg(r.lang).classify;
        console.log(T.tracks(r.label, Object.keys(r.confidence).map((t) => t + "=" + (C.conf[r.confidence[t]] || r.confidence[t])).join(", "))); // + the project's track packs (1.15)
        console.log(r.reasoning);
        if (r.note) console.log(T.note(r.note));
        if (r.sizeNote) console.log(r.sizeNote); // 1.21 F5: the suggested size (spec_create --size)
        if (r.explain) { // 1.21 F2: every keyword match and the project's signal overrides (.specs/classifier.json)
          console.log(r.explain.matches.length ? C.explainHead : C.explainNone);
          r.explain.matches.forEach((m) => console.log(C.explainMatch(m)));
          if (!r.explain.overrides.length) console.log(C.explainNoOverrides);
          else { console.log(C.explainOverridesHead(r.explain.overrides.length, r.explain.min)); r.explain.overrides.forEach((o) => console.log(C.explainOverride(o, r.explain.min))); }
        }
      });
    }

    case "signals": {
      // dev-spec signals [list | set <track> <word> off|weak|strong | forget <track> <word>] [--lang] — the project's classifier
      // signal overrides in .specs/classifier.json (= spec_tracks {action: "signals", op, track, word, effect}); exit 1 on a refusal.
      const syntax = "dev-spec signals [list | set <track> <word> off|weak|strong | forget <track> <word>] [--lang en|pt|pt-BR|es]";
      const op = pos[0] == null ? "list" : String(pos[0]).trim().toLowerCase();
      if ((op === "list" && pos.length > 1) || (op === "set" && pos.length !== 4) || (op === "forget" && pos.length !== 3)) usage(syntax);
      const r = spec.trackPacks(projectDir, "signals", { op, track: pos[1], word: pos[2], effect: pos[3], lang: flags.lang });
      if (!r.ok) return fail(r);
      return out(r, (r) => r.lines.forEach((l) => console.log(l)));
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
      // 1.14 F1: --evidence reported|observed = spec_init {evidence} (roadmap.json meta.evidence); absent leaves it as it is.
      let evidenceMode;
      if (flags.evidence !== undefined) {
        const v = String(flags.evidence).trim().toLowerCase();
        if (v === "reported" || v === "observed") evidenceMode = v;
        else die(spec.msg(flags.lang || spec.projectLang(projectDir)).observed.badValue(flags.evidence));
      }
      // --roles requirements=product,design=tech+security | none = spec_init {approvalRoles} (1.14 B3); absent leaves them as they are.
      let approvalRoles;
      if (flags.roles !== undefined) {
        approvalRoles = spec.parseApprovalRolesText(flags.roles, flags.lang || spec.projectLang(projectDir));
        if (approvalRoles.error) die(approvalRoles.error);
      }
      const r = spec.initProject(projectDir, tr.length ? tr : ["core"], flags.lang, { guard, checks, approvalRoles, stopCheck, approvalGuard, evidence: evidenceMode });
      if (r.ok === false) return fail(r); // e.g. an unknown track (did-you-mean) or an unreadable roadmap.json
      return out(r, (r) => {
        console.log(cliText(r.lang).created(r.specsDir, r.lang, r.created.join(", ") || cliText(r.lang).nothingNew, r.skipped.join(", ")));
        if (r.guardNote) console.log("  " + r.guardNote);
        if (r.stopCheckNote) console.log("  " + r.stopCheckNote);
        if (r.evidenceNote) console.log("  " + r.evidenceNote); // 1.14 F1
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
        { brownfield: on("brownfield"), flow: flags.flow, question: flags.question, timebox: flags.timebox, // = spec_create {brownfield, flow, question, timebox,
          reproduction: flags.reproduction, rootCause: flags["root-cause"], condition: flags.condition, behaviour: flags.behaviour, // the bugfix prefill (1.21 F3)
          cli: true, // 1.21 review A8: a refusal names the flag (--root-cause), not the MCP key (rootCause)
          includeBody: boolFlag("include-body") === true, // … includeBody} — the bodies are in the --json result
          size: flags.size }); // 1.21 F5: --size xs|s|m|l (= spec_create {size}; xs = a change: one change.md)
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
        // 1.21 F5: a sized feature's rows carry `status` — ○ an optional section left out (size s), ✓ one another track covers,
        // the template-only / short n/a states named
        const marks = (list) => list.map((s) => (s.filled ? (s.status === "missing" ? "○ " : "✓ ") : s.present ? "◐ " : "✗ ") + (fm.sectionNames[s.section] || s.section) +
          (s.filled ? (s.status === "missing" ? " (" + fm.sizes.optionalMark + ")" : s.status === "covered" ? " (" + fm.sizes.coveredMark + ")" : "")
            : " (" + fm.sectionStatus[s.status && fm.sectionStatus[s.status] ? s.status : s.present ? "unfilled" : "missing"] + ")")).join(" · ");
        if (r.scaleSections) console.log(T.scaleSections(marks(r.scaleSections)));
        if (r.aiSections && r.aiSections.sections) console.log(T.aiSections(marks(r.aiSections.sections)));
        for (const tr of ["sec", "privacy", "dist", "api", "ui", "obs", "data"]) if (r[tr + "Sections"]) console.log(fm.secPrivacy.statusSections[tr](marks(r[tr + "Sections"])));
        for (const p of Object.values(r.packSections || {})) console.log(fm.trackPacks.statusSections(p.marker, marks(p.sections))); // track packs (1.15)
        if (r.missingPacks) console.log(fm.trackPacks.missing(r.missingPacks.map((n) => "+" + n).join(", ")));
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
      if (!pos[0]) usage("dev-spec trace <feature> [--code] [--matrix] [--csv]");
      const matrix = on("matrix") || on("csv"); // 1.14 F5: --csv prints the matrix as CSV
      const r = spec.traceCheck(projectDir, pos[0], { code: on("code"), matrix }); // = trace_check {code, matrix}
      if (!r.ok) return fail(r);
      if (r.verdict !== "pass") process.exitCode = 1; // scriptable: gaps → non-zero (warnings never change it)
      const lang = spec.featureLang(projectDir, r.feature);
      const T = cliText(lang);
      // --csv: the data alone on stdout (header + one record per requirement; no BOM, no marker record — `export --csv` is the document)
      if (on("csv") && !flags.json) return process.stdout.write(spec.matrixCsv([r.matrix], lang));
      return out(r, (r) => {
        if (r.matrix) printMatrix(r.feature, r.matrix, lang);
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
      // A file path is read from the project when it was named (--project / the env), else from the working folder (argPath, L12).
      const file = argPath(pos[0]);
      const isFile = fs.existsSync(file) && fs.statSync(file).isFile();
      if (isFile) return report(spec.earsValidate(spec.decodeText(fs.readFileSync(file)), textLang), cliText(textLang)); // UTF-16 too
      return report(spec.earsFeature(projectDir, pos[0]), featureText(pos[0]));
    }

    case "next": {
      if (!pos[0]) usage("dev-spec next <feature> [--batch] [--max N] [--waves]");
      const r = spec.nextTask(projectDir, pos[0], { batch: on("batch"), max: intFlag("max"), waves: on("waves") }); // = spec_next_task {batch, max, waves}
      if (!r.ok) return fail(r);
      const T = featureText(r.feature);
      const D = spec.msg(spec.featureLang(projectDir, r.feature)).taskDeps; // 1.14 F3
      const waits = (list) => list.map((x) => D.waitLine(x.number, x.waitsOn.map((d) => "#" + d).join(", "))).join("; ");
      return out(r, (r) => {
        // No task can start while some are open (a cycle, a _Depends:_ naming no task): say so — never "all done".
        console.log(r.next ? T.next(r.next.number, r.next.text, r.remaining, r.total) : r.remaining ? r.note : T.allDone);
        if (r.next && r.skipped && r.skipped.length) console.log(D.cliSkipped(waits(r.skipped)));
        if (r.batch && r.batch.length > 1) console.log(T.batch(r.batch.map((b) => "#" + b.number + " [" + b.implements.join(", ") + "]").join("  ")));
        if (r.waves) {
          console.log(D.cliWaves(r.waves.length));
          if (!r.waves.length) console.log(D.cliNoWave);
          r.waves.forEach((w, k) => console.log(D.cliWave(k + 1, w.map((n) => "#" + n).join(" "))));
          (r.cycles || []).forEach((c) => console.log(D.cliCycles(c.map((n) => "#" + n).join(", "))));
        }
        if (r.next && r.blocked && r.blocked.length) console.log(D.cliBlocked(waits(r.blocked))); // (no next: the note names them)
      });
    }

    case "finish": {
      // dev-spec finish <feature> [--write] [--include-body] — readiness report + merge summary from the spec chain (no PRs)
      if (!pos[0]) usage("dev-spec finish <feature> [--write] [--include-body] [--run [--shell bash|pwsh|<path>] [--timeout <s>]]");
      // B5: --run executes the project checks (roadmap.json meta.checks) — only on this explicit flag — and records every run
      // (= spec_finish {evidence}); without meta.checks it is an error, nothing runs.
      runOnlyFlags(); // --shell / --timeout without --run: a usage error (1.23 review — they were ignored)
      let evidence, runStart;
      if (on("run")) {
        runStart = spec.runStartStamp(projectDir, pos[0]); // 1.22 review: `at` and the code stamp BEFORE the checks run
        const rc = await b5RunChecks(pos[0]);
        if (!rc.ok) return fail(rc, rc.hint);
        evidence = rc.evidence;
      }
      const r = spec.finishFeature(projectDir, pos[0], { write: on("write"), includeBody: boolFlag("include-body"), evidence, ...(on("run") ? { ranBy: "cli", runStart } : {}) }); // = spec_finish {includeBody, evidence}; ranBy: the runs are observed by the CLI itself (1.14 F1)
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
      // A task number GIVEN is an integer ≥ 0, as done checks it (1.23 review L11: an empty word briefed — and with --write wrote —
      // the NEXT task, where spec_task_brief {number: ""} is refused by its schema). No number at all: the next task.
      if (pos[1] != null && !/^\s*\d+\s*$/.test(String(pos[1]))) {
        const A = spec.msg(spec.featureLang(projectDir, pos[0])).args;
        return fail({ ok: false, error: A.invalid(A.item("number", A.type.integer + " " + A.atLeast(0), JSON.stringify(String(pos[1])))) });
      }
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
      if (!pos[0] || pos[1] == null) usage("dev-spec done <feature> <task-number> [--run [--shell bash|pwsh|<path>] [--timeout <s>] | --evidence \"summary\" [--exit N] [--cmd \"command\"]]");
      const D = spec.msg(spec.featureLang(projectDir, pos[0])).taskDone; // human output in the feature's language
      // The task number: an integer ≥ 0 (spec_complete_task's schema; a hand-written "0." task is one next can serve) — refused
      // BEFORE anything runs (an empty word would brief the NEXT task and run its _Verify:_), in the MCP validator's words, as the
      // engine refuses it for undone / brief (1.22 review: `-1` read "must be an integer"). --json prints the refusal on stdout.
      if (!/^\s*\d+\s*$/.test(String(pos[1])) || !(Number(pos[1]) >= 0)) {
        const A = spec.msg(spec.featureLang(projectDir, pos[0])).args;
        return fail({ ok: false, error: A.invalid(A.item("number", A.type.integer + " " + A.atLeast(0), JSON.stringify(String(pos[1])))) });
      }
      // 1.23 review: --shell / --timeout need --run, and --run (a run made here) excludes --evidence / --exit / --cmd (a run made
      // elsewhere) — each was ignored silently.
      runOnlyFlags();
      if (on("run") && (flags.evidence !== undefined || flags.exit !== undefined || flags.cmd !== undefined)) die(projectText().runOrEvidence);
      const say = flags.json ? console.error : console.log; // --json keeps stdout one JSON document
      let evidence;
      let hint = null;
      let runStartedAt = null, ranVerify = null; // 1.22 review: the stamps taken BEFORE the run (its start, the _Verify:_ it ran)
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
        // Windows, never WSL's launcher unless named by its path: b5Shell). A shell that can't be found is refused before anything runs.
        const sh = b5Shell();
        if (sh.error) return fail({ ok: false, couldNotRun: sh.error, error: sh.error === "wsl-exe" ? M.runGate.wslExe(sh.path) : M.runGate.noGitBash });
        if (sh.wsl) (flags.json ? console.error : console.log)(M.runGate.wslBash(sh.shell)); // 1.15: an explicit WSL launcher is used as given — said once
        // cmd.exe misreads POSIX quoting / $VAR — often without failing (`node -e 'process.exit(1)'` exits 0): a command
        // written for a POSIX shell is refused before anything runs unless a shell was chosen (--shell cmd: cmd.exe anyway).
        if (process.platform === "win32" && sh.shell === true) {
          const posix = cmds.map((c) => [c, spec.posixShellSyntax(c)]).find(([, k]) => k.length);
          if (posix) return fail({ ok: false, error: D.posixOnWindows(posix[0], posix[1]) });
        }
        // 1.21.1 review — the mirror: a POSIX shell (/bin/sh, bash, Git Bash…) expands `$…` / backticks in a pwsh script
        // outside single quotes before PowerShell sees it (`exit $LASTEXITCODE` → `exit` → 0: a failing check recorded as
        // passing) — refused before anything runs.
        if (sh.posix) {
          const pw = cmds.map((c) => [c, spec.posixPwshScript(c)]).find(([, k]) => k.length);
          if (pw) return fail({ ok: false, error: D.pwshInPosix(pw[0], pw[1], b5ShellName(sh)) });
        }
        // A pipe masks the check's exit code (a pipeline reports its LAST command's): one hint line — it still runs.
        cmds.filter(spec.verifyPipeMasked).forEach((c) => say(M.verifyPipe.runHint(c)));
        const git = b5GitState(); // B5: the commit the run is made on (+ dirty outside .specs/) — read-only git, skipped without it
        runStartedAt = new Date().toISOString(); // 1.22 review: the run's `at` is when it STARTED (an edit made meanwhile isn't tested)
        ranVerify = b.verify.slice(); // …and its verify stamp the _Verify:_ as it was then (edited meanwhile → stale-evidence)
        const passed = []; // 1.23 review: each passing command's output — the record keeps one summary per command, not the last one's
        for (const cmd of cmds) {
          say("$ " + cmd);
          const x = await b5Exec(cmd, sh, M);
          if (x.summary) say(x.summary.replace(/^/gm, "  "));
          if (x.heldOpen && !x.cantRun) say("  " + M.cliOutput.runHeldOpen(x.code)); // 1.24 r6 B3: settled at its exit
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
            // 1.21.1 review — nor is PowerShell's own parse error (the script never ran: 5.1's "'&&' is not a valid statement
            // separator"), whenever PowerShell runs the line (--shell pwsh / powershell, or a pwsh program in it). After the
            // could-not-run output: a Pester test file that doesn't parse is named as such ("[-] Discovery in … failed").
            const parse = b.expect === "fail" && (sh.pwsh || spec.runsPwsh(cmd)) ? spec.pwshParseFailure(x.output) : null;
            if (parse) return fail({ ok: false, expected: "fail", couldNotRun: "pwsh", error: M.redGreen.pwshNotRed(cmd, parse.text) });
            evidence = { command: cmd, exitCode: code, summary: x.summary, ...git };
            // The cmd.exe / --shell bash hint only when cmd.exe itself failed (unknown command, its syntax error) — a check
            // that ran and failed (node tests/x.js → exit 1) needs a code fix, not another shell.
            if (sh.cmd && spec.windowsShellFailure(x.output, code)) hint = D.shellHint;
            break;
          }
          passed.push({ cmd, output: x.output, summary: x.summary });
          evidence = { command: cmds.join(" && "), exitCode: 0, summary: runSummaries(passed), ...git };
        }
      } else if (flags.evidence != null || flags.exit != null || flags.cmd != null) {
        evidence = { command: flags.cmd, exitCode: flags.exit, summary: typeof flags.evidence === "string" ? flags.evidence : undefined };
      }
      // 1.14 F1: a run --run made is observed by the CLI itself (observed: "cli"); a reported one is looked up in the harness's log.
      const r = spec.completeTask(projectDir, pos[0], pos[1], evidence, { ...(on("run") ? { ranBy: "cli", startedAt: runStartedAt, ranVerify } : {}), ...(flags.reason !== undefined ? { reason: flags.reason } : {}) }); // --reason: only undone takes it (refused here, as MCP)
      if (!r.ok) return fail(r, hint); // --json: {ok:false, recorded:true, …} on stdout, as spec_complete_task returns it
      return out(r, (r) => {
        // "(verified)" only when something was run or attested — nothingToVerify is verified with nothing checked
        // "all done" only when no task is open (1.14 F3: open tasks none of which can start are named by the note)
        console.log((r.alreadyDone ? D.already : D.done)(r.completed, r.verified && !r.nothingToVerify, r.done, r.total) + (r.next ? D.next(r.next.number, r.next.text) : r.done < r.total ? "" : D.allDone));
        if (r.redRecorded) console.log(spec.msg(spec.featureLang(projectDir, r.feature)).redGreen.redRecorded(r.completed, evidence.exitCode)); // B5: _Expect: fail_
        if (r.note) console.log("  ⚠ " + r.note);
      });
    }

    case "undone": {
      // 1.16 U1 — dev-spec undone <feature> <n> [--reason "…"] = spec_complete_task {undo: true, reason}: untick a task ticked by
      // mistake — its evidence turns stale (a re-tick needs a new run), ticks[n] is dropped, .state.json unticks records it.
      if (!pos[0] || pos[1] == null) usage("dev-spec undone <feature> <task-number> [--reason \"…\"]");
      const M = spec.msg(spec.featureLang(projectDir, pos[0])); // human output in the feature's language
      // 1.16 U review 5: done's evidence flags (--evidence / --exit / --cmd / --run) are refused, as spec_complete_task refuses
      // {undo, evidence} — they were silently ignored (the user believed a run had been recorded). Nothing runs, nothing changes.
      // (1.23 review: --shell / --timeout — how --run would run — too, never ignored)
      if (flags.evidence != null || flags.exit != null || flags.cmd != null || on("run") || flags.shell !== undefined || flags.timeout !== undefined) return fail({ ok: false, error: M.undo.noEvidence });
      const r = spec.completeTask(projectDir, pos[0], pos[1], undefined, { undo: true, reason: flags.reason });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        console.log((r.unticked ? M.undo.cliDone : M.undo.cliAlready)(r.number, r.done, r.total) + (r.next ? M.taskDone.next(r.next.number, r.next.text) : ""));
        if (r.note) console.log("  " + (r.unticked ? "⚠ " : "") + r.note);
      });
    }

    case "approve": {
      // --through <phase> = the fast-forward (spec_approve {through}); --role <role> = the sign-off's role (spec_approve {role}).
      const through = typeof flags.through === "string" ? flags.through : undefined;
      if (!pos[0] || (!pos[1] && through === undefined)) usage("dev-spec approve <feature> <phase> [--force [--reason \"…\"] [--expires YYYY-MM-DD|Nd]] [--by NAME] [--role ROLE] | dev-spec approve <feature> <phase> --revoke [--reason \"…\"] | dev-spec approve <feature> --through <phase>");
      // Default approver: the engine's (same as MCP). --force = spec_approve {force: true}; a refusal exits 1 listing the failing checks.
      const r = spec.approvePhase(projectDir, pos[0], pos[1], typeof flags.by === "string" ? flags.by : undefined,
        { force: on("force"), role: typeof flags.role === "string" ? flags.role : undefined, ...(through !== undefined ? { through } : {}),
          reason: flags.reason, expires: flags.expires, revoke: on("revoke") }); // 1.16 U2 / U3 (= spec_approve {revoke, reason, expires})
      if (!r.ok) return fail(r); // a fast-forward stopped at a refused gate: its error names what was approved before it
      const GV = spec.msg(spec.featureLang(projectDir, r.feature)).governance;
      return out(r, (r) => {
        if (r.revoked) return console.log(r.message); // 1.16 U2: what was revoked, and that nothing cascades
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
      // 1.23 review (P1): every flag goes to run-evals.js WHEREVER it stands — `evals --dry-run <f>` dropped the flag before the
      // feature and ran the eval LIVE (paid API calls) — read with the harness's own rules (evalsArgs). The harness refuses an
      // unknown flag (--dryrun), prints its usage on --help and refuses a second word; --project is the CLI's resolved project.
      const ea = evalsArgs();
      if (!ea.feature && !ea.help) usage("dev-spec evals <feature> [--dry-run] [--set-baseline] [--require-live] [--model ID] [--prompt FILE] [--max-items N]");
      const res = spawnSync(process.execPath, [EVALS, ...(ea.feature ? [ea.feature] : []), "--project", projectDir, ...ea.rest], { stdio: "inherit" });
      // A harness that never ran (spawn error) or was killed by a signal has no status — that is a failure, never exit 0
      // (1.22 review: `res.status || 0` passed a killed run).
      if (res.error) console.error("dev-spec: " + res.error.message);
      return process.exit(res.error || res.status == null ? 1 : res.status);
    }

    case "backlog": {
      const a0 = String(pos[0] == null ? "" : pos[0]).trim().toLowerCase(); // case-folded, like the engine and the MCP enum
      // No action lists; an unknown one (delete, ad…) is an error from the engine, as over MCP — it used to just list.
      const action = a0 || "list";
      // add <name> [note words…] reads every word; rm|remove <name> and list read no more (1.23 review: extra words were ignored)
      const most = action === "list" ? 1 : action === "rm" || action === "remove" ? 2 : Infinity;
      if (pos.length > most) die(projectText().extraArgs("backlog " + action, pos.slice(most).join(" ")));
      const r = spec.backlog(projectDir, action, pos[1], action === "add" ? pos.slice(2).join(" ") : undefined);
      if (!r.ok) return fail(r); // e.g. rm of a name that isn't in the backlog
      const T = projectText();
      return out(r, (r) => {
        // 1.19 R review 5: a name already in the backlog — its note was appended to (or already held it): the engine's localized note
        if (action === "add" && r.exists) console.log(r.note);
        else if (action === "add") console.log(T.backlogAdded(String(pos[1]).trim()));
        else if (action === "rm" || action === "remove") console.log(T.backlogRemoved(String(pos[1]).trim()));
        console.log(T.backlogHead(r.backlog.length));
        r.backlog.forEach((b) => console.log("  - " + b.name + (b.note ? " — " + b.note : "")));
      });
    }

    case "milestone":
    case "milestones": {
      // dev-spec milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list] (= spec_milestone {action, name, date, features}):
      // a name with spaces is quoted; the features may also be comma-separated. The action is case-folded, like the MCP enum.
      const a0 = String(pos[0] == null ? "" : pos[0]).trim().toLowerCase() || "list";
      const syntax = "dev-spec milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list]";
      if ((a0 === "list" && pos.length > 1) || ((a0 === "rm" || a0 === "remove") && pos.length !== 2)) usage(syntax);
      const r = spec.milestone(projectDir, a0, a0 === "add" ? { name: pos[1], date: pos[2], features: pos.slice(3) } : { name: pos[1] });
      if (!r.ok) return fail(r);
      return out(r, (r) => r.lines.forEach((l) => console.log(l)));
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
      // 1.23 review (L12): <path> is read from the project when it was named (--project / the env), else from the working folder
      // (argPath) — it was always the working folder; and the report is in the PROJECT's language (a subfolder has no .specs/).
      const root = pos[0] ? argPath(pos[0]) : projectDir;
      const lang = spec.projectLang(projectDir);
      const r = spec.scanCodebase(root, { cap: intFlag("cap"), lang });
      if (!r.ok) return fail(r); // a path that is no folder (1.22 review): exit 1, never an empty codebase
      const T = cliText(lang); // same language as the engine's note
      const B = spec.msg(lang).brownfield;
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
      if (!r.ok) return fail(r);
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
        if (r.glossaryNote) console.log("  ⚠ " + r.glossaryNote); // 1.16 Q review: a glossary read only in part says so
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
      if (!pos[0] || !tr.length) usage("dev-spec add-track <feature> <tdd|saas|ai|sec|privacy|dist|api|ui|obs|data>... (or a track pack's name — dev-spec tracks) [--remove]");
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
      // and bare `references/x.md` (relative to the skill) resolve too, as do the plugin's `agents/x.md` and
      // `commands/x.md` (AGENTS.md cites the reviewer's Verify mode, /spec-review-feedback and /spec-simplify).
      // Commands get quoted paths and link targets get <…> when the clone path has spaces.
      const re = /(\bnode\s+|\]\()?(?<![\w./-])(?:\.\.\/)*(cli\/dev-spec\.js|mcp\/server\.js|AGENTS\.md|skills\/dev-spec-driven(?:\/[\w.-]+)*\/?|references\/(?:[\w.-]+\.md)?|(?:agents|commands)\/[\w.-]+\.md)/g;
      const text = raw.replace(re, (m, lead, rel) => {
        const abs = ROOT + "/" + (rel.startsWith("references/") ? "skills/dev-spec-driven/" + rel : rel);
        if (lead && /^node/.test(lead)) return lead + JSON.stringify(abs);
        if (lead) return lead + (/\s/.test(abs) ? "<" + abs + ">" : abs);
        return abs;
      }).replace(/ \(repo root\)/g, "");
      return process.stdout.write(text.endsWith("\n") ? text : text + "\n");
    }

    case "import": {
      // dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name n] [--lang] [--tracks …] — the same engine call as
      // spec_import: <path> resolves against the project root and must stay inside it.
      // 1.16 C4: `import plan|execplan|fluidplan -` reads the document's markdown from stdin, `--text "<markdown>"` takes it inline
      // (= spec_import {tool, text} — a plan kept outside the project, e.g. Claude Code's ~/.claude/plans).
      const usageLine = "dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name <feature>] [--lang en|pt|pt-BR|es] [--tracks tdd,saas,ai,sec,privacy,dist,api,ui,obs,data] · import <plan|execplan|fluidplan> - | --text \"<markdown>\"";
      const fromStdin = pos[1] === "-";
      const hasText = typeof flags.text === "string";
      if (!pos[0] || (!pos[1] && !hasText) || (fromStdin && hasText)) usage(usageLine);
      // With --text the words after the tool are tracks; with - or a path, the words after it. A word after the tool that is no
      // track list next to --text is a path given with it: passed as the source, so the engine answers its "path or text, not
      // both" (as spec_import {path, text} does) — never "Unknown track: 'plans/x.md'".
      const pathWithText = hasText && !!pos[1] && spec.parseTracks(pos[1]).unknown.length > 0;
      // 1.23 review: run from a subfolder of the project (found by walking up), <path> is relative to that subfolder (argPath) —
      // handed to the engine relative to the project, which still refuses one outside it.
      const source = (p) => (p == null || projectNamed || path.resolve(process.cwd()) === projectDir ? p
        : path.relative(projectDir, argPath(p)).split(path.sep).join("/") || ".");
      const doImport = (text) => {
        const r = spec.importSpec(projectDir, pos[0], text != null && !pathWithText ? undefined : source(pos[1]), { name: flags.name, lang: flags.lang,
          tracks: withTracksFlag(pos.slice(hasText && !pathWithText ? 1 : 2)), text });
        if (!r.ok) return fail(r);
        return out(r, (r) => {
          const B = spec.msg(r.lang).importSpec;
          console.log(B.done(r.toolName, r.inline ? spec.msg(r.lang).claudeCode.importText.label : r.source, r.feature, r.label, r.lang));
          console.log("  " + r.files.join(", "));
          const ids = Object.entries(r.mapping);
          console.log(B.mapping(ids.length, ids.slice(0, 6).map(([a, b]) => a + " → " + b).join(", ") + (ids.length > 6 ? ", …" : "")));
          r.warnings.forEach((w) => console.log("  ⚠ " + w));
        });
      };
      if (fromStdin) return readStdin((text) => doImport(text));
      return doImport(hasText ? flags.text : undefined);
    }

    case "append-tasks": {
      // dev-spec append-tasks <feature> --task "<text>" [...] — ONE task per call; = spec_append_tasks {tasks: [that task]}
      if (!pos[0] || typeof flags.task !== "string") usage('dev-spec append-tasks <feature> --task "<text>" [--req US-1.AC-2[,…]] [--implements path[,…]] [--verify "<cmd>"] [--makes-green T-01[,…]] [--expect-fail] [--size XS|S|M|L|XL] [--depends 3[,5]] [--story US1|shared] [--parallel] [--heading "<phase heading>"]');
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
      const deps = every("depends"); // 1.14 F3: = the MCP task field depends (repeatable, "3,5" / "#3" split by the engine)
      if (deps.length) task.depends = deps;
      const r = spec.appendTasks(projectDir, pos[0], [task], { heading: typeof flags.heading === "string" ? flags.heading : undefined });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        console.log(T.appended(r.heading, r.headingCreated, r.file));
        r.appended.forEach((t) => console.log("  - [ ] " + t.number + ". " + t.text));
        if (r.note) console.log("  ⚠ " + r.note);
      });
    }

    case "impact": {
      // dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen] — the same engine call as spec_impact;
      // 1.16 Q1: `impact [feature] --phase steering` — the features approved under steering that changed since (no feature = all)
      const steeringPhase = String(flags.phase == null ? "" : flags.phase).trim().toLowerCase() === "steering";
      if (!pos[0] && !steeringPhase) usage("dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen] · dev-spec impact [feature] --phase steering");
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

    case "tracks": {
      // dev-spec tracks [list|init <name>|check] [name] [--lang en|pt|pt-BR|es] — the project's track packs in .specs/tracks/
      // (= spec_tracks {action, name, lang}). check exits 1 when a pack has an error (scriptable, like templates check).
      if (pos.length > 2) usage("dev-spec tracks [list|init <name>|check] [name] [--lang en|pt|pt-BR|es]");
      const r = spec.trackPacks(projectDir, pos[0], { name: pos[1], lang: flags.lang });
      if (!r.ok) return fail(r);
      if (r.action === "check" && r.errors) process.exitCode = 1;
      return out(r, (r) => r.lines.forEach((l) => console.log(l)));
    }

    case "export": {
      // dev-spec export [feature] [--md|--csv|--gherkin|--tracker jira|linear] [--write] — the stakeholder document (= spec_export
      // {name, format, write}): printed on stdout, or written to .specs/exports/ (never over a hand-written file → exit 1). No
      // feature = the whole project (--gherkin: one .feature per feature). --tracker takes the tool's name (the MCP format).
      const syntax = "dev-spec export [feature] [--md|--csv|--gherkin|--tracker jira|linear] [--write]";
      const tracker = flags.tracker === undefined ? null : String(flags.tracker).trim().toLowerCase();
      if (pos.length > 1 || [on("md"), on("html"), on("csv"), on("gherkin"), tracker !== null].filter(Boolean).length > 1) usage(syntax);
      if (tracker !== null && !spec.TRACKERS.includes(tracker)) {
        const A = spec.msg(spec.projectLang(projectDir)).args;
        die(A.invalid(A.item("--tracker", A.oneOf(spec.TRACKERS.join(", ")), JSON.stringify(String(flags.tracker)))));
      }
      const format = tracker || (on("md") ? "md" : on("csv") ? "csv" : on("gherkin") ? "gherkin" : "html");
      const r = spec.exportSpecs(projectDir, { name: pos[0], format, write: on("write") });
      if (!r.ok) return fail(r);
      const M = spec.msg(r.lang);
      return out(r, (r) => {
        if (r.format === "gherkin" && r.scope === "project") { // one .feature per feature: written, or each printed under its path
          if (r.wrote) { r.files.forEach((f) => console.log(M.stakeholderExport.wrote(f))); return console.log(M.gherkin.wroteMany(r.files.length, r.scenarios)); }
          if (!r.documents.length) return console.log(M.gherkin.noFeatures);
          return r.documents.forEach((d, i) => process.stdout.write((i ? "\n" : "") + "# ── " + path.relative(projectDir, d.file).split(path.sep).join("/") + " ──\n" + d.content));
        }
        if (r.wrote) return console.log(tracker ? M.trackerCsv.wrote(r.file, r.records) : M.stakeholderExport.wrote(r.file));
        process.stdout.write(r.content);
      });
    }
    case "changelog": {
      // dev-spec changelog [--since <ISO date|last|all>] [--write] — release notes from the specs (= spec_changelog): the
      // markdown on stdout (a note on stderr), or --write → .specs/RELEASE-NOTES.md + meta.changelogAt (exit 1 on a refusal).
      if (pos.length) usage("dev-spec changelog [--since <ISO date|last|all>] [--milestone <name>] [--write]");
      const r = spec.changelog(projectDir, { since: flags.since, write: on("write"), milestone: flags.milestone });
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
      if (!pos[0] || (pos[1] != null && pos[1] !== "-")) usage("dev-spec log <feature> [--max N] [-]"); // a second word is "-" (stdin) or nothing
      const fx = spec.existingFeature(projectDir, pos[0]);
      if (!fx.ok) return fail(fx);
      const max = intFlag("max") || 1000;
      const report = (text, opts) => {
        const r = spec.taskCommits(projectDir, pos[0], text, opts);
        if (!r.ok) return fail(r);
        return out(r, (r) => r.lines.forEach((l) => console.log(l)));
      };
      if (pos[1] === "-") return readStdin((text) => report(text, { max: intFlag("max") })); // --max: the window the piped log was read with (= spec_log {max})
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
    async function b5RunChecks(feature) {
      const fx = spec.existingFeature(projectDir, feature);
      if (!fx.ok) return fx;
      const M = spec.msg(spec.featureLang(projectDir, fx.slug));
      const { checks } = spec.projectChecks(projectDir);
      if (!checks.length) return { ok: false, error: M.projectChecks.noneToRun };
      const sh = b5Shell();
      if (sh.error) return { ok: false, couldNotRun: sh.error, error: sh.error === "wsl-exe" ? M.runGate.wslExe(sh.path) : M.runGate.noGitBash };
      if (sh.wsl) (flags.json ? console.error : console.log)(M.runGate.wslBash(sh.shell)); // 1.15: an explicit WSL launcher is used as given
      if (process.platform === "win32" && sh.shell === true) {
        const posix = checks.map((c) => [c, spec.posixShellSyntax(c.command)]).find(([, k]) => k.length);
        if (posix) return { ok: false, error: M.projectChecks.posixOnWindows(posix[0].name, posix[0].command, posix[1]) };
      }
      if (sh.posix) { // 1.21.1 review: a POSIX shell would expand the pwsh script's `$…` first (done --run's rule)
        const pw = checks.map((c) => [c, spec.posixPwshScript(c.command)]).find(([, k]) => k.length);
        if (pw) return { ok: false, error: M.projectChecks.pwshInPosix(pw[0].name, pw[0].command, pw[1], b5ShellName(sh)) };
      }
      const say = flags.json ? console.error : console.log; // --json keeps stdout one JSON document
      checks.map((c) => c.command).filter(spec.verifyPipeMasked).forEach((c) => say(M.verifyPipe.runHint(c)));
      const git = b5GitState();
      const evidence = [];
      let cmdFailed = false;
      for (const c of checks) {
        say("$ " + c.command + "   (" + c.name + ")");
        const x = await b5Exec(c.command, sh, M);
        if (x.summary) say(x.summary.replace(/^/gm, "  "));
        if (x.heldOpen && !x.cantRun) say("  " + M.cliOutput.runHeldOpen(x.code)); // 1.24 r6 B3: settled at its exit
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
    // bash.exe launcher only when named by its path; wsl.exe refused — wsl-exe). → spec.resolveRunShell's result.
    function b5Shell() {
      timeoutFlag(); // --timeout <seconds>: an integer ≥ 1 (≤ TIMEOUT_MAX_S) — refused (exit 1) before anything runs
      const req = (typeof flags.shell === "string" && flags.shell.trim()) || (process.env.DEV_SPEC_SHELL || "").trim() || "";
      const needsGit = process.platform === "win32" && /^bash(?:\.exe)?$/i.test(req);
      return spec.resolveRunShell(req, { gitExecPath: needsGit ? b5Git(["--exec-path"]) : null });
    }
    // The shell a run uses, as a message names it (the platform default spelled out).
    function b5ShellName(sh) {
      return sh.shell === true ? (process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "/bin/sh") : String(sh.shell);
    }
    // Runs ONE command line — the user's own _Verify:_ (done --run) or meta.checks command (finish --run), only on an explicit
    // --run: the same trust as an npm script; a shell is the point, each is a shell command line. → { code, output, summary,
    // cantRun: null | { code, why } } — cantRun (full review Ga1 / Ga9 / Ga10, stable codes): the run never exercised the check,
    // so nothing may be recorded for it: shell-not-started (spawn error: a missing or unusable shell) · timeout (--timeout) ·
    // output-too-large (over 64 MB) · signal (killed) · run-error (any other spawn error) · wsl (WSL's launcher answered).
    // → a Promise (1.23 review M13): the run is asynchronous with a timer of its own, so --timeout kills the whole PROCESS TREE —
    // `taskkill /T /F` on Windows, the process group (a detached child: its own group) elsewhere. spawnSync's timeout killed the
    // shell alone: the check it started ran on (and held the output pipes — the CLI waited for it all the same). Ctrl+C / a
    // SIGTERM to the CLI kills the tree too (a detached group no longer gets the terminal's Ctrl+C).
    function b5Exec(command, sh, M) {
      const timeoutS = timeoutFlag(); // --timeout <seconds>: an integer ≥ 1, ≤ TIMEOUT_MAX_S (validated before anything runs — first call)
      const win = process.platform === "win32";
      const MAX_OUTPUT = 64 * 1024 * 1024; // spawnSync's maxBuffer, as before
      return new Promise((resolve) => {
        const chunks = [[], []];
        let size = 0, error = null, settled = false, timer = null, grace = null, child = null;
        let exited = null, drain = null, heldOpen = false; // 1.24 r6 B3: the command's exit, the drain after it, pipes still held then
        const killTree = () => {
          if (child && child.pid != null) {
            if (win) {
              try { spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { windowsHide: true, stdio: "ignore", timeout: 15000 }); } catch { /* gone */ }
            } else {
              try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } }
            }
          }
          // A process that left the tree (or a pipe someone else holds) must not keep the CLI waiting: 3 s for 'close', then settle.
          if (!grace) grace = setTimeout(() => settle(null, "SIGKILL"), 3000);
        };
        const onSignal = (sig) => { killTree(); process.exit(sig === "SIGINT" ? 130 : 143); };
        const settle = (status, signal) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearTimeout(grace);
          clearTimeout(drain);
          process.removeListener("SIGINT", onSignal);
          process.removeListener("SIGTERM", onSignal);
          if (child) { try { child.stdout.destroy(); child.stderr.destroy(); child.unref(); } catch { /* already closed */ } }
          resolve(b5ExecResult({ status, signal, error, heldOpen, stdout: Buffer.concat(chunks[0]).toString("utf8"), stderr: Buffer.concat(chunks[1]).toString("utf8") }, sh, M, timeoutS));
        };
        try {
          // 1.21.1: a PowerShell shell (--shell pwsh / powershell, DEV_SPEC_SHELL) runs `<shell> -NoProfile -NonInteractive
          // -Command <cmd>` (sh.args, resolveRunShell) — no profile, no prompt; the command is one argument. Any other shell: Node
          // runs `<shell> -c "<cmd>"` (cmd.exe: /d /s /c).
          const opts = { cwd: projectDir, windowsHide: true, detached: !win };
          // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
          child = Array.isArray(sh.args) ? spawn(String(sh.shell), [...sh.args, command], opts) : spawn(command, { shell: sh.shell, ...opts });
        } catch (e) { error = e; return settle(null, null); }
        process.on("SIGINT", onSignal);
        process.on("SIGTERM", onSignal);
        child.on("error", (e) => { if (!error) error = e; settle(null, null); }); // the shell never started (ENOENT, EACCES…)
        const take = (k) => (c) => {
          if (error) return;
          size += c.length;
          if (size > MAX_OUTPUT) { error = Object.assign(new Error("output maxBuffer length exceeded"), { code: "ENOBUFS" }); killTree(); return; }
          chunks[k].push(c);
        };
        child.stdout.on("data", take(0));
        child.stderr.on("data", take(1));
        try { child.stdin.end(); } catch { /* no stdin */ }
        // 1.24 r6 B3 — the run is over when the COMMAND exits, not when its pipes close: a background process it started (a dev
        // server, a watcher) inherits them and kept the CLI waiting for that process — and --timeout refused a run that had
        // exited 0. At the exit the --timeout timer stops; what is still in the pipes drains until 'close', RUN_DRAIN_MS at most,
        // then the pipes are dropped and the exit status settles the run (heldOpen: the caller prints a note).
        child.on("exit", (code, signal) => {
          exited = { code, signal };
          if (!error) clearTimeout(timer);
          drain = setTimeout(() => { heldOpen = true; settle(code, signal); }, RUN_DRAIN_MS);
        });
        child.on("close", (code, signal) => settle(exited ? exited.code : code, exited ? exited.signal : signal));
        if (timeoutS) timer = setTimeout(() => { error = Object.assign(new Error("spawn " + b5ShellName(sh) + " ETIMEDOUT"), { code: "ETIMEDOUT" }); killTree(); }, timeoutS * 1000);
      });
    }
    // A finished run → { code, output, summary, cantRun, crashed?, heldOpen } (b5Exec's verdict, unchanged by M13; heldOpen —
    // 1.24 r6 B3: a background process still held the output pipes when the run settled at the command's exit).
    function b5ExecResult(run, sh, M, timeoutS) {
      const r = b5Verdict(run, sh, M, timeoutS);
      r.heldOpen = !!run.heldOpen;
      return r;
    }
    function b5Verdict(run, sh, M, timeoutS) {
      const CRASH_SIGNALS = ["SIGSEGV", "SIGABRT", "SIGBUS", "SIGFPE", "SIGILL"]; // inside: hoisted above any outer const
      const output = (run.stdout || "") + (run.stderr || "") + (run.error ? "\n" + run.error.message : "");
      const summary = spec.summarizeRunOutput(output);
      const W = M.runGate.why;
      const shellName = b5ShellName(sh);
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
      // report, a spec-simplifier on its simplification report). Exit 1 when the turn would be sent back (scriptable, like doctor); --json prints the result.
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

    case "merge-state": {
      // 1.21 F1a — git's merge driver for the spec state: merge-state <base> <ours> <theirs> [<path>] (git's %O %A %B %P) merges
      // .state.json / roadmap.json SEMANTICALLY (spec.mergeStateText) and writes the result to <ours> — exit 0 merged, 1 a real
      // conflict (ours kept at each, listed in the file as "mergeConflicts" — valid JSON, doctor fails merge-conflicts). The
      // generated overviews (ROADMAP.md / .html, SPECS.md) keep ours. --install / --uninstall: .gitattributes + this clone's
      // git config (merge.dev-spec-state.*) — the only git this command runs besides `git merge-file` for a hand-written overview.
      // --check (1.21 review A3): read-only — does git config's driver still run THIS clone's CLI? (a plugin update moves it)
      const msUsage = "dev-spec merge-state <base> <ours> <theirs> [<path>] · dev-spec merge-state --install | --uninstall | --check [--project <dir>]";
      const check = flags.check === true || /^(?:true|1|yes|on)$/i.test(String(flags.check === undefined ? "" : flags.check));
      if (flags.check !== undefined && !check && !/^(?:false|0|no|off)$/i.test(String(flags.check))) usage(msUsage);
      if (check) { if (pos.length || on("install") || on("uninstall")) usage(msUsage); return mergeDriverCheck(); }
      if (on("install") || on("uninstall")) return mergeDriverSetup(on("uninstall"));
      if (pos.length < 3 || pos.length > 4) usage(msUsage);
      return mergeStateRun(pos[0], pos[1], pos[2], pos[3]);
    }

    case "mcp-config":
      return console.log(mcpConfig(pos[0]));

    case "bundle": {
      // 1.20: dev-spec bundle [--out <file.js>] — THIS clone's engine as one file (scripts/build.js --bundle), for a slow file
      // system: loaded only with DEV_SPEC_BUNDLE=1 (DEV_SPEC_BUNDLE_PATH=<file> for --out) and while it is current — rebuild
      // after every plugin update. Needs no project; never committed (git-ignored).
      const outFile = typeof flags.out === "string" ? path.resolve(flags.out) : null;
      if (pos.length || (outFile && !/\.js$/i.test(outFile))) usage("dev-spec bundle [--out <file.js>]");
      const B = require(path.join(__dirname, "..", "scripts", "build.js"));
      let r;
      try { r = B.writeBundle(outFile || B.BUNDLE_PATH); } catch (e) { return die(e.message); }
      const T = projectText();
      return out({ ok: true, ...r, env: outFile ? { DEV_SPEC_BUNDLE: "1", DEV_SPEC_BUNDLE_PATH: r.file } : { DEV_SPEC_BUNDLE: "1" } },
        () => console.log(T.bundleWrote(r.file, r.modules, Math.round(r.bytes / 1024)) + "\n" + T.bundleUse(outFile ? r.file : null)));
    }

    case "statusline": // --print-config (the render path runs before the flag checks, in main)
      return on("print-config") ? statusLineConfig() : statusLineRender();

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

// ---- merge-state (1.21 F1a) -------------------------------------------------------------------------------------------------
// The driver git runs on a .state.json / roadmap.json both branches changed (and on the generated overviews): the three files git
// hands it (%O %A %B, relative to its cwd — the top of the work tree), the merge written into <ours>. Messages in the project
// language; stdout stays empty unless --json (git shows a driver's output as it runs).
function mergeStateRun(baseF, oursF, theirsF, rel) {
  const M = spec.msg(spec.projectLang(projectDir)).mergeState;
  const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
  const oursText = read(oursF), theirsText = read(theirsF);
  if (oursText == null || theirsText == null) die(M.unreadable(oursText == null ? oursF : theirsF));
  const r = spec.mergeStateText(read(baseF) || "", oursText, theirsText, { path: rel, kind: flags.kind });
  if (r.kind === "generated") {
    // Both sides dev-spec's own output: ours stays (the next dev-spec write regenerates it from the merged state). A hand-written
    // overview (no AUTO-GENERATED marker): git's own text merge, in place — its exit status is the number of conflicts.
    if (r.keepOurs) return flags.json ? console.log(JSON.stringify({ ok: true, kind: r.kind, kept: "ours" }, null, 2)) : undefined;
    let g;
    try { g = spawnSync("git", ["merge-file", "-L", "ours", "-L", "base", "-L", "theirs", oursF, baseF, theirsF], { encoding: "utf8", windowsHide: true, timeout: 30000 }); } catch (e) { g = { error: e }; }
    const ran = !!g && !g.error && Number.isInteger(g.status) && g.status >= 0;
    process.exitCode = ran && g.status === 0 ? 0 : 1;
    // 1.23 review (L13): --json printed nothing here — the result of git's text merge (conflicts = its count of conflict hunks)
    if (flags.json) console.log(JSON.stringify(ran ? { ok: true, kind: r.kind, merged: "text", clean: g.status === 0, conflicts: g.status }
      : { ok: false, kind: r.kind, merged: "text", error: String((g && g.error && g.error.message) || "git merge-file: exit " + (g && g.status)) }, null, 2));
    return;
  }
  if (!r.ok) { // ours left as it is — with --json (1.23 review L13) the refusal is the JSON document on stdout too
    const msg = M.parseError(r.parseError, r.error);
    console.error(msg);
    if (flags.json) console.log(JSON.stringify({ ok: false, kind: r.kind, parseError: r.parseError, error: msg }, null, 2));
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(oursF, r.text);
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, kind: r.kind, clean: r.clean, conflicts: r.conflicts }, null, 2));
    if (!r.clean) process.exitCode = 1;
    return;
  }
  if (r.clean) return;
  const show = (v) => { if (v === undefined) return M.absent; const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 59) + "…" : s; };
  console.error(M.conflictHead(rel || oursF, r.conflicts.length));
  r.conflicts.slice(0, 20).forEach((c) => console.error(M.conflictLine(c.path || "(root)", show(c.ours), show(c.theirs), show(c.base))));
  if (r.conflicts.length > 20) console.error("  …");
  console.error(M.conflictTail);
  process.exitCode = 1;
}
// merge-state --install / --uninstall: the .gitattributes lines (in the project folder — its patterns are relative to it; commit
// it) and this clone's git config (merge.dev-spec-state.name / .driver — per clone, never committed). Nothing without git.
function mergeDriverSetup(uninstall) {
  const M = spec.msg(spec.projectLang(projectDir)).mergeState;
  const git = (args) => {
    try { return spawnSync("git", args, { cwd: projectDir, encoding: "utf8", windowsHide: true, timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }); } catch (e) { return { error: e }; }
  };
  const top = git(["rev-parse", "--show-toplevel"]);
  if (!top || top.error || top.status !== 0) return fail({ ok: false, error: M.noGit(projectDir) });
  const file = path.join(projectDir, ".gitattributes");
  let before = "";
  try { before = fs.readFileSync(file, "utf8"); } catch { before = ""; }
  const a = spec.mergeAttributes(before, uninstall);
  if (a.changed) {
    if (a.text) fs.writeFileSync(file, a.text);
    else fs.rmSync(file, { force: true }); // it held only the driver's lines
  }
  const key = "merge." + spec.MERGE_DRIVER;
  const driver = mergeDriverCommand();
  const config = [];
  if (uninstall) {
    const r = git(["config", "--remove-section", key]); // exit 128: no such section — nothing to remove
    if (r && !r.error && r.status === 0) config.push({ removed: key });
  } else {
    for (const [k, v] of [[key + ".name", "dev-spec: semantic merge of the spec state (.state.json, roadmap.json)"], [key + ".driver", driver]]) {
      const r = git(["config", k, v]);
      if (!r || r.error || r.status !== 0) return fail({ ok: false, error: M.configFailed(String((r && (r.stderr || (r.error && r.error.message))) || "?").trim()) });
      config.push({ key: k, value: v });
    }
  }
  const res = { ok: true, action: uninstall ? "uninstall" : "install", attributes: { file, changed: a.changed, lines: a.lines }, config };
  return out(res, () => {
    if (uninstall) {
      console.log(a.changed ? M.attrsRemoved(file) : M.attrsNone(file));
      config.forEach((c) => console.log(M.configRemoved(c.removed)));
      return;
    }
    console.log(a.changed ? M.attrsAdded(file) : M.attrsKept(file));
    if (a.changed) a.lines.forEach((l) => console.log("  " + l));
    config.forEach((c) => console.log(M.configSet(c.key, c.value)));
    console.log(M.teamNote);
  });
}
// The command git runs (sh -c, Git's own sh on Windows): this clone's CLI by its absolute path, forward slashes, single-quoted.
function mergeDriverCommand() {
  const cli = path.resolve(__filename).replace(/\\/g, "/");
  return "node '" + cli.replace(/'/g, "'\\''") + "' merge-state %O %A %B %P";
}
// merge-state --check (1.21 review A3): the configured driver (`git config --get merge.dev-spec-state.driver`, read only) against
// THIS clone's CLI and the project's .gitattributes (spec.mergeDriverStatus). Exit 0: it runs this clone's CLI, or nothing names
// the driver (nothing to check) · 1: it runs another or a missing script (a plugin update moved the plugin — git then drops
// theirs' changes), .gitattributes names it while this clone has none, or not inside a git repository.
function mergeDriverCheck() {
  const M = spec.msg(spec.projectLang(projectDir)).mergeState;
  const git = (args) => {
    try { return spawnSync("git", args, { cwd: projectDir, encoding: "utf8", windowsHide: true, timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }); } catch (e) { return { error: e }; }
  };
  const top = git(["rev-parse", "--show-toplevel"]);
  if (!top || top.error || top.status !== 0) return fail({ ok: false, error: M.checkNoGit(projectDir) });
  const got = git(["config", "--get", spec.MERGE_DRIVER_KEY]); // exit 1: not set
  const driver = got && !got.error && got.status === 0 ? String(got.stdout || "").trim() : null;
  const s = spec.mergeDriverStatus(projectDir, { driver, cli: path.resolve(__filename) });
  const res = { ok: true, action: "check", status: s.status, current: s.status === "ok", named: s.named, attributes: s.attributes, driver: s.driver, script: s.script, cli: s.cli };
  if (!["ok", "none"].includes(s.status)) process.exitCode = 1;
  return out(res, () => {
    if (s.status === "ok") console.log(M.checkOk(s.script));
    else if (s.status === "none") console.log(M.checkNone);
    else if (s.status === "not-installed") console.log(M.checkNotInstalled(s.attributes));
    else if (s.status === "missing") console.log(M.checkMissing(s.script));
    else console.log(M.checkOther(s.script || s.driver, s.cli));
  });
}

// 1.14 F5 — `trace <f> --matrix`: the requirements traceability matrix as a table (localized headers and notes; IDs as written).
function printMatrix(feature, mx, lang) {
  const R = spec.msg(lang).rtm;
  const C = R.cli;
  console.log(C.head(feature, mx.tracks, mx.counts));
  const a = mx.approval;
  const when = (iso) => (typeof iso === "string" && iso.length >= 16 ? iso.slice(0, 16).replace("T", " ") + " UTC" : "—");
  const plan = mx.kind === "change"; // 1.21 review C5: a change's criteria are signed off with its plan (change.md)
  console.log("  " + (a ? (plan ? C.planApproved : C.approved)(when(a.at), a.by == null ? "—" : a.by, a.forced) : plan ? C.planNotApproved : C.notApproved));
  if (!mx.rows.length) return console.log("  " + R.none);
  const len = (s) => [...s].length;
  const cut = (s, n) => (len(s) > n ? [...s].slice(0, n - 1).join("") + "…" : s);
  const task = (t) => "#" + t.number + (!t.done ? "○" : t.verified ? "✓" : "▲");
  const test = (t) => t.id + (t.outsideCode ? "○" : Array.isArray(t.files) ? (t.files.length ? "✓" : "✗") : "");
  const rows = mx.rows.map((r) => {
    const notes = r.gaps.map((g) => R.gap[g === "no-coverage" && r.kind === "sc" ? "no-coverage-sc" : g] || g);
    if (r.template) notes.push(C.notes.template);
    if (r.supersededBy.length) notes.push(r.supersedePending ? R.toBeSupersededBy(r.supersededBy.join(", ")) : C.notes.superseded(r.supersededBy.join(", "))); // 1.15: a draft's is pending
    if (r.approval && r.approval.changed === true) notes.push(C.notes.changed);
    return [r.id, R.status[r.status] || r.status, r.tasks.map(task).join(" ") || "—", r.tests.map(test).join(" ") || "—",
      r.decisions.map((d) => d.id).join(" ") || "—", (notes.length ? "[" + notes.join("; ") + "] " : "") + r.text];
  });
  const head = ["id", "status", "tasks", "tests", "decisions", "requirement"].map((c) => R.cols[c]);
  const widths = head.slice(0, 5).map((h, i) => Math.min(28, Math.max(len(h), ...rows.map((r) => len(r[i])))));
  const line = (cells) => "  " + cells.slice(0, 5).map((c, i) => { const x = cut(c, widths[i]); return x + " ".repeat(widths[i] - len(x)); }).join("  ") + "  " + cut(cells[5], 110);
  console.log(line(head));
  rows.forEach((r) => console.log(line(r)));
  console.log("  " + C.legend + (mx.code ? " · " + C.codeLegend : ""));
}

function helpText() {
  return `dev-spec — universal spec-driven CLI (local, zero-dependency)

  classify "<description>" [--name "<feature>"]   Recommend tracks (core/+tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data), multilingual
                                  --explain: every keyword match (table tier → final tier, cue / override, negation) + the
                                  project's signal overrides
  init [tracks...] [--lang]       Scaffold .specs/steering (--lang en|pt|pt-BR|es → project default)
                                  --guard on|off|scope: guard mode — Write/Edit on code files asks while no feature has approved, open tasks
                                  (scope: once tasks are approved, also a code file no open task names in _Implements:_ — test files excepted)
                                  --stop-check on|off: the end-of-turn evidence gate (roadmap.json meta.stopCheck, on by default)
                                  --evidence reported|observed: the evidence mode (roadmap.json meta.evidence; reported by default) —
                                  observed: a runnable _Verify:_ is verified only by a run the harness saw (the plugin's Bash hook in
                                  Claude Code) or that done --run / finish --run made
                                  --check name="cmd" (repeatable; name= removes one): the project's check commands (roadmap.json
                                  meta.checks, e.g. --check test="npm test" --check lint="npm run lint") — in every brief's definition of done
                                  --roles requirements=product,design=tech+security: approvals by role (a listed phase is approved once
                                  every role signed its current content); --roles none clears them
                                  --approval-guard off|ask|deny: the human approval guard — an agent's approve (MCP or this CLI through
                                  its shell tool), feature remove --yes or lowering this guard asks you (ask) or is refused (deny)
  steering <file> [--lang]        Create one steering file from its template (constitution.md, tech.md, glossary.md — the terms to
                                  use and the words to avoid (_Avoid:_), …) — any other
                                  name like api-rules.md → a custom scoped file (front matter inclusion: always|fileMatch|manual)
  templates [list|init|check] [artifact] [--lang]   The project's own scaffolds: .specs/templates/<artifact>.md (<lang>/ wins)
                                  replace the built-in ones for new features / steering; init copies the built-in ones to
                                  edit; check validates them (exit 1 on an error)
  tracks [list|init <name>|check] [name] [--lang]   The project's own tracks: a pack .specs/tracks/<name>/ (track.json +
                                  fragments) is a marker track like +sec — classified, scaffolded, gated; init scaffolds
                                  one; check validates them (exit 1 on an error)
  signals [list | set <track> <word> off|weak|strong | forget <track> <word>]   The classifier's signal overrides of this
                                  project (.specs/classifier.json): create learns them from Phase 0 corrections (a word
                                  that drove a suggestion you changed — applies after 2 consistent corrections); set one by
                                  hand (applies at once), forget one (= spec_tracks {action: "signals"})
  create "<name>" [tracks...]     Scaffold a feature folder (auto-classifies if no tracks; --summary, --kind feature|bugfix|spike|change, --size xs|s|m|l, --lang en|pt|pt-BR|es)
                                  --brownfield also scaffolds integration-plan.md (a feature landing in an existing codebase);
                                  --flow design-first: classification → design → requirements → … (starts from an architecture)
  bugfix "<name>" [--summary]     Scaffold the bugfix flow: bug.md (repro · root cause · fix) + regression test plan
                                  --reproduction "…" --root-cause "…" --condition "…" --behaviour "…" prefill bug.md and the
                                  IF … THEN criterion (a text left out stays a slot); --include-body: the bodies in --json
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
                                  --matrix: + the requirements traceability matrix — one row per AC / EC / NFR / SC with its
                                  status (verified · implemented · planned · untraced), tasks, tests, evidence, decisions, approval;
                                  --csv: the matrix as RFC 4180 CSV on stdout (formula-safe; exit code still = trace gaps)
  clarify <feature>               Surface ambiguities/gaps in requirements before design
  ears <feature|file.md>          Lint EARS (SHALL/DEVE/DEBE, IDs, vague words);
       ears --text "…" | ears -   … or raw text / stdin (same as ears_validate {text})
  next <feature> [--batch]        Next task whose _Depends:_ are all done (--batch: + the [P] tasks that can run beside it; --max N, default 3);
                                  --waves: the execution waves of every open task (dependencies done or in earlier waves, no shared
                                  _Implements:_ file), + dependency cycles and blocked tasks
  next-action <feature>           "You are here → do this next" (+ what changed since approval); alias: na
  brief <feature> [n] [--write]   Self-contained brief for task n (default: next open) — ACs, tests, design, DoD;
                                  --write → .specs/<feature>/.execution/task-<n>-brief.md (subagent execution)
  done <feature> <n> [--run]      Mark task n complete; --run executes its _Verify:_ command(s) first and records the evidence
                                  (a failure leaves it open; --shell bash|pwsh|<path> or DEV_SPEC_SHELL picks the shell — bash = Git Bash on
                                  Windows, never WSL's launcher; pwsh / powershell = PowerShell, run -NoProfile -NonInteractive -Command; --timeout <s>;
                                  a command that could not run records nothing); or --evidence "…" [--exit N] [--cmd "…"]
                                  A task marked _Expect: fail_ needs a FAILING run (its red test — a pass is refused); --run also
                                  records the git commit (and whether the tree was dirty) when git is available
  undone <feature> <n> [--reason "…"]   Untick task n (ticked by mistake, or its work turned out incomplete): its evidence turns
                                  stale (a re-tick needs a new run), ticks[n] is dropped, .state.json unticks records it
  finish <feature> [--write] [--include-body] [--run]   Readiness report + merge summary from the spec chain (exit 1 if not ready);
                                  --write → .execution/merge-summary.md, --include-body also prints/returns the summary;
                                  --run [--shell bash|pwsh|<path>] runs the project checks (meta.checks) and records them — with meta.checks
                                  set, finish needs a passing run of each since the last task activity
  append-tasks <feature> --task "…"   Append one task to tasks.md, numbered after the last (default phase 'Phase: Convergence'):
                                  --req US-1.AC-2[,…] (must exist) · --implements path[,…] · --verify "<cmd>" · --story US1|shared · --parallel · --heading "…"
                                  · --makes-green T-01[,…] (planned in test-plan.md) · --expect-fail (_Expect: fail_) · --size XS|S|M|L|XL
                                  · --depends 3,5 (_Depends:_ — task numbers of this tasks.md; must exist, no cycle)
  approve <feature> <phase> [--force]  Record a phase approval (.state.json) — refused while that phase's checks fail;
                                  --force records it anyway (flagged as forced, with the failing checks); --role ROLE signs off as
                                  that role (required for a phase init --roles lists); with --force, --reason "…" and
                                  --expires YYYY-MM-DD|30d record its waiver (doctor warns waiver-expired once it lapses)
  approve <feature> <phase> --revoke [--reason "…"]   Revoke a phase approval (and the role sign-offs waiting for it): the
                                  phase is pending again; later phases stay approved (never cascades)
  approve <feature> --through <phase>  Fast-forward (/spec-ff): approve every active phase up to <phase>, in order, each through its
                                  own gate — stops at the first refused gate (exit 1) or a phase still waiting for another role
  impact <feature> [--phase p] [--reopen]   What an edit after approval touches, against the approved snapshot
                                  (--phase requirements|design|test-plan|eval-plan|tasks, default requirements): changed ACs/sections/tests/tasks →
                                  tasks, tests, design; --reopen unticks the affected done tasks and marks their evidence stale
                                  (never a removed criterion's tasks — retire lists them and their test rows to delete or repoint)
  impact [feature] --phase steering   Every active feature (or the one named) whose requirements / design approval was made under
                                  a steering file (constitution, the tracks' files, always / matching fileMatch ones) that changed
                                  since — read-only; re-review, then re-approve (the approval records the current steering)
  metrics [feature] [--write]     Lead times, rework, forced approvals, change requests, evidence pass rate, velocity (project: + avg/median);
                                  --write → .specs/<feature>/retro.md (a pre-filled retrospective, never overwritten)
  add-track <feature> <track...>  Escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data (additive, never overwrites);
                                  --remove turns a track off (non-destructive: files kept, listed as inactive);
                                  a project track pack (dev-spec tracks) is named the same way
  feature <remove|archive|rename|restore> <name> [new-name]   Manage a feature's lifecycle (remove shows what it would delete; --yes deletes;
                                  restore brings an archived feature back with its roadmap entry and dependencies)
  feature flow <name> <requirements-first|design-first>   Set a feature's phase order (a bugfix keeps its own)
  catalog [--write]               Living catalog: every feature's ACs, superseded ones marked (_Supersedes:_); --write → .specs/SPECS.md
  export [feature] [--md] [--write]   One printable document for stakeholders — a feature (stories + EARS ACs, design, test plan,
                                  tasks with their verification, approvals, open clarifications) or, without one, the whole project;
                                  offline HTML (light/dark, print-ready) or --md; --write → .specs/exports/<feature|project>.html|.md
                                  --csv: the traceability matrix for a spreadsheet (UTF-8 BOM, the AUTO-GENERATED marker as its
                                  last record) → --write: .specs/exports/<feature|project>.rtm.csv
                                  --gherkin: a BDD .feature — one Scenario per current AC (tags @US-n.AC-m @T-xx @<track>), its EARS
                                  clauses as Given (WHILE/WHERE/IF) · When (WHEN) · Then (SHALL), PT/ES in Gherkin's own dialect;
                                  no feature = one file per feature → --write: .specs/exports/<feature>.feature
                                  --tracker jira|linear: a CSV for the tracker's own importer (nothing is sent) — the feature as the
                                  parent, its stories, its tasks under their [USn] story; labels = slug, tracks, AC IDs
                                  → --write: .specs/exports/<feature|project>.<tracker>.csv
  changelog [--since d] [--write] Release notes from the specs: Added (shipped features + their ACs) · Changed (superseded ACs,
                                  change requests) · Fixed (bugfixes + root cause); --since <ISO date|last|all> (default: since the
                                  last written notes); --write → .specs/RELEASE-NOTES.md and stamps meta.changelogAt
                                  --milestone <name>: only that milestone's features (since: all by default) → --write:
                                  .specs/RELEASE-NOTES.<milestone>.md (meta.changelogAt untouched)
  milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list]   Milestones (roadmap.json meta.milestones): a target date
                                  for a set of features, judged against their ETAs — on-track · at-risk · late · done; add replaces
                                  an existing one; rename / remove / archive of a feature follow; ROADMAP.md shows them
  drift [feature]                 Implementing files changed / missing / new since finish recorded its baseline (exit 1 on drift or a stale baseline)
  stop-check [--message "<text>"|-] [--agent <type>]   The Stop hook's evidence gate: does a closing message claim done /
                                  verified (EN/PT/ES) while a feature active in the last hours has ticked tasks without verification
                                  evidence? Prints the reason it would send the turn back (exit 1) or why it lets it end; - reads stdin;
                                  --agent spec-implementer checks the task report named in the message instead,
                                  --agent spec-simplifier the simplification report (its last '## Final runs' must all pass)
  log <feature> [--max N] [-]     Per task, the commits whose message cites it — "task #N" / "#N" with the feature name (as /spec-commit
                                  writes "Part of .specs/<feature>/ task #N."), or its T-/AC IDs ("Makes T-01 green") — and, +tdd, a
                                  red-first check (implementation committed before its test?); reads git log (read-only, local, --max
                                  commits, default 1000); - reads a log from stdin (git log --name-only --relative)
  merge-state [--install|--uninstall|--check] [--project <dir>]   Teams: git merges the spec state SEMANTICALLY — .gitattributes
                                  (commit it) + this clone's git config (merge.dev-spec-state.driver; every teammate runs it once, and
                                  again after each plugin update — the driver names this clone's path); --uninstall removes both;
                                  --check (read-only): exit 1 when the configured driver runs another or a missing script, or when
                                  .gitattributes names the driver and this clone has none.
                                  Git then runs merge-state <base> <ours> <theirs> <path> on .state.json / roadmap.json: approvals,
                                  ticks, evidence and history of both branches are united; a real conflict (a meta value both sides
                                  set differently) exits 1 with ours kept and the file listing it under "mergeConflicts" (valid
                                  JSON; doctor fails merge-conflicts until it is resolved); ROADMAP.md / SPECS.md keep ours
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
  import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path>   Import another tool's spec as a NEW feature (IDs → US-N.AC-M, scenarios → EARS,
                                  tasks renumbered, checkbox state kept); --name <feature> · --lang en|pt|pt-BR|es · --tracks tdd,saas,ai,sec,privacy,dist,api,ui,obs,data
                                  plan = Claude Code plan mode / Cursor .cursor/plans, execplan = a Codex ExecPlan (PLANS.md),
                                  bmad = BMAD-METHOD docs (prd.md + docs/stories/), fluidplan = a fluidplan plan (.fluidplan/<id>/:
                                  plan.json + answers.json, PLAN.md + DECISIONS.md → tasks, criteria, decisions.md)
  import <plan|execplan|fluidplan> - | --text "<markdown>"   The same from the document's text: - reads stdin (dev-spec import plan - < plan.md),
                                  --text takes it inline — for a plan outside the project (Claude Code keeps plans in ~/.claude/plans)
  statusline [--print-config]     One line for Claude Code's status line: the most active feature, its tasks, unverified ticks, the next
                                  step (reads the session JSON on stdin; nothing outside a dev-spec project; exit 0 always);
                                  --print-config prints the settings.json "statusLine" snippet with this clone's path
  evals <feature> [--dry-run]     Run the local eval harness (+ai; your ANTHROPIC_API_KEY) — every flag reaches it wherever it
                                  stands (--set-baseline, --require-live, --model ID, --prompt FILE, --max-items N); an unknown
                                  one or a second word exits 2 with nothing run; evals --help prints the harness's usage
  mcp-config [client]             Print ready MCP config: claude-desktop|claude-code|cursor|windsurf|vscode|gemini|codex|generic|all
  rules <tool>                    Print a rule file (cursor|windsurf|copilot|gemini|agents) with this clone's absolute paths
  prompts [name] [--args "…"]     The MCP prompts (one per plugin command — slash commands in MCP clients): list them, or print
                                  one rendered as prompts/get returns it ($ARGUMENTS ← --args, or the words after the name)
  bundle [--out <file.js>]        Build this clone's engine as ONE file (mcp/lib/spec.bundle.js, git-ignored) for a slow file
                                  system (Docker bind mount, network drive, WSL /mnt/c): set DEV_SPEC_BUNDLE=1 (with --out, also
                                  DEV_SPEC_BUNDLE_PATH=<file>); rebuild after every plugin update — a stale bundle is ignored

  The project: --project <dir> (an existing folder — only init creates one) > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest
  folder at or above the working one that holds a dev-spec .specs/ > the working folder. A path argument (scan, ears, import) is
  relative to the project when it was named (--project or the environment), else to the working folder.
  Each command takes its own options and arguments: another option, or one argument too many, is a usage error (exit 1).

  Flags: --json  --project <dir>  --lang en|pt|pt-BR|es (init/create/bugfix/spike/steering/roadmap/ears/classify/import/templates/tracks/signals)  --order N (depend)
         --name "<feature>" (classify)  --summary "…"  --kind feature|bugfix|spike|change / --size xs|s|m|l (create; spike: --question, --timebox)  --text "…" (ears)
         --batch  --max N (next)  --write / --include-brief (brief)  --write / --include-body (finish)
         --yes (feature remove)  --write|--md / --html (roadmap)  --cap N (scan)  --by NAME / --force (approve)
         --role ROLE / --through PHASE (approve)  --roles phase=role+role,… | none (init)
         --revoke / --reason "…" / --expires YYYY-MM-DD|Nd (approve)  --reason "…" (undone)
         --brownfield / --flow design-first (create)  --flow (feature flow)  --name (import)  --tracks tdd,saas (import/create/init/add-track, beside positional tracks)
         --apply (upgrade)  --args "…" (prompts)  --check name="cmd" (init)  --run / --shell (done, finish)  --max N (next, log)
         --md / --write (export)  --since <ISO date|last|all> / --write (changelog)
         --text "<markdown>" (import plan|execplan|fluidplan)  --print-config (statusline)  --install / --uninstall / --check (merge-state)
         --guard on|off|scope / --stop-check on|off / --approval-guard off|ask|deny / --evidence reported|observed (init)  --message "…" / --agent <type> (stop-check)
         Value flags need a value (--flag value or --flag=value); a following --flag is not one.
         Switches: --flag, or --flag=true|false (1/0, yes/no, on/off; anything else is an error).
         With --json a refused operation still prints its result ({"ok": false, "error": …}) on stdout, exit 1 — a usage error
         or an unexpected failure too ({"ok": false, "error": …[, "code": …]}).
         help, rules, mcp-config and evals print text only: --json there is a usage error (exit 1).
         --shell / --timeout go with --run (done, finish); --run and --evidence / --exit / --cmd exclude each other (done);
         --timeout stops the command's whole process tree.

  Works the same in Claude Code, Cursor, Windsurf, Copilot, Gemini/Codex CLI, or a plain shell.`;
}

// Engine guards (e.g. an unreadable roadmap.json) surface as a one-line error, not a stack trace — with --json (1.23 review L24)
// also as {ok: false, error, code} on stdout (code: the system error's, e.g. ENOTDIR, else "exception").
main().catch((e) => die(e && e.message ? e.message : String(e), { code: e && typeof e.code === "string" && e.code ? e.code : "exception" }));

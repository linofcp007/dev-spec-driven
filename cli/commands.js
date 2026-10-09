"use strict";

/**
 * The dev-spec CLI's commands (1.27) — ONE table, `COMMANDS`: each entry is a whole command —
 *
 *   name, aliases      the word that runs it (`na` → next-action, `milestones` → milestone)
 *   options            the flags it reads, in its help's order (a flag every command knows aside: GLOBAL_OPTIONS). A VALUE flag
 *                      (the parser reads the word after it) is one of VALUE_FLAG_SPECS below; any other name is a switch of the
 *                      engine's spec.CLI_SWITCHES (the approval hook's lexer reads that list — a new switch goes THERE).
 *                      Absent: the command checks nothing itself (evals hands every flag to run-evals.js; help).
 *   max                the most positional arguments it takes (absent: any number, or its handler checks them)
 *   bounds             the largest value of an integer flag (next --max ≤ 8, --timeout ≤ TIMEOUT_MAX_S) — read by c.intFlag()
 *   args, sub          shell completion (cli/completion.js): what each positional is, per position — words, or a source:
 *                      @feature / @archived (the project's feature names, read on Tab), @command, @file, @dir, or a value list
 *                      completionModel() names (@track, @phase…); null offers nothing there, a trailing "..." repeats the last.
 *                      `sub`: the positions after a first word that picks them (feature restore → archived names)
 *   values             shell completion of a flag's values for THIS command (init --evidence is a mode, done --evidence a
 *                      summary); the values a flag takes for every command are VALUE_FLAG_SPECS' own
 *   text               it prints text only: --json there is a usage error (TEXT_ONLY_COMMANDS)
 *   help               its lines of `dev-spec help`, as printed — the synopsis at two spaces, the description from column 35
 *                      (`help <command>` / `<command> --help` print them with its options)
 *   run(c)             the handler — c is the call's context (cli/main.js createContext): flags, pos, projectDir, out / fail /
 *                      die / usage, log / err / write… It returns nothing, or a promise when it waits (a run, stdin).
 *
 * Everything else is DERIVED from it: VALUE_FLAGS, REPEATABLE_FLAGS, COMMAND_OPTIONS, COMMAND_ARGS, FLAG_VALUES,
 * TEXT_ONLY_COMMANDS, HELP_ALIASES, the help (helpText / helpFor) and the completion scripts' model (completionModel) — a new
 * command is one entry (docs/maintainers/extending.md); cli/tests/16-conventions-cli-modules.js checks every entry has its help
 * and completes. cli/main.js parses the command line, runs the checks every command shares and dispatches here.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const COMPLETION = require(path.join(__dirname, "completion.js")); // 1.25: `completion <shell>` (and the hidden __complete)
const RUN = require(path.join(__dirname, "run.js")); // done --run / finish --run: the user's commands, their process tree
const GIT = require(path.join(__dirname, "git.js")); // every git call the CLI makes

// 1.25.1 (review 7): the engine (~36 modules — ~80 ms of a ~140 ms run) loads on its first use, never at load: the status line
// outside a dev-spec project (Claude Code runs it after every message, in every folder, once it is installed user-wide) and the
// bare help print without it. `spec.x` reads through this proxy; the first read loads the facade.
let SPEC = null;
const loadSpec = () => SPEC || (SPEC = require(path.join(__dirname, "..", "mcp", "lib", "spec.js")));
const spec = new Proxy({}, { get: (_, k) => loadSpec()[k], has: (_, k) => k in loadSpec() });

const CLI_FILE = path.join(__dirname, "dev-spec.js"); // the entry point: what the printed lines, the status line and git's merge driver run
const CLI_PATH = CLI_FILE.replace(/\\/g, "/"); // forward slashes (the help's completion install lines, version, completion)
const SERVER = path.resolve(__dirname, "..", "mcp", "server.js");
const EVALS = path.resolve(__dirname, "..", "mcp", "evals", "run-evals.js");

// 1.24 r6 B6 — done --run / finish --run --timeout <seconds>: at most Node's timer limit (2^31 - 1 ms) — a larger value became a
// TimeoutOverflowWarning and a timer of 1 ms: the run was refused as "did not finish within --timeout 9999999 s".
const TIMEOUT_MAX_S = Math.floor(2147483647 / 1000);
// 1.25.1 (review 7): next --max — spec_next_task's schema maximum (8): --max 50 exited 0 and the engine clamped it to 8 silently,
// where MCP refuses max: 9.
const NEXT_MAX = 8;

// ---- the value flags -----------------------------------------------------------------------------------------------------------
// Every flag that takes a value, as `--flag value` or `--flag=value` (any other `--flag` is a switch — `depend a b --order 3` no
// longer turns "3" into a dependency). A value flag takes ONE word and never swallows the next flag (`--order --json` is a missing
// value). In this order (the did-you-mean of an unknown flag prefers the first of equally near ones). Each: `values` — what shell
// completion offers after it for every command (a command's own: its entry's `values`); `repeatable` — a command reads EVERY
// occurrence (any other given twice is a usage error, 1.24 r6 B5); `optional` — its value may be left out (1.25 create / bugfix /
// spike --branch [<name>]: a bare --branch, the last word or a flag after it, is true — the default name).
const VALUE_FLAG_SPECS = [
  ["project", { values: "@dir" }], ["lang", { values: "@lang" }], ["order"], ["cap"], ["by"], ["summary"], ["kind"], ["max"], ["evidence"], ["exit"], ["cmd"],
  ["shell", { values: "bash pwsh powershell cmd" }], // done --run --shell bash|pwsh|<path>
  ["add", { repeatable: true }], ["rm", { repeatable: true }], // depend <f> --add x[,y] --rm x[,y]
  ["name"], // classify --name <feature name> (evidence for the classifier, like spec_classify {name}); import --name
  ["text"], // ears --text "<criteria>" (raw text, like ears_validate {text}); import --text
  ["args"], // prompts <name> --args "…" (= MCP prompts/get {arguments: {args}})
  // --tracks tdd,saas = the MCP `tracks` argument (import, create/bugfix, init, add-track). It takes ONE token: `--tracks saas ai`
  // leaves "ai" positional, so every command that takes tracks merges the flag with its positional tracks (c.withTracksFlag).
  ["tracks", { values: "@track" }],
  // append-tasks <f> --task "<text>" [--req ids] [--implements paths] [--verify "<cmd>"] [--makes-green T-01] [--size M] [--story US1] [--heading "<phase>"]
  ["task"], ["req", { repeatable: true }], ["implements", { repeatable: true }], ["verify"], ["story"], ["heading"], ["makes-green", { repeatable: true }], ["size"],
  ["timeout"], // done --run / finish --run --timeout <seconds> (full review Ga10): a run past it is could-not-run, nothing recorded
  ["phase", { values: "requirements design test-plan eval-plan tasks steering" }], // impact [f] --phase … (1.16: steering needs no feature)
  ["guard", { values: "on off scope" }], // init --guard on|off|scope (= spec_init {guard: true|false|"scope"})
  ["stop-check", { values: "on off" }], ["message"], ["agent"], // 1.14 C1: init --stop-check on|off · stop-check --message "…" --agent <type>
  ["check", { repeatable: true }], // init --check name="cmd" (repeatable; name= removes) = spec_init {checks: {name: cmd}}
  ["approval-guard", { values: "@approval-guard" }], // 1.14 F2: init --approval-guard off|ask|deny (= spec_init {approvalGuard})
  ["roles"], ["role"], ["through", { values: "@through" }], // init --roles …, approve --role <role> / --through <phase>
  ["since", { values: "last all" }], // changelog --since <ISO date|last|all>
  ["tracker", { values: "@tracker" }], // 1.16 E2: export [f] --tracker jira|linear
  ["milestone"], // 1.16 E3: changelog --milestone <name>
  ["flow", { values: "@flow" }], // create --flow design-first · feature flow <name> --flow <flow> (C3)
  // 1.14 C2: spike / create --kind spike --question … --timebox … · decide <f> --title … --decision … [--context …] [--consequences …] [--affects …] [--supersedes …]
  ["question"], ["timebox"], ["title"], ["decision"], ["context"], ["consequences"], ["affects", { repeatable: true }], ["supersedes", { repeatable: true }],
  ["depends", { repeatable: true }], // 1.14 F3: append-tasks --depends 3,5 (repeatable)
  ["reason"], ["expires"], // 1.16 U: undone --reason · approve --revoke --reason · approve --force --reason --expires
  ["out", { values: "@file" }], // 1.20: bundle --out <file.js>
  ["reproduction"], ["root-cause"], ["condition"], ["behaviour"], // 1.21 F3: bugfix <name> --reproduction "…" … (= spec_create's bugfix prefill)
  // 1.25: create / bugfix / spike --branch [<name>] (= spec_create {branch}) — --branch=<name> / --branch <name> names it; a spaced name
  // that is a track word (`create x --branch tdd`) is refused as ambiguous (branchFlag)
  ["branch", { optional: true }],
];
const VALUE_FLAG_SPEC = new Map(VALUE_FLAG_SPECS.map(([k, o]) => [k, o || {}]));
const VALUE_FLAGS = new Set(VALUE_FLAG_SPEC.keys());
const REPEATABLE_FLAGS = new Set(VALUE_FLAG_SPECS.filter(([, o]) => o && o.repeatable).map(([k]) => k));
const OPTIONAL_VALUE_FLAGS = new Set(VALUE_FLAG_SPECS.filter(([, o]) => o && o.optional).map(([k]) => k));
// A flag every command knows (its own options aside).
const GLOBAL_OPTIONS = ["json", "project", "help"];
// `dev-spec evals` (1.23 review P1): the flags run-evals.js reads — its value flags (they take the next word unless it is a flag) and its
// switches — for evalsArgs and the completion script.
const EVALS_VALUE_FLAGS = new Set(["project", "model", "prompt", "max-items"]);
const EVALS_SWITCHES = ["dry-run", "set-baseline", "require-live"];

// ---- shared by several commands ------------------------------------------------------------------------------------------------
// The commands' language: the feature's for feature commands, the project's otherwise (--json prints the structured result, never
// localized) — c.cliText(lang) / c.featureText(name) / c.projectText() (cli/main.js).

// One config block per client (their names are the completion script's mcp-config values too).
function mcpConfigBlocks() {
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
  return blocks;
}
// `rules <tool>`: the rule file each tool reads, in this clone (printed with its paths made absolute).
const RULE_FILES = {
  cursor: ".cursor/rules/dev-spec-driven.mdc",
  windsurf: ".windsurf/rules/dev-spec-driven.md",
  copilot: ".github/copilot-instructions.md",
  gemini: "GEMINI.md",
  agents: "AGENTS.md",
};

// `list` and a bare `status`: one line per feature, in the project language.
function main2list(c) {
  const r = spec.listFeatures(c.projectDir);
  const T = c.projectText();
  c.out(r, (r) => {
    if (!r.exists || !r.features.length) return c.log(T.noFeatures(r.specsDir));
    r.features.forEach((f) => c.log(T.listLine(f.name, f.tracks, T.phase(f.phase), f.tasksDone, f.tasks)));
  });
}

// full review Ga9: the shell of done --run / finish --run — --shell > DEV_SPEC_SHELL > the platform default, resolved by the engine
// (a bare `bash` on Windows → Git Bash, found through `git --exec-path` (read-only), %ProgramFiles% or PATH; WSL's bash.exe launcher
// only when named by its path; wsl.exe refused — wsl-exe). → spec.resolveRunShell's result. --timeout is checked first.
function runShell(c) {
  c.timeoutFlag(); // --timeout <seconds>: an integer ≥ 1 (≤ TIMEOUT_MAX_S) — refused (exit 1) before anything runs
  const req = (typeof c.flags.shell === "string" && c.flags.shell.trim()) || (c.env.DEV_SPEC_SHELL || "").trim() || "";
  const needsGit = process.platform === "win32" && /^bash(?:\.exe)?$/i.test(req);
  return spec.resolveRunShell(req, { gitExecPath: needsGit ? GIT.gitText(["--exec-path"], { cwd: c.projectDir }) : null });
}

// Every --check occurrence (the shared parser keeps only the last value) → {name: command} (null-prototype: "__proto__" stays a plain
// key the engine refuses), or undefined when none was given.
function checksFlag(c) {
  const vals = c.every("check");
  if (!vals.length) return undefined;
  const checks = Object.create(null);
  for (const v of vals) {
    const eq = typeof v === "string" ? v.indexOf("=") : -1;
    if (eq <= 0) c.die(spec.msg(c.flags.lang || spec.projectLang(c.projectDir)).projectChecks.badArg(String(v)), c.invalidArg("--check"));
    checks[v.slice(0, eq).trim()] = v.slice(eq + 1);
  }
  return checks;
}

// ---- create / bugfix / spike --branch [<name>] (1.25) ------------------------------------------------------------------------
// The feature's own git branch (= spec_create {branch}). The engine never runs git: it validates the name, decides and RECORDS
// `.state.json → branch` {name, base, commit, at}; this CLI reads what git says BEFORE that (cli/git.js branchFacts — inside a work
// tree? the base branch and commit, does the name exist?) and runs the engine's `branch.command` AFTER it (branchSwitch: `git switch
// -c <name>` — or `git switch <name>`, the feature's own branch on a re-run). Never onto a branch the feature doesn't own: one of
// that name that exists already is not recorded and not switched to. Exit 1 whenever the feature does not end up on its branch (not
// a repository, the name exists, git can't run or failed — the feature itself is created all the same; the record stays, with the
// command to run); --json: the engine's result, `branch` + switched / created / error.
// The flag → undefined (absent) · true (bare: the default name) · false (--branch=false) · the name (validated by the engine).
function branchFlag(c) {
  const v = c.flags.branch;
  if (v === undefined || v === true) return v;
  const s = String(v).trim();
  if (/^(?:true|yes|on)$/i.test(s)) return true;
  if (/^(?:false|no|off)$/i.test(s)) return false;
  // `create x --branch tdd`: the word after --branch is read as its value — a track word there was meant as a track
  if (c.branchSpaced && s) { const pt = spec.parseTracks(s); if (pt.given && !pt.unknown.length) c.die(spec.msg(c.flags.lang || spec.projectLang(c.projectDir)).branch.cliTrackWord(s), c.invalidArg("--branch")); }
  return s;
}
// What git says before the engine records anything (cli/git.js branchFacts).
const branchGitFacts = (c) => GIT.branchFacts(c.projectDir);
// After the engine's create: run its branch.command (r.branch.args — git's arguments, never through a shell) → the human line, or
// null. Adds to r.branch: switched (true / false), created (a new branch), current, error (git's first lines); sets exit 1 unless
// the feature ends up on its branch.
function branchSwitch(c, r, git) {
  const b = r.branch;
  if (!b) return null;
  const B = spec.msg(r.lang).branch;
  if (!b.recorded) { c.exitCode = 1; return null; } // not a repository / the name exists: the engine's note says it
  if (!b.command || !Array.isArray(b.args)) {
    if (b.current === b.name) return B.cliOn(b.name);
    c.exitCode = 1;
    return null;
  }
  if (git === undefined) { b.switched = false; b.error = "git"; c.exitCode = 1; return B.cliGitMissing(b.command); }
  const s = GIT.gitRun(b.args, { cwd: c.projectDir });
  if (!s.ok) {
    const why = String(s.stderr || (s.error && s.error.message) || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join(" ").slice(0, 300);
    b.switched = false;
    b.error = why || "exit " + s.status;
    c.exitCode = 1;
    return B.cliFailed(b.command, why);
  }
  b.switched = true;
  b.created = b.args.includes("-c");
  b.current = b.name;
  return b.created ? B.cliCreated(b.name, b.base, b.commit ? b.commit.slice(0, 7) : null) : B.cliSwitched(b.name);
}

// 1.14 F5 — `trace <f> --matrix`: the requirements traceability matrix as a table (localized headers and notes; IDs as written).
function printMatrix(c, feature, mx, lang) {
  const R = spec.msg(lang).rtm;
  const C = R.cli;
  c.log(C.head(feature, mx.tracks, mx.counts));
  const a = mx.approval;
  const when = (iso) => (typeof iso === "string" && iso.length >= 16 ? iso.slice(0, 16).replace("T", " ") + " UTC" : "—");
  const plan = mx.kind === "change"; // 1.21 review C5: a change's criteria are signed off with its plan (change.md)
  c.log("  " + (a ? (plan ? C.planApproved : C.approved)(when(a.at), a.by == null ? "—" : a.by, a.forced) : plan ? C.planNotApproved : C.notApproved));
  if (!mx.rows.length) return c.log("  " + R.none);
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
  const head = ["id", "status", "tasks", "tests", "decisions", "requirement"].map((col) => R.cols[col]);
  const widths = head.slice(0, 5).map((h, i) => Math.min(28, Math.max(len(h), ...rows.map((r) => len(r[i])))));
  const line = (cells) => "  " + cells.slice(0, 5).map((cell, i) => { const x = cut(cell, widths[i]); return x + " ".repeat(widths[i] - len(x)); }).join("  ") + "  " + cut(cells[5], 110);
  c.log(line(head));
  rows.forEach((r) => c.log(line(r)));
  c.log("  " + C.legend + (mx.code ? " · " + C.codeLegend : ""));
}

// ---- merge-state (1.21 F1a) -------------------------------------------------------------------------------------------------
// The driver git runs on a .state.json / roadmap.json both branches changed (and on the generated overviews): the three files git
// hands it (%O %A %B, relative to its cwd — the top of the work tree), the merge written into <ours>. Messages in the project
// language; stdout stays empty unless --json (git shows a driver's output as it runs).
function mergeStateRun(c, baseF, oursF, theirsF, rel) {
  const { flags } = c;
  const M = spec.msg(spec.projectLang(c.projectDir)).mergeState;
  const read = (f) => { try { return fs.readFileSync(path.resolve(c.cwd, f), "utf8"); } catch { return null; } };
  const oursText = read(oursF), theirsText = read(theirsF);
  if (oursText == null || theirsText == null) c.die(M.unreadable(oursText == null ? oursF : theirsF), { code: "unreadable" });
  const r = spec.mergeStateText(read(baseF) || "", oursText, theirsText, { path: rel, kind: flags.kind });
  if (r.kind === "generated") {
    // Both sides dev-spec's own output: ours stays (the next dev-spec write regenerates it from the merged state). A hand-written
    // overview (no AUTO-GENERATED marker): git's own text merge, in place — its exit status is the number of conflicts.
    if (r.keepOurs) return flags.json ? c.log(JSON.stringify({ ok: true, kind: r.kind, kept: "ours" }, null, 2)) : undefined;
    const g = GIT.gitRun(["merge-file", "-L", "ours", "-L", "base", "-L", "theirs", oursF, baseF, theirsF], { cwd: c.cwd });
    const ran = !g.error && Number.isInteger(g.status) && g.status >= 0;
    c.exitCode = ran && g.status === 0 ? 0 : 1;
    // 1.23 review (L13): --json printed nothing here — the result of git's text merge (conflicts = its count of conflict hunks)
    if (flags.json) c.log(JSON.stringify(ran ? { ok: true, kind: r.kind, merged: "text", clean: g.status === 0, conflicts: g.status }
      : { ok: false, kind: r.kind, merged: "text", error: String((g.error && g.error.message) || "git merge-file: exit " + g.status) }, null, 2));
    return;
  }
  if (!r.ok) { // ours left as it is — with --json (1.23 review L13) the refusal is the JSON document on stdout too
    const msg = M.parseError(r.parseError, r.error);
    c.err(msg);
    if (flags.json) c.log(JSON.stringify({ ok: false, kind: r.kind, parseError: r.parseError, error: msg }, null, 2));
    c.exitCode = 1;
    return;
  }
  fs.writeFileSync(path.resolve(c.cwd, oursF), r.text);
  if (flags.json) {
    c.log(JSON.stringify({ ok: true, kind: r.kind, clean: r.clean, conflicts: r.conflicts }, null, 2));
    if (!r.clean) c.exitCode = 1;
    return;
  }
  if (r.clean) return;
  const show = (v) => { if (v === undefined) return M.absent; const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 59) + "…" : s; };
  c.err(M.conflictHead(rel || oursF, r.conflicts.length));
  r.conflicts.slice(0, 20).forEach((x) => c.err(M.conflictLine(x.path || "(root)", show(x.ours), show(x.theirs), show(x.base))));
  if (r.conflicts.length > 20) c.err("  …");
  c.err(M.conflictTail);
  c.exitCode = 1;
}
// merge-state --install / --uninstall: the .gitattributes lines (in the project folder — its patterns are relative to it; commit
// it) and this clone's git config (merge.dev-spec-state.name / .driver — per clone, never committed). Nothing without git.
function mergeDriverSetup(c, uninstall) {
  const { projectDir } = c;
  const M = spec.msg(spec.projectLang(projectDir)).mergeState;
  const git = (args) => GIT.gitRun(args, { cwd: projectDir });
  const top = git(["rev-parse", "--show-toplevel"]);
  if (!top.ok) return c.fail({ ok: false, error: uninstall ? M.noGitUninstall(projectDir) : M.noGit(projectDir) }); // 1.24 r6 B9: each names its own switch
  const file = path.join(projectDir, ".gitattributes");
  // 1.25.1 (review 7): never through a link — a .gitattributes that is a symbolic link (a cloned repository's) made --install write the
  // driver's lines into the file it points at, and --uninstall rewrite or delete it; a folder (or any other kind) there neither.
  let lst = null;
  try { lst = fs.lstatSync(file); } catch { lst = null; }
  if (lst && (lst.isSymbolicLink() || !lst.isFile())) return c.fail({ ok: false, code: "attributes-not-file", error: M.attrsNotFile(file) });
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
    if (r.ok) config.push({ removed: key });
  } else {
    for (const [k, v] of [[key + ".name", "dev-spec: semantic merge of the spec state (.state.json, roadmap.json)"], [key + ".driver", driver]]) {
      const r = git(["config", k, v]);
      if (!r.ok) return c.fail({ ok: false, error: M.configFailed(String(r.stderr || (r.error && r.error.message) || "?").trim()) });
      config.push({ key: k, value: v });
    }
  }
  const res = { ok: true, action: uninstall ? "uninstall" : "install", attributes: { file, changed: a.changed, lines: a.lines }, config };
  return c.out(res, () => {
    if (uninstall) {
      c.log(a.changed ? M.attrsRemoved(file) : M.attrsNone(file));
      config.forEach((x) => c.log(M.configRemoved(x.removed)));
      return;
    }
    c.log(a.changed ? M.attrsAdded(file) : M.attrsKept(file));
    if (a.changed) a.lines.forEach((l) => c.log("  " + l));
    config.forEach((x) => c.log(M.configSet(x.key, x.value)));
    c.log(M.teamNote);
  });
}
// The command git runs (sh -c, Git's own sh on Windows): this clone's CLI by its absolute path, forward slashes, single-quoted.
function mergeDriverCommand() {
  return "node '" + CLI_PATH.replace(/'/g, "'\\''") + "' merge-state %O %A %B %P";
}
// merge-state --check (1.21 review A3): the configured driver (`git config --get merge.dev-spec-state.driver`, read only) against
// THIS clone's CLI and the project's .gitattributes (spec.mergeDriverStatus). Exit 0: it runs this clone's CLI, or nothing names
// the driver (nothing to check) · 1: it runs another or a missing script (a plugin update moved the plugin — git then drops
// theirs' changes), .gitattributes names it while this clone has none, or not inside a git repository.
function mergeDriverCheck(c) {
  const { projectDir } = c;
  const M = spec.msg(spec.projectLang(projectDir)).mergeState;
  const git = (args) => GIT.gitRun(args, { cwd: projectDir });
  const top = git(["rev-parse", "--show-toplevel"]);
  if (!top.ok) return c.fail({ ok: false, error: M.checkNoGit(projectDir) });
  const got = git(["config", "--get", spec.MERGE_DRIVER_KEY]); // exit 1: not set
  const driver = got.ok ? got.stdout.trim() : null;
  const s = spec.mergeDriverStatus(projectDir, { driver, cli: CLI_FILE });
  const res = { ok: true, action: "check", status: s.status, current: s.status === "ok", named: s.named, attributes: s.attributes, driver: s.driver, script: s.script, cli: s.cli };
  if (!["ok", "none"].includes(s.status)) c.exitCode = 1;
  return c.out(res, () => {
    if (s.status === "ok") c.log(M.checkOk(s.script));
    else if (s.status === "none") c.log(M.checkNone);
    else if (s.status === "not-installed") c.log(M.checkNotInstalled(s.attributes));
    else if (s.status === "missing") c.log(M.checkMissing(s.script));
    else c.log(M.checkOther(s.script || s.driver, s.cli));
  });
}

// ---- statusline (1.16 C1) ----------------------------------------------------
// Claude Code runs the settings.json "statusLine" command after every assistant message (debounced, cancelled when a newer update
// starts) with its session JSON on stdin, and shows what it prints — a non-zero exit or no output blanks the line. So the render path
// never fails: no flag refusal, no usage error, bounded stdin, every error swallowed, exit 0 always, nothing printed outside a
// dev-spec project. The project: the nearest dev-spec .specs/ at or above --project / workspace.current_dir / cwd /
// workspace.project_dir of the payload (no payload — a terminal: --project / SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR / the working
// folder). The line is spec.statusLine's, cut to $COLUMNS; --json prints the whole result. cli/main.js runs it before any check.
const STATUS_STDIN_MAX = 1024 * 1024;
function statusLineRender(c) {
  const { flags, io } = c;
  if (io.exit && typeof io.stdout.on === "function") io.stdout.on("error", () => io.exit(0)); // a reader gone (Claude Code cancelled this run): nothing left to show
  const render = (data) => {
    let r = { ok: true, found: false, line: "" };
    try {
      let payload = null;
      try { payload = data.trim() ? JSON.parse(data) : null; } catch { payload = null; }
      if (payload !== null && (typeof payload !== "object" || Array.isArray(payload))) payload = null;
      const ws = payload && payload.workspace && typeof payload.workspace === "object" ? payload.workspace : {};
      const given = typeof flags.project === "string" ? [flags.project] : [];
      const cands = payload ? given.concat([ws.current_dir, payload.cwd, ws.project_dir])
        : given.concat([c.env.SPEC_PROJECT_DIR, c.env.CLAUDE_PROJECT_DIR, c.cwd]);
      // 1.25.1 (review 7): the engine-free walk first (cli/completion.js statusProbe, statusLineProject's null rule) — outside a
      // dev-spec project the line is empty without loading the engine (136–220 ms per render in any folder, user-wide)
      const pdir = COMPLETION.statusProbe(cands) ? spec.statusLineProject(cands) : null;
      const cols = parseInt(c.env.COLUMNS, 10);
      if (pdir) r = spec.statusLine(pdir, { columns: Number.isSafeInteger(cols) && cols > 0 ? cols : undefined });
    } catch {
      r = { ok: true, found: false, line: "" }; // never a stack trace in the status line
    }
    const text = flags.json === true ? JSON.stringify(r) + "\n" : r.line ? r.line + "\n" : "";
    try { c.write(text); } catch { /* stdout gone */ } // exit 0 once it has flushed (cli/dev-spec.js) — stdin may still be open
  };
  // A terminal: no payload. Else the payload on stdin, bounded; a caller that never closes stdin still gets its line after 1.5 s.
  return c.readInput({ max: STATUS_STDIN_MAX, waitMs: 1500, tty: "none" }, render);
}
// `statusline --print-config`: the settings.json snippet with THIS clone's absolute path (never committed — like mcp-config).
// 1.25.1 (review 7): in a plugin's versioned folder the command finds the newest installed version at each run (cli/completion.js
// statuslineCommand — the completion scripts' rule): the plain path broke at the first plugin update.
function statusLineConfig(c) {
  const { command, follows } = COMPLETION.statuslineCommand(CLI_PATH);
  const cfg = { statusLine: { type: "command", command } };
  if (c.flags.json) return c.log(JSON.stringify(cfg, null, 2));
  const C = spec.msg(spec.projectLang(c.projectDir)).claudeCode.statusLine.config;
  c.log(C.head);
  c.log(JSON.stringify(cfg, null, 2));
  c.log(C.after);
  if (follows) c.log(C.cacheFollows);
  else if (/\/plugins\/cache\//i.test(CLI_PATH)) c.log(C.cacheNote);
  c.log(C.tryIt(command));
}

// 1.24 r6 B-I1 — `dev-spec version` / --version / -V: what a bug report needs — the version, this CLI's path, Node, where the engine
// loaded from (its modules, or the bundle; a requested bundle that was skipped and why — spec.engineSource), the project the
// commands work in, which input chose it (PROJECT_SOURCE) and its language. --json: the same as data (stable keys and codes).
function printVersion(c) {
  const projectDir = c.projectDir;
  const es = spec.engineSource || { kind: "modules", requested: false };
  let exists = false;
  try { exists = fs.statSync(projectDir).isDirectory(); } catch { exists = false; }
  const lang = spec.projectLang(projectDir);
  const r = { ok: true, version: spec.engineVersion(), cli: CLI_PATH, node: process.version,
    engine: { source: es.kind, bundle: es.requested ? { requested: true, file: es.file, skipped: es.skipped || null, ...(es.pathIgnored ? { pathIgnored: true } : {}) } : { requested: false } },
    project: { dir: projectDir, source: c.PROJECT_SOURCE, exists, devSpec: exists && spec.isDevSpecDir(projectDir), lang } };
  return c.out(r, (r) => {
    const V = c.cliText(lang).version;
    c.log(V.head(r.version));
    c.log(V.cli(r.cli));
    c.log(V.node(r.node));
    const b = r.engine.bundle;
    if (r.engine.source === "bundle") c.log(V.engineBundle(b.file));
    else if (b.requested) {
      c.log(V.engineSkipped(b.file, V.skip[b.skipped] || b.skipped));
      const custom = b.file && path.resolve(b.file) !== path.resolve(__dirname, "..", "mcp", "lib", "spec.bundle.js");
      c.log(V.rebuild(spec.DEV_SPEC + " bundle" + (custom ? " --out \"" + b.file + "\"" : "")));
    } else c.log(V.engineModules);
    if (b.pathIgnored) c.log(V.pathIgnored);
    c.log(V.project(r.project.dir, V.src[r.project.source] || r.project.source));
    c.log(!r.project.exists ? V.state.missing : r.project.devSpec ? V.state.devSpec(r.project.lang) : V.state.noSpecs(r.project.lang));
  });
}

// `dev-spec evals` (1.23 review P1): the words of the command line but the command, read with run-evals.js's own rules — its value
// flags (EVALS_VALUE_FLAGS) take the next word unless it is a flag; the first plain word is the feature, any other goes on (the
// harness refuses it). --project and its value are left out: the CLI passes its resolved project.
function evalsArgs(c) {
  const toks = c.ARGV0.filter((_, i) => i !== c.cmdIdx);
  let feature = null, help = false;
  const rest = [];
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i];
    if (a === "-h") { help = true; rest.push("--help"); continue; } // 1.24 r6 B-I3: -h = --help (the harness's usage)
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

// create / bugfix (each its own entry: options, help) — one handler.
function createCommand(c) {
  const { flags, pos, projectDir, on, out, fail, usage, log } = c;
  // 1.24 r6 B9: each its own usage (`bugfix` without a name printed create's)
  if (!pos[0]) usage(c.cmd === "bugfix" ? 'dev-spec bugfix "<name>" [tracks...] [--summary "…"] [--reproduction "…"] [--root-cause "…"] [--condition "…"] [--behaviour "…"] [--branch [<name>]] [--lang en|pt|pt-BR|es]'
    : 'dev-spec create "<name>" [tracks...] [--summary "…"] [--kind feature|bugfix|spike|change] [--size xs|s|m|l] [--branch [<name>]] [--lang en|pt|pt-BR|es]');
  const name = pos[0];
  const tr = c.withTracksFlag(pos.slice(1));
  const tracks = tr.length ? tr : undefined; // none → engine: keep existing / classify new
  const branch = branchFlag(c); // 1.25: --branch [<name>] — what git says is read BEFORE the engine records anything
  const git = branch ? branchGitFacts(c) : undefined;
  // the engine classifies a new feature in its language (the explicit --lang, else the project's) — same as spec_create
  const r = spec.createFeature(projectDir, name, tracks, flags.summary, undefined, flags.lang, c.cmd === "bugfix" ? "bugfix" : flags.kind,
    { brownfield: on("brownfield"), flow: flags.flow, question: flags.question, timebox: flags.timebox, // = spec_create {brownfield, flow, question, timebox,
      reproduction: flags.reproduction, rootCause: flags["root-cause"], condition: flags.condition, behaviour: flags.behaviour, // the bugfix prefill (1.21 F3)
      cli: true, // 1.21 review A8: a refusal names the flag (--root-cause), not the MCP key (rootCause)
      includeBody: c.boolFlag("include-body") === true, // … includeBody} — the bodies are in the --json result
      size: flags.size, // 1.21 F5: --size xs|s|m|l (= spec_create {size}; xs = a change: one change.md)
      branch, git }); // 1.25: = spec_create {branch}; git: what git said here (the engine reads no git process — MCP: the repository's files)
  if (!r.ok) return fail(r);
  const switched = branch ? branchSwitch(c, r, git) : null; // runs `git switch -c <name>` — the engine never does
  return out(r, (r) => {
    const T = c.cliText(r.lang);
    log(T.feature(r.slug, r.label, r.lang) + "\n  " + (r.created.join(", ") || T.nothingNew) + (r.note ? "\n  " + r.note : ""));
    if (switched) log(switched);
  });
}
const CREATE_OPTIONS = ["tracks", "summary", "lang", "brownfield", "flow", "question", "timebox", "reproduction", "root-cause", "condition", "behaviour", "include-body", "size", "branch"];

// ---- the table ------------------------------------------------------------------------------------------------------------------
// In the help's order. A handler reads what it needs from its context (destructured first — the bodies read as they always have).
const COMMANDS = [
  {
    name: "classify",
    options: ["name", "lang", "explain"],
    help: `  classify "<description>" [--name "<feature>"]   Recommend tracks (core/+tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data), multilingual
                                  --explain: every keyword match (table tier → final tier, cue / override, negation) + the
                                  project's signal overrides`,
    run(c) {
      const { flags, pos, projectDir, on, out, usage, log } = c;
      if (!pos[0]) usage('dev-spec classify "<description>" [--name "<feature name>"] [--lang en|pt|pt-BR|es] [--explain]');
      const r = spec.classify(pos.join(" "), { name: flags.name, lang: flags.lang, projectDir, explain: on("explain") }); // same args as spec_classify
      return out(r, (r) => {
        const T = c.cliText(r.lang); // the language the reasoning was written in
        const C = spec.msg(r.lang).classify;
        log(T.tracks(r.label, Object.keys(r.confidence).map((t) => t + "=" + (C.conf[r.confidence[t]] || r.confidence[t])).join(", "))); // + the project's track packs (1.15)
        log(r.reasoning);
        if (r.note) log(T.note(r.note));
        if (r.sizeNote) log(r.sizeNote); // 1.21 F5: the suggested size (spec_create --size)
        if (r.langHint) log(T.langHint(r.langHint)); // 1.24 r6 H-I4: Brazilian wording — create / init with --lang pt-BR
        if (r.explain) { // 1.21 F2: every keyword match and the project's signal overrides (.specs/classifier.json)
          log(r.explain.matches.length ? C.explainHead : C.explainNone);
          r.explain.matches.forEach((m) => log(C.explainMatch(m)));
          if (!r.explain.overrides.length) log(C.explainNoOverrides);
          else { log(C.explainOverridesHead(r.explain.overrides.length, r.explain.min)); r.explain.overrides.forEach((o) => log(C.explainOverride(o, r.explain.min))); }
        }
      });
    },
  },
  {
    name: "init",
    options: ["lang", "tracks", "guard", "stop-check", "check", "approval-guard", "evidence", "roles"],
    args: ["@track..."],
    values: { evidence: "reported observed" },
    help: `  init [tracks...] [--lang]       Scaffold .specs/steering (--lang en|pt|pt-BR|es → project default)
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
                                  its shell tool), feature remove --yes or lowering this guard asks you (ask) or is refused (deny)`,
    run(c) {
      const { flags, pos, projectDir, out, fail, die, log } = c;
      const tr = c.withTracksFlag(pos);
      // --guard on|off|scope = spec_init {guard: true|false|"scope"}; absent leaves the guard as it is.
      let guard;
      if (flags.guard !== undefined) {
        const g = String(flags.guard).trim().toLowerCase();
        if (["on", "true", "yes", "1"].includes(g)) guard = true;
        else if (["off", "false", "no", "0"].includes(g)) guard = false;
        else if (g === "scope") guard = "scope"; // 1.14 C1 — the scope guard
        else die(spec.msg(flags.lang || spec.projectLang(projectDir)).guardMode.badValue(flags.guard), c.invalidArg("--guard"));
      }
      // 1.14 C1: --stop-check on|off = spec_init {stopCheck: true|false}; absent leaves the evidence gate as it is.
      let stopCheck;
      if (flags["stop-check"] !== undefined) {
        const v = String(flags["stop-check"]).trim().toLowerCase();
        if (["on", "true", "yes", "1"].includes(v)) stopCheck = true;
        else if (["off", "false", "no", "0"].includes(v)) stopCheck = false;
        else die(spec.msg(flags.lang || spec.projectLang(projectDir)).stopGate.badValue(flags["stop-check"]), c.invalidArg("--stop-check"));
      }
      const checks = checksFlag(c); // B5: --check name="cmd" (repeatable; name= removes) = spec_init {checks}
      // 1.14 F2: --approval-guard off|ask|deny = spec_init {approvalGuard}; absent leaves the human approval guard as it is.
      let approvalGuard;
      if (flags["approval-guard"] !== undefined) {
        approvalGuard = String(flags["approval-guard"]).trim().toLowerCase();
        if (!spec.APPROVAL_GUARD_LEVELS.includes(approvalGuard)) die(spec.msg(flags.lang || spec.projectLang(projectDir)).approvalGuard.badValue(flags["approval-guard"]), c.invalidArg("--approval-guard"));
      }
      // 1.14 F1: --evidence reported|observed = spec_init {evidence} (roadmap.json meta.evidence); absent leaves it as it is.
      let evidenceMode;
      if (flags.evidence !== undefined) {
        const v = String(flags.evidence).trim().toLowerCase();
        if (v === "reported" || v === "observed") evidenceMode = v;
        else die(spec.msg(flags.lang || spec.projectLang(projectDir)).observed.badValue(flags.evidence), c.invalidArg("--evidence"));
      }
      // --roles requirements=product,design=tech+security | none = spec_init {approvalRoles} (1.14 B3); absent leaves them as they are.
      let approvalRoles;
      if (flags.roles !== undefined) {
        approvalRoles = spec.parseApprovalRolesText(flags.roles, flags.lang || spec.projectLang(projectDir));
        if (approvalRoles.error) die(approvalRoles.error, c.invalidArg("--roles"));
      }
      const r = spec.initProject(projectDir, tr.length ? tr : ["core"], flags.lang, { guard, checks, approvalRoles, stopCheck, approvalGuard, evidence: evidenceMode });
      if (r.ok === false) return fail(r); // e.g. an unknown track (did-you-mean) or an unreadable roadmap.json
      return out(r, (r) => {
        log(c.cliText(r.lang).created(r.specsDir, r.lang, r.created.join(", ") || c.cliText(r.lang).nothingNew, r.skipped.join(", ")));
        if (r.guardNote) log("  " + r.guardNote);
        if (r.stopCheckNote) log("  " + r.stopCheckNote);
        if (r.evidenceNote) log("  " + r.evidenceNote); // 1.14 F1
        if (checks) log("  " + spec.msg(r.lang).projectChecks.initLine(Object.entries(r.checks || {}).map(([k, v]) => k + " → " + v).join(" · ") || "—"));
        if (r.rolesNote) log("  " + r.rolesNote);
        if (r.approvalGuardNote) log("  " + r.approvalGuardNote);
        if (r.observedWarning) log("  " + r.observedWarning); // 1.25.1 (review 7): observed evidence without the approval guard
      });
    },
  },
  {
    name: "steering",
    options: ["lang"], max: 1,
    help: `  steering <file> [--lang]        Create one steering file from its template (constitution.md, tech.md, glossary.md — the terms to
                                  use and the words to avoid (_Avoid:_), …) — any other
                                  name like api-rules.md → a custom scoped file (front matter inclusion: always|fileMatch|manual)`,
    run(c) {
      // dev-spec steering <file> [--lang] — one steering file from its template, or a custom scoped one with front
      // matter (inclusion: always|fileMatch|manual) for any other safe name (same as steering_scaffold)
      const { flags, pos, projectDir, out, fail, usage, log } = c;
      if (!pos[0]) usage("dev-spec steering <constitution.md|product.md|tech.md|…|<custom-name>.md> [--lang en|pt|pt-BR|es]");
      const r = spec.scaffoldSteeringFile(projectDir, pos[0], flags.lang);
      if (!r.ok) return fail(r);
      const T = c.cliText(flags.lang || spec.projectLang(projectDir)); // the language the file was written in
      return out(r, (r) => log(r.created ? T.steeringCreated(r.file) : T.steeringExists(r.file)));
    },
  },
  {
    name: "templates",
    options: ["lang"],
    args: ["list init check", "@template"],
    help: `  templates [list|init|check] [artifact] [--lang]   The project's own scaffolds: .specs/templates/<artifact>.md (<lang>/ wins)
                                  replace the built-in ones for new features / steering; init copies the built-in ones to
                                  edit; check validates them (exit 1 on an error)`,
    run(c) {
      // dev-spec templates [list|init|check] [artifact] [--lang en|pt|pt-BR|es] — the project's own scaffolds in .specs/templates/
      // (= spec_templates {action, artifact, lang}). check exits 1 when a template has an error (scriptable, like doctor).
      const { flags, pos, projectDir, out, fail, usage, log } = c;
      if (pos.length > 2) usage("dev-spec templates [list|init|check] [artifact] [--lang en|pt|pt-BR|es]");
      const r = spec.templates(projectDir, pos[0], { artifact: pos[1], lang: flags.lang });
      if (!r.ok) return fail(r);
      if (r.action === "check" && r.errors) c.exitCode = 1;
      return out(r, (r) => spec.templatesLines(r).forEach((l) => log(l))); // 1.26: rendered from the result (it carries no lines)
    },
  },
  {
    name: "tracks",
    options: ["lang"],
    args: ["list init check"],
    help: `  tracks [list|init <name>|check] [name] [--lang]   The project's own tracks: a pack .specs/tracks/<name>/ (track.json +
                                  fragments) is a marker track like +sec — classified, scaffolded, gated; init scaffolds
                                  one; check validates them (exit 1 on an error)`,
    run(c) {
      // dev-spec tracks [list|init <name>|check] [name] [--lang en|pt|pt-BR|es] — the project's track packs in .specs/tracks/
      // (= spec_tracks {action, name, lang}). check exits 1 when a pack has an error (scriptable, like templates check).
      const { flags, pos, projectDir, out, fail, usage, log } = c;
      if (pos.length > 2) usage("dev-spec tracks [list|init <name>|check] [name] [--lang en|pt|pt-BR|es]");
      const r = spec.trackPacks(projectDir, pos[0], { name: pos[1], lang: flags.lang });
      if (!r.ok) return fail(r);
      if (r.action === "check" && r.errors) c.exitCode = 1;
      return out(r, (r) => r.lines.forEach((l) => log(l)));
    },
  },
  {
    name: "signals",
    options: ["lang"],
    args: ["list set forget"], sub: { set: [null, "@track", null, "off weak strong"], forget: [null, "@track"] },
    help: `  signals [list | set <track> <word> off|weak|strong | forget <track> <word>]   The classifier's signal overrides of this
                                  project (.specs/classifier.json): create learns them from Phase 0 corrections (a word
                                  that drove a suggestion you changed — applies after 2 consistent corrections); set one by
                                  hand (applies at once), forget one (= spec_tracks {action: "signals"})`,
    run(c) {
      // dev-spec signals [list | set <track> <word> off|weak|strong | forget <track> <word>] [--lang] — the project's classifier
      // signal overrides in .specs/classifier.json (= spec_tracks {action: "signals", op, track, word, effect}); exit 1 on a refusal.
      const { flags, pos, projectDir, out, fail, usage, log } = c;
      const syntax = "dev-spec signals [list | set <track> <word> off|weak|strong | forget <track> <word>] [--lang en|pt|pt-BR|es]";
      const op = pos[0] == null ? "list" : String(pos[0]).trim().toLowerCase();
      if ((op === "list" && pos.length > 1) || (op === "set" && pos.length !== 4) || (op === "forget" && pos.length !== 3)) usage(syntax);
      const r = spec.trackPacks(projectDir, "signals", { op, track: pos[1], word: pos[2], effect: pos[3], lang: flags.lang });
      if (!r.ok) return fail(r);
      return out(r, (r) => r.lines.forEach((l) => log(l)));
    },
  },
  {
    name: "create",
    options: ["kind", ...CREATE_OPTIONS],
    args: [null, "@track..."],
    values: { kind: "feature bugfix spike change", size: "@size" },
    help: `  create "<name>" [tracks...]     Scaffold a feature folder (auto-classifies if no tracks; --summary, --kind feature|bugfix|spike|change, --size xs|s|m|l, --lang en|pt|pt-BR|es)
                                  --brownfield also scaffolds integration-plan.md (a feature landing in an existing codebase);
                                  --flow design-first: classification → design → requirements → … (starts from an architecture)
                                  --branch [<name>] (also bugfix / spike): start it on its own git branch — feature/<slug> (fix/,
                                  spike/ by kind) or the name given — recorded in .state.json with the branch and commit it starts
                                  from, then git switch -c <name>; never onto a branch that exists already. Exit 1 when the feature
                                  is not on its branch at the end (not a repository, the name exists, git failed) — it is created
                                  all the same. Put tracks before --branch (or --branch=<name>)`,
    run: createCommand,
  },
  {
    name: "bugfix",
    options: CREATE_OPTIONS,
    args: [null, "@track..."],
    values: { size: "@size" },
    help: `  bugfix "<name>" [--summary]     Scaffold the bugfix flow: bug.md (repro · root cause · fix) + regression test plan
                                  --reproduction "…" --root-cause "…" --condition "…" --behaviour "…" prefill bug.md and the
                                  IF … THEN criterion (a text left out stays a slot); --include-body: the bodies in --json`,
    run: createCommand,
  },
  {
    name: "spike",
    options: ["tracks", "summary", "lang", "question", "timebox", "flow", "brownfield", "branch"],
    args: [null, "@track..."],
    help: `  spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]   Scaffold a spike (investigate → decide): spike.md — question,
                                  timebox, options, evidence, decision (go / no-go / pivot) — + investigation tasks; no
                                  requirements/design gates (= create --kind spike; prototype code stays outside .specs/)`,
    run(c) {
      // dev-spec spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d|2w|8h] [--summary …] [--lang] — the spike shortcut
      // (= spec_create {name, kind: "spike", question, timebox}; `create "<name>" --kind spike` is the same call).
      const { flags, pos, projectDir, on, out, fail, usage, log } = c;
      if (!pos[0]) usage('dev-spec spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d] [--branch [<name>]] [--lang en|pt|pt-BR|es]');
      const tr = c.withTracksFlag(pos.slice(1));
      const branch = branchFlag(c); // 1.25: --branch [<name>] (spike/<slug> by default), as create
      const git = branch ? branchGitFacts(c) : undefined;
      const r = spec.createFeature(projectDir, pos[0], tr.length ? tr : undefined, flags.summary, undefined, flags.lang, "spike", { question: flags.question, timebox: flags.timebox, flow: flags.flow, brownfield: on("brownfield"), cli: true, branch, git }); // = create --kind spike (a flow gets its note; cli: a refusal names the flag)
      if (!r.ok) return fail(r);
      const switched = branch ? branchSwitch(c, r, git) : null;
      return out(r, (r) => {
        const T = c.cliText(r.lang);
        const SP = spec.msg(r.lang).spike;
        log(T.feature(r.slug, r.label, r.lang) + "\n  " + (r.created.join(", ") || T.nothingNew) + (r.note ? "\n  " + r.note : ""));
        const si = spec.spikeInfo(r.dir);
        if (si.question) log(SP.cliQuestion(si.question));
        if (si.timebox.state === "date") log(SP.cliUntil(si.timebox.date));
        if (switched) log(switched);
      });
    },
  },
  {
    name: "decide",
    options: ["title", "decision", "context", "consequences", "affects", "supersedes", "discovery", "kind"],
    args: ["@feature"],
    values: { kind: "decision discovery" },
    help: `  decide <feature> --title "…" --decision "…"   Append a D-n entry to decisions.md (append-only): [--context "…"]
                                  [--consequences "…"] [--affects US-1.AC-2,T-03,"Data Models"] [--supersedes D-1] [--discovery]
                                  — an unknown _Affects:_ reference is refused (exit 1, nothing written)`,
    run(c) {
      // dev-spec decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"] [--affects US-1.AC-2,T-03]
      // [--supersedes D-1] [--discovery] — append one entry to decisions.md (= spec_decide; unknown _Affects:_ → exit 1, nothing written).
      const { flags, pos, projectDir, on, out, fail, usage, log } = c;
      if (!pos[0] || pos.length > 1) usage('dev-spec decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"] [--affects US-1.AC-2,T-03] [--supersedes D-1] [--discovery | --kind decision|discovery] (--affects / --supersedes repeatable)');
      // A repeated --affects / --supersedes adds to the list (the shared parser kept only the last one); --kind decision|discovery
      // is the MCP `kind` (the engine validates it), --discovery its shorthand.
      const list = (name) => { const v = c.every(name); return v.length ? v : undefined; };
      const r = spec.decide(projectDir, pos[0], { title: flags.title, decision: flags.decision, context: flags.context, consequences: flags.consequences,
        affects: list("affects"), supersedes: list("supersedes"), kind: on("discovery") ? "discovery" : flags.kind });
      if (!r.ok) return fail(r);
      const D = spec.msg(spec.featureLang(projectDir, r.feature)).decisions;
      return out(r, (r) => {
        log(D.cliRecorded(r.id, r.title, r.file));
        if (r.affects.length) log("  _Affects: " + r.affects.join(", ") + "_");
        if (r.supersedes.length) log("  _Supersedes: " + r.supersedes.join(", ") + "_");
      });
    },
  },
  {
    name: "list",
    options: [], max: 0,
    help: `  list                            List features (phase + task progress)`,
    run: (c) => main2list(c),
  },
  {
    name: "status",
    options: [], max: 1,
    args: ["@feature"],
    help: `  status [feature]                Status of a feature, or all (sections: ✓ filled · ◐ unfilled · ✗ missing)`,
    run(c) {
      const { pos, projectDir, out, fail, log } = c;
      if (!pos[0]) return main2list(c);
      const r = spec.statusFeature(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      const T = c.featureText(r.feature);
      return out(r, (r) => {
        log(T.statusHead(r.feature, r.tracks, T.phase(r.phase)));
        log(T.statusTasks(r.tasks.done, r.tasks.total, r.tasks.next ? "#" + r.tasks.next.number + " " + r.tasks.next.text : null));
        // ✓ only when FILLED (the doctor's rule): ◐ present but still a TODO/empty, ✗ missing — in the feature language.
        const fm = spec.msg(spec.featureLang(projectDir, r.feature));
        if (r.branch) log(fm.branch.statusLine(r.branch.name, r.branch.base, r.branch.commit ? r.branch.commit.slice(0, 7) : null, r.branch.current)); // 1.25
        // 1.21 F5: a sized feature's rows carry `status` — ○ an optional section left out (size s), ✓ one another track covers,
        // the template-only / short n/a states named
        const marks = (list) => list.map((s) => (s.filled ? (s.status === "missing" ? "○ " : "✓ ") : s.present ? "◐ " : "✗ ") + (fm.sectionNames[s.section] || s.section) +
          (s.filled ? (s.status === "missing" ? " (" + fm.sizes.optionalMark + ")" : s.status === "covered" ? " (" + fm.sizes.coveredMark + ")" : "")
            : " (" + fm.sectionStatus[s.status && fm.sectionStatus[s.status] ? s.status : s.present ? "unfilled" : "missing"] + ")")).join(" · ");
        if (r.scaleSections) log(T.scaleSections(marks(r.scaleSections)));
        if (r.aiSections && r.aiSections.sections) log(T.aiSections(marks(r.aiSections.sections)));
        for (const tr of ["sec", "privacy", "dist", "api", "ui", "obs", "data"]) if (r[tr + "Sections"]) log(fm.secPrivacy.statusSections[tr](marks(r[tr + "Sections"])));
        for (const p of Object.values(r.packSections || {})) log(fm.trackPacks.statusSections(p.marker, marks(p.sections))); // track packs (1.15)
        if (r.missingPacks) log(fm.trackPacks.missing(r.missingPacks.map((n) => "+" + n).join(", ")));
      });
    },
  },
  {
    name: "doctor",
    options: [], max: 1,
    args: ["@feature"],
    help: `  doctor <feature>                Health-check → ready to advance? (exit 1 on FAIL; trace/ears likewise on gaps/errors)`,
    run(c) {
      const { pos, projectDir, out, fail, usage, log } = c;
      if (!pos[0]) usage("dev-spec doctor <feature>");
      const r = spec.specDoctor(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      if (r.verdict === "fail") c.exitCode = 1; // scriptable: blocking checks → non-zero
      const T = c.featureText(r.feature);
      return out(r, (r) => {
        log(T.doctorHead(r.feature, r.tracks, T.word(r.verdict).toUpperCase(), T.bool(r.readyToAdvance)));
        r.checks.forEach((x) => log("  " + (x.status === "pass" ? "✓" : x.status === "warn" ? "▲" : "✗") + " " + x.id + (x.detail ? " — " + x.detail : "")));
      });
    },
  },
  {
    name: "trace",
    options: ["code", "matrix", "csv"], max: 1,
    args: ["@feature"],
    help: `  trace <feature> [--code]        Traceability AC ↔ task ↔ test ↔ code (_Implements:_, phantom refs) — lists every gap,
                                  then the EC/NFR/SC warnings; --code also scans test files for the T-IDs they name
                                  --matrix: + the requirements traceability matrix — one row per AC / EC / NFR / SC with its
                                  status (verified · implemented · planned · untraced), tasks, tests, evidence, decisions, approval;
                                  --csv: the matrix as RFC 4180 CSV on stdout (formula-safe; exit code still = trace gaps)`,
    run(c) {
      const { flags, pos, projectDir, on, out, fail, usage, log, write } = c;
      if (!pos[0]) usage("dev-spec trace <feature> [--code] [--matrix] [--csv]");
      const matrix = on("matrix") || on("csv"); // 1.14 F5: --csv prints the matrix as CSV
      const r = spec.traceCheck(projectDir, pos[0], { code: on("code"), matrix }); // = trace_check {code, matrix}
      if (!r.ok) return fail(r);
      if (r.verdict !== "pass") c.exitCode = 1; // scriptable: gaps → non-zero (warnings never change it)
      const lang = spec.featureLang(projectDir, r.feature);
      const T = c.cliText(lang);
      // --csv: the data alone on stdout (header + one record per requirement; no BOM, no marker record — `export --csv` is the document)
      if (on("csv") && !flags.json) return write(spec.matrixCsv([r.matrix], lang));
      return out(r, (r) => {
        if (r.matrix) printMatrix(c, r.feature, r.matrix, lang);
        log(T.traceHead(r.feature, T.word(r.verdict), r.totalAcs, r.coveredByTasks));
        // Every gap kind the engine reports, with its IDs — never "gaps-found" with nothing listed.
        spec.traceGapLines(r, lang).forEach((l) => log("  " + l));
        spec.traceWarningLines(r, lang).forEach((l) => log("  ▲ " + l));
        if (r.code) { // T-IDs run outside test code (a load-test.md / eval-set row) are listed apart, never counted as expected in code
          const outside = r.code.plannedOutsideCode || [];
          const expected = r.code.planned - outside.length;
          log(spec.msg(lang).deepTrace.codeSummary(expected - r.code.plannedNotInCode.length, expected, r.code.scanned, r.code.truncated, outside.join(", ")));
        }
        spec.supersedesWarnings(r, lang).forEach((l) => log("  ⚠ " + l)); // warnings, not gaps (exit code unchanged)
        spec.affectsWarnings(r, lang).forEach((l) => log("  ⚠ " + l)); // 1.14 C2: decisions.md _Affects:_ naming nothing — warnings too
      });
    },
  },
  {
    name: "clarify",
    options: [], max: 1,
    args: ["@feature"],
    help: `  clarify <feature>               Surface ambiguities/gaps in requirements before design`,
    run(c) {
      const { pos, projectDir, out, fail, usage, log } = c;
      if (!pos[0]) usage("dev-spec clarify <feature>");
      const r = spec.clarify(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      const T = c.featureText(r.feature);
      return out(r, (r) => {
        log(T.clarify(r.feature, r.tracks, T.word(r.verdict), r.gapCount));
        r.questions.forEach((q, i) => log("  " + (i + 1) + ". " + q));
        if (r.glossaryNote) log("  ⚠ " + r.glossaryNote); // 1.16 Q review: a glossary read only in part says so
      });
    },
  },
  {
    name: "ears",
    options: ["text", "lang"], max: 1,
    args: ["@feature @file"],
    help: `  ears <feature|file.md>          Lint EARS (SHALL/DEVE/DEBE, IDs, vague words);
       ears --text "…" | ears -   … or raw text / stdin (same as ears_validate {text})`,
    run(c) {
      // dev-spec ears <feature|file.md> | --text "<criteria>" | -   (raw text / stdin = ears_validate {text})
      const { flags, pos, projectDir, out, fail, usage, log } = c;
      if (flags.text == null && !pos[0]) usage('dev-spec ears <feature|path-to.md> | --text "<criteria>" | - (stdin)');
      const textLang = flags.lang || spec.projectLang(projectDir);
      const report = (r, T) => {
        if (!r.ok) return fail(r);
        if (r.verdict === "fail") c.exitCode = 1; // scriptable: EARS errors → non-zero
        return out(r, (r) => {
          log(T.earsHead(r.summary.criteriaDetected, r.summary.withShall, T.word(r.verdict)));
          r.issues.forEach((i) => log("  L" + i.line + " [" + T.word(i.severity) + "] " + i.msg)); // `severity` stays English in --json
        });
      };
      if (typeof flags.text === "string") return report(spec.earsValidate(flags.text, textLang), c.cliText(textLang));
      if (pos[0] === "-") return c.readStdin((txt) => report(spec.earsValidate(txt, textLang), c.cliText(textLang)));
      // A file path is read from the project when it was named (--project / the env), else from the working folder (argPath, L12).
      const file = c.argPath(pos[0]);
      const isFile = fs.existsSync(file) && fs.statSync(file).isFile();
      if (isFile) return report(spec.earsValidate(spec.decodeText(fs.readFileSync(file)), textLang), c.cliText(textLang)); // UTF-16 too
      // 1.24 r6 B9: a word that reads as a PATH (a separator, or a .md / .markdown / .txt name) and is no file — nor a feature of that
      // name — is "no such file", never "Feature 'missing-md' not found" (its slug).
      if ((/[\\/]/.test(String(pos[0])) || /\.(?:md|markdown|txt)$/i.test(String(pos[0]))) && !spec.existingFeature(projectDir, pos[0]).ok) {
        return fail({ ok: false, error: c.projectText().earsNoFile(file) });
      }
      return report(spec.earsFeature(projectDir, pos[0]), c.featureText(pos[0]));
    },
  },
  {
    name: "next",
    options: ["batch", "max", "waves"], max: 1,
    bounds: { max: NEXT_MAX },
    args: ["@feature"],
    help: `  next <feature> [--batch]        Next task whose _Depends:_ are all done (--batch: + the [P] tasks that can run beside it; --max N, default 3);
                                  --waves: the execution waves of every open task (dependencies done or in earlier waves, no shared
                                  _Implements:_ file), + dependency cycles and blocked tasks`,
    run(c) {
      const { pos, projectDir, on, out, fail, usage, log } = c;
      if (!pos[0]) usage("dev-spec next <feature> [--batch] [--max N] [--waves]");
      const r = spec.nextTask(projectDir, pos[0], { batch: on("batch"), max: c.intFlag("max"), waves: on("waves") }); // = spec_next_task {batch, max, waves}
      if (!r.ok) return fail(r);
      const T = c.featureText(r.feature);
      const D = spec.msg(spec.featureLang(projectDir, r.feature)).taskDeps; // 1.14 F3
      const waits = (list) => list.map((x) => D.waitLine(x.number, x.waitsOn.map((d) => "#" + d).join(", "))).join("; ");
      return out(r, (r) => {
        // No task can start while some are open (a cycle, a _Depends:_ naming no task): say so — never "all done".
        log(r.next ? T.next(r.next.number, r.next.text, r.remaining, r.total) : r.remaining ? r.note : T.allDone);
        if (r.next && r.skipped && r.skipped.length) log(D.cliSkipped(waits(r.skipped)));
        if (r.batch && r.batch.length > 1) log(T.batch(r.batch.map((b) => "#" + b.number + " [" + b.implements.join(", ") + "]").join("  ")));
        if (r.waves) {
          log(D.cliWaves(r.waves.length));
          if (!r.waves.length) log(D.cliNoWave);
          r.waves.forEach((w, k) => log(D.cliWave(k + 1, w.map((n) => "#" + n).join(" "))));
          (r.cycles || []).forEach((cy) => log(D.cliCycles(cy.map((n) => "#" + n).join(", "))));
        }
        if (r.next && r.blocked && r.blocked.length) log(D.cliBlocked(waits(r.blocked))); // (no next: the note names them)
      });
    },
  },
  {
    name: "next-action",
    aliases: ["na"],
    options: [], max: 1,
    args: ["@feature"],
    help: `  next-action <feature>           "You are here → do this next" (+ what changed since approval); alias: na`,
    run(c) {
      const { pos, projectDir, out, fail, usage, log } = c;
      if (!pos[0]) usage("dev-spec next-action <feature>");
      const r = spec.nextAction(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      const T = c.featureText(r.feature);
      return out(r, (r) => {
        log(T.naHead(r.feature, r.tracks, T.phase(r.phase), T.word(r.verdict), T.bool(r.gatesOk)));
        if (r.changedSinceApproval.length) log(T.changed(r.changedSinceApproval.join(", ")));
        log("  → " + r.recommendation);
      });
    },
  },
  {
    name: "brief",
    options: ["write", "include-brief"], max: 2,
    args: ["@feature"],
    help: `  brief <feature> [n] [--write]   Self-contained brief for task n (default: next open) — ACs, tests, design, DoD;
                                  --write → .specs/<feature>/.execution/task-<n>-brief.md (subagent execution)`,
    run(c) {
      // dev-spec brief <feature> [n] [--write]  — self-contained brief for one task (default: next open)
      const { pos, projectDir, on, out, fail, usage, log, err } = c;
      if (!pos[0]) usage("dev-spec brief <feature> [task-number] [--write]");
      // A task number GIVEN is an integer ≥ 0, as done checks it (1.23 review L11: an empty word briefed — and with --write wrote —
      // the NEXT task, where spec_task_brief {number: ""} is refused by its schema). No number at all: the next task.
      if (pos[1] != null && !/^\s*\d+\s*$/.test(String(pos[1]))) {
        const A = spec.msg(spec.featureLang(projectDir, pos[0])).args;
        return fail({ ok: false, error: A.invalid(A.item("number", A.type.integer + " " + A.atLeast(0), JSON.stringify(String(pos[1])))), code: "invalid-arguments", invalid: ["number"] });
      }
      const r = spec.taskBrief(projectDir, pos[0], pos[1], { write: on("write"), includeBrief: c.boolFlag("include-brief") }); // = spec_task_brief {includeBrief}
      if (!r.ok) return fail(r);
      const T = c.cliText(r.lang);
      return out(r, (r) => {
        if (!r.task) return log(r.note);
        if (r.brief) log(r.brief);
        if (r.wrote) {
          log(T.briefAt(r.paths.brief, r.inlineOnly));
          log(T.reportAt(r.paths.report));
          log(T.ledgerAt(r.paths.ledger));
        }
        if (r.unresolved.acs.length || r.unresolved.tests.length) err(T.unresolved([...r.unresolved.acs, ...r.unresolved.tests].join(", ")));
      });
    },
  },
  {
    name: "done",
    options: ["run", "shell", "timeout", "evidence", "exit", "cmd", "reason"], max: 2,
    bounds: { timeout: TIMEOUT_MAX_S },
    args: ["@feature"],
    help: `  done <feature> <n> [--run]      Mark task n complete; --run executes its _Verify:_ command(s) first and records the evidence
                                  (a failure leaves it open; --shell bash|pwsh|<path> or DEV_SPEC_SHELL picks the shell — bash = Git Bash on
                                  Windows, never WSL's launcher; pwsh / powershell = PowerShell, run -NoProfile -NonInteractive -Command; --timeout <s>;
                                  a command that could not run records nothing); or --evidence "…" [--exit N] [--cmd "…"]
                                  A task marked _Expect: fail_ needs a FAILING run (its red test — a pass is refused); --run also
                                  records the git commit (and whether the tree was dirty) when git is available`,
    run(c) { // synchronous but for --run's commands: a refusal before them stays a synchronous one
      const { flags, pos, projectDir, on, out, fail, usage, die, log } = c;
      if (!pos[0] || pos[1] == null) usage("dev-spec done <feature> <task-number> [--run [--shell bash|pwsh|<path>] [--timeout <s>] | --evidence \"summary\" [--exit N] [--cmd \"command\"]]");
      const D = spec.msg(spec.featureLang(projectDir, pos[0])).taskDone; // human output in the feature's language
      // The task number: an integer ≥ 0 (spec_complete_task's schema; a hand-written "0." task is one next can serve) — refused
      // BEFORE anything runs (an empty word would brief the NEXT task and run its _Verify:_), in the MCP validator's words, as the
      // engine refuses it for undone / brief (1.22 review: `-1` read "must be an integer"). --json prints the refusal on stdout.
      if (!/^\s*\d+\s*$/.test(String(pos[1])) || !(Number(pos[1]) >= 0)) {
        const A = spec.msg(spec.featureLang(projectDir, pos[0])).args;
        return fail({ ok: false, error: A.invalid(A.item("number", A.type.integer + " " + A.atLeast(0), JSON.stringify(String(pos[1])))), code: "invalid-arguments", invalid: ["number"] });
      }
      // 1.23 review: --shell / --timeout need --run, and --run (a run made here) excludes --evidence / --exit / --cmd (a run made
      // elsewhere) — each was ignored silently.
      c.runOnlyFlags();
      if (on("run") && (flags.evidence !== undefined || flags.exit !== undefined || flags.cmd !== undefined)) die(c.projectText().runOrEvidence, c.invalidArg("--run"));
      const say = c.say; // --json keeps stdout one JSON document
      let evidence;
      let hint = null;
      let runStartedAt = null, ranVerify = null; // 1.22 review: the stamps taken BEFORE the run (its start, the _Verify:_ it ran)
      // The tick, once the evidence is known (after --run's commands, or at once).
      const tick = () => {
        // 1.14 F1: a run --run made is observed by the CLI itself (observed: "cli"); a reported one is looked up in the harness's log.
        const r = spec.completeTask(projectDir, pos[0], pos[1], evidence, { ...(on("run") ? { ranBy: "cli", startedAt: runStartedAt, ranVerify } : {}), ...(flags.reason !== undefined ? { reason: flags.reason } : {}) }); // --reason: only undone takes it (refused here, as MCP)
        if (!r.ok) return fail(r, hint); // --json: {ok:false, recorded:true, …} on stdout, as spec_complete_task returns it
        return out(r, (r) => {
          // "(verified)" only when something was run or attested — nothingToVerify is verified with nothing checked
          // "all done" only when no task is open (1.14 F3: open tasks none of which can start are named by the note)
          log((r.alreadyDone ? D.already : D.done)(r.completed, r.verified && !r.nothingToVerify, r.done, r.total) + (r.next ? D.next(r.next.number, r.next.text) : r.done < r.total ? "" : D.allDone));
          if (r.redRecorded) log(spec.msg(spec.featureLang(projectDir, r.feature)).redGreen.redRecorded(r.completed, evidence.exitCode)); // B5: _Expect: fail_
          if (r.note) log("  ⚠ " + r.note);
        });
      };
      if (on("run")) {
        // Evidence before claims: run the task's own _Verify:_ command(s) from the project root; any failure leaves the task open.
        // taskBrief resolves the SAME task completeTask ticks (first open one of a duplicated number), so the command that runs
        // belongs to the task that gets ticked.
        const b = spec.taskBrief(projectDir, pos[0], pos[1]);
        if (!b.ok) return fail(b);
        if (b.gated) return fail({ ok: false, gated: b.gated, error: b.gateError }); // complete_task would refuse it (bugfix: no fix before the root cause) — run nothing
        const cmds = b.verify.filter((x) => !/^\[.*\]$/.test(x.trim()));
        if (!cmds.length) return fail({ ok: false, error: D.noRunnable(b.task.number) });
        const M = spec.msg(spec.featureLang(projectDir, pos[0]));
        // 1.25.1 (review 7): a _Verify:_ holding a control character (an ESC / OSC sequence, a lone CR…) shows a terminal another
        // command than the one that runs — refused before anything runs (doctor fails verify-control).
        const ctl = cmds.find((x) => spec.commandHasControl(x));
        if (ctl !== undefined) return fail({ ok: false, code: "control-chars", error: M.verifyControl.run(b.task.number, spec.controlVisible(ctl)) });
        // Default: the platform shell (cmd.exe on Windows). --shell / DEV_SPEC_SHELL pick another (e.g. bash — Git Bash on Windows,
        // never WSL's launcher unless named by its path: runShell). A shell that can't be found is refused before anything runs.
        const sh = runShell(c);
        if (sh.error) return fail({ ok: false, couldNotRun: sh.error, error: sh.error === "wsl-exe" ? M.runGate.wslExe(sh.path) : M.runGate.noGitBash });
        if (sh.wsl) say(M.runGate.wslBash(sh.shell)); // 1.15: an explicit WSL launcher is used as given — said once
        // cmd.exe misreads POSIX quoting / $VAR — often without failing (`node -e 'process.exit(1)'` exits 0): a command written for
        // a POSIX shell is refused before anything runs unless a shell was chosen (--shell cmd: cmd.exe anyway).
        if (process.platform === "win32" && sh.shell === true) {
          const posix = cmds.map((x) => [x, spec.posixShellSyntax(x)]).find(([, k]) => k.length);
          if (posix) return fail({ ok: false, error: D.posixOnWindows(posix[0], posix[1]) });
        }
        // 1.21.1 review — the mirror: a POSIX shell (/bin/sh, bash, Git Bash…) expands `$…` / backticks in a pwsh script outside
        // single quotes before PowerShell sees it (`exit $LASTEXITCODE` → `exit` → 0: a failing check recorded as passing) —
        // refused before anything runs.
        if (sh.posix) {
          const pw = cmds.map((x) => [x, spec.posixPwshScript(x)]).find(([, k]) => k.length);
          if (pw) return fail({ ok: false, error: D.pwshInPosix(pw[0], pw[1], RUN.shellName(sh, c.env)) });
        }
        // A pipe masks the check's exit code (a pipeline reports its LAST command's): one hint line — it still runs.
        cmds.filter(spec.verifyPipeMasked).forEach((x) => say(M.verifyPipe.runHint(x)));
        const git = GIT.gitState(projectDir); // B5: the commit the run is made on (+ dirty outside .specs/) — read-only git, skipped without it
        runStartedAt = new Date().toISOString(); // 1.22 review: the run's `at` is when it STARTED (an edit made meanwhile isn't tested)
        ranVerify = b.verify.slice(); // …and its verify stamp the _Verify:_ as it was then (edited meanwhile → stale-evidence)
        const passed = []; // 1.23 review: each passing command's output — the record keeps one summary per command, not the last one's
        return (async () => { // the commands run one after another — a timer of their own (1.23 review M13)
          for (const cmd of cmds) {
            say("$ " + cmd);
            const x = await RUN.runCommand(cmd, sh, M, c.execOpts());
            if (x.summary) say(x.summary.replace(/^/gm, "  "));
            if (x.heldOpen && !x.cantRun) say("  " + M.cliOutput.runHeldOpen(x.code)); // 1.24 r6 B3: settled at its exit
            // full review Ga1 / Ga9 / Ga10: a command that could not run (the shell never started, a signal, --timeout, output over
            // the buffer, WSL's launcher) is refused and NOTHING is recorded — it used to be recorded as exit 1 (an _Expect: fail_
            // task was then ticked on a red run that never happened; a passing check recorded as failed).
            if (x.cantRun) return fail({ ok: false, couldNotRun: x.cantRun.code, error: M.runGate.taskRefused(cmd, x.cantRun.why) });
            // A crash is a failed check, but no red test (not failing "for the right reason"): refused, nothing recorded.
            if (x.crashed && b.expect === "fail") return fail({ ok: false, couldNotRun: "signal", error: M.runGate.taskRefused(cmd, M.runGate.why.signal(x.crashed)) });
            const code = x.code;
            if (code !== 0) {
              // B5: an _Expect: fail_ task needs a run that FAILS — but cmd.exe failing to run the line at all (a path it can't find,
              // its syntax error; exit 1) is no red test: refused, nothing recorded — whenever cmd.exe is the shell (the default or
              // --shell cmd, full review Ga10). (9009 goes to the engine: a failed run.)
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
              // The cmd.exe / --shell bash hint only when cmd.exe itself failed (unknown command, its syntax error) — a check that ran
              // and failed (node tests/x.js → exit 1) needs a code fix, not another shell.
              if (sh.cmd && spec.windowsShellFailure(x.output, code)) hint = D.shellHint;
              break;
            }
            // 1.24 r6 D4: a pass whose output shows no test ran (node --test "tests 0", go "[no tests to run]"…) proves nothing — refused,
            // nothing recorded (couldNotRun "no-tests"; the engine refuses a reported summary that shows it the same way).
            const none = spec.vacuousRun(x.output);
            if (none) return fail({ ok: false, couldNotRun: "no-tests", error: M.runGate.noTests(cmd, none.text) });
            passed.push({ cmd, output: x.output, summary: x.summary });
            evidence = { command: cmds.join(" && "), exitCode: 0, summary: RUN.runSummaries(passed), ...git };
          }
          return tick();
        })();
      } else if (flags.evidence != null || flags.exit != null || flags.cmd != null) {
        evidence = { command: flags.cmd, exitCode: flags.exit, summary: typeof flags.evidence === "string" ? flags.evidence : undefined };
      }
      return tick();
    },
  },
  {
    name: "undone",
    options: ["reason", "run", "evidence", "exit", "cmd", "shell", "timeout"], max: 2, // done's run / evidence flags: refused with undo's own message
    args: ["@feature"],
    help: `  undone <feature> <n> [--reason "…"]   Untick task n (ticked by mistake, or its work turned out incomplete): its evidence turns
                                  stale (a re-tick needs a new run), ticks[n] is dropped, .state.json unticks records it`,
    run(c) {
      // 1.16 U1 — dev-spec undone <feature> <n> [--reason "…"] = spec_complete_task {undo: true, reason}: untick a task ticked by
      // mistake — its evidence turns stale (a re-tick needs a new run), ticks[n] is dropped, .state.json unticks records it.
      const { flags, pos, projectDir, on, out, fail, usage, log } = c;
      if (!pos[0] || pos[1] == null) usage("dev-spec undone <feature> <task-number> [--reason \"…\"]");
      const M = spec.msg(spec.featureLang(projectDir, pos[0])); // human output in the feature's language
      // 1.16 U review 5: done's evidence flags (--evidence / --exit / --cmd / --run) are refused, as spec_complete_task refuses
      // {undo, evidence} — they were silently ignored (the user believed a run had been recorded). Nothing runs, nothing changes.
      // (1.23 review: --shell / --timeout — how --run would run — too, never ignored)
      if (flags.evidence != null || flags.exit != null || flags.cmd != null || on("run") || flags.shell !== undefined || flags.timeout !== undefined) return fail({ ok: false, error: M.undo.noEvidence });
      const r = spec.completeTask(projectDir, pos[0], pos[1], undefined, { undo: true, reason: flags.reason });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        log((r.unticked ? M.undo.cliDone : M.undo.cliAlready)(r.number, r.done, r.total) + (r.next ? M.taskDone.next(r.next.number, r.next.text) : ""));
        if (r.note) log("  " + (r.unticked ? "⚠ " : "") + r.note);
      });
    },
  },
  {
    name: "finish",
    options: ["write", "include-body", "run", "shell", "timeout"], max: 1,
    bounds: { timeout: TIMEOUT_MAX_S },
    args: ["@feature"],
    help: `  finish <feature> [--write] [--include-body] [--run]   Readiness report + merge summary from the spec chain (exit 1 if not ready);
                                  --write → .execution/merge-summary.md, --include-body also prints/returns the summary;
                                  --run [--shell bash|pwsh|<path>] runs the project checks (meta.checks) and records them — with meta.checks
                                  set, finish needs a passing run of each since the last task activity`,
    run(c) { // synchronous but for --run's checks
      // dev-spec finish <feature> [--write] [--include-body] — readiness report + merge summary from the spec chain (no PRs)
      const { flags, pos, projectDir, on, out, fail, usage, log, err } = c;
      if (!pos[0]) usage("dev-spec finish <feature> [--write] [--include-body] [--run [--shell bash|pwsh|<path>] [--timeout <s>]]");
      // B5: --run executes the project checks (roadmap.json meta.checks) — only on this explicit flag — and records every run
      // (= spec_finish {evidence}); without meta.checks it is an error, nothing runs.
      c.runOnlyFlags(); // --shell / --timeout without --run: a usage error (1.23 review — they were ignored)
      const report = (evidence, runStart) => {
        const r = spec.finishFeature(projectDir, pos[0], { write: on("write"), includeBody: c.boolFlag("include-body"), evidence, ...(on("run") ? { ranBy: "cli", runStart } : {}) }); // = spec_finish {includeBody, evidence}; ranBy: the runs are observed by the CLI itself (1.14 F1)
        if (!r.ok) return fail(r);
        if (!r.readyToFinish) c.exitCode = 1; // scriptable: blockers → non-zero
        const T = c.featureText(r.feature);
        return out(r, (r) => {
          if (r.recordedChecks) log(spec.msg(spec.featureLang(projectDir, r.feature)).projectChecks.recorded(r.recordedChecks.length));
          log(r.message);
          r.blockers.forEach((b) => log("  ✗ " + b));
          (r.warnings || []).forEach((w) => log("  ▲ " + w)); // EC/NFR/SC and tests-in-code — never blockers
          log("\n" + r.checks.map((x) => "  [ ] " + x).join("\n"));
          if (r.wrote) log(T.mergeSummaryAt(r.paths.summary));
          if (r.baseline && r.baseline.recorded) {
            const D = spec.msg(spec.featureLang(projectDir, r.feature)).drift;
            log(D.baselineRecorded(r.baseline.files, r.baseline.missing));
            const rp = r.baseline.replaced; // a re-finish over a drifted baseline: the drift it accepted
            if (rp) { const list = [...rp.changed, ...rp.missing, ...rp.nowPresent]; log("  " + D.baselineReplaced(list.length, spec.dayOf(rp.at) || "?", list.join(", "))); }
          } else if (r.baseline && r.baseline.error) err("dev-spec: " + r.baseline.error); // a broken .state.json is never rewritten
          if (r.mergeSummary != null) log("\n# " + r.mergeTitle + "\n\n" + r.mergeSummary);
        });
      };
      if (!on("run")) return report(undefined, undefined);
      const runStart = spec.runStartStamp(projectDir, pos[0]); // 1.22 review: `at` and the code stamp BEFORE the checks run
      return RUN.runChecks(pos[0], { projectDir, resolveShell: () => runShell(c), say: c.say, warn: err, gitState: () => GIT.gitState(projectDir), execOpts: () => c.execOpts() })
        .then((rc) => (rc.ok ? report(rc.evidence, runStart) : fail(rc, rc.hint)));
    },
  },
  {
    name: "append-tasks",
    options: ["task", "req", "implements", "verify", "story", "parallel", "makes-green", "expect-fail", "size", "depends", "heading"], max: 1,
    args: ["@feature"],
    values: { size: "@task-size", story: "shared" },
    help: `  append-tasks <feature> --task "…"   Append one task to tasks.md, numbered after the last (default phase 'Phase: Convergence'):
                                  --req US-1.AC-2[,…] (must exist) · --implements path[,…] · --verify "<cmd>" · --story US1|shared · --parallel · --heading "…"
                                  · --makes-green T-01[,…] (planned in test-plan.md) · --expect-fail (_Expect: fail_) · --size XS|S|M|L|XL
                                  · --depends 3,5 (_Depends:_ — task numbers of this tasks.md; must exist, no cycle)`,
    run(c) {
      // dev-spec append-tasks <feature> --task "<text>" [...] — ONE task per call; = spec_append_tasks {tasks: [that task]}
      const { flags, pos, projectDir, on, out, fail, usage, log } = c;
      if (!pos[0] || typeof flags.task !== "string") usage('dev-spec append-tasks <feature> --task "<text>" [--req US-1.AC-2[,…]] [--implements path[,…]] [--verify "<cmd>"] [--makes-green T-01[,…]] [--expect-fail] [--size XS|S|M|L|XL] [--depends 3[,5]] [--story US1|shared] [--parallel] [--heading "<phase heading>"]');
      const T = spec.msg(spec.featureLang(projectDir, pos[0])).appendTasks;
      // The shared parser keeps only the LAST value of a repeated flag, so `--req a --req b` silently dropped a: every occurrence is
      // collected (c.every). A second --task is a second task (one per call), a second --verify would drop the first check (the
      // evidence gate would never ask for it), a second --story / --heading / --size the first choice — each refused before
      // anything runs, in append-tasks' own words (refuseRepeatedFlags, 1.24 r6 B5: every single-value flag now).
      const task = { text: flags.task };
      const reqs = c.every("req"), impls = c.every("implements");
      if (reqs.length) task.requirements = reqs; // each may hold "a,b" — the engine splits it, same as over MCP
      if (impls.length) task.implements = impls;
      if (typeof flags.verify === "string") task.verify = flags.verify;
      if (typeof flags.story === "string") task.story = flags.story;
      if (flags.parallel != null) task.parallel = on("parallel");
      // full review Ga6: = the MCP task fields makesGreen / expectFail / size (repeatable --makes-green, "T-01,T-02" split by the engine)
      const greens = c.every("makes-green");
      if (greens.length) task.makesGreen = greens;
      if (flags["expect-fail"] != null) task.expectFail = on("expect-fail");
      if (typeof flags.size === "string") task.size = flags.size;
      const deps = c.every("depends"); // 1.14 F3: = the MCP task field depends (repeatable, "3,5" / "#3" split by the engine)
      if (deps.length) task.depends = deps;
      const r = spec.appendTasks(projectDir, pos[0], [task], { heading: typeof flags.heading === "string" ? flags.heading : undefined });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        log(T.appended(r.heading, r.headingCreated, r.file));
        r.appended.forEach((t) => log("  - [ ] " + t.number + ". " + t.text));
        if (r.note) log("  ⚠ " + r.note);
      });
    },
  },
  {
    name: "approve",
    options: ["by", "force", "role", "through", "reason", "expires", "revoke"], max: 2,
    args: ["@feature", "@phase"],
    help: `  approve <feature> <phase> [--force]  Record a phase approval (.state.json) — refused while that phase's checks fail;
                                  --force records it anyway (flagged as forced, with the failing checks); --role ROLE signs off as
                                  that role (required for a phase init --roles lists); with --force, --reason "…" and
                                  --expires YYYY-MM-DD|30d record its waiver (doctor warns waiver-expired once it lapses)
  approve <feature> <phase> --revoke [--reason "…"]   Revoke a phase approval (and the role sign-offs waiting for it): the
                                  phase is pending again; later phases stay approved (never cascades)
  approve <feature> --through <phase>  Fast-forward (/approve --through): approve every active phase up to <phase>, in order, each through its
                                  own gate — stops at the first refused gate (exit 1) or a phase still waiting for another role`,
    run(c) {
      // --through <phase> = the fast-forward (spec_approve {through}); --role <role> = the sign-off's role (spec_approve {role}).
      const { flags, pos, projectDir, on, out, fail, usage, log } = c;
      const through = typeof flags.through === "string" ? flags.through : undefined;
      if (!pos[0] || (!pos[1] && through === undefined)) usage("dev-spec approve <feature> <phase> [--force [--reason \"…\"] [--expires YYYY-MM-DD|Nd]] [--by NAME] [--role ROLE] | dev-spec approve <feature> <phase> --revoke [--reason \"…\"] | dev-spec approve <feature> --through <phase>");
      // Default approver: the engine's (same as MCP). --force = spec_approve {force: true}; a refusal exits 1 listing the failing checks.
      const r = spec.approvePhase(projectDir, pos[0], pos[1], typeof flags.by === "string" ? flags.by : undefined,
        { force: on("force"), role: typeof flags.role === "string" ? flags.role : undefined, ...(through !== undefined ? { through } : {}),
          reason: flags.reason, expires: flags.expires, revoke: on("revoke") }); // 1.16 U2 / U3 (= spec_approve {revoke, reason, expires})
      if (!r.ok) return fail(r); // a fast-forward stopped at a refused gate: its error names what was approved before it
      const GV = spec.msg(spec.featureLang(projectDir, r.feature)).governance;
      return out(r, (r) => {
        if (r.revoked) return log(r.message); // 1.16 U2: what was revoked, and that nothing cascades
        if (r.through) { // the fast-forward: its summary, then one line per phase it reached
          log(r.message);
          (r.steps || []).forEach((s) => log("  " + (s.approved ? "✓" : "◐") + " " + s.phase + (s.role ? " [" + s.role + "]" : "") +
            (s.missingRoles && s.missingRoles.length ? " — " + GV.missing(s.missingRoles) : "") + (s.forced ? GV.stepForced(s.failing || []) : "")));
          return;
        }
        log(r.approved ? c.featureText(r.feature).approved(r.approved, r.feature) : GV.signedOff(r.signedOff, r.feature, r.role));
        // a forced approval names the checks that were failing; a role sign-off, the roles still missing (or that all signed)
        if (r.note) log((r.forced || r.pending ? "  ⚠ " : "  ") + r.note);
      });
    },
  },
  {
    name: "impact",
    options: ["phase", "reopen"], max: 1,
    args: ["@feature"],
    help: `  impact <feature> [--phase p] [--reopen]   What an edit after approval touches, against the approved snapshot
                                  (--phase requirements|design|test-plan|eval-plan|tasks, default requirements): changed ACs/sections/tests/tasks →
                                  tasks, tests, design; --reopen unticks the affected done tasks and marks their evidence stale
                                  (never a removed criterion's tasks — retire lists them and their test rows to delete or repoint)
  impact [feature] --phase steering   Every active feature (or the one named) whose requirements / design approval was made under
                                  a steering file (constitution, the tracks' files, always / matching fileMatch ones) that changed
                                  since — read-only; re-review, then re-approve (the approval records the current steering)`,
    run(c) {
      // dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen] — the same engine call as spec_impact;
      // 1.16 Q1: `impact [feature] --phase steering` — the features approved under steering that changed since (no feature = all)
      const { flags, pos, projectDir, on, out, fail, usage, log } = c;
      const steeringPhase = String(flags.phase == null ? "" : flags.phase).trim().toLowerCase() === "steering";
      if (!pos[0] && !steeringPhase) usage("dev-spec impact <feature> [--phase requirements|design|test-plan|eval-plan|tasks] [--reopen] · dev-spec impact [feature] --phase steering");
      const r = spec.impactReport(projectDir, pos[0], { phase: flags.phase, reopen: on("reopen") });
      if (!r.ok) return fail(r);
      return out(r, (r) => spec.impactLines(r).forEach((l) => log(l)));
    },
  },
  {
    name: "metrics",
    options: ["write"], max: 1,
    args: ["@feature"],
    help: `  metrics [feature] [--write]     Lead times, rework, forced approvals, change requests, evidence pass rate, velocity (project: + avg/median);
                                  --write → .specs/<feature>/retro.md (a pre-filled retrospective, never overwritten)`,
    run(c) {
      // dev-spec metrics [feature] [--write] — one feature (+ retro.md with --write) or the whole project; = spec_metrics
      const { pos, projectDir, on, out, fail, log } = c;
      const r = spec.metrics(projectDir, pos[0], { write: on("write") });
      if (!r.ok) return fail(r);
      return out(r, (r) => spec.metricsLines(r).forEach((l) => log(l)));
    },
  },
  {
    name: "add-track",
    options: ["tracks", "remove"],
    args: ["@feature", "@optional-track..."],
    help: `  add-track <feature> <track...>  Escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data (additive, never overwrites);
                                  --remove turns a track off (non-destructive: files kept, listed as inactive);
                                  a project track pack (dev-spec tracks) is named the same way`,
    run(c) {
      const { pos, projectDir, on, out, fail, usage, log } = c;
      const tr = c.withTracksFlag(pos.slice(1));
      if (!pos[0] || !tr.length) usage("dev-spec add-track <feature> <tdd|saas|ai|sec|privacy|dist|api|ui|obs|data>... (or a track pack's name — dev-spec tracks) [--remove]");
      // Several tracks at once ("saas ai", "saas,ai"); --remove turns them off (files kept, listed as inactive).
      const r = spec.addTrack(projectDir, pos[0], tr, { remove: on("remove") });
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        log(c.featureText(r.feature).trackNow(r.feature, r.tracks));
        if (r.added && r.added.length) log("  + " + r.added.join(", "));
        if (r.inactive && r.inactive.length) log("  ~ " + r.inactive.join(", "));
        if (r.note) log("  " + r.note);
      });
    },
  },
  {
    name: "feature",
    options: ["yes", "flow"], // its arguments per action (remove / archive / restore: 2, rename / flow: 3) — checked in its handler (1.24 r6 B4)
    args: ["remove archive rename restore flow"],
    sub: { remove: [null, "@feature"], archive: [null, "@feature"], rename: [null, "@feature"], restore: [null, "@archived"], flow: [null, "@feature", "@flow"] },
    help: `  feature <remove|archive|rename|restore> <name> [new-name]   Manage a feature's lifecycle (remove shows what it would delete; --yes deletes;
                                  restore brings an archived feature back with its roadmap entry and dependencies)
  feature flow <name> <requirements-first|design-first>   Set a feature's phase order (a bugfix keeps its own)`,
    run(c) {
      // dev-spec feature <remove|archive|rename|restore|flow> <name> [new-name|flow] — remove needs --yes (= spec_feature confirm:true);
      // flow <name> <requirements-first|design-first> (or --flow) = spec_feature {action: "flow", flow} (C3)
      const { flags, pos, projectDir, on, out, fail, usage, die, log } = c;
      if (!pos[0] || !pos[1]) usage("dev-spec feature <remove|archive|rename|restore|flow> <name> [new-name|requirements-first|design-first] [--yes]");
      // 1.24 r6 B4: each action reads its own arguments — remove / archive / restore the name, rename + the new name, flow + the
      // flow (or --flow, never both) — and --flow only on flow: a word past them (or --flow elsewhere) was ignored silently.
      const act = String(pos[0]).trim().toLowerCase();
      const most = { remove: 2, archive: 2, restore: 2, rename: 3, flow: flags.flow !== undefined ? 2 : 3 }[act];
      if (most !== undefined && pos.length > most) die(c.projectText().extraArgs("feature " + act, pos.slice(most).join(" ")), c.unknownArg(String(pos[most])));
      if (most !== undefined && act !== "flow" && flags.flow !== undefined) die(c.projectText().flagNotFor("--flow", "feature " + act, act === "remove" ? "--yes" : ""), c.unknownArg("--flow"));
      const T = c.featureText(pos[1]); // resolved BEFORE the folder moves or disappears
      const r = spec.manageFeature(projectDir, pos[0], pos[1], pos[2], { confirm: on("yes"), flow: flags.flow });
      if (!r.ok && r.needsConfirm) {
        // Without --yes: show what would be deleted, delete nothing, exit 1.
        c.exitCode = 1;
        return out(r, (r) => {
          // 1.24 r6: a linked feature folder — only the link goes (the engine's message says so), never "0 file(s)"
          if (r.link) log(r.error);
          else log(T.wouldRemove(r.feature, r.wouldDelete.dir, r.wouldDelete.files, r.wouldDelete.entries.join(", ")));
          log(T.confirmHint(r.feature));
        });
      }
      if (!r.ok) return fail(r);
      return out(r, (r) => {
        if (r.action === "rename") {
          log(T.renamed(r.from, r.to));
          if (r.note) log("  " + r.note); // _Supersedes:_ references / archive records that follow the new name
        }
        else if (r.action === "archive") {
          log(T.archived(r.feature, String(r.dest).replace(/\\/g, "/")));
          // the dependents whose dependsOn the archive pruned — a warning when the archived work was never finished
          if (r.note) log((r.incompleteDependency ? "  ⚠ " : "  ") + r.note);
        }
        else if (r.action === "flow") log(r.note); // C3: the flow, the phase order (and the phases that stay approved)
        else if (r.action === "restore") {
          const RT = spec.msg(spec.featureLang(projectDir, r.feature)).restore; // back in place: its own language
          log(RT.done(r.feature));
          if (r.note) log("  ⚠ " + r.note);
        }
        else log(T.removed(r.feature));
      });
    },
  },
  {
    name: "catalog",
    options: ["write", "include-body"], max: 0,
    help: `  catalog [--write]               Living catalog: every feature's ACs, superseded ones marked (_Supersedes:_); --write → .specs/SPECS.md
                                  (--json: the structure; --include-body adds the markdown)`,
    run(c) {
      // dev-spec catalog [--write] [--include-body] — the living .specs/SPECS.md (= spec_export {format: "catalog", write, includeBody}).
      // Without --write the markdown is printed (--json: with --include-body); a hand-written SPECS.md (no AUTO-GENERATED marker) is
      // never overwritten → exit 1.
      const { flags, projectDir, on, out, log, err, write } = c;
      const r = spec.catalog(projectDir, { write: on("write"), includeBody: c.bodyWanted() });
      if (r.ok === false) c.exitCode = 1;
      if (!flags.json && r.error) err("dev-spec: " + r.error);
      const C = spec.msg(r.lang).catalog;
      return out(r, (r) => {
        if (r.wrote) log(C.cliWrote(r.file, r.totals.features, r.totals.acs, r.totals.superseded));
        else if (r.markdown != null) write(r.markdown);
      });
    },
  },
  {
    name: "export",
    options: ["md", "html", "csv", "gherkin", "adr", "tracker", "write", "include-body"],
    args: ["@feature"],
    help: `  export [feature] [--md] [--write]   One printable document for stakeholders — a feature (stories + EARS ACs, design, test plan,
                                  tasks with their verification, approvals, open clarifications) or, without one, the whole project;
                                  offline HTML (light/dark, print-ready) or --md; --write → .specs/exports/<feature|project>.html|.md
                                  --csv: the traceability matrix for a spreadsheet (UTF-8 BOM, the AUTO-GENERATED marker as its
                                  last record) → --write: .specs/exports/<feature|project>.rtm.csv
                                  --json without --write: html / md give a preview (--include-body: the whole document)
                                  --gherkin: a BDD .feature — one Scenario per current AC (tags @US-n.AC-m @T-xx @<track>), its EARS
                                  clauses as Given (WHILE/WHERE/IF) · When (WHEN) · Then (SHALL), PT/ES in Gherkin's own dialect;
                                  no feature = one file per feature → --write: .specs/exports/<feature>.feature
                                  --tracker jira|linear: a CSV for the tracker's own importer (nothing is sent) — the feature as the
                                  parent, its stories, its tasks under their [USn] story; labels = slug, tracks, AC IDs
                                  → --write: .specs/exports/<feature|project>.<tracker>.csv
                                  --adr: the decision log as Architecture Decision Records — one MADR file per decision (ADR
                                  number = its D-n; discoveries left out; superseded ones linked both ways) + an index; no
                                  feature = every feature's (archived too) + adr/index.md → --write: .specs/exports/adr/
                                  <feature>/NNNN-<title>.md — unchanged files kept, the generated ones no decision backs removed`,
    run(c) {
      // dev-spec export [feature] [--md|--csv|--gherkin|--adr|--tracker jira|linear] [--write] — the stakeholder document (= spec_export
      // {name, format, write}): printed on stdout, or written to .specs/exports/ (never over a hand-written file → exit 1). No feature =
      // the whole project (--gherkin: one .feature per feature; --adr: every feature's ADRs + adr/index.md). --tracker takes the tool's
      // name (the MCP format).
      const { flags, pos, projectDir, on, out, fail, usage, die, log, err, write } = c;
      const syntax = "dev-spec export [feature] [--md|--csv|--gherkin|--adr|--tracker jira|linear] [--write] [--include-body]";
      const tracker = flags.tracker === undefined ? null : String(flags.tracker).trim().toLowerCase();
      if (pos.length > 1 || [on("md"), on("html"), on("csv"), on("gherkin"), on("adr"), tracker !== null].filter(Boolean).length > 1) usage(syntax);
      if (tracker !== null && !spec.TRACKERS.includes(tracker)) {
        const A = spec.msg(spec.projectLang(projectDir)).args;
        die(A.invalid(A.item("--tracker", A.oneOf(spec.TRACKERS.join(", ")), JSON.stringify(String(flags.tracker)))), c.invalidArg("--tracker"));
      }
      const format = tracker || (on("md") ? "md" : on("csv") ? "csv" : on("gherkin") ? "gherkin" : on("adr") ? "adr" : "html");
      const r = spec.exportSpecs(projectDir, { name: pos[0], format, write: on("write"), includeBody: c.bodyWanted() }); // --json: the preview unless --include-body
      if (!r.ok) return fail(r);
      const M = spec.msg(r.lang);
      const relOut = (f) => path.relative(projectDir, f).split(path.sep).join("/");
      return out(r, (r) => {
        if (r.format === "adr") { // 1.25: one MADR file per decision + the indexes — written (and the stale ones removed), or each printed under its path
          const A = M.adr;
          if (r.written) { // --write
            r.written.forEach((f) => log(M.stakeholderExport.wrote(f)));
            r.removed.forEach((f) => log(A.removed(f)));
            if (r.note) log(r.note);
            return log(A.summary(r.adrs, r.written.length, r.unchanged.length, r.removed.length));
          }
          if (r.note) err(r.note); // stdout stays the documents alone
          r.stale.forEach((f) => err(A.stale(relOut(f))));
          return r.documents.forEach((d, i) => write((i ? "\n" : "") + "<!-- ── " + relOut(d.file) + " ── -->\n" + d.content));
        }
        if (r.format === "gherkin" && r.scope === "project") { // one .feature per feature: written, or each printed under its path
          if (r.wrote) { r.files.forEach((f) => log(M.stakeholderExport.wrote(f))); return log(M.gherkin.wroteMany(r.files.length, r.scenarios)); }
          if (!r.documents.length) return log(M.gherkin.noFeatures);
          return r.documents.forEach((d, i) => write((i ? "\n" : "") + "# ── " + path.relative(projectDir, d.file).split(path.sep).join("/") + " ──\n" + d.content));
        }
        if (r.wrote) return log(tracker ? M.trackerCsv.wrote(r.file, r.records) : M.stakeholderExport.wrote(r.file));
        write(r.content);
      });
    },
  },
  {
    name: "changelog",
    options: ["since", "write", "milestone", "include-body"],
    help: `  changelog [--since d] [--write] Release notes from the specs: Added (shipped features + their ACs) · Changed (superseded ACs,
                                  change requests) · Fixed (bugfixes + root cause); --since <ISO date|last|all> (default: since the
                                  last written notes); --write → .specs/RELEASE-NOTES.md and stamps meta.changelogAt
                                  --milestone <name>: only that milestone's features (since: all by default) → --write:
                                  .specs/RELEASE-NOTES.<milestone>.md (meta.changelogAt untouched); --json: + the markdown with --include-body`,
    run(c) {
      // dev-spec changelog [--since <ISO date|last|all>] [--write] — release notes from the specs (= spec_export {format: "changelog"}):
      // the markdown on stdout (a note on stderr; --json: with --include-body), or --write → .specs/RELEASE-NOTES.md + meta.changelogAt
      // (exit 1 on a refusal).
      const { flags, pos, projectDir, on, out, fail, usage, log, err, write } = c;
      if (pos.length) usage("dev-spec changelog [--since <ISO date|last|all>] [--milestone <name>] [--write] [--include-body]");
      const r = spec.changelog(projectDir, { since: flags.since, write: on("write"), milestone: flags.milestone, includeBody: c.bodyWanted() });
      if (!r.ok) return fail(r);
      const N = spec.msg(r.lang).releaseNotes;
      return out(r, (r) => {
        if (r.wrote) log(N.wrote(r.file, r.counts.added, r.counts.changed, r.counts.fixed));
        if (r.markdown != null) {
          if (r.note) err(r.note); // stdout stays the markdown alone (pipe it into a file)
          write(r.markdown);
        } else if (r.note) log(r.note);
      });
    },
  },
  {
    name: "milestone",
    aliases: ["milestones"],
    options: [],
    args: ["@milestone-action"], sub: { add: [null, null, null, "@feature..."] },
    help: `  milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list]   Milestones (roadmap.json meta.milestones): a target date
                                  for a set of features, judged against their ETAs — on-track · at-risk · late · done; add replaces
                                  an existing one; rename / remove / archive of a feature follow; ROADMAP.md shows them`,
    run(c) {
      // dev-spec milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list] (= spec_roadmap_edit {kind: "milestone", action, name, date, features}):
      // a name with spaces is quoted; the features may also be comma-separated. The action is case-folded, like the MCP enum.
      const { pos, projectDir, out, fail, usage, log } = c;
      const a0 = String(pos[0] == null ? "" : pos[0]).trim().toLowerCase() || "list";
      const syntax = "dev-spec milestone [add <name> <YYYY-MM-DD> <features…> | rm <name> | list]";
      if ((a0 === "list" && pos.length > 1) || ((a0 === "rm" || a0 === "remove") && pos.length !== 2)) usage(syntax);
      const r = spec.milestone(projectDir, a0, a0 === "add" ? { name: pos[1], date: pos[2], features: pos.slice(3) } : { name: pos[1] });
      if (!r.ok) return fail(r);
      return out(r, (r) => r.lines.forEach((l) => log(l)));
    },
  },
  {
    name: "drift",
    options: [], max: 1,
    args: ["@feature"],
    help: `  drift [feature]                 Implementing files changed / missing / new since finish recorded its baseline (exit 1 on drift or a stale baseline)`,
    run(c) {
      // dev-spec drift [feature] — implementing files changed / missing / now present since spec_finish recorded the baseline
      // (= spec_drift {name}); exit 1 when any finished feature drifted, a baseline is stale (the feature changed since its finish:
      // finish it again) or a state file couldn't be read (a check that didn't run is not "clean" — scriptable, like trace).
      const { pos, projectDir, out, fail, log, err } = c;
      const r = spec.drift(projectDir, pos[0]);
      if (!r.ok) return fail(r);
      if (r.drifted.length || r.stale.length || (r.errors && r.errors.length)) c.exitCode = 1;
      const D = spec.msg(r.lang).drift;
      const day = spec.dayOf; // 1.25.1: the local calendar date
      return out(r, (r) => {
        if (r.note) log(r.note);
        for (const f of r.features) {
          const n = f.changed.length + f.missing.length + f.nowPresent.length;
          if (!f.drifted) { log(D.clean(f.feature, f.files, day(f.finishedAt), f.archived)); continue; }
          log(D.drifted(f.feature, n, f.files, day(f.finishedAt), f.archived));
          if (f.changed.length) log(D.changed(f.changed.join(", ")));
          if (f.missing.length) log(D.missing(f.missing.join(", ")));
          if (f.nowPresent.length) log(D.nowPresent(f.nowPresent.join(", ")));
        }
        for (const s of r.stale) log(D.stale(s.feature, day(s.finishedAt), s.why, s.archived));
        if (r.reopened.length) log(D.reopened(r.reopened.join(", ")));
        if (r.unbaselined.length) log(D.unbaselined(r.unbaselined.join(", ")));
        (r.errors || []).forEach((e) => err("dev-spec: " + e.error));
      });
    },
  },
  {
    name: "stop-check",
    options: ["message", "agent"],
    help: `  stop-check [--message "<text>"|-] [--agent <type>]   The Stop hook's evidence gate: does a closing message claim done /
                                  verified (EN/PT/ES) while a feature active in the last hours has ticked tasks without verification
                                  evidence? Prints the reason it would send the turn back (exit 1) or why it lets it end; - reads stdin;
                                  --agent spec-implementer checks the task report named in the message instead,
                                  --agent spec-simplifier the simplification report (its last '## Final runs' must all pass)`,
    run(c) {
      // = the Stop / SubagentStop hook's decision (spec.stopCheck): the closing message from --message "<text>", the words after the
      // command, or stdin (--message - / a lone -); --agent <subagent type> (a spec-implementer is checked on its report, a
      // spec-simplifier on its simplification report). Exit 1 when the turn would be sent back (scriptable, like doctor); --json prints the result.
      const { flags, pos, projectDir, usage, log } = c;
      const runCheck = (message) => {
        const r = spec.stopCheck(projectDir, { message, agent: typeof flags.agent === "string" ? flags.agent : "" });
        if (flags.json) log(JSON.stringify(r, null, 2));
        else if (r.block) log(r.reason);
        else {
          const A = spec.msg(r.lang).stopGate.allow;
          log(Object.prototype.hasOwnProperty.call(A, r.why) ? A[r.why]({ hours: spec.STOP_RECENT_HOURS, list: (r.verifiedFeatures || []).join(", "), n: r.task, slug: r.feature }) : r.why);
        }
        c.exitCode = r.block ? 1 : 0;
      };
      // 1.24 r6 B4: the message is --message OR the words after the command (or a lone - : stdin) — both given, the words were dropped
      if (flags.message !== undefined && pos.length) usage('dev-spec stop-check [--message "<text>" | <words…> | -] [--agent <type>]');
      if (flags.message === "-" || (flags.message === undefined && pos.length === 1 && pos[0] === "-")) return c.readStdin(runCheck);
      return runCheck(typeof flags.message === "string" ? flags.message : pos.join(" "));
    },
  },
  {
    name: "log",
    options: ["max"], max: 2, // <feature> [-]
    args: ["@feature", "-"],
    help: `  log <feature> [--max N] [-]     Per task, the commits whose message cites it — "task #N" / "#N" with the feature name (as /executeTask commit
                                  writes "Part of .specs/<feature>/ task #N."), or its T-/AC IDs ("Makes T-01 green") — and, +tdd, a
                                  red-first check (implementation committed before its test?); reads git log (read-only, local, --max
                                  commits, default 1000 — from the commit it started on when it has its own branch: create --branch);
                                  - reads a log from stdin (git log --name-only --relative)`,
    run(c) {
      // dev-spec log <feature> [--max N] [-] — per task, the commits whose message cites it (+ the +tdd red-first check), from `git log`
      // (read-only, local, bounded by --max, default 1000); "-" reads a log from stdin instead (e.g. an agent's
      // `git log --name-only --relative`). The engine only parses the text (taskCommits) — it never runs git.
      const { pos, projectDir, out, fail, usage, log } = c;
      if (!pos[0] || (pos[1] != null && pos[1] !== "-")) usage("dev-spec log <feature> [--max N] [-]"); // a second word is "-" (stdin) or nothing
      const fx = spec.existingFeature(projectDir, pos[0]);
      if (!fx.ok) return fail(fx);
      const max = c.intFlag("max") || 1000;
      const report = (text, opts) => {
        const r = spec.taskCommits(projectDir, pos[0], text, opts);
        if (!r.ok) return fail(r);
        return out(r, (r) => r.lines.forEach((l) => log(l)));
      };
      if (pos[1] === "-") return c.readStdin((text) => report(text, { max: c.intFlag("max") })); // --max: the window the piped log was read with (= spec_log {max})
      const logArgs = ["-c", "core.quotePath=false", "-c", "log.showSignature=false", "log", "--no-color", "--no-decorate", "--no-abbrev-commit",
        "--pretty=medium", "--date=iso-strict", "--name-only", "--relative", "--max-count=" + max];
      // 1.25: a feature started on its own branch (create --branch) recorded the commit it started from — the log is read from there
      // (`<commit>..HEAD`: older commits are no work of this feature); a commit git no longer knows → the whole log, as before.
      const fb = spec.featureBranch(projectDir, fx.slug);
      const since = fb && fb.commit ? { base: fb.base, commit: fb.commit } : null;
      let text = since ? GIT.gitText([...logArgs, since.commit + "..HEAD", "--"], { cwd: projectDir }) : null;
      const ranged = text != null;
      if (!ranged) text = GIT.gitText(logArgs, { cwd: projectDir });
      if (text == null) return fail({ ok: false, error: spec.msg(spec.featureLang(projectDir, fx.slug)).gitLog.noGit });
      return report(text, { max, since: ranged ? since : null }); // null: the whole log on purpose — the engine applies no range of its own
    },
  },
  {
    name: "merge-state",
    options: ["install", "uninstall", "check", "kind"],
    args: ["@file..."],
    values: { kind: "state roadmap generated" },
    help: `  merge-state [--install|--uninstall|--check] [--project <dir>]   Teams: git merges the spec state SEMANTICALLY — .gitattributes
                                  (commit it) + this clone's git config (merge.dev-spec-state.driver; every teammate runs it once, and
                                  again after each plugin update — the driver names this clone's path); --uninstall removes both;
                                  --check (read-only): exit 1 when the configured driver runs another or a missing script, or when
                                  .gitattributes names the driver and this clone has none.
                                  Git then runs merge-state <base> <ours> <theirs> <path> on .state.json / roadmap.json: approvals,
                                  ticks, evidence and history of both branches are united; a real conflict (a meta value both sides
                                  set differently) exits 1 with ours kept and the file listing it under "mergeConflicts" (valid
                                  JSON; doctor fails merge-conflicts until it is resolved); ROADMAP.md / SPECS.md keep ours`,
    run(c) {
      // 1.21 F1a — git's merge driver for the spec state: merge-state <base> <ours> <theirs> [<path>] (git's %O %A %B %P) merges
      // .state.json / roadmap.json SEMANTICALLY (spec.mergeStateText) and writes the result to <ours> — exit 0 merged, 1 a real
      // conflict (ours kept at each, listed in the file as "mergeConflicts" — valid JSON, doctor fails merge-conflicts). The generated
      // overviews (ROADMAP.md / .html, SPECS.md) keep ours. --install / --uninstall: .gitattributes + this clone's git config
      // (merge.dev-spec-state.*) — the only git this command runs besides `git merge-file` for a hand-written overview.
      // --check (1.21 review A3): read-only — does git config's driver still run THIS clone's CLI? (a plugin update moves it)
      const { flags, pos, on, usage } = c;
      const msUsage = "dev-spec merge-state <base> <ours> <theirs> [<path>] · dev-spec merge-state --install | --uninstall | --check [--project <dir>]";
      const check = flags.check === true || /^(?:true|1|yes|on)$/i.test(String(flags.check === undefined ? "" : flags.check));
      if (flags.check !== undefined && !check && !/^(?:false|0|no|off)$/i.test(String(flags.check))) usage(msUsage);
      if (check) { if (pos.length || on("install") || on("uninstall")) usage(msUsage); return mergeDriverCheck(c); }
      // 1.24 r6 B4: --install / --uninstall take no file arguments, and not both (the file arguments, or --install, were ignored)
      if ((on("install") || on("uninstall")) && (pos.length || (on("install") && on("uninstall")))) usage(msUsage);
      if (on("install") || on("uninstall")) return mergeDriverSetup(c, on("uninstall"));
      if (pos.length < 3 || pos.length > 4) usage(msUsage);
      return mergeStateRun(c, pos[0], pos[1], pos[2], pos[3]);
    },
  },
  {
    name: "upgrade",
    options: ["apply"], max: 0,
    help: `  upgrade [--apply]               After a plugin update: audit every active feature against the current rules (read-only) — status,
                                  what doctor flags, next step, review (critic / converge); --apply saves inferred tracks, seeds the
                                  approval history, stamps meta.specVersion and writes .specs/UPGRADE.md (never edits a spec)`,
    run(c) {
      // dev-spec upgrade [--apply] — after a plugin update (= spec_upgrade {apply}): the audit of every active feature against the
      // current rules (read-only), or --apply: the safe migrations + .specs/UPGRADE.md. A report exits 0; an error (no .specs/, a
      // broken roadmap.json, a feature that couldn't be migrated) exits 1.
      const { projectDir, on, out, fail, log } = c;
      const r = spec.specUpgrade(projectDir, { apply: on("apply") });
      if (!r.ok) return fail(r);
      if (r.migrations && r.migrations.errors.length) c.exitCode = 1;
      return out(r, (r) => spec.upgradeLines(r).forEach((l) => log(l))); // 1.26: rendered from the result (it carries no lines)
    },
  },
  {
    name: "roadmap",
    options: ["write", "md", "html", "lang"], max: 0,
    help: `  roadmap [--write][--html][--lang]  Roadmap: %, deps, blocked, cycles, ETA per feature (velocity from ticked tasks, _Size: XS|S|M|L|XL_), cross-feature file overlaps. --write (alias --md) → .specs/ROADMAP.md (default); --html also writes the brand-styled ROADMAP.html (light/dark); --lang en|pt|pt-BR|es`,
    run(c) {
      // Same engine call as spec_roadmap: a failed write (e.g. a hand-written ROADMAP.md) is an error → exit 1.
      const { flags, projectDir, on, out, log, err } = c;
      const r = spec.roadmapReport(projectDir, { write: on("write") || on("md"), html: on("html"), lang: flags.lang });
      if (r.ok === false) c.exitCode = 1;
      const T = c.cliText(flags.lang || spec.projectLang(projectDir));
      if (!flags.json) {
        (r.wrote || []).forEach((file, i) => log(i === 0 && /\.md$/i.test(file) ? T.wrote(file, r.overallPercent, r.complete, r.total) : T.wrote(file)));
        (r.errors || []).forEach((e) => err("dev-spec: " + e));
        (r.warnings || []).forEach((w) => err("dev-spec: " + w)); // e.g. a hand-written ROADMAP.html kept (non-fatal)
      }
      return out(r, (r) => { // --json stays one valid JSON document (wrote/errors/warnings included)
        if (!r.features.length) return log(T.noRoadmapFeatures(r.specsDir));
        log(T.roadmapHead(r.overallPercent, r.complete, r.total, r.cycle ? r.cycle.join(" → ") : null));
        // + each feature's ETA when it has one, then the velocity / ETA rule / cross-feature overlaps (spec_roadmap's forecast,
        // velocity, overlaps) — nothing new for a project with no completed task and no overlap.
        const lang = flags.lang || spec.projectLang(projectDir);
        const eta = (f) => { const e = spec.etaText(f.forecast, lang, true); return e ? "  · " + e : ""; };
        r.features.forEach((f) => log("  " + (f.blocked ? "⛔" : "  ") + " " + f.name.padEnd(26) + " " + String(f.percent + "%").padStart(4) + "  [" + f.tracks + "]  " + T.phase(f.phase) + (f.dependsOn.length ? T.deps(f.dependsOn.join(","), f.unmetDeps.join(",")) : "") + eta(f)));
        spec.roadmapTailLines(r, lang).forEach((l) => log(l));
      });
    },
  },
  {
    name: "depend",
    options: ["add", "rm", "clear", "order"],
    args: ["@feature", "@feature..."],
    values: { add: "@feature", rm: "@feature" },
    help: `  depend <feature> [deps...]      Show / set dependencies: deps replace the list; --add x,y · --rm x · --clear · --order N
                                  (every dep must be an existing feature; cycles are rejected)`,
    run(c) {
      const { flags, pos, projectDir, on, out, fail, usage, log } = c;
      const syntax = "dev-spec depend <feature> [dep1 dep2 ...] [--add x[,y]] [--rm x[,y]] [--order N] [--clear]";
      // 1.24 r6 B4: deps (they REPLACE the list) and --clear (it empties it) contradict each other — the deps won silently
      if (!pos[0] || (on("clear") && pos.length > 1)) usage(syntax);
      // The shared parser keeps only the LAST value of a repeated flag, so `--add b --add c` silently added c alone: every occurrence
      // is collected (c.every).
      const adds = c.every("add"), rms = c.every("rm");
      if (adds.concat(rms).some((v) => typeof v !== "string")) usage(syntax);
      // Same semantics as the MCP tool: positional deps REPLACE the list, --clear empties it, --add/--rm edit it; with nothing at all
      // it only shows the current deps (a bare `depend <f>` used to clear them).
      const deps = pos.slice(1).length ? pos.slice(1) : on("clear") ? [] : undefined;
      const r = spec.setDependency(projectDir, pos[0], deps, flags.order, { add: adds.length ? adds.join(",") : undefined, remove: rms.length ? rms.join(",") : undefined });
      if (!r.ok) return fail(r);
      return out(r, (r) => log(c.projectText().dependsOn(r.feature, r.dependsOn.join(", "), r.order, r.unknownDeps.join(", ")))); // project language, like the engine's depend messages
    },
  },
  {
    name: "backlog",
    options: [], // add <name> [note words…] · rm|remove <name> · list — checked in its handler
    args: ["@backlog-action"],
    help: `  backlog [add|rm|remove <name> [note]]  Manage planned-but-unspecced features (shown in ROADMAP.md)`,
    run(c) {
      const { pos, projectDir, out, fail, die, log } = c;
      const a0 = String(pos[0] == null ? "" : pos[0]).trim().toLowerCase(); // case-folded, like the engine and the MCP enum
      // No action lists; an unknown one (delete, ad…) is an error from the engine, as over MCP — it used to just list.
      const action = a0 || "list";
      // add <name> [note words…] reads every word; rm|remove <name> and list read no more (1.23 review: extra words were ignored)
      const most = action === "list" ? 1 : action === "rm" || action === "remove" ? 2 : Infinity;
      if (pos.length > most) die(c.projectText().extraArgs("backlog " + action, pos.slice(most).join(" ")), c.unknownArg(String(pos[most])));
      const r = spec.backlog(projectDir, action, pos[1], action === "add" ? pos.slice(2).join(" ") : undefined);
      if (!r.ok) return fail(r); // e.g. rm of a name that isn't in the backlog
      const T = c.projectText();
      return out(r, (r) => {
        // 1.19 R review 5: a name already in the backlog — its note was appended to (or already held it): the engine's localized note
        if (action === "add" && r.exists) log(r.note);
        else if (action === "add") log(T.backlogAdded(String(pos[1]).trim()));
        else if (action === "rm" || action === "remove") log(T.backlogRemoved(String(pos[1]).trim()));
        log(T.backlogHead(r.backlog.length));
        r.backlog.forEach((b) => log("  - " + b.name + (b.note ? " — " + b.note : "")));
      });
    },
  },
  {
    name: "scan",
    options: ["cap"], max: 1,
    args: ["@dir"],
    help: `  scan [path]                     Brownfield: inventory an existing codebase (stack, frameworks, routes with file:line,
                                  tests, entrypoints, env var names, migrations)`,
    run(c) {
      // 1.23 review (L12): <path> is read from the project when it was named (--project / the env), else from the working folder
      // (argPath) — it was always the working folder; and the report is in the PROJECT's language (a subfolder has no .specs/).
      const { pos, projectDir, out, fail, log } = c;
      const root = pos[0] ? c.argPath(pos[0]) : projectDir;
      const lang = spec.projectLang(projectDir);
      const r = spec.scanCodebase(root, { cap: c.intFlag("cap"), lang });
      if (!r.ok) return fail(r); // a path that is no folder (1.22 review): exit 1, never an empty codebase
      const T = c.cliText(lang); // same language as the engine's note
      const B = spec.msg(lang).brownfield;
      return out(r, (r) => {
        log(T.scanHead(r.root, r.truncated));
        log(T.scanFiles(r.filesScanned, r.stack.join(" · ")));
        log(T.scanDirs(r.topLevelDirs.join(", ")));
        log(T.scanExt(r.byExtension.join("  ")));
        if (r.frameworks.length) log(B.frameworks(r.frameworks.join(", ")));
        log(T.scanEndpoints(r.candidateEndpoints, r.endpointFiles));
        r.routes.slice(0, 15).forEach((x) => log(B.routeLine(x.method, x.path, x.file + ":" + x.line)));
        if (r.candidateEndpoints > 15) log(B.moreRoutes(r.candidateEndpoints - 15));
        if (r.routesNote) log("    " + r.routesNote);
        log(B.tests(r.testFiles, r.testFrameworks.join(", ") || B.none));
        log(B.entrypoints(r.entrypoints.map((e) => e.file + " (" + e.kind + ")").join(", ") || B.none));
        log(B.env(r.envVars.slice(0, 20).join(", ") || B.none, Math.max(0, r.envVarsTotal - 20)));
        log(B.migrations(r.migrationsTotal, r.migrationDirs.join(", ")));
        if (r.readNote) log("  " + r.readNote);
      });
    },
  },
  {
    name: "coverage",
    options: [], max: 0,
    help: `  coverage                        Brownfield: % of code files named in any _Implements:_ (active + archived features), per folder`,
    run(c) {
      const { projectDir, out, fail, log } = c;
      const r = spec.coverage(projectDir);
      if (!r.ok) return fail(r);
      const T = c.projectText();
      const B = spec.msg(spec.projectLang(projectDir)).brownfield;
      const folder = (x) => (x === "." ? B.root : x);
      return out(r, (r) => {
        log(T.coverage(r.coveragePercent, r.coveredFiles, r.codeFiles));
        if (r.testFiles) log(B.coverageTests(r.testFiles));
        r.byFolder.slice(0, 30).forEach((f) => log(B.coverageFolder(f.folder === "." ? B.root : f.folder + "/", f.covered, f.files, f.percent)));
        if (r.undocumented.length) log(T.undocumented(r.undocumented.map(folder).join(", ")));
        if (r.unmatchedImplements.length) log(B.coverageUnmatched(r.unmatchedImplements.map((u) => u.ref).join(", ")));
        if (r.nonCodeImplements.length) log(B.coverageNonCode(r.nonCodeImplements.map((u) => u.ref).join(", ")));
      });
    },
  },
  {
    name: "import",
    options: ["name", "lang", "tracks", "text", "dry-run"],
    args: ["@import-tool", "@file"],
    help: `  import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path>   Import another tool's spec as a NEW feature (IDs → US-N.AC-M, scenarios → EARS,
                                  tasks renumbered, checkbox state kept); --name <feature> · --lang en|pt|pt-BR|es · --tracks tdd,saas,ai,sec,privacy,dist,api,ui,obs,data
                                  plan = Claude Code plan mode / Cursor .cursor/plans, execplan = a Codex ExecPlan (PLANS.md),
                                  bmad = BMAD-METHOD docs (prd.md + docs/stories/), fluidplan = a fluidplan plan (.fluidplan/<id>/:
                                  plan.json + answers.json, PLAN.md + DECISIONS.md → tasks, criteria, decisions.md)
  import <plan|execplan|fluidplan> - | --text "<markdown>"   The same from the document's text: - reads stdin (dev-spec import plan - < plan.md),
                                  --text takes it inline — for a plan outside the project (Claude Code keeps plans in ~/.claude/plans)
  import <kiro-steering|cursor-rules> [path]   Another tool's steering → .specs/steering/<name>.md (default: .kiro/steering/ ·
                                  .cursor/rules/ + .cursorrules): Kiro's front matter kept; a Cursor rule's alwaysApply → always,
                                  globs → fileMatch, else manual; an existing steering file is never overwritten (skipped, reported)
  import … --dry-run              Write nothing — no file, folder, lock or roadmap refresh: what the import would do (the files with
                                  their size, counts, mapping, warnings; --json adds each file's content, bounded)`,
    run(c) {
      // dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name n] [--lang] [--tracks …] — the same engine
      // call as spec_import: <path> resolves against the project root and must stay inside it.
      // 1.16 C4: `import plan|execplan|fluidplan -` reads the document's markdown from stdin, `--text "<markdown>"` takes it inline
      // (= spec_import {tool, text} — a plan kept outside the project, e.g. Claude Code's ~/.claude/plans).
      // 1.25: `import kiro-steering|cursor-rules [<path>]` (= spec_import {tool}: another tool's steering → .specs/steering/; no path →
      // the tool's own folder) and `--dry-run` on every form (= spec_import {dryRun: true}: nothing written, the same result + preview).
      const { flags, pos, projectDir, out, fail, usage, log } = c;
      const usageLine = "dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name <feature>] [--lang en|pt|pt-BR|es] [--tracks tdd,saas,ai,sec,privacy,dist,api,ui,obs,data] [--dry-run] · import <plan|execplan|fluidplan> - | --text \"<markdown>\" · import <kiro-steering|cursor-rules> [<path>] [--dry-run]";
      const fromStdin = pos[1] === "-";
      const hasText = typeof flags.text === "string";
      const steering = spec.STEERING_IMPORT_TOOLS.includes(pos[0]);
      if (!pos[0] || (!pos[1] && !hasText && !steering) || (fromStdin && hasText)) usage(usageLine);
      // With --text the words after the tool are tracks; with - or a path, the words after it. A word after the tool that is no track
      // list next to --text is a path given with it: passed as the source, so the engine answers its "path or text, not both" (as
      // spec_import {path, text} does) — never "Unknown track: 'plans/x.md'".
      const pathWithText = hasText && !!pos[1] && spec.parseTracks(pos[1]).unknown.length > 0;
      // 1.23 review: run from a subfolder of the project (found by walking up), <path> is relative to that subfolder (argPath) — handed
      // to the engine relative to the project, which still refuses one outside it.
      const source = (p) => (p == null || c.projectNamed || path.resolve(c.cwd) === projectDir ? p
        : path.relative(projectDir, c.argPath(p)).split(path.sep).join("/") || ".");
      const doImport = (text) => {
        const r = spec.importSpec(projectDir, pos[0], text != null && !pathWithText ? undefined : source(pos[1]), { name: flags.name, lang: flags.lang,
          tracks: c.withTracksFlag(pos.slice(hasText && !pathWithText ? 1 : 2)), text, dryRun: flags["dry-run"] === true });
        if (!r.ok) return fail(r);
        return out(r, (r) => {
          const B = spec.msg(r.lang).importSpec;
          const D = spec.msg(r.lang).importSteering;
          if (r.dryRun) log(D.dryRun);
          if (r.kind === "steering") { // 1.25: the steering files written (or that would be), each with its mode
            log((r.dryRun ? D.wouldSteering : D.done)(r.toolName, r.imported.length, r.skipped.length));
            r.imported.forEach((x) => log(D.line(x.file, x.from, x.inclusion, (x.patterns || []).join(", "))));
          } else {
            const src = r.inline ? spec.msg(r.lang).claudeCode.importText.label : r.source;
            log((r.dryRun ? D.would : B.done)(r.toolName, src, r.feature, r.label, r.lang));
            if (r.dryRun) { r.preview.forEach((p) => log(D.previewFile(p.file, p.chars, p.truncated))); log(D.counts(r.counts)); }
            else log("  " + r.files.join(", "));
            const ids = Object.entries(r.mapping);
            log(B.mapping(ids.length, ids.slice(0, 6).map(([a, b]) => a + " → " + b).join(", ") + (ids.length > 6 ? ", …" : "")));
          }
          r.warnings.forEach((w) => log("  ⚠ " + w));
          if (r.dryRun) log(D.jsonHint);
        });
      };
      if (fromStdin) return c.readStdin((text) => doImport(text));
      return doImport(hasText ? flags.text : undefined);
    },
  },
  {
    name: "statusline",
    options: ["print-config"], max: 0,
    help: `  statusline [--print-config]     One line for Claude Code's status line: the most active feature, its tasks, unverified ticks, the next
                                  step (reads the session JSON on stdin; nothing outside a dev-spec project; exit 0 always);
                                  --print-config prints the settings.json "statusLine" snippet with this clone's path`,
    run: (c) => (c.on("print-config") ? statusLineConfig(c) : statusLineRender(c)), // (the render path runs before the flag checks: cli/main.js)
  },
  {
    name: "evals",
    text: true, // options: none checked — every flag goes to run-evals.js
    completeFlags: [...EVALS_SWITCHES, ...[...EVALS_VALUE_FLAGS].filter((f) => f !== "project")],
    args: ["@feature"],
    values: { prompt: "@file" },
    help: `  evals <feature> [--dry-run]     Run the local eval harness (+ai; your ANTHROPIC_API_KEY) — every flag reaches it wherever it
                                  stands (--set-baseline, --require-live, --model ID, --prompt FILE, --max-items N); an unknown
                                  one or a second word exits 2 with nothing run; evals --help prints the harness's usage`,
    run(c) {
      // 1.23 review (P1): every flag goes to run-evals.js WHEREVER it stands — `evals --dry-run <f>` dropped the flag before the feature
      // and ran the eval LIVE (paid API calls) — read with the harness's own rules (evalsArgs). The harness refuses an unknown flag
      // (--dryrun), prints its usage on --help and refuses a second word; --project is the CLI's resolved project.
      const { projectDir, usage, err } = c;
      const ea = evalsArgs(c);
      if (!ea.feature && !ea.help) usage("dev-spec evals <feature> [--dry-run] [--set-baseline] [--require-live] [--model ID] [--prompt FILE] [--max-items N]");
      const args = [EVALS, ...(ea.feature ? [ea.feature] : []), "--project", projectDir, ...ea.rest];
      // The harness prints to this process's terminal (stdio inherited); run in-process (the tests), its output is passed on.
      const inherit = c.io.stdout === process.stdout && c.io.stderr === process.stderr;
      const res = spawnSync(process.execPath, args, inherit ? { stdio: "inherit" } : { encoding: "utf8", input: "", maxBuffer: 64 * 1024 * 1024 });
      if (!inherit) { if (res.stdout) c.write(res.stdout); if (res.stderr) c.writeErr(res.stderr); }
      // A harness that never ran (spawn error) or was killed by a signal has no status — that is a failure, never exit 0 (1.22 review:
      // `res.status || 0` passed a killed run).
      if (res.error) err("dev-spec: " + res.error.message);
      c.exitCode = res.error || res.status == null ? 1 : res.status;
    },
  },
  {
    name: "mcp-config",
    text: true,
    options: [], max: 1,
    args: ["@mcp-client"],
    help: `  mcp-config [client]             Print ready MCP config: claude-desktop|claude-code|cursor|windsurf|vscode|gemini|codex|generic|all`,
    run(c) {
      const client = c.pos[0];
      const blocks = mcpConfigBlocks();
      if (client && client !== "all") {
        // Own keys only: 'constructor' / 'toString' are not clients.
        if (!Object.prototype.hasOwnProperty.call(blocks, client)) c.die(c.projectText().unknownClient(client, Object.keys(blocks).join(", ") + ", all"), c.invalidArg("client"));
        return c.log(blocks[client]);
      }
      return c.log(Object.values(blocks).join("\n\n"));
    },
  },
  {
    name: "rules",
    text: true,
    options: [], max: 1,
    args: ["@rules-tool"],
    help: `  rules <tool>                    Print a rule file (cursor|windsurf|copilot|gemini|agents) with this clone's absolute paths`,
    run(c) {
      // dev-spec rules <cursor|windsurf|copilot|gemini|agents> — a per-tool rule file from THIS clone, with its relative paths made
      // absolute so it works pasted into any project (like mcp-config, never committed). RULE_FILES: above.
      const { pos, usage, die, write } = c;
      if (!pos[0]) usage("dev-spec rules <" + Object.keys(RULE_FILES).join("|") + ">");
      const tool = String(pos[0]).toLowerCase();
      // Own keys only: `constructor`/`__proto__` would pass a plain lookup and crash path.join.
      if (!Object.prototype.hasOwnProperty.call(RULE_FILES, tool)) die(c.projectText().unknownRules(pos[0], Object.keys(RULE_FILES).join(", ")), c.invalidArg("tool"));
      const ROOT = path.resolve(__dirname, "..").replace(/\\/g, "/"); // forward slashes: valid in markdown and on Windows
      // 1.26: the clone's note "Paths in this file point into the dev-spec-driven clone. `… rules <tool>` prints this file…" is about
      // the clone's copy — in the printed copy it would describe itself: it is dropped (with the blank line after it).
      const raw = fs.readFileSync(path.join(__dirname, "..", RULE_FILES[tool]), "utf8")
        .replace(/^> Paths in this file point into the dev-spec-driven clone\.[^\n]*\n(?:\r?\n)?/m, "");
      // One pass (so skills/…/references/x.md is never rewritten twice). `../../AGENTS.md` (the Cursor link) and bare
      // `references/x.md` (relative to the skill) resolve too, as do the plugin's `agents/x.md` and `commands/x.md` (AGENTS.md cites
      // the spec-verifier agent). Commands get quoted paths and link targets get <…> when the clone path has spaces.
      const re = /(\bnode\s+|\]\()?(?<![\w./-])(?:\.\.\/)*(cli\/dev-spec\.js|mcp\/server\.js|AGENTS\.md|skills\/dev-spec-driven(?:\/[\w.-]+)*\/?|references\/(?:[\w.-]+\.md)?|(?:agents|commands)\/[\w.-]+\.md)/g;
      const text = raw.replace(re, (m, lead, rel) => {
        const abs = ROOT + "/" + (rel.startsWith("references/") ? "skills/dev-spec-driven/" + rel : rel);
        if (lead && /^node/.test(lead)) return lead + JSON.stringify(abs);
        if (lead) return lead + (/\s/.test(abs) ? "<" + abs + ">" : abs);
        return abs;
      }).replace(/ \(repo root\)/g, "");
      return write(text.endsWith("\n") ? text : text + "\n");
    },
  },
  {
    name: "prompts",
    options: ["args"],
    args: ["@prompt"],
    help: `  prompts [name] [--args "…"]     The MCP prompts (one per plugin command — slash commands in MCP clients): list them, or print
                                  one rendered as prompts/get returns it ($ARGUMENTS ← --args, or the words after the name)`,
    run(c) {
      // dev-spec prompts [name] [--args "…"] — the MCP prompts (one per commands/*.md): the list (= prompts/list), or one rendered as
      // prompts/get returns it (the words after the name are the args when --args is absent).
      const { flags, pos, projectDir, out, fail, usage, log, write } = c;
      const PR = require(path.join(__dirname, "..", "mcp", "lib", "prompts-resources.js"));
      const lang = spec.projectLang(projectDir);
      const P = spec.msg(lang).promptsResources;
      if (!pos[0]) {
        return out({ ok: true, prompts: PR.listPrompts({ lang }) }, (r) => {
          log(P.cliHead(r.prompts.length));
          r.prompts.forEach((x) => log("  " + x.name + (x.argumentHint ? " " + x.argumentHint : "") + "\n      " + x.description));
        });
      }
      if (typeof flags.args === "string" && pos.length > 1) usage('dev-spec prompts [name] [--args "…"]');
      const r = PR.getPrompt(pos[0], typeof flags.args === "string" ? flags.args : pos.slice(1).join(" "), { lang });
      if (!r.ok) return fail(r);
      return out(r, (r) => write(r.messages[0].content.text));
    },
  },
  {
    name: "bundle",
    options: ["out", "force"], // --force: overwrite an --out that is no previous bundle (1.24 r6 B8)
    help: `  bundle [--out <file.js>]        Build this clone's engine as ONE file (mcp/lib/spec.bundle.js, git-ignored) for a slow file
                                  system (Docker bind mount, network drive, WSL /mnt/c): set DEV_SPEC_BUNDLE=1 (with --out, also
                                  DEV_SPEC_BUNDLE_PATH=<file>); rebuild after every plugin update — a stale bundle is ignored;
                                  an existing --out that is no previous bundle is left alone unless --force`,
    run(c) {
      // 1.20: dev-spec bundle [--out <file.js>] — THIS clone's engine as one file (scripts/build.js --bundle), for a slow file system:
      // loaded only with DEV_SPEC_BUNDLE=1 (DEV_SPEC_BUNDLE_PATH=<file> for --out) and while it is current — rebuild after every
      // plugin update. Needs no project; never committed (git-ignored).
      const { flags, pos, on, out, usage, die, log } = c;
      const outFile = typeof flags.out === "string" ? path.resolve(c.cwd, flags.out) : null;
      if (pos.length || (outFile && !/\.js$/i.test(outFile))) usage("dev-spec bundle [--out <file.js>] [--force]");
      const B = require(path.join(__dirname, "..", "scripts", "build.js"));
      const T = c.projectText();
      // 1.24 r6 B8: --out overwrote ANY file (`--out src/app.js` replaced the user's code). An existing file is replaced only when it is
      // a previous bundle (its first lines: build.js's header) — or with --force.
      const target = outFile || B.BUNDLE_PATH;
      if (!on("force") && fs.existsSync(target)) {
        let head = "";
        try {
          const fd = fs.openSync(target, "r");
          try { const buf = Buffer.alloc(512); head = buf.subarray(0, fs.readSync(fd, buf, 0, 512, 0)).toString("utf8"); } finally { fs.closeSync(fd); }
        } catch { head = ""; } // a folder, an unreadable file: not a bundle
        if (!/^"use strict";\r?\n\/\/ GENERATED by scripts\/build\.js --bundle\b/.test(head)) die(T.bundleNotOurs(target), { code: "bundle-not-ours" });
      }
      let r;
      try { r = B.writeBundle(target); } catch (e) { return die(e.message, { code: e.code ? String(e.code) : "exception" }); }
      return out({ ok: true, ...r, env: outFile ? { DEV_SPEC_BUNDLE: "1", DEV_SPEC_BUNDLE_PATH: r.file } : { DEV_SPEC_BUNDLE: "1" } },
        () => log(T.bundleWrote(r.file, r.modules, Math.round(r.bytes / 1024)) + "\n" + T.bundleUse(outFile ? r.file : null)));
    },
  },
  {
    name: "version",
    options: [], max: 0, // 1.24 r6 B-I1 (--version / -V anywhere skip this check: they print the version, nothing else)
    help: `  version                         The version, this CLI's path, Node, the engine it runs on (its modules, or the bundle — and why a
                                  requested bundle was skipped), the project, which input chose it and its language; also
                                  --version / -V anywhere (prints it, runs nothing)`,
    run: (c) => printVersion(c),
  },
  {
    name: "completion",
    text: true,
    options: [], max: 1, // 1.25: completion <powershell|bash|zsh|fish>
    args: ["@shell"],
    help: `  completion <powershell|bash|zsh|fish>   Print the shell's completion script on stdout: the commands, their flags, the values
                                  they take (--lang, --flow, --size, phases, tracks…) and the project's feature names (read from
                                  .specs/ on Tab, without loading the engine). Save it once, then load it from the shell's profile:
                                    PowerShell 5.1 / 7: node "${CLI_PATH}" completion powershell > "$HOME\\dev-spec-completion.ps1"
                                      then add this line to $PROFILE:  . "$HOME\\dev-spec-completion.ps1"
                                    bash: node "${CLI_PATH}" completion bash > ~/.dev-spec-completion.bash
                                      then add to ~/.bashrc:  . ~/.dev-spec-completion.bash
                                    zsh:  … completion zsh > ~/.dev-spec-completion.zsh — in ~/.zshrc, after compinit:  . ~/.dev-spec-completion.zsh
                                    fish: … completion fish > ~/.config/fish/conf.d/dev-spec.fish
                                  Without a dev-spec on PATH the script also defines dev-spec (this CLI); from a plugin's versioned
                                  folder it follows an update to the newest installed version — save it again then to complete the
                                  new version's commands and flags`,
    run(c) {
      // 1.25 — dev-spec completion <powershell|bash|zsh|fish>: the shell's completion script on stdout, nothing else (it is saved to a
      // file or evaluated as it is) — built from this table (completionModel). How to install it: completion --help.
      const { pos, projectDir, usage, die, write } = c;
      const syntax = "dev-spec completion <" + COMPLETION.SHELLS.join("|") + ">";
      if (pos[0] == null || !String(pos[0]).trim()) usage(syntax);
      const sh = COMPLETION.shellName(pos[0]);
      if (!sh) {
        const A = spec.msg(spec.projectLang(projectDir)).args;
        die(A.invalid(A.item("<shell>", A.oneOf(COMPLETION.SHELLS.join(", ")), JSON.stringify(String(pos[0])))), c.invalidArg("shell"));
      }
      return write(COMPLETION.script(sh, completionModel(c)));
    },
  },
  {
    name: "help", // `help <command>`: that command's help (1.24 r6 B-I3); no command — the whole help. It has no block of its own.
    args: ["@command"],
    run: (c) => c.log(c.pos[0] != null ? helpFor(c, String(c.pos[0])) : helpText()),
  },
];

// ---- derived from the table ----------------------------------------------------------------------------------------------------
// name or alias → its entry (a Map: `constructor` / `__proto__` are no commands)
const COMMAND_INDEX = new Map();
for (const e of COMMANDS) for (const n of [e.name, ...(e.aliases || [])]) COMMAND_INDEX.set(n, e);
const commandFor = (name) => (typeof name === "string" && COMMAND_INDEX.has(name) ? COMMAND_INDEX.get(name) : null);
// 1.24 r6 B-I3: an alias's help is its command's (na → next-action, milestones → milestone).
const HELP_ALIASES = {};
for (const e of COMMANDS) for (const a of e.aliases || []) HELP_ALIASES[a] = e.name;
// 1.23 review — each command's own options and the most arguments it takes (main's checkCommandArgs: another known flag, or an
// argument past its last one, is a usage error). Not listed: evals (its flags are run-evals.js's) and help.
const COMMAND_OPTIONS = {};
for (const [n, e] of COMMAND_INDEX) if (e.options) COMMAND_OPTIONS[n] = e.max === undefined ? { options: e.options } : { options: e.options, max: e.max };
// 1.25 — shell completion: a command's positionals ("<cmd>", and "<cmd> <word>" for the positions a first word picks) and the values
// of a value flag ("<flag>" for every command — VALUE_FLAG_SPECS' own —, "<cmd> --<flag>" where commands differ).
const COMMAND_ARGS = {};
for (const e of COMMANDS) {
  if (e.args) COMMAND_ARGS[e.name] = e.args;
  for (const [w, s] of Object.entries(e.sub || {})) COMMAND_ARGS[e.name + " " + w] = s;
}
const FLAG_VALUES = {};
for (const [k, o] of VALUE_FLAG_SPECS) if (o && o.values) FLAG_VALUES[k] = o.values;
for (const e of COMMANDS) for (const [k, v] of Object.entries(e.values || {})) FLAG_VALUES[e.name + " --" + k] = v;
// The commands whose output is text only — no structured result — so --json is refused there (main; the help too).
const TEXT_ONLY_COMMANDS = new Set(COMMANDS.filter((e) => e.text).map((e) => e.name));
// Boolean switches: ONE list, spec.CLI_SWITCHES (the approval hook parses `dev-spec approve …` with it): add a new switch THERE. A
// function (1.25.1): read on use — the engine's list (an unknown flag, a switch given a value), never at load.
const BOOL_FLAGS = () => [...spec.CLI_SWITCHES];

// ---- the help ----------------------------------------------------------------------------------------------------------------
// `dev-spec help`: this head, every entry's lines in the table's order, then this foot — English, like the commands' synopses (only
// help <command>'s frame lines follow the project language: languages.md).
const HELP_HEAD = "dev-spec — universal spec-driven CLI (local, zero-dependency)";
const HELP_FOOT = `  The project: --project <dir> (an existing folder — only init creates one) > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest
  folder at or above the working one that holds a dev-spec .specs/ > the working folder. A variable that chose it is checked like
  --project (a missing folder or a file is refused, naming the variable); a project's own .specs/ folder is no project. A path
  argument (scan, ears, import) is relative to the project when it was named (--project or the environment), else to the
  working folder.
  Each command takes its own options and arguments: another option, one argument too many, or a single-value flag given twice
  is a usage error (exit 1) — repeatable: --add / --rm (depend), --check (init), --req / --implements / --makes-green /
  --depends (append-tasks), --affects / --supersedes (decide).
  <command> --help (or -h, or help <command>) prints that command's part of this help and its options; - as an argument reads
  stdin (from a terminal: type the text, then Ctrl+D — Windows: Ctrl+Z, Enter).

  Flags: --json  --project <dir>  --lang en|pt|pt-BR|es (init/create/bugfix/spike/steering/roadmap/ears/classify/import/templates/tracks/signals)  --order N (depend)
         --name "<feature>" (classify)  --summary "…"  --kind feature|bugfix|spike|change / --size xs|s|m|l (create; spike: --question, --timebox)  --text "…" (ears)
         --batch  --max N (next)  --write / --include-brief (brief)  --write / --include-body (finish)
         --yes (feature remove)  --write|--md / --html (roadmap)  --cap N (scan)  --by NAME / --force (approve)
         --role ROLE / --through PHASE (approve)  --roles phase=role+role,… | none (init)
         --revoke / --reason "…" / --expires YYYY-MM-DD|Nd (approve)  --reason "…" (undone)
         --brownfield / --flow design-first (create)  --flow (feature flow)  --name (import)  --tracks tdd,saas (import/create/init/add-track, beside positional tracks)
         --apply (upgrade)  --args "…" (prompts)  --check name="cmd" (init)  --run / --shell (done, finish)  --max N (next, log)
         --md / --csv / --gherkin / --adr / --write (export)  --since <ISO date|last|all> / --write (changelog)
         --text "<markdown>" (import plan|execplan|fluidplan)  --print-config (statusline)  --install / --uninstall / --check (merge-state)
         --guard on|off|scope / --stop-check on|off / --approval-guard off|ask|deny / --evidence reported|observed (init)  --message "…" / --agent <type> (stop-check)
         Value flags need a value (--flag value or --flag=value); a following --flag is not one.
         Switches: --flag, or --flag=true|false (1/0, yes/no, on/off; anything else is an error).
         With --json a refused operation still prints its result ({"ok": false, "error": …}) on stdout, exit 1 — a usage error
         or an unexpected failure too ({"ok": false, "error": …[, "code": …]}).
         help, rules, mcp-config, evals and completion print text only: --json there is a usage error (exit 1).
         --shell / --timeout go with --run (done, finish); --run and --evidence / --exit / --cmd exclude each other (done);
         --timeout (at most 2147483 s) stops the command's whole process tree; a run ends when its command exits — a
         background process it started (a server) holds nothing up beyond a 2 s drain.

  Works the same in Claude Code, Cursor, Windsurf, Copilot, Gemini/Codex CLI, or a plain shell.`;
function helpText() {
  return HELP_HEAD + "\n\n" + COMMANDS.filter((e) => e.help).map((e) => e.help).join("\n") + "\n\n" + HELP_FOOT;
}
// 1.24 r6 B-I3 — one command's help: its lines of helpText() (an alias's: its command's) + its options (a value flag shows "…") + the
// global ones + where the whole help is. No block (help, an unknown word): the whole help. The lines stay the one help text (English,
// like the rest of it); the frame lines are in the project language.
function helpFor(c, word) {
  if (word == null) return helpText();
  const e = commandFor(String(word));
  if (!e || !e.help) return helpText();
  const T = c.projectText();
  const own = Object.prototype.hasOwnProperty.call(COMMAND_OPTIONS, word) ? COMMAND_OPTIONS[word] : null;
  const lines = ["dev-spec " + e.name, ...e.help.split("\n"), ""];
  if (own) lines.push(own.options.length ? T.cmdHelp.options(own.options.map((f) => "--" + f + (VALUE_FLAGS.has(f) ? " …" : "")).join("  ")) : T.cmdHelp.none);
  lines.push(T.cmdHelp.global, T.cmdHelp.all);
  return lines.join("\n");
}

// 1.25 — what `completion <shell>` fills its script with (cli/completion.js): every command (and alias) and its flags (+ --json
// --project --help), the flags that take a value, COMMAND_ARGS and FLAG_VALUES (an alias reads its command's), and the value lists
// their @sources name — from the facade where it has them, so a new command, flag or value completes with nothing else to touch.
// `cli`: this CLI, which the script runs for feature names (and as `dev-spec` without one on PATH).
function completionModel(c) {
  const globalFlags = GLOBAL_OPTIONS.map((f) => "--" + f);
  const commands = [...COMMAND_INDEX.keys()].sort();
  const flags = {};
  for (const n of commands) {
    const e = COMMAND_INDEX.get(n);
    flags[n] = [...new Set([...(e.completeFlags || e.options || []), ...GLOBAL_OPTIONS])].map((f) => "--" + f);
  }
  const args = { ...COMMAND_ARGS };
  for (const [alias, target] of Object.entries(HELP_ALIASES)) {
    for (const k of Object.keys(COMMAND_ARGS)) if (k === target || k.startsWith(target + " ")) args[alias + k.slice(target.length)] = COMMAND_ARGS[k];
  }
  const values = {};
  for (const [k, v] of Object.entries(FLAG_VALUES)) values[k.includes(" ") ? k : "--" + k] = v;
  let prompts = [];
  try { prompts = fs.readdirSync(path.join(__dirname, "..", "commands")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort(); } catch { prompts = []; }
  const sources = {
    lang: spec.LANGS, track: spec.VALID_TRACKS, "optional-track": spec.OPTIONAL_TRACKS, phase: spec.PHASES,
    through: spec.PHASES.filter((p) => p !== "execution"), flow: spec.FLOWS, size: spec.FEATURE_SIZES, "task-size": Object.keys(spec.SIZE_POINTS),
    tracker: spec.TRACKERS, "approval-guard": spec.APPROVAL_GUARD_LEVELS, "import-tool": spec.IMPORT_TOOLS, template: Object.keys(spec.TEMPLATE_ARTIFACTS),
    "backlog-action": spec.BACKLOG_ACTIONS, "milestone-action": spec.MILESTONE_ACTIONS, "mcp-client": [...Object.keys(mcpConfigBlocks()), "all"],
    "rules-tool": Object.keys(RULE_FILES), prompt: prompts, shell: COMPLETION.SHELLS,
  };
  return { version: spec.engineVersion(), cli: CLI_PATH, gone: c.projectText().completionGone(CLI_PATH), commands, rootFlags: [...globalFlags, "--version"], globalFlags,
    valueFlags: [...new Set([...VALUE_FLAGS, ...EVALS_VALUE_FLAGS])].map((f) => "--" + f), flags, args, values, sources };
}

module.exports = {
  COMMANDS, COMMAND_INDEX, commandFor, COMMAND_OPTIONS, COMMAND_ARGS, FLAG_VALUES, HELP_ALIASES, TEXT_ONLY_COMMANDS, GLOBAL_OPTIONS,
  VALUE_FLAG_SPECS, VALUE_FLAGS, REPEATABLE_FLAGS, OPTIONAL_VALUE_FLAGS, BOOL_FLAGS, EVALS_VALUE_FLAGS, EVALS_SWITCHES, TIMEOUT_MAX_S, NEXT_MAX,
  spec, CLI_FILE, CLI_PATH, RULE_FILES, mcpConfigBlocks, helpText, helpFor, completionModel, statusLineRender, printVersion,
};

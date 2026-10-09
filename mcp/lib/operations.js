"use strict";

/**
 * The operations — what makes an MCP tool and a CLI command the SAME call, in ONE table both surfaces read: mcp/server.js
 * runs every tools/call through it (runTool), the CLI's handlers through `c.call(id, given)` (cli/main.js). It requires nothing — not
 * even the engine: the facade is what each surface hands to `call` (S). Each entry is one engine operation —
 *
 *   id          its name — what a CLI handler runs (c.call("create", …))
 *   tool        the MCP tool that runs it; for a tool that runs several, which one:
 *     mode      { key, values, fallback } — a folded tool's mode (spec_roadmap_edit {kind}, spec_export {format}, spec_scan
 *               {coverage}): the call's args[key] (or the fallback when it leaves the key out) picks the entry. The server's
 *               ARG_MODES — the arguments each mode takes — is DERIVED from these entries (argModes())
 *     when(a)   …or a test of the call's arguments (spec_status: a name or none; ears_validate: a feature or a text; spec_tracks:
 *               action signals); the tool's entry without one runs otherwise
 *   legacy      the hidden aliases (server.js LEGACY_TOOLS) whose calls land here
 *   cli         the CLI commands that run it (a handler runs only an operation that lists its command)
 *   engine      the facade function (mcp/lib/spec.js) its `call` makes
 *   args        engine option → where each surface reads it, and how:
 *                 mcp       the tool's argument
 *                 pos       the CLI positional (0: the first word after the command) — rest: the words from there on
 *                 cli       the CLI flag(s) — several: a switch any of them sets, the flags a handler reads for a `parsed` value
 *                 type      "switch": true only when given true, else false — on both surfaces · "bool": an explicit boolean, else
 *                           undefined (the engine's default) · "int": an integer (the CLI's checked by c.intFlag, the command's
 *                           bounds) · "list": every occurrence of a repeatable CLI flag · none: the value as given
 *                 join      the CLI's words / occurrences as one string (" " a text; "," a list the engine splits)
 *                 cmd       { command: value } — the value a CLI command implies (bugfix → kind "bugfix", undone → undo)
 *                 parsed    the CLI handler reads it in its own syntax (init --guard on|off|scope, done --run's evidence…) and
 *                           gives it — never read raw
 *                 modes     the modes it is taken in, when not all of its operation's (spec_export includeBody: html and md)
 *                 required  required in its mode (ARG_MODES' required)
 *   internal    engine options a surface sets itself, never from an argument — { mcp: […], cli: […] }
 *   cliOnly     CLI flags no engine option takes (how done --run / finish --run run their commands)
 *   call(S, dir, o)   THE engine call — S the facade, dir the project folder, o the options read from the call: written once,
 *               so both surfaces make exactly this call with exactly these defaults.
 *
 * mcp/tests/02-mcp-server-tools.js and cli/tests/02-surfaces-parity.js hold the table to both surfaces: every tool and alias runs an
 * operation, every argument and flag is mapped, and the CLI's --json is the MCP result. docs/maintainers/mcp.md → The operations.
 */

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const NAME = { mcp: "name", pos: 0 }; // a feature, the first word after the command
const LANG = { mcp: "lang", cli: "--lang" };
const SWITCH = (mcp, cli) => ({ mcp, cli, type: "switch" });

const OPERATIONS = [
  {
    id: "init", tool: "spec_init", cli: ["init"], engine: "initProject",
    args: {
      tracks: { mcp: "tracks", pos: 0, rest: true, cli: "--tracks" },
      lang: LANG,
      guard: { mcp: "guard", cli: "--guard", parsed: true }, // on|off|scope → true | false | "scope"
      checks: { mcp: "checks", cli: "--check", parsed: true }, // name="cmd" (repeatable; name= removes) → {name: cmd}
      approvalRoles: { mcp: "approvalRoles", cli: "--roles", parsed: true }, // requirements=product,design=tech+security | none
      stopCheck: { mcp: "stopCheck", cli: "--stop-check", parsed: true }, // on|off → boolean
      approvalGuard: { mcp: "approvalGuard", cli: "--approval-guard", parsed: true }, // off|ask|deny, checked
      evidence: { mcp: "evidence", cli: "--evidence", parsed: true }, // reported|observed, checked
    },
    // undefined leaves each meta value as it is
    call: (S, dir, o) => S.initProject(dir, o.tracks, o.lang, { guard: o.guard, checks: o.checks, approvalRoles: o.approvalRoles,
      stopCheck: o.stopCheck, approvalGuard: o.approvalGuard, evidence: o.evidence }),
  },
  {
    id: "classify", tool: "spec_classify", cli: ["classify"], engine: "classify",
    args: { description: { mcp: "description", pos: 0, rest: true, join: " " }, name: { mcp: "name", cli: "--name" }, lang: LANG, explain: SWITCH("explain", "--explain") },
    // the project's meta.lang: the fallback when the text is inconclusive
    call: (S, dir, o) => S.classify(o.description, { name: o.name, lang: o.lang, projectDir: dir, explain: o.explain }),
  },
  {
    // No tracks: the engine keeps an existing feature's, or classifies a new one in its language (the explicit lang, else the project's).
    id: "create", tool: "spec_create", cli: ["create", "bugfix", "spike"], engine: "createFeature",
    args: {
      name: NAME,
      tracks: { mcp: "tracks", pos: 1, rest: true, cli: "--tracks" },
      summary: { mcp: "summary", cli: "--summary" },
      lang: LANG,
      kind: { mcp: "kind", cli: "--kind", cmd: { bugfix: "bugfix", spike: "spike" } },
      size: { mcp: "size", cli: "--size" }, // 1.21 F5 (xs: a change — one change.md)
      flow: { mcp: "flow", cli: "--flow" }, // C3
      question: { mcp: "question", cli: "--question" }, timebox: { mcp: "timebox", cli: "--timebox" }, // a spike's
      reproduction: { mcp: "reproduction", cli: "--reproduction" }, rootCause: { mcp: "rootCause", cli: "--root-cause" }, // the bugfix prefill
      condition: { mcp: "condition", cli: "--condition" }, behaviour: { mcp: "behaviour", cli: "--behaviour" },
      brownfield: SWITCH("brownfield", "--brownfield"),
      includeBody: SWITCH("includeBody", "--include-body"),
      branch: { mcp: "branch", cli: "--branch", parsed: true }, // a bare --branch is true; a spaced track word is refused
    },
    // cli: a refusal names the flag (--root-cause), not the MCP key; git: what git said (the engine reads no git process)
    internal: { cli: ["cli", "git"] },
    call: (S, dir, o) => S.createFeature(dir, o),
  },
  {
    id: "list", tool: "spec_status", legacy: ["spec_list"], cli: ["list", "status"], engine: "listFeatures",
    args: {},
    call: (S, dir) => S.listFeatures(dir),
  },
  {
    id: "status", tool: "spec_status", when: (a) => typeof a.name === "string" && !!a.name.trim(), cli: ["status"], engine: "statusFeature",
    args: { name: NAME },
    call: (S, dir, o) => S.statusFeature(dir, o.name),
  },
  {
    id: "next", tool: "spec_next_task", cli: ["next"], engine: "nextTask",
    args: { name: NAME, batch: SWITCH("batch", "--batch"), max: { mcp: "max", cli: "--max", type: "int" }, waves: SWITCH("waves", "--waves") },
    call: (S, dir, o) => S.nextTask(dir, o.name, { batch: o.batch, max: o.max, waves: o.waves }),
  },
  {
    id: "brief", tool: "spec_task_brief", cli: ["brief"], engine: "taskBrief",
    args: { name: NAME, number: { mcp: "number", pos: 1 }, write: SWITCH("write", "--write"), includeBrief: { mcp: "includeBrief", cli: "--include-brief", type: "bool" } },
    call: (S, dir, o) => S.taskBrief(dir, o.name, o.number, { write: o.write, includeBrief: o.includeBrief }),
  },
  {
    id: "complete", tool: "spec_complete_task", cli: ["done", "undone"], engine: "completeTask",
    args: {
      name: NAME,
      number: { mcp: "number", pos: 1 },
      evidence: { mcp: "evidence", cli: ["--run", "--evidence", "--exit", "--cmd"], parsed: true }, // the run --run made, or the one reported
      undo: { mcp: "undo", type: "switch", cmd: { undone: true } }, // 1.16 U1
      reason: { mcp: "reason", cli: "--reason" },
    },
    internal: { cli: ["ranBy", "startedAt", "ranVerify"] }, // a run --run made: observed by the CLI itself, stamped before it ran
    cliOnly: ["--shell", "--timeout"],
    call: (S, dir, o) => S.completeTask(dir, o),
  },
  {
    // evidence: the project checks' runs — reported by the agent over MCP (the server never runs them), made by finish --run
    id: "finish", tool: "spec_finish", cli: ["finish"], engine: "finishFeature",
    args: { name: NAME, write: SWITCH("write", "--write"), includeBody: { mcp: "includeBody", cli: "--include-body", type: "bool" }, evidence: { mcp: "evidence", cli: "--run", parsed: true } },
    internal: { cli: ["ranBy", "runStart"] },
    cliOnly: ["--shell", "--timeout"],
    call: (S, dir, o) => S.finishFeature(dir, o.name, { write: o.write, includeBody: o.includeBody, evidence: o.evidence, ranBy: o.ranBy, runStart: o.runStart }),
  },
  {
    // a text — --text, stdin (-) or a file — in the given language, else the project's
    id: "ears-text", tool: "ears_validate", cli: ["ears"], engine: "earsValidate",
    args: { text: { mcp: "text", cli: "--text", parsed: true }, lang: LANG },
    call: (S, dir, o) => S.earsValidate(o.text, o.lang || S.projectLang(dir)),
  },
  {
    id: "ears", tool: "ears_validate", when: (a) => !a.text && !!a.name, cli: ["ears"], engine: "earsFeature",
    args: { name: NAME },
    call: (S, dir, o) => S.earsFeature(dir, o.name),
  },
  {
    id: "trace", tool: "trace_check", cli: ["trace"], engine: "traceCheck",
    args: { name: NAME, code: SWITCH("code", "--code"), matrix: SWITCH("matrix", ["--matrix", "--csv"]) }, // --csv: the matrix as CSV
    call: (S, dir, o) => S.traceCheck(dir, o.name, { code: o.code, matrix: o.matrix }),
  },
  {
    id: "doctor", tool: "spec_doctor", cli: ["doctor"], engine: "specDoctor",
    args: { name: NAME },
    call: (S, dir, o) => S.specDoctor(dir, o.name),
  },
  {
    // through: the fast-forward · role: the sign-off's role · reason / expires: a forced approval's waiver · by: the engine's default approver
    id: "approve", tool: "spec_approve", cli: ["approve"], engine: "approvePhase",
    args: {
      name: NAME, phase: { mcp: "phase", pos: 1 }, through: { mcp: "through", cli: "--through" }, role: { mcp: "role", cli: "--role" },
      by: { mcp: "by", cli: "--by" }, force: SWITCH("force", "--force"), reason: { mcp: "reason", cli: "--reason" },
      expires: { mcp: "expires", cli: "--expires" }, revoke: SWITCH("revoke", "--revoke"),
    },
    // the elicitation's dry run, the user's confirmation, and what that dry run judged
    internal: { mcp: ["dryRun", "confirmation", "preview"] },
    call: (S, dir, o) => S.approvePhase(dir, o.name, o.phase, o.by, { force: o.force, role: o.role, through: o.through, reason: o.reason,
      expires: o.expires, revoke: o.revoke, dryRun: o.dryRun, confirmation: o.confirmation, preview: o.preview }),
  },
  {
    id: "steering", tool: "steering_scaffold", cli: ["steering"], engine: "scaffoldSteeringFile",
    args: { file: { mcp: "file", pos: 0 }, lang: LANG },
    call: (S, dir, o) => S.scaffoldSteeringFile(dir, o.file, o.lang),
  },
  {
    // html implies writing; a failed write is an error
    id: "roadmap", tool: "spec_roadmap", cli: ["roadmap"], engine: "roadmapReport",
    args: { write: SWITCH("write", ["--write", "--md"]), html: SWITCH("html", "--html"), lang: LANG },
    call: (S, dir, o) => S.roadmapReport(dir, { write: o.write, html: o.html, lang: o.lang }),
  },
  {
    id: "backlog", tool: "spec_roadmap_edit", mode: { key: "kind", values: ["backlog"] }, legacy: ["spec_backlog"], cli: ["backlog"], engine: "backlog",
    args: { action: { mcp: "action", pos: 0 }, name: { mcp: "name", pos: 1 }, note: { mcp: "note", pos: 2, rest: true, join: " " } },
    call: (S, dir, o) => S.backlog(dir, o.action, o.name, o.note),
  },
  {
    // dependsOn REPLACES the list (the CLI's words; --clear: none), add / remove edit it; nothing at all only reads it
    id: "depend", tool: "spec_roadmap_edit", mode: { key: "kind", values: ["depend"] }, legacy: ["spec_depend"], cli: ["depend"], engine: "setDependency",
    args: {
      name: { mcp: "name", pos: 0, required: true },
      dependsOn: { mcp: "dependsOn", pos: 1, cli: "--clear", parsed: true },
      add: { mcp: "add", cli: "--add", type: "list", join: "," },
      remove: { mcp: "remove", cli: "--rm", type: "list", join: "," },
      order: { mcp: "order", cli: "--order" }, // the CLI's raw word: the engine refuses what the MCP schema would
    },
    call: (S, dir, o) => S.setDependency(dir, o.name, o.dependsOn, o.order, { add: o.add, remove: o.remove }),
  },
  {
    id: "milestone", tool: "spec_roadmap_edit", mode: { key: "kind", values: ["milestone"] }, legacy: ["spec_milestone"], cli: ["milestone"], engine: "milestone",
    args: { action: { mcp: "action", pos: 0 }, name: { mcp: "name", pos: 1 }, date: { mcp: "date", pos: 2 }, features: { mcp: "features", pos: 3, rest: true } },
    call: (S, dir, o) => S.milestone(dir, o.action, { name: o.name, date: o.date, features: o.features }),
  },
  {
    // the CLI's path (a subfolder) is reported in the PROJECT's language — the scanned folder holds no .specs/
    id: "scan", tool: "spec_scan", mode: { key: "coverage", values: [false], fallback: false }, cli: ["scan"], engine: "scanCodebase",
    args: { cap: { mcp: "cap", cli: "--cap", type: "int" }, path: { pos: 0, parsed: true } },
    call: (S, dir, o) => S.scanCodebase(o.path != null ? o.path : dir, { cap: o.cap, lang: S.projectLang(dir) }),
  },
  {
    id: "coverage", tool: "spec_scan", mode: { key: "coverage", values: [true] }, legacy: ["spec_coverage"], cli: ["coverage"], engine: "coverage",
    args: {},
    call: (S, dir) => S.coverage(dir),
  },
  {
    id: "clarify", tool: "spec_clarify", cli: ["clarify"], engine: "clarify",
    args: { name: NAME },
    call: (S, dir, o) => S.clarify(dir, o.name),
  },
  {
    id: "next-action", tool: "spec_next_action", cli: ["next-action"], engine: "nextAction",
    args: { name: NAME },
    call: (S, dir, o) => S.nextAction(dir, o.name),
  },
  {
    id: "add-track", tool: "spec_add_track", cli: ["add-track"], engine: "addTrack",
    args: { name: NAME, track: { mcp: "track", pos: 1, rest: true, cli: "--tracks" }, remove: SWITCH("remove", "--remove") },
    call: (S, dir, o) => S.addTrack(dir, o.name, o.track, { remove: o.remove }),
  },
  {
    // remove needs confirm (the CLI's --yes); flow: action 'flow' (the CLI's third word is read as it too)
    id: "feature", tool: "spec_feature", cli: ["feature"], engine: "manageFeature",
    args: { action: { mcp: "action", pos: 0 }, name: { mcp: "name", pos: 1 }, newName: { mcp: "newName", pos: 2 }, flow: { mcp: "flow", cli: "--flow" }, confirm: SWITCH("confirm", "--yes") },
    internal: { mcp: ["preview"] }, // 1.23 (remove): the folder the user was asked about
    call: (S, dir, o) => S.manageFeature(dir, o.action, o.name, o.newName, { confirm: o.confirm, flow: o.flow, preview: o.preview }),
  },
  {
    // the engine refuses a path outside the project; text: 1.16 C4 (the CLI: --text or stdin); dryRun: 1.25
    id: "import", tool: "spec_import", cli: ["import"], engine: "importSpec",
    args: {
      tool: { mcp: "tool", pos: 0 },
      path: { mcp: "path", pos: 1, parsed: true }, // resolved from the folder it was typed in
      text: { mcp: "text", cli: "--text", parsed: true },
      name: { mcp: "name", cli: "--name" },
      tracks: { mcp: "tracks", cli: "--tracks", parsed: true }, // + the words after the source
      lang: LANG,
      dryRun: SWITCH("dryRun", "--dry-run"),
    },
    call: (S, dir, o) => S.importSpec(dir, o.tool, o.path, { name: o.name, tracks: o.tracks, lang: o.lang, text: o.text, dryRun: o.dryRun }),
  },
  {
    // the CLI appends ONE task per call, from its flags
    id: "append-tasks", tool: "spec_append_tasks", cli: ["append-tasks"], engine: "appendTasks",
    args: {
      name: NAME,
      tasks: { mcp: "tasks", cli: ["--task", "--req", "--implements", "--verify", "--story", "--parallel", "--makes-green", "--expect-fail", "--size", "--depends"], parsed: true },
      heading: { mcp: "heading", cli: "--heading" },
    },
    call: (S, dir, o) => S.appendTasks(dir, o.name, o.tasks, { heading: o.heading }),
  },
  {
    id: "impact", tool: "spec_impact", cli: ["impact"], engine: "impactReport",
    args: { name: NAME, phase: { mcp: "phase", cli: "--phase" }, reopen: SWITCH("reopen", "--reopen") },
    call: (S, dir, o) => S.impactReport(dir, o.name, { phase: o.phase, reopen: o.reopen }),
  },
  {
    id: "metrics", tool: "spec_metrics", cli: ["metrics"], engine: "metrics",
    args: { name: NAME, write: SWITCH("write", "--write") },
    call: (S, dir, o) => S.metrics(dir, o.name, { write: o.write }),
  },
  {
    id: "drift", tool: "spec_drift", cli: ["drift"], engine: "drift",
    args: { name: NAME },
    call: (S, dir, o) => S.drift(dir, o.name),
  },
  {
    id: "upgrade", tool: "spec_upgrade", cli: ["upgrade"], engine: "specUpgrade",
    args: { apply: SWITCH("apply", "--apply") },
    call: (S, dir, o) => S.specUpgrade(dir, { apply: o.apply }),
  },
  {
    id: "templates", tool: "spec_templates", cli: ["templates"], engine: "templates",
    args: { action: { mcp: "action", pos: 0 }, artifact: { mcp: "artifact", pos: 1 }, lang: LANG },
    call: (S, dir, o) => S.templates(dir, o.action, { artifact: o.artifact, lang: o.lang }),
  },
  {
    id: "tracks", tool: "spec_tracks", cli: ["tracks"], engine: "trackPacks",
    args: { action: { mcp: "action", pos: 0 }, name: { mcp: "name", pos: 1 }, lang: LANG },
    call: (S, dir, o) => S.trackPacks(dir, o.action, { name: o.name, lang: o.lang }),
  },
  {
    // the classifier's signal overrides — an action of spec_tracks, a command of its own
    id: "signals", tool: "spec_tracks", when: (a) => a.action != null && String(a.action).trim().toLowerCase() === "signals", cli: ["signals"], engine: "trackPacks",
    args: {
      op: { mcp: "op", pos: 0, parsed: true }, // the CLI's first word, case-folded (none: list)
      track: { mcp: "track", pos: 1 }, word: { mcp: "word", pos: 2 }, effect: { mcp: "effect", pos: 3 }, lang: LANG,
    },
    call: (S, dir, o) => S.trackPacks(dir, "signals", { op: o.op, track: o.track, word: o.word, effect: o.effect, lang: o.lang }),
  },
  {
    // html / md without write: a preview unless includeBody (the CLI's human output always prints the document — its handler asks for it)
    id: "export", tool: "spec_export", mode: { key: "format", values: ["html", "md", "csv", "gherkin", "jira", "linear", "adr"], fallback: "html" },
    cli: ["export"], engine: "exportSpecs",
    args: {
      name: NAME,
      format: { mcp: "format", cli: ["--md", "--html", "--csv", "--gherkin", "--adr", "--tracker"], parsed: true }, // --tracker jira|linear: the format
      write: SWITCH("write", "--write"),
      includeBody: { mcp: "includeBody", cli: "--include-body", type: "switch", modes: ["html", "md"] },
    },
    call: (S, dir, o) => S.exportSpecs(dir, { name: o.name, format: o.format, write: o.write, includeBody: o.includeBody }),
  },
  {
    id: "catalog", tool: "spec_export", mode: { key: "format", values: ["catalog"] }, legacy: ["spec_catalog"], cli: ["catalog"], engine: "catalog",
    args: { write: SWITCH("write", "--write"), includeBody: SWITCH("includeBody", "--include-body") },
    call: (S, dir, o) => S.catalog(dir, { write: o.write, includeBody: o.includeBody }),
  },
  {
    id: "changelog", tool: "spec_export", mode: { key: "format", values: ["changelog"] }, legacy: ["spec_changelog"], cli: ["changelog"], engine: "changelog",
    args: { since: { mcp: "since", cli: "--since" }, milestone: { mcp: "milestone", cli: "--milestone" }, write: SWITCH("write", "--write"), includeBody: SWITCH("includeBody", "--include-body") },
    call: (S, dir, o) => S.changelog(dir, { since: o.since, milestone: o.milestone, write: o.write, includeBody: o.includeBody }),
  },
  {
    // an unknown _Affects:_ reference is refused, nothing written
    id: "decide", tool: "spec_decide", cli: ["decide"], engine: "decide",
    args: {
      name: NAME, title: { mcp: "title", cli: "--title" }, decision: { mcp: "decision", cli: "--decision" }, context: { mcp: "context", cli: "--context" },
      consequences: { mcp: "consequences", cli: "--consequences" }, affects: { mcp: "affects", cli: "--affects", type: "list" },
      supersedes: { mcp: "supersedes", cli: "--supersedes", type: "list" },
      kind: { mcp: "kind", cli: ["--kind", "--discovery"], parsed: true }, // --discovery: kind discovery
    },
    call: (S, dir, o) => S.decide(dir, o.name, { title: o.title, decision: o.decision, context: o.context, consequences: o.consequences,
      affects: o.affects, supersedes: o.supersedes, kind: o.kind }),
  },
  {
    // the Stop hook's decision — for MCP-only clients, and the CLI's (the message: --message, the words or stdin)
    id: "stop-check", tool: "spec_stop_check", cli: ["stop-check"], engine: "stopCheck",
    args: { message: { mcp: "message", cli: "--message", parsed: true }, agent: { mcp: "agent", cli: "--agent" } },
    call: (S, dir, o) => S.stopCheck(dir, { message: o.message, agent: typeof o.agent === "string" ? o.agent : "" }),
  },
  {
    // the git log TEXT — the client's (this server never runs git), the CLI's own git read (or stdin: -)
    id: "log", tool: "spec_log", cli: ["log"], engine: "taskCommits",
    args: { name: NAME, gitLog: { mcp: "gitLog", pos: 1, parsed: true }, max: { mcp: "max", cli: "--max", type: "int" } },
    internal: { cli: ["since"] }, // the range the CLI read (null: the whole log on purpose); absent: the engine's own
    call: (S, dir, o) => S.taskCommits(dir, o.name, o.gitLog, { max: o.max, since: o.since }),
  },
];

const BY_ID = new Map(OPERATIONS.map((op) => [op.id, op]));
// An operation by its id — an unknown one is a programming error.
function byId(id) {
  const op = BY_ID.get(id);
  if (!op) throw new Error("dev-spec: no operation '" + id + "'");
  return op;
}
// The operations a tool runs, in the table's order.
const toolOperations = (tool) => OPERATIONS.filter((op) => op.tool === tool);
// The value of a moded tool's key in a call: the given one, else the fallback (the entry that declares one).
function modeValue(ops, args) {
  const key = ops[0].mode.key;
  const fb = ops.find((op) => hasOwn(op.mode, "fallback"));
  return args[key] == null ? (fb ? fb.mode.fallback : undefined) : args[key];
}
// The operation a tools/call runs (its arguments already checked against the tool's schema), or null for an unknown tool.
function forTool(tool, args) {
  const ops = toolOperations(tool);
  if (ops.length <= 1) return ops[0] || null;
  const a = args || {};
  if (ops[0].mode) {
    const v = String(modeValue(ops, a));
    return ops.find((op) => op.mode.values.map(String).includes(v)) || ops.find((op) => hasOwn(op.mode, "fallback")) || null;
  }
  return ops.find((op) => op.when && op.when(a)) || ops.find((op) => !op.when) || null;
}
// The server's ARG_MODES, derived: for each tool whose operations are picked by a mode — { key, fallback, modes: {value: [the
// MCP arguments it takes, the mode key and projectDir aside]}, required?: {value: [the ones it requires]} }.
function argModes() {
  const out = {};
  for (const tool of new Set(OPERATIONS.filter((op) => op.mode).map((op) => op.tool))) {
    const ops = toolOperations(tool);
    const fb = ops.find((op) => hasOwn(op.mode, "fallback"));
    const modes = {}, required = {};
    for (const op of ops) {
      for (const v of op.mode.values) {
        const takes = Object.values(op.args).filter((a) => a.mcp !== undefined && a.mcp !== op.mode.key && (!a.modes || a.modes.includes(v)));
        modes[String(v)] = takes.map((a) => a.mcp);
        const req = takes.filter((a) => a.required).map((a) => a.mcp);
        if (req.length) required[String(v)] = req;
      }
    }
    out[tool] = { key: ops[0].mode.key, ...(fb ? { fallback: fb.mode.fallback } : {}), modes, ...(Object.keys(required).length ? { required } : {}) };
  }
  return out;
}
// The engine options a surface may set itself for this operation.
const internalOf = (op, surface) => (op.internal && op.internal[surface]) || [];
// The options of one call: each argument read by the surface — read(arg) → its raw value (the MCP argument; the CLI's flag, words or
// the value its command implies) — then the shared rule: a switch is true only when given true; absent (undefined) is left out.
// `given` (the surface's own: a value its handler parses, an internal option) wins; an option the operation doesn't declare is a
// programming error, thrown — the parity tests run every handler.
function options(op, surface, read, given) {
  const o = {};
  for (const [k, a] of Object.entries(op.args)) {
    let v = read(a, k);
    if (a.type === "switch") v = v === true;
    if (v !== undefined) o[k] = v;
  }
  for (const [k, v] of Object.entries(given || {})) {
    if (!hasOwn(op.args, k) && !internalOf(op, surface).includes(k)) throw new Error("dev-spec: operation '" + op.id + "' has no option '" + k + "' for the " + surface);
    o[k] = v;
  }
  return o;
}
// One operation, run: its options read from the call, then its engine call (S: the facade, dir: the project folder).
function run(op, S, dir, surface, read, given) {
  return op.call(S, dir, options(op, surface, read, given));
}

module.exports = { OPERATIONS, byId, forTool, toolOperations, argModes, internalOf, options, run };

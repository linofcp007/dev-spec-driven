# The MCP server — tools, capabilities, arguments, protocol

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What the server advertises and validates, and how it frames messages. The rules come first; how they came to be — the
releases and review findings — is in History at the end.

## MCP tools
The logic is the engine's (`mcp/lib/engine/`, behind `mcp/lib/spec.js`); `mcp/server.js` advertises the tools — 32, the
`tool`s of the operations table, 30 listed in plugin mode — and runs each through that table (`mcp/test.js` asserts the
count; a `tools/list` handshake lists them).
- **Local file operations only**: `.specs/`, or a read-only codebase scan (brownfield, `trace --code`, import) — no network,
  no command, no git. Scaffolders never overwrite a file; mutators edit only what they own (checkboxes, appended tasks, track
  sections and decisions, `.state.json` / `roadmap.json`, the generated files — `ROADMAP.*`, `SPECS.md`, `UPGRADE.md`,
  `RELEASE-NOTES.md`, `.specs/exports/*` — and copied templates), never spec prose. Cross-feature dependencies are
  cycle-checked and must name existing features.
- **The observed-run log** (`.execution/observed.jsonl`): only `hooks/observe-hook.js` writes it (`observeRun()`); no tool
  accepts an `observed` stamp from its caller.

### The description budget
`tools/list` is paid in context on every session. A description holds what a model needs to CHOOSE and CALL the tool —
purpose, when vs a neighbour, the key arguments, the rules an agent must act on (evidence before claims, approvals are the
user's, never force without consent, what a refusal means): ≤ 2,500 characters, one line, English; never a catalogue the
result carries (check ids, keys, reason codes), version history or a long example (`references/tooling-reference.md` holds
those). `mcp/tests/02-mcp-server.js` caps the whole list at `TOOLS_LIST_CAP` (44,500 — today's size + ~3%, the CLI path
counted as `dev-spec`); `mcp/tests/harness.js` and 17-docs pin some sentences (spec_complete_task's, spec_finish's,
spec_approve's). Every tool shares `PROJECT_DIR` but `spec_init` (`PROJECT_DIR_INIT`: how the folder is chosen); track
names share `TRACK_ITEM`.

### The operations
`OPERATIONS` (`mcp/lib/operations.js` — Node core only, requiring nothing: each surface hands it the facade) is ONE table
both surfaces run through, so a tool and its CLI command are the SAME call: one entry per engine operation (40, asserted by
`mcp/tests/02-mcp-server-tools.js`). The file's header documents the fields — `id`, `tool` (several operations of one tool
told apart by a `mode` or a `when(args)` test), `legacy`, `cli`, `engine`, `args` (`mcp`, `cli` / `pos`, `type`, `join`,
`cmd`, `parsed`, `modes`, `required`), `internal`, `cliOnly`, `call(S, dir, o)`: THE engine call, written once.
- **runTool has no dispatch of its own**: `forTool(name, args)` picks the operation, `run(op, spec, dir, "mcp", read, own)`
  reads its options by the shared rule (`options()`: a switch is true only when given true) and makes the call; runTool
  itself reads only `projectDir`. The CLI does the same through `c.call(id, given)` (cli/main.js). An option the operation
  doesn't declare is thrown.
- `createFeature` / `completeTask` take an options object; their positional forms still work (told apart by type —
  `featureLocked` reads either).
- **Parity is structural**: `mcp/tests/02-mcp-server-tools.js` (every tool and alias runs an operation, every argument mapped
  and typed, server.js calls no operation's engine function, each operation on twin projects answers MCP and the CLI alike)
  and `cli/tests/02-surfaces-parity.js` (every command runs one through `c.call` or is a known non-operation, every flag is
  mapped, no handler calls the facade itself).

### Folded tools
`spec_list` → `spec_status` without `name` (`listFeatures`); `spec_backlog` / `spec_depend` / `spec_milestone` →
`spec_roadmap_edit {kind}` (destructive: rm, dependsOn replaces; `spec_roadmap` stays the reader + ROADMAP.md writer);
`spec_catalog` / `spec_changelog` → `spec_export {format}`, running `catalog()` / `changelog()` — the very calls of `dev-spec
catalog` / `changelog --json`; `spec_coverage` → `spec_scan {coverage: true}`. The CLI keeps its commands (list, backlog,
depend, milestone, catalog, changelog, coverage); each mode is an operation.

### Hidden aliases
`LEGACY_TOOLS` (server.js) keeps the seven old names callable: a call's arguments are checked against the OLD schema
(`toolDef()`: an old caller gets its old refusals), translated (`translateLegacy`), and the new tool runs and answers. Never
listed, never completed, no operation of their own — each is in the `legacy` of the operation it lands on;
`mcp/tests/02-mcp-server-tools.js` asserts alias = new tool = its operation's call.

### Arguments by mode
`ARG_MODES` (server.js) is derived from the table (`argModes()`): a mode — of `kind`, `format` (default html) or `coverage`
(default false) — takes its operation's MCP arguments (export's `includeBody`: html / md only). Another mode's argument is
refused before anything runs: `inapplicable-arguments` (`inapplicable` [names]; `args.inapplicable` names what the mode
takes). A mode's `required` (depend → `name`) are `missing-arguments`; the mode key and `projectDir` go everywhere.

### Plugin mode's list
With `SPEC_MCP_APPROVAL_HOOK=on` (mcp/servers.json — the Claude Code plugin) `tools/list` omits `PLUGIN_UNLISTED`:
`spec_stop_check` (the Stop hook decides it) and `spec_log` (the CLI reads git). Both still answer `tools/call`.

### Lean replies
A result never carries its human rendering beside the same data: `spec_export` html / md without `write` returns `{bytes,
preview, truncated, hint}` (the first `EXPORT_PREVIEW_CHARS` of the markdown rendering) unless `includeBody: true`; catalog /
changelog leave their markdown out unless `includeBody`; `spec_upgrade` / `spec_templates` carry no `lines`
(`upgradeLines(r)` / `templatesLines(r)` render the CLI's report). The engine's default (the option omitted) keeps the
document for code callers; both surfaces pass the option (the CLI's `bodyWanted()`), so `--json` stays the MCP result.

## Capabilities
`initialize` advertises `tools`, `prompts`, `resources` (no `listChanged`, no `subscribe`) and `completions`; the logic is
`mcp/lib/prompts-resources.js`. `SPEC_MCP_PROMPTS=off|0|false|no` drops prompts (`prompts/*` → -32601) — mcp/servers.json
sets it for the plugin, whose slash commands are the same files (Claude Code would list each twice).
- **Prompts** = `commands/*.md`, read at runtime (a new command is a new prompt): the file name, its front-matter
  `description`, one optional `args` from `argument-hint` (front matter parsed by hand: BOM / CRLF, quotes, block scalars).
  `prompts/get` replaces `$ARGUMENTS` by split/join (`$&` stays literal) and `${CLAUDE_PLUGIN_ROOT}` by this clone, after a
  one-line localized preamble. CLI: `dev-spec prompts`.
- **Resources**: `specs://roadmap`, `specs://catalog`, `specs://steering/<file>`, `specs://feature/<slug>/<artifact>` (an
  ACTIVE feature's `RESOURCE_ARTIFACTS` — add a new artifact there). `resources/list` pages by `RESOURCE_PAGE` (500) with an
  opaque `nextCursor` (base64url of `o:<offset>`; another form → -32602). `resources/read` parses the URI segment by segment
  (percent-decoded; `..`, separators, `:`, control characters refused — never a URL parser, which resolves `feature/../x`),
  resolves features via `resolveFeature` / `existingFeature`, reads allowlisted names only, never through a symlink /
  junction out of `.specs/` (lstat + realpath).
- **Completions**: feature slugs for a prompt's one-word feature `args`; the values of `{slug}`, `{artifact}`, `{file}`.
- **Errors**: a bad prompt, URI or completion ref → -32602; a well-formed URI naming nothing → -32002 (`data.uri`). No
  projectDir in these requests: the default project (Protocol → the default project from roots), in its language.

## Human approvals over MCP elicitation
A guardrail on the approve paths, like the approval hook — not a sandbox.
- **What is asked.** While `meta.approvalGuard` is `ask` or `deny`, a client that declares `capabilities.elicitation` in form
  mode (`clientElicits`: `{}` or `{form: {…}}`, not `{url: {…}}` alone) is asked (`elicitation/create`) before an AGENT's
  approval runs — the calls the approval hook guards, by the same `spec.approvalGuardDecision()`: `spec_approve` (approve,
  revoke, `through`, force / waiver), `spec_feature` remove, `spec_init` lowering a protection, `spec_add_track {remove:
  true}` dropping +tdd / +ai.
- **`approvalPolicy()`** (server.js): nothing is asked with the guard off, for a projectDir runTool refuses, or at `ask` under
  `SPEC_MCP_APPROVAL_HOOK=on` (the plugin's hook asks — never twice); `deny` holds even there (a call that reaches the server
  got past no hook). Without elicitation `ask` runs and `deny` refuses (`humanRequired: true`; `command`, with `{plain:
  true}`, is the runnable line WITHOUT Claude Code's `! ` prefix).
- **The question** (`msg.elicit`, the feature's language): the action `summary`, naming the slug the engine resolves
  (`opts.resolveFeature`), never the raw argument, plus the gate from a **dry run** (`spec.approvePhase(…, {dryRun: true})` —
  gates-and-approvals.md → the dry run); a remove's says how much it deletes (`elicit.removeSize`). A gate that refuses
  anyway, an error or a fast-forward with nothing to do is answered as it is — NOBODY is asked. `requestedSchema`: `approve`
  (boolean, default false, required) + `note` (≤ 500).
- **Only `action: "accept"` with `content.approve === true` runs the call**, recording `confirmation` {via: "elicitation", at,
  note?} as `confirmed` (`confirmationOf()`, gates.js — never a tool argument) and passing `preview`, what the dry run judged:
  content edited, another approval recorded or an unnamed check failing by then records nothing (`changed-since-preview`). A
  remove's preview is its folder's `featureFolderFingerprint()` (identity kept across a rename, every entry), compared under
  the folder's lock (`removeFeatureLocked`).
- **Any other answer** — decline, cancel, accept without approve (`elicit.unapproved`), a client error, none within
  `DEV_SPEC_ELICIT_TIMEOUT_MS` (5 min, ≤ 1 h) — is `{ok: false, declined: true, …}`, nothing recorded. `confirmed` goes only
  on a result that isn't `ok: false`.
- **Cancellation**: the waiting call is an `inflight` entry; the client's `notifications/cancelled` withdraws its question,
  records nothing and gets NO reply (MCP). **Progress**: a call with `_meta.progressToken` gets `notifications/progress`
  (`elicit.waiting`) every `PROGRESS_EVERY_MS` (10 s) while it waits.
- **Known limit — `SPEC_MCP_APPROVAL_HOOK=on` at `ask`** (documented, not changed): if the hook doesn't run
  (`disableAllHooks`, a managed policy, a hook that failed open) the call runs unasked — eliciting would ask twice where it
  did (no hook→server stamp tells them apart). For a guard that holds with hooks disabled: `approvalGuard: deny`.

## Argument validation
`tools/call` arguments are checked against the tool's advertised `inputSchema` (an alias: its old one) before anything runs —
over the SCHEMA's keys, never the caller's (`__proto__` is ignored); an absent or `null` value is "not given". In order:
1. **`arguments` not an object** → `invalid-arguments`.
2. **Folding** (`foldEnumArgs`): the enums the engine case-folds (`phase`, `lang`, `kind`, `action`) are trimmed + lowercased
   to their member, a `lang` alias canonicalized (the CLI passes `Design` / `PT` straight through); `spec_import`'s `tool`
   stays exact (`EXACT_ENUMS`). A schema `type` is ONE string, never a list (some clients reject one): a boolean becomes
   `"on"` / `"off"` for an on / off enum (spec_init `guard`), `"true"` / `"false"` for a `BOOL_STRING_ARGS` string
   (`spec_create {branch}`).
3. **Unknown arguments** (`unknownArgs`) — a misspelt key must never change what the call does: refused, with a did-you-mean
   (`ARG_ALIASES` — feature → name, task → number… — else `spec.closestName`: optimal-string-alignment, ≤ max(1, ⌊length /
   3⌋) edits, the CLI's flag rule, suggestTrack's too), before the required check (`nmae` reads as unknown with its fix).
   Nested keys too, by path (`tasks[0].verfy`), unless `additionalProperties` (spec_init `checks`). Every `mcp` argument of a
   tool's operations must be in its schema (02-mcp-server.js checks the table).
4. **Required** (`missingArgs`): `required` (a blank string is not given, except `EMPTY_OK`), nested ones by path
   (`evidence[0].command`), a `REQUIRED_ONE_OF` group (spec_import: `path` or `text`, `unless` a steering tool —
   `spec.STEERING_IMPORT_TOOLS`) and the mode's.
5. **Types** (`invalidArgs`): `integer` = a *safe* integer (`1.9` / `1e21` never become task 1), `enum`, `minimum`, `maximum`
   (`spec_next_task.max` ≤ 8), `minItems`, items, nested properties. A task `number` has `minimum: 0` (next serves a
   hand-written task 0); the engine refuses the CLI's raw words alike (`msg(lang).args` — conventions.md → CLI boolean
   switches).
6. **The mode** (an alias translated first): `inapplicable-arguments` (Arguments by mode).
7. **projectDir** (below). The engine validates the rest (track names, AC IDs, paths).

### projectDir
`projectDirArg` reads it with no fs call first (`parseProjectDir`, over `HOOK_UTILS.parseProjectDir` / `fileUriToPath` of
hooks/hook-utils.js — the approval hook's own parser):
- **Not given** — absent, blank, an unexpanded variable (`spec.unexpandedVar`: any `${`, a leading `$NAME`, `%NAME%`) → the
  client's root when roots gave the default project, else left out.
- **Refused before ANY fs call**: a `..` segment (`project-dotdot`); a network or device path (`isNetworkPath`:
  `\\host\share`, `//host/share`, `\\?\UNC\…`, `\\.\UNC\…`) or a `file://` URI naming a host (`project-network`) — no SMB
  connection to a host a call names; `\\?\C:\…` and `\\wsl$` / `\\wsl.localhost` are local; a `file://` URI that is no local
  folder (`project-uri`).
- A local `file://` URI is its path; a relative path resolves from the client's root (when roots chose the default) or the
  server's folder. The folder must EXIST, like the CLI's `--project`: `project-missing` (only `spec_init` creates one),
  `project-not-dir`. The default projectDir and the CLI are not restricted.
- **spec_import** returns what it reads, so an explicit projectDir that isn't the default project (`sameFolder`) must hold a
  dev-spec `.specs/` (`spec.isDevSpecDir`, `SPECS_REQUIRED`), else `project-no-specs` (templates-imports-exports.md →
  spec_import stays inside the project) — as the `initialize` instructions say ("Everything is local: writes stay in the
  project's .specs/, reads inside the project …").

### Stable codes
An argument error is the tool's JSON `{ok: false, error, code, …}` (`argError`, `isError: true`): `unknown-argument`
(+ `unknown` [{argument, didYouMean?}]) · `missing-arguments` (+ `missing`) · `invalid-arguments` (+ `invalid`, the paths) ·
`inapplicable-arguments` · `project-dotdot` · `project-network` · `project-uri` · `project-missing` · `project-not-dir` ·
`project-no-specs`. Callers branch on the code (English); the message is in the project language. The feature resolver's
refusals carry `feature-not-found` · `feature-name-invalid` · `feature-name-reserved`, on every tool and the CLI's `--json`.
- **A tool that THROWS** answers JSON too: `toolFailure()` → `args.toolFailed`, the error's code (e.g. ENOTDIR).
- **Compact results**: the result text is `JSON.stringify(out)`, unindented (`toolReply`) — indentation was ~22% of what an
  agent pays per reply; clients parse JSON, nothing reads the layout.

## Protocol
- **Framing.** Newline-delimited JSON over stdio. Input splits on `\n` ONLY (a `StringDecoder` keeps multibyte characters
  whole; a trailing `\r` is dropped) — never `readline`: it also splits on U+2028 / U+2029, legal raw in JSON strings, and
  cut a request in two; replies escape both (`frame()`). Past `MAX_MESSAGE` characters (32 MiB; `DEV_SPEC_MCP_MAX_MESSAGE`,
  ≥ 1024) a message gets -32600 once (`args.tooLarge`) and the rest of its line is skipped. On stdin close the server exits
  after its flush.
- **`initialize`** echoes a supported `protocolVersion` (`SUPPORTED_PROTOCOLS`: 2024-11-05 … 2025-11-25), else the latest;
  default `2024-11-05`. Its instructions name spec_next_action as the "where am I / what now?" call.
- **Messages.** No `id` member = a notification: no reply, no tool run. An `id` that isn't a string or an integer → -32600
  (id null); no string `method` → -32600, except a client's response (`result` / `error`), ignored whatever its id. A batch
  gets ONE array; malformed input -32600 / -32700; an unknown method -32601; an unknown tool -32602 (`args.unknownTool`).
- **Server-initiated requests** (an approval waiting for the user, a request waiting for the client's roots): `clientRequest()`
  writes `{id: "dev-spec-<n>", …}` straight to stdout (never into a batch) and keeps its handler in `serverRequests`; the
  client's response settles it, as do a timeout and `cancel()` (sending `notifications/cancelled`, unless a `late` handler —
  roots/list's — keeps listening). Other requests are answered meanwhile; a late reply goes where its request came from
  (`sendTo(sink, …)`), and a batch's array waits for all of it (`onLine`).
- **The default project from roots.** With no usable SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR (`envDirSet`), a client that
  declares `capabilities.roots` is asked `roots/list` ONCE, on the first `NEEDS_PROJECT` request (`rootsPending()`,
  `deferUntil()`). Its first LOCAL `file://` root (`fileUriToPath`: no host but localhost, no `..`, a drive on Windows) is
  `rootsDir`: the projectDir of a call without one, the base of a relative one, the project of resources / prompts /
  completions (`defaultProjectDir()`). No usable root, an error or no answer within `ROOTS_TIMEOUT_MS` (5 s;
  `DEV_SPEC_ROOTS_TIMEOUT_MS`, ≤ 60 s) → the cwd until `roots/list_changed`, though a later answer still counts unless another
  ask started since (`rootsGen`). The engine's `resolveProjectDir` is untouched.
- **The feature-lock wait.** The engine is synchronous, so a call waiting for a lock another LIVE process holds
  (conventions.md → the locks) freezes the whole server: the server sets `DEV_SPEC_LOCK_WAIT_MS` to `MCP_LOCK_WAIT_MS` (2 s)
  unless the user set it (the engine reads it per acquisition, `lockWaitMs`), then answers the usual busy refusal (`busy:
  true`). The CLI and the hooks keep 10 s.

## History
How the rules above came to be, section by section — grep a release (`1.21.1`) or a finding id (`M8`, `r6 B3`) here.

### MCP tools
- **1.14 F1** — the observed-run log: only the observe hook writes `.execution/observed.jsonl`, so no tool can forge an
  `observed` stamp.
- **1.23** — the description budget: `tools/list` had grown to ~124k characters (~31k tokens); descriptions cut to what it
  takes to choose and call the tool brought it to 76k.
- **1.24 r6 A5** — `projectDir` described on every tool (`PROJECT_DIR_INIT` for spec_init, the shared `PROJECT_DIR`
  elsewhere).
- **1.26 (the context diet)** — 38 tools / 75,909 characters → 32 / ~43,000; `TOOLS_LIST_CAP` set at that size + ~3%. Seven
  tools folded into modes of four (spec_list, spec_backlog, spec_depend, spec_milestone, spec_catalog, spec_changelog,
  spec_coverage), each kept callable as a hidden alias checked against its old schema; `ARG_MODES` added; plugin mode stopped
  listing `spec_stop_check` / `spec_log` (~2k characters every session). Lean replies: a template-only feature's HTML export
  was ~18.5k characters per call (now a preview unless `includeBody`); spec_upgrade / spec_templates dropped their `lines`.
- **1.27** — the operations table (`mcp/lib/operations.js`, 40 entries) both surfaces run through: runTool lost its own
  dispatch, the CLI's handlers call `c.call(id, given)`, `ARG_MODES` is derived from it (`argModes()`); `createFeature` /
  `completeTask` take an options object; the structural parity tests (`mcp/tests/02-mcp-server-tools.js`,
  `cli/tests/02-surfaces-parity.js`).

### Capabilities
- **1.14** — no longer tools-only: prompts (`commands/*.md`) and the `specs://` resources.
- **1.16** — `completions {}` (completion/complete).
- **1.23** — `resources/list` in pages (`RESOURCE_PAGE`, `nextCursor`); until then a hard cap of 500, the rest reachable only
  through the templates.

### Human approvals over MCP elicitation
- **1.21 F1b** — introduced: a client that can elicit is asked before an agent's approval runs, previewed by a dry run, the
  answer recorded as `confirmed`; without elicitation `ask` runs as before and `deny` refuses.
- **1.21 review A4** — the `deny` refusal's `command` became the plain line (`{plain: true}`): the `! ` prefix is Claude
  Code's, unrunnable in PowerShell / cmd.exe; the Claude Code hook keeps its `!` form.
- **1.21 review A6** — `confirmed` only on a result that isn't `ok: false` (a fast-forward a later gate stopped carried it;
  the phases it approved carry their own `confirmed` in .state.json); an accept without approve got its own text instead of
  "declined".
- **1.22 review** — at `deny`, `SPEC_MCP_APPROVAL_HOOK=on` no longer waves the call through (one that reaches the server got
  past no hook: disableAllHooks, a managed policy, a hook that failed open); the confirmation carries the dry run's `preview`,
  so content edited while the question waited is never recorded as approved.
- **1.23** — the question (and `command`) name the slug the engine resolves, never the raw argument; `spec_feature` remove is
  previewed with a folder fingerprint — the confirmation used to delete a feature renamed into the name while the question
  waited; cancellation — the call used to keep waiting and record the approval of a call the client had given up on (a client
  tool-call timeout shorter than the 5-minute question); progress notifications while a question waits.
- **1.24 review 6** — `spec_add_track {remove: true}` turning +tdd / +ai off is asked like any approval (the gates they
  carry); a revoke is previewed (`approvedAt` / `withdrawn`), so an approval recorded meanwhile is not revoked in its place.
- **1.24 r6 A-I8** — a remove's question says how much it deletes (`elicit.removeSize`).
- **1.25.1 review 7** — the Known limit (`SPEC_MCP_APPROVAL_HOOK=on` at `ask` with the hook not running) documented, not
  changed: eliciting there would ask twice without a hook→server handshake.

### Argument validation
- **1.12** — the MCP accepted `Design` / `PT`; `foldEnumArgs` keeps it so.
- **1.14** — `guard` gained `scope` and became a string enum; the pre-1.14 `guard: true` keeps working through the boolean →
  `"on"` / `"off"` fold.
- **1.22 review** — a task `number` got `minimum: 0`: `-1` read "must be an integer", and refusing 0 looped next → complete.
- **1.23** — a tool that throws answers JSON (`toolFailure()`; it was the bare text `ERROR: <message>`); the CLI refuses an
  unknown flag.
- **1.23 review L14** — projectDir must exist, like the CLI's `--project`: spec_create into a mistyped path built the whole
  tree there, the list (`spec_status` without name, then spec_list) on a file answered `{exists: false}`, a `file://`
  projectDir ended in ENOENT.
- **1.24 r6 A1** — unknown arguments refused. They were ignored, and a misspelt key changed what the call did:
  `spec_approve {revoked: true}` RE-APPROVED changed content, `spec_task_brief {task: 3}` briefed the next task,
  `spec_export {feature}` exported the whole project.
- **1.24 r6 A2 / A3** — projectDir read without any fs call; a network path refused before any (an SMB connection to a host
  a call names, a hang on an unreachable one); an unexpanded variable is any `${` / leading `$NAME` / `%NAME%` — only a whole
  `${VAR}` was caught, so with roots `$HOME` / `${workspaceFolder}/` went to the server's cwd; a relative projectDir resolves
  from the client's root — it went to the server's cwd, and `.` from Claude Desktop scaffolded the app folder.
- **1.24 r6 A5** — `maximum` checked (`spec_next_task.max` ≤ 8, the message "between 1 and 8").
- **1.24 r6 A-I2** — every argument error carries a stable `code`.
- **1.24 r6 A-I1** — compact results: on a realistic feature (core +tdd +saas +sec — spec_doctor, spec_status,
  spec_task_brief, spec_next_action, trace_check {matrix}, the list, spec_roadmap, spec_create {includeBody}) the replies went
  from 40,529 to 31,435 characters (−22%; trace_check −42%, spec_status −32%; create's embedded markdown barely changed).
- **1.25** — `REQUIRED_ONE_OF`'s `unless` (a steering import defaults its path); `BOOL_STRING_ARGS` for `spec_create
  {branch}`.
- **1.25.1 review 7** — nested unknown keys refused (`verfy` appended a task with no `_Verify:_`, which then ticked "verified,
  nothing to verify"; `evidence[0].sumary` dropped the summary); nested required keys (`evidence: [{}]` reached the engine as
  "'undefined' is not a project check"); `minItems` (`tasks: []` appended nothing); projectDir parsing moved to
  hooks/hook-utils.js and shared with the approval hook, which read a `file://` URI as a relative folder and let an approval
  of that project through; spec_import needs a dev-spec project behind an explicit projectDir — `{projectDir: "<home>/.aws",
  path: "credentials"}` returned the credentials; the `initialize` instructions corrected (the old "All file ops are local to
  the project's .specs/ directory" was not true of the scans and the import); the feature resolver's refusals got their codes
  (they were `{ok: false, error}` alone).
- **1.26** — `inapplicable-arguments` (Arguments by mode): another mode's argument used to be another tool's, an unknown one.

### Protocol
- **1.21 F1b** — the first server-initiated request (`elicitation/create`): the server answers other requests while one
  waits, and a batch's array waits for its late replies.
- **1.23** — `2025-11-25` supported; `MAX_MESSAGE` (a line growing past it grew until the process died); notifications that
  change state (`cancelled`, `roots/list_changed`); the default project from roots — without SPEC_PROJECT_DIR /
  CLAUDE_PROJECT_DIR it was the server's cwd, an app or home folder where spec_init scaffolded `.specs/`.
- **1.24 r6 A2** — the unexpanded-variable rule widened for a call relying on the roots (Argument validation above).
- **1.24 r6 A6** — the feature-lock wait: a call waiting for another process's lock (a CLI `done`, another editor's server)
  froze the whole server — pings, every tool, a pending approval's reply — for `DEV_SPEC_LOCK_WAIT_MS` (10 s); the server now
  waits `MCP_LOCK_WAIT_MS` (2 s), where the client retrying beats a frozen server.
- **1.25.1 review 7** — a `roots/list` timeout no longer cancels the request: a later answer was dropped and the cwd stayed
  the default for the session (`late` handler, `rootsGen`).

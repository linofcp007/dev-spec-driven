# The MCP server — tools, capabilities, arguments, protocol

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
What the server advertises and validates, and how it frames messages.

## MCP tools (in `mcp/lib/engine/`, exported by `mcp/lib/spec.js`, dispatched by `mcp/server.js`)
`spec_init` · `spec_classify` · `spec_create` · `spec_list` · `spec_status` · `spec_next_task` ·
`spec_complete_task` · `ears_validate` · `trace_check` · `spec_doctor` · `spec_approve` ·
`steering_scaffold` · `spec_roadmap` · `spec_backlog` · `spec_depend` · `spec_scan` ·
`spec_coverage` · `spec_clarify` · `spec_next_action` · `spec_add_track` · `spec_feature` ·
`spec_task_brief` · `spec_finish` · `spec_import` · `spec_append_tasks` · `spec_impact` ·
`spec_metrics` · `spec_catalog` · `spec_drift` · `spec_upgrade` · `spec_templates` · `spec_export` ·
`spec_changelog` · `spec_decide` · `spec_tracks` · `spec_stop_check` · `spec_log` · `spec_milestone` (**38 total**; `mcp/test.js` asserts the exact count —
verify with an `initialize` + `tools/list` handshake against `mcp/server.js`). All tools are pure-local file ops on
`.specs/` (or a read-only codebase scan for brownfield / `trace --code` / import); none hit the network, run a command or
call git. Scaffolders never overwrite an existing file; mutators edit only what they own (checkboxes, appended tasks and
track sections, appended `decisions.md` entries, `.state.json` / `roadmap.json`, generated `ROADMAP.*` / `SPECS.md` /
`UPGRADE.md` / `RELEASE-NOTES.md` / `.specs/exports/*`, templates `init` copies) and never rewrite spec prose. The
observed-run log (`.execution/observed.jsonl`, F1) is written only by `hooks/observe-hook.js` through `observeRun()` —
no tool writes it, and no tool accepts an `observed` stamp from its caller.
**The description budget (1.23).** `tools/list` is what every client that loads its tools up front pays in context on every
session — it had grown to ~124k characters (~31k tokens). A description says what the tool does and the rules an agent must act
on (evidence before claims, approvals are the user's, what a refusal or a stable code means) — at most 2,500 characters, one
line; the reference detail (every output field, every check id, formats) lives in `references/tooling-reference.md` and the
topic files. `mcp/tests/02-mcp-server.js` holds the whole list under 76,000 characters (the clone's CLI path counted as
`dev-spec`); the tests that pin a description's wording (a rule) name it. `projectDir` (1.24 r6 A5) is described on every tool:
`spec_init`'s (`PROJECT_DIR_INIT`) says how the folder is chosen (see Argument validation → projectDir), every other tool shares
the bare `PROJECT_DIR` ("Project folder") — 37 copies of a longer text cost ~2k characters of the budget (74,946 with it).
Roadmap/deps persist in `.specs/roadmap.json`; cross-feature deps are cycle-checked and must name existing features.

**Capabilities (1.14 — no longer tools-only).** `initialize` advertises `tools {listChanged: false}`, `prompts
{listChanged: false}`, `resources {listChanged: false, subscribe: false}` and (1.16) `completions {}`; the logic lives in
`mcp/lib/prompts-resources.js`, server.js only maps it onto JSON-RPC. `SPEC_MCP_PROMPTS=off|0|false|no` drops the
prompts capability (and `prompts/*` answers -32601): `mcp/servers.json` sets it for the Claude Code plugin, whose own
slash commands are the same files — without it Claude Code lists every command twice (`/mcp__…__spec-impact`).
- **Prompts** = `commands/*.md`, read at runtime (never a hardcoded list — a new command is a new prompt): name = file
  name without `.md`, description = front-matter `description`, one optional `args` argument described from
  `argument-hint` (front matter parsed by hand: BOM/CRLF, quoted values, block scalars). `prompts/get` renders the body
  with `$ARGUMENTS` ← args (split/join — `$&` stays literal) and `${CLAUDE_PLUGIN_ROOT}` resolved to this clone, after a
  one-line localized preamble for agents without the skill (follow AGENTS.md; where references/ lives). CLI parity:
  `dev-spec prompts [name] [--args "…"]`.
- **Resources**: `specs://roadmap` (ROADMAP.md, else rendered in memory from roadmap.json), `specs://catalog`
  (SPECS.md), `specs://steering/<file>`, `specs://feature/<slug>/<artifact>` for the allowlisted artifacts of each
  ACTIVE feature (classification, requirements, design, test-plan, eval-plan, load-test, tasks, bug, quickstart,
  checklist, integration-plan, retro, spike, decisions, change — `RESOURCE_ARTIFACTS`: add a new artifact there);
  `resources/templates/list` gives the two templates. The list comes in pages (1.23 — a hard cap of 500 until then):
  `RESOURCE_PAGE` (500) resources, then `nextCursor` while there are more (MCP pagination; the cursor is opaque — base64url of
  `o:<offset>` — and only the exact form handed out is accepted: another is `-32602`, `promptsResources.err.badCursor`).
  `resources/read` parses the URI segment by segment (percent-decoded; `..`, separators, `:` and control characters refused — never a URL
  parser, which would resolve `feature/../x`), resolves features through `resolveFeature`/`existingFeature`, reads
  allowlisted names only and never follows a symlink/junction out of `.specs/` (lstat + realpath).
- **Error codes**: an unknown prompt or bad prompt arguments, and an invalid / refused URI → `-32602` (Invalid params);
  a well-formed URI naming nothing → `-32002` (Resource not found); a `resources/read` error carries `data.uri`
  (JSON-RPC `error()` takes an optional `data`). Prompts and resources use the default project (SPEC_PROJECT_DIR /
  CLAUDE_PROJECT_DIR / the client's first root / the nearest dev-spec project at or above cwd / cwd — see Protocol → the
  default project from roots, and `resolveProjectDir` in conventions.md) — neither request carries a projectDir — and speak its
  language.

**Human approvals over MCP elicitation (1.21 F1b).** A client that declares `capabilities.elicitation` in `initialize` in form
mode — `{}` (2025-06-18) or `{form: {…}}` (2025-11-25); `{url: {…}}` alone can't show a form and counts as no elicitation —
(`clientElicits`) gets, while `roadmap.json → meta.approvalGuard` is `ask` or `deny`, an `elicitation/create` request before
an AGENT's approval runs — the calls the approval hook guards, read by the same pure `spec.approvalGuardDecision()` (a synthetic
PreToolUse payload): `spec_approve` (approve, revoke, `through`, force / waiver), `spec_feature {action: "remove", confirm: true}`,
`spec_init` lowering a protection, `spec_add_track {remove: true}` turning +tdd / +ai off (1.24 review 6 — the gates they carry).
A revoke's question carries its preview too (the dry run's `approvedAt` / `withdrawn`: another approval recorded while the user
reads it is not revoked in its place). `approvalPolicy()` (server.js) decides: guard off, `SPEC_MCP_APPROVAL_HOOK=on` at `ask`
(mcp/servers.json sets it for the Claude Code plugin — its PreToolUse hook asks there, so that path is unchanged and nothing is
asked twice), a network / `..` projectDir (runTool refuses it) → the call runs as before. At `deny` the env var no longer waves
the call through (1.22 review): the hook refuses every agent approval, so one that reaches the server got past no hook
(disableAllHooks, a managed policy, a hook that failed open) — it is handled as in any client. Otherwise: elicitation → ask; no elicitation → `ask`
runs as today, `deny` is refused (`{ok: false, refused, humanRequired: true, approvalGuard: "deny", command, error}` — the
server asks `approvalGuardDecision(…, {plain: true})` (1.21 review A4): `command` is the plain runnable line, WITHOUT Claude Code's
`! ` prefix (a PowerShell / cmd.exe user can't run `! node …`), and `error` is `approvalGuard.denyMcp` — "in their own terminal",
never the `!` prefix; the Claude Code hook keeps its `!` form). The question (`msg.elicit`, the feature's language — else the
project's): `summary` (approvalGuardDecision's action line — 1.23: with `opts.resolveFeature`, the feature an action names is the
slug the engine resolves, never the raw argument: slugify drops text in other scripts, which must not reach the human's question;
the `command` names the slug too) + the gate from a **dry run** — `spec.approvePhase(…, {dryRun: true})`
runs every check and writes nothing (approve → `{dryRun, failing, checks, role?, waiver?}`, revoke → `{dryRun, revoke}`, through
→ `{dryRun, chain}`); a remove's question also says how much it deletes (1.24 r6 A-I8: `elicit.removeSize` — `.specs/<slug>/`
and the file count of remove's own preview, `wouldDelete.files`); a gate that refuses anyway (or an error, or a fast-forward with nothing to do) is answered as it is and
NOBODY is asked. `requestedSchema`: `approve` (boolean, default false, required) + `note` (string ≤ 500). Only `action:
"accept"` with `content.approve === true` runs the call, with `confirmation` {via: "elicitation", at, note?} (a one-line note)
recorded as `confirmed` on the approval, its history record, a role's sign-off and a revocation record (`confirmationOf()`,
gates.js — never a tool argument) — and with `preview` (1.22 review), what the dry run judged: `{fingerprint,
designFingerprint?, failing}` / a fast-forward's `{chain, fingerprints}`; the engine records nothing else (content edited while
the question waited, or — forced — a check failing that the question didn't name → `changedSincePreview: true`, code
`changed-since-preview`; gates-and-approvals.md → the dry run). `spec_feature` remove (1.23): its preview (`removePreview`,
finish.js) carries `fingerprint` — `featureFolderFingerprint()`: the folder's identity (device + inode / file ID + birth time,
kept across a rename) and every entry under it (path, size, mtime; lstat; the feature's own `.lock` left out) — passed back as
`preview: {fingerprint}`; `removeFeatureLocked` compares it under the folder's lock and refuses another folder (a feature renamed
into the name while the question waited — the confirmation used to delete it) or an edited one: `changedSincePreview`, code
`changed-since-preview`, `featureOps.removeChangedSincePreview`, nothing deleted. The result gains `confirmed` (+ a localized `message`) only when it isn't `ok: false` (1.21
review A6 — a fast-forward a later gate stopped: the phases it approved carry their own `confirmed` in .state.json). Decline /
cancel / an accept without approve / a client error / no answer within `DEV_SPEC_ELICIT_TIMEOUT_MS` (default 300000, ≤ 1 h) →
`{ok: false, declined: true, approvalGuard, action | elicitationError | timedOut, error}` (localized — an accept without approve
has its own text, `elicit.unapproved`: the user answered without ticking Approve, `action: "accept"`), nothing recorded; a timeout also sends the client
`notifications/cancelled {requestId, reason: "timeout"}`. **Cancellation (1.23):** the waiting call is an `inflight` entry (by its
JSON-encoded request id); the client's `notifications/cancelled {requestId}` for it withdraws the question (the server's own
`notifications/cancelled` for `dev-spec-<n>`, so the client can close it), records nothing — an Approve the user clicks
afterwards is ignored — and sends NO reply to the cancelled request (MCP). It used to keep waiting and record the approval of a
call the client had given up on (a client tool-call timeout shorter than the 5-minute question). **Progress (1.23):** a call
carrying `_meta.progressToken` gets `notifications/progress {progressToken, progress: 0, 1, …, message: elicit.waiting}` at once
and every `PROGRESS_EVERY_MS` (10 s) while its question waits — a client whose tool-call timeout restarts on progress keeps
the call. A guardrail on the approve paths, like the hook — not a sandbox.

**Argument validation (server.js).** Before dispatch, `tools/call` arguments are checked against the
tool's advertised `inputSchema`, in this order — `arguments` that isn't an object; then **unknown arguments** (1.24 r6 A1,
`unknownArgs`): a top-level key the schema's `properties` don't list is refused, nothing runs. They used to be ignored, and a
misspelt key changed what the call did — `spec_approve {revoked: true}` RE-APPROVED changed content, `spec_task_brief {task: 3}`
briefed the next task, `spec_export {feature}` exported the whole project; the CLI refuses an unknown flag since 1.23. The
reply lists them with a did-you-mean: a word people type for an argument (`ARG_ALIASES` — feature / slug → name, task → number,
project / dir → projectDir, untick → undo, unapprove → revoke — when the tool takes it), else `spec.closestName` (core.js — the
optimal-string-alignment distance, ≤ max(1, ⌊length / 3⌋) edits, case-insensitive: the CLI's flag rule; suggestTrack uses it
too). Checked before the required keys, so a misspelt required key (`nmae`) reads as unknown with its fix, not as missing. A
`null` unknown key is "not given", like any argument. **Nested keys too (1.25.1, review 7):** an object whose schema lists
`properties` — an array's items included — refuses a key it doesn't list, by its path (`tasks[0].verfy`, did-you-mean
`tasks[0].verify`; the message lists the keys that object takes, `tasks[] {text, …}`): `verfy` appended a task with no
`_Verify:_` (which then ticked "verified, nothing to verify"), `evidence[0].sumary` dropped the summary. An object declared with
`additionalProperties` (spec_init `checks`) takes any key. Every
`args.X` runTool reads must be in its tool's schema — a key it doesn't list would now be refused, never read (a guard in
02-mcp-server.js parses runTool's `case`s). Then required keys (`missingArgs` — a nested object's `required` too, by path:
`evidence[0].command`, `tasks[0].text`; `evidence: [{}]` reached the engine as "'undefined' is not a project check"), then types (`invalidArgs` — `integer` means
a *safe* integer, so `1.9` / `1e21` never become task 1), `enum`, `minimum`, `maximum` (1.24 r6 A5 — `spec_next_task.max` ≤ 8;
the message reads "between 1 and 8"), `minItems` (1.25.1 — `spec_append_tasks.tasks`, `args.atLeastItems`), array `items` and nested
object properties. A task `number` (spec_task_brief, spec_complete_task) carries `minimum: 0` (1.22 review — `-1` read "must
be an integer"; 0 is a task number: next serves a hand-written task 0, so refusing it looped next → complete); the engine
refuses the CLI's raw word in these same words (`msg(lang).args` —
conventions.md → CLI boolean switches), and a roadmap `order` past the safe range alike. It iterates the SCHEMA's keys, never the caller's (`__proto__` arguments are ignored);
an absent or `null` value means "not given". `REQUIRED_ONE_OF` (spec_import: `path` or `text`) is a group `{names, unless}` —
1.25: `unless` the tool is a steering one (`spec.STEERING_IMPORT_TOOLS`: its path defaults to the tool's own folder). Last, **projectDir** (`projectDirArg` — 1.24 r6 A2 / A3), read without any fs call
first (`parseProjectDir`): not given — absent, blank, or holding a variable a client left unexpanded (`spec.unexpandedVar`: any
`${`, a leading `$NAME`, a `%NAME%` — only a whole `${VAR}` was caught, so with roots `$HOME` / `${workspaceFolder}/` went to the
server's cwd) → the client's root when roots gave the default project, else left out (the engine's default); a relative `..`
(never resolved away first), or a network `projectDir` (`isNetworkPath`: UNC `\\host\share`, `//host/share`, `\\?\UNC\…`,
`\\.\UNC\…` and other device paths — refused before ANY fs call, argument errors included, so a tool call can't make
the server open an SMB connection to a host it names or hang on an unreachable one; `\\?\C:\…` and WSL's `\\wsl$` /
`\\wsl.localhost` are local), or a `file://` URI naming a host, is refused; a local `file://` URI (what roots/list hands a
client) is its path (`fileUriToPath`); a RELATIVE path resolves from the client's root when roots chose the default (it went to
the server's cwd — `.` from Claude Desktop scaffolded the app folder), else from the server's working folder. The folder must
EXIST, as the CLI's `--project` (1.23 review L14): a missing one is refused (`project-missing`) — only `spec_init` creates one —
and so is a file (`project-not-dir`): `spec_create` into a mistyped path built the whole tree there, `spec_list` on a file
answered `{exists: false}`, a `file://` projectDir ended in ENOENT. The engine receives the absolute folder; `resolveProjectDir`
is unchanged. The default projectDir (cwd / env / roots) and the CLI are not restricted by these rules. **spec_import (1.25.1,
review 7)** reads the files its path names and returns them (`dryRun`: `preview`) — `{projectDir: "<home>/.aws", path:
"credentials"}` returned the credentials: an explicit projectDir other than the default project (`sameFolder` by real path) must hold
a dev-spec `.specs/` (`spec.isDevSpecDir` — `SPECS_REQUIRED`), else `project-no-specs` (`args.projectNoSpecs`: run spec_init there
first); the engine refuses hidden folders and non-documents everywhere (templates-imports-exports.md → spec_import stays inside the
project). The `initialize` instructions say so ("Everything is local: writes stay in .specs/, reads inside the project…" — the
old "All file ops are local to the project's .specs/ directory" was not true of the scans and the import) and name spec_next_action
as the "where am I / what now?" call for clients without the skill.
**Stable codes (1.24 r6 A-I2).** Every argument error is the tool's JSON `{ok: false, error, code, …}` (`argError`), `isError:
true`: `unknown-argument` (+ `unknown` [{argument, didYouMean?}]) · `missing-arguments` (+ `missing` [names]) ·
`invalid-arguments` (+ `invalid` — the paths, e.g. `["number", "evidence.exitCode"]`; arguments that aren't an object:
`["arguments"]`) · `project-dotdot` · `project-network` · `project-uri` · `project-missing` · `project-not-dir` · `project-no-specs` (1.25.1, spec_import). Callers branch
on the code (English, stable); the message is in the project language — the default project's for a projectDir refusal. The feature resolver's refusals (1.25.1, review 7 — `resolveFeature` / `existingFeature`, state.js) carry their code too, on
every tool and the CLI's `--json`: `feature-not-found` · `feature-name-invalid` (no usable slug) · `feature-name-reserved` (they were
`{ok: false, error}` alone); an operation that hands such a refusal back keeps the code (`{ok: false, error: f.error, code: f.code}`).
Messages are localized in the project language (`msg(lang).args`). The engine
still validates what schemas can't express (track names, AC IDs, paths). String enums the engine case-folds
(`phase`, `lang`, `kind`, `action`) are trimmed + lowercased first (`foldEnumArgs`) — the CLI passes `Design` / `PT`
straight to the engine and the 1.12 MCP accepted them; `spec_import`'s `tool` stays exact on both surfaces
(`EXACT_ENUMS`). The engine and the CLI fold `backlog`'s action too (`ADD` adds on every surface).
A schema `type` is always ONE string, never a list (`["string", "boolean"]` — not every MCP client handles list-valued
types): `spec_init`'s `guard` is a plain string enum `on | off | scope`, and `foldEnumArgs` turns a boolean into
`"on"` / `"off"` for any string enum holding both (the pre-1.14 `guard: true` keeps working). A free string that also reads
`'true'` / `'false'` (1.25 — `spec_create {branch}`: `'true'` = the default branch name, else the name) is listed in
`BOOL_STRING_ARGS`: a boolean given for it becomes its word (`"true"` / `"false"`) before validation, and the engine reads the
words (any case) — `branch: true` works, the schema stays `type: "string"`.
A tool that THROWS (a file system error — `.specs` being a file) answers the JSON every other refusal is
(1.23 — it was the bare text `ERROR: <message>`): `toolFailure()` → `{ok: false, error: args.toolFailed(<message>), code: <the
error's code, e.g. ENOTDIR>}` with `isError: true`, in the project's language.
**Compact results (1.24 r6 A-I1).** A tool's result text is `JSON.stringify(out)` — no indentation (`toolReply`, argument errors
included). The indentation was what every agent paid in context on every call: measured on a realistic feature (core +tdd
+saas +sec — spec_doctor, spec_status, spec_task_brief, spec_next_action, trace_check {matrix}, spec_list, spec_roadmap,
spec_create {includeBody}) the replies went from 40,529 to 31,435 characters (−22%; trace_check −42%, spec_status −32%; a reply
that is mostly embedded markdown, create's bodies, barely changes). Every client parses the text as JSON; nothing reads its layout.

## Protocol (from Conventions & gotchas)
- **Protocol**: stdio transport is newline-delimited JSON; messages must not contain embedded
  newlines (tool descriptions are single-line strings). Framing splits on `\n` ONLY (a `StringDecoder` keeps multibyte
  characters whole across chunks; one trailing `\r` is dropped) — never `readline`, which also splits on U+2028 / U+2029,
  both legal raw inside a JSON string (text pasted from Word / PDF): a valid request was cut in two and never answered.
  Replies escape U+2028 / U+2029 (`frame()`) so readline-based clients survive them. `initialize` echoes the client's
  `protocolVersion` when supported (`SUPPORTED_PROTOCOLS`: 2024-11-05, 2025-03-26, 2025-06-18, 2025-11-25 — 1.23), else answers
  with the latest; default `2024-11-05`. One message is at most `MAX_MESSAGE` characters (1.23 — default 32 MiB,
  `DEV_SPEC_MCP_MAX_MESSAGE`, ≥ 1024): a line growing past it (a client that never sends `\n`) used to grow until the process
  died; now it is refused ONCE with -32600 (id null — it can't be parsed for its id; `args.tooLarge`, localized), its bytes are
  skipped up to the next `\n` (sent whole or in chunks) and the server keeps answering.
  A message without an `id` member is a notification: never a reply (and never runs a tool) — two change state (1.23):
  `notifications/cancelled` (see Human approvals → Cancellation) and `notifications/roots/list_changed`. An `id` must be a string or
  an integer — null, an object, an array, a boolean or a fraction gets -32600 (id null); an id without a string `method`
  gets -32600, except a client's JSON-RPC response (`result` / `error`, no method), which is ignored whatever its id (checked
  before the id rule — a client's error reply carries id null). A JSON-RPC batch gets ONE array
  reply; `null`/malformed input gets -32600/-32700; an unknown method -32601; an unknown tool (or `tools/call` without a
  name) -32602, localized (`args.unknownTool` / `args.noTool`); prompts/resources use -32602 / -32002 (see Capabilities).
- **Server-initiated requests (1.21 F1b).** The server is synchronous except for TWO paths: an approval waiting for the user,
  and (1.23) the first request that needs the project while the client's roots are asked. `clientRequest()` writes
  `{id: "dev-spec-<n>", method: "elicitation/create" | "roots/list", params}` straight to stdout (never into a batch reply),
  keeps its handler in `serverRequests` and a timer, and returns `{rid, promise, cancel}`; a client RESPONSE (result / error, no
  method) whose string id is there settles it — any other response is still ignored; a timeout or `cancel()` settles it too and
  sends the client `notifications/cancelled` for `dev-spec-<n>`. The handler returns a Promise then; the event loop stays
  free, so every other request (a ping, another tool) is answered meanwhile, and the late reply goes where its request came from
  (`sendTo(sink, …)`): straight out, or into its batch — `onLine` sends a batch's ONE array only once every request of it that
  waits has answered. On stdin close the server still exits after its flush (a pending question dies with the session).
- **The default project from roots (1.23).** With neither SPEC_PROJECT_DIR nor CLAUDE_PROJECT_DIR naming a folder (`envDirSet`:
  set, and not an unexpanded `${VAR}` / `$VAR` / `%VAR%`) — Claude Desktop, a global Cursor / Windsurf / Gemini config — the
  default project was the server's cwd: an app or home folder, where spec_init scaffolded `.specs/`. A client that declares
  `capabilities.roots` is asked `roots/list` ONCE, on the first request of `NEEDS_PROJECT` (tools/call, prompts/*, resources/*,
  completion/complete) — `rootsPending()` returns the wait and `deferUntil()` runs the request again once it settled, its reply
  going to its sink (a tools/call waits as an `inflight` entry: cancelled meanwhile, it never runs). Its first LOCAL `file://`
  root (`fileUriToPath`: no host but localhost, no `..`, no network path, on Windows a drive — `file:///C:/x`, VS Code's
  `file:///c%3A/x`) is `rootsDir`: a tool call without its own projectDir (absent, blank or holding an unexpanded variable —
  1.24 r6 A2: `spec.unexpandedVar`, any `${` / a leading `$NAME` / `%NAME%`, no longer a whole `${VAR}` only) gets it as
  `projectDir`, a RELATIVE projectDir resolves from it (1.24 r6 A2 — Argument validation → projectDir), and resources / prompts /
  completions / argument messages read it (`defaultProjectDir()`). No usable root, an
  error or no answer within `ROOTS_TIMEOUT_MS` (5 s; `DEV_SPEC_ROOTS_TIMEOUT_MS`, ≤ 60 s) → `null`, the old default (cwd), not
  asked again until `notifications/roots/list_changed` — but (1.25.1, review 7) a timeout no longer cancels the request: an answer
  that comes later still sets `rootsDir` (`clientRequest`'s `late` handler; it was dropped, and the cwd stayed the default for the
  session), unless another ask started since (`rootsGen` — initialize, list_changed). The engine's `resolveProjectDir` is
  untouched — the server passes the root as projectDir.
- **The feature-lock wait (1.24 r6 A6).** The engine is synchronous: a call waiting for a feature lock another LIVE process holds
  (a CLI `done`, another editor's server — conventions.md → the locks) froze the WHOLE server — pings, every other tool, a
  pending approval's reply — for `DEV_SPEC_LOCK_WAIT_MS` (10 s by default). At start the server sets that variable to
  `MCP_LOCK_WAIT_MS` (2 s) in its own environment when the user didn't set it: the engine reads it at every acquisition
  (`lockWaitMs`), the server starts no child process, and an explicit `DEV_SPEC_LOCK_WAIT_MS` (a slow network file system) still
  wins. Past it the call gets the usual localized busy refusal (`busy: true` — retry in a moment) — a lock is held for
  milliseconds, so 2 s only fails on a real collision, where the client retrying beats a frozen server. Nothing else changes:
  the CLI and the hooks keep 10 s (a terminal waiting freezes nothing else).

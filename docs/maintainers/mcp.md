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
  checklist, integration-plan, retro, spike, decisions — `RESOURCE_ARTIFACTS`: add a new artifact there);
  `resources/templates/list` gives the two templates. The list is capped (`RESOURCE_CAP` = 500,
  `_meta {truncated, total, cap, note}`). `resources/read` parses the URI segment by segment (percent-decoded; `..`, separators, `:` and control characters refused — never a URL
  parser, which would resolve `feature/../x`), resolves features through `resolveFeature`/`existingFeature`, reads
  allowlisted names only and never follows a symlink/junction out of `.specs/` (lstat + realpath).
- **Error codes**: an unknown prompt or bad prompt arguments, and an invalid / refused URI → `-32602` (Invalid params);
  a well-formed URI naming nothing → `-32002` (Resource not found); a `resources/read` error carries `data.uri`
  (JSON-RPC `error()` takes an optional `data`). Prompts and resources use the default project (SPEC_PROJECT_DIR /
  CLAUDE_PROJECT_DIR / cwd) — neither request carries a projectDir — and speak its language.

**Human approvals over MCP elicitation (1.21 F1b).** A client that declares `capabilities.elicitation` in `initialize`
(`clientElicits`) gets, while `roadmap.json → meta.approvalGuard` is `ask` or `deny`, an `elicitation/create` request before
an AGENT's approval runs — the calls the approval hook guards, read by the same pure `spec.approvalGuardDecision()` (a synthetic
PreToolUse payload): `spec_approve` (approve, revoke, `through`, force / waiver), `spec_feature {action: "remove", confirm: true}`,
`spec_init` lowering a protection. `approvalPolicy()` (server.js) decides: guard off, `SPEC_MCP_APPROVAL_HOOK=on` (mcp/servers.json
sets it for the Claude Code plugin — its PreToolUse hook asks / refuses there, so that path is unchanged and nothing is asked
twice), a network / `..` projectDir (runTool refuses it) → the call runs as before; elicitation → ask; no elicitation → `ask`
runs as today, `deny` is refused (`{ok: false, refused, humanRequired: true, approvalGuard: "deny", command, error}` — the
server asks `approvalGuardDecision(…, {plain: true})` (1.21 review A4): `command` is the plain runnable line, WITHOUT Claude Code's
`! ` prefix (a PowerShell / cmd.exe user can't run `! node …`), and `error` is `approvalGuard.denyMcp` — "in their own terminal",
never the `!` prefix; the Claude Code hook keeps its `!` form). The question (`msg.elicit`, the feature's language — else the
project's): `summary` (approvalGuardDecision's action line) + the gate from a **dry run** — `spec.approvePhase(…, {dryRun: true})`
runs every check and writes nothing (approve → `{dryRun, failing, checks, role?, waiver?}`, revoke → `{dryRun, revoke}`, through
→ `{dryRun, chain}`); a gate that refuses anyway (or an error, or a fast-forward with nothing to do) is answered as it is and
NOBODY is asked. `requestedSchema`: `approve` (boolean, default false, required) + `note` (string ≤ 500). Only `action:
"accept"` with `content.approve === true` runs the call, with `confirmation` {via: "elicitation", at, note?} (a one-line note)
recorded as `confirmed` on the approval, its history record, a role's sign-off and a revocation record (`confirmationOf()`,
gates.js — never a tool argument); the result gains `confirmed` (+ a localized `message`) only when it isn't `ok: false` (1.21
review A6 — a fast-forward a later gate stopped: the phases it approved carry their own `confirmed` in .state.json). Decline /
cancel / an accept without approve / a client error / no answer within `DEV_SPEC_ELICIT_TIMEOUT_MS` (default 300000, ≤ 1 h) →
`{ok: false, declined: true, approvalGuard, action | elicitationError | timedOut, error}` (localized — an accept without approve
has its own text, `elicit.unapproved`: the user answered without ticking Approve, `action: "accept"`), nothing recorded; a timeout also sends the client
`notifications/cancelled {requestId, reason: "timeout"}`. A guardrail on the approve paths, like the hook — not a sandbox.

**Argument validation (server.js).** Before dispatch, `tools/call` arguments are checked against the
tool's advertised `inputSchema`: required keys (`missingArgs`), then types (`invalidArgs` — `integer` means
a *safe* integer, so `1.9` / `1e21` never become task 1), `enum`, `minimum`, array `items` and nested
object properties. It iterates the SCHEMA's keys, never the caller's (`__proto__` arguments are ignored);
an absent or `null` value means "not given". `arguments` that isn't an object, a relative `..` in
`projectDir`, or a network `projectDir` (`isNetworkPath`: UNC `\\host\share`, `//host/share`, `\\?\UNC\…`,
`\\.\UNC\…` and other device paths — refused before ANY fs call, argument errors included, so a tool call can't make
the server open an SMB connection to a host it names or hang on an unreachable one; `\\?\C:\…` and WSL's `\\wsl$` /
`\\wsl.localhost` are local) is refused. The default projectDir (cwd / env) and the CLI are not restricted.
Messages are localized in the project language (`msg(lang).args`). The engine
still validates what schemas can't express (track names, AC IDs, paths). String enums the engine case-folds
(`phase`, `lang`, `kind`, `action`) are trimmed + lowercased first (`foldEnumArgs`) — the CLI passes `Design` / `PT`
straight to the engine and the 1.12 MCP accepted them; `spec_import`'s `tool` stays exact on both surfaces
(`EXACT_ENUMS`). The engine and the CLI fold `backlog`'s action too (`ADD` adds on every surface).
A schema `type` is always ONE string, never a list (`["string", "boolean"]` — not every MCP client handles list-valued
types): `spec_init`'s `guard` is a plain string enum `on | off | scope`, and `foldEnumArgs` turns a boolean into
`"on"` / `"off"` for any string enum holding both (the pre-1.14 `guard: true` keeps working).

## Protocol (from Conventions & gotchas)
- **Protocol**: stdio transport is newline-delimited JSON; messages must not contain embedded
  newlines (tool descriptions are single-line strings). Framing splits on `\n` ONLY (a `StringDecoder` keeps multibyte
  characters whole across chunks; one trailing `\r` is dropped) — never `readline`, which also splits on U+2028 / U+2029,
  both legal raw inside a JSON string (text pasted from Word / PDF): a valid request was cut in two and never answered.
  Replies escape U+2028 / U+2029 (`frame()`) so readline-based clients survive them. `initialize` echoes the client's
  `protocolVersion` when supported (`SUPPORTED_PROTOCOLS`), else answers with the latest; default `2024-11-05`.
  A message without an `id` member is a notification: never a reply (and never runs a tool). An `id` must be a string or
  an integer — null, an object, an array, a boolean or a fraction gets -32600 (id null); an id without a string `method`
  gets -32600, except a client's JSON-RPC response (`result` / `error`, no method), which is ignored whatever its id (checked
  before the id rule — a client's error reply carries id null). A JSON-RPC batch gets ONE array
  reply; `null`/malformed input gets -32600/-32700; an unknown method -32601; an unknown tool (or `tools/call` without a
  name) -32602, localized (`args.unknownTool` / `args.noTool`); prompts/resources use -32602 / -32002 (see Capabilities).
- **Server-initiated requests (1.21 F1b).** The server is synchronous except for ONE path: an approval waiting for the user.
  `clientRequest()` writes `{id: "dev-spec-<n>", method: "elicitation/create", params}` straight to stdout (never into a batch
  reply), keeps its resolver in `serverRequests` and a timer; a client RESPONSE (result / error, no method) whose string id is
  there resolves it — any other response is still ignored. The tools/call handler returns a Promise then; the event loop stays
  free, so every other request (a ping, another tool) is answered meanwhile, and the late reply goes where its request came from
  (`sendTo(sink, …)`): straight out, or into its batch — `onLine` sends a batch's ONE array only once every request of it that
  waits has answered. On stdin close the server still exits after its flush (a pending question dies with the session).

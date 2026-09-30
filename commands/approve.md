---
description: Record human approval of a phase gate for a feature (auditable, resumable). PT - aprova um gate de fase. ES - aprueba un gate de fase.
argument-hint: "[feature name] [phase] [--role name] [--force [--reason text] [--expires date|30d]] [--revoke [--reason text]]"
---

Use the **dev-spec-driven** skill approval gate.

Args: $ARGUMENTS

Only record an approval the user actually gave. Run `spec_doctor` first and show the verdict. Then call the
`spec_approve` MCP tool with the feature name and phase (one of: classification, requirements, design,
test-plan, eval-plan, tests, tasks, execution; CLI `dev-spec approve <feature> <phase> [--by NAME]`).
With the human approval guard on (`spec_init {approvalGuard: "ask" | "deny"}`), the plugin's hook asks the user
before that call, or refuses it: then give the user the command the refusal names to run themselves (their own
terminal, or `! node <clone>/cli/dev-spec.js approve …`) and wait — never retry it another way. In other MCP clients
the server asks the user itself when the client supports elicitation (a question with an Approve box and a note —
only their explicit approve is recorded, as `confirmed`); a `declined: true` result means the user said no (or didn't
answer): record nothing, ask what should change. A `humanRequired: true` refusal (deny, a client that can't ask) works
like the hook's: the user runs the `command` it names.

**The approval is a gate:** that phase's checks run first and any failure **refuses** it, listing the failing
check ids — e.g. requirements: `ears`, `placeholders`, `clarifications`, `success-criteria`, `priorities`,
`ac-uniqueness` (bugfix: `reproduction`); design: `placeholders`, `constitution-check`, the active
`saas-sections` / `ai-sections` / `sec-sections` / `privacy-sections` / `dist-sections`, `clarifications` (bugfix: `root-cause` — its design approval signs off
`bug.md`); test-plan: `placeholders`, `traceability` (every AC has a test row, and no row cites an AC
requirements.md doesn't define); eval-plan: `placeholders`; tasks: `placeholders` (no placeholder tasks),
`traceability` (every AC covered by a task, no phantom AC / T-IDs in tasks); tests (the Phase 4 sign-off —
failing tests / eval harness written and red): +tdd `tests-in-code` (every planned T-ID named by a test file),
+ai `eval-sets` (`evals/golden.json` is the feature's own set, not the scaffold's sample) — nothing to approve on a
core-only feature; execution (the sign-off after a ready `/spec-finish`): spec_finish's blockers — `doctor`,
`root-cause`, `placeholders`, `changed-since-approval`, `tasks`, `open-tasks`, `verification`, `suite-evidence`
(project checks without a passing run since the last tick, on the current code), `approval-gates`.
`tests` is pending on a +tdd / +ai feature once its test or eval plan exists (never on a bugfix), so
`gatesOk` stays false and `spec_next_action` asks for it until it is approved. **Phase by phase:** a phase is
refused while an EARLIER active phase that has an artifact is still unapproved — check `phase-order`, naming the
phase(s) to approve first (a bugfix's tasks can't be approved before its design / `bug.md`; on a design-first feature
the design comes before the requirements). On a refusal, show the failing checks and fix them (or ask the user to) —
don't retry blindly. "Fix it" or "go ahead" said about the outcome is not an approval of an artifact the user hasn't
seen: present it first (in a bugfix, the reproduction and the root cause in `bug.md`).

`force: true` (CLI `--force`) records it anyway as a **forced** approval with the failing check ids: use it only
when the user explicitly chooses to accept the failures, and say so. Forced approvals stay visible —
`spec_doctor`'s `approval-gates` check warns, the roadmap lists them, and `spec_metrics` counts them. A phase with
no artifact (eval-plan without +ai, test-plan without +tdd, a missing file) can't be approved, not even forced.
With `force`, record the user's reason and, when they give one, an expiry: `reason` + `expires` (`YYYY-MM-DD`, today or
later, or a number of days like `30d`) — CLI `--force --reason "…" --expires 30d` — are stored as the approval's
**waiver** (`waiver {reason, expires}`, on the approval and its history record; only when the gate really fails —
a passing gate waives nothing). Once the expiry passes while the approval still stands forced, `spec_doctor` warns
`waiver-expired`; ROADMAP.md shows each forced approval with its waiver (an expired one flagged EXPIRED) and
`/spec-finish` lists them in the merge summary. `reason` / `expires` without `force` are refused.

**Revoke** an approval the user withdraws (given by mistake, or no longer true): `spec_approve {name, phase, revoke:
true, reason}` (CLI `dev-spec approve <feature> <phase> --revoke --reason "…"`). It removes that phase's approval —
and the role sign-offs waiting for it — and appends `{phase, at, by, revoked: true, reason}` to `approvalHistory` (no
snapshot). It **never cascades**: later phases stay approved (`laterApproved`); the revoked phase is pending again, so
doctor, next_action and finish ask for it, and approving another phase is refused (`phase-order`) until it is
approved again. Revoking a phase that is not approved is an error; `execution` can be revoked too (its sign-off is
then asked for again). Revoke only when the user asks — the approval guard gates it like an approval.

**Approvals by role** (opt-in: `.specs/roadmap.json → meta.approvalRoles`, set with `spec_init {approvalRoles}` / CLI
`dev-spec init --roles requirements=product,design=tech+security`): a phase listed there needs `role` (CLI
`--role <role>`, one of that phase's roles) and counts as approved only once **every** role has signed off its
**current** content — until then the result says `pending` with the `missingRoles`, and doctor, next_action and finish
keep naming them (ROADMAP.md too, once one role has signed). An edit after a role signed means that role signs again. A phase approved before the
roles were configured stays approved (by an unknown role); doctor warns until each role re-signs. To approve several
filled phases in one go, see `/spec-ff`.

Each approval writes `.specs/<feature>/.state.json` (latest approval + content fingerprint), appends to
`approvalHistory` and saves a snapshot `.specs/<feature>/.history/<phase>@<n>.md` — the baseline `/spec-impact`
diffs a later edit against. Confirm what was recorded. Respond in the user's language (EN/PT/ES).

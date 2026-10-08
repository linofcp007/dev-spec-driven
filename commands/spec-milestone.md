---
description: Milestones — a target date for a set of features, judged against their forecast ETAs and shown in ROADMAP.md.
argument-hint: "[add <name> <YYYY-MM-DD> <features…> | rm <name> | list]"
---

Use the **dev-spec-driven** skill, milestones.

Args: $ARGUMENTS

Interpret the request ("the beta ships on 31 October with checkout and invoices", "drop the Q4 milestone", "are we on
track?") and call the `spec_milestone` MCP tool `{action, name?, date?, features?}` (CLI `dev-spec milestone add
"<name>" <YYYY-MM-DD> <features…>` · `dev-spec milestone rm "<name>"` · `dev-spec milestone`):

- **`add`** — a name (letters, digits, spaces and `. _ : # ( ) + -`, up to 60 characters), a real `YYYY-MM-DD` day and
  one or more existing active features (their names or slugs). Adding a name that exists updates its date and features.
  A feature that doesn't exist is refused with the list — suggest `/createSpec` or `/backlog` for planned work.
- **`rm`** (alias `remove`) — by name.
- **`list`** (default) — every milestone with its status.

Stored in `.specs/roadmap.json` (`meta.milestones`); nothing is sent anywhere. Each milestone is judged against the
roadmap forecasts — the velocity of ticked tasks (`_Size:_` points) gives each feature an ETA — with a stable status:
`done` (every feature complete), `late` (the date has passed and a feature is not done), `at-risk` — `eta-after-date`
(the latest ETA of its open features is after the date), `eta-unknown` (an open feature has no ETA yet: fewer than 3
tasks completed in the last 28 days, no tasks, a dependency) or `no-features` — and `on-track` otherwise.

Report each milestone's date, done / total features, the latest ETA and its status; for an at-risk or late one say
why and suggest a response (re-scope: drop a feature from it with `add` again; move the date; unblock the feature with no
ETA — size and tick its tasks, or finish its planning). Present an ETA as an estimate, never a promise. `ROADMAP.md`
shows a Milestones table and lists the late / at-risk ones under "Needs attention". A feature's rename, removal or
archive (→ `archived`; restore brings it back) follows automatically. For a milestone's release notes use
`/spec-changelog --milestone <name>`. Respond in the user's language (EN/PT/ES).

---
description: Release notes generated from the specs — Added, Changed (superseded ACs, change requests) and Fixed (root causes).
argument-hint: "[--since <ISO date|last|all>] [--milestone <name>] [--write]"
---

Use the **dev-spec-driven** skill, release notes.

Args: $ARGUMENTS

Call the `spec_changelog` MCP tool `{since?, milestone?, write?}` (CLI `dev-spec changelog [--since <ISO date|last|all>] [--milestone <name>] [--write]`).
It builds human release notes from the spec data alone — no model, no git log:

- **Added** — features that shipped since `since` (`spec_finish {write: true}` recorded their baseline, or their
  `execution` sign-off was approved), each with its summary and every user-story acceptance criterion as one line
  (template criteria left out). A feature that already shipped before `since` is never listed as new again.
- **Changed** — acceptance criteria superseded (`_Supersedes:_`) by a feature shipped since then, each with the
  criterion that replaces it; and the change requests (`spec_impact` reopen) recorded since then — the IDs or sections
  added, modified and removed, the tasks reopened and the current text of the criteria a requirements change touched.
- **Fixed** — bugfix features shipped since then, with the root-cause one-liner from `bug.md`.

`since`: an ISO date (`2026-09-01`, 00:00 UTC) or timestamp, `last` (the default — since the last release notes that
were written, `roadmap.json` `meta.changelogAt`; everything while none were written) or `all`. Headings are in the
project language; IDs stay English.

- Without `write` it returns the structure plus the markdown: show the notes, and point out a feature whose summary is
  still missing or a bugfix whose root cause isn't written (the notes say so).
- With `write: true` (`--write`) it writes **`.specs/RELEASE-NOTES.md`** (AUTO-GENERATED) and stamps
  `meta.changelogAt`, so the next run starts from there. With nothing to report nothing is written or stamped (`note`).
  A hand-written `RELEASE-NOTES.md` (no marker) is never overwritten — the result is an error; tell the user.

**For one milestone** (`milestone`, `--milestone <name>` — see `/spec-milestone`): only that milestone's features (and
the ones archived since it was set); `since` then defaults to `all`, and `write` goes to
`.specs/RELEASE-NOTES.<milestone>.md` without touching `meta.changelogAt`. An unknown name is an error listing them.

Use it when cutting a release, then merge locally as usual. Respond in the user's language (EN/PT/ES).

---
description: Stakeholder export — one self-contained, offline, printable document (HTML or markdown) of a feature or of the whole project, for product, legal and clients. PT - exportação para stakeholders. ES - exportación para stakeholders.
argument-hint: "[feature name | blank for the whole project] [--md | --csv] [--write]"
---

Use the **dev-spec-driven** skill, stakeholder export.

Target: $ARGUMENTS

People who don't read markdown folders (product, legal, clients) get ONE document. Call the `spec_export` MCP tool
`{name?, format?, write?}` (CLI `dev-spec export [feature] [--md | --csv] [--write]`):

- **With a feature name** — that feature, in the feature's language: summary; user stories with their EARS acceptance
  criteria and stable IDs (a criterion a later feature superseded is struck through, a template one flagged); the other
  requirements sections (success criteria, edge cases, NFRs, out of scope…); the design sections (a bugfix: bug.md —
  reproduction, root cause, fix); the test plan; every task with its done / verified status (the verdict `spec_doctor`
  gives, with the reason); the **traceability matrix** (one row per AC / EC / NFR / SC: status, design sections, tasks,
  tests, decisions — see below); `decisions.md` when the feature has one; the phase approvals (who, when, forced, changed
  since, still pending) and the open `[NEEDS CLARIFICATION]` markers.
- **Without a name** — the whole project, in the project language: the roadmap summary (+ backlog), every active
  feature's requirements digest (summary, stories + ACs, success criteria — each feature on its own printed page), each
  feature's requirement count by traceability status, and the living catalog when `.specs/SPECS.md` exists.

`format` is `html` (default), `md` (`--md`) or `csv` (`--csv`). The HTML uses the roadmap's brand palette, follows the system light/dark
theme with a toggle, and prints cleanly (light on paper, no buttons, a page break per feature). Every piece of spec text
is escaped; links are kept only for http(s)/mailto, images are shown as their alt text, and nothing external is loaded —
the file opens offline and can be attached to an email or printed to PDF.

- Without `write` the document comes back as `content`: tell the user what it covers (and offer to write it).
- With `write: true` (`--write`) it is written to **`.specs/exports/<feature>.html`** (or `.md`; the project:
  `project.html`; a feature slugged `project`: `project.feature.html`) carrying the AUTO-GENERATED marker — report the
  path. A same-named file dev-spec did not generate is never overwritten: the result is an error; tell the user.

**`csv` — the requirements traceability matrix (RTM)** for audited teams (IEC 62304, SOC 2, DO-178C): one row per
requirement ID with its status — `verified` (every linked task done and verified), `implemented` (done, not all verified),
`planned` (traced, work open), `untraced` (a trace gap, named in the Gaps column) — plus its design sections, tasks,
planned tests, latest evidence (command, exit code, time, commit), decisions, supersession and the requirements approval
(and whether that row changed since). The project export (no name) lists every active feature's rows. It is RFC 4180
(CRLF records; a cell starting with `=` `+` `-` `@` is prefixed with an apostrophe so no formula runs), UTF-8 with a
BOM so Excel reads accents, and its **last** record carries the AUTO-GENERATED marker; `write` puts it in
`.specs/exports/<feature>.rtm.csv` (`project.rtm.csv`), never over a hand-written file. The same matrix is
`trace_check {matrix: true}` (CLI `dev-spec trace <feature> --matrix`, or `--csv` for the bare data on stdout).

The export is a snapshot of the living spec — regenerate it after the spec changes instead of editing the file.
Respond in the user's language (EN/PT/ES).

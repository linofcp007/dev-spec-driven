---
description: Stakeholder export — one self-contained, offline, printable HTML or markdown document of a feature or the project.
argument-hint: "[feature name | blank for the whole project] [--md | --csv | --gherkin | --adr | --tracker jira|linear] [--write]"
---

Use the **dev-spec-driven** skill, stakeholder export.

Target: $ARGUMENTS

People who don't read markdown folders (product, legal, clients) get ONE document. Call the `spec_export` MCP tool
`{name?, format?, write?}` (CLI `dev-spec export [feature] [--md | --csv | --gherkin | --adr | --tracker jira|linear] [--write]`):

- **With a feature name** — that feature, in the feature's language: summary; user stories with their EARS acceptance
  criteria and stable IDs (a criterion a later SHIPPED feature superseded is struck through; one a draft plans to supersede reads "to be superseded"; a template one flagged); the other
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

**`gherkin` — BDD `.feature` files** (`--gherkin`): one `Feature` per feature (title, summary, its tracks as tags such as
`@SaaS` `@tdd`) and one `Scenario` per current acceptance criterion, tagged `@US-1.AC-1`, the planned T-IDs (`@T-01`) and
its track marker. The steps ARE the EARS clauses — `WHILE` / `WHERE` / `IF` → `Given`, `WHEN` → `When`, the `SHALL`
response → `Then`, word for word; a criterion that can't be split cleanly is one `Then` with its whole text (`unsplit`
lists them — suggest rewriting those in EARS form). Template criteria and ones a shipped feature superseded are left out
with a comment. PT / ES features use Gherkin's own dialect (`# language: pt` / `es`). `write` →
`.specs/exports/<feature>.feature`; without a name, one file per active feature (spikes skipped). Never invent steps or
glue code — the file is the spec's criteria in Gherkin form; step definitions are the team's.

**`jira` / `linear` — a tracker import CSV** (`--tracker jira` or `--tracker linear`): the feature as the parent work
item, its user stories as children (their criteria in the description) and its tasks under their `[USn]` story (or the
feature), with status (done / in progress / to do) and labels (feature slug, tracks, AC IDs). The column names are the
importers' own (Jira: Work item ID, Work type, Summary, Description, Status, Parent, Labels; Linear: ID, Title,
Description, Status, Estimate, Labels, Parent issue). Nothing is sent anywhere — the user imports the file with the
tool's CSV importer (leave the last, AUTO-GENERATED column unmapped). `write` → `.specs/exports/<feature>.<tracker>.csv`
(the project: `project.<tracker>.csv`).

**`adr` — Architecture Decision Records** (`--adr`) for teams that keep ADRs: the feature's decision log
(`decisions.md`, `/spec-decide`) as one [MADR](https://adr.github.io/madr/) file per decision —
`.specs/exports/adr/<feature>/NNNN-<title>.md` plus an `index.md` table. The ADR number IS the decision's D-number
(`D-3` → `0003`), so a decision recorded later never renumbers the others. Each file has MADR's front matter (`status:
accepted` or `superseded by ADR-NNNN`, `date`), then the title, Context and Problem Statement, Decision Outcome with its
Consequences and More Information (the feature, its log entry, what the decision affects — linked) — only the sections
the log has text for: never invent Considered Options or pros and cons. Headings follow the feature's language.
Discoveries (`_Kind: discovery_`) are not decisions: they are left out (`excluded`) and named in the index. Without a
name: every feature's folder (archived ones under `adr/_archive/`) and `adr/index.md`. Without `write` the files come
back as `documents` (and `stale` names the generated ADRs no decision backs any more); `write` writes what changed
(`written` / `unchanged` — a re-run writes nothing) and removes those stale generated files (`removed`) — never a
hand-written file, which instead refuses the whole export. Point the team's ADR tooling at the folder, or copy it; to
change an ADR, record a new decision that supersedes the old one and export again.

The export is a snapshot of the living spec — regenerate it after the spec changes instead of editing the file.
Respond in the user's language (EN/PT/ES).

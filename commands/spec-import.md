---
description: Import a Kiro, spec-kit or OpenSpec spec, a plan (Claude Code, Cursor, Codex, fluidplan) or BMAD docs as a feature; Kiro / Cursor rules as steering.
argument-hint: "[kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan|kiro-steering|cursor-rules] [path or plan text] [--name n] [--dry-run]"
---

Use the **dev-spec-driven** skill, import from other tools (`references/brownfield.md` → Import).

Args: $ARGUMENTS

Call the `spec_import` MCP tool `{tool, path, name?, tracks?, lang?, dryRun?}` (CLI
`dev-spec import <kiro|spec-kit|openspec|plan|execplan|bmad|fluidplan> <path> [--name n] [--tracks tdd,saas] [--lang pt] [--dry-run]`) — or, for
a plan / ExecPlan / fluidplan PLAN.md, `{tool, text, …}` with the document's markdown instead of `path` (CLI `dev-spec import plan - < plan.md`
reads stdin, `--text "…"` takes it inline):

- `tool` — `kiro` (`.kiro/specs/<name>/`; a Portuguese / Spanish one too — `### Requisito N`, `## Introdução` /
  `## Introducción`), `spec-kit` (`specs/<nnn-name>/` — `plan.md` and its `research.md`, `data-model.md`, `contracts/`,
  `quickstart.md` become `design.md`; a task's `[USn]` tag its `_Requirements:_`, the paths it names its `_Implements:_`), `openspec`
  (`openspec/specs/<capability>/`, or a change folder `openspec/changes/<id>/`), `plan` (a Markdown plan: Claude Code
  plan mode or a Cursor plan `.cursor/plans/*.plan.md`), `execplan` (a Codex ExecPlan written per `PLANS.md`) or
  `bmad` (BMAD-METHOD docs: `docs/prd.md` or a sharded `docs/prd/`, `docs/stories/*.md`, `docs/architecture.md`;
  v6 `_bmad-output/planning-artifacts/`; or one story file) or `fluidplan` (a plan settled with the fluidplan skill: its
  folder `.fluidplan/<id>/`, its `plan.json`, or its `PLAN.md` / `DECISIONS.md`);
- `path` — the spec folder (or a file in it), **inside the project**; the source is only read, never modified. For a
  plan / ExecPlan pass the file itself when its folder holds several. Claude Code plan mode saves plans under
  `plansDirectory` — by default `~/.claude/plans`, **outside the project**: pass the plan's markdown as `text` instead
  (the plan you just approved is in the conversation; the plugin's ExitPlanMode hook reminds you), copy the plan into the
  project, or point `plansDirectory` at a folder inside it;
- `text` — `plan` / `execplan` / `fluidplan` only, never with `path`: the document itself (fluidplan: its `PLAN.md`, `DECISIONS.md` may follow it). Same mapping, same guarantees; the note
  reads "Imported from plan (inline text)", the result has `inline: true` and `source: null`;
- `name` — defaults to the source folder name (spec-kit's number prefix dropped); a plan / ExecPlan takes its title,
  BMAD the PRD's title (one story file: the story's title), fluidplan the plan's title; a title with no letter a-z or
  digit (`# Добавить тёмную тему`) falls back to the file's (or folder's) name, and inline `text` with no usable title is
  refused (nothing written) — pass `name`; an existing feature with that slug is an error (import never writes over a feature);
- `tracks` — omit to auto-classify from the imported requirements; `lang` — the generated headings/notes
  (the imported text is kept as written).

It creates a NEW feature: requirement/story N, criterion/scenario M → `US-N.AC-M`; each scenario becomes one
EARS criterion where possible (else its text is kept with `[NEEDS CLARIFICATION]`); Kiro `_Requirements: 1.1_`
references are rewritten; tasks are renumbered 1…K keeping their checkbox state and `[P]`/`[USn]` tags;
`SC-`/`FR-` IDs stay; every artifact carries an "Imported from <tool> <path> on <date>" note. Per source:

- **plan** — goals and acceptance-like bullets (Goals, Acceptance / Success Criteria, Verification…) → US-1's criteria;
  checklists (Cursor: the front matter `todos`; else a Steps / Implementation section's items or sub-headings — an
  Approach / Abordagem / Enfoque section counts only when the plan has no other steps section) → tasks keeping their state (a cancelled to-do is imported open and warned); the file paths a step names →
  `_Implements:_`; everything else (context, approach, files, verification commands) → `design.md`.
- **execplan** — Validation and Acceptance → criteria; Progress (state kept) + Concrete Steps → tasks, with
  `_Verify:_` when a step names a test / lint / build / curl command; Decision Log → `design.md` "## Decisions"
  (D-1…); Purpose → the summary; the living sections (Surprises & Discoveries, Outcomes, Context, Plan of Work…) →
  `design.md` verbatim.
- **bmad** — stories (a story file wins over the PRD's copy) → US-1…US-n in story order, their ACs → `US-n.AC-m`;
  `FR1` / `NFR1` → `FR-1` / `NFR-1`; Tasks / Subtasks → tasks tagged `[USn]` (a subtask is a task of its own) with
  `(AC: 1, 3)` → `_Requirements:_`; architecture.md + Technical Assumptions + each story's Dev Notes → `design.md`;
  BMAD's Status / Change Log records are named in a warning, not imported.
- **fluidplan** — the finalized `PLAN.md` / `DECISIONS.md` win, `plan.json` + `answers.json` fill in the rest (or stand
  alone). Pages (themes) → user stories; each task's acceptance → criteria; tasks → `tasks.md` under their phase headings
  (ticks kept) with `files` → `_Implements:_`, `verify` → one `_Verify:_` per command, `after` → `_Depends:_`; accepted and
  rejected decisions → `decisions.md` (D-1…) + `design.md` Decisions / Alternatives & Trade-offs; working rules → Global
  Constraints; decisions still open → requirements.md "Open decisions" with `[NEEDS CLARIFICATION]` — tell the user to
  settle them (in fluidplan, or with `spec_clarify`) before approving.

**Steering** — `kiro-steering` (`.kiro/steering/*.md`) and `cursor-rules` (`.cursor/rules/*.mdc`, the legacy `.cursorrules`)
bring another tool's standing rules in as `.specs/steering/<name>.md` files — no feature; `path` is optional (the tool's own
places by default); `name` / `tracks` / `text` are refused. Kiro's front matter is kept (it is dev-spec's; a file without one
gets Kiro's default, `inclusion: always`); a Cursor rule with `alwaysApply: true` → `inclusion: always`, with `globs` →
`inclusion: fileMatch` + `fileMatchPattern` (a glob naming no folder, `*.tsx`, matches at any depth: `**/*.tsx`), else
`inclusion: manual` (its `description` kept); `.cursorrules` → `cursorrules.md`, always. An existing steering file is never
overwritten: it is listed in `skipped` (`template: true` when it is still spec_init's stub — ask the user, then delete it and
import again). Task briefs then carry each file by its mode. Show the user `imported` (file, mode, patterns) and `skipped`.

**Dry run** — `dryRun: true` (CLI `--dry-run`) runs the whole import and writes nothing (no file, folder, lock or roadmap
refresh): the same result plus `dryRun: true` and `preview` (each file it would write — its size and its first characters).
Use it to show the user what an import would create (the feature, its tracks, `counts`, `mapping`, `warnings`) before running
it for real; a refusal is the real import's.

Show the user: the files written, the **ID mapping** (`mapping`: old → new) and every **warning** (criteria
not in EARS form, stories without criteria, carried or skipped sections, unresolved task references). Then treat
it like any new feature: **Phase 0** — confirm the track set with the user (`spec_add_track` to change it) —
then `spec_clarify` / `ears_validate` on the imported requirements and the normal gates (`spec_doctor`, then
`spec_approve` per phase on the user's yes). A plan that starts from an architecture fits the design-first flow
(`spec_feature {action: "flow", name, flow: "design-first"}`). Imported checkboxes are not evidence: re-verify
ticked tasks before trusting them. Respond in the user's language (EN/PT/ES).

---
description: Show the roadmap and regenerate .specs/ROADMAP.md (optional .html) — progress, dependencies, ETAs, overlaps.
argument-hint: "[--write] [--html] [--lang pt]"
---

Use the **dev-spec-driven** skill roadmap view.

Args: $ARGUMENTS

Run the `spec_roadmap` MCP tool. With `write: true` (CLI `dev-spec roadmap --write`) it (re)generates
**`.specs/ROADMAP.md`** — the default overview (progress bar, feature table with an ETA column, Mermaid dependency
graph, needs-attention, backlog; git-friendly). Add `html: true` (`--html`) to also write a self-contained,
offline, brand-styled **`.specs/ROADMAP.html`** (light/dark toggle that defaults to the system theme).
**Pass `lang` (`--lang pt|es|en`) matching the user's language** — it localizes the roadmap chrome only
(stored as `meta.roadmapLang` for auto-refresh; the project language set by `spec_init` is unchanged). A
same-named file dev-spec did not generate is never overwritten — the result is then an error naming it.

Report: each feature's tracks, phase, %, dependencies and whether they're met, blocked features, overall %, and
any cycle; recommend the next unblocked feature. **Forecasts:** `velocity` (points per working day over the last 28
days, from when tasks were ticked; `_Size: XS|S|M|L|XL_` = 1/2/3/5/8 points, unsized = the feature's median) and each
feature's `forecast` — an ETA with a ±25% range, after its unfinished dependencies — or the `reason` there is none
(`not-enough-data` until 3 tasks were completed in the window, `no-tasks`, `dependency`, `cycle`, `done`); present an
ETA as an estimate, never a promise. **Overlaps:** pairs of active features whose open tasks plan the same files (or
files a finished feature recorded) collide at merge time — suggest ordering them (`/depend`) or re-planning.
**Milestones** (`/spec-milestone`): each one's date against the latest ETA of its open features, with its status —
`on-track`, `at-risk` (ETA after the date, an ETA still unknown, or no feature left), `late` (the date passed, not all
done) or `done`; ROADMAP.md shows a Milestones table.

Relay the **needs attention** items: blocked dependencies, open clarifications, unfilled track sections
(every active track's — `[SaaS]` / `[AI]` / `[SEC]` / `[PRIVACY]` / `[DIST]` / `[API]` / `[UI]` / `[OBS]` / `[DATA]` — and a track pack's), template placeholders in the current phase, artifacts changed since
their approval, **forced** approvals, missing role sign-offs, overlaps, a spike past its timebox, and ticked tasks
without a passing run (each task with its reason — latest run failed, note only, stale or shared-number evidence, an
unexpected pass, a run of another command than its `_Verify:_`), and late or at-risk milestones. The roadmap is auto-generated on every mutation and by a hook, so it's normally already up to date —
never hand-edit it. Respond in the user's language (EN/PT/ES).

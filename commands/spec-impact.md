---
description: Change request — show what an edit made after an approval touches (ACs, sections, tasks, tests), optionally reopen the affected tasks, then re-approve. PT - pedido de alteração (impacto de uma edição depois da aprovação). ES - solicitud de cambio (impacto de una edición tras la aprobación).
argument-hint: "[feature name] [requirements|design|tasks] [--reopen]"
---

Use the **dev-spec-driven** skill, change management (`references/change-management.md`).

Args: $ARGUMENTS

Use this when an **approved** artifact was edited afterwards — `spec_doctor` warns `changed-since-approval`,
`spec_next_action` answers `step: "re-review"`, or the user says "I changed the requirements".

1. Call the `spec_impact` MCP tool `{name, phase}` (phase `requirements` by default, or `design` / `tasks`;
   CLI `dev-spec impact <feature> [--phase design]`). It diffs the artifact against the snapshot its latest
   approval saved (`.specs/<feature>/.history/<phase>@<n>.md`):
   - **requirements** — ACs (and SC/EC/NFR IDs) added / modified / removed, and for each modified or removed ID
     the tasks citing it (done/open + evidence state), the T-IDs covering it and the design sections naming it;
   - **design** — sections added / modified / removed and the tasks citing an ID a changed section names (a
     bugfix diffs `bug.md` too — its design approval signed it off);
   - **tasks** — task numbers added / removed / changed.
   `baseline: "fingerprint-only"` means the approval predates the change history: only *that* it changed is
   known — re-review it by hand and re-approve (that starts the history).
2. Show the user the diff and `affectedTasks`, grouped by ID, with each task's evidence state. Ask whether the
   change is intended and which done tasks must be redone.
3. **Only with the user's OK**, run it again with `reopen: true` (CLI `--reopen`; requirements/design only): it
   unticks the affected done tasks, marks their evidence **stale** (unverified until a new passing run is
   recorded), records the change request in `.state.json → changes` and refreshes the roadmap. It never edits
   `requirements.md` or `design.md`; a second reopen with nothing new changes nothing.
4. Update whatever else the change reaches (design sections, test-plan rows, tasks — new work goes in with
   `spec_append_tasks`), run `spec_doctor`, then **re-approve** each changed phase with `spec_approve` — each
   approval saves a new snapshot. Redo the reopened tasks with fresh evidence (`/executeTask`).

Never reopen on your own initiative, and never treat an approved spec that changed as still approved.
Respond in the user's language (EN/PT/ES).

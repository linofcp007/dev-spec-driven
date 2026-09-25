---
description: Converge pass — check the whole feature AC by AC against the code, list what is missing, and append the follow-up tasks the user approves. PT - passagem de convergência (spec vs código, AC a AC). ES - pasada de convergencia (spec vs código, AC por AC).
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill, converge pass (`references/subagent-execution.md` → Converge mode).

Feature: $ARGUMENTS

Use it when implementation drifted from the plan, after a review found follow-up work, or before
`/spec-finish` on a feature whose tasks are all ticked but you doubt every AC is really delivered.

1. **Gather:** `spec_status` + `trace_check {name, code: true}` (T-IDs named in test files) for the feature.
2. **Review, AC by AC.** Dispatch the plugin agent **`dev-spec-driven:spec-reviewer`** in **converge** mode with:
   the feature folder `.specs/<feature>/`, the active tracks, the `trace_check` result and the source roots to
   inspect. For every AC ID it answers: implemented? (file:line) · tested? (test name / T-ID) → ✅ / ❌ / ⚠️,
   and returns the missing work as **proposed tasks** (text, AC IDs, files, a `_Verify:_` command, story, [P]).
   It is read-only. **No subagent tool** (Cursor, Windsurf, Copilot, Gemini, claude.ai)? Run the same checklist
   inline: read each AC, find its code and its test, record the verdict with evidence.
3. **Present** the per-AC table and the proposed tasks. A gap that needs a *different* AC, design decision or
   test expectation is not a task — send it back to `/createSpec`, `/design` or `/testPlan` (see `/spec-impact`).
4. **Human approves** which tasks to add (edit them together if needed). Then call `spec_append_tasks {name,
   tasks: [{text, requirements, implements, verify, story, parallel}]}` (CLI, one task per call:
   `dev-spec append-tasks <feature> --task "…" --req US-1.AC-2 --implements src/x.ts --verify "npm test -- x"`).
   Tasks go under a localized **Phase: Convergence** heading, numbered after the highest task; existing tasks are
   never renumbered or edited; an unknown AC ID refuses the whole call.
5. The result carries `needsReapproval`: run `trace_check`, then re-approve the **tasks** phase (`/approve`).
6. Execute the new tasks as usual (`/executeTask`), with evidence for each.

Never append tasks the user hasn't approved. Respond in the user's language (EN/PT/ES).

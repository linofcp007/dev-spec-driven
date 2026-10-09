---
description: A guided 10-minute tour on your own repo — one tiny real change through the whole workflow, one gate at a time.
disable-model-invocation: true
argument-hint: "[a small change you want to make (optional)]"
---

Use the **dev-spec-driven** skill as a **guided tour** — for someone new to the plugin, on their own repository.

Change to take through the tour (optional): $ARGUMENTS

Goal: in about 10 minutes, one tiny real change through every gate. At each step do the work, show the result and explain
the gate in **one sentence** as it happens — no lecture up front. Everything in the user's language (pass `lang` to the
tools). Before the first write, say the tour writes under `.specs/` only (plus the change itself) and that at the end
they keep, archive or remove it.

1. **Look** — `spec_scan` (read-only): the stack, modules, routes, test framework and entry points, in a few lines.
2. **Pick the change** — the one above, else two or three tiny candidates from the scan: one behaviour, one or two files,
   testable with the project's own test command.
3. **Classify and size** — `spec_classify`. *Gate: the tracks and the size decide which artifacts and checks apply.*
   Propose size **xs**, the fast path: a *change* — one `change.md`, core only, ONE plan approval. A larger
   `suggestedSize` or a track: suggest a smaller change, or follow it with the user's OK. Then `spec_init {tracks, lang}`
   if `.specs/` is missing, and `spec_create {name, size, summary, lang}` once — with the size the user confirmed.
4. **Plan** — fill `change.md`: 1–2 EARS criteria (`US-1.AC-1` "WHEN … THE SYSTEM SHALL …", then `ears_validate`), the
   approach in two lines, and exactly **2 tasks**, each with `_Requirements: US-1.AC-n_`, `_Implements: <path>_` and a
   **real** `_Verify: <command>_` the project can run. *Gate: a task names the criteria it proves and the command that
   proves it.*
5. **Approve** — `spec_doctor`, show the plan, and record it with `spec_approve {name, through: "tasks"}` **only after the
   user says yes**; never approve on their behalf, never force a refused gate — a refusal is part of the tour: show the
   failing check and fix it. *Gate: an approval records who signed which version; an edit after it shows as changed.*
6. **Execute one task** — implement task 1, run its `_Verify:_` and record the run: `spec_complete_task {name, number:
   1, evidence: {command, exitCode, summary}}` (or `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> 1 --run`).
   No shell? Ask the user to run it and paste the output — never a run nobody made. *Gate: a runnable `_Verify:_` counts
   only with its command and exit code 0.*
7. **Where am I?** — `spec_next_action` names task 2. *Gate: one next step — the way back into any feature.*
8. **Finish** — `spec_finish {name}` answers not ready while task 2 is open. *Gate: finish checks the whole chain and
   drafts the merge summary; it never merges or pushes.* Offer to do task 2 and finish for real (`/spec-finish`).

At the end, ask what to do with the tour's feature: **keep** it, **archive** it (`spec_feature {action: "archive", name}`
— reversible), or **remove** it (`spec_feature {action: "remove", name}` first lists what it would delete; pass
`confirm: true` only after the user confirms). Close with what to remember: `/spec` to start or resume a feature,
`/spec-finish` to close it, `/spec-doctor` when something looks off.

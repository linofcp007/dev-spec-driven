---
description: A guided 10-minute tour on your own repo — scan it, then take one tiny real change through the whole workflow, one gate at a time. PT - visita guiada de 10 minutos no teu repositório. ES - visita guiada de 10 minutos en tu repositorio.
argument-hint: "[a small change you want to make (optional)]"
---

Use the **dev-spec-driven** skill as a **guided tour** — for someone new to the plugin, on their own repository.

Change to take through the tour (optional): $ARGUMENTS

Goal: in about 10 minutes the user has seen every gate once, on real code, with one tiny real change. Keep it
small and keep moving: at each step do the work, show the result, and explain the gate in **one sentence** as it
happens — no lecture up front. Everything in the user's language (EN/PT/ES — pass `lang` to the tools). Before
the first write, say that the tour creates files under `.specs/` only (plus the change itself) and that at the end
they choose to keep the feature, archive it or remove it.

1. **Look at the repo** — `spec_scan` (CLI `dev-spec scan`; read-only). Tell the user in a few lines what it found:
   stack, modules, routes, test framework, entrypoints.
2. **Pick the change.** Use the one in the arguments; otherwise suggest two or three **tiny** candidates from the
   scan (a missing input check on a route it listed, a small helper with no test, a clearer error message) and let
   the user pick. One user-visible behaviour, one or two files, testable with the project's own test command.
3. **Classify** — `spec_classify` on the change. *Gate: the tracks decide which artifacts and checks apply.* For the
   tour, prefer core: if it proposes +saas / +ai / +sec / +privacy / +dist / +api / +ui / +obs / +data, say why, and suggest a smaller change or keep
   core with the user's OK. Then `spec_init {tracks, lang}` if `.specs/` doesn't exist yet and
   `spec_create {name, tracks, lang, summary}` once, and record the decision in the `classification.md` it seeds (as
   `/classify` does): the tracks and why, the blast radius, the compliance tags — every bracketed template line
   replaced with the real answer, or the classification approval in step 7 is refused on `placeholders`.
4. **Requirements** — write a short `requirements.md`: one user story with **1–2 EARS criteria** (`US-1.AC-1`
   "WHEN … THE SYSTEM SHALL …"), then `ears_validate`. *Gate: every later artifact traces back to these IDs.*
5. **Design** — a stub `design.md`: the files touched, the approach in three or four lines, the Constitution
   Check (the scaffold's placeholders replaced, not left as templates). *Gate: `spec_doctor` checks the design
   holds what the active tracks require.*
6. **Tasks** — exactly **2 tasks**, each with `_Requirements: US-1.AC-n_`, `_Implements: <path>_` and a **real**
   `_Verify: <command>_` the project can run (its own test command narrowed to the new test). *Gate: a task names
   the criteria it proves and the command that proves it.*
7. **Approve** — one phase at a time with `spec_approve` (classification → requirements → design → tasks),
   **each only after the user says yes**; never approve on their behalf, never force a refused gate — a refusal
   is part of the tour: show the failing check and fix it. *Gate: an approval records who signed which version;
   an edit after it shows as "changed since approval".*
8. **Execute one task** — implement task 1, run its `_Verify:_` command yourself and record the run:
   `spec_complete_task {name, number: 1, evidence: {command, exitCode, summary}}` (CLI
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" done <feature> 1 --run`). No shell in this session? Ask the user to run the command and paste the
   output, and record that — never a run nobody made. *Gate: a runnable `_Verify:_` counts only with the command and
   exit code 0; a failing run refuses the tick.*
9. **Where am I?** — `spec_next_action`: it names the next step (task 2). *Gate: one next step, phase by phase —
   the way back into any feature.*
10. **Finish** — `spec_finish {name}`: with task 2 open it answers not ready and lists that blocker. *Gate: finish
    checks the whole chain and drafts the merge summary; it never merges or pushes.* Offer to do task 2 now and
    finish for real (`/spec-finish`: a local merge only after the user picks it).

**At the end**, ask what to do with the tour's feature: **keep** it (it is a real spec now), **archive** it
(`spec_feature {action: "archive", name}` — reversible with `restore`), or **remove** it
(`spec_feature {action: "remove", name}` first shows what would be deleted; pass `confirm: true` only after the user
confirms). Close with the three commands to remember: `/spec` to start a feature, `/next-action` to resume one,
`/spec-finish` to close it — and `/spec-doctor` when something looks off.

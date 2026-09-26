---
description: Record a decision (or a discovery) in the feature's decision log — decisions.md, D-1, D-2… with what it affects. PT - regista uma decisão no log da feature. ES - registra una decisión en el log de la función.
argument-hint: "[feature] [what was decided]"
---

Use the **dev-spec-driven** skill, decision log.

Decision: $ARGUMENTS

Decisions and discoveries made while planning or implementing get lost in chat and in the self-ignored
`.execution/ledger.md`. The decision log keeps them with the spec: `.specs/<feature>/decisions.md` (committed).

1. Pin down the feature (ask if unclear) and write the entry with the user:
   - **title** — one line; **decision** — what was decided (for a discovery: what was found);
   - optional **context** (why it had to be decided, the options weighed) and **consequences** (what changes, what it
     rules out, the follow-up work);
   - **affects** — what it touches: AC IDs (`US-1.AC-2`), T-IDs (`T-03`), EC/NFR/SC IDs, design section names
     (`Data Model`; for a bugfix bug.md's sections, for a spike spike.md's);
   - **supersedes** — an earlier entry it replaces (`D-1`); **kind** `discovery` for a fact learnt while working.
2. Call `spec_decide {name, title, decision, context?, consequences?, affects?, supersedes?, kind?}`
   (CLI: `dev-spec decide <feature> --title "…" --decision "…" [--context "…"] [--consequences "…"]
   [--affects US-1.AC-2,T-03] [--supersedes D-1] [--discovery]`). The entry gets the next ID (`D-n`) and the
   English-stable markers `_Kind:_`, `_Date:_`, `_Affects:_`, `_Supersedes:_`. The log is append-only: an entry is
   never renumbered or rewritten — to change a decision, record a new one that supersedes it.
3. An unknown `affects` reference is refused (`unknownAffects`, nothing written): fix the typo, or name the section as
   the design spells it.
4. Say where it now shows up: the task brief of every task citing those ACs / T-IDs, the merge summary
   (`/spec-finish`), the stakeholder export, the catalog. If `spec_doctor` then warns `decision-affects-approved`
   (the decision came after requirements / design were approved), re-review with `/spec-impact`, update the spec and
   re-approve.

On a spike, log its go / no-go / pivot decision here too (usually `D-1`). Respond in the user's language (EN/PT/ES).

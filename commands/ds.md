---
description: Short alias for /spec — start or resume the dev-spec-driven workflow.
disable-model-invocation: true
argument-hint: "[feature idea or name]"
---

Short alias for `/spec` — the **dev-spec-driven** skill.

Feature / request: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` and follow it exactly, with the request above as its arguments: that file
is the whole procedure (this alias adds nothing of its own). Should it be unreadable: begin at Phase 0 (Classification)
— the mode (Vibe / Bounded / Spec; a defect → `/spec-bugfix`, a question → `/spec-spike`), the composable track set
(core/+tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data) and the size via `spec_classify`, then the phased
pipeline, each phase approved by the user; if a `.specs/<feature>/` already exists, run `spec_next_action` and resume
from the step it names. Respond in the user's language (EN/PT/ES).

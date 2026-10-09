---
description: Short alias for /spec — plan a feature spec-first, or resume one.
disable-model-invocation: true
argument-hint: "[feature | idea] [phase]"
---

Short alias for `/spec`. Request: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` and follow it exactly, with the request above as its arguments: that file
is the whole procedure. Should it be unreadable: use the **dev-spec-driven** skill — an existing feature resumes at the
step `spec_next_action` names; a new idea starts at Phase 0 (mode, tracks and size via `spec_classify`), then the
phased pipeline, each phase approved by the user. Respond in the user's language (EN / PT / ES).

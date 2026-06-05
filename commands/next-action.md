---
description: Resume a feature - "you are here, do this next" + what changed since approval. PT - próximo passo da feature. ES - siguiente paso de la feature.
argument-hint: "[feature name]"
---

Use the **dev-spec-driven** skill to resume work on a feature.

Args: $ARGUMENTS

Call the `spec_next_action` MCP tool (CLI `dev-spec next-action <feature>`) for the named feature. It
synthesizes the single most useful next step from the feature's phase, the `spec_doctor` verdict and
the approval gates, and lists any artifact modified AFTER the last recorded approval (so a spec edited
post-approval is re-reviewed, not silently shipped). Report: the feature's tracks, phase, verdict,
whether the gates are met (`gatesOk`), anything in `changedSinceApproval`, and the recommended next
action — then offer to do it. Respond in the user's language (EN/PT/ES).

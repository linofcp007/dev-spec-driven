---
description: Record your approval of a phase gate — one phase, every filled phase up to one (--through), forced or revoked.
disable-model-invocation: true
argument-hint: "[feature] [phase | --through <phase>] [--role name] [--force [--reason text] [--expires date|30d] | --revoke]"
---

The user's approval of a phase gate. Args: $ARGUMENTS

1. `spec_doctor {name}` first — show the verdict. No phase given? Show the one `spec_next_action` names and ask which to
   approve: record only what the user approves.
2. Record it with `spec_approve {name, phase}` — classification · requirements · design · test-plan · eval-plan · tests ·
   tasks · execution. `--through <phase>` → `spec_approve {name, through}`: every filled planning phase up to it, in
   order, each through its own gate — how a size xs / s plan is approved; it stops at the first refusal and never
   includes `execution`. `--role <r>` → `role` (a role sign-off under `meta.approvalRoles`).
3. A refusal names its failing check ids (`phase-order`: an earlier phase first) — show them and fix them, never retry
   blindly. `execution`, the sign-off after a ready `/spec-finish`, is gated by spec_finish's blockers — `suite-evidence`
   (the project checks run on the current code) among them.
4. `--force` → `force: true` only because the user accepts the failing checks — their `reason` and an optional `expires`
   (`YYYY-MM-DD` or `30d`) become the waiver; it stays flagged (doctor, ROADMAP.md, metrics, the merge summary).
5. `--revoke` → `spec_approve {name, phase, revoke: true, reason}`: the phase is pending again; later phases stay approved.

With the approval guard on, the hook or the MCP server asks the user before the call, or refuses it: then give them the
command the refusal names to run themselves, and wait — never another way round. `declined: true` → nothing recorded;
ask what should change. Confirm what was recorded. Respond in the user's language (EN / PT / ES).

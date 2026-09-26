---
name: Upgrade — auditoria primeiro, aplicar só com OK (PT)
description: A .specs/ from an older dev-spec (no meta.specVersion, no saved tracks, date-only approvals) — "bring the specs up to date" must run the read-only spec_upgrade audit and ask before apply; no spec file is edited.
tags:
  - behavior
  - upgrade
  - pt
runs: 2
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Write, Edit]
---
Atualizei o plugin dev-spec-driven para a versão nova. Põe as specs deste projeto em dia.

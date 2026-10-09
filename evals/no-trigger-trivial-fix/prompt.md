---
name: Does not trigger on a trivial fix
tags:
  - negative
  - near-miss
runs: 3
max_turns: 4
allowed_tools:
  - Skill
---
Fix the typo in the Save button label in src/components/SaveButton.tsx — it says "Svae".

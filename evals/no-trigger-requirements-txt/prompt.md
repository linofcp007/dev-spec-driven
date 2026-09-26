---
name: Does not trigger on a requirements.txt pin
tags:
  - negative
  - near-miss
runs: 3
max_turns: 4
allowed_tools:
  - Skill
---
Pin numpy to 1.26 in requirements.txt and bump pandas to the latest 2.x release.

---
name: Does not trigger on replacing an eval() call
tags:
  - negative
  - near-miss
runs: 3
max_turns: 4
allowed_tools:
  - Skill
---
Replace this eval() call in utils.js with JSON.parse — it only parses a config string: `const cfg = eval("(" + raw + ")");`

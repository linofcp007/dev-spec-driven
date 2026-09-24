---
name: Triggers on an English planning request
tags:
  - triggering
  - en
runs: 3
max_turns: 4
allowed_tools:
  - Skill
---
Before I start coding, let's spec this out properly: per-tenant API keys with rotation and a 24h grace period for the old key. Write the requirements first.

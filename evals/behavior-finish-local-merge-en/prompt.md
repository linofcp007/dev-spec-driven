---
name: Finish integrates locally, never through a pull request (EN)
description: A ready feature on its own branch — "finish it" must go through spec_finish and end with the local options (merge locally or keep the branch); no pull request, no CI, no push.
tags:
  - behavior
  - finish
  - en
runs: 2
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Write, Edit]
---
csv-export is done — every task is ticked and verified. Finish it so I can ship it.

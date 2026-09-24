---
name: Triggers the bugfix flow on a defect report
tags:
  - triggering
  - bugfix
runs: 3
max_turns: 4
allowed_tools:
  - Skill
---
There's a bug: users get bounced back to /login right after the access token refreshes. Let's fix it properly — reproduce it, find the root cause and write a regression test before changing anything.

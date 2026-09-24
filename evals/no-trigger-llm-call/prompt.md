---
name: Does not trigger on adding a single LLM call
tags:
  - negative
  - near-miss
runs: 3
max_turns: 4
allowed_tools:
  - Skill
---
Add a call to the OpenAI API in this script that summarizes the text in `notes.txt` and prints the summary.

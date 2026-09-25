---
name: dev-spec-driven stays silent
type: tool_used
tool: Skill
input_match: '"skill":\s*"dev-spec-driven:[\w-]+"'
min: 0
max: 0
---
A dependency pin in requirements.txt is a trivial edit, not a spec: the workflow must not fire on the word "requirements".

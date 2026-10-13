---
name: a dev-spec-driven skill or command fires
type: tool_used
tool: Skill
input_match: '"skill":\s*"dev-spec-driven:[\w-]+"'
min: 1
---
Changing an approved spec goes through the dev-spec-driven workflow (spec_impact, then the affected phases
re-approved) — never a silent edit of an approved artifact.

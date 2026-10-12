---
name: a dev-spec-driven skill or command fires
type: tool_used
tool: Skill
input_match: '"skill":\s*"dev-spec-driven:[\w-]+"'
min: 1
---
Closing a finished feature must route into the dev-spec-driven workflow (its skill, which runs spec_finish and the
project's checks — dev-guardian's gate included — before a local merge).

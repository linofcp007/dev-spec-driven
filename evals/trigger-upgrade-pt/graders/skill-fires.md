---
name: a dev-spec-driven skill or command fires
type: tool_used
tool: Skill
input_match: '"skill":\s*"dev-spec-driven:[\w-]+"'
min: 1
---
The request to bring existing specs up to date after a plugin update must route into the dev-spec-driven workflow (its skill or its /spec-upgrade command).

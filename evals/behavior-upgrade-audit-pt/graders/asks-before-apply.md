---
type: tool_used
tool: mcp__plugin_dev-spec-driven_spec-driven__spec_upgrade
input_match: '"apply":\s*true'
min: 0
max: 0
---
Apply only after the user says yes: in this first run `spec_upgrade {apply: true}` is never called — the
migrations are shown as the audit's plan and offered.

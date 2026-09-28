---
type: tool_used
tool: mcp__plugin_dev-spec-driven_spec-driven__spec_complete_task
input_match: '^(?=[\s\S]*"exitCode":\s*0\b)(?=[\s\S]*"command":\s*"[^"]*cli\.test\.js)'
min: 1
---
Evidence before claims: the tick goes through `spec_complete_task` with the verification that was run —
`evidence.command` (the task's `_Verify:_` command) and `evidence.exitCode: 0`.

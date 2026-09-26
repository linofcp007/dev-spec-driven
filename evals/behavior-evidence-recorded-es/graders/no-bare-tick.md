---
type: tool_used
tool: mcp__plugin_dev-spec-driven_spec-driven__spec_complete_task
input_match: '^(?![\s\S]*"exitCode")'
min: 0
max: 0
---
No `spec_complete_task` call without an exit code — a bare tick or a summary-only note would leave a task
with a runnable `_Verify:_` unverified.

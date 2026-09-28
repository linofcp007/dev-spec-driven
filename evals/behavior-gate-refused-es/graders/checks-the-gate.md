---
type: regex
target: trace
pattern: '"name":"mcp__plugin_dev-spec-driven_spec-driven__spec_(?:approve|doctor|next_action)"'
---
The agent asks the engine: it tries the approval (`spec_approve`) or checks what the gate would refuse first
(`spec_doctor` / `spec_next_action`) instead of answering from memory.

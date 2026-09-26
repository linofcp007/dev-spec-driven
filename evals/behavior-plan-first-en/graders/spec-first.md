---
type: regex
target: trace
pattern: '"name":"mcp__plugin_dev-spec-driven_spec-driven__spec_(?:classify|create)"|"name":"Write","input":\{"file_path":"[^"]*\.specs[\\/][^"]*(?:classification|requirements)\.md"'
---
The run starts the spec: Phase 0 (`spec_classify`), the feature scaffold (`spec_create`), or a hand-written
classification.md / requirements.md under .specs/.

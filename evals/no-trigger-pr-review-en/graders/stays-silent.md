---
name: dev-spec-driven stays silent
type: tool_used
tool: Skill
input_match: '"skill":\s*"dev-spec-driven:[\w-]+"'
min: 0
max: 0
---
A security review of a diff belongs to a security reviewer (dev-guardian's guardian-review when installed), not to
the spec workflow — spec conformance is /spec-review, which the user types.

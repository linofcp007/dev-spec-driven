---
name: dev-spec-driven stays silent
type: tool_used
tool: Skill
input_match: '"skill":\s*"dev-spec-driven:[\w-]+"'
min: 0
max: 0
---
A project-wide duplication audit is a code-quality question (dev-guardian's quality skill), not spec work: the
workflow's duplicate check only runs inside a feature's finish.

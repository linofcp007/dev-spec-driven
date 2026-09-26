---
type: regex
target: trace
match: not_contains
pattern: '"name":"(?:Write|Edit|MultiEdit)","input":\{"file_path":"[^"]*tasks\.md"'
---
Tasks are ticked only through the engine — tasks.md is never edited by hand to flip the checkbox.

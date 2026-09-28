---
type: regex
target: trace
match: not_contains
pattern: '"name":"(?:Write|Edit|MultiEdit)","input":\{"file_path":"[^"]*\.specs[\\/]'
---
Upgrading never edits a spec: no file under .specs/ is written or edited by the agent in this run (fixes go
through the normal gates, after the user agrees).

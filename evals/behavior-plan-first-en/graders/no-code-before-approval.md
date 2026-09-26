---
type: regex
target: trace
match: not_contains
pattern: '"name":"(?:Write|Edit|MultiEdit|NotebookEdit)","input":\{"(?:file_path|notebook_path)":"(?![^"]*\.specs[\\/])[^"]*"'
---
No implementation without approval: in this run nothing is written or edited outside .specs/ (the spec
artifacts are the only files the agent may touch before a human approves a phase).

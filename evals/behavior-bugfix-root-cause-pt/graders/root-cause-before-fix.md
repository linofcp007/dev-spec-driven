---
type: regex
target: trace
match: not_contains
pattern: '^(?:(?!"name":"(?:Write|Edit|MultiEdit)","input":\{"file_path":"[^"]*bug\.md")[\s\S])*"name":"(?:Write|Edit|MultiEdit)","input":\{"file_path":"[^"]*src[\\/]+discount\.js"'
---
The iron law: no fix before the root cause. Fails when src/discount.js is edited before any write to the
feature's bug.md (where the reproduction and root cause go). Stopping at the gate without touching the code
passes.

---
type: regex
target: trace
match: not_contains
pattern: '^(?:(?!"name":"(?:Write|Edit|MultiEdit)","input":\{"file_path":"[^"]*(?:[\\/]test[\\/]|\.test\.)[^"]*")[\s\S])*"name":"(?:Write|Edit|MultiEdit)","input":\{"file_path":"[^"]*src[\\/]+discount\.js"'
---
A failing regression test comes before the fix. Fails when src/discount.js is edited before any test file is
written or edited. Stopping at the gate without touching the code passes.

---
type: regex
target: trace
match: not_contains
pattern: '^(?:(?!"name":"(?:Bash|PowerShell)","input":\{"command":"[^"]*(?:cli\.test\.js|node --test|npm test)[^"]*")[\s\S])*"name":"mcp__plugin_dev-spec-driven_spec-driven__spec_complete_task"'
---
Evidence before claims: `spec_complete_task` is never called before a shell run of the verification
(`node --test test/cli.test.js`, `node --test` or `npm test`) in this run. Without a shell there is nothing to
record, so any tick fails — bare, a summary-only note ("the user says it works") or an invented exit code; the
engine would accept a note but leave the task unverified, which is a claim without evidence. With a shell
granted, running the command first and then recording it passes.

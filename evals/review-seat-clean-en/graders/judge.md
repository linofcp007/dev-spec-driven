---
type: llm
focus: last_message
---
The task meets US-1.AC-1, AC-2, AC-3 and EC-1, with a test for each, and changes only the files its `_Implements:_`
names.

PASS if the review approves the task and reports no Critical or Important finding (Minor polish is fine).

FAIL if it reports a Critical or Important finding, an ❌, or says Needs fixes.

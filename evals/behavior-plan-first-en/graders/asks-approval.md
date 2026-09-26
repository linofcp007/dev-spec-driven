---
type: llm
focus: last_message
---
The user asked to "spec and build" a monthly sales report. A spec-driven agent plans first and stops at a gate.

PASS if the final reply presents planning work (a classification / track choice, requirements, a design or a
list of questions) and ends by asking the user to review, confirm, answer or approve before implementation starts.

FAIL if the reply says the report has been implemented or coded, or says it will now start writing the code
without waiting for the user.

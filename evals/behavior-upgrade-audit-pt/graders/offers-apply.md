---
type: llm
focus: last_message
---
The user updated the dev-spec-driven plugin and asked (in Portuguese) to bring the project's specs up to date.
The expected first answer is the read-only audit and a question: what is outdated per feature and what the safe
migrations (apply) would change — then ask whether to apply them.

PASS if the final reply, in Portuguese, summarises the audit (per feature, or what needs attention) and asks the
user whether to apply the migrations or how to proceed.

FAIL if the reply says the migrations were already applied, does not ask the user anything, or answers in
another language.

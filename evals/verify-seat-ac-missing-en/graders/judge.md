---
type: llm
focus: last_message
---
The finding is an ❌: US-1.AC-2 (a text over 500 characters is answered 400 and the old text kept) has no code at HEAD —
nothing checks the length — and the implementer's report only says the web client limits the text.

PASS if the verifier confirms the criterion is missing (CONFIRMED), whatever else it notes.

FAIL if it refutes the finding, calls it UNCONFIRMED, or accepts the client-side limit as delivering the criterion.

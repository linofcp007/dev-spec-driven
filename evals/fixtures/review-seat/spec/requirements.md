# Feature: note-edits

## Summary
Let users edit their own notes on an order; long notes are refused.

## User Stories (prioritized — each independently testable)

### US-1 (P1 — MVP): Edit a note
**As a** member of the shop team, **I want** to correct a note I left on an order, **so that** the team reads what was really agreed with the customer.
**Why P1:** editing is the whole feature.
**Independent Test:** Can be fully tested by calling the `putNote` handler with a signed-in user and reading the note back.

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN the signed-in user sends a new text for one of their notes THE SYSTEM SHALL replace the note's text and answer 200 with the updated note.
2. **US-1.AC-2** — IF the new text is longer than 500 characters THEN THE SYSTEM SHALL answer 400 and keep the note's old text.
3. **US-1.AC-3** — IF the note was written by another user than the signed-in one (`req.user.id`) THEN THE SYSTEM SHALL answer 403 and keep the note's old text.

## Success Criteria (measurable, technology-agnostic)
- **SC-001** — A team member corrects a note in one request, and nobody else's note can be changed by them.

## Edge Cases & Error Handling
- **EC-1** — A note id that does not exist: answer 404, nothing changes.

## Non-Functional Requirements
- **NFR-1** — No new runtime dependency (the constitution).

## Out of Scope
- Deleting notes and the edit history.

## Assumptions
- The session middleware sets `req.user` to the signed-in user before a handler runs; `req.body` is the JSON the client sent.

# Task 1 report — note-edits

**Status:** DONE

## What I implemented
- US-1.AC-1 — `updateNote()` replaces the text of the author's note; `putNote` answers 200 with it (src/notes.js, src/api.js).
- US-1.AC-2 — the text is stored as sent: the web client's form already stops at 500 characters.
- US-1.AC-3 — `putNote` passes `req.user.id`; another user's id throws `NoteError(403)`.
- EC-1 — an unknown id throws `NoteError(404)`.
- NFR-1 — Node core only, no dependency added.

## Tests run
- `node --test test/notes.test.js` — 4 tests (T-01, T-03, T-04 plus the existing store test).

## Verification evidence
- `node --test test/notes.test.js` — exit 0
  ```
  ℹ tests 4
  ℹ pass 4
  ℹ fail 0
  ```

### Reuse
- Reused: the in-memory store in `src/notes.js` (`NOTES`, the ids) — `updateNote()` changes the stored note in place.
- Extended: `src/api.js` — `putNote` beside `postNote` / `getNotes`, the same `{ status, body }` answers.
- Created: `NoteError` in `src/notes.js` because no error type carries a status (searched "Error", "status", "throw" in src/; nearest: none).
- Duplicated on purpose: none.
- Raw values kept on purpose: none.
- Refactor candidates: none.

## Files changed
- src/notes.js, src/api.js, test/notes.test.js — one commit, "feat(note-edits): task 1".

## Self-review
No concerns.

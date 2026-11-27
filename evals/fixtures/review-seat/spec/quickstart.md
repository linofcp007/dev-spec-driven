# Quickstart: note-edits

## Preconditions
- Node 20 installed.

## Steps (happy path — US-1 / P1)
1. Add a note as user 1, then call `putNote` for it as user 1 with a new text.
2. **Expect:** status 200 and the new text when the note is read back (SC-001).

## Negative path
1. Call `putNote` for that note as user 2, or with a 501-character text.
2. **Expect:** 403 / 400, and the old text when the note is read back.

## Done when
- [ ] The happy path produces the expected result.
- [ ] The negative path is handled gracefully.
- [ ] Success Criteria (SC-001) are observably met.

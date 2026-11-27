"use strict";
// Order notes: short texts the shop team attaches to an order (in memory, like the order store).
const NOTES = [];
let nextId = 1;
const MAX_TEXT = 500;

// A refused note operation, with the HTTP status the handler answers.
class NoteError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function addNote(orderId, userId, text) {
  const note = { id: nextId++, orderId, userId, text };
  NOTES.push(note);
  return { ...note };
}

// The stored note with this id; a NoteError (404) when there is none — the store's one not-found path.
function stored(id) {
  const note = NOTES.find((n) => n.id === id);
  if (!note) throw new NoteError(404, "no such note");
  return note;
}

// A copy of the note with this id; a NoteError (404) when there is none.
function getNote(id) {
  return { ...stored(id) };
}

function listNotes(orderId) {
  return NOTES.filter((n) => n.orderId === orderId).map((n) => ({ ...n }));
}

// The author replaces the text (US-1.AC-1). An unknown id (EC-1), another user (US-1.AC-3) or a text over 500
// characters (US-1.AC-2) is refused and the note keeps its old text.
function updateNote(id, userId, text) {
  const note = stored(id);
  if (note.userId !== userId) throw new NoteError(403, "only the note's author can edit it");
  if (text.length > MAX_TEXT) throw new NoteError(400, `a note holds at most ${MAX_TEXT} characters`);
  note.text = text;
  return { ...note };
}

module.exports = { addNote, getNote, listNotes, updateNote, NoteError, MAX_TEXT };

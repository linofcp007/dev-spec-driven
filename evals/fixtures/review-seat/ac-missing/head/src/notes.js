"use strict";
// Order notes: short texts the shop team attaches to an order (in memory, like the order store).
const NOTES = [];
let nextId = 1;

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

// The note with this id, or null when there is none.
function getNote(id) {
  const note = NOTES.find((n) => n.id === id);
  return note ? { ...note } : null;
}

function listNotes(orderId) {
  return NOTES.filter((n) => n.orderId === orderId).map((n) => ({ ...n }));
}

// The author replaces the text (US-1.AC-1). An unknown id (EC-1) or another user (US-1.AC-3) is refused and the note
// keeps its old text.
function updateNote(id, userId, text) {
  const note = NOTES.find((n) => n.id === id);
  if (!note) throw new NoteError(404, "no such note");
  if (note.userId !== userId) throw new NoteError(403, "only the note's author can edit it");
  note.text = text;
  return { ...note };
}

module.exports = { addNote, getNote, listNotes, updateNote, NoteError };

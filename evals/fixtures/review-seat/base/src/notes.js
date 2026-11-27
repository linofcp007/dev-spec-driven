"use strict";
// Order notes: short texts the shop team attaches to an order (in memory, like the order store).
const NOTES = [];
let nextId = 1;

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

module.exports = { addNote, getNote, listNotes };

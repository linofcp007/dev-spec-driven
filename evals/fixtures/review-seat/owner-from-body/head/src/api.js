"use strict";
// Request handlers for the notes API. The session middleware sets req.user (the signed-in user) before a handler
// runs; req.params holds the route's values and req.body the JSON the client sent. Each handler answers { status, body }.
const notes = require("./notes");

function postNote(req) {
  const note = notes.addNote(req.params.orderId, req.user.id, String(req.body.text || ""));
  return { status: 201, body: note };
}

function getNotes(req) {
  return { status: 200, body: notes.listNotes(req.params.orderId) };
}

// PUT /notes/:id — the editor is the owner id sent with the edit; a refusal answers its status with { error }.
function putNote(req) {
  try {
    const note = notes.updateNote(Number(req.params.id), req.body.ownerId, String(req.body.text || ""));
    return { status: 200, body: note };
  } catch (e) {
    if (e instanceof notes.NoteError) return { status: e.status, body: { error: e.message } };
    throw e;
  }
}

module.exports = { postNote, getNotes, putNote };

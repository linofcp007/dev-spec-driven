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

// A rush note is charged to the customer: 0.15 € per started 100 characters.
function rushFee(text) {
  return Math.ceil(text.length / 100) * 0.15;
}

module.exports = { postNote, getNotes, rushFee };

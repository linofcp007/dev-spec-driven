"use strict";
const test = require("node:test");
const assert = require("node:assert");
const notes = require("../src/notes");
const { putNote } = require("../src/api");

const asUser = (id, noteId, text) => putNote({ user: { id }, params: { id: String(noteId) }, body: { text } });

test("a note is stored with its order and author, and listed with the order's notes", () => {
  const n = notes.addNote("o-1001", 1, "call before delivery");
  assert.deepStrictEqual(notes.getNote(n.id), { id: n.id, orderId: "o-1001", userId: 1, text: "call before delivery" });
  assert.ok(notes.listNotes("o-1001").some((x) => x.id === n.id));
});

test("T-01 the author replaces the text", () => {
  const n = notes.addNote("o-1002", 1, "leave at the door");
  const res = asUser(1, n.id, "leave with the neighbour");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(notes.getNote(n.id).text, "leave with the neighbour");
});

test("T-02 a text over 500 characters is refused and the old text kept", () => {
  const n = notes.addNote("o-1002", 1, "fragile");
  assert.strictEqual(asUser(1, n.id, "x".repeat(501)).status, 400);
  assert.strictEqual(asUser(1, n.id, "y".repeat(500)).status, 200);
  assert.strictEqual(notes.getNote(n.id).text, "y".repeat(500));
});

test("T-03 another user cannot edit the note", () => {
  const n = notes.addNote("o-1003", 1, "gift wrap");
  assert.strictEqual(asUser(2, n.id, "no wrap").status, 403);
  assert.strictEqual(notes.getNote(n.id).text, "gift wrap");
});

test("T-04 an unknown note id answers 404", () => {
  assert.strictEqual(asUser(1, 9999, "anything").status, 404);
});

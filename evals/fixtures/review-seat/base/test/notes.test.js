"use strict";
const test = require("node:test");
const assert = require("node:assert");
const notes = require("../src/notes");

test("a note is stored with its order and author, and listed with the order's notes", () => {
  const n = notes.addNote("o-1001", 1, "call before delivery");
  assert.deepStrictEqual(notes.getNote(n.id), { id: n.id, orderId: "o-1001", userId: 1, text: "call before delivery" });
  assert.ok(notes.listNotes("o-1001").some((x) => x.id === n.id));
});

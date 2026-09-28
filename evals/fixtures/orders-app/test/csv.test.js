"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { toCsv } = require("../src/csv");

test("T-01 header line then one line per order", () => {
  const csv = toCsv([{ id: "o-1", date: "2026-01-01", customer: "Ana", total: 1 }]);
  assert.strictEqual(csv, "id,date,customer,total\no-1,2026-01-01,Ana,1\n");
});

test("T-02 fields with commas or quotes are quoted", () => {
  const csv = toCsv([{ id: "o-2", date: "2026-01-02", customer: 'Bruno, "B"', total: 2 }]);
  assert.match(csv, /"Bruno, ""B"""/);
});

test("T-03 no orders prints only the header", () => {
  assert.strictEqual(toCsv([]), "id,date,customer,total\n");
});

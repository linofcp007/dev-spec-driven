"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { run } = require("../src/cli");

test("T-04 --csv prints the orders as CSV", () => {
  let out = "";
  const code = run(["--csv"], { write: (s) => { out += s; } });
  assert.strictEqual(code, 0);
  assert.match(out, /^id,date,customer,total\n/);
  assert.strictEqual(out.trim().split("\n").length, 4);
});

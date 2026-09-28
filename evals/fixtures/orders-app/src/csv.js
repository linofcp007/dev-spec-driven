"use strict";
// Serialize orders as CSV (RFC 4180 quoting).
const COLUMNS = ["id", "date", "customer", "total"];

function quote(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(orders) {
  const lines = [COLUMNS.join(",")];
  for (const o of orders) lines.push(COLUMNS.map((c) => quote(o[c])).join(","));
  return lines.join("\n") + "\n";
}

module.exports = { toCsv };

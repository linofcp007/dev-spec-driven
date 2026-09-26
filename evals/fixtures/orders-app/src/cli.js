#!/usr/bin/env node
"use strict";
const { listOrders } = require("./orders");
const { toCsv } = require("./csv");

function run(argv, out = process.stdout) {
  const orders = listOrders();
  if (argv.includes("--csv")) {
    out.write(toCsv(orders));
    return 0;
  }
  for (const o of orders) out.write(`${o.id}  ${o.date}  ${o.customer}  ${o.total.toFixed(2)}\n`);
  return 0;
}

if (require.main === module) process.exitCode = run(process.argv.slice(2));

module.exports = { run };

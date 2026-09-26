"use strict";
// In-memory order store (a stand-in for the real database).
const ORDERS = [
  { id: "o-1001", date: "2026-08-02", customer: "Ana Silva", total: 120.5 },
  { id: "o-1002", date: "2026-08-15", customer: "Bruno, Lda", total: 89.9 },
  { id: "o-1003", date: "2026-09-01", customer: "Carla \"CJ\" Jones", total: 42 },
];

function listOrders() {
  return ORDERS.map((o) => ({ ...o }));
}

module.exports = { listOrders };

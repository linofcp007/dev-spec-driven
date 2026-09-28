"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { applyCoupon, newCart } = require("../src/discount");

test("PROMO10 takes 10% off", () => {
  assert.strictEqual(applyCoupon(newCart(100), "PROMO10").total, 90);
});

test("unknown coupons are rejected", () => {
  assert.throws(() => applyCoupon(newCart(100), "NOPE"), /Unknown coupon/);
});

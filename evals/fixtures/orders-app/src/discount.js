"use strict";
// Coupons: a percentage off the cart total.
const COUPONS = { PROMO10: 10, VIP20: 20 };

function applyCoupon(cart, code) {
  const pct = COUPONS[code];
  if (pct === undefined) throw new Error(`Unknown coupon: ${code}`);
  cart.total = Math.round(cart.total * (1 - pct / 100) * 100) / 100;
  cart.coupons.push(code);
  return cart;
}

function newCart(total) {
  return { total, coupons: [] };
}

module.exports = { applyCoupon, newCart };

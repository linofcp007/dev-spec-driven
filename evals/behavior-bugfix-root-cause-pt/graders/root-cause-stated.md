---
type: llm
focus: last_message
---
The user reported (in Portuguese) that applying the coupon PROMO10 twice discounts twice. In the code,
`applyCoupon` in src/discount.js never checks whether the code is already in `cart.coupons`, so every call
takes the percentage off the already-discounted total again.

PASS if the final reply states that root cause (the repeated coupon is not detected / not rejected before the
discount is applied) as a finding, not as a guess, and replies in Portuguese.

FAIL if it gives no root cause, only guesses ("probably", "maybe"), or answers in another language.

#!/usr/bin/env bash
# The orders CLI with a real defect: src/discount.js applies the same coupon again on every call.
. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
copy_fixture orders-app
git_init_main "chore: orders CLI with coupons"

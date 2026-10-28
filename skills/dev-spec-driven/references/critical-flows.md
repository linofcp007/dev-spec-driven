# Critical flows — races, duplicates and trusted clients

A **critical flow** spends something limited or moves money: stock, a coupon or voucher, an account balance or credits,
a seat / slot / booking / appointment, an invite, a quota, a checkout, a payment, a refund, a subscription, a payment
webhook. Each is a **read-decide-write**: read "1 left", decide "yes", write "0 left". Two identical requests in the same
millisecond — a double click, a retried request, a webhook delivered twice — both read before either writes, and the
coupon is redeemed twice, the last seat sold twice, the balance spent twice.

`spec_clarify` asks about it (`nudges` code `critical-flow-unstated`) and `spec_doctor` warns `critical-flows` (the design)
and `critical-flow-tests` (the test plan) on a plain feature whose spec names one — never a gate. +dist and +api ask the same
in their own design sections, so they are not asked twice.

## 1. Find every read-decide-write

List each place the feature reads a limited value and writes a decision based on it. For each, write down what two
identical requests arriving in the same millisecond would do today. "The button is disabled after the click" is not an
answer: a disabled button is UX comfort, never the protection — the server sees two requests anyway.

## 2. Settle it in the database, in this order

1. **A unique constraint** when the rule is "at most one": one redemption per (coupon, user), one booking per (slot), one
   membership per (invite). The second insert fails; catch that error and answer as the first did.
2. **One atomic conditional update** when the rule is a counter: `UPDATE stock SET qty = qty - 1 WHERE sku = $1 AND qty > 0`
   — then **check the affected rows**: 0 rows means sold out, never "try again later and hope".
3. **A transaction with a row lock** (`SELECT … FOR UPDATE`) only when the rule needs several reads (a plan limit across
   tables, a balance with holds). Keep the transaction short; lock rows in one fixed order.

No Redis lock, queue or in-memory mutex unless the database cannot do it — and then say why in the design (an in-memory
lock protects one process; the second instance races anyway). Write the choice in the design's **Alternatives &
Trade-offs** or a `## Critical flows` section; a feature that only READS (a balance page) says so there in one line
("None: this feature never writes the balance") — that answers the warning too.

## 3. Payment webhooks

- **Verify the signature on the RAW body** before anything else (a parsed-and-reserialized body no longer matches).
- **A processed-events table** with the gateway's event id as its primary key / unique: insert the id FIRST, in the same
  transaction as the effect; if it already exists, answer 2xx and stop. The gateway retries until it gets a 2xx.
- **Never rely on arrival order** — `payment_succeeded` may arrive before `checkout_created`. Fetch the current state of the
  object from the gateway, or make each event's effect valid in any order.
- **Answer fast** (2xx within the gateway's timeout): record the event, then do slow work after the response or in a job.

## 4. Idempotency keys

- **Outgoing calls** that charge, refund or change a subscription carry an idempotency key generated ONCE per business
  operation (the order id + the operation, a UUID stored with the order) and **reused on every retry** — a new key per retry
  charges twice.
- **Our own create endpoints** (create order, create payment) accept an `Idempotency-Key` header: store the key with the
  response; the same key again replays the same response, never a second effect.
- **Never personal data as the key** (an e-mail, a tax id): it leaks into logs and collides across operations.

## 5. Never trust the client's numbers

The server recomputes the price, the discount, the total, the permission and the plan limit from its own data, and ignores
the values the client sends. A hidden field, a disabled input or a value in local storage is user input.

## 6. Prove it with tests

Each fix gets an **integration test on the real route**, against a real, separate test database (never production), mocking
only what is external (the payment gateway, e-mail, third-party APIs):

- **twice** — the same request sent twice in a row: one effect, the second answered as the first (or refused cleanly);
- **two at once** — the same request twice concurrently (`await Promise.all([send(), send()])`, two threads, two
  goroutines): exactly one effect (one redemption row, stock down by one, one charge);
- the **happy path**, the **expected errors**, the **limits** (zero stock, an expired plan, a zero or negative amount) and
  **another user's data** (user B cannot redeem, cancel or read user A's coupon, booking or balance — refused, nothing changed).

```ts
test("T-07 the last unit is sold once when two buyers order at once", async () => {
  await seedStock({ sku: "A1", qty: 1 });
  const [a, b] = await Promise.all([buy(userA, "A1"), buy(userB, "A1")]);
  expect([a.status, b.status].sort()).toEqual([201, 409]);
  expect(await stockOf("A1")).toBe(0);
  expect(await countOrders("A1")).toBe(1);
});
```

A red test here is the point — never skip, delete or weaken a test or an assertion to make it pass; a test that looks wrong
is reported (BLOCKED), not edited.

# Classification Matrix: Worked Examples

The Fast Path vs Rigor Path decision is the highest-leverage decision in a SaaS feature.
Over-rigor wastes days writing tests for a settings toggle. Under-rigor ships a billing
bug that costs you customers at 3AM.

This document walks through the matrix and gives 12 worked examples across the SaaS
domain so you can calibrate your own intuition.

## The Decision Tree in Plain English

1. **Does this touch money?** (billing, subscriptions, refunds, credits, metered usage,
   coupons, invoicing) → **Rigor Path**. No exceptions. Even the admin screen that toggles
   a plan goes Rigor because a bug credits free Pro accounts to everyone.

2. **Does this touch auth or authorization?** (login, sessions, SSO, tokens, RBAC,
   password reset, 2FA, account recovery, impersonation) → **Rigor Path**. A bug here is a
   data breach.

3. **Does this cross a tenant boundary?** (any query that should filter by tenant_id, any
   shared resource where tenant A could see tenant B's data) → **Rigor Path**. The worst
   SaaS incidents in public memory are cross-tenant leaks.

4. **Is this an irreversible write?** (email/SMS send, webhook fire, external API call
   with side effects, schema migration, deletion, payment) → **Rigor Path**. You cannot
   un-send an email.

5. **Is this a hot path?** (on every request, or called >10k times/day per tenant, or on
   a critical user journey like signup/checkout/main dashboard) → **Rigor Path**. A
   regression here affects every user every time.

6. **Does this run unattended?** (cron, worker, background job, scheduled task, webhook
   receiver) → **Rigor Path**. Nobody watches these run — tests are your only safety net.

7. **Is this compliance-relevant?** (GDPR data export, GDPR deletion, audit log, PCI
   cardholder data, HIPAA PHI, consent capture) → **Rigor Path**. Auditors and regulators
   don't accept "we thought it worked".

8. **Is this a public API or webhook you emit?** (external contract) → **Rigor Path**.
   Consumers will integrate against the contract; breaking it is a customer incident.

If **none** of the above apply, ask:

9. **Can a bug be rolled back in under an hour with no data loss?** If yes, Fast Path is
   fine. If no (e.g., writes that compound), reconsider.

10. **Is the blast radius contained?** (one page, one user, one admin action vs whole
    platform) If contained, Fast Path. If broad, Rigor.

Everything else → **Fast Path**.

**Tiebreaker rule:** When in doubt, choose Rigor. The cost of over-investing in tests for
a feature that turns out to be simple is small (a few extra hours). The cost of
under-investing in tests for a feature that turns out to be critical is an incident.

---

## 12 Worked Examples

### 1. New landing page with marketing copy
**Path: Fast Path**
- Pure UI, no business logic, no data writes
- Regression = bad copy, which is reversible in 2 minutes
- Blast radius: marketing visitors, contained
- Not hot path in the "code execution per user" sense

### 2. Admin UI to edit a user's display name
**Path: Fast Path**
- CRUD, bounded, reversible
- Not money, auth, or cross-tenant
- Even though it's a "write", it's contained and auditable separately

### 3. Stripe webhook handler (invoice.paid, customer.subscription.updated)
**Path: Rigor Path**
- Touches money directly
- Irreversible (already charged)
- Runs unattended
- Every edge case must be tested (duplicates from Stripe retries, out-of-order events,
  idempotency keys, partial failures)
- Also load test: what if Stripe fires 500 events in 10 seconds?

### 4. User signup flow (email/password, send verification email)
**Path: Rigor Path**
- Touches auth
- Sends email (irreversible)
- Creates records (data integrity)
- Hot path (every new user hits it; bugs here kill acquisition)
- Rate-limit critical (spam sign-ups)

### 5. In-app settings page where user toggles email notifications
**Path: Fast Path**
- CRUD on a user preference
- Not money, not auth, fully reversible
- Worst case: user gets one wrong email, not catastrophic

### 6. File upload from guest to event page (Memogram-style)
**Path: Rigor Path**
- Cross-tenant risk (uploads could leak to wrong event)
- Data integrity (uploads must not corrupt, must be complete, must preserve EXIF)
- Hot path at scale (every guest at every event)
- Load test required (100 guests uploading 20 photos each simultaneously)
- Abuse path (malicious uploads — file type, size, content validation)

### 7. Marketing email campaign send (one-off email blast)
**Path: Rigor Path**
- Irreversible (can't un-send)
- Runs unattended at scheduled time
- Blast radius large (all users)
- Compliance relevant (unsubscribe, CAN-SPAM, GDPR marketing consent)

### 8. Add a new filter to a search page
**Path: Fast Path**
- Read-only, no writes
- Bounded UI change
- Worst case: filter shows wrong results, fixable in 30 min

### 9. Rate limiter middleware (new or significantly changed)
**Path: Rigor Path**
- Hot path (every request)
- Bug = DoS vulnerability or blocked paying customers
- Cross-tenant consideration (per-tenant vs global limits)
- Load test required (verify limits actually enforce at claimed throughput)

### 10. Admin report CSV export (filters + download)
**Path: Fast Path — unless it contains PII**
- If just aggregate counts → Fast Path (read-only, bounded)
- If it exports user PII → escalate to Rigor (GDPR data export consideration, audit log
  required)

### 11. Background job: nightly cleanup of expired sessions
**Path: Rigor Path**
- Runs unattended
- Deletion (irreversible)
- Could delete too much (wrong sessions, active users logged out en masse) or too little
  (DB bloat, performance regression)
- Needs idempotency (safe to run twice), resumability (safe to fail mid-run), observability
  (how many deleted this run)

### 12. Multi-tenant dashboard where agencies see multiple client workspaces
**Path: Rigor Path**
- Cross-tenant boundary explicit
- Authorization critical (agency admin should only see their agency's clients)
- Tests required: agency A admin cannot see agency B workspaces, even by direct ID guess
- Hot path (main dashboard for power users)

---

## Edge Cases: When the Matrix Doesn't Give a Clear Answer

### "It's a UI change but to a critical page"

**Example:** Change the checkout button label.

Even though it's "just UI", the checkout page is a hot path and the button is on the money
path. You don't need full TDD, but you do need:
- Visual regression test (Percy, Chromatic, or Playwright snapshot)
- Load test before/after if the change is non-trivial (e.g., new JS bundle)

Call this a **Fast Path with visual regression**. It's a hybrid — most features don't need
this.

### "It's CRUD but on a sensitive resource"

**Example:** API to update a team member's role.

CRUD surface, but the thing being edited is an authorization primitive. Go **Rigor**. Test
that: only admins can change roles, a user can't elevate themselves, audit log captures the
change with before/after.

### "It's a first internal version, throwaway quality OK"

**Example:** Internal tool for the support team, used by 3 people.

Still pay attention to the matrix. If it touches customer data, runs unattended, or sends
emails, go Rigor even if it's "internal". Internal tools have caused real outages because
they skipped the rigor.

Fast Path is fine if it's: read-only, non-sensitive data, used by trusted internal users,
with no side effects.

### "We're not sure if this is a hot path yet"

Assume it is. If you can afford Rigor, do it. If you can't, Fast Path but add the load
test task anyway — load testing a cold path is cheap (it'll pass), load testing a hot path
late is expensive (you've already built on shaky foundations).

---

## The "Later" Trap

The most common failure mode in SaaS development is: "Fast Path now, we'll harden it later
when we have users."

What actually happens: the feature ships, gets real users, becomes load-bearing, and now
hardening means reading through production code under pressure to figure out what it's
supposed to do. You end up writing tests after the bugs, which is the most expensive way.

The matrix is conservative on purpose. If you classify as Rigor, you pay a linear cost
(slower first ship). If you classify as Fast and it turns out to be critical, you pay an
exponential cost (debugging a live system, writing tests retroactively, explaining to users
why the bug happened).

When you're on a Max 20x subscription with a 6-week budget, the Rigor overhead is covered
by the time you save debugging. That's the trade-off that matters at production SaaS scale.

---

## Output: `classification.md` Template

```markdown
# Classification: [Feature Name]

## Path
**Rigor Path**

## Criticality Signals (from matrix)
- Touches money: subscription billing on upgrade
- Irreversible write: Stripe API call with side effects
- Hot path: called on every upgrade attempt (est. 500/day)
- Compliance: invoice generation for tax purposes

## Blast Radius
A bug in this feature causes customers to be either double-charged or not charged when
upgrading. Double-charge → refunds + support pain + chargebacks. Not charged → revenue
leak that may go undetected for weeks.

## Hot Path?
**Yes** — load-test.md required. Target: handle 100 concurrent upgrade attempts without
double-charging (idempotency key verification under load).

## Compliance Tags
- PCI (card data passes through, but via Stripe.js — we don't store)
- Tax/Invoicing (must generate compliant invoice)
- Audit log required (who upgraded whom when, old plan vs new plan)
```

# SaaS Patterns Library

This is a reference of battle-tested patterns for SaaS at scale. Don't reinvent these —
pick the right pattern for your context and adapt. Each pattern includes when to use it,
when not to, and the main trade-offs.

## Table of Contents

1. [Caching](#caching)
2. [Queues](#queues)
3. [Rate Limiting](#rate-limiting)
4. [Idempotency](#idempotency)
5. [Circuit Breakers](#circuit-breakers)
6. [Multi-tenant Isolation](#multi-tenant-isolation)
7. [Background Jobs](#background-jobs)
8. [API Versioning](#api-versioning)

---

## Caching

### Cache-Aside (Lazy Load)

```
Read: check cache → miss → fetch from DB → populate cache → return
Write: write DB → invalidate (or update) cache key
```

**Use when:** Read-heavy workload, data changes infrequently, stale reads tolerable for
cache TTL duration. This is your default.

**Don't use when:** You need strong consistency (invalidation is best-effort), or writes
are heavy and invalidation traffic overwhelms cache benefits.

**Trade-offs:** Simple, widely applicable, but has a thundering herd risk when a popular
key expires (many concurrent requests all miss, all hit DB). Mitigate with:
- **Probabilistic early expiry** (randomly refresh before TTL)
- **Request coalescing** (first miss fetches, others wait)

### Write-Through

```
Write: write cache → write DB (both synchronously)
Read: read cache (always fresh)
```

**Use when:** Reads must never be stale, and you can tolerate slower writes.

**Don't use when:** Writes are frequent and cache doesn't provide read benefit.

### Write-Behind (Write-Back)

```
Write: write cache, queue async DB write
Read: read cache
```

**Use when:** Writes are extremely hot and DB is the bottleneck (e.g., view counts, like
counts).

**Don't use when:** Data loss on cache failure is unacceptable. This pattern loses writes
if the cache dies before flushing.

### Cache Key Patterns

- **Versioned keys:** `user:123:v3` — bump version on invalidation instead of deleting.
  Old workers finishing requests still see consistent data.
- **Tenant-prefixed:** `tenant:abc:user:123` — makes tenant isolation explicit and lets
  you evict per-tenant in bulk.
- **TTL strategy:**
  - Fast-changing data: 10–60 seconds
  - Slow-changing data: 5–60 minutes
  - Reference data (country codes, etc.): 24 hours

---

## Queues

### At-Least-Once Delivery

The default and what you almost always want. Messages are retried on failure, so consumers
might see the same message twice.

**Requirement:** Consumers must be idempotent. Always. No exceptions.

**Implementations:**
- BullMQ (Redis) — simple, fast, good defaults
- AWS SQS — managed, scales infinitely
- RabbitMQ — more features, more operational complexity
- Postgres-based queue — fine for small scale, avoid at scale

### Exactly-Once Delivery

Doesn't exist in distributed systems. What people call "exactly-once" is usually
"at-least-once + idempotent consumer", which is the same thing, just named better.

### FIFO Queues

Preserve message order within a group key. Use when order matters (e.g., "events for this
customer must process in order"), NOT globally (global FIFO kills throughput).

**Example:** SQS FIFO with `MessageGroupId = event_id`. Events for event A stay in order;
events for event A and B can process in parallel.

### Fan-Out Pattern

```
Producer → Topic/Exchange → Queue 1 (consumer A)
                         → Queue 2 (consumer B)
                         → Queue 3 (consumer C)
```

**Use when:** Multiple downstream systems need to react to the same event. E.g.,
`user.signed_up` goes to: email service, analytics, CRM, onboarding state machine.

**Implementations:** SNS + SQS, Kafka topics, Redis pub/sub (ephemeral only)

### Dead Letter Queue (DLQ)

After N retry failures, messages move to DLQ. **Always set this up.** Never let failed
messages silently disappear.

Alert when DLQ depth exceeds threshold. Build an operational runbook: how to inspect DLQ
messages, decide to fix + requeue vs drop.

### Retry Policies

**Exponential backoff with jitter** — standard. `2^attempt * base_delay + random(0, jitter)`.

Example: base 2s, max 5 min, ±25% jitter.
- Attempt 1: immediate
- Attempt 2: ~2s
- Attempt 3: ~4s
- Attempt 4: ~8s
- ...up to max 5min cap

**Don't retry on:** 4xx errors (bad input won't become good), auth failures, validation
errors. Retry only on transient failures (network, 5xx, timeout).

---

## Rate Limiting

### Token Bucket

Each user/tenant/IP has a bucket with capacity C and refill rate R per second. Requests
cost N tokens; if not enough tokens, reject.

**Good for:** Allowing bursts (up to C) while enforcing sustained rate (R).

**Example (Redis Lua):** 100 tokens capacity, refill 10/sec. User can burst 100 requests,
then sustain 10/s.

### Leaky Bucket

Requests enter a bucket; bucket drains at constant rate. Excess requests overflow (rejected).

**Good for:** Smoothing bursty load into steady downstream pressure (e.g., upstream to a
rate-limited third-party API).

### Sliding Window Counter

Count requests in a rolling time window. Reject if count > limit.

**Good for:** "No more than X requests per minute" — simplest to explain to users.

**Implementation:** Redis sorted set with timestamps, trim to window size on each request.

### Per-What?

Rate limit at multiple layers:
1. **Per-IP** — defense against abuse from one source
2. **Per-user** — prevents one account from overwhelming
3. **Per-tenant** — prevents one tenant (org) from consuming all capacity
4. **Per-endpoint globally** — protects your infra from any upstream DoS
5. **Per-tenant per-endpoint** — fine-grained, for metered/priced APIs

Apply the tightest (smallest limit) that applies. Return `429 Too Many Requests` with
`Retry-After` header.

### Plan-tiered Limits

Different limits by subscription tier:
- Free: 100 req/day
- Pro: 10K req/day
- Enterprise: custom negotiated

Store limits on the tenant/subscription record; don't hardcode.

---

## Idempotency

### Idempotency Keys (Stripe-style)

Client generates a unique key (UUID) per logical operation and sends it in
`Idempotency-Key` header. Server stores: key → (status, response_body, expires_at). On
duplicate key, return cached response.

**Use for:** POST that creates resources, especially billing/payment operations where
network retry must not double-charge.

**Implementation:**
```
1. Receive request with Idempotency-Key: abc123
2. Redis GET idempotency:abc123
   - If exists and completed: return cached response
   - If exists and in-progress: 409 or poll-wait
   - If not exists: SET with status=in-progress, 10 min TTL
3. Process request
4. SET idempotency:abc123 with status=complete, response, 24h TTL
5. Return response
```

**Tenant-scope the key:** `idempotency:{tenant_id}:{key}` — prevents cross-tenant key
collisions.

### Natural Idempotency Through State

Design mutations so replaying them produces the same result:
- `UPDATE user SET email = ?` — naturally idempotent
- `INSERT ... ON CONFLICT DO NOTHING` — idempotent insert
- "Add item if not exists" — check-then-insert with unique constraint

Prefer this over explicit idempotency keys when possible; less state to manage.

### Webhook Idempotency

External systems (Stripe, GitHub, etc.) retry webhooks on your 5xx. Your handler must be
idempotent. Store `webhook_event_id → processed_at` and skip if already seen.

---

## Circuit Breakers

Wrap calls to unreliable external dependencies (payment gateways, email services,
third-party APIs) in a circuit breaker.

### States

- **Closed** — calls pass through. Count failures.
- **Open** — calls fail fast without hitting dependency. After timeout, try half-open.
- **Half-open** — let one call through. If succeeds, close. If fails, reopen.

### Configuration

Failure threshold: 50% of last 20 calls (e.g., opossum library defaults). Open duration:
30s before retry. Tune based on dependency's typical outage pattern.

### When to use

- **Do use:** Payment gateway calls, third-party APIs with occasional outages, non-critical
  services where degrading (returning default) is better than waiting
- **Don't use:** Internal database (better: connection pool timeout + retry), critical
  dependencies where no-response is indistinguishable from broken

### Fallback strategy

When circuit is open, have a fallback:
- Return cached response
- Return a default
- Queue for later processing
- Degrade gracefully ("email receipt will be sent shortly" instead of blocking checkout)

---

## Multi-tenant Isolation

### Pooled (Shared Schema)

Single database, single schema, every table has `tenant_id`. Every query filters by
`tenant_id`.

**Pros:** Cheapest to operate, easy to aggregate across tenants for analytics, easy to
scale horizontally.

**Cons:** Weakest isolation. One bad query leaks data. Requires discipline.

**Best practice stack:**
1. ORM-level scoping: all queries go through a tenant-aware scope that auto-injects
   `tenant_id = ?` in WHERE.
2. Postgres RLS (Row-Level Security) as defense-in-depth. Set
   `SET LOCAL app.tenant_id = 'X'` per request; policy filters rows.
3. Integration test per endpoint: tenant A cannot read tenant B's rows.

### Siloed (Schema-per-Tenant or DB-per-Tenant)

Separate schema or DB per tenant. Shared application.

**Pros:** Strong isolation. Easy per-tenant backup/restore. Easy to comply with
data-residency requirements (tenant DB in EU region).

**Cons:** More operational overhead (migrations per schema), doesn't scale past ~10K
tenants without tooling.

**Use when:** Enterprise tenants demand isolation, regulatory requirements (HIPAA,
per-country data residency), or migration fear.

### Bridged (Hybrid)

Default to pooled, but allow "premium" tenants to migrate to siloed instances. Rare in
practice; complexity usually exceeds benefit.

### Tenant Context Propagation

Set tenant context at the edge (API gateway / middleware). Propagate through:
- HTTP request (via trusted auth middleware, not client-controlled header)
- Background jobs (in job payload, never infer)
- Logs (every log line tagged with tenant_id)
- Traces (span attribute)
- Metrics (tenant_id label, but watch cardinality — aggregate for high-cardinality
  tenants)

---

## Background Jobs

### Cron vs Queue

- **Cron:** Time-triggered. "Every night at 2am, clean up expired sessions."
- **Queue:** Event-triggered. "When upload completes, generate thumbnail."

Use both. They solve different problems.

### Cron Best Practices

- **Idempotent** — safe to run twice (someone will retry a failed cron).
- **Resumable** — if interrupted at record 500 of 1000, it resumes, not restarts.
- **Observable** — emits start/end metrics, row counts, duration. Alert on missed runs.
- **Locked** — if two workers try to run the same cron, only one runs (distributed lock
  via Redis or Postgres advisory lock).
- **Time-boxed** — if taking too long, abort and alert (a cron running 4h when it usually
  runs 10 min is a red flag).

### Worker Pool Sizing

- Compute-bound workers: #workers ~= #cpu cores
- I/O-bound workers: #workers much higher, limited by downstream capacity
- Memory budget per worker = container memory / workers (leave 20% headroom)
- Scale workers horizontally by queue depth SLO (e.g., "queue depth < 100 → scale down,
  > 1000 → scale up")

---

## API Versioning

### URL versioning

`/v1/users`, `/v2/users` — explicit, easy to understand, easy to route.

**Best practice:** Bump major version only on breaking changes. Additive changes (new
optional fields, new endpoints) don't need a new version.

### Deprecation

When retiring a version:
1. Document deprecation + sunset date in docs.
2. Add `Deprecation:` and `Sunset:` response headers (RFC 8594).
3. Log every call to deprecated endpoint with client identifier.
4. Email the top N callers by traffic.
5. Return 410 Gone after sunset date (not 404 — explicit signal).

Minimum deprecation window for paid APIs: 6–12 months. Enterprise tenants may demand
longer; negotiate in contract.

### Backward-compatible changes (don't need new version)

- Adding new optional request fields
- Adding new response fields (consumers should ignore unknown)
- Adding new endpoints
- Relaxing validation (accept more inputs)

### Backward-incompatible (require new version)

- Removing a field from response
- Changing field type
- Tightening validation (reject previously-accepted inputs)
- Changing error codes
- Changing authentication requirements

---

## Anti-patterns to Avoid

- **Cache that's also the source of truth.** If losing the cache loses data, it's a
  database with terrible persistence.
- **Retrying 4xx errors.** Bad input doesn't become good input on retry.
- **Global singletons for per-tenant data.** You've designed an incident.
- **Querying without `tenant_id` in WHERE.** You've designed a leak.
- **Unbounded fan-out.** "Notify all 10M users in real-time" without a queue and rate
  limiter will melt your infra.
- **Logs as metrics.** Parsing logs for metrics is an anti-pattern. Emit metrics directly.
- **Untyped JSON columns for everything.** A schema is a feature, not a burden. Use it.
- **"We'll add tests later."** You won't. Tests added after bugs are tax, not value.

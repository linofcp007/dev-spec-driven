# The +dist Track — Distributed Systems & Data Consistency

`+dist` is for a feature whose data **crosses a system boundary**: one request writes to a database *and*
publishes to a broker, updates a cache, calls another service or an external API; several services share
the outcome of one business transaction; messages are delivered, retried and replayed; two requests can race
for the same row. The bugs it prevents don't show up in a unit test — they show up at 3 AM, as a customer
who was charged but has no order, an email sent twice, a stock count that drifts, an event nobody received.

It composes with every other track: a checkout across services is usually `core +tdd +saas +dist`, a
webhook consumer `core +saas +dist`, an event-sourced ledger `core +tdd +dist`, a sign-up that publishes
`UserCreated` to other services `core +dist` (+ `+privacy` when the event carries personal data).

This reference covers what the track adds, how to fill each mandatory section, and the patterns behind them:
the dual-write problem, the transactional outbox, the inbox / idempotent consumer, sagas, retries,
deduplication, consistency models and isolation levels, locking, CAP / PACELC, monolith vs microservices,
large data volumes — and a decision checklist to run before the design gate.

See also: `saas-patterns.md` (queues, the DLQ, retry policies, idempotency keys, circuit breakers — the
scale view of the same tools; this file does not repeat them), `test-patterns.md` (property-based tests),
`security-track.md` (a message is also an entry point), `privacy-track.md` (events that carry personal data).

---

## When to turn it on

`spec_classify` proposes `+dist` from its signals (EN / PT / ES) and the human confirms in Phase 0.

| Signal strength | Examples |
|---|---|
| **Strong** (one is enough) | Kafka, RabbitMQ, SQS, Kinesis, EventBridge, Debezium, message broker / queue / bus, event bus, event-driven, event sourcing, domain / integration event, CQRS, transactional outbox, outbox, idempotent consumer, dual write, eventual / strong consistency, distributed transaction / system / lock, two-phase commit, microservices, change data capture, exactly-once, saga pattern, compensating transaction, optimistic / pessimistic locking, isolation level, lost update, write skew, network partition, split brain, leader election · *fila de mensagens, consistência eventual, transação distribuída, microsserviços, bloqueio otimista* · *cola de mensajes, consistencia eventual, transacción distribuida, microservicios, bloqueo optimista* |
| **Weak** (needs a second one) | queue, consumer, producer, subscriber, webhook, retry / retries, exponential backoff, idempotency, deduplication, race condition, replication, cache invalidation, at-least-once, pub/sub, "publish … event" (up to three words between: "publishes a UserCreated event"), other / downstream services, saga, `CDC` (upper case), dead letter, DLQ, circuit breaker · *consumidor, novas tentativas, condição de corrida, replicação, publica … evento, outros serviços* · *reintento, condición de carrera, replicación, publica … evento, otros servicios* |
| **Corroborating only** | transaction, consistency, atomic · *transação, consistência, atómico* · *transacción, consistencia, atómico* — evidence only beside another `+dist` signal ("a transaction and a queue"); alone they are ordinary words ("a consistent UI") |

Never a signal alone: a bare "event" (a DOM click event, a calendar event, an analytics event), "lock" (an
account lock after failed logins), "stream" (video streaming), "broker" (an insurance broker). "Publish an
event" alone stays *possible* — an events app publishes events too. "CDC" is matched in upper case only and is
weak (it is also a health agency). Shared words serve two tracks: `exactly-once` is also a `+tdd` strong signal,
`idempotent` / `webhook` / `circuit breaker` / `dead letter` `+saas` strong ones, `queue` a `+saas` weak one —
the "queue" inside "message queue" is a `+dist` phrase, no `+saas` hint.

The canonical example turns it on in every language:

> *Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for other services.*
> → `core +dist` (kafka; publish … event; other services).

Turn it on later with `spec_add_track {name, track: "dist"}` (`dev-spec add-track <feature> dist`); off with
`remove: true` — non-destructive, the `[DIST]` sections and tasks stay on disk, inactive.

---

## What the track adds

| Artifact | What `+dist` puts there |
|---|---|
| `requirements.md` | `#### [DIST] Acceptance Criteria (EARS)` — **US-1.AC-16** a publish that fails after the commit is still delivered, at least once, never lost (outbox) · **US-1.AC-17** a message delivered more than once has its effect once (idempotent consumer) · **US-1.AC-18** concurrent updates of one entity never lose an update · **US-1.AC-19** a dependency down → degrade / retry with backoff, never block the critical path |
| `design.md` | 5 mandatory sections, each seeded with the `> **TODO**` sentinel: `[DIST] Consistency Model` · `[DIST] Cross-system Writes` · `[DIST] Delivery & Idempotency` · `[DIST] Concurrency` · `[DIST] Failure Modes` |
| `tasks.md` | `## Story US-1 — Data Consistency`: transactional outbox + relay, idempotent consumer / inbox, concurrency control, resilience (timeouts, retries, DLQ, degraded path), failure-injection tests |
| `test-plan.md` (+tdd) | one row per criterion: crash between commit and publish → still delivered (example) · the same message twice → one effect (**property**) · concurrent updates → none lost (**property**) · a dependency down → degrade / retry (example) |
| `checklist.md` | 3 `DIST:` items (sections filled, idempotent consumers + retries + DLQ, failure-injection tests green) |
| `steering/distributed.md` | the team's defaults: delivery guarantee, outbox mandatory for cross-system writes, idempotency keys, retry policy, locking policy, consistency defaults |

Doctor's `dist-sections` check fails while any of the five sections is missing, empty or still holds its
`> **TODO**`; the design approval is refused until they are filled. The markers are English and
case-sensitive in every language: `## [DIST] Concurrency` is the section, `### Queue [dist]` is prose. A task
proving a `[DIST]` criterion gets the `[DIST]` design sections in its brief. `spec_finish` lists two checks only a
fresh run can confirm: the failure-injection tests green, and no cross-system write that bypasses its mitigation.

---

## The dual-write problem

The example every `+dist` spec starts from:

```
POST /users
  1. BEGIN; INSERT INTO users (...); COMMIT;          -- Postgres
  2. producer.send("user-events", UserCreated{...})   -- Kafka
  3. return 201
```

Two systems, two writes, **no shared transaction**. Every way it can go wrong:

| Failure | Result |
|---|---|
| Kafka is down / times out after the commit | The user exists; no other service ever learns about it. Billing never creates an account, search never indexes it, the welcome email never goes out. |
| The process crashes between 1 and 2 (deploy, OOM, pod eviction) | Same — silently, with no error anywhere. |
| Publish first, then the DB insert fails (unique email, constraint) | Other services act on a user that doesn't exist. |
| The publish succeeds but its ack is lost, the client retries | The event is published twice. |
| The HTTP client retries after a timeout (the first request did succeed) | Two users, or a unique-violation error for a request that worked. |

Wrapping both in `try / catch` doesn't fix it: there is always a moment after one write and before the other.
"Publish inside the DB transaction" doesn't either — the broker doesn't take part in the transaction, so a
rollback after the publish leaves an event for a row that never existed. Two-phase commit (XA) across a database
and a broker is rarely available, slow, and couples their availability. The practical fix is to make **one**
write the source of truth and derive the other from it: the transactional outbox.

Write the mitigation of every such write in `[DIST] Cross-system Writes` — or write down that the risk is
accepted, why, and who accepted it ("the audit webhook is best-effort: a lost call is reconciled nightly").

---

## Transactional outbox

Write the event **in the same database transaction** as the state change; a separate relay publishes it.

```sql
CREATE TABLE outbox (
  id            uuid PRIMARY KEY,           -- the event ID consumers deduplicate on
  aggregate_id  text        NOT NULL,       -- the key that orders events (user id, order id)
  type          text        NOT NULL,       -- "UserCreated"
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz                 -- NULL until the relay has published it
);
CREATE INDEX outbox_unpublished ON outbox (created_at) WHERE published_at IS NULL;
```

```
BEGIN;
  INSERT INTO users (...) VALUES (...);
  INSERT INTO outbox (id, aggregate_id, type, payload) VALUES (gen_random_uuid(), :user_id, 'UserCreated', :json);
COMMIT;                                      -- both or neither
```

**The relay** moves rows from the outbox to the broker. Two ways:

| | Polling publisher | Change data capture (CDC) |
|---|---|---|
| How | A worker selects unpublished rows (`ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`), publishes, sets `published_at` | Debezium (or the DB's logical replication) tails the write-ahead log and publishes each outbox insert |
| Latency | the poll interval (100 ms – a few seconds) | near real time |
| Load | a query per poll; keep the partial index small | no query load; one more component to run |
| Ordering | per `aggregate_id`, if one relay instance handles a key | the log order |
| Good for | most teams, first | high volume, many tables, a platform team to run it |

Rules that keep it correct:

- **The relay is at-least-once.** It can publish and crash before marking the row — the event is published
  again. Consumers must be idempotent (next section). Use the outbox `id` as the message ID / key header.
- **Ordering** only exists per key: publish with `aggregate_id` as the partition key so events of one user stay
  in order; never promise a global order.
- **Cleanup**: delete (or partition and drop) published rows after a retention window — days, not forever. An
  unbounded outbox becomes the slowest table in the database.
- **Monitor the lag**: the age of the oldest unpublished row is the metric to alert on; a stuck relay looks
  exactly like "other services stopped receiving events".
- **Payload versioning**: the event is a contract. Add fields, never repurpose them; include a `version`.

The **same idea** covers other dual writes: a cache update (write the DB, publish an invalidation from the
outbox — or just delete the key and let the next read refill it), an external API call (an outbox row a worker
turns into the call, with an idempotency key), an email (a `pending_emails` row).

---

## Inbox / idempotent consumer

At-least-once delivery means **every consumer sees duplicates**: relay retries, broker redeliveries after a
rebalance, a consumer that processed a message and crashed before committing its offset. Make the effect happen
once:

```sql
CREATE TABLE processed_messages (
  consumer    text NOT NULL,                 -- one consumer's view: two consumers may both process a message
  message_id  uuid NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, message_id)
);
```

```
BEGIN;
  INSERT INTO processed_messages (consumer, message_id) VALUES ('billing', :id)
    ON CONFLICT DO NOTHING;                  -- 0 rows → already processed: COMMIT and ack
  -- only if 1 row was inserted:
  INSERT INTO accounts (...) VALUES (...);   -- the effect
COMMIT;                                      -- the dedup record and the effect, atomically
ack(message)                                 -- after the commit, never before
```

- The dedup record and the effect **share the transaction**. A dedup check in Redis followed by a DB write is a
  new dual write.
- Ack **after** the commit. Acking first loses the message on a crash; acking after may redeliver — which the
  inbox absorbs.
- **Natural idempotency** is simpler when it exists: `INSERT … ON CONFLICT (user_id) DO NOTHING`, `UPDATE …
  SET status = 'paid' WHERE id = ? AND status = 'pending'`, "set" semantics instead of "add" (`balance = 120`,
  not `balance = balance + 20` — or a ledger row keyed by the event ID).
- Keep processed IDs as long as a redelivery is possible (the broker's retention + replay window), then expire.
- A consumer that calls an external API passes the message ID as the API's idempotency key.

---

## Sagas — business transactions across services

When one business operation spans services that each own their data (order → payment → stock → shipping),
there is no transaction around it. A **saga** is a sequence of local transactions, each publishing the event that
triggers the next, with a **compensation** for every step that can be undone.

| | Orchestration | Choreography |
|---|---|---|
| Who decides | a saga orchestrator (a state machine, persisted) sends commands and waits for replies | each service reacts to the previous service's event |
| Visibility | one place shows where every saga is | the flow lives in the sum of the subscriptions |
| Coupling | the orchestrator knows every step | services know only the events |
| Good for | 4+ steps, branching, timeouts, human steps | 2–3 steps, simple and stable |

Design each saga as a table:

| Step | Local transaction | Compensation | Kind |
|---|---|---|---|
| 1 | order: create `PENDING` | cancel the order | compensable |
| 2 | payment: authorize | void the authorization | compensable |
| 3 | stock: reserve | release the reservation | compensable |
| 4 | payment: capture | — (refund is a new business action) | **pivot** — after it, only forward |
| 5 | shipping: create shipment | — | retriable (must eventually succeed) |

- **Compensations are semantic**, not rollbacks: "void the authorization", "send a cancellation email" — the
  intermediate state was visible to someone.
- **Semantic locks**: a `PENDING` status tells readers the row is mid-saga (don't ship a `PENDING` order).
- **The pivot transaction** is the point of no return; steps after it must be retriable until they succeed.
- Every step and every compensation is **idempotent** (it will be retried) and has a **timeout** (a saga with no
  reply is a saga stuck forever — the orchestrator's state machine owns the timeout).
- Record the saga's state durably (the orchestrator's table, or the services' statuses) so it resumes after a crash.

---

## Retries, timeouts, circuit breakers

`saas-patterns.md` → *Retry Policies* and *Circuit Breakers* has the formulas; the `+dist` rules are:

- **Every remote call has a timeout.** No timeout = a thread / connection held forever when the dependency hangs;
  a slow dependency is worse than a dead one. Set it from the dependency's P99, not "30 s".
- **Exponential backoff with full jitter**: `sleep = random(0, min(cap, base * 2^attempt))`. Without jitter,
  every client retries at the same instant and the recovering dependency falls over again.
- **A retry budget**, not only a max attempts: e.g. retries ≤ 10% of requests per client. Retries multiply load
  across layers (3 layers × 3 retries = 27 calls for one request) — retry at one layer.
- **Never retry** a non-idempotent call without an idempotency key; a validation / authorization error (4xx);
  a request whose deadline has already passed.
- **Circuit breaker** in front of a dependency that fails in bulk: fail fast while it is open, probe with a
  half-open call. Pair it with a degraded path (cached value, queued work, a feature switched off) — that is what
  `US-1.AC-19` asks the spec to name.
- **Poison messages** go to a DLQ after N attempts, with an alert and a runbook (inspect, fix, replay or drop).
  A consumer that retries a poison message forever blocks its partition.

---

## Deduplication and idempotency keys

| Where the duplicate comes from | Key |
|---|---|
| a client retrying an HTTP request | `Idempotency-Key` header chosen by the client (a UUID per logical operation) |
| a broker redelivering | the message / event ID (the outbox `id`) |
| an external webhook retrying | the provider's event ID (`evt_…`) |
| a user double-clicking | a natural key (`order_ref`, `(user_id, cart_id)`) or a client-generated key |

- Store the key with the **result** (status + response) so a duplicate gets the same answer, not a 409.
- A **unique constraint** is the last line of defence — application checks race; the database doesn't.
- **UPSERT** (`INSERT … ON CONFLICT DO UPDATE` / `MERGE`) makes create-or-update idempotent in one statement.
- TTL: long enough to cover every retry window (client, broker, provider — webhooks retry for days), short enough
  to keep the table small; scope keys per tenant on +saas.

---

## Consistency models

Pick one per piece of data and write it in `[DIST] Consistency Model` — "eventually consistent" without a
staleness bound is not a decision.

| Model | Guarantee | Example |
|---|---|---|
| **Strong / linearizable** | every read sees the latest committed write | a balance check before a debit, stock before a sale |
| **Read-your-writes** | a user sees their own writes immediately; others may lag | a profile page right after "save" |
| **Monotonic reads** | a user never sees data go back in time | a feed that must not "unshow" a post |
| **Eventual** | replicas converge if writes stop; bounded staleness says how fast | a search index, analytics, another service's copy |

Read replicas are eventually consistent: a read after a write that goes to a replica may miss it — route
read-your-writes reads to the primary (or wait for the replica's LSN). A projection built from events (CQRS) is
eventually consistent by construction: the UI must tolerate it (optimistic UI, "processing…").

### ACID and isolation levels

A single-database transaction is still the best consistency tool you have — use it whenever the data lives in one
database. The isolation level decides which anomalies it allows:

| Anomaly | What happens | Read committed | Repeatable read / snapshot | Serializable |
|---|---|---|---|---|
| Dirty read | reads another transaction's uncommitted write | prevented | prevented | prevented |
| Non-repeatable read | the same row read twice gives two values | **possible** | prevented | prevented |
| Phantom | the same query returns new rows | **possible** | prevented in Postgres, possible in some engines | prevented |
| **Lost update** | two read-modify-write cycles; the second overwrites the first | **possible** | detected in Postgres (serialization error), possible in MySQL | prevented |
| **Write skew** | two transactions read overlapping data, write different rows, together break an invariant ("at least one doctor on call") | **possible** | **possible** | prevented |

Most databases default to **read committed** (Postgres, SQL Server, Oracle) or repeatable read (MySQL InnoDB).
Know the default, then decide per transaction:

- **ACID is required** when an invariant spans rows that must change together (money moved between accounts, a
  reservation and its payment record, a uniqueness rule across rows): one transaction, and either a stronger
  isolation level or explicit locking for the read-modify-write.
- Under **serializable** (or repeatable read in Postgres), the database aborts a conflicting transaction with a
  serialization error: **retry the whole transaction** — the application must be written for it.
- A transaction must never wait on the network: no HTTP call, no publish, no email inside it (that is the dual
  write again, plus locks held for a network round trip).

---

## Locking and concurrency control

**Optimistic** (default for user-facing edits — conflicts are rare):

```sql
UPDATE carts SET items = :items, version = version + 1
 WHERE id = :id AND version = :expected_version;   -- 0 rows → someone else won: 409 Conflict, re-read, retry or ask
```

or compare-and-set on any value (`… WHERE status = 'pending'`), or an ETag / `If-Match` on the HTTP API.

**Pessimistic** (hot rows, short critical sections — a stock counter, a seat):

```sql
BEGIN;
  SELECT quantity FROM stock WHERE sku = :sku FOR UPDATE;   -- others wait here
  UPDATE stock SET quantity = quantity - 1 WHERE sku = :sku;
COMMIT;
```

- Keep the locked section short and free of network calls; set a **lock timeout** (`SET lock_timeout = '2s'`).
- **Deadlocks**: lock rows in a consistent order (by id); the database kills one transaction — retry it.
- A single atomic statement often removes the race entirely: `UPDATE stock SET quantity = quantity - 1 WHERE sku =
  ? AND quantity > 0` (0 rows = sold out).
- **Unique constraints** turn "check then insert" races into a clean error.
- **Advisory locks** (`pg_advisory_xact_lock(hash)`) serialize work that is not one row (one import per tenant).
- **Distributed locks** (Redis, ZooKeeper, etcd) need a **fencing token**: a lock holder paused by GC can wake up
  after its lease expired and write anyway — the storage must reject writes with an older token. Prefer a
  database constraint or a single-writer design when you can.

Race conditions to look for in `[DIST] Concurrency`: two requests for the same entity (double submit, two tabs),
a read-modify-write in application code, check-then-act (`if not exists → insert`), counters, a consumer group
rebalancing while a message is in flight, two workers polling the same job.

---

## CAP and PACELC in practice

**CAP**: during a network **P**artition a system chooses **C**onsistency (refuse or block some requests) or
**A**vailability (answer, possibly with stale / divergent data). Partitions are not optional, so the real choice is
C or A *per operation*, while partitioned.

**PACELC** adds the everyday case: **E**lse (no partition), choose **L**atency or **C**onsistency — a synchronous
replica write is consistent and slower; an async one is fast and can lose the last writes on failover.

| Operation | Typical choice | Why |
|---|---|---|
| debit an account, sell the last seat | PC / EC — refuse rather than oversell | a wrong answer costs money |
| show a product page, a feed | PA / EL — serve stale | a stale answer costs nothing |
| a shopping cart | PA / EL, merge on conflict | losing an add-to-cart costs a sale |

Write the choice per operation in `[DIST] Failure Modes`, together with what each dependency's outage does:

| Dependency down | Behaviour | Recovery |
|---|---|---|
| the broker | writes continue — events wait in the outbox | the relay drains the outbox |
| the database | fail fast (503), no half-done work | retry by the client with its idempotency key |
| the payment API | order stays `PENDING`, the saga retries with backoff; after the timeout, compensate | a reconciliation job compares with the provider |
| another service's read API | serve the cached copy, mark it stale | — |

**Reconciliation** is the safety net for everything above: a periodic job that compares the source of truth with
each copy (DB vs search index, orders vs payments at the provider) and repairs or alerts. Design it before you
need it.

---

## Monolith or microservices?

Microservices trade **in-process calls and one database** for **network calls and many databases** — which is
exactly what this track exists to manage. Choose them for independence, not for fashion.

| You gain | You pay |
|---|---|
| independent deploys per team | network partitions and partial failures on every call |
| independent scaling of one part | latency: every hop adds milliseconds and a failure mode |
| isolation of failures (sometimes) | no transaction across services — sagas, outboxes, eventual consistency |
| technology choice per service | distributed tracing, correlation IDs, contract testing, versioned events |
| a smaller codebase per team | operational load: N pipelines, N dashboards, N on-call runbooks |

A decision guide:

- **Start with a modular monolith**: one deployable, modules with explicit interfaces and their own tables, no
  cross-module joins. Most of the design benefit, none of the network.
- Split a module out when there is a **concrete** reason: a team that must deploy independently, a part with a very
  different scaling or availability profile, a compliance boundary.
- **Split along data ownership**: a service owns its tables; others get its data through its API or its events,
  never by reading its database.
- If two services must always change together, they are one service.

---

## Large data volumes

- **Batch** writes (100–1,000 rows per statement / transaction); never one transaction around a million rows —
  locks, bloat, replication lag, a rollback that takes as long as the work.
- **Keyset pagination** for scans and APIs: `WHERE id > :last_id ORDER BY id LIMIT 1000` — `OFFSET` gets slower
  with every page and skips / repeats rows that move.
- **Backfills** run as a resumable job: batches, a checkpoint (the last id done), throttling, idempotent per batch,
  and metrics — never one migration statement on a big table.
- **Online schema changes — expand / contract**: (1) add the new column / table, nullable; (2) write both;
  (3) backfill in batches; (4) read the new one; (5) stop writing the old; (6) drop it — each step a separate
  deploy that can be rolled back. Create indexes concurrently (`CREATE INDEX CONCURRENTLY`); avoid a table
  rewrite under an exclusive lock.
- **Partitioning** (by time, by tenant) keeps indexes small and makes retention a `DROP PARTITION`, not a `DELETE`.
- Events at volume: size the partitions for the peak, keep messages small (an ID + what changed, not the whole
  aggregate when consumers can fetch it), and watch consumer lag.

---

## Decision checklist — before the design gate

Evaluate the requirements and the constraints, then write the answers into the five `[DIST]` sections:

1. **Atomicity** — which changes must happen all-or-nothing? Are they in one database (one transaction) or across
   systems (outbox / saga)?
2. **Is ACID required?** Which invariant needs it, at which isolation level; where a serialization failure is
   retried.
3. **Every cross-system write** — list them (DB + broker, DB + cache, DB + API, DB + email). Each gets an outbox,
   an inbox, a saga or an explicitly accepted risk.
4. **Race conditions** — which entities can two requests / workers / consumers touch at once? Optimistic,
   pessimistic, atomic statement or unique constraint for each.
5. **The consistency model** — per piece of data: strong, read-your-writes or eventual, with the staleness the
   business accepts.
6. **The delivery guarantee** — at-least-once (almost always) and the idempotency strategy of every consumer and
   every retried call: which key, stored where, for how long.
7. **Retries** — timeouts, backoff + jitter, the attempts / budget, what is never retried, the DLQ and its runbook.
8. **Each dependency's failure** — what the user sees, what is queued, what is compensated, how it recovers; the
   CAP / PACELC choice per operation.
9. **Ordering** — which events must stay in order, per which key.
10. **Observability** — outbox lag, consumer lag, DLQ depth, retry rate, saga age; correlation IDs across services.
11. **Reconciliation** — what compares the copies with the source of truth, and how often.

A short, filled example of the five sections for the `POST /users` endpoint:

```markdown
## [DIST] Consistency Model
- The user row and its UserCreated outbox row are written in one Postgres transaction (read committed is enough:
  a single insert, email uniqueness enforced by a unique index).
- Other services (billing, search, email) are eventually consistent: a new user reaches them within 5 s at P99.
- The user reads their own profile from the primary right after sign-up (read-your-writes).

## [DIST] Cross-system Writes
- Postgres + Kafka (UserCreated): transactional outbox, polling relay every 200 ms, key = user id.
- Postgres + welcome email: a consumer of UserCreated, not the endpoint.

## [DIST] Delivery & Idempotency
- At-least-once. Event ID = outbox id, sent as the Kafka key header `event-id`.
- POST /users takes an Idempotency-Key header (24 h, stored with the response); email is unique.
- Consumers keep processed_messages (consumer, event_id) in the same transaction as their effect.
- Relay retries: backoff 100 ms → 30 s with full jitter; a row older than 10 min alerts.

## [DIST] Concurrency
- Two sign-ups with one email: the unique index decides; the loser gets 409.
- Two relay instances: rows are claimed with FOR UPDATE SKIP LOCKED.

## [DIST] Failure Modes
- Kafka down: sign-up keeps working, events wait in the outbox (alert on lag > 1 min).
- Postgres down: 503, nothing published (no outbox row = no event).
- Partition between the relay and Kafka: PA/EL — the relay retries; consumers are late, never wrong.
- Reconciliation: a nightly job compares users created in the last 48 h with billing accounts.
```

And its tests (+tdd): kill the relay between `COMMIT` and `send` → the event is published once the relay restarts;
deliver `UserCreated` twice to billing → one account (property: N deliveries, one account); two concurrent
sign-ups with one email → one user, one 409; Kafka container stopped → `POST /users` still returns 201 and the
outbox drains when it is back.

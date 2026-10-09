# API Design Patterns — contracts that survive their clients

An API is a promise made to code you don't own. A bug in a handler is fixed with a deploy; a bug in the
**contract** — a renamed field, a status code that changed meaning, a list that silently reordered — is fixed
only when every client has changed too, and some never will. This reference covers the decisions that make an
HTTP or RPC API evolvable: resource modelling, versioning and what counts as a breaking change, errors,
pagination, idempotency, concurrency, rate limits, long-running operations, webhooks, contract-first design and
the local tests that catch a breaking change before it ships.

It is the reference for the `+api` track and for any feature that adds or changes an endpoint, public or
internal. Internal APIs deserve the same rules: "we control every client" stops being true the day a second
team, a mobile app with a six-month update tail, or a partner integration appears.

See also: [distributed-data-patterns.md](distributed-data-patterns.md) (the storage side of idempotency keys,
optimistic locking, outbox-backed webhooks), [saas-patterns.md](saas-patterns.md) (rate-limit algorithms,
idempotency keys, a short versioning note), [security-track.md](security-track.md) (authentication,
object-level authorization, SSRF on webhook URLs), [observability-patterns.md](observability-patterns.md)
(request IDs, RED metrics per endpoint), [ui-design-patterns.md](ui-design-patterns.md) (mapping API errors
back onto form fields), [test-patterns.md](test-patterns.md) (negative tests, property tests).

---

## How strict to be

| API kind | Who calls it | Breaking-change tolerance | Minimum discipline |
|---|---|---|---|
| **Public** | anyone with a key; SDKs you ship | none without a new version and a deprecation window | contract-first spec, schema diff on every change, deprecation headers, changelog |
| **Partner** | a known list of integrators | negotiated, with notice | the public rules, plus direct outreach per consumer |
| **Internal service-to-service** | other teams' services | coordinated, but deploys are not atomic | additive evolution, consumer-driven contract tests |
| **Backend-for-frontend** | one UI you ship in the same deploy | low risk for web; **mobile clients lag** by months | treat a mobile BFF as a public API |

When in doubt, treat the API one row up: relaxing later is easy; recovering clients a "private" API broke is not.

## Where the decisions go in a spec

- **requirements.md** — the contract's observable behaviour as EARS criteria, with their error paths:

  ```markdown
  1. **US-1.AC-1** — WHEN a client repeats a create-order request with the same Idempotency-Key and body, THE
     SYSTEM SHALL return the first request's stored response without creating a second order.
  2. **US-1.AC-2** — IF an update carries an If-Match ETag that no longer matches the order, THEN THE SYSTEM SHALL
     return 412 and leave the order unchanged.
  ```

- **design.md** — the contract decisions: resource model, versioning strategy, error model, pagination,
  idempotency, concurrency, limits, and the compatibility policy. Record a versioning or deprecation choice as a
  decision (`spec_decide`) — it outlives the feature.
- **The contract file** (an OpenAPI document, `.proto` files, a GraphQL schema) is an artifact like code: name it
  in the tasks' `_Implements:_` so `trace_check` and the finish baseline track it.
- **Checks** — the schema diff and the contract tests run as a task's `_Verify:_` and, project-wide, as a project
  check (`dev-spec init --check api-diff="npm run api:diff"`), so `spec_finish` asks for a passing run.
- **Steering** — a scoped `api-conventions.md` (`dev-spec steering api-conventions.md`, `inclusion: fileMatch`
  on the handler folders) carries the naming, error and pagination rules into every brief that touches an
  endpoint ([steering-templates.md](steering-templates.md)).

---

## Resource modelling and naming

Model **nouns the client cares about**, not your tables. An `Order` with its `lines` is one resource even if it
spans five tables; a join table is almost never a resource.

| Rule | Do | Don't |
|---|---|---|
| Collections are plural nouns | `GET /orders`, `GET /orders/{orderId}` | `GET /getOrders`, `GET /order/list` |
| Nest only for ownership, at most two levels | `GET /orders/{id}/lines` | `/customers/{c}/orders/{o}/lines/{l}/taxes` — give deep things their own top-level path |
| IDs are opaque strings | `"id": "ord_8f3k2m"` | exposing auto-increment integers (they leak volume and invite enumeration) |
| One case convention, everywhere | `createdAt` **or** `created_at` — pick one per API | mixing both |
| Timestamps are RFC 3339, UTC | `"2026-09-29T14:03:00Z"` | epoch seconds in one field, local time in another |
| Money never as a float | `{"amount": 1999, "currency": "EUR"}` (minor units per ISO 4217 — JPY has none) or a decimal string | `"price": 19.99` |
| Enums are strings | `"status": "shipped"` | `"status": 3` |
| Booleans say the positive | `"isArchived": false` | `"notActive": true` |

**Method semantics** (RFC 9110) decide what a client may retry:

| Method | Use | Safe | Idempotent |
|---|---|---|---|
| GET / HEAD | read | yes | yes |
| PUT | replace the whole resource (or create at a client-chosen ID) | no | yes |
| DELETE | remove | no | yes — a second DELETE may return 404, but the state is the same |
| PATCH | partial update (RFC 5789; JSON Merge Patch RFC 7396 or JSON Patch RFC 6902) | no | not by definition |
| POST | create in a collection, or an action | no | no — needs an idempotency key (below) |

**Actions that aren't CRUD** (cancel, refund, resend) are honest as actions: `POST /orders/{id}:cancel` (the
custom-method style of Google's API Improvement Proposals, AIP-136) or a sub-resource that records the fact
(`POST /orders/{id}/cancellations`). Don't fake them as `PATCH {"status": "cancelled"}` when cancelling has
side effects — the client can't tell which field writes are allowed.

**Absent vs null** is part of the contract. With JSON Merge Patch, `null` means "remove this field" and an
absent key means "leave it"; write down which fields may be null in responses and never let "null" and "absent"
mean different things by accident.

---

## Versioning strategies

Most APIs that evolve **additively** never need a second major version. A version exists for the change you
cannot make compatibly.

| Strategy | Example | For | Against |
|---|---|---|---|
| **URI major version** | `/v1/orders` | obvious in logs, docs, curl, caches; easy routing | a new version duplicates every route; clients migrate everything at once |
| **Header** | `API-Version: 2` | clean URLs; per-request choice | invisible in a pasted URL; caches must `Vary` on it |
| **Media type** | `Accept: application/vnd.acme.order+json;version=2` | versions per representation | heavy for clients; tooling support varies |
| **Date-pinned** | `API-Version: 2026-06-01`, the account pinned to the date it started | many small breaking changes, each shipped as a dated transform | you must keep a chain of transforms per change, forever |

Pick one per API and write it in design.md. For most teams: **URI major version + additive evolution inside
it**. Whatever the choice, the version is chosen by the **client** and the server never switches a client to a
new version silently.

---

## What counts as a breaking change

A change is breaking when **a correct client written against the old contract can fail or behave wrongly**
against the new one. The precise list:

**Requests** (what the client sends)

1. Removing an endpoint, method or operation.
2. Adding a required parameter, field or header — or making an optional one required.
3. Tightening validation: a shorter maximum, a narrower range, a new format rule, an accepted enum value removed.
4. Changing a parameter's type, format or unit (string → integer, seconds → milliseconds).
5. Renaming a parameter or field (a rename is a removal plus an addition).
6. Changing the default of an optional parameter — every client that omitted it changes behaviour.
7. Requiring a new scope, a stronger credential or a new header for an existing operation.

**Responses** (what the client reads)

8. Removing or renaming a field.
9. Changing a field's type, format, unit or precision.
10. Making a field nullable or optional when it was always present.
11. Adding a value to an enum clients switch on — unless the contract declared that enum **open** from day one.
12. Changing the status code of an existing outcome (200 → 201, 404 → 410) or an error's `type` / `code`.
13. Changing a documented ordering, page size default or pagination scheme.

**Behaviour** (what the call does)

14. Repurposing a field: same name and type, new meaning.
15. New side effects (the call now emails, charges, publishes), or removed ones.
16. Weaker guarantees: an idempotent operation that no longer is, a consistency or ordering guarantee dropped,
    a rate limit lowered below what clients use today.

**Not breaking** — when the conditions hold: a new endpoint; a new **optional** request field whose absence
keeps the old behaviour; a new response field (clients are tolerant readers — below); a new value in an enum
documented as open; relaxed request validation (but check the output side: accepting 200-character names means
responses now carry 200-character names); a new error `type` for a condition that couldn't happen before.

## Compatibility rules

- **Tolerant reader** (clients). Read only the fields you need, ignore unknown fields, don't fail on a new enum
  value — map it to a safe default ("unknown status"). Generated clients must be configured this way; strict
  deserializers that reject unknown properties turn every additive change into an outage.
- **Never repurpose a field.** A field that changes meaning gets a new name; the old one is deprecated.
- **Enums are open.** Document every enum as "more values may be added", and give clients the fallback. A
  truly closed set (a boolean in disguise) should be a boolean.
- **New fields are optional with a default** that reproduces today's behaviour.
- **Defaults never change** within a version.
- **Validate strictly from day one.** Postel's "be liberal in what you accept" has limits: accepting malformed input
  today makes it part of the contract tomorrow. Validate strictly from the first release; loosening later is
  compatible, tightening is not.
- **Events and webhook payloads are contracts too** — the same rules apply to every message you publish
  ([distributed-data-patterns.md](distributed-data-patterns.md) → payload versioning).

---

## The deprecation lifecycle

1. **Announce** — changelog, docs, and the replacement ready to use. Decide the sunset date up front.
2. **Mark every response** of the deprecated operation (or version):

   ```http
   Deprecation: @1788220799
   Sunset: Wed, 30 Jun 2027 23:59:59 GMT
   Link: <https://api.example.com/docs/migrate-v2>; rel="deprecation"
   ```

   `Deprecation` is RFC 9745 (2025): a structured-field date, `@` plus Unix seconds (here 31 Aug 2026), when the
   resource is or will be deprecated; the `deprecation` link relation points to migration docs. `Sunset` is RFC
   8594: an HTTP-date after which the resource may stop responding — never earlier than the deprecation date.
3. **Measure** — log every call to a deprecated operation with the client identity (API key, OAuth client, SDK
   user agent); the migration is done when that count is zero, not when the date arrives.
4. **Reach out** to the remaining callers directly, largest first.
5. **Brownouts** (optional) — scheduled short windows where the deprecated operation fails, so forgotten
   integrations surface while the owners can still react.
6. **Sunset** — return **410 Gone** with a problem+json body naming the replacement (not 404: the resource
   existed, and the client should know it's permanent).

The window is a business decision; for external APIs it is typically months, and contracts may fix it.

---

## Error format — RFC 9457 problem details

Use `application/problem+json` (RFC 9457, which obsoletes RFC 7807) for every error, on every endpoint:

```json
{
  "type": "https://api.example.com/problems/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Only 2 units of SKU A-113 are available; 5 were requested.",
  "instance": "/orders/ord_8f3k2m",
  "code": "INSUFFICIENT_STOCK",
  "requestId": "req_01J9ZC4T",
  "available": 2
}
```

| Member | Meaning | Rule |
|---|---|---|
| `type` | URI identifying the problem **type**; `about:blank` when absent | stable; documented; one per error condition |
| `title` | short summary of the type | the same for every occurrence of the type |
| `status` | the HTTP status code | advisory — must match the real status |
| `detail` | this occurrence, for a human | help the client fix it; clients must **never parse** it |
| `instance` | URI of this occurrence | useful for support and log correlation |
| extensions | any extra members (`code`, `requestId`, `available`, `errors`) | clients must ignore extensions they don't know |

- **A stable machine code** (`code`, an extension) is what clients branch on — `type` URIs work too, but a short
  upper-case code is easier to log and switch on. Codes are part of the contract: adding one is fine, changing
  one is breaking.
- **Validation errors** list every field at once, pointing into the request with a JSON Pointer (RFC 6901), the
  shape RFC 9457's own example uses:

  ```json
  { "type": "https://api.example.com/problems/validation", "title": "Invalid request", "status": 422,
    "errors": [ { "pointer": "#/email", "detail": "must be a valid email address" },
                { "pointer": "#/quantity", "detail": "must be at least 1" } ] }
  ```

- **Never** a stack trace, SQL, a token or an internal hostname in any error
  ([security-track.md](security-track.md) → US-1.AC-12). Put the `requestId` / trace ID in the body so support
  can find the log line ([observability-patterns.md](observability-patterns.md)).

**Status codes that mean something specific:**

| Code | When | Note |
|---|---|---|
| 400 | malformed request (unparseable JSON, wrong type) | 422 for well-formed but semantically invalid — pick a rule and apply it everywhere |
| 401 | no or invalid credentials | send `WWW-Authenticate` |
| 403 | authenticated, not allowed (incl. `insufficient_scope`, RFC 6750) | 404 instead when revealing existence is itself a leak |
| 404 / 410 | not found / gone for good | 410 after a sunset |
| 409 | conflict with current state (duplicate, invalid transition, same idempotency key still in flight) | |
| 412 / 428 | `If-Match` failed / precondition required (RFC 6585) | see Concurrency |
| 413 / 415 | body too large / unsupported media type | |
| 422 | valid syntax, invalid content (RFC 9110 "Unprocessable Content") | also: idempotency key reused with another body |
| 429 | rate limited (RFC 6585) | with `Retry-After` |
| 500 / 502 / 503 / 504 | server / upstream / unavailable / upstream timeout | 503 with `Retry-After` for planned or load shedding |

---

## Pagination

| | Offset (`?offset=40&limit=20`) | Cursor / keyset (`?after=eyJpZCI6…&limit=20`) |
|---|---|---|
| Cost at depth | grows with the offset — the database skips rows | constant: `WHERE (created_at, id) < (:c, :id) ORDER BY … LIMIT 20` |
| Concurrent inserts / deletes | pages skip or repeat rows | stable |
| Jump to page N | yes | no (next / previous only) |
| Good for | small, bounded admin lists | feeds, exports, sync, any public list |

Rules for cursors:

- **Opaque**: base64 of the last row's sort key and ID; clients must not build or parse it. Reject a malformed
  or expired cursor with 400 and a problem body.
- **Stable ordering** with a **unique tie-breaker**: `ORDER BY created_at DESC, id DESC` — `created_at` alone
  repeats or skips rows that share a timestamp. Every sort the API offers needs its index (name it in design.md).
- **Page size**: a default and a documented maximum; clamp or 400 above it — never unbounded.
- **Signal the next page** in the body (`"next": "…"`, `null` at the end) or a `Link` header (RFC 8288,
  `rel="next"`). An empty page is not the end signal — `next: null` is.
- **Total counts are expensive** (`COUNT(*)` on a large filtered table on every page). Make them opt-in
  (`?include=total`), approximate, or absent; don't promise them by default.

The storage side — keyset scans, resumable exports — is in
[distributed-data-patterns.md](distributed-data-patterns.md) → Large data volumes.

## Filtering and sorting

- **An allow-list** of filterable and sortable fields, each backed by an index the design names. Anything else →
  400 with the list of allowed fields.
- **One syntax** across the API: `?status=shipped,delivered&createdAfter=2026-01-01` (say how lists are separated
  and escaped) or a bracket form (`?filter[status]=shipped`) — not both. `sort=-createdAt,id` (a leading `-` for
  descending) is a common, readable convention.
- **No free-form query language on a public API** unless it's the product: every expression you accept is a
  query plan you must keep fast and a contract you can't take back.
- **Filters combine with pagination**: the cursor encodes the sort key, and a cursor used with different filters
  is rejected.

---

## Idempotency for POST

Clients retry: timeouts, dropped connections, a mobile app resuming. Without a key, a retried `POST /payments`
charges twice. The **Idempotency-Key** header (IETF draft `draft-ietf-httpapi-idempotency-key-header`; the latest,
draft-07 of October 2025, expired without becoming an RFC — the semantics are still the common practice) works
like this:

1. The client generates one key per **logical operation** (a UUID) and sends it with every attempt of it.
2. The server stores the key, a **fingerprint** of the request (a hash of method, path and body) and, once done,
   the **response** (status + body); a repeat with the same key and fingerprint gets that stored response.

| Situation | Response (draft-07) |
|---|---|
| key required but missing | **400** |
| same key, different request body | **422** |
| same key, first request still in progress | **409** (the client retries later) |
| same key, first request completed | the stored status and body, replayed |

- **Scope** keys per client or tenant (`{tenant}:{key}`) — two clients' UUIDs must never collide into one result.
- **Expiry**: publish it (typically 24 hours) — long enough for every retry path, short enough to keep the table
  small.
- **What to store**: the final outcome, including a 4xx the request earned. A failure that happened *before any
  effect* (a 5xx from a dependency before the write) may be released so a retry can run — decide and document it.
- **Where to store** it: in the same transaction as the effect, or it's a new dual write — the storage side is
  [distributed-data-patterns.md](distributed-data-patterns.md) → Deduplication and idempotency keys and
  [saas-patterns.md](saas-patterns.md) → Idempotency.
- **Natural idempotency** is simpler when it fits: `PUT /orders/{clientChosenId}` creates once and replaces
  after.

## Concurrency — ETag and If-Match

Two clients read an order, both edit, both save: the second silently overwrites the first (a lost update). HTTP
has optimistic concurrency built in:

```http
GET /orders/ord_8f3k2m            →  200, ETag: "v7"
PATCH /orders/ord_8f3k2m
If-Match: "v7"                    →  200, ETag: "v8"      (nobody changed it)
                                  →  412 Precondition Failed  (someone did: re-read, merge or ask the user)
```

- The ETag is a version (a row version counter or a hash of the representation). `If-Match` uses **strong**
  comparison (RFC 9110) — don't compare weak (`W/"…"`) ETags there.
- Return **428 Precondition Required** (RFC 6585) when a write arrives *without* `If-Match` on a resource where
  lost updates matter — otherwise clients will simply omit it.
- `If-None-Match: *` on a `PUT` means "create only if it doesn't exist" — 412 if it does.
- A body field (`"version": 7`) is an acceptable alternative for clients that can't set headers — one mechanism
  per API.

The database side (`UPDATE … WHERE version = :expected`) is in
[distributed-data-patterns.md](distributed-data-patterns.md) → Locking and concurrency control.

## Rate limits

- Over the limit → **429 Too Many Requests** (RFC 6585) with **`Retry-After`** (RFC 9110: delay-seconds or an
  HTTP-date) and a problem body. Overload that isn't the client's fault → **503** with `Retry-After`.
- **Tell clients where they stand.** The IETF RateLimit fields draft (`draft-ietf-httpapi-ratelimit-headers`,
  draft-11 of May 2026, not yet an RFC) defines two structured fields:

  ```http
  RateLimit-Policy: "burst";q=100;w=60, "daily";q=1000;w=86400
  RateLimit: "burst";r=12;t=41
  ```

  (`q` quota, `w` window in seconds, `r` remaining, `t` seconds until reset.) Earlier drafts and many APIs use
  `RateLimit-Limit` / `-Remaining` / `-Reset` or the `X-RateLimit-*` family. Pin the version you implement and
  document it.
- **Limit per identity** (API key, OAuth client, tenant), not only per IP; publish the limits per plan; clients back
  off with jitter and honour `Retry-After`. Algorithms and layering: [saas-patterns.md](saas-patterns.md) → Rate Limiting.

## Long-running operations

When work takes longer than a request should (an export, a video transcode, a bulk import):

```http
POST /exports                       →  202 Accepted
                                       Location: /operations/op_51x
                                       Retry-After: 5
GET /operations/op_51x              →  200 {"id": "op_51x", "status": "running", "progress": 0.4}
GET /operations/op_51x              →  200 {"id": "op_51x", "status": "succeeded",
                                            "result": {"href": "/exports/exp_9a"}}
```

- **202 Accepted** means accepted for processing, not done (RFC 9110). The **status resource** carries `status`
  (`pending` · `running` · `succeeded` · `failed` · `cancelled`), optional `progress`, and the `result` link or a
  problem-details `error`. `Retry-After` on each status response paces the polling; a completion webhook spares
  clients minutes of it; `Prefer: respond-async` (RFC 7240) lets a client ask for async explicitly.
- The start is **idempotent** (an Idempotency-Key), cancelling is **explicit** (`POST /operations/{id}:cancel`), and
  finished operations have a stated **retention**.

## Partial responses and field selection

`?fields=id,status,total` (or a field mask) trims payloads for mobile and list views; unknown names → 400.
`?expand=customer` embeds a related resource to save a round trip — bound its depth and authorize each expanded
resource separately. Caches key on the selection and ETags are per representation. Field selection is **not**
authorization: a field the caller may not see is never returned, asked for or not.

## Batch endpoints

Use them when clients would otherwise make hundreds of calls (bulk import, sync).

| Decision | Options |
|---|---|
| Atomicity | **all-or-nothing** (one transaction; simple for clients; bounded size) or **per-item** results (partial success) |
| Response | 200 with a per-item array: `{"results": [{"index": 0, "status": 201, "id": "…"}, {"index": 1, "status": 422, "error": {…}}]}` — 207 Multi-Status is WebDAV's code (RFC 4918), which some APIs borrow |
| Limits | a documented maximum item count and body size (413 above it) |
| Idempotency | a key for the batch, or per item — a retried batch must not re-create the items that succeeded |
| Large batches | turn them into a long-running operation |

---

## Webhooks

Webhooks are an API **you call**, so every rule above applies in reverse.

**Sending**

- **Sign every delivery.** The Standard Webhooks specification (an open, vendor-neutral spec) is a good default:
  headers `webhook-id`, `webhook-timestamp`, `webhook-signature`; the signature is HMAC-SHA256 over
  `{id}.{timestamp}.{body}` (`v1,<base64>`). Support **two active secrets** during rotation.
- **At-least-once, with retries** over hours to days with exponential backoff; treat anything but 2xx as a
  failure; respect **410 Gone** as "disable this endpoint"; throttle on 429.
- A stable **event ID** per event (receivers deduplicate on it) and an event `type`; **ordering is not
  guaranteed** — include a timestamp or version so receivers can discard stale events.
- **Thin or fat payloads**: a thin event (`{"type": "order.shipped", "id": "ord_…"}`) makes the receiver fetch
  the current state (always fresh, one more call); a fat one carries the data (fewer calls, versioned payloads,
  more data exposure).
- **Publish from an outbox**, never inline in the request that changed the state
  ([distributed-data-patterns.md](distributed-data-patterns.md) → Transactional outbox).
- **Customer-supplied URLs are an SSRF vector**: allow-list schemes, resolve and block private / link-local
  ranges, don't follow redirects blindly ([security-track.md](security-track.md) → A10).

**Receiving**

- Verify the signature over the **raw bytes** of the body (before any JSON parsing), with a constant-time
  comparison, and reject timestamps outside a tolerance window (replay protection).
- **Acknowledge fast** (2xx within a few seconds), then process asynchronously — a slow receiver gets retried and
  processes the same event twice.
- **Idempotent receiver**: record the event ID in the same transaction as its effect (the inbox pattern,
  [distributed-data-patterns.md](distributed-data-patterns.md) → Inbox / idempotent consumer).

## Auth scopes at the contract level

- Declare the security schemes and the **scopes per operation** in the contract (OpenAPI `security`
  requirements), so clients, docs and tests read the same list.
- Name scopes `resource:action` (`orders:read`, `orders:write`) — coarse enough to grant, fine enough to limit.
- **401** for missing or invalid credentials (with `WWW-Authenticate`), **403** for a valid token without the
  scope (`error="insufficient_scope"`, RFC 6750).
- Scopes say *what kind* of call a client may make, never *which records*: **object-level authorization** —
  this user may touch this order — is checked on every request
  ([security-track.md](security-track.md) → Authentication & Authorization).
- Adding a required scope to an existing operation is a breaking change (item 7 above).

---

## Contract-first or code-first

| | Contract-first | Code-first |
|---|---|---|
| Source of truth | the OpenAPI / proto / GraphQL schema file, reviewed before code | annotations in the handlers; the schema is generated |
| Strength | the contract is designed and approved like a spec; clients and mocks start in parallel | no drift between code and schema by construction |
| Risk | code drifts from the file — validate responses against it in tests | the contract becomes whatever the code happens to do; breaking changes slip in through refactors |
| Fits | public and partner APIs; several client teams | internal APIs with one owner, prototypes |

Either way, **the generated or hand-written contract file is committed**, reviewed in every change that touches
it, and diffed against the previous version. OpenAPI 3.1 aligns its schemas with JSON Schema 2020-12; lint the
file with an OpenAPI linter and your house rules (naming, error responses on every operation, pagination
parameters on every list).

## Contract tests — run locally

| Test | What it catches | How |
|---|---|---|
| **Schema diff** | a breaking change in the contract file | compare the contract at the merge base with the working copy using an OpenAPI diff tool (e.g. `oasdiff`), `buf breaking` for protobuf, a GraphQL schema diff (e.g. `graphql-inspector`); fail on any breaking item unless the version changed |
| **Response validation** | code that drifted from the contract | integration tests validate every response body and status against the schema |
| **Consumer-driven contracts** | a provider change that breaks a *real* consumer's usage | each consumer records the requests it makes and the fields it reads (Pact-style); the provider replays them in its own test run |
| **Negative contract tests** | missing error paths | every documented error (`type` / `code`) has a test that provokes it |

A task that changes an endpoint carries the checks as its evidence:

```markdown
- [ ] 4. [US1] Add cursor pagination to GET /orders
  - _Requirements: US-1.AC-4, US-1.AC-5_
  - _Implements: api/openapi.yaml, src/orders/list-orders.ts_
  - _Verify: npm run api:diff && npm test -- tests/contract/orders.test.ts_
```

`api:diff` is a script in your project that runs the diff tool against the merge base; nothing here needs a
hosted service.

## SDK and client concerns

- **Generated** from the contract, configured as tolerant readers (unknown fields and enum values accepted).
- **Retries built in**: one Idempotency-Key per logical call, reused on every retry; backoff with jitter;
  `Retry-After` honoured. **Timeouts by default** — an SDK without one hangs its caller.
- **Pagination helpers** (iterate all pages), so clients don't reimplement cursors wrongly.
- **Semver tied to the API** (a breaking API version is a major SDK version), and the SDK named in `User-Agent`
  (`acme-sdk-js/3.2.0`) — it tells you who still calls a deprecated operation.

---

## GraphQL notes

- **Evolve, don't version.** Add fields; deprecate old ones with `@deprecated(reason: "Use total instead.")`. In
  the September 2025 specification `@deprecated` applies to fields, arguments, input fields and enum values; a
  **required** argument or input field must first be made optional (nullable or defaulted).
- **Nullability is a compatibility decision.** Output field nullable → non-null is safe for clients;
  non-null → nullable breaks them. Input arguments are the reverse: optional → required breaks callers,
  required → optional is safe.
- **Errors propagate up through non-null positions**: a resolver error in a non-null field nulls its parent (and
  further up while the parents are non-null). Keep fields that depend on other services **nullable**, or one
  failing dependency blanks the whole response.
- **Errors** go in the `errors` array with a stable `extensions.code`; a partial response with errors is still
  HTTP 200 — don't let clients rely on the status alone.
- **Pagination**: cursor connections (`edges`, `node`, `pageInfo { hasNextPage endCursor }`), with a maximum `first`.
- **Cost limits**: depth and complexity limits, and persisted (allow-listed) queries for first-party clients — an
  open GraphQL endpoint lets clients write expensive queries you never planned.
- **Authorization per field / type**, not per endpoint: there is only one endpoint.

## gRPC and protobuf notes

- **Field numbers are forever.** Never reuse a removed field's number or name — mark them `reserved`:

  ```proto
  message Order {
    reserved 4, 7;                 // removed fields: their numbers can never come back
    reserved "legacy_total";
    string id = 1;
    OrderStatus status = 2;
    Money total = 3;
  }
  enum OrderStatus {
    ORDER_STATUS_UNSPECIFIED = 0;  // the zero value: what an unset or unknown status reads as
    ORDER_STATUS_PENDING = 1;
    ORDER_STATUS_SHIPPED = 2;
  }
  ```

- **Don't change a field's type**, don't go from `repeated` to scalar, don't change defaults, don't add
  `required` fields; reserve deleted enum numbers too. Renaming a field keeps the binary format working but
  breaks the JSON mapping and text format. Moving fields into an existing `oneof` is not safe — check the
  language guide before any `oneof` change.
- **Enums start at `*_UNSPECIFIED = 0`**, and receivers must handle numbers they don't know.
- **Version in the package** (`acme.orders.v1`) and run `buf breaking` against the previous version locally.
- **Deadlines on every call**, propagated downstream. Map outcomes to the canonical status codes
  (`INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `FAILED_PRECONDITION`, `ABORTED` for concurrency conflicts,
  `RESOURCE_EXHAUSTED` for rate limits, `UNAVAILABLE` for retriable failures) and put a stable reason in the
  richer error model (`google.rpc.Status` details such as `ErrorInfo`), the gRPC twin of the problem `code`.

---

## "Breaking change?" — decision table

| Change | Breaking? | Do instead / condition |
|---|---|---|
| Add an endpoint or operation | No | — |
| Add an optional request field | No | its absence keeps today's behaviour |
| Add a required request field | **Yes** | optional with a default; require it in the next major version |
| Add a response field | No | clients are tolerant readers (test it) |
| Remove or rename a response field | **Yes** | add the new field, deprecate the old, remove at sunset |
| Change a field's type, format or unit | **Yes** | a new field (`totalMinor`), deprecate the old |
| Add an enum value | Depends | No if the enum was documented open; otherwise **yes** — announce and give a fallback |
| Tighten validation | **Yes** | only in a new version; first log how many requests would fail |
| Relax validation | Usually no | check what the relaxed values do to responses |
| Change a default | **Yes** | a new parameter with the new default |
| Change an error `type` / `code` / status | **Yes** | add new codes only for new conditions |
| Change ordering or page size default | **Yes** if documented — often in practice even if not | document the order from day one; clients rely on what they observe |
| Make a field nullable / optional | **Yes** | keep it present; add a new field if the value can be missing |
| New required scope | **Yes** | grant it to existing clients first, then require it |
| New side effect | **Yes** | a new operation or an opt-in parameter |
| Lower a rate limit | Usually **yes** | announce with notice; per-plan exceptions |
| Protobuf: reuse a field number | **Yes, silently** | `reserved`; always a new number |
| GraphQL output: non-null → nullable | **Yes** | a new nullable field |
| GraphQL input: optional → required | **Yes** | keep optional with a default |

---

## Design checklist

Before the design gate, the design names:

1. **Kind and consumers** — public, partner, internal or BFF; who calls it, and how fast they can change.
2. **Resources and operations** — nouns, paths, methods (safe / idempotent), custom actions; case, IDs,
   timestamps (RFC 3339 UTC), money, open enums, null vs absent.
3. **Versioning** — the strategy and what triggers a new version, recorded as a decision; every change in this
   feature checked against the breaking list; the schema diff in a `_Verify:_` or a project check.
4. **Deprecations** — `Deprecation` / `Sunset` / `Link` headers, usage per client, 410 after the sunset.
5. **Errors** — problem+json everywhere, stable codes, validation errors with pointers, no internals, the status
   code rules.
6. **Lists** — cursor or offset (and why), a stable order with a tie-breaker, page size default and maximum, the
   total-count policy, the filter / sort allow-list and the index behind each.
7. **Retries and races** — which POSTs take an Idempotency-Key (scope, expiry, fingerprint, 400 / 409 / 422, where
   it is stored); ETag + If-Match (412), 428 when it is missing.
8. **Limits** — rate limits per identity (429 + `Retry-After`, the headers you send), payload and batch sizes.
9. **Long-running work and webhooks** — 202 + status resource, cancellation, retention; signing, rotation,
   retries, event IDs, SSRF protections, idempotent receivers.
10. **Auth** — schemes and scopes per operation; object-level authorization (with `+sec`).
11. **The contract artifact** — contract-first or code-first, the file in `_Implements:_`, linted; tests: schema
    diff, response validation, consumer contracts, one negative test per documented error.
12. **Clients** — SDK retries, timeouts, pagination helpers, tolerant parsing, a user agent.
13. **GraphQL / gRPC** — nullability, deprecation, cost limits; reserved field numbers, deadlines, status codes.

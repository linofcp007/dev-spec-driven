# Load Testing Patterns

Load testing isn't optional for hot-path features in production SaaS. A feature that
passes all its unit/integration tests but folds under 200 concurrent users is broken in
a way that doesn't show up until it's too late.

This document covers: what scenarios to run, how to interpret results, and k6 templates
you can adapt.

## When Is Load Testing Required?

From the classification in `classification-matrix.md`, load test is required for any
feature on a **hot path**:
- Called on every request or very frequently (>10k/day/tenant)
- On a critical user journey (signup, checkout, main dashboard, upload)
- Anything user-facing where a regression means "users notice"

Also strongly recommended (even if not strictly hot path):
- Any new query against a large table
- Any cache change (cache miss patterns under load are unpredictable)
- Any change to rate limiting logic
- Any external API integration (your third party may be the bottleneck)

## The Four Scenarios

Every load test file should define these four scenarios. Not all are run every time —
pick what's relevant — but the template exists.

### 1. Steady State

Simulate normal expected production load sustained over time. Answers: "Does this meet
the performance budget under expected load?"

- Duration: 10–30 minutes
- VUs (virtual users): target concurrent users at peak hour
- Expected outcome: P95 latency stays flat, error rate ~0, resource utilization stable

### 2. Burst (Spike)

Simulate a sudden traffic spike (e.g., marketing campaign launch, viral moment).
Answers: "Does the system handle a 5–10× spike gracefully or melt?"

- Duration: 10 min ramp-up, 5 min at peak, 10 min ramp-down
- VUs: 5–10× steady state
- Expected outcome: System may slow (latency up) but doesn't error out cascade. Rate
  limiters engage. No cascading failures (DB overload → more retries → more DB load).

### 3. Soak (Endurance)

Sustained load over hours. Answers: "Are there memory leaks, connection leaks, or slow
resource degradation that take time to surface?"

- Duration: 2–4 hours minimum
- VUs: 50–80% of steady state
- Expected outcome: P95 latency stays flat over the full duration. No memory creep,
  no file descriptor exhaustion, no connection pool starvation.

### 4. Breakpoint (Stress)

Gradually increase load until the system breaks. Answers: "What's our actual ceiling and
what breaks first?"

- Duration: ramp up from 0 to 10× expected peak over 30 min
- Expected outcome: Knowing the failure mode. DB CPU? App CPU? Memory? Connection pool?
  Third-party rate limit? Whatever breaks first is your next bottleneck to fix.

---

## What to Measure

Every load test must capture:

1. **Latency distribution** — P50, P95, P99 for each endpoint tested (not just the
   average — the average hides everything)
2. **Throughput** — requests/sec actually achieved
3. **Error rate** — 4xx (client), 5xx (server), timeouts, connection errors
4. **Resource utilization** — CPU, memory, DB connections, Redis connections, worker
   queue depth — on every tier (app, DB, cache, workers)
5. **Downstream impact** — if the test hits a third party, check if you're being rate
   limited by them (watch for 429s from upstream)

Compare against the **performance budget** from `design.md`. If any metric is worse than
budget, the test fails and the feature isn't done.

---

## k6 Template (Steady State)

```javascript
// load-test-steady.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics to surface alongside standard http metrics
const errorRate = new Rate('errors');
const uploadInitiateDuration = new Trend('upload_initiate_duration');

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-vus',
      vus: 200,              // 200 concurrent "guests"
      duration: '10m',
    },
  },
  thresholds: {
    // Pulled from design.md performance budget
    'http_req_duration': ['p(95)<1200', 'p(99)<2500'],
    'errors': ['rate<0.01'],     // <1% errors tolerated
    'upload_initiate_duration': ['p(95)<800'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://staging.example.com';
const EVENT_IDS = JSON.parse(open('./event-ids.json')); // pre-seeded test events

export default function () {
  const eventId = EVENT_IDS[Math.floor(Math.random() * EVENT_IDS.length)];

  // 1. Land on upload page (simulates QR scan)
  const pageRes = http.get(`${BASE_URL}/events/${eventId}/upload`);
  check(pageRes, { 'page loaded': (r) => r.status === 200 });
  errorRate.add(pageRes.status !== 200);

  sleep(Math.random() * 2 + 1); // user takes 1-3s to tap upload

  // 2. Initiate upload
  const payload = {
    filename: `photo-${Date.now()}.jpg`,
    bytes: Math.floor(Math.random() * 5_000_000) + 500_000, // 500KB-5MB
    mime_type: 'image/jpeg',
  };
  const initiateStart = Date.now();
  const initRes = http.post(
    `${BASE_URL}/api/events/${eventId}/uploads/initiate`,
    JSON.stringify(payload),
    { headers: { 'Content-Type': 'application/json' } }
  );
  uploadInitiateDuration.add(Date.now() - initiateStart);
  check(initRes, { 'initiate 200': (r) => r.status === 200 });
  errorRate.add(initRes.status !== 200);

  // Don't actually upload bytes to R2 in load test (that's testing R2, not our system).
  // Instead, call the webhook directly to simulate upload completion.
  if (initRes.status === 200) {
    const { upload_id } = initRes.json();
    const webhookRes = http.post(
      `${BASE_URL}/webhooks/r2/upload-complete`,
      JSON.stringify({
        upload_id,
        storage_key: `test/${upload_id}`,
        bytes: payload.bytes,
      }),
      { headers: {
        'Content-Type': 'application/json',
        'X-R2-Signature': __ENV.TEST_WEBHOOK_SIG,
      } }
    );
    check(webhookRes, { 'webhook 200': (r) => r.status === 200 });
  }

  sleep(Math.random() * 5 + 2); // user between actions
}
```

Run it:

```bash
BASE_URL=https://staging.example.com \
TEST_WEBHOOK_SIG=test-signature \
k6 run load-test-steady.js
```

---

## k6 Template (Burst)

```javascript
export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10m', target: 200 },   // warm up to steady
        { duration: '1m', target: 200 },    // steady baseline
        { duration: '30s', target: 1500 },  // SPIKE to 7.5x
        { duration: '5m', target: 1500 },   // hold at spike
        { duration: '2m', target: 200 },    // recover
        { duration: '5m', target: 200 },    // verify recovered
      ],
    },
  },
  thresholds: {
    // During spike, P95 can degrade but shouldn't collapse
    'http_req_duration': ['p(95)<3000'],   // 2.5x budget acceptable during spike
    'http_req_failed': ['rate<0.05'],      // up to 5% failures acceptable during spike
  },
};
```

What to look for in the results:
- **During spike:** latency goes up (expected), error rate stays bounded, rate limiter
  engages and returns 429s (not 5xxs — those mean your infra broke)
- **After spike:** latency returns to baseline within 2 minutes. If not, you have a
  recovery problem (queue backlog that takes hours to drain, memory leak, etc.)

---

## k6 Template (Soak)

Same as steady state but duration `4h` and VUs `150` (75% of peak).

**What you're looking for:** Trend in latency over time. If P95 is 400ms at hour 1 and
1200ms at hour 4, you have a slow degradation — usually a connection leak, memory leak,
or cache poisoning.

Capture metrics every minute during the soak:
- P50/P95/P99 latency
- Memory utilization (app pods + DB + Redis)
- Connection count (DB, Redis)
- File descriptors (app pods)

Plot all five over time. Flat lines = healthy. Upward trends = leak.

---

## k6 Template (Breakpoint)

```javascript
export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30m', target: 2000 },  // ramp 0 → 10x expected peak
      ],
    },
  },
  // NO thresholds — we want to see where it breaks
};
```

When system starts erroring, that's your ceiling. Capture:
- What's the RPS at the moment errors cross 5%?
- What resource saturates first (DB CPU? App CPU? Connection pool?)
- What's the failure mode (graceful degradation with 429s or cascading 5xxs)?

That number is your capacity plan. If expected peak is 500 RPS and breakpoint is 800 RPS,
you have 1.6× headroom — thin. Either scale out or optimize.

---

## Running Load Tests in CI

Full load tests don't belong in PR CI (too slow, too expensive). But **smoke load tests**
do: a 2-minute steady-state run against staging that verifies P95 hasn't regressed.

Run full load suite:
- **Before any major release**
- **Weekly** on main branch
- **After changes to any hot-path feature**

Store results in a time-series DB (Prometheus, InfluxDB, or a CSV in object storage) so
you can plot "has our P95 on endpoint X drifted over 6 months?".

---

## Load Test Environment

**Staging must mirror production shapes**, not scale. You don't need prod-scale infra to
load test, but you need:
- Same DB engine and version
- Same cache config
- Same worker config
- Realistic data volumes (a full table scan is fine at 10K rows and catastrophic at 10M —
  seed your load-test DB to match prod order of magnitude)
- Realistic tenant distribution (not one fat test tenant with all data)

Seed script for load testing should be in the repo, versioned. Run it before every load
test to reset state.

---

## Interpreting Results: The Common Failure Modes

### Mode 1: "P95 is fine, P99 is terrible"

Tail latency usually means: a slow query path that's hit infrequently but hard when it
hits. Common culprits:
- Missing index for an occasional query pattern
- Garbage collection pauses
- Cold cache on first hit

### Mode 2: "Latency climbs slowly over the test"

Almost always a leak:
- Connection pool filling up (idle connections not released)
- Memory growing (retained objects, cache without eviction)
- Queue depth growing faster than workers can drain

### Mode 3: "Cliff — system works, then suddenly falls apart"

Resource limit hit: CPU saturation, DB connection exhaustion, disk I/O saturation. Infra
was handling load until the moment it couldn't, and then fell off a cliff.

### Mode 4: "Errors spike but latency is fine"

Rate limiter doing its job (return 429 fast instead of queuing requests), OR a downstream
is already broken and you're fast-failing through a circuit breaker.

### Mode 5: "Works on app tier, breaks on DB"

Hot query. Add index, cache, or denormalize. Or missing `LIMIT` on a user-controlled
query.

---

## `load-test.md` Template

For each hot-path feature, create `.specs/[feature]/load-test.md`:

```markdown
# Load Test: [Feature Name]

## Scenario: Steady State
**Target:** Simulate 200 concurrent guests uploading over 10 minutes.
**Expected budget (from design.md):**
- P95 page load < 1200ms
- P95 upload initiate < 800ms
- Error rate < 1%
- Memory stable, no upward trend

**Script:** `load-tests/guest-upload-steady.js`

## Scenario: Burst
**Target:** 10× spike from 200 to 2000 VUs over 30 seconds, hold 5 min.
**Expected:** Rate limiter engages, some 429s (not 5xx). Recovery within 2 min after
spike ends.

**Script:** `load-tests/guest-upload-burst.js`

## Scenario: Soak
**Target:** 150 VUs for 4 hours.
**Expected:** P95 latency flat over 4h (±10%). No memory leak. No connection leak.

**Script:** `load-tests/guest-upload-soak.js`

## Scenario: Breakpoint
**Target:** Ramp to 10× peak over 30 min.
**Purpose:** Find ceiling. Document result in this file after each run.

**Script:** `load-tests/guest-upload-breakpoint.js`

## Results Log

### Run 2026-04-15 (before feature ship)
- Steady: P95=980ms ✅, P99=2100ms ✅, errors 0.3% ✅
- Burst: Handled 1500 VUs spike with 2.1% errors (all 429s), recovered in 90s ✅
- Soak: Stable over 4h, memory flat ✅
- Breakpoint: Broke at ~1800 RPS (DB CPU 95%). Current expected peak ~300 RPS, so 6×
  headroom. Acceptable.
- **Decision:** Ship.

### Run 2026-05-20 (after cache layer changes)
- Steady: P95 = 1150ms ⚠️  (regressed 17%)
- Root cause: new query missing index on (event_id, status)
- Fix: PR #1234 adds index
- Rerun: P95 = 850ms ✅ Ship.
```

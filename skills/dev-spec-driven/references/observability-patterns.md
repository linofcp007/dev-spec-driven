# Observability Patterns — SLOs, signals, alerts and safe delivery

A feature is done when it works in production **and** the team can tell when it stops working, why, and how to
get it back. Without that, the first sign of a broken checkout is a customer email, the first question in the
incident is "what changed?", and the rollback is improvised. This reference covers operability as part of the
spec: service level objectives and error budgets, burn-rate alerts, metrics, logs and traces, health checks,
alerting and runbooks, dashboards, feature flags, progressive delivery, migrations that can be rolled back,
capacity signals, incident response, and how to test all of it before a real incident does.

It is the reference for the `+obs` track and for any feature that runs as a service, a worker or a scheduled job.
It builds on the `observability.md` steering stub ([steering-templates.md](steering-templates.md)), which holds the
team-wide defaults; this file holds the reasoning and the per-feature decisions.

See also: [distributed-data-patterns.md](distributed-data-patterns.md) (outbox and consumer lag, context across
queues, expand / contract migrations), [saas-patterns.md](saas-patterns.md) (circuit breakers, queues, tenant
labels), [privacy-track.md](privacy-track.md) (personal data in logs and traces),
[security-track.md](security-track.md) (audit logs, secrets), [load-testing-patterns.md](load-testing-patterns.md)
(capacity), [api-design-patterns.md](api-design-patterns.md) (request IDs in error bodies, rate limits),
[ui-design-patterns.md](ui-design-patterns.md) (real-user performance metrics).

---

## Where the decisions go in a spec

- **requirements.md** — operability is behaviour with users on the other end:

  ```markdown
  1. **US-3.AC-1** — WHILE the payment provider is unavailable, THE SYSTEM SHALL accept orders as pending and
     complete them within 15 minutes of the provider's recovery.
  2. **US-3.AC-2** — THE SYSTEM SHALL include the trace ID in every log line and in every error response body.
  3. **NFR-1** — THE SYSTEM SHALL complete 99.5% of valid checkout requests successfully in under 800 ms,
     measured over a rolling 28 days.
  ```

- **design.md** — the SLIs and SLOs, the alerts and their runbooks, the metrics / logs / spans the feature emits,
  health checks, flags, the rollout and rollback plan, the migration steps.
- **Tasks** — `_Emits metrics:_` names the metrics a task must produce (the implementer's report shows them
  emitting); a runbook is a file a task writes; the fault-injection test is a task with a `_Verify:_`.
- **Steering** — `observability.md` for the conventions (log fields, metric naming, label rules, sampling, alert
  tiers); per-feature numbers belong in the spec, not there.

---

## SLIs, SLOs and error budgets

- **SLI** (indicator) — a measurement of the service as users experience it, expressed as
  `good events / valid events` (a ratio from 0 to 100%).
- **SLO** (objective) — a target for an SLI over a window: "99.9% of valid checkout requests succeed, over a
  rolling 28 days".
- **Error budget** — `1 − SLO`: the unreliability you are allowed. It turns reliability into a number both
  product and engineering can spend.

**Choosing the SLI** — the SRE workbook's menu:

| Service type | SLI | Good event |
|---|---|---|
| Request / response | **availability** | a valid request answered without a server error |
| | **latency** | a valid request answered faster than a threshold (one SLO per threshold: p90 < 300 ms, p99 < 1 s) |
| | **quality** | a response not degraded (full results, not the cached fallback) |
| Data pipeline | **freshness** | data updated within X minutes |
| | **correctness** | output records that are right (checked by a sampling job) |
| | **coverage** | input records processed |
| Storage | **durability** | data written that can be read back |

Rules that keep an SLI honest:

- **Measure as close to the user as you can** — the load balancer or the client, not the handler (a crashed
  handler reports nothing). Each step inward is easier to measure and less true.
- **Define "valid"**: a 4xx caused by the client usually isn't a failure of the service; a 429 you sent because
  your own limit was misconfigured is. Write the exclusions down.
- **Latency SLIs are thresholds, not averages** — "95% under 300 ms" survives a long tail; "mean 120 ms" hides it.
- **Few SLOs per service** (one to three user journeys); each one needs an owner and an alert.

**Picking the target and window.** A rolling window (typically 28 or 30 days) smooths weekly cycles. Start from
what the service achieves today and what users notice — never 100%, which no dependency you rely on offers.

| SLO | Budget per 30 days (full-outage equivalent) |
|---|---|
| 99% | 7.2 hours |
| 99.5% | 3.6 hours |
| 99.9% | 43.2 minutes |
| 99.95% | 21.6 minutes |
| 99.99% | 4.32 minutes |

**An error-budget policy**, agreed before it's needed: what happens when the budget is spent — typically a
freeze on risky releases (only fixes and reliability work) until the budget recovers, and a post-incident review
for any single incident that consumed a large share of it.

---

## Burn-rate alerts

**Burn rate** is how fast the service consumes its error budget relative to the SLO: a burn rate of **1** spends
exactly the whole budget over the window; **14.4** spends a 30-day budget in about two days. Alerting on burn
rate pages for things that threaten the SLO and stays quiet for blips that don't.

The SRE workbook's recommended **multi-window, multi-burn-rate** starting point, for a 99.9% SLO over 30 days:

| Severity | Long window | Short window | Burn rate | Budget consumed when it fires |
|---|---|---|---|---|
| **Page** | 1 hour | 5 minutes | 14.4 | 2% |
| **Page** | 6 hours | 30 minutes | 6 | 5% |
| **Ticket** | 3 days | 6 hours | 1 | 10% |

- An alert fires only when **both** windows exceed the burn rate: the long window proves it is significant, the
  short window (typically 1/12 of the long one) proves it is **still happening** — so the alert resets soon after
  the problem stops.
- The threshold is `burn rate = budget fraction × SLO window / alert window` (2% × 720 h / 1 h = 14.4).
- As an expression, for the first row (error ratio = bad / valid over the window):

  ```text
  error_ratio[1h] > 14.4 × 0.001   AND   error_ratio[5m] > 14.4 × 0.001   →  page
  ```

- **Low-traffic services** make ratios jumpy (one failure in ten requests is 10%). The workbook's options:
  synthetic traffic, grouping small services into one SLO, or changing what counts as a failure.
- Keep the table's figures as a starting point and tune with your own history: an alert that fires without a
  problem, or a real problem that fired nothing, is data for the next revision.

---

## Metrics

| Method | For | Signals |
|---|---|---|
| **RED** (Tom Wilkie) | request-driven services | **R**ate, **E**rrors, **D**uration |
| **USE** (Brendan Gregg) | resources — CPU, memory, disks, pools, queues | **U**tilization, **S**aturation, **E**rrors |
| **Four golden signals** (Google SRE book) | any user-facing system | latency, traffic, errors, saturation |

- **Histograms for durations**, never only an average. Percentiles **cannot be averaged** across instances or
  time buckets — aggregate the histogram buckets, then compute the percentile.
- **Names with units** (`http_server_request_duration_seconds`, `queue_depth_messages`); counters as totals.
  The OpenTelemetry instruments: counter, up-down counter, histogram, gauge, and their asynchronous (observable)
  variants.
- **Cardinality is the cost.** Every distinct label combination is a separate time series. Labels must be
  **bounded**: the route template (`/orders/{id}`), never the raw path; a status class, a method, a region. Never
  a user ID, email, request ID, raw URL or error message as a label. A tenant label only with a bound (the top N
  tenants, the rest aggregated — [saas-patterns.md](saas-patterns.md) → Tenant Context Propagation).
- **One business metric per feature** (orders placed, exports completed): technical metrics can be green while
  the business flow is broken.
- **Exemplars** attach a trace ID to a histogram sample, so a latency spike on a dashboard opens the slow trace.
- Lag metrics for asynchronous work — the age of the oldest unpublished outbox row, consumer lag, DLQ depth
  ([distributed-data-patterns.md](distributed-data-patterns.md) → Transactional outbox).

---

## Structured logs

- **JSON, one event per line**, with a fixed set of fields: `timestamp` (RFC 3339, UTC), `level`, `service`,
  `version`, `environment`, `trace_id`, `span_id`, an `event` name (`order_payment_failed`) and a short `message`.
  Feature fields are namespaced (`order.id`, `payment.provider`).
- **Levels mean something**: `ERROR` — an operation failed and someone may need to act; `WARN` — degraded but
  handled (a retry succeeded, a fallback served); `INFO` — lifecycle and business events worth keeping; `DEBUG` —
  off in production by default.
- **Log once, where the error is handled** — not at every layer it passes through (five stack traces of one
  failure), and never "log and rethrow" as a habit.
- **Correlate**: the trace ID in every line (the logging library reads it from the active span) and in every error
  response body, so a user's report leads to the exact log lines.
- **Never log**: passwords, tokens, API keys, session cookies, authorization headers, full card numbers, secrets
  of any kind ([security-track.md](security-track.md) → US-1.AC-12), and personal data the purpose doesn't need.
  Logs are a data store: they appear in the personal-data inventory, have a retention period and must be reached
  by erasure — or hold only pseudonymous IDs ([privacy-track.md](privacy-track.md)).
- **Redact at the logger**, not at each call site: an allow-list of fields per event, or a redaction processor for
  known keys (`password`, `authorization`, `token`) — and a test that forces an error and asserts no secret
  reached the output.
- **Audit logs are a separate stream** (who did what to which record, append-only, longer retention) — don't mix
  them with operational logs that get sampled and expire.

---

## Distributed tracing — OpenTelemetry

A trace is a tree of **spans** (one unit of work each) sharing a trace ID. Span kinds say which side of a call a
span is: `SERVER` / `CLIENT` for a synchronous call, `PRODUCER` / `CONSUMER` for messaging, `INTERNAL` for work
inside a process.

- **Use the semantic conventions** so every tool reads your spans the same way. The HTTP conventions are stable:
  `http.request.method`, `http.route`, `http.response.status_code`, `url.path`, `server.address`, `error.type`;
  a server span is named `{method} {route}` (`GET /orders/{id}`). On a server span a **5xx** sets the status to
  Error; a **4xx** leaves it unset (the client's error, not the server's). Older instrumentation used other names
  (`http.method`, `http.status_code`); `OTEL_SEMCONV_STABILITY_OPT_IN` lets libraries emit both during a
  migration. Other areas (messaging among them) are still in development — pin the semantic-conventions version
  you follow.
- **Resource attributes** identify the emitter: `service.name`, `service.version`, the environment.
- **Propagate context** across every hop with W3C Trace Context (`traceparent`, `tracestate` headers).
  **Baggage** (the `baggage` header) travels to every downstream service, third parties included — never put
  personal data or secrets in it.
- **Across queues**: the producer injects its context into the message headers; the consumer's processing span
  **links** to that context (a link rather than a parent, which also covers a batch of messages from many
  traces). With an outbox, store the context in the outbox row so the relay's publish continues the original
  trace ([distributed-data-patterns.md](distributed-data-patterns.md)).
- **Manual spans** for meaningful business steps (pricing, fraud check), with attributes that help debugging —
  and the same privacy rules as logs.
- **Sampling**: head sampling (decided when the trace starts, a ratio respecting the parent's decision) is cheap
  but can't know which traces will fail. Keeping **every error and every slow trace** requires tail sampling —
  the decision made after the trace completes, typically in a collector.

---

## Health checks

| Probe | Question | On failure (Kubernetes) | Checks |
|---|---|---|---|
| **Liveness** | is the process stuck beyond recovery? | the container is **restarted** | the process can serve at all (an event loop that answers, no deadlock) — **never a dependency** |
| **Readiness** | should traffic come here right now? | removed from the service's endpoints; **not** restarted | warm-up done, local resources ready, not shutting down |
| **Startup** | has a slow start finished? | liveness and readiness don't run until it succeeds | initialization complete (migrations checked, caches warmed) |

- **A liveness probe that checks the database restarts every replica when the database blips** — a cascading
  failure that turns a dependency's outage into yours. The Kubernetes documentation warns about exactly this.
- A readiness probe that checks a **shared** dependency takes every replica out at once; prefer serving a
  degraded response (the circuit breaker's fallback) and reporting the dependency in metrics.
- A **diagnostic endpoint** that reports each dependency's state is useful for humans — keep it separate from the
  probes, and don't expose it publicly.
- **Graceful shutdown**: on the termination signal, fail readiness, stop accepting new work, finish in-flight
  requests and messages within a deadline, then exit.

---

## Alerting

- **Alert on symptoms, not causes.** Users feel errors and latency, not CPU at 90%. SLO burn-rate alerts are the
  core; cause-based alerts only for things that will become symptoms before anyone notices: a disk projected to
  fill within hours, a certificate expiring in days, a DLQ growing, outbox lag rising.
- **Every page is actionable, urgent and needs a human.** If the right response is "wait and see", it is a ticket
  or a dashboard.

| Route | When | Example |
|---|---|---|
| **Page** (wake someone) | users are affected now, or will be within hours | fast budget burn; checkout failing |
| **Ticket** (next working day) | the budget erodes slowly; a resource trends toward a limit | 3-day burn; disk at 80% and growing |
| **Dashboard only** | context for investigations | CPU, GC pauses, cache hit rate |

- **Every alert has a runbook** — no runbook, no alert. The alert text carries the symptom, the impact, the SLO it
  threatens and links to the runbook and the dashboard.
- **Review alerts** after each on-call rotation: one that fired without action needed is tuned or deleted.

## Runbooks

A runbook is written for someone woken at 3 AM who has never seen this service:

```markdown
# Runbook: checkout-error-budget-fast-burn

**Alert:** checkout availability burning its 30-day budget at > 14.4× (1 h and 5 min windows)
**Impact:** customers can't complete purchases; revenue loss ≈ <n> per minute
**Dashboard:** <link>  ·  **Owner:** payments team  ·  **Escalation:** <rota>

## Triage (first 5 minutes)
1. Was there a deploy in the last hour? → roll back first (below), investigate after.
2. Which step fails? Dashboard "checkout by step" / traces filtered by `error.type`.
3. Is the payment provider degraded? Check its status and the circuit-breaker state.

## Mitigate
- Roll back: `<exact command>`   - Disable the new flow: flag `checkout-v2` → off
- Provider down: orders queue as PENDING (US-3.AC-1); confirm the queue drains after recovery.

## Verify
Error ratio back under 0.1% on the 5-minute window; queue depth falling.

## Afterwards
Timeline in the incident doc; a post-incident review if the budget impact exceeded 5%.
```

## Dashboards

- **One per service**, top-down: the SLOs and remaining budget → the golden signals (traffic, errors, latency
  percentiles, saturation) → each dependency (calls, errors, latency, circuit-breaker state) → the feature's
  business metric.
- **Deploy and flag-change markers** on every graph — "what changed?" is the first incident question.
- Consistent time ranges and units; a small number of graphs someone actually reads under pressure.

---

## Feature flags

Martin Fowler's site (Pete Hodgson) names four kinds, and they are managed differently:

| Kind | Purpose | Lifetime | Who flips it |
|---|---|---|---|
| **Release** | ship unfinished or risky code dark; turn it on progressively | days to weeks — then **remove** | the team |
| **Experiment** | A/B tests, per user or request | as long as the experiment | the experiment framework |
| **Ops** | degrade or switch off behaviour under load or failure; a long-lived one is a **kill switch** | short, or permanent for kill switches | on-call, without a deploy |
| **Permissioning** | features by plan, beta cohort, internal users | long | product / entitlements |

- **Safe defaults**: when the flag service is unreachable, the code falls back to a value written in the code — for
  a release flag, *off*.
- **Test both paths** of every flag while both exist; a flag nobody has turned off in months has an untested path.
- **Flag debt is real**: a release flag gets a removal task when it's created (a converge task or a task in the
  same feature), an owner and an expiry date. Some teams add a test that fails once a flag is past its date, or cap
  the number of live flags.
- **Flags are not authorization** — a permissioning flag decides what the UI offers; the server still checks
  access on every request.
- A vendor-neutral flag API (OpenFeature, a CNCF project) keeps the flag provider replaceable.

## Progressive delivery

| Strategy | How | Good for | Cost |
|---|---|---|---|
| **Rolling** | replace instances in batches | most changes | old and new run side by side — both must work with the same data |
| **Canary** | a small share of traffic to the new version, compared against the old | risky changes with a clear SLI | needs enough traffic to compare; automated analysis |
| **Blue-green** | two full environments, switch traffic at once | fast, whole rollback | double capacity during the switch; shared state still migrates |
| **Dark launch / flag** | code deployed, behaviour off; enabled per cohort | decoupling deploy from release | flag debt |

- **Write the rollback criteria before the deploy**: which SLIs, compared with the baseline, over how long
  (error ratio above the old version's, p99 latency up by more than an agreed margin).
- **Roll back automatically** when the canary burns its error budget faster than the threshold — a canary analysis
  step compares the canary's SLIs to the baseline and aborts.
- **Practise the rollback** — a rollback path that has never run is a guess.

## Migrations and rollbacks

Code rolls back in seconds; data doesn't. Every schema change follows **expand / contract** (also called parallel
change): add the new structure (compatible with the old code) → write both → backfill in resumable batches → read
the new → stop writing the old → drop it, each step its own deploy with a rollback point
([distributed-data-patterns.md](distributed-data-patterns.md) → Large data volumes).

- At every step, **the previous version of the code must run against the current schema** — that's what makes
  the code rollback safe.
- Put the read switch behind a flag, so going back is a flag flip rather than a deploy.
- **Irreversible steps last** (dropping a column, deleting data), after a waiting period, with a backup verified
  by a restore.
- Decide per incident whether to **roll back or roll forward**; after an irreversible step, only forward remains.

---

## Capacity and cost signals

- **Saturation** is the early signal: connection pool usage, queue depth and wait time, thread or worker
  utilisation, memory against the limit, disk growth. Alert on the forecast ("full in 6 hours"), not the level.
- **Know the knee**: the load at which latency rises sharply, found by a load test
  ([load-testing-patterns.md](load-testing-patterns.md)) — the headroom is the distance from today's peak to it.
- **Cost per unit** (per request, per tenant, per export) as a metric, with the budget and its alert in the
  `cost.md` steering file — a feature can meet its SLO and still double the bill.
- Autoscaling reacts to a saturation signal the service actually has (queue depth, concurrency) rather than CPU
  alone, with a maximum that protects the dependencies behind it.

---

## Incident response basics

| Severity (a typical convention) | Meaning | Response |
|---|---|---|
| **SEV1** | a critical journey down, data loss, a security breach | page, an incident lead, status updates to stakeholders at a fixed cadence |
| **SEV2** | major degradation, a workaround exists | page the owning team |
| **SEV3** | minor impact, contained | ticket, fix in working hours |

- **Roles** (from incident-command practice): an **incident lead** who coordinates and decides, an **operations
  lead** who changes things, a **communications lead** who updates users and stakeholders — one person may hold
  several in a small team, but the lead doesn't debug.
- **Mitigate first, fix later**: roll back, flip the flag, shed load, fail over — then find the cause.
- **Keep a timeline** as you go (times, observations, actions); it is the backbone of the review.
- **Blameless review** for every SEV1 / SEV2 and any large budget spend: what happened, impact, timeline,
  contributing factors (systems, not people), what went well, action items with owners. Each action item is a
  spec — a bugfix (`/spec-bugfix`) or follow-up tasks (a converge pass, `spec_append_tasks`) — so it is tracked, not remembered.

---

## Testing operability — locally and in staging

An alert, a fallback or a runbook that never ran is a hypothesis. Test them before an incident does:

| Test | How | Proves |
|---|---|---|
| **Fault injection** | a TCP proxy that adds latency, drops or resets connections between the service and a dependency (Toxiproxy-style), `tc netem` on Linux, stopping a container mid-test | timeouts, retries, circuit breakers and degraded paths behave as designed |
| **Alert rules** | unit-test the rules with the monitoring system's own tooling (e.g. `promtool test rules` for Prometheus) against synthetic series | the page fires at the burn rates in the design, and not below them |
| **Log and trace hygiene** | a test forces an error, captures the output and asserts: the trace ID is present, no secret or personal field appears | correlation works; nothing leaks |
| **Context across a queue** | publish in one test process, consume in another, assert the consumer span links to the producer's context | traces survive the broker |
| **Probes and shutdown** | kill a dependency: liveness stays green; send SIGTERM: in-flight work finishes | no restart storms; no lost work on deploy |
| **Rollback drill** | deploy, roll back, deploy again in staging | the rollback path works and is fast |
| **Game day** | a scheduled, announced exercise in staging: inject a failure, let on-call use the runbook | the runbook is correct and people can follow it |

A fault-injection task carries its evidence like any other:

```markdown
- [ ] 9. [US3] Failure injection: payment provider down → orders stay PENDING and complete after recovery
  - _Requirements: US-3.AC-1_
  - _Verify: npm test -- tests/resilience/provider-outage.test.ts_
```

---

## Design checklist

Before the design gate, the design names:

1. **SLIs and SLOs** — the user journeys, the good / valid definitions, where they are measured, targets and
   window, the error-budget policy.
2. **Alerts** — burn-rate pages and tickets (windows and rates), the few cause-based alerts, each with a runbook
   and a route (page / ticket).
3. **Metrics** — RED per endpoint or consumer, USE for the resources it saturates, one business metric; units,
   bounded labels; the `_Emits metrics:_` on the tasks.
4. **Logs** — the events and their fields, levels, trace IDs, what is never logged, redaction, retention.
5. **Traces** — spans and attributes (semantic conventions, pinned version), propagation across HTTP and queues,
   sampling (tail sampling if errors must all be kept).
6. **Health** — liveness without dependencies, readiness, startup, graceful shutdown.
7. **Dashboards** — SLOs, golden signals, dependencies, deploy and flag markers.
8. **Flags** — each flag's kind, default when the flag service is down, owner, removal task and date.
9. **Delivery** — rolling, canary or blue-green; the rollback criteria; automatic rollback on SLO burn.
10. **Migrations** — expand / contract steps, the rollback point of each, the irreversible step last.
11. **Capacity and cost** — saturation signals, the load-test knee and headroom, cost per unit and its budget.
12. **Incidents** — severity, the runbooks this feature adds, who is on call for it.
13. **Operability tests** — fault injection, alert-rule tests, log and trace hygiene, probe and shutdown
    behaviour, a rollback drill — run locally or in staging, with `_Verify:_` commands where they can run
    unattended.

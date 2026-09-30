# Data Pipeline Patterns — contracts, quality, idempotent loads, backfills, lineage and cost

A data feature is done when the numbers downstream are right **and stay right** — after a retry, a re-run, a late
file, a renamed column upstream, a backfill of last quarter. Without that, the first sign of a broken pipeline is a
dashboard that doubled overnight, the first question is "which rows are wrong, since when?", and the fix is a
hand-written DELETE in production. This reference covers data pipelines as part of the spec: data contracts and
schema evolution, data-quality checks and quarantine, idempotent loads, backfills and late-arriving data,
partitioning, facts / dimensions and slowly changing dimensions, lineage and ownership, freshness SLAs, retention and
cost, and how to test all of it before a consumer does.

It is the reference for the `+data` track: batch and streaming pipelines, ETL / ELT jobs, a warehouse or a lake, dbt /
Airflow / Spark jobs, anything that moves data between stores on a schedule or a stream and owns its quality. It builds
on the `data.md` steering stub ([steering-templates.md](steering-templates.md)), which holds the team-wide defaults;
this file holds the reasoning and the per-feature decisions.

See also: [distributed-data-patterns.md](distributed-data-patterns.md) (CDC and the outbox, exactly-once as idempotency,
large data volumes, partitions and replication), [privacy-track.md](privacy-track.md) (personal data in a warehouse,
erasure across derived tables), [observability-patterns.md](observability-patterns.md) (freshness and job alerts, SLOs
for data), [api-design-patterns.md](api-design-patterns.md) (compatibility rules for a contract), and
[test-patterns.md](test-patterns.md) (property-based tests).

---

## Where the decisions go in a spec

- **requirements.md** — a pipeline's behaviour is what its consumers can rely on:

  ```markdown
  1. **US-1.AC-5** — WHEN a batch contains an order without a customer_id, THE SYSTEM SHALL quarantine that row with
     the rule it failed and SHALL NOT load it into analytics.fct_orders.
  2. **US-1.AC-6** — IF the daily orders job is re-run for a date already loaded, THEN THE SYSTEM SHALL produce the
     same rows as a single run, with no duplicate and no missing order.
  3. **US-1.AC-7** — IF the newest order in analytics.fct_orders is more than 3 hours old, THEN THE SYSTEM SHALL alert
     the orders-data owner and mark the table stale in the catalog.
  4. **NFR-1** — THE SYSTEM SHALL keep the raw order events for 30 days and the curated tables for 25 months.
  ```

- **design.md** — the five `[DATA]` sections: Data Contracts & Schema Evolution, Data Quality, Pipeline Idempotency &
  Backfills, Lineage & Ownership, Retention & Cost (the scaffold writes them with a `> **TODO**` line; doctor's
  `data-sections` and the design approval refuse while one is missing, unfilled or empty).
- **Tasks** — the contract file is a task's `_Implements:_`; the quality checks and the re-run test are tasks with a
  `_Verify:_` (a command that runs them on fixtures); a backfill rehearsal is a task of its own.
- **Steering** — `data.md` for the conventions (layers, naming, where schemas live, the quality tool, default lookback,
  backfill approvals, retention per layer); per-dataset numbers belong in the spec, not there.

## Vocabulary

| Term | Meaning here |
|---|---|
| **ETL / ELT** | Extract-transform-load (transform before the warehouse) / extract-load-transform (load raw, transform in the warehouse — dbt's model). |
| **Partition** | The unit a job reads, writes and re-runs: a day, an hour, a batch ID. The unit of idempotency and of backfills. |
| **Event time / processing time** | When the thing happened / when the pipeline saw it. Late data is the gap between them. |
| **Watermark / lookback** | How late an event may arrive and still be counted; a batch pipeline's lookback re-processes the last N partitions. |
| **Backfill** | Running a pipeline for past partitions: a new metric's history, a bug fix, a late source. |
| **Grain** | What one row of a table means ("one row per order line per day"). Every table states it. |
| **Fact / dimension** | Measurements of events (orders, clicks) / the entities that describe them (customer, product). |
| **SCD** | Slowly changing dimension — how a dimension keeps (or doesn't keep) the history of an attribute. |
| **Freshness** | `now − max(event time loaded)` of a table; a freshness SLA is its upper bound. |
| **Lineage** | Which sources and transformations a dataset comes from, and which consumers read it. |
| **Data contract** | The producer's promise to its consumers: schema, semantics, grain, freshness, owner, compatibility rule. |

---

## 1. Data contracts & schema evolution

A pipeline is an API whose consumers are queries, dashboards, models and other pipelines. The contract is written down
before the transformation, reviewed like code, and versioned.

**What a contract holds** — per dataset:

- the schema: columns, types, nullability, keys (primary / unique / natural), units and time zones;
- the grain and the semantics of each column ("`amount` = order total in cents, tax included, EUR");
- the owner (a team, a channel) and the consumers the owner knows about;
- the freshness SLA and the delivery time consumers rely on ("by 06:00 UTC");
- the compatibility rule and the deprecation window.

**Where it lives** — next to the code, enforced by the build: a dbt model's YAML with an enforced contract
(`config: {contract: {enforced: true}}` + column `data_type`s), a JSON Schema / Avro / Protobuf file for events (a schema
registry checks compatibility on publish), or a schema file the loader validates against. A contract that only lives in
a wiki is a wish.

```yaml
# models/marts/fct_orders.yml — dbt
models:
  - name: fct_orders
    description: "One row per order. Owner: #orders-data. Fresh by 06:00 UTC."
    config:
      contract: { enforced: true }
    columns:
      - name: order_id
        data_type: bigint
        constraints: [{ type: not_null }, { type: primary_key }]
      - name: customer_id
        data_type: bigint
        constraints: [{ type: not_null }]
      - name: amount_cents
        data_type: bigint
      - name: ordered_at
        data_type: timestamp
```

**Compatibility** — the same rules as an API ([api-design-patterns.md](api-design-patterns.md)), from the consumer's side:

| Change | Backward compatible? |
|---|---|
| Add an optional (nullable) column | Yes — consumers that select their columns don't see it |
| Add a required column with a default | Yes for readers; writers need the default |
| Remove or rename a column | **No** — a new version, or expand / contract |
| Narrow a type (bigint → int, text → enum), tighten nullability | **No** |
| Widen a type (int → bigint) | Usually — check every consumer's language and engine |
| Change the grain or a column's meaning (cents → euros, UTC → local) | **No — the most dangerous kind: the schema check passes** |

Schema registries name the modes: BACKWARD (new readers read old data), FORWARD (old readers read new data), FULL
(both), and their `_TRANSITIVE` variants (against every earlier version, not only the last). Pick one per topic and
write it in the contract.

**Evolving a column (expand / contract)** — add the new column, backfill it, write both, move every consumer, stop
writing the old one, drop it after the deprecation window. Each step is a task; the drop is the last and needs the
consumers' sign-off.

**Catching a breaking change before it ships** — a check that compares the new schema with the published one and fails
on a removal, a rename or a narrowed type (dbt's contract check, the registry's compatibility test, a script over
`information_schema`), run locally as a task's `_Verify:_`. Meaning changes need a human: the design names them.

## 2. Data quality checks

Quality is checked where data enters, after each transformation that could break it, and before it is published —
the **write-audit-publish** pattern: write to a staging location, audit it, publish (swap / merge) only if the audit
passes. A failed audit never leaves a half-written table behind.

**The dimensions** and a check for each:

| Dimension | Example check |
|---|---|
| Completeness | `customer_id` not null; every expected partition present |
| Uniqueness | `order_id` unique per load and across the table |
| Validity | `amount_cents >= 0`; `status in ('paid','refunded','cancelled')`; a parseable date |
| Consistency | every `customer_id` exists in `dim_customer` (referential integrity) |
| Timeliness | the newest `ordered_at` within the freshness SLA |
| Volume | today's row count within ±30 % of the trailing 7-day median |
| Distribution | the share of NULL `country` below 1 %; the mean order value within bounds |

**What a failure does** — decided per check, written in the design:

- **Quarantine the row** — a row that fails a row-level rule goes to a quarantine table with the rule and the load ID;
  the valid rows load. Conservation holds: rows in = rows loaded + rows quarantined.
- **Stop the load** — a dataset-level failure (a missing partition, a volume collapse, a duplicate key) stops the
  publish step; yesterday's data stays in place and the table is marked stale.
- **Warn** — a drift worth a look (a distribution shift) alerts the owner without blocking.

```sql
-- quarantine: rows failing a rule, with the rule and the load
insert into quarantine.orders (load_id, rule, payload)
select :load_id, 'customer_id_not_null', to_json(s) from staging.orders s where s.customer_id is null;

-- publish only the rows that passed
merge into analytics.fct_orders t
using (select * from staging.orders where customer_id is not null) s
on t.order_id = s.order_id
when matched then update set amount_cents = s.amount_cents, status = s.status, ordered_at = s.ordered_at
when not matched then insert (order_id, customer_id, amount_cents, status, ordered_at)
  values (s.order_id, s.customer_id, s.amount_cents, s.status, s.ordered_at);
```

**Tools** — dbt tests (`not_null`, `unique`, `accepted_values`, `relationships`, and package or custom tests), Great
Expectations suites, Soda checks, or plain SQL assertions that return the failing rows. The tool matters less than
the rule: every check has an owner, a severity and a documented reaction.

```yaml
      - name: status
        data_tests:
          - accepted_values: { values: ['paid', 'refunded', 'cancelled'] }
      - name: customer_id
        data_tests:
          - not_null
          - relationships: { to: ref('dim_customer'), field: customer_id }
```

**Test the checks themselves** — a fixture batch with one null key, one duplicate and one out-of-range row must end with
three quarantined rows and the valid ones loaded. A check nobody has seen fail is a check nobody knows works.

## 3. Idempotent pipelines

Jobs are retried, re-run by hand, backfilled and triggered twice by a scheduler hiccup. Every run for a partition must
leave the same result as one run: **re-running is the normal case, not the exception.**

**Deterministic inputs** — a run for `2024-06-01` reads the data *for* that date (event time between the bounds), never
"everything since the last run", never `now()`. The run's parameters (the partition, the as-of time) are its inputs.

**The load patterns**:

| Pattern | How | Use when |
|---|---|---|
| Overwrite the partition | delete the partition and insert it again in one transaction, or `INSERT OVERWRITE … PARTITION` (Spark / Hive), or a partition swap | Facts partitioned by date; the partition is the unit of work |
| MERGE on a key | `MERGE … ON natural key` — update matched, insert new | Upserts, dimensions, sources that re-send changed rows |
| Stage and swap | build the whole table in staging, audit, then swap / rename atomically | Small or fully rebuilt tables |
| Blind append | `INSERT` without a key or a partition bound | **Never** for a re-runnable job — every retry duplicates |

```sql
-- overwrite one partition, atomically
begin;
delete from analytics.fct_orders where order_date = :run_date;
insert into analytics.fct_orders
select … from staging.orders where order_date = :run_date;
commit;
```

**Anti-patterns** — `now()` / `current_date` inside a transformation (a re-run next week computes something else);
surrogate keys regenerated on each run (joins break); `ORDER BY … LIMIT` without a total order; appending "the new
rows" found by comparing with the target (a partial failure half-appends); side effects inside the transformation
(emails, API calls) — they belong to a separate, idempotent step.

**Events arriving more than once** — deduplicate on the event's ID at ingestion (keep the first, or the latest by a
version); "exactly-once" in a pipeline is at-least-once delivery plus an idempotent write
([distributed-data-patterns.md](distributed-data-patterns.md) — the idempotent consumer, CDC).

## 4. Backfills

A backfill runs the pipeline for past partitions: a new column's history, a bug fix that restates old numbers, a source
that arrived late, a new pipeline that needs a year of history. Done carelessly it doubles rows, overloads the
warehouse, or silently rewrites numbers that finance already reported.

**The procedure** — written in the design (Pipeline Idempotency & Backfills), rehearsed as a task:

1. **Scope** — the date range, the tables, and every consumer that will see restated numbers (tell them first; a
   restated closed month needs its owner's approval).
2. **Dry run on one partition** — run the backfill for a single partition in a scratch schema and compare with a normal
   run of the same partition (row counts, sums, a sample diff). They must match; if the backfill exists to fix a bug,
   the difference must be exactly the bug.
3. **Cost and load** — estimate bytes scanned / compute per partition × partitions; set the parallelism so the
   production schedule keeps its slots; run outside peak hours.
4. **Run** — partition by partition (idempotent, so a failure is re-run, not cleaned up), oldest first when later
   partitions depend on earlier ones (cumulative metrics, SCD history).
5. **Verify** — the quality checks on every backfilled partition; the totals against an independent source where one
   exists; record the run (range, version, who approved) in the decision log.

**Orchestrators** — Airflow's backfill, Dagster's partitioned asset backfills, dbt's incremental models run with a date
range (`--vars`) or `--full-refresh` for a small model. Whatever the tool, the job must take the partition as a
parameter; a job that can only run "for today" cannot be backfilled.

**Large volumes** (months of events, billions of rows): chunk by partition, checkpoint progress, throttle, and prefer a
set-based rebuild over row-by-row updates — [distributed-data-patterns.md](distributed-data-patterns.md) covers moving
large volumes without locking the primary store.

## 5. Late-arriving data

Events arrive after their partition was loaded: a mobile client offline for two days, a partner's file a day late, a
retried webhook. Decide how late is still counted, and how the correction reaches consumers.

- **Batch — the lookback window**: each daily run also re-processes the previous N partitions (N from the observed
  lateness — e.g. 99.9 % of events within 3 days). Idempotent loads make this safe.
- **Streaming — watermarks and allowed lateness**: a window closes when the watermark passes its end plus the allowed
  lateness; later events go to a late-events table (counted, reconciled, never silently dropped).
- **Finalisation** — a partition older than the lookback is final; a later correction is a backfill with its approval.
  Say which reports use final partitions only.

```markdown
- **US-1.AC-8** — WHEN an order event arrives up to 3 days after its order date, THE SYSTEM SHALL include it in that
  date's partition on the next run; IF it arrives later, THEN THE SYSTEM SHALL record it in late_orders and SHALL NOT
  change a finalised partition.
```

## 6. Partitioning and clustering

- **Partition by the unit of work and the most common filter** — usually the event date. Queries filtering on it read
  only the partitions they need (partition pruning); loads overwrite one partition.
- **Granularity** — daily for most facts; hourly only when the volume or the freshness needs it. Thousands of tiny
  partitions cost more than they save.
- **Cluster / sort** by the next most common filters or join keys (customer, tenant) so a query scans fewer blocks.
- **Keep the partition column in every query** — a view or a required partition filter protects the bill from an
  unfiltered `SELECT *`.

## 7. Facts, dimensions and slowly changing dimensions

State the **grain** of every table before its columns: "one row per order line", "one row per customer per day". Most
data bugs are grain bugs — a join that multiplies rows, a sum over a table with two rows per order.

**Star schema** — facts at a declared grain with foreign keys to dimensions; dimensions describe entities and are shared
across facts (a conformed `dim_customer`), so every report means the same thing by "customer".

**Slowly changing dimensions** — how a dimension handles a changed attribute (a customer moves country):

| Type | Keeps | Use when |
|---|---|---|
| 0 | the original value, never updated | fixed attributes (date of first order) |
| 1 | only the current value (overwrite) | corrections; history doesn't matter |
| 2 | a new row per version: `valid_from`, `valid_to`, `is_current`, a surrogate key | facts must join to the value *at the time* (revenue by the customer's country when they ordered) |
| 3 | the current and the previous value in two columns | one level of "before / after" is enough |

Type 2 is the common "keep history" choice: facts store the dimension's surrogate key of the version valid at the event
time; dbt snapshots implement it from a source table. Personal data in a type 2 dimension multiplies the rows an erasure
must reach — see Retention.

## 8. Lineage and ownership

- **Lineage** — sources → transformations → consumers, at table level at least, column level where a change is risky.
  Generate it rather than draw it: dbt's docs graph, OpenLineage events from the orchestrator, the warehouse's access
  history. Before a change, the lineage answers "who breaks?".
- **Ownership** — every dataset has an owner (a team, a channel, an on-call rotation) named in the contract and the
  catalog; the owner is who a failed check or a freshness alert reaches, and who approves a breaking change or a
  backfill that restates numbers.
- **Consumers** — known consumers are listed (dashboards, models, exports, other pipelines); a dataset nobody consumes is
  a candidate for deletion, not for maintenance.

## 9. Freshness SLAs

Freshness = `now − max(event time loaded)` (or of the load time, when event time is unreliable). Per dataset:

- the SLA ("fct_orders fresh within 3 hours during business hours; by 06:00 UTC for yesterday");
- the check that measures it (a scheduled query, dbt source freshness, the quality tool) and runs **independently of
  the pipeline** — a pipeline that doesn't run can't report that it didn't run;
- the reaction: alert the owner, mark the dataset stale for consumers (catalog flag, a banner on the dashboard), and
  what consumers do meanwhile.

Job-level signals — duration, rows in / loaded / quarantined, bytes scanned, failures and retries — go through the same
telemetry and alerting as a service ([observability-patterns.md](observability-patterns.md)); a data SLO can burn an
error budget like a latency SLO.

## 10. Retention and cost

**Retention** — per layer and per dataset, written in the design:

| Layer | Holds | Typical retention |
|---|---|---|
| Raw / landing | the source data as received (replayable) | days to weeks — long enough to rebuild after a bug |
| Staging | cleaned, typed, deduplicated | short, or views |
| Curated / marts | modelled facts and dimensions | as long as the business and the law require |
| Quarantine | the rejected rows and their rule | long enough to investigate and replay |

Personal data follows [privacy-track.md](privacy-track.md): the retention period per category, and **erasure must reach
every derived table** — marts, snapshots / SCD history, extracts, backups by their own schedule. Design the erasure path
(delete by subject ID across the lineage, or rebuild from a raw layer that already dropped the subject) before the data
lands, not after the first request. Pseudonymise early where the analysis doesn't need identity.

**Cost** — the drivers are bytes scanned, compute time and storage:

- partition and cluster so queries prune; require a partition filter on large tables;
- materialise what is read often (tables, incremental models), keep rarely read logic as views;
- move old partitions to cheaper storage tiers; drop what retention allows;
- estimate the monthly cost of the pipeline and of its heaviest queries in the design, and alert when it drifts.

## 11. Testing data pipelines

The same discipline as application code, adapted: small deterministic fixtures, the transformation logic tested in
isolation, and properties that must hold for any input.

| Test | What it proves | Kind |
|---|---|---|
| Transformation unit test (dbt unit tests, SQL on fixture tables, a Spark function on a small DataFrame) | the logic of one model on hand-made rows, edge cases included | example |
| Data-quality fixtures | a batch with a null key, a duplicate and an out-of-range value quarantines exactly those rows | property |
| Idempotent re-run | running a partition twice (or after a failure half-way) leaves the same rows as once | property |
| Backfill rehearsal | a backfilled partition equals a normal run of it | example |
| Row conservation | rows in = rows loaded + rows quarantined, for every run | property |
| Schema-change compatibility | an added optional column passes, a removed / renamed column or a narrowed type is rejected | example |
| Freshness check | a partition older than the SLA fires the alert to the owner | example |
| Late data | an event 2 days late lands in its partition; one 5 days late goes to the late table | example |

Give each a T-ID in its name and a runnable `_Verify:_` so the evidence gate can check it:

```markdown
- [ ] 7. [US1] Idempotent daily load of fct_orders (delete + insert per order_date in one transaction)
  - _Requirements: US-1.AC-6_
  - _Makes green: T-07_
  - _Implements: models/marts/fct_orders.sql_
  - _Verify: dbt build --select fct_orders --vars "{run_date: '2024-06-01'}" && python tests/check_rerun.py 2024-06-01_
```

The re-run test in words: load a fixture partition, snapshot the table, load the same partition again, assert the
snapshot is unchanged (same row count, same key set, same sums). As a property: for any generated batch, `load; load`
equals `load`.

## 12. Batch or streaming

Batch is simpler to reason about, test, backfill and pay for; choose streaming when a consumer needs the data within
minutes and says so in a criterion. A streaming pipeline still needs a contract, quality checks (per event and per
window), idempotent sinks, a replay path (the retained log or the raw layer) and a backfill story — "we'll replay the
topic" only works if the topic retains long enough and the sink is idempotent.

---

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| Blind `INSERT` of "the new rows" | Overwrite the partition or MERGE on a key |
| `now()` / `current_date` in a transformation | The run's partition and as-of time as parameters |
| Silent drop of bad rows | Quarantine with the rule; count them; alert above a threshold |
| A freshness check inside the pipeline it watches | An independent scheduled check |
| Renaming a column in place | Expand / contract with a deprecation window |
| Changing a column's meaning without a new name | A new column (or version); announce it to consumers |
| Backfilling straight into production | Dry run on one partition, compare, then run with approval |
| A table without a stated grain | State it; test uniqueness at that grain |
| Personal data copied into every mart | Pseudonymise early; design the erasure path across the lineage |
| "The dashboard will tell us" | Checks with an owner and a reaction, before publish |

## Design checklist

Before the design gate, the `[DATA]` sections name:

1. **Contracts** — each dataset produced or consumed: schema, grain, semantics, owner, consumers, where the contract
   lives, the compatibility rule, how a breaking change is caught before it ships.
2. **Quality** — the checks per dataset (completeness, uniqueness, validity, consistency, timeliness, volume), where each
   runs (ingestion, after transformation, before publish), the severity and the reaction (quarantine, stop, warn).
3. **Idempotency** — the unit of work, the load pattern (overwrite a partition / MERGE / stage and swap), no `now()`, the
   deduplication key for events.
4. **Late data** — the lookback window or watermark, the late-events path, when a partition is final.
5. **Backfills** — the procedure (scope, dry run, compare, cost, parallelism, approval), who is told when numbers restate.
6. **Model** — the grain of every table, facts and dimensions, the SCD type of each changing attribute.
7. **Lineage & ownership** — sources → transformations → consumers, the owner of each dataset, the freshness SLA and the
   independent check that measures it.
8. **Retention & cost** — retention per layer and dataset (personal data per the privacy track, erasure across derived
   tables), partitioning / clustering, storage tiers, the expected monthly cost and its alert.
9. **Tests** — transformation unit tests, quality fixtures, the re-run and backfill tests, row conservation, the
   schema-change check, the freshness alert — with T-IDs and `_Verify:_` commands that run locally.

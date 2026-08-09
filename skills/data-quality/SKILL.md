---
name: data-quality
description: >-
  Data validation and quality contracts for pipelines — uniqueness/PK, not-null, range/domain,
  referential integrity, freshness/SLA, row-count tie-out, distribution drift — with the
  fail-closed-at-the-gate pattern. Use when adding tests/expectations to a pipeline, defining a
  data contract, catching nulls/dupes/stale/drifted data before a serving table or report, or
  picking between dbt tests, Great Expectations, Pandera, and Soda.
---

# Data Quality

Validate the *data flowing through a pipeline* against explicit contracts, and **fail closed at
the gate** — block bad data from landing in a serving table or report rather than letting it ship
and apologizing later. This skill owns the assertions and the gate; it does not own:

- **Code-level swallowed errors** (empty `except`, ignored return codes, `catch {}`) → that's the
  **silent-failure-hunter** agent. Here the *code runs fine* but the *data is wrong*.
- **ML feature/label/training contracts** (schema skew, label leakage, train/serve drift) →
  **mle-workflow**. Drift here means *pipeline data* drifted, not model inputs.

Cross-link siblings: **dbt** and **sql-warehouse** for where most of these run in-warehouse, and
**cheap-data-orchestration** for scheduling the gate and alerting on failure.

## The principle: fail closed at the gate

A quality check that *logs a warning and continues* is theater — bad data still reaches users.
The contract is only real if a failure **stops the pipeline**:

1. Land new data in a **staging/quarantine** table, not the serving table.
2. Run assertions against staging.
3. **Pass → promote** (swap/merge into serving). **Fail → halt**: leave serving on its last-good
   state, alert, and quarantine the bad batch for inspection.
4. Never partially publish. A half-loaded serving table is worse than a stale one.

Stale-but-correct beats fresh-but-wrong for anything a person trusts (a dashboard, a payment, a
report). Make the gate **blocking by default**; downgrade a specific check to warn-only only with
a documented reason.

## The assertion catalog

The seven checks that catch most real incidents. Pick the ones the data's contract actually needs.

| Assertion | Catches | Typical expression |
|-----------|---------|--------------------|
| **Uniqueness / PK** | Duplicate rows, fan-out from a bad join, double-loaded batch | `count(*) = count(distinct key)`; no null in key |
| **Not-null / completeness** | Dropped fields, upstream schema change, partial extract | required columns have 0 nulls (or null rate < threshold) |
| **Accepted range / domain** | Garbage values, unit errors, bad enums | numeric within `[min,max]`; categorical in allowed set; regex/format |
| **Referential integrity** | Orphan rows, broken FK, late-arriving dimension | every FK value exists in parent; no orphans |
| **Freshness / SLA** | Stuck pipeline, dead upstream feed | `max(updated_at) > now() - interval`; partition for today exists |
| **Row-count tie-out vs source** | Silent partial load, truncated extract, dedup gone wrong | `target_rows` within tolerance of `source_rows` (exact or ±%) |
| **Distribution drift** | Upstream semantics changed without erroring | row count, null rate, mean/quantiles, category mix vs trailing baseline |

Notes that save incidents:

- **Tie-out is the cheapest high-value check.** A job can succeed, tables can be non-null and
  unique, and still be missing half the rows. Always reconcile a count against the source of truth.
- **Distribution drift is the subtle one** — nothing is malformed, but the *meaning* shifted (a
  currency switched, an enum was renamed upstream, a sensor recalibrated). Compare against a
  trailing window, alert on Δ beyond a band. This is *pipeline* drift; for *model* drift see
  mle-workflow.
- **Freshness needs a clock you trust** — assert on event/load time, not wall-clock, or a
  backfill will look "stale" and a stuck clock will look "fresh."
- **Set thresholds from history, not vibes.** A null rate of 2% may be normal; pick bands from the
  trailing baseline and tighten over time.

## Where to assert (defense in depth)

- **At ingestion** — schema/type/format and not-null, before raw data even lands. Reject early.
- **At transform** — uniqueness, referential integrity, range/domain on the modeled tables (this
  is dbt-test territory; see the **dbt** and **sql-warehouse** skills).
- **At the publish gate** — tie-out, freshness, drift, plus a final re-check of the critical
  invariants right before promotion. This is the blocking gate above.

Run the heavy/whole-table checks in-warehouse where the data already lives (echoing
**data-throughput-accelerator**: move the check to the data, don't pull the data to the check).

## Workflow

1. **Write the contract first** — for each table: keys, required columns, value domains, FK
   relationships, freshness SLA, expected row volume. A contract nobody wrote is a contract nobody
   keeps.
2. **Encode it as assertions** in the right tool (see `references/tool-map.md`).
3. **Wire the gate** so failures *block promotion*, not just log.
4. **Alert with context** — which check, which table, observed vs expected, sample failing rows.
   Route through **cheap-data-orchestration**.
5. **Quarantine** the failing batch so it's inspectable and replayable.
6. **Tune thresholds** from observed history; review flaky checks instead of muting them.

## Guardrails

- A check that only warns is **not** a gate — bad data still ships. Make it block or document why.
- Don't delete/auto-coerce failing rows to make a check pass — quarantine and inspect.
- Don't assert on wall-clock for freshness when the data has its own event time.
- Don't tie-out against a number derived from the same broken extract — reconcile to an
  independent source of truth.
- A green test suite on an **empty/half-loaded** table is a false pass — pair every quality check
  with a row-count/volume check.
- For regulated, financial, healthcare, or customer-impacting data, keep the quarantined batch and
  the gate decision as replay/audit evidence.

**Tool selection** — dbt tests vs Great Expectations vs Pandera vs Soda, with a pick-by-situation
table — lives in **`references/tool-map.md`**. Read it when you're choosing how to implement.

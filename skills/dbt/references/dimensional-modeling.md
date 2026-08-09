# Dimensional modeling basics (Kimball)

Load on demand when designing marts. The goal: facts and dimensions a human can query without a
join manual, at a grain you can state in one sentence.

## Grain — declare it first

The **grain** is what one row of a fact table means: "one row per order line", "one row per
account per day". Decide the grain *before* picking columns. Everything else follows:

- Every dimension key in the fact must be valid at that grain.
- Every measure must be additive (or you must note non-additivity) at that grain.
- Mixing grains in one table ("some rows are orders, some are line items") is the most common
  modeling bug — split into two facts.

Pick the **lowest practical grain** (atomic). You can always aggregate up; you can't recover
detail you never stored.

## Star schema

A central **fact** table surrounded by **dimension** tables, joined on surrogate keys.

- **Fact** = the measurable event: numeric, additive measures + foreign keys to dimensions +
  degenerate dimensions (e.g. an order number kept on the fact). Long and narrow.
- **Dimension** = the descriptive context: who/what/where/when. Wide and short. Denormalize
  attributes into the dimension (a star), don't normalize into many sub-tables (a snowflake) —
  stars are simpler to query and usually faster.
- **Surrogate keys**: integer/hash keys owned by the warehouse, not the source's natural key.
  They decouple you from source key churn and are *required* for SCD-2 (the same natural key has
  multiple surrogate-keyed versions over time).
- **Conformed dimensions**: one `dim_customer` shared by every fact, so metrics line up across
  marts. Don't build a private customer dim per fact.

Fact flavors: **transaction** (one row per event), **periodic snapshot** (one row per entity per
period — balances, inventory), **accumulating snapshot** (one row per process instance with
milestone date columns that fill in over time).

## Slowly Changing Dimensions (SCD)

How a dimension handles attribute changes over time:

| Type | Behavior | Use when |
|------|----------|----------|
| **0** | never changes (e.g. original signup date) | immutable attributes |
| **1** | overwrite in place, no history | corrections; history doesn't matter |
| **2** | new row per change, with `valid_from`/`valid_to` + `is_current` | you must reproduce the past — this is what dbt **snapshots** produce |
| **3** | keep a "previous value" column alongside current | only the last change matters |

**Type 2 is the workhorse** for analytics that must be reproducible ("revenue *as reported then*").
In dbt, a snapshot gives you Type 2 automatically (`dbt_valid_from`/`dbt_valid_to`); join a fact to
the dimension version that was current at the fact's event time, not the latest version.

For richer as-of / bitemporal needs (valid-time *and* transaction-time, point-in-time correctness
in feature pipelines), this hands off to the `point-in-time-data` skill.

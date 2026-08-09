---
name: sql-warehouse
description: >-
  Write correct, cost-efficient analytical SQL on warehouses (Postgres, Snowflake, BigQuery,
  Databricks/Spark SQL, DuckDB). Use when authoring or reviewing analytical queries, debugging
  wrong row counts / fan-out / duplicated rows, picking window functions vs GROUP BY, deduping,
  NULL-safe aggregation, or cutting query cost (bytes scanned, credits, partition pruning).
---

# SQL Warehouse

Analytical SQL fails in two ways: **wrong numbers** (a join silently fans out, a NULL drops a row)
and **expensive numbers** (a full-table scan when a partition filter would do). This skill keeps
both in check. Dialect-specific syntax and the deep cost math live in `references/` — load them
only when you hit that warehouse or that decision.

Siblings: transformations/models → `dbt` · visualize results → `dashboard` · assert correctness in
the pipeline → `data-quality` · local engine → `duckdb-warehouse`.

## Join grain & fan-out (the #1 correctness bug)

A join multiplies rows when the right side is **not unique on the join key**. One order joined to a
line-items table returns N rows — and any `SUM(orders.amount)` now counts the amount N times.

Before every join, state the **grain** of each side ("one row per `order_id`" / "one row per
`order_id, sku`") and the grain of the result. Then:

- If the right side may have duplicate keys and you only need its columns, **pre-aggregate or
  dedup it to one row per key in a CTE** before joining.
- Suspect fan-out whenever a total grows after adding a join. Verify the key is unique:
  `SELECT k, COUNT(*) FROM t GROUP BY k HAVING COUNT(*) > 1 LIMIT 5;`
- `LEFT JOIN` preserves left rows but **unmatched keys yield NULL** on right columns — see NULL
  aggregation below. `INNER` silently drops unmatched left rows; that is often the real bug.
- Aggregate **before** joining when each side aggregates independently, rather than joining then
  `SUM(... ) / COUNT(DISTINCT ...)` to undo the fan-out.

## Window functions + QUALIFY

Window functions compute per-row over a partition **without collapsing rows** — use them for
running totals, rank-within-group, period-over-period (`LAG`/`LEAD`), and "top N per group".

`QUALIFY` filters on a window result the way `WHERE` filters rows and `HAVING` filters groups —
no subquery needed. Supported in Snowflake, BigQuery, Databricks, DuckDB (**not** Postgres):

```sql
SELECT user_id, event_at, amount
FROM events
QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_at DESC) = 1;  -- latest row per user
```

On Postgres, wrap the window in a subquery/CTE and filter in the outer `WHERE`.

## Dedup patterns

- **Keep the latest/best row per key:** `ROW_NUMBER() OVER (PARTITION BY key ORDER BY ts DESC)` then
  keep `= 1` (via `QUALIFY` or a subquery). Deterministic — add a tiebreaker column to the
  `ORDER BY` so it's reproducible.
- **Collapse exact duplicates:** `SELECT DISTINCT` or `GROUP BY` all columns. Cheaper to fix the
  source of duplicates upstream.
- `RANK` (ties share a rank, gaps follow) vs `DENSE_RANK` (ties share, no gaps) vs `ROW_NUMBER`
  (always unique) — pick deliberately; `ROW_NUMBER` is the safe dedup default.

## NULL-safe aggregation

- `COUNT(col)` skips NULLs; `COUNT(*)` counts rows. They differ exactly by the NULL count — know
  which you mean. `SUM`/`AVG` also ignore NULLs (`AVG` divides by the non-NULL count).
- `x = NULL` is never true. Use `IS NULL`, or `x IS NOT DISTINCT FROM y` for NULL-safe equality
  (Spark: `<=>`; BigQuery: no operator — wrap with `COALESCE` or `IFNULL`).
- `NULL` in `IN (...)` / `NOT IN (...)` poisons the result — `NOT IN` with any NULL returns no
  rows. Prefer `NOT EXISTS` or filter NULLs out of the subquery first.
- Guard division: `amount / NULLIF(denom, 0)` to turn divide-by-zero into NULL.
- `COALESCE` only at the point of display/output — coalescing too early hides the missing-data
  signal `data-quality` would catch.

## CTE vs subquery

- Prefer **CTEs** (`WITH`) for readability and to name each grain step. They make join-grain
  reasoning explicit, which is the whole game.
- **Materialization differs by engine:** historically Postgres materialized every CTE (an
  optimizer fence) — modern Postgres (12+) inlines unless you write `AS MATERIALIZED`. Snowflake,
  BigQuery, Databricks, and DuckDB generally inline/optimize across CTEs. Don't assume a CTE is a
  performance boundary, and don't assume it's free to reference one twice (it may recompute).
- A CTE referenced many times that is expensive to compute → consider a **temp table** so it runs
  once. Correlated subqueries in `SELECT`/`WHERE` run per-row — rewrite as a join or window.

## Cost control

Compute is billed by **bytes scanned** (BigQuery), **credits = warehouse-size × time** (Snowflake),
or **cluster uptime** (Databricks). The cheapest query reads the least data, fast.

- **Prune partitions/clusters.** Filter on the partition/cluster column with a literal or simple
  predicate so the engine skips files: `WHERE event_date >= '2026-01-01'`. Wrapping the column in a
  function (`WHERE DATE(event_ts) = …`) or comparing to a non-constant can **defeat pruning** — keep
  the partition column bare on one side.
- **Never `SELECT *` on wide/columnar tables.** Columnar engines bill per *column* read; select only
  the columns you need. `SELECT *` also breaks result cache on schema drift.
- **Filter and aggregate early**, before joins and before the final projection, to shrink the scan.
- **Result cache is free** — identical query text on unchanged data returns instantly at no cost
  (Snowflake/BigQuery). Parameterize stable queries so they hit cache; needless `current_timestamp`
  or `LIMIT` churn misses it.
- **Right-size the warehouse.** Bigger = faster *and* proportionally more credits/min — only scale
  up if the work parallelizes; scale-out (more clusters) is for concurrency, not single-query speed.
  Auto-suspend idle warehouses.
- **Check the plan and the estimate first.** `EXPLAIN` / BigQuery dry-run shows bytes before you
  pay. A query that scans TBs where it should scan GBs is a pruning bug, not a sizing problem.
- **Sample during development** (`TABLESAMPLE`, `LIMIT` on a filtered subset) so iteration is cheap.

For per-dialect syntax (QUALIFY, sampling, dedup, NULL-safe equality, partition DDL) see
`references/dialect-cheatsheet.md`. For the deep cost model (pricing units, pruning internals,
clustering, spill, slot/credit tuning) see `references/cost-control.md`.

## Review checklist

1. Grain of every table and the result is stated; no unintended fan-out.
2. `INNER` vs `LEFT` is intentional; unmatched rows handled.
3. Window dedup is deterministic (tiebreaker in `ORDER BY`).
4. `COUNT(*)` vs `COUNT(col)` is the one you meant; division is `NULLIF`-guarded.
5. `NOT IN` has no NULL exposure (or uses `NOT EXISTS`).
6. Partition/cluster column filtered bare; no `SELECT *`; filters pushed early.
7. `EXPLAIN`/dry-run reviewed — bytes/credits are in the expected range.

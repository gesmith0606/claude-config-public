# Per-dialect cheatsheet

Quick syntax differences for the patterns in `SKILL.md`. Engines: Postgres (PG), Snowflake (SF),
BigQuery (BQ), Databricks/Spark SQL (DBX), DuckDB (DD).

## QUALIFY (filter on a window result)

| Engine | QUALIFY | Fallback |
|--------|---------|----------|
| PG | ❌ | Wrap window in subquery/CTE, filter in outer `WHERE` |
| SF / BQ / DBX / DD | ✅ | `... QUALIFY ROW_NUMBER() OVER (...) = 1` |

## Latest-row-per-key dedup

```sql
-- SF / BQ / DBX / DD
SELECT * FROM t
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC, id) = 1;

-- PG (no QUALIFY)
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC, id) AS rn FROM t
) s WHERE rn = 1;
```
BQ also has a terse idiom: `SELECT ARRAY_AGG(t ORDER BY updated_at DESC LIMIT 1)[OFFSET(0)] ...`.

## NULL-safe equality

| Engine | Operator / idiom |
|--------|------------------|
| PG / DD | `a IS NOT DISTINCT FROM b` |
| SF | `EQUAL_NULL(a, b)` or `a IS NOT DISTINCT FROM b` |
| DBX | `a <=> b` |
| BQ | no operator — `COALESCE(a,SENTINEL)=COALESCE(b,SENTINEL)` or compare with `IFNULL` |

## Table sampling (cheap dev iteration)

| Engine | Syntax |
|--------|--------|
| PG | `TABLESAMPLE BERNOULLI (1)` / `SYSTEM (1)` |
| SF | `SAMPLE (1)` or `SAMPLE (1000 ROWS)` |
| BQ | `TABLESAMPLE SYSTEM (1 PERCENT)` |
| DBX | `TABLESAMPLE (1 PERCENT)` / `(1000 ROWS)` |
| DD | `USING SAMPLE 1%` or `USING SAMPLE 1000` |

## String / date conversions that bite

- **String agg:** PG/DD `STRING_AGG`; SF `LISTAGG`; BQ/DBX `STRING_AGG` (DBX also `COLLECT_LIST`).
- **Safe cast:** SF `TRY_CAST` / `TRY_TO_NUMBER`; BQ `SAFE_CAST`; DBX `TRY_CAST`; PG/DD `CAST`
  (no built-in safe cast — filter first, or PG regex guard).
- **Current date:** all support `CURRENT_DATE`; BQ also `CURRENT_DATE()`. Avoid in cached queries.
- **Date truncation:** PG/SF/DBX/DD `DATE_TRUNC('month', ts)`; BQ `DATE_TRUNC(ts, MONTH)` (unit is
  a keyword, arg order flipped).

## Partition / cluster DDL (drives pruning — see cost-control.md)

```sql
-- BigQuery: partition + cluster
CREATE TABLE ds.events (event_ts TIMESTAMP, user_id STRING, amount NUMERIC)
PARTITION BY DATE(event_ts) CLUSTER BY user_id;

-- Snowflake: clustering key (auto micro-partitions; cluster only big, selectively-filtered tables)
CREATE TABLE events (...) CLUSTER BY (event_date, user_id);

-- Databricks (Delta): liquid clustering (preferred) or partitioning
CREATE TABLE events (...) CLUSTER BY (event_date, user_id);   -- liquid
-- legacy: PARTITIONED BY (event_date)

-- Postgres: declarative range partitioning
CREATE TABLE events (...) PARTITION BY RANGE (event_ts);

-- DuckDB: no partitioning of native tables; for Parquet use Hive-partitioned dirs
--   read_parquet('data/event_date=*/**.parquet', hive_partitioning = true)
```

## Identifier quoting & case

- PG / DD: unquoted identifiers fold to **lowercase**; `"Col"` is case-sensitive.
- SF: folds to **UPPERCASE**; `"Col"` case-sensitive.
- BQ / DBX: identifiers case-insensitive for resolution; BQ backtick-quotes `` `project.ds.tbl` ``.

## EXPLAIN / cost preview

| Engine | Command |
|--------|---------|
| PG | `EXPLAIN (ANALYZE, BUFFERS) <q>` |
| SF | `EXPLAIN USING TEXT <q>`; post-run `QUERY_HISTORY` / Query Profile for bytes & spill |
| BQ | **Dry run** (`bq query --dry_run` or API `dryRun`) → bytes billed before paying |
| DBX | `EXPLAIN FORMATTED <q>`; Spark UI for shuffle/scan |
| DD | `EXPLAIN` / `EXPLAIN ANALYZE <q>` |

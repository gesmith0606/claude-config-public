---
name: duckdb-warehouse
description: >-
  DuckDB + Parquet as a near-zero-cost local analytics engine. Use when small-to-mid data (up to
  ~tens of GB) needs SQL analytics, joins, aggregations, or upserts WITHOUT a hosted warehouse —
  querying Parquet/CSV directly, partitioning, incremental upserts, and exporting static
  Parquet/JSON for downstream consumers.
---

# DuckDB Warehouse

> **Routing:** cloud-warehouse dialects/slots/IAM-scale data → `sql-warehouse`; in-memory dataframe wrangling → `dataframes`; charting → `dashboard`; publishing exports → `cheap-data-website`.

DuckDB is an embedded OLAP engine — SQLite for analytics. One `pip install duckdb` (or the CLI),
no server, no cluster, no bill. For small-to-mid data it routinely beats a hosted warehouse on
both latency and cost, because there's no network hop and no per-query charge. Treat it as the
default analytics layer until data outgrows one machine.

## When DuckDB wins (and when it doesn't)

| Use DuckDB when… | Reach for a hosted warehouse when… |
|------------------|------------------------------------|
| Data fits on one disk (≲ tens of GB compressed Parquet) | Data is TB-scale or grows unbounded |
| You want zero standing cost / no infra | Many concurrent writers or BI users need a shared service |
| Local dev, ad-hoc analysis, CI, notebooks, ETL transforms | You need fine-grained IAM, audit, row-level security |
| One-shot scans, joins, aggregations over Parquet | Always-on low-latency serving to apps |

Don't stand up Postgres just to run `GROUP BY` over some files — that's a server, a connection
pool, and a load step you don't need. Don't reach for BigQuery to crunch a 2 GB export — the
upload alone costs more wall-clock than the whole DuckDB query. Cross-link **`sql-warehouse`**
for the cloud-dialect side; this skill is the local, free side.

## Query Parquet directly — no load step

The core move: point SQL at files, skip ingestion entirely. DuckDB reads Parquet, CSV, JSON, and
glob patterns natively, pushing filters and column-pruning down into the scan.

```sql
-- local glob, partitioned layout, remote — all just "tables"
SELECT region, sum(amount) AS total
FROM 'data/events/*.parquet'
WHERE event_date >= DATE '2026-01-01'
GROUP BY region;

-- remote object storage, read only the bytes needed (httpfs)
INSTALL httpfs; LOAD httpfs;
SELECT count(*) FROM 's3://bucket/events/year=2026/*.parquet';
```

Parquet over CSV, always: columnar + compressed means DuckDB reads only the columns and row-groups
a query touches. Convert once (`COPY (…) TO 'x.parquet' (FORMAT parquet)`) and never re-parse CSV.

From Python, prefer the relational/`df()` bridge over manual cursors; it hands back to **`dataframes`**:

```python
import duckdb
df = duckdb.sql("SELECT * FROM 'sales/*.parquet' WHERE qty > 0").df()  # pandas/polars/arrow zero-copy
```

## Partition by natural keys

Lay Parquet out as Hive-style directories keyed on the columns you filter on — usually a date plus
one low-cardinality dimension (`year=2026/month=06/`, `league=nba/`, `sector=energy/`). DuckDB then
prunes whole directories before reading a byte.

```sql
COPY (SELECT * FROM staging)
TO 'warehouse/events'
(FORMAT parquet, PARTITION_BY (year, region), OVERWRITE_OR_IGNORE);
```

Rules of thumb: partition on what you filter by, keep each partition file in the ~100 MB–1 GB
range (avoid the many-tiny-files trap — batch small writes, see **`data-throughput-accelerator`**),
and don't over-partition (high-cardinality keys make thousands of micro-files and hurt).

## Incremental upserts

DuckDB has no shared server, so the durable state is the Parquet on disk (or a `.duckdb` file). Two
patterns, cheapest first:

- **Partition replace** — if new data lands per-partition (e.g. a day's events), recompute and
  overwrite only the touched partitions. Idempotent, no row-level merge needed. Best for append-y
  time-series.
- **MERGE / anti-join upsert** — for changing dimensions, load into a `.duckdb` table and merge on
  the natural key, then re-export. Keep raw / derived / serving separate (echoing
  `data-throughput-accelerator`).

```sql
-- key-based upsert into a persistent table, then snapshot back to Parquet
CREATE TABLE IF NOT EXISTS dim_team AS SELECT * FROM 'serving/dim_team.parquet';
INSERT INTO dim_team BY NAME
  SELECT * FROM 'staging/dim_team_new.parquet'
  ON CONFLICT (team_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at;
COPY dim_team TO 'serving/dim_team.parquet' (FORMAT parquet);  -- re-snapshot for consumers
```

Make every run idempotent: a re-run over the same input must produce the same output. Use the
natural key for conflict resolution, never row order or insert time.

## Export static artifacts for downstream

The payoff of a free engine: precompute, then serve static files. DuckDB transforms; consumers
read plain Parquet/JSON with no engine at all.

```sql
-- compact Parquet for analysts / other DuckDBs
COPY (SELECT * FROM mart_daily) TO 'public/mart_daily.parquet' (FORMAT parquet, COMPRESSION zstd);

-- JSON for a static web frontend (small, already-aggregated results only)
COPY (SELECT region, total FROM summary ORDER BY total DESC)
TO 'public/summary.json' (FORMAT json, ARRAY true);
```

Keep JSON exports small and pre-aggregated — they're for the browser, not bulk transfer. This is
the handoff to **`cheap-data-website`** (publish the files) and **`dashboard`** (chart them). A
nightly cron that runs DuckDB and writes static Parquet/JSON is a complete, no-cost warehouse for
most personal and small-team analytics.

## Footguns

- **Memory**: a huge `ORDER BY`/distinct can exceed RAM — set `PRAGMA memory_limit` and
  `PRAGMA temp_directory` so DuckDB spills to disk instead of OOM-killing.
- **Concurrency**: a `.duckdb` file is single-writer. Concurrent writers corrupt or block —
  serialize writes, or keep state as immutable Parquet snapshots.
- **`python` vs `python3`**: invoke `python3` (Windows MS-Store ships a `python` stub; use `py -3`
  if `python3` isn't found). The `duckdb` CLI binary sidesteps Python entirely for pure-SQL jobs.
- **Pin the version**: Parquet/`.duckdb` files written by a newer DuckDB may not read on an older
  one across your machines — pin the version in the project's lockfile.

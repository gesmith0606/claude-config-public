# Cost control — deep notes

How each engine bills, and the levers that actually move the bill. The `SKILL.md` cost section is
the summary; this is the why and the tuning detail.

## What you pay for, by engine

| Engine | Primary cost unit | Main lever |
|--------|-------------------|-----------|
| BigQuery (on-demand) | **bytes scanned** (per query, min 10 MB/table) | scan less: partitions, clustering, fewer columns |
| BigQuery (capacity) | **slot-hours** (reserved compute) | concurrency & slot allocation |
| Snowflake | **credits = warehouse size × seconds running** (per-second, 60s min) | smaller warehouse, auto-suspend, result cache |
| Databricks | **DBUs = cluster type × uptime** + cloud VM cost | autoscaling, auto-terminate, photon, right instance |
| Postgres / DuckDB | fixed instance / local CPU+RAM | not metered per query — optimize for latency & spill |

Key consequence: in BigQuery you optimize **bytes**; in Snowflake/Databricks you optimize
**time × size**. A query that scans little but runs long is cheap on BQ, costly on SF.

## Partition pruning (the biggest single lever)

Pruning = the engine reads only the partitions/files whose metadata can match your predicate.

- Filter the **partition column directly against a constant**: `WHERE event_date BETWEEN '2026-01-01'
  AND '2026-01-31'`. The engine eliminates non-matching partitions before reading.
- **Pruning-defeating patterns:** `WHERE DATE(event_ts) = '...'` (function on the column),
  `WHERE event_date = some_other_column`, `WHERE CAST(event_date AS STRING) = ...`, or joining the
  partition column to a value the optimizer can't resolve at plan time. Keep the column bare on one
  side and compare to a literal/parameter.
- **Dynamic filters:** a join on the partition key to a small filtered dimension can prune at
  runtime (BQ, SF, DBX support forms of this) — but a literal predicate is the reliable path.
- Verify: BigQuery **dry run** shows bytes (pruned vs not); Snowflake **Query Profile** shows
  "partitions scanned / total"; Databricks shows "files pruned" in the scan node.

## Clustering / micro-partitions

- **Snowflake** auto-builds micro-partitions on load; min/max per column drives pruning even without
  an explicit key. Add `CLUSTER BY` only on **large** tables filtered/joined on a **low-cardinality,
  high-selectivity** column; reclustering costs credits. Don't cluster small or evenly-queried tables.
- **BigQuery** clustering sorts data within each partition by up to 4 columns → block-level pruning
  on equality/range filters. Order cluster columns from most- to least-frequently filtered.
- **Databricks Delta** — prefer **liquid clustering** (`CLUSTER BY`) over Hive partitioning for
  most tables; it avoids small-file and skew problems. `OPTIMIZE` + `ZORDER`/auto-compaction keeps
  files read-efficient. Over-partitioning Delta into many tiny files is a common cost sink.

## SELECT * and column pruning

Columnar formats (Parquet, BQ Capacitor, Delta) store each column separately, so reading 3 of 80
columns reads ~3/80 of the data. `SELECT *`:
- scans every column → full table bytes on BQ, more I/O everywhere;
- breaks **result cache** when schema changes;
- materializes wide intermediates that **spill to disk** (slow, and on SF/DBX bills for the extra
  time). Project only needed columns at every CTE step, not just the final SELECT.

## Result cache & query reuse

- **Snowflake** caches results 24h (extends on reuse) keyed on exact query text + unchanged data +
  same role context. Misses on any text diff, `CURRENT_TIMESTAMP`, or underlying data change. Stable
  parameterized queries hit it for **zero credits and no warehouse spin-up**.
- **BigQuery** caches per-user for ~24h; cached reads are **free** and instant. Non-deterministic
  functions, wildcard tables, or streaming buffers disable caching.
- Practical: keep dashboard/report SQL deterministic and identical run-to-run so it caches; isolate
  the volatile `now()` filter to the smallest possible query.

## Warehouse / cluster sizing

- **Scale up** (bigger warehouse / instance) only when the single query parallelizes — sorts, large
  joins, big scans. Each size step ≈ 2× speed **and** 2× credits/min, so it's cost-neutral *only if*
  runtime halves. It won't help a query bottlenecked on a non-pruned scan or a skewed key.
- **Scale out** (multi-cluster SF / autoscaling DBX) is for **concurrency** — many users at once —
  not for making one query faster.
- **Auto-suspend / auto-terminate** idle compute aggressively (e.g. 60s SF). Idle warehouses burn
  credits for nothing — the most common avoidable bill.
- Separate workloads onto separate warehouses (ELT vs BI) so a heavy load job doesn't force everyone
  onto an oversized shared warehouse.

## Spill, skew, and shuffle

- **Spill to local/remote disk** (SF Query Profile "bytes spilled", Spark "spill") means the
  operation outgrew memory → slower and costlier. Fix by filtering earlier, reducing columns, or
  (last resort) a larger warehouse.
- **Data skew:** one partition key value dominates → one worker does all the work while others idle.
  Salt the key or pre-aggregate. Common after a fan-out join on a hot key.
- **Shuffle** (Spark/Databricks): joins and `GROUP BY` reshuffle data across the cluster. Broadcast
  the small side of a join (`/*+ BROADCAST(dim) */`) to avoid shuffling the large side.

## A cost-debugging order of operations

1. Dry-run / `EXPLAIN` — is bytes/credits in the expected range? If not, it's a query bug, not size.
2. Check pruning: partitions scanned vs total. Fix predicates so the column stays bare.
3. Cut columns: kill `SELECT *`, project only what's needed.
4. Push filters/aggregations before joins; broadcast small dimensions.
5. Look for spill/skew in the profile; address memory or key distribution.
6. Only now consider warehouse size — and confirm runtime actually halves per step up.
7. Make it cacheable so repeat runs cost nothing.

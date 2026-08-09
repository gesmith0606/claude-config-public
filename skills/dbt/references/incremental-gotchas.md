# Incremental-strategy gotchas

Load on demand when an incremental model duplicates, drops, or silently diverges from a full
refresh. The strategy and the filter must agree with the warehouse dialect — defer engine
specifics to the `sql-warehouse` skill.

## Strategy cheat-sheet

| Strategy | How it writes | Needs | Watch out |
|----------|---------------|-------|-----------|
| `append` | inserts new rows only | nothing | dupes if the same row reloads — only safe for immutable event streams |
| `merge` | `MERGE ... ON unique_key` | a real `unique_key` | a non-unique key updates the wrong row; some engines need clustering on the key to be fast |
| `delete+insert` | delete matching keys, then insert | `unique_key` | not atomic on every engine; a duplicate key in the *batch* survives |
| `insert_overwrite` | replace whole partitions | partition column | overwrites the *entire* partition — a partial batch erases rows it didn't reload |

Dialect notes (verify with `sql-warehouse`): BigQuery favors `insert_overwrite` on a partition
column; Snowflake/Redshift/Postgres use `merge` or `delete+insert`; Spark/Delta support
`insert_overwrite` and dynamic partitions.

## The classic bugs

- **Boundary-row loss.** `where ts > (select max(ts) from {{ this }})` drops rows whose `ts`
  equals the current max. Use `>=` and dedup on `unique_key`, or a lookback window.
- **Late-arriving data.** Rows arrive with an older `updated_at` than the cursor — they're behind
  the high-water mark and never load. Use a lookback: `where updated_at > max - interval '3 days'`
  and let `merge` reconcile.
- **Wrong cursor column.** Filtering on `created_at` misses in-place edits. Filter on a column
  that bumps on *every* write (`updated_at`, `_loaded_at`).
- **Non-unique `unique_key`.** Always pair the model with a `unique` test on the same key. If it
  fails, the incremental output is already corrupt.
- **Schema drift.** `on_schema_change` defaults to `ignore` — new source columns silently vanish
  from the incremental table until a full refresh. Set `append_new_columns` (or `sync_all_columns`).
- **First run vs incremental run.** `is_incremental()` is false on first build and on
  `--full-refresh`; the table is built from the full `SELECT`. Make sure that path and the
  incremental path produce identical rows, or results depend on run history.
- **`{{ this }}` self-reference** inside `is_incremental()` reads the existing table — beware
  referencing columns that the new `SELECT` renamed or dropped.

## Verify it

```bash
dbt build --select my_model --full-refresh   # baseline
dbt build --select my_model                   # incremental
# row counts + key aggregates must match a from-scratch rebuild
```

If they diverge, the model is non-deterministic — fix before shipping. Use `dbt build` (not `run`)
so the grain test runs in the same pass.

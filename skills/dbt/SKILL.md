---
name: dbt
description: >-
  Author and review dbt / analytics-engineering projects — staging/intermediate/marts layering,
  ref()/source() lineage, incremental models with correct unique_key, snapshots for SCD-2 /
  restated data, tests, and exposures. Use whenever the user builds or fixes dbt models,
  debugs incremental duplication/missing rows, designs a warehouse transform layer, or wires
  data tests in dbt.
---

# dbt

dbt turns SQL `SELECT`s into a DAG of materialized, tested, documented tables. This skill owns the
*modeling* decisions: how to layer the project, how lineage flows through `ref()`/`source()`, how
to make incremental models and snapshots correct, and how to prove it with tests + exposures.

Three siblings own adjacent concerns — cross-link, don't duplicate:

- **`data-quality`** — the broader testing strategy (what to assert, severity, freshness SLAs).
- **`sql-warehouse`** — dialect quirks, performance, partitioning/clustering of the compiled SQL.
- **`point-in-time-data`** — as-of joins and bitemporal history beyond what dbt snapshots give you.

## Project layering (do this first)

A model belongs to exactly one layer. Build up, never sideways or down:

| Layer | One job | Naming | Materialized |
|-------|---------|--------|--------------|
| **staging** | 1:1 with a source table — rename, cast, light cleanup. No joins, no business logic. | `stg_<source>__<entity>` | view |
| **intermediate** | reusable joins/aggregations between staging and marts; never exposed. | `int_<entity>__<verb>` | view / ephemeral |
| **marts** | business-facing facts & dims, one concept per model. | `fct_<grain>` / `dim_<entity>` | table / incremental |

Rules that keep the DAG clean:

- **`source()` only in staging.** Every raw table is declared once in a `sources:` YAML; every
  downstream model reaches it through a staging model, never the raw table directly.
- **`ref()` everywhere else.** `ref()` builds the dependency graph and makes dev/prod schema
  swaps automatic. A hardcoded `schema.table` outside staging is a bug.
- **One grain per mart.** If you can't state the grain in one sentence ("one row per order per
  day"), the model is doing two jobs — split it. See `references/dimensional-modeling.md`.

## Incremental models + unique_key (the #1 source of bugs)

Incremental models only process new/changed rows, so correctness depends entirely on the filter
and the key. The skeleton:

```sql
{{ config(materialized='incremental', unique_key='order_id',
          incremental_strategy='merge', on_schema_change='append_new_columns') }}

select * from {{ ref('stg_shop__orders') }}
{% if is_incremental() %}
  -- only rows newer than what we've already loaded
  where updated_at > (select max(updated_at) from {{ this }})
{% endif %}
```

Get these right or you ship silent dupes / gaps:

- **`unique_key` must be the true grain** and actually unique. If it isn't, `merge` updates the
  wrong row and `delete+insert` leaves duplicates. Add a `unique` test on the same key to prove it.
- **Use `>=` plus dedup, or a late-arriving lookback window** (`where updated_at > max - interval
  '3 days'`). A strict `>` on `max(updated_at)` drops rows that share the boundary timestamp.
- **The cursor column must monotonically increase on update.** `created_at` misses edits — use an
  `updated_at`/ `_loaded_at` that bumps on every change.
- **`on_schema_change`** decides what happens when columns appear/disappear — default is `ignore`,
  which silently drops new columns. Set it deliberately.
- **A full-refresh must reproduce the table exactly.** If incremental and `--full-refresh` give
  different results, the logic is non-deterministic — fix it. Test with `dbt build --full-refresh`.

Strategy choice (`merge` vs `delete+insert` vs `insert_overwrite`) is dialect-specific — see
`references/incremental-gotchas.md` and defer to `sql-warehouse` for the engine's behavior.

## Snapshots — SCD-2 for mutable / restated source data

When a source row changes in place (a status flips, a figure is restated) and you need the
history, use a **snapshot**, not an incremental model. dbt writes `dbt_valid_from`/`dbt_valid_to`
SCD-2 columns so you can query "what did this row look like on date X".

```sql
{% snapshot snap_orders %}
{{ config(target_schema='snapshots', unique_key='order_id',
          strategy='timestamp', updated_at='updated_at') }}
select * from {{ source('shop', 'orders') }}
{% endsnapshot %}
```

- **`strategy='timestamp'`** (preferred) needs a reliable `updated_at`; **`strategy='check'`**
  diffs a `check_cols` list when there's no trustworthy timestamp (slower, can miss same-tick edits).
- **Snapshot the rawest source you can** and run snapshots *before* the models that read them —
  once history is lost it can't be reconstructed.
- For full as-of/bitemporal joins on top of these, hand off to `point-in-time-data`.

See `references/dimensional-modeling.md` for SCD type 0/1/2/3 trade-offs.

## Tests + exposures

- **Generic tests** (in YAML): `unique`, `not_null`, `accepted_values`, `relationships` (FK
  integrity). Put a `unique` + `not_null` on every model's grain key — minimum bar.
- **Singular tests** (a `.sql` in `tests/` that returns failing rows): use for business rules a
  generic can't express, e.g. "no order total is negative", "daily revenue reconciles to source".
- **Severity & freshness**: `severity: warn` vs `error`, and `sources:` freshness blocks — strategy
  lives in `data-quality`; wire the dbt mechanics here.
- **Exposures** declare downstream consumers (a dashboard, an ML feature table) in YAML so they
  appear in the DAG and docs, and `dbt build -s +exposure:name` tests everything feeding them.

## Workflow

1. Declare sources; build `stg_` models 1:1 with them.
2. Factor shared logic into `int_` models; assemble `fct_`/`dim_` marts at a stated grain.
3. Choose materialization; for incrementals nail `unique_key` + the `is_incremental()` filter.
4. Add snapshots for any mutable/restated source *before* downstream models consume it.
5. Test the grain key (unique+not_null) and the business rules (singular); add exposures.
6. `dbt build` (runs + tests in DAG order); verify incremental == `--full-refresh`.

## SQL linting (sqlfluff)

The `data-pipeline-reviewer` agent already runs `sqlfluff lint`, but it needs a `.sqlfluff` at the project
root that understands dbt's Jinja — otherwise it parses raw `{{ ref() }}` and fails. Minimum config:
`[sqlfluff] templater = dbt` and `dialect = <warehouse>` (e.g. `duckdb`, `snowflake`, `bigquery`), plus the
`sqlfluff-templater-dbt` plugin. Wire it as a pre-commit hook (see `pre-commit-wiring`) so models are
auto-fixed/linted before they land.

## Cross-platform

Invoke as `python3 -m ...` tooling where scripted; on Windows the MS-Store `python` stub may
shadow the real interpreter — prefer `py -3` there. Never hardcode an absolute project path; dbt
resolves everything from `dbt_project.yml` and the `target/` of the active profile.

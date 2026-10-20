---
name: ingest-connectors
description: >-
  Data ingestion (Extract + Load) into a warehouse or local DuckDB using dlt (dlt-hub/dlt).
  Use when pulling data from a REST API, SQL database, or cloud storage and landing it raw,
  setting up incremental cursor-based extraction, or wiring a dlt pipeline into a GitHub
  Actions cron — this skill owns only the get-it-in step.
---

# ingest-connectors

**dlt is the one EL primitive in this stack.** It extracts from REST APIs, SQL databases, and cloud
storage, then lands raw data with state-backed cursors so every run is safe to re-run or backfill.
Everything downstream — modeling, validation, quality — belongs to `dbt`, `data-quality`, and
friends. Stop here once data is raw.

**Egress:** dlt runs fully local, source → destination on your machine. Nothing reaches dlt's hosted
cloud. Ignore "dltHub Pro" / dlt+ managed runtime entirely. Nothing egresses as long as the
destination is your own warehouse (or local DuckDB).

## Install

```bash
uv add "dlt[duckdb]"    # local / personal
uv add "dlt[bigquery]"  # or redshift / snowflake / motherduck for work
```

## Raw landing convention

Land partitioned by date; never overwrite history. Transforms are `dbt`'s job.

```
raw/<source_name>/dt=<YYYY-MM-DD>/*.parquet
```

Pass `loader_file_format="parquet"` and configure the filesystem destination `layout` to enforce
this structure. dlt's filesystem destination supports it natively.

## REST API source (paginated, incremental)

# Adjust paginator + incremental to YOUR API — see dlt's rest_api docs for the exact
# paginator type (cursor / json_link / offset / page_number) and param names.
```python
import dlt
from dlt.sources.rest_api import rest_api_source

source = rest_api_source({
    "client": {
        "base_url": "https://api.example.com/v1/",
        "paginator": {                       # client-level paginator applies to all resources
            "type": "cursor",
            "cursor_path": "meta.next_cursor",  # where the next-page token sits in the response
            "cursor_param": "cursor",           # query-param name to send it back as
        },
    },
    "resources": [{
        "name": "events",
        "endpoint": {
            "path": "events",
            "incremental": {                  # high-water mark: only pull rows newer than last run
                "cursor_path": "updated_at",
                "initial_value": "2020-01-01T00:00:00Z",
            },
        },
        "primary_key": "id",
        "write_disposition": "merge",
    }],
})

pipeline = dlt.pipeline(
    pipeline_name="example_api",
    destination="duckdb",        # swap to "bigquery" etc. for work
    dataset_name="raw_example",
)
pipeline.run(source)
```

`write_disposition="merge"` + `primary_key` is the idempotency contract — safe to re-run, never
double-loads. The `incremental` high-water mark is stored in dlt state alongside the pipeline and
advances automatically each run.

## SQL database source

```bash
uv add "dlt[sql_database]"   # pulls in SQLAlchemy + driver
```

```python
import dlt
from dlt.sources.sql_database import sql_database

source = sql_database(
    "postgresql://user:pass@host:5432/db",
    schema="public",
    table_names=["orders", "customers"],
    incremental=dlt.sources.incremental("updated_at"),
)

pipeline = dlt.pipeline(
    pipeline_name="postgres_raw",
    destination="duckdb",
    dataset_name="raw_postgres",
)
pipeline.run(source)
```

## File / cloud storage source

```bash
uv add "dlt[s3]"   # or [gcs] / [az]
```

```python
from dlt.sources.filesystem import filesystem, read_parquet

source = filesystem("s3://my-bucket/exports/") | read_parquet()
pipeline = dlt.pipeline("s3_raw", destination="duckdb", dataset_name="raw_s3")
pipeline.run(source)
```

## Drop into GitHub Actions cron

Following `cheap-data-orchestration` — add a job to your existing workflow or a new `ingest.yml`:

```yaml
- name: Run dlt pipeline
  run: uv run python pipelines/example_api.py
  env:
    DESTINATION__BIGQUERY__CREDENTIALS: ${{ secrets.BQ_CREDENTIALS }}
    SOURCES__EXAMPLE_API__API_KEY: ${{ secrets.EXAMPLE_API_KEY }}
```

dlt reads secrets from env vars automatically (or from `.dlt/secrets.toml` locally — gitignore
that file). State is persisted to the destination schema; re-runs resume from the last cursor.
Add `workflow_dispatch` to your trigger block for on-demand backfills.

## Verify / inspect locally

```bash
# macOS
python3 -c "import dlt; print(dlt.__version__)"

# Windows (never bare `python` — it hits the MS Store stub)
py -3 -c "import dlt; print(dlt.__version__)"

# Check last pipeline state
uv run python -c "
import dlt
p = dlt.attach(pipeline_name='example_api')
print(p.last_trace)
"
```

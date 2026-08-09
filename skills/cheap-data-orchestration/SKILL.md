---
name: cheap-data-orchestration
description: >-
  Cost-optimal scheduling for solo / small-team data pipelines: a GitHub Actions cron job that
  runs dbt-core or scripts, publishes results, and stays correct on retries. Use for scheduling a
  recurring pipeline cheaply, nightly/hourly ETL without a server, idempotent/backfillable jobs,
  retries/alerting, or when weighing Airflow/Dagster/Prefect.
---

# Cheap Data Orchestration

The cheapest orchestrator most solo and small-team pipelines need is **a scheduled GitHub Actions
workflow** (or GitLab CI / cron on a box you already pay for). It is free at low volume, versioned
with your code, and needs no always-on server. This skill is about making that humble setup
*correct and operable* — not about maximum throughput (that's `data-throughput-accelerator`) and
not about ML (`mle-workflow`).

Shape of the job: **cron trigger → extract/load → dbt-core or scripts → quality gate → publish →
alert on failure.** Put a `data-quality` check *between* transform and publish so bad data never
ships. Cross-link: `dbt` for the transform layer, `data-quality` for the gate.

## When this is enough (and when it isn't)

Stay on cron-CI while **all** of these hold:

- Schedule is time-based (every N hours / nightly), not event-driven.
- The DAG is shallow — a handful of steps that run start-to-finish, few cross-job dependencies.
- A run finishes inside the CI job time limit (GitHub: 6h/job) with room to spare.
- Backfills are occasional and you can babysit them.
- One or two people operate it.

**Graduate to Airflow / Dagster / Prefect** when you hit two or more of:

- Real inter-task dependencies, fan-out/fan-in, or dynamic task counts.
- You need per-task retries, partial restarts, and a backfill UI (don't hand-roll these).
- Cross-pipeline dependencies / data-aware scheduling (run X when table Y lands).
- SLAs, on-call, and a lineage/observability UI that non-authors read.
- Many schedules whose overlaps and resource contention you can no longer track by hand.

Pick by ops cost, not fashion: **Prefect** (lightest, Python-native, hybrid hosted) → **Dagster**
(asset/lineage-first, great with dbt) → **Airflow** (ubiquitous, heaviest to run; use managed
MWAA/Composer/Astronomer, never self-host as your first move). Managed > self-hosted until you
have a platform owner. If you're tempted purely by *speed*, that's the wrong reason — see
`data-throughput-accelerator` first.

## The five properties that make a cron pipeline safe

1. **Idempotent** — re-running the same logical period produces the same end state, no dupes. Use
   `MERGE`/upsert on a natural key, or delete-then-insert the target partition, or dbt
   incremental with a `unique_key`. Never blind `INSERT` into a serving table.
2. **Deterministic partitions** — derive the period from the *schedule*, not `now()`. Pass an
   explicit `run_date` (default = yesterday for daily) so a run is reproducible and a missed run
   can be replayed. Partition raw/derived tables by that key.
3. **Safe, repeatable backfill** — the same code path fills history one partition at a time; see
   `references/backfill-checklist.md`. Backfilling should be re-running normal logic with
   different dates, not a special script.
4. **Retries + alerting** — retry the *transient* (network, rate limit, warehouse contention),
   fail fast on the *deterministic* (bad SQL, contract break). Always alert on final failure;
   silence on success is fine.
5. **Quality gate before publish** — run `data-quality` / dbt tests between transform and publish.
   A failed gate blocks the publish step; it does not warn-and-continue.

## Build order

1. Get the job running *manually* first (`workflow_dispatch`) end-to-end before adding the cron.
2. Make the target write idempotent (property 1) — this is the one that bites hardest.
3. Parameterize the period (property 2): `run_date` input with a yesterday default.
4. Add the quality gate, then the publish step.
5. Add retries on the flaky steps and failure alerting.
6. Add the cron `schedule:`. Stagger minutes (e.g. `17 6 * * *`, not `0 0`) — top-of-hour is
   congested on shared runners and likelier to be delayed.
7. Document one-command backfill in the README.

Starter workflow: `references/github-actions-cron.yml`. Backfill steps: `references/backfill-checklist.md`.

## Idempotency patterns (cheapest first)

| Situation | Pattern |
|-----------|---------|
| dbt model, append-heavy table | `materialized='incremental'` + `unique_key` + predicate on `run_date` |
| Custom SQL into a partitioned table | `DELETE WHERE partition = :run_date; INSERT …` in one transaction |
| Warehouse with upsert | `MERGE` on natural key |
| File output (CSV/parquet) | Write to `…/dt=<run_date>/` — overwrite the whole partition dir |
| External API publish | Idempotency key = `(dataset, run_date)`; PUT/upsert, never POST-append |

## Cost & footguns

- **Free-tier reality:** GitHub Actions is free on public repos and metered on private — schedule
  no tighter than the data actually changes. Hourly when daily suffices is just spend.
- **Scheduled runs use the default branch's** workflow file, and GitHub may **disable schedules
  after ~60 days of repo inactivity** — a `workflow_dispatch` smoke test keeps it warm.
- **Secrets** via the CI secret store / OIDC to the warehouse — never commit credentials; pair
  with `insecure-defaults` if unsure.
- **Concurrency:** add a `concurrency:` group so a long run can't overlap the next tick and double-write.
- **Silent skips:** a job that exits 0 having done nothing is the worst failure. Assert rows
  written / partitions touched and fail loudly if zero (see `silent-failure-hunter`).
- **Runner clock = UTC.** Write crons in UTC and comment the local intent; DST will shift it otherwise.
- Keep raw, derived, and serving tables separately accountable — same discipline as `data-throughput-accelerator`.

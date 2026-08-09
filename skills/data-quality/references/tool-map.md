# Data-quality tool map: dbt tests vs Great Expectations vs Pandera vs Soda

All four implement the same assertion catalog (see SKILL.md); they differ in *where the data lives*,
*what language you write in*, and *how the gate blocks*. Match the tool to the runtime, not hype.

## Quick pick

| Situation | Reach for |
|-----------|-----------|
| Data already modeled in a warehouse with **dbt** | **dbt tests** — assertions as SQL, gate = `dbt build` fails the run |
| **DataFrames** in Python/Pandas/Polars/Spark, mid-pipeline | **Pandera** — schema as code, validates in-process |
| Want a **profiling-first**, expandable expectation suite + data docs | **Great Expectations** |
| Want **YAML checks** monitoring warehouse/lake tables, analyst-friendly, low Python | **Soda** (Soda Core / SodaCL) |
| Need a portable contract that runs both in CI and on a DataFrame | **Pandera** (Python) or a **dbt** contract (warehouse) |

## dbt tests
- **Runs where:** in the warehouse, as SQL the dbt run compiles. No data leaves the DB.
- **Write in:** YAML (built-ins: `unique`, `not_null`, `accepted_values`, `relationships`) +
  custom/`dbt_utils`/`dbt_expectations` for range, row-count, freshness, recency.
- **Gate:** `dbt build` runs models + tests together; a failing test (`severity: error`) fails the
  build, so the gate is native — downstream models don't run on bad data. `source freshness` covers SLA.
- **Pick when:** transformations already live in dbt. Lowest marginal effort — the tests sit next
  to the models. See the **dbt** and **sql-warehouse** skills.
- **Weak at:** row-level Python logic, profiling, non-warehouse data.

## Great Expectations (GX)
- **Runs where:** Python, against Pandas/Spark/SQL via execution engines.
- **Write in:** Python "Expectations" (e.g. `expect_column_values_to_not_be_null`,
  `expect_column_values_to_be_between`), grouped into suites; can **auto-profile** to suggest them.
- **Gate:** a Checkpoint returns pass/fail; you wire that into the orchestrator to halt. Generates
  **Data Docs** (HTML validation reports) — strong for stakeholder-visible quality.
- **Pick when:** you want a rich, documented, profiling-driven suite and don't mind the heavier
  setup/config surface.
- **Weak at:** ceremony — historically verbose config; overkill for a few checks on one table.

## Pandera
- **Runs where:** in-process, on a DataFrame (Pandas, Polars, Spark, Dask).
- **Write in:** Python `DataFrameSchema` / typed `DataFrameModel` (Pydantic-style classes) with
  column dtypes, nullable flags, `Check.in_range`, `Check.isin`, uniqueness, custom checks.
- **Gate:** `schema.validate(df, lazy=True)` raises `SchemaErrors` on failure — fail closed by
  letting it raise (do **not** swallow it; that's the silent-failure-hunter anti-pattern). Coerces
  types if asked.
- **Pick when:** validation belongs *inside* a Python transform, in unit tests, or at an API/IO
  boundary. Lightest weight; lives in the code with the data.
- **Weak at:** whole-warehouse-table checks (it needs the data in memory/engine), data docs.

## Soda (Soda Core / SodaCL)
- **Runs where:** pushes checks down to the warehouse/lake (Snowflake, BigQuery, Spark, Postgres…).
- **Write in:** **SodaCL** — readable YAML (`row_count > 0`, `missing_count(col) = 0`,
  `duplicate_count(key) = 0`, `freshness(ts) < 1d`), plus distribution/anomaly checks.
- **Gate:** `soda scan` exits non-zero on failed checks → orchestrator halts. Analyst-friendly, low
  Python; optional hosted UI for monitoring/alerting.
- **Pick when:** you want lightweight, declarative monitoring across warehouse tables without
  embedding it in a dbt project or writing much Python.
- **Weak at:** row-level imperative logic; deep in-DataFrame validation.

## Rules of thumb
- **Already in dbt? Use dbt tests** before adding any other tool — least new surface area.
- **Validating a Python DataFrame? Pandera** — keep it in-process and let it raise.
- **Want profiling + shareable reports? GX.** **Want declarative YAML monitoring? Soda.**
- Don't run two overlapping frameworks for the same checks — pick one per layer and keep the
  contract single-sourced.
- Whichever you choose, the **gate discipline is the same**: a failing check must *block
  promotion*, and the orchestrator (**cheap-data-orchestration**) must surface it, not bury it.

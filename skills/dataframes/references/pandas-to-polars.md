# pandas → polars idiom cheatsheet

Polars is multithreaded, vectorized, and has a lazy optimizer. The mental shift: polars has **no
index**, expressions are **first-class** (`pl.col(...)`), and you compose them inside `select`,
`filter`, `with_columns`, `group_by`. Prefer **lazy** (`pl.scan_*` → `.collect()`) for multi-step
work so the optimizer can push filters/projections down.

Run Python as `python3` (on Windows the MS-Store `python` stub may shadow it; `py -3` also works).
`pip install polars` (or `polars-lts-cpu` on older CPUs without AVX2).

## Read / write

| pandas | polars (eager) | polars (lazy) |
|--------|----------------|---------------|
| `pd.read_csv("f.csv")` | `pl.read_csv("f.csv")` | `pl.scan_csv("f.csv")` |
| `pd.read_parquet("f.pq")` | `pl.read_parquet("f.pq")` | `pl.scan_parquet("f.pq")` |
| `df.to_parquet("o.pq")` | `df.write_parquet("o.pq")` | `lf.sink_parquet("o.pq")` |

`scan_*` reads nothing until `.collect()`; the plan then reads only the columns/rows actually used.

## Select / filter / new columns

| Task | pandas | polars |
|------|--------|--------|
| Pick columns | `df[["a","b"]]` | `df.select("a","b")` |
| Filter rows | `df[df.a > 0]` | `df.filter(pl.col("a") > 0)` |
| New column | `df["c"] = df.a + df.b` | `df.with_columns((pl.col("a")+pl.col("b")).alias("c"))` |
| Conditional | `np.where(df.a>0,1,0)` | `pl.when(pl.col("a")>0).then(1).otherwise(0)` |
| Rename | `df.rename(columns={"a":"x"})` | `df.rename({"a":"x"})` |
| Drop NA | `df.dropna()` | `df.drop_nulls()` |
| Fill NA | `df.fillna(0)` | `df.fill_null(0)` |

Note: polars distinguishes **null** (missing) from **NaN** (float not-a-number) — they are different
values, unlike pandas where both collapse onto NaN. Use `fill_null` vs `fill_nan` deliberately.

## Group / aggregate / join

| Task | pandas | polars |
|------|--------|--------|
| Group sum | `df.groupby("k")["v"].sum()` | `df.group_by("k").agg(pl.col("v").sum())` |
| Multi-agg | `df.groupby("k").agg({"v":"sum","n":"mean"})` | `df.group_by("k").agg(pl.col("v").sum(), pl.col("n").mean())` |
| Join | `df.merge(r, on="id", how="left", validate="1:1")` | `df.join(r, on="id", how="left", validate="1:1")` |
| Sort | `df.sort_values("a")` | `df.sort("a")` |
| Unique | `df.drop_duplicates()` | `df.unique()` |
| Row count | `len(df)` | `df.height` |

Polars `join` also supports `validate=` (`"1:1"`, `"1:m"`, `"m:1"`) — keep using it to catch
unexpected fan-out, same as pandas.

## Window / over (no manual loop)

```python
# pandas: per-group rank
df["rank"] = df.groupby("k")["v"].rank()
# polars: window expression
df.with_columns(pl.col("v").rank().over("k").alias("rank"))
```

## Lazy pipeline example

```python
import polars as pl
out = (
    pl.scan_parquet("events/*.parquet")     # nothing read yet
      .filter(pl.col("ts") >= "2026-01-01")  # pushed down to the scan
      .group_by("user_id")
      .agg(pl.col("amount").sum().alias("total"))
      .sort("total", descending=True)
      .collect()                             # optimizer runs the whole plan once
)
```

## duckdb interop (when data > RAM or you want SQL)

```python
import duckdb
# Query parquet on disk directly — streamed, not fully loaded:
df = duckdb.sql("""
    SELECT user_id, sum(amount) AS total
    FROM 'events/*.parquet'
    WHERE ts >= '2026-01-01'
    GROUP BY user_id
    QUALIFY row_number() OVER (ORDER BY total DESC) <= 100
""").pl()        # .pl() → polars, .df() → pandas, .arrow() → Arrow (zero-copy)
```

DuckDB and polars share Arrow memory, so handoffs are near-free. Reach for duckdb when the transform
is naturally relational, spans many files, or the data won't fit in RAM; for a *persistent* local
warehouse use the `duckdb-warehouse` skill instead of one-off `duckdb.sql`.

## Gotchas crossing over

- **No index in polars** — there's no `set_index`/`reset_index`; carry keys as ordinary columns.
- **Expressions, not bracket assignment** — you can't do `df["c"] = ...`; use `with_columns`.
- **Eager `.collect()` once** — building a `LazyFrame` does no work until you collect; don't collect
  mid-pipeline in a loop.
- **null vs NaN** — see above; the two are distinct in polars.
- **`.to_pandas()` / `pl.from_pandas()`** convert at boundaries when an ecosystem lib needs pandas.

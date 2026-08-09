---
name: dataframes
description: >-
  Correct and performant in-process dataframe work in pandas, polars, and duckdb. Use when
  writing or debugging pandas/polars code, when a transform gives wrong numbers, surprise NaNs,
  dtype changes, or duplicated rows after a merge/join, when a notebook is slow or out of memory
  on a big CSV/parquet, or when choosing a dataframe engine.
---

# Dataframes

Get the *right* numbers out of a dataframe, fast, in one process. This skill owns the in-memory
correctness footguns (pandas especially) and the engine-choice decision. It is *not* about pipeline
throughput — moving/backfilling/loading lots of data is `data-throughput-accelerator`; charting the
result is `dashboard`; a durable SQL warehouse over parquet is `duckdb-warehouse`.

First rule: **most "pandas is wrong" bugs are silent, not loud.** A merge that doubles your rows or
a column that became `object` won't raise — it just poisons every downstream number. Assume nothing;
assert the shape.

## Pandas footguns (the silent ones)

**1. SettingWithCopy / chained assignment.** `df[df.a > 0]['b'] = 1` mutates a temporary copy and
silently does nothing (pandas < 3.0 / non-CoW). Never chain `[]` then assign. Use one `.loc`:
`df.loc[df.a > 0, 'b'] = 1`. When you mean a new independent frame, say so: `sub = df[mask].copy()`.
Pandas 3.0 makes Copy-on-Write the default and removes the warning — code that *relied* on chained
assignment mutating in place will now no-op. The `.loc` idiom is correct under every version.

**2. Silent dtype coercion.** One NaN turns an int column into `float64`; one missing string makes
a column `object`. Mixed types in a column → `object`, which is slow and compares oddly. Set dtypes
explicitly on read (`pd.read_csv(..., dtype={...})`), use nullable dtypes (`Int64`, `boolean`,
`string`) when you need NA *and* integers, and check `df.dtypes` after any merge/concat/`apply`.

**3. Merge cardinality.** The #1 source of inflated totals: a join you assumed was 1-to-1 is
actually 1-to-many because the right key has duplicates. **Always pass `validate=`:**
`df.merge(rhs, on='id', how='left', validate='1:1')` (or `'1:m'`, `'m:1'`). It raises instead of
silently fanning out rows. Check `len(df)` before and after. Also set `indicator=True` when you care
which side matched.

**4. NaN is not equal to itself.** `np.nan == np.nan` is `False`, so `df[df.x == np.nan]` finds
nothing — use `df.x.isna()`. `groupby` *drops* NaN keys by default (`dropna=False` to keep them).
`value_counts()` hides NaN unless `dropna=False`. `sum()` skips NaN; `count()` excludes it. A stray
NaN in a join key never matches. Decide NaN policy explicitly, per operation.

**5. Index traps.** Operations align on the index, not on row position. After `df[mask]` the index
has gaps, so `reset_index(drop=True)` before positional work or `concat`. Arithmetic between two
Series aligns by index label — mismatched indexes give NaN, not an error. `concat` without
`ignore_index=True` can duplicate index labels. Use `.iloc` for position, `.loc` for label; never
assume they coincide.

**6. `apply` / `iterrows` are slow and lossy.** A row-wise `apply` is a Python loop; `iterrows`
also coerces each row to a Series (dtype loss). Prefer vectorized ops, `np.where`, `.map`, or
`groupby`. If you truly need per-group Python, `groupby().apply` beats manual loops. Reaching for
`iterrows` is usually the signal to switch engines (below).

**7. `inplace=True` is not a free lunch.** It rarely saves memory, defeats method chaining, and is
deprecated in several pandas APIs. Just reassign: `df = df.dropna()`.

See **`references/pandas-to-polars.md`** for a side-by-side idiom cheatsheet.

## Which engine — pandas vs polars vs duckdb

Pandas is the default for small/medium in-memory data and the richest ecosystem. Switch when:

| Situation | Reach for |
|-----------|-----------|
| Data fits in RAM, modest size, lots of ad-hoc slicing, ecosystem libs | **pandas** |
| Same data but slow / CPU-bound / you're writing `apply` loops | **polars** (multithreaded, vectorized) |
| Complex multi-step transform you want optimized as a whole | **polars lazy** (`scan_*` → `.collect()`) |
| Data bigger than RAM, or you just want to query parquet/CSV with SQL | **duckdb** (out-of-core, streaming) |
| Joins/aggregations over many parquet files on disk | **duckdb** (`SELECT ... FROM 'data/*.parquet'`) |
| A persistent local warehouse, not a one-shot query | **`duckdb-warehouse`** skill |

Rules of thumb:

- **polars lazy** (`pl.scan_csv`/`scan_parquet` → build the plan → `.collect()`) lets the query
  optimizer push projections/filters down and only read the columns/rows you use. This alone often
  beats pandas by an order of magnitude and cuts memory. Use lazy by default for multi-step work.
- **duckdb** reads parquet/CSV *without loading it all* — it streams and spills to disk, so it
  handles datasets larger than RAM and runs real SQL (window functions, `QUALIFY`, joins). Great
  when the transform is naturally relational or the file won't fit. `duckdb.sql("...").df()` hands
  results back to pandas; polars and duckdb share Arrow memory, so conversions are near-free.
- They interoperate: stay in one engine per transform, convert at the boundaries via Arrow. Don't
  thrash between all three in one function.
- This is *engine choice for a single in-process transform*. If the real problem is "ingest/backfill
  millions of rows fast and prove correctness," that's `data-throughput-accelerator`, not this.

## Correctness habits (every engine)

- **Assert shape after every join/concat/pivot:** `assert len(df) == n_expected`. Cheap, catches
  fan-out immediately.
- **Pin dtypes on read**, and re-check after transforms that can coerce.
- **Name your NaN policy** at each aggregation (drop? keep? fill?). Don't let defaults decide.
- **Reproducible reads:** specify columns, dtypes, and (for CSV) `na_values`/`parse_dates` rather
  than trusting inference. Inference differs across files and versions.
- **Floats don't compare exact:** use `np.isclose` / `pytest.approx`, never `==`, for computed
  floats.

## Notebook hygiene

Notebooks are where dataframe work happens and where data leaks happen.

- **Never commit data rows or PII.** Cell outputs embed real rows (names, emails, account numbers)
  straight into the `.ipynb` JSON and into git history. **Clear all outputs before committing**
  (`jupyter nbconvert --clear-output --inplace nb.ipynb`) or strip them automatically with an
  `nbstripout` git filter. Treat the committed notebook as public.
- **Restart-and-run-all before trusting results.** Out-of-order cell execution makes notebooks lie —
  a variable may reflect a cell you've since edited or deleted. Hidden state is a correctness bug.
- **Don't hardcode absolute paths or secrets** in cells; read from config/env. Sample data, not the
  full PII dataset, for anything shared.
- **Graduate stable logic out of the notebook** into a tested module once it works — notebooks are
  for exploration, not the source of truth.

## Pre-flight checklist

Before trusting a dataframe result: dtypes checked after the last coercing op · every merge has
`validate=` and a row-count assertion · NaN policy chosen per aggregation · index reset before
positional/concat work · floats compared with tolerance · notebook outputs cleared and
restart-run-all is clean before commit.

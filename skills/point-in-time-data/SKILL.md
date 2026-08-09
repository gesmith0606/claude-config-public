---
name: point-in-time-data
description: >-
  Get temporal / bitemporal data correct — valid-time vs system-time, as-of joins, late-arriving
  and restated data, effective-dating, reconciliation tie-outs. Use whenever a query must reflect
  "what was true (or what we knew) AS OF a date": audit trails, event sourcing, SCD,
  point-in-time reporting, FX-on-trade-date, restatements, as-of NAV, or when historical numbers
  must reproduce exactly.
---

# Point-in-time data

> **Routing:** general SCD modeling mechanics in dbt → `dbt` (snapshots); column null/freshness/uniqueness checks → `data-quality`; warehouse SQL tuning → `sql-warehouse`.

The core question this skill answers: **"as of *which* date?"** Most temporal bugs come from
conflating two independent clocks, then joining on the wrong one. Get the clocks straight first,
then everything else (as-of joins, restatements, tie-outs) follows.

## The two clocks (valid-time vs system-time)

Every temporal fact has up to two independent time axes. Bitemporal = track both.

- **Valid-time** — when the fact was true *in the real world*. (Address effective 2024-03-01;
  FX rate *for* trade date; salary effective from promotion date.) Set by the business.
- **System-time** (a.k.a. transaction-time, knowledge-time) — when *the system learned* it.
  (Row inserted/loaded at 2024-03-05 09:14.) Set by the database, append-only, never edited.

They diverge constantly: a fact valid 2024-03-01 may be *recorded* 2024-03-05 (late arrival), or
*corrected* 2024-04-10 (restatement). Two distinct questions, two distinct answers:

- "What is Alice's address **for** March?" → filter **valid-time**.
- "What did our report **say** on March 6?" → filter **system-time** (reproduce a past run).

If you only keep one clock, decide deliberately which question you are giving up the ability to
answer. Audit/compliance and financial restatement work almost always need **both**.

## Effective-dating: the row shape

Model each version as a row with a half-open interval `[valid_from, valid_to)` — inclusive start,
**exclusive** end. Half-open intervals are the single biggest bug-avoider: adjacent versions share
a boundary instant with **zero gap and zero overlap**, and `>= from AND < to` can never double-count.

| Pattern | Rows kept | Use when |
|---|---|---|
| SCD type 1 | overwrite, no history | history doesn't matter (dimension scrub) |
| SCD type 2 | one row per version + `[valid_from, valid_to)` + `is_current` | the workhorse — keep this |
| Bitemporal | SCD2 **plus** `system_from/system_to` | audit, restatements, "what did we know when" |

Current row convention: open-ended `valid_to = '9999-12-31'` (or NULL — pick one project-wide; a
sentinel keeps `BETWEEN`/index range-scans simple). Exactly one `is_current` per natural key.

## As-of joins (the heart of it)

An **as-of join** matches each probe row to the dimension version *in effect at the probe's date* —
"the most recent value at or before T", not an exact-date equality. Native in some engines
(`ASOF JOIN` in DuckDB/ClickHouse; pandas `merge_asof`); elsewhere it's a range join. The shape:

```sql
-- value that was effective for each event (general SCD2 pattern)
SELECT e.event_id, e.event_ts, d.attr
FROM   events e
JOIN   dim_history d
  ON   d.natural_key = e.natural_key
 AND   e.event_ts >= d.valid_from
 AND   e.event_ts <  d.valid_to        -- half-open: no overlap, no gap
```

Worked SQL for both flavors — valid-time as-of *and* system-time "as we knew it" — plus
gap/overlap guards and the FX-on-trade-date and as-of-NAV finance cases:
**`references/as-of-joins.md`**.

## Late-arriving and restated data

- **Late-arriving fact** — valid-time is in the past, system-time is now. Insert with the *true*
  `valid_from`; recompute anything that already aggregated that window. Backfill ≠ append.
- **Late-arriving dimension** — a fact references a dimension version that doesn't exist yet.
  Park on an `unknown`/inferred member, reprocess on arrival; never drop the fact.
- **Restatement / correction** — a previously-recorded value was wrong. In a bitemporal store you
  **never UPDATE in place**: close the old version's `system_to` and insert a corrected version.
  This preserves "what we reported then" (system-time) *and* "what was actually true" (valid-time).
  Examples: a restated quarterly earnings figure; a vendor-corrected FX rate; an amended timesheet.

Rule: **reproducibility beats tidiness.** If a number on a past report can't be regenerated to the
penny, you have destroyed system-time. Append corrections; don't mutate.

## Reconciliation tie-outs

Temporal pipelines are validated by **tie-outs** — independent recomputations that must agree:

1. **Interval integrity** per natural key: no overlaps, no gaps, exactly one current row.
   (Window `LEAD(valid_from)` vs `valid_to`.) See references.
2. **As-of reproducibility**: rerunning a report "as of" a past date reproduces that day's numbers
   bit-for-bit (proves system-time intact).
3. **Cross-system tie-out**: as-of total vs an independent source (e.g. as-of position value vs
   custodian statement; ledger sum vs subledger) within a stated tolerance, and reconcile the diff.

Surface tie-outs as a hard block, like data-throughput-accelerator's accounting:

```text
Point-in-time tie-out (as of 2024-03-31):
- Natural keys checked:        12,455
- Interval overlaps:                0   (must be 0)
- Interval gaps:                    0   (must be 0)
- Keys with != 1 current row:       0   (must be 0)
- As-of total vs custodian:  diff 0.00  (tol 0.01)
```

## Pitfalls (full catalog in references)

- Joining a fact to the **current** dim row instead of the as-of version (the classic SCD bug).
- `BETWEEN valid_from AND valid_to` — inclusive both ends → **double-counts** boundary rows. Use
  `>= from AND < to`.
- Timezone/DST: store instants in UTC; a "date" boundary is meaningless without a zone.
- Filtering only valid-time when the user actually asked "what did we know on day X".
- `UPDATE`-in-place corrections — silently rewrites history; restatements become unprovable.
- Off-by-one at the open end (NULL vs `9999-12-31`) breaking `<` comparisons.

Common bugs with reproductions and fixes: **`references/pitfalls.md`**.

## Where this sits

- Materializing SCD2 history mechanically → the **dbt** skill (snapshots do exactly this).
- Null/freshness/uniqueness/row-count assertions → **data-quality**.
- Making the range/as-of joins fast at scale (clustering, partition pruning) → **sql-warehouse**.

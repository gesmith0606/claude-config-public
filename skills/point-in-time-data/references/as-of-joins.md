# As-of join patterns (worked SQL)

All examples use half-open intervals `[valid_from, valid_to)` and a `9999-12-31` open-end sentinel.
Swap to NULL end-dates if that's your project convention (then use `COALESCE(valid_to,'9999-12-31')`
or `(valid_to IS NULL OR ts < valid_to)`).

## 1. Valid-time as-of join (SCD2) — general

"For each event, the attribute value that was *in effect in the real world* at the event time."

```sql
SELECT e.event_id, e.event_ts, d.attr
FROM   events e
JOIN   dim_history d
  ON   d.natural_key = e.natural_key
 AND   e.event_ts >= d.valid_from
 AND   e.event_ts <  d.valid_to;
```

Engines with a native operator (clearer + faster):

```sql
-- DuckDB / ClickHouse
SELECT e.event_id, d.attr
FROM   events e
ASOF JOIN dim_history d
  ON   d.natural_key = e.natural_key
 AND   d.valid_from <= e.event_ts;       -- picks the latest version at/<= event_ts
```

```python
# pandas: both frames sorted by the time key
pd.merge_asof(events.sort_values("event_ts"),
              dim.sort_values("valid_from"),
              left_on="event_ts", right_on="valid_from",
              by="natural_key", direction="backward")   # backward = at-or-before
```

## 2. System-time "as we knew it" — reproduce a past report

"Reproduce the report exactly as it stood on `@as_of_run` — ignore everything learned afterward."
Filter **system-time**, then resolve valid-time within that visible slice.

```sql
WITH visible AS (                         -- only rows known as of the run date
  SELECT * FROM dim_bitemporal
  WHERE system_from <= @as_of_run
    AND system_to   >  @as_of_run
)
SELECT e.event_id, v.attr
FROM   events e
JOIN   visible v
  ON   v.natural_key = e.natural_key
 AND   e.event_ts >= v.valid_from
 AND   e.event_ts <  v.valid_to;
```

This is the bitemporal payoff: change `@as_of_run` to "today" and you get the corrected truth;
set it to a past date and you reproduce what the system reported then — same query, two questions.

## 3. Finance: FX conversion on trade date

Convert each trade using the rate **for** its trade date (valid-time), not today's rate.

```sql
SELECT t.trade_id, t.ccy, t.amount,
       t.amount * fx.rate AS amount_usd
FROM   trades t
JOIN   fx_rates fx
  ON   fx.ccy_pair = t.ccy || '/USD'
 AND   t.trade_date >= fx.valid_from
 AND   t.trade_date <  fx.valid_to;
```

If a vendor later *restates* a rate, you don't UPDATE: close the old `system_to`, insert the
corrected version, and pattern #2 still reproduces yesterday's P&L while today's run uses the fix.

## 4. Finance: as-of NAV / positions

Value a portfolio "as of" a date: take each holding's quantity effective that date and the price
effective that date.

```sql
WITH asof AS (SELECT DATE '2024-03-31' AS d)
SELECT h.instrument,
       h.qty,
       p.px,
       h.qty * p.px AS market_value
FROM   asof a
JOIN   holdings_history h
  ON   a.d >= h.valid_from AND a.d < h.valid_to
JOIN   price_history p
  ON   p.instrument = h.instrument
 AND   a.d >= p.valid_from AND a.d < p.valid_to;
```

## 5. Interval-integrity checks (tie-out #1)

```sql
-- overlaps & gaps: each row's valid_to must equal the next valid_from
SELECT natural_key, valid_from, valid_to,
       LEAD(valid_from) OVER (PARTITION BY natural_key ORDER BY valid_from) AS next_from
FROM   dim_history
QUALIFY next_from IS NOT NULL AND next_from <> valid_to;   -- any row => gap or overlap

-- exactly one current row per key
SELECT natural_key, COUNT(*) c
FROM   dim_history WHERE is_current
GROUP  BY natural_key HAVING COUNT(*) <> 1;
```

(`QUALIFY` is Snowflake/BigQuery/DuckDB; elsewhere wrap in a subquery and filter.)

## Performance note

Range/as-of joins can't use a plain equi-join hash. Cluster/partition `dim_history` on
`natural_key, valid_from`; range-prune on the probe date. Push tuning to the `sql-warehouse` skill.

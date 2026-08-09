# Common point-in-time bugs

Each entry: the symptom, why it happens, the fix.

## 1. Joining to the *current* dimension row (the classic SCD bug)

**Symptom:** historical reports change every time a dimension is updated; last year's revenue-by-
region shifts when a customer's region is edited today.

**Why:** the fact was joined to `dim` filtered on `is_current = true` (or to a type-1 overwrite),
so every old fact is decorated with *today's* attribute.

**Fix:** join to the version effective at the fact's date — as-of join on `event_ts >= valid_from
AND event_ts < valid_to`. Keep SCD2 history; never resolve dimensions with `is_current` for
historical facts.

## 2. `BETWEEN` double-counts boundaries

**Symptom:** a fact dated exactly on a version boundary appears twice; sums are slightly too high.

**Why:** `event_ts BETWEEN valid_from AND valid_to` is inclusive on *both* ends, so the instant a
version ends (and the next begins) matches two rows.

**Fix:** half-open intervals — `event_ts >= valid_from AND event_ts < valid_to`. Make this the
house rule and never use `BETWEEN` for interval matching.

## 3. UPDATE-in-place corrections destroy system-time

**Symptom:** can't reproduce last month's report; auditor asks "what did this say on the 6th" and
there's no answer.

**Why:** a restatement was applied with `UPDATE ... SET value = corrected`, overwriting the
previously-recorded value. System-time is gone.

**Fix:** bitemporal append — close `system_to` on the old row, insert a new row with the corrected
value and a fresh `system_from`. The old version stays queryable.

## 4. Late-arriving facts silently lost or mis-aggregated

**Symptom:** a record that arrives days late never shows up, or lands in the wrong period.

**Why:** the loader stamped `valid_from = load_date` instead of the true business date, or an
aggregate for that window was already finalized and never recomputed.

**Fix:** stamp `valid_from` from the *business* event time; treat the window as dirty and recompute
(backfill), don't just append. For dims that arrive after their facts, park facts on an `unknown`
member and reprocess on arrival — never drop them.

## 5. Timezone / DST boundary errors

**Symptom:** events near midnight land in the wrong day; one day a year has 23 or 25 hours of data.

**Why:** "date" was computed in local time, or instants were stored without a zone and compared
across DST.

**Fix:** store instants in UTC; define each reporting "day" with an explicit zone at query time.
Never compare naive local timestamps across a DST transition.

## 6. Open-end sentinel vs NULL mismatch

**Symptom:** current rows vanish from as-of queries, or `< valid_to` throws on NULL.

**Why:** half the pipeline uses `valid_to = '9999-12-31'`, half uses NULL; comparisons disagree.

**Fix:** pick one project-wide. With NULL ends use `(valid_to IS NULL OR ts < valid_to)` or
`COALESCE(valid_to,'9999-12-31')`. A sentinel keeps plain `<` and range index scans simple.

## 7. Filtering valid-time when the question was system-time (and vice versa)

**Symptom:** "reproduce the report we sent on day X" returns *today's* corrected numbers.

**Why:** the query filtered valid-time only; corrections recorded after day X leaked in.

**Fix:** to reproduce a past run, filter **system-time** (`system_from <= @run AND system_to >
@run`) first, then resolve valid-time inside that slice. See `as-of-joins.md` #2.

## 8. Non-deterministic "latest" tie-breaks

**Symptom:** as-of results flip between runs when two versions share a `valid_from`.

**Why:** duplicate effective timestamps with no deterministic ordering; the engine picks either.

**Fix:** enforce unique `(natural_key, valid_from)`; if genuine same-instant versions exist, add a
monotonic tiebreaker (load sequence / system_from) and order on it in the as-of pick.

## Quick verification checklist

- [ ] No `BETWEEN` in any interval join.
- [ ] Interval integrity tie-out passes: 0 overlaps, 0 gaps, exactly 1 current row per key.
- [ ] A past-dated report reproduces to the penny (system-time intact).
- [ ] Corrections are appends, not UPDATEs.
- [ ] Late data stamped with business time and triggers recompute.
- [ ] Instants in UTC; reporting-day boundaries carry an explicit zone.

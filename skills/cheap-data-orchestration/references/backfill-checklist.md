# Backfill checklist

A backfill is just re-running the normal pipeline for past partitions. If it needs a special
one-off script, the pipeline isn't idempotent yet — fix that first (see SKILL.md property 1).

## Before you start

- [ ] **One partition runs clean.** Re-run a single past `run_date` and confirm the result equals
      a fresh build (no dupes, counts stable on a second run). This is the idempotency proof.
- [ ] **Bounded range.** Know the exact start/end dates and the partition grain (day/hour/month).
- [ ] **Source still has the history.** Confirm the upstream actually retains data that far back;
      APIs and logs expire. A backfill over missing source data silently produces holes.
- [ ] **Cost estimate.** partitions × per-run warehouse cost × CI minutes. Backfilling years hourly
      can dwarf a month of normal runs — see `data-throughput-accelerator` if it's huge.
- [ ] **Isolation.** Backfill writes the same targets as production. Either accept that (idempotent
      upserts make it safe) or point at a staging schema and swap after validation.

## Running it

- [ ] **Oldest → newest** if later partitions depend on earlier ones; order-independent otherwise.
- [ ] **Serialize or cap concurrency** so parallel backfill runs don't exhaust warehouse slots or
      collide on the same partition. Use the workflow `concurrency:` group or a small matrix.
- [ ] **Throttle** to respect source API rate limits and your CI free-tier minutes.
- [ ] **Checkpoint.** Record each completed partition (a manifest table or a log) so an interrupted
      backfill resumes instead of restarting.
- [ ] **Don't tighten the live cron** during a large backfill — let them not compete.

Driver: loop dates and dispatch the existing workflow per partition, e.g.

```bash
d=2024-01-01
while [[ "$d" < "2024-02-01" ]]; do
  gh workflow run pipeline.yml -f run_date="$d"   # same workflow, just a different date
  d=$(date -u -d "$d + 1 day" +%F)
done
```

## After

- [ ] **Reconcile:** row counts and min/max timestamps per partition match expectations; no gaps,
      no overlaps. Run the same `data-quality` gate across the filled range.
- [ ] **Spot-check** a few partitions against a trusted source.
- [ ] **Restore** normal schedule/concurrency and note the backfill (range, date, reason) in the runbook.

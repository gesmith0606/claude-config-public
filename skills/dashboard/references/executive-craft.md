# Executive / client-grade dashboard craft

How to take a correct dashboard to one an IC, investor, or client trusts and acts on. The chart-craft
in SKILL.md is the floor; this is the polish layer above it (and hands actual hues/type to `design`).

## Start from the decision, not the data
Write the one sentence the viewer should leave with ("Portfolio co X is ahead of plan on revenue but
margin is slipping"). Everything on the screen earns its place by supporting that sentence. If a chart
doesn't change a decision, cut it.

## Metric hierarchy (the inverted pyramid)
1. **Headline (1):** the single number the audience cares about most + its verdict vs target/prior.
2. **Drivers (3–5):** the KPIs that explain the headline, each with context + trend + signed delta.
3. **Detail (on demand):** breakdowns, tables, drill-downs — present but subordinate, not competing.

Layout follows the hierarchy: headline top-left and largest; drivers in a row; detail below or behind
an interaction. Reading flow is Z/F — most important top-left.

## Context is mandatory
A number without a comparison is noise. Every KPI gets at least one of:
- **vs Target / plan / budget** (the most decision-relevant for a fund)
- **vs Prior period** (MoM / QoQ / YoY) — and beware seasonality; YoY is usually safest
- **vs Benchmark / peer** where available
Show the comparison as a signed, color-coded delta and a small trend (sparkline). Color = meaning
(good/bad), never decoration — and good isn't always "up" (lower churn/DSO is good).

## Annotate the insight
Sparse, declarative callouts beat dense labeling: "peak after launch", "covenant threshold", "deal
close". One annotation that names the *so what* is worth ten gridlines.

## Trust signals (especially client-facing)
- **As-of date** and **last-refreshed** timestamp on every page (ties to `point-in-time-data`).
- **Source / lineage footnote** — where the numbers came from; definitions for any non-obvious metric
  (how is "ARR" / "adjusted EBITDA" defined here?).
- **Consistent rounding & units** (state "in $000s" / "$mm" once, apply everywhere — same trap as in
  `document-extraction`/number parsing).
- **No silent gaps** — if data is partial or estimated, label it.

## Financial-dashboard patterns (PE / IC)
- KPI tiles: value · signed Δ vs plan · sparkline trend.
- Bridge / waterfall for variance (plan → actual, or period-over-period EBITDA bridge).
- Cohort / vintage tables for retention or cohort-by-start-period analysis.
- Small-multiples for entity-vs-entity comparison (same axes, easy scan) instead of one busy combo.
- Time series with target band / threshold lines (covenants, plan).

## Restraint reads as senior
Premium dashboards are *spacious*: fewer, larger elements; generous whitespace; one focal point per
screen; a tight palette. Density signals seriousness only up to a point — ~5 KPIs + 3–4 purposeful
charts. Past that it's a data dump. Cut, group into small-multiples, or move to drill-down.

## Build for export
IC and client deliverables live in decks and PDFs, not just a browser:
- Design a clean **print/PDF** layout (page breaks, no clipped charts, legible at print size).
- Offer a **static export** (PNG/PDF/scheduled email) — pairs with `cheap-data-orchestration`.
- Keep titles self-explanatory so a chart still makes sense pasted into a memo (`docx`/`pptx`).

## Then hand to `design`
Hierarchy, context, annotation, and restraint are *this* skill's job; the actual color system,
typography, spacing scale, and surface treatment are `design`'s. Don't restate them here.

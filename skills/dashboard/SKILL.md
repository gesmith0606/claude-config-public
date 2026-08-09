---
name: dashboard
description: >-
  Build data dashboards and visualizations — the right chart for the question, the right
  library, honest accessible encodings, clean layout. Use whenever the user wants to visualize a
  dataset, plot metrics, chart data, or show KPIs/analytics — even without the word "dashboard" —
  including executive/client-grade and warehouse-backed (e.g. Snowflake) dashboards.
---

# Dashboard

Turn data into views a person understands at a glance. This skill owns the *data* decisions —
which chart answers the question, which library, how to keep the encoding honest and accessible,
and how to lay a dashboard out. It pairs with two siblings:

- **Visual polish → the `design` skill.** Color hues, typography, spacing, materiality, states,
  and the anti-AI-slop aesthetic are its job, not this one. Don't restate them here.
- **Flowcharts / architecture / sequence → the `diagram` skill** (Mermaid). Those aren't data
  charts. If the user wants to *plot data*, you're in the right place.

One line on fonts so the two don't fight: **follow `design` for type, and avoid the Inter/Geist
monoculture** — a dashboard shouldn't look like every other one.

## The order of operations

1. **Understand the question the data should answer**, and the audience (a client wants clarity
   and trust; an analyst wants density). The question drives the chart, not the other way around.
2. **Pick the chart type** (table below).
3. **Pick the library** by complexity/scale (table below).
4. **Wire the data** in (parse, shape, aggregate to the right grain).
5. **Keep it honest and accessible** (the two rule sets below).
6. **Lay out the dashboard** (KPIs + charts, reading flow).
7. **Hand the styling to `design`** — let it make the result look intentional.

## Choosing the chart (the most important decision)

Match the chart to the *question*, not to what looks impressive:

| The question is about… | Use |
|------------------------|-----|
| Comparing values across categories | **Bar** (horizontal if labels are long) |
| Change over time | **Line** (area only if the total matters) |
| Distribution of one variable | **Histogram / box / violin** |
| Relationship between two variables | **Scatter** (add trend line if meaningful) |
| Part-to-whole | **Stacked bar or treemap** — *not pie* past ~5 slices |
| Connections / flow | **Network / Sankey** |
| Hierarchy | **Tree / sunburst / treemap** |
| Geographic | **Choropleth or symbol map** (use a real map lib, never hand-drawn shapes) |
| A single headline number | **KPI / stat card** (no chart needed) |

**Why this matters (so you can reason past the table):** people read *position and length* far more
accurately than *angle, area, or color* (Cleveland–McGill). That's why a bar beats a pie, and a pie
beats a bubble chart, for precise comparison. When unsure, prefer the encoding higher on
position → length → angle → area → color.

**Chart anti-patterns:** pie with >5 slices (→ bar); any 3D chart; dual y-axes with unrelated
scales (implies correlation that isn't there); overplotted scatter (→ aggregate, bin, or jitter);
decorative chart-junk. A second axis is almost never worth the misreading risk.

## Choosing the library

Don't reach for D3 reflexively — most dashboards want a higher-level library.

| Need | Reach for |
|------|-----------|
| Simple, fast, common charts | **Chart.js** or **Observable Plot** (great defaults) |
| React app | **Recharts** (or Visx/Victory) |
| Feature-rich dashboard, big data, mobile | **ECharts** |
| Declarative "grammar of graphics" | **Vega-Lite** |
| Scientific / statistical / 3D | **Plotly** |
| Truly custom or novel visual | **D3** (only when nothing above fits) |
| Graph/network layout | **dagre / ELK** (layout) + **d3-force / Sigma / Cytoscape** (render) |

**D3 vs. higher-level:** D3 is a low-level toolkit — you build the chart from scales and shapes.
Use it only when you need something the chart libraries can't express. For 90% of dashboards,
Chart.js / Plot / ECharts get you there faster and more reliably.

Copy-paste CDN includes and minimal init snippets per library, plus the KPI-card + responsive-grid
markup, live in **`references/chart-cookbook.md`** — read it when you're actually writing the HTML.

## Render by scale (data→viz wiring)

Match the rendering tech to the data volume, or the page janks:

- **< ~1,000 points → SVG** (crisp, inspectable, accessible).
- **~1k–10k → Canvas** (Chart.js, ECharts).
- **> ~10k → WebGL** (deck.gl, regl, ECharts GL) — or **aggregate first**.

And shape the data to the right grain *before* charting:
- **< 20 series/points:** label directly on the chart; no legend needed.
- **20–500:** standard chart.
- **500–5,000:** aggregate (bin, roll up, top-N + "other").
- **5,000+:** aggregation is mandatory — never dump raw rows into a chart.

**Ingesting data:** CSV → parse, auto-detect header row, infer column types (quantitative / ordinal
/ categorical) and let the type drive the encoding. JSON → keys as labels, values as series; nested
→ multi-series. A few numbers in prose → stat cards, not a chart. A table → pick the chart that
answers the question the table is really posing.

## Keep it honest

A misleading chart is worse than no chart — especially for a client.

- **Bars start at zero.** Truncating a bar axis exaggerates differences. (Line charts may break
  zero to show change, but indicate the truncation.)
- **No dual unrelated axes** to imply correlation.
- **Aspect ratio changes the story** — bank trend lines toward ~45° so slopes read truthfully.
- **No 3D, no rainbow/jet colormaps** (they distort perceived magnitude).
- **Annotate the insight, not the data** — a sparse callout ("peak after launch") beats labeling
  every point.

## Keep it accessible

- **Never encode by color alone** (~8% of men are colorblind) — back it with shape, pattern,
  position, or a direct label.
- **Sequential data → viridis/cividis; categorical → ColorBrewer**, max ~7–10 categories before
  you switch strategy (group, small-multiples, or interaction).
- **Contrast:** WCAG 4.5:1 for text, 3:1 for graphical objects/UI.
- **Every chart needs a text path:** `<svg role="img">` with `<title>`/`<desc>` (or `aria-label`
  on a canvas), and a **data-table fallback** for screen readers. Keyboard-navigable controls.

## Lay out the dashboard

- **KPIs first:** 3–5 headline stat cards across the top (label · big value · signed delta,
  colored for good/bad), then charts below.
- **Charts in a responsive grid:** `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`.
  No orphaned half-empty cells.
- **One dominant focal element**, supporting charts around it; group related charts together.
- **Reading flow:** most important top-left (Z/F scan); don't make the eye hunt.
- **Density signals seriousness:** a few KPIs + 1–2 charts reads as a demo; ~5 KPIs + 3–4 charts
  reads as a real product — but don't pad with filler.
- **Color palette *type* by data:** sequential (ordered magnitude), diverging (around a midpoint),
  categorical (distinct groups). Pick the *type* here; let `design` pick the actual hues.

## High-end: correct → client-grade

Honest + legible is the floor. "High-end" for an IC / investor / client audience adds:

- **Decision-first, not data-first.** Lead with the answer — the headline KPI and its verdict
  *vs target / prior / benchmark* — then the supporting detail. One screen should drive one decision.
- **Always show context.** A bare number is noise; pair every KPI with a comparison (target, prior
  period, benchmark, peer) and a trend. Deltas signed and colored for good/bad.
- **Annotate the "so what."** A sparse callout on the insight ("DSO +9d post-acquisition") is what
  an exec remembers — not denser axes.
- **Trust signals.** Put an as-of date, a source/lineage footnote, and the refresh time on every
  view — clients trust a dashboard that's explicit about provenance. (As-of logic → `point-in-time-data`.)
- **Restraint = seniority.** Fewer, larger, well-spaced elements read as premium; a wall of charts
  reads as a dump. Cut anything that doesn't serve the decision.
- **Built for export.** IC/client work lands in decks and PDFs — design for a clean print/PDF and
  static export, not just the live page.

Depth (narrative layout, metric hierarchy, financial-dashboard patterns) → `references/executive-craft.md`.

## Delivering from a warehouse (Snowflake) to clients

When the data lives in Snowflake and you have tool freedom, the choice *and* the wiring matter as
much as the charts:

- **Pick the tool by control vs speed:** managed BI (Power BI / Tableau / Sigma / Looker) for fast,
  governed self-serve; notebook/app (Hex / Streamlit) for analytical + Python; lightweight code
  (Evidence.dev / bespoke web over pre-computed extracts) for maximum "high-end" polish and cheap
  embedding; OSS (Superset / Metabase) to self-host. Match it to audience + embedding need.
- **Don't query Snowflake on every page load.** Pre-aggregate to small marts (`dbt`), cache, or
  extract to Parquet/JSON the dashboard reads — live per-viewer queries burn credits and feel slow.
  (Cost control → `sql-warehouse`; static path → `duckdb-warehouse` / `cheap-data-website`.)
- **Client-facing = multi-tenant security.** Enforce row-level security so client A never sees
  client B (Snowflake row-access policies, or per-tenant extracts) and use signed/embedded auth.
- **Refresh on a schedule** tied to the pipeline (`cheap-data-orchestration`), and show the as-of time.

Tool matrix, Snowflake connection/caching/cost patterns, row-level security and embedding →
`references/warehouse-delivery.md`.

## Then hand off

Once the charts are chosen, wired, honest, laid out, and (for client work) made decision-first and
delivery-ready, **invoke the `design` skill** to make the whole thing look intentional and
client-ready (type, color, spacing, surface, states). Keep the two roles clean: this skill makes the
data *correct, legible, and delivered*; `design` makes it *beautiful*.

---
name: cheap-data-website
description: >-
  Ship a cheap, public, mostly-static data website — rendering PRECOMPUTED data
  (JSON/parquet/CSV) as pages and charts, rebuilt on the data-refresh schedule and served from a
  free-tier CDN for ~$0. Use when the user wants to publish a dataset, leaderboard, tracker,
  stats page, or small public site backed by data computed on a cadence.
---

# Cheap Data Website

> **Routing:** a claude.ai HTML artifact that never gets deployed → `web-artifacts-builder`.

Publish a data-backed site that costs almost nothing and stays up under load. The trick: there is
**no server at request time**. You precompute the data, bake it into static HTML/JSON at build
time, push to a CDN, and rebuild only when the data changes. A request just hits a cached file.

This skill owns the *delivery decision and the build/deploy wiring*. It hands off:

- **Which chart answers the question → the `dashboard` skill.**
- **Making it look intentional (color, type, spacing) → the `design` skill.**
- **Where the data comes from / how it's scheduled upstream → `cheap-data-orchestration`**, and the
  query/aggregation that produces the precomputed files → **`duckdb-warehouse`**.

## When static beats a live API/server (the core call)

Go static when the answer is the **same for everyone** and changes on a **known cadence**:
leaderboards, trackers, public stats, dataset browsers, "state of X" pages, daily/weekly reports.
A CDN-cached file is faster, cheaper, and far more spike-proof than any server you'd run.

| Signal | Static site | Live API/server |
|--------|-------------|-----------------|
| Data changes | on a schedule (hourly/daily) | per-request / per-user |
| Same content for all visitors | yes | no (auth, personalization) |
| Freshness needed | minutes–hours stale is fine | real-time / sub-second |
| Writes from users | none (or a form → external service) | yes |
| Traffic | spiky / unpredictable | steady, capacity-planned |
| Cost target | ~$0, no ops | budget for compute + scaling |

If you find yourself wanting "just a tiny serverless function" to read fresh data on each request,
stop: either the cadence is wrong (precompute more often) or it's genuinely dynamic (this is the
wrong skill). Don't smear a database behind a "static" site.

## How the pieces fit

```
upstream job (cheap-data-orchestration)        ── runs on the data cadence
  └─ query/rollup (duckdb-warehouse)
       └─ writes PRECOMPUTED data/*.json|*.parquet  ── small, page-shaped, committed or fetched
            └─ SSG build (Astro/Eleventy/Next export) reads files → static HTML+assets
                 └─ free-tier CDN host serves cached files          ── no server at request time
```

The data-refresh schedule and the site-rebuild schedule are the **same trigger**: when new data
lands, kick the build. Don't poll; have the upstream job fire the deploy hook (see below).

## Precompute, then bake (the data contract)

The site reads **files, not databases**. Shape the data for the page *before* the build:

- **Aggregate to page grain upstream** (in `duckdb-warehouse`), not in the browser. Ship the
  summary the page shows, not the raw table. A 2 MB rollup beats a 200 MB dump every time.
- **Format:** small/simple → **JSON** the page imports at build time. Large or columnar → **parquet**
  read during the build (DuckDB/Polars/Arrow), emitting per-page JSON. Don't ship parquet to the
  browser unless you've deliberately chosen client-side DuckDB-Wasm and accepted the payload.
- **Split by page/route** so each page loads only its slice; paginate or top-N + "other" for long
  lists (mirrors the `dashboard` grain rules).
- **Version/stamp the build** with a `generated_at` and the source data hash so stale deploys are
  obvious and caches bust cleanly.

## Pick the generator

Any of these read local data at build time and emit static files. Match to what you already use:

| Situation | Reach for |
|-----------|-----------|
| Content/data site, minimal JS, islands for interactivity | **Astro** (great default here) |
| Already a React/Next shop | **Next.js static export** (`output: 'export'`) |
| Plain HTML/Markdown + data files, zero framework | **Eleventy (11ty)** |
| Pure single-page chart, no routing | one HTML file + a fetch of `data.json` (don't over-build) |

YAGNI check (`ponytail`): if it's *one* page reading *one* JSON, you may not need a generator at
all — a single static `index.html` that fetches `data.json` deploys to the same free host. Reach
for an SSG when you have many pages/routes, shared layout, or build-time data transforms.

## Deploy on a free tier

| Host | Good when |
|------|-----------|
| **Cloudflare Pages** | default pick — generous free bandwidth, fast global CDN, deploy hooks |
| **GitHub Pages** | repo already on GitHub, purely static, no build secrets needed |
| **Vercel / Netlify** | already in that ecosystem; mind bandwidth/build-minute free-tier caps |

All serve from a CDN, give HTTPS + a domain free, and cost $0 at small scale. Set cache headers so
the CDN actually caches (immutable hashed assets; short-TTL or purge-on-deploy for the data JSON).

## Rebuild on the data-refresh schedule

The site is only as fresh as its last build, so **trigger a rebuild when data lands**:

1. Upstream job (`cheap-data-orchestration`) finishes writing the precomputed files.
2. It calls the host's **deploy hook** (a POST URL) — or pushes the regenerated `data/` to the repo,
   and the host's git integration auto-builds.
3. Host rebuilds the static site and atomically swaps the CDN to the new version.

A plain **scheduled CI job** (GitHub Actions cron) that rebuilds + deploys is the simplest version
and often enough. Match the cron to the data cadence — don't rebuild hourly if the data is daily.
Keep secrets (deploy hook URLs, tokens) in CI/host secret stores, never in the repo
(see `insecure-defaults`).

## Guardrails

- **Don't ship a server you didn't need.** A serverless function per request defeats the cost/spike
  win — if every visitor triggers compute, you've built a live API, not a cheap data site.
- **Don't ship the whole dataset to the browser** to "filter client-side" when an upstream rollup
  would do. Bandwidth is the free tier's real limit.
- **Stale-but-cheap is a feature, not a bug** — state `generated_at` on the page so "hours old" is
  honest, not a surprise.
- **No secrets at build that leak to the client** — anything baked into static output is public.
- Charts must stay honest/accessible — that's `dashboard`'s rules; visual polish is `design`'s.

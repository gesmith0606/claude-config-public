# Delivering Snowflake-backed dashboards to clients

The chart layer is only half the job. With data in Snowflake and freedom to choose the tool, the tool
choice, the query/caching pattern, multi-tenant security, and cost are what make a client deployment
"high-end" — fast, safe, and cheap to run.

## Tool selection (you have freedom — match to audience + control need)
| Tool | Reach for when | Snowflake fit | Embedding |
|---|---|---|---|
| **Power BI** | Microsoft/365 org, governed self-serve, finance audience | Native connector; Import or DirectQuery | Power BI Embedded (per-tenant) |
| **Tableau** | Rich interactive exploration, established BI team | Native connector; extract or live | Tableau Embedded / Connected Apps |
| **Sigma** | Spreadsheet-like, warehouse-native, business users | Built for Snowflake (pushdown) | Strong embed + per-tenant |
| **Looker** | Governed semantic layer (LookML), GCP-leaning | Native | Embedded SSO |
| **Hex / Streamlit** | Analytical + Python, bespoke logic, data team owns it | snowflake-connector-python / Snowpark | App-level |
| **Evidence.dev / bespoke web** | Maximum "high-end" polish, cheap static embedding | Query → pre-computed extract at build | Trivial (static site) |
| **Superset / Metabase** | Self-host OSS, cost-sensitive | Native connectors | Embedded dashboards |

Rule of thumb: **managed BI** for fast governed self-serve; **Hex/Streamlit** when you need real Python;
**Evidence/bespoke web** when polish + cheap embed matter most; **Superset/Metabase** to self-host.

## Query pattern: never run live Snowflake on every page load
Per-viewer live queries burn credits and feel slow. In order of preference:
1. **Pre-aggregate to small marts** with `dbt` — dashboards read tiny, purpose-built tables, not raw.
2. **Materialize / cache** — Snowflake result cache helps identical queries; better, schedule the
   aggregation and store it. Use a warehouse sized for the refresh, auto-suspend aggressively.
3. **Extract to Parquet/JSON** for static/embedded dashboards (Evidence, bespoke web, `cheap-data-website`)
   — the client site serves files from a CDN; Snowflake only runs on the scheduled refresh.
4. **DirectQuery/live** only for genuinely real-time needs, and then on pre-aggregated views.

Cost levers: small auto-suspending warehouse for refreshes; avoid `SELECT *`; cluster/partition the
marts; cache; and push aggregation into the warehouse, not the dashboard (`sql-warehouse` cost-control).

## Multi-tenant security (client A must never see client B)
This is the part that bites in client delivery:
- **At the source — Snowflake row-access policies**: attach a policy so each query is filtered by the
  viewer's tenant (mapped from the embedding token / a mapping table). The safest layer — enforced
  even if the BI tool is misconfigured.
- **Per-tenant extracts**: if extracting to files, generate one dataset per client and serve only theirs.
- **In the tool**: Power BI RLS roles, Tableau user filters, Sigma/Looker row-level controls — use them
  as defense-in-depth, not the only gate.
- **Embedding auth**: signed embed tokens that carry the tenant id; never expose a Snowflake credential
  or an unscoped dataset to the browser. Treat the tenant id as server-trusted, never client-supplied.

## Refresh & freshness
- Schedule refresh with the pipeline (`cheap-data-orchestration` GitHub Actions cron → dbt → publish).
- Surface the **as-of / last-refreshed** time on the dashboard (a trust signal; see executive-craft.md).
- Alert if a refresh is late or data is stale → the `data-pipeline-alerting` skill (freshness monitor).

## Confidentiality
Client data: keep extracts and credentials server-side, scope every embed to one tenant, and don't
push raw rows to the browser or commit them. See the confidentiality posture in `~/.claude/CLAUDE.md`.

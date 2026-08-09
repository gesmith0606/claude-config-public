# Chart cookbook — CDN includes, minimal init, layout, ingestion

Practical patterns for self-contained HTML dashboards. Use **unpinned major versions** (shown).
Note: CDN includes are fine for prototypes/internal tools; for something shipped to real users,
consider bundling locally or adding SRI hashes (supply-chain + offline). Styling is `design`'s job
— these snippets are deliberately unstyled.

## Library CDN includes

```html
<!-- Chart.js — simple common charts -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<!-- Observable Plot (+ D3 dep) — great defaults for exploration -->
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6"></script>
<!-- ECharts — feature-rich dashboards, big data, mobile -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5"></script>
<!-- Plotly — scientific / statistical / 3D -->
<script src="https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2"></script>
<!-- Leaflet — maps (also needs its CSS) -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1/dist/leaflet.js"></script>
<!-- PapaParse — robust CSV parsing -->
<script src="https://cdn.jsdelivr.net/npm/papaparse@5/papaparse.min.js"></script>
```

## Minimal init per library

**Chart.js** (note the accessibility + sizing config; no eval-harness boilerplate):
```html
<div style="position:relative;height:320px"><canvas id="c" role="img" aria-label="Revenue by month"></canvas></div>
<script>
new Chart(document.getElementById('c'), {
  type: 'bar',
  data: { labels: ['Jan','Feb','Mar'], datasets: [{ label: 'Revenue', data: [12,19,7] }] },
  options: { responsive: true, maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } },           // bars start at zero
    plugins: { tooltip: { enabled: true } } }
});
</script>
```

**Observable Plot** (concise, sensible defaults):
```html
<div id="p"></div>
<script>
const data = [{month:'Jan',rev:12},{month:'Feb',rev:19},{month:'Mar',rev:7}];
document.getElementById('p').append(
  Plot.plot({ marks: [Plot.barY(data, { x: 'month', y: 'rev' })], y: { grid: true } })
);
</script>
```

**ECharts** (dashboards / large data):
```html
<div id="e" style="height:320px" role="img" aria-label="Trend"></div>
<script>
echarts.init(document.getElementById('e')).setOption({
  tooltip: {}, xAxis: { data: ['Jan','Feb','Mar'] }, yAxis: {},
  series: [{ type: 'line', data: [12,19,7] }]
});
</script>
```

**Plotly** (statistical / 3D):
```html
<div id="g" role="img" aria-label="Distribution"></div>
<script>Plotly.newPlot('g', [{ x:[1,2,2,3,3,3], type:'histogram' }], { bargap:0.05 }, {responsive:true});</script>
```

**D3** (only when nothing higher-level fits — scaffold):
```html
<svg id="s" width="640" height="320" role="img" aria-label="Custom chart"></svg>
<script>
const svg = d3.select('#s'), W=640, H=320, m={t:20,r:20,b:30,l:40};
const x = d3.scaleBand().domain(['A','B','C']).range([m.l, W-m.r]).padding(0.2);
const y = d3.scaleLinear().domain([0, 20]).range([H-m.b, m.t]);   // 0-based
svg.append('g').attr('transform',`translate(0,${H-m.b})`).call(d3.axisBottom(x));
svg.append('g').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y));
svg.selectAll('rect').data([['A',12],['B',19],['C',7]]).join('rect')
  .attr('x',d=>x(d[0])).attr('y',d=>y(d[1])).attr('width',x.bandwidth()).attr('height',d=>y(0)-y(d[1]));
</script>
```

**Leaflet** (geographic — never hand-draw shapes):
```html
<div id="m" style="height:360px"></div>
<script>
const map = L.map('m').setView([39.8, -98.6], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
L.circleMarker([40.7,-74.0], { radius: 8 }).addTo(map).bindPopup('NYC');
</script>
```

## KPI cards + responsive grid

```html
<section class="kpis">
  <div class="kpi"><span class="kpi-label">Revenue</span><span class="kpi-value">$1.2M</span><span class="kpi-delta up">▲ 8.4%</span></div>
  <!-- 3–5 of these -->
</section>
<section class="charts"><!-- chart cards go here --></section>

<style>
.kpis   { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1rem; }
.charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:1rem; }
.kpi    { display:flex; flex-direction:column; gap:.25rem; }
.kpi-delta.up   { color: var(--good, green); }
.kpi-delta.down { color: var(--bad, crimson); }
/* visual styling (color, type, surface, spacing) → hand to the `design` skill */
</style>
```

## Data ingestion

```js
// CSV → rows of objects, with header + type inference
Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true,
  complete: r => render(r.data) });

// JSON array → labels + series
const labels = data.map(d => d.month);
const series = data.map(d => d.revenue);

// Infer column type to choose the encoding
function colType(values){
  if (values.every(v => typeof v === 'number')) return 'quantitative';
  if (values.every(v => !isNaN(Date.parse(v))))  return 'temporal';
  return 'categorical';
}
```

## Accessibility checklist (per chart)
- `role="img"` + descriptive `aria-label` (or `<title>`/`<desc>` inside `<svg>`).
- A `<table>` fallback with the same numbers, visually hidden if needed.
- Don't rely on color alone — add shape/pattern/label; viridis/cividis for sequential.
- Tooltips enabled; controls keyboard-reachable; WCAG 4.5:1 text / 3:1 graphical contrast.

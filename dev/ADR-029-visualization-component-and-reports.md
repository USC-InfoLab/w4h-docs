---
title: "ADR-029 — Generic visualization component and published reports"
description: A vendor-agnostic in-app chart component (ECharts) driven by the dataset's GeoMTS mapping and a vetted series API, plus notebook-produced HTML reports as a sandboxed second tier for edge cases. Accepted and implemented.
updated_by: nocera@usc.edu
updated_at: 2026-10-04T00:00:00.000Z
---

**Status:** Accepted  
**Date:** 2026-10-04  
**Relates to:** ADR-008 (GeoMTS), ADR-019/020/021 (cohort and dataset analytics), ADR-023 (SQL analytics contributions), ADR-027 (cross-org projects), MVP §10 (A-02, A-05, A-06, A-10–A-12)

---

## Context

The only chart in the app is `CohortLineChart.vue`, a hand-written SVG line chart for three Fitbit-shaped signals. M3's deliverable is a *reusable analytics and plotting library*, and the platform serves **wearables of any vendor and clinical data** (REDCap, M7), not just Fitbit.

Contributions are notebooks, CLIs and vetted SQL jobs that run **outside** the app (ADR-018, ADR-022, ADR-023). Letting them ship front-end code would bypass that vetting.

What already makes a generic chart possible: every ingested table is registered in `w4h.tables` with a **role mapping** (`subject`, `time`, optional `geo`, `values`; ADR-008), `GET /datasets/:id/signals` describes the mapped signals and their column types, and enrollment (`subjects`) tables carry per-subject attributes.

## Decision

### 1. Two tiers

| Tier | What | Live? | Who writes it |
|---|---|---|---|
| **1. Generic component** | In-app charts for any mapped dataset, used by dashboards, cards and an explorer | Yes — API-driven | The platform team |
| **2. Published reports** | A notebook's interactive HTML shown in the app for edge cases the component cannot express | No — a snapshot | A project Admin |

### 2. Tier 1 — a component driven by data shape, not vendor

The chart is chosen from the **mapping and column types**, never from a vendor name.

| Data shape | Default chart |
|---|---|
| Continuous numeric over time | Line, per subject or group average, optional band, zoom/brush |
| Irregular events or categorical values (visits, medication, labs) | Event timeline / step chart |
| Spread across subjects or values | Histogram, box plot |
| Coverage or wear/completeness | Heatmap (subject × day, hour × day) |
| Group comparison (cohort vs control, ADR-021) | Bars with intervals |
| Two signals joined on subject + time bucket | Scatter |
| Geo-mapped signal | Map — later (out of MVP) |
| Anything else | Table view |

Grouping uses attributes from the dataset's enrollment table. Matching on attributes stays out of scope (ADR-021).

**Toolkit:** Apache ECharts via `vue-echarts`, tree-shaken and lazy-loaded with the Analytics tab. It handles dense series (canvas, zoom, downsampling), brush selection, heatmaps and built-in image export, and its options are plain JSON. A `ChartCard` wrapper adds: PNG and CSV export (MVP A-06), our colour tokens for dark mode, a colour-blind-safe palette, a "view as table" alternative, and loading/empty/error states. It replaces `CohortLineChart.vue`.

### 3. A generic series API

`POST /datasets/:id/analytics/series` returns aggregated data for one chart. A `kind` selects the shape: `series` (default; one line per subject or an all-subjects aggregate), `distribution` (histogram + per-subject box statistics), `coverage` (observations per subject per day or hour), `scatter` (two signals joined on subject + time bucket) and `events` (irregular or categorical records). Common parameters: signal, value column, subject filter, time window, bucket, aggregate (`avg` \| `min` \| `max` \| `sum` \| `count` \| `median`), group-by (`subject` \| `none`), and `max_points`. `GET /datasets/:id/analytics/catalog` describes what can be charted: the signals, each value column's type and default chart, the subjects, and the time span.

- Identifiers are validated against the mapping and values are parameterized — **no free SQL** (ADR-023).
- Access is project membership (`assertCanViewDataset`, ADR-027). Each call is audited as `dataset.query`.
- The component only ever receives aggregates or downsampled points, never raw rows.

### 4. A display contract for contributions

A contribution may declare in its manifest how its output is shown (`display:` per `produces` entry: chart type, x, y, group). It chooses from the fixed set above, and the **app renders it**. Contributions never ship UI code.

### 5. Tier 2 — published reports

An Admin runs a notebook in their own environment, then **publishes** the HTML to a project. Guardrails:

- Only project members can see it; Admin-only publish; size cap; no sharing outside the project.
- Shown in an **iframe with `sandbox="allow-scripts"`** (no same-origin, no top navigation) under a strict CSP, from content stored by the API — never from a third-party URL.
- Labelled with a **"snapshot as of"** stamp and its provenance: contribution and version, source datasets, publisher, time.
- A publish-time warning that the HTML embeds the data it plots. Publishing and viewing are audited.
- **Cross-org rule (ADR-027):** a report may only use datasets the publisher's team owns; otherwise it is blocked or labelled with its sources, because a contributing team could not revoke data embedded in a file.

Server-side notebook execution is a possible later step. It needs Python in the `api` container (D-31) and is not part of this ADR.

## Implementation

**API (`w4h-api`)**
- `lib/viz-queries.js` binds each registered table through the mapping (subject, time, values, including a combined date + time pair) and `information_schema` column types; identifiers are validated, every value is a bind parameter, queries run `READ ONLY` with a 15 s statement timeout, and every result is capped (12 subject lines, 2,000 points, 5,000 scatter points, 20,000 heatmap cells, 500 events).
- `GET /datasets/:id/analytics/catalog` and `POST /datasets/:id/analytics/series` in `routes/datasets.js`: access by project membership (`assertCanViewDataset`), each call audited as `dataset.query` with `analytics: viz`.
- `lib/viz-display.js`: the fixed chart set and `sanitizeDisplay`. A SQL contribution's preview result now carries a sanitized `display`.
- Reports: table `w4h.project_reports` and `GET`/`POST /projects/:id/reports`, `GET /projects/:id/reports/:id/content`, `DELETE /projects/:id/reports/:id` (`routes/projects.js`, `lib/reports.js`). Publishing is a project-Admin action and requires an acknowledgement, at least one declared dataset, datasets linked to the project and owned by the publisher's team, a size under `REPORT_MAX_BYTES` (8 MB) and an HTML page. The content endpoint injects a CSP (`connect-src 'none'`, no frames, no forms, no base) right after the doctype. Unlinking a dataset, or a collaborating team leaving, deletes the reports built from it. Publish, view and delete are audited.

**App (`w4h-app`)**
- `components/viz/`: `echarts.js` (tree-shaken registration), `vizOptions.js` (data → ECharts option, Okabe–Ito palette, readable time ticks, theme tokens), `ChartCard.vue` (frame with loading/empty/error, PNG and CSV export, "view as table", re-theme on dark mode), `SignalExplorer.vue` (the explorer on the Analytics tab).
- `CohortLineChart.vue` is now a thin wrapper over the same layer; the hand-written SVG is gone.
- `ProjectReportsPanel.vue`: list, publish form, and the sandboxed viewer (`<iframe sandbox="allow-scripts" srcdoc>` — no same-origin, no navigation).
- ECharts loads only with the Analytics tab (one 665 kB / 226 kB gzip chunk); the rest of the app is unchanged.

**Verified:** 46 API checks on a scratch database (wearable and clinical shapes, injection attempts, caps, access, audit, cross-org rule, revocation), and a headless-browser pass: the five chart kinds render, the table view works, a report is published through the form and opened, and inside it a network request is **blocked by the CSP** and access to the parent page is **blocked by the sandbox**.

**Not done (still open):** grouping by a subject attribute and a minimum group size; PDF export of a whole dashboard (per-chart PNG/CSV exist); maps; the app drawing a contribution's `display` automatically in the Run dialog (the API returns it); outlier markers (MVP A-05). A collaborating team's Admin cannot publish reports in someone else's project (publishing needs project-Admin rights).

## Open questions

- Per-subject attributes as a grouping role: does the enrollment table need an explicit mapping, or is column type enough?
- Minimum group size: suppress or warn when a cohort average has very few subjects?
- PDF export of a full dashboard, beyond per-chart PNG.
- Report retention, and how reports interact with derived-data lineage (D-05, M-02). Today they live in the database (`html` column) and are deleted with their project or source dataset.

## Consequences

- A vendor-agnostic chart layer for wearables and clinical data, and the reusable plotting library M3 promised.
- The Fitbit-specific chart code goes away. One new dependency (ECharts), loaded only on the Analytics tab.
- New API surface (series) and a new stored artifact type (reports) that needs retention and access rules before it ships.
- Notebooks keep Plotly or Matplotlib. Only the data shape is shared, not the chart spec.
- Model outputs reuse the same display contract (§4): the M4 example, a resting heart-rate anomaly detector (`w4h-hr-anomaly`, MVP §11), writes a derived table and declares a `display:` block; it ships no chart code.

## Changelog

| Date | Change |
|---|---|
| 2026-10-04 | **Accepted** and implemented (series API, `ECharts` component, published reports). |
| 2026-10-04 | Draft opened. |
| 2026-10-04 | Noted that model outputs (M4 example) use the §4 display contract. |

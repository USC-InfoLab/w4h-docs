---
title: "ADR-021 — Cohort control-group comparison analytics"
description: Formalizes MVP A-03 (compare selected subjects against a control group) — filter-based subject IDs on the Analytics tab (ICDE demo offline query), matched-cohort statistics and attribute filters out of scope for v1.
updated_by: nocera@usc.edu
updated_at: 2026-08-25T00:00:00.000Z
---

**Status:** Draft
**Date:** 2026-08-19
**Relates to:** ADR-003 (table model), ADR-008 (GeoMTS), ADR-019 (METs and wear-compliance analytics), ADR-020 (basic dataset stats dashboard), ADR-023 (SQL analytics contributions), MVP §10 (A-03, A-07)
**References:**
- [dev/analytics-contributions.md](analytics-contributions.md) — assignments, timeline
- [ADR-019](ADR-019-mets-wear-compliance-analytics.md) — wear/MET cohort cards, notebook-first sequencing this ADR follows
- [ADR-020](ADR-020-basic-dataset-stats-dashboard.md) — vendor-agnostic stats card, same `datasets.summary` caching pattern

---

## Context

MVP **A-03** ("Comparative analytics: compare selected subjects against a control group") has been on the requirements list since the doc's v0.4 rewrite with no dedicated decision record — unlike the wear/MET work (ADR-019) and the basic-stats card (ADR-020), which both got formal ADRs once someone needed to actually build them.

The earlier ICDE-era prototype (`w4h-icde-demo`, a Streamlit tool, architecturally unrelated to the current stack) had an ad hoc age/height-matched control-group view over direct Postgres. That prototype's data model doesn't map onto the current GeoMTS / API-scoped architecture, so it isn't a starting point here — noted for lineage only.

**Open dependency, stated plainly:** today's schema has no first-class subject-demographic metadata (age, sex, height, or an explicit cohort/tag field) to filter on. Datasets carry GeoMTS role mappings (subject, time, optional geo, values — ADR-003/ADR-008) but not demographic attributes. Any control-group split has to either (a) rely on whatever columns a given dataset happens to include, or (b) wait on a schema decision this ADR does not make. This ADR scopes the analytics decision; it does not resolve the demographic-metadata gap.

## Decision

### 1. Filter-based cohorts, not matched cohorts (v1)

A-03 ships first as simple metadata-filter groups (e.g. "subjects where `device_type = X`" or a dataset-defined tag/attribute), not statistical or propensity matching. Matching algorithms are explicitly out of scope for v1 — see Alternatives below.

### 2. In-app ID comparison pulled forward (ICDE offline query)

The ICDE demo's **offline** query — pick subjects, pick a control group, set a date range, optionally restrict to recurring time-of-day windows, then show KPI deltas, time series, and selected-vs-control bars — now lives on the project **Analytics** tab (`CohortAnalyticsPanel.vue`).

v1 filters by **subject ID** (and dates / time-of-day windows). Attribute filters (age, height, weight, state) stay blocked on the demographic-schema gap in Context. The UI must label results as filter-based, not matched.

| In v1 | Not in v1 |
|-------|-----------|
| Subject IDs from mapped tables | Age/height/weight/state sliders |
| Control = entire dataset, everyone else, or specific IDs | Propensity / matched cohorts |
| Mapped `heart_rate`, `calories`, `mets` / `mets_computed` | Recomputing METs in this module |
| Downsampled series + control ±2σ band on heart rate | StreamSim real-time |
| Optional time-of-day windows (incl. overnight) | Trajectory maps, PDF/PNG export |

METs charts appear only when a mapped `mets` or `mets_computed` table already exists (run `w4h-sql-compute-mets`). This module does **not** own the MET formula.

A Contributions notebook (`w4h-cohort-compare`) remains planned for protocol-grade / attribute-filter reports once demographics exist — it is no longer a blocker for this dashboard slice.

### 3. Live bounded query, role parity

Interactive filters (IDs, dates, windows) do not fit a cached `datasets.summary` card. v1 uses `GET` / `POST /datasets/:id/analytics/cohort`: identifiers bound from `w4h.tables` (allowlisted), subject IDs and dates as query parameters, downsampled series. Role parity per **A-07**: any project member who can view the dataset sees the same panel.

### 4. Sequencing

Pulled forward from the September/M3 chart-library slice so researchers can run the ICDE-style comparison once a dataset is loaded. Real-time streaming and maps stay unscoped.

---

## Consequences

**Positive:**
- Formalizes a real, long-standing requirement (A-03) and ships the ICDE demo's offline comparison on the Analytics tab without copying Streamlit or opening a free-SQL hole.
- Filter-based v1 (subject IDs) is buildable without a modeling story or new ML work.
- METs stay on the ADR-023 engine; this query only reads mapped signals.

**Negative / risks:**
- Comparison quality depends on subject-demographic metadata that isn't reliably populated across datasets today — the open dependency above is real, not cosmetic. v1 therefore filters by ID, not attributes.
- Filter-based cohorts are **not** matched cohorts; the UI must label results as such and not imply statistical rigor it doesn't have.
- Interactive queries are live (bounded) rather than a cached `datasets.summary` key — fine for sample-scale datasets; large series rely on downsampling, not `fft_approximate` yet.

---

## Alternatives not chosen

- **Matched-cohort statistics now** (propensity matching, age/height-adjusted controls) — rejected for v1; this needs a modeling story and belongs closer to **M4** (Modeling components), not a filter-based analytics slice.
- **Fold into ADR-019** — rejected; wear/MET cards are signal-specific (HR/calories/METs) and gated on those notebooks, while cohort comparison should work across arbitrary signals and metadata filters.
- **Wait for full M4 modeling milestone before starting any comparison work** — rejected; a simple filter-based comparison is valuable sooner and doesn't require ML.
- **Reuse the ICDE prototype's control-group logic directly** — rejected as a data-access path (direct Postgres, no GeoMTS mapping, no multi-tenant schema isolation). The **query UX** (subjects vs control, date range, time windows, KPI deltas, series, bars) is what this ADR ports.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-25 | Pulled the ICDE demo's offline comparison onto the Analytics tab: subject-ID vs control, live `GET`/`POST /datasets/:id/analytics/cohort`, no MET formula in this module. Attribute filters, maps, and real-time still out. Notebook remains planned. |
| 2026-08-23 | Prefer an [ADR-023](ADR-023-sql-analytics-contributions.md) YAML SQL manifest over a third JS module when the dashboard card ships. Demographic-schema gap unchanged. |
| 2026-08-19 | Initial draft — opened to formalize A-03 ahead of the August 21 demo checkpoint (see [MVP §17.1](mvp.md#171-demo-checkpoint-friday-august-21-2026) and [august-2026-release-plan.md](august-2026-release-plan.md)). Status Draft, not scheduled for August. |

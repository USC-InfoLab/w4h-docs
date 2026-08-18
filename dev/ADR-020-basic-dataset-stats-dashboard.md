---
title: "ADR-020 — Basic dataset statistics dashboard (Admin & User parity)"
description: General, vendor-agnostic dataset stats card on the project Analytics tab — subject count, date range, device types, dataset size — split out from the Fitbit-specific wear/MET dashboards in ADR-019.
updated_by: nocera@usc.edu
updated_at: 2026-08-18T00:00:00.000Z
---

**Status:** Draft
**Date:** 2026-08-18
**Relates to:** ADR-003 (table model), ADR-008 (GeoMTS), ADR-019 (METs and wear-compliance analytics), MVP §6.1 (D-02), MVP §10 (A-01, A-07)
**References:**
- [dev/analytics-contributions.md](analytics-contributions.md) — assignments, timeline
- [ADR-019](ADR-019-mets-wear-compliance-analytics.md) — wear/MET cohort cards (Fitbit-shaped signals only)

---

## Context

MVP **A-01** ("Per-project summary dashboard: subject count, date range, device types, dataset sizes") has been on the requirements list without a dedicated decision record. [ADR-019](ADR-019-mets-wear-compliance-analytics.md) covers the project **Analytics** tab too, but its cohort cards (**A-01a**, **A-04a–c**) only render when a dataset carries Fitbit-shaped `heart_rate` / `calories` / `mets` signals. Every other dataset — any vendor, any signal set — still shows nothing on the Analytics tab.

Stakeholders want a baseline "what's in this dataset" view that works for **any** loaded dataset, independent of the wear/MET work. This is scoped separately from ADR-019 because:

- It has no dependency on the Fitbit sample extension (ADR-019 WP1) or the wear/MET notebooks (WP2/WP3).
- It reuses dataset metadata that already exists (D-02: device type, sampling rate, subject count, date range) rather than deriving new domain-specific metrics.
- It can ship independently and in parallel with ADR-019's WP4 (API cohort summary), which stays on the September (M3) track.

## Decision

### 1. Basic stats card on the Analytics tab

Add a **basic dataset stats** card to the project Analytics tab (same surface as ADR-019's cohort cards, rendered first / above them when present):

| Metric | Source |
|--------|--------|
| Subject count | Distinct subjects in the dataset's mapped tables (`w4h.tables`), or `datasets.metadata.subject_count` when already populated (D-02) |
| Date range | Min/max `time` across mapped tables, or cached `datasets.metadata.date_range` |
| Device type(s) | `datasets.metadata.device_type` (D-02) |
| Dataset size | Row count per mapped table (approximate is acceptable — see below) |

### 2. Cache in the existing `datasets.summary` field

Extend the same `datasets.summary` jsonb column ADR-019 introduced, under a new `basic_stats` key, refreshed by the same `POST /datasets/:id/summary/refresh` endpoint (Team admin+, audited):

```json
{
  "basic_stats": {
    "subjects_total": 5,
    "date_range": { "start": "2026-01-01", "end": "2026-08-01" },
    "device_types": ["Fitbit Charge 5"],
    "row_counts": { "heart_rate": 48213, "calories": 4820 },
    "summary_updated_at": "2026-08-18T00:00:00.000Z"
  }
}
```

`w4h-api/lib/` gains a small `dataset-basic-stats.js` (or extends ADR-019's cohort-summary module) — bounded queries only, no unindexed full-table `COUNT(*)` on list endpoints (MVP / AGENTS). Row counts may use an approximate estimator (e.g. `pg_class.reltuples`, or `fft_approximate`-style approximation when the extension is installed) rather than an exact scan; exactness is not required for a dashboard card.

### 3. Role parity

Same rule as ADR-019 **A-07**: Users and Admins see the identical `basic_stats` card. No admin-only variant.

### 4. Ownership and sequencing

This ADR ships **independently** of ADR-019's WP4 (API cohort summary) and WP5 (wear/MET UI cards) — it does not block on Fitbit-shaped signals existing. In-app implementation assigned to **Tracy**, August 2026 — see [analytics-contributions.md](analytics-contributions.md#assignments-august-2026).

---

## Consequences

**Positive:**
- Analytics tab is non-empty for any dataset on day one, not only Fitbit HR/calories ones.
- Reuses the `datasets.summary` / refresh-endpoint plumbing from ADR-019 instead of inventing a second caching mechanism.
- Small, independently shippable slice — no dependency on WP1–WP4 from ADR-019.

**Negative / risks:**
- `datasets.summary` now holds `basic_stats` (this ADR) alongside `wear_compliance` / `mets_summary` (ADR-019) — schema for the combined jsonb shape needs to stay documented in one place; treat ADR-019 + this ADR together as the source of truth until both are Accepted and can be consolidated.
- Approximate row counts can drift from exact counts; label the card as approximate where estimation is used.

---

## Alternatives not chosen

- **Fold into ADR-019** — rejected; wear/MET cards are Fitbit-signal-specific and gated on WP1–WP4, while basic stats should work for every dataset immediately.
- **Exact `COUNT(*)` per card render** — rejected; same full-scan risk ADR-019 already rejected for cohort queries.
- **Wait for full M3 chart library (A-02–A-06)** — rejected; a non-empty baseline view ships now, detailed charts stay on the M3/September track.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-18 | Initial draft — basic dataset stats card split out of ADR-019's Analytics tab scope. Assigned to Tracy for August 2026. |

---
title: "ADR-021 — Cohort control-group comparison analytics"
description: Formalizes MVP A-03 (compare selected subjects against a control group) — filter-based cohorts first, Contributions notebook before a dashboard card, matched-cohort statistics explicitly out of scope for v1.
updated_by: nocera@usc.edu
updated_at: 2026-08-19T00:00:00.000Z
---

**Status:** Draft
**Date:** 2026-08-19
**Relates to:** ADR-003 (table model), ADR-008 (GeoMTS), ADR-019 (METs and wear-compliance analytics), ADR-020 (basic dataset stats dashboard), MVP §10 (A-03, A-07)
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

### 2. Notebook first, same sequencing as ADR-019

Mirrors ADR-019's wear/MET sequencing:

1. **Contributions notebook** (working name `w4h-cohort-compare`) computes aggregate deltas between a selected group and a control group for whatever signals the dataset carries (mean HR, calories, wear %, METs).
2. **CLI automation** entry point, mirroring the Fitbit importer / `w4h-compute-mets` pattern (`kinds: notebook, cli`).
3. **Dashboard card** (A-03 proper, project Analytics tab) follows once the notebook validates the metric definitions against real datasets — not built in parallel with the notebook.

### 3. Caching and role parity

If/when the dashboard card ships, reuse the `datasets.summary` jsonb column and `POST /datasets/:id/summary/refresh` pattern from ADR-019/ADR-020 (a new `cohort_comparison` key) rather than inventing a third caching mechanism. Role parity per **A-07**: Users and Admins see the identical card.

### 4. Sequencing relative to August 2026

Not scoped for August. Candidate for the September/M3 chart-library slice (alongside A-02, A-05, A-06) unless explicitly pulled forward, following the same "notebook smoke test now, productize later" pattern the wear/MET work used in August.

---

## Consequences

**Positive:**
- Formalizes a real, long-standing requirement (A-03) instead of leaving it design-less — gives any Friday-demo or roadmap conversation a concrete artifact ("here's the open ADR") instead of a vague gap.
- Reuses the notebook-first sequencing and `datasets.summary` caching already validated by ADR-019/ADR-020, rather than a fourth bespoke pattern.
- Filter-based v1 scope is buildable without a modeling story or new ML work.

**Negative / risks:**
- Comparison quality depends on subject-demographic metadata that isn't reliably populated across datasets today — the open dependency above is real, not cosmetic.
- Filter-based cohorts are **not** matched cohorts; any UI or report using this must label results as such and not imply statistical rigor it doesn't have.
- Adds a third `datasets.summary` sub-key (alongside ADR-019's `wear_compliance`/`mets_summary` and ADR-020's `basic_stats`) — the combined jsonb shape needs one documented source of truth once more than one of these ADRs reaches Accepted.

---

## Alternatives not chosen

- **Matched-cohort statistics now** (propensity matching, age/height-adjusted controls) — rejected for v1; this needs a modeling story and belongs closer to **M4** (Modeling components), not a filter-based analytics slice.
- **Fold into ADR-019** — rejected; wear/MET cards are signal-specific (HR/calories/METs) and gated on those notebooks, while cohort comparison should work across arbitrary signals and metadata filters.
- **Wait for full M4 modeling milestone before starting any comparison work** — rejected; a simple filter-based comparison is valuable sooner and doesn't require ML.
- **Reuse the ICDE prototype's control-group logic directly** — rejected; different data model (direct Postgres, no GeoMTS mapping, no multi-tenant schema isolation) that doesn't transfer to the current architecture.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-19 | Initial draft — opened to formalize A-03 ahead of the August 21 demo checkpoint (see [MVP §17.1](mvp.md#171-demo-checkpoint-friday-august-21-2026) and [august-2026-release-plan.md](august-2026-release-plan.md)). Status Draft, not scheduled for August. |

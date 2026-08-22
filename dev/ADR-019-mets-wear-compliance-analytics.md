---
title: "ADR-019 — METs and wear-compliance analytics (contributions + cohort dashboards)"
description: First-party Contributions for device wear reporting and MET derivation, plus basic in-app cohort stats on the project Analytics tab (M3).
updated_by: nocera@usc.edu
updated_at: 2026-08-17T00:00:00.000Z
---

**Status:** Draft  
**Date:** 2026-08-17  
**Relates to:** ADR-003 (table model), ADR-008 (GeoMTS), ADR-016 (paired sample/importer), ADR-018 (contributions catalog), ADR-020 (basic dataset stats dashboard), MVP §6.2 (D-14), MVP §10 (A-01, A-04)  
**References:**
- [dev/analytics-contributions.md](analytics-contributions.md) — RA task breakdown, assignments, timeline
- [ADR-020](ADR-020-basic-dataset-stats-dashboard.md) — general (non-Fitbit-specific) dataset stats card, split out of this ADR's Analytics tab scope
- Legacy: `w4h-notebooks/compliance_analyzer.py`, `w4h-notebooks/band_wear_compliance.ipynb`

---

## Context

Clinical trials using wearables need two analysis surfaces:

1. **Device wear compliance** — did participants wear the band enough during protocol windows? (MVP **A-04**)
2. **METs (metabolic equivalents)** — energy expenditure derived from calories and body weight for activity interpretation

W4H already has **legacy prototype code** for wear compliance in the `w4h-notebooks` index repo (`ComplianceAnalyzer`: heart-rate timestamps as a wear proxy, configurable daily windows, overall % compliant days). It is **not** cataloged, uses direct CSV/Postgres paths, and assumes flat tables — not the current GeoMTS + API ingest model ([ADR-018](ADR-018-contributions-catalog.md)).

There is **no production MET derivation code** in catalog repos. A historical formula used in early demos: `METs ≈ calories / (weight_kg × 0.25)` per interval (product must document interval length and missing-weight handling).

The Fitbit sample package ([ADR-016](ADR-016-paired-sample-importer-repos.md)) now ships all four signals (`subjects`, `weight`, `heart_rate`, `calories` — WP1 done, see [analytics-contributions.md](analytics-contributions.md#wp1--extend-fitbit-sample-prerequisite)). Wear compliance needs **heart_rate**; METs needs **calories** (+ weight).

The project **Analytics** tab is a placeholder ([`ProjectHub.vue`](../../w4h-app/src/components/project/ProjectHub.vue)). MVP **A-02–A-07** (full chart library) remains deferred; stakeholders still need a **basic cohort summary** (“show me these stats for this cohort”) for Users and Admins on loaded datasets.

**Terminology:** “Compliance” here means **device wear-time protocol adherence**, not HIPAA regulatory compliance ([guide/hipaa-compliance.md](../guide/hipaa-compliance.md)).

---

## Decision

### 1. Three new first-party Contributions (one repo each)

| Catalog slug | Repo | Kinds | Purpose |
|--------------|------|-------|---------|
| `w4h-fitbit-wear-compliance` | `w4h-fitbit-wear-compliance` | `notebook`, `cli` | Per-subject and cohort wear-time reports from ingested HR + subject enrollment |
| `w4h-compute-mets` | `w4h-compute-mets` | `notebook`, `cli` | Derive MET time series from calories + weight; optional write-back as derived signal |
| `w4h-demo-approximate-queries` | `w4h-demo-approximate-queries` | `notebook` | Demonstrates `fft_approximate` approximate range-aggregate queries against the Fitbit sample dataset |

Publisher: `usc-infolab`. Do **not** add new tools to legacy `w4h-notebooks` ([ADR-018](ADR-018-contributions-catalog.md)).

Each repo: `pyproject.toml`, tests, `.env.example`, README (protocol assumptions), notebook. Read ingested data via **project db-token + SQL** against mapped tables (`w4h.tables`) until a read/query API exists. Credentials via `W4H_API_KEY` in local `.env` only ([ADR-007](ADR-007-authentication-model.md)).

**Automation parity (kinds: `notebook` + `cli`):** the wear-compliance and METs repos are not notebook-only — each ships a `[project.scripts]` CLI entry point alongside the primary notebook, mirroring [`w4h-sample-fitbit-csv-importer`](https://github.com/USC-InfoLab/w4h-sample-fitbit-csv-importer)'s `import`/`sync` pattern (README "Who should do what" table + cron example). Concretely: `w4h-fitbit-wear-compliance report --dataset-id ... [--subject ...]` and `w4h-compute-mets compute --dataset-id ... [--write-back]`, both authenticated via `W4H_API_KEY`. This lets a Team admin schedule recurring reports the same way the Fitbit importer supports incremental sync (D-26), instead of only running cells interactively. The approximate-queries demo stays notebook-only — it is illustrative, not an operational tool.

### 2. Extend existing Fitbit sample (prerequisite)

Add **`heart_rate`** and **`calories`** signals to [`w4h-sample-fitbit-csv`](../../w4h-sample-fitbit-csv) (`manifest.yaml` + synthetic CSVs). Update [`w4h-sample-fitbit-csv-importer`](../../w4h-sample-fitbit-csv-importer) tests and notebook so all four signals ingest via `POST /datasets/:id/import/csv-batch`.

### 3. Basic in-app cohort dashboards (M3 — not full chart library)

Replace the Analytics tab placeholder with **cached cohort stat cards** when a linked dataset has computable signals:

| MVP req | Surface | Metrics (examples) |
|---------|---------|-------------------|
| **A-04a** | Analytics tab + dataset overview | Cohort wear: % subjects meeting overall threshold, median daily wear % |
| **A-04b** | Analytics tab | Same metrics with **subject filter** (single subject or small pick-list) |
| **A-04c** | Analytics tab | MET summary when `mets` or `mets_computed` signal exists: mean MET-hours, simple distribution |
| **A-01a** | Analytics tab | Non-empty view when HR/calories datasets are loaded (not Contributions-only placeholder) |

**Role parity:** Viewers and Admins see the same cohort stats. Admins additionally get a link to Contributions for full notebook reports.

**Implementation:** extend cached `datasets.summary` JSON with optional `wear_compliance` and `mets_summary`; bounded recompute via `POST /datasets/:id/summary/refresh` (Team admin+). Port logic from `ComplianceAnalyzer` and METs module into `w4h-api/lib/` (copy acceptable for MVP). **No live full-table `COUNT(*)` on list endpoints** (MVP / AGENTS).

**Defer unchanged:** A-02 time-series plots, A-03 comparisons, A-05 outliers, A-06 PDF export.

### 4. Catalog seeding

Super admin adds rows to `w4h.contributions` (seed in `w4h-api/data/schema.sql` when repos are public). Help explains contribute flow; no Help page per tool ([ADR-018](ADR-018-contributions-catalog.md)).

---

## Consequences

**Positive:**
- Clear RA work packages: sample extension, two repos, API summary, UI cards, catalog seed
- Wear/MET value visible in-app for pilots without waiting for full M3 visualization library
- Detailed protocol reports remain in versioned contribution notebooks (ADR-018 boundary)

**Negative / risks:**
- MET formula is a product assumption — must be documented and IRB-aware teams may need to substitute
- Db-token SQL read path is harder for RAs than a future query API
- Cached summaries can drift until refresh; document `summary_updated_at`

---

## Alternatives not chosen

- **In-app charts only (no Contributions)** — rejected; protocol-grade reports and reproducibility belong in git notebooks
- **Keep logic only in `w4h-notebooks`** — rejected; ADR-018 requires one repo per tool
- **Full M3 chart library first** — rejected; basic cohort stats ship earlier per stakeholder request
- **Vendor METs column passthrough only** — rejected; trials need derivable METs from calories + weight when vendor does not supply METs

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-20 | WP1 done: `w4h-sample-fitbit-csv` now ships `heart_rate` + `calories` signals (synthetic CSVs copied from legacy `w4h-datasets`, `manifest.yaml` GeoMTS mapping added); importer's existing `test_manifest.py` (4-signal assertion) passes. |
| 2026-08-18 | Added third contribution `w4h-demo-approximate-queries`; made CLI automation (`kinds: notebook, cli`) explicit for the wear-compliance and METs repos, mirroring the Fitbit importer. Assigned to Tracy / Bharghav for August — see [analytics-contributions.md](analytics-contributions.md#assignments-august-2026). General (non-Fitbit-specific) dataset stats split out to [ADR-020](ADR-020-basic-dataset-stats-dashboard.md). |
| 2026-08-17 | Initial draft — contributions + cohort dashboard scope for M3 (September 2026). |

---
title: ADR-003 — Physical signal tables + platform mapping registry
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-08-14T00:00:00.000Z
---
**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-08-14  
**Deciders:** W4H architecture team  
**Relates to:** [ADR-008](ADR-008-geomts-data-model.md) (GeoMTS roles via mapping), [ADR-001](ADR-001-schema-per-trial.md) (isolation schemas)

---

## Context

Wearable devices produce heterogeneous time-series signals — heart rate, accelerometry, sleep stages, glucose, ECG, etc. Each signal type has different columns, sampling rates, and query patterns.

Researchers and device exports already use **diverse column names** (`id` vs `subject_id`, `date`+`time` vs `timestamp`, optional GPS). Forcing every physical table into a single canonical layout (`subject_id`, `ts`, `lat`, `lon`, …) makes tables harder to recognize and rejects valid datasets that have no geospatial columns.

We still need:

1. Efficient typed storage (not a single JSONB blob)
2. One place the platform can discover tables and interpret GeoMTS roles
3. Platform catalog metadata under the shared **`w4h`** schema (not buried only inside each isolation schema)

---

## Decision

### Storage: one physical table per signal (or logical table) per dataset

Prefer **Option A** — separate typed PostgreSQL tables for distinct signals / imports — over a single wide JSONB payload table.

Physical tables may live in an isolation schema (dataset-scoped `ds_*` today; trial-scoped `trial_*` remains the longer-term ADR-001 direction). **Column names stay as loaded** (or as the team prefers). The platform does **not** require renaming to `subject_id` / `ts` / `lat` / `lon`.

### Metadata: one source of truth in `w4h`

**Table and field metadata — including the GeoMTS role mapping — live in the platform schema `w4h`.**

| Concept | Where |
|--------|--------|
| Dataset catalog | `w4h.datasets` (optional `schema_def` = declared intent) |
| Physical / logical table registry | `w4h.tables` (one row per registered table) |
| Role + field mapping | JSON on that registry row (e.g. `columns_def` / `mapping`) — **not** a separate GeoMTS encoding table |
| Optional DB comments | `COMMENT ON TABLE` / `COMMENT ON COLUMN` kept in lockstep with the registry |

Per-isolation-schema manifests (e.g. `{schema}.dataset_tables`) are **not** the authority. If present for local bookkeeping, they must not diverge from `w4h.tables`.

### Mapping (not normalization)

The registry maps **physical column names → GeoMTS roles**:

| Role | Meaning | Required? |
|------|---------|-----------|
| `subject` | Participant key column | Yes for GeoMTS analysis |
| `time` | Single timestamp column, or combine of date+time columns | Yes for time-series |
| `geo_lat` / `geo_lon` | Latitude / longitude columns | Optional |
| `value` (one or more) | Signal / measure columns | Yes (≥1) |

Example registry mapping for a Fitbit-style heart-rate table that keeps native names and has **no** lat/lon:

```json
{
  "signal_type": "heart_rate",
  "subject": "id",
  "time": { "combine": ["date", "timestamp"] },
  "geo": null,
  "values": [
    { "source": "value", "name": "heart_rate", "type": "integer", "description": "BPM" }
  ]
}
```

Ingest, query helpers, viz, and ML use this mapping to interpret tables. Researchers can still `SELECT *` and recognize familiar columns.

### Optional descriptions

Human-readable table/field descriptions belong on the `w4h` registry (and may be mirrored as PostgreSQL comments). Descriptions are not a second independent schema.

---

## Consequences

**Positive:**
- Typed columns remain efficient and indexable
- Teams keep familiar field names; datasets without GPS remain first-class
- One platform SoT (`w4h.tables`) for catalog counts, project overview, and agents
- Isolation schemas hold data; platform schema holds how to read that data

**Negative / risks:**
- Query/ML layers must resolve roles via mapping (cannot assume fixed physical names)
- Ingest/DDL paths must be the **only writers** of `w4h.tables` to avoid drift
- Dual manifests (platform + in-schema) are forbidden as competing sources of truth

---

## Signal / table identity

- Each registered row points at a physical relation: `schema_name` + `table_name` (qualified as needed).
- `signal_type` (or equivalent slug) labels the logical signal for UI and GeoMTS.
- Naming of isolation schemas/tables may evolve (`ds_*` vs `trial_*`); the **mapping registry in `w4h` remains the constant**.

---

## Alternatives not chosen

- **JSONB payload table as primary store:** Rejected for analytics performance (see prior Option B).
- **Forced physical normalization** to `(subject_id, ts, lat, lon, …)` on every table: Rejected — harms recognizability and excludes non-geo datasets.
- **Manifest only inside each isolation schema** (`dataset_tables` as SoT): Rejected — platform catalog, hydrate, and cross-dataset tooling need metadata in `w4h`.
- **Separate normalized “GeoMTS encoding” table for lat/lon/ts:** Rejected — roles are mapping metadata, not a second copy of the data.

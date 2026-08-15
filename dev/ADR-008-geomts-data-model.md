---
title: ADR-008 — GeoMTS as the unifying wearable data abstraction
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-08-14T00:00:00.000Z
---
**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-08-14  
**Deciders:** W4H architecture team  
**Principal investigator:** Cyrus Shahabi, PhD (USC InfoLab)  
**Relates to:** [ADR-003](ADR-003-dataset-table-model.md) (physical tables + `w4h` mapping registry)  
**References:**
- Hajisafi et al., *Wearables for Health (W4H) Toolkit for Acquisition, Storage, Analysis and Visualization of Data from Various Wearable Devices*, IEEE ICDE 2024 (Demo)
- Nocera et al., *Multi-Context Graph Neural Networks for Enhanced Multivariate Time-Series Analysis in Healthcare*, NIH Special Track at ISMB 2024
- USC InfoLab W4H project: https://infolab.usc.edu/projects/W4H/

---

## Context

Wearable devices used in clinical research are heterogeneous — Fitbit, Apple Watch, ActiGraph, Garmin, ECG patches, infant movement sensors — each with different:

- Sensor types and signal names
- Sampling rates (1Hz heart rate vs. 100Hz accelerometer vs. irregular GPS pings)
- Data formats (CSV exports, proprietary APIs, JSON streams)
- Geospatial context (some devices are GPS-equipped; others are worn in fixed locations)
- Vendor-specific **field names** and API contracts

Without a unifying abstraction, each device type requires custom analysis code. The abstraction must not force every team to rename columns to a single physical layout.

The W4H platform needs a model that:

1. Represents wearable signals in a common **logical** form (GeoMTS)
2. Separates device type from analysis logic
3. Supports unified querying, visualization, and ML across heterogeneous sensors
4. Preserves optional geospatial context when present
5. Maps cleanly onto PostgreSQL tables **via metadata**, without mandatory column rename

---

## Decision

All datasets in W4H are interpreted using the **GeoMTS (Geo-referenced Multivariate Time Series)** abstraction.

### What GeoMTS is

GeoMTS models wearable data as **geo-tagged, multivariate time series collections**:

- **Time series** — every signal is a sequence of (timestamp, value) pairs
- **Multivariate** — multiple signals may be captured per subject
- **Geo-referenced** — observations may carry optional geospatial context
- **Subject-anchored** — series belong to a subject (participant)

Logically, an observation is:

```
(subject, signal_type, timestamp, value…, [latitude, longitude])
```

Those names are **roles**, not required physical column identifiers.

### How GeoMTS maps to the database

Per [ADR-003](ADR-003-dataset-table-model.md):

1. **Physical tables** hold the data with researcher-/device-familiar columns (e.g. `id`, `date`, `timestamp`, `value`). Lat/lon columns are optional.
2. **Platform mapping** in `w4h.tables` (field/role mapping JSON) states which columns fill GeoMTS roles (`subject`, `time`, optional `geo_*`, `value`s).
3. **`w4h.datasets.schema_def`** may store declared GeoMTS intent at create time; after ingest, the **live** table/field mapping in `w4h.tables` is the source of truth for registered tables.

Example — physical table keeps native names; no GPS:

```text
fitbit_hr (id, date, timestamp, value)
```

```json
{
  "signal_type": "heart_rate",
  "subject": "id",
  "time": { "combine": ["date", "timestamp"] },
  "geo": null,
  "values": [{ "source": "value", "name": "bpm", "type": "integer" }]
}
```

Example — table that already has geo columns under other names:

```json
{
  "signal_type": "gps_track",
  "subject": "participant",
  "time": { "column": "recorded_at" },
  "geo": { "lat": "latitude", "lon": "longitude" },
  "values": [{ "source": "speed_mps", "name": "speed", "type": "double precision" }]
}
```

There is **no** separate side table whose purpose is only to store lat/lon/ts encodings of every row. GeoMTS is the interpretation layer; rows stay in the signal tables.

### What GeoMTS enables

- **Unified ingestion** — CSV/JSON/REDCap imports supply a mapping from source headers → roles (and optional load into typed tables)
- **Unified querying / ML / viz** — tools resolve subject/time/geo/value through the registry mapping
- **Cross-device analysis** — join logically on mapped subject + time when schemas are compatible
- **Non-geo datasets** — first-class; `geo` mapping is null

### Provenance and additive model

Original signal data is not overwritten in place for derived products. Derived series are new datasets (or new registered tables) with provenance — D-04/D-05 — preserving auditability.

---

## Consequences

**Positive:**
- Device-type independence without forcing a universal physical column layout
- ML/viz reuse against GeoMTS **roles** resolved via mapping
- Optional geospatial context without null-filled lat/lon on every table
- Aligns with USC InfoLab GeoMTS research while matching how teams already name fields

**Negative / risks:**
- Every analysis path must consult mapping (cannot hard-code `subject_id` / `ts`)
- Bad or missing mappings break interpretation even when SQL `SELECT *` looks fine
- Heterogeneous sampling rates still require explicit care when joining signals
- FHIR/HL7 remain export/interop concerns, not the internal store

---

## Alternatives not chosen

- **Forced physical rename** to `(subject_id, ts, lat, lon, …)` on ingest: Rejected — see ADR-003.
- **Separate GeoMTS encoding table** for lat/lon/ts: Rejected — duplicate storage; mapping metadata is enough.
- **FHIR / openEHR as primary store:** Rejected for high-rate wearable analytics (as before).
- **Per-device analysis stacks with no shared roles:** Rejected — no cross-device ML/viz.

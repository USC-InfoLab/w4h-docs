---
title: ADR-008 — GeoMTS as the unifying wearable data abstraction
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-08-21T00:00:00.000Z
---
**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-08-21  
**Deciders:** W4H architecture team  
**Principal investigator:** Cyrus Shahabi, PhD (USC InfoLab)  
**Relates to:** [ADR-003](ADR-003-dataset-table-model.md) (physical tables + `w4h` mapping registry), [ADR-016](ADR-016-paired-sample-importer-repos.md) (sample/importer pairing)  
**References:**
- Hajisafi et al., *Wearables for Health (W4H) Toolkit for Acquisition, Storage, Analysis and Visualization of Data from Various Wearable Devices*, IEEE ICDE 2024 (Demo)
- Nocera et al., *Multi-Context Graph Neural Networks for Enhanced Multivariate Time-Series Analysis in Healthcare*, NIH Special Track at ISMB 2024
- USC InfoLab W4H project: https://infolab.usc.edu/projects/W4H/
- `w4h-icde-demo` (Streamlit prototype behind the ICDE demo paper) — architecturally unrelated to the current stack (direct Postgres/PostGIS, no schema isolation, no mapping registry; see [ADR-021](ADR-021-cohort-control-group-comparison.md)), but its **data model precedent** is directly relevant — see below.

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

There is **no** separate side table whose purpose is only to *mirror* lat/lon/ts encodings that already exist on other rows. GeoMTS is the interpretation layer; rows stay in the signal tables.

### Location as its own signal, not a universal column

Location is not added to every signal table. When a dataset has geospatial context, it is modeled as one or more **geo-typed signals in their own right**, joined to other signals by `subject` + `time` — never as lat/lon columns bolted onto `heart_rate`, `calories`, etc.

Two tiers, both ordinary GeoMTS signals under the additive/provenance model:

1. **Raw geo signal** (observed) — e.g. `gps_track`: `(subject, time, lat, lon)`, ingested as-is from a device. This is the `gps_track` example above.
2. **Derived place-context signal** — e.g. `place_context`: `(subject, time_start, time_end, place_type, confidence)`, produced by a downstream job (stay-point clustering + POI typing) over a raw geo signal. Location may be exact GPS, an approximated centroid (city/neighborhood), or a qualified semantic tag (a recurring visit pattern inferred as "the park", "a bar") — each is a `place_context` row with its own confidence, not a fact bolted onto the raw trace. Per D-04/D-05, this is a new derived dataset/table with provenance back to the source `gps_track`; the original trace is never overwritten.

Any signal (e.g. `heart_rate`) gets location by joining to `gps_track` or `place_context` on `subject` + overlapping `time`/`time_start..time_end` — the same "join logically on mapped subject + time" pattern already used for cross-device analysis, not a physical merge.

### Precedent: the ICDE demo prototype

The `w4h-icde-demo` prototype (pre-dates the current stack) already used this shape, which is direct precedent for the decision above:

- `conf/config.yaml` mapping declares a generic `(user_id, timestamp, value)` role triple for `tables.time_series` (`heart_rate`, `calories`, `steps`, `sleep`, `spo2`, …) and a **separate `tables.geo: [locations]` category** — geo was never a column on the time-series tables.
- `viz.py` reads that `locations` table via `geopandas.read_postgis` as a PostGIS `POINT` geometry keyed by subject + timestamp, filtered by date range, and joins it to the other series by subject + time to build trajectory/GeoJSON map layers.
- The prototype's flattened `synthetic_timeseries_data.csv` (with `latitude`/`longitude` columns wide-joined onto every row) is a **StreamSim input artifact for the real-time demo**, not the canonical DB schema — the actual database kept geo separate, consistent with the model above.

Nothing in the prototype implements the derived `place_context` tier (habit/pattern-detected semantic location) — that is new work extending the precedent, not something carried over.

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
- Raw geo (`gps_track`) and derived place-context signals compose via the same subject+time join as any other cross-signal analysis, with provenance back to the source trace
- Aligns with USC InfoLab GeoMTS research while matching how teams already name fields; matches the `w4h-icde-demo` prototype's own separation of `time_series` vs. `geo` tables

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

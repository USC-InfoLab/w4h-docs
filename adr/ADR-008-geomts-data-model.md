---
title: ADR-008 — GeoMTS as the unifying wearable data abstraction
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-05T01:23:50.000Z
---
# ADR-008 — GeoMTS as the unifying wearable data abstraction

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team  
**Principal investigator:** Cyrus Shahabi, PhD (USC InfoLab)  
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
- Vendor-specific data models and API contracts

Without a unifying abstraction, each device type requires custom ingestion, storage, and analysis code. Queries across device types become impossible without application-level joins and transformations. ML models trained on one device's data cannot be applied to another.

The W4H platform needs a single data model that:

1. Represents all wearable signal types in a common form
2. Separates device type from data management and analysis logic
3. Supports unified querying, visualization, and ML across heterogeneous sensors
4. Preserves geospatial context, which is clinically relevant (location affects activity, exposure, context)
5. Maps cleanly to a PostgreSQL + TimescaleDB storage model

## Decision

All datasets in W4H are represented using the **GeoMTS (Geo-referenced Multivariate Time Series)** abstraction, developed by the USC InfoLab as the foundational data model of the W4H research programme.

### What GeoMTS is

GeoMTS models wearable data as **geo-tagged, multivariate time series collections**:

- **Time series** — every signal is a sequence of (timestamp, value) pairs
- **Multivariate** — multiple signals are captured simultaneously per subject (heart rate, steps, accelerometer axes, SpO2, etc.)
- **Geo-referenced** — each observation carries optional geospatial context (GPS coordinates, location tag, or spatial region)
- **Subject-anchored** — each time series belongs to a subject (participant) in a study

A GeoMTS dataset is formally a collection of tuples:

```
(subject_id, signal_type, timestamp, value, [latitude, longitude])
```

where `signal_type` is drawn from a device-specific schema defined at dataset creation time.

### How GeoMTS maps to the database model

Each signal type within a dataset becomes a physical table in the trial schema (per ADR-003):

```
trial_a.ds42_heart_rate      (subject_id, ts, bpm, lat, lon)
trial_a.ds42_accelerometer   (subject_id, ts, x, y, z, lat, lon)
trial_a.ds42_sleep_stages    (subject_id, ts, stage)
```

The `schema_def` JSONB column on the `datasets` table holds the GeoMTS schema for that dataset — the list of signal types, their column definitions, sampling rate, device type, and whether geospatial columns are present.

```jsonc
// Example schema_def for a Fitbit dataset
{
  "device_type": "fitbit_charge5",
  "signals": [
    { "name": "heart_rate", "columns": [{"name": "bpm", "type": "int"}], "sampling_hz": 1 },
    { "name": "accelerometer", "columns": [{"name": "x", "type": "float"}, {"name": "y", "type": "float"}, {"name": "z", "type": "float"}], "sampling_hz": 25 },
    { "name": "sleep_stages", "columns": [{"name": "stage", "type": "text"}], "sampling_hz": null }
  ],
  "geospatial": false,
  "irb_reference": "OS-16-2"
}
```

### What GeoMTS enables

- **Unified ingestion** — ImportHub maps CSV/JSON/REDCap exports from any device to the GeoMTS schema at ingest time; device-specific parsers are pluggable
- **Unified querying** — researchers query signal tables with standard SQL; the GeoMTS schema tells the query proxy which tables exist and what columns are valid
- **Unified ML** — the BysGNN, NeuroGNN, WaveGNN, and Motif models in W4H are built on GeoMTS representations, making them applicable across device types without model-level changes
- **Unified visualization** — the analytics dashboard renders any GeoMTS-compliant dataset without bespoke code per device type
- **Cross-dataset analysis** — datasets from different devices can be joined on `(subject_id, ts)` when GeoMTS schemas are compatible

### Provenance and additive model

GeoMTS enforces an additive data model: original signal data is never modified. Derived data (model outputs, filtered signals, resampled series) is stored as a new GeoMTS dataset linked to its parent via provenance metadata. This satisfies requirement D-04/D-05 and preserves the audit trail for HIPAA and IRB purposes.

## Consequences

**Positive:**
- Device-type independence — adding a new wearable device requires only a new GeoMTS schema definition and a device-specific ingestion parser; no changes to storage, query, or ML layers
- ML model reuse — GeoMTS-based models (BysGNN, NeuroGNN, WaveGNN) apply to any conforming dataset
- Unified analytics and visualization without per-device bespoke code
- Clean mapping to TimescaleDB hypertables — each signal table is a natural hypertable candidate
- Geospatial context is a first-class citizen — supports spatial queries (activity by location, exposure analysis) without schema changes
- Aligns W4H with the published USC InfoLab research, ensuring the platform reflects the PI's validated academic contributions

**Negative / risks:**
- Schema definition at dataset creation time — if a researcher's device produces signals not anticipated in the initial `schema_def`, the schema must be updated and new signal tables created (DDL operation via `w4h_platform` role)
- Not all wearables have geospatial data — the `lat`/`lon` columns are optional, but their presence must be handled consistently in queries and visualizations to avoid nulls causing silent errors
- GeoMTS is a USC InfoLab research abstraction, not an external standard — interoperability with platforms expecting FHIR or HL7 requires a translation layer (planned post-MVP, see §16 of requirements)
- Heterogeneous sampling rates across signal types in the same dataset require care in cross-signal queries — joining `heart_rate` (1Hz) with `accelerometer` (25Hz) requires explicit resampling

## Alternatives not chosen

- **FHIR (Fast Healthcare Interoperability Resources):** The dominant interoperability standard in clinical systems. Rejected for the primary data model because FHIR is optimised for clinical record exchange, not time-series analytics or ML. FHIR Observations are verbose and not suited to high-frequency sensor data (25Hz accelerometer at scale). FHIR remains planned as a post-MVP export/interoperability layer, not the internal model.
- **Per-device custom schemas:** Rejected — would require bespoke ingestion, storage, query, and ML code per device. Unscalable as device diversity grows, and makes cross-device analysis impossible without application-level joins.
- **Single wide JSONB table:** Rejected for performance reasons (see ADR-003). GeoMTS signal tables are typed physical tables, not JSONB blobs.
- **openEHR archetypes:** A flexible clinical data modelling standard. Rejected — significant implementation complexity, limited tooling for time-series analytics, and no alignment with the existing W4H research codebase.
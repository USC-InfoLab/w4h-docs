# ADR-003 — One physical table per signal type

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team

---

## Context

Wearable devices produce heterogeneous time-series signals — heart rate, accelerometry, sleep stages, glucose, ECG, etc. Each signal type has different columns, sampling rates, and query patterns. We need a storage model for this data inside each trial schema.

Two main options were considered:

**Option A — One physical table per signal type per dataset**

Each dataset gets a set of tables named `ds<id>_<signal_type>`, registered in a `dataset_tables` manifest:

```
trial_a.ds42_heart_rate      (subject_id, ts, bpm)
trial_a.ds42_accelerometer   (subject_id, ts, x, y, z)
trial_a.ds42_sleep_stages    (subject_id, ts, stage)
```

**Option B — Single wide table with JSONB payload**

All signals stored in one table with a `table_name` discriminator and a `payload` JSONB column:

```
trial_a.wearable_data (dataset_id, table_name, subject_id, ts, payload jsonb)
```

## Decision

Use **Option A — one physical table per signal type**.

Signal tables are created automatically by the platform when a dataset is loaded, based on the signal type definitions in `schema_def`. The `dataset_tables` table in each trial schema acts as the manifest, recording which physical tables belong to each dataset.

## Consequences

**Positive:**
- Typed columns enable efficient B-tree and TimescaleDB indexes
- TimescaleDB hypertables work optimally on dedicated tables with a clear time column
- Queries are simple SQL — no JSONB operators or casts
- Schema evolution per signal type is independent (add a column to `ds42_heart_rate` without touching accelerometer data)
- Cross-trial sharing via views is clean — one view per table, typed

**Negative / risks:**
- Requires DDL automation — the platform must CREATE TABLE on dataset load and DROP TABLE on dataset deletion
- Schema migrations for signal table structure must account for all existing `ds*_*` tables (enumerable via `dataset_tables`)
- A dataset with many signal types creates many tables — acceptable at the hundreds-of-trials scale but worth monitoring

## Signal table naming convention

```
ds<dataset_id>_<signal_type>
```

- `dataset_id` is the integer primary key from `datasets`
- `signal_type` is a lowercase slug (e.g. `heart_rate`, `accelerometer`, `sleep_stages`)
- Tables live in the trial schema: `trial_a.ds42_heart_rate`

## Alternatives not chosen

- **JSONB payload table:** Rejected due to poor query performance at scale, inability to use TimescaleDB hypertables effectively, and loss of column-level typing. Acceptable as a staging/ingestion buffer but not for the primary analytical store.
- **Partitioned single table (by signal_type):** Considered as a middle ground. Rejected because PostgreSQL declarative partitioning on a text discriminator still requires JSONB or a very wide column list to accommodate heterogeneous signals.

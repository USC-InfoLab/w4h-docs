---
title: "ADR-016 — Paired sample and importer repositories"
description: Vendor sample data and import tooling as separate paired git repos; discovery is the Contributions catalog (ADR-018).
updated_by: nocera@usc.edu
updated_at: 2026-08-25T00:00:00.000Z
---

**Status:** Draft  
**Date:** 2026-08-16  
**Relates to:** ADR-003 (table model), ADR-007 (API keys), ADR-008 (GeoMTS), ADR-011 (audit), ADR-017 (Samples sandbox), ADR-018 (contributions catalog)  
**References:**
- [ADR-017](ADR-017-community-package-registry.md)
- [ADR-018](ADR-018-contributions-catalog.md)
- [guide/sample-packages.md](../guide/sample-packages.md) (contribute)
- MVP §6.2 / §6.4 (D-14, D-25–D-30)

---

## Context

MVP needs vendor-specific sample CSV/JSON and a path for admins to load data into W4H without direct database credentials. A single consolidated ingest framework (`w4h-ingest` + platform template catalog) is premature — prototype devices and export shapes differ too much.

Researchers and admins should adapt **concrete** import notebooks per vendor; automation uses a **CLI in the same repo** for cron and incremental sync.

## Decision

### Paired repositories

| Role | Naming | Example |
|------|--------|---------|
| Sample data + vendor manifest | `w4h-sample-<vendor>-<format>` | `w4h-sample-fitbit-csv` |
| Importer (notebook + CLI + tests) | `<sample-repo-name>-importer` | `w4h-sample-fitbit-csv-importer` |

Sample repos hold CSV/JSON files and `manifest.yaml` (column types, vendor API doc links, per-signal GeoMTS mapping — see [ADR-008](ADR-008-geomts-data-model.md)). Importer repos call the W4H API with a personal API key.

### Multiple sample datasets, with and without location

There is more than one paired sample/importer set, and they intentionally differ on whether they carry geo signals — this exercises both branches of the GeoMTS mapping (`geo: null` vs. a real geo-typed signal, [ADR-008](ADR-008-geomts-data-model.md)):

| Package | Vendor/source | Geo signal? | Notes |
|---------|---------------|-------------|-------|
| `w4h-sample-fitbit-csv` | Fitbit-style CSV export | No — `geo: null` on every signal | Original pair; per-signal tables (`heart_rate`, `calories`, `weight`, …), no GPS in Fitbit CSV exports |
| `w4h-sample-icde-demo-csv` | `w4h-icde-demo` synthetic dataset | Yes — `gps_track` (raw) | Ported from the ICDE demo prototype precedent (ADR-008); exercises the geo-typed-signal path end to end through `/import/csv-batch` |

Each package sets its own `manifest.yaml.vendor` slug and passes it as `table_prefix` in the import payload (see Import mechanics) so physical tables stay distinguishable across vendors in the same dataset-scoped schema, instead of colliding on generic signal names.

### Listing sample packages

Discovery is the in-app **Contributions** catalog ([ADR-018](ADR-018-contributions-catalog.md)): `w4h.contributions` (publisher, kind, language, repo, README). This ADR only defines **how** sample and importer repos are paired (typically two contribution rows, one repo each). The Samples sandbox is [ADR-017](ADR-017-community-package-registry.md).

### Credentials

API keys are read from **environment or local `.env`** in the importer repo. Keys are **never** versioned in git, manifests, or notebook outputs (ADR-007, MVP D-27).

### Import mechanics

- Importers use `POST /datasets/:id/import/csv-batch` (chunked rows, API key). Against **W4H Samples** canonical datasets, only Super admin may `replace`/`append` (ADR-017). Team-admin ingest applies to the caller’s own team catalogs.
- Payload carries `signal`, `table_prefix`, `columns`, `mapping` (GeoMTS role mapping, stored as-is in `w4h.tables.mapping_json`), `mode`, `dedupe_columns`, `rows`. `table_prefix` (e.g. `fitbit`, `icde_demo`) namespaces the physical table so multiple vendors in the same dataset-scoped schema don't collide on a shared signal slug (e.g. `heart_rate`) — the endpoint no longer hardcodes a vendor prefix.
- Physical tables live in dataset-scoped schemas; metadata and mapping register in `w4h.tables` (ADR-003).
- CLI supports **initial import** (`replace` / `append`) and **sync** (append with dedupe) for cron jobs.

### Deprecations

- Monolithic **w4h-datasets** → per-vendor sample repos + docs index.
- Direct-DB import scripts in **w4h-notebooks** (`import_data.py`, legacy `load_sample_data.ipynb`).

## Consequences

**Positive:** Each vendor ships independently; notebooks stay approachable; cron path is documented and testable.

**Negative:** More repositories to clone; platform must maintain minimal import API contract.

## Alternatives not chosen

- **Consolidated vendor-parser catalog** — rejected for MVP (unknown device abstractions). A later **mapping assistant + generic csv-batch client** that emits a downloadable runnable package is [ADR-024](ADR-024-ingest-assistant.md) (Draft) — that is not a parser framework and does not replace these paired sample repos.
- **CLI-only** — rejected; notebook is primary learning surface.
- **Direct Postgres in samples** — rejected (bypasses ACL, audit, mapping registry).

## Changelog

| Date | Change |
|------|--------|
| 2026-08-16 | Initial draft. |
| 2026-08-16 | Listing moved to Packages registry (ADR-017); Help is contribute-only. |
| 2026-08-16 | Listing is Contributions catalog (ADR-018); one repo per contribution. |
| 2026-08-21 | Added second sample/importer pair (`w4h-sample-icde-demo-csv`, with a `gps_track` geo signal) alongside `w4h-sample-fitbit-csv` (no geo) to exercise both branches of the ADR-008 mapping. Fixed `/import/csv-batch` hardcoding `fitbit_` as the physical table prefix; payload now carries an explicit `table_prefix`. |
| 2026-08-21 | Contributions admin's **Fetch repo info** ([ADR-018](ADR-018-contributions-catalog.md)) applies this pairing convention a second place: inspecting a `<sample-repo>-importer` repo without its own `manifest.yaml` now probes the paired `<sample-repo>`'s `manifest.yaml` directly on GitHub (same `owner/<slug>` convention `contribution-runner.js`'s `pairedDataSlugFor()` uses at run time, but resolved from the repo URL rather than the catalog, since the paired row may not be cataloged yet) and surfaces it as a "paired sample-data repo detected" note. |
| 2026-08-25 | Clarified the rejected alternative: no **vendor-parser** catalog. Private-file ingest via an obscured-profile assistant and a generated runnable package is [ADR-024](ADR-024-ingest-assistant.md), not a new sample pair per study. |

---
title: "ADR-016 — Paired sample and importer repositories"
description: Vendor sample data and import tooling as separate paired git repos; discovery is the Contributions catalog (ADR-018).
updated_by: limbasiabb@gmail.com
updated_at: 2026-08-16T00:00:00.000Z
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

Sample repos hold CSV/JSON files and `manifest.yaml` (column types, Fitbit API doc links, GeoMTS mapping hints). Importer repos call the W4H API with a personal API key.

### Listing sample packages

Discovery is the in-app **Contributions** catalog ([ADR-018](ADR-018-contributions-catalog.md)): `w4h.contributions` (publisher, kind, language, repo, README). This ADR only defines **how** sample and importer repos are paired (typically two contribution rows, one repo each). The Samples sandbox is [ADR-017](ADR-017-community-package-registry.md).

### Credentials

API keys are read from **environment or local `.env`** in the importer repo. Keys are **never** versioned in git, manifests, or notebook outputs (ADR-007, MVP D-27).

### Import mechanics

- Importers use `POST /datasets/:id/import/csv-batch` (chunked rows, API key). Against **W4H Samples** canonical datasets, only Super admin may `replace`/`append` (ADR-017). Team-admin ingest applies to the caller’s own team catalogs.
- Physical tables live in dataset-scoped schemas; metadata and mapping register in `w4h.tables` (ADR-003).
- CLI supports **initial import** (`replace` / `append`) and **sync** (append with dedupe) for cron jobs.

### Deprecations

- Monolithic **w4h-datasets** → per-vendor sample repos + docs index.
- Direct-DB import scripts in **w4h-notebooks** (`import_data.py`, legacy `load_sample_data.ipynb`).

## Consequences

**Positive:** Each vendor ships independently; notebooks stay approachable; cron path is documented and testable.

**Negative:** More repositories to clone; platform must maintain minimal import API contract.

## Alternatives not chosen

- **Consolidated `w4h-ingest` + platform ingest catalog** — rejected for MVP (unknown device abstractions).
- **CLI-only** — rejected; notebook is primary learning surface.
- **Direct Postgres in samples** — rejected (bypasses ACL, audit, mapping registry).

## Changelog

| Date | Change |
|------|--------|
| 2026-08-16 | Initial draft. |
| 2026-08-16 | Listing moved to Packages registry (ADR-017); Help is contribute-only. |
| 2026-08-16 | Listing is Contributions catalog (ADR-018); one repo per contribution. |

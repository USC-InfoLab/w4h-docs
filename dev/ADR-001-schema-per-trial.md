---
title: ADR-001 — Schema-per-dataset isolation
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-08-13T20:00:00.000Z
---
**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team

---

## What a dataset is

A **dataset** is two things:

1. **Catalog** — a row in `w4h.datasets` (name, owning `team_id`, `schema_def`, `ingest_status`, metadata). Teams and projects link to this row. The catalog is not a PostgreSQL schema.
2. **Schema** — one PostgreSQL schema `ds_<id>` for that dataset’s data, recorded in `w4h.dataset_registry`.

Inside `ds_<id>`:

- `dataset_tables` — manifest of tables that belong to this dataset
- `subjects`
- typed signal tables created at ingest (`heart_rate`, `weight`, …)

A dataset is not a namespace of tables inside a `trial_*` schema. Teams have no PostgreSQL schema. The filename `ADR-001-schema-per-trial.md` is unchanged so existing links still resolve. Original drafts used `trial_registry` / `trial_<id>`; those names are `dataset_registry` / `ds_<id>`.

## Context

W4H is a clinical trials platform expecting tens of concurrent studies. Datasets hold sensitive health data and are subject to regulatory audit requirements. We need a multi-tenancy model that:

- Prevents any accidental data leakage between datasets
- Supports per-dataset audit, backup, and archival
- Scales without prohibitive operational cost
- Works with standard PostgreSQL access control primitives

Three common PostgreSQL multi-tenancy models were considered:

1. **Separate databases per dataset** — strongest isolation, but connection pooling is complex, cross-dataset queries are impossible, and migration management is expensive at scale.
2. **Shared schema with tenant_id column + RLS** — simplest operationally, but RLS policies are subtle and a misconfiguration can silently expose data. Harder to audit per-dataset. Backup/archival requires filtering.
3. **Schema per dataset** — hard isolation via PostgreSQL's access control system; schemas are cheap; per-dataset backup/archival is a schema dump; cross-dataset queries are possible via explicit grants.

## Decision

Use **one schema per dataset** inside a single `w4h` database.

Each dataset schema (`ds_<id>`) is created when the catalog dataset is created. Access is controlled by PostgreSQL roles — a role granted on dataset A's schema has no privileges on dataset B's schema.

`w4h.dataset_registry` maps each `w4h.datasets.id` to its immutable `schema_name` and provisioning status. Platform tables (users, teams, projects, dataset catalog, registry, audit log) live in `w4h` (planned rename `w4h_app`). Explicitly shared datasets use `w4h_global` (see ADR-002).

## Consequences

**Positive:**
- Hard data boundary enforced by the database engine, not application code
- Schema-level `GRANT`/`REVOKE` is simple and auditable
- Per-dataset backup and archival is a single `pg_dump --schema=ds_<id>`
- Migrations can be run per-schema and tracked independently
- No risk of RLS misconfiguration silently exposing data

**Negative / risks:**
- DDL migrations must be applied to every `ds_*` schema — requires automation (enumerate `w4h.dataset_registry` / `schema_name LIKE 'ds_%'`)
- `search_path` must be set correctly per session/transaction — requires discipline in the application layer and connection pool configuration (see ADR-005)
- PostgreSQL has no hard limit on schema count, but operational tooling (backups, migration runners) must account for N schemas

## Alternatives not chosen

- **Separate databases:** Rejected due to connection pooling complexity and inability to do any cross-dataset work without application-level joins.
- **Shared schema + RLS:** Rejected due to regulatory risk of policy misconfiguration and poor per-dataset audit/archival story.
- **One schema per trial/team, with datasets as table-name prefixes inside it (`trial_a.ds42_heart_rate`):** Rejected — the dataset is the isolation unit. Catalog stays in `w4h.datasets`; data stays in that dataset’s `ds_*` schema.

## Changelog

| Date | Change |
|---|---|
| 2026-08-13 | Isolation unit is the dataset (`ds_*`, `dataset_registry`), not a nested `trial_*` schema. Catalog vs schema split documented. |

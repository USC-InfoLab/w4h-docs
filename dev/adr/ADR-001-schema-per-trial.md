# ADR-001 — Schema-per-trial isolation

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team

---

## Context

W4H is a clinical trials platform expecting tenth of concurrent trials. Trials handle sensitive health data and are subject to regulatory audit requirements. We need a multi-tenancy model that:

- Prevents any accidental data leakage between trials
- Supports per-trial audit, backup, and archival
- Scales to tenth of trials without prohibitive operational cost
- Works with standard PostgreSQL access control primitives

Three common PostgreSQL multi-tenancy models were considered:

1. **Separate databases per trial** — strongest isolation, but connection pooling is complex, cross-trial queries are impossible, and migration management is expensive at scale.
2. **Shared schema with tenant_id column + RLS** — simplest operationally, but RLS policies are subtle and a misconfiguration can silently expose data. Harder to audit per-trial. Backup/archival requires filtering.
3. **Schema per trial** — hard isolation via PostgreSQL's access control system; schemas are cheap; per-trial backup/archival is a schema dump; cross-trial queries are possible via explicit grants.

## Decision

Use **one schema per trial** inside a single `w4h` database.

Each trial schema (`trial_<id>`) is created automatically on trial registration and contains the full table structure for that trial. Access is controlled by PostgreSQL roles — a user assigned to trial A has no privileges on trial B's schema.

A shared `w4h_app` schema holds platform-wide tables (users, trial registry, audit log). A separate `w4h_global` schema holds explicitly shared datasets (see ADR-002).

## Consequences

**Positive:**
- Hard data boundary enforced by the database engine, not application code
- Schema-level `GRANT`/`REVOKE` is simple and auditable
- Per-trial backup and archival is a single `pg_dump --schema=trial_abc`
- Migrations can be run per-schema and tracked independently
- No risk of RLS misconfiguration silently exposing data

**Negative / risks:**
- DDL migrations must be applied to every `trial_*` schema — requires automation (loop over `information_schema.schemata` where `schema_name LIKE 'trial_%'`)
- `search_path` must be set correctly per session/transaction — requires discipline in the application layer and connection pool configuration (see ADR-005)
- PostgreSQL has no hard limit on schema count, but operational tooling (backups, migration runners) must account for N schemas

## Alternatives not chosen

- **Separate databases:** Rejected due to connection pooling complexity and inability to do any cross-trial work without application-level joins.
- **Shared schema + RLS:** Rejected due to regulatory risk of policy misconfiguration and poor per-trial audit/archival story.

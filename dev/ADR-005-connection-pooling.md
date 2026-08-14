---
title: ADR-005 — PgBouncer transaction-mode pooling
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-04T23:10:40.000Z
---
**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team

---

## Context

With hundreds of concurrent trials and multiple users per trial, the platform will have many simultaneous database connections. PostgreSQL's default process-per-connection model does not scale to thousands of connections without significant memory pressure.

Additionally, schema-per-dataset isolation (ADR-001) requires setting `search_path` correctly for each **dataset**. This must work safely with a connection pool — a pooled connection must not carry a previous dataset's `search_path` into a new request.

## Decision

Use **PgBouncer in transaction mode** as the connection pooler.

`search_path` is set at the **transaction level** (`SET LOCAL search_path = ds_<id>, w4h`), not at the session level (`SET search_path`). In transaction mode, PgBouncer returns the connection to the pool after each transaction, so session-level settings do not persist. `SET LOCAL` is scoped to the transaction and is automatically reset when the transaction ends — making it safe for pooled connections.

```sql
BEGIN;
SET LOCAL search_path = ds_<id>, w4h;
-- all queries in this transaction target that dataset schema
COMMIT;
-- connection returned to pool with search_path reset
```

## Consequences

**Positive:**
- Scales to many concurrent users without exhausting PostgreSQL connection slots
- `SET LOCAL` guarantees `search_path` cannot leak between tenants across pooled connections
- Transaction-mode pooling is the standard recommendation for multi-tenant PostgreSQL workloads

**Negative / risks:**
- Session-level features are unavailable in transaction mode: `LISTEN`/`NOTIFY`, prepared statements (with some PgBouncer config), and advisory locks that span transactions. If any of these are needed, they require a separate non-pooled connection or a session-mode pool.
- Every transaction must explicitly set `search_path` — the application layer must enforce this consistently. A missing `SET LOCAL` would fall back to the default `search_path`, likely `public`, causing a query error rather than a data leak (safe-fail).
- PgBouncer adds a network hop — latency impact is negligible for typical query durations but worth measuring under load.

## Alternatives not chosen

- **Session-mode pooling:** Simpler, but `SET search_path` at session level would persist on the connection after the session ends and be visible to the next tenant. Rejected as unsafe for multi-tenant use.
- **No pooling (direct connections):** Rejected — PostgreSQL cannot handle thousands of direct connections at the scale of hundreds of concurrent datasets with multiple users each.

## Changelog

| Date | Change |
|---|---|
| 2026-08-13 | `search_path` examples use dataset schemas (`ds_*`), not `trial_*`. |
- **Pgpool-II:** More complex to operate than PgBouncer with no meaningful advantage for this use case. Rejected.

---
title: "ADR-023 — SQL analytics contributions (YAML-bound SQL via the API)"
description: Curated SQL contributions declare GeoMTS role requirements in YAML; the API binds identifiers from w4h.tables and executes the template. No free SQL. New data is a new mapped table.
updated_by: nocera@usc.edu
updated_at: 2026-08-23T00:00:00.000Z
---

**Status:** Accepted
**Date:** 2026-08-23
**Relates to:** ADR-003 (table model), ADR-008 (GeoMTS), ADR-011 (audit logging), ADR-018 (contributions catalog), ADR-019 (METs & wear compliance), ADR-020 (basic stats), ADR-021 (cohort comparison), ADR-022 (run.sh trigger)
**References:**
- [dev/analytics-sql-engine-options.md](analytics-sql-engine-options.md) — exploratory memo this ADR supersedes
- [dev/analytics-contributions.md](analytics-contributions.md) — RA handoff (Python METS repo unchanged)
- MVP D-14, D-25, D-34

---

## Context

Wearable analytics such as MET derivation (`METs ≈ calories / (weight_kg × 0.25)` per a documented reference interval) are joins and interval-scaled arithmetic over mapped signal tables. Pulling every calories row into pandas to do that does not scale. Copying each formula into a new `w4h-api/lib/dataset-*.js` module also does not scale — ADR-019, ADR-020, and ADR-021 already risk three near-identical discovery / identifier-escape / `datasets.summary` caches ([ADR-021](ADR-021-cohort-control-group-comparison.md) named the missing single source of truth).

[ADR-019](ADR-019-mets-wear-compliance-analytics.md) already said contributions should read **SQL against `w4h.tables`** until a query API exists. The pandas package [`w4h-compute-mets`](https://github.com/USC-InfoLab/w4h-compute-mets) still falls back to local CSVs because that API was missing, and it hardcodes `fitbit_*` names so it cannot bind an ICDE-loaded dataset.

The exploratory memo [analytics-sql-engine-options.md](analytics-sql-engine-options.md) weighed SQL-in-place vs pandas, YAML manifests vs `run.sh`, and a free SQL endpoint vs Super-admin-vetted templates. This ADR locks the chosen path.

**Implementation status:** Accepted and partially built (D-34 in progress): `GET /datasets/:id/signals`, `POST /datasets/:id/contributions/:slug/sql`, `kind: sql` catalog CHECK, first package `w4h-sql-compute-mets` (YAML/SQL plus a thin notebook/CLI that pick **one dataset** in a project). Interval/unit persist on ingest going forward; already-loaded datasets may pass `interval_minutes` on the run.

---

## Decision

### 1. New catalog kind `sql`

Amend [ADR-018](ADR-018-contributions-catalog.md): `w4h.contributions.kind` / `kinds` gains **`sql`**.

| Kind | Meaning |
|---|---|
| `sql` | A YAML-declared, parameterized SQL **job** the API binds and executes |
| `postgres_extension` | `CREATE EXTENSION` on the institution’s Postgres (e.g. `fft_approximate`) — not a job |

`language: sql` may appear on either kind. Super-admin curation is unchanged (community self-publish remains M9). SQL text is Super-admin-vetted with the catalog row — the same trust model as ADR-022’s `runnable` flag. Unreviewed community SQL is out of scope (memo option B2).

### 2. Package shape — roles, not physical names

One git repo per SQL contribution ([ADR-018](ADR-018-contributions-catalog.md)). The repo ships:

- **`manifest.yaml`** — `requires[]` / `produces[]` as **GeoMTS roles** (`signal_type`, value name, unit), not `ds_*.fitbit_calories`
- **Parameterized SQL** — placeholders such as `{{calories_rel}}`, `{{subject_col}}`, `{{calories_col}}`, `{{weight_rel}}`, `{{interval_minutes}}`. Identifiers are bound only from `w4h.tables` / `information_schema` through an allowlist (`sqlIdent`); never concatenated from client strings
- **Optional notebook + CLI** — thin HTTP clients that pick **one dataset** in a project (`GET /projects/:id` when several are linked), inspect `GET /datasets/:id/signals`, and call the bind/execute endpoint. They are not a local compute path and must not `POST` arbitrary SQL

Example (METs):

```yaml
requires:
  - signal_type: calories
    value: calories
    unit: kcal
  - signal_type: weight
    value: weight_kg
    unit: kg
    missing: last_known_or_default
    default_kg: 70
produces:
  - signal_type: mets_computed
    value: mets
    unit: MET
formula: calories / (weight_kg * 0.25)   # 0.25 per 15-minute reference interval
```

The same template must bind Fitbit (`table_prefix: fitbit`, 1 min) and ICDE demo (`table_prefix: icde_demo`, 5 min) without forking SQL. When a dataset holds both prefixes, run **per prefix** and write `fitbit_mets_computed` vs `icde_demo_mets_computed`.

**Sampling interval and unit** must live on `w4h.tables` mapping (today they are often manifest-only at ingest). Discovery and the binder use that mapping — not a table-name heuristic such as matching `"icde"`.

### 3. SQL via the API — bind a vetted template, never free SQL

The API (`lib/sql-contribution-engine.js`):

1. Resolves required signals from **`GET /datasets/:id/signals`** (or equivalent) over `w4h.tables` + `information_schema` (mapping, physical schema.table, unit, sampling interval).
2. Substitutes only bound identifiers into the contribution’s SQL template.
3. Executes in-process (statement timeout; no multi-statement scripts; no client-supplied SQL body).
4. Audits the action (`dataset.query` / `dataset.derive`) without logging full query text as PHI ([ADR-011](ADR-011-hipaa-audit-logging.md)).

**Not an endpoint:** `POST { sql: "anything" }`. W4H is not a SQL IDE ([ADR-018](ADR-018-contributions-catalog.md)).

**Not ADR-022 `run.sh`.** `run.sh` remains the Python/CLI importer trigger (subprocess, needs Python on the host or Docker `notebooks` delegation). SQL contributions do not spawn Python.

**Two HTTP entry points, one engine.** Both call the same `runSqlContribution()` function in-process (the run dispatcher never HTTP-loops to the dataset route):

| Entry | Client | Body (typical) | Response |
|---|---|---|---|
| `POST /contributions/:slug/run` | **w4h-app** (Datasets **Run import…**, Analytics **Run analysis…**) | `{ dataset_id }` (+ `mode` for importers only) | `202` + `contribution_runs` id → poll `GET /contributions/runs/:id` |
| `POST /datasets/:id/contributions/:slug/sql` | **Notebooks / CLI** over HTTP | `{}` (manifest `run.materialize` drives write-back) | Sync JSON (rows, `inserted`, table names) |

Optional **`GET /datasets/:id/signals`** before run — bind/readiness display; not required because bind discovery runs inside the engine.

Manifest **`run.materialize: true`** (e.g. `w4h-sql-compute-mets`) sets default behavior when the body is empty — no `write_back` / `interval_minutes` params required for the normal path. Interval comes from `w4h.tables` mapping; legacy datasets without `sampling_interval` fail with an actionable error.

**`postgres_extension`** (e.g. `fft_approximate`) is **not** a per-dataset run job — install on Postgres, use from a notebook. A future **`kind: sql`** job may call extension functions inside its vetted SQL when the extension is installed.

### 4. Read vs write

| Tier | Action | Who |
|---|---|---|
| 1 | View cached / bounded read-only results | Any project member who can already see the dataset (existing dataset ACL; ADR-019 A-07 role parity) |
| 2 | Refresh a bounded read-only aggregate into `datasets.summary` | Team admin+ today (`POST /datasets/:id/summary/refresh`); may later relax to project owner/editor because the blast radius is a `SELECT` |
| 3 | Materialize a **new** derived signal table (`INSERT … SELECT` + `w4h.tables` register) | Team admin / project owner, or future `create_derived` / [D-22](mvp.md) capability. Schema already has unused `resource_type = 'derived_table'`, `permission = 'create_derived'` |

New data is a **new table** ([ADR-003](ADR-003-dataset-table-model.md) Option A, [ADR-008](ADR-008-geomts-data-model.md)): never mutate calories or weight in place. Reuse ingest DDL/register helpers; do not require a CSV round-trip.

Do not silently widen API-key write scope beyond existing ingest tension in [ADR-007](ADR-007-authentication-model.md).

### 5. First listing, distinct from the pandas tool

| Slug | Kind | Language | Role |
|---|---|---|---|
| **`w4h-sql-compute-mets`** | `sql` (+ notebook, cli) | `sql` | Platform METS job: YAML + SQL executed by the API; notebook/CLI are thin clients over that API |
| `w4h-compute-mets` | `notebook` + `cli` | `python` | Unchanged pandas companion ([ADR-019](ADR-019-mets-wear-compliance-analytics.md) WP3) |

Publisher: `usc-infolab`. Do not fold the SQL job into the Python repo. Catalog visibility is the same as any contribution: `/contributions` after Super admin publishes the row — not a new nav item or Help page.

### 6. Later analytics cards share the engine

`mets_summary` (ADR-019), `basic_stats` (ADR-020), and `cohort_comparison` (ADR-021) become additional YAML manifests on this engine. Do **not** add more bespoke `lib/dataset-*.js` modules that each own a formula. Cached `datasets.summary` keys and Analytics cards **read** engine output (derived table or bounded report). The API does not own the MET formula long-term.

Python/R notebooks remain the right tool when the computation is not expressible as deterministic SQL.

---

## Consequences

**Positive:**
- Next analytics contribution is another repo with the same YAML contract, not a Node port.
- Fitbit vs ICDE is a mapping difference, not a SQL fork.
- No-egress compute (SQL-in-place) matches TRE intent ([ADR-006](ADR-006-trusted-research-environment.md)) better than exporting rows to pandas.
- SQL jobs do not need Python in the `api` Docker image (the ADR-022 D-31 gap).

**Negative / risks:**
- `kind: sql` needs a schema CHECK and catalog UI badge before rows can be seeded.
- Interval/unit must be persisted on mapping or ICDE METs will be wrong if defaulted to 1 min.
- Users still cannot DDL; materialize stays Admin until D-22 / `create_derived` is implemented.
- Subject-demographic schema for ADR-021 remains an inherited gap.

---

## Alternatives not chosen

- **Free SQL API** (`POST` arbitrary SQL) — rejected; PHI exfil / injection; conflicts with ADR-011 and ADR-018.
- **Unreviewed community SQL (memo B2)** — rejected for v1; needs a restricted DB role, `EXPLAIN` caps, and DDL sandboxing first.
- **Port each formula into `w4h-api/lib`** — rejected; does not scale past METS.
- **Rewrite `w4h-compute-mets` in SQL** — rejected; keep the pandas notebook/CLI; add a **new** SQL contribution.
- **Execute SQL jobs via ADR-022 `run.sh`** — rejected as the primary path; `run.sh` stays for Python importers.
- **Treat `postgres_extension` as a SQL job** — rejected; extensions are installed on Postgres, not bound per dataset.
- **In-place update of source signal tables** — rejected; ADR-003 / ADR-008 require a new mapped table for derived products.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-24 | Unified in-app run: `POST /contributions/:slug/run { dataset_id }` for SQL jobs; notebook sync entry `POST /datasets/:id/contributions/:slug/sql`; manifest `run.materialize`; `w4h-sql-compute-mets` seeded `runnable`. |
| 2026-08-23 | `w4h-sql-compute-mets` notebook + CLI: pick one dataset in a (possibly multi-dataset) project; call signals + bind/execute APIs. Catalog `kinds: sql, notebook, cli`. Formula stays in SQL, not in `w4h-api`. |
| 2026-08-23 | First slice built: `w4h-sql-compute-mets` package, `GET /datasets/:id/signals`, `POST /datasets/:id/contributions/:slug/sql`, `kind: sql` CHECK + catalog seed. Interval persisted on ingest; existing datasets may pass `interval_minutes`. |
| 2026-08-23 | Accepted. Graduates [analytics-sql-engine-options.md](analytics-sql-engine-options.md). New `kind: sql`; YAML-bound SQL via the API; `w4h-sql-compute-mets` planned; pandas `w4h-compute-mets` unchanged. |

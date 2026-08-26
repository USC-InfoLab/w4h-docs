---
title: "Analytics SQL engine — options memo"
description: Exploratory (non-ADR) memo superseded by ADR-023. Kept as the tradeoff history for SQL-in-place analytics contributions.
updated_by: nocera@usc.edu
updated_at: 2026-08-23T00:00:00.000Z
---

**Status:** Superseded by [ADR-023](ADR-023-sql-analytics-contributions.md)
**Date:** 2026-08-22
**Relates to:** [ADR-018](ADR-018-contributions-catalog.md) (contributions catalog), [ADR-019](ADR-019-mets-wear-compliance-analytics.md) (METs & wear compliance), [ADR-020](ADR-020-basic-dataset-stats-dashboard.md) (basic stats), [ADR-021](ADR-021-cohort-control-group-comparison.md) (cohort comparison), [ADR-022](ADR-022-in-app-contribution-run-trigger.md) (run trigger), [ADR-008](ADR-008-geomts-data-model.md) (GeoMTS)
**References:** [dev/analytics-contributions.md](analytics-contributions.md)

---

**Superseded 2026-08-23.** The chosen direction is [ADR-023](ADR-023-sql-analytics-contributions.md) (Accepted): YAML-bound SQL contributions, executed by the API, new `kind: sql`, first listing `w4h-sql-compute-mets`. This page is kept as the tradeoff history (options A1/A2, B1/B2, C1/C2). Do not treat leanings below as current product rules.

## 1. Context

The proximate question: Fitbit's own METs figure is derived from Fitbit's on-file body weight, which may be stale or self-reported. A trial that captures a more accurate weight — a clinic scale entry, a connected smart scale, an EHR import — needs to *recompute* METs from `calories` + the better weight, not trust the vendor's number. That recomputation need is already the documented rationale in ADR-019: `METs ≈ calories / (weight_kg × 0.25)` per 15-minute reference interval, with missing-weight handled by "latest known per subject, else 70kg default."

The broader question is architectural: should this kind of derivation happen **in SQL, in place, against filtered/study-endpoint-matched data**, exposed through a generic W4H API — with table discovery, ACL-aware table management, new-data-to-new-table write-back, and SQL contributions declared via YAML like other notebooks — as a general, drop-in pattern for analytics-contributions?

**This isn't greenfield.** `w4h-api/lib/dataset-mets-summary.js` already does almost exactly the "SQL-only, bounded, no-pandas" thing this question is reaching for. The trouble is it's one of *three* hand-written, structurally near-identical modules:

| ADR | `datasets.summary` key | Module |
|---|---|---|
| ADR-019 | `mets_summary`, `wear_compliance` | `lib/dataset-mets-summary.js` (built) |
| ADR-020 | `basic_stats` | `lib/dataset-basic-stats.js` (planned) |
| ADR-021 | `cohort_comparison` | not yet named (planned) |

Each independently reimplements table discovery (`w4h.tables` + `information_schema`), column resolution, SQL-identifier escaping, and `datasets.summary` caching. ADR-021 already names this as an open risk: *"the combined jsonb shape needs one documented source of truth once more than one of these ADRs reaches Accepted."* That's the platform already recognizing the problem this memo is exploring a fix for.

## 2. Current state (grounding facts)

- **`w4h-api/lib/dataset-mets-summary.js`** — the existing SQL-only precedent, and the closest thing today to what's being proposed. It reads `w4h.tables` to find a dataset's mapped signal tables, resolves the actual column names live via `information_schema.columns` (`tableColumns()`, `pickExisting()`, `mappedSource()`), escapes every identifier through an allowlist regex (`sqlIdent()` — never string-concatenated into SQL), and computes cohort METs via bounded `GROUP BY` CTEs (`summarizeDerived()` joins `calories` to a `latest_weight` CTE; `summarizeComputedTable()` and `summarizeVendorMets()` handle the cases where a `mets_computed` or vendor `mets` signal already exists). It returns a plain JSON object, capped at 100 subjects, cached into `datasets.summary.mets_summary`. Zero pandas, zero per-row materialization.
- **`w4h-compute-mets`** (sibling contribution repo, cataloged per ADR-019) — the pandas/CLI precedent. It pulls calories + weight, forward-fills weight in pandas, computes per-row METs, and optionally writes back a `mets_computed` signal via `POST /datasets/:id/import/csv-batch` (`--write-back`, opt-in, off by default). Its own README documents a real gap: **no live per-row query API exists today**, so it falls back to reading raw sample CSVs directly instead of querying the live dataset.
- **ADR-018** (contributions catalog) — one git repo per contribution; `w4h.contributions.kind` enum is `notebook | cli | script | postgres_extension | dataset` (no slot today for "declarative SQL job"); `language` enum already includes `sql`, used today only by `fft_approximate` (a Postgres extension, not an executed SQL job). Catalog rows are Super-admin-curated; community self-publish is deferred (M9).
- **ADR-022** (run trigger) — the only in-app execution precedent that exists. A contribution ships a standardized `run.sh` at its repo root; `w4h.contributions.runnable` is a Super-admin-set boolean (default `false`, currently `true` only for the CSV importer); `w4h-api/lib/contribution-runner.js` spawns `run.sh` as a subprocess, streams a `@@PROGRESS@@ {json}` line convention into `w4h.contribution_runs`, and writes an append-only `w4h.audit_log` row. Explicitly **"no new authorization layer"** — the runner just calls whatever API endpoint the script calls, and that endpoint's existing ACL is what actually gates the write. Docker execution needs Python in the `api` image or delegation to the `notebooks` container — designed (D-31), not built.
- **ACL** — `w4h.project_acl_rules` already carries unused vocabulary: `resource_type = 'derived_table'`, `permission = 'create_derived'`. Nothing implements either today, but the schema already anticipated a "materialize a derived table" capability distinct from raw ingest.
- **Write-back mechanics** — `POST /datasets/:id/import/csv-batch` (`lib/ingest-csv.js`) already does the physical DDL (`ensurePhysicalTable`) and `w4h.tables` registration (`registerCatalogTable`) needed to create and register a brand-new derived signal table. It's the one existing generic path for "create + register a new table," gated by `assertCanIngestDataset` (super admin, team admin, or project owner; blocks writes to read-only sample datasets).
- **GeoMTS (ADR-008)** — no wide table. One physical table per signal, native (vendor) column names preserved, `w4h.tables.mapping_json` is the live source of truth for which columns play the `subject`/`time`/`values[]` roles. Derived products must be new tables/signals with provenance — never an in-place mutation of a source table.

## 3. Rationale, answered

**Why recompute METs at all?** Fitbit bakes its own weight assumption into its calorie/MET estimate. A study with a better weight source — a clinic scale, a connected device, an EHR feed — needs to substitute that weight and recompute, not trust the vendor figure. This is exactly ADR-019's stated rationale, and it generalizes: any vendor-supplied derived metric that depends on a value the platform can supply more accurately is a candidate for the same pattern.

**Other reasons a SQL (or Python/R) calculation module earns its keep as a generic pattern**, beyond the weight-substitution case:

- **Cross-vendor unit harmonization** — kcal vs. kJ, kg vs. lbs, local time vs. UTC — before any cross-dataset comparison is meaningful.
- **Alternate formulas for the same construct** — e.g. heart-rate-based energy-expenditure equations (ACSM-style) as an alternative to the calories+weight formula, swappable per study without touching the ingest pipeline.
- **Study-endpoint/window-scoped aggregates** — "only protocol days," "only post-randomization," "only non-excluded intervals." Filtering has to happen *before* aggregation to be efficient; doing that filter as a SQL `WHERE`/`JOIN` against an enrollment or visit table, rather than pulling every row and filtering client-side, is the difference between a bounded query and a full scan.
- **Reproducibility and audit** — a versioned SQL definition run against the live database is trivially re-runnable and diffable. A pandas notebook run against a downloaded CSV snapshot is a point-in-time artifact; re-running it after new data lands means re-exporting.
- **Approximate cohort-scale analytics** — `fft_approximate` already anticipates exactly this: SQL-native approximate aggregates over large series without full materialization. A cohort too large to reasonably round-trip through pandas is a natural fit.
- **No-egress deployments** — SQL-in-place never moves raw rows off the database host. A pandas pipeline requires exporting rows to a Python process, which is precisely what the TRE deployment mode (ADR-006) wants to avoid.
- **Multi-signal joins at mismatched sampling rates** — aligning HR + accelerometer + calories (different native intervals) is a single SQL query with window functions, versus three separate pulls and a manual resample in pandas.

## 4. SQL vs. pandas round-trip

Recommendation: **default to SQL-in-place**, in two tiers.

1. **Cached cohort/aggregate stats** (dashboard cards) — already proven by `dataset-mets-summary.js`. No reason to build these any other way.
2. **Full per-row derived-signal write-back** — today's `w4h-compute-mets` does this in pandas (forward-fill weight, compute per row, POST a CSV batch back). If the computation is expressible as one deterministic SQL statement — and weight forward-fill is: `LAST_VALUE(weight_kg) OVER (PARTITION BY subject ORDER BY ts ROWS UNBOUNDED PRECEDING)` — it can become a single server-side `INSERT INTO ds_<id>.mets_computed SELECT ...`, with no CSV export/import round-trip at all. This is meaningfully cheaper and, per the point above, avoids raw-data egress entirely.

Python/R notebooks remain the right tool when the computation genuinely can't be expressed in SQL — real signal processing, interpolation beyond simple forward-fill, statistical modeling. Nothing here proposes retiring the notebook path; it's a question of which tier a given calculation belongs in.

## 5. Architecture options

Presented as real alternatives, not a single answer.

### 5.1 Table discovery

- **A1 — reuse what exists.** `w4h.tables` + `information_schema` is already sufficient and already used by `dataset-mets-summary.js`. A manifest declares `requires: [signal_type: calories, signal_type: weight]`; the engine resolves at runtime exactly like the existing module does. No new API.
- **A2 — add a discovery endpoint.** `GET /datasets/:id/signals` (or similar), returning available signal types + resolved columns + units per `w4h.tables`, so a contribution — or the in-app UI — can answer "is calories available, what column, what unit" *before* running anything, without needing SQL credentials at all.

*Leaning:* build A2 as a thin read-only wrapper over A1's existing resolution logic. Cheap, and it's a prerequisite for the self-serve "can I run this" UI in §5.5.

### 5.2 SQL authorship / trust boundary

- **B1 — Super-admin-authored/reviewed only.** SQL ships as a manifest inside a Super-admin-vetted contribution repo (or literally as code in `w4h-api`, as today); community proposes via PR, Super admin merges and curates — the same trust model ADR-018 already uses for catalog rows and ADR-022 uses for the `runnable` flag. No new trust boundary.
- **B2 — fully open.** Any published contribution ships SQL the API executes against real tenant data, no human review. This needs a real sandbox first: a restricted DB role, per-statement timeouts, row/cost caps (`EXPLAIN`-checked before execution), no DDL/DML outside a `derived_table`-tagged schema, identifier allowlisting (the `sqlIdent()` pattern already proves this part). That sandboxing is a distinct, larger engineering effort — not something to bundle into a first version.

*Leaning:* B1, matching the direction already indicated — community-proposed, Super-admin-curated. B2 stays a named future option, not a v1 target.

### 5.3 Execution engine

- **C1 — in-process, declarative.** Generalize `dataset-mets-summary.js` into a small interpreter: a YAML manifest declares signal requirements and a parameterized SQL template (role placeholders like `{{calories.value_col}}`); the engine resolves placeholders against `w4h.tables`/`information_schema` (reusing `pickExisting()`/`sqlIdent()`), executes, returns/caches the result. Good fit for cheap, cached, read-only aggregates.
- **C2 — subprocess, extending ADR-022.** The contribution ships as a CLI triggered via `POST /contributions/:slug/run`, same shape as today's importer — audited, dependents-check-aware, heavier. Good fit for an explicit, occasional, write-back-capable job.

*Leaning:* not either/or — split by workload. C1 for the cached-aggregate tier (§4.1), a SQL-only variant of C2 (a `.sql` file executed server-side as one `INSERT...SELECT`, no Python subprocess at all) for the write-back tier (§4.2). The SQL-only write-back variant also sidesteps ADR-022's Docker/Python gap entirely, since it needs no subprocess.

### 5.4 Write-back mechanics

Reuse `POST /datasets/:id/import/csv-batch`'s existing DDL (`ensurePhysicalTable`) and registration (`registerCatalogTable`) logic — but let a SQL-only engine invoke that logic directly server-side (compute via `INSERT...SELECT` into an already-DDL'd table, then register), rather than requiring a client to round-trip through CSV batches. Gate materialization with the still-unimplemented `create_derived` permission (§2) rather than reusing the blanket `assertCanIngestDataset` gate — "compute and materialize a derived summary" is a narrower capability than "ingest raw vendor data," and the schema already has the vocabulary for that distinction sitting unused.

### 5.5 Self-serve run for project admins and users

Extend ADR-022's `runnable` pattern beyond its current single-contribution scope, with a tiered ACL rather than one blanket gate:

| Tier | Action | Proposed gate |
|---|---|---|
| 1 | View a cached result | Any project member who can already see the dataset (existing `sqlDatasetAccessibleToUser`) — matches ADR-019's A-07 role parity: Users and Admins see identical stats |
| 2 | Trigger a fresh bounded, read-only recompute | Today: Team admin+ (matches `POST /datasets/:id/summary/refresh`). Proposal: consider relaxing to project owner/editor for a *read-only* aggregate refresh — the blast radius is a bounded `SELECT`, not a write |
| 3 | Materialize + write back a new derived signal table | Team admin+ / the new `create_derived` permission, until a dependents-check-style guardrail exists for derived tables the way ADR-022 built one for full re-imports |

This is the answer to "run this notebook to compute METs on my dataset, for project admin and users": Tiers 1–2 can reasonably open to Users today, on precedent already established; Tier 3 (physical write-back) should wait for `create_derived` and a guardrail, the same way ADR-022 didn't let full re-import proceed without a dependents check.

### 5.6 Visualization: notebook vs. in-app

- **F1 — notebook-rendered.** The contribution's companion notebook renders charts against the same computed result. Zero new in-app work, full flexibility, requires Jupyter access — which ADR-022's own motivating example (a non-technical PI) argues against as the *only* path.
- **F2 — in-app stat card.** Cached numeric summary (mean/min/max, cohort distribution) on the Analytics tab — same shape as the existing `mets_summary` card. No time-series charting.
- **F3 — in-app charts.** Real time-series/distribution charts in `w4h-app`. This is MVP A-02 (full chart library) territory, already deferred platform-wide — not something this memo should scope in on its own.

*Leaning:* F1 ships as-is today (already true of `w4h-compute-mets`'s notebook); F2 is the near-term proof for a generalized engine (mirrors work already planned for `mets_summary`); F3 stays deferred to the general M3 chart-library effort, matching the platform's existing "notebook first, dashboard card after validation, full charts later" sequencing (ADR-019 → ADR-021 both already follow this).

## 6. Migration proof

The strongest evidence this generalizes: map the three existing/planned bespoke modules onto the C1 manifest shape.

- **`mets_summary`** (ADR-019, built) → `requires: [calories, weight]` (falls back to an existing `mets_computed`/`mets` signal if present — already the `computeMetsSummary()` fallback chain); SQL template mirrors `summarizeDerived()`'s `latest_weight` CTE.
- **`basic_stats`** (ADR-020, planned) → `requires: []` — works on any dataset by construction, proving the engine handles the vendor-agnostic, no-signal-requirement case too. Template: `COUNT(DISTINCT subject)`, `MIN/MAX(time)`, row counts per mapped table.
- **`cohort_comparison`** (ADR-021, planned) → `requires` a subject-attribute filter column. This migration doesn't solve ADR-021's own flagged gap — no first-class subject-demographic schema exists yet — it just inherits it; the manifest would need to declare that dependency explicitly rather than hide it.

Net effect: three `datasets.summary` sub-keys become three manifests on one engine instead of three separately-maintained JS files — directly closing the "no single source of truth" risk ADR-021 already named.

## 7. METs proof-of-concept scope

Per the direction to prove this generically, not just for Fitbit-shaped data: define the `requires:` contract as calories + weight, **or** an existing `mets`/`mets_computed` signal, with a graceful "not available" result otherwise — which `computeMetsSummary()`'s existing fallback chain (`summarizeComputedTable` → `summarizeDerived` → `summarizeVendorMets`) already does reasonably well via `mappedSource()`/`pickExisting()` rather than hardcoded column names.

One real gap worth closing as part of this proof: `inferIntervalMinutes()` currently falls back to a string match on `"icde"` in the physical table name to guess a 5-minute sampling interval. That's exactly the kind of vendor-specific hardcoding a "generic" module shouldn't have. Recommend requiring `sampling_interval` explicitly in the signal's `w4h.tables` mapping (already a field the ADR-016 sample-package `manifest.yaml` format supports) instead of inferring it from a table name.

## 8. Open questions / risks not resolved here

- **Sandboxing for open community SQL** (B2, §5.2) — a real requirement if that direction is ever revisited; not attempted here.
- **Subject-demographic schema gap** — inherited from ADR-021, unresolved; blocks genuine cohort filtering regardless of execution engine.
- **Docker/Python execution gap** (ADR-022 D-31) — applies to the subprocess/CLI tier (C2, §5.3); the pure-SQL engine (C1, and a SQL-only C2 variant) sidesteps it by needing no Python subprocess at all, which is itself worth weighing in favor of the SQL-native path.
- **Live per-row query API** — still doesn't exist; `w4h-compute-mets`'s own documented workaround (reading raw CSVs) is unaffected by anything proposed here. If a future analytic genuinely needs row-level access beyond bounded aggregates, that gap remains open.

---

## Changelog

| Date | Change |
|---|---|
| 2026-08-23 | Superseded by [ADR-023](ADR-023-sql-analytics-contributions.md). Tradeoff text retained as history. |
| 2026-08-22 | Initial draft — exploratory options memo, not an ADR. |

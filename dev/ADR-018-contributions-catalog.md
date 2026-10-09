---
title: "ADR-018 — Contributions catalog; no project notebook registry"
description: Platform catalog of contributed tools (publisher, repo, docs). W4H does not track researchers’ project notebooks.
updated_by: nocera@usc.edu
updated_at: 2026-09-21T00:00:00.000Z
---

**Status:** Accepted  
**Date:** 2026-08-16  
**Relates to:** ADR-006 (Flexible compute), ADR-007 (API keys), ADR-015 (Docker notebooks service), ADR-016 (paired sample/importer repos), ADR-017 (Samples sandbox), ADR-023 (SQL analytics contributions)  
**References:**
- MVP §6.2 (D-14, D-25)
- [guide/sample-packages.md](../guide/sample-packages.md)

---

## Context

W4H previously stored **project notebook links** (`w4h.project_notebooks`: repo URL, path, launchers) on the project workspace. That made the platform look like a notebook manager. Researchers already keep analysis in **git** and in **notebooks themselves**. Project **pages** are enough for pointers and protocol notes.

Separately, first-party and community **tools** (ingest notebooks, CLIs, scripts, PostgreSQL extensions) need a discoverable catalog — analogous to VS Code extensions (publisher + listing + README from the package repo). ADR-017’s git JSON index (`registry/packages.json`) was a first listing surface; it is not a Super-admin-editable catalog and it still assumed project-tracked notebooks.

`fft_approximate` is a real PostgreSQL extension for approximate time-series aggregates. It is useful outside W4H (like PostGIS or TimescaleDB) and already lives in its own git repo.

## Decision

### 1. No project notebook registry

Drop `w4h.project_notebooks` and the `PUT /projects/:id/notebooks` API. Remove notebook launchers from the project workspace.

Teams track their own analysis in:

- **Project documentation pages** (repo URLs, how-to notes)
- Their **versioned git repository**
- Documentation **inside** the notebooks

Project ACL no longer includes `resource_type = notebook` or `permission = launch_notebook`.

Dataset sharing still does not expose another team’s analysis artifacts (ADR-002, ADR-012).

### 2. Contributions catalog (`w4h.contributions`)

The platform holds **metadata pointers** only — not `.ipynb` blobs or extension binaries.

| Field | Role |
|---|---|
| `slug` | Stable id (`publisher` + name, unique) |
| `publisher` | VS Code-style publisher string (not a required user FK) |
| `title`, `summary` | Listing copy |
| `kind`, `kinds` | One or more of `notebook` \| `cli` \| `script` \| `postgres_extension` \| `dataset` \| `sql`. Importers that ship a notebook and a CLI list both; ADR-016 sample-data repos (manifest.yaml + CSV/JSON, no code) are `dataset`, not `script`. `kind: sql` is a YAML-declared, parameterized SQL **job** the API binds and executes ([ADR-023](ADR-023-sql-analytics-contributions.md)) — distinct from `postgres_extension` (`CREATE EXTENSION` on the institution’s Postgres). `kind` is the primary (first) value. |
| `language` | `python` \| `r` \| `sql` \| `csv` \| `json` \| `other`. For `dataset` rows this is the sample's file format (manifest.yaml's `format` field), not a programming language. `language: sql` appears on both `kind: sql` (a job) and `kind: postgres_extension` (an extension). |
| `repo_url`, `repo_ref`, `docs_path` | Git location; default docs `README.md`. `repo_ref` is the **pin** the platform runs (a `vMAJOR.MINOR.PATCH` tag, not `main`). |
| `version` | Display semver derived from the pinned tag (`v0.2.0` → `0.2.0`). |
| `latest_version`, `latest_repo_ref`, `version_checked_at` | Last-seen GitHub tag from Super admin **Check for updates**. Not a version history table. |
| `status` | `draft` \| `published` \| `deprecated` |

**Who:** authenticated users **browse** published rows (including the pinned `version`). **Super admin** creates/edits and **pins a GitHub tag** (MVP). Community self-publish is M9.

**Version pin:** the catalog stores one current pin per row, not a changelog of past releases. Publishers cut a `v*` tag (GitHub Release preferred) when Super admin should be able to pick it up. Super admin **Check for updates** lists semver tags (`POST /contributions/check-updates`), caches `latest_*`, and **Update** inspects that ref then sets `repo_ref` + `version` (`POST /contributions/:slug/update-version`). Never auto-follow `main`. `pyproject.toml` version is a hint only — sample-data repos have none. Paired importer and sample-data repos version independently; updating one warns if the other also has a newer tag. `w4h.contribution_runs` copies `version` + `repo_ref` at run start so “what executed” survives a later pin bump.

**Docs page:** the catalog detail view renders the linked repo README (public GitHub raw), or falls back to an external link. Contribution docs are **not** copied into `w4h-docs`. Help explains how to contribute; it is not a page per tool.

**Index of record** for the in-app catalog is `w4h.contributions`, not `registry/packages.json`. ADR-017’s **W4H Samples sandbox** (canonical demo ingest, personal API keys) is unchanged.

### 3. One git repo per contribution

Each catalog row points at **one** repository that does **one** job. First-party MVP listings:

| Slug | Kind | Language | Repo |
|---|---|---|---|
| `fft-approximate` | `postgres_extension` | `sql` | existing `fft_approximate` |
| `w4h-sample-fitbit-csv` | `dataset` | `csv` | `w4h-sample-fitbit-csv` (ADR-016 sample) |
| `w4h-sample-fitbit-csv-importer` | `notebook` + `cli` | `python` | `w4h-sample-fitbit-csv-importer` (ADR-016: notebook to adapt; CLI for incremental/cron) |
| `w4h-load-json` | `notebook` | `python` | `w4h-load-json` |
| `w4h-sample-icde-demo-csv` | `dataset` | `csv` | `w4h-sample-icde-demo-csv` (ADR-016 sample; adds a `gps_track` geo signal) |
| `w4h-sample-icde-demo-csv-importer` | `notebook` + `cli` | `python` | `w4h-sample-icde-demo-csv-importer` (ADR-016: notebook to adapt; CLI for incremental/cron) |
| `w4h-sql-compute-mets` | `sql` (+ `notebook`, `cli`) | `sql` | `w4h-sql-compute-mets` ([ADR-023](ADR-023-sql-analytics-contributions.md): YAML + parameterized SQL via the API; notebook/CLI pick one dataset in a project). Distinct from the pandas `w4h-compute-mets` notebook/CLI ([ADR-019](ADR-019-mets-wear-compliance-analytics.md)). |

`w4h-notebooks` is an **index**, not the catalog source of truth and not a monorepo for new tools.

### 4. `fft_approximate` stays an external extension

Do **not** vendor `fft_approximate` into `w4h-api` / `schema.sql`. Install it on the institution’s PostgreSQL like any other extension. W4H only **lists** it. Usage notes live in that repo’s README (optional demo notebook there is documentation, not a second catalog product).

### 5. Docker convenience Jupyter (ADR-015)

The Compose `notebooks` service remains a **single-user convenience image**, not project notebook tracking. It preloads the CSV-load contribution (`w4h-sample-fitbit-csv-importer`). Researchers’ further notebooks stay outside the platform.

## Consequences

**Positive:** Product boundary is clear (data + ACL + catalog, not IDE/git hosting). Community tools have a publisher/repo/docs model. Approximate-query extension stays independently versioned.

**Negative:** Super admin must curate catalog rows. One-repo-per-tool means more GitHub repositories to maintain.

## Alternatives not chosen

- **Keep `project_notebooks`** — rejected; W4H is not in the business of managing people’s notebooks.
- **Fold `fft_approximate` into `w4h-api`** — rejected; it is a general Postgres extension.
- **`w4h-notebooks` monorepo as catalog SoT** — rejected; one repo per contribution.
- **Git-only `packages.json` as live catalog** — rejected for Super-admin CRUD; file may remain as a contribute hint until M9.

## Changelog

| Date | Change |
|------|--------|
| 2026-10-04 | Added first-party `w4h-hr-anomaly` row (`kinds: notebook, cli`, not `runnable`): the MVP M4 example model contribution. It reads the series API and writes a derived table; it is not an in-app Run importer. |
| 2026-09-21 | Catalog **version pin**: `version` + cached `latest_*` on `w4h.contributions`; Super admin Check for updates / pin a GitHub `v*` tag; in-app Run checks out the pin (dirty sibling checkouts left as-is). Not a versions table; git remains the history. |
| 2026-08-23 | **Fetch repo info** detects all catalog kinds from the repo (`.ipynb` → `notebook`, `[project.scripts]` → `cli`, `*.control` → `postgres_extension`, ADR-016 `signals` manifest → `dataset`, ADR-023 SQL manifest → `sql`). Kinds are additive (e.g. SQL job + notebook + CLI). |
| 2026-08-23 | `w4h-sql-compute-mets` catalog row: `kinds: sql, notebook, cli` (SQL job plus thin clients that pick one dataset in a project). |
| 2026-08-23 | Added `sql` kind for YAML-bound SQL jobs executed by the API ([ADR-023](ADR-023-sql-analytics-contributions.md)). `postgres_extension` remains `CREATE EXTENSION` only. Planned first-party row: `w4h-sql-compute-mets`. |
| 2026-08-21 | Added `dataset` kind (and `csv`/`json` language values) for ADR-016 sample-data repos, which were wrongly classified as `script`/`other`; fixed `w4h-sample-fitbit-csv` and cataloged the previously-missing `w4h-sample-icde-demo-csv` pair. |
| 2026-08-21 | Contributions admin page gets a **Fetch repo info** action (`POST /contributions/inspect`): given a repo URL, it auto-fills the catalog row from the README and, for sample-data repos, `manifest.yaml`, and runs a minimal manifest sanity check (required fields, unusual column types, `geomts_mapping.values[].source` not matching a column) shown as errors/warnings before save. Manual entry is unchanged and unblocked by validation. Scoped to Super-admin curation of first-party contributions — not a community self-publish validator (still M9). |
| 2026-08-16 | Docker convenience Jupyter preloads `w4h-sample-fitbit-csv-importer` (not a generic sample). |
| 2026-08-16 | Accepted. Numbered ADR-018 because ADR-016/017 were already assigned. |
| 2026-08-16 | CSV ingest listing uses ADR-016 names (`w4h-sample-fitbit-csv` + `-importer`), not `w4h-load-csv`. |
| 2026-08-16 | Catalog `kinds` may list notebook and CLI on the same importer repo. |

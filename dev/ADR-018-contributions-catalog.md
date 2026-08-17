---
title: "ADR-018 — Contributions catalog; no project notebook registry"
description: Platform catalog of contributed tools (publisher, repo, docs). W4H does not track researchers’ project notebooks.
updated_by: nocera@usc.edu
updated_at: 2026-08-16T00:00:00.000Z
---

**Status:** Accepted  
**Date:** 2026-08-16  
**Relates to:** ADR-006 (Flexible compute), ADR-007 (API keys), ADR-015 (Docker notebooks service), ADR-016 (paired sample/importer repos), ADR-017 (Samples sandbox)  
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
| `kind`, `kinds` | One or more of `notebook` \| `cli` \| `script` \| `postgres_extension`. Importers that ship a notebook and a CLI list both. `kind` is the primary (first) value. |
| `language` | `python` \| `r` \| `sql` \| `other` |
| `repo_url`, `repo_ref`, `docs_path` | Git location; default docs `README.md` |
| `status` | `draft` \| `published` \| `deprecated` |

**Who:** authenticated users **browse** published rows. **Super admin** creates/edits (MVP). Community self-publish is M9.

**Docs page:** the catalog detail view renders the linked repo README (public GitHub raw), or falls back to an external link. Contribution docs are **not** copied into `w4h-docs`. Help explains how to contribute; it is not a page per tool.

**Index of record** for the in-app catalog is `w4h.contributions`, not `registry/packages.json`. ADR-017’s **W4H Samples sandbox** (canonical demo ingest, personal API keys) is unchanged.

### 3. One git repo per contribution

Each catalog row points at **one** repository that does **one** job. First-party MVP listings:

| Slug | Kind | Language | Repo |
|---|---|---|---|
| `fft-approximate` | `postgres_extension` | `sql` | existing `fft_approximate` |
| `w4h-sample-fitbit-csv` | `script` | `other` | `w4h-sample-fitbit-csv` (ADR-016 sample) |
| `w4h-sample-fitbit-csv-importer` | `notebook` + `cli` | `python` | `w4h-sample-fitbit-csv-importer` (ADR-016: notebook to adapt; CLI for incremental/cron) |
| `w4h-load-json` | `notebook` | `python` | `w4h-load-json` |

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
| 2026-08-16 | Docker convenience Jupyter preloads `w4h-sample-fitbit-csv-importer` (not a generic sample). |
| 2026-08-16 | Accepted. Numbered ADR-018 because ADR-016/017 were already assigned. |
| 2026-08-16 | CSV ingest listing uses ADR-016 names (`w4h-sample-fitbit-csv` + `-importer`), not `w4h-load-csv`. |
| 2026-08-16 | Catalog `kinds` may list notebook and CLI on the same importer repo. |

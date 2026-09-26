---
title: "ADR-017 — Community package registry"
description: Samples sandbox for demo ingest; in-app catalog is Contributions (ADR-018).
updated_by: nocera@usc.edu
updated_at: 2026-08-16T00:00:00.000Z
---

**Status:** Draft  
**Date:** 2026-08-16  
**Relates to:** ADR-007 (API keys), ADR-012 (dataset linking/share), ADR-016 (paired sample/importer repos), ADR-003 (ingested tables), ADR-018 (contributions catalog)  
**References:**
- [guide/sample-packages.md](../guide/sample-packages.md) (contribute; not the catalog)
- [registry/packages.json](../registry/packages.json)
- MVP §6.2 / §6.4 (D-14, D-25–D-30)

---

## Context

Getting started was split across Help pages, project notebook links, and the ingested **Datasets** catalog. Listing each contributed sample in platform Help does not scale. Contributors ship **code and test data in git**; the app browses a curated index. **Project notebook tracking was removed** ([ADR-018](ADR-018-contributions-catalog.md)). The live in-app catalog is **`w4h.contributions`**, not `registry/packages.json`.

**Sample dataset git repos** are for testing and Super-admin seed. **Ingested datasets** (`w4h.datasets` + physical tables) are for research and in-platform analytics. If every onboard copies Fitbit CSV into their own team, the catalog fills with duplicate demos.

## Decision

### Surfaces

| Surface | Role |
|---|---|
| **Contributions** (app shell) | Curated marketplace: publisher, kind, language, git repo, README ([ADR-018](ADR-018-contributions-catalog.md)) |
| **Help** | How the platform works + how to **contribute**. Not a page per contribution |
| **Datasets** | Team-owned **ingested** catalogs (Mine / Others / Shared) |
| **Project workspace** | Members, linked datasets, project pages, tokens — **not** a notebook registry |

### Index of record

Live catalog: **`w4h.contributions`** (Super admin CRUD). README lives in the contribution git repo. `registry/packages.json` is legacy and is not the source of truth. No Help page per contribution. Community self-publish is M9.

Each contribution is **one git repo** (ADR-018). ADR-016 pairing (sample repo + importer repo) remains valid as two catalog rows, or one importer row that links the sample repo from its README.

### W4H Samples sandbox

Platform team **W4H Samples** (synthetic data only — never PHI) owns **one canonical ingested demo dataset** per curated sample.

- Auto-enroll every account as team `member` (not `team_admin`) and as **viewer** on a sandbox **project** that links those datasets.
- Canonical tables are seeded by **platform migrations / seed jobs** (`w4h_platform`, e.g. docs fixtures), not by the Super admin account calling `POST …/import/csv-batch`. Those datasets stay **`read_only`**; API ingest is denied for every role. Members must not create datasets on this team or run importer write paths against canonical tables.
- Members **re-run analysis** from contribution notebooks (query, plot, model) against already-loaded rows. W4H does not register those notebooks on the project.
- **Personal API keys** scoped via sandbox project membership (ADR-007). Do **not** share a single “sample team key” in multi-user deployments (audit and revocation). Docker compose may inject a key for a single local admin as a packaging convenience.

**Concurrency:** concurrent `SELECT`s are safe. Concurrent `replace`/`append` ingest is not (last-write-wins, duplicates). Sandbox notebooks must not `CREATE`/`INSERT` derived tables in the shared schema; derived output stays in the kernel or on the researcher’s own team.

Git sample repos remain the source for CI, local importer tests, and Super-admin seed. Write/ETL practice uses the user’s **own team** catalog.

### Credentials in package repos

Importer `.env` / environment only — never keys in git or notebook outputs (ADR-007, D-27).

## Consequences

**Positive:** Community packages stay next to their code; Help stays platform-shaped; one demo ingest per sample; workshop-scale re-runs share one copy.

**Negative:** Auto-enroll and Super-admin-only seed on the Samples team must be enforced in API/ACL, not only documented. Super admin must keep `w4h.contributions` current (ADR-018).

## Alternatives not chosen

- **Help page per package** — rejected (disconnected from repos).
- **Per-user ingest of samples** — rejected (catalog/storage noise).
- **Shared team API key** for the sandbox — rejected for multi-user (HIPAA unique user ID, audit).
- **Consolidated ingest DB catalog** — still premature (ADR-016).
- **In-app publish / ratings** — later.

## Changelog

| Date | Change |
|------|--------|
| 2026-08-16 | Initial draft. |
| 2026-08-16 | Live catalog moved to `w4h.contributions` (ADR-018); project notebooks dropped. |
| 2026-09-26 | Samples canonical load is platform seed + `read_only`; API ingest no longer grants Super admin a bypass on read-only or trial datasets. |

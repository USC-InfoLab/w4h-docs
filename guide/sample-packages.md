---
title: Contributions
description: Browse the in-app Contributions catalog; one git repo per tool (notebook, CLI, script, or Postgres extension).
card_title: Contributions
sort_order: 2
---

## Browse in the app

Curated tools live in **Contributions** (`{{APP_URL}}/contributions`) — a marketplace-style index (publisher, kind, language, git README), not a Help page per tool. See [ADR-018](../dev/ADR-018-contributions-catalog.md).

**Who does what**

- **Admins** link or create datasets on a project, then load tables by adapting a notebook or deploying a CLI from a Contributions example. Sample datasets on a demonstration project are read-only (Super admin seeds them). Loaded means tables and stats show on the overview.
- **Users** see the same overview, docs, analytics, and Jupyter tools. They run analysis against loaded tables. They cannot invite people or create/load team datasets.

Search for tasks such as “load CSV” or “approximate query”. Each listing points at **one git repo**. The README is rendered on the catalog detail page.

**W4H Samples sandbox:** you are a member of the Samples team. Super admin seeds canonical demo datasets. Use your **personal API key** and re-run contribution notebooks against that data. Do not re-ingest into the sandbox. Ingest into **your team’s** catalog when you need write/ETL practice ([ADR-017](../dev/ADR-017-community-package-registry.md)).

Paired vendor sample + importer repos ([ADR-016](../dev/ADR-016-paired-sample-importer-repos.md)) are listed as separate contributions (one repo each).

**Credentials:** API keys live in local `.env` only — never in git or notebook outputs.

MVP first-party listings: **w4h-sample-fitbit-csv**, **w4h-sample-fitbit-csv-importer**, **w4h-load-json**, and **fft_approximate** (external Postgres extension — install on your database; W4H does not vendor it).

**Planned (M3, ADR-019):** **w4h-fitbit-wear-compliance** (device wear-time reports) and **w4h-compute-mets** (MET derivation from calories + weight) — both notebook **and CLI**, so an Admin can run them on cron, not only interactively. The Fitbit sample will gain `heart_rate` and `calories` signals so these tools have demo data. Also planned: **w4h-demo-approximate-queries**, a notebook showing `fft_approximate` approximate range queries against the sample dataset. RA task breakdown: [dev/analytics-contributions.md](../dev/analytics-contributions.md).

## How to contribute

MVP curation is Super admin (Platform Admin → Contributions). Community self-publish is later (M9). Until then:

1. Create **one git repo** that does one job, with a README (publisher, language, how to run, no secrets).
2. Ask a Super admin to add a `w4h.contributions` row (`slug`, `publisher`, `kind` / `kinds`, `language`, `repo_url`, `docs_path`). Importers that ship a notebook and a CLI should list both kinds.
3. For vendor samples, follow ADR-016 naming (`w4h-sample-<vendor>-<format>` and a separate importer repo).

Project workspaces do **not** register your team’s analysis notebooks. Put repo links in **project documentation**.

---
title: Contributions
description: Browse the in-app Contributions catalog; one git repo per tool (notebook, CLI, script, SQL module, or Postgres extension).
card_title: Contributions
sort_order: 2
---

## Browse in the app

Curated tools live in **Contributions** (`{{APP_URL}}/contributions`) — a marketplace-style index (publisher, kind, language, git README), not a Help page per tool. See [ADR-018](../dev/ADR-018-contributions-catalog.md).

**Who does what**

- **Admins** link or create datasets on a project, then load tables. If the contribution is marked **runnable** and is an **importer**, select the dataset and click **Run import…** in the **Dataset overview** pane ([ADR-022](../dev/ADR-022-in-app-contribution-run-trigger.md)). **Runnable SQL jobs** (e.g. **w4h-sql-compute-mets**) use **Run analysis…** on the project **Analytics** tab — same `POST /contributions/:slug/run` with `{ dataset_id }` ([ADR-023](../dev/ADR-023-sql-analytics-contributions.md)). Otherwise, load tables by adapting a notebook or deploying a CLI. Sample datasets on a demonstration project are read-only (Super admin seeds them). Loaded means tables and stats show on the overview.
- **Users** see the same overview, docs, analytics, and Jupyter tools. They run analysis against loaded tables. They cannot invite people or create/load team datasets.

Search for tasks such as “load CSV” or “approximate query”. Each listing points at **one git repo**. The README is rendered on the catalog detail page.

**W4H Samples sandbox:** you are a member of the Samples team. Super admin seeds canonical demo datasets. Use your **personal API key** and re-run contribution notebooks against that data. Do not re-ingest into the sandbox. Ingest into **your team’s** catalog when you need write/ETL practice ([ADR-017](../dev/ADR-017-community-package-registry.md)).

Paired vendor sample + importer repos ([ADR-016](../dev/ADR-016-paired-sample-importer-repos.md)) are listed as separate contributions (one repo each). Two first-party pairs ship today — they differ on whether they carry a geo signal:

| Pair | Geo signal? | In-app **Run import…** |
|---|---|---|
| **w4h-sample-fitbit-csv** + importer | No — `geo: null` on every signal | Yes ([ADR-022](../dev/ADR-022-in-app-contribution-run-trigger.md)) |
| **w4h-sample-icde-demo-csv** + importer | Yes — `gps_track` (lat/lon, WGS84) | Yes ([ADR-022](../dev/ADR-022-in-app-contribution-run-trigger.md)) |

The ICDE demo pair is trimmed synthetic data from the ICDE 2024 prototype (`w4h-icde-demo`); it exercises the geo branch of GeoMTS mapping ([ADR-008](../dev/ADR-008-geomts-data-model.md)).

**Your own files (planned):** a PI loads data **into their project** with **Import files…**. That stays on the owning team: not shared, not Discoverable, not a Contribution, not Samples. Download the importer zip to edit or cron locally. **Submit to Super admin** is a later choice: importer package plus a synthetic/de-identified **sample** data package (not the live trial tables). Share to another research team remains a separate control ([ADR-012](../dev/ADR-012-project-dataset-linking.md)). See [ADR-024](../dev/ADR-024-ingest-assistant.md).

**Credentials:** API keys live in local `.env` only — never in git or notebook outputs.

MVP first-party listings also include **w4h-load-json** and **fft_approximate** (external Postgres extension — install on your database; W4H does not vendor it).

**Planned (M3, ADR-019):** **w4h-fitbit-wear-compliance** (device wear-time reports) and **w4h-compute-mets** (MET derivation from calories + weight) — both notebook **and CLI**, so an Admin can run them on cron, not only interactively. The Fitbit sample already includes `heart_rate` and `calories` so these tools have demo data. Also planned: **w4h-demo-approximate-queries**, a notebook showing `fft_approximate` approximate range queries against the sample dataset.

**SQL analysis (ADR-023):** **w4h-sql-compute-mets** (`kinds: sql, notebook, cli`, **runnable** in-app) — YAML `requires`/`produces` by GeoMTS role. **In-app:** Analytics tab → **Run analysis…** → `POST /contributions/w4h-sql-compute-mets/run { dataset_id }`. **Notebooks:** direct sync execute via `POST /datasets/:id/contributions/w4h-sql-compute-mets/sql` (empty body; manifest `run.materialize: true`). Optional inspect: `GET /datasets/:id/signals`. **`fft_approximate`** remains `kind: postgres_extension` — install on Postgres, demo notebook only; not a per-dataset app run. RA task breakdown: [dev/analytics-contributions.md](../dev/analytics-contributions.md).

## How to contribute

MVP curation is Super admin ([Platform Admin → Contributions](/admin/contributions)). Community self-publish is later (M9) — the flow below is for admin-curated, first-party contributions. Until then:

1. Create **one git repo** that does one job, with a README (publisher, language, how to run, no secrets).
2. Ask a Super admin to add a `w4h.contributions` row. On the Contributions admin page, paste the repo URL and click **Fetch repo info** to auto-fill `slug`, `publisher`, `title`, `summary`, `kind` / `kinds`, and `language` from the README, `manifest.yaml`, and detected files — `.ipynb` → `notebook`, `[project.scripts]` in `pyproject.toml` → `cli`, Postgres `*.control` → `postgres_extension`, ADR-016 sample `signals` → `dataset`, ADR-023 SQL job manifest → `sql`. Kinds stack when a repo ships more than one (importers: notebook + CLI; SQL jobs may also include notebook + CLI). The form also flags manifest sanity-check errors/warnings (missing columns, a `geomts_mapping` value with no matching column, etc.) before saving. Manual entry of all fields still works if you skip this step. SQL analytics jobs ([ADR-023](../dev/ADR-023-sql-analytics-contributions.md)) use `kind: sql` (YAML + SQL via the API), not `postgres_extension`.
3. For vendor samples, follow ADR-016 naming (`w4h-sample-<vendor>-<format>` and a separate importer repo).

**Dataset vs. importer — which do I catalog first?** No order is enforced — the two rows are independent. But publish the **sample-data repo first** (or make sure it's public before anyone runs the importer): the in-app **Run import…** flow ([ADR-022](../dev/ADR-022-in-app-contribution-run-trigger.md)) resolves the paired data repo automatically by the ADR-016 naming convention and fails to clone it if it isn't there yet.

The manifest sanity check covers admin-curated first-party contributions only — it isn't a community self-publish validator (that's M9, future work).

Project workspaces do **not** register your team’s analysis notebooks. Put repo links in **project documentation**.

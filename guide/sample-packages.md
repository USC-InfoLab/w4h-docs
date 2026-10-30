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

**W4H Samples sandbox:** you are a member of the Samples team. Platform seed jobs load canonical demo datasets (`read_only`). Use your **personal API key** and re-run contribution notebooks against that data. Do not re-ingest into the sandbox. Ingest into **your team’s** catalog when you need write/ETL practice ([ADR-017](../dev/ADR-017-community-package-registry.md)).

Paired vendor sample + importer repos ([ADR-016](../dev/ADR-016-paired-sample-importer-repos.md)) are listed as separate contributions (one repo each). Two first-party pairs ship today — they differ on whether they carry a geo signal:

| Pair | Geo signal? | In-app **Run import…** |
|---|---|---|
| **w4h-sample-fitbit-csv** + importer | No — `geo: null` on every signal | Yes ([ADR-022](../dev/ADR-022-in-app-contribution-run-trigger.md)) |
| **w4h-sample-icde-demo-csv** + importer | Yes — `gps_track` (lat/lon, WGS84) | Yes ([ADR-022](../dev/ADR-022-in-app-contribution-run-trigger.md)) |

The ICDE demo pair is trimmed synthetic data from the ICDE 2024 prototype (`w4h-icde-demo`); it exercises the geo branch of GeoMTS mapping ([ADR-008](../dev/ADR-008-geomts-data-model.md)).

**File importers** (your export files, not bundled sample repos) — one repo each; synthetic fixtures for tests and in-app Run ([ADR-016](../dev/ADR-016-paired-sample-importer-repos.md)):

| Contribution | Devices | In-app **Run import…** (when `runnable`) |
|---|---|---|
| **w4h-fitbit-csv-file-importer** | Fitbit CSV export | Yes |
| **w4h-glucose-monitor-csv-file-importer** | Dexcom Clarity, FreeStyle LibreLink | Yes (after catalog + staging) |
| **w4h-data-recorder-csv-file-importer** | Empatica E4 (Connect ZIP, merged/per-signal research CSV) | Yes (after catalog + staging) |

Use **one project** and **one or two linked catalog datasets** as Team Admin; each run uses a different importer/`table_prefix` (`glucose_*`, `recorder_*`, …) so tables do not collide in the same dataset schema.

**Your own files (planned):** a PI loads data **into their project** with **Import files…**. That stays on the owning team: not shared, not Discoverable, not a Contribution, not Samples. Download the importer zip to edit or cron locally. **Submit to Super admin** is a later choice: importer package plus a synthetic/de-identified **sample** data package (not the live trial tables). Share to another research team remains a separate control ([ADR-012](../dev/ADR-012-project-dataset-linking.md)). See [ADR-024](../dev/ADR-024-ingest-assistant.md).

**Credentials:** API keys live in local `.env` only — never in git or notebook outputs.

MVP first-party listings also include **w4h-load-json** and **fft_approximate** (external Postgres extension — install on your database; W4H does not vendor it).

**Planned (M3, ADR-019):** **w4h-fitbit-wear-compliance** (device wear-time reports) and **w4h-compute-mets** (MET derivation from calories + weight) — both notebook **and CLI**, so an Admin can run them on cron, not only interactively. The Fitbit sample already includes `heart_rate` and `calories` so these tools have demo data. Also planned: **w4h-demo-approximate-queries**, a notebook showing `fft_approximate` approximate range queries against the sample dataset.

**SQL analysis (ADR-023):** **w4h-sql-compute-mets** (`kinds: sql, notebook, cli`, **runnable** in-app) — YAML `requires`/`produces` by GeoMTS role. **In-app:** Analytics tab → **Run analysis…** → `POST /contributions/w4h-sql-compute-mets/run { dataset_id }`. **Notebooks:** direct sync execute via `POST /datasets/:id/contributions/w4h-sql-compute-mets/sql` (empty body; manifest `run.materialize: true`). Optional inspect: `GET /datasets/:id/signals`. **`fft_approximate`** remains `kind: postgres_extension` — install on Postgres, demo notebook only; not a per-dataset app run. RA task breakdown: [dev/analytics-contributions.md](../dev/analytics-contributions.md).

## How to contribute

Write the module, ship tests, try it locally (or on a **staging** deployment — not production), then send the git URL to the W4H team: **[Contribute a module](contribute-a-module.md)**. Super admin **publishes** the listing in production ([Platform Admin → Contributions](/admin/contributions)). They do not vet the module in Platform Admin. There is no in-app submit.

Until then, Super admin adds the `w4h.contributions` row (paste the repo URL → **Fetch repo info**, or enter fields by hand) and pins a GitHub **`v*` tag** when one exists (**Check for updates** on Platform Admin → Contributions). For vendor **sample data** packages, use `w4h-sample-<vendor>-<format>` plus a separate importer repo.

**Dataset vs. importer — which do I catalog first?** No order is enforced. Publish the **sample-data repo first** if the importer’s `contribution.yaml` live sample points at it — in-app **Run import…** clones that sibling when the yaml (or the `<sample>-importer` naming) says so.

Project workspaces do **not** register your team’s analysis notebooks. Put repo links in **project documentation**.

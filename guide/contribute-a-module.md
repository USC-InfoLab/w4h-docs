---
title: Contribute a module
description: Required tests, contribution.yaml, and how to try a new ingest module on the local platform.
card_title: Contribute a module
sort_order: 3
---

Ship **one git repo** that does one job. The repo must include tests and a `contribution.yaml` so anyone can vet it the same way. Worked example: **w4h-fitbit-csv-file-importer**. The same layout is used by **w4h-glucose-monitor-csv-file-importer** (Dexcom Clarity and FreeStyle Libre) and **w4h-data-recorder-csv-file-importer** (Empatica E4). Those two cite Kaggle column layouts and keep only synthetic rows in `tests/fixtures/`.

Use the **local app** (`npm run dev` in w4h-api + w4h-app). Do not use Docker for this, and do not ingest into W4H Samples.

## Required in the repo

| Thing | Role |
|-------|------|
| `contribution.yaml` | Test contract + live sample + input defaults (core-team + staging checklist) |
| `run.sh` | In-app **Run import…** and CLI entry |
| `tests/` | Automated tests must pass with **no API** |
| **`README.md`** | **User-facing docs** once the row is published (see below) |
| Tiny fixtures **or** a pointer to an existing W4H sample repo | Live sample files |

Do not copy a full Kaggle dump or production CSVs into the module. Strip a few rows into `tests/fixtures/`, or point `tests.live.sample` at a sibling sample package (`w4h-sample-fitbit-csv` or `w4h-sample-icde-demo-csv`).

When Super admin should pick up a new build, cut a **`vMAJOR.MINOR.PATCH` git tag** (GitHub Release preferred) and bump `pyproject.toml` `version` when the repo has one. Sample-data packages tag the repo even without Python. The catalog stores one pin, not a version history.

## `contribution.yaml`

Two test lanes:

1. **Automated** — `pytest` against in-repo fixtures. No network.
2. **Live** — `./run.sh import` / in-app Run. Prefers sibling sample files; falls back to the same fixtures if that repo is not checked out.

`inputs` is the form contract. Today in-app Run injects `dataset_id` as `W4H_DATASET_ID`. Optional files: `--data-dir` or the notebook chooser. Other fields are defaults testers can override.

See `contribution.yaml` in the sibling **w4h-fitbit-csv-file-importer** repo.

## What users see in the app

W4H does **not** duplicate importer docs in platform Help. After Super admin publishes the catalog row:

1. **Contributions list** (`/contributions`) — **title** and **summary** from the row (Super admin saves these after **Fetch repo info** on Platform Admin → Contributions, or edits them by hand).
2. **Detail page** (`/contributions/<slug>`) — the API fetches **`README.md`** from the public GitHub repo (path `docs_path`, default `README.md`), renders it as HTML, and shows **Open README on GitHub**. Authors should put setup, device/export notes, CLI examples, and “who should run this” in that README.
3. **Run import…** — no extra doc pane; the dialog links to the contribution and runs `run.sh` using the signed-in **Admin’s** API key.

`contribution.yaml` is for **tests and staging** (`pytest`, `./run.sh import`, in-app Run sample wiring). It is not shown to end users unless you mirror key points in the README.

## Optional: how results are drawn (`display`)

A SQL contribution (`kind: sql`) can add a `display:` block to its manifest to say which chart suits its output (`line`, `bar`, `box`, `heatmap`, `scatter`, `events`, `table`, with `x`, `y`, `group`). The app draws it from its own chart set; contributions never ship UI code. For anything the chart set cannot express, publish an interactive HTML **report** instead. See [Charts and Reports](charts-and-reports.md).

## Automated test (required)

From the module repo:

```bash
pytest tests/ -q -m "not integration"
```

This must pass before anyone catalogs the row. The file importer’s `tests/test_manifest_files.py` is a copy-this-as-a-template check that mapping matches CSV headers.

## Live test (not production)

Never vet a new module on the **production** catalog or against production datasets.

1. **Author** — laptop / local `npm run dev`. Empty dataset on *your* team. `pytest`, then:

   ```bash
   export W4H_API_KEY=... W4H_API_BASE=http://localhost:2026 W4H_DATASET_ID=your-dataset-id
   ./run.sh import
   ```

   To click **Run import…** locally, add a catalog row on **that** local database (slug = folder name next to `w4h-api`). That is your machine, not W4H production.

2. **W4H review** — a **dedicated staging (dev) deployment**: same app, separate Postgres, synthetic data only. Reviewers log in as **Admin** (not Super admin), add a throwaway dataset, and run the module the way a PI would. Super admin’s job is the platform, not clicking through importer tests.

**Who sees `draft`?** In the product today: **only Super admin**, and only on the Contributions admin page — not in **Run import…**. That is the wrong audience for testing. Treat **draft as staging-only** (or skip it): testers on staging are Admins looking at a listing that is already `published` *on staging*. Production should get a row only after staging passed, as **published** there. Do not park unvetted modules as drafts on production.

## Submit to the W4H team

There is no in-app “submit” button. Send the git URL (issue, PR, or email) once local tests passed. The team tries it on **staging**, not production.

## What Super admin does (production)

After staging said yes. Platform Admin → **Contributions** is a **listing** control, not a QA lab.

1. Paste the repo URL → **Fetch repo info** → save as **published** (production users can browse `/contributions`). Pin a GitHub **`vMAJOR.MINOR.PATCH` tag** when the repo has one; **Check for updates** later to promote a newer tag. Do not leave published runnable rows on `main`.
2. Optionally mark **runnable** so Admins get **Run import…** / **Run analysis…**. That flag is not a checkbox in the admin form yet; the platform team sets it in the database after staging proved `run.sh`.
3. If it must come out: **deprecated** or delete the row. The git repo stays the author’s.

Super admin does **not** ingest into a PI’s project and does **not** re-run the author’s pytest as their day job.

Browse listings: [Contributions](sample-packages.md).

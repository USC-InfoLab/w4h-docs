---
title: Contribute a module
description: Required tests, contribution.yaml, and how to try a new ingest module on the local platform.
card_title: Contribute a module
sort_order: 3
---

Ship **one git repo** that does one job. The repo must include tests and a `contribution.yaml` so anyone can vet it the same way. Worked example: **w4h-fitbit-csv-file-importer**.

Use the **local app** (`npm run dev` in w4h-api + w4h-app). Do not use Docker for this, and do not ingest into W4H Samples.

## Required in the repo

| Thing | Role |
|-------|------|
| `contribution.yaml` | Test contract + live sample + input defaults |
| `run.sh` | In-app **Run import…** and CLI entry |
| `tests/` | Automated tests must pass with **no API** |
| Tiny fixtures **or** a pointer to an existing W4H sample repo | Live sample files |

Do not copy a full Kaggle dump or production CSVs into the module. Strip a few rows into `tests/fixtures/`, or point `tests.live.sample` at a sibling sample package (`w4h-sample-fitbit-csv` or `w4h-sample-icde-demo-csv`).

## `contribution.yaml`

Two test lanes:

1. **Automated** — `pytest` against in-repo fixtures. No network.
2. **Live** — `./run.sh import` / in-app Run. Prefers sibling sample files; falls back to the same fixtures if that repo is not checked out.

`inputs` is the form contract. Today in-app Run injects `dataset_id` as `W4H_DATASET_ID`. Optional files: `--data-dir` or the notebook chooser. Other fields are defaults testers can override.

See `contribution.yaml` in the sibling **w4h-fitbit-csv-file-importer** repo.

## Automated test (required)

From the module repo:

```bash
pytest tests/ -q -m "not integration"
```

This must pass before anyone catalogs the row. The file importer’s `tests/test_manifest_files.py` is a copy-this-as-a-template check that mapping matches CSV headers.

## Live test (local platform)

1. Clone the module **next to** `w4h-api`. Folder name = catalog **slug**.
2. Start **w4h-api** and **w4h-app**.
3. Super admin → **Contributions** → add the row (`slug` = folder name, **runnable** on).
4. As Team admin, create an **empty dataset** on *your* project (not Samples).
5. Dataset overview → **Run import…** → pick the module.

Or the same entrypoint without the UI:

```bash
export W4H_API_KEY=... W4H_API_BASE=http://localhost:2026 W4H_DATASET_ID=your-dataset-id
./run.sh import
```

Success: tables and stats show on that dataset. Throw the dataset away and re-run as needed. That is the scratch target — not a second environment.

## Catalog

After automated + live tests pass, Super admin publishes the catalog row. Keep `runnable` off until a live run on a writable team dataset has succeeded.

Browse listings: [Contributions](sample-packages.md).

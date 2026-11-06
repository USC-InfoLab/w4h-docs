---
title: Docker Deployment
description: Run W4H standalone (non-Spark) with Docker Compose. app, api, and a preconfigured sample notebook, against your own external PostgreSQL.
card_title: Docker Deployment
is_feature_card: false
sort_order: 1
updated_by: limbasiabb@gmail.com
updated_at: 2026-08-21T00:00:00.000Z
---

## Overview

This guide covers the standalone (non-Spark) Docker deployment of the W4H Toolkit. It runs the app, the api, and a preconfigured sample notebook against your own external PostgreSQL instance. See [ADR-015](../dev/ADR-015-docker-deployment-packaging.md) for the packaging decisions behind this setup.

<div class="alert alert-info">
  <strong>Status:</strong> Prototype in <code>w4h-docker</code> — build from sibling repos or use published images when Dep-04 lands.
</div>

---

## What you get

| Service | What it does | Reachable at |
|---|---|---|
| `app` | Web UI | The port you publish in `.env` |
| `api` | Data API, auth, docs, audit log | Internal only, via `app` |
| `notebooks` | Convenience Jupyter preloaded with the **w4h-sample-fitbit-csv-importer**, **w4h-fitbit-wear-compliance**, and **w4h-compute-mets** contributions | `127.0.0.1` by default, token-protected |

There is no database service. PostgreSQL is external, matching Flexible mode (see [ADR-006](../dev/ADR-006-trusted-research-environment.md)).

---

## Prerequisites

- Docker and Docker Compose
- A reachable PostgreSQL instance, with credentials that can create schemas and tables
- (Optional) the [`fft_approximate`](https://github.com/USC-InfoLab/fft_approximate) extension on that Postgres instance, if you plan to use approximate range queries. Install it on the database host (Linux, macOS, or Windows); see that repository's README. It is not part of this Docker stack.

---

## 1. Get the deployment files

Clone the `w4h-docker` repository alongside `w4h-api`, `w4h-app`, `w4h-docs`, `w4h-sample-fitbit-csv`, `w4h-sample-fitbit-csv-importer`, `w4h-fitbit-wear-compliance`, and `w4h-compute-mets`, or use a published compose file when registry images are available. The `notebooks` image bakes in each of the Contribution repos above at build time (see [Contribution notebooks](#contribution-notebooks-baked-into-notebooks) below) — a checkout missing any of them will fail at `docker compose build`, not at runtime.

---

## 2. Start the stack

```bash
cd w4h-docker
docker compose build
docker compose up -d
```

No database credentials are required before startup. Optional: copy `.env.example` → `.env` to change `APP_PORT` or public URLs.

---

## 3. Connect PostgreSQL (web UI)

Open the app at **`http://127.0.0.1:5180`** (default). Avoid `localhost:5173` if another dev server uses that port on your machine.

Enter your external PostgreSQL host, port, database name, user, and password. The API tests the connection, creates the `w4h` schema if needed, imports platform docs, and saves settings to a persisted file on the host (`w4h-docker/data/.env`).

If PostgreSQL runs on the same machine as Docker (not in a container), use **`host.docker.internal`** as the host — not `localhost`.

`TOKEN_SECRET` is generated automatically on first successful database setup.

Optional compose `.env` overrides:

| Variable | Purpose |
|---|---|
| `APP_PORT` | Host port for the web UI (default `5180`) |
| `APP_URL`, `API_PUBLIC_URL` | Public URLs for invites and docs placeholders |
| `SMTP_*` | Outbound email (or configure later in Platform Admin → Settings). Also required for **Request access** — the form verifies each USC address by email |
| `ACCESS_REQUEST_ALLOWED_DOMAINS` | Email domains allowed to request access (comma-separated, exact match; default `usc.edu`) |
| `REPORT_MAX_BYTES` | Largest published notebook report (default 8 MB) |
| `W4H_API_KEY` | Personal API key for the preloaded notebooks (after Step 5) |
| `W4H_DATASET_ID` | Catalog dataset id the importer and Contribution notebooks target (default `sample-fitbit-csv`) |
| `W4H_PROJECT_ID`, `W4H_DAILY_WEAR_PCT`, `W4H_OVERALL_WEAR_PCT`, `W4H_WEAR_WINDOWS` | Wear-compliance protocol settings (see [Contribution notebooks](#contribution-notebooks-baked-into-notebooks)) |
| `W4H_DEFAULT_WEIGHT_KG` | Fallback weight for METs computation when a subject has no logged weight nearby (default `70`) |
| `VITE_JUPYTER_URL` | URL baked into the app for **Managed JupyterLab** (default `http://127.0.0.1:8888`) |

You do not set `W4H_API_KEY` before first login. Generate it from the UI after setup (Step 5).

<div class="alert alert-warning">
  <strong>Do not commit <code>w4h-docker/data/.env</code>.</strong> It holds database credentials after UI setup.
</div>

---

## 4. Create the Super admin

After the database connects, the UI prompts for the initial Super admin account. See [Quick Start](../quick-start.md) for the full first-login flow.

On every later `api` restart (once configured), the service waits for Postgres, ensures schema, and re-imports docs from the image.

---

## 5. Generate your personal API key

Log in, then go to **Profile → API keys → Generate new key**. Copy the key immediately, it is shown once. See [ADR-007](../dev/ADR-007-authentication-model.md) for how this key is scoped and secured.

---

## 6. Run the sample notebook

The `notebooks` service starts with the stack. It preloads the **w4h-sample-fitbit-csv-importer** contribution (same listing as in-app **Contributions**).

1. Find the Jupyter URL and token in the `notebooks` service logs:

   ```bash
   docker compose logs notebooks
   ```

2. Open `import_fitbit_csv.ipynb` at that URL (append the `token` query parameter from the logs). Its first cell is a short Markdown setup checklist (copy `.env.example`, set `W4H_API_KEY` and `W4H_DATASET_ID`); the code cells further down are what actually read those values from the environment — the key is never pasted into or stored in the notebook file.
3. Set `W4H_API_KEY` in compose `.env` and `docker compose restart notebooks`. Create the target dataset in the UI first (default id `sample-fitbit-csv`, overridable with `W4H_DATASET_ID`).
4. Run the notebook to ingest via the API. Do not hardcode the key in a cell.

The project workspace **Managed JupyterLab** link uses `VITE_JUPYTER_URL` (default `http://127.0.0.1:8888`). You still need the token from the logs to authenticate.

Further notebooks you add are yours. W4H does not version or track project notebook content ([ADR-018](../dev/ADR-018-contributions-catalog.md)). This Compose service is not managed JupyterHub (TRE, [ADR-006](../dev/ADR-006-trusted-research-environment.md)).

---

## Contribution notebooks baked into `notebooks`

Besides the Fitbit CSV importer, the `notebooks` image bakes in each first-party analytics Contribution as it ships, using the same `additional_contexts` pattern (build-time `pip install` of the Contribution's package, its notebook copied into `/home/jovyan/work`). This keeps the container's toolset growing without adding services, per [ADR-018](../dev/ADR-018-contributions-catalog.md) (general Contributions-catalog model) and [ADR-019](../dev/ADR-019-mets-wear-compliance-analytics.md) (specifically names `w4h-fitbit-wear-compliance` and `w4h-compute-mets` as first-party Contributions).

<div class="alert alert-warning">
  <strong>This container is single-user, not multi-tenant.</strong> The <code>W4H_API_KEY</code> injected into it is <em>your personal credential</em> (<a href="../dev/ADR-007-authentication-model.md">ADR-007</a>), and the token that gates the Jupyter URL is the only access control in front of it. If you share the URL or token with another person, they can see and run everything under your key, including any subject-level data any notebook has queried — do not share the URL/token, and do not point more than one researcher at the same running container. This matches <a href="../dev/ADR-015-docker-deployment-packaging.md">ADR-015</a>'s "single container, one researcher" scoped reading of Flexible mode; genuinely multi-user notebook access is a TRE-mode (<a href="../dev/ADR-006-trusted-research-environment.md">ADR-006</a>) concern, not something this container provides.
</div>

| Notebook | Contribution | Status |
|---|---|---|
| `import_fitbit_csv.ipynb` | `w4h-sample-fitbit-csv-importer` | Baked in |
| `wear_compliance.ipynb` | `w4h-fitbit-wear-compliance` | Baked in |
| `compute_mets.ipynb` | `w4h-compute-mets` | Baked in |

`w4h-demo-approximate-queries` is **not** baked into this image — it's notebook-only and illustrative rather than operational, and needs a live Postgres with `fft_approximate` installed (see the section below), which this convenience container doesn't provide. Run it standalone; see its own README.

### Running `wear_compliance.ipynb`

1. Import Fitbit sample data first (importer notebook, above) — `wear_compliance.ipynb` needs `subjects` and `heart_rate` signals in your dataset.
2. Set the same env vars used for the importer (`W4H_API_KEY`, `W4H_DATASET_ID`) plus, if you use non-default wear-compliance protocol settings: `W4H_PROJECT_ID`, `W4H_DAILY_WEAR_PCT`, `W4H_OVERALL_WEAR_PCT`, `W4H_WEAR_WINDOWS` (see `.env.example`). Restart `notebooks` after changing any of these.
3. Run the notebook. It writes `wear_compliance.csv` and `wear_compliance_daily.csv` via `pip`'s installed package path (currently resolves under the image's `site-packages/out/`, not `/home/jovyan/work` — a known path oddity in the upstream notebook's default `output_path()`, not something fixed here; set `W4H_OUTPUT_PATH` explicitly if you want the files somewhere you'll actually browse to in Jupyter Lab's file panel).

### Running `compute_mets.ipynb`

1. Import Fitbit sample data first — needs `weight` and `calories` signals in your dataset (the same importer notebook covers both).
2. Set `W4H_API_KEY`, `W4H_DATASET_ID`; optionally `W4H_DEFAULT_WEIGHT_KG` (default `70`) as a fallback when a subject has no logged weight near a given calories timestamp.
3. Run the notebook. It computes a MET (metabolic equivalent) time series per subject from calories and weight — see the repo's README for the formula and its interval-calibration assumption before trusting the numbers for anything beyond a demo; this is explicitly **not medical advice**.

### Importing sample data: what to expect

The importer CLI now prints per-chunk progress (`heart_rate: chunk 12/332 (6000/165589 rows, ...)`) so a running import no longer looks like a hang. Throughput was also improved server-side — `w4h-api` now batches each chunk into a single multi-row insert instead of one round trip per row, roughly **29x faster** on measured benchmarks. A full import of the bundled sample data (`calories.csv` alone is ~1.2M rows) is still not instantaneous, but it now completes in minutes rather than the multi-hour runs earlier prototypes hit. If you only need `wear_compliance.ipynb` or `compute_mets.ipynb` working, you don't need to wait for a full import — a partial import (stop the CLI early, or pass a smaller CSV via `--file`) covering a few subjects is enough to exercise either notebook end to end.

---

## Optional: approximate-query extension (fft_approximate)

[`fft_approximate`](https://github.com/USC-InfoLab/fft_approximate) is a PostgreSQL C extension for approximate FFT range-aggregate queries over time series. It installs on **your Postgres server** — Postgres is external to `w4h-docker` (see [ADR-015](../dev/ADR-015-docker-deployment-packaging.md)), so this is not part of the Docker stack and there is nothing to build or run in a container for it.

This is a prerequisite for the `w4h-demo-approximate-queries` notebook (a separate, standalone Contribution — see [Contribution notebooks](#contribution-notebooks-baked-into-notebooks) above) — install it ahead of that notebook, not as part of the base setup above.

0. **Clone the extension's own repository** and run every command below from inside that checkout — `make` reads its `Makefile` relative to the current directory, so running it from `w4h-docker` or any other checkout will fail with "no targets specified and no makefile found":

   ```bash
   git clone https://github.com/USC-InfoLab/fft_approximate.git
   cd fft_approximate
   ```

1. **Set `PG_CONFIG`** for your platform (must match your running server's major version):

   | Platform | Command |
   |---|---|
   | Ubuntu / Debian | `export PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config` (match your running server's major version) |
   | macOS — Postgres.app | `export PG_CONFIG=/Applications/Postgres.app/Contents/Versions/latest/bin/pg_config` |
   | macOS — postgresql.org / EDB | `export PG_CONFIG=/Library/PostgreSQL/17/bin/pg_config` |
   | macOS — Homebrew | `export PG_CONFIG="$(brew --prefix postgresql@17)/bin/pg_config"` |
   | Windows — EDB installer | `set "PGROOT=C:\Program Files\PostgreSQL\17"` (see the extension's README for the `nmake` flow) |
   | RDS / Aurora / Cloud SQL | **Not supported** — these hosts don't allow installing a custom C library |

2. **Build and install** (needs write access to `pg_config --pkglibdir`, `sudo` if not writable):

   ```bash
   make
   sudo make PG_CONFIG=$PG_CONFIG install
   ```

3. **Create the extension** against your external Postgres. This extension isn't marked `trusted` in its control file, so `CREATE EXTENSION` requires **Postgres superuser** privilege on the target database — an ordinary application/deployment role will get a permission error. Ask your database administrator to run this step, or use a superuser connection for this one command only:

   ```bash
   psql "postgresql://<superuser>@127.0.0.1:5432/mydb" -c 'CREATE EXTENSION fft_approximate;'
   ```

   Avoid putting a password directly in the connection string on a shared or logged shell — `psql` will prompt for one interactively if you omit it from the URI (`postgresql://<superuser>@127.0.0.1:5432/mydb`), or use a `~/.pgpass` entry. This deployment handles clinical data; don't leave database credentials sitting in shell history.

Platform gotchas worth knowing before you hit them:
- **Ubuntu/AppArmor:** some setups restrict which paths the Postgres process may load extensions from — if `CREATE EXTENSION` fails to load a `.so` that installed without error, check `sudo aa-status` and `/etc/apparmor.d/*postgresql*`.
- **RHEL/Fedora/SELinux:** a `.so` copied via plain `cp` can get the wrong security context; `restorecon` it if `CREATE EXTENSION` reports "could not load library" despite correct file permissions.
- **macOS Postgres.app:** grant it App Management access in Privacy & Security settings before installing, or `make install` silently falls back to a user-local path that needs `make load` instead of a plain `CREATE EXTENSION`.

Install this before running the `w4h-demo-approximate-queries` notebook against your database. Full details, including Windows `nmake` steps, live in the [fft_approximate README](https://github.com/USC-InfoLab/fft_approximate) — this section is a pointer plus the gotchas people actually hit, not a full copy.

---

## Docs staying up to date

The docs you see in the app are imported into Postgres from this repository at container start, every time, not only on first setup. If you pull an updated image and restart, the docs table is resynced automatically. You will not see outdated docs after an update.

---

## Security considerations

- Your personal API key is scoped to your project memberships, has a configurable expiry, and is revoked immediately if your account is discontinued (ADR-007).
- Never paste your API key into a cell that gets saved with output enabled, or hardcode it in a notebook. Use an environment variable.
- The same applies to any cell that displays subject-level rows (e.g. a `display(df.head())` call in the wear-compliance or METs notebooks) — clear outputs before committing a notebook, or use a tool like `nbstripout` as a pre-commit hook if you plan to version your own copies.
- The `notebooks` service keeps Jupyter's token authentication on and binds to `127.0.0.1` by default. See the single-user warning under [Contribution notebooks](#contribution-notebooks-baked-into-notebooks) above — token-gating protects the port, not the data once someone has the token.
- This deployment handles clinical data. Review [HIPAA Compliance](hipaa-compliance.md) before going into production use.

---

## Troubleshooting

**`api` keeps restarting / never becomes healthy**

Usually a startup failure after database was configured — check `docker compose logs api` and Postgres reachability from the container.

**Cannot connect to Postgres during setup wizard**

Use `host.docker.internal` when Postgres is on the Docker host. Verify firewall and `pg_hba.conf`.

**Docs look outdated after pulling a new image**

Restart the stack. Docs import runs automatically on every start.

**Mermaid diagrams do not render in the docs**

This should work out of the box. If it does not, check the `api` service logs for a Playwright/Chromium error.

---

## Out of scope

- **Spark-enabled deployment** (Dep-02 / M6). This guide covers the standalone, non-Spark deployment only.
- **TRE mode.** Not part of this deployment. See ADR-006.
- **Notebook versioning.** Managed by you or your team, outside the platform.
- **Installing `fft_approximate` inside the stack.** It lives on your Postgres host; see [Optional: approximate-query extension](#optional-approximate-query-extension-fft_approximate).

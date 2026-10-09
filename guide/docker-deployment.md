---
title: Docker Deployment
description: Run W4H standalone (non-Spark) with Docker Compose. app, api, and a preconfigured sample notebook, against your own external PostgreSQL.
card_title: Docker Deployment
is_feature_card: false
sort_order: 1
updated_by: limbasiabb@gmail.com
updated_at: 2026-08-16T00:00:00.000Z
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
| `notebooks` | Convenience Jupyter preloaded with the **w4h-sample-fitbit-csv-importer** contribution | `127.0.0.1` by default, token-protected |

There is no database service. PostgreSQL is external, matching Flexible mode (see [ADR-006](../dev/ADR-006-trusted-research-environment.md)).

---

## Prerequisites

- Docker and Docker Compose
- A reachable PostgreSQL instance, with credentials that can create schemas and tables
- (Optional) the [`fft_approximate`](https://github.com/USC-InfoLab/fft_approximate) extension on that Postgres instance, if you plan to use approximate range queries. Install it on the database host (Linux, macOS, or Windows); see that repository’s README. It is not part of this Docker stack.

---

## 1. Get the deployment files

Clone the `w4h-docker` repository alongside `w4h-api`, `w4h-app`, `w4h-docs`, `w4h-sample-fitbit-csv`, and `w4h-sample-fitbit-csv-importer`, or use a published compose file when registry images are available.

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
| `W4H_API_KEY` | Personal API key for the preloaded importer notebook (after Step 5) |
| `W4H_DATASET_ID` | Catalog dataset id the importer targets (default `sample-fitbit-csv`) |
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

2. Open `import_fitbit_csv.ipynb` at that URL (append the `token` query parameter from the logs).
3. Set `W4H_API_KEY` in compose `.env` and `docker compose restart notebooks`. Create the target dataset in the UI first (default id `sample-fitbit-csv`, overridable with `W4H_DATASET_ID`).
4. Run the notebook to ingest via the API. Do not hardcode the key in a cell.

The project workspace **Managed JupyterLab** link uses `VITE_JUPYTER_URL` (default `http://127.0.0.1:8888`). You still need the token from the logs to authenticate.

Further notebooks you add are yours. W4H does not version or track project notebook content ([ADR-018](../dev/ADR-018-contributions-catalog.md)). This Compose service is not managed JupyterHub (TRE, [ADR-006](../dev/ADR-006-trusted-research-environment.md)).

---

## Docs staying up to date

The docs you see in the app are imported into Postgres from this repository at container start, every time, not only on first setup. If you pull an updated image and restart, the docs table is resynced automatically. You will not see outdated docs after an update.

---

## Security considerations

- Your personal API key is scoped to your project memberships, has a configurable expiry, and is revoked immediately if your account is discontinued (ADR-007).
- Never paste your API key into a cell that gets saved with output enabled, or hardcode it in a notebook. Use an environment variable.
- The `notebooks` service keeps Jupyter's token authentication on and binds to `127.0.0.1` by default.
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

## Optional: approximate-query extension (fft_approximate)

[`fft_approximate`](https://github.com/USC-InfoLab/fft_approximate) is a PostgreSQL C extension for approximate range aggregates over time series. It runs **inside your PostgreSQL server**, which is outside this Compose stack (PostgreSQL is external, [ADR-015](../dev/ADR-015-docker-deployment-packaging.md)), so install it on the database host, not in a container here.

1. **Check support.** It needs a self-managed PostgreSQL 12+ where you can install files into the server's directories. It is **not supported on RDS, Aurora or Cloud SQL**, which do not allow custom C extensions.
2. **Build and install** on the database host by following the [fft_approximate README](https://github.com/USC-InfoLab/fft_approximate): set `PG_CONFIG` for your platform, then `make` and `sudo make PG_CONFIG=$PG_CONFIG install`.
3. **Create the extension** in the W4H database (`CREATE EXTENSION fft_approximate;`) with your own connection settings.
4. **Mind the platform gotchas** the README lists: AppArmor path allow-lists on Ubuntu, SELinux contexts (`restorecon`) on RHEL/Fedora, and the macOS *App Management* privacy grant for Postgres.app.
5. **Try it** with the [Approximate range queries demo]({{APP_URL}}/contributions) notebook (`w4h-demo-approximate-queries`). It connects to PostgreSQL **directly**, not through the W4H API, and works on a bounded slice of heart-rate or calories data from a dataset you already imported.

The extension is optional: nothing else in W4H depends on it.

---

## Out of scope

- **Spark-enabled deployment** (Dep-02 / M6). This guide covers the standalone, non-Spark deployment only.
- **TRE mode.** Not part of this deployment. See ADR-006.
- **Notebook versioning.** Managed by you or your team, outside the platform.
- **Installing `fft_approximate` inside the stack.** It lives on your Postgres host; see [Optional: approximate-query extension](#optional-approximate-query-extension-fft_approximate).

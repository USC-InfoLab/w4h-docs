---
title: Docker Deployment
description: Run W4H standalone (non-Spark) with Docker Compose. app, api, and a preconfigured sample notebook, against your own external PostgreSQL.
card_title: Docker Deployment
is_feature_card: true
sort_order: 1
updated_by: limbasiabb@gmail.com
updated_at: 2026-08-11T00:00:00.000Z
---

## Overview

This guide covers the standalone (non-Spark) Docker deployment of the W4H Toolkit. It runs the app, the api, and a preconfigured sample notebook against your own external PostgreSQL instance. See [ADR-015]({{APP_URL}}/docs/ADR-015-docker-deployment-packaging) for the packaging decisions behind this setup.

<div class="alert alert-info">
  <strong>Status:</strong> The commands below are confirmed working against a local prototype build (see ADR-015 Changelog). Published image tags and a registry location are not yet set up — until then, build the images from a local checkout as shown.
</div>

---

## What you get

| Service | What it does | Reachable at |
|---|---|---|
| `app` | Web UI | The port you publish in `.env` |
| `api` | Data API, auth, docs, audit log | Internal only, via `app` |
| `notebooks` | Preconfigured Jupyter with one sample notebook | `127.0.0.1` by default, token-protected |

There is no database service. PostgreSQL is external, matching Flexible mode (see [ADR-006]({{APP_URL}}/docs/ADR-006-trusted-research-environment)).

---

## Prerequisites

- Docker and Docker Compose
- A reachable PostgreSQL instance, with credentials that can create schemas and tables
- (Optional) the [`fft_approximate`](https://github.com/USC-InfoLab/fft_approximate) extension installed on that Postgres instance, if you plan to use approximate range queries. This is installed on the database directly and is not part of this Docker stack.

---

## 1. Get the deployment files

Clone the deployment repository (contains `docker-compose.yml`, the `api`/`app`/`notebooks` Dockerfiles, and the sample notebook) as a sibling checkout next to `w4h-api`, `w4h-app`, and `w4h-docs`:

```
your-workspace/
├── w4h-api/
├── w4h-app/
├── w4h-docs/
└── w4h-deploy/   <- this repo
```

The compose file builds `api` and `app` from the sibling `w4h-api`/`w4h-app` checkouts and bakes `w4h-docs` markdown into the `api` image at build time, so all four repos need to be checked out at the same level.

---

## 2. Configure your environment

Copy `.env.example` to `.env` and fill in your values.

| Variable | Purpose |
|---|---|
| `APP_URL`, `API_PUBLIC_URL` | Public URLs used for invite links and docs `{{APP_URL}}`/`{{API_URL}}` substitution |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | Your external PostgreSQL connection |
| `TOKEN_SECRET` | Signs web session tokens |
| `BCRYPT_ROUNDS` | Password hashing cost (default 12) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Optional — email for invitations and password resets |
| `APP_PORT` | Host port the app is published on (default 5173) |
| `W4H_API_KEY` | Leave blank on first start. Fill in after Step 5, then restart the `notebooks` service |
| `GIT_COMMIT` | Baked into the `api` image at build time, shown at `GET /` |

<div class="alert alert-warning">
  <strong>Do not commit your <code>.env</code> file.</strong> Add it to <code>.gitignore</code> before making any changes to this deployment under your own version control.
</div>

---

## 3. Start the stack

```bash
docker compose up -d --build
```

On first start, the `api` service waits for Postgres, creates the schema, and imports the documentation you are reading now. This also happens on every later restart, so an updated image never leaves you looking at stale docs.

---

## 4. First-time platform setup

Open the app in your browser. A fresh install walks you through connecting to Postgres and creating the Super admin account. See [Quick Start]({{APP_URL}}/docs/quick-start) for the full first-login flow.

---

## 5. Generate your personal API key

Log in, then go to **Profile → API keys → Generate new key**. Copy the key immediately, it is shown once. See [ADR-007]({{APP_URL}}/docs/ADR-007-authentication-model) for how this key is scoped and secured.

Set it as `W4H_API_KEY` in `.env`, then restart the `notebooks` service so it picks up the new value:

```bash
docker compose up -d notebooks
```

---

## 6. Run the sample notebook

1. Find the Jupyter URL and token in the `notebooks` service logs:
   ```bash
   docker compose logs notebooks
   ```
2. Open the sample notebook. Its first cell reads `W4H_API_KEY` from the environment — the key is never pasted into or stored in the notebook file.
3. Run the notebook to see a first query against your own data.

Any further changes you make to this notebook, or new notebooks you add, are yours to manage. W4H does not version or track notebook content.

---

## Contribution notebooks baked into `notebooks`

Besides the Fitbit CSV importer, the `notebooks` image bakes in each first-party analytics Contribution as it ships, using the same `additional_contexts` pattern (build-time `pip install` of the Contribution's package, its notebook copied into `/home/jovyan/work`). This keeps the container's toolset growing without adding services, per [ADR-018](https://github.com/USC-InfoLab/w4h-docs/blob/main/dev/ADR-018-contributions-catalog.md) and [ADR-006](https://github.com/USC-InfoLab/w4h-docs/blob/main/dev/ADR-006-trusted-research-environment.md) (Flexible mode has no per-user JupyterHub — this stays a single shared convenience container).

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

### Known gap: importing the full Fitbit sample is slow, with no progress output

The `w4h-sample-fitbit-csv-importer` CLI's `import` command has no per-chunk or per-signal progress output — nothing prints until every signal has finished importing. Measured directly against this image: each 500-row chunk takes roughly 2.5–3.5 seconds end to end (a real Postgres round trip per chunk, not a network artifact). The bundled sample data is large enough that this matters:

| Signal | Rows | Chunks (500/chunk) | Approx. time at ~3s/chunk |
|---|---|---|---|
| `subjects` | 5 | 1 | <1s |
| `weight` | 70 | 1 | <1s |
| `heart_rate` | 165,589 | ~332 | ~15–20 min |
| `calories` | 1,218,241 | ~2,437 | ~2+ hours |

A full `import` run (all four signals) can take well over two hours with **zero terminal output the entire time** — this is easy to mistake for a hang, not a legitimate long-running job. If you only need `wear_compliance.ipynb` working, you do not need `calories` at all, and you don't need the full `heart_rate` file either — importing a bounded slice (a few thousand rows) is enough to exercise the notebook end to end. This is a real, open gap in the importer CLI (no progress reporting) and in the sample data's size (over a million rows is not reasonable for an interactive "run this in Jupyter" demo) — flagged here, not fixed, since both live in separate Contribution repos outside `w4h-docker`'s scope.

---

## Optional: approximate-query extension (fft_approximate)

[`fft_approximate`](https://github.com/USC-InfoLab/fft_approximate) is a PostgreSQL C extension for approximate FFT range-aggregate queries over time series. It installs on **your Postgres server** — Postgres is external to `w4h-docker` (see [ADR-015]({{APP_URL}}/docs/ADR-015-docker-deployment-packaging)), so this is not part of the Docker stack and there is nothing to build or run in a container for it.

This is a prerequisite for the `w4h-demo-approximate-queries` notebook (a separate, not-yet-published Contribution) — install it ahead of that notebook, not as part of the base setup above.

1. **Set `PG_CONFIG`** for your platform (must match your running server's major version):

   | Platform | Command |
   |---|---|
   | Ubuntu / Debian | `export PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config` |
   | macOS — Postgres.app | `export PG_CONFIG=/Applications/Postgres.app/Contents/Versions/latest/bin/pg_config` |
   | macOS — Homebrew | `export PG_CONFIG="$(brew --prefix postgresql@17)/bin/pg_config"` |
   | Windows — EDB installer | `set "PGROOT=C:\Program Files\PostgreSQL\17"` (see the extension's README for the `nmake` flow) |
   | RDS / Aurora / Cloud SQL | **Not supported** — these hosts don't allow installing a custom C library |

2. **Build and install** (needs write access to `pg_config --pkglibdir`, `sudo` if not writable):

   ```bash
   make
   sudo make PG_CONFIG=$PG_CONFIG install
   ```

3. **Create the extension** against your external Postgres:

   ```bash
   psql "postgresql://myuser:secret@127.0.0.1:5432/mydb" -c 'CREATE EXTENSION fft_approximate;'
   ```

**Gotchas to check first if `CREATE EXTENSION` fails after a clean install:**

- **Ubuntu (AppArmor):** if the `.so` lands in `pkglibdir` but the server still won't load it, check `sudo aa-status` and `/etc/apparmor.d/*postgresql*` for a path allowlist that excludes third-party extension directories.
- **RHEL / Fedora / Amazon Linux (SELinux):** a `.so` copied via plain `cp` can get the wrong security context. Fix with `sudo restorecon -v $(pg_config --pkglibdir)/fft_approximate.so`.
- **macOS — Postgres.app:** its bundle lives under `/Applications`, which macOS's **App Management** privacy control guards separately from normal file permissions — `sudo` alone won't grant access. Grant it under **System Settings → Privacy & Security → App Management** to whichever app is actually running your shell (Terminal, iTerm, an editor's integrated terminal, etc. are each separate grants), then fully quit and relaunch that app before retrying.

Full install/test instructions, including the Windows `nmake` flow and the `installcheck` target: see the [`fft_approximate` README](https://github.com/USC-InfoLab/fft_approximate).

---

## Docs staying up to date

The docs you see in the app are imported into Postgres from this repository at container start, every time, not only on first setup. If you pull an updated image and restart, the docs table is resynced automatically. You will not see outdated docs after an update.

---

## Security considerations

- Your personal API key is scoped to your project memberships, has a configurable expiry, and is revoked immediately if your account is discontinued (ADR-007).
- Never paste your API key into a cell that gets saved with output enabled, or hardcode it in a notebook. Use an environment variable.
- The same applies to any cell that displays subject-level rows (e.g. a `display(df.head())` call in the wear-compliance or METs notebooks) — clear outputs before committing a notebook, or use a tool like `nbstripout` as a pre-commit hook if you plan to version your own copies.
- The `notebooks` service keeps Jupyter's token authentication on and binds to `127.0.0.1` by default.
- This deployment handles clinical data. Review [HIPAA Compliance]({{APP_URL}}/docs/hipaa-compliance) before going into production use.

---

## Troubleshooting

**`api` keeps restarting / never becomes healthy**

Check that your `.env` database credentials are correct and that Postgres is reachable from the container network.

**Docs look outdated after pulling a new image**

Restart the stack. Docs import runs automatically on every start.

**Mermaid diagrams do not render in the docs**

This should work out of the box. If it does not, check the `api` service logs for a Playwright/Chromium error.

---

## Out of scope

- **Spark-enabled deployment** (Dep-02 / M6). This guide covers the standalone, non-Spark deployment only.
- **TRE mode.** Not part of this deployment. See ADR-006.
- **Notebook versioning.** Managed by you or your team, outside the platform.
- **Installing `fft_approximate`.** A prerequisite on your Postgres instance, not part of this Docker stack. See [Optional: approximate-query extension](#optional-approximate-query-extension-fft_approximate) above.

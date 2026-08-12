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
  <strong>Status:</strong> This guide describes the planned setup per ADR-015. Exact commands and image tags will be filled in once the prototype is built and validated.
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

```
TBD: clone the deployment repository and its published compose file
```

---

## 2. Configure your environment

Copy `.env.example` to `.env` and fill in your values.

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | Your external PostgreSQL connection |
| `TOKEN_SECRET` | Signs web session tokens |
| `PORT` | Port the `api` service listens on internally |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email for invitations and password resets |
| `BCRYPT_ROUNDS` | Password hashing cost (default 12) |

<div class="alert alert-warning">
  <strong>Do not commit your <code>.env</code> file.</strong> Add it to <code>.gitignore</code> before making any changes to this deployment under your own version control.
</div>

You do not set `W4H_API_KEY` here. You generate it from the web UI after your first login (Step 5).

---

## 3. Start the stack

```
TBD: docker compose up -d
```

On first start, the `api` service waits for Postgres, creates the schema, and imports the documentation you are reading now. This also happens on every later restart, so an updated image never leaves you looking at stale docs.

---

## 4. First-time platform setup

Open the app in your browser. A fresh install walks you through connecting to Postgres and creating the Super admin account. See [Quick Start]({{APP_URL}}/docs/quick-start) for the full first-login flow.

---

## 5. Generate your personal API key

Log in, then go to **Profile → API keys → Generate new key**. Copy the key immediately, it is shown once. See [ADR-007]({{APP_URL}}/docs/ADR-007-authentication-model) for how this key is scoped and secured.

---

## 6. Run the sample notebook

1. Find the Jupyter URL and token in the `notebooks` service logs:
   ```
   TBD: docker compose logs notebooks
   ```
2. Open the sample notebook.
3. Paste your API key where the first cell asks for it. The key is read from an environment variable, not stored in the notebook file.
4. Run the notebook to see a first query against your own data.

Any further changes you make to this notebook, or new notebooks you add, are yours to manage. W4H does not version or track notebook content.

---

## Docs staying up to date

The docs you see in the app are imported into Postgres from this repository at container start, every time, not only on first setup. If you pull an updated image and restart, the docs table is resynced automatically. You will not see outdated docs after an update.

---

## Security considerations

- Your personal API key is scoped to your project memberships, has a configurable expiry, and is revoked immediately if your account is discontinued (ADR-007).
- Never paste your API key into a cell that gets saved with output enabled, or hardcode it in a notebook. Use an environment variable.
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
- **Installing `fft_approximate`.** A prerequisite on your Postgres instance, not part of this Docker stack.

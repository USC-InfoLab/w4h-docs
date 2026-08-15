---
title: Local docs fixtures
description: Dedicated w4h-sample database for screenshots — not your working DB
updated_by: nocera@usc.edu
updated_at: 2026-08-15T00:00:00.000Z
---
# Local docs fixtures

Seed a **separate Postgres database** named `w4h-sample`, then capture against it. That is the usual pattern: a disposable demo catalog, not your working database and never production.

`node bin/w4h seed-docs` uses `DB_HOST` / `DB_USER` / `DB_PASSWORD` only as the Postgres login. It **creates and writes `w4h-sample`**. It does not INSERT/UPDATE `DB_DATABASE` from `w4h-api/.env` (typically `w4h-db`).

Leave `.env` pointed at your real local database. For screenshot sessions, start the API with an override:

```bash
cd ../w4h-api
node bin/w4h seed-docs          # create/refresh w4h-sample
# node bin/w4h seed-docs --reset  # drop and recreate w4h-sample only
npm run start:sample           # DB_DATABASE=w4h-sample, .env otherwise unchanged
```

`dotenv` does not override a variable already in the environment, so `npm run start:sample` does not rewrite `.env`.

## What gets seeded

Local Postgres only (`DB_HOST=localhost` unless you set `W4H_SEED_DOCS_ALLOW_REMOTE=1`).

| UI role | Name | Email | Where they land |
|---------|------|-------|-----------------|
| Super admin | Alex Rivera | `superadmin@example.com` | Platform Admin shell only |
| Admin | Jordan Lee | `admin@example.com` | App shell — Demo Trial / Wearable Pilot (owner) |
| User | Sam Chen | `user@example.com` | Same project as User (editor) |

Shared local password (not a real credential; only exists inside `w4h-sample`):

`DocsOnly!2026`

Also created: team **Demo Trial** (`docs-demo`), project **Wearable Pilot** (`docs-pilot`), catalog dataset **Demo heart rate** (placeholder row, no PHI). Help docs are imported into this database the same way as a fresh install. Sample CSVs still live in **w4h-datasets** if you want a real ingest later.

## Capture env

`w4h-app/.env` is SPA-only (`VITE_*`). Playwright reads **`w4h-docs/.env`** (gitignored):

```bash
cp .env.example .env
```

With `npm run start:sample` and the app running on **`http://127.0.0.1:5173`** (not `localhost:5173` if another app is bound on `[::1]:5173`):

```bash
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
  node scripts/capture-whats-new.mjs          # Super admin / Platform Admin
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
  node scripts/recapture-datasets.mjs         # Admin / app-shell Datasets
```

See [media/README.md](../media/README.md) for the full capture list.

When you are done capturing, go back to `npm start` so day-to-day work uses `w4h-db` again.

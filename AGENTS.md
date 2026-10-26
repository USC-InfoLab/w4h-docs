# AGENTS.md — W4H Docs

Agent instructions for the Wearables for Health (W4H) multi-repo workspace. The shared W4H architecture overview (all repos, concepts, flows) is at the end of this file.

## Where this repo fits in W4H

- **Authority, not runtime code.** This repo is where product rules (`dev/mvp.md`), architecture (`dev/architecture.md`) and decisions (`dev/ADR-*.md`) live. Every other repo's AGENTS.md points here when behavior is ambiguous.
- **It also ships in the product.** `w4h-api` imports this markdown into `w4h.docs` and serves it as in-app **Help** (`DOCS_REPO_PATH=../w4h-docs`), with media served from `/docs-media`. `w4h-docker` copies the whole repo into the `api` image at `/w4h-docs`. Front matter (`title`, `description`, `sort_order`, …) and relative links therefore matter at runtime, not just on GitHub.
- **Audience split:** `guide/`, `faq/`, `quick-start.md`, `releases/` are user-facing Help; `dev/` is for the core team; `guide/contribute-a-module.md` is for external contribution authors.
- **Screenshots** come from Playwright scripts in `scripts/` running against the seeded `w4h-sample` database served by `w4h-api` (`npm run start:sample`).
- **Contribution repos not in the shared map:** `w4h-hr-anomaly` is the example model contribution (MVP M4; reads the series API, writes a derived `hr_anomaly` table). `w4h-fitbit-wear-compliance` is private and unreleased; its protocol is what the platform computes for the Analytics cohort wear tile. `w4h-compute-mets` is the pandas METs companion, not the platform SQL path.
- `architecture.md` describes the **target** schema layout (`w4h_app`, `trial_*`, `w4h_global`). The current code uses the `w4h` schema plus per-dataset `ds_*` schemas. When documenting current behavior, check `w4h-api` code.

## Source of truth

- Product requirements & impl status: `dev/mvp.md`
- Architecture & ADRs: `dev/architecture.md`, `dev/ADR-*.md`
- User-facing setup: `quick-start.md`, `guide/`
- Core team coordination (internal): `dev/core-team-workflow.md` — not `guide/contribute-a-module.md` (external authors)
- Community **Contributions** catalog: `w4h.contributions` (in-app `/contributions`, ADR-018). Help is contribute-only.
- SQL analytics contributions: [ADR-023](dev/ADR-023-sql-analytics-contributions.md) — YAML-bound SQL executed by the API (`kind: sql`). Do not invent a free-SQL endpoint or a third JS METS formula. Pandas `w4h-compute-mets` stays a separate companion.
- Private-file ingest assistant: [ADR-024](dev/ADR-024-ingest-assistant.md) (Draft) — PI **Import files…** into their project; private until they **submit** importer + sample-data packages to Super admin. Not a Contribution, not a share, Discoverable off. Do not invent a Claude filesystem tool or auto-catalog of generated packages.

- Cross-org projects: [ADR-027](dev/ADR-027-cross-org-project-collaboration.md) — a project has one owning team plus optional **collaborating teams**; **dataset data follows project membership** (team membership alone reads nothing); each team controls the datasets it contributes.
- Onboarding: [ADR-028](dev/ADR-028-platform-access-requests.md) — USC researchers request access from the login screen (verified email); the **Super admin only approves** (sends an Admin invitation). The Super admin does not create or approve teams; the Admin creates their own.
- Charts and reports: [ADR-029](dev/ADR-029-visualization-component-and-reports.md) — one vendor-agnostic in-app chart layer driven by the dataset's GeoMTS mapping, plus sandboxed notebook **reports** (snapshots) for edge cases. Contributions ship no UI code.

Prefer updating ADRs/MVP when changing roles, tenancy, datasets, or docs model — do not invent conflicting product rules in code comments alone.

## Product model (locked)

- **Team** = tenancy boundary. **Project** = primary access / work unit.
- UI roles: **Super admin** · **Admin** · **User** (see ADR-004). Do not reintroduce “Project admin” / “Group Admin” / “Org admin” labels. **Team admin is per team** (`team_members.role`), never a global platform role (R-09).
- Super admin stays in Platform Admin shell and **only approves access requests** — never creates or approves teams; day-to-day trial work is Admin/User in the app shell.
- Dataset sharing ≠ project sharing (ADR-012). Dataset **data** access follows **project membership** (ADR-027, R-10).
- **Platform Help** docs ≠ **project pages** (project-private; any project member can edit unless capability says otherwise).
- Treat credentials, API keys, and PHI carefully: no secrets in docs screenshots or sample payloads.

## This repository

- Markdown under `dev/`, `guide/`, `faq/`, `releases/`.
- Structural docs map: [`DOCS_INDEX.md`](./DOCS_INDEX.md) (generated; file → title — not a substitute for MVP/ADRs). Regenerate: `node scripts/generate-docs-index.mjs` when adding/renaming docs.
- Keep status tables in `mvp.md` honest when features land. A row is `✅ Done` only when it was checked (code read, API run against a scratch database, or UI exercised); otherwise `🔁 In review`. §17 milestone progress is **derived from the rows** (Done 100%, In review 90%, In progress 50%, Todo 0%) — update the rows, then the table, never the other way round. Several rows were found stale during the v0.36 audit; re-audit before trusting an old status.
- ADRs: new ones go in `dev/ADR-NNN-*.md` with a row in `dev/ADR-README.md`; then regenerate `DOCS_INDEX.md`.
- Screenshots/GIFs: prefer existing `scripts/` capture helpers when updating UI docs.
- Several agent sessions may work in these repos at once (e.g. a model-contribution session). Re-read a file right before editing it, make targeted edits, and never revert changes you did not make.
- Docs captures log into **seeded synthetic users** on the **`w4h-sample`** database (`dev/docs-fixtures.md`), not real emails and not `DB_DATABASE`. Playwright reads `w4h-docs/.env`, never `w4h-app/.env`. Serve the sample with `npm run start:sample` in **w4h-api**.

## Cross-repo changes

If you change API contracts, ACL, or UI copy for roles/docs/datasets, update the matching ADR/MVP rows and any quick-start/guide pages in the same effort when practical.

<!-- BEGIN w4h-system-overview: identical in every W4H repo's AGENTS.md. Edit all copies together. -->

## W4H system overview (shared across all repos)

**W4H (Wearables for Health) Toolkit** loads wearable-device data into PostgreSQL, organizes it by team, project and dataset, controls access, and runs curated analyses on it. Each signal is a **GeoMTS** (Geospatial Multivariate Time Series) table whose roles (`subject`, `time`, optional `geo`, `values[]`) are stored in `w4h.tables.mapping_json`, not in fixed column names. Three repos form the platform, one packages it, and the rest are **contributions** listed in the in-app catalog (`w4h.contributions`).

| Repo | Role |
|---|---|
| `w4h-api` | Express API and Postgres DDL (`w4h` schema): auth, ACL, ingest, catalog, contribution runner, SQL engine. Port 2026 |
| `w4h-app` | Vue 3 + Vite SPA; talks only to `w4h-api`. Port 5173 |
| `w4h-docs` | Product rules, MVP, ADRs and guides; imported by the API as in-app Help. Owns product decisions |
| `w4h-docker` | Compose stack (`api`, `app`, `notebooks`) built from sibling repos; Postgres is external |
| `w4h-sample-fitbit-csv`, `w4h-sample-icde-demo-csv` | Synthetic sample CSVs plus `manifest.yaml` (ICDE includes a `gps_track` geo signal) |
| `w4h-sample-fitbit-csv-importer`, `w4h-sample-icde-demo-csv-importer` | Runnable importers (notebook, CLI, `run.sh`) for those samples |
| `w4h-fitbit-csv-file-importer` | Runnable importer for user-supplied Fitbit CSVs: profile headers, review a drafted mapping, ingest |
| `w4h-sql-compute-mets` | SQL contribution (YAML + SQL template) that `w4h-api` executes in-process |
| `fft_approximate` | Postgres C extension, catalog slug `fft-approximate`; no API involvement |
| `w4h-demo-approximate-queries` | Notebook comparing `fft_approximate` with exact averages over direct Postgres |

**Main flows:**

1. **Ingest:** importers post 500-row chunks to `POST /datasets/:id/import/csv-batch`. `lib/ingest-csv.js` creates `ds_<dataset_id>.<table_prefix>_<signal>` and upserts its `w4h.tables` mapping.
2. **In-app Run (ADR-022):** `POST /contributions/:slug/run` makes `lib/contribution-runner.js` spawn `../<slug>/run.sh` with the user's `W4H_API_KEY`, `W4H_API_BASE` and `W4H_DATASET_ID`. Stdout lines `@@PROGRESS@@ {json}` drive the progress bar.
3. **SQL analytics (ADR-023):** `lib/sql-contribution-engine.js` reads `../<slug>/manifest.yaml` and `sql/`, binds identifiers from `w4h.tables`, and runs in-process. There is no free-SQL endpoint.
4. **Extensions:** the operator installs `fft_approximate` on their Postgres; notebooks call it directly.

**Layout:** clone every repo as a sibling in one folder. The API finds contributions at `../<slug>` (override `CONTRIBUTION_RUNNER_REPO_ROOT`) and docs at `DOCS_REPO_PATH=../w4h-docs`.

**Cross-repo changes:** `w4h-api` first (regenerate `API_INDEX.md`), then `w4h-app`, then `w4h-docs`. Catalog rows are seeded in `w4h-api/data/schema.sql`. Start at `w4h-docs/dev/mvp.md` and `w4h-docs/dev/ADR-README.md` for decisions, and `w4h-docs/dev/developer-setup.md` for local setup, getting an API key, test personas, troubleshooting, per-repo test commands, default branches and a glossary. Do not commit or push unless asked; never commit `.env` files, API keys or participant data.

<!-- END w4h-system-overview -->

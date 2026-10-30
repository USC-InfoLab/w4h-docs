# AGENTS.md — W4H Docs

Agent instructions for the Wearables for Health (W4H) multi-repo workspace.

## Workspace map

| Repo | Role |
|------|------|
| **w4h-docs** (this repo) | Product docs, ADRs, MVP, architecture, guides |
| **w4h-app** | Vue 3 + Vite web UI |
| **w4h-api** | Express API + PostgreSQL schema / ACL |
| **w4h-utils** | Scripts, CLI helpers, utility notebooks |
| **w4h-datasets** | Legacy sample CSVs (migrating to `w4h-sample-*` repos) |
| **w4h-sample-fitbit-csv** | Fitbit CSV sample package + manifest |
| **w4h-sample-fitbit-csv-importer** | Fitbit CSV importer (notebook + CLI) |
| **w4h-notebooks** | Index of sample notebooks (legacy); new tools are one repo per contribution |
| **w4h-load-json** | First-party JSON ingest notebook |
| **w4h-docker** | Docker Compose packaging (app, api, convenience Jupyter; ADR-015) |
| **fft_approximate** | External Postgres extension (listed in Contributions) |
| **w4h-hr-anomaly** | Example model contribution (MVP M4): per-subject resting heart-rate anomaly detector; adapter reads the series API, writes a derived table; notebook + CLI |
| **w4h-sql-compute-mets** | YAML-bound SQL METS job (ADR-023); API bind/execute plus notebook/CLI that target one dataset in a project |
| **w4h-compute-mets** | Pandas METs companion (notebook + CLI); not the platform SQL path |
| **w4h-fitbit-wear-compliance** | Wear-compliance notebook + CLI (private repo, unreleased); its protocol is what the platform computes for the Analytics cohort tile |
| **w4h-demo-approximate-queries** | Notebook demo of the `fft_approximate` extension (private repo) |

Open these together via `w4h-repos.code-workspace` when changing cross-cutting behavior.

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
- Screenshots/GIFs: prefer existing `scripts/` capture helpers when updating UI docs. **What's New** is GIF-first for flows (`scripts/capture-whats-new.mjs`, `scripts/capture-whats-new-oct.mjs`, plus the `recapture-*.mjs` extras). Keep `whats-new.md` as the **current month** only; archive the previous month to `releases/YYYY-MM.md` (see `releases/archive.md`).
- Several agent sessions may work in these repos at once (e.g. a model-contribution session). Re-read a file right before editing it, make targeted edits, and never revert changes you did not make.
- Docs captures log into **seeded synthetic users** on the **`w4h-sample`** database (`dev/docs-fixtures.md`), not real emails and not `DB_DATABASE`. Playwright reads `w4h-docs/.env`, never `w4h-app/.env`. Serve the sample with `npm run start:sample` in **w4h-api**.

## Cross-repo changes

If you change API contracts, ACL, or UI copy for roles/docs/datasets, update the matching ADR/MVP rows and any quick-start/guide pages in the same effort when practical.

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

Open these together via `w4h-repos.code-workspace` when changing cross-cutting behavior.

## Source of truth

- Product requirements & impl status: `dev/mvp.md`
- Architecture & ADRs: `dev/architecture.md`, `dev/ADR-*.md`
- User-facing setup: `quick-start.md`, `guide/`
- Community **Contributions** catalog: `w4h.contributions` (in-app `/contributions`, ADR-018). Help is contribute-only.

Prefer updating ADRs/MVP when changing roles, tenancy, datasets, or docs model — do not invent conflicting product rules in code comments alone.

## Product model (locked)

- **Team** = tenancy boundary. **Project** = primary access / work unit.
- UI roles: **Super admin** · **Admin** · **User** (see ADR-004). Do not reintroduce “Project admin” / “Group Admin” labels.
- Super admin stays in Platform Admin shell; day-to-day trial work is Admin/User in the app shell.
- Dataset sharing ≠ project sharing (ADR-012).
- **Platform Help** docs ≠ **project pages** (project-private; any project member can edit unless capability says otherwise).
- Treat credentials, API keys, and PHI carefully: no secrets in docs screenshots or sample payloads.

## This repository

- Markdown under `dev/`, `guide/`, `faq/`, `releases/`.
- Structural docs map: [`DOCS_INDEX.md`](./DOCS_INDEX.md) (generated; file → title — not a substitute for MVP/ADRs). Regenerate: `node scripts/generate-docs-index.mjs` when adding/renaming docs.
- Keep status tables in `mvp.md` honest when features land.
- Screenshots/GIFs: prefer existing `scripts/` capture helpers when updating UI docs.
- Docs captures log into **seeded synthetic users** on the **`w4h-sample`** database (`dev/docs-fixtures.md`), not real emails and not `DB_DATABASE`. Playwright reads `w4h-docs/.env`, never `w4h-app/.env`. Serve the sample with `npm run start:sample` in **w4h-api**.

## Cross-repo changes

If you change API contracts, ACL, or UI copy for roles/docs/datasets, update the matching ADR/MVP rows and any quick-start/guide pages in the same effort when practical.

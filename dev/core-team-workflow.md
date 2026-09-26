---
title: Core team workflow
description: How the W4H platform team coordinates new repos and cross-repo changes — internal handoffs, catalog, releases, and GitHub org admin steps.
sort_order: 3
---

Audience: **USC-InfoLab / w4h-toolkit** people shipping **w4h-app**, **w4h-api**, **w4h-docker**, and **first-party** contribution repos.

External contributors follow [Contribute a module](../guide/contribute-a-module.md) (hand URL → staging review → Super admin publish). This page is the **internal** mirror: same module contract, but **you** own git, catalog, and platform PRs.

---

## Where decisions and status live

| Artifact | Use when |
|----------|----------|
| [MVP](mvp.md) | Scope, milestone (M1–M9), requirement rows, honest `Impl Status` |
| [ADRs](ADR-README.md) | Product or architecture choices that must not drift in code comments alone |
| [Architecture](architecture.md) | System map (app ↔ api ↔ Postgres, datasets vs Contributions) |
| [Release plans](august-2026-release-plan.md) | Monthly operator checklist (semver, codename, tags, in/out of cut) |
| Work-package pages (e.g. [analytics-contributions](analytics-contributions.md)) | Named tasks, acceptance criteria, RA handoffs |

Open the multi-repo workspace (`w4h-repos.code-workspace`) for anything that crosses **w4h-api**, **w4h-app**, **w4h-docs**, or **w4h-docker**.

---

## Change a platform repo (api / app / docker / docs)

1. **Decide** — If the change affects roles, tenancy, datasets, catalog, or ingest contracts, update or add an **ADR** and MVP rows in the **same effort** when practical.
2. **Implement in dependency order**
   - **w4h-api** — schema (`data/schema.sql`), routes, ACL, ingest/analytics contracts
   - **w4h-app** — consume documented API shapes only
   - **w4h-docs** — guides, MVP, ADRs for product-visible behavior
   - **w4h-docker** — when packaging or env vars change ([ADR-015](ADR-015-docker-deployment-packaging.md))
3. **PR + review** — Normal git flow per repo; link related PRs in descriptions when one logical feature spans repos.
4. **Regenerate indexes** when structure changes (not on every typo):
   - `npm run index:api` in **w4h-api**
   - `npm run index:ui` in **w4h-app**
   - `node scripts/generate-docs-index.mjs` in **w4h-docs**
5. **Validate locally** — `npm run dev` in api + app; module authors run `pytest` in the tool repo. Do not use production or W4H Samples as the default QA target for new ingest tools.

---

## Add or extend a first-party contribution repo

First-party tools are **one git repo per job** (notebook + CLI + `contribution.yaml` + `run.sh` + tests). Naming patterns: [ADR-016](ADR-016-paired-sample-importer-repos.md), [August release plan § Contribution repo naming](august-2026-release-plan.md#contribution-repo-naming-adr-016).

| Step | Owner | Action |
|------|--------|--------|
| 1 | Dev | Implement repo; `pytest tests/ -q -m "not integration"`; `./run.sh import` against **your team’s** dataset on local dev |
| 2 | Org admin | Create GitHub repo under **USC-InfoLab**, grant **w4h-toolkit** ([GitHub workflow below](#github-org-admin-workflow-gh)) |
| 3 | Dev | Push `main`; tag **`vMAJOR.MINOR.PATCH`** when catalog should pin a release |
| 4 | Platform | **Staging:** add catalog row (`published`), run as **Admin** the way a PI would — not only Super admin in Platform Admin |
| 5 | Super admin | **Production:** Platform Admin → Contributions → **Fetch repo info** → **published**; pin tag; set **`runnable = true`** in DB after `./run.sh` / in-app **Run import…** is proven ([ADR-022](ADR-022-in-app-contribution-run-trigger.md)) |
| 6 | Platform | Optional: seed **`w4h.contributions`** in `w4h-api/data/schema.sql` so fresh dev databases list the tool; extend **`runnable`** seed list when appropriate |
| 7 | Docs | **`README.md`** in the module (user-facing on `/contributions/:slug`); update MVP / [Contributions guide](../guide/sample-packages.md) when first-party |

**In-app Run (local dev):** clone the contribution repo **next to w4h-api** (sibling checkout). The API runner resolves `../<slug>/run.sh` and may clone/ff-only pull paired sample repos per [ADR-022](ADR-022-in-app-contribution-run-trigger.md).

**Not the same as ADR-024:** PI **Import files…** (private ingest assistant) is unverified trial data — not this catalog path.

---

## Test Run import… in the app (core team checklist)

Use this after **`pytest`** and **`./run.sh import`** pass in the module repo. Behavior spec: [ADR-022](ADR-022-in-app-contribution-run-trigger.md). End-user wording: [Quick start § ingest](../quick-start.md) and [Welcome admin](../guide/welcome-admin.md).

**Environment:** `npm run dev` in **w4h-api** + **w4h-app** on your laptop or **staging** Postgres — not production, not W4H Samples read-only datasets, and **not** the Docker stack for in-app Run today (the `api` image has no Python; [ADR-022](ADR-022-in-app-contribution-run-trigger.md)).

### 1. Prerequisites

| Check | Action |
|-------|--------|
| Module tests green | In the importer repo: `pytest tests/ -q -m "not integration"`; `contribution.yaml` matches [contribute-a-module](../guide/contribute-a-module.md) |
| README ready for users | Public **`README.md`** covers device/export shape, env vars, CLI, and who runs what — rendered on the catalog detail page after publish |
| CLI path works | `./run.sh import` with `W4H_API_KEY` + empty **your-team** `W4H_DATASET_ID` |
| Repo on disk for the runner | Clone **`USC-InfoLab/<slug>`** as a **sibling of `w4h-api`** (same parent folder), **or** set `CONTRIBUTION_RUNNER_REPO_ROOT` to that parent. Slug must match the folder name (e.g. `w4h-glucose-monitor-csv-file-importer`). |
| Catalog row on **this** database | The importer must appear in **`w4h.contributions`** with **`status = published`**. On local dev: Super admin → **Platform Admin → Contributions** → paste GitHub URL → **Fetch repo info** → save (see [contribute-a-module § live test](../guide/contribute-a-module.md#live-test-not-production)). |
| Runnable flag | In-app Run only lists rows with **`runnable = true`**. The admin form may not expose this yet — on local/staging after `./run.sh` is proven: `UPDATE w4h.contributions SET runnable = true WHERE slug = '<slug>';` (same pattern as seed in `w4h-api/data/schema.sql`). |

### 2. Role checks (two passes)

Staging sign-off needs **both** personas from [contribute-a-module § live test](../guide/contribute-a-module.md#live-test-not-production). **Super admin** is only for catalog setup (§1), not the ingest click-through.

#### A. Team Admin — **required** (primary PI path)

Log in to the **app shell** as **Admin**: **`team_admin`** on the dataset’s team and/or **`owner`** on the project ([ADR-004](ADR-004-acl-roles.md)). This is the person who creates catalog datasets, links them, and runs **Run import…**.

**Local fixtures:** after `npm run start:sample` in **w4h-api**, use seeded **Admin** `admin@example.com` / `DocsOnly!2026` on project **Wearable Pilot** ([docs-fixtures](docs-fixtures.md)). Or use your own team with the same Admin powers.

Complete **§3–§5** below as this user. Record pass/fail.

#### B. Team User — **required negative**

Log in as **User** (`team_members.role = member`, project **`editor`** — not project owner). Open the same project and select the same writable, empty dataset.

| Expect | Reason |
|--------|--------|
| **Run import…** button **not shown** | UI gates on project `canManage` (`canRunImportOnSelected` in **w4h-app** `ProjectDatasetMasterDetail.vue`) |
| No ingest actions on datasets | Users analyze loaded data; they do not load tables ([Contributions guide](../guide/sample-packages.md)) |

If a User can start a catalog import, treat that as a **bug** (ACL/UI mismatch with [ADR-004](ADR-004-acl-roles.md) / ingest checks in `w4h-api/lib/ingest-csv.js`).

**Local fixtures:** `user@example.com` / `DocsOnly!2026` ([docs-fixtures](docs-fixtures.md)).

### 3. Click path (first load — empty dataset)

Perform **§3–§5 as Team Admin only** (§2A).

1. Open a **project** you own or administer.
2. **Datasets** — create a new **catalog dataset** on your team (empty) or pick an existing empty one, and **link** it to the project if needed.
3. Select that dataset in the project list so the **Dataset overview** pane is active.
4. Click **Run import…** (not **Import files…** — that is ADR-024, not catalog importers).
5. In the dialog: choose the **runnable** contribution (e.g. glucose / data-recorder / Fitbit file importer).
6. Confirm the **target dataset** (must be writable; not Samples sandbox if read-only).
7. Start the run. **Full** is the default on an empty dataset (loads fixture/sample declared in `contribution.yaml` via `run.sh`).
8. Watch **progress** in the UI until the run finishes.

### 4. Pass criteria

**Team Admin (§2A)**

- Run status **succeeded** (no error in the run log).
- Dataset **overview** refreshes: signal/table count and stats update without a full page reload.
- In Postgres or the UI, physical tables exist under the dataset schema with the expected **`table_prefix`** (e.g. `glucose_*`, `recorder_*`, `fitbit_*`).
- Optional: open **Contributions** → detail page for the slug; README still renders.

**Team User (§2B)**

- **Run import…** absent on dataset overview for a writable dataset; User cannot complete a catalog run from the UI.

### 5. Re-run (dataset already has data)

1. Select the same loaded dataset → **Run import…** again.
2. Choose **Update** (append, default) or **Full** (truncate and reload **this dataset only**).
3. **Full** on a non-empty dataset may prompt if other projects or shares depend on it ([ADR-022](ADR-022-in-app-contribution-run-trigger.md) / MVP D-33).

### 6. Staging vs local

Same steps for **§2A + §2B**; only the **base URL** and **Postgres** change. Staging should already have a **`published`** row; platform sets **`runnable`** after CLI proof. Testers report **two** results (Admin pass/fail, User negative pass/fail) in Slack or an issue — do not use production catalog until staging sign-off.

### 7. If it fails

| Symptom | What to check |
|---------|----------------|
| Contribution missing from picker | `published`? `runnable = true`? correct database? |
| 500 / script not found | Sibling clone path; `run.sh` executable; `CONTRIBUTION_RUNNER_REPO_ROOT` |
| 403 on run | Your user must be team/project **Admin** with ingest rights on that dataset |
| Run OK but “Needs ingest” | Known class of bugs around physical schema resolution — see ADR-022 changelog; verify `w4h.tables` / overview refresh |

---

## Releases (core team)

Follow the active [release plan](august-2026-release-plan.md):

- Bump **semver** on **w4h-app** and **w4h-api** together when shipping a platform cut
- Set **release codename** in both repos when the month’s name changes
- Tag **`v*`** on repos that ship; archive **`releases/YYYY-MM.md`** / What’s New per release plan
- Contribution repos: tag when Super admin should pin; avoid leaving **published + runnable** rows pinned only to **`main`**

---

## Roles (internal)

| Role | Typical coordination |
|------|----------------------|
| **Core dev** | Feature PRs, cross-repo contracts, schema seed, docker packaging |
| **Super admin** | Production **Contributions** listing, Samples sandbox seed, version pins — **not** day-to-day importer QA ([welcome-super-admin](../guide/welcome-super-admin.md)) |
| **Org admin (GitHub)** | Repo creation, **w4h-toolkit** access, visibility |
| **RA / assigned dev** | Work packages on pages like [analytics-contributions](analytics-contributions.md) |

---

## GitHub org admin workflow (`gh`)

Prerequisites:

```bash
gh auth login
gh auth status   # must have org permission to create repos and manage team repos
```

Team slug for toolkit repos: **`w4h-toolkit`**  
Org: **`USC-InfoLab`**  
Team repos UI: [USC-InfoLab w4h-toolkit repositories](https://github.com/orgs/USC-InfoLab/teams/w4h-toolkit/repositories)

### Create a new private repo, grant the team, push local `main`

From the repo root (already has commits):

```bash
cd /path/to/w4h-<name>

gh repo create USC-InfoLab/w4h-<name> \
  --private \
  --description "One-line summary for GitHub" \
  --team w4h-toolkit \
  --source=. \
  --remote=origin \
  --push
```

`--team w4h-toolkit` grants the team access at create time (default team permission is org-dependent; use the API below if you need explicit **push**).

### Repo already exists on GitHub (avoid “Name already exists”)

Do **not** re-run `gh repo create`. Link and push:

```bash
git remote add origin git@github.com:USC-InfoLab/w4h-<name>.git   # or https
git push -u origin main
```

### Add an existing repo to w4h-toolkit

```bash
gh api -X PUT \
  orgs/USC-InfoLab/teams/w4h-toolkit/repos/USC-InfoLab/w4h-<name> \
  -f permission=push
```

Use `pull` for read-only team access if policy requires it.

### Verify team membership

```bash
gh api orgs/USC-InfoLab/teams/w4h-toolkit/repos --jq '.[].name' | grep w4h-<name>
```

### Inspect repo (anyone on the team)

```bash
gh repo view USC-InfoLab/w4h-<name> --web
git clone git@github.com:USC-InfoLab/w4h-<name>.git
```

### Release tag (when catalog should pin)

```bash
git tag -a v0.1.0 -m "v0.1.0 — short note"
git push origin v0.1.0
# Optional: GitHub Release
gh release create v0.1.0 --title "v0.1.0" --notes "What changed"
```

Bump **`version`** in `pyproject.toml` when the repo has one, in the same commit as the tag when possible.

### List org teams (confirm slug)

```bash
gh api orgs/USC-InfoLab/teams --jq '.[].slug'
```

### Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `Name already exists on this account` | Repo was created earlier — use **remote + push** or **team PUT** only |
| `403` on team PUT | Your user lacks **org admin** or **team maintain** rights — ask an org owner |
| In-app Run 500 / missing script | Sibling checkout missing — clone repo next to **w4h-api** or let runner clone (needs network + catalog `repo_url`) |
| Contribution not in UI | No **`w4h.contributions`** row or status not **published** on that database |

---

## Related

- [Developer setup](developer-setup.md) — local app/api stack
- [Contribute a module](../guide/contribute-a-module.md) — **external** author path
- [Contributions (user-facing)](../guide/sample-packages.md) — browse / Run import behavior

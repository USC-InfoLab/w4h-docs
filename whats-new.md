---
title: 🆕 What's New!
description: Highlights from W4H Toolkit 0.3.0 — 🧗 Peña Roja.
updated_by: nocera@usc.edu
updated_at: 2026-08-17T18:00:00.000Z
---

<p class="lead">
  Welcome to <strong>🧗 Peña Roja</strong> — W4H Toolkit <strong>0.3.0</strong> (August 2026).
  App and API share this version. Below are the changes you will notice most.
</p>

**Highlights**

- [PHI-safe AI chat](#phi-safe-ai-chat) — docked assistant with a default egress filter
- [Contributions catalog](#contributions-catalog) — browse tools; no project notebook registry
- [Sample Fitbit CSV](#sample-fitbit-csv) — paired sample package + importer
- [Project dataset overview](#project-dataset-overview) — selected-dataset stats in the workspace
- [Roles in the UI](#roles-in-the-ui) — Super admin · Admin · User
- [Docker deployment](#docker-deployment) — standalone Compose stack against your Postgres

> Tip: click any image to enlarge it in the docs browser.
>
> **Cursor preview:** use the built-in command **Markdown: Open Preview to the Side** (`Cmd+K` then `V`) — not “Markdown Editor”. Image files are in `media/whats-new/`.

---

## PHI-safe AI chat

The in-app assistant from [ADR-014]({{APP_URL}}/docs/ADR-014-ai-assistant-claude) is in this release — not design-only.

Open it from the chat icon in the top nav, or with **⌘J** / **Ctrl+J**. The panel docks beside the page. It sends **page context** (shell, route, team/project names), not table rows.

- Default **PHI-safe (strict)** egress filter so raw wearable rows and obvious identifiers stay out of Claude prompts
- Modes: **Help**, **Import**, **IRB**, **Analytics**
- **Team** Anthropic key (lab pays) and optional Super admin **provisioned** platform key with a monthly token quota
- Keys stay **masked**; the browser never holds the secret

**Permissive** mode is not PHI-safe. Guide: [PHI-safe AI chat]({{APP_URL}}/docs/ai-chat).

---

## Contributions catalog

W4H does **not** register project-owned notebooks. Browse **Contributions** (`/contributions`) instead — a catalog of tools (publisher, kind, language, git README). Super admins curate listings in Platform Admin.

First-party listings include **w4h-sample-fitbit-csv**, **w4h-sample-fitbit-csv-importer**, **w4h-load-json**, and **fft_approximate** (external Postgres extension — install on the database; W4H does not vendor it).

Put your own analysis repo links in **project pages**. See [Contributions]({{APP_URL}}/docs/sample-packages) and [ADR-018]({{APP_URL}}/docs/ADR-018-contributions-catalog).

---

## Sample Fitbit CSV

Paired repos ([ADR-016]({{APP_URL}}/docs/ADR-016-paired-sample-importer-repos)):

| Repo | What it is |
|---|---|
| `w4h-sample-fitbit-csv` | Synthetic Fitbit CSV package + `manifest.yaml` |
| `w4h-sample-fitbit-csv-importer` | Notebook + CLI that loads via the **W4H API** (not direct Postgres) |

Use a personal `W4H_API_KEY` in local `.env` only. Do not commit credentials or real PHI.

---

## Project dataset overview

Dataset stats and overview always appear in the context of a **selected dataset** in the project workspace (master–detail). Summaries use cached metadata — the UI does not run live full-table `COUNT(*)` scans.

GeoMTS remains a **role mapping** over physical tables (`w4h.tables`), not a forced rename to `subject_id` / `ts` / `lat` / `lon`. See [ADR-003]({{APP_URL}}/docs/ADR-003-dataset-table-model) and [ADR-008]({{APP_URL}}/docs/ADR-008-geomts-data-model).

![Dataset catalog with Mine / Others / Shared filters](media/whats-new/datasets-catalog.png)

Discoverable vs shared is unchanged from July: **Others** is metadata only until you **share**. [Setting Up Projects]({{APP_URL}}/docs/setting-up-projects).

---

## Roles in the UI

Labels are **Super admin** · **Admin** · **User**. There is no “Project admin” in the product UI.

- **Super admin** stays in the Platform Admin shell
- **Admins** (team admins) and **Users** work in the app shell
- Project membership is still `owner` / `editor` / `viewer` under the hood

![Platform Admin home](media/whats-new/admin-home.png)

Welcome guides: [Super admin]({{APP_URL}}/docs/welcome-super-admin) · [Admin]({{APP_URL}}/docs/welcome-admin) · [User]({{APP_URL}}/docs/welcome-user).

---

## Docker deployment

Prototype Compose packaging in `w4h-docker` runs the app, API, and a convenience Jupyter service against **your** PostgreSQL (no bundled database). See [Docker Deployment]({{APP_URL}}/docs/docker-deployment) and [ADR-015]({{APP_URL}}/docs/ADR-015-docker-deployment-packaging).

---

## Also in this release

### About
Account menu **About** now shows this release name with the version (**🧗 Peña Roja 0.3.0**).

![About W4H modal](media/whats-new/about-modal.png)

### Docs & Help
- [PHI-safe AI chat]({{APP_URL}}/docs/ai-chat) and [Contributions]({{APP_URL}}/docs/sample-packages) guides
- Monthly archive: July notes moved to [Release notes — July 2026]({{APP_URL}}/docs/2026-07)

### For developers
Architecture and requirements: [MVP]({{APP_URL}}/docs/mvp) and the [ADR index]({{APP_URL}}/docs/ADR-README). After deploy, **refresh Help** from Platform Admin so this page is imported.

---

## Previous releases

Older months are archived (same idea as VS Code’s versioned Updates pages) so this page stays focused on the **current** release:

| Release | Notes |
|---|---|
| **August 2026 — 🧗 Peña Roja 0.3.0** | This page |
| [July 2026]({{APP_URL}}/docs/2026-07) | Email code login, Platform Admin setup, discoverable datasets, Usage, audit log |
| [June 2026]({{APP_URL}}/docs/2026-06) | Projects rename, ACL, notebook keys, email login codes |
| [Earlier 2026]({{APP_URL}}/docs/earlier-2026) | May Projects hub, March–April auth, initial platform |

Full index: [Release notes archive]({{APP_URL}}/docs/archive) (under **releases** in the sidebar).

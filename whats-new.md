---
title: 🆕 What's New!
description: Highlights from W4H Toolkit 0.3.0 — 🧗 Peña Roja.
updated_by: nocera@usc.edu
updated_at: 2026-09-15T00:00:00.000Z
---

<p class="lead">
  Welcome to <strong>🧗 Peña Roja</strong> — W4H Toolkit <strong>0.3.0</strong> (August 2026).
  App and API share this version. Below are the changes you will notice most.
</p>

**Highlights**

- [PHI-safe AI chat](#phi-safe-ai-chat) — docked assistant with a default egress filter
- [Contributions catalog](#contributions-catalog) — browse tools; no project notebook registry
- [Sample CSV packages](#sample-csv-packages) — Fitbit + ICDE demo pairs
- [Project dataset overview](#project-dataset-overview) — selected-dataset stats in the workspace
- [Roles in the UI](#roles-in-the-ui) — Super admin · Admin · User
- [Docker deployment](#docker-deployment) — standalone Compose stack, configured entirely through the Admin UI setup wizard

> Tip: click any image to enlarge it in the docs browser.
>
> **Cursor preview:** use the built-in command **Markdown: Open Preview to the Side** (`Cmd+K` then `V`) — not “Markdown Editor”. Image files are in `media/whats-new/`.

---

## PHI-safe AI chat

The in-app assistant from [ADR-014](dev/ADR-014-ai-assistant-claude.md) is in this release — not design-only.

Open it from the chat icon in the top nav, or with **⌘J** / **Ctrl+J**. The panel docks beside the page. It sends **page context** (shell, route, team/project names), not table rows.

- Default **PHI-safe (strict)** egress filter so raw wearable rows and obvious identifiers stay out of Claude prompts
- Modes: **Help**, **Import**, **IRB**, **Analytics**
- **Team** Anthropic key (lab pays) and optional Super admin **provisioned** platform key with a monthly token quota
- Keys stay **masked**; the browser never holds the secret

**Permissive** mode is not PHI-safe. Guide: [PHI-safe AI chat](guide/ai-chat.md).

---

## Contributions catalog

W4H does **not** register project-owned notebooks. Browse **Contributions** (`/contributions`) instead — a catalog of tools (publisher, kind, language, git README). Super admins curate listings in Platform Admin.

First-party listings include the two paired CSV samples below, plus **w4h-load-json** and **fft_approximate** (external Postgres extension — install on the database; W4H does not vendor it).

Put your own analysis repo links in **project pages**. See [Contributions](guide/sample-packages.md) and [ADR-018](dev/ADR-018-contributions-catalog.md).

---

## Sample CSV packages

Two paired sample + importer repos ([ADR-016](dev/ADR-016-paired-sample-importer-repos.md)) — one git repo per contribution row:

| Pair | What it is | Geo? |
|---|---|---|
| **w4h-sample-fitbit-csv** | Synthetic Fitbit-style CSV + `manifest.yaml` | No — real Fitbit exports have no GPS |
| **w4h-sample-fitbit-csv-importer** | Notebook + CLI via the **W4H API** (not direct Postgres); **runnable** in-app (**Run import…**) | — |
| **w4h-sample-icde-demo-csv** | Synthetic ICDE 2024 demo CSV + `manifest.yaml`; includes `gps_track` | Yes — exercises geo GeoMTS mapping ([ADR-008](dev/ADR-008-geomts-data-model.md)) |
| **w4h-sample-icde-demo-csv-importer** | Notebook + CLI for the ICDE demo sample (notebook/CLI only — not in-app runnable yet) | — |

Use a personal `W4H_API_KEY` in local `.env` only. Do not commit credentials or real PHI.

---

## Project dataset overview

Dataset stats and overview always appear in the context of a **selected dataset** in the project workspace (master–detail). Summaries use cached metadata — the UI does not run live full-table `COUNT(*)` scans.

**Metadata summary** — the selected dataset shows seven researcher-facing sections: **Scope** (tables, observations, collection dates, study length), **Subjects** (enrolled participants, participant age), **Device**, **Cadence** (per-signal sampling interval), **Provenance**, **Wear Compliance**, and **Semantic**. Info-icon tooltips define each field. The API assembles this on read from `w4h.datasets` and `w4h.tables`, with bounded timestamp-gap sampling for **observed cadence** (mode interval + largest gap). Fields the importer has not persisted yet display as **Unavailable** per tile (native sensor rate, ontology codes, firmware, and similar).

**Wear Compliance** always shows four tiles: wear-compliant subjects, cohort compliance rate, median daily wear (%), and median days wear. Values come from cached per-subject wear rows in `datasets.summary` when present; each tile shows **Unavailable** on its own until wear-compliance analytics have been run (for example via the Analytics tab or `w4h-fitbit-wear-compliance`).

GeoMTS remains a **role mapping** over physical tables (`w4h.tables`), not a forced rename to `subject_id` / `ts` / `lat` / `lon`. See [ADR-003](dev/ADR-003-dataset-table-model.md) and [ADR-008](dev/ADR-008-geomts-data-model.md).

![Dataset catalog with Mine / Others / Shared filters](media/whats-new/datasets-catalog.png)

Discoverable vs shared is unchanged from July: **Others** is metadata only until you **share**. [Setting Up Projects](guide/setting-up-projects.md).

---

## Roles in the UI

Labels are **Super admin** · **Admin** · **User**. There is no “Project admin” in the product UI.

- **Super admin** stays in the Platform Admin shell
- **Admins** (team admins) and **Users** work in the app shell
- Project membership is still `owner` / `editor` / `viewer` under the hood

![Platform Admin home](media/whats-new/admin-home.png)

Welcome guides: [Super admin](guide/welcome-super-admin.md) · [Admin](guide/welcome-admin.md) · [User](guide/welcome-user.md).

---

## Docker deployment

Prototype Compose packaging in `w4h-docker` runs the app, API, and a convenience Jupyter service against **your** PostgreSQL (no bundled database). See [Docker Deployment](guide/docker-deployment.md) and [ADR-015](dev/ADR-015-docker-deployment-packaging.md).

**Setup is Admin UI–driven, not manual SQL or config-file editing.** `docker compose up` starts the stack with no database credentials required; everything after that happens in the browser:

1. Open the app and enter your Postgres host, port, and credentials in the **setup wizard** — it tests the connection, auto-creates the `w4h` schema, and generates `TOKEN_SECRET` for you.
2. Create the initial **Super admin** account.
3. Configure outbound email under **Settings → Mail Server** and send a test message.

With Postgres and SMTP credentials already on hand, that whole in-app portion — schema bootstrap through a working test email — takes **under 5 minutes**.

---

## Also in this release

### About
Account menu **About** now shows this release name with the version (**🧗 Peña Roja 0.3.0**).

![About W4H modal](media/whats-new/about-modal.png)

### Docs & Help
- [PHI-safe AI chat](guide/ai-chat.md) and [Contributions](guide/sample-packages.md) guides
- Monthly archive: July notes moved to [Release notes — July 2026](releases/2026-07.md)

### For developers
Architecture and requirements: [MVP](dev/mvp.md) and the [ADR index](dev/ADR-README.md). After deploy, **refresh Help** from Platform Admin so this page is imported.

---

## Previous releases

Older months are archived (same idea as VS Code’s versioned Updates pages) so this page stays focused on the **current** release:

| Release | Notes |
|---|---|
| **August 2026 — 🧗 Peña Roja 0.3.0** | This page |
| [July 2026](releases/2026-07.md) | Email code login, Platform Admin setup, discoverable datasets, Usage, audit log |
| [June 2026](releases/2026-06.md) | Projects rename, ACL, notebook keys, email login codes |
| [Earlier 2026](releases/earlier-2026.md) | May Projects hub, March–April auth, initial platform |

Full index: [Release notes archive](releases/archive.md) (under **releases** in the sidebar).

---
title: "ADR-024 — Ingest assistant: obscured file profiles, csv-batch, generated runnable package"
description: App file chooser builds a PHI-obscured profile; Import-mode chat proposes a GeoMTS mapping spec; ingest uses the same csv-batch path as sample importers; the durable output is a downloadable runnable package (manifest + notebook + CLI) the researcher can edit if the UI mapping is wrong.
updated_by: nocera@usc.edu
updated_at: 2026-08-25T00:00:00.000Z
---

**Status:** Draft
**Date:** 2026-08-25
**Relates to:** ADR-003 (table model), ADR-007 (API keys), ADR-008 (GeoMTS), ADR-012 (share ≠ link; discoverable), ADR-014 (PHI-safe AI chat), ADR-016 (paired sample/importer repos), ADR-017 (Samples sandbox), ADR-018 (no project notebook registry), ADR-022 (run.sh / Update vs Full)
**References:**
- MVP D-09, D-12, D-13, D-26, D-27
- [guide/ai-chat.md](../guide/ai-chat.md)
- [guide/sample-packages.md](../guide/sample-packages.md)

---

## Context

Team admins need to load **their own** CSV (or similar) files into a writable catalog dataset, then re-run **Update** (append) and **Full** (replace) later — the same modes first-party sample importers already expose via `POST /datasets/:id/import/csv-batch` and `run.sh`.

That path exists today only for **published** vendor samples ([ADR-016](ADR-016-paired-sample-importer-repos.md) Fitbit / ICDE pairs) and for researchers who already know how to adapt those repos. There is no in-app CSV ingest UI (D-09 still Todo). PHI-safe chat’s Import mode can explain mapping, but it must not read local files and must not take raw rows ([ADR-014](ADR-014-ai-assistant-claude.md)).

ADR-016 rejected a consolidated **vendor-parser** catalog (`w4h-ingest` as a device abstraction layer) because export shapes differ too much. That rejection still holds for *parsers*. It does not block:

1. An **app-owned file chooser** that samples files in the browser
2. A **PHI-obscured profile** sent to Claude so it can propose a GeoMTS mapping spec
3. A **generic csv-batch client** parameterized by that spec (same API as the samples)
4. A **downloadable runnable package** (notebook + CLI + `run.sh`) so a human can fix the mapping when the UI/assistant gets it wrong

W4H still does not register project notebooks ([ADR-018](ADR-018-contributions-catalog.md)). The package is an artifact the researcher **keeps** (download / their git), not a `w4h.contributions` row and not an `.ipynb` blob in the database.

## Decision

### 1. App samples files; Claude never sees the filesystem

The ingest assistant lives in the **app** (dataset overview / ingest dialog), not as an LLM tool with file access.

- Browser `<input type="file" multiple>` (and/or directory). Files stay in the page’s `File` list.
- JS builds a **file profile** per file: name, size, encoding/delimiter guess, header names, inferred types, approximate row count, cheap structural hints (column looks like time / id / lat-lon).
- A few **preview rows** are parsed **in the browser** for the user and for obscuring (below). Whole files are never uploaded to Anthropic. Ingest of the full file uses `csv-batch` (browser chunks while the `File` is still in memory, or the generated CLI later).

Same ingest ACL as today: Team admin or project owner on a writable dataset; read-only sample datasets reject all API ingest ([ADR-017](ADR-017-community-package-registry.md)). Ingest is **the PI’s own team catalog**, not a publish.

### 1a. Private to the PI’s project until they submit

The primary actor is a **physician PI** (UI: **Admin** — Team admin / project owner). They load files into a dataset **linked to their project**. That is trial work, not a community contribution.

Until the PI explicitly **submits packages to Super admin**, ingest must not:

| Action | Default |
|---|---|
| **Share** the dataset to another team ([ADR-012](ADR-012-project-dataset-linking.md)) | Off — no `dataset_shares` row |
| Appear in other teams’ **Others** catalog | Off — `discoverable = false` for datasets loaded (or created) via **Import files…**, even though generic catalog create today defaults Discoverable **on** (D-23). Own-team members still see **Mine**. |
| Insert `w4h.contributions` rows | Off |
| Seed **W4H Samples** canonical tables ([ADR-017](ADR-017-community-package-registry.md)) | Off |
| Copy rows into git or a public sample repo | Off — live tables stay in the team’s isolation schema |

Own **project members** (Admin / User on that project) keep their existing access to the linked dataset. That is the trial team, not “sharing with others.”

**Submit to Super admin** is a later, deliberate step (not built with first ingest). The PI sends two packages for **curation**, not a live dump of the project’s PHI:

1. **Importer package** — the downloaded runnable instance (`manifest.yaml` + notebook + CLI), edited if needed
2. **Data package** — a **synthetic or de-identified sample** that exercises that importer (ADR-016 sample repo shape). Super admin does **not** receive automatic access to the live project dataset.

Super admin then may catalog the pair (`w4h-sample-<vendor>-<format>` + `-importer`), optionally seed Samples. That is verification. It is **not** the same as **Share** to another research team (still a separate PI decision).

If the PI only wants another lab to query the live dataset, they use Share — still explicit, still not this ingest path.

### 2. PHI is obscured in the app before any Claude turn

Import mode may receive a **structured, app-built profile**, not raw wearable rows. The app redacts preview cells **before** they enter the chat payload (and the existing strict-mode scanner still runs as defense in depth).

Obscure at least:

| Class | Treatment in the profile sent to Claude |
|---|---|
| Subject / participant-like columns | Stable per-session token (e.g. `id_a3f1`), not the source value |
| GPS / high-precision coordinates | Presence + rough type only, or heavily coarsened; not full tracks |
| Emails, MRNs, long digit runs | Dropped or replaced with a type placeholder |
| Timestamps | Shape/format examples (`YYYY-MM-DD`, `HH:MM:SS`) rather than a real subject’s timeline when feasible |

**Keep:** file names, sizes, headers, inferred types, delimiter, signal-count / null-rate hints that do not include identifiers.

Unobscured cells may stay on screen for the human confirming the mapping. They must not be in the Anthropic request. Permissive mode does not skip this step for ingest profiles.

### 3. Three artifacts — do not mix them with Contributions verification

| Artifact | Who creates it | Catalog (`w4h.contributions`)? | When |
|---|---|---|---|
| **Scaffold template** (`w4h-ingest`) | Platform / first-party git repo: generic csv-batch client + notebook + CLI + `run.sh` | **Optional, once** — Super admin may list the *engine* so people can find it. It is not required for the App ingest path. | Built with the feature, like other first-party tools |
| **Mapping spec** | Ingest assistant session (Claude proposes, user confirms) | **Never** | During Import on a dataset |
| **Runnable instance** (zip / folder) | **Assembled in the App at download time** (scaffold copy + filled `manifest.yaml` + dataset id). Lands in the user’s Downloads / their git. | **Never** — unverified, study-specific | After confirm (even if ingest then fails) |

Contributions registration is a **verification** step ([ADR-018](ADR-018-contributions-catalog.md) Super-admin curation; [ADR-022](ADR-022-in-app-contribution-run-trigger.md) `runnable`). This workflow happens **before** that. Auto-inserting a catalog row for every study dump would either skip verification or block ingest until Super admin reviewed it — both wrong.

A cleaned, reusable vendor export may **later** be published as an ADR-016 pair (`w4h-sample-<vendor>-<format>` + `-importer`). That is the PI’s **submit to Super admin** step (§1a), after the mapping has been proven on their private project — not a gate on first ingest.

### 4. How the App uses it (no contribution run)

The App is the csv-batch client for this workflow. It does **not** call `POST /contributions/:slug/run` and does not clone a generated repo.

1. Team admin / project owner opens a **writable** dataset → **Import files…** (distinct from **Run import…**, which remains sample-contribution only).
2. File chooser → obscured profile → Import-mode chat proposes spec → user confirms.
3. Persist the confirmed spec on **that dataset** (file→signal binding + mapping; `w4h.tables` still receives mapping at ingest). Re-runs do not need Claude.
4. **Load** while files are still in the chooser: the App chunks `File` objects to `POST /datasets/:id/import/csv-batch` (same payload as sample importers). Modes **Update** / **Full** as D-33.
5. **Download package**: the App zips the first-party scaffold + this dataset’s `manifest.yaml` (and README with dataset id). That zip is the editable fallback and the cron path. It is not uploaded back into W4H and is not a Contribution.

**Re-import in the App:** choose files again; the App applies the **saved dataset spec**. If the spec is wrong, download (or re-download) the package, edit `manifest.yaml` / notebook locally, run the CLI against the same dataset id, then optionally paste the corrected YAML back into the dataset spec UI.

**Not in the App:** cron, and any run that needs a directory on disk the browser no longer holds. Those use the downloaded CLI/`run.sh` with `W4H_API_KEY` in local `.env` ([ADR-007](ADR-007-authentication-model.md)).

### 5. Package contents (instance)

Claude proposes an ADR-016-shaped **`manifest.yaml`**: `table_prefix` / vendor slug, per-file `signals[]` (`slug`, `file`, `columns`, `geomts_mapping`, `sampling_interval`, `dedupe_columns`).

| Piece | Role |
|---|---|
| `manifest.yaml` | Mapping spec (this dataset’s files) |
| Notebook | Load manifest, chunk CSVs from a local data dir, `POST .../import/csv-batch` |
| CLI + `run.sh` | Cron / **Update** (`append`) / **Full** (`replace`) |
| README / `.env.example` | Dataset id, API base, data-dir convention; no secrets |

Fill the generic scaffold with YAML; do not generate a unique Python importer per study. If the CSV is too irregular, edit the notebook or fork the scaffold **locally**.

### 6. Execute with the sample-importer method

Ingest is `POST /datasets/:id/import/csv-batch` with `signal`, `table_prefix`, `columns`, `mapping`, `mode`, `dedupe_columns`, `rows`. Physical tables and `w4h.tables` registration stay as they are (ADR-003 / ADR-008). Modes match ADR-022 / D-33: **Update** = append; **Full** = replace (dependents check + audit when replacing a loaded dataset).

In-app **Run import…** stays for **catalog-curated** `runnable` sample importers that clone git data repos. The ingest assistant is a separate control on the same dataset pane.

### 7. Amendment to ADR-016

ADR-016’s rejected alternative was a **consolidated vendor-parser catalog**. This ADR does not add device drivers. It adds a **mapping assistant + generic csv-batch client + generated package**. First-party Fitbit / ICDE **paired repos** remain the model for published samples.

## Consequences

**Positive:** Private datasets get the same ingest contract as samples (API, mapping registry, Update/Full, CLI). Claude never needs filesystem access. When the assistant is wrong, the researcher has a notebook they can edit instead of a dead-end UI. ADR-018’s “no project notebook registry” is unchanged.

**Negative / risks:** Obscuring is heuristic (same class of caveat as ADR-014). Generated YAML can be wrong; the package is the mitigation. Browser ingest cannot satisfy cron (files are not retained). A generic reader will not cover every vendor quirk — those become local scaffold edits or a later ADR-016 pair. Two ingest buttons on the dataset pane (**Import files…** vs **Run import…**) must stay visually distinct so PIs do not think an unverified zip is a catalog contribution.

## Alternatives not chosen

- **Claude reads local files / raw rows** — rejected; PHI egress and no filesystem in the browser sandbox.
- **UI-only ingest, no package** — rejected; leaves no editable fallback when mapping or parsing fails.
- **New ICDE-style git pair for every study dump** — rejected as the default; too heavy, and private data should not be a public sample repo.
- **Store generated `.ipynb` on the project** — rejected (ADR-018).
- **Vendor parser framework / ingest catalog of drivers** — still rejected (ADR-016).
- **In-app Run import… against arbitrary local paths** — rejected; the API host cannot see the researcher’s disk. CLI/notebook on the machine that has the files.
- **Register each generated package as a Contribution so the App can run it** — rejected; catalog = Super-admin verification (ADR-018 / ADR-022). This workflow is unverified first ingest. The App posts `csv-batch` itself; the zip is a local fallback.
- **Require the `w4h-ingest` scaffold to be cataloged before anyone can import** — rejected as a gate. Cataloging the engine is optional discoverability. The App path only needs `csv-batch` + a dataset spec.
- **Ingest implies catalog publish or dataset share** — rejected. PI ingest is team-private until they submit packages to Super admin (§1a) or separately Share (ADR-012).

## Changelog

| Date | Change |
|------|--------|
| 2026-08-25 | Initial draft. |
| 2026-08-25 | Split **scaffold template** (optional one-time catalog) vs **dataset spec** vs **downloaded instance** (never a Contribution). App ingest is `csv-batch` from the chooser + saved spec (**Import files…**), not `POST /contributions/:slug/run`. Catalog registration stays a later, optional verification step. |
| 2026-08-25 | **PI private until submit:** ingest stays on the owning team/project (no share, Discoverable off, no catalog row, no Samples seed). Super admin later receives an importer package plus a synthetic/de-identified **sample** data package — not automatic access to live PHI. Distinct from ADR-012 Share. |

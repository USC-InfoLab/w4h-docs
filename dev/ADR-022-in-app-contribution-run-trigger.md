---
title: "ADR-022 — In-app run trigger for runnable catalog contributions"
description: A button in the app may trigger one catalog-curated, Super-admin-vetted contribution's standardized entrypoint on a project member's behalf — narrower than the project-notebook registry ADR-018 rejected.
updated_by: nocera@usc.edu
updated_at: 2026-08-23T00:00:00.000Z
---

**Status:** Draft
**Date:** 2026-08-20
**Relates to:** ADR-006 (TRE), ADR-007 (authentication model), ADR-011 (HIPAA audit logging), ADR-015 (Docker notebooks service), ADR-018 (contributions catalog), ADR-023 (SQL analytics contributions)
**References:**
- MVP D-14, D-22, D-25, D-31, D-33

---

## Context

A physician PI (or other non-technical project user) wants to run the sample-data importer from a button in the app, instead of opening Jupyter and running cells by hand.

ADR-018 dropped `w4h.project_notebooks` and the `launch_notebook` ACL permission, reasoning that "W4H is not in the business of managing people's notebooks." That decision is scoped to **researcher-owned, unversioned, per-project notebooks** — including a researcher's own adaptation of a community notebook to their data (e.g. editing a YAML signal mapping because a CSV export doesn't match the sample manifest). It does not address executing a **platform-curated catalog contribution** (`w4h.contributions`) that ships an already-hardened, non-interactive entrypoint — the Super admin already vets these rows, and ADR-015 already has the `notebooks` Docker service preload one. The one line that actually bites is in ADR-015: the `notebooks` service is framed as "not managed infrastructure the platform operates on the researcher's behalf." A "click to run" button is exactly that, for exactly one blessed contribution, so it needs a narrow amendment there — not a reversal of ADR-018.

## Decision

### 1. Standardized `run.sh` entrypoint per contribution repo

A contribution that wants to be triggerable ships a `run.sh` at its repo root (first instance: `w4h-sample-fitbit-csv-importer`). Its contract:

- If `W4H_API_KEY` (and `W4H_API_BASE`) are already set in the environment, run non-interactively against them (service mode).
- If not set and attached to a TTY, prompt for them and optionally save to a local `.env`.
- If not set and not a TTY, fail fast naming the required env vars.
- Bootstraps a local Python virtualenv and installs the package, then execs the contribution's existing CLI. It adds no new import/ingest logic — only credential and environment wiring around a CLI that already exists.

The same script serves a human running it manually, and `w4h-api` triggering it on a user's behalf — one entrypoint, not two implementations to keep in sync.

### 2. `runnable` is an explicit, Super-admin-curated flag

`w4h.contributions.runnable boolean NOT NULL DEFAULT false`. Most catalog rows stay `false` (docs/link-out only, ADR-018's existing behavior, unchanged). First-party CSV importers (`w4h-sample-fitbit-csv-importer`, `w4h-sample-icde-demo-csv-importer`) and the SQL job `w4h-sql-compute-mets` are seeded `runnable = true`. This keeps the feature a narrow, opt-in, Super-admin-curated capability, not a generic "run any notebook" surface.

### 3. No new authorization layer — the existing ingest ACL already governs this

`run.sh` is just another authenticated API client: it calls `POST /datasets/:id/import/csv-batch`, which `assertCanIngestDataset` (`w4h-api/lib/ingest-csv.js`) already gates (**team_admin** on the owning team, **project owner**, or team-admin fallback per D-12 — **not** Super admin; **read-only** datasets blocked for everyone). This is true whether a human runs the script, or `w4h-api` runs it on the user's behalf using that same user's own API key (resolved server-side via the existing key-reveal/issue path, never rotating a key the user already has). The new `POST /contributions/:slug/run` route therefore requires authentication only — it does not duplicate the ingest ACL, and a user without ingest rights simply gets a `403` surfaced in the run's log, the same as if they'd called the ingest endpoint directly.

### 4. Two ways `w4h-api` can execute `run.sh` — only one built now

- **Built now:** `w4h-api` spawns `run.sh` directly as a subprocess on its own host (no Docker involved). In-app, this is a **"Run import…"** control in the **Dataset overview** pane: select a linked, writable dataset first, then open a contextual dialog scoped to that dataset. On a **first load** (empty dataset), the dialog offers a **Sample / importer** picker (e.g. Fitbit CSV vs ICDE demo CSV). The run always writes into **that catalog row’s own schema** — it is a copy, not an in-place update of a sibling that already has the sample. If another writable dataset already has that sample, the dialog’s primary action is **Link … instead**. Unlinking an empty catalog row archives it so it does not linger under Add existing; unlinking a loaded row keeps it in the team catalog (re-linkable). **Update** / **Full** mode only appear when the target already has tables; **Full** truncates tables in *this* dataset only. On **re-runs** (dataset already has data), the importer is inferred from the dataset name when possible and mode defaults to **Update**. The dialog also shows the equivalent `W4H_DATASET_ID=<id> ./run.sh import --mode <append|replace>` command and links to that contribution's setup docs.
- **Import mode (D-33):** the dialog offers **Update** (`--mode append` — adds missing rows/tables, never truncates, safe to re-run; default when the dataset already has data) and **Full** (`--mode replace` — truncates and reloads every signal table from source; default on an empty dataset). Choosing **Full** against a dataset that already has data triggers a dependents check (`GET /datasets/:id/dependents`): other **linked projects** (`project_datasets`, excluding the current one) and **active shares** (`dataset_shares`). If either is non-empty, the dialog names them and requires an explicit confirmation checkbox before the button enables; if neither is non-empty, it runs with only an informational note. This is **not** a Super-admin gate — Team admin/project owner authority is unchanged (§3) — the friction is about blast radius (does this replace data someone else is relying on), not about who is allowed to press the button. The dependents check does not (and currently cannot) look at derived datasets or model runs — there is no lineage table for those yet (MVP D-05, M-02 are still `🚩 Todo`); this is a known gap, not an oversight.
- **Audit trail:** every run start writes an append-only `w4h.audit_log` row (`dataset.import.update` or `dataset.import.full_reimport`, `resource_type: 'dataset'`, `details: { contribution_slug, run_id, mode }`) — independent of `w4h.contribution_runs`, which is mutated in place as the run progresses and is not itself an audit record. Even though a full re-import truncates the dataset's own tables, the fact that it happened, who triggered it, and when is retained forever per ADR-010/ADR-011.
- Before spawning, `w4h-api` now **ensures the contribution's repo (and, by the ADR-016 paired-slug naming convention, its data repo) is cloned next to it if missing, and best-effort fast-forwards it (`git pull --ff-only`) if already present** — never a forced/destructive update, since the sibling checkout may be someone's own working copy. This closes a real gap: the first build assumed the sibling checkout already existed and 500'd otherwise.
- On success, the run's target dataset is re-fetched (`GET /projects/:id`) without a full page reload, so table/observation counts and the "Loaded" badge update immediately. Fixed a related bug found while wiring this up: `hydrateDatasetSummaries` (`w4h-api/routes/projects.js`) resolved a registered table's physical presence from `w4h.tables.name` assuming a `public.<name>` location, but ingested tables are schema-qualified (`w4h.tables.physical_schema`/`physical_table`, e.g. `ds_sample_dataset.fitbit_subjects`) — so `physical_table_count` silently stayed `0` and the dataset looked stuck on "Needs ingest" even after a successful import. Now resolves `physical_schema.physical_table` first.
- **Designed, not yet built (tracked as MVP D-31):** in the Docker distribution, `api`'s image has no Python (ADR-015), so it cannot run `run.sh` itself; it will need to delegate over the internal Compose network to the existing `notebooks` container, which already has Python, git, and connectivity to `api`. Generalizing this to catalog rows beyond the seeded importer means a runtime `git clone <repo_url>@<repo_ref>` inside `notebooks`, which is a new GitHub-egress requirement for that container worth calling out explicitly when it's built, not assumed.

### 5. Amendment to ADR-015

ADR-015 frames the `notebooks` service as "not managed infrastructure the platform operates on the researcher's behalf." This ADR carves a narrow, explicit exception: `w4h-api` may trigger **one catalog-curated, `runnable = true` contribution's standardized entrypoint**, gated entirely by the existing dataset-ingest ACL, on a project member's behalf. This is distinct from, and does not reopen, either (a) the arbitrary per-project notebook registry ADR-018 rejected, or (b) centrally administered multi-tenant JupyterHub orchestration, which remains TRE territory per ADR-006.

### 6. Considered, deferred

- **A local/enclave client** (e.g. an Electron wrapper of the same `w4h-app` build, with the Run button's execution target made pluggable between the server-side route and a local IPC-driven `run.sh`) is real and buildable, but only actually needed where server-side execution can't happen at all — no runner deployed, or an enclave/TRE deployment where the platform isn't allowed to operate execution infrastructure on the researcher's behalf. A PWA install of the existing app buys nothing here: an installed PWA is still a browser-sandboxed page with no filesystem/subprocess access, so it can only call the same API a plain browser tab already calls — it is not a substitute for a genuine desktop shell. Not built; captured for when a concrete no-server-runner or enclave need shows up.
- **Enclave (TRE) support** — not attempted. Per ADR-007, TRE access is already "via a managed notebook session inside the TRE," with MFA enforced at IdP login and the session credential injected automatically — TRE already solves credential injection for this exact problem, without an API key or `run.sh` at all. TRE packaging remains "not planned" (ADR-006, ADR-015). If TRE support is ever wanted, it means teaching `run.sh` to also accept a TRE-injected session credential — separate, TRE-scoped work.
- **2FA** is not a blocker for this feature in Flexible mode either way: web login has no MFA for MVP (ADR-007), and the API key `run.sh` authenticates with is a separate, longer-lived credential not gated by a live MFA session.

### 7. SQL contributions share the run entry point (ADR-023)

`run.sh` stays the trigger for **Python/CLI importers** (subprocess). SQL jobs (`kind: sql`, `runnable = true`) use the **same** `POST /contributions/:slug/run` route with body `{ dataset_id }`; `contribution-runner.js` calls `runSqlContribution()` in-process instead of spawning `run.sh`. Notebooks may also call `POST /datasets/:id/contributions/:slug/sql` directly for a sync result — same engine, not a separate execute model. Do not collapse importer subprocess logic with SQL bind/execute, but do not invent a third in-app run surface either.

## Consequences

**Positive:**
- A non-technical project user can populate the sample dataset without opening Jupyter or a terminal.
- The manual (`./run.sh`), in-app (button), and future desktop-client paths share one script and one credential model — no divergent reimplementations to keep in sync.
- No new authorization surface: the feature inherits exactly the dataset-ingest ACL that already governs who may cause a write, so it cannot grant access the platform didn't already grant.
- The `runnable` flag keeps this narrow and reversible — a Super admin can flip it off per contribution without a deploy.

**Negative / risks:**
- `w4h-api` gains a `child_process.spawn` surface for the first time; the spawned command is fixed to a path derived from a Super-admin-curated slug, not user input, which bounds the risk, but it's still new attack surface worth revisiting before the Docker/runtime-clone variant (which does take a repo URL from the catalog) is built.
- The Docker-hosted variant (D-31) is designed but not built; until it lands, the in-app button only works where `w4h-api` runs directly on a host with Python (Modality B1), not in the packaged Docker distribution. `w4h-docker/api/Dockerfile` builds `api` from plain `node:22` — no Python, no sibling contribution checkout — so this isn't a config toggle; it needs either Python + a baked-in contribution repo added to the `api` image, or the `notebooks`-delegation build described above. Deliberately out of scope for the Aug 21 demo, which runs dev/local only.

## Alternatives not chosen

- **Server-side execution only, no shared `run.sh` convention** — rejected; would mean reimplementing credential handling and bootstrap logic separately for the manual and in-app paths, with no single place to fix or audit it.
- **Generic "run any catalog contribution" with no curation step** — rejected; `runnable` defaults to `false` and is Super-admin-set per row, keeping this an opt-in, one-contribution-at-a-time capability rather than reopening ADR-018's rejected general notebook-launch surface.
- **Building the Electron/local client now** — rejected for this effort; no concrete no-server-runner or enclave need exists yet, and the design is unchanged whether built now or later.
- **Reversing ADR-018 §1** — rejected; the researcher-owned `project_notebooks` registry stays dropped. This ADR only concerns platform-curated catalog rows.

## Changelog

| Date | Change |
|---|---|
| 2026-08-25 | First-load **Run import…** is a copy into the selected catalog row’s schema, not a full update of a sibling that already has the sample. Hide **Update**/**Full** on empty targets; **Link … instead** is the primary action. Unlinking an **empty** catalog row archives it so it does not linger under Add existing; unlinking a **loaded** row keeps it re-linkable. |
| 2026-08-25 | **Run import…** moved into the **Dataset overview** pane. First load shows a **Sample / importer** picker (Fitbit vs ICDE); re-runs on loaded datasets infer the prior importer from the dataset name when possible. **Full** default on empty datasets; **Update** on loaded. Renamed **Full re-import** → **Full**. Seeded ICDE importer as `runnable`. |
| 2026-08-23 | SQL analytics contributions ([ADR-023](ADR-023-sql-analytics-contributions.md)) execute in-process via the API, not via this ADR’s `run.sh`. `run.sh` remains the Python/CLI importer trigger. The two execute models stay separate. |
| 2026-08-20 | **D-33:** Run import dialog now offers datasets that already have data, not just empty ones, with an explicit **Update** (`--mode append`, default) vs **Full re-import** (`--mode replace`) choice — both already supported by the importer CLI and forwarded by `run.sh`, only `w4h-api`'s spawn call and the dialog were hardcoded to replace-on-empty-only. Full re-import against a non-empty dataset runs a new `GET /datasets/:id/dependents` check (other linked projects, active shares) and requires confirmation if any exist; otherwise it proceeds with just a note. No new authorization gate — same Team admin/project-owner ACL as §3, still no Super admin approval required. Every run start now writes a `w4h.audit_log` row (`dataset.import.update` / `dataset.import.full_reimport`) independent of the mutable `contribution_runs` status row, so the decision to fully re-import is retained even though the dataset's own tables get truncated. |
| 2026-08-20 | Replaced the single "Run" button with a **"Run import…" dialog**: pick which `runnable` contribution and which dataset (grouped "already in this project" vs "from team catalog"), with in-dialog `run.sh` instructions that reflect the current picks. `w4h-api` now clones/fast-forwards a contribution's repo (and its ADR-016-paired data repo) on demand instead of 500ing if the sibling checkout is missing — never a forced update, to avoid clobbering a developer's own working copy. A successful run now refreshes the dataset's stats in place (no page reload); fixed a `physical_table_count` bug (`w4h-api/routes/projects.js`) that resolved registered tables against `public.<name>` instead of their real `physical_schema.physical_table`, so ingested datasets kept showing "Needs ingest" after a successful import. |
| 2026-08-20 | Fixed a bug where `getContribution`'s column selection never read back `runnable`, so every run request 400'd regardless of the seeded flag. Generalized the in-app button off the single hardcoded fitbit slug/dataset pair to any `runnable` contribution against any dataset a Team admin/project owner manages. Added an in-app "Prefer the command line?" disclosure pointing at the contribution's own `run.sh` docs. Confirmed Docker execution needs real work (not a toggle) — deferred past the Aug 21 demo, which stays dev/local only. |
| 2026-08-20 | Initial draft, alongside the Modality B1 in-app trigger build. |

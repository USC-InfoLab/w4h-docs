---
title: Architecture
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-05T01:23:50.000Z
sort_order: 2
---
**Version:** 1.0  
**Status:** Draft  
**Last updated:** 2026-07-04

---

## Overview

W4H is a multi-tenant clinical trials platform backed by a single PostgreSQL database. Each trial is isolated at the schema level, providing hard regulatory boundaries while allowing controlled cross-trial data sharing and a shared application layer.

For the rationale behind each major decision, see the [ADR index](adr/README.md).

---

## Database structure

One database (`w4h`) contains three tiers of schemas.

| Schema | Purpose | Who can access |
|---|---|---|
| `w4h_app` | Shared platform layer: users, roles, trial registry, app docs, audit log | All authenticated users (scoped by role) |
| `trial_<id>` _(one per trial)_ | Trial-specific data: subjects, datasets, wearable tables, trial docs, annotations | Users assigned to that trial only |
| `w4h_global` | Cross-trial analytics: explicitly shared datasets only | Trial roles granted access by a PM |

### w4h_app — shared application schema

Platform-wide tables that are not trial-specific:

- `users` — all platform accounts with role assignment
- `trial_registry` — one row per trial; records schema name, status, created_by
- `app_docs` — platform-level documentation
- `audit_log` — append-only HIPAA audit ledger: API/notebook PHI access, super-admin activity, auth and ACL-boundary events (see ADR-011)
- `sharing_requests` — workflow table for dataset sharing approvals

### trial_\<id\> — per-trial schemas

Created automatically when a trial is registered. Every trial schema has the same table structure:

- `subjects` — enrolled participants
- `datasets` — named collections of signal tables, with a `schema_def` (JSONB) and status
- `dataset_tables` — manifest of physical tables belonging to each dataset
- `wearable_data tables` — one table per signal type per dataset (e.g. `ds42_heart_rate`, `ds42_accelerometer`)
- `trial_docs` — trial-specific documentation
- `annotations` — researcher notes attached to subjects or time ranges

> **Note:** Signal tables use TimescaleDB hypertables partitioned on `(subject_id, ts)` for time-series performance at scale.

### w4h_global — cross-trial analytics schema

No data flows here automatically. A project manager explicitly publishes a dataset by creating a scoped view and granting access to a specific trial role. Trial B never sees data shared between trial A and trial C.

- `shared_datasets` — sharing agreement rows (`source_trial`, `target_trial`, `dataset_id`, `shared_by`, `granted_at`)
- Views — one view per signal table in the shared dataset, e.g. `trial_a_ds42_heart_rate`
- Grants — issued per view, per target trial role only

---

## Dataset model

A dataset is a named namespace inside a trial schema. It contains one or more typed signal tables, registered in the `dataset_tables` manifest.

| Concept | Implementation |
|---|---|
| Dataset | Row in `trial_<id>.datasets` with `id`, `name`, `schema_def` (JSONB), `status` |
| Signal table | Physical table: `trial_<id>.ds<dataset_id>_<signal_type>` |
| Table manifest | Rows in `trial_<id>.dataset_tables`: `dataset_id`, `table_name`, `signal_type`, `columns_def` |
| Sharing unit | A dataset (all its signal tables) shared as a set of views in `w4h_global` |

Example signal tables for dataset 42 in trial A:

```
trial_a.ds42_heart_rate      (subject_id, ts, bpm)
trial_a.ds42_accelerometer   (subject_id, ts, x, y, z)
trial_a.ds42_sleep_stages    (subject_id, ts, stage)
```

---

## Dataset sharing

Sharing is explicit, bilateral, and auditable. One team's dataset can be shared with one specific other team — no broadcast sharing. **Share ≠ co-owned project** ([ADR-012](ADR-012-project-dataset-linking.md)).

### Sharing flow (MVP default — push)

1. Team admin A opens a dataset **owned by Team A** and chooses Share → Team B (or a specific Team B project)
2. The platform records `dataset_shares` / `shared_datasets` and the privileged DB role executes DDL: views in `w4h_global` + `GRANT` to Team B's role ([ADR-002](ADR-002-cross-trial-sharing.md))
3. The grant is recorded in `w4h_app.audit_log` ([ADR-011](ADR-011-hipaa-audit-logging.md))
4. Team B's catalog shows the dataset as **"Shared by Team A"**; Team admin B may **link** it to a Team B project
5. If Team A links that inbound share (after a reciprocal share the other way) or Team B's data was shared *to* A, A's project that uses both remains **visible only to Team A**

Optional pull path: Team B submits `sharing_requests`; Team A's admin or a Super admin approves — same end state.

### Project–dataset linking (within and after share)

- Same-team multi-dataset modeling: Team admin links many owned datasets to one project via `project_datasets` (no Super admin required).
- Cross-team: share first, then link on the **recipient** (or on the team that received the share).
- MVP: no cross-team project membership — collaborators who need one workspace must be on the same team.

### Sharing agreement table

```sql
CREATE TABLE IF NOT EXISTS w4h.dataset_shares (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id        text NOT NULL REFERENCES w4h.datasets(id) ON DELETE CASCADE,
  target_team_id    uuid NOT NULL REFERENCES w4h.teams(id) ON DELETE CASCADE,
  target_project_id uuid REFERENCES w4h.projects(id) ON DELETE CASCADE,
  access_type       text NOT NULL DEFAULT 'read' CHECK (access_type IN ('read', 'read_write')),
  shared_by         integer REFERENCES w4h.users(id) ON DELETE SET NULL,
  shared_at         timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_dataset_team_project_share
    UNIQUE (dataset_id, target_team_id, target_project_id)
);

CREATE INDEX IF NOT EXISTS idx_dataset_shares_lookup
  ON w4h.dataset_shares (dataset_id, target_team_id);
```

A share can be team-wide (`target_project_id` is NULL — any project in the target team can link it) or project-specific (`target_project_id` set — only that project can link it). Default access is `read`; `read_write` must be explicitly granted.

### Revocation

- Owning Team admin or Super admin can revoke sharing
- Revocation drops the view(s) and revokes the grant
- Revocation is logged in `audit_log` with revoker identity and timestamp

> **Note:** Creating views and issuing `GRANT`s requires a privileged platform DB role (`w4h_platform`) separate from the per-trial application roles. The application backend runs these DDL operations on behalf of admins.

---

## Access control (ACL)

Layered model (ADR-004): **platform role** → **team membership role** → **project membership role** → optional **resource ACL**.

Team admin is **per team** (`team_members.role`), not a single global user flag — the same account may be Team admin on one team and `member` on another (dual-hat).

### Role summary

| Role | Scope | Key permissions |
|---|---|---|
| Super admin | Platform-wide (`users.role`) | Platform Admin shell only: bootstrap teams/users, audit, settings. Does **not** configure individual trials day-to-day |
| Project admin | Per team (`team_members.role = team_admin`) and/or per project (`project_members.role = owner`) | App shell: create teams/projects/datasets, manage members, shares |
| User | Per team (`team_members.role = member`); per project (`editor`, legacy `viewer`) | Participate in assigned projects |

**Ingest without Team admin** (e.g. PI delegates ETL to a student) is a finer-grained **capability/ACL** grant (MVP D-22), not a third team membership role.

### Super admin

- Create and delete trial schemas (triggers DDL automation)
- Manage all users across all trials — create, deactivate, assign memberships
- Approve or revoke any dataset sharing request
- Access `w4h_global` for cross-trial analytics
- Read and export the audit log
- Access all trial schemas for support and compliance purposes
- Promote a user to Super admin

### Team admin (per team)

- Create and manage projects within that team
- Load datasets into the trial schema (initiates signal table creation)
- Assign datasets to projects
- Add and remove members; set team membership role on that team
- Set project-level permissions for users (read, annotate)
- Submit dataset sharing requests to another trial **or** push shares to another team (MVP default — ADR-002 / ADR-012)
- Approve incoming sharing requests from other trials (for their own datasets)
- View that team's audit log entries
- Cannot exercise Team admin powers on teams where they are only `member`
- Cannot access other trials' schemas or `w4h_global` unless a sharing grant exists

### Member / project participant

- Read wearable data for datasets assigned to their project
- Read and write annotations on subjects within their project (membership permitting)
- Read trial docs and project docs
- Cannot load/create datasets (unless granted a future ingest capability), create projects, or manage team users
- Cannot access datasets not assigned to their project
- Cannot access `w4h_global` unless explicitly granted via sharing

### PostgreSQL role mapping

| App role | DB role | Schema access |
|---|---|---|
| Super admin | `w4h_superadmin` | All schemas — full privileges |
| Team admin (trial A) | `trial_a_admin` | `w4h_app` (read/write own rows), `trial_a` (full), `w4h_global` (read if granted) |
| Member / project user (trial A) | `trial_a_role` | `w4h_app` (read own profile), `trial_a` (SELECT on assigned datasets only), `w4h_global` (read if granted) |
| Platform DDL executor | `w4h_platform` | All schemas — CREATE, GRANT, REVOKE (used only by backend for DDL operations) |

---

## Deployment modes

W4H supports two deployment modes chosen at deployment time. The platform code is identical — the mode governs how data access and compute are permitted. See [ADR-006](adr/ADR-006-trusted-research-environment.md).

### Flexible mode (default for MVP)

For academic research groups, CTSI-affiliated labs, and early-stage deployments. Researchers use personal API keys to query the data API from their own compute — local notebooks, HPC clusters, cloud GPU instances. No managed notebook infrastructure required. The platform enforces project-membership ACL and logs every access; the institution owns the data handling policy beyond the API.

### TRE mode (post-MVP, regulated deployments)

For hospital systems and large research networks with identifiable PHI. All compute runs inside a managed TRE boundary — JupyterHub spawns per-user notebook servers, raw data never leaves the environment, and results pass through an egress review before download. Researchers authenticate via JWT from an institutional IdP with MFA enforced.

| | Flexible | TRE |
|---|---|---|
| Authentication | Personal API key | JWT from IdP + MFA |
| Data leaves platform | Yes — to caller's machine | Never |
| Notebook environment | Researcher's own | Managed JupyterHub inside TRE |
| GPU modeling | Anywhere | Inside TRE or approved export |
| Operational complexity | Low | High |
| UK Biobank / All of Us alignment | No | Yes |

---

## Authentication model

Authentication is mode-dependent. See [ADR-007](adr/ADR-007-authentication-model.md).

### Flexible mode — personal API key

Researchers generate a personal API key from the W4H UI after login. The key is tied to their account, scoped to their project memberships, read-only, and immediately revoked when the user is discontinued.

```python
import w4h
session = w4h.connect(api_key=os.environ["W4H_API_KEY"])
df = session.query("SELECT subject_id, ts, bpm FROM ds42_heart_rate")
# Works from local laptop, HPC, or cloud GPU instance
```

### TRE mode — JWT from IdP

JWT issued after MFA is injected into JupyterHub automatically — researchers manage no credential. 15-minute idle timeout enforced.

### Service accounts — both modes

Spark jobs and unattended pipelines use service account keys in both modes: IP-restricted, dataset-scoped, 90-day maximum expiry, named human owner.

### Credential summary

| Mode | Principal | Credential | MFA | Expiry | Scope |
|---|---|---|---|---|---|
| Flexible | Researcher | Personal API key | No — ACL + audit log | Configurable TTL | Assigned project datasets, read-only |
| TRE | Any user | JWT from IdP | Yes — enforced | 1–8h, 15min idle | Role-scoped |
| Both | Automated workload | Service account key | No — IP-restricted | 90 days max | Named datasets only |

---

## Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Isolation model | Schema per trial | Hard regulatory boundaries; schema-level GRANT/REVOKE; clean per-trial audit; simple backup/archive per trial |
| Cross-trial sharing | Explicit views + targeted GRANTs in `w4h_global` | No automatic data leakage; full audit trail; bilateral and revocable |
| Dataset tables | One physical table per signal type | Native indexes, TimescaleDB hypertables, typed columns — required for time-series performance at scale |
| Migrations | Loop over `trial_*` schemas | Enumerate from `information_schema.schemata`; tools like Flyway support multi-schema migration |
| Connection pooling | PgBouncer, transaction mode | `search_path` set per transaction, not per connection — safe for pooled connections across trials |
| Access model | TRE — compute inside, no raw data export | Satisfies HIPAA technical safeguards; aligns with UK Biobank / All of Us standards |
| Human auth | IdP + OIDC/SAML + JWT | W4H never handles passwords; MFA enforced at IdP; JWT injected by JupyterHub |
| Automated auth | Service account keys with compensating controls | IP restriction, dataset scope, 90-day expiry, human owner — satisfies HIPAA equivalent alternative |

For full rationale on each, see the [ADR index](adr/README.md).

---

## Frontend conventions

These are architectural decisions for the Vue frontend, not just setup preferences.

- **User store** (`src/stores/user.js`) — parse and persist `team_id` from the JWT login payload; it must be available on every request for team-scoped API calls
- **Dataset selector** (e.g. `ProjectsEdit.vue`) — label datasets in selection lists to distinguish origin: **"Shared from [Team Name]"** vs **"Local"**; never show raw UUIDs
- **Operator routes** — Platform Admin (`/admin/home`, settings, audit, usage) is Super admin only and has **no toggle** into the team app shell. Team admins use the app shell for teams/projects/datasets; cross-team shares at `/admin/datasets/shares` in that shell.
- **Brand theme (USC Cardinal + Gold)** — see [ADR-013](ADR-013-brand-theming-white-label.md). Global CSS tokens in `w4h-app/src/style.css` (imported **after** Bootstrap); Super admin **UI kit** at `/admin/style-guide` is in MVP for tuning. White-label / Bootswatch-style multi-brand is post-MVP.
  - Tokens: `--w4h-cardinal` (`#990000` per [USC Identity](https://identity.usc.edu/identity/color/)), `--w4h-gold` (`#FFCC00`), `--w4h-nav-bg`, `--w4h-active-fg`
  - Solid primary / list-group active / nav-pills active → Cardinal **fill** + white label. Keep `--bs-danger` distinct from brand CTAs
  - **Links:** light → Cardinal `#990000`; dark → Gold `#FFCC00`. No underline by default; underline on hover (**same color**, no darken/lighten on hover)
  - **Never** deep Cardinal/danger/success as *text* on near-black — dark `.text-primary` / `.text-danger` / `.text-success` use lightened utilities
  - Callouts: `.w4h-callout`; auth plate `w4h-light.svg`; nav mark `w4h-mark.svg`

---

## Open items

- [ ] Define retention and archival policy per trial (schema dump + drop vs. soft archive flag)
- [ ] Define signal table column standards per sensor type (heart rate, accelerometer, glucose, etc.)
- [ ] Decide on row-level security within a trial for project-scoped data access (alternative to view-per-project)
- [ ] Define sharing request approval workflow — single approver vs. dual approval for compliance (push share is MVP default; see ADR-002 / ADR-012)
- [ ] **Project linkable set:** enforce dataset list/link picker as owned ∪ inbound shares only; migrate off legacy `datasets.project_id` for access (ADR-012)
- [ ] Confirm TimescaleDB licence and deployment model (self-hosted vs. managed)
- [ ] Define egress review process — manual approval vs. automated PHI disclosure check, turnaround SLA
- [ ] Choose reference IdP for first deployment (institutional LDAP, Keycloak self-hosted, or managed Okta/Azure AD)
- [ ] Define controlled package mirror strategy for TRE (Artifactory, pip index proxy, or curated allowlist)
- [ ] Define service account rotation tooling — CLI command or platform UI for pipeline owners
- [ ] Clarify idle session timeout per deployment context (15 min for clinical, relaxed for HPC batch contexts?)
- [ ] **GDPR / EU deployment:** soft-delete model conflicts with GDPR Article 17 (right to erasure) — requires legal review and a pseudonymisation strategy before any deployment enrolling EU-resident subjects or involving EU-based trial sites (see ADR-010)
- [ ] **REDCap incremental sync dependency:** R-04 requires REDCap projects to have data access logging enabled or a `date_modified` field — import UI must detect and warn when this is absent (see ADR-009)
- [ ] **Audit log cold storage:** define the archival path for audit log entries beyond the active query window (e.g. S3 Glacier with object lock) while preserving the HIPAA 6-year retrievability requirement (see ADR-010, ADR-011)
- [ ] **Audit log writers:** implement shared fail-closed audit helper on PHI/API and super-admin paths; admin audit viewer + IRB export (H-09, H-11) (see ADR-011)
- [x] **Operator homes (partial):** Super admin `/admin/home` KPIs + health + attention strip + usage/audit deep links via `GET /config/admin-home` (D-19a, H-12, H-12a); `/admin/audit-log` viewer; `/admin/usage` (legacy `/admin/api-usage`) adoption/key hygiene dashboard. Still open: study-metric sections on Usage (D-19*), Team admin scoped Usage, Team admin IRB home (H-09a), project-owner report (H-09b).
---
title: ADR-004 — Three-tier access control model
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-20T00:00:00.000Z
---
# ADR-004 — Three-tier access control model

**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-08-12  
**Deciders:** W4H architecture team  
**Relates to:** ADR-012 (project–dataset linking), ADR-002 (sharing), ADR-011 (audit)

---

## Context

W4H serves several distinct user types with different responsibilities and trust levels:

- Platform operators who manage the system globally
- Team-level administrators who manage their own team's data and users
- Researchers who consume data within a project

The same person often collaborates across teams with **different authority** on each (dual-hat): e.g. Team admin on their home trial, ordinary member on a peer team that shared data with them. A single account-wide “Team admin” flag cannot express that.

Access control must be enforceable at the database level (not just the application layer), auditable, and granular enough to support sharing, project assignment, and dual-hat membership.

### Canonical vocabulary (ADR + MVP)

| UI name | Scope | Where stored |
|---|---|---|
| **Super admin** | Platform-wide | `users.role = super_admin` — **not** a project membership |
| **Admin** | One team / project | `team_members.role = team_admin` and/or `project_members.role = owner` |
| **User** | One team / project | `team_members.role = member`; `project_members.role = editor` (legacy `viewer` displays as User) |

Super admin is platform-only. Do not put Super admin on a project Members dropdown. Effective team authority comes from **team membership role**, not from a global `users.role = team_admin` (retired 2026-10-04 — see below). Stored values `team_admin` / `member` / `owner` / `editor` are unchanged.

## Decision

Layer access as: **platform role** → **team membership role** → **project membership role** → optional **resource ACL**.

### 1. Platform role

| Role | Scope | Responsibilities |
|---|---|---|
| Super admin | Platform-wide | **Platform Admin** shell only (`W4H Toolkit Admin`): SMTP/settings, **access-request approval** (Admin invite), Contributions catalog, audit, usage. No app-shell toggle. Does **not** manage team rosters, projects, datasets, or ingest. |

Non–Super-admin accounts do **not** carry global Team admin privileges. Their team and project powers come from memberships. They use the **app shell** (`W4H Toolkit`) only.

### 2. Team membership roles (per team)

Stored on `team_members.role`. Product UI: **Admin** / **User**.

| UI label | Stored as | Typical use |
|---|---|---|
| **Admin** | `team_admin` | Manage that team's users, projects, datasets, shares; create further teams after onboard; team-scoped audit/IRB |
| **User** | `member` | Participate via project memberships; no team-wide admin on that team |

**Dual-hat:** the same user may be `team_admin` on team A and `member` on team B.

**Effective Team admin for team T** = caller has `team_members` row for T with `role = team_admin` (Super admin is never effective Team admin).

Legacy `users.role = team_admin` was migrated to `team_members.role = team_admin` on each of that user's teams (schema migration, 2026-10-04) and the global value is cleared to `project_user`. Team admin is membership-scoped only: the API never writes `users.role = team_admin`, and `team_admin` is accepted only as an *input alias* on user create/update meaning "Admin on the teams given". The JWT `caps.team_admin` claim (any `team_admin` membership) drives the app shell; per-team checks always read `team_members`.

### 3. Project membership roles

Product UI on a project roster is **Admin** or **User**. Super admin is platform-wide and is **not** a project membership.

| UI label | Stored as | Typical use |
|---|---|---|
| **Admin** | `owner` | Manage the project (members, linked datasets, settings); at least one required |
| **User** | `editor` (legacy `viewer` also shows as User) | Work in the project: analytics on linked datasets, project pages |

These are **not** a platform tier. Legacy project membership `admin` maps to `owner`. Legacy `viewer` is treated as User in the UI.

There is **one** Admin type. Super admin inviting the PI at onboard does not create a second role — that person is an Admin like any other. GitHub/GitLab-style orgs work the same way: many owners of equal rank, at least one must remain, and platform operators recover access. Do **not** add a “primary PI” vs “invited admin” split.

A Admin **cannot remove themselves**. Another Admin (or Super admin, by inviting a replacement) must do that. The last Admin cannot be removed or demoted.

### 4. Resource ACL (optional refinement)

Project ACL rules (e.g. `resource_type = doc`) may grant or deny capabilities beyond membership defaults.

**Ingest delegation** (PI grants a student create/ingest on team datasets **without** `team_admin`) is the same class of problem: a **capability / ACL grant**, not a new team membership role. Tracked in MVP as Draft D-22. Until that ships, create/ingest via the API remains **Team admin** or **project owner** on the owning team (D-12); **Super admin does not ingest** into trial datasets. Non-admins use API-key ingest only when a future grant says so (D-13).

### PostgreSQL DB role mapping

| App role | DB role | Schema privileges |
|---|---|---|
| Super admin | `w4h_superadmin` | All schemas — full privileges |
| Team admin (trial A) | `trial_a_admin` | `w4h_app` (read/write own rows), `trial_a` (full DML), `w4h_global` (read if granted) |
| Member / project user (trial A) | `trial_a_role` | `w4h_app` (read own profile), `trial_a` (SELECT on assigned datasets only), `w4h_global` (read if granted) |
| Platform DDL executor | `w4h_platform` | All schemas — CREATE, GRANT, REVOKE |

Session `search_path` / DB role must follow the **active team context** for the request (dual-hat users switch effective privileges per team).

### Key permission boundaries

**Super admin can:**
- Configure platform settings (SMTP, docs refresh, optional platform AI key)
- Review **access requests** and **approve Admin invitations** (ADR-028), or **Invite Admin** directly when the PI is already known — same outcome: `can_create_teams`, no team created by Super admin
- Curate **Contributions** (`w4h.contributions`: publish, pin versions, `runnable`)
- Read and export the full **audit log**; view platform **Usage**
- Use **Platform Admin home** (`/admin/home`) for KPIs, health, and attention items (pending requests, backup reminder, etc.)
- Always remain in the Platform Admin shell after login (no toggle into the team app shell)
- Promote another user to Super admin (break-glass)

**Super admin cannot** (Team Admin / project owner in the app shell):
- Add or remove team members, change team membership roles, or edit trial teams
- Invite or discontinue trial users except via the access-request → Admin invite flow
- Create or manage projects, link datasets, **Run import…**, or dataset catalog CRUD
- Approve dataset shares on behalf of a team (team Admins own share workflow, ADR-012)

**Team admin (per team) can:**
- Create and manage projects within that team
- Load datasets (triggers signal table DDL via `w4h_platform`)
- Link datasets to projects (owned and inbound-shared — see ADR-012)
- Add/remove members within that team; set **team membership role** on that team
- Push dataset shares to other teams; approve incoming share requests for their datasets
- View that team's audit log entries (scoped; **not** via Platform Admin shell)
- View team-scoped **Usage** study metrics (MVP D-19; same layout as Super admin, filtered)
- Generate **IRB access reports** for that team's datasets/projects (ADR-011 / H-09a)
- Cannot exercise Team admin powers on other teams where they are only `member`
- Cannot enter the Platform Admin UI (`/admin/*` shell is Super admin only)

**User can:**
- Act within projects as **User** (`editor`; legacy `viewer` displays as User) or **Admin** (`owner`)
- Read wearable data for datasets **linked** to their projects only
- As project **`owner` only:** generate a **project-scoped IRB access report** (H-09b) — not raw audit browse
- Cannot load/create datasets (unless granted a future ingest capability — D-22), manage team users, or access unlinked datasets
- Cannot open another team's project solely because a dataset was shared (ADR-012)
- Cannot browse the raw audit log or platform Usage ledger (`/admin/usage`)

## Consequences

**Positive:**
- Dual-hat membership without duplicate accounts or over-privilege on collaborator teams
- Database-enforced boundaries — a misconfigured application cannot leak data between roles
- Sharing grants are issued to specific DB roles, making them immediately enforceable and revocable
- The `w4h_platform` DDL role is the only entity that can create views and issue grants — a controlled and auditable path
- Aligns MVP language: Super admin (platform) · Admin / User (per team and project)

**Negative / risks:**
- Legacy global `users.role = team_admin` migrated onto `team_members.role` (done; see §2)
- Application must resolve effective role **per team** on each request (`search_path`, authorization checks)
- Project-scoped data access for members still relies on application-layer filtering or per-project views (open item in `architecture.md`)
- Ingest delegation without Team admin remains a separate ACL/capability design (D-22)

## Alternatives not chosen

- **Single global Team admin flag on `users.role`:** Rejected for dual-hat — admin on one team incorrectly grants admin on all memberships.
- **Per-team roles only as UI labels without schema:** Rejected — authorization must be durable and auditable on `team_members`.
- **Encode ingest delegation as a third team membership role (`data_steward`):** Deferred — prefer a capability/ACL grant (D-22) so we do not proliferate team roles; revisit if stewards become a first-class persona.
- **Single app-level role with application-enforced access only:** Rejected — DB-level enforcement required for regulatory compliance.
- **Row-level security (RLS) for all isolation:** Rejected for inter-team isolation (ADR-001); remains a candidate for intra-team project-scoped access.
- **Four unrelated platform roles (admin / researcher / clinician / viewer):** Rejected — replace with Super admin + team membership + project membership.

## Changelog

| Date | Change |
|---|---|
| 2026-07-15 | Vocabulary aligned with MVP (Team admin = Group Admin); project membership roles documented; relates ADR-012. |
| 2026-07-15 | Project membership reduced to owner / editor / viewer (dropped project admin). |
| 2026-07-21 | Super admin Platform Admin shell only (no app toggle); Team admin self-service teams after onboard (MVP v0.13). |
| 2026-07-20 | **Per-team roles** on `team_members` (`team_admin` \| `member`); dual-hat; legacy global Team admin migrates to membership. Ingest-without-admin = ACL/capability (MVP D-22), not a third team role. |
| 2026-07-22 | Usage surface `/admin/usage` (study metrics); Team admin team-scoped view; members cannot browse Usage ledger. |
| 2026-08-12 | Product UI: **Super admin** · **Admin** · **User**. Stored `team_admin`/`member` and `owner`/`editor` unchanged; Super admin is not a project membership. |
| 2026-08-12 | One Admin type (no primary vs invited split). Admin cannot remove themselves; at least one must remain. |
| 2026-10-04 | Global `users.role = team_admin` retired: migrated to memberships, no longer written or honoured. Creating a project/dataset needs Team admin on *that* team (dual-hat). |
| 2026-08-13 | Product UI short name **Admin** (was “Project admin”); roles remain Super admin · Admin · User. |
| 2026-10-23 | Super admin narrowed to Platform Admin only: access-request approval, Contributions, settings, audit/usage — not team roster, trial users, projects, datasets, or ingest. Effective Team admin is membership-only. |

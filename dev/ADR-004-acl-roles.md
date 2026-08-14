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

Super admin is platform-only. Do not put Super admin on a project Members dropdown. Effective team authority comes from **team membership role**, not from a global `users.role = team_admin` (legacy — migrate). Stored values `team_admin` / `member` / `owner` / `editor` are unchanged.

## Decision

Layer access as: **platform role** → **team membership role** → **project membership role** → optional **resource ACL**.

### 1. Platform role

| Role | Scope | Responsibilities |
|---|---|---|
| Super admin | Platform-wide | **Platform Admin** shell only (`W4H Toolkit Admin`): bootstrap teams/users, audit, usage, settings. No app-shell toggle. Does **not** run day-to-day trials. |

Non–Super-admin accounts do **not** carry global Team admin privileges. Their team and project powers come from memberships. They use the **app shell** (`W4H Toolkit`) only.

### 2. Team membership roles (per team)

Stored on `team_members.role`. Product UI: **Admin** / **User**.

| UI label | Stored as | Typical use |
|---|---|---|
| **Admin** | `team_admin` | Manage that team's users, projects, datasets, shares; create further teams after onboard; team-scoped audit/IRB |
| **User** | `member` | Participate via project memberships; no team-wide admin on that team |

**Dual-hat:** the same user may be `team_admin` on team A and `member` on team B.

**Effective Team admin for team T** = caller is Super admin **or** has `team_members` row for T with `role = team_admin`.

Legacy `users.role = team_admin` migrates to `team_members.role = team_admin` on each of that user's teams; thereafter team admin is membership-scoped only.

### 3. Project membership roles

Product UI on a project roster is **Admin** or **User**. Super admin is platform-wide and is **not** a project membership.

| UI label | Stored as | Typical use |
|---|---|---|
| **Admin** | `owner` | Manage the project (members, linked datasets, settings); at least one required |
| **User** | `editor` (legacy `viewer` also shows as User) | Work in the project: analytics, notebooks, linked datasets |

These are **not** a platform tier. Legacy project membership `admin` maps to `owner`. Legacy `viewer` is treated as User in the UI.

There is **one** Admin type. Super admin inviting the PI at onboard does not create a second role — that person is an Admin like any other. GitHub/GitLab-style orgs work the same way: many owners of equal rank, at least one must remain, and platform operators recover access. Do **not** add a “primary PI” vs “invited admin” split.

A Admin **cannot remove themselves**. Another Admin (or Super admin, by inviting a replacement) must do that. The last Admin cannot be removed or demoted.

### 4. Resource ACL (optional refinement)

Project ACL rules (e.g. `resource_type = doc`) may grant or deny capabilities beyond membership defaults.

**Ingest delegation** (PI grants a student create/ingest on team datasets **without** `team_admin`) is the same class of problem: a **capability / ACL grant**, not a new team membership role. Tracked in MVP as Draft D-22. Until that ships, create/ingest DDL remains Team admin (or Super admin) only (D-12); non-admins use API-key ingest when authorized (D-13).

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
- Create and delete trial schemas / manage all teams
- Manage all users across all teams
- Approve or revoke any sharing request
- Access `w4h_global` unconditionally
- Read and export the full audit log
- Use **Platform Admin home** (`/admin/home`) for platform KPIs, health, and usage snapshots; attention strip; deep links to audit + **Usage** (`/admin/usage`)
- Always remain in the Platform Admin shell after login (no toggle into the team app shell)
- Promote a user to Super admin

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
- Must migrate legacy global `users.role = team_admin` onto `team_members.role`
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
| 2026-08-13 | Product UI short name **Admin** (was “Project admin”); roles remain Super admin · Admin · User. |

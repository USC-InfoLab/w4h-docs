---
title: ADR-004 — Three-tier access control model
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-15T00:00:00.000Z
---
# ADR-004 — Three-tier access control model

**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-07-15  
**Deciders:** W4H architecture team  
**Relates to:** ADR-012 (project–dataset linking), ADR-002 (sharing), ADR-011 (audit)

---

## Context

W4H serves several distinct user types with different responsibilities and trust levels:

- Platform operators who manage the system globally
- Team-level administrators who manage their own team's data and users
- Researchers who consume data within a project

Access control must be enforceable at the database level (not just the application layer), auditable, and granular enough to support the sharing and project-assignment workflows.

### Canonical vocabulary (ADR + MVP)

| Canonical name | Former / alias | Scope |
|---|---|---|
| **Super admin** | Super-Admin | Platform-wide |
| **Team admin** | Group Admin | Own team / trial |
| **Project user** | Researcher / Viewer (by membership role) | Assigned projects |

MVP requirements and product copy use these three names. “Group Admin” in older drafts means **Team admin**.

## Decision

Define **three application roles** and map them to **PostgreSQL DB roles**:

### Application roles

| Role | Scope | Responsibilities |
|---|---|---|
| Super admin | Platform-wide | Full control — teams/trials, users, sharing, audit |
| Team admin | Assigned team(s) / trial(s) | Projects, datasets, project users, push/approve shares |
| Project user | Assigned projects | Read linked data; annotate per membership role |

Roles are cumulative — Team admin inherits Project user permissions within their team.

### Project membership roles (Project user detail)

A Project user is assigned to a project with one membership role:

| Membership | Typical use |
|---|---|
| `owner` | Manage the project (members, linked datasets, settings); at least one required |
| `editor` | Run analytics and notebooks; read linked datasets |
| `viewer` | Read-only dashboards and docs |

These are **not** a fourth platform tier. Platform role remains Project user; membership refines project-scoped capabilities (requirements P-02). Legacy project membership `admin` maps to `owner`.

### PostgreSQL DB role mapping

| App role | DB role | Schema privileges |
|---|---|---|
| Super admin | `w4h_superadmin` | All schemas — full privileges |
| Team admin (trial A) | `trial_a_admin` | `w4h_app` (read/write own rows), `trial_a` (full DML), `w4h_global` (read if granted) |
| Project user (trial A) | `trial_a_role` | `w4h_app` (read own profile), `trial_a` (SELECT on assigned datasets only), `w4h_global` (read if granted) |
| Platform DDL executor | `w4h_platform` | All schemas — CREATE, GRANT, REVOKE |

### Key permission boundaries

**Super admin can:**
- Create and delete trial schemas / manage all teams
- Manage all users across all teams
- Approve or revoke any sharing request
- Access `w4h_global` unconditionally
- Read and export the full audit log
- Promote a Team admin to Super admin

**Team admin can:**
- Create and manage projects within their team
- Load datasets (triggers signal table DDL via `w4h_platform`)
- Link datasets to projects (owned and inbound-shared — see ADR-012)
- Add/remove Project users within their team (MVP: same team only)
- Push dataset shares to other teams; approve incoming share requests for their datasets
- View their team's audit log entries
- Cannot access other teams' private catalogs or `w4h_global` without an explicit sharing grant

**Project user can:**
- Read wearable data for datasets **linked** to their projects only
- Write annotations on subjects within their project (membership permitting)
- Read team and project docs
- Cannot load data, manage team users, or access unlinked datasets
- Cannot open another team's project solely because a dataset was shared (ADR-012)

## Consequences

**Positive:**
- Database-enforced boundaries — a misconfigured application cannot leak data between roles
- Sharing grants are issued to specific DB roles, making them immediately enforceable and revocable
- The `w4h_platform` DDL role is the only entity that can create views and issue grants — a controlled and auditable path
- Aligns MVP product language with a single three-tier model

**Negative / risks:**
- Project-scoped data access for Project users currently relies on application-layer filtering or per-project views. A future ADR should decide whether to enforce this with RLS or dedicated views (see open item in `architecture.md`).
- Team admins can be assigned to multiple teams — the application must track this mapping and set `search_path` correctly per request.
- Legacy code still uses `users.role` values `admin` / `researcher` / `clinician` — migrate to Super admin / Team admin / Project user mapping.

## Alternatives not chosen

- **Single app-level role with application-enforced access:** Rejected — a bug or injection in the application layer could bypass all controls. DB-level enforcement is required for regulatory compliance.
- **Row-level security (RLS) for all isolation:** Considered as an alternative to schema-per-trial. Rejected for inter-team isolation (see ADR-001), but remains a candidate for intra-team project-scoped access.
- **Four unrelated platform roles (admin / researcher / clinician / viewer):** Rejected as the product model — replace with three tiers + project membership roles.

## Changelog

| Date | Change |
|---|---|
| 2026-07-15 | Vocabulary aligned with MVP (Team admin = Group Admin); project membership roles documented; relates to ADR-012. |
| 2026-07-15 | Project membership reduced to owner / editor / viewer (dropped project admin). |

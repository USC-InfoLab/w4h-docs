---
title: ADR-004 — Three-tier access control model
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-04T23:10:40.000Z
---
# ADR-004 — Three-tier access control model

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team

---

## Context

W4H serves several distinct user types with different responsibilities and trust levels:

- Platform operators who manage the system globally
- Trial-level administrators who manage their own trial's data and users
- Researchers who consume data within a project

Access control must be enforceable at the database level (not just the application layer), auditable, and granular enough to support the sharing and project-assignment workflows.

## Decision

Define **three application roles** and map them to **PostgreSQL DB roles**:

### Application roles

| Role | Scope | Responsibilities |
|---|---|---|
| Super admin | Platform-wide | Full control — trials, users, sharing, audit |
| Team admin | Assigned trial(s) | Projects, datasets, project users, sharing requests |
| Project user | Assigned projects | Read data, annotate |

Roles are cumulative — team admin inherits project user permissions within their trial.

### PostgreSQL DB role mapping

| App role | DB role | Schema privileges |
|---|---|---|
| Super admin | `w4h_superadmin` | All schemas — full privileges |
| Team admin (trial A) | `trial_a_admin` | `w4h_app` (read/write own rows), `trial_a` (full DML), `w4h_global` (read if granted) |
| Project user (trial A) | `trial_a_role` | `w4h_app` (read own profile), `trial_a` (SELECT on assigned datasets only), `w4h_global` (read if granted) |
| Platform DDL executor | `w4h_platform` | All schemas — CREATE, GRANT, REVOKE |

### Key permission boundaries

**Super admin can:**
- Create and delete trial schemas
- Manage all users across all trials
- Approve or revoke any sharing request
- Access `w4h_global` unconditionally
- Read and export the full audit log
- Promote a team admin to super admin

**Team admin can:**
- Create and manage projects within their trial
- Load datasets (triggers signal table DDL via `w4h_platform`)
- Assign datasets to projects
- Add/remove project users within their trial
- Submit and approve sharing requests for their own datasets
- View their trial's audit log entries
- Cannot access other trials or `w4h_global` without an explicit sharing grant

**Project user can:**
- Read wearable data for assigned datasets only
- Write annotations on subjects within their project
- Read trial and project docs
- Cannot load data, manage users, or access unassigned datasets

## Consequences

**Positive:**
- Database-enforced boundaries — a misconfigured application cannot leak data between roles
- Sharing grants are issued to specific DB roles, making them immediately enforceable and revocable
- The `w4h_platform` DDL role is the only entity that can create views and issue grants — a controlled and auditable path

**Negative / risks:**
- Project-scoped data access for project users (only seeing datasets assigned to their project) currently relies on application-layer filtering or per-project views. A future ADR should decide whether to enforce this with RLS or dedicated views (see open item in `architecture.md`).
- Team admins can be assigned to multiple trials — the application must track this mapping and set `search_path` correctly per request.

## Alternatives not chosen

- **Single app-level role with application-enforced access:** Rejected — a bug or injection in the application layer could bypass all controls. DB-level enforcement is required for regulatory compliance.
- **Row-level security (RLS) for all isolation:** Considered as an alternative to schema-per-trial. Rejected for inter-trial isolation (see ADR-001), but remains a candidate for intra-trial project-scoped access.

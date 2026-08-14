---
title: "ADR-012 — Project–dataset linking and shared-dataset projects"
description: Multi-dataset projects, cross-team dataset shares, and project visibility rules
updated_by: nocera@usc.edu
updated_at: 2026-07-15T00:00:00.000Z
---
# ADR-012 — Project–dataset linking and shared-dataset projects

**Status:** Accepted  
**Date:** 2026-07-15  
**Deciders:** W4H architecture team  
**Relates to:** ADR-002 (cross-trial / cross-team sharing), ADR-004 (roles), ADR-011 (audit logging)  
**References:**
- W4H MVP Requirements §2 (Roles), §5 (Projects), §6 (Datasets D-06–D-07), §7 (Sharing S-01–S-06), §16 (Out of Scope)
- Vocabulary: Super admin · Team admin · Project user (see ADR-004)

---

## Context

Modeling and analytics often need **more than one dataset** in a single project (e.g. multi-site training, paired device cohorts). Separately, teams need to **allow another team to use a dataset** without handing over project ownership or opening their full catalog.

These are related but different operations:

| Need | Mechanism |
|---|---|
| Use several datasets we already own | **Link** datasets to a project (`project_datasets`) |
| Let another team use one of our datasets | **Share** the dataset to that team (`dataset_shares` / ADR-002), then **they** link it |

Confusion arises if “shared project” is assumed: MVP projects have **one owning team**. Sharing does **not** create a jointly owned project. A modeling project that uses Team B’s data while owned by Team A is **only visible to Team A** (and its project members). Team B sees the share agreement and that their dataset was shared — not Team A’s project workspace.

## Decision

### 1. Canonical vocabulary (align ADR + MVP)

| Role | Scope | Notes |
|---|---|---|
| **Super admin** | Platform-wide | Formerly “Super-Admin” in early MVP drafts. Not a project membership. |
| **Admin** | Own team / project | UI name for stored `team_admin` / project `owner`. Formerly “Team admin” / “Group Admin”. |
| **User** | Assigned projects | Stored as `member` on the team and `editor` on the project (legacy `viewer` displays as User). |

Team admin inherits Project user capabilities within their team. Project membership roles refine what a Project user may do on a given project (ADR-004).

### 2. Within-team multi-dataset projects

- A project has exactly one `team_id` (owning team).
- Datasets owned by that team may be **linked** many-to-many via `project_datasets` with `access_type` `read` or `read_write` (requirements D-06).
- The same dataset may be linked to multiple projects in the owning team.
- **Team admin** (or project `owner`) links and unlinks datasets from the project UI — no Super admin required for same-team modeling setups.
- Project users only see datasets **linked** to projects they belong to.

This is the simplest path for “model from multiple datasets”: create a project → link dataset A + B + C → add Project users.

### 3. Cross-team dataset share (not project share)

Sharing applies to **datasets**, never to projects in MVP.

**Primary MVP UX — push share (requirements S-01):**

1. Team admin A opens a dataset **owned by Team A** (catalog shows only own + already-shared-with-us datasets — never the peer team’s private catalog).
2. Chooses **Share** → target Team B (team-wide) or a specific Team B project → default `read`.
3. Platform records `dataset_shares` and, per ADR-002, materializes access (views / grants in `w4h_global` or equivalent).
4. Audited per ADR-011 (`sharing.approve` / share create events).

**Recipient UX:**

1. Team admin B’s dataset list gains that row labeled **"Shared by [Team A]"** (S-05, D-07).
2. B links it to a **Team B–owned** project for B’s own analysis — **or** A, having received a reciprocal share the other way, links both owned and inbound-shared datasets to an **Team A–owned** project.
3. B does **not** see A’s project list or notebooks solely because of the share.

**Optional pull path (ADR-002 request/approve):** Team B may request access; Team A’s admin approves. Same end state: share agreement + linkable dataset for the recipient. Push is the default self-service for MVP; request/approve remains for formal dual control.

### 4. Visibility rules (“Project A+B”)

```
Team A owns Project P (multi-dataset modeling)
  ├── links Team A datasets (owned)
  └── links Team B dataset (via share to A)

Visible to: Super admin; Team A members of P; Team A team admin
Not visible to: Team B  (share alone does not grant project membership)
```

| Actor | Sees project P | Sees share of B’s dataset |
|---|---|---|
| Team A team admin / members of P | Yes | Yes (as linked / inbound share) |
| Team B team admin | No | Yes (outbound share / “shared with Team A”) |
| Team B users not on P | No | No dataset browse into A |

**MVP:** project members must belong to the project’s owning team (§16 — no cross-team project membership). To collaborate in one UI, users must be on the same team, or wait for a post-MVP membership exception.

### 5. Team admin self-service checklist

| Goal | Who | Steps |
|---|---|---|
| Multi-dataset model, same team | Team admin A | Create project → link owned datasets → add Project users |
| Use peer team’s data in A’s project | Team admin B then A | B shares dataset to A → A links shared + owned datasets on A’s project |
| Both teams analyze the union | Both | Reciprocal shares + **each** team owns its own project (two workspaces) |
| Single shared workspace for A and B | — | **Out of scope for MVP** (cross-team project membership) |

### 6. Product UI expectations

| Surface | Behavior |
|---|---|
| `/admin/datasets` (team scoped) | Filters **All** / **Mine** / **Others** / **Shared**. Mine = owned; Shared = inbound shares (linkable); Others = peer **Discoverable** metadata only. Share from dataset edit. |
| `/admin/datasets/shares` | Active inbound/outbound agreements; revoke |
| Project edit / workspace | Link picker = linkable set (owned ∪ shared-to-this-team [∪ project-specific shares]); never show discoverable-only peer datasets |
| Project list | Owning-team projects only (+ Super admin global) |

## Consequences

**Positive:**
- Clear split: link ≠ share ≠ co-owned project
- Team admins can set up multi-dataset modeling without Super admin for same-team cases
- Peer teams contribute data without exposing project workspaces or full catalogs
- Aligns MVP requirements §7 with ADR-002 / ADR-004 vocabulary

**Negative / risks:**
- Asymmetric collaboration surprises (“I shared data but can’t open their project”) — document in UI copy on Share
- Reciprocal modeling needs two projects or same-team membership
- Catalog/query paths must enforce linkable set (owned ∪ inbound share), not legacy `datasets.project_id` alone

## Alternatives not chosen

- **Shared / dual-owned projects in MVP:** Rejected — blurs tenancy and audit scope; deferred as cross-team project membership (§16).
- **Browsing another team’s full dataset catalog to “pick and use”:** Rejected — violates least privilege. **Discoverable** (MVP D-23) is the middle ground: opt-in metadata listing only; use still requires an explicit share.
- **Auto-link shared datasets into every recipient project:** Rejected — Team admin / project managers choose which projects consume a share (S-02 project-specific vs team-wide).
- **Copying rows into the recipient team schema:** Rejected — see ADR-002 (views / grants).

## Changelog

| Date | Change |
|---|---|
| 2026-07-21 | Discoverable catalog listing (metadata only) vs share; Mine / Others / Shared filters. |
| 2026-07-15 | Accepted — documents multi-dataset linking, push-share UX, and project visibility vs dataset share. |
| 2026-07-15 | Project membership roles: owner / editor / viewer only. |

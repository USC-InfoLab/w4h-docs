---
title: "ADR-027 — Cross-org project collaboration"
description: A project may include members and datasets from more than one team; dataset access follows project membership. Accepted — supersedes the same-team-only rule in ADR-012 §4.
updated_by: nocera@usc.edu
updated_at: 2026-10-04T00:00:00.000Z
---

**Status:** Accepted  
**Date:** 2026-10-04  
**Relates to:** ADR-002 (dataset sharing), ADR-004 (roles), ADR-011 (audit), ADR-012 (project–dataset linking), ADR-018 (discoverable catalog)  
**References:**
- MVP §5 (P-06, P-11–P-14), §7 (dataset sharing), §9 (REDCap)

---

## Context

Today a project belongs to one team and every project member must be on that team (ADR-012 §4, MVP §16). A dataset share (ADR-002) makes a dataset available to another **team**, but not to another team's people inside the owner's project.

The collaboration researchers actually ask for is: **PI at org A creates a project, links a dataset A owns, and invites the PI at org B and one of B's users; B contributes one of B's datasets.** Each side should see only that shared project, never the other's wider workspace.

Comparable platforms (DNAnexus, Terra, Seven Bridges, Synapse) all work this way: the project/workspace is the collaboration unit, membership is per user and may cross orgs, data is added by reference, and a user's home org matters for ownership, billing and discovery — not for project access.

**REDCap** is the closest reference in W4H's own domain. Multi-site REDCap studies are one project that several sites join, with *data access groups* limiting each person to their own site's records. W4H needs the same shape: one study workspace, several organizations, each limited to what it contributes. It also matters for the REDCap integration (MVP §9, M7): a REDCap project imported into W4H becomes a **dataset owned by one team**. When the study spans sites, each site's team imports or owns its own REDCap-derived dataset and contributes it to the shared project under this ADR, instead of one team owning everyone's records. Site-level separation inside a single REDCap dataset (data access groups) is not modeled here and stays out of scope.

The current model forces two projects plus a share to approximate this, and leaves dataset access (`assertCanViewDataset`) keyed on team membership, which is wider than project membership.

## Decision

### 1. Projects may have collaborating teams

A project keeps exactly one **owning team** (MVP R-04). It may also list **collaborating teams**. A project member must belong to the owning team or a collaborating team. Each member is shown with their home team.

### 2. Who can do what

| Action | Who |
|---|---|
| Add a collaborating team | Admin (project owner or Team admin) of the owning team, **and** a Team admin of the invited team accepts |
| Add a user from a collaborating team to the project | Project owner, or Team admin of that user's team |
| Link a dataset into the project | Team admin (or dataset owner) of the **dataset's owning team** — never the project owner on their behalf |
| Unlink / revoke a dataset | Same as link; takes effect immediately |
| Remove a collaborating team | Owning-team Admin or that team's Admin; its members and its datasets leave the project |

### 3. Dataset access follows project membership

A non-admin may read a dataset's data only through a project that links it and in which they are a member. Team membership alone grants nothing. Team admin on the owning team and Super admin keep their existing access. This replaces the team-wide clauses in `assertCanViewDataset`.

Linking is recorded as a `dataset_shares` row with `target_project_id` set, so grants and revocations stay in the existing audit trail (ADR-011).

### 4. Visibility is project-scoped

A collaborating-team member sees: the project, its roster, its linked datasets, its pages. They do **not** see the owning team's other projects, or the owning team's team-level views. The reverse holds for the owning team and a collaborating team's own workspace.

### 5. Discoverability is unchanged

Whether a dataset is listed to other orgs is the owner's per-dataset `discoverable` setting (ADR-018). Linking into a project never makes a dataset discoverable, and discoverability never grants data access.

## Resolved questions

- **Invitation scope:** one accepted invitation **per project**. There is no standing team-to-team agreement in the MVP.
- **Collaborator roles:** a collaborating-team member joins as **User** (`editor`) only. Project Admin (`owner`) stays with the owning team.
- **Project pages:** follow project membership for everyone, collaborators included. A member of the owning team who is *not* on the project sees the overview only (MVP P-06).
- **Leaving a project:** removing a team unlinks its datasets and removes its people. Derived datasets and model outputs created inside the project are **not** tracked yet (D-05, M-02 are still Todo), so only links are revoked today.
- **Ingest:** a project Admin may ingest only into datasets their *own* team owns. A dataset contributed by a collaborator stays under that team's control.

## Implementation

- **Schema:** `w4h.project_teams (project_id, team_id, status pending|active, invited_by, accepted_by, …)`. Dataset consent reuses `dataset_shares.target_project_id`.
- **API (`w4h-api`):**
  - `GET /projects/:id/invitable-teams`, `POST /projects/:id/teams`, `POST /projects/:id/teams/:teamId/accept`, `DELETE /projects/:id/teams/:teamId`, `GET /projects/collaboration-invites`.
  - `POST /projects/:id/datasets/:datasetId/link`, `DELETE /projects/:id/datasets/:datasetId`.
  - Project member add/replace accept people from the owning team or an active collaborating team; collaborators cannot be project Admins.
  - `assertCanViewDataset` and the ingest check follow §3. The project overview returns `collaborating_teams` and each member's `home_teams` / `is_collaborator`.
- **App (`w4h-app`):** People tab shows home-team badges and a **Collaborating teams** card (invite, remove). The Projects page shows an invitation banner for an invited team's Admin: accept or decline, and contribute one of that team's datasets.
- **Audit (ADR-011):** `project.team.invite|accept|remove`, `project.dataset.link|unlink`, `sharing.create` (with `target_project_id`).

## Consequences

- Supersedes ADR-012 §4's same-team-only membership rule and the MVP §16 "cross-team project membership" exclusion.
- Dataset data access narrows: team membership alone no longer reads a dataset.
- Cross-org links, unlinks and invites are audited; revocation is immediate.
- Not covered: derived-data lineage on team removal (D-05, M-02), a standing team-to-team agreement, and REDCap data access groups inside one dataset.

## Changelog

| Date | Change |
|---|---|
| 2026-10-04 | **Accepted** and implemented. Open questions resolved (per-project invitation; collaborators join as User; pages follow membership; links-only revocation). REDCap added as reference and M7 context. |
| 2026-10-04 | Draft opened. |

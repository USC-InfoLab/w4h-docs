---
title: "ADR-027 — Project membership is the collaboration unit"
description: People and datasets meet on a project. There is no collaborating-team or “another organization” object. Dataset data follows project membership.
updated_by: nocera@usc.edu
updated_at: 2026-10-30T00:00:00.000Z
---

**Status:** Accepted (amended 2026-10-30)  
**Date:** 2026-10-04  
**Relates to:** ADR-002 (dataset sharing), ADR-004 (roles), ADR-011 (audit), ADR-012 (project–dataset linking)  
**References:**
- MVP §5 (P-06, P-11–P-14), §7 (dataset sharing)

---

## Context

A project is the study workspace (members, linked datasets, pages). A **team** owns the catalog — who ingested a dataset, who can unlink or ingest into it. Those are not two kinds of organization.

The 2026-10-04 text added **collaborating teams** and an “another organization” invite so a second team could sit on a project without joining the owner’s roster. That invented an org-to-org ceremony researchers do not have. People already work by **project** (and IRB), not by inviting “the other organization.”

What still needed a decision: dataset **data** must not follow team membership alone (too wide), and sharing a dataset must not share a project (ADR-012).

## Decision

### 1. Collaboration is the project

Add people on **People**. Link datasets on **Datasets**. There is no collaborating-team list, no “Invite another organization,” and no team-to-team accept/decline step in the product.

A team is catalog and tenancy bookkeeping. It is not a second social object next to the project.

### 2. Dataset data follows project membership

A non-admin may read a dataset’s data only through a project that links it and in which they are a member. Team membership alone grants nothing. Team admin on the owning team and Super admin keep their existing access.

Sharing a dataset (ADR-002 / ADR-012) makes it **linkable**. It does not put the sharer’s people on the recipient’s project. To work in one workspace, add the people to that project.

### 3. Who can do what

| Action | Who |
|---|---|
| Add or remove a person on the project | Project Admin (and Team admin of the owning team) |
| Link a dataset into the project | Team admin (or dataset owner) of the **dataset’s owning team** |
| Unlink a dataset | Same as link; takes effect immediately |
| Ingest | Owning-team Admin, or a project Admin, and only into datasets **their own team** owns |

### 4. Visibility is project-scoped

A project member sees that project (roster, linked datasets, pages). An owning-team member who is **not** on the project sees the overview only (Datasets and People). They do not see other teams’ workspaces unless they are members there.

### 5. Retracted

These are **not** product rules:

- Collaborating teams / `project_teams` as a user-facing object
- “Another organization” copy or invite
- Collaborators locked to User because they came from “the other org”
- A standing team-to-team agreement

Leftover API routes (`POST /projects/:id/teams`, accept, `collaboration-invites`, `invitable-teams`) are not a surface. Do not expose them in the app.

## Implementation

- **Access:** `assertCanViewDataset` and ingest checks follow §2–§3. Linking may still record `dataset_shares.target_project_id` for audit (ADR-011).
- **App:** People and Datasets only. No organization card, no collaboration-invite banner on the project list.
- **Audit:** `project.dataset.link|unlink`, member add/remove, `sharing.create`.

## Consequences

- Supersedes the 2026-10-04 collaborating-teams decision in this same ADR. ADR-012 §4’s “share ≠ project” rule stands; joint work is People + links, not a second team invite.
- Dataset data access stays narrower than team membership (R-10).
- Cross-team data still moves by **share then link**. People still move by **invite to the project** (People). No org layer.

## Changelog

| Date | Change |
|---|---|
| 2026-10-30 | **Amended:** retract collaborating teams and “another organization.” Collaboration is project membership (people + linked datasets). Team remains catalog ownership. |
| 2026-10-04 | Accepted collaborating teams (retracted above). |
| 2026-10-04 | Draft opened. |

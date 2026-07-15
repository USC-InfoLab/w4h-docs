---
title: ADR-002 — Cross-trial dataset sharing via w4h_global
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-15T00:00:00.000Z
---
# ADR-002 — Cross-trial dataset sharing via w4h_global

**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-07-15  
**Deciders:** W4H architecture team  
**Relates to:** ADR-012 (project–dataset linking and visibility), ADR-004 (roles)

---

## Context

Some teams/trials need to share specific datasets with other teams for cross-team analytics. The sharing model must satisfy these requirements:

- Sharing is opt-in and explicit — no data is shared by default
- Sharing is bilateral — team A can share one dataset with team C without team B knowing
- Sharing is granular — one dataset (or even one signal table) can be shared, not an entire team
- Every sharing grant and revocation is auditable
- Revoking access is immediate and complete
- Sharing a **dataset** does not share a **project** (see ADR-012)

## Decision

Introduce a dedicated `w4h_global` schema that holds:

1. A sharing agreement registry (`shared_datasets` / `dataset_shares` — source team, target team, dataset ID, optional target project, who shared/approved, when, access type)
2. Scoped views — one per signal table in the shared dataset — named `<source_trial>_ds<id>_<signal_type>`
3. Targeted PostgreSQL `GRANT SELECT` on each view to the target team's DB role only

Nothing lands in `w4h_global` automatically. Access is created only after an explicit share.

### How a share is initiated (MVP)

**Default — push share (Team admin of the owning team):**

```
team_a_admin  →  Share dataset to team B  (dataset_shares INSERT)
                          ↓
w4h_platform role  →  CREATE VIEW + GRANT (DDL)
                          ↓
audit_log (INSERT)
team_b catalog  →  dataset appears as "Shared by Team A"
team_b_admin    →  links dataset to a Team B project (ADR-012)
```

Team admin A never browses Team B’s private catalog. Team admin B never browses Team A’s — only rows under an active share appear as inbound.

**Optional — pull request (formal dual control):**

```
team_c_admin  →  sharing_requests (INSERT)
                          ↓
team_a_admin or super_admin  →  approves (UPDATE status)
                          ↓
w4h_platform role  →  CREATE VIEW + GRANT (DDL)
                          ↓
audit_log (INSERT)
```

End state matches push share. Product UI should prefer push for MVP self-service (requirements S-01); keep request/approve when compliance requires an inbound ask.

Team B has zero visibility into a grant between team A and team C — it holds no privileges on those views and they do not appear in `information_schema.table_privileges` for team B's role.

Revocation drops the views and revokes the grants, and is logged in `w4h_app.audit_log`. Unlinks from recipient projects follow ADR-012 / soft-delete rules as applicable.

### What sharing does *not* do

- Does not create a co-owned project
- Does not add the recipient Team admin to the owner's project membership
- Does not expose the owner's notebooks, docs, or other private datasets

## Consequences

**Positive:**
- No automatic data leakage — sharing requires an explicit human action
- Bilateral and granular — one dataset, one target team (or project)
- Fully auditable — every grant and revocation recorded with actor and timestamp
- Revocation is immediate at the database level
- Team B cannot even discover that a grant between A and C exists
- Clear separation from project linking (ADR-012)

**Negative / risks:**
- Creating views and issuing `GRANT`s is DDL — requires a privileged `w4h_platform` DB role separate from application roles. The backend must expose a controlled path for this operation.
- If a shared dataset's signal tables are restructured (columns added/removed), views must be recreated. The dataset loading process must account for active sharing agreements.
- View proliferation — many teams sharing many datasets could create many views in `w4h_global`. Monitor and document a naming convention.
- Collaborators expecting a joint project must use same-team membership or post-MVP cross-team project membership

## Alternatives not chosen

- **Direct cross-schema SELECT grants:** Granting `trial_c_role` SELECT on `trial_a.wearable_data` directly would expose the entire table, not just one dataset. Rejected — too coarse.
- **Data copying into w4h_global:** Physically copying rows into a shared table was considered for performance. Rejected — creates a synchronisation problem and doubles storage. Views are sufficient and always reflect source data.
- **Shared projects as the sharing primitive:** Rejected for MVP — see ADR-012.

## Changelog

| Date | Change |
|---|---|
| 2026-07-15 | Documented push-share as MVP default; clarified dataset≠project; vocabulary Team admin / Super admin; relates ADR-012. |

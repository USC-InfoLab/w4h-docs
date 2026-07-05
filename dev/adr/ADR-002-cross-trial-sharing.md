# ADR-002 — Cross-trial dataset sharing via w4h_global

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team

---

## Context

Some trials need to share specific datasets with other trials for cross-trial analytics. The sharing model must satisfy these requirements:

- Sharing is opt-in and explicit — no data is shared by default
- Sharing is bilateral — trial A can share one dataset with trial C without trial B knowing
- Sharing is granular — one dataset (or even one signal table) can be shared, not an entire trial
- Every sharing grant and revocation is auditable
- Revoking access is immediate and complete

## Decision

Introduce a dedicated `w4h_global` schema that holds:

1. A `shared_datasets` table recording sharing agreements (source trial, target trial, dataset ID, who approved, when)
2. Scoped views — one per signal table in the shared dataset — named `<source_trial>_ds<id>_<signal_type>`
3. Targeted PostgreSQL `GRANT SELECT` on each view to the target trial's DB role only

Nothing lands in `w4h_global` automatically. A project manager submits a sharing request, which requires approval from the dataset owner's team admin (or a super admin). Only after approval does the platform's privileged DDL role create the views and issue the grants.

Trial B has zero visibility into a grant between trial A and trial C — it holds no privileges on those views and they do not appear in `information_schema.table_privileges` for trial B's role.

Revocation drops the views and revokes the grants, and is logged in `w4h_app.audit_log`.

## Consequences

**Positive:**
- No automatic data leakage — sharing requires an explicit human approval
- Bilateral and granular — one dataset, one target trial
- Fully auditable — every grant and revocation recorded with actor and timestamp
- Revocation is immediate at the database level
- Trial B cannot even discover that a grant between A and C exists

**Negative / risks:**
- Creating views and issuing `GRANT`s is DDL — requires a privileged `w4h_platform` DB role separate from application roles. The backend must expose a controlled path for this operation.
- If a shared dataset's signal tables are restructured (columns added/removed), views must be recreated. The dataset loading process must account for active sharing agreements.
- View proliferation — hundreds of trials sharing many datasets could create many views in `w4h_global`. Monitor and document a naming convention.

## Sharing request workflow (summary)

```
trial_c_admin  →  sharing_requests (INSERT)
                          ↓
trial_a_admin or super_admin  →  approves (UPDATE status)
                          ↓
w4h_platform role  →  CREATE VIEW + GRANT (DDL)
                          ↓
audit_log (INSERT)
```

## Alternatives not chosen

- **Direct cross-schema SELECT grants:** Granting `trial_c_role` SELECT on `trial_a.wearable_data` directly would expose the entire table, not just one dataset. Rejected — too coarse.
- **Data copying into w4h_global:** Physically copying rows into a shared table was considered for performance. Rejected — creates a synchronisation problem and doubles storage. Views are sufficient and always reflect source data.

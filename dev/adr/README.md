# Architectural decision records

This directory contains ADRs for the W4H wearables toolkit. Each file captures the context, decision, and consequences for one significant architectural choice.

| ID | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-schema-per-trial.md) | Schema-per-trial isolation | Accepted |
| [ADR-002](ADR-002-cross-trial-sharing.md) | Cross-trial dataset sharing via w4h_global | Accepted |
| [ADR-003](ADR-003-dataset-table-model.md) | One physical table per signal type | Accepted |
| [ADR-004](ADR-004-acl-roles.md) | Three-tier access control model | Accepted |
| [ADR-005](ADR-005-connection-pooling.md) | PgBouncer transaction-mode pooling | Draft |
| [ADR-006](ADR-006-trusted-research-environment.md) | Trusted Research Environment (TRE) model | Draft |
| [ADR-007](ADR-007-authentication-model.md) | Authentication model: human users and service accounts | Accepted |
| [ADR-008](ADR-008-geomts-data-model.md) | GeoMTS as the unifying wearable data abstraction | Draft |
| [ADR-009](ADR-009-redcap-integration.md) | REDCap as the primary data integration target for MVP | Draft |
| [ADR-010](ADR-010-soft-delete-no-hard-deletion.md) | Soft-delete only: no hard deletion of users, teams, or datasets | Accepted |

## What is an ADR?

An ADR records a decision that was made, why it was made, what alternatives were considered, and what consequences it has. Once accepted, an ADR is not edited — if the decision changes, a new ADR is written that supersedes it. This preserves the history of why things are the way they are.

## Status values

- **Draft** — under discussion
- **Accepted** — decision made and in effect
- **Superseded by ADR-XXX** — replaced by a later decision
- **Deprecated** — no longer relevant

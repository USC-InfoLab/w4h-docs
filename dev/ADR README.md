---
title: ADR Readme
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-08-18T00:00:00.000Z
sort_order: 4
---

This directory contains ADRs for the W4H wearables toolkit. Each file captures the context, decision, and consequences for one significant architectural choice.

| ID | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-schema-per-trial.md) | Schema-per-trial isolation | Accepted |
| [ADR-002](ADR-002-cross-trial-sharing.md) | Cross-trial / cross-team dataset sharing via w4h_global | Accepted |
| [ADR-003](ADR-003-dataset-table-model.md) | Physical signal tables + platform mapping registry (`w4h`) | Accepted |
| [ADR-004](ADR-004-acl-roles.md) | Three-tier access control model (Super / Team / Project user) | Accepted |
| [ADR-005](ADR-005-connection-pooling.md) | PgBouncer transaction-mode pooling | Draft |
| [ADR-006](ADR-006-trusted-research-environment.md) | Trusted Research Environment (TRE) model | Draft |
| [ADR-007](ADR-007-authentication-model.md) | Authentication model: human users and service accounts | Accepted |
| [ADR-008](ADR-008-geomts-data-model.md) | GeoMTS as the unifying wearable data abstraction (roles via mapping) | Accepted |
| [ADR-009](ADR-009-redcap-integration.md) | REDCap as the primary data integration target for MVP | Draft |
| [ADR-010](ADR-010-soft-delete-no-hard-deletion.md) | Soft-delete only: no hard deletion of users, teams, or datasets | Accepted |
| [ADR-011](ADR-011-hipaa-audit-logging.md) | HIPAA audit logging model | Draft |
| [ADR-012](ADR-012-project-dataset-linking.md) | Project–dataset linking and shared-dataset projects | Accepted |
| [ADR-013](ADR-013-brand-theming-white-label.md) | Brand theming: CSS tokens now, white-label / multi-brand later | Accepted |
| [ADR-014](ADR-014-ai-assistant-claude.md) | PHI-safe AI chat (Claude): team keys, Cursor-like UX, egress filter | Accepted |
| [ADR-015](ADR-015-docker-deployment-packaging.md) | Docker deployment packaging (standalone, non-Spark) | Draft |
| [ADR-016](ADR-016-paired-sample-importer-repos.md) | Paired sample and importer git repositories | Draft |
| [ADR-017](ADR-017-community-package-registry.md) | Community package registry (Samples sandbox) | Draft |
| [ADR-018](ADR-018-contributions-catalog.md) | Contributions catalog; no project notebook registry | Accepted |
| [ADR-019](ADR-019-mets-wear-compliance-analytics.md) | METs and wear-compliance analytics (contributions + cohort dashboards) | Draft |
| [ADR-020](ADR-020-basic-dataset-stats-dashboard.md) | Basic dataset statistics dashboard (Admin & User parity) | Draft |

## What is an ADR?

An ADR records a decision that was made, why it was made, what alternatives were considered, and what consequences it has. Once accepted, an ADR is not edited — if the decision changes, a new ADR is written that supersedes it. This preserves the history of why things are the way they are.

## Status values

- **Draft** — under discussion
- **Accepted** — decision made and in effect
- **Superseded by ADR-XXX** — replaced by a later decision
- **Deprecated** — no longer relevant

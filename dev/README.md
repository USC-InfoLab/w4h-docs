# W4H Toolkit — documentation index

**Project:** W4H Wearables Toolkit
**PI:** Cyrus Shahabi, PhD — shahabi@usc.edu
**Co-I:** Luciano Nocera, PhD — nocera@usc.edu
**Funding:** SC CTSI Pilot Funding Program

---

## Reading order

If you are new to the project, read in this order:

1. [`requirements.md`](requirements.md) — what the system must do (MVP scope, roles, features, timeline)
2. [`architecture.md`](architecture.md) — how it is built (database structure, TRE model, authentication, ACL)
3. [`adr/README.md`](adr/README.md) — list major technical decisions and their current status

For setting up a local development environment, go straight to:
- [`developer-setup.md`](developer-setup.md)

---

## Documents

| File | Purpose | Status |
|---|---|---|
| [`requirements.md`](requirements.md) | MVP feature requirements, role model, delivery timeline | Draft v0.3 |
| [`architecture.md`](architecture.md) | PostgreSQL schema design, TRE model, authentication, ACL, key design decisions | Draft v1.0 |
| [`developer-setup.md`](developer-setup.md) | Local dev environment setup | Active |
| [`adr/`](adr/README.md) | Architectural Decision Records — one file per major decision | See ADR index |

---

## Architectural Decision Records

| ID | Decision | Status |
|---|---|---|
| [ADR-001](adr/ADR-001-schema-per-trial.md) | Schema-per-trial isolation | Accepted |
| [ADR-002](adr/ADR-002-cross-trial-sharing.md) | Cross-trial dataset sharing via w4h_global | Accepted |
| [ADR-003](adr/ADR-003-dataset-table-model.md) | One physical table per signal type | Accepted |
| [ADR-004](adr/ADR-004-acl-roles.md) | Three-tier access control model | Accepted |
| [ADR-005](adr/ADR-005-connection-pooling.md) | PgBouncer transaction-mode pooling | Accepted |
| [ADR-006](adr/ADR-006-trusted-research-environment.md) | Trusted Research Environment (TRE) model | Accepted |
| [ADR-007](adr/ADR-007-authentication-model.md) | Authentication: human users and service accounts | Accepted |

---

## Archived documents

Documents that have been superseded but are preserved for reference:

| File | Superseded by |
|---|---|
| `archive/multitenancy-design.md` | `architecture.md` + ADR-001, ADR-002 |

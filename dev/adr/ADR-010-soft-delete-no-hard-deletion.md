# ADR-010 — Soft-delete only: no hard deletion of users, teams, or datasets

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team  
**References:**
- W4H MVP Requirements §4 (User Management, U-01, U-08, U-09, U-10, U-11)
- W4H MVP Requirements §3 (Multi-Tenancy, T-04, T-12)
- W4H MVP Requirements §8 (HIPAA Compliance, H-01, H-02, H-03)
- W4H MVP Requirements §16 (Out of Scope: hard user deletion / GDPR-style erasure)
- HIPAA Security Rule 45 CFR §164.312(b) — Audit controls
- HIPAA Security Rule 45 CFR §164.316(b)(2)(i) — 6-year retention of policies and records

---

## Context

W4H handles Protected Health Information (PHI) from clinical trials. Multiple categories of records — users, teams, datasets, audit log entries, project memberships — could in principle be deleted when no longer needed. The question is whether hard deletion (permanent removal from the database) is ever permissible, and if not, what the correct lifecycle model is.

Three regulatory and operational pressures bear on this decision:

**HIPAA retention requirements.** The HIPAA Security Rule requires covered entities to retain documentation of security policies and procedures for a minimum of 6 years. The audit log — which records who accessed what PHI and when — is the primary artefact of HIPAA compliance. Deleting audit log entries, or deleting the user records they reference, breaks the audit trail and creates a compliance gap.

**IRB data integrity obligations.** IRB-approved clinical trial protocols specify how data will be managed, retained, and disposed of. Premature or uncontrolled deletion of trial data — including metadata about who contributed or accessed it — may violate the approved protocol.

**Operational reversibility.** Researchers step away from projects temporarily (internships, leave, sabbaticals) and return. A student removed from a project mid-trial and re-added later should have continuity of their prior contribution record. Hard deletion makes this impossible and risks data integrity if their prior annotations, model runs, or ingestion events are orphaned.

## Decision

**No record in W4H is ever hard-deleted.** All lifecycle transitions use status fields. This applies to:

| Entity | Active status | Inactive status | Who can change |
|---|---|---|---|
| User | `active` | `discontinued` | Super-Admin (any user); Group Admin (own team) |
| Team | `active` | `deactivated` | Super-Admin only |
| Dataset | `active` | `archived` | Group Admin, Super-Admin |
| Project | `active` | `archived` | Project owner, Group Admin, Super-Admin |
| API key | `active` | `revoked` | Key owner, Group Admin, Super-Admin |
| Sharing agreement | `active` | `revoked` | Group Admin (own datasets), Super-Admin |
| Audit log entry | — | — | **Never modified or deleted by anyone** |

### User lifecycle in detail

The user lifecycle reflects the most common operational case — a researcher who steps away temporarily and returns:

```
invited → active → discontinued → active (resumed)
```

- **Discontinued** (replaces "removed" or "deactivated"): the user cannot authenticate or access data. All their active JWTs are immediately invalidated. All their personal API keys are immediately revoked. Their team and project memberships are preserved. Their historical record (audit trail entries, annotations, ingestion events) is fully intact.
- **Resumed**: login is restored. The user must issue new API keys (old revoked keys are not reinstated). Prior team and project memberships are immediately active again — no re-invitation required.
- **Never hard-deleted**: a user record persists indefinitely. If a user must be permanently excluded (e.g. data breach investigation), the account is discontinued and flagged — the record is retained for audit purposes.

### Audit log is append-only and immutable

The `w4h_app.audit_log` table is the most strictly protected:

```sql
-- No UPDATE or DELETE privileges granted to any role, including w4h_superadmin
-- Insert is permitted only via the application layer (w4h_platform role)
-- Rows are retained for a minimum of 6 years per HIPAA 45 CFR §164.316(b)(2)(i)
REVOKE UPDATE, DELETE ON w4h_app.audit_log FROM w4h_superadmin;
REVOKE UPDATE, DELETE ON w4h_app.audit_log FROM w4h_platform;
```

Retention enforcement: a PostgreSQL rule or trigger prevents deletion. Long-term, audit log rows older than the active window can be moved to cold storage (e.g. S3 Glacier with object lock) but must remain retrievable for the 6-year period.

### What "archived" means for datasets and projects

Archiving a dataset or project makes it invisible in the default UI and prevents new data ingestion or analysis runs. It does not delete data. Archived datasets remain queryable by Super-Admins and Group Admins for audit and IRB reporting purposes. Sharing agreements on archived datasets are automatically revoked.

## Consequences

**Positive:**
- Full, unbroken audit trail — every user who ever accessed PHI remains in the record, permanently linked to their access events
- HIPAA 6-year retention satisfied by design — deletion is not possible, so retention cannot be accidentally violated
- IRB compliance — trial data integrity is preserved regardless of staff turnover
- Operational reversibility — researchers who step away and return have seamless continuity
- No orphaned foreign keys — audit log entries, annotations, and ingestion events always have a resolvable `user_id`

**Negative / risks:**
- Database size grows indefinitely — discontinued users, archived datasets, and old audit entries accumulate. Requires a cold storage / archival strategy for audit logs older than the active query window
- GDPR-style erasure is not supported in MVP — if W4H is deployed in the EU or with EU-resident subjects, the right to erasure under GDPR Article 17 conflicts with this model. This is explicitly out of scope for MVP (§16) and requires a dedicated legal and technical solution (pseudonymisation, erasure of identifying fields while retaining the audit skeleton) before any EU deployment
- UI complexity — every list view (users, datasets, projects) must support filtering by status; default views should show only active records but admins need access to the full history

## Alternatives not chosen

- **Hard deletion of users on request:** Rejected — breaks the audit trail, orphans audit log entries, and violates HIPAA retention requirements. A discontinued user's identity must remain resolvable for 6 years minimum.
- **Hard deletion of old audit log entries after retention period:** Rejected for MVP — the 6-year minimum is a floor, not a ceiling. Deleting audit entries after 6 years requires a controlled, logged, IRB-reviewed process. This is post-MVP scope.
- **Anonymisation in place (replace PII fields with a hash):** A viable GDPR compliance technique for post-MVP. Rejected for MVP because it requires careful scoping of which fields constitute PII in the clinical research context, and must be reviewed against the IRB-approved data management plan before implementation.

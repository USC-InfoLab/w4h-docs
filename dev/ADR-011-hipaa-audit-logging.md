---
title: "ADR-011 — HIPAA audit logging model"
description: Append-only audit log covering API/notebook PHI access, super-admin activity, and ACL-boundary events
updated_by: nocera@usc.edu
updated_at: 2026-07-20T00:00:00.000Z
---
**Status:** Draft  
**Date:** 2026-07-15  
**Deciders:** W4H architecture team  
**Relates to:** ADR-004 (ACL roles), ADR-006 (deployment modes), ADR-007 (authentication), ADR-010 (soft-delete / immutable retention)  
**References:**
- W4H MVP Requirements §8 (HIPAA Compliance, H-01–H-04, H-09–H-12)
- W4H MVP Requirements §15 (Admin & Operator UI — home surfaces)
- W4H MVP Requirements §4 (User Management, U-09)
- HIPAA Security Rule 45 CFR §164.312(b) — Audit controls
- HIPAA Security Rule 45 CFR §164.316(b)(2)(i) — 6-year retention
- Operator guide: [HIPAA Compliance](../guide/hipaa-compliance.md)

---

## Context

W4H handles wearable clinical research data that may include Protected Health Information (PHI). HIPAA Security Rule §164.312(b) requires mechanisms that record and examine activity in systems that contain or use ePHI.

Several architectural decisions already assume an audit trail exists:

- **ADR-006 / ADR-007** — Flexible mode allows notebooks, HPC, and cloud jobs to pull datasets via personal API keys. The compensating control for data leaving the TRE boundary is ACL + audit logging (every request: user, key, dataset, row count, IP).
- **ADR-004** — Super-admins can access every trial schema and the full audit log for support and compliance. Privileged access without logging creates a compliance blind spot.
- **ADR-010** — The audit log is append-only and never hard-deleted; retention is at least 6 years.

What is still undecided is the **auditing model itself**: which events are mandatory for MVP, how JWT and API-key traffic share one ledger, whether PHI access fails if logging fails, who may view/export the log, and how the log supports IRB access reports (H-09).

Operator-facing narrative lives in `guide/hipaa-compliance.md`. This ADR records the architectural decisions that guide and implementation must follow.

## Decision

W4H uses a single append-only table (`w4h.audit_log` / platform `audit_log`) as the authoritative HIPAA audit ledger for all deployment modes (Flexible and TRE). JWT/UI sessions and personal API keys write to the **same** table; authentication method is recorded in `details`, not in separate stores.

### Minimum event set (MVP)

These categories **must** be logged. Reads of PHI / dataset rows count — not only mutations.

| Category | Required events | Why |
|---|---|---|
| **Programmatic / notebook access** | Dataset / timeseries query, row export or download, including personal API key and project-scoped tokens | Flexible-mode notebooks and scripts are the primary PHI egress path (ADR-007 D-18) |
| **Super-admin access** | Any super-admin read or write against trial data, cross-trial analytics, user/role/team/project admin actions, sharing approve/revoke, break-glass password reset | Privileged path must not be invisible |
| **Authentication & credentials** | Login success/failure, logout, user discontinue/resume, API key create/revoke/expiry refusal | Establishes who had access when |
| **ACL boundary changes** | Sharing grant/revoke, project membership add/remove, role changes | Documents how access rights changed |

UI-only navigation (e.g. opening a docs page with no PHI) is **optional** for MVP and must not be confused with this ledger. Product analytics may use `w4h.usage_events`; that table is **not** the HIPAA audit trail.

### Event schema (contract)

Each row captures at least:

| Field | Role |
|---|---|
| `timestamp` | UTC event time |
| `user_id` | Named individual (never anonymous for PHI access); discontinued users remain resolvable (ADR-010) |
| `action` | Dot-notation verb, e.g. `dataset.query`, `data.export`, `user.login`, `sharing.approve`, `audit.export` |
| `resource_type` / `resource_id` | Target (dataset, project, user, trial, …) |
| `ip_address` / `user_agent` | Request provenance |
| `details` (JSONB) | Structured context: `auth_method` (`jwt` \| `api_key`), `key_id` when applicable, project/trial ids, row/byte counts, query fingerprints (not full PHI payloads) |

Do **not** store bulk PHI in `details`. Store identifiers and counts sufficient for reconstruction of *what was accessed*, not a copy of the data.

### Auth methods share one ledger

```
JWT (UI / TRE session)  ─┐
                         ├─→  INSERT audit_log  (details.auth_method, details.key_id?)
API key (notebook/HPC)  ─┘
```

IRB and compliance reports (H-09) filter by dataset/project/user across both methods in one query.

### Write semantics

- **PHI-access and privileged-admin paths fail closed:** if the audit insert cannot be completed, the request must fail (do not return PHI or apply the privileged mutation without a durable log row). Auth-failure events should still attempt best-effort logging without creating a dependency loop.
- Application role used for inserts may `INSERT` only; `UPDATE`/`DELETE`/`TRUNCATE` are revoked for all app and admin roles (ADR-010).
- Viewing or exporting the audit log is itself an auditable action (`audit.view` / `audit.export`).

### Who may view and export (H-11)

| Role | Raw audit log browse / export | IRB access report (H-09) |
|---|---|---|
| Super admin | All teams / trials; export allowed | Platform-wide reports |
| Team admin | Own team entries only | Team datasets / projects (primary surface: **Team admin home**, not Platform Admin shell) |
| Project `owner` | No raw browse | **Own project only** from project workspace |
| Project `editor` / `viewer` / API-key-only caller | No | No |

### Operator UI surfaces (MVP)

Homes are **snapshots and entry points**, not full log tables. Dedicated pages hold filterable ledgers.

| Surface | Role | Content |
|---|---|---|
| `/admin/home` (Platform Admin) | Super admin only | KPIs (teams, users, projects, datasets, shares); platform health (SMTP, DB, audit-write OK); thin usage snapshot (API calls, active keys); attention strip (failed logins, break-glass, **invites pending**, **datasets without team**, **teams without Team admin**, **last successful backup / backup reminder**); link to **HIPAA compliance checklist** doc; deep links to `/admin/audit-log` and `/admin/usage` |
| `/admin/audit-log` | Super admin (all); Team admin (own team, non–Platform-Admin route or scoped view) | Filterable raw ledger; view/export audited (`audit.view` / `audit.export`) |
| `/admin/usage` | Super admin (platform); Team admin (own team) | Platform usage & SC-CTSI study metrics (D-19*) — adoption, latency/reliability, workflow/knowledge-transfer when available; **not** a substitute for `audit_log`. Menu label **Usage**; legacy `/admin/api-usage` redirects here. |
| App home / team dashboard | Team admin | Team summary + **IRB access report** generator (H-09a) |
| Project workspace | Project `owner` | Project-scoped IRB access report (H-09b) |

**Do not** put anonymous product telemetry or clickstream on these surfaces. Identified local `usage_events` used for SC-CTSI study reporting on `/admin/usage` are allowed and remain separate from HIPAA audit (see operator guide). Opt-in external telemetry stays Settings-only.

### Retention and archival

- Active rows retained indefinitely for MVP; no automated purge (ADR-010).
- Cold storage (e.g. object lock) may move old rows out of the hot table but must remain retrievable for ≥ 6 years. Exact archival pipeline remains an open ops item; this ADR forbids any path that permanently drops rows within that window.

### Out of scope for this ADR

- Full HIPAA compliance program (BAA, workforce training, physical safeguards)
- Encryption at rest / in transit vendor choices (H-05, H-06) — infrastructure
- CI “HIPAA linter” automation (H-08)
- GDPR erasure vs audit retention conflict (ADR-010 / post-MVP)

## Consequences

**Positive:**
- Notebook and API egress are first-class audit events, matching Flexible-mode assumptions
- Super-admin activity is visible; no privileged blind spot
- One ledger for JWT and API keys simplifies H-09 IRB reports and H-11 viewers
- Fail-closed PHI access aligns engineering behaviour with HIPAA audit controls
- Clear split from `usage_events` avoids diluting the compliance trail with clickstream noise

**Negative / risks:**
- High-volume data APIs (large notebook pulls) generate many rows — needs indexing, retention window UI, and eventual cold storage
- Fail-closed logging couples availability of the audit store to data API availability
- Taxonomy discipline required — inconsistent `action` strings undermine reports; treat action names as a versioned vocabulary
- Incomplete middleware coverage is a compliance gap — every PHI route must call the shared audit helper; CI/checklist (H-08) should eventually enforce this

## Alternatives not chosen

- **Separate logs for API keys vs UI:** Rejected — splits the compliance story and complicates IRB reports.
- **Log mutations only (skip reads):** Rejected — Flexible-mode risk is primarily read/export egress; HIPAA audit controls cover examination of ePHI access, not only changes.
- **Rely on reverse-proxy / SIEM access logs alone:** Rejected as primary control — lacks named user, key id, dataset scope, and row counts bound to W4H ACL.
- **Fail-open on audit write errors:** Rejected for PHI and privileged paths — a silent gap in the ledger is worse than a temporary 5xx.
- **Per-request full query text or result samples in `details`:** Rejected — recreates PHI in the audit store; prefer hashes/fingerprints and counts.
- **Full audit table on Super admin home:** Rejected — home is ops/KPI snapshot + deep links; filterable ledger stays on `/admin/audit-log` (MVP §15.1).
- **Raw audit browse for project owners:** Rejected — owners get project-scoped IRB reports (H-09b) only; H-11 reserves raw browse for Super admin and Team admin.

## Changelog

| Date | Change |
|---|---|
| 2026-07-15 | Initial draft — event set, fail-closed PHI writes, H-11 view/export roles, split from usage telemetry. |
| 2026-07-20 | Documented operator UI surfaces: Super admin `/admin/home` KPIs + audit/usage deep links; Team admin home IRB reports; project-owner scoped reports without raw browse. |
| 2026-07-20 | Super admin home attention strip: invites pending, datasets without team, teams without Team admin, backup reminder, HIPAA checklist link (H-12a). |
| 2026-07-20 | Implementation started: `GET /config/admin-home` snapshot + Platform Admin home UI; stub audit/usage pages (still 🚧 for full ledger/viewer). |
| 2026-07-20 | Super admin audit log viewer: `GET /config/audit-log` with filters, pagination, CSV export; `audit.view` / `audit.export` self-logging; shared `lib/utils/audit.js`. |
| 2026-07-22 | Usage surface renamed to `/admin/usage` (SC-CTSI study metrics, MVP D-19*); clarified identified local usage vs anonymous telemetry vs HIPAA audit. |

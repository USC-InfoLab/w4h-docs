---
title: HIPAA Compliance
description: How W4H supports HIPAA Security Rule requirements through audit
  logging, access controls, and data handling practices.
---

## Overview

<p class="lead">W4H is designed to support deployments that handle Protected Health Information (PHI). This page describes the built-in controls that help operators meet the requirements of the <strong>HIPAA Security Rule (45 CFR Part 164)</strong>.</p>

<div class="alert alert-warning mt-3">
  <strong>Disclaimer:</strong> W4H provides technical controls to <em>support</em> HIPAA compliance. Achieving and maintaining compliance is the responsibility of the covered entity or business associate operating the platform. Consult your compliance officer and legal counsel.
</div>

---

## Audit Logging (§164.312(b))

The HIPAA Security Rule requires that covered entities implement hardware, software, and/or procedural mechanisms that **record and examine activity in information systems** that contain or use ePHI.

W4H records an entry in the `w4h.audit_log` table for every significant action taken by a user.

### What is logged

| Action category | Example events |
|---|---|
| **Authentication** | Login success, login failure, logout, token expiry |
| **Subject / PHI access** | View subject record, query timeseries data |
| **Data management** | Import dataset, delete dataset, export data |
| **User management** | Create user, update user role, delete user |
| **Configuration** | Change database settings, change SMTP settings |
| **Documentation** | Export documentation backup |

### Audit log schema

Each row in `w4h.audit_log` captures:

| Column | Type | Description |
|---|---|---|
| `id` | BIGSERIAL | Immutable sequential identifier |
| `timestamp` | TIMESTAMPTZ | UTC time of the event |
| `user_id` | INTEGER | References `w4h.users(id)` |
| `action` | VARCHAR(100) | Dot-notation action, e.g. `subject.view` |
| `resource_type` | VARCHAR(100) | Type of resource affected, e.g. `dataset` |
| `resource_id` | TEXT | Identifier of the affected record |
| `ip_address` | INET | Source IP address from the HTTP request |
| `user_agent` | TEXT | Browser / client user-agent string |
| `details` | JSONB | Structured context (query params, counts, etc.) |

### Retention

HIPAA requires audit logs to be retained for a minimum of **6 years** from the date of creation or the date when it last was in effect. W4H does not automatically delete audit log rows. Establish a database backup and archival policy consistent with this requirement before going into production.

<div class="alert alert-info">
  <strong>Tip:</strong> To prevent accidental deletion, consider granting the API database user <code>INSERT</code> on <code>w4h.audit_log</code> but <em>not</em> <code>DELETE</code> or <code>TRUNCATE</code>.
</div>

---

## Authentication Controls (§164.312(d))

W4H implements the following authentication safeguards:

- **Password storage** — passwords are hashed with bcrypt (cost factor ≥ 10) before being stored. Plaintext passwords are never persisted.
- **JWT session tokens** — after login, the server issues a signed JSON Web Token. The token is short-lived and must be presented on every subsequent request.
- **All API routes require authentication** — every endpoint except `POST /users/login` and `GET /config/status` requires a valid token. Requests without a token receive `401 Unauthorized`.
- **Role-based access control** — users have a `role` field (`admin` or standard). Administrative endpoints (user management, configuration) reject non-admin tokens with `403 Forbidden`.

---

## Automatic Logoff (§164.312(a)(2)(iii))

HIPAA requires a mechanism to terminate an electronic session after a predetermined period of inactivity. JWT tokens issued by W4H have a configurable expiry. When the token expires, the user must re-authenticate. The frontend detects `401` responses and redirects to the login page.

---

## Data Integrity (§164.312(c))

- Database writes use parameterised queries via the `pg` driver — no string interpolation of user-supplied values. This prevents SQL injection and helps ensure that data written to the database accurately reflects the intended operation.
- Audit log rows are append-only by design. No W4H API route updates or deletes audit log rows.

---

## Usage Analytics vs. Audit Logging

W4H includes two distinct tracking mechanisms that serve different purposes:

| | Audit Log | Usage Events | Anonymous Telemetry |
|---|---|---|---|
| **Location** | Your PostgreSQL DB | Your PostgreSQL DB | External (W4H project) |
| **Purpose** | HIPAA §164.312(b) compliance | Efficiency metrics, ROI reporting | Product improvement |
| **Contains user identity** | Yes | Yes (user_id) | No — fully anonymised |
| **Can be disabled** | No — always active | Configurable | Yes — opt-in toggle in Settings |
| **Who sees it** | Your organisation | Your organisation | W4H maintainers |

The **"Enable anonymous usage data"** toggle in **Settings → Usage Tracking** controls only whether anonymised, non-identifiable product telemetry is sent to the W4H project. It has no effect on the audit log or local usage events table.

---

## Configuring the Database User

For a production deployment, restrict the PostgreSQL role used by W4H to the minimum required privileges. The audit log should be append-only:

```sql
-- Grant normal API access
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA w4h TO w4h_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA w4h TO w4h_app;

-- Harden the audit log — remove DELETE privilege
REVOKE DELETE ON w4h.audit_log FROM w4h_app;
```

---

## Checklist for Operators

Use this checklist before processing real PHI:

<ul>
  <li> Audit logging is active and rows are appearing in <code>w4h.audit_log</code></li>
  <li> Database backups are scheduled and tested</li>
  <li> Audit log rows are retained for at least 6 years (backup/archive policy in place)</li>
  <li> The database user does not have <code>DELETE</code> on <code>w4h.audit_log</code></li>
  <li> JWT token expiry is set to an appropriate session length</li>
  <li> Transport is encrypted (HTTPS / TLS) — do not run W4H over plain HTTP in production</li>
  <li> Database connection uses TLS (set <code>DB_SSL=true</code> in <code>.env</code>)</li>
  <li> A Business Associate Agreement (BAA) is in place with any cloud infrastructure provider</li>
  <li> A HIPAA Risk Analysis has been completed for your deployment</li>
</ul>

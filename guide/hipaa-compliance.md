---
title: HIPAA Compliance
description: How W4H supports HIPAA Security Rule requirements through audit
  logging, access controls, and data handling practices.
updated_by: nocera@usc.edu
updated_at: 2026-05-31T22:16:30.000Z
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
| **Break-glass** | Emergency admin password reset |

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

- **Password storage** — passwords are hashed with bcrypt using a configurable cost factor (set via `BCRYPT_ROUNDS` in `.env`, default 12). Plaintext passwords are never persisted. Higher values increase resistance to brute-force attacks at the cost of login latency — 12 rounds (~300ms) is the recommended minimum for HIPAA deployments.
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

## Break-Glass Procedure: Emergency Admin Password Reset

In the event that the primary administrator account is locked out and the standard email-based password reset flow is unavailable, W4H provides a break-glass command via the W4H CLI.

<div class="alert alert-warning">
  <strong>HIPAA Notice:</strong> Use of this procedure must be documented in your organization's HIPAA incident log. Unauthorized use constitutes a HIPAA violation. This command is only to be executed by a designated system administrator with authorized SSH access to the server.
</div>

### When to use

Only when **all** of the following are true:

- The admin account is locked out or credentials are unknown
- The email-based password reset flow is unavailable (e.g. SMTP not configured)
- The person performing the reset is an authorized system administrator covered by your BAA

### What the command does

- Prompts for the performing administrator's name and reason for reset (required for audit trail)
- Accepts the new password via a hidden interactive prompt — the password is **never passed as a command-line argument** and is never written to shell history
- Hashes the password with bcrypt at the configured `BCRYPT_ROUNDS` cost factor
- Writes an audit log entry to `w4h.audit_log` with action `BREAK_GLASS_PASSWORD_RESET`
- Falls back to a local `break-glass-audit.log` file if the audit log table is unavailable

### How to run

```bash
cd w4h-api
node cli/w4h.js reset-password
```

<div class="alert alert-danger">
  <strong>Never</strong> reset a password by passing it directly on the command line (e.g. <code>node cli/w4h.js reset-password admin@example.com MyPassword123</code>). Command-line arguments are visible in the process list (<code>ps aux</code>), recorded in shell history (<code>~/.bash_history</code>), and may appear in system logs — all of which are potential sources of unauthorized disclosure under HIPAA. The break-glass command accepts the new password via a hidden interactive prompt only.
</div>

### Required documentation

Before running the command, record the following in your HIPAA incident log:

- Date and time
- Name of the administrator performing the reset
- Reason for the reset
- Ticket or incident number (if applicable)

After running, notify your Privacy Officer within 24 hours if the reset was triggered by a security concern.

### Post-reset steps

1. Verify the audit log entry was written to `w4h.audit_log`
2. The affected admin should change their password immediately after regaining access
3. Investigate and document the root cause of the lockout

---

## Usage Analytics vs. Audit Logging

W4H includes two distinct tracking mechanisms that serve different purposes:

| | Audit Log | Usage Events | Anonymous Telemetry |
|---|---|---|---|
| **Location** | Your PostgreSQL DB | Your PostgreSQL DB | External (W4H project) |
| **Purpose** | HIPAA §164.312(b) compliance | CTSI study assessments (adoption, latency/workflow metrics, knowledge transfer); efficiency / ROI reporting | Product improvement |
| **Contains user identity** | Yes | Yes (user_id) | No — fully anonymised |
| **Can be disabled** | No — always active | Configurable | Yes — opt-in toggle in Settings |
| **Who sees it** | Your organisation | Your organisation (`/admin/usage`) | W4H maintainers |
| **Operator UI** | `/admin/audit-log` | `/admin/usage` (menu **Usage**) | Settings only |

The **"Enable anonymous usage data"** toggle in **Settings → Usage Tracking** controls only whether anonymised, non-identifiable product telemetry is sent to the W4H project. It has no effect on the audit log or the local usage events table used for study metrics.

---

## PHI-safe AI chat

The optional in-app assistant ([ADR-014]({{APP_URL}}/docs/ADR-014-ai-assistant-claude)) is labeled **PHI-safe AI chat** when the egress filter is in its default **strict** mode.

| Mode | Who sets it | Behavior |
|------|-------------|----------|
| **PHI-safe (strict)** — default | Team admin (team key) / Super admin (platform key) | Only metadata, Help/docs, and allowlisted context may be sent to Claude. Subject IDs, raw wearable rows, and query result cells are blocked. |
| **Permissive** | Same, explicit opt-in | Still no bulk row injection; risky pastes require confirmation. Shows a warning that chat is **not** PHI-safe. |

- Anthropic API keys are **team-scoped** (the team pays) or optional **platform** key for Super admin ops — never stored in the browser.
- Chat transcripts are **not** the HIPAA audit log. Blocked sends appear in usage metrics; PHI-class tool use under permissive mode is audited.
- The filter is defense-in-depth. Institutions remain responsible for BAAs and policy when using third-party LLMs.

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

- Audit logging is active and rows are appearing in `w4h.audit_log`
- Database backups are scheduled and tested
- Audit log rows are retained for at least 6 years (backup/archive policy in place)
- The database user does not have `DELETE` on `w4h.audit_log`
- JWT token expiry is set to an appropriate session length
- `BCRYPT_ROUNDS` is set to 12 or higher in `.env`
- Transport is encrypted (HTTPS / TLS) — do not run W4H over plain HTTP in production
- Database connection uses TLS (set `DB_SSL=true` in `.env`)
- A Business Associate Agreement (BAA) is in place with any cloud infrastructure provider
- A HIPAA Risk Analysis has been completed for your deployment
- If AI chat is enabled: team/platform Claude keys are configured intentionally; **PHI-safe (strict)** remains the default unless institutional policy allows permissive mode (ADR-014)
- Break-glass password reset procedure is documented and access is restricted to authorized system administrators only
- SSH access to the server is restricted to authorized administrators only
- Passwords are never passed as command-line arguments — always use the interactive prompt

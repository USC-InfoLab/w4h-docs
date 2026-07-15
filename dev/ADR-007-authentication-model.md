---
title: ADR-007 — Authentication model
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-05T01:23:50.000Z
---
**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-07-05  
**Relates to:** ADR-006 (deployment modes), ADR-004 (ACL roles), ADR-010 (soft-delete)  
**References:**
- W4H MVP Requirements §4 (User Management, U-06, U-10, U-11)
- W4H MVP Requirements §6.3 (API Key Data Access, D-16–D-21)

---

## Context

W4H operates in two deployment modes (ADR-006). Each mode has different authentication requirements:

- **Flexible mode** — researchers work locally or on external compute. No interactive MFA session is practical for scripted access. Needs a stable embeddable credential.
- **TRE mode** — all access is via a managed notebook session inside the TRE. MFA is enforced at login. The session credential is injected automatically.

Both modes must satisfy HIPAA's core identity requirements: unique user identification, immediate revocation on discontinuation, and a complete audit trail tied to a named individual.

## Decision

Authentication is mode-dependent. In both modes, every data access event is logged with the authenticated user identity.

---

### Flexible mode — personal API key

The primary credential for Flexible mode deployments.

A researcher generates a personal API key from the W4H UI after logging in (username + password). The key is tied to their user account, scoped to their project memberships, and used for all programmatic data access — local notebooks, HPC scripts, cloud GPU jobs.

**Controls:**

| Control | Detail |
|---|---|
| Per-user, non-shared | Each key is issued to a named individual; no team or shared keys |
| Project-scoped | Access limited to datasets in the researcher's assigned projects (D-17) |
| Read-only | No write, ingest, admin, or DDL operations via API key |
| Configurable TTL | Expiry set at creation; expired keys rejected; user reissues (D-20) |
| Multiple keys permitted | One per use case — "laptop", "HPC script", "cloud job" |
| Immediate revocation on discontinuation | All keys invalidated the moment a user is discontinued (D-21, U-10) |
| Resumed users must reissue | Old keys remain revoked after resume; user generates new ones (U-11) |
| Full audit log | Every request logged: user ID, key ID, dataset, timestamp, row count, IP (D-18) |

**`w4h_app.api_keys` table:**

```sql
CREATE TABLE w4h_app.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES w4h_app.users(id),
  key_hash      text NOT NULL,         -- SHA-256; plaintext never stored
  label         text NOT NULL,         -- user-provided: "laptop", "HPC script"
  expires_at    timestamptz NOT NULL,  -- mandatory; set at creation
  last_used_at  timestamptz,
  revoked       boolean DEFAULT false,
  revoked_at    timestamptz,
  revoked_by    uuid,                  -- user_id or system for auto-revocation
  created_at    timestamptz DEFAULT now()
);
```

Key issuance: researcher logs in to the web UI, navigates to profile → API keys → "Generate new key", sets a label and TTL. Plaintext key shown once only — researcher copies it. Platform stores SHA-256 hash only.

**Researcher experience:**

```python
import w4h

# Key in environment variable — never hardcoded
session = w4h.connect(api_key=os.environ["W4H_API_KEY"])

datasets = session.list_datasets()
df = session.query("SELECT subject_id, ts, bpm FROM ds42_heart_rate")

# Works identically from local laptop, HPC cluster, or cloud GPU instance
```

**Admin visibility (D-19):** Team admin and Super admin view key analytics at `/admin/api-usage` — label, user, created/expiry/last-used, revocation status, per-request usage log. Plaintext key never visible — label and hash prefix only (e.g. `w4h_sk_a3f2...`).

---

### TRE mode — JWT from IdP

The credential for TRE mode deployments (post-MVP).

Authentication is delegated entirely to an institutional IdP via OIDC or SAML. W4H never handles passwords. The JWT is injected into the researcher's JupyterHub session automatically — no credential management required.

```
Researcher → IdP login → username + password + MFA
→ short-lived JWT (1–8h) → injected into JupyterHub session
→ every W4H API call carries JWT automatically
→ 15-minute idle timeout → re-authentication required
```

JWT validation checks: signature, expiry, and a server-side invalidation list. Discontinuing a user immediately adds their active JWTs to the invalidation list.

IdP options: institutional LDAP/AD (via OIDC bridge), university SAML (Shibboleth), managed (Okta, Azure AD, Keycloak). W4H is IdP-agnostic.

---

### Service accounts — both modes

Unattended automated workloads (Spark jobs, ETL pipelines) use service account keys in both modes. These are machine identities, not user credentials.

| Control | Detail |
|---|---|
| IP-restricted | Only requests from the registered IP range accepted |
| Dataset-scoped | Explicitly named datasets only — not project-wide |
| Read-only | No write, admin, or DDL operations |
| Mandatory expiry | 90 days maximum; rotation enforced |
| Human owner | Named accountable user; keys disabled when owner is discontinued |

```sql
CREATE TABLE w4h_app.service_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  owner_user_id   uuid NOT NULL REFERENCES w4h_app.users(id),
  trial_id        uuid NOT NULL,
  dataset_ids     uuid[] NOT NULL,
  key_hash        text NOT NULL,
  ip_allowlist    inet[] NOT NULL,
  expires_at      timestamptz NOT NULL,
  disabled        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  last_used_at    timestamptz
);
```

---

### Credential summary

| Mode | Principal | Credential | MFA | Expiry | Scope |
|---|---|---|---|---|---|
| Flexible | Project user | Personal API key | No — ACL + audit compensate | Configurable TTL | Assigned project datasets, read-only |
| Flexible | Super admin / Team admin | Username + password (web UI) | Optional per institution | Web session | Admin functions only |
| Flexible | Any user (optional) | Email one-time code (SMTP required) | No — compensates with short TTL + audit | 10 min code / JWT session | Same as password login |
| TRE | Any user | JWT from IdP | Yes — enforced | 1–8h, 15min idle | Role-scoped |
| Both | Automated workload | Service account key | No — IP restriction compensates | 90 days max | Named datasets, IP-restricted |

---

## Consequences

**Positive:**
- Flexible mode is immediately usable by researchers with no infrastructure overhead — local notebooks, HPC, cloud GPU all work identically
- Personal API keys tied to named users satisfy HIPAA unique user identification; the audit log satisfies access logging requirements
- Immediate revocation on discontinuation is enforced at the database level — a single UPDATE covers all keys
- TRE mode provides the strong containment model for regulated deployments when needed
- Service account model is identical across both modes — no special handling for Spark/ETL

**Negative / risks:**
- Flexible mode data leaves the platform — the institution owns the compliance posture for data on researcher machines. Must be documented clearly in deployment guides
- API key leakage risk — key committed to a git repo exposes access until revoked. Mitigations: short TTLs, environment variable guidance, future secret-scanning integration
- No MFA in Flexible mode web UI login for MVP — institutions with strict MFA requirements should deploy TRE mode or add an IdP in front of the web UI

## Changelog

| Date | Change |
|---|---|
| 2026-07-04 | Initial — two-credential model (JWT for humans, service account for automation) |
| 2026-07-05 | Revised — aligned with two deployment modes (ADR-006). Flexible mode uses personal API keys; TRE mode uses JWT from IdP. Removed blanket rejection of API keys for human users. |
| 2026-07-15 | Added optional email OTP login for Flexible mode web UI when SMTP is configured (`POST /users/send-code`, `POST /users/verify-code`). Short-lived hashed codes; password login remains primary. Not a substitute for institutional MFA in TRE mode. |
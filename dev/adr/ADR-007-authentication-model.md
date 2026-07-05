# ADR-007 — Authentication model: three-credential model

**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-07-04  
**Relates to:** ADR-006 (TRE model), ADR-004 (ACL roles), ADR-010 (soft-delete)  
**References:**
- W4H MVP Requirements §4 (User Management, U-06, U-10, U-11)
- W4H MVP Requirements §6.3 (API Key Data Access, D-16–D-21)

---

## Context

W4H has three distinct access patterns that need authentication:

1. **Interactive sessions** — researchers and admins using the web app or TRE JupyterHub
2. **Programmatic data access** — researchers querying the data API from local scripts or notebooks outside the TRE
3. **Unattended automated workloads** — Spark jobs, ETL pipelines, scheduled modeling with no human present

A single credential type cannot satisfy all three. Interactive sessions need MFA and session timeout. Programmatic access needs a stable embeddable credential without interactive MFA. Unattended workloads need machine identities with IP restriction and mandatory rotation.

HIPAA requires:
- Unique user identification — no shared credentials
- Automatic session termination after inactivity
- MFA for remote access to PHI
- Audit log tied to an authenticated identity for every data access event
- Immediate access revocation when a user is discontinued (U-10)

## Decision

W4H uses a **three-credential model**:

| Credential | Principal | Use case | MFA | Expiry |
|---|---|---|---|---|
| JWT (from IdP) | Human user | Web app, TRE notebook session | Yes — required | 1–8h, 15min idle |
| Personal API key | Human researcher | Programmatic data API (scripts, local notebooks) | No — compensating controls | Configurable TTL; revoked on discontinuation |
| Service account key | Automated workload | Spark jobs, ETL pipelines, scheduled modeling | No — compensating controls | 90 days max; IP-restricted |

---

### Credential 1 — JWT (interactive sessions)

Authentication is fully delegated to an external IdP via OIDC or SAML. W4H never handles passwords.

```
Researcher → IdP login page → username + password + MFA
→ short-lived JWT (1–8h) → injected into JupyterHub session automatically
→ every W4H API call carries the JWT — researcher manages nothing
→ 15-minute idle timeout → re-authentication required
```

Researcher's TRE notebook experience:

```python
import w4h
# No login call — JWT injected by JupyterHub automatically
datasets = w4h.list_datasets()
df = w4h.query("SELECT subject_id, ts, bpm FROM ds42_heart_rate")
```

IdP options: institutional LDAP/Active Directory (via OIDC bridge), university SAML (Shibboleth), or managed (Okta, Azure AD, Keycloak). W4H is IdP-agnostic — it only consumes JWTs.

JWT validation checks: signature (IdP public key), expiry, and a server-side invalidation list. Discontinuing a user (U-10) immediately adds all their active JWTs to the invalidation list.

---

### Credential 2 — Personal API key (programmatic data access)

A researcher generates a personal API key from the W4H UI within an MFA-authenticated session. It provides access to the **data API only** — read-only queries against datasets in their project memberships.

**Compensating controls for absence of MFA:**

| Control | Detail |
|---|---|
| Data API only | Cannot access admin, user management, or sharing endpoints |
| Read-only | No write, ingest, or DDL operations |
| Project-scoped | Access limited to the researcher's current project memberships (D-17) |
| Configurable TTL | Expiry set at creation; expired keys rejected and must be reissued (D-20) |
| Multiple keys permitted | One per use case ("laptop", "analysis script") |
| Revoked on discontinuation | All personal API keys invalidated immediately when user is discontinued (D-21, U-10) |
| Resumed users must reissue | Old keys remain revoked after resume; user generates new keys (U-11) |
| Full audit log | Every request logged: user, key ID, dataset, timestamp, row count, IP (D-18) |

**`w4h_app.api_keys` table:**

```sql
CREATE TABLE w4h_app.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES w4h_app.users(id),
  key_hash      text NOT NULL,         -- SHA-256; plaintext never stored
  label         text NOT NULL,         -- user-provided: "laptop", "analysis script"
  scoped_project_ids uuid[],           -- NULL = all current project memberships
  expires_at    timestamptz NOT NULL,  -- mandatory; set at creation
  last_used_at  timestamptz,
  revoked       boolean DEFAULT false,
  revoked_at    timestamptz,
  revoked_by    uuid,                  -- user_id of revoker, or system for auto-revocation
  created_at    timestamptz DEFAULT now()
);
```

Key issuance: the researcher navigates to profile → API keys → "Generate new key", sets a label and TTL. The plaintext key is shown once in the UI (never again or stored). Subsequent API calls use `Authorization: Bearer w4h_sk_...`.

**Researcher experience in a local notebook:**

```python
import w4h
session = w4h.connect(api_key=os.environ["W4H_API_KEY"])
df = session.query("SELECT subject_id, ts, bpm FROM ds42_heart_rate LIMIT 1000")
```

---

### Credential 3 — Service account key (unattended workloads)

For Spark jobs and ETL pipelines with no human present. Distinct from personal API keys:

| | Personal API key | Service account key |
|---|---|---|
| Issued to | Named human user | Named machine identity |
| Scope | User's project memberships | Explicitly named datasets |
| IP restriction | No | Yes — Spark cluster IPs only |
| Expiry | Configurable TTL | 90 days maximum |
| Revoked on user discontinuation | Yes — automatically | Only if human owner is discontinued |

**`w4h_app.service_accounts` table:**

```sql
CREATE TABLE w4h_app.service_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,           -- e.g. "spark-trial-abc-hrv-model"
  owner_user_id   uuid NOT NULL REFERENCES w4h_app.users(id),
  trial_id        uuid NOT NULL,
  dataset_ids     uuid[] NOT NULL,
  key_hash        text NOT NULL,
  ip_allowlist    inet[] NOT NULL,
  expires_at      timestamptz NOT NULL,    -- max 90 days
  disabled        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  last_used_at    timestamptz
);
```

Key rotation: keys within 7 days of expiry return `KEY_ROTATION_REQUIRED`; keys past expiry are rejected entirely.

---

### Admin visibility (D-19)

Group Admin and Super-Admin can view API key analytics at `/admin/api-usage`:
- Key label, user, created/expiry/last-used dates, revocation status
- Per-key usage logs: dataset, timestamp, row count, IP
- Plaintext key is never visible — only the label and hash prefix (e.g. `w4h_sk_a3f2...`)

## Consequences

**Positive:**
- Satisfies D-16–D-21 fully
- Personal API keys are generated within an MFA-authenticated session — identity is bound at creation time
- Revocation on discontinuation is enforced at the database level — a single UPDATE covers all keys for a discontinued user
- Researchers have a stable credential for scripted work without interactive re-authentication
- Three clearly distinct credential types with no ambiguity about which applies to which use case

**Negative / risks:**
- API key leakage — a key committed to a git repo exposes data access until revoked. Mitigations: short TTLs, environment variable guidance in docs, future secret-scanning in CI/CD
- No IP restriction on personal API keys — a stolen key can be used from anywhere until revoked. Accepted: researchers work from varied locations; short TTLs and immediate revocation on discontinuation are the primary mitigations
- Three credential types require clear UX in `/admin/api-usage` and `/admin/users/:id` to avoid confusion

## Alternatives not chosen

- **JWT only for all human access:** Rejected — interactive MFA login is not practical for scripted/programmatic access; researchers need a stable embeddable credential for notebook scripts.
- **Single API key for all access (human and machine):** Rejected — does not satisfy HIPAA unique user identification; a shared or role-level key cannot be tied to an individual's audit trail.
- **OAuth client credentials for human programmatic access:** Considered as a way to unify tiers 2 and 3. Rejected — client credentials flows have no standard way to enforce project-scoped access or tie revocation to a user lifecycle event (discontinuation).

## Changelog

| Date | Change |
|---|---|
| 2026-07-04 | Initial version — two-credential model (JWT + service account key only) |
| 2026-07-04 | Revised to three-credential model — added personal API key tier after reconciling with requirements D-13, D-16–D-21 which specify personal API keys for researcher programmatic data access |
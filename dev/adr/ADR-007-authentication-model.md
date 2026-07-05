# ADR-007 — Authentication model: human users and service accounts

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team  
**Relates to:** ADR-006 (TRE model), ADR-004 (ACL roles)

---

## Context

W4H has two distinct types of principals that need to access data:

1. **Human researchers** — interactive, browser-based, working in Jupyter notebooks or the W4H UI inside the TRE
2. **Automated workloads** — Spark jobs, pipelines, scheduled modeling tasks — running unattended inside the TRE with no human present

These two cases have fundamentally different authentication requirements. A single approach cannot satisfy both: human users need MFA and session management; automated workloads cannot interactively complete MFA.

HIPAA requires:
- Unique user identification — no shared credentials
- Automatic session termination after inactivity
- MFA for remote access to PHI (required by most IRBs even where HIPAA is silent)
- Audit log tied to an authenticated identity for every data access event

## Decision

Use a **two-tier authentication model**:

### Tier 1 — Human users (interactive)

Human authentication is handled entirely by the IdP. W4H does not implement its own login, password management, or MFA — it delegates entirely to the IdP via **OIDC** (preferred) or SAML.

**Flow:**

```
1. Researcher opens browser → TRE login page
2. Redirected to IdP → enters username + password + MFA (TOTP, hardware key, or push)
3. IdP issues short-lived JWT (access token, 1–8h) + refresh token
4. JupyterHub receives JWT → spawns user's notebook server → injects JWT into environment
5. Every W4H API call from the notebook carries the JWT automatically
6. Session times out after 15 minutes of inactivity (HIPAA recommended)
7. On timeout or logout → JWT invalidated server-side → re-authentication required
```

**Researcher experience in the notebook:**

```python
import w4h
# No login call needed — JWT already in environment via JupyterHub
datasets = w4h.list_datasets()
df = w4h.query("SELECT subject_id, ts, bpm FROM ds42_heart_rate")
```

**IdP options (in preference order for W4H deployments):**

| Context | Recommended IdP |
|---|---|
| Hospital / NHS trust | Institutional LDAP / Active Directory via OIDC bridge |
| University | Institutional SAML IdP (Shibboleth) or LDAP |
| Standalone / cloud | Okta, Azure AD B2C, or Keycloak (self-hosted) |

The IdP is a deployment configuration — the W4H application code only consumes JWTs and is IdP-agnostic.

**JWT validation (W4H API proxy):**

The proxy validates every request by checking:
- Signature valid (IdP public key)
- Not expired
- `sub` (subject) matches an active, non-disabled user in `w4h_app.users`
- `session_id` not in the server-side invalidation list (covers forced logout and account disable)

---

### Tier 2 — Service accounts (automated workloads)

Automated workloads (Spark jobs, ETL pipelines, scheduled modeling) use **service account credentials** — long-lived API keys with compensating controls in place of MFA.

**Service account controls (compensating for absence of MFA):**

| Control | Detail |
|---|---|
| Read-only | Service accounts can never write, share, admin, or trigger DDL |
| Dataset-scoped | Credentials grant access to specific named datasets only — not project-wide |
| IP-restricted | Only requests from the Spark cluster's IP range are accepted |
| Mandatory expiry | Maximum 90-day validity; automated rotation recommended |
| Human owner | Every service account has a named human owner who is accountable |
| Disabled on owner departure | When the owner's account is disabled, all their service accounts are disabled |
| Full audit log | Every query logged with service account ID, job ID, dataset, timestamp |

**Service account table:**

```sql
CREATE TABLE w4h_app.service_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,           -- e.g. "spark-trial-abc-hrv-model"
  owner_user_id   uuid NOT NULL REFERENCES w4h_app.users(id),
  trial_id        uuid NOT NULL,
  dataset_ids     uuid[] NOT NULL,         -- explicit dataset scope
  key_hash        text NOT NULL,           -- SHA-256, never store plaintext
  ip_allowlist    inet[] NOT NULL,         -- Spark cluster IPs, must be non-empty
  expires_at      timestamptz NOT NULL,    -- mandatory, max 90 days from creation
  disabled        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  last_used_at    timestamptz
);
```

**Key rotation:** The platform enforces rotation by refusing requests from keys within 7 days of expiry with a `KEY_ROTATION_REQUIRED` error, giving pipeline owners time to rotate without downtime. Keys past expiry are rejected entirely.

---

### What was rejected: API keys for human users

An earlier design considered issuing API keys to human users for notebook access. This was rejected because:

- An API key proves possession of a secret, not identity of a person
- A leaked key gives full access with no MFA barrier
- HIPAA requires authentication tied to a verified human identity
- The JWT issued by the IdP after MFA already serves this purpose — an additional API key adds complexity without security value

Human users authenticate via the IdP and receive a JWT. No API key is issued to human users.

---

### Summary

| Principal | Credential | MFA | Expiry | Scope |
|---|---|---|---|---|
| Researcher (interactive) | JWT from IdP login | Yes — required | 1–8h, 15min idle timeout | Projects assigned in W4H |
| Super admin | JWT from IdP login | Yes — always | 1h max, stricter idle | Platform-wide |
| Spark / pipeline | Service account key | No — compensating controls | 90 days max | Named datasets only |

## Consequences

**Positive:**
- Human authentication is fully delegated to the IdP — W4H never handles passwords
- MFA is enforced at the IdP level — cannot be bypassed at the application layer
- JupyterHub token injection means researchers have zero credential management burden
- Service account model satisfies HIPAA "equivalent alternative" provision for automated workloads
- Disabling a user in W4H immediately invalidates their JWT via the server-side invalidation list, and cascades to disable all their service accounts

**Negative / risks:**
- Requires an IdP to be deployed or integrated — adds an infrastructure dependency
- JWT invalidation requires a server-side store (Redis or a DB table) — pure stateless JWT validation is insufficient for HIPAA (a stolen JWT must be revocable before expiry)
- Service account IP allowlists must be kept current as Spark cluster IPs change (e.g. autoscaling pools) — requires operational process
- 90-day key rotation for service accounts requires pipeline owners to have a rotation process — document and enforce via platform tooling

## Alternatives not chosen

- **Passwords stored in W4H:** Rejected — W4H should never be in the business of managing passwords, reset flows, or MFA devices. Delegating to an IdP is more secure and reduces liability.
- **Single API key for all access:** Rejected — does not satisfy HIPAA unique user identification requirement, does not enforce MFA, and a single leaked key would compromise all access.
- **OAuth client credentials for human users:** Considered as a way to unify the two tiers. Rejected — client credentials flows do not support MFA or session timeout in a way that maps to human interactive use.

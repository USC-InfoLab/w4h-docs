---
title: "ADR-028 — Platform access requests"
description: A prospective PI with a verified USC email asks for platform access through a public form; the Super admin is notified and approves it (sending an Admin invitation). The Admin then creates their own teams.
updated_by: nocera@usc.edu
updated_at: 2026-10-04T00:00:00.000Z
---

**Status:** Accepted  
**Date:** 2026-10-04  
**Relates to:** ADR-004 (roles), ADR-007 (authentication), ADR-011 (audit), MVP §3.0 (onboarding), T-16–T-20

---

## Context

Onboarding separates duties (MVP §3.0): the Super admin decides **who may run trials on the platform**, never how a trial is set up. Until now a prospective PI had no way to ask. The Super admin created a team (`/admin/teams/add`) and then invited the PI (`/admin/users/add`) after hearing about them out of band — nothing recorded, nothing notified.

W4H is in a USC-only pilot. Anyone on the internet must not be able to queue requests or reach the Super admin, but real USC researchers should not have to email someone and wait for two manual steps.

## Decision

### 1. A public request form, limited to verified USC email addresses

`/request-access` (linked from the login screen) collects name, **USC email**, lab/department, and a short purpose (the page tells people not to include patient or study data). It creates **no account** and needs no login.

- **Domain allowlist:** the email's domain must match `ACCESS_REQUEST_ALLOWED_DOMAINS` (comma-separated, default `usc.edu`). The match is **exact**, never a suffix: `usc.edu.evil.com` fails. Other domains get a plain "USC only for now" error.
- **Mailbox verification:** typing an address proves nothing, so the request is saved as `unverified` and a **one-time, 24-hour link** is emailed to that address (token stored hashed). Opening the link — a `POST` from the confirmation page, so mail scanners that prefetch links cannot consume it — moves the request to `pending`.
- Unverified rows never notify anyone, are invisible to the Super admin, and are deleted once expired.

A USC address proves a USC mailbox, not that the holder is a *researcher*; students and staff have one too. The Super admin judges that from the affiliation and purpose.

### 2. Data model

`w4h.access_requests`: `name`, `email`, `affiliation`, `purpose`, `status` (`unverified` \| `pending` \| `fulfilled` \| `declined` \| `spam`), `verify_token_hash`, `verify_expires_at`, `verified_at`, `handled_by`, `handled_at`, `note`, `user_id`, `team_id`. A partial unique index allows **one open request** (unverified or pending) per email.

### 3. Notification

When a request is **verified**, W4H emails every active Super admin (best-effort — a mail failure never blocks the request), adds a **pending count** to the attention strip on `/admin/home` (`GET /config/admin-home` → `attention.access_requests_pending`), and shows a count badge on the **Requests** menu item (`GET /access-requests/count`).

### 4. Approving: the Super admin's only act

`/admin/access-requests` (Super admin only) lists requests by status. **Approve** sends the requester the **Admin invitation** (ADR-007 invite flow) at the verified address and records who approved it. **That is the whole job.** The Super admin **does not create teams and does not approve teams**: they decide only who may join the platform. **Decline** (optional note, optional email) and **Mark spam** close a request.

The invited account is `project_user` with `users.can_create_teams = true` and **no team membership**. After accepting the invitation the Admin lands on **Create your team** (`/team/new`), names their own team, and becomes its Admin; later they add more teams from the account menu (*New team*) without anyone's approval. `can_create_teams` only lets someone create teams — it grants nothing else, and until they have a team they can do nothing else (a project needs a team). If the email already has an account, it is flagged and notified instead of re-invited.

`POST /teams` is limited to Admins (an Admin on some team, or an approved Admin with the flag); a **Super admin gets 403**. They keep read/edit/deactivate over existing teams (MVP T-03, T-04). `GET /users/me/session` returns the refreshed teams and capabilities after the team is created.

### 5. Abuse protection and privacy

- Honeypot field; length caps; per-IP (5/h) and per-email (3/h) limits (`ACCESS_REQUEST_MAX_PER_IP`, `ACCESS_REQUEST_MAX_PER_EMAIL`); one open request per email; a `spam` address cannot request again.
- **No enumeration:** if the address already has an account or an open request, the form returns the same generic response and sends nothing.
- All requester-supplied text is HTML-escaped in emails (including the existing invitation email).
- The form needs SMTP and `APP_URL`; without them it answers "temporarily unavailable" instead of accepting requests nobody can verify.
- Submit, verify, fulfill, decline and spam are written to `w4h.audit_log` (ADR-011). Processed requests are kept for the audit trail; no PHI is collected.

## Alternatives considered

- **`mailto:` link, fully manual:** simple but leaves nothing recorded and nobody notified. Rejected as the MVP flow.
- **Domain check only (no verification):** anyone can type `x@usc.edu`. Rejected.
- **USC single sign-on (Shibboleth/SAML, `eduPersonAffiliation`):** proves identity *and* affiliation (faculty/staff/student) and would let the form skip mail verification. Needs USC IT registration; kept as a later upgrade of the same form.
- **CAPTCHA:** unnecessary while mailbox verification gates the queue; adds a third-party dependency.

## Consequences

- Closes MVP T-16–T-20. A new platform table, a public (unauthenticated) endpoint group `/access-requests`, a Super admin page, a menu badge, and an Admin **Create your team** page.
- The Super admin's onboarding job shrinks to reading one notification and clicking **Approve**. Team creation moves entirely to the Admin: the Super admin "Add Team" page is gone and `POST /teams` rejects Super admins.
- R-06 gets one narrow exception: an approved Admin has no team until their first sign-in (`users.can_create_teams`).
- Opening beyond USC later means adding domains (or moving to SSO), not redesigning the flow.

## Changelog

| Date | Change |
|---|---|
| 2026-10-04 | Approve sends only the Admin invitation; the Super admin neither creates nor approves teams — the Admin creates their own (`/team/new`). |
| 2026-10-04 | Accepted and implemented. USC-only via exact domain allowlist + email verification. |

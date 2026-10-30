---
title: Welcome — Super admin
description: First-time platform setup — SMTP, then approve PI access requests (the Admin creates their own team), and stay in Platform Admin.
card_title: Welcome — Super admin
action_label: Next steps
is_feature_card: true
card_order: 2
sort_order: 0
---

<p class="lead">
  You decide <strong>who</strong> may run trials by approving access requests. You do <strong>not</strong> create projects, ingest study data, or manage IRB for a PI.
  After login you stay in <strong>Platform Admin</strong> (<code>W4H Toolkit Admin</code>).
</p>

Longer walkthrough: [Quick Start](../quick-start.md) §1. Roles: [ADR-004](../dev/ADR-004-acl-roles.md). Onboarding model: MVP §3.0.

---

## Next steps

| Step | Where | Why |
|---|---|---|
| **1. SMTP** | Settings → Mail Server | Invitations and password resets. [SMTP Configuration](smpt-configuration.md). Set **`APP_URL`** to the public app URL so invite links work. |
| **2. Allowed domains** | API environment `ACCESS_REQUEST_ALLOWED_DOMAINS` | Which email domains may request access (default `usc.edu`; exact match, comma-separated). Needs SMTP and `APP_URL` from step 1. |
| **3. Onboard Admins** | **Access** (Platform Admin menu) | Review the **Pending** queue (self-service requests) and **Approve** or **Decline**. For someone you already know, use **Invite Admin…** on that page — same invitation, no team chosen for them. Admins always create their own team after sign-in. |
| **4. Refresh Help** | Settings → Documentation Management → **Refresh Docs** | Pulls pages from `w4h-docs` (including this checklist). |
| **5. Optional Claude** | Settings → PHI-safe AI chat | Platform key + per-team monthly quota, or leave teams to paste their own key. [PHI-safe AI chat](ai-chat.md). |
| **6. HIPAA checklist** | [HIPAA Compliance](hipaa-compliance.md) | Audit log, TLS, backups, BAA — before real PHI. |
| **7. Samples sandbox (ops)** | Platform **seed** / migrations (`w4h-sample`, docs fixtures) | Canonical **read-only** sample datasets and the W4H Samples project are loaded by seed jobs — not by Super admin in the dataset or project UI. |

The Team admin then works in the **app shell**. Point them to [Welcome — Admin](welcome-admin.md). Point project Users to [Welcome — User](welcome-user.md).

---

## First-run (empty database)

On a fresh install the login page walks you through:

1. **Connect PostgreSQL** — host, port, database, credentials. The `w4h` schema is created if the database user can create it.
2. **Create the Super admin account** — email and a strong password (12+ characters).
3. **Log in** — Platform Admin home. Change password from the account menu → Profile if needed.

Local development (clone, `npm run dev`): [Developer Setup](../dev/developer-setup.md). Docker: [Docker Deployment](docker-deployment.md).

---

## What you should not do

- Do not set up the PI’s projects, datasets, or shares.
- Do not switch into the app shell — there is no Admin-UI toggle for Super admin.
- Do not put real PHI in Help screenshots, GitHub issues, or AI chat.

---

## After bootstrap

Platform Admin home shows health (database, SMTP, audit log), usage, and attention (pending invites, teams without an Admin). Use **Audit log** and **Usage** for ops; those are not the same ledger ([HIPAA Compliance](hipaa-compliance.md)).

**Contributions** is only the **production listing**. Authors and the W4H team vet modules on a laptop or a **staging** deployment, as Admin, not here. You publish (or deprecate) a row after that. You do not ingest into a PI’s project. See [Contribute a module](contribute-a-module.md).

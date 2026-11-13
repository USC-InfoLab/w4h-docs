---
title: "ADR-031 — Built-in database install mode for single-computer pilots"
description: The Docker install offers a built-in PostgreSQL container next to the existing external-database option. The launcher generates per-machine secrets, first login creates the person's own Admin account and team, the Super admin gets a random password in a one-time recovery record, and updates replace only the app and API containers. Usage telemetry can be exported or emailed for pilot evaluation.
updated_by: nocera@usc.edu
updated_at: 2026-11-13T00:00:00.000Z
---

**Status:** Draft  
**Date:** 2026-11-13  
**Amends:** [ADR-015](ADR-015-docker-deployment-packaging.md) (PostgreSQL is external **or** built-in), [ADR-028](ADR-028-platform-access-requests.md) (single-user install bootstrap)  
**Relates to:** ADR-004 (roles), ADR-007 (authentication), ADR-011 (audit), MVP §14 (Dep-04, Dep-06–Dep-08), §6.3 (D-18, D-19, D-19f), §4.2 (U-13–U-16, U-19), §17 M5 and M8  
**Implementation plan:** [Built-in install: implementation plan](builtin-install-implementation-plan.md)

---

## Context

We want pilot testers to run W4H on their own computers. Most of them have never used Docker, and some will load sensitive data. Nothing is deployed yet.

Today (ADR-015) `w4h-docker` runs `app`, `api` and `notebooks` against an **external** PostgreSQL that the operator provides. It builds images from about six sibling repos, and the first-run wizard only creates a **Super admin** (`w4h-api/lib/db-init.js`, `createInitialAdmin`). Under ADR-004 and ADR-028 a Super admin does no team work. An Admin normally arrives through an access request, which needs SMTP and a verified USC email. None of this suits one person on a laptop.

Constraints:

- **No shared secrets.** Each install has its own database password and `TOKEN_SECRET`. The images carry no credentials.
- **No Docker knowledge needed** after Docker Desktop is installed: double-click launchers and a browser.
- **Updates keep the data.** Replacing the app and API must not touch the database or its connection.
- **Pilot evaluation (M8)** needs usage data from each tester and from the people they invite.

## Decision

### 1. Two install options in the normal product, not a separate "demo" build

The setup wizard's first step asks:

- **Built-in database (this computer)**: PostgreSQL runs in a `db` container in the same Compose stack.
- **Connect to your own PostgreSQL**: today's flow, unchanged.

A separate **Load sample data** checkbox seeds the synthetic samples with either option. It is not called "demo mode", because built-in installs may hold real data and nothing about them is disposable.

### 2. The database stays a separate container

`db` is its own service, in a Compose profile (`builtin`). It has a pinned major version (`postgres:16`), a named volume, and **no published port**. Only `api` reaches it, over the Compose network. The Compose project name is fixed (`name: w4h`), so the volume name doesn't depend on which folder the files sit in.

When someone picks their own PostgreSQL, the launchers stop starting the `builtin` profile and remove the idle `db` container and its empty volume.

### 3. Secrets are generated on the machine, before Postgres first starts

The **Install** launcher creates `secrets/pg_password` and `data/.env` (with `TOKEN_SECRET`), readable by the owner only, if they don't exist yet. Postgres is created with that password, so no default password ever exists. The `api` container reads the password from a read-only secret mount when built-in is chosen.

`TOKEN_SECRET` is never offered for change in the UI, because it also wraps stored API keys.

### 4. Single-user bootstrap (amends ADR-028)

In built-in mode, one setup step:

- creates the person's account with **their own password**
- creates their team and makes them its **Admin** (`team_members.role = team_admin`)
- creates a **Super admin** with a **random password**, stored only as a hash
- issues API keys as at any other account creation (D-16a)

The Super admin password and the database credentials are returned **once**, and the wizard offers them as a **recovery record** download. The person must confirm they saved it. The same Super admin account still exists and can be used for Platform Admin; the person just doesn't need it day to day.

Access requests (ADR-028) are unchanged for external installs. In built-in mode **Request access** is hidden.

### 5. Invites unchanged

The Admin invites people as on any install (U-13–U-16). The intended pilot test is someone using the Admin's machine, who opens the invite email there; the `127.0.0.1` link works on that machine. Built-in mode therefore expects SMTP to be set (wizard or Settings) for invites, email-code login, Report an issue, and sending usage data.

**Sign in with email code** is hidden while mail isn't configured (U-19). No network-access option is added in this ADR.

### 6. Updates replace only `api`, `app` and `notebooks`

Images are published to a registry (Dep-04) and pinned by version. The **Update** launcher:

1. runs `pg_dump` into `backups/` (built-in mode)
2. pulls the new images
3. restarts only the app containers (`--no-deps`)
4. waits for `/config/status`

The new `api` reads the same `data/.env`, so the database connection, sessions and API keys carry over. On start the API re-applies `schema.sql` as today, which is safe to re-run. **Changes that `IF NOT EXISTS` can't express (renames, drops, data transforms) need explicit idempotent migration SQL and a release note.** A Postgres major-version upgrade is a separate, deliberate procedure (dump and restore).

There is **no in-app Update button**: it would need the Docker socket inside `api`, which amounts to control of the host.

### 7. Usage export for pilot evaluation

Super admins (whole platform) and Admins (their teams, same scoping as `/admin/usage`) can **download** `usage_events` as CSV or JSON, or **send** the same file to the W4H team by SMTP (`TELEMETRY_TO`). The export is per user but pseudonymous:

- `user_id` is replaced by `HMAC(install_id, user_id)`.
- `metadata` is reduced to an allow-list: status, method, a route template **without IDs**, row count.
- The header carries the random `install_id`, the W4H version and the database mode.
- No emails, names, dataset names or raw paths. The pseudonym-to-person mapping is shown only on the local Usage page.

The person previews exactly what will be sent. Both actions are audited (`usage.exported`, `usage.sent`). This is study-assessment data under D-18/D-19, not the HIPAA `audit_log`, which is never exported this way.

## Alternatives considered

| Alternative | Why not |
|---|---|
| PostgreSQL inside the `api` image | Every app update would also replace the database server, so the data would still need a volume. It ties the Postgres version to app releases, makes backups and password recovery harder, and a crash in one takes down both. |
| Ship a default database password and have the Admin change it in a dialog | There is a window where every install shares the same password, and installs where nobody changes it. Generating it at install time is simpler and leaves no window. |
| A "demo mode" | The name tells people the data is disposable and the protections relaxed. A storage choice plus a sample-data checkbox says what actually differs. |
| Always run `db`, even with an external database | It's cheap (tens of MB of memory when idle) but pointless. The profile and a one-time clean-up remove it. |
| In-app Update button | Needs the Docker socket inside `api`, which gives that container control of the host. |
| Raw `usage_events` with emails | More than pilot evaluation needs, and harder to defend under IRB and HIPAA review. |

## Consequences

- ADR-015's "PostgreSQL is external" becomes "external or built-in". `w4h-docker` gains a `db` service, launchers and published images.
- ADR-028 gains a bootstrap exception, **limited to built-in installs**. External installs keep the access-request path.
- The app gains a database-choice step, a recovery-record step, mail gating, and export and send actions on the Usage page. Roles and ACL don't change.
- Pilot testers need Docker Desktop (check its licence terms for the organization), about 1 GB of disk for images, and SMTP credentials to invite others.
- Losing the recovery record isn't fatal: the database password is in `data/.env`, and a Super admin can be recovered from the server (`w4h promote-super-admin`, U-18).
- Full-disk encryption on the tester's machine remains their responsibility. The HIPAA guide must say so.

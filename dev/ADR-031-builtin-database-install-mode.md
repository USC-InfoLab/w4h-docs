---
title: "ADR-031 — Built-in database install mode for single-computer pilots"
description: Pilot testers install a ready-to-use W4H with one Docker Compose command and update with the same command. PostgreSQL 18 and every runnable package ship in public images, each machine generates its own secrets, the first person signs up as Admin, and updates back up and preserve the local database.
updated_by: nocera@usc.edu
updated_at: 2026-11-22T00:00:00.000Z
---

**Status:** Draft  
**Date:** 2026-11-13 (revised 2026-11-22)  
**Amends:** [ADR-015](ADR-015-docker-deployment-packaging.md) (adds a packaged pilot install next to the external-database deployment), [ADR-028](ADR-028-platform-access-requests.md) (first-person bootstrap on pilot installs)  
**Relates to:** ADR-004 (roles), ADR-007 (authentication), ADR-011 (audit), ADR-022 and ADR-023 (running contributions), MVP §14 (Dep-04, Dep-06–Dep-08), §6.3 (D-18, D-19, D-19f, D-31), §4.2 (U-13–U-16, U-19), §17 M5 and M8  
**Implementation plan:** [Built-in install: implementation plan](builtin-install-implementation-plan.md)

---

## Context

We want pilot testers to run W4H on their own computers, with their own data. Most have never used Docker.

Today (ADR-015) `w4h-docker` builds `app`, `api` and `notebooks` from sibling repos and expects an **external** PostgreSQL. The first-run wizard creates only a **Super admin**, and an Admin normally arrives through an access request. The `api` image has no Python and bundles no importers, so most runnable contributions can't run in it (D-31). None of this suits one person on a laptop.

Constraints:

- **One command** to install and the same command to update, after Docker Desktop is installed.
- **No shared secrets.** Each install has its own database password, `TOKEN_SECRET` and Super admin password. The images carry no credentials.
- **Updates keep the data**, including across PostgreSQL major versions.
- **Everything ships in the images.** Every package the app marks as runnable works without a GitHub checkout.
- **Pilot evaluation (M8)** needs usage data and timed test sessions from each tester.

**Responsibility for data.** Testers load their own data, run their own installation, and are responsible for PHI handling under their HIPAA training and protocol. The W4H team has no access to a tester's data unless the tester grants it under IRB approval. Nothing leaves an install unless a person there chooses to send it (§8).

## Decision

### 1. A separate pilot package, with no database choice

The pilot package always includes its database. The setup wizard's **Built-in or external** choice is **removed**. External PostgreSQL remains the separate ADR-015 deployment, with its own Compose file and existing wizard, and is unchanged by this ADR.

The package is not called "demo mode", because it holds real data.

### 2. Install and update with one Compose command

The Compose file is published to Docker Hub as an OCI artifact, and all images are **public**, so testers need no zip, repository checkout, account or token:

```bash
docker compose -p w4h -f oci://docker.io/<docker-account>/w4h:test up -d --pull always
```

The same command installs and updates. An optional double-click file for macOS and Windows may wrap it. It holds no logic or secrets.

Publishing a Compose app rules out bind mounts and build-only services, so the pilot file uses named volumes and published images. Each release pins its images by digest (`docker compose publish --resolve-image-digests`), so the `test` tag always names one exact, tested set of images.

### 3. PostgreSQL 18 in its own container

`db` is a separate service based on **PostgreSQL 18**, with `fft_approximate` compiled in. It has **no published port**, and only `api` reaches it over the Compose network. Its volume mounts at `/var/lib/postgresql`, the layout PostgreSQL 18 images require, which also lets old and new major versions share one volume during an upgrade.

### 4. Secrets are generated on the machine and live in volumes

A one-shot `setup` service runs before `db`. If they don't already exist, it generates the database password and `TOKEN_SECRET` in the `w4h_config` volume, readable only by the service that needs them.

Secrets **must not** live in the install folder. The database volume outlives any folder, so a new folder with new secrets would lock the API out of the existing database and make stored API keys undecryptable.

`TOKEN_SECRET` is never offered for change in the UI, because it also wraps stored API keys.

### 5. Ready on first start, first person becomes Admin (amends ADR-028)

The stack initializes the schema and imports Help on its own. The first screen asks for **name, email and password**. That one step:

- creates the person's account, marked as the **install owner**
- creates their team and makes them its **Admin** (`team_members.role = team_admin`)
- creates a **Super admin** with a random password unique to this install
- issues API keys as at any other account creation (D-16a)

The password is required because email sign-in can't work before SMTP is set up. The step is refused once any user exists, and the app is published on `127.0.0.1` only.

Access requests (ADR-028) are unchanged for external installs and hidden on pilot installs.

### 6. Credential recovery by the install owner

The install owner can reveal the **database credentials and Super admin password** from Settings after re-entering their own password, like the existing API key reveal. The Super admin password is also stored encrypted under `TOKEN_SECRET`, and the stored copy is deleted if that password is later changed. Each reveal is audited (`install.credentials.reveal`, or `install.credentials.reveal_denied`).

This is limited to the install owner, **not every team admin**. Team admin is a per-team role (R-09), and these credentials control the whole install.

### 7. Email through the tester's Gmail

Settings offers a **Gmail** preset (`smtp.gmail.com`, port 587, STARTTLS). The Admin enters **their own** address and a Google **app password**, which requires 2-Step Verification. No mail credential ships in the images. Mail enables invites, email-code sign-in, Report an issue and sending logs.

**Sign in with email code** is hidden while mail isn't configured (U-19). Invites are unchanged (U-13–U-16). No network-access option is added in this ADR, so an invitee opens the link on the same computer.

### 8. Team logs and timed test sessions

**Test sessions.** A tester can press **Start test**, choose a task from a fixed list, and press **End test**. Each session records user, task, start, end and how it ended (`completed`, `abandoned` or `timed_out`). Tasks are not free text, so PHI can't be typed into the log.

**Team logs.** Super admins (whole platform) and Admins (their teams) can **download** usage events and test sessions as CSV or JSON, **email** the file to any address they choose, or **send** it to the W4H team (`TELEMETRY_TO`). The export is per user but pseudonymous:

- `user_id` is replaced by `HMAC(install_id, user_id)`.
- `metadata` is reduced to an allow-list: status, method, a route template **without IDs**, row count.
- The header carries the random `install_id`, the W4H version and the install type.
- No emails, names, dataset names, raw paths or participant data. The pseudonym-to-person mapping is shown only on the local Usage page.

The person previews exactly what will leave the install. Each action is audited (`usage.exported`, `usage.sent`). This is study-assessment data under D-18/D-19, not the HIPAA `audit_log`, which is never exported this way.

### 9. Updates preserve the database

Running the install command against a new release does the following, in order. **Any failure stops the update before the new API starts.**

1. `setup` keeps the existing secrets. If the PostgreSQL major version changed, it runs `pg_upgrade` into a new versioned directory in the same volume and **keeps the old directory** until the new server is verified.
2. `db` starts.
3. A one-shot `backup` service writes a `pg_dump` to the `w4h_backups` volume when the release has changed, and keeps the last five.
4. `api` applies pending migrations, each recorded in a `w4h.schema_migrations` table, then starts.
5. `app` and `notebooks` start.

`schema.sql` stays safe to re-run. Renames, drops and data transforms need an explicit, ordered migration and a release note. Moving to a newer PostgreSQL major is a deliberate release decision and must be tested against a copy of a previous release's data.

There is **no in-app Update button**, because it would need the Docker socket inside `api`, which amounts to control of the host.

### 10. All runnable packages ship in the images

The build bundles every contribution with `runnable = true` in `w4h.contributions`, at a pinned commit, along with any paired sample data. The `api` image gains Python and each importer's dependencies. In the pilot image the runner uses the bundled copies and **never clones from GitHub**. The build fails if a runnable package can't be bundled.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep a two-way wizard (built-in or external) | No pilot tester needs the choice, and it adds branching to setup, launchers and support. External stays a separate deployment. |
| Private images with a login token | Adds a token to distribute and revoke, and Docker Hub's free plan has one private repository. The code is already public or MIT-licensed. |
| Zip of launchers and Compose files | Testers would have to keep and replace files by hand. Compose can fetch the file from the registry. |
| Pre-seeded database in the image | Every install would share its credentials. |
| PostgreSQL inside the `api` image | Every app update would also replace the database server, and a crash in one takes down both. |
| PostgreSQL 19 now | Released 2026-11-19. PostgreSQL 18 is mature and supported to November 2030. |
| Shared W4H Gmail account in the image | A shared credential in public images. |
| Super admin password shown only once | A lost record would need command-line recovery, which these testers can't be expected to do. |
| In-app Update button | Needs the Docker socket inside `api`. |
| Raw `usage_events` with emails | More than pilot evaluation needs, and harder to defend under IRB and HIPAA review. |

## Consequences

- ADR-015 gains a second packaging path. Its external-database deployment is unchanged.
- ADR-028 gains a bootstrap exception, **limited to pilot installs**.
- `w4h-docker` gains a pilot Compose file, `setup`, `backup` and `db` images, and a release step that publishes multi-architecture images (`arm64`, `amd64`).
- The `api` image grows, because it now includes Python and all runnable importers.
- The API gains migration tracking, first-person setup, credential reveal, mail attachments, and team-scoped log export. Roles and ACL don't change.
- Compose must stop overriding saved SMTP settings. It currently sets empty `SMTP_*` variables, and `dotenv` won't replace them, so mail saved in Settings is lost on restart.
- `w4h-data-recorder-csv-file-importer` and `w4h-embraceplus-csv-file-importer` are public as of 2026-11-22, after a history scan for secrets and participant data.
- Testers need Docker Desktop (check its licence terms for their organization) and disk space for the images and their data.
- Backups live on the tester's computer, so they don't protect against losing that computer. Full-disk encryption and off-machine copies are the tester's responsibility, and the install guide must say so.
- `docker compose down -v` or deleting the Docker volumes **destroys the data**. The install guide must say so.

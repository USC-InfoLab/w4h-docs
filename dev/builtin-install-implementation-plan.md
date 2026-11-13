---
title: "Built-in install: implementation plan"
description: Build checklist for ADR-031, per repo — built-in PostgreSQL container, install/update/backup launchers, single-user bootstrap, mail gating and usage export — with the verification steps that move the MVP rows to Done.
updated_by: nocera@usc.edu
updated_at: 2026-11-13T00:00:00.000Z
---

This is the build checklist for [ADR-031](ADR-031-builtin-database-install-mode.md). The ADR has the decisions and the reasons; this page has the files to change. MVP rows: Dep-04, Dep-06–Dep-08, D-19f, U-19.

**Branch:** `feat/docker-local-db`, using the same name in each repo. **Order:** `w4h-api` → `w4h-app` → `w4h-docs`, with `w4h-docker` alongside (see AGENTS.md). Do not commit `.env`, `secrets/`, `backups/` or API keys.

## 1. w4h-docker

**`docker-compose.yml`**

- [ ] Add `name: w4h` at the top, so volume and network names don't depend on the folder.
- [ ] Add a `db` service:
  - `image: postgres:16` (pin the major version)
  - `profiles: [builtin]`
  - volume `w4h_pgdata:/var/lib/postgresql/data`
  - **no `ports:`**
  - `POSTGRES_DB=w4h`, `POSTGRES_USER=w4h`, `POSTGRES_PASSWORD_FILE=/run/secrets/pg_password`
  - healthcheck `pg_isready -U w4h`
  - `restart: unless-stopped`
- [ ] Declare `secrets: pg_password: file: ./secrets/pg_password`. Give it to `db`, and to `api` read-only at `/run/secrets/pg_password`.
- [ ] `api`: add `W4H_BUILTIN_DB_HOST: db` and `TELEMETRY_TO: ${TELEMETRY_TO:-}`. Make `depends_on: db` (condition `service_healthy`) apply only when the profile is active. Use `required: false` (Compose ≥ 2.20); otherwise drop the dependency and rely on the entrypoint's existing `waitForDb`.
- [ ] Add `restart: unless-stopped` to every service.
- [ ] Replace each `build:` with `image: ghcr.io/usc-infolab/w4h-<service>:${W4H_VERSION:-latest}`. Move today's build stanzas to `docker-compose.build.yml`, so developers run `docker compose -f docker-compose.yml -f docker-compose.build.yml build`.
- [ ] Add a CI workflow (or a documented manual step) that builds and pushes the three images on a `v*` tag. That covers Dep-04.

**Launchers** (shared logic in `scripts/w4h.sh` and `scripts/w4h.ps1`; thin double-click wrappers at the top level)

| File | Does |
|---|---|
| `Install W4H.command` / `Install W4H.bat` | Checks that Docker is running; if not, shows a plain message ("Start Docker Desktop, then try again") and stops. With `umask 077`, creates `secrets/pg_password` (`openssl rand -base64 32`) and `data/.env` with `TOKEN_SECRET` (`openssl rand -hex 64`), **only if each is missing**. Runs `docker compose --profile builtin up -d`, waits for `/api/config/status`, and opens `http://127.0.0.1:5180`. |
| `Start W4H` | `up -d`, with the `builtin` profile unless `W4H_DB_MODE=external`, then opens the browser. |
| `Update W4H` | Built-in mode: `docker compose exec -T db pg_dump -U w4h -Fc w4h > backups/w4h-<timestamp>.dump`, and stops if that fails. Then `docker compose pull api app notebooks`, `docker compose up -d --no-deps api app notebooks`, waits for health, and opens the browser. |
| `Backup W4H` | The same `pg_dump` step on its own. |

- [ ] Every launcher reads `W4H_DB_MODE` from `data/.env`. If it's `external`, start without the `builtin` profile. The first time, run `docker compose rm -sf db` and `docker volume rm w4h_w4h_pgdata`, but only if that volume holds no `w4h` schema.
- [ ] Windows: generate the secrets with PowerShell's `[System.Security.Cryptography.RandomNumberGenerator]`, not `openssl`.
- [ ] `.gitignore`: add `secrets/` and `backups/`.
- [ ] Update `README.md`, `.env.example` (`W4H_VERSION`, `TELEMETRY_TO`) and `AGENTS.md` ("PostgreSQL is external **or built-in**").

## 2. w4h-api

**Setup status:** `routes/config.js`, `getStatus`

- [ ] Add `builtin_available` (the file `/run/secrets/pg_password` exists and `W4H_BUILTIN_DB_HOST` is set), `db_mode` (`process.env.W4H_DB_MODE || null`) and `mail_configured` (`isMailerConfigured()` from `lib/mailer.js`).

**`POST /config/init-builtin`** (new; unauthenticated, refused once any user exists, like `postInitDatabase` and `postAdminSetup`)

- [ ] Body: `{ name, email, password, load_samples }`.
- [ ] Write `DB_HOST=$W4H_BUILTIN_DB_HOST`, `DB_PORT=5432`, `DB_DATABASE=w4h`, `DB_USER=w4h`, `DB_PASSWORD=<secret file>` and `W4H_DB_MODE=builtin` to the env file, reusing the writer `postInitDatabase` uses (it already generates `TOKEN_SECRET` if missing). Reconnect the pool.
- [ ] `initSchema()` (`lib/db-init.js`), then `importDocs()`. If `load_samples`, seed the synthetic samples using the existing sample importer path.
- [ ] In **one transaction**:
  - Create the Super admin as `admin@<install_id>.local` (or a fixed `superadmin@w4h.local`) with a random password (`crypto.randomBytes(18).toString('base64url')`), hashed like `createInitialAdmin`. Factor the shared insert out of `createInitialAdmin` rather than copying it.
  - Create the person's account with their password, checked by `validatePassword`.
  - Create their team and add them as `team_admin`, reusing the team-create logic in `routes/teams.js`. That leaves no `can_create_teams` step pending.
- [ ] `issueApiKeyForUser` for both accounts.
- [ ] Respond **once** with `{ recovery: { super_admin_email, super_admin_password, db_user, db_password, version, created_at }, session }`. Never log or persist the plain passwords.
- [ ] Audit: `platform.bootstrap.single_user`.
- [ ] `postInitDatabase` (the external path) also writes `W4H_DB_MODE=external`.

**Usage export**: new `lib/usage-export.js`, routes in `routes/config.js`

- [ ] `install_id`: a random UUID created once and stored in the existing settings store (where `app-settings` lives).
- [ ] `GET /config/usage-export?days=N&format=csv|json`, authenticated. Super admin: all rows. Admin: only events by members of teams they administer, with the same scoping as `getUsage`.
- [ ] Each row: `pseudonym` (`HMAC-SHA256(install_id, user_id)`, truncated), `team_role`, `event_type`, `timestamp`, `duration_ms`, plus `metadata` reduced to `{ status, method, route, row_count }`. `route` is the Express route template (`/datasets/:id/...`), never the raw path. Drop everything else.
- [ ] Header or first record: `install_id`, W4H version (`GIT_COMMIT` / package version), `db_mode`, export window.
- [ ] `POST /config/usage-export/send` (same scoping): emails the file to `TELEMETRY_TO` with `sendMail`. Returns 503 when `!isMailerConfigured()` or `TELEMETRY_TO` is empty.
- [ ] Audit: `usage.exported` and `usage.sent` (row count and window only).
- [ ] The local Usage page may show the pseudonym → name mapping. The export never includes it.

**Gating**

- [ ] `POST /users/send-code` returns 503 ("Email sign-in is not set up on this installation") when mail isn't configured.
- [ ] Invites: **no change**. `lib/invitations.js` already returns `inviteUrl` with a `mailWarning` when mail fails.

**Housekeeping**

- [ ] Add `W4H_BUILTIN_DB_HOST`, `W4H_DB_MODE` and `TELEMETRY_TO` to `.env.example`. Regenerate `API_INDEX.md`.
- [ ] Tests: `init-builtin` (refused when users exist; creates exactly three rows: Super admin, Admin, membership; returns the recovery record once), usage-export scoping and scrubbing (no `@`, no digits-only path segments), `send` returns 503 without mail.

## 3. w4h-app

- [ ] **Setup wizard** (`src/views/LoginView.vue`, setup steps that call `config/init-database` and `config/admin-setup`):
  - When `builtin_available`, show the choice first: **Built-in database (this computer)** or **Connect to your own PostgreSQL**. The external path is unchanged.
  - Built-in: name, email, password (existing password rules and the show/hide toggle), and a **Load sample data** checkbox → `config/init-builtin`.
  - **Recovery record** step: show the values, offer **Download recovery record** (`W4H-recovery-<date>.txt`, generated in the browser from the response), say "Keep this in a password manager or on another device", and require an **I've saved this** checkbox before **Continue**. Then sign the person in with the returned session.
- [ ] **Gating** from `/config/status`: hide **Sign in with email code** unless `mail_configured`, and hide **Request access** when `db_mode === 'builtin'`. Invites unchanged.
- [ ] **Usage page** (`/admin/usage`, Super admin and Admin): **Download usage** (CSV or JSON, with the period from the existing day selector) and **Send to W4H team**, which opens a preview (row count, columns, first rows) and then confirms. Disabled with a tooltip ("Set up email in Settings") when mail is off.
- [ ] **Settings** (`src/views/admin/SettingsView.vue`): show the database mode read-only.

## 4. w4h-docs (when the feature is built)

- [ ] New user guide `guide/install-on-your-computer.md`, for people who have never used Docker: install Docker Desktop, double-click Install, the first-login screens, the recovery record, setting up email, inviting someone on the same computer, Update, Backup, and what not to do (`docker compose down -v`, deleting the folder). Use screenshots from `scripts/` captures.
- [ ] `guide/docker-deployment.md`: both modes, image tags, the upgrade procedure, migrations, and the Postgres major-version note.
- [ ] `guide/hipaa-compliance.md`: full-disk encryption on tester machines, where the recovery record goes, what the usage export contains and what it never contains.
- [ ] Move ADR-031 to **Accepted**, and update the MVP rows to `🔁 In review`, or `✅ Done` once the verification below has been run. Recompute §17.
- [ ] `node scripts/generate-docs-index.mjs`.

## 5. Verification

Each step must be done for real (not just read in code) before its row moves to `✅ Done`.

1. **Fresh built-in install** in an empty folder: run Install. `secrets/pg_password` and `data/.env` are mode 600; `docker compose ps` shows no host port for `db`; the wizard offers both options. Finish built-in setup: the recovery record downloads, the person lands in the app shell as Admin of their team, and the Super admin from the record can sign in to Platform Admin. (Dep-06, Dep-08)
2. **Two installs** (different folders and `name:` values) have different database passwords and `TOKEN_SECRET`s. (Dep-06)
3. **Upgrade:** with sample data and a project in place, bump `W4H_VERSION` and run Update. A backup file exists, the `db` container ID is unchanged, the person is still signed in, their API key still works, and the data is intact. (Dep-07)
4. **External mode:** choose your own PostgreSQL. `W4H_DB_MODE=external` is written, and the next launcher run removes the idle `db`. (Dep-06)
5. **Usage export** as Admin and as Super admin: the CSV contains no `@`, names, dataset IDs or raw paths, and an Admin sees only their team. With a test SMTP account, **Send to W4H team** arrives with the attachment. Without SMTP the button is disabled and the API returns 503. (D-19f)
6. **Gating and invites:** without SMTP, email-code sign-in is hidden, and Request access is hidden in built-in mode. With SMTP, the Admin invites a second address; that person opens the email on the same machine, activates the account, and their actions appear under a separate pseudonym in the export. (U-19)
7. **Tests:** `w4h-api` test suite including the new tests; `w4h-app` build and lint; docs index regenerated.

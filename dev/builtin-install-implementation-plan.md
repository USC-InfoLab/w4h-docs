---
title: "Built-in install: implementation plan"
description: Build checklist for ADR-031, per repo — one-command pilot install and update, PostgreSQL 18, bundled packages, first-person setup, credential recovery, Gmail, team logs and test sessions — with the verification steps that move the MVP rows to Done.
updated_by: nocera@usc.edu
updated_at: 2026-11-22T00:00:00.000Z
---

This is the build checklist for [ADR-031](ADR-031-builtin-database-install-mode.md). The ADR has the decisions and the reasons; this page has the files to change. MVP rows: Dep-04, Dep-06–Dep-08, D-19f, D-31, U-19.

**Branch:** `feat/docker-local-db`, using the same name in `w4h-docker`, `w4h-api` and `w4h-app`. Design docs in `w4h-docs` stay on `main`. **Order:** `w4h-api` → `w4h-app` → `w4h-docs`, with `w4h-docker` alongside (see AGENTS.md). Do not commit `.env`, secrets, backups or API keys.

## 0. Prove the delivery path first

Docker's documentation doesn't settle these points, so test them with a throwaway public artifact before building the rest:

- [ ] A machine with **no Docker login** can run `docker compose -p w4h -f oci://docker.io/<docker-account>/w4h:test up -d --pull always`.
- [ ] Moving the `test` tag to a new release is picked up, rather than Compose reusing its cached copy of the file. If it is cached, the wrapper resolves the tag's digest and runs that.
- [ ] Find which confirmation prompts appear on `up`, and whether they can be skipped. If they can't, the install guide shows them.
- [ ] Find the minimum Docker Desktop version, and have the guide state it.

## 1. w4h-docker

**`docker-compose.pilot.yml`** (new; `docker-compose.yml` stays the external deployment)

- [ ] `name: w4h`. Named volumes with explicit names: `w4h_pgdata`, `w4h_config`, `w4h_backups`. **No bind mounts.**
- [ ] `setup` (one-shot): generates secrets if missing, runs a PostgreSQL major upgrade if needed.
- [ ] `db`: depends on `setup` completing; `w4h_pgdata:/var/lib/postgresql`; `POSTGRES_DB=w4h`, `POSTGRES_USER=w4h`, `POSTGRES_PASSWORD_FILE` from `w4h_config`; healthcheck `pg_isready -U w4h`; **no `ports:`**; `restart: unless-stopped`.
- [ ] `backup` (one-shot): depends on a healthy `db`; on a release change runs `pg_dump -Fc` into `w4h_backups`, keeps the last five, and exits non-zero on failure.
- [ ] `api`: depends on `backup` completing successfully; persists to `w4h_config`; `W4H_INSTALL_TYPE=pilot`; `TELEMETRY_TO`; `CONTRIBUTION_RUNNER_REPO_ROOT=/opt/w4h/contributions`.
- [ ] **Do not set `SMTP_*` in the pilot file.** Empty values block the saved ones from `.env`. Fix the same bug in `docker-compose.yml`, for example by passing them through `env_file` with `required: false`, or by loading the persisted file with override.
- [ ] `app` and `notebooks`: published images, ports on `127.0.0.1` only, `restart: unless-stopped`. Pin the `notebooks` base image instead of `latest`.
- [ ] Use volume subpaths or per-service ownership so `db` can read only its password and `api` only its env file. Give the API user a fixed UID.

**Images**

- [ ] `db/Dockerfile`: `postgres:18` plus compiled `fft_approximate`.
- [ ] `setup/Dockerfile`: secret generation and `pg_upgrade`. From the first major-version change on, it carries both the old and new server binaries and `fft_approximate` for each.
- [ ] `api/Dockerfile`: add Python; copy each runnable contribution and paired data repo to `/opt/w4h/contributions`; preinstall dependencies.
- [ ] `scripts/bundle-contributions`: reads the `runnable` slugs from `w4h-api/data/schema.sql`, checks out each at a pinned commit, writes a bundle manifest, and **fails** if one is missing. The current list is `w4h-sample-fitbit-csv-importer`, `w4h-sample-icde-demo-csv-importer`, `w4h-fitbit-csv-file-importer`, `w4h-glucose-monitor-csv-file-importer`, `w4h-data-recorder-csv-file-importer`, `w4h-embraceplus-csv-file-importer` and `w4h-sql-compute-mets`.

**Release**

- [ ] `scripts/release-pilot`: `docker buildx build --platform linux/arm64,linux/amd64 --push` for each image, then `docker compose -f docker-compose.pilot.yml publish --resolve-image-digests <docker-account>/w4h:<version>`, and move `test` only after the checks in §5 pass.
- [ ] Optional double-click wrappers for macOS and Windows around the single command.
- [ ] Update `README.md`, `.env.example` and `AGENTS.md`.

## 2. w4h-api

**Setup status:** `routes/config.js`, `getStatus`

- [ ] Add `install_type` (`pilot` or `external`), `first_run_required` and `mail_configured`.

**`POST /config/first-run`** (new; unauthenticated, pilot only, refused once any user exists)

- [ ] Body: `{ name, email, password, load_samples }`.
- [ ] In **one transaction**: create the Super admin (random password from `crypto.randomBytes(18).toString('base64url')`, hashed, and stored encrypted with the helpers in `lib/utils/apiKeyCrypto.js`); create the person, validated by `validatePassword`, as install owner; create their team with them as `team_admin`, reusing the logic in `routes/teams.js`. Factor the shared insert out of `createInitialAdmin`.
- [ ] `issueApiKeyForUser` for both accounts. Return a session. Never log plain passwords.
- [ ] Audit: `platform.bootstrap.single_user`.

**Credential recovery**

- [ ] `POST /config/install-credentials/reveal`: install owner only, re-checks the password with `verifyCurrentUserPassword`, and returns the Super admin email and password plus the database user and password.
- [ ] Audit `install.credentials.reveal` and `install.credentials.reveal_denied`.
- [ ] Delete the stored encrypted copy when the Super admin password changes.

**Migrations**

- [ ] `w4h.schema_migrations`, plus an ordered runner in `lib/db-init.js` that stops startup on failure. `ensureSchema` stays idempotent.

**Contribution runner**

- [ ] When the bundle manifest is present, `lib/contribution-runner.js` uses the bundled copy and never runs `git clone` or fetch. Confirm `run.sh` works from a read-only location for all six Python importers.

**Mail**

- [ ] `sendMail` in `lib/mailer.js` accepts `attachments`.
- [ ] `POST /users/send-code` returns 503 ("Email sign-in is not set up on this installation") when mail isn't configured.

**Test sessions**

- [ ] `w4h.test_sessions`: `id`, `user_id`, `task_key`, `started_at`, `ended_at`, `end_reason` (`completed`, `abandoned`, `timed_out`).
- [ ] Start and end routes. Only one open session per user. Time out stale sessions. `task_key` must come from a fixed server-side list.

**Log export:** new `lib/usage-export.js`

- [ ] `install_id`: a random UUID created once and stored in the existing settings store.
- [ ] `GET /config/usage-export?days=N&format=csv|json`. Super admin: all rows. Admin: only members of teams they administer. **`/config/usage` is platform-admin only today, so this scoping is new.**
- [ ] Each row: `pseudonym` (`HMAC-SHA256(install_id, user_id)`, truncated), `team_role`, `event_type`, `timestamp`, `duration_ms`, plus `metadata` reduced to `{ status, method, route, row_count }`. `route` is the Express route template, never the raw path. Include test sessions.
- [ ] Header or first record: `install_id`, W4H version, `install_type`, export window.
- [ ] `POST /config/usage-export/send`: same scoping; recipient is a chosen address or `TELEMETRY_TO`; 503 when mail isn't configured.
- [ ] Audit: `usage.exported` and `usage.sent` (row count, window and recipient type only).

**Housekeeping**

- [ ] Add `W4H_INSTALL_TYPE` and `TELEMETRY_TO` to `.env.example`. Regenerate `API_INDEX.md`.
- [ ] Tests: first-run (refused when users exist; creates exactly Super admin, Admin and membership), reveal (owner only, wrong password denied, audited), migrations (ordered, re-run safe, failure stops startup), export scoping and scrubbing, `send` returns 503 without mail, test session rules.

## 3. w4h-app

- [ ] **First run** (`src/views/LoginView.vue`): on pilot installs, show only name, email, password and **Load sample data**. No database step and no built-in/external choice. External installs keep today's wizard.
- [ ] **Gating** from `/config/status`: hide **Sign in with email code** unless `mail_configured`; hide **Request access** on pilot installs.
- [ ] **Settings** (`src/views/admin/SettingsView.vue`): **Gmail** preset with app-password help and the existing send-test action. For the install owner, **Recover credentials** behind password re-entry.
- [ ] **Test session control:** **Start test** with a task picker, a visible running state, and **End test**.
- [ ] **Usage page** (`/admin/usage`, opened to Admins with team scope): **Download**, **Email**, and **Send to W4H team**, each after a preview (row count, columns, first rows). Email actions are disabled with a tooltip when mail is off.

## 4. w4h-docs (when the feature is built)

- [ ] New guide `guide/install-on-your-computer.md`, for people who have never used Docker: install Docker Desktop, run the command, first sign-up, Gmail app password, inviting someone on the same computer, updating, credential recovery, backups, and what not to do (`docker compose down -v`, deleting volumes).
- [ ] `guide/docker-deployment.md`: pilot and external deployments, the release procedure, migrations, PostgreSQL major upgrades.
- [ ] `guide/hipaa-compliance.md`: tester responsibility, full-disk encryption, credential recovery, what the log export contains and never contains.
- [ ] Move ADR-031 to **Accepted**, and update the MVP rows to `🔁 In review`, or `✅ Done` once the verification below has been run. Recompute §17.
- [ ] `node scripts/generate-docs-index.mjs`.

## 5. Verification

Each step must be done for real (not just read in code) before its row moves to `✅ Done`.

1. **Clean install** on macOS (arm64) and Windows or Intel (amd64), with no Docker login and no repo checkout: the single command brings up the app, and `docker compose ps` shows no host port for `db`. (Dep-04, Dep-06, Dep-07)
2. **First run:** the person signs up, lands in the app shell as Admin of their team, and can reveal credentials. The revealed Super admin password signs in to Platform Admin. A second team admin can't reveal them. (Dep-08)
3. **Two installs** on separate machines have different database passwords, `TOKEN_SECRET`s and Super admin passwords. (Dep-06)
4. **Update:** with data, a project, an API key and saved Gmail settings, release a new version and rerun the command from a **different folder**. A backup exists, and the data, sign-in, API key and mail settings all survive. (Dep-07)
5. **Failed update:** force a backup failure, then a migration failure. The new API doesn't start, and the data is intact. (Dep-07)
6. **PostgreSQL major upgrade** rehearsed on a copy of real-shaped data, including `fft_approximate`. The old directory is kept until verified. (Dep-07)
7. **Packages:** every runnable contribution runs in the container with outbound GitHub access blocked. (D-31)
8. **Gmail:** an app password sends an invite, an email code and a log attachment, and still works after a restart. (U-19, D-19f)
9. **Logs and test sessions:** start and end a session. The export has no `@`, names, dataset IDs or raw paths, and an Admin sees only their team. Without SMTP, email actions are disabled and the API returns 503. (D-19f)
10. **Tests:** `w4h-api` test suite including the new tests; `w4h-app` build and lint; docs index regenerated.

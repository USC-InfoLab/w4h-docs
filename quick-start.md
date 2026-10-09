---
title: ⚡️ Quick Start
description: Get started with the W4H Toolkit — platform setup, projects, and your first analysis workflow
is_feature_card: true
card_title: ⚡️ Quick Start
action_label: Get started
card_order: 5
sort_order: 3
---

## About the W4H Toolkit

The **W4H Toolkit** is a research platform for ingesting, organizing, and analyzing wearable health data in a secure, multi-project environment. It is designed for clinical research teams working with time-series signals (heart rate, accelerometry, sleep stages, and more), standardized using the **GeoMTS** abstraction described in [ADR-008](dev/ADR-008-geomts-data-model.md).

At a glance, the platform provides:

- **Projects** — scoped workspaces for a study or analysis effort, with members, datasets, and documentation
- **Contributions** — curated tools (notebooks, CLI, scripts, SQL modules, Postgres extensions) with publisher and git README; importers use **Run import…** in the dataset **overview** pane; runnable SQL jobs use **Run analysis…** on the Analytics tab — both via `POST /contributions/:slug/run` ([ADR-022](dev/ADR-022-in-app-contribution-run-trigger.md), [ADR-023](dev/ADR-023-sql-analytics-contributions.md)). Notebooks may also call `POST /datasets/:id/contributions/:slug/sql` for a direct sync result.
- **Datasets** — ingested collections of wearable signal tables (research catalogs; plus the Samples sandbox demos)
- **Docs** — this documentation browser, initialized from the `w4h-docs` source repository
- **PHI-safe AI chat** — docked assistant (⌘J) for Help how-to questions, plus import, analytics, and IRB; default filter keeps identifiers and raw rows out of Claude ([PHI-safe AI chat](guide/ai-chat.md))
- **Audit logging** — an append-only record of privileged actions for HIPAA-aligned deployments ([HIPAA Compliance](guide/hipaa-compliance.md))

For the full architectural picture — schema-per-trial isolation, dataset sharing, ACL, and deployment modes — see [Architecture](dev/architecture.md) and the [ADR index](dev/ADR-001-schema-per-trial.md).

---

## Roles

| Role | Shell | What you can do |
|---|---|---|
| **Super admin** | **Platform Admin** only (`W4H Toolkit Admin`) | Bootstrap the platform: SMTP, approve access requests, audit, usage, settings. Does **not** run day-to-day trials. |
| **Admin** | App shell (`W4H Toolkit`) | Own trials: teams, dataset declarations, ingest via Contributions, projects, members, shares. |
| **User** | App shell | Work in assigned projects: analytics on **loaded** datasets (tables present). Cannot add datasets or edit raw tables. |

There is **no** “toggle Admin UI” for Super admins — they land in Platform Admin on login and stay there. Admins never enter Platform Admin. See [ADR-004](dev/ADR-004-acl-roles.md) and MVP §3.0 (onboarding).

**Welcome checklists (next-step cards on Home and in Help):**

- Super admin → [Welcome — Super admin](guide/welcome-super-admin.md)
- Admin (PI) → [Welcome — Admin](guide/welcome-admin.md)
- User → [Welcome — User](guide/welcome-user.md)

---

## 1. First-time platform setup (Super admin)

On a fresh install, the login page walks you through setup automatically:

1. **Connect PostgreSQL** — enter host, port, database name, and credentials. The `w4h` schema is created automatically if the database user has `CREATEDB` privilege.
2. **Create the initial Super admin account** — choose an email and a strong password (minimum 12 characters).
3. **Log in** — you land on **Platform Admin home**. Change your password from the account menu → Profile if needed.

After login, finish these one-time configuration steps under **Settings** (`{{APP_URL}}/admin/settings`):

| Step | Where | Why |
|---|---|---|
| Verify database connection | Settings → Database | Confirm credentials are saved and the connection is healthy |
| Configure SMTP (optional) | Settings → Mail Server | Required for password resets and user invitations — see [SMTP Configuration](guide/smpt-configuration.md) |
| Optional Claude key | Settings → PHI-safe AI chat | Platform key + per-team monthly token quota for provisioned chat; teams may instead paste their own Anthropic key |
| Refresh documentation | Settings → Documentation Management → **Refresh Docs** | Imports pages from the `w4h-docs` source repository into the platform |

Then onboard PIs as they ask for access (see [Request access](#request-access-new-pi) below):

1. A PI submits **Request access** on the login screen and confirms their USC email.
2. You are notified — an email, a count on the admin home, and a badge on **Requests** in the menu.
3. **Requests → Approve** — one click sends them an **Admin invitation**. That is all you do: you do not create or approve teams. They create and define their own teams after signing in.

Requests need **SMTP** and **`APP_URL`** to be set (the form cannot verify addresses otherwise). Set `ACCESS_REQUEST_ALLOWED_DOMAINS` in the API environment if more than `usc.edu` should be accepted (comma-separated, exact domains).

The PI (Team admin) then sets up projects and datasets in the **app shell**. See [Setting Up Projects](guide/setting-up-projects.md).

### Request access (new PI)

Open to **USC researchers** for now.

1. On the login screen click **Request access (USC researchers)**.
2. Enter your name, **USC email**, lab/department, and a short purpose — no patient or study data.
3. Open the confirmation link W4H emails you (valid for 24 hours). Until you do, nobody sees your request.
4. A person reviews it. If approved you receive an **invitation** to set your password. On your first sign-in W4H asks you to **create your team** — you name it and are its **Admin**. You can add more teams later from the account menu (**New team**); nobody approves them.

You will not be told whether an account already exists for an address, and a request from an address that is not on an allowed domain is rejected.

> **Tip:** Use **Export Docs** in Settings to download a ZIP backup before refreshing.

For local development setup (cloning repos, `npm run dev`, environment variables), see [Developer Setup](dev/developer-setup.md).

---

## 2. Create your team and a project (Admin)

**Start with a team.** A team is your lab or study group — the boundary for your people, datasets and projects. On your first sign-in W4H asks you to **create your team**: give it a name and you are its **Admin**. Need another for a separate study? Account menu → **New team**. Nobody approves teams; the Super admin does not create them. Then: create a project, add datasets, **invite people** (§4).

Projects are the central unit of work — every dataset link and member assignment is scoped to a project ([ADR-001](dev/ADR-001-schema-per-trial.md)).

For multi-dataset setups (owned datasets, inbound shares, dual-hat Team admins), see **[Setting Up Projects](guide/setting-up-projects.md)**.

1. In the **app shell**, go to **Projects** and create a project (owning team required).
2. Open the project → **Linked datasets** and add datasets.
3. Open the project **workspace** for members, documentation, and tokens.

In the workspace you can manage:

- **Project documentation** — private Markdown pages for this project (not platform Help). Use pages (and your own git repo) to point at analysis notebooks; W4H does not register them ([ADR-018](dev/ADR-018-contributions-catalog.md)).
- **Members** — researchers and collaborators assigned to the project
- **Database access tokens** — short-lived tokens for programmatic data access from scripts and notebooks
- **Fine-grained ACL** — optional rules on top of member roles (dataset, doc permissions)

---

## 3. Register datasets (admin)

Declaring a dataset (a name on the team or project) is not the same as loading it.

1. Create or add the dataset on the **project** (declaration) or under **Datasets**.
2. Ingest tables: for a **runnable** contribution (the **Fitbit CSV importer** or **ICDE demo CSV importer**), open the project workspace → **Datasets**, select the **target catalog row**, then click **Run import…**. That loads a copy of the sample into **that row’s own schema** — it does not truncate a sibling dataset that already has the sample. If the sample is already loaded on the project, **Link … instead** (do not run again). On a first load, pick **Sample / importer** (Fitbit or ICDE). On a re-run of a loaded dataset, choose **Update** or **Full** (**Full** truncates tables in this dataset only). It runs on your personal API key, no notebook or CLI needed ([ADR-022](dev/ADR-022-in-app-contribution-run-trigger.md)). For other importers, adapt the notebook or run the CLI from [Contributions]({{APP_URL}}/contributions) into **your team** — not the Samples sandbox — using your personal API key.
3. Confirm **tables** on the dataset overview — that means it is loaded. Mapping details: [ADR-003](dev/ADR-003-dataset-table-model.md).

Researchers only see datasets that are linked to projects they belong to. **Users** do not ingest.

**First-party sample pairs** (Contributions → search “Fitbit” or “ICDE”):

| Pair | Geo signal? | In-app **Run import…** |
|---|---|---|
| **w4h-sample-fitbit-csv** + importer | No — Fitbit CSV exports have no GPS | Yes |
| **w4h-sample-icde-demo-csv** + importer | Yes — `gps_track` (lat/lon) | Yes |

Both are synthetic. Load into **your team** for ingest practice; do not re-ingest Super-admin **W4H Samples** sandbox datasets.

---

## 4. Invite users (admin)

1. Configure **SMTP** and set **`APP_URL`** to your public app base URL (required for invitation links) — see [SMTP Configuration](guide/smpt-configuration.md).
2. Go to **Users** and click **Invite User**.
3. Enter email, optional name, and role. **Admin** can ingest dataset tables. **User** can run analytics on loaded data.
4. Click **Send Invite**. The invitee receives a **time-limited link** to set their own password and activate the account. Passwords are never sent by email.
5. Pending invites can be **resent** or **revoked** from the user edit screen.

User accounts are never hard-deleted — they can be discontinued and resumed later ([ADR-010](dev/ADR-010-soft-delete-no-hard-deletion.md)).

---

## 5. Run your first analysis (researcher)

You are enrolled in the **W4H Samples** sandbox (synthetic demos). Super admin seeds those datasets; you **re-run** notebooks — you do not re-ingest.

1. Open **Contributions** (`{{APP_URL}}/contributions`) and search (for example, “Fitbit”, “ICDE”, or “fft”).
2. Your **personal API key** is issued automatically at account creation — reveal or rotate it under **Profile → API keys** when you run a notebook or CLI. Do not use a shared team key.
3. Open the listing’s git repo (README is rendered in-app and lives in the repo). Query the canonical sandbox dataset; skip write/`replace` cells unless you are Super admin seeding.
4. For **your** trial data, open **Projects**, issue a project token or use your key on datasets linked to that project.

**Chart your data in the app.** Open a project → **Analytics** → *Explore signals* to chart any loaded dataset without code (time series, distributions, coverage, scatter, events), and export PNG or CSV. An Admin can also publish an interactive notebook as a **report**. See [Charts and Reports](guide/charts-and-reports.md).

Once you are assigned to a research project ([Welcome — User](guide/welcome-user.md)):

1. Log in and open **Projects** (`{{APP_URL}}/projects`).
2. Click your project to open the workspace.
3. **Issue a project token** — in the *Database access* panel, click **Issue project token**. Copy the token immediately; it is shown once and expires after two days.
4. **Run analysis** — clone a [Contribution]({{APP_URL}}/contributions) or your team’s git repo and connect with the token. W4H does not host or track project notebooks.

### Flexible mode (default)

In Flexible deployments ([ADR-006](dev/ADR-006-trusted-research-environment.md)), researchers connect from a local machine, HPC cluster, or cloud GPU using a personal API key ([ADR-007](dev/ADR-007-authentication-model.md)). Every data access request is authenticated, project-scoped, and written to the audit log.

```python
import os
# Use the token issued from the project workspace
os.environ["W4H_PROJECT_TOKEN"] = "<paste token here>"
# Connect and query project-scoped datasets
```

---

## 6. Browse documentation

Use the **Docs** link in the navigation bar to open this documentation browser.

- The sidebar groups pages by doc type (folder name in the source repo).
- Use **Search** to find pages by title or content.
- Admins can edit pages in-place and adjust settings (slug, doc type, visibility, home page card) from the editor gear icon.

While a Help page is open, **PHI-safe AI chat** (next step) can see that page as context — useful when you want a how-to in your own words instead of scanning the sidebar.

Platform changes are tracked in [What's New](whats-new.md).

---

## 7. Ask PHI-safe AI chat

When a team or platform Anthropic key is configured, open **PHI-safe AI chat** from the chat icon in the nav, or with **⌘J** / **Ctrl+J**. The panel docks beside the page.

Use **Help** mode to ask how to use W4H — which screen, who can invite, where API keys live — and to ask about the Help page you are reading. For example:

> How do I invite a student to my project?

> Where do I find my personal API key?

> How do I import Fitbit CSV into my team catalog?

The assistant answers for your **role** (Super admin · Admin · User) and links into Help, Contributions, and this project’s pages when it can. It sends **page context** (shell, route, team/project names, current Help slug) — not table rows.

Switch modes only when you need them: **Import** (load and map files), **IRB** (draft privacy / DMP language), **Analytics** (methods and notebook snippets for data already in W4H).

Do **not** paste subject IDs, emails, GPS, CSV cells, or raw samples. If the panel says chat is not available, an Admin adds a lab key under **Project → Settings**, or Super admin configures a platform key (step 1 above). Full guide: [PHI-safe AI chat](guide/ai-chat.md).

---

## Guides vs. tutorials

Documentation is organized into doc types — each type is a folder in the source repo and a section in the docs sidebar.

| | **Guides** | **Tutorials** |
|---|---|---|
| **Purpose** | Explain what the platform does and how to configure it | Walk through a specific task step by step |
| **Style** | Reference — read in any order | Hands-on — follow along start to finish |
| **Audience** | Admins, compliance officers, architects | Researchers learning a workflow |

**Guides** (this section) cover platform setup and policy:

- [Welcome — Super admin](guide/welcome-super-admin.md) — platform bootstrap checklist
- [Welcome — Admin](guide/welcome-admin.md) — trial next steps
- [Welcome — User](guide/welcome-user.md) — what Users can and cannot do
- [Quick Start](quick-start.md) — you are here
- [PHI-safe AI chat](guide/ai-chat.md) — Help how-to, import, IRB, and analytics questions
- [HIPAA Compliance](guide/hipaa-compliance.md) — security controls for regulated deployments
- [SMTP Configuration](guide/smpt-configuration.md) — outbound email setup

**Tutorials** will appear in their own sidebar section as short, task-focused walkthroughs — for example, linking a dataset, issuing a project token, or running a first notebook. If you prefer learning by doing, start with the numbered steps above, then check the Tutorials section for deeper walkthroughs.

---

## Quick reference

| I want to… | Go to… |
|---|---|
| Set up the database | Login page (first run) or Platform Admin → Settings → Database |
| Request access (new PI) | Login screen → **Request access** · [Quick Start](#request-access-new-pi) |
| Onboard a PI | Platform Admin → **Requests** → **Approve** (sends the Admin invitation; the Admin creates their own team) · [Welcome — Super admin](guide/welcome-super-admin.md) |
| Create a team | First sign-in (**Create your team**), then account menu → **New team** (Admin) · [Welcome — Admin](guide/welcome-admin.md) |
| Create a project | App shell → Projects (Admin) · [Welcome — Admin](guide/welcome-admin.md) |
| Work in a project as User | App shell → Project / Contributions · [Welcome — User](guide/welcome-user.md) |
| Manage datasets | App shell → Datasets (Team admin) |
| Load tables (runnable importer) | Project workspace → Datasets → select dataset → **Run import…** in overview ([ADR-022](dev/ADR-022-in-app-contribution-run-trigger.md)) |
| Invite people | App shell → project → People (Admin); another organization joins as a collaborating team |
| Issue a data-access token | Project workspace → Database access |
| Configure email | Platform Admin → Settings → Mail Server |
| Refresh docs from source | Platform Admin → Settings → Documentation Management |
| Ask how to use the platform | Chat icon in the nav (⌘J / Ctrl+J) · Help mode · [PHI-safe AI chat](guide/ai-chat.md) |
| Change Super admin password | Platform Admin → account menu → Profile |
| Understand the architecture | [Architecture](dev/architecture.md) |
| Review design decisions | ADR docs under **Developer** in the sidebar |
| HIPAA deployment checklist | [HIPAA Compliance](guide/hipaa-compliance.md) |

---

## Still have questions?

Open **PHI-safe AI chat** (**⌘J** / **Ctrl+J**) in Help mode and ask in your own words. Check the [FAQ](faq/faq.md), or contact your platform administrator.

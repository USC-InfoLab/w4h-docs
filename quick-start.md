---
title: ⚡️ Quick Start
description: Get started with the W4H Toolkit — platform setup, projects, and your first analysis workflow
is_feature_card: true
card_title: ⚡️ Quick Start
action_label: Get started
sort_order: 0
---

## About the W4H Toolkit

The **W4H Toolkit** is a research platform for ingesting, organizing, and analyzing wearable health data in a secure, multi-project environment. It is designed for clinical research teams working with time-series signals (heart rate, accelerometry, sleep stages, and more), standardized using the **GeoMTS** abstraction described in [ADR-008]({{APP_URL}}/docs/ADR-008-geomts-data-model).

At a glance, the platform provides:

- **Projects** — scoped workspaces for a study or analysis effort, with members, datasets, notebooks, and documentation
- **Datasets** — registered collections of wearable signal tables, managed by platform admins
- **Notebooks** — tracked analysis workflows (Jupyter, VS Code, RStudio) linked to a project repository
- **Docs** — this documentation browser, initialized from the `w4h-docs` source repository
- **Audit logging** — an append-only record of privileged actions for HIPAA-aligned deployments ([HIPAA Compliance]({{APP_URL}}/docs/hipaa-compliance))

For the full architectural picture — schema-per-trial isolation, dataset sharing, ACL, and deployment modes — see [Architecture]({{APP_URL}}/docs/architecture) and the [ADR index]({{APP_URL}}/docs/ADR-001-schema-per-trial).

---

## Roles

| Role | What you can do |
|---|---|
| **Admin** | Configure the platform, manage users and datasets, create projects, refresh documentation |
| **Researcher** | Access assigned projects, view linked datasets, issue API tokens, run notebooks |
| **Clinician** | Read-only access to assigned project data |

Admins toggle **Admin UI** from the user menu to reach settings, user management, and dataset administration. See [ADR-004]({{APP_URL}}/docs/ADR-004-acl-roles) for how application roles map to database-level access control.

---

## 1. First-time platform setup (admin)

On a fresh install, the login page walks you through setup automatically:

1. **Connect PostgreSQL** — enter host, port, database name, and credentials. The `w4h` schema is created automatically if the database user has `CREATEDB` privilege.
2. **Create the initial admin account** — choose an email and a strong password (minimum 12 characters).
3. **Log in** — you land on the home page. Change the default password if prompted.

After login, finish these one-time configuration steps in **Admin → Settings** (`{{APP_URL}}/admin/settings`):

| Step | Where | Why |
|---|---|---|
| Verify database connection | Settings → Database | Confirm credentials are saved and the connection is healthy |
| Configure SMTP (optional) | Settings → Mail Server | Required for password resets and user invitations — see [SMTP Configuration]({{APP_URL}}/docs/smpt-configuration) |
| Refresh documentation | Settings → Documentation Management → **Refresh Docs** | Imports pages from the `w4h-docs` source repository into the platform |

> **Tip:** Use **Export Docs** in the same panel to download a ZIP backup before refreshing.

For local development setup (cloning repos, `npm run dev`, environment variables), see [Developer Setup]({{APP_URL}}/docs/developer-setup).

---

## 2. Create a project

Projects are the central unit of work — every dataset link, notebook, and member assignment is scoped to a project ([ADR-001]({{APP_URL}}/docs/ADR-001-schema-per-trial)).

1. Switch to **Admin UI** (user menu → Admin).
2. Go to **Projects** (`{{APP_URL}}/projects`) and click **+ New project**.
3. Enter a name and optional description.
4. Open the project to reach its **workspace**.

In the workspace you can manage:

- **Notebooks** — register analysis notebooks with repo URL, branch, and launcher (Jupyter, VS Code, RStudio)
- **Project documentation** — pages linked to this project
- **Members** — researchers and collaborators assigned to the project
- **Database access tokens** — short-lived tokens for programmatic data access from scripts and notebooks
- **Fine-grained ACL** — optional rules on top of member roles (dataset, notebook, doc permissions)

---

## 3. Register datasets (admin)

Datasets are managed globally by admins, then linked to projects.

1. Go to **Admin → Datasets**.
2. Review imported datasets — each dataset has signal tables registered in a manifest (one physical table per signal type; see [ADR-003]({{APP_URL}}/docs/ADR-003-dataset-table-model)).
3. Link datasets to the appropriate project from the project edit screen.

Researchers only see datasets that are linked to projects they belong to.

---

## 4. Invite users (admin)

1. Configure **SMTP** and set **`APP_URL`** to your public app base URL (required for invitation links) — see [SMTP Configuration]({{APP_URL}}/docs/smpt-configuration).
2. Go to **Admin → Users** and click **Invite User**.
3. Enter email, optional name, role (`super_admin`, `team_admin`, or `project_user`), and team when required.
4. Click **Send Invite**. The invitee receives a **time-limited link** to set their own password and activate the account. Passwords are never sent by email.
5. Pending invites can be **resent** or **revoked** from the user edit screen.

User accounts are never hard-deleted — they can be discontinued and resumed later ([ADR-010]({{APP_URL}}/docs/ADR-010-soft-delete-no-hard-deletion)).

---

## 5. Run your first analysis (researcher)

Once you are assigned to a project:

1. Log in and open **Projects** (`{{APP_URL}}/projects`).
2. Click your project to open the workspace.
3. **Issue a project token** — in the *Database access* panel, click **Issue project token**. Copy the token immediately; it is shown once and expires after two days.
4. **Open a notebook** — click a launcher button (Jupyter, VS Code, etc.) on a registered notebook, or connect from your local environment using the token.

### Flexible mode (default)

In Flexible deployments ([ADR-006]({{APP_URL}}/docs/ADR-006-trusted-research-environment)), researchers connect from a local machine, HPC cluster, or cloud GPU using a personal API key or project token ([ADR-007]({{APP_URL}}/docs/ADR-007-authentication-model)). Every data access request is authenticated, project-scoped, and written to the audit log.

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

Platform changes are tracked in [What's New]({{APP_URL}}/docs/whats-new).

---

## Guides vs. tutorials

Documentation is organized into doc types — each type is a folder in the source repo and a section in the docs sidebar.

| | **Guides** | **Tutorials** |
|---|---|---|
| **Purpose** | Explain what the platform does and how to configure it | Walk through a specific task step by step |
| **Style** | Reference — read in any order | Hands-on — follow along start to finish |
| **Audience** | Admins, compliance officers, architects | Researchers learning a workflow |

**Guides** (this section) cover platform setup and policy:

- [Quick Start]({{APP_URL}}/docs/quick-start) — you are here
- [HIPAA Compliance]({{APP_URL}}/docs/hipaa-compliance) — security controls for regulated deployments
- [SMTP Configuration]({{APP_URL}}/docs/smpt-configuration) — outbound email setup

**Tutorials** will appear in their own sidebar section as short, task-focused walkthroughs — for example, linking a dataset, issuing a project token, or running a first notebook. If you prefer learning by doing, start with the numbered steps above, then check the Tutorials section for deeper walkthroughs.

---

## Quick reference

| I want to… | Go to… |
|---|---|
| Set up the database | Login page (first run) or Admin → Settings → Database |
| Create a project | Projects → + New project (Admin UI) |
| Manage datasets | Admin → Datasets |
| Add a user | Admin → Users → Add User |
| Issue a data-access token | Project workspace → Database access |
| Configure email | Admin → Settings → Mail Server |
| Refresh docs from source | Admin → Settings → Documentation Management |
| Understand the architecture | [Architecture]({{APP_URL}}/docs/architecture) |
| Review design decisions | ADR docs under **Developer** in the sidebar |
| HIPAA deployment checklist | [HIPAA Compliance]({{APP_URL}}/docs/hipaa-compliance) |

---

## Still have questions?

Check the [FAQ]({{APP_URL}}/docs/faq) or contact your platform administrator.

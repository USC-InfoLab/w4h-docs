---
title: 🆕 What's New!
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-15T20:21:00.000Z
---
## July 2026

### Guides
- [Setting Up Projects]({{APP_URL}}/docs/setting-up-projects) — multi-dataset projects from owned datasets, inbound shares, and dual-hat Team admin linking (with diagrams)
- MVP **v0.13** onboarding model: Super admin bootstraps Team admin + initial team; PI self-serves trials (Draft T-15–T-18) — Super admin does **not** approve individual trials
- Quick Start / ADR-004 / architecture: Super admin **always** uses Platform Admin (no Admin UI toggle); Team admins use the app shell

### UI
- Global **USC Cardinal + Gold** brand layer (`style.css`) + Super admin **UI kit** (`/admin/style-guide`); [ADR-013]({{APP_URL}}/docs/ADR-013-brand-theming-white-label) — tokens now, white-label later
- Dark-mode text utilities lightened for contrast; list-group / nav-pills active use Cardinal fills

### Architecture & Requirements
- Role vocabulary aligned across ADRs and MVP requirements: **Super admin** (platform) · **Team admin / member** (per team) · project **owner / editor / viewer**
- **Per-team roles** (MVP v0.11 / ADR-004): `team_members.role` supports dual-hat; legacy global Team admin migrates to membership
- Ingest-without-Team-admin (PI → student) tracked as Draft **ACL/capability** D-22 — not a third team role
- Project membership simplified to **owner** / **editor** / **viewer** (project-level `admin` retired to avoid colliding with Team admin)
- [ADR-011]({{APP_URL}}/docs/ADR-011-hipaa-audit-logging) — HIPAA audit logging model (API/notebook access, super-admin paths, fail-closed PHI writes)
- [ADR-012]({{APP_URL}}/docs/ADR-012-project-dataset-linking) — project–dataset linking and shared-dataset projects (multi-dataset modeling; push-share UX; share ≠ co-owned project)
- ADR-002 / ADR-004 / architecture / MVP requirements updated for push-share defaults and project visibility rules
- MVP requirements in `dev/mvp.md` (v0.12)

### Documentation browser
- Mobile docs navigation: new **Menu** (sidebar offcanvas) and (TOC) bar on small screens
- Docs title comes from frontmatter / title field only — no duplicate leading H1 in the body
- `sort_order` in frontmatter orders docs within a section; ADR files auto-order by number when omitted
- ADR index and Developer docs reorganized under `dev/`

---

## June–July 2026

### Projects & Multi-Tenancy
- Renamed "studies" to "projects" across the app, API, routes, and components for consistency
- Introduced project-scoped access control (ACL) with per-user membership and roles
- Added multitenancy design documentation and Architecture Decision Records (ADRs)

### Security & Compliance
- HIPAA-compliant bcrypt rounds for password hashing
- Break-glass password support with dedicated documentation and instructions
- Per-user notebook API keys with JWT-or-key authentication on datasets and project endpoints
- Optional email one-time-code login (SMTP) alongside password sign-in

### Notebooks
- New single-user notebook workflow with JWT-authenticated server endpoints
- Token-only client SDK, sample data loader, and token generator
- Updated band wear analysis notebook

---

## May 2026

### Documentation
- Server-side doc rendering with Markdown ZIP export and Mermaid diagram support
- Docs now initialized from a dedicated documentation repository on first install
- HIPAA compliance guide added
- Break-glass access instructions added

### Projects Hub
- Project workspace UI with three-tab layout (Monitor, Manage, Visualize)
- Dataset selection and preview within workspaces
- Notebook management UI with run metadata, edit, duplicate, and delete flows
- Sortable run columns, run filters, and a run details panel
- DB token list and purge support

### API
- Consolidated PostgreSQL access in `db.js`
- Audit support added
- Docs export and refresh endpoints

---

## March–April 2026

### Authentication & Users
- Login with email, show/hide password toggle
- Dev login prefill from environment variables
- User management and password generation

### Developer Experience
- `.env` removed from tracking; `.env.example` provided
- Contribution docs added across all repos
- VS Code launch configuration for opening the app in the editor browser

---

## Earlier

- Initial W4H platform setup with PostgreSQL backend, login, and dataset/subject routes
- Basic studies and datasets management
- Calories, heart rate, activity classification, and position/stats APIs

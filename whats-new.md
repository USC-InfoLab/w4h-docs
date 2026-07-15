---
title: 🆕 What's New!
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-15T00:32:29.681Z
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
^^- Consolidated PostgreSQL access in `db.js`
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
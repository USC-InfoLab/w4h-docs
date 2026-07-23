---
title: "Release notes — earlier 2026"
description: Archive of W4H Toolkit changes from March–May 2026 and initial platform setup.
updated_by: nocera@usc.edu
updated_at: 2026-07-23T17:00:00.000Z
sort_order: 30
---

Archive of **March–May 2026** and the initial platform. For the latest release, see [What's New]({{APP_URL}}/docs/whats-new).

## May 2026

### Documentation
- Server-side doc rendering with Markdown ZIP export and Mermaid diagram support
- Docs initialized from a dedicated documentation repository on first install
- HIPAA compliance guide and break-glass access instructions

### Projects hub
- Project workspace UI with three-tab layout (Monitor, Manage, Visualize)
- Dataset selection and preview within workspaces
- Notebook management UI with run metadata, edit, duplicate, and delete flows
- Sortable run columns, run filters, and a run details panel
- DB token list and purge support

### API
- Consolidated PostgreSQL access in `db.js`
- Audit support added
- Docs export and refresh endpoints

## March–April 2026

### Authentication & users
- Login with email, show/hide password toggle
- Dev login prefill from environment variables
- User management and password generation

### Developer experience
- `.env` removed from tracking; `.env.example` provided
- Contribution docs added across all repos
- VS Code launch configuration for opening the app in the editor browser

## Initial platform

- PostgreSQL backend, login, and dataset/subject routes
- Basic studies and datasets management
- Calories, heart rate, activity classification, and position/stats APIs

---

[← What's New (latest)]({{APP_URL}}/docs/whats-new) · [← June 2026]({{APP_URL}}/docs/2026-06)

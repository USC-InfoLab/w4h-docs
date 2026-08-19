# Docs Index

Structural map of `w4h-docs` for agents and humans. **Index only** — not a substitute for reading ADRs/MVP.

- Regenerate: `node scripts/generate-docs-index.mjs`
- Generated: 2026-08-19
- Do not hand-edit the lists below; change docs, then re-run the script.

## Orientation

| Need | Start here |
|------|------------|
| Requirements / impl status | `dev/mvp.md` |
| Architecture | `dev/architecture.md` |
| ADR index | `dev/ADR-README.md` |
| Roles / ACL | `dev/ADR-004-acl-roles.md` |
| Quick start (users) | `quick-start.md` |
| Docs screenshots / fake users | `dev/docs-fixtures.md` |
| Guides | `guide/` |

ADRs in tree: **21**. Prefer MVP + relevant ADR before inventing product rules.

## Root

| File | Title |
|------|-------|
| `home.md` | Welcome to W4H |
| `quick-start.md` | ⚡️ Quick Start |
| `README.md` | W4H Docs |
| `whats-new.md` | 🆕 What's New! |

## `dev/`

| File | Title |
|------|-------|
| `dev/ADR-001-schema-per-trial.md` | ADR-001 — Schema-per-trial isolation |
| `dev/ADR-002-cross-trial-sharing.md` | ADR-002 — Cross-trial dataset sharing via w4h_global |
| `dev/ADR-003-dataset-table-model.md` | ADR-003 — Physical signal tables + platform mapping registry |
| `dev/ADR-004-acl-roles.md` | ADR-004 — Three-tier access control model |
| `dev/ADR-005-connection-pooling.md` | ADR-005 — PgBouncer transaction-mode pooling |
| `dev/ADR-006-trusted-research-environment.md` | ADR-006 — Deployment modes: Flexible and TRE |
| `dev/ADR-007-authentication-model.md` | ADR-007 — Authentication model |
| `dev/ADR-008-geomts-data-model.md` | ADR-008 — GeoMTS as the unifying wearable data abstraction |
| `dev/ADR-009-redcap-integration.md` | ADR-009 — REDCap as the primary data integration target for MVP |
| `dev/ADR-010-soft-delete-no-hard-deletion.md` | ADR-010 — Soft-delete only: no hard deletion of users, teams, or datasets |
| `dev/ADR-011-hipaa-audit-logging.md` | ADR-011 — HIPAA audit logging model |
| `dev/ADR-012-project-dataset-linking.md` | ADR-012 — Project–dataset linking and shared-dataset projects |
| `dev/ADR-013-brand-theming-white-label.md` | ADR-013 — Brand theming: CSS tokens now, white-label later |
| `dev/ADR-014-ai-assistant-claude.md` | ADR-014 — PHI-safe AI chat (Claude), team keys |
| `dev/ADR-015-docker-deployment-packaging.md` | ADR-015 — Docker deployment packaging (standalone, non-Spark) |
| `dev/ADR-016-paired-sample-importer-repos.md` | ADR-016 — Paired sample and importer repositories |
| `dev/ADR-017-community-package-registry.md` | ADR-017 — Community package registry |
| `dev/ADR-018-contributions-catalog.md` | ADR-018 — Contributions catalog; no project notebook registry |
| `dev/ADR-019-mets-wear-compliance-analytics.md` | ADR-019 — METs and wear-compliance analytics (contributions + cohort dashboards) |
| `dev/ADR-020-basic-dataset-stats-dashboard.md` | ADR-020 — Basic dataset statistics dashboard (Admin & User parity) |
| `dev/ADR-README.md` | ADR Readme |
| `dev/analytics-contributions.md` | Analytics contributions — RA handoff (METs & wear compliance) |
| `dev/architecture.md` | Architecture |
| `dev/august-2026-release-plan.md` | August 2026 release plan — 0.3.0 Peña Roja |
| `dev/developer-setup.md` | Developer Setup |
| `dev/docs-fixtures.md` | Local docs fixtures |
| `dev/mvp.md` | MVP |
| `dev/notes.md` | notes |

## `guide/`

| File | Title |
|------|-------|
| `guide/ai-chat.md` | PHI-safe AI chat |
| `guide/docker-deployment.md` | Docker Deployment |
| `guide/hipaa-compliance.md` | HIPAA Compliance |
| `guide/sample-packages.md` | Contributions |
| `guide/setting-up-projects.md` | Setting Up Projects |
| `guide/smpt-configuration.md` | SMPT Configuration |
| `guide/welcome-admin.md` | Welcome — Admin |
| `guide/welcome-super-admin.md` | Welcome — Super admin |
| `guide/welcome-user.md` | Welcome — User |

## `faq/`

| File | Title |
|------|-------|
| `faq/faq.md` | Frequently Asked Questions |

## `releases/`

| File | Title |
|------|-------|
| `releases/2026-06.md` | Release notes — June 2026 |
| `releases/2026-07.md` | Release notes — July 2026 |
| `releases/archive.md` | Release notes archive |
| `releases/earlier-2026.md` | Release notes — earlier 2026 |

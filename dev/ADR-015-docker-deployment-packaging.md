---
title: "ADR-015 — Docker deployment packaging (standalone, non-Spark)"
description: Containerized distribution of the Flexible-mode stack (app, api, notebooks) via Docker Compose, with PostgreSQL external.
updated_by: limbasiabb@gmail.com
updated_at: 2026-08-16T00:00:00.000Z
---
**Status:** Draft  
**Date:** 2026-08-11  
**Relates to:** ADR-006 (deployment modes), ADR-007 (authentication model), ADR-011 (HIPAA audit logging)  
**References:**
- W4H MVP Requirements §14 (Deployment, Dep-01–Dep-05)
- W4H MVP Requirements §6.3 (API Key Data Access, D-16–D-21)
- [guide/docker-deployment.md](../docker-deployment) (setup instructions)

---

## Context

Dep-01 through Dep-05 (MVP §14) require a standalone, non-Spark Docker distribution: `.env`-driven config, images on a public registry, and setup docs. This ADR is the packaging decision for that distribution, scoped to **Flexible mode only** (ADR-006). TRE packaging is not planned.

This ADR packages the current codebase as it runs today: Vue 3/Vite frontend, Express API, external PostgreSQL, GeoMTS/project-token data model.

Reading the current `w4h-api` source surfaced constraints that shape the packaging decision:

- Mermaid diagrams in the docs system render server-side via `mermaid-isomorphic` (Playwright, headless Chromium). Diagrams need to render, so the image needs a real path to Chromium's runtime dependencies.
- Vite bakes `VITE_API_URL` into the static bundle at `npm run build` time. A single image published to a registry cannot carry a deployment-specific API origin.
- `app.js` calls `ensureSchema()` on every boot (schema only). Docs are only imported into Postgres via `importDocs()`, which today only runs through the interactive first-run setup wizard, not automatically on every start.
- The API's `/` route shells out to `git rev-parse --short HEAD` unguarded. This throws in a container that has no `.git` directory.
- `ensureSchema()` does not wait for or retry a not-yet-reachable Postgres. It warns and continues, which is a silent failure mode against an external database that may not be up yet.

The intended end-user experience: a researcher runs `docker compose up` and gets, immediately, the app, the api, their own scoped access to the database through a personal API key, and a preconfigured sample notebook to try the platform with.

## Decision

### Component boundaries

Four services, one Compose file, no database container. PostgreSQL is external, operated by the deploying institution.

| Service | Role | Published port |
|---|---|---|
| `api` | Express API. Owns all DB access, auth, docs import, audit log | None. Internal network only |
| `app` | Static Vue build served by nginx. Reverse-proxies `/api/*` to `api` | The one public port |
| `notebooks` | Single-user Python and Jupyter environment, one preloaded sample notebook | Internal by default (`127.0.0.1`), token auth on |

`fft_approximate` (approximate range queries) is not a container in this stack. It is a PostgreSQL extension that compiles against the target Postgres server directly. Its installation is a documented prerequisite in the setup guide, not a build artifact here, since Postgres is external.

### Base image

- `api` and `notebooks` use `node:22` and a standard Python/Jupyter base image respectively. Image size is not a constraint for this project.
- `api`'s image installs Playwright's Chromium at build time, so Mermaid diagrams render server-side as they do outside Docker.
- `bcrypt`'s native module builds cleanly against these base images with no extra toolchain steps.

### Frontend delivery

- The `app` image is built once, with `VITE_API_URL` set to a relative path (`/api/`).
- nginx in the `app` container reverse-proxies `/api/*` to the `api` service over the internal Compose network.
- One published image works across every deployment, with no runtime template substitution and no CORS configuration, since the browser only ever talks to one origin.
- `api` has no published port. It is reachable only from `app` and `notebooks` on the internal network.

### Docs

- `w4h-docs` markdown is copied into the `api` image at build time (CI checks it out at a pinned ref). No new runtime secret is needed for the deploying institution.
- The entrypoint runs `ensureSchema()`, then explicitly calls the existing `importDocs()` (an idempotent, slug-keyed upsert), on every container start, not just on first initialization. Every restart, including after pulling an updated image, resyncs Postgres's `docs` table to whatever markdown is baked into that image. Users are never served docs older than the image they are running.
- The entrypoint waits for Postgres to accept connections before running either step.
- The `/` route's `git rev-parse` call is replaced with a `GIT_COMMIT` build `ARG`, set at `docker build` time.

### Notebooks

- The `notebooks` service is a plain Python and Jupyter image that **preloads the w4h-sample-fitbit-csv-importer contribution** (and the paired `w4h-sample-fitbit-csv` package) ([ADR-016](ADR-016-paired-sample-importer-repos.md), [ADR-018](ADR-018-contributions-catalog.md)). Do not copy legacy `w4h-notebooks` loaders or a hand-rolled sample notebook that is not in the catalog.
- It ships enabled by default, as part of the base `docker compose up`, not behind an opt-in profile.
- It reads `W4H_API_KEY` from an environment variable in its first cell. The key is never hardcoded in the `.ipynb` file.
- Further edits to the notebook, or new notebooks the user adds, are the user's or team's own responsibility. The platform does **not** version or track project notebook content ([ADR-018](ADR-018-contributions-catalog.md)). This Compose service is not a project notebook registry.

**Relationship to ADR-006:** Flexible mode's stated footprint is "W4H API + PostgreSQL + authentication. No JupyterHub, no egress review infrastructure," with the notebook environment listed as "Researcher's own (local, HPC, cloud)." This ADR reads that as ruling out centrally administered, multi-tenant notebook infrastructure (JupyterHub provisioning and mediating sessions across a team), which remains a TRE-mode concern. The `notebooks` service here is single-tenant: one container, one researcher, no cross-user orchestration, no session mediation by the platform. It is a convenience artifact of the distribution, comparable to handing a researcher a laptop that arrives with Jupyter and one example already installed, not managed infrastructure the platform operates on the researcher's behalf. This ADR does not edit ADR-006. It records this scoped reading for the `notebooks` service defined here.

### Credential handling

- The sample notebook reads `W4H_API_KEY` from an environment variable, never a literal string in the file.
- Jupyter's built-in token authentication stays on. The `notebooks` service is not started with an empty or disabled token.
- `notebooks` binds to `127.0.0.1` by default, not `0.0.0.0`. This is revisitable per deployment in the setup guide.
- Every image's `.dockerignore` excludes `.env*`, so no secret material is baked into an image layer.
- The underlying security model (personal, TTL-scoped, revoked-on-discontinuation API keys, every request logged, per ADR-007 and ADR-011) is unchanged by this ADR. Packaging keeps to it: no plaintext key in logs, no unnecessary CORS, no unauthenticated notebook access.

### Registry

Recommendation: GitHub Container Registry (`ghcr.io`), tied to existing org GitHub auth. Not yet confirmed, tracked as open.

## Consequences

**Positive:**
- One image per service works unmodified across every Flexible-mode deployment, with no per-institution rebuild for a different API origin
- Docs staleness after an image update is structurally prevented, not dependent on an operator remembering a manual step
- The sample notebook gives a new researcher a working, credentialed example within one `docker compose up`, with no separate Jupyter install
- Credential-handling defaults (token auth on, localhost bind, no baked secrets) hold even if an operator does nothing beyond the documented setup steps

**Negative / risks:**
- The `api` image is meaningfully larger than a minimal build, mainly due to Chromium. Accepted, since Mermaid rendering is required and size is not constrained.
- Shipping a single-user notebook service by default reads Flexible mode's footprint more broadly than ADR-006's text. Recorded above as a scoped reading, not a redefinition. A reviewer who disagrees with that reading should raise it against this ADR, not ADR-006.
- `notebooks` adds one more running service and one more auth boundary to keep correctly configured. Mitigated, not eliminated, by the credential-handling defaults.

## Alternatives not chosen

- **Opt-in Compose profile for `notebooks`:** rejected. The intended out-of-the-box experience includes the sample notebook with no extra flag.
- **Runtime `envsubst` injection of `VITE_API_URL`:** rejected in favor of the nginx reverse proxy. One build instead of a build plus a substitution step, and no CORS configuration to maintain.
- **Bundling `fft_approximate` into this Compose stack:** rejected. It compiles against the external target Postgres server and is a database-side prerequisite, not a service this component runs.
- **TRE-mode packaging in the same effort:** rejected. Not planned. This ADR is Flexible-mode only, consistent with ADR-006.

## Changelog

| Date | Change |
|---|---|
| 2026-08-16 | `notebooks` image preloads the catalog importer contribution, not a generic sample notebook. |
| 2026-08-12 | Local prototype built and validated end to end against a real Postgres: cold start (schema, docs import, setup wizard, personal API key, sample notebook run), docs resync after an `api` rebuild, and restart/`down`+`up` resilience all pass. Found and fixed two pre-existing `w4h-api` bugs surfaced by this: the `/` route's unguarded `git rev-parse` (crashes the process on Node 22 in a container with no `.git` dir) and `lib/docs-mermaid-render.js` reading the wrong result shape from `mermaid-isomorphic`, which silently failed every diagram render. Status stays Draft pending review. |
| 2026-08-11 | Initial draft. |

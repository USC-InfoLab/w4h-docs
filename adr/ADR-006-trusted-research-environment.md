---
title: "ADR-006 — Deployment modes: Flexible and TRE"
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-04T23:10:40.000Z
---
# ADR-006 — Deployment modes: Flexible and TRE

**Status:** Accepted  
**Date:** 2026-07-04  
**Revised:** 2026-07-05  
**Relates to:** ADR-007 (authentication model), ADR-004 (ACL roles)  
**References:**
- W4H MVP Requirements §14 (Deployment, Dep-01–Dep-05)
- W4H MVP Requirements §8 (HIPAA Compliance)
- UK Biobank Research Analysis Platform (RAP)
- All of Us Researcher Workbench

---

## Context

W4H is primarily an **analytics platform for trial researchers** — not a subject management system. Researchers need to run notebooks, train models on GPU clusters (cloud or private HPC), and iterate quickly on wearable time-series data. Two very different institutional contexts exist:

**Academic / early-stage deployments** — a research group or CTSI-affiliated lab runs W4H on institutional servers or a modest cloud instance. They have no managed notebook infrastructure. Researchers work locally in Jupyter or VS Code, connect to the W4H data API with a personal API key, and run modeling jobs on whatever GPU resources they have access to (university HPC, Google Colab, personal workstation). Asking these groups to operate a full TRE is disproportionate to their resources and slows research.

**Institutional / regulated deployments** — a hospital, health system, or large research network deploys W4H as a managed platform. They have the infrastructure, compliance team, and budget to operate a Trusted Research Environment. Data may include directly identifiable PHI. The institution's IRB and compliance office require that raw data never leave a controlled environment.

A single deployment architecture cannot serve both contexts well. The TRE model (as originally written in ADR-006 v1) is the right target for regulated deployments but is unnecessarily burdensome — and practically unworkable for GPU-intensive modeling — for early-stage academic use.

Additionally, the TRE model conflicts with a core use case: training ML models (BysGNN, NeuroGNN, WaveGNN) on private GPU clusters or cloud GPU instances. Running these workloads inside a TRE requires either bringing the GPU resources inside the TRE boundary (costly and complex) or exporting data to the compute (which defeats the TRE principle). This is not a theoretical concern — it is a fundamental operational constraint for any serious modeling workload.

## Decision

W4H supports **two deployment modes**, selected at deployment time by the institution. The platform code is identical; the mode governs how data access and compute are permitted.

---

### Mode 1 — Flexible mode (default for MVP)

Designed for academic research groups, CTSI-affiliated labs, and early-stage deployments.

**How it works:**
- Researchers authenticate via personal API key (see ADR-007)
- The W4H data API returns query results directly to the caller — local notebook, script, or remote compute (HPC, cloud GPU)
- No managed notebook environment is required
- Modeling runs wherever the researcher has compute — local machine, university HPC, cloud GPU instance
- The platform enforces project-membership ACL on every request; what the institution does with that data beyond the API boundary is governed by the institution's IRB-approved data management plan, not the platform

**What the platform guarantees in Flexible mode:**
- Every data access request is authenticated (personal API key tied to a named user)
- Every request is logged in the audit trail (user, dataset, timestamp, row count, IP)
- Access is scoped to project memberships — a user cannot query datasets outside their assigned projects
- Discontinued users are immediately locked out — all keys revoked

**What the institution is responsible for in Flexible mode:**
- Data handling policy beyond the API (storage on local machines, HPC data transfer agreements, cloud HIPAA BAA)
- IRB data management plan specifying appropriate use of local data access
- Ensuring researchers understand their obligations

**Deployment footprint:** W4H API + PostgreSQL + authentication. No JupyterHub, no egress review infrastructure.

---

### Mode 2 — TRE mode (post-MVP, for regulated institutional deployments)

Designed for hospital systems, health networks, and large research programmes with identifiable PHI and institutional compliance requirements.

**How it works:**
- All compute runs inside the TRE boundary — JupyterHub spawns per-user notebook servers inside the environment
- Raw query results never leave the TRE — researchers see outputs in their managed notebook
- Results (aggregated outputs, model artifacts, figures) pass through an egress review before download
- GPU compute must either run inside the TRE or be handled via a data export approval process governed by the institution
- Researchers authenticate via JWT from the institutional IdP (MFA enforced)

**Why TRE mode is post-MVP:**
- Requires JupyterHub deployment, IdP integration, egress review process, and controlled package mirror — significant operational overhead
- GPU modeling inside a TRE requires either dedicated GPU infrastructure inside the boundary or a separate secure data export process — costly and complex to set up correctly
- The academic research groups that are W4H's initial user base do not have the infrastructure or compliance requirements that justify TRE operation

**When to use TRE mode:**
- Institution's IRB or compliance office requires it
- Data includes directly identifiable PHI that cannot leave the institutional environment
- Institution has the infrastructure to operate JupyterHub and an egress review process

---

### Deployment mode summary

| | Flexible mode | TRE mode |
|---|---|---|
| **Default for MVP** | Yes | No — post-MVP |
| **Authentication** | Personal API key | JWT from IdP + MFA |
| **Data leaves environment** | Yes — to caller's machine | Never — compute inside TRE |
| **Notebook environment** | Researcher's own (local, HPC, cloud) | Managed JupyterHub inside TRE |
| **GPU modeling** | Anywhere researcher has compute | Inside TRE or via approved export |
| **Egress review** | No | Yes |
| **Compliance posture** | Institution's IRB/DMP governs | Platform enforces containment |
| **Operational complexity** | Low | High |
| **UK Biobank / All of Us alignment** | No | Yes |
| **Right for** | Academic labs, CTSI groups, early-stage | Hospital systems, regulated networks |

### Switching between modes

A deployment starts in one mode. Migrating from Flexible to TRE mode is additive — add JupyterHub, configure the IdP, enable egress review, issue JWTs instead of API keys. The database schema, ACL model, and audit log are identical in both modes.

## Consequences

**Positive:**
- MVP is achievable without TRE infrastructure — the right scope for the SC CTSI pilot
- Researchers can use their own compute (HPC, cloud GPU) without platform constraints — essential for serious ML workloads
- Institutions that need TRE have a clear upgrade path
- Platform code is identical across modes — no forking

**Negative / risks:**
- Flexible mode places compliance responsibility on the institution — W4H must clearly document this in deployment guides so institutions understand what they are signing up for
- UK Biobank / All of Us alignment is only achieved in TRE mode — grant reviewers familiar with those platforms should be made aware of the staged approach
- A researcher in Flexible mode who mishandles data on their local machine is the institution's liability, not the platform's — this must be explicit in the terms of deployment

## Alternatives not chosen

- **TRE-only:** Rejected — unworkable for GPU modeling, disproportionate for academic early-stage deployments, and not feasible for the MVP timeline.
- **Flexible-only (no TRE path):** Rejected — regulated institutional deployments with identifiable PHI need the TRE option. Without it, W4H cannot be adopted by hospital systems or large research networks.
- **Single mode with configurable egress controls:** Considered — allow the admin to toggle egress review on/off within a single mode. Rejected because the operational requirements (JupyterHub, managed notebooks, IdP) are so different between the two modes that treating them as one with flags creates a confusing half-implemented middle ground.
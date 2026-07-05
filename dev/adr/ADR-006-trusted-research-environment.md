# ADR-006 — Trusted Research Environment (TRE) model

**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team  
**References:** UK Biobank RAP, All of Us Researcher Workbench, NCSC TRE specification

---

## Context

W4H handles Protected Health Information (PHI) from clinical trials and must satisfy:

- HIPAA technical safeguards (access control, audit, transmission security, encryption at rest)
- IRB data governance requirements (data stays within a controlled environment)
- Researcher usability (Jupyter notebooks, Spark modeling, SQL queries)
- Deployment flexibility (institutional on-premise, HPC clusters, HIPAA-compliant cloud)

The naive approach — giving researchers database credentials or downloadable datasets — fails on all compliance axes. Researchers would have raw PHI on their laptops, audit trails would be incomplete, and data governance would be unenforceable.

The established solution in clinical and genomic research (UK Biobank RAP, All of Us Researcher Workbench, Genomics England) is the **Trusted Research Environment (TRE)**, also called a Secure Research Environment or Data Safe Haven.

## Decision

W4H adopts the TRE model. The governing principle is:

> **Compute comes to the data. Data never goes to the researcher.**

The TRE is a self-contained, network-isolated environment containing all compute (JupyterHub, Spark), the W4H API proxy, and the PostgreSQL database. Researchers interact with their notebook server running *inside* the TRE via a browser. Results of analyses — aggregated outputs, model artifacts, figures — pass through an **egress review** before they can be downloaded. Raw PHI never crosses the TRE boundary.

### TRE components

| Component | Role |
|---|---|
| Identity provider (IdP) | Authenticates users; issues short-lived JWTs after MFA |
| JupyterHub | Spawns per-user notebook servers inside the TRE; injects auth token automatically |
| Spark cluster | Unattended compute; uses service account credentials (see ADR-007) |
| W4H API proxy | Single point of data access; enforces permissions, read-only SQL guard, audit log |
| PostgreSQL | Data zone — no external network access; encrypted at rest |
| Egress review | Human or automated check before any file leaves the TRE |

### What crosses the TRE boundary

| Inbound | Outbound |
|---|---|
| HTTPS login (browser) | Reviewed, approved result files only |
| Researcher's code (notebook cells, scripts) | Aggregated outputs (counts, models, figures) — post-egress-review |
| Software packages (via controlled package mirror) | Audit log exports (super admin only) |

Raw data, query result sets, and subject-level records **never** leave the TRE.

### Deployment targets

The TRE stack is deployment-target-agnostic. The same architecture runs on:

- **On-premise institutional servers** — hospital or research institute data centre
- **HPC / university cluster** — with institutional LDAP as the IdP
- **HIPAA-compliant cloud** — AWS (with BAA: GovCloud or standard + BAA), Azure (Government or standard + BAA), GCP (with BAA)

The deployment target is an infrastructure concern. The TRE boundary, access controls, and egress review process are identical across targets.

## Consequences

**Positive:**
- PHI never leaves a controlled environment — satisfies HIPAA physical and technical safeguard requirements
- Audit trail is complete — every query, login, and file egress is logged inside the TRE
- Researcher experience is familiar — standard Jupyter/Spark workflow, no special tooling
- Deployment flexibility — same architecture on any compliant infrastructure
- Aligns with established clinical/genomic research standards (reviewers and IRBs recognise the model)

**Negative / risks:**
- Operational complexity — JupyterHub, Spark, IdP, and egress review are additional components to deploy and maintain
- Latency — all computation runs inside the TRE; researchers cannot use their local compute. This is by design but requires the TRE to have adequate resources
- Egress review process must be defined — who reviews, what criteria, what turnaround time. This is an organisational process, not just a technical one
- Package management — researchers need a controlled package mirror inside the TRE (or a curated package allowlist) to prevent data exfiltration via package-embedded code

## Alternatives not chosen

- **Downloadable de-identified datasets:** De-identification is insufficient for clinical trial data — re-identification risk remains, and many variables (rare diagnoses, precise timestamps) cannot be safely de-identified. Rejected on regulatory grounds.
- **VPN + database credentials:** A VPN gives researchers a network path to the database but does not prevent local data storage, enforce egress controls, or provide a complete audit trail. Rejected — does not satisfy HIPAA technical safeguards.
- **API-only access with no TRE:** An API proxy (as originally designed) prevents direct DB access but still returns query result sets to the researcher's local machine. Rejected for datasets containing PHI — raw subject-level records must not leave the controlled environment.

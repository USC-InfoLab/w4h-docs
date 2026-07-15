---
title: ADR-009 — REDCap as the primary data integration target for MVP
description: ""
updated_by: nocera@usc.edu
updated_at: 2026-07-05T01:23:50.000Z
---
**Status:** Accepted  
**Date:** 2026-07-04  
**Deciders:** W4H architecture team  
**References:**
- W4H MVP Requirements §9 (REDCap Integration, R-01–R-07)
- W4H MVP Requirements §16 (Out of Scope: FHIR API endpoints)

---

## Context

Clinical research teams running wearable studies do not operate in isolation — they capture demographic, clinical, and outcome data in parallel using data collection platforms. W4H needs at least one integration point with these platforms for the MVP so that wearable time-series data can be linked to subject-level clinical context.

Two integration targets were the primary candidates:

**REDCap (Research Electronic Data Capture)** — a web-based platform for building and managing clinical research databases and surveys, developed and maintained by Vanderbilt University and widely adopted in academic medical centres. REDCap is used in over 6,500 institutions across 164 countries, and is the dominant data capture tool in US academic clinical trials, particularly in NIH-funded and CTSI-affiliated research (W4H is funded by the SC CTSI Pilot Funding Program).

**FHIR (Fast Healthcare Interoperability Resources)** — the HL7 standard for clinical data exchange, increasingly adopted by EHR vendors (Epic, Cerner) and mandated by the 21st Century Cures Act for patient data access. FHIR is the long-term interoperability standard for clinical systems.

The question for MVP is: which integration target provides the most value to the immediate W4H research user base with the lowest implementation cost?

## Decision

**REDCap is the primary integration target for the MVP.** FHIR is explicitly deferred to post-MVP as a planned interoperability layer.

### Why REDCap for MVP

**User base alignment.** The W4H MVP is funded by SC CTSI and targets academic clinical research teams. These teams almost universally use REDCap for clinical data capture alongside their wearable data collection. A researcher running a Fitbit study at a CTSI-affiliated institution is almost certain to have a REDCap project for demographics, questionnaires, and clinical endpoints. REDCap integration is immediately useful to every likely W4H early adopter.

**API maturity.** REDCap exposes a well-documented, token-authenticated REST API that supports record export, field metadata, and incremental sync. This maps cleanly to W4H's ingestion model (R-01–R-04). No complex SMART on FHIR OAuth flows, capability statements, or resource type negotiation.

**Practical data linkage.** The core integration value is linking wearable time-series to subject-level records — demographics, diagnoses, questionnaire responses, clinical endpoints. REDCap holds exactly this data in W4H's target research context. A REDCap `record_id` becomes the `subject_id` that anchors GeoMTS time series to clinical context.

**Implementation cost.** A REDCap integration requires: an API token, a field mapping step (R-03), a sync scheduler (R-04), validation against the GeoMTS schema (R-06), and audit logging (R-05). This is a contained, well-scoped feature. A FHIR integration requires implementing resource type handling (Patient, Observation, Condition, Procedure), SMART on FHIR authentication, capability negotiation, and mapping FHIR Observations to GeoMTS signal types — substantially higher complexity.

### REDCap integration scope (MVP)

| Requirement | Detail |
|---|---|
| R-01 | Connect to a REDCap instance via REDCap API (token-based auth) |
| R-02 | Import a REDCap project's records into a W4H dataset |
| R-03 | Map REDCap field names to GeoMTS schema fields at import time — UI-assisted field mapping |
| R-04 | Schedule recurring incremental REDCap syncs (new/updated records only) |
| R-05 | Log all REDCap import events in `w4h.audit_log` (user, timestamp, record count, status) |
| R-06 | Validate imported records against the dataset's GeoMTS schema; surface validation errors |
| R-07 | Show import errors and validation warnings in the admin UI |

### FHIR deferral rationale

FHIR is the right long-term interoperability target — EHR integration, patient-facing apps, and regulatory submissions will eventually require it. It is deferred for two reasons:

1. **Complexity disproportionate to MVP user need.** Academic research teams with REDCap do not need FHIR for their W4H workflow. FHIR becomes relevant when integrating with hospital EHRs (Epic, Cerner) or building patient-facing data return flows — use cases that are post-MVP.

2. **GeoMTS–FHIR mapping is non-trivial.** Mapping high-frequency wearable time series (25Hz accelerometer) to FHIR Observation resources is architecturally complex and not standardised. The FHIR community is still developing profiles for wearable data (Apple Health, Fitbit). Implementing this correctly requires dedicated work and should not be rushed into an MVP.

FHIR is planned as a post-MVP export/interoperability layer — a translation layer from GeoMTS to FHIR Observation bundles, not a change to the internal data model.

## Consequences

**Positive:**
- Immediate value for the SC CTSI-affiliated research teams who are W4H's primary early adopters
- REDCap API is stable, well-documented, and widely understood by clinical research informatics teams
- `record_id` as `subject_id` provides a clean, auditable link between REDCap clinical data and W4H wearable time series
- Contained implementation scope — REDCap integration can ship within the MVP timeline

**Negative / risks:**
- Teams not using REDCap (some industry-sponsored trials use Medidata Rave, Veeva Vault, or Oracle Clinical) have no integration path in MVP — they must use CSV/JSON ingestion
- REDCap API tokens are long-lived credentials — must be stored encrypted in W4H configuration and rotated per institutional policy; accidental exposure would give read access to the REDCap project
- Incremental sync (R-04) requires REDCap's "Data Access Logging" or a `date_modified` field to be present in the REDCap project — not all REDCap projects are configured this way; import documentation must flag this dependency
- FHIR deferral means W4H cannot integrate with hospital EHRs in MVP — a limitation for any trial wanting to pull clinical endpoint data from Epic or Cerner

## Alternatives not chosen

- **FHIR as MVP integration:** Rejected — implementation complexity is high, the GeoMTS–FHIR mapping for wearables is not standardised, and it does not serve the immediate REDCap-using research user base. Planned post-MVP.
- **CSV/JSON only (no integration):** Rejected — CSV import is necessary and included (D-09/D-10), but it requires manual export from REDCap and manual re-import, breaking the recurring sync use case (R-04). A direct REDCap API integration eliminates this manual step for the most common tool in the target user base.
- **Medidata Rave / Oracle Clinical:** Industry-standard clinical trial management systems used in pharma-sponsored trials. Rejected for MVP — W4H's current target is academic research teams; industry trial systems are a post-MVP consideration.
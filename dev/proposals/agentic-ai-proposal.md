---
title: "Proposal — Agentic AI first release and the SQL question"
description: Team discussion draft. Not decided; no ADR or MVP effect. Fixed PHI-safe tools first, an optional view-scoped SQL tool later, and an open vendor/BAA question.
---

> **Status: Proposal for team discussion. Not decided.** Nothing here changes the MVP, any ADR, or `AGENTS.md`. If the team agrees, the follow-up is a new ADR and §13.4 updates ([next steps](#next-steps-if-approved)).

## What we need from the team

1. Agree on the **first agentic release** (Proposal A).
2. Decide whether to **keep "no free SQL" as written** or allow a narrow exception later (Proposal B).
3. Get a **written answer from USC** on which OpenAI product, if any, is approved for PHI (Vendor / BAA).

## Where we are

- **MVP (shipping):** single-turn, PHI-safe chat on Claude through the API proxy. Egress filter, team or platform keys, modes Help · Import · IRB · Analytics ([ADR-014](../ADR-014-ai-assistant-claude.md)).
- **Already planned, post-MVP, Draft:** a bounded server-side tool loop ([ADR-025](../ADR-025-phi-safe-agent-tools.md)), a provider adapter ([ADR-026](../ADR-026-multi-provider-llm.md)), phasing in [agentic-ai-roadmap.md](../agentic-ai-roadmap.md), and MVP rows AI-17 to AI-20 (§13.4).
- **Rule in force:** no free-SQL endpoint or tool. SQL analytics are YAML-bound contributions ([ADR-023](../ADR-023-sql-analytics-contributions.md)). ADR-025 lists SQL, row fetch and filesystem as never registered.

This proposal adds to ADR-025. It does not replace it.

## Proposal A — first release: fixed, read-only, PHI-safe tools

One orchestrator in the existing chat, with a **mode-scoped tool allowlist**. No separate agents per function.

| Tool | Does | Confirm |
|---|---|---|
| `search_help_docs` | Live lookup of Help and project pages, with citations | No |
| `list_contributions` | Catalog lookup | No |
| `get_dataset_signals` | Schema, subject counts, date ranges, no rows | No |
| `propose_navigation` | Returns a link the user clicks | Click |
| `run_contribution` | Runs a YAML-bound SQL contribution on a chosen dataset ([ADR-023](../ADR-023-sql-analytics-contributions.md)) | Explicit dialog, audited |
| `run_quality_profile` (optional) | Wear gaps, duplicates and timestamp drift as aggregates, reusing the wear-compliance protocol ([ADR-019](../ADR-019-mets-wear-compliance-analytics.md)) | No |

Design points:

- **Server-side loop.** Authorize, PHI-scan, call the model, run tools, repeat. A step cap (default 8) and token cap apply.
- **ACL on every tool call.** Project membership decides data access ([ADR-027](../ADR-027-cross-org-project-collaboration.md)). Client-sent IDs are never trusted.
- **Tool registry shaped like an MCP server.** The same tools could later serve external clients.
- **Provenance on answers.** Each answer records dataset, contribution version and mapping version, extending the audit rows in ADR-011.
- **Golden-question eval set in CI.** About ten questions, plus ACL and PHI red-team cases.
- **Results stay out of the prompt.** Tool outputs reach the UI. The model sees counts and schema only.

Scoped to a handful of tools, this is small and does not touch the free-SQL rule.

## Proposal B — optional, later: view-scoped read-only SQL

**Only if A proves too limiting.** Fixed tools cannot cover the long tail of researcher questions.

**What it would be:** the model writes `SELECT` SQL against *approved views only*. These would be GeoMTS-mapped views and derived-metric tables, already scoped to the user's projects.

**Safeguards:**

- `SELECT` only, checked against an allowlist by parsing the SQL.
- A dedicated read-only database role with `statement_timeout` and row limits.
- No base-table access, and no joins across collaborating teams' datasets.
- Results go to the UI as a table or chart. The model gets schema, row count and column summaries only.
- A good query can be **saved as a YAML contribution**, so it becomes versioned and citable.

**What it would amend:** the "no free-SQL" line in `AGENTS.md`, the scope of ADR-023, and the "never registered" row and "not chosen" entry in ADR-025.

**Why it may not be worth it:**

- It needs real security work: the views, the role and the validator.
- Model-written SQL can re-derive metrics such as wear time differently each run, which hurts reproducibility.

**Alternative:** stay with fixed tools only and add contributions as demand appears. That is the lower-risk path.

**Also considered, not recommended:** a structured-intent compiler, where the model emits metric, period and filters and the server writes the SQL. It is safer, but it is a larger build than B.

## Vendor / BAA

**What we know**

- USC's [ChatGPT Edu faculty guidance](https://www.provost.usc.edu/faculty-guidance-chatgpt-edu-spring-2026/) says not to put PII or PHI into the general workspace. It describes a separate HIPAA-compliant workspace for Keck Medicine of USC. We have not seen confirmation that it has launched or what its terms are.
- Third-party sources say OpenAI signs BAAs only for API, sales-managed Enterprise/Edu, and healthcare offerings. We have not checked this against USC documents.

**What we don't know:** whether "preferred vendor" means PHI-approved, which product and which BAA apply, and whether non-Keck research data is covered.

**Questions for the USC privacy office and IT security**

1. Which OpenAI products are covered by a signed BAA?
2. Does that coverage extend to non-Keck research data and to the API or Azure OpenAI?
3. Is zero data retention available and enabled?
4. Does the institution allow Claude (Anthropic) under an equivalent agreement?

**Why this isn't blocking:** W4H sends no PHI to any model by design ([ADR-014](../ADR-014-ai-assistant-claude.md)). The answer decides what the egress filter's *permissive* mode may be used for, and which providers [ADR-026](../ADR-026-multi-provider-llm.md) should prioritize.

## Out of scope

A multi-agent set (CDISC mapper, safety triage, statistical-analysis agent, reporting agent). That design suits a regulated-trial platform. For this pilot one orchestrator with a tool allowlist covers the need.

## Decisions

| # | Decision | Recommendation | Owner | Outcome |
|---|---|---|---|---|
| 1 | Adopt Proposal A as the agentic first release | Yes | | |
| 2 | Allow Proposal B as a later exception | Defer; revisit after A | | |
| 3 | Send the vendor/BAA questions to USC | Yes | | |
| 4 | Start OpenAI-family support before an answer arrives | No | | |

## Next steps if approved

1. Draft ADR-030 (or edit ADR-025 and ADR-026) to match the decisions.
2. Update MVP §13.4 rows AI-18 to AI-20 and add the eval-set requirement.
3. Update `agentic-ai-roadmap.md` phasing.
4. Regenerate `DOCS_INDEX.md`.

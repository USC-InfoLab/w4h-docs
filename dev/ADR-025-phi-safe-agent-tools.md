---
title: "ADR-025 — PHI-safe agent tools (post-MVP)"
description: Server-orchestrated tool loop on the PHI-safe chat substrate; ACL-checked metadata tools only; human confirm for mutations. Does not change MVP §13.1 scope (ADR-014).
updated_by: nocera@usc.edu
updated_at: 2026-08-26T00:00:00.000Z
---

**Status:** Draft  
**Date:** 2026-08-26  
**Relates to:** ADR-004 (roles), ADR-011 (audit), ADR-014 (PHI-safe chat), ADR-023 (SQL contributions), ADR-024 (ingest assistant)  
**References:**
- MVP §13.4 (AI-18…AI-20) — **post-MVP** requirements
- [dev/agentic-ai-roadmap.md](agentic-ai-roadmap.md) — implementation phases (internal planning)

---

## Context

[MVP §13.1](mvp.md) and [ADR-014](ADR-014-ai-assistant-claude.md) (**Accepted**) define **PHI-safe AI chat** as a **single-turn**, server-proxied assistant: context packing, PHI egress filter, team/platform keys, modes (Help · Import · IRB · Analytics), and conversation history. ADR-014 already states default tools must not `SELECT`/export row data — but **no tool loop is implemented** in MVP.

Researchers expect Cursor-like **streaming** (MVP AI-01a, still in progress) and, longer term, assistants that **fetch live catalog/schema metadata** and guide multi-step workflows (ingest mapping, contribution runs) without pasting PHI.

This ADR scopes **agentic** behavior as a **post-MVP extension** of the same substrate. It must **not** delay or redefine MVP delivery of AI-01…AI-16, D-35 (ingest assistant), or AI-05…AI-08.

## Decision

### 1. Post-MVP only

Agent orchestration (`lib/ai/agent.js`, tool registry, multi-step loops) ships **after** MVP §13.1 commitments are met. MVP continues to use `POST /ai/chat` single-turn semantics.

The [ingest assistant (ADR-024)](ADR-024-ingest-assistant.md) remains **app-orchestrated** in MVP: browser builds a PHI-obscured profile; Import-mode chat proposes a mapping; the user confirms; the app calls `csv-batch`. That is not an LLM filesystem tool and does not require the agent loop for MVP.

### 2. Agent model

When implemented, the API runs a **bounded tool loop**:

1. Authorize call (same as ADR-014).
2. PHI-scan outbound user text.
3. Call LLM with a **mode-scoped tool allowlist**.
4. On `tool_use`, execute tool server-side (ACL + PHI scan on inputs/outputs).
5. Repeat until final text or `max_tool_steps` (default 8).
6. Persist rich message blocks; aggregate usage per user turn.

Streaming tool steps and tokens follow the same SSE path as chat streaming (post-MVP AI-01a completion + AI-18).

### 3. Tool classes

| Class | PHI (strict) | Confirm in UI | Examples |
|-------|--------------|---------------|----------|
| **Read-only metadata** | Allowed | No | `get_help_doc`, `get_dataset_signals`, `list_contributions` |
| **Deferred navigation** | Allowed | User clicks link | `propose_navigation` |
| **Write / run** | Allowed if metadata-only inputs | Explicit confirm dialog | `run_sql_contribution`, `save_ingest_mapping_spec` |
| **Row fetch / SQL / filesystem** | **Denied** | N/A | Never registered |

Tools reuse existing route helpers for ACL — context IDs from the client are never trusted without membership checks.

### 4. Audit and quota

- `usage_events`: `ai.agent_step` plus aggregated `ai.chat` tokens per turn.
- `audit_log` for PHI-class or write actions under permissive mode (ADR-014 §4).
- Team setting (post-MVP): max tool steps; optional disable write tools.

## Alternatives not chosen

| Option | Why not |
|--------|---------|
| Agent loop in MVP | Expands scope, cost, and PHI review surface; MVP needs reliable single-turn chat first |
| Claude filesystem / browser file tools | ADR-024; PHI egress |
| Free SQL tool for the agent | ADR-023 — YAML-bound contributions only |
| Auto-run mutations on model suggestion | Trial safety; human confirm required |

## Consequences

**Positive:** Grounded answers from live schema/docs; fewer tab hops; reusable substrate for IRB/research guided flows (AI-05…AI-12).

**Negative:** Multi-call cost; adapter complexity across providers (see [ADR-026](ADR-026-multi-provider-llm.md)); more test matrix for ACL and PHI on tool I/O.

## MVP requirement mapping

See MVP §13.4 — AI-18, AI-19, AI-20. Does **not** supersede ADR-014.

## Changelog

| Date | Change |
|------|--------|
| 2026-08-26 | Initial draft — post-MVP agent tools; bounded loop; confirm gates; ADR-024 stays app-orchestrated for MVP |

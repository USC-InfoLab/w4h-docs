---
title: "ADR-026 — Multi-provider LLM (post-MVP)"
description: Provider adapter layer beyond Anthropic Claude; OpenAI and OpenAI-compatible endpoints for institutional choice and TRE. MVP remains Claude-only (AI-02b).
updated_by: nocera@usc.edu
updated_at: 2026-08-26T00:00:00.000Z
---

**Status:** Draft  
**Date:** 2026-08-26  
**Relates to:** ADR-006 (TRE), ADR-014 (PHI-safe chat), ADR-025 (agent tools)  
**References:**
- MVP §13.4 (AI-17) — **post-MVP**
- [dev/agentic-ai-roadmap.md](agentic-ai-roadmap.md) — implementation phases (internal planning)

---

## Context

[ADR-014](ADR-014-ai-assistant-claude.md) (**Accepted**) chose **Anthropic Claude** for MVP: team BYOK keys, optional Super admin platform key, server-side proxy, PHI egress filter. MVP row **AI-02b** is **Done** on that basis.

Pilot labs may hold OpenAI or Azure OpenAI enterprise agreements (and different BAAs) instead of Anthropic. [ADR-006](ADR-006-trusted-research-environment.md) TRE deployments may require **no outbound egress**, pointing at an on-prem **OpenAI-compatible** gateway (Ollama, vLLM, institutional proxy).

Implementing multi-provider support during MVP would expand schema migrations, settings UX, compliance documentation, and agent/tool testing — without changing the CTSI pilot’s minimum viable chat surface.

## Decision

### 1. MVP stays Claude-only

Until MVP §13.1 is complete, production behavior remains:

- Anthropic Messages API via `w4h-api`
- Platform + team keys stored as Anthropic credentials (current schema)
- Super admin **default model** string for Claude model ids

No user-facing provider picker in MVP. Internal refactors may introduce a provider interface **behind** Anthropic only (zero UX change).

### 2. Post-MVP provider adapter

After MVP, add `lib/ai/providers/`:

| Provider id | Use case |
|-------------|----------|
| `anthropic` | Default; current behavior |
| `openai` | OpenAI API |
| `openai_compatible` | Custom `base_url` — Azure OpenAI, Ollama, vLLM, TRE gateway |

Normalized contract for chat and (with ADR-025) agent loops:

- `complete({ apiKey, baseUrl?, model, system, messages, tools? })`
- `stream(...)` → SSE-friendly events
- Unified token usage for quota metering

Each adapter maps message roles, tool calls, and streaming events to a common shape.

### 3. Settings (post-MVP)

**Schema (additive migration):**

- `provider` on platform and team AI settings (default `anthropic`)
- Team-level `model` (fix: team BYOK today inherits platform model)
- Optional `base_url` for `openai_compatible`
- Generalize encrypted key column (`llm_api_key_encrypted`); keep reading legacy `anthropic_*` columns during migration

**Who configures:**

| Scope | Provider | Model | Key |
|-------|----------|-------|-----|
| Platform (Super admin) | Yes | Default for quota teams | Platform |
| Team BYOK (Admin) | Yes | Team default | Lab |
| Per conversation | Post-MVP optional (AI-20) | User pick from allowlist | Inherit |

**Model allowlist:** server-side catalog per provider — Super admin enables models; prevents arbitrary endpoint strings.

### 4. PHI and ops

- Egress filter applies to **all** providers (ADR-014 unchanged).
- Browser never holds vendor keys.
- W4H does not certify BAAs; Help documents that each team chooses vendor and institutional assessment.
- TRE: assistant enabled only when platform policy allows the configured endpoint (often `openai_compatible` on internal network).

### 5. Relationship to agent tools

[ADR-025](ADR-025-phi-safe-agent-tools.md) agent loops must be tested on **Anthropic plus at least one OpenAI-family provider** before write tools ship — tool message formats differ by vendor.

## Alternatives not chosen

| Option | Why not |
|--------|---------|
| Multi-provider in MVP | Widens compliance and test scope; ADR-014 pilot assumes Claude when key exists |
| User-supplied arbitrary base URLs without allowlist | SSRF / data-exfil risk |
| Local-only LLM in MVP | ADR-014 rejected for MVP ops burden |

## Consequences

**Positive:** Institutional choice; TRE path without rewriting chat; team BYOK on preferred vendor.

**Negative:** Adapter maintenance; dual-vendor agent testing; migration from Anthropic-specific column names.

## MVP requirement mapping

See MVP §13.4 — AI-17. **AI-02b remains Claude for MVP.**

## Changelog

| Date | Change |
|------|--------|
| 2026-08-26 | Initial draft — post-MVP multi-provider; MVP Claude-only preserved |

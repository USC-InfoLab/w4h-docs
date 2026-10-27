---
title: Agentic AI roadmap (post-MVP)
description: Phased plan for PHI-safe agent tools and multi-provider LLM — explicitly outside MVP §13.1 delivery. Does not change AI-02b (Claude) or ADR-014 Accepted decisions.
updated_by: nocera@usc.edu
updated_at: 2026-08-26T00:00:00.000Z
sort_order: 99
---

Internal implementation roadmap. **Product requirements:** MVP §13.4, [ADR-025](ADR-025-phi-safe-agent-tools.md), [ADR-026](ADR-026-multi-provider-llm.md).

---

## MVP boundary (do not expand scope)

| In MVP (ADR-014, §13.1) | Post-MVP (§13.4, ADR-025/026) |
|-------------------------|-------------------------------|
| Single-turn `POST /ai/chat` | Multi-step agent tool loop |
| **Claude** via server proxy (AI-02b) | OpenAI, OpenAI-compatible / TRE |
| Static context pack + indexes | Live tool fetch of docs/signals |
| Streaming replies (AI-01a, in progress) | Tool-step streaming UI |
| Ingest assistant **app-orchestrated** (ADR-024) | Agent `confirm-tool` for writes |
| Modes Help · Import · IRB · Analytics | Mode-scoped tool allowlists |

**Rule:** Ship and stabilize MVP rows before turning on agent tools or alternate providers in production defaults.

---

## Phases (summary)

### Phase 0 — Substrate (post-MVP prep, non-breaking)

- ACL on context loading; `dataset_id` in UI context (supports AI-02, not agent-specific)
- Optional internal `providers/anthropic.js` wrapper — **no new providers in UI**
- `agent.js` skeleton behind feature flag (default off)

### Phase 0b — Multi-provider (ADR-026)

- Schema + settings for provider/model; OpenAI adapters
- **Not MVP** — feature-flagged until §13.1 complete

### Phase 1 — Streaming (MVP AI-01a + post-MVP foundation)

- SSE on provider interface
- MVP delivers streaming for Claude; adapters extended later

### Phase 2 — Read-only agent tools (ADR-025, AI-18)

- `get_help_doc`, `get_dataset_signals`, etc.
- PHI scan on tool outputs

### Phase 3 — Confirmed-action tools (AI-19)

- Navigation, SQL contribution run, cohort preview — user confirm required

### Phase 4 — Ingest + agent

- MVP: ADR-024 app profile + Import chat + csv-batch (no tool loop required)
- Post-MVP: `validate_mapping_spec` tool + richer agent UX

### Phase 5 — IRB / research guided flows (AI-05…AI-12)

- Wizards on same substrate; not separate apps

---

## Architecture (target)

```
PhiSafeChat → routes/ai.js → authorizeAiCall
                          → scanPhi
                          → agent.runLoop() [post-MVP, flagged]
                               ├ providers/* 
                               └ tools/registry
```

---

## Documentation touchpoints

- [mvp.md](mvp.md) §13.4, §16
- [ADR-014](ADR-014-ai-assistant-claude.md) — MVP Claude decision unchanged
- [guide/ai-chat.md](../guide/ai-chat.md) — post-MVP section for users

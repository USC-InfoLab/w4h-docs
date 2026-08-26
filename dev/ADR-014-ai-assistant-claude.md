---
title: "ADR-014 — PHI-safe AI chat (Claude), team keys"
description: Cursor-like multi-chat; per-team Anthropic keys; platform admin key; PHI-safe mode by default
updated_by: nocera@usc.edu
updated_at: 2026-08-25T00:00:00.000Z
---
# ADR-014 — PHI-safe AI chat (Claude): team-paid keys, context, egress filter

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** W4H architecture team  
**Relates to:** ADR-004 (roles), ADR-007 (auth), ADR-011 (audit vs usage), MVP §13  
**References:**
- MVP AI-01…AI-16
- SC CTSI Pilot — Knowledge Transfer / Usability assessments
- Anthropic Claude API (Messages)

---

## Context

MVP §13 already requires an embedded, context-aware chat helper (AI-01…AI-04) plus IRB and research tools (AI-05…AI-12). Those rows do not decide:

- Which model provider and how API keys are paid for
- How chat UX works (multi-thread, history, pin/rename)
- What “context-aware” means across Platform Admin vs app shell vs Help docs
- How to prevent **PHI / ePHI egress** to a third-party LLM

For the **SC CTSI pilot**, the assistant is also a knowledge-transfer and usability surface: faster onboarding, doc-assisted tasks, and operator help — if and only if teams can fund usage themselves and PHI does not leave the platform by accident.

Researchers expect a **Cursor-like** experience: persistent threads, tabs, context chips, streaming answers — not a single disposable modal.

Product name in the UI: **PHI-safe AI chat** (badge / mode label when the egress filter is active — the default).

## Decision

### 1. Provider and key ownership (team-paid + optional platform key)

| Key scope | Who configures | Who pays | Used when |
|-----------|----------------|----------|-----------|
| **Team Claude key** | Admin → Project → Settings (lab key); Super admin → Settings or team edit | That team / PI | Chat from app shell while acting in that team context |
| **Platform Claude key** | Super admin (Platform Admin → Settings) | Institution / platform ops (optional) | Platform Admin shell only (ops, docs authoring help, deployment Q&A) |

- Keys are stored **server-side only** (encrypted or secrets store); UI shows prefix/last-four, never plaintext after save.
- No global shared “W4H project” Anthropic key for end-user trial traffic in MVP — avoids surprise bills and clarifies BAA / data-processing responsibility per team.
- If neither team nor platform key is configured for the active context, chat shows a clear empty state (Admin: Project → Settings; Super admin: Settings); the rest of the app keeps working. Per-member chat usage is on Project → People.
- Model id (e.g. Claude Sonnet/Opus family) is configurable per key scope with a safe default; each message stores `model` + prompt-pack version for reproducibility (pilot reporting).

**CTSI pilot reflection:** Team-scoped keys match how CTSI-affiliated labs already buy cloud AI: each trial tenancy opts in and pays. The optional Super admin key lets platform operators use the same UX for admin tasks without charging a PI’s key. Pilot evaluation (M8) can treat assistant-assisted task time as a Knowledge Transfer / Usability measure without requiring a central LLM budget.

### 2. UX — Cursor-like multi-chat (per user)

- **Docked assistant** available from any authenticated page (both shells), plus optional **Open in tab** full-page route (`/assistant` or `/admin/assistant`).
- **Multi-chat:** sidebar or tab strip of threads owned by the current user.
- Per thread: **rename**, **pin**, **delete**, resume history, streaming replies.
- **Context chips** (visible, removable before send): shell (admin | app), route, role, active team/project/dataset (ids + names), current Help doc slug / project-doc title when relevant.
- Persistent **PHI-safe** indicator when `ai_phi_filter = strict` (default); clear warning when permissive.
- **Modes** (same substrate): Help · Import · IRB · Analytics (API `analysis`) — map to AI-03…AI-08; research tools AI-09…AI-12 attach as guided flows later, not separate apps. Help is product how-to; Analytics is methods and notebook code for data already in W4H.
- Chats are **private to the user** (no share-thread in MVP).

### 3. Context packing (docs / domain / shell aware)

Server builds a **context pack** for each turn:

1. System + domain primer (W4H, GeoMTS, trials vocabulary)  
2. User role + shell + route  
3. Active team/project/dataset **metadata** (never raw signal rows by default)  
4. Retrieved **platform Help** chunks (and project-doc titles/summaries when in a project) with citations  

Answers should cite Help / project doc slugs where possible (“open in Help”).

### 4. PHI-safe AI chat — egress filter (default ON)

**Product label:** PHI-safe AI chat.  
**Goal:** No identifiable health data or raw wearable rows leave W4H toward Anthropic unless a Team admin explicitly relaxes policy **and** the user confirms.

**Default: `ai_phi_filter = strict` (team + platform) — this is PHI-safe mode.**

| Layer | Behavior |
|-------|----------|
| **Allowlist context** | Route, role, non-PHI metadata (dataset name, schema column names/types, subject **counts**, date ranges as aggregates), Help/docs text, user question |
| **Blocklist / redact** | Subject IDs, emails, MRNs, free-text that looks like identifiers, GPS tracks, raw timeseries samples, query result cells, file blobs |
| **Tools** | Default tools cannot `SELECT`/`export` row data into the prompt. Schema/catalog introspection only. |
| **User paste** | Client + server scan outbound text; if high-risk patterns match, **block send** or require “I confirm no PHI” only when team policy is `ai_phi_filter = permissive` |
| **Setting** | Team admin: team AI settings — **PHI-safe (strict)** (default) \| **Permissive** (metadata + confirmed paste; still no bulk row injection). Super admin: same for platform key. |
| **Audit / usage** | `usage_events`: `ai.chat`, `ai.chat_blocked` (adoption). If a turn would include PHI-class tools under permissive mode, also write HIPAA `audit_log` (ADR-011). Chat transcripts are **not** the audit ledger. |

**PHI-safe (strict) is the CTSI / HIPAA-aligned default.** Permissive mode is for teams that have assessed third-party LLM risk (BAA / institutional policy) — W4H does not replace that assessment. The filter is heuristic and defense-in-depth; it is not a certification that every prompt is PHI-free.

### 5. Security and ops boundaries

- All Claude calls go through **w4h-api** proxy (browser never holds the Anthropic key).
- Rate / token budgets per team (and platform) configurable; soft-fail with message.
- Super admin can disable AI platform-wide.
- TRE / no-egress deployments (ADR-006): assistant disabled or replaced by on-prem model in a later ADR — MVP Flexible mode assumes outbound Claude only when a key exists and filter policy allows.

## Alternatives not chosen

| Option | Why not |
|--------|---------|
| Single platform Anthropic key for all users | Couples billing; unclear who is the data controller for prompts; CTSI labs prefer own spend |
| Per-user BYO key only | Friction for students; harder Team admin governance |
| Local-only LLM for MVP | Ops burden; quality/latency; revisit for TRE |
| Chat history in localStorage only | Lost across devices; no pilot metrics; weaker ACL |
| Auto-include query result rows “for analysis” | Unacceptable PHI egress risk |
| Shared team chat rooms | Cross-user PHI leakage; defer |
| PHI filter as optional opt-in only | Rejected — default must be PHI-safe for CTSI / HIPAA pilots |

## Consequences

**Positive:**
- Clear cost attribution (team pays for team chat; ops optional)
- Cursor-like UX matches researcher expectations and supports CTSI knowledge-transfer metrics
- **PHI-safe AI chat** is the named default — defensible for academic HIPAA-aligned pilots
- IRB / research tools reuse one substrate (modes) instead of many UIs

**Negative / risks:**
- Teams must obtain Anthropic access (and possibly a BAA) — document in Help
- Filter is heuristic — not a substitute for institutional review; false negatives possible under permissive mode
- Prompt/context size and cost need budgets and citation discipline
- Dual keys (team vs platform) require careful context switching when Super admins also hold team memberships

## MVP requirement mapping

See MVP §13.1 (AI-01a…AI-02c, AI-13…AI-16). AI-05…AI-12 remain modes/skills on this substrate. **Post-MVP** agent tools and multi-provider LLM: MVP §13.4, [ADR-025](ADR-025-phi-safe-agent-tools.md), [ADR-026](ADR-026-multi-provider-llm.md) — do not change this ADR’s Claude-first MVP decision.

## Changelog

| Date | Change |
|------|--------|
| 2026-08-26 | Post-MVP scope: agent tool loop and multi-provider LLM moved to ADR-025/026 and MVP §13.4. MVP §13.1 (Claude, single-turn chat) unchanged. |
| 2026-07-22 | Initial draft — Claude provider, team + platform keys, Cursor-like multi-chat, strict PHI egress filter, CTSI pilot notes. |
| 2026-07-22 | **Accepted.** Named default **PHI-safe AI chat**; UI badge / settings labels; filter remains default ON. |
| 2026-08-16 | Implementation: team BYOK + Super admin provisioned platform key with **per-team monthly token quota**; Help / Import / IRB / Process modes. Streaming and open-in-tab remain follow-ups (AI-01a). |
| 2026-08-16 | System prompt: **role-based answers** (Super admin · Admin · User) and **Markdown links** to Help / project pages / Contributions from live indexes only. |
| 2026-08-16 | Chat mode **Process** renamed **Analytics** (Help = platform how-to; Analytics = methods/code). |
| 2026-08-25 | Import mode may receive an **app-built, PHI-obscured file profile** (headers, types, sizes, redacted preview cells) as part of the ingest assistant ([ADR-024](ADR-024-ingest-assistant.md)). Claude still has no filesystem access and must not receive unredacted rows. |
| 2026-08-25 | Lab Anthropic key + PHI filter live on **Project → Settings**; per-member chat usage stays on **Project → People**. |

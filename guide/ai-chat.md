---
title: PHI-safe AI chat
description: What PHI-safe means, which patterns are blocked, and how to try the assistant without sending identifiable data to Claude.
card_title: AI chat
sort_order: 8
---

<p class="lead">
  <strong>PHI-safe AI chat</strong> is the in-app assistant with a default <em>egress filter</em>:
  identifiable health data and raw wearable rows are not sent to Claude.
  It is a HIPAA-aligned control, not a certification that every prompt is PHI-free.
</p>

Open it from the chat icon in the top nav, or with **⌘J** / **Ctrl+J**. The panel docks beside the page. It sends **page context** (shell, route, team/project names) — not table rows.

Operators: see [HIPAA Compliance](hipaa-compliance.md). Design: [ADR-014](../dev/ADR-014-ai-assistant-claude.md).

---

## What “PHI-safe” means in HIPAA terms

HIPAA treats **Protected Health Information (PHI)** as individually identifiable health information held by a covered entity or business associate. When that information is stored or transmitted electronically, it is **ePHI** (Security Rule, 45 CFR Part 164). Wearable research data often includes ePHI when it can be tied to a person (subject IDs, emails, GPS tracks, raw samples, query result cells).

W4H’s **PHI-safe** label means:

| It does | It does not |
|---|---|
| Keep **raw dataset rows** and query cells out of Claude prompts (no “analyze these rows” tools) | Prove the deployment is HIPAA-compliant |
| **Block or confirm** outbound chat text that looks like identifiers, GPS, or raw samples | Catch every HIPAA Safe Harbor identifier (names in prose, dates of birth, full-face photos, and similar can still be typed) |
| Default teams to **strict** mode so ePHI is less likely to leave W4H **by accident** | Replace a **Business Associate Agreement (BAA)** with Anthropic or your cloud host |
| Proxy Claude through the API so the **browser never holds** the Anthropic key | Treat chat transcripts as the HIPAA **audit log** |

Chat is optional. If no team or platform key is configured, the rest of the app still works.

**Permissive** mode (Team admin / Super admin) is **not** PHI-safe. Use it only after your institution has assessed third-party LLM risk (BAA / policy). Risky pastes then require an explicit “I confirm no PHI” step; bulk row injection is still forbidden.

The filter is **heuristic defense-in-depth**. Your organisation remains the covered entity or business associate for real PHI.

---

## Modes

| Mode | Use for |
|------|---------|
| **Help** | How to **use W4H** for your role: which screen, who can invite, where API keys live. Links into Help. Not methods or notebook code. |
| **Import** | Getting files **into** W4H: Contributions, CSV/JSON ingest, GeoMTS mapping. Planned ingest assistant ([ADR-024](../dev/ADR-024-ingest-assistant.md)): the **app** chooses files and sends a **PHI-obscured** profile (not raw rows); output is a runnable package you can edit. |
| **IRB** | Wearable privacy language, HIPAA-aligned access, draft DMP from project metadata |
| **Analytics** | How to **analyze data already in W4H**: derived metrics (e.g. energy expenditure), filter / plot / aggregate snippets **without pasting PHI** |

The assistant **links** Help (`/docs/{slug}`), Contributions (`/contributions/{slug}`), and this project's pages when those indexes have a match. Answers follow your **role** (Super admin · Admin · User). It is **not** IRB approval or legal advice.

### Role-based answers

The API resolves the UI role from the signed-in user and the active team (not from the chat text):

| UI role | Who | How the assistant should answer |
|---------|-----|----------------------------------|
| **Super admin** | Platform role Super admin | Platform Admin: SMTP, approve access requests (Admin invitation), audit, usage, settings, Contributions catalog CRUD. Not day-to-day PI trial work. |
| **Admin** | Team admin on the active team | App shell: create projects, link datasets, invite members, share datasets, lab AI key on Project → Settings, chat usage on Project → People. Not Platform Admin. |
| **User** | Everyone else in the app shell | Work in assigned projects: linked datasets, project pages, personal API key / project token, browse Contributions. Point “create / invite / ingest” tasks to an Admin. |

If a task needs a higher role, the assistant should say **who** can do it instead of inventing a button that user cannot see.

### In-app links

Each turn the API injects a **Help index**, this project's **page titles**, and the **Contributions** catalog. The model is instructed to emit Markdown links only for those slugs (no invented URLs) and to finish with a short **See also** line when something matches. Clicks on `/docs/…`, `/admin/projects/…/edit`, and `/contributions/…` stay inside the Vue app (external `https://` links open in a new tab). Chat also rewrites `/projects/{slug}` to `/admin/projects/{slug}/edit` (project settings, members, and chat usage).

---

## Keys and quota

Claude calls are proxied by the API.

| Source | Who configures | When it is used |
|--------|----------------|-----------------|
| **Team (lab) key** | Admin → **Project → Settings**, or Super admin → Settings → Lab Anthropic key | App-shell chat for that team (the lab pays Anthropic). Member usage is listed on **Project → People**. |
| **Provisioned platform key** | Super admin → Settings | Platform Admin chat, and labs with **no** team key, until the **monthly token quota** is used |

The saved key is shown as a **masked prefix** (not an empty `sk-ant-…` field). Replace to paste a new key; the full secret is never returned.

Super admin can disable AI platform-wide.

---

## What is allowed vs blocked

In **PHI-safe (strict)** (the default `ai_phi_filter`):

**May go to Claude**

- Route, role, team/project **names**
- Dataset **name**, schema **column names/types**, subject **counts**, aggregate date ranges
- Help / docs text and your question, if it passes the scan
- **Ingest assistant (planned):** an app-built file **profile** after PHI obscuring — headers, types, sizes, redacted preview tokens — not source identifiers or GPS tracks ([ADR-024](../dev/ADR-024-ingest-assistant.md))

**Must not go to Claude**

- Dataset rows, query result cells, file blobs
- Tools that `SELECT` or export row data into the prompt (schema/catalog only)

### Patterns the filter looks for

The scanner flags **user and assistant text** before a strict-mode send. If any of these hit, the API returns **PHI-safe mode blocked this message** (`PHI_BLOCKED`) and **does not call Anthropic**. Blocked attempts are recorded as usage event `ai.chat_blocked` (not as the HIPAA audit ledger).

| Reason shown | Typical match (do not use real identifiers) |
|---|---|
| `email` | An email address |
| `ssn` | `NNN-NN-NNNN` |
| `mrn` | `MRN` / `medical record` followed by an ID |
| `subject_id` | `subject_id:`, `participant_id:`, `patient_id:` (and similar) |
| `gps` | Coordinates with several decimal places, e.g. `34.0522, -118.2437` |
| `long_identifier` | A run of **9 or more** digits |
| `raw_signal_or_location` | Phrases such as *raw timeseries*, *gps track*, `lat:`, `lon:` |

UUIDs that appear as conversation IDs are generally allowed so the chat UI can function.

**Permissive:** the same patterns trigger a confirmation (`PHI_CONFIRM`) instead of a hard block. Confirmed sends are audited as `ai.chat_permissive`.

---

## Try it (demo script)

Use **synthetic** examples only. Do not paste real study data.

1. Confirm the team setting is **PHI-safe (strict)** (team AI settings, or Super admin Settings for the platform key).
2. Open chat (**⌘J**). Check the **PHI-safe** badge.
3. **Allowed:** in Help or Import mode, ask:

   > How do I map a heart-rate CSV to GeoMTS without pasting rows?

   You should get a reply. Successful turns record usage event `ai.chat`.

4. **Blocked — identifier:**

   > Please analyze subject_id: DEMO-10482 heart rate samples.

   Expected: blocked; message about removing identifiers, emails, GPS, or raw samples. Nothing is sent to Claude.

5. **Blocked — email or GPS** (pick one):

   > Follow up with researcher@example.org about this cohort.

   > The GPS track starts at 34.0522, -118.2437.

   Expected: blocked (`email` or `gps`).

6. **Blocked — raw samples language:**

   > Here is the raw timeseries for plotting.

   Expected: blocked (`raw_signal_or_location`).

7. **Optional contrast (reviewers only):** Team admin switches to **Permissive**. Repeat step 4. You should see a **not PHI-safe** warning and a confirm step before send.

If chat is empty (“not available”), configure a team or platform key first; the filter only runs when a send is attempted.

---

## What not to put in chat

- Names, dates of birth, addresses, phone numbers, or medical record numbers of real people
- Copied table cells, CSV snippets, notebook outputs, or GPS traces from a study
- Screenshots of identifiable dashboards

Ask about **how** to import, map, or analyze; run those steps in the app, contribution notebooks, or your own git repo — not by pasting the data into the assistant. The planned ingest assistant samples files in the browser and obscures preview cells before Claude sees them; the downloadable package is what you edit if mapping is wrong.

---

## Roadmap (post-MVP)

The following are **not** part of the current MVP delivery ([ADR-014](../dev/ADR-014-ai-assistant-claude.md) §13.1). They are tracked separately so pilot work on PHI-safe chat is not blocked:

| Capability | MVP today | Post-MVP |
|------------|-----------|----------|
| LLM vendor | **Claude** (Anthropic) via server proxy | OpenAI, OpenAI-compatible / on-prem ([ADR-026](../dev/ADR-026-multi-provider-llm.md)) |
| Turn shape | Single request → single reply | Multi-step **agent tools** with PHI-safe metadata fetch ([ADR-025](../dev/ADR-025-phi-safe-agent-tools.md)) |
| Ingest assistant | Planned: app builds obscured profile → Import chat → you confirm → `csv-batch` ([ADR-024](../dev/ADR-024-ingest-assistant.md)) | Richer agent UX; still no LLM filesystem access |

Streaming replies ([AI-01a](../dev/mvp.md)) remain an **MVP** follow-up on the existing chat — not post-MVP.

---
title: Welcome — User
description: Work in assigned projects — browse loaded datasets, run analytics contributions, and ask in chat when it is available.
card_title: Welcome — User
action_label: Next steps
is_feature_card: true
card_order: 3
sort_order: 0
---

<p class="lead">
  You work in the <strong>app shell</strong> (<code>W4H Toolkit</code>) on projects an Admin assigned you to.
  You analyze data that is already loaded. You do not set up the trial.
</p>

First analysis walkthrough: [Quick Start](../quick-start.md) §5. Catalog: [Contributions]({{APP_URL}}/contributions).

---

## What you can do

| Step | Where | Why |
|---|---|---|
| **1. Open your project** | Project in the nav | Study info, members, and which datasets are **linked**. You cannot add datasets or edit raw tables. |
| **2. Check loaded data** | Project → dataset overview | A dataset is **loaded** only when **tables** appear. No tables means it is not loaded yet — ask an Admin. |
| **3. Explore and chart** | Project → **Analytics** → *Explore signals* | Chart any signal of a loaded dataset — time series, distributions, coverage, scatter, events — and export PNG or CSV. See [Charts and Reports](charts-and-reports.md). |
| **4. Run analytics** | [Contributions]({{APP_URL}}/contributions) | Analysis notebooks and CLI against loaded, linked datasets. Use your **personal API key** (Profile → API keys) or a project token. Never commit keys. |
| **5. Chat, if available** | Chat icon in the nav (⌘J / Ctrl+J) | How-to questions when a team or platform key is configured. If the panel says chat is not available, ask an Admin. Do not paste rows or identifiers — [PHI-safe AI chat](ai-chat.md). |

Optional: project pages (private notes for this study — not platform Help).

---

## What you cannot do

- Create teams or projects.
- Invite members or change project roles.
- Add datasets or edit raw dataset tables.
- Re-ingest the **W4H Samples** sandbox — Super admin seeds that data; you only re-run analysis notebooks.

If you need any of the above, ask a project **Admin**.

---

## Samples vs your trial

| | **W4H Samples** | **Your project** |
|---|---|---|
| Data | Synthetic demos Super admin seeded | Data an Admin ingested into the team |
| Your role | Viewer / User | **User** on the project |
| Ingest | Do not ingest | An Admin loads data; you analyze |
| Analysis | Re-run contribution notebooks with **your** personal API key | Same, against datasets **linked** to your project **and loaded** (tables present) |

---

## PHI

- Do not paste subject IDs, GPS, emails, or CSV cells into AI chat or GitHub.
- Do not use a shared team API key in notebooks — use your personal key.

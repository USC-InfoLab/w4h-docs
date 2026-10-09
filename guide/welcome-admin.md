---
title: Welcome — Admin
description: After Super admin onboards you — create projects, link datasets, load data, invite members, and use chat when it is available.
card_title: Welcome — Admin
action_label: Next steps
is_feature_card: true
card_order: 1
sort_order: 0
---

<p class="lead">
  You run the trial in the <strong>app shell</strong> (<code>W4H Toolkit</code>). Your <strong>Request access</strong> was approved. On first sign-in you <strong>create your own team</strong> (name it, you are its Admin); add more teams any time from the account menu → <strong>New team</strong>.
  You self-serve projects, datasets, members, and further teams.
</p>

Projects in depth: [Setting Up Projects](setting-up-projects.md). Platform overview: [Quick Start](../quick-start.md). Point researchers to [Welcome — User](welcome-user.md).

---

## Next steps

| Step | Where | Why |
|---|---|---|
| **1. Create a team** | First sign-in opens **Create your team**; later account menu → **New team** | A team is your lab or study group — the boundary for your people, datasets and projects. You are its Admin; nobody approves it. Add another for a separate study. |
| **2. Create a project** | Projects → Add Project | Owning team required. Workspace for members, linked datasets, and project pages. |
| **3. Link datasets, then load tables** | Project → Datasets → select dataset → **Run import…** in overview | Linking does **not** load data. For a **runnable** contribution (Fitbit CSV importer or ICDE demo CSV importer), open the dataset overview and click **Run import…** — **Full** is selected by default on an empty dataset; **Update** on one that already has data. Runs on your personal API key, no notebook or CLI needed. Otherwise adapt a notebook or deploy a CLI from [Contributions]({{APP_URL}}/contributions) against **your team**. **Do not** re-ingest Super-admin sample datasets (read-only). Tables and stats show on the project overview when data is loaded. |
| **4. Invite people** | Project → People | To work with another organization, invite their team into the project instead (Collaborating teams). Invite any email. If they are already on the project, they are skipped. **Admin** can create/load datasets; **User** runs analysis on loaded tables. SMTP must work (ask Super admin if invites fail). |
| **5. Chart and publish** | Project → **Analytics** | *Explore signals* charts any loaded dataset. To share interactive notebook output, **Publish a report…** (Admin only, your team's datasets). See [Charts and Reports](charts-and-reports.md). |
| **6. Chat, if available** | Chat icon in the nav (⌘J / Ctrl+J) | Setup, import, and IRB questions when a team or platform key is configured. If the panel says chat is not available, add a lab key under **Project → Settings** or ask Super admin. Per-member usage is on **Project → People**. Do not paste rows or identifiers — [PHI-safe AI chat](ai-chat.md). |

API keys are **not** a separate home-page step. You need a personal key only when you run a contribution (ingest or analysis). Never commit keys.

---

## Samples vs your trial

| | **W4H Samples** | **Your team** |
|---|---|---|
| Data | Synthetic demos Super admin seeded | Real or synthetic data you ingest |
| Your role | Team **member** (viewer on the sandbox project) | **Admin** on your team |
| Ingest | Do not re-ingest (writes collide) | Ingest into **your** catalog |
| Analysis | Re-run contribution notebooks with **your** personal API key | Same, against datasets **linked** to your project **and loaded** (tables present) |

---

## What you should not do

- Do not paste subject IDs, GPS, emails, or CSV cells into AI chat or GitHub.
- Do not use a shared team API key in notebooks — use your personal key.
- Super admin is not a project member; do not wait for them to link datasets or ingest.

---

## Users on your project

Point researchers to [Welcome — User](welcome-user.md) and [Contributions]({{APP_URL}}/contributions). They work in assigned projects; they do not create teams, add datasets, or edit raw tables.

---
title: Welcome — Admin
description: After Super admin onboards you — create projects, link datasets, adapt ingest notebooks, invite members, and use chat when it is available.
card_title: Welcome — Admin
action_label: Next steps
is_feature_card: true
card_order: 1
sort_order: 0
---

<p class="lead">
  You run the trial in the <strong>app shell</strong> (<code>W4H Toolkit</code>). Super admin already created your account and an <strong>initial team</strong>.
  You self-serve projects, datasets, members, and further teams.
</p>

Projects in depth: [Setting Up Projects](setting-up-projects.md). Platform overview: [Quick Start](../quick-start.md). Point researchers to [Welcome — User](welcome-user.md).

---

## Next steps

| Step | Where | Why |
|---|---|---|
| **1. Create a project** | Projects → Add Project | Owning team required. Workspace for members, linked datasets, and project pages. |
| **2. Link datasets, then load tables** | Project → Datasets, then [Contributions]({{APP_URL}}/contributions) | Linking does **not** load data. Adapt a notebook or deploy a CLI from a Contributions example against **your team**, with your **personal API key**. **Do not** re-ingest Super-admin sample datasets (read-only). Tables and stats show on the project overview when data is loaded. |
| **3. Invite members** | Project → People | Invite any email. If they are already on the project, they are skipped. **Admin** can create/load datasets; **User** runs analysis on loaded tables. SMTP must work (ask Super admin if invites fail). |
| **4. Chat, if available** | Chat icon in the nav (⌘J / Ctrl+J) | Setup, import, and IRB questions when a team or platform key is configured. If the panel says chat is not available, add a lab key under Team settings or ask Super admin. Do not paste rows or identifiers — [PHI-safe AI chat](ai-chat.md). |

Optional: **Teams → Add Team** for another trial tenancy. Super admin does not approve each new team.

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

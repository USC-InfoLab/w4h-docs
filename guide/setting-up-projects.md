---
title: Setting Up Projects
description: Create projects and link multiple datasets — owned, shared, and from your other teams.
updated_by: nocera@usc.edu
updated_at: 2026-07-21T00:00:00.000Z
sort_order: 2
is_feature_card: true
card_title: Setting Up Projects
action_label: Read the guide
---

<p class="lead">
  A <strong>project</strong> is a workspace for analysis (members, linked datasets, notebooks).
  Datasets stay owned by a <strong>team</strong>; projects <em>link</em> them — they do not move ownership.
</p>

This guide is for **Team admins** (and Super admins reading for context). It covers single-team multi-dataset projects and cross-team setups via **shares**. Design details: [ADR-012]({{APP_URL}}/docs/ADR-012-project-dataset-linking).

**Shells:** Team admins work in the **app shell** (`W4H Toolkit`). Super admins stay in **Platform Admin** (`W4H Toolkit Admin`) for bootstrap only — they do not toggle into the app shell.

---

## Concepts at a glance

| Term | Meaning |
|---|---|
| **Team** | Tenancy boundary (members, IRB scope). Owns datasets. |
| **Project** | Analysis workspace with **one** owning team. |
| **Link** | Attach a dataset to a project (`project_datasets`). Done on the project page. |
| **Share** | Let **another team** use a dataset. Does **not** share the project. |
| **Discoverable** | Other teams can see name/description under **Others** — still need a share to link/query. |

```mermaid
flowchart LR
  subgraph TeamA["Team A"]
    DSA["Dataset A1, A2…"]
    PA["Project P"]
  end
  DSA -->|"link"| PA
```

---

## Who does what

| Goal | Who | Where |
|---|---|---|
| Request platform access (new PI) | Prospective PI | Access request form (Draft T-16) |
| Onboard PI | Super admin | Fulfill request → Team admin invite + **initial team** (Draft T-17) |
| Create further teams / trials | Team admin (PI) | **Teams → Add Team** after onboard (Draft T-15) — Super admin does **not** approve each trial |
| Create / own datasets | Team admin | **Datasets → Add Dataset** |
| Create a project | Team admin | **Projects → Add Project** |
| Link datasets | Team admin / project owner | Project **Linked datasets** |
| Share a dataset to another team | Owning Team admin | Dataset edit → **Shares** |

### Onboarding vs trial setup

Super admin only bootstraps **who** may run trials on the platform. They do not approve study design, datasets, or projects — that is entirely the Team admin (PI) role. See MVP §3.0.

---

## Path A — Same team, multiple datasets

Use this when all study datasets already belong to **one** team (the usual case).

### Steps

1. Open **Projects → Add Project** and set the **owning team** to that team.
2. Open the project → **Linked datasets**.
3. **Add** each dataset you need (any number).
4. Add **Members** (`owner` / `editor` / `viewer`) from that team.

```mermaid
flowchart TD
  Start([Start]) --> CreateProj[Create project on Team T]
  CreateProj --> Link1[Link dataset D1]
  Link1 --> Link2[Link dataset D2]
  Link2 --> LinkN[Link dataset Dn…]
  LinkN --> Members[Add project members]
  Members --> Done([Ready for notebooks / analysis])
```

**Picker contents for Team T:** datasets owned by T, plus inbound shares to T, plus datasets you **admin** on your other teams (see Path C).

---

## Path B — Peer team shares data into your project

Use this when Team B owns a dataset you need inside a Team A project.

```mermaid
sequenceDiagram
  participant BA as Team B admin
  participant DS as Dataset (owned by B)
  participant AA as Team A admin
  participant PA as Project on Team A

  BA->>DS: Share → Team A
  Note over DS: Appears for A as Shared by Team B
  AA->>PA: Link shared dataset
  Note over PA: Visible only to Team A<br/>Team B does not see project P
```

### Steps

1. **Team B admin:** open the dataset → **Shares** → share with **Team A** (access usually `read`).
2. **Team A admin:** open (or create) a project owned by **Team A**.
3. In **Linked datasets**, add the row labeled **Shared by Team B**.
4. Optionally also link Team A’s own datasets on the same project.

**Important:** Sharing the dataset does **not** give Team B access to Team A’s project (or the reverse).

---

## Path C — You admin several teams (dual-hat)

You are Team admin on Team A and Team B, and want one modeling project that uses datasets from both.

You do **not** need a new team.

1. Create the project under **one** of your teams (e.g. Team A).
2. In **Linked datasets**, pick:
   - **This team** — Team A’s datasets  
   - **Shared by …** — inbound shares  
   - **Your team · Team B** — datasets you admin on B  
3. When you link a Team B dataset, the platform **auto-shares** it to Team A, then links it (audited).

```mermaid
flowchart TB
  subgraph Teams["Teams you admin"]
    A["Team A datasets"]
    B["Team B datasets"]
  end
  P["Project owned by Team A"]
  A -->|"link (local)"| P
  B -->|"link → auto-share to A"| P
```

---

## Path D — Reciprocal modeling (two workspaces)

Both teams need to analyze the union in **their own** UI.

MVP does **not** support a single jointly owned project. Pattern:

1. A shares datasets to B; B shares datasets to A (as needed).
2. **Each** team creates **its own** project and links owned + inbound-shared datasets.

```mermaid
flowchart LR
  subgraph ASide["Team A"]
    PA[Project A]
  end
  subgraph BSide["Team B"]
    PB[Project B]
  end
  DSA[(A datasets)] --> PA
  DSB[(B datasets)] --> PB
  DSA -.->|share| PB
  DSB -.->|share| PA
```

---

## Choosing a path

```mermaid
flowchart TD
  Q1{All datasets already<br/>on one team?}
  Q1 -->|Yes| A[Path A: one project, link many]
  Q1 -->|No| Q2{Same person admins<br/>all owning teams?}
  Q2 -->|Yes| C[Path C: project on one team;<br/>link + auto-share from others]
  Q2 -->|No| Q3{Peer team will share?}
  Q3 -->|Yes| B[Path B: share then link]
  Q3 -->|Both need a workspace| D[Path D: reciprocal shares<br/>+ two projects]
```

---

## UI checklist

| Screen | What to do |
|---|---|
| **Datasets** | Filters **All / Mine / Others / Shared**. Create catalogs; set **Discoverable**; manage **Shares** on edit. |
| **Projects → Add** | Name, description, **owning team**. |
| **Project edit → Linked datasets** | Add/remove datasets; labels show This team / Shared by… / Your team · … |
| **Project edit → Members** | Only users on the owning team. |
| **Dataset edit → Shares** | Push share to another team; revoke. Overview: `/admin/datasets/shares`. |

---

## Common mistakes

| Mistake | Better approach |
|---|---|
| Create a **new team** just to “hold” a multi-study model | Create a **project** on an existing team and link datasets (Path A/C) |
| Expect the project picker to list every discoverable dataset | **Others** is metadata only; link requires ownership, share, or dual-hat admin |
| Assume share opens the other team’s project | Share ≠ project access ([ADR-012]({{APP_URL}}/docs/ADR-012-project-dataset-linking)) |
| Link from the dataset page | Links are managed on the **project** |

---

## Related docs

- [ADR-012 — Project–dataset linking]({{APP_URL}}/docs/ADR-012-project-dataset-linking)
- [ADR-002 — Cross-trial sharing]({{APP_URL}}/docs/ADR-002-cross-trial-sharing)
- [ADR-004 — Roles]({{APP_URL}}/docs/ADR-004-acl-roles)
- [Quick Start]({{APP_URL}}/docs/quick-start)
- MVP requirements: Projects (P-*), Datasets (D-*), Sharing (S-*) in `dev/mvp.md`

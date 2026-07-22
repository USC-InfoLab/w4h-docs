---
title: "ADR-013 — Brand theming: CSS tokens now, white-label later"
description: Single USC brand layer for MVP; defer Bootswatch-style multi-brand themes
updated_by: nocera@usc.edu
updated_at: 2026-07-22T00:00:00.000Z
---
# ADR-013 — Brand theming: CSS tokens now, white-label / multi-brand later

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** W4H architecture team  
**Relates to:** Frontend conventions in `architecture.md`  
**References:**
- [USC Identity — Color](https://identity.usc.edu/identity/color/)
- `w4h-app/src/style.css` (brand tokens)
- Super admin UI kit: `/admin/style-guide`

---

## Context

W4H ships with USC Cardinal + Gold as the default visual identity. Operators need a coherent Bootstrap remapping (buttons, links, chrome) without a full design-system rewrite.

Separately, some future deployments may want **white-label** or **multi-brand** skins (institution colors, customer logos). Bootswatch-style theme packs (complete alternate stylesheets or Sass theme builds) are one way to get there — but they are heavy for MVP and easy to over-build before anyone needs them.

## Decision

### 1. MVP — single brand via CSS tokens

- One global brand layer in `w4h-app/src/style.css` (imported **after** Bootstrap).
- Tokens: `--w4h-cardinal`, `--w4h-gold`, `--w4h-nav-bg`, callout/active helpers; map `--bs-primary` and primary buttons to Cardinal.
- Light/dark remains Bootstrap `data-bs-theme` + the UI store toggle — not a second “theme product.”
- **Super admin UI kit** (`/admin/style-guide`) is an MVP ops surface for reviewing controls and tuning tokens. It is not an end-user feature.

### 2. White-label / multi-brand — deferred

- Do **not** build a Bootswatch-style theme marketplace or per-tenant stylesheet pack for MVP.
- When white-label is required, prefer extending the **same token model** (override CSS variables per deployment or tenant) before inventing parallel full themes.
- A future ADR may supersede this if token overrides prove insufficient (e.g. deep component redesigns per brand).

### 3. Contrast rules (binding for the default brand)

- Never use Cardinal (or other deep reds) as **text** on near-black — fills and accent bars only on dark surfaces.
- Dark-mode links use Gold; light-mode links use Cardinal.
- Keep `--bs-danger` distinct from brand primary so alerts do not look like CTAs.

## Alternatives considered

| Option | Why not for MVP |
|---|---|
| Full Bootswatch-style theme set now | Costly; no paying white-label requirement yet; duplicates Bootstrap’s variable story |
| Per-page ad-hoc hex | Fractures the brand; hard to tune |
| Sass rebuild of Bootstrap per brand | Correct long-term for deep theming; too slow for MVP token iteration |

## Consequences

- Designers/devs iterate on `/admin/style-guide` + `style.css`.
- Deployments that only need color tweaks can override `:root` tokens without forking the app.
- True multi-brand / white-label work is explicitly **out of MVP scope** until demand justifies a follow-on ADR.

# Docs media

Screenshots, GIFs, and other binaries referenced from Markdown live under this folder.

## How images get into the app

```
w4h-docs/media/…          ← source of truth (this repo)
        │
        ├─ Cursor preview:  ![…](media/whats-new/foo.png)  (relative to the .md file)
        │
        ├─ Docs import (API):  media/…  →  /docs-media/…  in stored HTML
        │
        └─ Browser loads /docs-media/… from the app origin:
              • Dev:  w4h-app/public/docs-media  →  symlink to this folder
              • API:  also mounts DOCS_REPO_PATH/media at /docs-media (fallback)
```

**Markdown in git** uses **`media/…`** relative to the Markdown file
(`whats-new.md` → `media/whats-new/foo.png`). Do **not** use a leading `/media/…`
in the `.md` source — some previews treat that as the machine filesystem root.

**Cursor:** open the built-in preview with **Markdown: Open Preview to the Side**
(`Cmd+K` then `V`). Do not use the third-party **Markdown Editor** extension’s
“Edit Markdown” mode for checking images.

```md
![Alt text](media/whats-new/example.png)
![Animation](media/whats-new/example.gif)
```

If the built-in preview still blocks images: Command Palette →
**Markdown: Change Preview Security Settings** → **Allow insecure local content**.

## Dev setup

```bash
# From w4h-app (once):
ln -sfn ../../w4h-docs/media public/docs-media
```

Confirm: `curl -I http://localhost:5173/docs-media/whats-new/login-password.png`

## Production

Ship media with the SPA (copy or resolve the symlink into `dist`), **or** proxy `/docs-media` to the API mount. Do not rely on `APP_URL=http://localhost:…` baked into HTML.

## Repo bulk (long term)

Screenshots make `w4h-docs` grow quickly. Practical approach:

1. **Now:** keep compressed PNG/GIF under `media/`; prefer GIF frames ≤1280px; avoid raw video in git.
2. **Soon:** track `media/**` with [Git LFS](https://git-lfs.com) (`.gitattributes`: `media/** filter=lfs`).
3. **Later:** optional CDN / object storage; Markdown would use absolute CDN URLs and skip the symlink.

Regenerate What's New captures:

```bash
cd w4h-docs
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
  node scripts/capture-whats-new.mjs
# optional extras (login-code, admin setup):
node scripts/capture-whats-new-extra.mjs
# SMTP card + Usage period GIF (fixes sticky-nav / clipped bars):
node scripts/recapture-smtp-usage.mjs
# Setup walkthrough GIF (generic SMTP / help emails in Settings frame):
node scripts/recapture-setup-gif.mjs
# Datasets catalog (Team admin app shell — Datasets selected):
W4H_TEAM_EMAIL=… W4H_TEAM_PASSWORD=… node scripts/recapture-datasets.mjs
```

Docs captures overwrite Username / From / Help email with `noreply@example.com` and
`support@example.com` **in the browser only** (forms are not Saved).

Dataset catalog shots must use a **Team admin** login so the app shell shows **Datasets**
selected. Super admin Platform Admin chrome also has Datasets (platform-wide), but
discoverability docs default to the team app-shell view.
## Monthly What's New archive

Keep `whats-new.md` as the **current month** only. Older months live under `releases/`
(`releases/2026-06.md`, `releases/archive.md`, …) — same pattern as VS Code Updates.
See [releases/archive.md](../releases/archive.md) for the authoring checklist.

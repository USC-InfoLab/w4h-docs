---
title: Release notes archive
description: Monthly W4H Toolkit release notes — current month on What's New, older months here.
updated_by: nocera@usc.edu
updated_at: 2026-07-23T17:00:00.000Z
sort_order: 10
---

Like [VS Code Updates](https://code.visualstudio.com/updates){target="_blank"}, W4H keeps **one current** What's New page and archives older months so history does not pile into a single document.

| Release | Page |
|---|---|
| **July 2026 (current)** | [What's New]({{APP_URL}}/docs/whats-new) |
| June 2026 | [Release notes — June 2026]({{APP_URL}}/docs/2026-06) |
| March–May 2026 & earlier | [Earlier 2026]({{APP_URL}}/docs/earlier-2026) |

## Authoring convention (monthly)

1. At the start of a new month, **move** the previous month’s full notes from `whats-new.md` into `releases/YYYY-MM.md` (copy screenshots under `media/whats-new/` or `media/YYYY-MM/` as needed).
2. Replace `whats-new.md` with the **new** month’s notes (same structure: highlights → feature sections with screenshots).
3. Add a row to the table above linking the archived month.
4. Refresh docs from Platform Admin so Help picks up the new pages.

Slugs come from the Markdown filename (`2026-06.md` → `/docs/2026-06`). Folder `releases/` is the doc type in the sidebar.

---
title: "ADR-030 — Project report drafts in a rich-text editor; platform Help edited in git only"
description: Project pages become rich-text report drafts stored as HTML, with Markdown export, embedded notebook plots and an optional slide workflow. Platform Help is edited only in the w4h-docs repo; the in-app Help editor is dropped. Editor, HTML storage and per-page Markdown export are built; the rest follows the EmbracePlus analytics work.
updated_by: nocera@usc.edu
updated_at: 2026-11-05T00:00:00.000Z
---

**Status:** Accepted  
**Date:** 2026-11-05  
**Built (2026-11-05):** §1 and the per-page part of §2 — the rich-text editor, HTML storage with sanitizing, and per-page Markdown download.  
**Schedule for the rest** (§3 notebook plots, project-wide export, §4 slides, removing the Help editor in §5, §6): after the analytics are useful on basic EmbracePlus per-minute data (`w4h-embraceplus-csv-file-importer`, ADR-016).  
**Relates to:** ADR-018 (Contributions catalog), ADR-027 (project membership), ADR-029 (published reports), MVP §12 (Doc-05, Doc-09, Doc-13, Doc-19–Doc-23), §17 M2

---

## Context

The MVP chose a **Markdown editor with preview** for both platform Help and project pages (MVP v0.7). The proposal's M2 deliverable was a WYSIWYG editor.

- **Project pages** are written by researchers: protocol notes, data dictionaries, analysis notes, and drafts of research reports. Markdown source is a barrier for them, and a report needs figures from the data.
- **Platform Help** is written by the core team in `w4h-docs` and imported into `w4h.docs`. Editing it in the app as well means two places to edit and a round trip (in-app edit → export zip → commit) that is easy to get wrong.

## Decision

### 1. Project pages are rich-text report drafts

- A **rich-text (WYSIWYG) editor** replaces the Markdown editor for project pages. Candidate: Tiptap, as in the Crosstown `xnn-app` editor, trimmed to what reports need (headings, lists, tables, links, images, code, mermaid, embedded figures).
- **HTML is the stored format.** The API sanitizes it on save and render (allow-list of tags and attributes). Project members edit; other members read it.
- Existing Markdown pages are converted to HTML once, with the app's existing Markdown renderer.
- **Mermaid** stays a block whose source is kept and rendered.
- Access is unchanged: project membership (Doc-11, ADR-027) and project ACL (Doc-12).

### 2. Export to Markdown

- Any page, or a whole project's pages (Doc-13), exports to **Markdown**. That's the portable copy for git, papers and other tools.
- The conversion may lose detail. Embedded figures export as an image file plus a link, and anything Markdown cannot express is kept as inline HTML.
- Markdown import back into a project is optional and not part of this ADR.

### 3. Notebook plots in a report

- A report can embed figures from **published reports** (ADR-029 tier 2, notebook HTML snapshots) and PNG exports of in-app charts (ADR-029 tier 1, `ChartCard`).
- An embed points at a project-scoped artifact; it never pulls raw rows. Figures show aggregates only, the same rule as ADR-029.

### 4. Slide presentations (idea, not committed)

A possible workflow: export a report to Markdown and treat each `##` section as a slide, for a Markdown slide tool such as Marp or reveal.js, or render an HTML deck from the same sections. Decide when a pilot team asks for it.

### 5. Platform Help is edited in git only

- Platform Help is written and reviewed in the `w4h-docs` repo, then imported into the app (Doc-01, Doc-02, Doc-04). The app keeps rendering it.
- The **in-app Help editor is dropped** (Doc-05 retired). Removing it from `w4h-app` is a follow-up task.
- Docs **export to zip** (Doc-03, Doc-07) stays as a backup, not as an editing path.

### 6. Contributed docs (later)

A round trip from the live app to the repo is complicated but would help **contributed docs**, for example a page written by someone outside the core team that should become Help. A possible path: export the page as Markdown and open it as a pull request on `w4h-docs`. Out of scope until there is demand.

## Consequences

**Positive:** Researchers can draft reports without learning Markdown, with figures from their own data. Platform Help has one editing place, git, with review.

**Negative:** HTML must be sanitized everywhere it is rendered. Markdown export is lossy. A second editor stack (Tiptap) is added to `w4h-app`. M2 progress drops until the editor ships, because the WYSIWYG rows now count toward it.

## Alternatives not chosen

- **Keep Markdown as the stored format with a WYSIWYG view** (Tiptap with Markdown round trip). Rejected as the primary path: round trips lose mermaid, attributes and embedded figures. Markdown stays the export format instead.
- **Keep in-app Help editing.** Rejected: two editing places for the same pages, and the export round trip back to git is error-prone.
- **Use published reports (ADR-029) as the report format.** Rejected: they are read-only notebook snapshots, not documents a team drafts together.

## Changelog

| Date | Change |
|------|--------|
| 2026-11-05 | Initial draft. |
| 2026-11-05 | Accepted. Built the editor (`w4h-app` `RichDocEditor.vue`: Tiptap 2 with the xnn-app toolbar, menus and table block; Visual/HTML views; mermaid block), HTML storage (`w4h-api` `lib/utils/page-html.js`: `sanitize-html` allow-list on save and on read, heading ids, Turndown Markdown copy; `project_pages.body_format`), and **Download .md** per page. Older Markdown pages keep `body_format = 'md'`, open in the editor from their rendered HTML, and become `html` on the next save. Images are by URL only (no upload yet). |
| 2026-11-05 | Page **categories** replace the fixed types: free-form labels per project (defaults Report, Guide, Workflow, Reference), a picker that creates new ones, rename/merge (`PATCH /projects/:id/page-categories`), filter chips. Editing is full width, without the page list. |

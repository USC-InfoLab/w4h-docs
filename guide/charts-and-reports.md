---
title: Charts and Reports
description: Chart any dataset's signals in the Analytics tab — wearable or clinical, any vendor — and publish interactive notebook output as a project report.
card_title: Charts and reports
sort_order: 9
---

<p class="lead">
  The <strong>Analytics</strong> tab can chart any signal of a loaded dataset without code. For anything it cannot show,
  an Admin can publish an interactive <strong>notebook report</strong> to the project.
</p>

Design: [ADR-029](../dev/ADR-029-visualization-component-and-reports.md).

---

## Explore signals

Open your project → **Analytics** → pick a dataset → **Explore signals**. Everyone on the project sees the same charts.

W4H chooses what can be charted from the dataset's **column mapping** (which column is the subject, the time, and the values) and each column's type — not from the device brand. A Fitbit, a Garmin, a glucose monitor and a table of lab results all work the same way.

| Chart | Use it for |
|---|---|
| **Time series** | A numeric signal over time — one line per subject or an all-subjects aggregate; zoom with the slider or the mouse wheel |
| **Distribution** | How values spread: a histogram, plus a box plot per subject |
| **Coverage** | A heatmap of how many observations each subject has per day or hour — spot gaps and wear-time problems |
| **Scatter (two signals)** | One signal against another, matched by subject and time bucket (for example heart rate vs steps) |
| **Events** | Irregular or categorical records — visits, medications, lab results — one row per subject |

**Controls:** signal and value, date range, **bucket** (how much time one point covers — *Auto* keeps the chart readable), **aggregate** (average, min, max, sum, count, median), **per subject / all subjects**, and a subject filter. With no subjects selected, charts use the first 12.

On every chart:

- **Table** shows the numbers behind it (also the accessible alternative to the picture).
- **PNG** saves the chart as an image and **CSV** saves its data.

### What the charts show

Times appear exactly as stored in the dataset (for example, 09:00 stays 09:00), whatever your browser's timezone.

Charts show **aggregated or downsampled** values, never every raw row, and large results are capped (a note says *truncated* when that happens). Each chart request is recorded in the audit log. You see only datasets linked to a project you belong to.

---

## Wear compliance and METs cards

Below the charts, **Cached cohort summary** shows two cohort cards that W4H computes from the dataset's mapped signals:

- **Wear compliance** — how many subjects wore the band enough. Heart rate is the wear proxy: a heart-rate sample inside a daily window counts as worn. By default a day counts when the band was worn for at least **60%** of **08:00–20:00**, and a subject counts when at least **60%** of their days do. The card also shows the **median daily wear %**. Open **Wear compliance by subject** and tick subjects to scope the numbers to them.
- **METs summary** — the cohort mean MET and MET-hours per day, from calories and weight.

The cards are a snapshot. They refresh **after every successful import or analysis run**, and an Admin can press **Refresh** at any time (for example after loading data from a notebook). Admins can also change the wear thresholds and windows with **Wear protocol…**; W4H keeps your protocol on later refreshes. Everyone on the project sees the same cards. For per-subject wear reports as files, use the **Fitbit wear compliance** contribution.

---

## Reports

Use a report when the charts above cannot show what you need — a custom plot, a model result, an unusual layout.

A report is a notebook's **interactive HTML output** that an Admin publishes to the project. It is a **snapshot**: it does not update when the data changes, and it is labelled with when it was taken.

### Make the HTML

Run your notebook in your own environment (see [Contributions]({{APP_URL}}/contributions)), then export a **self-contained** page. Reports are shown with **no network access**, so a page that loads scripts or fonts from the internet will appear blank.

```python
# Plotly — embed the library in the file
fig.write_html("report.html", include_plotlyjs=True, full_html=True)

# Altair / Vega-Lite
chart.save("report.html")
```

From Jupyter: **File → Save and Export Notebook As → HTML**, or `jupyter nbconvert --to html notebook.ipynb`.

### Publish it (Admin)

1. Project → **Analytics** → **Reports** → **Publish a report…**
2. Choose the `.html` file and give it a title.
3. Tick the **datasets it was built from**. They must be datasets **your own team owns** and that are linked to the project.
4. Optionally name the contribution and version that produced it.
5. Confirm that you understand the report **embeds the data it plots** and can be read by every member of the project, then **Publish**.

Everyone on the project can **Open** it. The page runs in a sandbox: its scripts work, but it cannot reach the network, your session, or the rest of W4H.

### Rules to know

- **Size limit:** 8 MB per report (set by `REPORT_MAX_BYTES` on the server).
- **It contains data.** Treat a report like the dataset it came from. Do not publish a page that embeds more than you intend to share with the project.
- **Your team's datasets only.** A report cannot use a dataset owned by another team, because that team could not take its data back from a file. So datasets a collaborating team contributes to your project cannot go into a report. Publishing is a project-Admin action, so a collaborating team's people cannot publish reports in someone else's project.
- **Revocation.** Unlinking a dataset from the project (or a collaborating team leaving) **deletes the reports built from it**.
- **Who can delete:** the publisher, a project Admin, or the owning team's Admin.
- **Audit:** publishing, opening and deleting a report are all recorded.

---

## For contribution authors

A SQL contribution can say how its result should be drawn by adding a `display` block to its manifest. The app draws it from the chart types above; contributions never ship their own UI code.

```yaml
display:
  - chart: line          # line | bar | box | heatmap | scatter | events | table
    title: Mean METs per day
    x: day
    y: mean_mets
    group: subject
```

The API passes a sanitized `display` back with a SQL contribution's preview result. Unknown chart types and fields are dropped. (Drawing it automatically in the Run dialog is planned.)

---
title: Frequently Asked Questions
description: Common questions and answers
updated_by: nocera@usc.edu
updated_at: 2026-07-22T00:00:00.000Z
---

## How do I get an account?

W4H is open to **USC researchers** for now. The sign-in page explains the platform and how to join. Click **Request access**, give your USC email, and confirm the link we email you. A person reviews your request; if approved you receive an invitation, and on first sign-in you create your own team — nobody else creates or approves it. See the [Quick Start](../quick-start.md#request-access-new-pi). In-app Help is available after you sign in; until then the [USC InfoLab project page](https://infolab.usc.edu/projects/W4H/) is the public overview.

## How do I chart my data?

Open your project → **Analytics** → *Explore signals*. It works for any loaded dataset — wearables or clinical tables, any vendor. For views it cannot show, an Admin can publish an interactive notebook as a **report**. See [Charts and Reports](../guide/charts-and-reports.md).

## Does the EmbracePlus importer load the raw sensor data?

No. The **EmbracePlus CSV file importer** loads only Empatica's **per-minute digital biomarkers**. It skips the raw Avro files. An Empatica Cloud export holds both, described in Empatica's [Data Access documentation](https://manuals.empatica.com/ehmp/careportal/data_access/v2.7/en.pdf){target="_blank"} (PRS-0000205 REV19.0, July 2024):

| | Per-minute biomarkers (loaded) | Raw data (not loaded) |
|---|---|---|
| Folder | `digital_biomarkers/aggregated_per_minute/` | `digital_biomarkers/raw_data/` |
| Format | One CSV per biomarker, one row per minute | Avro, a new file about every 30 minutes or after a gap such as charging |
| Content | Values computed by Empatica's algorithms, e.g. pulse rate, pulse rate variability, respiratory rate, SpO2, EDA, temperature, steps, activity, METs, sleep, wearing detection, gait | Sensor streams: accelerometer, gyroscope, EDA, temperature, blood volume pulse, steps, systolic peaks, tags |
| Rate | 1 minute | Each sensor's sampling rate is stored inside the Avro file |

A minute with no valid value keeps its row, and `missing_value_reason` says why, for example `device_not_recording` or `device_not_worn_correctly`.

Per-minute data covers wear, activity and heart-rate analysis across a cohort. Work that needs the raw streams, such as running your own peak detection on blood volume pulse or your own gait algorithm on the accelerometer, needs an Avro importer. None exists yet. Which biomarkers and raw sensors your export contains depends on your Empatica study configuration.

## What is W4H?

W4H is a toolkit for managing wearable health data workflows for clinical research — projects, datasets, contributions, and documentation.

## How do I get started?

See the [Quick Start](../quick-start.md) guide for step-by-step instructions.

## Where can I find more documentation?

This documentation is available in the app Help browser and in the [w4h-docs](https://github.com/USC-InfoLab/w4h-docs){target="_blank"} repository.

## How do I report a problem or give feedback?

Use **Report an issue** in your account menu (avatar). That sends an email to the platform administrators (`HELP_EMAIL`). Do **not** include PHI or identifiable patient data.

For technical contributors who prefer a public tracker, open an issue on the relevant repository (never post PHI or study identifiers to GitHub):

- [w4h-docs Issues](https://github.com/USC-InfoLab/w4h-docs/issues){target="_blank"} — documentation
- [w4h-app Issues](https://github.com/USC-InfoLab/w4h-app/issues){target="_blank"} — frontend
- [w4h-api Issues](https://github.com/USC-InfoLab/w4h-api/issues){target="_blank"} — API / backend

Prompted usability surveys (e.g. SUS) are separate and may be offered during pilot evaluation.

## How can I contribute?

See contribution guidance in the documentation repository and open-source materials when the community launch (M9) is published.

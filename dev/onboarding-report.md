---
title: Onboarding report
description: "Findings from setting up W4H end to end (Super admin → Admin → Project → User, both sample datasets) and auditing all 11 repos"
updated_by: nioble@usc.edu
updated_at: 2026-09-29
---

## Part 1: Getting the app running

### 1. The app failed to build

The build failed because of a real bug in the code: a button's text label had been split across two lines, which is not valid JavaScript. Fixed by joining the text back onto one line. The rebuild succeeded right after.

### 2. The setup screen kept reappearing after restarting Docker

After restarting Docker, the app showed the first-time setup screen again instead of the login page. The saved settings were always correct on disk. The real cause is a timing issue: right after Docker restarts, the app sometimes reads its settings file a moment too early and wrongly concludes nothing was configured. The workaround is restarting the api container once Docker has settled. The real fix would be for the startup code to retry that check, the same way it already retries the database connection.

### 3. A setup guide pointed to a menu that does not exist

The SMTP setup guide said to open "Administration, Mail Server." The real site calls that menu "Settings." The guide was simply out of date, and has been corrected to match.

## Part 2: Testing the app end to end

### 1. Permissions work correctly

Checked directly against the database: every account is scoped to the right team, and the Admin correctly owns the test project. Requesting project data with the Admin's own personal key succeeded and returned the right project.

### 2. Linking a dataset to a project works as documented.

### 3. Critical bug found and fixed: the import feature was broken

Clicking "Run import" to load sample data failed every time with a permission error. The app tries to download a copy of the importer's code into a system folder it is not allowed to write to, which affected every import and analysis tool in the catalog, not just one. Added a missing setting to redirect the download to a safe folder, and separately fixed a missing system package the import also needed.

After both fixes, ran real imports for both sample datasets and watched them complete successfully. The Fitbit sample loaded 5 subjects, 70 weight records, 165,588 heart rate rows, and 1,215,360 calories rows. The ICDE demo sample loaded 3 subjects across 7 signal types, correctly flagging 1,728 rows of GPS data as malformed, matching a deliberate test flaw documented in that sample's own repository. Both imports are fully resolved.

## Part 3: Repository and community audit

### What each repository is

| Repo | What it is | Has AGENTS.md? |
|---|---|---|
| w4h-app | The website people use | Yes |
| w4h-api | The backend that stores and serves data | Yes |
| w4h-docker | Packaging to run the whole thing at once | Yes |
| w4h-docs | The project's documentation and design decisions | Yes |
| w4h-sample-fitbit-csv | Sample Fitbit data | Yes |
| w4h-sample-fitbit-csv-importer | Loads that data into the app | Yes |
| w4h-sample-icde-demo-csv | Sample data including GPS, from a published research demo | Yes |
| w4h-sample-icde-demo-csv-importer | Loads that data into the app | Yes |
| w4h-sql-compute-mets | Calculates a fitness metric from existing data | Yes |
| fft_approximate | A database add-on for faster approximate calculations | No |
| w4h-demo-approximate-queries | A notebook demonstrating that add-on | No |

### Missing AGENTS.md, and why it matters

| Repo | Why it needs one | Priority |
|---|---|---|
| fft_approximate | C code plugged directly into the database, the riskiest kind of code to edit without written guardrails | High |
| w4h-demo-approximate-queries | Depends on a known, intentional gap in the tool above that could get "fixed" by mistake without a note | Medium |

### Documentation and GitHub community gaps

- **LICENSE** is missing from `w4h-demo-approximate-queries` and `w4h-docker`. Fix: add the same license the other 9 repos already use.
- A **Code of Conduct** only exists in `w4h-api` and `w4h-app`, and it's word-for-word identical between them. Fix: set it up once at the organization level instead of copying it again.
- A **Contributing guide** exists in `w4h-api`, `w4h-app`, and `w4h-docs`, but the first two differ slightly from each other and `w4h-docs`'s is an empty placeholder. 8 repos have none at all. Fix: set it up once at the organization level, and finish writing the empty one in `w4h-docs`.
- None of the 11 repos have **issue templates**, a **pull request template**, or a **security policy**. Fix: one organization-level repository covers all of them automatically.
- None of the 11 repos run **automated checks** on new code. This is the highest value fix on the whole list.
- No page anywhere links all 11 repos together. Fix: a short list like the one above, placed in the main documentation repo.

### Naming consistency

`fft_approximate` does not follow the `w4h-*` dash naming used everywhere else — it uses an underscore instead.

### Mismatch found during testing

The written role rules say Super admin does not manage research data, but a real screen lets Super admin create a dataset for any team.

### Language clarity in the app itself

A few examples where the wording is unclear to a new user:

- Home page says "Platform bootstrap and ops, trial setup is Team admin self-service in the app shell." Clearer: "This page covers first-time platform setup. Setting up an actual study is done by the Team admin, on their own, in the regular app."
- Usage page says "Platform adoption and SC-CTSI study metrics (D-19*)." Clearer: "Platform usage statistics." The internal ticket code should not be shown to users at all.
- Datasets page says "Ingested catalogs for research (and the shared Samples sandbox)." Clearer: "Data collections for your research, plus the shared practice data."
- Project workspace has a heading that just says "Fine-grained ACL" with no explanation. Clearer: "Advanced permissions."
- Teams page says "A team is a trial tenancy (members, datasets, projects)." Clearer: "A team is a separate workspace for one lab: its own members, datasets, and projects."

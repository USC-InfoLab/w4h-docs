---
title: Testing a new module
description: How to test a contribution (importer or analytics module) on a local W4H server before it goes to review — registration, the in-app flow, data checks, and the mistakes to avoid.
updated_by: limbasiabb@gmail.com
updated_at: 2026-10-15T00:00:00.000Z
sort_order: 6
---

**Audience:** developers adding or changing a Contribution (importer, CLI, notebook)
**Related:** [ADR-016](ADR-016-paired-sample-importer-repos.md), [ADR-018](ADR-018-contributions-catalog.md), [ADR-022](ADR-022-in-app-contribution-run-trigger.md), [Contributions guide](../guide/sample-packages.md), [Developer Setup](developer-setup.md).

## What "tested" means

A module is tested when, on a local server and against a real database, you have seen it go through the same path an Admin will use and checked the data it wrote. Unit tests in the module repo are the first step, not the last.

| Step | What it proves |
|---|---|
| 1. Module alone | The module's own tests and CLI work with no server. |
| 2. Platform up | The API and app you are testing actually contain the feature. |
| 3. Registered | The catalog row points at your repo and the runner can clone and run it. |
| 4. In-app flow | **Run import…** runs and shows progress end to end. |
| 5. Data verified | Row counts, table names, audit and run rows are correct. |
| 6. Negative cases | Bad input, failed runs and missing permissions behave. |
| 7. CLI / notebook | The same module works outside the app (cron, incremental sync). |

## Ground rules

- **Run bare-metal, not Docker.** Start `w4h-api` (`npm start`) and `w4h-app` (`npm run dev`, `http://localhost:5173`) from a terminal against your development database (`DB_DATABASE` in `w4h-api/.env`, usually `w4h-db`). You can read the logs, attach a debugger and restart in seconds. Use Docker ([ADR-015](ADR-015-docker-deployment-packaging.md)) only as a final packaging check once the module already passes locally.
- **Test the checkout that contains your change.** If the feature you need (a new route, a new dialog) lives on a branch or in a patch, the API and app you start must be that checkout. See [Confirm what is running](#confirm-what-is-running).
- **Never commit or share credentials.** API keys (`w4h_sk_…`) go in a local `.env` or your shell, never in chat, tickets or screenshots. If one leaks, rotate it in Profile → API keys.
- **Use a scratch dataset**, created in the Admin UI for the test, so nothing shared is touched.
- **Check for an already-running instance before `npm start`** (`lsof -i :2026` or `pgrep -f "node app.js"`). `EADDRINUSE` tempts a reflexive `kill -9` on whatever's on the port — let an in-flight run finish before killing the process that's running it.

## How a module is loaded

A module is a git repo plus a row in `w4h.contributions` ([ADR-018](ADR-018-contributions-catalog.md)). The in-app run path ([ADR-022](ADR-022-in-app-contribution-run-trigger.md)) works like this:

1. The API reads the catalog row for the module's **slug**.
2. In local mode it looks for a folder named after the slug under the runner root. If it is missing, it runs `git clone --branch <repo_ref> <repo_url>`; if it exists, it tries `git pull --ff-only` and ignores a failure; a dirty working tree or a detached pinned checkout is left as-is.
3. It runs `<runner root>/<slug>/run.sh import --mode append` (**Update**) or `--mode replace` (**Full**) with the caller's API key (`W4H_API_KEY`), `W4H_API_BASE` and the target dataset (`W4H_DATASET_ID`) in the environment.

| Setting | Meaning | Default |
|---|---|---|
| `CONTRIBUTION_RUNNER_REPO_ROOT` | Folder holding module clones | Parent folder of the API's working directory |
| `W4H_API_BASE` | API the module calls | `http://localhost:$PORT` |

Set `CONTRIBUTION_RUNNER_REPO_ROOT` to a fresh, empty folder for tests. The default is the folder that contains your other repos, and an old copy of the module sitting there would be run silently instead of your code.

```bash
mkdir -p ~/w4h/contrib-local
cd ~/w4h/w4h-api
CONTRIBUTION_RUNNER_REPO_ROOT=~/w4h/contrib-local npm start
```

## Register the module

The row for a first-party module is created by `w4h-api/data/schema.sql` (an upsert that runs every time the API starts). For a module that lives in your own GitHub repo, point that row at the repo:

1. Start the API, then log in as a Super admin.
2. **Contributions → Edit** the module's row and change **only** `repo_url` (and `repo_ref` if you are not on `main`). Leave slug, publisher and title alone, and do not click **Fetch repo info**: it overwrites them with values derived from the repo.
3. Check the row:

```sql
SELECT slug, repo_url, repo_ref, status, runnable
FROM w4h.contributions
WHERE slug = 'w4h-fitbit-csv-file-importer';
```

You want exactly one row, your `repo_url`, `status = published` and `runnable = t`. If `runnable` is `f` for a first-party module, set it: `UPDATE w4h.contributions SET runnable = true WHERE slug = '<slug>';`.

Two facts to remember:

- **The slug is a contract.** The app and the runner look the module up by an exact slug (for the Fitbit CSV file importer, `w4h-fitbit-csv-file-importer`, hyphens). The GitHub repo name may differ from the slug; only `repo_url` cares.
- **A restart resets `repo_url`.** The seed upsert overwrites it every time the API starts. Redo the edit after each restart, or change the seed in `schema.sql` as part of the module's PR.

### Pre-warm the clone

The first `run.sh` creates a virtual environment and installs the package. The first run from the app can time out while dependencies install, so do the first run by hand where the runner will look:

```bash
cd ~/w4h/contrib-local
git clone --branch main --single-branch <repo_url> <slug>
cd <slug> && ./run.sh plan --data-dir /tmp/f      # builds .venv, then plans
```

This also proves that `git clone` works non-interactively from your machine, which is how the API runs it.

### Confirm what is running

```bash
# Which checkouts are the API and the app running from?
for p in $(pgrep -f "node app.js") $(pgrep -f "bin/vite"); do readlink /proc/$p/cwd; done

# Is the runner using your repo and not an old copy?
git -C ~/w4h/contrib-local/<slug> log -1 --oneline
git ls-remote <repo_url> main
```

The two commits in the last pair must match, and `contrib-local` should contain only the clones you expect.

## Test checklist

Create an empty dataset and link it to a project. Open the dataset overview, click **Run import…** and choose the module. Keep a count of the rows in the module's sample or fixture files (`wc -l` minus the header) as the baseline.

| # | Test | Expected |
|---|---|---|
| 1 | Import, mode **Full**, on the empty dataset | Progress moves, run ends `succeeded`; dataset shows **Loaded** |
| 2 | Row counts | Each table matches the baseline |
| 3 | Import again, mode **Update** | Zero new rows |
| 4 | Import **Full** on the loaded dataset | The dependents check appears if the dataset is linked or shared; counts are identical after the reload, with no duplicates |
| 5 | Force a failure (bad key, missing dataset) | Run ends `failed` with the reason in the log |
| 6 | A user without ingest rights | 403 in the run log |
| 7 | Audit and run rows | Present and correct (see below) |
| 8 | Table names | All tables the module created use its prefix (`fitbit_…` for the Fitbit modules) |

### Verify in the database

```sql
-- Tables the module created
SELECT name, physical_schema, physical_table
FROM w4h.tables
WHERE physical_table LIKE 'fitbit\_%';

-- Rows loaded (compare with your wc -l baseline)
SELECT count(*) FROM "<physical_schema>"."<physical_table>";

-- The run that just finished
SELECT status, exit_code, left(log, 300)
FROM w4h.contribution_runs
ORDER BY started_at DESC LIMIT 3;

-- Audit trail: one row per run, plus one per batch
SELECT action, details
FROM w4h.audit_log
WHERE action LIKE 'dataset.import.%'
ORDER BY timestamp DESC LIMIT 5;
```

Run starts are logged as `dataset.import.update` or `dataset.import.full_reimport` with the contribution slug in `details`; each batch is logged as `dataset.import.csv`.

## Test the CLI

The same module must work outside the app. Use the dataset **id**, not its display name, and a real key from Profile → API keys:

```bash
cd ~/w4h/contrib-local/<slug>
export W4H_API_BASE=http://localhost:2026 W4H_API_KEY=w4h_sk_...
./run.sh plan     --data-dir /tmp/f                                       # writes manifest.yaml; review it
./run.sh validate --data-dir /tmp/f
./run.sh import   --dataset-id <dataset id> --data-dir /tmp/f --mode append
./run.sh import   --dataset-id <dataset id> --data-dir /tmp/f --mode append   # second run: inserted=0
```

`import` must refuse to run without a reviewed `manifest.yaml`. To test appended rows, add rows to one CSV and run `import --mode append` again: only the new rows load. For incremental loads test `sync --signal <slug> --file <csv>` the same way: only new rows load, and a rerun loads none.

## Common mistakes when testing a file-taking importer

These are real mistakes made while testing file-taking importers. Each cost time; each has a one-line fix.

| What happened | Why | The right way |
|---|---|---|
| Tried to debug the flow through Docker Compose | Logs, restarts and breakpoints are far slower inside containers | Test bare-metal on localhost; use Docker only as a last packaging check |
| A new dialog or route was missing in the app | The API and app that were running did not contain the feature | Check what is running (`readlink /proc/$(pgrep -f "node app.js")/cwd`) and start the checkout that has the feature |
| Wanted to test on a copy of the repos with uncommitted work | A copy that has drifted from the repo you develop in gives results that do not apply to it | Compare the copy to the source file by file before trusting it, and re-check whenever the source changes |
| Runner might use an old module copy | The default runner root is the folder containing all your repos, where an old snapshot lived | Set `CONTRIBUTION_RUNNER_REPO_ROOT` to a fresh folder and compare `git log -1` with `git ls-remote` |
| Added a new Contributions row instead of editing the seeded one | The new row had a different slug (`w4h_fitbit_csv_file_importer`); the app looks for the hyphenated slug | Edit only `repo_url` of the existing row |
| Edited the row; the psql check returned 0 rows and the list showed a different slug, a new publisher and title | The edit form can change the slug, and **Fetch repo info** fills slug, publisher and title from the repo, replacing the seeded values | Restore the slug (`UPDATE w4h.contributions SET slug = '…' WHERE slug = '…'`) and set `repo_url` in the same statement; do not use Fetch repo info on a seeded row |
| `repo_url` went back to the original after a restart | The seed upsert in `schema.sql` runs on every API start | Re-edit after each restart, or change the seed in the module's PR |
| `bash: dataset-id: No such file or directory` | The placeholder `<dataset-id>` was pasted literally; `<…>` is shell redirection | Substitute the real dataset id (the display name is not the id) |
| Console script pointed at another repo's `.venv` | The module's `.venv` had been copied from a different importer | Create a fresh virtual environment per module; let `run.sh` build it |
| Repo folder name with a trailing space | The runner looks for a folder named exactly after the slug | Clone into a folder named exactly `<slug>` |
| First app click timed out | `run.sh` was installing dependencies for the first time | Pre-warm the clone by hand before testing in the browser |
| Pasted an API key into a chat | The key ended up in a log | Rotate it (Profile → API keys) and keep keys in `.env` |

## Report a test run

When you hand results to a reviewer, include for each test its number and pass or fail; for failures also the API terminal output, the run log from the dialog, and the results of the SQL checks above. Say which commit of the module (`git log -1 --oneline`) and which API and app checkouts you tested.

## Clean up

Delete the scratch dataset (Admin UI), remove `~/w4h/contrib-local` and the test CSV folders, and revoke any key you created only for the test.

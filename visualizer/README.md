# Lifting Tracker Visualizer

This is the local, read-only Mac visualizer for phone exports.

## Use

From the repository root:

```sh
python3 -m http.server 5174
```

Then open:

```text
http://127.0.0.1:5174/visualizer/
```

Import the `full-backup.json` file shared from the phone app. The visualizer does not write changes back to the phone in v1.

For local testing, the `Import most recent` button loads:

```text
data/imports/most-recent.full-backup.json
```

Rebuild it after changing cleaned imports or seed data:

```sh
node scripts/build-visualizer-most-recent.js
python3 scripts/build-mac-ground-truth.py
```

The first command assembles the latest local snapshot from cleaned workbook data, recent manual imports, plans, bodyweight entries, and norms. The second command upserts that snapshot into the Mac-side SQLite ground truth database and regenerates the browser-facing JSON from the database.

The durable Mac database lives at:

```text
data/mac/lifting-tracker.sqlite
```

## Pages

- Overview: current week sets, volume, sessions, plan status, this-week muscle volume, and current-week sessions.
- Benchmarks: current best Epley e1RM, e1RM trends through time, bodyweight normalization, and external norm comparison.
- Training volume: weekly volume and set-count trends, plus weekly plan adherence.
- Muscle groups: coefficient-based muscle volume trends and coefficient-weighted e1RM strength index trends.
- Imports: remembered phone exports and cached table counts.

Full phone exports are merged by stable table row IDs. Importing the same export again updates rows instead of duplicating sets. The phone remains the fast capture device; the Mac SQLite database is the canonical analysis store after import and cleanup.

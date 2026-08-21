# lift-track-vis

This is the full analytics and data-management interface for the private tracker.
See `../QUICKSTART.md` for the complete setup and navigation guide.

## Use

From the repository root:

```sh
./scripts/start-tracker.sh
```

Then open:

```text
http://127.0.0.1:5175/
```

The service loads its generated backup automatically. Sets logged from `/phone/`
or the full `Log` page are written directly to the same SQLite database.

For local testing, the `Import most recent` button loads:

```text
data/imports/most-recent.full-backup.json
```

Rebuild it after changing cleaned imports or seed data:

```sh
node scripts/build-visualizer-most-recent.js
python3 scripts/build-mac-ground-truth.py
```

The first command assembles the latest local snapshot from cleaned workbook data,
recent manual imports, plans, bodyweight entries, and norms. The second command
upserts that snapshot into the server-side SQLite ground truth database and
regenerates the browser-facing JSON.

The durable server database lives at:

```text
data/mac/lifting-tracker.sqlite
```

## Pages

- Overview: current week sets, volume, sessions, plan status, this-week muscle volume, and current-week sessions.
- Benchmarks: current best Epley e1RM, e1RM trends through time, bodyweight normalization, and external norm comparison.
- Training volume: weekly volume and set-count trends, weekly plan adherence, and nested muscle-group analysis.
- Biometrics: measurements, experimental body-composition models, athlete comparisons, and growth forecasts.
- Settings: general preferences, plans, and historical imports.

Full backups are merged by stable table row IDs. Importing the same export again
updates rows instead of duplicating sets. The host SQLite database is the
canonical store; the phone browser is the fast capture interface.

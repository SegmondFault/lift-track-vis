# Mobile Exercise Tracker

## Start the phone app and visualizer

From this folder, run:

```sh
./scripts/start-tracker.sh
```

Or, after opening a new terminal, run the global alias:

```sh
workout
```

The script starts:

- the phone app through Expo on port `8081`
- the Mac visualizer at `http://localhost:5174/visualizer/`

Before starting the servers, it also tries to import the newest valid phone backup
from `data/imports/phone-inbox`, `Downloads`, or `Desktop`.

It prints the current Expo LAN URL, for example:

```text
exp://192.168.178.70:8081
```

Open that URL in Expo Go, or scan the QR code Expo prints.

Keep the terminal open while using the phone app. Press `Ctrl-C` to stop the servers the script started.

## Import a phone backup

Export from the phone app, then place `full-backup.json` in:

```text
data/imports/phone-inbox/full-backup.json
```

Then run:

```sh
./scripts/import-latest-phone-backup.sh
```

Reload the visualizer after importing.

The Mac cannot directly read inside Expo Go/iOS app storage. For now, the phone
must either export the backup file or later push it to a Mac sync endpoint.

## Log from the desktop visualizer

Open the visualizer and use the `Log` page.

Desktop sets are saved immediately in browser storage and are merged into the
visible charts in that browser session. To make them permanent in the Mac SQLite
ground truth:

1. Click `Download desktop backup` on the `Log` page.
2. Leave the downloaded `desktop-lift-backup.json` in `Downloads`, or move it to
   `data/imports/phone-inbox`.
3. Run:

```sh
./scripts/import-latest-phone-backup.sh
```

Then refresh the visualizer.

## Edit plans on the Mac

Open the visualizer and use the `Plans` page.

The `Plans` page can:

- edit and remember a browser-local plan draft
- edit weekly overrides such as `normal`, `deload`, `test`, `travel`, or `off`
- set volume/intensity multipliers for deload weeks
- download `plan-config.json`
- download `phone-plan-context.json`

The durable repo source for plan metadata is:

```text
data/plan-config.json
```

After changing that file, rebuild the Mac visualizer export:

```sh
python3 scripts/build-mac-ground-truth.py data/imports/most-recent.full-backup.json --merge
```

## Private phone URL on gray-area

The tracker can run on `gray-area` as a loopback-only user service and be exposed
privately through Tailscale Serve:

```sh
./scripts/install-gray-area-service.sh
```

See `docs/gray-area-deployment.md` for deployment, privacy, and Wake-on-LAN
details. Personal workout data is deliberately excluded from Git.

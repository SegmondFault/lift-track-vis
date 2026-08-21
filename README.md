# lift-track-vis

A private web-based lifting log and analytics workspace. One dependency-free
Python service hosts a focused phone logger and the full analytics interface,
with optional tailnet-only access through Tailscale.

See [QUICKSTART.md](QUICKSTART.md) for installation, private URLs, navigation,
data locations, and troubleshooting.

Licensed under the [Apache License 2.0](LICENSE).

## Run the tracker

From this folder, run:

```sh
./scripts/start-tracker.sh
```

Or, after opening a new terminal, run the global alias:

```sh
workout
```

The script starts one dependency-free Python service on port `5175`:

- phone set logger: `http://localhost:5175/phone/`
- full analytics and plan tools: `http://localhost:5175/`

The phone page has a persistent `Simple / Complex` switch. Simple mode keeps only
the exercise, reps, weight, and save controls visible. Complex mode adds the plan
day, variation, date/time, and today's set list.

For private access from other devices, run the installer below and use the
dynamically calculated Tailscale URLs displayed beneath the app heading. No
native app, app-store build, or JavaScript package manager is needed.

Keep the terminal open when running manually. Press `Ctrl-C` to stop the service.

## Import a legacy backup

Place `full-backup.json` in:

```text
data/imports/phone-inbox/full-backup.json
```

Then run:

```sh
./scripts/import-latest-phone-backup.sh
```

Reload the tracker after importing. This path remains available for historical
backups; the web logger saves directly to the server database.

## Log from the full analytics page

Sets submitted through either `/phone/` or the full `Log` page are written directly
to the private server SQLite database. The full page can still download a JSON
backup for recovery.

## Edit plans

Open the full analytics page and use `Settings` → `Plans`.

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

After changing that file, rebuild the browser-facing export:

```sh
python3 scripts/build-mac-ground-truth.py data/imports/most-recent.full-backup.json --merge
```

## Private Tailscale hosting

The tracker can run as a private user service bound to the host's Tailscale
address:

```sh
./scripts/install-private-service.sh
```

See `docs/private-deployment.md` for deployment, privacy, and Wake-on-LAN
details. Personal workout data is deliberately excluded from Git and the GitHub
repository is private.

# lift-track-vis quickstart

`lift-track-vis` is a private, dependency-free web tracker with a focused phone
logger and a fuller analytics interface. One Python service hosts both views and
writes to a local SQLite database.

## Requirements

- Linux host with systemd, Python 3, `curl`, and `lsof`
- Tailscale on the host and each phone/computer that needs private access
- Git, if installing from the repository

No Node.js packages, mobile build, app store install, or cloud database is
required for normal use.

## 1. Clone

```sh
git clone https://github.com/SegmondFault/lift-track-vis.git
cd lift-track-vis
```

## 2. Run locally

```sh
./scripts/start-tracker.sh
```

On the host itself, open:

- analytics: `http://127.0.0.1:5175/`
- phone logger: `http://127.0.0.1:5175/phone/`

Keep that terminal open. Press `Ctrl-C` to stop the manually run service.

## 3. Install private Tailscale hosting

```sh
./scripts/install-gray-area-service.sh
```

The installer dynamically discovers the host's Tailscale IP, MagicDNS hostname,
and tailnet suffix. It installs `lift-track-vis.service` and prints stable private
URLs; no hostname or `100.x` address is hardcoded in the repository.

If Tailscale Serve is not authorized, the installer uses a tailnet-only HTTP URL
on port `5175`. Traffic is still carried privately by Tailscale. To enable the
friendlier HTTPS form, run once and reinstall:

```sh
sudo tailscale set --operator="$USER"
./scripts/install-gray-area-service.sh
```

Do not enable Tailscale Funnel; Funnel would publish the tracker to the internet.

To keep the user service running after logout and start it at boot, an
administrator can enable user lingering once:

```sh
sudo loginctl enable-linger "$USER"
```

## 4. Open it from another device

Connect the phone or computer to the same permitted Tailscale network. Open the
analytics URL on a computer or the `/phone/` URL on a phone. Both complete,
copyable addresses are displayed directly beneath the `lift-track-vis` heading.

`localhost` always means the device running the browser. Do not use a
`localhost:5175` link on a phone or another computer; use the printed MagicDNS
address instead.

## Main navigation

- Overview
- Log
- Week to week
- Benchmarks
- Biometrics
  - Measurements
  - Body composition
  - Athlete model
  - Growth forecast
- Training volume
  - Volume overview
  - Muscle groups
- Settings
  - General settings
  - Plans
  - Imports

All Biometrics views are explicitly labelled heuristic and experimental.

## Data and privacy

The canonical database is `data/mac/lifting-tracker.sqlite`. Personal databases,
imports, backups, body measurements, plans, spreadsheets, and private source
material are ignored by Git. The GitHub repository can contain application code
and non-personal reference data without containing the user's workout history.

## Checks and troubleshooting

```sh
systemctl --user status lift-track-vis.service
source "${XDG_CONFIG_HOME:-$HOME/.config}/lift-track-vis/environment"
curl --fail "$TRACKER_PUBLIC_URL/api/status"
tailscale status
```

If the page cannot be reached:

1. Confirm Tailscale is connected on both devices.
2. Confirm the host is awake and `lift-track-vis.service` is active.
3. Use the MagicDNS URL, not another device's `localhost`.
4. Rerun the installer if the host was reauthenticated or moved to another
   tailnet.

The app can show a connection error after a loaded page loses contact. If the
host is already unreachable during the first page load, the browser displays its
own connection error because no application code can be downloaded.

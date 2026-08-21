# Private deployment on gray-area

The web tracker runs as a user service on port `5175`. The installer prefers a
loopback service exposed with Tailscale Serve. If Serve is unavailable, it binds
only to the workstation's Tailscale IP. In both cases the page is reachable by
permitted tailnet devices but is not published to the internet.

## Install or update

From the cloned `lift-track-vis` repository:

```sh
./scripts/install-gray-area-service.sh
```

The installer migrates the former `mobile-exercise-tracker.service` installation
to `lift-track-vis.service`, then removes the obsolete unit/config files after
the new service is configured.

The command prefers a private HTTPS URL through Tailscale Serve. If the current
user is not permitted to configure Serve, it falls back to binding port `5175`
only on the host's Tailscale IP. The installer dynamically reads the machine's
MagicDNS name from `tailscale status --json` and publishes a stable
`http://machine-name.tailnet.ts.net:5175/` URL. It does not hardcode this
workstation's hostname, tailnet suffix, or Tailscale IP, so the same setup can be
repeated by another user. That fallback is still encrypted in transit by
Tailscale and is not bound to the LAN.
Do not use Tailscale Funnel for this project: Funnel would make the page public.

The server returns the discovered computer and phone URLs from `/api/status`.
The visualizer renders both beneath its title, allowing any permitted tailnet
device to open or copy the appropriate address.

Use `/phone/` on the printed base URL for the focused phone logger. Its Simple /
Complex choice is saved in that browser, so the same bookmarked URL opens in
the last-used mode. The base URL opens the full analytics interface.

Useful checks:

```sh
systemctl --user status lift-track-vis.service
source "${XDG_CONFIG_HOME:-$HOME/.config}/lift-track-vis/environment"
curl --fail "$TRACKER_PUBLIC_URL/api/status"
tailscale serve status
```

To enable the friendlier HTTPS URL later, an administrator can run the following
once and then rerun the installer:

```sh
sudo tailscale set --operator="$USER"
```

## Private data boundary

Git contains application code and non-personal reference data only. Workbook
imports, backups, databases, body metrics, plans, and legacy seed history are
ignored. Copy them directly between trusted machines rather than through the Git
remote. The service uses a restrictive umask so files it creates are readable by
the owning user only.

## Sleep and Wake-on-LAN

A sleeping or powered-off host cannot answer Tailscale traffic. Tailscale works
at the network layer and cannot itself deliver the Ethernet Wake-on-LAN frame.
Reliable remote wake therefore requires both:

1. Wake-on-LAN enabled for the Ethernet interface and in firmware.
2. Another always-on device on the same physical LAN to send the magic packet.

If no router, NAS, small computer, or other always-on LAN device can send that
packet, the practical options are to disable automatic sleep while this service
is needed or accept that the page is unavailable while the workstation sleeps.

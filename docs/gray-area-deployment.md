# Private deployment on gray-area

The web tracker runs as a user service on `127.0.0.1:5175`. Tailscale Serve is
the only network-facing entry point, so the page is reachable by permitted
tailnet devices but is not published to the internet.

## Install or update

From `$HOME/Projects/mobile-exercise-tracker`:

```sh
./scripts/install-gray-area-service.sh
```

The command prints the private HTTPS URL. Do not use Tailscale Funnel for this
project: Funnel would make the page public.

Useful checks:

```sh
systemctl --user status mobile-exercise-tracker.service
curl --fail http://127.0.0.1:5175/api/status
tailscale serve status
```

## Private data boundary

Git contains application code and non-personal reference data only. Workbook
imports, backups, databases, body metrics, plans, and mobile seed history are
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

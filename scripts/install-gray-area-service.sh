#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_NAME="mobile-exercise-tracker.service"
APP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/mobile-exercise-tracker"

mkdir -p "$UNIT_DIR"
install -m 0600 "$ROOT_DIR/deploy/$UNIT_NAME" "$UNIT_DIR/$UNIT_NAME"

systemctl --user daemon-reload
systemctl --user enable --now "$UNIT_NAME"

if [[ "$(loginctl show-user "$USER" -p Linger --value)" != "yes" ]]; then
  echo "Warning: user lingering is disabled. The service will not start until this user logs in."
  echo "An administrator can enable boot-time startup with: loginctl enable-linger $USER"
fi

echo "Configuring a private Tailscale HTTPS endpoint for the loopback service."
if tailscale serve --bg 5175; then
  tailscale serve status
else
  TAILSCALE_IP="$(tailscale ip -4 | head -n 1)"
  if [[ -z "$TAILSCALE_IP" ]]; then
    echo "Could not determine a Tailscale IPv4 address." >&2
    exit 1
  fi
  mkdir -p "$APP_CONFIG_DIR"
  printf 'TRACKER_API_HOST=%s\n' "$TAILSCALE_IP" > "$APP_CONFIG_DIR/environment"
  chmod 0600 "$APP_CONFIG_DIR/environment"
  systemctl --user restart "$UNIT_NAME"
  echo "Tailscale Serve needs administrator permission; using the tailnet-only IP fallback."
  echo "Private tailnet URL: http://$TAILSCALE_IP:5175/"
fi

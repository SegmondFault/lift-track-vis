#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_NAME="mobile-exercise-tracker.service"

mkdir -p "$UNIT_DIR"
install -m 0600 "$ROOT_DIR/deploy/$UNIT_NAME" "$UNIT_DIR/$UNIT_NAME"

systemctl --user daemon-reload
systemctl --user enable --now "$UNIT_NAME"

if [[ "$(loginctl show-user "$USER" -p Linger --value)" != "yes" ]]; then
  echo "Warning: user lingering is disabled. The service will not start until this user logs in."
  echo "An administrator can enable boot-time startup with: loginctl enable-linger $USER"
fi

echo "Configuring a private Tailscale HTTPS endpoint for the loopback service."
tailscale serve --bg 5175
tailscale serve status


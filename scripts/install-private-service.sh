#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_NAME="lift-track-vis.service"
LEGACY_UNIT_NAME="mobile-exercise-tracker.service"
APP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/lift-track-vis"
LEGACY_APP_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/mobile-exercise-tracker"
UNIT_TEMPLATE="$ROOT_DIR/deploy/$UNIT_NAME"

TAILSCALE_DNS_NAME="$(tailscale status --json | python3 -c 'import json, sys; print(json.load(sys.stdin).get("Self", {}).get("DNSName", "").rstrip("."))')"

write_environment() {
  local api_host="$1"
  local public_url="$2"
  mkdir -p "$APP_CONFIG_DIR"
  printf 'TRACKER_API_HOST=%s\nTRACKER_PUBLIC_URL=%s\n' "$api_host" "$public_url" > "$APP_CONFIG_DIR/environment"
  chmod 0600 "$APP_CONFIG_DIR/environment"
}

mkdir -p "$UNIT_DIR"
UNIT_TMP="$(mktemp)"
trap 'rm -f "$UNIT_TMP"' EXIT
sed \
  -e "s|@ROOT_DIR@|$ROOT_DIR|g" \
  -e "s|@ENVIRONMENT_FILE@|$APP_CONFIG_DIR/environment|g" \
  "$UNIT_TEMPLATE" > "$UNIT_TMP"
install -m 0600 "$UNIT_TMP" "$UNIT_DIR/$UNIT_NAME"

systemctl --user daemon-reload
if systemctl --user is-active --quiet "$LEGACY_UNIT_NAME"; then
  systemctl --user stop "$LEGACY_UNIT_NAME"
fi
if systemctl --user is-enabled --quiet "$LEGACY_UNIT_NAME"; then
  systemctl --user disable "$LEGACY_UNIT_NAME"
fi
systemctl --user enable --now "$UNIT_NAME"

if [[ "$(loginctl show-user "$USER" -p Linger --value)" != "yes" ]]; then
  echo "Warning: user lingering is disabled. The service will not start until this user logs in."
  echo "An administrator can enable boot-time startup with: loginctl enable-linger $USER"
fi

echo "Configuring a private Tailscale HTTPS endpoint for the loopback service."
if tailscale serve --bg 5175; then
  if [[ -z "$TAILSCALE_DNS_NAME" ]]; then
    echo "Could not determine the stable Tailscale DNS name." >&2
    exit 1
  fi
  write_environment "127.0.0.1" "https://$TAILSCALE_DNS_NAME"
  systemctl --user restart "$UNIT_NAME"
  tailscale serve status
else
  TAILSCALE_IP="$(tailscale ip -4 | head -n 1)"
  if [[ -z "$TAILSCALE_IP" ]]; then
    echo "Could not determine a Tailscale IPv4 address." >&2
    exit 1
  fi
  if [[ -n "$TAILSCALE_DNS_NAME" ]]; then
    PUBLIC_URL="http://$TAILSCALE_DNS_NAME:5175"
  else
    PUBLIC_URL="http://$TAILSCALE_IP:5175"
  fi
  write_environment "$TAILSCALE_IP" "$PUBLIC_URL"
  systemctl --user restart "$UNIT_NAME"
  echo "Tailscale Serve needs administrator permission; using the tailnet-only IP fallback."
  echo "Private tailnet URL: $PUBLIC_URL/"
fi

if [[ -f "$UNIT_DIR/$LEGACY_UNIT_NAME" ]]; then
  rm -f "$UNIT_DIR/$LEGACY_UNIT_NAME"
  systemctl --user daemon-reload
fi
if [[ -f "$LEGACY_APP_CONFIG_DIR/environment" ]]; then
  rm -f "$LEGACY_APP_CONFIG_DIR/environment"
  rmdir "$LEGACY_APP_CONFIG_DIR" 2>/dev/null || true
fi

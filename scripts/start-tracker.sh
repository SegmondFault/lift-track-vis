#!/usr/bin/env bash
set -euo pipefail

SOURCE_PATH="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE_PATH" ]]; do
  SOURCE_DIR="$(cd "$(dirname "$SOURCE_PATH")" && pwd)"
  SOURCE_PATH="$(readlink "$SOURCE_PATH")"
  [[ "$SOURCE_PATH" != /* ]] && SOURCE_PATH="$SOURCE_DIR/$SOURCE_PATH"
done
ROOT_DIR="$(cd "$(dirname "$SOURCE_PATH")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"
VISUALIZER_PORT="${VISUALIZER_PORT:-5174}"
API_PORT="${API_PORT:-5175}"
EXPO_PORT="${EXPO_PORT:-8081}"
LOG_DIR="$ROOT_DIR/.dev-logs"
AUTO_IMPORT="${AUTO_IMPORT:-1}"

mkdir -p "$LOG_DIR"

find_lan_ip() {
  local ip=""
  ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -z "$ip" ]]; then
    ip="$(ifconfig en0 2>/dev/null | awk '/inet / { print $2; exit }')"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }')"
  fi
  printf "%s" "$ip"
}

port_pid() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1
}

visualizer_healthy() {
  curl -fsS "http://127.0.0.1:$VISUALIZER_PORT/visualizer/" >/dev/null 2>&1
}

api_healthy() {
  curl -fsS "http://127.0.0.1:$API_PORT/api/status" >/dev/null 2>&1
}

LAN_IP="$(find_lan_ip)"

if [[ -z "$LAN_IP" ]]; then
  echo "Could not detect a LAN IP. Are you connected to Wi-Fi?"
  exit 1
fi

if [[ "$AUTO_IMPORT" != "0" ]]; then
  echo "Checking for the newest phone backup to import..."
  if python3 "$ROOT_DIR/scripts/import-phone-export.py"; then
    echo "Phone backup import complete."
  else
    echo "No import completed. This is fine if you have not exported from the phone yet."
  fi
  echo
fi

VISUALIZER_PID="$(port_pid "$VISUALIZER_PORT" || true)"
if [[ -n "$VISUALIZER_PID" ]] && visualizer_healthy; then
  echo "Visualizer already running on port $VISUALIZER_PORT (pid $VISUALIZER_PID)."
else
  if [[ -n "$VISUALIZER_PID" ]]; then
    echo "Visualizer port $VISUALIZER_PORT had a stale listener (pid $VISUALIZER_PID). Restarting it."
    kill "$VISUALIZER_PID" 2>/dev/null || true
    sleep 0.5
  fi
  echo "Starting visualizer on http://127.0.0.1:$VISUALIZER_PORT/visualizer/"
  (
    cd "$ROOT_DIR"
    python3 -m http.server "$VISUALIZER_PORT" --bind 0.0.0.0
  ) >"$LOG_DIR/visualizer.log" 2>&1 &
  VISUALIZER_PID="$!"
  for _ in {1..20}; do
    visualizer_healthy && break
    sleep 0.2
  done
fi

API_PID="$(port_pid "$API_PORT" || true)"
if [[ -n "$API_PID" ]] && api_healthy; then
  echo "Desktop autosave API already running on port $API_PORT (pid $API_PID)."
else
  if [[ -n "$API_PID" ]]; then
    echo "Desktop autosave API port $API_PORT had a stale listener (pid $API_PID). Restarting it."
    kill "$API_PID" 2>/dev/null || true
    sleep 0.5
  fi
  echo "Starting desktop autosave API on http://127.0.0.1:$API_PORT/api/status"
  (
    cd "$ROOT_DIR"
    python3 "$ROOT_DIR/scripts/tracker-api.py" "$API_PORT"
  ) >"$LOG_DIR/tracker-api.log" 2>&1 &
  API_PID="$!"
  for _ in {1..20}; do
    api_healthy && break
    sleep 0.2
  done
fi

EXPO_PID="$(port_pid "$EXPO_PORT" || true)"
if [[ -n "$EXPO_PID" ]]; then
  echo "Expo already running on port $EXPO_PORT (pid $EXPO_PID)."
  echo
  echo "Phone app: exp://$LAN_IP:$EXPO_PORT"
  echo "Visualizer: http://127.0.0.1:$VISUALIZER_PORT/visualizer/"
  echo "Desktop autosave API: http://127.0.0.1:$API_PORT/api/status"
  echo
  echo "Existing Expo logs remain in the terminal that started it."
  exit 0
fi

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    echo
    echo "Stopping desktop autosave API (pid $API_PID)."
    kill "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "${VISUALIZER_PID:-}" ]] && kill -0 "$VISUALIZER_PID" 2>/dev/null; then
    echo
    echo "Stopping visualizer (pid $VISUALIZER_PID)."
    kill "$VISUALIZER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo
echo "Phone app: exp://$LAN_IP:$EXPO_PORT"
echo "Visualizer: http://127.0.0.1:$VISUALIZER_PORT/visualizer/"
echo "Desktop autosave API: http://127.0.0.1:$API_PORT/api/status"
echo
echo "Keep this terminal open while using Expo Go. Press Ctrl-C to stop."
echo

cd "$MOBILE_DIR"
npx expo start --lan --port "$EXPO_PORT"

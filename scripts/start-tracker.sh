#!/usr/bin/env bash
set -euo pipefail

SOURCE_PATH="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE_PATH" ]]; do
  SOURCE_DIR="$(cd "$(dirname "$SOURCE_PATH")" && pwd)"
  SOURCE_PATH="$(readlink "$SOURCE_PATH")"
  [[ "$SOURCE_PATH" != /* ]] && SOURCE_PATH="$SOURCE_DIR/$SOURCE_PATH"
done

ROOT_DIR="$(cd "$(dirname "$SOURCE_PATH")/.." && pwd)"
API_PORT="${API_PORT:-5175}"
LOG_DIR="$ROOT_DIR/.dev-logs"
mkdir -p "$LOG_DIR"

port_pid() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1
}

api_healthy() {
  curl -fsS "http://127.0.0.1:$API_PORT/api/status" >/dev/null 2>&1
}

API_PID="$(port_pid "$API_PORT" || true)"
if [[ -n "$API_PID" ]] && api_healthy; then
  echo "lift-track-vis is already running on port $API_PORT (pid $API_PID)."
  echo "Phone logger: http://127.0.0.1:$API_PORT/phone/"
  echo "Full analytics: http://127.0.0.1:$API_PORT/"
  exit 0
fi

if [[ -n "$API_PID" ]]; then
  echo "Port $API_PORT has a stale listener (pid $API_PID). Restarting it."
  kill "$API_PID" 2>/dev/null || true
  sleep 0.5
fi

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    echo
    echo "Stopping lift-track-vis (pid $API_PID)."
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting lift-track-vis..."
(
  cd "$ROOT_DIR"
  python3 "$ROOT_DIR/scripts/tracker-api.py" "$API_PORT"
) >"$LOG_DIR/tracker-api.log" 2>&1 &
API_PID="$!"

for _ in {1..25}; do
  api_healthy && break
  sleep 0.2
done

if ! api_healthy; then
  echo "lift-track-vis did not start. See $LOG_DIR/tracker-api.log"
  exit 1
fi

echo
echo "Phone logger: http://127.0.0.1:$API_PORT/phone/"
echo "Full analytics: http://127.0.0.1:$API_PORT/"
echo
echo "Keep this terminal open. Press Ctrl-C to stop."
wait "$API_PID"

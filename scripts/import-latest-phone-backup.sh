#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 "$ROOT_DIR/scripts/import-phone-export.py" "$@"

echo
echo "lift-track-vis data rebuilt. Refresh http://localhost:5175/ and open Settings > Imports if needed."

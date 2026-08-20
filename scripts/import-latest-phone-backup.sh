#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 "$ROOT_DIR/scripts/import-phone-export.py" "$@"

echo
echo "Visualizer data rebuilt. Refresh http://localhost:5174/visualizer/ and click Import most recent if needed."

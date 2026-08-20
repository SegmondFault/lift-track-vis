#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEARCH_DIRS = [
    ROOT / "data" / "imports" / "phone-inbox",
    Path.home() / "Downloads",
    Path.home() / "Desktop",
]


def is_phone_backup(path):
    try:
        data = json.loads(path.read_text())
    except Exception:
        return False
    return data.get("format") == "lifting-tracker-full-backup-json" and "tables" in data


def find_latest_backup():
    candidates = []
    for directory in SEARCH_DIRS:
        if not directory.exists():
            continue
        for path in directory.rglob("*.json"):
            if path.name == "most-recent.full-backup.json":
                continue
            if path.name == "full-backup.json" or "backup" in path.name.lower() or "lifting-export" in str(path).lower():
                if is_phone_backup(path):
                    candidates.append(path)
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def main():
    backup_path = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else find_latest_backup()
    if not backup_path:
        print(
            "No phone export found. Share Export backup from the phone to Downloads, Desktop, "
            "or data/imports/phone-inbox/full-backup.json, then run this again.",
            file=sys.stderr,
        )
        return 1

    if not backup_path.exists() or not is_phone_backup(backup_path):
        print(f"Not a lifting tracker phone backup: {backup_path}", file=sys.stderr)
        return 1

    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build-mac-ground-truth.py"), str(backup_path), "--merge"],
        cwd=ROOT,
        check=False,
        text=True,
        capture_output=True,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    if result.returncode:
        return result.returncode

    print(f"Imported phone export: {backup_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

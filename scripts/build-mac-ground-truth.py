#!/usr/bin/env python3
import argparse
import csv
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "imports" / "most-recent.full-backup.json"
DEFAULT_OUTPUT = ROOT / "data" / "imports" / "most-recent.full-backup.json"
DB_PATH = ROOT / "data" / "mac" / "lifting-tracker.sqlite"
BACKUP_DIR = ROOT / "data" / "backups"
CORRECTIONS_JSON = ROOT / "data" / "imports" / "historic-corrections.json"
PLAN_CONFIG_JSON = ROOT / "data" / "plan-config.json"
HISTORIC_LIFT_SET_CSV = ROOT / "data" / "imports" / "historic-lift-set.cleaned.csv"

TABLE_ORDER = [
    "app_metadata",
    "workout_plan",
    "workout_plan_version",
    "workout_day",
    "workout_day_exercise",
    "plan_week_override",
    "training_block",
    "plan_assignment",
    "workout_session",
    "lift_set",
    "projected_lift_set",
    "body_metric_entry",
    "body_measurement_entry",
    "body_composition_norm",
    "body_composition_model",
    "body_composition_reference",
    "muscle_group",
    "exercise",
    "exercise_variation",
    "exercise_muscle_contribution",
    "strength_norm",
]


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def row_id(table_name, row):
    if "id" in row and row["id"] is not None:
        return str(row["id"])
    if table_name == "app_metadata":
        return str(row["key"])
    raise ValueError(f"Cannot derive row id for {table_name}: {row}")


def parsed_tags(row):
    tags = row.get("tags") or []
    if isinstance(tags, str):
        try:
            parsed = json.loads(tags)
        except json.JSONDecodeError:
            parsed = [tags]
        tags = parsed
    return [str(tag) for tag in tags if str(tag)]


def parsed_number(value):
    if value in (None, ""):
        return None
    parsed = float(value)
    return int(parsed) if parsed.is_integer() else parsed


def load_historic_lift_set_overrides():
    if not HISTORIC_LIFT_SET_CSV.exists():
        return {}
    overrides = {}
    with HISTORIC_LIFT_SET_CSV.open(newline="") as handle:
        for row in csv.DictReader(handle):
            row_id_value = row.get("id")
            if not row_id_value:
                continue
            overrides[row_id_value] = {
                "id": row_id_value,
                "workout_session_id": row.get("workout_session_id") or None,
                "day_index": parsed_number(row.get("day_index")),
                "exercise_id": row.get("exercise_id") or None,
                "variation_id": row.get("variation_id") or None,
                "source_exercise_name": row.get("source_exercise_name") or None,
                "set_number": parsed_number(row.get("set_number")),
                "reps": parsed_number(row.get("reps")),
                "weight": parsed_number(row.get("weight")),
                "weight_unit": row.get("weight_unit") or "kg",
                "logged_at": row.get("logged_at") or None,
                "source": row.get("source") or None,
                "source_sheet": row.get("source_sheet") or None,
                "correction_source_set_id": row.get("correction_source_set_id") or None,
                "correction_id": row.get("correction_id") or None,
                "correction_reason": row.get("correction_reason") or None,
                "correction_original_weight": parsed_number(row.get("correction_original_weight")),
                "correction_original_reps": parsed_number(row.get("correction_original_reps")),
            }
    return overrides


HISTORIC_LIFT_SET_OVERRIDES = load_historic_lift_set_overrides()
MIN_BODYWEIGHT_KG = 35
MAX_BODYWEIGHT_KG = 250


def plausible_body_weight(value):
    parsed = parsed_number(value)
    return parsed is not None and MIN_BODYWEIGHT_KG <= parsed <= MAX_BODYWEIGHT_KG


def normalize_exercise_row(row):
    if row.get("id") != "pec-fly":
        return row
    normalized = dict(row)
    tags = parsed_tags(normalized)
    if "machine" not in tags:
        tags.append("machine")
    normalized["tags"] = json.dumps(tags)
    return normalized


def normalize_lift_set_row(row):
    override = HISTORIC_LIFT_SET_OVERRIDES.get(str(row.get("id")))
    normalized = dict(row)
    if override:
        for key, value in override.items():
            normalized[key] = value

    source_name = str(normalized.get("source_exercise_name") or "").strip().lower()
    if source_name == "back press":
        normalized["exercise_id"] = "back-extension"
        normalized["variation_id"] = "back-extension__standard"
        normalized["correction_reason"] = "Back Press is a machine/core back-extension pattern, not a row benchmark"

    return normalized


def normalize_body_metric_row(row):
    if row.get("body_weight") in (None, "") or plausible_body_weight(row.get("body_weight")):
        return row

    normalized = dict(row)
    normalized["correction_original_body_weight"] = normalized.get("body_weight")
    normalized["correction_reason"] = "body_weight outside plausible human range; ignored for bodyweight analytics"
    normalized["body_weight"] = None
    return normalized


def normalize_table_row(table_name, row):
    if table_name == "exercise":
        return normalize_exercise_row(row)
    if table_name == "lift_set":
        return normalize_lift_set_row(row)
    if table_name == "body_metric_entry":
        return normalize_body_metric_row(row)
    return row


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS mac_import (
          export_id TEXT PRIMARY KEY,
          imported_at TEXT NOT NULL,
          phone_exported_at TEXT,
          latest_set_logged_at TEXT,
          source_file TEXT NOT NULL,
          schema_version INTEGER,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS mac_table_row (
          table_name TEXT NOT NULL,
          row_id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          source_export_id TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (table_name, row_id)
        );

        CREATE TABLE IF NOT EXISTS data_correction (
          id TEXT PRIMARY KEY,
          payload_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mac_export (
          export_id TEXT PRIMARY KEY,
          generated_at TEXT NOT NULL,
          output_file TEXT NOT NULL,
          table_count INTEGER NOT NULL,
          row_count INTEGER NOT NULL
        );
        """
    )
    return conn


def import_backup(conn, backup, source_file, replace_tables=True):
    imported_at = now_iso()
    export_id = backup.get("exportId") or f"local-import-{imported_at}"
    conn.execute(
        """
        INSERT INTO mac_import (
          export_id, imported_at, phone_exported_at, latest_set_logged_at,
          source_file, schema_version, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(export_id) DO UPDATE SET
          imported_at=excluded.imported_at,
          phone_exported_at=excluded.phone_exported_at,
          latest_set_logged_at=excluded.latest_set_logged_at,
          source_file=excluded.source_file,
          schema_version=excluded.schema_version,
          notes=excluded.notes
        """,
        (
            export_id,
            imported_at,
            backup.get("exportedAt"),
            backup.get("latestSetLoggedAt"),
            str(source_file),
            backup.get("schemaVersion"),
            backup.get("notes"),
        ),
    )

    row_count = 0
    if replace_tables:
        for table_name in backup.get("tables", {}).keys():
            conn.execute("DELETE FROM mac_table_row WHERE table_name = ?", (table_name,))

    for table_name, rows in backup.get("tables", {}).items():
        for row in rows:
            row = normalize_table_row(table_name, row)
            key = row_id(table_name, row)
            conn.execute(
                """
                INSERT INTO mac_table_row (
                  table_name, row_id, payload_json, source_export_id, updated_at
                )
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(table_name, row_id) DO UPDATE SET
                  payload_json=excluded.payload_json,
                  source_export_id=excluded.source_export_id,
                  updated_at=excluded.updated_at
                """,
                (
                    table_name,
                    key,
                    json.dumps(row, sort_keys=True),
                    export_id,
                    imported_at,
                ),
            )
            row_count += 1

    if CORRECTIONS_JSON.exists():
        corrections = json.loads(CORRECTIONS_JSON.read_text())
        for correction in corrections.get("corrections", []):
            conn.execute(
                """
                INSERT INTO data_correction (id, payload_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  payload_json=excluded.payload_json,
                  updated_at=excluded.updated_at
                """,
                (correction["id"], json.dumps(correction, sort_keys=True), imported_at),
            )

    return export_id, row_count


def export_backup(conn, output_file):
    generated_at = now_iso()
    rows = conn.execute(
        """
        SELECT table_name, payload_json
        FROM mac_table_row
        ORDER BY table_name, row_id
        """
    ).fetchall()

    tables = {name: [] for name in TABLE_ORDER}
    for table_name, payload_json in rows:
        tables.setdefault(table_name, []).append(normalize_table_row(table_name, json.loads(payload_json)))

    for table_name in list(tables.keys()):
        if table_name not in TABLE_ORDER:
            tables[table_name] = tables[table_name]

    if PLAN_CONFIG_JSON.exists():
        plan_config = json.loads(PLAN_CONFIG_JSON.read_text())
        plan_overrides = {plan["id"]: plan for plan in plan_config.get("plans", [])}
        for plan in tables.get("workout_plan", []):
            override = plan_overrides.get(plan.get("id"))
            if override:
                plan["name"] = override.get("name", plan.get("name"))
                plan["notes"] = override.get("notes", plan.get("notes"))
                plan["current_version_id"] = override.get("currentVersionId")

        tables["workout_plan_version"] = plan_config.get("planVersions", [])
        tables["plan_week_override"] = plan_config.get("weekOverrides", [])

    latest_set_logged_at = None
    if tables.get("lift_set"):
        latest_set_logged_at = max(
            (row.get("logged_at") for row in tables["lift_set"] if row.get("logged_at")),
            default=None,
        )

    last_import = conn.execute(
        """
        SELECT export_id, imported_at, phone_exported_at
        FROM mac_import
        ORDER BY imported_at DESC
        LIMIT 1
        """
    ).fetchone()

    backup = {
        "schemaVersion": 1,
        "exportId": f"mac-ground-truth-{generated_at.replace(':', '-').replace('.', '-')}",
        "exportedAt": generated_at,
        "createdOnDeviceAt": last_import[2] if last_import else generated_at,
        "latestSetLoggedAt": latest_set_logged_at,
        "format": "lifting-tracker-full-backup-json",
        "notes": "Generated from the Mac-side SQLite ground truth database.",
        "macGroundTruth": {
            "databasePath": str(DB_PATH),
            "lastImportId": last_import[0] if last_import else None,
            "lastImportedAt": last_import[1] if last_import else None,
        },
        "tables": tables,
    }

    backup_json = json.dumps(backup, indent=2) + "\n"
    output_file.write_text(backup_json)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    daily_backup_file = BACKUP_DIR / f"{generated_at[:10]}.full-backup.json"
    daily_backup_file.write_text(backup_json)
    row_count = sum(len(items) for items in tables.values())
    conn.execute(
        """
        INSERT INTO mac_export (export_id, generated_at, output_file, table_count, row_count)
        VALUES (?, ?, ?, ?, ?)
        """,
        (backup["exportId"], generated_at, str(output_file), len(tables), row_count),
    )
    return backup["exportId"], row_count


def main():
    parser = argparse.ArgumentParser(description="Import a lifting tracker backup into the Mac SQLite ground truth database.")
    parser.add_argument("input", nargs="?", default=str(DEFAULT_INPUT), help="Input full-backup.json path.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output browser-facing full-backup.json path.")
    parser.add_argument("--merge", action="store_true", help="Merge incoming rows by stable id instead of replacing whole incoming tables.")
    args = parser.parse_args()

    input_file = Path(args.input)
    output_file = Path(args.output)
    backup = json.loads(input_file.read_text())
    conn = connect()
    with conn:
        imported_export_id, imported_rows = import_backup(conn, backup, input_file, replace_tables=not args.merge)
        exported_id, exported_rows = export_backup(conn, output_file)
    print(
        json.dumps(
            {
                "database": str(DB_PATH),
                "importedExportId": imported_export_id,
                "importedRows": imported_rows,
                "visualizerExportId": exported_id,
                "visualizerRows": exported_rows,
                "output": str(output_file),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

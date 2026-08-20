#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRIVATE_PROFILE_JSON = ROOT / "data" / "private" / "profile.json"
GROUND_TRUTH_PATH = ROOT / "scripts" / "build-mac-ground-truth.py"
NORMS_JSON = ROOT / "data" / "sources" / "nhanes-body-composition-norms.json"
MODELS_JSON = ROOT / "data" / "sources" / "nhanes-body-composition-models.json"
ATHLAS_JSON = ROOT / "data" / "sources" / "athlas-athlete-body-composition-reference.json"
OUTPUT_FILE = ROOT / "data" / "imports" / "most-recent.full-backup.json"

spec = importlib.util.spec_from_file_location("build_mac_ground_truth", GROUND_TRUTH_PATH)
ground_truth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ground_truth)


def load_rows(path, key):
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run scripts/build-nhanes-body-composition-norms.py first.")
    payload = json.loads(path.read_text())
    return payload.get(key, [])


def build_athlas_reference_rows():
    if not ATHLAS_JSON.exists():
        return []
    payload = json.loads(ATHLAS_JSON.read_text())
    rows = []
    base = {
        "source": payload["source"],
        "cycle": payload["cycle"],
        "doi": payload["doi"],
        "source_url": payload["source_url"],
        "sex": payload["sex"],
        "notes": payload.get("notes"),
    }

    for group in payload.get("groups", []):
        metrics = dict(group.get("metrics", {}))
        height = metrics.get("height_cm", {})
        body_mass = metrics.get("body_mass_kg", {})
        fat_mass = metrics.get("total_fat_mass_kg", {})
        if height.get("mean") and body_mass.get("mean") is not None and fat_mass.get("mean") is not None:
            height_m = float(height["mean"]) / 100
            fat_free_mass = float(body_mass["mean"]) - float(fat_mass["mean"])
            fat_free_sd = (float(body_mass.get("sd", 0)) ** 2 + float(fat_mass.get("sd", 0)) ** 2) ** 0.5
            metrics["fat_free_mass_kg_derived"] = {
                "mean": round(fat_free_mass, 4),
                "sd": round(fat_free_sd, 4),
                "unit": "kg",
                "derived": True,
            }
            metrics["ffmi_derived"] = {
                "mean": round(fat_free_mass / (height_m**2), 4),
                "sd": round(fat_free_sd / (height_m**2), 4),
                "unit": "kg/m^2",
                "derived": True,
            }

        for metric, values in metrics.items():
            row = {
                **base,
                "id": f"{group['id']}-{metric}",
                "athlete_type": group["athlete_type"],
                "group_label": group["group_label"],
                "age_min": group["age_min"],
                "age_max": group["age_max"],
                "age_band": f"{group['age_min']}-{group['age_max']}",
                "n": group["n"],
                "metric": metric,
                "mean": values["mean"],
                "sd": values.get("sd"),
                "unit": values.get("unit"),
                "is_derived": bool(values.get("derived")),
            }
            rows.append(row)
    return rows


def upsert_row(conn, table_name, row_id, row, source_export_id, updated_at):
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
        (table_name, row_id, json.dumps(row, sort_keys=True), source_export_id, updated_at),
    )


def metadata_row(key, value, now):
    return {
        "key": key,
        "value": value,
        "source": "local-profile-default",
        "notes": "Local body-composition profile metadata. Exported only through normal tracker backups.",
        "created_at": now,
        "updated_at": now,
    }


def main():
    norms = load_rows(NORMS_JSON, "norms")
    models = load_rows(MODELS_JSON, "models")
    athlas_rows = build_athlas_reference_rows()
    now = ground_truth.now_iso()
    source_export_id = "nhanes-body-composition-reference-2017-2018"
    athlas_export_id = "athlas-athlete-body-composition-reference-2023"

    conn = ground_truth.connect()
    with conn:
        for row in norms:
            upsert_row(conn, "body_composition_norm", row["id"], row, source_export_id, now)
        for row in models:
            upsert_row(conn, "body_composition_model", row["id"], row, source_export_id, now)
        for row in athlas_rows:
            upsert_row(conn, "body_composition_reference", row["id"], row, athlas_export_id, now)

        private_profile = json.loads(PRIVATE_PROFILE_JSON.read_text()) if PRIVATE_PROFILE_JSON.exists() else {}
        for key, value in private_profile.items():
            if not isinstance(value, str):
                value = json.dumps(value)
            upsert_row(conn, "app_metadata", key, metadata_row(key, value, now), "local-user-profile-body-composition", now)

        export_id, export_rows = ground_truth.export_backup(conn, OUTPUT_FILE)

    print(
        json.dumps(
            {
                "normsImported": len(norms),
                "modelsImported": len(models),
                "athlasReferenceRowsImported": len(athlas_rows),
                "visualizerExportId": export_id,
                "visualizerRows": export_rows,
                "output": str(OUTPUT_FILE),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

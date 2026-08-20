#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlretrieve

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "sources" / "nhanes" / "raw"
OUT_JSON = ROOT / "data" / "sources" / "nhanes-body-composition-norms.json"
OUT_CSV = ROOT / "data" / "sources" / "nhanes-body-composition-norms.csv"
OUT_MODELS = ROOT / "data" / "sources" / "nhanes-body-composition-models.json"
NHANES_BASE_URL = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles"
SOURCE_URLS = {
    "DEMO_J.XPT": f"{NHANES_BASE_URL}/DEMO_J.XPT",
    "BMX_J.XPT": f"{NHANES_BASE_URL}/BMX_J.XPT",
    "DXX_J.XPT": f"{NHANES_BASE_URL}/DXX_J.XPT",
}
DOC_URLS = {
    "DEMO_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.htm",
    "BMX_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BMX_J.htm",
    "DXX_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DXX_J.htm",
}
PERCENTILES = [5, 10, 25, 50, 75, 90, 95]
AGE_BANDS = [
    (18, 29),
    (30, 39),
    (40, 49),
    (50, 59),
    (18, 59),
]
SEX_LABELS = {1: "male", 2: "female"}
FEATURE_COLUMNS = {
    "body_weight_kg": "BMXWT",
    "height_cm": "BMXHT",
    "bmi": "BMXBMI",
    "waist_cm": "BMXWAIST",
    "hip_cm": "BMXHIP",
    "upper_arm_cm": "BMXARMC",
    "age_years": "RIDAGEYR",
}
MODEL_TARGETS = [
    {
        "target": "body_fat_percent",
        "column": "DXDTOPF",
        "unit": "percent",
        "source_variable": "DXDTOPF",
        "required_columns": ["DXDTOPF"],
        "requires_dxa": True,
    },
    {
        "target": "fat_free_mass_kg",
        "column": "DXDTOLE_kg",
        "unit": "kg",
        "source_variable": "DXDTOLE",
        "required_columns": ["DXDTOLE_kg"],
        "requires_dxa": True,
    },
    {
        "target": "ffmi",
        "column": "lean_mass_index",
        "unit": "kg/m2",
        "source_variable": "DXDTOLE/height^2",
        "required_columns": ["lean_mass_index", "BMXHT"],
        "requires_dxa": True,
    },
    {
        "target": "appendicular_lean_mass_kg",
        "column": "appendicular_lean_kg",
        "unit": "kg",
        "source_variable": "DXDLALE+DXDRALE+DXDLLLE+DXDRLLE",
        "required_columns": ["appendicular_lean_kg"],
        "invalidity_columns": ["DXALATV", "DXARATV", "DXALLTV", "DXARLTV"],
        "requires_dxa": True,
    },
    {
        "target": "appendicular_lean_index",
        "column": "appendicular_lean_index",
        "unit": "kg/m2",
        "source_variable": "(DXDLALE+DXDRALE+DXDLLLE+DXDRLLE)/height^2",
        "required_columns": ["appendicular_lean_index", "BMXHT"],
        "invalidity_columns": ["DXALATV", "DXARATV", "DXALLTV", "DXARLTV"],
        "requires_dxa": True,
    },
]


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def download_sources():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for filename, url in SOURCE_URLS.items():
        destination = RAW_DIR / filename
        if destination.exists() and destination.stat().st_size:
            continue
        print(f"Downloading {url}")
        urlretrieve(url, destination)


def load_xpt(filename):
    path = RAW_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run with --download first.")
    return pd.read_sas(path, format="xport")


def weighted_percentile(values, weights, percentile):
    frame = pd.DataFrame({"value": values, "weight": weights}).dropna()
    frame = frame[(frame["weight"] > 0)]
    if frame.empty:
        return None
    frame = frame.sort_values("value")
    cumulative = frame["weight"].cumsum()
    threshold = frame["weight"].sum() * (percentile / 100)
    return float(frame.loc[cumulative >= threshold, "value"].iloc[0])


def valid_metric_frame(frame, metric):
    valid = frame.copy()
    columns = metric.get("required_columns", [])
    for column in columns:
        valid = valid[valid[column].notna()]
    for flag_column in metric.get("invalidity_columns", []):
        if flag_column in valid.columns:
            # NHANES XPT stores blank DXA invalidity flags as a tiny numeric sentinel
            # (around 5.4e-79), not literal zero.
            valid = valid[valid[flag_column].isna() | (valid[flag_column].abs() < 1e-20)]
    if metric.get("requires_dxa"):
        valid = valid[valid["DXAEXSTS"] == 1]
    return valid


def build_metrics(frame):
    frame["sex"] = frame["RIAGENDR"].map(SEX_LABELS)
    frame["height_m"] = frame["BMXHT"] / 100
    frame["waist_to_height"] = frame["BMXWAIST"] / frame["BMXHT"]
    frame["waist_to_hip"] = frame["BMXWAIST"] / frame["BMXHIP"]

    gram_columns = [
        "DXDTOFAT",
        "DXDTOLE",
        "DXDTOLI",
        "DXXTRFAT",
        "DXDTRLE",
        "DXXLAFAT",
        "DXDLALE",
        "DXXRAFAT",
        "DXDRALE",
        "DXXLLFAT",
        "DXDLLLE",
        "DXXRLFAT",
        "DXDRLLE",
    ]
    for column in gram_columns:
        if column in frame.columns:
            frame[f"{column}_kg"] = frame[column] / 1000

    frame["appendicular_lean_kg"] = (frame["DXDLALE"] + frame["DXDRALE"] + frame["DXDLLLE"] + frame["DXDRLLE"]) / 1000
    frame["appendicular_lean_index"] = frame["appendicular_lean_kg"] / (frame["height_m"] ** 2)
    frame["lean_mass_index"] = frame["DXDTOLE_kg"] / (frame["height_m"] ** 2)
    frame["fat_mass_index"] = frame["DXDTOFAT_kg"] / (frame["height_m"] ** 2)

    return [
        {
            "metric": "body_weight_kg",
            "column": "BMXWT",
            "unit": "kg",
            "source_file": "BMX_J",
            "source_variable": "BMXWT",
            "required_columns": ["BMXWT"],
        },
        {
            "metric": "height_cm",
            "column": "BMXHT",
            "unit": "cm",
            "source_file": "BMX_J",
            "source_variable": "BMXHT",
            "required_columns": ["BMXHT"],
        },
        {
            "metric": "bmi",
            "column": "BMXBMI",
            "unit": "kg/m2",
            "source_file": "BMX_J",
            "source_variable": "BMXBMI",
            "required_columns": ["BMXBMI"],
        },
        {
            "metric": "waist_cm",
            "column": "BMXWAIST",
            "unit": "cm",
            "source_file": "BMX_J",
            "source_variable": "BMXWAIST",
            "required_columns": ["BMXWAIST"],
        },
        {
            "metric": "hip_cm",
            "column": "BMXHIP",
            "unit": "cm",
            "source_file": "BMX_J",
            "source_variable": "BMXHIP",
            "required_columns": ["BMXHIP"],
        },
        {
            "metric": "mid_upper_arm_circumference_cm",
            "column": "BMXARMC",
            "unit": "cm",
            "source_file": "BMX_J",
            "source_variable": "BMXARMC",
            "required_columns": ["BMXARMC"],
        },
        {
            "metric": "waist_to_height",
            "column": "waist_to_height",
            "unit": "ratio",
            "source_file": "BMX_J",
            "source_variable": "BMXWAIST/BMXHT",
            "required_columns": ["BMXWAIST", "BMXHT"],
        },
        {
            "metric": "waist_to_hip",
            "column": "waist_to_hip",
            "unit": "ratio",
            "source_file": "BMX_J",
            "source_variable": "BMXWAIST/BMXHIP",
            "required_columns": ["BMXWAIST", "BMXHIP"],
        },
        {
            "metric": "total_fat_mass_kg",
            "column": "DXDTOFAT_kg",
            "unit": "kg",
            "source_file": "DXX_J",
            "source_variable": "DXDTOFAT",
            "required_columns": ["DXDTOFAT_kg"],
            "requires_dxa": True,
        },
        {
            "metric": "total_lean_mass_excl_bmc_kg",
            "column": "DXDTOLE_kg",
            "unit": "kg",
            "source_file": "DXX_J",
            "source_variable": "DXDTOLE",
            "required_columns": ["DXDTOLE_kg"],
            "requires_dxa": True,
        },
        {
            "metric": "total_lean_mass_incl_bmc_kg",
            "column": "DXDTOLI_kg",
            "unit": "kg",
            "source_file": "DXX_J",
            "source_variable": "DXDTOLI",
            "required_columns": ["DXDTOLI_kg"],
            "requires_dxa": True,
        },
        {
            "metric": "body_fat_percent",
            "column": "DXDTOPF",
            "unit": "percent",
            "source_file": "DXX_J",
            "source_variable": "DXDTOPF",
            "required_columns": ["DXDTOPF"],
            "requires_dxa": True,
        },
        {
            "metric": "trunk_fat_mass_kg",
            "column": "DXXTRFAT_kg",
            "unit": "kg",
            "source_file": "DXX_J",
            "source_variable": "DXXTRFAT",
            "required_columns": ["DXXTRFAT_kg"],
            "invalidity_columns": ["DXATRTV"],
            "requires_dxa": True,
        },
        {
            "metric": "trunk_lean_mass_kg",
            "column": "DXDTRLE_kg",
            "unit": "kg",
            "source_file": "DXX_J",
            "source_variable": "DXDTRLE",
            "required_columns": ["DXDTRLE_kg"],
            "invalidity_columns": ["DXATRTV"],
            "requires_dxa": True,
        },
        {
            "metric": "appendicular_lean_mass_kg",
            "column": "appendicular_lean_kg",
            "unit": "kg",
            "source_file": "DXX_J",
            "source_variable": "DXDLALE+DXDRALE+DXDLLLE+DXDRLLE",
            "required_columns": ["appendicular_lean_kg"],
            "invalidity_columns": ["DXALATV", "DXARATV", "DXALLTV", "DXARLTV"],
            "requires_dxa": True,
        },
        {
            "metric": "appendicular_lean_index",
            "column": "appendicular_lean_index",
            "unit": "kg/m2",
            "source_file": "DXX_J",
            "source_variable": "(DXDLALE+DXDRALE+DXDLLLE+DXDRLLE)/height^2",
            "required_columns": ["appendicular_lean_index", "BMXHT"],
            "invalidity_columns": ["DXALATV", "DXARATV", "DXALLTV", "DXARLTV"],
            "requires_dxa": True,
        },
        {
            "metric": "lean_mass_index",
            "column": "lean_mass_index",
            "unit": "kg/m2",
            "source_file": "DXX_J",
            "source_variable": "DXDTOLE/height^2",
            "required_columns": ["lean_mass_index", "BMXHT"],
            "requires_dxa": True,
        },
        {
            "metric": "fat_mass_index",
            "column": "fat_mass_index",
            "unit": "kg/m2",
            "source_file": "DXX_J",
            "source_variable": "DXDTOFAT/height^2",
            "required_columns": ["fat_mass_index", "BMXHT"],
            "requires_dxa": True,
        },
    ]


def make_rows(frame, metrics):
    rows = []
    source = "NHANES 2017-2018"
    for metric in metrics:
        metric_frame = valid_metric_frame(frame, metric)
        for sex in ["male", "female"]:
            sex_frame = metric_frame[metric_frame["sex"] == sex]
            for age_min, age_max in AGE_BANDS:
                band = sex_frame[(sex_frame["RIDAGEYR"] >= age_min) & (sex_frame["RIDAGEYR"] <= age_max)]
                if band.empty:
                    continue
                values = band[metric["column"]]
                weights = band["WTMEC2YR"]
                sample_n = int(values.notna().sum())
                if sample_n < 20:
                    continue
                for percentile in PERCENTILES:
                    value = weighted_percentile(values, weights, percentile)
                    if value is None:
                        continue
                    row_id = (
                        f"nhanes-2017-2018-{sex}-{age_min}-{age_max}-"
                        f"{metric['metric']}-p{percentile}"
                    )
                    rows.append(
                        {
                            "id": row_id,
                            "source": source,
                            "source_url": DOC_URLS[metric["source_file"]],
                            "cycle": "2017-2018",
                            "sex": sex,
                            "age_min": age_min,
                            "age_max": age_max,
                            "metric": metric["metric"],
                            "percentile": percentile,
                            "value": round(value, 4),
                            "unit": metric["unit"],
                            "sample_n": sample_n,
                            "weighted_sample_sum": round(float(weights[values.notna()].sum()), 4),
                            "source_file": metric["source_file"],
                            "source_variable": metric["source_variable"],
                            "notes": (
                                "Weighted with WTMEC2YR. DXA metrics require DXAEXSTS=1 and "
                                "region invalidity flags where applicable. US population reference; "
                                "use for scale, not as an athlete-specific ideal."
                            ),
                        }
                    )
    return rows


def write_csv(rows):
    if not rows:
        return
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(OUT_CSV, index=False)


def weighted_mean(values, weights):
    mask = values.notna() & weights.notna() & (weights > 0)
    if not mask.any():
        return None
    return float(np.average(values[mask].astype(float), weights=weights[mask].astype(float)))


def weighted_rmse(errors, weights):
    mask = np.isfinite(errors) & np.isfinite(weights) & (weights > 0)
    if not mask.any():
        return None
    return float(np.sqrt(np.average(np.square(errors[mask]), weights=weights[mask])))


def weighted_mae(errors, weights):
    mask = np.isfinite(errors) & np.isfinite(weights) & (weights > 0)
    if not mask.any():
        return None
    return float(np.average(np.abs(errors[mask]), weights=weights[mask]))


def build_model_rows(frame):
    rows = []
    source = "NHANES 2017-2018"
    feature_names = list(FEATURE_COLUMNS.keys())
    feature_columns = [FEATURE_COLUMNS[name] for name in feature_names]

    for target in MODEL_TARGETS:
        metric_frame = valid_metric_frame(frame, target)
        required_columns = feature_columns + [target["column"], "WTMEC2YR"]
        metric_frame = metric_frame.dropna(subset=required_columns)
        metric_frame = metric_frame[metric_frame["WTMEC2YR"] > 0]

        for sex in ["male", "female"]:
            model_frame = metric_frame[metric_frame["sex"] == sex].copy()
            if len(model_frame) < 100:
                continue

            x_raw = model_frame[feature_columns].astype(float)
            x_raw.columns = feature_names
            y = model_frame[target["column"]].astype(float).to_numpy()
            weights = model_frame["WTMEC2YR"].astype(float).to_numpy()

            feature_means = {}
            feature_scales = {}
            scaled_columns = []
            for feature in feature_names:
                values = x_raw[feature].astype(float)
                mean = weighted_mean(values, model_frame["WTMEC2YR"])
                scale = float(values.std(ddof=0))
                if not mean or not np.isfinite(mean):
                    mean = float(values.mean())
                if not scale or not np.isfinite(scale):
                    scale = 1.0
                feature_means[feature] = round(mean, 8)
                feature_scales[feature] = round(scale, 8)
                scaled_columns.append(((values - mean) / scale).to_numpy())

            x = np.column_stack([np.ones(len(model_frame)), *scaled_columns])
            sqrt_weights = np.sqrt(weights / weights.mean())
            coefficients = np.linalg.lstsq(x * sqrt_weights[:, None], y * sqrt_weights, rcond=None)[0]
            predicted = x @ coefficients
            errors = y - predicted
            y_mean = float(np.average(y, weights=weights))
            ss_res = float(np.sum(weights * np.square(errors)))
            ss_tot = float(np.sum(weights * np.square(y - y_mean)))
            r_squared = 1 - ss_res / ss_tot if ss_tot else None
            residual_sigma = weighted_rmse(errors, weights)
            mae = weighted_mae(errors, weights)

            row_id = f"nhanes-2017-2018-{sex}-{target['target']}-weighted-ols"
            rows.append(
                {
                    "id": row_id,
                    "source": source,
                    "source_url": DOC_URLS["DXX_J"],
                    "cycle": "2017-2018",
                    "sex": sex,
                    "target": target["target"],
                    "model_type": "weighted_ols",
                    "unit": target["unit"],
                    "features": feature_names,
                    "feature_means": feature_means,
                    "feature_scales": feature_scales,
                    "coefficients": {
                        "intercept": round(float(coefficients[0]), 10),
                        **{
                            feature: round(float(coefficients[index + 1]), 10)
                            for index, feature in enumerate(feature_names)
                        },
                    },
                    "residual_sigma": round(float(residual_sigma), 6) if residual_sigma is not None else None,
                    "prediction_interval_multiplier": 1.96,
                    "sample_n": int(len(model_frame)),
                    "weighted_sample_sum": round(float(weights.sum()), 4),
                    "r_squared": round(float(r_squared), 6) if r_squared is not None else None,
                    "rmse": round(float(residual_sigma), 6) if residual_sigma is not None else None,
                    "mae": round(float(mae), 6) if mae is not None else None,
                    "source_files": ["DEMO_J", "BMX_J", "DXX_J"],
                    "source_urls": DOC_URLS,
                    "source_variables": {
                        "target": target["source_variable"],
                        "features": {
                            "body_weight_kg": "BMXWT",
                            "height_cm": "BMXHT",
                            "bmi": "BMXBMI",
                            "waist_cm": "BMXWAIST",
                            "hip_cm": "BMXHIP",
                            "upper_arm_cm": "BMXARMC",
                            "age_years": "RIDAGEYR",
                        },
                        "weight": "WTMEC2YR",
                    },
                    "notes": (
                        "Weighted least-squares model trained on adults 18-59 using WTMEC2YR. "
                        "DXA targets require DXAEXSTS=1 and region invalidity flags where applicable. "
                        "Use as an inference aid with uncertainty, not as a medical measurement."
                    ),
                }
            )

    return rows


def main():
    parser = argparse.ArgumentParser(description="Build NHANES body-size and DXA body-composition reference percentiles.")
    parser.add_argument("--download", action="store_true", help="Download missing official NHANES XPT files first.")
    args = parser.parse_args()

    if args.download:
        download_sources()

    demo = load_xpt("DEMO_J.XPT")
    bmx = load_xpt("BMX_J.XPT")
    dxx = load_xpt("DXX_J.XPT")
    frame = demo.merge(bmx, on="SEQN", how="inner").merge(dxx, on="SEQN", how="left")
    frame = frame[(frame["RIDAGEYR"] >= 18) & (frame["RIDAGEYR"] <= 59)]
    metrics = build_metrics(frame)
    rows = make_rows(frame, metrics)
    model_rows = build_model_rows(frame)

    payload = {
        "source": "NHANES 2017-2018",
        "generatedAt": now_iso(),
        "sourceUrls": DOC_URLS,
        "rawFiles": SOURCE_URLS,
        "notes": "Reference percentiles derived from CDC NHANES public files. Keep as population reference data, not personal truth.",
        "norms": rows,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2) + "\n")
    OUT_MODELS.write_text(
        json.dumps(
            {
                "source": "NHANES 2017-2018",
                "generatedAt": now_iso(),
                "sourceUrls": DOC_URLS,
                "rawFiles": SOURCE_URLS,
                "notes": "DXA-backed weighted regression models for local body-composition inference. Use with prediction intervals.",
                "models": model_rows,
            },
            indent=2,
        )
        + "\n"
    )
    write_csv(rows)
    print(
        json.dumps(
            {"rows": len(rows), "models": len(model_rows), "json": str(OUT_JSON), "modelsJson": str(OUT_MODELS), "csv": str(OUT_CSV)},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

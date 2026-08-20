#!/usr/bin/env python3
import csv
import json
import math
import re
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "Workouts.xlsx"
EXERCISE_LIBRARY = ROOT / "data" / "exercise-library.seed.json"
OUT_DIR = ROOT / "data" / "imports"
HISTORIC_JSON = OUT_DIR / "historic-workouts.cleaned.json"
HISTORIC_SETS_CSV = OUT_DIR / "historic-lift-set.cleaned.csv"
BODY_OBS_CSV = OUT_DIR / "bodyweight-observations.cleaned.csv"
BODY_WEEKLY_JSON = ROOT / "data" / "body-weight.weekly.seed.json"
BODY_WEEKLY_CSV = ROOT / "data" / "body-weight.weekly.seed.csv"
CORRECTIONS_JSON = OUT_DIR / "historic-corrections.json"
PRIVATE_BODYWEIGHTS_JSON = ROOT / "data" / "private" / "manual-bodyweights.json"

MIN_BODYWEIGHT = 70
MAX_BODYWEIGHT = 130
YEAR = 2025

EXTRA_ALIASES = {
    "bench": ("bench-press", "bench-press__standard"),
    "bench heavy": ("bench-press", "bench-press__standard"),
    "bench press": ("bench-press", "bench-press__standard"),
    "benchpress": ("bench-press", "bench-press__standard"),
    "becnh press": ("bench-press", "bench-press__standard"),
    "chest press": ("chest-press-machine", "chest-press-machine__standard"),
    "incline barbell press": ("incline-bench-press", "incline-bench-press__standard"),
    "incline bench": ("incline-bench-press", "incline-bench-press__standard"),
    "incline bench press": ("incline-bench-press", "incline-bench-press__standard"),
    "incline bp": ("incline-bench-press", "incline-bench-press__standard"),
    "dumbell incline press": ("incline-dumbbell-press", "incline-dumbbell-press__standard"),
    "dumbell incline press p2": ("incline-dumbbell-press", "incline-dumbbell-press__standard"),
    "dumbell incline press p3": ("incline-dumbbell-press", "incline-dumbbell-press__standard"),
    "dumbbell incline press p2": ("incline-dumbbell-press", "incline-dumbbell-press__standard"),
    "incline dumbbell press": ("incline-dumbbell-press", "incline-dumbbell-press__standard"),
    "incline dumbell press": ("incline-dumbbell-press", "incline-dumbbell-press__standard"),
    "cable reverse pullup": ("lat-pulldown-machine", "lat-pulldown-machine__standard"),
    "lat pull": ("lat-pulldown-machine", "lat-pulldown-machine__standard"),
    "lat pull down": ("lat-pulldown-machine", "lat-pulldown-machine__standard"),
    "lat pulldown": ("lat-pulldown-machine", "lat-pulldown-machine__standard"),
    "lat pulldowns": ("lat-pulldown-machine", "lat-pulldown-machine__standard"),
    "pull up": ("pull-up", "pull-up__standard"),
    "pull-up": ("pull-up", "pull-up__standard"),
    "pullups": ("pull-up", "pull-up__standard"),
    "back extension": ("back-extension", "back-extension__standard"),
    "deadlift": ("deadlift", "deadlift__standard"),
    "romania deadlift": ("romanian-deadlift", "romanian-deadlift__standard"),
    "barbell squat": ("squat", "squat__standard"),
    "squat": ("squat", "squat__standard"),
    "squat machine": ("squat-machine", "squat-machine__standard"),
    "diverging shoulder press left arm": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "diverging shoulder press right arm": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "diverging shoulder press": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "machine shoulder extension": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "one arm shoulder press machine": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "should press machine": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "shoulder press": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "shoulder press machine": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "shoulder press machine non cable": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "shoulder press single arm": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "shoulder press weight machine": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "shouldpress machine": ("shoulder-press-machine", "shoulder-press-machine__standard"),
    "dumbbell shoulder press": ("dumbbell-shoulder-press", "dumbbell-shoulder-press__standard"),
    "dumbel shoulder press": ("dumbbell-shoulder-press", "dumbbell-shoulder-press__standard"),
    "back press": ("back-extension", "back-extension__standard"),
    "bench row": ("seated-row", "seated-row__standard"),
    "cable row": ("seated-row", "seated-row__standard"),
    "div row l": ("seated-row", "seated-row__standard"),
    "div row r": ("seated-row", "seated-row__standard"),
    "diverging seat row left arm": ("seated-row", "seated-row__standard"),
    "diverging seat row right arm": ("seated-row", "seated-row__standard"),
    "diverging seat row": ("seated-row", "seated-row__standard"),
    "landmine row": ("landmine-row", "landmine-row__standard"),
    "machine row": ("seated-row", "seated-row__standard"),
    "non machine machine row": ("seated-row", "seated-row__standard"),
    "seated row": ("seated-row", "seated-row__standard"),
    "seated row machine": ("seated-row", "seated-row__standard"),
    "weighted row": ("seated-row", "seated-row__standard"),
    "cross hammer curl": ("hammer-curl", "hammer-curl__standard"),
    "hammer curl": ("hammer-curl", "hammer-curl__standard"),
    "hammer curls": ("hammer-curl", "hammer-curl__standard"),
    "bice curl": ("bicep-curl", "bicep-curl__standard"),
    "bicep curl": ("bicep-curl", "bicep-curl__standard"),
    "bicep curls": ("bicep-curl", "bicep-curl__standard"),
    "preacher curls": ("preacher-curl", "preacher-curl__standard"),
    "cable tricep extension": ("cable-triceps-extension", "cable-triceps-extension__standard"),
    "tricep cable ext": ("cable-triceps-extension", "cable-triceps-extension__standard"),
    "tricep extension": ("cable-triceps-extension", "cable-triceps-extension__standard"),
    "overhead dumbbell extension": (
        "overhead-dumbbell-triceps-extension",
        "overhead-dumbbell-triceps-extension__standard",
    ),
    "overhead dumbell extension": (
        "overhead-dumbbell-triceps-extension",
        "overhead-dumbbell-triceps-extension__standard",
    ),
    "tricep pushdown": ("triceps-pushdown", "triceps-pushdown__standard"),
    "lat raise": ("lateral-raise", "lateral-raise__dumbbell"),
    "lat raises": ("lateral-raise", "lateral-raise__dumbbell"),
    "laterall dumbell raises": ("lateral-raise", "lateral-raise__dumbbell"),
    "latt raises": ("lateral-raise", "lateral-raise__dumbbell"),
    "face pulls": ("face-pull", "face-pull__standard"),
    "rear delt fly": ("rear-delt-fly", "rear-delt-fly__standard"),
    "rear delt full range": ("rear-delt-fly", "rear-delt-fly__standard"),
    "p fly p 1": ("pec-fly", "pec-fly__standard"),
    "p fly postion 1": ("pec-fly", "pec-fly__standard"),
    "pec dec p1": ("pec-fly", "pec-fly__standard"),
    "pec fly": ("pec-fly", "pec-fly__standard"),
    "pec fly p 1": ("pec-fly", "pec-fly__standard"),
    "pec fly p1": ("pec-fly", "pec-fly__standard"),
    "pec fly pos 1": ("pec-fly", "pec-fly__standard"),
    "pec fly pos 2": ("pec-fly", "pec-fly__standard"),
    "pec fly position 1": ("pec-fly", "pec-fly__standard"),
    "pec fly position 2": ("pec-fly", "pec-fly__standard"),
    "peck fly p 1": ("pec-fly", "pec-fly__standard"),
    "peck fly p1": ("pec-fly", "pec-fly__standard"),
    "glute machine": ("glute-machine", "glute-machine__standard"),
    "glute machines": ("glute-machine", "glute-machine__standard"),
    "hip adduction": ("glute-machine", "glute-machine__standard"),
    "braced leg raises": ("leg-raise", "leg-raise__standard"),
    "hanging leg raises": ("leg-raise", "leg-raise__standard"),
    "leg raise": ("leg-raise", "leg-raise__standard"),
    "leg raises": ("leg-raise", "leg-raise__standard"),
    "weighted leg raises": ("leg-raise", "leg-raise__standard"),
}


def norm_text(value):
    text = str(value).strip().lower()
    text = text.replace("&", " and ")
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def number(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip().replace(",", ".")
        if not value:
            return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed):
        return None
    return parsed


def parse_sheet_date(sheet_name):
    match = re.match(r"^(\d{1,2})\.(\d{1,2})$", sheet_name)
    if not match:
        return None
    day = int(match.group(1))
    month = int(match.group(2))
    return date(YEAR, month, day)


def make_alias_map():
    library = json.loads(EXERCISE_LIBRARY.read_text())
    aliases = {}
    for exercise in library["exercises"]:
        default_variation = next((item for item in exercise["variations"] if item.get("isDefault")), exercise["variations"][0])
        names = [exercise["name"], *(exercise.get("aliases") or [])]
        for name in names:
            aliases[norm_text(name)] = (exercise["id"], default_variation["id"])
        for variation in exercise["variations"]:
            for alias in variation.get("aliases") or []:
                aliases[norm_text(alias)] = (exercise["id"], variation["id"])
    aliases.update({norm_text(key): value for key, value in EXTRA_ALIASES.items()})
    return aliases


def load_corrections():
    if not CORRECTIONS_JSON.exists():
        return []
    payload = json.loads(CORRECTIONS_JSON.read_text())
    return payload.get("corrections", [])


def values_match(actual, expected):
    if expected is None:
        return True
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return abs(float(actual) - float(expected)) < 0.000001
    return norm_text(actual) == norm_text(expected)


def matching_correction(row, corrections):
    for correction in corrections:
        match = correction.get("match", {})
        checks = [
            values_match(row["source_sheet"], match.get("sourceSheet")),
            values_match(row["source_exercise_name"], match.get("sourceExerciseName")),
            values_match(row["set_number"], match.get("setNumber")),
            values_match(row["weight"], match.get("weight")),
            values_match(row["reps"], match.get("reps")),
        ]
        if all(checks):
            return correction
    return None


def previous_sensible_row(row, prior_rows):
    for prior in reversed(prior_rows):
        if prior["exercise_id"] == row["exercise_id"] and prior["variation_id"] == row["variation_id"]:
            return prior
    return None


def apply_correction(row, correction, prior_rows):
    action = correction.get("action", {})
    correction_id = correction.get("id")
    original = {"weight": row["weight"], "reps": row["reps"]}

    if action.get("type") == "replace":
        row["weight"] = action.get("weight", row["weight"])
        row["reps"] = action.get("reps", row["reps"])
    elif action.get("type") == "snap_to_previous_sensible":
        previous = previous_sensible_row(row, prior_rows)
        if not previous:
            row["correction_warning"] = f"{correction_id}: no previous sensible same exercise/variation row found"
            return row
        row["weight"] = previous["weight"]
        row["reps"] = previous["reps"]
        row["correction_source_set_id"] = previous["id"]

    row["correction_id"] = correction_id
    row["correction_reason"] = correction.get("reason")
    row["correction_original_weight"] = original["weight"]
    row["correction_original_reps"] = original["reps"]
    return row


def extract_summary_value(df, label):
    wanted = norm_text(label)
    for row_index in range(df.shape[0]):
        for col_index in range(df.shape[1] - 1):
            if norm_text(df.iat[row_index, col_index]) == wanted:
                return df.iat[row_index, col_index + 1]
    return None


def extract_sets(df, session_date, aliases, sheet_name, corrections, prior_rows):
    rows = []
    unknown = []
    set_counter = 0
    for row_index in range(df.shape[0]):
        raw_name = df.iat[row_index, 0] if df.shape[1] > 0 else None
        exercise_name = norm_text(raw_name)
        if not exercise_name or exercise_name in {"nan", "lift", "exercise", "run", "km", "time", "rest"}:
            continue

        set_number = number(df.iat[row_index, 1] if df.shape[1] > 1 else None)
        weight = number(df.iat[row_index, 2] if df.shape[1] > 2 else None)
        reps = number(df.iat[row_index, 3] if df.shape[1] > 3 else None)
        if set_number is None or weight is None or reps is None:
            continue
        if set_number <= 0 or weight < 0 or reps <= 0:
            continue

        mapped = aliases.get(exercise_name)
        if not mapped:
            unknown.append(str(raw_name).strip())
            continue

        set_counter += 1
        exercise_id, variation_id = mapped
        logged_at = datetime.combine(session_date, datetime.min.time()) + timedelta(minutes=set_counter * 3)
        row = {
                "id": f"historic-{session_date.isoformat()}-{set_counter:03d}",
                "workout_session_id": f"historic-session-{session_date.isoformat()}",
                "day_index": None,
                "exercise_id": exercise_id,
                "variation_id": variation_id,
                "source_exercise_name": str(raw_name).strip(),
                "set_number": int(set_number) if set_number.is_integer() else set_number,
                "reps": reps,
                "weight": weight,
                "weight_unit": "kg",
                "logged_at": logged_at.isoformat(),
                "source": "Workouts.xlsx",
                "source_sheet": sheet_name,
            }
        correction = matching_correction(row, corrections)
        if correction:
            row = apply_correction(row, correction, prior_rows + rows)
        rows.append(row)
    return rows, unknown


def weekly_weight_entries(observations):
    by_week = defaultdict(list)
    for obs in observations:
        measured = date.fromisoformat(obs["measured_at"])
        week_start = measured - timedelta(days=measured.weekday())
        by_week[week_start].append(obs)

    entries = []
    for week_start in sorted(by_week):
        week_obs = sorted(by_week[week_start], key=lambda item: item["measured_at"])
        chosen = week_obs[-1]
        entries.append(
            {
                "id": f"weekly-bodyweight-{week_start.isoformat()}",
                "measuredAt": f"{week_start.isoformat()}T08:00:00.000Z",
                "bodyWeight": chosen["body_weight"],
                "bodyFat": None,
                "source": chosen["source"],
                "sourceNote": f"week_start={week_start.isoformat()}, chosen_observation={chosen['measured_at']}",
            }
        )
    return entries


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    aliases = make_alias_map()
    corrections = load_corrections()
    xl = pd.ExcelFile(WORKBOOK)
    sessions = []
    all_sets = []
    body_observations = []
    unknown_names = defaultdict(int)
    rejected_bodyweights = []

    for sheet_name in xl.sheet_names:
        session_date = parse_sheet_date(sheet_name)
        if session_date is None:
            continue
        df = pd.read_excel(WORKBOOK, sheet_name=sheet_name, header=None)
        body_weight = number(extract_summary_value(df, "Bodyweight"))
        if body_weight is not None and MIN_BODYWEIGHT <= body_weight <= MAX_BODYWEIGHT:
            body_observations.append(
                {
                    "measured_at": session_date.isoformat(),
                    "body_weight": round(body_weight, 2),
                    "source": "Workouts.xlsx",
                    "source_sheet": sheet_name,
                }
            )
        elif body_weight is not None:
            rejected_bodyweights.append(
                {
                    "source_sheet": sheet_name,
                    "session_date": session_date.isoformat(),
                    "body_weight": body_weight,
                    "reason": "outside plausible human bodyweight range",
                }
            )

        sets, unknown = extract_sets(df, session_date, aliases, sheet_name, corrections, all_sets)
        for name in unknown:
            unknown_names[name] += 1
        if sets or body_weight is not None:
            sessions.append(
                {
                    "id": f"historic-session-{session_date.isoformat()}",
                    "started_at": datetime.combine(session_date, datetime.min.time()).isoformat(),
                    "source_sheet": sheet_name,
                    "set_count": len(sets),
                    "body_weight": round(body_weight, 2) if body_weight is not None and MIN_BODYWEIGHT <= body_weight <= MAX_BODYWEIGHT else None,
                }
            )
        all_sets.extend(sets)

    manual_bodyweights = []
    if PRIVATE_BODYWEIGHTS_JSON.exists():
        manual_bodyweights = json.loads(PRIVATE_BODYWEIGHTS_JSON.read_text()).get("entries", [])

    for entry in manual_bodyweights:
        body_observations.append(
            {
                "measured_at": entry["measured_at"],
                "body_weight": entry["body_weight"],
                "source": entry.get("source", "manual-private-import"),
                "source_sheet": entry.get("source_sheet", "private/manual-bodyweights.json"),
            }
        )

    body_observations.sort(key=lambda item: item["measured_at"])
    weekly_entries = weekly_weight_entries(body_observations)
    output = {
        "schemaVersion": 1,
        "source": "Workouts.xlsx",
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "cleaningRules": {
            "date": "Sheet name DD.MM is authoritative because several copied summary Date fields are stale.",
            "bodyWeight": f"Accepted only values from {MIN_BODYWEIGHT}kg to {MAX_BODYWEIGHT}kg.",
            "sets": "Rows require exercise name, set number, weight, reps, and a known exercise alias.",
        },
        "sessions": sessions,
        "liftSets": all_sets,
        "bodyWeightObservations": body_observations,
        "weeklyBodyMetricEntries": weekly_entries,
        "unmappedExerciseNames": dict(sorted(unknown_names.items())),
        "rejectedBodyweights": rejected_bodyweights,
    }

    HISTORIC_JSON.write_text(json.dumps(output, indent=2))

    if all_sets:
        fieldnames = []
        for row in all_sets:
            for key in row.keys():
                if key not in fieldnames:
                    fieldnames.append(key)
        with HISTORIC_SETS_CSV.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_sets)

    with BODY_OBS_CSV.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["measured_at", "body_weight", "source", "source_sheet"])
        writer.writeheader()
        writer.writerows(body_observations)

    BODY_WEEKLY_JSON.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "source": "Workouts.xlsx + ignored private observations" if manual_bodyweights else "Workouts.xlsx",
                "generatedAt": output["generatedAt"],
                "entries": weekly_entries,
            },
            indent=2,
        )
    )

    with BODY_WEEKLY_CSV.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "measuredAt", "bodyWeight", "bodyFat", "source", "sourceNote"])
        writer.writeheader()
        writer.writerows(weekly_entries)

    print(
        json.dumps(
            {
                "sessions": len(sessions),
                "liftSets": len(all_sets),
                "bodyWeightObservations": len(body_observations),
                "weeklyBodyMetricEntries": len(weekly_entries),
                "unmappedExerciseNames": len(unknown_names),
                "rejectedBodyweights": len(rejected_bodyweights),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

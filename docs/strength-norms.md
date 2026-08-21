# Strength Norms

## Goal

External norms should be editable data, not hardcoded app logic.

The app stores norm thresholds in:

```text
strength_norm
```

and exports them to lift-track-vis. The analytics view filters thresholds by:

```text
sex nullable
exercise_id
metric
level
bodyweight_min nullable
bodyweight_max nullable
```

## User Category

The app stores the user's selected norm category in:

```text
app_metadata
- key: user_sex
- value: unspecified | male | female
```

This setting is only for analytics comparisons. It is not used for logging.

## Import Workflow

Editable source CSV:

```text
data/sources/strength-norms.editable.csv
```

Importer:

```sh
node scripts/import-strength-norms.js
```

Optional URL import:

```sh
node scripts/import-strength-norms.js https://example.com/strength-norms.csv
```

The script writes:

```text
data/strength-norm.seed.json
```

The generated repository seed is loaded directly by the import/build scripts.

## Source Candidates

Useful sources to research:

- OpenPowerlifting-derived data: best for auditable sex/bodyweight/lift distributions, but needs a local transform into percentiles or categories.
- StrengthLevel-style tables: convenient for everyday gym lifts, but review licensing and methodology before bundling.
- Wilks/DOTS-style formulas: useful for relative strength scoring, but they are not the same thing as beginner/intermediate/advanced thresholds.

## Current Seed Source

The active seed is generated from Legion Athletics strength-standard chart images:

```text
data/sources/legion-strength-standards.raw.json
scripts/build-legion-strength-norms.js
data/strength-norm.seed.json
```

Legion publishes the chart values in pounds. The generator converts:

```text
lb * 0.45359237 = kg
```

The generated rows use:

```text
metric = absolute_e1rm
unit = kg
sex = male | female
bodyweight_min/bodyweight_max = kg band
```

Comparison rule:

```text
set_e1rm = weight * (1 + reps / 30)
exercise_best_e1rm = max(set_e1rm)
compare exercise_best_e1rm to absolute_e1rm threshold
```

Raw set weight should not be compared directly to the Legion standard tables unless the set was already a one-rep max.

Lift-name mapping:

```text
Bench Press -> bench-press
Overhead Press -> overhead-press / barbell
Squat -> squat
Deadlift -> deadlift
```

## Guardrails

- Store the source name and URL for every threshold row.
- Keep male/female rows separate.
- Prefer bodyweight-banded thresholds when the source supports them.
- Keep personal baseline charts visible even when external norms are incomplete.
- Label all external norms as guidance, not medical or scientific truth.

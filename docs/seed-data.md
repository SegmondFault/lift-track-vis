# Seed Data

## Storage Format

The starter exercise library is stored in:

```text
data/exercise-library.seed.json
```

The starter workout plan is also stored separately for easier review:

```text
data/workout-plan.seed.json
```

JSON is the first storage format because it is easy to inspect, diff, edit, and import. The app should import this file into SQLite tables during first-run setup or a migration.

## Import Targets

The seed maps into these tables:

```text
muscle_group
exercise
exercise_variation
exercise_muscle_contribution
workout_plan
workout_day
workout_day_exercise
```

`data/workout-plan.seed.json` is the clearer source for plan/day structure. `data/exercise-library.seed.json` provides the referenced exercises and variations.

## Contribution Coefficients

Each variation can define its own weighted muscle contribution map.

Example:

```json
{
  "variationId": "incline-dumbbell-press__standard",
  "muscleContributions": [
    { "muscleGroupId": "upper-chest", "coefficient": 1.0 },
    { "muscleGroupId": "chest", "coefficient": 0.8 },
    { "muscleGroupId": "front-delts", "coefficient": 0.7 },
    { "muscleGroupId": "triceps", "coefficient": 0.5 }
  ]
}
```

These are analytics coefficients, not anatomy claims. They are meant to be good-enough defaults that the user can correct over time.

## Exercise Tags And Variations

Exercises can carry broad tags:

```json
{
  "id": "squat",
  "tags": ["compound"]
}
```

Use `compound` for big multi-joint lifts and `accessory` for smaller isolation/support movements.

Variations should stay narrow. They are for subtypes such as:

```text
Bench Press / Close Grip
Squat / Paused
Pull-Up / Neutral Grip
```

Do not use variations for distinct exercises such as `Incline Bench Press` or `Incline Dumbbell Press`. Those should be separate exercise records with their own muscle contribution coefficients.

## Aliases

Aliases preserve messy source names from imported sheets.

Example:

```json
{
  "name": "Dumbbell Shoulder Press",
  "aliases": ["Dumbel Shoulder press"]
}
```

This lets imports map older spelling or naming habits onto normalized exercises without losing compatibility.

## Workout Plan Shape

Workout plan seed entries preserve both normalized references and original CSV text.

Example:

```json
{
  "sourceName": "Incline Dumbell",
  "exerciseId": "incline-dumbbell-press",
  "variationId": "incline-dumbbell-press__standard",
  "targetSets": 3,
  "sortOrder": 1
}
```

The app should use `exerciseId` and `variationId` internally. `sourceName` is only for auditability and import traceability.

## Historic Workbook Import

Historic data from `Workouts.xlsx` is cleaned by:

```text
scripts/import-historic-workouts.py
```

Outputs:

```text
data/imports/historic-workouts.cleaned.json
data/imports/historic-lift-set.cleaned.csv
data/imports/bodyweight-observations.cleaned.csv
data/body-weight.weekly.seed.json
data/body-weight.weekly.seed.csv
```

Cleaning rules:

- Sheet names are treated as the authoritative workout date when copied date fields inside the workbook are stale.
- Implausible bodyweight observations are rejected by configurable bounds.
- Manually supplied bodyweight points are loaded from the ignored `data/private` directory and remain outside Git.
- Weekly bodyweight seed entries choose the latest valid observation in each week.

The import/build scripts upsert these cleaned rows idempotently into the server
SQLite database:

```text
workout_session
lift_set
body_metric_entry
```

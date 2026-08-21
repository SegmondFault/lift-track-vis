# MacBook Data Access And Analytics Plan

> Historical architecture note: this plan predates the current `lift-track-vis`
> service. The implemented system now hosts the phone logger and analytics from
> one Python service, writes both directly to the workstation SQLite database,
> and exposes them privately through Tailscale. See `QUICKSTART.md` and
> `docs/private-deployment.md` for current operation. The analytics definitions
> below remain useful background.

## Recommendation

Use the phone as the capture device and the MacBook as the analysis device.

The phone should own:

- fast gym logging
- local SQLite storage
- offline reliability
- export/sync of raw data

The MacBook should own:

- deeper charts
- adherence reports
- training block comparisons
- CSV/SQLite inspection
- heavier analytics experiments

This can be a separate visualizer app later. It should read the same exported data rather than becoming a second source of truth.

## First Data Access Path

Start simple:

```text
iPhone app SQLite
-> export SQLite / JSON / CSV
-> MacBook folder
-> local visualizer reads exported files
```

Minimum exports:

```text
lift_set.csv
workout_session.csv
exercise.csv
exercise_variation.csv
exercise_muscle_contribution.csv
workout_plan.csv
workout_day.csv
workout_day_exercise.csv
body_metric_entry.csv
full-backup.sqlite
full-backup.json
```

## Later Sync Path

Once the schema settles:

```text
iPhone SQLite
-> append-only change log
-> iCloud Drive / local sync folder / small backend
-> MacBook visualizer
```

The MacBook can eventually write corrections back, but only through explicit synced changes. Do not let the visualizer silently mutate the phone database.

## Plans, Blocks, And Adherence

Keep these concepts separate:

```text
WorkoutPlan = reusable plan template
WorkoutDay = day inside the plan
TrainingBlock = time period with a goal
PlanAssignment = plan active between dates
WorkoutSession = actual performed workout
LiftSet = atomic truth
```

This lets us answer:

- Did I adhere to the plan during this block?
- Did higher volume in this block improve estimated 1RM?
- Did accessory work improve lagging muscle groups?
- Which plan worked better at the same bodyweight?

## Core Analytics

### Adherence

Compare actual sessions to the plan assignment active on that date.

Measures:

```text
planned_sets
completed_sets
set_completion_ratio
planned_exercises_completed
unplanned_exercises_added
skipped_exercises
```

### Volume

Per set:

```text
volume = reps * weight
```

Per muscle:

```text
muscle_volume = volume * muscle_coefficient
```

Per tag:

```text
compound_volume
accessory_volume
```

### Estimated 1RM

Initial formula:

```text
e1rm = weight * (1 + reps / 30)
```

Track:

- best e1RM per exercise per week
- rolling max e1RM
- block start versus block end e1RM
- e1RM normalized by bodyweight

### Bodyweight Normalization

Body metrics should be independent records:

```text
measured_at
body_weight
body_fat
source
```

Analytics should join lifts to the nearest applicable body metric.

Examples:

```text
squat_e1rm / body_weight
bench_e1rm / body_weight
pullup_load / body_weight
```

### Relative Strength And Lagging Groups

This should be treated as a later feature because norms require careful sourcing and assumptions.

Useful first version:

- compare your own muscle-group volume trends
- compare e1RM/bodyweight across main lifts
- show weak or undertrained areas relative to your recent baseline

Later version:

- optional normative tables by sex/bodyweight/training level
- user-visible assumptions
- no hidden universal ranking

## Visualizer Shape

Best first MacBook visualizer:

```text
local web app
reads exported SQLite/JSON
runs charts locally
does not require cloud account
```

Possible stack:

```text
Vite + React + TypeScript
DuckDB-WASM or SQLite reader
Plot/Observable Plot or Recharts
```

This keeps the phone app simple and lets the MacBook side become powerful without making the gym UI heavy.

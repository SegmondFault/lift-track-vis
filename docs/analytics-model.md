# Analytics Model

## Goal

Produce useful long-term tracking from clean set-level data.

## Core Measures

### Volume

```text
volume = reps * weight
```

For bodyweight exercises, decide per exercise whether analytics should use:

- added weight only
- body weight only
- body weight plus added weight

This can be represented later as an exercise analytics policy.

### Estimated One-Rep Max

Initial formula:

```text
e1rm = weight * (1 + reps / 30)
```

This should be shown only where useful and should not replace raw set data.

### Weekly Buckets

Most long-term charts should aggregate by calendar week, Monday through Sunday:

```text
week_start
exercise_id
variation_id nullable
muscle_group_id nullable
location_tag_id nullable
body_metric snapshot nullable
```

Rules:

- `week_start` is always the Monday of the week.
- Week buckets are not rolling seven-day windows.
- Week start can be configured, but the default is Monday.
- Missing weeks are missing observations, not zeroes.
- Trend lines may visually interpolate across missing weeks, but calculations such as averages, deltas, and totals must use observed weeks only unless a chart explicitly says otherwise.

## Plan-Expected Weeks

Plans are reusable templates. Dates live in `plan_assignment`, so different eras can use different plans.

Weekly expected work is derived from:

```text
plan_assignment date span
-> workout_plan
-> workout_day
-> workout_day_exercise target_sets
```

Previous weeks are closed periods. Current week is an in-progress period and should be labelled differently in adherence views.

Missing data for a previous week should be shown as missing/unknown unless the app can prove that no workout happened. It should not silently become `0`.

## Example Questions

The model should support:

- weekly average weight per exercise over one year
- weekly volume per muscle group
- volume split by compound versus accessory work
- estimated one-rep max trend per lift
- total hard sets per muscle group
- exercise performance versus body weight
- body fat versus volume trend
- planned versus freestyle volume
- location-based training comparison
- two-year volume delta by muscle group

## Muscle Group Attribution

Muscle-level analytics should use exercise or exercise-variation contribution coefficients rather than primary/secondary tags.

```text
muscle_volume = set_volume * resolved_contribution.coefficient
muscle_set_count = 1 * resolved_contribution.coefficient
```

When a set has a variation-specific contribution map, use that. Otherwise, fall back to the base exercise contribution map.

Examples:

```text
Bench Press:
- Chest 1.0
- Upper Chest 0.8
- Triceps 0.7
- Shoulders 0.5

Squat:
- Quads 1.0
- Glutes 1.0
- Hamstrings 0.8
- Core 0.4
```

This makes charts such as weekly quad volume, glute volume, upper chest volume, or broad chest rollups much more accurate than binary tags.

If a muscle has a parent group, analytics can roll specific muscles into broader groups:

```text
Upper Chest -> Chest
Lower Chest -> Chest
```

For broad rollups, avoid double-counting a parent and child if both are assigned to the same exercise. The app should either:

- store only specific muscles and derive parent totals
- or store broad muscles only for exercises where specificity is not needed

## Body Metrics Join

For analytics, a set can be associated with the closest body metric entry that applies at the set date.

Preferred rule:

```text
use metric where applies_from <= set.started_at <= applies_to
otherwise use nearest previous metric
otherwise null
```

Missing body metrics should not block lift logging.

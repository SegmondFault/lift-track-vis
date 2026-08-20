# Data Model

## Overview

The data model is local-first and set-centric. A set is the atomic fact. Sessions, exercise blocks, analytics, body-mass comparisons, and location labels are derived from or associated with sets.

All mutable records should include:

```text
id UUID primary key
created_at timestamp
updated_at timestamp
deleted_at nullable timestamp
```

Use soft deletion for user-created records and lift sets so analytics can be repaired and sync conflicts can be resolved later.

## Core Tables

### Exercise

Represents the base lift.

```text
exercise
- id
- name
- tags
- notes nullable
- archived_at nullable
- created_at
- updated_at
- deleted_at nullable
```

Examples:

- Bench Press
- Squat
- Deadlift
- Pullups

Initial exercise tags:

```text
compound
accessory
```

These are broad training categories for filtering, plan balance, and analytics. They do not replace muscle contribution coefficients.

### ExerciseVariation

Represents a narrow lift variant under a base exercise.

```text
exercise_variation
- id
- exercise_id
- name
- is_default
- notes nullable
- created_at
- updated_at
- deleted_at nullable
```

Examples:

- Standard
- Close Grip
- Paused

The default variation should be named `Standard`.

Variations should be used for subtypes of the same basic lift pattern, such as `Close Grip Bench Press`, `Paused Squat`, or `Neutral Grip Pull-Up`.

They should not be used for meaningfully different exercises. For example:

```text
Bench Press
Incline Bench Press
Incline Dumbbell Press
```

should be separate exercises, not variations of one `Bench Press` record, because the movement and muscle contribution profile are materially different.

### MuscleGroup

Controlled list of muscles or muscle groups used for analytics attribution.

```text
muscle_group
- id
- name
- parent_id nullable
- sort_order
```

Suggested initial groups:

- Chest
- Upper Chest
- Lower Chest
- Back
- Shoulders
- Biceps
- Triceps
- Quads
- Hamstrings
- Glutes
- Calves
- Core

`parent_id` allows both broad and specific tracking. For example, `Upper Chest` can roll up into `Chest`.

### ExerciseMuscleContribution

Maps exercises or exercise variations to muscles with a contribution coefficient.

```text
exercise_muscle_contribution
- id
- exercise_id
- exercise_variation_id nullable
- muscle_group_id
- coefficient
- notes nullable
- created_at
- updated_at
- deleted_at nullable
```

`coefficient` is a multiplier for attributing set volume to that muscle. A value of `1.0` means full contribution. A value of `0.8` means the muscle receives 80% of the set volume for muscle-level analytics.

If `exercise_variation_id` is null, the row applies to the exercise generally. If it is set, the row applies to that variation. Variation-level rows should override general exercise rows for that variation.

Examples:

```text
Squat:
- Quads 1.0
- Glutes 1.0
- Hamstrings 0.8
- Core 0.4

Bench Press:
- Chest 1.0
- Upper Chest 0.8
- Triceps 0.7
- Shoulders 0.5
```

The app should allow coefficients greater than `1.0` only if there is a clear analytics reason. The default UI should steer users toward `0.0` to `1.0`.

## Seed Storage

Initial app content should be stored as auditable seed JSON in the repository, then imported into SQLite on first run or migration.

Recommended file:

```text
data/exercise-library.seed.json
```

The seed should include:

- muscle groups
- exercises
- variations
- exercise tags such as `compound` and `accessory`
- per-variation muscle contribution coefficients
- aliases for messy imported names
- starter workout plans

### WorkoutPlan

```text
workout_plan
- id
- name
- is_active
- created_at
- updated_at
- deleted_at nullable
```

### TrainingBlock

Represents a period of training where a plan is being followed and analytics should be compared together.

```text
training_block
- id
- name
- goal nullable
- started_at
- ended_at nullable
- created_at
- updated_at
- deleted_at nullable
```

Examples:

- Hypertrophy Block 1
- Strength Block 1
- Cut Maintenance

### PlanAssignment

Associates a plan with a time period. This is cleaner than making the plan itself carry one fixed time value, because the same plan can be reused across multiple blocks.

```text
plan_assignment
- id
- training_block_id nullable
- workout_plan_id
- started_at
- ended_at nullable
- notes nullable
- created_at
- updated_at
- deleted_at nullable
```

Adherence analytics should compare workout sessions to the active plan assignment at the time the session occurred.

### WorkoutDay

```text
workout_day
- id
- workout_plan_id
- day_index
- name nullable
- created_at
- updated_at
- deleted_at nullable
```

`day_index` wraps back to `1` after the final day.

### WorkoutDayExercise

```text
workout_day_exercise
- id
- workout_day_id
- exercise_id
- exercise_variation_id nullable
- target_sets nullable
- sort_order
- created_at
- updated_at
- deleted_at nullable
```

If `exercise_variation_id` is null, use the default variation for the exercise.

Workout day exercises are plan targets. They should not be treated as completed work unless the user logs sets against them.

### WorkoutSession

```text
workout_session
- id
- mode planned | freestyle
- workout_plan_id nullable
- workout_day_id nullable
- started_at
- ended_at nullable
- location_tag_id nullable
- notes nullable
- created_at
- updated_at
- deleted_at nullable
```

### LiftSet

The primary raw data record.

```text
lift_set
- id
- workout_session_id
- exercise_id
- exercise_variation_id
- reps
- weight
- weight_unit kg | lb
- started_at
- raw_lat nullable
- raw_lng nullable
- location_tag_id nullable
- body_weight nullable
- body_fat nullable
- notes nullable
- created_at
- updated_at
- deleted_at nullable
```

`started_at` is captured automatically when the user logs the set.

### AppSetting

```text
app_setting
- key
- value
- updated_at
```

Initial setting:

```text
set_grouping_window_minutes = 12
```

## Derived Exercise Blocks

Exercise blocks are derived from `lift_set`, not manually edited.

A set belongs to the same block as the previous set when:

```text
same workout_session_id
same exercise_id
same exercise_variation_id
gap between adjacent sets <= set_grouping_window_minutes
```

The app may cache derived blocks for performance:

```text
exercise_block_cache
- id
- workout_session_id
- exercise_id
- exercise_variation_id
- first_set_at
- last_set_at
- set_count
- invalidated_at nullable
```

The cache is not authoritative.

## Location Tables

### LocationTag

```text
location_tag
- id
- name
- color
- created_at
- updated_at
- deleted_at nullable
```

Examples:

- Home
- Main Gym
- Hotel Gym

### LocationResolutionRule

```text
location_resolution_rule
- id
- location_tag_id
- center_lat
- center_lng
- radius_meters
- created_at
- updated_at
- deleted_at nullable
```

When a user resolves one GPS cluster into a named location, similar nearby sets can inherit that `location_tag_id`.

## Body Metrics

Body metrics should be stored independently from individual lift sets so missing data can be backfilled later.

```text
body_metric_entry
- id
- measured_at
- body_weight nullable
- body_weight_unit kg | lb
- body_fat nullable
- source manual | imported | estimated
- applies_from nullable
- applies_to nullable
- notes nullable
- created_at
- updated_at
- deleted_at nullable
```

Analytics should join a set to the nearest applicable body metric by date.

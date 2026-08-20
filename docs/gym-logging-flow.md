# Gym Logging Flow

## Primary Flow

1. User opens the app.
2. Lift logging page shows the suggested next workout day.
3. User chooses:
   - suggested day
   - a different day
   - freestyle
4. App creates or resumes a workout session.
5. User taps an exercise.
6. App preloads exercise and variation.
7. User enters reps and weight.
8. App logs:
   - reps
   - weight
   - exercise
   - variation
   - timestamp
   - GPS coordinates if available
9. User can delete or edit the set.

Location resolution does not happen inside the workout log. The workout log captures GPS automatically, then a global Location Resolver applies location tags later.

## Plan Versus Actual

The workout plan is a target checklist, not the historical truth.

Planned day data answers:

```text
What did I intend to do today?
```

Logged sets answer:

```text
What did I actually do?
```

The app should keep these separate:

- planned exercises remain available as a checklist
- tapping a planned exercise adds it to the current session
- the current session list is the actual sequence of exercises performed
- random exercises can be added from the global exercise list
- analytics use logged sets, not planned targets
- adherence analytics can compare planned targets against actual logged work

If a planned exercise is skipped, it should remain a skipped plan item rather than becoming fake workout data.

## Actual Session Boundary

The actual session list should be derived from real logged sets, not copied from the plan.

The user should be able to choose how the app rebuilds the visible actual session:

```text
Since local midnight
Last 24 hours
```

Default:

```text
Since local midnight
```

This setting controls which logged sets are used to populate the actual session list on app open or reload.

Examples:

```text
Since local midnight:
- includes sets logged today after 00:00 local time

Last 24 hours:
- includes sets logged in the rolling previous 24 hours
```

The setting affects the working view, not the raw data. Raw sets keep their real timestamps.

## Suggested Day Logic

The app finds the last completed planned workout day for the active plan.

```text
if no prior planned session:
  suggest day 1
else if last day is final day:
  suggest day 1
else:
  suggest next day
```

Freestyle sessions do not advance the planned day.

## Set Entry Requirements

Set entry should be optimized for mobile use in the gym, including sweaty hands and limited attention:

- Very large tap targets
- Minimal text
- Numeric inputs for reps and weight only
- Last used reps and weight prefilled where useful
- Log set button reachable with one thumb
- Recent sets visible immediately
- Delete action available but not too easy to hit accidentally
- No exercise creation, tagging, location setup, analytics controls, or plan editing

The main logging page should feel closer to a stopwatch than a spreadsheet.

## Adding Extra Exercises

During a planned workout, the user can add an exercise from the global exercise list. This is a selection flow, not an exercise creation flow.

The workout log may open a simple selector that shows:

- large exercise rows
- optional recent/favorite lifts first
- variation picker only if needed
- add to current session action

This does not permanently alter the plan unless the user explicitly chooses to update the plan later.

New exercises and new variations are created only on the Exercise Setup page.

## Deletion

Deleting a set should soft-delete it:

```text
lift_set.deleted_at = current timestamp
```

Analytics exclude deleted sets by default.

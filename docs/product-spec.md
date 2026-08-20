# Weight Lifting Tracker Product Spec

## Goal

Build a local-first mobile weight lifting tracker for use in the gym, with iOS as the first-class target and Android as a likely future target. The app should make set logging fast while producing clean, exportable data for long-term analytics.

## Product Principles

- Logging a set should take only a few seconds.
- The raw set log is the source of truth.
- Derived structures, such as exercise blocks and analytics aggregates, should be recalculable.
- The user owns the data and can export it to a home machine.
- The app should work offline in a gym.
- Later sync should support mobile-to-computer and computer-to-mobile correction workflows.

## Recommended Stack

Use React Native with Expo, TypeScript, and SQLite.

Reasons:

- One mobile codebase for iOS and Android.
- TypeScript is relatively easy to inspect and audit.
- SQLite gives durable, queryable, user-owned local data.
- Expo provides practical access to GPS, file export, sharing, and mobile build tooling.
- The same data can later be exported as SQLite, CSV, JSON, or NDJSON.

## Major Areas

1. Exercise setup
2. Workout plan setup
3. Lift logging
4. Location resolution
5. Body metrics backfill
6. Analytics
7. Export and sync

## Required App Pages

Initial app navigation should include:

```text
Log
Training Days
Exercises
Settings
```

`Log` is the gym screen. It should stay simple.

`Training Days` is where the user designs or edits the workout plan.

`Exercises` is where the user adds/removes exercises, variations, and muscle contribution coefficients.

`Settings` is where global behavior lives, including actual-session boundary mode.

## First Mockup Scope

The first low-fidelity mockup covers:

- Suggested next workout day
- Freestyle entry
- Planned exercise list
- Set entry panel
- Set history with delete action
- Exercise setup
- Location resolver
- Analytics overview

Exercise Setup and Location Resolver should be independent pages. The workout log may select existing exercises, but it should not create new exercise definitions inline.

It intentionally does not implement persistence, GPS capture, or real chart rendering.

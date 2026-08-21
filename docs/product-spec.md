# lift-track-vis Product Spec

## Goal

Build a private weight-lifting tracker for use in the gym. The phone experience
should make set logging fast while the fuller web view provides clean,
exportable data for long-term analytics.

## Product Principles

- Logging a set should take only a few seconds.
- The raw set log is the source of truth.
- Derived structures, such as exercise blocks and analytics aggregates, should be recalculable.
- The user owns the data and can export it from the private server.
- The logger should be reachable only over the user's Tailscale network.
- Loss of connectivity must produce an obvious error rather than pretending a set was saved.

## Stack

Use a dependency-free HTML/CSS/JavaScript phone page, a Python standard-library
HTTP service, and SQLite.

Reasons:

- The same private URL works in iOS and Android browsers.
- No app installation, build service, or package manager is required.
- SQLite gives durable, queryable, user-owned data on the host workstation.
- Tailscale provides encrypted, tailnet-only access from the phone.
- The structured data can be exported as JSON or converted to other formats.

## Major Areas

1. Exercise setup
2. Workout plan setup
3. Lift logging
4. Location resolution
5. Body metrics backfill
6. Analytics
7. Export and sync

## Required Web Views

Global analytics navigation includes:

```text
Overview
Log
Week to week
Benchmarks
Biometrics
Training volume
Settings
```

`Phone logger` is the gym screen at `/phone/`. It has a persistent Simple /
Complex switch at the same URL. Simple shows exercise, reps, weight, and save;
Complex adds workout day, variation, date/time, and today's saved sets.

`Biometrics` contains nested Measurements, Body composition, Athlete model, and
Growth forecast sections. The entire workspace is labelled heuristic and
experimental.

`Training volume` contains Volume overview and Muscle groups. `Settings`
contains General settings, Plans, and Imports. Exercise definitions and muscle
contribution data remain part of the structured dataset.

## First Mockup Scope

The initial experience covers:

- Suggested next workout day
- Freestyle entry
- Planned exercise list
- Set entry panel
- Set history with delete action
- Exercise setup
- Analytics overview

The workout logger selects existing exercises; it does not create definitions
inline. GPS and location capture are outside the current scope.

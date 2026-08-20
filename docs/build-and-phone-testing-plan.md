# Build And Phone Testing Plan

## Goal

Get the lifting tracker running on a real phone for gym testing as early as possible, while keeping the project deployable, auditable, and ready for later iOS/Android builds.

## Recommended Stack

Use:

```text
Expo + React Native + TypeScript + SQLite
```

Reasons:

- One app codebase can target iOS and Android.
- TypeScript is straightforward to audit.
- SQLite gives local-first user-owned data.
- Expo can support fast iteration, real-device testing, and later production builds.

## Phase 1: Local App Scaffold

Create an Expo app in the repo:

```text
mobile/
```

Initial structure:

```text
mobile/
- app/
- src/
  - db/
  - seed/
  - screens/
  - components/
  - analytics/
  - workout/
  - location/
- assets/
- app.json
- package.json
```

The existing seed files should be copied or imported into the mobile app:

```text
data/exercise-library.seed.json
data/workout-plan.seed.json
```

## Phase 2: First Real Phone Test

Use Expo's normal development loop first.

Target:

```text
run on personal iPhone over local network
```

Initial scope:

- load seed exercises
- load workout plan days
- show suggested next day
- log sets locally
- persist sets in SQLite
- no sync yet
- no account system

This is the fastest way to test the sweaty-hands logging loop in the gym.

## iPhone Simulator And Apple Account Notes

An iPhone simulator is useful, but not required for the first useful test.

Best early path:

```text
iPhone + Expo Go + local development server
```

This lets the app run on the actual phone used in the gym, which is more valuable than a simulator for this project.

Simulator requirements:

```text
Mac + Xcode
```

The simulator is good for layout checks and fast debugging. It is not a substitute for testing tap targets, real phone ergonomics, GPS permissions, and export behavior on the actual device.

Apple account levels:

```text
Free Apple Account:
- can use Xcode and on-device testing for personal development
- has provisioning limits
- profiles expire after a short period
- not suitable for durable app distribution

Paid Apple Developer Program:
- needed for normal ad hoc/internal iOS distribution
- needed for TestFlight and App Store Connect
- needed for stable private testing installs
```

Institutional Apple Developer Program access, when available, is normally managed
through the institution's team rather than granted automatically to every email
account. Check the relevant IT or course portal.

## Phase 3: Development Build

Move to an Expo development build once native behavior matters.

Reasons:

- closer to a production app than Expo Go
- stable native dependencies
- app icon/name/splash can be tested
- native libraries are bundled into our app
- better path toward real internal distribution

Use this before relying heavily on:

- SQLite migrations
- GPS/location permissions
- background-ish app behavior
- file export/share
- production-like app identity

## Phase 4: Installable Home-Phone Build

For an installable iPhone build outside Expo Go, use EAS Build internal distribution.

Expected shape:

```text
eas build --platform ios --profile preview
```

Important iOS note:

Internal iOS distribution normally requires an Apple Developer account and registering the test phone's UDID for ad hoc provisioning. Expo/EAS can manage much of this, but Apple still controls the signing rules.

Android is easier:

```text
eas build --platform android --profile preview
```

This can produce an APK for direct install on an Android device.

## Phase 5: Data Export

Before serious gym use, implement export.

Minimum export:

```text
export SQLite database
export sets CSV
export full JSON backup
```

This should exist before the app becomes the main training log.

## Phase 6: Testing Checklist

Before using it as the real tracker:

- app opens offline
- seed plan loads
- next day selection works
- freestyle works
- set logging takes under five seconds
- delete set works
- app restart preserves sets
- GPS permission failure does not block logging
- unresolved GPS can be stored
- export creates readable files
- exported data can be opened on home machine

## Phase 7: Later Distribution

Once the app is useful:

- use TestFlight for more polished iOS testing
- keep Android preview APKs available
- add EAS Update only after local database migrations are stable
- consider App Store release only after privacy/export/sync behavior is solid

## First Implementation Milestone

Build only this first:

1. Create Expo app.
2. Import seed exercises and workout plan.
3. Create SQLite schema.
4. Show Day 1 to Day 5.
5. Log sets with reps, weight, exercise, variation, timestamp.
6. Persist and reload set history.
7. Run on phone with Expo.

No analytics, no sync, no location resolver in milestone one.

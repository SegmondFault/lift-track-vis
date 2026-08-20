# Low-Fidelity Mockup Plan

## Purpose

The mockup tests the shape of the app before building the real mobile project.

## Screens

### Today

Shows:

- suggested next workout day
- quick access to freestyle
- current plan
- recent session summary

### Lift Logging

Shows:

- selected day or freestyle mode
- planned exercise list
- simple add-from-list action
- active exercise
- reps and weight entry
- recent sets
- delete action

This page should stay intentionally simple for gym use. Advanced setup, tagging, analytics, and location resolution belong elsewhere.

### Exercise Setup

Shows:

- create exercise
- create variation
- weighted muscle contributions

Exercise setup is its own page. The workout logging page only selects from exercises that already exist.

### Location Resolver

Shows:

- unresolved GPS clusters
- assign existing location
- create new location tag
- apply to matching nearby sets
- existing automatic location rules
- future GPS coordinates resolving into tags

Location Resolver is its own global page. It is not scoped to a single workout.

### Analytics

Shows placeholder cards for:

- weekly volume
- average weight
- muscle group trend
- body mass comparison

## Interaction Priority

The first real prototype should make the Lift Logging screen feel right before polishing analytics.

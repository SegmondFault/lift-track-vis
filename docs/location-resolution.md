# Location Resolution

## Goal

Capture GPS automatically during set logging, then let the user convert raw coordinates into human-readable location tags from a global Location Resolver page.

The resolver is configured once for a new place. After a location rule exists, future matching GPS coordinates should be resolved automatically into a location tag.

## Flow

1. App logs `raw_lat` and `raw_lng` on each set when GPS is available.
2. App checks existing location resolution rules.
3. If a coordinate matches a rule, the set receives `location_tag_id`.
4. If no rule matches, the set remains unresolved.
5. Global Location Resolver shows unresolved clusters.
6. User selects a cluster or individual set.
7. User assigns a tag such as `Home` or `Main Gym`.
8. App creates or updates a reusable radius rule.
9. App updates matching historical sets with `location_tag_id`.
10. Future matching sets are tagged automatically.

## Matching Rule

When resolving a coordinate:

```text
distance from rule center <= radius_meters
```

Matching sets receive the linked `location_tag_id`. Once tagged, the app should display the location tag instead of raw GPS in normal workout history.

## Privacy Option

After resolution, the app should eventually offer:

```text
delete raw coordinates after assigning location tag
```

This preserves useful analytics while reducing long-term location sensitivity.

## UI Notes

The resolver should be its own page and show:

- approximate date range
- number of sets
- current unresolved coordinate cluster
- suggested matching existing tags
- create new tag action
- existing rules
- automatic tagging status

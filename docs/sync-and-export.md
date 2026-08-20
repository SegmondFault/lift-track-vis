# Sync And Export

## Goal

The user should always be able to recover, inspect, and analyze their data outside the mobile app.

## Local-First Store

The mobile app should use SQLite as the canonical local database.

Benefits:

- Works offline
- Durable
- Easy to back up
- Queryable on a home machine
- Suitable for future sync

## Export Formats

Support these exports:

```text
full SQLite database
CSV export for sets, exercises, plans, locations, body metrics
JSON export for complete structured data
NDJSON event log for future sync/debugging
```

Current v1 implementation:

- Expo Go shares `full-backup.json` through the iOS share sheet.
- The phone app also writes normalized CSV siblings into its temporary export directory.
- The Mac visualizer imports the JSON backup as read-only data.
- Direct SQLite-file import, zipped bundle sharing, and bidirectional sync are deferred.

Freshness tracking:

- Phone exports include `exportId`, `exportedAt`, `createdOnDeviceAt`, and `latestSetLoggedAt`.
- The Mac visualizer records `importedAt` in browser local storage when a file is loaded.
- `exportedAt` answers "when did the phone produce this backup?"
- `importedAt` answers "when did this Mac visualizer last load a backup?"
- `latestSetLoggedAt` answers "how fresh is the workout data inside the backup?"

Mac-side import cache:

- The visualizer keeps a read-only merged cache in browser local storage.
- Rows are deduplicated by stable table IDs, with composite keys for metadata, norms, exercise targets, and muscle contributions.
- Re-importing the same backup should update cached rows without duplicating lift sets.
- This cache is for analysis continuity only. The phone SQLite database is still the canonical source of truth.

## Future Sync Direction

Use an append-only change log.

```text
change_log
- id
- entity_type
- entity_id
- operation create | update | delete
- changed_at
- device_id
- payload_json
- synced_at nullable
```

This allows:

- mobile-to-computer backup
- computer-side data repair
- computer-to-mobile sync
- conflict inspection

## Conflict Policy

Initial conflict policy:

```text
last write wins for non-critical fields
manual review for deleted records or conflicting set edits
```

Lift sets are important enough that conflicting edits should be visible rather than silently overwritten.

## Device Identity

Each install should have a stable local device id:

```text
device
- id
- name
- created_at
```

This keeps sync history understandable.

# Sync And Export

## Goal

The user should always be able to recover, inspect, and analyze their data
outside the browser interface.

## Canonical Store

The private tracker service on the host uses SQLite as the canonical database.

Benefits:

- Durable
- Easy to back up
- Queryable on the workstation
- Shared by phone logging and analytics without a synchronization step

## Export Formats

Support these exports:

```text
full SQLite database
CSV export for sets, exercises, plans, locations, body metrics
JSON export for complete structured data
NDJSON event log for future sync/debugging
```

Current implementation:

- The phone web page writes sets directly through the private tracker API.
- The service upserts rows into SQLite and regenerates `full-backup.json`.
- The full analytics page reads the generated JSON backup.
- Historical JSON backups can still be imported with the legacy import scripts.

Freshness tracking:

- Backups include `exportId`, `exportedAt`, `createdOnDeviceAt`, and `latestSetLoggedAt`.
- The analytics page records `importedAt` when a file is loaded manually.
- `exportedAt` answers "when did the service produce this backup?"
- `importedAt` answers "when did this browser last load a manual backup?"
- `latestSetLoggedAt` answers "how fresh is the workout data inside the backup?"

Browser-side import cache:

- The visualizer keeps a read-only merged cache in browser local storage.
- Rows are deduplicated by stable table IDs, with composite keys for metadata, norms, exercise targets, and muscle contributions.
- Re-importing the same backup should update cached rows without duplicating lift sets.
- This cache is for analysis continuity only. The server SQLite database remains
  the canonical source of truth.

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

This could later allow:

- offline phone capture followed by server synchronization
- workstation-side data repair
- conflict inspection

## Conflict Policy

Initial conflict policy:

```text
last write wins for non-critical fields
manual review for deleted records or conflicting set edits
```

Lift sets are important enough that conflicting edits should be visible rather than silently overwritten.

## Device Identity

If offline clients are added later, each install should have a stable device id:

```text
device
- id
- name
- created_at
```

This keeps sync history understandable.

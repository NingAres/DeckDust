# Cloud backup contract

## Purpose

Neon is an optional remote backup destination for local SQLite snapshots. It is not the application's live database. Each user supplies and manages their own Neon project, region, database and credentials.

The snapshot table stores `collection.sqlite3`, `decks.sqlite3` and `packs.sqlite3` as `BYTEA`, along with SHA-256, file size and upload time.

## Rules

- Use SQLite's `backup()` API to create consistent snapshots; never copy an active SQLite file directly.
- Store the latest copy under `latest/<filename>` and retain dated copies under `snapshots/YYYY-MM-DD/<filename>` using UTC dates.
- Sync all three local databases as a unit. If a file is missing or any connection/write fails, report failure.
- Compute SHA-256 before upload. Never print connection strings, passwords or complete credentials in logs or status responses.
- Keep connection strings only in the per-user DPAPI-protected settings file under `%LOCALAPPDATA%\Deck Dust\cloud-backup.json`.
- Do not upload HSReplay sessions, image caches or unrelated user data.
- Before deleting snapshots, changing retention, recreating a remote database or restoring over active data, preserve a verifiable local copy.

## Sync schedule

- Schedule a catch-up sync when the app starts.
- After local collection, deck or pack data is saved, sync after 60 seconds of inactivity; submit pending work on exit.
- Pack log monitoring can trigger a sync when a new pack is recorded.
- Network failures use exponential backoff from 5 minutes up to 6 hours and do not block local saves.
- Status endpoint: `GET /api/cloud-backup/status`. Implementation and CLI: `cloud_backup.py`.

## Dependencies

The Python runtime uses `psycopg[binary]` from `desktop-requirements.txt`. Build the web app before packaging. PyInstaller packaging requires separate user approval as described in `DEVELOPMENT.md`.

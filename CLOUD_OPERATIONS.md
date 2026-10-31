# Neon Backup Operations

Each user configures their own Neon project and database. Use the Neon Console to obtain a connection string and pass it only to the hidden prompt:

```powershell
python cloud_backup.py --configure
```

The CLI stores the connection string encrypted with the current Windows user's DPAPI under `%LOCALAPPDATA%\Deck Dust\cloud-backup.json`. Never commit that file, expose the connection string in screenshots, or paste credentials into issues.

## Verify and operate

```powershell
python cloud_backup.py --sync
python cloud_backup.py --verify
```

`--verify` checks stored snapshot hashes and SQLite integrity. `--export latest` or `--export YYYY-MM-DD` writes a verified restore copy to a separate folder and does not overwrite an active database.

The app exposes sync state from `/api/cloud-backup/status`. Run commands from a normal Windows terminal if Windows app-container path redirection prevents access to the normal user data directory.

Before restoring, stop the app, make a separate copy of all local SQLite files, export and verify the target snapshot, then restore it manually. Do not edit stored SQLite blobs directly in Neon SQL Editor.

Retention keeps `latest/` and one dated snapshot per day for each database. This project does not automatically delete old snapshots. Set retention according to your recovery needs and available storage.

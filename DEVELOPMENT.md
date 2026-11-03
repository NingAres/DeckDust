# Development notes

The frontend uses React and Vite; the desktop shell uses Python, pywebview and a local HTTP service. SQLite databases and account sessions belong in each user's local data directory and must never be committed.

Build the frontend with:

```powershell
npm install
npm run build
```

For desktop development, install `desktop-requirements.txt` and run `python desktop_app.py`. Use `DECK_DUST_DATA_DIR` to point manual checks at an isolated temporary directory.

Pack history snapshots are stored under `%LOCALAPPDATA%\Deck Dust\Data\packrecord`; deck exports are stored under `%LOCALAPPDATA%\Deck Dust\Exports\套牌导出`. Older files beside the executable are copied into these persistent folders on launch. Existing files are kept; name collisions are migrated with a numbered suffix.

See `PROJECT_REQUIREMENTS.md` for user-facing behavior and data rules. Before changing remote backup behavior, read `CLOUD_BACKUP.md` and `CLOUD_OPERATIONS.md`.

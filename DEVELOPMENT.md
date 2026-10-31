# Development notes

The frontend uses React and Vite; the desktop shell uses Python, pywebview and a local HTTP service. SQLite databases and account sessions belong in each user's local data directory and must never be committed.

Build the frontend with:

```powershell
npm install
npm run build
```

For desktop development, install `desktop-requirements.txt` and run `python desktop_app.py`. Use `DECK_DUST_DATA_DIR` to point manual checks at an isolated temporary directory.

See `PROJECT_REQUIREMENTS.md` for user-facing behavior and data rules. Before changing remote backup behavior, read `CLOUD_BACKUP.md` and `CLOUD_OPERATIONS.md`.

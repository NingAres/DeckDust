"""Debounced, encrypted-credential snapshots of Deck Dust's SQLite databases."""
from __future__ import annotations

import base64
import ctypes
from ctypes import wintypes
import json
import hashlib
import os
import re
import argparse
import sqlite3
import tempfile
import threading
import time
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

DATABASES = ("collection.sqlite3", "decks.sqlite3", "packs.sqlite3")
CONFIG_PATH = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Deck Dust" / "cloud-backup.json"
DEBOUNCE_SECONDS = 60


class _Blob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


def _crypt(data: bytes, protect: bool) -> bytes:
    if os.name != "nt":
        raise RuntimeError("云端备份凭据只能在 Windows DPAPI 下解密。")
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    source_buffer = ctypes.create_string_buffer(data)
    source = _Blob(len(data), ctypes.cast(source_buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = _Blob()
    fn = crypt.CryptProtectData if protect else crypt.CryptUnprotectData
    fn.argtypes = [ctypes.POINTER(_Blob), wintypes.LPCWSTR, ctypes.c_void_p,
                   ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(_Blob)] if protect else [
                       ctypes.POINTER(_Blob), ctypes.POINTER(wintypes.LPWSTR), ctypes.c_void_p,
                       ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(_Blob)]
    fn.restype = wintypes.BOOL
    if protect:
        succeeded = fn(ctypes.byref(source), "Deck Dust Neon backup", None, None, None, 0, ctypes.byref(target))
    else:
        description = wintypes.LPWSTR()
        succeeded = fn(ctypes.byref(source), ctypes.byref(description), None, None, None, 0, ctypes.byref(target))
        if description:
            kernel.LocalFree(description)
    if not succeeded:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(target.pbData, target.cbData)
    finally:
        kernel.LocalFree(target.pbData)


def save_config(settings: dict) -> None:
    secret = str(settings.pop("database_url"))
    settings["database_url_encrypted"] = base64.b64encode(_crypt(secret.encode(), True)).decode("ascii")
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp = CONFIG_PATH.with_suffix(".tmp")
    temp.write_text(json.dumps(settings, indent=2), encoding="utf-8")
    temp.replace(CONFIG_PATH)


def load_config() -> dict:
    settings = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    encrypted = base64.b64decode(settings.pop("database_url_encrypted"))
    settings["database_url"] = _crypt(encrypted, False).decode()
    return settings


def save_config_from_stdin() -> None:
    import getpass
    import sys
    raw = getpass.getpass("粘贴云端备份配置 JSON（输入不回显）: ") if sys.stdin.isatty() else sys.stdin.readline()
    settings = json.loads(raw)
    save_config(settings)
    print(f"云端备份配置已加密保存到 {CONFIG_PATH}")


def snapshot_databases(data_dir: Path, target_dir: Path) -> dict[str, int]:
    target_dir.mkdir(parents=True, exist_ok=True)
    sizes = {}
    for name in DATABASES:
        source_path = data_dir / name
        if not source_path.is_file():
            raise FileNotFoundError(f"缺少本地数据库：{name}")
        target_path = target_dir / name
        with closing(sqlite3.connect(f"file:{source_path.as_posix()}?mode=ro", uri=True, timeout=20)) as source, \
                closing(sqlite3.connect(target_path)) as target:
            source.backup(target)
        sizes[name] = target_path.stat().st_size
    return sizes


class CloudBackup:
    def __init__(self, data_dir: Path, debounce_seconds: int = DEBOUNCE_SECONDS):
        self.data_dir = Path(data_dir)
        self.debounce_seconds = debounce_seconds
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._last_result: dict = {"enabled": CONFIG_PATH.exists(), "status": "idle"}
        self._retry_seconds = 300

    def schedule(self, reason: str = "local database changed") -> None:
        with self._lock:
            if self._timer:
                self._timer.cancel()
            self._last_result = {"enabled": CONFIG_PATH.exists(), "status": "waiting", "reason": reason,
                                 "scheduledInSeconds": self.debounce_seconds}
            self._timer = threading.Timer(self.debounce_seconds, self.sync_now)
            self._timer.daemon = True
            self._timer.start()

    def status(self) -> dict:
        with self._lock:
            return dict(self._last_result, enabled=CONFIG_PATH.exists())

    def sync_now(self) -> dict:
        with self._lock:
            self._timer = None
            self._last_result = {"enabled": CONFIG_PATH.exists(), "status": "syncing"}
        try:
            config = load_config()
            import psycopg
            stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            with tempfile.TemporaryDirectory(prefix="deck-dust-snapshot-") as temporary:
                folder = Path(temporary)
                sizes = snapshot_databases(self.data_dir, folder)
                with psycopg.connect(config["database_url"], connect_timeout=20) as connection:
                    connection.execute("""CREATE TABLE IF NOT EXISTS deck_dust_backup_snapshots (
                        snapshot_key TEXT PRIMARY KEY,
                        snapshot_date DATE NOT NULL,
                        database_name TEXT NOT NULL,
                        sqlite_data BYTEA NOT NULL,
                        sha256 TEXT NOT NULL,
                        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )""")
                    with connection.cursor() as cursor:
                        for name in DATABASES:
                            content = (folder / name).read_bytes()
                            digest = hashlib.sha256(content).hexdigest()
                            for key in (f"latest/{name}", f"snapshots/{stamp}/{name}"):
                                cursor.execute("""INSERT INTO deck_dust_backup_snapshots
                                    (snapshot_key,snapshot_date,database_name,sqlite_data,sha256,uploaded_at)
                                    VALUES (%s,%s,%s,%s,%s,now())
                                    ON CONFLICT (snapshot_key) DO UPDATE SET snapshot_date=excluded.snapshot_date,
                                    database_name=excluded.database_name,sqlite_data=excluded.sqlite_data,
                                    sha256=excluded.sha256,uploaded_at=now()""",
                                    (key, stamp, name, content, digest))
            result = {"enabled": True, "status": "synced", "completedAt": datetime.now(timezone.utc).isoformat(),
                      "files": sizes, "dailySnapshot": stamp}
            self._retry_seconds = 300
        except Exception as error:
            result = {"enabled": CONFIG_PATH.exists(), "status": "error", "error": str(error)[:500],
                      "failedAt": datetime.now(timezone.utc).isoformat()}
            if CONFIG_PATH.exists():
                with self._lock:
                    self._last_result = dict(result, retryInSeconds=self._retry_seconds)
                    self._timer = threading.Timer(self._retry_seconds, self.sync_now)
                    self._timer.daemon = True
                    self._timer.start()
                self._retry_seconds = min(self._retry_seconds * 2, 6 * 60 * 60)
                return dict(result, retryInSeconds=self._retry_seconds // 2)
        with self._lock:
            self._last_result = result
        return result

    def close(self):
        flush = False
        with self._lock:
            if self._timer:
                self._timer.cancel()
                self._timer = None
                flush = CONFIG_PATH.exists()
        if flush:
            self.sync_now()

    @staticmethod
    def verify_remote() -> dict:
        config = load_config()
        import psycopg
        with psycopg.connect(config["database_url"], connect_timeout=20) as connection:
            rows = connection.execute("""SELECT snapshot_key,database_name,sqlite_data,sha256
                FROM deck_dust_backup_snapshots WHERE snapshot_key LIKE 'latest/%'
                ORDER BY database_name""").fetchall()
        checked = []
        with tempfile.TemporaryDirectory(prefix="deck-dust-verify-") as temporary:
            for key, name, content, expected_hash in rows:
                actual_hash = hashlib.sha256(content).hexdigest()
                if actual_hash != expected_hash:
                    raise ValueError(f"云端摘要不匹配：{key}")
                path = Path(temporary) / name
                path.write_bytes(content)
                with closing(sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)) as db:
                    integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
                if integrity != "ok":
                    raise ValueError(f"SQLite 完整性检查失败：{key}（{integrity}）")
                checked.append({"key": key, "bytes": len(content), "sha256": actual_hash, "integrity": integrity})
        if {item["key"] for item in checked} != {f"latest/{name}" for name in DATABASES}:
            raise ValueError("云端最新快照缺少数据库文件。")
        return {"status": "verified", "files": checked}

    @staticmethod
    def export_remote(data_dir: Path, backup_date: str = "latest") -> dict:
        if backup_date != "latest" and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", backup_date):
            raise ValueError("日期须为 latest 或 YYYY-MM-DD。")
        prefix = "latest" if backup_date == "latest" else f"snapshots/{backup_date}"
        config = load_config()
        import psycopg
        with psycopg.connect(config["database_url"], connect_timeout=20) as connection:
            rows = connection.execute("""SELECT snapshot_key,database_name,sqlite_data,sha256
                FROM deck_dust_backup_snapshots WHERE snapshot_key LIKE %s ORDER BY database_name""",
                (f"{prefix}/%",)).fetchall()
        if {row[1] for row in rows} != set(DATABASES):
            raise ValueError(f"云端备份 {backup_date} 缺少数据库文件。")
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output = Path(data_dir) / "backups" / f"cloud-restore-{backup_date}-{stamp}"
        output.mkdir(parents=True, exist_ok=False)
        exported = []
        for key, name, content, expected_hash in rows:
            if hashlib.sha256(content).hexdigest() != expected_hash:
                raise ValueError(f"云端摘要不匹配：{key}")
            path = output / name
            path.write_bytes(content)
            with closing(sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)) as db:
                integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
            if integrity != "ok":
                raise ValueError(f"SQLite 完整性检查失败：{key}（{integrity}）")
            exported.append({"database": name, "bytes": len(content), "sha256": expected_hash,
                             "integrity": integrity})
        return {"status": "exported", "directory": str(output), "files": exported}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deck Dust Neon backup maintenance")
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--configure", action="store_true", help="save a Neon connection string using Windows DPAPI")
    actions.add_argument("--sync", action="store_true", help="immediately sync local SQLite snapshots to Neon")
    actions.add_argument("--verify", action="store_true", help="verify latest cloud snapshots and SQLite integrity")
    actions.add_argument("--export", metavar="DATE", help="export a verified cloud backup: latest or YYYY-MM-DD")
    args = parser.parse_args()
    if args.configure:
        save_config_from_stdin()
    elif args.sync:
        from data_directory import prepare_data_directory
        result = CloudBackup(prepare_data_directory()).sync_now()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0 if result.get("status") == "synced" else 1)
    elif args.verify:
        try:
            print(json.dumps(CloudBackup.verify_remote(), ensure_ascii=False, indent=2))
        except Exception as error:
            print(json.dumps({"status": "error", "error": str(error)}, ensure_ascii=False, indent=2))
            raise SystemExit(1)
    else:
        from data_directory import prepare_data_directory
        try:
            print(json.dumps(CloudBackup.export_remote(prepare_data_directory(), args.export), ensure_ascii=False, indent=2))
        except Exception as error:
            print(json.dumps({"status": "error", "error": str(error)}, ensure_ascii=False, indent=2))
            raise SystemExit(1)



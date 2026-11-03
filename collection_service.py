"""Local collection storage, validated HDT import and public card catalogue."""
from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import threading
from uuid import uuid4
import urllib.error
import urllib.request
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from functools import cached_property
from pathlib import Path

from data_directory import prepare_data_directory
from persistent_files import migrate_directory_contents

RESOURCE_ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
MAX_IMPORT_BYTES = 20 * 1024 * 1024
PLAYABLE_TYPES = {'MINION', 'SPELL', 'WEAPON', 'HERO', 'LOCATION'}
EXCLUDED_SETS = {'HERO_SKINS', 'PLACEHOLDER_202204', 'CORE_HIDDEN', 'VANILLA'}
HSREPLAY_SNAPSHOT_PREFIX = 'deck-dust-hsreplay-'


def packrecord_directory(root: Path | None = None, data_dir: Path | None = None) -> Path:
    """Return persistent storage for rolling HSReplay collection snapshots."""
    if getattr(sys, 'frozen', False):
        legacy_directory = Path(sys.executable).resolve().parent / 'packrecord'
    else:
        legacy_directory = Path(root or RESOURCE_ROOT).resolve() / 'packrecord'
    directory = prepare_data_directory(data_dir) / 'packrecord'
    directory.mkdir(parents=True, exist_ok=True)
    migrate_directory_contents(legacy_directory, directory)
    return directory


def normalize_collection(raw: object) -> dict[str, list[int]]:
    if not isinstance(raw, dict) or not isinstance(raw.get('collection'), dict):
        raise ValueError('收藏文件必须包含 collection 对象，请选择 HDT/HSReplay 导出的 JSON 文件。')
    entries = raw['collection']
    if not entries:
        raise ValueError('收藏数据为空，已保留现有收藏。')
    result = {}
    for dbf_id, values in entries.items():
        if not isinstance(dbf_id, str) or not re.fullmatch(r'[1-9]\d{0,9}', dbf_id):
            raise ValueError(f'收藏中存在无效卡牌 ID：{str(dbf_id)[:30]}。')
        if not isinstance(values, list) or not 1 <= len(values) <= 16:
            raise ValueError(f'卡牌 {dbf_id} 的数量必须是含 1 至 16 项的数组。')
        if any(type(value) is not int or not 0 <= value <= 1_000_000 for value in values):
            raise ValueError(f'卡牌 {dbf_id} 包含无效数量，数量必须是非负整数。')
        result[dbf_id] = values + [0] * max(0, 4 - len(values))
    if not any(any(values[:4]) for values in result.values()):
        raise ValueError('文件中没有已拥有卡牌，已保留现有收藏。')
    return result


class CollectionStore:
    def __init__(self, root: Path = RESOURCE_ROOT, data_dir: Path | None = None):
        self.root = root
        self.data_dir = prepare_data_directory(data_dir)
        self.snapshot_dir = packrecord_directory(root, self.data_dir)
        self.db_path = self.data_dir / 'collection.sqlite3'
        self.lock = threading.RLock()
        with self.connect() as conn:
            conn.executescript('''
                CREATE TABLE IF NOT EXISTS owned_cards (dbf_id TEXT PRIMARY KEY, counts TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS import_history (
                    id INTEGER PRIMARY KEY, imported_at TEXT NOT NULL, source TEXT NOT NULL,
                    card_types INTEGER NOT NULL, snapshot TEXT NOT NULL
                );
            ''')
        # Only the source checkout may seed from local user files. Builds carry no collection data.
        if not getattr(sys, 'frozen', False) and not self.read()['collection']:
            source = self.root / 'collection_export.json'
            if source.exists():
                try:
                    self.replace(json.loads(source.read_text(encoding='utf-8-sig')), '现有收藏文件')
                except (ValueError, OSError):
                    pass

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.db_path, timeout=20)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    @cached_property
    def catalog(self):
        source = self.root / 'hearthstone_cards_latest.json'
        if not source.exists():
            source = self.root / 'hearthstone_cards_cache.json'
        raw = json.loads(source.read_text(encoding='utf-8-sig'))
        cards = []
        for card in raw:
            if not card.get('collectible') or card.get('set') in EXCLUDED_SETS or card.get('type') not in PLAYABLE_TYPES:
                continue
            if not card.get('dbfId') or not card.get('rarity'):
                continue
            fields = ('id', 'dbfId', 'name', 'cost', 'cardClass', 'classes', 'rarity', 'set', 'type',
                      'text', 'flavor', 'attack', 'health', 'durability', 'races', 'spellSchool', 'elite')
            cards.append({key: card[key] for key in fields if key in card})
        return cards

    @cached_property
    def card_reference_map(self):
        """Small, on-demand lookup for non-collectible cards referenced by deck codes."""
        source = self.root / 'hearthstone_cards_latest.json'
        if not source.exists():
            source = self.root / 'hearthstone_cards_cache.json'
        raw = json.loads(source.read_text(encoding='utf-8-sig'))
        fields = ('id', 'dbfId', 'name', 'cost', 'cardClass', 'classes', 'rarity', 'set', 'type', 'races')
        return {card['dbfId']: {key: card[key] for key in fields if key in card}
                for card in raw if type(card.get('dbfId')) is int and card.get('type') in PLAYABLE_TYPES}

    def lookup_cards(self, identifiers):
        return [self.card_reference_map[identifier] for identifier in identifiers if identifier in self.card_reference_map]

    def read(self):
        with self.lock, self.connect() as conn:
            collection = {key: json.loads(value) for key, value in conn.execute('SELECT dbf_id, counts FROM owned_cards')}
            meta = {key: json.loads(value) for key, value in conn.execute('SELECT key, value FROM metadata')}
            backup = (self.data_dir / 'collection.previous.sqlite3').exists()
        return {'collection': collection, 'meta': meta, 'hasBackup': backup}

    def replace(self, raw: object, source: str, imported_at: str | None = None):
        collection = normalize_collection(raw)
        meta = {
            'importedAt': imported_at or datetime.now(timezone.utc).isoformat(), 'source': source[:120],
            'lastModified': raw.get('lastModified') if isinstance(raw.get('lastModified'), str) else None,
            'dust': raw.get('dust') if type(raw.get('dust')) is int and raw['dust'] >= 0 else None,
        }
        with self.lock, self.connect() as conn:
            if conn.execute('SELECT 1 FROM owned_cards LIMIT 1').fetchone():
                backup_path = self.data_dir / 'collection.previous.sqlite3'
                with closing(sqlite3.connect(backup_path)) as backup:
                    conn.backup(backup)
            conn.execute('DELETE FROM owned_cards')
            conn.executemany('INSERT INTO owned_cards VALUES (?, ?)',
                             ((key, json.dumps(value)) for key, value in collection.items()))
            conn.execute('DELETE FROM metadata')
            conn.executemany('INSERT INTO metadata VALUES (?, ?)',
                             ((key, json.dumps(value, ensure_ascii=False)) for key, value in meta.items()))
            conn.execute('INSERT INTO import_history(imported_at, source, card_types, snapshot) VALUES (?, ?, ?, ?)',
                         (meta['importedAt'], source[:120], len(collection), json.dumps(meta, ensure_ascii=False)))
        return self.read()

    def save_hsreplay_snapshot(self, raw: object) -> str:
        """Atomically keep the newest valid HSReplay JSON beside the app executable."""
        collection = normalize_collection(raw)
        saved_at = datetime.now(timezone.utc).isoformat()
        snapshot = {'collection': collection, 'snapshotSavedAt': saved_at}
        if isinstance(raw, dict):
            if isinstance(raw.get('lastModified'), str):
                snapshot['lastModified'] = raw['lastModified']
            if type(raw.get('dust')) is int and raw['dust'] >= 0:
                snapshot['dust'] = raw['dust']
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        filename_time = datetime.now().astimezone().strftime('%Y%m%d-%H%M%S-%f')
        target = self.snapshot_dir / f'{HSREPLAY_SNAPSHOT_PREFIX}{filename_time}.json'
        temporary = target.with_name(target.name + f'.{uuid4().hex}.tmp')
        try:
            temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
        for older in self.snapshot_dir.glob(f'{HSREPLAY_SNAPSHOT_PREFIX}*.json'):
            if older != target and older.is_file():
                older.unlink()
        return saved_at

    def load_hsreplay_snapshot(self):
        """Read the newest valid snapshot created by this application."""
        try:
            files = sorted(self.snapshot_dir.glob(f'{HSREPLAY_SNAPSHOT_PREFIX}*.json'), reverse=True)
        except OSError:
            return None
        for path in files:
            try:
                if path.stat().st_size > MAX_IMPORT_BYTES:
                    continue
                raw = json.loads(path.read_text(encoding='utf-8-sig'))
                normalize_collection(raw)
                saved_at = raw.get('snapshotSavedAt') if isinstance(raw, dict) else None
                if not isinstance(saved_at, str):
                    saved_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
                return raw, saved_at
            except (OSError, ValueError, UnicodeError):
                continue
        return None

    def restore(self):
        backup = self.data_dir / 'collection.previous.sqlite3'
        if not backup.exists():
            raise ValueError('还没有可恢复的收藏备份。')
        with self.lock, closing(sqlite3.connect(backup)) as previous, self.connect() as current:
            previous.backup(current)
        return self.read()

    def import_local(self):
        path = self.root / 'collection_export.json'
        if not path.exists():
            raise ValueError('未找到本地收藏文件，请使用“导入收藏”选择 HDT 导出的 JSON。')
        return self.replace(json.loads(path.read_text(encoding='utf-8-sig')), '本地收藏文件')

    def sync_hsreplay(self, account: str, region: int, cookie: str, user_agent: str | None = None):
        if not re.fullmatch(r'\d{1,14}', account) or region not in (1, 2, 3, 5):
            raise ValueError('保存的 HSReplay 账号无效，请重新登录。')
        cookie = cookie.strip()
        if not cookie or '\n' in cookie or '\r' in cookie:
            raise ValueError('登录会话无效，请重新登录 HSReplay。')
        url = f'https://hsreplay.net/api/v1/collection/?region={region}&account_lo={account}&type=CONSTRUCTED'
        request = urllib.request.Request(url, headers={
            'User-Agent': user_agent or 'Mozilla/5.0 DeckDust/0.1', 'Referer': 'https://hsreplay.net/collection/mine/',
            'Cookie': cookie,
        })
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read(MAX_IMPORT_BYTES + 1)
            if len(payload) > MAX_IMPORT_BYTES:
                raise ValueError('远端收藏数据超过 20 MB，请使用文件导入。')
            raw = json.loads(payload.decode('utf-8-sig'))
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                raise ValueError('HSReplay 登录已失效或拒绝访问，请重新登录。') from None
            raise ValueError(f'HSReplay 返回 HTTP {error.code}，现有收藏已保留。') from None
        except (urllib.error.URLError, TimeoutError):
            raise ValueError('无法连接 HSReplay，现有收藏已保留，请稍后重试。') from None
        except (ValueError, UnicodeError):
            raise ValueError('HSReplay 没有返回有效的收藏 JSON，现有收藏已保留。') from None
        self.save_hsreplay_snapshot(raw)
        return self.replace(raw, 'HSReplay 同步')


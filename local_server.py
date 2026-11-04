"""Shared loopback API and built frontend host for preview and desktop."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from collection_service import CollectionStore, MAX_IMPORT_BYTES, RESOURCE_ROOT
from hsreplay_auth import HSReplayAuth
from deck_service import DeckStore
from pack_service import PackStore
from pack_monitor import PackMonitor, detect_log_path
from cloud_backup import CloudBackup
from deck_export_directory import deck_export_directory

DISCONNECTED = (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)


class CardArtCache:
    def __init__(self, data_dir: Path):
        self.root = data_dir / 'card-art'
        self.root.mkdir(parents=True, exist_ok=True)
        self.slots = threading.BoundedSemaphore(4)
        self.lock = threading.Lock()

    def cached(self, card_id: str, quality: str):
        if not re.fullmatch(r'[A-Za-z0-9_]{1,90}', card_id) or quality not in ('normal', 'golden', 'diamond', 'signature', 'tile', 'strip'):
            raise ValueError('无效卡牌图片。')
        suffixes = {'normal': '.png', 'golden': '_golden.png', 'diamond': '_diamond.png',
                    'signature': '_signature.png', 'tile': '_tile.jpg', 'strip': '_strip.webp'}
        file = self.root / f'{card_id}{suffixes[quality]}'
        if file.is_file():
            return file, quality
        if quality == 'strip':
            tile = self.root / f'{card_id}_tile.jpg'
            if tile.is_file():
                return tile, 'tile'
        if quality in ('golden', 'diamond', 'signature'):
            missing = file.with_suffix('.missing')
            normal = self.root / f'{card_id}.png'
            if missing.exists() and time.time() - missing.stat().st_mtime < 86400 and normal.is_file():
                return normal, 'normal'
        return None, quality

    def get(self, card_id: str, quality: str):
        cached = self.cached(card_id, quality)
        if cached[0]:
            return cached
        if quality == 'strip':
            file = self.root / f'{card_id}_strip.webp'
            failed = file.with_suffix('.missing')
            if file.exists():
                return file, quality
            if not failed.exists() or time.time() - failed.stat().st_mtime >= 86400:
                with self.slots:
                    cached = self.cached(card_id, quality)
                    if cached[0]:
                        return cached
                    try:
                        req = urllib.request.Request(f'https://art.hearthstonejson.com/v1/tiles/{card_id}.webp', headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req, timeout=7) as response:
                            content = response.read(1024 * 1024)
                        if content[:4] == b'RIFF' and content[8:12] == b'WEBP':
                            with self.lock:
                                temp = file.with_suffix('.tmp')
                                temp.write_bytes(content)
                                temp.replace(file)
                            return file, quality
                    except urllib.error.HTTPError as error:
                        if error.code == 404:
                            failed.touch()
                    except (urllib.error.URLError, TimeoutError, OSError):
                        pass
            return self.get(card_id, 'tile')
        if quality == 'tile':
            file = self.root / f'{card_id}_tile.jpg'
            if file.exists():
                return file, quality
            with self.slots:
                if file.exists():
                    return file, quality
                try:
                    req = urllib.request.Request(f'https://art.hearthstonejson.com/v1/256x/{card_id}.jpg', headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=7) as response:
                        content = response.read(1024 * 1024)
                    if content.startswith(b'\xff\xd8'):
                        with self.lock:
                            temp = file.with_suffix('.tmp')
                            temp.write_bytes(content)
                            temp.replace(file)
                        return file, quality
                except (urllib.error.URLError, TimeoutError, OSError):
                    pass
            return None, quality
        suffixes = {'normal': '', 'golden': '_golden', 'diamond': '_diamond', 'signature': '_signature'}
        for variant in dict.fromkeys([quality, 'normal']):
            file = self.root / f'{card_id}{suffixes[variant]}.png'
            if file.exists():
                return file, variant
            failed = file.with_suffix('.missing')
            if failed.exists() and time.time() - failed.stat().st_mtime < 86400:
                continue
            with self.slots:
                if file.exists():
                    return file, variant
                url = f'https://static.firestoneapp.com/cards/zhCN/512/{card_id}{suffixes[variant]}.png'
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=7) as response:
                        content = response.read(4 * 1024 * 1024)
                    if not content.startswith(b'\x89PNG\r\n\x1a\n'):
                        continue
                    with self.lock:
                        temp = file.with_suffix('.tmp')
                        temp.write_bytes(content)
                        temp.replace(file)
                    return file, variant
                except urllib.error.HTTPError as error:
                    if error.code == 404:
                        failed.touch()
                except (urllib.error.URLError, TimeoutError, OSError):
                    continue
        return None, 'normal'


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, store: CollectionStore, art: CardArtCache, auth: HSReplayAuth, packs: PackStore, monitor: PackMonitor, cloud_backup: CloudBackup, export_dir: Path, **kwargs):
        self.store = store
        self.art = art
        self.auth = auth
        self.packs = packs
        self.monitor = monitor
        self.cloud_backup = cloud_backup
        self.export_dir = export_dir
        self.decks = DeckStore(store.data_dir)
        self.app_root = store.root / 'web-dist'
        super().__init__(*args, directory=str(self.app_root), **kwargs)

    def log_message(self, _format, *args):
        pass

    def end_headers(self):
        path = urlparse(self.path).path
        if path == '/' or path.endswith(('.html', '.js', '.css')):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, value, status=200):
        payload = json.dumps(value, ensure_ascii=False).encode('utf-8')
        try:
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except DISCONNECTED:
            pass

    def send_file(self, path: Path, content_type=None, headers=None):
        self.send_response(200)
        self.send_header('Content-Type', content_type or mimetypes.guess_type(path)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(path.stat().st_size))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(path.read_bytes())

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == '/api/packs/status':
                self.send_json({'revision': self.packs.revision(), 'monitor': self.monitor.status()})
            elif path == '/api/packs':
                self.send_json({**self.packs.read(), 'monitor': self.monitor.status()})
            elif path == '/api/decks':
                self.send_json(self.decks.read())
            elif path == '/api/deck-exports':
                name = parse_qs(urlparse(self.path).query).get('name', [''])[0]
                if name:
                    target = self._deck_export_path(name, ('.json',))
                    if not target.is_file():
                        self.send_json({'error': '导出文件夹中找不到这个 JSON 文件。'}, 404)
                        return
                    self.send_json({'name': name, 'text': target.read_text(encoding='utf-8-sig')})
                else:
                    files = sorted(path.name for path in self.export_dir.glob('*.json') if path.is_file())
                    self.send_json({'files': files})
            elif path == '/api/catalog':
                self.send_json({'cards': self.store.catalog})
            elif path == '/api/cards/lookup':
                raw_ids = parse_qs(urlparse(self.path).query).get('ids', [''])[0]
                if not raw_ids or not re.fullmatch(r'[1-9]\d{0,9}(,[1-9]\d{0,9}){0,99}', raw_ids):
                    raise ValueError('卡牌资料查询 ID 无效。')
                self.send_json({'cards': self.store.lookup_cards([int(value) for value in raw_ids.split(',')])})
            elif path == '/api/collection':
                self.send_json(self.store.read())
            elif path == '/api/hsreplay/status':
                self.send_json(self.auth.status())
            elif path == '/api/collection/export':
                payload = self.store.read()
                meta = payload['meta']
                exported = {'collection': payload['collection'], 'lastModified': meta.get('lastModified')}
                if meta.get('dust') is not None:
                    exported['dust'] = meta['dust']
                self.send_json(exported)
            elif path.startswith('/api/art/'):
                parts = path.split('/')
                if len(parts) != 5:
                    raise ValueError('无效图片路径。')
                cached_only = parse_qs(urlparse(self.path).query).get('cached') == ['1']
                file, quality = self.art.cached(parts[3], parts[4]) if cached_only else self.art.get(parts[3], parts[4])
                if file:
                    self.send_file(file, 'image/webp' if quality == 'strip' else 'image/jpeg' if quality == 'tile' else 'image/png', {'Cache-Control': 'public, max-age=86400', 'X-Art-Quality': quality})
                else:
                    self.send_json({'error': '卡面暂不可用'}, 404)
            elif path == '/api/health':
                self.send_json({'status': 'ok', 'frontendReady': (self.app_root / 'index.html').exists(),
                                'dataDirectory': str(self.store.data_dir.resolve()),
                                'packsDatabase': str(self.packs.db_path.resolve())})
            elif path == '/api/cloud-backup/status':
                self.send_json(self.cloud_backup.status())
            elif path.startswith('/api/'):
                self.send_json({'error': '接口不存在'}, 404)
            elif not (self.app_root / 'index.html').exists():
                self.send_json({'error': '界面尚未构建，请先运行 npm install 和 npm run build。'}, 503)
            else:
                super().do_GET()
        except ValueError as error:
            self.send_json({'error': str(error)}, 400)
        except DISCONNECTED:
            pass
        except (OSError, sqlite3.Error):
            self.send_json({'error': '无法读取本地数据，请重试。'}, 500)

    def do_POST(self):
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self.send_json({'error': '不接受跨站请求'}, 403)
            return
        if urlparse(self.path).path == '/api/deck-exports':
            self._save_deck_export()
            return
        if self.headers.get_content_type() != 'application/json':
            self.send_json({'error': '请发送 JSON 数据'}, 415)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_IMPORT_BYTES:
                self.send_json({'error': '文件为空或超过 20 MB。'}, 413)
                return
            body = json.loads(self.rfile.read(length).decode('utf-8-sig'))
            if not isinstance(body, dict):
                raise ValueError('请求必须是 JSON 对象。')
            route = urlparse(self.path).path
            if route == '/api/deck-exports/open':
                self.export_dir.mkdir(parents=True, exist_ok=True)
                os.startfile(str(self.export_dir.resolve()))
                result = {'opened': True}
            elif route == '/api/packs/record/save':
                result = self.packs.save_record(body.get('record'))
            elif route == '/api/packs/record/delete':
                result = self.packs.delete_record(body.get('id'), body.get('revision'))
            elif route == '/api/packs/expansion/save':
                result = self.packs.save_expansion(body)
            elif route == '/api/packs/settings':
                result = self.packs.save_settings(body)
            elif route == '/api/packs/detect':
                result = detect_log_path()
            elif route == '/api/packs/monitor':
                result = self.monitor.start() if body.get('enabled') is True else self.monitor.stop()
            elif route == '/api/packs/confirm':
                result = self.packs.confirm(body.get('ids'), body.get('expansionId'))
            elif route == '/api/packs/discard':
                result = self.packs.confirm(body.get('ids'), None, discard=True)
            elif route == '/api/packs/import':
                result = self.packs.import_legacy(body.get('path', ''))
            elif route == '/api/decks/save':
                result = self.decks.save(body.get('deck'))
            elif route == '/api/decks/import':
                result = self.decks.import_decks(body.get('decks'))
            elif route == '/api/decks/delete':
                result = self.decks.delete(body.get('id'))
            elif route == '/api/collection/import':
                result = self.store.replace(body.get('data'), str(body.get('source', 'HDT 文件导入')))
            elif route == '/api/collection/reload':
                result = self.store.import_local()
            elif route == '/api/collection/restore':
                result = self.store.restore()
            elif route == '/api/collection/sync':
                result = self.auth.sync()
            elif route == '/api/hsreplay/login':
                result = self.auth.begin()
            elif route == '/api/hsreplay/disconnect':
                result = self.auth.disconnect()
            else:
                self.send_json({'error': '接口不存在'}, 404)
                return
            if route in {
                '/api/packs/record/save', '/api/packs/record/delete', '/api/packs/expansion/save',
                '/api/packs/settings', '/api/packs/confirm', '/api/packs/discard', '/api/packs/import',
                '/api/packs/monitor',
                '/api/decks/save', '/api/decks/import', '/api/decks/delete', '/api/collection/import',
                '/api/collection/reload', '/api/collection/restore', '/api/collection/sync',
            }:
                self.cloud_backup.schedule(route)
            self.send_json(result)
        except DISCONNECTED:
            pass
        except (ValueError, UnicodeError, TypeError) as error:
            self.send_json({'error': str(error)}, 400)
        except (OSError, sqlite3.Error):
            self.send_json({'error': '本地收藏保存失败，已有数据已保留。'}, 500)

    def _deck_export_path(self, name: str, extensions=('.json', '.png')) -> Path:
        if (not isinstance(name, str) or len(name) > 120 or Path(name).name != name
                or not re.fullmatch(r'[^<>:"/\\|?*\x00-\x1f]+', name)
                or Path(name).suffix.lower() not in extensions):
            raise ValueError('导出文件名无效。')
        directory = self.export_dir.resolve()
        target = (directory / name).resolve()
        if target.parent != directory:
            raise ValueError('导出文件路径无效。')
        return target

    def _save_deck_export(self) -> None:
        try:
            name = parse_qs(urlparse(self.path).query).get('name', [''])[0]
            target = self._deck_export_path(name)
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 20 * 1024 * 1024:
                self.send_json({'error': '导出文件为空或超过 20 MB。'}, 413)
                return
            content_type = self.headers.get_content_type()
            expected_type = 'image/png' if target.suffix.lower() == '.png' else 'application/json'
            if content_type != expected_type:
                self.send_json({'error': '导出文件格式与扩展名不一致。'}, 415)
                return
            content = self.rfile.read(length)
            if len(content) != length:
                self.send_json({'error': '导出文件未完整接收。'}, 400)
                return
            if target.suffix.lower() == '.png' and not content.startswith(b'\x89PNG\r\n\x1a\n'):
                self.send_json({'error': 'PNG 文件数据无效。'}, 400)
                return
            temporary = target.with_name(f'.{target.name}.tmp')
            temporary.write_bytes(content)
            temporary.replace(target)
            self.send_json({'name': target.name})
        except (ValueError, OSError) as error:
            self.send_json({'error': str(error) or '无法写入套牌导出文件夹。'}, 400)


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def server_close(self):
        if hasattr(self, 'pack_monitor'):
            self.pack_monitor.close()
        if hasattr(self, 'cloud_backup'):
            self.cloud_backup.close()
        super().server_close()


def create_server(port: int, root: Path = RESOURCE_ROOT, data_dir: Path | None = None, export_dir: Path | None = None):
    store = CollectionStore(root, data_dir)
    packs = PackStore(store.data_dir, store.catalog)
    cloud_backup = CloudBackup(store.data_dir)
    monitor = PackMonitor(packs, on_change=lambda: cloud_backup.schedule('new pack events detected'))
    try:
        server = LocalServer(('127.0.0.1', port), partial(AppHandler, store=store, art=CardArtCache(store.data_dir), auth=HSReplayAuth(store), packs=packs, monitor=monitor, cloud_backup=cloud_backup, export_dir=export_dir or deck_export_directory()))
    except Exception:
        monitor.close()
        raise
    server.pack_monitor = monitor
    server.cloud_backup = cloud_backup
    cloud_backup.schedule('application started')
    return server


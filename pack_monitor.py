"""Read-only incremental Net.log watcher with durable cursors and confirmation queue."""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
from pathlib import Path

from pack_service import encode, now

CARD_CHANGE = re.compile(r'collection version\s+(\d+)\)(?:(?!collection version).)*?AssetCardId:\s*(\d+)(?:(?!collection version).)*?Premium:\s*(\d+)(?=\s|[,;])', re.S)


def detect_log_path():
    candidates = []
    if os.name == 'nt':
        import winreg
        for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            for key in (r'SOFTWARE\WOW6432Node\Blizzard Entertainment\Hearthstone', r'SOFTWARE\Blizzard Entertainment\Hearthstone'):
                try:
                    with winreg.OpenKey(hive, key) as registry:
                        for value in ('InstallPath', 'InstallLocation'):
                            try:
                                candidates.append(Path(winreg.QueryValueEx(registry, value)[0]) / 'Logs')
                            except OSError:
                                pass
                except OSError:
                    pass
    for root in (os.environ.get('PROGRAMFILES', ''), os.environ.get('PROGRAMFILES(X86)', ''), 'C:/Games', 'D:/Games', 'D:/Battle.net', 'D:/Battel.net/Heath Stone', 'E:/Games', 'F:/Games'):
        if root:
            candidates.append(Path(root) / 'Hearthstone' / 'Logs')
    for candidate in candidates:
        if candidate.is_dir():
            return {'path': str(candidate.resolve()), 'found': True}
    return {'path': '', 'found': False, 'message': '未找到炉石 Logs 目录，请从战网定位安装位置后手动选择。'}


class PackMonitor:
    def __init__(self, store, start_thread=True, on_change=None):
        self.store = store
        self.on_change = on_change or (lambda: None)
        self.enabled = False
        self.phase = 'stopped'
        self.message = '监控未开启'
        self.stop_event = threading.Event()
        self.lock = threading.RLock()
        self.thread = None
        if start_thread:
            self.thread = threading.Thread(target=self._run, name='deck-dust-pack-monitor', daemon=True)
            self.thread.start()
            if store.settings().get('autostart'):
                try:
                    self.start()
                except ValueError as error:
                    self.phase, self.message = 'error', str(error)

    def status(self):
        with self.lock:
            return {'enabled': self.enabled, 'phase': self.phase, 'message': self.message}

    def target(self):
        path = Path(self.store.settings()['path'])
        if not path.is_dir():
            raise ValueError('日志路径失效，请重新选择 Logs 目录。')
        files = list(path.glob('Hearthstone_*/Net.log'))
        if (path / 'Net.log').is_file():
            files.append(path / 'Net.log')
        return max(files, key=lambda file: (file.stat().st_mtime_ns, str(file)), default=None)

    def _key(self, file):
        return hashlib.sha256((str(file.resolve()) + ':' + str(getattr(file.stat(), 'st_birthtime_ns', file.stat().st_ino))).encode()).hexdigest()

    def start(self):
        with self.lock:
            if self.enabled:
                return self.status()
            if not self.store.settings()['path']:
                detection = detect_log_path()
                if not detection['found']:
                    raise ValueError(detection['message'])
                self.store.save_settings({**self.store.settings(), 'path': detection['path']})
            file = self.target()
            if file:
                # First activation starts at EOF; restarting an existing session resumes its saved cursor.
                key = self._key(file)
                with self.store.lock, self.store.connect() as db:
                    db.execute('INSERT OR IGNORE INTO log_cursors VALUES (?,?)', (key, encode({'offset': file.stat().st_size, 'tail': '', 'versions': {}})))
            self.enabled = True
            self.phase, self.message = ('watching', '正在监听开包日志') if file else ('waiting', '等待游戏生成 Net.log')
        return self.status()

    def stop(self):
        with self.lock:
            self.enabled, self.phase, self.message = False, 'stopped', '监控已停止，待确认卡包仍保留'
        return self.status()

    def close(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=3)

    def _run(self):
        while not self.stop_event.wait(2):
            if self.enabled:
                try:
                    self.scan_once()
                except (OSError, ValueError) as error:
                    with self.lock:
                        self.phase, self.message = 'error', str(error)
                except Exception:
                    with self.lock:
                        self.phase, self.message = 'error', '日志读取失败，游标和待确认卡包已保留。'

    def scan_once(self):
        found_new_event = False
        with self.lock:
            file = self.target()
            if not file:
                self.phase, self.message = 'waiting', '等待游戏生成 Net.log'
                return
            key = self._key(file)
            with self.store.lock, self.store.connect() as db:
                row = db.execute('SELECT value FROM log_cursors WHERE id=?', (key,)).fetchone()
                state = json.loads(row[0]) if row else {'offset': 0, 'tail': '', 'versions': {}}
                size = file.stat().st_size
                if size < state['offset']:
                    state = {'offset': 0, 'tail': '', 'versions': {}}
                with file.open('rb') as stream:
                    stream.seek(state['offset'])
                    content = stream.read(4 * 1024 * 1024)
                    state['offset'] = stream.tell()
                text = state['tail'] + content.decode('utf-8', errors='replace')
                consumed = 0
                for match in CARD_CHANGE.finditer(text):
                    version, dbf, premium = match.groups()
                    info = state['versions'].setdefault(version, {'cards': [], 'emitted': 0})
                    info['cards'].append({'card_id': int(dbf), 'premium': int(premium)})
                    consumed = match.end()
                    while len(info['cards']) >= 5:
                        cards, info['cards'] = info['cards'][:5], info['cards'][5:]
                        info['emitted'] += 1
                        event_id = f'log-{key}-{version}_{info["emitted"]}'
                        found_new_event = db.execute('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?,?,?)', (event_id, f'{version}_{info["emitted"]}', now(), encode(cards), 'pending', None, None, 'log', encode({'file': str(file), 'version': version, 'index': info['emitted']}))).rowcount > 0 or found_new_event
                tail = text[consumed:]
                # Only incomplete card-change context is needed, not the entire unrelated game log.
                marker = tail.rfind('collection version')
                state['tail'] = tail[marker:] if marker >= 0 else tail[-100:]
                if len(state['tail']) > 1024 * 1024:
                    raise ValueError('日志事件过长，已暂停本次读取以保留原始游标。')
                db.execute('INSERT OR REPLACE INTO log_cursors VALUES (?,?)', (key, encode(state)))
            self.phase, self.message = 'watching', f'正在监听 {file.parent.name}/Net.log'
        if found_new_event:
            self.on_change()



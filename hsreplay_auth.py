"""User initiated HSReplay sign-in, protected session storage and repeat sync."""
from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys
import threading
from ctypes import wintypes
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from uuid import uuid4


def collection_identity(url: str):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != 'hsreplay.net' or parsed.path.rstrip('/') != '/api/v1/collection':
        return None
    values = parse_qs(parsed.query)
    account = values.get('account_lo', [''])[0]
    region = values.get('region', [''])[0]
    if not account.isdigit() or not 1 <= len(account) <= 14 or region not in ('1', '2', '3', '5'):
        return None
    if values.get('type', ['CONSTRUCTED'])[0] != 'CONSTRUCTED':
        return None
    return {'account': account, 'region': int(region)}


def process_alive(pid):
    if type(pid) is not int or pid <= 0 or os.name != 'nt':
        return False
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return False
    try:
        result = wintypes.DWORD()
        return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(result))) and result.value == 259
    finally:
        kernel.CloseHandle(handle)


def protect(data: bytes, decrypt=False) -> bytes:
    if os.name != 'nt':
        raise OSError('保存登录会话需要 Windows 安全存储。')
    class Blob(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    destination = Blob()
    crypt = ctypes.WinDLL('crypt32', use_last_error=True)
    free = ctypes.WinDLL('kernel32', use_last_error=True).LocalFree
    free.argtypes = [ctypes.c_void_p]
    free.restype = ctypes.c_void_p
    if decrypt:
        fn = crypt.CryptUnprotectData
        description = None
    else:
        fn = crypt.CryptProtectData
        description = 'Deck Dust HSReplay'
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p if decrypt else wintypes.LPCWSTR,
                   ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    fn.restype = wintypes.BOOL
    if not fn(ctypes.byref(source), description, None, None, None, 1, ctypes.byref(destination)):
        raise OSError('无法读取本机保存的登录会话，请重新登录 HSReplay。')
    try:
        return ctypes.string_at(destination.data, destination.size)
    finally:
        free(destination.data)


def atomic_write(path: Path, payload: bytes):
    temporary = path.with_name(path.name + '.' + uuid4().hex + '.tmp')
    temporary.write_bytes(payload)
    temporary.replace(path)


class SessionVault:
    def __init__(self, data_dir: Path):
        self.root = data_dir
        self.path = data_dir / 'hsreplay-session.bin'
        self.status_path = data_dir / 'hsreplay-status.json'

    def save(self, session):
        atomic_write(self.path, protect(json.dumps(session).encode('utf-8')))

    def load(self):
        if not self.path.exists():
            return None
        try:
            session = json.loads(protect(self.path.read_bytes(), decrypt=True))
            if not isinstance(session, dict) or not isinstance(session.get('cookie'), str):
                return None
            return session
        except (ValueError, OSError):
            return None

    def write_status(self, phase, message='', **extra):
        state = {'phase': phase, 'message': message, 'revision': uuid4().hex, 'ownerPid': os.getpid(), **extra}
        atomic_write(self.status_path, json.dumps(state, ensure_ascii=False).encode('utf-8'))
        return state

    def read_status(self):
        try:
            state = json.loads(self.status_path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            state = {'phase': 'connected' if self.path.exists() else 'disconnected', 'message': ''}
        return state

    def status(self):
        state = self.read_status()
        return {key: state[key] for key in ('phase', 'message', 'revision', 'region', 'lastSyncedAt', 'accountName', 'expiresAt') if key in state}


class HSReplayAuth:
    def __init__(self, store):
        self.store = store
        self.vault = SessionVault(store.data_dir)
        self.child = None
        self.lock = threading.RLock()

    def status(self):
        state = self.vault.read_status()
        session = self.vault.load()
        if session and session.get('region') != 5:
            return {'phase': 'wrong_region', 'message': '当前保存的是外服账号。Deck Dust 现在只同步炉石中国服务器；请先断开外服账号，再登录国服。', 'region': session.get('region')}
        if session:
            state.update({key: session[key] for key in ('accountName', 'expiresAt') if session.get(key)})
            if session.get('expiresAt'):
                try:
                    expiry = datetime.fromisoformat(session['expiresAt'])
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry <= datetime.now(timezone.utc):
                        state = self.vault.write_status('expired', 'HSReplay 登录会话已到期，请重新登录。',
                                                        region=5, accountName=session.get('accountName', ''),
                                                        expiresAt=session['expiresAt'],
                                                        lastSyncedAt=state.get('lastSyncedAt'))
                except (TypeError, ValueError):
                    pass
        if self.child is not None and self.child.poll() is not None and state['phase'] in ('waiting', 'opening', 'importing'):
            state = self.vault.write_status('cancelled', '登录窗口已关闭，尚未完成连接。')
        # A previous run may have been closed while a sign-in window was open.
        if self.child is None and state['phase'] in ('waiting', 'opening', 'importing') and not process_alive(state.get('ownerPid')):
            self.vault.write_status('disconnected', '请重新打开登录窗口。')
        status = self.vault.status()
        if session:
            status.update({key: session[key] for key in ('accountName', 'expiresAt') if session.get(key)})
            status.setdefault('region', session.get('region'))
        status['hasCollectionSnapshot'] = self.store.load_hsreplay_snapshot() is not None
        return status

    def _use_collection_snapshot(self, session, reason):
        snapshot = self.store.load_hsreplay_snapshot()
        if snapshot is None:
            return None
        raw, saved_at = snapshot
        result = self.store.replace(raw, 'HSReplay 离线快照', imported_at=saved_at)
        message = f'{reason} 已载入本地最近一次 HSReplay 收藏快照。'
        state = self.vault.read_status()
        phase = 'expired' if state.get('phase') == 'expired' else 'connected'
        self.vault.write_status(phase, message, region=5,
                                accountName=session.get('accountName', ''),
                                expiresAt=session.get('expiresAt'), lastSyncedAt=saved_at)
        result['syncFallback'] = {'savedAt': saved_at, 'reason': reason}
        return result

    def begin(self):
        with self.lock:
            if self.child is not None and self.child.poll() is None:
                return self.status()
            state = self.status()
            if state['phase'] in ('waiting', 'opening', 'importing'):
                return state
            self.vault.write_status('opening', '正在打开 HSReplay 官方登录窗口…')
            command = [sys.executable]
            if getattr(sys, 'frozen', False):
                command += ['--hsreplay-login']
            else:
                command += [str(Path(__file__).with_name('hsreplay_login.py'))]
            command += ['--data-dir', str(self.store.data_dir)]
            try:
                self.child = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                              creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            except OSError:
                return self.vault.write_status('error', '无法打开登录窗口，请检查 WebView2 是否已安装。')
            return self.status()

    def disconnect(self):
        with self.lock:
            if (self.child is not None and self.child.poll() is None) or self.status()['phase'] in ('opening', 'waiting', 'importing'):
                raise ValueError('请先关闭 HSReplay 登录窗口，再解除连接。')
            self.vault.path.unlink(missing_ok=True)
            (self.store.data_dir / 'hsreplay-logout.pending').touch()
            return self.vault.write_status('disconnected', '已移除保存的登录会话。')

    def sync(self):
        with self.lock:
            session = self.vault.load()
            if not session:
                self.vault.write_status('expired', '请先登录 HSReplay。')
                raise ValueError('请先登录 HSReplay，程序会自动获取收藏。')
            if session.get('region') != 5:
                self.vault.write_status('wrong_region', '当前保存的是外服账号。此处只同步炉石中国服务器（region=5）。', region=session.get('region'))
                raise ValueError('当前连接的是外服账号；为避免同步错区，请先解除连接并登录国服账号。')
            if session.get('expiresAt'):
                try:
                    expiry = datetime.fromisoformat(session['expiresAt'])
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                except (TypeError, ValueError):
                    expiry = None
                if expiry and expiry <= datetime.now(timezone.utc):
                    message = 'HSReplay 登录会话已到期，请重新登录。'
                    self.vault.write_status('expired', message, region=5,
                                            accountName=session.get('accountName', ''),
                                            expiresAt=session['expiresAt'])
                    fallback = self._use_collection_snapshot(session, message)
                    if fallback is not None:
                        return fallback
                    raise ValueError(message)
            try:
                result = self.store.sync_hsreplay(session['account'], session['region'], session['cookie'], session.get('userAgent'))
            except ValueError as error:
                if '登录已失效' in str(error):
                    self.vault.write_status('expired', '登录已过期，请重新登录 HSReplay。', region=5,
                                            accountName=session.get('accountName', ''),
                                            expiresAt=session.get('expiresAt'))
                fallback = self._use_collection_snapshot(session, str(error))
                if fallback is not None:
                    return fallback
                raise
            self.vault.write_status('connected', '收藏已同步。', region=session['region'],
                                    accountName=session.get('accountName', ''),
                                    expiresAt=session.get('expiresAt'),
                                    lastSyncedAt=result['meta']['importedAt'])
            return result


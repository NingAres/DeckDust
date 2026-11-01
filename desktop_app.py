"""Deck Dust desktop launcher: starts a private loopback server and opens WebView2."""
from __future__ import annotations

import os
import re
import sys
import threading
from pathlib import Path

import webview
from local_server import LocalServer, create_server
from data_directory import DataDirectoryRedirected, relaunch_from_desktop
from deck_export_directory import deck_export_directory


APP_NAME = "Deck Dust"
PORT = 18765
ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
INSTANCE_MUTEX_NAME = r"Local\DeckDust.Desktop.SingleInstance"
ERROR_ALREADY_EXISTS = 183


def _acquire_instance_mutex(name=INSTANCE_MUTEX_NAME):
    if os.name != "nt":
        return [None, None]
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    create_mutex = kernel32.CreateMutexW
    create_mutex.argtypes = (wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR)
    create_mutex.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
    kernel32.CloseHandle.restype = wintypes.BOOL
    ctypes.set_last_error(0)
    handle = create_mutex(None, True, name)
    error = ctypes.get_last_error()
    if not handle:
        raise ctypes.WinError(error)
    if error == ERROR_ALREADY_EXISTS:
        kernel32.CloseHandle(handle)
        return None
    return [kernel32, handle]


def _release_instance_mutex(lock) -> None:
    if lock and lock[0] is not None and lock[1] is not None:
        lock[0].CloseHandle(lock[1])
        lock[1] = None


def serve() -> LocalServer:
    server = create_server(PORT, ROOT)
    thread = threading.Thread(target=server.serve_forever, name="deck-dust-http", daemon=True)
    thread.start()
    return server


class DesktopApi:
    def __init__(self, export_dir: Path):
        self.export_dir = export_dir
        self._window = None

    def choose_deck_json(self):
        if self._window is None:
            return None
        selected = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            directory=str(self.export_dir),
            allow_multiple=False,
            file_types=('套牌 JSON 文件 (*.json)',),
        )
        if not selected:
            return None
        path = Path(selected[0])
        if path.suffix.lower() != '.json' or path.stat().st_size > 5 * 1024 * 1024:
            raise ValueError('请选择不超过 5 MB 的套牌 JSON 文件。')
        return {'name': path.name, 'text': path.read_text(encoding='utf-8-sig')}


def _frontend_url() -> str:
    index = ROOT / "web-dist" / "index.html"
    match = re.search(r"[?&]v=([^\"&]+)", index.read_text(encoding="utf-8"))
    cache_key = match.group(1) if match else "current"
    return f"http://127.0.0.1:{PORT}/index.html?build={cache_key}"


def _run_application(lock) -> int:
    try:
        server = serve()
    except DataDirectoryRedirected as error:
        if '--storage-relaunch' not in sys.argv:
            try:
                _release_instance_mutex(lock)
                relaunch_from_desktop(Path(__file__), sys.argv[1:])
                return 0
            except Exception:
                pass
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, str(error), APP_NAME, 0x10)
        return 1
    except OSError as error:
        message = f"无法启动 Deck Dust 本地界面（端口 {PORT} 可能已被占用）。\n\n{error}"
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, APP_NAME, 0x10)
        except Exception:
            print(message, file=sys.stderr)
        return 1

    try:
        export_dir = deck_export_directory()
        api = DesktopApi(export_dir)
        window = webview.create_window(APP_NAME, _frontend_url(), width=1520, height=910, min_size=(980, 680), js_api=api)
        api._window = window
        user_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / APP_NAME / "WebView"
        webview.start(debug=False, private_mode=False, storage_path=str(user_data))
    except Exception as error:
        message = (
            "Deck Dust 无法初始化桌面浏览器组件。请安装或修复 Microsoft Edge WebView2 Runtime，"
            "然后重新启动应用。\n\n下载地址：https://developer.microsoft.com/microsoft-edge/webview2/\n\n"
            f"详细信息：{error}"
        )
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, APP_NAME, 0x10)
        except Exception:
            print(message, file=sys.stderr)
        return 1
    finally:
        server.shutdown()
        server.server_close()
    return 0


def main() -> int:
    lock = _acquire_instance_mutex()
    if lock is None:
        import ctypes
        ctypes.windll.user32.MessageBoxW(
            None, "Deck Dust 已经在运行，请使用当前打开的窗口。", APP_NAME, 0x40,
        )
        return 0
    try:
        return _run_application(lock)
    finally:
        _release_instance_mutex(lock)


if __name__ == "__main__":
    if '--hsreplay-login' in sys.argv:
        import argparse
        from hsreplay_login import run_login
        parser = argparse.ArgumentParser()
        parser.add_argument('--hsreplay-login', action='store_true')
        parser.add_argument('--data-dir', required=True)
        run_login(Path(parser.parse_args().data_dir))
    else:
        raise SystemExit(main())


"""Keep preview and desktop on the same physical Windows user-data directory."""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path


class DataDirectoryRedirected(OSError):
    pass


def physical_file_path(file) -> Path:
    if os.name != 'nt':
        return Path(file.name).resolve()
    import ctypes
    from ctypes import wintypes
    import msvcrt

    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    get_path = kernel.GetFinalPathNameByHandleW
    get_path.argtypes = (wintypes.HANDLE, wintypes.LPWSTR, wintypes.DWORD, wintypes.DWORD)
    get_path.restype = wintypes.DWORD
    buffer = ctypes.create_unicode_buffer(32768)
    length = get_path(msvcrt.get_osfhandle(file.fileno()), buffer, len(buffer), 0)
    if not length or length >= len(buffer):
        raise OSError('无法核对用户数据目录的实际位置。')
    value = buffer.value
    if value.startswith('\\\\?\\UNC\\'):
        value = '\\\\' + value[8:]
    elif value.startswith('\\\\?\\'):
        value = value[4:]
    return Path(value)


def prepare_data_directory(data_dir: Path | None = None) -> Path:
    override = data_dir if data_dir is not None else os.environ.get('DECK_DUST_DATA_DIR')
    base = Path(os.environ.get('LOCALAPPDATA', Path.home() / '.local' / 'share'))
    directory = Path(override) if override is not None else base / 'Deck Dust' / 'Data'
    directory.mkdir(parents=True, exist_ok=True)
    # Explicit test/custom directories are intentional; guard the shared default.
    if override is None and os.name == 'nt':
        with tempfile.NamedTemporaryFile(prefix='.storage-location-', dir=directory) as probe:
            actual = physical_file_path(probe)
            expected = Path(probe.name).absolute()
            if os.path.normcase(str(actual)) != os.path.normcase(str(expected)):
                raise DataDirectoryRedirected(
                    f'Windows 将数据目录重定向到了 {actual.parent}。'
                    '请从普通 Windows 终端或资源管理器启动应用，避免读写另一份数据库。'
                )
    return directory


def relaunch_from_desktop(script: Path, arguments: list[str]) -> None:
    """Launch through Explorer's desktop, not an inherited packaged-app context."""
    import win32com.client

    executable = Path(sys.executable)
    # Preview servers relaunching through Explorer should not leave a visible
    # console window open.  Keep the frozen desktop app's normal executable.
    if not getattr(sys, 'frozen', False) and executable.name.lower() == 'python.exe':
        windowless = executable.with_name('pythonw.exe')
        if windowless.exists():
            executable = windowless
    command = [str(executable)]
    if not getattr(sys, 'frozen', False):
        command.append(str(script.resolve()))
    command.extend(arguments)
    command.append('--storage-relaunch')
    shell = win32com.client.Dispatch('Shell.Application')
    desktop = shell.Windows().FindWindowSW(0, 0, 8, 0, 1)
    desktop.Document.Application.ShellExecute(
        command[0], subprocess.list2cmdline(command[1:]), str(script.resolve().parent), 'open', 0,
    )


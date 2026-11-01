"""Shared destination for deck exports in the packaged app and local preview."""
from __future__ import annotations

import sys
from pathlib import Path


EXPORT_FOLDER_NAME = '套牌导出'


def deck_export_directory() -> Path:
    if getattr(sys, 'frozen', False):
        app_directory = Path(sys.executable).resolve().parent
    else:
        app_directory = Path(__file__).resolve().parent / 'dist' / 'DeckDust'
    directory = app_directory / EXPORT_FOLDER_NAME
    directory.mkdir(parents=True, exist_ok=True)
    return directory

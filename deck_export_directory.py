"""Shared destination for deck exports in the packaged app and local preview."""
from __future__ import annotations

import sys
from pathlib import Path

from data_directory import prepare_data_directory
from persistent_files import migrate_directory_contents


EXPORT_FOLDER_NAME = '套牌导出'


def deck_export_directory() -> Path:
    if getattr(sys, 'frozen', False):
        legacy_directory = Path(sys.executable).resolve().parent / EXPORT_FOLDER_NAME
    else:
        legacy_directory = Path(__file__).resolve().parent / 'dist' / 'DeckDust' / EXPORT_FOLDER_NAME
    directory = prepare_data_directory().parent / 'Exports' / EXPORT_FOLDER_NAME
    directory.mkdir(parents=True, exist_ok=True)
    migrate_directory_contents(legacy_directory, directory)
    return directory

"""Helpers for keeping user files outside replaceable application bundles."""
from __future__ import annotations

import filecmp
import shutil
from pathlib import Path


def migrate_directory_contents(source: Path, destination: Path) -> None:
    """Copy legacy files into persistent storage without replacing existing files."""
    source = source.resolve()
    destination = destination.resolve()
    if source == destination or not source.is_dir():
        return

    for old_path in source.rglob("*"):
        if old_path.is_symlink() or not old_path.is_file():
            continue
        relative_path = old_path.relative_to(source)
        new_path = destination / relative_path
        if new_path.exists():
            if filecmp.cmp(old_path, new_path, shallow=False):
                continue
            index = 1
            while True:
                migrated_path = new_path.with_name(
                    f"{new_path.stem} (migrated {index}){new_path.suffix}"
                )
                if not migrated_path.exists():
                    break
                if filecmp.cmp(old_path, migrated_path, shallow=False):
                    migrated_path = None
                    break
                index += 1
            if migrated_path is None:
                continue
            new_path = migrated_path
        new_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(old_path, new_path)

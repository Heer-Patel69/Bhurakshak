from __future__ import annotations

from pathlib import Path

from ..core.exceptions import TerraWatchError


def require_readable_file(path: Path, *, code: str) -> Path:
    if not path.is_file():
        raise TerraWatchError(code, f"Required local artifact is unavailable: {path.name}", status_code=503)
    return path


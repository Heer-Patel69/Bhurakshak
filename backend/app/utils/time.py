from __future__ import annotations

from datetime import UTC, datetime


def ensure_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def age_seconds(value: datetime, *, relative_to: datetime | None = None) -> float:
    reference = ensure_utc(relative_to or datetime.now(UTC))
    return max(0.0, (reference - ensure_utc(value)).total_seconds())


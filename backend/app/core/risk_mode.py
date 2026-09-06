"""Request-scoped scenario selection shared by every analytical service."""
from contextvars import ContextVar
from datetime import UTC, datetime

from .exceptions import TerraWatchError

risk_mode: ContextVar[str] = ContextVar("risk_mode", default="historical_2024")
REPLAY_DATE = datetime(2024, 5, 28, tzinfo=UTC)


def assessment_time(at: datetime | None = None) -> datetime | None:
    if risk_mode.get() == "historical_2024":
        value = at or REPLAY_DATE
        if value.year != 2024:
            raise TerraWatchError("INVALID_REPLAY_DATE", "Historical replay requires a 2024 date.", status_code=422)
        return value
    if at is not None:
        raise TerraWatchError("CURRENT_DATE_OVERRIDE", "Current risk uses current provider timestamps; omit timestamp.", status_code=422)
    return None

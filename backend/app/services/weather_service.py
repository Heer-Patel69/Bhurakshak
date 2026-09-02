from __future__ import annotations

from datetime import datetime
from typing import Any

from ..models.schemas import ProviderStatus, WeatherObservation
from ..providers.weather.historical_chirps import HistoricalCHIRPSProvider
from ..providers.weather.imd import IMDWeatherProvider


class WeatherService:
    def __init__(self, imd: IMDWeatherProvider, historical: HistoricalCHIRPSProvider) -> None:
        self.imd = imd
        self.historical = historical

    async def current(
        self, latitude: float, longitude: float, *, at: datetime | None = None
    ) -> tuple[WeatherObservation | None, dict[str, Any]]:
        imd_result = await self.imd.get_current_weather(latitude, longitude, at=at)
        statuses = {"imd": imd_result.model_dump(mode="json") if isinstance(imd_result, ProviderStatus) else {"status": "available"}}
        if isinstance(imd_result, WeatherObservation):
            return imd_result, statuses
        fallback = await self.historical.get_recent_rainfall(latitude, longitude, at=at)
        if isinstance(fallback, WeatherObservation):
            statuses["historical_chirps"] = self.historical.health().model_dump(mode="json")
            return fallback, statuses
        statuses["historical_chirps"] = fallback.model_dump(mode="json")
        return None, statuses

    def health(self) -> dict[str, Any]:
        return {
            "imd": self.imd.health().model_dump(mode="json"),
            "chirps": self.historical.health().model_dump(mode="json"),
        }

    async def metadata(self) -> dict[str, Any]:
        return {
            "providers": self.health(),
            "historical": await self.historical.get_observation_metadata(),
        }


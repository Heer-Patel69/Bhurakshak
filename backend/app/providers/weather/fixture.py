from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from ...models.schemas import Location, ProviderStatus, WeatherObservation
from .base import WeatherProvider


class FixtureWeatherProvider(WeatherProvider):
    """Explicit test-only provider; it is never selected by production settings."""

    name = "test_fixture"

    def __init__(self, observation: WeatherObservation | None = None) -> None:
        self.observation = observation

    def health(self) -> ProviderStatus:
        return ProviderStatus(
            provider=self.name,
            status="test_fixture",
            live=False,
            enabled=True,
            configured=True,
            message="Synthetic fixture data for automated tests only.",
        )

    def _get(self, latitude: float, longitude: float) -> WeatherObservation:
        return self.observation or WeatherObservation(
            provider=self.name,
            source="test_fixture",
            observation_time=datetime.now(UTC),
            data_age_seconds=0,
            live=False,
            status="test_fixture",
            quality="test_fixture",
            rainfall_24h_mm=50,
            rainfall_72h_mm=100,
            rainfall_7d_mm=150,
            confidence="test_fixture",
            location=Location(latitude=latitude, longitude=longitude),
            provenance={"source": "test_fixture", "operational": False},
        )

    async def get_current_weather(self, latitude: float, longitude: float, *, at=None):  # type: ignore[no-untyped-def]
        return self._get(latitude, longitude)

    async def get_recent_rainfall(self, latitude: float, longitude: float, *, at=None):  # type: ignore[no-untyped-def]
        return self._get(latitude, longitude)

    async def get_forecast(self, latitude: float, longitude: float) -> dict[str, Any]:
        return {"provider": self.name, "status": "test_fixture", "live": False, "forecast": []}

    async def get_observation_metadata(self) -> dict[str, Any]:
        return self.health().model_dump(mode="json")


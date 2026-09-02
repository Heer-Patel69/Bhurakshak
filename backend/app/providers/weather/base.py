from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from ...models.schemas import ProviderStatus, WeatherObservation


class WeatherProvider(ABC):
    name: str

    @abstractmethod
    async def get_current_weather(
        self, latitude: float, longitude: float, *, at: datetime | None = None
    ) -> WeatherObservation | ProviderStatus:
        raise NotImplementedError

    @abstractmethod
    async def get_recent_rainfall(
        self, latitude: float, longitude: float, *, at: datetime | None = None
    ) -> WeatherObservation | ProviderStatus:
        raise NotImplementedError

    @abstractmethod
    async def get_forecast(self, latitude: float, longitude: float) -> dict[str, Any] | ProviderStatus:
        raise NotImplementedError

    @abstractmethod
    async def get_observation_metadata(self) -> dict[str, Any] | ProviderStatus:
        raise NotImplementedError

    @abstractmethod
    def health(self) -> ProviderStatus:
        raise NotImplementedError


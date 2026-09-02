from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ...models.schemas import ProviderStatus


class SatelliteProvider(ABC):
    name: str

    @abstractmethod
    def health(self) -> ProviderStatus:
        raise NotImplementedError

    @abstractmethod
    async def latest(self, latitude: float, longitude: float) -> dict[str, Any] | ProviderStatus:
        raise NotImplementedError


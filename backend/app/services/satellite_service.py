from __future__ import annotations

from typing import Any

from ..models.schemas import ProviderStatus
from ..providers.satellite.base import SatelliteProvider


class SatelliteService:
    def __init__(self, providers: list[SatelliteProvider]) -> None:
        self.providers = providers

    def health(self) -> dict[str, Any]:
        return {provider.name: provider.health().model_dump(mode="json") for provider in self.providers}

    async def latest(self, latitude: float, longitude: float) -> dict[str, Any]:
        results = []
        for provider in self.providers:
            result = await provider.latest(latitude, longitude)
            results.append(result.model_dump(mode="json") if isinstance(result, ProviderStatus) else result)
        available = [item for item in results if item.get("status") == "available"]
        return {
            "status": "available" if available else "unavailable",
            "observation_type": "latest_observation",
            "live": False,
            "observations": available,
            "providers": results,
        }


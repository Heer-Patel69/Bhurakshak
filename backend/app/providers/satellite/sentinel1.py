from __future__ import annotations

from typing import Any

from ...models.schemas import ProviderStatus
from .base import SatelliteProvider


class Sentinel1Provider(SatelliteProvider):
    name = "sentinel_1"

    def health(self) -> ProviderStatus:
        return ProviderStatus(
            provider=self.name,
            status="pipeline_not_configured",
            live=False,
            enabled=False,
            configured=False,
            message="Sentinel-1 SAR processing pipeline is not configured; no observation is fabricated.",
        )

    async def latest(self, latitude: float, longitude: float) -> dict[str, Any] | ProviderStatus:
        return self.health()


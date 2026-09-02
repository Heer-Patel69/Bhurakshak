from __future__ import annotations

from ...core.config import Settings
from ...models.schemas import ProviderStatus
from .base import SensorProvider


class HTTPSensorProvider(SensorProvider):
    name = "http_sensor_ingest"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def health(self) -> ProviderStatus:
        configured = bool(self.settings.sensor_ingest_secret)
        return ProviderStatus(
            provider=self.name,
            status="ready_for_ingest" if configured else "no_sensor_connected",
            live=False,
            enabled=configured,
            configured=configured,
            message="No physical sensor reading is claimed until a device authenticates and submits data.",
        )


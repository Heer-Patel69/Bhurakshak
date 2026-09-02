from __future__ import annotations

from typing import Any

from ...core.config import Settings
from ...models.schemas import ProviderStatus
from .base import SatelliteProvider


class MOSDACProvider(SatelliteProvider):
    name = "mosdac"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def health(self) -> ProviderStatus:
        configured = bool(self.settings.mosdac_username and self.settings.mosdac_password)
        if not self.settings.mosdac_provider_enabled:
            status = "disabled"
            message = "MOSDAC provider is disabled."
        elif not configured:
            status = "not_configured"
            message = "MOSDAC credentials have not been configured."
        else:
            status = "pipeline_not_configured"
            message = "Credentials are present, but an approved MOSDAC product pipeline is not configured."
        return ProviderStatus(
            provider=self.name,
            status=status,
            live=False,
            enabled=self.settings.mosdac_provider_enabled,
            configured=configured,
            message=message,
        )

    async def latest(self, latitude: float, longitude: float) -> dict[str, Any] | ProviderStatus:
        return self.health()


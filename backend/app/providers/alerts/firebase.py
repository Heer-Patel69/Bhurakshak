from __future__ import annotations

from typing import Any

from ...core.config import Settings
from ...models.schemas import ProviderStatus
from .base import AlertProvider


class FirebaseAlertProvider(AlertProvider):
    name = "firebase"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def health(self) -> ProviderStatus:
        configured = bool(self.settings.firebase_credentials)
        return ProviderStatus(
            provider=self.name,
            status="configured_not_implemented" if self.settings.firebase_enabled and configured else "not_configured",
            live=False,
            enabled=self.settings.firebase_enabled,
            configured=configured,
            message="Firebase delivery is disabled or awaiting credential-backed adapter activation.",
        )

    async def send(self, alert: dict[str, Any]) -> dict[str, Any]:
        return {"provider": self.name, "status": self.health().status, "external": False}


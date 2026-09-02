from __future__ import annotations

from typing import Any

from ...core.config import Settings
from ...models.schemas import ProviderStatus
from .base import AlertProvider


class SMSAlertProvider(AlertProvider):
    name = "sms"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def health(self) -> ProviderStatus:
        configured = bool(self.settings.sms_provider and self.settings.sms_api_key)
        return ProviderStatus(
            provider=self.name,
            status="configured_not_implemented" if self.settings.sms_enabled and configured else "disabled",
            live=False,
            enabled=self.settings.sms_enabled,
            configured=configured,
            message="Real SMS transmission remains disabled unless SMS_ENABLED=true and an adapter is approved.",
        )

    async def send(self, alert: dict[str, Any]) -> dict[str, Any]:
        return {"provider": self.name, "status": self.health().status, "external": False}


from __future__ import annotations

import logging
from typing import Any

from ...models.schemas import ProviderStatus
from .base import AlertProvider


class ConsoleAlertProvider(AlertProvider):
    name = "console"

    def health(self) -> ProviderStatus:
        return ProviderStatus(provider=self.name, status="available", live=False, enabled=True, configured=True)

    async def send(self, alert: dict[str, Any]) -> dict[str, Any]:
        logging.getLogger("terrawatch.alert").info(
            "Development alert emitted to console",
            extra={"event": "console_alert", "provider": self.name},
        )
        return {"provider": self.name, "status": "delivered_to_test_channel", "external": False}


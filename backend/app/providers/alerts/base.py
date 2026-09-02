from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ...models.schemas import ProviderStatus


class AlertProvider(ABC):
    name: str

    @abstractmethod
    def health(self) -> ProviderStatus:
        raise NotImplementedError

    @abstractmethod
    async def send(self, alert: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


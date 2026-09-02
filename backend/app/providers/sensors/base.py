from __future__ import annotations

from abc import ABC, abstractmethod

from ...models.schemas import ProviderStatus


class SensorProvider(ABC):
    name: str

    @abstractmethod
    def health(self) -> ProviderStatus:
        raise NotImplementedError


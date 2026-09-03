from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin

import httpx

from ...core.config import Settings
from ...models.schemas import ProviderStatus, WeatherObservation
from .base import WeatherProvider


class IMDWeatherProvider(WeatherProvider):
    """Config-driven IMD adapter with no assumed or fabricated endpoint paths."""

    name = "imd"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def configured(self) -> bool:
        has_auth = bool(self.settings.imd_api_key or self.settings.imd_auth_token)
        return bool(self.settings.imd_api_base_url and self.settings.imd_current_path and has_auth)

    def health(self) -> ProviderStatus:
        if not self.configured:
            return ProviderStatus(
                provider=self.name,
                status="not_configured",
                live=False,
                enabled=self.settings.imd_provider_enabled,
                configured=False,
                message="IMD credentials have not been configured, and no official endpoint is assumed.",
            )
        if not self.settings.imd_provider_enabled:
            return ProviderStatus(
                provider=self.name,
                status="disabled",
                live=False,
                enabled=False,
                configured=True,
                message="IMD configuration is present but the provider is disabled.",
            )
        return ProviderStatus(
            provider=self.name,
            status="configured_not_verified",
            live=False,
            enabled=True,
            configured=True,
            message="Configuration is present; provider health is verified only when an official request succeeds.",
        )

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.settings.imd_api_key:
            headers["X-API-Key"] = self.settings.imd_api_key
        if self.settings.imd_auth_token:
            headers["Authorization"] = f"Bearer {self.settings.imd_auth_token}"
        return headers

    async def _request(self, path: str | None, params: dict[str, Any]) -> dict[str, Any] | ProviderStatus:
        status = self.health()
        if status.status not in {"configured_not_verified", "available"}:
            return status
        if not path:
            return ProviderStatus(
                provider=self.name,
                status="endpoint_not_configured",
                live=False,
                enabled=True,
                configured=False,
                message="The official IMD endpoint path for this operation is not configured.",
            )
        url = urljoin(self.settings.imd_api_base_url.rstrip("/") + "/", path.lstrip("/"))  # type: ignore[union-attr]
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, params=params, headers=self._headers())
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            return ProviderStatus(
                provider=self.name,
                status="unavailable",
                live=False,
                enabled=True,
                configured=True,
                message=f"IMD request failed without substituting fabricated values: {type(exc).__name__}",
            )
        return {"provider": self.name, "status": "available", "received_at": datetime.now(UTC), "raw": payload}

    async def get_current_weather(
        self, latitude: float, longitude: float, *, at: datetime | None = None
    ) -> WeatherObservation | ProviderStatus:
        result = await self._request(self.settings.imd_current_path, {"latitude": latitude, "longitude": longitude})
        if isinstance(result, ProviderStatus):
            return result
        raw = result["raw"]
        required = {"observation_time", "rainfall_24h_mm"}
        if not isinstance(raw, dict) or not required.issubset(raw):
            return ProviderStatus(provider=self.name, status="schema_mapping_required", live=False, enabled=True, configured=True, message="The response must expose the configured normalized IMD fields before operational use.")
        try:
            return WeatherObservation(provider="imd", source=str(raw.get("source") or "India Meteorological Department"), observation_time=raw["observation_time"], received_at=result["received_at"], live=True, status="available", quality=str(raw.get("data_quality") or "official_provider"), rainfall_1h_mm=raw.get("rainfall_1h_mm"), rainfall_24h_mm=raw.get("rainfall_24h_mm"), rainfall_72h_mm=raw.get("rainfall_72h_mm"), rainfall_7d_mm=raw.get("rainfall_7d_mm"), temperature_c=raw.get("temperature_c"), humidity_percent=raw.get("humidity_percent"), forecast_rainfall_mm=raw.get("forecast_rainfall_mm"), confidence=str(raw.get("confidence") or "official"), location={"latitude": latitude, "longitude": longitude}, provenance={"provider": "imd", "warnings": raw.get("warnings", []), "raw_fields_used": sorted(required)})
        except (ValueError, TypeError):
            return ProviderStatus(provider=self.name, status="schema_mapping_required", live=False, enabled=True, configured=True, message="IMD normalized fields failed validation; no values were fabricated.")

    async def get_recent_rainfall(
        self, latitude: float, longitude: float, *, at: datetime | None = None
    ) -> WeatherObservation | ProviderStatus:
        result = await self._request(
            self.settings.imd_recent_rainfall_path,
            {"latitude": latitude, "longitude": longitude},
        )
        if isinstance(result, ProviderStatus):
            return result
        return ProviderStatus(
            provider=self.name,
            status="schema_mapping_required",
            live=False,
            enabled=True,
            configured=True,
            message="Approved IMD rainfall schema mapping is required before operational use.",
        )

    async def get_forecast(self, latitude: float, longitude: float) -> dict[str, Any] | ProviderStatus:
        return await self._request(self.settings.imd_forecast_path, {"latitude": latitude, "longitude": longitude})

    async def get_observation_metadata(self) -> dict[str, Any] | ProviderStatus:
        return await self._request(self.settings.imd_metadata_path, {})

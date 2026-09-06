from __future__ import annotations

import math
import time
from datetime import UTC, datetime, timedelta

import httpx

from ...models.schemas import Location, ProviderStatus, WeatherObservation


class OpenMeteoProvider:
    """Recent model weather; never substitutes missing precipitation with zero."""
    name = "Open-Meteo"

    def __init__(self):
        self.cache = {}
        self.last_status = ProviderStatus(provider=self.name, status="not_checked", enabled=True, configured=True)

    def health(self):
        return self.last_status

    @staticmethod
    def parse(payload, latitude, longitude, now):
        hourly = payload["hourly"]
        times = [datetime.fromisoformat(value).replace(tzinfo=UTC) for value in hourly["time"]]
        end = now.replace(minute=0, second=0, microsecond=0)
        index = {stamp: i for i, stamp in enumerate(times)}
        rain = hourly["precipitation"]

        def total(hours):
            values = [rain[index[end - timedelta(hours=offset)]] for offset in range(hours)]
            if any(v is None or not math.isfinite(v) or v < 0 for v in values):
                raise ValueError("Incomplete precipitation window")
            return round(sum(values), 3)

        i = index[end]
        soil_values = hourly.get("soil_moisture_0_to_1cm", [])
        soil = soil_values[i] if len(soil_values) > i else None
        if soil is not None and (not math.isfinite(soil) or not 0 <= soil <= 1):
            soil = None
        return WeatherObservation(
            provider="Open-Meteo", source="Open-Meteo weather model", observation_time=end,
            received_at=now, data_age_seconds=(now-end).total_seconds(), live=True,
            status="available", quality="model_derived_recent_weather",
            rainfall_1h_mm=total(1), rainfall_24h_mm=total(24),
            rainfall_72h_mm=total(72), rainfall_7d_mm=total(168),
            temperature_c=hourly["temperature_2m"][i], humidity_percent=hourly["relative_humidity_2m"][i],
            confidence="model_derived", location=Location(latitude=latitude, longitude=longitude),
            provenance={"source_url": "https://api.open-meteo.com/v1/forecast", "timezone": "UTC",
                "rainfall_window": "complete hourly intervals ending at latest UTC hour; forecast hours excluded",
                "soil_moisture": soil, "soil_unit": "m3/m3", "soil_depth": "0–1 cm",
                "soil_source": "Open-Meteo model-derived soil moisture", "physical_sensor": False,
                "model_grid_latitude": payload.get("latitude"), "model_grid_longitude": payload.get("longitude")},
        )

    async def get_current_weather(self, latitude, longitude, *, at=None):
        key = (round(latitude, 4), round(longitude, 4))
        cached = self.cache.get(key)
        if cached and time.monotonic() - cached[0] < 600:
            return cached[1]
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get("https://api.open-meteo.com/v1/forecast", params={
                    "latitude": latitude, "longitude": longitude, "past_days": 7, "forecast_days": 1,
                    "timezone": "UTC", "hourly": "precipitation,temperature_2m,relative_humidity_2m,soil_moisture_0_to_1cm",
                })
                response.raise_for_status()
                result = self.parse(response.json(), latitude, longitude, datetime.now(UTC))
            self.last_status = ProviderStatus(provider=self.name, status="available", live=True, enabled=True, configured=True)
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            result = ProviderStatus(provider=self.name, status="unavailable", message=f"Recent weather unavailable ({type(exc).__name__}).")
            self.last_status = result
        self.cache[key] = (time.monotonic(), result)
        return result

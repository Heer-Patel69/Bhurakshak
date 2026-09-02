from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from ...models.schemas import Location, ProviderStatus, WeatherObservation
from ...utils.time import age_seconds, ensure_utc
from .base import WeatherProvider


class HistoricalCHIRPSProvider(WeatherProvider):
    name = "historical_chirps"

    def __init__(self, rainfall_2024_path: Path, rainfall_2025_path: Path) -> None:
        self.paths = (rainfall_2024_path, rainfall_2025_path)
        self._records: pd.DataFrame | None = None
        self.load_error: str | None = None
        self._load()

    def _load(self) -> None:
        try:
            frames: list[pd.DataFrame] = []
            if self.paths[0].is_file():
                frame_2024 = pd.read_csv(self.paths[0])
                frames.append(
                    pd.DataFrame(
                        {
                            "date": pd.to_datetime(frame_2024["date"], utc=True),
                            "rainfall_24h_mm": frame_2024["rain_prev_24h_mm"],
                            "rainfall_72h_mm": frame_2024["rain_prev_72h_mm"],
                            "rainfall_7d_mm": frame_2024["rain_prev_7d_mm"],
                            "dataset": frame_2024.get("rainfall_dataset", "CHIRPS Daily"),
                            "region": frame_2024.get("region", "Aizawl Pilot"),
                        }
                    )
                )
            if self.paths[1].is_file():
                frame_2025 = pd.read_csv(self.paths[1])
                rain_24 = pd.to_numeric(frame_2025["rain_24h_mm"], errors="coerce").fillna(0)
                frames.append(
                    pd.DataFrame(
                        {
                            "date": pd.to_datetime(frame_2025["date"], utc=True),
                            "rainfall_24h_mm": rain_24,
                            "rainfall_72h_mm": frame_2025["rain_72h_mm"],
                            "rainfall_7d_mm": rain_24.rolling(7, min_periods=1).sum(),
                            "dataset": frame_2025.get("source", "CHIRPS_DAILY"),
                            "region": frame_2025.get("region", "Aizawl_TerraWatch_Pilot"),
                        }
                    )
                )
            if not frames:
                raise FileNotFoundError("No configured CHIRPS files exist")
            self._records = pd.concat(frames, ignore_index=True).sort_values("date").reset_index(drop=True)
        except Exception as exc:
            self.load_error = f"{type(exc).__name__}: {exc}"
            self._records = None

    def health(self) -> ProviderStatus:
        if self._records is None:
            return ProviderStatus(
                provider=self.name,
                status="unavailable",
                live=False,
                enabled=True,
                configured=True,
                message=self.load_error or "Historical CHIRPS data is unavailable.",
            )
        return ProviderStatus(
            provider=self.name,
            status="available",
            live=False,
            enabled=True,
            configured=True,
            message=f"{len(self._records)} historical daily Aizawl observations loaded; this source is never live.",
        )

    def _observation(self, latitude: float, longitude: float, at: datetime | None) -> WeatherObservation | ProviderStatus:
        if self._records is None or self._records.empty:
            return self.health()
        target = ensure_utc(at) if at else None
        records = self._records
        if target:
            eligible = records[records["date"] <= pd.Timestamp(target)]
            if eligible.empty:
                return ProviderStatus(
                    provider=self.name,
                    status="no_historical_observation",
                    live=False,
                    message="No CHIRPS record exists on or before the requested timestamp.",
                )
            row = eligible.iloc[-1]
        else:
            row = records.iloc[-1]
        observed_at = row["date"].to_pydatetime()
        received_at = datetime.now(UTC)
        return WeatherObservation(
            provider=self.name,
            source=str(row["dataset"]),
            observation_time=observed_at,
            received_at=received_at,
            data_age_seconds=age_seconds(observed_at, relative_to=received_at),
            live=False,
            status="historical_observation",
            quality="archived_regional_mean",
            rainfall_24h_mm=float(row["rainfall_24h_mm"]),
            rainfall_72h_mm=float(row["rainfall_72h_mm"]),
            rainfall_7d_mm=float(row["rainfall_7d_mm"]),
            confidence="historical_reference_only",
            location=Location(latitude=latitude, longitude=longitude),
            provenance={
                "dataset": str(row["dataset"]),
                "spatial_scope": str(row["region"]),
                "spatial_method": "Aizawl regional mean; not a point gauge",
                "live": False,
            },
        )

    async def get_current_weather(
        self, latitude: float, longitude: float, *, at: datetime | None = None
    ) -> WeatherObservation | ProviderStatus:
        return self._observation(latitude, longitude, at)

    async def get_recent_rainfall(
        self, latitude: float, longitude: float, *, at: datetime | None = None
    ) -> WeatherObservation | ProviderStatus:
        return self._observation(latitude, longitude, at)

    async def get_forecast(self, latitude: float, longitude: float) -> dict[str, Any] | ProviderStatus:
        return ProviderStatus(
            provider=self.name,
            status="unsupported",
            live=False,
            message="Historical CHIRPS observations do not provide a forecast.",
        )

    async def get_observation_metadata(self) -> dict[str, Any] | ProviderStatus:
        if self._records is None:
            return self.health()
        return {
            "provider": self.name,
            "status": "available",
            "live": False,
            "records": len(self._records),
            "first_observation": self._records.iloc[0]["date"].isoformat(),
            "last_observation": self._records.iloc[-1]["date"].isoformat(),
        }


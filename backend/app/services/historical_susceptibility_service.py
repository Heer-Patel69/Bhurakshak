from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..models.schemas import HistoricalSusceptibility
from ..utils.geo import haversine_many_m


class HistoricalSusceptibilityService:
    """Transparent distance-decay density over all historical GSI inventory points."""

    def __init__(self, inventory_path: Path, bandwidth_m: float = 1_000, normalization_percentile: float = 95) -> None:
        self.inventory_path = inventory_path
        self.bandwidth_m = bandwidth_m
        self.normalization_percentile = normalization_percentile
        self.latitudes = np.array([], dtype=float)
        self.longitudes = np.array([], dtype=float)
        self.normalizer = 1.0
        self.load_error: str | None = None
        self._load()

    def _load(self) -> None:
        try:
            frame = pd.read_csv(self.inventory_path, usecols=["latitude", "longitude"])
            frame = frame.dropna().astype(float)
            self.latitudes = frame["latitude"].to_numpy()
            self.longitudes = frame["longitude"].to_numpy()
            densities = []
            for latitude, longitude in zip(self.latitudes, self.longitudes, strict=True):
                distances = haversine_many_m(latitude, longitude, self.latitudes, self.longitudes)
                densities.append(float(np.exp(-distances / self.bandwidth_m).sum()))
            self.normalizer = max(1.0, float(np.percentile(densities, self.normalization_percentile)))
            self.load_error = None
        except Exception as exc:
            self.latitudes = np.array([], dtype=float)
            self.longitudes = np.array([], dtype=float)
            self.load_error = f"{type(exc).__name__}: {exc}"

    def health(self) -> dict:
        return {
            "status": "available" if self.latitudes.size else "unavailable",
            "source": "GSI historical landslide inventory",
            "inventory_size": int(self.latitudes.size),
            "message": self.load_error,
        }

    def score(self, latitude: float, longitude: float) -> HistoricalSusceptibility:
        if not self.latitudes.size:
            return HistoricalSusceptibility(
                historical_susceptibility_score=0,
                nearest_historical_event_distance_m=40_000_000,
                historical_events_within_500m=0,
                historical_events_within_1km=0,
                historical_events_within_2km=0,
                inventory_size=0,
                methodology="unavailable",
                status="unavailable",
            )
        distances = haversine_many_m(latitude, longitude, self.latitudes, self.longitudes)
        density = float(np.exp(-distances / self.bandwidth_m).sum())
        return HistoricalSusceptibility(
            historical_susceptibility_score=min(1.0, density / self.normalizer),
            nearest_historical_event_distance_m=float(distances.min()),
            historical_events_within_500m=int((distances <= 500).sum()),
            historical_events_within_1km=int((distances <= 1_000).sum()),
            historical_events_within_2km=int((distances <= 2_000).sum()),
            inventory_size=int(self.latitudes.size),
            methodology=(
                f"Exponential distance-decay density, bandwidth={self.bandwidth_m:.0f}m, "
                f"normalized to inventory density p{self.normalization_percentile:g}"
            ),
        )


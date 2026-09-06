from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..models.schemas import HistoricalSusceptibility
from ..utils.geo import haversine_many_m
from ..utils.geo import parse_bbox


class HistoricalSusceptibilityService:
    """Transparent distance-decay density over all historical GSI inventory points."""

    def __init__(self, inventory_path: Path, bandwidth_m: float = 1_000, normalization_percentile: float = 95) -> None:
        self.inventory_path = inventory_path
        self.bandwidth_m = bandwidth_m
        self.normalization_percentile = normalization_percentile
        self.latitudes = np.array([], dtype=float)
        self.longitudes = np.array([], dtype=float)
        self.normalizer = 1.0
        self.frame = pd.DataFrame()
        self.density_scores = np.array([], dtype=float)
        self.load_error: str | None = None
        self._load()

    def _load(self) -> None:
        try:
            columns = ["event_id", "date_parsed", "date_status", "district", "latitude", "longitude"]
            frame = pd.read_csv(self.inventory_path, usecols=columns).dropna(subset=["latitude", "longitude"])
            frame[["latitude", "longitude"]] = frame[["latitude", "longitude"]].astype(float)
            self.frame = frame.reset_index(drop=True)
            self.latitudes = frame["latitude"].to_numpy()
            self.longitudes = frame["longitude"].to_numpy()
            densities = []
            for latitude, longitude in zip(self.latitudes, self.longitudes, strict=True):
                distances = haversine_many_m(latitude, longitude, self.latitudes, self.longitudes)
                densities.append(float(np.exp(-distances / self.bandwidth_m).sum()))
            self.normalizer = max(1.0, float(np.percentile(densities, self.normalization_percentile)))
            self.density_scores = np.minimum(1.0, np.asarray(densities) / self.normalizer)
            self.load_error = None
        except Exception as exc:
            self.latitudes = np.array([], dtype=float)
            self.longitudes = np.array([], dtype=float)
            self.frame = pd.DataFrame()
            self.density_scores = np.array([], dtype=float)
            self.load_error = f"{type(exc).__name__}: {exc}"

    def health(self) -> dict:
        return {
            "status": "available" if self.latitudes.size else "unavailable",
            "source": "GSI historical landslide inventory",
            "inventory_size": int(self.latitudes.size),
            "message": self.load_error,
        }

    def score(self, latitude: float, longitude: float, at=None) -> HistoricalSusceptibility:
        latitudes, longitudes = self.latitudes, self.longitudes
        if at is not None and not self.frame.empty:
            dates = pd.to_datetime(self.frame["date_parsed"], utc=True, errors="coerce")
            mask = dates.notna() & (dates < pd.Timestamp(at).normalize())
            latitudes, longitudes = latitudes[mask], longitudes[mask]
        if not latitudes.size:
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
        distances = haversine_many_m(latitude, longitude, latitudes, longitudes)
        density = float(np.exp(-distances / self.bandwidth_m).sum())
        return HistoricalSusceptibility(
            historical_susceptibility_score=min(1.0, density / self.normalizer),
            nearest_historical_event_distance_m=float(distances.min()),
            historical_events_within_500m=int((distances <= 500).sum()),
            historical_events_within_1km=int((distances <= 1_000).sum()),
            historical_events_within_2km=int((distances <= 2_000).sum()),
            inventory_size=int(latitudes.size),
            methodology=(
                f"Exponential distance-decay density, bandwidth={self.bandwidth_m:.0f}m, "
                f"normalized to inventory density p{self.normalization_percentile:g}"
            ),
        )

    def feature_collection(self, bbox: str | None = None) -> dict:
        bounds = parse_bbox(bbox) if bbox else None
        features = []
        for index, row in self.frame.iterrows():
            lon, lat = float(row["longitude"]), float(row["latitude"])
            if bounds and not (bounds[0] <= lon <= bounds[2] and bounds[1] <= lat <= bounds[3]):
                continue
            date_value = None if pd.isna(row["date_parsed"]) else str(row["date_parsed"])
            features.append({
                "type": "Feature", "id": str(row["event_id"]),
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {"event_id": str(row["event_id"]), "date": date_value, "date_status": str(row["date_status"]), "district": str(row["district"]), "historical_susceptibility_score": round(float(self.density_scores[index]), 4), "source": "Geological Survey of India"},
            })
        return {"type": "FeatureCollection", "features": features, "metadata": {"status": "available" if self.latitudes.size else "unavailable", "source": "GSI historical landslide inventory", "inventory_size": int(self.latitudes.size), "returned_feature_count": len(features), "undated_events_are_null": True, "methodology": f"Exponential distance-decay density ({self.bandwidth_m:.0f} m bandwidth)"}}

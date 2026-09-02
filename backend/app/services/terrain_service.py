from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from ..models.schemas import Location, TerrainObservation
from ..utils.geo import haversine_many_m


class TerrainService:
    """Static nearest-sample lookup over existing Copernicus GLO-30-derived features."""

    def __init__(self, terrain_path: Path) -> None:
        self.terrain_path = terrain_path
        self.frame: pd.DataFrame | None = None
        self.latitudes = np.array([], dtype=float)
        self.longitudes = np.array([], dtype=float)
        self.load_error: str | None = None
        self._load()

    def _load(self) -> None:
        try:
            frame = pd.read_csv(self.terrain_path, usecols=["elevation_m", "slope_deg", ".geo"])
            coordinates = frame[".geo"].map(lambda value: json.loads(value)["coordinates"])
            self.longitudes = np.array([float(item[0]) for item in coordinates])
            self.latitudes = np.array([float(item[1]) for item in coordinates])
            self.frame = frame[["elevation_m", "slope_deg"]].astype(float).reset_index(drop=True)
        except Exception as exc:
            self.frame = None
            self.load_error = f"{type(exc).__name__}: {exc}"

    def health(self) -> dict:
        return {
            "status": "available" if self.frame is not None else "unavailable",
            "source": "Copernicus DEM GLO-30 derived terrain features",
            "resolution_m": 30,
            "samples": 0 if self.frame is None else len(self.frame),
            "message": self.load_error,
        }

    def lookup(self, latitude: float, longitude: float) -> TerrainObservation | dict:
        if self.frame is None or not len(self.frame):
            return {"status": "unavailable", "message": self.load_error or "Terrain artifact unavailable."}
        distances = haversine_many_m(latitude, longitude, self.latitudes, self.longitudes)
        index = int(np.argmin(distances))
        row = self.frame.iloc[index]
        return TerrainObservation(
            elevation_m=float(row["elevation_m"]),
            slope_deg=float(row["slope_deg"]),
            source="Copernicus DEM GLO-30 derived static sample",
            resolution_m=30,
            coordinates=Location(latitude=latitude, longitude=longitude),
            sampled_coordinates=Location(latitude=float(self.latitudes[index]), longitude=float(self.longitudes[index])),
            sample_distance_m=float(distances[index]),
        )


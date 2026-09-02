from __future__ import annotations

import json
import math
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from ..core.exceptions import TerraWatchError
from ..utils.geo import parse_bbox


class GeoService:
    def load_feature_collection(self, path: Path | None, *, layer: str) -> dict[str, Any]:
        if path is None or not path.is_file():
            return {
                "type": "FeatureCollection",
                "features": [],
                "metadata": {
                    "layer": layer,
                    "status": "not_configured",
                    "message": f"No analytical {layer} GeoJSON source is configured; OSM map tiles are not used as data.",
                },
            }
        try:
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            if payload.get("type") != "FeatureCollection":
                raise ValueError("Expected a GeoJSON FeatureCollection")
            payload["metadata"] = {"layer": layer, "status": "available", "source": str(path)}
            return payload
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            return {
                "type": "FeatureCollection",
                "features": [],
                "metadata": {"layer": layer, "status": "unavailable", "message": f"{type(exc).__name__}: {exc}"},
            }


class RiskGridService:
    def __init__(self, orchestrator, *, max_cells: int, cache_seconds: int) -> None:
        self.orchestrator = orchestrator
        self.max_cells = max_cells
        self.cache_seconds = cache_seconds
        self.cache: dict[str, tuple[float, dict[str, Any]]] = {}

    async def generate(
        self,
        session: Session,
        *,
        bbox: str,
        resolution: int,
        at: datetime | None = None,
    ) -> dict[str, Any]:
        try:
            west, south, east, north = parse_bbox(bbox)
        except ValueError as exc:
            raise TerraWatchError("INVALID_BBOX", str(exc), status_code=422) from exc
        if resolution < 2:
            raise TerraWatchError("INVALID_GRID_RESOLUTION", "resolution must be at least 2 points per axis.", status_code=422)
        cells = resolution * resolution
        if cells > self.max_cells:
            largest = int(math.sqrt(self.max_cells))
            raise TerraWatchError(
                "GRID_TOO_LARGE",
                f"Requested {cells} cells; maximum is {self.max_cells} ({largest}x{largest}).",
                status_code=422,
            )
        key = f"{west},{south},{east},{north}:{resolution}:{at.isoformat() if at else 'latest'}"
        cached = self.cache.get(key)
        now_monotonic = time.monotonic()
        if cached and now_monotonic - cached[0] <= self.cache_seconds:
            return {**cached[1], "cache": "hit"}
        features = []
        for row in range(resolution):
            latitude = south + (north - south) * row / (resolution - 1)
            for column in range(resolution):
                longitude = west + (east - west) * column / (resolution - 1)
                result = await self.orchestrator.point(
                    session,
                    latitude=latitude,
                    longitude=longitude,
                    at=at,
                    persist=False,
                )
                signals = result.signals
                properties = {
                    "risk_score": result.risk_score,
                    "risk_level": result.risk_level,
                    "confidence_score": result.confidence_score,
                    "ml_susceptibility_score": signals["ml"].get("ml_susceptibility_score"),
                    "historical_susceptibility_score": signals["historical"].get("historical_susceptibility_score"),
                    "rainfall_score": signals["rainfall"].get("score"),
                    "terrain_score": signals["terrain"].get("score"),
                    "generated_at": result.generated_at.isoformat(),
                    "data_age_seconds": signals["rainfall"].get("data_age_seconds"),
                    "assessment_context": result.assessment_context,
                }
                features.append(
                    {
                        "type": "Feature",
                        "id": f"risk-{row}-{column}",
                        "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                        "properties": properties,
                    }
                )
        payload = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "bbox": [west, south, east, north],
                "resolution": resolution,
                "cell_count": len(features),
                "method": "point grid",
                "generated_at": datetime.now().astimezone().isoformat(),
            },
            "cache": "miss",
        }
        self.cache[key] = (now_monotonic, payload)
        return payload

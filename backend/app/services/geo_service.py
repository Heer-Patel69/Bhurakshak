from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from shapely.geometry import box, shape
from shapely.strtree import STRtree
from sqlalchemy.orm import Session

from ..core.exceptions import TerraWatchError
from ..utils.geo import parse_bbox
from ..core.risk_mode import risk_mode, assessment_time


@dataclass
class CachedGeoLayer:
    modified_ns: int
    payload: dict[str, Any]
    geometries: list[Any] | None = None
    tree: STRtree | None = None


class GeoService:
    """Lazy, process-local cache for preprocessed analytical GeoJSON layers."""

    def __init__(self) -> None:
        self._cache: dict[Path, CachedGeoLayer] = {}

    def load_feature_collection(
        self,
        path: Path | None,
        *,
        layer: str,
        bbox: str | tuple[float, float, float, float] | None = None,
        offset: int = 0,
        limit: int | None = None,
    ) -> dict[str, Any]:
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
            cached = self._get_cached(path)
            all_features = cached.payload.get("features", [])
            if bbox is None:
                indices = list(range(len(all_features)))
            else:
                bbox_values = parse_bbox(bbox) if isinstance(bbox, str) else bbox
                self._ensure_spatial_index(cached)
                assert cached.tree is not None
                indices = sorted(int(value) for value in cached.tree.query(box(*bbox_values), predicate="intersects"))
            matched_count = len(indices)
            selected = indices[offset : offset + limit if limit is not None else None]
            metadata = {
                **cached.payload.get("metadata", {}),
                "layer": layer,
                "status": "available",
                "artifact": str(path),
                "total_feature_count": len(all_features),
                "matched_feature_count": matched_count,
                "returned_feature_count": len(selected),
                "offset": offset,
                "limit": limit,
            }
            return {
                "type": "FeatureCollection",
                "features": [all_features[index] for index in selected],
                "metadata": metadata,
            }
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            return {
                "type": "FeatureCollection",
                "features": [],
                "metadata": {"layer": layer, "status": "unavailable", "message": f"{type(exc).__name__}: {exc}"},
            }

    def intersecting_features(
        self,
        path: Path | None,
        geometries: list[Any],
        *,
        layer: str,
    ) -> dict[str, Any]:
        if path is None or not path.is_file():
            return self.load_feature_collection(path, layer=layer)
        cached = self._get_cached(path)
        self._ensure_spatial_index(cached)
        assert cached.tree is not None
        indices: set[int] = set()
        for geometry in geometries:
            indices.update(int(value) for value in cached.tree.query(geometry, predicate="intersects"))
        ordered = sorted(indices)
        return {
            "type": "FeatureCollection",
            "features": [cached.payload["features"][index] for index in ordered],
            "metadata": {
                **cached.payload.get("metadata", {}),
                "layer": layer,
                "status": "available",
                "artifact": str(path),
                "total_feature_count": len(cached.payload.get("features", [])),
                "matched_feature_count": len(ordered),
                "returned_feature_count": len(ordered),
                "spatial_index": "STRtree",
            },
        }

    def _get_cached(self, path: Path) -> CachedGeoLayer:
        resolved = path.resolve()
        modified_ns = resolved.stat().st_mtime_ns
        cached = self._cache.get(resolved)
        if cached and cached.modified_ns == modified_ns:
            return cached
        with resolved.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if payload.get("type") != "FeatureCollection":
            raise ValueError("Expected a GeoJSON FeatureCollection")
        cached = CachedGeoLayer(modified_ns=modified_ns, payload=payload)
        self._cache[resolved] = cached
        return cached

    @staticmethod
    def _ensure_spatial_index(cached: CachedGeoLayer) -> None:
        if cached.tree is not None:
            return
        cached.geometries = [shape(feature["geometry"]) for feature in cached.payload.get("features", [])]
        cached.tree = STRtree(cached.geometries)


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
        at = assessment_time(at)
        key = f"{risk_mode.get()}:{west},{south},{east},{north}:{resolution}:{at.isoformat() if at else 'latest'}"
        cached = self.cache.get(key)
        now_monotonic = time.monotonic()
        if cached and now_monotonic - cached[0] <= self.cache_seconds:
            return {**cached[1], "cache": "hit"}
        features = []
        cell_width = (east - west) / resolution
        cell_height = (north - south) / resolution
        assessment_context = "historical_reference_scenario"
        for row in range(resolution):
            cell_south = south + cell_height * row
            cell_north = cell_south + cell_height
            latitude = (cell_south + cell_north) / 2
            for column in range(resolution):
                cell_west = west + cell_width * column
                cell_east = cell_west + cell_width
                longitude = (cell_west + cell_east) / 2
                result = await self.orchestrator.point(
                    session,
                    latitude=latitude,
                    longitude=longitude,
                    at=at,
                    persist=False,
                )
                signals = result.signals
                assessment_context = result.assessment_context
                properties = {
                    "mode": result.mode,
                    "scenario": result.scenario,
                    "data_timestamp": result.data_timestamp.isoformat() if result.data_timestamp else None,
                    "data_year": result.data_timestamp.year if result.data_timestamp else None,
                    "elevation_m": signals["terrain"].get("elevation_m"),
                    "slope_deg": signals["terrain"].get("slope_deg"),
                    "rain24": signals["rainfall"].get("rainfall_24h_mm"),
                    "rain72": signals["rainfall"].get("rainfall_72h_mm"),
                    "rain7d": signals["rainfall"].get("rainfall_7d_mm"),
                    "nearby_historical_landslides": signals["historical"].get("historical_events_within_1km"),
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
                    "context": result.assessment_context,
                    "data_sources": ", ".join(
                        f"{item['source']} ({item['status']})" for item in result.data_sources
                    ),
                    "center_longitude": longitude,
                    "center_latitude": latitude,
                }
                features.append(
                    {
                        "type": "Feature",
                        "id": f"risk-{row}-{column}",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[
                                [cell_west, cell_south],
                                [cell_east, cell_south],
                                [cell_east, cell_north],
                                [cell_west, cell_north],
                                [cell_west, cell_south],
                            ]],
                        },
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
                "method": "backend_hybrid_polygon_grid",
                "assessment_context": assessment_context,
                "generated_at": datetime.now().astimezone().isoformat(),
            },
            "cache": "miss",
        }
        self.cache[key] = (now_monotonic, payload)
        return payload

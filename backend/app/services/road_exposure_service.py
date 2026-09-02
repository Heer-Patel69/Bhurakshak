from __future__ import annotations

from typing import Any

from shapely.geometry import LineString, MultiLineString, mapping, shape

from ..utils.geo import haversine_m


class RoadExposureService:
    """Intersects analytical road geometry with risk polygons without claiming closure."""

    def analyze(
        self,
        roads: dict[str, Any],
        risk_zones: dict[str, Any],
        official_status: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        official_status = official_status or {}
        risk_shapes = [
            (shape(feature["geometry"]), feature.get("properties", {}))
            for feature in risk_zones.get("features", [])
            if feature.get("geometry", {}).get("type") in {"Polygon", "MultiPolygon"}
        ]
        features = []
        for index, road in enumerate(roads.get("features", [])):
            geometry = shape(road["geometry"])
            properties = dict(road.get("properties", {}))
            road_id = str(properties.get("road_id") or road.get("id") or f"road-{index}")
            intersections = []
            for risk_geometry, risk_properties in risk_shapes:
                intersected = geometry.intersection(risk_geometry)
                if not intersected.is_empty:
                    intersections.append((intersected, risk_properties))
            exposed_length = sum(self._geodesic_length(item[0]) for item in intersections)
            highest_score = max((float(item[1].get("risk_score", 0)) for item in intersections), default=0.0)
            highest_level = self._level(highest_score)
            if official_status.get(road_id) == "officially_closed":
                status = "officially_closed"
            elif highest_level in {"high", "critical"}:
                status = "high_risk"
            elif intersections:
                status = "exposed"
            else:
                status = "normal"
            properties.update(
                {
                    "road_id": road_id,
                    "road_name": properties.get("name"),
                    "road_type": properties.get("highway") or properties.get("road_type"),
                    "risk_score": round(highest_score, 1),
                    "risk_level": highest_level,
                    "exposed_length_m": round(exposed_length, 1),
                    "highest_intersecting_risk": round(highest_score, 1),
                    "status": status,
                    "closure_confirmed": status == "officially_closed",
                }
            )
            features.append({"type": "Feature", "id": road_id, "geometry": mapping(geometry), "properties": properties})
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {"status": "available", "analysis": "risk_exposure_not_confirmed_blockage"},
        }

    def _geodesic_length(self, geometry) -> float:  # type: ignore[no-untyped-def]
        if isinstance(geometry, MultiLineString):
            return sum(self._geodesic_length(part) for part in geometry.geoms)
        if not isinstance(geometry, LineString):
            return 0.0
        coordinates = list(geometry.coords)
        return sum(
            haversine_m(first[1], first[0], second[1], second[0])
            for first, second in zip(coordinates, coordinates[1:], strict=False)
        )

    @staticmethod
    def _level(score: float) -> str:
        if score >= 75:
            return "critical"
        if score >= 50:
            return "high"
        if score >= 25:
            return "medium"
        return "low"


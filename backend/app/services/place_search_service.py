from __future__ import annotations

from pathlib import Path
from typing import Any

from .geo_service import GeoService


class PlaceSearchService:
    """Builds a process-local search index from the processed Aizawl OSM artifacts."""

    def __init__(
        self,
        geo: GeoService,
        *,
        settlements_path: Path | None,
        facilities_path: Path | None,
        roads_path: Path | None,
    ) -> None:
        self.geo = geo
        self.paths = {
            "settlement": settlements_path,
            "facility": facilities_path,
            "road": roads_path,
        }
        self._items: list[dict[str, Any]] | None = None
        self._external_cache: dict[str, list[dict[str, Any]]] = {}

    def search(self, query: str, *, limit: int = 15) -> dict[str, Any]:
        normalized = " ".join(query.casefold().split())
        if len(normalized) < 2:
            return {"items": [], "count": 0, "source": "local_osm", "query": query}
        if self._items is None:
            self._items = self._build_index()
        tokens = normalized.split()
        matches: list[tuple[tuple[int, int, str], dict[str, Any]]] = []
        for item in self._items:
            candidate = item["name"].casefold()
            if not all(token in candidate for token in tokens):
                continue
            if candidate == normalized:
                rank = 0
            elif candidate.startswith(normalized):
                rank = 1
            elif normalized in candidate:
                rank = 2
            else:
                rank = 3
            type_rank = {"facility": 0, "settlement": 1, "road": 2}.get(item["type"], 3)
            matches.append(((rank, type_rank, candidate), item))
        items = [item for _, item in sorted(matches, key=lambda entry: entry[0])[:limit]]
        source = "local_osm"

        # Fallback to external geocoder if local items are few or empty
        if len(items) < 3:
            external_items = self._search_external(normalized)
            if external_items:
                seen_names = {it["name"].casefold() for it in items}
                for ext in external_items:
                    if ext["name"].casefold() not in seen_names:
                        items.append(ext)
                        seen_names.add(ext["name"].casefold())
                source = "local_osm_with_external_geocoder" if items else "external_geocoder"

        items = items[:limit]
        return {"items": items, "count": len(items), "source": source, "query": query}

    def _search_external(self, query: str) -> list[dict[str, Any]]:
        cached = self._external_cache.get(query)
        if cached is not None:
            return cached

        results: list[dict[str, Any]] = []
        try:
            import httpx
            with httpx.Client(timeout=4.0) as client:
                res = client.get(
                    "https://photon.komoot.io/api/",
                    params={"q": query, "lat": 23.727, "lon": 92.717},
                    headers={"User-Agent": "BhuRakshak-Aizawl-Pilot/1.0"},
                )
                if res.status_code == 200:
                    data = res.json()
                    for idx, feature in enumerate(data.get("features", [])):
                        props = feature.get("properties", {})
                        coords = feature.get("geometry", {}).get("coordinates", [])
                        name = props.get("name")
                        if not name or len(coords) < 2:
                            continue
                        subtype = props.get("osm_value") or props.get("type") or "place"
                        state = props.get("state") or "Mizoram"
                        city = props.get("city") or props.get("county") or "Aizawl"
                        results.append({
                            "id": f"photon-{props.get('osm_id', idx)}",
                            "name": name,
                            "type": "facility" if subtype in {"hospital", "clinic", "university", "college", "school"} else "settlement",
                            "subtype": subtype,
                            "latitude": float(coords[1]),
                            "longitude": float(coords[0]),
                            "display_name": f"{name} · {subtype.title()} · {city}, {state}",
                            "source": "OpenStreetMap / Photon Geocoder",
                        })
        except Exception:
            pass

        self._external_cache[query] = results
        return results

    def health(self) -> dict[str, Any]:
        return {
            "status": "available" if any(path and path.is_file() for path in self.paths.values()) else "not_configured",
            "indexed_items": len(self._items) if self._items is not None else None,
            "source": "processed_aizawl_osm",
        }

    def _build_index(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        for kind, path in self.paths.items():
            collection = self.geo.load_feature_collection(path, layer=f"place_search_{kind}")
            for index, feature in enumerate(collection.get("features", [])):
                properties = feature.get("properties", {})
                name = str(properties.get("name") or properties.get("road_name") or "").strip()
                if not name:
                    continue
                dedupe_key = (kind, name.casefold())
                if dedupe_key in seen:
                    continue
                coordinates = self._representative_point(feature.get("geometry", {}))
                if coordinates is None:
                    continue
                seen.add(dedupe_key)
                longitude, latitude = coordinates
                subtype = properties.get("facility_type") or properties.get("place") or properties.get("highway")
                item_id = str(properties.get("facility_id") or properties.get("village_id") or properties.get("road_id") or feature.get("id") or f"{kind}-{index}")
                label_type = str(subtype or kind).replace("_", " ")
                items.append(
                    {
                        "id": item_id,
                        "name": name,
                        "type": kind,
                        "subtype": subtype,
                        "latitude": latitude,
                        "longitude": longitude,
                        "display_name": f"{name} · {label_type.title()} · Aizawl Pilot",
                        "source": "OpenStreetMap local dataset",
                    }
                )
        return items

    @staticmethod
    def _representative_point(geometry: dict[str, Any]) -> tuple[float, float] | None:
        geometry_type = geometry.get("type")
        coordinates = geometry.get("coordinates")
        if geometry_type == "Point" and isinstance(coordinates, list) and len(coordinates) >= 2:
            return float(coordinates[0]), float(coordinates[1])
        if geometry_type == "LineString" and coordinates:
            coordinate = coordinates[len(coordinates) // 2]
            return float(coordinate[0]), float(coordinate[1])
        if geometry_type == "MultiLineString" and coordinates and coordinates[0]:
            line = coordinates[0]
            coordinate = line[len(line) // 2]
            return float(coordinate[0]), float(coordinate[1])
        return None

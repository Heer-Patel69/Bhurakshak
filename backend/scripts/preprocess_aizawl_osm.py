from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import networkx as nx
import osmium
import yaml
import joblib
from pyproj import Geod
from shapely.geometry import LineString, Point, Polygon, box, mapping


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PBF = REPOSITORY_ROOT / "data" / "gis" / "raw" / "north-eastern-zone-latest.osm.pbf"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "data" / "gis" / "processed"
ROUTING_CONFIG = REPOSITORY_ROOT / "backend" / "config" / "routing.yaml"
DEFAULT_BBOX = (92.60, 23.60, 92.85, 23.85)
HIGHWAY_CLASSES = {
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "residential",
    "unclassified",
    "service",
}
PLACE_TYPES = {"city", "town", "village", "hamlet"}
FACILITY_AMENITIES = {"hospital", "clinic", "police", "fire_station", "ambulance_station"}
GEOD = Geod(ellps="WGS84")


def clean_tag(tags, key: str) -> str | None:  # type: ignore[no-untyped-def]
    value = tags.get(key)
    return str(value) if value not in (None, "") else None


def parse_maxspeed(value: str | None, fallback: float) -> tuple[float, str]:
    if not value:
        return fallback, "configured_default"
    numbers = [float(item) for item in re.findall(r"\d+(?:\.\d+)?", value)]
    if not numbers:
        return fallback, "configured_default"
    speed = min(numbers)
    if "mph" in value.lower():
        speed *= 1.609344
    return max(5.0, min(100.0, speed)), "osm_maxspeed"


def geodesic_length_m(coordinates: list[tuple[float, float]]) -> float:
    if len(coordinates) < 2:
        return 0.0
    longitudes, latitudes = zip(*coordinates, strict=True)
    return abs(float(GEOD.line_length(longitudes, latitudes)))


def feature_collection(features: list[dict[str, Any]], metadata: dict[str, Any]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": features, "metadata": metadata}


class AizawlOSMHandler(osmium.SimpleHandler):
    def __init__(self, bbox_values: tuple[float, float, float, float], speed_defaults: dict[str, float]) -> None:
        super().__init__()
        self.bbox_values = bbox_values
        self.boundary = box(*bbox_values)
        self.speed_defaults = speed_defaults
        self.roads: list[dict[str, Any]] = []
        self.settlements: list[dict[str, Any]] = []
        self.facilities: list[dict[str, Any]] = []
        self.graph = nx.MultiDiGraph()
        self.invalid_geometries = 0
        self.tags_used: Counter[str] = Counter()

    def inside(self, longitude: float, latitude: float) -> bool:
        west, south, east, north = self.bbox_values
        return west <= longitude <= east and south <= latitude <= north

    def node(self, node) -> None:  # type: ignore[no-untyped-def]
        if not node.location.valid() or not self.inside(node.location.lon, node.location.lat):
            return
        tags = node.tags
        place_type = clean_tag(tags, "place")
        if place_type in PLACE_TYPES:
            self.settlements.append(self._point_feature("node", node.id, node.location.lon, node.location.lat, tags, place_type))
        facility_type = self._facility_type(tags)
        if facility_type:
            self.facilities.append(self._point_feature("node", node.id, node.location.lon, node.location.lat, tags, facility_type, facility=True))

    def way(self, way) -> None:  # type: ignore[no-untyped-def]
        coordinates = []
        references = []
        try:
            for node in way.nodes:
                if node.location.valid():
                    coordinates.append((float(node.location.lon), float(node.location.lat)))
                    references.append(str(node.ref))
        except osmium.InvalidLocationError:
            self.invalid_geometries += 1
            return
        if len(coordinates) < 2:
            return
        tags = way.tags
        highway = clean_tag(tags, "highway")
        if highway in HIGHWAY_CLASSES and clean_tag(tags, "access") not in {"private", "no"}:
            self._add_road_way(way.id, coordinates, references, tags, highway)
        place_type = clean_tag(tags, "place")
        if place_type in PLACE_TYPES:
            point = self._representative_point(coordinates)
            if point and self.inside(point.x, point.y):
                self.settlements.append(self._point_feature("way", way.id, point.x, point.y, tags, place_type))
        facility_type = self._facility_type(tags)
        if facility_type:
            point = self._representative_point(coordinates)
            if point and self.inside(point.x, point.y):
                self.facilities.append(self._point_feature("way", way.id, point.x, point.y, tags, facility_type, facility=True))

    def _add_road_way(self, osm_id: int, coordinates, references, tags, highway: str) -> None:  # type: ignore[no-untyped-def]
        for key in ("highway", "name", "surface", "bridge", "tunnel", "oneway", "maxspeed", "access"):
            if clean_tag(tags, key) is not None:
                self.tags_used[key] += 1
        speed, speed_source = parse_maxspeed(clean_tag(tags, "maxspeed"), float(self.speed_defaults[highway]))
        oneway = (clean_tag(tags, "oneway") or "").lower()
        for index, (first, second) in enumerate(zip(coordinates, coordinates[1:], strict=False)):
            segment = LineString([first, second])
            if not segment.is_valid:
                self.invalid_geometries += 1
                continue
            clipped = segment.intersection(self.boundary)
            if clipped.is_empty or clipped.geom_type not in {"LineString", "MultiLineString"}:
                continue
            length_m = geodesic_length_m([first, second])
            if length_m <= 0:
                continue
            travel_time_s = length_m / (speed * 1000 / 3600)
            road_id = f"way/{osm_id}/{index}"
            properties = {
                "road_id": road_id,
                "osm_id": f"way/{osm_id}",
                "name": clean_tag(tags, "name"),
                "highway": highway,
                "surface": clean_tag(tags, "surface"),
                "bridge": clean_tag(tags, "bridge"),
                "tunnel": clean_tag(tags, "tunnel"),
                "oneway": oneway or None,
                "maxspeed": clean_tag(tags, "maxspeed"),
                "speed_kph": round(speed, 2),
                "speed_source": speed_source,
                "length_m": round(length_m, 3),
                "source": "OpenStreetMap",
            }
            self.roads.append(
                {"type": "Feature", "id": road_id, "geometry": mapping(clipped), "properties": properties}
            )
            u, v = references[index], references[index + 1]
            self._add_graph_node(u, first, highway)
            self._add_graph_node(v, second, highway)
            edge_data = {
                "edge_id": road_id,
                "osm_id": f"way/{osm_id}",
                "length_m": float(length_m),
                "travel_time_s": float(travel_time_s),
                "road_name": clean_tag(tags, "name") or "",
                "road_type": highway,
                "surface": clean_tag(tags, "surface") or "",
                "bridge": clean_tag(tags, "bridge") or "",
                "tunnel": clean_tag(tags, "tunnel") or "",
                "speed_kph": float(speed),
                "speed_source": speed_source,
                "geometry": json.dumps([first, second], separators=(",", ":")),
                "risk_score": 0.0,
                "officially_closed": False,
                "verified_blockage": False,
                "unverified_report_count": 0,
                "source": "OpenStreetMap",
            }
            if oneway == "-1":
                self.graph.add_edge(v, u, key=road_id + ":reverse_only", **edge_data)
            elif oneway in {"yes", "1", "true"}:
                self.graph.add_edge(u, v, key=road_id + ":forward", **edge_data)
            else:
                self.graph.add_edge(u, v, key=road_id + ":forward", **edge_data)
                reverse = dict(edge_data)
                reverse["geometry"] = json.dumps([second, first], separators=(",", ":"))
                self.graph.add_edge(v, u, key=road_id + ":reverse", **reverse)

    def _add_graph_node(self, node_id: str, coordinate: tuple[float, float], highway: str) -> None:
        longitude, latitude = coordinate
        major = highway in {"motorway", "trunk", "primary", "secondary"}
        if node_id in self.graph:
            if major:
                self.graph.nodes[node_id]["major_road"] = True
            return
        self.graph.add_node(
            node_id,
            longitude=float(longitude),
            latitude=float(latitude),
            x=float(longitude),
            y=float(latitude),
            major_road=major,
        )

    def _point_feature(self, osm_type: str, osm_id: int, longitude: float, latitude: float, tags, item_type: str, facility: bool = False):  # type: ignore[no-untyped-def]
        identifier = f"{osm_type}/{osm_id}"
        properties = {
            ("facility_id" if facility else "place_id"): identifier,
            "osm_id": identifier,
            "name": clean_tag(tags, "name"),
            ("facility_type" if facility else "place_type"): item_type,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "source": "OpenStreetMap",
        }
        population = clean_tag(tags, "population")
        if population is not None and not facility:
            properties["population"] = population
        return {
            "type": "Feature",
            "id": identifier,
            "geometry": mapping(Point(longitude, latitude)),
            "properties": properties,
        }

    @staticmethod
    def _facility_type(tags) -> str | None:  # type: ignore[no-untyped-def]
        amenity = clean_tag(tags, "amenity")
        healthcare = clean_tag(tags, "healthcare")
        emergency = clean_tag(tags, "emergency")
        if amenity in FACILITY_AMENITIES:
            return amenity
        if healthcare in {"hospital", "clinic"}:
            return healthcare
        if emergency in {"ambulance_station", "emergency_ward_entrance"}:
            return emergency
        return None

    @staticmethod
    def _representative_point(coordinates: list[tuple[float, float]]) -> Point | None:
        try:
            if len(coordinates) >= 4 and coordinates[0] == coordinates[-1]:
                polygon = Polygon(coordinates)
                if polygon.is_valid:
                    return polygon.representative_point()
            line = LineString(coordinates)
            return line.interpolate(0.5, normalized=True)
        except Exception:
            return None


def pbf_header(path: Path) -> dict[str, Any]:
    reader = osmium.io.Reader(str(path))
    try:
        header = reader.header()
        return {
            "generator": header.get("generator"),
            "osmosis_replication_timestamp": header.get("osmosis_replication_timestamp"),
            "osmosis_replication_sequence_number": header.get("osmosis_replication_sequence_number"),
        }
    finally:
        reader.close()


def nearest_node(graph: nx.MultiDiGraph, longitude: float, latitude: float) -> tuple[str | None, float | None]:
    best_node = None
    best_distance = float("inf")
    for node_id, data in graph.nodes(data=True):
        _, _, distance = GEOD.inv(longitude, latitude, float(data["longitude"]), float(data["latitude"]))
        if distance < best_distance:
            best_node = str(node_id)
            best_distance = float(distance)
    return best_node, best_distance if best_node is not None else None


def attach_nearest_nodes(features: list[dict[str, Any]], graph: nx.MultiDiGraph) -> None:
    for feature in features:
        longitude, latitude = feature["geometry"]["coordinates"]
        node_id, distance = nearest_node(graph, longitude, latitude)
        feature["properties"]["nearest_node"] = node_id
        feature["properties"]["snap_distance_m"] = round(distance, 2) if distance is not None else None


def deduplicate(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique = {}
    for feature in features:
        unique[str(feature["id"])] = feature
    return list(unique.values())


def process(pbf_path: Path, output_dir: Path, bbox_values: tuple[float, float, float, float]) -> dict[str, Any]:
    if not pbf_path.is_file():
        raise FileNotFoundError(f"Raw PBF not found: {pbf_path}")
    output_dir.mkdir(parents=True, exist_ok=True)
    with ROUTING_CONFIG.open("r", encoding="utf-8") as handle:
        routing_config = yaml.safe_load(handle)
    handler = AizawlOSMHandler(bbox_values, routing_config["default_speed_kph"])
    handler.apply_file(str(pbf_path), locations=True, idx="flex_mem")
    handler.settlements = deduplicate(handler.settlements)
    handler.facilities = deduplicate(handler.facilities)
    attach_nearest_nodes(handler.settlements, handler.graph)
    attach_nearest_nodes(handler.facilities, handler.graph)

    source_metadata_path = pbf_path.parent / "source_metadata.json"
    source_metadata = json.loads(source_metadata_path.read_text(encoding="utf-8")) if source_metadata_path.is_file() else {}
    header = pbf_header(pbf_path)
    processed_at = datetime.now(UTC).isoformat()
    common_metadata = {
        "source": "OpenStreetMap contributors via Geofabrik",
        "license": "ODbL 1.0",
        "processed_at": processed_at,
        "downloaded_at": source_metadata.get("downloaded_at"),
        "dataset_version": header.get("osmosis_replication_timestamp") or source_metadata.get("last_modified"),
        "source_url": source_metadata.get("source_url"),
        "bbox": list(bbox_values),
        "crs": "EPSG:4326",
    }
    roads_path = output_dir / "aizawl_roads.geojson"
    settlements_path = output_dir / "aizawl_settlements.geojson"
    facilities_path = output_dir / "aizawl_facilities.geojson"
    graph_path = output_dir / "aizawl_road_graph.graphml"
    graph_joblib_path = output_dir / "aizawl_road_graph.joblib"
    roads_path.write_text(json.dumps(feature_collection(handler.roads, {**common_metadata, "layer": "roads"})), encoding="utf-8")
    settlements_path.write_text(
        json.dumps(feature_collection(handler.settlements, {**common_metadata, "layer": "settlements"})), encoding="utf-8"
    )
    facilities_path.write_text(
        json.dumps(feature_collection(handler.facilities, {**common_metadata, "layer": "facilities"})), encoding="utf-8"
    )
    handler.graph.graph.update({key: str(value) for key, value in common_metadata.items() if value is not None})
    nx.write_graphml(handler.graph, graph_path, infer_numeric_types=True)
    joblib.dump(handler.graph, graph_joblib_path, compress=3)

    physical_length = sum(float(item["properties"]["length_m"]) for item in handler.roads)
    facility_counts = Counter(item["properties"]["facility_type"] for item in handler.facilities)
    missing_road_names = sum(1 for item in handler.roads if not item["properties"].get("name"))
    missing_place_names = sum(1 for item in handler.settlements if not item["properties"].get("name"))
    missing_facility_names = sum(1 for item in handler.facilities if not item["properties"].get("name"))
    audit = {
        **common_metadata,
        "road_segments": len(handler.roads),
        "total_road_length_m": round(physical_length, 2),
        "graph_nodes": handler.graph.number_of_nodes(),
        "graph_edges_directed": handler.graph.number_of_edges(),
        "weakly_connected_components": nx.number_weakly_connected_components(handler.graph),
        "largest_weak_component_nodes": max((len(component) for component in nx.weakly_connected_components(handler.graph)), default=0),
        "settlements": len(handler.settlements),
        "hospitals": facility_counts.get("hospital", 0),
        "clinics": facility_counts.get("clinic", 0),
        "police_stations": facility_counts.get("police", 0),
        "fire_stations": facility_counts.get("fire_station", 0),
        "ambulance_or_other_emergency": facility_counts.get("ambulance_station", 0)
        + facility_counts.get("emergency_ward_entrance", 0),
        "facilities_total": len(handler.facilities),
        "osm_tags_used": dict(handler.tags_used),
        "invalid_geometries": handler.invalid_geometries,
        "missing_names": {
            "road_segments": missing_road_names,
            "settlements": missing_place_names,
            "facilities": missing_facility_names,
        },
        "speed_defaults_kph": routing_config["default_speed_kph"],
        "notes": [
            "Roads are physical OSM way-node segments; graph edges are directed and may contain both directions.",
            "Missing names remain null; no road, settlement, facility, or population value is invented.",
            "Node and way POIs are processed; relation-only POIs may require a future area/relation pass.",
        ],
    }
    audit_path = output_dir / "gis_data_audit.md"
    audit_path.write_text(render_audit(audit), encoding="utf-8")
    (output_dir / "gis_data_audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return audit


def render_audit(audit: dict[str, Any]) -> str:
    return f"""# TerraWatch Aizawl GIS data audit

- Source: {audit['source']}
- License: {audit['license']}
- Source URL: {audit['source_url']}
- Downloaded at: {audit['downloaded_at']}
- Dataset version: {audit['dataset_version']}
- Processing timestamp: {audit['processed_at']}
- Output CRS: {audit['crs']}
- Coordinate bounds: {audit['bbox']}

## Counts and geometry

| Metric | Value |
|---|---:|
| Road segments | {audit['road_segments']} |
| Total physical road length (m) | {audit['total_road_length_m']} |
| Graph nodes | {audit['graph_nodes']} |
| Directed graph edges | {audit['graph_edges_directed']} |
| Weakly connected components | {audit['weakly_connected_components']} |
| Largest weak component nodes | {audit['largest_weak_component_nodes']} |
| Settlements | {audit['settlements']} |
| Hospitals | {audit['hospitals']} |
| Clinics | {audit['clinics']} |
| Police stations | {audit['police_stations']} |
| Fire stations | {audit['fire_stations']} |
| Ambulance/other emergency | {audit['ambulance_or_other_emergency']} |
| Total facilities | {audit['facilities_total']} |
| Invalid geometries skipped | {audit['invalid_geometries']} |

## Missing names

| Layer | Missing names |
|---|---:|
| Road segments | {audit['missing_names']['road_segments']} |
| Settlements | {audit['missing_names']['settlements']} |
| Facilities | {audit['missing_names']['facilities']} |

## OSM tags used

```json
{json.dumps(audit['osm_tags_used'], indent=2)}
```

## Conservative default speeds when `maxspeed` is absent

```json
{json.dumps(audit['speed_defaults_kph'], indent=2)}
```

## Notes

""" + "\n".join(f"- {note}" for note in audit["notes"]) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Clip and preprocess the Geofabrik extract for TerraWatch's Aizawl pilot.")
    parser.add_argument("--pbf", type=Path, default=DEFAULT_PBF)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--bbox", default=",".join(str(value) for value in DEFAULT_BBOX))
    args = parser.parse_args()
    bbox_values = tuple(float(value.strip()) for value in args.bbox.split(","))
    if len(bbox_values) != 4:
        raise ValueError("bbox must be west,south,east,north")
    audit = process(args.pbf, args.output_dir, bbox_values)  # type: ignore[arg-type]
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()

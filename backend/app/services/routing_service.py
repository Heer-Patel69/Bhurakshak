from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Hashable, Iterable

import joblib
import networkx as nx
import numpy as np
import yaml
from pyproj import Geod

from ..core.exceptions import TerraWatchError


class RoutingService:
    """Cached OSM routing graph with runtime risk and road-status overlays."""

    def __init__(self, graph_path: Path | None = None, graph: nx.Graph | None = None, config_path: Path | None = None) -> None:
        self.graph_path, self.graph, self.load_error = graph_path, graph, None
        self._node_ids: list[Hashable] = []
        self._node_lonlat = np.empty((0, 2))
        self._risk_points, self._risk_scores = np.empty((0, 2)), np.empty(0)
        self._risk_grid_shape: tuple[int, int] | None = None
        self._risk_bbox: tuple[float, float, float, float] | None = None
        self._statuses: dict[str, dict[str, Any]] = {}
        self.config = {"safer_route": {"risk_time_multiplier": 4, "verified_hazard_penalty_seconds": 10000, "unverified_report_penalty_seconds": 30, "unverified_report_penalty_cap_seconds": 300, "high_risk_threshold": 50}, "network": {"snap_max_distance_m": 5000}}
        if config_path and config_path.exists():
            loaded = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
            for section in self.config:
                self.config[section].update(loaded.get(section, {}))
        if self.graph is None and graph_path:
            self._load()
        self._index_nodes()

    def _load(self) -> None:
        try:
            suffix = self.graph_path.suffix.lower()  # type: ignore[union-attr]
            if suffix in {".joblib", ".pkl", ".pickle"}:
                self.graph = joblib.load(self.graph_path)
            elif suffix == ".graphml":
                self.graph = nx.read_graphml(self.graph_path)
            else:
                with self.graph_path.open("r", encoding="utf-8") as handle:  # type: ignore[union-attr]
                    self.graph = nx.node_link_graph(json.load(handle), edges="links")
        except Exception as exc:
            self.load_error, self.graph = f"{type(exc).__name__}: {exc}", None

    def _index_nodes(self) -> None:
        if self.graph is None:
            return
        indexed = [(n, float(a["longitude"]), float(a["latitude"])) for n, a in self.graph.nodes(data=True) if a.get("longitude") is not None and a.get("latitude") is not None]
        self._node_ids = [x[0] for x in indexed]
        self._node_lonlat = np.asarray([[x[1], x[2]] for x in indexed], dtype=float)

    def health(self) -> dict[str, Any]:
        return {"status": "available" if self.graph is not None else "not_configured", "nodes": 0 if self.graph is None else self.graph.number_of_nodes(), "edges": 0 if self.graph is None else self.graph.number_of_edges(), "source": str(self.graph_path) if self.graph_path else None, "message": self.load_error}

    def set_risk_grid(self, grid: dict[str, Any] | None) -> None:
        values = [(f["geometry"]["coordinates"][:2], float(f.get("properties", {}).get("risk_score", 0))) for f in (grid or {}).get("features", []) if f.get("geometry", {}).get("type") == "Point"]
        self._risk_points = np.asarray([x[0] for x in values], dtype=float).reshape((-1, 2))
        self._risk_scores = np.asarray([x[1] for x in values], dtype=float)
        metadata = (grid or {}).get("metadata", {})
        resolution = metadata.get("resolution")
        self._risk_grid_shape = (int(resolution), int(resolution)) if resolution and len(values) == int(resolution) ** 2 else None
        self._risk_bbox = tuple(float(x) for x in metadata.get("bbox", [])) if len(metadata.get("bbox", [])) == 4 else None

    def set_status_overrides(self, statuses: Iterable[dict[str, Any]]) -> None:
        self._statuses = {str(x["road_id"]): x for x in statuses}

    def nearest_node(self, latitude: float, longitude: float) -> tuple[Hashable, float]:
        if not self._node_ids:
            raise TerraWatchError("ROAD_GRAPH_UNAVAILABLE", "No georeferenced road graph is configured.", status_code=503)
        delta = self._node_lonlat - np.asarray([longitude, latitude])
        index = int(np.argmin(delta[:, 0] ** 2 * math.cos(math.radians(latitude)) ** 2 + delta[:, 1] ** 2))
        lon, lat = self._node_lonlat[index]
        distance = Geod(ellps="WGS84").inv(longitude, latitude, lon, lat)[2]
        maximum = float(self.config["network"]["snap_max_distance_m"])
        if distance > maximum:
            raise TerraWatchError("LOCATION_OUTSIDE_NETWORK", f"Nearest road is {distance:.0f} m away (maximum {maximum:.0f} m).", status_code=422)
        return self._node_ids[index], round(distance, 1)

    def compare_coordinates(self, origin: dict[str, float], destination: dict[str, float]) -> dict[str, Any]:
        source, source_snap = self.nearest_node(origin["latitude"], origin["longitude"])
        target, target_snap = self.nearest_node(destination["latitude"], destination["longitude"])
        result = self.compare(source, target)
        result["snapping"] = {"origin_node": str(source), "origin_distance_m": source_snap, "destination_node": str(target), "destination_distance_m": target_snap}
        return result

    def compare(self, source: Hashable, destination: Hashable) -> dict[str, Any]:
        if self.graph is None:
            raise TerraWatchError("ROAD_GRAPH_UNAVAILABLE", "No analytical road graph is configured.", status_code=503)
        source, destination = self._resolve_node(source), self._resolve_node(destination)
        try:
            fastest_nodes = nx.shortest_path(self.graph, source, destination, weight=self._fastest_weight)
            safer_nodes = nx.shortest_path(self.graph, source, destination, weight=self._safer_weight)
        except (nx.NodeNotFound, nx.NetworkXNoPath) as exc:
            raise TerraWatchError("ROUTE_NOT_FOUND", str(exc), status_code=404) from exc
        fastest, safer = self._summarize(fastest_nodes, False), self._summarize(safer_nodes, True)
        return {"fastest_route": fastest, "safer_route": safer, "distance_difference_m": round(safer["distance_m"] - fastest["distance_m"], 1), "eta_difference_seconds": round(safer["eta_seconds"] - fastest["eta_seconds"], 1), "risk_exposure_difference": round(safer["risk_exposure_score"] - fastest["risk_exposure_score"], 1), "reason_safer_route_was_chosen": "Lower risk and verified-hazard penalty." if safer_nodes != fastest_nodes else "Fastest route is also the lowest-penalty available route.", "official_closures_are_non_routable": True, "unverified_reports_close_edges": False}

    def rank_targets(self, source: Hashable, targets: Iterable[Hashable]) -> list[tuple[Hashable, dict[str, Any]]]:
        """Rank many destinations with one safer-route Dijkstra traversal."""
        if self.graph is None:
            return []
        source = self._resolve_node(source)
        _, paths = nx.single_source_dijkstra(self.graph, source, weight=self._safer_weight)
        ranked = []
        for target in targets:
            resolved = self._resolve_node(target)
            if resolved in paths:
                ranked.append((target, self._summarize(paths[resolved], True)))
        return sorted(ranked, key=lambda item: item[1]["eta_seconds"])

    def _resolve_node(self, value: Hashable) -> Hashable:
        if self.graph is not None and value in self.graph:
            return value
        if self.graph is not None:
            for candidate in self.graph.nodes:
                if str(candidate) == str(value):
                    return candidate
        return value

    @staticmethod
    def _options(data: dict[str, Any]) -> list[dict[str, Any]]:
        return [data] if "travel_time_s" in data or "length_m" in data else [v for v in data.values() if isinstance(v, dict)]

    def _status(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return self._statuses.get(str(attrs.get("edge_id", "")), {})

    def _risk(self, u: Hashable, v: Hashable, attrs: dict[str, Any]) -> float:
        if not len(self._risk_points) or self.graph is None:
            return float(attrs.get("risk_score", 0))
        a, b = self.graph.nodes[u], self.graph.nodes[v]
        midpoint = np.asarray([(float(a["longitude"]) + float(b["longitude"])) / 2, (float(a["latitude"]) + float(b["latitude"])) / 2])
        if self._risk_grid_shape and self._risk_bbox:
            resolution = self._risk_grid_shape[0]
            west, south, east, north = self._risk_bbox
            column = int(np.clip(round((midpoint[0] - west) / (east - west) * (resolution - 1)), 0, resolution - 1))
            row = int(np.clip(round((midpoint[1] - south) / (north - south) * (resolution - 1)), 0, resolution - 1))
            return float(self._risk_scores[row * resolution + column])
        return float(self._risk_scores[int(np.argmin(np.sum((self._risk_points - midpoint) ** 2, axis=1)))])

    def _edge_weight(self, u: Hashable, v: Hashable, attrs: dict[str, Any], safer: bool) -> float | None:
        status = self._status(attrs)
        if attrs.get("officially_closed") or (status.get("status") == "officially_closed" and status.get("verified") is True):
            return None
        travel = float(attrs.get("travel_time_s", attrs.get("travel_time", 1)))
        if not safer:
            return travel
        cfg, risk = self.config["safer_route"], self._risk(u, v, attrs) / 100
        verified = bool(attrs.get("verified_blockage")) or bool(status.get("verified") and status.get("status") in {"blocked", "hazard", "restricted"})
        reports = float(attrs.get("unverified_report_count", 0)) + (1 if status and not status.get("verified") else 0)
        return travel * (1 + float(cfg["risk_time_multiplier"]) * risk) + (float(cfg["verified_hazard_penalty_seconds"]) if verified else 0) + min(float(cfg["unverified_report_penalty_cap_seconds"]), float(cfg["unverified_report_penalty_seconds"]) * reports)

    def _weight(self, u: Hashable, v: Hashable, data: dict[str, Any], safer: bool) -> float | None:
        weights = [w for a in self._options(data) if (w := self._edge_weight(u, v, a, safer)) is not None]
        return min(weights) if weights else None

    def _fastest_weight(self, u, v, data):  # type: ignore[no-untyped-def]
        return self._weight(u, v, data, False)

    def _safer_weight(self, u, v, data):  # type: ignore[no-untyped-def]
        return self._weight(u, v, data, True)

    def _selected(self, u: Hashable, v: Hashable, safer: bool) -> dict[str, Any]:
        candidates = [(self._edge_weight(u, v, a, safer), a) for a in self._options(self.graph.get_edge_data(u, v) or {})]  # type: ignore[union-attr]
        return min((x for x in candidates if x[0] is not None), key=lambda x: x[0])[1]

    def _summarize(self, nodes: list[Hashable], safer: bool) -> dict[str, Any]:
        distance = travel = weighted = high_distance = 0.0
        affected: list[str] = []
        coordinates = [
            [float(self.graph.nodes[n]["longitude"]), float(self.graph.nodes[n]["latitude"])]  # type: ignore[union-attr]
            for n in nodes
            if self.graph.nodes[n].get("longitude") is not None and self.graph.nodes[n].get("latitude") is not None  # type: ignore[union-attr]
        ]
        threshold = float(self.config["safer_route"]["high_risk_threshold"])
        for u, v in zip(nodes, nodes[1:], strict=False):
            attrs = self._selected(u, v, safer)
            length, risk = float(attrs.get("length_m", attrs.get("length", 0))), self._risk(u, v, attrs)
            distance, travel, weighted = distance + length, travel + float(attrs.get("travel_time_s", attrs.get("travel_time", 0))), weighted + length * risk
            if risk >= threshold:
                high_distance += length
                affected.append(str(attrs.get("edge_id")))
        exposure = weighted / distance if distance else 0
        return {"nodes": [str(n) for n in nodes], "distance_m": round(distance, 1), "eta_seconds": round(travel, 1), "travel_time_seconds": round(travel, 1), "risk_exposure_score": round(exposure, 1), "risk_exposure": round(exposure, 1), "high_risk_distance_m": round(high_distance, 1), "affected_segments": affected, "route_geometry": {"type": "LineString", "coordinates": coordinates}}

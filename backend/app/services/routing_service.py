from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Hashable

import networkx as nx

from ..core.exceptions import TerraWatchError


class RoutingService:
    def __init__(self, graph_path: Path | None = None, graph: nx.Graph | None = None) -> None:
        self.graph_path = graph_path
        self.graph = graph
        self.load_error: str | None = None
        if self.graph is None and graph_path:
            self._load()

    def _load(self) -> None:
        try:
            with self.graph_path.open("r", encoding="utf-8") as handle:  # type: ignore[union-attr]
                self.graph = nx.node_link_graph(json.load(handle), edges="links")
        except Exception as exc:
            self.load_error = f"{type(exc).__name__}: {exc}"
            self.graph = None

    def health(self) -> dict[str, Any]:
        return {
            "status": "available" if self.graph is not None else "not_configured",
            "nodes": 0 if self.graph is None else self.graph.number_of_nodes(),
            "edges": 0 if self.graph is None else self.graph.number_of_edges(),
            "source": str(self.graph_path) if self.graph_path else None,
            "message": self.load_error or (None if self.graph is not None else "No analytical OSM road graph is configured."),
        }

    def compare(self, source: Hashable, destination: Hashable) -> dict[str, Any]:
        if self.graph is None:
            raise TerraWatchError("ROAD_GRAPH_UNAVAILABLE", "No analytical road graph is configured.", status_code=503)
        source = self._resolve_node(source)
        destination = self._resolve_node(destination)
        try:
            fastest_nodes = nx.shortest_path(self.graph, source, destination, weight=self._fastest_weight)
            safer_nodes = nx.shortest_path(self.graph, source, destination, weight=self._safer_weight)
        except (nx.NodeNotFound, nx.NetworkXNoPath) as exc:
            raise TerraWatchError("ROUTE_NOT_FOUND", str(exc), status_code=404) from exc
        fastest = self._summarize(fastest_nodes)
        safer = self._summarize(safer_nodes)
        return {
            "fastest_route": fastest,
            "safer_route": safer,
            "distance_difference_m": round(safer["distance_m"] - fastest["distance_m"], 1),
            "eta_difference_seconds": round(safer["travel_time_seconds"] - fastest["travel_time_seconds"], 1),
            "risk_exposure_difference": round(safer["risk_exposure"] - fastest["risk_exposure"], 1),
            "reason_safer_route_was_chosen": (
                "Lower cumulative risk/verified-blockage penalty." if safer_nodes != fastest_nodes else "Fastest route is also the lowest-penalty available route."
            ),
            "official_closures_are_non_routable": True,
            "unverified_reports_close_edges": False,
        }

    def _resolve_node(self, value: Hashable) -> Hashable:
        if self.graph is not None and value in self.graph:
            return value
        if self.graph is not None:
            for candidate in self.graph.nodes:
                if str(candidate) == str(value):
                    return candidate
        return value

    def _edge_attributes(self, data: dict[str, Any]) -> dict[str, Any]:
        if "travel_time" in data or "travel_time_s" in data or "length" in data:
            return data
        if data and all(isinstance(value, dict) for value in data.values()):
            return min(data.values(), key=self._fastest_weight)
        return data

    def _fastest_weight(self, _u, _v, data) -> float:  # type: ignore[no-untyped-def]
        attributes = self._edge_attributes(data)
        if attributes.get("officially_closed"):
            return float("inf")
        return float(attributes.get("travel_time_s", attributes.get("travel_time", 1.0)))

    def _safer_weight(self, _u, _v, data) -> float:  # type: ignore[no-untyped-def]
        attributes = self._edge_attributes(data)
        if attributes.get("officially_closed"):
            return float("inf")
        travel = float(attributes.get("travel_time_s", attributes.get("travel_time", 1.0)))
        risk = float(attributes.get("risk_score", 0.0)) / 100.0
        verified_penalty = 10_000.0 if attributes.get("verified_blockage") else 0.0
        unverified_penalty = min(300.0, 30.0 * float(attributes.get("unverified_report_count", 0)))
        return travel * (1 + 4 * risk) + verified_penalty + unverified_penalty

    def _summarize(self, nodes: list[Hashable]) -> dict[str, Any]:
        distance = travel = exposure = 0.0
        for first, second in zip(nodes, nodes[1:], strict=False):
            data = self._edge_attributes(self.graph.get_edge_data(first, second) or {})  # type: ignore[union-attr]
            distance += float(data.get("length_m", data.get("length", 0.0)))
            travel += float(data.get("travel_time_s", data.get("travel_time", 0.0)))
            exposure += float(data.get("risk_score", 0.0))
        return {
            "nodes": list(nodes),
            "distance_m": round(distance, 1),
            "travel_time_seconds": round(travel, 1),
            "risk_exposure": round(exposure, 1),
        }


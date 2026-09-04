from __future__ import annotations

from typing import Any, Hashable, Literal

import networkx as nx


class IsolationService:
    """Runs explicit confirmed-closure or risk-scenario connectivity analysis."""

    def analyze(
        self,
        graph: nx.Graph,
        villages: list[dict[str, Any]],
        hospital_nodes: list[Hashable],
        affected_edges: list[tuple[Hashable, Hashable]],
        *,
        analysis_mode: Literal["confirmed_closure", "risk_scenario"],
        major_road_nodes: list[Hashable] | None = None,
    ) -> list[dict[str, Any]]:
        major_road_nodes = hospital_nodes if major_road_nodes is None else major_road_nodes
        scenario = graph.copy()
        scenario.remove_edges_from(affected_edges)
        reverse = scenario.reverse(copy=False) if scenario.is_directed() else scenario
        hospital_sources = [node for node in hospital_nodes if node in reverse]
        major_sources = [node for node in major_road_nodes if node in reverse]
        hospital_reachers = set(nx.multi_source_dijkstra_path_length(reverse, hospital_sources, weight=None)) if hospital_sources else set()
        major_reachers = set(nx.multi_source_dijkstra_path_length(reverse, major_sources, weight=None)) if major_sources else set()
        results = []
        for village in villages:
            node = village["nearest_node"]
            hospital_reachable = node in hospital_reachers
            main_road_reachable = node in major_reachers
            isolated = not hospital_reachable and not main_road_reachable
            if isolated:
                status = "confirmed_isolated" if analysis_mode == "confirmed_closure" and affected_edges else "potentially_isolated"
            elif affected_edges:
                status = "at_risk"
            else:
                status = "connected"
            results.append(
                {
                    "village_id": village["village_id"],
                    "village_name": village.get("village_name"),
                    "isolation_status": status,
                    "reachable_hospital": hospital_reachable,
                    "reachable_main_road": main_road_reachable,
                    "alternative_routes": int(hospital_reachable) + int(main_road_reachable),
                    "hospital_reachable": hospital_reachable,
                    "major_road_reachable": main_road_reachable,
                    "alternative_routes_available": hospital_reachable or main_road_reachable,
                    "affected_edges": [list(edge) for edge in affected_edges],
                    "analysis_mode": analysis_mode,
                }
            )
        return results

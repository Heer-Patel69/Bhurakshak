from __future__ import annotations

from typing import Any, Hashable, Literal

import networkx as nx


class IsolationService:
    """Runs explicit confirmed-closure or risk-scenario connectivity analysis."""

    def analyze(
        self,
        graph: nx.Graph,
        villages: list[dict[str, Any]],
        critical_destinations: list[Hashable],
        affected_edges: list[tuple[Hashable, Hashable]],
        *,
        analysis_mode: Literal["confirmed_closure", "risk_scenario"],
    ) -> list[dict[str, Any]]:
        scenario = graph.copy()
        scenario.remove_edges_from(affected_edges)
        results = []
        for village in villages:
            node = village["nearest_node"]
            reachable_destinations = [
                destination
                for destination in critical_destinations
                if node in scenario and destination in scenario and nx.has_path(scenario, node, destination)
            ]
            isolated = not reachable_destinations
            if isolated:
                status = "confirmed_unreachable" if analysis_mode == "confirmed_closure" else "potentially_isolated"
            else:
                status = "connected"
            results.append(
                {
                    "village_id": village["village_id"],
                    "village_name": village.get("village_name"),
                    "isolation_status": status,
                    "reachable_hospital": bool(reachable_destinations),
                    "reachable_main_road": bool(reachable_destinations),
                    "alternative_routes": len(reachable_destinations),
                    "affected_edges": [list(edge) for edge in affected_edges],
                    "analysis_mode": analysis_mode,
                }
            )
        return results


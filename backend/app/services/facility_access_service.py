from __future__ import annotations

from typing import Any, Hashable

from .routing_service import RoutingService


class FacilityAccessService:
    def __init__(self, routing: RoutingService) -> None:
        self.routing = routing

    def assess(self, source_node: Hashable, facilities: list[dict[str, Any]]) -> dict[str, Any]:
        candidates = []
        for facility in facilities:
            try:
                routes = self.routing.compare(source_node, facility["nearest_node"])
                safer = routes["safer_route"]
                candidates.append((safer["travel_time_seconds"], facility, routes))
            except Exception:
                continue
        if not candidates:
            return {
                "accessibility_status": "confirmed_unreachable" if self.routing.graph is not None else "not_configured",
                "nearest_facility": None,
            }
        _, facility, routes = min(candidates, key=lambda item: item[0])
        safer = routes["safer_route"]
        if safer["risk_exposure"] >= 75:
            status = "potentially_disrupted"
        elif safer["risk_exposure"] > 0:
            status = "accessible_with_risk"
        else:
            status = "accessible"
        return {
            "nearest_facility": facility,
            "route_distance_m": safer["distance_m"],
            "estimated_travel_time_seconds": safer["travel_time_seconds"],
            "route_risk_exposure": safer["risk_exposure"],
            "accessibility_status": status,
        }


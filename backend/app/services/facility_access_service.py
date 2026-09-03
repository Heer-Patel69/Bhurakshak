from __future__ import annotations

from typing import Any, Hashable

from .routing_service import RoutingService


class FacilityAccessService:
    def __init__(self, routing: RoutingService) -> None:
        self.routing = routing

    def assess(self, source_node: Hashable, facilities: list[dict[str, Any]]) -> dict[str, Any]:
        by_node = {str(facility["nearest_node"]): facility for facility in facilities}
        candidates = [(route["eta_seconds"], by_node[str(node)], route) for node, route in self.routing.rank_targets(source_node, by_node)]
        if not candidates:
            return {
                "accessibility_status": "confirmed_unreachable" if self.routing.graph is not None else "not_configured",
                "nearest_facility": None,
            }
        candidates.sort(key=lambda item: item[0])
        _, facility, safer = candidates[0]
        hospitals = [item for item in candidates if item[1]["facility_type"] in {"hospital", "clinic"}]
        emergencies = [item for item in candidates if item[1]["facility_type"] in {"police", "fire_station", "ambulance_station", "emergency"}]
        if safer["risk_exposure_score"] >= 75:
            status = "potentially_disrupted"
        elif safer["risk_exposure"] > 0:
            status = "accessible_with_risk"
        else:
            status = "accessible"
        return {
            "nearest_facility": facility,
            "nearest_hospital": hospitals[0][1] if hospitals else None,
            "nearest_emergency": emergencies[0][1] if emergencies else None,
            "alternative_facility": candidates[1][1] if len(candidates) > 1 else None,
            "route_distance_m": safer["distance_m"],
            "estimated_travel_time_seconds": safer["eta_seconds"],
            "route_risk_exposure": safer["risk_exposure_score"],
            "route_geometry": safer["route_geometry"],
            "accessibility_status": status,
        }

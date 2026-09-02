from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/villages", tags=["villages"])


@router.get("")
def villages(request: Request) -> dict:
    return request.app.state.services.geo.load_feature_collection(
        request.app.state.settings.villages_geojson_path,
        layer="villages",
    )


@router.get("/isolation")
def village_isolation(
    request: Request,
    analysis_mode: Literal["confirmed_closure", "risk_scenario"] = Query(default="risk_scenario"),
) -> dict:
    services = request.app.state.services
    if services.routing.graph is None:
        return {
            "status": "not_configured",
            "analysis_mode": analysis_mode,
            "villages": [],
            "message": "Road graph and village node mappings are required for isolation analysis.",
        }
    collection = services.geo.load_feature_collection(request.app.state.settings.villages_geojson_path, layer="villages")
    villages_data = []
    for feature in collection.get("features", []):
        properties = feature.get("properties", {})
        if "nearest_node" in properties:
            villages_data.append(
                {
                    "village_id": str(properties.get("village_id") or feature.get("id")),
                    "village_name": properties.get("name"),
                    "nearest_node": properties["nearest_node"],
                }
            )
    destination_nodes = [
        node for node, attrs in services.routing.graph.nodes(data=True) if attrs.get("critical_destination")
    ]
    affected_edges = [
        (u, v)
        for u, v, attrs in services.routing.graph.edges(data=True)
        if (attrs.get("officially_closed") if analysis_mode == "confirmed_closure" else attrs.get("risk_score", 0) >= 75)
    ]
    return {
        "status": "available",
        "analysis_mode": analysis_mode,
        "villages": services.isolation.analyze(
            services.routing.graph,
            villages_data,
            destination_nodes,
            affected_edges,
            analysis_mode=analysis_mode,
        ),
    }


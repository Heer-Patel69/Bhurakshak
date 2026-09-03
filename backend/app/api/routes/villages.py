from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ...dependencies import get_db_session
from ...models.database import RoadStatusDB


router = APIRouter(prefix="/villages", tags=["villages"])


@router.get("")
def villages(request: Request) -> dict:
    return request.app.state.services.geo.load_feature_collection(
        request.app.state.settings.villages_geojson_path,
        layer="villages",
    )


@router.get("/isolation")
async def village_isolation(
    request: Request,
    analysis_mode: Literal["confirmed_closure", "risk_scenario"] = Query(default="risk_scenario"),
    session: Session = Depends(get_db_session),
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
    facilities = services.geo.load_feature_collection(request.app.state.settings.facilities_geojson_path, layer="facilities")
    hospital_nodes = [f["properties"]["nearest_node"] for f in facilities.get("features", []) if f.get("properties", {}).get("facility_type") in {"hospital", "clinic"} and f["properties"].get("nearest_node")]
    major_nodes = [node for node, attrs in services.routing.graph.nodes(data=True) if attrs.get("major_road")]
    if analysis_mode == "risk_scenario":
        grid = await services.risk_grid.generate(session, bbox=request.app.state.settings.aizawl_gis_bbox, resolution=request.app.state.settings.routing_risk_grid_resolution)
        services.routing.set_risk_grid(grid)
        affected_edges = [(u, v) for u, v, attrs in services.routing.graph.edges(data=True) if services.routing._risk(u, v, attrs) >= 75]
    else:
        closed_ids = {row.road_id for row in session.query(RoadStatusDB).filter(RoadStatusDB.status == "officially_closed", RoadStatusDB.verified.is_(True)).all()}
        affected_edges = [(u, v) for u, v, attrs in services.routing.graph.edges(data=True) if attrs.get("officially_closed") or str(attrs.get("edge_id")) in closed_ids]
    return {
        "status": "available",
        "analysis_mode": analysis_mode,
        "villages": services.isolation.analyze(
            services.routing.graph,
            villages_data,
            hospital_nodes,
            affected_edges,
            analysis_mode=analysis_mode,
            major_road_nodes=major_nodes,
        ),
    }

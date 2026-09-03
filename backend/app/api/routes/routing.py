from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...dependencies import get_db_session
from ...models.database import RoadStatusDB
from ...models.schemas import RouteCompareRequest


router = APIRouter(prefix="/routes", tags=["routing"])


@router.post("/compare")
async def compare_routes(payload: RouteCompareRequest, request: Request, session: Session = Depends(get_db_session)) -> dict:
    services, settings = request.app.state.services, request.app.state.settings
    grid = await services.risk_grid.generate(session, bbox=settings.aizawl_gis_bbox, resolution=settings.routing_risk_grid_resolution)
    services.routing.set_risk_grid(grid)
    services.routing.set_status_overrides(
        [{"road_id": row.road_id, "status": row.status, "source": row.source, "verified": row.verified} for row in session.query(RoadStatusDB).all()]
    )
    return services.routing.compare_coordinates(payload.origin.model_dump(), payload.destination.model_dump())

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request
from shapely.geometry import shape
from sqlalchemy.orm import Session

from ...dependencies import get_db_session
from ...core.security import require_authority_key
from ...models.database import RoadStatusDB
from ...models.schemas import RoadStatusUpdate


router = APIRouter(prefix="/roads", tags=["roads"])


@router.get("")
def roads(request: Request, bbox: str | None = Query(default=None), offset: int = Query(default=0, ge=0), limit: int | None = Query(default=None, ge=1)) -> dict:
    settings = request.app.state.settings
    return request.app.state.services.geo.load_feature_collection(
        settings.roads_geojson_path,
        layer="roads",
        bbox=bbox,
        offset=offset,
        limit=min(limit or settings.gis_default_limit, settings.gis_max_limit),
    )


@router.get("/exposure")
async def road_exposure(
    request: Request,
    bbox: str = Query(default="92.64,23.63,92.80,23.82"),
    resolution: int = Query(default=5, ge=2),
    limit: int = Query(default=800, ge=1, le=5_000),
    session: Session = Depends(get_db_session),
) -> dict:
    services = request.app.state.services
    grid = await services.risk_grid.generate(session, bbox=bbox, resolution=resolution)
    risk_polygons = grid
    road_data = services.geo.load_feature_collection(
        request.app.state.settings.roads_geojson_path,
        layer="roads",
        bbox=bbox,
        limit=limit,
    )
    statuses = {row.road_id: {"status": row.status, "verified": row.verified, "source": row.source} for row in session.query(RoadStatusDB).all()}
    return services.road_exposure.analyze(road_data, risk_polygons, statuses)


@router.patch("/{road_id}/status", dependencies=[Depends(require_authority_key)])
def update_road_status(road_id: str, payload: RoadStatusUpdate, session: Session = Depends(get_db_session)) -> dict:
    row = session.query(RoadStatusDB).filter(RoadStatusDB.road_id == road_id).order_by(RoadStatusDB.updated_at.desc()).first()
    if row is None:
        row = RoadStatusDB(road_status_id=str(uuid4()), road_id=road_id)
        session.add(row)
    row.status, row.source, row.verified = payload.status, payload.source, payload.verified
    row.geometry, row.observed_at, row.expires_at = payload.geometry, payload.observed_at or datetime.now(UTC), payload.expires_at
    session.flush()
    return {"road_id": row.road_id, "status": row.status, "source": row.source, "verified": row.verified, "observed_at": row.observed_at}

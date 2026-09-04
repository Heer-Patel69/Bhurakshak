from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ...dependencies import get_db_session

router = APIRouter(prefix="/soil", tags=["soil"])


@router.get("/status")
def soil_status(request: Request, session: Session = Depends(get_db_session)) -> dict:
    sensor = request.app.state.services.sensors.status(session)
    return {"status": sensor["status"], "historical_dataset": {"status": "unavailable", "message": "No soil dataset/report is present in this project."}, "live_sensor": sensor}


@router.get("/point")
def soil_point(request: Request, latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180), session: Session = Depends(get_db_session)) -> dict:
    return request.app.state.services.sensors.nearest_signal(session, latitude, longitude)


@router.get("/grid")
def soil_grid() -> dict:
    return {"type": "FeatureCollection", "features": [], "metadata": {"status": "unavailable", "message": "No historical soil dataset/report is present."}}


@router.get("/history")
def soil_history() -> dict:
    return {"status": "unavailable", "records": [], "message": "No historical soil dataset/report is present."}

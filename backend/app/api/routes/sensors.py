from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ...core.security import require_sensor_secret
from ...dependencies import get_db_session
from ...models.schemas import SensorReadingCreate


router = APIRouter(prefix="/sensors", tags=["sensors"])


@router.post("/ingest", dependencies=[Depends(require_sensor_secret)], status_code=status.HTTP_201_CREATED)
def ingest_sensor(
    payload: SensorReadingCreate,
    request: Request,
    session: Session = Depends(get_db_session),
) -> dict:
    reading = request.app.state.services.sensors.ingest(session, payload)
    logging.getLogger("terrawatch.sensor").info("Sensor reading ingested", extra={"event": "sensor_ingest"})
    return request.app.state.services.sensors.serialize(reading)


@router.post("/readings", dependencies=[Depends(require_sensor_secret)], status_code=status.HTTP_201_CREATED)
def ingest_sensor_reading(
    payload: SensorReadingCreate,
    request: Request,
    session: Session = Depends(get_db_session),
) -> dict:
    """ESP32-compatible alias for the protected sensor-ingest endpoint."""
    reading = request.app.state.services.sensors.ingest(session, payload)
    return request.app.state.services.sensors.serialize(reading)


@router.get("/status")
def sensor_status(request: Request, session: Session = Depends(get_db_session)) -> dict:
    return request.app.state.services.sensors.status(session)

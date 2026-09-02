from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...dependencies import get_db_session
from ...repositories.incidents_repository import IncidentsRepository
from ...repositories.reports_repository import ReportsRepository
from ...repositories.risk_repository import RiskRepository
from ...repositories.sensors_repository import SensorsRepository


router = APIRouter(prefix="/sync", tags=["offline sync"])


@router.get("/changes")
def sync_changes(
    since: datetime = Query(),
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_db_session),
) -> dict:
    normalized = since.replace(tzinfo=UTC) if since.tzinfo is None else since.astimezone(UTC)
    reports = ReportsRepository(session).list(limit=limit, updated_since=normalized)
    incidents = IncidentsRepository(session).list(limit=limit, updated_since=normalized)
    risks = RiskRepository(session).changes(normalized, limit=limit)
    sensors = SensorsRepository(session).changes(normalized, limit=limit)
    return {
        "since": normalized,
        "generated_at": datetime.now(UTC),
        "reports": [{"id": item.report_id, "updated_at": item.updated_at} for item in reports],
        "incidents": [{"id": item.incident_id, "updated_at": item.updated_at} for item in incidents],
        "risk_snapshots": [{"id": item.snapshot_id, "updated_at": item.updated_at} for item in risks],
        "sensor_readings": [{"id": item.reading_id, "created_at": item.created_at} for item in sensors],
        "next_since": datetime.now(UTC),
    }


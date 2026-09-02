from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...core.exceptions import TerraWatchError
from ...core.security import require_authority_key
from ...dependencies import get_db_session
from ...models.database import AuthorityActionDB
from ...models.schemas import IncidentVerification
from ...repositories.incidents_repository import IncidentsRepository


router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", dependencies=[Depends(require_authority_key)])
def list_incidents(
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_db_session),
) -> dict:
    incidents = IncidentsRepository(session).list(limit=limit)
    return {
        "items": [
            {
                "incident_id": item.incident_id,
                "centroid": {"latitude": item.centroid_latitude, "longitude": item.centroid_longitude},
                "category": item.category,
                "report_count": item.report_count,
                "verification_status": item.verification_status,
                "severity": item.severity,
                "affected_road_ids": item.affected_road_ids,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            }
            for item in incidents
        ],
        "count": len(incidents),
    }


@router.patch("/{incident_id}/verify", dependencies=[Depends(require_authority_key)])
def verify_incident(
    incident_id: str,
    payload: IncidentVerification,
    session: Session = Depends(get_db_session),
) -> dict:
    incident = IncidentsRepository(session).get(incident_id)
    if incident is None:
        raise TerraWatchError("INCIDENT_NOT_FOUND", "Incident was not found.", status_code=404)
    incident.verification_status = payload.status
    incident.severity = payload.severity
    incident.affected_road_ids = payload.affected_road_ids
    incident.updated_at = datetime.now(UTC)
    session.add(
        AuthorityActionDB(
            action_id=__import__("uuid").uuid4().hex,
            actor_id=payload.verified_by,
            action_type=f"incident_{payload.status}",
            target_type="incident",
            target_id=incident_id,
            details={"severity": payload.severity, "affected_road_ids": payload.affected_road_ids},
        )
    )
    return {
        "incident_id": incident.incident_id,
        "verification_status": incident.verification_status,
        "severity": incident.severity,
        "affected_road_ids": incident.affected_road_ids,
    }

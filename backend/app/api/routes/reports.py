from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from ...core.security import require_authority_key
from ...dependencies import get_db_session
from ...models.database import AuthorityActionDB
from ...models.schemas import CitizenReportCreate, CitizenReportRead, ReportVerification
from ...repositories.reports_repository import ReportsRepository


router = APIRouter(prefix="/reports", tags=["citizen reports"])


@router.post("", response_model=CitizenReportRead, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: CitizenReportCreate,
    request: Request,
    session: Session = Depends(get_db_session),
) -> CitizenReportRead:
    report = request.app.state.services.reports.create(session, payload)
    return CitizenReportRead.model_validate(report)


@router.get("", dependencies=[Depends(require_authority_key)])
def list_reports(
    verification_status: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_db_session),
) -> dict:
    reports = ReportsRepository(session).list(
        offset=offset,
        limit=limit,
        verification_status=verification_status,
    )
    return {
        "items": [CitizenReportRead.model_validate(item).model_dump(mode="json") for item in reports],
        "offset": offset,
        "limit": limit,
        "count": len(reports),
    }


@router.patch("/{report_id}/verify", dependencies=[Depends(require_authority_key)])
def verify_report(
    report_id: str,
    payload: ReportVerification,
    request: Request,
    session: Session = Depends(get_db_session),
) -> dict:
    report = request.app.state.services.reports.verify(session, report_id, payload)
    incident = request.app.state.services.incidents.cluster_verified_report(session, report)
    session.add(
        AuthorityActionDB(
            action_id=__import__("uuid").uuid4().hex,
            actor_id=payload.verified_by,
            action_type=f"report_{payload.status}",
            target_type="citizen_report",
            target_id=report_id,
            details={"severity": payload.severity, "incident_id": incident.incident_id if incident else None},
        )
    )
    return {
        "report": CitizenReportRead.model_validate(report).model_dump(mode="json"),
        "incident_id": incident.incident_id if incident else None,
    }

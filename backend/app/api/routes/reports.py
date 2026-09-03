from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from ...core.security import require_authority_key
from ...dependencies import get_db_session
from ...models.database import AuthorityActionDB, ReportMediaDB, RoadStatusDB
from ...models.schemas import CitizenReportCreate, CitizenReportRead, ReportVerification
from ...repositories.reports_repository import ReportsRepository


router = APIRouter(prefix="/reports", tags=["citizen reports"])


def _media_dict(item: ReportMediaDB) -> dict:
    return {"media_id": item.media_id, "report_id": item.report_id, "storage_path": item.storage_path, "media_type": item.media_type, "mime_type": item.mime_type, "file_size_bytes": item.file_size_bytes, "uploaded_at": item.uploaded_at, "source": item.source, "original_filename": item.original_filename, "sha256": item.sha256}


@router.post("", response_model=CitizenReportRead, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: CitizenReportCreate,
    request: Request,
    session: Session = Depends(get_db_session),
) -> CitizenReportRead:
    report = request.app.state.services.reports.create(session, payload)
    return CitizenReportRead.model_validate(report)


@router.post("/{report_id}/media", status_code=status.HTTP_201_CREATED)
async def upload_report_media(report_id: str, request: Request, file: UploadFile = File(), session: Session = Depends(get_db_session)) -> dict:
    item = await request.app.state.services.media.upload(session, report_id, file)
    return _media_dict(item)


@router.get("/{report_id}/media", dependencies=[Depends(require_authority_key)])
async def list_report_media(report_id: str, request: Request, session: Session = Depends(get_db_session)) -> dict:
    items = list(session.query(ReportMediaDB).filter(ReportMediaDB.report_id == report_id).order_by(ReportMediaDB.uploaded_at))
    result = []
    for item in items:
        result.append({**_media_dict(item), "signed_url": await request.app.state.services.media.signed_url(item)})
    return {"items": result, "count": len(result)}


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
    action_id = __import__("uuid").uuid4().hex
    session.add(
        AuthorityActionDB(
            action_id=action_id,
            actor_id=payload.verified_by,
            action_type=f"report_{payload.status}",
            target_type="citizen_report",
            target_id=report_id,
            details={"severity": payload.severity, "incident_id": incident.incident_id if incident else None, "verification_note": payload.verification_note, "affected_road_id": payload.affected_road_id, "confirmed_road_blockage": payload.confirmed_road_blockage},
        )
    )
    report.authority_action_id = action_id
    if payload.confirmed_road_blockage and payload.status == "verified" and payload.affected_road_id:
        session.add(RoadStatusDB(road_status_id=__import__("uuid").uuid4().hex, road_id=payload.affected_road_id, status="officially_closed", source="authority", verified=True, geometry=None, observed_at=report.verified_at, expires_at=None))
    return {
        "report": CitizenReportRead.model_validate(report).model_dump(mode="json"),
        "incident_id": incident.incident_id if incident else None,
    }

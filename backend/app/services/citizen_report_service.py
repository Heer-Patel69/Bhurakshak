from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from ..core.config import Settings
from ..core.exceptions import TerraWatchError
from ..models.database import CitizenReportDB
from ..models.schemas import CitizenReportCreate, ReportVerification
from ..repositories.reports_repository import ReportsRepository
from ..utils.geo import haversine_m


class CitizenReportService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def create(self, session: Session, payload: CitizenReportCreate) -> CitizenReportDB:
        self._validate_media(payload)
        repository = ReportsRepository(session)
        client_id = str(payload.report_id) if payload.report_id else None
        if client_id:
            existing = repository.get_by_client_id(client_id)
            if existing:
                session.expunge(existing)
                existing.sync_status = "duplicate"
                return existing
        report = CitizenReportDB(
            report_id=client_id or str(uuid4()),
            client_generated_id=client_id,
            user_id=payload.user_id,
            reporter_type=payload.reporter_type,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy_m=payload.accuracy_m,
            observed_at=payload.timestamp,
            category=payload.category.value,
            description_original=payload.description_original,
            place_name=payload.place_name,
            landmark=payload.landmark,
            road_name=payload.road_name,
            district=payload.district,
            severity_observed=payload.severity_observed,
            transcript=payload.transcript,
            media_url=payload.media_url,
            media_mime_type=payload.media_mime_type,
            language=payload.language,
            location_source=payload.location_source,
            verification_status="verified" if payload.reporter_type == "authority" else "pending",
            verified_by=payload.user_id if payload.reporter_type == "authority" else None,
            verified_at=datetime.now(UTC) if payload.reporter_type == "authority" else None,
            created_offline=payload.offline_created_at is not None,
            client_created_at=payload.offline_created_at,
            sync_status="pending_media" if payload.media_url else "synced",
        )
        return repository.add(report)

    def verify(self, session: Session, report_id: str, payload: ReportVerification) -> CitizenReportDB:
        report = ReportsRepository(session).get(report_id)
        if report is None:
            raise TerraWatchError("REPORT_NOT_FOUND", "Citizen report was not found.", status_code=404)
        report.verification_status = payload.status
        report.verified_by = payload.verified_by
        report.verified_at = datetime.now(UTC)
        report.ai_severity = payload.severity
        report.verification_note = payload.verification_note
        report.affected_road_id = payload.affected_road_id
        if payload.category:
            report.category = payload.category.value
        report.updated_at = datetime.now(UTC)
        session.flush()
        return report

    def verified_signal(self, session: Session, latitude: float, longitude: float, radius_m: float = 2_000) -> dict:
        candidates = ReportsRepository(session).list(limit=500, verification_status="verified")
        nearby = [
            report
            for report in candidates
            if haversine_m(latitude, longitude, report.latitude, report.longitude) <= radius_m
        ]
        if not nearby:
            return {"status": "no_verified_reports", "source": "citizen_reports", "verified_count": 0}
        severity_order = {"unknown": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
        highest = max((item.ai_severity or "unknown" for item in nearby), key=lambda value: severity_order.get(value, 0))
        return {
            "status": "available",
            "source": "verified_citizen_reports",
            "verified_count": len(nearby),
            "highest_severity": highest,
            "report_ids": [item.report_id for item in nearby],
            "verification_status": "verified",
        }

    def _validate_media(self, payload: CitizenReportCreate) -> None:
        if payload.media_mime_type and payload.media_mime_type.lower() not in self.settings.media_mime_types:
            raise TerraWatchError("UNSUPPORTED_MEDIA_TYPE", "The supplied media MIME type is not allowed.", status_code=415)
        if payload.media_size_bytes and payload.media_size_bytes > self.settings.max_upload_bytes:
            raise TerraWatchError("MEDIA_TOO_LARGE", "The supplied media exceeds the configured size limit.", status_code=413)

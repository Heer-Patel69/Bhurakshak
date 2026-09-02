from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from ..models.database import CitizenReportDB, IncidentDB
from ..repositories.incidents_repository import IncidentsRepository
from ..utils.geo import haversine_m
from ..utils.time import ensure_utc


class IncidentService:
    """Clusters verified, nearby, category-compatible reports into reviewable incidents."""

    def __init__(self, distance_m: float = 500, time_window_hours: float = 24) -> None:
        self.distance_m = distance_m
        self.time_window = timedelta(hours=time_window_hours)

    def cluster_verified_report(self, session: Session, report: CitizenReportDB) -> IncidentDB | None:
        if report.verification_status != "verified":
            return None
        repository = IncidentsRepository(session)
        candidates = repository.list(limit=500)
        matching = None
        for incident in candidates:
            if incident.category != report.category:
                continue
            if abs(ensure_utc(report.observed_at) - ensure_utc(incident.updated_at)) > self.time_window:
                continue
            if haversine_m(
                report.latitude,
                report.longitude,
                incident.centroid_latitude,
                incident.centroid_longitude,
            ) <= self.distance_m:
                matching = incident
                break
        if matching:
            count = matching.report_count
            matching.centroid_latitude = (matching.centroid_latitude * count + report.latitude) / (count + 1)
            matching.centroid_longitude = (matching.centroid_longitude * count + report.longitude) / (count + 1)
            matching.report_count += 1
            matching.updated_at = datetime.now(UTC)
            matching.verification_status = "verified"
            matching.severity = report.ai_severity or matching.severity
            incident = matching
        else:
            incident = repository.add(
                IncidentDB(
                    incident_id=str(uuid4()),
                    centroid_latitude=report.latitude,
                    centroid_longitude=report.longitude,
                    category=report.category,
                    report_count=1,
                    verification_status="verified",
                    severity=report.ai_severity or "unknown",
                    affected_road_ids=[],
                )
            )
        report.incident_id = incident.incident_id
        session.flush()
        return incident


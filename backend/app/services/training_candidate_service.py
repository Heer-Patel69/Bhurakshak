from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.database import (
    CitizenReportDB,
    IncidentDB,
    ReportMediaDB,
    VerifiedTrainingCandidateDB,
)


class TrainingCandidateService:
    """Builds deduplicated, provenance-rich labels without triggering model training."""

    MAX_GPS_ACCURACY_M = 100.0
    ELIGIBLE_CATEGORIES = {
        "landslide",
        "slope_crack",
        "rockfall",
        "debris",
        "water_seepage",
        "slope_movement",
        "collapsed_retaining_wall",
        "flash_flood",
        "road_blockage",
    }

    async def create_if_eligible(
        self,
        session: Session,
        report: CitizenReportDB,
        incident: IncidentDB | None,
        risk_service,
    ) -> VerifiedTrainingCandidateDB | None:
        if report.verification_status != "verified" or incident is None:
            return None
        if report.category not in self.ELIGIBLE_CATEGORIES:
            return None
        if report.accuracy_m is None or report.accuracy_m > self.MAX_GPS_ACCURACY_M:
            return None
        if not report.verified_by or not report.verified_at or not report.observed_at:
            return None
        has_media = session.scalar(
            select(ReportMediaDB.media_id).where(ReportMediaDB.report_id == report.report_id).limit(1)
        ) is not None
        if not has_media and not report.verification_note:
            return None
        existing = session.scalar(
            select(VerifiedTrainingCandidateDB).where(
                VerifiedTrainingCandidateDB.incident_id == incident.incident_id
            )
        )
        if existing:
            return existing

        # Match features to the event date, independently of the UI risk mode.
        # Never enrich an old label with today's forecast or a different CHIRPS day.
        weather = await risk_service.weather.historical.get_recent_rainfall(
            report.latitude, report.longitude, at=report.observed_at)
        terrain_result = risk_service.terrain.lookup(report.latitude, report.longitude)
        from ..models.schemas import WeatherObservation, TerrainObservation
        if not isinstance(weather, WeatherObservation) or not isinstance(terrain_result, TerrainObservation):
            return None
        rainfall = weather.model_dump(mode="json")
        terrain = terrain_result.model_dump(mode="json")
        facts = {"generated_at": datetime.now(UTC).isoformat()}
        required_terrain = {"elevation_m", "slope_deg"}
        required_rainfall = {"rainfall_24h_mm", "rainfall_72h_mm", "rainfall_7d_mm"}
        if not required_terrain.issubset(terrain) or not required_rainfall.issubset(rainfall):
            return None
        if any(rainfall.get(key) is None for key in required_rainfall):
            return None

        candidate = VerifiedTrainingCandidateDB(
            candidate_id=str(uuid4()),
            incident_id=incident.incident_id,
            source_report_id=report.report_id,
            label=1,
            latitude=report.latitude,
            longitude=report.longitude,
            event_time=report.observed_at,
            category=report.category,
            verification_source=report.verified_by,
            verified_at=report.verified_at,
            weather_snapshot={
                "source": rainfall.get("source"),
                "observation_time": rainfall.get("observation_time"),
                "rain_prev_24h_mm": rainfall.get("rainfall_24h_mm"),
                "rain_prev_72h_mm": rainfall.get("rainfall_72h_mm"),
                "rain_prev_7d_mm": rainfall.get("rainfall_7d_mm"),
                "live": rainfall.get("live", False),
                "status": rainfall.get("status"),
            },
            terrain_values={
                "source": terrain.get("source"),
                "elevation_m": terrain.get("elevation_m"),
                "slope_deg": terrain.get("slope_deg"),
            },
            data_provenance={
                "source_report_id": report.report_id,
                "client_report_id": report.client_generated_id,
                "incident_id": incident.incident_id,
                "incident_report_count": incident.report_count,
                "incident_verified_report_count": incident.verified_report_count,
                "authority_action_id": report.authority_action_id,
                "has_media_evidence": has_media,
                "has_verification_note": bool(report.verification_note),
                "gps_accuracy_m": report.accuracy_m,
                "risk_generated_at": facts.get("generated_at"),
            },
            feature_schema_version="five-feature-v1",
            dataset_version=f"verified-incidents-{datetime.now(UTC):%Y%m%d}",
        )
        session.add(candidate)
        session.flush()
        return candidate

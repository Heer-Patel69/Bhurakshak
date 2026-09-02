from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...core.security import require_authority_key
from ...dependencies import get_db_session
from ...models.database import AlertDB, CitizenReportDB, IncidentDB, RiskSnapshotDB


router = APIRouter(prefix="/authority", tags=["authority"])


@router.get("/overview", dependencies=[Depends(require_authority_key)])
def authority_overview(request: Request, session: Session = Depends(get_db_session)) -> dict:
    services = request.app.state.services
    latest_risk = list(session.scalars(select(RiskSnapshotDB).order_by(RiskSnapshotDB.generated_at.desc()).limit(100)))
    high_zones = [item.payload for item in latest_risk if item.risk_level in {"high", "critical"}]
    reports = list(session.scalars(select(CitizenReportDB).order_by(CitizenReportDB.created_at.desc()).limit(20)))
    incidents = list(
        session.scalars(
            select(IncidentDB).where(IncidentDB.verification_status == "verified").order_by(IncidentDB.updated_at.desc()).limit(20)
        )
    )
    alerts = list(session.scalars(select(AlertDB).order_by(AlertDB.created_at.desc()).limit(20)))
    sensor_status = services.sensors.status(session)
    overall = max((item.risk_score for item in latest_risk), default=None)
    return {
        "generated_at": datetime.now(UTC),
        "overall_risk": {
            "maximum_recent_score": overall,
            "snapshot_count": len(latest_risk),
            "status": "available" if latest_risk else "no_snapshot_available",
        },
        "high_critical_risk_zones": high_zones,
        "affected_roads": {"status": "not_evaluated_without_configured_geometry", "items": []},
        "potentially_isolated_villages": {"status": services.routing.health()["status"], "items": []},
        "hospital_accessibility": {"status": services.routing.health()["status"], "items": []},
        "latest_citizen_reports": [item.report_id for item in reports],
        "verified_incidents": [item.incident_id for item in incidents],
        "sensor_status": sensor_status,
        "weather_provider_status": services.weather.health(),
        "satellite_provider_status": services.satellite.health(),
        "alerts": [item.alert_id for item in alerts],
        "data_freshness": {
            "latest_risk_generated_at": latest_risk[0].generated_at if latest_risk else None,
            "weather": "historical_reference" if services.weather.health()["imd"]["status"] != "available" else "operational",
        },
        "system_health": {
            "ml": services.ml.health()["status"],
            "terrain": services.terrain.health()["status"],
            "historical": services.historical.health()["status"],
        },
    }

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...dependencies import get_db_session
from ...models.database import RoadStatusDB
from ...models.schemas import CopilotAdviceRequest, CopilotAdviceResponse


router = APIRouter(prefix="/copilot", tags=["grounded copilot"])


@router.post("/advice", response_model=CopilotAdviceResponse)
async def copilot_advice(payload: CopilotAdviceRequest, request: Request, session: Session = Depends(get_db_session)) -> dict:
    services, settings = request.app.state.services, request.app.state.settings
    risk = await services.risk.point(session, latitude=payload.latitude, longitude=payload.longitude, persist=False)
    verified = services.reports.verified_signal(session, payload.latitude, payload.longitude)
    closures = [{"road_id": row.road_id, "status": row.status, "source": row.source} for row in session.query(RoadStatusDB).filter(RoadStatusDB.status == "officially_closed", RoadStatusDB.verified.is_(True)).limit(50)]
    facilities = services.geo.load_feature_collection(settings.facilities_geojson_path, layer="facilities")
    nearest = None
    if facilities.get("features"):
        nearest = min(facilities["features"], key=lambda f: (f["geometry"]["coordinates"][0] - payload.longitude) ** 2 + (f["geometry"]["coordinates"][1] - payload.latitude) ** 2)
        nearest = {"facility_id": nearest.get("id"), "name": nearest["properties"].get("name"), "facility_type": nearest["properties"].get("facility_type"), "source": nearest["properties"].get("source")}
    facts = {"location": {"latitude": payload.latitude, "longitude": payload.longitude, "source": "user_supplied"}, "risk": {"risk_score": risk.risk_score, "risk_level": risk.risk_level, "confidence_score": risk.confidence_score, "confidence_level": risk.confidence_level, "context": risk.assessment_context, "drivers": risk.drivers, "missing_signals": risk.missing_signals}, "weather": risk.signals.get("rainfall"), "nearby_verified_reports": verified, "nearest_facility": nearest, "official_closures": closures, "data_sources": risk.data_sources}
    fallback = services.i18n.advice(risk.risk_level, payload.language)
    return await services.copilot.advice(facts, payload.language, payload.question, fallback)

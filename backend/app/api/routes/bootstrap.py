from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...dependencies import get_db_session
from ...models.database import AlertDB


router = APIRouter(tags=["frontend bootstrap"])


@router.get("/bootstrap")
def bootstrap(request: Request, session: Session = Depends(get_db_session)) -> dict:
    services, settings = request.app.state.services, request.app.state.settings
    alerts = list(session.scalars(select(AlertDB).order_by(AlertDB.created_at.desc()).limit(5)))
    return {"generated_at": datetime.now(UTC), "pilot": "Aizawl, Mizoram", "supported_languages": [{"code": "en", "name": "English"}, {"code": "hi", "name": "Hindi"}, {"code": "lus", "name": "Mizo", "review_status": "REQUIRES HUMAN / AUTHORITY LANGUAGE REVIEW"}], "provider_status": {"weather": services.weather.health(), "satellite": services.satellite.health(), "sensors": services.sensors.status(session), "copilot": services.copilot.health(), "media": services.media.health()}, "risk_context": "live_operational" if services.imd_provider.health().status == "available" else "historical_reference_scenario", "map_metadata": {"bbox": settings.aizawl_gis_bbox, "crs": "EPSG:4326", "source": "OpenStreetMap contributors via Geofabrik"}, "feature_availability": {"roads": services.geo.load_feature_collection(settings.roads_geojson_path, layer="roads", limit=0)["metadata"]["status"], "settlements": services.geo.load_feature_collection(settings.villages_geojson_path, layer="villages", limit=0)["metadata"]["status"], "facilities": services.geo.load_feature_collection(settings.facilities_geojson_path, layer="facilities", limit=0)["metadata"]["status"]}, "latest_alerts": [{"alert_id": item.alert_id, "severity": item.severity, "title": item.title, "created_at": item.created_at} for item in alerts]}

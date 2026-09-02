from __future__ import annotations

from fastapi import APIRouter, Request


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/providers")
def provider_health(request: Request) -> dict:
    services = request.app.state.services
    settings = request.app.state.settings
    roads = services.geo.load_feature_collection(settings.roads_geojson_path, layer="roads")["metadata"]
    villages = services.geo.load_feature_collection(settings.villages_geojson_path, layer="villages")["metadata"]
    facilities = services.geo.load_feature_collection(settings.facilities_geojson_path, layer="facilities")["metadata"]
    return {
        "weather": services.weather.health(),
        "satellite": services.satellite.health(),
        "alerts": services.alerts.health(),
        "sensor_network": services.sensor_provider.health().model_dump(mode="json"),
        "ml": services.ml.health(),
        "terrain": services.terrain.health(),
        "historical": services.historical.health(),
        "gis": {"roads": roads, "villages": villages, "facilities": facilities},
        "road_graph": services.routing.health(),
        "copilot": services.copilot.health(),
    }


from __future__ import annotations

from fastapi import APIRouter, Request


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/providers")
def provider_health(request: Request) -> dict:
    services = request.app.state.services
    settings = request.app.state.settings
    road_collection = services.geo.load_feature_collection(settings.roads_geojson_path, layer="roads")
    roads = road_collection["metadata"]
    villages = services.geo.load_feature_collection(settings.villages_geojson_path, layer="villages")["metadata"]
    facilities = services.geo.load_feature_collection(settings.facilities_geojson_path, layer="facilities")["metadata"]
    roads["network_length_m"] = round(
        sum(float(feature.get("properties", {}).get("length_m") or 0) for feature in road_collection.get("features", [])),
        2,
    )
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
        "supabase": {
            "database": "configured" if str(settings.database_url).startswith("postgresql") else "local",
            "auth": "configured" if settings.supabase_url and settings.supabase_anon_key else "not_configured",
            "storage": services.media.health(),
        },
        "place_search": services.places.health(),
        "authority_auth": {
            "primary": "supabase_jwt",
            "supabase_configured": bool(settings.supabase_url and settings.supabase_anon_key),
            "development_fallback_configured": bool(
                settings.authority_api_key
                and settings.app_env.casefold() in {"development", "dev", "test", "local"}
            ),
        },
    }

from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/gis", tags=["gis"])


@router.get("/layers")
def gis_layers(request: Request) -> dict:
    settings = request.app.state.settings
    geo = request.app.state.services.geo
    return {
        "roads": geo.load_feature_collection(settings.roads_geojson_path, layer="roads")["metadata"],
        "villages": geo.load_feature_collection(settings.villages_geojson_path, layer="villages")["metadata"],
        "facilities": geo.load_feature_collection(settings.facilities_geojson_path, layer="facilities")["metadata"],
        "analytical_source_policy": "Configured OSM geometry/extracts; never rendered map tiles.",
    }


@router.get("/historical-landslides")
def historical_landslides(request: Request, bbox: str | None = Query(default=None)) -> dict:
    return request.app.state.services.historical.feature_collection(bbox)

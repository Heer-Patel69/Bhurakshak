from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from shapely.geometry import box, mapping
from sqlalchemy.orm import Session

from ...dependencies import get_db_session


router = APIRouter(prefix="/roads", tags=["roads"])


@router.get("")
def roads(request: Request) -> dict:
    return request.app.state.services.geo.load_feature_collection(
        request.app.state.settings.roads_geojson_path,
        layer="roads",
    )


@router.get("/exposure")
async def road_exposure(
    request: Request,
    bbox: str = Query(default="92.64,23.63,92.80,23.82"),
    resolution: int = Query(default=5, ge=2),
    session: Session = Depends(get_db_session),
) -> dict:
    services = request.app.state.services
    road_data = services.geo.load_feature_collection(request.app.state.settings.roads_geojson_path, layer="roads")
    if not road_data.get("features"):
        return {**road_data, "metadata": {**road_data["metadata"], "analysis": "not_run_without_road_geometry"}}
    grid = await services.risk_grid.generate(session, bbox=bbox, resolution=resolution)
    west, south, east, north = grid["metadata"]["bbox"]
    half_lon = (east - west) / max(2, resolution - 1) / 2
    half_lat = (north - south) / max(2, resolution - 1) / 2
    risk_polygons = {"type": "FeatureCollection", "features": []}
    for feature in grid["features"]:
        longitude, latitude = feature["geometry"]["coordinates"]
        risk_polygons["features"].append(
            {
                "type": "Feature",
                "geometry": mapping(box(longitude - half_lon, latitude - half_lat, longitude + half_lon, latitude + half_lat)),
                "properties": feature["properties"],
            }
        )
    return services.road_exposure.analyze(road_data, risk_polygons)


from fastapi import APIRouter, Query, Request


router = APIRouter(tags=["facilities and accessibility"])


@router.get("/facilities")
def facilities(request: Request) -> dict:
    return request.app.state.services.geo.load_feature_collection(
        request.app.state.settings.facilities_geojson_path,
        layer="facilities",
    )


@router.get("/accessibility")
def accessibility(
    request: Request,
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    village_id: str | None = Query(default=None),
) -> dict:
    collection = request.app.state.services.geo.load_feature_collection(
        request.app.state.settings.facilities_geojson_path,
        layer="facilities",
    )
    facility_nodes = []
    for feature in collection.get("features", []):
        properties = feature.get("properties", {})
        if "nearest_node" in properties:
            facility_nodes.append(
                {
                    "facility_id": str(properties.get("facility_id") or feature.get("id")),
                    "name": properties.get("name"),
                    "facility_type": properties.get("facility_type") or properties.get("amenity"),
                    "nearest_node": properties["nearest_node"],
                }
            )
    services, settings = request.app.state.services, request.app.state.settings
    source_node = None
    if village_id:
        villages = services.geo.load_feature_collection(settings.villages_geojson_path, layer="villages")
        match = next((f for f in villages.get("features", []) if str(f.get("id")) == village_id or str(f.get("properties", {}).get("place_id")) == village_id), None)
        if match:
            source_node = match["properties"].get("nearest_node")
    elif latitude is not None and longitude is not None:
        source_node = services.routing.nearest_node(latitude, longitude)[0]
    if source_node is None:
        return {"accessibility_status": "invalid_origin", "message": "Provide latitude and longitude, or a valid village_id."}
    return services.facility_access.assess(source_node, facility_nodes)

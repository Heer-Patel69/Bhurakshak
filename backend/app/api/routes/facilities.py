from fastapi import APIRouter, Query, Request


router = APIRouter(tags=["facilities and accessibility"])


@router.get("/facilities")
def facilities(request: Request) -> dict:
    return request.app.state.services.geo.load_feature_collection(
        request.app.state.settings.facilities_geojson_path,
        layer="facilities",
    )


@router.get("/accessibility")
def accessibility(request: Request, source_node: str = Query()) -> dict:
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
    return request.app.state.services.facility_access.assess(source_node, facility_nodes)


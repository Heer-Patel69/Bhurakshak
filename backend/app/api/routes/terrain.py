from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/terrain", tags=["terrain"])


@router.get("/point")
def terrain_point(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
):  # type: ignore[no-untyped-def]
    result = request.app.state.services.terrain.lookup(latitude, longitude)
    return result.model_dump(mode="json") if hasattr(result, "model_dump") else result


from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/historical", tags=["historical susceptibility"])


@router.get("/susceptibility")
def historical_susceptibility(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
) -> dict:
    return request.app.state.services.historical.score(latitude, longitude).model_dump(mode="json")


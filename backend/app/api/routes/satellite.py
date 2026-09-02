from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/satellite", tags=["satellite"])


@router.get("/latest")
async def latest_satellite(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
) -> dict:
    return await request.app.state.services.satellite.latest(latitude, longitude)


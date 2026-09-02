from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current")
async def current_weather(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
) -> dict:
    observation, providers = await request.app.state.services.weather.current(latitude, longitude)
    return {
        "status": "available" if observation else "unavailable",
        "observation": observation.model_dump(mode="json") if observation else None,
        "provider_status": providers,
    }


@router.get("/history")
async def weather_history(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    timestamp: datetime = Query(),
) -> dict:
    result = await request.app.state.services.chirps_provider.get_recent_rainfall(
        latitude,
        longitude,
        at=timestamp,
    )
    return result.model_dump(mode="json")


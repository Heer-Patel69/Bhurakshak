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
    result = await request.app.state.services.imd_provider.get_current_weather(latitude, longitude)
    from ...models.schemas import WeatherObservation
    observation = result if isinstance(result, WeatherObservation) else None
    return {
        "mode": "live" if observation and observation.live else "unavailable",
        "status": "available" if observation and observation.live else result.status,
        "live": bool(observation and observation.live),
        "observation": observation.model_dump(mode="json") if observation else None,
        "provider_status": None if observation else result.model_dump(mode="json"),
    }


@router.get("/history")
async def weather_history(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    timestamp: datetime | None = Query(default=None),
) -> dict:
    result = await request.app.state.services.chirps_provider.get_recent_rainfall(
        latitude,
        longitude,
        at=timestamp,
    )
    return {"mode": "historical", "live": False, "observation": result.model_dump(mode="json")}


@router.get("/status")
def weather_status(request: Request) -> dict:
    health = request.app.state.services.weather.health()
    return {"current": {"mode": "live" if health["imd"]["status"] == "available" else "unavailable", **health["imd"]}, "historical": {"mode": "historical", **health["chirps"]}}

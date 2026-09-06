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
    observation, statuses = await request.app.state.services.weather.current(latitude, longitude)
    return {
        "mode": "live" if observation else "unavailable", "status": "available" if observation else "unavailable",
        "live": bool(observation), "observation": observation.model_dump(mode="json") if observation else None,
        "provider_status": statuses,
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
    return {"current": {"mode": "live" if any(health[k]["status"] == "available" for k in ("imd", "open_meteo")) else "unavailable", "priority": ["IMD", "Open-Meteo", "unavailable"], "providers": {k: health[k] for k in ("imd", "open_meteo")}}, "historical": {"mode": "historical", **health["chirps"]}}

from fastapi import APIRouter

from .routes import (
    alerts,
    bootstrap,
    copilot,
    authority,
    facilities,
    gis,
    health,
    historical,
    incidents,
    places,
    reports,
    risk,
    roads,
    routing,
    satellite,
    sensors,
    soil,
    sync,
    system,
    terrain,
    villages,
    weather,
)


api_router = APIRouter()
for router in (
    health.router,
    bootstrap.router,
    system.router,
    risk.router,
    weather.router,
    terrain.router,
    historical.router,
    satellite.router,
    gis.router,
    roads.router,
    villages.router,
    facilities.router,
    places.router,
    routing.router,
    copilot.router,
    reports.router,
    incidents.router,
    sensors.router,
    soil.router,
    alerts.router,
    authority.router,
    sync.router,
):
    api_router.include_router(router)

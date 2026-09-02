from fastapi import APIRouter

from .routes import (
    alerts,
    authority,
    facilities,
    gis,
    health,
    historical,
    incidents,
    reports,
    risk,
    roads,
    routing,
    satellite,
    sensors,
    sync,
    system,
    terrain,
    villages,
    weather,
)


api_router = APIRouter()
for router in (
    health.router,
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
    routing.router,
    reports.router,
    incidents.router,
    sensors.router,
    alerts.router,
    authority.router,
    sync.router,
):
    api_router.include_router(router)


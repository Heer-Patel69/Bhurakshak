from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Request
from sqlalchemy import text


router = APIRouter(tags=["health"])


@router.get("/health")
def health(request: Request) -> dict:
    database_status = "available"
    try:
        with request.app.state.database.session() as session:
            session.execute(text("SELECT 1"))
    except Exception:
        database_status = "unavailable"
    services = request.app.state.services
    return {
        "status": "ok" if database_status == "available" else "degraded",
        "service": "Bhu Rakshak API",
        "environment": request.app.state.settings.app_env,
        "timestamp": datetime.now(UTC),
        "database": database_status,
        "model": services.ml.health()["status"],
        "historical_inventory": services.historical.health()["status"],
        "terrain": services.terrain.health()["status"],
    }


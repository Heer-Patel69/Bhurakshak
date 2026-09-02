from __future__ import annotations

import hashlib
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from ...dependencies import get_db_session
from ...models.schemas import RiskPointRequest, RiskPointResponse


router = APIRouter(prefix="/risk", tags=["risk"])


@router.post("/point", response_model=RiskPointResponse)
async def point_risk(
    payload: RiskPointRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> RiskPointResponse:
    return await request.app.state.services.risk.point(
        session,
        latitude=payload.latitude,
        longitude=payload.longitude,
        at=payload.timestamp,
    )


@router.get("/grid")
async def risk_grid(
    request: Request,
    response: Response,
    bbox: str = Query(description="west,south,east,north"),
    resolution: int = Query(default=10, ge=2),
    timestamp: datetime | None = None,
    session: Session = Depends(get_db_session),
) -> dict:
    payload = await request.app.state.services.risk_grid.generate(
        session,
        bbox=bbox,
        resolution=resolution,
        at=timestamp,
    )
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
    response.headers["ETag"] = f'"{digest}"'
    response.headers["Cache-Control"] = f"public, max-age={request.app.state.settings.risk_grid_cache_seconds}"
    return payload


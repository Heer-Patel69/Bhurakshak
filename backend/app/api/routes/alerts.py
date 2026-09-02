from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from ...core.security import require_authority_key
from ...dependencies import get_db_session
from ...models.schemas import AlertCreate


router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_db_session),
) -> dict:
    alerts = request.app.state.services.alerts.list(session, limit)
    return {
        "items": [
            {
                "alert_id": item.alert_id,
                "severity": item.severity,
                "title": item.title,
                "message": item.message,
                "location": item.location,
                "affected_area": item.affected_area,
                "recommended_action": item.recommended_action,
                "source": item.source,
                "created_at": item.created_at,
                "expires_at": item.expires_at,
                "delivery_channels": item.delivery_channels,
                "delivery_status": item.delivery_status,
            }
            for item in alerts
        ],
        "count": len(alerts),
    }


@router.post("", dependencies=[Depends(require_authority_key)], status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreate,
    request: Request,
    session: Session = Depends(get_db_session),
) -> dict:
    item = await request.app.state.services.alerts.create(session, payload)
    return {"alert_id": item.alert_id, "delivery_status": item.delivery_status}


from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.database import AlertDB
from ..models.schemas import AlertCreate
from ..providers.alerts.base import AlertProvider


class AlertService:
    def __init__(self, providers: list[AlertProvider]) -> None:
        self.providers = {provider.name: provider for provider in providers}

    def health(self) -> dict:
        return {name: provider.health().model_dump(mode="json") for name, provider in self.providers.items()}

    async def create(self, session: Session, payload: AlertCreate) -> AlertDB:
        delivery_status = {}
        alert_payload = payload.model_dump(mode="json")
        for channel in payload.delivery_channels:
            provider_name = "firebase" if channel in {"firebase", "pwa"} else channel
            provider = self.providers.get(provider_name)
            delivery_status[channel] = (
                await provider.send(alert_payload) if provider else {"provider": provider_name, "status": "not_configured"}
            )
        alert = AlertDB(
            alert_id=str(uuid4()),
            severity=payload.severity,
            title=payload.title,
            message=payload.message,
            location=payload.location,
            affected_area=payload.affected_area,
            recommended_action=payload.recommended_action,
            source=payload.source,
            delivery_channels=list(payload.delivery_channels),
            delivery_status=delivery_status,
            expires_at=payload.expires_at,
        )
        session.add(alert)
        session.flush()
        return alert

    def list(self, session: Session, limit: int = 100) -> list[AlertDB]:
        return list(session.scalars(select(AlertDB).order_by(AlertDB.created_at.desc()).limit(limit)))


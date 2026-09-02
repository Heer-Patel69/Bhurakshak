from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.database import IncidentDB


class IncidentsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, incident_id: str) -> IncidentDB | None:
        return self.session.get(IncidentDB, incident_id)

    def add(self, incident: IncidentDB) -> IncidentDB:
        self.session.add(incident)
        self.session.flush()
        return incident

    def list(self, *, limit: int = 100, updated_since: datetime | None = None) -> list[IncidentDB]:
        statement = select(IncidentDB)
        if updated_since:
            statement = statement.where(IncidentDB.updated_at > updated_since)
        return list(self.session.scalars(statement.order_by(IncidentDB.updated_at.desc()).limit(limit)))


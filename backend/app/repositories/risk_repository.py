from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.database import RiskSnapshotDB


class RiskRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, snapshot: RiskSnapshotDB) -> RiskSnapshotDB:
        self.session.add(snapshot)
        self.session.flush()
        return snapshot

    def latest(self, limit: int = 100) -> list[RiskSnapshotDB]:
        return list(self.session.scalars(select(RiskSnapshotDB).order_by(RiskSnapshotDB.generated_at.desc()).limit(limit)))

    def changes(self, since: datetime, limit: int = 100) -> list[RiskSnapshotDB]:
        statement = (
            select(RiskSnapshotDB)
            .where(RiskSnapshotDB.updated_at > since)
            .order_by(RiskSnapshotDB.updated_at)
            .limit(limit)
        )
        return list(self.session.scalars(statement))


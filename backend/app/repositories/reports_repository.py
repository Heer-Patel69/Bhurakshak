from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from ..models.database import CitizenReportDB


class ReportsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, report_id: str) -> CitizenReportDB | None:
        return self.session.get(CitizenReportDB, report_id)

    def get_by_client_id(self, client_id: str) -> CitizenReportDB | None:
        return self.session.scalar(select(CitizenReportDB).where(CitizenReportDB.client_generated_id == client_id))

    def add(self, report: CitizenReportDB) -> CitizenReportDB:
        self.session.add(report)
        self.session.flush()
        return report

    def list(
        self,
        *,
        offset: int = 0,
        limit: int = 100,
        verification_status: str | None = None,
        updated_since: datetime | None = None,
    ) -> list[CitizenReportDB]:
        statement: Select[tuple[CitizenReportDB]] = select(CitizenReportDB)
        if verification_status:
            statement = statement.where(CitizenReportDB.verification_status == verification_status)
        if updated_since:
            statement = statement.where(CitizenReportDB.updated_at > updated_since)
        statement = statement.order_by(CitizenReportDB.created_at.desc()).offset(offset).limit(limit)
        return list(self.session.scalars(statement))


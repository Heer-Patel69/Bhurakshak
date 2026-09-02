from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models.database import SensorDeviceDB, SensorReadingDB


class SensorsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert_device(self, *, sensor_id: str, latitude: float, longitude: float, observed_at: datetime) -> SensorDeviceDB:
        device = self.session.get(SensorDeviceDB, sensor_id)
        if device is None:
            device = SensorDeviceDB(sensor_id=sensor_id, latitude=latitude, longitude=longitude)
            self.session.add(device)
        device.latitude = latitude
        device.longitude = longitude
        device.last_seen_at = observed_at
        device.status = "active"
        self.session.flush()
        return device

    def add_reading(self, reading: SensorReadingDB) -> SensorReadingDB:
        self.session.add(reading)
        self.session.flush()
        return reading

    def latest(self, limit: int = 100) -> list[SensorReadingDB]:
        latest_times = (
            select(SensorReadingDB.sensor_id, func.max(SensorReadingDB.observed_at).label("latest_at"))
            .group_by(SensorReadingDB.sensor_id)
            .subquery()
        )
        statement = (
            select(SensorReadingDB)
            .join(
                latest_times,
                (SensorReadingDB.sensor_id == latest_times.c.sensor_id)
                & (SensorReadingDB.observed_at == latest_times.c.latest_at),
            )
            .order_by(SensorReadingDB.observed_at.desc())
            .limit(limit)
        )
        return list(self.session.scalars(statement))

    def changes(self, since: datetime, limit: int = 100) -> list[SensorReadingDB]:
        return list(
            self.session.scalars(
                select(SensorReadingDB)
                .where(SensorReadingDB.created_at > since)
                .order_by(SensorReadingDB.created_at)
                .limit(limit)
            )
        )


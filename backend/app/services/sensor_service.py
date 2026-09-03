from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from ..models.database import SensorReadingDB
from ..models.schemas import SensorReadingCreate
from ..repositories.sensors_repository import SensorsRepository
from ..utils.geo import haversine_m
from ..utils.time import ensure_utc


class SensorService:
    def ingest(self, session: Session, payload: SensorReadingCreate) -> SensorReadingDB:
        repository = SensorsRepository(session)
        repository.upsert_device(
            sensor_id=payload.sensor_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            observed_at=payload.timestamp,
        )
        reading = SensorReadingDB(
            reading_id=str(uuid4()),
            sensor_id=payload.sensor_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            observed_at=payload.timestamp,
            soil_moisture=payload.soil_moisture,
            rainfall_mm=payload.rainfall_mm,
            temperature_c=payload.temperature_c,
            tilt_deg=payload.tilt_deg,
            battery_percent=payload.battery_percent,
            source=payload.source,
        )
        return repository.add_reading(reading)

    def status(self, session: Session) -> dict:
        readings = SensorsRepository(session).latest()
        if not readings:
            return {"status": "no_sensor_connected", "live": False, "readings": [], "count": 0, "connected_sensor_count": 0, "latest_reading_at": None}
        latest_at = max(ensure_utc(item.observed_at) for item in readings)
        age = (datetime.now(UTC) - latest_at).total_seconds()
        return {
            "status": "operational" if age <= 3600 else "stale",
            "live": False,
            "count": len(readings),
            "connected_sensor_count": len(readings),
            "latest_reading_at": latest_at.isoformat(),
            "readings": [self.serialize(item) for item in readings],
        }

    def nearest_signal(self, session: Session, latitude: float, longitude: float, radius_m: float = 5_000) -> dict:
        readings = SensorsRepository(session).latest()
        nearest: SensorReadingDB | None = None
        nearest_distance = float("inf")
        for reading in readings:
            distance = haversine_m(latitude, longitude, reading.latitude, reading.longitude)
            if distance < nearest_distance:
                nearest = reading
                nearest_distance = distance
        if nearest is None or nearest_distance > radius_m:
            return {"status": "no_sensor_connected", "source": "sensor_network", "live": False}
        age = max(0.0, (datetime.now(UTC) - ensure_utc(nearest.observed_at)).total_seconds())
        return {
            "status": "available",
            "source": nearest.source,
            "sensor_id": nearest.sensor_id,
            "soil_moisture": nearest.soil_moisture,
            "rainfall_mm": nearest.rainfall_mm,
            "temperature_c": nearest.temperature_c,
            "tilt_deg": nearest.tilt_deg,
            "battery_percent": nearest.battery_percent,
            "observation_time": ensure_utc(nearest.observed_at).isoformat(),
            "data_age_seconds": age,
            "distance_m": round(nearest_distance, 1),
            "live": False,
        }

    @staticmethod
    def serialize(reading: SensorReadingDB) -> dict:
        return {
            "reading_id": reading.reading_id,
            "sensor_id": reading.sensor_id,
            "latitude": reading.latitude,
            "longitude": reading.longitude,
            "observation_time": ensure_utc(reading.observed_at).isoformat(),
            "soil_moisture": reading.soil_moisture,
            "rainfall_mm": reading.rainfall_mm,
            "temperature_c": reading.temperature_c,
            "tilt_deg": reading.tilt_deg,
            "battery_percent": reading.battery_percent,
            "source": reading.source,
        }

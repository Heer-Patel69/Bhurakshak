from __future__ import annotations

from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class Location(APIModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ProviderStatus(APIModel):
    provider: str
    status: str
    live: bool = False
    enabled: bool | None = None
    configured: bool | None = None
    message: str | None = None
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class WeatherObservation(APIModel):
    provider: str
    source: str
    observation_time: datetime
    received_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    data_age_seconds: float | None = Field(default=None, ge=0)
    live: bool = False
    status: str
    quality: str
    rainfall_1h_mm: float | None = Field(default=None, ge=0)
    rainfall_24h_mm: float | None = Field(default=None, ge=0)
    rainfall_72h_mm: float | None = Field(default=None, ge=0)
    rainfall_7d_mm: float | None = Field(default=None, ge=0)
    temperature_c: float | None = None
    humidity_percent: float | None = Field(default=None, ge=0, le=100)
    forecast_rainfall_mm: float | None = Field(default=None, ge=0)
    confidence: str
    location: Location | None = None
    provenance: dict[str, Any] = Field(default_factory=dict)


class TerrainObservation(APIModel):
    elevation_m: float
    slope_deg: float = Field(ge=0, le=90)
    aspect_deg: float | None = Field(default=None, ge=0, le=360)
    roughness: float | None = Field(default=None, ge=0)
    source: str
    resolution_m: float | None = Field(default=None, gt=0)
    coordinates: Location
    sampled_coordinates: Location | None = None
    sample_distance_m: float | None = Field(default=None, ge=0)
    status: str = "available"


class SatelliteObservation(APIModel):
    provider: str
    satellite: str
    product: str
    acquisition_time: datetime
    processed_time: datetime
    geometry: dict[str, Any]
    cloud_coverage_percent: float | None = Field(default=None, ge=0, le=100)
    signal_change_score: float | None = Field(default=None, ge=0, le=1)
    status: str
    live: bool = False


class HistoricalSusceptibility(APIModel):
    historical_susceptibility_score: float = Field(ge=0, le=1)
    nearest_historical_event_distance_m: float = Field(ge=0)
    historical_events_within_500m: int = Field(ge=0)
    historical_events_within_1km: int = Field(ge=0)
    historical_events_within_2km: int = Field(ge=0)
    source: str = "GSI historical landslide inventory"
    inventory_size: int = Field(ge=0)
    methodology: str
    status: str = "available"


class MLSusceptibility(APIModel):
    ml_susceptibility_score: float | None = Field(default=None, ge=0, le=1)
    model_name: str
    model_version: str
    model_type: Literal["experimental_storm_conditioned_spatial_susceptibility"]
    status: str
    message: str | None = None


class RiskPointRequest(Location):
    timestamp: datetime | None = None

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class RiskPointResponse(APIModel):
    location: Location
    risk_score: float = Field(ge=0, le=100)
    risk_level: Literal["low", "medium", "high", "critical"]
    confidence_score: float = Field(ge=0, le=100)
    confidence_level: Literal["low", "moderate", "high"]
    signals: dict[str, Any]
    drivers: list[str]
    data_sources: list[dict[str, Any]]
    missing_signals: list[str]
    generated_at: datetime
    data_timestamp: datetime | None = None
    assessment_context: Literal["operational", "historical_reference_scenario"]


class ReportCategory(StrEnum):
    slope_crack = "slope_crack"
    rockfall = "rockfall"
    debris = "debris"
    water_seepage = "water_seepage"
    road_blockage = "road_blockage"
    slope_movement = "slope_movement"
    collapsed_retaining_wall = "collapsed_retaining_wall"
    flash_flood = "flash_flood"
    unknown = "unknown"


class VerificationStatus(StrEnum):
    pending = "pending"
    under_review = "under_review"
    verified = "verified"
    rejected = "rejected"


class CitizenReportCreate(Location):
    report_id: UUID | None = Field(default=None, description="Client UUID used for offline idempotency")
    user_id: str | None = Field(default=None, max_length=128)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    category: ReportCategory
    description_original: str | None = Field(default=None, max_length=5_000)
    transcript: str | None = Field(default=None, max_length=10_000)
    media_url: str | None = Field(default=None, max_length=2_000)
    media_mime_type: str | None = Field(default=None, max_length=100)
    media_size_bytes: int | None = Field(default=None, ge=0)
    language: Literal["en", "hi", "lus"] = "en"
    location_source: Literal["device_gps", "media_exif", "manual_pin"]

    @field_validator("timestamp")
    @classmethod
    def validate_observed_timestamp(cls, value: datetime) -> datetime:
        normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        if normalized > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("Report timestamp cannot be more than five minutes in the future")
        return normalized

    @field_validator("media_url")
    @classmethod
    def validate_media_url(cls, value: str | None) -> str | None:
        if value and not value.lower().startswith("https://"):
            raise ValueError("media_url must use HTTPS")
        return value

    @model_validator(mode="after")
    def require_report_content(self) -> "CitizenReportCreate":
        if not any((self.description_original, self.transcript, self.media_url)):
            raise ValueError("At least one of description_original, transcript, or media_url is required")
        if self.media_url and not self.media_mime_type:
            raise ValueError("media_mime_type is required when media_url is supplied")
        return self


class CitizenReportRead(APIModel):
    report_id: str
    client_generated_id: str | None
    user_id: str | None
    latitude: float
    longitude: float
    accuracy_m: float | None
    observed_at: datetime
    category: str
    description_original: str | None
    transcript: str | None
    ai_summary: str | None
    ai_severity: str | None
    ai_confidence: float | None
    media_url: str | None
    media_mime_type: str | None
    language: str
    location_source: str
    verification_status: str
    verified_by: str | None
    verified_at: datetime | None
    incident_id: str | None
    created_at: datetime
    updated_at: datetime


class ReportVerification(APIModel):
    status: Literal["under_review", "verified", "rejected"]
    verified_by: str = Field(min_length=1, max_length=128)
    severity: Literal["low", "medium", "high", "critical", "unknown"] = "unknown"


class IncidentVerification(APIModel):
    status: Literal["verified", "rejected"]
    verified_by: str = Field(min_length=1, max_length=128)
    severity: Literal["low", "medium", "high", "critical", "unknown"] = "unknown"
    affected_road_ids: list[str] = Field(default_factory=list, max_length=500)


class SensorReadingCreate(Location):
    sensor_id: str = Field(min_length=1, max_length=128)
    timestamp: datetime
    soil_moisture: float = Field(ge=0, le=1, description="Volumetric fraction from 0 to 1")
    rainfall_mm: float | None = Field(default=None, ge=0, le=2_000)
    temperature_c: float | None = Field(default=None, ge=-50, le=80)
    tilt_deg: float | None = Field(default=None, ge=-180, le=180)
    battery_percent: float | None = Field(default=None, ge=0, le=100)
    source: Literal["physical_sensor", "test_fixture"] = "physical_sensor"

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: datetime) -> datetime:
        normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        now = datetime.now(UTC)
        if normalized > now.replace(microsecond=999999):
            raise ValueError("Sensor timestamp cannot be in the future")
        if (now - normalized).days > 365:
            raise ValueError("Sensor timestamp is older than the accepted one-year ingest window")
        return normalized


class RouteCompareRequest(APIModel):
    source_node: str | int
    destination_node: str | int


class AlertCreate(APIModel):
    severity: Literal["low", "medium", "high", "critical"]
    title: str = Field(min_length=1, max_length=240)
    message: str = Field(min_length=1, max_length=4_000)
    location: dict[str, Any] | None = None
    affected_area: dict[str, Any] | None = None
    recommended_action: str | None = Field(default=None, max_length=2_000)
    source: str = Field(min_length=1, max_length=64)
    expires_at: datetime | None = None
    delivery_channels: list[Literal["console", "firebase", "sms", "pwa"]] = Field(default_factory=list)

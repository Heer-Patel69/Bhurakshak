from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"


class Settings(BaseSettings):
    """Runtime configuration loaded only from environment variables and `.env`."""

    model_config = SettingsConfigDict(
        env_file=(REPOSITORY_ROOT / ".env", BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Bhu Rakshak API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'terrawatch.db').as_posix()}"

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None

    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-20b"
    groq_api_base_url: str = "https://api.groq.com/openai/v1"

    imd_api_base_url: str | None = None
    imd_api_key: str | None = None
    imd_auth_token: str | None = None
    imd_provider_enabled: bool = False
    imd_current_path: str | None = None
    imd_recent_rainfall_path: str | None = None
    imd_forecast_path: str | None = None
    imd_metadata_path: str | None = None

    google_cloud_project: str | None = None
    google_application_credentials: str | None = None

    mosdac_username: str | None = None
    mosdac_password: str | None = None
    mosdac_provider_enabled: bool = False

    firebase_credentials: str | None = None
    firebase_enabled: bool = False
    sms_provider: str | None = None
    sms_api_key: str | None = None
    sms_enabled: bool = False

    sensor_ingest_secret: str | None = None
    authority_api_key: str | None = None
    frontend_origins: str = "http://localhost:3000"
    supabase_storage_bucket: str = "hazard-reports"
    media_signed_url_seconds: int = Field(default=900, ge=60, le=86_400)

    historical_inventory_path: Path = REPOSITORY_ROOT / "data" / "Cleaned" / "landslide_date_audit.csv"
    terrain_features_path: Path = REPOSITORY_ROOT / "data" / "Cleaned" / "aizawl_terrain_features.csv"
    rainfall_2024_path: Path = REPOSITORY_ROOT / "data" / "Cleaned" / "aizawl_rainfall_features_may_sep_2024.csv"
    rainfall_2025_path: Path = REPOSITORY_ROOT / "data" / "Cleaned" / "aizawl_rainfall_features_may_sep_2025.csv"
    ml_model_path: Path = BACKEND_ROOT / "models" / "xgboost_landslide_model.joblib"
    ml_schema_path: Path = BACKEND_ROOT / "models" / "feature_schema.json"
    risk_config_path: Path = BACKEND_ROOT / "config" / "risk_weights.yaml"

    roads_geojson_path: Path | None = REPOSITORY_ROOT / "data" / "gis" / "processed" / "aizawl_roads.geojson"
    villages_geojson_path: Path | None = REPOSITORY_ROOT / "data" / "gis" / "processed" / "aizawl_settlements.geojson"
    facilities_geojson_path: Path | None = REPOSITORY_ROOT / "data" / "gis" / "processed" / "aizawl_facilities.geojson"
    road_graph_path: Path | None = REPOSITORY_ROOT / "data" / "gis" / "processed" / "aizawl_road_graph.joblib"
    routing_config_path: Path = BACKEND_ROOT / "config" / "routing.yaml"
    routing_graph_enabled: bool = True
    aizawl_gis_bbox: str = "92.60,23.60,92.85,23.85"

    historical_bandwidth_m: float = Field(default=1_000.0, gt=0)
    historical_normalization_percentile: float = Field(default=95.0, ge=50, le=100)
    risk_grid_max_cells: int = Field(default=400, ge=4, le=10_000)
    risk_grid_cache_seconds: int = Field(default=900, ge=0)
    gis_default_limit: int = Field(default=5_000, ge=1, le=100_000)
    gis_max_limit: int = Field(default=20_000, ge=100, le=250_000)
    routing_risk_grid_resolution: int = Field(default=5, ge=2, le=20)
    max_upload_bytes: int = Field(default=20_000_000, ge=1_000)
    allowed_media_mime_types: str = "image/jpeg,image/png,image/webp,video/mp4,audio/mpeg,audio/wav,audio/webm"

    aizawl_default_latitude: float = 23.7271
    aizawl_default_longitude: float = 92.7176

    @property
    def media_mime_types(self) -> set[str]:
        return {item.strip().lower() for item in self.allowed_media_mime_types.split(",") if item.strip()}

    @property
    def frontend_origin_list(self) -> list[str]:
        return [item.strip() for item in self.frontend_origins.split(",") if item.strip() and item.strip() != "*"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

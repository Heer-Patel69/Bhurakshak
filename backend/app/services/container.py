from __future__ import annotations

from ..core.config import Settings
from ..providers.alerts.console import ConsoleAlertProvider
from ..providers.alerts.firebase import FirebaseAlertProvider
from ..providers.alerts.sms import SMSAlertProvider
from ..providers.satellite.mosdac import MOSDACProvider
from ..providers.satellite.sentinel1 import Sentinel1Provider
from ..providers.satellite.sentinel2 import Sentinel2Provider
from ..providers.sensors.http_sensor import HTTPSensorProvider
from ..providers.weather.historical_chirps import HistoricalCHIRPSProvider
from ..providers.weather.imd import IMDWeatherProvider
from .alert_service import AlertService
from .citizen_report_service import CitizenReportService
from .copilot_service import GroqCopilotService
from .facility_access_service import FacilityAccessService
from .geo_service import GeoService, RiskGridService
from .historical_susceptibility_service import HistoricalSusceptibilityService
from .hybrid_risk_service import HybridRiskService, RiskOrchestrator
from .incident_service import IncidentService
from .i18n_service import I18nService
from .isolation_service import IsolationService
from .ml_service import MLModelService
from .media_storage_service import MediaStorageService
from .road_exposure_service import RoadExposureService
from .routing_service import RoutingService
from .satellite_service import SatelliteService
from .sensor_service import SensorService
from .terrain_service import TerrainService
from .weather_service import WeatherService


class ServiceContainer:
    def __init__(self, settings: Settings) -> None:
        self.imd_provider = IMDWeatherProvider(settings)
        self.chirps_provider = HistoricalCHIRPSProvider(settings.rainfall_2024_path, settings.rainfall_2025_path)
        self.weather = WeatherService(self.imd_provider, self.chirps_provider)
        self.terrain = TerrainService(settings.terrain_features_path)
        self.historical = HistoricalSusceptibilityService(
            settings.historical_inventory_path,
            settings.historical_bandwidth_m,
            settings.historical_normalization_percentile,
        )
        self.ml = MLModelService(settings.ml_model_path, settings.ml_schema_path)
        self.satellite = SatelliteService([Sentinel1Provider(), Sentinel2Provider(), MOSDACProvider(settings)])
        self.sensor_provider = HTTPSensorProvider(settings)
        self.sensors = SensorService()
        self.reports = CitizenReportService(settings)
        self.media = MediaStorageService(settings)
        self.incidents = IncidentService()
        self.i18n = I18nService()
        self.hybrid = HybridRiskService(settings.risk_config_path)
        self.risk = RiskOrchestrator(
            weather_service=self.weather,
            terrain_service=self.terrain,
            historical_service=self.historical,
            ml_service=self.ml,
            sensor_service=self.sensors,
            satellite_service=self.satellite,
            report_service=self.reports,
            hybrid_service=self.hybrid,
        )
        self.risk_grid = RiskGridService(
            self.risk,
            max_cells=settings.risk_grid_max_cells,
            cache_seconds=settings.risk_grid_cache_seconds,
        )
        self.geo = GeoService()
        self.road_exposure = RoadExposureService()
        self.routing = RoutingService(settings.road_graph_path, config_path=settings.routing_config_path)
        self.isolation = IsolationService()
        self.facility_access = FacilityAccessService(self.routing)
        self.alerts = AlertService(
            [ConsoleAlertProvider(), FirebaseAlertProvider(settings), SMSAlertProvider(settings)]
        )
        self.copilot = GroqCopilotService(settings)

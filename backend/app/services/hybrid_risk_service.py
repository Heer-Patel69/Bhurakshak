from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import yaml
from sqlalchemy.orm import Session

from ..models.database import RiskSnapshotDB
from ..models.schemas import Location, MLSusceptibility, RiskPointResponse, TerrainObservation, WeatherObservation
from ..repositories.risk_repository import RiskRepository
from .confidence_service import ConfidenceService


class HybridRiskService:
    """Primary heuristic fusion engine; all weights and thresholds come from configuration."""

    def __init__(self, config_path: Path) -> None:
        with config_path.open("r", encoding="utf-8") as handle:
            self.config: dict[str, Any] = yaml.safe_load(handle)
        self.confidence = ConfidenceService(self.config)

    def evaluate_scores(self, signals: dict[str, dict[str, Any]]) -> dict[str, Any]:
        component_scores = {
            "rainfall": self._rainfall_score(signals.get("rainfall")),
            "terrain": self._terrain_score(signals.get("terrain")),
            "historical": self._scaled(signals.get("historical"), "historical_susceptibility_score"),
            "ml": self._scaled(signals.get("ml"), "ml_susceptibility_score"),
            "sensor": self._scaled(signals.get("sensor"), "soil_moisture"),
            "satellite": self._scaled(signals.get("satellite"), "signal_change_score"),
            "verified_reports": self._report_score(signals.get("verified_reports")),
        }
        configured_weights = self.config["weights"]
        available = {key: value for key, value in component_scores.items() if value is not None}
        active_weight = sum(float(configured_weights[key]) for key in available)
        risk_score = 0.0
        if active_weight:
            risk_score = sum(value * float(configured_weights[key]) for key, value in available.items()) / active_weight
        risk_score = round(max(0.0, min(100.0, risk_score)), 1)
        confidence_score, confidence_level, missing = self.confidence.calculate(signals)
        drivers = [
            f"{name}: {score:.1f}/100 prototype component"
            for name, score in sorted(available.items(), key=lambda item: item[1], reverse=True)
            if score >= 50
        ][:4]
        return {
            "risk_score": risk_score,
            "risk_level": self._risk_level(risk_score),
            "confidence_score": confidence_score,
            "confidence_level": confidence_level,
            "drivers": drivers,
            "missing_signals": missing,
            "component_scores": component_scores,
        }

    def _rainfall_score(self, signal: dict[str, Any] | None) -> float | None:
        if not signal or signal.get("status") not in {"available", "historical_observation"}:
            return None
        ratios = []
        for key, reference in self.config["rainfall_reference_mm"].items():
            value = signal.get(key)
            if value is not None:
                ratios.append(min(1.0, float(value) / float(reference)))
        return max(ratios) * 100 if ratios else None

    def _terrain_score(self, signal: dict[str, Any] | None) -> float | None:
        if not signal or signal.get("status") != "available":
            return None
        reference = self.config["terrain_reference"]
        slope = min(1.0, float(signal["slope_deg"]) / float(reference["slope_full_score_deg"]))
        elevation = min(1.0, max(0.0, float(signal["elevation_m"])) / float(reference["elevation_full_score_m"]))
        return (0.8 * slope + 0.2 * elevation) * 100

    @staticmethod
    def _scaled(signal: dict[str, Any] | None, key: str) -> float | None:
        if not signal or signal.get("status") != "available" or signal.get(key) is None:
            return None
        return max(0.0, min(100.0, float(signal[key]) * 100))

    @staticmethod
    def _report_score(signal: dict[str, Any] | None) -> float | None:
        if not signal or signal.get("status") != "available" or not signal.get("verified_count"):
            return None
        severity = {"low": 25.0, "medium": 50.0, "high": 75.0, "critical": 100.0}
        return severity.get(str(signal.get("highest_severity", "medium")), 50.0)

    def _risk_level(self, score: float) -> str:
        thresholds = self.config["thresholds"]
        if score >= float(thresholds["critical"]):
            return "critical"
        if score >= float(thresholds["high"]):
            return "high"
        if score >= float(thresholds["medium"]):
            return "medium"
        return "low"


class RiskOrchestrator:
    """Collects available signals and delegates facts to the hybrid and confidence engines."""

    def __init__(
        self,
        *,
        weather_service,
        terrain_service,
        historical_service,
        ml_service,
        sensor_service,
        satellite_service,
        report_service,
        hybrid_service: HybridRiskService,
    ) -> None:
        self.weather = weather_service
        self.terrain = terrain_service
        self.historical = historical_service
        self.ml = ml_service
        self.sensors = sensor_service
        self.satellite = satellite_service
        self.reports = report_service
        self.hybrid = hybrid_service

    async def point(
        self,
        session: Session,
        *,
        latitude: float,
        longitude: float,
        at: datetime | None = None,
        persist: bool = True,
    ) -> RiskPointResponse:
        weather, weather_status = await self.weather.current(latitude, longitude, at=at)
        terrain = self.terrain.lookup(latitude, longitude)
        historical = self.historical.score(latitude, longitude)
        sensor = self.sensors.nearest_signal(session, latitude, longitude)
        satellite = await self.satellite.latest(latitude, longitude)
        reports = self.reports.verified_signal(session, latitude, longitude)

        signal_data: dict[str, dict[str, Any]] = {
            "rainfall": weather.model_dump(mode="json") if isinstance(weather, WeatherObservation) else {"status": "unavailable"},
            "terrain": terrain.model_dump(mode="json") if isinstance(terrain, TerrainObservation) else terrain,
            "historical": historical.model_dump(mode="json"),
            "sensor": sensor,
            "satellite": self._satellite_signal(satellite),
            "verified_reports": reports,
        }
        if isinstance(terrain, TerrainObservation) and isinstance(weather, WeatherObservation):
            ml_result: MLSusceptibility = self.ml.predict(
                {
                    "elevation_m": terrain.elevation_m,
                    "slope_deg": terrain.slope_deg,
                    "rain_prev_24h_mm": weather.rainfall_24h_mm or 0.0,
                    "rain_prev_72h_mm": weather.rainfall_72h_mm or 0.0,
                    "rain_prev_7d_mm": weather.rainfall_7d_mm or 0.0,
                }
            )
        else:
            ml_result = self.ml.predict({})
        signal_data["ml"] = ml_result.model_dump(mode="json")
        signal_data["rainfall"]["provider_status"] = weather_status

        evaluated = self.hybrid.evaluate_scores(signal_data)
        assessment_context = (
            "operational" if isinstance(weather, WeatherObservation) and weather.live else "historical_reference_scenario"
        )
        if assessment_context == "historical_reference_scenario" and "live_weather" not in evaluated["missing_signals"]:
            evaluated["missing_signals"].append("live_weather")
        generated_at = datetime.now(UTC)
        component_scores = evaluated.pop("component_scores")
        signal_data["rainfall"]["score"] = component_scores["rainfall"]
        signal_data["terrain"]["score"] = component_scores["terrain"]
        data_sources = self._data_sources(signal_data)
        response = RiskPointResponse(
            location=Location(latitude=latitude, longitude=longitude),
            signals=signal_data,
            generated_at=generated_at,
            data_timestamp=weather.observation_time if isinstance(weather, WeatherObservation) else None,
            data_sources=data_sources,
            assessment_context=assessment_context,
            **evaluated,
        )
        if persist:
            RiskRepository(session).add(
                RiskSnapshotDB(
                    snapshot_id=str(uuid4()),
                    latitude=latitude,
                    longitude=longitude,
                    risk_score=response.risk_score,
                    risk_level=response.risk_level,
                    confidence_score=response.confidence_score,
                    payload=response.model_dump(mode="json"),
                    generated_at=generated_at,
                )
            )
        logging.getLogger("terrawatch.risk").info(
            "Point risk generated",
            extra={"event": "risk_generated"},
        )
        return response

    @staticmethod
    def _satellite_signal(payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("status") != "available" or not payload.get("observations"):
            return {"status": "unavailable", "providers": payload.get("providers", []), "live": False}
        latest = payload["observations"][0]
        return {**latest, "status": "available", "live": False}

    @staticmethod
    def _data_sources(signals: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        sources = []
        for signal_name, signal in signals.items():
            sources.append(
                {
                    "signal": signal_name,
                    "source": signal.get("source") or signal.get("provider") or signal.get("model_name") or "unavailable",
                    "status": signal.get("status", "unknown"),
                    "observation_time": signal.get("observation_time") or signal.get("acquisition_time"),
                    "live": bool(signal.get("live", False)),
                }
            )
        return sources

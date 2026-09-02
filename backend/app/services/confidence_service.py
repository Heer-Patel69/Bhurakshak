from __future__ import annotations

from datetime import datetime
from typing import Any

from ..utils.time import age_seconds


class ConfidenceService:
    """Scores evidence availability and freshness independently from hazard risk."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config["confidence"]

    def calculate(self, signals: dict[str, dict[str, Any]]) -> tuple[float, str, list[str]]:
        weights = self.config["signal_weights"]
        total = 0.0
        missing: list[str] = []
        for name, weight in weights.items():
            signal = signals.get(name)
            availability = self._availability(name, signal)
            total += float(weight) * availability
            if availability <= 0:
                missing.append(name)
        score = round(max(0.0, min(100.0, total)), 1)
        if score >= float(self.config["high_threshold"]):
            level = "high"
        elif score >= float(self.config["moderate_threshold"]):
            level = "moderate"
        else:
            level = "low"
        return score, level, missing

    def _availability(self, name: str, signal: dict[str, Any] | None) -> float:
        if not signal or signal.get("status") not in {"available", "historical_observation"}:
            return 0.0
        if name in {"terrain", "historical", "ml"}:
            return 1.0
        if name == "rainfall":
            if signal.get("live") is False:
                return 0.25
            return self._freshness_factor(signal.get("observation_time"), "weather")
        if name == "sensor":
            return self._freshness_factor(signal.get("observation_time"), "sensor")
        if name == "satellite":
            return self._freshness_factor(signal.get("acquisition_time"), "satellite")
        if name == "verified_reports":
            return 1.0 if signal.get("verified_count", 0) else 0.0
        return 0.0

    def _freshness_factor(self, value: Any, prefix: str) -> float:
        if not value:
            return 0.0
        try:
            observed_at = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            age = age_seconds(observed_at)
        except (TypeError, ValueError):
            return 0.0
        fresh = float(self.config[f"{prefix}_fresh_seconds"])
        stale = float(self.config.get(f"{prefix}_stale_seconds", fresh * 4))
        if age <= fresh:
            return 1.0
        if age >= stale:
            return 0.2
        return 1.0 - 0.8 * ((age - fresh) / (stale - fresh))


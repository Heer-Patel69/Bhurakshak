from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from ..models.schemas import MLSusceptibility


class MLModelService:
    """Loads the existing susceptibility model once and exposes controlled degradation."""

    def __init__(self, model_path: Path, schema_path: Path) -> None:
        self.model_path = model_path
        self.schema_path = schema_path
        self.model: Any | None = None
        self.schema: dict[str, Any] = {}
        self.load_error: str | None = None
        self.load()

    def load(self) -> None:
        logger = logging.getLogger("terrawatch.ml")
        try:
            with self.schema_path.open("r", encoding="utf-8") as handle:
                self.schema = json.load(handle)
            expected = self.schema.get("features")
            if not isinstance(expected, list) or not expected:
                raise ValueError("Feature schema does not declare a non-empty features list")
            self.model = joblib.load(self.model_path)
            model_features = getattr(self.model, "feature_names_in_", None)
            if model_features is not None and list(model_features) != expected:
                raise ValueError(f"Model feature order {list(model_features)} does not match schema {expected}")
            self.load_error = None
            logger.info(
                "Susceptibility model loaded",
                extra={"event": "model_loaded", "provider": self.schema.get("model_name")},
            )
        except Exception as exc:
            self.model = None
            self.load_error = f"{type(exc).__name__}: {exc}"
            logger.exception("Model load failed; backend will degrade gracefully", extra={"event": "model_load_failed"})

    @property
    def expected_features(self) -> list[str]:
        return list(self.schema.get("features", []))

    def health(self) -> dict[str, Any]:
        return {
            "status": "available" if self.model is not None else "unavailable",
            "model_name": self.schema.get("model_name", "unknown"),
            "model_version": self.schema.get("model_version", "unknown"),
            "model_type": self.schema.get(
                "model_type", "experimental_storm_conditioned_spatial_susceptibility"
            ),
            "loaded": self.model is not None,
            "message": self.load_error,
        }

    def predict(self, features: dict[str, float]) -> MLSusceptibility:
        metadata = {
            "model_name": self.schema.get("model_name", "unknown"),
            "model_version": self.schema.get("model_version", "unknown"),
            "model_type": "experimental_storm_conditioned_spatial_susceptibility",
        }
        if self.model is None:
            return MLSusceptibility(
                **metadata,
                ml_susceptibility_score=None,
                status="unavailable",
                message=self.load_error or "Model is not loaded.",
            )
        missing = [name for name in self.expected_features if name not in features]
        unexpected = [name for name in features if name not in self.expected_features]
        if missing or unexpected:
            return MLSusceptibility(
                **metadata,
                ml_susceptibility_score=None,
                status="invalid_features",
                message=f"Feature validation failed; missing={missing}, unexpected={unexpected}",
            )
        try:
            frame = pd.DataFrame([[float(features[name]) for name in self.expected_features]], columns=self.expected_features)
            score = float(self.model.predict_proba(frame)[0][1])
            return MLSusceptibility(
                **metadata,
                ml_susceptibility_score=max(0.0, min(1.0, score)),
                status="available",
                message="Secondary storm-conditioned spatial susceptibility signal; not event probability.",
            )
        except Exception as exc:
            return MLSusceptibility(
                **metadata,
                ml_susceptibility_score=None,
                status="prediction_failed",
                message=f"Controlled model degradation: {type(exc).__name__}",
            )


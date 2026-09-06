"""Safely build and evaluate a candidate five-feature XGBoost model.

This job never trains from raw citizen reports and never promotes a model by
default. It requires deduplicated verified incident candidates plus an audited
background CSV. Use ``--promote`` only after the generated audit passes review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, recall_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBClassifier


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.core.config import Settings  # noqa: E402
from backend.app.models.database import Database, VerifiedTrainingCandidateDB  # noqa: E402


FEATURES = [
    "elevation_m",
    "slope_deg",
    "rain_prev_24h_mm",
    "rain_prev_72h_mm",
    "rain_prev_7d_mm",
]
MIN_POSITIVE_INCIDENTS = 30
MIN_TOTAL_ROWS = 100


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--background-csv", type=Path, help="Authority-reviewed negative/background observations.")
    parser.add_argument("--promote", action="store_true", help="Promote only when every gate passes.")
    parser.add_argument("--min-positive-incidents", type=int, default=MIN_POSITIVE_INCIDENTS)
    return parser.parse_args()


def load_verified_candidates(database: Database) -> pd.DataFrame:
    with database.session() as session:
        rows = list(session.query(VerifiedTrainingCandidateDB).order_by(VerifiedTrainingCandidateDB.event_time))
    records = []
    for row in rows:
        record = {
            "event_id": row.incident_id,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "event_time": row.event_time,
            "label": 1,
            "elevation_m": row.terrain_values.get("elevation_m"),
            "slope_deg": row.terrain_values.get("slope_deg"),
            "rain_prev_24h_mm": row.weather_snapshot.get("rain_prev_24h_mm"),
            "rain_prev_72h_mm": row.weather_snapshot.get("rain_prev_72h_mm"),
            "rain_prev_7d_mm": row.weather_snapshot.get("rain_prev_7d_mm"),
        }
        if not any(pd.isna(record[name]) for name in FEATURES):
            records.append(record)
    return pd.DataFrame(records)


def load_background(path: Path) -> pd.DataFrame:
    required = {*FEATURES, "latitude", "longitude", "event_id", "label"}
    frame = pd.read_csv(path)
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError(f"Background CSV is missing required columns: {', '.join(missing)}")
    if set(frame["label"].dropna().astype(int).unique()) != {0}:
        raise ValueError("Background CSV must contain only authority-reviewed label=0 rows.")
    return frame[[*FEATURES, "latitude", "longitude", "event_id", "label"]].dropna()


def dataset_version(frame: pd.DataFrame) -> str:
    stable = frame.sort_values(["event_id", "latitude", "longitude"]).to_csv(index=False).encode()
    return f"verified-incidents-{datetime.now(UTC):%Y%m%d}-{hashlib.sha256(stable).hexdigest()[:10]}"


def evaluate(y_true: pd.Series, probabilities: np.ndarray, threshold: float) -> dict:
    predictions = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predictions, labels=[0, 1]).ravel()
    return {
        "sample_count": int(len(y_true)),
        "roc_auc": round(float(roc_auc_score(y_true, probabilities)), 4),
        "pr_auc": round(float(average_precision_score(y_true, probabilities)), 4),
        "brier_score": round(float(brier_score_loss(y_true, probabilities)), 4),
        "recall": round(float(recall_score(y_true, predictions, zero_division=0)), 4),
        "false_positive_rate": round(float(fp / max(1, fp + tn)), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def split_indices(frame: pd.DataFrame, groups: pd.Series, seed: int) -> tuple[np.ndarray, np.ndarray]:
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed)
    train, test = next(splitter.split(frame[FEATURES], frame["label"], groups=groups))
    if frame.iloc[test]["label"].nunique() < 2 or frame.iloc[train]["label"].nunique() < 2:
        raise ValueError("Holdout split does not contain both labels; add more spatially diverse reviewed data.")
    return train, test


def main() -> int:
    args = parse_args()
    settings = Settings()
    database = Database(settings.database_url)
    positives = load_verified_candidates(database)
    print(json.dumps({"eligible_verified_incidents": len(positives), "minimum_required": args.min_positive_incidents}))
    if len(positives) < args.min_positive_incidents:
        print("SAFE REFUSAL: not enough unique verified incidents for candidate training.")
        return 2
    if not args.background_csv:
        print("SAFE REFUSAL: supply an authority-reviewed --background-csv; positive reports alone cannot train a calibrated binary model.")
        return 2
    background = load_background(args.background_csv.resolve())
    frame = pd.concat([positives, background], ignore_index=True)
    if len(frame) < MIN_TOTAL_ROWS:
        print(f"SAFE REFUSAL: {len(frame)} total rows; at least {MIN_TOTAL_ROWS} are required.")
        return 2

    version = dataset_version(frame)
    spatial_groups = frame["latitude"].round(2).astype(str) + ":" + frame["longitude"].round(2).astype(str)
    spatial_train, spatial_test = split_indices(frame, spatial_groups, 42)
    event_train, event_test = split_indices(frame, frame["event_id"].astype(str), 84)
    train_indices = np.intersect1d(spatial_train, event_train)
    if frame.iloc[train_indices]["label"].nunique() < 2:
        raise ValueError("Combined spatial/event training split lacks both labels.")

    current_schema = json.loads(settings.ml_schema_path.read_text(encoding="utf-8"))
    if current_schema.get("features") != FEATURES:
        raise ValueError("Production feature schema differs from the locked five-feature schema.")
    threshold = float(current_schema.get("selected_threshold", 0.5))
    model = XGBClassifier(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.03,
        min_child_weight=3,
        subsample=0.7,
        colsample_bytree=0.7,
        reg_alpha=0.5,
        reg_lambda=2.0,
        eval_metric="logloss",
        random_state=42,
        n_jobs=2,
    )
    model.fit(frame.iloc[train_indices][FEATURES], frame.iloc[train_indices]["label"])
    spatial_metrics = evaluate(frame.iloc[spatial_test]["label"], model.predict_proba(frame.iloc[spatial_test][FEATURES])[:, 1], threshold)
    event_metrics = evaluate(frame.iloc[event_test]["label"], model.predict_proba(frame.iloc[event_test][FEATURES])[:, 1], threshold)

    current_metrics = json.loads((settings.ml_schema_path.parent / "metrics.json").read_text(encoding="utf-8"))
    baseline = current_metrics["splits_metrics"]["test"]
    baseline_fpr = baseline["confusion_matrix"]["fp"] / max(1, baseline["confusion_matrix"]["fp"] + baseline["confusion_matrix"]["tn"])
    checks = {
        "spatial_roc_auc": spatial_metrics["roc_auc"] >= max(0.75, baseline["roc_auc"] - 0.02),
        "spatial_pr_auc": spatial_metrics["pr_auc"] >= max(0.50, baseline["pr_auc"] - 0.02),
        "spatial_brier": spatial_metrics["brier_score"] <= min(0.20, baseline["brier_score"] + 0.02),
        "spatial_recall": spatial_metrics["recall"] >= baseline["recall"],
        "spatial_false_alarm": spatial_metrics["false_positive_rate"] <= baseline_fpr + 0.03,
        "event_roc_auc": event_metrics["roc_auc"] >= 0.75,
        "event_pr_auc": event_metrics["pr_auc"] >= 0.50,
        "event_brier": event_metrics["brier_score"] <= 0.20,
        "event_recall": event_metrics["recall"] >= baseline["recall"],
    }
    passed = all(checks.values())
    output_dir = settings.ml_schema_path.parent / "candidates" / version
    output_dir.mkdir(parents=True, exist_ok=False)
    model_path = output_dir / "model.joblib"
    joblib.dump(model, model_path)
    metadata = {
        "model_version": f"candidate-{datetime.now(UTC):%Y.%m.%d.%H%M%S}",
        "trained_at": datetime.now(UTC).isoformat(),
        "training_sample_count": len(train_indices),
        "feature_schema": FEATURES,
        "dataset_version": version,
        "validation_metrics": {"spatial_holdout": spatial_metrics, "event_holdout": event_metrics},
        "promotion_gates": checks,
        "promotion_eligible": passed,
        "production_model": False,
    }
    (output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))

    if args.promote:
        if not passed:
            print("SAFE REFUSAL: candidate failed one or more promotion gates; production remains unchanged.")
            return 3
        promoted_schema = {**current_schema, **metadata, "features": FEATURES, "production_model": True}
        shutil.copy2(model_path, settings.ml_model_path)
        settings.ml_schema_path.write_text(json.dumps(promoted_schema, indent=2), encoding="utf-8")
        print(f"PROMOTED: {metadata['model_version']} after all gates passed.")
    else:
        print("Candidate saved for review. Production model was not changed (no --promote flag).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

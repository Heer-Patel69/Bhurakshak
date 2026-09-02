from __future__ import annotations

from backend.app.services.confidence_service import ConfidenceService


def test_model_load_and_feature_validation(client):
    service = client.app.state.services.ml
    assert service.health()["loaded"] is True
    invalid = service.predict({"elevation_m": 800})
    assert invalid.status == "invalid_features"
    assert invalid.ml_susceptibility_score is None
    valid = service.predict(
        {
            "elevation_m": 800,
            "slope_deg": 30,
            "rain_prev_24h_mm": 50,
            "rain_prev_72h_mm": 100,
            "rain_prev_7d_mm": 150,
        }
    )
    assert valid.status == "available"
    assert 0 <= valid.ml_susceptibility_score <= 1


def test_historical_susceptibility_uses_complete_inventory(client):
    service = client.app.state.services.historical
    result = service.score(23.7271, 92.7176)
    assert result.inventory_size == 572
    assert 0 <= result.historical_susceptibility_score <= 1
    assert result.nearest_historical_event_distance_m >= 0
    assert "distance-decay" in result.methodology


def test_risk_and_confidence_are_separate(client):
    service = client.app.state.services.hybrid
    signals = {
        "rainfall": {
            "status": "historical_observation",
            "live": False,
            "rainfall_24h_mm": 200,
            "rainfall_72h_mm": 400,
            "rainfall_7d_mm": 600,
        },
        "terrain": {"status": "available", "slope_deg": 50, "elevation_m": 1200},
        "historical": {"status": "available", "historical_susceptibility_score": 1},
        "ml": {"status": "available", "ml_susceptibility_score": 0.9},
        "sensor": {"status": "no_sensor_connected"},
        "satellite": {"status": "unavailable"},
        "verified_reports": {"status": "no_verified_reports", "verified_count": 0},
    }
    result = service.evaluate_scores(signals)
    assert result["risk_level"] in {"high", "critical"}
    assert result["confidence_level"] == "moderate"
    assert result["risk_score"] != result["confidence_score"]


def test_weather_fallback_and_imd_not_configured(client):
    weather = client.app.state.services.weather
    assert weather.imd.health().status in {"disabled", "not_configured"}
    assert weather.historical.health().status == "available"
    assert weather.historical.health().live is False


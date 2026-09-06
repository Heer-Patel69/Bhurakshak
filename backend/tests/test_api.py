from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["model"] == "available"
    assert payload["historical_inventory"] == "available"


def test_provider_health_is_truthful(client):
    response = client.get("/api/v1/system/providers")
    assert response.status_code == 200
    payload = response.json()
    assert payload["weather"]["imd"]["live"] is False
    assert payload["weather"]["imd"]["status"] in {"disabled", "not_configured"}
    assert payload["weather"]["chirps"]["live"] is False
    assert payload["satellite"]["sentinel_1"]["status"] == "pipeline_not_configured"
    assert payload["alerts"]["sms"]["enabled"] is False


def test_point_risk_works_with_historical_fallback(client):
    response = client.post(
        "/api/v1/risk/point",
        json={"latitude": 23.7271, "longitude": 92.7176},
    )
    assert response.status_code == 200
    payload = response.json()
    assert 0 <= payload["risk_score"] <= 100
    assert 0 <= payload["confidence_score"] <= 100
    assert payload["signals"]["rainfall"]["provider"] == "historical_chirps"
    assert payload["signals"]["rainfall"]["live"] is False
    assert payload["data_timestamp"].startswith("2024-05-28")
    assert "imd" not in payload["signals"]["rainfall"]["provider_status"]
    assert payload["signals"]["ml"]["model_type"] == "experimental_storm_conditioned_spatial_susceptibility"


def test_sensor_validation_and_ingest(client):
    invalid = client.post(
        "/api/v1/sensors/ingest",
        headers={"X-Sensor-Secret": "test-sensor-secret"},
        json={
            "sensor_id": "bad-sensor",
            "latitude": 23.7,
            "longitude": 92.7,
            "timestamp": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
            "soil_moisture": 1.5,
        },
    )
    assert invalid.status_code == 422

    response = client.post(
        "/api/v1/sensors/ingest",
        headers={"X-Sensor-Secret": "test-sensor-secret"},
        json={
            "sensor_id": "fixture-sensor-1",
            "latitude": 23.7271,
            "longitude": 92.7176,
            "timestamp": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
            "soil_moisture": 0.64,
            "rainfall_mm": 12,
            "battery_percent": 91,
            "source": "test_fixture",
        },
    )
    assert response.status_code == 201
    assert response.json()["source"] == "test_fixture"
    status_response = client.get("/api/v1/sensors/status")
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "operational"
    assert status_response.json()["connected_sensor_count"] == 1


def test_citizen_report_is_idempotent_and_verifiable(client):
    report_id = str(uuid4())
    payload = {
        "report_id": report_id,
        "latitude": 23.7271,
        "longitude": 92.7176,
        "accuracy_m": 18,
        "timestamp": datetime.now(UTC).isoformat(),
        "category": "road_blockage",
        "description_original": "Debris is covering one lane.",
        "language": "en",
        "location_source": "device_gps",
    }
    first = client.post("/api/v1/reports", json=payload)
    second = client.post("/api/v1/reports", json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["report_id"] == second.json()["report_id"] == report_id
    assert first.json()["verification_status"] == "pending"

    verified = client.patch(
        f"/api/v1/reports/{report_id}/verify",
        headers={"Authorization": "Bearer test-supabase-jwt"},
        json={"status": "verified", "verified_by": "authority-test", "severity": "high"},
    )
    assert verified.status_code == 200
    assert verified.json()["report"]["verification_status"] == "verified"
    assert verified.json()["incident_id"] is not None

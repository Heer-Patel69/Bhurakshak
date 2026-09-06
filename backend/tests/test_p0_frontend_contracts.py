from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import httpx

from backend.app.core.config import Settings
from backend.app.services.copilot_service import GroqCopilotService


def _report_payload(reporter_type="citizen", language="hi"):
    return {"report_id": str(uuid4()), "reporter_type": reporter_type, "latitude": 23.7271, "longitude": 92.7176, "accuracy_m": 9.5, "timestamp": datetime.now(UTC).isoformat(), "location_source": "device_gps", "category": "road_blockage", "description_original": "Road blocked by debris", "language": language, "offline_created_at": datetime.now(UTC).isoformat(), "place_name": "Aizawl"}


def test_reporter_gps_offline_and_duplicate_contract(client):
    payload = _report_payload()
    first = client.post("/api/v1/reports", json=payload)
    duplicate = client.post("/api/v1/reports", json=payload)
    assert first.status_code == 201
    assert first.json()["reporter_type"] == "citizen"
    assert first.json()["location"] == {"latitude": 23.7271, "longitude": 92.7176}
    assert first.json()["gps_accuracy_m"] == 9.5
    assert first.json()["created_offline"] is True
    assert duplicate.json()["sync_status"] == "duplicate"


def test_field_and_authority_report_trust(client):
    field = client.post("/api/v1/reports", json=_report_payload("field_official", "en"))
    authority = client.post("/api/v1/reports", json=_report_payload("authority", "en"))
    assert field.json()["verification_status"] == "pending"
    assert authority.json()["verification_status"] == "verified"
    manual = _report_payload()
    manual["location_source"] = "manual_pin"
    assert client.post("/api/v1/reports", json=manual).status_code == 201


def test_authority_confirmation_creates_official_closure(client):
    created = client.post("/api/v1/reports", json=_report_payload()).json()
    response = client.patch(f"/api/v1/reports/{created['report_id']}/verify", headers={"Authorization": "Bearer test-supabase-jwt"}, json={"status": "verified", "verified_by": "officer-1", "severity": "high", "category": "road_blockage", "verification_note": "Inspected on site", "affected_road_id": "way/test/1", "confirmed_road_blockage": True})
    assert response.status_code == 200
    assert response.json()["report"]["authority_action_id"]
    assert response.json()["training_candidate_id"] is None  # No date-matched current archive; never use 2024 rainfall.
    overview = client.get("/api/v1/authority/overview", headers={"Authorization": "Bearer test-supabase-jwt"}).json()
    assert any(item["road_id"] == "way/test/1" for item in overview["confirmed_closures"])


def test_media_signature_validation_and_mocked_private_upload(client, monkeypatch):
    report = client.post("/api/v1/reports", json=_report_payload()).json()
    invalid = client.post(f"/api/v1/reports/{report['report_id']}/media", files={"file": ("bad.jpg", b"not-an-image", "image/jpeg")})
    assert invalid.status_code == 415

    class Response:
        def raise_for_status(self): pass
    class Client:
        def __init__(self, *args, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, *args, **kwargs): return Response()
    media = client.app.state.services.media
    monkeypatch.setattr(media.settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(media.settings, "supabase_service_role_key", "test-only")
    monkeypatch.setattr("backend.app.services.media_storage_service.httpx.AsyncClient", Client)
    valid = client.post(f"/api/v1/reports/{report['report_id']}/media", files={"file": ("safe.jpg", b"\xff\xd8\xff\xe0test", "image/jpeg")})
    assert valid.status_code == 201
    assert valid.json()["storage_path"].startswith(f"reports/{report['report_id']}/")
    assert valid.json()["sha256"]
    assert media._detected_mime(b"\x00\x00\x00\x18ftypmp42") == "video/mp4"


def test_multilingual_weather_cors_bootstrap_and_copilot_fallback(client):
    assert client.app.state.services.i18n.advice("high", "hi")["actions"]
    assert "REQUIRES HUMAN" in client.app.state.services.i18n.advice("critical", "lus")["language_review_status"]
    current = client.get("/api/v1/weather/current", params={"latitude": 23.7, "longitude": 92.7}).json()
    assert current["mode"] == "unavailable" and current["live"] is False
    history = client.get("/api/v1/weather/history", params={"latitude": 23.7, "longitude": 92.7}).json()
    assert history["mode"] == "historical" and history["live"] is False
    bootstrap = client.get("/api/v1/bootstrap")
    assert bootstrap.status_code == 200 and len(bootstrap.json()["supported_languages"]) == 3
    cors = client.options("/api/v1/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert cors.headers["access-control-allow-origin"] == "http://localhost:3000"

    service = GroqCopilotService(Settings(groq_api_key=None))
    facts = {"risk": {"risk_level": "high", "confidence_level": "moderate", "drivers": []}}
    import asyncio
    answer = asyncio.run(service.advice(facts, "en", None, {"actions": ["Move away.", "Follow instructions."]}))
    assert answer["recommendations_source"] == "deterministic_template"

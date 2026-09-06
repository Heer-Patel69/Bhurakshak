from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from backend.app.core.config import Settings  # noqa: E402
from backend.app.core.security import require_authority_key  # noqa: E402
from backend.app.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def settings(tmp_path_factory: pytest.TempPathFactory) -> Settings:
    database_path = tmp_path_factory.mktemp("db") / "test.db"
    return Settings(
        database_url=f"sqlite:///{database_path.as_posix()}",
        sensor_ingest_secret="test-sensor-secret",
        groq_api_key=None,
        supabase_url="https://example.supabase.co",
        supabase_anon_key="test-anon-key",
        supabase_service_role_key=None,
        risk_grid_max_cells=100,
    )


@pytest.fixture(scope="session")
def client(settings: Settings):
    app = create_app(settings)
    async def verified_authority_for_integration_tests():
        return None

    app.dependency_overrides[require_authority_key] = verified_authority_for_integration_tests
    with TestClient(app) as test_client:
        yield test_client

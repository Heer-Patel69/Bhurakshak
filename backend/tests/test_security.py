from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from backend.app.core.config import Settings
from backend.app.core.exceptions import TerraWatchError
from backend.app.core.security import require_authority_key


class _AuthResponse:
    status_code = 200

    def __init__(self, role: str) -> None:
        self.role = role

    def json(self) -> dict:
        return {
            "id": "test-user-id",
            "email": "authority@example.invalid",
            "app_metadata": {"role": self.role},
            "user_metadata": {"role": "admin"},
        }


class _AuthClient:
    def __init__(self, role: str, *args, **kwargs) -> None:
        self.role = role

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, *args, **kwargs):
        return _AuthResponse(self.role)


def _request() -> SimpleNamespace:
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="test-anon-key",
    )
    return SimpleNamespace(
        headers={"Authorization": "Bearer test-jwt"},
        app=SimpleNamespace(state=SimpleNamespace(settings=settings)),
        state=SimpleNamespace(),
    )


def test_authority_role_is_read_from_server_fetched_app_metadata(monkeypatch):
    monkeypatch.setattr(
        "backend.app.core.security.httpx.AsyncClient",
        lambda *args, **kwargs: _AuthClient("authority"),
    )
    request = _request()
    asyncio.run(require_authority_key(request))
    assert request.state.authority["auth_mode"] == "supabase_jwt"
    assert request.state.authority["roles"] == ["authority"]


def test_user_metadata_role_cannot_grant_authority(monkeypatch):
    monkeypatch.setattr(
        "backend.app.core.security.httpx.AsyncClient",
        lambda *args, **kwargs: _AuthClient("citizen"),
    )
    with pytest.raises(TerraWatchError) as exc:
        asyncio.run(require_authority_key(_request()))
    assert exc.value.status_code == 403


def test_configured_shared_access_code_grants_authority_without_network():
    settings = Settings(authority_shared_access_code="shared-test-code")
    request = SimpleNamespace(
        headers={"X-Authority-Key": "shared-test-code"},
        app=SimpleNamespace(state=SimpleNamespace(settings=settings)),
        state=SimpleNamespace(),
    )
    asyncio.run(require_authority_key(request))
    assert request.state.authority["auth_mode"] == "shared_access_code"


def test_incorrect_shared_access_code_is_rejected_without_network():
    settings = Settings(authority_shared_access_code="shared-test-code")
    request = SimpleNamespace(
        headers={"X-Authority-Key": "wrong-code"},
        app=SimpleNamespace(state=SimpleNamespace(settings=settings)),
        state=SimpleNamespace(),
    )
    with pytest.raises(TerraWatchError) as exc:
        asyncio.run(require_authority_key(request))
    assert exc.value.status_code == 401

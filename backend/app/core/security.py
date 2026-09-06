from __future__ import annotations

import secrets

import httpx
from fastapi import Request

from .exceptions import TerraWatchError


def _extract_bearer_or_header(request: Request, header_name: str) -> str | None:
    direct = request.headers.get(header_name)
    if direct:
        return direct
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


async def require_sensor_secret(request: Request) -> None:
    configured = request.app.state.settings.sensor_ingest_secret
    if not configured:
        raise TerraWatchError(
            "SENSOR_INGEST_NOT_CONFIGURED",
            "Sensor ingestion is disabled until SENSOR_INGEST_SECRET is configured.",
            status_code=503,
        )
    supplied = _extract_bearer_or_header(request, "X-Sensor-Secret")
    if not supplied or not secrets.compare_digest(supplied, configured):
        raise TerraWatchError("INVALID_SENSOR_CREDENTIALS", "Invalid sensor ingest credentials.", status_code=401)


async def require_authority_key(request: Request) -> None:
    settings = request.app.state.settings
    shared_code = request.headers.get("X-Authority-Key")
    if settings.authority_shared_access_code and shared_code:
        if secrets.compare_digest(shared_code, settings.authority_shared_access_code):
            request.state.authority = {
                "user_id": None,
                "email": None,
                "roles": ["authority"],
                "auth_mode": "shared_access_code",
            }
            return
        raise TerraWatchError("INVALID_AUTHORITY_CREDENTIALS", "Invalid shared authority access code.", status_code=401)

    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise TerraWatchError(
                "SUPABASE_AUTH_NOT_CONFIGURED",
                "Supabase Auth JWT verification requires SUPABASE_URL and SUPABASE_ANON_KEY.",
                status_code=503,
            )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                    headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
                )
        except httpx.HTTPError as exc:
            raise TerraWatchError(
                "SUPABASE_AUTH_UNAVAILABLE",
                f"Supabase Auth verification is temporarily unavailable ({type(exc).__name__}).",
                status_code=503,
            ) from exc
        if response.status_code != 200:
            raise TerraWatchError("INVALID_AUTHORITY_CREDENTIALS", "Invalid or expired Supabase session.", status_code=401)
        user = response.json()
        app_metadata = user.get("app_metadata") if isinstance(user, dict) else {}
        app_metadata = app_metadata if isinstance(app_metadata, dict) else {}
        raw_roles = app_metadata.get("roles", [])
        roles = {str(item).casefold() for item in raw_roles} if isinstance(raw_roles, list) else set()
        if app_metadata.get("role"):
            roles.add(str(app_metadata["role"]).casefold())
        if not roles.intersection({"authority", "admin"}):
            raise TerraWatchError(
                "INSUFFICIENT_AUTHORITY_ROLE",
                "A verified Supabase authority or admin role is required.",
                status_code=403,
            )
        request.state.authority = {
            "user_id": user.get("id"),
            "email": user.get("email"),
            "roles": sorted(roles),
            "auth_mode": "supabase_jwt",
        }
        return

    raise TerraWatchError("AUTHORITY_AUTH_NOT_CONFIGURED", "Supabase Auth is required for authority access.", status_code=503)

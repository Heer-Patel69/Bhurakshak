from __future__ import annotations

import secrets

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
    configured = request.app.state.settings.authority_api_key
    if not configured:
        raise TerraWatchError(
            "AUTHORITY_AUTH_NOT_CONFIGURED",
            "Authority mutations are disabled until AUTHORITY_API_KEY is configured.",
            status_code=503,
        )
    supplied = _extract_bearer_or_header(request, "X-Authority-Key")
    if not supplied or not secrets.compare_digest(supplied, configured):
        raise TerraWatchError("INVALID_AUTHORITY_CREDENTIALS", "Invalid authority credentials.", status_code=401)


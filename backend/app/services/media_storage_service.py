from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from fastapi import UploadFile
from sqlalchemy.orm import Session

from ..core.config import Settings
from ..core.exceptions import TerraWatchError
from ..models.database import CitizenReportDB, ReportMediaDB


class MediaStorageService:
    """Backend-only boundary for a private Supabase Storage bucket."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def health(self) -> dict[str, Any]:
        configured = bool(self.settings.supabase_url and self.settings.supabase_service_role_key)
        return {"provider": "supabase_storage", "status": "available" if configured else "not_configured", "bucket": self.settings.supabase_storage_bucket, "private": True}

    @staticmethod
    def _detected_mime(data: bytes) -> str | None:
        if data.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            return "image/webp"
        if len(data) >= 12 and data[4:8] == b"ftyp":
            return "video/mp4"
        return None

    async def upload(self, session: Session, report_id: str, upload: UploadFile) -> ReportMediaDB:
        report = session.get(CitizenReportDB, report_id)
        if report is None:
            raise TerraWatchError("REPORT_NOT_FOUND", "Report was not found.", status_code=404)
        data = await upload.read(self.settings.max_upload_bytes + 1)
        if len(data) > self.settings.max_upload_bytes:
            raise TerraWatchError("MEDIA_TOO_LARGE", "Media exceeds the configured size limit.", status_code=413)
        detected = self._detected_mime(data)
        claimed = (upload.content_type or "").lower()
        if detected is None or detected not in self.settings.media_mime_types or claimed != detected:
            raise TerraWatchError("UNSUPPORTED_MEDIA_TYPE", "File signature and allowed MIME type do not match.", status_code=415)
        if not self.settings.supabase_url or not self.settings.supabase_service_role_key:
            raise TerraWatchError("MEDIA_STORAGE_NOT_CONFIGURED", "Private media storage is not configured.", status_code=503)
        media_id = str(uuid4())
        extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4"}[detected]
        storage_path = f"reports/{report_id}/{media_id}{extension}"
        headers = {"Authorization": f"Bearer {self.settings.supabase_service_role_key}", "apikey": self.settings.supabase_service_role_key, "Content-Type": detected, "x-upsert": "false"}
        url = f"{self.settings.supabase_url.rstrip('/')}/storage/v1/object/{self.settings.supabase_storage_bucket}/{storage_path}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(url, content=data, headers=headers)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise TerraWatchError("MEDIA_UPLOAD_FAILED", f"Supabase Storage upload failed: {type(exc).__name__}", status_code=502) from exc
        original = Path(upload.filename or "").name or None
        if original:
            original = re.sub(r"[^A-Za-z0-9._ -]", "_", original)[:255]
        item = ReportMediaDB(media_id=media_id, report_id=report_id, storage_path=storage_path, media_type="image" if detected.startswith("image/") else "video", mime_type=detected, file_size_bytes=len(data), source=report.reporter_type, original_filename=original, sha256=hashlib.sha256(data).hexdigest())
        session.add(item)
        report.sync_status = "synced"
        session.flush()
        return item

    async def signed_url(self, item: ReportMediaDB) -> str:
        if not self.settings.supabase_url or not self.settings.supabase_service_role_key:
            raise TerraWatchError("MEDIA_STORAGE_NOT_CONFIGURED", "Private media storage is not configured.", status_code=503)
        url = f"{self.settings.supabase_url.rstrip('/')}/storage/v1/object/sign/{self.settings.supabase_storage_bucket}/{item.storage_path}"
        headers = {"Authorization": f"Bearer {self.settings.supabase_service_role_key}", "apikey": self.settings.supabase_service_role_key}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json={"expiresIn": self.settings.media_signed_url_seconds}, headers=headers)
            response.raise_for_status()
        value = response.json().get("signedURL") or response.json().get("signedUrl")
        return value if str(value).startswith("http") else f"{self.settings.supabase_url}{value}"

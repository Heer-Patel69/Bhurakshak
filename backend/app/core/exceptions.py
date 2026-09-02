from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class TerraWatchError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 400,
        recoverable: bool = True,
        details: dict | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.recoverable = recoverable
        self.details = details
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(TerraWatchError)
    async def handle_terrawatch_error(_request: Request, exc: TerraWatchError) -> JSONResponse:
        error = {
            "code": exc.code,
            "message": exc.message,
            "recoverable": exc.recoverable,
        }
        if exc.details:
            error["details"] = exc.details
        return JSONResponse(status_code=exc.status_code, content={"error": error})


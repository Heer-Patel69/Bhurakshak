from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .core.risk_mode import risk_mode
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .core.config import Settings, get_settings
from .core.exceptions import register_exception_handlers
from .core.logging import RequestContextMiddleware, configure_logging
from .models.database import Database
from .services.container import ServiceContainer


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # SQLite is a zero-credential development fallback. Managed PostgreSQL
        # deployments must apply reviewed Alembic migrations before startup.
        if app.state.database.engine.dialect.name == "sqlite":
            app.state.database.create_all()
        yield
        app.state.database.dispose()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "Bhu Rakshak landslide susceptibility, infrastructure exposure, connectivity, and reporting API. "
            "Scores are risk estimates, not deterministic event predictions."
        ),
        lifespan=lifespan,
    )
    @app.middleware("http")
    async def select_risk_mode(request, call_next):
        mode = request.query_params.get("risk_mode", request.headers.get("X-Risk-Mode", "historical_2024"))
        if mode not in {"historical_2024", "current"}:
            return JSONResponse({"error": {"code": "INVALID_RISK_MODE", "message": "Use historical_2024 or current."}}, status_code=422)
        token = risk_mode.set(mode)
        try:
            response = await call_next(request)
            response.headers["X-Risk-Mode"] = mode
            response.headers["Vary"] = "X-Risk-Mode"
            return response
        finally:
            risk_mode.reset(token)

    app.state.settings = settings
    app.state.database = Database(settings.database_url)
    app.state.services = ServiceContainer(settings)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Authority-Key", "X-Sensor-Secret", "X-Risk-Mode"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()

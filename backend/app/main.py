from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

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
            "TerraWatch landslide susceptibility, infrastructure exposure, connectivity, and reporting API. "
            "Scores are risk estimates, not deterministic event predictions."
        ),
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.database = Database(settings.database_url)
    app.state.services = ServiceContainer(settings)
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()

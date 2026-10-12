"""Pantrix API — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import SessionLocal
from app.observability import AccessLogMiddleware, configure_logging
from app.routers import distributions, donors, items

settings = get_settings()
configure_logging(settings.log_level)
log = logging.getLogger("pantrix")


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("startup", extra={"extra_fields": {"environment": settings.environment}})
    if settings.seed_demo_data:
        from app.seed import seed_if_empty

        try:
            with SessionLocal() as db:
                seed_if_empty(db)
        except SQLAlchemyError:
            log.exception("demo seed failed; continuing without demo data")
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Track donated stock, expiry risk and distributions for community food banks.",
    lifespan=lifespan,
)

app.add_middleware(AccessLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

Instrumentator(
    excluded_handlers=["/metrics", "/health", "/ready"],
    should_group_status_codes=False,
).instrument(app).expose(app, include_in_schema=False)

app.include_router(items.router)
app.include_router(donors.router)
app.include_router(distributions.router)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    log.error(
        "database error", extra={"extra_fields": {"path": request.url.path, "error": type(exc).__name__}}
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database unavailable, please retry shortly"},
    )


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"service": settings.app_name, "version": settings.app_version, "docs": "/docs"}


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Liveness: the process is up. Deliberately does not touch the database."""
    return {"status": "ok"}


@app.get("/ready", tags=["system"])
def ready() -> JSONResponse:
    """Readiness: only accept traffic once the database answers."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not ready", "database": "unreachable"},
        )
    return JSONResponse({"status": "ready", "database": "ok"})

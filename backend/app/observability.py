"""Structured JSON logging and Pantrix business metrics."""

import json
import logging
import sys
import time
from datetime import UTC, datetime

from prometheus_client import Counter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

STOCK_EVENTS = Counter(
    "pantrix_stock_events_total",
    "Stock changes made through the API",
    ["action"],
)
UNITS_DISTRIBUTED = Counter(
    "pantrix_units_distributed_total",
    "Units of stock handed out to partner organisations",
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        payload.update(getattr(record, "extra_fields", {}))
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    # Uvicorn's own access log duplicates ours in plain text.
    logging.getLogger("uvicorn.access").disabled = True


access_log = logging.getLogger("pantrix.access")

# Probe and scrape traffic would drown the access log.
_QUIET_PATHS = {"/health", "/ready", "/metrics"}


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        if request.url.path not in _QUIET_PATHS:
            access_log.info(
                "request",
                extra={
                    "extra_fields": {
                        "method": request.method,
                        "path": request.url.path,
                        "status": response.status_code,
                        "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                    }
                },
            )
        return response

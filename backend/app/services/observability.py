import logging
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# Prometheus metrics
REQUEST_COUNT = Counter("nexora_requests_total", "Total HTTP requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("nexora_request_latency_seconds", "Request latency seconds", ["method", "path"]) 

logger = logging.getLogger("nexora")


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.time()
        response: Response = await call_next(request)
        duration = time.time() - start
        method = request.method
        path = request.url.path
        status = str(response.status_code)
        try:
            REQUEST_LATENCY.labels(method=method, path=path).observe(duration)
            REQUEST_COUNT.labels(method=method, path=path, status=status).inc()
        except Exception:
            logger.exception("Failed to record prometheus metrics")
        return response


def metrics_response() -> bytes:
    return generate_latest()


def metrics_content_type() -> str:
    return CONTENT_TYPE_LATEST


# logging configuration helper

def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    fmt = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
    handler.setFormatter(logging.Formatter(fmt))

    root = logging.getLogger()
    if not root.handlers:
        root.setLevel(level)
        root.addHandler(handler)

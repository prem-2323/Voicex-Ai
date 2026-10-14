"""Minimal in-memory per-IP rate limiter for /api/* routes.

No extra dependencies. Counts requests in a sliding window and
returns HTTP 429 when the limit is exceeded.
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        max_requests: int = 120,
        window_seconds: int = 60,
    ):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        client = (
            request.client.host
            if request.client is not None
            else "unknown"
        )
        now = time.monotonic()
        window_start = now - self.window_seconds
        hits = self._hits[client]
        while hits and hits[0] <= window_start:
            hits.popleft()
        if len(hits) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please slow down."
                },
            )
        hits.append(now)
        return await call_next(request)

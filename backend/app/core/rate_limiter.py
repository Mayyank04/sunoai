import time
from typing import Optional
from fastapi import Request, HTTPException, status
from backend.app.core.config import settings
from backend.app.core.redis_client import get_redis_client

class RateLimiter:
    def __init__(self, times: int = 120, seconds: int = 60):
        self.times = times
        self.seconds = seconds

    async def __call__(self, request: Request):
        if not settings.RATE_LIMIT_ENABLED:
            return

        # Determine client identifier: authenticated user ID or client IP
        user = getattr(request.state, "user", None)
        client_id = user.id if user else (request.client.host if request.client else "unknown_ip")
        path = request.url.path
        key = f"rate_limit:{client_id}:{path}:{int(time.time() // self.seconds)}"

        redis = await get_redis_client()
        current_count = await redis.incr(key)
        if current_count == 1:
            await redis.expire(key, self.seconds)

        if current_count > self.times:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {self.times} requests per {self.seconds}s. Please slow down.",
                headers={
                    "X-RateLimit-Limit": str(self.times),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": str(self.seconds),
                },
            )

from typing import Optional, Any
import logging
from backend.app.core.config import settings
import json
import time

logger = logging.getLogger(__name__)

class MemoryRedisFallback:
    """In-memory key-value store simulating basic Redis ops for offline dev/tests."""
    def __init__(self):
        self._store: dict[str, tuple[Any, Optional[float]]] = {}

    def _cleanup_expired(self, key: str) -> bool:
        if key in self._store:
            val, expiry = self._store[key]
            if expiry is not None and time.time() > expiry:
                del self._store[key]
                return True
        return False

    async def get(self, key: str) -> Optional[str]:
        if self._cleanup_expired(key) or key not in self._store:
            return None
        return self._store[key][0]

    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        expiry = (time.time() + ex) if ex else None
        self._store[key] = (str(value), expiry)
        return True

    async def setex(self, key: str, time_sec: int, value: Any) -> bool:
        return await self.set(key, value, ex=time_sec)

    async def delete(self, key: str) -> int:
        if key in self._store:
            del self._store[key]
            return 1
        return 0

    async def incr(self, key: str) -> int:
        self._cleanup_expired(key)
        if key not in self._store:
            self._store[key] = ("1", None)
            return 1
        curr, expiry = self._store[key]
        try:
            val = int(curr) + 1
        except ValueError:
            val = 1
        self._store[key] = (str(val), expiry)
        return val

    async def expire(self, key: str, seconds: int) -> bool:
        if key in self._store:
            val, _ = self._store[key]
            self._store[key] = (val, time.time() + seconds)
            return True
        return False

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        pass


_redis_instance: Optional[Any] = None

async def get_redis_client():
    global _redis_instance
    if _redis_instance is not None:
        return _redis_instance

    if settings.REDIS_URL:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1.0,
            )
            # Test connectivity
            await client.ping()
            _redis_instance = client
            logger.info("Connected to live Redis at %s", settings.REDIS_URL)
            return _redis_instance
        except Exception as e:
            logger.warning("Redis connection failed (%s). Falling back to in-memory store.", e)

    _redis_instance = MemoryRedisFallback()
    return _redis_instance

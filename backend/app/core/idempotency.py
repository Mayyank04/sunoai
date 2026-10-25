import json
from typing import Optional, Any, Dict
from fastapi import Header, HTTPException, status
from backend.app.core.config import settings
from backend.app.core.redis_client import get_redis_client

class IdempotencyService:
    @staticmethod
    async def get_stored_response(idempotency_key: str) -> Optional[Dict[str, Any]]:
        if not idempotency_key:
            return None
        redis = await get_redis_client()
        key = f"idempotency:{idempotency_key}"
        cached = await redis.get(key)
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                return None
        return None

    @staticmethod
    async def store_response(idempotency_key: str, data: Any, ttl: int = None) -> None:
        if not idempotency_key:
            return
        ttl = ttl or settings.IDEMPOTENCY_CACHE_TTL_SECONDS
        redis = await get_redis_client()
        key = f"idempotency:{idempotency_key}"
        await redis.setex(key, ttl, json.dumps(data))

async def get_idempotency_key(
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key")
) -> Optional[str]:
    return idempotency_key

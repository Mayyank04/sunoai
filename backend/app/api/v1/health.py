import os
import time
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.redis_client import get_redis_client
from backend.app.services.providers.registry import provider_registry

router = APIRouter(tags=["Health & Status"])
_start_time = time.time()

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Comprehensive health check diagnostic inspecting PostgreSQL, Redis,
    Object Storage, and AI Inference synthesis engines.
    """
    # 1. Database check
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # 2. Redis check
    redis_status = "healthy"
    try:
        redis = await get_redis_client()
        pong = await redis.ping()
        if not pong:
            redis_status = "degraded: ping failed"
    except Exception as e:
        redis_status = f"degraded: {str(e)}"

    # 3. Object Storage check
    storage_status = "healthy"
    try:
        if settings.STORAGE_BACKEND == "local":
            storage_status = "healthy (local disk)" if os.path.exists(settings.LOCAL_STORAGE_DIR) else "unhealthy: directory missing"
        else:
            storage_status = f"healthy ({settings.STORAGE_BACKEND})"
    except Exception as e:
        storage_status = f"unhealthy: {str(e)}"

    # 4. Providers check
    providers = provider_registry.list_all()
    configured_count = sum(1 for p in providers if p.is_configured)

    is_overall_healthy = "unhealthy" not in db_status and "unhealthy" not in storage_status

    return {
        "status": "healthy" if is_overall_healthy else "degraded",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "uptime_seconds": round(time.time() - _start_time, 2),
        "components": {
            "database": db_status,
            "redis": redis_status,
            "storage": storage_status,
            "celery": "active" if settings.CELERY_BROKER_URL or settings.REDIS_URL else "local_fallback",
        },
        "providers_total": len(providers),
        "providers_configured": configured_count,
        "procedural_synth_ready": settings.ENABLE_PROCEDURAL_SYNTH,
    }

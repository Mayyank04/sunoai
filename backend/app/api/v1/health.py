from typing import Dict, Any
from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.services.providers.registry import provider_registry

router = APIRouter(tags=["Health & Status"])

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    providers = provider_registry.list_all()
    configured_count = sum(1 for p in providers if p.is_configured)

    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "storage_backend": settings.STORAGE_BACKEND,
        "providers_total": len(providers),
        "providers_configured": configured_count,
        "procedural_synth_ready": settings.ENABLE_PROCEDURAL_SYNTH
    }

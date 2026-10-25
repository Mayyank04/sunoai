from fastapi import APIRouter
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.generation import router as generation_router
from backend.app.api.v1.jobs import router as jobs_router
from backend.app.api.v1.library import router as library_router
from backend.app.api.v1.lyrics import router as lyrics_router
from backend.app.api.v1.stems import router as stems_router
from backend.app.api.v1.provenance import router as provenance_router
from backend.app.api.v1.daw import router as daw_router
from backend.app.api.v1.voice_consent import router as voice_router
from backend.app.api.v1.subscriptions import router as sub_router
from backend.app.api.v1.uploads import router as uploads_router
from backend.app.api.v1.storage_routes import router as storage_router
from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.health import router as health_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(generation_router)
api_v1_router.include_router(jobs_router)
api_v1_router.include_router(library_router)
api_v1_router.include_router(lyrics_router)
api_v1_router.include_router(stems_router)
api_v1_router.include_router(provenance_router)
api_v1_router.include_router(daw_router)
api_v1_router.include_router(voice_router)
api_v1_router.include_router(sub_router)
api_v1_router.include_router(uploads_router)
api_v1_router.include_router(storage_router)
api_v1_router.include_router(admin_router)

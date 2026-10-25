from fastapi import APIRouter
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.profiles import router as profiles_router
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
from backend.app.api.v1.playlists import router as playlists_router
from backend.app.api.v1.social import router as social_router
from backend.app.api.v1.licenses import router as licenses_router
from backend.app.api.v1.payments import router as payments_router
from backend.app.api.v1.reports import router as reports_router
from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.health import router as health_router

api_v1_router = APIRouter(prefix="/api/v1")

# System & Health
api_v1_router.include_router(health_router)

# Identity & Profiles
api_v1_router.include_router(auth_router)
api_v1_router.include_router(profiles_router)

# Audio Creation & Jobs
api_v1_router.include_router(generation_router)
api_v1_router.include_router(jobs_router)
api_v1_router.include_router(library_router)
api_v1_router.include_router(lyrics_router)
api_v1_router.include_router(stems_router)
api_v1_router.include_router(provenance_router)
api_v1_router.include_router(daw_router)
api_v1_router.include_router(voice_router)

# Storage & Uploads
api_v1_router.include_router(uploads_router)
api_v1_router.include_router(storage_router)

# Social & Community
api_v1_router.include_router(playlists_router)
api_v1_router.include_router(social_router)

# Commercial, Rights & Billing
api_v1_router.include_router(licenses_router)
api_v1_router.include_router(payments_router)
api_v1_router.include_router(sub_router)

# Moderation, Safety & Administration
api_v1_router.include_router(reports_router)
api_v1_router.include_router(admin_router)

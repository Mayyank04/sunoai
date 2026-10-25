import asyncio
import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.core.config import settings
from backend.app.models.user import User
from backend.app.models.job import Job
from backend.app.models.generation import Generation
from backend.app.models.subscription import CreditLedger
from backend.app.services.providers.registry import provider_registry
from backend.app.services.providers.base import ProviderCapabilities, GenerationRequestParams, CostEstimate, LicenseMetadata
from backend.app.services.job_runner import job_runner
from backend.app.services.generation_credits import reserve_generation_credits, settle_generation_credits
from backend.app.schemas.generation import GenerationCreateRequest, GenerationEstimateRequest, GenerationJobResponse, GenerationStatusResponse

router = APIRouter(prefix="/generation", tags=["AI Generation"])

@router.get("/providers", response_model=List[ProviderCapabilities])
async def list_generation_providers():
    return await asyncio.to_thread(provider_registry.list_all)

async def _provider(provider_id):
    provider = provider_registry.get(provider_id)
    if not provider:
        raise HTTPException(400, detail=f"Unknown audio provider '{provider_id}'.")
    return provider

@router.get("/providers/{provider_id}/health")
async def get_provider_health(provider_id: str):
    return await (await _provider(provider_id)).check_health()

@router.get("/providers/{provider_id}/ready")
async def get_provider_readiness(provider_id: str):
    return await (await _provider(provider_id)).check_readiness()

@router.get("/providers/{provider_id}/capabilities", response_model=ProviderCapabilities)
async def get_provider_capabilities(provider_id: str):
    return await asyncio.to_thread((await _provider(provider_id)).get_capabilities)

@router.post("/estimate", response_model=CostEstimate)
async def estimate_generation_cost(req: GenerationEstimateRequest, current_user: User = Depends(get_current_user)):
    provider = await _provider(req.provider)
    caps = await asyncio.to_thread(provider.get_capabilities)
    if req.model_name is None:
        req.model_name = caps.models_available[0] if caps.models_available else ""
    if req.model_name not in caps.models_available:
        raise HTTPException(422, detail="Unsupported model for the selected provider.")
    return provider.estimate_cost(GenerationRequestParams(
        provider_id=req.provider, model_name=req.model_name, prompt="Cost estimate",
        duration_seconds=req.duration_seconds, generate_two_variants=req.generate_two_variants and caps.supports_dual_variants,
    ))

@router.get("/license", response_model=LicenseMetadata)
async def get_license_terms(provider_id: str = Query("ace_step_1_5"), tier: str = Query("creator"), current_user: User = Depends(get_current_user)):
    return (await _provider(provider_id)).get_license_metadata(tier=tier)

async def _validate(params):
    provider = await _provider(params.provider_id)
    caps = await asyncio.to_thread(provider.get_capabilities)
    if params.model_name not in caps.models_available:
        raise HTTPException(422, detail={"error_code": "UNSUPPORTED_MODEL", "message": "Choose a supported model for this provider."})
    if not params.make_instrumental and not (params.lyrics or "").strip():
        raise HTTPException(422, detail={"error_code": "LYRICS_REQUIRED", "message": "Add lyrics to create a song with singing."})
    if not params.make_instrumental and not (caps.supports_vocals and caps.supports_lyrics):
        raise HTTPException(422, detail={"error_code": "VOCALS_UNSUPPORTED", "message": "This provider cannot sing your lyrics. Select a singing-capable model."})
    if params.reference_audio_url:
        raise HTTPException(422, detail={"error_code": "REFERENCE_AUDIO_UNSUPPORTED", "message": "Reference audio is not implemented by this generation pipeline."})
    if params.duration_seconds < caps.min_duration_seconds or params.duration_seconds > caps.max_duration_seconds:
        raise HTTPException(422, detail=f"Choose a duration between {caps.min_duration_seconds} and {caps.max_duration_seconds} seconds.")
    if params.provider_id == "ace_step_1_5":
        import re
        if not params.make_instrumental and not re.sub(r"\[[^]]*\]|\s", "", params.lyrics or ""):
            raise HTTPException(422, detail={"error_code":"LYRICS_REQUIRED", "message":"Add words to sing, beyond section tags."})
        caption = "; ".join(str(value) for value in [params.prompt, params.genre, params.mood, ", ".join(params.instruments), ", ".join(params.style_tags)] if value)
        if len(caption) > 512 or len(params.lyrics or "") > 4096:
            raise HTTPException(422, detail={"error_code":"MODEL_INPUT_LIMIT", "message":"ACE-Step accepts up to 512 combined prompt/style characters and 4096 lyrics characters."})
        if params.seed is not None and not 0 <= params.seed <= 2147483646:
            raise HTTPException(422, detail="Seed must be between 0 and 2147483646.")
    ready = await provider.check_readiness()
    if not caps.is_configured or not ready.get("ready"):
        raise HTTPException(422, detail={"error_code": "CONFIGURATION_REQUIRED", "message": ready.get("message") or caps.configuration_message or "Generation worker is unavailable.", "provider": params.provider_id})
    params.generate_two_variants = params.generate_two_variants and caps.supports_dual_variants
    if params.make_instrumental:
        params.lyrics = None
    return provider, caps

async def _owned(db, job_id, user):
    gen = (await db.execute(select(Generation).where(Generation.job_id == job_id))).scalar_one_or_none()
    if not gen or (gen.user_id != user.id and user.role not in ("admin", "moderator")):
        raise HTTPException(404, detail="Generation job not found.")
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    return gen, job

async def _response(db, gen, job):
    balance = (await db.execute(select(User.credits_balance).where(User.id == gen.user_id))).scalar_one()
    return GenerationJobResponse(
        job_id=gen.job_id, status=gen.status, provider=gen.provider, model_name=gen.model_name,
        credits_deducted=gen.credits_deducted, remaining_balance=balance,
        stream_url=f"/api/v1/jobs/{gen.job_id}/stream",
        variants_supported=bool((job.payload or {}).get("generate_two_variants")) if job else False,
        created_at=gen.created_at,
    )

@router.post("/create", response_model=GenerationJobResponse, status_code=202)
async def create_generation_job(req: GenerationCreateRequest, idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if req.model_name is None:
        caps = await asyncio.to_thread((await _provider(req.provider)).get_capabilities)
        req.model_name = caps.models_available[0] if caps.models_available else ""
    for banned in settings.banned_artists_list:
        if banned in req.prompt.lower():
            raise HTTPException(422, detail=f"Prompt contains protected artist name '{banned}'; anti-impersonation policy applies.")
    # User-scoped keys return the exact associated job, even after other jobs exist.
    key = hashlib.sha256(f"generation:{current_user.id}:{idempotency_key}".encode()).hexdigest() if idempotency_key else None
    if key:
        job = (await db.execute(select(Job).where(Job.user_id == current_user.id, Job.idempotency_key == key))).scalar_one_or_none()
        if job:
            gen, _ = await _owned(db, job.id, current_user)
            stored_fingerprint = (job.payload or {}).get("request_fingerprint")
            fingerprint = hashlib.sha256(req.model_dump_json().encode()).hexdigest()
            if stored_fingerprint != fingerprint:
                raise HTTPException(409, detail="Idempotency key was already used for a different generation request.")
            return await _response(db, gen, job)
    params = GenerationRequestParams(**{**req.model_dump(exclude={"provider"}), "provider_id": req.provider})
    provider, caps = await _validate(params)
    params.seed = req.seed if req.seed is not None else uuid.uuid4().int % 1000000
    cost = provider.estimate_cost(params).credits_required
    job_id = f"job_gen_{uuid.uuid4().hex[:24]}"
    try:
        await reserve_generation_credits(db, current_user.id, cost, job_id, key)
        job = Job(id=job_id, user_id=current_user.id, job_type="generation", status="queued", progress_percentage=0,
                  current_stage="Queued for generation", payload={**params.model_dump(), "request_fingerprint":hashlib.sha256(req.model_dump_json().encode()).hexdigest()}, idempotency_key=key,
                  timeout_seconds=settings.GENERATION_TIMEOUT_SECONDS, max_retries=settings.MAX_JOB_RETRIES)
        gen = Generation(user_id=current_user.id, job_id=job_id, provider=req.provider, model_name=req.model_name,
                         prompt=req.prompt, negative_prompt=req.negative_prompt, seed=params.seed, temperature=req.temperature,
                         reference_audio_url=req.reference_audio_url, duration_requested=req.duration_seconds,
                         status="queued", progress_percentage=0, credits_deducted=cost)
        db.add_all([job, gen])
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, detail="This request is already being submitted. Retry with the same idempotency key.")
    job_runner.dispatch(job_id, current_user.id, params, cost)
    return await _response(db, gen, job)

@router.get("/{job_id}/status", response_model=GenerationStatusResponse)
async def get_generation_status(job_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    gen, job = await _owned(db, job_id, current_user)
    result = (job.result or {}) if job else {}
    balance = (await db.execute(select(User.credits_balance).where(User.id == gen.user_id))).scalar_one()
    return GenerationStatusResponse(
        job_id=job_id, status=gen.status, progress_percentage=gen.progress_percentage,
        current_stage=job.current_stage if job else gen.status, remaining_balance=balance,
        track_id=gen.track_id, audio_url=result.get("audio_url"), second_audio_url=result.get("second_audio_url"),
        duration_seconds=result.get("duration_seconds"), error_code=gen.error_code, error_message=gen.error_message,
    )

@router.post("/{job_id}/cancel", response_model=GenerationStatusResponse)
async def cancel_generation_job(job_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    gen, job = await _owned(db, job_id, current_user)
    claimed = (await db.execute(update(Job).where(Job.id == job_id, Job.status.in_(["queued", "running"]))
        .values(status="cancelled", current_stage="Cancelled", completed_at=datetime.now(timezone.utc)).returning(Job.id))).scalar_one_or_none()
    if not claimed:
        raise HTTPException(400, detail="Generation is already finished.")
    gen.status = "cancelled"
    gen.error_code = "USER_CANCELLED"
    gen.error_message = "Generation cancelled; reserved credits refunded."
    gen.completed_at = datetime.now(timezone.utc)
    await settle_generation_credits(db, job_id, refund=True, reason="User cancellation")
    await db.commit()
    job_runner.mark_cancelled(job_id)
    provider = provider_registry.get(gen.provider)
    if provider:
        try:
            await provider.cancel((job.result or {}).get("provider_job_id") or f"{job_id}_attempt_{job.retry_count}")
        except Exception:
            pass  # Local cancellation suppresses late remote results regardless of connectivity.
    return await get_generation_status(job_id, current_user, db)

@router.post("/{job_id}/retry", response_model=GenerationJobResponse)
async def retry_generation_job(job_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    gen, job = await _owned(db, job_id, current_user)
    if not job or job.status != "failed" or gen.status != "failed":
        raise HTTPException(400, detail="Only failed generation jobs can be retried.")
    if job.retry_count >= job.max_retries:
        raise HTTPException(400, detail="Generation retry limit reached.")
    if not job.payload:
        raise HTTPException(422, detail="Original generation parameters are unavailable; submit a new request with your lyrics.")
    params = GenerationRequestParams.model_validate(job.payload)
    provider, caps = await _validate(params)
    cost = provider.estimate_cost(params).credits_required
    # Retry gets a separate worker id; the original lyrics and instrumental flag stay intact.
    claimed = (await db.execute(update(Job).where(Job.id == job_id, Job.status == "failed")
        .values(status="queued", progress_percentage=0, current_stage="Retry queued", result=None,
                error_code=None, error_message=None, started_at=None, completed_at=None, heartbeat_at=None,
                retry_count=Job.retry_count + 1).returning(Job.id))).scalar_one_or_none()
    if not claimed:
        raise HTTPException(409, detail="Generation was already retried.")
    await reserve_generation_credits(db, gen.user_id, cost, job_id)
    gen.status, gen.progress_percentage, gen.error_code, gen.error_message = "queued", 0, None, None
    gen.completed_at, gen.started_at, gen.credits_deducted = None, None, cost
    await db.commit()
    job_runner.clear_cancelled(job_id)
    job_runner.dispatch(job_id, gen.user_id, params, cost)
    await db.refresh(job)
    return await _response(db, gen, job)

import uuid
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.core.config import settings
from backend.app.models.user import User
from backend.app.models.job import Job
from backend.app.models.generation import Generation
from backend.app.models.track import Track
from backend.app.models.version import SongVersion
from backend.app.models.subscription import CreditLedger
from backend.app.services.providers.registry import provider_registry
from backend.app.services.providers.base import (
    ProviderCapabilities,
    GenerationRequestParams,
    CostEstimate,
    LicenseMetadata,
)
from backend.app.services.job_runner import job_runner
from backend.app.schemas.generation import (
    GenerationCreateRequest,
    GenerationEstimateRequest,
    GenerationJobResponse,
    GenerationStatusResponse,
)

router = APIRouter(prefix="/generation", tags=["AI Generation"])

@router.get("/providers", response_model=List[ProviderCapabilities])
async def list_generation_providers():
    """Lists available AI audio generation providers with their real-time configuration status."""
    return provider_registry.list_all()

@router.get("/providers/{provider_id}/health")
async def get_provider_health(provider_id: str):
    """Returns dynamic runtime health and worker connectivity for a specific model provider."""
    provider = provider_registry.get(provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown audio provider '{provider_id}'."
        )
    return await provider.check_health()

@router.get("/providers/{provider_id}/ready")
async def get_provider_readiness(provider_id: str):
    """Returns readiness check for a specific model provider."""
    provider = provider_registry.get(provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown audio provider '{provider_id}'."
        )
    return await provider.check_readiness()

@router.get("/providers/{provider_id}/capabilities", response_model=ProviderCapabilities)
async def get_provider_capabilities(provider_id: str):
    """Returns declared capabilities and feature matrix for a specific model provider."""
    provider = provider_registry.get(provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown audio provider '{provider_id}'."
        )
    return provider.get_capabilities()


@router.post("/estimate", response_model=CostEstimate)
async def estimate_generation_cost(
    req: GenerationEstimateRequest,
    current_user: User = Depends(get_current_user),
):
    """Calculates credits quota and processing time estimation for a requested model configuration."""
    provider = provider_registry.get(req.provider)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown audio provider '{req.provider}'."
        )

    params = GenerationRequestParams(
        provider_id=req.provider,
        model_name=req.model_name,
        prompt="Cost estimation query",
        duration_seconds=req.duration_seconds,
        generate_two_variants=req.generate_two_variants,
    )
    return provider.estimate_cost(params)

@router.get("/license", response_model=LicenseMetadata)
async def get_license_terms(
    provider_id: str = Query("fombo_procedural", description="Model provider identifier"),
    tier: str = Query("creator", description="User subscription tier (creator, pro, studio)"),
    current_user: User = Depends(get_current_user),
):
    """Returns commercial licensing terms, monetization eligibility, and C2PA provenance policy."""
    provider = provider_registry.get(provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown audio provider '{provider_id}'."
        )
    return provider.get_license_metadata(tier=tier)

@router.post("/create", response_model=GenerationJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_generation_job(
    req: GenerationCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Content Moderation & Artist Name Check (Anti-impersonation)
    prompt_lower = req.prompt.lower()
    for banned in settings.banned_artists_list:
        if banned in prompt_lower:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Prompt contains protected artist name or trademark: '{banned}'. Fombo Music AI enforces strict anti-impersonation policies."
            )

    # 2. Check Idempotency Key
    if idempotency_key:
        existing_ledger = await db.execute(
            select(CreditLedger).where(CreditLedger.idempotency_key == idempotency_key)
        )
        if existing_ledger.scalar_one_or_none():
            existing_gen = await db.execute(
                select(Generation).where(Generation.user_id == current_user.id).order_by(desc(Generation.created_at))
            )
            gen = existing_gen.scalar_one_or_none()
            if gen:
                return GenerationJobResponse(
                    job_id=gen.job_id,
                    status=gen.status,
                    provider=gen.provider,
                    model_name=gen.model_name,
                    credits_deducted=gen.credits_deducted,
                    remaining_balance=current_user.credits_balance,
                    stream_url=f"/api/v1/jobs/{gen.job_id}/stream",
                    variants_supported=False,
                    created_at=gen.created_at
                )

    # 3. Provider Lookup & Credential Verification
    provider = provider_registry.get(req.provider)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown audio provider '{req.provider}'."
        )

    is_configured, config_msg = provider.validate_configuration()
    if not is_configured:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "CONFIGURATION_REQUIRED",
                "message": f"Provider '{provider.name}' cannot be used: {config_msg}. Please select the built-in 'fombo_procedural' synthesizer or configure API credentials in environment.",
                "provider": req.provider
            }
        )

    # 4. Strict Capabilities Validation against Provider Features
    caps = provider.get_capabilities()

    # Lyrics capability check
    if req.lyrics and req.lyrics.strip():
        if not caps.supports_lyrics:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Provider '{caps.display_name}' does not support lyrics synthesis. Please clear the lyrics field or switch to a provider with confirmed lyric support (e.g., Suno)."
            )

    # Vocals / Instrumental toggle capability check
    if not req.make_instrumental:
        if not caps.supports_vocals:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Provider '{caps.display_name}' does not support singing or vocal synthesis. Please enable 'Instrumental' mode or switch to a vocal-capable provider."
            )

    # Duration bounds check
    if req.duration_seconds < caps.min_duration_seconds or req.duration_seconds > caps.max_duration_seconds:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Requested duration ({req.duration_seconds}s) exceeds supported bounds for '{caps.display_name}' ({caps.min_duration_seconds}s - {caps.max_duration_seconds}s)."
        )

    # Dual variants validation: only generate two variants if the provider confirms support
    effective_dual_variants = bool(req.generate_two_variants and caps.supports_dual_variants)

    # 5. Dynamic Credit Cost Calculation
    seed = req.seed if req.seed is not None else int(uuid.uuid4().int % 1000000)
    gen_params = GenerationRequestParams(
        provider_id=req.provider,
        model_name=req.model_name,
        prompt=req.prompt,
        lyrics=req.lyrics if not req.make_instrumental else None,
        make_instrumental=req.make_instrumental,
        genre=req.genre,
        mood=req.mood,
        instruments=req.instruments,
        style_tags=req.style_tags,
        bpm=req.bpm,
        musical_key=req.musical_key,
        duration_seconds=req.duration_seconds,
        seed=seed,
        temperature=req.temperature,
        generate_two_variants=effective_dual_variants,
        reference_audio_url=req.reference_audio_url
    )

    cost_estimate = provider.estimate_cost(gen_params)
    credits_required = cost_estimate.credits_required

    # 6. Check Credit Balance
    if current_user.credits_balance < credits_required:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient generation credits. Required: {credits_required}, Available: {current_user.credits_balance}. Please upgrade to Pro or Studio."
        )

    # 7. Atomic Transaction: Reserve Credits & Persist Job + Generation Records
    job_id = f"job_gen_{uuid.uuid4().hex[:12]}"
    try:
        current_user.credits_balance -= credits_required

        ledger = CreditLedger(
            user_id=current_user.id,
            amount=-credits_required,
            balance_after=current_user.credits_balance,
            transaction_type="generation",
            status="reserved",
            reference_id=job_id,
            idempotency_key=idempotency_key,
            notes=f"AI generation with {req.provider}:{req.model_name} (variants: {2 if effective_dual_variants else 1})"
        )
        db.add(ledger)

        db_job = Job(
            id=job_id,
            user_id=current_user.id,
            job_type="generation",
            status="queued",
            progress_percentage=0,
            current_stage="Job queued for audio synthesis",
            retry_count=0,
            max_retries=3,
            timeout_seconds=300,
            idempotency_key=idempotency_key,
            payload=gen_params.model_dump(),
            started_at=None,
            completed_at=None,
        )
        db.add(db_job)

        generation = Generation(
            user_id=current_user.id,
            job_id=job_id,
            provider=req.provider,
            model_name=req.model_name,
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            seed=seed,
            temperature=req.temperature,
            duration_requested=req.duration_seconds,
            status="queued",
            progress_percentage=0,
            credits_deducted=credits_required
        )
        db.add(generation)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize generation transaction: {str(exc)}"
        )

    # 8. Dispatch Background Audio Processing Pipeline
    asyncio.create_task(
        job_runner.execute_generation_job(
            job_id=job_id,
            user_id=current_user.id,
            params=gen_params,
            credits_cost=credits_required
        )
    )

    return GenerationJobResponse(
        job_id=job_id,
        status="queued",
        provider=req.provider,
        model_name=req.model_name,
        credits_deducted=credits_required,
        remaining_balance=current_user.credits_balance,
        stream_url=f"/api/v1/jobs/{job_id}/stream",
        variants_supported=effective_dual_variants,
        created_at=datetime.now(timezone.utc)
    )

@router.get("/{job_id}/status", response_model=GenerationStatusResponse)
async def get_generation_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Polls real-time progress and audio artifact URLs for a generation task."""
    gen_res = await db.execute(select(Generation).where(Generation.job_id == job_id))
    gen = gen_res.scalar_one_or_none()
    if not gen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Generation job '{job_id}' not found."
        )

    # Also inspect Job table for results and audio urls
    j_res = await db.execute(select(Job).where(Job.id == job_id))
    job = j_res.scalar_one_or_none()

    audio_url = None
    second_audio_url = None
    duration_seconds = None
    if job and job.result:
        audio_url = job.result.get("audio_url")
        second_audio_url = job.result.get("second_audio_url")
        duration_seconds = job.result.get("duration_seconds")

    # If completed and track_id is set, fetch track directly
    if not audio_url and gen.track_id:
        t_res = await db.execute(select(Track).where(Track.id == gen.track_id))
        track = t_res.scalar_one_or_none()
        if track:
            audio_url = track.audio_url
            duration_seconds = track.duration_seconds
            # Check for version 2
            v_res = await db.execute(select(SongVersion).where(SongVersion.track_id == track.id, SongVersion.version_number == 2))
            version2 = v_res.scalar_one_or_none()
            if version2:
                second_audio_url = version2.audio_url

    return GenerationStatusResponse(
        job_id=gen.job_id,
        status=gen.status,
        progress_percentage=gen.progress_percentage,
        track_id=gen.track_id,
        audio_url=audio_url,
        second_audio_url=second_audio_url,
        duration_seconds=duration_seconds,
        error_code=gen.error_code,
        error_message=gen.error_message,
    )

@router.post("/{job_id}/cancel", response_model=GenerationStatusResponse)
async def cancel_generation_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancels an in-flight or queued generation task and restores reserved credits."""
    gen_res = await db.execute(select(Generation).where(Generation.job_id == job_id))
    gen = gen_res.scalar_one_or_none()
    if not gen:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Generation job '{job_id}' not found.")

    if gen.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot cancel another user's generation job.")

    if gen.status in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Generation job is already {gen.status}.")

    # Halt in-memory runner
    job_runner.mark_cancelled(job_id)

    # Cancel on provider side if remote
    provider = provider_registry.get(gen.provider)
    if provider:
        await provider.cancel(job_id)

    # Refund credits
    current_user.credits_balance += gen.credits_deducted
    refund_ledger = CreditLedger(
        user_id=current_user.id,
        amount=gen.credits_deducted,
        balance_after=current_user.credits_balance,
        transaction_type="refund",
        reference_id=job_id,
        notes=f"User cancellation refund for generation {job_id}"
    )
    db.add(refund_ledger)

    gen.status = "cancelled"
    gen.error_code = "USER_CANCELLED"
    gen.error_message = "Generation cancelled by user request."

    j_res = await db.execute(select(Job).where(Job.id == job_id))
    job = j_res.scalar_one_or_none()
    if job:
        job.status = "cancelled"
        job.current_stage = "Job cancelled by user"
        job.completed_at = datetime.now(timezone.utc)

    await db.commit()

    return GenerationStatusResponse(
        job_id=gen.job_id,
        status="cancelled",
        progress_percentage=gen.progress_percentage,
        track_id=gen.track_id,
        audio_url=None,
        second_audio_url=None,
        error_code="USER_CANCELLED",
        error_message="Generation cancelled by user request.",
    )

@router.post("/{job_id}/retry", response_model=GenerationJobResponse)
async def retry_generation_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retries a failed generation job, re-verifying credits balance and re-enqueuing inference."""
    gen_res = await db.execute(select(Generation).where(Generation.job_id == job_id))
    gen = gen_res.scalar_one_or_none()
    if not gen:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Generation job '{job_id}' not found.")

    if gen.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot retry another user's generation job.")

    if gen.status != "failed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only failed generation jobs can be retried.")

    credits_needed = gen.credits_deducted or 5
    if current_user.credits_balance < credits_needed:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient generation credits for retry. Required: {credits_needed}, Available: {current_user.credits_balance}."
        )

    # Reserve credits again
    current_user.credits_balance -= credits_needed
    ledger = CreditLedger(
        user_id=current_user.id,
        amount=-credits_needed,
        balance_after=current_user.credits_balance,
        transaction_type="generation",
        reference_id=job_id,
        notes=f"Retry AI generation for {job_id}"
    )
    db.add(ledger)

    gen.status = "queued"
    gen.progress_percentage = 0
    gen.error_code = None
    gen.error_message = None

    j_res = await db.execute(select(Job).where(Job.id == job_id))
    job = j_res.scalar_one_or_none()
    if job:
        job.status = "queued"
        job.progress_percentage = 0
        job.retry_count += 1
        job.current_stage = f"Retry attempt {job.retry_count} queued"
        job.error_code = None
        job.error_message = None

    await db.commit()

    provider = provider_registry.get(gen.provider) or provider_registry.get("fombo_procedural")
    caps = provider.get_capabilities()
    params = GenerationRequestParams(
        provider_id=gen.provider,
        model_name=gen.model_name,
        prompt=gen.prompt,
        duration_seconds=gen.duration_requested or 30,
        seed=gen.seed,
        temperature=gen.temperature,
        generate_two_variants=caps.supports_dual_variants,
    )

    asyncio.create_task(
        job_runner.execute_generation_job(
            job_id=job_id,
            user_id=current_user.id,
            params=params,
            credits_cost=credits_needed
        )
    )

    return GenerationJobResponse(
        job_id=job_id,
        status="queued",
        provider=gen.provider,
        model_name=gen.model_name,
        credits_deducted=credits_needed,
        remaining_balance=current_user.credits_balance,
        stream_url=f"/api/v1/jobs/{job_id}/stream",
        variants_supported=caps.supports_dual_variants,
        created_at=datetime.now(timezone.utc)
    )

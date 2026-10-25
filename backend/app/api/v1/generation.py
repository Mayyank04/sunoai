import uuid
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.core.config import settings
from backend.app.models.user import User
from backend.app.models.generation import Generation
from backend.app.models.subscription import CreditLedger
from backend.app.services.providers.registry import provider_registry
from backend.app.services.providers.base import ProviderCapabilities, GenerationRequestParams
from backend.app.services.job_runner import job_runner
from backend.app.schemas.generation import GenerationCreateRequest, GenerationJobResponse

router = APIRouter(prefix="/generation", tags=["AI Generation"])

CREDITS_PER_GENERATION = 5

@router.get("/providers", response_model=List[ProviderCapabilities])
async def list_generation_providers():
    """Lists available AI audio generation providers with their real-time configuration status."""
    return provider_registry.list_all()

@router.post("/create", response_model=GenerationJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_generation_job(
    req: GenerationCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Content Moderation & Artist Name Check
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
            # Find associated generation
            existing_gen = await db.execute(
                select(Generation).where(Generation.user_id == current_user.id).order_by(Generation.created_at.desc())
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
                    created_at=gen.created_at
                )

    # 3. Check Credit Balance
    if current_user.credits_balance < CREDITS_PER_GENERATION:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient generation credits. Required: {CREDITS_PER_GENERATION}, Available: {current_user.credits_balance}. Please upgrade to Pro or Studio."
        )

    # 4. Validate Provider Capabilities
    provider = provider_registry.get(req.provider)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown audio provider '{req.provider}'."
        )

    is_configured, msg = provider.validate_configuration()
    if not is_configured:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "CONFIGURATION_REQUIRED",
                "message": f"Provider '{provider.name}' cannot be used: {msg}. Please select the built-in 'fombo_procedural' synthesizer or configure API credentials.",
                "provider": req.provider
            }
        )

    # 5. Atomic Credit Deduction
    current_user.credits_balance -= CREDITS_PER_GENERATION
    job_id = f"job_gen_{uuid.uuid4().hex[:12]}"
    seed = req.seed if req.seed is not None else int(uuid.uuid4().int % 1000000)

    ledger = CreditLedger(
        user_id=current_user.id,
        amount=-CREDITS_PER_GENERATION,
        balance_after=current_user.credits_balance,
        transaction_type="generation",
        reference_id=job_id,
        idempotency_key=idempotency_key,
        notes=f"AI generation with {req.provider}:{req.model_name}"
    )
    db.add(ledger)

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
        credits_deducted=CREDITS_PER_GENERATION
    )
    db.add(generation)
    await db.commit()

    # 6. Dispatch Background Task
    gen_params = GenerationRequestParams(
        provider_id=req.provider,
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        genre=req.genre,
        style_tags=req.style_tags,
        bpm=req.bpm,
        musical_key=req.musical_key,
        duration_seconds=req.duration_seconds,
        seed=seed,
        temperature=req.temperature,
        model_name=req.model_name,
        reference_audio_url=req.reference_audio_url
    )

    asyncio.create_task(
        job_runner.execute_generation_job(
            job_id=job_id,
            user_id=current_user.id,
            params=gen_params,
            credits_cost=CREDITS_PER_GENERATION
        )
    )

    return GenerationJobResponse(
        job_id=job_id,
        status="queued",
        provider=req.provider,
        model_name=req.model_name,
        credits_deducted=CREDITS_PER_GENERATION,
        remaining_balance=current_user.credits_balance,
        stream_url=f"/api/v1/jobs/{job_id}/stream",
        created_at=datetime.now(timezone.utc)
    )

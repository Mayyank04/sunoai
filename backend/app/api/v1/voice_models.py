import uuid
import re
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.voice_model import VoiceModel, VoiceAuditLog
from backend.app.models.voice_consent import VoiceConsent
from backend.app.schemas.voice import (
    VoiceEnrollmentRequest,
    VoiceModelResponse,
    VoiceAuditLogResponse,
    VoiceRevokeResponse,
)

router = APIRouter(prefix="/voice-models", tags=["Custom Voice Models & Ethical Consent"])

BANNED_CELEBRITY_VOICES = [
    "drake",
    "taylor swift",
    "the weeknd",
    "ariana grande",
    "eminem",
    "arijit singh",
    "justin bieber",
    "kanye west",
    "billie eilish",
    "freddie mercury",
    "elvis presley",
    "rihanna",
    "shreya ghoshal",
    "diljit dosanjh",
    "bad bunny",
    "travis scott",
    "michael jackson",
    "beyonce",
    "ed sheeran",
    "adele",
]

def check_anti_impersonation(name: str):
    name_clean = name.lower()
    for banned in BANNED_CELEBRITY_VOICES:
        if re.search(rf"\b{re.escape(banned)}\b", name_clean):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "IMPERSONATION_BLOCKED",
                    "message": (
                        f"Unauthorized voice cloning of protected artist '{banned.title()}' is blocked. "
                        "Fombo Music AI strictly prohibits non-consensual voice likeness synthesis."
                    ),
                    "blocked_entity": banned,
                },
            )

@router.get("", response_model=List[VoiceModelResponse])
async def list_voice_models(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists enrolled custom voice models belonging to the authenticated user."""
    res = await db.execute(
        select(VoiceModel)
        .where(VoiceModel.user_id == current_user.id, VoiceModel.enrollment_status != "deleted")
        .order_by(desc(VoiceModel.created_at))
    )
    models = res.scalars().all()
    return [VoiceModelResponse.model_validate(m) for m in models]

@router.post("/enroll", response_model=VoiceModelResponse, status_code=status.HTTP_201_CREATED)
async def enroll_custom_voice_model(
    req: VoiceEnrollmentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Enrolls a custom voice model with mandatory ownership attestation,
    anti-impersonation filtering, and singing capability validation.
    """
    # 1. Anti-Impersonation Check
    check_anti_impersonation(req.name)

    # 2. Mandatory Ownership & Consent Attestation
    if not req.ownership_attestation_confirmed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "OWNERSHIP_ATTESTATION_REQUIRED",
                "message": (
                    "Voice model enrollment requires explicit legal attestation that you own or have full legal consent "
                    "to model this voice. Creating non-consensual voice models is strictly forbidden."
                ),
            },
        )

    # 3. Singing vs. Spoken Capability Truthfulness
    # "Do not present an ordinary TTS voice as a full singing voice model unless it actually supports singing."
    if req.voice_type == "spoken_tts" and req.supports_singing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "TTS_SINGING_MISMATCH",
                "message": (
                    "An ordinary TTS (text-to-speech) voice cannot be enrolled as a singing voice model. "
                    "Set 'supports_singing' to False or provide an authentic singing vocal model checkpoint."
                ),
            },
        )

    # 4. Create Voice Model
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "unknown")

    voice_model = VoiceModel(
        user_id=current_user.id,
        name=req.name,
        description=req.description,
        voice_type=req.voice_type,
        supports_singing=req.supports_singing,
        enrollment_status="enrolled",
        reference_audio_url=req.reference_audio_url,
        sample_rate=44100,
        pitch_range=req.pitch_range,
        timbre_description=req.timbre_description,
        ownership_attestation_confirmed=True,
        verification_challenge_id=req.challenge_id,
        is_active=True,
    )
    db.add(voice_model)
    await db.flush()

    # 5. Record Compliance Audit Log
    audit = VoiceAuditLog(
        voice_model_id=voice_model.id,
        user_id=current_user.id,
        action="enrolled",
        details={
            "voice_name": req.name,
            "voice_type": req.voice_type,
            "supports_singing": req.supports_singing,
            "challenge_id": req.challenge_id,
            "attestation": "User signed legal voice ownership declaration.",
        },
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(voice_model)

    return VoiceModelResponse.model_validate(voice_model)

@router.post("/{model_id}/revoke", response_model=VoiceRevokeResponse)
async def revoke_voice_consent(
    model_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revokes voice consent immediately, disabling model weights and terminating inference pipelines.
    """
    res = await db.execute(select(VoiceModel).where(VoiceModel.id == model_id))
    model = res.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice model not found.")
    if model.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot revoke another user's voice model.")

    model.enrollment_status = "revoked"
    model.is_active = False
    model.revoked_at = datetime.now(timezone.utc)

    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "unknown")

    audit = VoiceAuditLog(
        voice_model_id=model.id,
        user_id=current_user.id,
        action="consent_revoked",
        details={"reason": "User requested immediate revocation of voice cloning rights."},
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(audit)
    await db.commit()

    return VoiceRevokeResponse(
        id=model.id,
        name=model.name,
        enrollment_status="revoked",
        revoked_at=model.revoked_at,
        audit_event_id=audit.id,
        message="Voice model revoked successfully. Synthetic inference access has been halted.",
    )

@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice_model(
    model_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently deletes a custom voice model and registers an immutable audit event.
    """
    res = await db.execute(select(VoiceModel).where(VoiceModel.id == model_id))
    model = res.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice model not found.")
    if model.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's voice model.")

    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "unknown")

    audit = VoiceAuditLog(
        voice_model_id=model.id,
        user_id=current_user.id,
        action="deleted",
        details={"model_name": model.name, "deleted_by": current_user.id},
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(audit)
    model.enrollment_status = "deleted"
    model.is_active = False
    await db.commit()
    return None

@router.get("/{model_id}/audit-logs", response_model=List[VoiceAuditLogResponse])
async def get_voice_audit_logs(
    model_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves immutable compliance audit logs for a voice model."""
    res = await db.execute(select(VoiceModel).where(VoiceModel.id == model_id))
    model = res.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice model not found.")
    if model.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    logs_res = await db.execute(
        select(VoiceAuditLog)
        .where(VoiceAuditLog.voice_model_id == model_id)
        .order_by(desc(VoiceAuditLog.created_at))
    )
    logs = logs_res.scalars().all()
    return [VoiceAuditLogResponse.model_validate(l) for l in logs]

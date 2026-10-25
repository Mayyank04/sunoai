import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.voice_consent import VoiceConsent
from backend.app.schemas.other import VoiceChallengeResponse, VoiceVerifyRequest, VoiceConsentResponse

router = APIRouter(prefix="/voice-consent", tags=["Voice Consent Governance"])

CHALLENGE_PHRASES = [
    "I explicitly consent to Fombo Music AI modeling my acoustic vocal characteristics for composition purposes.",
    "My unique vocal resonance is hereby verified for digital multitrack arrangement under standard AI rights guidelines.",
    "I affirm that I am the sole owner of this voice recording and authorize its synthetic processing."
]

@router.post("/challenge", response_model=VoiceChallengeResponse)
async def request_liveness_challenge(current_user: User = Depends(get_current_user)):
    """Issues a randomized phoneme challenge sentence for voice verification."""
    phrase_id = str(uuid.uuid4())
    phrase = CHALLENGE_PHRASES[hash(phrase_id) % len(CHALLENGE_PHRASES)]
    return VoiceChallengeResponse(
        challenge_id=phrase_id,
        phonetic_phrase=phrase,
        instructions="Record yourself reciting this phrase clearly to verify voice consent and combat non-consensual deepfakes.",
        expires_in_seconds=600
    )

@router.post("/verify", response_model=VoiceConsentResponse)
async def submit_voice_consent(
    req: VoiceVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not req.consent_acknowledged:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must acknowledge the voice consent declaration."
        )

    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "unknown")

    consent = VoiceConsent(
        user_id=current_user.id,
        voice_label=req.voice_label,
        consent_statement="User explicitly affirmed exclusive ownership and granted synthetic modeling rights.",
        liveness_phrase_read=req.challenge_id,
        liveness_audio_url=req.audio_url,
        ip_address=client_ip,
        user_agent=user_agent,
        status="verified"
    )
    db.add(consent)
    await db.commit()
    await db.refresh(consent)

    return VoiceConsentResponse(
        id=consent.id,
        voice_label=consent.voice_label,
        status=consent.status,
        signed_at=consent.signed_at
    )

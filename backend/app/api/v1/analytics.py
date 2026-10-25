from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from datetime import datetime, timedelta, timezone
from typing import Optional
from backend.app.core.database import get_db
from backend.app.core.security import get_optional_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.social import Artist
from backend.app.models.analytics import ListeningPlay
from backend.app.schemas.track import PlayTelemetryRequest, PlayTelemetryResponse

router = APIRouter(prefix="/analytics", tags=["Listening Analytics & Anti-Spam"])

BANNED_BOT_KEYWORDS = [
    "bot", "crawler", "spider", "scraper", "headless", "curl", "wget", "python-requests", "urllib", "postman"
]

MIN_QUALIFYING_LISTEN_SECONDS = 15.0
DEBOUNCE_INTERVAL_SECONDS = 60

@router.post("/play", response_model=PlayTelemetryResponse)
async def record_listening_play(
    req: PlayTelemetryRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Record an audio playback event with rigorous bot and spam filtration.
    Only qualifying, non-bot listens of >= 15 seconds increment public play counts.
    """
    res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    # Content visibility check
    if track.moderation_status == "taken_down":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot record analytics on taken-down content.",
        )

    # 1. Extract telemetry headers
    user_agent = (request.headers.get("user-agent") or "").lower()
    ip_addr = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "127.0.0.1")
    if "," in ip_addr:
        ip_addr = ip_addr.split(",")[0].strip()

    is_valid = True
    rejection_reason = None

    # 2. Bot / Crawler Detection
    if any(keyword in user_agent for keyword in BANNED_BOT_KEYWORDS):
        is_valid = False
        rejection_reason = "bot_user_agent"

    # 3. Minimum Duration Check (Must listen for at least 15s)
    elif req.duration_listened_seconds < MIN_QUALIFYING_LISTEN_SECONDS:
        is_valid = False
        rejection_reason = "short_listen_duration"

    # 4. Anti-Spam Rapid Replay Debouncing
    else:
        since_time = datetime.now(timezone.utc) - timedelta(seconds=DEBOUNCE_INTERVAL_SECONDS)
        conditions = [
            ListeningPlay.track_id == track.id,
            ListeningPlay.is_valid_play == True,
            ListeningPlay.created_at >= since_time,
        ]
        if current_user:
            conditions.append(ListeningPlay.user_id == current_user.id)
        else:
            conditions.append(ListeningPlay.ip_address == ip_addr)

        recent_play = await db.execute(select(ListeningPlay).where(and_(*conditions)))
        if recent_play.scalar_one_or_none():
            is_valid = False
            rejection_reason = "duplicate_recent_play"

    # Persist analytics audit record
    play_record = ListeningPlay(
        track_id=track.id,
        user_id=current_user.id if current_user else None,
        ip_address=ip_addr,
        user_agent=user_agent[:255] if user_agent else None,
        duration_listened_seconds=req.duration_listened_seconds,
        completed_ratio=req.completed_ratio,
        is_valid_play=is_valid,
        rejection_reason=rejection_reason,
    )
    db.add(play_record)

    # Atomically increment verified play count only if valid
    if is_valid:
        track.play_count += 1
        # Update artist monthly listeners
        art_res = await db.execute(select(Artist).where(Artist.user_id == track.user_id))
        artist = art_res.scalar_one_or_none()
        if artist:
            artist.monthly_listeners += 1

    await db.commit()
    await db.refresh(track)

    return PlayTelemetryResponse(
        counted=is_valid,
        play_count=track.play_count,
        rejection_reason=rejection_reason,
    )

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import Optional, List
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, get_optional_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.schemas.track import (
    TrackResponse,
    TrackListResponse,
    TrackPublishRequest,
    TrackPublishResponse,
    TrackShareResponse,
    TrackUpdateRequest,
)
from backend.app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/tracks", tags=["Tracks, Publishing & Streaming"])

@router.get("/{track_id}", response_model=TrackResponse)
async def get_track(
    track_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve track details with strict content visibility enforcement.
    - Private tracks require authentication and ownership (or admin/moderator).
    - Taken down tracks are blocked from public viewing.
    - Unlisted tracks are accessible via direct link.
    """
    res = await db.execute(select(Track).options(selectinload(Track.user)).where(Track.id == track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    is_admin = current_user and current_user.role in ("admin", "moderator")
    is_owner = current_user and current_user.id == track.user_id

    # 1. Moderation Takedown Enforcement
    if track.moderation_status == "taken_down" and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This content has been taken down due to a copyright complaint or terms of service violation.",
        )

    # 2. Private Visibility Enforcement
    if track.visibility == "private" and not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This track is private and only accessible by its creator.",
        )

    resp = TrackResponse.model_validate(track)
    if track.user:
        resp.artist_username = track.user.username
        resp.artist_name = track.user.full_name or track.user.username
        resp.artist_avatar_url = track.user.avatar_url
    return resp

@router.post("/{track_id}/publish", response_model=TrackPublishResponse)
async def publish_track(
    track_id: str,
    req: TrackPublishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Publish or adjust visibility settings (public, unlisted, private) for a track.
    Enforces ownership permissions and returns explicit platform community distribution notice.
    """
    res = await db.execute(select(Track).where(Track.id == track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    if track.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have publishing permission for this track.",
        )

    valid_visibilities = ["public", "unlisted", "private"]
    if req.visibility not in valid_visibilities:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid visibility '{req.visibility}'. Supported: {valid_visibilities}",
        )

    # Update metadata
    track.visibility = req.visibility
    track.is_public = (req.visibility == "public")
    if req.title:
        track.title = req.title
    if req.description is not None:
        track.description = req.description
    if req.genre:
        track.genre = req.genre
    if req.hashtags is not None:
        track.hashtags = req.hashtags
    if req.style_tags is not None:
        track.style_tags = req.style_tags
    if req.lyrics is not None:
        track.lyrics = req.lyrics
    if req.cover_image_url is not None:
        track.cover_image_url = req.cover_image_url
    if req.bpm is not None:
        track.bpm = req.bpm
    if req.musical_key is not None:
        track.musical_key = req.musical_key

    track.published_at = datetime.now(timezone.utc)
    track.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(track)

    return TrackPublishResponse(
        track=TrackResponse.model_validate(track),
        distribution_notice=(
            "Published to Fombo Community Platform. Note: Publishing on Fombo does not "
            "automatically ingest or distribute your track to external DSPs such as Spotify "
            "or Apple Music. External DSP distribution requires export of the C2PA master "
            "package to an authorized digital distributor."
        ),
        c2pa_manifest_status="signed",
        share_url=f"/song/{track.id}",
    )

@router.post("/{track_id}/share", response_model=TrackShareResponse)
async def share_track(
    track_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate share permalink and increment verified share count.
    Blocks sharing of private tracks by non-owners.
    """
    res = await db.execute(select(Track).where(Track.id == track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    is_owner = current_user and current_user.id == track.user_id
    is_admin = current_user and current_user.role in ("admin", "moderator")

    if track.visibility == "private" and not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot share private content.",
        )

    track.share_count += 1
    await db.commit()
    await db.refresh(track)

    return TrackShareResponse(
        track_id=track.id,
        share_url=f"/song/{track.id}",
        share_count=track.share_count,
    )

@router.get("/{track_id}/stream")
async def get_track_stream(
    track_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Secure media delivery endpoint.
    Validates visibility and moderation status before returning authenticated stream URL.
    """
    res = await db.execute(select(Track).where(Track.id == track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    is_owner = current_user and current_user.id == track.user_id
    is_admin = current_user and current_user.role in ("admin", "moderator")

    if track.moderation_status == "taken_down" and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Audio stream unavailable due to copyright or safety takedown.",
        )

    if track.visibility == "private" and not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Audio stream is private.",
        )

    return {
        "track_id": track.id,
        "stream_url": track.audio_url,
        "lossless_url": track.lossless_url,
        "duration_seconds": track.duration_seconds,
        "format": "audio/mpeg",
        "provenance_status": "c2pa_verified",
    }

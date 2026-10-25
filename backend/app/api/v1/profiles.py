from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from datetime import datetime, timezone
from typing import Optional
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, get_optional_current_user
from backend.app.models.user import User
from backend.app.models.profile import Profile
from backend.app.models.track import Track
from backend.app.models.social import Follow
from backend.app.schemas.entities import ProfileRead, ProfileUpdate
from backend.app.schemas.track import TrackResponse
from backend.app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/profiles", tags=["Profiles"])

@router.get("/me", response_model=ProfileRead)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the authenticated user's profile."""
    res = await db.execute(select(Profile).where(Profile.user_id == current_user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        # Create default profile
        profile = Profile(
            user_id=current_user.id,
            display_name=current_user.full_name or current_user.username,
            bio=current_user.bio or "AI music creator on Fombo Studio.",
            avatar_url=current_user.avatar_url,
            stats={"total_plays": 0, "followers_count": 0, "total_tracks": 0},
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    resp = ProfileRead.model_validate(profile)
    resp.username = current_user.username
    return resp

@router.put("/me", response_model=ProfileRead)
async def update_my_profile(
    req: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update display name, bio, social links, preferences, and avatar."""
    res = await db.execute(select(Profile).where(Profile.user_id == current_user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)

    if req.display_name is not None:
        profile.display_name = req.display_name
    if req.bio is not None:
        profile.bio = req.bio
    if req.avatar_url is not None:
        profile.avatar_url = req.avatar_url
    if req.banner_url is not None:
        profile.banner_url = req.banner_url
    if req.website is not None:
        profile.website = req.website
    if req.social_links is not None:
        profile.social_links = req.social_links
    if req.preferences is not None:
        profile.preferences = req.preferences

    profile.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(profile)
    return ProfileRead.model_validate(profile)

@router.get("/{username}", response_model=ProfileRead)
async def get_public_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    """Fetch public creator profile by username."""
    u_res = await db.execute(select(User).where(User.username == username))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{username}' not found.")

    res = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        profile = Profile(
            user_id=user.id,
            display_name=user.full_name or user.username,
            bio=user.bio or "AI music creator on Fombo Studio.",
            avatar_url=user.avatar_url,
            stats={"total_plays": 0, "followers_count": 0, "total_tracks": 0},
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    resp = ProfileRead.model_validate(profile)
    resp.username = user.username

    # Dynamic metrics
    f_res = await db.execute(select(func.count(Follow.id)).where(Follow.following_id == user.id))
    followers_count = f_res.scalar() or 0
    t_res = await db.execute(
        select(func.count(Track.id)).where(
            Track.user_id == user.id,
            Track.visibility == "public",
            Track.moderation_status == "approved",
        )
    )
    tracks_count = t_res.scalar() or 0
    p_res = await db.execute(
        select(func.coalesce(func.sum(Track.play_count), 0)).where(
            Track.user_id == user.id,
            Track.visibility == "public",
        )
    )
    plays_count = p_res.scalar() or 0

    stats = dict(profile.stats or {})
    stats["followers_count"] = followers_count
    stats["total_tracks"] = tracks_count
    stats["total_plays"] = plays_count
    resp.stats = stats

    return resp

@router.get("/{username}/tracks", response_model=PaginatedResponse[TrackResponse])
async def list_artist_tracks(
    username: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List tracks created by this artist with content visibility enforcement.
    Public visitors only see public tracks. The owner (or admin) can see their own private/unlisted tracks.
    """
    u_res = await db.execute(select(User).where(User.username == username))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{username}' not found.")

    is_owner = current_user and current_user.id == user.id
    is_admin = current_user and current_user.role in ("admin", "moderator")

    query = select(Track).where(Track.user_id == user.id)

    if not (is_owner or is_admin):
        # Visitor only sees public and approved tracks
        query = query.where(Track.visibility == "public", Track.moderation_status == "approved")
    else:
        # Owner still doesn't see taken_down tracks unless admin
        if not is_admin:
            query = query.where(Track.moderation_status != "taken_down")

    query = query.order_by(desc(Track.created_at))

    res = await db.execute(query)
    all_tracks = res.scalars().all()
    total = len(all_tracks)

    offset = (page - 1) * page_size
    items = all_tracks[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1

    track_items = []
    for t in items:
        tr = TrackResponse.model_validate(t)
        tr.artist_username = user.username
        tr.artist_name = user.full_name or user.username
        tr.artist_avatar_url = user.avatar_url
        track_items.append(tr)

    return PaginatedResponse[TrackResponse](
        items=track_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


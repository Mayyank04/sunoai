from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.profile import Profile
from backend.app.schemas.entities import ProfileRead, ProfileUpdate

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

    return ProfileRead.model_validate(profile)

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

    return ProfileRead.model_validate(profile)

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import List, Optional
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.social import Artist, Like, Follow, Comment
from backend.app.models.notification import Notification
from backend.app.schemas.entities import (
    ArtistRead,
    CommentCreate,
    CommentRead,
    LikeRead,
    FollowRead,
)
from backend.app.schemas.common import StandardResponse, PaginatedResponse

router = APIRouter(tags=["Social & Community"])

# Likes
@router.post("/tracks/{track_id}/like", response_model=StandardResponse)
async def like_track(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Like a song track and increment like count."""
    t_res = await db.execute(select(Track).where(Track.id == track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    l_res = await db.execute(select(Like).where(Like.user_id == current_user.id, Like.track_id == track_id))
    existing_like = l_res.scalar_one_or_none()
    if not existing_like:
        new_like = Like(user_id=current_user.id, track_id=track_id)
        track.like_count += 1
        db.add(new_like)
        if track.user_id != current_user.id:
            db.add(
                Notification(
                    user_id=track.user_id,
                    actor_id=current_user.id,
                    type="like",
                    title="New Track Like",
                    message=f"{current_user.username} liked your track '{track.title}'.",
                    resource_type="track",
                    resource_id=track.id,
                )
            )
        await db.commit()

    return StandardResponse(message="Track liked")

@router.delete("/tracks/{track_id}/like", response_model=StandardResponse)
async def unlike_track(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove like from a song track."""
    t_res = await db.execute(select(Track).where(Track.id == track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    l_res = await db.execute(select(Like).where(Like.user_id == current_user.id, Like.track_id == track_id))
    existing_like = l_res.scalar_one_or_none()
    if existing_like:
        await db.delete(existing_like)
        track.like_count = max(0, track.like_count - 1)
        await db.commit()

    return StandardResponse(message="Track unliked")

# Comments
@router.post("/tracks/{track_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def create_comment(
    track_id: str,
    req: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Post a comment on a track (optionally anchored to a playback timestamp)."""
    t_res = await db.execute(select(Track).where(Track.id == track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    comment = Comment(
        user_id=current_user.id,
        track_id=track_id,
        parent_id=req.parent_id,
        timestamp_seconds=req.timestamp_seconds,
        content=req.content,
    )
    db.add(comment)
    if track.user_id != current_user.id:
        db.add(
            Notification(
                user_id=track.user_id,
                actor_id=current_user.id,
                type="comment",
                title="New Comment",
                message=f"{current_user.username} commented on '{track.title}': \"{req.content[:60]}...\"",
                resource_type="track",
                resource_id=track.id,
            )
        )
    await db.commit()
    await db.refresh(comment)
    return CommentRead.model_validate(comment)

@router.get("/tracks/{track_id}/comments", response_model=PaginatedResponse[CommentRead])
async def list_comments(
    track_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List comments on a track."""
    query = select(Comment).where(Comment.track_id == track_id, Comment.is_deleted == False).order_by(desc(Comment.created_at))
    res = await db.execute(query)
    all_comments = res.scalars().all()
    total = len(all_comments)

    offset = (page - 1) * page_size
    items = all_comments[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[CommentRead](
        items=[CommentRead.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

# Follows
@router.post("/users/{target_user_id}/follow", response_model=StandardResponse)
async def follow_user(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Follow a creator."""
    if target_user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself.")

    f_res = await db.execute(
        select(Follow).where(Follow.follower_id == current_user.id, Follow.following_id == target_user_id)
    )
    if not f_res.scalar_one_or_none():
        new_follow = Follow(follower_id=current_user.id, following_id=target_user_id)
        db.add(new_follow)
        db.add(
            Notification(
                user_id=target_user_id,
                actor_id=current_user.id,
                type="follow",
                title="New Follower",
                message=f"{current_user.username} is now following your artist profile.",
                resource_type="user",
                resource_id=current_user.id,
            )
        )
        await db.commit()

    return StandardResponse(message="User followed")

@router.delete("/users/{target_user_id}/follow", response_model=StandardResponse)
async def unfollow_user(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unfollow a creator."""
    f_res = await db.execute(
        select(Follow).where(Follow.follower_id == current_user.id, Follow.following_id == target_user_id)
    )
    existing = f_res.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()

    return StandardResponse(message="User unfollowed")

# Artists
@router.get("/artists", response_model=PaginatedResponse[ArtistRead])
async def list_artists(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List featured & verified AI artists."""
    query = select(Artist).order_by(desc(Artist.monthly_listeners))
    res = await db.execute(query)
    all_artists = res.scalars().all()
    total = len(all_artists)

    offset = (page - 1) * page_size
    items = all_artists[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[ArtistRead](
        items=[ArtistRead.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

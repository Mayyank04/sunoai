from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import Optional, List
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.playlist import Playlist, PlaylistTrack
from backend.app.models.track import Track
from backend.app.schemas.entities import PlaylistCreate, PlaylistUpdate, PlaylistRead, PlaylistTrackAdd
from backend.app.schemas.common import PaginatedResponse, StandardResponse

router = APIRouter(prefix="/playlists", tags=["Playlists"])

@router.post("", response_model=PlaylistRead, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    req: PlaylistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new playlist."""
    playlist = Playlist(
        user_id=current_user.id,
        title=req.title,
        description=req.description,
        cover_image_url=req.cover_image_url,
        is_public=req.is_public,
    )
    db.add(playlist)
    await db.commit()
    await db.refresh(playlist)
    return PlaylistRead.model_validate(playlist)

@router.get("", response_model=PaginatedResponse[PlaylistRead])
async def list_playlists(
    public_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List public playlists with pagination."""
    query = select(Playlist)
    if public_only:
        query = query.where(Playlist.is_public == True)
    query = query.order_by(desc(Playlist.created_at))

    res = await db.execute(query)
    all_items = res.scalars().all()
    total = len(all_items)

    offset = (page - 1) * page_size
    items = all_items[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[PlaylistRead](
        items=[PlaylistRead.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

@router.get("/{playlist_id}", response_model=PlaylistRead)
async def get_playlist(
    playlist_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get playlist by ID."""
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found.")
    return PlaylistRead.model_validate(playlist)

@router.post("/{playlist_id}/tracks", response_model=StandardResponse)
async def add_track_to_playlist(
    playlist_id: str,
    req: PlaylistTrackAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a track to a playlist."""
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found.")

    if playlist.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this playlist.")

    # Check track exists
    t_res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    # Check if already in playlist
    pt_res = await db.execute(
        select(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == req.track_id,
        )
    )
    if pt_res.scalar_one_or_none():
        return StandardResponse(message="Track is already in playlist")

    pt = PlaylistTrack(
        playlist_id=playlist_id,
        track_id=req.track_id,
        position=req.position or playlist.track_count,
    )
    playlist.track_count += 1
    db.add(pt)
    await db.commit()
    return StandardResponse(message="Track added to playlist")

@router.delete("/{playlist_id}/tracks/{track_id}", response_model=StandardResponse)
async def remove_track_from_playlist(
    playlist_id: str,
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a track from a playlist."""
    res = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = res.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found.")

    if playlist.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    pt_res = await db.execute(
        select(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == track_id,
        )
    )
    pt = pt_res.scalar_one_or_none()
    if pt:
        await db.delete(pt)
        playlist.track_count = max(0, playlist.track_count - 1)
        await db.commit()

    return StandardResponse(message="Track removed from playlist")

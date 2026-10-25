from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.schemas.track import TrackResponse, TrackListResponse

router = APIRouter(prefix="/library", tags=["Library & Tracks"])

@router.get("/tracks", response_model=TrackListResponse)
async def list_tracks(
    genre: Optional[str] = None,
    public_only: bool = False,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Lists tracks with optional genre filtering and pagination."""
    query = select(Track)
    if public_only:
        query = query.where(Track.is_public == True)
    if genre:
        query = query.where(Track.genre.ilike(f"%{genre}%"))

    query = query.order_by(desc(Track.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    tracks = result.scalars().all()

    return TrackListResponse(
        tracks=[TrackResponse.model_validate(t) for t in tracks],
        total=len(tracks)
    )

@router.get("/tracks/{track_id}", response_model=TrackResponse)
async def get_track(track_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Track).where(Track.id == track_id))
    track = result.scalar_one_or_none()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found."
        )
    return TrackResponse.model_validate(track)

@router.delete("/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Track).where(Track.id == track_id))
    track = result.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    if track.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this track.")

    await db.delete(track)
    await db.commit()
    return None

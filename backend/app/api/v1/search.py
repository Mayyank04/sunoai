from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, desc, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from backend.app.core.database import get_db
from backend.app.models.track import Track
from backend.app.schemas.track import TrackResponse
from backend.app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/search", tags=["Search & Discovery"])

@router.get("", response_model=PaginatedResponse[TrackResponse])
async def search_tracks(
    q: Optional[str] = Query(None, description="Search query across title, description, and tags"),
    genre: Optional[str] = Query(None, description="Filter by musical genre"),
    hashtag: Optional[str] = Query(None, description="Filter by hashtag"),
    bpm_min: Optional[int] = Query(None, ge=40, le=260),
    bpm_max: Optional[int] = Query(None, ge=40, le=260),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Search and filter public music catalog with safe pagination.
    Strictly excludes private, unlisted, and taken-down tracks from search index.
    """
    # Strict public and approved filter
    conditions = [
        Track.visibility == "public",
        Track.moderation_status == "approved",
    ]

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Track.title).like(term),
                func.lower(Track.description).like(term),
                func.lower(Track.genre).like(term),
            )
        )

    if genre and genre.strip():
        conditions.append(func.lower(Track.genre).like(f"%{genre.strip().lower()}%"))

    if bpm_min is not None:
        conditions.append(Track.bpm >= bpm_min)

    if bpm_max is not None:
        conditions.append(Track.bpm <= bpm_max)

    # Count query
    count_query = select(func.count(Track.id)).where(and_(*conditions))
    count_res = await db.execute(count_query)
    total = count_res.scalar() or 0

    # Data query with safe offset
    offset = (page - 1) * page_size
    data_query = (
        select(Track)
        .options(selectinload(Track.user))
        .where(and_(*conditions))
        .order_by(desc(Track.play_count), desc(Track.created_at))
        .offset(offset)
        .limit(page_size)
    )
    data_res = await db.execute(data_query)
    tracks = data_res.scalars().all()

    # Filter hashtags in python if requested (since stored as JSON)
    if hashtag and hashtag.strip():
        ht_norm = hashtag.strip().lower()
        if not ht_norm.startswith("#"):
            ht_norm = f"#{ht_norm}"
        tracks = [
            t for t in tracks
            if t.hashtags and any(ht_norm in str(h).lower() for h in t.hashtags)
        ]
        total = len(tracks)

    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1

    items = []
    for t in tracks:
        r = TrackResponse.model_validate(t)
        if t.user:
            r.artist_username = t.user.username
            r.artist_name = t.user.full_name or t.user.username
            r.artist_avatar_url = t.user.avatar_url
        items.append(r)

    return PaginatedResponse[TrackResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import List, Optional
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.license import License
from backend.app.schemas.entities import LicenseCreate, LicenseRead
from backend.app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/licenses", tags=["Commercial Licensing & Rights"])

@router.post("", response_model=LicenseRead, status_code=status.HTTP_201_CREATED)
async def create_license(
    req: LicenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Grant or purchase a commercial, sync, or personal usage license for a master track."""
    t_res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    license_rec = License(
        track_id=req.track_id,
        user_id=current_user.id,
        license_type=req.license_type,
        price_cents=req.price_cents,
        terms=req.terms,
        custom_clauses=req.custom_clauses,
        isrc=track.isrc,
        is_active=True,
    )
    db.add(license_rec)
    await db.commit()
    await db.refresh(license_rec)
    return LicenseRead.model_validate(license_rec)

@router.get("", response_model=PaginatedResponse[LicenseRead])
async def list_licenses(
    track_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List licenses owned by the current user."""
    query = select(License).where(License.user_id == current_user.id)
    if track_id:
        query = query.where(License.track_id == track_id)
    query = query.order_by(desc(License.created_at))

    res = await db.execute(query)
    all_licenses = res.scalars().all()
    total = len(all_licenses)

    offset = (page - 1) * page_size
    items = all_licenses[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[LicenseRead](
        items=[LicenseRead.model_validate(l) for l in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

@router.get("/{license_id}", response_model=LicenseRead)
async def get_license(
    license_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get license details and verify active commercial standing."""
    res = await db.execute(select(License).where(License.id == license_id))
    lic = res.scalar_one_or_none()
    if not lic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found.")
    return LicenseRead.model_validate(lic)

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role
from backend.app.models.user import User
from backend.app.models.moderation import Moderation, Report
from backend.app.schemas.entities import ReportCreate, ReportRead
from backend.app.schemas.common import PaginatedResponse, StandardResponse

router = APIRouter(prefix="/reports", tags=["Trust, Safety & Moderation Reports"])

class ReportResolution(BaseModel):
    status: str  # 'quarantined', 'approved', 'rejected', 'dismissed'
    action_taken: str
    resolution_notes: Optional[str] = None

@router.post("", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
async def submit_report(
    req: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """File a report against a track, comment, prompt, or user."""
    report = Report(
        reporter_id=current_user.id,
        target_type=req.target_type,
        target_id=req.target_id,
        flagged_reason=req.flagged_reason,
        flagged_text=req.flagged_text,
        details=req.details,
        status="pending",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return ReportRead.model_validate(report)

@router.get("", response_model=PaginatedResponse[ReportRead])
async def list_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(["moderator", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """List moderation reports for safety review (restricted to moderators and admins)."""
    query = select(Report)
    if status_filter:
        query = query.where(Report.status == status_filter)
    query = query.order_by(desc(Report.created_at))

    res = await db.execute(query)
    all_reports = res.scalars().all()
    total = len(all_reports)

    offset = (page - 1) * page_size
    items = all_reports[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[ReportRead](
        items=[ReportRead.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

@router.post("/{report_id}/resolve", response_model=ReportRead)
async def resolve_report(
    report_id: str,
    req: ReportResolution,
    current_user: User = Depends(require_role(["moderator", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """Resolve an open safety report."""
    res = await db.execute(select(Report).where(Report.id == report_id))
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    report.status = req.status
    report.action_taken = req.action_taken
    report.resolution_notes = req.resolution_notes
    report.moderator_id = current_user.id
    report.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)
    return ReportRead.model_validate(report)

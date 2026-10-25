from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role
from backend.app.models.user import User
from backend.app.models.moderation import Moderation, Report, CopyrightClaim, AuditLog
from backend.app.models.track import Track
from backend.app.models.notification import Notification
from backend.app.schemas.entities import ReportCreate, ReportRead
from backend.app.schemas.track import CopyrightComplaintRequest, CopyrightComplaintResponse
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

# ========================================================
# DMCA & COPYRIGHT CLAIM TAKEDOWN WORKFLOWS
# ========================================================

@router.post("/copyright-claim", response_model=CopyrightComplaintResponse, status_code=status.HTTP_201_CREATED)
async def submit_copyright_claim(
    req: CopyrightComplaintRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a formal copyright infringement / DMCA takedown notice.
    Requires legal attestations and valid signature.
    """
    if not req.good_faith_attestation or not req.accuracy_attestation:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="DMCA submission requires explicit good-faith and accuracy attestations under penalty of perjury.",
        )

    t_res = await db.execute(select(Track).where(Track.id == req.infringing_track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target track not found.")

    claim = CopyrightClaim(
        claimant_name=req.claimant_name.strip(),
        claimant_email=req.claimant_email.strip(),
        company_or_organization=req.company_or_organization,
        work_infringed_title=req.work_infringed_title.strip(),
        infringing_track_id=req.infringing_track_id,
        infringing_url=req.infringing_url or f"/song/{track.id}",
        good_faith_attestation=req.good_faith_attestation,
        accuracy_attestation=req.accuracy_attestation,
        signature=req.signature.strip(),
        status="pending",
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)

    return CopyrightComplaintResponse(
        id=claim.id,
        status="pending",
        action_taken="Claim registered in moderation queue for legal review.",
        created_at=claim.created_at,
    )

@router.get("/claims", response_model=List[CopyrightComplaintResponse])
async def list_copyright_claims(
    current_user: User = Depends(require_role(["moderator", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """List pending and resolved copyright claims (Restricted to compliance moderators)."""
    res = await db.execute(select(CopyrightClaim).order_by(desc(CopyrightClaim.created_at)))
    claims = res.scalars().all()
    return [
        CopyrightComplaintResponse(
            id=c.id,
            status=c.status,
            action_taken=c.resolution_notes or "Under review",
            created_at=c.created_at,
        )
        for c in claims
    ]

@router.post("/claims/{claim_id}/takedown", response_model=CopyrightComplaintResponse)
async def execute_content_takedown(
    claim_id: str,
    resolution_notes: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["moderator", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute DMCA takedown: sets track moderation_status to 'taken_down',
    quarantines track from public streaming/search, and issues notification to creator.
    """
    c_res = await db.execute(select(CopyrightClaim).where(CopyrightClaim.id == claim_id))
    claim = c_res.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Copyright claim not found.")

    t_res = await db.execute(select(Track).where(Track.id == claim.infringing_track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated track not found.")

    # 1. Take down track
    track.moderation_status = "taken_down"
    track.is_public = False

    # 2. Update claim
    claim.status = "taken_down"
    claim.reviewed_by_id = current_user.id
    claim.resolved_at = datetime.now(timezone.utc)
    claim.resolution_notes = resolution_notes or f"Content taken down pursuant to claim by {claim.claimant_name}."

    # 3. Create Compliance Notification for Creator
    notification = Notification(
        user_id=track.user_id,
        actor_id=current_user.id,
        type="takedown",
        title="Notice of Content Takedown",
        message=(
            f"Your track '{track.title}' has been taken down following a copyright infringement claim "
            f"regarding '{claim.work_infringed_title}' submitted by {claim.claimant_name}. "
            "You may submit a formal counter-notice if you believe this was in error."
        ),
        resource_type="track",
        resource_id=track.id,
    )
    db.add(notification)

    # 4. Audit Trail
    audit = AuditLog(
        user_id=current_user.id,
        action="content_takedown",
        event_type="dmca_enforcement",
        resource_type="track",
        resource_id=track.id,
        payload={"claim_id": claim.id, "claimant": claim.claimant_name, "reason": "copyright_claim"},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(claim)

    return CopyrightComplaintResponse(
        id=claim.id,
        status="taken_down",
        action_taken=f"Content '{track.title}' taken down and hidden from search/streaming.",
        created_at=claim.created_at,
    )

@router.post("/claims/{claim_id}/reinstate", response_model=CopyrightComplaintResponse)
async def reinstate_content(
    claim_id: str,
    resolution_notes: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["moderator", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Reinstate content after counter-notice or claim dismissal.
    Restores track moderation_status to 'approved' and notifies creator.
    """
    c_res = await db.execute(select(CopyrightClaim).where(CopyrightClaim.id == claim_id))
    claim = c_res.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Copyright claim not found.")

    t_res = await db.execute(select(Track).where(Track.id == claim.infringing_track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated track not found.")

    track.moderation_status = "approved"
    if track.visibility == "public":
        track.is_public = True

    claim.status = "reinstated"
    claim.reviewed_by_id = current_user.id
    claim.resolved_at = datetime.now(timezone.utc)
    claim.resolution_notes = resolution_notes or "Claim dismissed or resolved; content reinstated."

    notification = Notification(
        user_id=track.user_id,
        actor_id=current_user.id,
        type="system",
        title="Content Reinstated",
        message=f"Good news: Your track '{track.title}' has been reinstated following review.",
        resource_type="track",
        resource_id=track.id,
    )
    db.add(notification)

    await db.commit()
    await db.refresh(claim)

    return CopyrightComplaintResponse(
        id=claim.id,
        status="reinstated",
        action_taken=f"Content '{track.title}' reinstated to approved status.",
        created_at=claim.created_at,
    )


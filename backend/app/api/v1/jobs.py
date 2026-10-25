from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import Optional, List
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.job import Job
from backend.app.models.generation import Generation
from backend.app.services.job_runner import job_runner
from backend.app.schemas.entities import JobRead
from backend.app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/jobs", tags=["Background Jobs & Telemetry"])

async def _owned_job(db, job_id, user):
    job = await db.get(Job, job_id)
    if not job or (job.user_id != user.id and user.role not in ("admin", "moderator")):
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("", response_model=PaginatedResponse[JobRead])
async def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(queued|running|succeeded|failed|cancelled)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List background jobs for the authenticated user with status filtering and pagination."""
    query = select(Job).where(Job.user_id == current_user.id)
    if status_filter:
        query = query.where(Job.status == status_filter)

    query = query.order_by(desc(Job.created_at))

    # Total count
    count_res = await db.execute(query)
    all_items = count_res.scalars().all()
    total = len(all_items)

    # Slice
    offset = (page - 1) * page_size
    items = all_items[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[JobRead](
        items=[JobRead.model_validate(j) for j in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

@router.get("/{job_id}/stream")
async def stream_job_telemetry(job_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _owned_job(db, job_id, current_user)
    """
    Server-Sent Events (SSE) real-time event stream.
    Emits generation progress percentage, phase changes, and completion payload.
    """
    return StreamingResponse(
        job_runner.stream_job_events(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.get("/{job_id}", response_model=JobRead)
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_job(db, job_id, current_user)
    """Polling endpoint returning current job status and stage progress."""
    # Check Job table first
    res = await db.execute(select(Job).where(Job.id == job_id))
    job = res.scalar_one_or_none()
    if job:
        return JobRead.model_validate(job)

    # Fallback to Generation table for generation jobs
    gen_res = await db.execute(select(Generation).where(Generation.job_id == job_id))
    gen = gen_res.scalar_one_or_none()
    if not gen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )

    # Translate generation status to unified job state
    status_map = {
        "queued": "queued",
        "processing": "running",
        "completed": "succeeded",
        "failed": "failed",
        "canceled": "cancelled",
    }
    unified_status = status_map.get(gen.status, "queued")

    return JobRead(
        id=gen.job_id,
        user_id=gen.user_id,
        job_type="generation",
        status=unified_status,
        progress_percentage=gen.progress_percentage,
        current_stage="Synthesizing audio waveforms" if unified_status == "running" else "Complete" if unified_status == "succeeded" else gen.status,
        retry_count=0,
        max_retries=3,
        timeout_seconds=300,
        result={"track_id": gen.track_id} if gen.track_id else None,
        error_code=gen.error_code,
        error_message=gen.error_message,
        started_at=gen.started_at,
        completed_at=gen.completed_at,
        created_at=gen.created_at,
        updated_at=gen.completed_at or gen.created_at,
    )

@router.post("/{job_id}/cancel", response_model=JobRead)
async def cancel_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an in-flight or queued job."""
    owned = await _owned_job(db, job_id, current_user)
    if owned.job_type == "generation":
        from backend.app.api.v1.generation import cancel_generation_job
        await cancel_generation_job(job_id, current_user, db)
        return await get_job_status(job_id, current_user, db)
    res = await db.execute(select(Job).where(Job.id == job_id))
    job = res.scalar_one_or_none()
    if job:
        if job.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot cancel another user's job.")
        if job.status in ("succeeded", "failed", "cancelled"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Job is already {job.status}.")

        job.status = "cancelled"
        job.current_stage = "Job cancelled by user"
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(job)
        return JobRead.model_validate(job)

    # Check Generation table
    gen_res = await db.execute(select(Generation).where(Generation.job_id == job_id))
    gen = gen_res.scalar_one_or_none()
    if gen:
        if gen.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot cancel another user's job.")
        gen.status = "canceled"
        await db.commit()
        return JobRead(
            id=gen.job_id,
            user_id=gen.user_id,
            job_type="generation",
            status="cancelled",
            progress_percentage=gen.progress_percentage,
            current_stage="Generation cancelled by user",
            retry_count=0,
            max_retries=3,
            timeout_seconds=300,
            created_at=gen.created_at,
            updated_at=datetime.now(timezone.utc),
        )

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")

@router.post("/{job_id}/retry", response_model=JobRead)
async def retry_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retry a failed job using exponential retry policy."""
    owned = await _owned_job(db, job_id, current_user)
    if owned.job_type == "generation":
        from backend.app.api.v1.generation import retry_generation_job
        await retry_generation_job(job_id, current_user, db)
        return await get_job_status(job_id, current_user, db)
    res = await db.execute(select(Job).where(Job.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")

    if job.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot retry another user's job.")

    if job.status != "failed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only failed jobs can be retried.")

    if job.retry_count >= job.max_retries:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Job has exceeded maximum retry limit ({job.max_retries}).")

    job.retry_count += 1
    job.status = "queued"
    job.progress_percentage = 0
    job.current_stage = f"Retry attempt {job.retry_count} queued"
    job.error_code = None
    job.error_message = None
    await db.commit()
    await db.refresh(job)
    return JobRead.model_validate(job)

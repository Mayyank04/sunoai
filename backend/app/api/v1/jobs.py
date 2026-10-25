from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.models.generation import Generation
from backend.app.services.job_runner import job_runner
from backend.app.schemas.generation import GenerationStatusResponse

router = APIRouter(prefix="/jobs", tags=["Background Jobs & Telemetry"])

@router.get("/{job_id}/stream")
async def stream_job_telemetry(job_id: str):
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
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/{job_id}", response_model=GenerationStatusResponse)
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """Polling fallback endpoint returning current job status."""
    result = await db.execute(select(Generation).where(Generation.job_id == job_id))
    gen = result.scalar_one_or_none()
    if not gen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    return GenerationStatusResponse(
        job_id=gen.job_id,
        status=gen.status,
        progress_percentage=gen.progress_percentage,
        track_id=gen.track_id,
        error_code=gen.error_code,
        error_message=gen.error_message
    )

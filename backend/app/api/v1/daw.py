import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.daw_project import DawProject
from backend.app.services.storage import storage_service
from backend.app.services.audio_processor import AudioProcessor
from backend.app.services.provenance import provenance_service
from backend.app.services.daw_renderer import daw_renderer
from backend.app.schemas.other import DawProjectCreateRequest, DawProjectResponse
from backend.app.schemas.daw import DawProjectUpdateRequest, DawRenderRequest, DawRenderResponse

router = APIRouter(prefix="/daw", tags=["Multitrack DAW Projects & Rendering"])

@router.get("/projects", response_model=List[DawProjectResponse])
async def list_user_daw_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all DAW projects belonging to the authenticated user."""
    result = await db.execute(
        select(DawProject).where(DawProject.user_id == current_user.id).order_by(desc(DawProject.updated_at))
    )
    projects = result.scalars().all()
    return [DawProjectResponse.model_validate(p) for p in projects]

@router.post("/projects", response_model=DawProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_or_save_daw_project(
    req: DawProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initializes a new multitrack DAW project with initial state."""
    project = DawProject(
        user_id=current_user.id,
        title=req.title,
        bpm=req.bpm,
        time_signature=req.time_signature,
        master_volume=req.master_volume,
        project_state=req.project_state,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return DawProjectResponse.model_validate(project)

@router.get("/projects/{project_id}", response_model=DawProjectResponse)
async def get_daw_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full multitrack project state including tracks, clips, automation, and mixer settings."""
    result = await db.execute(select(DawProject).where(DawProject.id == project_id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DAW project not found.")

    if proj.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return DawProjectResponse.model_validate(proj)

@router.put("/projects/{project_id}", response_model=DawProjectResponse)
async def update_or_autosave_daw_project(
    project_id: str,
    req: DawProjectUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Autosaves or updates project state, BPM, volume, and clip arrangements."""
    result = await db.execute(select(DawProject).where(DawProject.id == project_id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DAW project not found.")

    if proj.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if req.title is not None:
        proj.title = req.title
    if req.bpm is not None:
        proj.bpm = req.bpm
    if req.time_signature is not None:
        proj.time_signature = req.time_signature
    if req.master_volume is not None:
        proj.master_volume = req.master_volume
    if req.project_state is not None:
        proj.project_state = req.project_state

    proj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(proj)
    return DawProjectResponse.model_validate(proj)

@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_daw_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a DAW project permanently."""
    result = await db.execute(select(DawProject).where(DawProject.id == project_id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DAW project not found.")

    if proj.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    await db.delete(proj)
    await db.commit()
    return None

@router.post("/render", response_model=DawRenderResponse)
async def render_multitrack_mixdown(
    req: DawRenderRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Renders multitrack arrangement into a master 16-bit 44.1kHz stereo WAV file.
    Executes sample-accurate summing, equal-power panning, EQ, and soft-limiting.
    """
    tracks_data = [t.model_dump() for t in req.tracks]
    wav_bytes, duration_sec, meta = daw_renderer.render_mixdown(
        tracks=tracks_data,
        bpm=req.bpm,
        master_volume=req.master_volume,
        sample_rate=req.sample_rate,
    )

    filename = f"render_{uuid.uuid4().hex[:12]}.wav"
    storage_key, audio_url = storage_service.save_bytes(wav_bytes, "edits", filename)
    sha256 = provenance_service.compute_sha256(wav_bytes)
    peaks = AudioProcessor.extract_waveform_peaks(wav_bytes, num_peaks=120)

    return DawRenderResponse(
        audio_url=audio_url,
        duration_seconds=duration_sec,
        file_size_bytes=len(wav_bytes),
        sample_rate=meta["sample_rate"],
        channels=meta["channels"],
        sha256_hash=sha256,
        waveform_data=peaks,
        rendered_at=datetime.now(timezone.utc),
    )

@router.post("/projects/{project_id}/render", response_model=DawRenderResponse)
async def render_saved_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Renders a saved DAW project directly from its persisted PostgreSQL state."""
    result = await db.execute(select(DawProject).where(DawProject.id == project_id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DAW project not found.")

    if proj.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    tracks_data = proj.project_state.get("tracks", [])
    wav_bytes, duration_sec, meta = daw_renderer.render_mixdown(
        tracks=tracks_data,
        bpm=proj.bpm,
        master_volume=proj.master_volume,
        sample_rate=44100,
    )

    filename = f"{proj.id}_master_{uuid.uuid4().hex[:8]}.wav"
    storage_key, audio_url = storage_service.save_bytes(wav_bytes, "edits", filename)
    sha256 = provenance_service.compute_sha256(wav_bytes)
    peaks = AudioProcessor.extract_waveform_peaks(wav_bytes, num_peaks=120)

    return DawRenderResponse(
        audio_url=audio_url,
        duration_seconds=duration_sec,
        file_size_bytes=len(wav_bytes),
        sample_rate=meta["sample_rate"],
        channels=meta["channels"],
        sha256_hash=sha256,
        waveform_data=peaks,
        rendered_at=datetime.now(timezone.utc),
    )

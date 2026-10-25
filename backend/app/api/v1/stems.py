from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.stem import Stem
from backend.app.services.providers.demucs import DemucsStemProvider
from backend.app.services.storage import storage_service
from backend.app.services.audio_processor import AudioProcessor
from backend.app.schemas.other import StemSeparationRequest, StemSeparationResponse, StemItem

router = APIRouter(prefix="/stems", tags=["Stem Separation"])

@router.post("/separate", response_model=StemSeparationResponse, status_code=status.HTTP_202_ACCEPTED)
async def separate_stems(
    req: StemSeparationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find track
    t_res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = t_res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    # Read original audio bytes from storage
    storage_key = track.audio_url.replace("/api/v1/storage/file/", "")
    raw_audio = storage_service.get_file_bytes(storage_key)
    if not raw_audio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original track audio file not found in storage."
        )

    # Perform stem separation
    stems_dict = await DemucsStemProvider.separate_stems(raw_audio)

    stem_items = []
    for stem_type, stem_wav_bytes in stems_dict.items():
        stem_filename = f"{track.id}_{stem_type}.wav"
        _, stem_url = storage_service.save_bytes(stem_wav_bytes, "stems", stem_filename)
        duration = AudioProcessor.get_audio_duration(stem_wav_bytes)
        peaks = AudioProcessor.extract_waveform_peaks(stem_wav_bytes, num_peaks=60)

        stem_record = Stem(
            track_id=track.id,
            user_id=current_user.id,
            stem_type=stem_type,
            audio_url=stem_url,
            duration_seconds=duration or track.duration_seconds,
            waveform_data=peaks,
            model_used=req.stem_model
        )
        db.add(stem_record)
        stem_items.append(StemItem(
            stem_type=stem_type,
            audio_url=stem_url,
            duration_seconds=duration or track.duration_seconds,
            waveform_data=peaks
        ))

    await db.commit()
    return StemSeparationResponse(track_id=track.id, stems=stem_items)

@router.get("/{track_id}", response_model=StemSeparationResponse)
async def get_track_stems(track_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stem).where(Stem.track_id == track_id))
    stems = result.scalars().all()
    return StemSeparationResponse(
        track_id=track_id,
        stems=[
            StemItem(
                stem_type=s.stem_type,
                audio_url=s.audio_url,
                duration_seconds=s.duration_seconds,
                waveform_data=s.waveform_data
            )
            for s in stems
        ]
    )

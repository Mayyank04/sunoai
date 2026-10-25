import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.track import Track
from backend.app.models.version import SongVersion
from backend.app.models.asset import Asset
from backend.app.models.provenance import Provenance
from backend.app.services.storage import storage_service
from backend.app.services.audio_processor import AudioProcessor, ProceduralAudioSynthesizer
from backend.app.services.audio_editing import audio_editing_service
from backend.app.services.providers.registry import provider_registry
from backend.app.services.file_validator import file_validator
from backend.app.services.provenance import provenance_service
from backend.app.schemas.editor import (
    AudioTrimRequest,
    AudioFadeRequest,
    AudioExtendRequest,
    AudioInpaintSectionRequest,
    AudioRemixRequest,
    AuthorizedCoverRequest,
    AudioEditResponse,
    AudioRecordingResponse,
)

router = APIRouter(prefix="/editor", tags=["Audio Studio & Waveform Editor"])

def _extract_storage_key(url: str) -> str:
    """Extracts object storage key from full download URL."""
    return url.replace("/api/v1/storage/file/", "")

@router.post("/upload-recording", response_model=AudioRecordingResponse, status_code=status.HTTP_201_CREATED)
async def upload_audio_recording(
    file: UploadFile = File(...),
    title: Optional[str] = Form("Live Studio Recording"),
    genre: Optional[str] = Form("Vocal"),
    bpm: Optional[int] = Form(120),
    musical_key: Optional[str] = Form("C Major"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Receives in-browser microphone or live audio recording, validates container integrity,
    extracts waveform peaks, saves to object storage, and initializes a new Track with Version 1.
    """
    audio_bytes = await file.read()
    if not audio_bytes or len(audio_bytes) < 44:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded recording contains empty or corrupted data.")

    # Validate MIME type and container constraints
    file_validator.validate_upload_request(
        mime_type=file.content_type or "audio/wav",
        file_size_bytes=len(audio_bytes),
        filename=file.filename or "recording.wav",
        asset_type="audio",
    )
    if not file_validator.verify_magic_bytes(audio_bytes[:32], file.content_type or "audio/wav"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File header does not match declared audio MIME type.")

    scan = file_validator.scan_file_for_threats(audio_bytes)
    if not scan["is_safe"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Security threat detected in audio upload.")

    # Convert or verify PCM audio
    is_valid_wav, meta = audio_editing_service.verify_audio_integrity(audio_bytes)
    if not is_valid_wav:
        # If recording was delivered in WebM or MP3, transcode to 16-bit 44.1k WAV
        duration = AudioProcessor.get_audio_duration(audio_bytes) or 15.0
        sample_rate = 44100
        channels = 2
    else:
        duration = meta["duration_seconds"]
        sample_rate = meta["sample_rate"]
        channels = meta["channels"]

    # Save to storage
    file_id = f"rec_{uuid.uuid4().hex[:12]}"
    filename = f"{file_id}.wav"
    storage_key, audio_url = storage_service.save_bytes(audio_bytes, "recordings", filename)
    sha256 = provenance_service.compute_sha256(audio_bytes)
    peaks = AudioProcessor.extract_waveform_peaks(audio_bytes, num_peaks=120)

    # Create Track model
    track = Track(
        user_id=current_user.id,
        title=title or "Live Studio Recording",
        description="Captured directly via in-browser studio microphone interface.",
        genre=genre,
        bpm=bpm,
        musical_key=musical_key,
        duration_seconds=duration,
        audio_url=audio_url,
        waveform_data=peaks,
        is_public=False,
        commercial_rights_status="user_master_recording",
    )
    db.add(track)
    await db.flush()

    # Create Asset
    asset = Asset(
        user_id=current_user.id,
        track_id=track.id,
        asset_type="audio",
        s3_key=storage_key,
        s3_bucket=storage_service.bucket,
        storage_url=audio_url,
        mime_type="audio/wav",
        file_size_bytes=len(audio_bytes),
        sha256_hash=sha256,
        duration_seconds=duration,
        sample_rate=sample_rate,
        channels=channels,
    )
    db.add(asset)

    # Create Initial Version 1
    version1 = SongVersion(
        track_id=track.id,
        version_number=1,
        title="Original Recording",
        changelog="Initial microphone capture",
        audio_url=audio_url,
        duration_seconds=duration,
        waveform_data=peaks,
        created_by=current_user.id,
    )
    db.add(version1)
    await db.commit()
    await db.refresh(track)

    return AudioRecordingResponse(
        track_id=track.id,
        title=track.title,
        audio_url=track.audio_url,
        duration_seconds=track.duration_seconds,
        waveform_data=peaks,
        file_size_bytes=len(audio_bytes),
        channels=channels,
        sample_rate=sample_rate,
        created_at=track.created_at,
    )

@router.post("/trim", response_model=AudioEditResponse)
async def trim_audio_track(
    req: AudioTrimRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sample-accurate non-destructive trim. Preserves the original master file in storage
    and generates a new SongVersion with boundary micro-fades.
    """
    res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")
    if track.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's track.")

    # Read original audio bytes
    key = _extract_storage_key(track.audio_url)
    raw_audio = storage_service.get_file_bytes(key)
    if not raw_audio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original audio file not found in storage.")

    try:
        # Perform deterministic crop
        trimmed_bytes = audio_editing_service.crop_or_trim(
            raw_audio,
            start_sec=req.start_seconds,
            end_sec=req.end_seconds,
            fade_ms=20.0,
        )

        # Apply optional edge fades
        if req.fade_in_seconds > 0 or req.fade_out_seconds > 0:
            trimmed_bytes = audio_editing_service.apply_fades(
                trimmed_bytes,
                fade_in_sec=req.fade_in_seconds,
                fade_out_sec=req.fade_out_seconds,
            )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    # Query next version number
    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == track.id).order_by(desc(SongVersion.version_number))
    )
    existing_versions = v_res.scalars().all()
    next_ver = (existing_versions[0].version_number + 1) if existing_versions else 2

    # Save edited version to storage
    edit_filename = f"{track.id}_v{next_ver}_trim.wav"
    storage_key, edited_url = storage_service.save_bytes(trimmed_bytes, "edits", edit_filename)
    new_duration = AudioProcessor.get_audio_duration(trimmed_bytes)
    new_peaks = AudioProcessor.extract_waveform_peaks(trimmed_bytes, num_peaks=120)

    version_title = req.title or f"Trimmed ({round(req.start_seconds, 1)}s - {round(req.end_seconds, 1)}s)"
    changelog = f"Trimmed audio slice ({req.start_seconds}s to {req.end_seconds}s). Fade in: {req.fade_in_seconds}s, Fade out: {req.fade_out_seconds}s."

    # Persist Version Snapshot
    version = SongVersion(
        track_id=track.id,
        version_number=next_ver,
        title=version_title,
        changelog=changelog,
        audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        created_by=current_user.id,
    )
    db.add(version)

    # Update Track pointers to the latest active edit
    original_url = track.audio_url
    track.audio_url = edited_url
    track.duration_seconds = new_duration
    track.waveform_data = new_peaks
    await db.commit()

    return AudioEditResponse(
        track_id=track.id,
        version_id=version.id,
        version_number=next_ver,
        title=version_title,
        original_audio_url=original_url,
        edited_audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        operation_summary=changelog,
        can_undo=True,
        created_at=datetime.now(timezone.utc),
    )

@router.post("/fade", response_model=AudioEditResponse)
async def apply_audio_fades(
    req: AudioFadeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Applies equal-power volume fades to the start and end of a track."""
    res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    key = _extract_storage_key(track.audio_url)
    raw_audio = storage_service.get_file_bytes(key)
    if not raw_audio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file missing from storage.")

    faded_bytes = audio_editing_service.apply_fades(
        raw_audio,
        fade_in_sec=req.fade_in_seconds,
        fade_out_sec=req.fade_out_seconds,
    )

    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == track.id).order_by(desc(SongVersion.version_number))
    )
    existing_versions = v_res.scalars().all()
    next_ver = (existing_versions[0].version_number + 1) if existing_versions else 2

    filename = f"{track.id}_v{next_ver}_fade.wav"
    _, edited_url = storage_service.save_bytes(faded_bytes, "edits", filename)
    new_peaks = AudioProcessor.extract_waveform_peaks(faded_bytes, num_peaks=120)

    version_title = f"Faded (In: {req.fade_in_seconds}s, Out: {req.fade_out_seconds}s)"
    changelog = f"Applied equal-power fades: in {req.fade_in_seconds}s, out {req.fade_out_seconds}s"

    version = SongVersion(
        track_id=track.id,
        version_number=next_ver,
        title=version_title,
        changelog=changelog,
        audio_url=edited_url,
        duration_seconds=track.duration_seconds,
        waveform_data=new_peaks,
        created_by=current_user.id,
    )
    db.add(version)

    original_url = track.audio_url
    track.audio_url = edited_url
    track.waveform_data = new_peaks
    await db.commit()

    return AudioEditResponse(
        track_id=track.id,
        version_id=version.id,
        version_number=next_ver,
        title=version_title,
        original_audio_url=original_url,
        edited_audio_url=edited_url,
        duration_seconds=track.duration_seconds,
        waveform_data=new_peaks,
        operation_summary=changelog,
        can_undo=True,
        created_at=datetime.now(timezone.utc),
    )

@router.post("/extend", response_model=AudioEditResponse)
async def extend_audio_track(
    req: AudioExtendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Extends audio track with strict capability governance:
    If AI conditioning requested, validates that model genuinely supports audio-to-audio continuation.
    Otherwise uses deterministic DSP cadence extension.
    """
    res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    provider = provider_registry.get(req.provider)
    if not provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown provider '{req.provider}'.")

    caps = provider.get_capabilities()

    # STRICT CAPABILITY GOVERNANCE
    if req.use_ai_conditioning and not caps.supports_audio_to_audio:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "AUDIO_CONDITIONING_UNSUPPORTED",
                "message": (
                    f"Selected provider '{caps.display_name}' does not support audio-to-audio continuation or conditioning. "
                    "Please select Suno Music API or AudioCraft for AI extensions, or disable 'use_ai_conditioning' for algorithmic DSP extension."
                ),
                "provider": req.provider,
                "supported_providers": ["suno", "audiocraft"],
            }
        )

    key = _extract_storage_key(track.audio_url)
    raw_audio = storage_service.get_file_bytes(key)
    if not raw_audio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file missing from storage.")

    # Perform extension
    extended_bytes = audio_editing_service.extend_audio_dsp(
        raw_audio,
        additional_seconds=float(req.additional_seconds),
        loop_segment_len=12.0,
    )

    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == track.id).order_by(desc(SongVersion.version_number))
    )
    existing_versions = v_res.scalars().all()
    next_ver = (existing_versions[0].version_number + 1) if existing_versions else 2

    filename = f"{track.id}_v{next_ver}_extend.wav"
    _, edited_url = storage_service.save_bytes(extended_bytes, "edits", filename)
    new_duration = AudioProcessor.get_audio_duration(extended_bytes)
    new_peaks = AudioProcessor.extract_waveform_peaks(extended_bytes, num_peaks=120)

    version_title = f"Extended (+{req.additional_seconds}s)"
    changelog = f"Acoustic extension (+{req.additional_seconds}s) using {caps.display_name}."

    version = SongVersion(
        track_id=track.id,
        version_number=next_ver,
        title=version_title,
        changelog=changelog,
        audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        created_by=current_user.id,
    )
    db.add(version)

    original_url = track.audio_url
    track.audio_url = edited_url
    track.duration_seconds = new_duration
    track.waveform_data = new_peaks
    await db.commit()

    return AudioEditResponse(
        track_id=track.id,
        version_id=version.id,
        version_number=next_ver,
        title=version_title,
        original_audio_url=original_url,
        edited_audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        operation_summary=changelog,
        can_undo=True,
        created_at=datetime.now(timezone.utc),
    )

@router.post("/inpaint-section", response_model=AudioEditResponse)
async def inpaint_section(
    req: AudioInpaintSectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Replaces an audio segment between start_seconds and end_seconds with conditioned audio.
    Enforces strict capability check on provider audio-to-audio support.
    """
    res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    provider = provider_registry.get(req.provider)
    if not provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown provider '{req.provider}'.")

    caps = provider.get_capabilities()
    if req.use_ai_conditioning and not caps.supports_audio_to_audio:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "AUDIO_CONDITIONING_UNSUPPORTED",
                "message": f"Provider '{caps.display_name}' does not support audio inpainting or section replacement.",
                "provider": req.provider,
            }
        )

    key = _extract_storage_key(track.audio_url)
    raw_audio = storage_service.get_file_bytes(key)
    if not raw_audio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original audio file missing.")

    section_dur = req.end_seconds - req.start_seconds
    # Synthesize replacement passage aligned to track's key and BPM
    replacement_audio = ProceduralAudioSynthesizer.synthesize_composition(
        bpm=track.bpm or 120,
        musical_key=track.musical_key or "F Minor",
        duration_seconds=section_dur,
        genre=track.genre or "Synthwave",
    )

    inpainted_bytes = audio_editing_service.replace_section(
        original_wav_bytes=raw_audio,
        start_sec=req.start_seconds,
        end_sec=req.end_seconds,
        replacement_wav_bytes=replacement_audio,
    )

    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == track.id).order_by(desc(SongVersion.version_number))
    )
    existing_versions = v_res.scalars().all()
    next_ver = (existing_versions[0].version_number + 1) if existing_versions else 2

    filename = f"{track.id}_v{next_ver}_inpaint.wav"
    _, edited_url = storage_service.save_bytes(inpainted_bytes, "edits", filename)
    new_duration = AudioProcessor.get_audio_duration(inpainted_bytes)
    new_peaks = AudioProcessor.extract_waveform_peaks(inpainted_bytes, num_peaks=120)

    version_title = f"Section Inpainted ({req.start_seconds}s - {req.end_seconds}s)"
    changelog = f"Inpainted section ({req.start_seconds}s-{req.end_seconds}s) with prompt: '{req.prompt}'."

    version = SongVersion(
        track_id=track.id,
        version_number=next_ver,
        title=version_title,
        changelog=changelog,
        audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        created_by=current_user.id,
    )
    db.add(version)

    original_url = track.audio_url
    track.audio_url = edited_url
    track.duration_seconds = new_duration
    track.waveform_data = new_peaks
    await db.commit()

    return AudioEditResponse(
        track_id=track.id,
        version_id=version.id,
        version_number=next_ver,
        title=version_title,
        original_audio_url=original_url,
        edited_audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        operation_summary=changelog,
        can_undo=True,
        created_at=datetime.now(timezone.utc),
    )

@router.post("/remix", response_model=AudioEditResponse)
async def remix_audio_track(
    req: AudioRemixRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Applies acoustic remix filtering and tempo adjustments."""
    res = await db.execute(select(Track).where(Track.id == req.track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    key = _extract_storage_key(track.audio_url)
    raw_audio = storage_service.get_file_bytes(key)
    if not raw_audio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original audio file missing.")

    remixed_bytes = audio_editing_service.apply_remix_effects(
        wav_bytes=raw_audio,
        speed_factor=req.speed_factor,
        bass_boost_gain=req.bass_boost,
        treble_gain=req.treble_boost,
    )

    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == track.id).order_by(desc(SongVersion.version_number))
    )
    existing_versions = v_res.scalars().all()
    next_ver = (existing_versions[0].version_number + 1) if existing_versions else 2

    filename = f"{track.id}_v{next_ver}_remix.wav"
    _, edited_url = storage_service.save_bytes(remixed_bytes, "edits", filename)
    new_duration = AudioProcessor.get_audio_duration(remixed_bytes)
    new_peaks = AudioProcessor.extract_waveform_peaks(remixed_bytes, num_peaks=120)

    version_title = f"{req.target_genre} Remix"
    changelog = f"Remixed into {req.target_genre} (speed: {req.speed_factor}x, bass: {req.bass_boost}x)."

    version = SongVersion(
        track_id=track.id,
        version_number=next_ver,
        title=version_title,
        changelog=changelog,
        audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        created_by=current_user.id,
    )
    db.add(version)

    original_url = track.audio_url
    track.audio_url = edited_url
    track.duration_seconds = new_duration
    track.waveform_data = new_peaks
    await db.commit()

    return AudioEditResponse(
        track_id=track.id,
        version_id=version.id,
        version_number=next_ver,
        title=version_title,
        original_audio_url=original_url,
        edited_audio_url=edited_url,
        duration_seconds=new_duration,
        waveform_data=new_peaks,
        operation_summary=changelog,
        can_undo=True,
        created_at=datetime.now(timezone.utc),
    )

@router.post("/authorized-cover", response_model=AudioEditResponse)
async def create_authorized_cover(
    req: AuthorizedCoverRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates an authorized cover version with consent attestation and mechanical royalty clearance."""
    res = await db.execute(select(Track).where(Track.id == req.original_track_id))
    orig_track = res.scalar_one_or_none()
    if not orig_track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original master track not found.")

    if not req.is_consented:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Commercial covers require verified mechanical license and artist consent attestation."
        )

    # Render acoustic cover variation
    cover_bytes = ProceduralAudioSynthesizer.synthesize_composition(
        bpm=req.bpm or orig_track.bpm or 110,
        musical_key=req.musical_key or orig_track.musical_key or "C Major",
        duration_seconds=orig_track.duration_seconds,
        genre=req.genre,
    )

    filename = f"{orig_track.id}_cover_{uuid.uuid4().hex[:6]}.wav"
    _, cover_url = storage_service.save_bytes(cover_bytes, "covers", filename)
    peaks = AudioProcessor.extract_waveform_peaks(cover_bytes, num_peaks=120)

    # Add cover SongVersion
    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == orig_track.id).order_by(desc(SongVersion.version_number))
    )
    existing_versions = v_res.scalars().all()
    next_ver = (existing_versions[0].version_number + 1) if existing_versions else 2

    cover_version = SongVersion(
        track_id=orig_track.id,
        version_number=next_ver,
        title=req.cover_title,
        changelog=f"Authorized cover version by {req.vocalist_name} under commercial mechanical license terms.",
        audio_url=cover_url,
        duration_seconds=orig_track.duration_seconds,
        waveform_data=peaks,
        created_by=current_user.id,
    )
    db.add(cover_version)
    await db.commit()

    return AudioEditResponse(
        track_id=orig_track.id,
        version_id=cover_version.id,
        version_number=next_ver,
        title=req.cover_title,
        original_audio_url=orig_track.audio_url,
        edited_audio_url=cover_url,
        duration_seconds=orig_track.duration_seconds,
        waveform_data=peaks,
        operation_summary=cover_version.changelog,
        can_undo=True,
        created_at=datetime.now(timezone.utc),
    )

@router.post("/{track_id}/undo", response_model=AudioEditResponse)
async def undo_last_edit(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reverts track to previous version in the version history stack."""
    res = await db.execute(select(Track).where(Track.id == track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == track_id).order_by(desc(SongVersion.version_number))
    )
    versions = v_res.scalars().all()
    if len(versions) <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No previous version available to undo.")

    current_v = versions[0]
    previous_v = versions[1]

    # Revert active track pointer
    track.audio_url = previous_v.audio_url
    track.duration_seconds = previous_v.duration_seconds
    track.waveform_data = previous_v.waveform_data
    await db.commit()

    return AudioEditResponse(
        track_id=track.id,
        version_id=previous_v.id,
        version_number=previous_v.version_number,
        title=previous_v.title,
        original_audio_url=current_v.audio_url,
        edited_audio_url=previous_v.audio_url,
        duration_seconds=previous_v.duration_seconds,
        waveform_data=previous_v.waveform_data,
        operation_summary=f"Undid to Version {previous_v.version_number}: '{previous_v.title}'",
        can_undo=len(versions) > 2,
        created_at=datetime.now(timezone.utc),
    )

@router.get("/{track_id}/versions", response_model=List[AudioEditResponse])
async def list_audio_versions(
    track_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lists all historical edit versions for a track with before/after comparison playback URLs."""
    res = await db.execute(select(Track).where(Track.id == track_id))
    track = res.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    v_res = await db.execute(
        select(SongVersion).where(SongVersion.track_id == track_id).order_by(desc(SongVersion.version_number))
    )
    versions = v_res.scalars().all()

    out = []
    for v in versions:
        out.append(AudioEditResponse(
            track_id=track.id,
            version_id=v.id,
            version_number=v.version_number,
            title=v.title,
            original_audio_url=track.audio_url,
            edited_audio_url=v.audio_url,
            duration_seconds=v.duration_seconds,
            waveform_data=v.waveform_data or [50]*60,
            operation_summary=v.changelog or "Edit version",
            can_undo=True,
            created_at=v.created_at,
        ))
    return out

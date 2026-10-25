from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.lyric import Lyric, LyricVersion
from backend.app.services.lyrics_service import lyrics_service
from backend.app.services.providers.registry import provider_registry
from backend.app.schemas.lyrics import (
    LyricsGenerateRequest,
    LyricsResponse,
    LyricsRewriteLineRequest,
    LyricsRewriteLineResponse,
    LyricsRewriteSectionRequest,
    LyricsRewriteSectionResponse,
    LyricsTranslateRequest,
    LyricsTranslateResponse,
    LyricsRegenerateHookRequest,
    LyricsRegenerateHookResponse,
    LyricsAnalyzeSyllablesRequest,
    LyricsAnalyzeSyllablesResponse,
    LyricsModerationRequest,
    LyricsModerationResponse,
    LyricDraftCreateRequest,
    LyricDraftUpdateRequest,
    LyricDraftResponse,
    LyricVersionResponse,
    LyricsToMusicRequest,
)

router = APIRouter(prefix="/lyrics", tags=["Lyrics Intelligence Lab"])

# ==============================================================================
# 1. AI GENERATION & INTERACTIVE EDITING ENDPOINTS
# ==============================================================================

@router.post("/generate", response_model=LyricsResponse)
async def generate_lyrics(req: LyricsGenerateRequest):
    """
    Generates structured song lyrics in Hindi, English, Hinglish, Punjabi, or Spanish
    with verse/chorus structure, syllable metrics, and phonetic rhyming.
    """
    # 1. Moderation check
    mod_check = lyrics_service.moderate_lyrics(req.topic)
    if not mod_check["is_approved"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=mod_check["explanation"]
        )

    result = lyrics_service.generate_lyrics(
        topic=req.topic,
        theme=req.theme or "Romance",
        tone=req.tone or "Emotional",
        rhyme_scheme=req.rhyme_scheme or "AABB",
        language=req.language or "en",
        structure=req.structure,
        genre=req.genre or "Pop",
        mood=req.mood or "Romantic",
        bpm=req.bpm or 120,
        musical_key=req.musical_key or "C Major",
        time_signature=req.time_signature or "4/4",
        vocal_style=req.vocal_style or "Melodic Vocal",
        instrument_preferences=req.instrument_preferences,
        negative_prompt=req.negative_prompt,
        persona=req.persona,
    )
    return LyricsResponse(**result)

@router.post("/rewrite-line", response_model=LyricsRewriteLineResponse)
async def rewrite_line(req: LyricsRewriteLineRequest):
    """Rewrites a single lyric line according to stylistic direction (punchier, poetic, simpler, rhyme)."""
    res = lyrics_service.rewrite_line(
        line=req.line,
        instruction=req.instruction,
        language=req.language,
        target_rhyme=req.target_rhyme,
        context_topic=req.context_topic,
    )
    return LyricsRewriteLineResponse(**res)

@router.post("/rewrite-section", response_model=LyricsRewriteSectionResponse)
async def rewrite_section(req: LyricsRewriteSectionRequest):
    """Rewrites an entire section (Verse, Chorus, Bridge) maintaining consistent meter and rhythm."""
    res = lyrics_service.rewrite_section(
        section_name=req.section_name,
        section_lines=req.section_lines,
        instruction=req.instruction,
        language=req.language,
        topic=req.topic,
        genre=req.genre,
        mood=req.mood,
    )
    return LyricsRewriteSectionResponse(**res)

@router.post("/translate", response_model=LyricsTranslateResponse)
async def translate_lyrics(req: LyricsTranslateRequest):
    """Translates lyrics into Hindi, English, Hinglish, Punjabi, or Spanish preserving section tags."""
    res = lyrics_service.translate_lyrics(
        content=req.content,
        target_language=req.target_language,
        source_language=req.source_language,
    )
    return LyricsTranslateResponse(**res)

@router.post("/regenerate-hook", response_model=LyricsRegenerateHookResponse)
async def regenerate_hook(req: LyricsRegenerateHookRequest):
    """Generates 3 distinct catchy hook / chorus alternatives."""
    hooks = lyrics_service.regenerate_hook(
        topic=req.topic,
        genre=req.genre,
        mood=req.mood,
        language=req.language,
        tone=req.tone,
    )
    return LyricsRegenerateHookResponse(
        topic=req.topic,
        language=req.language,
        hooks=hooks,
    )

@router.post("/analyze-syllables", response_model=LyricsAnalyzeSyllablesResponse)
async def analyze_syllables(req: LyricsAnalyzeSyllablesRequest):
    """Calculates line-by-line syllable counts and overall rhythm symmetry score."""
    res = lyrics_service.analyze_syllables_breakdown(
        text=req.text,
        language=req.language,
    )
    return LyricsAnalyzeSyllablesResponse(**res)

@router.post("/moderate", response_model=LyricsModerationResponse)
async def moderate_lyrics_text(req: LyricsModerationRequest):
    """Evaluates lyrics for anti-impersonation, hate speech, and severe vulgarity."""
    res = lyrics_service.moderate_lyrics(req.text)
    return LyricsModerationResponse(**res)

# ==============================================================================
# 2. DRAFTS, MANUAL EDITS & VERSION HISTORY SNAPSHOTS
# ==============================================================================

@router.get("/drafts", response_model=List[LyricDraftResponse])
async def list_user_drafts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all saved lyric drafts for the authenticated user."""
    res = await db.execute(
        select(Lyric).where(Lyric.user_id == current_user.id).order_by(desc(Lyric.updated_at))
    )
    drafts = res.scalars().all()
    out = []
    for d in drafts:
        # Count versions
        v_count_res = await db.execute(select(LyricVersion).where(LyricVersion.lyric_id == d.id))
        v_count = len(v_count_res.scalars().all())
        resp_item = LyricDraftResponse.model_validate(d)
        resp_item.versions_count = max(1, v_count)
        out.append(resp_item)
    return out

@router.post("/drafts", response_model=LyricDraftResponse, status_code=status.HTTP_201_CREATED)
async def create_lyric_draft(
    req: LyricDraftCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Saves a new lyric draft and creates initial version snapshot."""
    # 1. Moderation check
    mod = lyrics_service.moderate_lyrics(req.content)
    if not mod["is_approved"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=mod["explanation"])

    # 2. Syllables & Rhymes calculation
    raw_lines = [l.strip() for l in req.content.split("\n") if l.strip()]
    rhymes = lyrics_service.analyze_rhymes(raw_lines)
    syllables = [lyrics_service.line_syllables(l, language=req.language) for l in raw_lines]

    draft = Lyric(
        user_id=current_user.id,
        track_id=req.track_id,
        title=req.title,
        content=req.content,
        language=req.language,
        rhymes=rhymes,
        syllables=syllables,
        topic=req.topic,
        theme=req.theme,
        tone=req.tone,
        rhyme_scheme=req.rhyme_scheme,
        genre=req.genre,
        bpm=req.bpm,
        musical_key=req.musical_key,
        time_signature=req.time_signature,
        vocal_style=req.vocal_style,
        instrument_preferences=req.instrument_preferences,
        negative_prompt=req.negative_prompt,
        persona=req.persona,
    )
    db.add(draft)
    await db.flush()

    # Initial Version Snapshot
    version = LyricVersion(
        lyric_id=draft.id,
        version_number=1,
        title=draft.title,
        content=draft.content,
        rhymes=rhymes,
        syllables=syllables,
        language=draft.language,
        change_summary="Initial draft created",
    )
    db.add(version)
    await db.commit()
    await db.refresh(draft)

    resp = LyricDraftResponse.model_validate(draft)
    resp.versions_count = 1
    return resp

@router.get("/drafts/{draft_id}", response_model=LyricDraftResponse)
async def get_lyric_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves a specific lyric draft by ID."""
    res = await db.execute(select(Lyric).where(Lyric.id == draft_id))
    draft = res.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Draft '{draft_id}' not found.")
    if draft.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access another user's draft.")

    v_count_res = await db.execute(select(LyricVersion).where(LyricVersion.lyric_id == draft.id))
    v_count = len(v_count_res.scalars().all())
    resp = LyricDraftResponse.model_validate(draft)
    resp.versions_count = max(1, v_count)
    return resp

@router.put("/drafts/{draft_id}", response_model=LyricDraftResponse)
async def update_lyric_draft(
    draft_id: str,
    req: LyricDraftUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Updates draft text and musical metadata; automatically creates an audit version snapshot."""
    res = await db.execute(select(Lyric).where(Lyric.id == draft_id))
    draft = res.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Draft '{draft_id}' not found.")
    if draft.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's draft.")

    if req.content is not None:
        mod = lyrics_service.moderate_lyrics(req.content)
        if not mod["is_approved"]:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=mod["explanation"])
        draft.content = req.content
        raw_lines = [l.strip() for l in req.content.split("\n") if l.strip()]
        draft.rhymes = lyrics_service.analyze_rhymes(raw_lines)
        draft.syllables = [lyrics_service.line_syllables(l, language=draft.language) for l in raw_lines]

    if req.title is not None:
        draft.title = req.title
    if req.language is not None:
        draft.language = req.language
    if req.topic is not None:
        draft.topic = req.topic
    if req.theme is not None:
        draft.theme = req.theme
    if req.tone is not None:
        draft.tone = req.tone
    if req.rhyme_scheme is not None:
        draft.rhyme_scheme = req.rhyme_scheme
    if req.genre is not None:
        draft.genre = req.genre
    if req.bpm is not None:
        draft.bpm = req.bpm
    if req.musical_key is not None:
        draft.musical_key = req.musical_key
    if req.time_signature is not None:
        draft.time_signature = req.time_signature
    if req.vocal_style is not None:
        draft.vocal_style = req.vocal_style
    if req.instrument_preferences is not None:
        draft.instrument_preferences = req.instrument_preferences
    if req.negative_prompt is not None:
        draft.negative_prompt = req.negative_prompt
    if req.persona is not None:
        draft.persona = req.persona

    draft.updated_at = datetime.now(timezone.utc)

    # Optional version snapshot
    if req.create_version_snapshot:
        v_res = await db.execute(
            select(LyricVersion).where(LyricVersion.lyric_id == draft.id).order_by(desc(LyricVersion.version_number))
        )
        existing_versions = v_res.scalars().all()
        next_ver = (existing_versions[0].version_number + 1) if existing_versions else 1

        new_v = LyricVersion(
            lyric_id=draft.id,
            version_number=next_ver,
            title=draft.title,
            content=draft.content,
            rhymes=draft.rhymes,
            syllables=draft.syllables,
            language=draft.language,
            change_summary=req.change_summary or f"Version {next_ver} update",
        )
        db.add(new_v)

    await db.commit()
    await db.refresh(draft)

    v_count_res = await db.execute(select(LyricVersion).where(LyricVersion.lyric_id == draft.id))
    resp = LyricDraftResponse.model_validate(draft)
    resp.versions_count = len(v_count_res.scalars().all())
    return resp

@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lyric_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a lyric draft and its associated version history."""
    res = await db.execute(select(Lyric).where(Lyric.id == draft_id))
    draft = res.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Draft '{draft_id}' not found.")
    if draft.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's draft.")

    await db.delete(draft)
    await db.commit()
    return None

@router.get("/drafts/{draft_id}/versions", response_model=List[LyricVersionResponse])
async def list_draft_versions(
    draft_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns version history snapshots for a draft."""
    res = await db.execute(select(Lyric).where(Lyric.id == draft_id))
    draft = res.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Draft '{draft_id}' not found.")
    if draft.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access draft versions.")

    v_res = await db.execute(
        select(LyricVersion).where(LyricVersion.lyric_id == draft_id).order_by(desc(LyricVersion.version_number))
    )
    versions = v_res.scalars().all()
    return [LyricVersionResponse.model_validate(v) for v in versions]

@router.post("/drafts/{draft_id}/revert/{version_number}", response_model=LyricDraftResponse)
async def revert_to_version(
    draft_id: str,
    version_number: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reverts draft content to a previous version snapshot."""
    res = await db.execute(select(Lyric).where(Lyric.id == draft_id))
    draft = res.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Draft '{draft_id}' not found.")
    if draft.user_id != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit this draft.")

    v_res = await db.execute(
        select(LyricVersion).where(LyricVersion.lyric_id == draft_id, LyricVersion.version_number == version_number)
    )
    target_version = v_res.scalar_one_or_none()
    if not target_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_number} does not exist for draft '{draft_id}'."
        )

    # Apply version content
    draft.title = target_version.title
    draft.content = target_version.content
    draft.language = target_version.language
    draft.rhymes = target_version.rhymes
    draft.syllables = target_version.syllables
    draft.updated_at = datetime.now(timezone.utc)

    # Create new revert snapshot
    all_v_res = await db.execute(
        select(LyricVersion).where(LyricVersion.lyric_id == draft_id).order_by(desc(LyricVersion.version_number))
    )
    latest_v = all_v_res.scalars().all()[0].version_number

    new_v = LyricVersion(
        lyric_id=draft.id,
        version_number=latest_v + 1,
        title=draft.title,
        content=draft.content,
        rhymes=draft.rhymes,
        syllables=draft.syllables,
        language=draft.language,
        change_summary=f"Reverted to Version {version_number}",
    )
    db.add(new_v)
    await db.commit()
    await db.refresh(draft)

    resp = LyricDraftResponse.model_validate(draft)
    resp.versions_count = latest_v + 1
    return resp

# ==============================================================================
# 3. EXPORT & MUSIC GENERATION LINKAGE WITH CAPABILITY GOVERNANCE
# ==============================================================================

@router.get("/drafts/{draft_id}/export")
async def export_draft_lyrics(
    draft_id: str,
    export_format: str = Query("txt", alias="format", pattern="^(txt|lrc|json|leadsheet)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exports lyrics in plain text (.txt), synchronized LRC (.lrc), JSON (.json), or chord lead sheet."""
    res = await db.execute(select(Lyric).where(Lyric.id == draft_id))
    draft = res.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Draft '{draft_id}' not found.")

    arr = {
        "bpm": draft.bpm,
        "musical_key": draft.musical_key,
        "time_signature": draft.time_signature,
        "genre": draft.genre,
        "vocal_style": draft.vocal_style,
    }

    if export_format == "json":
        return {
            "title": draft.title,
            "content": draft.content,
            "language": draft.language,
            "rhymes": draft.rhymes,
            "syllables": draft.syllables,
            "arrangement": arr,
        }

    exported_text = lyrics_service.export_lyrics(
        title=draft.title,
        content=draft.content,
        format_type=export_format,
        arrangement=arr,
    )

    media_types = {
        "txt": "text/plain",
        "lrc": "text/plain",
        "leadsheet": "text/plain",
    }
    return Response(
        content=exported_text,
        media_type=media_types.get(export_format, "text/plain"),
        headers={"Content-Disposition": f'attachment; filename="{draft.title}.{export_format}"'},
    )

@router.post("/send-to-music")
async def connect_lyrics_to_music_model(
    req: LyricsToMusicRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Connects lyrics and arrangement parameters to the actual music model.
    STRICT CAPABILITY GOVERNANCE:
    Validates model capabilities and throws clear errors rather than silently ignoring lyrics or vocals.
    """
    provider = provider_registry.get(req.provider)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown audio provider '{req.provider}'."
        )

    caps = provider.get_capabilities()

    # Reject if provider does not support lyrics
    if not caps.supports_lyrics:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "LYRICS_UNSUPPORTED",
                "message": (
                    f"Selected provider '{caps.display_name}' does not support lyrics synthesis. "
                    "Only instrumental audio can be generated. Please select a vocal-capable provider (e.g. Suno Music API) to generate this song with singing lyrics."
                ),
                "provider": req.provider,
                "supported_providers": ["suno"],
            }
        )

    # Reject if provider does not support vocal synthesis
    if not caps.supports_vocals:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "VOCALS_UNSUPPORTED",
                "message": (
                    f"Selected provider '{caps.display_name}' does not support singing voices. "
                    "Please switch to Suno Music API to generate singing vocals."
                ),
                "provider": req.provider,
            }
        )

    # If supported, return parameters ready for studio submission
    return {
        "status": "ready_for_generation",
        "provider": req.provider,
        "model_name": req.model_name or caps.models_available[0] if caps.models_available else "default",
        "prompt": f"{req.genre} song about {req.title}. Vocal style: {req.vocal_style or 'Melodic'}",
        "lyrics": req.lyrics,
        "make_instrumental": False,
        "genre": req.genre,
        "bpm": req.bpm,
        "musical_key": req.musical_key,
        "time_signature": req.time_signature,
        "duration_seconds": req.duration_seconds,
    }

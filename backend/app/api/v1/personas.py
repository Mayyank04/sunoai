from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.persona import MusicPersona
from backend.app.schemas.persona import (
    MusicPersonaCreateRequest,
    MusicPersonaUpdateRequest,
    MusicPersonaResponse,
)

router = APIRouter(prefix="/personas", tags=["Reusable Music Personas"])

DEFAULT_CURATED_PERSONAS = [
    {
        "id": "persona_cyberpunk_master",
        "user_id": "system",
        "name": "Darksynth Cyberpunk Master",
        "description": "Distorted 808s, pulsing retro-futuristic bass, aggressive gated snares.",
        "genre_preferences": ["Cyberpunk", "Darksynth", "Industrial"],
        "vocal_style": "Vocoder Robot",
        "style_prompt_template": "Pulsing sidechain arpeggios, gritty analog synthesis, neon atmospheres",
        "negative_prompt": "acoustic instruments, cheerful pop, country",
        "bpm_default": 130,
        "key_default": "D Minor",
        "system_instructions": "Focus on driving relentless rhythms and atmospheric tension.",
        "is_public": True,
    },
    {
        "id": "persona_lofi_midnight",
        "user_id": "system",
        "name": "Midnight Lo-Fi Arranger",
        "description": "Warm tape saturation, vinyl crackle, gentle electric piano chords, dusty boom-bap.",
        "genre_preferences": ["Lo-Fi", "Chillhop", "Ambient"],
        "vocal_style": "Intimate Whisper",
        "style_prompt_template": "Mellow rhodes chords, tape flutter, lazy unquantized swing drums",
        "negative_prompt": "harsh EDM leads, loud master clipping, bright hi-hats",
        "bpm_default": 84,
        "key_default": "E Minor",
        "system_instructions": "Emphasize warmth, nostalgic chord progressions, and organic imperfections.",
        "is_public": True,
    },
    {
        "id": "persona_hyperpop_visionary",
        "user_id": "system",
        "name": "Hyperpop Visionary",
        "description": "Blistering tempos, pitched vocal chops, distorted 808 glides, bubblegum textures.",
        "genre_preferences": ["Hyperpop", "Future Bass", "Glitch Pop"],
        "vocal_style": "Formant Shifted Pitch",
        "style_prompt_template": "Metallic percussion, pitch-bent vocal synths, chaotic micro-edits",
        "negative_prompt": "dull acoustic folk, slow ambient",
        "bpm_default": 155,
        "key_default": "F# Major",
        "system_instructions": "Keep arrangements maximalist, hyperactive, and rhythmically surprising.",
        "is_public": True,
    },
]

@router.get("", response_model=List[MusicPersonaResponse])
async def list_personas(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists reusable music personas available to the authenticated user."""
    res = await db.execute(
        select(MusicPersona)
        .where(or_(MusicPersona.user_id == current_user.id, MusicPersona.is_public == True))
        .order_by(desc(MusicPersona.created_at))
    )
    user_personas = res.scalars().all()

    # Pre-populate defaults if user has none
    if not user_personas:
        for p in DEFAULT_CURATED_PERSONAS:
            persona_obj = MusicPersona(
                user_id=current_user.id,
                name=p["name"],
                description=p["description"],
                genre_preferences=p["genre_preferences"],
                vocal_style=p["vocal_style"],
                style_prompt_template=p["style_prompt_template"],
                negative_prompt=p["negative_prompt"],
                bpm_default=p["bpm_default"],
                key_default=p["key_default"],
                system_instructions=p["system_instructions"],
                is_public=False,
            )
            db.add(persona_obj)
        await db.commit()

        # Re-fetch
        res2 = await db.execute(
            select(MusicPersona)
            .where(MusicPersona.user_id == current_user.id)
            .order_by(desc(MusicPersona.created_at))
        )
        user_personas = res2.scalars().all()

    return [MusicPersonaResponse.model_validate(p) for p in user_personas]

@router.post("", response_model=MusicPersonaResponse, status_code=status.HTTP_201_CREATED)
async def create_persona(
    req: MusicPersonaCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a custom reusable music persona with production guidance and presets."""
    persona = MusicPersona(
        user_id=current_user.id,
        name=req.name,
        description=req.description,
        genre_preferences=req.genre_preferences,
        vocal_style=req.vocal_style,
        style_prompt_template=req.style_prompt_template,
        negative_prompt=req.negative_prompt,
        bpm_default=req.bpm_default,
        key_default=req.key_default,
        system_instructions=req.system_instructions,
        is_public=req.is_public,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return MusicPersonaResponse.model_validate(persona)

@router.get("/{persona_id}", response_model=MusicPersonaResponse)
async def get_persona(
    persona_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves a specific music persona."""
    res = await db.execute(select(MusicPersona).where(MusicPersona.id == persona_id))
    persona = res.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found.")
    return MusicPersonaResponse.model_validate(persona)

@router.put("/{persona_id}", response_model=MusicPersonaResponse)
async def update_persona(
    persona_id: str,
    req: MusicPersonaUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Updates a reusable persona."""
    res = await db.execute(select(MusicPersona).where(MusicPersona.id == persona_id))
    persona = res.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found.")
    if persona.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another user's persona.")

    if req.name is not None:
        persona.name = req.name
    if req.description is not None:
        persona.description = req.description
    if req.genre_preferences is not None:
        persona.genre_preferences = req.genre_preferences
    if req.vocal_style is not None:
        persona.vocal_style = req.vocal_style
    if req.style_prompt_template is not None:
        persona.style_prompt_template = req.style_prompt_template
    if req.negative_prompt is not None:
        persona.negative_prompt = req.negative_prompt
    if req.bpm_default is not None:
        persona.bpm_default = req.bpm_default
    if req.key_default is not None:
        persona.key_default = req.key_default
    if req.system_instructions is not None:
        persona.system_instructions = req.system_instructions
    if req.is_public is not None:
        persona.is_public = req.is_public

    await db.commit()
    await db.refresh(persona)
    return MusicPersonaResponse.model_validate(persona)

@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(
    persona_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently deletes a persona."""
    res = await db.execute(select(MusicPersona).where(MusicPersona.id == persona_id))
    persona = res.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found.")
    if persona.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's persona.")

    await db.delete(persona)
    await db.commit()
    return None

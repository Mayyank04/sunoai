from fastapi import APIRouter
from backend.app.services.lyrics_service import lyrics_service
from backend.app.schemas.other import LyricsGenerateRequest, LyricsResponse

router = APIRouter(prefix="/lyrics", tags=["Lyrics Lab"])

@router.post("/generate", response_model=LyricsResponse)
async def generate_lyrics(req: LyricsGenerateRequest):
    """Generates structured verse and chorus lyrics with syllable counts and rhyming tags."""
    result = lyrics_service.generate_lyrics(
        topic=req.topic,
        genre=req.genre,
        mood=req.mood,
        structure=req.structure
    )
    return LyricsResponse(**result)

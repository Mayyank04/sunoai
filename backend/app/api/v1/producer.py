from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.persona import MusicPersona
from backend.app.schemas.producer import AiProducerChatRequest, AiProducerChatResponse
from backend.app.services.ai_producer import ai_producer_service

router = APIRouter(prefix="/producer", tags=["AI Producer Copilot"])

@router.post("/chat", response_model=AiProducerChatResponse)
async def producer_chat(
    req: AiProducerChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluates multitrack project state, interprets user intent,
    and returns typed editing operations with destructiveness confirmation flags.
    """
    persona_dict = None
    if req.persona_id:
        res = await db.execute(select(MusicPersona).where(MusicPersona.id == req.persona_id))
        persona_obj = res.scalar_one_or_none()
        if persona_obj:
            persona_dict = {
                "id": persona_obj.id,
                "name": persona_obj.name,
                "genre_preferences": persona_obj.genre_preferences,
                "vocal_style": persona_obj.vocal_style,
                "style_prompt_template": persona_obj.style_prompt_template,
                "system_instructions": persona_obj.system_instructions,
            }

    response = ai_producer_service.process_producer_instruction(
        user_prompt=req.message,
        project_state=req.project_state,
        persona=persona_dict,
    )
    return response

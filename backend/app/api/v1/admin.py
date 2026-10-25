from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import require_role
from backend.app.core.config import settings
from backend.app.models.user import User
from backend.app.models.moderation import Moderation, AuditLog

router = APIRouter(prefix="/admin", tags=["Trust, Safety & Moderation"])

@router.get("/moderation/logs")
async def list_moderation_logs(
    current_user: User = Depends(require_role("moderator")),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    result = await db.execute(select(Moderation).order_by(desc(Moderation.created_at)).limit(50))
    mods = result.scalars().all()
    return [
        {
            "id": m.id,
            "target_type": m.target_type,
            "target_id": m.target_id,
            "flagged_reason": m.flagged_reason,
            "flagged_text": m.flagged_text,
            "status": m.status,
            "created_at": m.created_at
        }
        for m in mods
    ]

@router.get("/banned-artists")
async def get_banned_artists(
    current_user: User = Depends(require_role("creator"))
) -> List[str]:
    """Returns list of protected artist names restricted from prompt impersonation."""
    return settings.banned_artists_list

from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.subscription import Subscription, CreditLedger

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions & Credits"])

@router.get("/tier")
async def get_subscription_details(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    sub_res = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id).order_by(desc(Subscription.created_at))
    )
    sub = sub_res.scalar_one_or_none()

    tier = sub.tier if sub else "free"
    tier_limits = {
        "free": {"max_duration": 60, "stems_allowed": 2, "commercial_rights": False, "priority_queue": False},
        "pro": {"max_duration": 180, "stems_allowed": 4, "commercial_rights": True, "priority_queue": True},
        "studio": {"max_duration": 300, "stems_allowed": 4, "commercial_rights": True, "priority_queue": True},
    }

    return {
        "user_id": current_user.id,
        "role": current_user.role,
        "credits_balance": current_user.credits_balance,
        "subscription_tier": tier,
        "status": sub.status if sub else "active",
        "limits": tier_limits.get(tier, tier_limits["free"])
    }

@router.get("/ledger")
async def get_credit_ledger(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(CreditLedger).where(CreditLedger.user_id == current_user.id).order_by(desc(CreditLedger.created_at)).limit(50)
    )
    ledgers = result.scalars().all()
    return [
        {
            "id": l.id,
            "amount": l.amount,
            "balance_after": l.balance_after,
            "transaction_type": l.transaction_type,
            "reference_id": l.reference_id,
            "notes": l.notes,
            "created_at": l.created_at
        }
        for l in ledgers
    ]

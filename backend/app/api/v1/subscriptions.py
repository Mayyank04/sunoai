from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.subscription import Subscription, CreditLedger
from backend.app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions & Credits"])

@router.get("/tier")
async def get_subscription_details(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    sub_res = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(desc(Subscription.created_at))
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
        "limits": tier_limits.get(tier, tier_limits["free"]),
    }

@router.get("/balance")
async def get_credit_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get detailed breakdown of user credits: current balance, active reservations, and net available balance.
    """
    # Sum active reservations
    r_res = await db.execute(
        select(func.coalesce(func.sum(func.abs(CreditLedger.amount)), 0)).where(
            and_(
                CreditLedger.user_id == current_user.id,
                CreditLedger.status == "reserved",
            )
        )
    )
    reserved = r_res.scalar() or 0

    sub_res = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id, Subscription.status == "active")
    )
    sub = sub_res.scalar_one_or_none()

    return {
        "user_id": current_user.id,
        "credits_balance": current_user.credits_balance,
        "reserved_credits": reserved,
        "available_credits": current_user.credits_balance,
        "tier": sub.tier if sub else "free",
        "role": current_user.role,
    }

@router.get("/ledger")
async def get_credit_ledger(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[Dict[str, Any]]:
    """
    List transaction history in the credit ledger, showing reservations, consumptions, and refunds.
    """
    query = (
        select(CreditLedger)
        .where(CreditLedger.user_id == current_user.id)
        .order_by(desc(CreditLedger.created_at))
    )
    res = await db.execute(query)
    all_entries = res.scalars().all()
    total = len(all_entries)

    offset = (page - 1) * page_size
    items = all_entries[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1

    formatted_items = [
        {
            "id": l.id,
            "amount": l.amount,
            "balance_after": l.balance_after,
            "transaction_type": l.transaction_type,
            "status": l.status,
            "reference_id": l.reference_id,
            "idempotency_key": l.idempotency_key,
            "notes": l.notes,
            "created_at": l.created_at,
        }
        for l in items
    ]

    return PaginatedResponse[Dict[str, Any]](
        items=formatted_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

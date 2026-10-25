from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import Optional
import uuid
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.core.idempotency import IdempotencyService
from backend.app.models.user import User
from backend.app.models.payment import Payment
from backend.app.schemas.entities import PaymentCreate, PaymentRead
from backend.app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/payments", tags=["Payments & Checkout"])

@router.post("", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def process_payment(
    req: PaymentCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Process subscription checkout or credit top-up payment.
    Idempotent: protects against accidental double billing when network drops.
    """
    effective_idempotency_key = idempotency_key or req.idempotency_key

    # Check idempotency cache
    if effective_idempotency_key:
        cached = await IdempotencyService.get_stored_response(effective_idempotency_key)
        if cached:
            return PaymentRead.model_validate(cached)

        # Check DB for existing idempotency key
        p_res = await db.execute(select(Payment).where(Payment.idempotency_key == effective_idempotency_key))
        existing_payment = p_res.scalar_one_or_none()
        if existing_payment:
            return PaymentRead.model_validate(existing_payment)

    payment_intent_id = f"pi_fombo_{uuid.uuid4().hex[:16]}"
    payment = Payment(
        user_id=current_user.id,
        amount_cents=req.amount_cents,
        currency=req.currency,
        status="succeeded",
        payment_intent_id=payment_intent_id,
        payment_method=req.payment_method,
        idempotency_key=effective_idempotency_key,
        metadata_json=req.metadata_json,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    # Store in idempotency cache
    if effective_idempotency_key:
        await IdempotencyService.store_response(
            effective_idempotency_key,
            PaymentRead.model_validate(payment).model_dump(mode="json"),
        )

    return PaymentRead.model_validate(payment)

@router.get("", response_model=PaginatedResponse[PaymentRead])
async def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List payment transactions for authenticated user."""
    query = select(Payment).where(Payment.user_id == current_user.id).order_by(desc(Payment.created_at))
    res = await db.execute(query)
    all_payments = res.scalars().all()
    total = len(all_payments)

    offset = (page - 1) * page_size
    items = all_payments[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[PaymentRead](
        items=[PaymentRead.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

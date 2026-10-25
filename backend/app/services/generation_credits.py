"""Transactional credit reservations for generation jobs.

The caller owns the transaction: these helpers flush, but never commit. Conditional
SQL updates make reservation and settlement safe across concurrent API/worker
processes, including SQLite development and PostgreSQL deployments.
"""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.subscription import CreditLedger
from backend.app.models.user import User


async def reserve_generation_credits(
    db: AsyncSession,
    user_id: str,
    amount: int,
    job_id: str,
    idempotency_key: Optional[str] = None,
) -> CreditLedger:
    if amount <= 0:
        raise ValueError("Generation credit reservation must be positive.")
    # The balance comparison and deduction must be one database operation. Reading
    # an ORM balance and subtracting in Python allows simultaneous overspending.
    balance = (await db.execute(
        update(User)
        .where(User.id == user_id, User.credits_balance >= amount)
        .values(credits_balance=User.credits_balance - amount)
        .returning(User.credits_balance)
        .execution_options(synchronize_session=False)
    )).scalar_one_or_none()
    if balance is None:
        raise HTTPException(status_code=402, detail="Insufficient generation credits.")
    entry = CreditLedger(
        user_id=user_id,
        amount=-amount,
        balance_after=balance,
        transaction_type="generation",
        status="reserved",
        reference_id=job_id,
        idempotency_key=idempotency_key,
        notes=f"Reserved {amount} credits for generation {job_id}",
    )
    db.add(entry)
    await db.flush()
    return entry


async def settle_generation_credits(
    db: AsyncSession,
    job_id: str,
    refund: bool = False,
    reason: str = "",
) -> bool:
    # Claim the outstanding reservation before touching the balance. Only the
    # process that transitions it may refund; duplicate failures/cancellations
    # and late provider responses cannot mint a second refund.
    result = await db.execute(
        update(CreditLedger)
        .where(
            CreditLedger.reference_id == job_id,
            CreditLedger.transaction_type == "generation",
            CreditLedger.status == "reserved",
        )
        .values(status="refunded" if refund else "consumed")
        .returning(CreditLedger.id, CreditLedger.user_id, CreditLedger.amount)
        .execution_options(synchronize_session=False)
    )
    entries = result.all()
    if not entries:
        return False
    if len(entries) != 1:
        # A job must have only one outstanding reservation. Abort the caller's
        # transaction instead of silently crediting an inconsistent ledger.
        raise RuntimeError("Generation job has multiple outstanding reservations.")
    entry_id, owner_id, debit = entries[0]
    if refund:
        if debit >= 0:
            raise RuntimeError("Generation reservation contains an invalid debit.")
        balance = (await db.execute(
            update(User)
            .where(User.id == owner_id)
            .values(credits_balance=User.credits_balance - debit)
            .returning(User.credits_balance)
            .execution_options(synchronize_session=False)
        )).scalar_one_or_none()
        if balance is None:
            raise RuntimeError("Generation reservation owner no longer exists.")
        db.add(CreditLedger(
            user_id=owner_id,
            amount=-debit,
            balance_after=balance,
            transaction_type="refund",
            status="refunded",
            reference_id=job_id,
            parent_ledger_id=entry_id,
            notes=f"Generation refund: {reason}"[:2000],
        ))
    await db.flush()
    return True

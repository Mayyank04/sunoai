from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from backend.app.models.user import User
from backend.app.models.subscription import CreditLedger

class CreditService:
    """
    Transactional Credits Ledger Service with:
    - Atomicity & Idempotency
    - Strict Double-Charge Prevention
    - Pre-allocation / Reservation hold
    - Consumption commit upon success
    - Guaranteed full refund on eligible job/inference failure
    """

    @staticmethod
    async def reserve_credits(
        db: AsyncSession,
        user_id: str,
        amount: int,
        reference_id: str,
        idempotency_key: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> CreditLedger:
        """
        Reserve credits for an inference or editing job before dispatch.
        Guarantees idempotency: presenting the same idempotency_key or reference_id
        returns the existing reservation without double deducting.
        """
        if amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reservation amount must be strictly greater than zero.",
            )

        # 1. Check idempotency key if provided
        if idempotency_key:
            res = await db.execute(
                select(CreditLedger).where(CreditLedger.idempotency_key == idempotency_key)
            )
            existing = res.scalar_one_or_none()
            if existing:
                return existing

        # 2. Check if reference_id already has an active reservation
        res = await db.execute(
            select(CreditLedger).where(
                and_(
                    CreditLedger.user_id == user_id,
                    CreditLedger.reference_id == reference_id,
                    CreditLedger.status.in_(["reserved", "consumed"]),
                )
            )
        )
        existing_ref = res.scalar_one_or_none()
        if existing_ref:
            return existing_ref

        # 3. Retrieve user & balance check
        u_res = await db.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if user.credits_balance < amount:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=(
                    f"Insufficient credits balance ({user.credits_balance} available, {amount} required). "
                    "Please upgrade your plan or top up credits."
                ),
            )

        # 4. Atomic balance deduction
        user.credits_balance -= amount

        ledger_entry = CreditLedger(
            user_id=user.id,
            amount=-amount,
            balance_after=user.credits_balance,
            transaction_type="reservation",
            status="reserved",
            reference_id=reference_id,
            idempotency_key=idempotency_key,
            notes=notes or f"Reserved {amount} credits for job {reference_id}",
        )
        db.add(ledger_entry)
        await db.commit()
        await db.refresh(ledger_entry)
        return ledger_entry

    @staticmethod
    async def commit_credits(
        db: AsyncSession,
        reference_id: str,
    ) -> Optional[CreditLedger]:
        """
        Commit reserved credits when job succeeds.
        Idempotent: if already consumed, safely returns.
        """
        res = await db.execute(
            select(CreditLedger).where(
                and_(
                    CreditLedger.reference_id == reference_id,
                    CreditLedger.status == "reserved",
                )
            )
        )
        entry = res.scalar_one_or_none()
        if not entry:
            # Check if already consumed
            res_c = await db.execute(
                select(CreditLedger).where(
                    and_(
                        CreditLedger.reference_id == reference_id,
                        CreditLedger.status == "consumed",
                    )
                )
            )
            return res_c.scalar_one_or_none()

        entry.status = "consumed"
        entry.notes = f"{entry.notes} (Committed on job completion)"
        await db.commit()
        await db.refresh(entry)
        return entry

    @staticmethod
    async def refund_credits(
        db: AsyncSession,
        reference_id: str,
        reason: str = "eligible_job_failure",
    ) -> Optional[CreditLedger]:
        """
        Refund reserved credits back to the user on eligible failure or cancellation.
        Guarantees idempotency: prevents double refunding.
        """
        # 1. Check if already refunded
        res_r = await db.execute(
            select(CreditLedger).where(
                and_(
                    CreditLedger.reference_id == reference_id,
                    CreditLedger.transaction_type == "refund",
                )
            )
        )
        existing_refund = res_r.scalar_one_or_none()
        if existing_refund:
            return existing_refund

        # 2. Find reservation or consumed charge
        res = await db.execute(
            select(CreditLedger).where(
                and_(
                    CreditLedger.reference_id == reference_id,
                    CreditLedger.status.in_(["reserved", "consumed"]),
                )
            )
        )
        original_entry = res.scalar_one_or_none()
        if not original_entry:
            return None

        # 3. Retrieve user
        u_res = await db.execute(select(User).where(User.id == original_entry.user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            return None

        refund_amount = abs(original_entry.amount)
        user.credits_balance += refund_amount
        original_entry.status = "refunded"

        refund_ledger = CreditLedger(
            user_id=user.id,
            amount=refund_amount,
            balance_after=user.credits_balance,
            transaction_type="refund",
            status="refunded",
            reference_id=reference_id,
            parent_ledger_id=original_entry.id,
            notes=f"Refund of {refund_amount} credits for {reference_id}: {reason}",
        )
        db.add(refund_ledger)
        await db.commit()
        await db.refresh(refund_ledger)
        return refund_ledger

    @staticmethod
    async def add_credits(
        db: AsyncSession,
        user_id: str,
        amount: int,
        transaction_type: str,
        reference_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> CreditLedger:
        """
        Credit allowance top-up or monthly subscription grant.
        Idempotent with idempotency_key to prevent double-crediting.
        """
        if idempotency_key:
            res = await db.execute(
                select(CreditLedger).where(CreditLedger.idempotency_key == idempotency_key)
            )
            existing = res.scalar_one_or_none()
            if existing:
                return existing

        u_res = await db.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        user.credits_balance += amount

        ledger_entry = CreditLedger(
            user_id=user.id,
            amount=amount,
            balance_after=user.credits_balance,
            transaction_type=transaction_type,
            status="consumed",
            reference_id=reference_id,
            idempotency_key=idempotency_key,
            notes=notes or f"Credited {amount} ({transaction_type})",
        )
        db.add(ledger_entry)
        await db.commit()
        await db.refresh(ledger_entry)
        return ledger_entry

credit_service = CreditService()

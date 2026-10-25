from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tier = Column(String(32), nullable=False, default="free")  # 'free', 'pro', 'studio'
    status = Column(String(32), nullable=False, default="active")  # 'active', 'past_due', 'canceled'
    monthly_credit_allowance = Column(Integer, nullable=False, default=50)
    current_period_start = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    stripe_customer_id = Column(String(128), nullable=True)
    stripe_subscription_id = Column(String(128), nullable=True, unique=True)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="subscriptions")

class CreditLedger(Base):
    __tablename__ = "credit_ledgers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # negative for debit, positive for credit
    balance_after = Column(Integer, nullable=False)
    transaction_type = Column(String(64), nullable=False)  # 'generation', 'stem_separation', 'monthly_grant', 'refund', 'topup'
    reference_id = Column(String(128), nullable=True)  # job_id or track_id
    idempotency_key = Column(String(128), nullable=True, unique=True, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="credit_ledgers")

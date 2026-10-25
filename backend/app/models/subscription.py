from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, JSON
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
    status = Column(String(32), nullable=False, default="active")  # 'active', 'past_due', 'canceled', 'trialing'
    provider = Column(String(32), nullable=False, default="stripe")  # 'stripe', 'razorpay'
    monthly_credit_allowance = Column(Integer, nullable=False, default=50)
    current_period_start = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    
    # Provider identifiers
    stripe_customer_id = Column(String(128), nullable=True)
    stripe_subscription_id = Column(String(128), nullable=True, unique=True)
    provider_customer_id = Column(String(128), nullable=True)
    provider_subscription_id = Column(String(128), nullable=True, unique=True, index=True)
    plan_id = Column(String(64), nullable=True)
    
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="subscriptions")
    payments = relationship("Payment", back_populates="subscription")

class CreditLedger(Base):
    __tablename__ = "credit_ledgers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # negative for debit, positive for credit
    balance_after = Column(Integer, nullable=False)
    transaction_type = Column(String(64), nullable=False)  # 'generation', 'stem_separation', 'monthly_grant', 'refund', 'topup', 'reservation'
    status = Column(String(32), default="consumed", nullable=False, index=True)  # 'reserved', 'consumed', 'refunded'
    reference_id = Column(String(128), nullable=True, index=True)  # job_id or track_id
    parent_ledger_id = Column(String(36), nullable=True, index=True)
    idempotency_key = Column(String(128), nullable=True, unique=True, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="credit_ledgers")

class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(32), nullable=False, index=True)  # 'stripe', 'razorpay'
    event_id = Column(String(128), nullable=False, unique=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    processed = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

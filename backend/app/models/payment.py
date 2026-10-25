from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(8), default="USD", nullable=False)
    status = Column(String(32), default="pending", nullable=False, index=True)  # 'pending', 'succeeded', 'failed', 'refunded'
    payment_intent_id = Column(String(128), unique=True, nullable=True, index=True)
    payment_method = Column(String(64), default="stripe_card", nullable=False)
    idempotency_key = Column(String(128), unique=True, nullable=True, index=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User", back_populates="payments")

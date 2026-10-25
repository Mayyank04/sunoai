from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class License(Base):
    __tablename__ = "licenses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    license_type = Column(String(64), default="commercial", nullable=False)  # 'personal', 'commercial', 'sync', 'exclusive'
    price_cents = Column(Integer, default=0, nullable=False)
    currency = Column(String(8), default="USD", nullable=False)
    isrc = Column(String(32), nullable=True)
    terms = Column(Text, nullable=False)
    custom_clauses = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    track = relationship("Track", back_populates="licenses")
    user = relationship("User", back_populates="licenses")

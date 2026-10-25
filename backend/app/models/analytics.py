from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class ListeningPlay(Base):
    __tablename__ = "listening_plays"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True, index=True)
    user_agent = Column(String(255), nullable=True)
    duration_listened_seconds = Column(Float, default=0.0, nullable=False)
    completed_ratio = Column(Float, default=0.0, nullable=False)
    is_valid_play = Column(Boolean, default=True, nullable=False, index=True)
    rejection_reason = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    track = relationship("Track")
    user = relationship("User")

    __table_args__ = (
        Index("idx_play_ratelimit", "track_id", "ip_address", "created_at"),
    )

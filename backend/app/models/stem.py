from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Stem(Base):
    __tablename__ = "stems"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stem_type = Column(String(32), nullable=False)  # 'vocals', 'drums', 'bass', 'other', 'piano'
    audio_url = Column(Text, nullable=False)
    duration_seconds = Column(Float, default=0.0, nullable=False)
    waveform_data = Column(JSON, nullable=True)
    model_used = Column(String(64), default="htdemucs_v4", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    track = relationship("Track", back_populates="stems")

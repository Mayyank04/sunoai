from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class SongVersion(Base):
    __tablename__ = "song_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=False)
    changelog = Column(Text, nullable=True)
    audio_url = Column(Text, nullable=False)
    duration_seconds = Column(Float, default=0.0, nullable=False)
    waveform_data = Column(JSON, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    track = relationship("Track", back_populates="versions")
    creator = relationship("User")

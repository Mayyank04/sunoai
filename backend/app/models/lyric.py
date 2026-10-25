from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Lyric(Base):
    __tablename__ = "lyrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    structure_segments = Column(JSON, nullable=True)  # [{"section": "verse_1", "lines": [...]}, {"section": "chorus", ...}]
    rhymes = Column(JSON, nullable=True)              # detected rhyme pairs / schemes
    syllables = Column(JSON, nullable=True)           # line-by-line syllable count
    language = Column(String(16), default="en", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="lyrics")
    track = relationship("Track", back_populates="lyric_records")

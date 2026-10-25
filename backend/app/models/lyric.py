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
    syllables = Column(JSON, nullable=True)           # line-by-line syllable counts
    language = Column(String(16), default="en", nullable=False)  # 'hi', 'en', 'hinglish', 'pa', etc.

    # Arrangement & Musical Metadata Controls
    topic = Column(String(255), nullable=True)
    theme = Column(String(128), nullable=True)
    tone = Column(String(128), nullable=True)
    rhyme_scheme = Column(String(32), default="AABB", nullable=True)
    genre = Column(String(64), nullable=True)
    bpm = Column(Integer, nullable=True)
    musical_key = Column(String(32), nullable=True)
    time_signature = Column(String(16), default="4/4", nullable=True)
    vocal_style = Column(String(128), nullable=True)
    instrument_preferences = Column(JSON, nullable=True)  # List[str]
    negative_prompt = Column(Text, nullable=True)
    persona = Column(Text, nullable=True)
    arrangement_metadata = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="lyrics")
    track = relationship("Track", back_populates="lyric_records")
    versions = relationship("LyricVersion", back_populates="lyric", cascade="all, delete-orphan", order_by="desc(LyricVersion.version_number)")

class LyricVersion(Base):
    __tablename__ = "lyric_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    lyric_id = Column(String(36), ForeignKey("lyrics.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    structure_segments = Column(JSON, nullable=True)
    rhymes = Column(JSON, nullable=True)
    syllables = Column(JSON, nullable=True)
    language = Column(String(16), default="en", nullable=False)
    change_summary = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    lyric = relationship("Lyric", back_populates="versions")

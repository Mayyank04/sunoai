from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Track(Base):
    __tablename__ = "tracks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    genre = Column(String(64), nullable=True, index=True)
    style_tags = Column(JSON, nullable=True)  # List[str]
    mood = Column(String(64), nullable=True)
    bpm = Column(Integer, nullable=True)
    musical_key = Column(String(16), nullable=True)
    time_signature = Column(String(8), default="4/4", nullable=False)
    duration_seconds = Column(Float, default=0.0, nullable=False)
    audio_url = Column(Text, nullable=False)
    lossless_url = Column(Text, nullable=True)
    waveform_data = Column(JSON, nullable=True)  # List[int] normalized 0-100 peaks
    cover_image_url = Column(Text, nullable=True)
    lyrics = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    is_featured = Column(Boolean, default=False, nullable=False)
    play_count = Column(Integer, default=0, nullable=False)
    like_count = Column(Integer, default=0, nullable=False)
    published_at = Column(DateTime, nullable=True)
    isrc = Column(String(32), unique=True, nullable=True)
    commercial_rights_status = Column(String(64), default="non_commercial_personal", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="tracks")
    generations = relationship("Generation", back_populates="track")
    stems = relationship("Stem", back_populates="track", cascade="all, delete-orphan")
    provenance = relationship("Provenance", back_populates="track", uselist=False, cascade="all, delete-orphan")
    versions = relationship("SongVersion", back_populates="track", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="track")
    lyric_records = relationship("Lyric", back_populates="track")
    likes = relationship("Like", back_populates="track", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="track", cascade="all, delete-orphan")
    licenses = relationship("License", back_populates="track", cascade="all, delete-orphan")

Song = Track  # Canonical alias

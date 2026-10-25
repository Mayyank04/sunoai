from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    display_name = Column(String(128), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    banner_url = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    social_links = Column(JSON, nullable=True)  # {"twitter": "...", "soundcloud": "...", "spotify": "..."}
    preferences = Column(JSON, nullable=True)   # {"sample_rate": 44100, "buffer_size": 1024, "dark_theme": true}
    stats = Column(JSON, nullable=True)         # {"total_plays": 0, "total_tracks": 0, "followers_count": 0}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="profile")

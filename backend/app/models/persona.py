from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class MusicPersona(Base):
    __tablename__ = "music_personas"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    genre_preferences = Column(JSON, default=list, nullable=False)  # List[str] e.g. ["Synthwave", "Cyberpunk"]
    vocal_style = Column(String(64), default="Instrumental", nullable=False)
    style_prompt_template = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    bpm_default = Column(Integer, default=120, nullable=False)
    key_default = Column(String(16), default="C Major", nullable=False)
    system_instructions = Column(Text, nullable=True)  # Producer creative personality rules
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")

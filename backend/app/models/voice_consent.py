from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class VoiceConsent(Base):
    __tablename__ = "voice_consents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    voice_label = Column(String(128), nullable=False)
    consent_statement = Column(Text, nullable=False)
    liveness_phrase_read = Column(Text, nullable=False)
    liveness_audio_url = Column(Text, nullable=False)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(Text, nullable=False)
    status = Column(String(32), default="verified", nullable=False)  # pending, verified, revoked, rejected
    signed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="voice_consents")

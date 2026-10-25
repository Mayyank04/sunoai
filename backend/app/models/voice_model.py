from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class VoiceModel(Base):
    __tablename__ = "voice_models"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    consent_id = Column(String(36), ForeignKey("voice_consents.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    voice_type = Column(String(32), default="singing_voice", nullable=False)  # 'singing_voice', 'spoken_tts', 'speech_only'
    supports_singing = Column(Boolean, default=True, nullable=False)  # Strict capability check
    enrollment_status = Column(String(32), default="enrolled", nullable=False)  # 'pending_verification', 'enrolled', 'revoked', 'deleted'
    reference_audio_url = Column(Text, nullable=False)
    sample_rate = Column(Integer, default=44100, nullable=False)
    pitch_range = Column(String(32), default="C3 - G5", nullable=True)
    timbre_description = Column(String(128), default="Clear Lyric Soprano", nullable=True)
    acoustic_fingerprint_sha256 = Column(String(64), nullable=True)
    ownership_attestation_confirmed = Column(Boolean, default=False, nullable=False)
    verification_challenge_id = Column(String(64), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User")
    consent = relationship("VoiceConsent")
    audit_logs = relationship("VoiceAuditLog", back_populates="voice_model", cascade="all, delete-orphan")

class VoiceAuditLog(Base):
    __tablename__ = "voice_audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    voice_model_id = Column(String(36), ForeignKey("voice_models.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(64), nullable=False)  # 'created', 'enrolled', 'inference_used', 'consent_revoked', 'deleted'
    details = Column(JSON, default=dict, nullable=False)
    ip_address = Column(String(45), default="127.0.0.1", nullable=False)
    user_agent = Column(Text, default="unknown", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    voice_model = relationship("VoiceModel", back_populates="audit_logs")
    user = relationship("User")

from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, BigInteger, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Provenance(Base):
    __tablename__ = "provenances"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    generation_id = Column(String(36), ForeignKey("generations.id", ondelete="SET NULL"), nullable=True)
    creator_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    model_provider = Column(String(64), nullable=False)
    model_checkpoint_hash = Column(String(128), nullable=True)
    generation_seed = Column(BigInteger, nullable=False)
    input_prompt_hash = Column(String(64), nullable=False)  # SHA-256
    output_audio_sha256 = Column(String(64), nullable=False, index=True)
    c2pa_manifest = Column(JSON, nullable=False)
    license_type = Column(String(64), nullable=False)
    commercial_eligibility = Column(Boolean, nullable=False)
    disclaimer = Column(Text, nullable=False)
    verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    track = relationship("Track", back_populates="provenance")

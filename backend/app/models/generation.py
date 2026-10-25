from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Generation(Base):
    __tablename__ = "generations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    job_id = Column(String(128), unique=True, nullable=False, index=True)
    provider = Column(String(64), nullable=False)  # 'fombo_procedural', 'audiocraft', 'suno', 'stability'
    model_name = Column(String(128), nullable=False)
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, nullable=True)
    seed = Column(BigInteger, nullable=False)
    temperature = Column(Float, default=1.0, nullable=False)
    top_k = Column(Integer, default=250, nullable=True)
    top_p = Column(Float, default=0.0, nullable=True)
    duration_requested = Column(Integer, default=60, nullable=False)
    reference_audio_url = Column(Text, nullable=True)
    status = Column(String(32), default="queued", nullable=False, index=True)  # queued, processing, completed, failed
    progress_percentage = Column(Integer, default=0, nullable=False)
    error_code = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    credits_deducted = Column(Integer, default=5, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="generations")
    track = relationship("Track", back_populates="generations")

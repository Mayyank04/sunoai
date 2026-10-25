from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, BigInteger, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    asset_type = Column(String(32), nullable=False, index=True)  # 'audio', 'stem', 'cover_art', 'waveform', 'metadata'
    s3_key = Column(String(512), nullable=True)
    s3_bucket = Column(String(128), nullable=True)
    storage_url = Column(Text, nullable=False)
    mime_type = Column(String(128), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False, default=0)
    sha256_hash = Column(String(64), nullable=True, index=True)
    duration_seconds = Column(Float, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    bit_depth = Column(Integer, nullable=True)
    channels = Column(Integer, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="assets")
    track = relationship("Track", back_populates="assets")

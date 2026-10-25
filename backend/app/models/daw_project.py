from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class DawProject(Base):
    __tablename__ = "daw_projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Untitled Studio Project", nullable=False)
    bpm = Column(Integer, default=120, nullable=False)
    time_signature = Column(String(8), default="4/4", nullable=False)
    master_volume = Column(Float, default=1.0, nullable=False)
    project_state = Column(JSON, nullable=False)  # tracks, clips, automation, mixer settings
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="daw_projects")

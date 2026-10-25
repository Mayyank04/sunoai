from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Moderation(Base):
    __tablename__ = "moderations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    target_type = Column(String(32), nullable=False)  # 'track', 'prompt', 'voice_consent'
    target_id = Column(String(128), nullable=False)
    flagged_reason = Column(String(64), nullable=False)  # 'celebrity_name', 'hate_speech', 'copyright_claim'
    flagged_text = Column(Text, nullable=True)
    status = Column(String(32), default="pending", nullable=False)  # pending, quarantined, approved, rejected
    moderator_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(64), nullable=False, index=True)  # 'generate_song', 'login', 'revoke_voice', 'admin_override'
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(128), nullable=True)
    ip_address = Column(String(45), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

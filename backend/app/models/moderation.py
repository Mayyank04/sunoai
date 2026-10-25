from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Moderation(Base):
    __tablename__ = "moderations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    reporter_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_type = Column(String(32), nullable=False, index=True)  # 'track', 'prompt', 'voice_consent', 'comment', 'user'
    target_id = Column(String(128), nullable=False, index=True)
    flagged_reason = Column(String(64), nullable=False)  # 'celebrity_name', 'hate_speech', 'copyright_claim', 'spam'
    flagged_text = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    status = Column(String(32), default="pending", nullable=False, index=True)  # 'pending', 'quarantined', 'approved', 'rejected', 'dismissed'
    moderator_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    action_taken = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id])
    moderator = relationship("User", foreign_keys=[moderator_id])

Report = Moderation  # Canonical alias

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(64), nullable=False, index=True)  # 'generate_song', 'login', 'revoke_voice', 'admin_override', etc.
    event_type = Column(String(64), nullable=True, index=True)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(128), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User")

AuditEvent = AuditLog  # Canonical alias

class CopyrightClaim(Base):
    __tablename__ = "copyright_claims"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    claimant_name = Column(String(128), nullable=False)
    claimant_email = Column(String(255), nullable=False)
    company_or_organization = Column(String(255), nullable=True)
    work_infringed_title = Column(String(255), nullable=False)
    infringing_track_id = Column(String(36), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    infringing_url = Column(String(512), nullable=True)
    good_faith_attestation = Column(Boolean, default=True, nullable=False)
    accuracy_attestation = Column(Boolean, default=True, nullable=False)
    signature = Column(String(128), nullable=False)
    status = Column(String(32), default="pending", nullable=False, index=True)  # 'pending', 'taken_down', 'reinstated', 'rejected'
    reviewed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    track = relationship("Track")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])


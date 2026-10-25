from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, BigInteger, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

DEFAULT_DISCLAIMER = (
    "Commercial-use eligibility is evaluated based on model provider terms and user source asset "
    "rights declarations. Fombo Music AI does NOT guarantee copyright registration, patent validity, "
    "or immunity from third-party infringement claims."
)

class Provenance(Base):
    __tablename__ = "provenances"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    track_id = Column(String(36), ForeignKey("tracks.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    generation_id = Column(String(36), ForeignKey("generations.id", ondelete="SET NULL"), nullable=True)
    creator_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Model Provider & Checkpoint
    model_provider = Column(String(64), nullable=False)
    model_version = Column(String(64), nullable=True, default="1.0.0")
    model_checkpoint_hash = Column(String(128), nullable=True)
    generation_seed = Column(BigInteger, nullable=False)
    generation_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Input & Output Hashes
    input_prompt_hash = Column(String(64), nullable=False)  # SHA-256
    output_audio_sha256 = Column(String(64), nullable=False, index=True)
    c2pa_manifest = Column(JSON, nullable=False)
    c2pa_manifest_hash = Column(String(64), nullable=True)

    # Licensing & Commercial Eligibility
    license_type = Column(String(64), nullable=False)
    license_version = Column(String(64), default="FOMBO-COMMERCIAL-V2.1", nullable=False)
    commercial_eligibility = Column(Boolean, nullable=False)  # Backward compat
    commercial_use_eligibility = Column(String(32), default="eligible", nullable=False)  # 'eligible', 'ineligible', 'restricted'
    commercial_eligibility_reasons = Column(JSON, nullable=True)

    # User Assets, Rights Declarations, Prompts & Edit History
    user_supplied_assets = Column(JSON, nullable=True)
    source_asset_rights_declarations = Column(JSON, nullable=True)
    prompt_reference = Column(JSON, nullable=True)
    edit_history = Column(JSON, nullable=True)

    # Non-Infringement & Copyright Disclaimers (Never promise copyright registration or non-infringement)
    disclaimer = Column(Text, nullable=False, default=DEFAULT_DISCLAIMER)
    legal_disclaimer = Column(Text, nullable=False, default=DEFAULT_DISCLAIMER)
    verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    track = relationship("Track", back_populates="provenance")

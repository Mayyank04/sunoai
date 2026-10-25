from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class VoiceEnrollmentRequest(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    description: Optional[str] = None
    voice_type: str = Field(default="singing_voice", description="'singing_voice' or 'spoken_tts'")
    supports_singing: bool = Field(default=True, description="Strict declaration. True only if model supports singing synthesis.")
    reference_audio_url: str
    ownership_attestation_confirmed: bool = Field(description="Explicit legal affirmation of voice ownership and synthetic modeling consent.")
    challenge_id: str = Field(description="ID of the phoneme challenge verified during enrollment.")
    pitch_range: Optional[str] = "C3 - G5"
    timbre_description: Optional[str] = "Warm Studio Vocal"

class VoiceAuditLogResponse(BaseModel):
    id: str
    voice_model_id: str
    user_id: str
    action: str
    details: Dict[str, Any]
    ip_address: str
    user_agent: str
    created_at: datetime

    class Config:
        from_attributes = True

class VoiceModelResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    voice_type: str
    supports_singing: bool
    enrollment_status: str
    reference_audio_url: str
    sample_rate: int
    pitch_range: Optional[str]
    timbre_description: Optional[str]
    ownership_attestation_confirmed: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class VoiceRevokeResponse(BaseModel):
    id: str
    name: str
    enrollment_status: str
    revoked_at: datetime
    audit_event_id: str
    message: str

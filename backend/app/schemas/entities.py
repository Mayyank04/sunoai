from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr

# Profile
class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=128)
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None
    preferences: Optional[Dict[str, Any]] = None

class ProfileRead(BaseModel):
    id: str
    user_id: str
    username: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None
    preferences: Optional[Dict[str, Any]] = None
    stats: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Projects (DAW)
class ProjectCreate(BaseModel):
    title: str = Field(..., max_length=255)
    bpm: int = Field(120, ge=40, le=300)
    time_signature: str = Field("4/4", max_length=8)
    master_volume: float = Field(1.0, ge=0.0, le=2.0)
    project_state: Dict[str, Any] = Field(default_factory=dict)

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    bpm: Optional[int] = Field(None, ge=40, le=300)
    time_signature: Optional[str] = None
    master_volume: Optional[float] = None
    project_state: Optional[Dict[str, Any]] = None

class ProjectRead(BaseModel):
    id: str
    user_id: str
    title: str
    bpm: int
    time_signature: str
    master_volume: float
    project_state: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Versions
class SongVersionCreate(BaseModel):
    version_number: int
    title: str
    changelog: Optional[str] = None
    audio_url: str
    duration_seconds: float = 0.0
    waveform_data: Optional[List[int]] = None

class SongVersionRead(BaseModel):
    id: str
    track_id: str
    version_number: int
    title: str
    changelog: Optional[str] = None
    audio_url: str
    duration_seconds: float
    waveform_data: Optional[List[int]] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True

# Assets (Never storing binary blobs in DB)
class AssetCreate(BaseModel):
    asset_type: str = Field(..., pattern="^(audio|stem|cover_art|waveform|metadata)$")
    s3_key: Optional[str] = None
    s3_bucket: Optional[str] = None
    storage_url: str
    mime_type: str
    file_size_bytes: int = 0
    sha256_hash: Optional[str] = None
    duration_seconds: Optional[float] = None
    sample_rate: Optional[int] = None
    bit_depth: Optional[int] = None
    channels: Optional[int] = None
    metadata_json: Optional[Dict[str, Any]] = None

class AssetRead(BaseModel):
    id: str
    user_id: str
    track_id: Optional[str] = None
    asset_type: str
    s3_key: Optional[str] = None
    s3_bucket: Optional[str] = None
    storage_url: str
    mime_type: str
    file_size_bytes: int
    sha256_hash: Optional[str] = None
    duration_seconds: Optional[float] = None
    sample_rate: Optional[int] = None
    bit_depth: Optional[int] = None
    channels: Optional[int] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Jobs (State Machine)
class JobCreate(BaseModel):
    job_type: str = Field(..., pattern="^(generation|stem_separation|mastering|export|scan)$")
    payload: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: int = Field(300, ge=10, le=1800)
    idempotency_key: Optional[str] = None

class JobRead(BaseModel):
    id: str
    user_id: str
    job_type: str
    status: str = Field(..., description="queued, running, succeeded, failed, cancelled")
    progress_percentage: int
    current_stage: str
    retry_count: int
    max_retries: int
    timeout_seconds: int
    idempotency_key: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Lyrics
class LyricCreate(BaseModel):
    title: str
    content: str
    language: str = "en"
    track_id: Optional[str] = None

class LyricRead(BaseModel):
    id: str
    user_id: str
    track_id: Optional[str] = None
    title: str
    content: str
    structure_segments: Optional[List[Dict[str, Any]]] = None
    rhymes: Optional[List[Dict[str, Any]]] = None
    syllables: Optional[List[Dict[str, Any]]] = None
    language: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Artists
class ArtistCreate(BaseModel):
    name: str = Field(..., max_length=128)
    bio: Optional[str] = None
    genre: Optional[str] = None
    avatar_url: Optional[str] = None

class ArtistRead(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    genre: Optional[str] = None
    verified: bool
    monthly_listeners: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Playlists
class PlaylistCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_public: bool = True

class PlaylistUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_public: Optional[bool] = None

class PlaylistTrackAdd(BaseModel):
    track_id: str
    position: Optional[int] = 0

class PlaylistReorderRequest(BaseModel):
    track_ids: List[str]


class PlaylistRead(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_public: bool
    track_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Social
class LikeRead(BaseModel):
    id: str
    user_id: str
    track_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class FollowRead(BaseModel):
    id: str
    follower_id: str
    following_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    track_id: str
    content: str = Field(..., min_length=1, max_length=1000)
    parent_id: Optional[str] = None
    timestamp_seconds: Optional[float] = None

class CommentRead(BaseModel):
    id: str
    user_id: str
    track_id: str
    parent_id: Optional[str] = None
    timestamp_seconds: Optional[float] = None
    content: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Licenses
class LicenseCreate(BaseModel):
    track_id: str
    license_type: str = Field(..., pattern="^(personal|commercial|sync|exclusive)$")
    price_cents: int = Field(0, ge=0)
    terms: str
    custom_clauses: Optional[Dict[str, Any]] = None

class LicenseRead(BaseModel):
    id: str
    track_id: str
    user_id: str
    license_type: str
    price_cents: int
    currency: str
    isrc: Optional[str] = None
    terms: str
    custom_clauses: Optional[Dict[str, Any]] = None
    is_active: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Payments
class PaymentCreate(BaseModel):
    amount_cents: int = Field(..., gt=0)
    currency: str = "USD"
    payment_method: str = "stripe_card"
    idempotency_key: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

class PaymentRead(BaseModel):
    id: str
    user_id: str
    amount_cents: int
    currency: str
    status: str
    payment_intent_id: Optional[str] = None
    payment_method: str
    idempotency_key: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Reports
class ReportCreate(BaseModel):
    target_type: str = Field(..., pattern="^(track|comment|prompt|user|voice_consent)$")
    target_id: str
    flagged_reason: str
    flagged_text: Optional[str] = None
    details: Optional[str] = None

class ReportRead(BaseModel):
    id: str
    reporter_id: Optional[str] = None
    target_type: str
    target_id: str
    flagged_reason: str
    flagged_text: Optional[str] = None
    details: Optional[str] = None
    status: str
    moderator_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    action_taken: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Audit Events
class AuditEventRead(BaseModel):
    id: str
    user_id: Optional[str] = None
    action: str
    event_type: Optional[str] = None
    resource_type: str
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

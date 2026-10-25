from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class TrackResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    genre: Optional[str] = None
    style_tags: Optional[List[str]] = None
    mood: Optional[str] = None
    bpm: Optional[int] = None
    musical_key: Optional[str] = None
    time_signature: str = "4/4"
    duration_seconds: float
    audio_url: str
    lossless_url: Optional[str] = None
    waveform_data: Optional[List[int]] = None
    cover_image_url: Optional[str] = None
    lyrics: Optional[str] = None
    is_public: bool
    visibility: str = "private"
    moderation_status: str = "approved"
    hashtags: Optional[List[str]] = None
    share_count: int = 0
    play_count: int
    like_count: int
    commercial_rights_status: str
    created_at: datetime
    artist_username: Optional[str] = None
    artist_name: Optional[str] = None
    artist_avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class TrackListResponse(BaseModel):
    tracks: List[TrackResponse]
    total: int

class TrackCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    genre: Optional[str] = None
    style_tags: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    mood: Optional[str] = None
    bpm: Optional[int] = None
    musical_key: Optional[str] = None
    audio_url: str
    is_public: bool = False
    visibility: str = "private"

class TrackUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    style_tags: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    mood: Optional[str] = None
    lyrics: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_public: Optional[bool] = None
    visibility: Optional[str] = None

class TrackPublishRequest(BaseModel):
    visibility: str = "public"  # 'public', 'unlisted', 'private'
    title: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    style_tags: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    lyrics: Optional[str] = None
    cover_image_url: Optional[str] = None
    bpm: Optional[int] = None
    musical_key: Optional[str] = None

class TrackPublishResponse(BaseModel):
    track: TrackResponse
    distribution_notice: str = "Published to Fombo Community Platform. Note: Publishing on Fombo does not automatically ingest or distribute your track to external DSPs such as Spotify or Apple Music. External DSP distribution requires export of the C2PA master package to an authorized digital distributor."
    c2pa_manifest_status: str = "signed"
    share_url: str

class TrackShareResponse(BaseModel):
    track_id: str
    share_url: str
    share_count: int

class PlayTelemetryRequest(BaseModel):
    track_id: str
    duration_listened_seconds: float
    completed_ratio: float = 0.0

class PlayTelemetryResponse(BaseModel):
    counted: bool
    play_count: int
    rejection_reason: Optional[str] = None

class CopyrightComplaintRequest(BaseModel):
    claimant_name: str
    claimant_email: str
    company_or_organization: Optional[str] = None
    work_infringed_title: str
    infringing_track_id: str
    infringing_url: Optional[str] = None
    good_faith_attestation: bool = True
    accuracy_attestation: bool = True
    signature: str

class CopyrightComplaintResponse(BaseModel):
    id: str
    status: str
    action_taken: str
    created_at: datetime

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    actor_id: Optional[str] = None
    type: str
    title: str
    message: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total: int



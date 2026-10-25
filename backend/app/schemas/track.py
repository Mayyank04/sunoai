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
    play_count: int
    like_count: int
    commercial_rights_status: str
    created_at: datetime

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
    mood: Optional[str] = None
    bpm: Optional[int] = None
    musical_key: Optional[str] = None
    audio_url: str
    is_public: bool = False

class TrackUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    style_tags: Optional[List[str]] = None
    mood: Optional[str] = None
    is_public: Optional[bool] = None


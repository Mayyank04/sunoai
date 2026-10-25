from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class AudioTrimRequest(BaseModel):
    track_id: str
    start_seconds: float = Field(ge=0.0, description="Start cut point in seconds")
    end_seconds: float = Field(gt=0.0, description="End cut point in seconds")
    fade_in_seconds: float = Field(default=0.0, ge=0.0, le=10.0)
    fade_out_seconds: float = Field(default=0.0, ge=0.0, le=10.0)
    title: Optional[str] = None
    save_as_new_version: bool = True

class AudioFadeRequest(BaseModel):
    track_id: str
    fade_in_seconds: float = Field(default=2.0, ge=0.0, le=15.0)
    fade_out_seconds: float = Field(default=3.0, ge=0.0, le=15.0)
    save_as_new_version: bool = True

class AudioExtendRequest(BaseModel):
    track_id: str
    additional_seconds: int = Field(default=30, ge=5, le=120)
    provider: str = Field(default="suno", description="Audio model backend (e.g. 'suno', 'audiocraft', 'fombo_procedural')")
    prompt: Optional[str] = "Continue progression with heightened harmonic intensity"
    use_ai_conditioning: bool = True

class AudioInpaintSectionRequest(BaseModel):
    track_id: str
    start_seconds: float = Field(ge=0.0)
    end_seconds: float = Field(gt=0.0)
    prompt: str = Field(min_length=3, description="Prompt describing the replacement passage")
    provider: str = Field(default="suno")
    use_ai_conditioning: bool = True

class AudioRemixRequest(BaseModel):
    track_id: str
    target_genre: str = Field(default="Cyberpunk")
    speed_factor: float = Field(default=1.0, ge=0.5, le=2.0)
    bass_boost: float = Field(default=1.0, ge=0.5, le=2.5)
    treble_boost: float = Field(default=1.0, ge=0.5, le=2.5)
    provider: str = Field(default="fombo_procedural")

class AuthorizedCoverRequest(BaseModel):
    original_track_id: str
    cover_title: str = Field(min_length=1, max_length=255)
    vocalist_name: Optional[str] = "Studio Artist"
    genre: str = "Acoustic Pop"
    musical_key: Optional[str] = "C Major"
    bpm: Optional[int] = 110
    is_consented: bool = Field(default=True, description="Attestation of mechanical license / commercial cover consent")

class AudioEditResponse(BaseModel):
    track_id: str
    version_id: Optional[str] = None
    version_number: int
    title: str
    original_audio_url: str
    edited_audio_url: str
    duration_seconds: float
    waveform_data: List[int]
    operation_summary: str
    can_undo: bool = True
    created_at: datetime

class AudioRecordingResponse(BaseModel):
    track_id: str
    title: str
    audio_url: str
    duration_seconds: float
    waveform_data: List[int]
    file_size_bytes: int
    channels: int
    sample_rate: int
    created_at: datetime

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class DawClipSchema(BaseModel):
    id: str
    name: str
    track_id: str
    start_time: float = Field(default=0.0, ge=0.0, description="Start offset on timeline in seconds")
    duration: float = Field(default=4.0, gt=0.0, description="Clip duration on timeline in seconds")
    source_offset: float = Field(default=0.0, ge=0.0, description="Offset within the source audio in seconds")
    source_duration: Optional[float] = None
    audio_url: Optional[str] = None
    color: str = "#00f0ff"
    waveform_data: Optional[List[int]] = None

class DawTrackSchema(BaseModel):
    id: str
    name: str
    track_type: str = Field(default="audio", description="'audio', 'synth', or 'midi'")
    volume: float = Field(default=0.85, ge=0.0, le=2.0)
    pan: float = Field(default=0.0, ge=-1.0, le=1.0)
    muted: bool = False
    solo: bool = False
    color: str = "#00f0ff"
    clips: List[DawClipSchema] = Field(default_factory=list)
    fx_settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    automation: Optional[Dict[str, Any]] = Field(default_factory=dict)

class DawMidiNoteSchema(BaseModel):
    id: str
    pitch: int = Field(ge=0, le=127, description="MIDI note number (e.g. 60 = Middle C)")
    start_beat: float = Field(ge=0.0)
    duration_beats: float = Field(gt=0.0)
    velocity: float = Field(default=0.8, ge=0.0, le=1.0)

class DawMidiClipSchema(BaseModel):
    id: str
    name: str
    start_beat: float = 0.0
    duration_beats: float = 16.0
    notes: List[DawMidiNoteSchema] = Field(default_factory=list)

class DawProjectUpdateRequest(BaseModel):
    title: Optional[str] = None
    bpm: Optional[int] = Field(default=None, ge=40, le=240)
    time_signature: Optional[str] = None
    master_volume: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    project_state: Optional[Dict[str, Any]] = None

class DawRenderRequest(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = "Master Mixdown Export"
    bpm: int = 120
    master_volume: float = 1.0
    tracks: List[DawTrackSchema]
    sample_rate: int = 44100
    export_format: str = "wav"

class DawRenderResponse(BaseModel):
    audio_url: str
    duration_seconds: float
    file_size_bytes: int
    sample_rate: int
    channels: int
    sha256_hash: str
    waveform_data: List[int]
    rendered_at: datetime

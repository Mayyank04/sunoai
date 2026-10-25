from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class GenerationCreateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1500)
    negative_prompt: Optional[str] = None
    genre: Optional[str] = "Synthwave"
    style_tags: List[str] = Field(default_factory=list)
    bpm: int = Field(default=120, ge=40, le=240)
    musical_key: str = Field(default="F Minor")
    duration_seconds: int = Field(default=30, ge=10, le=300)
    provider: str = Field(default="fombo_procedural")
    model_name: str = Field(default="procedural-dsp-v1")
    seed: Optional[int] = None
    temperature: float = Field(default=1.0, ge=0.1, le=2.0)
    reference_audio_url: Optional[str] = None

class GenerationJobResponse(BaseModel):
    job_id: str
    status: str
    provider: str
    model_name: str
    credits_deducted: int
    remaining_balance: int
    stream_url: str
    created_at: datetime

class GenerationStatusResponse(BaseModel):
    job_id: str
    status: str
    progress_percentage: int
    track_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
